/**
 * Prescription Safety Utilities
 *
 * Comprehensive safety checks for prescription medications including:
 * - Allergy checking
 * - Drug contraindications
 * - Drug-drug interactions
 * - Age-appropriate dosing
 * - Pregnancy/lactation safety
 */

import { safeString, isArray } from './apiHelpers';

/**
 * Check if patient has known allergies to the drug
 * @param {Object} patient - Patient object with allergies array
 * @param {Object} drug - Drug object with generic name
 * @returns {Object} Allergy check result
 */
export const checkAllergies = (patient, drug) => {
  if (!patient || !patient.allergies || !isArray(patient.allergies) || patient.allergies.length === 0) {
    return { hasAllergy: false };
  }

  const drugName = safeString(drug.genericName || drug.name, '').toLowerCase();
  const brandName = safeString(drug.brandName, '').toLowerCase();

  // Check each allergy
  const matchingAllergies = patient.allergies.filter(allergy => {
    const allergen = safeString(allergy.allergen || allergy, '').toLowerCase();

    // Check if allergen matches drug name (either way)
    return allergen.includes(drugName) ||
           drugName.includes(allergen) ||
           (brandName && (allergen.includes(brandName) || brandName.includes(allergen)));
  });

  if (matchingAllergies.length > 0) {
    const allergy = matchingAllergies[0];
    return {
      hasAllergy: true,
      allergen: safeString(allergy.allergen || allergy, ''),
      severity: allergy.severity || 'unknown',
      reaction: allergy.reaction || 'Unknown reaction',
      matchCount: matchingAllergies.length
    };
  }

  return { hasAllergy: false };
};

/**
 * Check if drug is contraindicated for patient conditions
 * @param {Object} drug - Drug object with contraindications
 * @param {Array} patientConditions - Array of patient's medical conditions
 * @returns {Object} Contraindication check result
 */
export const checkContraindications = (drug, patientConditions = []) => {
  if (!drug || !drug.contraindications) {
    return { hasContraindication: false };
  }

  const absolute = drug.contraindications.absolute || [];
  const relative = drug.contraindications.relative || [];

  // Convert patient conditions to lowercase for comparison
  const conditions = isArray(patientConditions)
    ? patientConditions.map(c => safeString(c, '').toLowerCase())
    : [];

  // Check absolute contraindications (most severe)
  const absoluteMatches = absolute.filter(contraindication =>
    conditions.some(condition =>
      condition.includes(contraindication.toLowerCase()) ||
      contraindication.toLowerCase().includes(condition)
    )
  );

  if (absoluteMatches.length > 0) {
    return {
      hasContraindication: true,
      type: 'absolute',
      contraindications: absoluteMatches,
      severity: 'critical',
      message: 'Contre-indication absolue détectée'
    };
  }

  // Check relative contraindications (warnings)
  const relativeMatches = relative.filter(contraindication =>
    conditions.some(condition =>
      condition.includes(contraindication.toLowerCase()) ||
      contraindication.toLowerCase().includes(condition)
    )
  );

  if (relativeMatches.length > 0) {
    return {
      hasContraindication: true,
      type: 'relative',
      contraindications: relativeMatches,
      severity: 'warning',
      message: 'Contre-indication relative détectée - utiliser avec précaution'
    };
  }

  return { hasContraindication: false };
};

/**
 * Check for drug-drug interactions
 * @param {Object} newDrug - New drug being added
 * @param {Array} currentMedications - Current patient medications
 * @returns {Object} Interaction check result
 */
