/**
 * Cold Chain Monitoring Service
 * Monitors temperature-sensitive medication storage
 */

const IVTVial = require('../models/IVTVial');

/**
 * Temperature thresholds for different medication types
 */
const TEMPERATURE_REQUIREMENTS = {
  'anti_vegf': {
    min: 2,
    max: 8,
    unit: 'celsius',
    critical_min: 0,
    critical_max: 25,
    maxExcursionTime: 30, // minutes at room temp
    medications: ['aflibercept', 'ranibizumab', 'bevacizumab', 'brolucizumab', 'faricimab']
  },
  'vaccines': {
    min: 2,
    max: 8,
    unit: 'celsius',
    critical_min: 0,
    critical_max: 10,
    maxExcursionTime: 60,
    medications: ['influenza', 'hepatitis']
  },
  'biologics': {
    min: 2,
    max: 8,
    unit: 'celsius',
    critical_min: -2,
    critical_max: 15,
    maxExcursionTime: 120,
    medications: ['adalimumab', 'infliximab']
  },
  'insulin': {
    min: 2,
    max: 8,
    unit: 'celsius',
    critical_min: 0,
    critical_max: 30,
    maxExcursionTime: 240,
    medications: ['insulin glargine', 'insulin aspart', 'insulin lispro']
  }
};

/**
 * Storage locations
 */
const STORAGE_LOCATIONS = {
  'pharmacy_refrigerator': {
    name: 'Pharmacy Main Refrigerator',
    type: 'refrigerator',
    targetTemp: 4
  },
  'clinic_refrigerator': {
    name: 'Clinic Refrigerator',
    type: 'refrigerator',
    targetTemp: 4
  },
  'transport_cooler': {
    name: 'Transport Cooler',
    type: 'cooler',
    targetTemp: 4
  },
  'procedure_room': {
    name: 'Procedure Room',
    type: 'ambient',
    targetTemp: 22
  }
};

/**
 * Record temperature reading
 * @param {String} location - Storage location
 * @param {Number} temperature - Temperature in Celsius
 * @param {String} userId - User recording temperature
 * @param {String} method - Recording method
 * @returns {Object} Recording result
 */
async function recordTemperature(location, temperature, userId, method = 'manual') {
  const locationInfo = STORAGE_LOCATIONS[location];
  if (!locationInfo) {
    throw new Error(`Unknown storage location: ${location}`);
  }

  // Find all active vials at this location
  const vials = await IVTVial.find({
    'storage.currentLocation': location,
    currentStatus: { $in: ['in_stock', 'in_use'] }
  });

  const results = {
    location,
    temperature,
    recordedAt: new Date(),
    recordedBy: userId,
    vialsChecked: vials.length,
    excursions: [],
    alerts: []
  };

  // Check each vial against its temperature requirements
  for (const vial of vials) {
    const requirements = getTemperatureRequirements(vial.medication.name);
    if (!requirements) continue;

    const inRange = temperature >= requirements.min && temperature <= requirements.max;
    const isCritical = temperature < requirements.critical_min || temperature > requirements.critical_max;

    // Record temperature on vial
    await vial.recordTemperature(userId, temperature, location, method);

    if (!inRange) {
      const excursion = {
        vialNumber: vial.vialNumber,
        medication: vial.medication.name,
        temperature,
        requiredRange: `${requirements.min}-${requirements.max}°C`,
        isCritical,
        action: isCritical ? 'QUARANTINE_IMMEDIATELY' : 'MONITOR_CLOSELY'
      };
      results.excursions.push(excursion);

      if (isCritical) {
        results.alerts.push({
          severity: 'CRITICAL',
          message: `Critical temperature excursion for ${vial.medication.name} (${vial.vialNumber}): ${temperature}°C`,
          action: 'Quarantine vial and notify pharmacist immediately'
        });
      }
    }
  }

  return results;
}

/**
 * Get temperature requirements for a medication
 */
function getTemperatureRequirements(medicationName) {
  const normalizedName = medicationName.toLowerCase();

  for (const [category, config] of Object.entries(TEMPERATURE_REQUIREMENTS)) {
    if (config.medications.some(med => normalizedName.includes(med))) {
      return config;
    }
  }

  // Default refrigerated requirements
  return TEMPERATURE_REQUIREMENTS.anti_vegf;
}

/**
 * Check for temperature excursions
 * @param {String} clinicId - Clinic ID
 * @returns {Object} Excursion report
 */
async function checkTemperatureExcursions(clinicId) {
  const vialsWithExcursions = await IVTVial.find({
    clinic: clinicId,
    currentStatus: { $in: ['in_stock', 'in_use', 'quarantine'] },
    'temperatureLogs.inRange': false
  }).lean();

  const excursionReport = {
    totalVialsChecked: 0,
    vialsWithExcursions: vialsWithExcursions.length,
    criticalExcursions: 0,
    excursionDetails: [],
    recommendations: []
  };

  for (const vial of vialsWithExcursions) {
    const outOfRangeLogs = vial.temperatureLogs.filter(log => !log.inRange);
    const requirements = getTemperatureRequirements(vial.medication.name);

    // Calculate excursion duration
    let excursionMinutes = 0;
    let lastExcursionTime = null;

    for (const log of outOfRangeLogs) {
      if (lastExcursionTime) {
        excursionMinutes += (new Date(log.recordedAt) - lastExcursionTime) / 60000;
      }
      lastExcursionTime = new Date(log.recordedAt);
    }

    const isCriticalDuration = excursionMinutes > (requirements.maxExcursionTime || 30);
    if (isCriticalDuration) {
      excursionReport.criticalExcursions++;
    }

    excursionReport.excursionDetails.push({
      vialNumber: vial.vialNumber,
      medication: vial.medication.name,
      lotNumber: vial.lotNumber,
      excursionCount: outOfRangeLogs.length,
      totalExcursionMinutes: Math.round(excursionMinutes),
      maxAllowedMinutes: requirements.maxExcursionTime,
      status: isCriticalDuration ? 'DISPOSAL_REQUIRED' : 'REVIEW_REQUIRED',
      lastExcursion: outOfRangeLogs[outOfRangeLogs.length - 1]
    });

    if (isCriticalDuration) {
      excursionReport.recommendations.push(
        `Vial ${vial.vialNumber} (${vial.medication.name}): Exceeded maximum excursion time. Disposal recommended.`
      );
    }
  }

  return excursionReport;
}

