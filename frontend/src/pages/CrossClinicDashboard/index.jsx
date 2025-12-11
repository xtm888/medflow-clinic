import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import centralService from '../../services/centralService';

/**
 * Cross-Clinic Dashboard
 * Central view for multi-clinic operations showing:
 * - Connected clinics status
 * - Cross-clinic patient search
 * - Inventory alerts and transfer recommendations
 * - Financial summary
 */
const CrossClinicDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check connection first
      const status = await centralService.checkConnection();
      setConnectionStatus(status);

      if (status.available) {
        const data = await centralService.getDashboard();
        setDashboard(data.dashboard);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.response?.data?.error || err.message || 'Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSearch = async (e) => {
    e.preventDefault();
    if (!patientSearch.trim()) return;

    try {
      setSearchLoading(true);
      const result = await centralService.searchPatients({ search: patientSearch });
      setPatientResults(result.patients || []);
    } catch (err) {
      console.error('Patient search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !connectionStatus?.available) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Serveur Central Non Disponible</h3>
          <p className="text-yellow-700 mb-4">
            {error || 'Le serveur central n\'est pas accessible. Les fonctionnalités multi-cliniques sont temporairement indisponibles.'}
          </p>
          <p className="text-sm text-yellow-600 mb-4">
            URL: {connectionStatus?.config?.baseUrl || 'Non configurée'}<br/>
            Clinique: {connectionStatus?.config?.clinicId || 'Non configurée'}
          </p>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord Multi-Cliniques</h1>
          <p className="text-gray-600">Vue consolidée de toutes les cliniques connectées</p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualiser
        </button>
      </div>

      {/* Clinics Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Cliniques Connectées
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{dashboard?.clinics?.total || 0}</div>
            <div className="text-sm text-blue-700">Total Cliniques</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{dashboard?.clinics?.online || 0}</div>
            <div className="text-sm text-green-700">En Ligne</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{dashboard?.patients?.total?.toLocaleString() || 0}</div>
            <div className="text-sm text-purple-700">Patients Totaux</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{dashboard?.financial?.invoiceCount || 0}</div>
            <div className="text-sm text-orange-700">Factures (30j)</div>
          </div>
        </div>

        {/* Clinic List */}
        {dashboard?.clinics?.list?.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h3 className="font-medium text-gray-700 mb-2">Statut des Cliniques</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {dashboard.clinics.list.map((clinic) => (
                <div key={clinic.clinicId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className={`w-3 h-3 rounded-full ${clinic.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">{clinic.shortName || clinic.name}</span>
                  <span className="text-sm text-gray-500 ml-auto">
                    {clinic.stats?.patientsCount?.toLocaleString() || 0} patients
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cross-Clinic Patient Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Recherche Patient Multi-Cliniques
        </h2>
        <form onSubmit={handlePatientSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Nom, téléphone ou ID national..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={searchLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {searchLoading ? 'Recherche...' : 'Rechercher'}
          </button>
        </form>

        {patientResults.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliniques</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {patientResults.map((patient) => (
                  <tr key={patient._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{patient.lastName} {patient.firstName}</div>
                      <div className="text-sm text-gray-500">{patient.nationalId || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{patient.phone || '-'}</div>
                      <div className="text-sm text-gray-500">{patient.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {patient.availableAtClinics?.map((clinic) => (
                          <span key={clinic} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            {clinic}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => window.open(`/patients/${patient._id}`, '_blank')}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Voir Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {patientResults.length === 0 && patientSearch && !searchLoading && (
          <p className="text-gray-500 text-center py-4">Aucun patient trouvé</p>
        )}
      </div>

      {/* Inventory Alerts & Transfer Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Alertes Inventaire ({dashboard?.inventory?.alerts || 0})
          </h2>
          {dashboard?.inventory?.alertItems?.length > 0 ? (
            <div className="space-y-2">
              {dashboard.inventory.alertItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className={`p-3 rounded-lg ${item.status === 'out-of-stock' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-600 flex justify-between">
                    <span>{item.clinicId}</span>
                    <span className={item.status === 'out-of-stock' ? 'text-red-600' : 'text-yellow-600'}>
                      {item.status === 'out-of-stock' ? 'Rupture' : 'Stock Bas'}: {item.currentStock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Aucune alerte</p>
          )}
          <Link to="/cross-clinic-inventory" className="block mt-4 text-center text-blue-600 hover:text-blue-800">
            Voir tout l'inventaire
          </Link>
        </div>

        {/* Transfer Recommendations */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Recommandations de Transfert
          </h2>
          {dashboard?.inventory?.transferRecommendations?.length > 0 ? (
            <div className="space-y-2">
              {dashboard.inventory.transferRecommendations.map((rec, idx) => (
                <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-medium text-gray-900">{rec.productName}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="font-medium">{rec.fromClinic}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="font-medium">{rec.toClinic}</span>
                    <span className="ml-auto text-blue-600 font-medium">{rec.suggestedQuantity} unités</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Priorité: <span className={rec.priority === 'critical' ? 'text-red-600' : rec.priority === 'high' ? 'text-orange-600' : 'text-green-600'}>{rec.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Aucune recommandation</p>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Résumé Financier (30 derniers jours)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {(dashboard?.financial?.totalRevenue || 0).toLocaleString()} CDF
            </div>
            <div className="text-sm text-green-700">Chiffre d'Affaires Total</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(dashboard?.financial?.totalPaid || 0).toLocaleString()} CDF
            </div>
            <div className="text-sm text-blue-700">Montant Encaissé</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {((dashboard?.financial?.totalRevenue || 0) - (dashboard?.financial?.totalPaid || 0)).toLocaleString()} CDF
            </div>
            <div className="text-sm text-orange-700">Reste à Percevoir</div>
          </div>
        </div>
        <Link to="/consolidated-reports" className="block mt-4 text-center text-blue-600 hover:text-blue-800">
          Voir les rapports consolidés
        </Link>
      </div>
    </div>
  );
};

export default CrossClinicDashboard;
