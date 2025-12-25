/**
 * Import Wizard - Medical Imaging Import with OCR
 * Multi-step wizard for importing files from network shares
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logger from '../services/logger';
import {
  FolderOpen,
  HardDrive,
  Users,
  FileSearch,
  Upload,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  X,
  Loader2,
  Eye,
  Server
} from 'lucide-react';
import { toast } from 'react-toastify';
import ocrImportService from '../services/ocrImportService';

const DEVICE_TYPES = [
  { value: 'zeiss', label: 'Zeiss CLARUS / RETINO', icon: '📷', description: 'Imagerie du fond d\'oeil' },
  { value: 'solix', label: 'Optovue Solix OCT', icon: '🔬', description: 'Tomographie par cohérence optique' },
  { value: 'tomey', label: 'TOMEY', icon: '🌐', description: 'Topographie cornéenne' },
  { value: 'quantel', label: 'Quantel', icon: '📡', description: 'Échographie oculaire' },
  { value: 'generic', label: 'Autre appareil', icon: '📁', description: 'Format générique' }
];

const STEPS = [
  { id: 1, title: 'Source', description: 'Sélectionner le dossier source' },
  { id: 2, title: 'Aperçu', description: 'Prévisualiser les patients' },
  { id: 3, title: 'Configuration', description: 'Paramètres d\'import' },
  { id: 4, title: 'Import', description: 'Traitement en cours' }
];

const ImportWizard = () => {
  const navigate = useNavigate();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Source selection
  const [networkShares, setNetworkShares] = useState([]);
  const [selectedShare, setSelectedShare] = useState(null);
  const [customPath, setCustomPath] = useState('');
  const [deviceType, setDeviceType] = useState('generic');
  const [scanResult, setScanResult] = useState(null);

  // Step 2: Patient preview
  const [patientPreview, setPatientPreview] = useState(null);
  const [selectedPatients, setSelectedPatients] = useState(new Set());

  // Step 3: Configuration
  const [maxPatients, setMaxPatients] = useState(20);
  const [maxFilesPerPatient, setMaxFilesPerPatient] = useState(10);

  // Step 4: Import progress
  const [importTaskId, setImportTaskId] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importComplete, setImportComplete] = useState(false);

  // Load network shares on mount
  useEffect(() => {
    loadNetworkShares();
  }, []);

  // Poll import status
  useEffect(() => {
    if (!importTaskId || importComplete) return;

    const interval = setInterval(async () => {
      try {
        const result = await ocrImportService.getImportStatus(importTaskId);
        setImportProgress(result.data);

        if (result.data.status === 'success' || result.data.status === 'failure') {
          setImportComplete(true);
          clearInterval(interval);

          if (result.data.status === 'success') {
            toast.success(`Import terminé: ${result.data.processed_files} fichiers traités`);
          } else {
            toast.error('Erreur lors de l\'import');
          }
        }
      } catch (err) {
        logger.error('Error polling status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [importTaskId, importComplete]);

  const loadNetworkShares = async () => {
    try {
      logger.debug('[ImportWizard] Loading network shares...');
      const result = await ocrImportService.getNetworkShares();
      logger.debug('[ImportWizard] API result:', result);
      const shares = result.data || [];
      logger.debug('[ImportWizard] Setting shares:', shares);
      setNetworkShares(shares);
    } catch (err) {
      logger.error('[ImportWizard] Error loading shares:', err);
      logger.error('[ImportWizard] Error details:', err.response?.data || err.message);
      toast.error('Impossible de charger les partages réseau');
    }
  };

  const handleSelectShare = async (share) => {
    setSelectedShare(share);
    setCustomPath(share.path);

    // Auto-detect device type based on share name
    if (share.name.toLowerCase().includes('zeiss')) {
      setDeviceType('zeiss');
    } else if (share.name.toLowerCase().includes('solix')) {
      setDeviceType('solix');
    } else if (share.name.toLowerCase().includes('tomey')) {
      setDeviceType('tomey');
    }
  };

  const handleScanFolder = async () => {
    const path = customPath || selectedShare?.path;
    if (!path) {
      toast.error('Veuillez sélectionner ou saisir un chemin');
      return;
    }

    setLoading(true);
    try {
      const result = await ocrImportService.scanFolder(path, 1000, true);
      setScanResult(result.data);

      if (result.data.total_files === 0) {
        toast.warning('Aucun fichier supporté trouvé dans ce dossier');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors du scan');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPatients = async () => {
    const path = customPath || selectedShare?.path;

    setLoading(true);
    try {
      const result = await ocrImportService.previewPatients(path, deviceType, maxPatients);
      setPatientPreview(result.data);

      // Select all patients by default
      const allKeys = new Set(result.data.patients.map(p => p.patient_key));
      setSelectedPatients(allKeys);

      setCurrentStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la prévisualisation');
    } finally {
      setLoading(false);
    }
  };

  const handleStartImport = async () => {
    const path = customPath || selectedShare?.path;

    setLoading(true);
    try {
      const result = await ocrImportService.startImport(path, deviceType, {
        maxPatients: selectedPatients.size,
        maxFiles: maxFilesPerPatient * selectedPatients.size
      });

      setImportTaskId(result.data.task_id);
      setCurrentStep(4);
      toast.info('Import démarré');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors du démarrage');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelImport = async () => {
    if (!importTaskId) return;

    try {
      await ocrImportService.cancelImport(importTaskId);
      toast.info('Annulation demandée');
    } catch (err) {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const togglePatient = (patientKey) => {
    const newSelected = new Set(selectedPatients);
    if (newSelected.has(patientKey)) {
      newSelected.delete(patientKey);
    } else {
      newSelected.add(patientKey);
    }
    setSelectedPatients(newSelected);
  };

  const selectAllPatients = () => {
    const allKeys = new Set(patientPreview.patients.map(p => p.patient_key));
    setSelectedPatients(allKeys);
  };

  const deselectAllPatients = () => {
    setSelectedPatients(new Set());
  };

  // Render steps
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Network Shares */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" />
          Partages réseau disponibles
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {networkShares.map((share) => (
            <button
              key={share.name}
              onClick={() => handleSelectShare(share)}
              disabled={!share.available}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                selectedShare?.name === share.name
                  ? 'border-blue-500 bg-blue-50'
                  : share.available
                  ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{share.name}</span>
                {share.available ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{share.path}</p>
            </button>
          ))}
        </div>

        {networkShares.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun partage réseau détecté</p>
            <button
              onClick={loadNetworkShares}
              className="mt-2 text-blue-600 hover:text-blue-800"
            >
              Actualiser
            </button>
          </div>
        )}
      </div>

      {/* Custom Path */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ou saisissez un chemin personnalisé
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="/Volumes/..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleScanFolder}
            disabled={loading || !customPath}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
            Scanner
          </button>
        </div>
      </div>

      {/* Scan Results */}
      {scanResult && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Résultats du scan</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Fichiers trouvés</span>
              <p className="text-xl font-bold text-gray-900">{scanResult.total_files}</p>
            </div>
            <div>
              <span className="text-gray-500">Patients estimés</span>
              <p className="text-xl font-bold text-gray-900">{scanResult.estimated_patients}</p>
            </div>
            {Object.entries(scanResult.files_by_type).map(([ext, count]) => (
              <div key={ext}>
                <span className="text-gray-500">{ext}</span>
                <p className="text-lg font-medium text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Device Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type d'appareil source
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DEVICE_TYPES.map((device) => (
            <button
              key={device.value}
              onClick={() => setDeviceType(device.value)}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                deviceType === device.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{device.icon}</span>
                <div>
                  <span className="font-medium text-sm">{device.label}</span>
                  <p className="text-xs text-gray-500">{device.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Patients à importer ({selectedPatients.size}/{patientPreview?.patients?.length || 0})
        </h3>
        <div className="flex gap-2">
          <button onClick={selectAllPatients} className="text-sm text-blue-600 hover:text-blue-800">
            Tout sélectionner
          </button>
          <button onClick={deselectAllPatients} className="text-sm text-gray-600 hover:text-gray-800">
            Tout désélectionner
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
        {patientPreview?.patients?.map((patient) => (
          <div
            key={patient.patient_key}
            onClick={() => togglePatient(patient.patient_key)}
            className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
              selectedPatients.has(patient.patient_key)
                ? 'bg-blue-50'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedPatients.has(patient.patient_key)}
                  onChange={() => {}}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {patient.patient_key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {patient.file_count} fichiers • Dernier: {new Date(patient.latest_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {/* Existing matches indicator */}
              {patient.existing_matches?.length > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  Patient existant
                </span>
              )}
            </div>

            {/* Sample files */}
            <div className="mt-2 flex gap-2 flex-wrap">
              {patient.sample_files?.slice(0, 3).map((file, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  {file}
                </span>
              ))}
              {patient.sample_files?.length > 3 && (
                <span className="text-xs text-gray-400">+{patient.sample_files.length - 3} autres</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Configuration de l'import
      </h3>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Résumé</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Source: {customPath || selectedShare?.path}</li>
          <li>• Type d'appareil: {DEVICE_TYPES.find(d => d.value === deviceType)?.label}</li>
          <li>• Patients sélectionnés: {selectedPatients.size}</li>
          <li>• Fichiers estimés: ~{selectedPatients.size * maxFilesPerPatient}</li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max fichiers par patient
          </label>
          <input
            type="number"
            value={maxFilesPerPatient}
            onChange={(e) => setMaxFilesPerPatient(parseInt(e.target.value) || 10)}
            min={1}
            max={50}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800">Important</h4>
            <p className="text-sm text-yellow-700 mt-1">
              L'import utilise l'OCR pour extraire les informations patient. Les fichiers seront
              automatiquement liés aux patients existants si la correspondance est supérieure à 85%.
              Les fichiers non appariés seront placés dans la file d'attente de révision manuelle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      {!importComplete ? (
        <>
          <div className="text-center py-8">
            <Loader2 className="w-16 h-16 mx-auto text-blue-500 animate-spin" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Import en cours...
            </h3>
            <p className="text-gray-500 mt-2">
              {importProgress?.current_file || 'Initialisation...'}
            </p>
          </div>

          {/* Progress bar */}
          {importProgress && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progression</span>
                <span>
                  {importProgress.processed_files || 0} / {importProgress.total_files || 0} fichiers
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{
                    width: `${
                      importProgress.total_files
                        ? (importProgress.processed_files / importProgress.total_files) * 100
                        : 0
                    }%`
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{importProgress.processed_files || 0}</p>
                  <p className="text-xs text-gray-500">Traités</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{importProgress.unique_patients || 0}</p>
                  <p className="text-xs text-gray-500">Patients</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{importProgress.errors || 0}</p>
                  <p className="text-xs text-gray-500">Erreurs</p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={handleCancelImport}
              className="px-4 py-2 text-red-600 hover:text-red-800"
            >
              Annuler l'import
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Import terminé !
          </h3>

          {importProgress && (
            <div className="mt-6 bg-green-50 rounded-lg p-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{importProgress.processed_files}</p>
                  <p className="text-xs text-gray-500">Fichiers traités</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{importProgress.unique_patients}</p>
                  <p className="text-xs text-gray-500">Patients trouvés</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => navigate('/ocr/review')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Voir la file de révision
            </button>
            <button
              onClick={() => {
                setCurrentStep(1);
                setImportComplete(false);
                setImportTaskId(null);
                setImportProgress(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Nouvel import
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Upload className="w-8 h-8 text-blue-600" />
          Import d'imagerie médicale
        </h1>
        <p className="text-gray-600 mt-1">
          Importez des images depuis vos appareils médicaux avec reconnaissance automatique des patients
        </p>
      </div>

      {/* Steps indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step.id
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-5 h-5 text-gray-300 mx-4" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      {/* Navigation buttons */}
      {currentStep < 4 && (
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>

          {currentStep === 1 && (
            <button
              onClick={handlePreviewPatients}
              disabled={loading || (!selectedShare && !customPath)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Prévisualiser
            </button>
          )}

          {currentStep === 2 && (
            <button
              onClick={() => setCurrentStep(3)}
              disabled={selectedPatients.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              Configurer
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {currentStep === 3 && (
            <button
              onClick={handleStartImport}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Démarrer l'import
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportWizard;
