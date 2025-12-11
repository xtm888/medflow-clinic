import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  User,
  Phone,
  Package
} from 'lucide-react';
import { toast } from 'react-toastify';
import repairService from '../../services/repairService';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_CONFIG = {
  received: { label: 'Reçu', color: 'bg-blue-100 text-blue-800', icon: Package },
  inspecting: { label: 'Inspection', color: 'bg-purple-100 text-purple-800', icon: Eye },
  waiting_approval: { label: 'Attente approbation', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  in_repair: { label: 'En réparation', color: 'bg-orange-100 text-orange-800', icon: Wrench },
  quality_check: { label: 'Contrôle qualité', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  ready_pickup: { label: 'Prêt', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  completed: { label: 'Terminé', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
};

const PRIORITY_CONFIG = {
  low: { label: 'Basse', color: 'text-gray-600' },
  normal: { label: 'Normale', color: 'text-blue-600' },
  high: { label: 'Haute', color: 'text-orange-600' },
  urgent: { label: 'Urgente', color: 'text-red-600' }
};

const ITEM_TYPES = [
  { value: 'all', label: 'Tous les types' },
  { value: 'glasses', label: 'Lunettes' },
  { value: 'frame', label: 'Montures' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'device', label: 'Appareil' }
];

export default function RepairTracking() {
  const navigate = useNavigate();
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    itemType: 'all'
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    loadRepairs();
    loadStats();
  }, [filters]);

  const loadRepairs = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 20,
        ...filters
      };
      if (params.status === 'all') delete params.status;
      if (params.priority === 'all') delete params.priority;
      if (params.itemType === 'all') delete params.itemType;

      const response = await repairService.getAll(params);
      setRepairs(response.data || []);
      setPagination({
        page: response.page || 1,
        pages: response.pages || 1,
        total: response.total || 0
      });
    } catch (error) {
      toast.error('Erreur lors du chargement des réparations');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await repairService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await repairService.updateStatus(id, newStatus);
      toast.success('Statut mis à jour');
      loadRepairs();
      loadStats();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suivi des Réparations</h1>
          <p className="text-gray-500 mt-1">Gestion des réparations et SAV</p>
        </div>
        <button
          onClick={() => navigate('/repairs/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Nouvelle Réparation
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wrench className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-xl font-bold">{stats.totalRepairs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">En Cours</p>
                <p className="text-xl font-bold">{stats.inProgress}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Prêt Retrait</p>
                <p className="text-xl font-bold">{stats.readyForPickup}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Package className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Terminées Aujourd'hui</p>
                <p className="text-xl font-bold">{stats.completedToday}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Délai Moyen</p>
                <p className="text-xl font-bold">{stats.averageTurnaroundDays} jours</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par n° réparation, client..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
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
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes priorités</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select
            value={filters.itemType}
            onChange={(e) => setFilters({ ...filters, itemType: e.target.value })}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {ITEM_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button
            onClick={loadRepairs}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Repairs Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : repairs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Wrench className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune réparation trouvée</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Réparation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Problème</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date réception</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priorité</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {repairs.map((repair) => {
                const statusConfig = STATUS_CONFIG[repair.status] || STATUS_CONFIG.received;
                const priorityConfig = PRIORITY_CONFIG[repair.priority] || PRIORITY_CONFIG.normal;
                const StatusIcon = statusConfig.icon;
                return (
                  <tr key={repair._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{repair.repairNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{repair.customer?.name}</p>
                        {repair.customer?.phone && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {repair.customer.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{repair.item?.description}</p>
                        <p className="text-sm text-gray-500 capitalize">{repair.item?.type}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {repair.problem?.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(repair.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${priorityConfig.color}`}>
                        {priorityConfig.label}
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
                          onClick={() => navigate(`/repairs/${repair._id}`)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {repair.status === 'received' && (
                          <button
                            onClick={() => handleStatusUpdate(repair._id, 'inspecting')}
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          >
                            Inspecter
                          </button>
                        )}
                        {repair.status === 'quality_check' && (
                          <button
                            onClick={() => handleStatusUpdate(repair._id, 'ready_pickup')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Prêt
                          </button>
                        )}
                        {repair.status === 'ready_pickup' && (
                          <button
                            onClick={() => navigate(`/repairs/${repair._id}/pickup`)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Retrait
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
              {pagination.total} réparation(s) trouvée(s)
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
