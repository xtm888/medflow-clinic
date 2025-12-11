import { useState } from 'react';
import { Clock, DollarSign, FileText, Users, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import billingService from '../../../services/billingService';

const AGING_COLORS = {
  'Current': '#10b981',
  '1-30 Days': '#0ea5e9',
  '31-60 Days': '#f59e0b',
  '61-90 Days': '#f97316',
  '91-120 Days': '#ef4444',
  '120+ Days': '#991b1b'
};

/**
 * FinancialAgingSection - Accounts Receivable Aging Report
 */
export default function FinancialAgingSection() {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [agingData, setAgingData] = useState([]);
  const [expandedBucket, setExpandedBucket] = useState(null);

  const loadData = async () => {
    if (loaded) return;

    setLoading(true);
    try {
      const response = await billingService.getAgingReport();
      const data = response.data || response || [];

      const transformedData = Array.isArray(data) ? data.map(bucket => ({
        range: bucket.range || bucket._id || 'Unknown',
        count: bucket.count || 0,
        totalAmount: bucket.totalAmount || 0,
        invoices: bucket.invoices || []
      })) : [];

      setAgingData(transformedData);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching aging report:', err);
      setAgingData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoaded(false);
    await loadData();
  };

  const getTotalAging = () => agingData.reduce((sum, bucket) => sum + bucket.totalAmount, 0);
  const getTotalInvoices = () => agingData.reduce((sum, bucket) => sum + bucket.count, 0);
  const getUniquePatients = () => new Set(agingData.flatMap(b => b.invoices?.map(i => i.patient) || [])).size;

  return (
    <CollapsibleSection
      title="Rapport d'ancienneté (A/R)"
      icon={Clock}
      iconColor="text-red-600"
      gradient="from-red-50 to-orange-50"
      defaultExpanded={false}
      onExpand={loadData}
      loading={loading}
      badge={
        loaded && getTotalAging() > 0 && (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
            {getTotalAging().toLocaleString()} CDF en souffrance
          </span>
        )
      }
      actions={
        loaded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Actualiser"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        )
      }
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-3">
          <p className="text-xs text-red-100">Total créances</p>
          <p className="text-xl font-bold">{getTotalAging().toLocaleString()} CDF</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-3">
          <p className="text-xs text-orange-100">Factures</p>
          <p className="text-xl font-bold">{getTotalInvoices()}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-3">
          <p className="text-xs text-yellow-100">Moy. / facture</p>
          <p className="text-xl font-bold">
            {getTotalInvoices() > 0 ? (getTotalAging() / getTotalInvoices()).toLocaleString() : '0'} CDF
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-3">
          <p className="text-xs text-purple-100">Patients</p>
          <p className="text-xl font-bold">{getUniquePatients()}</p>
        </div>
      </div>

      {agingData.length === 0 ? (
        <SectionEmptyState
          icon={Clock}
          message="Aucune créance en souffrance - Toutes les factures sont à jour"
        />
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Par ancienneté</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" stroke="#6b7280" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip formatter={(value) => [`${value.toLocaleString()} CDF`, 'Montant']} />
                  <Bar dataKey="totalAmount" name="Montant (CDF)">
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={AGING_COLORS[entry.range] || '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Distribution</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={agingData.filter(d => d.totalAmount > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="totalAmount"
                  >
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={AGING_COLORS[entry.range] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value.toLocaleString()} CDF`, 'Montant']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aging Buckets */}
          <div className="bg-white rounded-lg border divide-y">
            {agingData.map((bucket, idx) => (
              <div key={idx}>
                <button
                  onClick={() => setExpandedBucket(expandedBucket === idx ? null : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: AGING_COLORS[bucket.range] || '#6b7280' }}
                    />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">{bucket.range}</p>
                      <p className="text-xs text-gray-500">{bucket.count} facture(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-sm" style={{ color: AGING_COLORS[bucket.range] || '#6b7280' }}>
                        {bucket.totalAmount.toLocaleString()} CDF
                      </p>
                      <p className="text-xs text-gray-500">
                        {getTotalAging() > 0 ? ((bucket.totalAmount / getTotalAging()) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    {expandedBucket === idx ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedBucket === idx && bucket.invoices?.length > 0 && (
                  <div className="px-4 pb-3 bg-gray-50">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="py-2 text-left">Facture</th>
                          <th className="py-2 text-left">Patient</th>
                          <th className="py-2 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {bucket.invoices.slice(0, 10).map((invoice, invIdx) => (
                          <tr key={invIdx}>
                            <td className="py-2 text-gray-900">{invoice.id?.toString().slice(-8) || 'N/A'}</td>
                            <td className="py-2 text-gray-600">{invoice.patient?.toString().slice(-8) || 'N/A'}</td>
                            <td className="py-2 text-right font-medium text-gray-900">
                              {(invoice.amount || 0).toLocaleString()} CDF
                            </td>
                          </tr>
                        ))}
                        {bucket.invoices.length > 10 && (
                          <tr>
                            <td colSpan="3" className="py-2 text-center text-gray-500">
                              ... et {bucket.invoices.length - 10} autres
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(AGING_COLORS).map(([range, color]) => (
              <div key={range} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-600">{range}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
