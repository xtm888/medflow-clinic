
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('DrGrading');
/**
 * Diabetic Retinopathy Grading Service
 * ETDRS (Early Treatment Diabetic Retinopathy Study) classification
 */

/**
 * ETDRS DR Grades
 */
const DR_GRADES = {
  10: { name: 'No DR', description: 'No retinopathy', followUp: '12 months', referPRP: false, referSurgery: false },
  20: { name: 'Minimal NPDR', description: 'Microaneurysms only', followUp: '12 months', referPRP: false, referSurgery: false },
  35: { name: 'Mild NPDR', description: 'Hard exudates, cotton wool spots, mild hemorrhages', followUp: '6-12 months', referPRP: false, referSurgery: false },
  43: { name: 'Moderate NPDR', description: 'Moderate hemorrhages/microaneurysms in 1-3 quadrants', followUp: '6 months', referPRP: false, referSurgery: false },
  47: { name: 'Moderately Severe NPDR', description: '4-2-1 rule approaching', followUp: '4 months', referPRP: false, referSurgery: false },
  53: { name: 'Severe NPDR', description: '4-2-1 rule met - hemorrhages 4Q OR VB 2Q OR IRMA 1Q', followUp: '2-4 months', referPRP: true, referSurgery: false },
  61: { name: 'Mild PDR', description: 'NVD or NVE present, not meeting high-risk', followUp: 'Urgent', referPRP: true, referSurgery: false },
  65: { name: 'Moderate PDR', description: 'NVD <1/4 disc area or NVE', followUp: 'Urgent', referPRP: true, referSurgery: false },
  71: { name: 'High-risk PDR', description: 'NVD ≥1/4 DA, NVD with VH, or NVE ≥1/2 DA with VH', followUp: 'Immediate', referPRP: true, referSurgery: false },
  81: { name: 'Advanced PDR', description: 'Fundus obscured, tractional RD, or severe VH', followUp: 'Immediate', referPRP: false, referSurgery: true }
};

/**
 * Calculate DR grade based on clinical findings
 * @param {Object} findings - Clinical findings object
 * @returns {Object} Grade information
 */
