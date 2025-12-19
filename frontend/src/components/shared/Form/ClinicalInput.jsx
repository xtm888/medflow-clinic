/**
 * ClinicalInput - Specialized input for ophthalmology OD/OS values
 *
 * Provides:
 * - Side-by-side OD (right eye) / OS (left eye) inputs
 * - Numeric formatting with step precision
 * - Copy OD→OS functionality
 * - Axis adjustment for mirror copy (±90°)
 * - Visual styling for clinical context
 *
 * Usage:
 * <ClinicalInput
 *   label="Sphère"
 *   valueOD={data.sphere.OD}
 *   valueOS={data.sphere.OS}
 *   onChangeOD={(v) => update('sphere.OD', v)}
 *   onChangeOS={(v) => update('sphere.OS', v)}
 *   step={0.25}
 *   min={-30}
 *   max={30}
 * />
 */

import { useState } from 'react';
import { Copy, ArrowRight } from 'lucide-react';

export default function ClinicalInput({
  label,
  valueOD,
  valueOS,
  onChangeOD,
  onChangeOS,
  // Number formatting
  type = 'number',
  step = 0.25,
  min,
  max,
  unit,
  // Copy behavior
  allowCopy = true,
  copyWithAxisAdjust = false, // For cylinder axis mirroring
  axisValue, // Current axis value for adjustment calculation
  onAxisChange, // Callback when axis needs adjustment
  // Styling
  className = '',
  inputClassName = '',
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  readOnly = false,
  placeholder
}) {
  const [copying, setCopying] = useState(false);

  // Size classes
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg'
  };

  // Format value for display
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (type === 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) return '';
      // Add + sign for positive numbers (common in ophthalmology)
      return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
    }
    return value;
  };

  // Parse input value
  const parseValue = (inputValue) => {
    if (!inputValue || inputValue === '' || inputValue === '+') return null;
    const cleaned = inputValue.replace(/^\+/, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  // Copy OD value to OS with optional axis adjustment
  const handleCopyODtoOS = () => {
    if (!allowCopy || disabled || readOnly) return;

    setCopying(true);

    // Copy main value
    onChangeOS?.(valueOD);

    // Handle axis adjustment for cylinder mirroring
    if (copyWithAxisAdjust && axisValue !== undefined && onAxisChange) {
      // Mirror axis: if ≤90°, add 90; if >90°, subtract 90
      const currentAxis = parseFloat(axisValue) || 0;
      const newAxis = currentAxis <= 90 ? currentAxis + 90 : currentAxis - 90;
      onAxisChange(newAxis);
    }

    setTimeout(() => setCopying(false), 300);
  };

  const inputBaseClass = `
    w-full border border-gray-300 rounded-lg px-3
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${sizeClasses[size]}
    ${inputClassName}
  `;

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {unit && <span className="text-gray-400 ml-1">({unit})</span>}
        </label>
      )}

      {/* OD/OS inputs */}
      <div className="flex items-center gap-2">
        {/* OD (Right Eye) */}
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-blue-600 w-6">OD</span>
            <input
              type={type}
              value={valueOD ?? ''}
              onChange={(e) => onChangeOD?.(parseValue(e.target.value))}
              step={step}
              min={min}
              max={max}
              disabled={disabled}
              readOnly={readOnly}
              placeholder={placeholder}
              className={inputBaseClass}
            />
          </div>
        </div>

        {/* Copy button */}
        {allowCopy && (
          <button
            type="button"
            onClick={handleCopyODtoOS}
            disabled={disabled || readOnly || valueOD === null || valueOD === undefined}
            className={`
              p-2 rounded-lg border transition-all
              ${copying
                ? 'bg-green-100 border-green-300 text-green-600'
                : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title="Copier OD → OS"
          >
            {copying ? (
              <ArrowRight className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        )}

        {/* OS (Left Eye) */}
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-green-600 w-6">OS</span>
            <input
              type={type}
              value={valueOS ?? ''}
              onChange={(e) => onChangeOS?.(parseValue(e.target.value))}
              step={step}
              min={min}
              max={max}
              disabled={disabled}
              readOnly={readOnly}
              placeholder={placeholder}
              className={inputBaseClass}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ClinicalInputGroup - Group of related clinical inputs (e.g., Sphere, Cylinder, Axis)
 */
export function ClinicalInputGroup({ title, children, className = '' }) {
  return (
    <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
      {title && (
        <h4 className="text-sm font-medium text-gray-600 mb-3">{title}</h4>
      )}
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

/**
 * VisualAcuityInput - Specialized input for VA measurements
 */
export function VisualAcuityInput({
  label,
  valueOD,
  valueOS,
  onChangeOD,
  onChangeOS,
  format = 'decimal', // 'decimal' (0.1-1.2) | 'snellen' (20/20)
  withCorrection = false,
  correctionOD,
  correctionOS,
  onCorrectionChangeOD,
  onCorrectionChangeOS,
  className = ''
}) {
  // Common VA values
  const vaOptions = format === 'decimal'
    ? ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0', '1.2']
    : ['20/200', '20/100', '20/80', '20/60', '20/40', '20/30', '20/25', '20/20', '20/15'];

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      <div className="grid grid-cols-2 gap-4">
        {/* OD */}
        <div>
          <div className="text-xs font-bold text-blue-600 mb-1">OD (Droit)</div>
          <select
            value={valueOD || ''}
            onChange={(e) => onChangeOD?.(e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3"
          >
            <option value="">-</option>
            {vaOptions.map(va => (
              <option key={va} value={va}>{va}</option>
            ))}
          </select>
          {withCorrection && (
            <div className="mt-1">
              <input
                type="text"
                value={correctionOD || ''}
                onChange={(e) => onCorrectionChangeOD?.(e.target.value)}
                placeholder="Correction"
                className="w-full h-8 text-sm border border-gray-300 rounded px-2"
              />
            </div>
          )}
        </div>

        {/* OS */}
        <div>
          <div className="text-xs font-bold text-green-600 mb-1">OS (Gauche)</div>
          <select
            value={valueOS || ''}
            onChange={(e) => onChangeOS?.(e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3"
          >
            <option value="">-</option>
            {vaOptions.map(va => (
              <option key={va} value={va}>{va}</option>
            ))}
          </select>
          {withCorrection && (
            <div className="mt-1">
              <input
                type="text"
                value={correctionOS || ''}
                onChange={(e) => onCorrectionChangeOS?.(e.target.value)}
                placeholder="Correction"
                className="w-full h-8 text-sm border border-gray-300 rounded px-2"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
