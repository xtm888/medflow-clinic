/**
 * Medication Routes, Application Locations, and Tapering Templates
 * Used for prescription creation in ophthalmology and general practice
 */

// Administration Routes with French labels and icons
export const ADMINISTRATION_ROUTES = [
  // Oral routes
  { value: 'oral', label: 'Voie orale', labelShort: 'PO', icon: '💊', category: 'oral' },
  { value: 'sublingual', label: 'Sublingual', labelShort: 'SL', icon: '👅', category: 'oral' },
  { value: 'buccal', label: 'Buccal', labelShort: 'BUC', icon: '👄', category: 'oral' },

  // Ophthalmic routes (critical for ophthalmology)
  { value: 'ophthalmic', label: 'Ophtalmique (gouttes/pommade)', labelShort: 'OPH', icon: '👁️', category: 'ophthalmic', requiresEye: true },
  { value: 'intravitreal', label: 'Intravitréen (IVT)', labelShort: 'IVT', icon: '💉👁️', category: 'ophthalmic', requiresEye: true },
  { value: 'subconjunctival', label: 'Sous-conjonctival', labelShort: 'SCJ', icon: '💉👁️', category: 'ophthalmic', requiresEye: true },
  { value: 'periocular', label: 'Périoculaire', labelShort: 'PER', icon: '💉👁️', category: 'ophthalmic', requiresEye: true },
  { value: 'intracameral', label: 'Intracamérulaire', labelShort: 'ICM', icon: '💉👁️', category: 'ophthalmic', requiresEye: true },

  // Topical routes
  { value: 'topical', label: 'Topique (peau)', labelShort: 'TOP', icon: '🧴', category: 'topical' },
  { value: 'transdermal', label: 'Transdermique (patch)', labelShort: 'TD', icon: '🩹', category: 'topical' },

  // ENT routes
  { value: 'otic', label: 'Auriculaire (oreille)', labelShort: 'OTC', icon: '👂', category: 'ent' },
  { value: 'nasal', label: 'Nasal', labelShort: 'NAS', icon: '👃', category: 'ent' },
  { value: 'inhalation', label: 'Inhalation', labelShort: 'INH', icon: '🌬️', category: 'ent' },

  // Injectable routes
  { value: 'subcutaneous', label: 'Sous-cutané (SC)', labelShort: 'SC', icon: '💉', category: 'injectable' },
  { value: 'intramuscular', label: 'Intramusculaire (IM)', labelShort: 'IM', icon: '💉', category: 'injectable' },
  { value: 'intravenous', label: 'Intraveineux (IV)', labelShort: 'IV', icon: '💉', category: 'injectable' },

  // Other routes
  { value: 'rectal', label: 'Rectal', labelShort: 'REC', icon: '💊', category: 'other' },
  { value: 'vaginal', label: 'Vaginal', labelShort: 'VAG', icon: '💊', category: 'other' },
  { value: 'other', label: 'Autre', labelShort: 'AUT', icon: '❓', category: 'other' }
];

// Route categories for grouping in UI
export const ROUTE_CATEGORIES = [
  { value: 'ophthalmic', label: 'Ophtalmique', icon: '👁️' },
  { value: 'oral', label: 'Oral', icon: '💊' },
  { value: 'topical', label: 'Topique', icon: '🧴' },
  { value: 'injectable', label: 'Injectable', icon: '💉' },
  { value: 'ent', label: 'ORL', icon: '👂' },
  { value: 'other', label: 'Autre', icon: '❓' }
];

// Eye selection options
export const EYE_OPTIONS = [
  { value: 'OD', label: 'OD (Œil Droit)', labelFull: 'Œil Droit', color: 'blue' },
  { value: 'OS', label: 'OS (Œil Gauche)', labelFull: 'Œil Gauche', color: 'green' },
  { value: 'OU', label: 'OU (Les Deux Yeux)', labelFull: 'Les Deux Yeux', color: 'purple' }
];

// Eye area options for specific application
export const EYE_AREA_OPTIONS = [
  { value: 'conjunctiva', label: 'Conjonctive', description: 'Surface de l\'œil' },
  { value: 'cornea', label: 'Cornée', description: 'Partie transparente antérieure' },
  { value: 'eyelid', label: 'Paupière', description: 'Paupière supérieure ou inférieure' },
  { value: 'lacrimal', label: 'Voies lacrymales', description: 'Canal lacrymal' },
  { value: 'periorbital', label: 'Périorbitaire', description: 'Autour de l\'œil' },
  { value: 'intraocular', label: 'Intraoculaire', description: 'À l\'intérieur de l\'œil' }
];

