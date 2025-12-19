/**
 * StepIndicator Component
 *
 * Visual step progress indicator for the sale wizard.
 */

import React from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { STEPS } from '../constants';

export default function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  isActive ? 'bg-purple-100 text-purple-700' :
                  isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}
                onClick={() => index <= currentStep && onStepClick(index)}
              >
                <div className={`p-2 rounded-full ${
                  isActive ? 'bg-purple-600 text-white' :
                  isCompleted ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="hidden sm:inline font-medium">{step.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-5 h-5 text-gray-300" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
