/**
 * Ophthalmology Components
 *
 * StudioVision Parity: Specialized ophthalmology input components
 *
 * Components:
 * - AxisWheelSelector: Visual cylinder axis input wheel (0-180°)
 * - LOCSIIIGrading: Cataract grading system
 * - VisualAcuitySelector: French Monoyer/Parinaud scale VA input
 *
 * Usage:
 * import {
 *   AxisWheelSelector,
 *   AxisWheelCompact,
 *   DualAxisSelector,
 *   AxisDisplay,
 *   LOCSIIIGrading,
 *   LOCSIIISummary,
 *   LOCSIIIQuickDisplay,
 *   VisualAcuitySelector,
 *   DualVisualAcuitySelector,
 *   VisualAcuityPanel,
 *   VisualAcuitySummary,
 * } from '@/components/ophthalmology';
 */

// Axis Wheel Components
export {
  default as AxisWheelSelector,
  AxisWheelCompact,
  DualAxisSelector,
  AxisDisplay,
  AXIS_PRESETS,
  getAstigmatismType,
} from './AxisWheelSelector';

// LOCS III Cataract Grading
export {
  default as LOCSIIIGrading,
  LOCSIIISummary,
  LOCSIIIQuickDisplay,
  LOCS_CATEGORIES,
  SEVERITY_THRESHOLDS,
} from './LOCSIIIGrading';

// Visual Acuity (French Monoyer/Parinaud)
export {
  default as VisualAcuitySelector,
  DualVisualAcuitySelector,
  VisualAcuityPanel,
  VisualAcuitySummary,
  MONOYER_SCALE,
  PARINAUD_SCALE,
  SPECIAL_NOTATIONS,
  CORRECTION_TYPES,
  getAcuityColor,
} from './VisualAcuitySelector';

// Intraocular Pressure (IOP)
export {
  default as IOPInput,
  DualIOPInput,
  IOPHistoryMini,
  IOPSummary,
  MEASUREMENT_METHODS,
  TIME_OF_DAY,
  getIOPStatus,
  calculateCorrectedIOP,
} from './IOPInput';

// Refraction Panel
// @deprecated - RefractionPanel component is deprecated, use the one from '@/pages/ophthalmology/components/panels/RefractionPanel'
// Utility functions are still exported for backwards compatibility
export {
  default as RefractionPanel, // DEPRECATED - use panels/RefractionPanel instead
  RefractionSummary,
  transposeCylinder,
  calculateSphericalEquivalent,
  formatPrescription,
  SPHERE_STEPS,
  CYLINDER_STEPS,
  COMMON_SPHERES,
} from './RefractionPanel';

// Keratometry Input
export {
  default as KeratometryInput,
  KeratometrySummary,
  diopterToMm,
  mmToDiopter,
  calculateAverageK,
  calculateDeltaK,
  classifyCornealAstigmatism,
  getKValueColor,
} from './KeratometryInput';

// Pupil Exam Panel
export {
  default as PupilExamPanel,
  PupilSummary,
  REACTIVITY_GRADES,
  RAPD_GRADES,
  PUPIL_SHAPES,
  calculateAnisocoria,
  isSignificantAnisocoria,
} from './PupilExamPanel';
