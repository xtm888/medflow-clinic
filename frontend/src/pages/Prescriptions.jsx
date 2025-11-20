import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Search, Plus, Printer, Check, X, AlertCircle, AlertTriangle, Star, Zap, Link } from 'lucide-react';
import prescriptionService from '../services/prescriptionService';
import patientService from '../services/patientService';
import templateCatalogService from '../services/templateCatalogService';
import doseTemplateService from '../services/doseTemplateService';
import treatmentProtocolService from '../services/treatmentProtocolService';
import api from '../services/apiConfig';
import { toast } from 'react-toastify';
import EmptyState from '../components/EmptyState';
import { normalizeToArray, safeString } from '../utils/apiHelpers';
import DocumentGenerator from '../components/documents/DocumentGenerator';
import { useAuth } from '../contexts/AuthContext';

export default function Prescriptions() {
  
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientVisits, setPatientVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewPrescription, setShowNewPrescription] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dispensing, setDispensing] = useState({});
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [patientFilter, setPatientFilter] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const highlightRef = useRef(null);

  // Template and protocol state
  const [medications, setMedications] = useState([]);
  const [medicationSearch, setMedicationSearch] = useState('');
  const [treatmentProtocols, setTreatmentProtocols] = useState([]);
  const [currentDoseTemplate, setCurrentDoseTemplate] = useState(null);
  const [showProtocolSelector, setShowProtocolSelector] = useState(false);

  const [prescriptionForm, setPrescriptionForm] = useState({
    patient: '',
    visit: '',
    prescriptionType: 'drug',
    medications: [],
    instructions: '',
    diagnosis: '',
    validUntil: ''
  });

  const [currentMedication, setCurrentMedication] = useState({
    medicationTemplate: null,
    medicationName: '',
    medicationForm: '',
    dose: null,
    posologie: null,
    details: [],
    duration: null,
    quantity: 1,
    instructions: ''
  });

  // Fetch prescriptions and patients on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL parameters for filtering and highlighting
  useEffect(() => {
    const patientId = searchParams.get('patientId');
    const highlight = searchParams.get('highlight');

    if (patientId) {
      setPatientFilter(patientId);
    }

    if (highlight) {
      setHighlightedId(highlight);
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedId(null);
        // Remove highlight param from URL
        searchParams.delete('highlight');
        setSearchParams(searchParams);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Scroll to highlighted prescription
  useEffect(() => {
    if (highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedId, prescriptions]);

  // Fetch visits for selected patient
  const fetchPatientVisits = async (patientId) => {
    if (!patientId) {
      setPatientVisits([]);
      return;
    }
    try {
      // Use the correct endpoint for patient visits
      const response = await api.get(`/visits/patient/${patientId}`);
      const allVisits = normalizeToArray(response.data);

      // Filter to only show in-progress or recent visits
      const recentVisits = allVisits.filter(v =>
        v.status === 'in-progress' ||
        v.status === 'checked-in' ||
        (v.status === 'completed' && new Date(v.visitDate) > new Date(Date.now() - 24 * 60 * 60 * 1000))
      ).slice(0, 10);

      setPatientVisits(recentVisits);

      // Auto-select the most recent in-progress visit
      const activeVisit = recentVisits.find(v => v.status === 'in-progress');
      if (activeVisit) {
        setPrescriptionForm(prev => ({ ...prev, visit: activeVisit._id || activeVisit.id }));
      }
    } catch (err) {
      console.warn('Could not fetch patient visits:', err);
      setPatientVisits([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch prescriptions, patients, and active visits
      const [prescriptionsRes, patientsRes] = await Promise.all([
        prescriptionService.getPrescriptions(),
        patientService.getPatients()
      ]);

      setPrescriptions(normalizeToArray(prescriptionsRes));
      setPatients(normalizeToArray(patientsRes));

      // Try to fetch medications from template catalog, fallback to drugs API
      let medicationsData = [];
      try {
        const medicationsRes = await templateCatalogService.getMedicationTemplates({ limit: 100 });
        medicationsData = normalizeToArray(medicationsRes);
      } catch (medErr) {
        console.warn('Medication templates not available, trying drugs API:', medErr);
        try {
          // Fallback to drugs API
          const drugsRes = await api.get('/pharmacy/drugs', { params: { limit: 100 } });
          medicationsData = normalizeToArray(drugsRes.data);
        } catch (drugErr) {
          console.warn('Drugs API also not available:', drugErr);
        }
      }
      setMedications(medicationsData);

      // Try to fetch treatment protocols (optional)
      try {
        const protocolsRes = await treatmentProtocolService.getTreatmentProtocols();
        setTreatmentProtocols(normalizeToArray(protocolsRes));
      } catch (protErr) {
        console.warn('Treatment protocols not available:', protErr);
        setTreatmentProtocols([]);
      }

    } catch (err) {
      toast.error('Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load dose template when medication is selected
  const handleMedicationSelect = async (medication) => {
    try {
      setCurrentMedication(prev => ({
        ...prev,
        medicationTemplate: medication._id || medication.id,
        medicationName: medication.name,
        medicationForm: medication.form || ''
      }));

      // Fetch dose template for this medication form
      if (medication.form) {
        try {
          const response = await doseTemplateService.getByForm(medication.form);
          if (response && response.data) {
            setCurrentDoseTemplate(response.data);
          } else {
            // No dose template found, use default
            setCurrentDoseTemplate(getDefaultDoseTemplate());
          }
        } catch (doseErr) {
          console.warn('No dose template found for form:', medication.form);
          setCurrentDoseTemplate(getDefaultDoseTemplate());
        }
      } else {
        // No form specified, use default template
        setCurrentDoseTemplate(getDefaultDoseTemplate());
      }
    } catch (err) {
      console.error('Error loading dose template:', err);
      setCurrentDoseTemplate(getDefaultDoseTemplate());
    }
  };

  // Default dose template when none is found
  const getDefaultDoseTemplate = () => ({
    doseOptions: [
      { value: '1_drop', labelFr: '1 goutte', text: '1 goutte' },
      { value: '2_drops', labelFr: '2 gouttes', text: '2 gouttes' },
      { value: '1_tablet', labelFr: '1 comprimé', text: '1 comprimé' },
      { value: '2_tablets', labelFr: '2 comprimés', text: '2 comprimés' },
      { value: '1_capsule', labelFr: '1 gélule', text: '1 gélule' },
      { value: '5ml', labelFr: '5 ml', text: '5 ml' },
      { value: '10ml', labelFr: '10 ml', text: '10 ml' },
      { value: '1_application', labelFr: '1 application', text: '1 application' }
    ],
    posologieOptions: [
      { value: '1x_day', labelFr: '1 fois par jour', text: '1 fois par jour' },
      { value: '2x_day', labelFr: '2 fois par jour', text: '2 fois par jour' },
      { value: '3x_day', labelFr: '3 fois par jour', text: '3 fois par jour' },
      { value: '4x_day', labelFr: '4 fois par jour', text: '4 fois par jour' },
      { value: 'morning', labelFr: 'Le matin', text: 'le matin' },
      { value: 'evening', labelFr: 'Le soir', text: 'le soir' },
      { value: 'as_needed', labelFr: 'Si besoin', text: 'si besoin' }
    ],
    detailsOptions: [
      { value: 'with_meal', labelFr: 'Avec les repas', text: 'avec les repas' },
      { value: 'before_meal', labelFr: 'Avant les repas', text: 'avant les repas' },
      { value: 'after_meal', labelFr: 'Après les repas', text: 'après les repas' },
      { value: 'on_empty', labelFr: 'À jeun', text: 'à jeun' },
      { value: 'both_eyes', labelFr: 'Dans les deux yeux', text: 'dans les deux yeux' },
      { value: 'right_eye', labelFr: 'Œil droit', text: 'œil droit' },
      { value: 'left_eye', labelFr: 'Œil gauche', text: 'œil gauche' }
    ],
    durationOptions: [
      { value: '3_days', labelFr: 'Pendant 3 jours', text: 'pendant 3 jours' },
      { value: '5_days', labelFr: 'Pendant 5 jours', text: 'pendant 5 jours' },
      { value: '7_days', labelFr: 'Pendant 7 jours', text: 'pendant 7 jours' },
      { value: '10_days', labelFr: 'Pendant 10 jours', text: 'pendant 10 jours' },
      { value: '14_days', labelFr: 'Pendant 14 jours', text: 'pendant 14 jours' },
      { value: '1_month', labelFr: 'Pendant 1 mois', text: 'pendant 1 mois' },
      { value: '3_months', labelFr: 'Pendant 3 mois', text: 'pendant 3 mois' },
      { value: 'continuous', labelFr: 'Traitement continu', text: 'traitement continu' }
    ]
  });

  // Apply treatment protocol
  const handleApplyProtocol = async (protocol) => {
    try {
      // Check if protocol has medications
      if (!protocol.medications || protocol.medications.length === 0) {
        toast.error('Ce protocole ne contient aucun médicament');
        return;
      }

      // Map protocol medications to prescription format
      // Handle both populated and non-populated medicationTemplate
      const protocolMeds = protocol.medications.map(med => {
        const template = med.medicationTemplate;
        // Check if template is populated (object) - must check for null explicitly since typeof null === 'object'
        const isPopulated = template !== null && template !== undefined && typeof template === 'object';

        // Get template ID - handle populated object, string ID, or null
        let templateId = null;
        let templateName = med.name || 'Médicament';
        let templateForm = med.form || '';

        if (isPopulated) {
          templateId = template._id || template.id || null;
          templateName = template.name || med.name || 'Médicament';
          templateForm = template.form || med.form || '';
        } else if (typeof template === 'string') {
          templateId = template;
        }

        return {
          medicationTemplate: templateId,
          medicationName: templateName,
          medicationForm: templateForm,
          dose: med.dose,
          posologie: med.posologie,
          details: med.details || [],
          duration: med.duration,
          quantity: med.quantity || 1,
          instructions: med.instructions || ''
        };
      });

      setPrescriptionForm(prev => ({
        ...prev,
        medications: [...prev.medications, ...protocolMeds],
        diagnosis: prev.diagnosis || protocol.category
      }));

      // Try to increment usage count (don't fail if this errors)
      try {
        await treatmentProtocolService.incrementUsage(protocol._id || protocol.id);
      } catch (usageErr) {
        console.warn('Could not increment usage count:', usageErr);
      }

      setShowProtocolSelector(false);
      toast.success(`Protocole "${protocol.name}" appliqué avec ${protocolMeds.length} médicament(s)`);
    } catch (err) {
      toast.error('Erreur lors de l\'application du protocole');
      console.error('Error applying protocol:', err);
    }
  };

  // Add medication to prescription
  const handleAddMedication = () => {
    if (!currentMedication.medicationName) {
      toast.error('Veuillez sélectionner un médicament');
      return;
    }

    if (!currentMedication.dose || !currentMedication.posologie) {
      toast.error('Veuillez remplir au moins la dose et la posologie');
      return;
    }

    setPrescriptionForm(prev => ({
      ...prev,
      medications: [...prev.medications, { ...currentMedication }]
    }));

    // Reset current medication
    setCurrentMedication({
      medicationTemplate: null,
      medicationName: '',
      medicationForm: '',
      dose: null,
      posologie: null,
      details: [],
      duration: null,
      quantity: 1,
      instructions: ''
    });
    setCurrentDoseTemplate(null);
    setMedicationSearch('');

    toast.success('Médicament ajouté');
  };

  // Remove medication from prescription
  const handleRemoveMedication = (index) => {
    setPrescriptionForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  // Create new prescription
  const handleCreatePrescription = async (e) => {
    e.preventDefault();

    if (!prescriptionForm.patient) {
      toast.error('Please select a patient');
      return;
    }

    if (prescriptionForm.medications.length === 0) {
      toast.error('Please add at least one medication');
      return;
    }

    try {
      setSubmitting(true);

      // Map prescription type to backend enum values
      const typeMap = {
        'drug': 'medication',
        'optical': 'optical'
      };

      // Transform medications to match backend schema
      const transformedMedications = prescriptionForm.medications.map(med => {
        // Build dosage string from dose template selections
        let dosageText = '';
        if (med.dose?.text) dosageText += med.dose.text + ' ';
        if (med.posologie?.text) dosageText += med.posologie.text + ' ';
        if (med.details && med.details.length > 0) {
          dosageText += med.details.map(d => d.text).join(', ') + ' ';
        }
        if (med.duration?.text) dosageText += med.duration.text;

        return {
          drug: med.medicationTemplate && !med.medicationTemplate.startsWith('manual_') ? med.medicationTemplate : undefined,
          name: med.medicationName,
          form: med.medicationForm,
          dosage: dosageText.trim() || 'Selon prescription',
          quantity: med.quantity || 1,
          instructions: med.instructions || '',
          indication: prescriptionForm.diagnosis
        };
      });

      const prescriptionData = {
        patient: prescriptionForm.patient,
        visit: prescriptionForm.visit || undefined, // Link to visit if selected
        type: typeMap[prescriptionForm.prescriptionType] || 'medication',
        medications: transformedMedications,
        instructions: {
          general: prescriptionForm.instructions,
          patient: prescriptionForm.instructions
        },
        diagnosis: prescriptionForm.diagnosis ? [{ description: prescriptionForm.diagnosis }] : [],
        status: 'pending',
        validUntil: prescriptionForm.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
      };

      await prescriptionService.createPrescription(prescriptionData);

      toast.success('Prescription created successfully!');
      setShowNewPrescription(false);

      // Reset form
      setPrescriptionForm({
        patient: '',
        visit: '',
        prescriptionType: 'drug',
        medications: [],
        instructions: '',
        diagnosis: '',
        validUntil: ''
      });
      setPatientVisits([]);

      // Refresh prescriptions list
      fetchData();

    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create prescription');
      console.error('Error creating prescription:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Dispense prescription
  const handleDispense = async (prescriptionId) => {
    if (!window.confirm('Confirmer la dispensation de cette prescription?\n\nCette action déduira automatiquement les médicaments de l\'inventaire de la pharmacie.')) {
      return;
    }

    try {
      setDispensing(prev => ({ ...prev, [prescriptionId]: true }));

      const result = await prescriptionService.dispensePrescription(prescriptionId, {
        dispensedBy: 'current_user', // Should be from auth context
        dispensedAt: new Date(),
        notes: 'Dispensed from staff portal'
      });

      // Show detailed success message with inventory info
      if (result.inventoryUpdated && result.inventoryUpdated > 0) {
        const deductions = result.inventoryDeductions || [];
        const deductionInfo = deductions.map(d =>
          `${d.medication}: ${d.quantity} unités (Stock restant: ${d.remainingStock})`
        ).join('\n');

        toast.success(`Prescription dispensée avec succès!\n\nInventaire mis à jour:\n${deductionInfo}`);
      } else {
        toast.success('Prescription dispensée avec succès!');
      }

      // Refresh list
      fetchData();

    } catch (err) {
      // Handle insufficient stock error specially
      if (err.response?.data?.insufficientStock) {
        const stockErrors = err.response.data.insufficientStock;
        const errorMessage = stockErrors.map(s =>
          `${s.medication}: Besoin ${s.required}, Disponible ${s.available}`
        ).join('\n');

        toast.error(`Stock insuffisant:\n${errorMessage}`);
      } else {
        toast.error(err.response?.data?.error || 'Échec de la dispensation');
      }
      console.error('Error dispensing prescription:', err);
    } finally {
      setDispensing(prev => ({ ...prev, [prescriptionId]: false }));
    }
  };

  // Print prescription
  const handlePrint = async (prescriptionId) => {
    try {
      const blob = await prescriptionService.printPrescription(prescriptionId, 'pdf');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescription_${prescriptionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Prescription downloaded successfully!');
    } catch (err) {
      toast.error('Failed to print prescription');
      console.error('Error printing prescription:', err);
    }
  };

  // Get patient name
  const getPatientName = (patientData) => {
    // If patient is already populated as an object
    if (patientData && typeof patientData === 'object' && patientData.firstName) {
      return `${patientData.firstName} ${patientData.lastName}`;
    }
    // If patient is an ID, look it up
    const patientId = typeof patientData === 'object' ? patientData._id : patientData;
    const patient = patients.find(p => p._id === patientId || p.id === patientId);
    if (patient) {
      return `${patient.firstName} ${patient.lastName}`;
    }
    return 'Unknown Patient';
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading prescriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des prescriptions et dispensation
          </p>
        </div>
        <button
          onClick={() => setShowNewPrescription(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle prescription</span>
        </button>
      </div>

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="card">
          <EmptyState
            type="prescriptions"
            customAction={{
              label: 'Nouvelle ordonnance',
              onClick: () => setShowNewPrescription(true)
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Patient filter indicator */}
          {patientFilter && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700">
                Filtré par patient: {patients.find(p => (p._id || p.id) === patientFilter)?.firstName || 'Patient sélectionné'}
              </span>
              <button
                onClick={() => {
                  setPatientFilter('');
                  searchParams.delete('patientId');
                  setSearchParams(searchParams);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Effacer le filtre
              </button>
            </div>
          )}
          {prescriptions
            .filter(prescription => {
              if (!patientFilter) return true;
              const patientId = typeof prescription.patient === 'object'
                ? (prescription.patient._id || prescription.patient.id)
                : prescription.patient;
              return patientId === patientFilter;
            })
            .map((prescription) => {
              const prescriptionId = prescription._id || prescription.id;
              const isHighlighted = highlightedId === prescriptionId;
              return (
            <div
              key={prescriptionId}
              ref={isHighlighted ? highlightRef : null}
              className={`card transition-all duration-300 ${isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getPatientName(prescription.patient)}
                    </h3>
                    <span className={`badge ${
                      prescription.status === 'dispensed' ? 'badge-success' :
                      prescription.status === 'pending' ? 'badge-warning' :
                      prescription.status === 'cancelled' ? 'badge-danger' :
                      'badge'
                    }`}>
                      {prescription.status === 'dispensed' ? 'Dispensée' :
                       prescription.status === 'pending' ? 'En attente' :
                       prescription.status === 'cancelled' ? 'Annulée' :
                       safeString(prescription.status, 'Unknown')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {prescription.prescriber
                      ? (prescription.prescriber.name ||
                         (prescription.prescriber.firstName
                           ? `Dr. ${prescription.prescriber.firstName} ${prescription.prescriber.lastName || ''}`.trim()
                           : 'Dr. Unknown'))
                      : 'Dr. Unknown'} - {formatDate(prescription.date || prescription.createdAt)}
                  </p>
                  {prescription.visit && (
                    <p className="text-xs text-green-600 mb-3 flex items-center">
                      <Link className="h-3 w-3 mr-1" />
                      Visite: {prescription.visit.visitId || 'N/A'} ({prescription.visit.status === 'in-progress' ? 'En cours' : prescription.visit.status === 'completed' ? 'Terminée' : prescription.visit.status})
                    </p>
                  )}
                  {!prescription.visit && (
                    <div className="flex items-center text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mb-3">
                      <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span>Non liée à une visite - Documentation clinique incomplète</span>
                    </div>
                  )}

                  {/* Medications List */}
                  <div className="space-y-2">
                    {Array.isArray(prescription.medications) && prescription.medications.map((med, idx) => {
                      // Get medication name - handle various data structures
                      let medName = 'Médicament';
                      if (med.name) {
                        medName = med.name;
                      } else if (med.drug && typeof med.drug === 'object' && med.drug.name) {
                        medName = med.drug.name;
                      } else if (med.medication && typeof med.medication === 'object' && med.medication.name) {
                        medName = med.medication.name;
                      } else if (typeof med.medication === 'string') {
                        medName = med.medication;
                      }

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {medName}
                              {med.form && <span className="text-gray-500 text-sm ml-1">({med.form})</span>}
                            </p>
                            <p className="text-sm text-gray-600">{safeString(med.dosage, 'Selon prescription')}</p>
                            {(med.frequency || med.duration) && (
                              <p className="text-xs text-gray-500">
                                {med.frequency && safeString(med.frequency, '')}
                                {med.frequency && med.duration && ' - '}
                                {med.duration && `Durée: ${safeString(med.duration, '')}`}
                              </p>
                            )}
                            {med.instructions && (
                              <p className="text-xs text-gray-500 italic mt-1">{safeString(med.instructions, '')}</p>
                            )}
                            {med.indication && (
                              <p className="text-xs text-blue-600 mt-1">Indication: {safeString(med.indication, '')}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              Qté: {typeof med.quantity === 'number' ? med.quantity : 1}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Diagnosis and Instructions */}
                  {prescription.diagnosis && (
                    <div className="mt-3 p-2 bg-blue-50 rounded">
                      <p className="text-xs font-medium text-blue-900">Diagnostic:</p>
                      <p className="text-sm text-blue-800">{safeString(prescription.diagnosis, '')}</p>
                    </div>
                  )}
                  {prescription.instructions && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded">
                      <p className="text-xs font-medium text-yellow-900">Instructions:</p>
                      <p className="text-sm text-yellow-800">{safeString(prescription.instructions, '')}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-4">
                  {prescription.status === 'pending' && (
                    <button
                      onClick={() => handleDispense(prescription._id || prescription.id)}
                      disabled={dispensing[prescription._id || prescription.id]}
                      className="btn btn-success text-sm"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {dispensing[prescription._id || prescription.id] ? 'Dispensing...' : 'Dispenser'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedPrescription(prescription);
                      setShowDocumentGenerator(true);
                    }}
                    className="btn btn-primary text-sm"
                    title="Générer un certificat ou document"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Certificat
                  </button>
                  <button
                    onClick={() => handlePrint(prescription._id || prescription.id)}
                    className="btn btn-secondary text-sm"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </button>
                </div>
              </div>
            </div>
              );
            })}
        </div>
      )}

      {/* New Prescription Modal */}
      {showNewPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Nouvelle Prescription</h2>
              <button
                onClick={() => setShowNewPrescription(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePrescription} className="p-6 space-y-6">
              {/* Prescriber Info */}
              {user && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Prescripteur:</span> Dr. {user.firstName} {user.lastName}
                    {user.licenseNumber && <span className="ml-2 text-blue-600">({user.licenseNumber})</span>}
                  </p>
                </div>
              )}

              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                <select
                  className="input"
                  value={prescriptionForm.patient}
                  onChange={(e) => {
                    const patientId = e.target.value;
                    setPrescriptionForm({ ...prescriptionForm, patient: patientId, visit: '' });
                    fetchPatientVisits(patientId);
                  }}
                  required
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visit Selection - Only show if patient has active visits */}
              {prescriptionForm.patient && patientVisits.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Link className="h-4 w-4 inline mr-1" />
                    Lier à une visite (optionnel)
                  </label>
                  <select
                    className="input"
                    value={prescriptionForm.visit}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, visit: e.target.value })}
                  >
                    <option value="">Ne pas lier à une visite</option>
                    {patientVisits.map(v => (
                      <option key={v._id || v.id} value={v._id || v.id}>
                        {v.visitId || 'Visite'} - {new Date(v.visitDate).toLocaleDateString('fr-FR')} ({v.status === 'in-progress' ? 'En cours' : v.status})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Lier la prescription à une visite permet de la retrouver dans l'historique du patient
                  </p>
                </div>
              )}

              {/* Prescription Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de prescription</label>
                <select
                  className="input"
                  value={prescriptionForm.prescriptionType}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, prescriptionType: e.target.value })}
                >
                  <option value="drug">Médicaments</option>
                  <option value="optical">Optique</option>
                </select>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostic</label>
                <input
                  type="text"
                  className="input"
                  value={prescriptionForm.diagnosis}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                  placeholder="Ex: Hypertension, Diabète..."
                />
              </div>

              {/* Current Medications */}
              {prescriptionForm.medications.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Médicaments ajoutés</label>
                  <div className="space-y-2">
                    {prescriptionForm.medications.map((med, idx) => {
                      // Build prescription text
                      let prescriptionText = '';
                      if (med.dose?.text) prescriptionText += med.dose.text + ' ';
                      if (med.posologie?.text) prescriptionText += med.posologie.text + ' ';
                      if (med.details && med.details.length > 0) {
                        prescriptionText += med.details.map(d => d.text).join(', ') + ' ';
                      }
                      if (med.duration?.text) prescriptionText += med.duration.text;

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{med.medicationName || safeString(med.medication, '')}</p>
                            <p className="text-sm text-gray-600 mt-1">{prescriptionText || `${safeString(med.dosage, '')} - ${safeString(med.frequency, '')}`}</p>
                            <p className="text-xs text-gray-500 mt-1">Quantité: {typeof med.quantity === 'number' ? med.quantity : 1}</p>
                            {med.instructions && (
                              <p className="text-xs text-gray-500 italic mt-1">{safeString(med.instructions, '')}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(idx)}
                            className="text-red-600 hover:text-red-800 ml-2"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Treatment Protocol Selector */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Protocoles de traitement</label>
                  <button
                    type="button"
                    onClick={() => setShowProtocolSelector(!showProtocolSelector)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    {showProtocolSelector ? 'Masquer' : 'Charger un protocole'}
                  </button>
                </div>

                {showProtocolSelector && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-800 mb-2">Sélectionnez un protocole standard pour ajouter rapidement plusieurs médicaments:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {treatmentProtocols.map(protocol => (
                        <button
                          key={protocol._id || protocol.id}
                          type="button"
                          onClick={() => handleApplyProtocol(protocol)}
                          className="p-3 text-left bg-white border border-blue-200 hover:border-blue-400 rounded-lg transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{protocol.name}</p>
                              <p className="text-xs text-gray-600 mt-1">{protocol.description || protocol.category}</p>
                              <p className="text-xs text-blue-600 mt-1">{protocol.medications?.length || 0} médicament(s)</p>
                            </div>
                            {protocol.type === 'favorite' && (
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Medication Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Ajouter un médicament</label>

                {/* Medication Search/Select */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Médicament *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input"
                      placeholder="Rechercher un médicament..."
                      value={medicationSearch}
                      onChange={(e) => setMedicationSearch(e.target.value)}
                    />
                  </div>
                  {medicationSearch && (
                    <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                      {/* Show matching medications */}
                      {medications
                        .filter(med => med.name && med.name.toLowerCase().includes(medicationSearch.toLowerCase()))
                        .slice(0, 10)
                        .map(med => (
                          <button
                            key={med._id || med.id}
                            type="button"
                            onClick={() => {
                              handleMedicationSelect(med);
                              setMedicationSearch(med.name);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{med.name}</p>
                            <p className="text-xs text-gray-500">{med.category || 'Non catégorisé'} - {med.form || 'Forme non spécifiée'}</p>
                          </button>
                        ))
                      }

                      {/* Show message and manual entry option if no results or few results */}
                      {medications.filter(med => med.name && med.name.toLowerCase().includes(medicationSearch.toLowerCase())).length === 0 && (
                        <div className="p-3 text-center">
                          <p className="text-sm text-gray-500 mb-2">Aucun résultat trouvé pour "{medicationSearch}"</p>
                          <button
                            type="button"
                            onClick={() => {
                              // Manual entry - create a medication object with the search term
                              const manualMed = {
                                _id: `manual_${Date.now()}`,
                                name: medicationSearch,
                                form: '',
                                category: 'Manuel'
                              };
                              handleMedicationSelect(manualMed);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            + Utiliser "{medicationSearch}" comme nom de médicament
                          </button>
                        </div>
                      )}

                      {/* Always show manual entry option at the bottom */}
                      {medications.filter(med => med.name && med.name.toLowerCase().includes(medicationSearch.toLowerCase())).length > 0 &&
                       !medications.some(med => med.name && med.name.toLowerCase() === medicationSearch.toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => {
                            const manualMed = {
                              _id: `manual_${Date.now()}`,
                              name: medicationSearch,
                              form: '',
                              category: 'Manuel'
                            };
                            handleMedicationSelect(manualMed);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-green-50 border-t border-gray-200 bg-gray-50"
                        >
                          <p className="text-sm font-medium text-green-700">+ Ajouter "{medicationSearch}" manuellement</p>
                          <p className="text-xs text-gray-500">Si le médicament n'est pas dans la liste</p>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Show current selection */}
                  {currentMedication.medicationName && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                      <span className="text-sm text-blue-800">
                        <strong>Sélectionné:</strong> {currentMedication.medicationName}
                        {currentMedication.medicationForm && ` (${currentMedication.medicationForm})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentMedication(prev => ({
                            ...prev,
                            medicationTemplate: null,
                            medicationName: '',
                            medicationForm: ''
                          }));
                          setCurrentDoseTemplate(null);
                          setMedicationSearch('');
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Show dropdown builders only when medication is selected */}
                {currentMedication.medicationName && currentDoseTemplate && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Dose Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dose *</label>
                      <select
                        className="input text-sm"
                        value={currentMedication.dose?.value || ''}
                        onChange={(e) => {
                          const selected = currentDoseTemplate.doseOptions.find(opt => opt.value === e.target.value);
                          setCurrentMedication(prev => ({ ...prev, dose: selected || null }));
                        }}
                      >
                        <option value="">Sélectionner une dose...</option>
                        {currentDoseTemplate.doseOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.labelFr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Posologie Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Posologie *</label>
                      <select
                        className="input text-sm"
                        value={currentMedication.posologie?.value || ''}
                        onChange={(e) => {
                          const selected = currentDoseTemplate.posologieOptions.find(opt => opt.value === e.target.value);
                          setCurrentMedication(prev => ({ ...prev, posologie: selected || null }));
                        }}
                      >
                        <option value="">Sélectionner une posologie...</option>
                        {currentDoseTemplate.posologieOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.labelFr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Details Multi-select */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Détails (optionnel)</label>
                      <select
                        className="input text-sm"
                        multiple
                        size="3"
                        value={currentMedication.details.map(d => d.value)}
                        onChange={(e) => {
                          const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                          const selectedDetails = currentDoseTemplate.detailsOptions.filter(opt =>
                            selectedValues.includes(opt.value)
                          );
                          setCurrentMedication(prev => ({ ...prev, details: selectedDetails }));
                        }}
                      >
                        {currentDoseTemplate.detailsOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.labelFr}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Maintenez Ctrl/Cmd pour sélectionner plusieurs</p>
                    </div>

                    {/* Duration Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Durée</label>
                      <select
                        className="input text-sm"
                        value={currentMedication.duration?.value || ''}
                        onChange={(e) => {
                          const selected = currentDoseTemplate.durationOptions.find(opt => opt.value === e.target.value);
                          setCurrentMedication(prev => ({ ...prev, duration: selected || null }));
                        }}
                      >
                        <option value="">Sélectionner une durée...</option>
                        {currentDoseTemplate.durationOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.labelFr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
                      <input
                        type="number"
                        className="input text-sm"
                        min="1"
                        value={currentMedication.quantity}
                        onChange={(e) => setCurrentMedication(prev => ({
                          ...prev,
                          quantity: parseInt(e.target.value) || 1
                        }))}
                      />
                    </div>

                    {/* Instructions */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Instructions spéciales</label>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Ex: Avec repas"
                        value={currentMedication.instructions}
                        onChange={(e) => setCurrentMedication(prev => ({
                          ...prev,
                          instructions: e.target.value
                        }))}
                      />
                    </div>
                  </div>
                )}

                {/* Preview generated prescription text */}
                {currentMedication.medicationName && currentMedication.dose && currentMedication.posologie && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 mb-1">Aperçu de l'ordonnance:</p>
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">{currentMedication.medicationName}</span>
                      {' - '}
                      {currentMedication.dose?.text}{' '}
                      {currentMedication.posologie?.text}
                      {currentMedication.details.length > 0 && (
                        <> {currentMedication.details.map(d => d.text).join(', ')}</>
                      )}
                      {currentMedication.duration && <> {currentMedication.duration.text}</>}
                      . Quantité: {currentMedication.quantity}
                      {currentMedication.instructions && ` - ${currentMedication.instructions}`}
                    </p>
                  </div>
                )}

                {/* Prominent Add Button with Visual Cue */}
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 mb-2 font-medium">
                    {currentMedication.dose && currentMedication.posologie
                      ? "Cliquez pour ajouter ce médicament à l'ordonnance"
                      : "Sélectionnez la dose et posologie, puis ajoutez à l'ordonnance"}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddMedication}
                    disabled={!currentMedication.medicationName || !currentMedication.dose || !currentMedication.posologie}
                    className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    Ajouter ce médicament à l'ordonnance
                  </button>
                </div>
              </div>

              {/* General Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions générales</label>
                <textarea
                  className="input"
                  rows="3"
                  value={prescriptionForm.instructions}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })}
                  placeholder="Instructions générales pour le patient..."
                />
              </div>

              {/* Valid Until */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valide jusqu'au</label>
                <input
                  type="date"
                  className="input w-full cursor-pointer"
                  value={prescriptionForm.validUntil}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, validUntil: e.target.value })}
                  onInput={(e) => setPrescriptionForm({ ...prescriptionForm, validUntil: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">Laissez vide pour 30 jours par défaut</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewPrescription(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || prescriptionForm.medications.length === 0}
                >
                  {submitting ? 'Création en cours...' : 'Créer la prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && selectedPrescription && (
        <DocumentGenerator
          patientId={selectedPrescription.patient?._id || selectedPrescription.patient?.id || selectedPrescription.patient}
          visitId={selectedPrescription.visit?._id}
          onClose={() => {
            setShowDocumentGenerator(false);
            setSelectedPrescription(null);
          }}
          onDocumentGenerated={(doc) => {
            toast.success('Document généré avec succès!');
            setShowDocumentGenerator(false);
            setSelectedPrescription(null);
          }}
        />
      )}
    </div>
  );
}
