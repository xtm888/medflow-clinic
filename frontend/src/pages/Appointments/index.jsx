import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Clock, Users, CheckCircle, Plus, Wifi, WifiOff, RefreshCw, Keyboard, AlertTriangle, UserX, CalendarClock, XCircle, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import appointmentService from '../../services/appointmentService';
import patientService from '../../services/patientService';
import queueService from '../../services/queueService';
import { toast } from 'react-toastify';
import { normalizeToArray } from '../../utils/apiHelpers';
import { getPatientName as formatPatientName } from '../../utils/formatters';
import { useWebSocket, useAppointmentUpdates } from '../../hooks/useWebSocket';
import { ClinicalSummaryPanel } from '../../components/panels';
import ProviderAvailabilityPanel from '../../components/ProviderAvailabilityPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import ConfirmationModal from '../../components/ConfirmationModal';
import PermissionGate from '../../components/PermissionGate';
import AppointmentFilters from './AppointmentFilters';
import AppointmentList from './AppointmentList';
import AppointmentCalendar from './AppointmentCalendar';
import AppointmentModal from './AppointmentModal';

export default function Appointments() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // WebSocket for real-time updates
  const { connected: wsConnected } = useWebSocket();

  const [appointments, setAppointments] = useState([]);
  const [patientCache, setPatientCache] = useState({});
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Patient info panel state
  const [selectedPatientForPanel, setSelectedPatientForPanel] = useState(null);
  const [showPatientPanel, setShowPatientPanel] = useState(false);

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const searchInputRef = useRef(null);

  // Provider availability state
  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState(false);
  const [selectedAvailabilityProvider, setSelectedAvailabilityProvider] = useState(null);

  // No-show automation state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNoShowAlert, setShowNoShowAlert] = useState(true);
  const NO_SHOW_THRESHOLD_MINUTES = 30;

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Handle real-time appointment updates via WebSocket
  useAppointmentUpdates((data) => {
    console.log('Appointment update received:', data?.type || 'update');
    fetchData();

    if (data?.type === 'appointment_created') {
      toast.info('Nouveau rendez-vous créé');
    } else if (data?.type === 'appointment_cancelled') {
      toast.info('Un rendez-vous a été annulé');
    } else if (data?.type === 'appointment_confirmed') {
      toast.success('Un rendez-vous a été confirmé');
    }
  });

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (wsConnected) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [wsConnected]);

  // Update current time every minute for no-show detection
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Calculate late appointments
  const lateAppointments = useMemo(() => {
    const now = currentTime;
    const todayStr = format(now, 'yyyy-MM-dd');

    return appointments.filter(apt => {
      const aptDate = format(new Date(apt.date), 'yyyy-MM-dd');
      if (aptDate !== todayStr) return false;

      const status = apt.status?.toLowerCase();
      if (!['scheduled', 'confirmed', 'pending'].includes(status)) return false;

      const appointmentTime = apt.startTime || apt.time;
      if (!appointmentTime) return false;

      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const appointmentDateTime = new Date(apt.date);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      const minutesLate = Math.floor((now - appointmentDateTime) / 60000);
      return minutesLate >= NO_SHOW_THRESHOLD_MINUTES;
    }).map(apt => {
      const appointmentTime = apt.startTime || apt.time;
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const appointmentDateTime = new Date(apt.date);
      appointmentDateTime.setHours(hours, minutes, 0, 0);
      const minutesLate = Math.floor((now - appointmentDateTime) / 60000);

      return {
        ...apt,
        minutesLate
      };
    }).sort((a, b) => b.minutesLate - a.minutesLate);
  }, [appointments, currentTime, NO_SHOW_THRESHOLD_MINUTES]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [appointmentsRes, providersRes] = await Promise.all([
        appointmentService.getAppointments({ limit: 100, sort: '-date' }),
        appointmentService.getProviders()
      ]);

      const appointmentsData = normalizeToArray(appointmentsRes);
      setAppointments(appointmentsData);

      // Build patient cache from already-populated appointment data
      const newCache = {};
      appointmentsData.forEach(apt => {
        if (apt.patient && typeof apt.patient === 'object' && apt.patient._id) {
          newCache[apt.patient._id] = apt.patient;
        }
      });
      setPatientCache(prev => ({ ...prev, ...newCache }));

      const providerUsers = normalizeToArray(providersRes);
      setProviders(providerUsers);
    } catch (err) {
      toast.error('Échec du chargement des rendez-vous');
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
  const noShowCount = appointments.filter(apt => apt.status === 'no_show' || apt.status === 'NO_SHOW').length;

  // Get patient object - handles both populated objects and ID references
  const getPatientObject = (patientData) => {
    if (patientData && typeof patientData === 'object' && patientData.firstName) {
      return patientData;
    }
    const patientId = typeof patientData === 'object' && patientData !== null ? patientData._id : patientData;
    return patientCache[patientId] || null;
  };

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    const patient = getPatientObject(apt.patient);
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

  const getPatientName = (patientData) => {
    const patient = getPatientObject(patientData);
    return formatPatientName(patient);
  };

  const getProviderName = (providerData) => {
    if (providerData && typeof providerData === 'object') {
      if (providerData.firstName) {
        return `Dr. ${providerData.firstName || ''} ${providerData.lastName || ''}`.trim();
      }
      if (providerData.name) {
        return providerData.name;
      }
    }

    const providerId = typeof providerData === 'object' && providerData !== null ? providerData._id : providerData;
    const provider = providers.find(p => p._id === providerId || p.id === providerId);
    if (provider) {
      return `Dr. ${provider.firstName || ''} ${provider.lastName || ''}`.trim();
    }
    return null;
  };

  const calculateEndTime = (startTime, durationMinutes) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const handleBookAppointment = async (formData) => {
    try {
      const endTime = calculateEndTime(formData.time, formData.duration);

      const appointmentData = {
        patient: formData.patient._id || formData.patient,
        provider: formData.provider,
        department: formData.department,
        type: formData.type,
        date: new Date(`${formData.date}T${formData.time}`),
        startTime: formData.time,
        endTime: endTime,
        duration: formData.duration,
        reason: formData.reason,
        notes: formData.notes,
        status: 'scheduled'
      };

      await appointmentService.createAppointment(appointmentData);
      toast.success('Rendez-vous créé avec succès!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Échec de la création du rendez-vous');
      console.error('Error creating appointment:', err);
      throw err;
    }
  };

  const handleConfirm = async (appointmentId) => {
    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
      await appointmentService.updateAppointment(appointmentId, { status: 'confirmed' });
      toast.success('Rendez-vous confirmé!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Échec de la confirmation');
      console.error('Error confirming appointment:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleCancel = (appointmentId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Annuler ce rendez-vous?',
      message: 'Cette action annulera le rendez-vous. Le patient sera notifié.',
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
          await appointmentService.cancelAppointment(appointmentId, {
            reason: 'Annulé par le personnel',
            cancelledBy: 'staff'
          });
          toast.success('Rendez-vous annulé!');
          fetchData();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Échec de l\'annulation');
          console.error('Error cancelling appointment:', err);
        } finally {
          setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
        }
      }
    });
  };

  const handleStart = async (appointmentId, patient) => {
    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
      const priority = patient?.vip ? 'vip' : 'normal';
      await queueService.checkIn({ appointmentId, priority });
      toast.success('Patient enregistré et ajouté à la file d\'attente!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Échec de l\'enregistrement');
      console.error('Error checking in patient:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleCheckIn = async (appointmentId, patient) => {
    try {
      setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
      const priority = patient?.vip ? 'vip' : 'normal';
      await queueService.checkIn({ appointmentId, priority });
      toast.success('Patient enregistré et ajouté à la file!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Échec de l\'enregistrement');
      console.error('Error checking in patient:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleReject = (appointmentId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Refuser ce rendez-vous?',
      message: 'Le rendez-vous sera annulé et le patient sera notifié du refus.',
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
          await appointmentService.updateAppointment(appointmentId, { status: 'cancelled' });
          toast.success('Rendez-vous refusé!');
          fetchData();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Échec du refus');
          console.error('Error rejecting appointment:', err);
        } finally {
          setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
        }
      }
    });
  };

  const handleMarkNoShow = (appointmentId, patientName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Marquer comme absence?',
      message: `Confirmer l'absence de ${patientName}? Cette action sera enregistrée dans l'historique du patient.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
          await appointmentService.updateAppointment(appointmentId, {
            status: 'no_show',
            noShowMarkedAt: new Date().toISOString()
          });
          toast.success('Absence enregistrée');
          fetchData();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Échec de l\'enregistrement');
          console.error('Error marking no-show:', err);
        } finally {
          setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
        }
      }
    });
  };

  const handleMarkAllNoShow = () => {
    if (lateAppointments.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Marquer toutes les absences?',
      message: `Confirmer l'absence de ${lateAppointments.length} patient(s) en retard? Cette action sera enregistrée dans leur historique.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(prev => ({ ...prev, batch: true }));
          await Promise.all(
            lateAppointments.map(apt =>
              appointmentService.updateAppointment(apt._id || apt.id, {
                status: 'no_show',
                noShowMarkedAt: new Date().toISOString()
              })
            )
          );
          toast.success(`${lateAppointments.length} absence(s) enregistrée(s)`);
          fetchData();
        } catch (err) {
          toast.error('Échec de l\'enregistrement des absences');
          console.error('Error marking all no-shows:', err);
        } finally {
          setActionLoading(prev => ({ ...prev, batch: false }));
        }
      }
    });
  };

  const handleShowPatientPanel = (patient) => {
    setSelectedPatientForPanel(patient);
    setShowPatientPanel(true);
  };

  // Check if any modal is open
  const isModalOpen = showBookingModal || showPatientPanel || showShortcutsHelp;

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => ({
    'n': () => {
      if (!isModalOpen) {
        setShowBookingModal(true);
      }
    },
    '/': () => {
      if (!isModalOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    },
    'r': () => {
      if (!isModalOpen) {
        fetchData();
        toast.info('Liste actualisée');
      }
    },
    't': () => {
      if (!isModalOpen) {
        setSelectedDate(new Date());
        toast.info('Aujourd\'hui');
      }
    },
    'left': () => {
      if (!isModalOpen) {
        const fn = viewMode === 'month' ?
          (date) => new Date(date.getFullYear(), date.getMonth() - 1, date.getDate()) :
          (date) => new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
        setSelectedDate(prev => fn(prev));
      }
    },
    'right': () => {
      if (!isModalOpen) {
        const fn = viewMode === 'month' ?
          (date) => new Date(date.getFullYear(), date.getMonth() + 1, date.getDate()) :
          (date) => new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
        setSelectedDate(prev => fn(prev));
      }
    },
    'l': () => {
      if (!isModalOpen) setViewMode('list');
    },
    'w': () => {
      if (!isModalOpen) setViewMode('week');
    },
    'm': () => {
      if (!isModalOpen) setViewMode('month');
    },
    'esc': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showBookingModal) setShowBookingModal(false);
      else if (showPatientPanel) {
        setShowPatientPanel(false);
        setSelectedPatientForPanel(null);
      }
    },
    '?': () => {
      setShowShortcutsHelp(true);
    }
  }), [isModalOpen, viewMode, showBookingModal, showPatientPanel, showShortcutsHelp]);

  useKeyboardShortcuts(keyboardShortcuts, true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des rendez-vous...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">Rendez-vous</h1>
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
              wsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{wsConnected ? 'En direct' : 'Hors ligne'}</span>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Gestion du calendrier et planning des consultations
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
              title="Raccourcis clavier (appuyez sur ?)"
            >
              <Keyboard className="h-3 w-3 mr-1" />
              <span className="text-xs">Raccourcis</span>
            </button>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAvailabilityPanel(true)}
            className="btn btn-secondary flex items-center space-x-2"
            title="Voir les disponibilités"
          >
            <CalendarClock className="h-5 w-5" />
            <span className="hidden lg:inline">Disponibilités</span>
          </button>
          <button
            onClick={() => fetchData()}
            className="btn btn-secondary flex items-center space-x-2"
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          <PermissionGate permission="manage_appointments">
            <button
              onClick={() => setShowBookingModal(true)}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Nouveau rendez-vous</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-100">Absences</p>
              <p className="text-3xl font-bold">{noShowCount}</p>
            </div>
            <UserX className="h-10 w-10 text-red-200" />
          </div>
        </div>
      </div>

      {/* No-Show Alert Panel */}
      {showNoShowAlert && lateAppointments.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900 flex items-center gap-2">
                  Patients en retard
                  <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-sm">
                    {lateAppointments.length}
                  </span>
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Ces patients n'ont pas été enregistrés après {NO_SHOW_THRESHOLD_MINUTES} minutes de leur heure de RDV
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMarkAllNoShow}
                disabled={actionLoading.batch}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {actionLoading.batch ? 'Traitement...' : 'Tout marquer absent'}
              </button>
              <button
                onClick={() => setShowNoShowAlert(false)}
                className="p-1.5 text-red-400 hover:text-red-600 rounded"
                title="Masquer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {lateAppointments.map(apt => {
              const patientName = getPatientName(apt.patient);
              const aptId = apt._id || apt.id;

              return (
                <div
                  key={aptId}
                  className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{patientName}</p>
                      <p className="text-sm text-gray-500">
                        RDV à {apt.startTime || apt.time} •
                        <span className="text-red-600 font-medium ml-1">
                          {apt.minutesLate} min de retard
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const patient = getPatientObject(apt.patient);
                        handleCheckIn(aptId, patient);
                      }}
                      disabled={actionLoading[aptId]}
                      className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <UserCheck className="h-4 w-4 inline mr-1" />
                      Arrivé
                    </button>
                    <button
                      onClick={() => handleMarkNoShow(aptId, patientName)}
                      disabled={actionLoading[aptId]}
                      className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <UserX className="h-4 w-4 inline mr-1" />
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <AppointmentFilters
        ref={searchInputRef}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />

      {/* List View */}
      {viewMode === 'list' && (
        <AppointmentList
          appointments={filteredAppointments}
          getPatientName={getPatientName}
          getPatientObject={getPatientObject}
          getProviderName={getProviderName}
          getStatusBadge={getStatusBadge}
          getStatusText={getStatusText}
          onShowPatientPanel={handleShowPatientPanel}
          onCheckIn={handleCheckIn}
          onStart={handleStart}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          onReject={handleReject}
          actionLoading={actionLoading}
          onShowBookingModal={() => setShowBookingModal(true)}
          today={today}
        />
      )}

      {/* Calendar Views */}
      {(viewMode === 'week' || viewMode === 'month' || viewMode === 'agenda') && (
        <AppointmentCalendar
          viewMode={viewMode}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          appointments={appointments}
          getPatientName={getPatientName}
          getProviderName={getProviderName}
          getStatusText={getStatusText}
          onCheckIn={handleCheckIn}
          actionLoading={actionLoading}
          getPatientObject={getPatientObject}
        />
      )}

      {/* Booking Modal */}
      <AppointmentModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSubmit={handleBookAppointment}
        providers={providers}
        initialData={{
          provider: ['doctor', 'ophthalmologist', 'orthoptist', 'optometrist'].includes(user?.role)
            ? (user?._id || user?.id)
            : ''
        }}
      />

      {/* Patient Info Panel */}
      {showPatientPanel && selectedPatientForPanel && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
            onClick={() => {
              setShowPatientPanel(false);
              setSelectedPatientForPanel(null);
            }}
          />
          <div className="fixed right-0 top-0 h-full w-96 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out">
            <ClinicalSummaryPanel
              patient={selectedPatientForPanel}
              patientId={selectedPatientForPanel?._id || selectedPatientForPanel?.id}
              variant="sidebar"
              onClose={() => {
                setShowPatientPanel(false);
                setSelectedPatientForPanel(null);
              }}
              onNavigateToProfile={(id) => {
                setShowPatientPanel(false);
                navigate(`/patients/${id}`);
              }}
              showOphthalmology={true}
            />
          </div>
        </>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Raccourcis Clavier</h2>
              </div>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Actions RDV
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Nouveau RDV</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">N</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Rechercher</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">/</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Rafraîchir</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">R</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Aujourd'hui</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">T</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Navigation
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Période précédente</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">←</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Période suivante</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">→</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Vues
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Vue liste</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">L</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Vue semaine</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">W</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Vue mois</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">M</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Interface
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Fermer modal</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">Esc</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Afficher cette aide</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">?</kbd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-gray-500 text-center">
                  Les raccourcis sont désactivés quand vous tapez dans un champ
                </p>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="btn btn-primary"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider Availability Modal */}
      {showAvailabilityPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center space-x-3">
                <CalendarClock className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Disponibilités des praticiens</h2>
              </div>
              <button
                onClick={() => setShowAvailabilityPanel(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="h-6 w-6 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <ProviderAvailabilityPanel
                providers={providers}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                selectedProvider={selectedAvailabilityProvider}
                onProviderSelect={setSelectedAvailabilityProvider}
                existingAppointments={appointments}
                onSlotSelect={(slot) => {
                  setShowAvailabilityPanel(false);
                  setSelectedDate(new Date(slot.date));
                  setShowBookingModal(true);
                  toast.info(`Créneau sélectionné: ${slot.date} à ${slot.time}`);
                }}
                mode="full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
}
