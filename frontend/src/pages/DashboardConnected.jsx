import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, DollarSign, FileText, TrendingUp, AlertCircle, Calendar, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth, useAppointments, usePatients, useVisits } from '../hooks/useRedux';
import { useQueueUpdates, useWebSocket } from '../hooks/useWebSocket';
import { patientService, appointmentService, billingService, visitService } from '../services';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = 'blue', loading = false }) => {
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
          {loading ? (
            <div className="mt-2 h-9 bg-gray-200 rounded animate-pulse w-24" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          )}
          {trend && !loading && (
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

export default function DashboardConnected() {
  const { user } = useAuth();
  const { fetchTodaysAppointments, todaysAppointments, fetchQueueStatus, queueStatus } = useAppointments();
  const { fetchRecentPatients, recentPatients } = usePatients();
  const { fetchTodaysVisits, todaysVisits } = useVisits();
  const { connected } = useWebSocket();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayPatients: 0,
    waitingNow: 0,
    revenue: 0,
    pendingPrescriptions: 0,
  });
  const [financialData, setFinancialData] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  // Real-time queue updates
  useQueueUpdates((data) => {
    if (data.queueLength !== undefined) {
      setStats(prev => ({ ...prev, waitingNow: data.queueLength }));
    }
  });

  // Fetch dashboard data on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch all data in parallel
        const [
          appointmentsRes,
          visitsRes,
          patientsRes,
          billingRes,
          prescriptionsRes,
        ] = await Promise.all([
          appointmentService.getTodaysAppointments(),
          visitService.getTodaysVisits(),
          patientService.getRecentPatients(50),
          billingService.getBillingStatistics({ period: 'today' }),
          prescriptionService.getPrescriptions({ status: 'pending', limit: 100 }),
        ]);

        // Calculate statistics
        const todayPatientsCount = new Set([
          ...appointmentsRes.map(a => a.patientId),
          ...visitsRes.map(v => v.patientId)
        ]).size;

        const waitingCount = appointmentsRes.filter(a =>
          a.status === 'waiting' || a.status === 'checked-in'
        ).length;

        setStats({
          todayPatients: todayPatientsCount,
          waitingNow: waitingCount,
          revenue: billingRes.todayRevenue || 0,
          pendingPrescriptions: prescriptionsRes.length || 0,
        });

        // Fetch financial trends
        const finData = await billingService.getRevenueReport(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString()
        );

        if (finData.dailyRevenue) {
          setFinancialData(finData.dailyRevenue.map(item => ({
            date: new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            revenue: item.revenue,
            patients: item.patientCount,
          })));
        }

        // Calculate department statistics
        const deptStats = appointmentsRes.reduce((acc, appointment) => {
          const dept = appointment.department || 'General';
          if (!acc[dept]) {
            acc[dept] = { name: dept, value: 0 };
          }
          acc[dept].value++;
          return acc;
        }, {});

        setDepartmentStats(Object.values(deptStats));

        // Get recent activities
        const activities = [
          ...appointmentsRes.slice(0, 5).map(a => ({
            type: 'appointment',
            message: `${a.patientName} - ${a.appointmentType}`,
            time: new Date(a.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            icon: Calendar,
          })),
          ...visitsRes.slice(0, 5).map(v => ({
            type: 'visit',
            message: `Visit ${v.visitId} - ${v.status}`,
            time: new Date(v.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            icon: Activity,
          })),
        ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);

        setRecentActivities(activities);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Refresh data every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header with WebSocket status */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user?.firstName || 'User'} | {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Patients"
          value={stats.todayPatients}
          icon={Users}
          trend="up"
          trendValue="+12%"
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Waiting Queue"
          value={stats.waitingNow}
          icon={Clock}
          color="orange"
          loading={loading}
        />
        <StatCard
          title="Today's Revenue"
          value={`$${stats.revenue.toFixed(2)}`}
          icon={DollarSign}
          trend="up"
          trendValue="+8%"
          color="green"
          loading={loading}
        />
        <StatCard
          title="Pending Prescriptions"
          value={stats.pendingPrescriptions}
          icon={FileText}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          {loading ? (
            <div className="h-[300px] bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="patients"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Patients"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Department Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
          {loading ? (
            <div className="h-[300px] bg-gray-100 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={departmentStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {departmentStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            <Link to="/notifications" className="text-sm text-blue-600 hover:text-blue-500">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-center space-x-3 py-2">
                    <div className="flex-shrink-0">
                      <Icon className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{activity.message}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
              {recentActivities.length === 0 && (
                <p className="text-gray-500 text-center py-4">No recent activities</p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              to="/patients"
              className="w-full btn-primary flex items-center justify-center"
            >
              <Users className="h-4 w-4 mr-2" />
              New Patient
            </Link>
            <Link
              to="/appointments"
              className="w-full btn-secondary flex items-center justify-center"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Appointment
            </Link>
            <Link
              to="/prescriptions"
              className="w-full btn-secondary flex items-center justify-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              Write Prescription
            </Link>
            <Link
              to="/queue"
              className="w-full btn-secondary flex items-center justify-center"
            >
              <Clock className="h-4 w-4 mr-2" />
              Manage Queue
            </Link>
          </div>
        </div>
      </div>

      {/* Alert Section */}
      {stats.waitingNow > 10 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-orange-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800">High Patient Volume</h3>
              <p className="mt-1 text-sm text-orange-700">
                There are {stats.waitingNow} patients in the waiting queue. Consider opening additional consultation rooms.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}