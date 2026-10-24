# One-shot build prompt — Local-First University Maths Tutor

Paste everything below the line into a fresh opencode session started inside
`G:\New folder\math-tutor`. It is self-contained: it does not need AGENTS.md, but is
compatible with one if present.

---

You are building a **working Windows desktop study app** for university calculus and
engineering mathematics. A student writes solutions by hand on a whiteboard; the app gives
hints, finds the first wrong step, and verifies supported maths with SymPy. Everything core
works offline. Build it for real: code, run, test, fix. No mockups, no stubs to pass tests, no
"done" without an executed check.

## Machine
Win 11 · i5-1135G7 · 8 GB RAM · MX330 2 GB · pen tablet · PowerShell (`npm.cmd`, `npx.cmd`) ·
Node 26 · Python 3.11 · Git installed · **Rust missing** · zero budget · single user, no Docker.

## Rules that never bend
1. Without an API key the app must still: draw, save/restore board state, browse and import
   questions, record attempts, run SymPy checks, back up data.
2. Loopback only (`127.0.0.1`). No LAN bind. CORS allowlist for the Vite origin. Request size caps.
3. Never `eval`/`exec`, never `import_module` from user input, never run Markdown/JSON as code.
   SymPy input goes through a whitelist parser with length and time limits.
4. Secrets only in `.env` (gitignored) + `.env.example` placeholders. Never in React, logs, or
   error text. Redact keys from every error string.
5. No image or course file leaves the machine without a visible button and a one-line consent
   note ("this sends the board image to <provider>").
6. "Verified" is a mathematical claim. AI agreement is not proof. Unsupported, ambiguous or
   timed-out ⇒ status `cannot_verify`, never "correct".
7. Ask before: deleting/overwriting user data, installing system-wide toolchains, downloading
   models over 1 GB, any destructive command.
8. Never report a test you did not run. List what could not run and why.

## Stack (pin these)
- Frontend: Vite + **React 18.3** + TypeScript strict. Pin `@excalidraw/excalidraw@0.17.6`
  (import its CSS; React 19 is not supported by that version — do not upgrade React).
  `katex` + `react-katex` for equations. No UI framework required; plain CSS modules are fine.
- Backend: FastAPI + uvicorn on `127.0.0.1:8765`; `pydantic` v2; `sympy`; `jsonschema`;
  `httpx`; `python-dotenv`; `python-multipart`.
- Database: **SQLite via Python's stdlib `sqlite3`** in the backend (keeps native modules out of
  Node). DB path `%APPDATA%\MathsTutor\data.db`, overridable by `MT_DATA_DIR`. Numbered
  migration files + a `schema_migrations` table.
- UI: React never touches the DB directly; it calls `http://127.0.0.1:8765/api/*`.
- Layout: `apps/web` (Vite), `services/api` (FastAPI), `services/api/migrations`,
  `tools/md2bank` (CLI), `docs`, `data/samples`.

## Data contract — `data/question.schema.json` (v1.0, JSON Schema, draft 2020-12)
Required: `schema_version` ("1.0"), `id` (stable, e.g. `q_<8hex>`), `course`, `topic`,
`difficulty` (`easy|medium|hard`), `question_type`, `question_text`,
`source{filename,page|null,section|null}`, `hints` (2–4 strings), `answer_latex`,
`solution_steps` (array), `verification_status` (`pending|reviewed|verified`).
Optional: `question_latex`, `tags[]`, `misconceptions[]`.
Validation on every import with readable path-level errors; reject unknown `schema_version` with
a migration message. Missing page/section stays `null` — never invent a citation.

DB tables: `sources`, `questions`, `attempts`, `boards` (question_id, excalidraw_json, png_path,
updated_at), `prefs`, `schema_migrations`. Generated questions enter as `pending`.

## API (all JSON, all under `/api`)
`GET /health` · `GET /questions` (filters: course, topic, difficulty, type, status, q, limit,
offset) · `GET /questions/{id}` · `POST /questions/import` (JSON body or file) ·
`GET /questions/export` · `POST /attempts` · `GET /attempts?question_id=` ·
`GET /stats/weak-topics` · `PUT /boards/{question_id}` · `GET /boards/{question_id}` ·
`POST /sympy/verify` · `POST /ai/analyze` (multipart: image, question_id, mode) ·
`POST /ai/generate` · `GET /prefs` · `PUT /prefs` · `POST /backup` · `POST /restore`.
Return `{ok:true,data}` or `{ok:false,error:{code,message,details}}`. Never leak tracebacks.

