import React, { useState, useEffect, useCallback, useRef } from 'react';
import katex from 'katex';
import { QuestionPanel } from './components/QuestionPanel';
import { Whiteboard } from './components/Whiteboard';
import { HandwritingCheck, HandwritingResult } from './components/HandwritingCheck';
import { AddQuestionModal } from './components/AddQuestionModal';
import { SAMPLE_QUESTIONS } from './data/sampleQuestions';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { useHealth } from './hooks/useHealth';
import './styles.css';

type ViewMode = 'practice' | 'handwriting' | 'dashboard';

interface Attempt {
  id: string;
  question_id: string;
  user_solution: string;
  is_correct: number;
  feedback_json: string | null;
  created_at: string;
  question?: any;
}

interface WeakTopic {
  topic: string;
  accuracy: number;
  attempts: number;
}

// SVG icons
const ErrorIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 48, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth={strokeWidth}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const BarChartIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 48, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={strokeWidth}>
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const ClipboardIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 48, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={strokeWidth}>
    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
    <path d="M16 4v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V4"></path>
  </svg>
);

const PenIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 18, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
    <path d="M2 2l7.586 7.586"></path>
    <circle cx="11" cy="11" r="2"></circle>
  </svg>
);

const MoonIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 18, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const SunIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 18, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const CheckIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 12, strokeWidth = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const XIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 12, strokeWidth = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ChevronLeftIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const ChevronRightIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const ChevronUpIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const ChevronDownIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const FullscreenIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
    <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
    <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
    <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
  </svg>
);

const PlusIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const QuestionCard: React.FC<{ 
  question: any; 
  currentIndex: number; 
  totalQuestions: number; 
  onNext: () => void; 
  onPrev: () => void;
}> = ({ question, currentIndex, totalQuestions, onNext, onPrev }) => {
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

  const showQuestionLatex = question.question_latex != null;
  const showAnswerLatex = question.answer_latex != null;

  return (
    <div style={{
      position: 'fixed',
      top: '70px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      width: 'min(90vw, 600px)',
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: '1rem',
      pointerEvents: 'none',
      maxHeight: '80vh',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {question.topic}
          </p>
          <p style={{ margin: 0, fontWeight: 500, fontSize: '1rem', lineHeight: 1.4 }}>{question.question_text}</p>
          {showQuestionLatex && (
            <div className="latex-content" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              {question.question_latex}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', pointerEvents: 'auto' }}>
          <button 
            className="btn btn--ghost"
            onClick={onPrev}
            disabled={currentIndex === 0}
            title="Previous question"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <span style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {currentIndex + 1} / {totalQuestions}
          </span>
          <button 
            className="btn btn--ghost"
            onClick={onNext}
            disabled={currentIndex === SAMPLE_QUESTIONS.length - 1}
            title="Next question"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>

      <hr style={{ margin: '0.75rem 0', border: 'none', borderTop: '1px solid var(--border-secondary)' }} />

      <div className="hints-section" style={{ pointerEvents: 'auto' }}>
        {!showHints ? (
          <button className="btn" style={{ width: '100%' }} onClick={() => { setShowHints(true); setHintIndex(0); }}>
            Show Hint
          </button>
        ) : (
          <div>
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
          </div>
        )}
      </div>

      <hr style={{ margin: '0.75rem 0', border: 'none', borderTop: '1px solid var(--border-secondary)' }} />

      <div className="solution-section" style={{ pointerEvents: 'auto' }}>
        <button
          className="btn btn--secondary"
          style={{ width: '100%' }}
          onClick={() => setShowSolution(!showSolution)}
        >
          {showSolution ? 'Hide Solution' : 'Show Solution'}
        </button>

        {showSolution && (
          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>Answer:</h4>
            {showAnswerLatex && (
              <div className="latex-content" dangerouslySetInnerHTML={renderMath(question.answer_latex)} />
            )}
            <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.875rem' }}>Steps:</h4>
            <ol style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: 1.8 }}>
              {question.solution_steps.map((step: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '0.375rem' }}>
                  <span dangerouslySetInnerHTML={renderMath(step)} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { showToast } = useToast();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://127.0.0.1:8000/questions');
        if (!response.ok) throw new Error('Failed to load questions');
        const questions = await response.json();
        
        const allAttempts: Attempt[] = [];
        for (const q of questions) {
          try {
            const attemptResponse = await fetch(`http://127.0.0.1:8000/attempts/${q.id}`);
            if (attemptResponse.ok) {
              const data = await attemptResponse.json();
              if (data.length > 0) {
                allAttempts.push(...data.map((a: any) => ({ ...a, question: q })));
              }
            }
          } catch (e) {
            console.warn(`Failed to load attempts for ${q.id}:`, e);
          }
        }
        
        if (!cancelled) {
          setAttempts(allAttempts);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load dashboard data');
          showToast('Failed to load dashboard data', 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    if (attempts.length > 0) {
      const topicStats: Record<string, { correct: number; total: number }> = {};
      attempts.forEach((a) => {
        const topic = a.question?.topic || 'Unknown';
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
        topicStats[topic].total++;
        if (a.is_correct) topicStats[topic].correct++;
      });
      
      const weak = Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
          attempts: stats.total
        }))
        .filter(w => w.accuracy < 0.7 && w.attempts > 0)
        .sort((a, b) => a.accuracy - b.accuracy);
      
      setWeakTopics(weak);
    }
  }, [attempts]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-primary)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <ErrorIcon size={48} strokeWidth={1.5} />
        <p style={{ color: 'var(--error)', margin: '1rem 0 0' }}>{error}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Dashboard</h2>
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Weak Topics</h3>
        {weakTopics.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            background: 'var(--bg-tertiary)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-secondary)',
          }}>
            <BarChartIcon size={48} strokeWidth={1.5} />
            <p style={{ margin: '1rem 0 0', color: 'var(--text-secondary)' }}>No weak topics identified yet.</p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Practice more questions to see analysis.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {weakTopics.map((w, i) => (
              <li key={i} style={{ 
                padding: '1rem', 
                background: 'var(--warning-bg)', 
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--warning)',
                borderLeft: '4px solid var(--warning)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <strong>{w.topic}</strong>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Accuracy: {(w.accuracy * 100).toFixed(0)}% ({w.attempts} attempts)
                  </div>
                </div>
                <div style={{ 
                  width: '60px', 
                  height: '6px', 
                  background: 'var(--bg-primary)', 
                  borderRadius: '3px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    width: `${w.accuracy * 100}%`, 
                    height: '100%', 
                    background: w.accuracy > 0.5 ? 'var(--success)' : w.accuracy > 0.3 ? 'var(--warning)' : 'var(--error)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Recent Attempts</h3>
        {attempts.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            background: 'var(--bg-tertiary)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-secondary)',
          }}>
            <ClipboardIcon size={48} strokeWidth={1.5} />
            <p style={{ margin: '1rem 0 0', color: 'var(--text-secondary)' }}>No attempts recorded yet.</p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Practice questions to see your history.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {attempts.slice(0, 20).map((a, i) => (
              <div key={i} style={{ 
                padding: '0.875rem 1rem', 
                background: a.is_correct ? 'var(--success-bg)' : 'var(--error-bg)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${a.is_correct ? 'var(--success)' : 'var(--error)'}`,
                borderLeft: `4px solid ${a.is_correct ? 'var(--success)' : 'var(--error)'}`,
                transition: 'transform var(--transition-fast)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                      {a.question?.topic}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.question?.question_text?.substring(0, 80)}...
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'flex-end', 
                    gap: '0.25rem',
                    flexShrink: 0 
                  }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      color: a.is_correct ? 'var(--success)' : 'var(--error)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      {a.is_correct ? <CheckIcon /> : <XIcon />}
                      {a.is_correct ? 'Correct' : 'Incorrect'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { health, loading: healthLoading } = useHealth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('practice');
  const [handwritingResult, setHandwritingResult] = useState<HandwritingResult | null>(null);
  
  // Floating panel states - persisted in localStorage
  const [questionPanelOpen, setQuestionPanelOpen] = useState(() => {
    const saved = localStorage.getItem('math-tutor-question-panel-open');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [handwritingStripOpen, setHandwritingStripOpen] = useState(() => {
    const saved = localStorage.getItem('math-tutor-handwriting-strip-open');
    return saved !== null ? JSON.parse(saved) : viewMode === 'handwriting';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  
  // Refs for fullscreen
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('math-tutor-question-panel-open', JSON.stringify(questionPanelOpen));
  }, [questionPanelOpen]);

  useEffect(() => {
    localStorage.setItem('math-tutor-handwriting-strip-open', JSON.stringify(handwritingStripOpen));
  }, [handwritingStripOpen]);

  const handleNext = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, SAMPLE_QUESTIONS.length - 1));
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleHandwritingComplete = useCallback((result: HandwritingResult) => {
    setHandwritingResult(result);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && boardRef.current) {
      boardRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  const handleAddQuestion = useCallback((newQuestion: any) => {
    // Add the new question to the sample questions (for demo purposes)
    // In a real app, this would be handled by the backend
    setCurrentQuestionIndex(SAMPLE_QUESTIONS.length);
    // Note: In a real app, you'd update a questions state or refetch from backend
    // For now, we just show a toast
  }, []);

  return (
    <div className="app-container" style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      {/* Fullscreen base layer - Whiteboard */}
      <div 
        ref={boardRef}
        className="whiteboard-area" 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 0,
          background: 'var(--bg-primary)',
        }}
      >
        {viewMode === 'practice' && <Whiteboard />}
        {viewMode === 'handwriting' && (
          <HandwritingCheck
            questionId={SAMPLE_QUESTIONS[currentQuestionIndex].id}
            onCheckComplete={handleHandwritingComplete}
          />
        )}
        {viewMode === 'dashboard' && <Dashboard />}
      </div>

      {/* Floating Question Card - Top center */}
      {questionPanelOpen && viewMode !== 'dashboard' && (
        <QuestionCard
          question={SAMPLE_QUESTIONS[currentQuestionIndex]}
          currentIndex={currentQuestionIndex}
          totalQuestions={SAMPLE_QUESTIONS.length}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      )}

      {/* Floating Question Panel Toggle - Left side */}
      <button
        className={`btn ${questionPanelOpen ? 'btn--primary' : 'btn--ghost'}`}
        onClick={() => setQuestionPanelOpen(!questionPanelOpen)}
        style={{
          position: 'fixed',
          left: '12px',
          top: 'calc(var(--header-height) + 12px)',
          zIndex: 40,
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          padding: '0.5rem',
        }}
        aria-label={questionPanelOpen ? 'Hide question panel' : 'Show question panel'}
        title={questionPanelOpen ? 'Hide question (Q)' : 'Show question (Q)'}
      >
        <ChevronRightIcon size={20} />
      </button>

      {/* Floating Handwriting Strip Toggle - Bottom */}
      {(viewMode === 'handwriting' || handwritingStripOpen) && (
        <button
          className={`btn ${handwritingStripOpen ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setHandwritingStripOpen(!handwritingStripOpen)}
          style={{
            position: 'fixed',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          aria-label={handwritingStripOpen ? 'Hide handwriting strip' : 'Show handwriting strip'}
          title={handwritingStripOpen ? 'Hide handwriting strip' : 'Show handwriting strip'}
        >
          <PenIcon size={18} />
          <span style={{ fontSize: '0.8125rem' }}>Handwriting</span>
        </button>
      )}

      {/* Top Header Bar */}
      <header className="app-header" style={{ zIndex: 30 }}>
        <div className="app-header__nav">
          <button 
            className={`btn ${viewMode === 'practice' ? 'btn--active' : 'btn--ghost'}`}
            onClick={() => { setViewMode('practice'); setHandwritingStripOpen(false); }}
          >
            <PenIcon />
            Practice
          </button>
          <button 
            className={`btn ${viewMode === 'handwriting' ? 'btn--active' : 'btn--ghost'}`}
            onClick={() => { setViewMode('handwriting'); setHandwritingStripOpen(true); }}
          >
            <PenIcon />
            Handwriting
          </button>
          <button 
            className={`btn ${viewMode === 'dashboard' ? 'btn--active' : 'btn--ghost'}`}
            onClick={() => { setViewMode('dashboard'); setHandwritingStripOpen(false); }}
          >
            <BarChartIcon />
            Dashboard
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* AI Status Badge */}
          {!healthLoading && health && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 500,
              background: health.ai_configured ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: health.ai_configured ? 'var(--success)' : 'var(--warning)',
              border: `1px solid ${health.ai_configured ? 'var(--success)' : 'var(--warning)'}`,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
              {health.ai_configured ? `AI: ${health.provider} (${health.model})` : 'AI: Mock (offline)'}
            </span>
          )}
          
          <button 
            className="btn btn--ghost"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          
          <button 
            className="btn btn--ghost"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
          >
            <FullscreenIcon />
          </button>
          
          <button 
            className="btn btn--primary"
            onClick={() => setAddQuestionOpen(true)}
            aria-label="Add Question"
            title="Add Question"
          >
            <PlusIcon />
          </button>
        </div>
      </header>

      {/* Floating Handwriting Analysis Strip - Bottom */}
      {handwritingStripOpen && viewMode === 'handwriting' && (
        <div style={{
          position: 'fixed',
          bottom: '0',
          left: '0',
          right: '0',
          zIndex: 35,
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-primary)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          maxHeight: '40vh',
          overflow: 'hidden',
        }}>
          <HandwritingCheck
            questionId={SAMPLE_QUESTIONS[currentQuestionIndex].id}
            onCheckComplete={handleHandwritingComplete}
          />
        </div>
      )}

      {/* Fullscreen hint */}
      {!isFullscreen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '12px',
          zIndex: 20,
          padding: '0.5rem 0.75rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          opacity: 0.8,
          animation: 'fadeIn 0.5s ease-out',
        }}>
          <kbd style={{ 
            padding: '0.125rem 0.375rem', 
            background: 'var(--bg-tertiary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
          }}>F</kbd>
          <span>Fullscreen</span>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;