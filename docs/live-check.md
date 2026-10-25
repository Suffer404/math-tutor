# Live maths check and laser overlay

The live checker reads handwritten calculus working, verifies the transcribed
chain with SymPy, and points at the first likely mistake with a red overlay.
The overlay is **not part of the Excalidraw scene**: it never edits elements,
never enters undo/redo history and never touches saved board state.

## Flow

```
pen stops (2.6 s)  ──or──  "Check now"
        │
        ▼
exportToBlob(scene, padding 24, max 1400 px)      ← real scene, not one canvas
        │  PNG base64 + scene bounds
        ▼
POST /ai/live-check  ──►  disk/in-memory cache (identical captures are free)
        │                 single-flight (one call per identical image)
        ▼
vision model reads steps (JSON)  ──►  sanitizer (types, ranges, bbox, hint)
        │
        ▼
SymPy verifies each transition  ──►  merge AI + SymPy verdicts
        │
        ▼
overlay maps the error box back to the canvas
```

## When it checks

- Automatic mode is **off by default** and needs an explicit consent dialog.
  It uploads the board only after the pen has been still for ~2.6 s, never on
  every stroke.
- `Check now` always works while an AI provider is configured: pressing the
  button is the upload consent for that one image.
- Identical drawings are skipped in the browser (scene fingerprint) and on the
  backend (image + question + provider hash). Two identical concurrent requests
  share one provider call.
- There is a 4 s floor between automatic requests, and in-flight requests are
  not duplicated.

## Verification statuses

| status | meaning | overlay |
|---|---|---|
| `sympy-confirmed` | SymPy independently proves the flagged transition is wrong | red laser + "SymPy confirmed" |
| `sympy-cleared` | every transcribed transition was checked and none is wrong | no laser; green status |
| `ai-only` | the reader flagged a step, but SymPy cannot decide (integral, notation) | red laser labelled "AI only — not proved" |
| `cannot-verify` | the steps could not be parsed reliably | no laser; amber status |
| `error` | provider/reply failure | no laser; error message |

"SymPy cleared" is a statement about the **transcribed** steps, not a proof
about handwriting the reader misread. The UI labels AI-only flags so they are
never presented as mathematical proof.

## Coordinate mapping

The exported image covers the drawn ink plus 24 px padding. The model returns
`error_bbox` as normalized `[x, y, w, h]` in image coordinates. The overlay maps
that box to scene coordinates, then to pixels with Excalidraw's own formula:

```
overlayX = (sceneX + scrollX) * zoom + offsetLeft - containerRect.left
overlayY = (sceneY + scrollY) * zoom + offsetTop  - containerRect.top
```

The result is recomputed on every `onChange` (pan/zoom), on container resize,
window resize, scroll and fullscreen change. A box that is non-finite, inverted,
degenerate or outside the image is rejected.

If there is no trustworthy box, the fallback is **not** a guessed laser:

1. if the number of recognized steps equals the number of ink lines, the whole
   matching ink line is outlined (labelled "· whole step");
2. otherwise the overlay lists the full step text in a red-outlined block and
   says "Exact position unavailable — showing the whole step".

## Hint and answer policy

- Hints are short (≤240 chars) and the backend strips anything from an explicit
  "the answer is" / "final answer" / "solution:" phrase onwards.
- The prompt tells the model never to give the final answer, only a hint and the
  next operation.
- Hints appear on hover, keyboard focus or touch of the laser target, or of the
  fallback step block. They are keyboard accessible and announced with
  `role="tooltip"` / live status text.
- Red is only used for a flagged mistake. Amber is used for uncertainty.

## Configuration

Backend `.env` (never commit it):

```env
AI_PROVIDER=requesty               # mock | openai | anthropic | requesty | custom
REQUESTY_API_KEY=...               # or OPENAI_API_KEY / ANTHROPIC_API_KEY
REQUESTY_MODEL=openai/gpt-4o-mini  # text model (question generation)
REQUESTY_VISION_MODEL=...          # optional image-capable model for live check
# AI_VISION_MODEL=...              # generic fallback for any provider
```

The model must accept image input. A text-only model will make the live check
fail with an honest provider error (no fabricated maths).

Free / low-cost options:

- **Local, no API key:** Ollama with a vision model (`llava`, `llama3.2-vision`)
  via the AI settings dialog (`http://127.0.0.1:11434/v1`). On an 8 GB laptop,
  use a small quantized vision model; accuracy on messy handwriting is limited.
- **Free-tier cloud:** Google AI Studio's Gemini Flash models have a free tier;
  they can be reached through OpenRouter or a Google OpenAI-compatible endpoint.
  Free quotas and model names change, so confirm before relying on them.
- **Cheap cloud:** `gpt-4o-mini`-class or Claude Haiku-class vision models are
  usually fractions of a cent per board image. Requesty/OpenRouter route both.
- **No budget, no key:** keep the default `mock` provider. Live check honestly
  refuses to run; typed/manual SymPy endpoints continue to work offline.

Dedicated handwritten-maths OCR (Pix2Text, pix2tex/LaTeX-OCR) was not added as a
dependency: it is a large local model and the project rule is to avoid heavy new
dependencies without a benchmark. The existing configurable vision provider is
the supported path; the `AI_VISION_MODEL` switch lets a dedicated OCR endpoint be
used later without touching the UI.

## Tests

```powershell
npm.cmd run test          # geometry, debounce/dedupe hook, overlay, App
npm.cmd run build         # tsc + Vite production build
python -m pytest backend -q
```

Backend live-check tests mock the vision provider and cover: SymPy-confirmed
wrong derivative, SymPy-cleared AI false positive, AI-only unverifiable steps,
bbox rejection, answer stripping, malformed JSON, cache hits, force refresh,
provider errors and the mock-provider guard. Frontend tests cover zoom/pan
mapping, whole-step fallback, consent, hover/focus/touch hints, stale-result
hiding and debounce/caching.
