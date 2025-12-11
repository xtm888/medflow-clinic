import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock clinic context
vi.mock('../../contexts/ClinicContext', () => ({
  useClinic: () => ({
    selectedClinic: { _id: 'clinic1', name: 'Test Clinic' },
    selectedClinicId: 'clinic1',
    selectedClinicName: 'Test Clinic'
  })
}));

// Mock clinicSyncService
vi.mock('../../services/clinicSyncService', () => ({
  default: {
    getSyncStatus: vi.fn(() => ({
      clinicId: 'clinic1',
      lastSyncTime: new Date(Date.now() - 60000),
      syncInterval: 300000,
      isStale: false,
      syncInProgress: false,
      nextSyncIn: 240000,
      entitiesSynced: ['patients'],
      errors: []
    })),
    subscribeSyncStatus: vi.fn(() => () => {}),
    pullClinicData: vi.fn(() => Promise.resolve({
      success: true,
      synced: 50,
      failed: 0,
      entities: { patients: { success: true, count: 50 } }
    })),
    notifySyncStatusChange: vi.fn()
  }
}));

// Mock syncService
vi.mock('../../services/syncService', () => ({
  SYNC_ENTITIES: ['patients', 'visits', 'prescriptions'],
  getSyncIntervalForClinic: vi.fn(() => 300000)
}));

import SyncProgressModal from '../../components/SyncProgressModal';
import SyncStatusBadge from '../../components/SyncStatusBadge';

describe('SyncProgressModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  it('should render when open', () => {
    render(<SyncProgressModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('État de la synchronisation')).toBeInTheDocument();
    expect(screen.getByText('Test Clinic')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<SyncProgressModal isOpen={false} onClose={() => {}} />);

    expect(screen.queryByText('État de la synchronisation')).not.toBeInTheDocument();
  });

  it('should show online status', () => {
    render(<SyncProgressModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('En ligne')).toBeInTheDocument();
  });

  it('should show offline status when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    render(<SyncProgressModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
  });

  it('should show sync interval', () => {
    render(<SyncProgressModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText(/Intervalle:/)).toBeInTheDocument();
  });

  it('should have sync button', () => {
    render(<SyncProgressModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Synchroniser')).toBeInTheDocument();
  });

  it('should disable sync button when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    render(<SyncProgressModal isOpen={true} onClose={() => {}} />);

    const syncButton = screen.getByText('Synchroniser');
    expect(syncButton.closest('button')).toBeDisabled();
  });

  it('should toggle entity details', () => {
    render(<SyncProgressModal isOpen={true} onClose={() => {}} />);

    const detailsButton = screen.getByText(/Détails des entités/);
    fireEvent.click(detailsButton);

    // Should show entities after toggle
    expect(screen.getByText(/patients/i)).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<SyncProgressModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('Fermer'));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('SyncStatusBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render badge', () => {
    render(<SyncStatusBadge onClick={() => {}} />);

    expect(screen.getByText('À jour')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(<SyncStatusBadge onClick={onClick} />);

    const badge = screen.getByRole('button');
    fireEvent.click(badge);

    expect(onClick).toHaveBeenCalled();
  });
});
