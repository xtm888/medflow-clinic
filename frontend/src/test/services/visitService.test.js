/**
 * Visit Service Tests - Offline Capabilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
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
    get: vi.fn(),
    mutate: vi.fn(),
    checkOnline: vi.fn(() => true)
  }
}));

vi.mock('../../services/database', () => ({
  db: {
    visits: {
      get: vi.fn(),
      put: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([]))
        }))
      })),
      toArray: vi.fn(() => Promise.resolve([]))
    }
  }
}));

describe('visitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getVisits', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await visitService.getVisits();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getVisit', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({ data: { id: '123' }, success: true });

      await visitService.getVisit('123');

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createVisit', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await visitService.createVisit({ patientId: 'p1' });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE',
        'visits',
        expect.objectContaining({ patientId: 'p1' })
      );
    });

    it('should use offlineWrapper.mutate for updateVisit', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await visitService.updateVisit('123', { status: 'completed' });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'visits',
        expect.objectContaining({ status: 'completed' }),
        '123'
      );
    });
  });

  describe('Patient Visits - Offline', () => {
    it('should cache patient visits for offline access', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({
        data: [{ id: 'v1', patientId: 'p1' }],
        success: true
      });

      await visitService.getPatientVisits('p1');

      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'visits',
        expect.objectContaining({ patientId: 'p1' }),
        expect.any(Object)
      );
    });
  });

  describe('Today Visits - Offline', () => {
    it('should cache today visits for offline queue access', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await visitService.getTodaysVisits();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });
});
