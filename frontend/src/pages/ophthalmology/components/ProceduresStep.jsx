/**
 * ProceduresStep - Clinical procedures and imaging ordering
 *
 * Allows:
 * - Select from common ophthalmology procedures
 * - Order imaging studies
 * - Add custom procedures
 * - Set priority and add notes
 */

import { useState } from 'react';
import { Search, Plus, X, Camera, Scan, Eye, AlertCircle } from 'lucide-react';

// Common ophthalmology procedures and imaging
const PROCEDURES = {
  imaging: [
    { code: 'OCT', name: 'OCT Maculaire', description: 'Tomographie en cohérence optique' },
    { code: 'OCT-RNFL', name: 'OCT RNFL', description: 'Analyse des fibres nerveuses' },
    { code: 'OCT-ANT', name: 'OCT Segment Antérieur', description: 'Imagerie du segment antérieur' },
    { code: 'ANGIO-OCT', name: 'Angio-OCT', description: 'Angiographie OCT' },
    { code: 'RETINO', name: 'Rétinographie', description: 'Photographie du fond d\'oeil' },
    { code: 'ANGIO', name: 'Angiographie Fluorescéine', description: 'AF / ICG' },
    { code: 'UBM', name: 'UBM', description: 'Biomicroscopie ultrasonore' },
    { code: 'ECHO-B', name: 'Échographie Mode B', description: 'Échographie oculaire' },
    { code: 'BIOM', name: 'Biométrie', description: 'Mesures pour implant' },
    { code: 'TOPO', name: 'Topographie Cornéenne', description: 'Cartographie cornéenne' },
    { code: 'PENTA', name: 'Pentacam', description: 'Analyse cornéenne complète' },
    { code: 'SPECULAR', name: 'Microscopie Spéculaire', description: 'Comptage cellules endothéliales' }
  ],
  functional: [
    { code: 'CV', name: 'Champ Visuel', description: 'Périmétrie automatisée' },
    { code: 'CV-GOLD', name: 'Champ Visuel Goldmann', description: 'Périmétrie cinétique' },
    { code: 'ERG', name: 'Électrorétinogramme', description: 'ERG global / multifocal' },
    { code: 'EOG', name: 'Électro-oculogramme', description: 'Test de l\'épithélium pigmentaire' },
    { code: 'PEV', name: 'PEV', description: 'Potentiels évoqués visuels' },
    { code: 'VISION-COULEURS', name: 'Vision des Couleurs', description: 'Test d\'Ishihara / Farnsworth' },
    { code: 'CONTRAST', name: 'Sensibilité au Contraste', description: 'Test de Pelli-Robson' }
  ],
  interventional: [
    { code: 'LASER-YAG', name: 'Laser YAG', description: 'Capsulotomie / Iridotomie' },
    { code: 'LASER-ARGON', name: 'Laser Argon', description: 'Photocoagulation rétinienne' },
    { code: 'SLT', name: 'SLT', description: 'Trabéculoplastie sélective' },
    { code: 'IVT', name: 'Injection Intravitréenne', description: 'Anti-VEGF / Corticoïdes' },
    { code: 'PKE', name: 'Ponction Chambre Antérieure', description: 'Prélèvement d\'humeur aqueuse' }
  ]
};

const PRIORITY_LEVELS = [
  { value: 'routine', label: 'Routine', color: 'bg-gray-100 text-gray-700' },
  { value: 'soon', label: 'Sous 1 semaine', color: 'bg-blue-100 text-blue-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-700' },
  { value: 'stat', label: 'Immédiat', color: 'bg-red-100 text-red-700' }
];

const CATEGORY_LABELS = {
  imaging: { label: 'Imagerie', icon: Camera },
  functional: { label: 'Examens Fonctionnels', icon: Eye },
  interventional: { label: 'Actes Interventionnels', icon: Scan }
};

