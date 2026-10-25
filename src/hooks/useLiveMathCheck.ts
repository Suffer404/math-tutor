import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveCheckResult } from '../lib/liveCheck';

export type LiveCheckPhase =
  | 'off'
  | 'idle'
  | 'waiting'
  | 'checking'
  | 'ok'
  | 'error';

export interface UseLiveMathCheckOptions {
  /** False until the user explicitly opts in to automatic uploads. */
  enabled: boolean;
  /** Fingerprint of the current drawing; changes whenever ink changes. */
  signature: string;
  /** False while there is no ink or the AI provider is not configured. */
  canCheck: boolean;
  /** Capture + request. Receives an AbortSignal so a disabled checker stops. */
  check: (signal: AbortSignal) => Promise<LiveCheckResult>;
  /** Quiet period after the last pen stroke. */
  debounceMs?: number;
  /** Hard floor between automatic requests, even across different drawings. */
  minIntervalMs?: number;
}

export interface UseLiveMathCheckReturn {
  result: LiveCheckResult | null;
  phase: LiveCheckPhase;
  error: string | null;
  /** Signature the visible result belongs to (guards against stale lasers). */
  checkedSignature: string | null;
  checkNow: () => void;
  dismiss: () => void;
}

interface InFlight {
  signature: string;
  controller: AbortController;
  promise: Promise<void>;
}

/**
 * Debounced, deduplicated live checker.
 *
 * - waits for a pause instead of reacting to every pen movement;
 * - skips a signature that already produced a result;
 * - keeps a small in-memory cache and never runs two requests for the same ink;
 * - only publishes a result if the drawing has not changed since it started.
 */
export function useLiveMathCheck(options: UseLiveMathCheckOptions): UseLiveMathCheckReturn {
  const {
    enabled,
    signature,
    canCheck,
    check,
    debounceMs = 2600,
    minIntervalMs = 4000,
  } = options;

  const [result, setResult] = useState<LiveCheckResult | null>(null);
  const [phase, setPhase] = useState<LiveCheckPhase>(enabled ? 'idle' : 'off');
  const [error, setError] = useState<string | null>(null);
  const [checkedSignature, setCheckedSignature] = useState<string | null>(null);

  const checkRef = useRef(check);
  const signatureRef = useRef(signature);
  const enabledRef = useRef(enabled);
  const canCheckRef = useRef(canCheck);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<InFlight | null>(null);
  const lastRequestAtRef = useRef(0);
  const lastSuccessRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, LiveCheckResult>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    checkRef.current = check;
    signatureRef.current = signature;
    enabledRef.current = enabled;
    canCheckRef.current = canCheck;
  }, [check, signature, enabled, canCheck]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      inFlightRef.current?.controller.abort();
      inFlightRef.current = null;
    };
  }, []);

  const publish = useCallback((sig: string, value: LiveCheckResult) => {
    cacheRef.current.set(sig, value);
    if (cacheRef.current.size > 24) {
      const oldest = cacheRef.current.keys().next().value;
      if (oldest) cacheRef.current.delete(oldest);
    }
    lastSuccessRef.current = sig;
    if (signatureRef.current !== sig || !mountedRef.current) return;
    setResult(value);
    setCheckedSignature(sig);
    setPhase('ok');
    setError(null);
  }, []);

  const run = useCallback(
    async (sig: string, force: boolean, manual = false): Promise<void> => {
      if (!sig || !canCheckRef.current) return;
      if (!manual && !enabledRef.current) return;

      const existing = inFlightRef.current;
      if (existing) {
        if (existing.signature === sig) return existing.promise;
        // Let the older request settle; aborting it now would not refund the
        // API call, and a second parallel call is exactly what we avoid.
        await existing.promise.catch(() => undefined);
        if (signatureRef.current !== sig) return;
      }

      if (!force) {
        const cached = cacheRef.current.get(sig);
        if (cached) {
          publish(sig, cached);
          return;
        }
        if (lastSuccessRef.current === sig) {
          setPhase('ok');
          return;
        }
      }

      if (!mountedRef.current) return;
      const controller = new AbortController();
      lastRequestAtRef.current = Date.now();
      setPhase('checking');
      setError(null);

      const promise = checkRef
        .current(controller.signal)
        .then((value) => {
          publish(sig, value);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          if (signatureRef.current !== sig || !mountedRef.current) return;
          const message =
            cause instanceof Error ? cause.message : 'Live check failed.';
          setPhase('error');
          setError(message);
        })
        .finally(() => {
          if (inFlightRef.current?.controller === controller) {
            inFlightRef.current = null;
          }
        });

      inFlightRef.current = { signature: sig, controller, promise };
      await promise;
    },
    [publish],
  );

  // Debounce automatic checks after the drawing stops changing.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!enabled) {
      inFlightRef.current?.controller.abort();
      inFlightRef.current = null;
      setPhase('off');
      return;
    }
    if (!canCheck || !signature) {
      setPhase('idle');
      return;
    }
    if (lastSuccessRef.current === signature) {
      setPhase('ok');
      return;
    }

    const cached = cacheRef.current.get(signature);
    if (cached) {
      publish(signature, cached);
      return;
    }

    setPhase('waiting');
    const elapsed = Date.now() - lastRequestAtRef.current;
    const delay = Math.max(debounceMs, minIntervalMs - elapsed, 0);

    const attempt = () => {
      if (!enabledRef.current) return;
      if (inFlightRef.current) {
        timerRef.current = setTimeout(attempt, 700);
        return;
      }
      void run(signatureRef.current, false);
    };

    timerRef.current = setTimeout(attempt, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, signature, canCheck, debounceMs, minIntervalMs, publish, run]);

  const checkNow = useCallback(() => {
    // An explicit button press is its own consent: it works even when
    // automatic live checks are switched off.
    if (!canCheckRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void run(signatureRef.current, true, true);
  }, [run]);

  const dismiss = useCallback(() => {
    setResult(null);
    setCheckedSignature(null);
    setPhase((current) => (current === 'checking' ? current : 'idle'));
  }, []);

  return { result, phase, error, checkedSignature, checkNow, dismiss };
}