// Frequency options for tapering
export const FREQUENCY_OPTIONS = [
  { value: '6x/jour', times: 6, label: '6 fois par jour (toutes les 4h)' },
  { value: '5x/jour', times: 5, label: '5 fois par jour' },
  { value: '4x/jour', times: 4, label: '4 fois par jour (QID)' },
  { value: '3x/jour', times: 3, label: '3 fois par jour (TID)' },
  { value: '2x/jour', times: 2, label: '2 fois par jour (BID)' },
  { value: '1x/jour', times: 1, label: '1 fois par jour (QD)' },
  { value: '1x/2jours', times: 0.5, label: '1 jour sur 2' },
  { value: '2x/semaine', times: 0.29, label: '2 fois par semaine' },
  { value: '1x/semaine', times: 0.14, label: '1 fois par semaine' }
];

// ============================================
// TAPERING TEMPLATES
// ============================================

/**
 * Predefined tapering schedules for common medications
 * Used in ophthalmology for corticosteroid eye drops
 */
export const TAPERING_TEMPLATES = {
  // ============================================
  // OPHTHALMIC CORTICOSTEROIDS
  // ============================================

  prednisolone_standard: {
    id: 'prednisolone_standard',
    name: 'Prednisolone - Standard (4 semaines)',
    nameShort: 'Pred Standard',
    drugPattern: /prednisolone|pred\s?forte/i,
    category: 'corticosteroid_ophthalmic',
    indication: 'Post-chirurgie cataracte, inflammation modérée',
    totalDurationDays: 28,
    schedule: [
      { stepNumber: 1, frequency: '4x/jour', frequencyTimes: 4, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 1' },
      { stepNumber: 2, frequency: '3x/jour', frequencyTimes: 3, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 2' },
      { stepNumber: 3, frequency: '2x/jour', frequencyTimes: 2, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 3' },
      { stepNumber: 4, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 4 - puis arrêt' }
    ]
  },

  prednisolone_rapid: {
    id: 'prednisolone_rapid',
    name: 'Prednisolone - Rapide (2 semaines)',
    nameShort: 'Pred Rapide',
    drugPattern: /prednisolone|pred\s?forte/i,
    category: 'corticosteroid_ophthalmic',
    indication: 'Inflammation légère, courte durée',
    totalDurationDays: 14,
    schedule: [
      { stepNumber: 1, frequency: '4x/jour', frequencyTimes: 4, durationDays: 4, dose: { amount: 1, unit: 'goutte' }, instructions: 'Jours 1-4' },
      { stepNumber: 2, frequency: '3x/jour', frequencyTimes: 3, durationDays: 3, dose: { amount: 1, unit: 'goutte' }, instructions: 'Jours 5-7' },
      { stepNumber: 3, frequency: '2x/jour', frequencyTimes: 2, durationDays: 4, dose: { amount: 1, unit: 'goutte' }, instructions: 'Jours 8-11' },
      { stepNumber: 4, frequency: '1x/jour', frequencyTimes: 1, durationDays: 3, dose: { amount: 1, unit: 'goutte' }, instructions: 'Jours 12-14 - puis arrêt' }
    ]
  },

  prednisolone_extended: {
    id: 'prednisolone_extended',
    name: 'Prednisolone - Prolongé (6 semaines)',
    nameShort: 'Pred Prolongé',
    drugPattern: /prednisolone|pred\s?forte/i,
    category: 'corticosteroid_ophthalmic',
    indication: 'Uvéite, inflammation sévère, greffe cornéenne',
    totalDurationDays: 42,
    schedule: [
      { stepNumber: 1, frequency: '6x/jour', frequencyTimes: 6, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 1 - Phase intensive' },
      { stepNumber: 2, frequency: '4x/jour', frequencyTimes: 4, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 2' },
      { stepNumber: 3, frequency: '3x/jour', frequencyTimes: 3, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 3' },
      { stepNumber: 4, frequency: '2x/jour', frequencyTimes: 2, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 4' },
      { stepNumber: 5, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 5' },
      { stepNumber: 6, frequency: '1x/2jours', frequencyTimes: 0.5, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 6 - puis arrêt' }
    ]
  },

  dexamethasone_standard: {
    id: 'dexamethasone_standard',
    name: 'Dexaméthasone - Standard (3 semaines)',
    nameShort: 'Dexa Standard',
    drugPattern: /dexamethasone|maxidex|tobradex/i,
    category: 'corticosteroid_ophthalmic',
    indication: 'Post-opératoire, inflammation',
    totalDurationDays: 21,
    schedule: [
      { stepNumber: 1, frequency: '4x/jour', frequencyTimes: 4, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 1' },
      { stepNumber: 2, frequency: '2x/jour', frequencyTimes: 2, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 2' },
      { stepNumber: 3, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 1, unit: 'goutte' }, instructions: 'Semaine 3 - puis arrêt' }
    ]
  },

  fluorometholone_mild: {
    id: 'fluorometholone_mild',
    name: 'Fluorométholone - Léger (2 semaines)',
    nameShort: 'FML Léger',
    drugPattern: /fluorometholone|fml|flucon/i,
    category: 'corticosteroid_ophthalmic',
    indication: 'Inflammation légère, allergie',
    totalDurationDays: 14,
    schedule: [
      { stepNumber: 1, frequency: '4x/jour', frequencyTimes: 4, durationDays: 5, dose: { amount: 1, unit: 'goutte' }, instructions: 'Jours 1-5' },
      { stepNumber: 2, frequency: '2x/jour', frequencyTimes: 2, durationDays: 5, dose: { amount: 1, unit: 'goutte' }, instructions: 'Jours 6-10' },
      { stepNumber: 3, frequency: '1x/jour', frequencyTimes: 1, durationDays: 4, dose: { amount: 1, unit: 'goutte' }, instructions: 'Jours 11-14 - puis arrêt' }
    ]
  },

  // ============================================
  // ORAL CORTICOSTEROIDS
  // ============================================

  prednisone_uveitis: {
    id: 'prednisone_uveitis',
    name: 'Prednisone - Uvéite (8 semaines)',
    nameShort: 'Pred Oral Uvéite',
    drugPattern: /prednisone|cortancyl|solupred/i,
    category: 'corticosteroid_oral',
    indication: 'Uvéite sévère, sclérite',
    totalDurationDays: 56,
    schedule: [
      { stepNumber: 1, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 60, unit: 'mg' }, instructions: 'Semaine 1 - Dose d\'attaque' },
      { stepNumber: 2, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 50, unit: 'mg' }, instructions: 'Semaine 2' },
      { stepNumber: 3, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 40, unit: 'mg' }, instructions: 'Semaine 3' },
      { stepNumber: 4, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 30, unit: 'mg' }, instructions: 'Semaine 4' },
      { stepNumber: 5, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 20, unit: 'mg' }, instructions: 'Semaine 5' },
      { stepNumber: 6, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 15, unit: 'mg' }, instructions: 'Semaine 6' },
      { stepNumber: 7, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 10, unit: 'mg' }, instructions: 'Semaine 7' },
      { stepNumber: 8, frequency: '1x/jour', frequencyTimes: 1, durationDays: 7, dose: { amount: 5, unit: 'mg' }, instructions: 'Semaine 8 - puis arrêt' }
    ]
  },

  prednisone_short: {
    id: 'prednisone_short',
    name: 'Prednisone - Court (2 semaines)',
    nameShort: 'Pred Oral Court',
    drugPattern: /prednisone|cortancyl|solupred/i,
    category: 'corticosteroid_oral',
    indication: 'Névrite optique, inflammation aiguë',
    totalDurationDays: 14,
    schedule: [
      { stepNumber: 1, frequency: '1x/jour', frequencyTimes: 1, durationDays: 3, dose: { amount: 60, unit: 'mg' }, instructions: 'Jours 1-3' },
      { stepNumber: 2, frequency: '1x/jour', frequencyTimes: 1, durationDays: 3, dose: { amount: 40, unit: 'mg' }, instructions: 'Jours 4-6' },
      { stepNumber: 3, frequency: '1x/jour', frequencyTimes: 1, durationDays: 3, dose: { amount: 20, unit: 'mg' }, instructions: 'Jours 7-9' },
      { stepNumber: 4, frequency: '1x/jour', frequencyTimes: 1, durationDays: 3, dose: { amount: 10, unit: 'mg' }, instructions: 'Jours 10-12' },
      { stepNumber: 5, frequency: '1x/jour', frequencyTimes: 1, durationDays: 2, dose: { amount: 5, unit: 'mg' }, instructions: 'Jours 13-14 - puis arrêt' }
    ]
  },

  // ============================================
  // MYDRIATICS / CYCLOPLEGICS
  // ============================================

  atropine_amblyopia: {
    id: 'atropine_amblyopia',
    name: 'Atropine - Amblyopie (12 semaines)',
    nameShort: 'Atropine Amblyopie',
    drugPattern: /atropine/i,
    category: 'mydriatic',
    indication: 'Traitement d\'amblyopie - pénalisation',
    totalDurationDays: 84,
    schedule: [
      { stepNumber: 1, frequency: '1x/jour', frequencyTimes: 1, durationDays: 28, dose: { amount: 1, unit: 'goutte' }, instructions: 'Mois 1 - Dans l\'œil sain' },
      { stepNumber: 2, frequency: '1x/jour', frequencyTimes: 1, durationDays: 28, dose: { amount: 1, unit: 'goutte' }, instructions: 'Mois 2 - Réévaluation acuité' },
      { stepNumber: 3, frequency: '2x/semaine', frequencyTimes: 0.29, durationDays: 28, dose: { amount: 1, unit: 'goutte' }, instructions: 'Mois 3 - Sevrage progressif' }
    ]
  }
};

// Get tapering templates by category
export const getTaperingTemplatesByCategory = (category) => {
  return Object.values(TAPERING_TEMPLATES).filter(t => t.category === category);
};

// Get tapering template suggestions based on drug name
export const getSuggestedTaperingTemplates = (drugName) => {
  if (!drugName) return [];
  return Object.values(TAPERING_TEMPLATES).filter(t => t.drugPattern.test(drugName));
};

// Tapering categories
export const TAPERING_CATEGORIES = [
  { value: 'corticosteroid_ophthalmic', label: 'Corticoïdes ophtalmiques', icon: '👁️' },
  { value: 'corticosteroid_oral', label: 'Corticoïdes oraux', icon: '💊' },
  { value: 'mydriatic', label: 'Mydriatiques', icon: '👁️' }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate tapering schedule with dates
 * @param {Object} template - Tapering template
 * @param {Date} startDate - Start date of treatment
 * @returns {Array} Schedule with calculated dates
 */
export const calculateTaperingDates = (template, startDate = new Date()) => {
  let currentDay = 0;
  return template.schedule.map(step => {
    const stepStartDate = new Date(startDate);
    stepStartDate.setDate(stepStartDate.getDate() + currentDay);

    const stepEndDate = new Date(stepStartDate);
    stepEndDate.setDate(stepEndDate.getDate() + step.durationDays - 1);

    const result = {
      ...step,
      startDay: currentDay + 1,
      endDay: currentDay + step.durationDays,
      startDate: stepStartDate,
      endDate: stepEndDate
    };

    currentDay += step.durationDays;
    return result;
  });
};

/**
 * Check if medication requires tapering (based on drug name)
 * @param {string} drugName - Name of the drug
 * @returns {boolean}
 */
export const requiresTapering = (drugName) => {
  const taperingDrugs = [
    /prednisolone/i,
    /prednisone/i,
    /dexamethasone/i,
    /fluorometholone/i,
    /loteprednol/i,
    /methylprednisolone/i,
    /hydrocortisone/i,
    /betamethasone/i,
    /triamcinolone/i
  ];
  return taperingDrugs.some(pattern => pattern.test(drugName));
};

/**
 * Check if route requires eye selection
 * @param {string} route - Administration route
 * @returns {boolean}
 */
export const routeRequiresEye = (route) => {
  const routeData = ADMINISTRATION_ROUTES.find(r => r.value === route);
  return routeData?.requiresEye || false;
};

/**
 * Get route by value
 * @param {string} value - Route value
 * @returns {Object|null}
 */
export const getRouteByValue = (value) => {
  return ADMINISTRATION_ROUTES.find(r => r.value === value) || null;
};

/**
 * Format tapering schedule for display
 * @param {Array} schedule - Tapering schedule
 * @returns {string}
 */
export const formatTaperingSchedule = (schedule) => {
  if (!schedule || schedule.length === 0) return '';
  return schedule.map(step =>
    `${step.frequency} pendant ${step.durationDays}j`
  ).join(' → ');
};

export default {
  ADMINISTRATION_ROUTES,
  ROUTE_CATEGORIES,
  EYE_OPTIONS,
  EYE_AREA_OPTIONS,
  FREQUENCY_OPTIONS,
  TAPERING_TEMPLATES,
  TAPERING_CATEGORIES,
  getTaperingTemplatesByCategory,
  getSuggestedTaperingTemplates,
  calculateTaperingDates,
  requiresTapering,
  routeRequiresEye,
  getRouteByValue,
  formatTaperingSchedule
};
