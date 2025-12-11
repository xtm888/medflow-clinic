import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scissors, Plus, Calendar, AlertTriangle, Clock, CheckCircle,
  Loader2, Users, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CollapsibleSectionGroup } from '../../components/CollapsibleSection';
import surgeryService from '../../services/surgeryService';

// Import sections
import SurgeryQueueSection from './sections/SurgeryQueueSection';
import SurgeryAgendaSection from './sections/SurgeryAgendaSection';
import SurgeryOverdueSection from './sections/SurgeryOverdueSection';

/**
 * SurgeryDashboard - Main surgery module dashboard
 *
 * Shows:
 * - Statistics cards
 * - Queue of patients awaiting scheduling
 * - Today's surgery agenda
 * - Overdue cases (waiting too long)
 */
export default function SurgeryDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const canCreateCase = user?.role === 'admin' || user?.role === 'receptionist';
  const isSurgeon = user?.role === 'admin' || user?.role === 'ophthalmologist';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await surgeryService.getDashboardStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching surgery stats:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement du module chirurgie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Scissors className="h-8 w-8 text-purple-600" />
            Module Chirurgie
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des cas chirurgicaux et agenda opératoire
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Statut:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-sm text-gray-900"
            >
              <option value="all">Tous les statuts</option>
              <option value="awaiting">En attente de programmation</option>
              <option value="scheduled">Programmée</option>
              <option value="checked_in">Check-in</option>
              <option value="in_surgery">En cours</option>
              <option value="completed">Terminée</option>
              <option value="overdue">En retard</option>
            </select>
          </div>
          {isSurgeon && (
            <button
              onClick={() => navigate('/surgery/surgeon-view')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <ClipboardList className="h-5 w-5" />
              <span>Vue Chirurgien</span>
            </button>
          )}
          {canCreateCase && (
            <button
              onClick={() => navigate('/surgery/new')}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              <span>Nouveau Cas</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Awaiting Scheduling */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">En attente</p>
                <p className="text-2xl font-bold text-gray-900">{stats.awaitingScheduling || 0}</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">À programmer</p>
          </div>

          {/* Scheduled Today */}
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aujourd'hui</p>
                <p className="text-2xl font-bold text-blue-600">{stats.scheduledToday || 0}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-blue-500 mt-2">Programmées</p>
          </div>

          {/* In Progress */}
          <div className="bg-purple-50 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En cours</p>
                <p className="text-2xl font-bold text-purple-600">{stats.inProgress || 0}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-purple-500 mt-2">Check-in / Bloc</p>
          </div>

          {/* Completed Today */}
          <div className="bg-green-50 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Terminées</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedToday || 0}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-green-500 mt-2">Aujourd'hui</p>
          </div>

          {/* Overdue */}
          <div className={`rounded-lg shadow p-4 ${stats.overdueCases > 0 ? 'bg-red-50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${stats.overdueCases > 0 ? 'text-gray-600' : 'text-gray-500'}`}>
                  En retard
                </p>
                <p className={`text-2xl font-bold ${stats.overdueCases > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {stats.overdueCases || 0}
                </p>
              </div>
              <div className={`rounded-full p-3 ${stats.overdueCases > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <AlertTriangle className={`h-6 w-6 ${stats.overdueCases > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
            </div>
            <p className={`text-xs mt-2 ${stats.overdueCases > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              +30 jours d'attente
            </p>
          </div>
        </div>
      )}

      {/* Collapsible Sections */}
      <CollapsibleSectionGroup>
        {/* Overdue Cases - show first if any */}
        {stats?.overdueCases > 0 && (
          <SurgeryOverdueSection
            count={stats.overdueCases}
            onRefresh={fetchData}
          />
        )}

        {/* Surgery Queue - Awaiting Scheduling */}
        <SurgeryQueueSection
          count={stats?.awaitingScheduling || 0}
          onRefresh={fetchData}
        />

        {/* Today's Agenda */}
        <SurgeryAgendaSection
          count={stats?.scheduledToday || 0}
          onRefresh={fetchData}
        />
      </CollapsibleSectionGroup>
    </div>
  );
}
