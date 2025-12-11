/**
 * Pediatric Ophthalmology Workflow Configuration
 *
 * Age-adaptive workflow configuration for pediatric patients.
 * Adjusts steps and requirements based on patient age.
 */

/**
 * Age categories for workflow adaptation
 */
export const AGE_CATEGORIES = {
  NEWBORN: { min: 0, max: 0.25, label: 'Nouveau-né (0-3 mois)' },      // 0-3 months
  INFANT: { min: 0.25, max: 1, label: 'Nourrisson (3-12 mois)' },      // 3-12 months
  TODDLER: { min: 1, max: 3, label: 'Bambin (1-3 ans)' },              // 1-3 years
  PRESCHOOL: { min: 3, max: 6, label: 'Préscolaire (3-6 ans)' },       // 3-6 years
  SCHOOL_AGE: { min: 6, max: 12, label: 'Âge scolaire (6-12 ans)' },   // 6-12 years
  ADOLESCENT: { min: 12, max: 18, label: 'Adolescent (12-18 ans)' },   // 12-18 years
  ADULT: { min: 18, max: 999, label: 'Adulte (18+ ans)' }              // 18+ years
};

/**
 * Get age category from years
 */
export function getAgeCategory(ageInYears) {
  for (const [key, range] of Object.entries(AGE_CATEGORIES)) {
    if (ageInYears >= range.min && ageInYears < range.max) {
      return key;
    }
  }
  return 'ADULT';
}

/**
 * Pediatric-specific workflow steps
 */
