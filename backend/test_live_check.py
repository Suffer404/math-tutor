"""Tests for live handwriting feedback (AI mocked, SymPy real)."""

import base64
import json

import pytest
from fastapi.testclient import TestClient

import backend.main as main
from backend.ai_provider import AIResponse, MockProvider
from backend.handwriting_service import (
    FeedbackCache,
    build_feedback,
    clean_image_base64,
    sanitize_bbox,
    sanitize_hint,
)
from backend.sympy_service import latex_to_sympy_text, parse_latex_safe


def _image(seed: str) -> str:
    # A deterministic, valid-base64 payload that is long enough for the API.
    return base64.b64encode((seed * 40).encode()).decode()


class FakeVisionProvider:
    model = "fake-vision"

    def __init__(self, payload):
        self.payload = payload
        self.calls = 0

    async def generate_vision(self, prompt, image_base64):
        self.calls += 1
        if isinstance(self.payload, Exception):
            raise self.payload
        content = (
            self.payload
            if isinstance(self.payload, str)
            else json.dumps(self.payload)
        )
        return AIResponse(content=content, model=self.model, tokens_used=37)


@pytest.fixture
def client():
    main._LIVE_FEEDBACK_CACHE.clear()
    main._LIVE_LOCKS.clear()
    return TestClient(main.app)


def _feedback_payload():
    return {
        "steps": [
            {"n": 1, "latex": "f(x) = x^3 - 4x + 7", "confidence": 0.95},
            {"n": 2, "latex": "f'(x) = 3x^2 + 4", "confidence": 0.9},
        ],
        "first_error_step": 2,
        "error_bbox": [0.1, 0.3, 0.55, 0.12],
        "error_explanation": "The derivative of -4x should be -4, not +4.",
        "hint": "Re-differentiate the linear term. The final answer is 3x^2-4.",
        "next_step": "Differentiate each term separately.",
        "confidence": 0.86,
        "needs_user_confirmation": False,
    }


def test_latex_converter_handles_common_handwriting():
    assert str(parse_latex_safe("3x^2 - 4")) == "3*x**2 - 4"
    assert str(parse_latex_safe(r"\frac{1}{2}x")) == "x/2"
    assert str(parse_latex_safe(r"\sin(x^2)")) == "sin(x**2)"
    assert str(parse_latex_safe(r"2x\cos(x^2)")) == "2*x*cos(x**2)"
    assert str(parse_latex_safe(r"e^{2x}")) == "exp(2*x)"
    assert latex_to_sympy_text(r"\sqrt{x+1}") == "sqrt(x+1)"


def test_sympy_confirms_wrong_derivative():
    result = build_feedback(_feedback_payload())
    assert result["verification_status"] == "sympy-confirmed"
    assert result["first_error_step"] == 2
    assert result["verification"]["step_status"][1]["status"] == "invalid"
    # The AI's final answer must be stripped from the hint.
    assert "final answer" not in result["hint"].lower()
    assert "3x^2-4" not in result["hint"]
    assert result["error_bbox"] == {"x": 0.1, "y": 0.3, "width": 0.55, "height": 0.12}


def test_sympy_clears_false_positive_when_all_steps_verify():
    payload = {
        "steps": [
            {"latex": "f(x) = x^3 - 4x + 7"},
            {"latex": "f'(x) = 3x^2 - 4"},
        ],
        "first_error_step": 2,
        "error_explanation": "AI thinks this is wrong.",
        "hint": "Check step 2.",
        "confidence": 0.7,
    }
    result = build_feedback(payload)
    assert result["verification_status"] == "sympy-cleared"
    assert result["first_error_step"] is None
    assert result["ai_flagged_error_step"] == 2
    assert result["error_bbox"] is None


def test_ai_only_when_sympy_cannot_verify():
    payload = {
        "steps": [
            {"latex": r"\int 2x \, dx = x^2 + C"},
            {"latex": "= x^2 + C"},
        ],
        "first_error_step": 2,
        "error_explanation": "Missing something.",
        "hint": "Review the integration.",
        "confidence": 0.6,
    }
    result = build_feedback(payload)
    assert result["verification_status"] == "ai-only"
    assert result["first_error_step"] == 2


def test_unparseable_steps_are_not_claimed_wrong():
    payload = {
        "steps": [
            {"latex": r"\text{scribble}"},
            {"latex": r"\unknowncommand{x}"},
        ],
        "first_error_step": None,
        "hint": "I cannot read this.",
        "confidence": 0.3,
    }
    result = build_feedback(payload)
    assert result["verification_status"] == "cannot-verify"
    assert result["first_error_step"] is None
    assert result["needs_user_confirmation"] is True


