# Known Limitations

## Core Functionality

### Mathematical Verification
- **SymPy Coverage**: Supports calculus (diff, integrate, limits, solve), algebra (simplify, equivalence), and basic trigonometry. Does not support: differential equations, series expansions, vector calculus, linear algebra, complex analysis.
- **Equivalence Checking**: Uses multiple methods (direct, simplify, numerical sampling). May report "equivalent: false" for mathematically equivalent expressions that differ in form (e.g., `sin(x)^2 + cos(x)^2` vs `1` without simplification).
- **Unverified Results**: When SymPy cannot parse or verify, returns `unsupported: true` with `confidence: 0`. This is intentional - AI opinion ≠ mathematical proof.
- **Step Verification**: Checks derivative transitions and same-left-hand-side algebraic equivalence. Other derivation operations (integration, substitution, limits) remain unverified and are never claimed wrong by SymPy.

### Handwriting Recognition
- **Vision Provider Required**: Live detection needs an image-capable AI provider configured in `.env` or AI settings. The mock provider is refused by `/ai/live-check` so no fabricated maths is shown.
- **Canvas Capture**: Uses `exportToBlob` on the Excalidraw scene (not a single `<canvas>`), so UI chrome is excluded; the board is downscaled to max 1400 px and sent as PNG.
- **No On-Device OCR**: No local handwriting model is bundled. Ollama with a small vision model is the zero-cost local option, with lower accuracy.
- **Symbol-Level Location**: Boxes come from a general vision model, not a handwriting OCR model. A rejected or absent box falls back to the whole ink line, then to the whole step text; never a guessed symbol.
- **Single Image**: Analyzes the complete working at once, not stroke-by-stroke. Automatic checks wait ~2.6 s after the pen stops.
- **Step Verification Scope**: SymPy proves derivative transitions and same-left-hand-side equivalences. Integrals, unusual notation and unparsable handwriting are labelled `unverified` / `ai-only`, never `sympy-confirmed`.

### Question Bank
- **Schema v1.0 Only**: No migration path for schema changes yet.
- **No Rich Text**: Question text is plain text with optional LaTeX field.
- **No Versioning**: Questions are replaced on import (INSERT OR REPLACE).
- **Single Source**: Source reference is a single filename/page/section.

## Technical Limitations

### Frontend
- **Bundle Size**: ~2.8MB JS (gzipped: ~830KB). Dominated by Excalidraw and KaTeX fonts.
- **No Code Splitting**: All views loaded upfront (HandwritingCheck, Dashboard).
- **localStorage Only**: Whiteboard state not synced to backend.
- **No Offline Queue**: Failed API requests not retried automatically.
- **Single Tab**: No multi-tab synchronization.

### Backend
- **SQLite Concurrency**: Single writer, multiple readers. Not suitable for concurrent users.
- **No Auth**: No authentication/authorization (local-only design).
- **No Rate Limiting**: API endpoints unprotected.
- **Sync AI Calls**: AI provider calls block request thread (use async in production).
- **In-Memory Cache**: AI response cache not persisted across restarts (uses file cache).

### AI Integration
- **Mock Provider Default**: Requires API keys for real AI features.
- **No Streaming**: AI responses returned complete, not streamed.
- **Fixed Prompts**: Handwriting analysis prompt not customizable.
- **No Fine-Tuning**: Uses base models only.

### Tauri/Packaging (Phase 8 - Not Yet Implemented)
- **No Sidecar Bundling**: Python backend not bundled as sidecar.
- **No Installer**: No NSIS/MSI installer created.
- **No Auto-Updater**: No update mechanism.
- **Platform Paths**: Data paths hardcoded for development.

## Platform Limitations

### Windows-Specific
- **PowerShell Only**: Scripts use PowerShell (`npm.cmd`, `python`).
- **Path Separators**: Backslashes in file paths.
- **AppData Location**: `%APPDATA%\math-tutor\` for production data.

### Hardware Requirements
- **RAM**: 8GB minimum (4GB for app + 4GB for OS). AI features need more.
- **GPU**: Not required. No CUDA/Metal acceleration.
- **Pen Tablet**: Supported but not required (mouse works).
- **Disk**: ~500MB for node_modules, ~2GB for Python deps, ~100MB for app.

## Security Limitations

### Current State
- **No TLS**: HTTP only (localhost).
- **No Input Sanitization Beyond Schema**: JSON schema validation only.
- **CORS Wildcard**: `allow_origins=["*"]` in development.
- **No Secrets Management**: API keys in `.env` file.
- **No Audit Logging**: No request/response logging.

### Mitigations
- Backend binds to 127.0.0.1 only
- No external network access required
- AI features require explicit user action
- No telemetry or analytics

## Data Integrity

### Backup/Restore
- **Manual Process**: No automated backup in app.
- **No Point-in-Time Recovery**: Only full database restore.
- **Whiteboard State**: localStorage only, not in database.

### Migration
- **No Migration Framework**: Schema changes require manual SQL.
- **No Downgrade Path**: Forward migrations only.

## Accessibility
- **Keyboard Navigation**: Basic support only.
- **Screen Readers**: Not tested with NVDA/JAWS.
- **High Contrast**: Not optimized.
- **Font Scaling**: Respects system settings partially.

## Internationalization
- **English Only**: No i18n framework.
- **Number Formats**: Assumes US/UK (dot decimal).
- **Date Formats**: ISO 8601 in API, locale in UI.

## Testing Gaps
- **No E2E Tests**: No Playwright/Cypress tests.
- **No Integration Tests**: Frontend-backend integration not tested.
- **No Load Testing**: Single-user only.
- **Mock AI Only**: Backend live-check tests and frontend overlay tests use mocked AI responses. Real provider accuracy, quota behaviour and latency were not exercised (no paid calls made).
- **No Real-Handwriting Benchmark**: Recognition accuracy on the pen tablet was not benchmarked against a labelled sample.

## Future Work (Post-Phase 8)

### High Priority
1. Tauri packaging with sidecar
2. Automated backup/restore in UI
3. Real handwriting OCR (on-device or API)
4. Question versioning and migration
5. Rate limiting and auth for multi-user

### Medium Priority
1. Code splitting and lazy loading
2. Offline queue for failed requests
3. Multi-tab sync via BroadcastChannel
4. Accessibility improvements
5. i18n framework

### Low Priority
1. Differential equation support in SymPy
2. Vector calculus support
3. Collaborative editing (WebRTC)
4. Plugin system for custom question types
5. Mobile companion app