/**
 * Age Calculator Utilities
 *
 * Comprehensive age calculation utilities for pediatric ophthalmology.
 * Supports years, months, and developmental stage classification.
 */

/**
 * Calculate age in years from date of birth
 * @param {Date|string} dob - Date of birth
 * @param {Date} asOf - Calculate age as of this date (defaults to today)
 * @returns {number} Age in years (decimal)
 */
function calculateAge(dob, asOf = new Date()) {
  if (!dob) return null;

  const birthDate = new Date(dob);
  const referenceDate = new Date(asOf);

  if (isNaN(birthDate.getTime())) return null;

  const diffMs = referenceDate - birthDate;
  const ageDate = new Date(diffMs);
  const years = Math.abs(ageDate.getUTCFullYear() - 1970);

  return years;
}

/**
 * Calculate age in exact years and months
 * @param {Date|string} dob - Date of birth
 * @param {Date} asOf - Calculate age as of this date
 * @returns {Object} { years, months, totalMonths, days }
 */
function calculateDetailedAge(dob, asOf = new Date()) {
  if (!dob) return null;

  const birthDate = new Date(dob);
  const referenceDate = new Date(asOf);

  if (isNaN(birthDate.getTime())) return null;

  let years = referenceDate.getFullYear() - birthDate.getFullYear();
  let months = referenceDate.getMonth() - birthDate.getMonth();
  let days = referenceDate.getDate() - birthDate.getDate();

  // Adjust for negative days
  if (days < 0) {
    months--;
    const lastDayOfPrevMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0).getDate();
    days += lastDayOfPrevMonth;
  }

  // Adjust for negative months
  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  return {
    years,
    months,
    totalMonths,
    days,
    isInfant: totalMonths < 12,
    isToddler: totalMonths >= 12 && totalMonths < 36,
    isPreschool: years >= 3 && years < 6,
    isSchoolAge: years >= 6 && years < 12,
    isAdolescent: years >= 12 && years < 18,
    isAdult: years >= 18,
    isPediatric: years < 18
  };
}

/**
 * Format age for display
 * @param {Date|string} dob - Date of birth
 * @param {Object} options - Formatting options
 * @returns {string} Formatted age string
 */
function formatAge(dob, options = {}) {
  const { locale = 'fr', verbose = false } = options;
  const age = calculateDetailedAge(dob);

  if (!age) return 'N/A';

  // French labels
  const labels = {
    fr: {
      year: 'an',
      years: 'ans',
      month: 'mois',
      months: 'mois',
      day: 'jour',
      days: 'jours',
      newborn: 'Nouveau-né',
      infant: 'Nourrisson',
      toddler: 'Bambin',
      child: 'Enfant',
      adolescent: 'Adolescent',
      adult: 'Adulte'
    },
    en: {
      year: 'year',
      years: 'years',
      month: 'month',
      months: 'months',
      day: 'day',
      days: 'days',
      newborn: 'Newborn',
      infant: 'Infant',
      toddler: 'Toddler',
      child: 'Child',
      adolescent: 'Adolescent',
      adult: 'Adult'
    }
  };

  const l = labels[locale] || labels.en;

  // Format based on age
  if (age.totalMonths < 1) {
    // Newborn - show days
    return verbose
      ? `${age.days} ${age.days === 1 ? l.day : l.days} (${l.newborn})`
      : `${age.days}j`;
  } else if (age.totalMonths < 24) {
    // Under 2 years - show months
    return verbose
      ? `${age.totalMonths} ${l.months} (${age.isInfant ? l.infant : l.toddler})`
      : `${age.totalMonths}m`;
  } else if (age.years < 18) {
    // Child/adolescent - show years and months
    const monthPart = age.months > 0 ? ` ${age.months}m` : '';
    const category = age.years < 12 ? l.child : l.adolescent;
    return verbose
      ? `${age.years} ${age.years === 1 ? l.year : l.years}${monthPart} (${category})`
      : `${age.years}${age.months > 0 ? `a${age.months}m` : 'a'}`;
  } else {
    // Adult - show years only
    return verbose
      ? `${age.years} ${l.years} (${l.adult})`
      : `${age.years}a`;
  }
}

/**
 * Get pediatric age category for workflow selection
 * @param {Date|string} dob - Date of birth
 * @returns {string} Age category
 */
function getPediatricCategory(dob) {
  const age = calculateDetailedAge(dob);
  if (!age) return 'unknown';

  if (age.totalMonths < 3) return 'newborn';        // 0-3 months
  if (age.totalMonths < 12) return 'infant';        // 3-12 months
  if (age.totalMonths < 36) return 'toddler';       // 1-3 years
  if (age.years < 6) return 'preschool';            // 3-6 years
  if (age.years < 12) return 'school_age';          // 6-12 years
  if (age.years < 18) return 'adolescent';          // 12-18 years
  return 'adult';                                    // 18+ years
}

