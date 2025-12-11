/**
 * Cumulative Dose Tracking Service
 * Tracks lifetime and course doses for medications with cumulative toxicity
 */

const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');

/**
 * Drugs with cumulative toxicity limits
 */
const CUMULATIVE_LIMITS = {
  // Retinal toxicity
  'chloroquine': {
    maxLifetime: 460000, // mg total
    unit: 'mg',
    toxicityType: 'retinal',
    monitoring: 'Annual eye exam after 5 years or 200g total',
    alternatives: ['hydroxychloroquine (lower retinal risk)']
  },
  'hydroxychloroquine': {
    maxLifetime: 365000, // mg total (based on 5mg/kg/day for 10 years)
    unit: 'mg',
    toxicityType: 'retinal',
    monitoring: 'Annual OCT and visual field after 5 years',
    alternatives: []
  },

  // Cardiotoxicity
  'doxorubicin': {
    maxLifetime: 550, // mg/m² BSA
    unit: 'mg/m2',
    toxicityType: 'cardiac',
    monitoring: 'Echo/MUGA every 50mg/m²',
    alternatives: ['liposomal doxorubicin', 'epirubicin']
  },
  'epirubicin': {
    maxLifetime: 900, // mg/m²
    unit: 'mg/m2',
    toxicityType: 'cardiac',
    monitoring: 'Echo/MUGA periodically',
    alternatives: []
  },
  'daunorubicin': {
    maxLifetime: 550, // mg/m²
    unit: 'mg/m2',
    toxicityType: 'cardiac',
    monitoring: 'Echo/MUGA every 100mg/m²',
    alternatives: []
  },

  // Hepatotoxicity
  'methotrexate': {
    maxLifetime: 1500, // mg total for non-oncologic use
    unit: 'mg',
    toxicityType: 'hepatic',
    monitoring: 'LFTs every 4-8 weeks, liver biopsy after 1.5g',
    alternatives: ['leflunomide', 'sulfasalazine']
  },

  // Nephrotoxicity/Ototoxicity
  'gentamicin': {
    maxCourse: 10, // days per treatment course
    unit: 'days',
    toxicityType: 'nephro/oto',
    monitoring: 'Serum levels, creatinine daily',
    alternatives: ['once-daily dosing regimen']
  },
  'tobramycin': {
    maxCourse: 10,
    unit: 'days',
    toxicityType: 'nephro/oto',
    monitoring: 'Serum levels, creatinine daily',
    alternatives: ['once-daily dosing regimen']
  },
  'amikacin': {
    maxCourse: 10,
    unit: 'days',
    toxicityType: 'nephro/oto',
    monitoring: 'Serum levels, creatinine daily',
    alternatives: ['once-daily dosing regimen']
  },

  // Pulmonary toxicity
  'bleomycin': {
    maxLifetime: 400, // units total
    unit: 'units',
    toxicityType: 'pulmonary',
    monitoring: 'PFTs before and during treatment',
    alternatives: []
  },
  'amiodarone': {
    maxLifetime: null, // No hard limit but cumulative pulmonary risk
    unit: 'mg',
    toxicityType: 'pulmonary/thyroid/hepatic',
    monitoring: 'PFTs, TFTs, LFTs every 6 months',
    warningThreshold: 200000, // mg (approx 1 year at 600mg/day maintenance)
    alternatives: ['dronedarone', 'sotalol']
  },

  // Optic neuropathy
  'ethambutol': {
    maxDuration: 60, // days at high dose (>15mg/kg)
    unit: 'days',
    toxicityType: 'optic',
    monitoring: 'Visual acuity and color vision monthly',
    alternatives: []
  },

  // Renal toxicity (cumulative risk)
  'nsaids_chronic': {
    maxDuration: 90, // days continuous use
    unit: 'days',
    toxicityType: 'renal',
    monitoring: 'Creatinine every 3-6 months',
    alternatives: ['acetaminophen', 'topical NSAIDs']
  },
  'ibuprofen': {
    maxDuration: 90,
    unit: 'days',
    toxicityType: 'renal/GI',
    monitoring: 'Renal function if prolonged use',
    alternatives: ['acetaminophen']
  },
  'naproxen': {
    maxDuration: 90,
    unit: 'days',
    toxicityType: 'renal/GI',
    monitoring: 'Renal function if prolonged use',
    alternatives: ['acetaminophen']
  },

  // Cisplatin - nephrotoxicity/ototoxicity
  'cisplatin': {
    maxLifetime: null, // Cumulative but no hard limit
    unit: 'mg/m2',
    toxicityType: 'nephro/oto',
    monitoring: 'Audiometry, creatinine before each cycle',
    warningThreshold: 400, // mg/m² - significant ototoxicity risk
    alternatives: ['carboplatin']
  }
};

