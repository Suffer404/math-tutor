import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';

// setup.ts mocks the hook for component tests; this suite needs the real one.
vi.unmock('../hooks/useWhiteboard');
import { useWhiteboard } from './useWhiteboard';

function appState(overrides: Partial<AppState> = {}): AppState {
  return {
    zoom: { value: 1 },
    scrollX: 0,
    scrollY: 0,
    offsetLeft: 0,
    offsetTop: 0,
    viewBackgroundColor: '#ffffff',
    currentItemStrokeColor: '#000000',
    currentItemBackgroundColor: 'transparent',
    ...overrides,
  } as AppState;
}

describe('useWhiteboard live viewport', () => {
  it('keeps the same viewport object when onChange reports identical pan/zoom', () => {
    const { result } = renderHook(() =>
      useWhiteboard({ storageKey: 'test-viewport', autoSave: false }),
    );

    act(() => {
      result.current.handleChange([], appState(), {} as BinaryFiles);
    });
    const afterFirst = result.current.liveViewport;

    // Excalidraw can call onChange again for the same state. Publishing a new
    // object here would re-render the board and could loop forever.
    act(() => {
      result.current.handleChange([], appState(), {} as BinaryFiles);
    });
    expect(result.current.liveViewport).toBe(afterFirst);

    act(() => {
      result.current.handleChange(
        [],
        appState({ scrollX: 42, zoom: { value: 1.25 } as unknown as AppState['zoom'] }),
        {} as BinaryFiles,
      );
    });
    expect(result.current.liveViewport).not.toBe(afterFirst);
    expect(result.current.liveViewport.scrollX).toBe(42);
    expect(result.current.liveViewport.zoom).toBe(1.25);
  });
});
