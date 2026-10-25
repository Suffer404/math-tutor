"""Structured handwriting feedback for the live maths checker.

The vision model is only trusted for *reading* the page and for advice. Every
mathematical claim it makes is either confirmed by SymPy or downgraded to
"AI-only" / "cannot verify". The AI is never allowed to leak a final answer
through this module's hint fields.

This module is intentionally free of FastAPI imports so it can be unit tested
without a server.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import threading
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from .sympy_service import (
    SymPyVerificationError,
    check_equivalence,
    differentiate,
    parse_latex_safe,
)

PROMPT_VERSION = "live-check-v1"
MAX_STEPS = 12
MAX_STEP_LATEX = 400
MAX_EXPLANATION = 320
MAX_HINT = 240
MAX_QUESTION_CHARS = 2000
MAX_IMAGE_BASE64_CHARS = 8_000_000  # ~6 MB binary
MAX_CACHE_ENTRIES = 64
CACHE_TTL_SECONDS = 10 * 60

_ANSWER_REVEAL_RE = re.compile(
    r"((?:the\s+)?final\s+answer|the\s+answer\s+is|answer\s*[:=]|solution\s*[:=]|therefore\s*[,:]?\s*\$?x\s*=)",
    re.IGNORECASE,
)
_RELATION_RE = re.compile(r"(?<![<>!=:])=(?!=)")
_DERIVATIVE_MARK_RE = re.compile(r"(\\frac\s*\{\s*d(?:\^\{?\d\}?)?\s*\}\s*\{\s*d\s*\w*\s*\}|d\s*/\s*d\s*[a-zA-Z])")
_LHS_NOISE_RE = re.compile(r"\\(?:left|right|displaystyle|,|!|;|:|quad|qquad)|[\s${}]")


class LiveCheckInputError(ValueError):
    """Raised when the request itself is unusable (empty/oversized image)."""


# ---------------------------------------------------------------------------
# Input / JSON safety
# ---------------------------------------------------------------------------
def clean_image_base64(value: Optional[str]) -> str:
    """Validate and normalise a base64 PNG payload without decoding it.

    Returns the base64 string. Raises LiveCheckInputError for empty, oversized
    or non-base64 payloads so the API can answer 400/413 instead of sending
    junk to a paid provider.
    """
    text = (value or "").strip()
    if text.startswith("data:"):
        text = text.split(",", 1)[-1]
    text = "".join(text.split())
    if len(text) < 64:
        raise LiveCheckInputError("The board capture was empty. Draw something first.")
    if len(text) > MAX_IMAGE_BASE64_CHARS:
        raise LiveCheckInputError(
            f"The board capture is too large ({len(text)} base64 chars). "
            "Zoom in or clear part of the board and try again."
        )
    if not re.fullmatch(r"[A-Za-z0-9+/=]+", text):
        raise LiveCheckInputError("The board capture was not valid base64 image data.")
    return text


def parse_ai_json(content: str) -> Optional[Dict[str, Any]]:
    """Best-effort extraction of one JSON object from a model reply.

    Handles markdown fences and short prose around the object. Returns None
    instead of raising, so an occasional malformed reply becomes an honest
    "could not read" response rather than a crash.
    """
    if not content:
        return None
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(number):
        return default
    return max(0.0, min(1.0, number))


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    if isinstance(value, bool):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return number


def _clean_text(value: Any, max_len: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = re.sub(r"\s+", " ", value).strip()
    if not text:
        return None
    return text[:max_len]


def sanitize_hint(value: Any, max_len: int = MAX_HINT) -> Optional[str]:
    """Short, answer-free hint text.

    Anything from an explicit "the answer is"/"solution:" phrase onwards is
    removed: the live overlay may nudge, but must not hand over the answer.
    """
    text = _clean_text(value, max_len * 2)
    if not text:
        return None
    match = _ANSWER_REVEAL_RE.search(text)
    if match:
        text = text[: match.start()].strip().rstrip(" ,:;-—")
    if not text:
        return None
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


def clean_step_latex(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    text = re.sub(r"^\$+|\$+$", "", text)
    text = re.sub(r"^\\[\(\[]|\\[\)\]]$", "", text).strip()
    text = re.sub(r"^(?:\\Rightarrow|\\rightarrow|\\to|\\therefore)\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 1:
        return None
    return text[:MAX_STEP_LATEX]


def sanitize_bbox(value: Any) -> Optional[Dict[str, float]]:
    """Accept [x, y, w, h] or {x, y, width, height} in 0..1 image coordinates.

    Bad, non-finite, inverted or degenerate boxes are discarded rather than
    clamped: a red laser in the wrong place is worse than no laser, and the UI
    then highlights the whole step instead.
    """
    if isinstance(value, dict):
        x = value.get("x")
        y = value.get("y")
        w = value.get("w", value.get("width"))
        h = value.get("h", value.get("height"))
        values = [x, y, w, h]
    elif isinstance(value, (list, tuple)) and len(value) == 4:
        values = list(value)
    else:
        return None

    try:
        x, y, w, h = (float(v) for v in values)
    except (TypeError, ValueError):
        return None
    if not all(math.isfinite(v) for v in (x, y, w, h)):
        return None
    if not (0.0 <= x < 1.0 and 0.0 <= y < 1.0):
        return None
    if not (0.0 < w <= 1.0 and 0.0 < h <= 1.0):
        return None
    if x + w > 1.02 or y + h > 1.02:
        return None
    if w < 0.01 or h < 0.004:  # smaller than a character: not a step region
        return None
    return {
        "x": round(x, 4),
        "y": round(y, 4),
        "width": round(min(w, 1.0 - x), 4),
        "height": round(min(h, 1.0 - y), 4),
    }


def sanitize_ai_feedback(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce an untrusted model reply into the documented feedback shape."""
    raw_steps = raw.get("steps")
    if not isinstance(raw_steps, list):
        raw_steps = raw.get("recognized_steps")
    if not isinstance(raw_steps, list):
        raw_steps = []

    steps: List[Dict[str, Any]] = []
    for index, item in enumerate(raw_steps[:MAX_STEPS]):
        if not isinstance(item, dict):
            continue
        latex = clean_step_latex(item.get("latex") or item.get("expression"))
        if not latex:
            continue
        steps.append(
            {
                "n": len(steps) + 1,
                "latex": latex,
                "confidence": _safe_float(item.get("confidence"), 0.5),
                "bbox": sanitize_bbox(item.get("bbox") or item.get("box")),
            }
        )

    error_step = _safe_int(raw.get("first_error_step"))
    if error_step is None or not 1 <= error_step <= len(steps):
        error_step = None

    bbox = sanitize_bbox(raw.get("error_bbox") or raw.get("bbox"))
    if bbox is None and error_step is not None and steps:
        bbox = steps[error_step - 1].get("bbox")
    if error_step is None:
        bbox = None

    confidence = _safe_float(raw.get("confidence"), 0.0)
    needs_confirmation = raw.get("needs_user_confirmation") is True
    if not steps:
        needs_confirmation = True

    return {
        "steps": steps,
        "first_error_step": error_step,
        "error_bbox": bbox,
        "error_explanation": _clean_text(raw.get("error_explanation"), MAX_EXPLANATION),
        "hint": sanitize_hint(raw.get("hint")),
        "next_step": sanitize_hint(raw.get("next_step"), 160),
        "confidence": confidence,
        "needs_user_confirmation": needs_confirmation,
    }


