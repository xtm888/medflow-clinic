/**
 * Conflict Resolution Modal Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConflictResolutionModal from '../../components/ConflictResolutionModal';

// Mock syncService
vi.mock('../../services/syncService', () => ({
  default: {
    resolveManualConflict: vi.fn()
  }
}));

describe('ConflictResolutionModal', () => {
  const mockConflict = {
    id: 'conflict-1',
    entity: 'patients',
    entityId: 'patient-123',
    localData: {
      firstName: 'Jean',
      lastName: 'Dupont',
      phoneNumber: '0612345678',
      lastSync: '2025-01-01T10:00:00Z'
    },
    serverData: {
      firstName: 'Jean',
      lastName: 'Martin',
      phoneNumber: '0698765432',
      lastModified: '2025-01-01T11:00:00Z'
    },
    timestamp: '2025-01-01T12:00:00Z'
  };

  const mockOnClose = vi.fn();
  const mockOnResolved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conflict details', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    expect(screen.getByText(/Conflit/i)).toBeInTheDocument();
    expect(screen.getByText(/patients/i)).toBeInTheDocument();
  });

  it('shows local and server data side by side', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    // Check for table headers
    const headers = screen.getAllByText(/Local/i);
    expect(headers.length).toBeGreaterThan(0);
    const serverHeaders = screen.getAllByText(/Serveur/i);
    expect(serverHeaders.length).toBeGreaterThan(0);
  });

  it('highlights differing fields', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    // lastName differs: Dupont vs Martin
    expect(screen.getByText('Dupont')).toBeInTheDocument();
    expect(screen.getByText('Martin')).toBeInTheDocument();
  });

  it('calls resolveManualConflict with local when Keep Local clicked', async () => {
    const syncService = (await import('../../services/syncService')).default;
    syncService.resolveManualConflict.mockResolvedValue({ success: true });

    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const localButton = screen.getByRole('button', { name: /local/i });
    fireEvent.click(localButton);

    await waitFor(() => {
      expect(syncService.resolveManualConflict).toHaveBeenCalledWith(
        'conflict-1',
        'local',
        null
      );
    });
  });

  it('calls resolveManualConflict with server when Keep Server clicked', async () => {
    const syncService = (await import('../../services/syncService')).default;
    syncService.resolveManualConflict.mockResolvedValue({ success: true });

    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const serverButton = screen.getByRole('button', { name: /serveur/i });
    fireEvent.click(serverButton);

    await waitFor(() => {
      expect(syncService.resolveManualConflict).toHaveBeenCalledWith(
        'conflict-1',
        'server',
        null
      );
    });
  });

  it('calls onResolved after successful resolution', async () => {
    const syncService = (await import('../../services/syncService')).default;
    syncService.resolveManualConflict.mockResolvedValue({ success: true });

    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const localButton = screen.getByRole('button', { name: /local/i });
    fireEvent.click(localButton);

    await waitFor(() => {
      expect(mockOnResolved).toHaveBeenCalledWith('conflict-1');
    });
  });

  it('does not render when isOpen is false', () => {
    render(
      <ConflictResolutionModal
        isOpen={false}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    expect(screen.queryByText(/Conflit/i)).not.toBeInTheDocument();
  });

  it('handles close button click', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const closeButton = screen.getByRole('button', { name: /fermer|close|×/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