/**
 * Check if patient requires pediatric workflow
 * @param {Date|string} dob - Date of birth
 * @param {number} threshold - Age threshold for pediatric (default 16)
 * @returns {boolean}
 */
function requiresPediatricWorkflow(dob, threshold = 16) {
  const age = calculateAge(dob);
  if (age === null) return false;
  return age < threshold;
}

/**
 * Get expected visual development milestones for age
 * @param {Date|string} dob - Date of birth
 * @returns {Object} Expected milestones
 */
function getExpectedMilestones(dob) {
  const age = calculateDetailedAge(dob);
  if (!age) return null;

  const milestones = {
    fixAndFollow: {
      expectedBy: 3,   // months
      label: 'Fixation et poursuite',
      achieved: age.totalMonths >= 3 ? 'should_be_present' : 'too_early'
    },
    socialSmile: {
      expectedBy: 2,
      label: 'Sourire social',
      achieved: age.totalMonths >= 2 ? 'should_be_present' : 'too_early'
    },
    reachesForObjects: {
      expectedBy: 4,
      label: 'Atteinte des objets',
      achieved: age.totalMonths >= 4 ? 'should_be_present' : 'too_early'
    },
    recognizesFaces: {
      expectedBy: 3,
      label: 'Reconnaissance des visages',
      achieved: age.totalMonths >= 3 ? 'should_be_present' : 'too_early'
    },
    trackingHorizontal: {
      expectedBy: 2,
      label: 'Poursuite horizontale',
      achieved: age.totalMonths >= 2 ? 'should_be_present' : 'too_early'
    },
    trackingVertical: {
      expectedBy: 3,
      label: 'Poursuite verticale',
      achieved: age.totalMonths >= 3 ? 'should_be_present' : 'too_early'
    },
    convergence: {
      expectedBy: 4,
      label: 'Convergence',
      achieved: age.totalMonths >= 4 ? 'should_be_present' : 'too_early'
    },
    colorRecognition: {
      expectedBy: 36,  // 3 years
      label: 'Reconnaissance des couleurs',
      achieved: age.totalMonths >= 36 ? 'should_be_present' : 'too_early'
    },
    stereopsis: {
      expectedBy: 4,
      label: 'Stéréopsie',
      achieved: age.totalMonths >= 4 ? 'should_be_present' : 'too_early'
    }
  };

  // Add age context
  milestones.ageContext = {
    months: age.totalMonths,
    category: getPediatricCategory(dob),
    isPremature: null  // Would need gestational age info
  };

  return milestones;
}

/**
 * Get appropriate visual acuity testing method for age
 * @param {Date|string} dob - Date of birth
 * @returns {Object} Recommended VA testing method
 */
function getVATestingMethod(dob) {
  const age = calculateDetailedAge(dob);
  if (!age) return null;

  if (age.totalMonths < 6) {
    return {
      method: 'preferential_looking',
      label: 'Test de regard préférentiel (Teller)',
      alternatives: ['fix_and_follow', 'optokinetic_nystagmus'],
      snellenEquivalent: false
    };
  } else if (age.totalMonths < 24) {
    return {
      method: 'teller_cards',
      label: 'Cartes de Teller',
      alternatives: ['cardiff_cards', 'lea_gratings'],
      snellenEquivalent: true
    };
  } else if (age.years < 4) {
    return {
      method: 'lea_symbols',
      label: 'Symboles de Lea',
      alternatives: ['cardiff_cards', 'kay_pictures'],
      snellenEquivalent: true
    };
  } else if (age.years < 6) {
    return {
      method: 'lea_symbols',
      label: 'Symboles de Lea / HOTV',
      alternatives: ['tumbling_e', 'landolt_c'],
      snellenEquivalent: true
    };
  } else {
    return {
      method: 'snellen',
      label: 'Échelle de Snellen / ETDRS',
      alternatives: ['landolt_c', 'tumbling_e'],
      snellenEquivalent: true
    };
  }
}

/**
 * Get recommended amblyopia screening schedule
 * @param {Date|string} dob - Date of birth
 * @returns {Object} Screening schedule
 */
