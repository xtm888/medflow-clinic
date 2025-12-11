import React from 'react';
import PropTypes from 'prop-types';
import QueueItem from './QueueItem';
import EmptyState from '../../components/EmptyState';

const QueueList = React.memo(({
  patients,
  sortBy,
  onSortChange,
  calculateWaitTime,
  onViewInfo,
  onStartVisit,
  onGenerateDocument,
  onCallPatient,
  loading
}) => {
  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Patients en attente</h2>
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

      {patients.length === 0 ? (
        <div className="card">
          <EmptyState type="queue" />
        </div>
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
      )}
    </div>
  );
});

QueueList.displayName = 'QueueList';

QueueList.propTypes = {
  patients: PropTypes.arrayOf(PropTypes.object).isRequired,
  sortBy: PropTypes.string.isRequired,
  onSortChange: PropTypes.func.isRequired,
  calculateWaitTime: PropTypes.func.isRequired,
  onViewInfo: PropTypes.func.isRequired,
  onStartVisit: PropTypes.func.isRequired,
  onGenerateDocument: PropTypes.func.isRequired,
  onCallPatient: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
};

export default QueueList;
