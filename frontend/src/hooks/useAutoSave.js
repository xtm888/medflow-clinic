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
    enabled = true
  } = options;

  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  const dataRef = useRef(data);
  const saveTimeoutRef = useRef(null);
  const autoSaveIntervalRef = useRef(null);
  const statusResetTimeoutRef = useRef(null);
  const isSavingRef = useRef(false);

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
    if (isSavingRef.current || !saveFunction || !enabled) return;

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      setError(null);

      await saveFunction(dataRef.current, true); // true = auto-save

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
    } finally {
      isSavingRef.current = false;
    }
  }, [saveFunction, enabled]);

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

  return {
    saveStatus, // 'idle' | 'saving' | 'saved' | 'error'
    lastSaved,
    error,
    manualSave,
    isSaving: saveStatus === 'saving'
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
