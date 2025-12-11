import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock all services
vi.mock('../../contexts/ClinicContext', () => ({
  useClinic: () => ({
    selectedClinic: { _id: 'clinic1', name: 'Test Clinic' },
    selectedClinicId: 'clinic1',
    selectedClinicName: 'Test Clinic'
  })
}));

vi.mock('../../services/patientService', () => ({
  default: { preCachePatients: vi.fn(() => Promise.resolve({ cached: 50 })) }
}));

vi.mock('../../services/visitService', () => ({
  default: { preCacheTodaysVisits: vi.fn(() => Promise.resolve({ cached: 10 })) }
}));

vi.mock('../../services/database', () => ({
  default: { getStats: vi.fn(() => Promise.resolve({ patients: 100, visits: 50 })) }
}));

vi.mock('../../services/inventory/index', () => ({
  frameInventoryService: { preCacheForShift: vi.fn(() => Promise.resolve({ cached: 20 })) },
  contactLensInventoryService: { preCacheForShift: vi.fn(() => Promise.resolve({ cached: 15 })) }
}));

vi.mock('../../services/pharmacyInventoryService', () => ({
  default: { preCacheForShift: vi.fn(() => Promise.resolve({ cached: 100 })) }
}));

vi.mock('../../services/orthopticService', () => ({
  default: { preCachePatientData: vi.fn(() => Promise.resolve({ cached: 5 })) }
}));

vi.mock('../../services/glassesOrderService', () => ({
  default: { preCacheForShift: vi.fn(() => Promise.resolve({ cached: 8 })) }
}));

vi.mock('../../services/treatmentProtocolService', () => ({
  default: { preCacheForShift: vi.fn(() => Promise.resolve({ cached: 30 })) }
}));

vi.mock('../../services/labQCService', () => ({
  default: { preCacheForShift: vi.fn(() => Promise.resolve({ cached: 2 })) }
}));

vi.mock('../../services/approvalService', () => ({
  default: { preCachePatientApprovals: vi.fn(() => Promise.resolve({ cached: 12 })) }
}));

vi.mock('../../services/stockReconciliationService', () => ({
  default: { preCacheActiveReconciliations: vi.fn(() => Promise.resolve({ cached: 3 })) }
}));

vi.mock('../../services/clinicSyncService', () => ({
  default: {
    setActiveClinic: vi.fn(),
    setLastSyncTime: vi.fn(),
    getClinicStorageStats: vi.fn(() => Promise.resolve({ totalRecords: 200, byEntity: {} }))
  }
}));

import PrepareOfflineModal from '../../components/PrepareOfflineModal';

describe('PrepareOfflineModal Enhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  it('should render modal when open', () => {
    render(<PrepareOfflineModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Préparer le mode hors ligne')).toBeInTheDocument();
    expect(screen.getByText('Test Clinic')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<PrepareOfflineModal isOpen={false} onClose={() => {}} />);

    expect(screen.queryByText('Préparer le mode hors ligne')).not.toBeInTheDocument();
  });

  it('should display category selection buttons', () => {
    render(<PrepareOfflineModal isOpen={true} onClose={() => {}} />);

    // Use getAllByText since categories appear in both button and section header
    expect(screen.getAllByText('Essentiel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Clinique').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Optique').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pharmacie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Laboratoire').length).toBeGreaterThan(0);
  });

  it('should toggle category selection', () => {
    render(<PrepareOfflineModal isOpen={true} onClose={() => {}} />);

    const optiqueButton = screen.getByText('Optique');
    fireEvent.click(optiqueButton);

    // Should now show optical options
    expect(screen.getByText('Montures')).toBeInTheDocument();
  });

  it('should show start button with category count', () => {
    render(<PrepareOfflineModal isOpen={true} onClose={() => {}} />);

    // Essential is selected by default
    expect(screen.getByText(/Démarrer \(1\)/)).toBeInTheDocument();
  });

  it('should disable start when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<PrepareOfflineModal isOpen={true} onClose={() => {}} />);

    const startButton = screen.getByText(/Démarrer/);
    expect(startButton.closest('button')).toBeDisabled();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<PrepareOfflineModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('Fermer'));

    expect(onClose).toHaveBeenCalled();
  });
});
