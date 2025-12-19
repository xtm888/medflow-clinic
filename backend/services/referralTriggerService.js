/**
 * Automated Specialist Referral Trigger Service
 * Generates referral recommendations based on clinical findings
 */

const ClinicalAlert = require('../models/ClinicalAlert');
const Patient = require('../models/Patient');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ReferralTrigger');

/**
 * Referral Trigger Rules by Specialty
 */
const REFERRAL_TRIGGERS = {
  retina: {
    conditions: [
      { code: 'PDR', description: 'Proliferative diabetic retinopathy', urgency: 'URGENT' },
      { code: 'SEVERE_NPDR', description: 'Severe non-proliferative DR (4-2-1 rule)', urgency: 'SOON' },
      { code: 'CI_DME', description: 'Center-involved diabetic macular edema', urgency: 'URGENT' },
      { code: 'WET_AMD', description: 'Wet age-related macular degeneration', urgency: 'URGENT' },
      { code: 'RVO', description: 'Retinal vein occlusion with macular edema', urgency: 'URGENT' },
      { code: 'RD', description: 'Retinal detachment or high-risk tear', urgency: 'EMERGENCY' },
      { code: 'VITREOUS_HEMORRHAGE', description: 'Dense vitreous hemorrhage', urgency: 'URGENT' },
      { code: 'MACULAR_HOLE', description: 'Macular hole', urgency: 'SOON' },
      { code: 'ERM', description: 'Symptomatic epiretinal membrane', urgency: 'ROUTINE' },
      { code: 'CME', description: 'Cystoid macular edema', urgency: 'SOON' }
    ],
    defaultUrgency: 'ROUTINE',
    contactInfo: 'Retina Specialist'
  },

  glaucoma: {
    conditions: [
      { code: 'ACUTE_ACG', description: 'Acute angle closure glaucoma', urgency: 'EMERGENCY' },
      { code: 'UNCONTROLLED_IOP', description: 'IOP > 30 mmHg despite max medical therapy', urgency: 'URGENT' },
      { code: 'RAPID_VF_LOSS', description: 'Rapid visual field progression (> 1.5 dB/year)', urgency: 'URGENT' },
      { code: 'SEVERE_RNFL_THIN', description: 'Severe RNFL thinning with VF correlation', urgency: 'SOON' },
      { code: 'NTG_PROGRESSION', description: 'Progressing normal tension glaucoma', urgency: 'SOON' },
      { code: 'PSEUDOEXFOLIATION', description: 'Pseudoexfoliation with high IOP', urgency: 'SOON' },
      { code: 'PIGMENT_DISPERSION', description: 'Pigment dispersion syndrome with IOP spikes', urgency: 'SOON' },
      { code: 'JUVENILE_GLAUCOMA', description: 'Juvenile open angle glaucoma', urgency: 'URGENT' },
      { code: 'CONGENITAL_GLAUCOMA', description: 'Congenital/infantile glaucoma', urgency: 'EMERGENCY' }
    ],
    defaultUrgency: 'ROUTINE',
    contactInfo: 'Glaucoma Specialist'
  },

  cornea: {
    conditions: [
      { code: 'CORNEAL_PERFORATION', description: 'Corneal perforation or impending perforation', urgency: 'EMERGENCY' },
      { code: 'MICROBIAL_KERATITIS', description: 'Severe microbial keratitis', urgency: 'URGENT' },
      { code: 'CORNEAL_ULCER', description: 'Central corneal ulcer', urgency: 'URGENT' },
      { code: 'KERATOCONUS_ADVANCED', description: 'Advanced keratoconus requiring CXL or transplant', urgency: 'SOON' },
      { code: 'FUCHS_DYSTROPHY', description: 'Fuchs dystrophy with corneal decompensation', urgency: 'SOON' },
      { code: 'GRAFT_REJECTION', description: 'Corneal graft rejection', urgency: 'URGENT' },
      { code: 'CHEMICAL_BURN', description: 'Chemical/thermal corneal injury', urgency: 'EMERGENCY' },
      { code: 'PTERYGIUM', description: 'Pterygium approaching visual axis', urgency: 'ROUTINE' }
    ],
    defaultUrgency: 'ROUTINE',
    contactInfo: 'Cornea Specialist'
  },

  oculoplastics: {
    conditions: [
      { code: 'ORBITAL_CELLULITIS', description: 'Orbital cellulitis', urgency: 'EMERGENCY' },
      { code: 'ORBITAL_TUMOR', description: 'Suspected orbital tumor/mass', urgency: 'URGENT' },
      { code: 'THYROID_EYE_DISEASE', description: 'Active thyroid eye disease with optic neuropathy', urgency: 'URGENT' },
      { code: 'DACRYOCYSTITIS', description: 'Acute dacryocystitis', urgency: 'URGENT' },
      { code: 'EYELID_MALIGNANCY', description: 'Suspected eyelid malignancy', urgency: 'SOON' },
      { code: 'PTOSIS', description: 'Ptosis affecting vision or cosmesis', urgency: 'ROUTINE' },
      { code: 'ENTROPION_ECTROPION', description: 'Entropion/ectropion with corneal exposure', urgency: 'SOON' },
      { code: 'LACRIMAL_OBSTRUCTION', description: 'Lacrimal drainage obstruction', urgency: 'ROUTINE' }
    ],
    defaultUrgency: 'ROUTINE',
    contactInfo: 'Oculoplastics Specialist'
  },

  pediatricOphthalmology: {
    conditions: [
      { code: 'LEUKOCORIA', description: 'Leukocoria (rule out retinoblastoma)', urgency: 'EMERGENCY' },
      { code: 'CONGENITAL_CATARACT', description: 'Congenital cataract', urgency: 'URGENT' },
      { code: 'INFANTILE_ESOTROPIA', description: 'Infantile esotropia', urgency: 'SOON' },
      { code: 'AMBLYOPIA', description: 'Amblyopia requiring treatment', urgency: 'SOON' },
      { code: 'ROP', description: 'Retinopathy of prematurity screening', urgency: 'URGENT' },
      { code: 'PEDIATRIC_GLAUCOMA', description: 'Pediatric glaucoma', urgency: 'URGENT' },
      { code: 'STRABISMUS', description: 'Strabismus', urgency: 'ROUTINE' },
      { code: 'NASOLACRIMAL_OBSTRUCTION', description: 'Congenital nasolacrimal obstruction > 12 months', urgency: 'ROUTINE' }
    ],
    defaultUrgency: 'ROUTINE',
    contactInfo: 'Pediatric Ophthalmologist'
  },

  neuroOphthalmology: {
    conditions: [
      { code: 'PAPILLEDEMA', description: 'Papilledema (rule out intracranial pressure)', urgency: 'EMERGENCY' },
      { code: 'OPTIC_NEURITIS', description: 'Acute optic neuritis', urgency: 'URGENT' },
      { code: 'GIANT_CELL_ARTERITIS', description: 'Suspected giant cell arteritis', urgency: 'EMERGENCY' },
      { code: 'CRANIAL_NERVE_PALSY', description: 'New cranial nerve palsy', urgency: 'URGENT' },
      { code: 'HOMONYMOUS_HEMIANOPIA', description: 'Homonymous visual field defect', urgency: 'URGENT' },
      { code: 'NYSTAGMUS', description: 'New-onset nystagmus', urgency: 'SOON' },
      { code: 'OPTIC_ATROPHY', description: 'Unexplained optic atrophy', urgency: 'SOON' },
      { code: 'IIH', description: 'Idiopathic intracranial hypertension', urgency: 'URGENT' }
    ],
    defaultUrgency: 'SOON',
    contactInfo: 'Neuro-Ophthalmologist'
  },

  internal: {
    conditions: [
      { code: 'UNCONTROLLED_DM', description: 'Uncontrolled diabetes (HbA1c > 9%)', urgency: 'SOON' },
      { code: 'HYPERTENSIVE_RETINOPATHY', description: 'Severe hypertensive retinopathy', urgency: 'URGENT' },
      { code: 'SYSTEMIC_VASCULITIS', description: 'Ocular signs of systemic vasculitis', urgency: 'URGENT' },
      { code: 'SARCOIDOSIS', description: 'Suspected ocular sarcoidosis', urgency: 'SOON' },
      { code: 'HIV_RETINOPATHY', description: 'HIV-related eye disease', urgency: 'SOON' },
      { code: 'DRUG_TOXICITY', description: 'Medication toxicity (hydroxychloroquine, ethambutol)', urgency: 'SOON' }
    ],
    defaultUrgency: 'ROUTINE',
    contactInfo: 'Internal Medicine/Specialist'
  }
};

