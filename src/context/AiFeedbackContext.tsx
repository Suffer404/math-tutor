import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type AiEventKind = 'info' | 'working' | 'ok' | 'warn' | 'error';

export interface AiEvent {
  id: string;
  at: number;
  kind: AiEventKind;
  text: string;
}

interface AiFeedbackValue {
  events: AiEvent[];
  busy: boolean;
  push: (kind: AiEventKind, text: string) => void;
  setBusy: (value: boolean) => void;
  clear: () => void;
}

const AiFeedbackContext = createContext<AiFeedbackValue | undefined>(undefined);

/**
 * Tiny event bus for AI activity. Any component can push a line and the
 * FeedbackCorner (bottom-left) shows it live, newest first.
 */
export const AiFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<AiEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const push = useCallback((kind: AiEventKind, text: string) => {
    seq.current += 1;
    const event: AiEvent = { id: `e${seq.current}`, at: Date.now(), kind, text };
    setEvents((prev) => [event, ...prev].slice(0, 80));
  }, []);

  const clear = useCallback(() => setEvents([]), []);

  const value = useMemo<AiFeedbackValue>(
    () => ({ events, busy, push, setBusy, clear }),
    [events, busy, push, clear],
  );

  return <AiFeedbackContext.Provider value={value}>{children}</AiFeedbackContext.Provider>;
};

export function useAiFeedback(): AiFeedbackValue {
  const ctx = useContext(AiFeedbackContext);
  if (!ctx) throw new Error('useAiFeedback must be used inside AiFeedbackProvider');
  return ctx;
}
