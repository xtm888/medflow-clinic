import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Plus, Printer, Check, AlertTriangle, Link, Shield, Clock, CheckCircle, XCircle, Filter, User, Keyboard, Search, RefreshCw } from 'lucide-react';
import prescriptionService from '../services/prescriptionService';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from 'react-toastify';
import EmptyState from '../components/EmptyState';
import { normalizeToArray, safeString } from '../utils/apiHelpers';
import { getPatientName as formatPatientName } from '../utils/formatters';
import DocumentGenerator from '../components/documents/DocumentGenerator';
import PriorAuthorizationModal from '../components/PriorAuthorizationModal';
import { ClinicalSummaryPanel } from '../components/panels';
import { useAuth } from '../contexts/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import PrescriptionSafetyModal from '../components/PrescriptionSafetyModal';
import PermissionGate from '../components/PermissionGate';

// PA Status configuration for badges
const PA_STATUS_CONFIG = {
  pending: { label: 'PA En attente', color: 'yellow', icon: Clock },
  submitted: { label: 'PA Soumise', color: 'blue', icon: FileText },
  in_review: { label: 'PA En révision', color: 'purple', icon: Shield },
  approved: { label: 'PA Approuvée', color: 'green', icon: CheckCircle },
  denied: { label: 'PA Refusée', color: 'red', icon: XCircle },
  appeal_pending: { label: 'PA Appel', color: 'orange', icon: AlertTriangle },
  expired: { label: 'PA Expirée', color: 'gray', icon: Clock }
};