/**
 * Urgency definitions with timeframes
 */
const URGENCY_LEVELS = {
  EMERGENCY: {
    level: 1,
    description: 'Same day / Immediate',
    maxDays: 0,
    color: 'red'
  },
  URGENT: {
    level: 2,
    description: 'Within 24-48 hours',
    maxDays: 2,
    color: 'orange'
  },
  SOON: {
    level: 3,
    description: 'Within 1-2 weeks',
    maxDays: 14,
    color: 'yellow'
  },
  ROUTINE: {
    level: 4,
    description: 'Within 1-3 months',
    maxDays: 90,
    color: 'green'
  }
};

/**
 * Evaluate clinical findings for referral triggers
 * @param {Object} clinicalData - Clinical examination data
 * @returns {Array} Array of triggered referrals
 */
function evaluateReferralTriggers(clinicalData) {
  const triggeredReferrals = [];

  // Check IOP triggers
  if (clinicalData.iop) {
    const maxIOP = Math.max(clinicalData.iop.od || 0, clinicalData.iop.os || 0);
    if (maxIOP > 40) {
      triggeredReferrals.push({
        specialty: 'glaucoma',
        code: 'ACUTE_ACG',
        urgency: 'EMERGENCY',
        reason: `Critical IOP elevation: ${maxIOP} mmHg`,
        findings: { iop: clinicalData.iop }
      });
    } else if (maxIOP > 30) {
      triggeredReferrals.push({
        specialty: 'glaucoma',
        code: 'UNCONTROLLED_IOP',
        urgency: 'URGENT',
        reason: `Elevated IOP: ${maxIOP} mmHg`,
        findings: { iop: clinicalData.iop }
      });
    }
  }

  // Check DR triggers
  if (clinicalData.diabeticRetinopathy) {
    const dr = clinicalData.diabeticRetinopathy;

    for (const eye of ['od', 'os']) {
      const drData = dr[eye];
      if (!drData) continue;

      if (drData.grade >= 61) { // PDR
        triggeredReferrals.push({
          specialty: 'retina',
          code: 'PDR',
          urgency: 'URGENT',
          reason: `Proliferative diabetic retinopathy detected (${eye.toUpperCase()})`,
          eye: eye.toUpperCase(),
          findings: drData
        });
      } else if (drData.grade >= 53) { // Severe NPDR
        triggeredReferrals.push({
          specialty: 'retina',
          code: 'SEVERE_NPDR',
          urgency: 'SOON',
          reason: `Severe NPDR with high progression risk (${eye.toUpperCase()})`,
          eye: eye.toUpperCase(),
          findings: drData
        });
      }

      // DME check
      if (drData.dme?.centerInvolved) {
        triggeredReferrals.push({
          specialty: 'retina',
          code: 'CI_DME',
          urgency: 'URGENT',
          reason: `Center-involved diabetic macular edema (${eye.toUpperCase()})`,
          eye: eye.toUpperCase(),
          findings: drData.dme
        });
      }
    }
  }

  // Check RNFL triggers
  if (clinicalData.rnflAnalysis) {
    for (const eye of ['od', 'os']) {
      const rnfl = clinicalData.rnflAnalysis[eye];
      if (!rnfl) continue;

      if (rnfl.severity === 'SEVERE') {
        triggeredReferrals.push({
          specialty: 'glaucoma',
          code: 'SEVERE_RNFL_THIN',
          urgency: 'SOON',
          reason: `Severe RNFL thinning detected (${eye.toUpperCase()})`,
          eye: eye.toUpperCase(),
          findings: rnfl
        });
      }

      if (rnfl.progression?.isProgressing && rnfl.progression?.progressionRate >= 1.5) {
        triggeredReferrals.push({
          specialty: 'glaucoma',
          code: 'RAPID_VF_LOSS',
          urgency: 'URGENT',
          reason: `Rapid RNFL progression: ${rnfl.progression.progressionRate} μm/year (${eye.toUpperCase()})`,
          eye: eye.toUpperCase(),
          findings: rnfl.progression
        });
      }
    }
  }

  // Check GPA/Visual Field triggers
  if (clinicalData.gpaAnalysis) {
    for (const eye of ['od', 'os']) {
      const gpa = clinicalData.gpaAnalysis[eye];
      if (!gpa) continue;

      if (gpa.progressionStatus?.status === 'RAPID_PROGRESSION') {
        triggeredReferrals.push({
          specialty: 'glaucoma',
          code: 'RAPID_VF_LOSS',
          urgency: 'URGENT',
          reason: `Rapid visual field progression detected (${eye.toUpperCase()})`,
          eye: eye.toUpperCase(),
          findings: gpa
        });
      }
    }
  }

  // Check fundus findings
  if (clinicalData.fundus) {
    const fundus = clinicalData.fundus;

    // Retinal detachment
    if (fundus.retinalDetachment || fundus.retinalTear) {
      triggeredReferrals.push({
        specialty: 'retina',
        code: 'RD',
        urgency: 'EMERGENCY',
        reason: 'Retinal detachment or tear detected',
        findings: fundus
      });
    }

    // Wet AMD signs
    if (fundus.subretinalFluid || fundus.cnvm || fundus.hemorrhage) {
      triggeredReferrals.push({
        specialty: 'retina',
        code: 'WET_AMD',
        urgency: 'URGENT',
        reason: 'Signs suggestive of wet AMD (subretinal fluid/hemorrhage/CNVM)',
        findings: fundus
      });
    }

    // Papilledema
    if (fundus.papilledema || fundus.discEdema === 'bilateral') {
      triggeredReferrals.push({
        specialty: 'neuroOphthalmology',
        code: 'PAPILLEDEMA',
        urgency: 'EMERGENCY',
        reason: 'Papilledema detected - rule out elevated intracranial pressure',
        findings: fundus
      });
    }
  }

  // Check anterior segment
  if (clinicalData.anteriorSegment) {
    const as = clinicalData.anteriorSegment;

    // Corneal issues
    if (as.cornealUlcer || as.cornealInfiltrate) {
      triggeredReferrals.push({
        specialty: 'cornea',
        code: 'CORNEAL_ULCER',
        urgency: 'URGENT',
        reason: 'Corneal ulcer or infiltrate requiring specialist management',
        findings: as
      });
    }

    // Acute angle closure
    if (as.shallowAnteriorChamber && as.cornealEdema && clinicalData.iop?.od > 40) {
      triggeredReferrals.push({
        specialty: 'glaucoma',
        code: 'ACUTE_ACG',
        urgency: 'EMERGENCY',
        reason: 'Acute angle closure glaucoma',
        findings: { anteriorSegment: as, iop: clinicalData.iop }
      });
    }
  }

  // Check pediatric triggers
  if (clinicalData.patientAge < 18) {
    if (clinicalData.leukocoria) {
      triggeredReferrals.push({
        specialty: 'pediatricOphthalmology',
        code: 'LEUKOCORIA',
        urgency: 'EMERGENCY',
        reason: 'Leukocoria detected - URGENT rule out retinoblastoma',
        findings: { leukocoria: true }
      });
    }

    if (clinicalData.strabismus && clinicalData.patientAge < 6) {
      triggeredReferrals.push({
        specialty: 'pediatricOphthalmology',
        code: 'INFANTILE_ESOTROPIA',
        urgency: 'SOON',
        reason: 'Strabismus in young child - evaluate for amblyopia',
        findings: { strabismus: clinicalData.strabismus }
      });
    }
  }

  // Add specialty info and urgency details to each referral
  return triggeredReferrals.map(referral => ({
    ...referral,
    specialtyInfo: REFERRAL_TRIGGERS[referral.specialty],
    urgencyInfo: URGENCY_LEVELS[referral.urgency],
    conditionInfo: REFERRAL_TRIGGERS[referral.specialty]?.conditions.find(c => c.code === referral.code)
  }));
}

