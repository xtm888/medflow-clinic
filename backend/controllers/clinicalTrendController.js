/**
 * Clinical Trend Controller
 *
 * Handles retrieval and analysis of clinical trend data for ophthalmology patients.
 */

const OphthalmologyExam = require('../models/OphthalmologyExam');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ClinicalTrendController');

/**
 * Convert Snellen VA to LogMAR for trend analysis
 */
const snellenToLogMAR = (snellen) => {
  if (!snellen) return null;

  const snellenMap = {
    '20/10': -0.3,
    '20/12.5': -0.2,
    '20/16': -0.1,
    '20/20': 0,
    '20/25': 0.1,
    '20/30': 0.18,
    '20/32': 0.2,
    '20/40': 0.3,
    '20/50': 0.4,
    '20/60': 0.48,
    '20/63': 0.5,
    '20/70': 0.54,
    '20/80': 0.6,
    '20/100': 0.7,
    '20/125': 0.8,
    '20/160': 0.9,
    '20/200': 1.0,
    '20/250': 1.1,
    '20/320': 1.2,
    '20/400': 1.3,
    '20/500': 1.4,
    '20/630': 1.5,
    '20/800': 1.6,
    '20/1000': 1.7,
    'CF': 1.7,    // Count Fingers
    'HM': 2.0,    // Hand Motion
    'LP': 2.5,    // Light Perception
    'NLP': 3.0,   // No Light Perception
    'NPL': 3.0    // No Light Perception
  };

  const normalized = snellen.toUpperCase().replace(/\s/g, '');
  return snellenMap[normalized] ?? null;
};

/**
 * Convert LogMAR to Snellen for display
 */
const logMARToSnellen = (logmar) => {
  if (logmar === null || logmar === undefined) return null;

  const snellenMap = {
    '-0.3': '20/10',
    '-0.2': '20/12.5',
    '-0.1': '20/16',
    '0': '20/20',
    '0.1': '20/25',
    '0.18': '20/30',
    '0.2': '20/32',
    '0.3': '20/40',
    '0.4': '20/50',
    '0.48': '20/60',
    '0.5': '20/63',
    '0.54': '20/70',
    '0.6': '20/80',
    '0.7': '20/100',
    '0.8': '20/125',
    '0.9': '20/160',
    '1.0': '20/200',
    '1.1': '20/250',
    '1.2': '20/320',
    '1.3': '20/400',
    '1.4': '20/500',
    '1.5': '20/630',
    '1.6': '20/800',
    '1.7': 'CF',
    '2.0': 'HM',
    '2.5': 'LP',
    '3.0': 'NLP'
  };

  // Find closest match
  const logmarStr = logmar.toFixed(2);
  if (snellenMap[logmarStr]) return snellenMap[logmarStr];

  // Find closest value
  const keys = Object.keys(snellenMap).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length; i++) {
    if (logmar <= keys[i]) {
      return snellenMap[keys[i].toString()] || snellenMap[keys[i].toFixed(2)];
    }
  }
  return 'NLP';
};

/**
 * Extract IOP value from tonometry data
 */
const extractIOP = (tonometry, eye) => {
  if (!tonometry) return null;
  const eyeData = tonometry[eye];
  if (!eyeData) return null;

  // Handle various data formats
  if (typeof eyeData === 'number') return eyeData;
  if (typeof eyeData === 'string') return parseFloat(eyeData);
  if (eyeData.value) return parseFloat(eyeData.value);
  if (eyeData.iop) return parseFloat(eyeData.iop);

  return null;
};

/**
 * Extract Cup/Disc ratio from fundus data
 */
const extractCupDisc = (fundus, eye) => {
  if (!fundus) return null;
  const eyeData = fundus[eye];
  if (!eyeData) return null;

  // Try various field names
  const cd = eyeData.cupDiscRatio || eyeData.cdRatio || eyeData.cd ||
             eyeData.opticDisc?.cupDiscRatio || eyeData.opticDisc?.cd;

  if (cd === null || cd === undefined) return null;
  return parseFloat(cd);
};

/**
 * Extract visual acuity from exam data
 */
