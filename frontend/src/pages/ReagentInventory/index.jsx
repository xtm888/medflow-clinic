import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, AlertTriangle, Package, FlaskConical,
  TrendingDown, RefreshCw, Eye, Edit, Trash2, Calendar,
  ChevronLeft, ChevronRight, X, Check, Beaker, Thermometer,
  Clock, AlertCircle, FileText
} from 'lucide-react';
import { toast } from 'react-toastify';
import reagentInventoryService from '../../services/reagentInventoryService';

const ReagentInventory = () => {
  // State
  const [reagents, setReagents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [showConsumeForm, setShowConsumeForm] = useState(false);
  const [selectedReagent, setSelectedReagent] = useState(null);

  const categories = reagentInventoryService.getCategories();
  const labSections = reagentInventoryService.getLabSections();

  const statuses = [
    { value: 'in-stock', label: 'En stock', color: 'bg-green-100 text-green-800' },
    { value: 'low-stock', label: 'Stock bas', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'out-of-stock', label: 'Rupture', color: 'bg-red-100 text-red-800' },
    { value: 'on-order', label: 'En commande', color: 'bg-blue-100 text-blue-800' }
  ];

  // Fetch reagents
  const fetchReagents = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        category: selectedCategory || undefined,
        labSection: selectedSection || undefined,
        status: selectedStatus || undefined
      };

      const response = await reagentInventoryService.getReagents(params);
      setReagents(response.data || []);
      setTotalPages(response.pagination?.pages || 1);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching reagents:', error);
      toast.error('Erreur lors du chargement des réactifs');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedSection, selectedStatus]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await reagentInventoryService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await reagentInventoryService.getAlerts();
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  useEffect(() => {
    fetchReagents();
  }, [fetchReagents]);

  useEffect(() => {
    fetchStats();
    fetchAlerts();
  }, [fetchStats, fetchAlerts]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchReagents();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getStatusBadge = (status) => {
    const statusConfig = statuses.find(s => s.value === status);
    return statusConfig ? (
      <span className={`px-2 py-1 text-xs rounded-full ${statusConfig.color}`}>
        {statusConfig.label}
      </span>
    ) : null;
  };

  const getCategoryLabel = (value) => {
    const cat = categories.find(c => c.value === value);
    return cat ? cat.label : value;
  };

  const getSectionLabel = (value) => {
    const sec = labSections.find(s => s.value === value);
    return sec ? sec.label : value;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0) + ' CDF';
  };

  const handleAddBatch = (reagent) => {
    setSelectedReagent(reagent);
    setShowBatchForm(true);
  };

  const handleConsume = (reagent) => {
    setSelectedReagent(reagent);
    setShowConsumeForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="h-7 w-7 text-purple-600" />
            Inventaire Réactifs
          </h1>
          <p className="text-gray-600 mt-1">
            Gestion des réactifs, colorants et solutions de laboratoire
          </p>
        </div>
        <button
          onClick={() => { setSelectedReagent(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nouveau Réactif
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                <p className="text-sm text-gray-500">Total articles</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.inStock}</p>
                <p className="text-sm text-gray-500">En stock</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
                <p className="text-sm text-gray-500">Stock bas</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.inventoryValue?.totalValue)}
                </p>
                <p className="text-sm text-gray-500">Valeur stock</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4" />
            Alertes actives ({alerts.length})
          </h3>
          <div className="space-y-1">
            {alerts.slice(0, 5).map((alert, idx) => (
              <div key={idx} className="text-sm text-red-700">
                <span className="font-medium">{alert.reagentName}</span>: {alert.message}
              </div>
            ))}
            {alerts.length > 5 && (
              <p className="text-sm text-red-600">... et {alerts.length - 5} autres alertes</p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Toutes catégories</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          <select
            value={selectedSection}
            onChange={(e) => { setSelectedSection(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Toutes sections</option>
            {labSections.map(sec => (
              <option key={sec.value} value={sec.value}>{sec.label}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Tous statuts</option>
            {statuses.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réactif</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Expiration</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">Chargement...</p>
                  </td>
                </tr>
              ) : reagents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    Aucun réactif trouvé
                  </td>
                </tr>
              ) : (
                reagents.map(reagent => {
                  const available = (reagent.inventory?.currentStock || 0) - (reagent.inventory?.reserved || 0);
                  const daysToExpiry = reagent.daysToExpiry;

                  return (
                    <tr key={reagent._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{reagent.name}</p>
                          <p className="text-xs text-gray-500">SKU: {reagent.sku}</p>
                          {reagent.manufacturer && (
                            <p className="text-xs text-gray-400">{reagent.manufacturer}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getCategoryLabel(reagent.category)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getSectionLabel(reagent.labSection)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-900">{available}</span>
                        <span className="text-gray-400 text-sm"> / {reagent.inventory?.currentStock || 0}</span>
                        <p className="text-xs text-gray-400">{reagent.inventory?.unit}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(reagent.inventory?.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {daysToExpiry !== null && daysToExpiry !== undefined ? (
                          <span className={`text-sm ${
                            daysToExpiry <= 7 ? 'text-red-600 font-semibold' :
                            daysToExpiry <= 30 ? 'text-yellow-600' : 'text-gray-600'
                          }`}>
                            {daysToExpiry <= 0 ? 'Expiré' : `${daysToExpiry}j`}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {formatCurrency(reagent.pricing?.costPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleAddBatch(reagent)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Ajouter lot"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleConsume(reagent)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Consommer"
                          >
                            <Beaker className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedReagent(reagent); setShowForm(true); }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Affichage de {(page - 1) * 20 + 1} à {Math.min(page * 20, total)} sur {total} réactifs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-2 text-sm">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Batch Modal */}
      {showBatchForm && selectedReagent && (
        <BatchFormModal
          reagent={selectedReagent}
          onClose={() => { setShowBatchForm(false); setSelectedReagent(null); }}
          onSuccess={() => { setShowBatchForm(false); setSelectedReagent(null); fetchReagents(); fetchStats(); }}
        />
      )}

      {/* Consume Modal */}
      {showConsumeForm && selectedReagent && (
        <ConsumeFormModal
          reagent={selectedReagent}
          onClose={() => { setShowConsumeForm(false); setSelectedReagent(null); }}
          onSuccess={() => { setShowConsumeForm(false); setSelectedReagent(null); fetchReagents(); fetchStats(); }}
        />
      )}

      {/* Reagent Form Modal */}
      {showForm && (
        <ReagentFormModal
          reagent={selectedReagent}
          categories={categories}
          labSections={labSections}
          onClose={() => { setShowForm(false); setSelectedReagent(null); }}
          onSuccess={() => { setShowForm(false); setSelectedReagent(null); fetchReagents(); fetchStats(); }}
        />
      )}
    </div>
  );
};

// Batch Form Modal Component
const BatchFormModal = ({ reagent, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    lotNumber: '',
    quantity: '',
    expirationDate: '',
    supplier: { name: '', invoiceNumber: '' },
    cost: { unitCost: '', totalCost: '' }
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await reagentInventoryService.addBatch(reagent._id, {
        ...formData,
        quantity: parseInt(formData.quantity),
        cost: {
          unitCost: parseFloat(formData.cost.unitCost) || 0,
          totalCost: parseFloat(formData.cost.totalCost) || 0
        }
      });
      toast.success('Lot ajouté avec succès');
      onSuccess();
    } catch (error) {
      console.error('Error adding batch:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'ajout du lot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ajouter un lot - {reagent.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° de lot *</label>
            <input
              type="text"
              required
              value={formData.lotNumber}
              onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
            <input
              type="number"
              required
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration *</label>
            <input
              type="date"
              required
              value={formData.expirationDate}
              onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
            <input
              type="text"
              value={formData.supplier.name}
              onChange={(e) => setFormData({ ...formData, supplier: { ...formData.supplier, name: e.target.value } })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coût unitaire (CDF)</label>
            <input
              type="number"
              min="0"
              value={formData.cost.unitCost}
              onChange={(e) => setFormData({ ...formData, cost: { ...formData.cost, unitCost: e.target.value } })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Consume Form Modal Component
const ConsumeFormModal = ({ reagent, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    quantity: '',
    notes: '',
    instrument: ''
  });
  const [saving, setSaving] = useState(false);

  const available = (reagent.inventory?.currentStock || 0) - (reagent.inventory?.reserved || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await reagentInventoryService.consumeReagent(reagent._id, {
        quantity: parseInt(formData.quantity),
        notes: formData.notes,
        instrument: formData.instrument
      });
      toast.success('Consommation enregistrée');
      onSuccess();
    } catch (error) {
      console.error('Error consuming reagent:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la consommation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Consommer - {reagent.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              Stock disponible: <span className="font-semibold">{available}</span> {reagent.inventory?.unit}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité à consommer *</label>
            <input
              type="number"
              required
              min="1"
              max={available}
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appareil/Instrument</label>
            <input
              type="text"
              value={formData.instrument}
              onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Ex: Beckman AU5800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || parseInt(formData.quantity) > available}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Consommer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reagent Form Modal Component
const ReagentFormModal = ({ reagent, categories, labSections, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    sku: reagent?.sku || '',
    name: reagent?.name || '',
    manufacturer: reagent?.manufacturer || '',
    category: reagent?.category || '',
    labSection: reagent?.labSection || 'general',
    specifications: {
      concentration: reagent?.specifications?.concentration || '',
      volume: reagent?.specifications?.volume || ''
    },
    storage: {
      temperature: reagent?.storage?.temperature || 'room-temp'
    },
    inventory: {
      unit: reagent?.inventory?.unit || 'unit',
      minimumStock: reagent?.inventory?.minimumStock || 2,
      reorderPoint: reagent?.inventory?.reorderPoint || 5
    },
    pricing: {
      costPrice: reagent?.pricing?.costPrice || 0
    }
  });
  const [saving, setSaving] = useState(false);

  const storageTemps = reagentInventoryService.getStorageTemperatures();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (reagent) {
        await reagentInventoryService.updateReagent(reagent._id, formData);
        toast.success('Réactif mis à jour');
      } else {
        await reagentInventoryService.createReagent(formData);
        toast.success('Réactif créé');
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving reagent:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {reagent ? 'Modifier le réactif' : 'Nouveau réactif'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                disabled={!!reagent}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fabricant</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Sélectionner...</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section labo</label>
              <select
                value={formData.labSection}
                onChange={(e) => setFormData({ ...formData, labSection: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {labSections.map(sec => (
                  <option key={sec.value} value={sec.value}>{sec.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Température</label>
              <select
                value={formData.storage.temperature}
                onChange={(e) => setFormData({ ...formData, storage: { ...formData.storage, temperature: e.target.value } })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {storageTemps.map(temp => (
                  <option key={temp.value} value={temp.value}>{temp.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
              <select
                value={formData.inventory.unit}
                onChange={(e) => setFormData({ ...formData, inventory: { ...formData.inventory, unit: e.target.value } })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="unit">Unité</option>
                <option value="bottle">Flacon</option>
                <option value="vial">Fiole</option>
                <option value="kit">Kit</option>
                <option value="box">Boîte</option>
                <option value="liter">Litre</option>
                <option value="ml">mL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock minimum</label>
              <input
                type="number"
                min="0"
                value={formData.inventory.minimumStock}
                onChange={(e) => setFormData({ ...formData, inventory: { ...formData.inventory, minimumStock: parseInt(e.target.value) } })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix (CDF)</label>
              <input
                type="number"
                min="0"
                value={formData.pricing.costPrice}
                onChange={(e) => setFormData({ ...formData, pricing: { ...formData.pricing, costPrice: parseFloat(e.target.value) } })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : (reagent ? 'Mettre à jour' : 'Créer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReagentInventory;
