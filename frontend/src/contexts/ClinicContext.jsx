import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { getMyClinics } from '../services/clinicService';
import { useAuth } from './AuthContext';
import clinicSyncService from '../services/clinicSyncService';
// CRITICAL: Import reset actions to clear Redux state on clinic switch
import { resetPatientState } from '../store/slices/patientSlice';
import { resetBillingState } from '../store/slices/billingSlice';
import { resetPrescriptionState } from '../store/slices/prescriptionSlice';
import { resetQueueState } from '../store/slices/queueSlice';

const ClinicContext = createContext(null);

// Local storage key for persisting selected clinic
const STORAGE_KEY = 'medflow_selected_clinic';

export function ClinicProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const dispatch = useDispatch();

  // Available clinics for this user
  const [clinics, setClinics] = useState([]);
  // Currently selected clinic (null = "All Clinics" for admins)
  const [selectedClinic, setSelectedClinic] = useState(null);
  // User's primary clinic
  const [primaryClinic, setPrimaryClinic] = useState(null);
  // Can view all clinics (admin/manager)
  const [canViewAllClinics, setCanViewAllClinics] = useState(false);
  // Loading state
  const [loading, setLoading] = useState(true);
  // Error state
  const [error, setError] = useState(null);
  // Sync Progress Modal state (Gap 6)
  const [showSyncProgress, setShowSyncProgress] = useState(false);

  // Load clinics when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadClinics();
    } else {
      // Reset state on logout
      setClinics([]);
      setSelectedClinic(null);
      setPrimaryClinic(null);
      setCanViewAllClinics(false);
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadClinics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getMyClinics();
      // Handle standard API response format: { success, data: { clinics, primaryClinic, accessAllClinics } }
      // OR cached data format: { success, data: { ... } }
      const responseData = response.data?.data || response.data || response;
      const { clinics: userClinics, primaryClinic: userPrimary, accessAllClinics } = responseData;

      setClinics(userClinics || []);
      setPrimaryClinic(userPrimary);
      setCanViewAllClinics(accessAllClinics || false);

      // Restore previously selected clinic from localStorage
      const savedClinicId = localStorage.getItem(STORAGE_KEY);

      if (savedClinicId && savedClinicId !== 'all') {
        // Find the saved clinic in available clinics
        const savedClinic = userClinics?.find(c => c._id === savedClinicId || c.clinicId === savedClinicId);
        if (savedClinic) {
          setSelectedClinic(savedClinic);
          clinicSyncService.setActiveClinic(savedClinic._id || savedClinic.clinicId);
        } else if (accessAllClinics) {
          // Admin: default to "All Clinics"
          setSelectedClinic(null);
          clinicSyncService.setActiveClinic(null);
        } else if (userPrimary) {
          setSelectedClinic(userPrimary);
          clinicSyncService.setActiveClinic(userPrimary._id || userPrimary.clinicId);
        } else if (userClinics?.length > 0) {
          setSelectedClinic(userClinics[0]);
          clinicSyncService.setActiveClinic(userClinics[0]._id || userClinics[0].clinicId);
        }
      } else if (savedClinicId === 'all' && accessAllClinics) {
        // "All Clinics" was selected
        setSelectedClinic(null);
        clinicSyncService.setActiveClinic(null);
      } else if (accessAllClinics) {
        // Admin without saved selection: default to "All Clinics"
        setSelectedClinic(null);
        clinicSyncService.setActiveClinic(null);
      } else if (userPrimary) {
        // Non-admin: default to primary clinic
        setSelectedClinic(userPrimary);
        clinicSyncService.setActiveClinic(userPrimary._id || userPrimary.clinicId);
      } else if (userClinics?.length > 0) {
        // Default to first clinic
        setSelectedClinic(userClinics[0]);
        clinicSyncService.setActiveClinic(userClinics[0]._id || userClinics[0].clinicId);
      }

    } catch (err) {
      console.error('Error loading clinics:', err);
      setError('Failed to load clinics');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to clear all Redux state on clinic switch
  const clearReduxStateOnClinicSwitch = useCallback(() => {
    console.log('🧹 Clearing Redux state for clinic switch');
    dispatch(resetPatientState());
    dispatch(resetBillingState());
    dispatch(resetPrescriptionState());
    dispatch(resetQueueState());
  }, [dispatch]);

  // Select a clinic
  const selectClinic = useCallback(async (clinic) => {
    console.log('🏥 ClinicContext - Selecting clinic:', clinic);

    // Get previous clinic ID for cleanup (Gap 7)
    const previousClinicId = selectedClinic?._id || selectedClinic?.clinicId;

    if (clinic === null && canViewAllClinics) {
      // Select "All Clinics"
      console.log('✅ Setting to All Clinics');

      // CRITICAL: Clear Redux state when switching to "All Clinics"
      if (previousClinicId) {
        clearReduxStateOnClinicSwitch();
      }

      setSelectedClinic(null);
      localStorage.setItem(STORAGE_KEY, 'all');
      // Clear active clinic for sync service (Gap 1)
      clinicSyncService.setActiveClinic(null);
    } else if (clinic) {
      const clinicId = clinic._id || clinic.clinicId;
      console.log('✅ Setting clinic ID:', clinicId, 'Name:', clinic.name);

      // Clear previous clinic data if switching clinics (Gap 7)
      if (previousClinicId && previousClinicId !== clinicId) {
        console.log('🧹 Clearing cached data for previous clinic:', previousClinicId);

        // CRITICAL: Clear Redux state to prevent data leakage between clinics
        clearReduxStateOnClinicSwitch();

        try {
          await clinicSyncService.clearClinicData(previousClinicId);
        } catch (err) {
          console.error('Failed to clear previous clinic data:', err);
        }
      }

      setSelectedClinic(clinic);
      localStorage.setItem(STORAGE_KEY, clinicId);
      // Set active clinic for offline sync (Gap 1)
      clinicSyncService.setActiveClinic(clinicId);
    }
  }, [canViewAllClinics, selectedClinic, clearReduxStateOnClinicSwitch]);

  // Select clinic by ID
  const selectClinicById = useCallback((clinicId) => {
    if (clinicId === 'all' && canViewAllClinics) {
      selectClinic(null);
    } else {
      const clinic = clinics.find(c => c._id === clinicId || c.clinicId === clinicId);
      if (clinic) {
        selectClinic(clinic);
      }
    }
  }, [clinics, canViewAllClinics, selectClinic]);

  // Get query params for API calls based on selected clinic
  const getClinicQueryParams = useCallback(() => {
    if (selectedClinic) {
      return { clinicId: selectedClinic._id || selectedClinic.clinicId };
    }
    // null = all clinics (no filter)
    return {};
  }, [selectedClinic]);

  // Check if user has access to a specific clinic
  const hasAccessToClinic = useCallback((clinicId) => {
    if (canViewAllClinics) return true;
    return clinics.some(c => c._id === clinicId || c.clinicId === clinicId);
  }, [clinics, canViewAllClinics]);

  // Refresh clinics
  const refreshClinics = useCallback(() => {
    if (isAuthenticated) {
      loadClinics();
    }
  }, [isAuthenticated]);

  const value = {
    // State
    clinics,
    selectedClinic,
    primaryClinic,
    canViewAllClinics,
    loading,
    error,

    // Actions
    selectClinic,
    selectClinicById,
    refreshClinics,

    // Helpers
    getClinicQueryParams,
    hasAccessToClinic,

    // Sync Progress Modal (Gap 6)
    showSyncProgress,
    toggleSyncProgress: () => setShowSyncProgress(prev => !prev),
    openSyncProgress: () => setShowSyncProgress(true),
    closeSyncProgress: () => setShowSyncProgress(false),

    // Computed
    isAllClinicsSelected: selectedClinic === null && canViewAllClinics,
    selectedClinicId: selectedClinic?._id || selectedClinic?.clinicId || null,
    selectedClinicName: selectedClinic?.name || (canViewAllClinics ? 'All Clinics' : 'No Clinic'),
    hasSingleClinic: clinics.length === 1 && !canViewAllClinics,
    hasMultipleClinics: clinics.length > 1 || canViewAllClinics
  };

  return (
    <ClinicContext.Provider value={value}>
      {children}
    </ClinicContext.Provider>
  );
}

ClinicProvider.propTypes = {
  children: PropTypes.node.isRequired
};

// Default values when not in provider (for error boundary recovery)
const defaultClinicContext = {
  clinics: [],
  selectedClinic: null,
  primaryClinic: null,
  canViewAllClinics: false,
  loading: false,
  error: null,
  selectClinic: () => {},
  refreshClinics: () => Promise.resolve(),
  getClinicHeader: () => null,
  isClinicSelected: false,
  selectedClinicId: null
};

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) {
    // Return default values instead of throwing - allows error boundary recovery
    console.warn('useClinic called outside ClinicProvider - using default values');
    return defaultClinicContext;
  }
  return context;
}

export default ClinicContext;
