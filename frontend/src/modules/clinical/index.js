/**
 * Clinical Module - Clinical workflow management
 *
 * Usage:
 * import { ClinicalWorkflow, useClinicalSession, ophthalmologyWorkflowConfig } from '@/modules/clinical';
 */

// Main orchestrator
export { default as ClinicalWorkflow, useClinicalWorkflow } from './ClinicalWorkflow';

// Hooks
export { default as useClinicalSession } from './useClinicalSession';

// Workflow configurations
export {
  default as ophthalmologyWorkflowConfig,
  quickFollowUpWorkflowConfig,
  refractionOnlyWorkflowConfig
} from './workflows/ophthalmologyWorkflow';
