import React, { useState, useEffect, useCallback, useRef } from 'react';
import katex from 'katex';
import { QuestionPanel } from './components/QuestionPanel';
import { Whiteboard } from './components/Whiteboard';
import { HandwritingCheck, HandwritingResult } from './components/HandwritingCheck';
import { AiSettingsModal } from './components/AiSettingsModal';
import { BulkAddModal } from './components/BulkAddModal';
import { FeedbackCorner } from './components/FeedbackCorner';
import { Dashboard } from './components/Dashboard';
import { QuestionCard } from './components/QuestionCard';
import { recordAttempt } from './lib/attempts';
import { SAMPLE_QUESTIONS, type Question } from './data/sampleQuestions';
import { AiFeedbackProvider } from './context/AiFeedbackContext';
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

const AppContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { health, loading: healthLoading, refetch: refetchHealth } = useHealth();
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<Question[]>(() => {
    try {
      const saved = localStorage.getItem('math-tutor-questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Question[];
      }
    } catch {
      /* corrupt storage: fall back to the sample set */
    }
    return SAMPLE_QUESTIONS;
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('practice');
  const [handwritingResult, setHandwritingResult] = useState<HandwritingResult | null>(null);

  // Never index out of range after adding questions or trimming the list.
  const safeIndex = Math.min(currentQuestionIndex, Math.max(questions.length - 1, 0));
  const currentQuestion = questions[safeIndex] ?? SAMPLE_QUESTIONS[0];

  useEffect(() => {
    try {
      localStorage.setItem('math-tutor-questions', JSON.stringify(questions));
    } catch {
      /* storage full or blocked */
    }
  }, [questions]);
  
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
  const [ribbonCollapsed, setRibbonCollapsed] = useState(() => {
    try {
      return localStorage.getItem('math-tutor-ribbon-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Collapsing the ribbon gives the canvas the space back (the card uses --header-height).
  useEffect(() => {
    document.documentElement.style.setProperty('--header-height', ribbonCollapsed ? '26px' : '48px');
    try {
      localStorage.setItem('math-tutor-ribbon-collapsed', String(ribbonCollapsed));
    } catch {
      /* ignore */
    }
  }, [ribbonCollapsed]);
  
  // Refs for fullscreen
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('math-tutor-question-panel-open', JSON.stringify(questionPanelOpen));
  }, [questionPanelOpen]);

  useEffect(() => {
    localStorage.setItem('math-tutor-handwriting-strip-open', JSON.stringify(handwritingStripOpen));
  }, [handwritingStripOpen]);

  const handleNext = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1));
  }, [questions.length]);

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
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setQuestionPanelOpen((open) => !open);
        return;
      }
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

  const handleAddQuestions = useCallback((added: Question[]) => {
    if (!added.length) return;
    const firstNew = questions.length;
    setQuestions((prev) => [...prev, ...added]);
    setCurrentQuestionIndex(firstNew);
  }, [questions.length]);

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
            questionId={currentQuestion.id}
            onCheckComplete={handleHandwritingComplete}
          />
        )}
        {viewMode === 'dashboard' && (
          <Dashboard
            questions={questions}
            onOpenQuestion={(id) => {
              const idx = questions.findIndex((q) => q.id === id);
              if (idx >= 0) {
                setCurrentQuestionIndex(idx);
                setViewMode('practice');
              }
            }}
          />
        )}
      </div>

      {/* Floating Question Card - Top center */}
      {viewMode !== 'dashboard' && (
        <QuestionCard
          question={currentQuestion}
          index={safeIndex}
          total={questions.length}
          collapsed={!questionPanelOpen}
          onToggle={() => setQuestionPanelOpen((open) => !open)}
          onNext={handleNext}
          onPrev={handlePrev}
          onResult={(correct) => {
            recordAttempt(currentQuestion, correct);
            showToast(correct ? 'Recorded: got it' : 'Recorded: struggled', correct ? 'success' : 'warning');
          }}
        />
      )}

      {/* Show / hide the question drawer — right middle edge */}
      <button
        onClick={() => setQuestionPanelOpen((open) => !open)}
        title={questionPanelOpen ? 'Close question (Q)' : 'Open question (Q)'}
        aria-label={questionPanelOpen ? 'Close question' : 'Open question'}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.625rem 0.4375rem',
          border: '1px solid var(--border-primary)',
          borderRight: 'none',
          borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
          background: questionPanelOpen ? 'var(--accent-primary)' : 'var(--bg-secondary)',
          color: questionPanelOpen ? '#fff' : 'var(--text-secondary)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
        }}
      >
        {questionPanelOpen ? <ChevronRightIcon size={18} /> : <ChevronLeftIcon size={18} />}
        <span style={{ fontSize: '0.625rem', writingMode: 'vertical-rl', letterSpacing: '0.06em' }}>
          {questionPanelOpen ? 'HIDE' : 'SHOW'}
        </span>
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
      <header className="app-header" style={{ zIndex: 30, display: ribbonCollapsed ? 'none' : 'flex' }}>
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
            onClick={() => setAiSettingsOpen(true)}
            aria-label="AI model settings"
            title="AI model settings"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
              <circle cx="9" cy="7" r="2" fill="var(--bg-secondary)" />
              <circle cx="15" cy="12" r="2" fill="var(--bg-secondary)" />
              <circle cx="8" cy="17" r="2" fill="var(--bg-secondary)" />
            </svg>
          </button>
          
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
            className="btn btn--ghost"
            onClick={() => setRibbonCollapsed(true)}
            aria-label="Hide toolbar"
            title="Hide toolbar — more drawing space"
          >
            <ChevronUpIcon size={18} />
          </button>
          
          <button 
            className="btn btn--primary"
            onClick={() => setBulkAddOpen(true)}
            aria-label="Add Question"
            title="Add Question"
          >
            <PlusIcon />
          </button>
        </div>
      </header>

      {ribbonCollapsed && (
        <button
          onClick={() => setRibbonCollapsed(false)}
          title="Show toolbar"
          aria-label="Show toolbar"
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.125rem 0.75rem',
            border: '1px solid var(--border-primary)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.6875rem',
          }}
        >
          <ChevronDownIcon size={14} />
          toolbar
        </button>
      )}

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
            questionId={currentQuestion.id}
            onCheckComplete={handleHandwritingComplete}
          />
        </div>
      )}

      {/* Add questions (bulk, plain text or JSON) */}
      <BulkAddModal
        isOpen={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)}
        onAdd={handleAddQuestions}
      />

      <FeedbackCorner />

      <AiSettingsModal
        isOpen={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        onSaved={() => refetchHealth()}
      />

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
        <AiFeedbackProvider>
          <AppContent />
        </AiFeedbackProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;