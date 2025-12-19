/**
 * Dose Calculation Service
 * Provides comprehensive dose calculation and validation for MedFlow
 *
 * Features:
 * - Pediatric weight-based dosing (mg/kg)
 * - Maximum daily dose validation
 * - Renal dose adjustment (eGFR-based)
 * - Hepatic dose adjustment (Child-Pugh)
 * - eGFR calculation (CKD-EPI 2021 formula)
 * - Lab integration for renal function
 */

const Drug = require('../models/Drug');
const Patient = require('../models/Patient');
const LabResult = require('../models/LabResult');

/**
 * Frequency multipliers for calculating total daily dose
 */
const FREQUENCY_MULTIPLIERS = {
  'once daily': 1,
  'qd': 1,
  'od': 1,
  'daily': 1,
  'twice daily': 2,
  'bid': 2,
  'bd': 2,
  'three times daily': 3,
  'tid': 3,
  'tds': 3,
  'four times daily': 4,
  'qid': 4,
  'qds': 4,
  'every 4 hours': 6,
  'q4h': 6,
  'every 6 hours': 4,
  'q6h': 4,
  'every 8 hours': 3,
  'q8h': 3,
  'every 12 hours': 2,
  'q12h': 2,
  'every 24 hours': 1,
  'q24h': 1,
  'weekly': 1 / 7,
  'qw': 1 / 7,
  'every other day': 0.5,
  'qod': 0.5,
  'prn': 4, // Assume max 4x/day for PRN
  'as needed': 4
};

/**
 * Nephrotoxic drugs that require renal function monitoring
 */
const NEPHROTOXIC_DRUGS = [
  'gentamicin', 'tobramycin', 'amikacin', 'vancomycin',
  'acyclovir', 'cidofovir', 'foscarnet', 'tenofovir',
  'methotrexate', 'cisplatin', 'ifosfamide',
  'amphotericin b', 'cyclosporine', 'tacrolimus',
  'nsaids', 'ibuprofen', 'naproxen', 'diclofenac',
  'lithium', 'metformin'
];

/**
 * Calculate recommended pediatric dose based on weight and age
 * @param {Object|String} drugOrId - Drug document or drug ID
 * @param {Number} patientWeight - Patient weight in kg
 * @param {Number} patientAge - Patient age in years
 * @returns {Object} Recommended dose information
 */