# ---------------------------------------------------------------------------
# SymPy verification of the transcribed chain
# ---------------------------------------------------------------------------
def split_relation(latex: str) -> tuple[Optional[str], str]:
    """Split "lhs = rhs" at the first top-level equals sign.

    Returns (None, whole) when there is no relation. Comparison operators such
    as <= or != are ignored.
    """
    text = latex.strip()
    text = re.sub(r"\\Rightarrow|\\rightarrow|\\to|\\therefore", " ", text)
    match = _RELATION_RE.search(text)
    if not match:
        return None, text.strip()
    lhs = text[: match.start()].strip()
    rhs = text[match.end() :].strip()
    return (lhs or None), rhs


def _is_derivative_lhs(lhs: str) -> int:
    """Return derivative order implied by the left-hand side, else 0."""
    if not lhs:
        return 0
    compact = lhs.replace(" ", "")
    prime_count = compact.count("'") + compact.count("′") + compact.count("\\prime")
    if _DERIVATIVE_MARK_RE.search(compact) or re.search(r"\bd\s*/\s*d[a-zA-Z]", compact):
        order_match = re.search(r"d\^\{?(\d)\}?\s*/\s*d", compact)
        return int(order_match.group(1)) if order_match else 1
    if prime_count:
        return min(prime_count, 3)
    return 0


