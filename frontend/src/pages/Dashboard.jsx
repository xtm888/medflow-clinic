import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, DollarSign, FileText, TrendingUp, AlertCircle, Calendar, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { financialData, queueData } from '../data/mockData';
import dashboardService from '../services/dashboardService';
import { formatCurrency, safeFormatNumber, isArray } from '../utils/apiHelpers';

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

  useEffect(() => {
    fetchDashboardData();

    // Refresh stats every minute
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getStats();
      setStats(data);
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution du chiffre d'affaires</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={financialData.monthlyTrends}>
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
        </div>

        {/* Revenue by Service */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenus par service</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={financialData.revenueByService}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ service, percent }) => `${service} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="amount"
              >
                {financialData.revenueByService.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
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
            {isArray(queueData) && queueData.filter(q => q.status !== 'COMPLETED').map((patient) => (
              <div key={patient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    patient.priority === 'VIP' ? 'bg-purple-500' :
                    patient.priority === 'PREGNANT' ? 'bg-pink-500' :
                    patient.priority === 'URGENT' ? 'bg-red-500' :
                    'bg-green-500'
                  }`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{patient.patientName}</p>
                    <p className="text-sm text-gray-500">{patient.appointmentType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    patient.status === 'WAITING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {patient.status === 'WAITING' ? 'En attente' : 'En cours'}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    {typeof patient.estimatedWaitTime === 'number' ? patient.estimatedWaitTime : 0} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alertes et notifications</h3>
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </div>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-900">Stock critique</p>
                <p className="text-sm text-red-700">3 médicaments en rupture de stock</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-orange-900">Expiration proche</p>
                <p className="text-sm text-orange-700">2 lots expirent dans moins de 30 jours</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">Rendez-vous à confirmer</p>
                <p className="text-sm text-blue-700">8 RDV programmés pour demain</p>
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
