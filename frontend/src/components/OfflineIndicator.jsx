import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Check, Clock } from 'lucide-react';
import syncService from '../services/syncService';
import ConflictResolutionModal from './ConflictResolutionModal';

export default function OfflineIndicator() {
  // Start with true to avoid showing offline banner on initial load
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [pendingOperations, setPendingOperations] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [conflicts, setConflicts] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [hasCheckedConnectivity, setHasCheckedConnectivity] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [conflictList, setConflictList] = useState([]);

  useEffect(() => {
    // Check actual connectivity on mount with a small delay
    // This gives the page time to fully load before checking
    const checkConnectivity = async () => {
      // Wait a moment before checking to avoid false negatives on hard refresh
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        // Try to fetch the API health endpoint (doesn't require auth)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Use the same API base URL as the rest of the app
        const apiBaseUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5001/api`;
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          method: 'HEAD',
          cache: 'no-cache',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        setIsOnline(response.ok || response.status === 401 || navigator.onLine);
      } catch {
        // If fetch fails, fall back to navigator.onLine
        // But also check if the app is actually loaded (page visible)
        setIsOnline(navigator.onLine);
      }
      setHasCheckedConnectivity(true);
    };

    checkConnectivity();

    // Update online status
    const handleOnline = () => {
      setIsOnline(true);
      showNotification('Connection Restored', 'Your data will now sync automatically');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showNotification("You're Offline", "Don't worry, you can continue working offline");
    };

    // Listen to online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to sync events
    const unsubscribe = syncService.addListener((event, data) => {
      switch (event) {
        case 'sync-start':
          setSyncStatus('syncing');
          break;
        case 'sync-complete':
          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 3000);
          updateStatus();
          break;
        case 'sync-error':
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 5000);
          break;
        case 'conflict':
          setConflicts(c => c + 1);
          break;
        default:
          break;
      }
    });

    // Update status periodically
    const interval = setInterval(() => {
      updateStatus();
      fetchConflicts();
    }, 10000);
    updateStatus();
    fetchConflicts();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const updateStatus = async () => {
    try {
      const status = await syncService.getStatus();
      setPendingOperations(status.pendingOperations);
      setConflicts(status.unresolvedConflicts);
      if (status.lastSync) {
        setLastSync(new Date(status.lastSync));
      }
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  };

  const fetchConflicts = async () => {
    try {
      const status = await syncService.getStatus();
      if (status.unresolvedConflicts > 0) {
        // Fetch actual conflict data from database
        const { db } = await import('../services/database');
        const conflicts = await db.conflicts
          .filter(c => c.resolution === 'pending' || !c.resolution)
          .toArray();
        setConflictList(conflicts);
      } else {
        setConflictList([]);
      }
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
    }
  };

  const showNotification = (title, message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/icon-192.png' });
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';

    const now = new Date();
    const diff = now - lastSync;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const handleSync = () => {
    if (isOnline && syncStatus !== 'syncing') {
      syncService.sync();
    }
  };

  const handleConflictResolved = (conflictId) => {
    setConflictList(prev => prev.filter(c => c.id !== conflictId));
    setConflicts(prev => Math.max(0, prev - 1));
    setSelectedConflict(null);
    updateStatus();
    fetchConflicts();
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-gray-500';
    if (syncStatus === 'syncing') return 'bg-blue-500';
    if (syncStatus === 'success') return 'bg-green-500';
    if (syncStatus === 'error') return 'bg-red-500';
    if (conflicts > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    if (syncStatus === 'syncing') return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (syncStatus === 'success') return <Check className="h-4 w-4" />;
    if (syncStatus === 'error') return <AlertTriangle className="h-4 w-4" />;
    if (conflicts > 0) return <AlertTriangle className="h-4 w-4" />;
    return <Wifi className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline Mode';
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'success') return 'Synced';
    if (syncStatus === 'error') return 'Sync Error';
    if (conflicts > 0) return `${conflicts} Conflicts`;
    if (pendingOperations > 0) return `${pendingOperations} Pending`;
    return 'Online';
  };

  // Get dot color for header badge
  const getDotColor = () => {
    if (!isOnline) return 'bg-gray-400';
    if (syncStatus === 'syncing') return 'bg-blue-500 animate-pulse';
    if (syncStatus === 'error' || conflicts > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <>
      {/* Header Badge - Small dot + text */}
      <div className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
          title={`Status: ${getStatusText()}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${getDotColor()}`}></span>
          <span className="text-xs font-medium text-gray-600 hidden sm:inline">
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </span>
        </button>

        {/* Details Panel - Opens as dropdown */}
        {showDetails && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <h3 className="text-sm font-semibold">Status de connexion</h3>
            </div>

            <div className="p-3 space-y-2">
              {/* Online Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Connexion</span>
                <div className="flex items-center space-x-1.5">
                  {isOnline ? (
                    <>
                      <Wifi className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-xs font-medium text-green-600">En ligne</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-gray-500" />
                      <span className="text-xs font-medium text-gray-600">Hors ligne</span>
                    </>
                  )}
                </div>
              </div>

              {/* Last Sync */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Derniere sync</span>
                <div className="flex items-center space-x-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-700">{formatLastSync()}</span>
                </div>
              </div>

              {/* Pending Operations */}
              {pendingOperations > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">En attente</span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {pendingOperations}
                  </span>
                </div>
              )}

              {/* Conflicts */}
              {conflicts > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Conflits</span>
                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                    {conflicts}
                  </span>
                </div>
              )}

              {/* Conflict Resolution */}
              {conflictList.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Conflits a resoudre:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {conflictList.slice(0, 5).map(conflict => (
                      <button
                        key={conflict.id}
                        onClick={() => setSelectedConflict(conflict)}
                        className="w-full text-left px-2 py-1 text-xs bg-yellow-50 hover:bg-yellow-100 rounded border border-yellow-200 transition-colors"
                      >
                        <span className="font-medium">{conflict.entity}</span>
                        <span className="text-gray-500 ml-1">
                          ({conflict.entityId?.substring(0, 8)}...)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sync Button */}
              {isOnline && (
                <button
                  onClick={handleSync}
                  disabled={syncStatus === 'syncing'}
                  className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs rounded-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span className="font-medium">
                    {syncStatus === 'syncing' ? 'Sync...' : 'Synchroniser'}
                  </span>
                </button>
              )}

              {/* Offline Message */}
              {!isOnline && (
                <div className="p-2 bg-gray-50 rounded text-xs text-gray-600">
                  Vos modifications seront synchronisees une fois reconnecte.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification for Offline - Only show after connectivity check */}
      {!isOnline && hasCheckedConnectivity && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-1.5 px-4 z-50">
          <p className="text-xs font-medium">
            Mode hors ligne - Les modifications seront synchronisees automatiquement
          </p>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={!!selectedConflict}
        conflict={selectedConflict}
        onClose={() => setSelectedConflict(null)}
        onResolved={handleConflictResolved}
      />
    </>
  );
}