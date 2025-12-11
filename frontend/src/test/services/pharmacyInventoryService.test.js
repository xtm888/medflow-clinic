import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: { get: vi.fn(), mutate: vi.fn() }
}));

vi.mock('../../services/database', () => ({
  db: { pharmacyInventory: { toArray: vi.fn(), get: vi.fn(), put: vi.fn() } }
}));

describe('pharmacyInventoryService', () => {
  let pharmacyInventoryService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    pharmacyInventoryService = (await import('../../services/pharmacyInventoryService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getAll', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await pharmacyInventoryService.getAll();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getById', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await pharmacyInventoryService.getById('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for search', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await pharmacyInventoryService.search('paracetamol');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getLowStock', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await pharmacyInventoryService.getLowStock();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache pharmacy stats for 1 hour', async () => {
      offlineWrapper.get.mockResolvedValue({ data: {} });
      await pharmacyInventoryService.getStats();
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'pharmacyInventory',
        'stats',
        expect.objectContaining({ cacheExpiry: 3600 })
      );
    });

    it('should use offlineWrapper.mutate for create', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await pharmacyInventoryService.create({ name: 'Test' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'CREATE', 'pharmacyInventory', expect.any(Object)
      );
    });
  });

  describe('Dispensing - Online Only', () => {
    it('should throw when dispensing offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(pharmacyInventoryService.dispense('123', { quantity: 1 }))
        .rejects.toThrow('Dispensing requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });
  });
});