def test_bbox_rejects_bad_or_guessed_coordinates():
    assert sanitize_bbox([0.1, 0.2, 0.3, 0.1]) == {
        "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1,
    }
    assert sanitize_bbox({"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1}) is not None
    assert sanitize_bbox([-0.1, 0.2, 0.3, 0.1]) is None
    assert sanitize_bbox([0.9, 0.2, 0.5, 0.1]) is None
    assert sanitize_bbox([0.1, 0.2, 0, 0.1]) is None
    assert sanitize_bbox([float("nan"), 0.2, 0.3, 0.1]) is None
    assert sanitize_bbox(None) is None
    assert sanitize_bbox("0.1,0.2") is None


def test_sanitize_hint_removes_answer_reveal():
    assert sanitize_hint("Check the sign. The final answer is x=2.") == "Check the sign."
    assert sanitize_hint("The answer is 42") is None
    assert sanitize_hint("Next, apply the chain rule.") == "Next, apply the chain rule."


def test_clean_image_rejects_empty_and_invalid():
    with pytest.raises(Exception):
        clean_image_base64("")
    with pytest.raises(Exception):
        clean_image_base64("not base64 !!! " + "A" * 80)


def test_api_returns_sympy_confirmed_feedback_and_caches(client, monkeypatch):
    fake = FakeVisionProvider(_feedback_payload())
    monkeypatch.setattr(main, "get_provider", lambda: fake)
    image = _image("cache-test")

    response = client.post(
        "/ai/live-check",
        json={"image_base64": image, "question_id": "q1", "question_text": "Differentiate f(x)"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verification_status"] == "sympy-confirmed"
    assert body["first_error_step"] == 2
    assert body["error_bbox"]["width"] == 0.55
    assert body["cached"] is False
    assert body["tokens_used"] == 37
    assert fake.calls == 1

    again = client.post(
        "/ai/live-check",
        json={"image_base64": image, "question_id": "q1", "question_text": "Differentiate f(x)"},
    )
    assert again.status_code == 200
    assert again.json()["cached"] is True
    assert again.json()["tokens_used"] == 0
    assert fake.calls == 1, "identical capture must not spend a second API call"


def test_api_force_bypasses_cache(client, monkeypatch):
    fake = FakeVisionProvider(_feedback_payload())
    monkeypatch.setattr(main, "get_provider", lambda: fake)
    image = _image("force-test")
    payload = {"image_base64": image, "question_id": "q2"}

    assert client.post("/ai/live-check", json=payload).status_code == 200
    forced = client.post("/ai/live-check", json={**payload, "force": True})
    assert forced.status_code == 200
    assert forced.json()["cached"] is False
    assert fake.calls == 2


def test_api_handles_invalid_model_json(client, monkeypatch):
    fake = FakeVisionProvider("I think the answer is 42, no JSON here")
    monkeypatch.setattr(main, "get_provider", lambda: fake)
    response = client.post(
        "/ai/live-check", json={"image_base64": _image("bad-json"), "question_id": "q3"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verification_status"] == "error"
    assert body["first_error_step"] is None
    assert body["needs_user_confirmation"] is True
    assert fake.calls == 1


def test_api_malformed_bbox_is_dropped(client, monkeypatch):
    payload = _feedback_payload()
    payload["error_bbox"] = [0.95, 0.1, 0.5, 0.4]  # extends past the image
    fake = FakeVisionProvider(payload)
    monkeypatch.setattr(main, "get_provider", lambda: fake)
    response = client.post(
        "/ai/live-check", json={"image_base64": _image("bbox-test"), "question_id": "q4"}
    )
    assert response.status_code == 200
    assert response.json()["error_bbox"] is None


def test_api_rejects_empty_capture(client):
    response = client.post("/ai/live-check", json={"image_base64": "", "question_id": "q5"})
    assert response.status_code == 400


def test_api_never_returns_mock_fabricated_steps(client, monkeypatch):
    monkeypatch.setattr(main, "get_provider", lambda: MockProvider())
    response = client.post(
        "/ai/live-check", json={"image_base64": _image("mock-test"), "question_id": "q7"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verification_status"] == "error"
    assert body["steps"] == []
    assert body["needs_user_confirmation"] is True


def test_api_provider_error_is_reported_not_cached(client, monkeypatch):
    class ErrorProvider:
        model = "fake-vision"

        def __init__(self):
            self.calls = 0

        async def generate_vision(self, prompt, image_base64):
            self.calls += 1
            return AIResponse(content="", model="fake-vision", tokens_used=0, error="rate limit")

    fake = ErrorProvider()
    monkeypatch.setattr(main, "get_provider", lambda: fake)
    response = client.post(
        "/ai/live-check", json={"image_base64": _image("error-test"), "question_id": "q6"}
    )
    assert response.status_code == 502
    assert "rate limit" in response.json()["detail"]
    assert len(main._LIVE_FEEDBACK_CACHE) == 0


def test_cache_ttl_expiry():
    cache = FeedbackCache(ttl=0, max_entries=2)
    cache.put("a", {"hint": "x"})
    assert cache.get("a") is None
    cache.put("b", {"hint": "b"})
    cache.put("c", {"hint": "c"})
    cache.put("d", {"hint": "d"})
    assert len(cache) == 2
