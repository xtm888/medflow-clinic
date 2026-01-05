import { useState, useEffect, useCallback, useRef } from 'react';
import consultationSessionService from '../../services/consultationSessionService';
import patientService from '../../services/patientService';
import { useClinic } from '../../contexts/ClinicContext';

/**
 * useClinicalSession - Hook for managing clinical consultation sessions
 *
 * Handles:
 * - Session creation and resumption
 * - Auto-recovery from localStorage
 * - Step data persistence
 * - Session status management
 */
export default function useClinicalSession(options = {}) {
  const {
    patientId,
    visitId,
    appointmentId,
    workflowType = 'ophthalmology',
    autoCreate = true,
    autoResume = true
  } = options;

  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [isDraft, setIsDraft] = useState(false);
  const sessionRef = useRef(null);

  // Get clinic context for auto-selecting patient's home clinic
  const { isAllClinicsSelected, selectClinicById, clinics } = useClinic();

  // LocalStorage key for draft recovery
  const draftKey = patientId
    ? `clinical_session_draft_${patientId}_${workflowType}`
    : null;

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    if (!draftKey) return null;

    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        // Check if draft is recent (within 24 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
        // Remove stale draft
        localStorage.removeItem(draftKey);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
    return null;
  }, [draftKey]);

  // Save draft to localStorage
  const saveDraft = useCallback((data) => {
    if (!draftKey) return;

    try {
      localStorage.setItem(draftKey, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
      setIsDraft(true);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [draftKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (!draftKey) return;

    try {
      localStorage.removeItem(draftKey);
      setIsDraft(false);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [draftKey]);

  // Auto-select patient's home clinic when in "All Clinics" mode
  const ensureClinicContext = useCallback(async () => {
    if (!isAllClinicsSelected || !patientId) {
      return true; // Already have a clinic selected or no patient
    }

    try {
      console.log('[useClinicalSession] In All Clinics mode, fetching patient homeClinic...');
      const response = await patientService.getPatient(patientId);
      const patient = response.data || response;

      if (patient?.homeClinic) {
        const homeClinicId = patient.homeClinic._id || patient.homeClinic;
        console.log('[useClinicalSession] Auto-selecting patient homeClinic:', homeClinicId);

        // Check if clinic exists in available clinics
        const clinicExists = clinics.some(c => c._id === homeClinicId || c.clinicId === homeClinicId);
        if (clinicExists) {
          selectClinicById(homeClinicId);
          // Small delay to let localStorage update propagate to API interceptor
          await new Promise(resolve => setTimeout(resolve, 100));
          return true;
        }
      }

      // If patient has no homeClinic and there are available clinics, use the first one
      if (clinics.length > 0) {
        console.log('[useClinicalSession] Patient has no homeClinic, using first available clinic:', clinics[0].name);
        selectClinicById(clinics[0]._id);
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      }

      console.warn('[useClinicalSession] No clinic available to select');
      return false;
    } catch (error) {
      console.error('[useClinicalSession] Error fetching patient for clinic context:', error);
      return false;
    }
  }, [isAllClinicsSelected, patientId, clinics, selectClinicById]);

  // Create new session
  const createSession = useCallback(async (initialData = {}) => {
    if (!patientId) return null;

    setSessionLoading(true);
    setSessionError(null);

    try {
      // Ensure clinic context before creating session
      const hasClinic = await ensureClinicContext();
      if (!hasClinic) {
        throw new Error('Veuillez sélectionner une clinique avant de démarrer la consultation.');
      }

      const response = await consultationSessionService.createSession({
        patient: patientId,
        visit: visitId,
        appointment: appointmentId,
        workflowType,
        ...initialData
      });

      const newSession = response.data || response;
      setSession(newSession);
      sessionRef.current = newSession;
      return newSession;
    } catch (error) {
      console.error('Error creating session:', error);
      setSessionError(error.message || 'Failed to create session');
      throw error;
    } finally {
      setSessionLoading(false);
    }
  }, [patientId, visitId, workflowType, ensureClinicContext]);

  // Load existing session
  const loadSession = useCallback(async (sessionId) => {
    setSessionLoading(true);
    setSessionError(null);

    try {
      const response = await consultationSessionService.getSession(sessionId);
      const loadedSession = response.data || response;
      setSession(loadedSession);
      sessionRef.current = loadedSession;
      return loadedSession;
    } catch (error) {
      console.error('Error loading session:', error);
      setSessionError(error.message || 'Failed to load session');
      throw error;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // Find active session for patient
  const findActiveSession = useCallback(async () => {
    if (!patientId) return null;

    setSessionLoading(true);
    setSessionError(null);

    try {
      const response = await consultationSessionService.getActiveSession(patientId, workflowType);
      const activeSession = response.data || response;

      // Only set session if it has a valid _id - empty objects should not count as sessions
      if (activeSession && activeSession._id) {
        setSession(activeSession);
        sessionRef.current = activeSession;
        return activeSession;
      }
      return null;
    } catch (error) {
      // No active session is not an error
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error finding active session:', error);
      setSessionError(error.message || 'Failed to find session');
      throw error;
    } finally {
      setSessionLoading(false);
    }
  }, [patientId, workflowType]);

  // Update session data
  const updateSession = useCallback(async (data, isAutoSave = false) => {
    if (!session?._id) {
      // Save to draft if no session
      saveDraft(data);
      return;
    }

    try {
      const response = await consultationSessionService.updateSession(
        session._id,
        data,
        isAutoSave
      );

      const updatedSession = response.data || response;
      setSession(updatedSession);
      sessionRef.current = updatedSession;

      // Clear draft on successful save
      if (!isAutoSave) {
        clearDraft();
      }

      return updatedSession;
    } catch (error) {
      console.error('Error updating session:', error);
      // Save to draft on failure
      saveDraft(data);
      throw error;
    }
  }, [session?._id, saveDraft, clearDraft]);

  // Save specific step data
  const saveStep = useCallback(async (stepId, stepData, options = {}) => {
    if (!session?._id) {
      // Save to draft
      const draftData = loadDraft() || {};
      draftData[stepId] = stepData;
      saveDraft(draftData);
      return;
    }

    const updateData = {
      [`stepData.${stepId}`]: stepData
    };

    return updateSession(updateData, options.isAutoSave);
  }, [session?._id, loadDraft, saveDraft, updateSession]);

  // Save all step data at once
  const saveAll = useCallback(async (allStepData) => {
    if (!session?._id) {
      saveDraft(allStepData);
      return;
    }

    return updateSession({ stepData: allStepData }, false);
  }, [session?._id, saveDraft, updateSession]);

  // Complete session
  const completeSession = useCallback(async (finalData = {}) => {
    if (!session?._id) {
      console.error('Cannot complete session: No session ID found', { session, finalData });
      throw new Error('No active session to complete. Please create a session first.');
    }

    setSessionLoading(true);

    try {
      console.log('Completing session:', session._id, finalData);
      const response = await consultationSessionService.completeSession(
        session._id,
        finalData
      );

      const completedSession = response.data || response;
      console.log('Session completed successfully:', completedSession);
      setSession(completedSession);
      sessionRef.current = completedSession;

      // Clear draft
      clearDraft();

      return completedSession;
    } catch (error) {
      console.error('Error completing session:', error);
      throw error;
    } finally {
      setSessionLoading(false);
    }
  }, [session?._id, clearDraft]);

  // Cancel session
  const cancelSession = useCallback(async () => {
    if (!session?._id) {
      clearDraft();
      return;
    }

    setSessionLoading(true);

    try {
      await consultationSessionService.abandonSession(session._id);
      setSession(null);
      sessionRef.current = null;
      clearDraft();
    } catch (error) {
      console.error('Error canceling session:', error);
      throw error;
    } finally {
      setSessionLoading(false);
    }
  }, [session?._id, clearDraft]);

  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      console.log('[useClinicalSession] Initializing session for patientId:', patientId);

      if (!patientId) {
        console.warn('[useClinicalSession] No patientId, skipping initialization');
        return;
      }

      // Try to find active session
      if (autoResume) {
        console.log('[useClinicalSession] Looking for active session...');
        const activeSession = await findActiveSession();
        console.log('[useClinicalSession] findActiveSession returned:', activeSession);
        if (activeSession && activeSession._id) {
          console.log('[useClinicalSession] Found active session:', activeSession._id);
          return;
        }
        console.log('[useClinicalSession] No active session found');
      }

      // Check for draft
      const draft = loadDraft();
      if (draft) {
        console.log('[useClinicalSession] Found draft data');
        setIsDraft(true);
        // Could show UI to ask user if they want to restore
      }

      // Auto-create new session
      if (autoCreate && !session) {
        console.log('[useClinicalSession] Auto-creating new session...');
        try {
          const newSession = await createSession();
          console.log('[useClinicalSession] Session created successfully:', newSession?._id);
        } catch (error) {
          console.error('[useClinicalSession] Failed to create session:', error);
        }
      } else {
        console.log('[useClinicalSession] Not creating session - autoCreate:', autoCreate, 'session:', session?._id);
      }
    };

    initializeSession();
  }, [patientId, autoResume, autoCreate, findActiveSession, loadDraft, createSession, session]);

  return {
    // Session data
    session,
    sessionId: session?._id,
    stepData: session?.stepData || {},

    // State
    sessionLoading,
    sessionError,
    isDraft,

    // Session actions
    createSession,
    loadSession,
    findActiveSession,
    updateSession,
    completeSession,
    cancelSession,

    // Step actions
    saveStep,
    saveAll,

    // Draft actions
    loadDraft,
    saveDraft,
    clearDraft
  };
}
