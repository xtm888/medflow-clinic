/**
 * Alert Components
 *
 * StudioVision Parity: Patient safety alert system
 *
 * Components:
 * - PatientAlertsBanner: Full alert banner with all alert types
 * - AllergyBanner: Allergy-only banner
 * - CriticalAlertInline: Single inline critical alert
 *
 * Usage:
 * import PatientAlertsBanner, {
 *   AllergyBanner,
 *   CriticalAlertInline,
 *   ALERT_TYPES
 * } from '@/components/alerts';
 */

export {
  default,
  AllergyBanner,
  CriticalAlertInline,
  ALERT_TYPES,
  SEVERITY_COLORS
} from './PatientAlertsBanner';
