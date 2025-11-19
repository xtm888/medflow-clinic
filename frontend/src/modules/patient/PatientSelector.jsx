import { useState, useEffect, useRef } from 'react';
import { Search, User, X, Plus, Phone, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import patientService from '../../services/patientService';

/**
 * Unified PatientSelector - Replaces PatientQuickSearch, PatientSelectorModal, and inline searches
 *
 * Modes:
 * - "dropdown" - Inline dropdown search (default)
 * - "modal" - Full modal with patient list
 * - "inline" - Embedded search with results below
 */
export default function PatientSelector({
  mode = 'dropdown',
  value = null,
  onChange,
  onCreateNew,
  placeholder = 'Rechercher un patient...',
  showCreateButton = true,
  autoFocus = false,
  disabled = false,
  className = ''
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(value);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search patients when search term changes
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchPatients(searchTerm);
    } else {
      setPatients([]);
    }
  }, [searchTerm]);

  // Update selected patient when value prop changes
  useEffect(() => {
    setSelectedPatient(value);
  }, [value]);

  const searchPatients = async (term) => {
    try {
      setLoading(true);
      const response = await patientService.searchPatients(term);
      const data = response.data?.data || response.data || response || [];
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error searching patients:', error);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (patient) => {
    setSelectedPatient(patient);
    setSearchTerm('');
    setIsOpen(false);
    setShowModal(false);
    if (onChange) {
      onChange(patient);
    }
  };

  const handleClear = () => {
    setSelectedPatient(null);
    setSearchTerm('');
    if (onChange) {
      onChange(null);
    }
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    setShowModal(false);
    if (onCreateNew) {
      onCreateNew();
    }
  };

  const formatAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} ans`;
  };

  const PatientItem = ({ patient, onClick, showArrow = false }) => (
    <button
      onClick={() => onClick(patient)}
      className="w-full flex items-center px-3 py-2 hover:bg-blue-50 text-left transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
        <span className="text-blue-600 font-medium text-sm">
          {patient.firstName?.[0]}{patient.lastName?.[0]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">
          {patient.firstName} {patient.lastName}
        </div>
        <div className="flex items-center text-xs text-gray-500 space-x-3">
          {patient.dateOfBirth && (
            <span className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              {formatAge(patient.dateOfBirth)}
            </span>
          )}
          {patient.phone && (
            <span className="flex items-center">
              <Phone className="w-3 h-3 mr-1" />
              {patient.phone}
            </span>
          )}
        </div>
      </div>
      {showArrow && <ChevronRight className="w-4 h-4 text-gray-400" />}
    </button>
  );

  // Dropdown Mode (default)
  if (mode === 'dropdown') {
    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        {selectedPatient ? (
          // Selected patient display
          <div className="flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <span className="text-blue-600 font-medium text-xs">
                  {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                </span>
              </div>
              <div>
                <div className="font-medium text-sm">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
                <div className="text-xs text-gray-500">
                  {formatAge(selectedPatient.dateOfBirth)}
                </div>
              </div>
            </div>
            {!disabled && (
              <button
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        ) : (
          // Search input
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              autoFocus={autoFocus}
              disabled={disabled}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
        )}

        {/* Dropdown Results */}
        {isOpen && !selectedPatient && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {patients.length > 0 ? (
              <>
                {patients.map((patient) => (
                  <PatientItem
                    key={patient._id}
                    patient={patient}
                    onClick={handleSelect}
                  />
                ))}
              </>
            ) : searchTerm.length >= 2 && !loading ? (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                Aucun patient trouvé
              </div>
            ) : searchTerm.length < 2 ? (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                Tapez au moins 2 caractères
              </div>
            ) : null}

            {showCreateButton && (
              <button
                onClick={handleCreateNew}
                className="w-full flex items-center px-3 py-2 border-t border-gray-100 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau patient
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Modal Mode
  if (mode === 'modal') {
    return (
      <>
        {/* Trigger Button */}
        <button
          onClick={() => setShowModal(true)}
          disabled={disabled}
          className={`flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 ${className}`}
        >
          {selectedPatient ? (
            <>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <span className="text-blue-600 font-medium text-xs">
                  {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                </span>
              </div>
              <span className="font-medium">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </span>
            </>
          ) : (
            <>
              <User className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-gray-500">Sélectionner un patient</span>
            </>
          )}
        </button>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold text-lg">Sélectionner un patient</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  </div>
                ) : patients.length > 0 ? (
                  patients.map((patient) => (
                    <PatientItem
                      key={patient._id}
                      patient={patient}
                      onClick={handleSelect}
                      showArrow
                    />
                  ))
                ) : searchTerm.length >= 2 ? (
                  <div className="py-8 text-center text-gray-500">
                    Aucun patient trouvé
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    Tapez pour rechercher
                  </div>
                )}
              </div>

              {/* Footer */}
              {showCreateButton && (
                <div className="px-4 py-3 border-t">
                  <button
                    onClick={handleCreateNew}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau patient
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline Mode
  if (mode === 'inline') {
    return (
      <div className={className}>
        {/* Search Input */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            disabled={disabled}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Results */}
        {(patients.length > 0 || (searchTerm.length >= 2 && !loading)) && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {patients.length > 0 ? (
              patients.map((patient) => (
                <PatientItem
                  key={patient._id}
                  patient={patient}
                  onClick={handleSelect}
                />
              ))
            ) : (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                Aucun patient trouvé
              </div>
            )}

            {showCreateButton && (
              <button
                onClick={handleCreateNew}
                className="w-full flex items-center px-3 py-2 border-t border-gray-100 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau patient
              </button>
            )}
          </div>
        )}

        {/* Selected Patient Display */}
        {selectedPatient && (
          <div className="mt-2 flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <span className="text-blue-600 font-medium text-xs">
                  {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                </span>
              </div>
              <div>
                <div className="font-medium text-sm text-blue-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
                <div className="text-xs text-blue-700">
                  {formatAge(selectedPatient.dateOfBirth)}
                </div>
              </div>
            </div>
            {!disabled && (
              <button
                onClick={handleClear}
                className="p-1 hover:bg-blue-100 rounded"
              >
                <X className="w-4 h-4 text-blue-600" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Export helper for getting patient display name
export const getPatientDisplayName = (patient) => {
  if (!patient) return '';
  return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
};

// Export helper for getting patient initials
export const getPatientInitials = (patient) => {
  if (!patient) return '';
  return `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase();
};
