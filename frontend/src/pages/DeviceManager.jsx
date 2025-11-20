import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  FileText,
  FolderSync,
  HardDrive,
  Link,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  XCircle
} from 'lucide-react';
import deviceService from '../services/deviceService';
import { toast } from 'react-toastify';

const DeviceManager = () => {
  const navigate = useNavigate();
  

  // State
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Fetch devices on mount
  useEffect(() => {
    loadDevices();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter devices when search or filters change
  useEffect(() => {
    filterDevices();
  }, [devices, searchQuery, filterType, filterStatus]);

  const loadDevices = async () => {
    try {
      const response = await deviceService.getDevices();
      setDevices(response.data || []);
    } catch (err) {
      toast.error('Failed to load devices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterDevices = () => {
    let filtered = [...devices];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        device =>
          device.name?.toLowerCase().includes(query) ||
          device.manufacturer?.toLowerCase().includes(query) ||
          device.model?.toLowerCase().includes(query) ||
          device.deviceId?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(device => device.type === filterType);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(
        device => device.integration?.status === filterStatus
      );
    }

    setFilteredDevices(filtered);
  };

  const handleSyncFolder = async (deviceId) => {
    setSyncing(prev => new Set(prev).add(deviceId));

    try {
      const response = await deviceService.syncDeviceFolder(deviceId);
      toast.success(
        `Sync completed: ${response.recordsProcessed} processed, ${response.recordsFailed} failed`
      );
      await loadDevices();
    } catch (err) {
      toast.error(`Sync failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSyncing(prev => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to delete this device?')) return;

    try {
      await deviceService.deleteDevice(deviceId);
      toast.success('Device deleted successfully');
      await loadDevices();
    } catch (err) {
      toast.error(`Failed to delete device: ${err.response?.data?.message || err.message}`);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="w-5 h-5 text-gray-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'webhook':
        return <Wifi className="w-4 h-4" />;
      case 'folder-sync':
        return <FolderSync className="w-4 h-4" />;
      case 'manual':
        return <Upload className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const formatLastSync = (lastSync) => {
    if (!lastSync) return 'Never';

    const now = new Date();
    const syncDate = new Date(lastSync);
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  // Get unique device types for filter
  const deviceTypes = [...new Set(devices.map(d => d.type))];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Device Manager</h1>
          <p className="text-gray-600 mt-1">
            Manage medical devices and integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/devices/status')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Status Dashboard
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Device
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HardDrive className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Devices</p>
              <p className="text-2xl font-bold">{devices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Connected</p>
              <p className="text-2xl font-bold">
                {devices.filter(d => d.integration?.status === 'connected').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold">
                {devices.filter(d => d.integration?.status === 'error').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold">
                {devices.filter(d => d.active).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            {deviceTypes.map(type => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
            <option value="not-configured">Not Configured</option>
          </select>
        </div>
      </div>

      {/* Devices List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <HardDrive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No devices found
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your filters'
              : 'Get started by adding your first device'}
          </p>
          {!searchQuery && filterType === 'all' && filterStatus === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Device
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map(device => (
            <div
              key={device._id}
              className="bg-white rounded-lg shadow border border-gray-200 p-5 hover:shadow-lg transition-shadow"
            >
              {/* Device Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(device.integration?.status)}
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {device.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {device.manufacturer} - {device.model}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ID: {device.deviceId}
                  </p>
                </div>
              </div>

              {/* Device Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium text-gray-900">
                    {device.type.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                      device.integration?.status
                    )}`}
                  >
                    {device.integration?.status || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Method:</span>
                  <div className="flex items-center gap-1">
                    {getMethodIcon(device.integration?.method)}
                    <span className="font-medium text-gray-900">
                      {device.integration?.method || 'none'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last Sync:</span>
                  <span className="text-gray-900">
                    {formatLastSync(device.integration?.lastSync)}
                  </span>
                </div>

                {device.integration?.consecutiveErrors > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-red-700">
                      {device.integration.consecutiveErrors} consecutive errors
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => navigate(`/devices/${device._id}`)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Settings className="w-4 h-4 inline mr-1" />
                  Manage
                </button>

                {device.integration?.method === 'folder-sync' &&
                  device.integration?.folderSync?.enabled && (
                    <button
                      onClick={() => handleSyncFolder(device._id)}
                      disabled={syncing.has(device._id)}
                      className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
                    >
                      {syncing.has(device._id) ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                  )}

                <button
                  onClick={() => navigate(`/devices/${device._id}/logs`)}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteDevice(device._id)}
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeviceManager;
