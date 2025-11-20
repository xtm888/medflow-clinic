import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  File,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Trash2,
  Eye,
  RefreshCw
} from 'lucide-react';
import deviceService from '../services/deviceService';
import patientService from '../services/patientService';
import { toast } from 'react-toastify';

const DeviceImport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  

  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadResults, setUploadResults] = useState([]);

  const [formData, setFormData] = useState({
    patientId: '',
    patientSearch: '',
    examId: '',
    fileFormat: 'csv',
    eye: ''
  });

  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  useEffect(() => {
    loadDevice();
  }, [id]);

  const loadDevice = async () => {
    try {
      const response = await deviceService.getDevice(id);
      setDevice(response.data);

      // Set default file format from device config
      if (response.data.integration?.folderSync?.fileFormat) {
        setFormData(prev => ({
          ...prev,
          fileFormat: response.data.integration.folderSync.fileFormat
        }));
      }
    } catch (err) {
      toast.error('Failed to load device');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setPatientSearchResults([]);
      return;
    }

    setSearchingPatients(true);
    try {
      const response = await patientService.searchPatients(query);
      setPatientSearchResults(response.data || []);
    } catch (err) {
      console.error('Patient search failed:', err);
      setPatientSearchResults([]);
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (formData.patientSearch) {
        searchPatients(formData.patientSearch);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [formData.patientSearch, searchPatients]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const selectPatient = (patient) => {
    setFormData(prev => ({
      ...prev,
      patientId: patient._id,
      patientSearch: `${patient.firstName} ${patient.lastName} - ${patient.mrn}`
    }));
    setPatientSearchResults([]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    if (!formData.patientId) {
      toast.error('Please select a patient');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const results = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        try {
          const response = await deviceService.importMeasurements(
            id,
            file,
            {
              patientId: formData.patientId,
              examId: formData.examId || undefined,
              fileFormat: formData.fileFormat,
              eye: formData.eye || undefined
            },
            (progress) => {
              const overallProgress = ((i + progress / 100) / selectedFiles.length) * 100;
              setUploadProgress(Math.round(overallProgress));
            }
          );

          results.push({
            fileName: file.name,
            status: 'success',
            recordsProcessed: response.recordsProcessed || 0,
            message: response.message || 'Import successful'
          });
        } catch (err) {
          results.push({
            fileName: file.name,
            status: 'error',
            message: err.response?.data?.message || err.message || 'Import failed'
          });
        }
      }

      setUploadResults(results);

      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'error').length;

      if (failCount === 0) {
        toast.success(`Successfully imported ${successCount} file(s)`);
      } else if (successCount === 0) {
        toast.error(`Failed to import all ${failCount} file(s)`);
      } else {
        toast.error(
          `Imported ${successCount} file(s), ${failCount} failed. Check results below.`
        );
      }

      // Clear selected files after upload
      setSelectedFiles([]);
    } catch (err) {
      toast.error('Upload failed');
      console.error(err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/devices/${id}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manual Import</h1>
          <p className="text-gray-600 mt-1">{device?.name}</p>
        </div>
      </div>

      {/* Import Form */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Import Configuration</h2>

        <div className="space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.patientSearch}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    patientSearch: e.target.value,
                    patientId: ''
                  }))
                }
                placeholder="Search by name or MRN..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Patient Search Results Dropdown */}
              {patientSearchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {patientSearchResults.map(patient => (
                    <div
                      key={patient._id}
                      onClick={() => selectPatient(patient)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <p className="font-medium text-gray-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        MRN: {patient.mrn} | DOB:{' '}
                        {new Date(patient.dateOfBirth).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {searchingPatients && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              )}
            </div>
            {formData.patientId && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Patient selected
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Exam ID (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exam ID (Optional)
              </label>
              <input
                type="text"
                value={formData.examId}
                onChange={e =>
                  setFormData(prev => ({ ...prev, examId: e.target.value }))
                }
                placeholder="Link to specific exam"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* File Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Format
              </label>
              <select
                value={formData.fileFormat}
                onChange={e =>
                  setFormData(prev => ({ ...prev, fileFormat: e.target.value }))
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

            {/* Eye */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eye (Optional)
              </label>
              <select
                value={formData.eye}
                onChange={e =>
                  setFormData(prev => ({ ...prev, eye: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Auto-detect</option>
                <option value="OD">Right Eye (OD)</option>
                <option value="OS">Left Eye (OS)</option>
                <option value="OU">Both Eyes (OU)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Files</h2>

        {/* Drag & Drop Zone */}
        <div
          onDrop={handleFileDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
          onClick={() => document.getElementById('fileInput').click()}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supported formats: {formData.fileFormat.toUpperCase()}, and more
          </p>
          <input
            id="fileInput"
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept={
              formData.fileFormat === 'csv'
                ? '.csv'
                : formData.fileFormat === 'json'
                ? '.json'
                : formData.fileFormat === 'xml'
                ? '.xml'
                : formData.fileFormat === 'dicom'
                ? '.dcm,.dicom'
                : '*'
            }
          />
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-3">
              Selected Files ({selectedFiles.length})
            </h3>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button & Progress */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <button
              onClick={handleUpload}
              disabled={uploading || !formData.patientId}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Uploading... {uploadProgress}%
                </span>
              ) : (
                `Upload ${selectedFiles.length} File(s)`
              )}
            </button>

            {uploading && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Results</h2>
          <div className="space-y-3">
            {uploadResults.map((result, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  result.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {result.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{result.fileName}</p>
                  <p
                    className={`text-sm mt-1 ${
                      result.status === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {result.message}
                  </p>
                  {result.recordsProcessed > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Records processed: {result.recordsProcessed}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setUploadResults([])}
            className="mt-4 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Clear Results
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceImport;