const extractVA = (visualAcuity, eye, type = 'corrected') => {
  if (!visualAcuity) return null;

  const distance = visualAcuity.distance?.[eye];
  if (!distance) return null;

  const va = type === 'corrected' ? distance.corrected : distance.uncorrected;
  return va || null;
};

/**
 * Extract refraction data
 */
const extractRefraction = (refraction, eye) => {
  if (!refraction) return null;
  const eyeData = refraction[eye];
  if (!eyeData) return null;

  return {
    sphere: parseFloat(eyeData.sphere || eyeData.sph) || null,
    cylinder: parseFloat(eyeData.cylinder || eyeData.cyl) || null,
    axis: parseFloat(eyeData.axis) || null,
    add: parseFloat(eyeData.add) || null
  };
};

/**
 * Calculate spherical equivalent
 */
const sphericalEquivalent = (sphere, cylinder) => {
  if (sphere === null) return null;
  const cyl = cylinder || 0;
  return sphere + (cyl / 2);
};

/**
 * Get IOP trends for a patient
 * GET /api/clinical-trends/patient/:patientId/iop
 */
exports.getIOPTrends = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { months = 24, limit = 50 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const exams = await OphthalmologyExam.find({
      patient: patientId,
      createdAt: { $gte: startDate },
      'tonometry.OD': { $exists: true }
    })
      .select('createdAt tonometry')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .lean();

    const dataPoints = exams.map(exam => {
      const odIOP = extractIOP(exam.tonometry, 'OD');
      const osIOP = extractIOP(exam.tonometry, 'OS');

      return {
        date: exam.createdAt,
        examId: exam._id,
        OD: odIOP,
        OS: osIOP,
        method: exam.tonometry?.method || 'unknown',
        time: exam.tonometry?.time
      };
    }).filter(dp => dp.OD !== null || dp.OS !== null);

    // Calculate statistics
    const odValues = dataPoints.filter(dp => dp.OD !== null).map(dp => dp.OD);
    const osValues = dataPoints.filter(dp => dp.OS !== null).map(dp => dp.OS);

    const stats = {
      OD: {
        min: odValues.length ? Math.min(...odValues) : null,
        max: odValues.length ? Math.max(...odValues) : null,
        avg: odValues.length ? (odValues.reduce((a, b) => a + b, 0) / odValues.length).toFixed(1) : null,
        latest: odValues.length ? odValues[odValues.length - 1] : null,
        trend: odValues.length >= 2 ? (odValues[odValues.length - 1] - odValues[0] > 0 ? 'increasing' : 'stable') : 'insufficient_data'
      },
      OS: {
        min: osValues.length ? Math.min(...osValues) : null,
        max: osValues.length ? Math.max(...osValues) : null,
        avg: osValues.length ? (osValues.reduce((a, b) => a + b, 0) / osValues.length).toFixed(1) : null,
        latest: osValues.length ? osValues[osValues.length - 1] : null,
        trend: osValues.length >= 2 ? (osValues[osValues.length - 1] - osValues[0] > 0 ? 'increasing' : 'stable') : 'insufficient_data'
      }
    };

    // Detect concerning patterns
    const concerns = [];
    if (stats.OD.max > 21) concerns.push({ eye: 'OD', type: 'elevated', value: stats.OD.max });
    if (stats.OS.max > 21) concerns.push({ eye: 'OS', type: 'elevated', value: stats.OS.max });
    if (stats.OD.trend === 'increasing' && odValues.length >= 3) concerns.push({ eye: 'OD', type: 'trending_up' });
    if (stats.OS.trend === 'increasing' && osValues.length >= 3) concerns.push({ eye: 'OS', type: 'trending_up' });

    res.json({
      success: true,
      data: {
        dataPoints,
        stats,
        concerns,
        meta: {
          totalPoints: dataPoints.length,
          dateRange: {
            start: dataPoints.length ? dataPoints[0].date : null,
            end: dataPoints.length ? dataPoints[dataPoints.length - 1].date : null
          },
          normalRange: { min: 10, max: 21, unit: 'mmHg' }
        }
      }
    });
  } catch (error) {
    log.error('Error getting IOP trends', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to get IOP trends',
      error: error.message
    });
  }
};

