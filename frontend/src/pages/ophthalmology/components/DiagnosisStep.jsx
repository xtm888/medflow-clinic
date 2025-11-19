/**
 * DiagnosisStep - ICD-10 diagnosis entry and management
 *
 * Allows:
 * - Search for ICD-10 codes
 * - Add multiple diagnoses
 * - Mark primary diagnosis
 * - Add notes per diagnosis
 */

import { useState } from 'react';
import { Search, Plus, X, Star, AlertCircle } from 'lucide-react';
import api from '../../../services/apiConfig';

// Common ophthalmology ICD-10 codes for quick selection
const COMMON_DIAGNOSES = [
  { code: 'H52.1', description: 'Myopie' },
  { code: 'H52.0', description: 'Hypermétropie' },
  { code: 'H52.2', description: 'Astigmatisme' },
  { code: 'H52.4', description: 'Presbytie' },
  { code: 'H40.1', description: 'Glaucome primitif à angle ouvert' },
  { code: 'H25.9', description: 'Cataracte sénile, sans précision' },
  { code: 'H10.1', description: 'Conjonctivite aiguë atopique' },
  { code: 'H04.1', description: 'Sécheresse oculaire' },
  { code: 'H35.3', description: 'Dégénérescence maculaire' },
  { code: 'H33.0', description: 'Décollement de rétine' }
];

export default function DiagnosisStep({ data = [], onChange, readOnly = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showCommon, setShowCommon] = useState(true);

  const diagnoses = Array.isArray(data) ? data : [];

  // Search ICD-10 codes
  const searchDiagnoses = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Search in template catalog for ICD-10 codes
      const response = await api.get('/template-catalog/pathologies', {
        params: {
          search: query,
          category: 'DIAGNOSTIC'
        }
      });
      setSearchResults(response.data?.data || []);
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback to common diagnoses filter
      const filtered = COMMON_DIAGNOSES.filter(d =>
        d.code.toLowerCase().includes(query.toLowerCase()) ||
        d.description.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    } finally {
      setSearching(false);
    }
  };

  // Add diagnosis
  const addDiagnosis = (diagnosis) => {
    if (readOnly) return;

    // Check if already added
    const exists = diagnoses.some(d =>
      d.code === (diagnosis.code || diagnosis.icd10Code)
    );
    if (exists) return;

    const newDiagnosis = {
      code: diagnosis.code || diagnosis.icd10Code || '',
      description: diagnosis.description || diagnosis.name || '',
      isPrimary: diagnoses.length === 0, // First diagnosis is primary
      notes: '',
      addedAt: new Date().toISOString()
    };

    onChange?.([...diagnoses, newDiagnosis]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Remove diagnosis
  const removeDiagnosis = (index) => {
    if (readOnly) return;
    const updated = diagnoses.filter((_, i) => i !== index);

    // If removed primary, make first one primary
    if (diagnoses[index]?.isPrimary && updated.length > 0) {
      updated[0].isPrimary = true;
    }

    onChange?.(updated);
  };

  // Toggle primary diagnosis
  const togglePrimary = (index) => {
    if (readOnly) return;
    const updated = diagnoses.map((d, i) => ({
      ...d,
      isPrimary: i === index
    }));
    onChange?.(updated);
  };

  // Update diagnosis notes
  const updateNotes = (index, notes) => {
    if (readOnly) return;
    const updated = [...diagnoses];
    updated[index] = { ...updated[index], notes };
    onChange?.(updated);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Diagnostics</h3>
        <span className="text-sm text-gray-500">
          {diagnoses.length} diagnostic{diagnoses.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      {!readOnly && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchDiagnoses(e.target.value);
              }}
              placeholder="Rechercher un code CIM-10 ou une description..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {searching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result._id || result.code}
                  onClick={() => addDiagnosis(result)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b last:border-b-0 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-blue-600">
                        {result.code || result.icd10Code}
                      </span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="text-gray-900">
                        {result.description || result.name}
                      </span>
                    </div>
                    <Plus className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Common Diagnoses */}
          <div>
            <button
              onClick={() => setShowCommon(!showCommon)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showCommon ? 'Masquer' : 'Afficher'} les diagnostics fréquents
            </button>

            {showCommon && (
              <div className="mt-3 flex flex-wrap gap-2">
                {COMMON_DIAGNOSES.map((diagnosis) => {
                  const isAdded = diagnoses.some(d => d.code === diagnosis.code);
                  return (
                    <button
                      key={diagnosis.code}
                      onClick={() => !isAdded && addDiagnosis(diagnosis)}
                      disabled={isAdded}
                      className={`px-3 py-1.5 text-xs rounded-full border transition ${
                        isAdded
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-700'
                      }`}
                    >
                      <span className="font-mono">{diagnosis.code}</span>
                      <span className="mx-1">-</span>
                      <span>{diagnosis.description}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Diagnoses */}
      {diagnoses.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun diagnostic ajouté</p>
          <p className="text-sm text-gray-400 mt-1">
            Recherchez et ajoutez des codes CIM-10
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {diagnoses.map((diagnosis, index) => (
            <div
              key={`${diagnosis.code}-${index}`}
              className={`border rounded-lg p-4 ${
                diagnosis.isPrimary
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-semibold text-blue-600">
                      {diagnosis.code}
                    </span>
                    {diagnosis.isPrimary && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900 mt-1">{diagnosis.description}</p>

                  {/* Notes */}
                  <textarea
                    value={diagnosis.notes || ''}
                    onChange={(e) => updateNotes(index, e.target.value)}
                    placeholder="Notes additionnelles..."
                    className="mt-2 w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    rows={2}
                    disabled={readOnly}
                  />
                </div>

                {!readOnly && (
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => togglePrimary(index)}
                      className={`p-1.5 rounded hover:bg-gray-100 ${
                        diagnosis.isPrimary ? 'text-yellow-500' : 'text-gray-400'
                      }`}
                      title={diagnosis.isPrimary ? 'Diagnostic principal' : 'Définir comme principal'}
                    >
                      <Star className="h-4 w-4" fill={diagnosis.isPrimary ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => removeDiagnosis(index)}
                      className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                      title="Supprimer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
