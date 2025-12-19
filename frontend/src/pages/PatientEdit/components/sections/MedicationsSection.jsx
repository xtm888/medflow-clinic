/**
 * MedicationsSection Component
 *
 * Medications form section with search and list.
 */

import { Pill, Plus, Trash2, Loader2 } from 'lucide-react';
import { MEDICATION_STATUS_OPTIONS } from '../../constants';

export default function MedicationsSection({
  formData,
  // Medication search
  medicationSearch,
  setMedicationSearch,
  medicationResults,
  searchingMeds,
  // Handlers
  handleAddMedication,
  handleUpdateMedication,
  handleRemoveMedication
}) {
  const onAddMedication = (med) => {
    handleAddMedication(med);
    setMedicationSearch('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Pill className="h-5 w-5 text-green-600" />
        Medicaments actuels
      </h2>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={medicationSearch}
          onChange={(e) => setMedicationSearch(e.target.value)}
          className="input pl-10"
          placeholder="Rechercher un medicament..."
        />
        <Pill className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        {searchingMeds && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
        )}

        {medicationResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {medicationResults.map((med, idx) => (
              <button
                key={med._id || idx}
                type="button"
                onClick={() => onAddMedication(med)}
                className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center gap-2"
              >
                <Plus className="h-4 w-4 text-blue-500" />
                {med.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Medications List */}
      {formData.medications.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Aucun medicament enregistre</p>
      ) : (
        <div className="space-y-3">
          {formData.medications.map((med, index) => (
            <div key={index} className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{med.name}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={med.status}
                    onChange={(e) => handleUpdateMedication(index, 'status', e.target.value)}
                    className="text-xs px-2 py-1 border rounded"
                  >
                    {MEDICATION_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveMedication(index)}
                    className="p-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={med.dosage}
                  onChange={(e) => handleUpdateMedication(index, 'dosage', e.target.value)}
                  className="input text-sm"
                  placeholder="Dosage (ex: 500mg)"
                />
                <input
                  type="text"
                  value={med.frequency}
                  onChange={(e) => handleUpdateMedication(index, 'frequency', e.target.value)}
                  className="input text-sm"
                  placeholder="Frequence (ex: 2x/jour)"
                />
                <input
                  type="text"
                  value={med.reason}
                  onChange={(e) => handleUpdateMedication(index, 'reason', e.target.value)}
                  className="input text-sm"
                  placeholder="Raison"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
