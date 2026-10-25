import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import { LiveMathOverlay } from './LiveMathOverlay';
import { requestLiveCheck, type LiveCheckResult } from '../lib/liveCheck';
import type { CapturedScene } from '../lib/captureScene';

vi.mock('../lib/liveCheck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/liveCheck')>();
  return {
    ...actual,
    requestLiveCheck: vi.fn(),
  };
});

const mockedRequest = vi.mocked(requestLiveCheck);

function elements(): readonly ExcalidrawElement[] {
  return [
    { id: 'a', version: 1, type: 'freedraw', x: 20, y: 40, width: 120, height: 30 },
    { id: 'b', version: 1, type: 'freedraw', x: 20, y: 100, width: 120, height: 30 },
  ] as unknown as readonly ExcalidrawElement[];
}

function result(overrides: Partial<LiveCheckResult> = {}): LiveCheckResult {
  return {
    steps: [
      { n: 1, latex: 'f(x) = x^3', confidence: 0.9, bbox: null },
      { n: 2, latex: "f'(x) = 3x^2 + 4", confidence: 0.9, bbox: null },
    ],
    first_error_step: 2,
    error_bbox: { x: 0.2, y: 0.35, width: 0.4, height: 0.1 },
    error_explanation: 'The derivative of -4x should be -4.',
    hint: 'Differentiate the linear term again.',
    next_step: 'Differentiate each term separately.',
    confidence: 0.85,
    needs_user_confirmation: false,
    verification_status: 'sympy-confirmed',
    verification_message: 'SymPy confirms the first incorrect step.',
    verification: { checked_transitions: 1, total_transitions: 1, step_status: [] },
    ...overrides,
  };
}

const captured: CapturedScene = {
  imageBase64: 'ZmFrZQ==',
  sceneBounds: { x: 0, y: 0, width: 400, height: 300 },
};

function setup(ui: Partial<React.ComponentProps<typeof LiveMathOverlay>> = {}) {
  const ref = React.createRef<HTMLDivElement>();
  const capture = vi.fn(async () => captured);
  const onResult = vi.fn();
  const view = {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    offsetLeft: 0,
    offsetTop: 0,
  };
  const rendered = render(
    <div ref={ref} style={{ width: 800, height: 600 }}>
      <LiveMathOverlay
        elements={elements()}
        view={view}
        containerRef={ref}
        questionId="q1"
        questionText="Differentiate f(x)"
        aiConfigured
        capture={capture}
        onResult={onResult}
        {...ui}
      />
    </div>,
  );
  return { ...rendered, capture, onResult, ref };
}

describe('LiveMathOverlay', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps automatic checking off until the user consents', async () => {
    const { capture } = setup();
    expect(
      screen.getByRole('button', { name: /Turn on automatic live check/i }),
    ).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: /Turn on automatic live check/i }));
    expect(screen.getByTestId('live-consent')).toBeInTheDocument();
    expect(screen.getByTestId('live-consent').textContent).toMatch(/sent to the AI provider/i);
    expect(capture).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Enable live check'));
    expect(
      screen.getByRole('button', { name: /Turn off automatic live check/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(capture).not.toHaveBeenCalled();
  });

  it('shows a red laser outline and a hint on keyboard focus', async () => {
    mockedRequest.mockResolvedValue(result());
    const before = JSON.stringify(elements());
    const { capture } = setup();

    act(() => {
      fireEvent.click(screen.getByText('Check now'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('laser-region')).toBeInTheDocument();
    });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('laser-region').className).toContain('laser-target');
    expect(screen.getByTestId('laser-region').textContent).toContain('Step 2');

    fireEvent.focus(screen.getByTestId('laser-region'));
    expect(screen.getByTestId('laser-hint')).toBeInTheDocument();
    expect(screen.getByTestId('laser-hint').textContent).toMatch(
      /Differentiate the linear term again/,
    );
    expect(screen.getByTestId('laser-hint').textContent).toMatch(/final answer is never shown/i);
    expect(screen.getByTestId('laser-hint').textContent).toMatch(/SymPy confirmed/);

    // The overlay must be a pure overlay: no element array mutation.
    expect(JSON.stringify(elements())).toBe(before);

    fireEvent.blur(screen.getByTestId('laser-region'));
    fireEvent.click(screen.getByLabelText('Dismiss live feedback'));
    expect(screen.queryByTestId('laser-region')).not.toBeInTheDocument();
  });

  it('opens the hint on touch', async () => {
    mockedRequest.mockResolvedValue(result());
    setup();

    fireEvent.click(screen.getByText('Check now'));
    await waitFor(() => expect(screen.getByTestId('laser-region')).toBeInTheDocument());

    fireEvent.touchStart(screen.getByTestId('laser-region'));
    expect(screen.getByTestId('laser-hint')).toBeInTheDocument();
  });

  it('highlights the whole step instead of guessing when coordinates are missing', async () => {
    mockedRequest.mockResolvedValue(
      result({
        error_bbox: null,
        steps: [
          { n: 1, latex: 'f(x) = x^3', confidence: 0.9, bbox: null },
          { n: 2, latex: "f'(x) = 3x^2 + 4", confidence: 0.9, bbox: null },
          { n: 3, latex: '= 3x^2 + 4', confidence: 0.8, bbox: null },
        ],
      }),
    );
    setup();

    fireEvent.click(screen.getByText('Check now'));
    await waitFor(() => expect(screen.getByTestId('live-fallback')).toBeInTheDocument());

    expect(screen.queryByTestId('laser-region')).not.toBeInTheDocument();
    expect(screen.getByTestId('live-fallback').textContent).toMatch(
      /Exact position unavailable/i,
    );
    expect(screen.getByTestId('live-fallback').textContent).toContain("f'(x) = 3x^2 + 4");
  });

  it('hides a stale laser after the drawing changes', async () => {
    mockedRequest.mockResolvedValue(result());
    const { rerender, ref } = setup();

    fireEvent.click(screen.getByText('Check now'));
    await waitFor(() => expect(screen.getByTestId('laser-region')).toBeInTheDocument());

    const changed = [
      ...elements(),
      { id: 'c', version: 1, type: 'freedraw', x: 20, y: 160, width: 80, height: 20 },
    ] as unknown as readonly ExcalidrawElement[];
    rerender(
      <div ref={ref} style={{ width: 800, height: 600 }}>
        <LiveMathOverlay
          elements={changed}
          containerRef={ref}
          questionId="q1"
          aiConfigured
          capture={async () => captured}
        />
      </div>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('laser-region')).not.toBeInTheDocument();
    });
  });

  it('disables checking when no AI provider is configured', () => {
    setup({ aiConfigured: false });
    expect(screen.getByText(/AI offline/i)).toBeInTheDocument();
    expect(screen.getByText('Check now')).toBeDisabled();
  });
});