async function calculatePediatricDose(drugOrId, patientWeight, patientAge) {
  // Get drug if ID provided
  let drug = drugOrId;
  if (typeof drugOrId === 'string') {
    drug = await Drug.findById(drugOrId);
    if (!drug) {
      return {
        success: false,
        error: 'Drug not found',
        recommendedDose: null
      };
    }
  }

  const result = {
    success: true,
    drugName: drug.genericName || drug.brandName,
    patientWeight,
    patientAge,
    recommendedDose: null,
    unit: 'mg',
    frequency: null,
    maxDose: null,
    warnings: [],
    calculationMethod: null
  };

  // Check if pediatric dosing is available
  const pediatricDosing = drug.dosing?.pediatric;
  const adultDosing = drug.dosing?.adult;

  if (patientAge < 18 && pediatricDosing) {
    // Try weight-based dosing first
    if (pediatricDosing.weightBased && patientWeight) {
      const weightBasedDose = parseDosingString(pediatricDosing.weightBased.dose);

      if (weightBasedDose) {
        // Calculate dose based on weight
        let calculatedDose = weightBasedDose.value * patientWeight;

        // If range provided, use middle value
        if (weightBasedDose.minValue && weightBasedDose.maxValue) {
          calculatedDose = ((weightBasedDose.minValue + weightBasedDose.maxValue) / 2) * patientWeight;
        }

        result.recommendedDose = Math.round(calculatedDose * 10) / 10;
        result.unit = weightBasedDose.unit || 'mg';
        result.frequency = pediatricDosing.weightBased.frequency || 'as directed';
        result.calculationMethod = 'weight-based';
        result.calculationDetails = {
          dosePerKg: weightBasedDose.value,
          formula: `${weightBasedDose.value} ${result.unit}/kg × ${patientWeight} kg`
        };

        // Check against maximum pediatric dose
        if (pediatricDosing.weightBased.maxDose) {
          const maxDose = parseDosingString(pediatricDosing.weightBased.maxDose);
          if (maxDose && result.recommendedDose > maxDose.value) {
            result.warnings.push({
              type: 'max_dose_cap',
              message: `Calculated dose (${result.recommendedDose} ${result.unit}) exceeds maximum pediatric dose. Capped at ${maxDose.value} ${maxDose.unit}.`,
              severity: 'warning'
            });
            result.recommendedDose = maxDose.value;
          }
          result.maxDose = maxDose?.value;
        }
      }
    }

    // Try age-based dosing if weight-based not available or no weight
    if (!result.recommendedDose && pediatricDosing.ageBased && pediatricDosing.ageBased.length > 0) {
      const ageRange = pediatricDosing.ageBased.find(range => {
        const minAge = range.minAge || 0;
        const maxAge = range.maxAge || 18;
        return patientAge >= minAge && patientAge <= maxAge;
      });

      if (ageRange) {
        const ageDose = parseDosingString(ageRange.dose);
        if (ageDose) {
          result.recommendedDose = ageDose.value;
          result.unit = ageDose.unit || 'mg';
          result.frequency = ageRange.frequency || 'as directed';
          result.calculationMethod = 'age-based';
          result.calculationDetails = {
            ageRange: `${ageRange.minAge || 0}-${ageRange.maxAge || 18} years`
          };
        }
      }
    }

    // Add pediatric warnings
    if (patientAge < 2) {
      result.warnings.push({
        type: 'neonatal_infant',
        message: 'Patient is under 2 years. Extra caution required. Consider consulting pediatric specialist.',
        severity: 'warning'
      });
    }

    if (!result.recommendedDose) {
      result.warnings.push({
        type: 'no_pediatric_dosing',
        message: 'No specific pediatric dosing available. Consider consulting pediatric specialist or using adult dosing with caution.',
        severity: 'warning'
      });
    }
  } else if (patientAge >= 18 && adultDosing) {
    // Adult dosing
    if (adultDosing.standard) {
      const standardDose = parseDosingString(adultDosing.standard.dose);
      if (standardDose) {
        result.recommendedDose = standardDose.value;
        result.unit = standardDose.unit || 'mg';
        result.frequency = adultDosing.standard.frequency || 'as directed';
        result.calculationMethod = 'adult-standard';
      }

      if (adultDosing.standard.maxDaily) {
        const maxDaily = parseDosingString(adultDosing.standard.maxDaily);
        result.maxDose = maxDaily?.value;
      }
    }

    // Elderly adjustment
    if (patientAge >= 65) {
      result.warnings.push({
        type: 'elderly',
        message: 'Patient is 65 or older. Consider starting at lower dose and titrating slowly.',
        severity: 'info'
      });
    }
  }

  return result;
}

/**
 * Validate a prescribed dose against maximum limits
 * @param {Object|String} drugOrId - Drug document or drug ID
 * @param {Number} prescribedDose - Prescribed dose amount
 * @param {Number} patientWeight - Patient weight in kg
 * @param {Number} patientAge - Patient age in years
 * @param {String} frequency - Dosing frequency
 * @param {Number} duration - Duration in days (optional)
 * @returns {Object} Validation result
 */