/**
 * Generate referral document
 * @param {String} patientId - Patient ID
 * @param {Object} referralData - Referral trigger data
 * @param {String} referringPhysician - Referring doctor name
 * @returns {Object} Referral document
 */
async function generateReferralDocument(patientId, referralData, referringPhysician) {
  try {
    const patient = await Patient.findById(patientId)
      .select('firstName lastName dateOfBirth gender medicalRecordNumber')
      .lean();

    if (!patient) {
      throw new Error('Patient not found');
    }

    const referralDoc = {
      referralId: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patient: {
        id: patientId,
        name: `${patient.firstName} ${patient.lastName}`,
        dob: patient.dateOfBirth,
        gender: patient.gender,
        mrn: patient.medicalRecordNumber
      },
      referringPhysician,
      referralDate: new Date(),
      specialty: referralData.specialty,
      specialistType: REFERRAL_TRIGGERS[referralData.specialty]?.contactInfo,
      urgency: referralData.urgency,
      urgencyDescription: URGENCY_LEVELS[referralData.urgency]?.description,
      maxDaysToAppointment: URGENCY_LEVELS[referralData.urgency]?.maxDays,
      reason: referralData.reason,
      conditionCode: referralData.code,
      conditionDescription: referralData.conditionInfo?.description,
      clinicalFindings: referralData.findings,
      eye: referralData.eye || 'Both',
      status: 'PENDING',
      notes: ''
    };

    return referralDoc;
  } catch (error) {
    log.error('Error generating referral document:', { error: error });
    throw new Error(`Failed to generate referral: ${error.message}`);
  }
}

