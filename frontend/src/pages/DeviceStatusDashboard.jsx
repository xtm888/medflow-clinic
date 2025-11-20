import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Database,
  Calendar,
  AlertCircle,
  Settings,
  BarChart3,
  Filter
} from 'lucide-react';
import deviceService from '../services/deviceService';
import { toast } from 'react-toastify';

/**
 * DeviceStatusDashboard Component
 *
 * Real-time monitoring dashboard for all medical devices
 * Shows connection status, health metrics, errors, and activity
 */
const DeviceStatusDashboard = () => {
  const navigate = useNavigate();
  

  // Data state
  const [devices, setDevices] = useState([]);
  const [deviceHealth, setDeviceHealth] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all'); // all, connected, disconnected, error
  const [typeFilter, setTypeFilter] = useState('all');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    connected: 0,
    disconnected: 0,
    errors: 0,
    active: 0
  });

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);

    try {
      // Load all devices
      const devicesResponse = await deviceService.getDevices();
      const devicesData = devicesResponse.data || [];
      setDevices(devicesData);

      // Calculate stats
      const statsData = {
        total: devicesData.length,
        connected: devicesData.filter(d => d.status === 'connected').length,
        disconnected: devicesData.filter(d => d.status === 'disconnected').length,
        errors: devicesData.filter(d => d.status === 'error').length,
        active: devicesData.filter(d => d.isActive).length
      };
      setStats(statsData);

      // Load health data for each device
      const healthData = {};
      for (const device of devicesData) {
        try {
          const health = await deviceService.getDeviceHealth(device._id);
          healthData[device._id] = health.data;
        } catch (err) {
          healthData[device._id] = { status: 'unknown', lastCheck: new Date() };
        }
      }
      setDeviceHealth(healthData);

      // Load recent activity (mock data - would come from backend)
      setRecentActivity([
        {
          id: 1,
          deviceId: devicesData[0]?._id,
          deviceName: devicesData[0]?.name,
          type: 'measurement',
          action: 'New measurement received',
          timestamp: new Date(),
          status: 'success'
        },
        {
          id: 2,
          deviceId: devicesData[1]?._id,
          deviceName: devicesData[1]?.name,
          type: 'connection',
          action: 'Device connected',
          timestamp: new Date(Date.now() - 300000),
          status: 'success'
        }
      ]);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
    toast.success('Dashboard refreshed');
  };

  const getFilteredDevices = () => {
    return devices.filter(device => {
      // Status filter
      if (statusFilter !== 'all' && device.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && device.deviceType !== typeFilter) {
        return false;
      }

      return true;
    });
  };

  const getDeviceStatusColor = (status) => {
    const colors = {
      connected: 'text-green-600 bg-green-100',
      disconnected: 'text-gray-600 bg-gray-100',
      error: 'text-red-600 bg-red-100',
      pending: 'text-yellow-600 bg-yellow-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getDeviceStatusIcon = (status) => {
    const icons = {
      connected: CheckCircle,
      disconnected: WifiOff,
      error: XCircle,
      pending: Clock
    };
    const Icon = icons[status] || AlertCircle;
    return <Icon className="w-5 h-5" />;
  };

  const formatDeviceType = (type) => {
    const typeMap = {
      'autorefractor': 'Autoréfracteur',
      'tonometer': 'Tonomètre',
      'keratometer': 'Kératomètre',
      'oct': 'OCT',
      'fundus-camera': 'Rétinographe',
      'perimeter': 'Périmètre'
    };
    return typeMap[type] || type;
  };

  const formatUptime = (lastSeen) => {
    if (!lastSeen) return 'N/A';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const filteredDevices = getFilteredDevices();
  const deviceTypes = [...new Set(devices.map(d => d.deviceType))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              Tableau de Bord - Appareils
            </h1>
            <p className="text-gray-600 mt-1">
              Surveillance en temps réel de tous les appareils médicaux
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={() => navigate('/devices')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Gérer
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Appareils</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <HardDrive className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Connectés</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.connected}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Wifi className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.total > 0 ? Math.round((stats.connected / stats.total) * 100) : 0}% du total
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Déconnectés</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">{stats.disconnected}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <WifiOff className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Erreurs</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.errors}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          {stats.errors > 0 && (
            <div className="mt-2 text-xs text-red-600 font-medium">
              Attention requise
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actifs</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.active}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <div className="flex-1 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Statut:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                <option value="connected">Connectés</option>
                <option value="disconnected">Déconnectés</option>
                <option value="error">Erreurs</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                {deviceTypes.map(type => (
                  <option key={type} value={type}>{formatDeviceType(type)}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto text-sm text-gray-600">
              {filteredDevices.length} appareil{filteredDevices.length !== 1 ? 's' : ''} affiché{filteredDevices.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Appareils</h2>
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {filteredDevices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <HardDrive className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Aucun appareil trouvé avec ces filtres</p>
                </div>
              ) : (
                filteredDevices.map(device => {
                  const health = deviceHealth[device._id] || {};

                  return (
                    <div
                      key={device._id}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/devices/${device._id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Status Indicator */}
                          <div className={`p-2 rounded-lg ${getDeviceStatusColor(device.status)}`}>
                            {getDeviceStatusIcon(device.status)}
                          </div>

                          {/* Device Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{device.name}</h3>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                {formatDeviceType(device.deviceType)}
                              </span>
                            </div>

                            <p className="text-sm text-gray-600 mb-2">
                              {device.manufacturer} - {device.model}
                            </p>

                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Database className="w-3 h-3" />
                                <span>{device.integration?.method || 'N/A'}</span>
                              </div>

                              {device.lastSeen && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Vu il y a {formatUptime(device.lastSeen)}</span>
                                </div>
                              )}

                              {health.uptime && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>Uptime: {health.uptime}%</span>
                                </div>
                              )}
                            </div>

                            {/* Health Metrics */}
                            {health.metrics && (
                              <div className="mt-2 flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-600">Mesures:</span>
                                  <span className="font-medium text-blue-600">
                                    {health.metrics.totalMeasurements || 0}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-600">Succès:</span>
                                  <span className="font-medium text-green-600">
                                    {health.metrics.successRate || 0}%
                                  </span>
                                </div>
                                {health.metrics.lastError && (
                                  <div className="flex items-center gap-1 text-red-600">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Dernière erreur: {new Date(health.metrics.lastError).toLocaleString('fr-FR')}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {device.isActive && (
                              <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                Actif
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/devices/${device._id}`);
                              }}
                              className="p-2 hover:bg-gray-200 rounded transition-colors"
                            >
                              <Settings className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Activité Récente
              </h2>
            </div>

            <div className="divide-y divide-gray-200 max-h-[300px] overflow-y-auto">
              {recentActivity.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Aucune activité récente
                </div>
              ) : (
                recentActivity.map(activity => (
                  <div key={activity.id} className="p-3">
                    <div className="flex items-start gap-2">
                      <div className={`p-1 rounded ${
                        activity.status === 'success' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {activity.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.deviceName}
                        </p>
                        <p className="text-xs text-gray-600">{activity.action}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Santé du Système
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Taux de connexion</span>
                  <span className="text-sm font-medium">
                    {stats.total > 0 ? Math.round((stats.connected / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.total > 0 ? (stats.connected / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Appareils actifs</span>
                  <span className="text-sm font-medium">
                    {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Taux d'erreur</span>
                  <span className="text-sm font-medium text-red-600">
                    {stats.total > 0 ? Math.round((stats.errors / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${stats.total > 0 ? (stats.errors / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceStatusDashboard;
