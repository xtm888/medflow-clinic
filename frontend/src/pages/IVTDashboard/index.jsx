import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, Plus, Calendar, AlertTriangle, Activity, Loader2
} from 'lucide-react';
import api from '../../services/apiConfig';
import { useAuth } from '../../contexts/AuthContext';
import { CollapsibleSectionGroup } from '../../components/CollapsibleSection';

// Import sections
import {
  IVTAllSection,
  IVTUpcomingSection,
  IVTDueSection
} from './sections';

/**
 * IVTDashboard - Consolidated single-page IVT management
 */
export default function IVTDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);

  const canCreateInjection = user?.role === 'admin' || user?.role === 'ophthalmologist' || user?.role === 'nurse';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [statsRes, upcomingRes, dueRes] = await Promise.all([
        api.get('/ivt/stats'),
        api.get('/ivt/upcoming', { params: { days: 30 } }),
        api.get('/ivt/due')
      ]);

      setStats(statsRes.data.data);
      setUpcomingCount(upcomingRes.data.data?.length || 0);
      setDueCount(dueRes.data.data?.length || 0);
    } catch (err) {
      console.error('Error fetching IVT data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement des IVT...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Stethoscope className="h-8 w-8 text-blue-600" />
            Injections Intravitréennes (IVT)
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des injections anti-VEGF et stéroïdes
          </p>
        </div>
        {canCreateInjection && (
          <button
            onClick={() => navigate('/ivt/new')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvelle IVT</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Injections</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalInjections || 0}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Stethoscope className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Taux Complications</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.complicationRate ? `${stats.complicationRate.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">À venir (30j)</p>
                <p className="text-2xl font-bold text-green-600">{upcomingCount}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-4 ${dueCount > 0 ? 'bg-red-50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${dueCount > 0 ? 'text-gray-600' : 'text-gray-500'}`}>
                  Patients en retard
                </p>
                <p className={`text-2xl font-bold ${dueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {dueCount}
                </p>
              </div>
              <div className={`rounded-full p-3 ${dueCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Activity className={`h-6 w-6 ${dueCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Sections */}
      <CollapsibleSectionGroup>
        {/* Patients overdue - show first if any */}
        <IVTDueSection
          dueCount={dueCount}
          onRefresh={fetchData}
        />

        {/* Upcoming injections */}
        <IVTUpcomingSection
          upcomingCount={upcomingCount}
          onRefresh={fetchData}
        />

        {/* All injections */}
        <IVTAllSection
          totalCount={stats?.totalInjections || 0}
        />
      </CollapsibleSectionGroup>
    </div>
  );
}
