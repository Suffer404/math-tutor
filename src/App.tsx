import React, { useState, useEffect, useCallback } from 'react';
import { QuestionPanel } from './components/QuestionPanel';
import { Whiteboard } from './components/Whiteboard';
import { HandwritingCheck, HandwritingResult } from './components/HandwritingCheck';
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

// SVG icons as components - accept color via style prop on parent or use currentColor
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

  const handleNext = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, SAMPLE_QUESTIONS.length - 1));
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleHandwritingComplete = useCallback((result: HandwritingResult) => {
    setHandwritingResult(result);
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__nav">
          <button 
            className={`btn ${viewMode === 'practice' ? 'btn--active' : 'btn--ghost'}`}
            onClick={() => setViewMode('practice')}
          >
            <PenIcon />
            Practice
          </button>
          <button 
            className={`btn ${viewMode === 'handwriting' ? 'btn--active' : 'btn--ghost'}`}
            onClick={() => setViewMode('handwriting')}
          >
            <PenIcon />
            Handwriting
          </button>
          <button 
            className={`btn ${viewMode === 'dashboard' ? 'btn--active' : 'btn--ghost'}`}
            onClick={() => setViewMode('dashboard')}
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
        </div>
      </header>

      {/* Sidebar */}
      <QuestionPanel
        question={SAMPLE_QUESTIONS[currentQuestionIndex]}
        currentIndex={currentQuestionIndex}
        totalQuestions={SAMPLE_QUESTIONS.length}
        onNext={handleNext}
        onPrev={handlePrev}
      />

      {/* Main content area */}
      <main className="app-main">
        <div className="whiteboard-area">
          {viewMode === 'practice' && <Whiteboard />}
          {viewMode === 'handwriting' && (
            <HandwritingCheck
              questionId={SAMPLE_QUESTIONS[currentQuestionIndex].id}
              onCheckComplete={handleHandwritingComplete}
            />
          )}
          {viewMode === 'dashboard' && <Dashboard />}
        </div>
      </main>
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