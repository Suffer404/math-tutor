import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveMathCheck } from './useLiveMathCheck';
import type { LiveCheckResult } from '../lib/liveCheck';

function makeResult(overrides: Partial<LiveCheckResult> = {}): LiveCheckResult {
  return {
    steps: [
      { n: 1, latex: 'f(x) = x^3', confidence: 0.9, bbox: null },
      { n: 2, latex: "f'(x) = 3x^2", confidence: 0.9, bbox: null },
    ],
    first_error_step: null,
    error_bbox: null,
    error_explanation: null,
    hint: 'Looks consistent.',
    next_step: null,
    confidence: 0.9,
    needs_user_confirmation: false,
    verification_status: 'sympy-cleared',
    verification_message: 'SymPy checked every step.',
    verification: { checked_transitions: 1, total_transitions: 1, step_status: [] },
    ...overrides,
  };
}

describe('useLiveMathCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits for a pause and restarts the timer while the signature changes', async () => {
    const check = vi.fn(async () => makeResult());
    const { result, rerender } = renderHook(
      ({ signature }: { signature: string }) =>
        useLiveMathCheck({
          enabled: true,
          signature,
          canCheck: true,
          check,
          debounceMs: 100,
          minIntervalMs: 0,
        }),
      { initialProps: { signature: 'a' } },
    );

    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(check).not.toHaveBeenCalled();

    rerender({ signature: 'b' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(check).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45);
    });
    expect(check).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('ok');
    expect(result.current.result?.verification_status).toBe('sympy-cleared');
    expect(result.current.checkedSignature).toBe('b');
  });

  it('never sends the same drawing twice and reuses the cached result', async () => {
    const check = vi.fn(async () => makeResult());
    const { result, rerender } = renderHook(
      ({ signature }: { signature: string }) =>
        useLiveMathCheck({
          enabled: true,
          signature,
          canCheck: true,
          check,
          debounceMs: 20,
          minIntervalMs: 0,
        }),
      { initialProps: { signature: 'one' } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });
    expect(check).toHaveBeenCalledTimes(1);

    rerender({ signature: 'two' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });
    expect(check).toHaveBeenCalledTimes(2);

    // Back to a drawing already checked: answer comes from the cache.
    rerender({ signature: 'one' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });
    expect(check).toHaveBeenCalledTimes(2);
    expect(result.current.checkedSignature).toBe('one');
  });

  it('does nothing automatically when disabled, but an explicit check works once', async () => {
    const check = vi.fn(async () => makeResult({ first_error_step: 2 }));
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useLiveMathCheck({
          enabled,
          signature: 'sig',
          canCheck: true,
          check,
          debounceMs: 20,
          minIntervalMs: 0,
        }),
      { initialProps: { enabled: false } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(check).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('off');

    await act(async () => {
      result.current.checkNow();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(check).toHaveBeenCalledTimes(1);
    expect(result.current.result?.first_error_step).toBe(2);

    // Automatic mode stays off; a new drawing does not trigger a check.
    rerender({ enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed request and does not publish stale results', async () => {
    const check = vi.fn(async () => {
      throw new Error('backend is down');
    });
    const { result } = renderHook(() =>
      useLiveMathCheck({
        enabled: true,
        signature: 'sig',
        canCheck: true,
        check,
        debounceMs: 10,
        minIntervalMs: 0,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15);
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('backend is down');
    expect(result.current.result).toBeNull();
  });

  it('respects the minimum interval between automatic requests', async () => {
    const check = vi.fn(async () => makeResult());
    const { rerender } = renderHook(
      ({ signature }: { signature: string }) =>
        useLiveMathCheck({
          enabled: true,
          signature,
          canCheck: true,
          check,
          debounceMs: 10,
          minIntervalMs: 100,
        }),
      { initialProps: { signature: 'first' } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15);
    });
    expect(check).toHaveBeenCalledTimes(1);

    rerender({ signature: 'second' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(check).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(check).toHaveBeenCalledTimes(2);
  });
});
