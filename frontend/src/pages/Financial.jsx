import { DollarSign, TrendingUp, CreditCard, FileText, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { financialData } from '../data/mockData';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];

export default function Financial() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Financier</h1>
          <p className="mt-1 text-sm text-gray-500">
            Suivi des revenus, facturation et analyses financières
          </p>
        </div>
        <button className="btn btn-primary flex items-center space-x-2">
          <Download className="h-5 w-5" />
          <span>Exporter rapport</span>
        </button>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Revenus aujourd'hui</p>
              <p className="text-4xl font-bold mt-2">${financialData.today.revenue.toFixed(2)}</p>
              <p className="text-sm text-blue-100 mt-2">{financialData.today.transactions} transactions</p>
            </div>
            <DollarSign className="h-16 w-16 text-blue-300 opacity-50" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">Revenus ce mois</p>
              <p className="text-4xl font-bold mt-2">${financialData.thisMonth.revenue.toFixed(2)}</p>
              <div className="flex items-center space-x-2 mt-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm text-green-100">+12% vs mois dernier</span>
              </div>
            </div>
            <TrendingUp className="h-16 w-16 text-green-300 opacity-50" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100">Créances en attente</p>
              <p className="text-4xl font-bold mt-2">${financialData.thisMonth.pending.toFixed(2)}</p>
              <p className="text-sm text-orange-100 mt-2">À recouvrer</p>
            </div>
            <CreditCard className="h-16 w-16 text-orange-300 opacity-50" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution mensuelle</h3>
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
                strokeWidth={3}
                name="Revenus ($)"
                dot={{ fill: '#0ea5e9', r: 4 }}
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

        {/* Service Details */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Détails par service</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={financialData.revenueByService}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="service" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#0ea5e9" name="Revenu ($)" />
              <Bar dataKey="count" fill="#10b981" name="Nombre d'actes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Summary Table */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Résumé des services</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre d'actes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenu total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenu moyen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % du total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {financialData.revenueByService.map((service) => {
                const total = financialData.revenueByService.reduce((sum, s) => sum + s.amount, 0);
                const percent = (service.amount / total) * 100;
                const average = service.amount / service.count;

                return (
                  <tr key={service.service} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {service.service}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {service.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ${service.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      ${average.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {percent.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
