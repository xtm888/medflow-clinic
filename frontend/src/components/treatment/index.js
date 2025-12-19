/**
 * Treatment Components
 *
 * StudioVision Parity: Treatment/Prescription builder system
 *
 * Components:
 * - TreatmentBuilder: 4-column medication prescription builder
 * - TreatmentSummary: Compact read-only display
 *
 * Usage:
 * import TreatmentBuilder, {
 *   TreatmentSummary,
 *   MEDICATION_CATEGORIES,
 *   STANDARD_TREATMENTS
 * } from '@/components/treatment';
 */

export {
  default,
  TreatmentSummary,
  MEDICATION_CATEGORIES,
  DOSE_OPTIONS,
  POSOLOGIE_OPTIONS,
  DETAILS_OPTIONS,
  DURATION_OPTIONS,
  STANDARD_TREATMENTS,
  PRESCRIPTION_TYPES,
} from './TreatmentBuilder';
