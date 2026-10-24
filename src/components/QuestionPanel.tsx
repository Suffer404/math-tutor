import React, { useState, Fragment } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Question } from '../data/sampleQuestions';

interface QuestionPanelProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
  onNext: () => void;
  onPrev: () => void;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  currentIndex,
  totalQuestions,
  onNext,
  onPrev,
}) => {
  const [showHints, setShowHints] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  const renderMath = (latex: string) => {
    try {
      return { __html: katex.renderToString(latex, { throwOnError: false }) };
    } catch {
      return { __html: latex };
    }
  };

  const getDifficultyClass = (difficulty: string): string => {
    if (difficulty === 'easy') return 'badge--easy';
    if (difficulty === 'medium') return 'badge--medium';
    if (difficulty === 'hard') return 'badge--hard';
    return 'badge--easy';
  };

  const sourceText = question.source.page 
    ? question.source.filename + ' (p. ' + question.source.page + ')'
    : question.source.filename;

  const showQuestionLatex = question.question_latex != null;
  const showAnswerLatex = question.answer_latex != null;

  return (
    <div className="sidebar">
      <div className="sidebar__header">
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{question.course}</h2>
        <span className={'badge ' + getDifficultyClass(question.difficulty)}>{question.difficulty}</span>
      </div>

      <div className="sidebar__content">
        <Fragment>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Topic: {question.topic}
          </h3>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Question {currentIndex + 1} of {totalQuestions}
          </p>
          <p style={{ margin: '0 0 1rem', lineHeight: 1.6 }}>{question.question_text}</p>

          {showQuestionLatex && question.question_latex && (
            <div className="latex-content" dangerouslySetInnerHTML={renderMath(question.question_latex)} />
          )}

          <div style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <p style={{ margin: '0 0 0.25rem' }}>Source: {sourceText}</p>
            <p style={{ margin: 0 }}>Status: <strong style={{ color: 'var(--text-primary)' }}>{question.verification_status}</strong></p>
          </div>

          <hr></hr>

          <div className="hints-section">
            {showHints ? (
              <Fragment>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
                  Hints ({hintIndex + 1} / {question.hints.length})
                </h4>
                <p style={{ margin: '0 0 0.75rem', lineHeight: 1.6 }}>{question.hints[hintIndex]}</p>
                {hintIndex < question.hints.length - 1 && (
                  <button
                    className="btn btn--secondary"
                    style={{ width: '100%' }}
                    onClick={() => setHintIndex(hintIndex + 1)}
                  >
                    Next Hint
                  </button>
                )}
              </Fragment>
            ) : (
              <button className="btn" style={{ width: '100%' }} onClick={() => { setShowHints(true); setHintIndex(0); }}>
                Show Hint
              </button>
            )}
          </div>

          <hr></hr>

          <div className="solution-section">
            <button
              className="btn btn--secondary"
              style={{ width: '100%' }}
              onClick={() => setShowSolution(!showSolution)}
            >
              {showSolution ? 'Hide Solution' : 'Show Solution'}
            </button>

            {showSolution && (
              <Fragment>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>Answer:</h4>
                {showAnswerLatex && (
                  <div className="latex-content" dangerouslySetInnerHTML={renderMath(question.answer_latex)} />
                )}
                <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.875rem' }}>Steps:</h4>
                <ol style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: 1.8 }}>
                  {question.solution_steps.map((step, idx) => (
                    <li key={idx} style={{ marginBottom: '0.375rem' }}>
                      <span dangerouslySetInnerHTML={renderMath(step)} />
                    </li>
                  ))}
                </ol>
              </Fragment>
            )}
          </div>
        </Fragment>
      </div>

      <div className="sidebar__controls">
        <button className="btn btn--secondary" style={{ flex: 1 }} onClick={onPrev} disabled={currentIndex === 0}>
          Previous
        </button>
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={onNext} disabled={currentIndex === totalQuestions - 1}>
          Next
        </button>
      </div>
    </div>
  );
};

function getDifficultyClass(difficulty: string): string {
  if (difficulty === 'easy') return 'badge--easy';
  if (difficulty === 'medium') return 'badge--medium';
  if (difficulty === 'hard') return 'badge--hard';
  return 'badge--easy';
}

const sourceText = (question: Question): string => {
  return question.source.page 
    ? question.source.filename + ' (p. ' + question.source.page + ')'
    : question.source.filename;
};

export default QuestionPanel;