/**
 * Get cold chain compliance report
 * @param {String} clinicId - Clinic ID
 * @param {Date} startDate - Report start date
 * @param {Date} endDate - Report end date
 * @returns {Object} Compliance report
 */
async function getColdChainComplianceReport(clinicId, startDate, endDate) {
  const vials = await IVTVial.find({
    clinic: clinicId,
    createdAt: { $gte: startDate, $lte: endDate }
  }).lean();

  let totalTemperatureReadings = 0;
  let inRangeReadings = 0;
  let excursionReadings = 0;

  for (const vial of vials) {
    for (const log of vial.temperatureLogs || []) {
      if (new Date(log.recordedAt) >= startDate && new Date(log.recordedAt) <= endDate) {
        totalTemperatureReadings++;
        if (log.inRange) {
          inRangeReadings++;
        } else {
          excursionReadings++;
        }
      }
    }
  }

  const complianceRate = totalTemperatureReadings > 0
    ? ((inRangeReadings / totalTemperatureReadings) * 100).toFixed(1)
    : 100;

  // Analyze by location
  const byLocation = {};
  for (const vial of vials) {
    const location = vial.storage?.currentLocation || 'unknown';
    if (!byLocation[location]) {
      byLocation[location] = { total: 0, inRange: 0, excursions: 0 };
    }

    for (const log of vial.temperatureLogs || []) {
      if (new Date(log.recordedAt) >= startDate && new Date(log.recordedAt) <= endDate) {
        byLocation[location].total++;
        if (log.inRange) {
          byLocation[location].inRange++;
        } else {
          byLocation[location].excursions++;
        }
      }
    }
  }

  // Calculate compliance by location
  for (const location in byLocation) {
    const data = byLocation[location];
    data.complianceRate = data.total > 0
      ? ((data.inRange / data.total) * 100).toFixed(1)
      : 100;
  }

  return {
    reportPeriod: { startDate, endDate },
    totalVialsTracked: vials.length,
    totalTemperatureReadings,
    inRangeReadings,
    excursionReadings,
    overallComplianceRate: complianceRate,
    complianceByLocation: byLocation,
    vialsDisposedDueToExcursion: vials.filter(v =>
      v.disposal?.disposalReason === 'temperature_excursion'
    ).length,
    generatedAt: new Date()
  };
}

/**
 * Generate temperature alert
 * @param {Object} excursionData - Excursion data
 * @returns {Object} Alert object
 */
function generateColdChainAlert(excursionData) {
  const severity = excursionData.isCritical ? 'EMERGENCY' : 'WARNING';

  return {
    severity,
    category: 'cold_chain',
    code: excursionData.isCritical ? 'CRITICAL_TEMP_EXCURSION' : 'TEMP_EXCURSION',
    title: `Temperature Excursion: ${excursionData.location}`,
    message: `Temperature ${excursionData.temperature}°C recorded at ${excursionData.location}. ` +
             `${excursionData.vialsAffected} vial(s) affected. ` +
             `Required range: ${excursionData.requiredRange}`,
    triggerField: 'temperature',
    triggerValue: `${excursionData.temperature}°C`,
    recommendedActions: [
      { action: excursionData.isCritical
          ? 'Quarantine all affected vials immediately'
          : 'Check refrigerator function', priority: 1 },
      { action: 'Document excursion in cold chain log', priority: 2 },
      { action: 'Notify pharmacy supervisor', priority: 3 },
      { action: 'Review vial stability data before use', priority: 4 }
    ],
    excursionData
  };
}

/**
 * Get vials expiring soon
 * @param {String} clinicId - Clinic ID
 * @param {Number} daysAhead - Days to look ahead
 * @returns {Array} Expiring vials
 */
async function getExpiringVials(clinicId, daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const expiringVials = await IVTVial.find({
    clinic: clinicId,
    currentStatus: { $in: ['in_stock', 'in_use'] },
    expirationDate: { $lte: futureDate }
  })
  .sort({ expirationDate: 1 })
  .lean();

  return expiringVials.map(vial => ({
    vialNumber: vial.vialNumber,
    medication: vial.medication.name,
    lotNumber: vial.lotNumber,
    expirationDate: vial.expirationDate,
    daysUntilExpiry: Math.ceil((new Date(vial.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)),
    dosesRemaining: vial.dosesRemaining,
    urgency: Math.ceil((new Date(vial.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)) <= 7
      ? 'URGENT' : 'WARNING'
  }));
}

module.exports = {
  recordTemperature,
  getTemperatureRequirements,
  checkTemperatureExcursions,
  getColdChainComplianceReport,
  generateColdChainAlert,
  getExpiringVials,
  TEMPERATURE_REQUIREMENTS,
  STORAGE_LOCATIONS
};
