/**
 * NewConsultation - Example implementation using new modular architecture
 *
 * This demonstrates how to use:
 * - ClinicalWorkflow orchestrator
 * - PatientSelector
 * - ophthalmologyWorkflowConfig
 * - useClinicalSession
 *
 * This can replace the complex PatientVisit.jsx with a cleaner implementation
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ClinicalWorkflow,
  ophthalmologyWorkflowConfig,
  quickFollowUpWorkflowConfig,
  refractionOnlyWorkflowConfig,
  useClinicalSession
} from '@modules/clinical';
import { PatientSelector } from '@modules/patient';
import consultationSessionService from '@services/consultationSessionService';
import patientService from '@services/patientService';

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
  const { patientId } = useParams(); // Get patientId from URL
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [workflowType, setWorkflowType] = useState('full'); // 'full', 'followup', 'refraction'
  const [loadingPatient, setLoadingPatient] = useState(false);

  // Load patient from URL params if available
  useEffect(() => {
    if (patientId && !selectedPatient) {
      loadPatientFromUrl();
    }
  }, [patientId]);

  const loadPatientFromUrl = async () => {
    try {
      setLoadingPatient(true);
      const patient = await patientService.getPatientById(patientId);
      setSelectedPatient(patient);
    } catch (error) {
      console.error('Error loading patient:', error);
    } finally {
      setLoadingPatient(false);
    }
  };

  // Get workflow config based on type
  const getWorkflowConfig = () => {
    switch (workflowType) {
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

  // Patient selection view
  if (!selectedPatient) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Nouvelle Consultation</h1>

        {/* Workflow type selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de Consultation
          </label>
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
            value={selectedPatient}
            onChange={setSelectedPatient}
            placeholder="Rechercher un patient..."
            showCreateButton={true}
            onCreateNew={() => navigate('/patients?new=true')}
          />
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
            onClick={() => selectedPatient && setSelectedPatient(selectedPatient)}
            disabled={!selectedPatient}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Commencer la Consultation
          </button>
        </div>
      </div>
    );
  }

  // Clinical workflow view
  return (
    <div className="h-screen">
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
  );
}
