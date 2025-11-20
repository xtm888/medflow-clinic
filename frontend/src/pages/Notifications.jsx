import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, Phone, CheckCircle2, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/apiConfig';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      setNotifications(notificationsResponse.data?.data || notificationsResponse.data || []);
      setAppointments(appointmentsResponse.data?.data || appointmentsResponse.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erreur lors du chargement des notifications');
    } finally {
      setLoading(false);
    }
  };

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestion des rappels et communications patients (SMS/WhatsApp/Email)
        </p>
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
              <p className="text-3xl font-bold text-orange-900">${totalCost.toFixed(2)}</p>
            </div>
            <Mail className="h-10 w-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Notification Log */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Historique des notifications</h2>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune notification trouvée
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const type = (notif.type || notif.channel || 'EMAIL').toUpperCase();
              const status = (notif.status || 'SENT').toUpperCase();

              return (
                <div key={notif._id || notif.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className={`p-2 rounded-lg ${
                    type === 'SMS' ? 'bg-blue-100' :
                    type === 'WHATSAPP' ? 'bg-green-100' :
                    'bg-purple-100'
                  }`}>
                    {type === 'SMS' ? <MessageSquare className="h-5 w-5 text-blue-600" /> :
                     type === 'WHATSAPP' ? <Phone className="h-5 w-5 text-green-600" /> :
                     <Mail className="h-5 w-5 text-purple-600" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {notif.recipient || notif.to || 'Destinataire'}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className={`badge ${
                          status === 'DELIVERED' || status === 'READ' ? 'badge-success' :
                          status === 'SENT' ? 'badge-info' :
                          'badge-danger'
                        }`}>
                          {status === 'DELIVERED' ? 'Délivré' :
                           status === 'READ' ? 'Lu' :
                           status === 'SENT' ? 'Envoyé' :
                           'Échec'}
                        </span>
                        {notif.cost && (
                          <span className="text-xs text-gray-500">${notif.cost.toFixed(3)}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {notif.message || notif.content || notif.subject || 'Message'}
                    </p>
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
                  <button className="btn btn-primary text-sm">
                    Envoyer rappel
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
