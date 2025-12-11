import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook for auto-saving consultation session data
 *
 * @param {Object} data - The data to auto-save
 * @param {Function} saveFunction - Async function to save the data
 * @param {Object} options - Configuration options
 * @returns {Object} - Save status and manual save function
 */
export function useAutoSave(data, saveFunction, options = {}) {
  const {
    interval = 30000, // Auto-save every 30 seconds
    debounceDelay = 2000, // Wait 2 seconds after last change before saving
    enabled = true,
    onVersionConflict = null // Callback for version conflicts
  } = options;

  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error, conflict
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  const dataRef = useRef(data);
  const versionRef = useRef(data?.version || 0);
  const saveTimeoutRef = useRef(null);
  const autoSaveIntervalRef = useRef(null);
  const statusResetTimeoutRef = useRef(null);
  const isSavingRef = useRef(false);

  // Update version when data changes
  useEffect(() => {
    if (data?.version !== undefined && data.version > versionRef.current) {
      versionRef.current = data.version;
    }
  }, [data?.version]);

  // Update data ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Manual save function
  const manualSave = useCallback(async () => {
    if (isSavingRef.current || !saveFunction) return;

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      setError(null);

      await saveFunction(dataRef.current, false); // false = not auto-save

      setSaveStatus('saved');
      setLastSaved(new Date());

      // Reset to idle after 3 seconds (with cleanup)
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
      }
      statusResetTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);

    } catch (err) {
      console.error('Manual save error:', err);
      setSaveStatus('error');
      setError(err.message || 'Failed to save');
    } finally {
      isSavingRef.current = false;
    }
  }, [saveFunction]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (isSavingRef.current || !saveFunction || !enabled || hasConflict) return;

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      setError(null);

      // Include version in save request for optimistic locking
      const dataWithVersion = {
        ...dataRef.current,
        version: versionRef.current
      };

      const result = await saveFunction(dataWithVersion, true); // true = auto-save

      // Update version from server response
      if (result?.version !== undefined) {
        versionRef.current = result.version;
      }

      setSaveStatus('saved');
      setLastSaved(new Date());

      // Reset to idle after 2 seconds (with cleanup)
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
      }
      statusResetTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);

    } catch (err) {
      console.error('Auto-save error:', err);

      // Check for version conflict error (HTTP 409 or specific error code)
      if (err.status === 409 || err.code === 'VERSION_CONFLICT' || err.message?.includes('version')) {
        setSaveStatus('conflict');
        setHasConflict(true);
        setConflictData(err.serverData || null);
        setError('Another user has modified this record. Please refresh to see their changes.');

        // Call version conflict callback if provided
        if (onVersionConflict) {
          onVersionConflict(err.serverData, dataRef.current);
        }
      } else {
        setSaveStatus('error');
        setError(err.message || 'Auto-save failed');

        // Reset error after 5 seconds (with cleanup)
        if (statusResetTimeoutRef.current) {
          clearTimeout(statusResetTimeoutRef.current);
        }
        statusResetTimeoutRef.current = setTimeout(() => {
          setError(null);
          setSaveStatus('idle');
        }, 5000);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [saveFunction, enabled, hasConflict, onVersionConflict]);

  // Debounced auto-save on data change
  useEffect(() => {
    if (!enabled || !saveFunction) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, debounceDelay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, debounceDelay, autoSave, enabled, saveFunction]);

  // Periodic auto-save interval
  useEffect(() => {
    if (!enabled || !saveFunction || interval <= 0) return;

    // Set up interval for periodic saves
    autoSaveIntervalRef.current = setInterval(() => {
      autoSave();
    }, interval);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [interval, autoSave, enabled, saveFunction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
      }
    };
  }, []);

  // Function to resolve conflict (accept server version)
  const resolveConflict = useCallback(() => {
    setHasConflict(false);
    setConflictData(null);
    setError(null);
    setSaveStatus('idle');
  }, []);

  // Function to force save (override server version)
  const forceSave = useCallback(async () => {
    if (!saveFunction) return;

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');

      // Force save without version check
      const result = await saveFunction({ ...dataRef.current, forceOverwrite: true }, false);

      if (result?.version !== undefined) {
        versionRef.current = result.version;
      }

      setHasConflict(false);
      setConflictData(null);
      setSaveStatus('saved');
      setLastSaved(new Date());
    } catch (err) {
      setSaveStatus('error');
      setError(err.message || 'Force save failed');
    } finally {
      isSavingRef.current = false;
    }
  }, [saveFunction]);

  return {
    saveStatus, // 'idle' | 'saving' | 'saved' | 'error' | 'conflict'
    lastSaved,
    error,
    manualSave,
    isSaving: saveStatus === 'saving',
    // Conflict handling
    hasConflict,
    conflictData,
    resolveConflict,
    forceSave
  };
}

/**
 * Format last saved time for display
 */
export function formatLastSaved(lastSaved) {
  if (!lastSaved) return null;

  const now = new Date();
  const diff = Math.floor((now - lastSaved) / 1000); // difference in seconds

  if (diff < 60) return 'À l\'instant';
  if (diff < 120) return 'Il y a 1 minute';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} minutes`;
  if (diff < 7200) return 'Il y a 1 heure';
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} heures`;

  return lastSaved.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default useAutoSave;
