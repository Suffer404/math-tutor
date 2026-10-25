import React, { useCallback, useMemo, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useWhiteboard } from '../hooks/useWhiteboard';
import { ConfirmDialog } from './ConfirmDialog';
import { LiveMathOverlay } from './LiveMathOverlay';

export interface WhiteboardProps {
  questionId?: string;
  questionText?: string;
  aiConfigured?: boolean | null;
  providerLabel?: string;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  questionId = 'practice',
  questionText,
  aiConfigured = null,
  providerLabel,
}) => {
  const {
    initialData,
    liveElements,
    liveViewport,
    isLoaded,
    isSaving,
    saveError,
    handleChange,
    clearBoard,
  } = useWhiteboard({
    storageKey: 'math_tutor_whiteboard_practice',
    autoSaveDelay: 300,
  });

  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  // Stable UIOptions: a fresh object on every render makes Excalidraw re-run
  // its internal update effects, which can loop when onChange updates state.
  const uiOptions = useMemo(
    () => ({
      canvasActions: {
        changeViewBackgroundColor: true,
        clearCanvas: false, // We handle clear ourselves with confirmation
        export: {},
        loadScene: true,
      },
    }),
    [],
  );

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    clearBoard();
    setShowClearConfirm(false);
  }, [clearBoard]);

  if (!isLoaded) {
    return (
      <div className="whiteboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading whiteboard...</div>
      </div>
    );
  }

  return (
    <div className="whiteboard-area">
      <div
        ref={boardContainerRef}
        className="whiteboard-container"
        style={{ height: '100%', width: '100%' }}
      >
        <Excalidraw
          initialData={initialData || { elements: [] }}
          onChange={handleChange}
          UIOptions={uiOptions}
        />
        <LiveMathOverlay
          elements={liveElements}
          view={liveViewport}
          containerRef={boardContainerRef}
          questionId={questionId}
          questionText={questionText}
          aiConfigured={aiConfigured}
          providerLabel={providerLabel}
        />
        {/* Floating clear button */}
        <button
          className="btn btn--ghost"
          onClick={handleClear}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 100,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          title="Clear whiteboard (Ctrl+Shift+X)"
          aria-label="Clear whiteboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          <span style={{ fontSize: '0.8125rem' }}>Clear</span>
        </button>

        {/* Save status indicator */}
        {(isSaving || saveError) && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              zIndex: 100,
              padding: '0.375rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.75rem',
              background: saveError ? 'var(--error-bg)' : 'var(--info-bg)',
              color: saveError ? 'var(--error)' : 'var(--info)',
              border: `1px solid ${saveError ? 'var(--error)' : 'var(--info)'}`,
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
            role="status"
            aria-live="polite"
          >
            {isSaving ? (
              <>
                <span style={{ width: '10px', height: '10px', border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Saving...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Save failed - check storage
              </>
            )}
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
      </div>
    </div>
  );
};

export default Whiteboard;