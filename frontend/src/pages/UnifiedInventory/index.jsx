import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Package, Glasses, Eye, Circle, FlaskConical, Pill, TestTube, Scissors,
  AlertTriangle, TrendingDown, DollarSign, RefreshCw, Loader2,
  Plus, Search, Filter, Edit, Trash2, Archive, ChevronLeft, ChevronRight,
  X, Check, ArrowUpDown, ArrowDown, ArrowUp, BarChart3, Clock, Box
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { unifiedInventoryService } from '../../services/inventory';
import { formatCurrency, formatDate } from '../../utils/formatters';
import UnifiedInventoryForm from './UnifiedInventoryForm';
import StockOperationModal from './StockOperationModal';

/**
 * UnifiedInventory - Single page for all inventory types using unified API
 *
 * StudioVision Philosophy: One page, multiple tabs, unified data model
 */

// Inventory type configuration with colors and fields
const INVENTORY_TYPES = {
  frame: {
    id: 'frame',
    label: 'Montures',
    shortLabel: 'Montures',
    icon: Glasses,
    color: 'pink',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-300',
    textColor: 'text-pink-700',
    activeColor: 'bg-pink-100',
    roles: ['admin', 'optician', 'ophthalmologist', 'optometrist', 'receptionist', 'manager'],
    columns: ['sku', 'name', 'brand', 'category', 'material', 'gender', 'currentStock', 'status', 'price'],
    filters: ['brand', 'category', 'material', 'gender', 'status']
  },
  optical_lens: {
    id: 'optical_lens',
    label: 'Verres Optiques',
    shortLabel: 'Verres',
    icon: Eye,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    activeColor: 'bg-blue-100',
    roles: ['admin', 'optician', 'ophthalmologist', 'optometrist', 'receptionist', 'manager'],
    columns: ['sku', 'name', 'brand', 'lensType', 'material', 'coating', 'currentStock', 'status', 'price'],
    filters: ['brand', 'lensType', 'material', 'coating', 'status']
  },
  contact_lens: {
    id: 'contact_lens',
    label: 'Lentilles Contact',
    shortLabel: 'Lentilles',
    icon: Circle,
    color: 'cyan',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-300',
    textColor: 'text-cyan-700',
    activeColor: 'bg-cyan-100',
    roles: ['admin', 'optician', 'ophthalmologist', 'optometrist', 'receptionist', 'manager'],
    columns: ['sku', 'name', 'brand', 'lensType', 'baseCurve', 'diameter', 'currentStock', 'status', 'price'],
    filters: ['brand', 'lensType', 'wearDuration', 'status']
  },
  pharmacy: {
    id: 'pharmacy',
    label: 'Pharmacie',
    shortLabel: 'Pharmacie',
    icon: Pill,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-700',
    activeColor: 'bg-green-100',
    roles: ['admin', 'pharmacist', 'doctor', 'ophthalmologist', 'nurse', 'manager'],
    columns: ['sku', 'name', 'genericName', 'dosageForm', 'strength', 'currentStock', 'expirationDate', 'status', 'price'],
    filters: ['dosageForm', 'therapeuticClass', 'requiresPrescription', 'status']
  },
  reagent: {
    id: 'reagent',
    label: 'Réactifs Labo',
    shortLabel: 'Réactifs',
    icon: FlaskConical,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
    activeColor: 'bg-purple-100',
    roles: ['admin', 'lab_technician', 'manager'],
    columns: ['sku', 'name', 'brand', 'reagentType', 'testType', 'currentStock', 'expirationDate', 'status', 'price'],
    filters: ['reagentType', 'testType', 'storageTemp', 'status']
  },
  lab_consumable: {
    id: 'lab_consumable',
    label: 'Consommables Labo',
    shortLabel: 'Consommables',
    icon: TestTube,
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    textColor: 'text-orange-700',
    activeColor: 'bg-orange-100',
    roles: ['admin', 'lab_technician', 'nurse', 'manager'],
    columns: ['sku', 'name', 'brand', 'consumableType', 'size', 'currentStock', 'expirationDate', 'status', 'price'],
    filters: ['consumableType', 'material', 'sterile', 'status']
  },
  surgical_supply: {
    id: 'surgical_supply',
    label: 'Chirurgie',
    shortLabel: 'Chirurgie',
    icon: Scissors,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    textColor: 'text-red-700',
    activeColor: 'bg-red-100',
    roles: ['admin', 'ophthalmologist', 'nurse', 'manager'],
    columns: ['sku', 'name', 'brand', 'supplyType', 'size', 'currentStock', 'expirationDate', 'status', 'price'],
    filters: ['supplyType', 'sterile', 'singleUse', 'status']
  }
};