/**
 * Get Visual Acuity trends for a patient
 * GET /api/clinical-trends/patient/:patientId/visual-acuity
 */
exports.getVisualAcuityTrends = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { months = 24, limit = 50, type = 'corrected' } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const exams = await OphthalmologyExam.find({
      patient: patientId,
      createdAt: { $gte: startDate },
      'visualAcuity.distance': { $exists: true }
    })
      .select('createdAt visualAcuity')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .lean();

    const dataPoints = exams.map(exam => {
      const odVA = extractVA(exam.visualAcuity, 'OD', type);
      const osVA = extractVA(exam.visualAcuity, 'OS', type);

      return {
        date: exam.createdAt,
        examId: exam._id,
        OD: {
          snellen: odVA,
          logMAR: snellenToLogMAR(odVA)
        },
        OS: {
          snellen: osVA,
          logMAR: snellenToLogMAR(osVA)
        },
        type
      };
    }).filter(dp => dp.OD.snellen !== null || dp.OS.snellen !== null);

    // Calculate statistics using LogMAR (lower is better)
    const odLogMAR = dataPoints.filter(dp => dp.OD.logMAR !== null).map(dp => dp.OD.logMAR);
    const osLogMAR = dataPoints.filter(dp => dp.OS.logMAR !== null).map(dp => dp.OS.logMAR);

    const stats = {
      OD: {
        best: odLogMAR.length ? logMARToSnellen(Math.min(...odLogMAR)) : null,
        worst: odLogMAR.length ? logMARToSnellen(Math.max(...odLogMAR)) : null,
        latest: odLogMAR.length ? logMARToSnellen(odLogMAR[odLogMAR.length - 1]) : null,
        latestLogMAR: odLogMAR.length ? odLogMAR[odLogMAR.length - 1] : null,
        // Positive change in LogMAR = worsening vision
        trend: odLogMAR.length >= 2 ?
          (odLogMAR[odLogMAR.length - 1] - odLogMAR[0] > 0.1 ? 'worsening' :
            odLogMAR[odLogMAR.length - 1] - odLogMAR[0] < -0.1 ? 'improving' : 'stable') :
          'insufficient_data'
      },
      OS: {
        best: osLogMAR.length ? logMARToSnellen(Math.min(...osLogMAR)) : null,
        worst: osLogMAR.length ? logMARToSnellen(Math.max(...osLogMAR)) : null,
        latest: osLogMAR.length ? logMARToSnellen(osLogMAR[osLogMAR.length - 1]) : null,
        latestLogMAR: osLogMAR.length ? osLogMAR[osLogMAR.length - 1] : null,
        trend: osLogMAR.length >= 2 ?
          (osLogMAR[osLogMAR.length - 1] - osLogMAR[0] > 0.1 ? 'worsening' :
            osLogMAR[osLogMAR.length - 1] - osLogMAR[0] < -0.1 ? 'improving' : 'stable') :
          'insufficient_data'
      }
    };

    // Detect concerns (>= 2 lines / 0.2 LogMAR change)
    const concerns = [];
    if (odLogMAR.length >= 2 && (odLogMAR[odLogMAR.length - 1] - odLogMAR[0]) >= 0.2) {
      concerns.push({ eye: 'OD', type: 'significant_decline', change: (odLogMAR[odLogMAR.length - 1] - odLogMAR[0]).toFixed(2) });
    }
    if (osLogMAR.length >= 2 && (osLogMAR[osLogMAR.length - 1] - osLogMAR[0]) >= 0.2) {
      concerns.push({ eye: 'OS', type: 'significant_decline', change: (osLogMAR[osLogMAR.length - 1] - osLogMAR[0]).toFixed(2) });
    }

    res.json({
      success: true,
      data: {
        dataPoints,
        stats,
        concerns,
        meta: {
          totalPoints: dataPoints.length,
          dateRange: {
            start: dataPoints.length ? dataPoints[0].date : null,
            end: dataPoints.length ? dataPoints[dataPoints.length - 1].date : null
          },
          measurementType: type,
          note: 'LogMAR: lower values = better vision; 0.1 LogMAR ≈ 1 Snellen line'
        }
      }
    });
  } catch (error) {
    log.error('Error getting VA trends', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to get visual acuity trends',
      error: error.message
    });
  }
};

