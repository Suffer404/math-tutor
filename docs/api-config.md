# API Configuration Guide

## Backend Server

The FastAPI backend runs on `http://127.0.0.1:8000` by default.

### Starting the Server

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_HOST` | `127.0.0.1` | Bind address (keep as localhost) |
| `BACKEND_PORT` | `8000` | Port number |
| `MATH_TUTOR_DB_PATH` | `math_tutor.db` | SQLite database path |

### API Base URL

All endpoints are relative to `http://127.0.0.1:8000`.

## Authentication

Currently no authentication is implemented (local-only). For Tauri deployment, the frontend communicates directly with the backend sidecar.

## CORS Configuration

In `backend/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

For Tauri, restrict to `tauri://localhost` and `https://tauri.localhost`.

## Rate Limiting

Not implemented in base version. Recommended for production:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/questions")
@limiter.limit("30/minute")
async def list_questions(...):
    ...
```

## Request Size Limits

Configure in uvicorn:

```bash
uvicorn main:app --limit-concurrency 100 --limit-max-requests 1000 --timeout-keep-alive 30
```

Or in FastAPI:

```python
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware

class LimitRequestSize(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.headers.get("content-length"):
            size = int(request.headers["content-length"])
            if size > 10 * 1024 * 1024:  # 10MB
                return Response("Request too large", status_code=413)
        return await call_next(request)

app.add_middleware(LimitRequestSize)
```

## AI Provider Configuration

### Provider Selection

Set via `AI_PROVIDER` environment variable:

```bash
# Mock (default, offline)
AI_PROVIDER=mock

# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### OpenAI Configuration

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Required for OpenAI provider |
| Model | `gpt-4o-mini` (text), `gpt-4o-mini` (vision) |

### Anthropic Configuration

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for Anthropic provider |
| Model | `claude-3-haiku-20240307` (text), `claude-3-haiku-20240307` (vision) |

### AI Response Caching

- Location: `cache/ai_responses/`
- Key: SHA256(prompt + image_base64)[:16]
- TTL: 7 days
- Disable: Delete cache directory or set TTL to 0

## Database Configuration

### SQLite Path

```bash
MATH_TUTOR_DB_PATH=math_tutor.db
```

For Tauri, use platform-appropriate path:

```python
import os
import platform

if platform.system() == "Windows":
    db_path = os.path.join(os.environ["APPDATA"], "math-tutor", "math_tutor.db")
else:
    db_path = os.path.join(os.path.expanduser("~"), ".local", "share", "math-tutor", "math_tutor.db")
```

### Migrations

Run on startup via `init_db()` in `database.py`. Schema version tracked in `questions.schema_version`.

## Frontend API Configuration

In `vite.config.ts`, the frontend proxies API calls during development:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
```

In production (Tauri), the frontend calls the sidecar directly at `http://127.0.0.1:8000`.

## Health Check

```bash
curl http://127.0.0.1:8000/docs  # Swagger UI
curl http://127.0.0.1:8000/redoc  # ReDoc
```

## Logging

Configure uvicorn logging:

```bash
uvicorn main:app --log-level info --access-log
```

Or in Python:

```python
import logging
logging.basicConfig(level=logging.INFO)
```

## SSL/TLS

Not needed for local development (localhost). For Tauri sidecar, consider:
- Self-signed cert for localhost
- Or communicate via stdin/stdout instead of HTTP

## Troubleshooting

See `docs/troubleshooting.md`