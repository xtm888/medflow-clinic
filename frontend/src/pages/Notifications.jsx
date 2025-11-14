import { Bell, MessageSquare, Mail, Phone, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { notifications, appointments } from '../data/mockData';

export default function Notifications() {
  const totalSent = notifications.length;
  const delivered = notifications.filter(n => n.status === 'DELIVERED' || n.status === 'READ').length;
  const totalCost = notifications.reduce((sum, n) => sum + n.cost, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestion des rappels et communications patients (SMS/WhatsApp/Email)
        </p>
      </div>

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
              <p className="text-3xl font-bold text-purple-900">{Math.round((delivered/totalSent)*100)}%</p>
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
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div key={notif.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className={`p-2 rounded-lg ${
                notif.type === 'SMS' ? 'bg-blue-100' :
                notif.type === 'WHATSAPP' ? 'bg-green-100' :
                'bg-purple-100'
              }`}>
                {notif.type === 'SMS' ? <MessageSquare className="h-5 w-5 text-blue-600" /> :
                 notif.type === 'WHATSAPP' ? <Phone className="h-5 w-5 text-green-600" /> :
                 <Mail className="h-5 w-5 text-purple-600" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">{notif.recipient}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`badge ${
                      notif.status === 'DELIVERED' || notif.status === 'READ' ? 'badge-success' :
                      notif.status === 'SENT' ? 'badge-info' :
                      'badge-danger'
                    }`}>
                      {notif.status === 'DELIVERED' ? 'Délivré' :
                       notif.status === 'READ' ? 'Lu' :
                       notif.status === 'SENT' ? 'Envoyé' :
                       'Échec'}
                    </span>
                    <span className="text-xs text-gray-500">${notif.cost.toFixed(3)}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                <p className="text-xs text-gray-500">
                  {new Date(notif.sentDate).toLocaleString('fr-FR')} · {notif.type} · {notif.phone || notif.email}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Reminders */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Rappels programmés</h2>
        <div className="space-y-3">
          {appointments.filter(a => a.status === 'CONFIRMED').map((apt) => (
            <div key={apt.id} className="flex items-start justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{apt.patientName}</p>
                  <p className="text-sm text-gray-600">
                    RDV le {new Date(apt.date).toLocaleDateString('fr-FR')} à {apt.time}
                  </p>
                </div>
              </div>
              <button className="btn btn-primary text-sm">
                Envoyer rappel
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
