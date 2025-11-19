import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glasses, Eye, FileText, Printer, Send, Check, Package, X, MessageSquare, FileEdit, Pill } from 'lucide-react';
import { formatPrescription, calculateReadingAdd, vertexCorrection } from '../../../utils/ophthalmologyCalculations';
import { spectacleLensOptions, contactLensOptions, frameOptions } from '../../../data/ophthalmologyData';
import commentTemplateService from '../../../services/commentTemplateService';
import ophthalmologyService from '../../../services/ophthalmologyService';
import QuickTreatmentBuilder from '../../../components/QuickTreatmentBuilder';
import MedicationTemplateSelector from '../../../components/MedicationTemplateSelector';

export default function PrescriptionStep({ data, setData, patient, patientId }) {
  const navigate = useNavigate();
  const [prescriptionType, setPrescriptionType] = useState('glasses');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showVertexCorrection, setShowVertexCorrection] = useState(false);

  // New state for prescription status and lens types
  const [prescriptionStatus, setPrescriptionStatus] = useState('pending');
  const [selectedLensTypes, setSelectedLensTypes] = useState([]);
  const [showPrescriptionPreview, setShowPrescriptionPreview] = useState(false);

  // Tab state for switching between optical and medication prescriptions
  const [activeTab, setActiveTab] = useState('optical'); // 'optical' | 'medication'
  const [medicationList, setMedicationList] = useState([]);

  // Comment templates and summaries
  const [commentTemplates, setCommentTemplates] = useState([]);
  const [selectedCommentTemplate, setSelectedCommentTemplate] = useState('');
  const [customComment, setCustomComment] = useState('');
  const [refractionSummary, setRefractionSummary] = useState('');
  const [keratometrySummary, setKeratometrySummary] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Lens types from the screenshot
  const LENS_TYPES = [
    { value: 'far', label: 'Loin', description: 'Vision de loin uniquement' },
    { value: 'near', label: 'Près', description: 'Vision de près uniquement' },
    { value: 'two_pairs', label: 'Deux Paires', description: 'Loin + Près séparés' },
    { value: 'progressive', label: 'Progressif', description: 'Vision progressive' },
    { value: 'bifocal', label: 'Bifocaux', description: 'Double foyer' },
    { value: 'varifocal', label: 'Varifocal', description: 'Multifocal' }
  ];

  // Extended prescription options - Fermer style
  const USAGE_TYPES = [
    { value: 'constant', label: 'Port Constant', description: 'À porter en permanence' },
    { value: 'intermittent', label: 'Port Intermittent', description: 'À porter selon les besoins' },
    { value: 'distance', label: 'Vision de Loin', description: 'Pour voir de loin uniquement' },
    { value: 'near', label: 'Vision de Près', description: 'Pour voir de près uniquement' },
    { value: 'driving', label: 'Conduite', description: 'Spécialement pour la conduite' },
    { value: 'computer', label: 'Travail sur Écran', description: 'Pour ordinateur/tablette' }
  ];

  const ACTIVITY_USES = [
    { value: 'school', label: 'Pour École', icon: '📚' },
    { value: 'tv', label: 'Pour TV', icon: '📺' },
    { value: 'homework', label: 'Pour Devoirs', icon: '✏️' },
    { value: 'computer', label: 'Pour Écran', icon: '💻' },
    { value: 'driving', label: 'Pour Conduite', icon: '🚗' },
    { value: 'sports', label: 'Pour Sport', icon: '⚽' },
    { value: 'reading', label: 'Pour Lecture', icon: '📖' },
    { value: 'all_day', label: 'Toute la Journée', icon: '☀️' }
  ];

  const LENS_MATERIALS = [
    { value: 'organic', label: 'Verres Organiques', description: 'Légers et résistants aux chocs' },
    { value: 'mineral', label: 'Verres Minéraux', description: 'Résistants aux rayures' },
    { value: 'polycarbonate', label: 'Polycarbonate', description: 'Ultra-résistant aux impacts' },
    { value: 'trivex', label: 'Trivex', description: 'Léger avec haute qualité optique' }
  ];

  const LENS_FEATURES = [
    { value: 'photochromic', label: 'Photochromiques', description: 'S\'assombrissent au soleil' },
    { value: 'tinted', label: 'Teintés', description: 'Couleur permanente' },
    { value: 'polarized', label: 'Polarisés', description: 'Réduction des reflets' },
    { value: 'blue_filter', label: 'Filtre Lumière Bleue', description: 'Protection écrans' },
    { value: 'anti_reflective', label: 'Anti-Reflet', description: 'Réduction des reflets' },
    { value: 'anti_scratch', label: 'Anti-Rayures', description: 'Protection surface' },
    { value: 'hydrophobic', label: 'Hydrophobe', description: 'Anti-gouttes et anti-traces' },
    { value: 'thin', label: 'Aminci', description: 'Verres plus fins et esthétiques' }
  ];

  const LENS_INDEX = [
    { value: '1.5', label: 'Indice 1.5', description: 'Standard' },
    { value: '1.56', label: 'Indice 1.56', description: 'Aminci léger' },
    { value: '1.6', label: 'Indice 1.6', description: 'Aminci' },
    { value: '1.67', label: 'Indice 1.67', description: 'Très aminci' },
    { value: '1.74', label: 'Indice 1.74', description: 'Ultra aminci' }
  ];

  const PRESCRIPTION_TEMPLATES = [
    {
      id: 'standard',
      label: 'Standard',
      text: 'Port permanent recommandé. Contrôle à 1 an.'
    },
    {
      id: 'first_time',
      label: 'Première Prescription',
      text: 'Première correction optique. Port progressif conseillé les premiers jours. Contrôle à 3 mois pour vérifier l\'adaptation.'
    },
    {
      id: 'progressive_adaptation',
      label: 'Adaptation Progressifs',
      text: 'Verres progressifs. Période d\'adaptation de 2-3 semaines normale. Bouger la tête plutôt que les yeux pour la vision périphérique.'
    },
    {
      id: 'child',
      label: 'Enfant',
      text: 'Port permanent obligatoire, y compris à l\'école. Prévoir monture solide avec branches flexibles. Contrôle tous les 6 mois.'
    },
    {
      id: 'computer',
      label: 'Travail sur Écran',
      text: 'Verres spécial écran recommandés. Faire des pauses régulières (règle 20-20-20). Traitement anti-lumière bleue conseillé.'
    },
    {
      id: 'driving',
      label: 'Conduite',
      text: 'Port obligatoire pour la conduite. Traitement antireflet recommandé. Éviter les verres photochromiques pour conduite de nuit.'
    }
  ];

  // Extended prescription state
  const [selectedUsageType, setSelectedUsageType] = useState('constant');
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('organic');
  const [selectedFeatures, setSelectedFeatures] = useState(['anti_reflective']);
  const [selectedIndex, setSelectedIndex] = useState('1.5');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');

  const toggleActivity = (activity) => {
    setSelectedActivities(prev =>
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    );
  };

  const toggleFeature = (feature) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const applyTemplate = (templateId) => {
    const template = PRESCRIPTION_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setPrescriptionNotes(template.text);
      setSelectedTemplate(templateId);
    }
  };

  const toggleLensType = (type) => {
    setSelectedLensTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Load comment templates on mount
  useEffect(() => {
    const loadCommentTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const response = await commentTemplateService.getCommentTemplates();
        if (response.data) {
          setCommentTemplates(response.data);
        }
      } catch (error) {
        console.error('Error loading comment templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadCommentTemplates();
  }, []);

  // Handle comment template selection
  const handleCommentSelect = async (e) => {
    const templateId = e.target.value;
    setSelectedCommentTemplate(templateId);

    if (templateId) {
      const template = commentTemplates.find(t => t._id === templateId);
      if (template) {
        setCustomComment(template.text);
        // Increment usage count
        try {
          await commentTemplateService.incrementUsage(templateId);
        } catch (error) {
          console.error('Error incrementing template usage:', error);
        }
      }
    }
  };

  // Generate refraction summary
  const handleGenerateRefractionSummary = async () => {
    if (!data.examId) {
      alert('Veuillez d\'abord sauvegarder l\'examen');
      return;
    }

    try {
      setGeneratingSummary(true);
      const response = await ophthalmologyService.generateRefractionSummary(data.examId);
      if (response.data && response.data.summary) {
        setRefractionSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error generating refraction summary:', error);
      alert('Erreur lors de la génération du résumé de réfraction');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Generate keratometry summary
  const handleGenerateKeratometrySummary = async () => {
    if (!data.examId) {
      alert('Veuillez d\'abord sauvegarder l\'examen');
      return;
    }

    try {
      setGeneratingSummary(true);
      const response = await ophthalmologyService.generateKeratometrySummary(data.examId);
      if (response.data && response.data.summary) {
        setKeratometrySummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error generating keratometry summary:', error);
      alert('Erreur lors de la génération du résumé de kératométrie');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Calculate reading addition if needed
  const readingAdd = patient?.age >= 40 ? calculateReadingAdd(patient.age) : null;

  // Apply vertex correction for contact lenses
  const getContactLensPrescription = () => {
    const odSphere = parseFloat(data.subjective.OD.sphere);
    const osSphere = parseFloat(data.subjective.OS.sphere);

    return {
      OD: {
        sphere: vertexCorrection(odSphere, 0), // 0mm vertex distance for contacts
        cylinder: data.subjective.OD.cylinder,
        axis: data.subjective.OD.axis
      },
      OS: {
        sphere: vertexCorrection(osSphere, 0),
        cylinder: data.subjective.OS.cylinder,
        axis: data.subjective.OS.axis
      }
    };
  };

  // Generate final prescription
  const generatePrescription = () => {
    const prescription = {
      ...data.finalPrescription,
      OD: { ...data.subjective.OD },
      OS: { ...data.subjective.OS },
      add: readingAdd?.recommended || 0,
      prescriptionType,

      // Additional information
      examDate: new Date().toISOString(),
      examiner: data.examiner,
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year

      // Measurements
      pupilDistance: data.pupilDistance,
      visualAcuity: data.visualAcuity,

      // Recommendations
      recommendations: []
    };

    // Add recommendations based on findings
    if (Math.abs(prescription.OD.sphere - prescription.OS.sphere) > 2) {
      prescription.recommendations.push('Anisométropie significative - Considérer lentilles de contact');
    }

    if (patient?.age >= 40 && !prescription.add) {
      prescription.recommendations.push('Presbytie possible - Évaluer besoin de correction de près');
    }

    if (Math.abs(prescription.OD.cylinder) > 2 || Math.abs(prescription.OS.cylinder) > 2) {
      prescription.recommendations.push('Astigmatisme élevé - Verres toriques recommandés');
    }

    setData(prev => ({
      ...prev,
      finalPrescription: prescription
    }));

    return prescription;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendToPatient = () => {
    alert('Prescription envoyée au patient par SMS/Email');
  };

  const handleCreateInvoice = () => {
    navigate(`/invoicing?patientId=${patient?.id}&type=optical&products=${JSON.stringify(selectedProducts)}`);
  };

  // Handle medication added from QuickTreatmentBuilder
  const handleMedicationAdd = (medication) => {
    setMedicationList(prev => [...prev, medication]);
  };

  // Handle prescription completion
  const handlePrescriptionComplete = (medications) => {
    console.log('Prescription complete:', medications);
    // Save to data or backend
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Glasses className="w-5 h-5 mr-2 text-blue-600" />
        Prescription Finale
      </h2>

      {/* Tab Navigation */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('optical')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'optical'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Glasses className="w-4 h-4" />
          Ordonnance Optique
        </button>
        <button
          onClick={() => setActiveTab('medication')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'medication'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Pill className="w-4 h-4" />
          Traitement Médical
        </button>
      </div>

      {/* Medication Tab - Fermer-style Template Selector */}
      {activeTab === 'medication' && (
        <div className="mb-6">
          {/* Current Medications List */}
          {medicationList.length > 0 && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">Médicaments prescrits ({medicationList.length})</h4>
              <div className="space-y-2">
                {medicationList.map((med, index) => (
                  <div key={med.id || index} className="flex items-center justify-between bg-white p-2 rounded border">
                    <div>
                      <span className="font-medium">{med.name}</span>
                      <span className="text-gray-500 text-sm ml-2">
                        {med.dosage} - {med.duration}
                      </span>
                    </div>
                    <button
                      onClick={() => setMedicationList(prev => prev.filter((_, i) => i !== index))}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fermer-style Medication Selector */}
          <div className="border rounded-lg h-[500px] overflow-hidden">
            <MedicationTemplateSelector
              onAddMedication={(med) => setMedicationList(prev => [...prev, med])}
            />
          </div>

          {/* QuickTreatmentBuilder (Alternative) */}
          <div className="mt-4 pt-4 border-t">
            <details className="group">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                Mode alternatif (QuickTreatmentBuilder)
              </summary>
              <div className="mt-3">
                <QuickTreatmentBuilder
                  patientId={patientId || patient?._id}
                  onMedicationAdd={handleMedicationAdd}
                  onPrescriptionComplete={handlePrescriptionComplete}
                  existingMedications={medicationList}
                />
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Optical Tab - Existing Prescription Content */}
      {activeTab === 'optical' && (
        <>
      {/* Prescription Status Buttons */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-700 mb-3">Statut de la Prescription</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setPrescriptionStatus('prescribed')}
            className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
              prescriptionStatus === 'prescribed'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-green-500'
            }`}
          >
            Verres Prescrits
          </button>
          <button
            onClick={() => setPrescriptionStatus('not_prescribed')}
            className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
              prescriptionStatus === 'not_prescribed'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-red-500'
            }`}
          >
            Verres non Prescrits
          </button>
          <button
            onClick={() => setPrescriptionStatus('external')}
            className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
              prescriptionStatus === 'external'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-500'
            }`}
          >
            Externe...
          </button>
          <button
            onClick={() => setPrescriptionStatus('renewed')}
            className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
              prescriptionStatus === 'renewed'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
            }`}
          >
            Renouvellement
          </button>
        </div>
      </div>

      {/* Lens Type Selection */}
      {prescriptionStatus === 'prescribed' && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">Type de Verres</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {LENS_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => toggleLensType(type.value)}
                className={`px-4 py-3 rounded-lg text-left transition-all ${
                  selectedLensTypes.includes(type.value)
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
                }`}
              >
                <div className="font-medium">{type.label}</div>
                <div className="text-xs mt-1 opacity-80">{type.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prescription Type Selector */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => setPrescriptionType('glasses')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            prescriptionType === 'glasses' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Glasses className="w-4 h-4 mr-2" />
          Lunettes
        </button>
        <button
          onClick={() => setPrescriptionType('contacts')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            prescriptionType === 'contacts' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Lentilles
        </button>
        <button
          onClick={() => setPrescriptionType('both')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            prescriptionType === 'both' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4 mr-2" />
          Les Deux
        </button>
      </div>

      {/* Extended Prescription Options - Fermer Style */}
      {prescriptionType === 'glasses' && prescriptionStatus === 'prescribed' && (
        <>
          {/* Usage Type Selection */}
          <div className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <h3 className="font-semibold text-indigo-900 mb-3">Type de Port</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {USAGE_TYPES.map((usage) => (
                <button
                  key={usage.value}
                  onClick={() => setSelectedUsageType(usage.value)}
                  className={`px-3 py-2 rounded-lg text-left text-sm transition-all ${
                    selectedUsageType === usage.value
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-500'
                  }`}
                >
                  <div className="font-medium">{usage.label}</div>
                  <div className="text-xs mt-0.5 opacity-80">{usage.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Activity-Specific Uses */}
          <div className="mb-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-3">Activités Spécifiques</h3>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_USES.map((activity) => (
                <button
                  key={activity.value}
                  onClick={() => toggleActivity(activity.value)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1 ${
                    selectedActivities.includes(activity.value)
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-amber-500'
                  }`}
                >
                  <span>{activity.icon}</span>
                  <span>{activity.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lens Material & Index */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Material */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-900 mb-3">Matériau des Verres</h3>
              <div className="space-y-2">
                {LENS_MATERIALS.map((material) => (
                  <label
                    key={material.value}
                    className={`flex items-start p-2 rounded-lg cursor-pointer transition-all ${
                      selectedMaterial === material.value
                        ? 'bg-green-600 text-white'
                        : 'bg-white hover:bg-green-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="lens_material"
                      value={material.value}
                      checked={selectedMaterial === material.value}
                      onChange={(e) => setSelectedMaterial(e.target.value)}
                      className="mt-1 mr-2"
                    />
                    <div>
                      <div className="font-medium text-sm">{material.label}</div>
                      <div className={`text-xs ${selectedMaterial === material.value ? 'text-green-100' : 'text-gray-500'}`}>
                        {material.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Index */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-purple-900 mb-3">Indice de Réfraction</h3>
              <div className="space-y-2">
                {LENS_INDEX.map((index) => (
                  <label
                    key={index.value}
                    className={`flex items-center p-2 rounded-lg cursor-pointer transition-all ${
                      selectedIndex === index.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-white hover:bg-purple-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="lens_index"
                      value={index.value}
                      checked={selectedIndex === index.value}
                      onChange={(e) => setSelectedIndex(e.target.value)}
                      className="mr-2"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-sm">{index.label}</span>
                      <span className={`text-xs ml-2 ${selectedIndex === index.value ? 'text-purple-100' : 'text-gray-500'}`}>
                        ({index.description})
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Lens Features */}
          <div className="mb-6 bg-cyan-50 p-4 rounded-lg border border-cyan-200">
            <h3 className="font-semibold text-cyan-900 mb-3">Traitements et Options</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {LENS_FEATURES.map((feature) => (
                <label
                  key={feature.value}
                  className={`flex items-start p-2 rounded-lg cursor-pointer transition-all text-sm ${
                    selectedFeatures.includes(feature.value)
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white hover:bg-cyan-100 border border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(feature.value)}
                    onChange={() => toggleFeature(feature.value)}
                    className="mt-0.5 mr-2"
                  />
                  <div>
                    <div className="font-medium">{feature.label}</div>
                    <div className={`text-xs ${selectedFeatures.includes(feature.value) ? 'text-cyan-100' : 'text-gray-500'}`}>
                      {feature.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Prescription Templates */}
          <div className="mb-6 bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h3 className="font-semibold text-orange-900 mb-3">Instructions Modèles</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESCRIPTION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selectedTemplate === template.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-orange-500'
                  }`}
                >
                  {template.label}
                </button>
              ))}
            </div>
            <textarea
              value={prescriptionNotes}
              onChange={(e) => setPrescriptionNotes(e.target.value)}
              placeholder="Instructions pour le patient..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              rows="3"
            />
          </div>
        </>
      )}

      {/* Prescription Display */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg">Prescription de Réfraction</h3>
            <p className="text-sm text-gray-600 mt-1">
              Patient: {patient?.firstName} {patient?.lastName} | Âge: {patient?.age} ans
            </p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Date: {new Date().toLocaleDateString('fr-FR')}</p>
            <p>Prescripteur: {data.examiner}</p>
          </div>
        </div>

        {/* Glasses Prescription */}
        {(prescriptionType === 'glasses' || prescriptionType === 'both') && (
          <div className="mb-6">
            <h4 className="font-semibold mb-3 flex items-center text-blue-700">
              <Glasses className="w-4 h-4 mr-2" />
              Correction Lunettes
            </h4>
            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OD:</span>
                    <span className="font-mono text-lg">{formatPrescription(data.subjective).OD}</span>
                  </div>
                  <div className="text-sm text-gray-500 ml-12">
                    AV: {data.subjective.OD.va || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OS:</span>
                    <span className="font-mono text-lg">{formatPrescription(data.subjective).OS}</span>
                  </div>
                  <div className="text-sm text-gray-500 ml-12">
                    AV: {data.subjective.OS.va || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Reading Addition */}
              {readingAdd && patient.age >= 40 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700">Addition VP:</span>
                    <span className="ml-3 font-mono text-lg text-green-600">+{readingAdd.recommended}D</span>
                    <span className="text-sm text-gray-500 ml-3">(Presbytie - {patient.age} ans)</span>
                  </div>
                </div>
              )}

              {/* PD Display */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center">
                  <span className="font-medium text-gray-700">ÉP:</span>
                  <span className="ml-3 font-mono">{data.pupilDistance.binocular}mm</span>
                  <span className="text-sm text-gray-500 ml-3">
                    (OD: {data.pupilDistance.OD}mm | OS: {data.pupilDistance.OS}mm)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Lens Prescription */}
        {(prescriptionType === 'contacts' || prescriptionType === 'both') && (
          <div className="mb-6">
            <h4 className="font-semibold mb-3 flex items-center text-blue-700">
              <Eye className="w-4 h-4 mr-2" />
              Correction Lentilles de Contact
            </h4>

            {/* Vertex Correction Notice */}
            {(Math.abs(data.subjective.OD.sphere) > 4 || Math.abs(data.subjective.OS.sphere) > 4) && (
              <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={showVertexCorrection}
                    onChange={(e) => setShowVertexCorrection(e.target.checked)}
                    className="mr-2"
                  />
                  Appliquer la correction de vertex (Rx &gt; ±4.00D)
                </label>
              </div>
            )}

            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OD:</span>
                    <span className="font-mono text-lg">
                      {showVertexCorrection
                        ? formatPrescription(getContactLensPrescription()).OD
                        : formatPrescription(data.subjective).OD}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OS:</span>
                    <span className="font-mono text-lg">
                      {showVertexCorrection
                        ? formatPrescription(getContactLensPrescription()).OS
                        : formatPrescription(data.subjective).OS}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Lens Parameters */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Courbe de Base</label>
                    <select className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>8.4</option>
                      <option>8.6</option>
                      <option>8.8</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Diamètre</label>
                    <select className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>14.0</option>
                      <option>14.2</option>
                      <option>14.5</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Marque</label>
                    <select className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {contactLensOptions.map(lens => (
                        <option key={lens.brand}>{lens.brand}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product Selection */}
        {prescriptionType === 'glasses' && (
          <div className="mb-6">
            <h4 className="font-semibold mb-3 flex items-center text-blue-700">
              <Package className="w-4 h-4 mr-2" />
              Sélection de Produits
            </h4>
            <div className="bg-white rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type de Verre</label>
                  <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Simple Vision</option>
                    <option>Progressif</option>
                    <option>Bifocal</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Matériau</label>
                  <select className="mt-1 w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {spectacleLensOptions[0].materials.map(material => (
                      <option key={material.name}>
                        {material.name} (n={material.index}) - ${material.price}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-600">Traitements</label>
                <div className="mt-2 space-y-2">
                  {spectacleLensOptions[0].coatings.map(coating => (
                    <label key={coating.name} className="flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, coating]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(p => p.name !== coating.name));
                          }
                        }}
                      />
                      <span className="text-sm">{coating.name} (+${coating.price})</span>
                      <span className="text-xs text-gray-500 ml-2">- {coating.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
            <MessageSquare className="w-4 h-4 mr-2" />
            Commentaires et Notes
          </h3>

          {/* Comment Template Selector */}
          <div className="mb-3">
            <label className="text-sm font-medium text-gray-700">Modèle de commentaire</label>
            <select
              value={selectedCommentTemplate}
              onChange={handleCommentSelect}
              disabled={loadingTemplates}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Sélectionner un modèle --</option>
              {commentTemplates.map(template => (
                <option key={template._id} value={template._id}>
                  [{template.category}] {template.title}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Comment */}
          <div className="mb-3">
            <label className="text-sm font-medium text-gray-700">Commentaire personnalisé</label>
            <textarea
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              rows="3"
              placeholder="Ajouter des notes personnalisées..."
              value={customComment}
              onChange={(e) => setCustomComment(e.target.value)}
            />
          </div>

          {/* Summary Generation Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateRefractionSummary}
              disabled={generatingSummary}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileEdit className="w-4 h-4 mr-2" />
              {generatingSummary ? 'Génération...' : 'Rédiger la réfraction'}
            </button>
            <button
              onClick={handleGenerateKeratometrySummary}
              disabled={generatingSummary}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileEdit className="w-4 h-4 mr-2" />
              {generatingSummary ? 'Génération...' : 'Rédiger la Kératometrie'}
            </button>
          </div>

          {/* Generated Summaries Display */}
          {refractionSummary && (
            <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Résumé de Réfraction</h4>
              <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700">{refractionSummary}</pre>
            </div>
          )}

          {keratometrySummary && (
            <div className="mt-4 p-3 bg-white border border-purple-200 rounded-lg">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">Résumé de Kératométrie</h4>
              <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700">{keratometrySummary}</pre>
            </div>
          )}
        </div>

        {/* Clinical Notes/Recommendations */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700">Recommandations supplémentaires</label>
          <textarea
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="Recommandations supplémentaires..."
            value={data.finalPrescription.recommendations.join('\n')}
            onChange={(e) => setData(prev => ({
              ...prev,
              finalPrescription: {
                ...prev.finalPrescription,
                recommendations: e.target.value.split('\n').filter(r => r.trim())
              }
            }))}
          />
        </div>

        {/* Validity */}
        <div className="text-sm text-gray-600 text-center pt-4 border-t border-gray-200">
          Cette prescription est valide pour 12 mois à partir de la date d'émission
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generatePrescription}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Valider Prescription
          </button>
          <button
            onClick={() => setShowPrescriptionPreview(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            Voir ordon lunettes
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimer lunettes
          </button>
          <button
            onClick={handleSendToPatient}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Envoyer au Patient
          </button>
        </div>

        <button
          onClick={handleCreateInvoice}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Créer Facture
        </button>
      </div>

        </>
      )}

      {/* Prescription Preview Modal */}
      {showPrescriptionPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Aperçu de l'Ordonnance Lunettes</h3>
              <button
                onClick={() => setShowPrescriptionPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Prescription Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-blue-900 mb-2">ORDONNANCE OPTIQUE</h2>
                <div className="text-sm text-gray-600">
                  <p>Dr. {data.examiner}</p>
                  <p>Date: {new Date().toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              {/* Patient Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Informations Patient</h3>
                <p><strong>Nom:</strong> {patient?.firstName} {patient?.lastName}</p>
                <p><strong>Âge:</strong> {patient?.age} ans</p>
                <p><strong>Date de naissance:</strong> {patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('fr-FR') : 'N/A'}</p>
              </div>

              {/* Prescription Details */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3 text-lg border-b pb-2">Correction Prescrite</h3>
                <table className="w-full border-collapse mb-4">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="border border-gray-300 px-4 py-2">Œil</th>
                      <th className="border border-gray-300 px-4 py-2">Sphère</th>
                      <th className="border border-gray-300 px-4 py-2">Cylindre</th>
                      <th className="border border-gray-300 px-4 py-2">Axe</th>
                      <th className="border border-gray-300 px-4 py-2">AV</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">OD (Droit)</td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                        {data.subjective.OD.sphere >= 0 ? '+' : ''}{data.subjective.OD.sphere}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                        {data.subjective.OD.cylinder >= 0 ? '+' : ''}{data.subjective.OD.cylinder}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                        {data.subjective.OD.axis}°
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {data.subjective.OD.va || 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">OG (Gauche)</td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                        {data.subjective.OS.sphere >= 0 ? '+' : ''}{data.subjective.OS.sphere}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                        {data.subjective.OS.cylinder >= 0 ? '+' : ''}{data.subjective.OS.cylinder}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                        {data.subjective.OS.axis}°
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {data.subjective.OS.va || 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {readingAdd && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p><strong>Addition pour la vision de près:</strong> +{readingAdd.recommended}D</p>
                  </div>
                )}

                <div className="mt-3">
                  <p><strong>Écart pupillaire:</strong> {data.pupilDistance.binocular}mm
                    (OD: {data.pupilDistance.OD}mm, OG: {data.pupilDistance.OS}mm)</p>
                </div>
              </div>

              {/* Lens Types */}
              {selectedLensTypes.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold mb-2">Type de Verres Prescrits</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedLensTypes.map(type => {
                      const lensType = LENS_TYPES.find(t => t.value === type);
                      return (
                        <span key={type} className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
                          {lensType?.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {data.finalPrescription.recommendations && data.finalPrescription.recommendations.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Recommandations</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {data.finalPrescription.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validity */}
              <div className="text-center text-sm text-gray-600 border-t pt-4">
                <p className="font-semibold">Cette ordonnance est valide pour 12 mois</p>
                <p className="mt-2">Valid until: {new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}</p>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-sm text-gray-600 mb-4">Signature et cachet du prescripteur</p>
                <div className="h-16 border-t-2 border-gray-800 w-48 mx-auto mt-2"></div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowPrescriptionPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  setShowPrescriptionPreview(false);
                  handlePrint();
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}