/**
 * Create clinical alert for referral
 * @param {String} patientId - Patient ID
 * @param {Object} referral - Referral data
 * @returns {Object} Alert object
 */
async function createReferralAlert(patientId, referral) {
  try {
    const alertSeverity = {
      EMERGENCY: 'EMERGENCY',
      URGENT: 'URGENT',
      SOON: 'WARNING',
      ROUTINE: 'INFO'
    };

    const alert = {
      patient: patientId,
      severity: alertSeverity[referral.urgency] || 'INFO',
      category: 'referral',
      code: `REFERRAL_${referral.code}`,
      title: `${referral.specialty.toUpperCase()} Referral Required`,
      message: referral.reason,
      eye: referral.eye,
      triggerField: 'clinicalFindings',
      triggerValue: referral.code,
      recommendedActions: [
        {
          action: `Refer to ${REFERRAL_TRIGGERS[referral.specialty]?.contactInfo || referral.specialty}`,
          priority: 1
        },
        {
          action: `Timeframe: ${URGENCY_LEVELS[referral.urgency]?.description}`,
          priority: 2
        }
      ],
      referralData: referral
    };

    return alert;
  } catch (error) {
    log.error('Error creating referral alert:', { error: error });
    throw new Error(`Failed to create referral alert: ${error.message}`);
  }
}

