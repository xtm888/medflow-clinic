import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: { get: vi.fn(), mutate: vi.fn() }
}));

vi.mock('../../services/database', () => ({
  db: { clinics: { toArray: vi.fn(), get: vi.fn(), put: vi.fn() } }
}));

describe('clinicService', () => {
  let clinicService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    clinicService = (await import('../../services/clinicService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getClinics', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await clinicService.getClinics();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getClinic', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await clinicService.getClinic('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getMyClinics', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await clinicService.getMyClinics();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getClinicStaff', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await clinicService.getClinicStaff('clinic123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache clinic config for 1 hour', async () => {
      offlineWrapper.get.mockResolvedValue({ data: {} });
      await clinicService.getClinic('123');
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'clinics',
        '123',
        expect.objectContaining({ cacheExpiry: 3600 })
      );
    });
  });

  describe('Online Only Operations', () => {
    it('should throw when creating clinic offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(clinicService.createClinic({ name: 'New Clinic' }))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });
  });

  describe('Constants', () => {
    it('should export CLINIC_TYPES', () => {
      expect(clinicService.CLINIC_TYPES).toBeDefined();
      expect(Array.isArray(clinicService.CLINIC_TYPES)).toBe(true);
    });

    it('should export CLINIC_SERVICES', () => {
      expect(clinicService.CLINIC_SERVICES).toBeDefined();
      expect(Array.isArray(clinicService.CLINIC_SERVICES)).toBe(true);
    });
  });
});
