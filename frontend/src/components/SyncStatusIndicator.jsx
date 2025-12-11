/**
 * Sync Status Indicator Component
 *
 * Displays real-time sync status in the header:
 * - Connection status (online/offline)
 * - Last sync time
 * - Pending changes count
 * - Sync errors/conflicts
 * - Manual sync button
 */

import { useState, useEffect, useCallback } from 'react';
import syncService from '../services/syncService';

export default function SyncStatusIndicator({ compact = false, onOpenDetails }) {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    pendingOperations: 0,
    unresolvedConflicts: 0,
    error: null
  });
  const [showDetails, setShowDetails] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);

  // Fetch sync status
  const fetchStatus = useCallback(async () => {
    try {
      const syncStatus = await syncService.getStatus();
      setStatus(prev => ({
        ...prev,
        ...syncStatus,
        error: null
      }));
    } catch (err) {
      console.warn('Failed to get sync status:', err.message);
    }
  }, []);

  // Handle sync events
  useEffect(() => {
    const handleSyncEvent = (event, data) => {
      switch (event) {
        case 'online':
          setStatus(prev => ({ ...prev, isOnline: true }));
          break;
        case 'offline':
          setStatus(prev => ({ ...prev, isOnline: false }));
          break;
        case 'sync-start':
          setStatus(prev => ({ ...prev, isSyncing: true }));
          setSyncProgress({ phase: 'starting', percent: 0 });
          break;
        case 'sync-complete':
          setStatus(prev => ({
            ...prev,
            isSyncing: false,
            lastSync: new Date().toISOString(),
            error: null
          }));
          setSyncProgress(null);
          fetchStatus();
          break;
        case 'sync-error':
          setStatus(prev => ({
            ...prev,
            isSyncing: false,
            error: data?.message || 'Sync failed'
          }));
          setSyncProgress(null);
          break;
        case 'sync-progress':
          setSyncProgress(data);
          break;
        case 'conflict':
          setStatus(prev => ({
            ...prev,
            unresolvedConflicts: prev.unresolvedConflicts + 1
          }));
          break;
      }
    };

    // Subscribe to sync events
    const unsubscribe = syncService.addListener(handleSyncEvent);

    // Initial fetch
    fetchStatus();

    // Refresh status periodically
    const interval = setInterval(fetchStatus, 30000);

    // Listen for online/offline events
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchStatus]);

  // Manual sync trigger
  const handleManualSync = async () => {
    if (status.isSyncing || !status.isOnline) return;

    try {
      await syncService.sync();
    } catch (err) {
      console.error('Manual sync failed:', err);
    }
  };

  // Format last sync time
  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Jamais';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  // Get status icon and color
  const getStatusIndicator = () => {
    if (!status.isOnline) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        ),
        color: 'text-red-500',
        bgColor: 'bg-red-100',
        label: 'Hors ligne'
      };
    }

    if (status.isSyncing) {
      return {
        icon: (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        color: 'text-blue-500',
        bgColor: 'bg-blue-100',
        label: 'Synchronisation...'
      };
    }

    if (status.error) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        color: 'text-amber-500',
        bgColor: 'bg-amber-100',
        label: 'Erreur de sync'
      };
    }

    if (status.unresolvedConflicts > 0) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'text-orange-500',
        bgColor: 'bg-orange-100',
        label: `${status.unresolvedConflicts} conflit(s)`
      };
    }

    if (status.pendingOperations > 0) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-100',
        label: `${status.pendingOperations} en attente`
      };
    }

    return {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      label: 'Synchronisé'
    };
  };

  const indicator = getStatusIndicator();

  // Compact mode (just icon)
  if (compact) {
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`relative p-2 rounded-full ${indicator.bgColor} ${indicator.color} hover:opacity-80 transition-opacity`}
        title={indicator.label}
      >
        {indicator.icon}
        {(status.pendingOperations > 0 || status.unresolvedConflicts > 0) && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {status.pendingOperations + status.unresolvedConflicts}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Main Status Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${indicator.bgColor} ${indicator.color} hover:opacity-80 transition-all`}
      >
        {indicator.icon}
        <span className="text-sm font-medium hidden sm:inline">{indicator.label}</span>
        {(status.pendingOperations > 0 || status.unresolvedConflicts > 0) && (
          <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
            {status.pendingOperations + status.unresolvedConflicts}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Details Dropdown */}
      {showDetails && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">État de la synchronisation</h3>
              <span className={`flex items-center gap-1 text-sm ${indicator.color}`}>
                {indicator.icon}
                {indicator.label}
              </span>
            </div>
          </div>

          {/* Status Details */}
          <div className="px-4 py-3 space-y-3">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Connexion</span>
              <span className={`flex items-center gap-1 text-sm ${status.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full ${status.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                {status.isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>

            {/* Last Sync */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Dernière sync</span>
              <span className="text-sm text-gray-900">{formatLastSync(status.lastSync)}</span>
            </div>

            {/* Pending Operations */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">En attente</span>
              <span className={`text-sm ${status.pendingOperations > 0 ? 'text-amber-600 font-medium' : 'text-gray-900'}`}>
                {status.pendingOperations} opération(s)
              </span>
            </div>

            {/* Conflicts */}
            {status.unresolvedConflicts > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Conflits</span>
                <span className="text-sm text-red-600 font-medium">
                  {status.unresolvedConflicts} à résoudre
                </span>
              </div>
            )}

            {/* Error Message */}
            {status.error && (
              <div className="p-2 bg-red-50 rounded-md">
                <p className="text-xs text-red-600">{status.error}</p>
              </div>
            )}

            {/* Sync Progress */}
            {syncProgress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{syncProgress.phase}</span>
                  {syncProgress.percent !== undefined && (
                    <span>{syncProgress.percent}%</span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${syncProgress.percent || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            {onOpenDetails && (
              <button
                onClick={() => {
                  setShowDetails(false);
                  onOpenDetails();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Voir détails
              </button>
            )}
            <button
              onClick={handleManualSync}
              disabled={status.isSyncing || !status.isOnline}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${status.isSyncing || !status.isOnline
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {status.isSyncing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Synchronisation...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Synchroniser
                </>
              )}
            </button>

            {status.unresolvedConflicts > 0 && (
              <button
                onClick={() => {
                  setShowDetails(false);
                  // Navigate to conflict resolution page
                  window.location.href = '/settings?tab=sync';
                }}
                className="px-3 py-2 rounded-md text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
              >
                Résoudre
              </button>
            )}
          </div>

          {/* Footer Info */}
          <div className="px-4 py-2 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-gray-500 text-center">
              Sync automatique toutes les 15 minutes
            </p>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDetails && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
