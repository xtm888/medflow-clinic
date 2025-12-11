import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules
vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} }))
  }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: {
    get: vi.fn((fn) => fn())
  }
}));

describe('labQCService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  describe('Offline Support - READ Operations', () => {
    it('should use offlineWrapper for getQCChartData', async () => {
      const labQCService = (await import('../../services/labQCService')).default;
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await labQCService.getQCChartData('GLU', 'normal', 30);
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getQCStatistics', async () => {
      const labQCService = (await import('../../services/labQCService')).default;
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await labQCService.getQCStatistics('GLU', '2024-01-01', '2024-01-31');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getQCFailures', async () => {
      const labQCService = (await import('../../services/labQCService')).default;
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await labQCService.getQCFailures();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getAutoVerificationRules', async () => {
      const labQCService = (await import('../../services/labQCService')).default;
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await labQCService.getAutoVerificationRules();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getAutoVerificationStats', async () => {
      const labQCService = (await import('../../services/labQCService')).default;
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await labQCService.getAutoVerificationStats('2024-01-01', '2024-01-31');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });

  describe('Online-Only Operations - Patient Safety', () => {
    it('should reject evaluateWestgardRules when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;

      await expect(labQCService.evaluateWestgardRules([1, 2], 1.5, 0.5))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject processQCRun when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;

      await expect(labQCService.processQCRun('GLU', 'normal', 100, 'LOT001', 'INST001'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject processAutoVerification when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;

      await expect(labQCService.processAutoVerification({ testCode: 'GLU', value: 100 }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject checkCriticalValue when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;

      await expect(labQCService.checkCriticalValue('GLU', 500, 'mg/dL'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject calculateDeltaCheck when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;

      await expect(labQCService.calculateDeltaCheck('GLU', 120, 100, '2024-01-01'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject batchAutoVerify when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;

      await expect(labQCService.batchAutoVerify([], []))
        .rejects.toThrow(/connexion internet/);
    });
  });

  describe('Helper Methods', () => {
    it('should have preCacheForShift helper', async () => {
      const labQCService = (await import('../../services/labQCService')).default;
      expect(labQCService.preCacheForShift).toBeDefined();
    });

    it('should return 0 cached when offline in preCacheForShift', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;

      const result = await labQCService.preCacheForShift();
      expect(result.cached).toBe(0);
    });

    it('should cache data when online in preCacheForShift', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      const labQCService = (await import('../../services/labQCService')).default;
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      offlineWrapper.get.mockResolvedValue({ some: 'data' });

      const result = await labQCService.preCacheForShift();
      expect(result.cached).toBe(2);
    });
  });
});