def _normalise_lhs(lhs: Optional[str]) -> str:
    if not lhs:
        return ""
    text = lhs.replace("\\prime", "'")
    text = _LHS_NOISE_RE.sub("", text).replace("'", "").replace("′", "")
    return text.lower()


def _parse_operand(text: str):
    try:
        return parse_latex_safe(text)
    except (SymPyVerificationError, Exception):  # noqa: B014 - defensive boundary
        return None


def _eq_result(expr_a, expr_b) -> Optional[bool]:
    """True/False when SymPy can decide, None when it cannot."""
    try:
        result = check_equivalence(expr_a, expr_b)
    except Exception:
        return None
    if result.get("error"):
        return None
    if result.get("equivalent") is True:
        return True
    if result.get("equivalent") is False:
        return False
    return None


def verify_steps(steps: List[Dict[str, Any]], var_name: str = "x") -> Dict[str, Any]:
    """Check each transition against the previous transcribed line with SymPy.

    Only transformations this module can actually prove are labelled valid or
    invalid. Anything else (integrals, unusual notation, unparsable LaTeX) is
    "unverified" and never treated as a mistake.
    """
    from sympy import symbols

    var = symbols(var_name)
    parsed: List[Dict[str, Any]] = []
    for step in steps:
        lhs, rhs = split_relation(step["latex"])
        order = _is_derivative_lhs(lhs or "")
        rhs_expr = _parse_operand(rhs) if rhs else None
        parsed.append(
            {
                "n": step["n"],
                "lhs": lhs,
                "lhs_norm": _normalise_lhs(lhs),
                "rhs": rhs_expr,
                "derivative_order": order,
                "status": "unverified",
                "reason": None,
            }
        )

    checked = 0
    first_error: Optional[int] = None

    for index in range(len(parsed)):
        current = parsed[index]
        if index == 0:
            current["reason"] = "First line: nothing to compare it with yet."
            continue
        previous = parsed[index - 1]
        if current["rhs"] is None:
            current["reason"] = "This line could not be read as a mathematical expression."
            continue

        if current["derivative_order"] > 0 and previous["rhs"] is not None:
            try:
                expected = differentiate(previous["rhs"], var, current["derivative_order"])
            except Exception:
                current["reason"] = "SymPy could not differentiate the previous line."
                continue
            equal = _eq_result(expected, current["rhs"])
            checked += 1
            if equal is True:
                current["status"] = "valid"
                current["reason"] = "Derivative matches the previous line."
            elif equal is False:
                current["status"] = "invalid"
                current["reason"] = "The derivative does not match the previous line."
                if first_error is None:
                    first_error = current["n"]
            else:
                checked -= 1
                current["reason"] = "SymPy could not decide whether the derivative matches."
            continue

        if (
            previous["rhs"] is not None
            and current["derivative_order"] == 0
            and current["lhs_norm"]
            and previous["lhs_norm"]
            and current["lhs_norm"] == previous["lhs_norm"]
        ):
            equal = _eq_result(previous["rhs"], current["rhs"])
            checked += 1
            if equal is True:
                current["status"] = "valid"
                current["reason"] = "Equivalent to the previous line."
            elif equal is False:
                current["status"] = "invalid"
                current["reason"] = "This line is not equivalent to the previous line."
                if first_error is None:
                    first_error = current["n"]
            else:
                checked -= 1
                current["reason"] = "SymPy could not decide equivalence."
            continue

        current["reason"] = "SymPy cannot verify this kind of step automatically."

    transitions = max(len(parsed) - 1, 0)
    all_verified = len(parsed) > 1 and checked == transitions and first_error is None
    sympy_error = None
    if first_error is not None:
        for item in parsed:
            if item["n"] == first_error:
                sympy_error = item["reason"]
                break

    return {
        "steps": parsed,
        "first_error_step": first_error,
        "error_explanation": sympy_error,
        "checked_transitions": checked,
        "total_transitions": transitions,
        "all_verified": all_verified,
    }


