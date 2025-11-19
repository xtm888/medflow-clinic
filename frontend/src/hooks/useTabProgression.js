import { useState, useCallback, useMemo } from 'react';

/**
 * useTabProgression Hook
 *
 * Manages tab progression with completion tracking
 * Features:
 * - Track completed tabs
 * - Enable/disable tabs based on completion
 * - Navigation controls (next/previous)
 * - Progress calculation
 * - Validation support
 */
export const useTabProgression = (tabOrder, initialTab = 0) => {
  const [currentTabIndex, setCurrentTabIndex] = useState(initialTab);
  const [completedTabs, setCompletedTabs] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  // Get current tab name
  const currentTab = useMemo(
    () => tabOrder[currentTabIndex],
    [tabOrder, currentTabIndex]
  );

  /**
   * Mark a tab as completed
   */
  const completeTab = useCallback((tabName) => {
    setCompletedTabs(prev => {
      const set = new Set([...prev, tabName]);
      return Array.from(set);
    });
  }, []);

  /**
   * Mark current tab as complete and move to next
   */
  const completeCurrentAndContinue = useCallback(() => {
    completeTab(currentTab);
    if (currentTabIndex < tabOrder.length - 1) {
      setCurrentTabIndex(currentTabIndex + 1);
    }
  }, [currentTab, currentTabIndex, tabOrder.length, completeTab]);

  /**
   * Check if a tab is completed
   */
  const isTabCompleted = useCallback((tabName) => {
    return completedTabs.includes(tabName);
  }, [completedTabs]);

  /**
   * Check if a tab is enabled (accessible)
   * A tab is enabled if:
   * - It's the first tab
   * - The previous tab is completed
   * - It's already been completed (can revisit)
   */
  const isTabEnabled = useCallback((tabName) => {
    const tabIndex = tabOrder.indexOf(tabName);

    // First tab is always enabled
    if (tabIndex === 0) return true;

    // Tab is enabled if already completed (can revisit)
    if (isTabCompleted(tabName)) return true;

    // Tab is enabled if previous tab is completed
    const previousTab = tabOrder[tabIndex - 1];
    return isTabCompleted(previousTab);
  }, [tabOrder, isTabCompleted]);

  /**
   * Navigate to a specific tab (if enabled)
   */
  const goToTab = useCallback((tabName) => {
    if (!isTabEnabled(tabName)) {
      console.warn(`Tab "${tabName}" is not enabled yet`);
      return false;
    }

    const tabIndex = tabOrder.indexOf(tabName);
    if (tabIndex !== -1) {
      setCurrentTabIndex(tabIndex);
      return true;
    }
    return false;
  }, [tabOrder, isTabEnabled]);

  /**
   * Navigate to next tab
   * @param {boolean} force - Skip isTabEnabled check (use when calling right after completeTab)
   */
  const goToNextTab = useCallback((force = false) => {
    if (currentTabIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentTabIndex + 1];
      if (force || isTabEnabled(nextTab)) {
        setCurrentTabIndex(currentTabIndex + 1);
        return true;
      }
    }
    return false;
  }, [currentTabIndex, tabOrder, isTabEnabled]);

  /**
   * Navigate to previous tab
   */
  const goToPreviousTab = useCallback(() => {
    if (currentTabIndex > 0) {
      setCurrentTabIndex(currentTabIndex - 1);
      return true;
    }
    return false;
  }, [currentTabIndex]);

  /**
   * Reset all progress
   */
  const reset = useCallback(() => {
    setCurrentTabIndex(0);
    setCompletedTabs([]);
    setValidationErrors({});
  }, []);

  /**
   * Set validation error for a tab
   */
  const setTabError = useCallback((tabName, error) => {
    setValidationErrors(prev => ({
      ...prev,
      [tabName]: error
    }));
  }, []);

  /**
   * Clear validation error for a tab
   */
  const clearTabError = useCallback((tabName) => {
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[tabName];
      return newErrors;
    });
  }, []);

  /**
   * Calculate overall progress percentage
   */
  const progress = useMemo(() => {
    return (completedTabs.length / tabOrder.length) * 100;
  }, [completedTabs.length, tabOrder.length]);

  /**
   * Check if all tabs are completed
   */
  const isComplete = useMemo(() => {
    return completedTabs.length === tabOrder.length;
  }, [completedTabs.length, tabOrder.length]);

  /**
   * Check if on first tab
   */
  const isFirstTab = currentTabIndex === 0;

  /**
   * Check if on last tab
   */
  const isLastTab = currentTabIndex === tabOrder.length - 1;

  /**
   * Get tab status
   */
  const getTabStatus = useCallback((tabName) => {
    const isCurrent = tabName === currentTab;
    const isCompleted = isTabCompleted(tabName);
    const isEnabled = isTabEnabled(tabName);
    const hasError = !!validationErrors[tabName];

    return {
      isCurrent,
      isCompleted,
      isEnabled,
      isDisabled: !isEnabled,
      hasError,
      isPending: !isCompleted && !isCurrent,
      isUpcoming: !isEnabled && !isCompleted
    };
  }, [currentTab, isTabCompleted, isTabEnabled, validationErrors]);

  return {
    // Current state
    currentTab,
    currentTabIndex,
    completedTabs,
    validationErrors,

    // Status checks
    isTabCompleted,
    isTabEnabled,
    getTabStatus,

    // Navigation
    goToTab,
    goToNextTab,
    goToPreviousTab,
    completeTab,
    completeCurrentAndContinue,

    // Progress
    progress,
    isComplete,
    isFirstTab,
    isLastTab,

    // Validation
    setTabError,
    clearTabError,

    // Utilities
    reset,
    tabOrder
  };
};

export default useTabProgression;
