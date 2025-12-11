import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Play,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'react-toastify';
import stockReconciliationService from '../../services/stockReconciliationService';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800', icon: Play },
  pending_review: { label: 'À valider', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  adjustments_applied: { label: 'Ajusté', color: 'bg-orange-100 text-orange-800', icon: CheckCircle },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
};

const INVENTORY_TYPES = [
  { value: 'all', label: 'Tous les types' },
  { value: 'pharmacy', label: 'Pharmacie' },
  { value: 'frame', label: 'Montures' },
  { value: 'contactLens', label: 'Lentilles' },
  { value: 'opticalLens', label: 'Verres optiques' },
  { value: 'reagent', label: 'Réactifs' },
  { value: 'labConsumable', label: 'Consommables labo' }
];

export default function StockReconciliation() {
  const navigate = useNavigate();
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    inventoryType: 'all'
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    loadReconciliations();
    loadStats();
  }, [filters]);

  const loadReconciliations = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 20,
        ...filters
      };
      if (params.status === 'all') delete params.status;
      if (params.inventoryType === 'all') delete params.inventoryType;

      const response = await stockReconciliationService.getAll(params);
      setReconciliations(response.data || []);
      setPagination({
        page: response.page || 1,
        pages: response.pages || 1,
        total: response.total || 0
      });
    } catch (error) {
      toast.error('Erreur lors du chargement des inventaires');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await stockReconciliationService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleStartReconciliation = async (id) => {
    try {
      await stockReconciliationService.start(id);
      toast.success('Inventaire démarré');
      loadReconciliations();
      loadStats();
    } catch (error) {
      toast.error('Erreur lors du démarrage');
      console.error(error);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire Physique</h1>
          <p className="text-gray-500 mt-1">Réconciliation des stocks</p>
        </div>
        <button
          onClick={() => navigate('/stock-reconciliation/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Nouvel Inventaire
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Inventaires</p>
                <p className="text-xl font-bold">{stats.totalReconciliations}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Play className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">En Cours</p>
                <p className="text-xl font-bold">{stats.inProgress}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">À Valider</p>
                <p className="text-xl font-bold">{stats.pendingReview}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Précision Moyenne</p>
                <p className="text-xl font-bold">{formatPercent(stats.averageAccuracy)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border mb-6">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select
            value={filters.inventoryType}
            onChange={(e) => setFilters({ ...filters, inventoryType: e.target.value })}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {INVENTORY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button
            onClick={loadReconciliations}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Reconciliations Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : reconciliations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun inventaire trouvé</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Inventaire</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Articles</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Précision</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Écart</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reconciliations.map((recon) => {
                const statusConfig = STATUS_CONFIG[recon.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const netVariance = recon.summary?.netVariance || 0;
                return (
                  <tr key={recon._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{recon.reconciliationNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 capitalize">{recon.inventoryType}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(recon.reconciliationDate)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{recon.summary?.totalItems || 0}</span>
                      <span className="text-gray-500"> articles</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (recon.summary?.accuracyRate || 0) >= 98 ? 'bg-green-500' :
                              (recon.summary?.accuracyRate || 0) >= 95 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(recon.summary?.accuracyRate || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {formatPercent(recon.summary?.accuracyRate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-sm font-medium ${
                        netVariance > 0 ? 'text-green-600' :
                        netVariance < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {netVariance > 0 ? <TrendingUp className="w-4 h-4" /> :
                         netVariance < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                        {netVariance > 0 ? '+' : ''}{netVariance}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/stock-reconciliation/${recon._id}`)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {recon.status === 'pending' && (
                          <button
                            onClick={() => handleStartReconciliation(recon._id)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Démarrer
                          </button>
                        )}
                        {recon.status === 'in_progress' && (
                          <button
                            onClick={() => navigate(`/stock-reconciliation/${recon._id}/count`)}
                            className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                          >
                            Continuer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {pagination.total} inventaire(s) trouvé(s)
            </p>
            <div className="flex gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setPagination({ ...pagination, page })}
                  className={`px-3 py-1 rounded ${
                    page === pagination.page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
