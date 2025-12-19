/**
 * Shared Form Components
 *
 * Provides consistent form building blocks across the application.
 *
 * Components:
 * - FormField: Label + input + error wrapper
 * - FormFieldGroup: Horizontal grouping
 * - FormSection: Collapsible section with header
 * - FormSectionGrid: Grid layout for sections
 * - ClinicalInput: OD/OS bilateral input
 * - ClinicalInputGroup: Group of clinical inputs
 * - VisualAcuityInput: VA measurement input
 *
 * Usage:
 * import { FormField, FormSection, ClinicalInput } from '@/components/shared/Form';
 */

export { default as FormField, FormFieldGroup } from './FormField';
export { default as FormSection, FormSectionGrid } from './FormSection';
export {
  default as ClinicalInput,
  ClinicalInputGroup,
  VisualAcuityInput
} from './ClinicalInput';
