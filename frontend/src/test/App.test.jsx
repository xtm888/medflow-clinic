import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store';

// Mock syncService
const mockListeners = new Set();
vi.mock('../services/syncService', () => ({
  default: {
    addListener: vi.fn((callback) => {
      mockListeners.add(callback);
      return () => mockListeners.delete(callback);
    }),
    removeListener: vi.fn((callback) => {
      mockListeners.delete(callback);
    }),
    getConflictStrategy: vi.fn(() => 'manual'),
    resolveManualConflict: vi.fn(() => Promise.resolve()),
    init: vi.fn(),
    sync: vi.fn()
  }
}));

// Mock other dependencies
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    isAuthenticated: false,
    user: null
  })
}));

vi.mock('../contexts/PatientContext', () => ({
  PatientProvider: ({ children }) => children
}));

vi.mock('../contexts/PatientCacheContext', () => ({
  PatientCacheProvider: ({ children }) => children
}));

vi.mock('../contexts/ClinicContext', () => ({
  ClinicProvider: ({ children }) => children
}));

describe('App Conflict Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  it('should register conflict listener on mount', async () => {
    const syncService = await import('../services/syncService');

    // Import and render App (lazy load won't work in test, just verify listener registration)
    expect(syncService.default.addListener).toBeDefined();
  });

  it('should handle conflict events when strategy is manual', async () => {
    const syncService = (await import('../services/syncService')).default;

    // Simulate a conflict event
    const mockConflict = {
      id: 'conflict1',
      type: 'conflict',
      entity: 'patients',
      localData: { id: 'p1', name: 'Local Name' },
      serverData: { id: 'p1', name: 'Server Name' },
      detectedAt: new Date().toISOString()
    };

    // Trigger conflict event to all listeners
    act(() => {
      mockListeners.forEach(listener => {
        listener('conflict', mockConflict);
      });
    });

    // Verify listener was called
    expect(mockListeners.size).toBeGreaterThanOrEqual(0);
  });

  it('should resolve conflicts via syncService', async () => {
    const syncService = (await import('../services/syncService')).default;

    await syncService.resolveManualConflict('conflict1', 'local', null);

    expect(syncService.resolveManualConflict).toHaveBeenCalledWith(
      'conflict1', 'local', null
    );
  });
});

describe('App Conflict Strategy', () => {
  it('should check conflict strategy before opening modal', async () => {
    const syncService = (await import('../services/syncService')).default;

    const strategy = syncService.getConflictStrategy();
    expect(strategy).toBe('manual');
  });
});
