# Math Tutor V2 — Feature Plan

## Overview
Math Tutor V2 builds on the stable V1 foundation (tagged `v1.0.0`) with enhanced AI capabilities, advanced math tools, and improved learning features. Recommended order: Fix V1 → AI recognition and mistake highlighting → step checking and hints → question generation → progress and revision → advanced tools.

## V2 Feature List

### Phase 1: Fix & Stabilize V1
- [ ] Verify all V1 features work end-to-end
- [ ] Fix any remaining bugs from V1
- [ ] Update documentation and known limitations
- [ ] Create V2 development branch

### Phase 2: AI Recognition & Mistake Highlighting
- [ ] **2.1 AI Mistake Detection** — Identify incorrect mathematical steps in handwritten solutions
  - Backend: `/ai/mistake-detect` endpoint
  - Frontend: Display detected mistakes with confidence scores
- [ ] **2.2 AI Laser Pointer** — Highlight exact errors with red circle/outline
  - CSS overlay with animated laser target
  - Pointer-events passthrough for drawing
  - Approximate region highlighting for unclear areas
- [ ] **2.3 Instant Hints** — Explain mistakes without revealing final answer
  - Progressive hint system (concept → rule → next operation)
  - SymPy-backed verification before showing hints

### Phase 3: Step Checking & Hints
- [ ] **3.1 Handwriting Recognition** — Convert handwritten math to editable equations
  - Integrate OCR/vision model for math recognition
  - User correction dialog for recognized steps
  - Confidence scoring per step
- [ ] **3.2 Check My Step** — Verify each step using SymPy
  - Step-by-step equivalence checking
  - Chain rule, product rule, integration by parts support
  - Honest "cannot verify" for ambiguous cases
- [ ] **3.3 Progressive Hints** — Rule → error clue → next step → optional solution
  - 4-level hint escalation
  - Full solution only on explicit request
  - Track hint usage for weakness analysis

### Phase 4: Question Generation
- [ ] **4.1 PDF Question Import** — Extract questions from textbooks and lecture notes
  - Marker integration (separate venv)
  - Markdown → question bank CLI
  - Grounding verification (no invented citations)
- [ ] **4.2 AI Question Generation** — Create practice questions from supplied sources
  - Configurable AI provider (OpenAI/Anthropic/Requesty)
  - Deduplication and caching
  - Difficulty calibration
- [ ] **4.3 Bulk Add Questions** — Add multiple questions at once
  - Paste text parser (topic, difficulty, Q/A/H/S format)
  - JSON import support
  - Validation against schema

### Phase 5: Progress & Revision
- [ ] **5.1 Weakness Tracking** — Identify recurring mistakes and weak topics
  - Per-topic accuracy tracking
  - Error pattern recognition
  - Weak topic dashboard
- [ ] **5.2 Revision System** — Schedule practice based on previous errors
  - Spaced repetition algorithm
  - Revision queue based on mistake frequency
  - Mixed practice mode
- [ ] **5.3 Error Notebook** — Save mistakes, corrections, and memory tricks
  - Persistent error log
  - User-added corrections and notes
  - Memory trick suggestions
- [ ] **5.4 Progress Dashboard** — Real accuracy, study time, topic progress
  - Study time tracking
  - Accuracy trends
  - Topic mastery indicators

### Phase 6: Advanced Tools
- [ ] **6.1 Graphing Tools** — Plot functions, derivatives, and integrals
  - Function plotting with KaTeX/MathJS
  - Derivative/integral visualization
  - Interactive zoom/pan
- [ ] **6.2 Session History** — Autosave, restore, replay, compare solutions
  - Session recording and playback
  - Solution comparison view
  - Export/import sessions
- [ ] **6.3 Export & Backup** — Save work as PDF/PNG and restore data
  - PDF/PNG export of whiteboard
  - Full data backup/restore
  - Cross-device sync (optional)
- [ ] **6.4 AI Health Monitor** — Show API, OCR, backend, and SymPy status
  - Real-time health dashboard
  - Provider status indicators
  - Error rate monitoring

### Phase 7: Optimization & Testing
- [ ] **7.1 Low-Cost AI** — Caching, fewer API calls, optional local processing
  - Aggressive response caching
  - Batch API calls
  - Local OCR fallback
- [ ] **7.2 Offline-First Mode** — Keep drawing and supported math checks working without AI
  - SymPy verification works offline
  - Drawing and history work offline
  - Graceful degradation for AI features
- [ ] **7.3 Automated Tests** — Verify backend, AI failures, math checks, data safety
  - Backend API tests
  - SymPy verification tests
  - AI provider failure tests
  - Frontend integration tests

## Technical Architecture V2

### New Components
- `LiveMathOverlay` — Real-time math error detection overlay
- `FeedbackCorner` — Laser pointer and feedback UI
- `BulkAddModal` — Multi-question import
- `AiSettingsModal` — AI provider configuration

### New Hooks
- `useLiveMathCheck` — Live math checking with SymPy
- `useWhiteboard` — Enhanced whiteboard state management

### New Libraries
- `lib/attempts.ts` — Attempt recording
- `lib/captureScene.ts` — Canvas capture for AI
- `lib/liveCheck.ts` — Live math checking logic
- `lib/parseQuestions.ts` — Question parsing
- `lib/sceneCoords.ts` — Scene coordinate handling

### Backend Enhancements
- `/health` — Enhanced health monitoring
- `/ai/handwriting-check` — Improved with live detection
- `/live-check` — New endpoint for real-time math checking
- `/questions/import` — Enhanced with better validation

## Recommended Order
1. Fix V1 → AI recognition and mistake highlighting
2. Step checking and hints
3. Question generation
4. Progress and revision
5. Advanced tools

## V2 Branch Strategy
- Create `v2` branch from `v1.0.0` tag
- Feature branches: `feat/v2-*`
- Merge to `v2` when complete
- Tag `v2.0.0` when all phases complete