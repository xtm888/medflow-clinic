import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../services/database', () => ({
  db: {
    syncQueue: { toArray: vi.fn(), put: vi.fn(), delete: vi.fn() },
    cacheMetadata: { get: vi.fn(), put: vi.fn() }
  }
}));

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}));

describe('syncService - Clinic-Specific Sync', () => {
  let syncService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh module
    const module = await import('../../services/syncService');
    syncService = module.default;
  });

  describe('CLINIC_SYNC_INTERVALS', () => {
    it('should export clinic sync interval configuration', async () => {
      const { CLINIC_SYNC_INTERVALS } = await import('../../services/syncService');
      expect(CLINIC_SYNC_INTERVALS).toBeDefined();
      expect(typeof CLINIC_SYNC_INTERVALS).toBe('object');
    });

    it('should have 5-min interval for main clinics', async () => {
      const { CLINIC_SYNC_INTERVALS } = await import('../../services/syncService');
      expect(CLINIC_SYNC_INTERVALS['DEPOT_CENTRAL']).toBe(300000);
      expect(CLINIC_SYNC_INTERVALS['TOMBALBAYE_KIN']).toBe(300000);
    });

    it('should have 10-min interval for satellite clinics', async () => {
      const { CLINIC_SYNC_INTERVALS } = await import('../../services/syncService');
      expect(CLINIC_SYNC_INTERVALS['MATRIX_KIN']).toBe(600000);
    });

    it('should have 30-min interval for Matadi (slow 3G/4G)', async () => {
      const { CLINIC_SYNC_INTERVALS } = await import('../../services/syncService');
      expect(CLINIC_SYNC_INTERVALS['MATADI_KC']).toBe(1800000);
    });
  });

  describe('SYNC_ENTITIES', () => {
    it('should export extended sync entities list', async () => {
      const { SYNC_ENTITIES } = await import('../../services/syncService');
      expect(SYNC_ENTITIES).toBeDefined();
      expect(Array.isArray(SYNC_ENTITIES)).toBe(true);
    });

    it('should include all 23 entity types (Phase 3.2)', async () => {
      const { SYNC_ENTITIES } = await import('../../services/syncService');
      expect(SYNC_ENTITIES.length).toBe(23);
    });

    it('should include new Phase 1 entities', async () => {
      const { SYNC_ENTITIES } = await import('../../services/syncService');
      expect(SYNC_ENTITIES).toContain('pharmacyInventory');
      expect(SYNC_ENTITIES).toContain('orthopticExams');
      expect(SYNC_ENTITIES).toContain('glassesOrders');
      expect(SYNC_ENTITIES).toContain('frameInventory');
      expect(SYNC_ENTITIES).toContain('contactLensInventory');
      expect(SYNC_ENTITIES).toContain('clinics');
      expect(SYNC_ENTITIES).toContain('approvals');
      expect(SYNC_ENTITIES).toContain('stockReconciliations');
    });

    it('should include Phase 3.2 clinical entities', async () => {
      const { SYNC_ENTITIES } = await import('../../services/syncService');
      expect(SYNC_ENTITIES).toContain('treatmentProtocols');
      expect(SYNC_ENTITIES).toContain('ivtVials');
      expect(SYNC_ENTITIES).toContain('surgeryCases');
      expect(SYNC_ENTITIES).toContain('consultationSessions');
      expect(SYNC_ENTITIES).toContain('devices');
    });

    it('should include original entities', async () => {
      const { SYNC_ENTITIES } = await import('../../services/syncService');
      expect(SYNC_ENTITIES).toContain('patients');
      expect(SYNC_ENTITIES).toContain('appointments');
      expect(SYNC_ENTITIES).toContain('visits');
      expect(SYNC_ENTITIES).toContain('prescriptions');
    });
  });

  describe('getSyncIntervalForClinic', () => {
    it('should return correct interval for known clinic', async () => {
      const { getSyncIntervalForClinic } = await import('../../services/syncService');
      expect(getSyncIntervalForClinic('MATADI_KC')).toBe(1800000);
    });

    it('should return default 15-min for unknown clinic', async () => {
      const { getSyncIntervalForClinic } = await import('../../services/syncService');
      expect(getSyncIntervalForClinic('UNKNOWN_CLINIC')).toBe(900000);
    });
  });
});
