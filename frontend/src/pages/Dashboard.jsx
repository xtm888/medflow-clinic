import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, DollarSign, FileText, TrendingUp, AlertCircle, Calendar, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import dashboardService from '../services/dashboardService';
import billingService from '../services/billingService';
import queueService from '../services/queueService';
import patientService from '../services/patientService';
import pharmacyInventoryService from '../services/pharmacyInventoryService';
import api from '../services/apiConfig';
import { formatCurrency, safeFormatNumber, isArray } from '../utils/apiHelpers';
import TodayTasksWidget from '../components/dashboard/TodayTasksWidget';
import RecentPatientsWidget from '../components/dashboard/RecentPatientsWidget';
import PendingActionsWidget from '../components/dashboard/PendingActionsWidget';
import PermissionGate from '../components/PermissionGate';

// Cache configuration
const CACHE_KEY = 'medflow_dashboard_cache';
const CACHE_TTL = 60000; // 1 minute cache TTL

// In-memory cache for session
const dashboardCache = {
  data: null,
  timestamp: 0
};

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = 'blue' }) => {
  const colorVariants = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
  };

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className={`h-4 w-4 ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`} />
              <span className={`ml-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {trendValue}
              </span>
              <span className="ml-1 text-gray-500">vs mois dernier</span>
            </div>
          )}
        </div>
        <div className={`${colorVariants[color]} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];

