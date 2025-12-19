/**
 * Contact Lens Fitting Components
 *
 * StudioVision Parity: Complete 4-tab contact lens fitting workflow
 *
 * Main Component:
 * - ContactLensFitting: 4-tab container for complete fitting workflow
 *
 * Tab Components:
 * - ContactLensHistoryTab: Patient history and current issues
 * - ContactLensFittingTab: Trial lens and assessment
 * - ContactLensCareTab: Care instructions and annual supply
 * - ContactLensFollowUpTab: Follow-up and education checklist
 *
 * Usage:
 * import ContactLensFitting, {
 *   ContactLensFittingBadge,
 *   IssuesSummaryBadge,
 *   AssessmentSummary,
 *   AnnualSupplySummary,
 *   EducationProgressBadge
 * } from '@/components/contactLens';
 */

// Main container
export { default, ContactLensFittingBadge, LENS_TYPES, FITTING_STATUS, CL_TABS } from './ContactLensFitting';

// Tab components
export { default as ContactLensHistoryTab, IssuesSummaryBadge } from './ContactLensHistoryTab';
export { default as ContactLensFittingTab, AssessmentSummary } from './ContactLensFittingTab';
export { default as ContactLensCareTab, AnnualSupplySummary } from './ContactLensCareTab';
export { default as ContactLensFollowUpTab, EducationProgressBadge, EDUCATION_CHECKLIST } from './ContactLensFollowUpTab';
