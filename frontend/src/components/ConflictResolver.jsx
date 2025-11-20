import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, Code, Eye, Merge } from 'lucide-react';
import { toast } from 'react-toastify';
import syncService from '../services/syncService';
import databaseService from '../services/database';

export default function ConflictResolver({ isOpen, onClose }) {
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [mergedData, setMergedData] = useState(null);
  const [viewMode, setViewMode] = useState('visual'); // visual or json
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }
  }, [isOpen]);

  const loadConflicts = async () => {
    try {
      const pendingConflicts = await databaseService.getConflicts();
      const unresolved = pendingConflicts.filter(c => !c.resolution || c.resolution === 'pending');
      setConflicts(unresolved);
      if (unresolved.length > 0 && !selectedConflict) {
        setSelectedConflict(unresolved[0]);
        initializeMergedData(unresolved[0]);
      }
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  };

  const initializeMergedData = (conflict) => {
    // Initialize with server data and apply local changes
    const merged = { ...conflict.serverData, ...conflict.localData };
    setMergedData(merged);
  };

  const handleResolve = async (resolution, data = null) => {
    if (!selectedConflict) return;

    setLoading(true);
    try {
      await syncService.resolveManualConflict(
        selectedConflict.id,
        resolution,
        resolution === 'merged' ? data : null
      );

      // Remove resolved conflict from list
      const newConflicts = conflicts.filter(c => c.id !== selectedConflict.id);
      setConflicts(newConflicts);

      if (newConflicts.length > 0) {
        setSelectedConflict(newConflicts[0]);
        initializeMergedData(newConflicts[0]);
      } else {
        setSelectedConflict(null);
        setMergedData(null);
      }

      // Show success message
      showNotification('Conflict resolved successfully');
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      showNotification('Failed to resolve conflict', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    // Integrated with toast notification system
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  const handleMergedDataChange = (field, value) => {
    setMergedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const renderFieldComparison = (field, localValue, serverValue) => {
    const isDifferent = JSON.stringify(localValue) !== JSON.stringify(serverValue);

    if (!isDifferent) {
      return (
        <div className="py-2">
          <span className="text-sm text-gray-600">{field}:</span>
          <div className="ml-4 text-sm text-gray-800">{JSON.stringify(localValue)}</div>
        </div>
      );
    }

    return (
      <div className="py-3 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-700 mb-2">{field}</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="text-xs text-red-600 font-medium mb-1">Local Version</div>
            <div className="text-sm text-gray-800">{JSON.stringify(localValue)}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-600 font-medium mb-1">Server Version</div>
            <div className="text-sm text-gray-800">{JSON.stringify(serverValue)}</div>
          </div>
        </div>
        <div className="mt-2">
          <label className="text-xs text-gray-600">Merged Value:</label>
          <input
            type="text"
            value={mergedData?.[field] || ''}
            onChange={(e) => handleMergedDataChange(field, e.target.value)}
            className="w-full mt-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Conflict Resolution</h2>
              <span className="px-2 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                {conflicts.length} conflicts
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Check className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">No Conflicts</h3>
            <p className="text-sm text-gray-500 mt-2">All data is synchronized</p>
          </div>
        ) : (
          <div className="flex h-[calc(90vh-80px)]">
            {/* Conflict List */}
            <div className="w-1/3 bg-gray-50 border-r border-gray-200 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Conflicts</h3>
                {conflicts.map((conflict) => (
                  <button
                    key={conflict.id}
                    onClick={() => {
                      setSelectedConflict(conflict);
                      initializeMergedData(conflict);
                    }}
                    className={`w-full text-left p-3 rounded-lg mb-2 transition ${
                      selectedConflict?.id === conflict.id
                        ? 'bg-white shadow-md border-2 border-blue-500'
                        : 'bg-white hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">
                          {conflict.entity} #{conflict.entityId?.slice(-6)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(conflict.timestamp)}
                        </p>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Conflict Details */}
            {selectedConflict && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  {/* View Mode Toggle */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {selectedConflict.entity} Conflict
                    </h3>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('visual')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                          viewMode === 'visual'
                            ? 'bg-white text-gray-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Eye className="h-4 w-4 inline mr-1" />
                        Visual
                      </button>
                      <button
                        onClick={() => setViewMode('json')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                          viewMode === 'json'
                            ? 'bg-white text-gray-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Code className="h-4 w-4 inline mr-1" />
                        JSON
                      </button>
                    </div>
                  </div>

                  {/* Conflict Data */}
                  {viewMode === 'visual' ? (
                    <div className="space-y-4">
                      {Object.keys(selectedConflict.localData || {}).map((field) => (
                        <div key={field}>
                          {renderFieldComparison(
                            field,
                            selectedConflict.localData[field],
                            selectedConflict.serverData?.[field]
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Local Version</h4>
                        <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">
                          {JSON.stringify(selectedConflict.localData, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Server Version</h4>
                        <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">
                          {JSON.stringify(selectedConflict.serverData, null, 2)}
                        </pre>
                      </div>
                      {viewMode === 'json' && (
                        <div className="col-span-2">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Merged Version</h4>
                          <textarea
                            value={JSON.stringify(mergedData, null, 2)}
                            onChange={(e) => {
                              try {
                                setMergedData(JSON.parse(e.target.value));
                              } catch (error) {
                                // Invalid JSON, ignore
                              }
                            }}
                            className="w-full h-48 p-4 bg-gray-100 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resolution Actions */}
                  <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Resolution Options</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => handleResolve('local')}
                        disabled={loading}
                        className="flex flex-col items-center p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition disabled:opacity-50"
                      >
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-2">
                          <Check className="h-5 w-5 text-red-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Use Local</span>
                        <span className="text-xs text-gray-500 mt-1">Keep your changes</span>
                      </button>

                      <button
                        onClick={() => handleResolve('server')}
                        disabled={loading}
                        className="flex flex-col items-center p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                          <Check className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Use Server</span>
                        <span className="text-xs text-gray-500 mt-1">Discard your changes</span>
                      </button>

                      <button
                        onClick={() => handleResolve('merged', mergedData)}
                        disabled={loading}
                        className="flex flex-col items-center p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition disabled:opacity-50"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                          <Merge className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Use Merged</span>
                        <span className="text-xs text-gray-500 mt-1">Combine both versions</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}