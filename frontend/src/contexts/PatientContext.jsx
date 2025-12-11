import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import patientService from '../services/patientService';

const PatientContext = createContext({});

// Default values when not in provider (for error boundary recovery)
const defaultPatientContext = {
  selectedPatient: null,
  patientHistory: null,
  loading: false,
  isExpanded: true,
  loadPatient: () => Promise.resolve(),
  clearPatient: () => {},
  setIsExpanded: () => {}
};

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context || Object.keys(context).length === 0) {
    console.warn('usePatient called outside PatientProvider - using default values');
    return defaultPatientContext;
  }
  return context;
};

export const PatientProvider = ({ children }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Race condition prevention: track current load operation
  const currentLoadId = useRef(0);
  const abortControllerRef = useRef(null);

  // Load patient from localStorage on mount
  useEffect(() => {
    const savedPatientId = localStorage.getItem('selectedPatientId');
    if (savedPatientId) {
      loadPatientInternal(savedPatientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save selected patient ID to localStorage
  useEffect(() => {
    if (selectedPatient) {
      localStorage.setItem('selectedPatientId', selectedPatient._id || selectedPatient.id);
    } else {
      localStorage.removeItem('selectedPatientId');
    }
  }, [selectedPatient]);

  // Internal load function with race condition protection
  const loadPatientInternal = async (patientId) => {
    if (!patientId) return;

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Increment load ID to track this specific load operation
    const loadId = ++currentLoadId.current;

    try {
      setLoading(true);

      const response = await patientService.getPatient(patientId);

      // Check if this load is still current (no newer load started)
      if (loadId !== currentLoadId.current) {
        return; // Stale response, ignore
      }

      const patient = response.data || response;
      setSelectedPatient(patient);

      // Also load recent history (still check for staleness)
      await loadPatientHistoryInternal(patientId, loadId);
    } catch (error) {
      // Ignore aborted requests
      if (error.name === 'AbortError') return;

      // Only update state if this is still the current load
      if (loadId === currentLoadId.current) {
        console.error('Error loading patient:', error);
        setSelectedPatient(null);
        setPatientHistory(null);
      }
    } finally {
      // Only clear loading if this is still the current load
      if (loadId === currentLoadId.current) {
        setLoading(false);
      }
    }
  };

  const loadPatientHistoryInternal = async (patientId, loadId) => {
    try {
      // Load recent visits, prescriptions, etc.
      const [visitsRes, prescriptionsRes] = await Promise.all([
        patientService.getPatientVisits(patientId, { limit: 5 }).catch(() => ({ data: [] })),
        patientService.getPatientPrescriptions(patientId, { limit: 5 }).catch(() => ({ data: [] }))
      ]);

      // Check if this load is still current
      if (loadId !== currentLoadId.current) {
        return; // Stale response, ignore
      }

      setPatientHistory({
        recentVisits: visitsRes.data || visitsRes || [],
        recentPrescriptions: prescriptionsRes.data || prescriptionsRes || []
      });
    } catch (error) {
      // Only update state if this is still the current load
      if (loadId === currentLoadId.current) {
        console.error('Error loading patient history:', error);
        setPatientHistory(null);
      }
    }
  };

  const selectPatient = useCallback(async (patient) => {
    if (!patient) {
      clearPatient();
      return;
    }

    const patientId = patient._id || patient.id;

    // If it's just an ID, load full patient
    if (typeof patient === 'string') {
      await loadPatientInternal(patient);
    } else if (!patient.firstName && patientId) {
      // Partial patient object, load full details
      await loadPatientInternal(patientId);
    } else {
      // Full patient object - set immediately, then load history
      setSelectedPatient(patient);
      const loadId = ++currentLoadId.current;
      await loadPatientHistoryInternal(patientId, loadId);
    }
  }, []);

  const clearPatient = useCallback(() => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    currentLoadId.current++;

    setSelectedPatient(null);
    setPatientHistory(null);
    localStorage.removeItem('selectedPatientId');
  }, []);

  const refreshPatient = useCallback(async () => {
    if (selectedPatient) {
      const patientId = selectedPatient._id || selectedPatient.id;
      await loadPatientInternal(patientId);
    }
  }, [selectedPatient]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Calculate patient age
  const getPatientAge = useCallback(() => {
    if (!selectedPatient?.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(selectedPatient.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, [selectedPatient]);

  // Get patient display name
  const getPatientDisplayName = useCallback(() => {
    if (!selectedPatient) return '';
    return `${selectedPatient.firstName || ''} ${selectedPatient.lastName || ''}`.trim();
  }, [selectedPatient]);

  // Get patient initials
  const getPatientInitials = useCallback(() => {
    if (!selectedPatient) return '';
    const first = (selectedPatient.firstName || '?')[0];
    const last = (selectedPatient.lastName || '?')[0];
    return `${first}${last}`.toUpperCase();
  }, [selectedPatient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const value = {
    // State
    selectedPatient,
    patientHistory,
    loading,
    isExpanded,

    // Actions
    selectPatient,
    clearPatient,
    refreshPatient,
    toggleExpanded,

    // Helpers
    getPatientAge,
    getPatientDisplayName,
    getPatientInitials,

    // Direct state check
    hasPatient: !!selectedPatient
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};

export default PatientContext;
