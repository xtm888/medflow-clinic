/**
 * Device Service Tests - Offline Capabilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: {
      baseURL: 'http://localhost:5001/api'
    }
  },
  apiHelpers: {
    upload: vi.fn()
  }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: {
    get: vi.fn(),
    mutate: vi.fn(),
    checkOnline: vi.fn(() => true)
  }
}));

describe('deviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getDevices', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await deviceService.getDevices();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getDevice', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({ data: { id: '123' }, success: true });

      await deviceService.getDevice('123');

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache device configuration for offline use', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({
        data: { id: '123', name: 'OCT Scanner' },
        success: true
      });

      await deviceService.getDevice('123');

      // Verify cache options were passed
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(String),
        expect.anything(),
        expect.objectContaining({ cacheExpiry: expect.any(Number) })
      );
    });

    it('should use offlineWrapper for getDeviceHealth', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({
        data: { status: 'online', lastSync: new Date().toISOString() },
        success: true
      });

      await deviceService.getDeviceHealth('123');

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache device list for offline use', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({
        data: [
          { id: '1', type: 'oct', status: 'active' },
          { id: '2', type: 'autorefractor', status: 'active' }
        ],
        success: true
      });

      await deviceService.getDevices({ status: 'active' });

      // Verify cache expiry is set for device list
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'devices',
        expect.anything(),
        expect.objectContaining({ cacheExpiry: expect.any(Number) })
      );
    });
  });
});
