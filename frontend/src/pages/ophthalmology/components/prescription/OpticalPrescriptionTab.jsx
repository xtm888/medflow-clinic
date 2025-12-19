/**
 * OpticalPrescriptionTab Component
 *
 * Tab content for optical prescription (glasses/contacts).
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Glasses, Eye, FileText, Printer, Send, Check, CheckCircle,
  Package, MessageSquare, FileEdit, Save, AlertTriangle, Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';
import { formatPrescription, vertexCorrection } from '../../../../utils/ophthalmologyCalculations';
import { spectacleLensOptions, contactLensOptions } from '../../../../data/ophthalmologyData';
import commentTemplateService from '../../../../services/commentTemplateService';
import ophthalmologyService from '../../../../services/ophthalmologyService';
import prescriptionService from '../../../../services/prescriptionService';
import {
  LENS_TYPES,
  USAGE_TYPES,
  ACTIVITY_USES,
  LENS_MATERIALS,
  LENS_FEATURES,
  LENS_INDEX,
  PRESCRIPTION_TEMPLATES
} from './prescriptionConstants';

export default function OpticalPrescriptionTab({
  data,
  onChange,
  patient,
  patientId,
  visitId,
  consultationSessionId,
  readingAdd,
  savedPrescription,
  onPrescriptionSaved,
  onShowPreview
}) {
  const navigate = useNavigate();

  // State
  const [prescriptionType, setPrescriptionType] = useState('glasses');
  const [prescriptionStatus, setPrescriptionStatus] = useState('pending');
  const [selectedLensTypes, setSelectedLensTypes] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showVertexCorrection, setShowVertexCorrection] = useState(false);
  const [saving, setSaving] = useState(false);

  // Extended prescription state
  const [selectedUsageType, setSelectedUsageType] = useState('constant');
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('organic');
  const [selectedFeatures, setSelectedFeatures] = useState(['anti_reflective']);
  const [selectedIndex, setSelectedIndex] = useState('1.5');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');

  // Contact lens parameters state
  const [contactLensParams, setContactLensParams] = useState({
    baseCurve: '8.6',
    diameter: '14.2',
    brand: ''
  });

  // Comment templates and summaries
  const [commentTemplates, setCommentTemplates] = useState([]);
  const [selectedCommentTemplate, setSelectedCommentTemplate] = useState('');
  const [customComment, setCustomComment] = useState('');
  const [refractionSummary, setRefractionSummary] = useState('');
  const [keratometrySummary, setKeratometrySummary] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

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

  // Helpers
  const toggleLensType = (type) => {
    setSelectedLensTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleActivity = (activity) => {
    setSelectedActivities(prev =>
      prev.includes(activity) ? prev.filter(a => a !== activity) : [...prev, activity]
    );
  };

  const toggleFeature = (feature) => {
    setSelectedFeatures(prev =>
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  };

  const applyTemplate = (templateId) => {
    const template = PRESCRIPTION_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setPrescriptionNotes(template.text);
      setSelectedTemplate(templateId);
    }
  };

  // Handle comment template selection
  const handleCommentSelect = async (e) => {
    const templateId = e.target.value;
    setSelectedCommentTemplate(templateId);

    if (templateId) {
      const template = commentTemplates.find(t => t._id === templateId);
      if (template) {
        setCustomComment(template.text);
        try {
          await commentTemplateService.incrementUsage(templateId);
        } catch (error) {
          console.error('Error incrementing template usage:', error);
        }
      }
    }
  };

  // Generate summaries
  const handleGenerateRefractionSummary = async () => {
    if (!data.examId) {
      alert('Veuillez d\'abord sauvegarder l\'examen');
      return;
    }

    try {
      setGeneratingSummary(true);
      const response = await ophthalmologyService.generateRefractionSummary(data.examId);
      if (response.data?.summary) {
        setRefractionSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error generating refraction summary:', error);
      alert('Erreur lors de la génération du résumé de réfraction');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleGenerateKeratometrySummary = async () => {
    if (!data.examId) {
      alert('Veuillez d\'abord sauvegarder l\'examen');
      return;
    }

    try {
      setGeneratingSummary(true);
      const response = await ophthalmologyService.generateKeratometrySummary(data.examId);
      if (response.data?.summary) {
        setKeratometrySummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error generating keratometry summary:', error);
      alert('Erreur lors de la génération du résumé de kératométrie');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Apply vertex correction for contact lenses
  const getContactLensPrescription = () => {
    const odSphere = parseFloat(data.subjective?.OD?.sphere || 0);
    const osSphere = parseFloat(data.subjective?.OS?.sphere || 0);

    return {
      OD: {
        sphere: vertexCorrection(odSphere, 0),
        cylinder: data.subjective?.OD?.cylinder,
        axis: data.subjective?.OD?.axis
      },
      OS: {
        sphere: vertexCorrection(osSphere, 0),
        cylinder: data.subjective?.OS?.cylinder,
        axis: data.subjective?.OS?.axis
      }
    };
  };

  // Generate final prescription
  const generatePrescription = () => {
    const prescription = {
      ...data.finalPrescription,
      OD: { ...(data.subjective?.OD || { sphere: 0, cylinder: 0, axis: 0 }) },
      OS: { ...(data.subjective?.OS || { sphere: 0, cylinder: 0, axis: 0 }) },
      add: readingAdd?.recommended || 0,
      prescriptionType,
      examDate: new Date().toISOString(),
      examiner: data.examiner,
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      pupilDistance: data.pupilDistance,
      visualAcuity: data.visualAcuity,
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

    onChange(prev => ({
      ...prev,
      finalPrescription: prescription
    }));

    return prescription;
  };

  // Save optical prescription
  const handleSaveOpticalPrescription = async () => {
    const pid = patient?._id || patientId;
    if (!pid) {
      toast.error('Patient non identifié');
      return;
    }

    if (prescriptionStatus !== 'prescribed' && prescriptionStatus !== 'renewed') {
      toast.warning('Aucune prescription optique à enregistrer');
      return;
    }

    setSaving(true);
    try {
      const opticalData = {
        patient: pid,
        type: 'optical',
        visit: visitId || null,
        consultationSession: consultationSessionId || null,
        optical: {
          type: prescriptionType,
          OD: {
            sphere: data.subjective?.OD?.sphere || 0,
            cylinder: data.subjective?.OD?.cylinder || 0,
            axis: data.subjective?.OD?.axis || 0,
            add: readingAdd?.recommended || data.subjective?.add || 0
          },
          OS: {
            sphere: data.subjective?.OS?.sphere || 0,
            cylinder: data.subjective?.OS?.cylinder || 0,
            axis: data.subjective?.OS?.axis || 0,
            add: readingAdd?.recommended || data.subjective?.add || 0
          },
          pupilDistance: data.pupilDistance,
          lensType: selectedLensTypes,
          material: selectedMaterial,
          features: selectedFeatures,
          index: selectedIndex,
          usageType: selectedUsageType,
          activities: selectedActivities,
          // Contact lens parameters (when prescriptionType is 'contacts' or 'both')
          ...(prescriptionType !== 'glasses' && {
            contactLens: {
              baseCurve: contactLensParams.baseCurve,
              diameter: contactLensParams.diameter,
              brand: contactLensParams.brand
            }
          })
        },
        notes: prescriptionNotes,
        recommendations: data.finalPrescription?.recommendations || [],
        status: 'active'
      };

      const result = await prescriptionService.createPrescription(opticalData);

      if (result.success !== false) {
        toast.success('Ordonnance optique enregistrée');
        onPrescriptionSaved(result.data || result);

        onChange(prev => ({
          ...prev,
          savedOpticalPrescriptionId: (result.data || result)._id,
          finalPrescription: {
            ...prev.finalPrescription,
            savedAt: new Date().toISOString()
          }
        }));
      } else {
        throw new Error(result.error || 'Échec de l\'enregistrement');
      }
    } catch (error) {
      console.error('Error saving optical prescription:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement de l\'ordonnance optique');
    } finally {
      setSaving(false);
    }
  };

  // Print prescription - uses backend PDF generation
  const handlePrint = async () => {
    if (!savedPrescription?._id) {
      // Fallback to browser print if no saved prescription
      window.print();
      return;
    }

    try {
      const response = await prescriptionService.generatePDF(savedPrescription._id);
      if (response?.data) {
        // Open PDF in new window for printing
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      } else {
        // Fallback to browser print
        window.print();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to browser print on error
      window.print();
    }
  };

  // Send prescription to patient via SMS/Email
  const handleSendToPatient = async () => {
    if (!savedPrescription?._id) {
      toast.warning('Veuillez d\'abord enregistrer l\'ordonnance');
      return;
    }

    try {
      const response = await prescriptionService.sendToPatient(savedPrescription._id, {
        method: 'email', // or 'sms' based on patient preference
        patientId: patient?._id || patientId
      });

      if (response?.success !== false) {
        toast.success('Ordonnance envoyée au patient');
      } else {
        throw new Error(response?.error || 'Échec de l\'envoi');
      }
    } catch (error) {
      console.error('Error sending prescription:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi de l\'ordonnance');
    }
  };

  // Navigate to invoice creation with correct patient ID
  const handleCreateInvoice = () => {
    const pid = patient?._id || patientId;
    if (!pid) {
      toast.error('Patient non identifié');
      return;
    }
    navigate(`/invoicing?patientId=${pid}&type=optical&products=${JSON.stringify(selectedProducts)}`);
  };

  return (
    <>
      {/* Prescription Status Buttons */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-700 mb-3">Statut de la Prescription</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'prescribed', label: 'Verres Prescrits', color: 'green' },
            { value: 'not_prescribed', label: 'Verres non Prescrits', color: 'red' },
            { value: 'external', label: 'Externe...', color: 'purple' },
            { value: 'renewed', label: 'Renouvellement', color: 'blue' }
          ].map(status => (
            <button
              key={status.value}
              onClick={() => setPrescriptionStatus(status.value)}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                prescriptionStatus === status.value
                  ? `bg-${status.color}-600 text-white shadow-md`
                  : `bg-white text-gray-700 border border-gray-300 hover:border-${status.color}-500`
              }`}
            >
              {status.label}
            </button>
          ))}
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
        {[
          { value: 'glasses', icon: Glasses, label: 'Lunettes' },
          { value: 'contacts', icon: Eye, label: 'Lentilles' },
          { value: 'both', icon: FileText, label: 'Les Deux' }
        ].map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setPrescriptionType(value)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              prescriptionType === value ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </button>
        ))}
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
                    AV: {data.subjective?.OD?.va || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center mb-2">
                    <span className="font-medium text-gray-700 w-12">OS:</span>
                    <span className="font-mono text-lg">{formatPrescription(data.subjective).OS}</span>
                  </div>
                  <div className="text-sm text-gray-500 ml-12">
                    AV: {data.subjective?.OS?.va || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Reading Addition */}
              {readingAdd && patient?.age >= 40 && (
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
                  <span className="ml-3 font-mono">{data.pupilDistance?.binocular}mm</span>
                  <span className="text-sm text-gray-500 ml-3">
                    (OD: {data.pupilDistance?.OD}mm | OS: {data.pupilDistance?.OS}mm)
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
            {(Math.abs(data.subjective?.OD?.sphere) > 4 || Math.abs(data.subjective?.OS?.sphere) > 4) && (
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
                    <select
                      value={contactLensParams.baseCurve}
                      onChange={(e) => setContactLensParams(prev => ({ ...prev, baseCurve: e.target.value }))}
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="8.4">8.4</option>
                      <option value="8.6">8.6</option>
                      <option value="8.8">8.8</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Diamètre</label>
                    <select
                      value={contactLensParams.diameter}
                      onChange={(e) => setContactLensParams(prev => ({ ...prev, diameter: e.target.value }))}
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="14.0">14.0</option>
                      <option value="14.2">14.2</option>
                      <option value="14.5">14.5</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Marque</label>
                    <select
                      value={contactLensParams.brand}
                      onChange={(e) => setContactLensParams(prev => ({ ...prev, brand: e.target.value }))}
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Sélectionner --</option>
                      {contactLensOptions.map(lens => (
                        <option key={lens.brand} value={lens.brand}>{lens.brand}</option>
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
                    {spectacleLensOptions[0]?.materials.map(material => (
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
                  {spectacleLensOptions[0]?.coatings.map(coating => (
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
            value={(data.finalPrescription?.recommendations || []).join('\n')}
            onChange={(e) => onChange(prev => ({
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

      {/* Optical Prescription Save Status */}
      {(prescriptionStatus === 'prescribed' || prescriptionStatus === 'renewed') && (
        <div className="mb-4 p-3 rounded-lg border flex items-center justify-between bg-blue-50 border-blue-200">
          {savedPrescription ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>Ordonnance optique enregistrée (ID: {savedPrescription.prescriptionId || savedPrescription._id})</span>
            </div>
          ) : (
            <div className="flex items-center text-amber-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <span>Ordonnance optique non enregistrée - Cliquez sur "Enregistrer" pour sauvegarder</span>
            </div>
          )}
        </div>
      )}

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

          {(prescriptionStatus === 'prescribed' || prescriptionStatus === 'renewed') && (
            <button
              onClick={handleSaveOpticalPrescription}
              disabled={saving || savedPrescription}
              className={`flex items-center px-4 py-2 rounded-lg ${
                savedPrescription
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : savedPrescription ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Enregistré
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </button>
          )}

          <button
            onClick={onShowPreview}
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
  );
}