/**
 * Get Cup/Disc ratio trends for a patient
 * GET /api/clinical-trends/patient/:patientId/cup-disc
 */
exports.getCupDiscTrends = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { months = 36, limit = 50 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const exams = await OphthalmologyExam.find({
      patient: patientId,
      createdAt: { $gte: startDate },
      $or: [
        { 'fundus.OD': { $exists: true } },
        { 'fundus.OS': { $exists: true } },
        { 'posteriorSegment.OD': { $exists: true } },
        { 'posteriorSegment.OS': { $exists: true } }
      ]
    })
      .select('createdAt fundus posteriorSegment')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .lean();

    const dataPoints = exams.map(exam => {
      const fundusData = exam.fundus || exam.posteriorSegment || {};
      const odCD = extractCupDisc(fundusData, 'OD');
      const osCD = extractCupDisc(fundusData, 'OS');

      return {
        date: exam.createdAt,
        examId: exam._id,
        OD: odCD,
        OS: osCD
      };
    }).filter(dp => dp.OD !== null || dp.OS !== null);

    // Calculate statistics
    const odValues = dataPoints.filter(dp => dp.OD !== null).map(dp => dp.OD);
    const osValues = dataPoints.filter(dp => dp.OS !== null).map(dp => dp.OS);

    const stats = {
      OD: {
        min: odValues.length ? Math.min(...odValues).toFixed(2) : null,
        max: odValues.length ? Math.max(...odValues).toFixed(2) : null,
        latest: odValues.length ? odValues[odValues.length - 1].toFixed(2) : null,
        trend: odValues.length >= 2 ?
          (odValues[odValues.length - 1] - odValues[0] > 0.05 ? 'increasing' : 'stable') :
          'insufficient_data'
      },
      OS: {
        min: osValues.length ? Math.min(...osValues).toFixed(2) : null,
        max: osValues.length ? Math.max(...osValues).toFixed(2) : null,
        latest: osValues.length ? osValues[osValues.length - 1].toFixed(2) : null,
        trend: osValues.length >= 2 ?
          (osValues[osValues.length - 1] - osValues[0] > 0.05 ? 'increasing' : 'stable') :
          'insufficient_data'
      }
    };

    // Detect concerns
    const concerns = [];
    if (stats.OD.latest && parseFloat(stats.OD.latest) > 0.7) {
      concerns.push({ eye: 'OD', type: 'elevated', value: stats.OD.latest });
    }
    if (stats.OS.latest && parseFloat(stats.OS.latest) > 0.7) {
      concerns.push({ eye: 'OS', type: 'elevated', value: stats.OS.latest });
    }
    // Asymmetry > 0.2
    if (stats.OD.latest && stats.OS.latest &&
        Math.abs(parseFloat(stats.OD.latest) - parseFloat(stats.OS.latest)) > 0.2) {
      concerns.push({
        type: 'asymmetry',
        difference: Math.abs(parseFloat(stats.OD.latest) - parseFloat(stats.OS.latest)).toFixed(2)
      });
    }

    res.json({
      success: true,
      data: {
        dataPoints,
        stats,
        concerns,
        meta: {
          totalPoints: dataPoints.length,
          dateRange: {
            start: dataPoints.length ? dataPoints[0].date : null,
            end: dataPoints.length ? dataPoints[dataPoints.length - 1].date : null
          },
          normalRange: { max: 0.5, suspectAbove: 0.7, unit: 'ratio' },
          note: 'C/D > 0.7 or asymmetry > 0.2 warrants glaucoma workup'
        }
      }
    });
  } catch (error) {
    log.error('Error getting C/D trends', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to get cup/disc trends',
      error: error.message
    });
  }
};

/**
 * Get Refraction trends for a patient
 * GET /api/clinical-trends/patient/:patientId/refraction
 */
