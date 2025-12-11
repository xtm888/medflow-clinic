import React from 'react';
import PropTypes from 'prop-types';
import { Clock, FileText, Volume2, Eye, AlertCircle } from 'lucide-react';
import { PatientPhotoAvatar } from '../../components/biometric';

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'vip':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'pregnant':
      return 'bg-pink-100 text-pink-800 border-pink-300';
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'elderly':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'emergency':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getWaitTimeColor = (minutes) => {
  if (minutes < 15) return 'text-green-600';
  if (minutes < 30) return 'text-orange-600';
  return 'text-red-600 animate-pulse';
};

const getWaitTimeBarColor = (minutes) => {
  if (minutes < 15) return 'border-l-8 border-green-500 bg-green-50/30';
  if (minutes < 30) return 'border-l-8 border-orange-500 bg-orange-50/30';
  return 'border-l-8 border-red-500 bg-red-50/30 animate-pulse';
};

const getPriorityLabel = (priority) => {
  switch (priority) {
    case 'vip':
      return 'VIP';
    case 'pregnant':
      return 'Enceinte';
    case 'urgent':
      return 'Urgent';
    case 'elderly':
      return 'Âgé';
    case 'emergency':
      return 'Urgence';
    case 'high':
      return 'Priorité';
    default:
      return priority;
  }
};

const QueueItem = React.memo(({
  patient,
  waitTime,
  onViewInfo,
  onStartVisit,
  onGenerateDocument,
  onCallPatient,
  loading
}) => {
  return (
    <div className={`card hover:shadow-lg transition-all duration-200 ${getWaitTimeBarColor(waitTime)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          {/* Priority Indicator */}
          <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${getPriorityColor(patient.priority)} border-2 flex items-center justify-center`}>
            <span className="text-2xl font-bold">#{patient.queueNumber}</span>
          </div>

          {/* Patient Photo */}
          <PatientPhotoAvatar
            patient={patient.patient}
            size="lg"
            showBiometricBadge={true}
          />

          {/* Patient Info */}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {patient.patient?.firstName || 'N/A'} {patient.patient?.lastName || ''}
              </h3>
              {patient.priority !== 'normal' && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(patient.priority)}`}>
                  {getPriorityLabel(patient.priority)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">ID: {patient.patient?.patientId || 'N/A'}</p>
            {patient.provider && (
              <p className="text-sm text-gray-500 mt-1">
                Médecin: Dr. {patient.provider.firstName} {patient.provider.lastName}
              </p>
            )}
          </div>

          {/* Wait Time */}
          <div className="text-right">
            <div className="flex items-center space-x-2">
              <Clock className={`h-5 w-5 ${getWaitTimeColor(waitTime)}`} />
              <span className={`text-2xl font-bold ${getWaitTimeColor(waitTime)}`}>
                {waitTime}
              </span>
              <span className="text-sm text-gray-500">min</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Arrivé à {patient.checkInTime
                ? new Date(patient.checkInTime).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '-'}
            </p>
            {patient.estimatedWaitTime && waitTime < patient.estimatedWaitTime && (
              <p className="text-xs text-blue-600 mt-0.5">
                ~{patient.estimatedWaitTime - waitTime} min restant
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col space-y-2 ml-4">
          <button
            onClick={() => onViewInfo(patient.patient)}
            className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px] flex items-center justify-center space-x-1 border-purple-300 text-purple-700 hover:bg-purple-50 touch-manipulation"
            title="Voir infos patient"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Infos</span>
          </button>
          <button
            onClick={() => onStartVisit(patient)}
            className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px] flex items-center justify-center space-x-1 touch-manipulation"
            disabled={loading}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Commencer</span>
          </button>
          <button
            onClick={() => onGenerateDocument(patient)}
            className="btn btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px] flex items-center justify-center space-x-1 touch-manipulation"
            title="Générer un certificat ou document"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Certificat</span>
          </button>
          <button
            onClick={() => onCallPatient(patient)}
            className="btn btn-success text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px] flex items-center justify-center touch-manipulation"
            disabled={loading}
          >
            <Volume2 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Appeler</span>
          </button>
        </div>
      </div>

      {/* Alert for long waits */}
      {waitTime > 30 && (
        <div className="mt-3 pt-3 border-t border-red-200 flex items-center text-red-600">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">Temps d'attente élevé - Priorité requise</span>
        </div>
      )}
    </div>
  );
});

QueueItem.displayName = 'QueueItem';

QueueItem.propTypes = {
  patient: PropTypes.shape({
    appointmentId: PropTypes.string.isRequired,
    queueNumber: PropTypes.number.isRequired,
    priority: PropTypes.string.isRequired,
    checkInTime: PropTypes.string,
    estimatedWaitTime: PropTypes.number,
    patient: PropTypes.shape({
      _id: PropTypes.string,
      id: PropTypes.string,
      firstName: PropTypes.string,
      lastName: PropTypes.string,
      patientId: PropTypes.string
    }),
    provider: PropTypes.shape({
      firstName: PropTypes.string,
      lastName: PropTypes.string
    })
  }).isRequired,
  waitTime: PropTypes.number.isRequired,
  onViewInfo: PropTypes.func.isRequired,
  onStartVisit: PropTypes.func.isRequired,
  onGenerateDocument: PropTypes.func.isRequired,
  onCallPatient: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
};

export default QueueItem;
