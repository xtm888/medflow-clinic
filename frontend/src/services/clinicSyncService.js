/**
 * Clinic-Aware Sync Service
 * Manages clinic-scoped data synchronization for multi-clinic offline support
 */
import { db } from './database';
import api from './apiConfig';
import { CLINIC_SYNC_INTERVALS, SYNC_ENTITIES, getSyncIntervalForClinic } from './syncService';

// Local storage keys
const ACTIVE_CLINIC_KEY = 'medflow_active_clinic_id';
const LAST_SYNC_KEY = 'medflow_last_sync';
const SYNC_STATUS_KEY = 'medflow_sync_status';

/**
 * Clinic sync status tracking
 */
const clinicSyncStatus = {
  currentClinicId: null,
  lastSyncTime: null,
  syncInProgress: false,
  entitiesSynced: [],
  errors: []
};

/**
 * Set the active clinic for offline operations
 * @param {string} clinicId - The clinic ID
 */
export const setActiveClinic = (clinicId) => {
  clinicSyncStatus.currentClinicId = clinicId;
  localStorage.setItem(ACTIVE_CLINIC_KEY, clinicId);
  console.log(`[ClinicSync] Active clinic set to: ${clinicId}`);
};

/**
 * Get the active clinic for offline operations
 * @returns {string|null} The active clinic ID
 */
export const getActiveClinic = () => {
  return clinicSyncStatus.currentClinicId || localStorage.getItem(ACTIVE_CLINIC_KEY);
};

/**
 * Get last sync time for a clinic
 * @param {string} clinicId - The clinic ID
 * @returns {Date|null} Last sync timestamp
 */
export const getLastSyncTime = (clinicId) => {
  try {
    const syncData = JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || '{}');
    return syncData[clinicId] ? new Date(syncData[clinicId]) : null;
  } catch {
    return null;
  }
};

/**
 * Set last sync time for a clinic
 * @param {string} clinicId - The clinic ID
 */
export const setLastSyncTime = (clinicId) => {
  try {
    const syncData = JSON.parse(localStorage.getItem(LAST_SYNC_KEY) || '{}');
    syncData[clinicId] = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(syncData));
  } catch (error) {
    console.error('[ClinicSync] Failed to save sync time:', error);
  }
};

/**
 * Check if data is stale for a clinic
 * @param {string} clinicId - The clinic ID
 * @returns {boolean} True if data needs refresh
 */
export const isDataStale = (clinicId) => {
  const lastSync = getLastSyncTime(clinicId);
  if (!lastSync) return true;

  const interval = getSyncIntervalForClinic(clinicId);
  const staleThreshold = interval * 2; // Consider stale if 2x sync interval has passed
  const elapsed = Date.now() - lastSync.getTime();

  return elapsed > staleThreshold;
};

/**
 * Get sync status for UI display
 * @returns {Object} Current sync status
 */
export const getSyncStatus = () => {
  const clinicId = getActiveClinic();
  const lastSync = getLastSyncTime(clinicId);
  const interval = getSyncIntervalForClinic(clinicId);

  return {
    clinicId,
    lastSyncTime: lastSync,
    syncInterval: interval,
    isStale: isDataStale(clinicId),
    syncInProgress: clinicSyncStatus.syncInProgress,
    nextSyncIn: lastSync ? Math.max(0, interval - (Date.now() - lastSync.getTime())) : 0,
    entitiesSynced: clinicSyncStatus.entitiesSynced,
    errors: clinicSyncStatus.errors
  };
};

/**
 * Clear clinic data from IndexedDB
 * Useful when switching clinics or logging out
 * CRITICAL: Must clear BOTH clinic-specific stores AND global stores filtered by clinicId
 * to prevent data leakage between clinics
 * @param {string} clinicId - The clinic ID to clear
 */