exports.getRefractionTrends = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { months = 60, limit = 50 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const exams = await OphthalmologyExam.find({
      patient: patientId,
      createdAt: { $gte: startDate },
      $or: [
        { 'refraction.OD': { $exists: true } },
        { 'refraction.OS': { $exists: true } }
      ]
    })
      .select('createdAt refraction')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .lean();

    const dataPoints = exams.map(exam => {
      const odRef = extractRefraction(exam.refraction, 'OD');
      const osRef = extractRefraction(exam.refraction, 'OS');

      return {
        date: exam.createdAt,
        examId: exam._id,
        OD: odRef ? {
          ...odRef,
          sphericalEquivalent: sphericalEquivalent(odRef.sphere, odRef.cylinder)
        } : null,
        OS: osRef ? {
          ...osRef,
          sphericalEquivalent: sphericalEquivalent(osRef.sphere, osRef.cylinder)
        } : null
      };
    }).filter(dp => dp.OD !== null || dp.OS !== null);

    // Calculate statistics using spherical equivalent
    const odSE = dataPoints.filter(dp => dp.OD?.sphericalEquivalent !== null).map(dp => dp.OD.sphericalEquivalent);
    const osSE = dataPoints.filter(dp => dp.OS?.sphericalEquivalent !== null).map(dp => dp.OS.sphericalEquivalent);

    const stats = {
      OD: {
        latestSphere: dataPoints.length && dataPoints[dataPoints.length - 1].OD ?
          dataPoints[dataPoints.length - 1].OD.sphere : null,
        latestCylinder: dataPoints.length && dataPoints[dataPoints.length - 1].OD ?
          dataPoints[dataPoints.length - 1].OD.cylinder : null,
        latestSE: odSE.length ? odSE[odSE.length - 1]?.toFixed(2) : null,
        change: odSE.length >= 2 ? (odSE[odSE.length - 1] - odSE[0]).toFixed(2) : null,
        trend: odSE.length >= 2 ?
          (odSE[odSE.length - 1] - odSE[0] < -0.5 ? 'myopia_progression' :
            odSE[odSE.length - 1] - odSE[0] > 0.5 ? 'hyperopia_progression' : 'stable') :
          'insufficient_data'
      },
      OS: {
        latestSphere: dataPoints.length && dataPoints[dataPoints.length - 1].OS ?
          dataPoints[dataPoints.length - 1].OS.sphere : null,
        latestCylinder: dataPoints.length && dataPoints[dataPoints.length - 1].OS ?
          dataPoints[dataPoints.length - 1].OS.cylinder : null,
        latestSE: osSE.length ? osSE[osSE.length - 1]?.toFixed(2) : null,
        change: osSE.length >= 2 ? (osSE[osSE.length - 1] - osSE[0]).toFixed(2) : null,
        trend: osSE.length >= 2 ?
          (osSE[osSE.length - 1] - osSE[0] < -0.5 ? 'myopia_progression' :
            osSE[osSE.length - 1] - osSE[0] > 0.5 ? 'hyperopia_progression' : 'stable') :
          'insufficient_data'
      }
    };

    // Detect concerns (>1D myopia progression is significant)
    const concerns = [];
    if (stats.OD.change && parseFloat(stats.OD.change) < -1) {
      concerns.push({ eye: 'OD', type: 'myopia_progression', change: stats.OD.change });
    }
    if (stats.OS.change && parseFloat(stats.OS.change) < -1) {
      concerns.push({ eye: 'OS', type: 'myopia_progression', change: stats.OS.change });
    }
    // Anisometropia > 2D
    if (stats.OD.latestSE && stats.OS.latestSE &&
        Math.abs(parseFloat(stats.OD.latestSE) - parseFloat(stats.OS.latestSE)) > 2) {
      concerns.push({
        type: 'anisometropia',
        difference: Math.abs(parseFloat(stats.OD.latestSE) - parseFloat(stats.OS.latestSE)).toFixed(2)
      });
    }

    res.json({
      success: true,
      data: {
        dataPoints,
        stats,
        concerns,
        meta: {
          totalPoints: dataPoints.length,
          dateRange: {
            start: dataPoints.length ? dataPoints[0].date : null,
            end: dataPoints.length ? dataPoints[dataPoints.length - 1].date : null
          },
          note: 'SE = Sphere + (Cylinder/2). Negative = myopia, Positive = hyperopia'
        }
      }
    });
  } catch (error) {
    log.error('Error getting refraction trends', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to get refraction trends',
      error: error.message
    });
  }
};

