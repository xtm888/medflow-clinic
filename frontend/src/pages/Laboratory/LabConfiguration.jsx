import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Box,
  ArrowLeftRight,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { labAnalyzerService, ANALYZER_TYPES, ANALYZER_MANUFACTURERS, ANALYZER_STATUSES } from '../../services/labAnalyzerService';
import { reagentLotService, LOT_STATUSES, VALIDATION_STATUSES } from '../../services/reagentLotService';
import { unitConversionService } from '../../services/unitConversionService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * LabConfiguration - Gestion des analyseurs, lots de réactifs et conversions d'unités
 */
const LabConfiguration = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analyzers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Analyzers state
  const [analyzers, setAnalyzers] = useState([]);
  const [analyzerStats, setAnalyzerStats] = useState(null);
  const [showAnalyzerModal, setShowAnalyzerModal] = useState(false);
  const [editingAnalyzer, setEditingAnalyzer] = useState(null);

  // Reagent lots state
  const [reagentLots, setReagentLots] = useState([]);
  const [lotStats, setLotStats] = useState(null);
  const [showLotModal, setShowLotModal] = useState(false);
  const [editingLot, setEditingLot] = useState(null);
  const [lotFilter, setLotFilter] = useState('all');

  // Unit conversions state
  const [conversions, setConversions] = useState([]);

  // Load data based on active tab
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'analyzers') {
        const [analyzersRes, statsRes] = await Promise.all([
          labAnalyzerService.getAnalyzers(),
          labAnalyzerService.getStats()
        ]);
        const analyzersData = analyzersRes?.data?.data ?? analyzersRes?.data ?? [];
        setAnalyzers(Array.isArray(analyzersData) ? analyzersData : []);
        setAnalyzerStats(statsRes?.data || null);
      } else if (activeTab === 'lots') {
        const params = {};
        if (lotFilter === 'expiring') {
          const lotsRes = await reagentLotService.getExpiringSoon(30);
          const lotsData = lotsRes?.data?.data ?? lotsRes?.data ?? [];
          setReagentLots(Array.isArray(lotsData) ? lotsData : []);
        } else if (lotFilter === 'pending') {
          const lotsRes = await reagentLotService.getPendingValidation();
          const pendingData = lotsRes?.data?.data ?? lotsRes?.data ?? [];
          setReagentLots(Array.isArray(pendingData) ? pendingData : []);
        } else {
          if (lotFilter !== 'all') params.status = lotFilter;
          const lotsRes = await reagentLotService.getReagentLots(params);
          const allLotsData = lotsRes?.data?.data ?? lotsRes?.data ?? [];
          setReagentLots(Array.isArray(allLotsData) ? allLotsData : []);
        }
        const statsRes = await reagentLotService.getStats();
        setLotStats(statsRes?.data || null);
      } else if (activeTab === 'units') {
        const res = await unitConversionService.getConversions();
        const conversionsData = res?.data?.data ?? res?.data ?? [];
        setConversions(Array.isArray(conversionsData) ? conversionsData : []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Analyzer handlers
  const handleSaveAnalyzer = async (data) => {
    try {
      if (editingAnalyzer) {
        await labAnalyzerService.updateAnalyzer(editingAnalyzer._id, data);
      } else {
        await labAnalyzerService.createAnalyzer(data);
      }
      setShowAnalyzerModal(false);
      setEditingAnalyzer(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteAnalyzer = async (analyzer) => {
    if (!confirm(`Supprimer l'analyseur ${analyzer.name} ?`)) return;
    try {
      await labAnalyzerService.deleteAnalyzer(analyzer._id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleUpdateAnalyzerStatus = async (analyzer, newStatus) => {
    try {
      await labAnalyzerService.updateStatus(analyzer._id, newStatus);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  // Reagent lot handlers
  const handleSaveLot = async (data) => {
    try {
      if (editingLot) {
        await reagentLotService.updateReagentLot(editingLot._id, data);
      } else {
        await reagentLotService.createReagentLot(data);
      }
      setShowLotModal(false);
      setEditingLot(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleActivateLot = async (lot) => {
    try {
      await reagentLotService.activateLot(lot._id, true);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de l\'activation');
    }
  };

  const handleWaiveValidation = async (lot) => {
    const reason = prompt('Raison de la dispense de validation:');
    if (!reason) return;
    try {
      await reagentLotService.waiveValidation(lot._id, reason);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur');
    }
  };

  // Seed conversions
  const handleSeedConversions = async () => {
    if (!confirm('Créer les conversions d\'unités standard ?')) return;
    try {
      const res = await unitConversionService.seedConversions();
      alert(res.message);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur');
    }
  };

  const tabs = [
    { id: 'analyzers', label: 'Analyseurs', icon: FlaskConical },
    { id: 'lots', label: 'Lots de Réactifs', icon: Box },
    { id: 'units', label: 'Conversions', icon: ArrowLeftRight }
  ];

  const getStatusColor = (status, type = 'analyzer') => {
    const statuses = type === 'analyzer' ? ANALYZER_STATUSES : LOT_STATUSES;
    const found = statuses.find(s => s.value === status);
    return found?.color || 'gray';
  };

  const getStatusLabel = (status, type = 'analyzer') => {
    const statuses = type === 'analyzer' ? ANALYZER_STATUSES : LOT_STATUSES;
    const found = statuses.find(s => s.value === status);
    return found?.label || status;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuration Laboratoire</h1>
        <p className="text-gray-500">Gérer les analyseurs, lots de réactifs et conversions d'unités</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Analyzers Tab */}
          {activeTab === 'analyzers' && (
            <div>
              {/* Stats */}
              {analyzerStats && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-2xl font-bold">{analyzerStats.total || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">Actifs</p>
                    <p className="text-2xl font-bold text-green-600">{analyzerStats.active || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">En maintenance</p>
                    <p className="text-2xl font-bold text-yellow-600">{analyzerStats.maintenance || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">Hors ligne</p>
                    <p className="text-2xl font-bold text-red-600">{analyzerStats.offline || 0}</p>
                  </div>
                </div>
              )}

              {/* Add button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => { setEditingAnalyzer(null); setShowAnalyzerModal(true); }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nouvel Analyseur
                </button>
              </div>

              {/* Analyzers list */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabricant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tests</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analyzers.map((analyzer) => (
                      <tr key={analyzer._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{analyzer.name}</div>
                          <div className="text-sm text-gray-500">{analyzer.model}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{analyzer.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{analyzer.manufacturer}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {ANALYZER_TYPES.find(t => t.value === analyzer.analyzerType)?.label || analyzer.analyzerType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={analyzer.status}
                            onChange={(e) => handleUpdateAnalyzerStatus(analyzer, e.target.value)}
                            className={`text-sm rounded-full px-3 py-1 font-medium bg-${getStatusColor(analyzer.status)}-100 text-${getStatusColor(analyzer.status)}-800`}
                          >
                            {ANALYZER_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {analyzer.supportedTests?.length || 0} tests
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => { setEditingAnalyzer(analyzer); setShowAnalyzerModal(true); }}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAnalyzer(analyzer)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {analyzers.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    Aucun analyseur configuré
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reagent Lots Tab */}
          {activeTab === 'lots' && (
            <div>
              {/* Stats */}
              {lotStats && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-2xl font-bold">{lotStats.total || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">Actifs</p>
                    <p className="text-2xl font-bold text-green-600">{lotStats.active || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">En attente validation</p>
                    <p className="text-2xl font-bold text-yellow-600">{lotStats.pendingValidation || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">Expirent bientôt</p>
                    <p className="text-2xl font-bold text-orange-600">{lotStats.expiringSoon || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-sm text-gray-500">Expirés</p>
                    <p className="text-2xl font-bold text-red-600">{lotStats.expired || 0}</p>
                  </div>
                </div>
              )}

              {/* Filters and add button */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex space-x-2">
                  {['all', 'active', 'validated', 'pending', 'expiring'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => { setLotFilter(filter); loadData(); }}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        lotFilter === filter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filter === 'all' ? 'Tous' :
                       filter === 'active' ? 'Actifs' :
                       filter === 'validated' ? 'Validés' :
                       filter === 'pending' ? 'En attente' :
                       'Expirent bientôt'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setEditingLot(null); setShowLotModal(true); }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nouveau Lot
                </button>
              </div>

              {/* Lots list */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Analyseur</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabricant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reagentLots.map((lot) => {
                      const daysToExpire = lot.daysUntilExpiration;
                      const isExpiringSoon = daysToExpire !== null && daysToExpire <= 30 && daysToExpire > 0;
                      const isExpired = daysToExpire !== null && daysToExpire <= 0;

                      return (
                        <tr key={lot._id} className={`hover:bg-gray-50 ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{lot.lotNumber}</div>
                            <div className="text-sm text-gray-500">{lot.productName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{lot.test?.testName}</div>
                            <div className="text-xs text-gray-500">{lot.test?.testCode}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lot.analyzer?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lot.manufacturer}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${isExpired ? 'text-red-600 font-medium' : isExpiringSoon ? 'text-yellow-600' : 'text-gray-900'}`}>
                              {new Date(lot.expirationDate).toLocaleDateString('fr-FR')}
                            </div>
                            {isExpiringSoon && (
                              <div className="text-xs text-yellow-600">{daysToExpire} jours restants</div>
                            )}
                            {isExpired && (
                              <div className="text-xs text-red-600">Expiré</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              lot.validation?.status === 'passed' ? 'bg-green-100 text-green-800' :
                              lot.validation?.status === 'failed' ? 'bg-red-100 text-red-800' :
                              lot.validation?.status === 'waived' ? 'bg-blue-100 text-blue-800' :
                              lot.validation?.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {VALIDATION_STATUSES.find(s => s.value === lot.validation?.status)?.label || lot.validation?.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(lot.status, 'lot')}-100 text-${getStatusColor(lot.status, 'lot')}-800`}>
                              {getStatusLabel(lot.status, 'lot')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            {lot.status === 'validated' && (
                              <button
                                onClick={() => handleActivateLot(lot)}
                                className="text-green-600 hover:text-green-900"
                                title="Activer"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                            )}
                            {(lot.validation?.status === 'pending' || lot.validation?.status === 'in-progress') && (
                              <button
                                onClick={() => handleWaiveValidation(lot)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Dispenser de validation"
                              >
                                <Clock className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingLot(lot); setShowLotModal(true); }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {reagentLots.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    Aucun lot de réactif trouvé
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Unit Conversions Tab */}
          {activeTab === 'units' && (
            <div>
              {/* Seed button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleSeedConversions}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Initialiser Conversions Standard
                </button>
              </div>

              {/* Conversions list */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code Test</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unité Primaire</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {conversions.map((conv) => (
                      <tr key={conv._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {conv.testCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {conv.testName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {conv.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {conv.primaryUnit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded ${
                            conv.primaryUnitType === 'SI' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {conv.primaryUnitType === 'SI' ? 'SI' : 'Conv.'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="flex flex-wrap gap-1">
                            {conv.conversions?.map((c, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                {c.unit} (×{c.factor})
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {conversions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p className="mb-4">Aucune conversion d'unité configurée</p>
                    <button
                      onClick={handleSeedConversions}
                      className="text-blue-600 hover:underline"
                    >
                      Cliquez ici pour initialiser les conversions standard
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Analyzer Modal */}
      {showAnalyzerModal && (
        <AnalyzerModal
          analyzer={editingAnalyzer}
          onSave={handleSaveAnalyzer}
          onClose={() => { setShowAnalyzerModal(false); setEditingAnalyzer(null); }}
        />
      )}

      {/* Lot Modal */}
      {showLotModal && (
        <ReagentLotModal
          lot={editingLot}
          analyzers={analyzers}
          onSave={handleSaveLot}
          onClose={() => { setShowLotModal(false); setEditingLot(null); }}
        />
      )}
    </div>
  );
};

// Analyzer Modal Component
const AnalyzerModal = ({ analyzer, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: analyzer?.name || '',
    code: analyzer?.code || '',
    manufacturer: analyzer?.manufacturer || 'Roche',
    model: analyzer?.model || '',
    analyzerType: analyzer?.analyzerType || 'chemistry',
    serialNumber: analyzer?.serialNumber || '',
    location: {
      department: analyzer?.location?.department || '',
      room: analyzer?.location?.room || '',
      bench: analyzer?.location?.bench || ''
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">
          {analyzer ? 'Modifier Analyseur' : 'Nouvel Analyseur'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fabricant *</label>
              <select
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                {ANALYZER_MANUFACTURERS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modèle *</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={form.analyzerType}
                onChange={(e) => setForm({ ...form, analyzerType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                {ANALYZER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Série</label>
              <input
                type="text"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emplacement</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={form.location.department}
                onChange={(e) => setForm({ ...form, location: { ...form.location, department: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Département"
              />
              <input
                type="text"
                value={form.location.room}
                onChange={(e) => setForm({ ...form, location: { ...form.location, room: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Salle"
              />
              <input
                type="text"
                value={form.location.bench}
                onChange={(e) => setForm({ ...form, location: { ...form.location, bench: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Paillasse"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {analyzer ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reagent Lot Modal Component
const ReagentLotModal = ({ lot, analyzers, onSave, onClose }) => {
  const [form, setForm] = useState({
    lotNumber: lot?.lotNumber || '',
    analyzer: lot?.analyzer?._id || lot?.analyzer || '',
    test: {
      testCode: lot?.test?.testCode || '',
      testName: lot?.test?.testName || ''
    },
    manufacturer: lot?.manufacturer || '',
    productName: lot?.productName || '',
    expirationDate: lot?.expirationDate ? new Date(lot.expirationDate).toISOString().split('T')[0] : '',
    manufacturerReferenceRange: {
      min: lot?.manufacturerReferenceRange?.min || '',
      max: lot?.manufacturerReferenceRange?.max || '',
      unit: lot?.manufacturerReferenceRange?.unit || '',
      text: lot?.manufacturerReferenceRange?.text || ''
    },
    stock: {
      initialQuantity: lot?.stock?.initialQuantity || '',
      currentQuantity: lot?.stock?.currentQuantity || '',
      unit: lot?.stock?.unit || 'tests'
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      manufacturerReferenceRange: {
        ...form.manufacturerReferenceRange,
        min: form.manufacturerReferenceRange.min ? parseFloat(form.manufacturerReferenceRange.min) : undefined,
        max: form.manufacturerReferenceRange.max ? parseFloat(form.manufacturerReferenceRange.max) : undefined
      },
      stock: {
        ...form.stock,
        initialQuantity: form.stock.initialQuantity ? parseInt(form.stock.initialQuantity) : undefined,
        currentQuantity: form.stock.currentQuantity ? parseInt(form.stock.currentQuantity) : undefined
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {lot ? 'Modifier Lot' : 'Nouveau Lot de Réactif'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° de Lot *</label>
              <input
                type="text"
                value={form.lotNumber}
                onChange={(e) => setForm({ ...form, lotNumber: e.target.value.toUpperCase() })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Analyseur *</label>
              <select
                value={form.analyzer}
                onChange={(e) => setForm({ ...form, analyzer: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Sélectionner...</option>
                {analyzers.map((a) => (
                  <option key={a._id} value={a._id}>{a.name} ({a.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code Test *</label>
              <input
                type="text"
                value={form.test.testCode}
                onChange={(e) => setForm({ ...form, test: { ...form.test, testCode: e.target.value.toUpperCase() } })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du Test</label>
              <input
                type="text"
                value={form.test.testName}
                onChange={(e) => setForm({ ...form, test: { ...form.test, testName: e.target.value } })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fabricant *</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du Produit *</label>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date d'Expiration *</label>
            <input
              type="date"
              value={form.expirationDate}
              onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Valeurs de Référence (du fabricant)</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
                <input
                  type="number"
                  step="any"
                  value={form.manufacturerReferenceRange.min}
                  onChange={(e) => setForm({ ...form, manufacturerReferenceRange: { ...form.manufacturerReferenceRange, min: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
                <input
                  type="number"
                  step="any"
                  value={form.manufacturerReferenceRange.max}
                  onChange={(e) => setForm({ ...form, manufacturerReferenceRange: { ...form.manufacturerReferenceRange, max: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                <input
                  type="text"
                  value={form.manufacturerReferenceRange.unit}
                  onChange={(e) => setForm({ ...form, manufacturerReferenceRange: { ...form.manufacturerReferenceRange, unit: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texte</label>
                <input
                  type="text"
                  value={form.manufacturerReferenceRange.text}
                  onChange={(e) => setForm({ ...form, manufacturerReferenceRange: { ...form.manufacturerReferenceRange, text: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="ex: 70-110 mg/dL"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Stock</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité Initiale</label>
                <input
                  type="number"
                  value={form.stock.initialQuantity}
                  onChange={(e) => setForm({ ...form, stock: { ...form.stock, initialQuantity: e.target.value, currentQuantity: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité Actuelle</label>
                <input
                  type="number"
                  value={form.stock.currentQuantity}
                  onChange={(e) => setForm({ ...form, stock: { ...form.stock, currentQuantity: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                <select
                  value={form.stock.unit}
                  onChange={(e) => setForm({ ...form, stock: { ...form.stock, unit: e.target.value } })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="tests">Tests</option>
                  <option value="ml">mL</option>
                  <option value="units">Unités</option>
                  <option value="kits">Kits</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {lot ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LabConfiguration;
