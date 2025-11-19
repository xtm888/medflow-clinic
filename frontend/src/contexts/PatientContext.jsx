import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import patientService from '../services/patientService';

const PatientContext = createContext({});

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
};

export const PatientProvider = ({ children }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Load patient from localStorage on mount
  useEffect(() => {
    const savedPatientId = localStorage.getItem('selectedPatientId');
    if (savedPatientId) {
      loadPatient(savedPatientId);
    }
  }, []);

  // Save selected patient ID to localStorage
  useEffect(() => {
    if (selectedPatient) {
      localStorage.setItem('selectedPatientId', selectedPatient._id || selectedPatient.id);
    } else {
      localStorage.removeItem('selectedPatientId');
    }
  }, [selectedPatient]);

  const loadPatient = async (patientId) => {
    if (!patientId) return;

    try {
      setLoading(true);
      const response = await patientService.getPatient(patientId);
      const patient = response.data || response;
      setSelectedPatient(patient);

      // Also load recent history
      await loadPatientHistory(patientId);
    } catch (error) {
      console.error('Error loading patient:', error);
      setSelectedPatient(null);
      setPatientHistory(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientHistory = async (patientId) => {
    try {
      // Load recent visits, prescriptions, etc.
      const [visitsRes, prescriptionsRes] = await Promise.all([
        patientService.getPatientVisits(patientId, { limit: 5 }).catch(() => ({ data: [] })),
        patientService.getPatientPrescriptions(patientId, { limit: 5 }).catch(() => ({ data: [] }))
      ]);

      setPatientHistory({
        recentVisits: visitsRes.data || visitsRes || [],
        recentPrescriptions: prescriptionsRes.data || prescriptionsRes || []
      });
    } catch (error) {
      console.error('Error loading patient history:', error);
      setPatientHistory(null);
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
      await loadPatient(patient);
    } else if (!patient.firstName && patientId) {
      // Partial patient object, load full details
      await loadPatient(patientId);
    } else {
      // Full patient object
      setSelectedPatient(patient);
      await loadPatientHistory(patientId);
    }
  }, []);

  const clearPatient = useCallback(() => {
    setSelectedPatient(null);
    setPatientHistory(null);
    localStorage.removeItem('selectedPatientId');
  }, []);

  const refreshPatient = useCallback(async () => {
    if (selectedPatient) {
      const patientId = selectedPatient._id || selectedPatient.id;
      await loadPatient(patientId);
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
