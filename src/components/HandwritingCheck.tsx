import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useWhiteboard } from '../hooks/useWhiteboard';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useAiFeedback } from '../context/AiFeedbackContext';
import { LiveMathOverlay } from './LiveMathOverlay';
import { captureScene } from '../lib/captureScene';

interface HandwritingCheckProps {
  questionId: string;
  onCheckComplete: (result: HandwritingResult) => void;
}

export interface HandwritingResult {
  recognized_steps: Array<{ step: number; latex: string; confidence: number }>;
  uncertain_regions: Array<{ description: string }>;
  first_error_step: number | null;
  error_explanation: string | null;
  hint: string;
  confidence: number;
  needs_user_confirmation: boolean;
}

interface RecognizedStep {
  step: number;
  latex: string;
  confidence: number;
  user_confirmed?: boolean;
  user_corrected?: string;
}

const API_BASE = 'http://127.0.0.1:8000';

export const HandwritingCheck: React.FC<HandwritingCheckProps> = ({ 
  questionId, 
  onCheckComplete 
}) => {
  const { showToast } = useToast();
  const { push: pushAi, setBusy: setAiBusy } = useAiFeedback();
  
  const {
    initialData,
    liveElements,
    liveViewport,
    isLoaded,
    handleChange,
    clearBoard,
  } = useWhiteboard({
    storageKey: 'math_tutor_whiteboard_handwriting',
    autoSaveDelay: 300,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<HandwritingResult | null>(null);
  const [recognizedSteps, setRecognizedSteps] = useState<RecognizedStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionInput, setCorrectionInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [showAiConfigSheet, setShowAiConfigSheet] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check AI configuration on mount
  useEffect(() => {
    const checkAiConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
          const data = await response.json();
          setAiConfigured(data.ai_configured === true);
          if (!data.ai_configured) {
            setShowAiConfigSheet(true);
          }
        } else {
          setAiConfigured(false);
          setShowAiConfigSheet(true);
        }
      } catch {
        setAiConfigured(false);
        setShowAiConfigSheet(true);
      }
    };
    checkAiConfig();
  }, []);

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    clearBoard();
    setShowClearConfirm(false);
    // Reset analysis state when clearing
    setAnalysisResult(null);
    setRecognizedSteps([]);
    setShowCorrectionDialog(false);
  }, [clearBoard]);

  const captureCanvas = useCallback(async (): Promise<string> => {
    try {
      // Export the real Excalidraw scene; querying one <canvas> can capture an
      // empty layer because Excalidraw renders across several canvases.
      const captured = await captureScene(liveElements, null);
      return captured?.imageBase64 || '';
    } catch (e) {
      console.error('Canvas capture failed:', e);
      return '';
    }
  }, [liveElements]);

  const analyzeHandwriting = useCallback(async () => {
    // Check AI configuration before analyzing
    if (aiConfigured === false) {
      setShowAiConfigSheet(true);
      return;
    }
    
    setIsAnalyzing(true);
    setAiBusy(true);
    pushAi('working', `Analyzing question ${questionId} — capturing the board…`);

    try {
      const imageBase64 = await captureCanvas();
      pushAi('info', imageBase64
        ? `Board captured (${Math.round((imageBase64.length * 3) / 4 / 1024)} KB)`
        : 'Board capture came back empty');
      
      if (!imageBase64) {
        throw new Error('Could not capture whiteboard image. Make sure you have drawn something.');
      }

      pushAi('working', 'Sending to the vision model…');
      const response = await fetch(`${API_BASE}/ai/handwriting-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64, question_id: questionId })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: HandwritingResult = await response.json();
      pushAi('ok', `Model replied: ${result.recognized_steps.length} step(s), confidence ${Math.round((result.confidence || 0) * 100)}%`);
      if (result.first_error_step) {
        pushAi('error', `First error at step ${result.first_error_step}: ${result.error_explanation ?? 'see feedback'}`);
      } else if (result.error_explanation) {
        pushAi('warn', result.error_explanation);
      }
      setAnalysisResult(result);
      
      // Convert recognized steps to our internal format
      const steps: RecognizedStep[] = result.recognized_steps.map(s => ({
        step: s.step,
        latex: s.latex,
        confidence: s.confidence
      }));
      setRecognizedSteps(steps);
      
      if (steps.length > 0) {
        setCurrentStepIndex(0);
        setShowCorrectionDialog(true);
      } else {
        showToast('No steps recognized. Try drawing more clearly.', 'warning');
      }
      
    } catch (error) {
      console.error('Handwriting analysis error:', error);
      pushAi('error', error instanceof Error ? error.message : 'Analysis failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's an AI configuration error
      if (errorMessage.includes('AI_PROVIDER') || errorMessage.includes('API key') || errorMessage.includes('not configured')) {
        setAiConfigured(false);
        setShowAiConfigSheet(true);
        return;
      }
      
      const errorResult: HandwritingResult = {
        recognized_steps: [],
        uncertain_regions: [{ description: errorMessage }],
        first_error_step: null,
        error_explanation: errorMessage,
        hint: 'Could not analyze handwriting. Please type your steps manually.',
        confidence: 0,
        needs_user_confirmation: true
      };
      setAnalysisResult(errorResult);
      showToast(`Analysis failed: ${errorMessage}`, 'error');
    } finally {
      setIsAnalyzing(false);
      setAiBusy(false);
    }
  }, [captureCanvas, questionId, showToast, aiConfigured]);

  const handleConfirmStep = useCallback(() => {
    if (currentStepIndex < recognizedSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setCorrectionInput('');
    } else {
      verifyAllSteps();
    }
  }, [currentStepIndex, recognizedSteps.length]);

  const handleCorrectStep = useCallback(() => {
    if (correctionInput.trim()) {
      const updatedSteps = [...recognizedSteps];
      updatedSteps[currentStepIndex] = {
        ...updatedSteps[currentStepIndex],
        user_confirmed: true,
        user_corrected: correctionInput.trim()
      };
      setRecognizedSteps(updatedSteps);
      setCorrectionInput('');
      
      if (currentStepIndex < recognizedSteps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        verifyAllSteps();
      }
    }
  }, [currentStepIndex, recognizedSteps, correctionInput]);

  const verifyAllSteps = useCallback(() => {
    if (analysisResult) {
      onCheckComplete(analysisResult);
      showToast('Analysis complete!', 'success');
    }
    setShowCorrectionDialog(false);
  }, [analysisResult, onCheckComplete, showToast]);

  const getCurrentStep = useCallback(() => recognizedSteps[currentStepIndex], [recognizedSteps, currentStepIndex]);

  if (!isLoaded) {
    return (
      <div className="whiteboard-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading whiteboard...</div>
      </div>
    );
  }

  const currentStep = getCurrentStep();

  return (
    <div className="whiteboard-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '0.75rem 1rem', 
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Handwriting Analysis</h3>
        
        <button 
          className="btn btn--primary"
          onClick={analyzeHandwriting}
          disabled={isAnalyzing || !liveElements?.length}
          style={{ marginLeft: 'auto' }}
        >
          {isAnalyzing ? (
            <>
              <span style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: '0.5rem' }} />
              Analyzing...
            </>
          ) : 'Analyze Handwriting'}
        </button>

        <button 
          className="btn btn--ghost"
          onClick={handleClear}
          disabled={!liveElements?.length}
          title="Clear whiteboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.375rem', verticalAlign: 'middle' }}>
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          Clear
        </button>
      </div>

      {/* Analysis status bar */}
      {analysisResult && (
        <div style={{ 
          padding: '0.5rem 1rem', 
          borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          fontSize: '0.875rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <strong>Confidence:</strong>
            <span style={{ 
              padding: '0.125rem 0.5rem', 
              borderRadius: 'var(--radius-sm)',
              background: analysisResult.confidence > 0.7 ? 'var(--success-bg)' : analysisResult.confidence > 0.4 ? 'var(--warning-bg)' : 'var(--error-bg)',
              color: analysisResult.confidence > 0.7 ? 'var(--success)' : analysisResult.confidence > 0.4 ? 'var(--warning)' : 'var(--error)',
              fontWeight: 500,
            }}>
              {(analysisResult.confidence * 100).toFixed(0)}%
            </span>
          </div>
          
          {analysisResult.first_error_step && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--error-bg)',
              color: 'var(--error)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              First error at step {analysisResult.first_error_step}
            </div>
          )}
          
          {analysisResult.hint && (
            <div style={{ 
              flex: 1,
              minWidth: '200px',
              padding: '0.375rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--info-bg)',
              color: 'var(--info)',
              fontSize: '0.8125rem',
            }}>
              <strong>Hint:</strong> {analysisResult.hint}
            </div>
          )}
        </div>
      )}

      {/* Whiteboard canvas */}
      <div className="whiteboard-container" style={{ flex: 1, position: 'relative' }} ref={containerRef}>
        <Excalidraw
          initialData={initialData || { elements: [] }}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: false,
              export: {},
              loadScene: true,
            },
          }}
        />
        <LiveMathOverlay
          elements={liveElements}
          view={liveViewport}
          containerRef={containerRef}
          questionId={questionId}
          aiConfigured={aiConfigured}
        />
      </div>

      {/* Step correction dialog */}
      {showCorrectionDialog && recognizedSteps.length > 0 && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={handleConfirmStep}
          title={`Step ${currentStep.step} of ${recognizedSteps.length}`}
          message={`Recognized: ${currentStep.latex} (Confidence: ${(currentStep.confidence * 100).toFixed(0)}%)\n\nIs this correct? If not, enter the corrected LaTeX:`}
          confirmText="Confirm"
          cancelText="Correct & Continue"
          variant="primary"
          loading={false}
        />
      )}

      {/* Analysis complete view */}
      {analysisResult && !showCorrectionDialog && recognizedSteps.length === 0 && (
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
          <h4 style={{ margin: '0 0 1rem' }}>Analysis Complete</h4>
          
          {analysisResult.error_explanation && (
            <div style={{ 
              color: 'var(--error)', 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              background: 'var(--error-bg)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--error)',
            }}>
              <strong>Error:</strong> {analysisResult.error_explanation}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="btn btn--secondary" 
              onClick={() => setShowCorrectionDialog(true)}
            >
              Review Steps
            </button>
            <button 
              className="btn btn--ghost" 
              onClick={() => { clearBoard(); setAnalysisResult(null); }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClear}
        title="Clear Whiteboard"
        message="This will permanently delete all drawings on the whiteboard. This action cannot be undone."
        confirmText="Clear"
        cancelText="Keep Drawings"
        variant="danger"
      />

      {/* AI Configuration Sheet */}
      {showAiConfigSheet && (
        <div className="dialog-overlay" onClick={() => setShowAiConfigSheet(false)} role="dialog" aria-modal="true" aria-labelledby="ai-config-title">
          <div className="dialog" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h2 id="ai-config-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>AI Not Configured</h2>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Handwriting analysis requires an AI provider. The current provider is <strong>mock</strong> (offline fallback).
            </p>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.875rem' }}>
              To enable real handwriting analysis, set one of these environment variables and restart the backend:
            </p>
            <ul style={{ margin: '0 0 1.5rem', paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <li><code>AI_PROVIDER=openai</code> + <code>OPENAI_API_KEY=sk-...</code></li>
              <li><code>AI_PROVIDER=anthropic</code> + <code>ANTHROPIC_API_KEY=sk-ant-...</code></li>
            </ul>
            <div style={{ padding: '0.75rem', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8125rem' }}>
              <strong>SymPy-only fallback:</strong> You can still use the mock provider for basic structure analysis (recognizes steps, detects empty canvas). The mock returns simulated step recognition for testing.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn--ghost"
                onClick={() => setShowAiConfigSheet(false)}
              >
                Continue with Mock
              </button>
              <button 
                className="btn btn--primary"
                onClick={async () => {
                  try {
                    const response = await fetch(`${API_BASE}/ai/handwriting-check`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ image_base64: 'test', question_id: 'test' })
                    });
                    const data = await response.json();
                    if (data.recognized_steps?.length > 0) {
                      showToast('Mock provider is working!', 'success');
                    }
                  } catch {
                    showToast('Failed to test connection', 'error');
                  }
                }}
              >
                Test Connection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandwritingCheck;