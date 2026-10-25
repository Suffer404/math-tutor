"""
AI Provider Integration - configurable, supports free-tier APIs
"""

import os
import json
import hashlib
import time

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    from pathlib import Path
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass
from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod
from pathlib import Path
from dataclasses import dataclass
import httpx

# Cache directory
CACHE_DIR = Path("cache/ai_responses")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Runtime AI configuration written by the Settings dialog (overrides .env).
# Kept outside git: ai_config.json is gitignored.
AI_CONFIG_PATH = Path(__file__).resolve().parent.parent / "ai_config.json"


def load_ai_config() -> Dict[str, Any]:
    """Read ai_config.json; returns {} when absent or unreadable."""
    try:
        if AI_CONFIG_PATH.exists():
            data = json.loads(AI_CONFIG_PATH.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
    except Exception:
        pass
    return {}


def save_ai_config(cfg: Dict[str, Any]) -> None:
    AI_CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def mask_key(key: Optional[str]) -> str:
    if not key:
        return ""
    if len(key) <= 12:
        return key[:4] + "..."
    return key[:10] + "..." + key[-4:]


@dataclass
class AIResponse:
    content: str
    model: str
    tokens_used: int
    cached: bool = False
    error: Optional[str] = None

class AIProvider(ABC):
    """Abstract base for AI providers."""
    
    @abstractmethod
    def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> AIResponse:
        pass
    
    @abstractmethod
    def generate_vision(self, prompt: str, image_base64: str) -> AIResponse:
        pass

class MockProvider(AIProvider):
    """Mock provider for testing and offline development."""
    
    def __init__(self):
        self.call_count = 0
        
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> AIResponse:
        self.call_count += 1
        # Return a mock response based on prompt keywords
        if "question" in prompt.lower() and "generate" in prompt.lower():
            return AIResponse(
                content=json.dumps({
                    "schema_version": "1.0",
                    "id": f"q_gen_{self.call_count}",
                    "course": "Calculus I",
                    "topic": "Derivatives",
                    "difficulty": "medium",
                    "question_type": "differentiation",
                    "question_text": "Find the derivative of f(x) = sin(x^2) + cos(3x).",
                    "question_latex": "f(x) = \\sin(x^2) + \\cos(3x)",
                    "source": {"filename": "AI Generated", "section": "Chain Rule Practice"},
                    "hints": [
                        "Use the chain rule: d/dx[sin(u)] = cos(u) * du/dx",
                        "For sin(x^2), u = x^2, so du/dx = 2x",
                        "For cos(3x), u = 3x, so du/dx = 3"
                    ],
                    "answer_latex": "f'(x) = 2x\\cos(x^2) - 3\\sin(3x)",
                    "solution_steps": [
                        "d/dx[sin(x^2)] = cos(x^2) * 2x",
                        "d/dx[cos(3x)] = -sin(3x) * 3",
                        "Combine: f'(x) = 2x cos(x^2) - 3 sin(3x)"
                    ],
                    "verification_status": "pending",
                    "tags": ["chain-rule", "trigonometric"]
                }),
                model="mock",
                tokens_used=100
            )
        return AIResponse(
            content="Mock response for: " + prompt[:50],
            model="mock",
            tokens_used=50
        )
    
    async def generate_vision(self, prompt: str, image_base64: str) -> AIResponse:
        self.call_count += 1
        # Mock handwriting analysis response
        return AIResponse(
            content=json.dumps({
                "recognized_steps": [
                    {"step": 1, "latex": "f(x) = x^3 - 4x + 7", "confidence": 0.9},
                    {"step": 2, "latex": "f'(x) = 3x^2 - 4", "confidence": 0.85}
                ],
                "uncertain_regions": [],
                "first_error_step": None,
                "error_explanation": None,
                "hint": "Good start! You correctly applied the power rule.",
                "confidence": 0.88,
                "needs_user_confirmation": False
            }),
            model="mock-vision",
            tokens_used=150
        )

class OpenAIProvider(AIProvider):
    """OpenAI API provider (requires API key)."""
    
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model
        # Optional separate model for images; the text model may be text-only.
        self.vision_model = (
            os.getenv("OPENAI_VISION_MODEL")
            or os.getenv("AI_VISION_MODEL")
            or model
        )
        self.client = httpx.AsyncClient(
            base_url="https://api.openai.com/v1",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60.0
        )
    
    def _cache_key(self, prompt: str, image_base64: Optional[str] = None) -> str:
        content = prompt + (image_base64 or "")
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _get_cached(self, cache_key: str) -> Optional[AIResponse]:
        cache_file = CACHE_DIR / f"{cache_key}.json"
        if cache_file.exists():
            try:
                data = json.loads(cache_file.read_text())
                if time.time() - data.get("timestamp", 0) < 86400 * 7:  # 1 week
                    data["cached"] = True
                    return AIResponse(**data)
            except:
                pass
        return None
    
    def _save_cache(self, cache_key: str, response: AIResponse):
        cache_file = CACHE_DIR / f"{cache_key}.json"
        data = {
            "content": response.content,
            "model": response.model,
            "tokens_used": response.tokens_used,
            "cached": False,
            "error": response.error,
            "timestamp": time.time()
        }
        cache_file.write_text(json.dumps(data))
    
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> AIResponse:
        cache_key = self._cache_key(prompt)
        cached = self._get_cached(cache_key)
        if cached:
            return cached
            
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = await self.client.post("/chat/completions", json={
                "model": self.model,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 2000
            })
            
            if response.status_code == 429:
                return AIResponse(
                    content="",
                    model=self.model,
                    tokens_used=0,
                    error="Rate limit exceeded. Please wait."
                )
            if response.status_code == 401:
                return AIResponse(
                    content="",
                    model=self.model,
                    tokens_used=0,
                    error="Invalid API key."
                )
            if response.status_code == 402:
                return AIResponse(
                    content="",
                    model=self.model,
                    tokens_used=0,
                    error="Requesty: account balance is too low. Top up at app.requesty.ai/settings/billing.",
                )

            response.raise_for_status()
            data = response.json()

            ai_response = AIResponse(
                content=data["choices"][0]["message"]["content"],
                model=self.model,
                tokens_used=data.get("usage", {}).get("total_tokens", 0)
            )
            self._save_cache(cache_key, ai_response)
            return ai_response

        except httpx.TimeoutException:
            return AIResponse(content="", model=self.model, tokens_used=0, error="Request timeout")
        except Exception as e:
            return AIResponse(content="", model=self.model, tokens_used=0, error=str(e))
    
    async def generate_vision(self, prompt: str, image_base64: str) -> AIResponse:
        cache_key = self._cache_key(prompt, image_base64)
        cached = self._get_cached(cache_key)
        if cached:
            return cached
            
        try:
            response = await self.client.post("/chat/completions", json={
                "model": self.vision_model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}}
                    ]
                }],
                "temperature": 0.2,
                "max_tokens": 1500
            })
            
            if response.status_code == 429:
                return AIResponse(content="", model=self.vision_model, tokens_used=0, error="Rate limit exceeded")
            response.raise_for_status()
            
            data = response.json()
            ai_response = AIResponse(
                content=data["choices"][0]["message"]["content"],
                model=self.vision_model,
                tokens_used=data.get("usage", {}).get("total_tokens", 0)
            )
            self._save_cache(cache_key, ai_response)
            return ai_response
            
        except Exception as e:
            return AIResponse(content="", model=self.vision_model, tokens_used=0, error=str(e))

