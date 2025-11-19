import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, ChevronRight, ChevronLeft, Save, Printer, Send, Check, AlertCircle, Calendar, Copy, FilePlus, Clock, User, FileText, Glasses, ShoppingCart } from 'lucide-react';
import { calculateSE, vertexCorrection, formatPrescription } from '../../utils/ophthalmologyCalculations';
import VisualAcuityStep from './components/VisualAcuityStep';
import ObjectiveRefractionStep from './components/ObjectiveRefractionStep';
import SubjectiveRefractionStep from './components/SubjectiveRefractionStep';
import KeratometryStep from './components/KeratometryStep';
import AdditionalTestsStep from './components/AdditionalTestsStep';
import PrescriptionStep from './components/PrescriptionStep';
import NumberInputWithArrows from '../../components/NumberInputWithArrows';
import ophthalmologyService from '../../services/ophthalmologyService';
import patientService from '../../services/patientService';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ToastContainer';
import DocumentGenerator from '../../components/documents/DocumentGenerator';
import RefractionComparisonView from '../../components/RefractionComparisonView';

export default function RefractionExam() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toasts, success, error: showError, removeToast } = useToast();
  const patientId = searchParams.get('patientId');

  const [patient, setPatient] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [showExamSuccessModal, setShowExamSuccessModal] = useState(false);
  const [savedExamId, setSavedExamId] = useState(null);

  // Refraction history
  const [refractionHistory, setRefractionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryExam, setSelectedHistoryExam] = useState(null);
  const [currentExamId, setCurrentExamId] = useState(null);

  // TOD/TOG (Intraocular Pressure)
  const [iop, setIop] = useState({
    OD: { value: 0, method: 'goldman', time: new Date().toISOString() },
    OS: { value: 0, method: 'goldman', time: new Date().toISOString() }
  });

  // Load patient data
  useEffect(() => {
    const loadPatient = async () => {
      if (!patientId) {
        showError('Aucun patient sélectionné. Redirection...');
        setTimeout(() => navigate('/ophthalmology'), 2000);
        return;
      }

      try {
        setLoadingPatient(true);
        const response = await patientService.getPatient(patientId);
        if (response.data) {
          setPatient(response.data);
        } else {
          showError('Patient non trouvé. Redirection...');
          setTimeout(() => navigate('/ophthalmology'), 2000);
        }
      } catch (err) {
        console.error('Error loading patient:', err);
        showError('Erreur lors du chargement du patient. Redirection...');
        setTimeout(() => navigate('/ophthalmology'), 2000);
      } finally {
        setLoadingPatient(false);
      }
    };

    loadPatient();
  }, [patientId]);

  // Load refraction history
  useEffect(() => {
    const loadHistory = async () => {
      if (!patientId) return;

      try {
        setLoadingHistory(true);
        const response = await ophthalmologyService.getRefractionHistory(patientId);
        if (response.data) {
          setRefractionHistory(response.data);
        }
      } catch (err) {
        console.error('Error loading refraction history:', err);
        // Don't show error - history is optional
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [patientId]);

  // Handle copying from previous refraction
  const handleCopyFromPrevious = async () => {
    try {
      setSaving(true);
      const response = await ophthalmologyService.copyFromPreviousRefraction(patientId);
      if (response.data) {
        setCurrentExamId(response.data._id);
        // Load the copied data into examData
        loadExamDataFromResponse(response.data);
        success('Données copiées de l\'examen précédent');
        // Reload history
        const historyResponse = await ophthalmologyService.getRefractionHistory(patientId);
        if (historyResponse.data) {
          setRefractionHistory(historyResponse.data);
        }
      }
    } catch (err) {
      console.error('Error copying from previous:', err);
      showError(err.response?.data?.error || 'Aucun examen précédent trouvé');
    } finally {
      setSaving(false);
    }
  };

  // Handle creating blank refraction
  const handleCreateBlank = async () => {
    try {
      setSaving(true);
      const response = await ophthalmologyService.createBlankRefraction(patientId);
      if (response.data) {
        setCurrentExamId(response.data._id);
        success('Nouvelle réfraction vide créée');
        // Reload history
        const historyResponse = await ophthalmologyService.getRefractionHistory(patientId);
        if (historyResponse.data) {
          setRefractionHistory(historyResponse.data);
        }
      }
    } catch (err) {
      console.error('Error creating blank refraction:', err);
      showError('Erreur lors de la création de la réfraction vide');
    } finally {
      setSaving(false);
    }
  };

  // Load exam data from API response
  const loadExamDataFromResponse = (exam) => {
    if (!exam) return;

    setExamData(prevData => ({
      ...prevData,
      visualAcuity: exam.visualAcuity || prevData.visualAcuity,
      objective: exam.refraction?.objective || prevData.objective,
      subjective: exam.refraction?.subjective || prevData.subjective,
      keratometry: exam.keratometry || prevData.keratometry,
      pupilDistance: exam.pupilDistance || prevData.pupilDistance,
      finalPrescription: exam.refraction?.finalPrescription || prevData.finalPrescription
    }));

    if (exam.iop) {
      setIop(exam.iop);
    }
  };

  // Handle selecting a historical exam
  const handleSelectHistoricalExam = async (examId) => {
    try {
      setSelectedHistoryExam(examId);
      const response = await ophthalmologyService.getExam(examId);
      if (response.data) {
        loadExamDataFromResponse(response.data);
      }
    } catch (err) {
      console.error('Error loading historical exam:', err);
      showError('Erreur lors du chargement de l\'examen');
    }
  };

  const [examData, setExamData] = useState({
    examDate: new Date().toISOString().split('T')[0],
    examiner: 'Dr. Mutombo',

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
      format: 'Snellen'
    },

    // Objective Refraction
    objective: {
      method: 'autorefractor',
      device: 'Topcon KR-8900',
      serialNumber: 'TKR8900-2024',
      OD: { sphere: 0, cylinder: 0, axis: 0 },
      OS: { sphere: 0, cylinder: 0, axis: 0 },
      confidence: 9,
      timestamp: new Date().toISOString()
    },

    // Subjective Refraction
    subjective: {
      OD: { sphere: 0, cylinder: 0, axis: 0, va: '20/20' },
      OS: { sphere: 0, cylinder: 0, axis: 0, va: '20/20' },

      // Cross Cylinder Test Results
      crossCylinder: {
        OD: { power: 0, axis: 0, refined: false },
        OS: { power: 0, axis: 0, refined: false }
      },

      // Binocular Balancing
      binocular: {
        method: 'alternating occlusion',
        balanced: false,
        dominantEye: 'OD',
        adjustment: 0
      },

      // Additional Tests
      redGreen: { OD: 'balanced', OS: 'balanced' },
      duochrome: { OD: 'balanced', OS: 'balanced' }
    },

    // Keratometry
    keratometry: {
      OD: {
        k1: { power: 43.00, axis: 180 },
        k2: { power: 44.00, axis: 90 },
        astigmatism: 1.00
      },
      OS: {
        k1: { power: 43.25, axis: 180 },
        k2: { power: 44.00, axis: 90 },
        astigmatism: 0.75
      }
    },

    // Additional Measurements
    pupilDistance: {
      binocular: 63,
      OD: 31.5,
      OS: 31.5
    },

    pupils: {
      OD: { size: 4, reaction: 'normal', rapd: false },
      OS: { size: 4, reaction: 'normal', rapd: false }
    },

    motility: {
      versions: 'full',
      vergence: 'normal',
      npc: 6,
      coverTest: {
        distance: 'orthophoria',
        near: 'orthophoria'
      }
    },

    // Prescription Decision
    finalPrescription: {
      OD: { sphere: 0, cylinder: 0, axis: 0 },
      OS: { sphere: 0, cylinder: 0, axis: 0 },
      add: 0,
      prism: { OD: null, OS: null },
      prescriptionType: 'distance',
      recommendations: []
    }
  });

  // Workflow steps with validation
  const steps = [
    {
      id: 1,
      name: 'Acuité Visuelle',
      component: VisualAcuityStep,
      icon: Eye,
      required: true
    },
    {
      id: 2,
      name: 'Réfraction Objective',
      component: ObjectiveRefractionStep,
      icon: Eye,
      required: true
    },
    {
      id: 3,
      name: 'Réfraction Subjective',
      component: SubjectiveRefractionStep,
      icon: Eye,
      required: true
    },
    {
      id: 4,
      name: 'Tests Complémentaires',
      component: AdditionalTestsStep,
      icon: Eye,
      required: false
    },
    {
      id: 5,
      name: 'Kératométrie',
      component: KeratometryStep,
      icon: Eye,
      required: false
    },
    {
      id: 6,
      name: 'Prescription Finale',
      component: PrescriptionStep,
      icon: Eye,
      required: true
    }
  ];

  // Auto-save to localStorage
  useEffect(() => {
    const saveInterval = setInterval(() => {
      localStorage.setItem(`exam_${patientId}_draft`, JSON.stringify(examData));
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveInterval);
  }, [examData, patientId]);

  // Load draft if exists
  useEffect(() => {
    const draft = localStorage.getItem(`exam_${patientId}_draft`);
    if (draft) {
      const confirmLoad = window.confirm('Un examen non terminé existe. Voulez-vous le reprendre?');
      if (confirmLoad) {
        setExamData(JSON.parse(draft));
      }
    }
  }, [patientId]);

  const handleSaveExam = async () => {
    try {
      setSaving(true);

      // Prepare exam data for API
      const examPayload = {
        patient: patientId,
        examDate: examData.examDate,
        examiner: examData.examiner,
        examType: 'refraction',

        // Visual Acuity
        visualAcuity: examData.visualAcuity,

        // Objective Refraction
        objectiveRefraction: examData.objective,

        // Subjective Refraction
        subjectiveRefraction: examData.subjective,

        // Keratometry
        keratometry: examData.keratometry,

        // Additional measurements
        pupilDistance: examData.pupilDistance,
        pupils: examData.pupils,
        motility: examData.motility,

        // Final prescription
        finalPrescription: examData.finalPrescription,

        // Status
        status: 'completed',
        completedAt: new Date()
      };

      // Save to backend
      const result = await ophthalmologyService.createExam(examPayload);

      // Clear draft from localStorage
      localStorage.removeItem(`exam_${patientId}_draft`);

      // Store saved exam ID and show success modal
      const examId = result.data?._id || result._id;
      setSavedExamId(examId);
      setShowExamSuccessModal(true);
      success('Examen sauvegardé avec succès!');

    } catch (err) {
      console.error('Error saving exam:', err);
      showError(err.response?.data?.error || 'Échec de la sauvegarde de l\'examen. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  // Loading state
  if (loadingPatient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du patient...</p>
        </div>
      </div>
    );
  }

  // No patient error
  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient introuvable</h2>
          <p className="text-gray-600">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Historical Refraction Sidebar */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h2 className="text-lg font-semibold flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Réfractions Précédentes
          </h2>
        </div>

        <div className="p-3 space-y-2 border-b">
          <button
            onClick={handleCopyFromPrevious}
            disabled={saving || loadingHistory}
            className="w-full flex items-center justify-center px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Copy className="w-4 h-4 mr-2" />
            Nouvelle réfraction précédente
          </button>
          <button
            onClick={handleCreateBlank}
            disabled={saving || loadingHistory}
            className="w-full flex items-center justify-center px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <FilePlus className="w-4 h-4 mr-2" />
            Nouvelle réfraction vide
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingHistory ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Chargement...
            </div>
          ) : refractionHistory.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Aucune réfraction précédente
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {refractionHistory.map((exam) => (
                <button
                  key={exam._id}
                  onClick={() => handleSelectHistoricalExam(exam._id)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedHistoryExam === exam._id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-900 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(exam.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    {exam.isPreviousCopy && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        Copie
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    {exam.examiner?.firstName} {exam.examiner?.lastName}
                  </div>
                  {exam.iop && (
                    <div className="mt-1 text-xs text-gray-500">
                      TOD: {exam.iop.OD?.value || 0} | TOG: {exam.iop.OS?.value || 0}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4 sticky top-0 z-10 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Eye className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h1 className="text-xl font-semibold">Examen de Réfraction</h1>
              <p className="text-sm text-gray-600">
                Patient: {patient?.firstName} {patient?.lastName} |
                Âge: {patient?.age} ans |
                Date: {new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDocumentGenerator(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              title="Générer un certificat d'acuité visuelle"
            >
              <FileText className="w-4 h-4" />
              Certificat
            </button>
            <button
              onClick={() => navigate('/ophthalmology')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* TOD/TOG Section */}
        <div className="flex items-center gap-4 pt-3 border-t">
          <div className="flex items-center gap-2">
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

      {/* Step Progress Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${currentStep === step.id ? 'bg-blue-600 text-white' :
                    currentStep > step.id ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-600'}
                `}>
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <span className={`ml-2 text-sm hidden md:inline ${
                  currentStep === step.id ? 'text-blue-600 font-medium' : 'text-gray-600'
                }`}>
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2">
                  <div className={`h-1 rounded ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-7xl mx-auto p-6 pb-24 space-y-6">
        <CurrentStepComponent
          data={examData}
          setData={setExamData}
          patient={patient}
          examId={currentExamId}
          patientId={patientId}
        />

        {/* Refraction Comparison View - Shows comparison with previous exams */}
        {patientId && (
          <RefractionComparisonView
            patientId={patientId}
            currentExam={{
              examDate: examData.examDate,
              visualAcuity: examData.visualAcuity,
              objectiveRefraction: examData.objective,
              subjectiveRefraction: examData.subjective,
              keratometry: examData.keratometry
            }}
            showKeratometry={currentStep >= 5}
            showVisualAcuity={true}
          />
        )}
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-4 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className={`flex items-center px-4 py-2 rounded-lg ${
              currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Précédent
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Étape {currentStep} sur {steps.length}
            </span>
          </div>

          {currentStep < steps.length ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSaveExam}
              disabled={saving}
              className={`flex items-center px-4 py-2 rounded-lg ${
                saving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Sauvegarde en cours...' : 'Terminer l\'Examen'}
            </button>
          )}
        </div>
      </div>

      {/* Document Generator Modal */}
      {showDocumentGenerator && patient && (
        <DocumentGenerator
          patientId={patientId}
          visitId={null}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            success('Document généré avec succès!');
            setShowDocumentGenerator(false);
          }}
        />
      )}

      {/* Exam Success Modal - Post-exam actions */}
      {showExamSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Examen sauvegardé avec succès!
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                L'examen de réfraction pour {patient?.firstName} {patient?.lastName} a été enregistré.
              </p>

              <div className="flex flex-col space-y-3">
                {savedExamId && (
                  <button
                    onClick={() => {
                      setShowExamSuccessModal(false);
                      navigate(`/ophthalmology/glasses-order/${savedExamId}`);
                    }}
                    className="btn btn-primary w-full flex items-center justify-center space-x-2"
                  >
                    <Glasses className="h-5 w-5" />
                    <span>Commander lunettes/lentilles</span>
                  </button>
                )}
                <button
                  onClick={() => setShowDocumentGenerator(true)}
                  className="btn btn-secondary w-full flex items-center justify-center space-x-2"
                >
                  <FileText className="h-5 w-5" />
                  <span>Générer ordonnance</span>
                </button>
                <button
                  onClick={() => {
                    setShowExamSuccessModal(false);
                    navigate('/ophthalmology');
                  }}
                  className="btn btn-ghost w-full text-gray-600"
                >
                  Retour au tableau de bord
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}