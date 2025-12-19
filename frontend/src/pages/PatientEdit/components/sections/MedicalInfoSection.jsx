/**
 * MedicalInfoSection Component
 *
 * Medical information form section (blood type, allergies).
 */

import { Heart, Droplets, Plus, Trash2 } from 'lucide-react';
import { BLOOD_TYPES, ALLERGY_SEVERITY_OPTIONS } from '../../constants';

export default function MedicalInfoSection({
  formData,
  handleChange,
  handleAddAllergy,
  handleUpdateAllergy,
  handleRemoveAllergy
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Heart className="h-5 w-5 text-red-500" />
        Informations medicales
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Droplets className="h-4 w-4 inline mr-1" />
          Groupe sanguin
        </label>
        <select
          value={formData.bloodType}
          onChange={(e) => handleChange('bloodType', e.target.value)}
          className="input w-48"
        >
          <option value="">Selectionner</option>
          {BLOOD_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Allergies */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Allergies</h3>
          <button
            type="button"
            onClick={handleAddAllergy}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>

        {formData.medicalHistory.allergies.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucune allergie enregistree</p>
        ) : (
          <div className="space-y-3">
            {formData.medicalHistory.allergies.map((allergy, index) => (
              <div key={index} className="flex items-start gap-3 bg-red-50 p-3 rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={allergy.allergen}
                    onChange={(e) => handleUpdateAllergy(index, 'allergen', e.target.value)}
                    className="input text-sm"
                    placeholder="Allergene"
                  />
                  <input
                    type="text"
                    value={allergy.reaction}
                    onChange={(e) => handleUpdateAllergy(index, 'reaction', e.target.value)}
                    className="input text-sm"
                    placeholder="Reaction"
                  />
                  <select
                    value={allergy.severity}
                    onChange={(e) => handleUpdateAllergy(index, 'severity', e.target.value)}
                    className="input text-sm"
                  >
                    {ALLERGY_SEVERITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAllergy(index)}
                  className="p-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
