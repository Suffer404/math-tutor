import React, { useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useToast } from '../context/ToastContext';

const XIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 12, strokeWidth = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (question: any) => void;
}

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { showToast } = useToast();
  const [questionText, setQuestionText] = useState('');
  const [questionLatex, setQuestionLatex] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionType, setQuestionType] = useState('problem');
  const [answerLatex, setAnswerLatex] = useState('');
  const [solutionSteps, setSolutionSteps] = useState<string[]>(['']);
  const [hints, setHints] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const newQuestion = {
      schema_version: '1.0',
      id: `q_manual_${Date.now()}`,
      course: 'Custom',
      topic,
      difficulty,
      question_type: questionType,
      question_text: questionText,
      question_latex: questionLatex || undefined,
      source: { filename: 'manual' },
      hints: hints.filter(h => h.trim()),
      answer_latex: answerLatex,
      solution_steps: solutionSteps.filter(s => s.trim()),
      verification_status: 'pending' as const,
      tags: [topic.toLowerCase().replace(/\s+/g, '-')],
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([newQuestion]),
      });

      if (!response.ok) {
        throw new Error('Failed to save question');
      }

      const result = await response.json();
      if (result.errors?.length) {
        throw new Error(result.errors[0].error);
      }

      onSubmit(newQuestion);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const renderMath = (latex: string) => {
    try {
      return { __html: katex.renderToString(latex, { throwOnError: false }) };
    } catch {
      return { __html: latex };
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="add-question-title">
      <div className="dialog" style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="add-question-title" style={{ margin: 0, fontSize: '1.25rem' }}>Add Question</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Question Text <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter question text..."
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit', fontSize: '0.875rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Question LaTeX (optional)
              </label>
              <textarea
                value={questionLatex}
                onChange={(e) => setQuestionLatex(e.target.value)}
                placeholder="Enter LaTeX (e.g., f(x) = x^2 + 1)..."
                style={{ width: '100%', minHeight: '60px', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  Topic <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Derivatives, Integration, Limits"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  Difficulty <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}
                  required
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  Question Type <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}
                  required
                >
                  <option value="problem">Problem</option>
                  <option value="differentiation">Differentiation</option>
                  <option value="integration">Integration</option>
                  <option value="limit">Limit</option>
                  <option value="series">Series</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Answer LaTeX <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <textarea
                value={answerLatex}
                onChange={(e) => setAnswerLatex(e.target.value)}
                placeholder="Enter answer in LaTeX (e.g., f'(x) = 2x)..."
                style={{ width: '100%', minHeight: '60px', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.875rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Solution Steps (one per line)
              </label>
              <textarea
                value={solutionSteps.join('\n')}
                onChange={(e) => setSolutionSteps(e.target.value.split('\n').filter(s => s.trim()))}
                placeholder="Step 1\nStep 2\nStep 3..."
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Hints (one per line)
              </label>
              <textarea
                value={hints.join('\n')}
                onChange={(e) => setHints(e.target.value.split('\n').filter(s => s.trim()))}
                placeholder="Hint 1\nHint 2\nHint 3..."
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.75rem', background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 'var(--radius-md)', color: 'var(--error)', marginTop: '1rem' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddQuestionModal;