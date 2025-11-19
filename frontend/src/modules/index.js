/**
 * Modules Index - Central export for all application modules
 *
 * Usage:
 * import { PatientSelector, ClinicalWorkflow, OpticalPrescriptionBuilder } from '@/modules';
 *
 * Or import from specific modules:
 * import { PatientSelector } from '@/modules/patient';
 */

// Patient Module
export {
  PatientSelector,
  PatientForm,
  usePatientData,
  usePatientProfile,
  usePatientClinical,
  usePatientTimelineView,
  getPatientDisplayName,
  getPatientInitials
} from './patient';

// Clinical Module
export {
  ClinicalWorkflow,
  useClinicalWorkflow,
  useClinicalSession,
  ophthalmologyWorkflowConfig,
  quickFollowUpWorkflowConfig,
  refractionOnlyWorkflowConfig
} from './clinical';

// Prescription Module
export {
  OpticalPrescriptionBuilder,
  usePrescriptionSafety,
  quickAllergyCheck,
  quickInteractionCheck,
  quickDosingCheck
} from './prescription';

// Dashboard Module
export {
  DashboardContainer,
  defaultRoleLayouts,
  useDashboardData,
  useQueueData,
  useAppointmentsData,
  StatsWidget
} from './dashboard';
