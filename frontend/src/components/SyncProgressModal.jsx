import React, { useState, useEffect, useCallback } from 'react';
import {
  X, RefreshCw, Check, AlertCircle, Clock, Database,
  ChevronDown, ChevronUp, Building, Wifi, WifiOff,
  CheckCircle, XCircle, Loader, AlertTriangle
} from 'lucide-react';
import { useClinic } from '../contexts/ClinicContext';
import clinicSyncService from '../services/clinicSyncService';
import { SYNC_ENTITIES, getSyncIntervalForClinic } from '../services/syncService';

/**
 * Sync Progress Modal
 * Shows real-time sync status and progress for multi-clinic offline support
 */
export default function SyncProgressModal({ isOpen, onClose }) {
  const { selectedClinic, selectedClinicId, selectedClinicName } = useClinic();
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [entityResults, setEntityResults] = useState({});

  // Load sync status on open
  useEffect(() => {
    if (isOpen) {
      const status = clinicSyncService.getSyncStatus();
      setSyncStatus(status);
    }
  }, [isOpen]);

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = clinicSyncService.subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    if (!isOpen || !syncStatus?.lastSyncTime) return;

    const interval = setInterval(() => {
      setSyncStatus(clinicSyncService.getSyncStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, syncStatus?.lastSyncTime]);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) {
      setError('Vous devez être en ligne pour synchroniser.');
      return;
    }

    if (!selectedClinicId) {
      setError('Veuillez sélectionner une clinique.');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setProgress(null);
    setEntityResults({});

    try {
      const result = await clinicSyncService.pullClinicData(
        selectedClinicId,
        SYNC_ENTITIES,
        (progressInfo) => {
          setProgress(progressInfo);
          if (progressInfo.entity) {
            setEntityResults(prev => ({
              ...prev,
              [progressInfo.entity]: 'loading'
            }));
          }
        }
      );

      // Update entity results
      Object.entries(result.entities).forEach(([entity, data]) => {
        setEntityResults(prev => ({
          ...prev,
          [entity]: data.success ? 'success' : 'error'
        }));
      });

      if (!result.success) {
        setError(`Synchronisation partielle: ${result.failed} entité(s) en erreur`);
      }

      // Update sync status
      setSyncStatus(clinicSyncService.getSyncStatus());
      clinicSyncService.notifySyncStatusChange();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
      setProgress(null);
    }
  }, [selectedClinicId]);

  if (!isOpen) return null;

  const formatDuration = (ms) => {
    if (!ms || ms < 0) return '—';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatTime = (date) => {
    if (!date) return 'Jamais';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (isStale) => {
    if (!syncStatus?.lastSyncTime) return 'text-gray-500';
    return isStale ? 'text-orange-500' : 'text-green-500';
  };

  const getEntityIcon = (status) => {
    switch (status) {
      case 'loading':
        return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const syncInterval = selectedClinicId ? getSyncIntervalForClinic(selectedClinicId) : 900000;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <RefreshCw className={`h-6 w-6 text-white ${isSyncing ? 'animate-spin' : ''}`} />
            <div>
              <h2 className="text-lg font-semibold text-white">État de la synchronisation</h2>
              {selectedClinicName && (
                <p className="text-green-100 text-sm flex items-center">
                  <Building className="h-4 w-4 mr-1" />
                  {selectedClinicName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {navigator.onLine ? (
                <Wifi className="h-6 w-6 text-green-500" />
              ) : (
                <WifiOff className="h-6 w-6 text-red-500" />
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {navigator.onLine ? 'En ligne' : 'Hors ligne'}
                </p>
                <p className="text-sm text-gray-500">
                  Intervalle: {formatDuration(syncInterval)}
                </p>
              </div>
            </div>
            <div className={`text-right ${getStatusColor(syncStatus?.isStale)}`}>
              <p className="font-medium">
                {syncStatus?.isStale ? 'Données obsolètes' : 'À jour'}
              </p>
              <p className="text-sm">
                {formatTime(syncStatus?.lastSyncTime)}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress Bar */}
          {isSyncing && progress && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-600">Synchronisation en cours...</span>
                <span className="font-medium text-gray-900">{progress.percent}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-teal-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {progress.entity} ({progress.current}/{progress.total})
              </p>
            </div>
          )}

          {/* Next Sync Countdown */}
          {!isSyncing && syncStatus?.lastSyncTime && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Prochaine synchronisation dans:</span>
                <span className="font-bold text-blue-900">
                  {formatDuration(syncStatus.nextSyncIn)}
                </span>
              </div>
            </div>
          )}

          {/* Entity Details */}
          <div className="border rounded-lg">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-700">
                Détails des entités ({SYNC_ENTITIES.length})
              </span>
              {showDetails ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {showDetails && (
              <div className="max-h-48 overflow-y-auto divide-y">
                {SYNC_ENTITIES.map(entity => (
                  <div key={entity} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">
                      {entity.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    {getEntityIcon(entityResults[entity])}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
          <div className="text-sm text-gray-500">
            {syncStatus?.entitiesSynced?.length > 0 && (
              <span>{syncStatus.entitiesSynced.length} entités synchronisées</span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing || !navigator.onLine}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Synchronisation...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Synchroniser</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
