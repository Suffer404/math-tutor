import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
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