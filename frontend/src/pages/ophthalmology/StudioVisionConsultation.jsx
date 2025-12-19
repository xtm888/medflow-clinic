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
import { Save, Printer, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
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
          console.log('No previous consultations found');
        }

        // If visitId provided, load existing visit data
        if (visitId) {
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
            console.log('Could not load visit data, starting fresh');
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load patient:', err);
        setError('Impossible de charger les données du patient');
        setLoading(false);
      }
    };

    loadData();
  }, [patientId, visitId]);

  // Update section data
  const updateSection = useCallback((section, newData) => {
    setData(prev => ({
      ...prev,
      [section]: typeof newData === 'function' ? newData(prev[section]) : newData
    }));
    setHasChanges(prev => ({ ...prev, [section]: true }));
  }, []);

  // Save consultation
  const handleSave = async () => {
    try {
      setSaving(true);

      await ophthalmologyService.saveExam({
        patientId,
        visitId,
        data: {
          ...data,
          savedAt: new Date().toISOString()
        }
      });

      setLastSaved(new Date());
      setHasChanges({});
      setSaving(false);

      return true;
    } catch (err) {
      console.error('Failed to save:', err);
      setSaving(false);
      return false;
    }
  };

  // Complete consultation
  const handleComplete = async () => {
    const saved = await handleSave();
    if (saved) {
      navigate(`/patients/${patientId}`);
    }
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
      let adjustedAxis = odData.axis || 0;
      if (odData.cylinder && adjustedAxis) {
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
      console.log(`Printing: ${printType}`);

      // Navigate to print-preview route if available, otherwise use window.print
      // Future: implement PDF generation via backend API
      window.print();
    } catch (err) {
      console.error('Print failed:', err);
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
          console.log('Device type not handled:', importedData.deviceType);
      }
    } catch (err) {
      console.error('Failed to apply device measurement:', err);
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
      console.error('Failed to apply all device measurements:', err);
    }
  }, [importAllMeasurements, updateSection, dismissDeviceNotification]);

  // Open full orthoptic exam form
  const handleOpenFullOrthopticExam = useCallback(() => {
    navigate(`/orthoptic/new?patientId=${patientId}&visitId=${visitId || ''}`);
  }, [navigate, patientId, visitId]);

  // Tab change handler
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Escape: Cancel/Go back
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey) {
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, navigate]);

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
            onSelectConsultation={(c) => console.log('Selected:', c)}
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
              visitId={visitId}
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Fixed Header */}
      <header className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
        {/* Patient Info Bar */}
        <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">
                {patient?.lastName?.toUpperCase()} {patient?.firstName}
              </h1>
              {patient?.dateOfBirth && (
                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-sm font-bold rounded">
                  {Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))} Ans
                </span>
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
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition"
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
                className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg transition font-medium"
              >
                <Check className="h-4 w-4" />
                Terminer
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
    </div>
  );
}
