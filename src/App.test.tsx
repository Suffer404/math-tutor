import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { App } from './App';
import { SAMPLE_QUESTIONS } from './data/sampleQuestions';

// Mock Excalidraw since canvas/DOM rendering in jsdom might be tricky
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => <div data-testid="excalidraw-mock">Excalidraw Whiteboard</div>,
}));

describe('App & Question Navigation', () => {
  it('renders initial question and whiteboard', () => {
    render(<App />);
    expect(screen.getByText('Calculus I')).toBeDefined();
    expect(screen.getByText(SAMPLE_QUESTIONS[0].question_text)).toBeDefined();
    expect(screen.getByTestId('excalidraw-mock')).toBeDefined();
  });

  it('navigates to next and previous questions', () => {
    render(<App />);
    const nextBtn = screen.getByText('Next');
    const prevBtn = screen.getByText('Previous');

    expect(prevBtn).toBeDisabled();

    fireEvent.click(nextBtn);
    expect(screen.getByText(SAMPLE_QUESTIONS[1].question_text)).toBeDefined();
    expect(prevBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(screen.getByText(SAMPLE_QUESTIONS[0].question_text)).toBeDefined();
  });

  it('shows hints when requested', () => {
    render(<App />);
    const hintBtn = screen.getByText('Show Hint');
    fireEvent.click(hintBtn);

    expect(screen.getByText(SAMPLE_QUESTIONS[0].hints[0], { exact: false })).toBeDefined();
  });
});
