import pytest
from backend.ai_provider import MockProvider, SyncAIProvider, AIResponse

def test_mock_provider_text():
    provider = MockProvider()
    sync = SyncAIProvider(provider)
    
    response = sync.generate_text("Generate a calculus question")
    assert isinstance(response, AIResponse)
    assert response.model == "mock"
    assert response.tokens_used > 0
    assert "question" in response.content.lower() or "mock" in response.content.lower()

def test_mock_provider_vision():
    provider = MockProvider()
    sync = SyncAIProvider(provider)
    
    response = sync.generate_vision("Analyze handwriting", "fake_base64")
    assert isinstance(response, AIResponse)
    assert response.model == "mock-vision"
    assert response.tokens_used > 0
    
    # Should be valid JSON
    import json
    parsed = json.loads(response.content)
    assert "recognized_steps" in parsed
    assert "hint" in parsed
    assert "confidence" in parsed

def test_mock_provider_call_count():
    provider = MockProvider()
    sync = SyncAIProvider(provider)
    
    sync.generate_text("test 1")
    sync.generate_text("test 2")
    assert provider.call_count == 2

def test_ai_response_structure():
    provider = MockProvider()
    sync = SyncAIProvider(provider)
    
    response = sync.generate_vision("test", "base64")
    
    # Validate response structure matches expected feedback JSON
    import json
    parsed = json.loads(response.content)
    
    assert "recognized_steps" in parsed
    assert isinstance(parsed["recognized_steps"], list)
    assert "uncertain_regions" in parsed
    assert isinstance(parsed["uncertain_regions"], list)
    assert "first_error_step" in parsed
    assert "error_explanation" in parsed
    assert "hint" in parsed
    assert "confidence" in parsed
    assert 0 <= parsed["confidence"] <= 1
    assert "needs_user_confirmation" in parsed

if __name__ == "__main__":
    pytest.main([__file__, "-v"])