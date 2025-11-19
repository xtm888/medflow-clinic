/**
 * Prescription Module - Unified prescription management
 *
 * Usage:
 * import { OpticalPrescriptionBuilder, usePrescriptionSafety } from '@/modules/prescription';
 */

// Components
export { default as OpticalPrescriptionBuilder } from './OpticalPrescriptionBuilder';

// Hooks
export {
  default as usePrescriptionSafety,
  quickAllergyCheck,
  quickInteractionCheck,
  quickDosingCheck
} from './usePrescriptionSafety';
