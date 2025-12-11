import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertTriangle,
  Phone,
  Mail,
  RefreshCw,
  Package,
  ClipboardCheck,
  Bell
} from 'lucide-react';
import glassesOrderService from '../../services/glassesOrderService';

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'draft': { color: 'bg-gray-100 text-gray-800', label: 'Brouillon' },
    'confirmed': { color: 'bg-blue-100 text-blue-800', label: 'Confirmé' },
    'sent-to-lab': { color: 'bg-purple-100 text-purple-800', label: 'Envoyé au labo' },
    'in-production': { color: 'bg-yellow-100 text-yellow-800', label: 'En production' },
    'received': { color: 'bg-indigo-100 text-indigo-800', label: 'Reçu' },
    'qc-passed': { color: 'bg-teal-100 text-teal-800', label: 'QC Passé' },
    'qc-failed': { color: 'bg-red-100 text-red-800', label: 'QC Échoué' },
    'ready': { color: 'bg-green-100 text-green-800', label: 'Prêt' },
    'delivered': { color: 'bg-emerald-100 text-emerald-800', label: 'Livré' },
    'cancelled': { color: 'bg-red-100 text-red-800', label: 'Annulé' }
  };

  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
};

// Priority badge
const PriorityBadge = ({ priority }) => {
  const config = {
    'normal': { color: 'text-gray-500', label: 'Normal' },
    'urgent': { color: 'text-orange-500', label: 'Urgent' },
    'rush': { color: 'text-red-500 font-bold', label: 'RUSH' }
  };
  const c = config[priority] || config.normal;
  return <span className={`text-xs ${c.color}`}>{c.label}</span>;
};

// Order type icon
const OrderTypeIcon = ({ type }) => {
  if (type === 'glasses') return <Eye className="w-4 h-4 text-blue-500" />;
  if (type === 'contact-lenses') return <Eye className="w-4 h-4 text-green-500" />;
  return <Eye className="w-4 h-4 text-purple-500" />;
};

