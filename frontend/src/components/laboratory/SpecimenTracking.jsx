import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getPatientName as formatPatientName } from '../../utils/formatters';
import {
  Scan,
  Plus,
  Search,
  Check,
  Clock,
  AlertCircle,
  Printer,
  TestTube,
  User,
  Calendar,
  ArrowRight,
  X,
  RefreshCw,
  Filter,
  QrCode,
  CheckCircle,
  Play,
  Package
} from 'lucide-react';
import laboratoryService from '../../services/laboratoryService';

/**
 * Specimen Tracking Component
 * Manages specimen registration, collection, processing, and tracking
 *
 * Features:
 * - Specimen registration with barcode generation
 * - Barcode scanning for quick lookup
 * - Worklist management
 * - Status workflow tracking
 * - Collection and processing actions
 */
export default function SpecimenTracking({ patients = [] }) {
  // State
  const [worklist, setWorklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scannedSpecimen, setScannedSpecimen] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  // Registration form
  const [registerForm, setRegisterForm] = useState({
    patientId: '',
    testId: '',
    specimenType: 'blood',
    collectionTime: '',
    collectedBy: '',
    notes: '',
    fasting: false,
    tubeType: '',
    volume: ''
  });

  // Barcode input ref for auto-focus
  const barcodeInputRef = useRef(null);

  // Specimen types
  const specimenTypes = [
    { value: 'blood', label: 'Sang', color: 'red' },
    { value: 'serum', label: 'Sérum', color: 'yellow' },
    { value: 'plasma', label: 'Plasma', color: 'orange' },
    { value: 'urine', label: 'Urine', color: 'amber' },
    { value: 'stool', label: 'Selles', color: 'brown' },
    { value: 'csf', label: 'LCR', color: 'blue' },
    { value: 'swab', label: 'Écouvillon', color: 'green' },
    { value: 'tissue', label: 'Tissu', color: 'purple' },
    { value: 'other', label: 'Autre', color: 'gray' }
  ];

  // Tube types
  const tubeTypes = [
    { value: 'red', label: 'Rouge (sans additif)', color: '#EF4444' },
    { value: 'purple', label: 'Violet (EDTA)', color: '#8B5CF6' },
    { value: 'blue', label: 'Bleu (Citrate)', color: '#3B82F6' },
    { value: 'green', label: 'Vert (Héparine)', color: '#10B981' },
    { value: 'yellow', label: 'Jaune (SST/Gel)', color: '#F59E0B' },
    { value: 'gray', label: 'Gris (Fluorure)', color: '#6B7280' },
    { value: 'lavender', label: 'Lavande (EDTA K2)', color: '#A78BFA' },
    { value: 'black', label: 'Noir (ESR)', color: '#1F2937' }
  ];

  // Fetch worklist on mount
  useEffect(() => {
    fetchWorklist();
  }, [statusFilter]);

  const fetchWorklist = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await laboratoryService.getWorklist(params);
      setWorklist(response.data || response || []);
    } catch (error) {
      console.error('Error fetching worklist:', error);
      // Don't show error toast if it's just empty
    } finally {
      setLoading(false);
    }
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode) => {
    if (!barcode || barcode.length < 3) return;

    try {
      setSubmitting(true);
      const response = await laboratoryService.getSpecimenByBarcode(barcode);
      setScannedSpecimen(response.data || response);
      setBarcodeInput('');
      toast.success('Échantillon trouvé!');
    } catch (error) {
      toast.error('Échantillon non trouvé');
      setScannedSpecimen(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle barcode input (enter key or scanner auto-submit)
  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeScan(barcodeInput.trim());
    }
  };

  // Register new specimen
  const handleRegisterSpecimen = async (e) => {
    e.preventDefault();

    if (!registerForm.patientId) {
      toast.error('Veuillez sélectionner un patient');
      return;
    }

    try {
      setSubmitting(true);
      const response = await laboratoryService.registerSpecimen({
        ...registerForm,
        collectionTime: registerForm.collectionTime || new Date().toISOString()
      });

      toast.success('Échantillon enregistré avec succès!');

      // Show barcode if generated
      if (response.data?.barcode || response.barcode) {
        toast.info(`Code-barres: ${response.data?.barcode || response.barcode}`, {
          autoClose: 10000
        });
      }

      setShowRegisterModal(false);
      resetRegisterForm();
      fetchWorklist();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  // Mark specimen as collected
  const handleMarkCollected = async (item) => {
    try {
      setSubmitting(true);
      await laboratoryService.markCollected(
        item._id || item.id,
        item.specimenType || 'blood',
        ''
      );
      toast.success('Échantillon marqué comme collecté');
      fetchWorklist();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  // Start processing specimen
  const handleStartProcessing = async (item) => {
    try {
      setSubmitting(true);
      await laboratoryService.startProcessing(item._id || item.id);
      toast.success('Traitement démarré');
      fetchWorklist();
    } catch (error) {
      toast.error('Erreur lors du démarrage');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset registration form
  const resetRegisterForm = () => {
    setRegisterForm({
      patientId: '',
      testId: '',
      specimenType: 'blood',
      collectionTime: '',
      collectedBy: '',
      notes: '',
      fasting: false,
      tubeType: '',
      volume: ''
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      ordered: { label: 'Commandé', color: 'bg-blue-100 text-blue-700', icon: Clock },
      registered: { label: 'Enregistré', color: 'bg-purple-100 text-purple-700', icon: QrCode },
      collected: { label: 'Collecté', color: 'bg-yellow-100 text-yellow-700', icon: TestTube },
      'in-progress': { label: 'En cours', color: 'bg-orange-100 text-orange-700', icon: Play },
      processing: { label: 'Traitement', color: 'bg-orange-100 text-orange-700', icon: Play },
      completed: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700', icon: X }
    };

    const config = statusConfig[status] || statusConfig.ordered;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </span>
    );
  };

  // Get specimen type badge
  const getSpecimenTypeBadge = (type) => {
    const specimen = specimenTypes.find(s => s.value === type) || specimenTypes[specimenTypes.length - 1];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-${specimen.color}-100 text-${specimen.color}-700`}>
        <TestTube className="h-3 w-3 mr-1" />
        {specimen.label}
      </span>
    );
  };

  // Filter worklist
  const filteredWorklist = worklist.filter(item => {
    if (!searchQuery) return true;
    const patientName = item.patient
      ? `${item.patient.firstName || ''} ${item.patient.lastName || ''}`.toLowerCase()
      : '';
    const barcode = (item.barcode || '').toLowerCase();
    const testName = (item.testName || item.tests?.map(t => t.name).join(' ') || '').toLowerCase();
    return (
      patientName.includes(searchQuery.toLowerCase()) ||
      barcode.includes(searchQuery.toLowerCase()) ||
      testName.includes(searchQuery.toLowerCase())
    );
  });

  // Get patient name helper - uses shared formatter
  const getPatientName = (patient) => {
    if (!patient) return 'Patient inconnu';
    if (typeof patient === 'string') {
      const found = patients.find(p => (p._id || p.id) === patient);
      return found ? formatPatientName(found) : 'Patient inconnu';
    }
    return formatPatientName(patient);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-1 gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par patient, code-barres ou test..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="ordered">Commandé</option>
            <option value="registered">Enregistré</option>
            <option value="collected">Collecté</option>
            <option value="in-progress">En cours</option>
            <option value="completed">Terminé</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchWorklist}
            className="btn btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => setShowScanModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Scan className="h-4 w-4" />
            Scanner
          </button>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      </div>

      {/* Worklist Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600">Chargement...</span>
          </div>
        ) : filteredWorklist.length === 0 ? (
          <div className="text-center py-12">
            <TestTube className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucun échantillon trouvé</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Essayez une autre recherche' : 'Les échantillons apparaîtront ici'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code-barres</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorklist.map((item) => (
                  <tr key={item._id || item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <QrCode className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-mono text-sm">
                          {item.barcode || item.specimenId || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {getPatientName(item.patient)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.testName || item.tests?.map(t => t.name).join(', ') || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      {item.specimenType ? getSpecimenTypeBadge(item.specimenType) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(item.collectionTime || item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Show collect button for ordered/registered specimens */}
                        {['ordered', 'registered'].includes(item.status) && (
                          <button
                            onClick={() => handleMarkCollected(item)}
                            disabled={submitting}
                            className="btn btn-sm btn-secondary flex items-center gap-1"
                            title="Marquer collecté"
                          >
                            <TestTube className="h-3 w-3" />
                            Collecter
                          </button>
                        )}

                        {/* Show process button for collected specimens */}
                        {item.status === 'collected' && (
                          <button
                            onClick={() => handleStartProcessing(item)}
                            disabled={submitting}
                            className="btn btn-sm btn-primary flex items-center gap-1"
                            title="Démarrer traitement"
                          >
                            <Play className="h-3 w-3" />
                            Traiter
                          </button>
                        )}

                        {/* Print barcode button */}
                        {item.barcode && (
                          <button
                            onClick={() => {
                              toast.info(`Impression du code-barres: ${item.barcode}`);
                              // In production, this would trigger actual barcode printing
                            }}
                            className="btn btn-sm btn-secondary"
                            title="Imprimer code-barres"
                          >
                            <Printer className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Workflow Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Flux de travail des échantillons</h4>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
            <Clock className="h-3 w-3 mr-1" /> Commandé
          </span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs">
            <QrCode className="h-3 w-3 mr-1" /> Enregistré
          </span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs">
            <TestTube className="h-3 w-3 mr-1" /> Collecté
          </span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs">
            <Play className="h-3 w-3 mr-1" /> En cours
          </span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-700 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" /> Terminé
          </span>
        </div>
      </div>

      {/* Barcode Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Scan className="h-5 w-5 mr-2 text-purple-600" />
                Scanner un code-barres
              </h2>
              <button
                onClick={() => {
                  setShowScanModal(false);
                  setScannedSpecimen(null);
                  setBarcodeInput('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Barcode Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code-barres de l'échantillon
                </label>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg font-mono"
                  placeholder="Scannez ou entrez le code-barres..."
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisez un scanner ou entrez le code manuellement puis appuyez sur Entrée
                </p>
              </div>

              {/* Search Button */}
              <button
                onClick={() => handleBarcodeScan(barcodeInput.trim())}
                disabled={!barcodeInput.trim() || submitting}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Recherche...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Rechercher
                  </>
                )}
              </button>

              {/* Scanned Result */}
              {scannedSpecimen && (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 mt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-800">Échantillon trouvé</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-gray-500">Code-barres:</span>{' '}
                          <span className="font-mono font-medium">{scannedSpecimen.barcode}</span>
                        </p>
                        <p>
                          <span className="text-gray-500">Patient:</span>{' '}
                          <span className="font-medium">{getPatientName(scannedSpecimen.patient)}</span>
                        </p>
                        <p>
                          <span className="text-gray-500">Test:</span>{' '}
                          <span className="font-medium">{scannedSpecimen.testName || 'N/A'}</span>
                        </p>
                        <p>
                          <span className="text-gray-500">Statut:</span>{' '}
                          {getStatusBadge(scannedSpecimen.status)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions for scanned specimen */}
                  <div className="mt-4 flex gap-2">
                    {['ordered', 'registered'].includes(scannedSpecimen.status) && (
                      <button
                        onClick={() => {
                          handleMarkCollected(scannedSpecimen);
                          setShowScanModal(false);
                        }}
                        className="btn btn-sm btn-secondary flex items-center gap-1"
                      >
                        <TestTube className="h-3 w-3" /> Marquer collecté
                      </button>
                    )}
                    {scannedSpecimen.status === 'collected' && (
                      <button
                        onClick={() => {
                          handleStartProcessing(scannedSpecimen);
                          setShowScanModal(false);
                        }}
                        className="btn btn-sm btn-primary flex items-center gap-1"
                      >
                        <Play className="h-3 w-3" /> Démarrer traitement
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register Specimen Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Plus className="h-5 w-5 mr-2 text-purple-600" />
                Enregistrer un échantillon
              </h2>
              <button
                onClick={() => {
                  setShowRegisterModal(false);
                  resetRegisterForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleRegisterSpecimen} className="p-6 space-y-6">
              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient *
                </label>
                <select
                  value={registerForm.patientId}
                  onChange={(e) => setRegisterForm({ ...registerForm, patientId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.firstName} {p.lastName}
                      {p.patientId && ` (${p.patientId})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specimen Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'échantillon *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {specimenTypes.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setRegisterForm({ ...registerForm, specimenType: type.value })}
                      className={`px-3 py-2 border rounded-lg text-sm flex items-center justify-center gap-2 transition-colors ${
                        registerForm.specimenType === type.value
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <TestTube className="h-4 w-4" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tube Type (for blood specimens) */}
              {['blood', 'serum', 'plasma'].includes(registerForm.specimenType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de tube
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {tubeTypes.map(tube => (
                      <button
                        key={tube.value}
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, tubeType: tube.value })}
                        className={`px-3 py-2 border rounded-lg text-xs flex items-center justify-center gap-1 transition-colors ${
                          registerForm.tubeType === tube.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tube.color }}
                        />
                        <span className="truncate">{tube.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Collection Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heure de collecte
                  </label>
                  <input
                    type="datetime-local"
                    value={registerForm.collectionTime}
                    onChange={(e) => setRegisterForm({ ...registerForm, collectionTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Volume */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Volume (mL)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={registerForm.volume}
                    onChange={(e) => setRegisterForm({ ...registerForm, volume: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="ex: 5"
                  />
                </div>
              </div>

              {/* Collected By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collecté par
                </label>
                <input
                  type="text"
                  value={registerForm.collectedBy}
                  onChange={(e) => setRegisterForm({ ...registerForm, collectedBy: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Nom du technicien"
                />
              </div>

              {/* Fasting */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="fasting"
                  checked={registerForm.fasting}
                  onChange={(e) => setRegisterForm({ ...registerForm, fasting: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
                <label htmlFor="fasting" className="ml-2 text-sm text-gray-700">
                  Patient à jeun
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={registerForm.notes}
                  onChange={(e) => setRegisterForm({ ...registerForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows="2"
                  placeholder="Notes supplémentaires..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(false);
                    resetRegisterForm();
                  }}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex items-center gap-2"
                  disabled={submitting || !registerForm.patientId}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Enregistrer l'échantillon
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
