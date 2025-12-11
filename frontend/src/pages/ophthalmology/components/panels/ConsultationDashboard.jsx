import { useState, useEffect } from 'react';
import {
  MessageSquare, Activity, Glasses, Search, Stethoscope,
  FileText, Save, CheckCircle, Clock, ChevronDown, ChevronUp,
  AlertTriangle, User, Calendar, Pill
} from 'lucide-react';
import RefractionPanel from './RefractionPanel';
import ExaminationPanel from './ExaminationPanel';
import DiagnosticPanel from './DiagnosticPanel';
import TemplateSelector from '../../../../components/consultation/TemplateSelector';
import OrthopticSummaryCard from '../../../../components/OrthopticSummaryCard';
import feeScheduleService from '../../../../services/feeScheduleService';

/**
 * ConsultationDashboard - Single-page consolidated consultation view
 * Combines all consultation steps into one scrollable dashboard
 *
 * Sections:
 * 1. Patient Header + Chief Complaint
 * 2. Vitals (collapsible)
 * 3. Refraction Module (3-column)
 * 4. Examination Module (3-column)
 * 5. Diagnostic Module (tabbed)
 * 6. Prescription Module
 * 7. Summary & Actions
 */
export default function ConsultationDashboard({
  patient,
  initialData,
  onSave,
  onComplete,
  onCancel,
  autoSave = true,
  autoSaveInterval = 30000
}) {
  // All consultation data in one state
  const [data, setData] = useState(initialData || getDefaultData());
  const [expandedSections, setExpandedSections] = useState({
    vitals: false,
    refraction: true,
    examination: true,
    diagnostic: true,
    prescription: true
  });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState(null);
  const [commonMedications, setCommonMedications] = useState([]);
  const [loadingMedications, setLoadingMedications] = useState(true);

  // Fetch medications from fee schedule
  useEffect(() => {
    const fetchMedications = async () => {
      try {
        setLoadingMedications(true);
        const medications = await feeScheduleService.getMedications();

        // Transform fee schedule data to component format
        setCommonMedications(medications.map(med => ({
          name: med.name,
          dose: '', // Default empty dose, user will fill in
          category: med.displayCategory || med.category || 'Médicament',
          code: med.code,
          price: med.price
        })));
      } catch (error) {
        console.error('Error fetching medications:', error);
        // Fallback to empty array on error
        setCommonMedications([]);
      } finally {
        setLoadingMedications(false);
      }
    };

    fetchMedications();
  }, []);

  // Handle applying a consultation template
  const handleApplyTemplate = (templateData, template) => {
    if (!templateData) {
      // Reset template
      setAppliedTemplateId(null);
      return;
    }

    // Merge template data with current data
    setData(prev => ({
      ...prev,
      complaint: {
        ...prev.complaint,
        motif: templateData.complaint?.motif || prev.complaint?.motif || '',
        duration: templateData.complaint?.duration || prev.complaint?.duration || '',
        notes: templateData.complaint?.notes || prev.complaint?.notes || ''
      },
      diagnostic: {
        ...prev.diagnostic,
        diagnoses: [
          ...(prev.diagnostic?.diagnoses || []),
          ...templateData.diagnoses.filter(d =>
            !(prev.diagnostic?.diagnoses || []).some(existing => existing.code === d.code)
          ).map((d, i) => ({
            ...d,
            isPrimary: (prev.diagnostic?.diagnoses || []).length === 0 && i === 0,
            addedAt: new Date().toISOString()
          }))
        ],
        procedures: [
          ...(prev.diagnostic?.procedures || []),
          ...templateData.procedures.filter(p =>
            !(prev.diagnostic?.procedures || []).some(existing => existing.code === p.code)
          )
        ]
      },
      prescription: {
        ...prev.prescription,
        medications: [
          ...(prev.prescription?.medications || []),
          ...templateData.medications.filter(m =>
            !(prev.prescription?.medications || []).some(existing => existing.name === m.name)
          )
        ]
      },
      _templateApplied: {
        id: template._id,
        name: template.name,
        appliedAt: new Date().toISOString()
      }
    }));

    setAppliedTemplateId(template._id);
    setHasChanges(true);
  };

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !hasChanges) return;

    const timer = setTimeout(async () => {
      await handleSave(true);
    }, autoSaveInterval);

    return () => clearTimeout(timer);
  }, [data, autoSave, hasChanges]);

  // Update section data
  const updateSection = (section, value) => {
    setData(prev => ({ ...prev, [section]: value }));
    setHasChanges(true);
  };

  // Save handler
  const handleSave = async (isAutoSave = false) => {
    setSaving(true);
    try {
      await onSave?.(data, isAutoSave);
      setLastSaved(new Date());
      setHasChanges(false);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Complete consultation
  const handleComplete = async () => {
    console.log('handleComplete called with data:', data);

    // Validate required fields
    const errors = validateData(data);
    console.log('Validation errors:', errors);

    if (errors.length > 0) {
      const message = 'Veuillez compléter les champs obligatoires:\n' + errors.join('\n');
      console.warn('Validation failed:', message);
      alert(message);
      return;
    }

    console.log('Validation passed, saving and completing...');
    await handleSave();
    console.log('Save complete, calling onComplete with data:', data);
    onComplete?.(data);
  };

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Common symptom suggestions for ophthalmology
  const symptomSuggestions = [
    'Baisse de vision', 'Vision floue', 'Douleur oculaire', 'Rougeur',
    'Larmoiement', 'Photophobie', 'Corps flottants', 'Halos lumineux',
    'Diplopie', 'Prurit', 'Sécheresse', 'Contrôle glaucome',
    'Contrôle diabète', 'Renouvellement lunettes'
  ];

  // Duration quick picks
  const durationOptions = [
    { label: 'Aujourd\'hui', value: '1 jour' },
    { label: '2-3 jours', value: '2-3 jours' },
    { label: '1 semaine', value: '1 semaine' },
    { label: '2-4 sem.', value: '2-4 semaines' },
    { label: '1-3 mois', value: '1-3 mois' },
    { label: '> 3 mois', value: 'Plus de 3 mois' },
    { label: 'Chronique', value: 'Chronique' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Patient Info */}
            <div className="flex items-center gap-4">
              {patient?.photoUrl ? (
                <img
                  src={patient.photoUrl}
                  alt={`${patient?.firstName} ${patient?.lastName}`}
                  className="h-12 w-12 rounded-full object-cover border-2 border-blue-200"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {patient?.firstName} {patient?.lastName}
                </h1>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{patient?.age || calculateAge(patient?.dateOfBirth)} ans</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{patient?.gender === 'male' ? 'H' : 'F'}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{patient?.mrn || patient?.patientId}</span>
                </div>
              </div>

              {/* Template Selector */}
              <TemplateSelector
                onApply={handleApplyTemplate}
                selectedTemplateId={appliedTemplateId}
              />
            </div>

            {/* Status & Actions */}
            <div className="flex items-center gap-3">
              {lastSaved && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Sauvegardé {formatTime(lastSaved)}
                </span>
              )}
              {saving && (
                <span className="text-xs text-blue-500 flex items-center gap-1">
                  <Save className="h-3 w-3 animate-pulse" />
                  Sauvegarde...
                </span>
              )}
              <button
                onClick={() => handleSave()}
                disabled={saving || !hasChanges}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4 inline mr-1" />
                Sauvegarder
              </button>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleComplete}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
              >
                <CheckCircle className="h-4 w-4" />
                Terminer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Section 1: Chief Complaint */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Motif de Consultation
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Main Complaint */}
              <div className="col-span-2">
                <label className="text-xs text-gray-500 font-medium">Motif principal</label>
                <textarea
                  value={data.complaint?.motif || ''}
                  onChange={(e) => updateSection('complaint', { ...data.complaint, motif: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Décrivez le motif de consultation..."
                />
                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {symptomSuggestions.slice(0, 8).map(symptom => (
                    <button
                      key={symptom}
                      onClick={() => {
                        const current = data.complaint?.motif || '';
                        const newMotif = current ? `${current}, ${symptom}` : symptom;
                        updateSection('complaint', { ...data.complaint, motif: newMotif });
                      }}
                      className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 rounded-full transition"
                    >
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration & Laterality */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Durée</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {durationOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateSection('complaint', { ...data.complaint, duration: opt.value })}
                        className={`px-2 py-1 text-xs rounded border transition ${
                          data.complaint?.duration === opt.value
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-medium">Latéralité</label>
                  <div className="flex gap-2 mt-1">
                    {['OD', 'OS', 'OU'].map(lat => (
                      <button
                        key={lat}
                        onClick={() => updateSection('complaint', { ...data.complaint, laterality: lat })}
                        className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition ${
                          data.complaint?.laterality === lat
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {lat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Vitals (Collapsible) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('vitals')}
            className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-red-50 to-pink-50 border-b border-gray-200"
          >
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-600" />
              Signes Vitaux
              {data.vitals?.bloodPressure && (
                <span className="text-xs font-normal text-gray-500 ml-2">
                  TA: {data.vitals.bloodPressure}
                </span>
              )}
            </h2>
            {expandedSections.vitals ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>

          {expandedSections.vitals && (
            <div className="p-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Tension artérielle</label>
                  <input
                    type="text"
                    value={data.vitals?.bloodPressure || ''}
                    onChange={(e) => updateSection('vitals', { ...data.vitals, bloodPressure: e.target.value })}
                    placeholder="120/80"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fréquence cardiaque</label>
                  <input
                    type="number"
                    value={data.vitals?.heartRate || ''}
                    onChange={(e) => updateSection('vitals', { ...data.vitals, heartRate: e.target.value })}
                    placeholder="72"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Température (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={data.vitals?.temperature || ''}
                    onChange={(e) => updateSection('vitals', { ...data.vitals, temperature: e.target.value })}
                    placeholder="37.0"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">SpO2 (%)</label>
                  <input
                    type="number"
                    value={data.vitals?.oxygenSaturation || ''}
                    onChange={(e) => updateSection('vitals', { ...data.vitals, oxygenSaturation: e.target.value })}
                    placeholder="98"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Refraction Module */}
        <div className={expandedSections.refraction ? '' : 'opacity-75'}>
          <button
            onClick={() => toggleSection('refraction')}
            className="w-full mb-2 flex items-center justify-between text-left"
          >
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <Glasses className="h-5 w-5 text-purple-600" />
              Module Réfraction
            </h2>
            {expandedSections.refraction ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
          {expandedSections.refraction && (
            <RefractionPanel
              data={data.refraction}
              onChange={(refraction) => updateSection('refraction', refraction)}
              patient={patient}
            />
          )}
        </div>

        {/* Section 4: Examination Module */}
        <div className={expandedSections.examination ? '' : 'opacity-75'}>
          <button
            onClick={() => toggleSection('examination')}
            className="w-full mb-2 flex items-center justify-between text-left"
          >
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <Search className="h-5 w-5 text-green-600" />
              Module Examen Clinique
            </h2>
            {expandedSections.examination ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
          {expandedSections.examination && (
            <ExaminationPanel
              data={data.examination}
              onChange={(examination) => updateSection('examination', examination)}
              patient={patient}
            />
          )}
        </div>

        {/* Section 4.5: Orthoptic Summary */}
        <OrthopticSummaryCard
          patientId={patient?._id || patient?.id}
          className="shadow-sm"
        />

        {/* Section 5: Diagnostic Module */}
        <div className={expandedSections.diagnostic ? '' : 'opacity-75'}>
          <button
            onClick={() => toggleSection('diagnostic')}
            className="w-full mb-2 flex items-center justify-between text-left"
          >
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-orange-600" />
              Module Diagnostic & Examens
            </h2>
            {expandedSections.diagnostic ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
          {expandedSections.diagnostic && (
            <DiagnosticPanel
              data={data.diagnostic}
              onChange={(diagnostic) => updateSection('diagnostic', diagnostic)}
              patient={patient}
            />
          )}
        </div>

        {/* Section 6: Prescription Module */}
        <div className={expandedSections.prescription ? '' : 'opacity-75'}>
          <button
            onClick={() => toggleSection('prescription')}
            className="w-full mb-2 flex items-center justify-between text-left"
          >
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Module Prescription
            </h2>
            {expandedSections.prescription ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
          {expandedSections.prescription && (
            <PrescriptionModule
              data={data.prescription}
              onChange={(prescription) => updateSection('prescription', prescription)}
              refractionData={data.refraction}
              commonMedications={commonMedications}
              loadingMedications={loadingMedications}
            />
          )}
        </div>

        {/* Section 7: Summary */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-gray-600" />
              Résumé de la Consultation
            </h2>
          </div>
          <div className="p-4">
            <ConsultationSummary data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Ophthalmic route configuration
const OPHTHALMIC_CATEGORIES = ['Collyres', 'Anti-inflammatoires', 'Antibiotiques', 'Larmes artificielles', 'Anti-glaucomateux', 'Mydriatiques'];
const OPHTHALMIC_ROUTES = ['ophthalmic', 'intravitreal', 'subconjunctival', 'periocular', 'intracameral'];

// Categories that may need tapering (corticosteroids)
const TAPERING_CATEGORIES = ['Anti-inflammatoires', 'Corticostéroïdes', 'Stéroïdes'];

// Pre-built tapering templates
const TAPERING_TEMPLATES = [
  {
    id: 'none',
    name: 'Sans dégression',
    schedule: null
  },
  {
    id: 'rapid_7d',
    name: 'Rapide (7 jours)',
    schedule: [
      { days: '1-3', frequency: '4x/jour' },
      { days: '4-5', frequency: '3x/jour' },
      { days: '6-7', frequency: '2x/jour' },
    ]
  },
  {
    id: 'standard_14d',
    name: 'Standard (14 jours)',
    schedule: [
      { days: '1-4', frequency: '4x/jour' },
      { days: '5-8', frequency: '3x/jour' },
      { days: '9-11', frequency: '2x/jour' },
      { days: '12-14', frequency: '1x/jour' },
    ]
  },
  {
    id: 'slow_21d',
    name: 'Progressif (21 jours)',
    schedule: [
      { days: '1-7', frequency: '4x/jour' },
      { days: '8-14', frequency: '3x/jour' },
      { days: '15-18', frequency: '2x/jour' },
      { days: '19-21', frequency: '1x/jour' },
    ]
  },
  {
    id: 'post_surgery',
    name: 'Post-opératoire (28 jours)',
    schedule: [
      { days: '1-7', frequency: '6x/jour' },
      { days: '8-14', frequency: '4x/jour' },
      { days: '15-21', frequency: '3x/jour' },
      { days: '22-28', frequency: '2x/jour' },
    ]
  },
];

// All medication routes with labels
const MEDICATION_ROUTES = [
  { value: 'oral', label: 'Oral', labelFr: 'Voie orale' },
  { value: 'ophthalmic', label: 'Ophthalmic', labelFr: 'Collyre' },
  { value: 'topical', label: 'Topical', labelFr: 'Topique' },
  { value: 'intramuscular', label: 'IM', labelFr: 'Intramusculaire' },
  { value: 'intravenous', label: 'IV', labelFr: 'Intraveineuse' },
  { value: 'subcutaneous', label: 'SC', labelFr: 'Sous-cutanée' },
  { value: 'sublingual', label: 'Sublingual', labelFr: 'Sublinguale' },
  { value: 'intranasal', label: 'Nasal', labelFr: 'Intranasale' },
  { value: 'inhalation', label: 'Inhalation', labelFr: 'Inhalation' },
  { value: 'rectal', label: 'Rectal', labelFr: 'Rectale' },
  { value: 'intravitreal', label: 'Intravitreal', labelFr: 'Intravitréenne' },
  { value: 'subconjunctival', label: 'Subconj', labelFr: 'Sous-conjonctivale' },
  { value: 'periocular', label: 'Periocular', labelFr: 'Périoculaire' },
];

// Prescription Module Component
function PrescriptionModule({ data, onChange, refractionData, commonMedications = [], loadingMedications = false }) {
  const [selectedMedCategory, setSelectedMedCategory] = useState('all');
  const [selectedEye, setSelectedEye] = useState('OU'); // Default to both eyes for ophthalmic
  const [selectedRoute, setSelectedRoute] = useState('oral'); // Default route for non-ophthalmic
  const [selectedTapering, setSelectedTapering] = useState('none'); // Default no tapering

  const prescriptionData = data || {
    type: 'glasses',
    glasses: {
      OD: { sphere: '', cylinder: '', axis: '', add: '' },
      OS: { sphere: '', cylinder: '', axis: '', add: '' },
      pd: { distance: '', near: '' }
    },
    medications: [],
    recommendations: ''
  };

  // Get unique medication categories
  const medicationCategories = ['all', ...new Set(commonMedications.map(med => med.category).filter(Boolean))];

  // Filter medications by selected category
  const filteredMedications = selectedMedCategory === 'all'
    ? commonMedications
    : commonMedications.filter(med => med.category === selectedMedCategory);

  const [activeTab, setActiveTab] = useState('glasses');

  // Copy from subjective refraction
  const copyFromRefraction = () => {
    if (!refractionData?.subjective) return;
    const newData = { ...prescriptionData };
    ['OD', 'OS'].forEach(eye => {
      newData.glasses[eye] = {
        sphere: refractionData.subjective[eye]?.sphere || '',
        cylinder: refractionData.subjective[eye]?.cylinder || '',
        axis: refractionData.subjective[eye]?.axis || '',
        add: refractionData.subjective[eye]?.add || ''
      };
    });
    if (refractionData.subjective.pd) {
      newData.glasses.pd = refractionData.subjective.pd;
    }
    onChange?.(newData);
  };

  const addMedication = (med) => {
    const newData = { ...prescriptionData };
    const isOphthalmic = OPHTHALMIC_CATEGORIES.includes(med.category) || OPHTHALMIC_CATEGORIES.includes(selectedMedCategory);
    const route = isOphthalmic ? 'ophthalmic' : selectedRoute;
    const needsEyeSelection = OPHTHALMIC_ROUTES.includes(route);
    const needsTapering = TAPERING_CATEGORIES.includes(med.category) || TAPERING_CATEGORIES.includes(selectedMedCategory);

    // Get tapering template if selected
    const taperingTemplate = TAPERING_TEMPLATES.find(t => t.id === selectedTapering);

    const newMed = {
      ...med,
      id: Date.now(),
      route,
      ...(needsEyeSelection && {
        applicationLocation: { eye: selectedEye }
      }),
      ...(needsTapering && taperingTemplate?.schedule && {
        taperingSchedule: taperingTemplate.schedule,
        taperingName: taperingTemplate.name
      })
    };

    newData.medications = [...(newData.medications || []), newMed];
    onChange?.(newData);
  };

  // Helper to get route label
  const getRouteLabel = (routeValue) => {
    const route = MEDICATION_ROUTES.find(r => r.value === routeValue);
    return route ? route.labelFr : routeValue;
  };

  const removeMedication = (id) => {
    const newData = { ...prescriptionData };
    newData.medications = newData.medications.filter(m => m.id !== id);
    onChange?.(newData);
  };

  const updateGlasses = (eye, field, value) => {
    const newData = { ...prescriptionData };
    newData.glasses[eye][field] = value;
    onChange?.(newData);
  };

  // Generate sphere/cylinder options
  const sphereOptions = [];
  for (let i = -20; i <= 20; i += 0.25) {
    sphereOptions.push(i.toFixed(2));
  }
  const cylinderOptions = [];
  for (let i = -10; i <= 0; i += 0.25) {
    cylinderOptions.push(i.toFixed(2));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex px-4">
          <button
            onClick={() => setActiveTab('glasses')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'glasses'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Glasses className="h-4 w-4" />
            Lunettes
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'medications'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pill className="h-4 w-4" />
            Médicaments
            {prescriptionData.medications?.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                {prescriptionData.medications.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'glasses' && (
          <div className="space-y-4">
            {/* Copy from refraction button */}
            {refractionData?.subjective && (
              <button
                onClick={copyFromRefraction}
                className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                <Glasses className="h-4 w-4" />
                Copier depuis réfraction subjective
              </button>
            )}

            {/* Glasses prescription */}
            <div className="grid grid-cols-2 gap-4">
              {['OD', 'OS'].map(eye => (
                <div key={eye} className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-semibold text-purple-600 mb-3">{eye}</div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Sphère</label>
                      <select
                        value={prescriptionData.glasses?.[eye]?.sphere || ''}
                        onChange={(e) => updateGlasses(eye, 'sphere', e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">--</option>
                        {sphereOptions.map(opt => (
                          <option key={opt} value={opt}>{opt > 0 ? `+${opt}` : opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Cylindre</label>
                      <select
                        value={prescriptionData.glasses?.[eye]?.cylinder || ''}
                        onChange={(e) => updateGlasses(eye, 'cylinder', e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">--</option>
                        {cylinderOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Axe</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        value={prescriptionData.glasses?.[eye]?.axis || ''}
                        onChange={(e) => updateGlasses(eye, 'axis', e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                        placeholder="°"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Addition</label>
                      <select
                        value={prescriptionData.glasses?.[eye]?.add || ''}
                        onChange={(e) => updateGlasses(eye, 'add', e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">--</option>
                        {['+0.75', '+1.00', '+1.25', '+1.50', '+1.75', '+2.00', '+2.25', '+2.50', '+2.75', '+3.00'].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* PD */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500">EP Distance</label>
                <input
                  type="number"
                  value={prescriptionData.glasses?.pd?.distance || ''}
                  onChange={(e) => {
                    const newData = { ...prescriptionData };
                    newData.glasses.pd = { ...newData.glasses.pd, distance: e.target.value };
                    onChange?.(newData);
                  }}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="63"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">EP Près</label>
                <input
                  type="number"
                  value={prescriptionData.glasses?.pd?.near || ''}
                  onChange={(e) => {
                    const newData = { ...prescriptionData };
                    newData.glasses.pd = { ...newData.glasses.pd, near: e.target.value };
                    onChange?.(newData);
                  }}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="60"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="space-y-4">
            {/* Selected medications */}
            {prescriptionData.medications?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Médicaments prescrits</h4>
                {prescriptionData.medications.map(med => (
                  <div key={med.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{med.name}</span>
                          {med.route && (
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              med.route === 'oral' ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {getRouteLabel(med.route)}
                            </span>
                          )}
                          {med.applicationLocation?.eye && (
                            <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-medium">
                              {med.applicationLocation.eye}
                            </span>
                          )}
                          {med.taperingName && (
                            <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                              ↘ {med.taperingName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{med.dose}</div>
                      </div>
                      <button
                        onClick={() => removeMedication(med.id)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        &times;
                      </button>
                    </div>
                    {/* Tapering schedule details */}
                    {med.taperingSchedule && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-amber-700 font-medium mb-1">Schéma de dégression:</div>
                        <div className="flex flex-wrap gap-1">
                          {med.taperingSchedule.map((step, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs bg-amber-50 text-amber-600 rounded">
                              J{step.days}: {step.frequency}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Common medications */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Médicaments courants</h4>

              {/* Category filter buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                {medicationCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedMedCategory(category)}
                    className={`px-3 py-1 text-xs rounded-full transition ${
                      selectedMedCategory === category
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category === 'all' ? 'Tous' : category}
                  </button>
                ))}
              </div>

              {/* Eye selection for ophthalmic medications */}
              {OPHTHALMIC_CATEGORIES.includes(selectedMedCategory) && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                  <span className="text-xs text-blue-700 font-medium">Œil:</span>
                  {['OD', 'OS', 'OU'].map(eye => (
                    <button
                      key={eye}
                      onClick={() => setSelectedEye(eye)}
                      className={`px-3 py-1 text-xs rounded-full transition ${
                        selectedEye === eye
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {eye === 'OD' ? 'OD (Droit)' : eye === 'OS' ? 'OS (Gauche)' : 'OU (Les deux)'}
                    </button>
                  ))}
                </div>
              )}

              {/* Tapering selection for anti-inflammatory medications */}
              {TAPERING_CATEGORIES.includes(selectedMedCategory) && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg flex-wrap">
                  <span className="text-xs text-amber-700 font-medium">Dégression:</span>
                  {TAPERING_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTapering(template.id)}
                      className={`px-3 py-1 text-xs rounded-full transition ${
                        selectedTapering === template.id
                          ? 'bg-amber-600 text-white'
                          : 'bg-white border border-amber-200 text-amber-600 hover:bg-amber-100'
                      }`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Route selection for non-ophthalmic medications */}
              {!OPHTHALMIC_CATEGORIES.includes(selectedMedCategory) && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-purple-50 rounded-lg flex-wrap">
                  <span className="text-xs text-purple-700 font-medium">Voie:</span>
                  {MEDICATION_ROUTES.slice(0, 6).map(route => (
                    <button
                      key={route.value}
                      onClick={() => {
                        setSelectedRoute(route.value);
                        // If selecting an ophthalmic route, also show eye selector
                        if (OPHTHALMIC_ROUTES.includes(route.value)) {
                          setSelectedEye('OU');
                        }
                      }}
                      className={`px-3 py-1 text-xs rounded-full transition ${
                        selectedRoute === route.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border border-purple-200 text-purple-600 hover:bg-purple-100'
                      }`}
                    >
                      {route.labelFr}
                    </button>
                  ))}
                  <select
                    value={selectedRoute}
                    onChange={(e) => {
                      setSelectedRoute(e.target.value);
                      if (OPHTHALMIC_ROUTES.includes(e.target.value)) {
                        setSelectedEye('OU');
                      }
                    }}
                    className="px-2 py-1 text-xs border border-purple-200 rounded-lg bg-white text-purple-700"
                  >
                    {MEDICATION_ROUTES.map(route => (
                      <option key={route.value} value={route.value}>{route.labelFr}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Eye selection when ophthalmic route selected for non-ophthalmic category */}
              {!OPHTHALMIC_CATEGORIES.includes(selectedMedCategory) && OPHTHALMIC_ROUTES.includes(selectedRoute) && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                  <span className="text-xs text-blue-700 font-medium">Œil:</span>
                  {['OD', 'OS', 'OU'].map(eye => (
                    <button
                      key={eye}
                      onClick={() => setSelectedEye(eye)}
                      className={`px-3 py-1 text-xs rounded-full transition ${
                        selectedEye === eye
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {eye === 'OD' ? 'OD (Droit)' : eye === 'OS' ? 'OS (Gauche)' : 'OU (Les deux)'}
                    </button>
                  ))}
                </div>
              )}

              {/* Medications grid - scrollable */}
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {loadingMedications ? (
                  <div className="col-span-2 text-center py-4 text-gray-500 text-sm">
                    Chargement des médicaments...
                  </div>
                ) : filteredMedications.length === 0 ? (
                  <div className="col-span-2 text-center py-4 text-gray-500 text-sm">
                    Aucun médicament dans cette catégorie
                  </div>
                ) : (
                  filteredMedications.map(med => (
                    <button
                      key={med.name}
                      onClick={() => addMedication(med)}
                      disabled={prescriptionData.medications?.find(m => m.name === med.name)}
                      className="text-left p-2 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <div className="text-sm font-medium text-gray-900">{med.name}</div>
                      {med.dose && <div className="text-xs text-gray-500">{med.dose}</div>}
                      <div className="text-xs text-indigo-600 font-medium mt-1">{med.category}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="text-xs text-gray-500 font-medium">Recommandations / Notes</label>
          <textarea
            value={prescriptionData.recommendations || ''}
            onChange={(e) => onChange?.({ ...prescriptionData, recommendations: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg resize-none"
            rows={2}
            placeholder="Instructions particulières, RDV de suivi..."
          />
        </div>
      </div>
    </div>
  );
}

// Consultation Summary Component
function ConsultationSummary({ data }) {
  const hasRefraction = data.refraction?.subjective?.OD?.sphere || data.refraction?.subjective?.OS?.sphere;
  const hasIOP = data.examination?.iop?.OD?.value || data.examination?.iop?.OS?.value;
  const hasDiagnoses = data.diagnostic?.diagnoses?.length > 0;
  const hasProcedures = data.diagnostic?.procedures?.length > 0;
  const hasLab = data.diagnostic?.laboratory?.length > 0;
  const hasPrescription = data.prescription?.glasses?.OD?.sphere || data.prescription?.medications?.length > 0;

  const formatRefraction = (eye) => {
    const r = data.refraction?.subjective?.[eye];
    if (!r?.sphere) return '--';
    return `${r.sphere > 0 ? '+' : ''}${r.sphere} ${r.cylinder || ''} x ${r.axis || ''}°`;
  };

  return (
    <div className="grid grid-cols-2 gap-6 text-sm">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Complaint */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Motif</h4>
          <p className="text-gray-900">{data.complaint?.motif || 'Non renseigné'}</p>
          {data.complaint?.duration && (
            <p className="text-xs text-gray-500">Durée: {data.complaint.duration}</p>
          )}
        </div>

        {/* Refraction */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Réfraction</h4>
          {hasRefraction ? (
            <div className="space-y-1">
              <p className="text-gray-900">OD: {formatRefraction('OD')}</p>
              <p className="text-gray-900">OS: {formatRefraction('OS')}</p>
            </div>
          ) : (
            <p className="text-gray-400">Non effectuée</p>
          )}
        </div>

        {/* IOP */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">PIO</h4>
          {hasIOP ? (
            <p className="text-gray-900">
              OD: {data.examination?.iop?.OD?.value || '--'} mmHg |
              OS: {data.examination?.iop?.OS?.value || '--'} mmHg
            </p>
          ) : (
            <p className="text-gray-400">Non mesurée</p>
          )}
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        {/* Diagnoses */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Diagnostics</h4>
          {hasDiagnoses ? (
            <ul className="space-y-1">
              {data.diagnostic.diagnoses.map((dx, i) => (
                <li key={i} className="text-gray-900 flex items-center gap-1">
                  {dx.isPrimary && <span className="text-yellow-500">★</span>}
                  {dx.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Aucun</p>
          )}
        </div>

        {/* Procedures & Lab */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Examens demandés</h4>
          {hasProcedures || hasLab ? (
            <div className="flex flex-wrap gap-1">
              {data.diagnostic?.procedures?.map((p, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {p.code}
                </span>
              ))}
              {data.diagnostic?.laboratory?.map((l, i) => (
                <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  {l.code}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Aucun</p>
          )}
        </div>

        {/* Prescription */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Prescription</h4>
          {hasPrescription ? (
            <div className="space-y-1">
              {data.prescription?.glasses?.OD?.sphere && (
                <p className="text-gray-900 text-xs">Lunettes prescrites</p>
              )}
              {data.prescription?.medications?.length > 0 && (
                <p className="text-gray-900 text-xs">
                  {data.prescription.medications.length} médicament(s)
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400">Aucune</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getDefaultData() {
  return {
    complaint: { motif: '', duration: '', laterality: '' },
    vitals: {},
    refraction: {},
    examination: {},
    diagnostic: { diagnoses: [], procedures: [], surgery: [], laboratory: [] },
    prescription: { type: 'glasses', glasses: { OD: {}, OS: {}, pd: {} }, medications: [] }
  };
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatTime(date) {
  if (!date) return '';
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function validateData(data) {
  const errors = [];
  if (!data.complaint?.motif) {
    errors.push('- Motif de consultation requis');
  }
  // Diagnosis is recommended but not required
  // if (!data.diagnostic?.diagnoses?.length) {
  //   errors.push('- Au moins un diagnostic requis');
  // }
  return errors;
}
