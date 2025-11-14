import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, CheckCircle, XCircle, Plus, Search, Filter } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import appointmentService from '../services/appointmentService';
import patientService from '../services/patientService';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';
import { normalizeToArray, isArray } from '../utils/apiHelpers';

export default function Appointments() {
  const { toasts, success, error: showError, removeToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // New appointment form state
  const [newAppointment, setNewAppointment] = useState({
    patient: '',
    type: 'consultation',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: 30,
    reason: '',
    notes: ''
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [appointmentsRes, patientsRes] = await Promise.all([
        appointmentService.getAppointments(),
        patientService.getPatients()
      ]);

      setAppointments(normalizeToArray(appointmentsRes));
      setPatients(normalizeToArray(patientsRes));
    } catch (err) {
      showError('Failed to load appointments');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(apt => {
    const aptDate = format(new Date(apt.date), 'yyyy-MM-dd');
    return aptDate === today;
  });
  const confirmedCount = appointments.filter(apt => apt.status === 'confirmed' || apt.status === 'CONFIRMED').length;
  const pendingCount = appointments.filter(apt => apt.status === 'pending' || apt.status === 'PENDING').length;
  const completedToday = todayAppointments.filter(apt => apt.status === 'completed' || apt.status === 'COMPLETED').length;

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    const patient = patients.find(p => p._id === apt.patient || p.id === apt.patient);
    const matchesSearch = !searchTerm || (patient &&
      (patient.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       patient.lastName?.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesStatus = filterStatus === 'all' || apt.status?.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase();
    const badges = {
      'confirmed': 'badge badge-success',
      'pending': 'badge badge-warning',
      'completed': 'badge bg-blue-100 text-blue-800',
      'cancelled': 'badge badge-danger',
      'no_show': 'badge bg-gray-100 text-gray-800'
    };
    return badges[statusLower] || 'badge';
  };

  const getStatusText = (status) => {
    const statusLower = status?.toLowerCase();
    const texts = {
      'confirmed': 'Confirmé',
      'pending': 'En attente',
      'completed': 'Terminé',
      'cancelled': 'Annulé',
      'no_show': 'Absence'
    };
    return texts[statusLower] || status;
  };

  // Get patient name
  const getPatientName = (patientId) => {
    const patient = patients.find(p => p._id === patientId || p.id === patientId);
    if (patient) {
      return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
    }
    return 'Patient inconnu';
  };

  // Create appointment
  const handleBookAppointment = async () => {
    if (!newAppointment.patient) {
      showError('Please select a patient');
      return;
    }

    try {
      setSubmitting(true);

      const appointmentData = {
        patient: newAppointment.patient,
        type: newAppointment.type,
        date: new Date(`${newAppointment.date}T${newAppointment.time}`),
        time: newAppointment.time,
        duration: newAppointment.duration,
        reason: newAppointment.reason,
        notes: newAppointment.notes,
        status: 'pending'
      };

      await appointmentService.createAppointment(appointmentData);

      success('Appointment created successfully!');
      setShowBookingModal(false);

      // Reset form
      setNewAppointment({
        patient: '',
        type: 'consultation',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        duration: 30,
        reason: '',
        notes: ''
      });

      // Refresh appointments
      fetchData();

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create appointment');
      console.error('Error creating appointment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm appointment
  const handleConfirm = async (appointmentId) => {
    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));

      await appointmentService.updateAppointment(appointmentId, {
        status: 'confirmed'
      });

      success('Appointment confirmed!');
      fetchData();

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to confirm appointment');
      console.error('Error confirming appointment:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  // Cancel appointment
  const handleCancel = async (appointmentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler ce rendez-vous?')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));

      await appointmentService.cancelAppointment(appointmentId, {
        reason: 'Cancelled by staff',
        cancelledBy: 'staff'
      });

      success('Appointment cancelled!');
      fetchData();

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to cancel appointment');
      console.error('Error cancelling appointment:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  // Start appointment (move to in-progress)
  const handleStart = async (appointmentId) => {
    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));

      await appointmentService.updateAppointment(appointmentId, {
        status: 'in-progress'
      });

      success('Appointment started!');
      fetchData();

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to start appointment');
      console.error('Error starting appointment:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  // Reject appointment
  const handleReject = async (appointmentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir refuser ce rendez-vous?')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));

      await appointmentService.updateAppointment(appointmentId, {
        status: 'cancelled'
      });

      success('Appointment rejected!');
      fetchData();

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to reject appointment');
      console.error('Error rejecting appointment:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  // Generate week view dates
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Rendez-vous</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion du calendrier et planning des consultations
          </p>
        </div>
        <button
          onClick={() => setShowBookingModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouveau rendez-vous</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Aujourd'hui</p>
              <p className="text-3xl font-bold">{todayAppointments.length}</p>
            </div>
            <Calendar className="h-10 w-10 text-blue-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">Confirmés</p>
              <p className="text-3xl font-bold">{confirmedCount}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100">En attente</p>
              <p className="text-3xl font-bold">{pendingCount}</p>
            </div>
            <Clock className="h-10 w-10 text-orange-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100">Complétés (Aujourd'hui)</p>
              <p className="text-3xl font-bold">{completedToday}</p>
            </div>
            <Users className="h-10 w-10 text-purple-200" />
          </div>
        </div>
      </div>

      {/* View Toggle and Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === 'calendar'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Calendrier
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-full md:w-48"
            >
              <option value="all">Tous les statuts</option>
              <option value="confirmed">Confirmés</option>
              <option value="pending">En attente</option>
              <option value="completed">Terminés</option>
              <option value="cancelled">Annulés</option>
              <option value="no_show">Absences</option>
            </select>
          </div>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 gap-4">
          {filteredAppointments.length === 0 ? (
            <div className="card text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
              <p className="text-gray-500 mb-4">Create your first appointment to get started</p>
              <button
                onClick={() => setShowBookingModal(true)}
                className="btn btn-primary inline-flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Create Appointment</span>
              </button>
            </div>
          ) : (
            filteredAppointments.map((apt) => {
              const patientName = getPatientName(apt.patient);
              const aptId = apt._id || apt.id;

              return (
                <div key={aptId} className="card hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {patientName}
                        </h3>
                        <span className={getStatusBadge(apt.status)}>
                          {getStatusText(apt.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Date & Heure</p>
                          <p className="font-semibold text-gray-900">
                            {format(new Date(apt.date), 'dd MMMM yyyy', { locale: fr })}
                          </p>
                          <p className="text-gray-700">{apt.time}</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Type</p>
                          <p className="font-semibold text-gray-900">
                            {apt.type || 'Consultation'}
                          </p>
                          <p className="text-gray-600">{apt.duration || 30} minutes</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Médecin</p>
                          <p className="font-semibold text-gray-900">
                            {apt.doctor?.name || apt.provider?.name || 'Non assigné'}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-500">Salle</p>
                          <p className="font-semibold text-gray-900">{apt.room || 'Non assignée'}</p>
                        </div>
                      </div>

                      {(apt.reason || apt.notes) && (
                        <div className="mt-3 pt-3 border-t">
                          {apt.reason && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Raison: </span>
                              {apt.reason}
                            </p>
                          )}
                          {apt.notes && (
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Notes: </span>
                              {apt.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      {(apt.status === 'confirmed' || apt.status === 'CONFIRMED') && (
                        <>
                          <button
                            onClick={() => handleStart(aptId)}
                            disabled={actionLoading[aptId]}
                            className="btn btn-primary text-sm px-4 py-2"
                          >
                            {actionLoading[aptId] ? 'Loading...' : 'Commencer'}
                          </button>
                          <button
                            onClick={() => handleCancel(aptId)}
                            disabled={actionLoading[aptId]}
                            className="btn btn-secondary text-sm px-4 py-2"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                      {(apt.status === 'pending' || apt.status === 'PENDING') && (
                        <>
                          <button
                            onClick={() => handleConfirm(aptId)}
                            disabled={actionLoading[aptId]}
                            className="btn btn-success text-sm px-4 py-2"
                          >
                            {actionLoading[aptId] ? 'Loading...' : 'Confirmer'}
                          </button>
                          <button
                            onClick={() => handleReject(aptId)}
                            disabled={actionLoading[aptId]}
                            className="btn btn-danger text-sm px-4 py-2"
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {(apt.status === 'completed' || apt.status === 'COMPLETED') && (
                        <button className="btn btn-secondary text-sm px-4 py-2">
                          Voir détails
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="card">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Semaine du {format(weekStart, 'dd MMMM yyyy', { locale: fr })}
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                className="btn btn-secondary"
              >
                ← Semaine précédente
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="btn btn-primary"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                className="btn btn-secondary"
              >
                Semaine suivante →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayAppointments = appointments.filter(apt => {
                const aptDate = format(new Date(apt.date), 'yyyy-MM-dd');
                return aptDate === dayStr;
              });
              const isToday = dayStr === format(new Date(), 'yyyy-MM-dd');

              return (
                <div
                  key={idx}
                  className={`border rounded-lg p-3 min-h-[200px] ${
                    isToday ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                  }`}
                >
                  <div className="text-center mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      {format(day, 'EEE', { locale: fr })}
                    </p>
                    <p className={`text-2xl font-bold ${
                      isToday ? 'text-primary-600' : 'text-gray-900'
                    }`}>
                      {format(day, 'dd')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {dayAppointments.map((apt) => {
                      const patientName = getPatientName(apt.patient);
                      const statusLower = apt.status?.toLowerCase();
                      return (
                        <div
                          key={apt._id || apt.id}
                          className={`text-xs p-2 rounded cursor-pointer hover:shadow-md transition ${
                            statusLower === 'confirmed' ? 'bg-green-100 border border-green-300' :
                            statusLower === 'pending' ? 'bg-yellow-100 border border-yellow-300' :
                            statusLower === 'completed' ? 'bg-blue-100 border border-blue-300' :
                            'bg-gray-100 border border-gray-300'
                          }`}
                        >
                          <p className="font-semibold truncate">
                            {apt.time}
                          </p>
                          <p className="truncate text-gray-700">
                            {patientName}
                          </p>
                        </div>
                      );
                    })}
                    {dayAppointments.length === 0 && (
                      <p className="text-xs text-gray-400 text-center mt-4">
                        Aucun RDV
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Nouveau rendez-vous</h2>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient *
                  </label>
                  <select
                    value={newAppointment.patient}
                    onChange={(e) => setNewAppointment({...newAppointment, patient: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="">Sélectionner un patient</option>
                    {isArray(patients) && patients.map(patient => (
                      <option key={patient._id || patient.id} value={patient._id || patient.id}>
                        {patient.firstName} {patient.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de consultation *
                  </label>
                  <select
                    value={newAppointment.type}
                    onChange={(e) => setNewAppointment({...newAppointment, type: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Suivi</option>
                    <option value="emergency">Urgence</option>
                    <option value="check-up">Bilan de santé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                    className="input"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure *
                  </label>
                  <select
                    value={newAppointment.time}
                    onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="09:00">09:00</option>
                    <option value="09:30">09:30</option>
                    <option value="10:00">10:00</option>
                    <option value="10:30">10:30</option>
                    <option value="11:00">11:00</option>
                    <option value="11:30">11:30</option>
                    <option value="14:00">14:00</option>
                    <option value="14:30">14:30</option>
                    <option value="15:00">15:00</option>
                    <option value="15:30">15:30</option>
                    <option value="16:00">16:00</option>
                    <option value="16:30">16:30</option>
                    <option value="17:00">17:00</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Durée (minutes)
                  </label>
                  <input
                    type="number"
                    value={newAppointment.duration}
                    onChange={(e) => setNewAppointment({...newAppointment, duration: parseInt(e.target.value)})}
                    className="input"
                    min="15"
                    step="15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raison de la visite
                  </label>
                  <input
                    type="text"
                    value={newAppointment.reason}
                    onChange={(e) => setNewAppointment({...newAppointment, reason: e.target.value})}
                    className="input"
                    placeholder="Ex: Contrôle annuel"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                  className="input"
                  rows="3"
                  placeholder="Notes supplémentaires..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowBookingModal(false)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                onClick={handleBookAppointment}
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Création en cours...' : 'Confirmer le rendez-vous'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
