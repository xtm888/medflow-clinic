import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Plus, Clock, MapPin, User, Check, X as XIcon,
  MoreVertical, Edit2, RefreshCw, Trash2, UserCheck, PlayCircle,
  DollarSign, CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp,
  FileText, Pill, Activity, TrendingUp
} from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';
import queueService from '../../../services/queueService';
import billingService from '../../../services/billingService';
import { toast } from 'react-toastify';

/**
 * AppointmentsSection - Enhanced with full workflow integration
 */
export default function AppointmentsSection({ patientId, patient, forceExpand = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const loadData = async (force = false) => {
    if (!force && Array.isArray(appointments) && appointments.length > 0) return;

    console.log('[AppointmentsSection] Loading data for patientId:', patientId);
    setLoading(true);
    try {
      // Load appointments and invoices in parallel with individual error handling
      const url = `/appointments/patient/${patientId}?limit=10`;
      console.log('[AppointmentsSection] Fetching from URL:', url);

      const [aptRes, invRes] = await Promise.all([
        api.get(url).catch(err => {
          console.error('[AppointmentsSection] Error loading appointments:', err.response?.data || err.message);
          toast.error(`Erreur lors du chargement des rendez-vous: ${err.response?.data?.error || err.message}`);
          return { data: { data: [] } };
        }),
        billingService.getInvoices({ patientId }).catch(() => ({ data: [] }))
      ]);

      const aptData = aptRes.data?.data || aptRes.data || [];
      const invData = invRes.data || invRes;

      console.log('[AppointmentsSection] Loaded appointments:', aptData);
      console.log('[AppointmentsSection] Appointments count:', Array.isArray(aptData) ? aptData.length : 0);
      setAppointments(Array.isArray(aptData) ? aptData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
    } catch (err) {
      console.error('[AppointmentsSection] Error loading appointments section:', err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load data when patientId changes
  useEffect(() => {
    if (patientId) {
      loadData(true);
    }
  }, [patientId]);

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if appointment is today
  const isToday = (date) => {
    const today = new Date();
    const aptDate = new Date(date);
    return aptDate.toDateString() === today.toDateString();
  };

  // Check if appointment is within next 2 hours
  const isUpcomingSoon = (date) => {
    const now = new Date();
    const aptDate = new Date(date);
    const diffMs = aptDate - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 2;
  };

  // Get payment status for appointment
  const getPaymentStatus = (appointment) => {
    const invoice = invoices.find(inv =>
      inv.appointmentId === appointment._id ||
      (inv.patientId === patientId &&
       new Date(inv.date).toDateString() === new Date(appointment.startTime || appointment.date).toDateString())
    );

    if (!invoice) return null;

    return {
      status: invoice.status,
      invoiceId: invoice._id
    };
  };

  // Handler: Start Consultation
  const handleStartConsultation = (appointment) => {
    navigate(`/ophthalmology/studio/${patientId}?appointmentId=${appointment._id}`);
  };

  // Handler: Check-in to Queue
  const handleCheckIn = async (appointment) => {
    try {
      await queueService.addToQueue({
        patient: patientId,
        patientName: patient?.fullName || `${patient?.firstName} ${patient?.lastName}`,
        type: appointment.reason || 'consultation',
        appointmentId: appointment._id,
        priority: 'normal'
      });

      // Update appointment status
      await api.put(`/appointments/${appointment._id}`, {
        status: 'checked-in'
      });

      toast.success('Patient enregistré dans la file d\'attente');
      loadData(true);
    } catch (err) {
      console.error('Error checking in:', err);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  // Handler: Edit Appointment
  const handleEdit = (appointment) => {
    navigate(`/appointments?id=${appointment._id}&edit=true`);
  };

  // Handler: Confirm Appointment
  const handleConfirm = async (appointment) => {
    try {
      await api.put(`/appointments/${appointment._id}`, {
        status: 'confirmed'
      });
      toast.success('Rendez-vous confirmé');
      loadData(true);
    } catch (err) {
      console.error('Error confirming:', err);
      toast.error('Erreur lors de la confirmation');
    }
  };

  // Handler: Cancel Appointment
  const handleCancelClick = (appointment) => {
    setCancellingAppointment(appointment);
    setCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancellingAppointment) return;

    try {
      await api.put(`/appointments/${cancellingAppointment._id}`, {
        status: 'cancelled',
        cancelReason: cancelReason || 'Annulé par le praticien'
      });
      toast.success('Rendez-vous annulé');
      setCancelModalOpen(false);
      setCancellingAppointment(null);
      setCancelReason('');
      loadData(true);
    } catch (err) {
      console.error('Error cancelling:', err);
      toast.error('Erreur lors de l\'annulation');
    }
  };

  // Handler: Mark as Completed
  const handleMarkCompleted = async (appointment) => {
    try {
      await api.put(`/appointments/${appointment._id}`, {
        status: 'completed'
      });
      toast.success('Rendez-vous marqué comme terminé');
      loadData(true);
    } catch (err) {
      console.error('Error marking completed:', err);
      toast.error('Erreur');
    }
  };

  // Handler: Mark as No-Show
  const handleMarkNoShow = async (appointment) => {
    try {
      await api.put(`/appointments/${appointment._id}`, {
        status: 'no-show'
      });
      toast.success('Rendez-vous marqué comme absent');
      loadData(true);
    } catch (err) {
      console.error('Error marking no-show:', err);
      toast.error('Erreur');
    }
  };

  // Handler: Click appointment to view
  const handleAppointmentClick = (appointment) => {
    navigate(`/appointments?id=${appointment._id}`);
  };

  // Calculate time since last visit
  const getTimeSinceLastVisit = () => {
    if (past.length === 0) return null;

    const lastVisit = past[0]; // Most recent past appointment
    const lastDate = new Date(lastVisit.date);
    const now = new Date();
    const diffMs = now - lastDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
    return `Il y a ${Math.floor(diffDays / 365)} ans`;
  };

  // Calculate no-show rate
  const getNoShowRate = () => {
    if (appointmentsArray.length === 0) return "0%";
    const noShows = appointmentsArray.filter(a => a.status === 'no-show').length;
    const rate = (noShows / appointmentsArray.length * 100).toFixed(0);
    return `${noShows}/${appointmentsArray.length} (${rate}%)`;
  };

  // Get most common reason
  const getMostCommonReason = () => {
    if (appointmentsArray.length === 0) return "N/A";

    const reasonCounts = {};
    appointmentsArray.forEach(apt => {
      const reason = apt.reason || apt.type || 'Non spécifié';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    const mostCommon = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])[0];

    return mostCommon ? mostCommon[0] : "N/A";
  };

  // Separate upcoming and past
  const now = new Date();
  const appointmentsArray = Array.isArray(appointments) ? appointments : [];
  const upcoming = appointmentsArray.filter(a => new Date(a.date) >= now);
  const past = appointmentsArray.filter(a => new Date(a.date) < now);
  const nextAppointment = upcoming[0];

  console.log('[AppointmentsSection] Rendering:', {
    total: appointmentsArray.length,
    upcoming: upcoming.length,
    past: past.length,
    nextAppointment: !!nextAppointment,
    appointmentsArray
  });

  return (
    <CollapsibleSection
      title="Rendez-vous"
      icon={Calendar}
      iconColor="text-blue-600"
      gradient="from-blue-50 to-sky-50"
      defaultExpanded={forceExpand}
      onExpand={loadData}
      loading={loading}
      badge={
        upcoming.length > 0 && (
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
            {upcoming.length} à venir
          </span>
        )
      }
      headerExtra={
        nextAppointment && (
          <span>
            Prochain: {formatDate(nextAppointment.date)}
          </span>
        )
      }
      actions={
        <SectionActionButton
          icon={Plus}
          onClick={() => navigate(`/appointments?patientId=${patientId}&new=true`)}
          variant="primary"
        >
          RDV
        </SectionActionButton>
      }
    >
      {appointments.length === 0 ? (
        <SectionEmptyState
          icon={Calendar}
          message="Aucun rendez-vous"
          action={
            <SectionActionButton
              icon={Plus}
              onClick={() => navigate(`/appointments?patientId=${patientId}&new=true`)}
            >
              Prendre rendez-vous
            </SectionActionButton>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Next Appointment Highlight */}
          {nextAppointment && (
            <div className={`rounded-lg p-4 border ${
              isToday(nextAppointment.date)
                ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300 border-l-4'
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Prochain rendez-vous</span>
                {isToday(nextAppointment.date) && (
                  <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full font-semibold">
                    Aujourd'hui
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-lg font-bold text-gray-900">
                    {formatDate(nextAppointment.date)}
                  </p>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(nextAppointment.date)}
                  </p>
                  {nextAppointment.reason && (
                    <p className="text-sm text-gray-500 mt-1">{nextAppointment.reason}</p>
                  )}
                  {nextAppointment.provider && (
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <User className="h-3 w-3" />
                      {typeof nextAppointment.provider === 'string'
                        ? nextAppointment.provider
                        : nextAppointment.provider.fullName || nextAppointment.provider.name || `${nextAppointment.provider.firstName || ''} ${nextAppointment.provider.lastName || ''}`.trim() || 'Médecin'}
                    </p>
                  )}
                </div>

                {/* Action Buttons for Next Appointment */}
                <div className="flex gap-2">
                  {isToday(nextAppointment.date) && (
                    <>
                      <button
                        onClick={() => handleStartConsultation(nextAppointment)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Démarrer
                      </button>
                      {nextAppointment.status !== 'checked-in' && (
                        <button
                          onClick={() => handleCheckIn(nextAppointment)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                        >
                          <UserCheck className="h-4 w-4" />
                          Enregistrer
                        </button>
                      )}
                    </>
                  )}
                  {nextAppointment.status === 'pending' && (
                    <button
                      onClick={() => handleConfirm(nextAppointment)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                    >
                      <Check className="h-4 w-4" />
                      Confirmer
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming List */}
          {upcoming.length > 1 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">À venir</h4>
              <div className="space-y-2">
                {upcoming.slice(1, 4).map((apt) => (
                  <AppointmentRow
                    key={apt._id || apt.id}
                    appointment={apt}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    onClick={() => handleAppointmentClick(apt)}
                    onStartConsultation={() => handleStartConsultation(apt)}
                    onCheckIn={() => handleCheckIn(apt)}
                    onEdit={() => handleEdit(apt)}
                    onConfirm={() => handleConfirm(apt)}
                    onCancel={() => handleCancelClick(apt)}
                    paymentStatus={getPaymentStatus(apt)}
                    isToday={isToday(apt.date)}
                    isUpcomingSoon={isUpcomingSoon(apt.date)}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Historical Stats Summary */}
          {past.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">Historique des visites</h4>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{appointmentsArray.length}</p>
                  <p className="text-xs text-blue-700 font-medium">Total visites</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
                  <p className="text-sm font-semibold text-green-600 leading-tight">
                    {getTimeSinceLastVisit() || 'N/A'}
                  </p>
                  <p className="text-xs text-green-700 font-medium">Dernière visite</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-purple-600 leading-tight">
                    {getNoShowRate()}
                  </p>
                  <p className="text-xs text-purple-700 font-medium">Absences</p>
                </div>
              </div>

              {/* Most Common Reason */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Motif le plus fréquent</p>
                <p className="text-sm font-semibold text-gray-900">{getMostCommonReason()}</p>
              </div>

              {/* Past Appointments List */}
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Rendez-vous passés ({past.length})
              </h4>
              <div className="space-y-2">
                {(showAllHistory ? past : past.slice(0, 3)).map((apt) => (
                  <EnhancedAppointmentCard
                    key={apt._id || apt.id}
                    appointment={apt}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    onClick={() => handleAppointmentClick(apt)}
                    onEdit={() => handleEdit(apt)}
                    onMarkCompleted={() => handleMarkCompleted(apt)}
                    onMarkNoShow={() => handleMarkNoShow(apt)}
                    paymentStatus={getPaymentStatus(apt)}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
              </div>

              {/* Show More/Less Button */}
              {past.length > 3 && (
                <button
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="w-full mt-3 py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  {showAllHistory ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Voir moins
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Voir les {past.length} rendez-vous
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {appointments.length > 10 && (
            <button
              onClick={() => navigate(`/appointments?patientId=${patientId}`)}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-700 py-2 mt-2"
            >
              Voir l'historique complet dans Rendez-vous →
            </button>
          )}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <CancelModal
          appointment={cancellingAppointment}
          onConfirm={handleCancelConfirm}
          onClose={() => {
            setCancelModalOpen(false);
            setCancellingAppointment(null);
            setCancelReason('');
          }}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
        />
      )}
    </CollapsibleSection>
  );
}

// Enhanced Appointment Row Component
function AppointmentRow({
  appointment,
  formatDate,
  formatTime,
  isPast,
  isToday,
  isUpcomingSoon,
  onClick,
  onStartConsultation,
  onCheckIn,
  onEdit,
  onConfirm,
  onCancel,
  onMarkCompleted,
  onMarkNoShow,
  paymentStatus,
  openMenuId,
  setOpenMenuId
}) {
  const apt = appointment;
  const menuOpen = openMenuId === apt._id;

  const statusColors = {
    confirmed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-600',
    'no-show': 'bg-red-100 text-red-700',
    'checked-in': 'bg-blue-100 text-blue-700'
  };

  return (
    <div
      className={`relative flex items-center justify-between p-3 rounded-lg transition cursor-pointer ${
        isToday
          ? 'bg-blue-50 border-2 border-blue-300 border-l-4 hover:bg-blue-100'
          : isPast
            ? 'bg-gray-50 hover:bg-gray-100'
            : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1">
        <div className={`p-2 rounded ${
          isToday ? 'bg-blue-200' :
          isPast ? 'bg-gray-200' : 'bg-blue-100'
        }`}>
          <Calendar className={`h-4 w-4 ${
            isToday ? 'text-blue-700' :
            isPast ? 'text-gray-500' : 'text-blue-600'
          }`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>
              {formatDate(apt.date)}
            </p>
            {isToday && (
              <span className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded font-semibold">
                Aujourd'hui
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatTime(apt.date)}
            {apt.reason && ` • ${apt.reason}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {/* Payment Status Badge */}
        {paymentStatus && (
          <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
            paymentStatus.status === 'paid' ? 'bg-green-100 text-green-700' :
            paymentStatus.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            <DollarSign className="h-3 w-3" />
            {paymentStatus.status === 'paid' ? 'Payé' :
             paymentStatus.status === 'pending' ? 'En attente' : 'Impayé'}
          </span>
        )}

        {/* Appointment Status Badge */}
        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[apt.status] || 'bg-gray-100 text-gray-600'}`}>
          {apt.status === 'confirmed' ? 'Confirmé' :
           apt.status === 'pending' ? 'En attente' :
           apt.status === 'cancelled' ? 'Annulé' :
           apt.status === 'completed' ? 'Terminé' :
           apt.status === 'no-show' ? 'Absent' :
           apt.status === 'checked-in' ? 'Enregistré' : apt.status}
        </span>

        {/* Quick Action Buttons for Today's Appointments */}
        {isToday && !isPast && (
          <div className="flex gap-1">
            {onStartConsultation && (
              <button
                onClick={onStartConsultation}
                className="p-1.5 text-green-600 hover:bg-green-100 rounded transition"
                title="Démarrer consultation"
              >
                <PlayCircle className="h-4 w-4" />
              </button>
            )}
            {onCheckIn && apt.status !== 'checked-in' && (
              <button
                onClick={onCheckIn}
                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                title="Enregistrer dans la file"
              >
                <UserCheck className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(menuOpen ? null : apt._id);
            }}
            className="p-1 hover:bg-gray-200 rounded transition"
          >
            <MoreVertical className="h-4 w-4 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
              <button
                onClick={() => { onEdit(); setOpenMenuId(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"
              >
                <Edit2 className="h-3 w-3" />
                Modifier
              </button>

              {!isPast && apt.status === 'pending' && onConfirm && (
                <button
                  onClick={() => { onConfirm(); setOpenMenuId(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2 text-green-600"
                >
                  <CheckCircle className="h-3 w-3" />
                  Confirmer
                </button>
              )}

              {!isPast && apt.status !== 'cancelled' && onCancel && (
                <button
                  onClick={() => { onCancel(); setOpenMenuId(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                >
                  <XCircle className="h-3 w-3" />
                  Annuler
                </button>
              )}

              {isPast && apt.status !== 'completed' && apt.status !== 'no-show' && (
                <>
                  {onMarkCompleted && (
                    <button
                      onClick={() => { onMarkCompleted(); setOpenMenuId(null); }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Marquer terminé
                    </button>
                  )}
                  {onMarkNoShow && (
                    <button
                      onClick={() => { onMarkNoShow(); setOpenMenuId(null); }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Marquer absent
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Appointment Card with Outcome Details
function EnhancedAppointmentCard({
  appointment,
  formatDate,
  formatTime,
  onClick,
  onEdit,
  onMarkCompleted,
  onMarkNoShow,
  paymentStatus,
  openMenuId,
  setOpenMenuId
}) {
  const apt = appointment;
  const menuOpen = openMenuId === apt._id;

  const statusColors = {
    confirmed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-600',
    'no-show': 'bg-red-100 text-red-700',
    'checked-in': 'bg-blue-100 text-blue-700'
  };

  // Check if there are outcomes to display
  const hasOutcome = apt.outcome && (
    apt.outcome.diagnosis?.length > 0 ||
    apt.outcome.procedures?.length > 0 ||
    apt.outcome.prescriptions?.length > 0
  );

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">
              {formatDate(apt.date)}
            </p>
            <span className="text-xs text-gray-400">
              {formatTime(apt.date)}
            </span>
          </div>

          {/* Reason/Type */}
          <p className="text-sm text-gray-700 font-medium">
            {apt.reason || apt.type || 'Consultation'}
          </p>

          {/* Provider */}
          {apt.provider && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <User className="h-3 w-3" />
              {typeof apt.provider === 'string'
                ? apt.provider
                : apt.provider.fullName || apt.provider.name || `${apt.provider.firstName || ''} ${apt.provider.lastName || ''}`.trim() || 'Médecin'}
            </p>
          )}
        </div>

        {/* Status and Payment */}
        <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
          <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[apt.status] || 'bg-gray-100 text-gray-600'}`}>
            {apt.status === 'completed' ? 'Terminé' :
             apt.status === 'cancelled' ? 'Annulé' :
             apt.status === 'no-show' ? 'Absent' : apt.status}
          </span>

          {paymentStatus && (
            <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
              paymentStatus.status === 'paid' ? 'bg-green-100 text-green-700' :
              paymentStatus.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              <DollarSign className="h-3 w-3" />
              {paymentStatus.status === 'paid' ? 'Payé' :
               paymentStatus.status === 'pending' ? 'En attente' : 'Impayé'}
            </span>
          )}

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(menuOpen ? null : apt._id);
              }}
              className="p-1 hover:bg-gray-200 rounded transition"
            >
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); setOpenMenuId(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"
                >
                  <Edit2 className="h-3 w-3" />
                  Modifier
                </button>

                {apt.status !== 'completed' && apt.status !== 'no-show' && (
                  <>
                    {onMarkCompleted && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMarkCompleted(); setOpenMenuId(null); }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Marquer terminé
                      </button>
                    )}
                    {onMarkNoShow && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMarkNoShow(); setOpenMenuId(null); }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                      >
                        <AlertCircle className="h-3 w-3" />
                        Marquer absent
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outcome Details */}
      {hasOutcome && (
        <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
          {/* Diagnoses */}
          {apt.outcome.diagnosis && apt.outcome.diagnosis.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Diagnostic
              </p>
              <div className="flex flex-wrap gap-1">
                {apt.outcome.diagnosis.slice(0, 3).map((diag, idx) => (
                  <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {diag}
                  </span>
                ))}
                {apt.outcome.diagnosis.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{apt.outcome.diagnosis.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Procedures */}
          {apt.outcome.procedures && apt.outcome.procedures.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Procédures
              </p>
              <div className="flex flex-wrap gap-1">
                {apt.outcome.procedures.slice(0, 2).map((proc, idx) => (
                  <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                    {proc}
                  </span>
                ))}
                {apt.outcome.procedures.length > 2 && (
                  <span className="text-xs text-gray-400">
                    +{apt.outcome.procedures.length - 2}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Prescriptions */}
          {apt.outcome.prescriptions && apt.outcome.prescriptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                <Pill className="h-3 w-3" />
                Ordonnances
              </p>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                {apt.outcome.prescriptions.length} ordonnance{apt.outcome.prescriptions.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Follow-up */}
          {apt.outcome.followUpRequired && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" />
              Suivi requis
              {apt.outcome.followUpDate && (
                <span className="text-gray-500">
                  - {new Date(apt.outcome.followUpDate).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cancellation Reason */}
      {apt.status === 'cancelled' && apt.cancellation?.reason && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <p className="text-xs text-red-600">
            <span className="font-semibold">Annulé:</span> {apt.cancellation.reason}
          </p>
        </div>
      )}
    </div>
  );
}

// Cancel Confirmation Modal
function CancelModal({ appointment, onConfirm, onClose, cancelReason, setCancelReason}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Annuler le rendez-vous
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Êtes-vous sûr de vouloir annuler ce rendez-vous ?
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Raison (optionnelle)
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="3"
            placeholder="Raison de l'annulation..."
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Confirmer l'annulation
          </button>
        </div>
      </div>
    </div>
  );
}
