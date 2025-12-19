/**
 * WizardModal - Multi-step modal with progress indication
 *
 * Features:
 * - Step navigation with progress indicator
 * - Per-step validation
 * - Back/Next/Skip navigation
 * - Keyboard shortcuts (Arrow keys for navigation)
 * - Final step confirmation
 *
 * Usage:
 * const steps = [
 *   { id: 'personal', title: 'Informations', component: PersonalInfoStep },
 *   { id: 'contact', title: 'Contact', component: ContactStep },
 *   { id: 'summary', title: 'Résumé', component: SummaryStep }
 * ];
 *
 * <WizardModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onComplete={handleComplete}
 *   title="Nouveau patient"
 *   steps={steps}
 * />
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  SkipForward
} from 'lucide-react';
import BaseModal from './BaseModal';

// Step status indicator
function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step dot */}
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                ${isCompleted ? 'bg-green-500 text-white' : ''}
                ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-500' : ''}
              `}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 transition-colors ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step title with number
function StepHeader({ step, stepNumber, totalSteps }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 mb-1">
        Étape {stepNumber} sur {totalSteps}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
      {step.description && (
        <p className="text-sm text-gray-500 mt-1">{step.description}</p>
      )}
    </div>
  );
}

export default function WizardModal({
  isOpen,
  onClose,
  onComplete,
  title,
  steps = [],
  initialStep = 0,
  // Data management
  initialData = {},
  onDataChange,
  // Behavior options
  allowSkip = false,
  confirmOnClose = true,
  closeOnComplete = true,
  // Customization
  size = 'lg',
  completeLabel = 'Terminer',
  nextLabel = 'Suivant',
  backLabel = 'Retour',
  skipLabel = 'Passer',
  cancelLabel = 'Annuler',
  className = '',
  testId
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [data, setData] = useState(initialData);
  const [stepValidation, setStepValidation] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const currentStepConfig = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const canGoNext = stepValidation[currentStepConfig?.id] !== false;

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(initialStep);
      setData(initialData);
      setStepValidation({});
      setErrors({});
    }
  }, [isOpen, initialStep, initialData]);

  // Update data for current step
  const updateStepData = useCallback((stepId, stepData) => {
    setData(prev => {
      const newData = {
        ...prev,
        [stepId]: {
          ...prev[stepId],
          ...stepData
        }
      };
      onDataChange?.(newData);
      return newData;
    });
  }, [onDataChange]);

  // Set step validation status
  const setStepValid = useCallback((stepId, isValid) => {
    setStepValidation(prev => ({
      ...prev,
      [stepId]: isValid
    }));
  }, []);

  // Navigate to next step
  const goNext = useCallback(async () => {
    if (isLastStep) {
      // Complete the wizard
      setLoading(true);
      try {
        await onComplete?.(data);
        if (closeOnComplete) {
          onClose();
        }
      } catch (error) {
        console.error('Wizard completion failed:', error);
        setErrors(prev => ({
          ...prev,
          completion: error.message || 'Une erreur est survenue'
        }));
      } finally {
        setLoading(false);
      }
    } else {
      // Validate current step if validation function exists
      const stepConfig = steps[currentStep];
      if (stepConfig.validate) {
        const validationResult = await stepConfig.validate(data[stepConfig.id]);
        if (!validationResult.valid) {
          setErrors(prev => ({
            ...prev,
            [stepConfig.id]: validationResult.errors
          }));
          return;
        }
      }
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, currentStep, data, steps, onComplete, closeOnComplete, onClose]);

  // Navigate to previous step
  const goBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  // Skip current step
  const skipStep = useCallback(() => {
    if (!isLastStep && allowSkip) {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, allowSkip]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Don't handle if in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' && canGoNext && !loading) {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' && !isFirstStep && !loading) {
        e.preventDefault();
        goBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canGoNext, loading, isFirstStep, goNext, goBack]);

  // Render current step component
  const renderStepContent = () => {
    if (!currentStepConfig) return null;

    const StepComponent = currentStepConfig.component;
    if (!StepComponent) return null;

    return (
      <StepComponent
        data={data[currentStepConfig.id] || {}}
        allData={data}
        onChange={(stepData) => updateStepData(currentStepConfig.id, stepData)}
        setValid={(isValid) => setStepValid(currentStepConfig.id, isValid)}
        errors={errors[currentStepConfig.id]}
        stepConfig={currentStepConfig}
      />
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      loading={loading}
      className={className}
      testId={testId}
      footer={
        <div className="flex items-center justify-between">
          {/* Left side - Back button */}
          <div>
            {!isFirstStep && (
              <button
                type="button"
                onClick={goBack}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </button>
            )}
          </div>

          {/* Right side - Skip/Cancel and Next/Complete */}
          <div className="flex items-center gap-3">
            {/* Skip button (optional) */}
            {allowSkip && !isLastStep && (
              <button
                type="button"
                onClick={skipStep}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {skipLabel}
                <SkipForward className="h-4 w-4" />
              </button>
            )}

            {/* Cancel button (only on first step) */}
            {isFirstStep && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelLabel}
              </button>
            )}

            {/* Next/Complete button */}
            <button
              type="button"
              onClick={goNext}
              disabled={loading || !canGoNext}
              className={`
                px-4 py-2 text-sm font-medium text-white rounded-lg
                focus:outline-none focus:ring-2 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2
                ${isLastStep
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }
              `}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLastStep ? (
                <Check className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isLastStep ? completeLabel : nextLabel}
            </button>
          </div>
        </div>
      }
    >
      {/* Step indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Step header */}
      {currentStepConfig && (
        <StepHeader
          step={currentStepConfig}
          stepNumber={currentStep + 1}
          totalSteps={steps.length}
        />
      )}

      {/* Error message */}
      {errors.completion && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errors.completion}
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[200px]">
        {renderStepContent()}
      </div>
    </BaseModal>
  );
}

/**
 * useWizardModal - Hook for managing wizard modal state
 *
 * Usage:
 * const { wizardProps, openWizard, closeWizard, setData } = useWizardModal(steps);
 *
 * return (
 *   <>
 *     <button onClick={openWizard}>Nouveau</button>
 *     <WizardModal {...wizardProps} title="Assistant" onComplete={handleComplete} />
 *   </>
 * );
 */
export function useWizardModal(steps, initialData = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(initialData);

  const openWizard = useCallback((prefilledData = {}) => {
    setData({ ...initialData, ...prefilledData });
    setIsOpen(true);
  }, [initialData]);

  const closeWizard = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    wizardProps: {
      isOpen,
      onClose: closeWizard,
      steps,
      initialData: data,
      onDataChange: setData
    },
    isOpen,
    data,
    openWizard,
    closeWizard,
    setData
  };
}

// Export sub-components for customization
export { StepIndicator, StepHeader };
