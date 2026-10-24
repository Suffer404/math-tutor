import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { App } from './App';
import { SAMPLE_QUESTIONS } from './data/sampleQuestions';

// Mock localStorage for test
const localStorageMock = {
  getItem: vi.fn((key) => {
    if (key === 'math-tutor-question-panel-open') return 'true';
    if (key === 'math-tutor-handwriting-strip-open') return 'false';
    return null;
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock Excalidraw since canvas/DOM rendering in jsdom might be tricky
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => <div data-testid="excalidraw-mock">Excalidraw Whiteboard</div>,
}));

describe('App & Question Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial question and whiteboard', () => {
    render(<App />);
    // Question card now shows topic "Derivatives" instead of course "Calculus I"
    expect(screen.getByText('Derivatives')).toBeDefined();
    expect(screen.getByText(SAMPLE_QUESTIONS[0].question_text)).toBeDefined();
    expect(screen.getByTestId('excalidraw-mock')).toBeDefined();
  });

  it('navigates to next and previous questions via floating card', () => {
    render(<App />);
    // Next/Previous buttons are now in the floating question card
    const nextBtn = screen.getByTitle('Next question');
    const prevBtn = screen.getByTitle('Previous question');

    expect(prevBtn).toBeDisabled();

    fireEvent.click(nextBtn);
    expect(screen.getByText(SAMPLE_QUESTIONS[1].question_text)).toBeDefined();
    expect(prevBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(screen.getByText(SAMPLE_QUESTIONS[0].question_text)).toBeDefined();
  });

  it('shows hints when requested via floating question card', () => {
    render(<App />);
    // The hint button is now in the floating question card
    const hintBtn = screen.getByText('Show Hint');
    fireEvent.click(hintBtn);

    expect(screen.getByText(SAMPLE_QUESTIONS[0].hints[0], { exact: false })).toBeDefined();
  });
});