export default function Dashboard() {
  // Get user from auth context
  const { user } = useAuth();
  const { can } = usePermissions();

  const [stats, setStats] = useState({
    todayPatients: 0,
    waitingNow: 0,
    revenue: 0,
    pendingPrescriptions: 0
  });
  const [loading, setLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(false); // For priority loading indicator
  const [error, setError] = useState(null);
  const [queueData, setQueueData] = useState([]);

  // Chart data from API
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [revenueByService, setRevenueByService] = useState([]);

  // Get user role from localStorage
  const [userRole, setUserRole] = useState('doctor');

  // Widget data from API
  const [todayTasks, setTodayTasks] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);

  // Alerts data
  const [alertsData, setAlertsData] = useState({
    lowStockCount: 0,
    expiringCount: 0,
    tomorrowAppointments: 0
  });

  // Track which data sources failed (partial failure handling)
  const [failedSources, setFailedSources] = useState([]);

  // AbortController for canceling in-flight requests on unmount
  const abortControllerRef = useRef(null);

  // Check if cache is valid
  const isCacheValid = useCallback(() => {
    return dashboardCache.data && (Date.now() - dashboardCache.timestamp) < CACHE_TTL;
  }, []);

  // Apply cached data to state
  const applyCachedData = useCallback((cache) => {
    if (!cache) return;
    setStats(cache.stats || { todayPatients: 0, waitingNow: 0, revenue: 0, pendingPrescriptions: 0 });
    setQueueData(cache.queueData || []);
    setTodayTasks(cache.todayTasks || []);
    setRecentPatients(cache.recentPatients || []);
    setPendingActions(cache.pendingActions || []);
    setMonthlyTrends(cache.monthlyTrends || []);
    setRevenueByService(cache.revenueByService || []);
    setAlertsData(cache.alertsData || { lowStockCount: 0, expiringCount: 0, tomorrowAppointments: 0 });
  }, []);

  // Save data to cache
  const saveToCache = useCallback((data) => {
    dashboardCache.data = data;
    dashboardCache.timestamp = Date.now();
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Set user role from auth context
    if (user?.role) {
      setUserRole(user.role);
    }

    // Refresh stats every minute
    const interval = setInterval(fetchDashboardData, 60000);
    return () => {
      clearInterval(interval);
      // Cancel any in-flight requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user]);

  const fetchDashboardData = async (forceRefresh = false) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh && isCacheValid()) {
      applyCachedData(dashboardCache.data);
      setLoading(false);
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const errors = [];
      const defaultStats = { todayPatients: 0, waitingNow: 0, revenue: 0, pendingPrescriptions: 0 };

      // PRIORITY TIER 1: Critical data (stats + queue) - load first
      setLoading(true);
      const [statsData, queueResponse] = await Promise.all([
        dashboardService.getStats().catch(err => {
          console.error('Stats fetch error:', err);
          errors.push('Statistiques');
          return defaultStats;
        }),
        queueService.getCurrentQueue().catch(err => {
          console.error('Queue fetch error:', err);
          errors.push('File d\'attente');
          return { data: {} };
        })
      ]);

      // Apply tier 1 data immediately
      setStats(statsData || defaultStats);

      // Process queue data
      let processedQueueData = [];
      const queueDepartments = queueResponse?.data?.data || queueResponse?.data || {};
      if (queueDepartments && typeof queueDepartments === 'object') {
        const allQueues = [];
        Object.keys(queueDepartments).forEach(dept => {
          if (Array.isArray(queueDepartments[dept])) {
            queueDepartments[dept].forEach(item => {
              allQueues.push({
                id: item.appointmentId,
                patientName: item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : 'Inconnu',
                appointmentType: dept,
                status: item.status,
                priority: item.priority || 'normal',
                waitTime: item.actualWaitTime || item.estimatedWaitTime || 0
              });
            });
          }
        });
        processedQueueData = allQueues;
        setQueueData(allQueues);
      }

      // Remove primary loading indicator - critical data is now visible
      setLoading(false);
      setSecondaryLoading(true);

      // PRIORITY TIER 2: Secondary data - load in background
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const defaultRevenue = { monthlyTrends: [], revenueByService: [] };

      // Only fetch data user has permission to access
      const promises = [
        dashboardService.getTodayTasks().catch(err => {
          if (err.response?.status !== 403) errors.push('Tâches');
          return [];
        }),
        dashboardService.getRecentPatients().catch(err => {
          if (err.response?.status !== 403) errors.push('Patients récents');
          return [];
        }),
        dashboardService.getPendingActions().catch(err => {
          if (err.response?.status !== 403) errors.push('Actions en attente');
          return [];
        }),
        // Only fetch revenue if user has permission
        can('view_financial_reports') || can('manage_financial')
          ? billingService.getBillingStatistics().catch(err => {
              if (err.response?.status !== 403) errors.push('Revenus');
              return defaultRevenue;
            })
          : Promise.resolve(defaultRevenue),
        // Only fetch pharmacy data if user has permission
        can('manage_inventory') || can('manage_pharmacy')
          ? pharmacyInventoryService.getLowStock().catch(err => {
              if (err.response?.status !== 403) errors.push('Stock bas');
              return { data: [] };
            })
          : Promise.resolve({ data: [] }),
        can('manage_inventory') || can('manage_pharmacy')
          ? pharmacyInventoryService.getExpiring(30).catch(err => {
              if (err.response?.status !== 403) errors.push('Produits expirants');
              return { data: [] };
            })
          : Promise.resolve({ data: [] }),
        api.get('/appointments', { params: { date: tomorrowStr } }).catch(err => {
          if (err.response?.status !== 403) errors.push('RDV demain');
          return { data: [] };
        })
      ];

      const [tasksData, patientsData, actionsData, revenueData, lowStockData, expiringData, tomorrowAppts] = await Promise.all(promises);

      // Apply tier 2 data
      setTodayTasks(tasksData);
      setRecentPatients(patientsData);
      setPendingActions(actionsData);

      // Process alerts
      const lowStockItems = lowStockData?.data || lowStockData || [];
      const expiringItems = expiringData?.data || expiringData || [];
      const tomorrowAppointmentsList = tomorrowAppts?.data?.data || tomorrowAppts?.data || [];
      const alertsResult = {
        lowStockCount: Array.isArray(lowStockItems) ? lowStockItems.length : 0,
        expiringCount: Array.isArray(expiringItems) ? expiringItems.length : 0,
        tomorrowAppointments: Array.isArray(tomorrowAppointmentsList) ? tomorrowAppointmentsList.length : 0
      };
      setAlertsData(alertsResult);

      // Process chart data
      const monthlyTrendsResult = revenueData?.monthlyTrends || revenueData?.data?.monthlyTrends || [];
      const revenueByServiceResult = revenueData?.revenueByService || revenueData?.data?.revenueByService || [];
      setMonthlyTrends(monthlyTrendsResult);
      setRevenueByService(revenueByServiceResult);

      // Track failed sources
      setFailedSources(errors);

      // Save all data to cache
      saveToCache({
        stats: statsData || defaultStats,
        queueData: processedQueueData,
        todayTasks: tasksData,
        recentPatients: patientsData,
        pendingActions: actionsData,
        monthlyTrends: monthlyTrendsResult,
        revenueByService: revenueByServiceResult,
        alertsData: alertsResult
      });

      setError(null);
    } catch (err) {
      setError('Échec du chargement des données');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
      setSecondaryLoading(false);
    }
  };

  // Memoize filtered queue to avoid filtering on every render
  const activeQueueItems = useMemo(() =>
    isArray(queueData) ? queueData.filter(q => q.status !== 'completed') : [],
    [queueData]
  );

  if (loading && stats.todayPatients === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vue d'ensemble de votre activité médicale
          </p>
        </div>
        <div className="flex items-center gap-2">
          {secondaryLoading && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
              Chargement...
            </span>
          )}
          <button
            onClick={() => fetchDashboardData(true)}
            className="btn btn-secondary text-sm"
            disabled={loading || secondaryLoading}
          >
            {loading ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Partial failure warning */}
      {failedSources.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Certaines données n'ont pas pu être chargées</p>
            <p className="text-xs text-amber-600 mt-1">
              Sources indisponibles : {failedSources.join(', ')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Patients aujourd'hui"
          value={stats.todayPatients}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="File d'attente"
          value={stats.waitingNow}
          icon={Clock}
          color="orange"
        />
        <PermissionGate permission="view_financial_reports">
          <StatCard
            title="Revenus du jour"
            value={formatCurrency(stats.revenue, '$')}
            icon={DollarSign}
            color="green"
          />
        </PermissionGate>
        <StatCard
          title="Prescriptions en attente"
          value={stats.pendingPrescriptions}
          icon={FileText}
          color="purple"
        />
      </div>

      {/* Priority Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TodayTasksWidget userRole={userRole} tasks={todayTasks} />
        <RecentPatientsWidget userRole={userRole} patients={recentPatients} />
        <PendingActionsWidget userRole={userRole} actions={pendingActions} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <PermissionGate permission="view_financial_reports">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution du chiffre d'affaires</h3>
            {monthlyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    name="Revenus ($)"
                    dot={{ fill: '#0ea5e9', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Aucune donnée de revenus disponible
              </div>
            )}
          </div>
        </PermissionGate>

        {/* Revenue by Service */}
        <PermissionGate permission="view_financial_reports">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenus par service</h3>
          {revenueByService.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByService}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ service, percent }) => `${service} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {revenueByService.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Aucune donnée par service disponible
            </div>
          )}
          </div>
        </PermissionGate>
      </div>

      {/* Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Queue */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">File d'attente actuelle</h3>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {activeQueueItems.length > 0 ? (
              activeQueueItems.map((patient) => (
                <div key={patient._id || patient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      patient.priority === 'vip' ? 'bg-purple-500' :
                      patient.priority === 'pregnant' ? 'bg-pink-500' :
                      patient.priority === 'urgent' ? 'bg-red-500' :
                      'bg-green-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{patient.patientName}</p>
                      <p className="text-sm text-gray-500">{patient.appointmentType}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      patient.status === 'checked-in' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {patient.status === 'checked-in' ? 'En attente' : 'En cours'}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      {typeof patient.waitTime === 'number' ? patient.waitTime : 0} min
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>Aucun patient en attente</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alertes et notifications</h3>
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </div>
          <div className="space-y-3">
            <PermissionGate permission="manage_inventory">
              {alertsData.lowStockCount > 0 ? (
                <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Stock critique</p>
                    <p className="text-sm text-red-700">
                      {alertsData.lowStockCount} médicament{alertsData.lowStockCount > 1 ? 's' : ''} en rupture de stock
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Activity className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Stock OK</p>
                    <p className="text-sm text-green-700">Tous les médicaments sont en stock</p>
                  </div>
                </div>
              )}
            </PermissionGate>
            <PermissionGate permission="manage_inventory">
              {alertsData.expiringCount > 0 ? (
                <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-900">Expiration proche</p>
                    <p className="text-sm text-orange-700">
                      {alertsData.expiringCount} lot{alertsData.expiringCount > 1 ? 's' : ''} expire{alertsData.expiringCount > 1 ? 'nt' : ''} dans moins de 30 jours
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Activity className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Expirations OK</p>
                    <p className="text-sm text-green-700">Aucun lot n'expire prochainement</p>
                  </div>
                </div>
              )}
            </PermissionGate>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">Rendez-vous demain</p>
                <p className="text-sm text-blue-700">
                  {alertsData.tomorrowAppointments} RDV programmé{alertsData.tomorrowAppointments !== 1 ? 's' : ''} pour demain
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Activity className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-900">Système opérationnel</p>
                <p className="text-sm text-green-700">Toutes les connexions fonctionnent</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/patients" className="flex flex-col items-center justify-center p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
            <Users className="h-8 w-8 text-primary-600 mb-2" />
            <span className="text-sm font-medium text-primary-900">Nouveau patient</span>
          </Link>
          <Link to="/appointments" className="flex flex-col items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
            <Calendar className="h-8 w-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-900">Prendre RDV</span>
          </Link>
          <Link to="/prescriptions" className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
            <FileText className="h-8 w-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-purple-900">Prescription</span>
          </Link>
          <Link to="/invoicing" className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
            <DollarSign className="h-8 w-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-orange-900">Facturation</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