## SymPy service
`POST /sympy/verify {op, expr, expected?, variable?}` with
`op ∈ differentiate|simplify|equivalent|solve|limit|evaluate`.
Whitelist: `x y t n a b c`, `sin cos tan asin acos atan sinh cosh tanh exp log sqrt abs pi E`,
`+ - * / **`, integers, `Rational`. Reject `__`, `.`, `[`, `]`, `{`, `}`, `=`, newlines, unknown
names, input > 500 chars. Run each check with a wall-clock limit (~3 s) and catch timeouts.
Equivalence = `simplify(a-b)==0` then fallbacks (`trigsimp`, `together`, `nsimplify`); on timeout
or failure return `status:"cannot_verify"` with a reason, never `"correct"`. Responses:
`{status: "correct"|"incorrect"|"cannot_verify", canonical_latex, explanation}`.

## AI provider (one adapter, OpenAI-compatible)
`.env`: `AI_BASE_URL`, `AI_API_KEY`, `AI_TEXT_MODEL`, `AI_VISION_MODEL`, `AI_TIMEOUT=45`,
`AI_MAX_RETRIES=2`. One provider may serve both text and vision. `GET /api/health` reports
`ai_configured: true|false` and the model names. Add `POST /api/ai/test` ("Test connection").
Cache identical requests by SHA-256 of the payload. Handle 401/429/5xx distinctly with plain
messages ("quota exhausted, retry in …"), never auto-switch to a paid endpoint, never retry
non-idempotent uploads blindly. Image ≤ 1600 px longest side, JPEG q80.

**Handwriting analysis** (`/api/ai/analyze`): send image + question text + the last recognised
steps + mode. Demand strict JSON:
`{recognized_steps:[{index, latex, plain}], uncertain_regions:[{index, reason}],
first_error_step: int|null, error_explanation: string, hint: string,
confidence: 0..1, needs_user_confirmation: bool}`.
Validate with pydantic; on malformed JSON retry once with a repair instruction, then return
`cannot_verify`. If `needs_user_confirmation` or confidence < 0.7, show an editable transcription
panel and **do not judge** until the student confirms. Cross-check recognised steps with SymPy
when the step is a supported operation; a SymPy failure outranks the model. Final state is one of
`correct | incorrect | cannot_verify | unclear_handwriting` — and the UI must show them
differently. Hints escalate: concept → rule → next operation; reveal `answer_latex` only after an
explicit "Show full solution" click.

## UI (single study screen, light + dark)
Top bar: course · chapter · topic · source `file p.42`; question number; difficulty chip; type.
Question card renders `question_latex` with KaTeX; long text collapsible.
Buttons: Previous, Next, Hint, Check my work, Show explanation, Reset attempt (confirm before
clearing). Keyboard: `Ctrl+Enter` check, `H` hint, `←/→` navigate, `Ctrl+S` save, `Ctrl+Z/Y`,
`Del` clear (confirm). Board: Excalidraw filling the centre, ~70 % of height, pen-eraser-undo-redo-
zoom-pan and an explicit **Save**; autosave board JSON debounced 1.5 s, restored on question
change and on app restart. Export PNG (and PDF if trivial). Feedback panel: recognised steps as
editable LaTeX rows, first error highlighted, explanation, hint, verification status badge;
empty, loading, error and offline states all designed. Responsive to 1280×720. No layout shift
when feedback appears.

## Phases — implement in order, commit after each, do not stop between sub-steps
0. Inspect env, write `docs/plan.md`, `LICENCES.md` (verify each SPDX id; no placeholders, no
   "likely"). Record disk space. *(Marker's GitHub repo is Apache-2.0; its downloaded model
   weights may carry separate terms — say so explicitly.)*
1. Vite app + Excalidraw + study layout + board save/restore + 5 sample questions in
   `data/samples/sample-bank.json`. Gate: draw with tablet, quit, relaunch, strokes return;
   `npm.cmd run build` exits 0.
