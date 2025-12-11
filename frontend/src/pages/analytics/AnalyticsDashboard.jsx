import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Calendar,
  Eye, Activity, Clock, FileText, AlertTriangle, ChevronRight,
  BarChart3, PieChart, LineChart, Download, Filter, RefreshCcw
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import api from '../../services/apiConfig';

const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState('month');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    patients: { total: 0, new: 0, trend: 0, active: 0 },
    appointments: { total: 0, completed: 0, noShow: 0, cancelled: 0, trend: 0 },
    revenue: { total: 0, average: 0, outstanding: 0, collected: 0, trend: 0 },
    clinical: { exams: 0, surgeries: 0, procedures: 0, prescriptions: 0 }
  });
  const [charts, setCharts] = useState({
    revenue: [],
    appointments: [],
    diagnoses: [],
    procedures: [],
    patientFlow: []
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Determine period for API calls
      const periodMap = { week: '7days', month: '30days', quarter: '90days' };
      const period = periodMap[dateRange] || '30days';

      // Fetch real data from multiple endpoints in parallel
      const [
        dashboardStats,
        billingStats,
        queueStats,
        revenueTrends,
        appointmentStats,
        ophthalmologyStats
      ] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: {} })),
        api.get('/billing/statistics').catch(() => ({ data: {} })),
        api.get(`/queue/stats?dateRange=${dateRange === 'week' ? 'week' : dateRange === 'quarter' ? 'month' : 'month'}`).catch(() => ({ data: {} })),
        api.get(`/dashboard/revenue-trends?period=${period}`).catch(() => ({ data: [] })),
        api.get('/appointments/statistics').catch(() => ({ data: {} })),
        api.get('/ophthalmology/dashboard-stats').catch(() => ({ data: {} }))
      ]);

      // Extract data with safe defaults
      const dashboard = dashboardStats.data?.data || dashboardStats.data || {};
      const billing = billingStats.data?.data || billingStats.data || {};
      const queue = queueStats.data?.data || queueStats.data || {};
      const appointments = appointmentStats.data?.data || appointmentStats.data || {};
      const revenueData = revenueTrends.data?.data || revenueTrends.data || [];
      const ophthalmology = ophthalmologyStats.data?.data || ophthalmologyStats.data || {};

      // Revenue data - use thisMonth from billing statistics
      const monthRevenue = billing.thisMonth?.revenue || 0; // Paid amount
      const totalInvoiced = billing.thisMonth?.totalInvoiced || 0;
      // Outstanding = what's been invoiced minus what's been paid (ensure non-negative)
      const outstandingRevenue = Math.max(0, totalInvoiced - monthRevenue);

      // Appointments - use appointments.overview for accurate totals
      const apptTotal = appointments.overview?.total || 0;
      const apptCompleted = appointments.overview?.completed || 0;
      const apptNoShow = appointments.overview?.noShow || 0;
      const apptCancelled = appointments.overview?.cancelled || 0;

      // Today's patients from dashboard
      const todayPatients = dashboard.todayPatients || 0;
      const waitingNow = dashboard.waitingNow || 0;

      // Calculate revenue trend from monthlyTrends
      const trends = billing.monthlyTrends || [];
      let revenueTrend = 0;
      if (trends.length >= 2) {
        const current = trends[trends.length - 1]?.revenue || 0;
        const previous = trends[trends.length - 2]?.revenue || 1;
        revenueTrend = Math.round(((current - previous) / previous) * 100);
      }

      // Build metrics from real data
      setMetrics({
        patients: {
          total: todayPatients, // Today's patients
          new: dashboard.newPatients || 0,
          trend: 0, // No patient trend data available
          active: waitingNow
        },
        appointments: {
          total: apptTotal,
          completed: apptCompleted,
          noShow: apptNoShow,
          cancelled: apptCancelled,
          trend: 0
        },
        revenue: {
          total: totalInvoiced,
          average: apptTotal > 0 ? Math.round(monthRevenue / apptTotal) : 0,
          outstanding: outstandingRevenue,
          collected: monthRevenue,
          trend: revenueTrend
        },
        clinical: {
          exams: apptCompleted, // Completed consultations
          surgeries: 0,
          procedures: queue.inProgress || 0,
          prescriptions: dashboard.pendingPrescriptions || 0
        }
      });

      // Format revenue trends for chart - fill in all days in range
      const days = dateRange === 'week' ? 7 : dateRange === 'quarter' ? 90 : 30;
      const revenueMap = new Map();

      // Create a map of existing data
      if (Array.isArray(revenueData)) {
        revenueData.forEach(item => {
          const dateKey = item._id || item.date;
          revenueMap.set(dateKey, item.revenue || item.total || 0);
        });
      }

      // Generate all days in range
      const formattedRevenue = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        const revenue = revenueMap.get(dateKey) || 0;
        formattedRevenue.push({
          date: date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
          revenue: revenue,
          profit: Math.round(revenue * 0.3) // Estimated 30% profit margin
        });
      }

      // Generate appointment chart data from appointments.byDepartment
      const deptData = appointments.byDepartment || [];
      const completionRate = apptTotal > 0 ? apptCompleted / apptTotal : 0.9;
      const noShowRate = apptTotal > 0 ? apptNoShow / apptTotal : 0.05;

      const appointmentData = deptData.length > 0
        ? deptData.map(d => {
            const count = d.count || 0;
            return {
              department: d._id || 'Autre',
              total: count,
              completed: Math.round(count * completionRate),
              noShow: Math.round(count * noShowRate)
            };
          })
        : (queue.byDepartment && Object.keys(queue.byDepartment).length > 0
          ? Object.entries(queue.byDepartment).map(([dept, data]) => ({
              department: dept,
              total: data.total || 0,
              completed: data.completed || 0,
              noShow: data.noShow || 0
            }))
          : generateAppointmentData());

      // Generate patient flow from peak hours - fill all working hours (8-18)
      const peakHoursMap = new Map();
      if (queue.peakHours && queue.peakHours.length > 0) {
        queue.peakHours.forEach(h => {
          const hour = h.hour || h._id;
          peakHoursMap.set(hour, h.count || 0);
        });
      }

      // Generate all working hours (8AM to 6PM)
      const patientFlowData = [];
      for (let hour = 8; hour <= 18; hour++) {
        patientFlowData.push({
          hour: `${hour}:00`,
          patients: peakHoursMap.get(hour) || 0,
          waitTime: peakHoursMap.has(hour) ? Math.min(queue.averageWaitTime || 15, 60) : 0
        });
      }

      // Get diagnoses from ophthalmology endpoint or fallback to mock
      const diagnosesData = ophthalmology.diagnoses && ophthalmology.diagnoses.length > 0
        ? ophthalmology.diagnoses.map(d => ({
            name: d.name || 'Autre',
            value: d.count || 0,
            color: d.color || '#6b7280'
          }))
        : generateDiagnosesData();

      // Get procedures from billing revenueByService or fallback to mock
      const proceduresData = billing.revenueByService && billing.revenueByService.length > 0
        ? billing.revenueByService.map(s => ({
            procedure: s.service || 'Autre',
            count: s.count || 0,
            revenue: s.amount || 0
          }))
        : generateProcedureData();

      setCharts({
        revenue: formattedRevenue,
        appointments: appointmentData,
        diagnoses: diagnosesData,
        procedures: proceduresData,
        patientFlow: patientFlowData
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Fallback to mock data on error
      setCharts({
        revenue: generateRevenueData(),
        appointments: generateAppointmentData(),
        diagnoses: generateDiagnosesData(),
        procedures: generateProcedureData(),
        patientFlow: generatePatientFlowData()
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRevenueData = () => {
    const data = [];
    const days = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90;
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        revenue: Math.floor(Math.random() * 5000) + 2000,
        expenses: Math.floor(Math.random() * 3000) + 1000,
        profit: 0
      });
      data[data.length - 1].profit = data[data.length - 1].revenue - data[data.length - 1].expenses;
    }
    return data;
  };

  const generateAppointmentData = () => {
    const departments = ['Ophtalmologie', 'Général', 'Orthoptie'];
    return departments.map(dept => ({
      department: dept,
      total: Math.floor(Math.random() * 30) + 10,
      completed: Math.floor(Math.random() * 25) + 8,
      noShow: Math.floor(Math.random() * 3) + 1
    }));
  };

  const generateDiagnosesData = () => {
    return [
      { name: 'Myopia', value: 324, color: '#3B82F6' },
      { name: 'Presbyopia', value: 218, color: '#10B981' },
      { name: 'Cataracts', value: 186, color: '#F59E0B' },
      { name: 'Glaucoma', value: 142, color: '#EF4444' },
      { name: 'Dry Eye', value: 198, color: '#8B5CF6' },
      { name: 'Diabetic Retinopathy', value: 87, color: '#EC4899' }
    ];
  };

  const generateProcedureData = () => {
    return [
      { procedure: 'Comprehensive Exam', count: 486, revenue: 48600 },
      { procedure: 'Visual Field Test', count: 142, revenue: 14200 },
      { procedure: 'OCT Scan', count: 198, revenue: 29700 },
      { procedure: 'Refraction', count: 324, revenue: 16200 },
      { procedure: 'Tonometry', count: 267, revenue: 8010 },
      { procedure: 'Fundus Photography', count: 89, revenue: 8900 }
    ];
  };

  const generatePatientFlowData = () => {
    const hours = ['8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM'];
    return hours.map(hour => ({
      hour,
      patients: Math.floor(Math.random() * 15) + 5,
      waitTime: Math.floor(Math.random() * 20) + 10
    }));
  };

  const MetricCard = ({ title, value, subValue, trend, icon: Icon, color }) => (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-2 text-gray-900">{value}</p>
          {subValue && (
            <p className="text-sm text-gray-500 mt-1">{subValue}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center mt-4">
          {trend > 0 ? (
            <TrendingUp size={16} className="text-green-500 mr-1" />
          ) : (
            <TrendingDown size={16} className="text-red-500 mr-1" />
          )}
          <span className={`text-sm font-medium ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {Math.abs(trend)}%
          </span>
          <span className="text-sm text-gray-500 ml-1">vs période précédente</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Analytics</h1>
              <p className="text-base text-gray-600 mt-2">Vue d'ensemble des performances</p>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">7 derniers jours</option>
                <option value="month">30 derniers jours</option>
                <option value="quarter">90 derniers jours</option>
              </select>
              <button
                onClick={fetchAnalytics}
                className="p-2 hover:bg-gray-100 rounded-lg"
                disabled={loading}
              >
                <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Download size={16} />
              Exporter
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard
            title="Patients aujourd'hui"
            value={(metrics.patients.total || 0).toLocaleString()}
            subValue={`${metrics.patients.active || 0} en attente`}
            trend={undefined}
            icon={Users}
            color="bg-blue-500"
          />
          <MetricCard
            title="Rendez-vous"
            value={metrics.appointments.total}
            subValue={`${metrics.appointments.completed} terminés`}
            trend={metrics.appointments.trend}
            icon={Calendar}
            color="bg-green-500"
          />
          <MetricCard
            title="Revenus"
            value={`${(metrics.revenue.total || 0).toLocaleString()} FCFA`}
            subValue={`Moy: ${metrics.revenue.average} FCFA`}
            trend={metrics.revenue.trend}
            icon={DollarSign}
            color="bg-purple-500"
          />
          <MetricCard
            title="Activité clinique"
            value={metrics.clinical.exams}
            subValue={`${metrics.clinical.procedures} actes`}
            icon={Activity}
            color="bg-orange-500"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Évolution des revenus</h3>
              <LineChart size={20} className="text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={charts.revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3B82F6" fill="#93BBFC" name="Revenus" />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="#10B981" fill="#86EFAC" name="Bénéfice" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Appointments Chart */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Rendez-vous par département</h3>
              <BarChart3 size={20} className="text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.appointments}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#3B82F6" name="Total" />
                <Bar dataKey="completed" fill="#10B981" name="Terminés" />
                <Bar dataKey="noShow" fill="#EF4444" name="Absents" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Diagnoses Distribution */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Principaux diagnostics</h3>
              <PieChart size={20} className="text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={charts.diagnoses}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {charts.diagnoses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          {/* Patient Flow */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Flux patients aujourd'hui</h3>
              <Clock size={20} className="text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsLineChart data={charts.patientFlow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="patients"
                  stroke="#3B82F6"
                  name="Patients"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="waitTime"
                  stroke="#EF4444"
                  name="Temps d'attente (min)"
                  strokeWidth={2}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Procedures Table */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Principaux actes</h3>
            <FileText size={20} className="text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Acte</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Nombre</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Revenus</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Moy. Revenus</th>
                </tr>
              </thead>
              <tbody>
                {charts.procedures.map((proc, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{proc.procedure || '-'}</td>
                    <td className="text-center py-3 px-4">{proc.count || 0}</td>
                    <td className="text-right py-3 px-4">{(proc.revenue || 0).toLocaleString()} FCFA</td>
                    <td className="text-right py-3 px-4">
                      {proc.count > 0 ? Math.round((proc.revenue || 0) / proc.count) : 0} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h4 className="font-medium text-gray-700 mb-4">Taux de recouvrement</h4>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-green-600">
                  {metrics.revenue.total > 0
                    ? ((metrics.revenue.collected / metrics.revenue.total) * 100).toFixed(1)
                    : 0}%
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {(metrics.revenue.collected || 0).toLocaleString()} FCFA encaissés
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Impayés</p>
                <p className="text-lg font-semibold text-orange-600">
                  {(metrics.revenue.outstanding || 0).toLocaleString()} FCFA
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h4 className="font-medium text-gray-700 mb-4">Efficacité des rendez-vous</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taux de complétion</span>
                <span className="font-semibold">
                  {metrics.appointments.total > 0
                    ? ((metrics.appointments.completed / metrics.appointments.total) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taux d'absence</span>
                <span className="font-semibold text-red-600">
                  {metrics.appointments.total > 0
                    ? ((metrics.appointments.noShow / metrics.appointments.total) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Annulations</span>
                <span className="font-semibold text-orange-600">
                  {metrics.appointments.cancelled}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h4 className="font-medium text-gray-700 mb-4">Activité clinique</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Examens complétés</span>
                <span className="font-semibold text-green-600">{metrics.clinical.exams}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">En cours</span>
                <span className="font-semibold text-blue-600">{metrics.clinical.procedures}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Ordonnances en attente</span>
                <span className="font-semibold text-orange-600">{metrics.clinical.prescriptions}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;