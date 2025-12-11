import { useState, useEffect } from 'react';
import { Search, Plus, Clock, Star, Loader2, ChevronRight, X, Eye } from 'lucide-react';
import doseTemplateService from '../services/doseTemplateService';
import treatmentProtocolService from '../services/treatmentProtocolService';
import { EYE_OPTIONS, ADMINISTRATION_ROUTES, getSuggestedTaperingTemplates, TAPERING_TEMPLATES } from '../data/medicationRoutes';

/**
 * MedicationTemplateSelector - Fermer-style three-column medication selector
 *
 * Layout:
 * - Left: Categories (Maquettes)
 * - Middle: Medications (Vidal)
 * - Right: Dosage (Posologie)
 */
export default function MedicationTemplateSelector({
  onAddMedication,
  onClose
}) {
  // State
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [medications, setMedications] = useState([]);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [doseTemplates, setDoseTemplates] = useState([]);
  const [selectedDose, setSelectedDose] = useState(null);
  const [treatmentProtocols, setTreatmentProtocols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [duration, setDuration] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedEye, setSelectedEye] = useState('OU'); // OD, OS, or OU

  // Medication categories (Fermer-style) with default routes
  const MEDICATION_CATEGORIES = [
    { id: 'ains_local', name: 'A.I.N.S. LOCAUX', icon: '💧', route: 'ophthalmic', isOphthalmic: true },
    { id: 'ains_general', name: 'A.I.N.S. GÉNÉRAUX', icon: '💊', route: 'oral', isOphthalmic: false },
    { id: 'antibio_local', name: 'ANTIBIOTIQUES LOCAUX', icon: '👁️', route: 'ophthalmic', isOphthalmic: true },
    { id: 'antibio_general', name: 'ANTIBIOTIQUES GÉNÉRAUX', icon: '💉', route: 'oral', isOphthalmic: false },
    { id: 'antiallergique', name: 'ANTIALLERGIQUES', icon: '🌸', route: 'ophthalmic', isOphthalmic: true },
    { id: 'antiviral', name: 'ANTIVIRAUX', icon: '🦠', route: 'ophthalmic', isOphthalmic: true },
    { id: 'cortico_local', name: 'CORTICOÏDES LOCAUX', icon: '💧', route: 'ophthalmic', isOphthalmic: true, suggestTapering: true },
    { id: 'cortico_general', name: 'CORTICOÏDES GÉNÉRAUX', icon: '💊', route: 'oral', isOphthalmic: false, suggestTapering: true },
    { id: 'glaucome', name: 'ANTI-GLAUCOMATEUX', icon: '👁️', route: 'ophthalmic', isOphthalmic: true },
    { id: 'lubrifiant', name: 'LUBRIFIANTS', icon: '💦', route: 'ophthalmic', isOphthalmic: true },
    { id: 'mydriatique', name: 'MYDRIATIQUES', icon: '⭕', route: 'ophthalmic', isOphthalmic: true },
    { id: 'antiseptique', name: 'ANTISEPTIQUES', icon: '🧴', route: 'ophthalmic', isOphthalmic: true },
    { id: 'vitamines', name: 'VITAMINES', icon: '🍊', route: 'oral', isOphthalmic: false },
    { id: 'autres', name: 'AUTRES', icon: '📦', route: 'oral', isOphthalmic: false }
  ];

  // Sample medications by category (would come from API)
  const MEDICATIONS_BY_CATEGORY = {
    ains_local: [
      { id: 1, name: 'INDOCOLLYRE 0.1%', form: 'collyre', volume: '5ml' },
      { id: 2, name: 'VOLTARÈNE OPHTA 0.1%', form: 'collyre', volume: '5ml' },
      { id: 3, name: 'OCUFEN collyre', form: 'collyre', volume: '5ml' }
    ],
    antibio_local: [
      { id: 4, name: 'TOBREX collyre', form: 'collyre', volume: '5ml' },
      { id: 5, name: 'CILOXAN collyre 0.3%', form: 'collyre', volume: '5ml' },
      { id: 6, name: 'AZYTER collyre', form: 'unidoses', volume: '6 unidoses' },
      { id: 7, name: 'FUCITHALMIC gel', form: 'gel', volume: '5g' },
      { id: 8, name: 'RIFAMYCINE collyre', form: 'collyre', volume: '10ml' }
    ],
    antiallergique: [
      { id: 9, name: 'OPATANOL collyre', form: 'collyre', volume: '5ml' },
      { id: 10, name: 'ZALERG collyre', form: 'collyre', volume: '5ml' },
      { id: 11, name: 'LEVOPHTA collyre', form: 'collyre', volume: '5ml' }
    ],
    cortico_local: [
      { id: 12, name: 'MAXIDEX collyre', form: 'collyre', volume: '5ml' },
      { id: 13, name: 'TOBRADEX collyre', form: 'collyre', volume: '5ml' },
      { id: 14, name: 'FLAREX collyre', form: 'collyre', volume: '5ml' }
    ],
    glaucome: [
      { id: 15, name: 'XALATAN collyre', form: 'collyre', volume: '2.5ml' },
      { id: 16, name: 'TRAVATAN collyre', form: 'collyre', volume: '2.5ml' },
      { id: 17, name: 'LUMIGAN collyre', form: 'collyre', volume: '3ml' },
      { id: 18, name: 'AZOPT collyre', form: 'collyre', volume: '5ml' },
      { id: 19, name: 'TRUSOPT collyre', form: 'collyre', volume: '5ml' },
      { id: 20, name: 'COSOPT collyre', form: 'collyre', volume: '5ml' }
    ],
    lubrifiant: [
      { id: 21, name: 'OPTIVE FUSION', form: 'collyre', volume: '10ml' },
      { id: 22, name: 'SYSTANE ULTRA', form: 'collyre', volume: '10ml' },
      { id: 23, name: 'HYABAK collyre', form: 'collyre', volume: '10ml' },
      { id: 24, name: 'THEALOSE collyre', form: 'collyre', volume: '10ml' },
      { id: 25, name: 'LACRYVISC gel', form: 'gel', volume: '10g' }
    ],
    mydriatique: [
      { id: 26, name: 'MYDRIATICUM collyre', form: 'collyre', volume: '5ml' },
      { id: 27, name: 'ATROPINE 1% collyre', form: 'collyre', volume: '5ml' },
      { id: 28, name: 'NEOSYNEPHRINE 10%', form: 'collyre', volume: '5ml' }
    ]
  };

  // Dosage options (Fermer-style Posologie)
  const DOSAGE_OPTIONS = [
    { id: 'morning', label: 'le matin', frequency: '1x/jour' },
    { id: 'evening', label: 'le soir', frequency: '1x/jour' },
    { id: 'morning_evening', label: 'matin et soir', frequency: '2x/jour' },
    { id: 'once', label: 'une fois par jour', frequency: '1x/jour' },
    { id: 'twice', label: 'deux fois par jour', frequency: '2x/jour' },
    { id: 'three_times', label: 'trois fois par jour', frequency: '3x/jour' },
    { id: 'four_times', label: 'quatre fois par jour', frequency: '4x/jour' },
    { id: 'six_times', label: 'six fois par jour', frequency: '6x/jour' },
    { id: 'every_2h', label: 'toutes les 2 heures', frequency: '8x/jour' },
    { id: 'every_4h', label: 'toutes les 4 heures', frequency: '6x/jour' },
    { id: 'before_meals', label: 'avant les repas', frequency: '3x/jour' },
    { id: 'after_meals', label: 'après les repas', frequency: '3x/jour' },
    { id: 'bedtime', label: 'au coucher', frequency: '1x/jour' }
  ];

  // Duration options
  const DURATION_OPTIONS = [
    '3 jours',
    '5 jours',
    '7 jours',
    '10 jours',
    '14 jours',
    '1 mois',
    '2 mois',
    '3 mois',
    'jusqu\'à amélioration',
    'jusqu\'à contrôle'
  ];

  // Load treatment protocols
  useEffect(() => {
    const loadProtocols = async () => {
      try {
        const response = await treatmentProtocolService.getPopularProtocols(20);
        setTreatmentProtocols(response.data || response || []);
      } catch (error) {
        console.error('Error loading protocols:', error);
      }
    };
    loadProtocols();
  }, []);

  // Load dose templates when medication selected
  useEffect(() => {
    const loadDoseTemplates = async () => {
      if (selectedMedication?.form) {
        try {
          const response = await doseTemplateService.getByForm(selectedMedication.form);
          setDoseTemplates(response.data || response || []);
        } catch (error) {
          console.error('Error loading dose templates:', error);
        }
      }
    };
    loadDoseTemplates();
  }, [selectedMedication]);

  // Handle category selection
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSelectedMedication(null);
    setSelectedDose(null);
    setMedications(MEDICATIONS_BY_CATEGORY[category.id] || []);
  };

  // Handle medication selection
  const handleMedicationSelect = (medication) => {
    setSelectedMedication(medication);
    setSelectedDose(null);
  };

  // Handle dosage selection
  const handleDoseSelect = (dose) => {
    setSelectedDose(dose);
  };

  // Add medication to prescription
  const handleAdd = () => {
    if (!selectedMedication || !selectedDose) return;

    const isOphthalmic = selectedCategory?.isOphthalmic;
    const route = selectedCategory?.route || 'oral';

    const medication = {
      id: Date.now(),
      name: selectedMedication.name,
      form: selectedMedication.form,
      dosage: selectedDose.label,
      frequency: selectedDose.frequency,
      duration: duration || '7 jours',
      instructions: customInstructions,
      category: selectedCategory?.name,
      // New fields for route and application location
      route: route,
      applicationLocation: isOphthalmic ? {
        eye: selectedEye,
        eyeArea: 'conjunctiva'
      } : null,
      // Tapering suggestion for corticosteroids
      suggestTapering: selectedCategory?.suggestTapering || false
    };

    onAddMedication(medication);

    // Reset selections
    setSelectedMedication(null);
    setSelectedDose(null);
    setDuration('');
    setCustomInstructions('');
    setSelectedEye('OU');
  };

  // Apply treatment protocol
  const applyProtocol = async (protocol) => {
    if (protocol.medications) {
      protocol.medications.forEach(med => {
        // Determine route based on medication form
        const isOphthalmic = ['collyre', 'gel ophtalmique', 'pommade ophtalmique', 'unidoses'].includes(med.form?.toLowerCase());
        const route = med.route || (isOphthalmic ? 'ophthalmic' : 'oral');

        onAddMedication({
          id: Date.now() + Math.random(),
          name: med.name,
          form: med.form,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions,
          category: protocol.name,
          // Add route and applicationLocation
          route: route,
          applicationLocation: isOphthalmic ? {
            eye: med.eye || selectedEye || 'OU',
            eyeArea: med.eyeArea || 'conjunctiva'
          } : null,
          // Pass through tapering if present in protocol
          tapering: med.tapering || null,
          suggestTapering: med.suggestTapering || false
        });
      });
    }

    // Increment usage
    try {
      await treatmentProtocolService.incrementUsage(protocol._id);
    } catch (error) {
      console.error('Error incrementing protocol usage:', error);
    }
  };

  // Filter medications by search
  const filteredMedications = medications.filter(med =>
    med.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Sélection Médicaments</h3>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Treatment Protocols (Quick Access) */}
      <div className="flex-shrink-0 px-4 py-2 border-b bg-yellow-50">
        <div className="text-xs font-medium text-yellow-800 mb-2">Traitements Standards</div>
        <div className="flex flex-wrap gap-1">
          {treatmentProtocols.slice(0, 8).map((protocol) => (
            <button
              key={protocol._id || protocol.id}
              onClick={() => applyProtocol(protocol)}
              className="text-xs px-2 py-1 bg-yellow-100 hover:bg-yellow-200 rounded border border-yellow-300 truncate max-w-[120px]"
              title={protocol.name}
            >
              {protocol.name}
            </button>
          ))}
        </div>
      </div>

      {/* Three-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Categories (Maquettes) */}
        <div className="w-1/4 border-r overflow-y-auto bg-gray-50">
          <div className="p-2 border-b bg-white sticky top-0">
            <div className="text-xs font-medium text-gray-600">Catégories</div>
          </div>
          <div className="p-1">
            {MEDICATION_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded mb-0.5 transition ${
                  selectedCategory?.id === category.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                <span className="mr-1">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Middle Column - Medications (Vidal) */}
        <div className="w-2/5 border-r overflow-y-auto">
          <div className="p-2 border-b bg-white sticky top-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border rounded"
              />
            </div>
          </div>
          <div className="p-1">
            {!selectedCategory ? (
              <div className="p-4 text-center text-gray-500 text-xs">
                Sélectionnez une catégorie
              </div>
            ) : filteredMedications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-xs">
                Aucun médicament trouvé
              </div>
            ) : (
              filteredMedications.map((med) => (
                <button
                  key={med.id}
                  onClick={() => handleMedicationSelect(med)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded mb-0.5 transition ${
                    selectedMedication?.id === med.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{med.name}</div>
                  <div className="text-gray-500">{med.form} - {med.volume}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column - Dosage (Posologie) */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 border-b bg-white sticky top-0">
            <div className="text-xs font-medium text-gray-600">Posologie</div>
          </div>
          <div className="p-2">
            {!selectedMedication ? (
              <div className="p-4 text-center text-gray-500 text-xs">
                Sélectionnez un médicament
              </div>
            ) : (
              <div className="space-y-3">
                {/* Eye Selection - Only for ophthalmic medications */}
                {selectedCategory?.isOphthalmic && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                      <Eye className="w-3 h-3 mr-1" />
                      Oeil
                    </div>
                    <div className="flex gap-1">
                      {EYE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSelectedEye(option.value)}
                          className={`flex-1 px-2 py-1.5 text-xs rounded border transition ${
                            selectedEye === option.value
                              ? 'bg-blue-100 border-blue-500 text-blue-700'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          title={option.description}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frequency */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Fréquence</div>
                  <div className="space-y-0.5">
                    {DOSAGE_OPTIONS.map((dose) => (
                      <button
                        key={dose.id}
                        onClick={() => handleDoseSelect(dose)}
                        className={`w-full text-left px-2 py-1 text-xs rounded transition ${
                          selectedDose?.id === dose.id
                            ? 'bg-green-100 text-green-700'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {dose.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Durée</div>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-2 py-1 text-xs border rounded"
                  >
                    <option value="">Sélectionner...</option>
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Custom Instructions */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">Instructions</div>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Instructions supplémentaires..."
                    className="w-full px-2 py-1 text-xs border rounded resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Selected Summary & Add Button */}
      <div className="flex-shrink-0 border-t bg-gray-50 p-3">
        {selectedMedication && selectedDose ? (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{selectedMedication.name}</span>
              {selectedCategory?.isOphthalmic && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {selectedEye}
                </span>
              )}
              <span className="text-gray-500"> - {selectedDose.label}</span>
              {duration && <span className="text-gray-500"> ({duration})</span>}
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center">
            Sélectionnez un médicament et une posologie
          </div>
        )}
      </div>
    </div>
  );
}