class RequestyProvider(AIProvider):
    """Requesty AI Router provider (OpenAI-compatible API)."""
    
    def __init__(self, api_key: str, model: str = None, base_url: str = None):
        self.api_key = api_key
        # model and base_url can come from the Settings dialog, then env
        self.model = model or os.getenv("REQUESTY_MODEL") or "openai/gpt-4o-mini"
        # A text model (e.g. a cheap coding model) may not accept images, so
        # allow a separate vision model without changing the text model.
        self.vision_model = (
            os.getenv("REQUESTY_VISION_MODEL")
            or os.getenv("AI_VISION_MODEL")
            or self.model
        )
        self.base_url = (base_url or os.getenv("REQUESTY_BASE_URL") or "https://router.requesty.ai/v1").rstrip("/")
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60.0
        )
    
    def _cache_key(self, prompt: str, image_base64: Optional[str] = None) -> str:
        content = prompt + (image_base64 or "")
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _get_cached(self, cache_key: str) -> Optional[AIResponse]:
        cache_file = CACHE_DIR / f"{cache_key}.json"
        if cache_file.exists():
            try:
                data = json.loads(cache_file.read_text())
                if time.time() - data.get("timestamp", 0) < 86400 * 7:  # 1 week
                    data["cached"] = True
                    return AIResponse(**data)
            except:
                pass
        return None
    
    def _save_cache(self, cache_key: str, response: AIResponse):
        cache_file = CACHE_DIR / f"{cache_key}.json"
        data = {
            "content": response.content,
            "model": response.model,
            "tokens_used": response.tokens_used,
            "cached": False,
            "error": response.error,
            "timestamp": time.time()
        }
        cache_file.write_text(json.dumps(data))
    
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> AIResponse:
        cache_key = self._cache_key(prompt)
        cached = self._get_cached(cache_key)
        if cached:
            return cached
            
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = await self.client.post("/chat/completions", json={
                "model": self.model,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 2000
            })
            
            if response.status_code == 429:
                return AIResponse(
                    content="",
                    model=self.model,
                    tokens_used=0,
                    error="Rate limit exceeded. Please wait."
                )
            if response.status_code == 401:
                return AIResponse(
                    content="",
                    model=self.model,
                    tokens_used=0,
                    error="Invalid API key."
                )
            
            if response.status_code == 402:
                return AIResponse(
                    content="",
                    model=self.model,
                    tokens_used=0,
                    error="Requesty: account balance is too low. Top up at app.requesty.ai/settings/billing.",
                )
            
            response.raise_for_status()
            data = response.json()
            
            ai_response = AIResponse(
                content=data["choices"][0]["message"]["content"],
                model=self.model,
                tokens_used=data.get("usage", {}).get("total_tokens", 0)
            )
            self._save_cache(cache_key, ai_response)
            return ai_response
            
        except httpx.TimeoutException:
            return AIResponse(content="", model=self.model, tokens_used=0, error="Request timeout")
        except Exception as e:
            return AIResponse(content="", model=self.model, tokens_used=0, error=str(e))
    
    async def generate_vision(self, prompt: str, image_base64: str) -> AIResponse:
        cache_key = self._cache_key(prompt, image_base64)
        cached = self._get_cached(cache_key)
        if cached:
            return cached
            
        try:
            response = await self.client.post("/chat/completions", json={
                "model": self.vision_model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}}
                    ]
                }],
                "temperature": 0.2,
                "max_tokens": 1500
            })
            
            if response.status_code == 429:
                return AIResponse(content="", model=self.vision_model, tokens_used=0, error="Rate limit exceeded")
            if response.status_code == 402:
                return AIResponse(
                    content="",
                    model=self.vision_model,
                    tokens_used=0,
                    error="Requesty: account balance is too low. Top up at app.requesty.ai/settings/billing.",
                )
            response.raise_for_status()
            
            data = response.json()
            ai_response = AIResponse(
                content=data["choices"][0]["message"]["content"],
                model=self.vision_model,
                tokens_used=data.get("usage", {}).get("total_tokens", 0)
            )
            self._save_cache(cache_key, ai_response)
            return ai_response
            
        except Exception as e:
            return AIResponse(content="", model=self.vision_model, tokens_used=0, error=str(e))