export const PEDIATRIC_STEPS = {
  // Birth History - for infants and young children
  birthHistory: {
    id: 'birthHistory',
    label: 'Antécédents de Naissance',
    shortLabel: 'Naissance',
    component: 'BirthHistoryStep',
    icon: 'Baby',
    description: 'Informations sur la grossesse et l\'accouchement',
    applicableAges: ['NEWBORN', 'INFANT', 'TODDLER', 'PRESCHOOL'],
    fields: [
      'gestationalAge',
      'birthWeight',
      'apgarScore',
      'deliveryType',
      'nicuStay',
      'nicuDuration',
      'ropScreening',
      'complications'
    ]
  },

  // Visual Development Milestones
  visualDevelopment: {
    id: 'visualDevelopment',
    label: 'Développement Visuel',
    shortLabel: 'Développement',
    component: 'VisualDevelopmentStep',
    icon: 'Eye',
    description: 'Évaluation des étapes de développement visuel',
    applicableAges: ['NEWBORN', 'INFANT', 'TODDLER', 'PRESCHOOL'],
    fields: [
      'fixAndFollow',
      'socialSmile',
      'reachesForObjects',
      'recognizesFaces',
      'trackingHorizontal',
      'trackingVertical',
      'convergence',
      'stereopsis'
    ]
  },

  // Red Reflex Test - for newborns
  redReflex: {
    id: 'redReflex',
    label: 'Test du Réflexe Rouge',
    shortLabel: 'Bruckner',
    component: 'RedReflexStep',
    icon: 'Flashlight',
    description: 'Test de Bruckner pour dépistage',
    applicableAges: ['NEWBORN', 'INFANT'],
    fields: ['redReflexOD', 'redReflexOS', 'symmetry', 'leukocoria', 'notes']
  },

  // Fix and Follow - for very young
  fixAndFollow: {
    id: 'fixAndFollow',
    label: 'Fixation et Poursuite',
    shortLabel: 'Fix & Follow',
    component: 'FixAndFollowStep',
    icon: 'Target',
    description: 'Évaluation de la fixation et poursuite oculaire',
    applicableAges: ['NEWBORN', 'INFANT', 'TODDLER'],
    fields: ['centralSteady', 'maintained', 'followsHorizontal', 'followsVertical', 'preference']
  },

  // Hirschberg / Corneal Light Reflex
  hirschberg: {
    id: 'hirschberg',
    label: 'Test de Hirschberg',
    shortLabel: 'Hirschberg',
    component: 'HirschbergStep',
    icon: 'Circle',
    description: 'Test du reflet lumineux cornéen',
    applicableAges: ['NEWBORN', 'INFANT', 'TODDLER', 'PRESCHOOL'],
    fields: ['reflexOD', 'reflexOS', 'angle', 'type']
  },

  // Cover/Uncover Test
  coverTest: {
    id: 'coverTest',
    label: 'Test de l\'Écran',
    shortLabel: 'Cover Test',
    component: 'CoverTestStep',
    icon: 'EyeOff',
    description: 'Test d\'écran pour détection du strabisme',
    applicableAges: ['INFANT', 'TODDLER', 'PRESCHOOL', 'SCHOOL_AGE', 'ADOLESCENT'],
    fields: ['unilateralOD', 'unilateralOS', 'alternating', 'deviationType', 'angle', 'distance', 'near']
  },

  // Motility Evaluation
  motility: {
    id: 'motility',
    label: 'Motilité Oculaire',
    shortLabel: 'Motilité',
    component: 'MotilityStep',
    icon: 'Move',
    description: 'Évaluation des mouvements oculaires',
    applicableAges: ['INFANT', 'TODDLER', 'PRESCHOOL', 'SCHOOL_AGE', 'ADOLESCENT'],
    fields: ['versions', 'ductions', 'nystagmus', 'restrictions']
  },

  // Stereopsis Testing
  stereopsis: {
    id: 'stereopsis',
    label: 'Test de Stéréopsie',
    shortLabel: 'Stéréopsie',
    component: 'StereopsisStep',
    icon: 'Box',
    description: 'Évaluation de la vision binoculaire',
    applicableAges: ['TODDLER', 'PRESCHOOL', 'SCHOOL_AGE', 'ADOLESCENT'],
    fields: ['testUsed', 'result', 'secondsOfArc']
  },

  // Color Vision Testing
  colorVision: {
    id: 'colorVision',
    label: 'Vision des Couleurs',
    shortLabel: 'Couleurs',
    component: 'ColorVisionStep',
    icon: 'Palette',
    description: 'Test de vision des couleurs',
    applicableAges: ['PRESCHOOL', 'SCHOOL_AGE', 'ADOLESCENT'],
    fields: ['testUsed', 'result', 'type', 'severity']
  },

  // Amblyopia Risk Assessment
  amblyopiaRisk: {
    id: 'amblyopiaRisk',
    label: 'Risque d\'Amblyopie',
    shortLabel: 'Amblyopie',
    component: 'AmblyopiaRiskStep',
    icon: 'AlertTriangle',
    description: 'Évaluation des facteurs de risque d\'amblyopie',
    applicableAges: ['NEWBORN', 'INFANT', 'TODDLER', 'PRESCHOOL', 'SCHOOL_AGE'],
    fields: ['riskFactors', 'riskLevel', 'treatmentIndicated']
  }
};

/**
 * Visual Acuity testing methods by age
 */
export const VA_METHODS_BY_AGE = {
  NEWBORN: {
    primary: 'preferential_looking',
    alternatives: ['fix_and_follow', 'optokinetic_nystagmus'],
    label: 'Test de regard préférentiel'
  },
  INFANT: {
    primary: 'teller_cards',
    alternatives: ['cardiff_cards', 'preferential_looking'],
    label: 'Cartes de Teller'
  },
  TODDLER: {
    primary: 'lea_symbols',
    alternatives: ['cardiff_cards', 'teller_cards'],
    label: 'Symboles de Lea'
  },
  PRESCHOOL: {
    primary: 'lea_symbols',
    alternatives: ['hotv', 'tumbling_e'],
    label: 'Symboles de Lea / HOTV'
  },
  SCHOOL_AGE: {
    primary: 'snellen',
    alternatives: ['lea_symbols', 'tumbling_e'],
    label: 'Échelle de Snellen'
  },
  ADOLESCENT: {
    primary: 'snellen',
    alternatives: ['etdrs', 'landolt_c'],
    label: 'Snellen / ETDRS'
  }
};

