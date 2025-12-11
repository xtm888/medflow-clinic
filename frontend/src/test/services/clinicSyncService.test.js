import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; })
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock database
vi.mock('../../services/database', () => ({
  db: {
    pharmacyInventory: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn(() => Promise.resolve()),
          count: vi.fn(() => Promise.resolve(10))
        }))
      })),
      count: vi.fn(() => Promise.resolve(10)),
      bulkPut: vi.fn(() => Promise.resolve())
    },
    patients: {
      count: vi.fn(() => Promise.resolve(50)),
      bulkPut: vi.fn(() => Promise.resolve())
    },
    visits: {
      count: vi.fn(() => Promise.resolve(25)),
      bulkPut: vi.fn(() => Promise.resolve())
    },
    orthopticExams: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn(() => Promise.resolve()),
          count: vi.fn(() => Promise.resolve(5))
        }))
      }))
    },
    glassesOrders: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn(() => Promise.resolve()),
          count: vi.fn(() => Promise.resolve(3))
        }))
      }))
    },
    frameInventory: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn(() => Promise.resolve()),
          count: vi.fn(() => Promise.resolve(8))
        }))
      }))
    },
    contactLensInventory: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn(() => Promise.resolve()),
          count: vi.fn(() => Promise.resolve(12))
        }))
      }))
    },
    approvals: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn(() => Promise.resolve()),
          count: vi.fn(() => Promise.resolve(7))
        }))
      }))
    },
    stockReconciliations: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          delete: vi.fn(() => Promise.resolve()),
          count: vi.fn(() => Promise.resolve(4))
        }))
      }))
    },
    prescriptions: {
      count: vi.fn(() => Promise.resolve(30))
    },
    appointments: {
      count: vi.fn(() => Promise.resolve(15))
    }
  }
}));

// Mock API
vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] }))
  }
}));

// Mock syncService
vi.mock('../../services/syncService', () => ({
  CLINIC_SYNC_INTERVALS: {
    'DEPOT_CENTRAL': 300000,
    'MATADI_KC': 1800000
  },
  SYNC_ENTITIES: ['patients', 'visits'],
  getSyncIntervalForClinic: vi.fn((id) => id === 'MATADI_KC' ? 1800000 : 300000)
}));

describe('clinicSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('setActiveClinic', () => {
    it('should set active clinic in localStorage', async () => {
      const { setActiveClinic, getActiveClinic } = await import('../../services/clinicSyncService');

      setActiveClinic('DEPOT_CENTRAL');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('medflow_active_clinic_id', 'DEPOT_CENTRAL');
      expect(getActiveClinic()).toBe('DEPOT_CENTRAL');
    });
  });

  describe('getLastSyncTime', () => {
    it('should return null if no sync recorded', async () => {
      const { getLastSyncTime } = await import('../../services/clinicSyncService');

      const result = getLastSyncTime('DEPOT_CENTRAL');
      expect(result).toBeNull();
    });

    it('should return last sync time from localStorage', async () => {
      const { getLastSyncTime, setLastSyncTime } = await import('../../services/clinicSyncService');
      const now = new Date().toISOString();
      localStorageMock.store['medflow_last_sync'] = JSON.stringify({ 'DEPOT_CENTRAL': now });

      const result = getLastSyncTime('DEPOT_CENTRAL');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('isDataStale', () => {
    it('should return true if no sync recorded', async () => {
      const { isDataStale } = await import('../../services/clinicSyncService');

      expect(isDataStale('DEPOT_CENTRAL')).toBe(true);
    });

    it('should return false if recently synced', async () => {
      const { isDataStale } = await import('../../services/clinicSyncService');
      const recentSync = new Date().toISOString();
      localStorageMock.store['medflow_last_sync'] = JSON.stringify({ 'DEPOT_CENTRAL': recentSync });

      expect(isDataStale('DEPOT_CENTRAL')).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    it('should return current sync status', async () => {
      const { getSyncStatus, setActiveClinic } = await import('../../services/clinicSyncService');
      setActiveClinic('MATADI_KC');

      const status = getSyncStatus();

      expect(status.clinicId).toBe('MATADI_KC');
      expect(status.syncInterval).toBe(1800000); // 30 min for Matadi
      expect(status).toHaveProperty('isStale');
      expect(status).toHaveProperty('syncInProgress');
    });
  });

  describe('getClinicStorageStats', () => {
    it('should return storage statistics for clinic', async () => {
      const { getClinicStorageStats } = await import('../../services/clinicSyncService');

      const stats = await getClinicStorageStats('DEPOT_CENTRAL');

      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('byEntity');
    });
  });

  describe('pullClinicData', () => {
    it('should sync entities for clinic', async () => {
      const { pullClinicData, setActiveClinic } = await import('../../services/clinicSyncService');
      const api = (await import('../../services/apiConfig')).default;
      api.get.mockResolvedValue({ data: [{ id: '1' }] });

      setActiveClinic('DEPOT_CENTRAL');

      const result = await pullClinicData('DEPOT_CENTRAL', ['patients']);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('synced');
      expect(api.get).toHaveBeenCalledWith('/sync/patients', expect.any(Object));
    });

    it('should call progress callback during sync', async () => {
      const { pullClinicData } = await import('../../services/clinicSyncService');
      const api = (await import('../../services/apiConfig')).default;
      api.get.mockResolvedValue({ data: [] });

      const onProgress = vi.fn();
      await pullClinicData('DEPOT_CENTRAL', ['patients', 'visits'], onProgress);

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        current: expect.any(Number),
        total: 2,
        entity: expect.any(String),
        percent: expect.any(Number)
      }));
    });
  });

  describe('subscribeSyncStatus', () => {
    it('should allow subscribing to sync status changes', async () => {
      const { subscribeSyncStatus, notifySyncStatusChange } = await import('../../services/clinicSyncService');

      const callback = vi.fn();
      const unsubscribe = subscribeSyncStatus(callback);

      notifySyncStatusChange();

      expect(callback).toHaveBeenCalled();

      unsubscribe();
      callback.mockClear();
      notifySyncStatusChange();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
