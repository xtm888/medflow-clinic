import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, AlertTriangle, Package, DollarSign,
  TrendingDown, RefreshCw, Edit, Trash2, Archive, Clock,
  ChevronLeft, ChevronRight, X, Check, Save
} from 'lucide-react';
import { toast } from 'react-toastify';
import contactLensInventoryService from '../../services/contactLensInventoryService';

const ContactLensInventory = () => {
  // State
  const [lenses, setLenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [expiring, setExpiring] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Brands for filter
  const [brands, setBrands] = useState([]);

  // Modals
  const [showLensForm, setShowLensForm] = useState(false);
  const [showStockReceiver, setShowStockReceiver] = useState(false);
  const [selectedLens, setSelectedLens] = useState(null);

  // Types and schedules
  const lensTypes = [
    { value: 'spherical', label: 'Spherique' },
    { value: 'toric', label: 'Torique' },
    { value: 'multifocal', label: 'Multifocale' },
    { value: 'colored', label: 'Coloree' }
  ];

  const wearSchedules = [
    { value: 'daily', label: 'Journaliere' },
    { value: 'bi-weekly', label: 'Bi-hebdomadaire' },
    { value: 'monthly', label: 'Mensuelle' },
    { value: 'extended', label: 'Port prolonge' }
  ];

  // Fetch lenses
  const fetchLenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        lensType: selectedType || undefined,
        wearSchedule: selectedSchedule || undefined,
        brand: selectedBrand || undefined,
        inStockOnly: inStockOnly || undefined
      };

      const response = await contactLensInventoryService.getLenses(params);
      setLenses(response.data || []);
      setTotalPages(response.pages || 1);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Error fetching lenses:', error);
      toast.error('Erreur lors du chargement des lentilles');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedType, selectedSchedule, selectedBrand, inStockOnly]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await contactLensInventoryService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const response = await contactLensInventoryService.getAlerts();
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  // Fetch expiring
  const fetchExpiring = async () => {
    try {
      const response = await contactLensInventoryService.getExpiring(90);
      setExpiring(response.data || []);
    } catch (error) {
      console.error('Error fetching expiring:', error);
    }
  };

  // Fetch brands
  const fetchBrands = async () => {
    try {
      const response = await contactLensInventoryService.getBrands();
      setBrands(response.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchAlerts();
    fetchExpiring();
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

  // Format currency
  const formatCurrency = (amount, currency = 'CDF') => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Get expiry badge
  const getExpiryBadge = (daysToExpiry) => {
    if (daysToExpiry === null || daysToExpiry === undefined) return null;

    if (daysToExpiry <= 0) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Expire</span>;
    } else if (daysToExpiry <= 30) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">{daysToExpiry}j</span>;
    } else if (daysToExpiry <= 90) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">{daysToExpiry}j</span>;
    }
    return null;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const config = {
      'in-stock': { label: 'En stock', color: 'bg-green-100 text-green-800' },
      'low-stock': { label: 'Stock bas', color: 'bg-yellow-100 text-yellow-800' },
      'out-of-stock': { label: 'Rupture', color: 'bg-red-100 text-red-800' },
      'on-order': { label: 'En commande', color: 'bg-blue-100 text-blue-800' },
      'discontinued': { label: 'Discontinue', color: 'bg-gray-100 text-gray-800' }
    };
    const statusConfig = config[status] || config['in-stock'];
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig.color}`}>
        {statusConfig.label}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire Lentilles</h1>
          <p className="text-gray-500">Gestion du stock de lentilles de contact</p>
        </div>
        <button
          onClick={() => {
            setSelectedLens(null);
            setShowLensForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Lentille
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
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
                <p className="text-lg font-bold">{formatCurrency(stats.summary?.totalSaleValue)}</p>
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

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Expire bientot</p>
                <p className="text-2xl font-bold text-orange-600">{expiring.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expiring Alert */}
      {expiring.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <h3 className="font-medium text-orange-800">Lentilles expirant bientot ({expiring.length})</h3>
          </div>
          <div className="space-y-1">
            {expiring.slice(0, 3).map((lens, index) => (
              <p key={index} className="text-sm text-orange-700">
                {lens.brand} {lens.productLine} - Lot expire dans {lens.daysToExpiry || '?'} jours
              </p>
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

          {/* Type */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous types</option>
            {lensTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* Schedule */}
          <select
            value={selectedSchedule}
            onChange={(e) => {
              setSelectedSchedule(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous rythmes</option>
            {wearSchedules.map(schedule => (
              <option key={schedule.value} value={schedule.value}>{schedule.label}</option>
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
              fetchExpiring();
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parametres</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type/Rythme</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Expiration</th>
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
                    Aucune lentille trouvee
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
                    <td className="px-4 py-3 text-sm">
                      <p>BC: {lens.parameters?.baseCurve} / D: {lens.parameters?.diameter}</p>
                      {lens.parameters?.power?.value && <p>PWR: {lens.parameters.power.value}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="capitalize">{lensTypes.find(t => t.value === lens.lensType)?.label || lens.lensType}</p>
                        <p className="text-gray-500">{wearSchedules.find(s => s.value === lens.wearSchedule)?.label || lens.wearSchedule}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${lens.inventory?.available <= 0 ? 'text-red-600' : lens.inventory?.available <= lens.inventory?.minimumStock ? 'text-yellow-600' : 'text-green-600'}`}>
                        {lens.inventory?.available || 0}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">boites</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(lens.inventory?.status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getExpiryBadge(lens.daysToExpiry)}
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
                            setShowLensForm(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
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
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lens Form Modal - Simplified inline form */}
      {showLensForm && (
        <LensFormModal
          lens={selectedLens}
          onClose={() => {
            setShowLensForm(false);
            setSelectedLens(null);
          }}
          onSave={() => {
            setShowLensForm(false);
            setSelectedLens(null);
            fetchLenses();
            fetchStats();
            fetchBrands();
          }}
        />
      )}

      {/* Stock Receiver Modal */}
      {showStockReceiver && selectedLens && (
        <StockReceiverModal
          lens={selectedLens}
          onClose={() => {
            setShowStockReceiver(false);
            setSelectedLens(null);
          }}
          onSave={() => {
            setShowStockReceiver(false);
            setSelectedLens(null);
            fetchLenses();
            fetchStats();
            fetchExpiring();
          }}
        />
      )}
    </div>
  );
};