/**
 * Get Pachymetry trends for a patient
 * GET /api/clinical-trends/patient/:patientId/pachymetry
 */
exports.getPachymetryTrends = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { months = 36, limit = 50 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const exams = await OphthalmologyExam.find({
      patient: patientId,
      createdAt: { $gte: startDate },
      $or: [
        { 'pachymetry.OD': { $exists: true } },
        { 'pachymetry.OS': { $exists: true } }
      ]
    })
      .select('createdAt pachymetry')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .lean();

    const dataPoints = exams.map(exam => {
      const extractPachy = (eye) => {
        const data = exam.pachymetry?.[eye];
        if (!data) return null;
        if (typeof data === 'number') return data;
        if (typeof data === 'string') return parseFloat(data);
        if (data.value) return parseFloat(data.value);
        if (data.cct) return parseFloat(data.cct);
        return null;
      };

      return {
        date: exam.createdAt,
        examId: exam._id,
        OD: extractPachy('OD'),
        OS: extractPachy('OS')
      };
    }).filter(dp => dp.OD !== null || dp.OS !== null);

    // Calculate statistics
    const odValues = dataPoints.filter(dp => dp.OD !== null).map(dp => dp.OD);
    const osValues = dataPoints.filter(dp => dp.OS !== null).map(dp => dp.OS);

    const stats = {
      OD: {
        min: odValues.length ? Math.min(...odValues) : null,
        max: odValues.length ? Math.max(...odValues) : null,
        avg: odValues.length ? Math.round(odValues.reduce((a, b) => a + b, 0) / odValues.length) : null,
        latest: odValues.length ? odValues[odValues.length - 1] : null
      },
      OS: {
        min: osValues.length ? Math.min(...osValues) : null,
        max: osValues.length ? Math.max(...osValues) : null,
        avg: osValues.length ? Math.round(osValues.reduce((a, b) => a + b, 0) / osValues.length) : null,
        latest: osValues.length ? osValues[osValues.length - 1] : null
      }
    };

    // Detect concerns
    const concerns = [];
    if (stats.OD.latest && stats.OD.latest < 500) {
      concerns.push({ eye: 'OD', type: 'thin_cornea', value: stats.OD.latest });
    }
    if (stats.OS.latest && stats.OS.latest < 500) {
      concerns.push({ eye: 'OS', type: 'thin_cornea', value: stats.OS.latest });
    }

    res.json({
      success: true,
      data: {
        dataPoints,
        stats,
        concerns,
        meta: {
          totalPoints: dataPoints.length,
          dateRange: {
            start: dataPoints.length ? dataPoints[0].date : null,
            end: dataPoints.length ? dataPoints[dataPoints.length - 1].date : null
          },
          normalRange: { min: 520, max: 560, unit: 'μm' },
          note: 'CCT < 500μm may indicate keratoconus or post-refractive surgery. Affects IOP interpretation.'
        }
      }
    });
  } catch (error) {
    log.error('Error getting pachymetry trends', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to get pachymetry trends',
      error: error.message
    });
  }
};

/**
 * Get all trends combined for a patient
 * GET /api/clinical-trends/patient/:patientId/all
 */
