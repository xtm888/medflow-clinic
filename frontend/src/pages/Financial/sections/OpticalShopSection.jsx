import { useState, useCallback } from 'react';
import { Glasses, Loader2, TrendingUp, Award, Package, Users, Building2 } from 'lucide-react';
import { LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import billingService from '../../../services/billingService';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'];

/**
 * OpticalShopSection - Optical shop revenue and optician performance
 */
export default function OpticalShopSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    if (loaded && data) return;

    setLoading(true);
    setError(null);
    try {
      const result = await billingService.getOpticalShopRevenue();
      if (result.success) {
        setData(result.data);
      } else {
        setError('Erreur lors du chargement des données');
      }
    } catch (err) {
      console.error('Error fetching optical shop revenue:', err);
      setError('Impossible de charger les données de l\'optique');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [loaded, data]);

  const onExpand = () => {
    if (!loaded) {
      fetchData();
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-CD', { maximumFractionDigits: 0 }).format(value || 0);
  };

  const summary = data?.summary || {};
  const breakdown = data?.breakdown || {};
  const paymentType = data?.paymentType || {};
  const opticianPerformance = data?.opticianPerformance || [];
  const conventionBreakdown = data?.conventionBreakdown || [];
  const dailyTrend = data?.dailyTrend || [];
  const statusDistribution = data?.statusDistribution || [];

  // Prepare pie chart data for revenue breakdown
  const breakdownChartData = [
    { name: 'Montures', value: breakdown.frames?.revenue || 0 },
    { name: 'Verres', value: breakdown.lenses?.revenue || 0 },
    { name: 'Options', value: breakdown.options?.revenue || 0 }
  ].filter(d => d.value > 0);

  // Prepare payment type data
  const paymentTypeData = [
    { name: 'Convention', value: paymentType.convention?.totalRevenue || 0, orders: paymentType.convention?.orders || 0 },
    { name: 'Cash', value: paymentType.cash?.totalRevenue || 0, orders: paymentType.cash?.orders || 0 }
  ].filter(d => d.value > 0);

  return (
    <CollapsibleSection
      title="Boutique Optique"
      icon={Glasses}
      iconColor="text-indigo-600"
      gradient="from-indigo-50 to-blue-50"
      defaultExpanded={false}
      onExpand={onExpand}
      badge={
        data && (
          <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
            {summary.totalOrders || 0} commandes
          </span>
        )
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Chargement des statistiques optique...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && !data && (
        <SectionEmptyState
          icon={Glasses}
          message="Aucune commande optique ce mois"
        />
      )}

      {!loading && !error && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Revenu Total</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(summary.totalRevenue)} <span className="text-xs font-normal text-gray-500">CDF</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Facturé: {formatCurrency(summary.invoicedRevenue)} CDF
              </p>
            </div>

            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Package className="h-4 w-4" />
                <span className="text-xs font-medium">Commandes</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{summary.totalOrders || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                Moy: {formatCurrency(summary.avgOrderValue)} CDF
              </p>
            </div>

            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-medium">Convention</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {paymentType.convention?.orders || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(paymentType.convention?.companyPortion)} CDF société
              </p>
            </div>

            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Opticiens</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{opticianPerformance.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                actifs ce mois
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Revenue Breakdown Pie Chart */}
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Répartition du Revenu</h4>
              {breakdownChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={breakdownChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {breakdownChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${formatCurrency(value)} CDF`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                  Aucune donnée
                </div>
              )}
              <div className="flex justify-center gap-4 mt-2">
                {breakdownChartData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-1 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Trend Chart */}
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Tendance Journalière</h4>
              {dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(date) => {
                        const d = new Date(date);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value, name) => [
                        name === 'revenue' ? `${formatCurrency(value)} CDF` : value,
                        name === 'revenue' ? 'Revenu' : 'Commandes'
                      ]}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        return d.toLocaleDateString('fr-FR');
                      }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                  Aucune donnée
                </div>
              )}
            </div>
          </div>

          {/* Optician Performance Table */}
          {opticianPerformance.length > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden mb-4">
              <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Award className="h-4 w-4 text-indigo-600" />
                  Performance des Opticiens
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Opticien
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Commandes
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Revenu Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Panier Moyen
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Convention
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Taux Livraison
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {opticianPerformance.map((optician, index) => (
                      <tr key={optician.opticianId || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {index === 0 && (
                              <span className="text-amber-500">
                                <Award className="h-4 w-4" />
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {optician.opticianName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {optician.totalOrders}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(optician.totalRevenue)} CDF
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(optician.avgOrderValue)} CDF
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {optician.conventionOrders} ({formatCurrency(optician.conventionRevenue)} CDF)
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[60px]">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: `${optician.conversionRate || 0}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{optician.conversionRate || 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Convention Breakdown */}
          {conventionBreakdown.length > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Facturation par Convention
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Société
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Commandes
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Facturé
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Part Société
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Part Patient
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {conventionBreakdown.map((company, index) => (
                      <tr key={company._id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {company._id}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {company.orders}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(company.totalBilled)} CDF
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-medium">
                          {formatCurrency(company.companyPortion)} CDF
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(company.patientPortion)} CDF
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {conventionBreakdown.reduce((sum, c) => sum + c.orders, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">
                        {formatCurrency(conventionBreakdown.reduce((sum, c) => sum + c.totalBilled, 0))} CDF
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">
                        {formatCurrency(conventionBreakdown.reduce((sum, c) => sum + c.companyPortion, 0))} CDF
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(conventionBreakdown.reduce((sum, c) => sum + c.patientPortion, 0))} CDF
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