async function validatePrescribedDose(drugOrId, prescribedDose, patientWeight, patientAge, frequency, duration) {
  // Get drug if ID provided
  let drug = drugOrId;
  if (typeof drugOrId === 'string') {
    drug = await Drug.findById(drugOrId);
    if (!drug) {
      return {
        isValid: true, // Don't block if drug not found
        warnings: [{ type: 'drug_not_found', message: 'Drug not found in database. Cannot validate dose.' }],
        errors: []
      };
    }
  }

  const result = {
    isValid: true,
    warnings: [],
    errors: [],
    prescribedDose,
    frequency,
    calculatedDailyDose: null,
    maxDailyDose: null,
    percentOfMax: null
  };

  // Calculate total daily dose
  const frequencyMultiplier = getFrequencyMultiplier(frequency);
  result.calculatedDailyDose = prescribedDose * frequencyMultiplier;
  result.frequencyMultiplier = frequencyMultiplier;

  // Get max daily dose
  const isChild = patientAge < 18;
  let maxDailyDose = null;

  if (isChild && drug.dosing?.pediatric?.weightBased?.maxDose) {
    maxDailyDose = parseDosingString(drug.dosing.pediatric.weightBased.maxDose);
  } else if (drug.dosing?.adult?.standard?.maxDaily) {
    maxDailyDose = parseDosingString(drug.dosing.adult.standard.maxDaily);
  }

  if (maxDailyDose) {
    result.maxDailyDose = maxDailyDose.value;
    result.percentOfMax = (result.calculatedDailyDose / maxDailyDose.value) * 100;

    // Three-tier warning system
    if (result.percentOfMax > 120) {
      // BLOCK: Over 120% of max
      result.isValid = false;
      result.errors.push({
        type: 'dose_exceeds_maximum',
        message: `Prescribed daily dose (${result.calculatedDailyDose} mg) is ${Math.round(result.percentOfMax)}% of maximum safe dose (${maxDailyDose.value} ${maxDailyDose.unit}). This dose is BLOCKED.`,
        severity: 'critical'
      });
    } else if (result.percentOfMax > 100) {
      // WARN: Over 100% but under 120%
      result.warnings.push({
        type: 'dose_above_maximum',
        message: `Prescribed daily dose (${result.calculatedDailyDose} mg) exceeds recommended maximum (${maxDailyDose.value} ${maxDailyDose.unit}). Please confirm this is intentional.`,
        severity: 'high'
      });
    } else if (result.percentOfMax > 80) {
      // INFORM: Over 80%
      result.warnings.push({
        type: 'dose_near_maximum',
        message: `Prescribed daily dose is ${Math.round(result.percentOfMax)}% of maximum recommended dose.`,
        severity: 'medium'
      });
    }
  }

  // Weight-based validation for children
  if (isChild && patientWeight && drug.dosing?.pediatric?.weightBased?.dose) {
    const weightBasedDose = parseDosingString(drug.dosing.pediatric.weightBased.dose);
    if (weightBasedDose) {
      const recommendedPerDose = weightBasedDose.value * patientWeight;
      const percentOfRecommended = (prescribedDose / recommendedPerDose) * 100;

      if (percentOfRecommended > 150) {
        result.warnings.push({
          type: 'pediatric_dose_high',
          message: `Prescribed dose is ${Math.round(percentOfRecommended)}% of weight-based recommendation (${Math.round(recommendedPerDose)} mg for ${patientWeight} kg patient).`,
          severity: 'high'
        });
      }
    }
  }

  // Duration warnings
  if (duration) {
    // Check for long-term use of potentially harmful drugs
    if (duration > 14 && isNSAID(drug.genericName)) {
      result.warnings.push({
        type: 'long_term_nsaid',
        message: `Extended NSAID use (>${duration} days) increases risk of GI bleeding and cardiovascular events.`,
        severity: 'medium'
      });
    }

    if (duration > 7 && isOpioid(drug.genericName)) {
      result.warnings.push({
        type: 'long_term_opioid',
        message: `Opioid prescription for >${duration} days. Consider pain management alternatives and dependency risk.`,
        severity: 'high'
      });
    }
  }

  return result;
}

/**
 * Calculate renal dose adjustment based on eGFR
 * @param {Object|String} drugOrId - Drug document or drug ID
 * @param {Number} eGFR - Estimated glomerular filtration rate
 * @returns {Object} Adjustment recommendation
 */
