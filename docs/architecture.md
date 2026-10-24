# Architecture Documentation

## System Overview

Math Tutor is a local-first Windows desktop application for practicing university-level calculus and engineering mathematics. It follows a client-server architecture within a single machine:

```
┌─────────────────────────────────────────────────────────────┐
│                      Windows 11                              │
│  ┌──────────────────┐    HTTP/JSON     ┌────────────────┐   │
│  │  React Frontend  │ ◄──────────────► │  FastAPI       │   │
│  │  (Vite + TS)     │   127.0.0.1:8000 │  Backend       │   │
│  │  Port: 5173      │                  │  (Python)      │   │
│  └──────────────────┘                  └───────┬────────┘   │
│         │                                     │            │
│         │              ┌──────────────────────┘            │
│         ▼              ▼                                   │
│  ┌─────────────────────────────────────┐                   │
│  │         Local Storage                │                   │
│  │  • SQLite (questions, attempts,     │                   │
│  │    bookmarks, progress)             │                   │
│  │  • localStorage (whiteboard state)  │                   │
│  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Architecture (React + TypeScript + Vite)

### Component Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Main app with view routing
├── styles.css            # Global styles
├── data/
│   └── sampleQuestions.ts # Sample questions (TypeScript)
├── components/
│   ├── QuestionPanel.tsx  # Sidebar with question, hints, solution
│   ├── Whiteboard.tsx     # Excalidraw whiteboard (practice mode)
│   └── HandwritingCheck.tsx # Handwriting analysis mode
└── test/
    └── setup.ts           # Test setup
```

### State Management

- **React useState/useEffect** for local component state
- **localStorage** for whiteboard persistence (survives reload)
- **REST API** for backend communication (questions, attempts, verification)
- No global state library (Redux/Zustand) - kept simple

### Key Components

#### QuestionPanel
- Displays question text, LaTeX (via KaTeX), hints, solution
- Prev/Next navigation through question bank
- Progressive hint disclosure

#### Whiteboard
- Excalidraw canvas for freehand drawing
- Pen/mouse/tablet support
- Auto-saves to localStorage on change
- Clear button to reset

#### HandwritingCheck
- Same whiteboard with "Analyze Handwriting" button
- Captures canvas as base64 PNG
- Sends to backend `/ai/handwriting-check`
- Shows recognized steps with confidence
- User confirmation/correction dialog per step
- Progressive hints on error detection

## Backend Architecture (FastAPI + Python)

### Module Structure

```
backend/
├── main.py              # FastAPI app + all endpoints
├── database.py          # SQLite connection + migrations
├── schemas.py           # Pydantic models + JSON schema validation
├── sympy_service.py     # Safe SymPy operations (whitelist parser)
├── ai_provider.py       # AI provider abstraction (mock/OpenAI/Anthropic)
├── test_backend.py      # API tests
├── test_sympy.py        # SymPy service tests
└── test_ai_provider.py  # AI provider tests
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/questions/import` | POST | Import validated questions |
| `/questions` | GET | List questions (filterable) |
| `/attempts` | POST | Record attempt |
| `/attempts/{qid}` | GET | Get attempts for question |
| `/bookmarks/{qid}` | POST | Toggle bookmark |
| `/verify/step` | POST | Verify single step equivalence |
| `/verify/differentiate` | POST | Compute derivative |
| `/verify/integrate` | POST | Compute integral |
| `/verify/simplify` | POST | Simplify expression |
| `/verify/equivalence` | POST | Check expression equivalence |
| `/verify/solve` | POST | Solve equation |
| `/verify/limit` | POST | Compute limit |
| `/ai/generate` | POST | Generate questions (AI) |
| `/ai/handwriting-check` | POST | Analyze handwriting (AI) |

### Database Schema

```sql
-- Questions table
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    course TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question_type TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_latex TEXT,
    source_json TEXT NOT NULL,
    hints_json TEXT NOT NULL,
    answer_latex TEXT NOT NULL,
    solution_steps_json TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    misconceptions_json TEXT,
    tags_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attempts table
CREATE TABLE attempts (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    user_solution TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    feedback_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions (id)
);

-- Bookmarks table
CREATE TABLE bookmarks (
    question_id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions (id)
);
```

## SymPy Verification Service

### Safety Principles

1. **Whitelist Parser Only**: Uses `sympy.parsing.sympy_parser.parse_expr` with restricted transformations
2. **No eval/exec**: Never executes arbitrary code
3. **Allowed Functions**: sin, cos, tan, exp, log, sqrt, abs, pi, e, oo, I
4. **Honest Unverified**: Returns `unsupported: true` for ambiguous/unparseable input

