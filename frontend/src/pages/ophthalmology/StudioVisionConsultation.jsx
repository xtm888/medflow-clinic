/**
 * StudioVisionConsultation - Tab-based consultation view matching StudioVision XP
 *
 * Features:
 * - Tab navigation: Résumé | Réfraction | Lentilles | Pathologies | Orthoptie | Examen | Traitement | Règlement
 * - Color-coded sections
 * - Renouvellement buttons
 * - Quick-action buttons with keyboard shortcuts
 * - Real-time device measurement sync
 * - French keyboard shortcuts
 * - Single-page workflow (no step-by-step)
 *
 * This is the StudioVision-native consultation experience,
 * an alternative to the modular ConsultationDashboard.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, Printer, X, Check, AlertTriangle, Loader2, User, Camera, Briefcase, UserCheck, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Tab Navigation
import StudioVisionTabNavigation, { CONSULTATION_TABS } from '../../components/consultation/StudioVisionTabNavigation';

// Tab Content
import ResumeTab from '../../components/consultation/tabs/ResumeTab';

// Existing Panels (reused in tabs)
import RefractionPanel from './components/panels/RefractionPanel';
import ExaminationPanel from './components/panels/ExaminationPanel';
import DiagnosticPanel from './components/panels/DiagnosticPanel';

// StudioVision Components
import TreatmentBuilder from '../../components/treatment/TreatmentBuilder';
import PathologyPicker from '../../components/pathology/PathologyPicker';
import StudioVisionRefractionGrid from '../../components/refraction/StudioVisionRefractionGrid';
import ContactLensFitting from '../../components/contactLens/ContactLensFitting';

// New StudioVision Components
import OrthoptieQuickPanel from '../../components/consultation/OrthoptieQuickPanel';
import QuickActionsBar from '../../components/consultation/QuickActionsBar';
import DeviceDataBanner from '../../components/consultation/DeviceDataBanner';
import EyeSchemaModal from '../../components/ophthalmology/EyeSchemaModal';
import CriticalAlertBanner from '../../components/patient/CriticalAlertBanner';

// Renouvellement Buttons
import { RefractionRenouvellementButtons, PathologyRenouvellementButton } from '../../components/consultation/RenouvellementButtons';

// Services
import patientService from '../../services/patientService';
import ophthalmologyService from '../../services/ophthalmologyService';
import visitService from '../../services/visitService';
import documentService from '../../services/documentService';

// Hooks
import { usePreviousExamData } from '../../hooks/usePreviousExamData';
import { useDeviceSync } from '../../hooks/useDeviceSync';
import { useClinic } from '../../contexts/ClinicContext';
import { useStudioVisionMode } from '../../contexts/StudioVisionModeContext';
import logger from '../../services/logger';

// Initial data structure
const initialConsultationData = {
  chiefComplaint: {
    main: '',
    duration: '',
    laterality: 'OU',
    symptoms: []
  },
  vitals: {
    iop: { OD: '', OS: '' },
    bp: '',
    weight: '',
    height: ''
  },
  refraction: {
    visualAcuity: {
      OD: { uncorrected: '', corrected: '', pinhole: '', near: '' },
      OS: { uncorrected: '', corrected: '', pinhole: '', near: '' }
    },
    objective: {
      OD: { sphere: '', cylinder: '', axis: '' },
      OS: { sphere: '', cylinder: '', axis: '' }
    },
    subjective: {
      OD: { sphere: '', cylinder: '', axis: '', add: '' },
      OS: { sphere: '', cylinder: '', axis: '', add: '' },
      pd: { distance: '', near: '' }
    },
    keratometry: {
      OD: { k1: '', k1Axis: '', k2: '', k2Axis: '' },
      OS: { k1: '', k1Axis: '', k2: '', k2Axis: '' }
    }
  },
  contactLens: {
    OD: {},
    OS: {}
  },
  examination: {
    iop: { OD: '', OS: '' },
    slitLamp: {},
    fundus: {}
  },
  diagnostic: {
    diagnoses: [],
    procedures: [],
    laboratory: [],
    surgery: []
  },
  prescription: {
    glasses: null,
    medications: [],
    ordonnances: [{ items: [] }]
  },
  billing: {
    items: [],
    total: 0,
    paid: 0
  },
  healthcareOptions: {
    ald: false,
    cmu: false,
    dossierPapier: false
  },
  orthoptie: {
    coverTest: {
      distance: { deviation: 'ortho', measurement: '' },
      near: { deviation: 'ortho', measurement: '' }
    },
    ppc: {
      breakPoint: '',
      recoveryPoint: '',
      quality: 'bon'
    },
    stereopsis: {
      wirt: { fly: false, animals: false, circles: '40' },
      lang: { cat: false, star: false, car: false }
    },
    conclusion: '',
    notes: ''
  },
  consultationDuration: 0
};

export default function StudioVisionConsultation() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const visitId = searchParams.get('visitId');

  // Clinic context
  const { currentClinic } = useClinic();

  // Fix #2: StudioVision mode context for UI preferences
  const { compactMode, animations } = useStudioVisionMode();

  // State
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('resume');
  const [data, setData] = useState(initialConsultationData);
  const [hasChanges, setHasChanges] = useState({});
  const [lastSaved, setLastSaved] = useState(null);
  const [consultationHistory, setConsultationHistory] = useState([]);
  const [copyingOD, setCopyingOD] = useState(false);
  const [loadingLastVisit, setLoadingLastVisit] = useState(false);
  const [showDeviceBanner, setShowDeviceBanner] = useState(true);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);

  // Fix #1: Track current visit ID (from query param or auto-created)
  const [currentVisitId, setCurrentVisitId] = useState(visitId);

  // Fix #3: Track online status for offline warning
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Listen for online/offline status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Previous exam data hook
  const {
    previousData,
    hasPreviousData,
    copyAllRefraction,
    getPreviousPathologies
  } = usePreviousExamData(patientId);

  // Device sync hook for real-time measurements
  const {
    measurements: deviceMeasurements,
    loading: deviceLoading,
    hasNewMeasurements,
    importMeasurement,
    importAll: importAllMeasurements,
    dismiss: dismissDeviceNotification,
    refresh: refreshDeviceMeasurements,
    getMeasurementsByTab
  } = useDeviceSync(patientId, currentClinic?._id);

  // Load patient and consultation data
  useEffect(() => {
    const loadData = async () => {
      if (!patientId) {
        setError('Patient ID requis');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Load patient
        const patientResponse = await patientService.getPatient(patientId);
        const patientData = patientResponse?.data || patientResponse;
        setPatient(patientData);

        // Load consultation history
        try {
          const historyResponse = await ophthalmologyService.getPatientExamHistory(patientId);
          const history = historyResponse?.data || historyResponse || [];
          setConsultationHistory(Array.isArray(history) ? history : []);
        } catch {
          logger.debug('No previous consultations found');
        }

        // If visitId provided, load existing visit data
        if (visitId) {
          setCurrentVisitId(visitId);
          try {
            const visitResponse = await visitService.getVisit(visitId);
            const visitData = visitResponse?.data || visitResponse;
            if (visitData?.clinicalData) {
              setData(prev => ({
                ...prev,
                ...visitData.clinicalData
              }));
            }
          } catch {
            logger.debug('Could not load visit data, starting fresh');
          }
        } else {
          // Fix #1: Auto-create a visit when navigating without visitId
          // This ensures the consultation completion will work
          logger.info('No visitId provided, creating new visit for consultation');
          try {
            const newVisit = await visitService.createVisit({
              patient: patientId,
              clinic: currentClinic?._id || patientData?.clinic,
              type: 'ophthalmology_consultation',
              status: 'in_progress',
              startTime: new Date().toISOString()
            });
            const newVisitId = newVisit?._id || newVisit?.data?._id;
            if (newVisitId) {
              setCurrentVisitId(newVisitId);
              logger.info('Created new visit:', newVisitId);
            } else {
              logger.warn('Failed to get visit ID from response');
            }
          } catch (err) {
            logger.warn('Could not create visit, completion may fail:', err);
            // Continue without visit - user can still view/edit offline
          }
        }

        setLoading(false);
      } catch (err) {
        logger.error('Failed to load patient:', err);
        setError('Impossible de charger les données du patient');
        setLoading(false);
      }
    };

    loadData();
  }, [patientId, visitId, currentClinic?._id]);

  // Update section data
  const updateSection = useCallback((section, newData) => {
    setData(prev => ({
      ...prev,
      [section]: typeof newData === 'function' ? newData(prev[section]) : newData
    }));
    setHasChanges(prev => ({ ...prev, [section]: true }));
  }, []);

  // ==========================================
  // GRANULAR SAVE METHODS (CareVision Pattern)
  // ==========================================
  // These methods save each section independently to prevent cascading failures.
  // Mirrors CareVision's ModifierConsultationRefrac/Pathologie/Traite pattern.

  /**
   * Save refraction data only - mirrors CareVision's ModifierConsultationRefrac
   * Saves: visual acuity, objective refraction, subjective refraction, keratometry
   */
  const saveRefractionData = useCallback(async () => {
    if (!currentVisitId) {
      logger.warn('Cannot save refraction: no visit ID');
      return false;
    }
    try {
      await visitService.saveRefraction(currentVisitId, {
        visualAcuity: data.refraction.visualAcuity,
        objective: data.refraction.objective,
        subjective: data.refraction.subjective,
        keratometry: data.refraction.keratometry
      });
      setHasChanges(prev => ({ ...prev, refraction: false }));
      setLastSaved(new Date());
      logger.debug('Refraction saved independently');
      return true;
    } catch (err) {
      logger.error('Failed to save refraction:', err);
      return false;
    }
  }, [currentVisitId, data.refraction]);

  /**
   * Save diagnosis data only - mirrors CareVision's ModifierConsultationPathologie
   * Saves: diagnoses array (ICD-10 codes with laterality)
   */
  const saveDiagnosisData = useCallback(async () => {
    if (!currentVisitId) {
      logger.warn('Cannot save diagnosis: no visit ID');
      return false;
    }
    try {
      await visitService.saveDiagnosis(currentVisitId, {
        diagnoses: data.diagnostic.diagnoses,
        procedures: data.diagnostic.procedures,
        laboratory: data.diagnostic.laboratory,
        surgery: data.diagnostic.surgery
      });
      setHasChanges(prev => ({ ...prev, diagnostic: false }));
      setLastSaved(new Date());
      logger.debug('Diagnosis saved independently');
      return true;
    } catch (err) {
      logger.error('Failed to save diagnosis:', err);
      return false;
    }
  }, [currentVisitId, data.diagnostic]);

  /**
   * Save treatment data only - mirrors CareVision's ModifierConsultationTraite
   * Saves: prescriptions, medications, ordonnances
   */
  const saveTreatmentData = useCallback(async () => {
    if (!currentVisitId) {
      logger.warn('Cannot save treatment: no visit ID');
      return false;
    }
    try {
      await visitService.saveTreatment(currentVisitId, {
        glasses: data.prescription.glasses,
        medications: data.prescription.medications,
        ordonnances: data.prescription.ordonnances
      });
      setHasChanges(prev => ({ ...prev, prescription: false }));
      setLastSaved(new Date());
      logger.debug('Treatment saved independently');
      return true;
    } catch (err) {
      logger.error('Failed to save treatment:', err);
      return false;
    }
  }, [currentVisitId, data.prescription]);

  /**
   * Save IOP data only - mirrors CareVision's ModifierConsultationRefra (TOD/TOG)
   * Saves: intraocular pressure for OD/OS
   */
  const saveIOPData = useCallback(async () => {
    if (!currentVisitId) {
      logger.warn('Cannot save IOP: no visit ID');
      return false;
    }
    try {
      await visitService.saveIOP(currentVisitId, {
        OD: data.examination.iop?.OD || data.vitals.iop?.OD,
        OS: data.examination.iop?.OS || data.vitals.iop?.OS
      });
      setHasChanges(prev => ({ ...prev, examination: false }));
      setLastSaved(new Date());
      logger.debug('IOP saved independently');
      return true;
    } catch (err) {
      logger.error('Failed to save IOP:', err);
      return false;
    }
  }, [currentVisitId, data.examination.iop, data.vitals.iop]);

  /**
   * Save all sections that have changes using granular methods
   * Each section is saved independently - if one fails, others still succeed
   */
  const handleSave = async () => {
    if (!currentVisitId) {
      logger.warn('Cannot save: no visit ID');
      setError('Impossible de sauvegarder: aucune visite associée');
      return false;
    }

    try {
      setSaving(true);
      const saveResults = [];

      // Save each changed section independently (CareVision pattern)
      // This prevents cascading failures - if one section fails, others still save

      if (hasChanges.refraction) {
        saveResults.push({ section: 'refraction', success: await saveRefractionData() });
      }

      if (hasChanges.diagnostic) {
        saveResults.push({ section: 'diagnostic', success: await saveDiagnosisData() });
      }

      if (hasChanges.prescription) {
        saveResults.push({ section: 'prescription', success: await saveTreatmentData() });
      }

      if (hasChanges.examination) {
        saveResults.push({ section: 'examination', success: await saveIOPData() });
      }

      // For sections without granular endpoints, use the full exam save
      const otherSections = ['chiefComplaint', 'vitals', 'contactLens', 'orthoptie', 'billing', 'healthcareOptions'];
      const hasOtherChanges = otherSections.some(s => hasChanges[s]);

      if (hasOtherChanges) {
        try {
          await ophthalmologyService.saveExam({
            patientId,
            visitId: currentVisitId,
            data: {
              chiefComplaint: data.chiefComplaint,
              vitals: data.vitals,
              contactLens: data.contactLens,
              orthoptie: data.orthoptie,
              billing: data.billing,
              healthcareOptions: data.healthcareOptions,
              consultationDuration: data.consultationDuration,
              savedAt: new Date().toISOString()
            }
          });
          saveResults.push({ section: 'other', success: true });
          setHasChanges(prev => ({
            ...prev,
            chiefComplaint: false,
            vitals: false,
            contactLens: false,
            orthoptie: false,
            billing: false,
            healthcareOptions: false
          }));
        } catch (err) {
          logger.error('Failed to save other sections:', err);
          saveResults.push({ section: 'other', success: false });
        }
      }

      // Report results
      const failures = saveResults.filter(r => !r.success);
      if (failures.length > 0) {
        logger.warn('Some sections failed to save:', failures.map(f => f.section));
        // Don't set error - partial save is still useful
      }

      setLastSaved(new Date());
      setSaving(false);

      return failures.length === 0;
    } catch (err) {
      logger.error('Failed to save consultation:', err);
      setSaving(false);
      return false;
    }
  };

  // Complete consultation - creates lab orders, prescriptions, invoice
  const handleComplete = async () => {
    // First check if we're online (required for completion)
    if (!ophthalmologyService.canCompleteConsultation()) {
      logger.warn('Cannot complete consultation offline');
      setError('La complétion de consultation nécessite une connexion internet.');
      return;
    }

    // Verify we have a visit ID
    if (!currentVisitId) {
      logger.error('Cannot complete consultation without a visit ID');
      setError('Impossible de terminer la consultation: aucune visite associée. Veuillez recharger la page.');
      return;
    }

    try {
      setCompleting(true);
      setError(null);

      // Build exam data for backend integration
      const examData = {
        // Core exam data
        chiefComplaint: data.chiefComplaint,
        vitals: data.vitals,
        refraction: data.refraction,
        examination: data.examination,

        // Diagnostic data (lab orders, procedures, surgery)
        diagnostic: data.diagnostic,

        // Prescription data (medications, ordonnances, glasses)
        prescription: data.prescription,

        // Orthoptics
        orthoptie: data.orthoptie,

        // Contact lens fitting
        contactLens: data.contactLens,

        // Billing items
        billing: data.billing,

        // Healthcare options
        healthcareOptions: data.healthcareOptions,

        // Consultation metadata
        consultationDuration: data.consultationDuration,
        completedAt: new Date().toISOString()
      };

      // Call the backend consultation completion service
      const result = await ophthalmologyService.completeConsultation({
        visitId: currentVisitId, // Use currentVisitId (may be auto-created)
        examId: null, // Will be created if new
        examData,
        options: {
          generateInvoice: true,
          createLabOrders: data.diagnostic?.laboratory?.length > 0,
          createPrescriptions: data.prescription?.medications?.length > 0 ||
                              data.prescription?.ordonnances?.some(o => o.items?.length > 0),
          createOpticalPrescription: !!(data.refraction?.subjective?.OD?.sphere ||
                                       data.refraction?.subjective?.OS?.sphere)
        }
      });

      if (result.success) {
        setCompletionResult(result.data);
        setShowCompletionSummary(true);
        setLastSaved(new Date());
        setHasChanges({});

        logger.info('Consultation completed successfully:', {
          exam: result.data?.exam?._id,
          labOrders: result.data?.labOrders?.length || 0,
          prescriptions: result.data?.prescriptions?.length || 0,
          invoice: result.data?.invoice?._id
        });
      } else if (result.offline) {
        // User went offline during completion
        setError('Connexion perdue. Veuillez réessayer quand vous êtes en ligne.');
      } else {
        setError(result.message || 'Erreur lors de la complétion de la consultation');
      }
    } catch (err) {
      logger.error('Consultation completion failed:', err);
      setError(err.message || 'Erreur lors de la complétion de la consultation');
    } finally {
      setCompleting(false);
    }
  };

  // Handle closing the completion summary and navigating
  const handleCloseCompletionSummary = () => {
    setShowCompletionSummary(false);
    navigate(`/patients/${patientId}`);
  };

  // Renouvellement handlers
  const handleLoadPreviousRefraction = useCallback(() => {
    const prevRefraction = copyAllRefraction();
    if (prevRefraction) {
      updateSection('refraction', prevRefraction);
    }
  }, [copyAllRefraction, updateSection]);

  const handleClearRefraction = useCallback(() => {
    updateSection('refraction', initialConsultationData.refraction);
  }, [updateSection]);

  const handleRenewPathology = useCallback(() => {
    const prevPathologies = getPreviousPathologies?.();
    if (prevPathologies?.length) {
      updateSection('diagnostic', prev => ({
        ...prev,
        diagnoses: [...prevPathologies]
      }));
    }
  }, [getPreviousPathologies, updateSection]);

  // Quick action handlers

  // Copy OD values to OG with axis adjustment (±90°)
  const handleCopyODtoOG = useCallback(async () => {
    setCopyingOD(true);
    try {
      const odData = data.refraction.subjective.OD;
      if (!odData?.sphere && !odData?.cylinder) {
        throw new Error('Pas de données OD à copier');
      }

      // Adjust axis for OG (mirror: axis ± 90° if cylinder present)
      // Note: axis=0 is valid and falsy, so we use explicit check
      let adjustedAxis = odData.axis !== undefined && odData.axis !== ''
        ? Number(odData.axis)
        : 0;
      if (odData.cylinder) {
        // Mirror axis adjustment: add 90 if <=90, subtract 90 if >90
        adjustedAxis = adjustedAxis <= 90 ? adjustedAxis + 90 : adjustedAxis - 90;
      }

      updateSection('refraction', prev => ({
        ...prev,
        subjective: {
          ...prev.subjective,
          OS: {
            sphere: odData.sphere,
            cylinder: odData.cylinder,
            axis: adjustedAxis.toString(),
            add: odData.add
          }
        }
      }));
    } finally {
      setCopyingOD(false);
    }
  }, [data.refraction.subjective.OD, updateSection]);

  // Import all data from last visit
  const handleImportLastVisit = useCallback(async () => {
    if (!consultationHistory.length) return;

    setLoadingLastVisit(true);
    try {
      const lastVisit = consultationHistory[0];
      if (lastVisit?.clinicalData) {
        setData(prev => ({
          ...prev,
          refraction: lastVisit.clinicalData.refraction || prev.refraction,
          examination: lastVisit.clinicalData.examination || prev.examination,
          diagnostic: lastVisit.clinicalData.diagnostic || prev.diagnostic,
          orthoptie: lastVisit.clinicalData.orthoptie || prev.orthoptie
        }));
        setHasChanges({ refraction: true, examination: true, diagnostic: true, orthoptie: true });
      }
    } finally {
      setLoadingLastVisit(false);
    }
  }, [consultationHistory]);

  // Handle print option selection
  const handlePrint = useCallback(async (optionId) => {
    try {
      // Store the print type for the print dialog
      const printType = {
        'ordonnance_verres': 'Ordonnance Verres',
        'ordonnance_medicaments': 'Ordonnance Médicaments',
        'certificat_medical': 'Certificat Médical',
        'fiche_patient': 'Fiche Patient',
        'resume_consultation': 'Résumé Consultation'
      }[optionId] || 'Document';

      // For now, use browser print with a type indicator
      logger.debug(`Printing: ${printType}`);

      // Navigate to print-preview route if available, otherwise use window.print
      // Future: implement PDF generation via backend API
      window.print();
    } catch (err) {
      logger.error('Print failed:', err);
    }
  }, []);

  // Handle quick diagnosis selection
  const handleAddDiagnosis = useCallback((diagnosis) => {
    updateSection('diagnostic', prev => ({
      ...prev,
      diagnoses: [
        ...prev.diagnoses,
        {
          code: diagnosis.code,
          name: diagnosis.label,
          laterality: 'OU',
          addedAt: new Date().toISOString()
        }
      ]
    }));
  }, [updateSection]);

  // Handle timer updates
  const handleTimerUpdate = useCallback((seconds) => {
    setData(prev => ({
      ...prev,
      consultationDuration: seconds
    }));
  }, []);

  // Handle device measurement import
  const handleApplyDeviceMeasurement = useCallback(async (measurement) => {
    try {
      const importedData = await importMeasurement(measurement._id);
      if (!importedData) return;

      // Apply data based on device type
      switch (importedData.deviceType) {
        case 'autorefractor':
          updateSection('refraction', prev => ({
            ...prev,
            objective: {
              OD: importedData.data.OD || prev.objective.OD,
              OS: importedData.data.OS || prev.objective.OS
            }
          }));
          break;
        case 'tonometer':
          updateSection('examination', prev => ({
            ...prev,
            iop: {
              OD: importedData.data.OD?.iop || prev.iop?.OD,
              OS: importedData.data.OS?.iop || prev.iop?.OS
            }
          }));
          break;
        case 'keratometer':
          updateSection('refraction', prev => ({
            ...prev,
            keratometry: {
              OD: importedData.data.OD || prev.keratometry?.OD,
              OS: importedData.data.OS || prev.keratometry?.OS
            }
          }));
          break;
        default:
          logger.debug('Device type not handled:', importedData.deviceType);
      }
    } catch (err) {
      logger.error('Failed to apply device measurement:', err);
    }
  }, [importMeasurement, updateSection]);

  // Handle apply all device measurements
  const handleApplyAllDeviceMeasurements = useCallback(async () => {
    try {
      const importedData = await importAllMeasurements();

      // Apply all imported data by target tab
      if (importedData.refraction) {
        updateSection('refraction', prev => {
          const updated = { ...prev };
          if (importedData.refraction.autorefractor) {
            updated.objective = importedData.refraction.autorefractor.data;
          }
          if (importedData.refraction.keratometer) {
            updated.keratometry = importedData.refraction.keratometer.data;
          }
          return updated;
        });
      }

      if (importedData.examen) {
        updateSection('examination', prev => {
          const updated = { ...prev };
          if (importedData.examen.tonometer) {
            updated.iop = {
              OD: importedData.examen.tonometer.data.OD?.iop,
              OS: importedData.examen.tonometer.data.OS?.iop
            };
          }
          return updated;
        });
      }

      dismissDeviceNotification();
    } catch (err) {
      logger.error('Failed to apply all device measurements:', err);
    }
  }, [importAllMeasurements, updateSection, dismissDeviceNotification]);

  // Open full orthoptic exam form
  const handleOpenFullOrthopticExam = useCallback(() => {
    navigate(`/orthoptic/new?patientId=${patientId}&visitId=${currentVisitId || ''}`);
  }, [navigate, patientId, currentVisitId]);

  // Tab change handler with auto-save for the current section (CareVision pattern)
  const handleTabChange = useCallback(async (tabId) => {
    // Auto-save the current tab's data before switching (granular save)
    // This mirrors CareVision's behavior of saving each section independently
    if (currentVisitId) {
      const tabSaveMap = {
        refraction: { check: hasChanges.refraction, save: saveRefractionData },
        pathologies: { check: hasChanges.diagnostic, save: saveDiagnosisData },
        traitement: { check: hasChanges.prescription, save: saveTreatmentData },
        examen: { check: hasChanges.examination, save: saveIOPData }
      };

      const currentTabSave = tabSaveMap[activeTab];
      if (currentTabSave?.check) {
        logger.debug(`Auto-saving ${activeTab} before tab change`);
        await currentTabSave.save();
      }
    }

    setActiveTab(tabId);
  }, [activeTab, currentVisitId, hasChanges, saveRefractionData, saveDiagnosisData, saveTreatmentData, saveIOPData]);

  // Memoize handleSave for use in keyboard shortcuts
  const memoizedHandleSave = useCallback(handleSave, [
    currentVisitId, hasChanges, patientId, data,
    saveRefractionData, saveDiagnosisData, saveTreatmentData, saveIOPData
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S: Save (granular save for changed sections)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        memoizedHandleSave();
      }

      // Escape: Cancel/Go back
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey) {
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [memoizedHandleSave, navigate]);

  // Check if any tab has unsaved changes
  const tabChanges = useMemo(() => ({
    refraction: hasChanges.refraction,
    lentilles: hasChanges.contactLens,
    pathologies: hasChanges.diagnostic,
    orthoptie: hasChanges.orthoptie,
    examen: hasChanges.examination,
    traitement: hasChanges.prescription,
    reglement: hasChanges.billing
  }), [hasChanges]);

  // Check if OD has data for copy
  const canCopyODtoOG = useMemo(() => {
    const od = data.refraction.subjective.OD;
    return !!(od?.sphere || od?.cylinder);
  }, [data.refraction.subjective.OD]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement de la consultation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'resume':
        return (
          <ResumeTab
            patient={patient}
            data={data}
            consultationHistory={consultationHistory}
            onSelectConsultation={(c) => logger.debug('Selected consultation:', c)}
            onNewConsultation={() => setActiveTab('refraction')}
            healthcareOptions={data.healthcareOptions}
            onHealthcareOptionsChange={(opts) => updateSection('healthcareOptions', opts)}
          />
        );

      case 'refraction':
        return (
          <div className="p-4 space-y-4">
            {/* Device Data Banner */}
            {showDeviceBanner && (
              <DeviceDataBanner
                measurements={getMeasurementsByTab('refraction')}
                currentData={{
                  autorefractor: data.refraction.objective,
                  keratometer: data.refraction.keratometry
                }}
                onApply={handleApplyDeviceMeasurement}
                onApplyAll={handleApplyAllDeviceMeasurements}
                onDismiss={() => setShowDeviceBanner(false)}
                onRefresh={refreshDeviceMeasurements}
                loading={deviceLoading}
                hasNewMeasurements={hasNewMeasurements}
                targetTab="refraction"
                showDiff={true}
              />
            )}

            {/* Renouvellement Buttons */}
            <RefractionRenouvellementButtons
              onLoadPrevious={handleLoadPreviousRefraction}
              onClear={handleClearRefraction}
              previousAvailable={hasPreviousData}
              className="mb-4"
            />

            {/* Refraction Grid */}
            <StudioVisionRefractionGrid
              value={{
                visualAcuity: data.refraction.visualAcuity,
                autorefraction: data.refraction.objective,
                subjectiveRefraction: data.refraction.subjective,
                keratometry: data.refraction.keratometry,
                pupillaryDistance: data.refraction.subjective.pd
              }}
              onChange={(gridData) => updateSection('refraction', {
                visualAcuity: gridData.visualAcuity,
                objective: gridData.autorefraction,
                subjective: {
                  ...gridData.subjectiveRefraction,
                  pd: gridData.pupillaryDistance
                },
                keratometry: gridData.keratometry
              })}
              showKeratometry={true}
              showPupillaryDistance={true}
            />
          </div>
        );

      case 'lentilles':
        return (
          <div className="p-4">
            <ContactLensFitting
              examData={{
                contactLensFitting: data.contactLens,
                refraction: data.refraction,
                keratometry: data.refraction.keratometry
              }}
              patient={patient}
              onUpdate={(updateData) => {
                if (updateData.contactLensFitting) {
                  updateSection('contactLens', updateData.contactLensFitting);
                }
              }}
            />
          </div>
        );

      case 'pathologies':
        return (
          <div className="p-4 space-y-4">
            {/* Renouvellement Button */}
            <PathologyRenouvellementButton
              onRenew={handleRenewPathology}
              previousAvailable={hasPreviousData}
              className="mb-4"
            />

            {/* Pathology Picker */}
            <PathologyPicker
              selectedPathologies={data.diagnostic.diagnoses}
              onChange={(diagnoses) => updateSection('diagnostic', {
                ...data.diagnostic,
                diagnoses
              })}
              showLaterality={true}
              height={500}
            />
          </div>
        );

      case 'orthoptie':
        return (
          <div className="p-4">
            <OrthoptieQuickPanel
              patientId={patientId}
              visitId={currentVisitId}
              value={data.orthoptie}
              onChange={(orthoptieData) => updateSection('orthoptie', orthoptieData)}
              onOpenFullExam={handleOpenFullOrthopticExam}
            />
          </div>
        );

      case 'examen':
        return (
          <div className="p-4">
            <ExaminationPanel
              data={data.examination}
              onChange={(exam) => updateSection('examination', exam)}
              patient={patient}
            />
          </div>
        );

      case 'traitement':
        return (
          <div className="p-4">
            <TreatmentBuilder
              value={data.prescription}
              onChange={(prescription) => updateSection('prescription', prescription)}
              patientId={patientId}
            />
          </div>
        );

      case 'reglement':
        return (
          <div className="p-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
              <p className="text-emerald-700">
                Module Règlement - Facturation et paiements
              </p>
              <p className="text-sm text-emerald-500 mt-2">
                Accessible via le module Facturation
              </p>
              <button
                onClick={() => navigate(`/invoicing?patientId=${patientId}`)}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Ouvrir la facturation
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-gray-100 flex flex-col ${!animations ? 'transition-none' : ''}`}>
      {/* Fix #3: Offline Warning Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-2 shadow-md z-50">
          <WifiOff className="h-4 w-4" />
          <span className="font-medium">Mode hors ligne</span>
          <span className="text-sm opacity-90">
            - Les données sont sauvegardées localement. La finalisation nécessite une connexion internet.
          </span>
        </div>
      )}

      {/* Fixed Header */}
      <header className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
        {/* Patient Info Bar */}
        <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              {/* Patient Photo */}
              <div className="relative">
                {(patient?.photoUrl || patient?.photo) ? (
                  <img
                    src={patient.photoUrl || patient.photo}
                    alt={`${patient.firstName} ${patient.lastName}`}
                    className="w-10 h-10 rounded-full object-cover border-2 border-white/50 cursor-pointer hover:border-white transition"
                    onClick={() => window.open(patient.photoUrl || patient.photo, '_blank')}
                    title="Cliquer pour agrandir"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center cursor-pointer hover:bg-white/30 transition"
                    title="Aucune photo - Cliquer pour capturer"
                  >
                    <Camera className="w-5 h-5 text-white/70" />
                  </div>
                )}
              </div>

              {/* Patient Name */}
              <div>
                <h1 className="text-xl font-bold">
                  {patient?.lastName?.toUpperCase()} {patient?.firstName}
                </h1>
                {/* Profession Badge - check both occupation and profession fields */}
                {(patient?.occupation || patient?.profession) && (
                  <div className="flex items-center gap-1 text-xs text-white/80">
                    <Briefcase className="w-3 h-3" />
                    <span>{patient.occupation || patient.profession}</span>
                  </div>
                )}
              </div>

              {/* Age Badge */}
              {patient?.dateOfBirth && (
                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-sm font-bold rounded">
                  {Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))} Ans
                </span>
              )}

              {/* Referring Doctor */}
              {patient?.referringDoctor && (
                <div className="flex items-center gap-1 text-sm text-white/80 bg-white/10 px-2 py-0.5 rounded">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{patient.referringDoctor.startsWith('Dr') ? patient.referringDoctor : `Dr ${patient.referringDoctor}`}</span>
                </div>
              )}

              {/* Critical Alerts - Compact View */}
              {(patient?.alerts?.length > 0 || patient?.allergies?.length > 0 || patient?.importantNotes) && (
                <CriticalAlertBanner
                  alerts={patient.alerts || []}
                  allergies={patient.allergies || []}
                  importantNotes={patient.importantNotes}
                  canEdit={false}
                  compact={true}
                />
              )}

              <span className="text-sm opacity-80">
                Fiche: {patient?.fileNumber || patientId?.slice(-8)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Save Status */}
              {lastSaved && (
                <span className="text-xs opacity-70">
                  Sauvegardé à {format(lastSaved, 'HH:mm', { locale: fr })}
                </span>
              )}

              {/* Action Buttons */}
              <button
                onClick={memoizedHandleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition"
                title="Sauvegarde granulaire (Ctrl+S) - Chaque section est sauvegardée indépendamment"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Sauvegarder
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>

              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition"
              >
                <X className="h-4 w-4" />
                Fermer
              </button>

              <button
                onClick={handleComplete}
                disabled={completing}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition font-medium ${
                  completing
                    ? 'bg-green-400 cursor-wait'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {completing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {completing ? 'Finalisation...' : 'Terminer'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <StudioVisionTabNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          hasChanges={tabChanges}
        />

        {/* Quick Actions Bar */}
        <QuickActionsBar
          onCopyODtoOG={handleCopyODtoOG}
          canCopyODtoOG={canCopyODtoOG}
          copyingOD={copyingOD}
          onImportLastVisit={handleImportLastVisit}
          hasPreviousVisit={consultationHistory.length > 0}
          loadingLastVisit={loadingLastVisit}
          onPrint={handlePrint}
          onAddDiagnosis={handleAddDiagnosis}
          onOpenSchema={() => setShowSchemaModal(true)}
          onTimerUpdate={handleTimerUpdate}
          initialTimerSeconds={data.consultationDuration || 0}
          autoStartTimer={true}
        />
      </header>

      {/* Tab Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {renderTabContent()}
        </div>
      </main>

      {/* Eye Schema Modal */}
      <EyeSchemaModal
        isOpen={showSchemaModal}
        onClose={() => setShowSchemaModal(false)}
        patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''}
        initialEye="OD"
        onSave={(schemaData) => {
          // Update exam data with schema
          updateSection('schemas', [...(data.schemas || []), schemaData]);
          logger.debug('Schema saved:', schemaData);
        }}
      />

      {/* Completion Summary Modal */}
      {showCompletionSummary && completionResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Consultation terminée</h3>
                  <p className="text-sm text-white/80">Les éléments suivants ont été créés</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Exam saved */}
              {completionResult.exam && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="bg-blue-500 text-white p-1.5 rounded-full">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Examen sauvegardé</p>
                    <p className="text-sm text-blue-600">
                      Examen #{completionResult.exam._id?.slice(-6)}
                    </p>
                  </div>
                </div>
              )}

              {/* Lab Orders */}
              {completionResult.labOrders?.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="bg-purple-500 text-white p-1.5 rounded-full">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">
                      {completionResult.labOrders.length} Demande{completionResult.labOrders.length > 1 ? 's' : ''} de laboratoire
                    </p>
                    <p className="text-sm text-purple-600">
                      Envoyé{completionResult.labOrders.length > 1 ? 'es' : 'e'} au laboratoire
                    </p>
                  </div>
                </div>
              )}

              {/* Prescriptions */}
              {completionResult.prescriptions?.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="bg-amber-500 text-white p-1.5 rounded-full">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">
                      {completionResult.prescriptions.length} Ordonnance{completionResult.prescriptions.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-amber-600">
                      Envoyé{completionResult.prescriptions.length > 1 ? 'es' : 'e'} à la pharmacie
                    </p>
                  </div>
                </div>
              )}

              {/* Optical Prescription */}
              {completionResult.opticalPrescription && (
                <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-lg border border-pink-200">
                  <div className="bg-pink-500 text-white p-1.5 rounded-full">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-pink-900">Ordonnance lunettes</p>
                    <p className="text-sm text-pink-600">Prête pour l'optique</p>
                  </div>
                </div>
              )}

              {/* Invoice */}
              {completionResult.invoice && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="bg-emerald-500 text-white p-1.5 rounded-full">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-emerald-900">Facture générée</p>
                    <p className="text-sm text-emerald-600">
                      {completionResult.invoice.invoiceNumber} • {completionResult.invoice.summary?.total?.toLocaleString()} {completionResult.invoice.billing?.currency || 'CDF'}
                    </p>
                  </div>
                </div>
              )}

              {/* Convention Billing Info */}
              {completionResult.conventionBilling && (
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-indigo-500" />
                    <p className="font-medium text-indigo-900">
                      Convention: {completionResult.conventionBilling.companyName}
                    </p>
                    <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">
                      {completionResult.conventionBilling.coveragePercentage}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white/50 px-2 py-1 rounded">
                      <span className="text-indigo-600">Part entreprise:</span>
                      <span className="font-medium text-indigo-900 ml-1">
                        {completionResult.conventionBilling.companyShare?.toLocaleString()} CDF
                      </span>
                    </div>
                    <div className="bg-white/50 px-2 py-1 rounded">
                      <span className="text-indigo-600">Part patient:</span>
                      <span className="font-medium text-indigo-900 ml-1">
                        {completionResult.conventionBilling.patientShare?.toLocaleString()} CDF
                      </span>
                    </div>
                  </div>
                  {completionResult.conventionBilling.isWaitingPeriod && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ Période d'attente active - patient responsable à 100%
                    </p>
                  )}
                </div>
              )}

              {/* Approval Issues */}
              {completionResult.approvalIssues?.length > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="font-medium text-orange-900">Approbations requises</p>
                  </div>
                  <ul className="text-sm text-orange-700 space-y-1">
                    {completionResult.approvalIssues.map((issue, idx) => (
                      <li key={idx}>• {issue.description} ({issue.code})</li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-600 mt-2">
                    Ces actes nécessitent une approbation préalable de l'entreprise
                  </p>
                </div>
              )}

              {/* Drug Safety Warnings */}
              {completionResult.drugSafetyWarnings?.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <p className="font-medium text-red-900">Alertes médicamenteuses</p>
                  </div>
                  <ul className="text-sm text-red-700 space-y-1">
                    {completionResult.drugSafetyWarnings.map((warning, idx) => (
                      <li key={idx}>• {warning.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
              <button
                onClick={() => navigate(`/invoicing/${completionResult.invoice?._id}`)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                disabled={!completionResult.invoice}
              >
                Voir la facture →
              </button>
              <button
                onClick={handleCloseCompletionSummary}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
