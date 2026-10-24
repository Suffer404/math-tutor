import React, { useState } from 'react';
import { QuestionPanel } from './components/QuestionPanel';
import { Whiteboard } from './components/Whiteboard';
import { HandwritingCheck, HandwritingResult } from './components/HandwritingCheck';
import { SAMPLE_QUESTIONS } from './data/sampleQuestions';
import './styles.css';

type ViewMode = 'practice' | 'handwriting' | 'dashboard';

export const App: React.FC = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('practice');
  const [handwritingResult, setHandwritingResult] = useState<HandwritingResult | null>(null);

  const handleNext = () => {
    if (currentQuestionIndex < SAMPLE_QUESTIONS.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleHandwritingComplete = (result: HandwritingResult) => {
    setHandwritingResult(result);
  };

  return (
    <div className="app-container">
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '0.5rem 1rem',
        background: '#f5f5f5',
        borderBottom: '1px solid #ddd',
        position: 'fixed',
        top: 0,
        left: '400px',
        right: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={viewMode === 'practice' ? 'btn active' : 'btn'}
            onClick={() => setViewMode('practice')}
          >Practice</button>
          <button 
            className={viewMode === 'handwriting' ? 'btn active' : 'btn'}
            onClick={() => setViewMode('handwriting')}
          >Handwriting Check</button>
          <button 
            className={viewMode === 'dashboard' ? 'btn active' : 'btn'}
            onClick={() => setViewMode('dashboard')}
          >Dashboard</button>
        </div>
      </header>

      <QuestionPanel
        question={SAMPLE_QUESTIONS[currentQuestionIndex]}
        currentIndex={currentQuestionIndex}
        totalQuestions={SAMPLE_QUESTIONS.length}
        onNext={handleNext}
        onPrev={handlePrev}
      />

      <main style={{ marginTop: '40px', height: 'calc(100vh - 40px)' }}>
        {viewMode === 'practice' && <Whiteboard />}
        {viewMode === 'handwriting' && (
          <HandwritingCheck
            questionId={SAMPLE_QUESTIONS[currentQuestionIndex].id}
            onCheckComplete={handleHandwritingComplete}
          />
        )}
        {viewMode === 'dashboard' && (
          <Dashboard />
        )}
      </main>
    </div>
  );
};

// Simple dashboard component
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

const Dashboard: React.FC = () => {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);

  React.useEffect(() => {
    // Load attempts from backend
    fetch('http://127.0.0.1:8000/questions')
      .then(r => r.json())
      .then(questions => {
        // For each question, get attempts
        questions.forEach((q: any) => {
          fetch(`http://127.0.0.1:8000/attempts/${q.id}`)
            .then(r => r.json())
            .then(data => {
              if (data.length > 0) {
                setAttempts(prev => [...prev, ...data.map((a: any) => ({...a, question: q}))]);
              }
            });
        });
      });
  }, []);

  React.useEffect(() => {
    if (attempts.length > 0) {
      // Calculate weak topics based on incorrect attempts
      const topicStats: Record<string, { correct: number; total: number }> = {};
      attempts.forEach((a: any) => {
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

  return (
    <div style={{ padding: '2rem', height: '100%', overflow: 'auto' }}>
      <h2>Dashboard</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <h3>Weak Topics</h3>
        {weakTopics.length === 0 ? (
          <p>No weak topics identified yet. Practice more questions!</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {weakTopics.map((w: any, i: number) => (
              <li key={i} style={{ 
                padding: '1rem', 
                marginBottom: '0.5rem', 
                background: '#fff3e0', 
                borderRadius: '4px',
                borderLeft: '4px solid #ff9800'
              }}>
                <strong>{w.topic}</strong> - Accuracy: {(w.accuracy * 100).toFixed(0)}% ({w.attempts} attempts)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3>Recent Attempts</h3>
        {attempts.length === 0 ? (
          <p>No attempts recorded yet.</p>
        ) : (
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {attempts.slice(0, 20).map((a: any, i: number) => (
              <div key={i} style={{ 
                padding: '0.75rem', 
                marginBottom: '0.5rem', 
                background: a.is_correct ? '#e8f5e9' : '#ffebee',
                borderRadius: '4px',
                borderLeft: `4px solid ${a.is_correct ? '#4caf50' : '#f44336'}`
              }}>
                <div><strong>{a.question?.topic}</strong> - {a.question?.question_text?.substring(0, 60)}...</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {a.is_correct ? '✓ Correct' : '✗ Incorrect'} - {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