export const checkDrugInteractions = (newDrug, currentMedications = []) => {
  if (!newDrug || !newDrug.interactions || !isArray(newDrug.interactions) || newDrug.interactions.length === 0) {
    return { hasInteraction: false, interactions: [] };
  }

  if (!isArray(currentMedications) || currentMedications.length === 0) {
    return { hasInteraction: false, interactions: [] };
  }

  // Find matching interactions
  const matchedInteractions = newDrug.interactions.filter(interaction => {
    const interactingDrug = safeString(interaction.drug, '').toLowerCase();

    return currentMedications.some(med => {
      const medGeneric = safeString(med.genericName || med.name, '').toLowerCase();
      const medBrand = safeString(med.brandName, '').toLowerCase();

      return medGeneric.includes(interactingDrug) ||
             interactingDrug.includes(medGeneric) ||
             (medBrand && (medBrand.includes(interactingDrug) || interactingDrug.includes(medBrand)));
    });
  });

  if (matchedInteractions.length === 0) {
    return { hasInteraction: false, interactions: [] };
  }

  // Categorize by severity
  const contraindicated = matchedInteractions.filter(i => i.severity === 'contraindicated');
  const major = matchedInteractions.filter(i => i.severity === 'major');
  const moderate = matchedInteractions.filter(i => i.severity === 'moderate');
  const minor = matchedInteractions.filter(i => i.severity === 'minor');

  return {
    hasInteraction: true,
    interactions: matchedInteractions,
    hasCritical: contraindicated.length > 0,
    hasMajor: major.length > 0,
    hasModerate: moderate.length > 0,
    hasMinor: minor.length > 0,
    contraindicated,
    major,
    moderate,
    minor,
    highestSeverity: contraindicated.length > 0 ? 'contraindicated' :
                     major.length > 0 ? 'major' :
                     moderate.length > 0 ? 'moderate' : 'minor'
  };
};

/**
 * Check if drug dosing is appropriate for patient age
 * @param {Object} drug - Drug object with dosing information
 * @param {Number} patientAge - Patient age in years
 * @returns {Object} Age appropriateness check result
 */
export const checkAgeAppropriateDosing = (drug, patientAge) => {
  if (!drug || patientAge === null || patientAge === undefined) {
    return { appropriate: true };
  }

  if (!drug.dosing) {
    return { appropriate: true, warning: 'No dosing information available' };
  }

  // Pediatric check (< 18 years)
  if (patientAge < 18) {
    const pediatric = drug.dosing.pediatric;

    if (!pediatric) {
      return {
        appropriate: false,
        severity: 'high',
        reason: 'Aucune posologie pédiatrique disponible',
        message: 'Ce médicament n\'a pas de recommandations de dosage pour les patients pédiatriques.',
        recommendation: 'Consulter un spécialiste pédiatrique avant de prescrire'
      };
    }

    // Check age-based dosing
    if (pediatric.ageBased && isArray(pediatric.ageBased)) {
      const appropriateRange = pediatric.ageBased.find(range =>
        isAgeInRange(patientAge, range.ageRange)
      );

      if (!appropriateRange) {
        const minAge = getMinAge(pediatric.ageBased);
        return {
          appropriate: false,
          severity: 'high',
          reason: `Âge minimum requis: ${minAge} ans`,
          message: `Ce médicament est recommandé pour les patients âgés d'au moins ${minAge} ans.`,
          recommendation: 'Considérer une alternative adaptée à l\'âge du patient',
          minAge
        };
      }

      // Found appropriate range, but add guidance
      return {
        appropriate: true,
        hasPediatricDose: true,
        dose: appropriateRange.dose,
        frequency: appropriateRange.frequency,
        ageRange: appropriateRange.ageRange,
        message: `Dosage pédiatrique disponible pour ${appropriateRange.ageRange}`
      };
    }

    // Weight-based dosing
    if (pediatric.weightBased) {
      return {
        appropriate: true,
        requiresWeight: true,
        dose: pediatric.weightBased.dose,
        maxDose: pediatric.weightBased.maxDose,
        message: 'Dosage basé sur le poids requis'
      };
    }
  }

  // Elderly check (>= 65 years)
  if (patientAge >= 65) {
    const elderlyAdjustment = drug.dosing.adult?.adjustments?.elderly;

    if (elderlyAdjustment) {
      return {
        appropriate: true,
        requiresAdjustment: true,
        severity: 'medium',
        adjustment: elderlyAdjustment,
        message: 'Ajustement de dose recommandé pour les patients âgés',
        recommendation: elderlyAdjustment
      };
    }
  }

  return { appropriate: true };
};

/**
 * Check pregnancy safety
 * @param {Object} drug - Drug object with pregnancy information
 * @param {Boolean} isPregnant - Is patient pregnant
 * @returns {Object} Pregnancy safety check result
 */