// Column definitions for display
const COLUMN_DEFINITIONS = {
  sku: { label: 'SKU', width: 'w-24' },
  name: { label: 'Nom', width: 'w-48', sortable: true },
  brand: { label: 'Marque', width: 'w-32', sortable: true },
  category: { label: 'Catégorie', width: 'w-28' },
  material: { label: 'Matériau', width: 'w-28' },
  gender: { label: 'Genre', width: 'w-20' },
  lensType: { label: 'Type', width: 'w-28' },
  coating: { label: 'Traitement', width: 'w-28' },
  baseCurve: { label: 'BC', width: 'w-16' },
  diameter: { label: 'Dia', width: 'w-16' },
  genericName: { label: 'DCI', width: 'w-32' },
  dosageForm: { label: 'Forme', width: 'w-24' },
  strength: { label: 'Dosage', width: 'w-24' },
  reagentType: { label: 'Type', width: 'w-28' },
  testType: { label: 'Test', width: 'w-28' },
  consumableType: { label: 'Type', width: 'w-28' },
  supplyType: { label: 'Type', width: 'w-28' },
  size: { label: 'Taille', width: 'w-20' },
  currentStock: { label: 'Stock', width: 'w-20', sortable: true },
  expirationDate: { label: 'Expiration', width: 'w-28' },
  status: { label: 'Statut', width: 'w-28' },
  price: { label: 'Prix', width: 'w-24', sortable: true }
};

