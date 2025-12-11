import React from 'react';
import PropTypes from 'prop-types';
import { Clock, Play, CheckCircle } from 'lucide-react';

const QueueStats = React.memo(({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">En attente</p>
            <p className="text-3xl font-bold text-blue-900">{stats.totalWaiting || 0}</p>
          </div>
          <Clock className="h-10 w-10 text-blue-500 opacity-50" />
        </div>
      </div>
      <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">En consultation</p>
            <p className="text-3xl font-bold text-green-900">{stats.inProgress || 0}</p>
          </div>
          <Play className="h-10 w-10 text-green-500 opacity-50" />
        </div>
      </div>
      <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-600">Vus aujourd'hui</p>
            <p className="text-3xl font-bold text-purple-900">{stats.completedToday || 0}</p>
          </div>
          <CheckCircle className="h-10 w-10 text-purple-500 opacity-50" />
        </div>
      </div>
      <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">Temps d'attente moyen</p>
            <p className="text-3xl font-bold text-orange-900">
              {Math.round(stats.averageWaitTime || 0)} min
            </p>
          </div>
          <Clock className="h-10 w-10 text-orange-500 opacity-50" />
        </div>
      </div>
    </div>
  );
});

QueueStats.displayName = 'QueueStats';

QueueStats.propTypes = {
  stats: PropTypes.shape({
    totalWaiting: PropTypes.number,
    inProgress: PropTypes.number,
    completedToday: PropTypes.number,
    averageWaitTime: PropTypes.number
  }).isRequired
};

export default QueueStats;