exports.getAllTrends = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { months = 24 } = req.query;

    // Fetch all exam data in one query
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const exams = await OphthalmologyExam.find({
      patient: patientId,
      createdAt: { $gte: startDate }
    })
      .select('createdAt tonometry visualAcuity fundus posteriorSegment refraction pachymetry')
      .sort({ createdAt: 1 })
      .lean();

    // Process each type of data
    const iop = exams.map(exam => ({
      date: exam.createdAt,
      OD: extractIOP(exam.tonometry, 'OD'),
      OS: extractIOP(exam.tonometry, 'OS')
    })).filter(dp => dp.OD !== null || dp.OS !== null);

    const va = exams.map(exam => ({
      date: exam.createdAt,
      OD: extractVA(exam.visualAcuity, 'OD', 'corrected'),
      OS: extractVA(exam.visualAcuity, 'OS', 'corrected')
    })).filter(dp => dp.OD !== null || dp.OS !== null);

    const fundusData = exams.map(exam => {
      const fd = exam.fundus || exam.posteriorSegment;
      return {
        date: exam.createdAt,
        OD: extractCupDisc(fd, 'OD'),
        OS: extractCupDisc(fd, 'OS')
      };
    }).filter(dp => dp.OD !== null || dp.OS !== null);

    res.json({
      success: true,
      data: {
        iop: { dataPoints: iop, count: iop.length },
        visualAcuity: { dataPoints: va, count: va.length },
        cupDisc: { dataPoints: fundusData, count: fundusData.length },
        meta: {
          examCount: exams.length,
          dateRange: {
            start: exams.length ? exams[0].createdAt : null,
            end: exams.length ? exams[exams.length - 1].createdAt : null
          }
        }
      }
    });
  } catch (error) {
    log.error('Error getting all trends', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to get all trends',
      error: error.message
    });
  }
};

/**
 * Get trend summary with alerts for a patient
 * GET /api/clinical-trends/patient/:patientId/summary
 */
exports.getTrendSummary = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Get latest exam
    const latestExam = await OphthalmologyExam.findOne({
      patient: patientId,
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestExam) {
      return res.json({
        success: true,
        data: {
          hasData: false,
          message: 'No completed exams found'
        }
      });
    }

    // Get previous exam for comparison
    const previousExam = await OphthalmologyExam.findOne({
      patient: patientId,
      _id: { $ne: latestExam._id },
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .lean();

    // Extract latest values
    const summary = {
      lastExamDate: latestExam.createdAt,
      iop: {
        OD: extractIOP(latestExam.tonometry, 'OD'),
        OS: extractIOP(latestExam.tonometry, 'OS'),
        previousOD: previousExam ? extractIOP(previousExam.tonometry, 'OD') : null,
        previousOS: previousExam ? extractIOP(previousExam.tonometry, 'OS') : null
      },
      visualAcuity: {
        OD: extractVA(latestExam.visualAcuity, 'OD', 'corrected'),
        OS: extractVA(latestExam.visualAcuity, 'OS', 'corrected'),
        previousOD: previousExam ? extractVA(previousExam.visualAcuity, 'OD', 'corrected') : null,
        previousOS: previousExam ? extractVA(previousExam.visualAcuity, 'OS', 'corrected') : null
      },
      cupDisc: {
        OD: extractCupDisc(latestExam.fundus || latestExam.posteriorSegment, 'OD'),
        OS: extractCupDisc(latestExam.fundus || latestExam.posteriorSegment, 'OS'),
        previousOD: previousExam ? extractCupDisc(previousExam.fundus || previousExam.posteriorSegment, 'OD') : null,
        previousOS: previousExam ? extractCupDisc(previousExam.fundus || previousExam.posteriorSegment, 'OS') : null
      }
    };

    // Generate quick alerts
    const alerts = [];

    // IOP alerts
    if (summary.iop.OD && summary.iop.OD > 21) alerts.push({ type: 'IOP_ELEVATED', eye: 'OD', value: summary.iop.OD });
    if (summary.iop.OS && summary.iop.OS > 21) alerts.push({ type: 'IOP_ELEVATED', eye: 'OS', value: summary.iop.OS });

    // C/D alerts
    if (summary.cupDisc.OD && summary.cupDisc.OD > 0.7) alerts.push({ type: 'CUP_DISC_HIGH', eye: 'OD', value: summary.cupDisc.OD });
    if (summary.cupDisc.OS && summary.cupDisc.OS > 0.7) alerts.push({ type: 'CUP_DISC_HIGH', eye: 'OS', value: summary.cupDisc.OS });

    res.json({
      success: true,
      data: {
        hasData: true,
        summary,
        alerts,
        previousExamDate: previousExam?.createdAt || null,
        hasPreviousData: !!previousExam
      }
    });
  } catch (error) {
    log.error('Error getting trend summary', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to get trend summary',
      error: error.message
    });
  }
};

