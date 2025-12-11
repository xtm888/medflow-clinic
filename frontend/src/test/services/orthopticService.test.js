import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: { get: vi.fn(), mutate: vi.fn() }
}));

vi.mock('../../services/database', () => ({
  db: { orthopticExams: { toArray: vi.fn(), get: vi.fn(), put: vi.fn() } }
}));

describe('orthopticService', () => {
  let orthopticService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    orthopticService = (await import('../../services/orthopticService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getExams', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await orthopticService.getExams();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getExam', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await orthopticService.getExam('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createExam', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await orthopticService.createExam({ patientId: 'p1' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'CREATE', 'orthopticExams', expect.any(Object)
      );
    });

    it('should use offlineWrapper.mutate for updateExam', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await orthopticService.updateExam('123', { notes: 'test' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function), 'UPDATE', 'orthopticExams', expect.any(Object), '123'
      );
    });

    it('should use offlineWrapper for getPatientHistory', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await orthopticService.getPatientHistory('patient123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });

  describe('Online Only Operations', () => {
    it('should throw when signing exam offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(orthopticService.signExam('123'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    it('should throw when generating report offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(orthopticService.generateReport('123'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });
  });
});
