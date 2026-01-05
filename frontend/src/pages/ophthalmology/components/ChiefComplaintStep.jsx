/**
 * ChiefComplaintStep - Patient's primary complaint for ophthalmology visits
 *
 * Captures:
 * - Main symptom/complaint
 * - Duration, severity, onset
 * - Associated symptoms
 * - Laterality (OD/OS/OU)
 */

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import api from '../../../services/apiConfig';

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Légère', color: 'bg-green-100 text-green-800' },
  { value: 'moderate', label: 'Modérée', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'severe', label: 'Sévère', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critique', color: 'bg-red-100 text-red-800' }
];

const ONSET_OPTIONS = [
  { value: 'sudden', label: 'Brutal' },
  { value: 'gradual', label: 'Progressif' },
  { value: 'intermittent', label: 'Intermittent' }
];

const LATERALITY_OPTIONS = [
  { value: 'OD', label: 'Œil Droit (OD)' },
  { value: 'OS', label: 'Œil Gauche (OS)' },
  { value: 'OU', label: 'Les Deux Yeux (OU)' }
];

const ASSOCIATED_SYMPTOMS = [
  'Douleur oculaire',
  'Rougeur',
  'Larmoiement',
  'Photophobie',
  'Diplopie',
  'Corps flottants',
  'Halos',
  'Céphalées',
  'Nausées',
  'Prurit'
];

export default function ChiefComplaintStep({ data = {}, onChange, readOnly = false }) {
  const [motifs, setMotifs] = useState([]);
  const [durationOptions, setDurationOptions] = useState([]);
  const [loadingMotifs, setLoadingMotifs] = useState(false);

  // Local state for complaint data
  const complaint = {
    complaint: data?.complaint || '',
    duration: data?.duration || '',
    severity: data?.severity || 'moderate',
    onset: data?.onset || '',
    associatedSymptoms: data?.associatedSymptoms || [],
    motif: data?.motif || '',
    laterality: data?.laterality || '',
    notes: data?.notes || ''
  };

  // Fetch consultation motifs and duration options
  useEffect(() => {
    const fetchMotifs = async () => {
      setLoadingMotifs(true);
      try {
        const response = await api.get('/template-catalog/pathologies', {
          params: { category: 'MOTIF DE CONSULTATION' }
        });
        // Safely extract array from various API response formats
        const rawData = response?.data?.data ?? response?.data ?? [];
        const data = Array.isArray(rawData) ? rawData : [];

        // Separate motifs (names) from duration options (descriptions)
        const motifNames = data.filter(item => item.fieldType !== 'description');
        const durations = data
          .filter(item => item.fieldType === 'description' && item.name?.toLowerCase().includes('depuis'))
          .map(item => item.name);

        setMotifs(motifNames);
        setDurationOptions(durations);
      } catch (error) {
        console.error('Failed to fetch motifs:', error);
      } finally {
        setLoadingMotifs(false);
      }
    };
    fetchMotifs();
  }, []);

  // Update parent with changes
  const updateField = (field, value) => {
    if (readOnly) return;
    onChange?.({
      ...complaint,
      [field]: value
    });
  };

  // Toggle associated symptom
  const toggleSymptom = (symptom) => {
    if (readOnly) return;
    const symptoms = complaint.associatedSymptoms.includes(symptom)
      ? complaint.associatedSymptoms.filter(s => s !== symptom)
      : [...complaint.associatedSymptoms, symptom];
    updateField('associatedSymptoms', symptoms);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Plainte Principale</h3>
        {complaint.severity === 'critical' && (
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Urgence</span>
          </div>
        )}
      </div>

      {/* Motif Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Motif de Consultation
        </label>
        <select
          value={complaint.motif}
          onChange={(e) => updateField('motif', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={readOnly || loadingMotifs}
        >
          <option value="">Sélectionner un motif...</option>
          {motifs.map((motif) => (
            <option key={motif._id || motif.name} value={motif.name}>
              {motif.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Complaint */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description de la Plainte <span className="text-red-500">*</span>
        </label>
        <textarea
          value={complaint.complaint}
          onChange={(e) => updateField('complaint', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Décrivez la plainte principale du patient..."
          disabled={readOnly}
        />
      </div>

      {/* Duration and Laterality */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Durée
          </label>
          {/* Duration Quick-Pick Buttons */}
          {durationOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {durationOptions.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => updateField('duration', duration)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition ${
                    complaint.duration === duration
                      ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  disabled={readOnly}
                >
                  {duration}
                </button>
              ))}
            </div>
          )}
          {/* Custom Duration Input */}
          <input
            type="text"
            value={complaint.duration}
            onChange={(e) => updateField('duration', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Ou saisir une durée personnalisée..."
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Latéralité
          </label>
          <select
            value={complaint.laterality}
            onChange={(e) => updateField('laterality', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={readOnly}
          >
            <option value="">Sélectionner...</option>
            {LATERALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sévérité
        </label>
        <div className="grid grid-cols-4 gap-2">
          {SEVERITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField('severity', option.value)}
              className={`px-3 py-2 text-sm rounded-lg border transition ${
                complaint.severity === option.value
                  ? option.color + ' border-current font-medium'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              disabled={readOnly}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Onset */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mode d'Apparition
        </label>
        <div className="grid grid-cols-3 gap-2">
          {ONSET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField('onset', option.value)}
              className={`px-3 py-2 text-sm rounded-lg border transition ${
                complaint.onset === option.value
                  ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              disabled={readOnly}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Associated Symptoms */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Symptômes Associés
        </label>
        <div className="flex flex-wrap gap-2">
          {ASSOCIATED_SYMPTOMS.map((symptom) => (
            <button
              key={symptom}
              type="button"
              onClick={() => toggleSymptom(symptom)}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                complaint.associatedSymptoms.includes(symptom)
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              disabled={readOnly}
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes Complémentaires
        </label>
        <textarea
          value={complaint.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder="Informations supplémentaires..."
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
