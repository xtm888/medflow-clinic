import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronRight, Save, X,
  AlertCircle, Loader2, FileText, Printer, Calendar,
  Phone, User, Eye, History, Clock, ChevronDown, ChevronUp,
  Activity, Stethoscope, Pill
} from 'lucide-react';
import { usePatientClinical } from '../patient';
import { useAutoSave } from '../../hooks/useAutoSave';
import AutoSaveIndicator from '../../components/AutoSaveIndicator';
import ophthalmologyService from '../../services/ophthalmologyService';
import { HistoryProvider } from '../../contexts/HistoryContext';
import EditableHistorySidebar from '../../pages/ophthalmology/components/EditableHistorySidebar';
import ConfirmationModal from '../../components/ConfirmationModal';
import FaceVerification from '../../components/biometric/FaceVerification';
import { useAuth } from '../../contexts/AuthContext';
import OfflineWarningBanner from '../../components/OfflineWarningBanner';

/**
 * ClinicalWorkflow - Modular clinical workflow orchestrator
 *
 * Replaces the monolithic PatientVisit.jsx with a configuration-driven approach.
 *
 * Features:
 * - Configuration-driven tabs
 * - Auto-save per step
 * - Progress tracking
 * - Step validation
 * - Keyboard navigation
 */
export default function ClinicalWorkflow({
  // Workflow configuration
  workflowConfig,
  // Step components mapping
  stepComponents,
  // Service for saving data
  saveService,
  // Initial data
  initialData = {},
  // Callbacks
  onComplete,
  onCancel,
  // Options
  showProgress = true,
  enableAutoSave = true,
  autoSaveInterval = 30000,
  showPatientSidebar = true,
  showHistorySidebar = true,
  className = ''
}) {
  const { id, patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Patient data from our new hook
  const {
    patient,
    history,
    isLoading: patientLoading,
    patientFullName,
    patientAge
  } = usePatientClinical(patientId || initialData.patientId, Boolean(patientId || initialData.patientId));

  // Face verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  // Workflow state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepData, setStepData] = useState({});
  const [stepErrors, setStepErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Fermer-like sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previousExams, setPreviousExams] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historySidebarCollapsed, setHistorySidebarCollapsed] = useState(false);

  // Load patient's previous exams for comparison
  useEffect(() => {
    const loadPreviousExams = async () => {
      const pid = patientId || initialData.patientId;
      if (!pid) return;

      try {
        setLoadingHistory(true);
        const response = await ophthalmologyService.getPatientExamHistory(pid);
        setPreviousExams(response.data || response || []);
      } catch (error) {
        console.error('Error loading previous exams:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadPreviousExams();
  }, [patientId, initialData.patientId]);

  // Calculate patient age from DOB
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Extract steps from config
  const steps = useMemo(() => {
    return workflowConfig?.steps || [];
  }, [workflowConfig]);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Progress percentage
  const progress = useMemo(() => {
    if (steps.length === 0) return 0;
    return Math.round((completedSteps.size / steps.length) * 100);
  }, [completedSteps.size, steps.length]);

  // Initialize step data from initial data
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      const newStepData = {};
      steps.forEach(step => {
        if (initialData[step.id]) {
          newStepData[step.id] = initialData[step.id];
        }
      });
      setStepData(newStepData);
    }
  }, [initialData, steps]);

  // Auto-save function
  const handleAutoSave = useCallback(async (data, isAutoSave) => {
    if (!saveService || !currentStep) return;

    try {
      await saveService.saveStep(currentStep.id, data, { isAutoSave });
    } catch (error) {
      console.error('Auto-save failed:', error);
      throw error;
    }
  }, [saveService, currentStep]);

  // Auto-save hook
  const {
    saveStatus,
    lastSaved,
    error: saveError,
    manualSave
  } = useAutoSave(
    stepData[currentStep?.id],
    handleAutoSave,
    {
      interval: autoSaveInterval,
      debounceDelay: 2000,
      enabled: enableAutoSave && Boolean(currentStep?.id)
    }
  );

  // Update step data
  const updateStepData = useCallback((stepId, data) => {
    setStepData(prev => ({
      ...prev,
      [stepId]: typeof data === 'function' ? data(prev[stepId]) : data
    }));
    setIsDirty(true);
  }, []);

  // Validate current step
  const validateStep = useCallback((stepId) => {
    const step = steps.find(s => s.id === stepId);
    if (!step?.validate) return true;

    try {
      const data = stepData[stepId];
      const errors = step.validate(data);

      if (errors && Object.keys(errors).length > 0) {
        setStepErrors(prev => ({ ...prev, [stepId]: errors }));
        return false;
      }

      setStepErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[stepId];
        return newErrors;
      });
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }, [steps, stepData]);

  // Mark step as completed
  const completeStep = useCallback((stepId) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  }, []);

  // Navigate to step
  const goToStep = useCallback((index) => {
    if (index < 0 || index >= steps.length) return;

    // Validate current step before leaving (optional)
    if (currentStep?.requireValidation) {
      if (!validateStep(currentStep.id)) {
        return;
      }
    }

    setCurrentStepIndex(index);
  }, [steps.length, currentStep, validateStep]);

  // Go to next step
  const goToNextStep = useCallback(() => {
    if (!currentStep) return;

    // Validate current step
    if (currentStep.requireValidation && !validateStep(currentStep.id)) {
      return;
    }

    // Mark as completed
    completeStep(currentStep.id);

    // Navigate
    if (!isLastStep) {
      setCurrentStepIndex(prev => prev + 1);
    } else if (onComplete) {
      onComplete(stepData);
    }
  }, [currentStep, isLastStep, validateStep, completeStep, stepData, onComplete]);

  // Go to previous step
  const goToPreviousStep = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [isFirstStep]);

  // Save all data
  const saveAll = useCallback(async () => {
    if (!saveService) return;

    setSaving(true);
    try {
      await saveService.saveAll(stepData);
      setIsDirty(false);
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [saveService, stepData]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setConfirmModal({
        isOpen: true,
        title: 'Modifications non enregistrées',
        message: 'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter sans sauvegarder?',
        type: 'warning',
        onConfirm: () => {
          if (onCancel) {
            onCancel();
          } else {
            navigate(-1);
          }
        }
      });
      return;
    }

    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  }, [isDirty, onCancel, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAll();
      }

      // Alt + Arrow keys for navigation
      if (e.altKey) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextStep();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPreviousStep();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveAll, goToNextStep, goToPreviousStep]);

  // Face verification check when patient data loads
  useEffect(() => {
    if (!patient) return;

    const isDoctorRole = user?.role === 'doctor' || user?.role === 'ophthalmologist' || user?.role === 'admin';

    if (isDoctorRole && patient?.biometric?.faceEncoding) {
      const sessionKey = `faceVerified_${patient._id || patient.id}`;
      const alreadyVerified = sessionStorage.getItem(sessionKey);

      if (alreadyVerified === 'true') {
        setVerificationPassed(true);
      } else {
        setShowVerification(true);
        setVerificationPassed(false);
      }
    } else {
      // Skip verification if not doctor role or patient has no biometric
      setVerificationPassed(true);
    }
  }, [patient, user]);

  // Get step component
  const StepComponent = currentStep ? stepComponents[currentStep.component] : null;

  // Show face verification modal
  if (showVerification && patient) {
    return (
      <FaceVerification
        patient={patient}
        onVerified={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${patient._id || patient.id}`, 'true');
        }}
        onSkip={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${patient._id || patient.id}`, 'true');
        }}
        onCancel={() => navigate(-1)}
        allowSkip={user?.role === 'admin'}
      />
    );
  }

  // Block content until verification passed
  if (patient && !verificationPassed) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!workflowConfig || steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Configuration du workflow non disponible</p>
      </div>
    );
  }

  // Get patient ID for HistoryProvider
  const effectivePatientId = patientId || initialData.patientId;

  // Workflow content wrapped in HistoryProvider if showing history sidebar
  const WorkflowContent = (
    <div className="flex flex-col h-full">
      {/* CRITICAL: Offline warning for clinical workflows */}
      <OfflineWarningBanner
        isCritical={true}
        criticalMessage="Mode hors ligne. Sauvegarde automatique locale active. Les données seront synchronisées au retour de la connexion."
      />

      <div className={`flex flex-1 overflow-hidden ${className}`}>
      {/* Patient Sidebar - Fermer Style */}
      {showPatientSidebar && patient && (
        <div className={`flex-shrink-0 border-r bg-gray-50 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-72'}`}>
          <div className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="p-3 border-b bg-white">
              <div className="flex items-center justify-between">
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium text-gray-600">Patient</span>
                )}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Patient Info */}
            <div className="p-3 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-lg">
                    {patient.firstName?.[0]}{patient.lastName?.[0]}
                  </span>
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {patientFullName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {patientAge || calculateAge(patient.dateOfBirth)} ans
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Patient Details */}
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-3">
                  {/* Date of Birth */}
                  <div className="flex items-start space-x-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-gray-500 text-xs">Date de naissance</div>
                      <div className="text-gray-900">{formatDate(patient.dateOfBirth)}</div>
                    </div>
                  </div>

                  {/* Phone */}
                  {patient.phone && (
                    <div className="flex items-start space-x-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-gray-500 text-xs">Téléphone</div>
                        <div className="text-gray-900">{patient.phone}</div>
                      </div>
                    </div>
                  )}

                  {/* Profession */}
                  {patient.profession && (
                    <div className="flex items-start space-x-2 text-sm">
                      <User className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-gray-500 text-xs">Profession</div>
                        <div className="text-gray-900">{patient.profession}</div>
                      </div>
                    </div>
                  )}

                  {/* MRN */}
                  {patient.mrn && (
                    <div className="flex items-start space-x-2 text-sm">
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-gray-500 text-xs">N° Dossier</div>
                        <div className="text-gray-900">{patient.mrn}</div>
                      </div>
                    </div>
                  )}

                  {/* Dominant Eye */}
                  {patient.dominantEye && (
                    <div className="flex items-start space-x-2 text-sm">
                      <Eye className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-gray-500 text-xs">Œil dominant</div>
                        <div className="text-gray-900">{patient.dominantEye}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visit History Section */}
                <div className="border-t">
                  <button
                    onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                    className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <span className="flex items-center">
                      <History className="w-4 h-4 mr-2" />
                      Historique ({previousExams.length})
                    </span>
                    {showHistoryPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showHistoryPanel && (
                    <div className="max-h-48 overflow-y-auto">
                      {loadingHistory ? (
                        <div className="p-3 text-center">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                        </div>
                      ) : previousExams.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">
                          Aucun examen précédent
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {previousExams.map((exam, index) => (
                            <button
                              key={exam._id || index}
                              onClick={() => setSelectedHistoryIndex(selectedHistoryIndex === index ? null : index)}
                              className={`w-full text-left p-2 rounded text-xs transition ${
                                selectedHistoryIndex === index
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              <div className="font-medium">
                                {new Date(exam.createdAt || exam.date).toLocaleDateString('fr-FR')}
                              </div>
                              <div className="text-gray-500 truncate">
                                {exam.type || 'Consultation'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="border-t p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Actions rapides</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex flex-col items-center p-2 rounded border hover:bg-gray-100 text-xs">
                      <Printer className="w-4 h-4 mb-1 text-gray-600" />
                      Imprimer
                    </button>
                    <button className="flex flex-col items-center p-2 rounded border hover:bg-gray-100 text-xs">
                      <FileText className="w-4 h-4 mb-1 text-gray-600" />
                      Documents
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Progress and Tabs */}
        <div className="flex-shrink-0 border-b bg-white">
          <div className="px-4 py-3">
            {/* Top Bar with Save */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600">
                {workflowConfig?.name || 'Consultation'}
              </div>

              <div className="flex items-center space-x-2">
                {enableAutoSave && (
                  <AutoSaveIndicator
                    status={saveStatus}
                    lastSaved={lastSaved}
                    error={saveError}
                  />
                )}

                <button
                  onClick={saveAll}
                  disabled={saving || !isDirty}
                  className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Sauvegarder
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {showProgress && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Progression</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Step Tabs */}
            <div className="flex space-x-1 overflow-x-auto pb-1">
              {steps.map((step, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = completedSteps.has(step.id);
                const hasError = stepErrors[step.id];

                return (
                  <button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`
                      flex items-center px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors
                      ${isActive
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : isCompleted
                          ? 'bg-green-50 text-green-700'
                          : hasError
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                  >
                    {isCompleted && !isActive && (
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {hasError && !isActive && (
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {step.shortLabel || step.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto">
          {patientLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : StepComponent ? (
            <StepComponent
              data={stepData[currentStep.id] || {}}
              onChange={(data) => updateStepData(currentStep.id, data)}
              errors={stepErrors[currentStep.id]}
              patient={patient}
              history={history}
              previousExams={previousExams}
              selectedHistoryExam={selectedHistoryIndex !== null ? previousExams[selectedHistoryIndex] : null}
              allStepData={stepData}
              onComplete={() => goToNextStep()}
              isActive={true}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">
                Composant non trouvé: {currentStep?.component}
              </p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex-shrink-0 border-t bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleCancel}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <X className="w-4 h-4 mr-2" />
              Annuler
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={goToPreviousStep}
                disabled={isFirstStep}
                className="flex items-center px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Précédent
              </button>

              {isLastStep ? (
                <button
                  onClick={() => onComplete?.(stepData)}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Terminer
                </button>
              ) : (
                <button
                  onClick={goToNextStep}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Sidebar - Right Side */}
      {showHistorySidebar && effectivePatientId && (
        <EditableHistorySidebar
          isCollapsed={historySidebarCollapsed}
          onToggle={() => setHistorySidebarCollapsed(!historySidebarCollapsed)}
        />
      )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );

  // Wrap with HistoryProvider if showing history sidebar
  if (showHistorySidebar && effectivePatientId) {
    return (
      <HistoryProvider patientId={effectivePatientId}>
        {WorkflowContent}
      </HistoryProvider>
    );
  }

  return WorkflowContent;
}

// Hook for using workflow state outside the component
export function useClinicalWorkflow() {
  // This would be connected to a context provider in a full implementation
  return {
    currentStep: null,
    stepData: {},
    goToStep: () => {},
    goToNextStep: () => {},
    goToPreviousStep: () => {},
    updateStepData: () => {},
    saveAll: () => {},
    progress: 0
  };
}
