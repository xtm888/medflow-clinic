import React from 'react';
import { Check } from 'lucide-react';

/**
 * Reusable Wizard Component
 *
 * Provides step-by-step navigation with progress tracking
 * Features:
 * - Visual progress bar
 * - Step completion indicators
 * - Navigation controls
 * - Validation support
 */
const Wizard = ({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  children,
  className = '',
  hideNavigation = false  // Hide navigation buttons (e.g., during duplicate check)
}) => {
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      onStepChange(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <div className={`wizard-container ${className}`}>
      {/* Progress Header */}
      <div className="wizard-header px-6 pt-6 pb-4">
        {/* Step Title */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {steps[currentStep]?.title}
          </h2>
          {steps[currentStep]?.description && (
            <p className="text-sm text-gray-600">
              {steps[currentStep].description}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2 font-medium">
            Étape {currentStep + 1} sur {totalSteps}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out shadow-md"
            style={{ width: `${progress}%` }}
          >
            <div className="h-full w-full bg-white opacity-20 animate-pulse"></div>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between mt-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isUpcoming = index > currentStep;

            return (
              <div key={index} className="flex flex-col items-center flex-1 relative">
                {/* Connection Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`absolute top-4 left-1/2 w-full h-0.5 -z-10 transition-colors duration-300 ${
                      isCompleted ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                )}

                {/* Step Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-md ${
                    isCompleted
                      ? 'bg-blue-500 text-white scale-110'
                      : isCurrent
                      ? 'bg-blue-600 text-white scale-125 ring-4 ring-blue-200'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
                </div>

                {/* Step Label */}
                <span
                  className={`text-xs mt-2 text-center font-medium transition-colors duration-300 ${
                    isCurrent
                      ? 'text-blue-600 font-bold'
                      : isCompleted
                      ? 'text-blue-500'
                      : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="wizard-content p-6">{children}</div>

      {/* Navigation Buttons - Hidden during duplicate check */}
      {!hideNavigation && (
        <div className="wizard-footer px-6 pb-6 flex gap-3">
          {!isFirstStep && (
            <button
              type="button"
              onClick={handlePrevious}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold text-lg hover:bg-gray-300 transition shadow-md hover:shadow-lg"
            >
              ← Retour
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            className={`${
              isFirstStep ? 'w-full' : 'flex-1'
            } px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg`}
          >
            {isLastStep ? '✓ Terminer' : 'Suivant →'}
          </button>
        </div>
      )}
    </div>
  );
};

// Individual step component (optional, for convenience)
export const WizardStep = ({ children, className = '' }) => {
  return <div className={`wizard-step ${className}`}>{children}</div>;
};

export default Wizard;
