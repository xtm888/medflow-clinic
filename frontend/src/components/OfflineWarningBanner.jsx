import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle, Info } from 'lucide-react';

/**
 * Offline Warning Banner
 * Displays a prominent banner when the user is offline
 * Can be configured for different severity levels (critical for medical forms)
 *
 * @param {Object} props
 * @param {string} props.message - Custom message to display
 * @param {boolean} props.isCritical - Whether this is a critical form (e.g., medication prescription)
 * @param {string} props.criticalMessage - Message to show for critical forms
 */
export default function OfflineWarningBanner({
  message,
  isCritical = false,
  criticalMessage
}) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  const defaultMessage = 'Vous etes hors ligne. Vos modifications seront synchronisees automatiquement.';
  const defaultCriticalMessage = 'Vous etes hors ligne. Certaines fonctionnalites peuvent etre limitees pour des raisons de securite.';

  const displayMessage = message || (isCritical ? (criticalMessage || defaultCriticalMessage) : defaultMessage);

  const baseClasses = 'px-4 py-3 flex items-center space-x-3 text-white text-sm';
  const colorClasses = isCritical ? 'bg-red-500' : 'bg-yellow-500';

  const Icon = isCritical ? AlertTriangle : WifiOff;

  return (
    <div className={`${baseClasses} ${colorClasses}`} role="alert">
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1">{displayMessage}</span>
      {isCritical && (
        <div className="flex items-center space-x-1 text-white/80 text-xs">
          <Info className="h-4 w-4" />
          <span>Mode hors ligne</span>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to check offline status
 * Can be used in form components to conditionally disable features
 */
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
}
