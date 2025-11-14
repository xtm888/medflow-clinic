import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Check, Clock } from 'lucide-react';
import syncService from '../services/syncService';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [pendingOperations, setPendingOperations] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [conflicts, setConflicts] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
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
    const interval = setInterval(updateStatus, 10000);
    updateStatus();

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

  return (
    <>
      {/* Main Indicator */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-full text-white shadow-lg transition-all duration-300 ${getStatusColor()}`}
        >
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </button>

        {/* Details Panel */}
        {showDetails && (
          <div className="absolute bottom-full right-0 mb-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <h3 className="text-lg font-semibold">Connection Status</h3>
            </div>

            <div className="p-4 space-y-3">
              {/* Online Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Connection</span>
                <div className="flex items-center space-x-2">
                  {isOnline ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-600">Offline</span>
                    </>
                  )}
                </div>
              </div>

              {/* Last Sync */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Sync</span>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{formatLastSync()}</span>
                </div>
              </div>

              {/* Pending Operations */}
              {pendingOperations > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending Changes</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {pendingOperations}
                  </span>
                </div>
              )}

              {/* Conflicts */}
              {conflicts > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Conflicts to Resolve</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                    {conflicts}
                  </span>
                </div>
              )}

              {/* Sync Button */}
              {isOnline && (
                <button
                  onClick={handleSync}
                  disabled={syncStatus === 'syncing'}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <RefreshCw className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span className="font-medium">
                    {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                  </span>
                </button>
              )}

              {/* Offline Message */}
              {!isOnline && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    You can continue working offline. Your changes will be saved locally and synced when you're back online.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 px-4 z-50 animate-slide-down">
          <p className="text-sm font-medium">
            You{"'"}re currently offline. Changes will sync when connection is restored.
          </p>
        </div>
      )}
    </>
  );
}