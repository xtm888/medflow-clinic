import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/apiConfig';
import {
  Search,
  Plus,
  AlertTriangle,
  TrendingDown,
  Calendar,
  Package,
  Edit,
  Pill,
  X
} from 'lucide-react';

const PharmacyDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    expiringSoon: 0,
    totalValue: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [adjustment, setAdjustment] = useState({
    type: 'received',
    quantity: 0,
    notes: '',
    lotNumber: ''
  });

  const categories = [
    { value: 'all', label: 'Toutes les catégories' },
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

  useEffect(() => {
    fetchMedications();
    fetchStats();
    fetchAlerts();
  }, [page, rowsPerPage, searchTerm, categoryFilter, statusFilter, tabValue]);

  const fetchMedications = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      let endpoint = '/pharmacy/inventory';
      if (tabValue === 1) {
        endpoint = '/pharmacy/low-stock';
      } else if (tabValue === 2) {
        endpoint = '/pharmacy/expiring';
        params.days = 30;
      }

      const response = await api.get(endpoint, { params });
      setMedications(response.data.data || []);
      setTotalCount(response.data.total || 0);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching medications:', err);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/pharmacy/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/pharmacy/alerts');
      setAlerts(response.data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setPage(0);
  };

  const handleCategoryChange = (value) => {
    setCategoryFilter(value);
    setPage(0);
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(0);
  };

  const handleTabChange = (newValue) => {
    setTabValue(newValue);
    setPage(0);
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
      fetchMedications();
      fetchStats();
      fetchAlerts();
    } catch (err) {
      console.error('Error adjusting stock:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'in-stock': 'badge-success',
      'low-stock': 'badge-warning',
      'out-of-stock': 'badge-danger',
      'overstocked': 'badge-info',
      'on-order': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'in-stock': 'En stock',
      'low-stock': 'Stock faible',
      'out-of-stock': 'Rupture',
      'overstocked': 'Surstock',
      'on-order': 'En commande'
    };
    return labels[status] || status;
  };

  const getDaysToExpiry = (expirationDate) => {
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diff = expiry - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getEarliestExpiry = (batches) => {
    if (!batches || batches.length === 0) return null;

    const activeBatches = batches.filter(b => b.status === 'active' && b.quantity > 0);
    if (activeBatches.length === 0) return null;

    return activeBatches.reduce((earliest, batch) => {
      return new Date(batch.expirationDate) < new Date(earliest.expirationDate) ? batch : earliest;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Pill className="h-8 w-8 mr-2 text-primary-600" />
            Inventaire Pharmacie
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des stocks et approvisionnement
          </p>
        </div>
        <button
          onClick={() => navigate('/pharmacy-inventory/new')}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Ajouter un médicament</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total d'articles</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalItems}</p>
            </div>
            <Package className="h-12 w-12 text-primary-600 opacity-30" />
          </div>
        </div>

        <div className="card bg-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stock faible</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.lowStock}</p>
            </div>
            <TrendingDown className="h-12 w-12 text-orange-600 opacity-30" />
          </div>
        </div>

        <div className="card bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expire bientôt</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.expiringSoon}</p>
            </div>
            <Calendar className="h-12 w-12 text-red-600 opacity-30" />
          </div>
        </div>

        <div className="card bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Valeur totale</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats.totalValue ? `$${stats.totalValue.toLocaleString()}` : '$0'}
              </p>
            </div>
            <Package className="h-12 w-12 text-green-600 opacity-30" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 p-4 rounded-lg border ${
                alert.type === 'error' ? 'bg-red-50 border-red-200' :
                alert.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                alert.type === 'error' ? 'text-red-600' :
                alert.type === 'warning' ? 'text-orange-600' :
                'text-blue-600'
              }`} />
              <p className={`text-sm ${
                alert.type === 'error' ? 'text-red-800' :
                alert.type === 'warning' ? 'text-orange-800' :
                'text-blue-800'
              }`}>
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="card p-0">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => handleTabChange(0)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabValue === 0
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tous les médicaments
            </button>
            <button
              onClick={() => handleTabChange(1)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                tabValue === 1
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Stock faible</span>
              {stats.lowStock > 0 && (
                <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {stats.lowStock}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange(2)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                tabValue === 2
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>Expire bientôt</span>
              {stats.expiringSoon > 0 && (
                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {stats.expiringSoon}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, code..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="input"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="input"
            >
              {statuses.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médicament
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix unitaire
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : medications.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    Aucun médicament trouvé
                  </td>
                </tr>
              ) : (
                medications.map((medication) => {
                  const earliestBatch = getEarliestExpiry(medication.batches);
                  const daysToExpiry = earliestBatch ? getDaysToExpiry(earliestBatch.expirationDate) : null;

                  return (
                    <tr
                      key={medication._id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/pharmacy-inventory/${medication._id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <Pill className="h-5 w-5 text-primary-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{medication.medication?.brandName || medication.medication?.genericName}</div>
                            <div className="text-sm text-gray-500">{medication.medication?.genericName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="badge badge-info">
                          {medication.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{medication.inventory?.currentStock || 0}</div>
                        <div className="text-xs text-gray-500">
                          Min: {medication.inventory?.reorderPoint || 0} | Max: {medication.inventory?.maximumStock || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${getStatusColor(medication.inventory?.status || 'in-stock')}`}>
                          {getStatusLabel(medication.inventory?.status || 'in-stock')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {earliestBatch ? (
                          <div>
                            <div className={`text-sm ${
                              daysToExpiry < 30 ? 'text-red-600 font-semibold' :
                              daysToExpiry < 90 ? 'text-orange-600' :
                              'text-gray-900'
                            }`}>
                              {new Date(earliestBatch.expirationDate).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {daysToExpiry} jours restants
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {medication.pricing?.sellingPrice ? `${medication.pricing.sellingPrice.toLocaleString('fr-FR')} CFA` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustStock(medication);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Affichage de {page * rowsPerPage + 1} à {Math.min((page + 1) * rowsPerPage, totalCount)} sur {totalCount} résultats
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * rowsPerPage >= totalCount}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* Adjust Stock Dialog */}
      {adjustDialog && (
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
                <p className="text-lg font-semibold text-gray-900">{selectedMedication?.name}</p>
                <p className="text-sm text-gray-500">Stock actuel: {selectedMedication?.currentStock}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'ajustement</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                <input
                  type="number"
                  value={adjustment.quantity}
                  onChange={(e) => setAdjustment({ ...adjustment, quantity: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de lot</label>
                <input
                  type="text"
                  value={adjustment.lotNumber}
                  onChange={(e) => setAdjustment({ ...adjustment, lotNumber: e.target.value })}
                  className="input"
                  placeholder="LOT123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={adjustment.notes}
                  onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
                  className="input"
                  rows="3"
                  placeholder="Informations complémentaires..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end space-x-3">
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
};

export default PharmacyDashboard;