export default function ProceduresStep({ data = [], onChange, readOnly = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('imaging');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customProcedure, setCustomProcedure] = useState({ name: '', code: '', notes: '' });

  const orders = Array.isArray(data) ? data : [];

  // Filter procedures by search
  const filterProcedures = (procedures) => {
    if (!searchQuery) return procedures;
    const query = searchQuery.toLowerCase();
    return procedures.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.code.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
  };

  // Add procedure to orders
  const addProcedure = (procedure, category) => {
    if (readOnly) return;

    // Check if already ordered
    const exists = orders.some(o => o.code === procedure.code);
    if (exists) return;

    const newOrder = {
      code: procedure.code,
      name: procedure.name,
      description: procedure.description || '',
      category,
      priority: 'routine',
      notes: '',
      laterality: 'both', // OD, OS, or both
      orderedAt: new Date().toISOString()
    };

    onChange?.([...orders, newOrder]);
  };

  // Add custom procedure
  const addCustomProcedure = () => {
    if (!customProcedure.name) return;

    const newOrder = {
      code: customProcedure.code || 'CUSTOM',
      name: customProcedure.name,
      description: '',
      category: 'custom',
      priority: 'routine',
      notes: customProcedure.notes,
      laterality: 'both',
      orderedAt: new Date().toISOString()
    };

    onChange?.([...orders, newOrder]);
    setCustomProcedure({ name: '', code: '', notes: '' });
    setShowCustomForm(false);
  };

  // Remove procedure
  const removeProcedure = (index) => {
    if (readOnly) return;
    onChange?.(orders.filter((_, i) => i !== index));
  };

  // Update priority
  const updatePriority = (index, priority) => {
    if (readOnly) return;
    const updated = [...orders];
    updated[index] = { ...updated[index], priority };
    onChange?.(updated);
  };

  // Update laterality
  const updateLaterality = (index, laterality) => {
    if (readOnly) return;
    const updated = [...orders];
    updated[index] = { ...updated[index], laterality };
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
        <h3 className="text-lg font-semibold text-gray-900">Procédures & Imagerie</h3>
        <span className="text-sm text-gray-500">
          {orders.length} examen{orders.length !== 1 ? 's' : ''} demandé{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search and Category Tabs */}
      {!readOnly && (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une procédure..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" />
              Autre
            </button>
          </div>

          {/* Custom Procedure Form */}
          {showCustomForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom de la procédure *</label>
                  <input
                    type="text"
                    value={customProcedure.name}
                    onChange={(e) => setCustomProcedure({ ...customProcedure, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Test de Schirmer"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Code (optionnel)</label>
                  <input
                    type="text"
                    value={customProcedure.code}
                    onChange={(e) => setCustomProcedure({ ...customProcedure, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: SCHIRMER"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={customProcedure.notes}
                  onChange={(e) => setCustomProcedure({ ...customProcedure, notes: e.target.value })}
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
                  onClick={addCustomProcedure}
                  disabled={!customProcedure.name}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {Object.entries(CATEGORY_LABELS).map(([key, { label, icon: Icon }]) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex-1 flex items-center justify-center px-3 py-2 text-sm rounded-md transition ${
                  activeCategory === key
                    ? 'bg-white text-blue-600 shadow-sm font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4 mr-1.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Procedure List */}
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {filterProcedures(PROCEDURES[activeCategory]).map((procedure) => {
              const isOrdered = orders.some(o => o.code === procedure.code);
              return (
                <button
                  key={procedure.code}
                  onClick={() => !isOrdered && addProcedure(procedure, activeCategory)}
                  disabled={isOrdered}
                  className={`w-full px-4 py-3 text-left border-b last:border-b-0 hover:bg-blue-50 transition ${
                    isOrdered ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <span className="font-mono text-xs text-blue-600 mr-2">{procedure.code}</span>
                        <span className="font-medium">{procedure.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{procedure.description}</p>
                    </div>
                    {isOrdered ? (
                      <span className="text-xs text-green-600">Ajouté</span>
                    ) : (
                      <Plus className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ordered Procedures */}
      {orders.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Scan className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune procédure demandée</p>
          <p className="text-sm text-gray-400 mt-1">
            Sélectionnez des examens dans les catégories ci-dessus
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Procédures demandées</h4>
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
                  {order.description && (
                    <p className="text-xs text-gray-500 mt-1">{order.description}</p>
                  )}

                  {/* Laterality Selection */}
                  <div className="flex items-center space-x-2 mt-3">
                    <span className="text-xs text-gray-500">Oeil:</span>
                    <div className="flex space-x-1">
                      {[
                        { value: 'OD', label: 'OD' },
                        { value: 'OS', label: 'OS' },
                        { value: 'both', label: 'ODG' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateLaterality(index, opt.value)}
                          className={`px-2 py-0.5 text-xs rounded ${
                            order.laterality === opt.value
                              ? 'bg-blue-100 text-blue-700 font-medium'
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                          disabled={readOnly}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority Selection */}
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-xs text-gray-500">Priorité:</span>
                    <div className="flex space-x-1">
                      {PRIORITY_LEVELS.map((level) => (
                        <button
                          key={level.value}
                          onClick={() => updatePriority(index, level.value)}
                          className={`px-2 py-0.5 text-xs rounded ${
                            order.priority === level.value
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
                    onClick={() => removeProcedure(index)}
                    className="ml-4 p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                    title="Supprimer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Urgent Warning */}
          {orders.some(o => o.priority === 'stat') && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm">
                Des procédures immédiates ont été demandées. Coordonnez avec l'équipe technique.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