async function calculateRenalAdjustment(drugOrId, eGFR) {
  let drug = drugOrId;
  if (typeof drugOrId === 'string') {
    drug = await Drug.findById(drugOrId);
    if (!drug) {
      return { success: false, error: 'Drug not found' };
    }
  }

  const result = {
    success: true,
    drugName: drug.genericName || drug.brandName,
    eGFR,
    renalStage: getGFRStage(eGFR),
    requiresAdjustment: false,
    adjustedDose: null,
    adjustmentPercentage: null,
    warning: null,
    recommendation: null
  };

  const renalImpairment = drug.dosing?.renalImpairment;

  if (!renalImpairment || renalImpairment.length === 0) {
    result.recommendation = 'No specific renal dosing guidelines available for this medication.';
    return result;
  }

  // Find applicable adjustment based on eGFR
  for (const adjustment of renalImpairment) {
    const range = parseGFRRange(adjustment.creatinineClearance);
    if (range && eGFR >= range.min && eGFR <= range.max) {
      result.requiresAdjustment = true;
      result.recommendation = adjustment.adjustment;

      // Parse adjustment percentage if available
      const percentMatch = adjustment.adjustment.match(/(\d+)%\s*(reduction|of\s*normal)/i);
      if (percentMatch) {
        if (percentMatch[2].toLowerCase().includes('reduction')) {
          result.adjustmentPercentage = 100 - parseInt(percentMatch[1]);
        } else {
          result.adjustmentPercentage = parseInt(percentMatch[1]);
        }
      }

      result.warning = {
        type: 'renal_adjustment_required',
        message: `Patient has ${result.renalStage} (eGFR ${eGFR}). ${adjustment.adjustment}`,
        severity: eGFR < 30 ? 'high' : 'medium'
      };

      break;
    }
  }

  // Check if drug is contraindicated
  if (eGFR < 30 && isContraindicatedInSevereRenal(drug.genericName)) {
    result.warning = {
      type: 'renal_contraindication',
      message: 'This medication may be contraindicated in severe renal impairment (eGFR <30). Consider alternative therapy.',
      severity: 'critical'
    };
  }

  return result;
}

/**
 * Calculate hepatic dose adjustment based on Child-Pugh score
 * @param {Object|String} drugOrId - Drug document or drug ID
 * @param {String|Number} childPughScore - Child-Pugh class (A/B/C) or score (5-15)
 * @returns {Object} Adjustment recommendation
 */
async function calculateHepaticAdjustment(drugOrId, childPughScore) {
  let drug = drugOrId;
  if (typeof drugOrId === 'string') {
    drug = await Drug.findById(drugOrId);
    if (!drug) {
      return { success: false, error: 'Drug not found' };
    }
  }

  // Convert numeric score to class
  let childPughClass;
  if (typeof childPughScore === 'number') {
    if (childPughScore <= 6) childPughClass = 'A';
    else if (childPughScore <= 9) childPughClass = 'B';
    else childPughClass = 'C';
  } else {
    childPughClass = childPughScore.toUpperCase();
  }

  const result = {
    success: true,
    drugName: drug.genericName || drug.brandName,
    childPughClass,
    hepaticSeverity: childPughClass === 'A' ? 'Mild' : childPughClass === 'B' ? 'Moderate' : 'Severe',
    requiresAdjustment: false,
    adjustedDose: null,
    adjustmentPercentage: null,
    warning: null,
    recommendation: null
  };

  const hepaticImpairment = drug.dosing?.hepaticImpairment;

  if (!hepaticImpairment || hepaticImpairment.length === 0) {
    result.recommendation = 'No specific hepatic dosing guidelines available for this medication.';
    return result;
  }

  // Find applicable adjustment
  for (const adjustment of hepaticImpairment) {
    if (adjustment.severity?.toLowerCase().includes(result.hepaticSeverity.toLowerCase()) ||
        adjustment.severity?.includes(childPughClass)) {
      result.requiresAdjustment = true;
      result.recommendation = adjustment.adjustment;

      // Parse adjustment percentage
      const percentMatch = adjustment.adjustment.match(/(\d+)%\s*(reduction|of\s*normal)/i);
      if (percentMatch) {
        if (percentMatch[2].toLowerCase().includes('reduction')) {
          result.adjustmentPercentage = 100 - parseInt(percentMatch[1]);
        } else {
          result.adjustmentPercentage = parseInt(percentMatch[1]);
        }
      }

      result.warning = {
        type: 'hepatic_adjustment_required',
        message: `Patient has ${result.hepaticSeverity} hepatic impairment (Child-Pugh ${childPughClass}). ${adjustment.adjustment}`,
        severity: childPughClass === 'C' ? 'high' : 'medium'
      };

      break;
    }
  }

  return result;
}

/**
 * Calculate eGFR using CKD-EPI 2021 formula (race-free)
 * @param {Number} creatinine - Serum creatinine in mg/dL
 * @param {Number} age - Patient age in years
 * @param {Number} weight - Patient weight in kg (optional, for Cockcroft-Gault)
 * @param {String} gender - 'male' or 'female'
 * @param {String} race - Race (not used in 2021 formula, kept for compatibility)
 * @returns {Object} eGFR result with staging
 */
