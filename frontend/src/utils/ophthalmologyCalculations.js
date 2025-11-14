// Comprehensive ophthalmology calculation utilities

/**
 * Calculate Spherical Equivalent
 * SE = Sphere + (Cylinder / 2)
 */
export const calculateSE = (sphere, cylinder) => {
  const se = parseFloat(sphere || 0) + (parseFloat(cylinder || 0) / 2);
  return se.toFixed(2);
};

/**
 * Vertex Distance Correction
 * Fc = F / (1 - dF)
 * Where: Fc = corrected power, F = original power, d = vertex distance in meters
 */
export const vertexCorrection = (power, vertexDistance = 12) => {
  const powerFloat = parseFloat(power || 0);

  // Only apply vertex correction for powers > ±4.00D
  if (Math.abs(powerFloat) <= 4.0) {
    return powerFloat.toFixed(2);
  }

  const d = vertexDistance / 1000; // Convert mm to meters
  const correctedPower = powerFloat / (1 - (d * powerFloat));

  return correctedPower.toFixed(2);
};

/**
 * Transpose Prescription
 * Convert between minus and plus cylinder formats
 */
export const transposePrescription = (sphere, cylinder, axis) => {
  const newSphere = parseFloat(sphere || 0) + parseFloat(cylinder || 0);
  const newCylinder = -parseFloat(cylinder || 0);
  const newAxis = (parseFloat(axis || 0) + 90) % 180 || 180;

  return {
    sphere: newSphere.toFixed(2),
    cylinder: newCylinder.toFixed(2),
    axis: newAxis
  };
};

/**
 * Format Prescription for Display/Print
 */
export const formatPrescription = (prescription) => {
  const formatEye = (eye) => {
    if (!eye) return 'N/A';

    const { sphere, cylinder, axis } = eye;
    const sph = parseFloat(sphere || 0);
    const cyl = parseFloat(cylinder || 0);
    const ax = parseFloat(axis || 0);

    // Format sphere
    const sphStr = sph === 0 ? 'Plano' :
                   sph > 0 ? `+${sph.toFixed(2)}` :
                   sph.toFixed(2);

    // Format cylinder
    const cylStr = cyl === 0 ? '' :
                   cyl > 0 ? `+${cyl.toFixed(2)}` :
                   cyl.toFixed(2);

    // Build prescription string
    if (cylStr === '') {
      return `${sphStr} DS`;
    } else {
      return `${sphStr} ${cylStr} x ${ax}°`;
    }
  };

  if (!prescription) return { OD: 'N/A', OS: 'N/A', SE_OD: '0.00', SE_OS: '0.00' };

  return {
    OD: formatEye(prescription.OD),
    OS: formatEye(prescription.OS),
    SE_OD: calculateSE(prescription.OD?.sphere, prescription.OD?.cylinder),
    SE_OS: calculateSE(prescription.OS?.sphere, prescription.OS?.cylinder)
  };
};

/**
 * Calculate IOL Power using various formulas
 */
export const iolCalculations = {
  // SRK/T Formula
  srkT: (axialLength, k1, k2, targetRefraction = 0) => {
    const al = parseFloat(axialLength || 0);
    const avgK = (parseFloat(k1 || 0) + parseFloat(k2 || 0)) / 2;
    const aConstant = 118.4; // Default A-constant

    // SRK/T calculation
    const iolPower = aConstant - (2.5 * al) - (0.9 * avgK) + targetRefraction;

    return {
      formula: 'SRK/T',
      iolPower: iolPower.toFixed(1),
      avgK: avgK.toFixed(2),
      aConstant
    };
  },

  // Hoffer Q Formula
  hofferQ: (axialLength, k1, k2, targetRefraction = 0) => {
    const al = parseFloat(axialLength || 0);
    const avgK = (parseFloat(k1 || 0) + parseFloat(k2 || 0)) / 2;
    const pACD = 5.25; // Personalized ACD

    // Simplified Hoffer Q calculation
    const iolPower = (1336 / (al - pACD - 0.05)) -
                     (1.336 / ((1.336 / (avgK + targetRefraction)) -
                     ((pACD + 0.05) / 1000)));

    return {
      formula: 'Hoffer Q',
      iolPower: isNaN(iolPower) ? '0.0' : iolPower.toFixed(1),
      avgK: avgK.toFixed(2),
      pACD
    };
  },

  // Holladay 1 Formula
  holladay1: (axialLength, k1, k2, targetRefraction = 0) => {
    const al = parseFloat(axialLength || 0);
    const avgK = (parseFloat(k1 || 0) + parseFloat(k2 || 0)) / 2;
    const sf = 1.67; // Surgeon factor

    // Simplified Holladay 1 calculation
    const r = avgK > 0 ? 337.5 / avgK : 0;
    const ag = al * 0.66 + 2;
    const iolPower = avgK > 0 ?
      (1336 * ((1.336 - (ag / r)) - targetRefraction)) /
      ((al - ag) * (1.336 - (ag / r))) : 0;

    return {
      formula: 'Holladay 1',
      iolPower: isNaN(iolPower) ? '0.0' : iolPower.toFixed(1),
      avgK: avgK.toFixed(2),
      surgeonFactor: sf
    };
  }
};

/**
 * Calculate Keratometric Astigmatism
 */
export const calculateKeratometricAstigmatism = (k1Power, k1Axis, k2Power, k2Axis) => {
  const diff = Math.abs(parseFloat(k1Power || 0) - parseFloat(k2Power || 0));
  const axis = parseFloat(k1Power || 0) > parseFloat(k2Power || 0) ? k1Axis : k2Axis;

  return {
    magnitude: diff.toFixed(2),
    axis: axis,
    type: diff < 1.0 ? 'Faible' : diff < 2.5 ? 'Modéré' : 'Élevé'
  };
};

