/**
 * NavigationButtons Component
 *
 * Previous/Next/Submit navigation for the sale wizard.
 */

import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { STEPS } from '../constants';

export default function NavigationButtons({
  currentStep,
  onPrevious,
  onNext,
  onSubmit,
  saving
}) {
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="flex items-center justify-between bg-white rounded-xl border shadow-sm p-4">
      <button
        onClick={onPrevious}
        disabled={isFirstStep}
        className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
      >
        <ChevronLeft className="w-5 h-5" />
        Precedent
      </button>

      <div className="flex items-center gap-3">
        {!isLastStep ? (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            Suivant
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            {saving ? 'Envoi...' : 'Soumettre pour Verification'}
          </button>
        )}
      </div>
    </div>
  );
}
