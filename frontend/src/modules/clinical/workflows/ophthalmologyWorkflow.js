/**
 * Ophthalmology Workflow Configuration
 *
 * Defines the complete clinical workflow for ophthalmology exams.
 * Used with ClinicalWorkflow orchestrator.
 */

export const ophthalmologyWorkflowConfig = {
  id: 'ophthalmology',
  name: 'Consultation Ophtalmologique',
  description: 'Workflow complet pour examen ophtalmologique',

  steps: [
    {
      id: 'complaint',
      label: 'Plainte Principale',
      shortLabel: 'Plainte',
      component: 'ChiefComplaintStep',
      icon: 'MessageSquare',
      required: true,
      requireValidation: false,
      validate: (data) => {
        const errors = {};
        if (!data?.complaint && !data?.motif) {
          errors.complaint = 'Veuillez indiquer le motif de consultation';
        }
        return Object.keys(errors).length > 0 ? errors : null;
      }
    },
    {
      id: 'vitals',
      label: 'Signes Vitaux',
      shortLabel: 'Vitaux',
      component: 'VitalSignsStep',
      icon: 'Activity',
      required: false,
      requireValidation: false
    },
    {
      id: 'visual_acuity',
      label: 'Acuité Visuelle',
      shortLabel: 'AV',
      component: 'VisualAcuityStep',
      icon: 'Eye',
      required: true,
      requireValidation: false
    },
    {
      id: 'objective_refraction',
      label: 'Réfraction Objective',
      shortLabel: 'Réf. Obj.',
      component: 'ObjectiveRefractionStep',
      icon: 'Target',
      required: true,
      requireValidation: false
    },
    {
      id: 'subjective_refraction',
      label: 'Réfraction Subjective',
      shortLabel: 'Réf. Subj.',
      component: 'SubjectiveRefractionStep',
      icon: 'Crosshair',
      required: true,
      requireValidation: false
    },
    {
      id: 'additional_tests',
      label: 'Tests Complémentaires',
      shortLabel: 'Tests',
      component: 'AdditionalTestsStep',
      icon: 'TestTube',
      required: false,
      requireValidation: false
    },
    {
      id: 'keratometry',
      label: 'Kératométrie',
      shortLabel: 'Kérato.',
      component: 'KeratometryStep',
      icon: 'Circle',
      required: false,
      requireValidation: false
    },
    {
      id: 'examination',
      label: 'Examen Ophtalmologique',
      shortLabel: 'Examen',
      component: 'OphthalmologyExamStep',
      icon: 'Scan',
      required: true,
      requireValidation: false
    },
    {
      id: 'diagnosis',
      label: 'Diagnostics',
      shortLabel: 'Diag.',
      component: 'DiagnosisStep',
      icon: 'Stethoscope',
      required: true,
      requireValidation: true,
      validate: (data) => {
        const errors = {};
        if (!Array.isArray(data) || data.length === 0) {
          errors.diagnoses = 'Au moins un diagnostic est requis';
        }
        return Object.keys(errors).length > 0 ? errors : null;
      }
    },
    {
      id: 'procedures',
      label: 'Examens Complémentaires',
      shortLabel: 'Proc.',
      component: 'ProceduresStep',
      icon: 'ClipboardList',
      required: false,
      requireValidation: false
    },
    {
      id: 'laboratory',
      label: 'Analyses Laboratoire',
      shortLabel: 'Labo',
      component: 'LaboratoryStep',
      icon: 'Flask',
      required: false,
      requireValidation: false
    },
    {
      id: 'prescription',
      label: 'Prescription',
      shortLabel: 'Rx',
      component: 'PrescriptionStep',
      icon: 'FileText',
      required: true,
      requireValidation: true,
      validate: (data) => {
        // Prescription validation can be complex - glasses, medications, etc.
        return null;
      }
    },
    {
      id: 'summary',
      label: 'Résumé',
      shortLabel: 'Résumé',
      component: 'SummaryStep',
      icon: 'ClipboardCheck',
      required: false,
      requireValidation: false
    }
  ],

  // Default initial data structure
  defaultData: {
    complaint: {
      complaint: '',
      duration: '',
      severity: 'moderate',
      onset: '',
      associatedSymptoms: [],
      motif: '',
      laterality: ''
    },
    vitals: {
      bloodPressure: '',
      heartRate: '',
      temperature: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      weight: '',
      height: ''
    },
    visual_acuity: {
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
    objective_refraction: {
      method: 'autorefractor',
      device: '',
      OD: { sphere: '', cylinder: '', axis: '' },
      OS: { sphere: '', cylinder: '', axis: '' },
      confidence: 5,
      notes: ''
    },
    subjective_refraction: {
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
    additional_tests: {
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
      }
    },
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
    examination: {
      iop: {
        OD: { value: 0, method: 'goldman' },
        OS: { value: 0, method: 'goldman' }
      },
      slitLamp: {
        OD: {},
        OS: {}
      },
      fundus: {
        OD: {},
        OS: {}
      }
    },
    diagnosis: [],
    procedures: [],
    laboratory: [],
    prescription: {
      type: 'glasses',
      status: 'pending',
      finalPrescription: {
        OD: { sphere: '', cylinder: '', axis: '' },
        OS: { sphere: '', cylinder: '', axis: '' },
        add: ''
      },
      lensTypes: [],
      medications: [],
      recommendations: [],
      comment: ''
    }
  }
};

// Quick workflow for follow-up visits
export const quickFollowUpWorkflowConfig = {
  id: 'quick_followup',
  name: 'Suivi Rapide',
  description: 'Workflow simplifié pour visites de suivi',

  steps: [
    {
      id: 'complaint',
      label: 'Plainte / Suivi',
      shortLabel: 'Plainte',
      component: 'ChiefComplaintStep',
      icon: 'MessageSquare',
      required: true,
      requireValidation: false
    },
    {
      id: 'visual_acuity',
      label: 'Acuité Visuelle',
      shortLabel: 'AV',
      component: 'VisualAcuityStep',
      icon: 'Eye',
      required: true,
      requireValidation: false
    },
    {
      id: 'examination',
      label: 'Examen',
      shortLabel: 'Examen',
      component: 'OphthalmologyExamStep',
      icon: 'Scan',
      required: true,
      requireValidation: false
    },
    {
      id: 'diagnosis',
      label: 'Diagnostics',
      shortLabel: 'Diag.',
      component: 'DiagnosisStep',
      icon: 'Stethoscope',
      required: true,
      requireValidation: true
    },
    {
      id: 'prescription',
      label: 'Prescription',
      shortLabel: 'Rx',
      component: 'PrescriptionStep',
      icon: 'FileText',
      required: false,
      requireValidation: false
    }
  ]
};

// Refraction-only workflow
export const refractionOnlyWorkflowConfig = {
  id: 'refraction_only',
  name: 'Réfraction Seule',
  description: 'Workflow pour réfraction uniquement',

  steps: [
    {
      id: 'visual_acuity',
      label: 'Acuité Visuelle',
      shortLabel: 'AV',
      component: 'VisualAcuityStep',
      icon: 'Eye',
      required: true,
      requireValidation: false
    },
    {
      id: 'objective_refraction',
      label: 'Réfraction Objective',
      shortLabel: 'Réf. Obj.',
      component: 'ObjectiveRefractionStep',
      icon: 'Target',
      required: true,
      requireValidation: false
    },
    {
      id: 'subjective_refraction',
      label: 'Réfraction Subjective',
      shortLabel: 'Réf. Subj.',
      component: 'SubjectiveRefractionStep',
      icon: 'Crosshair',
      required: true,
      requireValidation: false
    },
    {
      id: 'keratometry',
      label: 'Kératométrie',
      shortLabel: 'Kérato.',
      component: 'KeratometryStep',
      icon: 'Circle',
      required: false,
      requireValidation: false
    },
    {
      id: 'prescription',
      label: 'Prescription',
      shortLabel: 'Rx',
      component: 'PrescriptionStep',
      icon: 'FileText',
      required: true,
      requireValidation: true
    }
  ]
};

export default ophthalmologyWorkflowConfig;
