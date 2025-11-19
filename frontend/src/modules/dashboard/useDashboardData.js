import { useState, useEffect, useCallback } from 'react';
import api from '../../services/apiConfig';

/**
 * useDashboardData - Hook for fetching dashboard statistics
 *
 * Centralizes dashboard data fetching used across:
 * - Dashboard page
 * - Individual widgets
 * - Reports
 */
export default function useDashboardData(options = {}) {
  const {
    autoFetch = true,
    refreshInterval = 0, // ms, 0 = disabled
    dateRange = 'today' // today, week, month, custom
  } = options;

  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [queue, setQueue] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch dashboard statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/dashboard/stats', {
        params: { range: dateRange }
      });
      setStats(response.data?.data || response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      // Return mock data for development
      setStats({
        totalPatients: 0,
        todayAppointments: 0,
        completedVisits: 0,
        pendingPrescriptions: 0,
        revenue: 0,
        newPatients: 0
      });
    }
  }, [dateRange]);

  // Fetch today's appointments
  const fetchAppointments = useCallback(async () => {
    try {
      const response = await api.get('/appointments', {
        params: {
          date: new Date().toISOString().split('T')[0],
          limit: 20
        }
      });
      const data = response.data?.data || response.data || [];
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setAppointments([]);
    }
  }, []);

  // Fetch queue status
  const fetchQueue = useCallback(async () => {
    try {
      const response = await api.get('/queue');
      const data = response.data?.data || response.data || [];
      setQueue(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching queue:', err);
      setQueue([]);
    }
  }, []);

  // Fetch recent patients
  const fetchRecentPatients = useCallback(async (limit = 10) => {
    try {
      const response = await api.get('/patients/recent', {
        params: { limit }
      });
      const data = response.data?.data || response.data || [];
      setRecentPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching recent patients:', err);
      setRecentPatients([]);
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await api.get('/alerts', {
        params: { status: 'active', limit: 10 }
      });
      const data = response.data?.data || response.data || [];
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setAlerts([]);
    }
  }, []);

  // Fetch all dashboard data
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.allSettled([
        fetchStats(),
        fetchAppointments(),
        fetchQueue(),
        fetchRecentPatients(),
        fetchAlerts()
      ]);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [fetchStats, fetchAppointments, fetchQueue, fetchRecentPatients, fetchAlerts]);

  // Refresh specific data
  const refresh = useCallback(async (dataType = null) => {
    switch (dataType) {
      case 'stats':
        return fetchStats();
      case 'appointments':
        return fetchAppointments();
      case 'queue':
        return fetchQueue();
      case 'patients':
        return fetchRecentPatients();
      case 'alerts':
        return fetchAlerts();
      default:
        return fetchAll();
    }
  }, [fetchStats, fetchAppointments, fetchQueue, fetchRecentPatients, fetchAlerts, fetchAll]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchAll();
    }
  }, [autoFetch, fetchAll]);

  // Refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchAll, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchAll]);

  return {
    // Data
    stats,
    appointments,
    queue,
    recentPatients,
    alerts,

    // State
    loading,
    error,

    // Actions
    fetchStats,
    fetchAppointments,
    fetchQueue,
    fetchRecentPatients,
    fetchAlerts,
    fetchAll,
    refresh
  };
}

// Specialized hooks for specific widgets
export function useQueueData(options = {}) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/queue');
      const data = response.data?.data || response.data || [];
      setQueue(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching queue:', err);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { queue, loading, refresh: fetch };
}

export function useAppointmentsData(date = new Date()) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/appointments', {
        params: {
          date: date.toISOString().split('T')[0],
          limit: 50
        }
      });
      const data = response.data?.data || response.data || [];
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { appointments, loading, refresh: fetch };
}
