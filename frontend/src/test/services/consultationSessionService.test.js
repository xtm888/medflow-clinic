/**
 * Consultation Session Service Tests - Offline Capabilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    consultationSessions: {
      get: vi.fn(),
      put: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
          toArray: vi.fn(() => Promise.resolve([]))
        }))
      })),
      toArray: vi.fn(() => Promise.resolve([]))
    }
  }
}));

describe('consultationSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getRecentSessions', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await sessionService.getRecentSessions();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getSession', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.get.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.getSession('123');

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createSession', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.createSession({ patientId: 'p1' });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE',
        'consultationSessions',
        expect.objectContaining({ patientId: 'p1' })
      );
    });

    it('should use offlineWrapper.mutate for updateSession', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.updateSession('123', { step: 2 });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'consultationSessions',
        expect.objectContaining({ step: 2 }),
        '123'
      );
    });
  });

  describe('Auto-Save', () => {
    it('should support auto-save flag for session updates', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.updateSession('123', { step: 2 }, true);

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'consultationSessions',
        expect.objectContaining({ isAutoSave: true }),
        '123'
      );
    });
  });
});