/**
 * Validate Refraction Values
 */
export const validateRefraction = (sphere, cylinder, axis) => {
  const errors = [];
  const sph = parseFloat(sphere || 0);
  const cyl = parseFloat(cylinder || 0);
  const ax = parseFloat(axis || 0);

  // Validate sphere
  if (Math.abs(sph) > 30) {
    errors.push({ field: 'sphere', message: 'Sphère hors limites (>±30.00D)' });
  }

  // Validate cylinder
  if (Math.abs(cyl) > 10) {
    errors.push({ field: 'cylinder', message: 'Cylindre hors limites (>±10.00D)' });
  }

  // Validate axis
  if (cyl !== 0) {
    if (ax < 1 || ax > 180) {
      errors.push({ field: 'axis', message: 'Axe doit être entre 1° et 180°' });
    }
  }

  // Check if axis is needed
  if (cyl !== 0 && !ax) {
    errors.push({ field: 'axis', message: 'Axe requis pour cylindre non-zéro' });
  }

  return errors;
};

/**
 * Calculate Reading Addition for Presbyopia
 */
export const calculateReadingAdd = (age, workingDistance = 40) => {
  const ageNum = parseInt(age || 0);

  // Hofstetter's formula for amplitude of accommodation
  const minAmplitude = Math.max(0, 15 - (0.25 * ageNum));
  const averageAmplitude = Math.max(0, 18.5 - (0.3 * ageNum));

  // Calculate required accommodation for working distance
  const requiredAccommodation = 100 / workingDistance; // in diopters

  // Calculate add power needed
  const usableAmplitude = averageAmplitude / 2; // Use half of available amplitude
  const addPower = Math.max(0, requiredAccommodation - usableAmplitude);

  // Standard adds by age
  const standardAdd = ageNum < 40 ? 0 :
                     ageNum < 45 ? 0.75 :
                     ageNum < 50 ? 1.50 :
                     ageNum < 55 ? 2.00 :
                     ageNum < 60 ? 2.25 : 2.50;

  return {
    calculated: addPower.toFixed(2),
    standard: standardAdd.toFixed(2),
    recommended: standardAdd.toFixed(2)
  };
};

/**
 * Convert Visual Acuity between formats
 */
export const convertVisualAcuity = {
  snellenToLogMAR: (snellen) => {
    if (!snellen || !snellen.includes('/')) return '0.00';
    // Parse Snellen format (e.g., "20/20", "20/40")
    const [distance, size] = snellen.split('/').map(Number);
    if (!distance || !size) return '0.00';
    const decimal = distance / size;
    const logMAR = -Math.log10(decimal);
    return logMAR.toFixed(2);
  },

  logMARToSnellen: (logMAR) => {
    const logMARNum = parseFloat(logMAR || 0);
    const decimal = Math.pow(10, -logMARNum);
    const size = Math.round(20 / decimal);
    return `20/${size}`;
  },

  snellenToDecimal: (snellen) => {
    if (!snellen || !snellen.includes('/')) return '1.00';
    const [distance, size] = snellen.split('/').map(Number);
    if (!distance || !size) return '1.00';
    return (distance / size).toFixed(2);
  }
};

/**
 * Calculate Aniseikonia (Image size difference)
 */
export const calculateAniseikonia = (odPower, osPower, vertexDistance = 12) => {
  const odPowerNum = parseFloat(odPower || 0);
  const osPowerNum = parseFloat(osPower || 0);
  const vd = vertexDistance / 1000; // Convert to meters

  const magnificationOD = 1 / (1 - vd * odPowerNum);
  const magnificationOS = 1 / (1 - vd * osPowerNum);

  const percentDifference = Math.abs((magnificationOD - magnificationOS) / magnificationOS * 100);

  return {
    magnificationOD: magnificationOD.toFixed(3),
    magnificationOS: magnificationOS.toFixed(3),
    percentDifference: percentDifference.toFixed(1),
    symptomatic: percentDifference > 3 // Usually symptomatic if >3%
  };
};

/**
 * Calculate Prismatic Effect
 * P = cF where c = decentration in cm, F = lens power
 */
export const calculatePrism = (power, decentration) => {
  const powerNum = parseFloat(power || 0);
  const decentrationCm = parseFloat(decentration || 0) / 10; // Convert mm to cm
  const prism = Math.abs(powerNum * decentrationCm);
  return prism.toFixed(2);
};

/**
 * Calculate Magnification
 */
export const calculateMagnification = (power, vertexDistance = 12) => {
  const powerNum = parseFloat(power || 0);
  const vd = vertexDistance / 1000; // Convert to meters
  const magnification = 1 / (1 - vd * powerNum);
  const percentMag = (magnification - 1) * 100;
  return {
    magnification: magnification.toFixed(3),
    percent: percentMag.toFixed(1)
  };
};

/**
 * Determine Lens Thickness
 */
export const estimateLensThickness = (power, index, diameter = 70) => {
  const powerNum = parseFloat(power || 0);
  const n = parseFloat(index || 1.5);
  const d = diameter; // in mm

  // Simplified thickness calculation
  const centerThickness = Math.abs(powerNum) < 4 ? 2 :
                          Math.abs(powerNum) < 8 ? 3 : 4;

  // Edge thickness for minus lenses
  const edgeThickness = powerNum < 0 ?
    centerThickness + Math.abs(powerNum * d * d / (2000 * (n - 1))) :
    centerThickness;

  return {
    center: centerThickness.toFixed(1),
    edge: edgeThickness.toFixed(1),
    unit: 'mm'
  };
};