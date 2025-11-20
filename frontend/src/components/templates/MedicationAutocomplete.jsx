import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/apiConfig';

const MedicationAutocomplete = ({ onSelect, value, placeholder = "Rechercher un médicament..." }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchMedications = async () => {
      if (searchTerm.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get(`/template-catalog/medications/search?q=${searchTerm}&limit=20`);
        setResults(response.data.data || []);
        setIsOpen(true);
      } catch (error) {
        console.error('Error searching medications:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchMedications, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleSelect = (medication) => {
    setSearchTerm(medication.name);
    setIsOpen(false);
    onSelect(medication);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      {loading && (
        <div className="absolute right-3 top-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((medication) => (
            <div
              key={medication._id}
              onClick={() => handleSelect(medication)}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{medication.name}</div>
              <div className="text-sm text-gray-600">
                {medication.category && <span className="text-blue-600">{medication.category}</span>}
                {medication.form && <span className="ml-2">• {medication.form}</span>}
                {medication.dosage && <span className="ml-2">• {medication.dosage}</span>}
                {medication.packaging && <span className="ml-2">• {medication.packaging}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && searchTerm.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-center text-gray-500">
          Aucun médicament trouvé
        </div>
      )}
    </div>
  );
};

export default MedicationAutocomplete;
