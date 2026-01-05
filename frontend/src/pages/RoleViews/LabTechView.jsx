import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, TestTube, Clock, CheckCircle, AlertTriangle,
  Loader2, RefreshCw, ArrowRight, ClipboardList, Package, Beaker
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/apiConfig';
import { formatTime } from '../../utils/formatters';

/**
 * LabTechView - Role-based dashboard for lab technicians
 *
 * StudioVision Philosophy: Everything on one screen
 *
 * Shows:
 * - Pending lab orders/samples
 * - In-progress tests
 * - Results pending validation
 * - Reagent/consumable alerts
 */
export default function LabTechView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [labOrders, setLabOrders] = useState([]);
  const [pendingResults, setPendingResults] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState({ reagents: [], consumables: [] });
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    pendingValidation: 0,
    completed: 0
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

      const [ordersRes, pendingRes, reagentsRes, consumablesRes] = await Promise.all([
        api.get('/lab-orders?limit=30').catch(() => ({ data: { data: [] } })),
        api.get('/lab-orders?status=pending-validation&limit=10').catch(() => ({ data: { data: [] } })),
        api.get('/reagent-inventory/alerts?limit=5').catch(() => ({ data: { data: [] } })),
        api.get('/lab-consumable-inventory/alerts?limit=5').catch(() => ({ data: { data: [] } }))
      ]);

      const extractData = (res, defaultValue = []) => {
        if (!res) return defaultValue;
        if (res.data?.data) return res.data.data;
        if (res.data) return res.data;
        return defaultValue;
      };

      const allOrders = extractData(ordersRes);
      setLabOrders(allOrders);
      setPendingResults(extractData(pendingRes));

      // Calculate stats
      setStats({
        pending: allOrders.filter(o => o.status === 'pending' || o.status === 'ordered').length,
        inProgress: allOrders.filter(o => o.status === 'in-progress' || o.status === 'processing').length,
        pendingValidation: allOrders.filter(o => o.status === 'pending-validation' || o.status === 'completed').length,
        completed: allOrders.filter(o => o.status === 'validated' || o.status === 'released').length
      });

      setInventoryAlerts({
        reagents: extractData(reagentsRes),
        consumables: extractData(consumablesRes)
      });
    } catch (err) {
      console.error('Error fetching lab tech data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // formatTime imported from utils/formatters

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'ordered': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in-progress':
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending-validation':
      case 'completed': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'validated':
      case 'released': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'En attente',
      'ordered': 'Commandé',
      'in-progress': 'En cours',
      'processing': 'Traitement',
      'pending-validation': 'Validation',
      'completed': 'Terminé',
      'validated': 'Validé',
      'released': 'Publié',
      'cancelled': 'Annulé'
    };
    return labels[status] || status;
  };

  if (loading && labOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="h-7 w-7 text-purple-600" />
            Laboratoire
          </h1>
          <p className="text-gray-600">
            Bienvenue, {user?.firstName || user?.name || 'Technicien'}
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
          onClick={() => navigate('/lab/checkin')}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <ClipboardList className="h-8 w-8 mb-2" />
          <span className="font-medium">Check-in Échantillon</span>
        </button>
        <button
          onClick={() => navigate('/lab/worklist')}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <TestTube className="h-8 w-8 mb-2" />
          <span className="font-medium">Worklist</span>
        </button>
        <button
          onClick={() => navigate('/lab/results')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <CheckCircle className="h-8 w-8 mb-2" />
          <span className="font-medium">Valider Résultats</span>
        </button>
        <button
          onClick={() => navigate('/unified-inventory?tab=reagents')}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl hover:shadow-lg transition-all flex flex-col items-center"
        >
          <Package className="h-8 w-8 mb-2" />
          <span className="font-medium">Inventaire</span>
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
            <Beaker className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">À valider</p>
              <p className="text-2xl font-bold text-purple-600">{stats.pendingValidation}</p>
            </div>
            <ClipboardList className="h-8 w-8 text-purple-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Validés aujourd'hui</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Pending Samples */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Échantillons en Attente
            </h2>
            <button
              onClick={() => navigate('/lab/worklist?status=pending')}
              className="text-yellow-600 hover:text-yellow-800 text-sm"
            >
              Voir tout →
            </button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {labOrders
              .filter(o => ['pending', 'ordered'].includes(o.status))
              .slice(0, 10)
              .map((order) => (
                <div
                  key={order._id}
                  onClick={() => navigate(`/lab/orders/${order._id}`)}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(order.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {order.accessionNumber || order.orderNumber || `#${order._id?.slice(-6)}`}
                    </span>
                    <span className="text-xs text-gray-600">
                      {formatTime(order.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {order.patient?.lastName} {order.patient?.firstName}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {order.tests?.length || 1} test(s) • {order.priority === 'urgent' ? '🔴 URGENT' : order.priority}
                  </div>
                </div>
              ))}
            {labOrders.filter(o => ['pending', 'ordered'].includes(o.status)).length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucun échantillon en attente</p>
            )}
          </div>
        </div>

        {/* Center Column - In Progress */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Beaker className="h-5 w-5 text-blue-600" />
              En Cours de Traitement
            </h2>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {labOrders
              .filter(o => ['in-progress', 'processing'].includes(o.status))
              .slice(0, 10)
              .map((order) => (
                <div
                  key={order._id}
                  onClick={() => navigate(`/lab/orders/${order._id}`)}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(order.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {order.accessionNumber || `#${order._id?.slice(-6)}`}
                    </span>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {order.patient?.lastName} {order.patient?.firstName}
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/lab/orders/${order._id}/results`);
                      }}
                      className="w-full text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                    >
                      Saisir Résultats →
                    </button>
                  </div>
                </div>
              ))}
            {labOrders.filter(o => ['in-progress', 'processing'].includes(o.status)).length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucun traitement en cours</p>
            )}
          </div>
        </div>

        {/* Right Column - Validation & Alerts */}
        <div className="space-y-4">
          {/* Pending Validation */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                À Valider
              </h2>
              <button
                onClick={() => navigate('/lab/results?status=pending-validation')}
                className="text-purple-600 hover:text-purple-800 text-sm"
              >
                Voir tout →
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pendingResults.slice(0, 5).map((order) => (
                <div
                  key={order._id}
                  onClick={() => navigate(`/lab/orders/${order._id}/validate`)}
                  className="p-2 rounded-lg border border-purple-200 bg-purple-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">
                      {order.accessionNumber || `#${order._id?.slice(-6)}`}
                    </span>
                    <button className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">
                      Valider
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {order.patient?.lastName} {order.patient?.firstName}
                  </div>
                </div>
              ))}
              {pendingResults.length === 0 && (
                <p className="text-gray-500 text-center py-2 text-sm">Aucun résultat à valider</p>
              )}
            </div>
          </div>

          {/* Reagent Alerts */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-orange-600" />
                Alertes Réactifs
              </h2>
              <button
                onClick={() => navigate('/unified-inventory?tab=reagents')}
                className="text-orange-600 hover:text-orange-800 text-sm"
              >
                Voir →
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {inventoryAlerts.reagents.slice(0, 3).map((alert, idx) => (
                <div key={alert._id || idx} className="p-2 rounded-lg border border-red-200 bg-red-50 text-sm">
                  <div className="font-medium text-gray-900">{alert.name}</div>
                  <div className="text-xs text-red-600">
                    Stock: {alert.quantity || alert.stock} {alert.unit || 'unités'}
                  </div>
                </div>
              ))}
              {inventoryAlerts.reagents.length === 0 && (
                <p className="text-gray-500 text-center py-2 text-sm">Aucune alerte</p>
              )}
            </div>
          </div>

          {/* Consumable Alerts */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <TestTube className="h-5 w-5 text-cyan-600" />
                Alertes Consommables
              </h2>
              <button
                onClick={() => navigate('/unified-inventory?tab=consumables')}
                className="text-cyan-600 hover:text-cyan-800 text-sm"
              >
                Voir →
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {inventoryAlerts.consumables.slice(0, 3).map((alert, idx) => (
                <div key={alert._id || idx} className="p-2 rounded-lg border border-red-200 bg-red-50 text-sm">
                  <div className="font-medium text-gray-900">{alert.name}</div>
                  <div className="text-xs text-red-600">
                    Stock: {alert.quantity || alert.stock} {alert.unit || 'unités'}
                  </div>
                </div>
              ))}
              {inventoryAlerts.consumables.length === 0 && (
                <p className="text-gray-500 text-center py-2 text-sm">Aucune alerte</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
