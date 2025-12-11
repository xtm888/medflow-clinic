import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: { get: vi.fn(), mutate: vi.fn() }
}));

vi.mock('../../services/database', () => ({
  db: { approvals: { toArray: vi.fn(), get: vi.fn(), where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn() })) })) } }
}));

describe('approvalService', () => {
  let approvalService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    approvalService = (await import('../../services/approvalService')).default;
  });

  describe('Offline Support - Read Operations', () => {
    it('should use offlineWrapper for getApprovals', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await approvalService.getApprovals();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getApproval', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await approvalService.getApproval('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for checkApproval', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { exists: true } });
      await approvalService.checkApproval('patient1', 'company1', 'ACT001');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getPatientApprovals', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await approvalService.getPatientApprovals('patient123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache approvals for 30 minutes', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await approvalService.getApprovals();
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'approvals',
        expect.any(String),
        expect.objectContaining({ cacheExpiry: 1800 })
      );
    });
  });

  describe('Online Only Operations - Approval Actions', () => {
    it('should throw when approving offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(approvalService.approveRequest('123', {}))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    it('should throw when rejecting offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(approvalService.rejectRequest('123', {}))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    it('should throw when using approval offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      await expect(approvalService.useApproval('123', 'inv456'))
        .rejects.toThrow('requires internet connection');
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });
  });
});
