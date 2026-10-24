# Math Tutor - Local-First University Mathematics Practice App

A Windows desktop application for practicing university calculus and engineering mathematics by handwriting solutions with AI hints, first-error detection, and SymPy mathematical verification.

## Features

- **Handwriting Whiteboard**: Excalidraw-based canvas with pen/mouse support, persistent state
- **Question Bank**: SQLite-backed question storage with import/export, filtering, and attempt tracking
- **Mathematical Verification**: SymPy-powered differentiation, integration, limits, solving, and equivalence checking
- **AI Assistance** (Optional): Configurable AI provider for question generation and handwriting analysis
- **Progressive Hints**: 3-level hint escalation (concept → rule → next operation)
- **Dashboard**: Weak topic analysis, error log, bookmarks, revision queue
- **Offline-First**: Core features work without internet; AI features are optional
- **Data Export/Backup**: Full backup and restore of questions, attempts, and progress

## Prerequisites

- Windows 11
- Node.js 18+ (with npm)
- Python 3.11+
- Git

## Quick Start (Development)

```powershell
# Clone and enter project
git clone <repo-url>
cd math-tutor

# Install frontend dependencies
npm.cmd install

# Install backend dependencies
python -m pip install fastapi uvicorn aiosqlite jsonschema pydantic sympy pytest httpx

# Start backend (in one terminal)
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# Start frontend (in another terminal)
npm.cmd run dev
```

## Project Structure

```
math-tutor/
├── src/                    # React frontend
│   ├── components/         # React components
│   │   ├── QuestionPanel.tsx
│   │   ├── Whiteboard.tsx
│   │   └── HandwritingCheck.tsx
│   ├── data/               # Sample questions
│   ├── App.tsx             # Main app with routing
│   └── main.tsx            # Entry point
├── backend/                # FastAPI backend
│   ├── main.py             # API endpoints
│   ├── database.py         # SQLite operations
│   ├── schemas.py          # Pydantic models + JSON schema validation
│   ├── sympy_service.py    # Safe SymPy operations
│   └── ai_provider.py      # AI provider abstraction
├── question.schema.json    # Question JSON schema v1.0
├── sample_bank.json        # Sample question bank
├── sample_questions.md     # Sample markdown source
├── markdown_to_bank.py     # Markdown → bank converter
├── docs/                   # Documentation
│   ├── architecture.md
│   ├── api-config.md
│   ├── backup.md
│   └── troubleshooting.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── LICENCES.md
└── README.md
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# AI Provider (optional - uses mock if not set)
AI_PROVIDER=mock          # mock, openai, anthropic
OPENAI_API_KEY=           # If using OpenAI
ANTHROPIC_API_KEY=        # If using Anthropic

# Database
MATH_TUTOR_DB_PATH=math_tutor.db

# Backend
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
```

## Building for Production

```powershell
# Build frontend
npm.cmd run build

# The dist/ folder contains the production build
# For Tauri desktop app (Phase 8), see docs/architecture.md
```

## Running Tests

```powershell
# Frontend tests
npm.cmd run test

# Backend tests
python -m pytest backend/test_backend.py backend/test_sympy.py backend/test_ai_provider.py -v
```

## Architecture Overview

- **Frontend**: React 18 + TypeScript + Vite, Excalidraw for whiteboard
- **Backend**: FastAPI + SQLite (aiosqlite) + SymPy
- **Communication**: REST API over localhost (CORS configured for Tauri)
- **Data**: SQLite with migrations, JSON schema validation
- **AI**: Pluggable provider system (mock, OpenAI, Anthropic)

## Privacy & Security

- Backend binds to 127.0.0.1 only (no network exposure)
- No telemetry or data collection
- AI features require explicit user action and consent
- All data stored locally in SQLite
- No eval/exec of user input - whitelist parser only

## License

MIT License - see LICENCES.md for third-party licenses.