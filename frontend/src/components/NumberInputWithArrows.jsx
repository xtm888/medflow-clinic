import { ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Number input with increment/decrement arrows
 * @param {number} value - Current value
 * @param {function} onChange - Change handler
 * @param {number} step - Increment step (default: 0.25)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} label - Field label
 * @param {string} unit - Unit to display (e.g., "mm", "°", "D")
 * @param {number} precision - Decimal places (default: 2)
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disable input
 */
export default function NumberInputWithArrows({
  value,
  onChange,
  step = 0.25,
  min = -20,
  max = 20,
  label,
  unit,
  precision = 2,
  className = '',
  disabled = false
}) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value !== null && value !== undefined && value !== '') {
      setDisplayValue(parseFloat(value).toFixed(precision));
    } else {
      setDisplayValue('');
    }
  }, [value, precision]);

  const handleIncrement = () => {
    if (disabled) return;
    const currentVal = parseFloat(value) || 0;
    const newVal = Math.min(max, currentVal + step);
    onChange(parseFloat(newVal.toFixed(precision)));
  };

  const handleDecrement = () => {
    if (disabled) return;
    const currentVal = parseFloat(value) || 0;
    const newVal = Math.max(min, currentVal - step);
    onChange(parseFloat(newVal.toFixed(precision)));
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setDisplayValue(val);

    // Only trigger onChange if it's a valid number
    const numVal = parseFloat(val);
    if (!isNaN(numVal)) {
      onChange(Math.min(max, Math.max(min, numVal)));
    } else if (val === '' || val === '-') {
      onChange(0);
    }
  };

  const handleBlur = () => {
    const numVal = parseFloat(displayValue);
    if (!isNaN(numVal)) {
      const bounded = Math.min(max, Math.max(min, numVal));
      setDisplayValue(bounded.toFixed(precision));
      onChange(bounded);
    } else {
      setDisplayValue('0.00');
      onChange(0);
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className="flex-1 px-3 py-2 text-center text-sm font-mono focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="0.00"
        />
        {unit && (
          <span className="px-2 text-sm text-gray-500 font-medium">{unit}</span>
        )}
        <div className="flex flex-col border-l border-gray-300">
          <button
            type="button"
            onClick={handleIncrement}
            disabled={disabled}
            className="px-2 py-1 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={`Increment by ${step}`}
          >
            <ChevronUp className="w-3 h-3 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            disabled={disabled}
            className="px-2 py-1 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-t border-gray-300"
            title={`Decrement by ${step}`}
          >
            <ChevronDown className="w-3 h-3 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
