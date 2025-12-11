import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, AlertTriangle, Package, DollarSign,
  TrendingDown, RefreshCw, Edit, Trash2, Archive,
  ChevronLeft, ChevronRight, Check, Eye, Sun, Droplets
} from 'lucide-react';
import { toast } from 'react-toastify';
import opticalLensInventoryService from '../../services/opticalLensInventoryService';
import LensForm from './LensForm';
import { StockReceiver, StockAdjuster } from '../../components/inventory';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency } from '../../utils/formatters';

const OpticalLensInventory = () => {
  // State
  const [lenses, setLenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedDesign, setSelectedDesign] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [isPhotochromic, setIsPhotochromic] = useState(false);
  const [isPolarized, setIsPolarized] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  // Brands for filter
  const [brands, setBrands] = useState([]);

  // Modals
  const [showLensForm, setShowLensForm] = useState(false);
  const [showStockReceiver, setShowStockReceiver] = useState(false);
  const [showStockAdjuster, setShowStockAdjuster] = useState(false);
  const [selectedLens, setSelectedLens] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Materials
  const materials = [
    { value: 'cr39', label: 'CR-39 (1.50)' },
    { value: 'cr39-1.56', label: 'CR-39 (1.56)' },
    { value: 'polycarbonate', label: 'Polycarbonate (1.59)' },
    { value: 'trivex', label: 'Trivex (1.53)' },
    { value: 'hi-index-1.60', label: 'Hi-Index 1.60' },
    { value: 'hi-index-1.67', label: 'Hi-Index 1.67' },
    { value: 'hi-index-1.74', label: 'Hi-Index 1.74' },
    { value: 'glass-1.52', label: 'Verre 1.52' },
    { value: 'glass-1.70', label: 'Verre 1.70' },
    { value: 'glass-1.80', label: 'Verre 1.80' },
    { value: 'glass-1.90', label: 'Verre 1.90' }
  ];

  // Designs
  const designs = [
    { value: 'single-vision', label: 'Unifocal' },
    { value: 'bifocal-ft28', label: 'Bifocal FT28' },
    { value: 'bifocal-ft35', label: 'Bifocal FT35' },
    { value: 'bifocal-round', label: 'Bifocal Rond' },
    { value: 'progressive', label: 'Progressif' },
    { value: 'office-progressive', label: 'Progressif Bureau' },
    { value: 'degressive', label: 'Degressif' },
    { value: 'lenticular', label: 'Lenticulaire' }
  ];

  // Statuses
  const statuses = [
    { value: 'in-stock', label: 'En stock', color: 'bg-green-100 text-green-800' },
    { value: 'low-stock', label: 'Stock bas', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'out-of-stock', label: 'Rupture', color: 'bg-red-100 text-red-800' },
    { value: 'on-order', label: 'En commande', color: 'bg-blue-100 text-blue-800' },
    { value: 'discontinued', label: 'Discontinue', color: 'bg-gray-100 text-gray-800' }
  ];

  // Fetch lenses
  const fetchLenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        material: selectedMaterial || undefined,
        design: selectedDesign || undefined,
        status: selectedStatus || undefined,
        brand: selectedBrand || undefined,
        isPhotochromic: isPhotochromic || undefined,
        isPolarized: isPolarized || undefined,
        inStockOnly: inStockOnly || undefined
      };

      const response = await opticalLensInventoryService.getLenses(params);
      setLenses(response.data || []);
      setTotalPages(response.pages || 1);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Error fetching lenses:', error);
      toast.error('Erreur lors du chargement des verres');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedMaterial, selectedDesign, selectedStatus, selectedBrand, isPhotochromic, isPolarized, inStockOnly]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await opticalLensInventoryService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const response = await opticalLensInventoryService.getAlerts();
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  // Fetch brands
  const fetchBrands = async () => {
    try {
      const response = await opticalLensInventoryService.getBrands();
      setBrands((response.data || []).map(b => b.brand));
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchAlerts();
    fetchBrands();
  }, []);

  // Fetch lenses when filters change
  useEffect(() => {
    fetchLenses();
  }, [fetchLenses]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle lens creation/update
  const handleLensSaved = () => {
    setShowLensForm(false);
    setSelectedLens(null);
    fetchLenses();
    fetchStats();
    fetchBrands();
    toast.success(selectedLens ? 'Verre mis a jour' : 'Verre ajoute');
  };

  // Handle stock received
  const handleStockReceived = () => {
    setShowStockReceiver(false);
    setSelectedLens(null);
    fetchLenses();
    fetchStats();
    toast.success('Stock recu avec succes');
  };

  // Handle stock adjusted
  const handleStockAdjusted = () => {
    setShowStockAdjuster(false);
    setSelectedLens(null);
    fetchLenses();
    fetchStats();
    toast.success('Stock ajuste avec succes');
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedLens) return;

    try {
      await opticalLensInventoryService.deleteLens(selectedLens._id, 'Discontinue par utilisateur');
      setShowDeleteConfirm(false);
      setSelectedLens(null);
      fetchLenses();
      fetchStats();
      toast.success('Verre discontinue');
    } catch (error) {
      console.error('Error deleting lens:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  // getStatusBadge replaced with StatusBadge component

  // Get material label
  const getMaterialLabel = (material) => {
    const mat = materials.find(m => m.value === material);
    return mat ? mat.label : material;
  };

  // Get design label
  const getDesignLabel = (design) => {
    const des = designs.find(d => d.value === design);
    return des ? des.label : design;
  };

  // formatCurrency imported from shared utils

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire Verres Optiques</h1>
          <p className="text-gray-500">Gestion du stock de verres ophtalmiques</p>
        </div>
        <button
          onClick={() => {
            setSelectedLens(null);
            setShowLensForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nouveau Verre
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Verres</p>
                <p className="text-2xl font-bold">{stats.summary?.totalItems || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Valeur Stock</p>
                <p className="text-xl font-bold">{formatCurrency(stats.summary?.totalValue)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Stock Bas</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.summary?.lowStock || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sun className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Photochromiques</p>
                <p className="text-2xl font-bold text-purple-600">{stats.summary?.photochromic || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Droplets className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Polarises</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.summary?.polarized || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Alertes ({alerts.length})</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-yellow-700">
                  {alert.lensName}: {alert.message}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await opticalLensInventoryService.acknowledgeAlert(alert.lensId, alert._id);
                      fetchAlerts();
                      toast.success('Alerte resolue');
                    } catch (error) {
                      toast.error('Erreur');
                    }
                  }}
                  className="text-yellow-600 hover:text-yellow-800"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par marque, produit, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Material */}
          <select
            value={selectedMaterial}
            onChange={(e) => {
              setSelectedMaterial(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous materiaux</option>
            {materials.map(mat => (
              <option key={mat.value} value={mat.value}>{mat.label}</option>
            ))}
          </select>

          {/* Design */}
          <select
            value={selectedDesign}
            onChange={(e) => {
              setSelectedDesign(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous designs</option>
            {designs.map(des => (
              <option key={des.value} value={des.value}>{des.label}</option>
            ))}
          </select>

          {/* Brand */}
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes marques</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous statuts</option>
            {statuses.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>

        {/* Additional Filters */}
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t">
          {/* Photochromic */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPhotochromic}
              onChange={(e) => {
                setIsPhotochromic(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <Sun className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-700">Photochromiques</span>
          </label>

          {/* Polarized */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPolarized}
              onChange={(e) => {
                setIsPolarized(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Droplets className="w-4 h-4 text-indigo-600" />
            <span className="text-sm text-gray-700">Polarises</span>
          </label>

          {/* In Stock Only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">En stock uniquement</span>
          </label>

          {/* Refresh */}
          <button
            onClick={() => {
              fetchLenses();
              fetchStats();
              fetchAlerts();
            }}
            className="ml-auto p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Lenses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marque / Produit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materiau</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Traitements</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : lenses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    Aucun verre trouve
                  </td>
                </tr>
              ) : (
                lenses.map((lens) => (
                  <tr key={lens._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{lens.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{lens.brand}</p>
                        <p className="text-sm text-gray-500">{lens.productLine}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {getMaterialLabel(lens.material)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {getDesignLabel(lens.design)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {lens.isPhotochromic && (
                          <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded" title="Photochromique">
                            <Sun className="w-3 h-3" />
                          </span>
                        )}
                        {lens.isPolarized && (
                          <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded" title="Polarise">
                            <Droplets className="w-3 h-3" />
                          </span>
                        )}
                        {lens.coatings?.length > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded" title={lens.coatings.join(', ')}>
                            +{lens.coatings.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div>
                        <span className={`font-medium ${lens.inventory?.available <= 0 ? 'text-red-600' : lens.inventory?.available <= lens.inventory?.minimumStock ? 'text-yellow-600' : 'text-green-600'}`}>
                          {lens.inventory?.available || 0}
                        </span>
                        {lens.inventory?.reserved > 0 && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({lens.inventory.reserved} res.)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={lens.inventory?.status} type="inventory" />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(lens.pricing?.sellingPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedLens(lens);
                            setShowStockReceiver(true);
                          }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Recevoir stock"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLens(lens);
                            setShowStockAdjuster(true);
                          }}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title="Ajuster stock"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLens(lens);
                            setShowLensForm(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLens(lens);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Discontinuer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Affichage de {((page - 1) * 20) + 1} a {Math.min(page * 20, total)} sur {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lens Form Modal */}
      {showLensForm && (
        <LensForm
          lens={selectedLens}
          onClose={() => {
            setShowLensForm(false);
            setSelectedLens(null);
          }}
          onSave={handleLensSaved}
        />
      )}

      {/* Stock Receiver Modal */}
      {showStockReceiver && selectedLens && (
        <StockReceiver
          item={selectedLens}
          service={opticalLensInventoryService}
          onClose={() => {
            setShowStockReceiver(false);
            setSelectedLens(null);
          }}
          onSave={handleStockReceived}
          config={{
            itemTitle: `${selectedLens.brand} ${selectedLens.productLine}`,
            itemSubtitle: getMaterialLabel(selectedLens.material),
            unitLabel: 'paires',
            showExpiration: true,
            supplierFields: ['name', 'invoiceNumber']
          }}
        />
      )}

      {/* Stock Adjuster Modal */}
      {showStockAdjuster && selectedLens && (
        <StockAdjuster
          item={selectedLens}
          service={opticalLensInventoryService}
          onClose={() => {
            setShowStockAdjuster(false);
            setSelectedLens(null);
          }}
          onSave={handleStockAdjusted}
          config={{
            itemTitle: `${selectedLens.brand} ${selectedLens.productLine}`,
            itemSubtitle: getMaterialLabel(selectedLens.material),
            unitLabel: 'paires'
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedLens && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Discontinuer le verre?</h3>
            <p className="text-gray-600 mb-4">
              Etes-vous sur de vouloir discontinuer{' '}
              <strong>{selectedLens.brand} {selectedLens.productLine} - {getMaterialLabel(selectedLens.material)}</strong>?
              Cette action peut etre annulee.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Discontinuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpticalLensInventory;
