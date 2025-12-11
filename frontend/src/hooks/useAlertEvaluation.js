/**
 * useAlertEvaluation Hook
 *
 * Manages clinical alert evaluation, fetching, and state management
 * for the ophthalmology workflow.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/apiConfig';
import { shallowEqual } from '../utils/performance';

/**
 * Hook for managing clinical alerts in the exam workflow
 * @param {string} patientId - Patient ID
 * @param {string} examId - Current exam ID (optional)
 * @param {Object} options - Configuration options
 */
export function useAlertEvaluation(patientId, examId, options = {}) {
  const {
    autoEvaluate = true,
    evaluationDelay = 1000,  // Debounce delay for auto-evaluation
    fetchOnMount = true
  } = options;

  // State
  const [alerts, setAlerts] = useState([]);
  const [alertCounts, setAlertCounts] = useState({
    EMERGENCY: 0,
    URGENT: 0,
    WARNING: 0,
    INFO: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState(null);
  const [hasBlockingAlerts, setHasBlockingAlerts] = useState(false);
  const [lastEvaluated, setLastEvaluated] = useState(null);

  // Refs for debouncing
  const evaluationTimeoutRef = useRef(null);
  const lastExamDataRef = useRef(null);

  /**
   * Fetch existing alerts for the patient
   */
  const fetchAlerts = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/clinical-alerts/patient/${patientId}`);
      const data = response.data?.data || {};

      setAlerts(data.alerts || []);
      setHasBlockingAlerts(data.hasEmergency || false);

      // Update counts
      if (data.grouped) {
        setAlertCounts({
          EMERGENCY: data.grouped.EMERGENCY?.length || 0,
          URGENT: data.grouped.URGENT?.length || 0,
          WARNING: data.grouped.WARNING?.length || 0,
          INFO: data.grouped.INFO?.length || 0,
          total: data.total || 0
        });
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  /**
   * Fetch alert counts only (lighter request)
   */
  const fetchAlertCounts = useCallback(async () => {
    if (!patientId) return;

    try {
      const response = await api.get(`/clinical-alerts/patient/${patientId}/counts`);
      const data = response.data?.data || {};
      setAlertCounts(data);
      setHasBlockingAlerts(data.EMERGENCY > 0);
    } catch (err) {
      console.error('Error fetching alert counts:', err);
    }
  }, [patientId]);

  /**
   * Evaluate alerts for current exam data
   */
  const evaluateAlerts = useCallback(async (examData) => {
    if (!examId) return;

    setEvaluating(true);
    setError(null);

    try {
      const response = await api.post(`/clinical-alerts/exam/${examId}/evaluate`, {
        examData
      });

      const data = response.data?.data || {};

      setAlerts(data.allAlerts || []);
      setHasBlockingAlerts(data.hasBlockingAlerts || false);
      setLastEvaluated(new Date());

      // Update counts
      const grouped = {
        EMERGENCY: (data.allAlerts || []).filter(a => a.severity === 'EMERGENCY').length,
        URGENT: (data.allAlerts || []).filter(a => a.severity === 'URGENT').length,
        WARNING: (data.allAlerts || []).filter(a => a.severity === 'WARNING').length,
        INFO: (data.allAlerts || []).filter(a => a.severity === 'INFO').length,
        total: (data.allAlerts || []).length
      };
      setAlertCounts(grouped);

      return data;
    } catch (err) {
      console.error('Error evaluating alerts:', err);
      setError('Failed to evaluate alerts');
      throw err;
    } finally {
      setEvaluating(false);
    }
  }, [examId]);

  /**
   * Debounced evaluation triggered by exam data changes
   */
  const debouncedEvaluate = useCallback((examData) => {
    // Skip if data hasn't changed meaningfully (shallow compare is faster than JSON.stringify)
    if (shallowEqual(examData, lastExamDataRef.current)) {
      return;
    }
    lastExamDataRef.current = examData;

    // Clear existing timeout
    if (evaluationTimeoutRef.current) {
      clearTimeout(evaluationTimeoutRef.current);
    }

    // Set new timeout
    evaluationTimeoutRef.current = setTimeout(() => {
      if (autoEvaluate && examId) {
        evaluateAlerts(examData);
      }
    }, evaluationDelay);
  }, [autoEvaluate, examId, evaluateAlerts, evaluationDelay]);

  /**
   * Acknowledge a single alert
   */
  const acknowledgeAlert = useCallback(async (alertId, reason = '') => {
    try {
      await api.post(`/clinical-alerts/${alertId}/acknowledge`, { reason });

      // Update local state
      setAlerts(prev => prev.map(a =>
        a._id === alertId
          ? { ...a, status: 'acknowledged', acknowledgedAt: new Date() }
          : a
      ));

      // Update counts
      const acknowledgedAlert = alerts.find(a => a._id === alertId);
      if (acknowledgedAlert?.severity === 'EMERGENCY') {
        const remainingEmergencies = alerts.filter(
          a => a._id !== alertId && a.severity === 'EMERGENCY' && a.status === 'active'
        );
        setHasBlockingAlerts(remainingEmergencies.length > 0);
      }

      await fetchAlertCounts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      throw err;
    }
  }, [alerts, fetchAlertCounts]);

  /**
   * Bulk acknowledge alerts
   */
  const bulkAcknowledge = useCallback(async (alertIds, reason = '') => {
    try {
      await api.post('/clinical-alerts/bulk-acknowledge', {
        alertIds,
        reason
      });

      // Update local state
      setAlerts(prev => prev.map(a =>
        alertIds.includes(a._id)
          ? { ...a, status: 'acknowledged', acknowledgedAt: new Date() }
          : a
      ));

      // Check remaining emergencies
      const remainingEmergencies = alerts.filter(
        a => !alertIds.includes(a._id) && a.severity === 'EMERGENCY' && a.status === 'active'
      );
      setHasBlockingAlerts(remainingEmergencies.length > 0);

      await fetchAlertCounts();
    } catch (err) {
      console.error('Error bulk acknowledging alerts:', err);
      throw err;
    }
  }, [alerts, fetchAlertCounts]);

  /**
   * Resolve an alert
   */
  const resolveAlert = useCallback(async (alertId, resolution = '') => {
    try {
      await api.post(`/clinical-alerts/${alertId}/resolve`, { resolution });

      // Remove from local state
      setAlerts(prev => prev.filter(a => a._id !== alertId));
      await fetchAlertCounts();
    } catch (err) {
      console.error('Error resolving alert:', err);
      throw err;
    }
  }, [fetchAlertCounts]);

  /**
   * Dismiss an alert
   */
  const dismissAlert = useCallback(async (alertId, reason = '') => {
    try {
      await api.post(`/clinical-alerts/${alertId}/dismiss`, { reason });

      // Remove from local state
      setAlerts(prev => prev.filter(a => a._id !== alertId));
      await fetchAlertCounts();
    } catch (err) {
      console.error('Error dismissing alert:', err);
      throw err;
    }
  }, [fetchAlertCounts]);

  /**
   * Complete a recommended action
   */
  const completeAction = useCallback(async (alertId, actionIndex) => {
    try {
      await api.post(`/clinical-alerts/${alertId}/complete-action`, { actionIndex });

      // Update local state
      setAlerts(prev => prev.map(a => {
        if (a._id !== alertId) return a;
        const updatedActions = [...a.recommendedActions];
        updatedActions[actionIndex] = {
          ...updatedActions[actionIndex],
          completed: true,
          completedAt: new Date()
        };
        return { ...a, recommendedActions: updatedActions };
      }));
    } catch (err) {
      console.error('Error completing action:', err);
      throw err;
    }
  }, []);

  /**
   * Escalate an alert
   */
  const escalateAlert = useCallback(async (alertId, toUserId, reason = '') => {
    try {
      await api.post(`/clinical-alerts/${alertId}/escalate`, {
        toUserId,
        reason
      });

      // Update local state
      setAlerts(prev => prev.map(a =>
        a._id === alertId
          ? { ...a, status: 'escalated', escalatedAt: new Date() }
          : a
      ));

      await fetchAlertCounts();
    } catch (err) {
      console.error('Error escalating alert:', err);
      throw err;
    }
  }, [fetchAlertCounts]);

  // Fetch alerts on mount
  useEffect(() => {
    if (fetchOnMount && patientId) {
      fetchAlerts();
    }
  }, [fetchOnMount, patientId, fetchAlerts]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current);
      }
    };
  }, []);

  // Helper: Get alerts by severity
  const getAlertsBySeverity = useCallback((severity) => {
    return alerts.filter(a => a.severity === severity && a.status === 'active');
  }, [alerts]);

  // Helper: Get alerts for current step (by trigger field)
  const getAlertsForStep = useCallback((stepId, fields = []) => {
    return alerts.filter(a => {
      if (a.status !== 'active') return false;
      // Match by trigger field
      if (fields.length > 0 && a.triggerField) {
        return fields.some(f => a.triggerField.includes(f));
      }
      return false;
    });
  }, [alerts]);

  return {
    // State
    alerts,
    alertCounts,
    loading,
    evaluating,
    error,
    hasBlockingAlerts,
    lastEvaluated,

    // Alert Lists
    emergencyAlerts: getAlertsBySeverity('EMERGENCY'),
    urgentAlerts: getAlertsBySeverity('URGENT'),
    warningAlerts: getAlertsBySeverity('WARNING'),
    infoAlerts: getAlertsBySeverity('INFO'),

    // Actions
    fetchAlerts,
    fetchAlertCounts,
    evaluateAlerts,
    debouncedEvaluate,
    acknowledgeAlert,
    bulkAcknowledge,
    resolveAlert,
    dismissAlert,
    completeAction,
    escalateAlert,

    // Helpers
    getAlertsBySeverity,
    getAlertsForStep
  };
}

export default useAlertEvaluation;
