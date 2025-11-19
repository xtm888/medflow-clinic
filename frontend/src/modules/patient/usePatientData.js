import { useState, useEffect, useCallback, useMemo } from 'react';
import patientService from '../../services/patientService';

/**
 * usePatientData - Centralized hook for patient data fetching
 *
 * Replaces duplicate fetching logic across:
 * - PatientDetail
 * - PatientVisit
 * - PatientTimeline
 * - Various clinical forms
 *
 * Features:
 * - Selective data loading
 * - Caching and refresh
 * - Error handling
 * - Loading states per section
 */
export default function usePatientData(patientId, options = {}) {
  const {
    // Which data sections to load
    loadProfile = true,
    loadHistory = false,
    loadVisits = false,
    loadAppointments = false,
    loadPrescriptions = false,
    loadTimeline = false,
    loadStatistics = false,
    loadMedicalIssues = false,
    loadProviders = false,
    // Auto-fetch on mount
    autoFetch = true,
    // Refetch interval in ms (0 = disabled)
    refetchInterval = 0
  } = options;

  // Main patient data
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [visits, setVisits] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [medicalIssues, setMedicalIssues] = useState([]);
  const [providers, setProviders] = useState([]);

  // Loading states per section
  const [loading, setLoading] = useState({
    profile: false,
    history: false,
    visits: false,
    appointments: false,
    prescriptions: false,
    timeline: false,
    statistics: false,
    medicalIssues: false,
    providers: false
  });

  // Error states per section
  const [errors, setErrors] = useState({
    profile: null,
    history: null,
    visits: null,
    appointments: null,
    prescriptions: null,
    timeline: null,
    statistics: null,
    medicalIssues: null,
    providers: null
  });

  // Helper to set loading state for a section
  const setLoadingState = useCallback((section, isLoading) => {
    setLoading(prev => ({ ...prev, [section]: isLoading }));
  }, []);

  // Helper to set error state for a section
  const setErrorState = useCallback((section, error) => {
    setErrors(prev => ({ ...prev, [section]: error }));
  }, []);

  // Fetch patient profile
  const fetchProfile = useCallback(async () => {
    if (!patientId) return;

    setLoadingState('profile', true);
    setErrorState('profile', null);

    try {
      const response = await patientService.getPatient(patientId);
      const data = response.data || response;
      setPatient(data);
      return data;
    } catch (error) {
      console.error('Error fetching patient profile:', error);
      setErrorState('profile', error.message || 'Failed to load patient');
      throw error;
    } finally {
      setLoadingState('profile', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch patient history
  const fetchHistory = useCallback(async () => {
    if (!patientId) return;

    setLoadingState('history', true);
    setErrorState('history', null);

    try {
      const response = await patientService.getPatientHistory(patientId);
      const data = response.data || response || [];
      setHistory(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Error fetching patient history:', error);
      setErrorState('history', error.message || 'Failed to load history');
      throw error;
    } finally {
      setLoadingState('history', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch patient visits
  const fetchVisits = useCallback(async () => {
    if (!patientId) return;

    setLoadingState('visits', true);
    setErrorState('visits', null);

    try {
      const response = await patientService.getPatientVisits(patientId);
      const data = response.data || response || [];
      setVisits(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Error fetching patient visits:', error);
      setErrorState('visits', error.message || 'Failed to load visits');
      throw error;
    } finally {
      setLoadingState('visits', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch patient appointments
  const fetchAppointments = useCallback(async () => {
    if (!patientId) return;

    setLoadingState('appointments', true);
    setErrorState('appointments', null);

    try {
      const response = await patientService.getPatientAppointments(patientId);
      const data = response.data || response || [];
      setAppointments(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      setErrorState('appointments', error.message || 'Failed to load appointments');
      throw error;
    } finally {
      setLoadingState('appointments', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch patient prescriptions
  const fetchPrescriptions = useCallback(async () => {
    if (!patientId) return;

    setLoadingState('prescriptions', true);
    setErrorState('prescriptions', null);

    try {
      const response = await patientService.getPatientPrescriptions(patientId);
      const data = response.data || response || [];
      setPrescriptions(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Error fetching patient prescriptions:', error);
      setErrorState('prescriptions', error.message || 'Failed to load prescriptions');
      throw error;
    } finally {
      setLoadingState('prescriptions', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch patient timeline
  const fetchTimeline = useCallback(async (params = {}) => {
    if (!patientId) return;

    setLoadingState('timeline', true);
    setErrorState('timeline', null);

    try {
      const response = await patientService.getPatientTimeline(patientId, params);
      const data = response.data || response || [];
      setTimeline(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Error fetching patient timeline:', error);
      setErrorState('timeline', error.message || 'Failed to load timeline');
      throw error;
    } finally {
      setLoadingState('timeline', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch patient statistics
  const fetchStatistics = useCallback(async () => {
    if (!patientId) return;

    setLoadingState('statistics', true);
    setErrorState('statistics', null);

    try {
      const response = await patientService.getPatientStatistics(patientId);
      const data = response.data || response;
      setStatistics(data);
      return data;
    } catch (error) {
      console.error('Error fetching patient statistics:', error);
      setErrorState('statistics', error.message || 'Failed to load statistics');
      throw error;
    } finally {
      setLoadingState('statistics', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch medical issues
  const fetchMedicalIssues = useCallback(async (params = {}) => {
    if (!patientId) return;

    setLoadingState('medicalIssues', true);
    setErrorState('medicalIssues', null);

    try {
      const response = await patientService.getMedicalIssues(patientId, params);
      const data = response.data || response || [];
      setMedicalIssues(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Error fetching medical issues:', error);
      setErrorState('medicalIssues', error.message || 'Failed to load medical issues');
      throw error;
    } finally {
      setLoadingState('medicalIssues', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    if (!patientId) return;

    setLoadingState('providers', true);
    setErrorState('providers', null);

    try {
      const response = await patientService.getPatientProviders(patientId);
      const data = response.data || response || [];
      setProviders(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Error fetching providers:', error);
      setErrorState('providers', error.message || 'Failed to load providers');
      throw error;
    } finally {
      setLoadingState('providers', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Fetch all requested data
  const fetchAll = useCallback(async () => {
    if (!patientId) return;

    const promises = [];

    if (loadProfile) promises.push(fetchProfile());
    if (loadHistory) promises.push(fetchHistory());
    if (loadVisits) promises.push(fetchVisits());
    if (loadAppointments) promises.push(fetchAppointments());
    if (loadPrescriptions) promises.push(fetchPrescriptions());
    if (loadTimeline) promises.push(fetchTimeline());
    if (loadStatistics) promises.push(fetchStatistics());
    if (loadMedicalIssues) promises.push(fetchMedicalIssues());
    if (loadProviders) promises.push(fetchProviders());

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    }
  }, [
    patientId,
    loadProfile, fetchProfile,
    loadHistory, fetchHistory,
    loadVisits, fetchVisits,
    loadAppointments, fetchAppointments,
    loadPrescriptions, fetchPrescriptions,
    loadTimeline, fetchTimeline,
    loadStatistics, fetchStatistics,
    loadMedicalIssues, fetchMedicalIssues,
    loadProviders, fetchProviders
  ]);

  // Refresh specific section or all
  const refresh = useCallback(async (section = null) => {
    if (section) {
      switch (section) {
        case 'profile': return fetchProfile();
        case 'history': return fetchHistory();
        case 'visits': return fetchVisits();
        case 'appointments': return fetchAppointments();
        case 'prescriptions': return fetchPrescriptions();
        case 'timeline': return fetchTimeline();
        case 'statistics': return fetchStatistics();
        case 'medicalIssues': return fetchMedicalIssues();
        case 'providers': return fetchProviders();
        default: return fetchAll();
      }
    }
    return fetchAll();
  }, [
    fetchProfile, fetchHistory, fetchVisits, fetchAppointments,
    fetchPrescriptions, fetchTimeline, fetchStatistics,
    fetchMedicalIssues, fetchProviders, fetchAll
  ]);

  // Update patient locally (optimistic update)
  const updatePatientLocal = useCallback((updates) => {
    setPatient(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  // Save patient to server
  const savePatient = useCallback(async (patientData) => {
    if (!patientId) return;

    setLoadingState('profile', true);
    setErrorState('profile', null);

    try {
      const response = await patientService.updatePatient(patientId, patientData);
      const data = response.data || response;
      setPatient(data);
      return data;
    } catch (error) {
      console.error('Error saving patient:', error);
      setErrorState('profile', error.message || 'Failed to save patient');
      throw error;
    } finally {
      setLoadingState('profile', false);
    }
  }, [patientId, setLoadingState, setErrorState]);

  // Computed values
  const isLoading = useMemo(() => {
    return Object.values(loading).some(Boolean);
  }, [loading]);

  const hasErrors = useMemo(() => {
    return Object.values(errors).some(Boolean);
  }, [errors]);

  const patientAge = useMemo(() => {
    if (!patient?.dateOfBirth) return null;
    const today = new Date();
    const birth = new Date(patient.dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, [patient?.dateOfBirth]);

  const patientFullName = useMemo(() => {
    if (!patient) return '';
    return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
  }, [patient]);

  const patientInitials = useMemo(() => {
    if (!patient) return '';
    return `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase();
  }, [patient]);

  // Auto-fetch on mount or when patientId changes
  useEffect(() => {
    if (autoFetch && patientId) {
      fetchAll();
    }
  }, [autoFetch, patientId, fetchAll]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval > 0 && patientId) {
      const interval = setInterval(fetchAll, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [refetchInterval, patientId, fetchAll]);

  // Clear data when patient changes
  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setHistory([]);
      setVisits([]);
      setAppointments([]);
      setPrescriptions([]);
      setTimeline([]);
      setStatistics(null);
      setMedicalIssues([]);
      setProviders([]);
    }
  }, [patientId]);

  return {
    // Main data
    patient,
    history,
    visits,
    appointments,
    prescriptions,
    timeline,
    statistics,
    medicalIssues,
    providers,

    // Loading and error states
    loading,
    errors,
    isLoading,
    hasErrors,

    // Computed values
    patientAge,
    patientFullName,
    patientInitials,

    // Actions
    fetchProfile,
    fetchHistory,
    fetchVisits,
    fetchAppointments,
    fetchPrescriptions,
    fetchTimeline,
    fetchStatistics,
    fetchMedicalIssues,
    fetchProviders,
    fetchAll,
    refresh,

    // Mutations
    updatePatientLocal,
    savePatient
  };
}

// Simplified hook for just patient profile
export function usePatientProfile(patientId, autoFetch = true) {
  return usePatientData(patientId, {
    loadProfile: true,
    autoFetch
  });
}

// Hook for patient with clinical data
export function usePatientClinical(patientId, autoFetch = true) {
  return usePatientData(patientId, {
    loadProfile: true,
    loadHistory: true,
    loadVisits: true,
    loadPrescriptions: true,
    loadMedicalIssues: true,
    autoFetch
  });
}

// Hook for patient timeline view
export function usePatientTimelineView(patientId, autoFetch = true) {
  return usePatientData(patientId, {
    loadProfile: true,
    loadTimeline: true,
    loadStatistics: true,
    autoFetch
  });
}
