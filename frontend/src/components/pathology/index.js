/**
 * Pathology Components
 *
 * StudioVision Parity: Pathology/Diagnosis entry system
 *
 * Components:
 * - PathologyPicker: 3-column symptom/description/diagnostic picker
 * - PathologySummary: Compact read-only display
 * - DRStagingSelector: Diabetic retinopathy staging (ETDRS)
 *
 * Usage:
 * import PathologyPicker, {
 *   PathologySummary,
 *   PATHOLOGY_CATEGORIES,
 *   COMMON_DIAGNOSES,
 *   DRStagingSelector
 * } from '@/components/pathology';
 */

export {
  default,
  PathologySummary,
  PATHOLOGY_CATEGORIES,
  DOMINANTE_OPTIONS,
  LATERALITY_OPTIONS,
  SEVERITY_OPTIONS,
  COMMON_DIAGNOSES,
} from './PathologyPicker';

export {
  default as DRStagingSelector,
  DRStagingBadge,
  DR_STAGES,
  DME_STAGES,
  CSME_CRITERIA,
  NV_OPTIONS
} from './DRStagingSelector';
