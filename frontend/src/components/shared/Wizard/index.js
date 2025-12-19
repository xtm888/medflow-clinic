/**
 * Shared Wizard System
 *
 * Provides reusable wizard/step components for multi-step forms.
 *
 * Components:
 * - WizardContainer: Full-page wizard with progress indicator
 * - StepProgress: Visual step indicator (can be used standalone)
 * - StepHeader: Step title and description
 * - StepNavigation: Back/Next/Complete buttons
 *
 * For modal-based wizards, use WizardModal from shared/Modal.
 *
 * Usage:
 * import { WizardContainer } from '@/components/shared/Wizard';
 *
 * const steps = [
 *   { id: 'info', title: 'Information', component: InfoStep },
 *   { id: 'confirm', title: 'Confirmation', component: ConfirmStep },
 * ];
 *
 * <WizardContainer steps={steps} onComplete={handleSubmit} />
 */

export {
  default as WizardContainer,
  StepProgress,
  StepHeader,
  StepNavigation
} from './WizardContainer';