/**
 * Get the cumulative limit configuration for a drug
 * @param {String} drugName - Drug name
 * @returns {Object|null} Limit configuration or null
 */
function getDrugCumulativeLimit(drugName) {
  if (!drugName) return null;

  const normalizedName = drugName.toLowerCase().trim();

  // Direct match
  if (CUMULATIVE_LIMITS[normalizedName]) {
    return { drugName: normalizedName, ...CUMULATIVE_LIMITS[normalizedName] };
  }

  // Partial match
  for (const [drug, config] of Object.entries(CUMULATIVE_LIMITS)) {
    if (normalizedName.includes(drug) || drug.includes(normalizedName)) {
      return { drugName: drug, ...config };
    }
  }

  return null;
}

/**
 * Get patient's cumulative dose for a medication
 * @param {String} patientId - Patient ID
 * @param {String} drugName - Drug name
 * @returns {Object} Cumulative dose data
 */
async function getPatientCumulativeDose(patientId, drugName) {
  try {
    const normalizedName = drugName.toLowerCase().trim();

    // Find all prescriptions for this patient with this drug
    const prescriptions = await Prescription.find({
      patient: patientId,
      status: { $in: ['active', 'completed', 'dispensed'] },
      $or: [
        { 'medications.name': { $regex: normalizedName, $options: 'i' } },
        { 'medications.genericName': { $regex: normalizedName, $options: 'i' } }
      ]
    }).sort({ createdAt: 1 }).lean();

    if (prescriptions.length === 0) {
      return {
        totalDose: 0,
        unit: 'mg',
        prescriptionCount: 0,
        startDate: null,
        lastDate: null,
        history: []
      };
    }

    let totalDose = 0;
    let totalDays = 0;
    const history = [];

    for (const prescription of prescriptions) {
      for (const med of prescription.medications) {
        const medName = (med.genericName || med.name || '').toLowerCase();
        if (medName.includes(normalizedName) || normalizedName.includes(medName)) {
          // Calculate dose from this prescription
          let doseAmount = 0;

          if (med.quantity && med.strength) {
            // Parse strength (e.g., "500mg", "250 mg")
            const strengthMatch = med.strength.match(/([\d.]+)\s*(mg|mcg|g|units?)/i);
            if (strengthMatch) {
              const strengthValue = parseFloat(strengthMatch[1]);
              const strengthUnit = strengthMatch[2].toLowerCase();

              // Convert to mg if needed
              let strengthInMg = strengthValue;
              if (strengthUnit === 'mcg') strengthInMg = strengthValue / 1000;
              else if (strengthUnit === 'g') strengthInMg = strengthValue * 1000;

              doseAmount = med.quantity * strengthInMg;
            }
          }

          // Track duration for course-limited drugs
          const duration = med.duration || prescription.duration || 0;
          totalDays += duration;

          totalDose += doseAmount;
          history.push({
            prescriptionId: prescription._id,
            date: prescription.createdAt,
            dose: doseAmount,
            duration: duration,
            prescriber: prescription.prescribedBy
          });
        }
      }
    }

    return {
      totalDose: Math.round(totalDose * 100) / 100,
      totalDays,
      unit: 'mg',
      prescriptionCount: prescriptions.length,
      startDate: prescriptions[0]?.createdAt,
      lastDate: prescriptions[prescriptions.length - 1]?.createdAt,
      history
    };
  } catch (error) {
    console.error('Error getting cumulative dose:', error);
    throw new Error(`Failed to get cumulative dose: ${error.message}`);
  }
}

/**
 * Check if proposed dose would exceed cumulative limit
 * @param {String} patientId - Patient ID
 * @param {String} drugName - Drug name
 * @param {Number} proposedDose - Proposed dose amount
 * @param {Object} patient - Patient object (optional, for BSA calculation)
 * @returns {Object} Limit check result
 */