class AnthropicProvider(AIProvider):
    """Anthropic Claude API provider."""
    
    def __init__(self, api_key: str, model: str = "claude-3-haiku-20240307"):
        self.api_key = api_key
        self.model = model
        self.vision_model = (
            os.getenv("ANTHROPIC_VISION_MODEL")
            or os.getenv("AI_VISION_MODEL")
            or model
        )
        self.client = httpx.AsyncClient(
            base_url="https://api.anthropic.com/v1",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            timeout=60.0
        )
    
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> AIResponse:
        try:
            body = {
                "model": self.model,
                "max_tokens": 2000,
                "temperature": 0.3,
                "messages": [{"role": "user", "content": prompt}]
            }
            if system_prompt:
                body["system"] = system_prompt
                
            response = await self.client.post("/messages", json=body)
            
            if response.status_code == 429:
                return AIResponse(content="", model=self.model, tokens_used=0, error="Rate limit")
            
            response.raise_for_status()
            data = response.json()
            
            content = "".join([block["text"] for block in data.get("content", []) if block.get("type") == "text"])
            return AIResponse(
                content=content,
                model=self.model,
                tokens_used=data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)
            )
        except Exception as e:
            return AIResponse(content="", model=self.model, tokens_used=0, error=str(e))
    
    async def generate_vision(self, prompt: str, image_base64: str) -> AIResponse:
        try:
            response = await self.client.post("/messages", json={
                "model": self.vision_model,
                "max_tokens": 1500,
                "temperature": 0.2,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_base64}}
                    ]
                }]
            })
            response.raise_for_status()
            data = response.json()
            content = "".join([block["text"] for block in data.get("content", []) if block.get("type") == "text"])
            usage = data.get("usage", {})
            return AIResponse(
                content=content,
                model=self.vision_model,
                tokens_used=usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
            )
        except Exception as e:
            return AIResponse(content="", model=self.vision_model, tokens_used=0, error=str(e))

