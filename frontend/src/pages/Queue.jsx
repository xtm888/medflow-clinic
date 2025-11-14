import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Clock, User, AlertCircle, CheckCircle, Play, XCircle, ArrowUp } from 'lucide-react';
import {
  fetchQueue,
  checkInPatient,
  updateQueueStatus,
  callNextPatient,
  fetchQueueStats,
  clearQueueError
} from '../store/slices/queueSlice';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'VIP':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'PREGNANT':
      return 'bg-pink-100 text-pink-800 border-pink-300';
    case 'URGENT':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'ELDERLY':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getWaitTimeColor = (minutes) => {
  if (minutes < 15) return 'text-green-600';
  if (minutes < 30) return 'text-orange-600';
  return 'text-red-600 animate-pulse';
};

export default function Queue() {
  const dispatch = useDispatch();
  const { queues, stats, loading, error } = useSelector(state => state.queue);
  const { toasts, success, error: showError, removeToast } = useToast();

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInForm, setCheckInForm] = useState({
    patientSearch: '',
    appointmentId: '',
    consultationType: 'consultation',
    priority: 'NORMAL',
    assignedDoctor: ''
  });

  // Fetch queue on mount and every 30 seconds
  useEffect(() => {
    dispatch(fetchQueue());
    dispatch(fetchQueueStats());

    const interval = setInterval(() => {
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  // Show error toast
  useEffect(() => {
    if (error) {
      showError(error);
      dispatch(clearQueueError());
    }
  }, [error, showError, dispatch]);

  // Handle check-in submit
  const handleCheckIn = async (e) => {
    e.preventDefault();

    if (!checkInForm.appointmentId) {
      showError('Please enter an appointment ID');
      return;
    }

    try {
      await dispatch(checkInPatient({
        appointmentId: checkInForm.appointmentId,
        priority: checkInForm.priority
      })).unwrap();

      success('Patient checked in successfully!');
      setShowCheckInModal(false);
      setCheckInForm({
        patientSearch: '',
        appointmentId: '',
        consultationType: 'consultation',
        priority: 'NORMAL',
        assignedDoctor: ''
      });

      // Refresh queue
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    } catch (err) {
      showError(err || 'Failed to check in patient');
    }
  };

  // Handle call patient
  const handleCallPatient = async (queueEntry) => {
    const roomNumber = prompt('Enter room number:');
    if (!roomNumber) return;

    try {
      await dispatch(updateQueueStatus({
        id: queueEntry.appointmentId,
        status: 'in-progress',
        roomNumber
      })).unwrap();

      success(`${queueEntry.patient.firstName} called to room ${roomNumber}`);
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    } catch (err) {
      showError(err || 'Failed to call patient');
    }
  };

  // Handle complete consultation
  const handleComplete = async (queueEntry) => {
    if (!window.confirm('Mark this consultation as completed?')) {
      return;
    }

    try {
      await dispatch(updateQueueStatus({
        id: queueEntry.appointmentId,
        status: 'completed'
      })).unwrap();

      success('Consultation completed');
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    } catch (err) {
      showError(err || 'Failed to complete consultation');
    }
  };

  // Call next patient automatically
  const handleCallNext = async (department = null) => {
    try {
      const result = await dispatch(callNextPatient({
        department,
        doctorId: null
      })).unwrap();

      if (result.data) {
        success(`Next patient: ${result.data.patient.firstName} ${result.data.patient.lastName}`);
        dispatch(fetchQueue());
        dispatch(fetchQueueStats());
      }
    } catch (err) {
      showError(err || 'No patients in queue');
    }
  };

  // Flatten queues for display
  const allQueues = Object.values(queues).flat();
  const waitingPatients = allQueues.filter(p => p.status === 'checked-in');
  const inProgressPatients = allQueues.filter(p => p.status === 'in-progress');

  if (loading && allQueues.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">File d'Attente</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion en temps réel de la file d'attente des patients
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => handleCallNext()}
            className="btn btn-success flex items-center space-x-2"
            disabled={loading || waitingPatients.length === 0}
          >
            <Play className="h-5 w-5" />
            <span>Appeler Suivant</span>
          </button>
          <button
            onClick={() => setShowCheckInModal(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <User className="h-5 w-5" />
            <span>Enregistrer arrivée</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
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

      {/* Main Queue Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waiting Patients */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Patients en attente</h2>
            <select className="input w-48">
              <option>Trier par priorité</option>
              <option>Trier par heure d'arrivée</option>
              <option>Trier par temps d'attente</option>
            </select>
          </div>

          {waitingPatients.length === 0 ? (
            <div className="card text-center py-12">
              <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg">Aucun patient en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingPatients.map((patient) => (
                <div
                  key={patient.appointmentId}
                  className={`card hover:shadow-lg transition-all duration-200 ${
                    patient.estimatedWaitTime > 30 ? 'ring-2 ring-red-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Priority Indicator */}
                      <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${getPriorityColor(patient.priority)} border-2 flex items-center justify-center`}>
                        <span className="text-2xl font-bold">#{patient.queueNumber}</span>
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {patient.patient.firstName} {patient.patient.lastName}
                          </h3>
                          {patient.priority !== 'NORMAL' && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(patient.priority)}`}>
                              {patient.priority === 'VIP' ? 'VIP' :
                               patient.priority === 'PREGNANT' ? 'Enceinte' :
                               patient.priority === 'URGENT' ? 'Urgent' :
                               'Âgé'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">ID: {patient.patient.patientId}</p>
                        {patient.provider && (
                          <p className="text-sm text-gray-500 mt-1">
                            Médecin: Dr. {patient.provider.firstName} {patient.provider.lastName}
                          </p>
                        )}
                      </div>

                      {/* Wait Time */}
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <Clock className={`h-5 w-5 ${getWaitTimeColor(patient.estimatedWaitTime || 0)}`} />
                          <span className={`text-2xl font-bold ${getWaitTimeColor(patient.estimatedWaitTime || 0)}`}>
                            {patient.estimatedWaitTime || 0}
                          </span>
                          <span className="text-sm text-gray-500">min</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Arrivé à {new Date(patient.checkInTime).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleCallPatient(patient)}
                        className="btn btn-success text-xs px-3 py-1.5"
                        disabled={loading}
                      >
                        Appeler
                      </button>
                      <button
                        className="btn btn-secondary text-xs px-3 py-1.5"
                        disabled={loading}
                      >
                        Modifier
                      </button>
                    </div>
                  </div>

                  {/* Alert for long waits */}
                  {patient.estimatedWaitTime > 30 && (
                    <div className="mt-3 pt-3 border-t border-red-200 flex items-center text-red-600">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">Temps d'attente élevé - Priorité requise</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Current Consultations & Alerts */}
        <div className="space-y-4">
          {/* In Progress */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">En consultation</h2>
            {inProgressPatients.length === 0 ? (
              <div className="card bg-gray-50 text-center py-8">
                <p className="text-gray-500">Aucune consultation en cours</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inProgressPatients.map((patient) => (
                  <div key={patient.appointmentId} className="card bg-green-50 border-green-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <h3 className="font-semibold text-green-900">
                            {patient.patient.firstName} {patient.patient.lastName}
                          </h3>
                        </div>
                        <p className="text-sm text-green-700">ID: {patient.patient.patientId}</p>
                        {patient.roomNumber && (
                          <p className="text-sm text-green-600 mt-1">Salle {patient.roomNumber}</p>
                        )}
                        {patient.provider && (
                          <p className="text-xs text-green-600 mt-1">
                            Dr. {patient.provider.firstName} {patient.provider.lastName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleComplete(patient)}
                        className="btn btn-success text-xs"
                        disabled={loading}
                      >
                        Terminer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Alertes</h2>
            <div className="space-y-3">
              {waitingPatients.some(p => p.estimatedWaitTime > 30) && (
                <div className="card bg-red-50 border-red-200">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900">Attente prolongée</p>
                      <p className="text-sm text-red-700 mt-1">
                        {waitingPatients.filter(p => p.estimatedWaitTime > 30).length} patient(s)
                        attendent depuis plus de 30 minutes
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {waitingPatients.filter(p => p.priority !== 'NORMAL').length > 0 && (
                <div className="card bg-blue-50 border-blue-200">
                  <div className="flex items-start space-x-3">
                    <ArrowUp className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900">Haute priorité</p>
                      <p className="text-sm text-blue-700 mt-1">
                        {waitingPatients.filter(p => p.priority !== 'NORMAL').length} patient(s)
                        avec priorité élevée
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Check-in Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Enregistrer une arrivée</h2>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCheckIn} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Rendez-vous *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter appointment ID..."
                  value={checkInForm.appointmentId}
                  onChange={(e) => setCheckInForm({
                    ...checkInForm,
                    appointmentId: e.target.value
                  })}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the appointment ID to check in the patient
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de consultation
                </label>
                <select
                  className="input"
                  value={checkInForm.consultationType}
                  onChange={(e) => setCheckInForm({
                    ...checkInForm,
                    consultationType: e.target.value
                  })}
                >
                  <option value="consultation">Consultation générale</option>
                  <option value="emergency">Urgence</option>
                  <option value="follow-up">Suivi</option>
                  <option value="vaccination">Vaccination</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Niveau de priorité
                </label>
                <select
                  className="input"
                  value={checkInForm.priority}
                  onChange={(e) => setCheckInForm({
                    ...checkInForm,
                    priority: e.target.value
                  })}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="VIP">VIP</option>
                  <option value="PREGNANT">Femme enceinte</option>
                  <option value="ELDERLY">Personne âgée</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !checkInForm.appointmentId}
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