function calculateDRGrade(findings) {
  try {
    let grade = 10; // Start with no DR

    // Extract findings
    const hasMicroaneurysms = findings.microaneurysms?.present;
    const hasHemorrhages = findings.hemorrhages?.present;
    const hemorrhageQuadrants = findings.hemorrhages?.quadrants?.length || 0;
    const hasHardExudates = findings.hardExudates?.present;
    const hasCottonWool = findings.cottonWoolSpots?.present;
    const cottonWoolCount = findings.cottonWoolSpots?.count || 0;
    const hasIRMA = findings.IRMA?.present;
    const irmaQuadrants = findings.IRMA?.quadrants?.length || 0;
    const hasVenousBeading = findings.venousBeading?.present;
    const venousBeadingQuadrants = findings.venousBeading?.quadrants?.length || 0;
    const hasNVD = findings.NVD?.present;
    const nvdExtent = findings.NVD?.extent; // 'small' (<1/4 DA) or 'large' (≥1/4 DA)
    const hasNVE = findings.NVE?.present;
    const hasVH = findings.vitreousHemorrhage;
    const hasTractionalRD = findings.tractionalRD;

    // Apply ETDRS grading algorithm

    // Advanced PDR (Grade 81)
    if (hasTractionalRD || (hasVH && !hasNVD && !hasNVE)) {
      grade = 81;
    }
    // High-risk PDR (Grade 71) - NVD ≥1/4 DA, or any NV with VH
    else if ((hasNVD && nvdExtent === 'large') || (hasVH && (hasNVD || hasNVE))) {
      grade = 71;
    }
    // Moderate PDR (Grade 65) - NVD <1/4 DA without VH
    else if (hasNVD && nvdExtent === 'small') {
      grade = 65;
    }
    // Mild PDR (Grade 61) - NVE present
    else if (hasNVD || hasNVE) {
      grade = 61;
    }
    // Severe NPDR (Grade 53) - "4-2-1 rule"
    // Hemorrhages in all 4 quadrants OR VB in 2+ quadrants OR IRMA in 1+ quadrant
    else if (hemorrhageQuadrants >= 4 || venousBeadingQuadrants >= 2 || irmaQuadrants >= 1) {
      grade = 53;
    }
    // Moderately Severe NPDR (Grade 47) - Approaching 4-2-1
    else if (hemorrhageQuadrants >= 3 || venousBeadingQuadrants >= 1 || cottonWoolCount >= 5) {
      grade = 47;
    }
    // Moderate NPDR (Grade 43)
    else if (hemorrhageQuadrants >= 2 || cottonWoolCount >= 2 || (hasHardExudates && hasMicroaneurysms)) {
      grade = 43;
    }
    // Mild NPDR (Grade 35)
    else if (hasMicroaneurysms && (hasHemorrhages || hasCottonWool || hasHardExudates)) {
      grade = 35;
    }
    // Minimal NPDR (Grade 20)
    else if (hasMicroaneurysms) {
      grade = 20;
    }

    const gradeInfo = DR_GRADES[grade];

    return {
      grade,
      name: gradeInfo.name,
      description: gradeInfo.description,
      followUp: gradeInfo.followUp,
      referrals: [
        ...(gradeInfo.referPRP ? ['Retina specialist for panretinal photocoagulation (PRP)'] : []),
        ...(gradeInfo.referSurgery ? ['Vitreoretinal surgeon for surgical evaluation'] : [])
      ],
      severity: grade >= 61 ? 'PDR' : grade >= 35 ? 'NPDR' : grade === 20 ? 'Minimal NPDR' : 'None',
      isProliferative: grade >= 61,
      needsUrgentReferral: grade >= 53,
      fourTwoOneStatus: {
        hemorrhagesIn4Q: hemorrhageQuadrants >= 4,
        venousBeadingIn2Q: venousBeadingQuadrants >= 2,
        irmaIn1Q: irmaQuadrants >= 1,
        ruleMet: hemorrhageQuadrants >= 4 || venousBeadingQuadrants >= 2 || irmaQuadrants >= 1
      }
    };
  } catch (error) {
    log.error('Error calculating DR grade:', { error: error });
    throw new Error(`DR grading failed: ${error.message}`);
  }
}

/**
 * Assess Diabetic Macular Edema (DME)
 * @param {Object} findings - Macular findings
 * @param {Object} octData - OCT measurements (optional)
 * @returns {Object} DME assessment
 */
