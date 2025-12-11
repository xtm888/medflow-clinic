import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before importing service
vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} }))
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
    contactLensInventory: {
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0))
    }
  }
}));

describe('contactLensInventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    });
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getAll/getLenses', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getAll();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getById', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getById('test-id');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for search', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.search('Acuvue');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getExpiring', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getExpiring(90);
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for findMatchingLens', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.findMatchingLens({ brand: 'Acuvue' });
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getProductLines', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getProductLines('Acuvue');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getStats', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getStats();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getLowStock', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getLowStock();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getAlerts', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getAlerts();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getBrands', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;

      await contactLensInventoryService.getBrands();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should reject markBatchExpired when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.markBatchExpired('123', 'LOT001'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject create when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.create({ brand: 'Test' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject update when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.update('123', { brand: 'Test' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject delete when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.delete('123'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject addStock when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.addStock('123', { quantity: 10 }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject adjustStock when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.adjustStock('123', { quantity: 5 }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject reserveForOrder when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.reserveForOrder('123', { quantity: 2 }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject releaseReservation when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.releaseReservation('123', 'res-456'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject fulfillReservation when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.fulfillReservation('123', 'res-456'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject resolveAlert when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      await expect(contactLensInventoryService.resolveAlert('123', 'alert-456'))
        .rejects.toThrow(/connexion internet/);
    });
  });

  describe('Offline Helpers', () => {
    it('should have preCacheForShift helper', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.preCacheForShift).toBeDefined();
      expect(typeof contactLensInventoryService.preCacheForShift).toBe('function');
    });

    it('should have findMatchingLensOffline helper', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.findMatchingLensOffline).toBeDefined();
      expect(typeof contactLensInventoryService.findMatchingLensOffline).toBe('function');
    });

    it('should have getCachedCount helper', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.getCachedCount).toBeDefined();
      expect(typeof contactLensInventoryService.getCachedCount).toBe('function');
    });

    it('should return 0 cached when offline in preCacheForShift', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');

      const result = await contactLensInventoryService.preCacheForShift('clinic-1');
      expect(result.cached).toBe(0);
    });

    it('should filter lenses offline correctly', async () => {
      const mockLenses = [
        { id: '1', brand: 'Acuvue', power: -2.0, baseCurve: 8.5, diameter: 14.0, clinicId: 'clinic-1', stockLevel: 10 },
        { id: '2', brand: 'Acuvue', power: -3.0, baseCurve: 8.5, diameter: 14.0, clinicId: 'clinic-1', stockLevel: 5 },
        { id: '3', brand: 'Biofinity', power: -2.0, baseCurve: 8.6, diameter: 14.0, clinicId: 'clinic-1', stockLevel: 0 }
      ];

      const db = (await import('../../services/database')).default;
      db.contactLensInventory.toArray.mockResolvedValue(mockLenses);

      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      const results = await contactLensInventoryService.findMatchingLensOffline({
        brand: 'Acuvue',
        power: -2.0
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });
  });

  describe('Backward Compatibility Aliases', () => {
    it('should have getLenses alias', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.getLenses).toBeDefined();
    });

    it('should have getLens alias', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.getLens).toBeDefined();
    });

    it('should have createLens alias', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.createLens).toBeDefined();
    });

    it('should have updateLens alias', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.updateLens).toBeDefined();
    });

    it('should have deleteLens alias', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.deleteLens).toBeDefined();
    });

    it('should have searchLenses alias', async () => {
      const { contactLensInventoryService } = await import('../../services/inventory/index.js');
      expect(contactLensInventoryService.searchLenses).toBeDefined();
    });
  });
});
