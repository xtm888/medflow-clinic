/**
 * PreCacheManager - Handles offline data pre-caching
 *
 * This component runs after authentication to pre-cache critical data
 * for offline use. It runs silently in the background.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import queueService from '../services/queueService';
import patientService from '../services/patientService';
import appointmentService from '../services/appointmentService';
import prescriptionService from '../services/prescriptionService';
import databaseService from '../services/database';

const PreCacheManager = () => {
  const { user, isAuthenticated } = useAuth();
  const hasCached = useRef(false);

  useEffect(() => {
    const preCacheData = async () => {
      // Only run once per session, when authenticated and online
      if (!isAuthenticated || !navigator.onLine || hasCached.current) {
        return;
      }

      hasCached.current = true;

      try {
        // Initialize database
        await databaseService.init();

        console.log('[PreCacheManager] Starting data pre-cache for offline use...');

        // Run all pre-cache operations in parallel
        const results = await Promise.allSettled([
          // Critical: Today's queue (most important for clinic operations)
          queueService.preCacheTodaysQueue().catch(e => {
            console.warn('[PreCacheManager] Queue pre-cache failed:', e.message);
            return { success: false };
          }),

          // Important: Recent patients (frequently accessed)
          patientService.preCachePatients({ limit: 100 }).catch(e => {
            console.warn('[PreCacheManager] Patient pre-cache failed:', e.message);
            return { success: false };
          }),

          // Important: Upcoming appointments (next 7 days)
          appointmentService.preCacheAppointments({ days: 7 }).catch(e => {
            console.warn('[PreCacheManager] Appointment pre-cache failed:', e.message);
            return { success: false };
          }),

          // Lower priority: Recent prescriptions
          prescriptionService.preCachePrescriptions({ limit: 50 }).catch(e => {
            console.warn('[PreCacheManager] Prescription pre-cache failed:', e.message);
            return { success: false };
          })
        ]);

        // Log summary
        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        console.log(`[PreCacheManager] Pre-cache complete. ${successful}/${results.length} operations successful.`);

        // Store last pre-cache time
        await databaseService.setSetting('lastPreCache', new Date().toISOString());
        await databaseService.setSetting('preCacheUser', user?.id || 'unknown');

      } catch (error) {
        console.error('[PreCacheManager] Pre-cache failed:', error);
        // Reset flag to allow retry on next render
        hasCached.current = false;
      }
    };

    // Small delay to let the app render first
    const timeoutId = setTimeout(preCacheData, 2000);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, user]);

  // Also trigger pre-cache when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      if (!isAuthenticated) return;

      console.log('[PreCacheManager] Connection restored, syncing data...');

      try {
        // Re-cache queue data (most critical for real-time)
        await queueService.preCacheTodaysQueue();
        console.log('[PreCacheManager] Queue data refreshed after reconnection');
      } catch (error) {
        console.warn('[PreCacheManager] Post-reconnect sync failed:', error.message);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated]);

  // This component renders nothing - it's purely for side effects
  return null;
};

export default PreCacheManager;
