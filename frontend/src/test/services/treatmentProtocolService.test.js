import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies before importing the service
const mockGet = vi.fn();
const mockMutate = vi.fn();
const mockApi = {
  get: vi.fn(() => Promise.resolve({ data: [] })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
  put: vi.fn(() => Promise.resolve({ data: {} })),
  delete: vi.fn(() => Promise.resolve({ data: {} }))
};
const mockDb = {
  treatmentProtocols: {
    toArray: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0))
  }
};

vi.mock('../../services/apiConfig', () => ({
  default: mockApi
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: {
    get: mockGet,
    mutate: mockMutate
  }
}));

vi.mock('../../services/database', () => ({
  default: mockDb
}));

describe('treatmentProtocolService', () => {
  let treatmentProtocolService;
  let originalOnLine;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockGet.mockImplementation((fn) => fn());
    mockMutate.mockImplementation((fn) => fn());

    // Store original onLine value
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Re-import the service to get fresh instance with mocked dependencies
    vi.resetModules();
    treatmentProtocolService = (await import('../../services/treatmentProtocolService')).default;
  });

  afterEach(() => {
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine
    });
  });

  describe('Offline Support - READ Operations', () => {
    it('should use offlineWrapper for getTreatmentProtocols', async () => {
      await treatmentProtocolService.getTreatmentProtocols();
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(Function),
        'treatmentProtocols',
        expect.stringContaining('protocols_'),
        expect.objectContaining({ cacheExpiry: 1800 })
      );
    });

    it('should use offlineWrapper for getTreatmentProtocol', async () => {
      await treatmentProtocolService.getTreatmentProtocol('123');
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(Function),
        'treatmentProtocols',
        '123',
        expect.objectContaining({ cacheExpiry: 1800 })
      );
    });

    it('should use offlineWrapper for getPopularProtocols', async () => {
      await treatmentProtocolService.getPopularProtocols(10);
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(Function),
        'treatmentProtocols',
        'popular_10',
        expect.objectContaining({ cacheExpiry: 3600 })
      );
    });

    it('should use offlineWrapper for getFavoriteProtocols', async () => {
      await treatmentProtocolService.getFavoriteProtocols();
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(Function),
        'treatmentProtocols',
        'favorites',
        expect.objectContaining({ cacheExpiry: 1800 })
      );
    });
  });

  describe('Queued Operations', () => {
    it('should use offlineWrapper.mutate for incrementUsage', async () => {
      await treatmentProtocolService.incrementUsage('123');
      expect(mockMutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'treatmentProtocols',
        expect.objectContaining({ protocolId: '123' })
      );
    });

    it('should use offlineWrapper.mutate for toggleFavorite', async () => {
      await treatmentProtocolService.toggleFavorite('123');
      expect(mockMutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'treatmentProtocols',
        expect.objectContaining({ protocolId: '123' })
      );
    });
  });

  describe('Online-Only Operations', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
    });

    it('should reject createTreatmentProtocol when offline', async () => {
      await expect(treatmentProtocolService.createTreatmentProtocol({ name: 'Test' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject updateTreatmentProtocol when offline', async () => {
      await expect(treatmentProtocolService.updateTreatmentProtocol('123', { name: 'Updated' }))
        .rejects.toThrow(/connexion internet/);
    });

    it('should reject deleteTreatmentProtocol when offline', async () => {
      await expect(treatmentProtocolService.deleteTreatmentProtocol('123'))
        .rejects.toThrow(/connexion internet/);
    });

    it('should allow createTreatmentProtocol when online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      await treatmentProtocolService.createTreatmentProtocol({ name: 'Test' });
      expect(mockApi.post).toHaveBeenCalledWith('/treatment-protocols', { name: 'Test' });
    });

    it('should allow updateTreatmentProtocol when online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      await treatmentProtocolService.updateTreatmentProtocol('123', { name: 'Updated' });
      expect(mockApi.put).toHaveBeenCalledWith('/treatment-protocols/123', { name: 'Updated' });
    });

    it('should allow deleteTreatmentProtocol when online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      await treatmentProtocolService.deleteTreatmentProtocol('123');
      expect(mockApi.delete).toHaveBeenCalledWith('/treatment-protocols/123');
    });
  });

  describe('Offline Helpers', () => {
    it('should have preCacheForShift helper', () => {
      expect(treatmentProtocolService.preCacheForShift).toBeDefined();
      expect(typeof treatmentProtocolService.preCacheForShift).toBe('function');
    });

    it('should have searchProtocolsOffline helper', () => {
      expect(treatmentProtocolService.searchProtocolsOffline).toBeDefined();
      expect(typeof treatmentProtocolService.searchProtocolsOffline).toBe('function');
    });

    it('should have getCachedCount helper', () => {
      expect(treatmentProtocolService.getCachedCount).toBeDefined();
      expect(typeof treatmentProtocolService.getCachedCount).toBe('function');
    });

    it('should return 0 cached count when offline at shift start', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const result = await treatmentProtocolService.preCacheForShift();
      expect(result).toEqual({ cached: 0 });
    });

    it('should call getCachedCount from database', async () => {
      mockDb.treatmentProtocols.count.mockResolvedValue(42);

      const result = await treatmentProtocolService.getCachedCount();
      expect(result).toBe(42);
      expect(mockDb.treatmentProtocols.count).toHaveBeenCalled();
    });

    it('should search protocols offline from database', async () => {
      const mockProtocols = [
        { name: 'Glaucoma Protocol', diagnosis: 'glaucoma', category: 'ophthalmo' },
        { name: 'Diabetes Protocol', diagnosis: 'diabetes', category: 'general' },
        { name: 'Cataract Surgery', diagnosis: 'cataract', category: 'surgery' }
      ];
      mockDb.treatmentProtocols.toArray.mockResolvedValue(mockProtocols);

      const result = await treatmentProtocolService.searchProtocolsOffline('glaucoma');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Glaucoma Protocol');
    });
  });

  describe('Cache Expiry Configuration', () => {
    it('should use 30-minute cache for getTreatmentProtocols', async () => {
      await treatmentProtocolService.getTreatmentProtocols();
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(Function),
        'treatmentProtocols',
        expect.any(String),
        expect.objectContaining({ cacheExpiry: 1800 }) // 30 minutes = 1800 seconds
      );
    });

    it('should use 1-hour cache for getPopularProtocols', async () => {
      await treatmentProtocolService.getPopularProtocols();
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(Function),
        'treatmentProtocols',
        expect.any(String),
        expect.objectContaining({ cacheExpiry: 3600 }) // 1 hour = 3600 seconds
      );
    });

    it('should use 30-minute cache for getFavoriteProtocols', async () => {
      await treatmentProtocolService.getFavoriteProtocols();
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(Function),
        'treatmentProtocols',
        expect.any(String),
        expect.objectContaining({ cacheExpiry: 1800 }) // 30 minutes = 1800 seconds
      );
    });
  });
});