const GlassesOrderList = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    orderType: '',
    priority: '',
    search: ''
  });
  const [activeTab, setActiveTab] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };

      // Apply tab filters
      if (activeTab === 'pending-qc') {
        const response = await glassesOrderService.getPendingQC();
        setOrders(response.data || []);
        setPagination(prev => ({ ...prev, total: response.count || 0, pages: 1 }));
        setLoading(false);
        return;
      }

      if (activeTab === 'ready') {
        const response = await glassesOrderService.getReadyForPickup();
        setOrders(response.data || []);
        setPagination(prev => ({ ...prev, total: response.count || 0, pages: 1 }));
        setLoading(false);
        return;
      }

      // Apply regular filters
      if (filters.status) params.status = filters.status;
      if (filters.orderType) params.orderType = filters.orderType;
      if (filters.priority) params.priority = filters.priority;

      const response = await glassesOrderService.getOrders(params);
      setOrders(response.data || []);
      setPagination(response.pagination || pagination);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, activeTab]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await glassesOrderService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [fetchOrders, fetchStats]);

  // Handle status update
  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await glassesOrderService.updateStatus(orderId, newStatus);
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  // Handle receive from lab
  const handleReceive = async (orderId) => {
    try {
      await glassesOrderService.receiveFromLab(orderId, {
        notes: 'Reçu du laboratoire'
      });
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error receiving order:', error);
      alert('Erreur lors de la réception');
    }
  };

  // Handle QC
  const handleQC = async (orderId, passed) => {
    try {
      await glassesOrderService.performQC(orderId, {
        passed,
        checklist: {
          lensClarity: { passed: true },
          prescriptionAccuracy: { passed: true },
          frameCondition: { passed: true },
          coatingsApplied: { passed: true },
          fitAndAlignment: { passed: true },
          cleanlinessPackaging: { passed: true }
        }
      });
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error performing QC:', error);
      alert('Erreur lors du contrôle qualité');
    }
  };

  // Handle send reminder
  const handleSendReminder = async (orderId) => {
    try {
      await glassesOrderService.sendPickupReminder(orderId);
      alert('Rappel envoyé au patient');
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Erreur lors de l\'envoi du rappel');
    }
  };

  // Filter orders by search
  const filteredOrders = orders.filter(order => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    const patientName = `${order.patient?.firstName || ''} ${order.patient?.lastName || ''}`.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(search) ||
      patientName.includes(search)
    );
  });

  // Stats cards
  const StatCard = ({ icon: Icon, label, value, color, onClick }) => (
    <div
      className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:ring-2 ring-blue-300' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${color} opacity-50`} />
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes de Lunettes</h1>
          <p className="text-gray-500">Gestion des commandes optiques</p>
        </div>
        <button
          onClick={() => navigate('/glasses-orders/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Commande
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Clock}
            label="En attente"
            value={stats.pending || 0}
            color="text-yellow-600"
            onClick={() => setActiveTab('all')}
          />
          <StatCard
            icon={ClipboardCheck}
            label="Contrôle Qualité"
            value={stats.byStatus?.find(s => s._id === 'received')?._count || 0}
            color="text-indigo-600"
            onClick={() => setActiveTab('pending-qc')}
          />
          <StatCard
            icon={Package}
            label="Prêts à retirer"
            value={stats.ready || 0}
            color="text-green-600"
            onClick={() => setActiveTab('ready')}
          />
          <StatCard
            icon={Truck}
            label="Livrés aujourd'hui"
            value={stats.todayDeliveries || 0}
            color="text-emerald-600"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        {[
          { id: 'all', label: 'Toutes', icon: Eye },
          { id: 'pending-qc', label: 'Contrôle Qualité', icon: ClipboardCheck },
          { id: 'ready', label: 'Prêts à retirer', icon: Package }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher par N° commande ou patient..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {activeTab === 'all' && (
            <>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="draft">Brouillon</option>
                <option value="confirmed">Confirmé</option>
                <option value="sent-to-lab">Envoyé au labo</option>
                <option value="in-production">En production</option>
                <option value="received">Reçu</option>
                <option value="qc-passed">QC Passé</option>
                <option value="qc-failed">QC Échoué</option>
                <option value="ready">Prêt</option>
                <option value="delivered">Livré</option>
              </select>

              <select
                value={filters.orderType}
                onChange={(e) => setFilters(prev => ({ ...prev, orderType: e.target.value }))}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les types</option>
                <option value="glasses">Lunettes</option>
                <option value="contact-lenses">Lentilles</option>
                <option value="both">Les deux</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes priorités</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="rush">Rush</option>
              </select>
            </>
          )}

          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center p-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune commande trouvée</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priorité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/glasses-orders/${order._id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.patient?.firstName} {order.patient?.lastName}
                      </p>
                      {order.patient?.phoneNumber && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {order.patient.phoneNumber}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <OrderTypeIcon type={order.orderType} />
                      <span className="text-sm text-gray-700">
                        {order.orderType === 'glasses' ? 'Lunettes' :
                         order.orderType === 'contact-lenses' ? 'Lentilles' : 'Les deux'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={order.status} />
                    {order.daysSinceReady >= 3 && (
                      <span className="ml-2 text-orange-500" title={`En attente depuis ${order.daysSinceReady} jours`}>
                        <AlertTriangle className="w-4 h-4 inline" />
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PriorityBadge priority={order.priority} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      {/* Context-specific actions */}
                      {order.status === 'in-production' && (
                        <button
                          onClick={() => handleReceive(order._id)}
                          className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                          title="Marquer comme reçu"
                        >
                          Réceptionner
                        </button>
                      )}

                      {(order.status === 'received' || order.status === 'qc-failed') && (
                        <>
                          <button
                            onClick={() => handleQC(order._id, true)}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            title="QC Passé"
                          >
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            OK
                          </button>
                          <button
                            onClick={() => handleQC(order._id, false)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            title="QC Échoué"
                          >
                            <XCircle className="w-3 h-3 inline mr-1" />
                            NOK
                          </button>
                        </>
                      )}

                      {order.status === 'qc-passed' && (
                        <button
                          onClick={() => handleStatusUpdate(order._id, 'ready')}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Marquer prêt
                        </button>
                      )}

                      {order.status === 'ready' && (
                        <>
                          <button
                            onClick={() => navigate(`/glasses-orders/${order._id}/deliver`)}
                            className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                          >
                            <Truck className="w-3 h-3 inline mr-1" />
                            Livrer
                          </button>
                          <button
                            onClick={() => handleSendReminder(order._id)}
                            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                            title="Envoyer rappel"
                          >
                            <Bell className="w-3 h-3" />
                          </button>
                        </>
                      )}

                      {/* View details always available */}
                      <Link
                        to={`/glasses-orders/${order._id}`}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Détails
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
            <p className="text-sm text-gray-500">
              Page {pagination.page} sur {pagination.pages} ({pagination.total} commandes)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlassesOrderList;