2. Backend + SQLite + migrations + import/export + filters + attempts. Gate: sample bank imports;
   a deliberately malformed JSON is rejected with a field-level message; data survives restart.
3. SymPy service + safe parser + equivalence + timeouts. Gate: `d/dx (3x^2+1)^5` verified;
   an equivalent-looking-but-wrong pair returns `incorrect`; an unsupported input returns
   `cannot_verify`.
4. `tools/md2bank` CLI: Markdown → grounded `pending` bank (preserve filename/page/section),
   schema-validated. Marker documented in `docs/marker.md` for a **separate** venv; the app must
   not import it.
5. AI provider + `/ai/generate` (grounded, deduped by normalised text hash, cached) +
   `/ai/test`. Gate: with a stub provider the pipeline produces valid pending questions and
   invents no citations.
6. Handwriting flow end-to-end with 3 fixtures (correct solution / wrong chain-rule step /
   ambiguous handwriting) served by a stub provider — deterministic, no network in tests.
   Gate: three distinct outcomes, and an unconfirmed transcription is never judged.
7. Dashboard: weak topics (accuracy < 60 % with ≥ 3 attempts), error log, bookmarks, revision
   queue, mixed practice, backup/restore (`POST /backup` writes a timestamped zip; restore
   validates before replacing and keeps a `.bak`).
8. Tauri: scaffold `apps/desktop`, spawn/kill the FastAPI sidecar, data paths under
   `%APPDATA%\MathsTutor`, `tauri build` when Rust exists. If Rust is absent: scaffold config,
   document `winget install Rustlang.Rustup` + prerequisites, and **ask** before installing.

## Tests (pytest + vitest) — must actually run
`services/api/tests`: schema validation (valid, missing field, bad version, wrong type), import
rejection, sqlite persistence + migration idempotency, backup/restore round-trip, sympy ops
(diff, equivalence true/false, limit, solve, timeout, whitelist rejection), API contracts with
FastAPI TestClient, AI adapter with mocked `httpx` (401, 429, 500, malformed JSON).
`apps/web`: board state serialise/restore, question navigation, hint level cap, feedback state
mapping. Fixtures in `data/samples/solutions/` (correct.png, wrong-step.png, unclear.png) plus
`stub_responses/*.json`. Report the exact command and real output per phase in `PROGRESS.md`.

## Deliverables
`README.md` (beginner Windows setup, PowerShell commands, troubleshooting) · `.env.example` ·
`.gitignore` · `LICENCES.md` · `data/question.schema.json` · `data/samples/sample-bank.json` ·
`data/samples/source-notes.md` · `tools/md2bank` + usage · `docs/architecture.md` (diagram of
processes/ports/paths) · `docs/api-config.md` · `docs/marker.md` · `docs/backup.md` ·
`KNOWN-LIMITATIONS.md` · `run-dev.ps1` (starts backend + web, prints both URLs) · `PROGRESS.md`.

## Working protocol (how to spend the least for the most)
- Write code to files. In chat: path, a ≤15-line diff or the one key snippet, the command you
  ran, its real result. No full-file dumps, no directory trees, no re-pasting the plan.
- Read narrowly: grep/glob first, then only the needed line ranges. Never re-read unchanged files.
- After each phase: run its tests, append 5 lines to `PROGRESS.md`, `git add -A && git commit -m
  "phase N: <gate>"`. Then continue to the next phase without asking.
- Blocked twice on the same error: report the exact error, the files you inspected, and one safe
  next step. Then stop and ask. Do not loop or silently work around a rule.
- Keep status text ≤ 10 lines per turn. Never claim a gate passed unless the command output above
  it proves it.

## Definition of done
`run-dev.ps1` starts both processes; drawing works with pen and mouse; board state and attempts
survive restart; sample import + malformed rejection work; SymPy returns correct/incorrect/
cannot_verify honestly; handwriting flow yields four distinct states with no invented citations;
`pytest` and `npm.cmd run build` are green; `.env` is absent from git; `KNOWN-LIMITATIONS.md`
lists everything unfinished, including Tauri if Rust was not installed.
