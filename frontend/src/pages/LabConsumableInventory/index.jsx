import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Eye,
  TrendingDown,
  Box,
  Filter,
  RefreshCw,
  TestTube,
  Droplet,
  Activity,
  BarChart3,
  Clock,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import labConsumableInventoryService from '../../services/labConsumableInventoryService';

// Tube color map for visual display
const TUBE_COLORS = {
  'edta-purple': { bg: '#8B5CF6', label: 'EDTA (Violet)' },
  'heparin-green': { bg: '#10B981', label: 'Héparine (Vert)' },
  'sst-gold': { bg: '#F59E0B', label: 'SST (Or)' },
  'citrate-blue': { bg: '#3B82F6', label: 'Citrate (Bleu)' },
  'fluoride-gray': { bg: '#6B7280', label: 'Fluorure (Gris)' },
  'plain-red': { bg: '#EF4444', label: 'Sec (Rouge)' },
  'edta-pink': { bg: '#EC4899', label: 'EDTA (Rose)' },
  'acd-yellow': { bg: '#FCD34D', label: 'ACD (Jaune)' },
  'trace-royal-blue': { bg: '#1E40AF', label: 'Trace (Bleu Royal)' },
  'other': { bg: '#9CA3AF', label: 'Autre' }
};

// Stats Card Component
const StatsCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('600', '100')}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
    {trend && (
      <div className="mt-2 flex items-center text-xs">
        {trend > 0 ? (
          <ChevronUp className="w-4 h-4 text-green-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-red-500" />
        )}
        <span className={trend > 0 ? 'text-green-500' : 'text-red-500'}>
          {Math.abs(trend)}% vs mois dernier
        </span>
      </div>
    )}
  </div>
);

