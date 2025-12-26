/**
 * Clinical Validation Utility
 *
 * Provides validation bounds and helpers for ophthalmological measurements.
 * Based on standard clinical ranges used in ophthalmology practice.
 */

// ============================================
// CLINICAL BOUNDS CONSTANTS
// ============================================

const CLINICAL_BOUNDS = {
  // Intraocular Pressure (mmHg)
  iop: {
    min: 0,
    max: 60,
    normalMin: 10,
    normalMax: 21,
    unit: 'mmHg'
  },

  // Refraction - Sphere (Diopters)
  sphere: {
    min: -25.0,
    max: +25.0,
    step: 0.25,
    unit: 'D'
  },

  // Refraction - Cylinder (Diopters)
  cylinder: {
    min: -10.0,
    max: +10.0,
    step: 0.25,
    unit: 'D'
  },

  // Refraction - Axis (Degrees)
  axis: {
    min: 0,
    max: 180,
    step: 1,
    unit: '°'
  },

  // Addition (Diopters) - for near vision
  addition: {
    min: 0.25,
    max: 4.00,
    step: 0.25,
    unit: 'D'
  },

  // Pupillary Distance (mm)
  pd: {
    binocular: { min: 50, max: 80 },
    monocular: { min: 25, max: 40 },
    unit: 'mm'
  },

  // Cup-to-Disc Ratio
  cupDiscRatio: {
    min: 0.0,
    max: 1.0,
    warningThreshold: 0.5,
    criticalThreshold: 0.7
  },

  // Central Corneal Thickness (microns)
  cct: {
    min: 400,
    max: 700,
    normalMin: 500,
    normalMax: 580,
    unit: 'μm'
  },

  // Pachymetry (microns) - same as CCT
  pachymetry: {
    min: 400,
    max: 700,
    unit: 'μm'
  },

  // Keratometry (Diopters)
  keratometry: {
    min: 35.0,
    max: 55.0,
    normalMin: 42.0,
    normalMax: 46.0,
    unit: 'D'
  },

  // Axial Length (mm)
  axialLength: {
    min: 18.0,
    max: 35.0,
    normalMin: 22.0,
    normalMax: 24.5,
    unit: 'mm'
  },

  // Visual Field - Mean Deviation (dB)
  visualFieldMD: {
    min: -35.0,
    max: 3.0,
    warningThreshold: -6.0,
    criticalThreshold: -12.0,
    unit: 'dB'
  },

  // Visual Field - Pattern Standard Deviation (dB)
  visualFieldPSD: {
    min: 0.0,
    max: 20.0,
    warningThreshold: 3.5,
    unit: 'dB'
  },

  // RNFL Thickness (microns)
  rnfl: {
    min: 30,
    max: 200,
    warningThreshold: 80,
    criticalThreshold: 60,
    unit: 'μm'
  },

  // Anterior Chamber Depth (mm)
  acd: {
    min: 1.5,
    max: 5.0,
    warningThreshold: 2.0,
    unit: 'mm'
  },

  // Prism (Prism Diopters)
  prism: {
    min: 0,
    max: 20,
    unit: 'Δ'
  }
};

// ============================================
// VISUAL ACUITY SCALES
// ============================================

// Monoyer scale for distance vision (France)
const MONOYER_VALUES = [
  '10/10', '9/10', '8/10', '7/10', '6/10', '5/10',
  '4/10', '3/10', '2/10', '1/10', '1/20', '1/50',
  'CLD', 'VBLM', 'PL+', 'PL-'
];

// Parinaud scale for near vision (France)
const PARINAUD_VALUES = [
  'P1.5', 'P2', 'P3', 'P4', 'P5', 'P6',
  'P8', 'P10', 'P14', 'P20'
];

// LogMAR values for conversion
const LOGMAR_VALUES = [
  0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.3, 1.7, 2.0, 3.0
];

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate a value is within clinical bounds
 * @param {string} fieldName - The clinical field name (e.g., 'iop', 'sphere')
 * @param {number} value - The value to validate
 * @returns {Object} { valid, warning, error, message }
 */