function calculateEGFR(creatinine, age, weight, gender, race = null) {
  if (!creatinine || !age || !gender) {
    return {
      success: false,
      error: 'Creatinine, age, and gender are required'
    };
  }

  const isFemale = gender.toLowerCase() === 'female' || gender.toLowerCase() === 'f';

  // CKD-EPI 2021 equation (race-free)
  let eGFR;
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const multiplier = isFemale ? 1.012 : 1.0;

  const scrOverKappa = creatinine / kappa;

  eGFR = 142 *
    Math.pow(Math.min(scrOverKappa, 1), alpha) *
    Math.pow(Math.max(scrOverKappa, 1), -1.200) *
    Math.pow(0.9938, age) *
    multiplier;

  eGFR = Math.round(eGFR);

  // Also calculate Cockcroft-Gault if weight available
  let creatinineClearance = null;
  if (weight) {
    creatinineClearance = ((140 - age) * weight) / (72 * creatinine);
    if (isFemale) creatinineClearance *= 0.85;
    creatinineClearance = Math.round(creatinineClearance);
  }

  return {
    success: true,
    eGFR,
    creatinineClearance,
    unit: 'mL/min/1.73m²',
    stage: getGFRStage(eGFR),
    interpretation: getGFRInterpretation(eGFR),
    formula: 'CKD-EPI 2021 (race-free)',
    inputs: { creatinine, age, gender }
  };
}

/**
 * Get patient's current renal function from lab results
 * @param {String} patientId - Patient ID
 * @returns {Object} Renal function data
 */
