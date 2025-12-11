import React, { useState, useEffect } from 'react';
import centralService from '../../services/centralService';

/**
 * Consolidated Reports Page
 * Cross-clinic financial reports and analytics
 */
const ConsolidatedReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [centralAvailable, setCentralAvailable] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [overview, setOverview] = useState(null);
  const [clinicComparison, setClinicComparison] = useState(null);
  const [revenueByCategory, setRevenueByCategory] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [outstanding, setOutstanding] = useState(null);

  useEffect(() => {
    checkCentralAndLoad();
  }, []);

  useEffect(() => {
    if (centralAvailable) {
      loadReports();
    }
  }, [dateRange, centralAvailable]);

  const checkCentralAndLoad = async () => {
    try {
      setLoading(true);
      const status = await centralService.checkConnection();
      setCentralAvailable(status.available);
      if (!status.available) {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to check central server:', err);
      setCentralAvailable(false);
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewData,
        comparisonData,
        categoryData,
        paymentData,
        outstandingData
      ] = await Promise.all([
        centralService.getConsolidatedRevenue(dateRange),
        centralService.getClinicComparison({ period: 'month' }),
        centralService.getRevenueByCategory(dateRange),
        centralService.getPaymentMethodDistribution(dateRange),
        centralService.getOutstanding()
      ]);

      setOverview(overviewData);
      setClinicComparison(comparisonData);
      setRevenueByCategory(categoryData);
      setPaymentMethods(paymentData);
      setOutstanding(outstandingData);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err.response?.data?.error || err.message || 'Impossible de charger les rapports');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'CDF') => {
    return `${(amount || 0).toLocaleString()} ${currency}`;
  };

  const tabs = [
    { id: 'overview', label: 'Vue d\'Ensemble' },
    { id: 'comparison', label: 'Comparaison Cliniques' },
    { id: 'categories', label: 'Par Catégorie' },
    { id: 'payments', label: 'Modes de Paiement' },
    { id: 'outstanding', label: 'Impayés' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (centralAvailable === false) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center max-w-2xl mx-auto">
          <svg className="mx-auto h-16 w-16 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <h3 className="text-xl font-semibold text-yellow-800 mb-3">Serveur Central Non Disponible</h3>
          <p className="text-yellow-700 mb-6">
            Les rapports consolidés multi-cliniques nécessitent une connexion au serveur central.
            Cette fonctionnalité permet d'agréger les données de plusieurs cliniques pour une vue d'ensemble.
          </p>
          <div className="bg-yellow-100 rounded-lg p-4 text-left mb-6">
            <h4 className="font-medium text-yellow-800 mb-2">Pour activer cette fonctionnalité:</h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>Démarrez le serveur central sur le port 5002</li>
              <li>Configurez CENTRAL_SERVER_URL dans les variables d'environnement</li>
              <li>Assurez-vous que la synchronisation inter-cliniques est activée</li>
            </ul>
          </div>
          <button
            onClick={checkCentralAndLoad}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Vérifier la connexion
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-red-800 mb-2">Erreur de Chargement</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={loadReports}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports Consolidés</h1>
          <p className="text-gray-600">Analyse financière multi-cliniques</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Du:</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Au:</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={loadReports}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Chiffre d'Affaires Total</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(overview?.summary?.totalRevenue)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Montant Encaissé</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(overview?.summary?.totalPaid)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Reste à Percevoir</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(overview?.summary?.totalOutstanding)}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Nombre de Factures</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {overview?.summary?.invoiceCount?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue by Clinic */}
          {overview?.byClinic?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Revenus par Clinique</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clinique</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Factures</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">CA Total</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Encaissé</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Impayés</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Taux Recouvrement</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {overview.byClinic.map((clinic) => {
                      const recoveryRate = clinic.revenue > 0 ? (clinic.paid / clinic.revenue * 100).toFixed(1) : 0;
                      return (
                        <tr key={clinic._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{clinic._id}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{clinic.count}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(clinic.revenue)}</td>
                          <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(clinic.paid)}</td>
                          <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(clinic.outstanding)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`px-2 py-1 rounded text-sm ${recoveryRate >= 80 ? 'bg-green-100 text-green-700' : recoveryRate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {recoveryRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clinic Comparison Tab */}
      {activeTab === 'comparison' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Comparaison des Cliniques</h3>
          {clinicComparison?.clinics?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clinique</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Période Actuelle</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Période Précédente</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Croissance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clinicComparison.clinics.map((clinic) => (
                    <tr key={clinic.clinicId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{clinic.clinicId}</td>
                      <td className="px-4 py-3 text-right text-green-600">{formatCurrency(clinic.currentPeriod)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(clinic.previousPeriod)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-sm flex items-center justify-end gap-1 ${clinic.growth >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {clinic.growth >= 0 ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                          {Math.abs(clinic.growth || 0).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée de comparaison disponible</p>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Revenus par Catégorie</h3>
          {revenueByCategory?.categories?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {revenueByCategory.categories.map((cat) => (
                  <div key={cat._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        cat._id === 'consultation' ? 'bg-blue-500' :
                        cat._id === 'procedure' ? 'bg-green-500' :
                        cat._id === 'pharmacy' ? 'bg-purple-500' :
                        cat._id === 'optical' ? 'bg-orange-500' :
                        cat._id === 'laboratory' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}></div>
                      <span className="font-medium text-gray-900 capitalize">{cat._id || 'Autre'}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{formatCurrency(cat.revenue)}</div>
                      <div className="text-sm text-gray-500">{cat.count} items</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {formatCurrency(revenueByCategory.categories.reduce((sum, c) => sum + c.revenue, 0))}
                  </div>
                  <div className="text-gray-500">Total Toutes Catégories</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée de catégorie disponible</p>
          )}
        </div>
      )}

      {/* Payment Methods Tab */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Distribution des Modes de Paiement</h3>
          {paymentMethods?.methods?.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.methods.map((method) => {
                const percentage = paymentMethods.total > 0 ? (method.amount / paymentMethods.total * 100).toFixed(1) : 0;
                return (
                  <div key={method._id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 capitalize">{method._id || 'Autre'}</span>
                      <span className="text-gray-900">{formatCurrency(method.amount)} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          method._id === 'cash' ? 'bg-green-500' :
                          method._id === 'card' ? 'bg-blue-500' :
                          method._id === 'mobile' ? 'bg-purple-500' :
                          method._id === 'insurance' ? 'bg-orange-500' :
                          'bg-gray-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée de paiement disponible</p>
          )}
        </div>
      )}

      {/* Outstanding Tab */}
      {activeTab === 'outstanding' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-orange-600">
                {formatCurrency(outstanding?.summary?.totalOutstanding)}
              </div>
              <div className="text-sm text-orange-700">Total Impayés</div>
            </div>
            <div className="bg-red-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-red-600">
                {outstanding?.summary?.overdueCount || 0}
              </div>
              <div className="text-sm text-red-700">Factures en Retard</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {outstanding?.summary?.averageDaysOverdue || 0}
              </div>
              <div className="text-sm text-yellow-700">Jours Moy. de Retard</div>
            </div>
          </div>

          {outstanding?.byClinic?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Impayés par Clinique</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clinique</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Factures</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">En Retard</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {outstanding.byClinic.map((clinic) => (
                      <tr key={clinic._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{clinic._id}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{clinic.count}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(clinic.outstanding)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatCurrency(clinic.overdue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsolidatedReports;
