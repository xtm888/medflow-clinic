import { useState, useEffect } from 'react';
import {
  Network,
  Search,
  Wifi,
  WifiOff,
  HardDrive,
  Server,
  RefreshCw,
  Plus,
  Check,
  X,
  AlertTriangle,
  FolderOpen,
  Eye,
  ChevronDown,
  ChevronRight,
  Loader2,
  Zap,
  Monitor
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/apiConfig';

/**
 * Network Discovery Page
 * Allows admin to discover and configure medical devices on the network
 */
export default function NetworkDiscovery() {
  const [scanning, setScanning] = useState(false);
  const [networkRange, setNetworkRange] = useState('');
  const [networkInfo, setNetworkInfo] = useState(null);
  const [discoveryResults, setDiscoveryResults] = useState(null);
  const [selectedShares, setSelectedShares] = useState(new Set());
  const [expandedShare, setExpandedShare] = useState(null);
  const [shareStructure, setShareStructure] = useState({});
  const [probingShare, setProbingShare] = useState(null);
  const [quickScanResults, setQuickScanResults] = useState(null);
  const [creatingDevices, setCreatingDevices] = useState(false);
  const [ocrStatus, setOcrStatus] = useState(null);
  const [processorStats, setProcessorStats] = useState(null);

  // Load initial status on mount
  useEffect(() => {
    loadNetworkInfo();
    loadDiscoveryStatus();
    checkOCRStatus();
    loadProcessorStats();
  }, []);

  // Auto-detect current network
  const loadNetworkInfo = async () => {
    try {
      const response = await api.get('/devices/discovery/network-info');
      if (response.data.success) {
        setNetworkInfo(response.data.data);
        // Set the auto-detected network as default
        setNetworkRange(response.data.data.defaultRange);
      }
    } catch (error) {
      console.error('Error loading network info:', error);
      // Fallback
      setNetworkRange('192.168.1.0/24');
    }
  };

  const loadDiscoveryStatus = async () => {
    try {
      const response = await api.get('/devices/discovery/status');
      if (response.data.success && response.data.data.shares?.length > 0) {
        setDiscoveryResults({
          shares: response.data.data.shares,
          timestamp: response.data.data.timestamp
        });
      }
    } catch (error) {
      console.error('Error loading discovery status:', error);
    }
  };

  const checkOCRStatus = async () => {
    try {
      const response = await api.get('/devices/ocr/status');
      setOcrStatus(response.data.data);
    } catch {
      setOcrStatus({ available: false });
    }
  };

  const loadProcessorStats = async () => {
    try {
      const response = await api.get('/devices/processor/stats');
      setProcessorStats(response.data.data);
    } catch (error) {
      console.error('Error loading processor stats:', error);
    }
  };

  const startNetworkDiscovery = async () => {
    setScanning(true);
    setDiscoveryResults(null);

    try {
      // Use longer timeout for network discovery (10 minutes for large networks)
      const response = await api.post('/devices/discover-network', {
        networkRange,
        timeout: 2000  // Per-host timeout
      }, {
        timeout: 600000  // 10 minute overall timeout (42+ hosts can take 7+ minutes)
      });

      if (response.data.success) {
        setDiscoveryResults(response.data.data);
        toast.success(`Discovered ${response.data.data.medicalShares} medical device shares`);
      } else {
        toast.error(response.data.error || 'Discovery failed');
      }
    } catch (error) {
      console.error('Discovery error:', error);
      toast.error('Network discovery failed');
    } finally {
      setScanning(false);
    }
  };

  const quickScanDevices = async () => {
    try {
      const response = await api.post('/devices/discovery/quick-scan');
      if (response.data.success) {
        setQuickScanResults(response.data);
        toast.success(`Quick scan: ${response.data.summary.accessible}/${response.data.summary.total} devices reachable`);
      }
    } catch (error) {
      console.error('Quick scan error:', error);
      toast.error('Quick scan failed');
    }
  };

  const probeShare = async (share) => {
    setProbingShare(share.fullPath);
    try {
      const response = await api.post('/devices/discovery/probe-share', {
        sharePath: share.fullPath,
        maxDepth: 2
      });

      if (response.data.success) {
        setShareStructure(prev => ({
          ...prev,
          [share.fullPath]: response.data.data
        }));
        setExpandedShare(share.fullPath);
      }
    } catch (error) {
      console.error('Probe error:', error);
      toast.error('Failed to probe share structure');
    } finally {
      setProbingShare(null);
    }
  };

  const toggleShareSelection = (sharePath) => {
    const newSelected = new Set(selectedShares);
    if (newSelected.has(sharePath)) {
      newSelected.delete(sharePath);
    } else {
      newSelected.add(sharePath);
    }
    setSelectedShares(newSelected);
  };

  const createDevicesFromSelected = async () => {
    if (selectedShares.size === 0) {
      toast.warning('Select at least one share to create devices');
      return;
    }

    setCreatingDevices(true);
    try {
      const sharesToCreate = discoveryResults.shares.filter(s =>
        selectedShares.has(s.fullPath)
      );

      const response = await api.post('/devices/discovery/create-devices', {
        shares: sharesToCreate,
        options: { updateExisting: false }
      });

      if (response.data.success) {
        const { created, updated, skipped, errors } = response.data.data;
        toast.success(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
        if (errors.length > 0) {
          toast.warning(`${errors.length} errors occurred`);
        }
        setSelectedShares(new Set());
      }
    } catch (error) {
      console.error('Create devices error:', error);
      toast.error('Failed to create devices');
    } finally {
      setCreatingDevices(false);
    }
  };

  const getDeviceIcon = (deviceInfo) => {
    if (!deviceInfo?.detected) return <HardDrive className="h-5 w-5 text-gray-400" />;

    switch (deviceInfo.type) {
      case 'oct':
        return <Eye className="h-5 w-5 text-blue-500" />;
      case 'fundus-camera':
        return <Monitor className="h-5 w-5 text-green-500" />;
      case 'biometer':
        return <Zap className="h-5 w-5 text-purple-500" />;
      default:
        return <Server className="h-5 w-5 text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="h-7 w-7 text-indigo-600" />
            Découverte Réseau
          </h1>
          <p className="text-gray-600 mt-1">
            Discover and configure medical imaging devices on your network
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={quickScanDevices}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Wifi className="h-4 w-4" />
            Quick Scan
          </button>
          <button
            onClick={() => {
              loadProcessorStats();
              checkOCRStatus();
            }}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* OCR Service Status */}
        <div className={`card ${ocrStatus?.available ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">OCR Service</p>
              <p className="text-lg font-semibold">
                {ocrStatus?.available ? 'Connected' : 'Disconnected'}
              </p>
            </div>
            {ocrStatus?.available ? (
              <Check className="h-8 w-8 text-green-500" />
            ) : (
              <X className="h-8 w-8 text-red-500" />
            )}
          </div>
          {ocrStatus?.version && (
            <p className="text-xs text-gray-400 mt-1">Version: {ocrStatus.version}</p>
          )}
        </div>

        {/* Processor Stats */}
        <div className="card border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Files Processed</p>
              <p className="text-lg font-semibold">
                {processorStats?.totalProcessed || 0}
              </p>
            </div>
            <HardDrive className="h-8 w-8 text-indigo-500" />
          </div>
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            <span className="text-green-600">DICOM: {processorStats?.dicomSuccess || 0}</span>
            <span className="text-blue-600">OCR: {processorStats?.ocrSuccess || 0}</span>
            <span className="text-red-600">Failed: {processorStats?.failed || 0}</span>
          </div>
        </div>

        {/* Quick Scan Results */}
        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Devices Reachable</p>
              <p className="text-lg font-semibold">
                {quickScanResults ? (
                  `${quickScanResults.summary.accessible}/${quickScanResults.summary.total}`
                ) : (
                  'Not scanned'
                )}
              </p>
            </div>
            <Wifi className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Network Discovery Section */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-600" />
          Discover Network Shares
        </h2>

        {/* Current Network Info */}
        {networkInfo?.primary && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Connected: {networkInfo.primary.ip} ({networkInfo.primary.interface})
                </p>
                <p className="text-xs text-green-600">
                  Scanning network: {networkInfo.primary.networkRange}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Network Range (auto-detected)
            </label>
            <input
              type="text"
              value={networkRange}
              onChange={(e) => setNetworkRange(e.target.value)}
              placeholder="192.168.x.0/24"
              className="input w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Change this to scan a different network
            </p>
          </div>
          <div className="flex items-end pb-5">
            <button
              onClick={startNetworkDiscovery}
              disabled={scanning || !networkRange}
              className="btn btn-primary flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Start Discovery
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scanning Progress */}
        {scanning && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-blue-800">Scanning network...</p>
                <p className="text-sm text-blue-600">
                  This may take a few minutes depending on network size
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Discovery Results */}
        {discoveryResults && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600">
                Found <span className="font-semibold">{discoveryResults.shares?.length || 0}</span> medical device shares
                {discoveryResults.timestamp && (
                  <span className="ml-2 text-gray-400">
                    ({new Date(discoveryResults.timestamp).toLocaleTimeString()})
                  </span>
                )}
              </div>
              {selectedShares.size > 0 && (
                <button
                  onClick={createDevicesFromSelected}
                  disabled={creatingDevices}
                  className="btn btn-primary btn-sm flex items-center gap-1"
                >
                  {creatingDevices ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Create {selectedShares.size} Device(s)
                </button>
              )}
            </div>

            {/* Shares List */}
            <div className="space-y-2">
              {discoveryResults.shares?.map((share, index) => (
                <div
                  key={share.fullPath || index}
                  className={`border rounded-lg overflow-hidden ${
                    selectedShares.has(share.fullPath)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Share Header */}
                  <div className="p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedShares.has(share.fullPath)}
                      onChange={() => toggleShareSelection(share.fullPath)}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />

                    {getDeviceIcon(share.deviceInfo)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{share.name}</span>
                        {share.deviceInfo?.detected && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                            {share.deviceInfo.manufacturer}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {share.fullPath}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {share.deviceInfo?.type && (
                        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                          {share.deviceInfo.type}
                        </span>
                      )}
                      <button
                        onClick={() => probeShare(share)}
                        disabled={probingShare === share.fullPath}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Probe structure"
                      >
                        {probingShare === share.fullPath ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : expandedShare === share.fullPath ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Structure */}
                  {expandedShare === share.fullPath && shareStructure[share.fullPath] && (
                    <div className="border-t border-gray-200 bg-gray-50 p-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Files</p>
                          <p className="font-semibold">{shareStructure[share.fullPath].totalFiles}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Est. Patients</p>
                          <p className="font-semibold">{shareStructure[share.fullPath].estimatedPatients}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Folders</p>
                          <p className="font-semibold">{shareStructure[share.fullPath].folders?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">File Types</p>
                          <p className="font-semibold">
                            {Object.keys(shareStructure[share.fullPath].fileTypes || {}).join(', ') || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {shareStructure[share.fullPath].sampleFiles?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">Sample files:</p>
                          <div className="flex flex-wrap gap-1">
                            {shareStructure[share.fullPath].sampleFiles.slice(0, 5).map((file, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs bg-white rounded border">
                                {file}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {discoveryResults.shares?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <WifiOff className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No medical device shares found</p>
                  <p className="text-sm">Try a different network range or check network connectivity</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Scan Results Table */}
      {quickScanResults?.data?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wifi className="h-5 w-5 text-gray-600" />
            Device Connectivity Status
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Device</th>
                  <th className="text-left p-3">IP Address</th>
                  <th className="text-left p-3">Share Path</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quickScanResults.data.map((device, index) => (
                  <tr key={device.deviceId || index} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{device.name}</td>
                    <td className="p-3 text-gray-600">{device.ip}</td>
                    <td className="p-3 text-gray-500 truncate max-w-xs">{device.sharePath}</td>
                    <td className="p-3 text-center">
                      {device.accessible ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                          <Check className="h-3 w-3" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs">
                          <X className="h-3 w-3" />
                          Unreachable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="card bg-gray-50">
        <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Tips for Device Discovery
        </h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Ensure network shares are accessible from this server</li>
          <li>Common medical devices (ZEISS, NIDEK, TOMEY, etc.) are auto-detected</li>
          <li>Use &quot;Probe structure&quot; to see file counts and types before creating devices</li>
          <li>Created devices will have folder sync disabled by default - enable manually</li>
          <li>The OCR service must be running for advanced file processing</li>
        </ul>
      </div>
    </div>
  );
}
