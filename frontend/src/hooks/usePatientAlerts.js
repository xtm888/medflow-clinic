/**
 * usePatientAlerts - Hook for managing patient alerts
 *
 * StudioVision Parity: Real-time patient safety alert management
 *
 * Features:
 * - Load patient-specific alerts
 * - Dismiss and acknowledge alerts
 * - Auto-generate alerts from allergies/overdue visits
 * - Real-time updates via WebSocket (when available)
 *
 * Usage:
 * const {
 *   alerts, allergies, loading, error,
 *   dismissAlert, acknowledgeAlert, refreshAlerts
 * } = usePatientAlerts(patientId);
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import patientService from '../services/patientService';

// Alert type priorities
const ALERT_PRIORITIES = {
  allergy: 100,
  urgent: 90,
  warning: 70,
  overdue_followup: 65,
  lab_result: 60,
  reminder: 50,
  success: 30,
  info: 20
};

/**
 * Main hook for patient alerts
 */
export default function usePatientAlerts(patientId, options = {}) {
  const {
    autoLoad = true,
    includeAllergies = true,
    includeDerived = true, // Auto-generate from overdue visits, etc.
    refreshInterval = 0 // 0 = no auto-refresh
  } = options;

  // State
  const [alerts, setAlerts] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const refreshTimerRef = useRef(null);

  // Load alerts
  const loadAlerts = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      // Load patient data with alerts
      const patient = await patientService.getPatient(patientId);

      if (mountedRef.current) {
        // Set allergies
        if (includeAllergies) {
          setAllergies(patient?.medicalHistory?.allergies || patient?.allergies || []);
        }

        // Set alerts
        const patientAlerts = patient?.patientAlerts || [];

        // Filter out dismissed/expired
        const activeAlerts = patientAlerts.filter(alert => {
          if (alert.dismissedAt) return false;
          if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) return false;
          return true;
        });

        setAlerts(activeAlerts);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [patientId, includeAllergies]);

  // Load on mount and when patientId changes
  useEffect(() => {
    mountedRef.current = true;

    if (autoLoad && patientId) {
      loadAlerts();
    }

    // Setup refresh interval if specified
    if (refreshInterval > 0 && patientId) {
      refreshTimerRef.current = setInterval(loadAlerts, refreshInterval);
    }

    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [patientId, autoLoad, loadAlerts, refreshInterval]);

  // Dismiss alert
  const dismissAlert = useCallback(async (alertId) => {
    if (!patientId) return;

    try {
      await patientService.dismissPatientAlert(patientId, alertId);

      // Optimistic update
      setAlerts(prev => prev.filter(a => a._id !== alertId));

      return true;
    } catch (err) {
      setError(err.message);
      // Reload to sync state
      await loadAlerts();
      return false;
    }
  }, [patientId, loadAlerts]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId) => {
    if (!patientId) return;

    try {
      await patientService.acknowledgePatientAlert(patientId, alertId);

      // Optimistic update
      setAlerts(prev => prev.map(a =>
        a._id === alertId
          ? { ...a, acknowledgedAt: new Date().toISOString() }
          : a
      ));

      return true;
    } catch (err) {
      setError(err.message);
      await loadAlerts();
      return false;
    }
  }, [patientId, loadAlerts]);

  // Add new alert
  const addAlert = useCallback(async (alertData) => {
    if (!patientId) return;

    try {
      const result = await patientService.addPatientAlert(patientId, alertData);

      // Reload to get the new alert with ID
      await loadAlerts();

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [patientId, loadAlerts]);

  // Compute derived alerts (overdue follow-ups, etc.)
  const derivedAlerts = useMemo(() => {
    if (!includeDerived) return [];

    const derived = [];

    // Add logic for deriving alerts from patient data
    // This is a placeholder - actual implementation would check visit history, etc.

    return derived;
  }, [includeDerived]);

  // Combined alerts (manual + derived)
  const allAlerts = useMemo(() => {
    const combined = [...alerts, ...derivedAlerts];

    // Sort by priority
    return combined.sort((a, b) => {
      const priorityA = ALERT_PRIORITIES[a.type] || 0;
      const priorityB = ALERT_PRIORITIES[b.type] || 0;
      return priorityB - priorityA;
    });
  }, [alerts, derivedAlerts]);

  // Count by type
  const alertCounts = useMemo(() => {
    const counts = { total: allAlerts.length };
    allAlerts.forEach(alert => {
      counts[alert.type] = (counts[alert.type] || 0) + 1;
    });
    return counts;
  }, [allAlerts]);

  // Check if patient has critical alerts
  const hasCriticalAlerts = useMemo(() => {
    return allAlerts.some(a =>
      a.type === 'allergy' ||
      a.type === 'urgent' ||
      (a.type === 'warning' && a.priority >= 80)
    );
  }, [allAlerts]);

  // Get highest priority alert
  const mostCriticalAlert = useMemo(() => {
    return allAlerts[0] || null;
  }, [allAlerts]);

  return {
    // Data
    alerts: allAlerts,
    allergies,
    alertCounts,
    hasCriticalAlerts,
    mostCriticalAlert,

    // State
    loading,
    error,

    // Actions
    loadAlerts,
    refreshAlerts: loadAlerts,
    dismissAlert,
    acknowledgeAlert,
    addAlert,

    // Helpers
    clearError: () => setError(null)
  };
}

/**
 * useAllergyAlerts - Simplified hook for just allergies
 */
export function useAllergyAlerts(allergies = []) {
  // Sort allergies by severity
  const sortedAllergies = useMemo(() => {
    return [...allergies].sort((a, b) => {
      const severityOrder = { severe: 0, moderate: 1, mild: 2 };
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });
  }, [allergies]);

  // Check if has severe allergies
  const hasSevereAllergies = useMemo(() => {
    return allergies.some(a => a.severity === 'severe');
  }, [allergies]);

  // Get allergen names
  const allergenNames = useMemo(() => {
    return allergies.map(a => a.allergen || a.name).filter(Boolean);
  }, [allergies]);

  return {
    allergies: sortedAllergies,
    hasSevereAllergies,
    allergenNames,
    count: allergies.length
  };
}

/**
 * useAlertNotifications - Hook for showing toast notifications for new alerts
 */
export function useAlertNotifications(alerts = [], toast) {
  const previousAlertsRef = useRef([]);

  useEffect(() => {
    if (!toast) return;

    // Find new alerts
    const previousIds = new Set(previousAlertsRef.current.map(a => a._id));
    const newAlerts = alerts.filter(a => !previousIds.has(a._id));

    // Show toast for critical new alerts
    newAlerts.forEach(alert => {
      if (alert.type === 'allergy' || alert.type === 'urgent') {
        toast({
          title: alert.type === 'allergy' ? 'Allergie' : 'Alerte urgente',
          description: alert.messageFr || alert.message,
          status: 'error',
          duration: 10000,
          isClosable: true,
          position: 'top'
        });
      }
    });

    previousAlertsRef.current = alerts;
  }, [alerts, toast]);
}

/**
 * Generate standard alerts from patient data
 */
export function generatePatientAlerts(patient) {
  const alerts = [];
  const now = new Date();

  // Overdue follow-ups
  if (patient?.lastVisit) {
    const lastVisitDate = new Date(patient.lastVisit);
    const daysSinceVisit = Math.floor((now - lastVisitDate) / (1000 * 60 * 60 * 24));

    // Over 1 year since last visit
    if (daysSinceVisit > 365) {
      alerts.push({
        type: 'overdue_followup',
        sourceType: 'visit_history',
        message: `Last visit was ${Math.floor(daysSinceVisit / 30)} months ago`,
        messageFr: `Dernière visite il y a ${Math.floor(daysSinceVisit / 30)} mois`,
        priority: ALERT_PRIORITIES.overdue_followup,
        autoGenerated: true
      });
    }
  }

  // Pending lab results
  if (patient?.pendingLabResults?.length > 0) {
    alerts.push({
      type: 'lab_result',
      sourceType: 'lab_order',
      message: `${patient.pendingLabResults.length} pending lab result(s)`,
      messageFr: `${patient.pendingLabResults.length} résultat(s) de labo en attente`,
      priority: ALERT_PRIORITIES.lab_result,
      autoGenerated: true
    });
  }

  // Chronic conditions requiring monitoring
  if (patient?.medicalHistory?.conditions) {
    const chronicConditions = ['glaucoma', 'diabetic_retinopathy', 'macular_degeneration'];
    const patientConditions = patient.medicalHistory.conditions.filter(c =>
      chronicConditions.some(cc => c.condition?.toLowerCase().includes(cc))
    );

    if (patientConditions.length > 0) {
      alerts.push({
        type: 'reminder',
        sourceType: 'chronic_condition',
        message: 'Patient has chronic conditions requiring monitoring',
        messageFr: 'Patient avec pathologies chroniques à surveiller',
        priority: ALERT_PRIORITIES.reminder + 10,
        autoGenerated: true
      });
    }
  }

  return alerts;
}
