import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Clock, User, AlertCircle, CheckCircle, Play, XCircle, ArrowUp, FileText } from 'lucide-react';
import {
  fetchQueue,
  checkInPatient,
  updateQueueStatus,
  callNextPatient,
  fetchQueueStats,
  clearQueueError
} from '../store/slices/queueSlice';
import DocumentGenerator from '../components/documents/DocumentGenerator';
import EmptyState from '../components/EmptyState';
import { PatientSelector } from '../modules/patient';

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

export default function Queue() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { queues, stats, loading, error } = useSelector(state => state.queue);

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInForm, setCheckInForm] = useState({
    patientSearch: '',
    appointmentId: '',
    consultationType: 'consultation',
    priority: 'normal',
    assignedDoctor: ''
  });
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [selectedWalkInPatient, setSelectedWalkInPatient] = useState(null);
  const [walkInForm, setWalkInForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    reason: '',
    priority: 'normal'
  });
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [selectedPatientForDoc, setSelectedPatientForDoc] = useState(null);
  const [sortBy, setSortBy] = useState('priority');

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
      toast.error(error);
      dispatch(clearQueueError());
    }
  }, [error, dispatch]);

  // Handle check-in submit
  const handleCheckIn = async (e) => {
    e.preventDefault();

    if (!checkInForm.appointmentId) {
      toast.error('Please enter an appointment ID');
      return;
    }

    try {
      await dispatch(checkInPatient({
        appointmentId: checkInForm.appointmentId,
        priority: checkInForm.priority.toLowerCase() // Ensure lowercase
      })).unwrap();

      toast.success('Patient checked in successfully!');
      setShowCheckInModal(false);
      setCheckInForm({
        patientSearch: '',
        appointmentId: '',
        consultationType: 'consultation',
        priority: 'normal',
        assignedDoctor: ''
      });

      // Refresh queue
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    } catch (err) {
      toast.error(err || 'Failed to check in patient');
    }
  };

  // Handle walk-in patient submit
  const handleWalkIn = async (e) => {
    e.preventDefault();

    // If existing patient selected, use their info
    if (selectedWalkInPatient) {
      if (!walkInForm.reason) {
        toast.error('Veuillez indiquer la raison de la visite');
        return;
      }

      try {
        await dispatch(checkInPatient({
          walkIn: true,
          patientId: selectedWalkInPatient._id || selectedWalkInPatient.id,
          patientInfo: {
            firstName: selectedWalkInPatient.firstName,
            lastName: selectedWalkInPatient.lastName,
            phoneNumber: selectedWalkInPatient.phoneNumber || selectedWalkInPatient.phone
          },
          reason: walkInForm.reason,
          priority: walkInForm.priority
        })).unwrap();

        toast.success('Patient sans RDV ajouté à la file!');
        setShowWalkInModal(false);
        setSelectedWalkInPatient(null);
        setWalkInForm({
          firstName: '',
          lastName: '',
          phoneNumber: '',
          reason: '',
          priority: 'normal'
        });

        dispatch(fetchQueue());
        dispatch(fetchQueueStats());
      } catch (err) {
        toast.error(err || 'Échec d\'ajout du patient');
      }
      return;
    }

    // New patient - validate all fields
    if (!walkInForm.firstName || !walkInForm.lastName || !walkInForm.phoneNumber || !walkInForm.reason) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    try {
      // Create walk-in patient directly in queue
      await dispatch(checkInPatient({
        walkIn: true,
        patientInfo: {
          firstName: walkInForm.firstName,
          lastName: walkInForm.lastName,
          phoneNumber: walkInForm.phoneNumber
        },
        reason: walkInForm.reason,
        priority: walkInForm.priority.toLowerCase() // Ensure lowercase
      })).unwrap();

      toast.success('Patient sans RDV ajouté à la file!');
      setShowWalkInModal(false);
      setSelectedWalkInPatient(null);
      setWalkInForm({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        reason: '',
        priority: 'normal'
      });

      // Refresh queue
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    } catch (err) {
      toast.error(err || 'Échec d\'ajout du patient');
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

      toast.success(`${queueEntry.patient?.firstName || 'Patient'} called to room ${roomNumber}`);
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());

      // Auto-navigate to consultation if visitId exists
      if (queueEntry.visitId) {
        toast.info('Opening consultation...');
        navigate(`/ophthalmology/consultation/${queueEntry.patient._id}?visitId=${queueEntry.visitId}`);
      } else if (queueEntry.patient?._id) {
        // If no visit yet, navigate to new visit creation
        toast.info('Creating new consultation...');
        navigate(`/visits/new/${queueEntry.patient._id}`);
      }
    } catch (err) {
      toast.error(err || 'Failed to call patient');
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

      toast.success('Consultation completed');
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    } catch (err) {
      toast.error(err || 'Failed to complete consultation');
    }
  };

  // Start visit for patient
  const handleStartVisit = async (queueEntry) => {
    try {
      // Update appointment status to in-progress
      await dispatch(updateQueueStatus({
        id: queueEntry.appointmentId,
        status: 'in-progress'
      })).unwrap();

      // Navigate to visit page - use patient._id and pass appointment ID
      const patientId = queueEntry.patient?._id || queueEntry.patient?.id;
      const appointmentId = queueEntry.appointmentId || queueEntry._id;

      if (patientId) {
        // Pass appointment ID as query param so visit can be linked
        navigate(`/visits/new/${patientId}?appointmentId=${appointmentId}`);
      } else {
        toast.error('Patient ID not available');
      }
    } catch (err) {
      toast.error(err || 'Failed to start visit');
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
        toast.success(`Next patient: ${result.data.patient.firstName} ${result.data.patient.lastName}`);
        dispatch(fetchQueue());
        dispatch(fetchQueueStats());
      }
    } catch (err) {
      toast.error(err || 'No patients in queue');
    }
  };

  // Flatten queues for display
  const allQueues = queues && typeof queues === 'object' && !Array.isArray(queues)
    ? Object.values(queues).flat()
    : [];

  // Priority order for sorting
  const priorityOrder = {
    'emergency': 0,
    'urgent': 1,
    'vip': 2,
    'pregnant': 3,
    'elderly': 4,
    'high': 5,
    'normal': 6
  };

  // Sort waiting patients based on selected sort method
  const sortPatients = (patients) => {
    const sorted = [...patients];
    const getTime = (dateStr) => {
      if (!dateStr) return 0;
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? 0 : date.getTime();
    };

    switch (sortBy) {
      case 'priority':
        return sorted.sort((a, b) => {
          const priorityDiff = (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
          if (priorityDiff !== 0) return priorityDiff;
          // If same priority, sort by arrival time
          return getTime(a.checkInTime) - getTime(b.checkInTime);
        });
      case 'arrival':
        return sorted.sort((a, b) => getTime(a.checkInTime) - getTime(b.checkInTime));
      case 'waitTime':
        return sorted.sort((a, b) => (b.estimatedWaitTime || 0) - (a.estimatedWaitTime || 0));
      default:
        return sorted;
    }
  };

  const waitingPatients = sortPatients(allQueues.filter(p => p.status === 'checked-in'));
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
          <button
            onClick={() => setShowWalkInModal(true)}
            className="btn btn-success flex items-center space-x-2"
          >
            <User className="h-5 w-5" />
            <span>Patient sans RDV</span>
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
            <select
              className="input w-48"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="priority">Trier par priorité</option>
              <option value="arrival">Trier par heure d'arrivée</option>
              <option value="waitTime">Trier par temps d'attente</option>
            </select>
          </div>

          {waitingPatients.length === 0 ? (
            <div className="card">
              <EmptyState type="queue" />
            </div>
          ) : (
            <div className="space-y-3">
              {waitingPatients.map((patient) => (
                <div
                  key={patient.appointmentId}
                  className={`card hover:shadow-lg transition-all duration-200 ${getWaitTimeBarColor(patient.estimatedWaitTime || 0)}`}
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
                            {patient.patient?.firstName || 'N/A'} {patient.patient?.lastName || ''}
                          </h3>
                          {patient.priority !== 'normal' && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(patient.priority)}`}>
                              {patient.priority === 'vip' ? 'VIP' :
                               patient.priority === 'pregnant' ? 'Enceinte' :
                               patient.priority === 'urgent' ? 'Urgent' :
                               patient.priority === 'elderly' ? 'Âgé' :
                               patient.priority === 'emergency' ? 'Urgence' :
                               patient.priority === 'high' ? 'Priorité' :
                               patient.priority}
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
                          <Clock className={`h-5 w-5 ${getWaitTimeColor(patient.estimatedWaitTime || 0)}`} />
                          <span className={`text-2xl font-bold ${getWaitTimeColor(patient.estimatedWaitTime || 0)}`}>
                            {patient.estimatedWaitTime || 0}
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
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleStartVisit(patient)}
                        className="btn btn-primary text-xs px-3 py-1.5 flex items-center space-x-1"
                        disabled={loading}
                      >
                        <FileText className="h-3 w-3" />
                        <span>Commencer</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPatientForDoc(patient);
                          setShowDocumentGenerator(true);
                        }}
                        className="btn btn-secondary text-xs px-3 py-1.5 flex items-center space-x-1"
                        title="Générer un certificat ou document"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Certificat</span>
                      </button>
                      <button
                        onClick={() => handleCallPatient(patient)}
                        className="btn btn-success text-xs px-3 py-1.5"
                        disabled={loading}
                      >
                        Appeler
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
                            {patient.patient?.firstName || 'N/A'} {patient.patient?.lastName || ''}
                          </h3>
                        </div>
                        <p className="text-sm text-green-700">ID: {patient.patient?.patientId || 'N/A'}</p>
                        {patient.roomNumber && (
                          <p className="text-sm text-green-600 mt-1">Salle {patient.roomNumber}</p>
                        )}
                        {patient.provider && (
                          <p className="text-xs text-green-600 mt-1">
                            Dr. {patient.provider.firstName} {patient.provider.lastName}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => handleStartVisit(patient)}
                          className="btn btn-primary text-xs px-3 py-1 flex items-center space-x-1"
                          disabled={loading}
                        >
                          <FileText className="h-3 w-3" />
                          <span>Ouvrir</span>
                        </button>
                        <button
                          onClick={() => handleComplete(patient)}
                          className="btn btn-success text-xs"
                          disabled={loading}
                        >
                          Terminer
                        </button>
                      </div>
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

              {waitingPatients.filter(p => p.priority !== 'normal').length > 0 && (
                <div className="card bg-blue-50 border-blue-200">
                  <div className="flex items-start space-x-3">
                    <ArrowUp className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900">Haute priorité</p>
                      <p className="text-sm text-blue-700 mt-1">
                        {waitingPatients.filter(p => p.priority !== 'normal').length} patient(s)
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
                  <option value="normal">Normal</option>
                  <option value="vip">VIP</option>
                  <option value="pregnant">Femme enceinte</option>
                  <option value="elderly">Personne âgée</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">Haute priorité</option>
                  <option value="emergency">Urgence</option>
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

      {/* Walk-In Patient Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Patient sans RDV</h2>
              <button
                onClick={() => {
                  setShowWalkInModal(false);
                  setSelectedWalkInPatient(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWalkIn} className="p-6 space-y-4">
              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rechercher un patient existant
                </label>
                <PatientSelector
                  mode="dropdown"
                  value={selectedWalkInPatient}
                  onChange={(patient) => {
                    setSelectedWalkInPatient(patient);
                    if (patient) {
                      setWalkInForm({
                        ...walkInForm,
                        firstName: patient.firstName || '',
                        lastName: patient.lastName || '',
                        phoneNumber: patient.phoneNumber || patient.phone || ''
                      });
                    }
                  }}
                  placeholder="Rechercher par nom ou téléphone..."
                  showCreateButton={false}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Recherchez un patient existant ou entrez les informations ci-dessous
                </p>
              </div>

              {/* Show selected patient info or manual entry */}
              {selectedWalkInPatient ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">
                        {selectedWalkInPatient.firstName} {selectedWalkInPatient.lastName}
                      </p>
                      <p className="text-sm text-blue-700">
                        ID: {selectedWalkInPatient.patientId || 'N/A'}
                      </p>
                      {selectedWalkInPatient.phoneNumber && (
                        <p className="text-sm text-blue-600">
                          Tél: {selectedWalkInPatient.phoneNumber}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWalkInPatient(null);
                        setWalkInForm({
                          ...walkInForm,
                          firstName: '',
                          lastName: '',
                          phoneNumber: ''
                        });
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Changer
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Ou créer un nouveau patient:
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Prénom <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={walkInForm.firstName}
                          onChange={(e) => setWalkInForm({...walkInForm, firstName: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nom <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={walkInForm.lastName}
                          onChange={(e) => setWalkInForm({...walkInForm, lastName: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={walkInForm.phoneNumber}
                      onChange={(e) => setWalkInForm({...walkInForm, phoneNumber: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="+243 81 234 5678"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison de la visite <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={walkInForm.reason}
                  onChange={(e) => setWalkInForm({...walkInForm, reason: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priorité
                </label>
                <select
                  value={walkInForm.priority}
                  onChange={(e) => setWalkInForm({...walkInForm, priority: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">Normal</option>
                  <option value="vip">VIP</option>
                  <option value="urgent">Urgent</option>
                  <option value="elderly">Personne âgée</option>
                  <option value="pregnant">Femme enceinte</option>
                  <option value="high">Haute priorité</option>
                  <option value="emergency">Urgence</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-success">
                  Ajouter à la file
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && selectedPatientForDoc && selectedPatientForDoc.patient && (
        <DocumentGenerator
          patientId={selectedPatientForDoc.patient?._id || selectedPatientForDoc.patient?.id}
          visitId={selectedPatientForDoc.visit?._id}
          onClose={() => {
            setShowDocumentGenerator(false);
            setSelectedPatientForDoc(null);
          }}
          onDocumentGenerated={(doc) => {
            toast.success('Document généré avec succès!');
            setShowDocumentGenerator(false);
            setSelectedPatientForDoc(null);
          }}
        />
      )}
    </div>
  );
}
