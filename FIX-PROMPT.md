# FIX-PROMPT.md — repair five layout/feature bugs in the running app

Paste-ready brief for opencode. Send it as `@FIX-PROMPT.md` plus the evidence block at the end
(logs, `/api/health`, screenshot path). Diagnose first, one commit per fix, prove each with a run.

---

You are fixing a **running** app in this repo (React+TS+Vite whiteboard study screen). It already
works: tabs (Practice / Handwriting / Dashboard), a question panel, an Excalidraw board, a bottom
"Handwriting Analysis" bar. Do not redesign it and do not rewrite it. Fix these five problems,
smallest possible diff per problem, and prove each fix by running the app.

## Rule 0 — diagnose before editing
For each bug, first state in one sentence *why* it happens (file:line), then fix it.
If you cannot find the cause, say what you inspected and stop — do not guess-patch.
Keep the app runnable after every commit. Commit per bug: `fix: <symptom>`.

## Bug 1 — writing area too small (board must be full-screen)
- Board is the base layer of the content area (`position:absolute; inset:0` in a `position:relative`
  main region) or a full-viewport canvas with floating overlays. No reserved left column.
- At 1366×768 and 1920×1080 the board covers ≥ 85% of viewport area, no horizontal scrollbars,
  Excalidraw toolbar reachable.
- Panels become overlays with shadow + chevron collapse; collapse state in `localStorage`
  (`ui.questionCollapsed`, `ui.analysisCollapsed`).
- Fullscreen button calls `document.documentElement.requestFullscreen()` on the board container;
  `Esc` exits; `F` toggles. In fullscreen only a slim top strip + tools remain.
- Keep Excalidraw's own zoom/undo. Verify pointer events reach all four corners.

## Bug 2 — question must live with the board
- Render the question as a floating card docked top-centre of the board (max-width ~720 px):
  topic, question text + KaTeX, source line, status chip. Compact = one truncated line + expand.
- Card is click-through for drawing except its controls (`pointer-events:none` on the container,
  `auto` on buttons), or collapse-on-stroke. Test drawing under and around it.
- Side panel keeps difficulty/type, hints, solution, Previous/Next, question list — it no longer
  duplicates the question in large form. Opens with `Q`.
- Next/previous updates the card with no layout shift.

## Bug 3 — add a question as plain text
Modal from the side panel and command palette:
- Fields: question text (required), optional LaTeX, topic (select + free text), difficulty,
  optional answer, optional source label. Accept pasted text and `.txt`/`.md` drop.
- `POST /api/questions` with `source:{filename:"manual",page:null,section:null}`,
  `verification_status:"pending"`, stable id. Appears in list immediately, no restart.
- Server validates against `data/question.schema.json`; field-level errors inline.
- Verify: add → reload → still there → present in `GET /api/questions/export`.

## Bug 4 — handwriting analysis does not work
Observed: "Analyze Handwriting" renders disabled and nothing explains why. Fix the whole path.
Check in order: (1) `disabled` bound to a flag from `/api/health` that fails (404/CORS/`ai_configured`
false because `.env` missing); (2) board capture: `exportToBlob` needs the Excalidraw API ref —
`exportToBlob({elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles()})`;
(3) endpoint/field-name mismatch between client and FastAPI route; (4) pydantic rejecting the model
JSON so the handler 500s silently.
Required:
- Enabled whenever the board has strokes. If AI is unconfigured, clicking explains it in a sheet:
  "AI not configured — add AI_BASE_URL / AI_API_KEY", with `Test connection` and
  `Check with SymPy only` (local verification of typed/pasted steps).
- With a key or stub: capture ≤1600 px, POST image + question id, spinner with cancel, render one of
  four states: correct / incorrect (first bad step highlighted) / cannot verify / unclear handwriting
  (editable transcription, no judgement until confirmed).
- Every failure visible: network error, 401, 429, timeout, malformed JSON → short message +
  "details" with the code. Never a silently dead button. Never log keys or images.
- Verify with `AI_STUB=1` returning `data/samples/stub/*.json` so the flow is provable offline.

## Bug 5 — the bottom bar wastes drawing space
Replace the fixed "Handwriting Analysis" strip with a floating pill bottom-right: `Analyze`,
`Clear`, status dot. Expands only when there is feedback.

## Acceptance (run all, paste real output)
1. `npm.cmd run build` exits 0; `pytest` and `npm.cmd test` green (or say what cannot run).
2. Screenshots at 1366×768 and 1920×1080 with panels collapsed, board ≥ 85%.
3. `F` enters/exits fullscreen; strokes work in all four corners.
4. Card docked on board; drawing under it works; `←/→` switches question.
5. Add-question modal → persists after reload → in export JSON.
6. Analyze with `AI_STUB=1`: three different panels for correct / wrong / unclear; with AI
   unconfigured: explanatory sheet + SymPy-only check works.
7. No console errors, no CORS errors, memory < ~350 MB after 5 minutes.

## Output format
Per bug: cause (one sentence + file:line) → change (files + ≤15-line diff) → command run →
observed result. No file dumps, no restating this brief. Stop after Bug 5 and summarize.

---

## Evidence block to append when you send this
```
@FIX-PROMPT.md Fix bugs 1–5 in order. Diagnose each cause before editing.
- frontend: http://localhost:5173   backend: http://127.0.0.1:8765
- GET /api/health -> <paste JSON>
- dev-backend.log (tail) -> <paste 10 lines>
- dev-frontend.log (tail) -> <paste 10 lines>
- annotated screenshot: @screen-1.png
No AI key configured yet — use AI_STUB=1 to prove the flow.
```
