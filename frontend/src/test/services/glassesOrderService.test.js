import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: { get: vi.fn(), mutate: vi.fn() }
}));

vi.mock('../../services/database', () => ({
  db: {
    glassesOrders: { toArray: vi.fn(), get: vi.fn(), put: vi.fn() },
    frameInventory: { toArray: vi.fn() },
    contactLensInventory: { toArray: vi.fn() }
  }
}));

describe('glassesOrderService', () => {
  let glassesOrderService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    glassesOrderService = (await import('../../services/glassesOrderService')).default;
  });

  describe('Offline Support - Basic Operations', () => {
    it('should use offlineWrapper for getOrders', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getOrders();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getOrder', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.getOrder('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createOrder', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.createOrder({ patientId: 'p1' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'CREATE', 'glassesOrders', expect.any(Object)
      );
    });

    it('should use offlineWrapper.mutate for updateOrder', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.updateOrder('123', { status: 'ready' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'UPDATE', 'glassesOrders', expect.any(Object), '123'
      );
    });

    it('should use offlineWrapper.mutate for updateStatus', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.updateStatus('123', 'ready', 'QC passed');
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'UPDATE', 'glassesOrders', expect.any(Object), '123'
      );
    });

    it('should use offlineWrapper.mutate for deleteOrder', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { success: true } });
      await glassesOrderService.deleteOrder('123');
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'DELETE', 'glassesOrders', expect.any(Object), '123'
      );
    });

    it('should use offlineWrapper for getStats', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { total: 10, pending: 2 } });
      await glassesOrderService.getStats();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });

  describe('Offline Support - Patient & Exam Operations', () => {
    it('should use offlineWrapper for getPatientOrders', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getPatientOrders('patient123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getExamOrders', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getExamOrders('exam123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });

  describe('Offline Support - Inventory Integration', () => {
    it('should use offlineWrapper for searchFrames', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.searchFrames('ray-ban');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for searchContactLenses', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.searchContactLenses({ brand: 'acuvue' });
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for checkInventoryAvailability', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { available: true } });
      await glassesOrderService.checkInventoryAvailability([{ sku: '123' }]);
      expect(offlineWrapper.mutate).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getOrderWithInventory', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123', items: [] } });
      await glassesOrderService.getOrderWithInventory('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for reserveInventory', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { success: true } });
      await glassesOrderService.reserveInventory('order123');
      expect(offlineWrapper.mutate).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for releaseInventory', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { success: true } });
      await glassesOrderService.releaseInventory('order123');
      expect(offlineWrapper.mutate).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for fulfillInventory', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { success: true } });
      await glassesOrderService.fulfillInventory('order123');
      expect(offlineWrapper.mutate).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getUnbilledOrders', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getUnbilledOrders('patient123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });

  describe('Offline Support - QC Workflow', () => {
    it('should use offlineWrapper for getPendingQC', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getPendingQC();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getReadyForPickup', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getReadyForPickup();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for receiveFromLab', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.receiveFromLab('order123', { trackingNumber: 'T123' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'UPDATE', 'glassesOrders', expect.any(Object), 'order123'
      );
    });

    it('should use offlineWrapper.mutate for performQC', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.performQC('order123', { passed: true });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'UPDATE', 'glassesOrders', expect.any(Object), 'order123'
      );
    });

    it('should use offlineWrapper.mutate for recordDelivery', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.recordDelivery('order123', { signature: 'sig123' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'UPDATE', 'glassesOrders', expect.any(Object), 'order123'
      );
    });
  });

  describe('Online Only Operations', () => {
    it('should throw when generating invoice offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(glassesOrderService.generateInvoice('123'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    it('should throw when QC override offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(glassesOrderService.qcOverride('123', 'reason'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    it('should throw when sending pickup reminder offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(glassesOrderService.sendPickupReminder('123'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });
  });

  describe('Helper Methods', () => {
    it('should cache critical data in preCacheForShift', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      const result = await glassesOrderService.preCacheForShift();
      expect(result).toHaveProperty('cached');
      expect(result).toHaveProperty('errors');
    });

    it('should return cached count from database', async () => {
      const { db } = await import('../../services/database');
      db.glassesOrders.toArray.mockResolvedValue([{}, {}, {}]);
      const count = await glassesOrderService.getCachedCount();
      expect(count).toBe(3);
    });

    it('should search frames offline from local database', async () => {
      const { db } = await import('../../services/database');
      db.frameInventory.toArray.mockResolvedValue([
        { brand: 'Ray-Ban', model: 'Aviator' },
        { brand: 'Oakley', model: 'Frogskins' }
      ]);
      const results = await glassesOrderService.searchFramesOffline('ray');
      expect(results).toHaveLength(1);
      expect(results[0].brand).toBe('Ray-Ban');
    });

    it('should handle errors gracefully in offline search', async () => {
      const { db } = await import('../../services/database');
      db.frameInventory.toArray.mockRejectedValue(new Error('DB error'));
      const results = await glassesOrderService.searchFramesOffline('test');
      expect(results).toEqual([]);
    });
  });
});
