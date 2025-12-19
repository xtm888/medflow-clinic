/**
 * WizardContainer - Standalone multi-step wizard (non-modal)
 *
 * Use this for full-page wizards like patient registration.
 * For modal-based wizards, use WizardModal from shared/Modal.
 *
 * Features:
 * - Step navigation with visual progress
 * - Per-step validation
 * - Keyboard navigation (arrows)
 * - Auto-save support
 * - Responsive design
 *
 * Usage:
 * const steps = [
 *   { id: 'personal', title: 'Informations', component: PersonalStep },
 *   { id: 'contact', title: 'Contact', component: ContactStep },
 * ];
 *
 * <WizardContainer
 *   steps={steps}
 *   onComplete={handleSubmit}
 *   initialData={{}}
 * />
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Save,
  X
} from 'lucide-react';

// Step progress bar
function StepProgress({ steps, currentStep, onStepClick, allowJump = false }) {
  return (
    <div className="mb-8">
      {/* Desktop view */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = allowJump && (isCompleted || index === currentStep + 1);

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={`
                  relative flex items-center justify-center w-10 h-10 rounded-full
                  text-sm font-medium transition-all
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-500' : ''}
                  ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-blue-200' : 'cursor-default'}
                `}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
              </button>

              {/* Step label */}
              <span className={`
                ml-3 text-sm font-medium hidden lg:block
                ${isCurrent ? 'text-blue-600' : 'text-gray-500'}
              `}>
                {step.title}
              </span>

              {/* Connector */}
              {index < steps.length - 1 && (
                <div className={`
                  flex-1 h-0.5 mx-4
                  ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile view */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">
            Étape {currentStep + 1} sur {steps.length}
          </span>
          <span className="text-sm font-medium text-blue-600">
            {steps[currentStep]?.title}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Step header with title and description
function StepHeader({ step, stepNumber, totalSteps }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>Étape {stepNumber} sur {totalSteps}</span>
        {step.optional && (
          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">Optionnel</span>
        )}
      </div>
      <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
      {step.description && (
        <p className="mt-2 text-gray-600">{step.description}</p>
      )}
    </div>
  );
}

// Navigation buttons
function StepNavigation({
  isFirstStep,
  isLastStep,
  canGoNext,
  loading,
  onBack,
  onNext,
  onCancel,
  onSaveDraft,
  showSaveDraft = false,
  nextLabel = 'Suivant',
  backLabel = 'Retour',
  completeLabel = 'Terminer',
  cancelLabel = 'Annuler'
}) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-8">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {isFirstStep && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            <X className="h-4 w-4 inline mr-1" />
            {cancelLabel}
          </button>
        )}
        {!isFirstStep && (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {showSaveDraft && onSaveDraft && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Sauvegarder brouillon
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={loading || !canGoNext}
          className={`
            px-6 py-2 text-sm font-medium text-white rounded-lg
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-2
            ${isLastStep
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-blue-600 hover:bg-blue-700'
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
  );
}

// Main WizardContainer component
export default function WizardContainer({
  steps = [],
  initialStep = 0,
  initialData = {},
  onComplete,
  onCancel,
  onSaveDraft,
  onDataChange,
  // Behavior options
  allowJump = false,
  showSaveDraft = false,
  validateOnNext = true,
  // Customization
  className = '',
  containerClassName = '',
  // Labels
  nextLabel,
  backLabel,
  completeLabel,
  cancelLabel
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
    // Clear errors when data changes
    setErrors(prev => ({ ...prev, [stepId]: null }));
  }, [onDataChange]);

  // Set step validation status
  const setStepValid = useCallback((stepId, isValid) => {
    setStepValidation(prev => ({
      ...prev,
      [stepId]: isValid
    }));
  }, []);

  // Validate current step
  const validateCurrentStep = useCallback(async () => {
    const stepConfig = steps[currentStep];
    if (!stepConfig?.validate) return { valid: true };

    try {
      const result = await stepConfig.validate(data[stepConfig.id], data);
      if (!result.valid) {
        setErrors(prev => ({ ...prev, [stepConfig.id]: result.errors }));
      }
      return result;
    } catch (error) {
      return { valid: false, errors: { _general: error.message } };
    }
  }, [currentStep, data, steps]);

  // Navigate to next step
  const goNext = useCallback(async () => {
    if (validateOnNext) {
      const validation = await validateCurrentStep();
      if (!validation.valid) return;
    }

    if (isLastStep) {
      setLoading(true);
      try {
        await onComplete?.(data);
      } catch (error) {
        setErrors(prev => ({ ...prev, _completion: error.message }));
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, validateOnNext, validateCurrentStep, data, onComplete]);

  // Navigate to previous step
  const goBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  // Jump to specific step
  const goToStep = useCallback((stepIndex) => {
    if (allowJump && stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex);
    }
  }, [allowJump, steps.length]);

  // Handle save draft
  const handleSaveDraft = useCallback(async () => {
    setLoading(true);
    try {
      await onSaveDraft?.(data, currentStep);
    } finally {
      setLoading(false);
    }
  }, [data, currentStep, onSaveDraft]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

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
  }, [canGoNext, loading, isFirstStep, goNext, goBack]);

  // Render current step component
  const renderStepContent = useMemo(() => {
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
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
      />
    );
  }, [currentStepConfig, data, errors, isFirstStep, isLastStep, updateStepData, setStepValid]);

  return (
    <div className={`max-w-4xl mx-auto ${containerClassName}`}>
      {/* Progress indicator */}
      <StepProgress
        steps={steps}
        currentStep={currentStep}
        onStepClick={goToStep}
        allowJump={allowJump}
      />

      {/* Step content card */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 ${className}`}>
        {/* Step header */}
        {currentStepConfig && (
          <StepHeader
            step={currentStepConfig}
            stepNumber={currentStep + 1}
            totalSteps={steps.length}
          />
        )}

        {/* Completion error */}
        {errors._completion && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errors._completion}
          </div>
        )}

        {/* Step content */}
        <div className="min-h-[300px]">
          {renderStepContent}
        </div>

        {/* Navigation */}
        <StepNavigation
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          canGoNext={canGoNext}
          loading={loading}
          onBack={goBack}
          onNext={goNext}
          onCancel={onCancel}
          onSaveDraft={handleSaveDraft}
          showSaveDraft={showSaveDraft}
          nextLabel={nextLabel}
          backLabel={backLabel}
          completeLabel={completeLabel}
          cancelLabel={cancelLabel}
        />
      </div>
    </div>
  );
}

// Export sub-components for customization
export { StepProgress, StepHeader, StepNavigation };
