import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Trophy, DollarSign, Clock, Users,
  ArrowLeft, Calendar, BarChart2, Target, Award,
  ChevronUp, ChevronDown, RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import opticalShopService from '../../services/opticalShopService';

const OpticianPerformance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [perfResponse, leaderboardResponse] = await Promise.all([
        opticalShopService.getOpticianPerformance(dateRange),
        opticalShopService.getLeaderboard()
      ]);

      if (perfResponse.success) {
        setPerformance(perfResponse.data);
      }
      if (leaderboardResponse.success) {
        setLeaderboard(leaderboardResponse.data);
      }
    } catch (error) {
      console.error('Error loading performance:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('fr-FR').format(num || 0);
  };

  // Calculate totals
  const totals = performance?.opticians?.reduce((acc, opt) => ({
    orders: acc.orders + opt.totalOrders,
    revenue: acc.revenue + opt.totalRevenue,
    confirmed: acc.confirmed + opt.confirmedOrders,
    rejected: acc.rejected + opt.rejectedOrders
  }), { orders: 0, revenue: 0, confirmed: 0, rejected: 0 }) || { orders: 0, revenue: 0, confirmed: 0, rejected: 0 };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/optical-shop')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance des Opticiens</h1>
              <p className="text-gray-500">Suivi des ventes et objectifs</p>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 border rounded-lg"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Ventes</p>
              <p className="text-2xl font-bold text-gray-900">{totals.orders}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.revenue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Taux de Confirmation</p>
              <p className="text-2xl font-bold text-purple-600">
                {totals.orders > 0 ? Math.round((totals.confirmed / totals.orders) * 100) : 0}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Opticiens Actifs</p>
              <p className="text-2xl font-bold text-gray-900">{performance?.opticians?.length || 0}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Classement du Mois
          </h2>

          {leaderboard.length > 0 ? (
            <div className="space-y-3">
              {leaderboard.map((optician, index) => (
                <div
                  key={optician._id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 ? 'bg-yellow-50 border border-yellow-200' :
                    index === 1 ? 'bg-gray-50 border border-gray-200' :
                    index === 2 ? 'bg-orange-50 border border-orange-200' :
                    'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-400 text-white' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{optician.name}</p>
                      <p className="text-xs text-gray-500">{optician.sales} ventes</p>
                    </div>
                  </div>
                  <p className="font-bold text-green-600 text-sm">
                    {formatCurrency(optician.revenue)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              Aucune donnee ce mois
            </p>
          )}
        </div>

        {/* Performance Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5" />
            Details par Opticien
          </h2>

          {performance?.opticians?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Opticien</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Ventes</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">CA</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Panier Moyen</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Temps Moyen</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Conversion</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Rejets</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.opticians.map((optician) => (
                    <tr key={optician.opticianId} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <p className="font-medium text-gray-900">{optician.opticianName}</p>
                      </td>
                      <td className="py-3 px-2 text-right font-medium">{optician.totalOrders}</td>
                      <td className="py-3 px-2 text-right text-green-600 font-medium">
                        {formatCurrency(optician.totalRevenue)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {formatCurrency(optician.avgOrderValue)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {optician.avgConsultationTime} min
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          optician.conversionRate >= 80 ? 'bg-green-100 text-green-700' :
                          optician.conversionRate >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(optician.conversionRate)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          optician.rejectionRate <= 5 ? 'bg-green-100 text-green-700' :
                          optician.rejectionRate <= 15 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(optician.rejectionRate)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              Aucune donnee pour cette periode
            </p>
          )}
        </div>
      </div>

      {/* Daily Stats Chart */}
      {performance?.dailyStats?.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolution Journaliere</h2>

          <div className="h-64">
            <div className="flex items-end justify-between h-48 gap-1">
              {performance.dailyStats.map((day, index) => {
                const maxRevenue = Math.max(...performance.dailyStats.map(d => d.revenue));
                const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;

                return (
                  <div key={day._id} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{ height: `${height}%`, minHeight: day.revenue > 0 ? '4px' : '0' }}
                      title={`${day._id}: ${formatCurrency(day.revenue)} (${day.orders} ventes)`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              {performance.dailyStats.filter((_, i) => i % Math.ceil(performance.dailyStats.length / 7) === 0).map((day) => (
                <span key={day._id}>
                  {new Date(day._id).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>Chiffre d'affaires</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Insights */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />
          Insights
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Best Performer */}
          {performance?.opticians?.length > 0 && (
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-500 mb-1">Meilleur Vendeur</p>
              <p className="font-bold text-gray-900">
                {performance.opticians.reduce((best, curr) =>
                  curr.totalRevenue > best.totalRevenue ? curr : best
                ).opticianName}
              </p>
              <p className="text-sm text-green-600">
                {formatCurrency(performance.opticians.reduce((best, curr) =>
                  curr.totalRevenue > best.totalRevenue ? curr : best
                ).totalRevenue)}
              </p>
            </div>
          )}

          {/* Best Conversion Rate */}
          {performance?.opticians?.length > 0 && (
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-500 mb-1">Meilleur Taux de Conversion</p>
              <p className="font-bold text-gray-900">
                {performance.opticians.reduce((best, curr) =>
                  curr.conversionRate > best.conversionRate ? curr : best
                ).opticianName}
              </p>
              <p className="text-sm text-purple-600">
                {Math.round(performance.opticians.reduce((best, curr) =>
                  curr.conversionRate > best.conversionRate ? curr : best
                ).conversionRate)}% de conversion
              </p>
            </div>
          )}

          {/* Fastest Service */}
          {performance?.opticians?.length > 0 && (
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-500 mb-1">Service le Plus Rapide</p>
              <p className="font-bold text-gray-900">
                {performance.opticians
                  .filter(o => o.avgConsultationTime > 0)
                  .reduce((best, curr) =>
                    curr.avgConsultationTime < best.avgConsultationTime ? curr : best
                  , performance.opticians[0])?.opticianName || '-'}
              </p>
              <p className="text-sm text-blue-600">
                {performance.opticians
                  .filter(o => o.avgConsultationTime > 0)
                  .reduce((best, curr) =>
                    curr.avgConsultationTime < best.avgConsultationTime ? curr : best
                  , performance.opticians[0])?.avgConsultationTime || 0} min en moyenne
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpticianPerformance;
