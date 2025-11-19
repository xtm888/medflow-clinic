/**
 * LaboratoryStep - Laboratory test ordering for ophthalmology
 *
 * Allows:
 * - Select from common ophthalmology-related lab tests
 * - Add custom tests
 * - Set urgency level
 * - Add clinical notes
 */

import { useState } from 'react';
import { Search, Plus, X, AlertCircle, Clock, Beaker } from 'lucide-react';

// Common ophthalmology-related lab tests
const COMMON_LAB_TESTS = [
  { code: 'HBA1C', name: 'Hémoglobine Glyquée (HbA1c)', category: 'Diabète' },
  { code: 'GLY', name: 'Glycémie à Jeun', category: 'Diabète' },
  { code: 'NFS', name: 'Numération Formule Sanguine', category: 'Hématologie' },
  { code: 'CRP', name: 'Protéine C-Réactive', category: 'Inflammation' },
  { code: 'VS', name: 'Vitesse de Sédimentation', category: 'Inflammation' },
  { code: 'ANA', name: 'Anticorps Anti-Nucléaires', category: 'Auto-immunité' },
  { code: 'RF', name: 'Facteur Rhumatoïde', category: 'Auto-immunité' },
  { code: 'TSH', name: 'Thyréostimuline', category: 'Thyroïde' },
  { code: 'T4', name: 'Thyroxine Libre', category: 'Thyroïde' },
  { code: 'CHOL', name: 'Cholestérol Total', category: 'Lipides' },
  { code: 'TG', name: 'Triglycérides', category: 'Lipides' },
  { code: 'CREAT', name: 'Créatinine', category: 'Fonction rénale' },
  { code: 'UREE', name: 'Urée', category: 'Fonction rénale' },
  { code: 'TOXO', name: 'Sérologie Toxoplasmose', category: 'Sérologie' },
  { code: 'CMV', name: 'Sérologie CMV', category: 'Sérologie' }
];

const URGENCY_LEVELS = [
  { value: 'routine', label: 'Routine', color: 'bg-gray-100 text-gray-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-700' },
  { value: 'stat', label: 'STAT', color: 'bg-red-100 text-red-700' }
];

export default function LaboratoryStep({ data = [], onChange, readOnly = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTest, setCustomTest] = useState({ name: '', code: '', notes: '' });

  const orders = Array.isArray(data) ? data : [];

  // Filter tests by search
  const filteredTests = COMMON_LAB_TESTS.filter(test =>
    test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group tests by category
  const groupedTests = filteredTests.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = [];
    acc[test.category].push(test);
    return acc;
  }, {});

  // Add test to orders
  const addTest = (test) => {
    if (readOnly) return;

    // Check if already ordered
    const exists = orders.some(o => o.code === test.code);
    if (exists) return;

    const newOrder = {
      code: test.code,
      name: test.name,
      category: test.category || 'Autre',
      urgency: 'routine',
      notes: '',
      orderedAt: new Date().toISOString()
    };

    onChange?.([...orders, newOrder]);
  };

  // Add custom test
  const addCustomTest = () => {
    if (!customTest.name) return;

    const newOrder = {
      code: customTest.code || 'CUSTOM',
      name: customTest.name,
      category: 'Personnalisé',
      urgency: 'routine',
      notes: customTest.notes,
      orderedAt: new Date().toISOString()
    };

    onChange?.([...orders, newOrder]);
    setCustomTest({ name: '', code: '', notes: '' });
    setShowCustomForm(false);
  };

  // Remove test
  const removeTest = (index) => {
    if (readOnly) return;
    onChange?.(orders.filter((_, i) => i !== index));
  };

  // Update urgency
  const updateUrgency = (index, urgency) => {
    if (readOnly) return;
    const updated = [...orders];
    updated[index] = { ...updated[index], urgency };
    onChange?.(updated);
  };

  // Update notes
  const updateNotes = (index, notes) => {
    if (readOnly) return;
    const updated = [...orders];
    updated[index] = { ...updated[index], notes };
    onChange?.(updated);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Examens de Laboratoire</h3>
        <span className="text-sm text-gray-500">
          {orders.length} examen{orders.length !== 1 ? 's' : ''} demandé{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search and Add */}
      {!readOnly && (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un examen..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" />
              Personnalisé
            </button>
          </div>

          {/* Custom Test Form */}
          {showCustomForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom de l'examen *</label>
                  <input
                    type="text"
                    value={customTest.name}
                    onChange={(e) => setCustomTest({ ...customTest, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Dosage vitamine D"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Code (optionnel)</label>
                  <input
                    type="text"
                    value={customTest.code}
                    onChange={(e) => setCustomTest({ ...customTest, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: VIT-D"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={customTest.notes}
                  onChange={(e) => setCustomTest({ ...customTest, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Instructions spéciales..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCustomForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={addCustomTest}
                  disabled={!customTest.name}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Test Categories */}
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {Object.entries(groupedTests).map(([category, tests]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700 sticky top-0">
                  {category}
                </div>
                {tests.map((test) => {
                  const isOrdered = orders.some(o => o.code === test.code);
                  return (
                    <button
                      key={test.code}
                      onClick={() => !isOrdered && addTest(test)}
                      disabled={isOrdered}
                      className={`w-full px-4 py-2 text-left border-t hover:bg-blue-50 flex items-center justify-between ${
                        isOrdered ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                      }`}
                    >
                      <div>
                        <span className="font-mono text-xs text-blue-600 mr-2">{test.code}</span>
                        <span>{test.name}</span>
                      </div>
                      {isOrdered ? (
                        <span className="text-xs text-green-600">Ajouté</span>
                      ) : (
                        <Plus className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ordered Tests */}
      {orders.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Beaker className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun examen demandé</p>
          <p className="text-sm text-gray-400 mt-1">
            Recherchez et ajoutez des examens de laboratoire
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Examens demandés</h4>
          {orders.map((order, index) => (
            <div
              key={`${order.code}-${index}`}
              className="border rounded-lg p-4 bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-blue-600">{order.code}</span>
                    <span className="font-medium text-gray-900">{order.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{order.category}</p>

                  {/* Urgency Selection */}
                  <div className="flex items-center space-x-2 mt-3">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div className="flex space-x-1">
                      {URGENCY_LEVELS.map((level) => (
                        <button
                          key={level.value}
                          onClick={() => updateUrgency(index, level.value)}
                          className={`px-2 py-0.5 text-xs rounded ${
                            order.urgency === level.value
                              ? level.color + ' font-medium'
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                          disabled={readOnly}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <input
                    type="text"
                    value={order.notes || ''}
                    onChange={(e) => updateNotes(index, e.target.value)}
                    placeholder="Notes additionnelles..."
                    className="mt-2 w-full px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={readOnly}
                  />
                </div>

                {!readOnly && (
                  <button
                    onClick={() => removeTest(index)}
                    className="ml-4 p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                    title="Supprimer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Urgency Warning */}
          {orders.some(o => o.urgency === 'stat') && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm">
                Des examens STAT ont été demandés. Assurez-vous que le laboratoire est informé immédiatement.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
