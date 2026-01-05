import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Pill, Plus, Package, TrendingDown, Calendar, Loader2, X, ClipboardList
} from 'lucide-react';

// Lazy load tab content
const PrescriptionQueueContent = lazy(() => import('../PrescriptionQueue'));
import api from '../../services/apiConfig';
import { CollapsibleSectionGroup } from '../../components/CollapsibleSection';
import PermissionGate from '../../components/PermissionGate';
import { useClinic } from '../../contexts/ClinicContext';
import logger from '../../services/logger';

// Import sections
import {
  PharmacyAlertsSection,
  PharmacyLowStockSection,
  PharmacyExpiringSection,
  PharmacyInventorySection
} from './sections';

/**
 * PharmacyDashboard - Consolidated single-page pharmacy management
 */
export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedClinicId } = useClinic();
  const [loading, setLoading] = useState(true);

  // Tab state from URL
  const activeTab = searchParams.get('tab') || 'inventory';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    expiringSoon: 0,
    totalValue: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Adjust stock modal
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [adjustment, setAdjustment] = useState({
    type: 'received',
    quantity: 0,
    notes: '',
    lotNumber: ''
  });

  const categories = [
    { value: 'all', label: 'Toutes catégories' },
    { value: 'vitamin', label: 'Vitamines' },
    { value: 'antibiotic', label: 'Antibiotiques' },
    { value: 'anti-inflammatory', label: 'Anti-inflammatoires' },
    { value: 'antihistamine', label: 'Antihistaminiques' },
    { value: 'supplement', label: 'Suppléments' },
    { value: 'antiviral', label: 'Antiviraux' },
    { value: 'antifungal', label: 'Antifongiques' },
    { value: 'other', label: 'Autres (Ophtalmique)' }
  ];

  const statuses = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'in-stock', label: 'En stock' },
    { value: 'low-stock', label: 'Stock faible' },
    { value: 'out-of-stock', label: 'Rupture de stock' },
    { value: 'on-order', label: 'En commande' }
  ];

  // Re-fetch when clinic changes (using selectedClinicId for reliable comparison)
  useEffect(() => {
    setLoading(true);
    fetchStats();
    fetchAlerts();
    // Increment refresh key to trigger child component re-fetches
    setRefreshKey(prev => prev + 1);
  }, [selectedClinicId]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/pharmacy/stats');
      // API returns { success, data: { totalItems, lowStock, ... }, meta }
      const statsData = response.data?.data || response.data;
      setStats({
        totalItems: statsData.totalItems || 0,
        lowStock: statsData.lowStock || 0,
        expiringSoon: statsData.expiringSoon || 0,
        totalValue: statsData.totalValue || 0
      });
    } catch (err) {
      logger.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/pharmacy/alerts');
      // Handle various API response formats defensively
      const alertsData = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setAlerts(alertsData);
    } catch (err) {
      logger.error('Error fetching alerts:', err);
      setAlerts([]);
    }
  };

  const handleAdjustStock = (medication) => {
    setSelectedMedication(medication);
    setAdjustment({
      type: 'received',
      quantity: 0,
      notes: '',
      lotNumber: ''
    });
    setAdjustDialog(true);
  };

  const handleSubmitAdjustment = async () => {
    try {
      await api.post(`/pharmacy/inventory/${selectedMedication._id}/adjust`, adjustment);
      setAdjustDialog(false);
      fetchStats();
      fetchAlerts();
    } catch (err) {
      logger.error('Error adjusting stock:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement de la pharmacie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Pill className="h-8 w-8 text-blue-600" />
            Inventaire Pharmacie
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des stocks et approvisionnement
          </p>
        </div>
        <PermissionGate permission="manage_inventory">
          <button
            onClick={() => navigate('/pharmacy/new')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            <span>Ajouter un médicament</span>
          </button>
        </PermissionGate>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="h-5 w-5" />
            Inventaire
          </button>
          <button
            onClick={() => setActiveTab('prescriptions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'prescriptions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="h-5 w-5" />
            Ordonnances
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'prescriptions' && (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>}>
          <PrescriptionQueueContent />
        </Suspense>
      )}

      {activeTab === 'inventory' && (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total articles</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
            </div>
            <Package className="h-10 w-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stock faible</p>
              <p className="text-2xl font-bold text-orange-600">{stats.lowStock}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-orange-200" />
          </div>
        </div>

        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expire bientôt</p>
              <p className="text-2xl font-bold text-red-600">{stats.expiringSoon}</p>
            </div>
            <Calendar className="h-10 w-10 text-red-200" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Valeur totale</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.totalValue ? `${stats.totalValue.toLocaleString()} CFA` : '0 CFA'}
              </p>
            </div>
            <Package className="h-10 w-10 text-green-200" />
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <CollapsibleSectionGroup>
        {alerts.length > 0 && (
          <PharmacyAlertsSection alerts={alerts} />
        )}

        <PharmacyLowStockSection
          lowStockCount={stats.lowStock}
          onAdjustStock={handleAdjustStock}
          onRefresh={fetchStats}
          refreshKey={refreshKey}
        />

        <PharmacyExpiringSection
          expiringCount={stats.expiringSoon}
          onAdjustStock={handleAdjustStock}
          refreshKey={refreshKey}
        />

        <PharmacyInventorySection
          totalItems={stats.totalItems}
          categories={categories}
          statuses={statuses}
          onAdjustStock={handleAdjustStock}
          refreshKey={refreshKey}
        />
      </CollapsibleSectionGroup>
      </>
      )}

      {/* Adjust Stock Dialog */}
      {adjustDialog && selectedMedication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Ajuster le stock</h2>
              <button
                onClick={() => setAdjustDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Médicament</p>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedMedication.medication?.brandName ||
                   selectedMedication.medication?.genericName ||
                   selectedMedication.name}
                </p>
                <p className="text-sm text-gray-500">
                  Stock actuel: {selectedMedication.inventory?.currentStock || 0}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'ajustement
                </label>
                <select
                  value={adjustment.type}
                  onChange={(e) => setAdjustment({ ...adjustment, type: e.target.value })}
                  className="input"
                >
                  <option value="received">Réception</option>
                  <option value="dispensed">Délivrance</option>
                  <option value="damaged">Endommagé</option>
                  <option value="expired">Expiré</option>
                  <option value="returned">Retour</option>
                  <option value="correction">Correction d'inventaire</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité
                </label>
                <input
                  type="number"
                  value={adjustment.quantity}
                  onChange={(e) => setAdjustment({ ...adjustment, quantity: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de lot
                </label>
                <input
                  type="text"
                  value={adjustment.lotNumber}
                  onChange={(e) => setAdjustment({ ...adjustment, lotNumber: e.target.value })}
                  className="input"
                  placeholder="LOT123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={adjustment.notes}
                  onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
                  className="input"
                  rows="3"
                  placeholder="Informations complémentaires..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setAdjustDialog(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitAdjustment}
                className="btn btn-primary"
                disabled={adjustment.quantity === 0}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