// Simplified Lens Form Modal
const LensFormModal = ({ lens, onClose, onSave }) => {
  const isEdit = !!lens;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sku: lens?.sku || '',
    brand: lens?.brand || '',
    productLine: lens?.productLine || '',
    parameters: {
      baseCurve: lens?.parameters?.baseCurve || '',
      diameter: lens?.parameters?.diameter || ''
    },
    lensType: lens?.lensType || 'spherical',
    wearSchedule: lens?.wearSchedule || 'monthly',
    packSize: lens?.packSize || 6,
    stockingType: lens?.stockingType || 'in-stock',
    pricing: {
      costPrice: lens?.pricing?.costPrice || '',
      sellingPrice: lens?.pricing?.sellingPrice || ''
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sku || !formData.brand || !formData.productLine) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      const data = {
        ...formData,
        parameters: {
          baseCurve: parseFloat(formData.parameters.baseCurve),
          diameter: parseFloat(formData.parameters.diameter)
        },
        pricing: {
          costPrice: parseFloat(formData.pricing.costPrice),
          sellingPrice: parseFloat(formData.pricing.sellingPrice),
          currency: 'CDF'
        }
      };

      if (isEdit) {
        await contactLensInventoryService.updateLens(lens._id, data);
      } else {
        await contactLensInventoryService.createLens(data);
      }
      toast.success(isEdit ? 'Lentille mise a jour' : 'Lentille ajoutee');
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'Modifier' : 'Nouvelle'} Lentille</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">SKU *</label>
              <input type="text" name="sku" value={formData.sku} onChange={handleChange} disabled={isEdit}
                className="w-full px-3 py-2 border rounded-lg" placeholder="CL-XXX-XXX" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Marque *</label>
              <input type="text" name="brand" value={formData.brand} onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg" placeholder="Ex: Acuvue" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Gamme *</label>
              <input type="text" name="productLine" value={formData.productLine} onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg" placeholder="Ex: Oasys" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Base Curve</label>
              <input type="number" step="0.1" name="parameters.baseCurve" value={formData.parameters.baseCurve} onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg" placeholder="8.4" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Diametre</label>
              <input type="number" step="0.1" name="parameters.diameter" value={formData.parameters.diameter} onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg" placeholder="14.0" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Type</label>
              <select name="lensType" value={formData.lensType} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                <option value="spherical">Spherique</option>
                <option value="toric">Torique</option>
                <option value="multifocal">Multifocale</option>
                <option value="colored">Coloree</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Rythme</label>
              <select name="wearSchedule" value={formData.wearSchedule} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                <option value="daily">Journaliere</option>
                <option value="bi-weekly">Bi-hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
                <option value="extended">Port prolonge</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Prix achat</label>
              <input type="number" name="pricing.costPrice" value={formData.pricing.costPrice} onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Prix vente</label>
              <input type="number" name="pricing.sellingPrice" value={formData.pricing.sellingPrice} onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              <Save className="w-4 h-4" />{loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Stock Receiver Modal
const StockReceiverModal = ({ lens, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lotNumber: '',
    quantity: '',
    expirationDate: '',
    supplier: { name: '' },
    cost: { unitCost: lens.pricing?.costPrice || '' }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lotNumber || !formData.quantity || !formData.expirationDate) {
      toast.error('Lot, quantite et date expiration requis');
      return;
    }

    try {
      setLoading(true);
      await contactLensInventoryService.addStock(lens._id, {
        lotNumber: formData.lotNumber,
        quantity: parseInt(formData.quantity),
        expirationDate: formData.expirationDate,
        supplier: formData.supplier.name ? formData.supplier : undefined,
        cost: {
          unitCost: parseFloat(formData.cost.unitCost) || 0,
          totalCost: (parseFloat(formData.cost.unitCost) || 0) * parseInt(formData.quantity),
          currency: 'CDF'
        }
      });
      toast.success('Stock recu');
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Recevoir Stock</h2>
            <p className="text-sm text-gray-500">{lens.brand} {lens.productLine}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">N° Lot *</label>
              <input type="text" value={formData.lotNumber} onChange={(e) => setFormData(p => ({ ...p, lotNumber: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Quantite *</label>
              <input type="number" value={formData.quantity} onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg" min="1" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date d'expiration *</label>
            <input type="date" value={formData.expirationDate} onChange={(e) => setFormData(p => ({ ...p, expirationDate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cout unitaire</label>
            <input type="number" value={formData.cost.unitCost} onChange={(e) => setFormData(p => ({ ...p, cost: { ...p.cost, unitCost: e.target.value } }))}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
              <Save className="w-4 h-4" />{loading ? 'Sauvegarde...' : 'Recevoir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactLensInventory;
