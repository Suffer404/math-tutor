import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types/types';
import { captureScene, type CapturedScene } from '../lib/captureScene';
import {
  DEFAULT_VIEWPORT,
  computeInkBounds,
  groupInkLines,
  resolveStepRegion,
  sceneRectToContainer,
  type ContainerRect,
  type ViewportTransform,
} from '../lib/sceneCoords';
import {
  requestLiveCheck,
  sceneSignature,
  type LiveCheckResult,
} from '../lib/liveCheck';
import { useLiveMathCheck, type LiveCheckPhase } from '../hooks/useLiveMathCheck';

export interface LiveMathOverlayProps {
  elements: readonly ExcalidrawElement[];
  files?: BinaryFiles | null;
  view?: ViewportTransform;
  containerRef: React.RefObject<HTMLDivElement>;
  questionId: string;
  questionText?: string;
  /** null while /health is loading, false when only the mock provider exists. */
  aiConfigured: boolean | null;
  providerLabel?: string;
  capture?: (
    elements: readonly ExcalidrawElement[],
    files: BinaryFiles | null | undefined,
  ) => Promise<CapturedScene | null>;
  onResult?: (result: LiveCheckResult | null) => void;
}

const EMPTY_CONTAINER: ContainerRect = { left: 0, top: 0, width: 0, height: 0 };

function liveElementsOf(elements: readonly ExcalidrawElement[]): readonly ExcalidrawElement[] {
  return elements.filter((element) => !element.isDeleted);
}

function statusText(
  phase: LiveCheckPhase,
  aiConfigured: boolean | null,
  result: LiveCheckResult | null,
): string {
  if (aiConfigured === false) return 'AI offline — add a key in AI settings';
  if (aiConfigured === null) return 'Checking the AI connection…';
  if (phase === 'checking') return 'Reading your working…';
  if (phase === 'error') return 'Check failed';
  if (phase === 'waiting') return 'Watching for a pause…';
  if (result) {
    if (result.first_error_step) {
      return result.verification_status === 'sympy-confirmed'
        ? `Mistake found at step ${result.first_error_step}`
        : `Possible mistake at step ${result.first_error_step}`;
    }
    if (result.verification_status === 'sympy-cleared') return 'No error found — SymPy checked the steps';
    if (result.verification_status === 'cannot-verify') return 'Could not verify these steps';
    if (result.verification_status === 'error') return 'The model reply could not be read';
    return 'No mistake detected';
  }
  return 'Draw, pause, and I will check';
}

function verificationLabel(result: LiveCheckResult): string {
  switch (result.verification_status) {
    case 'sympy-confirmed':
      return 'SymPy confirmed';
    case 'sympy-cleared':
      return 'SymPy checked';
    case 'ai-only':
      return 'AI only — not proved';
    case 'cannot-verify':
      return 'Cannot verify';
    case 'error':
      return 'Unreadable reply';
    default:
      return 'Reading';
  }
}

