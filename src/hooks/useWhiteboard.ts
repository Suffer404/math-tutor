import { useState, useEffect, useCallback, useRef } from 'react';
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';

export interface WhiteboardState {
  elements: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
}

export interface UseWhiteboardOptions {
  storageKey: string;
  initialState?: WhiteboardState;
  onSaveError?: (error: Error) => void;
  onLoadError?: (error: Error) => void;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export interface UseWhiteboardReturn {
  initialData: WhiteboardState | null;
  isLoaded: boolean;
  isSaving: boolean;
  saveError: Error | null;
  loadError: Error | null;
  handleChange: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
  clearBoard: () => void;
  exportData: () => WhiteboardState | null;
  importData: (data: WhiteboardState) => void;
  setInitialData: React.Dispatch<React.SetStateAction<WhiteboardState | null>>;
}

/**
 * Custom hook for managing Excalidraw whiteboard state with localStorage persistence.
 * Handles loading, saving, debouncing, and error recovery.
 */
export function useWhiteboard(options: UseWhiteboardOptions): UseWhiteboardReturn {
  const {
    storageKey,
    initialState = { elements: [] },
    onSaveError,
    onLoadError,
    autoSave = true,
    autoSaveDelay = 300,
  } = options;

  const [initialData, setInitialData] = useState<WhiteboardState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<WhiteboardState | null>(null);
  const isMountedRef = useRef(true);

  // Load initial state from localStorage
  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    const loadState = async () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const state: WhiteboardState = {
            elements: parsed.elements || [],
            appState: parsed.appState || {},
            files: parsed.files || {},
          };
          if (!cancelled && isMountedRef.current) {
            setInitialData(state);
            setLoadError(null);
          }
        } else {
          if (!cancelled && isMountedRef.current) {
            setInitialData(initialState);
            setLoadError(null);
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error('Failed to parse whiteboard state');
        console.error('Failed to load whiteboard state:', error);
        if (!cancelled && isMountedRef.current) {
          setLoadError(error);
          onLoadError?.(error);
          setInitialData(initialState);
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsLoaded(true);
        }
      }
    };

    loadState();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [storageKey, initialState, onLoadError]);

  // Debounced save to localStorage
  const flushSave = useCallback(() => {
    if (pendingSaveRef.current && isMountedRef.current) {
      setIsSaving(true);
      try {
        localStorage.setItem(storageKey, JSON.stringify(pendingSaveRef.current));
        setSaveError(null);
      } catch (e) {
        const error = e instanceof Error ? e : new Error('Failed to save whiteboard state');
        console.error('Failed to save whiteboard state:', error);
        setSaveError(error);
        onSaveError?.(error);
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
      pendingSaveRef.current = null;
    }
  }, [storageKey, onSaveError]);

  // Handle Excalidraw onChange - debounced save
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => {
    if (!autoSave) return;

    // Only persist essential appState properties to avoid bloating storage
    const stateToSave: WhiteboardState = {
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemStrokeColor: appState.currentItemStrokeColor,
        currentItemBackgroundColor: appState.currentItemBackgroundColor,
      },
      files,
    };

    pendingSaveRef.current = stateToSave;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(flushSave, autoSaveDelay);
  }, [autoSave, autoSaveDelay, flushSave]);

  // Clear board - reset to empty state without page reload
  const clearBoard = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    pendingSaveRef.current = null;

    const emptyState: WhiteboardState = { elements: [] };
    setInitialData(emptyState);
    
    try {
      localStorage.removeItem(storageKey);
      setSaveError(null);
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Failed to clear whiteboard state');
      console.error('Failed to clear whiteboard state:', error);
      setSaveError(error);
      onSaveError?.(error);
    }
  }, [storageKey, onSaveError]);

  // Export current state
  const exportData = useCallback((): WhiteboardState | null => {
    return initialData;
  }, [initialData]);

  // Import state (e.g., from file or backup)
  const importData = useCallback((data: WhiteboardState) => {
    if (!data || !Array.isArray(data.elements)) {
      throw new Error('Invalid whiteboard data: missing elements array');
    }
    
    const stateToSave: WhiteboardState = {
      elements: data.elements,
      appState: data.appState || {},
      files: data.files || {},
    };

    setInitialData(stateToSave);
    
    if (autoSave) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
        setSaveError(null);
      } catch (e) {
        const error = e instanceof Error ? e : new Error('Failed to save imported whiteboard state');
        console.error('Failed to save imported whiteboard state:', error);
        setSaveError(error);
        onSaveError?.(error);
      }
    }
  }, [storageKey, autoSave, onSaveError]);

  // Flush any pending save on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        flushSave();
      }
    };
  }, [flushSave]);

  return {
    initialData,
    isLoaded,
    isSaving,
    saveError,
    loadError,
    handleChange,
    clearBoard,
    exportData,
    importData,
    setInitialData,
  };
}