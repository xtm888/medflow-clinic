import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Compact Date of Birth Input Component
 * Features:
 * - Auto-formats as you type (adds slashes automatically)
 * - Integrated date picker button
 * - Single row, clean UI
 */
const DateOfBirthInput = ({ value, onChange, error, className = '' }) => {
  const [displayValue, setDisplayValue] = useState('');
  const dateInputRef = useRef(null);

  // Convert date value to display format
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      setDisplayValue(`${day}/${month}/${year}`);
    }
  }, [value]);

  // Handle text input with auto-formatting
  const handleTextChange = (e) => {
    let input = e.target.value.replace(/\D/g, ''); // Remove non-digits
    let formatted = '';

    // Auto-format as DD/MM/YYYY
    if (input.length > 0) {
      formatted = input.substring(0, 2); // DD
      if (input.length >= 3) {
        formatted += '/' + input.substring(2, 4); // MM
      }
      if (input.length >= 5) {
        formatted += '/' + input.substring(4, 8); // YYYY
      }
    }

    setDisplayValue(formatted);

    // Parse and validate complete date
    if (input.length === 8) {
      const day = input.substring(0, 2);
      const month = input.substring(2, 4);
      const year = input.substring(4, 8);

      const date = new Date(year, month - 1, day);

      // Validate date
      if (date.getDate() == day && date.getMonth() == month - 1 && date.getFullYear() == year) {
        const formattedDate = `${year}-${month}-${day}`;
        onChange(formattedDate);
      }
    }
  };

  // Handle date picker change
  const handleDatePickerChange = (e) => {
    onChange(e.target.value);
  };

  // Open date picker when calendar icon is clicked
  const openDatePicker = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Date de naissance
      </label>

      {/* Single row with text input and date picker */}
      <div className="relative">
        {/* Text Input with auto-formatting */}
        <input
          type="text"
          value={displayValue}
          onChange={handleTextChange}
          placeholder="JJ/MM/AAAA"
          maxLength="10"
          className={`w-full px-4 py-3 pr-12 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
            error ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
          }`}
        />

        {/* Calendar Button */}
        <button
          type="button"
          onClick={openDatePicker}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
        >
          <Calendar className="h-5 w-5" />
        </button>

        {/* Hidden HTML5 Date Picker */}
        <input
          ref={dateInputRef}
          type="date"
          value={value || ''}
          onChange={handleDatePickerChange}
          max={new Date().toISOString().split('T')[0]}
          className="absolute opacity-0 pointer-events-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
};

export default DateOfBirthInput;
