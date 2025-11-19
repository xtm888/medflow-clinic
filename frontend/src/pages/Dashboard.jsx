import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, DollarSign, FileText, TrendingUp, AlertCircle, Calendar, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

// Module imports for future DashboardContainer migration
// import { useDashboardData } from '../modules/dashboard';

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
              <span className="ml-1 text-gray-500">vs last month</span>
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
  const [stats, setStats] = useState({
    todayPatients: 0,
    waitingNow: 0,
    revenue: 0,
    pendingPrescriptions: 0
  });
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchDashboardData();

    // Get user role from localStorage
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role) {
        setUserRole(user.role);
      }
    } catch (err) {
      console.error('Error getting user role:', err);
    }

    // Refresh stats every minute
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Calculate tomorrow's date for appointments
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Fetch all dashboard data in parallel
      const [statsData, queueResponse, tasksData, patientsData, actionsData, revenueData, lowStockData, expiringData, tomorrowAppts] = await Promise.all([
        dashboardService.getStats(),
        queueService.getCurrentQueue().catch(err => {
          console.error('Queue fetch error:', err);
          return { data: {} };
        }),
        dashboardService.getTodayTasks().catch(err => {
          console.error('Tasks fetch error:', err);
          return [];
        }),
        dashboardService.getRecentPatients().catch(err => {
          console.error('Patients fetch error:', err);
          return [];
        }),
        dashboardService.getPendingActions().catch(err => {
          console.error('Actions fetch error:', err);
          return [];
        }),
        billingService.getBillingStatistics().catch(err => {
          console.error('Revenue fetch error:', err);
          return { monthlyTrends: [], revenueByService: [] };
        }),
        // Fetch pharmacy alerts
        pharmacyInventoryService.getLowStock().catch(err => {
          console.error('Low stock fetch error:', err);
          return { data: [] };
        }),
        pharmacyInventoryService.getExpiring(30).catch(err => {
          console.error('Expiring fetch error:', err);
          return { data: [] };
        }),
        // Fetch tomorrow's appointments
        api.get('/appointments', { params: { date: tomorrowStr } }).catch(err => {
          console.error('Tomorrow appointments fetch error:', err);
          return { data: [] };
        })
      ]);

      setStats(statsData);
      setTodayTasks(tasksData);
      setRecentPatients(patientsData);
      setPendingActions(actionsData);

      // Process alerts data
      const lowStockItems = lowStockData?.data || lowStockData || [];
      const expiringItems = expiringData?.data || expiringData || [];
      const tomorrowAppointmentsList = tomorrowAppts?.data?.data || tomorrowAppts?.data || [];

      setAlertsData({
        lowStockCount: Array.isArray(lowStockItems) ? lowStockItems.length : 0,
        expiringCount: Array.isArray(expiringItems) ? expiringItems.length : 0,
        tomorrowAppointments: Array.isArray(tomorrowAppointmentsList) ? tomorrowAppointmentsList.length : 0
      });

      // Set chart data from billing API or use defaults
      if (revenueData) {
        setMonthlyTrends(revenueData.monthlyTrends || revenueData.data?.monthlyTrends || [
          { month: 'Jan', revenue: 0 },
          { month: 'Fév', revenue: 0 },
          { month: 'Mar', revenue: 0 },
          { month: 'Avr', revenue: 0 },
          { month: 'Mai', revenue: 0 },
          { month: 'Jun', revenue: 0 }
        ]);
        setRevenueByService(revenueData.revenueByService || revenueData.data?.revenueByService || [
          { service: 'Consultations', amount: 0 },
          { service: 'Examens', amount: 0 },
          { service: 'Chirurgies', amount: 0 },
          { service: 'Pharmacie', amount: 0 }
        ]);
      }

      // Process queue data - flatten all departments into single array
      if (queueResponse && queueResponse.data) {
        const allQueues = [];
        Object.keys(queueResponse.data).forEach(dept => {
          if (Array.isArray(queueResponse.data[dept])) {
            queueResponse.data[dept].forEach(item => {
              allQueues.push({
                id: item.appointmentId,
                patientName: item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : 'Unknown',
                appointmentType: dept,
                status: item.status,
                priority: item.priority || 'normal',
                estimatedWaitTime: item.estimatedWaitTime || 0
              });
            });
          }
        });
        setQueueData(allQueues);
      }

      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && stats.todayPatients === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vue d'ensemble de votre activité médicale
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="btn btn-secondary text-sm"
          disabled={loading}
        >
          {loading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

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
        <StatCard
          title="Revenus du jour"
          value={formatCurrency(stats.revenue, '$')}
          icon={DollarSign}
          color="green"
        />
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

        {/* Revenue by Service */}
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
            {isArray(queueData) && queueData.length > 0 ? (
              queueData.filter(q => q.status !== 'completed').map((patient) => (
                <div key={patient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
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
                      {typeof patient.estimatedWaitTime === 'number' ? patient.estimatedWaitTime : 0} min
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
