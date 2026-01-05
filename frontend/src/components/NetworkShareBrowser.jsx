/**
 * Network Share Browser Component
 *
 * Allows browsing files on mounted network shares (SMB/CIFS)
 * and linking legacy patient files to MedFlow patient records.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Folder,
  File,
  FileImage,
  FileText,
  ChevronRight,
  ChevronLeft,
  Home,
  RefreshCw,
  Link2,
  Search,
  X,
  Download,
  Eye,
  Server,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import api from '../services/apiConfig';

export default function NetworkShareBrowser({
  deviceId,
  onFileSelect,
  onLinkToPatient,
  patientContext,
  mode = 'browse' // 'browse' | 'select' | 'link'
}) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState({ directories: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [mountStatus, setMountStatus] = useState({});

  // Load available devices
  useEffect(() => {
    loadDevices();
  }, []);

  // Load specific device if provided
  useEffect(() => {
    if (deviceId && devices.length > 0) {
      const device = devices.find(d => d._id === deviceId);
      if (device) {
        setSelectedDevice(device);
        browseFolder('');
      }
    }
  }, [deviceId, devices]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/devices', {
        params: { type: 'file_server,specular_microscope,biometry,oct,document_share' }
      });
      // Safely extract array from various API response formats
      const rawDevices = response?.data?.data ?? response?.data ?? [];
      const deviceList = Array.isArray(rawDevices) ? rawDevices : [];
      setDevices(deviceList);

      // Check mount status for all devices in parallel (instead of sequential)
      const statusPromises = deviceList.map(device =>
        api.get(`/devices/${device._id}/mount-status`)
          .then(res => ({ deviceId: device._id, status: res.data.data }))
          .catch(() => ({ deviceId: device._id, status: null }))
      );

      const statuses = await Promise.all(statusPromises);
      const statusMap = {};
      statuses.forEach(({ deviceId, status }) => {
        if (status) statusMap[deviceId] = status;
      });
      setMountStatus(prev => ({ ...prev, ...statusMap }));
    } catch (err) {
      setError('Impossible de charger les appareils');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const browseFolder = async (path) => {
    if (!selectedDevice) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/devices/${selectedDevice._id}/browse`, {
        params: { subpath: path }
      });

      setContents(response.data.data);
      setCurrentPath(path);
    } catch (err) {
      if (err.response?.status === 400) {
        setError('Le partage réseau n\'est pas monté. Cliquez sur "Monter" pour l\'activer.');
      } else {
        setError(err.response?.data?.error || 'Erreur de navigation');
      }
    } finally {
      setLoading(false);
    }
  };

  const mountShare = async (device) => {
    try {
      setLoading(true);
      await api.post(`/devices/${device._id}/mount`);
      // Reload mount status
      const statusRes = await api.get(`/devices/${device._id}/mount-status`);
      setMountStatus(prev => ({
        ...prev,
        [device._id]: statusRes.data.data
      }));
      // Browse if this is the selected device
      if (selectedDevice?._id === device._id) {
        browseFolder('');
      }
    } catch (err) {
      setError('Échec du montage: ' + (err.response?.data?.details || err.message));
    } finally {
      setLoading(false);
    }
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    browseFolder(parentPath);
  };

  const handleFileClick = (file) => {
    if (mode === 'select') {
      // Toggle selection
      const isSelected = selectedFiles.some(f => f.path === file.path);
      if (isSelected) {
        setSelectedFiles(selectedFiles.filter(f => f.path !== file.path));
      } else {
        setSelectedFiles([...selectedFiles, file]);
      }
    } else if (file.isImage || file.isPdf) {
      setPreviewFile(file);
    } else if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const getFileUrl = (file) => {
    if (!selectedDevice) return '';
    return `${api.defaults.baseURL}/devices/${selectedDevice._id}/files/${encodeURIComponent(file.path)}`;
  };

  const handleLinkToPatient = async () => {
    if (!patientContext || selectedFiles.length === 0) return;

    try {
      // Create folder mapping for patient
      for (const file of selectedFiles) {
        await api.post(`/devices/legacy/patients/${patientContext._id}/map`, {
          deviceType: selectedDevice.type,
          folderId: currentPath || file.path.split('/')[0],
          folderPath: file.path
        });
      }

      if (onLinkToPatient) {
        onLinkToPatient(selectedFiles);
      }

      setSelectedFiles([]);
    } catch (err) {
      setError('Échec de la liaison: ' + (err.response?.data?.error || err.message));
    }
  };

  // Memoize filtered contents to avoid O(n) filtering on every render
  const filteredDirs = useMemo(() =>
    contents.directories?.filter(d =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [contents.directories, searchTerm]
  );

  const filteredFiles = useMemo(() =>
    contents.files?.filter(f =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [contents.files, searchTerm]
  );

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (file) => {
    if (file.isImage) return <FileImage className="w-5 h-5 text-blue-500" />;
    if (file.isPdf) return <FileText className="w-5 h-5 text-red-500" />;
    if (file.isXml) return <File className="w-5 h-5 text-orange-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gray-500" />
            Partages Réseau
          </h3>
          <button
            onClick={loadDevices}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Device selector */}
        {!deviceId && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {devices.map(device => {
              const status = mountStatus[device._id];
              const isMounted = status?.mounted;

              return (
                <button
                  key={device._id}
                  onClick={() => {
                    setSelectedDevice(device);
                    if (isMounted) {
                      browseFolder('');
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap transition ${
                    selectedDevice?._id === device._id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  <span className="text-sm">{device.name}</span>
                  {isMounted ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation bar */}
      {selectedDevice && (
        <div className="p-3 bg-gray-50 border-b flex items-center gap-2">
          <button
            onClick={() => browseFolder('')}
            className="p-1.5 hover:bg-gray-200 rounded transition"
            title="Racine"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={navigateUp}
            disabled={!currentPath}
            className="p-1.5 hover:bg-gray-200 rounded transition disabled:opacity-50"
            title="Dossier parent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-600 overflow-x-auto flex-1">
            <span className="font-medium">{selectedDevice.name}</span>
            {currentPath && (
              <>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
                {currentPath.split('/').map((part, idx, arr) => (
                  <span key={idx} className="flex items-center gap-1">
                    <button
                      onClick={() => browseFolder(arr.slice(0, idx + 1).join('/'))}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {part}
                    </button>
                    {idx < arr.length - 1 && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                  </span>
                ))}
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 pr-3 py-1.5 text-sm border rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="min-h-[300px] max-h-[500px] overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">{error}</p>
            {selectedDevice && !mountStatus[selectedDevice._id]?.mounted && (
              <button
                onClick={() => mountShare(selectedDevice)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Monter le partage
              </button>
            )}
          </div>
        ) : !selectedDevice ? (
          <div className="p-8 text-center text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Sélectionnez un appareil pour parcourir ses fichiers</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Directories */}
            {filteredDirs.map(dir => (
              <button
                key={dir.path}
                onClick={() => browseFolder(dir.path)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
              >
                <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <span className="flex-1 truncate font-medium">{dir.name}</span>
                <span className="text-xs text-gray-400">{formatDate(dir.modified)}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}

            {/* Files */}
            {filteredFiles.map(file => {
              const isSelected = selectedFiles.some(f => f.path === file.path);

              return (
                <div
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer ${
                    isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  {getFileIcon(file)}
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                  <span className="text-xs text-gray-400">{formatDate(file.modified)}</span>
                  <div className="flex gap-1">
                    {(file.isImage || file.isPdf) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFile(file);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Aperçu"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    <a
                      href={getFileUrl(file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Télécharger"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </a>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {filteredDirs.length === 0 && filteredFiles.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Ce dossier est vide</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - Link to patient action */}
      {mode === 'link' && patientContext && selectedFiles.length > 0 && (
        <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {selectedFiles.length} fichier(s) sélectionné(s)
          </span>
          <button
            onClick={handleLinkToPatient}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Link2 className="w-4 h-4" />
            Lier à {patientContext.firstName} {patientContext.lastName}
          </button>
        </div>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-medium truncate">{previewFile.name}</h4>
              <div className="flex gap-2">
                <a
                  href={getFileUrl(previewFile)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center bg-gray-100 max-h-[calc(90vh-80px)] overflow-auto">
              {previewFile.isImage ? (
                <img
                  src={getFileUrl(previewFile)}
                  alt={previewFile.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : previewFile.isPdf ? (
                <iframe
                  src={getFileUrl(previewFile)}
                  className="w-full h-[70vh]"
                  title={previewFile.name}
                />
              ) : (
                <p className="text-gray-500">Aperçu non disponible</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
