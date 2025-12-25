import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, Clock, DollarSign, UserPlus, Search,
  Phone, CheckCircle, AlertTriangle, Loader2, Bell, CreditCard,
  ClipboardList, ArrowRight, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import api from '../../services/apiConfig';

/**
 * ReceptionistView - Role-based dashboard for receptionists
 *
 * StudioVision Philosophy: Everything on one screen
 *
 * Shows:
 * - Today's queue (patients waiting, in progress, completed)
 * - Today's appointments
 * - Pending invoices needing payment
 * - Quick actions: New patient, Check-in, New appointment
 */
export default function ReceptionistView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [queueStats, setQueueStats] = useState({ waiting: 0, inProgress: 0, completed: 0 });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [queueRes, appointmentsRes, invoicesRes, patientsRes] = await Promise.all([
        api.get('/queue/stats').catch(() => ({ data: { data: {} } })),
        api.get('/appointments/today').catch(() => ({ data: { data: [] } })),
        api.get('/invoices?status=pending&limit=10').catch(() => ({ data: { data: [] } })),
        api.get('/patients?limit=5&sort=-createdAt').catch(() => ({ data: { data: [] } }))
      ]);

      // Extract data from responses
      const extractData = (res, defaultValue = []) => {
        if (!res) return defaultValue;
        if (res.data?.data) return res.data.data;
        if (res.data) return res.data;
        return defaultValue;
      };

      const queueData = extractData(queueRes, {});
      setQueueStats({
        waiting: queueData.waiting || queueData.pending || 0,
        inProgress: queueData.inProgress || queueData['in-progress'] || 0,
        completed: queueData.completed || 0
      });

      setTodayAppointments(extractData(appointmentsRes));
      setPendingInvoices(extractData(invoicesRes));
      setRecentPatients(extractData(patientsRes));
    } catch (err) {
      console.error('Error fetching receptionist data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    // Check for invalid date
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0 CDF';
    return new Intl.NumberFormat('fr-FR').format(amount) + ' CDF';
  };

  if (loading && !queueStats.waiting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accueil</h1>
          <p className="text-gray-600">
            Bienvenue, {user?.firstName || user?.name || 'Réceptionniste'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </span>
          <button
            onClick={fetchData}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Actualiser"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => navigate('/patients/new')}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <UserPlus className="h-8 w-8 mb-2" />
          <span className="font-medium">Nouveau Patient</span>
        </button>
        <button
          onClick={() => navigate('/queue')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <ClipboardList className="h-8 w-8 mb-2" />
          <span className="font-medium">Check-in</span>
        </button>
        <button
          onClick={() => navigate('/appointments/new')}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <Calendar className="h-8 w-8 mb-2" />
          <span className="font-medium">Nouveau RDV</span>
        </button>
        <button
          onClick={() => navigate('/invoicing')}
          className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <CreditCard className="h-8 w-8 mb-2" />
          <span className="font-medium">Encaissement</span>
        </button>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Queue */}
        <div className="space-y-4">
          {/* Queue Stats */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                File d'Attente
              </h2>
              <button
                onClick={() => navigate('/queue')}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Voir tout →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{queueStats.waiting}</div>
                <div className="text-xs text-yellow-700">En attente</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{queueStats.inProgress}</div>
                <div className="text-xs text-blue-700">En cours</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
                <div className="text-xs text-green-700">Terminés</div>
              </div>
            </div>
          </div>

          {/* Recent Patients */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Derniers Patients
              </h2>
              <button
                onClick={() => navigate('/patients')}
                className="text-purple-600 hover:text-purple-800 text-sm"
              >
                Voir tout →
              </button>
            </div>
            <div className="space-y-2">
              {recentPatients.slice(0, 5).map((patient) => (
                <div
                  key={patient._id}
                  onClick={() => navigate(`/patients/${patient._id}`)}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {patient.lastName} {patient.firstName}
                    </div>
                    <div className="text-xs text-gray-500">{patient.patientId}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              ))}
              {recentPatients.length === 0 && (
                <p className="text-gray-500 text-center py-4">Aucun patient récent</p>
              )}
            </div>
          </div>
        </div>

        {/* Center Column - Appointments */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              Rendez-vous Aujourd'hui
            </h2>
            <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded">
              {todayAppointments.length} RDV
            </span>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {todayAppointments.map((apt) => (
              <div
                key={apt._id}
                onClick={() => navigate(`/appointments/${apt._id}`)}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                  apt.status === 'checked-in' ? 'border-green-300 bg-green-50' :
                  apt.status === 'completed' ? 'border-gray-300 bg-gray-50' :
                  apt.status === 'cancelled' ? 'border-red-300 bg-red-50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {formatTime(apt.scheduledTime || apt.startTime)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    apt.status === 'checked-in' ? 'bg-green-200 text-green-800' :
                    apt.status === 'completed' ? 'bg-gray-200 text-gray-700' :
                    apt.status === 'cancelled' ? 'bg-red-200 text-red-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {apt.status === 'checked-in' ? 'Arrivé' :
                     apt.status === 'completed' ? 'Terminé' :
                     apt.status === 'cancelled' ? 'Annulé' : 'Confirmé'}
                  </span>
                </div>
                <div className="mt-1">
                  <div className="font-medium text-gray-800">
                    {apt.patient?.lastName} {apt.patient?.firstName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {apt.type || apt.reason || 'Consultation'}
                    {apt.provider && ` • Dr. ${apt.provider.name || apt.provider.lastName}`}
                  </div>
                </div>
              </div>
            ))}
            {todayAppointments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                <p>Aucun rendez-vous aujourd'hui</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Invoices */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
              Factures en Attente
            </h2>
            <button
              onClick={() => navigate('/invoicing?status=pending')}
              className="text-amber-600 hover:text-amber-800 text-sm"
            >
              Voir tout →
            </button>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {pendingInvoices.map((invoice) => (
              <div
                key={invoice._id}
                onClick={() => navigate(`/invoicing/${invoice._id}`)}
                className="p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {invoice.invoiceNumber || `#${invoice._id?.slice(-6)}`}
                  </span>
                  <span className="font-bold text-amber-700">
                    {formatCurrency(invoice.amountDue || invoice.total)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {invoice.patient?.lastName} {invoice.patient?.firstName}
                </div>
              </div>
            ))}
            {pendingInvoices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-2" />
                <p>Aucune facture en attente</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
