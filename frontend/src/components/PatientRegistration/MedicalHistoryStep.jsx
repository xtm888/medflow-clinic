import React, { memo } from 'react';
import { Building2, UserPlus, Plus, Trash2, Search, Loader2 } from 'lucide-react';

/**
 * MedicalHistoryStep Component
 * Collects patient's medical history, medications, referrer info, and priority
 */
const MedicalHistoryStep = memo(({
  formData,
  errors,
  duplicateCheckStatus,
  medicationSearch,
  medicationResults,
  searchingMedications,
  showMedicationDropdown,
  referrers,
  loadingReferrers,
  onChange,
  onMedicationSearchChange,
  onAddMedication,
  onRemoveMedication,
  onUpdateMedication
}) => {
  return (
    <div className="space-y-6">
      {/* Show convention summary if selected */}
      {formData.convention.hasConvention && formData.convention.companyName && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Convention active</p>
              <p className="text-green-700">{formData.convention.companyName}</p>
              {formData.convention.employeeId && (
                <p className="text-sm text-green-600">Matricule: {formData.convention.employeeId}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blood Type & Insurance (only show insurance if no convention) */}
      <div className={`grid ${formData.convention.hasConvention ? 'grid-cols-1' : 'grid-cols-2'} gap-6`}>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Groupe sanguin
          </label>
          <select
            value={formData.bloodType}
            onChange={(e) => onChange('bloodType', e.target.value)}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Sélectionner</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>

        {/* Only show separate insurance field if no convention selected */}
        {!formData.convention.hasConvention && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Assurance (optionnel)
            </label>
            <input
              type="text"
              value={formData.insurance}
              onChange={(e) => onChange('insurance', e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
              placeholder="Nom de l'assurance"
            />
          </div>
        )}
      </div>

      {/* Allergies */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Allergies connues
        </label>
        <textarea
          value={formData.allergies}
          onChange={(e) => onChange('allergies', e.target.value)}
          className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
          rows="3"
          placeholder="Pénicilline, arachides, latex... (séparez par des virgules)"
        />
        <p className="text-sm text-gray-500 mt-1">
          Séparez les allergies par des virgules
        </p>
      </div>

      {/* Current Medications */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Médicaments actuels
        </label>

        {/* Medication Search */}
        <div className="relative mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={medicationSearch}
              onChange={(e) => onMedicationSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
              placeholder="Rechercher un médicament..."
            />
            {searchingMedications && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showMedicationDropdown && medicationResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {medicationResults.map((med, index) => (
                <button
                  key={med._id || index}
                  type="button"
                  onClick={() => onAddMedication(med)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-2 border-b last:border-b-0"
                >
                  <Plus className="h-4 w-4 text-blue-500" />
                  <div>
                    <span className="font-medium">{med.name}</span>
                    {med.form && (
                      <span className="text-sm text-gray-500 ml-2">({med.form})</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results Message */}
          {showMedicationDropdown && medicationResults.length === 0 && medicationSearch.length >= 2 && !searchingMedications && (
            <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4 text-center">
              <p className="text-gray-500">Aucun médicament trouvé</p>
              <button
                type="button"
                onClick={() => onAddMedication({ name: medicationSearch })}
                className="text-blue-600 hover:text-blue-700 mt-2 text-sm"
              >
                + Ajouter "{medicationSearch}" manuellement
              </button>
            </div>
          )}
        </div>

        {/* Medications List */}
        {formData.medications.length > 0 && (
          <div className="space-y-3">
            {formData.medications.map((med, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">{med.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveMedication(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={med.dosage}
                    onChange={(e) => onUpdateMedication(index, 'dosage', e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Dosage (ex: 500mg)"
                  />
                  <input
                    type="text"
                    value={med.frequency}
                    onChange={(e) => onUpdateMedication(index, 'frequency', e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Fréquence (ex: 2x/jour)"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {formData.medications.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Aucun médicament ajouté. Recherchez et ajoutez les médicaments que prend actuellement le patient.
          </p>
        )}
      </div>

      {/* Referrer / Bon Externe */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
        <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Référent / Bon externe
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Médecin référent
            </label>
            <select
              value={formData.referrer}
              onChange={(e) => onChange('referrer', e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
              disabled={loadingReferrers}
            >
              <option value="">-- Aucun (patient direct) --</option>
              {referrers.length > 0 && (
                <>
                  <optgroup label="Médecins externes">
                    {referrers.filter(r => r.type === 'external').map(r => (
                      <option key={r._id} value={r._id}>
                        Dr. {r.name} {r.clinic ? `(${r.clinic})` : ''} {r.specialty ? `- ${r.specialty}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Médecins internes">
                    {referrers.filter(r => r.type === 'internal').map(r => (
                      <option key={r._id} value={r._id}>
                        Dr. {r.name} {r.specialty ? `- ${r.specialty}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
            {loadingReferrers && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des référents...
              </p>
            )}
          </div>

          {formData.referrer && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Numéro du bon (optionnel)
              </label>
              <input
                type="text"
                value={formData.externalReferenceNumber}
                onChange={(e) => onChange('externalReferenceNumber', e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Ex: BON-2025-001"
              />
              <p className="text-sm text-gray-500 mt-1">
                Numéro du bon de consultation externe
              </p>
            </div>
          )}
        </div>
      </div>

      {/* VIP Status and Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* VIP Status */}
        <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-5">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.vip}
              onChange={(e) => onChange('vip', e.target.checked)}
              className="w-6 h-6 rounded border-purple-400 text-purple-600 focus:ring-purple-500 mt-0.5"
            />
            <div className="flex-1">
              <span className="text-lg font-bold text-purple-900 block mb-1">
                VIP
              </span>
              <p className="text-sm text-purple-700">
                Priorite dans la file d'attente
              </p>
            </div>
          </label>
        </div>

        {/* Vulnerable Persons (Priority) */}
        <div className="bg-pink-50 border-2 border-pink-300 rounded-lg p-5">
          <span className="text-lg font-bold text-pink-900 block mb-3">
            Personne vulnerable
          </span>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="normal"
                checked={formData.priority === 'normal'}
                onChange={(e) => onChange('priority', e.target.value)}
                className="w-5 h-5 text-pink-600 focus:ring-pink-500"
              />
              <span className="text-pink-800">Normal</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="pregnant"
                checked={formData.priority === 'pregnant'}
                onChange={(e) => onChange('priority', e.target.value)}
                className="w-5 h-5 text-pink-600 focus:ring-pink-500"
              />
              <span className="text-pink-800">Femme enceinte</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="elderly"
                checked={formData.priority === 'elderly'}
                onChange={(e) => onChange('priority', e.target.value)}
                className="w-5 h-5 text-pink-600 focus:ring-pink-500"
              />
              <span className="text-pink-800">Personne agee</span>
            </label>
          </div>
        </div>
      </div>

      {/* Duplicate Check Status on Final Step */}
      {formData.capturedPhoto && duplicateCheckStatus === 'checking' && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-center justify-center gap-3 text-blue-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Vérification des doublons en cours...</span>
          </div>
          <p className="text-blue-600 text-center text-sm mt-1">
            Vous pouvez continuer à remplir le formulaire
          </p>
        </div>
      )}

      {/* Submission Error */}
      {errors.submission && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
          <div className="flex items-center justify-center gap-2 text-amber-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">{errors.submission}</span>
          </div>
        </div>
      )}

      {/* Success Message */}
      {duplicateCheckStatus !== 'checking' && !errors.submission && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
          <p className="text-green-800 text-center font-medium">
            ✓ Toutes les informations requises ont été remplies
          </p>
          <p className="text-green-700 text-center text-sm mt-1">
            Cliquez sur "Terminer" pour créer le dossier patient
          </p>
        </div>
      )}
    </div>
  );
});

MedicalHistoryStep.displayName = 'MedicalHistoryStep';

export default MedicalHistoryStep;