# ---------------------------------------------------------------------------
# Merge AI opinion with SymPy evidence
# ---------------------------------------------------------------------------
def _default_hint(first_error: Optional[int], reason: Optional[str], all_verified: bool) -> str:
    if first_error is not None:
        n = first_error
        if reason and "derivative" in reason.lower():
            return (
                f"Check step {n}: the derivative does not match the previous line. "
                "Differentiate each term again and compare coefficients."
            )
        return (
            f"Check step {n}: it is not equivalent to the previous line. "
            "Recheck the algebra before continuing."
        )
    if all_verified:
        return "SymPy finds no error in the transcribed steps. Keep going, then run another check."
    return (
        "I could read the steps but could not verify them with SymPy. "
        "Check the transcription or correct a step, then try again."
    )


def build_feedback(raw: Dict[str, Any], var_name: str = "x") -> Dict[str, Any]:
    """Sanitize the AI reply, verify it, and return the public feedback object."""
    ai = sanitize_ai_feedback(raw)
    verification = verify_steps(ai["steps"], var_name) if ai["steps"] else {
        "steps": [],
        "first_error_step": None,
        "error_explanation": None,
        "checked_transitions": 0,
        "total_transitions": 0,
        "all_verified": False,
    }

    ai_error = ai["first_error_step"]
    sympy_error = verification["first_error_step"]
    first_error: Optional[int]
    status: str

    if sympy_error is not None:
        first_error = sympy_error
        status = "sympy-confirmed"
        explanation = verification["error_explanation"] or ai["error_explanation"]
        hint = ai["hint"] or _default_hint(first_error, verification["error_explanation"], False)
    elif verification["all_verified"]:
        first_error = None
        status = "sympy-cleared"
        explanation = None
        hint = (
            "SymPy finds the transcribed steps consistent, so no error is flagged. Keep working."
            if ai_error
            else (ai["hint"] or _default_hint(None, None, True))
        )
    elif ai_error is not None:
        first_error = ai_error
        status = "ai-only"
        explanation = ai["error_explanation"]
        hint = ai["hint"] or _default_hint(first_error, explanation, False)
    else:
        first_error = None
        status = "cannot-verify" if ai["steps"] else "no-steps"
        explanation = ai["error_explanation"]
        hint = ai["hint"] or _default_hint(None, None, False)

    message = {
        "sympy-confirmed": "SymPy confirms the first incorrect step.",
        "sympy-cleared": "SymPy checked every transcribed transition and found no error.",
        "ai-only": "SymPy could not verify this step; the flag comes from the AI reader only.",
        "cannot-verify": "These steps could not be verified automatically. Treat the hint as a suggestion.",
        "no-steps": "No mathematical steps were recognized.",
    }[status]

    if first_error is not None:
        for item in verification["steps"]:
            if item["n"] == first_error:
                item["status"] = "invalid" if status == "sympy-confirmed" else item["status"]
                break

    return {
        "steps": ai["steps"],
        "first_error_step": first_error,
        "error_bbox": ai["error_bbox"] if first_error is not None else None,
        "error_explanation": explanation,
        "hint": hint,
        "next_step": ai["next_step"],
        "confidence": ai["confidence"],
        "needs_user_confirmation": ai["needs_user_confirmation"] or status in ("cannot-verify", "no-steps"),
        "verification_status": status,
        "verification_message": message,
        "verification": {
            "checked_transitions": verification["checked_transitions"],
            "total_transitions": verification["total_transitions"],
            "step_status": [
                {"n": item["n"], "status": item["status"], "reason": item["reason"]}
                for item in verification["steps"]
            ],
        },
        "ai_flagged_error_step": ai_error,
    }


