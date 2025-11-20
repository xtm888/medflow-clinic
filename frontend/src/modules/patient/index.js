/**
 * Patient Module - Unified patient management components and hooks
 *
 * Usage:
 * import { PatientSelector, PatientForm, usePatientData } from '@/modules/patient';
 *
 * Or individually:
 * import PatientSelector from '@/modules/patient/PatientSelector';
 */

// Components
export { default as PatientSelector, getPatientDisplayName, getPatientInitials } from './PatientSelector';

// Hooks
export {
  default as usePatientData,
  usePatientProfile,
  usePatientClinical,
  usePatientTimelineView
} from './usePatientData';
