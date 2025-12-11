import React, { useState } from 'react';
import { X, AlertTriangle, Check, Server, Smartphone, GitMerge } from 'lucide-react';
import syncService from '../services/syncService';

/**
 * Conflict Resolution Modal
 * Displays conflicting data side-by-side and allows user to choose resolution
 */
export default function ConflictResolutionModal({ isOpen, conflict, onClose, onResolved }) {
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !conflict) return null;

  const { id, entity, entityId, localData, serverData, timestamp } = conflict;

  // Find fields that differ
  const getDifferingFields = () => {
    const allKeys = new Set([
      ...Object.keys(localData || {}),
      ...Object.keys(serverData || {})
    ]);

    const diffFields = [];
    allKeys.forEach(key => {
      // Skip internal fields
      if (key.startsWith('_') || key === 'lastSync' || key === 'lastModified' || key === 'id') {
        return;
      }

      const localVal = localData?.[key];
      const serverVal = serverData?.[key];

      if (JSON.stringify(localVal) !== JSON.stringify(serverVal)) {
        diffFields.push({
          field: key,
          localValue: localVal,
          serverValue: serverVal
        });
      }
    });

    return diffFields;
  };

  const differingFields = getDifferingFields();

  const handleResolve = async (resolution, mergedData = null) => {
    setIsResolving(true);
    setError(null);

    try {
      await syncService.resolveManualConflict(id, resolution, mergedData);
      onResolved(id);
      onClose();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      setError(err.message || 'Failed to resolve conflict');
    } finally {
      setIsResolving(false);
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return <span className="text-gray-400 italic">vide</span>;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    return String(value);
  };

  const formatFieldName = (field) => {
    // Convert camelCase to readable format
    const readable = field.replace(/([A-Z])/g, ' $1').toLowerCase();
    return readable.charAt(0).toUpperCase() + readable.slice(1);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString('fr-FR');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-white" />
            <div>
              <h2 className="text-lg font-semibold text-white">Conflit de synchronisation</h2>
              <p className="text-yellow-100 text-sm">
                {entity} - {entityId?.substring(0, 8)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Conflict Info */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Detecte:</strong> {formatTimestamp(timestamp)}
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Les donnees locales et du serveur sont differentes. Choisissez quelle version conserver.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Comparison Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                    Champ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider w-1/3">
                    <div className="flex items-center space-x-2">
                      <Smartphone className="h-4 w-4" />
                      <span>Local</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider w-1/3">
                    <div className="flex items-center space-x-2">
                      <Server className="h-4 w-4" />
                      <span>Serveur</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {differingFields.map(({ field, localValue, serverValue }) => (
                  <tr key={field} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatFieldName(field)}
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-700 bg-blue-50/50">
                      <div className="max-w-xs overflow-auto">
                        {formatValue(localValue)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-green-700 bg-green-50/50">
                      <div className="max-w-xs overflow-auto">
                        {formatValue(serverValue)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Timestamps */}
          <div className="mt-4 flex justify-between text-xs text-gray-500">
            <span>
              <strong>Local:</strong> {formatTimestamp(localData?.lastSync)}
            </span>
            <span>
              <strong>Serveur:</strong> {formatTimestamp(serverData?.lastModified)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 flex flex-wrap gap-3 justify-between border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reporter
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => handleResolve('local')}
              disabled={isResolving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Smartphone className="h-4 w-4" />
              <span>Garder local</span>
            </button>

            <button
              onClick={() => handleResolve('server')}
              disabled={isResolving}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Server className="h-4 w-4" />
              <span>Garder serveur</span>
            </button>

            <button
              onClick={() => handleResolve('merged', { ...serverData, ...localData })}
              disabled={isResolving}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <GitMerge className="h-4 w-4" />
              <span>Fusionner</span>
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isResolving && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Resolution en cours...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
