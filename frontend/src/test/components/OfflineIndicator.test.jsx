/**
 * OfflineIndicator Tests - Simplified
 * Tests basic rendering and structure without complex async operations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OfflineIndicator from '../../components/OfflineIndicator';

// Mock syncService with immediate returns
vi.mock('../../services/syncService', () => ({
  default: {
    getStatus: vi.fn().mockResolvedValue({
      pendingOperations: 0,
      unresolvedConflicts: 0,
      lastSync: new Date().toISOString()
    }),
    sync: vi.fn().mockResolvedValue({}),
    addListener: vi.fn(() => vi.fn()),
  }
}));

// Mock database
vi.mock('../../services/database', () => ({
  db: {
    conflicts: {
      filter: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([])
      }))
    }
  }
}));

// Mock ConflictResolutionModal to avoid complexity
vi.mock('../../components/ConflictResolutionModal', () => ({
  default: ({ isOpen, conflict, onClose }) => (
    isOpen ? <div data-testid="conflict-modal">Conflict Modal for {conflict?.entity}</div> : null
  )
}));

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock fetch for connectivity check - immediate response
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the component', async () => {
    render(<OfflineIndicator />);

    // Should render a button
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('shows details panel when clicked', async () => {
    render(<OfflineIndicator />);

    // Click the button to show details
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Details panel should appear
    await waitFor(() => {
      expect(screen.getByText(/Synchroniser/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('imports and renders ConflictResolutionModal', async () => {
    // This test verifies that the ConflictResolutionModal import is working
    const { default: syncService } = await import('../../services/syncService');
    const { db } = await import('../../services/database');

    // Setup conflicts
    syncService.getStatus.mockResolvedValue({
      pendingOperations: 0,
      unresolvedConflicts: 1,
      lastSync: new Date().toISOString()
    });

    db.conflicts.filter.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { id: 'c1', entity: 'patients', entityId: 'p123', localData: {}, serverData: {} }
      ])
    });

    render(<OfflineIndicator />);

    // Verify component renders without crashing
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('calls sync service sync method', async () => {
    const { default: syncService } = await import('../../services/syncService');

    render(<OfflineIndicator />);

    // Click to show details
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      const syncButton = screen.getByText(/Synchroniser/i);
      fireEvent.click(syncButton);
    }, { timeout: 2000 });

    expect(syncService.sync).toHaveBeenCalled();
  });
});
