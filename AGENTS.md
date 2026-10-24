# AGENTS.md — Local-First University Maths Tutor (Windows)

Drop this file at the repo root. It is the full operating brief for the coding agent.
Start every session with one line from `PHASES.md`. Nothing else is needed.

---

## Mission

Ship a **working** Windows desktop app for practising university calculus / engineering
mathematics by handwriting solutions: AI hints + first-error detection, SymPy verification,
saved progress, question bank, offline-first. Real implementation with tests each phase —
no mockups, no stub-to-pass, no "done" without a run.

## Machine (fixed)

Win 11 · i5-1135G7 · 8 GB RAM · MX330 2 GB · pen tablet · beginner user · PowerShell
(use `npm.cmd` / `npx.cmd`) · zero budget (free-tier APIs only) · single dev, no Docker.

## Stack (do not substitute without asking)

React + TS + Vite · `@excalidraw/excalidraw` package (not a forked app) · Tauri (phase 8) ·
Python + FastAPI · SQLite (migrations) · SymPy · KaTeX · Marker (separate venv, prep only,
never an app dependency) · Pix2Text optional, only after a small accuracy/speed benchmark.
Pin versions, check licences, record them in `LICENCES.md`.

## Hard rules

- Offline core: drawing, saved questions, local docs, history, SymPy checks — **no API key**.
- No mandatory local LLM; no Docker; never auto-switch to a paid endpoint.
- Bind loopback only; CORS allowlist; request size limits; JSON validated on every import.
- Never `eval` / `exec` / dynamically execute user, Markdown, JSON or AI text. Whitelist parser.
- Secrets only in `.env` (gitignored) + `.env.example`. Never in React, logs, or error strings.
- No file/board upload to any API without an explicit user action and a visible consent note.
- "Verified" is a mathematical claim: AI opinion ≠ proof. Unsupported ⇒ say **cannot verify**.
- Do not reimplement mature libs; do not clone whole repositories into the project.
- Ask before: deleting or overwriting user data, system-wide installs, destructive commands,
  reading folders outside the project.
- Never fabricate test results; list tests that could not run and why.

## Data contract

`question.schema.json` v1.0 – required: `schema_version, id, course, topic, difficulty,
question_type, question_text, source{filename,page,section}, hints[], answer_latex,
solution_steps[], verification_status ∈ {pending, reviewed, verified}`.
Optional: `question_latex`, `misconceptions[]`, `tags[]`. Stable ids; missing source refs stay
missing (never invented); generated → `pending` until a human or a SymPy check verifies it.
Store source text separately from AI output. Validate on import with readable errors.

## Phases — each ends with code + real test run + short report

| # | Build | Acceptance gate |
|---|-------|-----------------|
| 0 | Inspect env, git, node/python/rust, disk; plan + licence list | Plan written, nothing overwritten |
| 1 | Vite app, study layout, Excalidraw, pen+mouse, save/restore **board state**, prev/next sample questions | Draws with tablet and mouse; survives restart |
| 2 | SQLite + migrations, schema validation, import/export, filters, attempts | Sample bank imports, malformed file rejected clearly, persists after restart |
| 3 | SymPy service: safe parse, diff, simplify, equivalence, solve, limits | Correct results; unsupported/ambiguous → unverified |
| 4 | Marker docs (separate env) + Markdown→bank CLI with grounding + `pending` | Sample Markdown yields importable, grounded bank |
| 5 | One AI provider (vision+text if one provider covers both): generate, dedupe, cache, quota errors | Generates from Markdown; never invents citations |
| 6 | Handwriting check: capture → structured JSON → user correction → SymPy cross-check → progressive hints | Correct / wrong chain-rule step / unclear image give three **distinct** results |
| 7 | Dashboard: weak topics, error log, bookmarks, revision queue, mixed practice, backup/restore | Revision queue reflects real mistakes |
| 8 | Tauri packaging: build, data paths, backend lifecycle, installer | Packaged app opens, saves, shuts down cleanly |

Feedback JSON spirit: `recognized_steps[], uncertain_regions[], first_error_step,
error_explanation, hint, confidence, needs_user_confirmation`. Validate; handle bad JSON.
Hints escalate: concept → rule → next operation; full solution only on explicit request.

## Tests (report exact command + result per phase)

pytest unit + API · schema validation · SymPy calculus cases · provider timeout/quota (mocked) ·
DB persistence + backup/restore · import rejection · frontend interaction · manual tablet run ·
production build. One full run per phase; targeted tests while iterating.

## Deliverables

Source · `README.md` (beginner Windows setup, PowerShell commands) · `.env.example` ·
`.gitignore` · `LICENCES.md` · JSON Schema + sample Markdown + sample bank · `docs/architecture.md`
· `docs/api-config.md` · `docs/backup.md` · `docs/troubleshooting.md` · dev run script ·
`KNOWN-LIMITATIONS.md`.

## Token discipline (mandatory — this is how you stay fast)

1. One phase per working session; do not re-read files you did not change.
2. `grep`/glob first, then read only the needed line ranges. Never dump a file, a tree, or a
   whole repo into the answer.
3. Write code to files. In chat: file path + ≤15 line diff or the 1 key snippet only.
4. Status prose ≤10 lines per turn unless asked for detail: changed / ran / result / next.
5. Reuse libraries; prefer one well-pinned dependency over custom code.
6. Cache and pre-compute; never run two heavy jobs at once; keep the UI thread free.
7. Run the smallest test that proves the change, then the phase suite once.
8. Blocked after two attempts → report exact error, files inspected, and one safe next step,
   then ask. Do not loop.

## Turn protocol

`Phase N — <goal>` → files changed → commands run + result → gate status (pass/fail) →
next step. Continue automatically within the phase; stop at phase end or at any rule that
needs approval.
