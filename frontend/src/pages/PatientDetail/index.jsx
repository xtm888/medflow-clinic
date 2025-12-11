import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, User, Edit, Phone, Mail, Plus, AlertTriangle,
  Droplets, Expand, Minimize, Loader2, X, Printer, CreditCard, Eye, Download
} from 'lucide-react';
import patientService from '../../services/patientService';
import prescriptionService from '../../services/prescriptionService';
import billingService from '../../services/billingService';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { PatientPhotoAvatar, FaceVerification } from '../../components/biometric';
import DocumentGenerator from '../../components/documents/DocumentGenerator';
import { CollapsibleSectionGroup } from '../../components/CollapsibleSection';
import MultiCurrencyPayment from '../../components/MultiCurrencyPayment';
// WebSocket hooks for real-time updates
import {
  usePatientUpdates,
  useBillingUpdates,
  usePrescriptionReady,
  useLabResults,
  useVisitUpdates
} from '../../hooks/useWebSocket';

// Import all section components
import {
  PatientInfoSection,
  OphthalmologySection,
  PrescriptionsSection,
  ImagingSection,
  LabSection,
  AppointmentsSection,
  BillingSection,
  TimelineSection,
  SurgeryHistorySection
} from './sections';

/**
 * PatientDetail - Consolidated single-page patient view
 *
 * All patient information in collapsible sections instead of tabs
 * for better visibility and faster access to data.
 */
