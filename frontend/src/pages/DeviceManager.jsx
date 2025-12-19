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
      // Handle nested response structure: response.data.data contains the array
      const deviceArray = response?.data?.data || response?.data || [];
      setDevices(Array.isArray(deviceArray) ? deviceArray : []);
    } catch (err) {
      toast.error('Échec du chargement des appareils');
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
        `Synchronisation terminée : ${response.recordsProcessed} traités, ${response.recordsFailed} échecs`
      );
      await loadDevices();
    } catch (err) {
      toast.error(`Échec de la synchronisation : ${err.response?.data?.message || err.message}`);
    } finally {
      setSyncing(prev => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet appareil ?')) return;

    try {
      await deviceService.deleteDevice(deviceId);
      toast.success('Appareil supprimé avec succès');
      await loadDevices();
    } catch (err) {
      toast.error(`Échec de la suppression : ${err.response?.data?.message || err.message}`);
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
    if (!lastSync) return 'Jamais';

    const now = new Date();
    const syncDate = new Date(lastSync);
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}m`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return `Il y a ${Math.floor(diffMins / 1440)}j`;
  };

  // Get unique device types for filter (exclude undefined)
  const deviceTypes = Array.isArray(devices)
    ? [...new Set(devices.map(d => d.type).filter(Boolean))]
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Appareils</h1>
          <p className="text-gray-600 mt-1">
            Gérer les appareils médicaux et les intégrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/devices/status')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Tableau de bord
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Ajouter un appareil
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
              <p className="text-sm text-gray-600">Total Appareils</p>
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
              <p className="text-sm text-gray-600">Connectés</p>
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
              <p className="text-sm text-gray-600">Erreurs</p>
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
              <p className="text-sm text-gray-600">Actifs</p>
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
              placeholder="Rechercher des appareils..."
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
            <option value="all">Tous les types</option>
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
            <option value="all">Tous les statuts</option>
            <option value="connected">Connecté</option>
            <option value="disconnected">Déconnecté</option>
            <option value="error">Erreur</option>
            <option value="pending">En attente</option>
            <option value="not-configured">Non configuré</option>
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
            Aucun appareil trouvé
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all'
              ? 'Essayez de modifier vos filtres'
              : 'Commencez par ajouter votre premier appareil'}
          </p>
          {!searchQuery && filterType === 'all' && filterStatus === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ajouter un appareil
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
                  <span className="text-gray-600">Type :</span>
                  <span className="font-medium text-gray-900">
                    {device.type?.toUpperCase() || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Statut :</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                      device.integration?.status
                    )}`}
                  >
                    {device.integration?.status || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Méthode :</span>
                  <div className="flex items-center gap-1">
                    {getMethodIcon(device.integration?.method)}
                    <span className="font-medium text-gray-900">
                      {device.integration?.method || 'aucune'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Dernière sync :</span>
                  <span className="text-gray-900">
                    {formatLastSync(device.integration?.lastSync)}
                  </span>
                </div>

                {device.integration?.consecutiveErrors > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-red-700">
                      {device.integration.consecutiveErrors} erreurs consécutives
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
                  Gérer
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

      {/* Add Device Modal */}
      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onSuccess={async () => {
            setShowAddModal(false);
            await loadDevices();
          }}
        />
      )}
    </div>
  );
};

// Add Device Modal Component
const AddDeviceModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    type: 'oct',
    category: 'imaging',
    connection: {
      type: 'network',
      protocol: 'dicom',
      ipAddress: '',
      port: '',
    },
    integration: {
      method: 'webhook',
      enabled: true
    },
    location: {
      facility: '',
      room: ''
    }
  });
  const [saving, setSaving] = useState(false);

  const deviceTypes = [
    { value: 'auto-refractor', label: 'Auto-réfracteur' },
    { value: 'keratometer', label: 'Kératomètre' },
    { value: 'tonometer', label: 'Tonomètre' },
    { value: 'perimeter', label: 'Périmètre' },
    { value: 'oct', label: 'OCT (Tomographie)' },
    { value: 'fundus-camera', label: 'Rétinographe' },
    { value: 'slit-lamp', label: 'Lampe à fente' },
    { value: 'phoropter', label: 'Phoroptère' },
    { value: 'lensmeter', label: 'Frontofocamètre' },
    { value: 'topographer', label: 'Topographe cornéen' },
    { value: 'biometer', label: 'Biomètre' },
    { value: 'pachymeter', label: 'Pachymètre' },
    { value: 'ultrasound', label: 'Échographe' },
    { value: 'other', label: 'Autre' }
  ];

  const connectionTypes = [
    { value: 'network', label: 'Réseau (IP)' },
    { value: 'serial', label: 'Port série' },
    { value: 'usb', label: 'USB' },
    { value: 'wifi', label: 'Wi-Fi' },
    { value: 'manual', label: 'Manuel' }
  ];

  const integrationMethods = [
    { value: 'webhook', label: 'Webhook (Temps réel)' },
    { value: 'folder-sync', label: 'Synchronisation dossier' },
    { value: 'manual', label: 'Import manuel' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await deviceService.createDevice(formData);
      toast.success('Appareil ajouté avec succès');
      onSuccess();
    } catch (err) {
      toast.error(`Erreur lors de l'ajout : ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Ajouter un appareil</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de base</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'appareil *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: OCT Salle 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'appareil *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {deviceTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fabricant *
                </label>
                <input
                  type="text"
                  required
                  value={formData.manufacturer}
                  onChange={(e) => updateField('manufacturer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Zeiss, Heidelberg, Topcon"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modèle *
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Cirrus HD-OCT 5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de série
                </label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={(e) => updateField('serialNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: SN123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="diagnostic">Diagnostic</option>
                  <option value="imaging">Imagerie</option>
                  <option value="measurement">Mesure</option>
                  <option value="therapeutic">Thérapeutique</option>
                  <option value="surgical">Chirurgical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Connection Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Paramètres de connexion</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de connexion *
                </label>
                <select
                  required
                  value={formData.connection.type}
                  onChange={(e) => updateField('connection.type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {connectionTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Protocole
                </label>
                <select
                  value={formData.connection.protocol}
                  onChange={(e) => updateField('connection.protocol', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="dicom">DICOM</option>
                  <option value="hl7">HL7</option>
                  <option value="api">API REST</option>
                  <option value="file-based">Fichiers</option>
                  <option value="proprietary">Propriétaire</option>
                  <option value="manual">Manuel</option>
                </select>
              </div>

              {formData.connection.type === 'network' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adresse IP
                    </label>
                    <input
                      type="text"
                      value={formData.connection.ipAddress}
                      onChange={(e) => updateField('connection.ipAddress', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={formData.connection.port}
                      onChange={(e) => updateField('connection.port', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="104"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Integration Method */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Méthode d'intégration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Méthode *
                </label>
                <select
                  required
                  value={formData.integration.method}
                  onChange={(e) => updateField('integration.method', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {integrationMethods.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.integration.enabled}
                    onChange={(e) => updateField('integration.enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Activer l'intégration</span>
                </label>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Localisation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Établissement
                </label>
                <input
                  type="text"
                  value={formData.location.facility}
                  onChange={(e) => updateField('location.facility', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Clinique Principale"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salle
                </label>
                <input
                  type="text"
                  value={formData.location.room}
                  onChange={(e) => updateField('location.room', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Salle 101"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Ajouter l'appareil
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceManager;
