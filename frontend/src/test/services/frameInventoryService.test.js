import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing service
vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: {
    get: vi.fn((fn) => fn()),
    mutate: vi.fn((fn) => fn())
  }
}));

vi.mock('../../services/database', () => ({
  default: {
    frameInventory: {
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0))
    }
  }
}));

describe('frameInventoryService', () => {
  let frameInventoryService;
  let offlineWrapper;
  let api;
  let db;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set navigator.onLine to true by default
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    });

    // Import modules after mocks are set up
    const inventoryModule = await import('../../services/inventory/index.js');
    frameInventoryService = inventoryModule.frameInventoryService;

    const offlineModule = await import('../../services/offlineWrapper');
    offlineWrapper = offlineModule.default;

    const apiModule = await import('../../services/apiConfig');
    api = apiModule.default;

    const dbModule = await import('../../services/database');
    db = dbModule.default;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Offline Support - Read Operations', () => {
    it('should use offlineWrapper for getAll/getFrames', async () => {
      api.get.mockResolvedValue({ data: { data: [] } });
      offlineWrapper.get.mockResolvedValue({ data: [] });

      await frameInventoryService.getAll();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getById/getFrame', async () => {
      api.get.mockResolvedValue({ data: { id: '123' } });
      offlineWrapper.get.mockResolvedValue({ id: '123' });

      await frameInventoryService.getById('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for search with 10-min cache', async () => {
      api.get.mockResolvedValue({ data: [] });
      offlineWrapper.get.mockResolvedValue([]);

      await frameInventoryService.search('test');
      expect(offlineWrapper.get).toHaveBeenCalled();

      const callArgs = offlineWrapper.get.mock.calls[0];
      expect(callArgs[3].cacheExpiry).toBe(600); // 10 minutes
    });

    it('should use offlineWrapper for checkAvailability with 5-min cache', async () => {
      api.get.mockResolvedValue({ data: { available: true } });
      offlineWrapper.get.mockResolvedValue({ available: true });

      await frameInventoryService.checkAvailability('frame123', 5);
      expect(offlineWrapper.get).toHaveBeenCalled();

      const callArgs = offlineWrapper.get.mock.calls[0];
      expect(callArgs[3].cacheExpiry).toBe(300); // 5 minutes
    });

    it('should use offlineWrapper for getByCategory with 30-min cache', async () => {
      api.get.mockResolvedValue({ data: [] });
      offlineWrapper.get.mockResolvedValue([]);

      await frameInventoryService.getByCategory('designer');
      expect(offlineWrapper.get).toHaveBeenCalled();

      const callArgs = offlineWrapper.get.mock.calls[0];
      expect(callArgs[3].cacheExpiry).toBe(1800); // 30 minutes
    });

    it('should use offlineWrapper for getStats with 1-hour cache', async () => {
      api.get.mockResolvedValue({ data: {} });
      offlineWrapper.get.mockResolvedValue({});

      await frameInventoryService.getStats();
      expect(offlineWrapper.get).toHaveBeenCalled();

      const callArgs = offlineWrapper.get.mock.calls[0];
      expect(callArgs[3].cacheExpiry).toBe(3600); // 1 hour
    });

    it('should use offlineWrapper for getLowStock with 5-min cache', async () => {
      api.get.mockResolvedValue({ data: [] });
      offlineWrapper.get.mockResolvedValue([]);

      await frameInventoryService.getLowStock();
      expect(offlineWrapper.get).toHaveBeenCalled();

      const callArgs = offlineWrapper.get.mock.calls[0];
      expect(callArgs[3].cacheExpiry).toBe(300); // 5 minutes
    });

    it('should use offlineWrapper for getAlerts with 5-min cache', async () => {
      api.get.mockResolvedValue({ data: [] });
      offlineWrapper.get.mockResolvedValue([]);

      await frameInventoryService.getAlerts();
      expect(offlineWrapper.get).toHaveBeenCalled();

      const callArgs = offlineWrapper.get.mock.calls[0];
      expect(callArgs[3].cacheExpiry).toBe(300); // 5 minutes
    });

    it('should use offlineWrapper for getBrands with 1-hour cache', async () => {
      api.get.mockResolvedValue({ data: [] });
      offlineWrapper.get.mockResolvedValue([]);

      await frameInventoryService.getBrands();
      expect(offlineWrapper.get).toHaveBeenCalled();

      const callArgs = offlineWrapper.get.mock.calls[0];
      expect(callArgs[3].cacheExpiry).toBe(3600); // 1 hour
    });
  });

  describe('Online-Only Operations', () => {
    it('should reject create when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.create({ brand: 'Test' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject update when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.update('123', { brand: 'Test' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject delete when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.delete('123', 'test reason'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject addStock when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.addStock('123', { quantity: 5 }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject adjustStock when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.adjustStock('123', { quantity: -2, reason: 'test' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject reserveForOrder when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.reserveForOrder('123', { orderId: 'order123' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject releaseReservation when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.releaseReservation('123', 'res123'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject fulfillReservation when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.fulfillReservation('123', 'res123', {}))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject resolveAlert when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      await expect(frameInventoryService.resolveAlert('123', 'alert123'))
        .rejects.toThrow(/connexion internet/);
    });
  });

  describe('Offline Helpers', () => {
    it('should have preCacheForShift helper', () => {
      expect(frameInventoryService.preCacheForShift).toBeDefined();
      expect(typeof frameInventoryService.preCacheForShift).toBe('function');
    });

    it('should have searchFramesOffline helper', () => {
      expect(frameInventoryService.searchFramesOffline).toBeDefined();
      expect(typeof frameInventoryService.searchFramesOffline).toBe('function');
    });

    it('should have getCachedCount helper', () => {
      expect(frameInventoryService.getCachedCount).toBeDefined();
      expect(typeof frameInventoryService.getCachedCount).toBe('function');
    });

    it('should return 0 cached when offline in preCacheForShift', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      const result = await frameInventoryService.preCacheForShift('clinic123');
      expect(result.cached).toBe(0);
    });

    it('should search frames offline from IndexedDB', async () => {
      const mockFrames = [
        { id: '1', brand: 'RayBan', model: 'Aviator', sku: 'RB001' },
        { id: '2', brand: 'Oakley', model: 'Frogskins', sku: 'OK001' },
        { id: '3', brand: 'Gucci', model: 'GG0001S', sku: 'GU001' }
      ];
      db.frameInventory.toArray.mockResolvedValue(mockFrames);

      const results = await frameInventoryService.searchFramesOffline('rayban');
      expect(results).toHaveLength(1);
      expect(results[0].brand).toBe('RayBan');
    });

    it('should get cached frame count', async () => {
      db.frameInventory.count.mockResolvedValue(42);

      const count = await frameInventoryService.getCachedCount();
      expect(count).toBe(42);
      expect(db.frameInventory.count).toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility Aliases', () => {
    it('should support getFrames alias', async () => {
      api.get.mockResolvedValue({ data: { data: [] } });
      offlineWrapper.get.mockResolvedValue({ data: [] });

      await frameInventoryService.getFrames();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should support getFrame alias', async () => {
      api.get.mockResolvedValue({ data: { id: '123' } });
      offlineWrapper.get.mockResolvedValue({ id: '123' });

      await frameInventoryService.getFrame('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should support searchFrames alias', async () => {
      api.get.mockResolvedValue({ data: [] });
      offlineWrapper.get.mockResolvedValue([]);

      await frameInventoryService.searchFrames('test');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });
});
