import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Package, AlertTriangle, ArrowRightLeft, RefreshCw,
  TrendingDown, CheckCircle, Clock, Truck, X, Send, Eye,
  ChevronRight, Filter, Search, Plus
} from 'lucide-react';
import { toast } from 'react-toastify';
import crossClinicInventoryService from '../../services/crossClinicInventoryService';
import inventoryTransferService from '../../services/inventoryTransferService';
import { useAuth } from '../../contexts/AuthContext';

const CrossClinicInventory = () => {
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  // Filters
  const [selectedInventoryType, setSelectedInventoryType] = useState('');
  const [alertType, setAlertType] = useState('');

  // Modals
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferNotes, setTransferNotes] = useState('');
  const [creatingTransfer, setCreatingTransfer] = useState(false);

  const inventoryTypes = [
    { value: 'pharmacy', label: 'Pharmacie' },
    { value: 'frame', label: 'Montures' },
    { value: 'contactLens', label: 'Lentilles de Contact' },
    { value: 'opticalLens', label: 'Verres Optiques' },
    { value: 'reagent', label: 'Reactifs' },
    { value: 'labConsumable', label: 'Consommables Labo' }
  ];

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const response = await crossClinicInventoryService.getSummary();
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast.error('Erreur lors du chargement du resume');
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const params = {};
      if (selectedInventoryType) params.inventoryType = selectedInventoryType;
      if (alertType) params.alertType = alertType;

      const response = await crossClinicInventoryService.getAlerts(params);
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [selectedInventoryType, alertType]);

  // Fetch active transfers
  const fetchTransfers = useCallback(async () => {
    try {
      const response = await inventoryTransferService.getTransfers({
        status: 'requested,approved,in-transit',
        limit: 10
      });
      setTransfers(response.data || []);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    }
  }, []);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await inventoryTransferService.getRecommendations({ limit: 5 });
      setRecommendations(response.data || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSummary(),
        fetchAlerts(),
        fetchTransfers(),
        fetchRecommendations()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchSummary, fetchAlerts, fetchTransfers, fetchRecommendations]);

  // Refresh alerts when filters change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Handle quick transfer
  const handleQuickTransfer = async () => {
    if (!selectedAlert) return;

    setCreatingTransfer(true);
    try {
      await crossClinicInventoryService.createQuickTransfer({
        inventoryType: selectedAlert.inventoryType,
        inventoryId: selectedAlert.id,
        fromClinicId: selectedAlert.availableFrom?.[0]?.clinicId,
        toClinicId: selectedAlert.clinic?.id,
        quantity: transferQuantity,
        priority: selectedAlert.alertType === 'rupture' ? 'urgent' : 'high',
        reason: selectedAlert.alertType === 'rupture' ? 'stock-out' : 'low-stock'
      });

      toast.success('Transfert cree avec succes');
      setShowTransferModal(false);
      setSelectedAlert(null);
      setTransferQuantity(1);
      setTransferNotes('');

      // Refresh data
      fetchAlerts();
      fetchTransfers();
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la creation du transfert');
    } finally {
      setCreatingTransfer(false);
    }
  };

  // Open transfer modal from alert
  const openTransferModal = (alert) => {
    setSelectedAlert(alert);
    setTransferQuantity(Math.min(alert.neededQuantity || 1, alert.availableFrom?.[0]?.availableStock || 1));
    setShowTransferModal(true);
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      'draft': { label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
      'requested': { label: 'Demande', color: 'bg-blue-100 text-blue-800' },
      'approved': { label: 'Approuve', color: 'bg-green-100 text-green-800' },
      'in-transit': { label: 'En transit', color: 'bg-purple-100 text-purple-800' },
      'completed': { label: 'Complete', color: 'bg-teal-100 text-teal-800' },
      'rejected': { label: 'Rejete', color: 'bg-red-100 text-red-800' },
      'cancelled': { label: 'Annule', color: 'bg-gray-100 text-gray-800' }
    };
    const config = statusConfig[status] || statusConfig['draft'];
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Format currency
  const formatCurrency = (amount, currency = 'CDF') => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire Multi-Cliniques</h1>
          <p className="text-gray-500">Vue consolidee du stock a travers toutes les cliniques</p>
        </div>
        <button
          onClick={() => {
            fetchSummary();
            fetchAlerts();
            fetchTransfers();
            fetchRecommendations();
          }}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Clinic Summary Cards */}
      {summary?.clinics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summary.clinics.map((clinicData) => {
            const clinic = clinicData.clinic;
            // Use specific type stats if filtered, otherwise use total
            const stats = selectedInventoryType
              ? (clinicData[selectedInventoryType] || {})
              : (clinicData.total || {});
            const totalItems = stats.totalItems || 0;
            const totalStock = stats.totalStock || 0;
            const lowStock = stats.lowStock || 0;
            const outOfStock = stats.outOfStock || 0;

            return (
              <div
                key={clinic._id}
                className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{clinic.shortName || clinic.name}</h3>
                      {selectedInventoryType && (
                        <p className="text-xs text-gray-500">
                          {inventoryTypes.find(t => t.value === selectedInventoryType)?.label}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Articles</p>
                    <p className="font-semibold text-gray-900">{totalItems.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Stock total</p>
                    <p className="font-semibold text-gray-900">{totalStock.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Stock bas</p>
                    <p className={`font-semibold ${lowStock > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {lowStock}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ruptures</p>
                    <p className={`font-semibold ${outOfStock > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {outOfStock}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total Summary Card */}
          <div key="total-summary" className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5" />
              <h3 className="font-semibold">Total Global</h3>
              {selectedInventoryType && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                  {inventoryTypes.find(t => t.value === selectedInventoryType)?.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-blue-100">Articles</p>
                <p className="font-bold text-xl">
                  {summary.clinics.reduce((sum, c) => {
                    const stats = selectedInventoryType ? c[selectedInventoryType] : c.total;
                    return sum + (stats?.totalItems || 0);
                  }, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-100">Stock total</p>
                <p className="font-bold text-lg">
                  {summary.clinics.reduce((sum, c) => {
                    const stats = selectedInventoryType ? c[selectedInventoryType] : c.total;
                    return sum + (stats?.totalStock || 0);
                  }, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-100">Stock bas</p>
                <p className="font-bold text-lg">
                  {summary.clinics.reduce((sum, c) => {
                    const stats = selectedInventoryType ? c[selectedInventoryType] : c.total;
                    return sum + (stats?.lowStock || 0);
                  }, 0)}
                </p>
              </div>
              <div>
                <p className="text-blue-100">Ruptures</p>
                <p className="font-bold text-lg">
                  {summary.clinics.reduce((sum, c) => {
                    const stats = selectedInventoryType ? c[selectedInventoryType] : c.total;
                    return sum + (stats?.outOfStock || 0);
                  }, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <h2 className="text-lg font-semibold">Alertes Stock</h2>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                  {alerts.length} alertes
                </span>
              </div>

              {/* Filters */}
              <div className="flex gap-3">
                <select
                  value={selectedInventoryType}
                  onChange={(e) => setSelectedInventoryType(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous types</option>
                  {inventoryTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>

                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Toutes alertes</option>
                  <option value="out-of-stock">Ruptures</option>
                  <option value="low-stock">Stock bas</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>Aucune alerte de stock</p>
                </div>
              ) : (
                alerts.map((alert, index) => (
                  <div key={alert.id || index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            alert.alertType === 'rupture' || alert.severity === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {alert.alertType === 'rupture' ? 'Rupture' : 'Stock bas'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {inventoryTypes.find(t => t.value === alert.inventoryType)?.label || alert.inventoryType}
                          </span>
                        </div>

                        <p className="font-medium text-gray-900">{alert.productName}</p>
                        <p className="text-sm text-gray-500">
                          {alert.clinic?.name} - Stock actuel: <strong>{alert.currentStock || 0}</strong>
                        </p>

                        {alert.availableFrom?.length > 0 && (
                          <div className="mt-2 text-sm">
                            <p className="text-green-600">
                              Disponible a {alert.availableFrom[0].clinicName}:{' '}
                              <strong>{alert.availableFrom[0].availableStock}</strong> unites
                            </p>
                          </div>
                        )}
                      </div>

                      {alert.canTransfer && alert.availableFrom?.length > 0 && (
                        <button
                          onClick={() => openTransferModal(alert)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Transferer
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold">Recommandations de Transfert</h2>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {recommendations.map((rec, index) => (
                  <div key={rec.inventoryId || index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            rec.urgency === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {rec.urgency === 'critical' ? 'Urgent' : 'Prioritaire'}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900">{rec.productName}</p>
                        <p className="text-sm text-gray-500">
                          {rec.suggestedTransfer?.fromClinicName} → {rec.needyClinic?.name}
                        </p>
                        <p className="text-sm text-blue-600">
                          Quantite suggeree: {rec.suggestedTransfer?.quantity}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAlert({
                            id: rec.inventoryId,
                            inventoryType: rec.inventoryType,
                            productName: rec.productName,
                            alertType: rec.urgency === 'critical' ? 'rupture' : 'low-stock',
                            clinic: { id: rec.needyClinic?.id, name: rec.needyClinic?.name },
                            neededQuantity: rec.needyClinic?.neededQuantity,
                            availableFrom: rec.availableSources?.map(s => ({
                              clinicId: s.clinicId,
                              clinicName: s.clinicName,
                              availableStock: s.availableToTransfer
                            }))
                          });
                          setTransferQuantity(rec.suggestedTransfer?.quantity || 1);
                          setShowTransferModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4" />
                        Creer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Transfers Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold">Transferts Actifs</h2>
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {transfers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>Aucun transfert en cours</p>
                </div>
              ) : (
                transfers.map((transfer) => (
                  <div key={transfer._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-mono text-sm text-gray-600">{transfer.transferNumber}</span>
                      {getStatusBadge(transfer.status)}
                    </div>

                    <p className="text-sm text-gray-900">
                      {transfer.fromClinic?.name} → {transfer.toClinic?.name}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {transfer.items?.length || 0} article(s)
                    </p>

                    <div className="flex items-center justify-end mt-2">
                      <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTransferModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Creer un Transfert</h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700">{selectedAlert.productName}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <span>{selectedAlert.availableFrom?.[0]?.clinicName}</span>
                  <ChevronRight className="w-4 h-4" />
                  <span>{selectedAlert.clinic?.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantite a transferer
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedAlert.availableFrom?.[0]?.availableStock || 100}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Disponible: {selectedAlert.availableFrom?.[0]?.availableStock || 0} unites
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Raison du transfert..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleQuickTransfer}
                disabled={creatingTransfer || transferQuantity < 1}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingTransfer ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creation...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Creer le Transfert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossClinicInventory;
