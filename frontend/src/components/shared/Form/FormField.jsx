/**
 * FormField - Consistent form field with label, input, and error display
 *
 * Wraps any input component with:
 * - Label with optional required indicator
 * - Help text
 * - Error message display
 * - Consistent styling
 *
 * Usage:
 * <FormField label="Email" required error={errors.email}>
 *   <input type="email" {...register('email')} />
 * </FormField>
 */

import { AlertCircle, HelpCircle } from 'lucide-react';

export default function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helpText,
  children,
  className = '',
  labelClassName = '',
  inline = false,
  hideLabel = false
}) {
  const fieldId = htmlFor || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`${inline ? 'flex items-center gap-3' : ''} ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={fieldId}
          className={`
            block text-sm font-medium text-gray-700 mb-1
            ${hideLabel ? 'sr-only' : ''}
            ${inline ? 'mb-0 whitespace-nowrap' : ''}
            ${labelClassName}
          `}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className={inline ? 'flex-1' : ''}>
        {children}

        {/* Help text */}
        {helpText && !error && (
          <p className="mt-1 text-xs text-gray-500 flex items-start gap-1">
            <HelpCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            {helpText}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            {typeof error === 'string' ? error : error.message}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * FormFieldGroup - Group multiple fields horizontally
 */
export function FormFieldGroup({ children, columns = 2, className = '' }) {
  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
