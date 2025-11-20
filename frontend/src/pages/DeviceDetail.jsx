import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  CheckCircle,
  Clock,
  Database,
  FileText,
  FolderSync,
  Link,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  Upload,
  Wifi,
  XCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import deviceService from '../services/deviceService';
import { toast } from 'react-toastify';

const DeviceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  

  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [showSecrets, setShowSecrets] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    deviceId: '',
    type: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
    ipAddress: '',
    active: true,
    integration: {
      method: 'none',
      webhook: {
        enabled: false,
        url: '',
        apiKey: '',
        secret: '',
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2
        }
      },
      folderSync: {
        enabled: false,
        sharedFolderPath: '',
        filePattern: '*.csv',
        fileFormat: 'csv',
        syncSchedule: '0 */1 * * *',
        processedFolder: '',
        errorFolder: ''
      }
    }
  });

  useEffect(() => {
    loadDevice();
    loadStats();
  }, [id]);

  const loadDevice = async () => {
    try {
      const response = await deviceService.getDevice(id);
      const deviceData = response.data;
      setDevice(deviceData);
      setFormData({
        ...deviceData,
        integration: {
          ...deviceData.integration,
          webhook: {
            enabled: deviceData.integration?.webhook?.enabled || false,
            url: deviceData.integration?.webhook?.url || '',
            apiKey: deviceData.integration?.webhook?.apiKey || '',
            secret: deviceData.integration?.webhook?.secret || '',
            retryPolicy: {
              maxAttempts: deviceData.integration?.webhook?.retryPolicy?.maxAttempts || 3,
              backoffMultiplier: deviceData.integration?.webhook?.retryPolicy?.backoffMultiplier || 2
            }
          },
          folderSync: {
            enabled: deviceData.integration?.folderSync?.enabled || false,
            sharedFolderPath: deviceData.integration?.folderSync?.sharedFolderPath || '',
            filePattern: deviceData.integration?.folderSync?.filePattern || '*.csv',
            fileFormat: deviceData.integration?.folderSync?.fileFormat || 'csv',
            syncSchedule: deviceData.integration?.folderSync?.syncSchedule || '0 */1 * * *',
            processedFolder: deviceData.integration?.folderSync?.processedFolder || '',
            errorFolder: deviceData.integration?.folderSync?.errorFolder || ''
          }
        }
      });
    } catch (err) {
      toast.error('Failed to load device');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await deviceService.getDeviceStats(id);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await deviceService.updateDevice(id, formData);
      toast.success('Device updated successfully');
      await loadDevice();
    } catch (err) {
      toast.error(`Failed to update device: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      const response = await deviceService.syncDeviceFolder(id);
      toast.success(
        `Sync completed: ${response.recordsProcessed} processed, ${response.recordsFailed} failed`
      );
      await loadDevice();
      await loadStats();
    } catch (err) {
      toast.error(`Sync failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateWebhook = async () => {
    try {
      const response = await deviceService.generateWebhookCredentials(id);
      setFormData(prev => ({
        ...prev,
        integration: {
          ...prev.integration,
          webhook: {
            ...prev.integration.webhook,
            url: response.webhookUrl,
            apiKey: response.apiKey,
            secret: response.secret
          }
        }
      }));
      toast.success('Webhook credentials generated');
    } catch (err) {
      toast.error('Failed to generate webhook credentials');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleInputChange = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/devices')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{device?.name}</h1>
            <p className="text-gray-600 mt-1">
              {device?.manufacturer} {device?.model}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {formData.integration?.method === 'folder-sync' &&
            formData.integration?.folderSync?.enabled && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                Sync Now
              </button>
            )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Measurements</p>
                <p className="text-2xl font-bold">{stats.totalMeasurements || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-3">
              <Upload className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Files Processed</p>
                <p className="text-2xl font-bold">
                  {device?.integration?.folderSync?.filesProcessed || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold">
                  {device?.integration?.folderSync?.filesFailed || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Last Sync</p>
                <p className="text-sm font-medium">
                  {device?.integration?.lastSync
                    ? new Date(device.integration.lastSync).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <div className="flex gap-1 p-1">
            {['general', 'integration', 'webhook', 'folder-sync'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab
                  .split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Device Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Device ID *
                  </label>
                  <input
                    type="text"
                    value={formData.deviceId}
                    onChange={e => handleInputChange('deviceId', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => handleInputChange('type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Type</option>
                    <option value="oct">OCT</option>
                    <option value="tonometer">Tonometer</option>
                    <option value="auto-refractor">Auto Refractor</option>
                    <option value="keratometer">Keratometer</option>
                    <option value="perimeter">Perimeter</option>
                    <option value="fundus-camera">Fundus Camera</option>
                    <option value="topographer">Topographer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={e => handleInputChange('manufacturer', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={e => handleInputChange('model', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={e => handleInputChange('serialNumber', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => handleInputChange('location', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Address
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={e => handleInputChange('ipAddress', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="192.168.1.100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={e => handleInputChange('active', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700">
                  Device Active
                </label>
              </div>
            </div>
          )}

          {/* Integration Tab */}
          {activeTab === 'integration' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Integration Method
                </label>
                <select
                  value={formData.integration?.method || 'none'}
                  onChange={e =>
                    handleInputChange('integration.method', e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="none">None</option>
                  <option value="webhook">Webhook (Real-time Push)</option>
                  <option value="folder-sync">Folder Sync (Scheduled)</option>
                  <option value="manual">Manual Import</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.integration?.method === 'webhook' &&
                    'Device pushes data to webhook endpoint in real-time'}
                  {formData.integration?.method === 'folder-sync' &&
                    'System polls shared folder on schedule'}
                  {formData.integration?.method === 'manual' &&
                    'Staff manually uploads files via UI'}
                  {formData.integration?.method === 'none' && 'No automatic integration'}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Integration Status</p>
                    <p>
                      Current Status:{' '}
                      <span className="font-semibold">
                        {device?.integration?.status || 'Not Configured'}
                      </span>
                    </p>
                    {device?.integration?.consecutiveErrors > 0 && (
                      <p className="text-red-600 mt-1">
                        ⚠️ {device.integration.consecutiveErrors} consecutive errors
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Webhook Tab */}
          {activeTab === 'webhook' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="webhookEnabled"
                    checked={formData.integration?.webhook?.enabled || false}
                    onChange={e =>
                      handleInputChange('integration.webhook.enabled', e.target.checked)
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="webhookEnabled"
                    className="text-sm font-medium text-gray-700"
                  >
                    Enable Webhook Integration
                  </label>
                </div>

                <button
                  onClick={handleGenerateWebhook}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Generate Credentials
                </button>
              </div>

              {formData.integration?.webhook?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.integration.webhook.url}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        onClick={() =>
                          copyToClipboard(
                            formData.integration.webhook.url,
                            'Webhook URL'
                          )
                        }
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={formData.integration.webhook.apiKey}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                      />
                      <button
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        {showSecrets ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            formData.integration.webhook.apiKey,
                            'API Key'
                          )
                        }
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook Secret (for HMAC signature)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={formData.integration.webhook.secret}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                      />
                      <button
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        {showSecrets ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            formData.integration.webhook.secret,
                            'Secret'
                          )
                        }
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Retry Attempts
                      </label>
                      <input
                        type="number"
                        value={formData.integration.webhook.retryPolicy.maxAttempts}
                        onChange={e =>
                          handleInputChange(
                            'integration.webhook.retryPolicy.maxAttempts',
                            parseInt(e.target.value)
                          )
                        }
                        min="1"
                        max="10"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Backoff Multiplier
                      </label>
                      <input
                        type="number"
                        value={formData.integration.webhook.retryPolicy.backoffMultiplier}
                        onChange={e =>
                          handleInputChange(
                            'integration.webhook.retryPolicy.backoffMultiplier',
                            parseInt(e.target.value)
                          )
                        }
                        min="1"
                        max="10"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Folder Sync Tab */}
          {activeTab === 'folder-sync' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="folderSyncEnabled"
                  checked={formData.integration?.folderSync?.enabled || false}
                  onChange={e =>
                    handleInputChange(
                      'integration.folderSync.enabled',
                      e.target.checked
                    )
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label
                  htmlFor="folderSyncEnabled"
                  className="text-sm font-medium text-gray-700"
                >
                  Enable Folder Sync
                </label>
              </div>

              {formData.integration?.folderSync?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shared Folder Path *
                    </label>
                    <input
                      type="text"
                      value={formData.integration.folderSync.sharedFolderPath}
                      onChange={e =>
                        handleInputChange(
                          'integration.folderSync.sharedFolderPath',
                          e.target.value
                        )
                      }
                      placeholder="/path/to/shared/folder or \\\\server\\share\\folder"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Pattern
                      </label>
                      <input
                        type="text"
                        value={formData.integration.folderSync.filePattern}
                        onChange={e =>
                          handleInputChange(
                            'integration.folderSync.filePattern',
                            e.target.value
                          )
                        }
                        placeholder="*.csv"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Format
                      </label>
                      <select
                        value={formData.integration.folderSync.fileFormat}
                        onChange={e =>
                          handleInputChange(
                            'integration.folderSync.fileFormat',
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                        <option value="xml">XML</option>
                        <option value="dicom">DICOM</option>
                        <option value="hl7">HL7</option>
                        <option value="txt">Text</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sync Schedule (Cron)
                    </label>
                    <input
                      type="text"
                      value={formData.integration.folderSync.syncSchedule}
                      onChange={e =>
                        handleInputChange(
                          'integration.folderSync.syncSchedule',
                          e.target.value
                        )
                      }
                      placeholder="0 */1 * * *"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Cron expression (e.g., "0 */1 * * *" = every hour)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Processed Folder
                      </label>
                      <input
                        type="text"
                        value={formData.integration.folderSync.processedFolder}
                        onChange={e =>
                          handleInputChange(
                            'integration.folderSync.processedFolder',
                            e.target.value
                          )
                        }
                        placeholder="Auto-generated if empty"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Error Folder
                      </label>
                      <input
                        type="text"
                        value={formData.integration.folderSync.errorFolder}
                        onChange={e =>
                          handleInputChange(
                            'integration.folderSync.errorFolder',
                            e.target.value
                          )
                        }
                        placeholder="Auto-generated if empty"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate(`/devices/${id}/logs`)}
          className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-5 h-5 text-gray-600" />
          <span className="font-medium">View Integration Logs</span>
        </button>

        <button
          onClick={() => navigate(`/devices/${id}/import`)}
          className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Upload className="w-5 h-5 text-gray-600" />
          <span className="font-medium">Manual Import</span>
        </button>

        <button
          onClick={() => navigate(`/devices/${id}/stats`)}
          className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Activity className="w-5 h-5 text-gray-600" />
          <span className="font-medium">Statistics & Analytics</span>
        </button>
      </div>
    </div>
  );
};

export default DeviceDetail;
