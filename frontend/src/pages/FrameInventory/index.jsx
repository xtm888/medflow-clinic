import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, AlertTriangle, Package, DollarSign,
  TrendingDown, RefreshCw, Eye, Edit, Trash2, Archive,
  ChevronLeft, ChevronRight, X, Check, Truck
} from 'lucide-react';
import { toast } from 'react-toastify';
import frameInventoryService from '../../services/frameInventoryService';
import FrameForm from './FrameForm';
import { StockReceiver, StockAdjuster } from '../../components/inventory';
import { DepotRequestModal } from '../../components/optical';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency } from '../../utils/formatters';

const FrameInventory = () => {
  const navigate = useNavigate();

  // State
  const [frames, setFrames] = useState([]);
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
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Brands for filter
  const [brands, setBrands] = useState([]);

  // Modals
  const [showFrameForm, setShowFrameForm] = useState(false);
  const [showStockReceiver, setShowStockReceiver] = useState(false);
  const [showStockAdjuster, setShowStockAdjuster] = useState(false);
  const [showDepotRequest, setShowDepotRequest] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Categories and statuses
  const categories = [
    { value: 'economic', label: 'Economique' },
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'luxury', label: 'Luxe' },
    { value: 'children', label: 'Enfant' },
    { value: 'sport', label: 'Sport' }
  ];

  const statuses = [
    { value: 'in-stock', label: 'En stock', color: 'bg-green-100 text-green-800' },
    { value: 'low-stock', label: 'Stock bas', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'out-of-stock', label: 'Rupture', color: 'bg-red-100 text-red-800' },
    { value: 'on-order', label: 'En commande', color: 'bg-blue-100 text-blue-800' },
    { value: 'discontinued', label: 'Discontinue', color: 'bg-gray-100 text-gray-800' }
  ];

  // Fetch frames
  const fetchFrames = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        brand: selectedBrand || undefined,
        inStockOnly: inStockOnly || undefined
      };

      const response = await frameInventoryService.getFrames(params);
      setFrames(response.data || []);
      setTotalPages(response.pages || 1);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Error fetching frames:', error);
      toast.error('Erreur lors du chargement des montures');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedStatus, selectedBrand, inStockOnly]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await frameInventoryService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const response = await frameInventoryService.getAlerts();
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  // Fetch brands
  const fetchBrands = async () => {
    try {
      const response = await frameInventoryService.getBrands();
      setBrands(response.data || []);
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

  // Fetch frames when filters change
  useEffect(() => {
    fetchFrames();
  }, [fetchFrames]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle frame creation/update
  const handleFrameSaved = () => {
    setShowFrameForm(false);
    setSelectedFrame(null);
    fetchFrames();
    fetchStats();
    fetchBrands();
    toast.success(selectedFrame ? 'Monture mise a jour' : 'Monture ajoutee');
  };

  // Handle stock received
  const handleStockReceived = () => {
    setShowStockReceiver(false);
    setSelectedFrame(null);
    fetchFrames();
    fetchStats();
    toast.success('Stock recu avec succes');
  };

  // Handle stock adjusted
  const handleStockAdjusted = () => {
    setShowStockAdjuster(false);
    setSelectedFrame(null);
    fetchFrames();
    fetchStats();
    toast.success('Stock ajuste avec succes');
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedFrame) return;

    try {
      await frameInventoryService.deleteFrame(selectedFrame._id, 'Discontinue par utilisateur');
      setShowDeleteConfirm(false);
      setSelectedFrame(null);
      fetchFrames();
      fetchStats();
      toast.success('Monture discontinuee');
    } catch (error) {
      console.error('Error deleting frame:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  // getStatusBadge replaced with StatusBadge component
  // formatCurrency imported from shared utils

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire Montures</h1>
          <p className="text-gray-500">Gestion du stock de montures et lunettes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDepotRequest(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Truck className="w-4 h-4" />
            Request from Depot
          </button>
          <button
            onClick={() => {
              setSelectedFrame(null);
              setShowFrameForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Monture
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Montures</p>
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
                <p className="text-xl font-bold">{formatCurrency(stats.summary?.totalSaleValue)}</p>
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
                <p className="text-2xl font-bold text-yellow-600">{stats.summary?.lowStockCount || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Rupture</p>
                <p className="text-2xl font-bold text-red-600">{stats.summary?.outOfStockCount || 0}</p>
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
                  {alert.frameName}: {alert.message}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await frameInventoryService.resolveAlert(alert.frameId, alert._id);
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
                placeholder="Rechercher par marque, modele, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes categories</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
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
              fetchFrames();
              fetchStats();
              fetchAlerts();
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Frames Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marque / Modele</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Couleur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categorie</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : frames.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    Aucune monture trouvee
                  </td>
                </tr>
              ) : (
                frames.map((frame) => (
                  <tr key={frame._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{frame.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{frame.brand}</p>
                        <p className="text-sm text-gray-500">{frame.model}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{frame.color}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm capitalize">{frame.category}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div>
                        <span className={`font-medium ${frame.inventory?.available <= 0 ? 'text-red-600' : frame.inventory?.available <= frame.inventory?.minimumStock ? 'text-yellow-600' : 'text-green-600'}`}>
                          {frame.inventory?.available || 0}
                        </span>
                        {frame.inventory?.reserved > 0 && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({frame.inventory.reserved} res.)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={frame.inventory?.status} type="inventory" />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(frame.pricing?.sellingPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedFrame(frame);
                            setShowStockReceiver(true);
                          }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Recevoir stock"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFrame(frame);
                            setShowStockAdjuster(true);
                          }}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title="Ajuster stock"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFrame(frame);
                            setShowFrameForm(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFrame(frame);
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

      {/* Frame Form Modal */}
      {showFrameForm && (
        <FrameForm
          frame={selectedFrame}
          onClose={() => {
            setShowFrameForm(false);
            setSelectedFrame(null);
          }}
          onSave={handleFrameSaved}
        />
      )}

      {/* Stock Receiver Modal */}
      {showStockReceiver && selectedFrame && (
        <StockReceiver
          item={selectedFrame}
          service={frameInventoryService}
          onClose={() => {
            setShowStockReceiver(false);
            setSelectedFrame(null);
          }}
          onSave={handleStockReceived}
          config={{
            itemTitle: `${selectedFrame.brand} ${selectedFrame.model}`,
            itemSubtitle: selectedFrame.color,
            unitLabel: 'unites',
            showWarranty: true,
            supplierFields: ['name', 'contact', 'reference']
          }}
        />
      )}

      {/* Stock Adjuster Modal */}
      {showStockAdjuster && selectedFrame && (
        <StockAdjuster
          item={selectedFrame}
          service={frameInventoryService}
          onClose={() => {
            setShowStockAdjuster(false);
            setSelectedFrame(null);
          }}
          onSave={handleStockAdjusted}
          config={{
            itemTitle: `${selectedFrame.brand} ${selectedFrame.model}`,
            itemSubtitle: selectedFrame.color,
            unitLabel: 'unites'
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Discontinuer la monture?</h3>
            <p className="text-gray-600 mb-4">
              Etes-vous sur de vouloir discontinuer{' '}
              <strong>{selectedFrame.brand} {selectedFrame.model} - {selectedFrame.color}</strong>?
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

      {/* Depot Request Modal */}
      <DepotRequestModal
        isOpen={showDepotRequest}
        onClose={() => setShowDepotRequest(false)}
        onSuccess={() => {
          setShowDepotRequest(false);
          fetchFrames();
        }}
      />
    </div>
  );
};

export default FrameInventory;
