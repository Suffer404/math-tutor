import React, { useEffect, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';

const STORAGE_KEY = 'math_tutor_whiteboard_state_v1';

export const Whiteboard: React.FC = () => {
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
    // Debounce or save essential state
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

  const clearBoard = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  if (!isLoaded || !initialData) {
    return <div className="whiteboard-container">Loading whiteboard...</div>;
  }

  return (
    <div className="whiteboard-container" style={{ width: '100%', height: '100%' }}>
      <button
        className="btn"
        onClick={clearBoard}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 100,
          background: '#fff',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        }}
      >
        Clear Whiteboard
      </button>
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
  );
};