/**
 * Compare two exams
 * POST /api/clinical-trends/compare
 */
exports.compareExams = async (req, res) => {
  try {
    const { examId1, examId2 } = req.body;

    const [exam1, exam2] = await Promise.all([
      OphthalmologyExam.findById(examId1).lean(),
      OphthalmologyExam.findById(examId2).lean()
    ]);

    if (!exam1 || !exam2) {
      return res.status(404).json({
        success: false,
        message: 'One or both exams not found'
      });
    }

    // Ensure exam1 is older
    const [older, newer] = exam1.createdAt < exam2.createdAt ? [exam1, exam2] : [exam2, exam1];

    const comparison = {
      dateRange: {
        from: older.createdAt,
        to: newer.createdAt,
        daysBetween: Math.round((new Date(newer.createdAt) - new Date(older.createdAt)) / (1000 * 60 * 60 * 24))
      },
      iop: {
        OD: {
          from: extractIOP(older.tonometry, 'OD'),
          to: extractIOP(newer.tonometry, 'OD'),
          change: null
        },
        OS: {
          from: extractIOP(older.tonometry, 'OS'),
          to: extractIOP(newer.tonometry, 'OS'),
          change: null
        }
      },
      visualAcuity: {
        OD: {
          from: extractVA(older.visualAcuity, 'OD', 'corrected'),
          to: extractVA(newer.visualAcuity, 'OD', 'corrected'),
          fromLogMAR: null,
          toLogMAR: null,
          change: null
        },
        OS: {
          from: extractVA(older.visualAcuity, 'OS', 'corrected'),
          to: extractVA(newer.visualAcuity, 'OS', 'corrected'),
          fromLogMAR: null,
          toLogMAR: null,
          change: null
        }
      },
      cupDisc: {
        OD: {
          from: extractCupDisc(older.fundus || older.posteriorSegment, 'OD'),
          to: extractCupDisc(newer.fundus || newer.posteriorSegment, 'OD'),
          change: null
        },
        OS: {
          from: extractCupDisc(older.fundus || older.posteriorSegment, 'OS'),
          to: extractCupDisc(newer.fundus || newer.posteriorSegment, 'OS'),
          change: null
        }
      }
    };

    // Calculate changes
    ['OD', 'OS'].forEach(eye => {
      // IOP change
      if (comparison.iop[eye].from !== null && comparison.iop[eye].to !== null) {
        comparison.iop[eye].change = comparison.iop[eye].to - comparison.iop[eye].from;
      }

      // VA change (LogMAR)
      comparison.visualAcuity[eye].fromLogMAR = snellenToLogMAR(comparison.visualAcuity[eye].from);
      comparison.visualAcuity[eye].toLogMAR = snellenToLogMAR(comparison.visualAcuity[eye].to);
      if (comparison.visualAcuity[eye].fromLogMAR !== null && comparison.visualAcuity[eye].toLogMAR !== null) {
        comparison.visualAcuity[eye].change = comparison.visualAcuity[eye].toLogMAR - comparison.visualAcuity[eye].fromLogMAR;
        comparison.visualAcuity[eye].linesChanged = Math.round(comparison.visualAcuity[eye].change / 0.1);
      }

      // C/D change
      if (comparison.cupDisc[eye].from !== null && comparison.cupDisc[eye].to !== null) {
        comparison.cupDisc[eye].change = (comparison.cupDisc[eye].to - comparison.cupDisc[eye].from).toFixed(2);
      }
    });

    res.json({
      success: true,
      data: {
        comparison,
        examIds: {
          older: older._id,
          newer: newer._id
        }
      }
    });
  } catch (error) {
    log.error('Error comparing exams', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to compare exams',
      error: error.message
    });
  }
};
