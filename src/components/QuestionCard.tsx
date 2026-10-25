import React, { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Question } from '../data/sampleQuestions';
import { useTheme } from '../context/ThemeContext';

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  collapsed: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onResult?: (correct: boolean) => void;
}

function renderLatex(latex: string): { __html: string } {
  try {
    return { __html: katex.renderToString(latex, { throwOnError: false }) };
  } catch {
    return { __html: latex };
  }
}

const Icon: React.FC<{ dir: 'left' | 'right'; size?: number }> = ({ dir, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
  </svg>
);

/**
 * Question drawer, sliding in from the RIGHT edge.
 * Frosted glass: translucent fill + backdrop blur + a visible stroke so the text
 * stays readable over whatever is drawn underneath. Collapsed = off-canvas,
 * leaving the whole board free for writing.
 */
export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  total,
  collapsed,
  onToggle,
  onPrev,
  onNext,
  onResult,
}) => {
  const { theme } = useTheme();
  const [showHints, setShowHints] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  const hints = useMemo(() => (Array.isArray(question.hints) ? question.hints : []), [question.hints]);
  const steps = useMemo(
    () => (Array.isArray(question.solution_steps) ? question.solution_steps : []),
    [question.solution_steps],
  );

  // reset the disclosure state when the question changes
  useEffect(() => {
    setShowHints(false);
    setHintIndex(0);
    setShowSolution(false);
  }, [question.id]);

  // Esc closes the drawer
  useEffect(() => {
    if (collapsed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, onToggle]);

  const dark = theme === 'dark';
  const glass = dark ? 'rgba(18, 18, 22, 0.66)' : 'rgba(255, 255, 255, 0.64)';
  const stroke = dark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(15, 23, 42, 0.16)';
  const accentStroke = dark ? 'rgba(120, 170, 255, 0.55)' : 'rgba(37, 99, 235, 0.45)';

  return (
    <aside
      aria-hidden={collapsed}
      aria-label="Current question"
      style={{
        position: 'fixed',
        top: 'var(--header-height)',
        right: 0,
        bottom: 0,
        width: 'min(92vw, 400px)',
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
        transform: collapsed ? 'translateX(102%)' : 'translateX(0)',
        transition: 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        pointerEvents: collapsed ? 'none' : 'auto',
        background: glass,
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        borderLeft: `1.5px solid ${accentStroke}`,
        borderRadius: '14px 0 0 14px',
        boxShadow: '-14px 0 36px rgba(0, 0, 0, 0.35), inset 0 0 0 1px ' + stroke,
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.625rem 0.75rem',
          borderBottom: `1px solid ${stroke}`,
          flexShrink: 0,
        }}
      >
        <span className="badge badge--medium" style={{ fontSize: '0.6875rem' }}>
          {question.topic}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{question.difficulty}</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn--ghost" onClick={onPrev} disabled={index === 0} title="Previous (←)" style={{ padding: '0.25rem' }}>
          <Icon dir="left" />
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '2.75rem', textAlign: 'center' }}>
          {index + 1}/{total}
        </span>
        <button className="btn btn--ghost" onClick={onNext} disabled={index >= total - 1} title="Next (→)" style={{ padding: '0.25rem' }}>
          <Icon dir="right" />
        </button>
        <button className="btn btn--ghost" onClick={onToggle} title="Close (Esc)" aria-label="Close question" style={{ padding: '0.25rem' }}>
          <Icon dir="right" />
        </button>
      </div>

      {/* question */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem 0.875rem 0.25rem' }}>
        <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5, fontWeight: 500 }}>
          {question.question_text}
        </p>
        {question.question_latex && (
          <div
            className="latex-content"
            style={{ marginTop: '0.5rem', fontSize: '1rem' }}
            dangerouslySetInnerHTML={renderLatex(question.question_latex)}
          />
        )}
        {question.source?.filename && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {question.source.filename}
            {question.source.page ? ` · p.${question.source.page}` : ''}
          </p>
        )}

        <hr style={{ margin: '0.75rem 0', border: 'none', borderTop: `1px solid ${stroke}` }} />

        {!showHints ? (
          <button className="btn" style={{ width: '100%' }} onClick={() => { setShowHints(true); setHintIndex(0); }} disabled={!hints.length}>
            {hints.length ? `Show hint (1/${hints.length})` : 'No hints'}
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              <span>Hint {hintIndex + 1} / {hints.length}</span>
              <button className="btn btn--ghost" style={{ padding: 0, fontSize: '0.7rem' }} onClick={() => setShowHints(false)}>
                hide
              </button>
            </div>
            <p style={{ margin: '0 0 0.5rem', lineHeight: 1.55, fontSize: '0.875rem' }}>{hints[hintIndex]}</p>
            {hintIndex < hints.length - 1 && (
              <button className="btn btn--secondary" style={{ width: '100%' }} onClick={() => setHintIndex(hintIndex + 1)}>
                Next hint
              </button>
            )}
          </div>
        )}

        <hr style={{ margin: '0.75rem 0', border: 'none', borderTop: `1px solid ${stroke}` }} />

        <button className="btn btn--secondary" style={{ width: '100%' }} onClick={() => setShowSolution(!showSolution)}>
          {showSolution ? 'Hide solution' : 'Show solution'}
        </button>

        {showSolution && (
          <div style={{ marginTop: '0.625rem' }}>
            {question.answer_latex && (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Answer</div>
                <div className="latex-content" style={{ fontSize: '0.9375rem' }} dangerouslySetInnerHTML={renderLatex(question.answer_latex)} />
              </>
            )}
            {steps.length > 0 && (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.625rem 0 0.25rem' }}>Steps</div>
                <ol style={{ paddingLeft: '1.1rem', margin: 0, lineHeight: 1.7, fontSize: '0.875rem' }}>
                  {steps.map((step, i) => (
                    <li key={i} style={{ marginBottom: '0.25rem' }}>
                      <span dangerouslySetInnerHTML={renderLatex(step)} />
                    </li>
                  ))}
                </ol>
              </>
            )}
            {!question.answer_latex && steps.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0', fontSize: '0.8125rem' }}>
                No solution recorded for this question.
              </p>
            )}
          </div>
        )}
      </div>

      {/* footer: record the attempt */}
      {onResult && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.625rem 0.875rem',
            borderTop: `1px solid ${stroke}`,
            background: dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.28)',
            flexShrink: 0,
          }}
        >
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => onResult(true)}>
            ✓ Got it
          </button>
          <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => onResult(false)}>
            ✗ Struggled
          </button>
        </div>
      )}
    </aside>
  );
};

export default QuestionCard;
