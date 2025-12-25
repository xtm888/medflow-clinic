import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FlaskConical, Plus, Download, Clock, Check, Filter, X,
  AlertTriangle, Loader2, Wifi, WifiOff, Settings
} from 'lucide-react';
import laboratoryService from '../../services/laboratoryService';
import patientService from '../../services/patientService';
import { rejectAndReschedule, REJECTION_REASONS, getPendingLabOrders } from '../../services/labOrderService';
import { toast } from 'react-toastify';
import { normalizeToArray } from '../../utils/apiHelpers';
import { CollapsibleSectionGroup } from '../../components/CollapsibleSection';
import { ClinicalSummaryPanel } from '../../components/panels';
import PermissionGate from '../../components/PermissionGate';
import FaceVerification from '../../components/biometric/FaceVerification';
import { useAuth } from '../../contexts/AuthContext';
import { useLabWorklist, useLabCriticalAlerts, useQCFailures, useWebSocket } from '../../hooks/useWebSocket';
import logger from '../../services/logger';

// Import sections
import {
  LabTemplatesSection,
  LabPendingSection,
  LabCompletedSection,
  LabSpecimensSection
} from './sections';

// Import components
import LabOrderDetail from './LabOrderDetail';
import LabResultEntry from './LabResultEntry';

/**
 * Laboratory - Main orchestrator for lab management
 * Simplified to manage state and compose child components
 */
