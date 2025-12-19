import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, MapPin } from 'lucide-react';
import { useClinic } from '../contexts/ClinicContext';

/**
 * ClinicSelector Component
 * Dropdown to select active clinic context in the header
 */
export default function ClinicSelector() {
  const {
    clinics,
    selectedClinic,
    canViewAllClinics,
    selectClinic,
    loading,
    hasSingleClinic,
    isAllClinicsSelected,
    selectedClinicName
  } = useClinic();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't show selector if user only has one clinic and can't view all
  if (hasSingleClinic) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
        <Building2 className="w-4 h-4" />
        <span className="hidden sm:inline">{selectedClinicName}</span>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400">
        <Building2 className="w-4 h-4 animate-pulse" />
        <span className="hidden sm:inline">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef} data-testid="clinic-selector">
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="clinic-selector-button"
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors
          ${isAllClinicsSelected
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
          }
          hover:bg-gray-200 dark:hover:bg-gray-600
        `}
      >
        <Building2 className="w-4 h-4" />
        <span className="hidden sm:inline max-w-[150px] truncate" data-testid="selected-clinic-name">
          {selectedClinicName}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50" data-testid="clinic-selector-dropdown">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Select Clinic
            </div>

            {/* All Clinics option (for admins/managers) */}
            {canViewAllClinics && (
              <button
                onClick={() => {
                  selectClinic(null);
                  setIsOpen(false);
                }}
                data-testid="clinic-option-all"
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors
                  ${isAllClinicsSelected
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">All Clinics</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    View data from all locations
                  </div>
                </div>
                {isAllClinicsSelected && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            )}

            {/* Divider */}
            {canViewAllClinics && clinics.length > 0 && (
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            )}

            {/* Individual clinics */}
            <div className="max-h-64 overflow-y-auto" data-testid="clinic-options-list">
              {clinics.map((clinic) => {
                const isSelected = selectedClinic?._id === clinic._id ||
                                   selectedClinic?.clinicId === clinic.clinicId;
                return (
                  <button
                    key={clinic._id || clinic.clinicId}
                    onClick={() => {
                      selectClinic(clinic);
                      setIsOpen(false);
                    }}
                    data-testid={`clinic-option-${clinic.clinicId || clinic._id}`}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors
                      ${isSelected
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                      ${isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                      }
                    `}>
                      <Building2 className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">
                        {clinic.shortName || clinic.name}
                      </div>
                      {clinic.address?.city && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {clinic.address.city}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {clinics.length === 0 && !canViewAllClinics && (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No clinics assigned
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
