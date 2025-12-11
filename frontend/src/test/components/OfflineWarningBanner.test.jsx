/**
 * Offline Warning Banner Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineWarningBanner from '../../components/OfflineWarningBanner';

describe('OfflineWarningBanner', () => {
  const originalNavigator = window.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true
    });
  });

  it('shows warning when offline', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner />);

    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
  });

  it('shows nothing when online', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: true },
      writable: true
    });

    render(<OfflineWarningBanner />);

    expect(screen.queryByText(/hors ligne/i)).not.toBeInTheDocument();
  });

  it('shows custom message when provided', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner message="Custom offline message" />);

    expect(screen.getByText(/Custom offline message/i)).toBeInTheDocument();
  });

  it('shows critical warning for medical forms', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner isCritical={true} />);

    expect(screen.getByRole('alert')).toHaveClass('bg-red-500');
  });

  it('shows standard warning for non-critical forms', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner isCritical={false} />);

    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-500');
  });
});