def error_feedback(message: str, model: str = "unknown") -> Dict[str, Any]:
    """Honest fallback used when the model is unavailable or returns nonsense."""
    return {
        "steps": [],
        "first_error_step": None,
        "error_bbox": None,
        "error_explanation": None,
        "hint": sanitize_hint(message)
        or "I could not read the board. Try again, or type the step that looks wrong.",
        "next_step": None,
        "confidence": 0.0,
        "needs_user_confirmation": True,
        "verification_status": "error",
        "verification_message": "The vision model did not return usable feedback.",
        "verification": {"checked_transitions": 0, "total_transitions": 0, "step_status": []},
        "ai_flagged_error_step": None,
        "model": model,
    }


def build_prompt(question_text: Optional[str] = None) -> str:
    """Compact vision prompt: short output, honest uncertainty, no answer leak."""
    context = (question_text or "").strip()[:MAX_QUESTION_CHARS]
    question_line = f"\nCurrent practice question: {context}\n" if context else ""
    return (
        "You are reading a student's handwritten calculus working on a whiteboard. "
        "Transcribe each step in top-to-bottom order. A step is one line of working, not one glyph. "
        "Use LaTeX for maths. Do not invent steps that are not written.\n"
        f"{question_line}"
        "Reply with ONE compact JSON object and nothing else:\n"
        '{"steps":[{"n":1,"latex":"f(x)=x^3-4x+7","confidence":0.9}],'
        '"first_error_step":null,"error_bbox":null,'
        '"error_explanation":null,"hint":"...","next_step":"...",'
        '"confidence":0.0,"needs_user_confirmation":false}\n'
        "Rules:\n"
        "- first_error_step is the 1-based number of the FIRST mathematically incorrect line, or null.\n"
        "- error_bbox is [x,y,w,h] in normalized image coordinates (0..1) around the WHOLE incorrect "
        "step line, or null if you are not sure where it is. Never guess a box.\n"
        "- hint: at most 2 short sentences, conceptual; NEVER state the final answer or solve it for them.\n"
        "- next_step: one short sentence naming the next operation to try, not its result.\n"
        "- If the handwriting is unclear, set needs_user_confirmation true and explain in one short sentence.\n"
        "- Do not flag a step just because you would write it differently."
    )


# ---------------------------------------------------------------------------
# Result cache + single-flight (token/API conservation)
# ---------------------------------------------------------------------------
class FeedbackCache:
    """Small TTL + LRU cache for identical board captures."""

    def __init__(self, ttl: int = CACHE_TTL_SECONDS, max_entries: int = MAX_CACHE_ENTRIES):
        self.ttl = ttl
        self.max_entries = max_entries
        self._data: "OrderedDict[str, tuple[float, Dict[str, Any]]]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        now = time.time()
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            created, value = entry
            if self.ttl <= 0 or now - created > self.ttl:
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            return value

    def put(self, key: str, value: Dict[str, Any]) -> None:
        with self._lock:
            self._data[key] = (time.time(), value)
            self._data.move_to_end(key)
            while len(self._data) > self.max_entries:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)


def make_cache_key(
    image_base64: str,
    question_id: Optional[str],
    question_text: Optional[str],
    provider_name: str,
    model: str,
) -> str:
    digest = hashlib.sha256()
    for part in (
        PROMPT_VERSION,
        provider_name,
        model,
        question_id or "",
        (question_text or "")[:MAX_QUESTION_CHARS],
        image_base64,
    ):
        digest.update(part.encode("utf-8", errors="ignore"))
        digest.update(b"\x00")
    return digest.hexdigest()
