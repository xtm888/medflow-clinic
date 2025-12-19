/**
 * VirtualizedQueueList Component
 *
 * A virtualized version of the QueueList for better performance with large patient queues.
 * Uses @tanstack/react-virtual for efficient rendering.
 */
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { VirtualizedList } from '../../components/virtualized';
import QueueItem from './QueueItem';
import EmptyState from '../../components/EmptyState';

/**
 * Estimate item height based on patient data
 * Base height: ~130px for normal items
 * Long wait alert adds ~40px
 */
const estimateItemSize = (patient, calculateWaitTime) => {
  const baseHeight = 160; // Base card height with padding and margins
  const alertHeight = 44; // Height of long wait alert

  if (!patient || !patient.checkInTime) {
    return baseHeight;
  }

  const waitTime = calculateWaitTime(patient.checkInTime);
  return waitTime > 30 ? baseHeight + alertHeight : baseHeight;
};

const VirtualizedQueueList = React.memo(({
  patients,
  sortBy,
  onSortChange,
  calculateWaitTime,
  onViewInfo,
  onStartVisit,
  onGenerateDocument,
  onCallPatient,
  loading,
  height = 600
}) => {
  // Memoize item size estimator
  const getEstimateSize = useCallback(
    (index) => estimateItemSize(patients[index], calculateWaitTime),
    [patients, calculateWaitTime]
  );

  // Render individual queue item
  const renderItem = useCallback(
    (patient, index) => {
      const actualWaitTime = calculateWaitTime(patient.checkInTime);
      return (
        <div style={{ paddingBottom: '12px' }}>
          <QueueItem
            patient={patient}
            waitTime={actualWaitTime}
            onViewInfo={onViewInfo}
            onStartVisit={onStartVisit}
            onGenerateDocument={onGenerateDocument}
            onCallPatient={onCallPatient}
            loading={loading}
          />
        </div>
      );
    },
    [calculateWaitTime, onViewInfo, onStartVisit, onGenerateDocument, onCallPatient, loading]
  );

  // Empty state component
  const emptyComponent = useMemo(
    () => (
      <div className="card">
        <EmptyState type="queue" />
      </div>
    ),
    []
  );

  // Loading component
  const loadingComponent = useMemo(
    () => (
      <div className="flex items-center justify-center space-x-2 text-gray-500">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
        <span>Chargement de la file d'attente...</span>
      </div>
    ),
    []
  );

  return (
    <div className="lg:col-span-2 space-y-4">
      {/* Header with sort controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Patients en attente
          {patients.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({patients.length})
            </span>
          )}
        </h2>
        <select
          className="input w-48"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="priority">Trier par priorité</option>
          <option value="arrival">Trier par heure d'arrivée</option>
          <option value="waitTime">Trier par temps d'attente</option>
        </select>
      </div>

      {/* Virtualized list or fallback for small lists */}
      {patients.length <= 10 ? (
        // For small lists, use regular rendering
        patients.length === 0 ? (
          emptyComponent
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => {
              const actualWaitTime = calculateWaitTime(patient.checkInTime);
              return (
                <QueueItem
                  key={patient.appointmentId}
                  patient={patient}
                  waitTime={actualWaitTime}
                  onViewInfo={onViewInfo}
                  onStartVisit={onStartVisit}
                  onGenerateDocument={onGenerateDocument}
                  onCallPatient={onCallPatient}
                  loading={loading}
                />
              );
            })}
          </div>
        )
      ) : (
        // For large lists, use virtualization
        <VirtualizedList
          items={patients}
          renderItem={renderItem}
          estimateSize={getEstimateSize}
          height={height}
          overscan={3}
          loading={loading && patients.length === 0}
          loadingComponent={loadingComponent}
          emptyComponent={emptyComponent}
          className="queue-list-virtualized"
        />
      )}
    </div>
  );
});

VirtualizedQueueList.displayName = 'VirtualizedQueueList';

VirtualizedQueueList.propTypes = {
  patients: PropTypes.arrayOf(PropTypes.object).isRequired,
  sortBy: PropTypes.string.isRequired,
  onSortChange: PropTypes.func.isRequired,
  calculateWaitTime: PropTypes.func.isRequired,
  onViewInfo: PropTypes.func.isRequired,
  onStartVisit: PropTypes.func.isRequired,
  onGenerateDocument: PropTypes.func.isRequired,
  onCallPatient: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  height: PropTypes.number
};

export default VirtualizedQueueList;
