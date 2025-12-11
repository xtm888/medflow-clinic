/**
 * HistoryContext
 *
 * React Context for managing patient medical/ocular history in the consultation sidebar.
 * Provides centralized state management for history data that persists across workflow steps.
 *
 * Features:
 * - Auto-loads patient history on mount
 * - Optimistic updates with error rollback
 * - Separate state from main exam data
 * - Real-time sync with backend
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/apiConfig';

const HistoryContext = createContext(null);

export function HistoryProvider({ children, patientId }) {
  // Core state
  const [history, setHistory] = useState({
    medicalHistory: [],
    ocularHistory: [],
    familyHistory: [],
    allergies: [],
    medications: [],
    socialHistory: {
      occupation: '',
      smoking: { status: 'unknown', packsPerDay: null, yearsSmoked: null },
      alcohol: { status: 'unknown', drinksPerWeek: null },
      recreationalDrugs: false,
      vduUsage: { hoursPerDay: null, usesBlueLight: false },
      uvExposure: { level: 'moderate', usesProtection: false }
    },
    pediatric: null
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Track previous state for optimistic rollback
  const previousHistoryRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  /**
   * Load patient history from API
   */
  const loadHistory = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/patients/${patientId}`);
      const patient = response.data?.data || response.data;

      setHistory({
        medicalHistory: patient.medicalHistory || [],
        ocularHistory: patient.ocularHistory || patient.ophthalmology?.ocularHistory || [],
        familyHistory: patient.familyHistory || [],
        allergies: patient.allergies || [],
        medications: patient.medications || patient.activeMedications || [],
        socialHistory: patient.socialHistory || {
          occupation: '',
          smoking: { status: 'unknown' },
          alcohol: { status: 'unknown' },
          recreationalDrugs: false,
          vduUsage: {},
          uvExposure: {}
        },
        pediatric: patient.pediatric || null
      });

      setIsDirty(false);
    } catch (err) {
      console.error('Error loading patient history:', err);
      setError('Failed to load patient history');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // Load history on mount and when patientId changes
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * Save history to backend
   */
  const saveHistory = useCallback(async (historyData = null) => {
    if (!patientId) return;

    const dataToSave = historyData || history;
    setIsSaving(true);

    try {
      await api.patch(`/patients/${patientId}`, {
        medicalHistory: dataToSave.medicalHistory,
        ocularHistory: dataToSave.ocularHistory,
        familyHistory: dataToSave.familyHistory,
        allergies: dataToSave.allergies,
        medications: dataToSave.medications,
        socialHistory: dataToSave.socialHistory,
        pediatric: dataToSave.pediatric
      });

      setLastSaved(new Date());
      setIsDirty(false);
      setError(null);
    } catch (err) {
      console.error('Error saving patient history:', err);
      setError('Failed to save changes');
      // Rollback to previous state
      if (previousHistoryRef.current) {
        setHistory(previousHistoryRef.current);
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [patientId, history]);

  /**
   * Debounced auto-save
   */
  const debouncedSave = useCallback((newHistory) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveHistory(newHistory);
    }, 2000); // 2 second debounce
  }, [saveHistory]);

  /**
   * Update a specific history section
   */
  const updateSection = useCallback((section, data) => {
    previousHistoryRef.current = history;

    setHistory(prev => {
      const newHistory = {
        ...prev,
        [section]: data
      };
      setIsDirty(true);
      debouncedSave(newHistory);
      return newHistory;
    });
  }, [history, debouncedSave]);

  // ============ Medical History Methods ============

  const addMedicalCondition = useCallback((condition) => {
    const newCondition = {
      condition: condition.condition || condition.name,
      diagnosedDate: condition.diagnosedDate || new Date().toISOString(),
      status: condition.status || 'active',
      notes: condition.notes || '',
      _id: condition._id || `temp-${Date.now()}`
    };

    updateSection('medicalHistory', [...history.medicalHistory, newCondition]);
  }, [history.medicalHistory, updateSection]);

  const updateMedicalCondition = useCallback((index, updates) => {
    const updated = [...history.medicalHistory];
    updated[index] = { ...updated[index], ...updates };
    updateSection('medicalHistory', updated);
  }, [history.medicalHistory, updateSection]);

  const removeMedicalCondition = useCallback((index) => {
    const updated = history.medicalHistory.filter((_, i) => i !== index);
    updateSection('medicalHistory', updated);
  }, [history.medicalHistory, updateSection]);

  // ============ Ocular History Methods ============

  const addOcularCondition = useCallback((condition) => {
    const newCondition = {
      condition: condition.condition || condition.name,
      eye: condition.eye || 'OU',
      diagnosedDate: condition.diagnosedDate || new Date().toISOString(),
      status: condition.status || 'active',
      surgeries: condition.surgeries || [],
      notes: condition.notes || '',
      _id: condition._id || `temp-${Date.now()}`
    };

    updateSection('ocularHistory', [...history.ocularHistory, newCondition]);
  }, [history.ocularHistory, updateSection]);

  const updateOcularCondition = useCallback((index, updates) => {
    const updated = [...history.ocularHistory];
    updated[index] = { ...updated[index], ...updates };
    updateSection('ocularHistory', updated);
  }, [history.ocularHistory, updateSection]);

  const removeOcularCondition = useCallback((index) => {
    const updated = history.ocularHistory.filter((_, i) => i !== index);
    updateSection('ocularHistory', updated);
  }, [history.ocularHistory, updateSection]);

  // ============ Family History Methods ============

  const addFamilyHistory = useCallback((entry) => {
    const newEntry = {
      relation: entry.relation,
      condition: entry.condition,
      isOcularCondition: entry.isOcularCondition || false,
      specificEyeCondition: entry.specificEyeCondition,
      ageAtDiagnosis: entry.ageAtDiagnosis,
      notes: entry.notes || '',
      _id: entry._id || `temp-${Date.now()}`
    };

    updateSection('familyHistory', [...history.familyHistory, newEntry]);
  }, [history.familyHistory, updateSection]);

  const updateFamilyHistory = useCallback((index, updates) => {
    const updated = [...history.familyHistory];
    updated[index] = { ...updated[index], ...updates };
    updateSection('familyHistory', updated);
  }, [history.familyHistory, updateSection]);

  const removeFamilyHistory = useCallback((index) => {
    const updated = history.familyHistory.filter((_, i) => i !== index);
    updateSection('familyHistory', updated);
  }, [history.familyHistory, updateSection]);

  // ============ Allergy Methods ============

  const addAllergy = useCallback((allergy) => {
    const newAllergy = {
      allergen: allergy.allergen || allergy.name,
      type: allergy.type || 'drug',
      reaction: allergy.reaction || '',
      severity: allergy.severity || 'moderate',
      verified: allergy.verified || false,
      _id: allergy._id || `temp-${Date.now()}`
    };

    updateSection('allergies', [...history.allergies, newAllergy]);
  }, [history.allergies, updateSection]);

  const updateAllergy = useCallback((index, updates) => {
    const updated = [...history.allergies];
    updated[index] = { ...updated[index], ...updates };
    updateSection('allergies', updated);
  }, [history.allergies, updateSection]);

  const removeAllergy = useCallback((index) => {
    const updated = history.allergies.filter((_, i) => i !== index);
    updateSection('allergies', updated);
  }, [history.allergies, updateSection]);

  // ============ Medication Methods ============

  const addMedication = useCallback((medication) => {
    const newMedication = {
      name: medication.name || medication.medication,
      dose: medication.dose || '',
      frequency: medication.frequency || '',
      route: medication.route || 'oral',
      startDate: medication.startDate,
      forEyes: medication.forEyes || false,
      eye: medication.eye,
      prescribedBy: medication.prescribedBy || '',
      _id: medication._id || `temp-${Date.now()}`
    };

    updateSection('medications', [...history.medications, newMedication]);
  }, [history.medications, updateSection]);

  const updateMedication = useCallback((index, updates) => {
    const updated = [...history.medications];
    updated[index] = { ...updated[index], ...updates };
    updateSection('medications', updated);
  }, [history.medications, updateSection]);

  const removeMedication = useCallback((index) => {
    const updated = history.medications.filter((_, i) => i !== index);
    updateSection('medications', updated);
  }, [history.medications, updateSection]);

  // ============ Social History Methods ============

  const updateSocialHistory = useCallback((updates) => {
    updateSection('socialHistory', {
      ...history.socialHistory,
      ...updates
    });
  }, [history.socialHistory, updateSection]);

  // ============ Pediatric Methods ============

  const updatePediatric = useCallback((updates) => {
    updateSection('pediatric', {
      ...history.pediatric,
      ...updates
    });
  }, [history.pediatric, updateSection]);

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Context value
  const value = {
    // State
    history,
    loading,
    error,
    isDirty,
    isSaving,
    lastSaved,
    patientId,

    // Actions
    loadHistory,
    saveHistory,
    updateSection,

    // Medical History
    addMedicalCondition,
    updateMedicalCondition,
    removeMedicalCondition,

    // Ocular History
    addOcularCondition,
    updateOcularCondition,
    removeOcularCondition,

    // Family History
    addFamilyHistory,
    updateFamilyHistory,
    removeFamilyHistory,

    // Allergies
    addAllergy,
    updateAllergy,
    removeAllergy,

    // Medications
    addMedication,
    updateMedication,
    removeMedication,

    // Social History
    updateSocialHistory,

    // Pediatric
    updatePediatric
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
}

// Default values when not in provider (for error boundary recovery)
const defaultHistoryContext = {
  history: [],
  loading: false,
  error: null,
  loadHistory: () => Promise.resolve(),
  clearHistory: () => {},
  addEntry: () => {},
  categories: []
};

/**
 * Hook to access history context
 */
export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    console.warn('useHistory called outside HistoryProvider - using default values');
    return defaultHistoryContext;
  }
  return context;
}

export default HistoryContext;
