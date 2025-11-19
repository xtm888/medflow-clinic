import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Calendar, Clock, User, Copy, FilePlus, FileText, Eye, Glasses, Printer, Send, X, MessageSquare, FileEdit } from 'lucide-react';
import api from '../services/apiConfig';
import medicationService from '../services/medicationService';
import MedicationAutocomplete from '../components/templates/MedicationAutocomplete';
import PathologyQuickPick from '../components/PathologyQuickPick';
import LaboratoryTestSelector from '../components/templates/LaboratoryTestSelector';
import ExaminationSelector from '../components/templates/ExaminationSelector';
// Import ophthalmology step components for full clinical workflow
import VisualAcuityStep from './ophthalmology/components/VisualAcuityStep';
import ObjectiveRefractionStep from './ophthalmology/components/ObjectiveRefractionStep';
import SubjectiveRefractionStep from './ophthalmology/components/SubjectiveRefractionStep';
import AdditionalTestsStep from './ophthalmology/components/AdditionalTestsStep';
import KeratometryStep from './ophthalmology/components/KeratometryStep';
import PrescriptionStep from './ophthalmology/components/PrescriptionStep';
import consultationSessionService from '../services/consultationSessionService';
import ophthalmologyService from '../services/ophthalmologyService';
import commentTemplateService from '../services/commentTemplateService';
import { useAutoSave } from '../hooks/useAutoSave';
import { useTabProgression } from '../hooks/useTabProgression';
import AutoSaveIndicator from '../components/AutoSaveIndicator';
import PrescriptionWarningModal from '../components/PrescriptionWarningModal';
import NumberInputWithArrows from '../components/NumberInputWithArrows';
import DocumentGenerator from '../components/documents/DocumentGenerator';
import {
  checkAllergies,
  checkDrugInteractions,
  checkAgeAppropriateDosing
} from '../utils/prescriptionSafety';

// Define the clinical workflow tab order with full ophthalmology workflow
const TAB_ORDER = ['complaint', 'vitals', 'visual_acuity', 'objective_refraction', 'subjective_refraction', 'additional_tests', 'keratometry', 'examination', 'diagnosis', 'procedures', 'laboratory', 'prescription'];

const TAB_LABELS = {
  complaint: 'Plainte principale',
  vitals: 'Signes vitaux',
  visual_acuity: 'Acuité Visuelle',
  objective_refraction: 'Réfraction Objective',
  subjective_refraction: 'Réfraction Subjective',
  additional_tests: 'Tests Complémentaires',
  keratometry: 'Kératométrie',
  examination: 'Examen Ophtalmologique',
  diagnosis: 'Diagnostics',
  procedures: 'Examens Complémentaires',
  laboratory: 'Analyses Laboratoire',
  prescription: 'Prescription'
};

