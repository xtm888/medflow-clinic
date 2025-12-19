import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Glasses, Eye, Package, Clock, CheckCircle, AlertTriangle,
  Loader2, RefreshCw, ArrowRight, ShoppingBag, Truck, Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/apiConfig';

/**
 * OpticianView - Role-based dashboard for opticians
 *
 * StudioVision Philosophy: Everything on one screen
 *
 * Shows:
 * - Glasses orders by status (pending, in-progress, ready, delivered)
 * - Frame/lens inventory alerts
 * - Today's deliveries
 * - Quick actions: New order, Inventory check
 */
export default function OpticianView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [orders, setOrders] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState({ frames: [], lenses: [] });
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    qcPending: 0,
    ready: 0
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [ordersRes, framesRes, lensesRes] = await Promise.all([
        api.get('/glasses-orders?limit=30').catch(() => ({ data: { data: [] } })),
        api.get('/frame-inventory/alerts?limit=5').catch(() => ({ data: { data: [] } })),
        api.get('/optical-lens-inventory/alerts?limit=5').catch(() => ({ data: { data: [] } }))
      ]);

      const extractData = (res, defaultValue = []) => {
        if (!res) return defaultValue;
        if (res.data?.data) return res.data.data;
        if (res.data) return res.data;
        return defaultValue;
      };

      const allOrders = extractData(ordersRes);
      setOrders(allOrders);

      // Calculate stats from orders
      setStats({
        pending: allOrders.filter(o => o.status === 'pending' || o.status === 'ordered').length,
        inProgress: allOrders.filter(o => o.status === 'in-progress' || o.status === 'received').length,
        qcPending: allOrders.filter(o => o.status === 'qc-pending').length,
        ready: allOrders.filter(o => o.status === 'ready' || o.status === 'qc-passed').length
      });

      setInventoryAlerts({
        frames: extractData(framesRes),
        lenses: extractData(lensesRes)
      });
    } catch (err) {
      console.error('Error fetching optician data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--/--';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'ordered': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in-progress':
      case 'received': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'qc-pending': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'qc-passed':
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'delivered': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'qc-failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'En attente',
      'ordered': 'Commandé',
      'received': 'Reçu',
      'in-progress': 'En cours',
      'qc-pending': 'CQ en attente',
      'qc-passed': 'CQ OK',
      'qc-failed': 'CQ Échoué',
      'ready': 'Prêt',
      'delivered': 'Livré'
    };
    return labels[status] || status;
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-pink-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Glasses className="h-7 w-7 text-pink-600" />
            Optique
          </h1>
          <p className="text-gray-600">
            Bienvenue, {user?.firstName || user?.name || 'Opticien'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => navigate('/glasses-orders/new')}
          className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <ShoppingBag className="h-8 w-8 mb-2" />
          <span className="font-medium">Nouvelle Commande</span>
        </button>
        <button
          onClick={() => navigate('/optical-shop')}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <Eye className="h-8 w-8 mb-2" />
          <span className="font-medium">Boutique</span>
        </button>
        <button
          onClick={() => navigate('/unified-inventory?tab=frames')}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <Package className="h-8 w-8 mb-2" />
          <span className="font-medium">Inventaire</span>
        </button>
        <button
          onClick={() => navigate('/glasses-orders?status=ready')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <Truck className="h-8 w-8 mb-2" />
          <span className="font-medium">Livraisons</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En cours</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            <Package className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CQ en attente</p>
              <p className="text-2xl font-bold text-purple-600">{stats.qcPending}</p>
            </div>
            <Eye className="h-8 w-8 text-purple-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Prêts</p>
              <p className="text-2xl font-bold text-green-600">{stats.ready}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Pending & In Progress */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              En Attente / En Cours
            </h2>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {orders
              .filter(o => ['pending', 'ordered', 'in-progress', 'received'].includes(o.status))
              .slice(0, 10)
              .map((order) => (
                <div
                  key={order._id}
                  onClick={() => navigate(`/glasses-orders/${order._id}`)}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(order.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {order.orderNumber || `#${order._id?.slice(-6)}`}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/50">
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {order.patient?.lastName} {order.patient?.firstName}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Prévu: {formatDate(order.estimatedDelivery || order.dueDate)}
                  </div>
                </div>
              ))}
            {orders.filter(o => ['pending', 'ordered', 'in-progress', 'received'].includes(o.status)).length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucune commande</p>
            )}
          </div>
        </div>

        {/* Center Column - QC & Ready */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              Contrôle Qualité / Prêts
            </h2>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {orders
              .filter(o => ['qc-pending', 'qc-passed', 'ready'].includes(o.status))
              .slice(0, 10)
              .map((order) => (
                <div
                  key={order._id}
                  onClick={() => navigate(`/glasses-orders/${order._id}`)}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(order.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {order.orderNumber || `#${order._id?.slice(-6)}`}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/50">
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {order.patient?.lastName} {order.patient?.firstName}
                  </div>
                  {order.status === 'ready' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/glasses-orders/${order._id}/deliver`);
                      }}
                      className="mt-2 w-full text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
                    >
                      Livrer →
                    </button>
                  )}
                </div>
              ))}
            {orders.filter(o => ['qc-pending', 'qc-passed', 'ready'].includes(o.status)).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-2" />
                <p>Aucune commande en CQ</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Alerts */}
        <div className="space-y-4">
          {/* Frame Alerts */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Glasses className="h-5 w-5 text-pink-600" />
                Alertes Montures
              </h2>
              <button
                onClick={() => navigate('/unified-inventory?tab=frames')}
                className="text-pink-600 hover:text-pink-800 text-sm"
              >
                Voir →
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {inventoryAlerts.frames.slice(0, 3).map((alert, idx) => (
                <div key={alert._id || idx} className="p-2 rounded-lg border border-red-200 bg-red-50 text-sm">
                  <div className="font-medium text-gray-900">{alert.brand} - {alert.model}</div>
                  <div className="text-xs text-red-600">Stock: {alert.quantity || alert.stock}</div>
                </div>
              ))}
              {inventoryAlerts.frames.length === 0 && (
                <p className="text-gray-500 text-center py-2 text-sm">Aucune alerte</p>
              )}
            </div>
          </div>

          {/* Lens Alerts */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Alertes Verres
              </h2>
              <button
                onClick={() => navigate('/unified-inventory?tab=lenses')}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Voir →
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {inventoryAlerts.lenses.slice(0, 3).map((alert, idx) => (
                <div key={alert._id || idx} className="p-2 rounded-lg border border-red-200 bg-red-50 text-sm">
                  <div className="font-medium text-gray-900">{alert.name || alert.type}</div>
                  <div className="text-xs text-red-600">Stock: {alert.quantity || alert.stock}</div>
                </div>
              ))}
              {inventoryAlerts.lenses.length === 0 && (
                <p className="text-gray-500 text-center py-2 text-sm">Aucune alerte</p>
              )}
            </div>
          </div>

          {/* QC Failed */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                CQ Échoués
              </h2>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {orders
                .filter(o => o.status === 'qc-failed')
                .slice(0, 3)
                .map((order) => (
                  <div
                    key={order._id}
                    onClick={() => navigate(`/glasses-orders/${order._id}`)}
                    className="p-2 rounded-lg border border-red-200 bg-red-50 cursor-pointer text-sm"
                  >
                    <div className="font-medium text-gray-900">
                      {order.orderNumber || `#${order._id?.slice(-6)}`}
                    </div>
                    <div className="text-xs text-red-600">
                      {order.qcNotes || 'Voir détails'}
                    </div>
                  </div>
                ))}
              {orders.filter(o => o.status === 'qc-failed').length === 0 && (
                <p className="text-green-600 text-center py-2 text-sm">Aucun échec CQ</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
