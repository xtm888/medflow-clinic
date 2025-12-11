import { useState, useEffect } from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'];

/**
 * FinancialServiceSection - Revenue breakdown by service
 */
export default function FinancialServiceSection({ revenueByService = [] }) {
  const [loaded, setLoaded] = useState(false);

  const onExpand = () => {
    setLoaded(true);
  };

  const totalRevenue = revenueByService.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <CollapsibleSection
      title="Revenus par Service"
      icon={PieChartIcon}
      iconColor="text-purple-600"
      gradient="from-purple-50 to-pink-50"
      defaultExpanded={true}
      onExpand={onExpand}
      badge={
        revenueByService.length > 0 && (
          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
            {revenueByService.length} services
          </span>
        )
      }
    >
      {revenueByService.length === 0 ? (
        <SectionEmptyState
          icon={PieChartIcon}
          message="Aucune donnée de service disponible"
        />
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Pie Chart */}
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Répartition</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={revenueByService}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ service, percent }) => `${service} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
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
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Détails</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByService}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="service" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="amount" fill="#0ea5e9" name="Revenu (CDF)" />
                  <Bar dataKey="count" fill="#10b981" name="Nombre d'actes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Service Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nombre d'actes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Revenu total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Revenu moyen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      % du total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {revenueByService.map((service, index) => {
                    const percent = totalRevenue > 0 ? ((service.amount || 0) / totalRevenue) * 100 : 0;
                    const average = service.count > 0 ? (service.amount || 0) / service.count : 0;

                    return (
                      <tr key={service.service || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm font-medium text-gray-900">{service.service}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {service.count || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {(service.amount || 0).toLocaleString()} CDF
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {average.toLocaleString()} CDF
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor: COLORS[index % COLORS.length]
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{percent.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {revenueByService.reduce((sum, s) => sum + (s.count || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      {totalRevenue.toLocaleString()} CDF
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
