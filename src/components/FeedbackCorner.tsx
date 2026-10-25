import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAiFeedback, type AiEventKind } from '../context/AiFeedbackContext';

const COLORS: Record<AiEventKind, string> = {
  info: 'var(--text-secondary)',
  working: 'var(--accent-primary)',
  ok: 'var(--success)',
  warn: 'var(--warning)',
  error: 'var(--error)',
};

const DOTS: Record<AiEventKind, string> = {
  info: '·',
  working: '⟳',
  ok: '✓',
  warn: '!',
  error: '✕',
};

/**
 * Bottom-left corner panel that shows AI activity as it happens:
 * capture → upload → model call → parsed steps → verdict / error.
 */
export const FeedbackCorner: React.FC = () => {
  const { events, busy, clear } = useAiFeedback();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('math-tutor-feedback-open') !== 'false';
    } catch {
      return true;
    }
  });
  const [unseen, setUnseen] = useState(0);
  const lastCount = useRef(events.length);

  useEffect(() => {
    try {
      localStorage.setItem('math-tutor-feedback-open', String(open));
    } catch {
      /* ignore */
    }
  }, [open]);

  // flash the badge when something arrives while collapsed
  useEffect(() => {
    if (events.length > lastCount.current) {
      if (!open) setUnseen((n) => n + (events.length - lastCount.current));
    }
    lastCount.current = events.length;
  }, [events.length, open]);

  useEffect(() => {
    if (open && unseen) setUnseen(0);
  }, [open, unseen]);

  const latest = useMemo(() => events[0], [events]);

  const label = busy ? 'AI thinking…' : latest ? latest.text : 'no AI activity yet';

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 58,
        width: open ? 'min(92vw, 340px)' : 'auto',
        maxHeight: open ? 'min(46vh, 380px)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        fontSize: '0.75rem',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.5rem',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
        title={open ? 'Collapse AI feedback' : 'Expand AI feedback'}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: busy ? 'var(--accent-primary)' : events.length ? COLORS[events[0].kind] : 'var(--text-muted)',
            boxShadow: busy ? '0 0 0 3px rgba(37,99,235,0.22)' : 'none',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>AI feedback</span>
        {unseen > 0 && !open && (
          <span
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 999,
              padding: '0 0.35rem',
              fontSize: '0.65rem',
            }}
          >
            {unseen}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {open && events.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                clear();
              }
            }}
            title="Clear feed"
            style={{ color: 'var(--text-muted)', padding: '0 0.25rem' }}
          >
            clear
          </span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div style={{ overflowY: 'auto', borderTop: '1px solid var(--border-primary)' }}>
          {events.length === 0 ? (
            <p style={{ margin: 0, padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>
              Draw something, then press <strong>Analyze Handwriting</strong> — progress and errors appear here.
            </p>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  gap: '0.375rem',
                  padding: '0.3125rem 0.625rem',
                  borderBottom: '1px solid var(--border-secondary)',
                  color: COLORS[e.kind],
                  lineHeight: 1.4,
                }}
              >
                <span style={{ opacity: 0.7, flexShrink: 0, fontFamily: 'ui-monospace, monospace' }}>
                  {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{ flexShrink: 0 }}>{DOTS[e.kind]}</span>
                <span style={{ wordBreak: 'break-word' }}>{e.text}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div
          style={{
            padding: '0 0.5rem 0.375rem',
            color: busy ? 'var(--accent-primary)' : 'var(--text-muted)',
            maxWidth: 300,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

export default FeedbackCorner;
