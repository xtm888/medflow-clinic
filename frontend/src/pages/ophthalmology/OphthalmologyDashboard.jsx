import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, Users, Calendar, TrendingUp,
  AlertCircle, FileText, Package, Clock,
  Glasses, Camera, Activity, ChevronRight
} from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PatientSelectorModal from '../../components/PatientSelectorModal';

export default function OphthalmologyDashboard() {
  const navigate = useNavigate();
  const [showPatientSelector, setShowPatientSelector] = useState(false);

  const handleSelectPatient = (patient) => {
    navigate(`/ophthalmology/refraction?patientId=${patient._id || patient.id}`);
  };

  const stats = {
    todayExams: 12,
    weeklyExams: 58,
    pendingReports: 3,
    lowStockMeds: 4,

    diagnoses: [
      { name: 'Myopie', count: 35, color: '#3b82f6' },
      { name: 'Presbytie', count: 28, color: '#10b981' },
      { name: 'Astigmatisme', count: 22, color: '#f59e0b' },
      { name: 'Hypermétropie', count: 15, color: '#8b5cf6' },
      { name: 'Glaucome', count: 12, color: '#ef4444' },
      { name: 'Cataracte', count: 8, color: '#6b7280' }
    ],

    revenueData: [
      { month: 'Jan', revenue: 8500, patients: 120 },
      { month: 'Fév', revenue: 9200, patients: 135 },
      { month: 'Mar', revenue: 8800, patients: 128 },
      { month: 'Avr', revenue: 10500, patients: 145 },
      { month: 'Mai', revenue: 11200, patients: 158 },
      { month: 'Juin', revenue: 12300, patients: 165 }
    ],

    recentExams: [
      { id: 1, patient: 'Mbuyi Kabongo', time: '09:00', type: 'Réfraction', status: 'completed', doctor: 'Dr. Mutombo' },
      { id: 2, patient: 'Tshala Mwamba', time: '09:45', type: 'Contrôle Glaucome', status: 'in-progress', doctor: 'Dr. Kabeya' },
      { id: 3, patient: 'Nkulu Tshisekedi', time: '10:30', type: 'OCT', status: 'scheduled', doctor: 'Dr. Mutombo' },
      { id: 4, patient: 'Marie Lukusa', time: '11:00', type: 'Champ Visuel', status: 'scheduled', doctor: 'Dr. Kabeya' },
      { id: 5, patient: 'Jean Ilunga', time: '11:30', type: 'Adaptation Lentilles', status: 'scheduled', doctor: 'Dr. Mutombo' }
    ],

    criticalAlerts: [
      { type: 'medication', message: 'Latanoprost stock critique (5 flacons)', severity: 'high', icon: Package },
      { type: 'equipment', message: 'Calibration autorefractor requise', severity: 'medium', icon: Camera },
      { type: 'followup', message: '3 patients glaucome en retard de suivi', severity: 'high', icon: Users },
      { type: 'expiry', message: 'Tropicamide expire dans 15 jours', severity: 'medium', icon: AlertCircle }
    ],

    upcomingAppointments: [
      { time: '14:00', patient: 'Sophie Mbemba', type: 'Post-op Cataracte' },
      { time: '14:30', patient: 'André Tshombe', type: 'Réfraction' },
      { time: '15:00', patient: 'Claire Mwangi', type: 'Fond d\'œil' },
      { time: '15:30', patient: 'Paul Kasongo', type: 'OCT Glaucome' }
    ],

    equipmentStatus: [
      { name: 'Autorefractor', status: 'operational', lastService: '2024-12-15' },
      { name: 'OCT Scanner', status: 'operational', lastService: '2024-11-20' },
      { name: 'Lampe à Fente', status: 'maintenance', lastService: '2024-10-10' },
      { name: 'Périmètre', status: 'operational', lastService: '2025-01-05' }
    ]
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Eye className="w-6 h-6 mr-3 text-blue-600" />
          Tableau de Bord Ophtalmologie
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setShowPatientSelector(true)}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg hover:shadow-lg transition-shadow flex flex-col items-center"
        >
          <Eye className="w-8 h-8 mb-2" />
          <span className="font-medium">Nouvel Examen</span>
          <span className="text-xs opacity-90">Démarrer réfraction</span>
        </button>
        <button
          onClick={() => navigate('/queue')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg hover:shadow-lg transition-shadow flex flex-col items-center"
        >
          <Users className="w-8 h-8 mb-2" />
          <span className="font-medium">File d'Attente</span>
          <span className="text-xs opacity-90">8 patients</span>
        </button>
        <button
          onClick={() => navigate('/ophthalmology/imaging')}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg hover:shadow-lg transition-shadow flex flex-col items-center"
        >
          <Camera className="w-8 h-8 mb-2" />
          <span className="font-medium">Imagerie</span>
          <span className="text-xs opacity-90">OCT, Fundus</span>
        </button>
        <button
          onClick={() => navigate('/ophthalmology/pharmacy')}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-lg hover:shadow-lg transition-shadow flex flex-col items-center"
        >
          <Package className="w-8 h-8 mb-2" />
          <span className="font-medium">Pharmacie</span>
          <span className="text-xs opacity-90">Gouttes oculaires</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Examens Aujourd'hui</p>
              <p className="text-2xl font-bold">{stats.todayExams}</p>
              <p className="text-xs text-green-600">+15% vs hier</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Cette Semaine</p>
              <p className="text-2xl font-bold">{stats.weeklyExams}</p>
              <p className="text-xs text-green-600">+8% vs semaine dernière</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rapports en Attente</p>
              <p className="text-2xl font-bold text-orange-600">{stats.pendingReports}</p>
              <p className="text-xs text-orange-600">À finaliser</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Méd. Stock Bas</p>
              <p className="text-2xl font-bold text-red-600">{stats.lowStockMeds}</p>
              <p className="text-xs text-red-600">Commande requise</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Exams */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-600" />
              Examens du Jour
            </h3>
            <button
              onClick={() => navigate('/appointments')}
              className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
            >
              Voir tous
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="space-y-3">
            {stats.recentExams.map(exam => (
              <div key={exam.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-medium text-gray-600 w-16">{exam.time}</div>
                  <div>
                    <p className="font-medium text-gray-900">{exam.patient}</p>
                    <p className="text-sm text-gray-500">{exam.type} • {exam.doctor}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    exam.status === 'completed' ? 'bg-green-100 text-green-700' :
                    exam.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {exam.status === 'completed' ? 'Terminé' :
                     exam.status === 'in-progress' ? 'En cours' :
                     'Programmé'}
                  </span>
                  {exam.status === 'scheduled' && (
                    <button
                      onClick={() => navigate(`/ophthalmology/refraction?patientId=${exam.patientId || exam.patient || exam.id}`)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Démarrer l'examen"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
            Alertes Critiques
          </h3>
          <div className="space-y-3">
            {stats.criticalAlerts.map((alert, idx) => {
              const IconComponent = alert.icon;
              return (
                <div key={idx} className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'high'
                    ? 'bg-red-50 border-red-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-start">
                    <IconComponent className={`w-4 h-4 mr-2 mt-0.5 ${
                      alert.severity === 'high' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                    <p className="text-sm text-gray-700">{alert.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Diagnoses Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Répartition des Diagnostics</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={stats.diagnoses}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="count"
                >
                  {stats.diagnoses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 ml-4">
              <div className="space-y-2">
                {stats.diagnoses.map(diagnosis => (
                  <div key={diagnosis.name} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: diagnosis.color }} />
                      <span className="text-sm text-gray-700">{diagnosis.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{diagnosis.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Revenus & Patients (6 mois)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="Revenus ($)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="patients"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                name="Patients"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-purple-600" />
            Rendez-vous de l'Après-midi
          </h3>
          <div className="space-y-2">
            {stats.upcomingAppointments.map((apt, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-600 w-12">{apt.time}</span>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{apt.patient}</p>
                    <p className="text-xs text-gray-500">{apt.type}</p>
                  </div>
                </div>
                <Glasses className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Equipment Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-indigo-600" />
            État des Équipements
          </h3>
          <div className="space-y-2">
            {stats.equipmentStatus.map((equipment, idx) => (
              <div key={idx} className="flex items-center justify-between p-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{equipment.name}</p>
                  <p className="text-xs text-gray-500">Dernier service: {equipment.lastService}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  equipment.status === 'operational'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {equipment.status === 'operational' ? 'Opérationnel' : 'Maintenance'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Selector Modal */}
      <PatientSelectorModal
        isOpen={showPatientSelector}
        onClose={() => setShowPatientSelector(false)}
        onSelectPatient={handleSelectPatient}
        title="Sélectionner un patient pour l'examen"
      />
    </div>
  );
}