import { Calendar, Pill, FileText, DollarSign, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { appointments, prescriptions, invoices } from '../../data/mockData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PatientDashboard() {
  // Mock patient ID - would come from auth context
  const currentPatientId = 1;

  // Filter data for current patient
  const myAppointments = appointments.filter(apt => apt.patientId === currentPatientId);
  const upcomingAppointments = myAppointments.filter(apt => new Date(apt.date) >= new Date() && apt.status !== 'CANCELLED');
  const myPrescriptions = prescriptions.filter(rx => rx.patientId === currentPatientId && rx.status !== 'CANCELLED');
  const activePrescriptions = myPrescriptions.filter(rx => rx.status === 'PENDING' || rx.status === 'DISPENSED');
  const myInvoices = invoices.filter(inv => inv.patientId === currentPatientId);
  const unpaidInvoices = myInvoices.filter(inv => inv.balance > 0);
  const totalBalance = unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Tableau de bord</h1>
        <p className="text-blue-100">
          Bienvenue sur votre portail patient. Consultez vos rendez-vous, ordonnances et plus encore.
        </p>
      </div>

      {/* Alert Banner */}
      {upcomingAppointments.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Prochain rendez-vous: {format(new Date(upcomingAppointments[0].date), 'dd MMMM yyyy', { locale: fr })} à {upcomingAppointments[0].time}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-white hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rendez-vous</p>
              <p className="text-3xl font-bold text-gray-900">{upcomingAppointments.length}</p>
              <p className="text-xs text-gray-500 mt-1">À venir</p>
            </div>
            <Calendar className="h-10 w-10 text-blue-500" />
          </div>
          <Link to="/patient/appointments" className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Voir tous →
          </Link>
        </div>

        <div className="card bg-white hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ordonnances</p>
              <p className="text-3xl font-bold text-gray-900">{activePrescriptions.length}</p>
              <p className="text-xs text-gray-500 mt-1">Actives</p>
            </div>
            <Pill className="h-10 w-10 text-green-500" />
          </div>
          <Link to="/patient/prescriptions" className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Voir tous →
          </Link>
        </div>

        <div className="card bg-white hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Résultats</p>
              <p className="text-3xl font-bold text-gray-900">0</p>
              <p className="text-xs text-gray-500 mt-1">Disponibles</p>
            </div>
            <FileText className="h-10 w-10 text-purple-500" />
          </div>
          <Link to="/patient/results" className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Voir tous →
          </Link>
        </div>

        <div className="card bg-white hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Solde</p>
              <p className={`text-3xl font-bold ${totalBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ${totalBalance.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">À payer</p>
            </div>
            <DollarSign className="h-10 w-10 text-orange-500" />
          </div>
          <Link to="/patient/bills" className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Voir tous →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Prochains rendez-vous</h2>
            <Link to="/patient/appointments" className="text-sm text-blue-600 hover:text-blue-700">
              Voir tous
            </Link>
          </div>

          {upcomingAppointments.length > 0 ? (
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {format(new Date(apt.date), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {apt.time} - {apt.duration} minutes
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Salle: {apt.room}</p>
                    </div>
                    <span className="badge badge-success">{apt.status === 'CONFIRMED' ? 'Confirmé' : 'En attente'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Aucun rendez-vous à venir</p>
              <Link to="/patient/appointments" className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700">
                Prendre un rendez-vous
              </Link>
            </div>
          )}
        </div>

        {/* Recent Prescriptions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Ordonnances récentes</h2>
            <Link to="/patient/prescriptions" className="text-sm text-blue-600 hover:text-blue-700">
              Voir toutes
            </Link>
          </div>

          {activePrescriptions.length > 0 ? (
            <div className="space-y-3">
              {activePrescriptions.slice(0, 3).map((rx) => (
                <div key={rx.id} className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        Ordonnance #{rx.id}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {rx.medications.length} médicament(s)
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(rx.date), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <span className={`badge ${
                      rx.status === 'DISPENSED' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {rx.status === 'DISPENSED' ? 'Délivrée' : 'En attente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Pill className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Aucune ordonnance active</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card bg-gradient-to-r from-gray-50 to-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link to="/patient/appointments" className="btn btn-primary flex items-center justify-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Prendre RDV</span>
          </Link>
          <Link to="/patient/messages" className="btn btn-secondary flex items-center justify-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Contacter médecin</span>
          </Link>
          <Link to="/patient/bills" className="btn btn-secondary flex items-center justify-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Payer facture</span>
          </Link>
        </div>
      </div>

      {/* Important Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">
              <strong>Important:</strong> Ce portail est destiné aux demandes non urgentes uniquement.
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              En cas d'urgence médicale, appelez le <strong className="text-red-600">112</strong> ou contactez
              directement notre clinique au <strong>+243 81 234 5678</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