function getAmblyopiaScreeningSchedule(dob) {
  const age = calculateDetailedAge(dob);
  if (!age) return null;

  const schedule = {
    newborn: {
      ageRange: '0-3 mois',
      exams: ['Red reflex (Bruckner)', 'External eye exam', 'Fix and follow'],
      frequency: 'At birth and 2-month checkup'
    },
    infant: {
      ageRange: '6-12 mois',
      exams: ['Hirschberg test', 'Cover/uncover test', 'Fixation preference', 'Red reflex'],
      frequency: '6 and 9-month checkups'
    },
    toddler: {
      ageRange: '1-3 ans',
      exams: ['Photoscreening', 'Stereopsis (Lang)', 'Cover test', 'VA with Teller/Lea'],
      frequency: 'Annual'
    },
    preschool: {
      ageRange: '3-5 ans',
      exams: ['VA with Lea/HOTV', 'Stereopsis', 'Cover test', 'Autorefraction'],
      frequency: 'At 3 and before school entry'
    },
    schoolAge: {
      ageRange: '6-18 ans',
      exams: ['VA with Snellen', 'Color vision', 'Stereopsis', 'Cover test'],
      frequency: 'Every 1-2 years or as indicated'
    }
  };

  // Determine current schedule based on age
  let currentSchedule;
  if (age.totalMonths < 6) {
    currentSchedule = schedule.newborn;
  } else if (age.totalMonths < 12) {
    currentSchedule = schedule.infant;
  } else if (age.years < 3) {
    currentSchedule = schedule.toddler;
  } else if (age.years < 6) {
    currentSchedule = schedule.preschool;
  } else {
    currentSchedule = schedule.schoolAge;
  }

  return {
    current: currentSchedule,
    fullSchedule: schedule,
    ageCategory: getPediatricCategory(dob),
    ageMonths: age.totalMonths,
    ageYears: age.years
  };
}

/**
 * Calculate corrected age for premature infants
 * @param {Date|string} dob - Date of birth
 * @param {number} gestationalAge - Gestational age at birth (weeks)
 * @returns {Object} Corrected age info
 */
function calculateCorrectedAge(dob, gestationalAge) {
  if (!dob || !gestationalAge) return null;

  const chronologicalAge = calculateDetailedAge(dob);
  if (!chronologicalAge) return null;

  // Full term is 40 weeks
  const weeksPreterm = 40 - gestationalAge;

  if (weeksPreterm <= 0) {
    // Not premature
    return {
      chronologicalAge,
      correctedAge: chronologicalAge,
      isPremature: false,
      weeksPreterm: 0
    };
  }

  // Calculate corrected age (subtract preterm weeks)
  const correctedBirthDate = new Date(dob);
  correctedBirthDate.setDate(correctedBirthDate.getDate() + (weeksPreterm * 7));

  const correctedAge = calculateDetailedAge(correctedBirthDate);

  // Corrected age is typically used until 2-3 years of age
  const useCorrectedAge = chronologicalAge.years < 3;

  return {
    chronologicalAge,
    correctedAge,
    isPremature: true,
    weeksPreterm,
    gestationalAge,
    useCorrectedAge,
    note: useCorrectedAge
      ? 'Use corrected age for developmental assessment'
      : 'Corrected age no longer needed at this age'
  };
}

/**
 * Get age-appropriate workflow steps
 * @param {Date|string} dob - Date of birth
 * @returns {Array} Recommended workflow steps
 */
function getAgeAppropriateWorkflowSteps(dob) {
  const category = getPediatricCategory(dob);

  // Base steps for all ages
  const baseSteps = [
    'chiefComplaint',
    'medicalHistory',
    'visualAcuity',
    'anteriorSegment',
    'fundoscopy',
    'diagnosis',
    'treatment',
    'summary'
  ];

  // Age-specific modifications
  const ageSpecificSteps = {
    newborn: [
      'chiefComplaint',
      'birthHistory',
      'visualDevelopment',
      'redReflex',
      'anteriorSegment',
      'fundoscopy',
      'diagnosis',
      'treatment',
      'summary'
    ],
    infant: [
      'chiefComplaint',
      'birthHistory',
      'visualDevelopment',
      'fixAndFollow',
      'hirschberg',
      'anteriorSegment',
      'fundoscopy',
      'diagnosis',
      'treatment',
      'summary'
    ],
    toddler: [
      'chiefComplaint',
      'visualDevelopment',
      'visualAcuity',  // Teller/Lea
      'motility',
      'coverTest',
      'anteriorSegment',
      'fundoscopy',
      'diagnosis',
      'treatment',
      'summary'
    ],
    preschool: [
      'chiefComplaint',
      'visualAcuity',  // Lea/HOTV
      'refraction',
      'motility',
      'coverTest',
      'stereopsis',
      'anteriorSegment',
      'fundoscopy',
      'diagnosis',
      'treatment',
      'summary'
    ],
    school_age: [
      'chiefComplaint',
      'visualAcuity',
      'refraction',
      'motility',
      'coverTest',
      'stereopsis',
      'colorVision',
      'anteriorSegment',
      'fundoscopy',
      'diagnosis',
      'treatment',
      'summary'
    ],
    adolescent: baseSteps,
    adult: baseSteps
  };

  return ageSpecificSteps[category] || baseSteps;
}

module.exports = {
  calculateAge,
  calculateDetailedAge,
  formatAge,
  getPediatricCategory,
  requiresPediatricWorkflow,
  getExpectedMilestones,
  getVATestingMethod,
  getAmblyopiaScreeningSchedule,
  calculateCorrectedAge,
  getAgeAppropriateWorkflowSteps
};
