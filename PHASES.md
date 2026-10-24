# PHASES.md — one-line kickoffs

Start a session, then send **one** line. Reuse `AGENTS.md` as the standing brief so the
constraints are never re-pasted.

| Phase | Kickoff line |
|-------|--------------|
| 0 | `Phase 0 only: inspect env, git, tools, disk; write docs/plan.md + LICENCES.md; change nothing else.` |
| 1 | `Phase 1 only: Vite+React+TS whiteboard MVP with Excalidraw, pen+mouse, saved board state, prev/next sample questions; tests; stop.` |
| 2 | `Phase 2 only: SQLite+migrations, schema validation, import/export, filters, attempts; sample bank works; malformed file rejected.` |
| 3 | `Phase 3 only: FastAPI+SymPy service with whitelist parser, diff/simplify/equivalence/solve, honest unverified cases; tests.` |
| 4 | `Phase 4 only: Marker docs (separate venv, optional) + markdown-to-bank CLI with grounding and pending status; sample outputs.` |
| 5 | `Phase 5 only: one configurable AI provider, grounded question generation, dedupe, cache, quota/timeout handling; no invented citations.` |
| 6 | `Phase 6 only: handwriting check flow (capture → structured JSON → user fix → SymPy cross-check → 3-level hints); test correct/wrong/unclear.` |
| 7 | `Phase 7 only: dashboard — weak topics, error log, bookmarks, revision queue, mixed practice, backup/restore.` |
| 8 | `Phase 8 only: Tauri packaging, backend lifecycle, data paths, installer; verify packaged app end-to-end.` |

## Why this stays cheap

- `AGENTS.md` is the only always-loaded context (~1 page instead of ~5).
- Each kickoff names **one** phase + its gate, so the agent never re-plans or re-reads the spec.
- Gates are testable, so "continue until it works" cannot drift into scope creep.
- If a phase overruns, send: `Continue phase N from <last file>; no new scope.`