/**
 * Get workflow steps for a specific age category
 */
export function getWorkflowStepsForAge(ageCategory) {
  // Base steps for all pediatric patients
  const baseSteps = [
    'chiefComplaint',
    'medicalHistory'
  ];

  // Age-specific steps
  const ageSpecificSteps = {
    NEWBORN: [
      'birthHistory',
      'visualDevelopment',
      'redReflex',
      'fixAndFollow',
      'hirschberg',
      'anteriorSegment',
      'fundoscopy',
      'amblyopiaRisk',
      'diagnosis',
      'treatment',
      'summary'
    ],
    INFANT: [
      'birthHistory',
      'visualDevelopment',
      'fixAndFollow',
      'hirschberg',
      'coverTest',
      'motility',
      'anteriorSegment',
      'fundoscopy',
      'amblyopiaRisk',
      'diagnosis',
      'treatment',
      'summary'
    ],
    TODDLER: [
      'visualDevelopment',
      'visualAcuity',
      'hirschberg',
      'coverTest',
      'motility',
      'stereopsis',
      'refraction',
      'anteriorSegment',
      'fundoscopy',
      'amblyopiaRisk',
      'diagnosis',
      'treatment',
      'summary'
    ],
    PRESCHOOL: [
      'visualAcuity',
      'refraction',
      'hirschberg',
      'coverTest',
      'motility',
      'stereopsis',
      'colorVision',
      'anteriorSegment',
      'fundoscopy',
      'amblyopiaRisk',
      'diagnosis',
      'treatment',
      'summary'
    ],
    SCHOOL_AGE: [
      'visualAcuity',
      'refraction',
      'coverTest',
      'motility',
      'stereopsis',
      'colorVision',
      'anteriorSegment',
      'tonometry',
      'fundoscopy',
      'diagnosis',
      'treatment',
      'summary'
    ],
    ADOLESCENT: [
      'visualAcuity',
      'refraction',
      'coverTest',
      'motility',
      'stereopsis',
      'colorVision',
      'anteriorSegment',
      'tonometry',
      'fundoscopy',
      'diagnosis',
      'treatment',
      'summary'
    ]
  };

  return [...baseSteps, ...(ageSpecificSteps[ageCategory] || ageSpecificSteps.ADOLESCENT)];
}

/**
 * Generate full pediatric workflow configuration
 */
export function getPediatricWorkflowConfig(ageInYears, patient = {}) {
  const ageCategory = getAgeCategory(ageInYears);
  const stepIds = getWorkflowStepsForAge(ageCategory);
  const vaMethod = VA_METHODS_BY_AGE[ageCategory];

  return {
    name: `Consultation Pédiatrique - ${AGE_CATEGORIES[ageCategory].label}`,
    type: 'pediatric_ophthalmology',
    ageCategory,
    ageInYears,
    vaMethod,
    steps: stepIds.map(stepId => {
      // Use pediatric step config if available
      if (PEDIATRIC_STEPS[stepId]) {
        return PEDIATRIC_STEPS[stepId];
      }

      // Fall back to standard step
      return {
        id: stepId,
        label: stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/([A-Z])/g, ' $1'),
        shortLabel: stepId.charAt(0).toUpperCase() + stepId.slice(1, 6),
        component: `${stepId.charAt(0).toUpperCase() + stepId.slice(1)}Step`
      };
    }),
    metadata: {
      patientAge: ageInYears,
      ageCategory,
      isPediatric: true,
      recommendedVAMethod: vaMethod.primary,
      alternativeVAMethods: vaMethod.alternatives
    }
  };
}

export default getPediatricWorkflowConfig;
