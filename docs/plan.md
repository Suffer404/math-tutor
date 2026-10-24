# Math Tutor - Implementation Plan

## Overview
A local-first Windows desktop app for practising university calculus / engineering mathematics by handwriting solutions. Uses AI for hints + first-error detection, SymPy for mathematical verification, and Excalidraw for the drawing board.

## Machine Environment
- **OS**: Windows 11
- **CPU**: Intel Core i5-1135G7
- **RAM**: 8 GB
- **GPU**: NVIDIA MX330 2 GB
- **Input**: Pen tablet + mouse
- **Shell**: PowerShell (`npm.cmd` / `npx.cmd`)
- **Tools Available**: Node v26.12.0, Python 3.11.9, Git 2.55.0
- **Missing Tools**: Rust / Cargo (Required for Phase 8 Tauri packaging)

## Project Phases

### Phase 0: Setup & Planning (Current)
- Inspect environment, git, node/python/rust, disk space.
- Draft initial `LICENCES.md` and `docs/plan.md`.

### Phase 1: Vite + React + TS Whiteboard MVP
- Setup Vite app with React, TS, and Tailwind/CSS.
- Embed `@excalidraw/excalidraw`.
- Support pen + mouse input.
- Save and restore board state.
- Include prev/next controls for sample questions.
- **Gate**: Draws with tablet/mouse; survives restart.

### Phase 2: SQLite Bank & Storage
- Setup SQLite database + migration system.
- Implement JSON schema validation for `question.schema.json`.
- Build question import/export, filters, and attempt tracking.
- **Gate**: Sample bank imports, malformed file rejected, data persists.

### Phase 3: SymPy Verification Service
- Build FastAPI service with safe SymPy parsing.
- Whitelist parser for diff, simplify, equivalence, solve, limits.
- Handle unsupported cases with "unverified" status.
- **Gate**: SymPy correctly verifies valid cases, safely rejects ambiguous ones.

### Phase 4: Document Import (Marker)
- Set up CLI script / workflow for Marker (separate venv).
- Convert Markdown -> grounded question bank with `pending` verification status.
- **Gate**: Sample Markdown yields importable, grounded bank.

### Phase 5: AI Provider Integration
- Integrate one configurable AI provider (vision + text).
- Support grounded question generation, deduplication, caching, quota errors.
- **Gate**: Generates valid question objects without fake citations.

### Phase 6: Handwriting Check & Progressive Hints
- Capture canvas -> structured JSON schema -> user fix UI.
- SymPy cross-check -> progressive 3-level hints (concept -> rule -> step).
- **Gate**: Correct, wrong step, and unclear image yield 3 distinct results.

### Phase 7: Dashboard & Weak Topics
- Build dashboard: weak topics, error log, bookmarks, revision queue.
- Implement backup & restore for DB + board state.
- **Gate**: Revision queue reflects real error history.

### Phase 8: Tauri Packaging
- Integrate Tauri wrapper around Vite build + FastAPI sidecar/process.
- Implement application lifecycle, local data paths, installer.
- **Gate**: Standalone Windows executable/installer runs offline and saves data.
