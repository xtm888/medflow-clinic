import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, CreditCard, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import billingService from '../../../services/billingService';

/**
 * FinancialOverviewSection - Revenue overview with stats and monthly trends
 */
export default function FinancialOverviewSection({ onDataLoaded }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState({
    today: { revenue: 0, transactions: 0 },
    thisMonth: { totalInvoiced: 0, revenue: 0, pending: 0 },
    monthlyTrends: []
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await billingService.getBillingStatistics();
      const result = response.data || response;

      console.log('Financial stats response:', result);

      const newData = {
        today: result.today || { revenue: 0, transactions: 0 },
        thisMonth: result.thisMonth || { totalInvoiced: 0, revenue: 0, pending: 0 },
        monthlyTrends: result.monthlyTrends || [],
        revenueByService: result.revenueByService || []
      };

      setData(newData);
      setLoaded(true);

      // Share data with parent for service section
      if (onDataLoaded) {
        onDataLoaded(newData);
      }
    } catch (err) {
      console.error('Error fetching financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  return (
    <CollapsibleSection
      title="Vue d'ensemble"
      icon={TrendingUp}
      iconColor="text-blue-600"
      gradient="from-blue-50 to-indigo-50"
      defaultExpanded={true}
      onExpand={loadData}
      loading={loading}
      badge={
        loaded && (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
            {(data.thisMonth.revenue || 0).toLocaleString()} CDF ce mois
          </span>
        )
      }
    >
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Revenus aujourd'hui</p>
              <p className="text-3xl font-bold mt-1">{(data.today.revenue || 0).toLocaleString()} CDF</p>
              <p className="text-sm text-blue-100 mt-1">{data.today.transactions || 0} transactions</p>
            </div>
            <DollarSign className="h-12 w-12 text-blue-300 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">Revenus ce mois</p>
              <p className="text-3xl font-bold mt-1">{(data.thisMonth.revenue || 0).toLocaleString()} CDF</p>
              <div className="flex items-center space-x-2 mt-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm text-green-100">Tendance positive</span>
              </div>
            </div>
            <TrendingUp className="h-12 w-12 text-green-300 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100">Créances en attente</p>
              <p className="text-3xl font-bold mt-1">{(data.thisMonth.pending || 0).toLocaleString()} CDF</p>
              <p className="text-sm text-orange-100 mt-1">À recouvrer</p>
            </div>
            <CreditCard className="h-12 w-12 text-orange-300 opacity-50" />
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Évolution mensuelle</h4>
        {data.monthlyTrends.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#0ea5e9"
                strokeWidth={3}
                name="Revenus (CDF)"
                dot={{ fill: '#0ea5e9', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <SectionEmptyState
            icon={TrendingUp}
            message="Aucune donnée de tendance disponible"
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
