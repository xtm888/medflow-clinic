/**
 * NewConsultation - Ophthalmology consultation with multiple workflow modes
 *
 * Supports:
 * - Full step-by-step workflow (12 étapes)
 * - Quick follow-up workflow (5 étapes)
 * - Refraction-only workflow (5 étapes)
 * - Consolidated dashboard (1 page - all data at once)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronLeft, LayoutDashboard, Shield } from 'lucide-react';
import {
  ClinicalWorkflow,
  ophthalmologyWorkflowConfig,
  quickFollowUpWorkflowConfig,
  refractionOnlyWorkflowConfig,
  consolidatedDashboardWorkflowConfig,
  useClinicalSession
} from '@modules/clinical';
import { PatientSelector } from '@modules/patient';
import consultationSessionService from '@services/consultationSessionService';
import patientService from '@services/patientService';
import visitService from '@services/visitService';
import { ClinicalSummaryPanel } from '../../components/panels';
import { ConsultationDashboard } from './components/panels';
import { FaceVerification } from '../../components/biometric';
import { useAuth } from '../../contexts/AuthContext';
import OfflineWarningBanner from '../../components/OfflineWarningBanner';

// Import existing step components
import VisualAcuityStep from './components/VisualAcuityStep';
import ObjectiveRefractionStep from './components/ObjectiveRefractionStep';
import SubjectiveRefractionStep from './components/SubjectiveRefractionStep';
import AdditionalTestsStep from './components/AdditionalTestsStep';
import KeratometryStep from './components/KeratometryStep';
import PrescriptionStep from './components/PrescriptionStep';
import ChiefComplaintStep from './components/ChiefComplaintStep';
import VitalSignsStep from './components/VitalSignsStep';
import DiagnosisStep from './components/DiagnosisStep';
import LaboratoryStep from './components/LaboratoryStep';
import ProceduresStep from './components/ProceduresStep';
import OphthalmologyExamStep from './components/OphthalmologyExamStep';
import SummaryStep from './components/SummaryStep';

// Map step IDs to components
const stepComponents = {
  ChiefComplaintStep,
  VitalSignsStep,
  VisualAcuityStep,
  ObjectiveRefractionStep,
  SubjectiveRefractionStep,
  AdditionalTestsStep,
  KeratometryStep,
  OphthalmologyExamStep,
  DiagnosisStep,
  LaboratoryStep,
  ProceduresStep,
  PrescriptionStep,
  SummaryStep
};

export default function NewConsultation() {
  const navigate = useNavigate();
  const params = useParams(); // Get all URL params
  // Handle both /visits/:id (visit ID) and /ophthalmology/consultation/:patientId (patient ID)
  const visitIdFromUrl = params.id; // From /visits/:id route
  const patientIdParam = params.patientId; // From /ophthalmology/consultation/:patientId route
  const [searchParams] = useSearchParams();
  const patientIdQuery = searchParams.get('patientId'); // Get patientId from query params
  const [patientId, setPatientId] = useState(patientIdParam || patientIdQuery || null);
  const visitIdParam = visitIdFromUrl || searchParams.get('visitId');
  const appointmentIdParam = searchParams.get('appointmentId');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isDoctorRole = ['doctor', 'ophthalmologist', 'optometrist', 'orthoptist'].includes(user?.role);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [workflowType, setWorkflowType] = useState('dashboard'); // 'dashboard', 'full', 'followup', 'refraction'
  const [loadingPatient, setLoadingPatient] = useState(false);

  // Face verification state (session-based)
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);

  // Temporary patient selection (before verification)
  const [tempPatient, setTempPatient] = useState(null);

  // Info panel sidebar state
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Load visit first if visitId is in URL, then extract patientId
  useEffect(() => {
    if (visitIdFromUrl && !patientId) {
      loadVisitAndPatient();
    } else if (patientId && !selectedPatient) {
      loadPatientFromUrl();
    }
  }, [visitIdFromUrl, patientId]);

  const loadVisitAndPatient = async () => {
    try {
      setLoadingPatient(true);
      // Fetch visit to get patient info
      const visitData = await visitService.getVisit(visitIdFromUrl);
      const visit = visitData?.data || visitData;

      if (visit) {
        // Extract patient ID from visit
        const visitPatientId = visit.patient?._id || visit.patient;
        if (visitPatientId) {
          setPatientId(visitPatientId);
          // If patient data is already populated, use it
          if (visit.patient && typeof visit.patient === 'object' && visit.patient._id) {
            setSelectedPatient(visit.patient);
            setVerificationPassed(true); // Skip verification when loading existing visit
            setLoadingPatient(false);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error loading visit:', error);
    } finally {
      setLoadingPatient(false);
    }
  };

  const loadPatientFromUrl = async () => {
    try {
      setLoadingPatient(true);
      const response = await patientService.getPatient(patientId);
      // Handle both formats: direct patient object or { success, data } format
      const patient = response?.data || response;
      if (patient && (patient._id || patient.patientId)) {
        setSelectedPatient(patient);

        // Check if face verification is needed for doctors
        if (isDoctorRole) {
          const sessionKey = `faceVerified_${patientId}`;
          const alreadyVerified = sessionStorage.getItem(sessionKey);

          if (alreadyVerified === 'true') {
            setVerificationPassed(true);
            setShowVerification(false);
          } else if (patient?.biometric?.faceEncoding) {
            // Patient has enrolled photo, require verification
            setShowVerification(true);
            setVerificationPassed(false);
          } else {
            // Patient has no enrolled photo
            setVerificationPassed(true);
            setShowVerification(false);
          }
        } else {
          // Non-doctors don't need verification
          setVerificationPassed(true);
        }
      } else {
        console.error('Invalid patient data received:', response);
      }
    } catch (error) {
      console.error('Error loading patient:', error);
    } finally {
      setLoadingPatient(false);
    }
  };

  // Get workflow config based on type
  const getWorkflowConfig = () => {
    switch (workflowType) {
      case 'dashboard':
        return consolidatedDashboardWorkflowConfig;
      case 'followup':
        return quickFollowUpWorkflowConfig;
      case 'refraction':
        return refractionOnlyWorkflowConfig;
      default:
        return ophthalmologyWorkflowConfig;
    }
  };

  // Clinical session management
  const {
    sessionId,
    saveStep,
    saveAll,
    completeSession
  } = useClinicalSession({
    patientId: selectedPatient?._id,
    visitId: visitIdParam,
    appointmentId: appointmentIdParam,
    workflowType
  });

  // Save service for ClinicalWorkflow
  const saveService = {
    saveStep: async (stepId, data, options) => {
      return saveStep(stepId, data, options);
    },
    saveAll: async (allStepData) => {
      return saveAll(allStepData);
    }
  };

  // Handle workflow completion
  const handleComplete = async (stepData) => {
    try {
      await completeSession(stepData);
      navigate('/queue');
    } catch (error) {
      console.error('Error completing consultation:', error);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate('/queue');
  };

  // Handle start consultation with verification
  const handleStartConsultation = () => {
    if (!selectedPatient) return;
    // Show verification step
    setShowVerification(true);
  };

  // Handle verification complete
  const handleVerificationComplete = (result) => {
    setVerificationPassed(true);
    setShowVerification(false);
    // Store in session storage (clears on browser close)
    if (selectedPatient) {
      sessionStorage.setItem(`faceVerified_${selectedPatient._id}`, 'true');
    }
  };

  // Handle skip verification (admin only)
  const handleSkipVerification = () => {
    if (!isAdmin) {
      return;
    }
    setVerificationPassed(true);
    setShowVerification(false);
  };

  // Patient selection view
  if (!selectedPatient || (!verificationPassed && !showVerification)) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Nouvelle Consultation</h1>

        <OfflineWarningBanner isCritical={true} />

        {/* Workflow type selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de Consultation
          </label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Dashboard option - recommended */}
            <button
              onClick={() => setWorkflowType('dashboard')}
              className={`p-4 text-sm rounded-lg border transition col-span-2 ${
                workflowType === 'dashboard'
                  ? 'bg-purple-50 border-purple-300 text-purple-700 ring-2 ring-purple-200'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <LayoutDashboard className="h-5 w-5" />
                <div className="font-medium">Vue Consolidée</div>
                <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Recommandé</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Toutes les données sur une seule page</div>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setWorkflowType('full')}
              className={`p-3 text-sm rounded-lg border transition ${
                workflowType === 'full'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Complète</div>
              <div className="text-xs text-gray-500">12 étapes</div>
            </button>
            <button
              onClick={() => setWorkflowType('followup')}
              className={`p-3 text-sm rounded-lg border transition ${
                workflowType === 'followup'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Suivi</div>
              <div className="text-xs text-gray-500">5 étapes</div>
            </button>
            <button
              onClick={() => setWorkflowType('refraction')}
              className={`p-3 text-sm rounded-lg border transition ${
                workflowType === 'refraction'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Réfraction</div>
              <div className="text-xs text-gray-500">5 étapes</div>
            </button>
          </div>
        </div>

        {/* Patient selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient
          </label>
          <PatientSelector
            mode="dropdown"
            value={tempPatient}
            onChange={setTempPatient}
            placeholder="Rechercher un patient..."
            showCreateButton={true}
            onCreateNew={() => navigate('/patients?new=true')}
          />
        </div>

        {/* Verification info */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 text-sm">
            <Shield className="h-4 w-4" />
            <span>Une vérification d'identité sera effectuée avant la consultation</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => navigate('/queue')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              if (tempPatient) {
                setSelectedPatient(tempPatient);
                setShowVerification(true);
              }
            }}
            disabled={!tempPatient}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Shield className="h-4 w-4" />
            Vérifier et Commencer
          </button>
        </div>
      </div>
    );
  }

  // Face verification view
  if (showVerification && selectedPatient && !verificationPassed) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Vérification d'Identité</h1>

        <OfflineWarningBanner isCritical={true} />

        <FaceVerification
          patient={selectedPatient}
          onVerified={handleVerificationComplete}
          onSkip={handleSkipVerification}
          onCancel={() => {
            setShowVerification(false);
            setSelectedPatient(null);
          }}
          allowSkip={isAdmin}
        />
      </div>
    );
  }

  // Dashboard save handler
  const handleDashboardSave = async (dashboardData, isAutoSave = false) => {
    try {
      await saveAll(dashboardData);
    } catch (error) {
      console.error('Error saving dashboard data:', error);
    }
  };

  // Dashboard complete handler
  const handleDashboardComplete = async (dashboardData) => {
    try {
      // Flatten the dashboard data for the backend
      // The backend expects fields at root level (diagnostic, laboratory, prescription, sessionData)
      // but the dashboard might send it wrapped in stepData
      const sessionDataToSave = {
        sessionData: dashboardData, // Store the full dashboard data
        diagnostic: dashboardData.diagnostic,
        laboratory: dashboardData.laboratory,
        prescription: dashboardData.prescription,
        ...dashboardData // Also spread all fields at root level
      };

      await completeSession(sessionDataToSave);
      navigate('/queue');
    } catch (error) {
      console.error('Error completing consultation:', error);
    }
  };

  // Consolidated Dashboard view
  if (workflowType === 'dashboard') {
    return (
      <ConsultationDashboard
        patient={selectedPatient}
        initialData={consolidatedDashboardWorkflowConfig.defaultData}
        onSave={handleDashboardSave}
        onComplete={handleDashboardComplete}
        onCancel={handleCancel}
        autoSave={true}
        autoSaveInterval={30000}
      />
    );
  }

  // Step-based Clinical workflow view
  return (
    <div className="h-screen flex flex-col">
      <OfflineWarningBanner isCritical={true} />

      <div className="flex flex-1">
      {/* Main Workflow Area */}
      <div className={`flex-1 transition-all duration-300 ${showInfoPanel ? 'mr-96' : ''}`}>
        <ClinicalWorkflow
          workflowConfig={getWorkflowConfig()}
          stepComponents={stepComponents}
          saveService={saveService}
          initialData={ophthalmologyWorkflowConfig.defaultData}
          onComplete={handleComplete}
          onCancel={handleCancel}
          showProgress={true}
          enableAutoSave={true}
          autoSaveInterval={30000}
        />
      </div>

      {/* Info Panel Toggle Button */}
      <button
        onClick={() => setShowInfoPanel(!showInfoPanel)}
        className={`fixed top-1/2 transform -translate-y-1/2 z-40
          ${showInfoPanel ? 'right-96' : 'right-0'}
          bg-purple-600 text-white p-2 rounded-l-lg shadow-lg hover:bg-purple-700 transition-all duration-300`}
        title={showInfoPanel ? 'Fermer panneau' : 'Infos Patient'}
      >
        {showInfoPanel ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>

      {/* Info Panel Sidebar - All info in one view */}
      <div
        className={`fixed right-0 top-0 h-full w-96 shadow-xl z-30
          transform transition-transform duration-300 ease-in-out
          ${showInfoPanel ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedPatient && (
          <ClinicalSummaryPanel
            patient={selectedPatient}
            patientId={selectedPatient?._id || selectedPatient?.id}
            variant="sidebar"
            onClose={() => setShowInfoPanel(false)}
            onNavigateToProfile={(id) => {
              setShowInfoPanel(false);
              navigate(`/patients/${id}`);
            }}
            showOphthalmology={true}
          />
        )}
      </div>
      </div>
    </div>
  );
}
