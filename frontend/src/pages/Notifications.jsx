import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Bell, MessageSquare, Mail, Phone, CheckCircle2, XCircle, Clock, Loader2, AlertCircle, RefreshCw, Filter, Send, Inbox, Search, BellOff } from 'lucide-react';
import api from '../services/apiConfig';
import { formatCurrency } from '../utils/formatters';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sendingReminder, setSendingReminder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [notificationsResponse, appointmentsResponse] = await Promise.all([
        api.get('/notifications', { params: { limit: 50 } }).catch(() => ({ data: { data: [] } })),
        api.get('/appointments', { params: { status: 'confirmed', limit: 20 } }).catch(() => ({ data: { data: [] } }))
      ]);

      // Safely extract arrays from various API response formats
      const rawNotifications = notificationsResponse?.data?.data ?? notificationsResponse?.data ?? [];
      setNotifications(Array.isArray(rawNotifications) ? rawNotifications : []);

      const rawAppointments = appointmentsResponse?.data?.data ?? appointmentsResponse?.data ?? [];
      setAppointments(Array.isArray(rawAppointments) ? rawAppointments : []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erreur lors du chargement des notifications');
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (appointment) => {
    try {
      setSendingReminder(appointment._id || appointment.id);

      // Try to send reminder via SMS endpoint
      const patientPhone = appointment.patient?.phoneNumber || appointment.patient?.phone || appointment.patientPhone;
      const patientName = appointment.patient
        ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
        : appointment.patientName || 'Patient';

      if (!patientPhone) {
        toast.warning(`Pas de numéro de téléphone pour ${patientName}`, { icon: '📱' });
        return;
      }

      // Try SMS reminder endpoint
      await api.post('/notifications/send-reminder', {
        appointmentId: appointment._id || appointment.id,
        type: 'SMS',
        phone: patientPhone
      }).catch(() => {
        // Fallback: Try generic notification endpoint
        return api.post('/notifications', {
          recipient: patientPhone,
          type: 'SMS',
          message: `Rappel: Votre RDV est prévu le ${new Date(appointment.date || appointment.appointmentDate).toLocaleDateString('fr-FR')}`,
          appointmentId: appointment._id || appointment.id
        });
      });

      toast.success(`Rappel envoyé à ${patientName}`, { icon: '✅' });
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error sending reminder:', err);
      toast.error(err.response?.data?.message || 'Impossible d\'envoyer le rappel');
    } finally {
      setSendingReminder(null);
    }
  };

  // Filter notifications by type and search query
  const filteredNotifications = notifications.filter(n => {
    // Type filter
    const type = (n.type || n.channel || 'EMAIL').toUpperCase();
    const matchesType = activeFilter === 'all' || type === activeFilter.toUpperCase();

    // Search filter
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = !searchLower ||
      (n.recipient || n.to || '').toLowerCase().includes(searchLower) ||
      (n.message || n.content || n.subject || '').toLowerCase().includes(searchLower);

    return matchesType && matchesSearch;
  });

  const totalSent = notifications.length;
  const delivered = notifications.filter(n => n.status === 'DELIVERED' || n.status === 'READ' || n.status === 'delivered' || n.status === 'read').length;
  const totalCost = notifications.reduce((sum, n) => sum + (n.cost || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des notifications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des rappels et communications patients (SMS/WhatsApp/Email)
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
          <button
            onClick={fetchData}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Envoyées</p>
              <p className="text-3xl font-bold text-blue-900">{totalSent}</p>
            </div>
            <Bell className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Délivrées</p>
              <p className="text-3xl font-bold text-green-900">{delivered}</p>
            </div>
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Taux de réussite</p>
              <p className="text-3xl font-bold text-purple-900">
                {totalSent > 0 ? Math.round((delivered/totalSent)*100) : 0}%
              </p>
            </div>
            <CheckCircle2 className="h-10 w-10 text-purple-500" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Coût total</p>
              <p className="text-3xl font-bold text-orange-900">{formatCurrency(totalCost, 'USD')}</p>
            </div>
            <Mail className="h-10 w-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filter Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500 mr-2">Filtrer:</span>
          {[
            { id: 'all', label: 'Tous', icon: Bell },
            { id: 'SMS', label: 'SMS', icon: MessageSquare },
            { id: 'WHATSAPP', label: 'WhatsApp', icon: Phone },
            { id: 'EMAIL', label: 'Email', icon: Mail },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                activeFilter === filter.id
                  ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <filter.icon className="h-3.5 w-3.5 mr-1.5" />
              {filter.label}
              {filter.id !== 'all' && (
                <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                  {notifications.filter(n => (n.type || n.channel || 'EMAIL').toUpperCase() === filter.id).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher destinataire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>
      </div>

      {/* Notification Log */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Historique des notifications
          {activeFilter !== 'all' && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredNotifications.length} résultats)
            </span>
          )}
        </h2>
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'Aucun résultat' : 'Aucune notification'}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {searchQuery
                ? `Aucune notification trouvée pour "${searchQuery}". Essayez un autre terme de recherche.`
                : 'Les notifications envoyées (SMS, WhatsApp, Email) apparaîtront ici. Utilisez la section "Rappels programmés" ci-dessous pour envoyer des rappels aux patients.'
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const type = (notif.type || notif.channel || 'EMAIL').toUpperCase();
              const status = (notif.status || 'SENT').toUpperCase();

              const isFailed = status === 'FAILED' || status === 'ERROR' || status === 'ECHEC';

              return (
                <div
                  key={notif._id || notif.id}
                  className={`flex items-start space-x-4 p-4 rounded-lg transition-colors ${
                    isFailed
                      ? 'bg-red-50 border border-red-200 hover:bg-red-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    isFailed ? 'bg-red-100' :
                    type === 'SMS' ? 'bg-blue-100' :
                    type === 'WHATSAPP' ? 'bg-green-100' :
                    'bg-purple-100'
                  }`}>
                    {isFailed ? <XCircle className="h-5 w-5 text-red-600" /> :
                     type === 'SMS' ? <MessageSquare className="h-5 w-5 text-blue-600" /> :
                     type === 'WHATSAPP' ? <Phone className="h-5 w-5 text-green-600" /> :
                     <Mail className="h-5 w-5 text-purple-600" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-semibold ${isFailed ? 'text-red-900' : 'text-gray-900'}`}>
                        {notif.recipient || notif.to || 'Destinataire'}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'DELIVERED' || status === 'READ' ? 'bg-green-100 text-green-700' :
                          status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {isFailed && <XCircle className="h-3 w-3" />}
                          {(status === 'DELIVERED' || status === 'READ') && <CheckCircle2 className="h-3 w-3" />}
                          {status === 'DELIVERED' ? 'Délivré' :
                           status === 'READ' ? 'Lu' :
                           status === 'SENT' ? 'Envoyé' :
                           'Échec'}
                        </span>
                        {notif.cost && (
                          <span className="text-xs text-gray-500">{formatCurrency(notif.cost, 'USD')}</span>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm mb-2 ${isFailed ? 'text-red-700' : 'text-gray-600'}`}>
                      {notif.message || notif.content || notif.subject || 'Message'}
                    </p>
                    {isFailed && notif.error && (
                      <p className="text-xs text-red-600 mb-2 italic">
                        Erreur: {notif.error}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(notif.sentDate || notif.createdAt || notif.sentAt).toLocaleString('fr-FR')} · {type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming Reminders */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Rappels programmés</h2>
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun rappel programmé
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.filter(a => a.status === 'confirmed' || a.status === 'CONFIRMED').map((apt) => {
              const patientName = apt.patient
                ? `${apt.patient.firstName} ${apt.patient.lastName}`
                : apt.patientName || 'Patient';

              return (
                <div key={apt._id || apt.id} className="flex items-start justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{patientName}</p>
                      <p className="text-sm text-gray-600">
                        RDV le {new Date(apt.date || apt.appointmentDate).toLocaleDateString('fr-FR')}
                        {apt.time && ` à ${apt.time}`}
                        {apt.startTime && ` à ${apt.startTime}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => sendReminder(apt)}
                    disabled={sendingReminder === (apt._id || apt.id)}
                    className="btn btn-primary text-sm inline-flex items-center disabled:opacity-50"
                  >
                    {sendingReminder === (apt._id || apt.id) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1.5" />
                        Envoyer rappel
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