export default function Laboratory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // WebSocket for real-time updates
  const { connected: wsConnected } = useWebSocket();

  // State
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [patients, setPatients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  // UI State
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Result entry state
  const [showResultEntry, setShowResultEntry] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);

  // View results state
  const [showViewResults, setShowViewResults] = useState(false);
  const [viewingTest, setViewingTest] = useState(null);

  // Patient panel state
  const [selectedPatientForPanel, setSelectedPatientForPanel] = useState(null);
  const [showPatientPanel, setShowPatientPanel] = useState(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [orderToReject, setOrderToReject] = useState(null);
  const [rejectForm, setRejectForm] = useState({
    reason: '',
    reasonDetails: ''
  });

  // Face verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Order form state
  const [orderForm, setOrderForm] = useState({
    patient: '',
    selectedTests: [],
    priority: 'routine',
    clinicalIndication: '',
    notes: '',
    fasting: false
  });

  // Handle real-time worklist updates
  const handleWorklistUpdate = useCallback((data) => {
    logger.debug('[Lab] Real-time update:', data);

    if (data.action === 'status_change' && data.newStatus === 'completed') {
      setPendingOrders(prev => prev.filter(o => (o._id || o.id) !== data.orderId));
      laboratoryService.getCompleted({ limit: 20 }).then(res => {
        setCompletedOrders(normalizeToArray(res));
      }).catch(err => logger.error('Failed to fetch completed orders:', err));
      toast.info(`Résultats disponibles: ${data.testName || 'Test'}`);
    } else if (data.action === 'specimen_collected') {
      setPendingOrders(prev => prev.map(o => {
        if (data.testIds?.includes(o._id || o.id)) {
          return { ...o, status: 'collected' };
        }
        return o;
      }));
      toast.success(`Prélèvement collecté: ${data.barcode}`);
    } else {
      fetchData();
    }
  }, []);

  const { worklistUpdate, lastUpdateTime } = useLabWorklist(handleWorklistUpdate);

  // Handle critical value alerts
  const handleCriticalAlert = useCallback((data) => {
    toast.error(`⚠️ VALEUR CRITIQUE: ${data.testName} pour ${data.patientName || 'Patient'}`, {
      autoClose: false,
      closeOnClick: false
    });
  }, []);

  const { criticalAlerts, clearAlert } = useLabCriticalAlerts(handleCriticalAlert);

  // Handle QC failures
  const handleQCFailure = useCallback((data) => {
    toast.warn(`🔬 QC ÉCHOUÉ: ${data.testCode} sur instrument ${data.instrumentId}`, {
      autoClose: 10000
    });
  }, []);

  const { qcFailures, clearFailure } = useQCFailures(handleQCFailure);

  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL params for action=new and patientId
  useEffect(() => {
    const action = searchParams.get('action');
    const patientId = searchParams.get('patientId');

    if (action === 'new') {
      setShowNewOrder(true);
      if (patientId) {
        setOrderForm(prev => ({ ...prev, patient: patientId }));
      }
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [templatesRes, patientsRes, pendingRes, completedRes, labOrdersRes] = await Promise.all([
        laboratoryService.getTemplates(),
        patientService.getPatients(),
        laboratoryService.getPending(),
        laboratoryService.getCompleted({ limit: 20 }),
        getPendingLabOrders().catch(() => ({ data: [] }))
      ]);

      const templatesData = normalizeToArray(templatesRes);
      setTemplates(templatesData);
      setPatients(normalizeToArray(patientsRes));

      const visitPending = normalizeToArray(pendingRes).map(o => ({ ...o, source: 'visit' }));
      const labOrderPending = normalizeToArray(labOrdersRes).map(o => ({ ...o, source: 'labOrder' }));
      setPendingOrders([...visitPending, ...labOrderPending]);

      setCompletedOrders(normalizeToArray(completedRes));

      const uniqueCategories = [...new Set(templatesData.map(t => t.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (err) {
      toast.error('Erreur lors du chargement des données');
      logger.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkFaceVerification = (patient, action) => {
    const isDoctorRole = user?.role === 'doctor' || user?.role === 'ophthalmologist' || user?.role === 'lab_tech' || user?.role === 'admin';

    if (isDoctorRole && patient?.biometric?.faceEncoding) {
      const sessionKey = `faceVerified_${patient._id || patient.id}`;
      const alreadyVerified = sessionStorage.getItem(sessionKey);

      if (alreadyVerified === 'true') {
        return true;
      } else {
        setSelectedPatientForPanel(patient);
        setPendingAction(action);
        setShowVerification(true);
        setVerificationPassed(false);
        return false;
      }
    }
    return true;
  };

  const executePendingAction = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'viewPatient') {
      setShowPatientPanel(true);
    } else if (pendingAction.type === 'enterResults') {
      setSelectedTest(pendingAction.order);
      setShowResultEntry(true);
    } else if (pendingAction.type === 'viewResults') {
      handleViewResultsAfterVerification(pendingAction.order);
    }

    setPendingAction(null);
  };

  const handleToggleTest = (template) => {
    setOrderForm(prev => {
      const isSelected = prev.selectedTests.some(t => (t._id || t.id) === (template._id || template.id));
      if (isSelected) {
        return {
          ...prev,
          selectedTests: prev.selectedTests.filter(t => (t._id || t.id) !== (template._id || template.id))
        };
      } else {
        return {
          ...prev,
          selectedTests: [...prev.selectedTests, template]
        };
      }
    });
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();

    if (!orderForm.patient) {
      toast.error('Veuillez sélectionner un patient');
      return;
    }

    if (orderForm.selectedTests.length === 0) {
      toast.error('Veuillez sélectionner au moins un test');
      return;
    }

    try {
      setSubmitting(true);

      const orderData = {
        patient: orderForm.patient,
        tests: orderForm.selectedTests.map(t => ({
          templateId: t._id || t.id,
          name: t.name,
          code: t.code,
          category: t.category
        })),
        priority: orderForm.priority,
        clinicalIndication: orderForm.clinicalIndication,
        notes: orderForm.notes,
        fasting: orderForm.fasting,
        status: 'pending'
      };

      await laboratoryService.createOrder(orderData);

      toast.success('Demande d\'examen créée avec succès!');
      setShowNewOrder(false);

      setOrderForm({
        patient: '',
        selectedTests: [],
        priority: 'routine',
        clinicalIndication: '',
        notes: '',
        fasting: false
      });

      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création');
      logger.error('Error creating order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId, status, source = 'labOrder') => {
    try {
      await laboratoryService.updateStatus(orderId, status, source);

      const statusLabels = {
        'collected': 'Prélevé',
        'received': 'Reçu',
        'in-progress': 'En cours',
        'completed': 'Terminé',
        'cancelled': 'Annulé'
      };
      toast.success(`Statut mis à jour: ${statusLabels[status] || status}`);
      fetchData();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour du statut');
      logger.error('Error updating status:', err);
    }
  };

  const handleReject = async (order) => {
    if (order.source === 'labOrder') {
      setOrderToReject(order);
      setRejectForm({ reason: '', reasonDetails: '' });
      setShowRejectModal(true);
    } else {
      const reason = prompt('Raison du rejet (optionnel):');
      if (reason === null) return;

      const orderId = order._id || order.id;
      try {
        await laboratoryService.cancelOrder(order.visitId, orderId, reason);
        toast.success('Demande annulée');
        setPendingOrders(prev => prev.filter(o => (o._id || o.id) !== orderId));
      } catch (err) {
        toast.error('Erreur lors de l\'annulation');
        logger.error('Error cancelling order:', err);
      }
    }
  };

  const confirmReject = async () => {
    if (!orderToReject || !rejectForm.reason) {
      toast.warning('Veuillez sélectionner une raison');
      return;
    }

    const orderId = orderToReject._id || orderToReject.id;

    try {
      setSubmitting(true);
      const result = await rejectAndReschedule(orderId, {
        reason: rejectForm.reason,
        reasonDetails: rejectForm.reasonDetails
      });

      const penaltyAmount = result.data?.penaltyAmount || 0;
      toast.success(
        `Patient rejeté - Pénalité: ${penaltyAmount.toLocaleString()} CDF. Patient envoyé à la réception.`,
        { autoClose: 5000 }
      );

      setPendingOrders(prev => prev.filter(o => (o._id || o.id) !== orderId));
      setShowRejectModal(false);
      setOrderToReject(null);
      setRejectForm({ reason: '', reasonDetails: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors du rejet');
      logger.error('Error rejecting order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenResultEntry = async (order) => {
    const patient = patients.find(p => (p._id || p.id) === order.patient?._id || (p._id || p.id) === order.patient);

    if (patient && !checkFaceVerification(patient, { type: 'enterResults', order })) {
      return;
    }

    setSelectedTest(order);
    setShowResultEntry(true);
  };

  const handleSubmitResults = async (order, resultData) => {
    try {
      setSubmitting(true);

      await laboratoryService.enterResults(order.visitId, order._id, resultData);

      const hasCritical = resultData.componentResults?.some(c => c.flag?.includes('critical')) || resultData.flag?.includes('critical');
      const hasAbnormal = resultData.componentResults?.some(c => c.flag !== 'normal') || (resultData.flag && resultData.flag !== 'normal');

      if (hasCritical) {
        toast.error('Résultats enregistrés - VALEURS CRITIQUES DÉTECTÉES!', { autoClose: false });
      } else if (hasAbnormal) {
        toast.warning('Résultats enregistrés - Valeurs anormales détectées');
      } else {
        toast.success('Résultats enregistrés avec succès!');
      }

      setShowResultEntry(false);
      setSelectedTest(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'enregistrement');
      logger.error('Error submitting results:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewResults = async (order) => {
    const patient = patients.find(p => (p._id || p.id) === order.patient?._id || (p._id || p.id) === order.patient);

    if (patient && !checkFaceVerification(patient, { type: 'viewResults', order })) {
      return;
    }

    handleViewResultsAfterVerification(order);
  };

  const handleViewResultsAfterVerification = async (order) => {
    try {
      const response = await laboratoryService.getTestResults(order.visitId, order._id);
      setViewingTest(response.data);
      setShowViewResults(true);
    } catch (err) {
      toast.error('Erreur lors du chargement des résultats');
      logger.error('Error loading results:', err);
    }
  };

  const handlePrintResults = async (order) => {
    try {
      await laboratoryService.downloadPDF(order.visitId);
      toast.success('PDF téléchargé avec succès!');
    } catch (err) {
      toast.error('Erreur lors de l\'impression');
      logger.error('Error printing:', err);
    }
  };

  const handleExportLabResults = () => {
    try {
      toast.info('Export en cours...');

      const allOrders = [...pendingOrders, ...completedOrders];

      if (allOrders.length === 0) {
        toast.warning('Aucun résultat à exporter');
        return;
      }

      const headers = ['Date', 'Patient', 'Test', 'Statut', 'Priorité', 'Résultats', 'Notes'];
      const rows = allOrders.map(order => {
        const patientName = order.patient
          ? `${order.patient.firstName || ''} ${order.patient.lastName || ''}`
          : 'N/A';
        const testNames = order.tests?.map(t => t.name || t.templateId?.name).join('; ') || 'N/A';
        const results = order.tests?.map(t => {
          if (t.results?.value) {
            return `${t.name || ''}: ${t.results.value} ${t.results.unit || ''}`;
          }
          return '';
        }).filter(Boolean).join('; ') || 'En attente';

        return [
          order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : 'N/A',
          patientName,
          testNames,
          order.status || 'N/A',
          order.priority || 'routine',
          results,
          order.notes || ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laboratoire_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Export terminé!');
    } catch (err) {
      logger.error('Export error:', err);
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleViewPatient = (patient) => {
    if (!checkFaceVerification(patient, { type: 'viewPatient' })) {
      return;
    }

    setShowPatientPanel(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show face verification modal
  if (showVerification && selectedPatientForPanel) {
    return (
      <FaceVerification
        patient={selectedPatientForPanel}
        onVerified={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${selectedPatientForPanel._id || selectedPatientForPanel.id}`, 'true');
          executePendingAction();
        }}
        onSkip={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${selectedPatientForPanel._id || selectedPatientForPanel.id}`, 'true');
          executePendingAction();
        }}
        onCancel={() => {
          setShowVerification(false);
          setSelectedPatientForPanel(null);
          setPendingAction(null);
        }}
        allowSkip={user?.role === 'admin'}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement du laboratoire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-red-800 font-medium">
                {criticalAlerts.length} Valeur(s) Critique(s) Détectée(s)
              </h3>
              <ul className="mt-2 space-y-1">
                {criticalAlerts.slice(0, 3).map((alert, idx) => (
                  <li key={idx} className="text-sm text-red-700 flex items-center justify-between">
                    <span>• {alert.testName} - {alert.patientName || 'Patient'}</span>
                    <button
                      onClick={() => clearAlert(alert.orderId)}
                      className="text-red-600 hover:text-red-800 text-xs underline ml-2"
                    >
                      Acquitter
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-purple-600" />
            Laboratoire
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              wsConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {wsConnected ? 'Temps réel' : 'Hors ligne'}
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des demandes d'examens de laboratoire
            {lastUpdateTime && (
              <span className="ml-2 text-xs text-gray-400">
                • Dernière MAJ: {lastUpdateTime.toLocaleTimeString('fr-FR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PermissionGate permission="manage_settings">
            <button
              onClick={() => navigate('/laboratory/config')}
              className="btn btn-secondary flex items-center gap-2"
              title="Configuration laboratoire"
            >
              <Settings className="h-5 w-5" />
              <span className="hidden md:inline">Configuration</span>
            </button>
          </PermissionGate>
          <PermissionGate permission="view_reports">
            <button
              onClick={handleExportLabResults}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="h-5 w-5" />
              <span>Exporter</span>
            </button>
          </PermissionGate>
          <PermissionGate permission="order_imaging">
            <button
              onClick={() => setShowNewOrder(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              <span>Nouvelle demande</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Catalogue</p>
              <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
            </div>
            <FlaskConical className="h-10 w-10 text-purple-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</p>
            </div>
            <Clock className="h-10 w-10 text-yellow-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Terminés</p>
              <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
            </div>
            <Check className="h-10 w-10 text-green-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Catégories</p>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
            </div>
            <Filter className="h-10 w-10 text-gray-200" />
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <CollapsibleSectionGroup>
        <LabPendingSection
          pendingOrders={pendingOrders}
          patients={patients}
          onUpdateStatus={handleUpdateStatus}
          onReject={handleReject}
          onOpenResultEntry={handleOpenResultEntry}
          onViewPatient={handleViewPatient}
          formatDate={formatDate}
        />

        <LabTemplatesSection
          templates={templates}
          categories={categories}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />

        <LabCompletedSection
          completedOrders={completedOrders}
          patients={patients}
          onViewResults={handleViewResults}
          onPrintResults={handlePrintResults}
          onViewPatient={handleViewPatient}
          formatDate={formatDate}
        />

        <LabSpecimensSection patients={patients} />
      </CollapsibleSectionGroup>

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Nouvelle Demande d'Examen</h2>
              <button
                onClick={() => setShowNewOrder(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                <select
                  className="input"
                  value={orderForm.patient}
                  onChange={(e) => setOrderForm({ ...orderForm, patient: e.target.value })}
                  required
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                  <select
                    className="input"
                    value={orderForm.priority}
                    onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderForm.fasting}
                      onChange={(e) => setOrderForm({ ...orderForm, fasting: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Patient à jeun requis</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indication clinique</label>
                <input
                  type="text"
                  className="input"
                  value={orderForm.clinicalIndication}
                  onChange={(e) => setOrderForm({ ...orderForm, clinicalIndication: e.target.value })}
                  placeholder="Ex: Bilan préopératoire, Suivi diabète..."
                />
              </div>

              {orderForm.selectedTests.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tests sélectionnés ({orderForm.selectedTests.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {orderForm.selectedTests.map(test => (
                      <span
                        key={test._id || test.id}
                        className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                      >
                        {test.name}
                        <button
                          type="button"
                          onClick={() => handleToggleTest(test)}
                          className="ml-2 text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <LabTemplatesSection
                templates={templates}
                categories={categories}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                selectionMode={true}
                selectedTests={orderForm.selectedTests}
                onSelectTest={handleToggleTest}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="input"
                  rows="2"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  placeholder="Notes supplémentaires..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewOrder(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || orderForm.selectedTests.length === 0}
                >
                  {submitting ? 'Création...' : 'Créer la demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Result Entry Modal */}
      {showResultEntry && selectedTest && (
        <LabResultEntry
          order={selectedTest}
          templates={templates}
          patients={patients}
          onSubmit={handleSubmitResults}
          onClose={() => {
            setShowResultEntry(false);
            setSelectedTest(null);
          }}
          submitting={submitting}
        />
      )}

      {/* View Results Modal */}
      {showViewResults && viewingTest && (
        <LabOrderDetail
          order={viewingTest}
          onClose={() => {
            setShowViewResults(false);
            setViewingTest(null);
          }}
          onPrintResults={handlePrintResults}
          formatDate={formatDate}
        />
      )}

      {/* Rejection Modal */}
      {showRejectModal && orderToReject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Rejeter l'examen laboratoire
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">Patient</p>
                <p className="font-medium">
                  {typeof orderToReject.patient === 'object'
                    ? `${orderToReject.patient.firstName || ''} ${orderToReject.patient.lastName || ''}`
                    : 'Patient inconnu'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raison du rejet *
                </label>
                <select
                  value={rejectForm.reason}
                  onChange={(e) => setRejectForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Sélectionner une raison...</option>
                  {REJECTION_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Détails supplémentaires (optionnel)
                </label>
                <textarea
                  value={rejectForm.reasonDetails}
                  onChange={(e) => setRejectForm(prev => ({ ...prev, reasonDetails: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={2}
                  placeholder="Précisions sur le rejet..."
                />
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    <strong>Pénalité automatique:</strong> 25% du coût des examens sera facturé au patient.
                    Le patient sera envoyé à la réception pour paiement et reprogrammation.
                  </span>
                </p>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setOrderToReject(null);
                  setRejectForm({ reason: '', reasonDetails: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                onClick={confirmReject}
                disabled={submitting || !rejectForm.reason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejet en cours...
                  </>
                ) : (
                  'Confirmer le rejet'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Info Panel */}
      {showPatientPanel && selectedPatientForPanel && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            onClick={() => {
              setShowPatientPanel(false);
              setSelectedPatientForPanel(null);
            }}
          />
          <div className="fixed right-0 top-0 h-full w-96 z-50 shadow-2xl">
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
    </div>
  );
}