function validateClinicalValue(fieldName, value) {
  const bounds = CLINICAL_BOUNDS[fieldName];

  if (!bounds) {
    return { valid: true, warning: false, error: false };
  }

  if (value === null || value === undefined) {
    return { valid: true, warning: false, error: false };
  }

  const result = {
    valid: true,
    warning: false,
    error: false,
    value,
    bounds: { min: bounds.min, max: bounds.max },
    unit: bounds.unit
  };

  // Check absolute bounds
  if (value < bounds.min || value > bounds.max) {
    result.valid = false;
    result.error = true;
    result.message = `${fieldName} hors limites: ${value} ${bounds.unit || ''} (plage valide: ${bounds.min}-${bounds.max})`;
    return result;
  }

  // Check warning thresholds if defined
  if (bounds.warningThreshold !== undefined) {
    if (fieldName === 'cupDiscRatio' || fieldName === 'visualFieldPSD') {
      if (value >= bounds.warningThreshold) {
        result.warning = true;
        result.message = `${fieldName} élevé: ${value} ${bounds.unit || ''}`;
      }
    } else if (fieldName === 'visualFieldMD' || fieldName === 'rnfl') {
      if (value <= bounds.warningThreshold) {
        result.warning = true;
        result.message = `${fieldName} bas: ${value} ${bounds.unit || ''}`;
      }
    }
  }

  // Check critical thresholds if defined
  if (bounds.criticalThreshold !== undefined) {
    if (fieldName === 'cupDiscRatio') {
      if (value >= bounds.criticalThreshold) {
        result.warning = true;
        result.critical = true;
        result.message = `${fieldName} critique: ${value} - Suspicion de glaucome`;
      }
    } else if (fieldName === 'rnfl') {
      if (value <= bounds.criticalThreshold) {
        result.warning = true;
        result.critical = true;
        result.message = `${fieldName} critique: ${value} ${bounds.unit || ''} - Amincissement sévère`;
      }
    } else if (fieldName === 'visualFieldMD') {
      if (value <= bounds.criticalThreshold) {
        result.warning = true;
        result.critical = true;
        result.message = `${fieldName} critique: ${value} ${bounds.unit || ''} - Perte de champ visuel modérée à sévère`;
      }
    }
  }

  // Check normal range for IOP
  if (fieldName === 'iop' && bounds.normalMax) {
    if (value > bounds.normalMax) {
      result.warning = true;
      result.message = `PIO élevée: ${value} ${bounds.unit} (normale: ${bounds.normalMin}-${bounds.normalMax})`;
    }
  }

  return result;
}

/**
 * Validate IOP with clinical interpretation
 */
function validateIOP(value, method = null) {
  const result = validateClinicalValue('iop', value);

  if (result.valid && value !== null && value !== undefined) {
    // Clinical interpretation
    if (value <= 10) {
      result.interpretation = 'Hypotonie';
      result.warning = true;
    } else if (value > 21 && value <= 24) {
      result.interpretation = 'Limite supérieure';
      result.warning = true;
    } else if (value > 24 && value <= 30) {
      result.interpretation = 'Hypertonie oculaire';
      result.warning = true;
    } else if (value > 30) {
      result.interpretation = 'Urgence - PIO très élevée';
      result.critical = true;
      result.warning = true;
    } else {
      result.interpretation = 'Normal';
    }
  }

  return result;
}

/**
 * Validate refraction values (sphere, cylinder, axis)
 */