### Operations

- **Differentiation**: `diff(expr, var, order)`
- **Integration**: `integrate(expr, var, limits?)`
- **Simplification**: `simplify(expr)`
- **Equivalence**: Multi-method (direct, simplify, numerical sampling)
- **Solving**: `solve(expr, var)` for `expr = 0`
- **Limits**: `limit(expr, var, point, dir)`

### Step Verification

The `verify_step(user_step, expected_step, var)` function:
1. Parses both expressions safely
2. Checks equivalence via multiple methods
3. Returns confidence score and method used
4. Marks `unsupported: true` if parsing fails

## AI Provider System

### Abstraction Layer

```python
class AIProvider(ABC):
    @abstractmethod
    async def generate_text(prompt, system_prompt) -> AIResponse
    @abstractmethod
    async def generate_vision(prompt, image_base64) -> AIResponse
```

### Providers

1. **MockProvider** (default): Offline, deterministic responses for testing
2. **OpenAIProvider**: GPT-4o-mini for text, GPT-4o-mini for vision
3. **AnthropicProvider**: Claude 3 Haiku for text and vision

### Features

- **Caching**: SHA256-based cache in `cache/ai_responses/` (1 week TTL)
- **Error Handling**: Graceful degradation (rate limits, auth errors, timeouts)
- **Configurable**: Via `AI_PROVIDER` env var

### Handwriting Analysis Flow

1. Frontend captures canvas → base64 PNG
2. POST to `/ai/handwriting-check` with image + question_id
3. Backend calls AI provider with structured prompt
4. AI returns JSON with:
   - `recognized_steps[]`: {step, latex, confidence}
   - `uncertain_regions[]`: ambiguous areas
   - `first_error_step`: index or null
   - `error_explanation`: description
   - `hint`: progressive (concept → rule → operation)
   - `confidence`: 0-1
   - `needs_user_confirmation`: bool
5. Frontend shows correction dialog per step
6. User confirms or corrects LaTeX
7. Final result sent to `onCheckComplete` callback

## Data Flow: Question Import

```
Markdown (.md)          JSON Schema          SQLite
     │                      │                   │
     ▼                      ▼                   ▼
markdown_to_bank.py ──► validate ──► INSERT OR REPLACE
     │                      │                   │
     ▼                      ▼                   ▼
sample_bank.json      question.schema.json   questions table
```

### Question Schema (v1.0)

Required fields:
- `schema_version`, `id`, `course`, `topic`, `difficulty`
- `question_type`, `question_text`, `source`
- `hints[]`, `answer_latex`, `solution_steps[]`
- `verification_status` ∈ {pending, reviewed, verified}

Optional:
- `question_latex`, `misconceptions[]`, `tags[]`

## Security Considerations

1. **Loopback Only**: Backend binds to 127.0.0.1
2. **CORS**: Configured for Tauri (restrict in production)
3. **Input Validation**: JSON schema validation on all imports
4. **No Dynamic Execution**: Whitelist parser, no eval/exec
5. **Secrets**: Only in `.env` (gitignored), never in frontend
6. **Request Limits**: Configured in uvicorn/FastAPI
7. **Consent**: AI features require explicit user action

## Deployment Architecture (Tauri - Phase 8)

```
┌────────────────────────────────────────┐
│           Tauri App                    │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ WebView     │  │ Sidecar         │  │
│  │ (React)     │  │ (FastAPI +      │  │
│  │             │  │  SymPy)         │  │
│  └──────┬──────┘  └────────┬────────┘  │
│         │                  │            │
│         └────────┬─────────┘            │
│                  ▼                      │
│         ┌─────────────────┐             │
│         │ Local Data      │             │
│         │ (AppData/       │             │
│         │  math-tutor/)   │             │
│         └─────────────────┘             │
└────────────────────────────────────────┘
```

- Frontend built to static files, loaded in WebView
- Backend runs as sidecar process (bundled Python or system Python)
- Data stored in `%APPDATA%\math-tutor\`
- NSIS/MSI installer for Windows distribution

## Performance Considerations

- **Frontend**: Code-split by view (lazy load HandwritingCheck)
- **Backend**: Connection pooling via aiosqlite
- **SymPy**: Cached parse results for repeated operations
- **AI**: Response caching (1 week), async requests
- **Bundle Size**: ~2.8MB JS (Excalidraw + KaTeX dominant)

## Known Limitations

See `KNOWN-LIMITATIONS.md`