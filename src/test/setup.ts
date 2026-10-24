import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';
import React from 'react';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock canvas for Excalidraw
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock useWhiteboard hook to avoid hook issues in tests
vi.mock('../hooks/useWhiteboard', () => ({
  useWhiteboard: () => ({
    initialData: { elements: [] },
    liveElements: [],
    isLoaded: true,
    isSaving: false,
    saveError: null,
    loadError: null,
    handleChange: vi.fn(),
    clearBoard: vi.fn(),
    exportData: vi.fn(() => ({ elements: [] })),
    importData: vi.fn(),
    setInitialData: vi.fn(),
  }),
}));

// Mock Excalidraw to avoid hook issues in tests
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: vi.fn(({ onChange, initialData, UIOptions, children, ...props }) => 
    React.createElement('div', { 'data-testid': 'excalidraw-mock', ...props }, children)
  ),
}));

// Suppress specific console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Failed to load whiteboard state') ||
      args[0]?.includes?.('localStorage') ||
      args[0]?.includes?.('act(...)')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});