function validateRefraction(refraction) {
  const errors = [];
  const warnings = [];

  if (refraction.sphere !== null && refraction.sphere !== undefined) {
    const sphereResult = validateClinicalValue('sphere', refraction.sphere);
    if (sphereResult.error) errors.push(sphereResult.message);
  }

  if (refraction.cylinder !== null && refraction.cylinder !== undefined) {
    const cylinderResult = validateClinicalValue('cylinder', refraction.cylinder);
    if (cylinderResult.error) errors.push(cylinderResult.message);
  }

  if (refraction.axis !== null && refraction.axis !== undefined) {
    const axisResult = validateClinicalValue('axis', refraction.axis);
    if (axisResult.error) errors.push(axisResult.message);

    // Axis should be 0 if no cylinder
    if (refraction.cylinder === 0 && refraction.axis !== 0 && refraction.axis !== null) {
      warnings.push('Axe défini sans cylindre');
    }
  }

  if (refraction.add !== null && refraction.add !== undefined) {
    const addResult = validateClinicalValue('addition', refraction.add);
    if (addResult.error) errors.push(addResult.message);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate visual acuity value
 */
function validateVisualAcuity(value, scale = 'monoyer') {
  if (!value) return { valid: true };

  const normalizedValue = value.toString().trim().toUpperCase();

  if (scale === 'monoyer') {
    const isValid = MONOYER_VALUES.some(v =>
      v.toUpperCase() === normalizedValue ||
      normalizedValue.replace(/\s/g, '') === v.replace(/\s/g, '').toUpperCase()
    );
    return {
      valid: isValid,
      error: !isValid,
      message: isValid ? null : `Valeur Monoyer invalide: ${value}`
    };
  }

  if (scale === 'parinaud') {
    const isValid = PARINAUD_VALUES.some(v =>
      v.toUpperCase() === normalizedValue
    );
    return {
      valid: isValid,
      error: !isValid,
      message: isValid ? null : `Valeur Parinaud invalide: ${value}`
    };
  }

  return { valid: true };
}

/**
 * Validate an ophthalmology exam object
 */
function validateOphthalmologyExam(exam) {
  const errors = [];
  const warnings = [];
  const criticalAlerts = [];

  // Validate IOP
  if (exam.iop) {
    if (exam.iop.OD?.value !== undefined) {
      const odResult = validateIOP(exam.iop.OD.value);
      if (odResult.error) errors.push(`OD: ${odResult.message}`);
      if (odResult.critical) criticalAlerts.push(`OD: ${odResult.interpretation}`);
      else if (odResult.warning) warnings.push(`OD: ${odResult.interpretation || odResult.message}`);
    }
    if (exam.iop.OS?.value !== undefined) {
      const osResult = validateIOP(exam.iop.OS.value);
      if (osResult.error) errors.push(`OS: ${osResult.message}`);
      if (osResult.critical) criticalAlerts.push(`OS: ${osResult.interpretation}`);
      else if (osResult.warning) warnings.push(`OS: ${osResult.interpretation || osResult.message}`);
    }
  }

  // Validate refraction
  if (exam.refraction?.finalPrescription) {
    const fp = exam.refraction.finalPrescription;
    if (fp.OD) {
      const odResult = validateRefraction(fp.OD);
      errors.push(...odResult.errors.map(e => `OD: ${e}`));
      warnings.push(...odResult.warnings.map(w => `OD: ${w}`));
    }
    if (fp.OS) {
      const osResult = validateRefraction(fp.OS);
      errors.push(...osResult.errors.map(e => `OS: ${e}`));
      warnings.push(...osResult.warnings.map(w => `OS: ${w}`));
    }
  }

  // Validate CDR
  if (exam.posteriorSegment) {
    ['OD', 'OS'].forEach(eye => {
      const cdr = exam.posteriorSegment[eye]?.opticNerve?.cupDiscRatio;
      if (cdr !== undefined && cdr !== null) {
        const result = validateClinicalValue('cupDiscRatio', cdr);
        if (result.critical) criticalAlerts.push(`${eye}: ${result.message}`);
        else if (result.warning) warnings.push(`${eye}: ${result.message}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    criticalAlerts,
    hasCriticalAlerts: criticalAlerts.length > 0
  };
}

/**
 * Clamp a value to clinical bounds
 */
function clampToClinicalBounds(fieldName, value) {
  const bounds = CLINICAL_BOUNDS[fieldName];
  if (!bounds || value === null || value === undefined) {
    return value;
  }
  return Math.max(bounds.min, Math.min(bounds.max, value));
}

/**
 * Round refraction value to nearest step (0.25 D)
 */
function roundToRefractionStep(value, step = 0.25) {
  if (value === null || value === undefined) return value;
  return Math.round(value / step) * step;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  CLINICAL_BOUNDS,
  MONOYER_VALUES,
  PARINAUD_VALUES,
  LOGMAR_VALUES,

  // Validation functions
  validateClinicalValue,
  validateIOP,
  validateRefraction,
  validateVisualAcuity,
  validateOphthalmologyExam,

  // Utility functions
  clampToClinicalBounds,
  roundToRefractionStep
};