export const checkPregnancySafety = (drug, isPregnant) => {
  if (!isPregnant || !drug || !drug.pregnancy) {
    return { safe: true };
  }

  const category = drug.pregnancy.category;

  // FDA Pregnancy Categories
  const safetyLevels = {
    'A': { safe: true, severity: 'low', message: 'Sûr pendant la grossesse' },
    'B': { safe: true, severity: 'low', message: 'Probablement sûr - aucun risque démontré' },
    'C': { safe: false, severity: 'medium', message: 'Utiliser avec prudence - risque non exclu' },
    'D': { safe: false, severity: 'high', message: 'Éviter si possible - risque démontré' },
    'X': { safe: false, severity: 'critical', message: 'CONTRE-INDIQUÉ pendant la grossesse' },
    'N': { safe: true, severity: 'low', message: 'Information insuffisante' }
  };

  const level = safetyLevels[category] || safetyLevels['N'];

  return {
    ...level,
    category,
    description: drug.pregnancy.description,
    recommendation: drug.pregnancy.recommendation
  };
};

/**
 * Check lactation safety
 * @param {Object} drug - Drug object with lactation information
 * @param {Boolean} isLactating - Is patient breastfeeding
 * @returns {Object} Lactation safety check result
 */
export const checkLactationSafety = (drug, isLactating) => {
  if (!isLactating || !drug || !drug.lactation) {
    return { safe: true };
  }

  return {
    safe: drug.lactation.compatible !== false,
    compatible: drug.lactation.compatible,
    riskCategory: drug.lactation.riskCategory,
    recommendation: drug.lactation.recommendation,
    severity: drug.lactation.compatible ? 'low' : 'high',
    message: drug.lactation.compatible
      ? 'Compatible avec l\'allaitement'
      : 'Prudence pendant l\'allaitement'
  };
};

/**
 * Comprehensive safety check - runs all checks
 * @param {Object} drug - Drug to check
 * @param {Object} patient - Patient information
 * @param {Array} currentMedications - Current medications
 * @returns {Object} Comprehensive safety results
 */
export const runComprehensiveSafetyCheck = (drug, patient, currentMedications = []) => {
  const patientAge = patient.dateOfBirth
    ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()
    : null;

  const checks = {
    allergies: checkAllergies(patient, drug),
    contraindications: checkContraindications(drug, patient.conditions || []),
    interactions: checkDrugInteractions(drug, currentMedications),
    ageDosing: patientAge ? checkAgeAppropriateDosing(drug, patientAge) : { appropriate: true },
    pregnancy: patient.isPregnant ? checkPregnancySafety(drug, true) : { safe: true },
    lactation: patient.isLactating ? checkLactationSafety(drug, true) : { safe: true }
  };

  // Determine overall safety level
  const hasCriticalIssue =
    checks.allergies.hasAllergy ||
    checks.contraindications.type === 'absolute' ||
    checks.interactions.hasCritical ||
    checks.pregnancy.severity === 'critical';

  const hasMajorIssue =
    checks.contraindications.type === 'relative' ||
    checks.interactions.hasMajor ||
    !checks.ageDosing.appropriate ||
    checks.pregnancy.severity === 'high';

  const hasWarning =
    checks.interactions.hasModerate ||
    checks.ageDosing.requiresAdjustment ||
    checks.pregnancy.severity === 'medium';

  return {
    ...checks,
    overallSafety: hasCriticalIssue ? 'critical' :
                   hasMajorIssue ? 'major' :
                   hasWarning ? 'warning' : 'safe',
    hasCriticalIssue,
    hasMajorIssue,
    hasWarning,
    isSafe: !hasCriticalIssue && !hasMajorIssue,
    requiresReview: hasCriticalIssue || hasMajorIssue
  };
};

// Helper functions
const isAgeInRange = (age, rangeString) => {
  if (!rangeString) return false;

  // Handle various formats: "2-12 years", "< 2 years", "> 65 years", "6 months - 2 years"
  const match = rangeString.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    const [, min, max] = match;
    return age >= parseInt(min) && age <= parseInt(max);
  }

  // Handle "< X years"
  const lessThan = rangeString.match(/[<]\s*(\d+)/);
  if (lessThan) {
    return age < parseInt(lessThan[1]);
  }

  // Handle "> X years"
  const greaterThan = rangeString.match(/[>]\s*(\d+)/);
  if (greaterThan) {
    return age > parseInt(greaterThan[1]);
  }

  return true;
};

const getMinAge = (ageBased) => {
  if (!isArray(ageBased)) return 0;

  const ages = ageBased.map(range => {
    const match = range.ageRange?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }).filter(age => age > 0);

  return ages.length > 0 ? Math.min(...ages) : 0;
};

export default {
  checkAllergies,
  checkContraindications,
  checkDrugInteractions,
  checkAgeAppropriateDosing,
  checkPregnancySafety,
  checkLactationSafety,
  runComprehensiveSafetyCheck
};
