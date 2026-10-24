import React, { useState } from 'react';
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
  const [showHints, setShowHints] = useState<boolean>(false);
  const [hintIndex, setHintIndex] = useState<number>(0);
  const [showSolution, setShowSolution] = useState<boolean>(false);

  const renderMath = (latex: string) => {
    try {
      return {
        __html: katex.renderToString(latex, { throwOnError: false }),
      };
    } catch {
      return { __html: latex };
    }
  };

  return (
    <div className="sidebar">
      <div className="header">
        <h2>{question.course}</h2>
        <span className="badge">{question.difficulty}</span>
      </div>

      <div className="content">
        <h3>Topic: {question.topic}</h3>
        <p><strong>Question {currentIndex + 1} of {totalQuestions}:</strong></p>
        <p>{question.question_text}</p>

        {question.question_latex && (
          <div
            className="latex-content"
            dangerouslySetInnerHTML={renderMath(question.question_latex)}
          />
        )}

        <div className="source-info" style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
          <p>Source: {question.source.filename} (p. {question.source.page})</p>
          <p>Status: <strong>{question.verification_status}</strong></p>
        </div>

        <hr style={{ margin: '1rem 0' }} />

        <div className="hints-section">
          {!showHints ? (
            <button className="btn" onClick={() => { setShowHints(true); setHintIndex(0); }}>
              Show Hint
            </button>
          ) : (
            <div>
              <h4>Hints ({hintIndex + 1}/{question.hints.length}):</h4>
              <p>{question.hints[hintIndex]}</p>
              {hintIndex < question.hints.length - 1 && (
                <button
                  className="btn"
                  onClick={() => setHintIndex((prev) => prev + 1)}
                  style={{ marginTop: '0.5rem' }}
                >
                  Next Hint
                </button>
              )}
            </div>
          )}
        </div>

        <hr style={{ margin: '1rem 0' }} />

        <div className="solution-section">
          <button
            className="btn"
            onClick={() => setShowSolution((prev) => !prev)}
          >
            {showSolution ? 'Hide Solution' : 'Show Solution'}
          </button>

          {showSolution && (
            <div style={{ marginTop: '0.5rem' }}>
              <h4>Answer:</h4>
              <div dangerouslySetInnerHTML={renderMath(question.answer_latex)} />
              <h4>Steps:</h4>
              <ol style={{ paddingLeft: '1.2rem' }}>
                {question.solution_steps.map((step, idx) => (
                  <li key={idx}>
                    <span dangerouslySetInnerHTML={renderMath(step)} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="controls">
        <button className="btn" onClick={onPrev} disabled={currentIndex === 0}>
          Previous
        </button>
        <button className="btn" onClick={onNext} disabled={currentIndex === totalQuestions - 1}>
          Next
        </button>
      </div>
    </div>
  );
};
