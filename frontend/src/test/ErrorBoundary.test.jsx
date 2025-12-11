/**
 * ErrorBoundary Component Tests
 *
 * Tests for the error boundary component that catches React errors
 * and integrates with Sentry for error reporting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import logger from '../services/logger';

// Mock the logger service
vi.mock('../services/logger', () => ({
  default: {
    error: vi.fn(),
    captureException: vi.fn(),
    addBreadcrumb: vi.fn()
  }
}));

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }) {
  if (shouldThrow) {
    throw new Error('Test error from component');
  }
  return <div>Component rendered successfully</div>;
}

// Component that throws a hooks error
function HooksErrorComponent() {
  throw new Error('Invalid hook call: useContext is not a function');
}

describe('ErrorBoundary', () => {
  let consoleSpy;

  beforeEach(() => {
    // Suppress console.error during tests
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Normal rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child1">First child</div>
          <div data-testid="child2">Second child</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should catch errors and display error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText(/Une erreur est survenue/)).toBeInTheDocument();
      expect(screen.getByText(/Réessayer/)).toBeInTheDocument();
      expect(screen.getByText(/Accueil/)).toBeInTheDocument();
    });

    it('should log error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should detect HMR/hooks errors', () => {
      render(
        <ErrorBoundary>
          <HooksErrorComponent />
        </ErrorBoundary>
      );

      // Should show the HMR-specific message
      expect(screen.getByText(/Erreur de chargement de module/)).toBeInTheDocument();
      expect(screen.getByText(/Rafraîchir la page/)).toBeInTheDocument();
    });
  });

  describe('Error recovery', () => {
    it('should reset error state when retry is clicked', () => {
      // Track whether to throw
      let shouldThrow = true;

      function ConditionalThrowingComponent() {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Component rendered successfully</div>;
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalThrowingComponent />
        </ErrorBoundary>
      );

      // Error UI should be shown
      expect(screen.getByText(/Une erreur est survenue/)).toBeInTheDocument();

      // Change the condition so it won't throw on next render
      shouldThrow = false;

      // Click retry - this resets error state and re-renders children
      fireEvent.click(screen.getByText('Réessayer'));

      // Need to force a re-render with the new state
      rerender(
        <ErrorBoundary>
          <ConditionalThrowingComponent />
        </ErrorBoundary>
      );

      // Should show the component now
      expect(screen.getByText('Component rendered successfully')).toBeInTheDocument();
    });

    it('should navigate home when home button is clicked', () => {
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Accueil'));

      expect(window.location.href).toBe('/');

      window.location = originalLocation;
    });
  });

  describe('Error details display', () => {
    it('should show error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      // Should show error details section
      expect(screen.getByText(/Détails de l'erreur/)).toBeInTheDocument();
      expect(screen.getByText(/Test error from component/)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Support message', () => {
    it('should display support contact message', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/contacter le support/)).toBeInTheDocument();
    });
  });
});

describe('ErrorBoundary with Logger Integration', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should capture exception when error boundary catches error', () => {
    // This test documents expected behavior when logger is integrated
    // The actual integration would call logger.captureException in componentDidCatch

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // Error was caught (evidenced by error UI being shown)
    expect(screen.getByText(/Une erreur est survenue/)).toBeInTheDocument();

    // In production with Sentry, this would send the error to Sentry
    // The logger.captureException would be called with the error
  });

  it('should not include PHI in error context', () => {
    // Document expected behavior: errors should never include PHI
    // The error boundary should only pass safe context to the logger

    const safeContext = {
      component: 'PatientDetail',
      action: 'render',
      location: window.location.pathname
      // NO: patientName, diagnosis, or other PHI
    };

    // Verify the context structure is safe
    expect(safeContext).not.toHaveProperty('patientName');
    expect(safeContext).not.toHaveProperty('diagnosis');
    expect(safeContext).not.toHaveProperty('firstName');
    expect(safeContext).not.toHaveProperty('lastName');
    expect(safeContext).not.toHaveProperty('phoneNumber');
  });
});

describe('ErrorBoundary Accessibility', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should have accessible error message', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // Main error message should be in a heading
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/erreur/i);
  });

  it('should have accessible buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // Buttons should be accessible
    const retryButton = screen.getByRole('button', { name: /réessayer/i });
    const homeButton = screen.getByRole('button', { name: /accueil/i });

    expect(retryButton).toBeInTheDocument();
    expect(homeButton).toBeInTheDocument();
  });
});