const PatientVisit = () => {
  const { id, patientId } = useParams(); // id for existing visit, patientId for new visit
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId'); // Get appointmentId from query params
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentVisitId, setCurrentVisitId] = useState(id);

  // Tab progression hook for guided workflow
  const {
    currentTab,
    completedTabs,
    completeTab,
    isTabEnabled,
    goToTab,
    goToNextTab,
    progress: tabProgress,
    isLastTab
  } = useTabProgression(TAB_ORDER, 0);

  // Visit data
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);

  // Consultation session state
  const [consultationSession, setConsultationSession] = useState(null);
  const [sessionData, setSessionData] = useState({
    refractionData: null,
    contactLensData: null,
    orthopticData: null
  });

  // Form data
  const [chiefComplaint, setChiefComplaint] = useState({
    complaint: '',
    duration: '',
    severity: 'moderate',
    onset: '',
    associatedSymptoms: [],
    motif: '', // Selected motif de consultation
    laterality: '' // OD, OG, or OD et OG
  });

  // Consultation motifs (fetched from template-catalog)
  const [consultationMotifs, setConsultationMotifs] = useState([]);
  const [motifsLoading, setMotifsLoading] = useState(false);

  const [vitalSigns, setVitalSigns] = useState({
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: ''
  });

  const [diagnoses, setDiagnoses] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medicationSearch, setMedicationSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Template-based data
  const [pathologyFindings, setPathologyFindings] = useState([]);
  const [laboratoryOrders, setLaboratoryOrders] = useState([]);
  const [examinationOrders, setExaminationOrders] = useState([]);

  // Patient timeline data
  const [patientAllergies, setPatientAllergies] = useState([]);
  const [currentMedications, setCurrentMedications] = useState([]);
  const [visitHistory, setVisitHistory] = useState([]);

  // Prescription safety
  const [prescriptionWarning, setPrescriptionWarning] = useState(null);

  // TOD/TOG (Intraocular Pressure)
  const [iop, setIop] = useState({
    OD: { value: 0, method: 'goldman', time: new Date().toISOString() },
    OS: { value: 0, method: 'goldman', time: new Date().toISOString() }
  });

  // Complete ophthalmology exam data structure
  const [examData, setExamData] = useState({
    examId: null,
    examiner: '',

    // Visual Acuity
    visualAcuity: {
      distance: {
        OD: { unaided: '', pinhole: '', corrected: '' },
        OS: { unaided: '', pinhole: '', corrected: '' }
      },
      near: {
        OD: { unaided: '', corrected: '' },
        OS: { unaided: '', corrected: '' }
      },
      format: 'Snellen',
      notes: ''
    },

    // Objective Refraction
    objective: {
      method: 'autorefractor',
      device: '',
      OD: { sphere: '', cylinder: '', axis: '' },
      OS: { sphere: '', cylinder: '', axis: '' },
      confidence: 5,
      notes: ''
    },

    // Subjective Refraction
    subjective: {
      OD: { sphere: '', cylinder: '', axis: '', va: '' },
      OS: { sphere: '', cylinder: '', axis: '', va: '' },
      crossCylinder: {
        OD: { refined: false },
        OS: { refined: false }
      },
      binocular: { balanced: false, dominantEye: '' },
      redGreen: { OD: '', OS: '' },
      notes: ''
    },

    // Keratometry
    keratometry: {
      OD: {
        k1: { power: '', axis: '' },
        k2: { power: '', axis: '' }
      },
      OS: {
        k1: { power: '', axis: '' },
        k2: { power: '', axis: '' }
      },
      notes: ''
    },

    // Additional Tests
    pupils: {
      OD: { size: '', reaction: 'Normal', rapd: false },
      OS: { size: '', reaction: 'Normal', rapd: false }
    },
    motility: {
      versions: 'Full',
      vergence: 'Normal',
      npc: '',
      coverTest: { distance: '', near: '' }
    },
    pupilDistance: {
      binocular: '',
      OD: '',
      OS: ''
    },

    // Final Prescription
    finalPrescription: {
      OD: { sphere: '', cylinder: '', axis: '' },
      OS: { sphere: '', cylinder: '', axis: '' },
      add: '',
      recommendations: []
    }
  });

  // Refraction history
  const [refractionHistory, setRefractionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryExam, setSelectedHistoryExam] = useState(null);

  // Comment templates for prescriptions
  const [commentTemplates, setCommentTemplates] = useState([]);
  const [selectedCommentTemplate, setSelectedCommentTemplate] = useState('');
  const [prescriptionComment, setPrescriptionComment] = useState('');

  // Lens types
  const [selectedLensTypes, setSelectedLensTypes] = useState([]);

  // Document generator
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);

  // PathologyQuickPick modal
  const [showPathologyPicker, setShowPathologyPicker] = useState(false);

  // Prescription status and type
  const [prescriptionStatus, setPrescriptionStatus] = useState('pending');
  const [prescriptionType, setPrescriptionType] = useState('glasses');
  const [showPrescriptionPreview, setShowPrescriptionPreview] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [refractionSummary, setRefractionSummary] = useState('');

  // Lens type options
  const LENS_TYPES = [
    { value: 'far', label: 'Loin', description: 'Vision de loin uniquement' },
    { value: 'near', label: 'Près', description: 'Vision de près uniquement' },
    { value: 'two_pairs', label: 'Deux Paires', description: 'Loin + Près séparés' },
    { value: 'progressive', label: 'Progressif', description: 'Vision progressive' },
    { value: 'bifocal', label: 'Bifocaux', description: 'Double foyer' },
    { value: 'varifocal', label: 'Varifocal', description: 'Multifocal' }
  ];

  // Auto-save function for consultation session
  const saveConsultationSession = async (data, isAutoSave) => {
    if (!consultationSession?._id) {
      // No active session to save
      return;
    }

    try {
      await consultationSessionService.updateSession(
        consultationSession._id,
        data,
        isAutoSave
      );
    } catch (error) {
      console.error('Error saving consultation session:', error);
      throw error;
    }
  };

  // Use auto-save hook for consultation tabs
  const { saveStatus, lastSaved, error: saveError, manualSave } = useAutoSave(
    sessionData,
    saveConsultationSession,
    {
      interval: 30000, // Auto-save every 30 seconds
      debounceDelay: 2000, // Wait 2 seconds after last change
      enabled: Boolean(consultationSession?._id) && ['visual_acuity', 'objective_refraction', 'subjective_refraction', 'additional_tests', 'keratometry'].includes(currentTab)
    }
  );

  // localStorage draft recovery key
  const draftKey = currentVisitId ? `visit_draft_${currentVisitId}` : id ? `visit_draft_${id}` : null;

  // Save draft to localStorage when data changes
  useEffect(() => {
    if (!draftKey) return;

    const draft = {
      chiefComplaint,
      vitalSigns,
      diagnoses,
      pathologyFindings,
      laboratoryOrders,
      examinationOrders,
      examData,
      iop,
      prescriptionStatus,
      prescriptionType,
      selectedLensTypes,
      prescriptionComment,
      refractionSummary,
      medications,
      completedTabs,
      currentTab,
      lastModified: new Date().toISOString()
    };

    // Debounce saving to localStorage
    const timeoutId = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [
    draftKey, chiefComplaint, vitalSigns, diagnoses, pathologyFindings,
    laboratoryOrders, examinationOrders, examData, iop, prescriptionStatus,
    prescriptionType, selectedLensTypes, prescriptionComment, refractionSummary,
    medications, completedTabs, currentTab
  ]);

  // Restore draft from localStorage on load
  useEffect(() => {
    if (!draftKey) return;

    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const lastModified = new Date(draft.lastModified);
        const hoursSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60);

        // Only restore if draft is less than 24 hours old
        if (hoursSinceModified < 24) {
          const shouldRestore = window.confirm(
            `Un brouillon sauvegardé le ${lastModified.toLocaleString('fr-FR')} a été trouvé. Voulez-vous le restaurer?`
          );

          if (shouldRestore) {
            if (draft.chiefComplaint) setChiefComplaint(draft.chiefComplaint);
            if (draft.vitalSigns) setVitalSigns(draft.vitalSigns);
            if (draft.diagnoses) setDiagnoses(draft.diagnoses);
            if (draft.pathologyFindings) setPathologyFindings(draft.pathologyFindings);
            if (draft.laboratoryOrders) setLaboratoryOrders(draft.laboratoryOrders);
            if (draft.examinationOrders) setExaminationOrders(draft.examinationOrders);
            if (draft.examData) setExamData(prev => ({ ...prev, ...draft.examData }));
            if (draft.iop) setIop(draft.iop);
            if (draft.prescriptionStatus) setPrescriptionStatus(draft.prescriptionStatus);
            if (draft.prescriptionType) setPrescriptionType(draft.prescriptionType);
            if (draft.selectedLensTypes) setSelectedLensTypes(draft.selectedLensTypes);
            if (draft.prescriptionComment) setPrescriptionComment(draft.prescriptionComment);
            if (draft.refractionSummary) setRefractionSummary(draft.refractionSummary);
            if (draft.medications) setMedications(draft.medications);
            if (draft.completedTabs) setCompletedTabs(draft.completedTabs);
            if (draft.currentTab) setCurrentTab(draft.currentTab);
          } else {
            // Clear draft if user doesn't want it
            localStorage.removeItem(draftKey);
          }
        } else {
          // Clear old draft
          localStorage.removeItem(draftKey);
        }
      } catch (e) {
        console.error('Error parsing draft:', e);
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey]);

  // Clear draft after successful save
  const clearDraft = () => {
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
  };

  // Load visit data or create new visit
  useEffect(() => {
    if (id) {
      // Existing visit - fetch it
      fetchVisit(id);
    } else if (patientId) {
      // New visit - create it first
      createNewVisit();
    }
  }, [id, patientId]);

  // Fetch consultation motifs from template-catalog
  useEffect(() => {
    const fetchConsultationMotifs = async () => {
      try {
        setMotifsLoading(true);
        const response = await api.get('/template-catalog/pathologies', {
          params: { category: 'MOTIF DE CONSULTATION' }
        });
        const motifs = response.data?.data || response.data || [];
        setConsultationMotifs(motifs);
      } catch (error) {
        console.error('Error fetching consultation motifs:', error);
      } finally {
        setMotifsLoading(false);
      }
    };

    fetchConsultationMotifs();
  }, []);

  // Create a new visit for the patient
  const createNewVisit = async () => {
    try {
      setLoading(true);

      // First fetch patient info
      const patientResponse = await api.get(`/patients/${patientId}`);

      const patientData = patientResponse.data.data || patientResponse.data;
      setPatient(patientData);

      // Create a new visit - link to appointment if coming from queue
      const visitData = {
        patient: patientId,
        visitType: 'consultation',
        visitDate: new Date(),
        status: 'in-progress' // Use hyphen, not underscore
      };

      // Link to appointment if coming from queue
      if (appointmentId) {
        visitData.appointment = appointmentId;
      }

      const visitResponse = await api.post('/visits', visitData);

      const newVisit = visitResponse.data.data;
      setVisit(newVisit);
      setCurrentVisitId(newVisit._id);

      // Update URL to include visit ID (for refreshes)
      navigate(`/visits/${newVisit._id}`, { replace: true });

      setLoading(false);
    } catch (error) {
      console.error('Error creating visit:', error);
      alert('Erreur lors de la création de la visite: ' + (error.response?.data?.error || error.message));
      setLoading(false);
      navigate('/queue');
    }
  };

  const fetchVisit = async (visitIdParam) => {
    try {
      setLoading(true);
      const idToFetch = visitIdParam || currentVisitId;
      const response = await api.get(`/visits/${idToFetch}`);

      const visitData = response.data.data;
      setVisit(visitData);
      setPatient(visitData.patient);

      // Populate forms with existing data
      if (visitData.chiefComplaint) {
        setChiefComplaint(visitData.chiefComplaint);
      }
      if (visitData.physicalExamination?.vitalSigns) {
        setVitalSigns(visitData.physicalExamination.vitalSigns);
      }
      if (visitData.diagnoses) {
        setDiagnoses(visitData.diagnoses);
      }
      if (visitData.pathologyFindings) {
        setPathologyFindings(visitData.pathologyFindings);
      }
      if (visitData.laboratoryOrders) {
        setLaboratoryOrders(visitData.laboratoryOrders);
      }
      if (visitData.examinationOrders) {
        setExaminationOrders(visitData.examinationOrders);
      }

      // Load ophthalmology data
      if (visitData.ophthalmologyExam) {
        setExamData(prev => ({ ...prev, ...visitData.ophthalmologyExam }));
      }
      if (visitData.iop) {
        setIop(visitData.iop);
      }
      if (visitData.prescriptionStatus) {
        setPrescriptionStatus(visitData.prescriptionStatus);
      }
      if (visitData.prescriptionType) {
        setPrescriptionType(visitData.prescriptionType);
      }
      if (visitData.selectedLensTypes) {
        setSelectedLensTypes(visitData.selectedLensTypes);
      }
      if (visitData.prescriptionComment) {
        setPrescriptionComment(visitData.prescriptionComment);
      }
      if (visitData.refractionSummary) {
        setRefractionSummary(visitData.refractionSummary);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching visit:', error);
      setLoading(false);
    }
  };

  // Load refraction history when patient is loaded
  useEffect(() => {
    const loadRefractionHistory = async () => {
      if (!patient?._id) return;

      try {
        setLoadingHistory(true);
        const response = await ophthalmologyService.getRefractionHistory(patient._id);
        if (response.data) {
          setRefractionHistory(response.data);
        }
      } catch (err) {
        console.error('Error loading refraction history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadRefractionHistory();
  }, [patient?._id]);

  // Load comment templates on mount
  useEffect(() => {
    const loadCommentTemplates = async () => {
      try {
        const response = await commentTemplateService.getCommentTemplates();
        if (response.data) {
          setCommentTemplates(response.data);
        }
      } catch (error) {
        console.error('Error loading comment templates:', error);
      }
    };

    loadCommentTemplates();
  }, []);

  // Handle copying from previous refraction
  const handleCopyFromPrevious = async () => {
    if (!patient?._id) return;

    try {
      const response = await ophthalmologyService.copyFromPreviousRefraction(patient._id);
      if (response.data) {
        alert('Données copiées de l\'examen précédent');
        // Reload history
        const historyResponse = await ophthalmologyService.getRefractionHistory(patient._id);
        if (historyResponse.data) {
          setRefractionHistory(historyResponse.data);
        }
      }
    } catch (err) {
      console.error('Error copying from previous:', err);
      alert(err.response?.data?.error || 'Aucun examen précédent trouvé');
    }
  };

  // Handle selecting a historical exam
  const handleSelectHistoricalExam = async (examId) => {
    try {
      setSelectedHistoryExam(examId);
      const response = await ophthalmologyService.getExam(examId);
      if (response.data && response.data.iop) {
        setIop(response.data.iop);
      }
    } catch (err) {
      console.error('Error loading historical exam:', err);
    }
  };

  // Handle comment template selection
  const handleCommentSelect = async (templateId) => {
    setSelectedCommentTemplate(templateId);

    if (templateId) {
      const template = commentTemplates.find(t => t._id === templateId);
      if (template) {
        setPrescriptionComment(template.text);
        // Increment usage count
        try {
          await commentTemplateService.incrementUsage(templateId);
        } catch (error) {
          console.error('Error incrementing template usage:', error);
        }
      }
    }
  };

  // Toggle lens type
  const toggleLensType = (type) => {
    setSelectedLensTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Handle pathology selection from PathologyQuickPick
  const handlePathologySelect = (selectedPathologies) => {
    const newFindings = selectedPathologies.map(p => ({
      name: p.name,
      category: p.category,
      subcategory: p.subCategory,
      icdCode: p.icdCode,
      laterality: 'ODG', // Valid enum: 'OD', 'OG', 'ODG', 'Droite', 'Gauche', 'Bilatéral'
      severity: '+', // Valid enum: '-', '+/-', '+', '++', '+++', '++++', '0'
      notes: ''
    }));
    setPathologyFindings([...pathologyFindings, ...newFindings]);
    setShowPathologyPicker(false);
  };

  // Search medications using unified medication service
  const searchMedications = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const result = await medicationService.searchMedications(query, { limit: 10 });

      if (result.success) {
        setSearchResults(result.data);
      } else {
        setSearchResults([]);
      }
      setSearchLoading(false);
    } catch (error) {
      console.error('Error searching medications:', error);
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (medicationSearch) {
        searchMedications(medicationSearch);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [medicationSearch]);

  // Add medication to prescription with safety checks
  const addMedication = async (drug) => {
    // Calculate patient age
    const patientAge = patient?.dateOfBirth
      ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()
      : null;

    // Run safety checks
    const allergyCheck = checkAllergies(patient, drug);
    const interactionCheck = checkDrugInteractions(drug, medications);
    const ageCheck = patientAge ? checkAgeAppropriateDosing(drug, patientAge) : { appropriate: true };

    // CRITICAL: Allergy warning
    if (allergyCheck.hasAllergy) {
      setPrescriptionWarning({
        severity: 'critical',
        title: '🚨 ALLERGIE CONNUE',
        message: `${patient.firstName} ${patient.lastName} est allergique à ${allergyCheck.allergen}`,
        details: `Ce patient a une allergie documentée à ${allergyCheck.allergen}.\n\nRéaction connue: ${allergyCheck.reaction || 'Non spécifiée'}\n\nCe médicament peut causer une réaction allergique grave.`,
        allergen: allergyCheck.allergen,
        reaction: allergyCheck.reaction,
        recommendations: [
          'Vérifier l\'historique complet des allergies du patient',
          'Considérer une alternative thérapeutique',
          'Si aucune alternative n\'existe, consulter un allergologue',
          'Préparer un protocole d\'urgence en cas de réaction'
        ],
        drug,
        onConfirm: () => {
          proceedWithMedication(drug);
          setPrescriptionWarning(null);
        }
      });
      return;
    }

    // MAJOR: Critical drug interactions
    if (interactionCheck.hasCritical || interactionCheck.hasMajor) {
      const criticalInteractions = [
        ...(interactionCheck.contraindicated || []),
        ...(interactionCheck.major || [])
      ];

      setPrescriptionWarning({
        severity: interactionCheck.hasCritical ? 'critical' : 'high',
        title: interactionCheck.hasCritical ? '🛑 INTERACTION CONTRE-INDIQUÉE' : '⚠️ INTERACTION MAJEURE',
        message: `Ce médicament a des interactions ${interactionCheck.hasCritical ? 'contre-indiquées' : 'majeures'} avec les médicaments actuels du patient`,
        details: `${criticalInteractions.length} interaction(s) ${interactionCheck.hasCritical ? 'critique(s)' : 'majeure(s)'} détectée(s)`,
        interactions: criticalInteractions,
        recommendations: criticalInteractions.map(i => i.management).filter(Boolean),
        drug,
        onConfirm: () => {
          proceedWithMedication(drug);
          setPrescriptionWarning(null);
        }
      });
      return;
    }

    // WARNING: Age-inappropriate dosing
    if (!ageCheck.appropriate) {
      setPrescriptionWarning({
        severity: 'high',
        title: '⚠️ DOSAGE PÉDIATRIQUE NON DISPONIBLE',
        message: ageCheck.reason,
        details: ageCheck.minAge
          ? `Ce médicament est recommandé pour les patients âgés d'au moins ${ageCheck.minAge} ans.\n\nLe patient a actuellement ${patientAge} ans.`
          : `Aucune information de dosage pédiatrique n'est disponible pour ce médicament.`,
        recommendations: [
          'Vérifier les recommandations pédiatriques spécifiques',
          'Ajuster la dose en fonction du poids si disponible',
          'Considérer une alternative adaptée à l\'âge',
          'Consulter un pédiatre si nécessaire'
        ],
        drug,
        onConfirm: () => {
          proceedWithMedication(drug);
          setPrescriptionWarning(null);
        }
      });
      return;
    }

    // MODERATE: Non-critical interactions
    if (interactionCheck.hasModerate) {
      setPrescriptionWarning({
        severity: 'medium',
        title: '⚠️ INTERACTION MODÉRÉE',
        message: 'Ce médicament a des interactions modérées avec les médicaments actuels',
        details: `${interactionCheck.moderate.length} interaction(s) modérée(s) détectée(s)`,
        interactions: interactionCheck.moderate,
        recommendations: [
          'Surveiller l\'efficacité des deux médicaments',
          'Ajuster les doses si nécessaire',
          'Informer le patient des effets possibles'
        ],
        drug,
        onConfirm: () => {
          proceedWithMedication(drug);
          setPrescriptionWarning(null);
        }
      });
      return;
    }

    // INFO: Requires dose adjustment
    if (ageCheck.requiresAdjustment) {
      setPrescriptionWarning({
        severity: 'medium',
        title: '📋 AJUSTEMENT POSOLOGIQUE REQUIS',
        message: 'Ajustement de dose recommandé pour ce patient',
        details: ageCheck.adjustment || ageCheck.message,
        recommendations: [
          ageCheck.recommendation || 'Ajuster la dose selon les recommandations',
          'Surveiller l\'efficacité et la tolérance',
          'Commencer par une dose réduite si approprié'
        ],
        drug,
        onConfirm: () => {
          proceedWithMedication(drug);
          setPrescriptionWarning(null);
        }
      });
      return;
    }

    // No warnings - proceed directly
    proceedWithMedication(drug);
  };

  // Helper function to actually add medication (after safety checks passed)
  const proceedWithMedication = (drug) => {
    // Handle normalized format from medicationService
    // The original data (with inventory) is stored in drug.original when source is 'pharmacy'
    const originalData = drug.original || drug;
    const inventory = originalData.inventory;

    const newMedication = {
      drug: drug._id || originalData.drugId,
      inventoryItem: inventory?.inventoryId || inventory?._id,
      name: drug.name || drug.brandName || originalData.brandName,
      genericName: drug.genericName || originalData.genericName,
      strength: drug.strength || originalData.strength,
      form: drug.form || originalData.form,
      route: drug.route || originalData.route,
      quantity: 1,
      unit: 'unité',
      dosage: {
        amount: 1,
        unit: 'comprimé',
        frequency: { times: 1, period: 'day' },
        duration: { value: 7, unit: 'days' },
        timing: ['morning'],
        withFood: 'anytime'
      },
      instructions: '',
      indication: '',
      refills: { allowed: 0, remaining: 0 },
      pricing: inventory?.pricing || {},
      source: drug.source // Track where this medication came from
    };

    setMedications([...medications, newMedication]);
    setMedicationSearch('');
    setSearchResults([]);
  };

  // Remove medication
  const removeMedication = (index) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  // Update medication
  const updateMedication = (index, field, value) => {
    const updated = [...medications];
    const keys = field.split('.');

    if (keys.length === 1) {
      updated[index][field] = value;
    } else if (keys.length === 2) {
      updated[index][keys[0]][keys[1]] = value;
    } else if (keys.length === 3) {
      updated[index][keys[0]][keys[1]][keys[2]] = value;
    }

    setMedications(updated);
  };

  // Add diagnosis
  const addDiagnosis = () => {
    setDiagnoses([...diagnoses, { code: '', description: '', type: 'primary', laterality: 'NA' }]);
  };

  // Update diagnosis
  const updateDiagnosis = (index, field, value) => {
    const updated = [...diagnoses];
    updated[index][field] = value;
    setDiagnoses(updated);
  };

  // Remove diagnosis
  const removeDiagnosis = (index) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== index));
  };

  // Save visit
  const saveVisit = async () => {
    try {
      setSaving(true);
      const idToSave = currentVisitId || id;

      // Filter out incomplete diagnoses (code and description are required)
      const validDiagnoses = diagnoses.filter(d => d.code && d.code.trim() && d.description && d.description.trim());

      // Update visit data with all ophthalmology fields
      await api.put(`/visits/${idToSave}`, {
        chiefComplaint,
        physicalExamination: { vitalSigns },
        diagnoses: validDiagnoses,
        pathologyFindings,
        laboratoryOrders,
        examinationOrders,
        // Ophthalmology examination data
        ophthalmologyExam: examData,
        iop,
        prescriptionStatus,
        prescriptionType,
        selectedLensTypes,
        prescriptionComment,
        refractionSummary
      });

      // Create prescription if medications added
      if (medications.length > 0) {
        await api.post(`/visits/${idToSave}/prescriptions`, {
          type: 'medication',
          medications,
          dateIssued: new Date(),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        });
      }

      // Create optical prescription if lens types selected
      if (selectedLensTypes.length > 0 && prescriptionStatus === 'prescribed') {
        await api.post(`/visits/${idToSave}/prescriptions`, {
          type: 'optical',
          lensTypes: selectedLensTypes,
          prescriptionStatus,
          prescriptionType,
          comment: prescriptionComment,
          dateIssued: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year for optical
        });
      }

      alert('Visite enregistrée avec succès');
      setSaving(false);
      clearDraft(); // Clear localStorage draft after successful save
      fetchVisit(idToSave); // Reload
    } catch (error) {
      console.error('Error saving visit:', error);
      alert(`Erreur lors de l'enregistrement: ${error.response?.data?.error || error.message}`);
      setSaving(false);
    }
  };

  // Complete visit
  const completeVisit = async () => {
    if (!window.confirm('Terminer cette visite? Cela va réserver l\'inventaire et générer la facture.')) {
      return;
    }

    try {
      setSaving(true);
      const idToComplete = currentVisitId || id;

      const response = await api.put(`/visits/${idToComplete}/complete`, {});

      const result = response.data.data;

      let message = 'Visite terminée avec succès!\n\n';
      if (result.invoiceGenerated) {
        message += '✓ Facture générée\n';
      }
      if (result.reservations && result.reservations.length > 0) {
        const successCount = result.reservations.filter(r => r.success).length;
        message += `✓ ${successCount}/${result.reservations.length} médicaments réservés\n`;
      }

      alert(message);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing visit:', error);
      alert('Erreur lors de la finalisation: ' + (error.response?.data?.error || error.message));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar - Patient Timeline */}
        <div className="col-span-3 space-y-4">
          {/* Patient Demographics */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Patient</h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{patient?.firstName} {patient?.lastName}</p>
              <p className="text-gray-600">ID: {patient?.patientId}</p>
              <p className="text-gray-600">
                {patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('fr-FR') : ''} ({patient?.gender})
              </p>
              {patient?.phone && <p className="text-gray-600">📞 {patient.phone}</p>}
            </div>
          </div>

          {/* Allergies Alert */}
          {patient?.allergies && patient.allergies.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center">
                ⚠️ Allergies
              </h3>
              <ul className="space-y-1 text-sm">
                {patient.allergies.map((allergy, idx) => (
                  <li key={idx} className="text-red-700">{allergy.allergen}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Current Medications */}
          {patient?.currentMedications && patient.currentMedications.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Médicaments actuels</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                {patient.currentMedications.slice(0, 5).map((med, idx) => (
                  <li key={idx} className="truncate">{med.name}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Visit History */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Visites récentes</h3>
            {visitHistory.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {visitHistory.slice(0, 5).map((v, idx) => (
                  <li key={idx} className="border-b border-gray-100 pb-2 last:border-0">
                    <p className="text-gray-600">{new Date(v.visitDate).toLocaleDateString('fr-FR')}</p>
                    <p className="text-gray-900 truncate">{v.chiefComplaint?.complaint || v.visitType}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Aucune visite récente</p>
            )}
          </div>

          {/* Refraction History */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                Réfractions
              </h3>
            </div>

            <div className="space-y-2 mb-3">
              <button
                onClick={handleCopyFromPrevious}
                disabled={loadingHistory}
                className="w-full flex items-center justify-center px-2 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copier précédent
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center text-gray-500 py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : refractionHistory.length === 0 ? (
              <p className="text-xs text-gray-500 text-center">Aucune réfraction précédente</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {refractionHistory.slice(0, 5).map((exam) => (
                  <button
                    key={exam._id}
                    onClick={() => handleSelectHistoricalExam(exam._id)}
                    className={`w-full p-2 rounded text-left transition-all text-xs ${
                      selectedHistoryExam === exam._id
                        ? 'bg-blue-100 border border-blue-300'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(exam.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                      {exam.isPreviousCopy && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">
                          Copie
                        </span>
                      )}
                    </div>
                    {exam.iop && (
                      <div className="mt-1 text-gray-500">
                        TOD: {exam.iop.OD?.value || 0} | TOG: {exam.iop.OS?.value || 0}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col-span-9">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {patient?.firstName} {patient?.lastName}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Visite: {visit?.visitId} • {new Date(visit?.visitDate).toLocaleDateString('fr-FR')} • {visit?.visitType}
                </p>
                {/* Auto-save indicator for consultation tabs */}
                {['refraction', 'contact_lens', 'orthoptic'].includes(currentTab) && (
                  <div className="mt-2">
                    <AutoSaveIndicator
                      saveStatus={saveStatus}
                      lastSaved={lastSaved}
                      error={saveError}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDocumentGenerator(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  title="Générer un document"
                >
                  <FileText className="w-4 h-4" />
                  Document
                </button>
                <button
                  onClick={saveVisit}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={completeVisit}
                  disabled={saving || visit?.status === 'completed'}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {visit?.status === 'completed' ? 'Terminée' : 'Terminer la visite'}
                </button>
              </div>
            </div>

            {/* TOD/TOG Section - Intraocular Pressure */}
            <div className="flex items-center gap-4 pt-4 mt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">TOD:</span>
                <NumberInputWithArrows
                  value={iop.OD.value}
                  onChange={(val) => setIop(prev => ({
                    ...prev,
                    OD: { ...prev.OD, value: val }
                  }))}
                  step={1}
                  min={0}
                  max={50}
                  unit="mmHg"
                  precision={0}
                  className="w-32"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">TOG:</span>
                <NumberInputWithArrows
                  value={iop.OS.value}
                  onChange={(val) => setIop(prev => ({
                    ...prev,
                    OS: { ...prev.OS, value: val }
                  }))}
                  step={1}
                  min={0}
                  max={50}
                  unit="mmHg"
                  precision={0}
                  className="w-32"
                />
              </div>
              <div className="text-xs text-gray-500">
                Tension Oculaire (Intraocular Pressure)
              </div>
            </div>
          </div>

      {/* Tabs with Progression */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${tabProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            {completedTabs.length} / {TAB_ORDER.length} sections complétées
          </p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {TAB_ORDER.map((tab) => {
              const enabled = isTabEnabled(tab);
              const completed = completedTabs.includes(tab);
              const isCurrent = currentTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => enabled && goToTab(tab)}
                  disabled={!enabled}
                  className={`px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-all ${
                    isCurrent
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : enabled
                      ? 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
                      : 'border-transparent text-gray-400 cursor-not-allowed opacity-50'
                  }`}
                >
                  {completed && <Check className="inline h-4 w-4 mr-1 text-green-600" />}
                  {TAB_LABELS[tab]}
                  {!enabled && !completed && ' 🔒'}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Chief Complaint Tab */}
          {currentTab === 'complaint' && (
            <div className="space-y-4">
              {/* Motif de Consultation Selector - Only actual symptoms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif de consultation
                </label>
                {motifsLoading ? (
                  <div className="flex items-center text-gray-500">
                    <span className="animate-spin mr-2">⟳</span> Chargement des motifs...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {consultationMotifs
                      .filter(motif => {
                        const name = (motif.name || motif.pathology || '').toLowerCase();
                        // Filter out duration, onset, and laterality options - keep only symptoms
                        const excludePatterns = [
                          'depuis', 'brutalement', 'progressivement',
                          'oeil droit', 'oeil gauche', 'od et og'
                        ];
                        return !excludePatterns.some(pattern => name.includes(pattern));
                      })
                      .map((motif) => (
                        <button
                          key={motif._id || motif.id}
                          type="button"
                          onClick={() => {
                            const motifName = motif.name || motif.pathology;
                            setChiefComplaint(prev => ({
                              ...prev,
                              motif: prev.motif === motifName ? '' : motifName
                            }));
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            chiefComplaint.motif === (motif.name || motif.pathology)
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {motif.name || motif.pathology}
                        </button>
                      ))}
                    {consultationMotifs.length === 0 && (
                      <span className="text-gray-500 text-sm">Aucun motif disponible</span>
                    )}
                  </div>
                )}
                {chiefComplaint.motif && (
                  <p className="mt-2 text-sm text-blue-600">
                    Motif sélectionné: <strong>{chiefComplaint.motif}</strong>
                  </p>
                )}
              </div>

              {/* Laterality Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latéralité
                </label>
                <div className="flex gap-2">
                  {['OD', 'OG', 'OD et OG'].map((lat) => (
                    <button
                      key={lat}
                      type="button"
                      onClick={() => setChiefComplaint(prev => ({
                        ...prev,
                        laterality: prev.laterality === lat ? '' : lat
                      }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        chiefComplaint.laterality === lat
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lat === 'OD' ? 'Oeil droit (OD)' : lat === 'OG' ? 'Oeil gauche (OG)' : 'Les deux yeux'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plainte principale *
                </label>
                <textarea
                  value={chiefComplaint.complaint}
                  onChange={(e) => setChiefComplaint({ ...chiefComplaint, complaint: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Décrivez la plainte principale du patient..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Durée</label>
                  <select
                    value={chiefComplaint.duration}
                    onChange={(e) => setChiefComplaint({ ...chiefComplaint, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="depuis hier">Depuis hier</option>
                    <option value="depuis 2 jours">Depuis 2 jours</option>
                    <option value="depuis une semaine">Depuis une semaine</option>
                    <option value="depuis un mois">Depuis un mois</option>
                    <option value="depuis plusieurs mois">Depuis plusieurs mois</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sévérité</label>
                  <select
                    value={chiefComplaint.severity}
                    onChange={(e) => setChiefComplaint({ ...chiefComplaint, severity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="mild">Légère</option>
                    <option value="moderate">Modérée</option>
                    <option value="severe">Sévère</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Début</label>
                  <select
                    value={chiefComplaint.onset}
                    onChange={(e) => setChiefComplaint({ ...chiefComplaint, onset: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Brutalement">Brutalement</option>
                    <option value="Progressivement">Progressivement</option>
                  </select>
                </div>
              </div>

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (!(chiefComplaint.complaint || '').trim()) {
                      alert('Veuillez entrer la plainte principale avant de continuer');
                      return;
                    }
                    completeTab('complaint');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Signes Vitaux</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Vital Signs Tab */}
          {currentTab === 'vitals' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tension artérielle (mmHg)
                  </label>
                  <input
                    type="text"
                    value={vitalSigns.bloodPressure}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, bloodPressure: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="120/80"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fréquence cardiaque (bpm)
                  </label>
                  <input
                    type="number"
                    value={vitalSigns.heartRate}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, heartRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="72"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Température (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalSigns.temperature}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, temperature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="37.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fréquence respiratoire
                  </label>
                  <input
                    type="number"
                    value={vitalSigns.respiratoryRate}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, respiratoryRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="16"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Saturation O2 (%)
                  </label>
                  <input
                    type="number"
                    value={vitalSigns.oxygenSaturation}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, oxygenSaturation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="98"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Poids (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalSigns.weight}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, weight: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Taille (cm)
                  </label>
                  <input
                    type="number"
                    value={vitalSigns.height}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, height: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="170"
                  />
                </div>
              </div>

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('vitals');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Acuité Visuelle</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Visual Acuity Tab */}
          {currentTab === 'visual_acuity' && (
            <div className="space-y-4">
              <VisualAcuityStep
                data={examData}
                setData={setExamData}
              />

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('visual_acuity');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Réfraction Objective</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Objective Refraction Tab */}
          {currentTab === 'objective_refraction' && (
            <div className="space-y-4">
              <ObjectiveRefractionStep
                data={examData}
                setData={setExamData}
              />

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('objective_refraction');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Réfraction Subjective</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Subjective Refraction Tab */}
          {currentTab === 'subjective_refraction' && (
            <div className="space-y-4">
              <SubjectiveRefractionStep
                data={examData}
                setData={setExamData}
              />

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('subjective_refraction');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Tests Complémentaires</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Additional Tests Tab */}
          {currentTab === 'additional_tests' && (
            <div className="space-y-4">
              <AdditionalTestsStep
                data={examData}
                setData={setExamData}
              />

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('additional_tests');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Kératométrie</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Keratometry Tab */}
          {currentTab === 'keratometry' && (
            <div className="space-y-4">
              <KeratometryStep
                data={examData}
                setData={setExamData}
              />

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('keratometry');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Examen Ophtalmologique</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Examination Tab (Ophthalmology Examination Findings) */}
          {currentTab === 'examination' && (
            <div className="space-y-6">
              {/* PathologyQuickPick Button */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Résultats pathologiques</h3>
                <button
                  onClick={() => setShowPathologyPicker(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Sélectionner pathologies
                </button>
              </div>

              {/* Pathology Quick Pick Modal */}
              {showPathologyPicker && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                    <PathologyQuickPick
                      onSelect={handlePathologySelect}
                      selectedPathologies={pathologyFindings}
                      multiple={true}
                      onClose={() => setShowPathologyPicker(false)}
                    />
                  </div>
                </div>
              )}

              {/* List of Added Findings */}
              {pathologyFindings.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Résultats ajoutés ({pathologyFindings.length})</h4>
                  <div className="space-y-2">
                    {pathologyFindings.map((finding, index) => (
                      <div key={index} className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{finding.name}</div>
                          <div className="text-sm text-gray-600 mt-1 space-x-3">
                            {finding.category && <span className="text-blue-700">• {finding.category}</span>}
                            {finding.subcategory && <span>• {finding.subcategory}</span>}
                            {finding.laterality && <span>• Latéralité: {finding.laterality}</span>}
                            {finding.severity && <span>• Sévérité: {finding.severity}</span>}
                            {finding.location && <span>• {finding.location}</span>}
                            {finding.clockPosition && <span>• {finding.clockPosition}</span>}
                          </div>
                          {finding.notes && (
                            <div className="text-sm text-gray-500 mt-1 italic">{finding.notes}</div>
                          )}
                        </div>
                        <button
                          onClick={() => setPathologyFindings(pathologyFindings.filter((_, i) => i !== index))}
                          className="ml-3 text-red-600 hover:text-red-800 font-bold text-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pathologyFindings.length === 0 && (
                <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  Aucun résultat pathologique ajouté. Utilisez le sélecteur ci-dessus pour ajouter des résultats.
                </div>
              )}

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('examination');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Diagnostics</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Laboratory Orders Tab */}
          {currentTab === 'laboratory' && (
            <div className="space-y-6">
              {/* Laboratory Test Selector */}
              <LaboratoryTestSelector
                onAddTest={(test) => {
                  setLaboratoryOrders([...laboratoryOrders, test]);
                }}
              />

              {/* List of Ordered Tests */}
              {laboratoryOrders.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Tests commandés ({laboratoryOrders.length})</h4>
                  <div className="space-y-2">
                    {laboratoryOrders.map((order, index) => (
                      <div key={index} className="flex items-start justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{order.testName}</div>
                          <div className="text-sm text-gray-600 mt-1 space-x-3">
                            {order.category && <span className="text-green-700">• {order.category}</span>}
                            {order.specimen && <span>• Spécimen: {order.specimen}</span>}
                            {order.priority && <span>• Priorité: <span className={
                              order.priority === 'stat' ? 'text-red-600 font-semibold' :
                              order.priority === 'urgent' ? 'text-orange-600 font-semibold' :
                              'text-gray-600'
                            }>{order.priority.toUpperCase()}</span></span>}
                          </div>
                          {order.notes && (
                            <div className="text-sm text-gray-500 mt-1 italic">{order.notes}</div>
                          )}
                        </div>
                        <button
                          onClick={() => setLaboratoryOrders(laboratoryOrders.filter((_, i) => i !== index))}
                          className="ml-3 text-red-600 hover:text-red-800 font-bold text-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {laboratoryOrders.length === 0 && (
                <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  Aucun examen de laboratoire commandé. Utilisez le sélecteur ci-dessus pour commander des tests.
                </div>
              )}

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('laboratory');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Prescription</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Procedures Tab (Additional Tests/Examinations) */}
          {currentTab === 'procedures' && (
            <div className="space-y-6">
              {/* Examination Selector */}
              <ExaminationSelector
                onAddExamination={(exam) => {
                  setExaminationOrders([...examinationOrders, exam]);
                }}
              />

              {/* List of Ordered Examinations */}
              {examinationOrders.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Examens commandés ({examinationOrders.length})</h4>
                  <div className="space-y-2">
                    {examinationOrders.map((order, index) => (
                      <div key={index} className="flex items-start justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{order.examinationName}</div>
                          <div className="text-sm text-gray-600 mt-1 space-x-3">
                            {order.category && <span className="text-purple-700">• {order.category}</span>}
                            {order.scheduledDate && (
                              <span>• Prévu: {new Date(order.scheduledDate).toLocaleString('fr-FR')}</span>
                            )}
                          </div>
                          {order.notes && (
                            <div className="text-sm text-gray-500 mt-1 italic">{order.notes}</div>
                          )}
                        </div>
                        <button
                          onClick={() => setExaminationOrders(examinationOrders.filter((_, i) => i !== index))}
                          className="ml-3 text-red-600 hover:text-red-800 font-bold text-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {examinationOrders.length === 0 && (
                <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  Aucun examen commandé. Utilisez le sélecteur ci-dessus pour commander des examens.
                </div>
              )}

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    completeTab('procedures');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Analyses Laboratoire</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Diagnosis Tab */}
          {currentTab === 'diagnosis' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Diagnostics</h3>
                <button
                  onClick={addDiagnosis}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Ajouter diagnostic
                </button>
              </div>

              {diagnoses.map((diagnosis, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Code ICD-10
                      </label>
                      <input
                        type="text"
                        value={diagnosis.code}
                        onChange={(e) => updateDiagnosis(index, 'code', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="H10.1"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={diagnosis.description}
                        onChange={(e) => updateDiagnosis(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Conjonctivite aiguë"
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <select
                        value={diagnosis.type}
                        onChange={(e) => updateDiagnosis(index, 'type', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="primary">Primaire</option>
                        <option value="secondary">Secondaire</option>
                        <option value="rule-out">À éliminer</option>
                      </select>
                      <button
                        onClick={() => removeDiagnosis(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {diagnoses.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Aucun diagnostic ajouté. Cliquez sur "Ajouter diagnostic" pour commencer.
                </p>
              )}

              {/* Next Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (diagnoses.length === 0) {
                      alert('Veuillez ajouter au moins un diagnostic avant de continuer');
                      return;
                    }
                    completeTab('diagnosis');
                    goToNextTab(true);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Suivant: Examens Complémentaires</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Prescription Tab */}
          {currentTab === 'prescription' && (
            <div className="space-y-6">
              {/* Final Prescription Values Display */}
              <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                <h3 className="font-semibold text-blue-900 mb-4 text-lg">Prescription Optique Finale</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* OD */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-3">OD (Œil Droit)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Sphère</label>
                        <input
                          type="text"
                          value={examData.finalPrescription?.OD?.sphere || ''}
                          onChange={(e) => setExamData(prev => ({
                            ...prev,
                            finalPrescription: {
                              ...prev.finalPrescription,
                              OD: { ...prev.finalPrescription?.OD, sphere: e.target.value }
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Cylindre</label>
                        <input
                          type="text"
                          value={examData.finalPrescription?.OD?.cylinder || ''}
                          onChange={(e) => setExamData(prev => ({
                            ...prev,
                            finalPrescription: {
                              ...prev.finalPrescription,
                              OD: { ...prev.finalPrescription?.OD, cylinder: e.target.value }
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Axe</label>
                        <input
                          type="text"
                          value={examData.finalPrescription?.OD?.axis || ''}
                          onChange={(e) => setExamData(prev => ({
                            ...prev,
                            finalPrescription: {
                              ...prev.finalPrescription,
                              OD: { ...prev.finalPrescription?.OD, axis: e.target.value }
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="0°"
                        />
                      </div>
                    </div>
                  </div>
                  {/* OS */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-3">OS (Œil Gauche)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Sphère</label>
                        <input
                          type="text"
                          value={examData.finalPrescription?.OS?.sphere || ''}
                          onChange={(e) => setExamData(prev => ({
                            ...prev,
                            finalPrescription: {
                              ...prev.finalPrescription,
                              OS: { ...prev.finalPrescription?.OS, sphere: e.target.value }
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Cylindre</label>
                        <input
                          type="text"
                          value={examData.finalPrescription?.OS?.cylinder || ''}
                          onChange={(e) => setExamData(prev => ({
                            ...prev,
                            finalPrescription: {
                              ...prev.finalPrescription,
                              OS: { ...prev.finalPrescription?.OS, cylinder: e.target.value }
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Axe</label>
                        <input
                          type="text"
                          value={examData.finalPrescription?.OS?.axis || ''}
                          onChange={(e) => setExamData(prev => ({
                            ...prev,
                            finalPrescription: {
                              ...prev.finalPrescription,
                              OS: { ...prev.finalPrescription?.OS, axis: e.target.value }
                            }
                          }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="0°"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Addition for presbyopia */}
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700">Addition (VP)</label>
                  <input
                    type="text"
                    value={examData.finalPrescription?.add || ''}
                    onChange={(e) => setExamData(prev => ({
                      ...prev,
                      finalPrescription: { ...prev.finalPrescription, add: e.target.value }
                    }))}
                    className="mt-1 w-32 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="+0.00"
                  />
                </div>
              </div>

              {/* Prescription Status Buttons */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
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

              {/* Lens Type Selection - Only shown when prescribed */}
              {prescriptionStatus === 'prescribed' && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
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
              <div className="flex flex-wrap gap-4">
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

              {/* Comments Section */}
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Commentaires et Notes
                </h3>

                {/* Comment Template Selector */}
                <div className="mb-3">
                  <label className="text-sm font-medium text-gray-700">Modèle de commentaire</label>
                  <select
                    value={selectedCommentTemplate}
                    onChange={(e) => handleCommentSelect(e.target.value)}
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
                    value={prescriptionComment}
                    onChange={(e) => setPrescriptionComment(e.target.value)}
                  />
                </div>

                {/* Summary Generation Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      setGeneratingSummary(true);
                      // Simulate summary generation
                      setTimeout(() => {
                        setRefractionSummary('Réfraction complète effectuée. Correction prescrite selon les résultats de l\'examen.');
                        setGeneratingSummary(false);
                      }, 1000);
                    }}
                    disabled={generatingSummary}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileEdit className="w-4 h-4 mr-2" />
                    {generatingSummary ? 'Génération...' : 'Rédiger la réfraction'}
                  </button>
                </div>

                {/* Generated Summary Display */}
                {refractionSummary && (
                  <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Résumé de Réfraction</h4>
                    <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700">{refractionSummary}</pre>
                  </div>
                )}
              </div>

              {/* Medication Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rechercher un médicament
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={medicationSearch}
                    onChange={(e) => setMedicationSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Nom du médicament..."
                  />

                  {searchLoading && (
                    <div className="absolute right-3 top-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                      {searchResults.map((drug, index) => {
                        // Handle normalized format - inventory is in original if from pharmacy
                        const inventory = drug.original?.inventory || drug.inventory;
                        return (
                          <div
                            key={drug._id || index}
                            onClick={() => addMedication(drug)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{drug.name || drug.brandName}</p>
                                <p className="text-sm text-gray-600">{drug.genericName}</p>
                                <p className="text-xs text-gray-500">
                                  {drug.strength} • {drug.form} • {drug.route}
                                </p>
                                {drug.source && (
                                  <p className="text-xs text-blue-500 mt-1">
                                    Source: {drug.source === 'template-catalog' ? 'Catalogue' : 'Pharmacie'}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                {inventory ? (
                                  <>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      (inventory.available || inventory.currentStock) > 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {(inventory.available || inventory.currentStock) > 0 ? 'En stock' : 'Rupture'}
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Disponible: {inventory.available || inventory.currentStock || 0}
                                    </p>
                                    {inventory.pricing?.sellingPrice && (
                                      <p className="text-xs text-gray-500">
                                        {inventory.pricing.sellingPrice} CFA
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {drug.source === 'template-catalog' ? 'Catalogue' : 'Non inventorié'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Medications List */}
              <div className="space-y-3">
                {medications.map((med, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{med.name}</h4>
                        <p className="text-sm text-gray-600">{med.genericName}</p>
                      </div>
                      <button
                        onClick={() => removeMedication(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        × Retirer
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Quantité</label>
                        <input
                          type="number"
                          value={med.quantity}
                          onChange={(e) => updateMedication(index, 'quantity', parseInt(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Dose</label>
                        <input
                          type="number"
                          value={med.dosage.amount}
                          onChange={(e) => updateMedication(index, 'dosage.amount', parseInt(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Fréquence/jour</label>
                        <input
                          type="number"
                          value={med.dosage.frequency.times}
                          onChange={(e) => updateMedication(index, 'dosage.frequency.times', parseInt(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Durée (jours)</label>
                        <input
                          type="number"
                          value={med.dosage.duration.value}
                          onChange={(e) => updateMedication(index, 'dosage.duration.value', parseInt(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs text-gray-600 mb-1">Instructions</label>
                      <input
                        type="text"
                        value={med.instructions}
                        onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="Prendre avec de l'eau..."
                      />
                    </div>
                  </div>
                ))}

                {medications.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Aucun médicament prescrit. Recherchez et ajoutez des médicaments ci-dessus.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-wrap justify-between gap-4 mb-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        completeTab('prescription');
                        alert('Prescription validée!');
                      }}
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
                      Voir ordonnance
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimer
                    </button>
                    <button
                      onClick={() => alert('Prescription envoyée au patient par SMS/Email')}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer au Patient
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Utilisez "Enregistrer" en haut pour sauvegarder ou "Terminer la visite" pour finaliser.
                </p>
              </div>
            </div>
          )}

          {/* Prescription Preview Modal */}
          {showPrescriptionPreview && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Aperçu de l'Ordonnance</h3>
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
                      <p>Date: {new Date().toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Informations Patient</h3>
                    <p><strong>Nom:</strong> {patient?.firstName} {patient?.lastName}</p>
                    <p><strong>ID:</strong> {patient?.patientId}</p>
                    {patient?.dateOfBirth && (
                      <p><strong>Date de naissance:</strong> {new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}</p>
                    )}
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

                  {/* Prescription Status */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Statut</h3>
                    <p className="capitalize">{prescriptionStatus.replace('_', ' ')}</p>
                  </div>

                  {/* Medications */}
                  {medications.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3">Médicaments Prescrits</h3>
                      <div className="space-y-2">
                        {medications.map((med, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium">{med.name}</p>
                            <p className="text-sm text-gray-600">
                              {med.dosage.amount} {med.dosage.unit} - {med.dosage.frequency.times}x/jour pendant {med.dosage.duration.value} jours
                            </p>
                            {med.instructions && (
                              <p className="text-sm text-gray-500 italic mt-1">{med.instructions}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  {prescriptionComment && (
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                      <h3 className="font-semibold mb-2">Commentaires</h3>
                      <p className="text-sm whitespace-pre-wrap">{prescriptionComment}</p>
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
                      window.print();
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
      </div>
        </div>
      </div>

      {/* Prescription Warning Modal */}
      {prescriptionWarning && (
        <PrescriptionWarningModal
          warning={prescriptionWarning}
          onConfirm={prescriptionWarning.onConfirm}
          onCancel={() => setPrescriptionWarning(null)}
          patientName={`${patient?.firstName} ${patient?.lastName}`}
          drugName={prescriptionWarning.drug?.genericName || prescriptionWarning.drug?.brandName || 'Médicament'}
        />
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && patient && (
        <DocumentGenerator
          patientId={patient._id}
          visitId={currentVisitId}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            alert('Document généré avec succès!');
            setShowDocumentGenerator(false);
          }}
        />
      )}
    </div>
  );
};

export default PatientVisit;
