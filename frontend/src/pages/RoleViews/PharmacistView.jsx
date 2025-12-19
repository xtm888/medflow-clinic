import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pill, Clock, Package, AlertTriangle, CheckCircle, Loader2,
  RefreshCw, Search, ArrowRight, FileText, TrendingDown, ShoppingCart
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/apiConfig';

/**
 * PharmacistView - Role-based dashboard for pharmacists
 *
 * StudioVision Philosophy: Everything on one screen
 *
 * Shows:
 * - Pending prescriptions to dispense
 * - Low stock alerts
 * - Today's dispensing history
 * - Quick actions: Dispense, Stock check, Reorder
 */
export default function PharmacistView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [pendingPrescriptions, setPendingPrescriptions] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [todayDispensed, setTodayDispensed] = useState([]);
  const [stats, setStats] = useState({ pending: 0, dispensed: 0, lowStock: 0 });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [prescriptionsRes, alertsRes, dispensedRes, statsRes] = await Promise.all([
        api.get('/prescriptions?status=pending&limit=20').catch(() => ({ data: { data: [] } })),
        api.get('/pharmacy/alerts?type=low-stock&limit=10').catch(() => ({ data: { data: [] } })),
        api.get('/prescriptions?status=dispensed&dispensedToday=true&limit=10').catch(() => ({ data: { data: [] } })),
        api.get('/pharmacy/stats').catch(() => ({ data: { data: {} } }))
      ]);

      const extractData = (res, defaultValue = []) => {
        if (!res) return defaultValue;
        if (res.data?.data) return res.data.data;
        if (res.data) return res.data;
        return defaultValue;
      };

      setPendingPrescriptions(extractData(prescriptionsRes));
      setLowStockAlerts(extractData(alertsRes));
      setTodayDispensed(extractData(dispensedRes));

      const statsData = extractData(statsRes, {});
      setStats({
        pending: statsData.pending || pendingPrescriptions.length,
        dispensed: statsData.dispensedToday || todayDispensed.length,
        lowStock: statsData.lowStock || lowStockAlerts.length
      });
    } catch (err) {
      console.error('Error fetching pharmacist data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && pendingPrescriptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Pill className="h-7 w-7 text-green-600" />
            Pharmacie
          </h1>
          <p className="text-gray-600">
            Bienvenue, {user?.firstName || user?.name || 'Pharmacien'}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dispensées aujourd'hui</p>
              <p className="text-2xl font-bold text-green-600">{stats.dispensed}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alertes stock</p>
              <p className="text-2xl font-bold text-red-600">{stats.lowStock}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <button
          onClick={() => navigate('/pharmacy')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-4 hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Package className="h-6 w-6" />
          <span className="font-medium">Inventaire Complet</span>
        </button>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Pending Prescriptions */}
        <div className="bg-white rounded-xl shadow-sm p-4 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Ordonnances en Attente
            </h2>
            <button
              onClick={() => navigate('/prescriptions?status=pending')}
              className="text-amber-600 hover:text-amber-800 text-sm"
            >
              Voir tout →
            </button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {pendingPrescriptions.map((rx) => (
              <div
                key={rx._id}
                onClick={() => navigate(`/prescriptions/${rx._id}/dispense`)}
                className="p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">
                      {rx.patient?.lastName} {rx.patient?.firstName}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {formatTime(rx.createdAt)}
                    </span>
                  </div>
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded">
                    {rx.medications?.length || 0} médicament(s)
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {rx.medications?.slice(0, 2).map(m => m.name || m.medication?.name).join(', ')}
                  {rx.medications?.length > 2 && '...'}
                </div>
                <div className="mt-2 flex justify-end">
                  <button className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                    Dispenser →
                  </button>
                </div>
              </div>
            ))}
            {pendingPrescriptions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-2" />
                <p>Aucune ordonnance en attente</p>
                <p className="text-sm">Tout est en ordre !</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Alerts & History */}
        <div className="space-y-4">
          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Stock Faible
              </h2>
              <button
                onClick={() => navigate('/unified-inventory?tab=pharmacy')}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Voir tout →
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {lowStockAlerts.slice(0, 5).map((alert, idx) => (
                <div
                  key={alert._id || idx}
                  className="p-2 rounded-lg border border-red-200 bg-red-50"
                >
                  <div className="font-medium text-gray-900 text-sm">
                    {alert.name || alert.medication?.name}
                  </div>
                  <div className="text-xs text-red-600">
                    Stock: {alert.quantity || alert.stock} unités
                  </div>
                </div>
              ))}
              {lowStockAlerts.length === 0 && (
                <p className="text-gray-500 text-center py-4 text-sm">Aucune alerte</p>
              )}
            </div>
          </div>

          {/* Today's Dispensing */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Dispensés Aujourd'hui
              </h2>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {todayDispensed.slice(0, 5).map((rx) => (
                <div
                  key={rx._id}
                  className="p-2 rounded-lg border border-green-200 bg-green-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">
                      {rx.patient?.lastName} {rx.patient?.firstName}
                    </span>
                    <span className="text-xs text-green-600">
                      {formatTime(rx.dispensedAt)}
                    </span>
                  </div>
                </div>
              ))}
              {todayDispensed.length === 0 && (
                <p className="text-gray-500 text-center py-4 text-sm">Aucune dispensation</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
