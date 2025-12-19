/**
 * Shared Modal System
 *
 * This module provides a unified modal system for the entire application.
 * All modals should be built using these base components.
 *
 * Components:
 * - BaseModal: Foundation with full accessibility
 * - ConfirmModal: Yes/no confirmation dialogs
 * - FormModal: Form submission with dirty state tracking
 * - WizardModal: Multi-step wizards with progress
 *
 * Hooks:
 * - useConfirmModal: Promise-based confirmation
 * - useFormModal: Form modal state management
 * - useWizardModal: Wizard modal state management
 *
 * Usage:
 * import { BaseModal, ConfirmModal, useConfirmModal } from '@/components/shared/Modal';
 */

// Base modal
export { default as BaseModal, SIZE_CLASSES } from './BaseModal';

// Specialized modals
export { default as ConfirmModal, useConfirmModal, VARIANTS } from './ConfirmModal';
export { default as FormModal, useFormModal } from './FormModal';
export { default as WizardModal, useWizardModal, StepIndicator, StepHeader } from './WizardModal';

// Default export for convenience
export { default } from './BaseModal';