// Alert Banner Component
const AlertBanner = ({ alerts, onDismiss }) => {
  if (!alerts || alerts.length === 0) return null;

  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
  if (criticalAlerts.length === 0) return null;

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
      <div className="flex items-start">
        <AlertTriangle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-red-800 font-medium">Alertes Critiques ({criticalAlerts.length})</h3>
          <ul className="mt-2 text-sm text-red-700">
            {criticalAlerts.slice(0, 3).map((alert, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span>• {alert.message}</span>
              </li>
            ))}
          </ul>
          {criticalAlerts.length > 3 && (
            <p className="text-xs text-red-600 mt-1">
              Et {criticalAlerts.length - 3} autres alertes...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Tube Color Badge Component
const TubeColorBadge = ({ tubeType }) => {
  const tubeInfo = TUBE_COLORS[tubeType] || TUBE_COLORS.other;
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-4 h-4 rounded-full border border-gray-300"
        style={{ backgroundColor: tubeInfo.bg }}
      />
      <span className="text-sm">{tubeInfo.label}</span>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'in-stock': { color: 'bg-green-100 text-green-800', label: 'En stock' },
    'low-stock': { color: 'bg-yellow-100 text-yellow-800', label: 'Stock bas' },
    'out-of-stock': { color: 'bg-red-100 text-red-800', label: 'Rupture' },
    'discontinued': { color: 'bg-gray-100 text-gray-800', label: 'Discontinué' },
    'on-order': { color: 'bg-blue-100 text-blue-800', label: 'En commande' }
  };

  const config = statusConfig[status] || statusConfig['in-stock'];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// Add/Edit Consumable Modal
const ConsumableFormModal = ({ isOpen, onClose, consumable, onSave }) => {
  const categories = labConsumableInventoryService.getCategories();
  const tubeTypes = labConsumableInventoryService.getTubeTypes();

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'collection-tube',
    tubeType: '',
    description: '',
    unit: 'unité',
    unitsPerPackage: 1,
    minimumStock: 10,
    reorderPoint: 20,
    pricing: {
      costPrice: 0,
      sellingPrice: 0,
      currency: 'CDF'
    },
    storageRequirements: '',
    notes: ''
  });

  useEffect(() => {
    if (consumable) {
      setFormData({
        name: consumable.name || '',
        sku: consumable.sku || '',
        barcode: consumable.barcode || '',
        category: consumable.category || 'collection-tube',
        tubeType: consumable.tubeType || '',
        description: consumable.description || '',
        unit: consumable.unit || 'unité',
        unitsPerPackage: consumable.unitsPerPackage || 1,
        minimumStock: consumable.minimumStock || 10,
        reorderPoint: consumable.reorderPoint || 20,
        pricing: consumable.pricing || { costPrice: 0, sellingPrice: 0, currency: 'CDF' },
        storageRequirements: consumable.storageRequirements || '',
        notes: consumable.notes || ''
      });
    }
  }, [consumable]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b bg-teal-600 text-white rounded-t-lg">
          <h2 className="text-lg font-semibold">
            {consumable ? 'Modifier le Consommable' : 'Nouveau Consommable'}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU *
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code-barres
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                required
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.category === 'collection-tube' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de Tube
              </label>
              <select
                value={formData.tubeType}
                onChange={(e) => setFormData({ ...formData, tubeType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Sélectionner...</option>
                {tubeTypes.map(tube => (
                  <option key={tube.value} value={tube.value}>
                    {tube.label} - {tube.usage}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unité
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock minimum
              </label>
              <input
                type="number"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seuil de réapprovisionnement
              </label>
              <input
                type="number"
                value={formData.reorderPoint}
                onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix d'achat (CDF)
              </label>
              <input
                type="number"
                value={formData.pricing.costPrice}
                onChange={(e) => setFormData({
                  ...formData,
                  pricing: { ...formData.pricing, costPrice: parseFloat(e.target.value) }
                })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix de vente (CDF)
              </label>
              <input
                type="number"
                value={formData.pricing.sellingPrice}
                onChange={(e) => setFormData({
                  ...formData,
                  pricing: { ...formData.pricing, sellingPrice: parseFloat(e.target.value) }
                })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conditions de stockage
            </label>
            <input
              type="text"
              value={formData.storageRequirements}
              onChange={(e) => setFormData({ ...formData, storageRequirements: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Température ambiante, à l'abri de la lumière"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              {consumable ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Batch Modal
const BatchFormModal = ({ isOpen, onClose, consumable, onSave }) => {
  const [formData, setFormData] = useState({
    lotNumber: '',
    quantity: 1,
    receivedDate: new Date().toISOString().split('T')[0],
    supplier: {
      name: '',
      contact: '',
      reference: ''
    },
    cost: {
      unitCost: 0,
      currency: 'CDF'
    },
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b bg-teal-600 text-white rounded-t-lg">
          <h2 className="text-lg font-semibold">
            Réception de Stock - {consumable?.name}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N° de Lot *
              </label>
              <input
                type="text"
                value={formData.lotNumber}
                onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                min="1"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de réception
            </label>
            <input
              type="date"
              value={formData.receivedDate}
              onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Fournisseur</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom</label>
                <input
                  type="text"
                  value={formData.supplier.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    supplier: { ...formData.supplier, name: e.target.value }
                  })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Référence</label>
                <input
                  type="text"
                  value={formData.supplier.reference}
                  onChange={(e) => setFormData({
                    ...formData,
                    supplier: { ...formData.supplier, reference: e.target.value }
                  })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coût unitaire (CDF)
              </label>
              <input
                type="number"
                value={formData.cost.unitCost}
                onChange={(e) => setFormData({
                  ...formData,
                  cost: { ...formData.cost, unitCost: parseFloat(e.target.value) }
                })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coût total
              </label>
              <input
                type="text"
                value={`${(formData.quantity * formData.cost.unitCost).toLocaleString()} CDF`}
                className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                disabled
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Recevoir le stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Consume Modal
const ConsumeFormModal = ({ isOpen, onClose, consumable, onSave }) => {
  const [formData, setFormData] = useState({
    quantity: 1,
    lotNumber: '',
    reason: 'patient',
    patientId: '',
    notes: ''
  });

  useEffect(() => {
    if (consumable && consumable.batches && consumable.batches.length > 0) {
      const activeBatch = consumable.batches.find(b => b.status === 'active' && b.quantity > 0);
      if (activeBatch) {
        setFormData(prev => ({ ...prev, lotNumber: activeBatch.lotNumber }));
      }
    }
  }, [consumable]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };

  if (!isOpen) return null;

  const activeBatches = consumable?.batches?.filter(b => b.status === 'active' && b.quantity > 0) || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b bg-orange-600 text-white rounded-t-lg">
          <h2 className="text-lg font-semibold">
            Consommer - {consumable?.name}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              Stock disponible: <span className="font-bold text-gray-900">{consumable?.currentStock || 0}</span> {consumable?.unit}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
                min="1"
                max={consumable?.currentStock || 1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lot
              </label>
              <select
                value={formData.lotNumber}
                onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Auto (FIFO)</option>
                {activeBatches.map(batch => (
                  <option key={batch.lotNumber} value={batch.lotNumber}>
                    {batch.lotNumber} ({batch.quantity} disponibles)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raison
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
            >
              <option value="patient">Prélèvement patient</option>
              <option value="internal">Usage interne</option>
              <option value="waste">Déchet/Perte</option>
              <option value="damaged">Endommagé</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
              rows={2}
              placeholder="Ex: ID patient, numéro d'échantillon..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Consommer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
const LabConsumableInventory = () => {
  const navigate = useNavigate();
  const [consumables, setConsumables] = useState([]);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [selectedConsumable, setSelectedConsumable] = useState(null);

  const categories = labConsumableInventoryService.getCategories();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;

      const [consumablesRes, statsRes, alertsRes] = await Promise.all([
        labConsumableInventoryService.getConsumables(params),
        labConsumableInventoryService.getStats(),
        labConsumableInventoryService.getAlerts()
      ]);

      setConsumables(consumablesRes.data || consumablesRes.consumables || consumablesRes || []);
      setStats(statsRes.data || statsRes);
      setAlerts(alertsRes.data || alertsRes.alerts || alertsRes || []);
    } catch (err) {
      console.error('Error fetching consumables:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateConsumable = async (data) => {
    try {
      await labConsumableInventoryService.createConsumable(data);
      setShowConsumableModal(false);
      setSelectedConsumable(null);
      fetchData();
    } catch (err) {
      console.error('Error creating consumable:', err);
      alert('Erreur lors de la création');
    }
  };

  const handleUpdateConsumable = async (data) => {
    try {
      await labConsumableInventoryService.updateConsumable(selectedConsumable._id, data);
      setShowConsumableModal(false);
      setSelectedConsumable(null);
      fetchData();
    } catch (err) {
      console.error('Error updating consumable:', err);
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleAddBatch = async (data) => {
    try {
      await labConsumableInventoryService.addBatch(selectedConsumable._id, data);
      setShowBatchModal(false);
      setSelectedConsumable(null);
      fetchData();
    } catch (err) {
      console.error('Error adding batch:', err);
      alert('Erreur lors de l\'ajout du lot');
    }
  };

  const handleConsume = async (data) => {
    try {
      await labConsumableInventoryService.consumeItem(selectedConsumable._id, data);
      setShowConsumeModal(false);
      setSelectedConsumable(null);
      fetchData();
    } catch (err) {
      console.error('Error consuming:', err);
      alert('Erreur lors de la consommation');
    }
  };

  const handleDeleteConsumable = async (consumable) => {
    if (!window.confirm(`Supprimer ${consumable.name} ?`)) return;
    try {
      await labConsumableInventoryService.deleteConsumable(consumable._id);
      fetchData();
    } catch (err) {
      console.error('Error deleting consumable:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const getCategoryLabel = (value) => {
    const cat = categories.find(c => c.value === value);
    return cat ? cat.label : value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-teal-600" />
            Inventaire Consommables Laboratoire
          </h1>
          <p className="text-gray-500 mt-1">
            Gestion des tubes, aiguilles, et autres consommables
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={() => {
              setSelectedConsumable(null);
              setShowConsumableModal(true);
            }}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouveau Consommable
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={alerts} />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Articles"
            value={stats.totalItems || 0}
            subtitle={`${stats.activeItems || 0} actifs`}
            icon={Box}
            color="text-teal-600"
          />
          <StatsCard
            title="Stock Bas"
            value={stats.lowStockCount || 0}
            subtitle="À réapprovisionner"
            icon={TrendingDown}
            color="text-yellow-600"
          />
          <StatsCard
            title="Ruptures"
            value={stats.outOfStockCount || 0}
            subtitle="En attente"
            icon={XCircle}
            color="text-red-600"
          />
          <StatsCard
            title="Valeur Stock"
            value={`${(stats.totalValue || 0).toLocaleString()} CDF`}
            subtitle="Valeur totale"
            icon={BarChart3}
            color="text-blue-600"
          />
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, SKU, code-barres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilters ? 'bg-teal-50 border-teal-500' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filtres
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Toutes les catégories</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Tous les statuts</option>
                <option value="in-stock">En stock</option>
                <option value="low-stock">Stock bas</option>
                <option value="out-of-stock">Rupture</option>
                <option value="on-order">En commande</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setCategoryFilter('');
                  setStatusFilter('');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Article
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Catégorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type Tube
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {consumables.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucun consommable trouvé</p>
                  <button
                    onClick={() => {
                      setSelectedConsumable(null);
                      setShowConsumableModal(true);
                    }}
                    className="mt-4 text-teal-600 hover:text-teal-700"
                  >
                    Ajouter un consommable
                  </button>
                </td>
              </tr>
            ) : (
              consumables.map((consumable) => (
                <tr key={consumable._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{consumable.name}</div>
                      <div className="text-sm text-gray-500">SKU: {consumable.sku}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {getCategoryLabel(consumable.category)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {consumable.category === 'collection-tube' && consumable.tubeType ? (
                      <TubeColorBadge tubeType={consumable.tubeType} />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <span className={`font-bold ${
                        consumable.currentStock <= 0 ? 'text-red-600' :
                        consumable.currentStock <= consumable.minimumStock ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {consumable.currentStock || 0}
                      </span>
                      <span className="text-gray-400"> / min: {consumable.minimumStock}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={consumable.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {consumable.pricing?.sellingPrice?.toLocaleString() || 0} CDF
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedConsumable(consumable);
                          setShowBatchModal(true);
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Recevoir stock"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedConsumable(consumable);
                          setShowConsumeModal(true);
                        }}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                        title="Consommer"
                        disabled={consumable.currentStock <= 0}
                      >
                        <Droplet className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedConsumable(consumable);
                          setShowConsumableModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteConsumable(consumable)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Supprimer"
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

      {/* Modals */}
      <ConsumableFormModal
        isOpen={showConsumableModal}
        onClose={() => {
          setShowConsumableModal(false);
          setSelectedConsumable(null);
        }}
        consumable={selectedConsumable}
        onSave={selectedConsumable ? handleUpdateConsumable : handleCreateConsumable}
      />

      <BatchFormModal
        isOpen={showBatchModal}
        onClose={() => {
          setShowBatchModal(false);
          setSelectedConsumable(null);
        }}
        consumable={selectedConsumable}
        onSave={handleAddBatch}
      />

      <ConsumeFormModal
        isOpen={showConsumeModal}
        onClose={() => {
          setShowConsumeModal(false);
          setSelectedConsumable(null);
        }}
        consumable={selectedConsumable}
        onSave={handleConsume}
      />
    </div>
  );
};

export default LabConsumableInventory;
