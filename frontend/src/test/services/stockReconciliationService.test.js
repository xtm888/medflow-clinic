import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: { get: vi.fn(), mutate: vi.fn() }
}));

vi.mock('../../services/database', () => ({
  db: { stockReconciliations: { toArray: vi.fn(), get: vi.fn(), put: vi.fn() } }
}));

describe('stockReconciliationService', () => {
  let stockReconciliationService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    stockReconciliationService = (await import('../../services/stockReconciliationService')).default;
  });

  describe('Offline Support - Read Operations', () => {
    it('should use offlineWrapper for getAll', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await stockReconciliationService.getAll();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getById', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await stockReconciliationService.getById('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getVarianceReport', async () => {
      offlineWrapper.get.mockResolvedValue({ data: {} });
      await stockReconciliationService.getVarianceReport('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });

  describe('Offline Support - Count Operations', () => {
    it('should use offlineWrapper.mutate for addCount', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: {} });
      await stockReconciliationService.addCount('recon123', { itemId: 'item1', count: 50 });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'CREATE', 'stockReconciliations', expect.any(Object)
      );
    });

    it('should use offlineWrapper.mutate for bulkAddCounts', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: {} });
      await stockReconciliationService.bulkAddCounts('recon123', [{ itemId: 'i1', count: 10 }]);
      expect(offlineWrapper.mutate).toHaveBeenCalled();
    });
  });

  describe('Online Only Operations', () => {
    it('should throw when applying adjustments offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(stockReconciliationService.applyAdjustments('123', 'notes'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    it('should throw when completing reconciliation offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(stockReconciliationService.complete('123'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });
  });
});
