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
    patients: { total: 0, new: 0, trend: 0 },
    appointments: { total: 0, completed: 0, noShow: 0, trend: 0 },
    revenue: { total: 0, average: 0, outstanding: 0, trend: 0 },
    clinical: { exams: 0, surgeries: 0, procedures: 0 }
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
      // This would fetch real analytics data from the backend
      // For now, using mock data
      setMetrics({
        patients: {
          total: 2847,
          new: 127,
          trend: 8.5,
          active: 2145
        },
        appointments: {
          total: 486,
          completed: 412,
          noShow: 23,
          cancelled: 51,
          trend: -2.3
        },
        revenue: {
          total: 127350,
          average: 285,
          outstanding: 18940,
          collected: 108410,
          trend: 12.7
        },
        clinical: {
          exams: 1284,
          surgeries: 42,
          procedures: 186,
          prescriptions: 623
        }
      });

      // Mock chart data
      const revenueData = generateRevenueData();
      const appointmentData = generateAppointmentData();
      const diagnosesData = generateDiagnosesData();
      const procedureData = generateProcedureData();
      const patientFlowData = generatePatientFlowData();

      setCharts({
        revenue: revenueData,
        appointments: appointmentData,
        diagnoses: diagnosesData,
        procedures: procedureData,
        patientFlow: patientFlowData
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
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
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.floor(Math.random() * 5000) + 2000,
        expenses: Math.floor(Math.random() * 3000) + 1000,
        profit: 0
      });
      data[data.length - 1].profit = data[data.length - 1].revenue - data[data.length - 1].expenses;
    }
    return data;
  };

  const generateAppointmentData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => ({
      day,
      scheduled: Math.floor(Math.random() * 30) + 20,
      completed: Math.floor(Math.random() * 25) + 15,
      noShow: Math.floor(Math.random() * 5) + 1,
      cancelled: Math.floor(Math.random() * 3) + 1
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
          <span className="text-sm text-gray-500 ml-1">vs last period</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Track your practice performance and insights</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="quarter">Last 90 days</option>
              </select>
              <button
                onClick={fetchAnalytics}
                className="p-2 hover:bg-gray-100 rounded-lg"
                disabled={loading}
              >
                <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Download size={16} />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard
            title="Total Patients"
            value={metrics.patients.total.toLocaleString()}
            subValue={`${metrics.patients.new} new this period`}
            trend={metrics.patients.trend}
            icon={Users}
            color="bg-blue-500"
          />
          <MetricCard
            title="Appointments"
            value={metrics.appointments.total}
            subValue={`${metrics.appointments.completed} completed`}
            trend={metrics.appointments.trend}
            icon={Calendar}
            color="bg-green-500"
          />
          <MetricCard
            title="Revenue"
            value={`$${metrics.revenue.total.toLocaleString()}`}
            subValue={`Avg: $${metrics.revenue.average}`}
            trend={metrics.revenue.trend}
            icon={DollarSign}
            color="bg-purple-500"
          />
          <MetricCard
            title="Clinical Activity"
            value={metrics.clinical.exams}
            subValue={`${metrics.clinical.procedures} procedures`}
            icon={Activity}
            color="bg-orange-500"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Revenue Trend</h3>
              <LineChart size={20} className="text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={charts.revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3B82F6" fill="#93BBFC" />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="#10B981" fill="#86EFAC" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Appointments Chart */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Weekly Appointments</h3>
              <BarChart3 size={20} className="text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.appointments}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="scheduled" fill="#3B82F6" />
                <Bar dataKey="completed" fill="#10B981" />
                <Bar dataKey="noShow" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Diagnoses Distribution */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Top Diagnoses</h3>
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
              <h3 className="text-lg font-semibold">Patient Flow Today</h3>
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
                  name="Wait Time (min)"
                  strokeWidth={2}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Procedures Table */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Top Procedures</h3>
            <FileText size={20} className="text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Procedure</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Count</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Avg. Revenue</th>
                </tr>
              </thead>
              <tbody>
                {charts.procedures.map((proc, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{proc.procedure}</td>
                    <td className="text-center py-3 px-4">{proc.count}</td>
                    <td className="text-right py-3 px-4">${proc.revenue.toLocaleString()}</td>
                    <td className="text-right py-3 px-4">
                      ${(proc.revenue / proc.count).toFixed(2)}
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
            <h4 className="font-medium text-gray-700 mb-4">Collection Rate</h4>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-green-600">85.2%</p>
                <p className="text-sm text-gray-500 mt-1">
                  ${metrics.revenue.collected.toLocaleString()} collected
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Outstanding</p>
                <p className="text-lg font-semibold text-orange-600">
                  ${metrics.revenue.outstanding.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h4 className="font-medium text-gray-700 mb-4">Appointment Efficiency</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="font-semibold">84.8%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">No-Show Rate</span>
                <span className="font-semibold text-red-600">4.7%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg. Wait Time</span>
                <span className="font-semibold">12 min</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h4 className="font-medium text-gray-700 mb-4">Clinical Metrics</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Surgery Success Rate</span>
                <span className="font-semibold text-green-600">98.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Patient Satisfaction</span>
                <span className="font-semibold">4.8/5.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Referral Rate</span>
                <span className="font-semibold">32%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;