function assessDME(findings, octData = null) {
  try {
    let hasDME = false;
    let severity = 'None';
    let centerInvolved = false;
    let recommendation = 'No diabetic macular edema detected.';

    // OCT-based assessment (more accurate if available)
    if (octData && octData.centralSubfieldThickness) {
      const cst = octData.centralSubfieldThickness;

      // Normal CST is typically <280-300 μm depending on device
      if (cst > 400) {
        hasDME = true;
        centerInvolved = true;
        severity = 'Severe';
        recommendation = 'Severe center-involved DME. Urgent anti-VEGF therapy indicated. Consider intravitreal injection (aflibercept, ranibizumab, or bevacizumab).';
      } else if (cst > 350) {
        hasDME = true;
        centerInvolved = true;
        severity = 'Moderate';
        recommendation = 'Moderate center-involved DME. Anti-VEGF treatment recommended. Schedule for intravitreal injection.';
      } else if (cst > 300) {
        hasDME = true;
        centerInvolved = true;
        severity = 'Mild';
        recommendation = 'Mild center-involved DME. Consider anti-VEGF treatment or close monitoring with repeat OCT in 4-6 weeks.';
      } else if (octData.maculaVolume && octData.maculaVolume > 10) {
        hasDME = true;
        centerInvolved = false;
        severity = 'Mild';
        recommendation = 'Non-center involved DME detected. Monitor closely with repeat OCT in 3-4 months.';
      }
    }
    // Clinical (slit-lamp) assessment - CSME criteria
    else if (findings) {
      const hasThickening = findings.macularThickening;
      const hasExudates = findings.hardExudates?.present &&
                          findings.hardExudates?.location?.toLowerCase().includes('macula');
      const thickeningLocation = findings.thickeningLocation;

      // CSME Criteria (ETDRS):
      // 1. Thickening within 500μm of fovea center
      // 2. Hard exudates within 500μm of fovea with adjacent thickening
      // 3. Thickening ≥1 disc area within 1 disc diameter of fovea center

      if (hasThickening) {
        hasDME = true;

        if (thickeningLocation === 'central' || thickeningLocation === 'foveal') {
          centerInvolved = true;
          severity = 'Moderate'; // Default when no OCT
          recommendation = 'Clinically significant macular edema detected (thickening at/near fovea). OCT recommended for quantification. Consider anti-VEGF treatment.';
        } else if (hasExudates && (thickeningLocation === 'parafoveal' || thickeningLocation === 'perifoveal')) {
          centerInvolved = findings.exudatesNearFovea || false;
          severity = 'Mild';
          recommendation = 'DME with exudates detected. OCT recommended. Monitor for progression toward fovea.';
        } else if (findings.thickeningExtent === 'large') {
          centerInvolved = true;
          severity = 'Moderate';
          recommendation = 'Large area of macular thickening (≥1 disc area). OCT and treatment consideration required.';
        } else {
          severity = 'Mild';
          recommendation = 'Non-center involved DME. Monitor with OCT every 3-4 months.';
        }
      }
    }

    return {
      hasDME,
      severity,
      centerInvolved,
      recommendation,
      requiresOCT: !octData && hasDME,
      requiresTreatment: centerInvolved && severity !== 'None',
      treatmentOptions: centerInvolved ? [
        'Anti-VEGF injections (first-line)',
        'Intravitreal corticosteroids (if anti-VEGF insufficient)',
        'Focal/grid laser (adjunctive)'
      ] : []
    };
  } catch (error) {
    log.error('Error assessing DME:', { error: error });
    throw new Error(`DME assessment failed: ${error.message}`);
  }
}

/**
 * Generate clinical alert for DR findings
 * @param {String} patientId - Patient ID
 * @param {Object} drGrade - DR grade information
 * @param {Object} dmeStatus - DME assessment
 * @param {String} eye - 'OD' or 'OS'
 * @returns {Object|null} Alert object or null
 */
