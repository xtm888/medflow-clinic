import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  BarChart3,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download
} from 'lucide-react';

/**
 * Queue Analytics Dashboard
 * Comprehensive analytics for queue management and operational insights
 *
 * Features:
 * - Wait time analytics
 * - Department performance
 * - Hourly patterns
 * - Bottleneck identification
 * - Trend analysis
 */
export default function QueueAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ dateRange });
      if (selectedDepartment !== 'all') {
        params.append('department', selectedDepartment);
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${API_URL}/queue/analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();

      // Convert byDepartment object to array for easier display
      const analyticsData = data.data;
      if (analyticsData.byDepartment && typeof analyticsData.byDepartment === 'object' && !Array.isArray(analyticsData.byDepartment)) {
        analyticsData.byDepartment = Object.entries(analyticsData.byDepartment).map(([department, stats]) => ({
          department,
          ...stats
        }));
      }

      // Convert byHour object to array (also create hourlyDistribution alias)
      if (analyticsData.byHour && typeof analyticsData.byHour === 'object' && !Array.isArray(analyticsData.byHour)) {
        const hourlyArray = Object.entries(analyticsData.byHour).map(([hour, stats]) => ({
          hour: parseInt(hour),
          ...stats
        }));
        analyticsData.byHour = hourlyArray;
        analyticsData.hourlyDistribution = hourlyArray;
      }

      // Calculate wait time distribution from waitTimes data
      if (analyticsData.waitTimes) {
        const distribution = {
          under15: 0,
          '15to30': 0,
          '30to45': 0,
          over45: 0
        };

        // We need to categorize based on the actual wait times
        // Since backend doesn't provide individual wait times, we'll estimate from the stats
        const avg = analyticsData.waitTimes.average || 0;
        const total = analyticsData.summary?.totalPatients || 0;
        const completed = analyticsData.summary?.completed || 0;

        // Simple distribution based on average (this is an approximation)
        if (completed > 0) {
          if (avg < 15) {
            distribution.under15 = completed;
          } else if (avg < 30) {
            distribution['15to30'] = completed;
          } else if (avg < 45) {
            distribution['30to45'] = completed;
          } else {
            distribution.over45 = completed;
          }
        }

        analyticsData.waitTimeDistribution = distribution;
      }

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Échec du chargement des analyses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedDepartment]);

  // Format time in minutes
  const formatTime = (minutes) => {
    if (!minutes) return '0 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Get trend indicator
  const getTrendIndicator = (current, previous) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    return (
      <span className={`flex items-center text-sm ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
        {isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  // Export analytics to CSV
  const exportToCSV = () => {
    if (!analytics) return;

    const rows = [
      ['Métrique', 'Valeur'],
      ['Total patients', analytics.summary?.totalPatients || 0],
      ['Temps attente moyen (min)', analytics.waitTimes?.average || 0],
      ['Temps consultation moyen (min)', analytics.consultationTimes?.average || 0],
      ['Patients complétés', analytics.summary?.completed || 0],
      [''],
      ['Département', 'Patients', 'Temps Attente', 'Temps Consultation'],
      ...(analytics.byDepartment || []).map(d => [
        d.department,
        d.total,
        d.avgWaitTime,
        d.avgConsultTime
      ])
    ];

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des analyses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analyses de la File d'Attente</h1>
          <p className="mt-1 text-sm text-gray-500">
            Métriques de performance et identification des goulets d'étranglement
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input w-40"
          >
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
          </select>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="input w-40"
          >
            <option value="all">Tous départements</option>
            <option value="general">Général</option>
            <option value="ophthalmology">Ophtalmologie</option>
            <option value="laboratory">Laboratoire</option>
            <option value="emergency">Urgences</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Rafraîchir</span>
          </button>
          <button
            onClick={exportToCSV}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Patients</p>
              <p className="text-3xl font-bold text-blue-900">
                {analytics?.summary?.totalPatients || 0}
              </p>
            </div>
            <Users className="h-10 w-10 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Temps Attente Moyen</p>
              <p className="text-3xl font-bold text-orange-900">
                {formatTime(analytics?.waitTimes?.average)}
              </p>
            </div>
            <Clock className="h-10 w-10 text-orange-500 opacity-50" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Temps Consultation</p>
              <p className="text-3xl font-bold text-green-900">
                {formatTime(analytics?.consultationTimes?.average)}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Complétés</p>
              <p className="text-3xl font-bold text-purple-900">
                {analytics?.summary?.completed || 0}
              </p>
            </div>
            <BarChart3 className="h-10 w-10 text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Bottlenecks Alert */}
      {analytics?.bottlenecks?.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start space-x-4">
            <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900">Goulets d'Étranglement Identifiés</h3>
              <div className="mt-3 space-y-2">
                {analytics.bottlenecks.map((bottleneck, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      bottleneck.severity === 'high'
                        ? 'bg-red-100 border border-red-300'
                        : bottleneck.severity === 'medium'
                          ? 'bg-orange-100 border border-orange-300'
                          : 'bg-yellow-100 border border-yellow-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">
                          {bottleneck.type === 'peak_hour' ? 'Heure de pointe' :
                           bottleneck.type === 'slow_department' ? 'Département lent' :
                           bottleneck.type}
                        </span>
                        {bottleneck.department && (
                          <span className="text-sm text-gray-600 ml-2">({bottleneck.department})</span>
                        )}
                        {bottleneck.hour !== undefined && (
                          <span className="text-sm text-gray-600 ml-2">(Heure: {bottleneck.hour}h)</span>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        bottleneck.severity === 'high'
                          ? 'bg-red-200 text-red-800'
                          : bottleneck.severity === 'medium'
                            ? 'bg-orange-200 text-orange-800'
                            : 'bg-yellow-200 text-yellow-800'
                      }`}>
                        {bottleneck.severity === 'high' ? 'Critique' :
                         bottleneck.severity === 'medium' ? 'Moyen' : 'Faible'}
                      </span>
                    </div>
                    <p className="text-sm mt-1 text-gray-700">{bottleneck.recommendation}</p>
                    <p className="text-xs mt-1 text-gray-500">
                      Impact: {bottleneck.impact} {bottleneck.impact > 1 ? 'patients affectés' : 'patient affecté'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Performance */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Performance par Département
          </h3>
          <div className="space-y-4">
            {analytics?.byDepartment?.length > 0 ? (
              analytics.byDepartment.map((dept, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 capitalize">
                      {dept.department === 'general' ? 'Général' :
                       dept.department === 'ophthalmology' ? 'Ophtalmologie' :
                       dept.department === 'laboratory' ? 'Laboratoire' :
                       dept.department === 'emergency' ? 'Urgences' :
                       dept.department}
                    </span>
                    <span className="text-sm text-gray-500">{dept.total} patients</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Attente moy.</span>
                      <div className="font-semibold text-orange-600">
                        {formatTime(dept.avgWaitTime)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Consultation moy.</span>
                      <div className="font-semibold text-green-600">
                        {formatTime(dept.avgConsultTime)}
                      </div>
                    </div>
                  </div>
                  {/* Progress bar for wait time */}
                  <div className="mt-2">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dept.avgWaitTime > 30 ? 'bg-red-500' :
                          dept.avgWaitTime > 15 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, (dept.avgWaitTime / 60) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>

        {/* Hourly Distribution */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            Distribution Horaire
          </h3>
          <div className="space-y-2">
            {analytics?.hourlyDistribution?.length > 0 ? (
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 7; // 7 AM to 6 PM
                  const hourData = analytics.hourlyDistribution.find(h => h.hour === hour);
                  const count = hourData?.count || 0;
                  const maxCount = Math.max(...analytics.hourlyDistribution.map(h => h.count), 1);
                  const height = (count / maxCount) * 100;

                  return (
                    <div key={hour} className="flex flex-col items-center">
                      <div className="h-32 w-full flex items-end">
                        <div
                          className={`w-full rounded-t ${
                            count > maxCount * 0.8 ? 'bg-red-500' :
                            count > maxCount * 0.5 ? 'bg-orange-500' :
                            count > maxCount * 0.25 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ height: `${Math.max(10, height)}%` }}
                          title={`${hour}h: ${count} patients`}
                        />
                      </div>
                      <span className="text-xs text-gray-500 mt-1">{hour}h</span>
                      <span className="text-xs font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucune donnée horaire disponible
              </div>
            )}
            <div className="flex items-center justify-center space-x-4 mt-4 text-xs">
              <span className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-1" /> Faible
              </span>
              <span className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded mr-1" /> Modéré
              </span>
              <span className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded mr-1" /> Élevé
              </span>
              <span className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-1" /> Critique
              </span>
            </div>
          </div>
        </div>

        {/* Wait Time Distribution */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Répartition des Temps d'Attente
          </h3>
          <div className="space-y-3">
            {[
              { range: '0-15 min', color: 'bg-green-500', key: 'under15' },
              { range: '15-30 min', color: 'bg-yellow-500', key: '15to30' },
              { range: '30-45 min', color: 'bg-orange-500', key: '30to45' },
              { range: '45+ min', color: 'bg-red-500', key: 'over45' }
            ].map((bucket) => {
              const count = analytics?.waitTimeDistribution?.[bucket.key] || 0;
              const total = analytics?.summary?.totalPatients || 1;
              const percentage = (count / total) * 100;

              return (
                <div key={bucket.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{bucket.range}</span>
                    <span className="text-sm font-medium">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bucket.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider Performance */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Performance des Praticiens
          </h3>
          <div className="space-y-3">
            {analytics?.byProvider?.length > 0 ? (
              analytics.byProvider.slice(0, 5).map((provider, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        Dr. {provider.providerName || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {provider.count} consultations
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {formatTime(provider.avgConsultationTime)}
                    </div>
                    <div className="text-xs text-gray-500">moy. consultation</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucune donnée praticien disponible
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {analytics?.recommendations?.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            Recommandations d'Amélioration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  rec.priority === 'high'
                    ? 'bg-red-50 border-red-200'
                    : rec.priority === 'medium'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    rec.priority === 'high' ? 'bg-red-500' :
                    rec.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{rec.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Impact estimé: {rec.expectedImpact}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