async function checkCumulativeLimit(patientId, drugName, proposedDose, patient = null) {
  try {
    const drugLimit = getDrugCumulativeLimit(drugName);

    if (!drugLimit) {
      return {
        hasLimit: false,
        withinLimit: true,
        warning: null
      };
    }

    const currentDose = await getPatientCumulativeDose(patientId, drugName);

    // Handle different limit types
    let limit = drugLimit.maxLifetime || drugLimit.warningThreshold;
    let proposedTotal = currentDose.totalDose + proposedDose;
    let unit = drugLimit.unit;

    // For BSA-based limits (mg/m²), calculate actual limit
    if (unit === 'mg/m2' && patient) {
      const bsa = calculateBSA(patient.weight, patient.height);
      if (bsa) {
        limit = drugLimit.maxLifetime * bsa;
        unit = 'mg';
      }
    }

    // For duration-based limits
    if (drugLimit.maxCourse || drugLimit.maxDuration) {
      limit = drugLimit.maxCourse || drugLimit.maxDuration;
      proposedTotal = currentDose.totalDays + (proposedDose || 1); // proposedDose as days
      unit = 'days';
    }

    const percentageUsed = limit ? (proposedTotal / limit) * 100 : 0;
    const withinLimit = !limit || proposedTotal <= limit;

    // Generate warning message
    let warning = null;
    let severity = 'info';

    if (percentageUsed >= 100) {
      warning = `CRITICAL: Cumulative dose limit EXCEEDED. Current: ${currentDose.totalDose} ${unit}, Proposed total: ${proposedTotal} ${unit}, Limit: ${limit} ${unit}. Risk of ${drugLimit.toxicityType} toxicity.`;
      severity = 'critical';
    } else if (percentageUsed >= 90) {
      warning = `WARNING: Approaching cumulative dose limit (${Math.round(percentageUsed)}%). ${drugLimit.monitoring}`;
      severity = 'high';
    } else if (percentageUsed >= 80) {
      warning = `CAUTION: ${Math.round(percentageUsed)}% of cumulative dose limit reached. Consider monitoring: ${drugLimit.monitoring}`;
      severity = 'moderate';
    } else if (percentageUsed >= 50) {
      warning = `Note: ${Math.round(percentageUsed)}% of cumulative dose limit. Continue routine monitoring.`;
      severity = 'low';
    }

    return {
      hasLimit: true,
      withinLimit,
      currentTotal: currentDose.totalDose,
      proposedTotal,
      limit,
      unit,
      percentageUsed: Math.round(percentageUsed * 10) / 10,
      toxicityType: drugLimit.toxicityType,
      monitoring: drugLimit.monitoring,
      alternatives: drugLimit.alternatives,
      warning,
      severity,
      prescriptionCount: currentDose.prescriptionCount,
      firstPrescription: currentDose.startDate,
      lastPrescription: currentDose.lastDate
    };
  } catch (error) {
    console.error('Error checking cumulative limit:', error);
    throw new Error(`Failed to check cumulative limit: ${error.message}`);
  }
}

/**
 * Get cumulative dose history for charting
 * @param {String} patientId - Patient ID
 * @param {String} drugName - Drug name
 * @returns {Object} History with chart data
 */
async function getCumulativeDoseHistory(patientId, drugName) {
  try {
    const currentDose = await getPatientCumulativeDose(patientId, drugName);
    const drugLimit = getDrugCumulativeLimit(drugName);

    // Build cumulative progression for chart
    let runningTotal = 0;
    const chartData = currentDose.history.map(entry => {
      runningTotal += entry.dose;
      return {
        date: entry.date,
        dose: entry.dose,
        cumulativeTotal: runningTotal,
        prescriptionId: entry.prescriptionId
      };
    });

    return {
      drugName,
      totalDose: currentDose.totalDose,
      unit: currentDose.unit,
      limit: drugLimit?.maxLifetime || drugLimit?.warningThreshold || null,
      percentageUsed: drugLimit?.maxLifetime
        ? (currentDose.totalDose / drugLimit.maxLifetime) * 100
        : null,
      toxicityType: drugLimit?.toxicityType,
      chartData,
      timeline: currentDose.history,
      prescriptionCount: currentDose.prescriptionCount,
      firstDate: currentDose.startDate,
      lastDate: currentDose.lastDate
    };
  } catch (error) {
    console.error('Error getting dose history:', error);
    throw new Error(`Failed to get dose history: ${error.message}`);
  }
}

/**
 * Update cumulative record after dispensing
 * @param {String} patientId - Patient ID
 * @param {String} prescriptionId - Prescription ID
 * @param {String} drugName - Drug name
 * @param {Number} dose - Dispensed dose
 * @returns {Object} Updated cumulative data
 */
async function updateCumulativeRecord(patientId, prescriptionId, drugName, dose) {
  // In this implementation, cumulative tracking is query-based
  // so we just return the updated totals
  return await getPatientCumulativeDose(patientId, drugName);
}

/**
 * Calculate Body Surface Area (BSA) using Mosteller formula
 * @param {Number} weightKg - Weight in kg
 * @param {Number} heightCm - Height in cm
 * @returns {Number} BSA in m²
 */
function calculateBSA(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/**
 * Get all drugs with cumulative limits for reference
 * @returns {Object} All cumulative limit configurations
 */
function getAllCumulativeLimits() {
  return CUMULATIVE_LIMITS;
}

module.exports = {
  getDrugCumulativeLimit,
  getPatientCumulativeDose,
  checkCumulativeLimit,
  getCumulativeDoseHistory,
  updateCumulativeRecord,
  getAllCumulativeLimits,
  calculateBSA,
  CUMULATIVE_LIMITS
};