async function getPatientRenalFunction(patientId) {
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return {
      success: false,
      error: 'Patient not found',
      hasLabData: false
    };
  }

  // Calculate patient age
  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  // Find latest creatinine result
  const latestCreatinine = await LabResult.findOne({
    patient: patientId,
    'results.testName': { $regex: /creatinine/i },
    status: 'final'
  })
    .sort({ resultDate: -1 })
    .limit(1);

  if (!latestCreatinine) {
    return {
      success: true,
      hasLabData: false,
      message: 'No creatinine lab results found for patient',
      patientAge: age,
      patientGender: patient.gender,
      patientWeight: patient.weight
    };
  }

  // Extract creatinine value
  const creatinineResult = latestCreatinine.results.find(r =>
    r.testName.toLowerCase().includes('creatinine')
  );

  if (!creatinineResult || !creatinineResult.value) {
    return {
      success: true,
      hasLabData: false,
      message: 'Creatinine value not found in lab results'
    };
  }

  const creatinineValue = parseFloat(creatinineResult.value);

  // Calculate eGFR
  const eGFRResult = calculateEGFR(
    creatinineValue,
    age,
    patient.weight,
    patient.gender
  );

  return {
    success: true,
    hasLabData: true,
    creatinine: {
      value: creatinineValue,
      unit: creatinineResult.unit || 'mg/dL',
      date: latestCreatinine.resultDate
    },
    eGFR: eGFRResult.eGFR,
    renalStage: eGFRResult.stage,
    interpretation: eGFRResult.interpretation,
    creatinineClearance: eGFRResult.creatinineClearance,
    patientAge: age,
    patientGender: patient.gender,
    patientWeight: patient.weight
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse dosing string to extract numeric value and unit
 */
function parseDosingString(dosingString) {
  if (!dosingString) return null;

  // Handle range format: "10-15 mg/kg"
  const rangeMatch = dosingString.match(/([\d.]+)\s*-\s*([\d.]+)\s*(mg|mcg|g|ml|units?)(?:\/kg)?/i);
  if (rangeMatch) {
    return {
      minValue: parseFloat(rangeMatch[1]),
      maxValue: parseFloat(rangeMatch[2]),
      value: (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2,
      unit: rangeMatch[3].toLowerCase()
    };
  }

  // Handle single value: "500 mg"
  const singleMatch = dosingString.match(/([\d.]+)\s*(mg|mcg|g|ml|units?)(?:\/kg)?/i);
  if (singleMatch) {
    return {
      value: parseFloat(singleMatch[1]),
      unit: singleMatch[2].toLowerCase()
    };
  }

  return null;
}

/**
 * Get frequency multiplier for daily dose calculation
 */
function getFrequencyMultiplier(frequency) {
  if (!frequency) return 1;

  const normalizedFreq = frequency.toLowerCase().trim();

  // Check exact match first
  if (FREQUENCY_MULTIPLIERS[normalizedFreq]) {
    return FREQUENCY_MULTIPLIERS[normalizedFreq];
  }

  // Check partial matches
  for (const [key, value] of Object.entries(FREQUENCY_MULTIPLIERS)) {
    if (normalizedFreq.includes(key) || key.includes(normalizedFreq)) {
      return value;
    }
  }

  // Try to parse "every X hours" format
  const everyMatch = normalizedFreq.match(/every\s*(\d+)\s*hours?/i);
  if (everyMatch) {
    return 24 / parseInt(everyMatch[1]);
  }

  // Try to parse "X times daily" format
  const timesMatch = normalizedFreq.match(/(\d+)\s*times?\s*(daily|a day|per day)/i);
  if (timesMatch) {
    return parseInt(timesMatch[1]);
  }

  return 1; // Default to once daily
}

/**
 * Get GFR stage description
 */
function getGFRStage(eGFR) {
  if (eGFR >= 90) return 'G1 - Normal';
  if (eGFR >= 60) return 'G2 - Mildly decreased';
  if (eGFR >= 45) return 'G3a - Mild to moderate';
  if (eGFR >= 30) return 'G3b - Moderate to severe';
  if (eGFR >= 15) return 'G4 - Severely decreased';
  return 'G5 - Kidney failure';
}

/**
 * Get GFR interpretation
 */
function getGFRInterpretation(eGFR) {
  if (eGFR >= 90) return 'Normal kidney function';
  if (eGFR >= 60) return 'Mild reduction in kidney function';
  if (eGFR >= 45) return 'Mild to moderate reduction. Monitor medications.';
  if (eGFR >= 30) return 'Moderate to severe reduction. Dose adjustments likely needed.';
  if (eGFR >= 15) return 'Severe reduction. Many medications need dose adjustment or avoidance.';
  return 'Kidney failure. Consider nephrology referral.';
}

/**
 * Parse GFR range string
 */
function parseGFRRange(rangeString) {
  if (!rangeString) return null;

  // Handle "eGFR < 30" or "< 30"
  const lessThanMatch = rangeString.match(/<\s*(\d+)/);
  if (lessThanMatch) {
    return { min: 0, max: parseInt(lessThanMatch[1]) - 1 };
  }

  // Handle "eGFR > 60" or "> 60"
  const greaterThanMatch = rangeString.match(/>\s*(\d+)/);
  if (greaterThanMatch) {
    return { min: parseInt(greaterThanMatch[1]) + 1, max: 200 };
  }

  // Handle range "30-60"
  const rangeMatch = rangeString.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
  }

  return null;
}

/**
 * Check if drug is an NSAID
 */
function isNSAID(drugName) {
  const nsaids = ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'meloxicam',
    'indomethacin', 'ketorolac', 'piroxicam', 'aspirin'];
  return nsaids.some(nsaid => drugName?.toLowerCase().includes(nsaid));
}

/**
 * Check if drug is an opioid
 */
function isOpioid(drugName) {
  const opioids = ['morphine', 'oxycodone', 'hydrocodone', 'fentanyl', 'tramadol',
    'codeine', 'hydromorphone', 'methadone', 'buprenorphine'];
  return opioids.some(opioid => drugName?.toLowerCase().includes(opioid));
}

/**
 * Check if drug is contraindicated in severe renal impairment
 */
function isContraindicatedInSevereRenal(drugName) {
  const contraindicated = ['metformin', 'lithium', 'spironolactone', 'amiloride',
    'nitrofurantoin', 'certain nsaids'];
  return contraindicated.some(drug => drugName?.toLowerCase().includes(drug));
}

module.exports = {
  calculatePediatricDose,
  validatePrescribedDose,
  calculateRenalAdjustment,
  calculateHepaticAdjustment,
  calculateEGFR,
  getPatientRenalFunction,
  // Export helpers for testing
  parseDosingString,
  getFrequencyMultiplier,
  getGFRStage
};