export const LiveMathOverlay: React.FC<LiveMathOverlayProps> = ({
  elements,
  files,
  view = DEFAULT_VIEWPORT,
  containerRef,
  questionId,
  questionText,
  aiConfigured,
  providerLabel,
  capture,
  onResult,
}) => {
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintPinned, setHintPinned] = useState(false);
  const [containerRect, setContainerRect] = useState<ContainerRect>(EMPTY_CONTAINER);
  const [sceneBounds, setSceneBounds] = useState<ReturnType<typeof computeInkBounds>>(null);
  const elementsRef = useRef(elements);
  const filesRef = useRef(files);
  const captureRef = useRef(capture || captureScene);

  elementsRef.current = elements;
  filesRef.current = files;
  captureRef.current = capture || captureScene;

  const signature = useMemo(() => sceneSignature(elements), [elements]);
  const hasInk = useMemo(() => liveElementsOf(elements).length > 0, [elements]);
  const canCheck = hasInk && aiConfigured === true;

  // Keep the mapping in sync with container size, window resize, fullscreen
  // and the parent scrolling.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setContainerRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    update();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(element);
    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [containerRef]);

  const runCheck = useCallback(
    async (signal: AbortSignal): Promise<LiveCheckResult> => {
      if (aiConfigured !== true) {
        throw new Error('AI is not configured. Add an API key in AI settings first.');
      }
      const captured = await captureRef.current(elementsRef.current, filesRef.current);
      if (!captured) {
        throw new Error('There is nothing to check yet. Draw a step first.');
      }
      setSceneBounds(captured.sceneBounds);
      return requestLiveCheck({
        imageBase64: captured.imageBase64,
        questionId,
        questionText,
        signal,
      });
    },
    [aiConfigured, questionId, questionText],
  );

  const { result, phase, error, checkedSignature, checkNow, dismiss } =
    useLiveMathCheck({ enabled: liveEnabled, signature, canCheck, check: runCheck });

  useEffect(() => {
    onResult?.(result);
  }, [result, onResult]);

  // A new drawing invalidates the open tooltip as well as the laser.
  useEffect(() => {
    setHintOpen(false);
    setHintPinned(false);
  }, [signature]);

  const visibleResult = result && checkedSignature === signature ? result : null;
  const errorStep = visibleResult?.first_error_step ?? null;
  const errorStepData =
    errorStep && visibleResult ? visibleResult.steps[errorStep - 1] : null;

  const lines = useMemo(() => groupInkLines(liveElementsOf(elements)), [elements]);
  const inkBounds = useMemo(() => computeInkBounds(liveElementsOf(elements)), [elements]);

  const region = useMemo(() => {
    if (!visibleResult || !errorStep || !visibleResult.steps.length) return null;
    return resolveStepRegion({
      aiBox: visibleResult.error_bbox,
      stepIndex: errorStep - 1,
      stepCount: visibleResult.steps.length,
      sceneBounds: sceneBounds || inkBounds,
      lines,
    });
  }, [visibleResult, errorStep, sceneBounds, inkBounds, lines]);

  const regionRect = region
    ? sceneRectToContainer(region.sceneRect, view, containerRect)
    : null;
  const regionVisible =
    !!regionRect &&
    regionRect.x + regionRect.width > 0 &&
    regionRect.y + regionRect.height > 0 &&
    regionRect.x < containerRect.width + 24 &&
    regionRect.y < containerRect.height + 24;

  const hintPosition = useMemo(() => {
    const width = 310;
    const maxLeft = Math.max(containerRect.width - width - 12, 12);
    const anchor = regionVisible && regionRect
      ? regionRect
      : { x: 12, y: containerRect.height - 190, width: 0, height: 0 };
    const left = Math.min(Math.max(anchor.x, 12), maxLeft);
    const below = anchor.y + anchor.height + 10;
    const top = below + 170 > containerRect.height ? Math.max(anchor.y - 180, 12) : below;
    return { left, top };
  }, [containerRect, regionRect, regionVisible]);

  const handleToggle = () => {
    if (liveEnabled) {
      setLiveEnabled(false);
      setHintOpen(false);
      return;
    }
    if (aiConfigured !== true) return;
    setShowConsent(true);
  };

  const confirmEnable = () => {
    setShowConsent(false);
    setLiveEnabled(true);
  };

  const openHint = () => setHintOpen(true);
  const closeHint = () => {
    if (!hintPinned) setHintOpen(false);
  };

  const showHintCard =
    hintOpen && !!visibleResult && (errorStep !== null || visibleResult.verification_status !== 'sympy-cleared');

  return (
    <>
      <div className="live-check-controls" data-testid="live-check-controls">
        <div className="live-check-controls__row">
          <button
            type="button"
            className={`live-pill ${liveEnabled ? 'live-pill--on' : ''}`}
            aria-pressed={liveEnabled}
            aria-label={liveEnabled ? 'Turn off automatic live check' : 'Turn on automatic live check'}
            onClick={handleToggle}
            disabled={aiConfigured !== true}
            title={
              aiConfigured === true
                ? 'Automatically check after you stop drawing'
                : 'Configure an AI provider first'
            }
          >
            <span className="live-pill__dot" aria-hidden="true" />
            Live check {liveEnabled ? 'on' : 'off'}
          </button>

          <button
            type="button"
            className="btn btn--primary live-check-controls__button"
            onClick={checkNow}
            disabled={!canCheck || phase === 'checking'}
            title="Capture this board once and check it now"
          >
            {phase === 'checking' ? 'Checking…' : 'Check now'}
          </button>

          {visibleResult && (
            <button
              type="button"
              className="btn btn--ghost live-check-controls__dismiss"
              onClick={dismiss}
              aria-label="Dismiss live feedback"
              title="Dismiss feedback"
            >
              ×
            </button>
          )}
        </div>

        <div className="live-check-controls__status" role="status" aria-live="polite">
          <span
            className={`live-status live-status--${
              error ? 'error' : phase
            }`}
            data-testid="live-check-status"
          >
            {statusText(phase, aiConfigured, visibleResult)}
          </span>
          {visibleResult?.cached && (
            <span className="live-check-controls__meta">cached result — no new API call</span>
          )}
          {visibleResult?.verification_status === 'ai-only' && (
            <span className="live-check-controls__meta">AI hint only; SymPy could not prove it.</span>
          )}
          {error && (
            <span className="live-check-controls__error" role="alert">
              {error}
            </span>
          )}
        </div>
      </div>

      <div className="laser-layer" data-testid="laser-layer" aria-hidden={!visibleResult}>
        {visibleResult && errorStep !== null && regionRect && regionVisible && (
          <button
            type="button"
            className={`laser-target ${region?.precision === 'step' ? 'laser-target--approx' : ''}`}
            data-testid="laser-region"
            style={{
              left: regionRect.x,
              top: regionRect.y,
              width: Math.max(regionRect.width, 24),
              height: Math.max(regionRect.height, 18),
            }}
            aria-label={`Step ${errorStep} flagged. Show hint.`}
            aria-describedby="live-laser-hint"
            onPointerEnter={openHint}
            onPointerLeave={closeHint}
            onFocus={openHint}
            onBlur={closeHint}
            onTouchStart={(event) => {
              event.preventDefault();
              setHintPinned((pinned) => !pinned);
              setHintOpen((open) => !open);
            }}
            onClick={() => {
              setHintPinned((pinned) => !pinned);
              setHintOpen(true);
            }}
          >
            <span className="laser-corner laser-corner--tl" />
            <span className="laser-corner laser-corner--tr" />
            <span className="laser-corner laser-corner--bl" />
            <span className="laser-corner laser-corner--br" />
            <span className="laser-scan" aria-hidden="true" />
            <span className="laser-dot" aria-hidden="true" />
            <span className="laser-label">
              Step {errorStep}
              {region?.precision === 'step' ? ' · whole step' : ''}
            </span>
          </button>
        )}

        {visibleResult &&
          errorStep !== null &&
          errorStepData &&
          (!regionRect || !regionVisible) && (
            <div className="live-fallback" data-testid="live-fallback">
              <span className="live-fallback__title">
                Exact position unavailable — showing the whole step
              </span>
              <button
                type="button"
                className="live-fallback__step"
                onClick={() => setHintOpen(true)}
                onFocus={openHint}
                onPointerEnter={openHint}
                onTouchStart={(event) => {
                  event.preventDefault();
                  setHintOpen(true);
                }}
                aria-describedby="live-laser-hint"
              >
                {errorStepData.latex}
              </button>
            </div>
          )}

        {showHintCard && visibleResult && (
          <div
            className="laser-hint"
            id="live-laser-hint"
            role="tooltip"
            data-testid="laser-hint"
            style={hintPosition}
            onPointerEnter={openHint}
            onFocus={openHint}
          >
            <div className="laser-hint__head">
              <span
                className={`laser-hint__badge laser-hint__badge--${visibleResult.verification_status}`}
              >
                {verificationLabel(visibleResult)}
              </span>
              {errorStep !== null && <strong>Step {errorStep}</strong>}
            </div>
            {visibleResult.error_explanation && (
              <p className="laser-hint__explanation">{visibleResult.error_explanation}</p>
            )}
            <p className="laser-hint__hint">
              <strong>Hint:</strong> {visibleResult.hint}
            </p>
            {visibleResult.next_step && (
              <p className="laser-hint__next">Next: {visibleResult.next_step}</p>
            )}
            <p className="laser-hint__meta">
              Hint only — the final answer is never shown automatically.
            </p>
            <div className="laser-hint__actions">
              {hintPinned && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setHintPinned(false);
                    setHintOpen(false);
                  }}
                >
                  Close
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setHintOpen(false);
                  setHintPinned(false);
                }}
                aria-label="Hide hint"
              >
                Hide
              </button>
            </div>
          </div>
        )}
      </div>

      {showConsent && (
        <div
          className="live-consent"
          role="dialog"
          aria-modal="false"
          aria-labelledby="live-consent-title"
          data-testid="live-consent"
        >
          <h4 id="live-consent-title">Enable automatic live check?</h4>
          <p>
            After you stop drawing for about 2.6 seconds, this board is exported and
            sent to the AI provider configured in the backend
            {providerLabel ? ` (${providerLabel})` : ''} for reading. SymPy verifies
            the steps locally. Only hints are returned — never the final answer.
          </p>
          <p className="live-consent__note">
            Nothing is uploaded while this is off. “Check now” always sends the board
            once, only when you press it.
          </p>
          <div className="live-consent__actions">
            <button type="button" className="btn btn--primary" onClick={confirmEnable}>
              Enable live check
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowConsent(false)}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveMathOverlay;