async function generateDRAlert(patientId, drGrade, dmeStatus, eye) {
  try {
    let alertNeeded = false;
    let severity = 'INFO';
    let code = 'DIABETES_SCREENING_DUE';
    let title = '';
    let message = '';
    const recommendedActions = [];

    // High-risk or Advanced PDR - EMERGENCY/URGENT
    if (drGrade.grade >= 71) {
      alertNeeded = true;
      severity = 'EMERGENCY';
      code = 'DR_HIGH_RISK_PDR';
      title = `High-Risk/Advanced PDR Detected - ${eye}`;
      message = `${drGrade.name}: ${drGrade.description}. Immediate retina specialist referral required.`;
      recommendedActions.push(
        { action: 'URGENT retina specialist referral', priority: 1 },
        { action: 'Consider immediate PRP or vitrectomy consultation', priority: 2 },
        { action: 'Anti-VEGF therapy evaluation', priority: 3 },
        { action: 'Patient education: warning signs of complications', priority: 4 }
      );
    }
    // Any PDR (Grade 61-65) - URGENT
    else if (drGrade.grade >= 61) {
      alertNeeded = true;
      severity = 'URGENT';
      code = 'DR_PDR_DETECTED';
      title = `Proliferative Diabetic Retinopathy - ${eye}`;
      message = `${drGrade.name}: ${drGrade.description}. PRP indicated to prevent progression.`;
      recommendedActions.push(
        { action: 'Urgent retina specialist referral for PRP', priority: 1 },
        { action: 'Schedule PRP within 2 weeks', priority: 2 },
        { action: 'Optimize glycemic control', priority: 3 },
        { action: 'Patient education on warning signs', priority: 4 }
      );
    }
    // Severe NPDR (Grade 53) - WARNING
    else if (drGrade.grade >= 53) {
      alertNeeded = true;
      severity = 'WARNING';
      code = 'DR_SEVERE_NPDR';
      title = `Severe Non-Proliferative DR - ${eye}`;
      message = `${drGrade.name}: High risk of progression to PDR within 1 year (>50%). Close monitoring required.`;
      recommendedActions.push(
        { action: 'Retina specialist referral recommended', priority: 1 },
        { action: 'Consider early/prophylactic PRP', priority: 2 },
        { action: 'Follow-up in 2-4 months', priority: 3 },
        { action: 'Intensify diabetes management', priority: 4 }
      );
    }
    // Moderately Severe NPDR (Grade 47) - WARNING
    else if (drGrade.grade >= 47) {
      alertNeeded = true;
      severity = 'WARNING';
      code = 'DR_MODERATELY_SEVERE_NPDR';
      title = `Moderately Severe NPDR - ${eye}`;
      message = 'Approaching severe NPDR (4-2-1 rule). Increased monitoring required.';
      recommendedActions.push(
        { action: 'Follow-up in 4 months', priority: 1 },
        { action: 'Consider retina specialist consultation', priority: 2 },
        { action: 'Optimize glycemic and blood pressure control', priority: 3 }
      );
    }

    // Center-involved DME - separate or additional alert
    if (dmeStatus.hasDME && dmeStatus.centerInvolved) {
      alertNeeded = true;
      if (severity !== 'EMERGENCY') {
        severity = 'URGENT';
      }
      code = 'DR_CENTER_INVOLVED_DME';
      title = title ? `${title} + Center-Involved DME` : `Center-Involved DME Detected - ${eye}`;
      message += ` ${dmeStatus.severity} DME affecting central vision requires treatment.`;

      if (!recommendedActions.some(a => a.action.toLowerCase().includes('retina'))) {
        recommendedActions.unshift({ action: 'Urgent retina specialist referral for anti-VEGF', priority: 1 });
      }
      recommendedActions.push(
        { action: 'OCT imaging to quantify macular thickening', priority: 2 },
        { action: 'Initiate anti-VEGF injection series', priority: 3 }
      );
    }

    if (!alertNeeded) return null;

    return {
      patient: patientId,
      severity,
      category: 'clinical',
      code,
      title,
      message,
      eye,
      triggerField: `diabeticRetinopathy.${eye}.grade`,
      triggerValue: `Grade ${drGrade.grade} - ${drGrade.name}`,
      recommendedActions,
      drGrade,
      dmeStatus
    };
  } catch (error) {
    log.error('Error generating DR alert:', { error: error });
    throw new Error(`Failed to generate DR alert: ${error.message}`);
  }
}

/**
 * Complete DR assessment
 */
async function performDRAssessment(patientId, findings, eye, examId, octData = null) {
  try {
    const drGrade = calculateDRGrade(findings);
    const dmeStatus = assessDME(findings, octData);
    const alert = await generateDRAlert(patientId, drGrade, dmeStatus, eye);

    return {
      drGrade,
      dmeStatus,
      alert,
      assessmentDate: new Date()
    };
  } catch (error) {
    log.error('Error in DR assessment:', { error: error });
    throw new Error(`DR assessment failed: ${error.message}`);
  }
}

module.exports = {
  calculateDRGrade,
  assessDME,
  generateDRAlert,
  performDRAssessment,
  DR_GRADES
};
