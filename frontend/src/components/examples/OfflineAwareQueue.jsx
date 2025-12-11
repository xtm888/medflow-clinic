/**
 * Example: Offline-Aware Queue Component
 * Demonstrates how to use the offline hooks and services
 *
 * USAGE PATTERN:
 * 1. Import offline hooks and services
 * 2. Use useOfflineData for fetching
 * 3. Use useOfflineMutation for changes
 * 4. Use useSyncStatus for sync indicators
 */

import React, { useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff, AlertCircle, Clock, CheckCircle } from 'lucide-react';

// Import offline hooks
import {
  useOfflineData,
  useOfflineMutation,
  useSyncStatus,
  useOnlineStatus,
  usePendingSync
} from '../../hooks/useOfflineData';

// Import offline services
import offlineQueueService from '../../services/offlineQueueService';
import offlinePatientService from '../../services/offlinePatientService';

/**
 * Offline-Aware Queue Display
 * Shows how to use all the offline features together
 */
export function OfflineAwareQueue() {
  // Track online status
  const { isOnline } = useOnlineStatus();

  // Track sync status
  const { pendingOperations, isSyncing, lastSync, triggerSync } = useSyncStatus();

  // Track pending items
  const { count: pendingCount } = usePendingSync();

  // Fetch queue data with offline fallback
  const {
    data: queueData,
    loading,
    error,
    isFromCache,
    isStale,
    refetch
  } = useOfflineData(
    () => offlineQueueService.getActiveQueue(),
    'queue',
    'active',
    {
      refetchOnReconnect: true,
      staleTime: 30, // 30 seconds
    }
  );

  // Setup mutation handler
  const { update: updateStatus, loading: mutating } = useOfflineMutation('queue');

  // Pre-cache on mount when online
  useEffect(() => {
    if (isOnline) {
      offlineQueueService.preCacheTodaysQueue();
      offlinePatientService.preCachePatients({ limit: 50 });
    }
  }, [isOnline]);

  // Handle status change
  const handleStatusChange = useCallback(async (queueId, newStatus) => {
    await updateStatus(
      () => offlineQueueService.updateStatus(queueId, newStatus),
      { status: newStatus },
      queueId
    );
    refetch();
  }, [updateStatus, refetch]);

  // Handle call next
  const handleCallNext = useCallback(async () => {
    await offlineQueueService.callNext('current-provider-id', 'Room 1');
    refetch();
  }, [refetch]);

  const queue = queueData?.data || queueData || [];

  return (
    <div className="p-4">
      {/* Status Banner */}
      <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
        isOnline ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
      }`}>
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <>
              <Wifi className="h-5 w-5" />
              <span>En ligne</span>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5" />
              <span>Hors ligne - Les modifications seront synchronisees automatiquement</span>
            </>
          )}
        </div>

        {/* Sync Indicators */}
        <div className="flex items-center space-x-4">
          {pendingCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              {pendingCount} en attente
            </span>
          )}

          {isFromCache && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
              Donnees en cache
            </span>
          )}

          {isStale && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
              Donnees obsoletes
            </span>
          )}

          <button
            onClick={triggerSync}
            disabled={!isOnline || isSyncing}
            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && !isFromCache && (
        <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5" />
          <span>Erreur de chargement. Verifiez votre connexion.</span>
        </div>
      )}

      {/* Loading State */}
      {loading && !queueData && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      )}

      {/* Queue Actions */}
      <div className="mb-4 flex space-x-2">
        <button
          onClick={handleCallNext}
          disabled={mutating || queue.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Appeler le suivant
        </button>

        <button
          onClick={refetch}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Actualiser
        </button>
      </div>

      {/* Queue List */}
      <div className="space-y-2">
        {queue.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun patient dans la file
          </div>
        ) : (
          queue.map((item) => (
            <QueueItem
              key={item.id || item._id}
              item={item}
              onStatusChange={handleStatusChange}
              disabled={mutating}
            />
          ))
        )}
      </div>

      {/* Last Sync Time */}
      {lastSync && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Derniere synchronisation: {new Date(lastSync).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Queue Item Component
 */
function QueueItem({ item, onStatusChange, disabled }) {
  const statusColors = {
    waiting: 'bg-blue-100 text-blue-800',
    called: 'bg-yellow-100 text-yellow-800',
    'in-progress': 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    'no-show': 'bg-red-100 text-red-800',
  };

  const statusIcons = {
    waiting: <Clock className="h-4 w-4" />,
    called: <AlertCircle className="h-4 w-4" />,
    'in-progress': <RefreshCw className="h-4 w-4" />,
    completed: <CheckCircle className="h-4 w-4" />,
  };

  const patient = item.patient || {};

  return (
    <div className={`p-4 rounded-lg border ${item._offline ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl font-bold text-gray-700">
            #{item.queueNumber}
          </div>
          <div>
            <div className="font-medium">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="text-sm text-gray-500">
              {patient.patientId}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {item._offline && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
              Non synchronise
            </span>
          )}

          <span className={`px-3 py-1 rounded-full text-sm flex items-center space-x-1 ${statusColors[item.status] || 'bg-gray-100'}`}>
            {statusIcons[item.status]}
            <span>{item.status}</span>
          </span>

          {/* Action Buttons */}
          {item.status === 'waiting' && (
            <button
              onClick={() => onStatusChange(item.id || item._id, 'called')}
              disabled={disabled}
              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
            >
              Appeler
            </button>
          )}

          {item.status === 'called' && (
            <button
              onClick={() => onStatusChange(item.id || item._id, 'in-progress')}
              disabled={disabled}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Demarrer
            </button>
          )}

          {item.status === 'in-progress' && (
            <button
              onClick={() => onStatusChange(item.id || item._id, 'completed')}
              disabled={disabled}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Terminer
            </button>
          )}
        </div>
      </div>

      {/* Check-in time */}
      <div className="mt-2 text-xs text-gray-500">
        Arrive: {item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString() : '-'}
      </div>
    </div>
  );
}

export default OfflineAwareQueue;