def get_provider() -> AIProvider:
    """Build the provider from ai_config.json (Settings dialog), else from .env."""
    cfg = load_ai_config()
    provider_type = str(cfg.get("provider") or os.getenv("AI_PROVIDER", "mock")).lower()

    # any OpenAI-compatible endpoint: requesty, openrouter, groq, ollama, ...
    if provider_type in ("requesty", "custom", "openai-compatible", "compatible"):
        api_key = cfg.get("api_key") or os.getenv("REQUESTY_API_KEY")
        if not api_key:
            print("Warning: no API key configured, falling back to mock")
            return MockProvider()
        base_url = cfg.get("base_url") or os.getenv("REQUESTY_BASE_URL") or "https://router.requesty.ai/v1"
        model = cfg.get("model") or os.getenv("REQUESTY_MODEL") or "openai/gpt-4o-mini"
        return RequestyProvider(api_key, model, base_url)

    if provider_type == "openai":
        api_key = cfg.get("api_key") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("Warning: OPENAI_API_KEY not set, falling back to mock")
            return MockProvider()
        return OpenAIProvider(api_key, cfg.get("model") or "gpt-4o-mini")

    if provider_type == "anthropic":
        api_key = cfg.get("api_key") or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("Warning: ANTHROPIC_API_KEY not set, falling back to mock")
            return MockProvider()
        return AnthropicProvider(api_key, cfg.get("model") or "claude-3-haiku-20240307")

    return MockProvider()


# Sync wrapper for easier use in non-async contexts
class SyncAIProvider:
    """Synchronous wrapper around async providers."""
    
    def __init__(self, provider: AIProvider):
        self.provider = provider
    
    def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> AIResponse:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self.provider.generate_text(prompt, system_prompt))
    
    def generate_vision(self, prompt: str, image_base64: str) -> AIResponse:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self.provider.generate_vision(prompt, image_base64))