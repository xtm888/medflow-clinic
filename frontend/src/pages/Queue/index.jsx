import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertCircle } from 'lucide-react';
import { useWebSocket, useQueueUpdates } from '../../hooks/useWebSocket';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import api from '../../services/apiConfig';
import {
  fetchQueue,
  checkInPatient,
  updateQueueStatus,
  callNextPatient,
  fetchQueueStats,
  clearQueueError
} from '../../store/slices/queueSlice';
import DocumentGenerator from '../../components/documents/DocumentGenerator';
import { ClinicalSummaryPanel } from '../../components/panels';
import ConfirmationModal from '../../components/ConfirmationModal';
import { getRejectedAwaitingReschedule, rescheduleAfterRejection } from '../../services/labOrderService';

// Import new components
import QueueHeader from './QueueHeader';
import QueueStats from './QueueStats';
import QueueList from './QueueList';
import QueueSidebar from './QueueSidebar';

// Import modals from backup file (will be refactored in next phase)
import Search from 'lucide-react/dist/esm/icons/search';
import { PatientSelector } from '../../modules/patient';
import {
  Clock, User, CheckCircle, Play, XCircle, MapPin,
  Volume2, Crown, Baby, UserCheck, Zap, Shield,
  Ban, Calendar, DollarSign, X, Keyboard
} from 'lucide-react';

