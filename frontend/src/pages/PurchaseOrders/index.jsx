import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  FileText,
  Eye,
  Edit,
  MoreVertical,
  RefreshCw,
  Download
} from 'lucide-react';
import { toast } from 'react-toastify';
import purchaseOrderService from '../../services/purchaseOrderService';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800', icon: FileText },
  pending_approval: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-800', icon: XCircle },
  sent: { label: 'Envoyé', color: 'bg-blue-100 text-blue-800', icon: Truck },
  partial_received: { label: 'Réception partielle', color: 'bg-orange-100 text-orange-800', icon: Package },
  received: { label: 'Reçu', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  closed: { label: 'Clôturé', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: XCircle }
};

const INVENTORY_TYPES = [
  { value: 'all', label: 'Tous les types' },
  { value: 'pharmacy', label: 'Pharmacie' },
  { value: 'frame', label: 'Montures' },
  { value: 'contactLens', label: 'Lentilles' },
  { value: 'reagent', label: 'Réactifs' },
  { value: 'labConsumable', label: 'Consommables labo' }
];

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    inventoryType: 'all'
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    loadOrders();
    loadStats();
  }, [filters]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 20,
        ...filters
      };
      if (params.status === 'all') delete params.status;
      if (params.inventoryType === 'all') delete params.inventoryType;

      const response = await purchaseOrderService.getAll(params);
      // Handle various API response formats defensively
      const ordersData = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.orders)
        ? response.data.orders
        : Array.isArray(response?.data?.items)
        ? response.data.items
        : [];
      setOrders(ordersData);
      setPagination({
        page: response?.page || response?.data?.page || 1,
        pages: response?.pages || response?.data?.pages || 1,
        total: response?.total || response?.data?.total || 0
      });
    } catch (error) {
      toast.error('Erreur lors du chargement des commandes');
      console.error(error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await purchaseOrderService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleStatusAction = async (orderId, action) => {
    try {
      switch (action) {
        case 'submit':
          await purchaseOrderService.submitForApproval(orderId);
          toast.success('Commande soumise pour approbation');
          break;
        case 'approve':
          await purchaseOrderService.approve(orderId);
          toast.success('Commande approuvée');
          break;
        case 'send':
          await purchaseOrderService.markAsSent(orderId);
          toast.success('Commande marquée comme envoyée');
          break;
        default:
          break;
      }
      loadOrders();
      loadStats();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bons de Commande</h1>
          <p className="text-gray-500 mt-1">Gestion des achats et approvisionnements</p>
        </div>
        <button
          onClick={() => navigate('/purchase-orders/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Nouvelle Commande
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Commandes</p>
                <p className="text-xl font-bold">{stats.totalOrders}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">En Attente</p>
                <p className="text-xl font-bold">{stats.pendingApproval}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Truck className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">En Livraison</p>
                <p className="text-xl font-bold">{stats.awaitingDelivery}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Dépensé</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalSpent)}</p>
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
                placeholder="Rechercher par n° ou fournisseur..."
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
            value={filters.inventoryType}
            onChange={(e) => setFilters({ ...filters, inventoryType: e.target.value })}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {INVENTORY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button
            onClick={loadOrders}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune commande trouvée</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Commande</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fournisseur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;
                const StatusIcon = statusConfig.icon;
                return (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{order.poNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{order.supplier?.name}</p>
                        <p className="text-sm text-gray-500">{order.supplier?.contactPerson}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 capitalize">{order.inventoryType}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(order.orderDate)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(order.totals?.grandTotal)}
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
                          onClick={() => navigate(`/purchase-orders/${order._id}`)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {order.status === 'draft' && (
                          <>
                            <button
                              onClick={() => navigate(`/purchase-orders/${order._id}/edit`)}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleStatusAction(order._id, 'submit')}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Soumettre
                            </button>
                          </>
                        )}
                        {order.status === 'pending_approval' && (
                          <button
                            onClick={() => handleStatusAction(order._id, 'approve')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Approuver
                          </button>
                        )}
                        {order.status === 'approved' && (
                          <button
                            onClick={() => handleStatusAction(order._id, 'send')}
                            className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                          >
                            Marquer Envoyé
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
              {pagination.total} commande(s) trouvée(s)
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