export default function PatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Section refs for scrolling
  const sectionRefs = {
    info: useRef(null),
    ophthalmology: useRef(null),
    prescriptions: useRef(null),
    appointments: useRef(null),
    imaging: useRef(null),
    lab: useRef(null),
    billing: useRef(null),
    visits: useRef(null),
    timeline: useRef(null)
  };

  // Role-based permissions
  const canEditPatient = ['admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'].includes(user?.role);
  const canCreatePrescription = ['admin', 'doctor', 'ophthalmologist', 'optometrist'].includes(user?.role);
  const canViewBilling = ['admin', 'receptionist', 'accountant', 'manager'].includes(user?.role);
  const canProcessPayment = ['admin', 'receptionist', 'accountant'].includes(user?.role);
  const canCreateInvoice = ['admin', 'receptionist', 'accountant'].includes(user?.role);
  const canCreateExam = ['admin', 'doctor', 'ophthalmologist', 'optometrist', 'orthoptist'].includes(user?.role);
  const canSignVisit = ['admin', 'doctor', 'ophthalmologist'].includes(user?.role);
  const canUploadImaging = ['admin', 'doctor', 'ophthalmologist', 'radiologist', 'technician'].includes(user?.role);
  const canGenerateDocuments = ['admin', 'doctor', 'ophthalmologist', 'nurse'].includes(user?.role);

  // State
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [allExpanded, setAllExpanded] = useState(true);

  // Face verification state (session-based)
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const isDoctorRole = ['doctor', 'ophthalmologist', 'optometrist', 'orthoptist'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  // Modals
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showImagingModal, setShowImagingModal] = useState(false);

  // Selected items for modals
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedImaging, setSelectedImaging] = useState(null);

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processingPayment, setProcessingPayment] = useState(false);

  // ============================================
  // WEBSOCKET REAL-TIME SUBSCRIPTIONS
  // ============================================
  // CRITICAL FIX: Subscribe to real-time updates for this patient's data
  // This ensures the UI reflects changes made by other users or background processes
  // without requiring a manual page refresh.

  // Subscribe to patient data updates
  const patientUpdate = usePatientUpdates(patientId);

  // Subscribe to billing/invoice updates
  const billingUpdate = useBillingUpdates(patientId);

  // Subscribe to prescription ready notifications
  const prescriptionReady = usePrescriptionReady(patientId);

  // Subscribe to lab results
  const labResults = useLabResults(patientId);

  // Subscribe to visit updates
  const visitUpdate = useVisitUpdates(null); // null = receive all visits, filter in handler

  // Handle real-time patient data updates
  useEffect(() => {
    if (patientUpdate) {
      console.log('[PatientDetail] Real-time patient update received:', patientUpdate);
      // Merge the update into current patient state
      setPatient(prev => prev ? { ...prev, ...patientUpdate.data } : prev);
      // Show notification for significant changes
      if (patientUpdate.action === 'updated') {
        toast.info('Données patient mises à jour', { autoClose: 2000 });
      }
    }
  }, [patientUpdate]);

  // Handle real-time billing updates
  useEffect(() => {
    if (billingUpdate) {
      console.log('[PatientDetail] Real-time billing update received:', billingUpdate);
      // Dispatch event to refresh billing section
      window.dispatchEvent(new CustomEvent('refresh-billing'));
      if (billingUpdate.action === 'payment') {
        toast.success(`Paiement de ${billingUpdate.amount?.toLocaleString() || ''} CDF enregistré`, { autoClose: 3000 });
      } else if (billingUpdate.action === 'invoice_created') {
        toast.info('Nouvelle facture créée', { autoClose: 2000 });
      }
    }
  }, [billingUpdate]);

  // Handle prescription ready notifications
  useEffect(() => {
    if (prescriptionReady && prescriptionReady.length > 0) {
      const latestPrescription = prescriptionReady[prescriptionReady.length - 1];
      console.log('[PatientDetail] Prescription ready notification:', latestPrescription);
      toast.success('Ordonnance prête à retirer en pharmacie', {
        autoClose: 5000,
        icon: '💊'
      });
      // Dispatch event to refresh prescriptions section
      window.dispatchEvent(new CustomEvent('refresh-prescriptions'));
    }
  }, [prescriptionReady]);

  // Handle lab results notifications
  useEffect(() => {
    if (labResults && labResults.length > 0) {
      const latestResult = labResults[labResults.length - 1];
      console.log('[PatientDetail] Lab result received:', latestResult);
      toast.info(`Résultat de laboratoire disponible: ${latestResult.testName || 'Nouveau résultat'}`, {
        autoClose: 5000,
        icon: '🔬'
      });
      // Dispatch event to refresh lab section
      window.dispatchEvent(new CustomEvent('refresh-lab'));
    }
  }, [labResults]);

  // Handle visit updates for this patient
  useEffect(() => {
    if (visitUpdate && visitUpdate.patientId === patientId) {
      console.log('[PatientDetail] Visit update for this patient:', visitUpdate);
      if (visitUpdate.action === 'completed') {
        toast.success('Visite terminée', { autoClose: 3000, icon: '✅' });
        // Refresh patient data to get updated lastVisit
        loadPatientData();
      }
      // Dispatch event to refresh timeline section
      window.dispatchEvent(new CustomEvent('refresh-timeline'));
    }
  }, [visitUpdate, patientId]);

  // Load patient data
  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  // Check if face verification is needed when patient is loaded
  useEffect(() => {
    if (!patient || !isDoctorRole) {
      // Non-doctors don't need verification
      setFaceVerified(true);
      return;
    }

    // Check session storage for verification
    const sessionKey = `faceVerified_${patientId}`;
    const alreadyVerified = sessionStorage.getItem(sessionKey);

    if (alreadyVerified === 'true') {
      setFaceVerified(true);
      setShowFaceVerification(false);
    } else if (patient?.biometric?.faceEncoding) {
      // Patient has enrolled photo, require verification
      setShowFaceVerification(true);
      setFaceVerified(false);
    } else {
      // Patient has no enrolled photo - can't verify
      if (!isAdmin) {
        toast.warning('Ce patient n\'a pas de photo enregistrée. Impossible de vérifier l\'identité.');
      }
      setFaceVerified(true);
    }
  }, [patient, isDoctorRole, patientId, isAdmin]);

  // Get active tab from URL
  const activeTab = searchParams.get('tab');

  // Handle tab query parameter - scroll to section
  useEffect(() => {
    if (activeTab && patient && sectionRefs[activeTab]?.current) {
      // Wait for sections to render
      setTimeout(() => {
        sectionRefs[activeTab].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [activeTab, patient]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const patientRes = await patientService.getPatient(patientId);

      // patientService.getPatient now returns normalized structure: { data: patient }
      setPatient(patientRes.data);
    } catch (err) {
      toast.error('Erreur lors du chargement du patient');
      console.error('Error loading patient:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // === FACE VERIFICATION HANDLERS ===
  const handleFaceVerified = () => {
    setFaceVerified(true);
    setShowFaceVerification(false);
    // Store in session storage (clears on browser close)
    sessionStorage.setItem(`faceVerified_${patientId}`, 'true');
    toast.success('Identité vérifiée avec succès');
  };

  const handleSkipVerification = () => {
    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent ignorer la vérification');
      return;
    }
    setFaceVerified(true);
    setShowFaceVerification(false);
    toast.warning('Vérification ignorée par administrateur');
  };

  // === PRESCRIPTION HANDLERS ===
  const handleViewPrescription = (prescription) => {
    setSelectedPrescription(prescription);
    setShowPrescriptionModal(true);
  };

  const handlePrintPrescription = async (prescription) => {
    try {
      const blob = await prescriptionService.printPrescription(prescription._id || prescription.id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ordonnance-${prescription._id || prescription.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Ordonnance téléchargée');
    } catch (err) {
      console.error('Error printing prescription:', err);
      window.print();
    }
  };

  const handleRenewPrescription = async (prescription) => {
    try {
      await prescriptionService.renewPrescription(prescription._id || prescription.id);
      toast.success('Ordonnance renouvelée avec succès');
    } catch (err) {
      console.error('Error renewing prescription:', err);
      navigate('/prescriptions', {
        state: { renewFrom: prescription, patientId: patientId }
      });
    }
  };

  // === INVOICE/BILLING HANDLERS ===
  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handlePrintInvoice = async (invoice) => {
    try {
      const blob = await billingService.downloadInvoicePDF(invoice._id || invoice.id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `facture-${invoice.invoiceNumber || invoice._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Facture téléchargée');
    } catch (err) {
      console.error('Error printing invoice:', err);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleOpenPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount((invoice.total - (invoice.amountPaid || 0)).toString());
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    setProcessingPayment(true);
    try {
      await billingService.processPayment(selectedInvoice._id || selectedInvoice.id, {
        amount: parseFloat(paymentAmount),
        method: paymentMethod
      });
      toast.success('Paiement enregistré');
      setShowPaymentModal(false);
    } catch (err) {
      console.error('Error processing payment:', err);
      toast.error('Erreur lors du traitement');
    } finally {
      setProcessingPayment(false);
    }
  };

  // === IMAGING HANDLER ===
  const handleViewImaging = (img) => {
    setSelectedImaging(img);
    setShowImagingModal(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement du dossier patient...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!patient) {
    return (
      <div className="text-center py-12">
        <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Patient non trouvé</p>
        <button onClick={() => navigate('/patients')} className="btn btn-primary mt-4">
          Retour aux patients
        </button>
      </div>
    );
  }

  // Face verification required - block access until verified
  if (showFaceVerification && !faceVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <FaceVerification
          patient={patient}
          onVerified={handleFaceVerified}
          onSkip={isAdmin ? handleSkipVerification : null}
          onCancel={() => navigate('/patients')}
          allowSkip={isAdmin}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Patient Info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/patients')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>

              <PatientPhotoAvatar
                patient={patient}
                size="lg"
                showBiometricBadge={true}
              />

              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </h1>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>{calculateAge(patient.dateOfBirth)} ans</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{patient.gender === 'male' ? 'Homme' : 'Femme'}</span>
                  {patient.bloodType && (
                    <>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3 w-3" />
                        {patient.bloodType}
                      </span>
                    </>
                  )}
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="text-blue-600 font-medium">{patient.patientId}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Expand/Collapse All */}
              <button
                onClick={() => setAllExpanded(!allExpanded)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={allExpanded ? 'Tout réduire' : 'Tout développer'}
              >
                {allExpanded ? <Minimize className="h-5 w-5 text-gray-600" /> : <Expand className="h-5 w-5 text-gray-600" />}
              </button>

              {patient.phoneNumber && (
                <a
                  href={`tel:${patient.phoneNumber}`}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Appeler"
                >
                  <Phone className="h-5 w-5 text-gray-600" />
                </a>
              )}
              {patient.email && (
                <a
                  href={`mailto:${patient.email}`}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Email"
                >
                  <Mail className="h-5 w-5 text-gray-600" />
                </a>
              )}
              {canEditPatient && (
                <button
                  onClick={() => navigate(`/patients/${patientId}/edit`)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Edit className="h-5 w-5 text-gray-600" />
                </button>
              )}

              {/* Main CTA */}
              {canCreateExam && (
                <button
                  onClick={() => navigate(`/ophthalmology/consultation/${patientId}`)}
                  className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Consultation
                </button>
              )}
            </div>
          </div>

          {/* Allergy Alert */}
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span className="text-sm font-medium text-red-800">
                ALLERGIE: {Array.isArray(patient.allergies) ? patient.allergies.join(', ') : patient.allergies}
              </span>
            </div>
          )}

          {/* Incomplete Data Warning - Legacy Import Alert */}
          {(patient.dataStatus === 'incomplete' || patient.placeholderFields?.length > 0) && (
            <div className="mt-3 px-3 py-3 bg-amber-50 border border-amber-300 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">
                    DOSSIER INCOMPLET - Données importées du système legacy
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Ce patient a été importé avec des données placeholder. Veuillez mettre à jour les informations suivantes:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {patient.placeholderFields?.includes('dateOfBirth') && (
                      <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">Date de naissance</span>
                    )}
                    {patient.placeholderFields?.includes('gender') && (
                      <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">Genre</span>
                    )}
                    {patient.placeholderFields?.includes('phoneNumber') && (
                      <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">Téléphone</span>
                    )}
                    {patient.placeholderFields?.includes('email') && (
                      <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">Email</span>
                    )}
                    {patient.placeholderFields?.includes('address') && (
                      <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">Adresse</span>
                    )}
                    {patient.placeholderFields?.includes('bloodType') && (
                      <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">Groupe sanguin</span>
                    )}
                    {/* Show generic badge if no specific fields tracked */}
                    {(!patient.placeholderFields || patient.placeholderFields.length === 0) && (
                      <span className="px-2 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">Vérification requise</span>
                    )}
                  </div>
                </div>
                {canEditPatient && (
                  <button
                    onClick={() => navigate(`/patients/${patientId}/edit`)}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors whitespace-nowrap"
                  >
                    Compléter le dossier
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Collapsible Sections */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <CollapsibleSectionGroup>
          {/* Patient Information */}
          <div ref={sectionRefs.info}>
            <PatientInfoSection
              patient={patient}
              formatDate={formatDate}
              calculateAge={calculateAge}
            />
          </div>

          {/* Ophthalmology */}
          <div ref={sectionRefs.ophthalmology}>
            <OphthalmologySection
              patient={patient}
              patientId={patientId}
              canCreateExam={canCreateExam}
              canSign={canSignVisit}
              forceExpand={activeTab === 'ophthalmology'}
            />
          </div>

          {/* Prescriptions */}
          <div ref={sectionRefs.prescriptions}>
            <PrescriptionsSection
              patientId={patientId}
              canCreatePrescription={canCreatePrescription}
              canSign={canSignVisit}
              onViewPrescription={handleViewPrescription}
              onPrintPrescription={handlePrintPrescription}
              onRenewPrescription={handleRenewPrescription}
              forceExpand={activeTab === 'prescriptions'}
            />
          </div>

          {/* Appointments */}
          <div ref={sectionRefs.appointments}>
            <AppointmentsSection
              patientId={patientId}
              patient={patient}
              forceExpand={activeTab === 'appointments'}
            />
          </div>

          {/* Imaging */}
          <div ref={sectionRefs.imaging}>
            <ImagingSection
              patientId={patientId}
              patientName={patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : ''}
              canUploadImaging={canUploadImaging}
              onViewImaging={handleViewImaging}
            />
          </div>

          {/* Lab Results */}
          <div ref={sectionRefs.lab}>
            <LabSection
              patientId={patientId}
            />
          </div>

          {/* Billing */}
          <div ref={sectionRefs.billing}>
            <BillingSection
              patientId={patientId}
              patient={patient}
              canViewBilling={canViewBilling}
              canCreateInvoice={canCreateInvoice}
              canProcessPayment={canProcessPayment}
              onViewInvoice={handleViewInvoice}
              onPrintInvoice={handlePrintInvoice}
              onOpenPayment={handleOpenPayment}
            />
          </div>

          {/* Surgery History */}
          <SurgeryHistorySection patientId={patientId} />

          {/* Timeline / Visits */}
          <div ref={sectionRefs.visits}>
            <div ref={sectionRefs.timeline}>
              <TimelineSection
                patientId={patientId}
              />
            </div>
          </div>
        </CollapsibleSectionGroup>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-end gap-3 z-20">
        {canGenerateDocuments && (
          <button
            onClick={() => setShowDocumentGenerator(true)}
            className="btn btn-secondary"
          >
            Générer document
          </button>
        )}
        {canCreateExam && (
          <button
            onClick={() => navigate(`/ophthalmology/consultation/${patientId}`)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle consultation
          </button>
        )}
      </div>

      {/* Document Generator Modal */}
      {showDocumentGenerator && (
        <DocumentGenerator
          patientId={patientId}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            toast.success('Document généré avec succès!');
            setShowDocumentGenerator(false);
          }}
        />
      )}

      {/* Prescription Detail Modal */}
      {showPrescriptionModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Détail de l'ordonnance</h2>
              <button onClick={() => setShowPrescriptionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-500">Date de prescription</p>
                <p className="font-medium">{formatDate(selectedPrescription.prescribedDate || selectedPrescription.createdAt)}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Prescripteur</p>
                <p className="font-medium">{selectedPrescription.prescriber?.name || 'N/A'}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-3">Médicaments</p>
                <div className="space-y-3">
                  {(selectedPrescription.medications || []).map((med, idx) => {
                    // Format dosage - can be string or object {amount, unit, timing}
                    const formatDosage = (dosage) => {
                      if (!dosage) return 'N/A';
                      if (typeof dosage === 'string') return dosage;
                      if (typeof dosage === 'object') {
                        const parts = [];
                        if (dosage.amount) parts.push(dosage.amount);
                        if (dosage.unit) parts.push(dosage.unit);
                        return parts.length > 0 ? parts.join(' ') : 'N/A';
                      }
                      return 'N/A';
                    };

                    // Format frequency - can be string or object
                    const formatFrequency = (freq) => {
                      if (!freq) return 'N/A';
                      if (typeof freq === 'string') return freq;
                      if (typeof freq === 'object') {
                        return freq.label || freq.value || freq.times || 'N/A';
                      }
                      return 'N/A';
                    };

                    // Format duration - can be string or object
                    const formatDuration = (dur) => {
                      if (!dur) return 'N/A';
                      if (typeof dur === 'string') return dur;
                      if (typeof dur === 'object') {
                        const parts = [];
                        if (dur.value || dur.amount) parts.push(dur.value || dur.amount);
                        if (dur.unit) parts.push(dur.unit);
                        return parts.length > 0 ? parts.join(' ') : 'N/A';
                      }
                      return 'N/A';
                    };

                    return (
                      <div key={idx} className="bg-gray-50 rounded-lg p-4">
                        <p className="font-semibold text-gray-900">{med.medication || med.name || med.drug?.name || 'Médicament'}</p>
                        <p className="text-sm text-gray-600 mt-1">Dosage: {formatDosage(med.dosage)}</p>
                        <p className="text-sm text-gray-600">Fréquence: {formatFrequency(med.frequency)}</p>
                        <p className="text-sm text-gray-600">Durée: {formatDuration(med.duration)}</p>
                        {med.instructions && (
                          <p className="text-sm text-gray-500 italic mt-2">{med.instructions}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setShowPrescriptionModal(false)} className="btn btn-secondary">
                  Fermer
                </button>
                <button onClick={() => handlePrintPrescription(selectedPrescription)} className="btn btn-primary">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Facture {selectedInvoice.invoiceNumber || `#${selectedInvoice._id?.slice(-6).toUpperCase()}`}
              </h2>
              <button onClick={() => setShowInvoiceModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.date || selectedInvoice.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    selectedInvoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                    selectedInvoice.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedInvoice.status === 'paid' ? 'Payée' :
                     selectedInvoice.status === 'partial' ? 'Partiel' : 'En attente'}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{(selectedInvoice.total || 0).toLocaleString()} CDF</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                <button onClick={() => setShowInvoiceModal(false)} className="btn btn-secondary">
                  Fermer
                </button>
                <button onClick={() => handlePrintInvoice(selectedInvoice)} className="btn btn-secondary">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimer
                </button>
                {selectedInvoice.status !== 'paid' && canProcessPayment && (
                  <button
                    onClick={() => {
                      setShowInvoiceModal(false);
                      handleOpenPayment(selectedInvoice);
                    }}
                    className="btn btn-primary"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal - Multi-Currency */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full">
            <MultiCurrencyPayment
              invoiceId={selectedInvoice._id}
              amountDue={(selectedInvoice.total || 0) - (selectedInvoice.amountPaid || 0)}
              baseCurrency="CDF"
              onPaymentComplete={(result) => {
                toast.success('Paiement enregistré avec succès');
                setShowPaymentModal(false);
                setSelectedInvoice(null);
                // Refresh billing data
                if (sectionRefs.billing?.current) {
                  // Trigger refresh of billing section
                  window.dispatchEvent(new CustomEvent('refresh-billing'));
                }
              }}
              onCancel={() => {
                setShowPaymentModal(false);
                setSelectedInvoice(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Imaging Viewer Modal */}
      {showImagingModal && selectedImaging && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
          <div className="max-w-4xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">{selectedImaging.title || 'Image'}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedImaging.url || selectedImaging.fileUrl) {
                      window.open(selectedImaging.url || selectedImaging.fileUrl, '_blank');
                    }
                  }}
                  className="btn btn-secondary"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </button>
                <button onClick={() => setShowImagingModal(false)} className="text-white hover:text-gray-300">
                  <X className="h-8 w-8" />
                </button>
              </div>
            </div>
            <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '60vh' }}>
              {selectedImaging.url || selectedImaging.fileUrl || selectedImaging.thumbnailUrl ? (
                <img
                  src={selectedImaging.url || selectedImaging.fileUrl || selectedImaging.thumbnailUrl}
                  alt={selectedImaging.title}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <Eye className="h-24 w-24 mx-auto mb-4" />
                  <p>Aperçu non disponible</p>
                </div>
              )}
            </div>
            <div className="mt-4 text-white text-sm">
              <p>Type: {selectedImaging.type || selectedImaging.category || 'N/A'}</p>
              <p>Date: {formatDate(selectedImaging.createdAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