export default function Queue() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { queues, stats, loading, error } = useSelector(state => state.queue);

  // WebSocket for real-time updates
  const { connected: wsConnected, service: wsService } = useWebSocket();

  // Modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [showPatientPanel, setShowPatientPanel] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  // Form states
  const [checkInForm, setCheckInForm] = useState({
    patientSearch: '',
    appointmentId: '',
    consultationType: 'consultation',
    priority: 'normal',
    assignedDoctor: '',
    room: ''
  });
  const [walkInForm, setWalkInForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    reason: '',
    priority: 'normal'
  });

  // Data states
  const [todaysAppointments, setTodaysAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedWalkInPatient, setSelectedWalkInPatient] = useState(null);
  const [selectedPatientForRoom, setSelectedPatientForRoom] = useState(null);
  const [selectedPatientForDoc, setSelectedPatientForDoc] = useState(null);
  const [selectedPatientForPanel, setSelectedPatientForPanel] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [enableAudio, setEnableAudio] = useState(true);
  const [sortBy, setSortBy] = useState('priority');
  const [initialLoadError, setInitialLoadError] = useState(null);

  // Rejected lab orders
  const [rejectedLabOrders, setRejectedLabOrders] = useState([]);
  const [loadingRejectedLabs, setLoadingRejectedLabs] = useState(false);
  const [selectedRejectedOrder, setSelectedRejectedOrder] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  // Current time for real-time wait time calculation
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Fetch available rooms
  const fetchAvailableRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const response = await api.get('/rooms/available');
      setAvailableRooms(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // Fetch today's appointments
  const fetchTodaysAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/appointments?date=${today}&status=scheduled`);
      const appointments = response.data?.data || response.data || [];
      setTodaysAppointments(appointments);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      setTodaysAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  // Fetch rejected lab orders
  const fetchRejectedLabOrders = useCallback(async () => {
    setLoadingRejectedLabs(true);
    try {
      const response = await getRejectedAwaitingReschedule();
      setRejectedLabOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch rejected lab orders:', error);
      setRejectedLabOrders([]);
    } finally {
      setLoadingRejectedLabs(false);
    }
  }, []);

  // Handle reschedule lab order
  const handleRescheduleLabOrder = async () => {
    if (!selectedRejectedOrder || !rescheduleDate) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    setRescheduling(true);
    try {
      await rescheduleAfterRejection(
        selectedRejectedOrder._id,
        rescheduleDate,
        rescheduleNotes
      );
      toast.success('Examen reprogrammé avec succès');
      setShowRescheduleModal(false);
      setSelectedRejectedOrder(null);
      setRescheduleDate('');
      setRescheduleNotes('');
      fetchRejectedLabOrders();
    } catch (error) {
      console.error('Failed to reschedule lab order:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la reprogrammation');
    } finally {
      setRescheduling(false);
    }
  };

  // Reset check-in form
  const resetCheckInForm = useCallback(() => {
    setCheckInForm({
      patientSearch: '',
      appointmentId: '',
      consultationType: 'consultation',
      priority: 'normal',
      assignedDoctor: '',
      room: ''
    });
  }, []);

  // Open check-in modal
  const openCheckInModal = useCallback(() => {
    setShowCheckInModal(true);
    resetCheckInForm();
    fetchTodaysAppointments();
    fetchAvailableRooms();
  }, [fetchTodaysAppointments, fetchAvailableRooms, resetCheckInForm]);

  // Initial data fetch
  useEffect(() => {
    dispatch(fetchQueue());
    dispatch(fetchQueueStats());
    fetchRejectedLabOrders();
  }, [dispatch, fetchRejectedLabOrders]);

  // Subscribe to queue updates
  useEffect(() => {
    if (wsConnected && wsService) {
      wsService.send('subscribe:queue', {});
      console.log('Subscribed to queue updates via WebSocket');
    }
  }, [wsConnected, wsService]);

  // Handle real-time queue updates
  useQueueUpdates((data) => {
    console.log('Queue update received:', data?.type);

    if (data?.type === 'patient_checked_in' || data?.type === 'patient_completed') {
      dispatch(fetchQueueStats());
    }

    if (data?.type === 'patient_called' && data?.announcement) {
      toast.info(data.announcement.message, {
        icon: <Volume2 className="h-5 w-5" />,
        autoClose: 5000
      });

      if (enableAudio && data.announcement.audioUrl) {
        const audio = new Audio(data.announcement.audioUrl);
        audio.play().catch(e => console.log('Audio play blocked:', e));
      }
    }

    if (data?.type === 'room_occupied' || data?.type === 'room_released') {
      fetchAvailableRooms();
    }

    if (data?.type === 'lab_rejection') {
      fetchRejectedLabOrders();
      toast.warning(
        `Patient ${data.patientName || 'inconnu'} rejeté au laboratoire - Pénalité: ${(data.penaltyAmount || 0).toLocaleString()} FCFA`,
        {
          icon: <Ban className="h-5 w-5" />,
          autoClose: 10000
        }
      );
    }
  });

  // Fallback polling
  useEffect(() => {
    if (wsConnected) return;

    const interval = setInterval(() => {
      dispatch(fetchQueue());
      dispatch(fetchQueueStats());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch, wsConnected]);

  // Real-time wait time update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Calculate wait time
  const calculateWaitTime = useCallback((checkInTime) => {
    if (!checkInTime) return 0;
    const checkIn = new Date(checkInTime).getTime();
    if (isNaN(checkIn)) return 0;
    const diffMs = currentTime - checkIn;
    return Math.max(0, Math.floor(diffMs / 60000));
  }, [currentTime]);

  // Show error toast
  useEffect(() => {
    if (error) {
      const hasData = queues && typeof queues === 'object' && Object.values(queues).flat().length > 0;
      if (!hasData) {
        setInitialLoadError(error);
      }
      toast.error(error);
      dispatch(clearQueueError());
    }
  }, [error, dispatch, queues]);

  // Retry function
  const handleRetry = () => {
    setInitialLoadError(null);
    dispatch(fetchQueue());
    dispatch(fetchQueueStats());
  };

  // Handle check-in submit
  const handleCheckIn = async (e) => {
    e.preventDefault();

    if (!selectedAppointment && !checkInForm.appointmentId) {
      toast.error('Veuillez sélectionner un rendez-vous');
      return;
    }

    const appointmentId = selectedAppointment?._id || checkInForm.appointmentId;

    try {
      const result = await dispatch(checkInPatient({
        appointmentId,
        priority: checkInForm.priority.toLowerCase(),
        room: checkInForm.room || undefined
      })).unwrap();

      if (checkInForm.room && result?.queueEntry?._id) {
        try {
          await api.put(`/queue/${result.queueEntry._id}`, {
            roomNumber: checkInForm.room
          });
        } catch (roomErr) {
          console.error('Failed to assign room:', roomErr);
        }
      }

      toast.success('Patient enregistré avec succès!');
      setShowCheckInModal(false);
      resetCheckInForm();
      setSelectedAppointment(null);

      setTimeout(() => {
        dispatch(fetchQueue());
        dispatch(fetchQueueStats());
      }, 300);
    } catch (err) {
      toast.error(err || 'Failed to check in patient');
    }
  };

  // Handle walk-in submit
  const handleWalkIn = async (e) => {
    e.preventDefault();

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

        setTimeout(() => {
          dispatch(fetchQueue());
          dispatch(fetchQueueStats());
        }, 300);
      } catch (err) {
        toast.error(err || 'Échec d\'ajout du patient');
      }
      return;
    }

    if (!walkInForm.firstName || !walkInForm.lastName || !walkInForm.phoneNumber || !walkInForm.reason) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    try {
      await dispatch(checkInPatient({
        walkIn: true,
        patientInfo: {
          firstName: walkInForm.firstName,
          lastName: walkInForm.lastName,
          phoneNumber: walkInForm.phoneNumber
        },
        reason: walkInForm.reason,
        priority: walkInForm.priority.toLowerCase()
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

      setTimeout(() => {
        dispatch(fetchQueue());
        dispatch(fetchQueueStats());
      }, 300);
    } catch (err) {
      toast.error(err || 'Échec d\'ajout du patient');
    }
  };

  // Handle call patient
  const handleCallPatient = async (queueEntry) => {
    setSelectedPatientForRoom(queueEntry);
    await fetchAvailableRooms();
    setSelectedRoom('');
    setShowRoomModal(true);
  };

  // Confirm patient call with room
  const handleConfirmCallPatient = async () => {
    if (!selectedRoom) {
      toast.error('Veuillez sélectionner une salle');
      return;
    }

    const queueEntry = selectedPatientForRoom;
    const roomData = availableRooms.find(r => r._id === selectedRoom || r.roomNumber === selectedRoom);
    const roomNumber = roomData?.roomNumber || selectedRoom;

    try {
      const response = await api.post(`/queue/${queueEntry.appointmentId}/call`, {
        roomId: roomData?._id,
        roomNumber,
        enableAudio
      });

      const result = response.data;

      toast.success(`${queueEntry.patient?.firstName || 'Patient'} appelé en salle ${roomNumber}`);
      setShowRoomModal(false);
      setSelectedPatientForRoom(null);
      setSelectedRoom('');

      dispatch(fetchQueue());
      dispatch(fetchQueueStats());

      if (result.data?.announcement?.audioText && enableAudio) {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(result.data.announcement.audioText);
          utterance.lang = 'fr-FR';
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      }

      const patientId = queueEntry.patient?._id || queueEntry.patient?.id || queueEntry.patientId;
      const appointmentId = queueEntry.appointmentId || queueEntry._id;

      if (!patientId) {
        toast.error('ID patient non disponible pour la navigation');
        return;
      }

      if (queueEntry.visitId) {
        toast.info('Ouverture de la consultation...');
        navigate(`/ophthalmology/consultation/${patientId}?visitId=${queueEntry.visitId}&appointmentId=${appointmentId}`);
      } else {
        toast.info('Création d\'une nouvelle consultation...');
        navigate(`/visits/new/${patientId}?appointmentId=${appointmentId}`);
      }
    } catch (err) {
      toast.error(err.message || 'Échec de l\'appel du patient');
    }
  };

  // Handle complete consultation
  const handleComplete = (queueEntry) => {
    setConfirmModal({
      isOpen: true,
      title: 'Terminer la consultation?',
      message: `Marquer la consultation de ${queueEntry.patient?.firstName} ${queueEntry.patient?.lastName} comme terminée?`,
      type: 'success',
      onConfirm: async () => {
        try {
          await dispatch(updateQueueStatus({
            id: queueEntry.appointmentId,
            status: 'completed'
          })).unwrap();

          toast.success('Consultation terminée');
          dispatch(fetchQueue());
          dispatch(fetchQueueStats());
        } catch (err) {
          toast.error(err || 'Échec de la terminaison de consultation');
        }
      }
    });
  };

  // Start visit
  const handleStartVisit = async (queueEntry) => {
    try {
      await dispatch(updateQueueStatus({
        id: queueEntry.appointmentId,
        status: 'in-progress'
      })).unwrap();

      const patientId = queueEntry.patient?._id || queueEntry.patient?.id;
      const appointmentId = queueEntry.appointmentId || queueEntry._id;

      if (patientId) {
        navigate(`/visits/new/${patientId}?appointmentId=${appointmentId}`);
      } else {
        toast.error('ID patient non disponible');
      }
    } catch (err) {
      toast.error(err || 'Échec du démarrage de la visite');
    }
  };

  // Call next patient
  const handleCallNext = async (department = null) => {
    try {
      const result = await dispatch(callNextPatient({
        department,
        doctorId: null
      })).unwrap();

      if (result.data) {
        toast.success(`Prochain patient: ${result.data.patient.firstName} ${result.data.patient.lastName}`);
        dispatch(fetchQueueStats());
      }
    } catch (err) {
      toast.error(err || 'Aucun patient dans la file');
    }
  };

  // Flatten queues
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

  // Sort patients
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

  // Memoize filtered arrays
  const waitingPatients = useMemo(() =>
    sortPatients(allQueues.filter(p => p.status === 'checked-in')),
    [allQueues, sortBy, priorityOrder]
  );

  const inProgressPatients = useMemo(() =>
    allQueues.filter(p => p.status === 'in-progress'),
    [allQueues]
  );

  // Memoize alert counts
  const alertCounts = useMemo(() => ({
    longWaitCount: waitingPatients.filter(p => calculateWaitTime(p.checkInTime) > 30).length,
    priorityCount: waitingPatients.filter(p => p.priority !== 'normal').length
  }), [waitingPatients, currentTime]);

  // Check if modal is open
  const isModalOpen = showCheckInModal || showWalkInModal || showRoomModal || showDocumentGenerator || showPatientPanel || showShortcutsHelp;

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => ({
    'n': () => {
      if (!isModalOpen && waitingPatients.length > 0 && !loading) {
        handleCallNext();
      }
    },
    'c': () => {
      if (!isModalOpen) {
        openCheckInModal();
      }
    },
    'w': () => {
      if (!isModalOpen) {
        setShowWalkInModal(true);
      }
    },
    'r': () => {
      if (!isModalOpen) {
        dispatch(fetchQueue());
        dispatch(fetchQueueStats());
        toast.info('File actualisée');
      }
    },
    '1': () => {
      if (!isModalOpen && waitingPatients[0]) {
        handleCallPatient(waitingPatients[0]);
      }
    },
    '2': () => {
      if (!isModalOpen && waitingPatients[1]) {
        handleCallPatient(waitingPatients[1]);
      }
    },
    '3': () => {
      if (!isModalOpen && waitingPatients[2]) {
        handleCallPatient(waitingPatients[2]);
      }
    },
    'esc': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showCheckInModal) {
        setShowCheckInModal(false);
        setSelectedAppointment(null);
      }
      else if (showWalkInModal) {
        setShowWalkInModal(false);
        setSelectedWalkInPatient(null);
      }
      else if (showRoomModal) {
        setShowRoomModal(false);
        setSelectedPatientForRoom(null);
      }
      else if (showDocumentGenerator) {
        setShowDocumentGenerator(false);
        setSelectedPatientForDoc(null);
      }
      else if (showPatientPanel) {
        setShowPatientPanel(false);
        setSelectedPatientForPanel(null);
      }
    },
    '?': () => {
      setShowShortcutsHelp(true);
    },
    'shift+/': () => {
      setShowShortcutsHelp(true);
    }
  }), [isModalOpen, waitingPatients, loading, showCheckInModal, showWalkInModal, showRoomModal, showDocumentGenerator, showPatientPanel, showShortcutsHelp]);

  useKeyboardShortcuts(keyboardShortcuts, true);

  if (loading && allQueues.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de la file...</p>
        </div>
      </div>
    );
  }

  if (initialLoadError && allQueues.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur de chargement</h3>
          <p className="text-gray-600 mb-4">{initialLoadError}</p>
          <button
            onClick={handleRetry}
            className="btn btn-primary"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <QueueHeader
        wsConnected={wsConnected}
        onCallNext={() => handleCallNext()}
        onOpenCheckIn={openCheckInModal}
        onOpenWalkIn={() => setShowWalkInModal(true)}
        onShowShortcuts={() => setShowShortcutsHelp(true)}
        loading={loading}
        waitingCount={waitingPatients.length}
      />

      {/* Stats */}
      <QueueStats stats={stats} />

      {/* Main Queue Display */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waiting Patients */}
        <QueueList
          patients={waitingPatients}
          sortBy={sortBy}
          onSortChange={setSortBy}
          calculateWaitTime={calculateWaitTime}
          onViewInfo={(patient) => {
            setSelectedPatientForPanel(patient);
            setShowPatientPanel(true);
          }}
          onStartVisit={handleStartVisit}
          onGenerateDocument={(patient) => {
            setSelectedPatientForDoc(patient);
            setShowDocumentGenerator(true);
          }}
          onCallPatient={handleCallPatient}
          loading={loading}
        />

        {/* Sidebar */}
        <QueueSidebar
          inProgressPatients={inProgressPatients}
          alertCounts={alertCounts}
          rejectedLabOrders={rejectedLabOrders}
          loadingRejectedLabs={loadingRejectedLabs}
          onViewInfo={(patient) => {
            setSelectedPatientForPanel(patient);
            setShowPatientPanel(true);
          }}
          onStartVisit={handleStartVisit}
          onComplete={handleComplete}
          onRescheduleLabOrder={(order) => {
            setSelectedRejectedOrder(order);
            setShowRescheduleModal(true);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setRescheduleDate(tomorrow.toISOString().split('T')[0]);
          }}
          loading={loading}
        />
      </div>

      {/* TODO: Extract modals to separate components in next phase */}
      {/* For now, import them from the backup file */}
      {/* Check-in Modal, Walk-in Modal, Room Modal, etc. */}

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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="Confirmer"
        cancelText="Annuler"
      />
    </div>
  );
}
