/**
 * useViewPreference Hook
 *
 * Manages user view preference (standard vs compact/StudioVision mode).
 * Persists preference to backend and provides toggle functionality.
 *
 * Usage:
 * const { viewPreference, isCompact, toggleView, setSessionView } = useViewPreference();
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import userService from '../services/userService';

/**
 * View preference hook for toggling between standard and compact views
 * @param {string} defaultView - Default view if no preference is set ('standard' | 'compact')
 * @returns {Object} View preference state and controls
 */
export function useViewPreference(defaultView = 'standard') {
  const { user } = useAuth();

  // Initialize from user preferences or localStorage fallback
  const [viewPreference, setViewPreference] = useState(() => {
    // First check user preferences from server
    if (user?.preferences?.viewPreference) {
      return user.preferences.viewPreference;
    }
    // Fallback to localStorage for quick access
    const stored = localStorage.getItem('viewPreference');
    if (stored && ['standard', 'compact'].includes(stored)) {
      return stored;
    }
    return defaultView;
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  // Sync with user preferences when they change
  useEffect(() => {
    if (user?.preferences?.viewPreference) {
      setViewPreference(user.preferences.viewPreference);
      localStorage.setItem('viewPreference', user.preferences.viewPreference);
    }
  }, [user?.preferences?.viewPreference]);

  /**
   * Toggle between standard and compact views
   * Persists to server and localStorage
   */
  const toggleView = useCallback(async () => {
    const newView = viewPreference === 'standard' ? 'compact' : 'standard';

    // Optimistic update
    setViewPreference(newView);
    localStorage.setItem('viewPreference', newView);
    setError(null);

    try {
      setIsUpdating(true);
      const result = await userService.updatePreferences({ viewPreference: newView });

      if (!result.success) {
        // Revert on failure
        const prevView = newView === 'standard' ? 'compact' : 'standard';
        setViewPreference(prevView);
        localStorage.setItem('viewPreference', prevView);
        setError('Failed to save view preference');
      } else {
        // Update local storage with server response
        userService.updateLocalUserPreferences(result.data);
      }
    } catch (err) {
      // Revert on error
      const prevView = newView === 'standard' ? 'compact' : 'standard';
      setViewPreference(prevView);
      localStorage.setItem('viewPreference', prevView);
      setError(err.message || 'Failed to save view preference');
      console.error('Error saving view preference:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [viewPreference]);

  /**
   * Set view preference directly (with server persistence)
   * @param {string} view - 'standard' or 'compact'
   */
  const setView = useCallback(async (view) => {
    if (!['standard', 'compact'].includes(view) || view === viewPreference) {
      return;
    }

    // Optimistic update
    setViewPreference(view);
    localStorage.setItem('viewPreference', view);
    setError(null);

    try {
      setIsUpdating(true);
      const result = await userService.updatePreferences({ viewPreference: view });

      if (!result.success) {
        setError('Failed to save view preference');
      } else {
        userService.updateLocalUserPreferences(result.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to save view preference');
      console.error('Error saving view preference:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [viewPreference]);

  /**
   * Set session-only view (no server persistence)
   * Useful for temporary view changes
   * @param {string} view - 'standard' or 'compact'
   */
  const setSessionView = useCallback((view) => {
    if (['standard', 'compact'].includes(view)) {
      setViewPreference(view);
      // Don't persist to localStorage for session-only changes
    }
  }, []);

  /**
   * Reset to user's saved preference
   */
  const resetToSaved = useCallback(() => {
    const savedView = user?.preferences?.viewPreference || defaultView;
    setViewPreference(savedView);
    localStorage.setItem('viewPreference', savedView);
  }, [user?.preferences?.viewPreference, defaultView]);

  return {
    // Current view preference
    viewPreference,

    // Boolean helpers
    isCompact: viewPreference === 'compact',
    isStandard: viewPreference === 'standard',

    // Actions
    toggleView,
    setView,
    setSessionView,
    resetToSaved,

    // State
    isUpdating,
    error
  };
}

export default useViewPreference;
