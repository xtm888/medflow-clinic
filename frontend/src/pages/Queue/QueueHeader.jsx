import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BarChart3, Monitor, Play, User, Wifi, WifiOff, Keyboard } from 'lucide-react';
import PermissionGate from '../../components/PermissionGate';

const QueueHeader = React.memo(({
  wsConnected,
  onCallNext,
  onOpenCheckIn,
  onOpenWalkIn,
  onShowShortcuts,
  loading,
  waitingCount
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center space-x-3">
          <h1 className="text-3xl font-bold text-gray-900">File d'Attente</h1>
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
            wsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{wsConnected ? 'En direct' : 'Hors ligne'}</span>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Gestion en temps réel de la file d'attente des patients
          <button
            onClick={onShowShortcuts}
            className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
            title="Raccourcis clavier (appuyez sur ?)"
          >
            <Keyboard className="h-3 w-3 mr-1" />
            <span className="text-xs">Raccourcis</span>
          </button>
        </p>
      </div>
      <div className="flex space-x-3">
        <Link
          to="/queue/analytics"
          className="btn btn-secondary flex items-center space-x-2"
        >
          <BarChart3 className="h-5 w-5" />
          <span>Analyses</span>
        </Link>
        <a
          href="/display-board"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary flex items-center space-x-2"
        >
          <Monitor className="h-5 w-5" />
          <span>Affichage</span>
        </a>
        <PermissionGate permission="manage_queue">
          <button
            onClick={onCallNext}
            className="btn btn-success flex items-center space-x-2"
            disabled={loading || waitingCount === 0}
          >
            <Play className="h-5 w-5" />
            <span>Appeler Suivant</span>
          </button>
        </PermissionGate>
        <PermissionGate permission="check_in_patients">
          <button
            onClick={onOpenCheckIn}
            className="btn btn-primary flex items-center space-x-2"
          >
            <User className="h-5 w-5" />
            <span>Enregistrer arrivée</span>
          </button>
        </PermissionGate>
        <PermissionGate permission="check_in_patients">
          <button
            onClick={onOpenWalkIn}
            className="btn btn-success flex items-center space-x-2"
          >
            <User className="h-5 w-5" />
            <span>Patient sans RDV</span>
          </button>
        </PermissionGate>
      </div>
    </div>
  );
});

QueueHeader.displayName = 'QueueHeader';

QueueHeader.propTypes = {
  wsConnected: PropTypes.bool.isRequired,
  onCallNext: PropTypes.func.isRequired,
  onOpenCheckIn: PropTypes.func.isRequired,
  onOpenWalkIn: PropTypes.func.isRequired,
  onShowShortcuts: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  waitingCount: PropTypes.number.isRequired
};

export default QueueHeader;