export default function Prescriptions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dispensing, setDispensing] = useState({});
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [patientFilter, setPatientFilter] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const highlightRef = useRef(null);

  // Prior Authorization state
  const [showPAModal, setShowPAModal] = useState(false);
  const [selectedPAPresciption, setSelectedPAPrescription] = useState(null);
  const [pendingPAs, setPendingPAs] = useState([]);
  const [paFilter, setPaFilter] = useState('all'); // all, needs_pa, pa_pending, pa_approved, pa_denied
  const isAdmin = user?.role === 'admin';

  // Patient info panel state
  const [selectedPatientForPanel, setSelectedPatientForPanel] = useState(null);
  const [showPatientPanel, setShowPatientPanel] = useState(false);

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  // Safety validation modal state
  const [safetyModal, setSafetyModal] = useState({
    isOpen: false,
    prescription: null,
    patient: null
  });

  // Fetch prescriptions on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL parameters for filtering and highlighting
  useEffect(() => {
    const patientId = searchParams.get('patientId');
    const highlight = searchParams.get('highlight');

    if (patientId) {
      setPatientFilter(patientId);
    }

    if (highlight) {
      setHighlightedId(highlight);
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedId(null);
        // Remove highlight param from URL
        searchParams.delete('highlight');
        setSearchParams(searchParams);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Scroll to highlighted prescription
  useEffect(() => {
    if (highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedId, prescriptions]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [prescriptionsRes, pendingPAsRes] = await Promise.all([
        prescriptionService.getPrescriptions(),
        prescriptionService.getPendingPriorAuthorizations().catch(() => [])
      ]);
      setPrescriptions(normalizeToArray(prescriptionsRes));
      setPendingPAs(normalizeToArray(pendingPAsRes));
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
      setError(err.message || 'Erreur lors du chargement des prescriptions');
      toast.error('Erreur lors du chargement des prescriptions');
    } finally {
      setLoading(false);
    }
  };

  // Handle PA modal open
  const handleOpenPAModal = (prescription) => {
    setSelectedPAPrescription(prescription);
    setShowPAModal(true);
  };

  // Close PA modal and refresh
  const handleClosePAModal = () => {
    setShowPAModal(false);
    setSelectedPAPrescription(null);
  };

  // Get PA status badge color class
  const getPABadgeClass = (paStatus) => {
    const config = PA_STATUS_CONFIG[paStatus];
    if (!config) return 'bg-gray-100 text-gray-700';
    return `bg-${config.color}-100 text-${config.color}-700 border border-${config.color}-200`;
  };

  // Filter prescriptions based on PA status
  const filterByPA = (prescription) => {
    if (paFilter === 'all') return true;
    const pa = prescription.priorAuthorization;
    switch (paFilter) {
      case 'needs_pa':
        return !pa?.status;
      case 'pa_pending':
        return ['pending', 'submitted', 'in_review'].includes(pa?.status);
      case 'pa_approved':
        return pa?.status === 'approved';
      case 'pa_denied':
        return ['denied', 'expired'].includes(pa?.status);
      default:
        return true;
    }
  };

  // Open safety modal before dispensing
  const handleDispense = (prescriptionId) => {
    const prescription = prescriptions.find(p => (p._id || p.id) === prescriptionId);
    if (!prescription) return;

    const patient = prescription.patient;

    setSafetyModal({
      isOpen: true,
      prescription,
      patient: typeof patient === 'object' ? patient : null
    });
  };

  // Actually dispense after safety check
  const executeDispense = async (prescriptionId) => {
    try {
      setDispensing(prev => ({ ...prev, [prescriptionId]: true }));
      setSafetyModal({ isOpen: false, prescription: null, patient: null });

      const result = await prescriptionService.dispensePrescription(prescriptionId, {
        dispensedBy: 'current_user',
        dispensedAt: new Date(),
        notes: 'Dispensed from staff portal'
      });

      // Show detailed success message with inventory info
      if (result.inventoryUpdated && result.inventoryUpdated > 0) {
        const deductions = result.inventoryDeductions || [];
        const deductionInfo = deductions.map(d =>
          `${d.medication}: ${d.quantity} unités (Stock restant: ${d.remainingStock})`
        ).join('\n');

        toast.success(`Prescription dispensée avec succès!\n\nInventaire mis à jour:\n${deductionInfo}`);
      } else {
        toast.success('Prescription dispensée avec succès!');
      }

      // Refresh list
      fetchData();

    } catch (err) {
      // Handle insufficient stock error specially
      if (err.response?.data?.insufficientStock) {
        const stockErrors = err.response.data.insufficientStock;
        const errorMessage = stockErrors.map(s =>
          `${s.medication}: Besoin ${s.required}, Disponible ${s.available}`
        ).join('\n');

        toast.error(`Stock insuffisant:\n${errorMessage}`);
      } else {
        toast.error(err.response?.data?.error || 'Échec de la dispensation');
      }
      console.error('Error dispensing prescription:', err);
    } finally {
      setDispensing(prev => ({ ...prev, [prescriptionId]: false }));
    }
  };

  // Print prescription
  const handlePrint = async (prescriptionId) => {
    try {
      const blob = await prescriptionService.printPrescription(prescriptionId, 'pdf');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescription_${prescriptionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Prescription téléchargée avec succès !');
    } catch (err) {
      toast.error('Échec de l\'impression de la prescription');
      console.error('Error printing prescription:', err);
    }
  };

  // Get patient name - uses shared formatter
  const getPatientName = (patientData) => {
    return formatPatientName(patientData);
  };

  // Get patient list for filter display
  const getPatientList = () => {
    const patientMap = new Map();
    prescriptions.forEach(prescription => {
      const patient = prescription.patient;
      if (patient && typeof patient === 'object') {
        const id = patient._id || patient.id;
        if (id) {
          patientMap.set(id, patient);
        }
      }
    });
    return Array.from(patientMap.values());
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Filter prescriptions by search term
  const filteredPrescriptions = useMemo(() => {
    let filtered = [...prescriptions];

    // Apply patient filter
    if (patientFilter) {
      filtered = filtered.filter(p => {
        const patientId = p.patient?._id || p.patient?.id || p.patient;
        return patientId === patientFilter;
      });
    }

    // Apply PA filter
    if (paFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (paFilter === 'needs_pa') return p.medications?.some(m => m.requiresPriorAuth && !m.priorAuthStatus);
        if (paFilter === 'pa_pending') return p.medications?.some(m => ['pending', 'submitted', 'in_review'].includes(m.priorAuthStatus));
        if (paFilter === 'pa_approved') return p.medications?.some(m => m.priorAuthStatus === 'approved');
        if (paFilter === 'pa_denied') return p.medications?.some(m => m.priorAuthStatus === 'denied');
        return true;
      });
    }

    // Apply search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const patientName = getPatientName(p.patient).toLowerCase();
        const medicationNames = (p.medications || []).map(m => (m.name || m.medication?.name || '').toLowerCase()).join(' ');
        return patientName.includes(search) || medicationNames.includes(search);
      });
    }

    return filtered;
  }, [prescriptions, patientFilter, paFilter, searchTerm]);

  // Check if any modal is open
  const isModalOpen = showDocumentGenerator || showPAModal || showPatientPanel || showShortcutsHelp || safetyModal.isOpen || confirmModal.isOpen;

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => ({
    '/': () => {
      if (!isModalOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    },
    'r': () => {
      if (!isModalOpen) {
        fetchData();
        toast.info('Liste actualisée');
      }
    },
    'f': () => {
      if (!isModalOpen && filteredPrescriptions.length > 0) {
        // Focus on first prescription's dispense button
        toast.info('Utilisez Tab pour naviguer');
      }
    },
    '1': () => {
      if (!isModalOpen && filteredPrescriptions[0]) {
        const patient = filteredPrescriptions[0].patient;
        if (patient && typeof patient === 'object') {
          setSelectedPatientForPanel(patient);
          setShowPatientPanel(true);
        }
      }
    },
    '2': () => {
      if (!isModalOpen && filteredPrescriptions[1]) {
        const patient = filteredPrescriptions[1].patient;
        if (patient && typeof patient === 'object') {
          setSelectedPatientForPanel(patient);
          setShowPatientPanel(true);
        }
      }
    },
    'p': () => {
      if (!isModalOpen) {
        navigate('/patients');
      }
    },
    'esc': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showPatientPanel) {
        setShowPatientPanel(false);
        setSelectedPatientForPanel(null);
      }
      else if (showDocumentGenerator) setShowDocumentGenerator(false);
      else if (showPAModal) setShowPAModal(false);
    },
    '?': () => {
      setShowShortcutsHelp(true);
    }
  }), [isModalOpen, filteredPrescriptions, navigate, showShortcutsHelp, showPatientPanel, showDocumentGenerator, showPAModal]);

  // Enable keyboard shortcuts
  useKeyboardShortcuts(keyboardShortcuts, true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des prescriptions...</p>
        </div>
      </div>
    );
  }

  if (error && prescriptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur de chargement</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="btn btn-primary"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const patientList = getPatientList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des prescriptions et dispensation
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
              title="Raccourcis clavier (appuyez sur ?)"
            >
              <Keyboard className="h-3 w-3 mr-1" />
              <span className="text-xs">Raccourcis</span>
            </button>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher... (appuyez /)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-64"
            />
          </div>
          {/* Refresh */}
          <button
            onClick={fetchData}
            className="btn btn-secondary flex items-center gap-2"
            title="Actualiser (R)"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <PermissionGate permission="create_prescriptions">
            <button
              onClick={() => navigate('/patients')}
              className="btn btn-primary flex items-center space-x-2"
              title="Sélectionnez un patient, puis créez une consultation pour ajouter des prescriptions"
            >
              <Plus className="h-5 w-5" />
              <span>Nouvelle Prescription</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Pending Prior Authorizations Summary */}
      {pendingPAs.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-purple-900">Autorisations Préalables en attente</h3>
                <p className="text-sm text-purple-700">{pendingPAs.length} demande(s) nécessitant une action</p>
              </div>
            </div>
            <button
              onClick={() => setPaFilter('pa_pending')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Voir les demandes
            </button>
          </div>
        </div>
      )}

      {/* PA Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-gray-200 pb-2">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-500 mr-2">Filtrer par PA:</span>
        {[
          { value: 'all', label: 'Toutes' },
          { value: 'needs_pa', label: 'Sans PA' },
          { value: 'pa_pending', label: 'PA En cours' },
          { value: 'pa_approved', label: 'PA Approuvées' },
          { value: 'pa_denied', label: 'PA Refusées' }
        ].map(filter => (
          <button
            key={filter.value}
            onClick={() => setPaFilter(filter.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              paFilter === filter.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="card">
          <EmptyState
            type="prescriptions"
            customAction={{
              label: 'Aller aux Patients',
              onClick: () => window.location.href = '/patients'
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Patient filter indicator */}
          {patientFilter && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700">
                Filtré par patient: {patientList.find(p => (p._id || p.id) === patientFilter)?.firstName || 'Patient sélectionné'}
              </span>
              <button
                onClick={() => {
                  setPatientFilter('');
                  searchParams.delete('patientId');
                  setSearchParams(searchParams);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Effacer le filtre
              </button>
            </div>
          )}
          {prescriptions
            .filter(prescription => {
              // Patient filter
              if (patientFilter) {
                const patientId = typeof prescription.patient === 'object'
                  ? (prescription.patient._id || prescription.patient.id)
                  : prescription.patient;
                if (patientId !== patientFilter) return false;
              }
              // PA filter
              return filterByPA(prescription);
            })
            .map((prescription) => {
              const pa = prescription.priorAuthorization;
              const paConfig = pa?.status ? PA_STATUS_CONFIG[pa.status] : null;
              const PAIcon = paConfig?.icon;
              const prescriptionId = prescription._id || prescription.id;
              const isHighlighted = highlightedId === prescriptionId;
              return (
            <div
              key={prescriptionId}
              ref={isHighlighted ? highlightRef : null}
              className={`card transition-all duration-300 ${isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getPatientName(prescription.patient)}
                    </h3>
                    <span className={`badge ${
                      prescription.status === 'dispensed' ? 'badge-success' :
                      prescription.status === 'pending' ? 'badge-warning' :
                      prescription.status === 'cancelled' ? 'badge-danger' :
                      'badge'
                    }`}>
                      {prescription.status === 'dispensed' ? 'Dispensée' :
                       prescription.status === 'pending' ? 'En attente' :
                       prescription.status === 'cancelled' ? 'Annulée' :
                       safeString(prescription.status, 'Unknown')}
                    </span>
                    {/* PA Status Badge */}
                    {pa?.status && paConfig && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPABadgeClass(pa.status)}`}>
                        {PAIcon && <PAIcon className="h-3 w-3 mr-1" />}
                        {paConfig.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {prescription.prescriber
                      ? (prescription.prescriber.name ||
                         (prescription.prescriber.firstName
                           ? `Dr. ${prescription.prescriber.firstName} ${prescription.prescriber.lastName || ''}`.trim()
                           : 'Dr. Unknown'))
                      : 'Dr. Unknown'} - {formatDate(prescription.date || prescription.createdAt)}
                  </p>
                  {prescription.visit && (
                    <p className="text-xs text-green-600 mb-3 flex items-center">
                      <Link className="h-3 w-3 mr-1" />
                      Visite: {prescription.visit.visitId || 'N/A'} ({prescription.visit.status === 'in-progress' ? 'En cours' : prescription.visit.status === 'completed' ? 'Terminée' : prescription.visit.status})
                    </p>
                  )}
                  {!prescription.visit && (
                    <div className="flex items-center text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mb-3">
                      <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span>Non liée à une visite - Documentation clinique incomplète</span>
                    </div>
                  )}

                  {/* Medications List */}
                  <div className="space-y-2">
                    {Array.isArray(prescription.medications) && prescription.medications.map((med, idx) => {
                      // Get medication name - handle various data structures
                      let medName = 'Médicament';
                      if (med.name) {
                        medName = med.name;
                      } else if (med.drug && typeof med.drug === 'object' && med.drug.name) {
                        medName = med.drug.name;
                      } else if (med.medication && typeof med.medication === 'object' && med.medication.name) {
                        medName = med.medication.name;
                      } else if (typeof med.medication === 'string') {
                        medName = med.medication;
                      }

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {medName}
                              {med.form && <span className="text-gray-500 text-sm ml-1">({med.form})</span>}
                            </p>
                            <p className="text-sm text-gray-600">{safeString(med.dosage, 'Selon prescription')}</p>
                            {(med.frequency || med.duration) && (
                              <p className="text-xs text-gray-500">
                                {med.frequency && safeString(med.frequency, '')}
                                {med.frequency && med.duration && ' - '}
                                {med.duration && `Durée: ${safeString(med.duration, '')}`}
                              </p>
                            )}
                            {med.instructions && (
                              <p className="text-xs text-gray-500 italic mt-1">{safeString(med.instructions, '')}</p>
                            )}
                            {med.indication && (
                              <p className="text-xs text-blue-600 mt-1">Indication: {safeString(med.indication, '')}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              Qté: {typeof med.quantity === 'number' ? med.quantity : 1}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Diagnosis and Instructions */}
                  {prescription.diagnosis && (
                    <div className="mt-3 p-2 bg-blue-50 rounded">
                      <p className="text-xs font-medium text-blue-900">Diagnostic:</p>
                      <p className="text-sm text-blue-800">{safeString(prescription.diagnosis, '')}</p>
                    </div>
                  )}
                  {prescription.instructions && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded">
                      <p className="text-xs font-medium text-yellow-900">Instructions:</p>
                      <p className="text-sm text-yellow-800">{safeString(prescription.instructions, '')}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-4">
                  {/* Patient Info Button */}
                  <button
                    onClick={() => {
                      const patient = prescription.patient;
                      if (patient && typeof patient === 'object') {
                        setSelectedPatientForPanel(patient);
                        setShowPatientPanel(true);
                      }
                    }}
                    className="btn btn-outline text-sm border-purple-300 text-purple-700 hover:bg-purple-50"
                    title="Voir infos patient"
                  >
                    <User className="h-4 w-4 mr-1" />
                    Infos
                  </button>
                  {prescription.status === 'pending' && (
                    <PermissionGate permission="dispense_medications">
                      <button
                        onClick={() => handleDispense(prescription._id || prescription.id)}
                        disabled={dispensing[prescription._id || prescription.id]}
                        className="btn btn-success text-sm"
                        title="Dispenser les médicaments et déduire du stock"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {dispensing[prescription._id || prescription.id] ? 'Dispensation...' : 'Dispenser'}
                      </button>
                    </PermissionGate>
                  )}
                  {/* Prior Authorization Button */}
                  <PermissionGate permission="create_prescriptions">
                    <button
                      onClick={() => handleOpenPAModal(prescription)}
                      className={`text-sm flex items-center justify-center px-3 py-1.5 rounded-md font-medium transition-colors ${
                        pa?.status === 'approved'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : pa?.status === 'denied'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : pa?.status
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {pa?.status ? 'Voir PA' : 'Demander PA'}
                    </button>
                  </PermissionGate>
                  <button
                    onClick={() => {
                      setSelectedPrescription(prescription);
                      setShowDocumentGenerator(true);
                    }}
                    className="btn btn-primary text-sm"
                    title="Générer un certificat ou document"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Certificat
                  </button>
                  <button
                    onClick={() => handlePrint(prescription._id || prescription.id)}
                    className="btn btn-secondary text-sm"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </button>
                </div>
              </div>
            </div>
              );
            })}
        </div>
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && selectedPrescription && (
        <DocumentGenerator
          patientId={selectedPrescription.patient?._id || selectedPrescription.patient?.id || selectedPrescription.patient}
          visitId={selectedPrescription.visit?._id}
          onClose={() => {
            setShowDocumentGenerator(false);
            setSelectedPrescription(null);
          }}
          onDocumentGenerated={(doc) => {
            toast.success('Document généré avec succès!');
            setShowDocumentGenerator(false);
            setSelectedPrescription(null);
          }}
        />
      )}

      {/* Prior Authorization Modal */}
      {showPAModal && selectedPAPresciption && (
        <PriorAuthorizationModal
          prescription={selectedPAPresciption}
          onClose={handleClosePAModal}
          onUpdate={fetchData}
          isAdmin={isAdmin}
        />
      )}

      {/* Patient Info Panel - Slide-in Sidebar */}
      {showPatientPanel && selectedPatientForPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
            onClick={() => {
              setShowPatientPanel(false);
              setSelectedPatientForPanel(null);
            }}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-96 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out">
            <ClinicalSummaryPanel
              patient={selectedPatientForPanel}
              patientId={selectedPatientForPanel?._id || selectedPatientForPanel?.id}
              variant="sidebar"
              onClose={() => {
                setShowPatientPanel(false);
                setSelectedPatientForPanel(null);
              }}
              onNavigateToProfile={(id) => {
                setShowPatientPanel(false);
                navigate(`/patients/${id}`);
              }}
              showOphthalmology={true}
            />
          </div>
        </>
      )}

      {/* Prescription Safety Modal */}
      <PrescriptionSafetyModal
        isOpen={safetyModal.isOpen}
        onClose={() => setSafetyModal({ isOpen: false, prescription: null, patient: null })}
        onConfirm={() => executeDispense(safetyModal.prescription?._id || safetyModal.prescription?.id)}
        prescription={safetyModal.prescription}
        patient={safetyModal.patient}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Keyboard className="h-6 w-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Raccourcis clavier</h2>
                </div>
                <button
                  onClick={() => setShowShortcutsHelp(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Rechercher</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">/</kbd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Actualiser la liste</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">R</kbd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Naviguer (focus)</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">F</kbd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Info patient #1</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">1</kbd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Info patient #2</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">2</kbd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Aller aux patients</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">P</kbd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Fermer popup</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">Esc</kbd>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-700">Afficher l'aide</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">?</kbd>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                  Appuyez sur Échap pour fermer
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