export const clearClinicData = async (clinicId) => {
  if (!clinicId) {
    console.warn('[ClinicSync] No clinicId provided to clearClinicData');
    return;
  }

  // Stores that are explicitly clinic-scoped
  const clinicScopedStores = [
    'pharmacyInventory',
    'orthopticExams',
    'glassesOrders',
    'frameInventory',
    'contactLensInventory',
    'approvals',
    'stockReconciliations',
    'treatmentProtocols',
    'ivtVials',
    'surgeryCases'
  ];

  // CRITICAL: Global stores that have clinicId index - must also be cleared by clinicId
  // to prevent cross-clinic data leakage (Gap 3 fix)
  const globalStoresWithClinicId = [
    'appointments',
    'queue',
    'visits',
    'prescriptions',
    'ophthalmologyExams',
    'labOrders',
    'labResults',
    'invoices',
    'devices',
    'consultationSessions'
  ];

  let clearedCount = 0;

  // Clear clinic-scoped stores
  for (const store of clinicScopedStores) {
    try {
      if (db[store]) {
        const count = await db[store].where('clinicId').equals(clinicId).delete();
        clearedCount += count;
      }
    } catch (error) {
      console.error(`[ClinicSync] Failed to clear ${store}:`, error);
    }
  }

  // CRITICAL: Clear global stores filtered by clinicId
  for (const store of globalStoresWithClinicId) {
    try {
      if (db[store]) {
        const count = await db[store].where('clinicId').equals(clinicId).delete();
        clearedCount += count;
      }
    } catch (error) {
      // Some stores might not have clinicId index in older schema versions
      console.warn(`[ClinicSync] Could not filter ${store} by clinicId:`, error.message);
    }
  }

  console.log(`[ClinicSync] Cleared ${clearedCount} records for clinic: ${clinicId}`);
};

/**
 * Get storage usage for a clinic
 * @param {string} clinicId - The clinic ID
 * @returns {Object} Storage statistics
 */
export const getClinicStorageStats = async (clinicId) => {
  const stats = {
    totalRecords: 0,
    byEntity: {}
  };

  const clinicScopedStores = [
    'pharmacyInventory',
    'orthopticExams',
    'glassesOrders',
    'frameInventory',
    'contactLensInventory',
    'approvals',
    'stockReconciliations'
  ];

  for (const store of clinicScopedStores) {
    try {
      if (db[store]) {
        const count = await db[store].where('clinicId').equals(clinicId).count();
        stats.byEntity[store] = count;
        stats.totalRecords += count;
      }
    } catch {
      stats.byEntity[store] = 0;
    }
  }

  // Add non-clinic-scoped entities
  const globalStores = ['patients', 'visits', 'prescriptions', 'appointments'];
  for (const store of globalStores) {
    try {
      if (db[store]) {
        const count = await db[store].count();
        stats.byEntity[store] = count;
        stats.totalRecords += count;
      }
    } catch {
      stats.byEntity[store] = 0;
    }
  }

  return stats;
};

/**
 * Pull clinic-scoped data from server
 * @param {string} clinicId - The clinic ID
 * @param {Array} entities - Entities to sync (defaults to SYNC_ENTITIES)
 * @param {Function} onProgress - Progress callback
 * @returns {Object} Sync result
 */
export const pullClinicData = async (clinicId, entities = SYNC_ENTITIES, onProgress = null) => {
  if (clinicSyncStatus.syncInProgress) {
    throw new Error('Sync already in progress');
  }

  clinicSyncStatus.syncInProgress = true;
  clinicSyncStatus.entitiesSynced = [];
  clinicSyncStatus.errors = [];

  const results = {
    success: true,
    synced: 0,
    failed: 0,
    entities: {}
  };

  try {
    const lastSync = getLastSyncTime(clinicId);
    const since = lastSync ? lastSync.toISOString() : null;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: entities.length,
          entity,
          percent: Math.round(((i + 1) / entities.length) * 100)
        });
      }

      try {
        const response = await api.get(`/sync/${entity}`, {
          params: { clinicId, since }
        });

        const data = response.data?.data || response.data || [];
        const count = Array.isArray(data) ? data.length : 0;

        if (count > 0 && db[entity]) {
          await db[entity].bulkPut(data);
        }

        results.entities[entity] = { success: true, count };
        results.synced += count;
        clinicSyncStatus.entitiesSynced.push(entity);

      } catch (error) {
        console.error(`[ClinicSync] Failed to sync ${entity}:`, error);
        results.entities[entity] = { success: false, error: error.message };
        results.failed++;
        clinicSyncStatus.errors.push({ entity, error: error.message });
      }
    }

    setLastSyncTime(clinicId);
    results.success = results.failed === 0;

  } finally {
    clinicSyncStatus.syncInProgress = false;
  }

  return results;
};

/**
 * Subscribe to sync status changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
const listeners = new Set();

export const subscribeSyncStatus = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const notifySyncStatusChange = () => {
  const status = getSyncStatus();
  listeners.forEach(cb => cb(status));
};

export default {
  setActiveClinic,
  getActiveClinic,
  getLastSyncTime,
  setLastSyncTime,
  isDataStale,
  getSyncStatus,
  clearClinicData,
  getClinicStorageStats,
  pullClinicData,
  subscribeSyncStatus,
  notifySyncStatusChange
};