/**
 * Process clinical data and generate all applicable referrals
 * @param {String} patientId - Patient ID
 * @param {Object} clinicalData - Complete clinical data
 * @param {String} examiningPhysician - Examining doctor
 * @returns {Object} Processing result with referrals and alerts
 */
async function processReferralTriggers(patientId, clinicalData, examiningPhysician) {
  try {
    const triggeredReferrals = evaluateReferralTriggers(clinicalData);

    if (triggeredReferrals.length === 0) {
      return {
        referralsTriggered: 0,
        referrals: [],
        alerts: [],
        message: 'No specialist referrals indicated based on current findings.'
      };
    }

    // Generate referral documents and alerts
    const referrals = [];
    const alerts = [];

    for (const trigger of triggeredReferrals) {
      const referralDoc = await generateReferralDocument(patientId, trigger, examiningPhysician);
      referrals.push(referralDoc);

      const alert = await createReferralAlert(patientId, trigger);
      alerts.push(alert);
    }

    // Sort by urgency
    referrals.sort((a, b) =>
      URGENCY_LEVELS[a.urgency].level - URGENCY_LEVELS[b.urgency].level
    );

    return {
      referralsTriggered: triggeredReferrals.length,
      referrals,
      alerts,
      mostUrgent: referrals[0]?.urgency,
      specialtiesNeeded: [...new Set(referrals.map(r => r.specialty))],
      message: `${triggeredReferrals.length} specialist referral(s) recommended.`
    };
  } catch (error) {
    log.error('Error processing referral triggers:', { error: error });
    throw new Error(`Referral processing failed: ${error.message}`);
  }
}

/**
 * Get all referral trigger configurations
 */
function getAllReferralTriggers() {
  return REFERRAL_TRIGGERS;
}

/**
 * Get urgency level definitions
 */
function getUrgencyLevels() {
  return URGENCY_LEVELS;
}

module.exports = {
  evaluateReferralTriggers,
  generateReferralDocument,
  createReferralAlert,
  processReferralTriggers,
  getAllReferralTriggers,
  getUrgencyLevels,
  REFERRAL_TRIGGERS,
  URGENCY_LEVELS
};
