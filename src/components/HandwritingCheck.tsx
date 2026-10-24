import React, { useState, useRef, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';

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

const STORAGE_KEY = 'math_tutor_whiteboard_state_v1';
const API_BASE = 'http://127.0.0.1:8000';

export const HandwritingCheck: React.FC<HandwritingCheckProps> = ({ 
  questionId, 
  onCheckComplete 
}) => {
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<HandwritingResult | null>(null);
  const [recognizedSteps, setRecognizedSteps] = useState<RecognizedStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionInput, setCorrectionInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setInitialData({
          elements: parsed.elements || [],
          appState: parsed.appState || {},
        });
      } else {
        setInitialData({ elements: [] });
      }
    } catch (e) {
      console.error('Failed to load whiteboard state:', e);
      setInitialData({ elements: [] });
    }
    setIsLoaded(true);
  }, []);

  const handleChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => {
    try {
      const stateToSave = {
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save whiteboard state:', e);
    }
  };

  const captureCanvas = async (): Promise<string> => {
    if (!containerRef.current) return '';
    
    try {
      // Find the canvas element within the Excalidraw container
      const canvas = containerRef.current.querySelector('canvas');
      if (canvas) {
        return canvas.toDataURL('image/png').split(',')[1];
      }
      throw new Error('Canvas element not found');
    } catch (e) {
      console.error('Canvas capture failed:', e);
      return '';
    }
  };

  const analyzeHandwriting = async () => {
    setIsAnalyzing(true);
    
    try {
      const imageBase64 = await captureCanvas();
      
      if (!imageBase64) {
        throw new Error('Could not capture whiteboard image');
      }

      const response = await fetch(`${API_BASE}/ai/handwriting-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64, question_id: questionId })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: HandwritingResult = await response.json();
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
      }
      
    } catch (error) {
      console.error('Handwriting analysis error:', error);
      const errorResult: HandwritingResult = {
        recognized_steps: [],
        uncertain_regions: [{ description: String(error) }],
        first_error_step: null,
        error_explanation: String(error),
        hint: 'Could not analyze handwriting. Please type your steps manually.',
        confidence: 0,
        needs_user_confirmation: true
      };
      setAnalysisResult(errorResult);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmStep = () => {
    if (currentStepIndex < recognizedSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setCorrectionInput('');
    } else {
      // All steps confirmed, run SymPy verification
      verifyAllSteps();
    }
  };

  const handleCorrectStep = () => {
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
  };

  const verifyAllSteps = async () => {
    // For now, just complete the flow
    // In full implementation, this would call the SymPy verification endpoints
    if (analysisResult) {
      onCheckComplete(analysisResult);
    }
  };

  const getCurrentStep = () => recognizedSteps[currentStepIndex];

  if (!isLoaded || !initialData) {
    return <div>Loading whiteboard...</div>;
  }

  return (
    <div className="handwriting-check-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
        <h3>Handwriting Analysis</h3>
        <button 
          className="btn"
          onClick={analyzeHandwriting}
          disabled={isAnalyzing}
          style={{ marginRight: '1rem' }}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Handwriting'}
        </button>
        
        {analysisResult && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px' }}>
            <strong>Overall Confidence: </strong> {(analysisResult.confidence * 100).toFixed(0)}%
            {analysisResult.first_error_step && (
              <span style={{ marginLeft: '1rem', color: '#d32f2f' }}>
                First error at step {analysisResult.first_error_step}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="whiteboard-container" style={{ flex: 1, position: 'relative' }} ref={containerRef}>
        <Excalidraw
          initialData={initialData}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: true,
              export: false,
            },
          }}
        />
      </div>

      {showCorrectionDialog && recognizedSteps.length > 0 && (
        <div className="correction-dialog" style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 1000,
          minWidth: '400px',
          maxWidth: '600px'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <h4>Step {getCurrentStep().step} of {recognizedSteps.length}</h4>
            <p>Recognized: <code>{getCurrentStep().latex}</code></p>
            <p>Confidence: {(getCurrentStep().confidence * 100).toFixed(0)}%</p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Is this correct? If not, enter the corrected LaTeX:
            </label>
            <input
              type="text"
              value={correctionInput}
              onChange={(e) => setCorrectionInput(e.target.value)}
              placeholder="Enter corrected LaTeX (e.g., 3x^2 - 4)"
              style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={handleConfirmStep}>
              Confirm
            </button>
            <button className="btn" onClick={handleCorrectStep} style={{ background: '#e3f2fd' }}>
              Correct & Continue
            </button>
          </div>
        </div>
      )}

      {analysisResult && !showCorrectionDialog && (
        <div className="analysis-result" style={{ padding: '1rem', borderTop: '1px solid #eee' }}>
          <h4>Analysis Complete</h4>
          
          {analysisResult.error_explanation && (
            <div style={{ color: '#d32f2f', marginBottom: '1rem' }}>
              <strong>Error:</strong> {analysisResult.error_explanation}
            </div>
          )}

          {analysisResult.hint && (
            <div style={{ 
              padding: '1rem', 
              background: '#e8f5e9', 
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <strong>Hint:</strong> {analysisResult.hint}
            </div>
          )}

          {analysisResult.first_error_step && (
            <div style={{ 
              padding: '1rem', 
              background: '#ffebee', 
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <strong>First Error (Step {analysisResult.first_error_step}):</strong> 
              {analysisResult.error_explanation}
            </div>
          )}

          <button 
            className="btn" 
            onClick={() => setShowCorrectionDialog(true)}
            style={{ marginTop: '1rem' }}
          >
            Review Steps
          </button>
        </div>
      )}
    </div>
  );
};

export default HandwritingCheck;