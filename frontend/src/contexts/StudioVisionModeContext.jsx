/**
 * StudioVisionModeContext
 *
 * Global context for managing view mode between:
 * - 'standard': Traditional MedFlow UI
 * - 'studiovision': Multi-column StudioVision layouts
 *
 * Persists user preference to localStorage and allows per-module overrides.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'medflow_studiovision_mode';

// Default preferences structure
const defaultPreferences = {
  globalMode: 'studiovision', // 'standard' | 'studiovision' - StudioVision is the new default!
  moduleOverrides: {
    refraction: null,    // null = use global, 'standard' | 'studiovision'
    diagnosis: null,
    prescription: null,
    examination: null
  },
  animations: true,
  compactMode: false
};

const StudioVisionModeContext = createContext(null);

export function StudioVisionModeProvider({ children, defaultMode = 'standard' }) {
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load StudioVision preferences:', e);
    }
    return { ...defaultPreferences, globalMode: defaultMode };
  });

  // Persist preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.warn('Failed to save StudioVision preferences:', e);
    }
  }, [preferences]);

  // Get effective mode for a module (respects override or falls back to global)
  const getModeForModule = useCallback((module) => {
    const override = preferences.moduleOverrides[module];
    return override || preferences.globalMode;
  }, [preferences]);

  // Set global mode
  const setGlobalMode = useCallback((mode) => {
    setPreferences(prev => ({
      ...prev,
      globalMode: mode
    }));
  }, []);

  // Set module-specific override
  const setModuleMode = useCallback((module, mode) => {
    setPreferences(prev => ({
      ...prev,
      moduleOverrides: {
        ...prev.moduleOverrides,
        [module]: mode
      }
    }));
  }, []);

  // Clear module override (use global)
  const clearModuleOverride = useCallback((module) => {
    setPreferences(prev => ({
      ...prev,
      moduleOverrides: {
        ...prev.moduleOverrides,
        [module]: null
      }
    }));
  }, []);

  // Toggle global mode
  const toggleGlobalMode = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      globalMode: prev.globalMode === 'standard' ? 'studiovision' : 'standard'
    }));
  }, []);

  // Check if currently in StudioVision mode (globally)
  const isStudioVision = preferences.globalMode === 'studiovision';

  // Toggle animations
  const toggleAnimations = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      animations: !prev.animations
    }));
  }, []);

  // Toggle compact mode
  const toggleCompactMode = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      compactMode: !prev.compactMode
    }));
  }, []);

  // Reset all preferences to defaults
  const resetPreferences = useCallback(() => {
    setPreferences({ ...defaultPreferences, globalMode: defaultMode });
  }, [defaultMode]);

  const value = useMemo(() => ({
    // Current states
    globalMode: preferences.globalMode,
    isStudioVision,
    moduleOverrides: preferences.moduleOverrides,
    animations: preferences.animations,
    compactMode: preferences.compactMode,

    // Getters
    getModeForModule,

    // Setters
    setGlobalMode,
    setModuleMode,
    clearModuleOverride,
    toggleGlobalMode,
    toggleAnimations,
    toggleCompactMode,
    resetPreferences
  }), [
    preferences,
    isStudioVision,
    getModeForModule,
    setGlobalMode,
    setModuleMode,
    clearModuleOverride,
    toggleGlobalMode,
    toggleAnimations,
    toggleCompactMode,
    resetPreferences
  ]);

  return (
    <StudioVisionModeContext.Provider value={value}>
      {children}
    </StudioVisionModeContext.Provider>
  );
}

/**
 * Hook to access StudioVision mode context
 * @returns {Object} StudioVision mode context value
 */
export function useStudioVisionMode() {
  const context = useContext(StudioVisionModeContext);
  if (!context) {
    // Return safe defaults when used outside provider
    return {
      globalMode: 'standard',
      isStudioVision: false,
      moduleOverrides: {},
      animations: true,
      compactMode: false,
      getModeForModule: () => 'standard',
      setGlobalMode: () => {},
      setModuleMode: () => {},
      clearModuleOverride: () => {},
      toggleGlobalMode: () => {},
      toggleAnimations: () => {},
      toggleCompactMode: () => {},
      resetPreferences: () => {}
    };
  }
  return context;
}

/**
 * Hook for module-specific mode
 * @param {string} module - Module name (refraction, diagnosis, prescription, examination)
 * @returns {Object} { mode, setMode, isStudioVision, useGlobal }
 */
export function useModuleViewMode(module) {
  const { getModeForModule, setModuleMode, clearModuleOverride, moduleOverrides } = useStudioVisionMode();

  const mode = getModeForModule(module);
  const isStudioVision = mode === 'studiovision';
  const hasOverride = moduleOverrides[module] !== null;

  const setMode = useCallback((newMode) => {
    setModuleMode(module, newMode);
  }, [module, setModuleMode]);

  const useGlobal = useCallback(() => {
    clearModuleOverride(module);
  }, [module, clearModuleOverride]);

  return {
    mode,
    setMode,
    isStudioVision,
    hasOverride,
    useGlobal
  };
}

export default StudioVisionModeContext;
