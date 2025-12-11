import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Check, Loader2, AlertTriangle, User, Eye,
  Stethoscope, Pill, FileText, Package, TestTube, Plus, Trash2
} from 'lucide-react';
import Wizard from '../../components/Wizard';
import surgeryService from '../../services/surgeryService';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmationModal from '../../components/ConfirmationModal';

/**
 * SurgeryReportForm - Multi-step operative report form
 *
 * Steps:
 * 1. Diagnosis (pre-op and post-op)
 * 2. Procedure details (surgeon's narrative)
 * 3. Consumables/Equipment
 * 4. Post-op instructions
 * 5. Summary & Sign
 */
export default function SurgeryReportForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [surgeryCase, setSurgeryCase] = useState(null);
  const [existingReport, setExistingReport] = useState(null);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [finalizeModal, setFinalizeModal] = useState(false);

  // Report form data
  const [reportData, setReportData] = useState({
    // Step 1: Diagnosis
    preOpDiagnosis: '',
    postOpDiagnosis: '',

    // Step 2: Procedure
    procedurePerformed: '',
    operativeFindings: '',
    procedureDetails: '',
    anesthesiaType: 'topical',
    anesthesiaAgent: '',

    // Step 3: IOL & Consumables
    iolImplanted: false,
    iolDetails: {
      model: '',
      manufacturer: '',
      power: '',
      targetRefraction: '',
      lotNumber: '',
      serialNumber: ''
    },

    // Complications
    complications: {
      occurred: false,
      description: '',
      management: ''
    },
    complicationChecklist: {
      posteriorCapsuleRupture: false,
      vitreousLoss: false,
      zonularDehiscence: false,
      irisTrauma: false,
      cornealEdema: false,
      hyphema: false,
      elevatedIOP: false,
      otherComplication: ''
    },

    // Specimens collected during surgery
    specimensCollected: [],

    // Step 4: Post-op
    postOpMedications: [],
    postOpInstructions: '',
    activityRestrictions: '',
    followUpDate: '',
    followUpInstructions: '',

    // Step 5: Prognosis
    prognosis: 'good',
    prognosisNotes: ''
  });

  const steps = [
    { title: 'Diagnostic', label: 'Diagnostic', description: 'Diagnostic pré et post-opératoire' },
    { title: 'Procédure', label: 'Procédure', description: 'Détails de l\'intervention' },
    { title: 'IOL & Matériel', label: 'Matériel', description: 'Implant et consommables' },
    { title: 'Instructions post-op', label: 'Post-op', description: 'Prescriptions et suivi' },
    { title: 'Résumé', label: 'Résumé', description: 'Vérification et signature' }
  ];

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await surgeryService.getCase(id);
      setSurgeryCase(response.data);

      // Check if report exists
      if (response.data.surgeryReport) {
        const reportResponse = await surgeryService.getReport(response.data.surgeryReport._id || response.data.surgeryReport);
        setExistingReport(reportResponse.data);
        // Pre-fill form with existing data
        setReportData(prev => ({
          ...prev,
          ...reportResponse.data
        }));
      } else {
        // Pre-fill from surgery type
        if (response.data.surgeryType?.name) {
          setReportData(prev => ({
            ...prev,
            procedurePerformed: response.data.surgeryType.name
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching surgery data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setReportData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setReportData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      if (existingReport) {
        await surgeryService.updateReport(existingReport._id, reportData);
      } else {
        const response = await surgeryService.createReport(id, reportData);
        setExistingReport(response.data);
      }
    } catch (err) {
      console.error('Error saving draft:', err);
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setSaving(true);
      let reportId = existingReport?._id;

      if (!reportId) {
        const response = await surgeryService.createReport(id, reportData);
        reportId = response.data._id;
      } else {
        await surgeryService.updateReport(reportId, reportData);
      }

      await surgeryService.finalizeReport(reportId);
      navigate('/surgery');
    } catch (err) {
      console.error('Error finalizing report:', err);
      setError(err.response?.data?.message || 'Erreur lors de la finalisation');
    } finally {
      setSaving(false);
      setFinalizeModal(false);
    }
  };

  const handleStepChange = (step) => {
    setCurrentStep(step);
  };

  const handleComplete = () => {
    setFinalizeModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !surgeryCase) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">{error || 'Cas non trouvé'}</p>
        <button onClick={() => navigate('/surgery')} className="mt-4 btn btn-secondary">
          Retour
        </button>
      </div>
    );
  }

  const patient = surgeryCase.patient;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/surgery/${id}/checkin`)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rapport Opératoire</h1>
            <p className="text-sm text-gray-500">
              {patient?.firstName} {patient?.lastName} - {surgeryCase.surgeryType?.name}
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="btn btn-secondary flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder brouillon
        </button>
      </div>

      {/* Auto-filled info banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-purple-600 font-medium">Patient</p>
            <p className="text-gray-900">{patient?.firstName} {patient?.lastName}</p>
          </div>
          <div>
            <p className="text-purple-600 font-medium">Chirurgie</p>
            <p className="text-gray-900">{surgeryCase.surgeryType?.name}</p>
          </div>
          <div>
            <p className="text-purple-600 font-medium">Oeil</p>
            <p className="text-gray-900">{surgeryCase.eye || 'N/A'}</p>
          </div>
          <div>
            <p className="text-purple-600 font-medium">Date</p>
            <p className="text-gray-900">
              {surgeryCase.surgeryStartTime
                ? new Date(surgeryCase.surgeryStartTime).toLocaleDateString('fr-FR')
                : new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </div>

      {/* Wizard */}
      <div className="bg-white rounded-xl shadow-sm border">
        <Wizard
          steps={steps}
          currentStep={currentStep}
          onStepChange={handleStepChange}
          onComplete={handleComplete}
        >
          {/* Step 1: Diagnosis */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diagnostic pré-opératoire *
                </label>
                <textarea
                  value={reportData.preOpDiagnosis}
                  onChange={(e) => handleInputChange('preOpDiagnosis', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Décrire le diagnostic pré-opératoire..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diagnostic post-opératoire *
                </label>
                <textarea
                  value={reportData.postOpDiagnosis}
                  onChange={(e) => handleInputChange('postOpDiagnosis', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Décrire le diagnostic post-opératoire..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Procedure */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Procédure réalisée *
                </label>
                <input
                  type="text"
                  value={reportData.procedurePerformed}
                  onChange={(e) => handleInputChange('procedurePerformed', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Nom de la procédure"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type d'anesthésie
                  </label>
                  <select
                    value={reportData.anesthesiaType}
                    onChange={(e) => handleInputChange('anesthesiaType', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="topical">Topique</option>
                    <option value="peribulbar">Péribulbaire</option>
                    <option value="retrobulbar">Rétrobulbaire</option>
                    <option value="general">Générale</option>
                    <option value="local">Locale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent anesthésique
                  </label>
                  <input
                    type="text"
                    value={reportData.anesthesiaAgent}
                    onChange={(e) => handleInputChange('anesthesiaAgent', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Ex: Lidocaïne 2%"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Constatations opératoires *
                </label>
                <textarea
                  value={reportData.operativeFindings}
                  onChange={(e) => handleInputChange('operativeFindings', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Décrire les constatations lors de l'intervention..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Détails de la procédure
                </label>
                <textarea
                  value={reportData.procedureDetails}
                  onChange={(e) => handleInputChange('procedureDetails', e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Description détaillée étape par étape..."
                />
              </div>

              {/* Complications */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="complicationsOccurred"
                    checked={reportData.complications.occurred}
                    onChange={(e) => handleNestedChange('complications', 'occurred', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="complicationsOccurred" className="font-medium text-gray-700">
                    Complications survenues
                  </label>
                </div>

                {reportData.complications.occurred && (
                  <div className="space-y-4 ml-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description des complications
                      </label>
                      <textarea
                        value={reportData.complications.description}
                        onChange={(e) => handleNestedChange('complications', 'description', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gestion des complications
                      </label>
                      <textarea
                        value={reportData.complications.management}
                        onChange={(e) => handleNestedChange('complications', 'management', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: IOL & Consumables */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* IOL Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="iolImplanted"
                    checked={reportData.iolImplanted}
                    onChange={(e) => handleInputChange('iolImplanted', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="iolImplanted" className="font-medium text-gray-700">
                    Implant intraoculaire (IOL) implanté
                  </label>
                </div>

                {reportData.iolImplanted && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Modèle</label>
                      <input
                        type="text"
                        value={reportData.iolDetails.model}
                        onChange={(e) => handleNestedChange('iolDetails', 'model', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fabricant</label>
                      <input
                        type="text"
                        value={reportData.iolDetails.manufacturer}
                        onChange={(e) => handleNestedChange('iolDetails', 'manufacturer', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Puissance (D)</label>
                      <input
                        type="text"
                        value={reportData.iolDetails.power}
                        onChange={(e) => handleNestedChange('iolDetails', 'power', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Réfraction cible</label>
                      <input
                        type="text"
                        value={reportData.iolDetails.targetRefraction}
                        onChange={(e) => handleNestedChange('iolDetails', 'targetRefraction', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">N° de lot</label>
                      <input
                        type="text"
                        value={reportData.iolDetails.lotNumber}
                        onChange={(e) => handleNestedChange('iolDetails', 'lotNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">N° de série</label>
                      <input
                        type="text"
                        value={reportData.iolDetails.serialNumber}
                        onChange={(e) => handleNestedChange('iolDetails', 'serialNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Blood Loss */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Perte sanguine estimée
                </label>
                <select
                  value={reportData.estimatedBloodLoss || 'minimal'}
                  onChange={(e) => handleInputChange('estimatedBloodLoss', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="minimal">Minimale</option>
                  <option value="moderate">Modérée</option>
                  <option value="significant">Significative</option>
                </select>
              </div>

              {/* Specimen Collection Section */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TestTube className="h-5 w-5 text-purple-600" />
                    <h4 className="font-medium text-gray-900">Prélèvements / Specimens</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newSpecimen = {
                        specimenType: '',
                        description: '',
                        source: '',
                        eye: surgeryCase?.eye || 'N/A',
                        sentToLab: false,
                        sentTo: '',
                        notes: ''
                      };
                      handleInputChange('specimensCollected', [...reportData.specimensCollected, newSpecimen]);
                    }}
                    className="btn btn-sm btn-secondary flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                </div>

                {reportData.specimensCollected.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <TestTube className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Aucun prélèvement enregistré</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Cliquez sur "Ajouter" pour enregistrer un specimen (cristallin, tissu, liquide, etc.)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reportData.specimensCollected.map((specimen, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-purple-600">
                            Prélèvement #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = reportData.specimensCollected.filter((_, i) => i !== index);
                              handleInputChange('specimensCollected', updated);
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Type de prélèvement *
                            </label>
                            <select
                              value={specimen.specimenType}
                              onChange={(e) => {
                                const updated = [...reportData.specimensCollected];
                                updated[index].specimenType = e.target.value;
                                handleInputChange('specimensCollected', updated);
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="lens">Cristallin / Lens</option>
                              <option value="capsule">Capsule postérieure</option>
                              <option value="tissue">Tissu</option>
                              <option value="vitreous">Vitré</option>
                              <option value="aqueous">Humeur aqueuse</option>
                              <option value="membrane">Membrane</option>
                              <option value="foreign_body">Corps étranger</option>
                              <option value="biopsy">Biopsie</option>
                              <option value="other">Autre</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Oeil
                            </label>
                            <select
                              value={specimen.eye}
                              onChange={(e) => {
                                const updated = [...reportData.specimensCollected];
                                updated[index].eye = e.target.value;
                                handleInputChange('specimensCollected', updated);
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="OD">OD (Droit)</option>
                              <option value="OS">OS (Gauche)</option>
                              <option value="OU">OU (Bilatéral)</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Source / Localisation
                            </label>
                            <input
                              type="text"
                              value={specimen.source || ''}
                              onChange={(e) => {
                                const updated = [...reportData.specimensCollected];
                                updated[index].source = e.target.value;
                                handleInputChange('specimensCollected', updated);
                              }}
                              placeholder="Ex: capsule antérieure"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={specimen.description || ''}
                              onChange={(e) => {
                                const updated = [...reportData.specimensCollected];
                                updated[index].description = e.target.value;
                                handleInputChange('specimensCollected', updated);
                              }}
                              placeholder="Description du specimen"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>

                        {/* Lab destination */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`sentToLab-${index}`}
                              checked={specimen.sentToLab}
                              onChange={(e) => {
                                const updated = [...reportData.specimensCollected];
                                updated[index].sentToLab = e.target.checked;
                                handleInputChange('specimensCollected', updated);
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor={`sentToLab-${index}`} className="text-sm text-gray-700">
                              Envoyé au laboratoire pour analyse
                            </label>
                          </div>

                          {specimen.sentToLab && (
                            <div className="mt-2 ml-7">
                              <input
                                type="text"
                                value={specimen.sentTo || ''}
                                onChange={(e) => {
                                  const updated = [...reportData.specimensCollected];
                                  updated[index].sentTo = e.target.value;
                                  handleInputChange('specimensCollected', updated);
                                }}
                                placeholder="Nom du laboratoire"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={specimen.notes || ''}
                            onChange={(e) => {
                              const updated = [...reportData.specimensCollected];
                              updated[index].notes = e.target.value;
                              handleInputChange('specimensCollected', updated);
                            }}
                            placeholder="Notes additionnelles"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Post-op Instructions */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instructions post-opératoires
                </label>
                <textarea
                  value={reportData.postOpInstructions}
                  onChange={(e) => handleInputChange('postOpInstructions', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Instructions pour le patient..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restrictions d'activité
                </label>
                <textarea
                  value={reportData.activityRestrictions}
                  onChange={(e) => handleInputChange('activityRestrictions', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Activités à éviter..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de suivi
                  </label>
                  <input
                    type="date"
                    value={reportData.followUpDate ? reportData.followUpDate.split('T')[0] : ''}
                    onChange={(e) => handleInputChange('followUpDate', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pronostic
                  </label>
                  <select
                    value={reportData.prognosis}
                    onChange={(e) => handleInputChange('prognosis', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Bon</option>
                    <option value="guarded">Réservé</option>
                    <option value="poor">Mauvais</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes sur le pronostic
                </label>
                <textarea
                  value={reportData.prognosisNotes}
                  onChange={(e) => handleInputChange('prognosisNotes', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4">Résumé du rapport</h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Diagnostic pré-op</p>
                      <p className="font-medium">{reportData.preOpDiagnosis || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Diagnostic post-op</p>
                      <p className="font-medium">{reportData.postOpDiagnosis || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Procédure</p>
                    <p className="font-medium">{reportData.procedurePerformed || '-'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Constatations</p>
                    <p className="font-medium">{reportData.operativeFindings || '-'}</p>
                  </div>

                  {reportData.iolImplanted && (
                    <div className="bg-purple-50 rounded p-3">
                      <p className="text-sm text-purple-600 font-medium">IOL Implanté</p>
                      <p>
                        {reportData.iolDetails.model} - {reportData.iolDetails.power}D
                        {reportData.iolDetails.lotNumber && ` (Lot: ${reportData.iolDetails.lotNumber})`}
                      </p>
                    </div>
                  )}

                  {reportData.complications.occurred && (
                    <div className="bg-red-50 rounded p-3">
                      <p className="text-sm text-red-600 font-medium">Complications</p>
                      <p>{reportData.complications.description}</p>
                    </div>
                  )}

                  {reportData.specimensCollected?.length > 0 && (
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-sm text-blue-600 font-medium flex items-center gap-1">
                        <TestTube className="h-4 w-4" />
                        Prélèvements ({reportData.specimensCollected.length})
                      </p>
                      <ul className="mt-1 text-sm space-y-1">
                        {reportData.specimensCollected.map((spec, idx) => (
                          <li key={idx}>
                            • {spec.specimenType || 'Type non défini'}
                            {spec.source && ` - ${spec.source}`}
                            {spec.sentToLab && ` → Lab: ${spec.sentTo || 'À préciser'}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Pronostic</p>
                      <p className="font-medium capitalize">{reportData.prognosis}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Suivi</p>
                      <p className="font-medium">
                        {reportData.followUpDate
                          ? new Date(reportData.followUpDate).toLocaleDateString('fr-FR')
                          : 'Non défini'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  En finalisant ce rapport, vous confirmez que toutes les informations sont exactes.
                  Le rapport sera signé électroniquement et ne pourra plus être modifié.
                </p>
              </div>
            </div>
          )}
        </Wizard>
      </div>

      {/* Finalize Modal */}
      <ConfirmationModal
        isOpen={finalizeModal}
        onClose={() => setFinalizeModal(false)}
        onConfirm={handleFinalize}
        title="Finaliser le rapport"
        message={
          <div className="space-y-4">
            <p>
              Vous êtes sur le point de finaliser et signer ce rapport opératoire.
            </p>
            <p className="text-sm text-gray-600">
              Une fois finalisé, le rapport ne pourra plus être modifié.
            </p>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm">
                <strong>Patient:</strong> {patient?.firstName} {patient?.lastName}
              </p>
              <p className="text-sm">
                <strong>Procédure:</strong> {reportData.procedurePerformed}
              </p>
              <p className="text-sm">
                <strong>Signé par:</strong> Dr. {user?.firstName} {user?.lastName}
              </p>
            </div>
          </div>
        }
        confirmText="Finaliser et signer"
        confirmButtonClass="bg-purple-600 hover:bg-purple-700 text-white"
      />
    </div>
  );
}