// Status badge component
function StatusBadge({ status }) {
  const statusStyles = {
    'in_stock': 'bg-green-100 text-green-800',
    'low_stock': 'bg-yellow-100 text-yellow-800',
    'out_of_stock': 'bg-red-100 text-red-800',
    'on_order': 'bg-blue-100 text-blue-800',
    'discontinued': 'bg-gray-100 text-gray-800',
    'expired': 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    'in_stock': 'En stock',
    'low_stock': 'Stock bas',
    'out_of_stock': 'Rupture',
    'on_order': 'En commande',
    'discontinued': 'Discontinué',
    'expired': 'Expiré'
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-600'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

// Stats card component
function StatsCard({ icon: Icon, label, value, color, subValue }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${color}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color.replace('border-', 'bg-').replace('-200', '-100')}`}>
          <Icon className={`h-5 w-5 ${color.replace('border-', 'text-').replace('-200', '-600')}`} />
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 border-b">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export default function UnifiedInventory() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active type from URL
  const urlType = searchParams.get('type');

  // Filter types based on user role
  const availableTypes = useMemo(() => {
    return Object.values(INVENTORY_TYPES).filter(type =>
      type.roles.includes(user?.role) || user?.role === 'admin'
    );
  }, [user?.role]);

  // Active type state
  const [activeType, setActiveType] = useState(() => {
    if (urlType && INVENTORY_TYPES[urlType]) {
      return urlType;
    }
    return availableTypes[0]?.id || 'frame';
  });

  // Data state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  // Search and filters
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockOperation, setStockOperation] = useState('add'); // 'add' | 'adjust'
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get current type config
  const currentType = INVENTORY_TYPES[activeType];

  // Update URL when type changes
  const handleTypeChange = (typeId) => {
    setActiveType(typeId);
    setSearchParams({ type: typeId });
    setPage(1);
    setSearch('');
    setFilters({});
  };

  // Fetch items
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        inventoryType: activeType,
        page,
        limit,
        search: search || undefined,
        sortBy,
        sortOrder,
        ...filters
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === '') {
          delete params[key];
        }
      });

      const response = await unifiedInventoryService.getAll(params);
      setItems(response?.data || []);
      setTotalPages(response?.pages || 1);
      setTotal(response?.total || 0);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Erreur lors du chargement de l\'inventaire');
    } finally {
      setLoading(false);
    }
  }, [activeType, page, limit, search, sortBy, sortOrder, filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await unifiedInventoryService.getStats({ inventoryType: activeType });
      setStats(response?.data || response);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [activeType]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await unifiedInventoryService.getAlerts({ inventoryType: activeType });
      setAlerts(response?.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [activeType]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchAlerts();
  }, [fetchStats, fetchAlerts]);

  // Fetch items when filters change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Handle item actions
  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowForm(true);
  };

  const handleAddStock = (item) => {
    setSelectedItem(item);
    setStockOperation('add');
    setShowStockModal(true);
  };

  const handleAdjustStock = (item) => {
    setSelectedItem(item);
    setStockOperation('adjust');
    setShowStockModal(true);
  };

  const handleDelete = (item) => {
    setSelectedItem(item);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await unifiedInventoryService.delete(selectedItem._id);
      toast.success('Article supprimé');
      fetchItems();
      fetchStats();
      setShowDeleteConfirm(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Handle form save
  const handleFormSave = () => {
    setShowForm(false);
    setSelectedItem(null);
    fetchItems();
    fetchStats();
    toast.success(selectedItem ? 'Article mis à jour' : 'Article ajouté');
  };

  // Handle stock operation save
  const handleStockSave = () => {
    setShowStockModal(false);
    setSelectedItem(null);
    fetchItems();
    fetchStats();
    toast.success(stockOperation === 'add' ? 'Stock ajouté' : 'Stock ajusté');
  };

  // Render cell value
  const renderCellValue = (item, column) => {
    const value = item[column];

    switch (column) {
      case 'currentStock':
        return (
          <span className={`font-medium ${value <= (item.reorderPoint || 5) ? 'text-red-600' : 'text-gray-900'}`}>
            {value || 0}
          </span>
        );
      case 'expirationDate':
        if (!value) return '-';
        const expDate = new Date(value);
        const daysUntil = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
        return (
          <span className={daysUntil <= 30 ? 'text-red-600' : daysUntil <= 90 ? 'text-yellow-600' : ''}>
            {formatDate(value)}
          </span>
        );
      case 'status':
        return <StatusBadge status={value} />;
      case 'price':
        return formatCurrency(item.pricing?.unitPrice || item.price || 0);
      case 'gender':
        const genderLabels = { male: 'H', female: 'F', unisex: 'U', child: 'E' };
        return genderLabels[value] || value || '-';
      default:
        return value || '-';
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Number keys for quick tab access
      const typeKeys = Object.keys(INVENTORY_TYPES);
      if (e.key >= '1' && e.key <= String(typeKeys.length)) {
        const index = parseInt(e.key) - 1;
        if (index < availableTypes.length) {
          handleTypeChange(availableTypes[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [availableTypes]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Gestion des Stocks</h1>
                <p className="text-sm text-gray-500">
                  Inventaire unifié - {total} articles
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {alerts.length > 0 && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">{alerts.length} alertes</span>
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
              <button
                onClick={() => {
                  fetchItems();
                  fetchStats();
                  fetchAlerts();
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Type Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {availableTypes.map((type, index) => {
              const Icon = type.icon;
              const isActive = activeType === type.id;

              return (
                <button
                  key={type.id}
                  onClick={() => handleTypeChange(type.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-t-lg border-b-2 transition-all whitespace-nowrap
                    ${isActive
                      ? `${type.activeColor} ${type.borderColor} ${type.textColor}`
                      : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
                    }
                  `}
                  title={`${type.label} (${index + 1})`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? type.textColor : 'text-gray-500'}`} />
                  <span className="font-medium">{type.shortLabel}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${isActive ? 'bg-white/50' : 'bg-gray-200'}`}>
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${currentType?.bgColor || 'bg-white'} min-h-[calc(100vh-140px)]`}>
        <div className="max-w-full mx-auto px-4 py-4">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard
                icon={Box}
                label="Total Articles"
                value={stats.totalItems || 0}
                color="border-blue-200"
              />
              <StatsCard
                icon={DollarSign}
                label="Valeur Stock"
                value={formatCurrency(stats.totalValue || 0)}
                color="border-green-200"
              />
              <StatsCard
                icon={TrendingDown}
                label="Stock Bas"
                value={stats.lowStockCount || 0}
                color="border-yellow-200"
              />
              <StatsCard
                icon={Clock}
                label="Expirant (30j)"
                value={stats.expiringCount || 0}
                color="border-red-200"
              />
            </div>
          )}

          {/* Search and Filters */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, SKU, marque..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous statuts</option>
                <option value="in_stock">En stock</option>
                <option value="low_stock">Stock bas</option>
                <option value="out_of_stock">Rupture</option>
                <option value="on_order">En commande</option>
              </select>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.inStockOnly || false}
                  onChange={(e) => setFilters({ ...filters, inStockOnly: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">En stock uniquement</span>
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {currentType?.columns.map((column) => {
                      const colDef = COLUMN_DEFINITIONS[column];
                      return (
                        <th
                          key={column}
                          className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${colDef?.width || ''} ${colDef?.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                          onClick={() => colDef?.sortable && handleSort(column)}
                        >
                          <div className="flex items-center gap-1">
                            {colDef?.label || column}
                            {colDef?.sortable && (
                              <span className="text-gray-400">
                                {sortBy === column ? (
                                  sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                ) : (
                                  <ArrowUpDown className="h-3 w-3" />
                                )}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={currentType?.columns.length + 1} className="px-4 py-8">
                        <TableSkeleton />
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={currentType?.columns.length + 1} className="px-4 py-12 text-center text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Aucun article trouvé</p>
                        <button
                          onClick={() => {
                            setSelectedItem(null);
                            setShowForm(true);
                          }}
                          className="mt-4 text-blue-600 hover:text-blue-700"
                        >
                          Ajouter un article
                        </button>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50">
                        {currentType?.columns.map((column) => (
                          <td key={column} className="px-4 py-3 text-sm text-gray-900">
                            {renderCellValue(item, column)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleAddStock(item)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Recevoir stock"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAdjustStock(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Ajuster stock"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
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
              <div className="px-4 py-3 border-t flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Page {page} sur {totalPages} ({total} articles)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
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
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-75">
        <span className="text-gray-400">Raccourcis:</span> 1-{availableTypes.length} tabs
      </div>

      {/* Item Form Modal */}
      {showForm && (
        <UnifiedInventoryForm
          inventoryType={activeType}
          item={selectedItem}
          onClose={() => {
            setShowForm(false);
            setSelectedItem(null);
          }}
          onSave={handleFormSave}
        />
      )}

      {/* Stock Operation Modal */}
      {showStockModal && selectedItem && (
        <StockOperationModal
          item={selectedItem}
          operation={stockOperation}
          inventoryType={activeType}
          onClose={() => {
            setShowStockModal(false);
            setSelectedItem(null);
          }}
          onSave={handleStockSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Confirmer la suppression
            </h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer <strong>{selectedItem.name}</strong> ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedItem(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
