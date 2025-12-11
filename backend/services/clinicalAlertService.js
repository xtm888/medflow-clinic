/**
 * Clinical Alert Service
 *
 * Rule engine for evaluating clinical data and triggering alerts.
 * Supports EMERGENCY (blocking), URGENT (banner), WARNING (banner), and INFO (inline) alerts.
 */

const ClinicalAlert = require('../models/ClinicalAlert');
const mongoose = require('mongoose');

/**
 * Alert Rule Definitions
 * Each rule specifies:
 * - code: Unique alert code
 * - severity: EMERGENCY | URGENT | WARNING | INFO
 * - category: clinical | measurement | history | medication | follow_up | safety
 * - title: Display title
 * - message: Template message (supports {eye}, {value}, {threshold} placeholders)
 * - evaluate: Function that checks if rule should trigger
 * - recommendedActions: Array of suggested actions
 */
const ALERT_RULES = [
  // ============ EMERGENCY ALERTS (Blocking) ============
  {
    code: 'NPL',
    severity: 'EMERGENCY',
    category: 'clinical',
    title: 'No Light Perception Detected',
    message: 'Patient has no light perception in {eye}. Immediate evaluation required.',
    evaluate: (examData) => {
      const results = [];
      const va = examData?.visualAcuity;
      if (!va) return results;

      // Check distance VA
      ['OD', 'OS'].forEach(eye => {
        const corrected = va?.distance?.[eye]?.corrected?.toLowerCase();
        const uncorrected = va?.distance?.[eye]?.uncorrected?.toLowerCase();
        if (corrected === 'npl' || corrected === 'nlp' || uncorrected === 'npl' || uncorrected === 'nlp') {
          results.push({
            eye,
            triggerField: `visualAcuity.distance.${eye}`,
            triggerValue: corrected || uncorrected
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Perform complete dilated fundus examination', priority: 1 },
      { action: 'Order urgent orbital imaging (CT/MRI)', priority: 2 },
      { action: 'Consult neuro-ophthalmology', priority: 3 },
      { action: 'Document light perception testing method', priority: 4 }
    ]
  },

  {
    code: 'ACUTE_ANGLE_CLOSURE',
    severity: 'EMERGENCY',
    category: 'clinical',
    title: 'Acute Angle Closure Suspected',
    message: 'Signs of acute angle closure in {eye}. IOP: {value} mmHg. Emergency treatment required.',
    evaluate: (examData) => {
      const results = [];
      const iop = examData?.tonometry;
      const anteriorSegment = examData?.anteriorSegment;

      ['OD', 'OS'].forEach(eye => {
        const eyeIop = parseFloat(iop?.[eye]?.value || iop?.[eye]);
        const shallowAC = anteriorSegment?.[eye]?.anteriorChamber?.depth === 'shallow' ||
                         anteriorSegment?.[eye]?.anteriorChamber?.depth === 'very_shallow';
        const midDilated = anteriorSegment?.[eye]?.pupil?.shape === 'mid_dilated' ||
                         anteriorSegment?.[eye]?.pupil?.reactive === false;

        // High IOP + shallow AC or mid-dilated pupil
        if (eyeIop > 40 && (shallowAC || midDilated)) {
          results.push({
            eye,
            triggerField: `tonometry.${eye}`,
            triggerValue: `${eyeIop} mmHg`,
            triggerThreshold: '> 40 mmHg with shallow AC'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Start immediate IOP-lowering medications', priority: 1 },
      { action: 'Perform laser peripheral iridotomy (LPI)', priority: 2 },
      { action: 'Position patient supine', priority: 3 },
      { action: 'Monitor IOP every 30 minutes', priority: 4 }
    ]
  },

  {
    code: 'ENDOPHTHALMITIS',
    severity: 'EMERGENCY',
    category: 'clinical',
    title: 'Endophthalmitis Suspected',
    message: 'Signs of endophthalmitis in {eye}. Immediate intervention required.',
    evaluate: (examData) => {
      const results = [];
      const anteriorSegment = examData?.anteriorSegment;
      const history = examData?.chiefComplaint || examData?.history;

      ['OD', 'OS'].forEach(eye => {
        const hypopion = anteriorSegment?.[eye]?.anteriorChamber?.hypopion === true;
        const severeInflammation = anteriorSegment?.[eye]?.anteriorChamber?.cells === '4+';
        const recentSurgery = history?.recentSurgery === true;

        if (hypopion || (severeInflammation && recentSurgery)) {
          results.push({
            eye,
            triggerField: `anteriorSegment.${eye}.anteriorChamber`,
            triggerValue: hypopion ? 'Hypopion present' : 'Severe inflammation post-surgery'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Obtain aqueous/vitreous tap for culture', priority: 1 },
      { action: 'Start intravitreal antibiotics', priority: 2 },
      { action: 'Start topical fortified antibiotics', priority: 3 },
      { action: 'Consult retina specialist urgently', priority: 4 }
    ]
  },

  {
    code: 'RETINAL_DETACHMENT',
    severity: 'EMERGENCY',
    category: 'clinical',
    title: 'Retinal Detachment Suspected',
    message: 'Signs of retinal detachment in {eye}. Urgent surgical evaluation required.',
    evaluate: (examData) => {
      const results = [];
      const fundus = examData?.fundus || examData?.posteriorSegment;

      ['OD', 'OS'].forEach(eye => {
        const rd = fundus?.[eye]?.retinalDetachment === true ||
                   fundus?.[eye]?.findings?.toLowerCase()?.includes('retinal detachment') ||
                   fundus?.[eye]?.findings?.toLowerCase()?.includes('rd');

        if (rd) {
          results.push({
            eye,
            triggerField: `fundus.${eye}.retinalDetachment`,
            triggerValue: 'Retinal detachment detected'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Immediate retina surgery consultation', priority: 1 },
      { action: 'Document extent and macula status', priority: 2 },
      { action: 'Position patient based on detachment location', priority: 3 },
      { action: 'Advise patient on activity restrictions', priority: 4 }
    ]
  },

  {
    code: 'CENTRAL_RETINAL_ARTERY_OCCLUSION',
    severity: 'EMERGENCY',
    category: 'clinical',
    title: 'Central Retinal Artery Occlusion (CRAO)',
    message: 'Suspected CRAO in {eye}. Time-critical emergency - sight may be salvageable within 90 minutes.',
    evaluate: (examData) => {
      const results = [];
      const fundus = examData?.fundus || examData?.posteriorSegment;
      const va = examData?.visualAcuity;

      ['OD', 'OS'].forEach(eye => {
        const cherryRedSpot = fundus?.[eye]?.findings?.toLowerCase()?.includes('cherry red');
        const pallor = fundus?.[eye]?.findings?.toLowerCase()?.includes('retinal pallor') ||
                      fundus?.[eye]?.findings?.toLowerCase()?.includes('pale retina');
        const boxcarring = fundus?.[eye]?.findings?.toLowerCase()?.includes('boxcar');
        const suddenLoss = va?.distance?.[eye]?.corrected === 'CF' ||
                          va?.distance?.[eye]?.corrected === 'HM' ||
                          va?.distance?.[eye]?.corrected === 'LP';

        if ((cherryRedSpot || pallor || boxcarring) && suddenLoss) {
          results.push({
            eye,
            triggerField: `fundus.${eye}`,
            triggerValue: 'Cherry red spot / retinal pallor with sudden vision loss'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Immediate ocular massage', priority: 1 },
      { action: 'Lower IOP with medications/paracentesis', priority: 2 },
      { action: 'Hyperventilation into paper bag (increase CO2)', priority: 3 },
      { action: 'Urgent stroke workup (carotid doppler, echo, ESR)', priority: 4 },
      { action: 'Consider hyperbaric oxygen if available', priority: 5 }
    ]
  },

  {
    code: 'CHEMICAL_BURN',
    severity: 'EMERGENCY',
    category: 'safety',
    title: 'Chemical Eye Injury',
    message: 'Chemical exposure to {eye}. Immediate irrigation required.',
    evaluate: (examData) => {
      const results = [];
      const history = examData?.chiefComplaint || examData?.history;

      const chemicalExposure = history?.complaint?.toLowerCase()?.includes('chemical') ||
                               history?.complaint?.toLowerCase()?.includes('splash') ||
                               history?.complaint?.toLowerCase()?.includes('alkali') ||
                               history?.complaint?.toLowerCase()?.includes('acid burn') ||
                               history?.notes?.toLowerCase()?.includes('chemical');

      if (chemicalExposure) {
        const eye = history?.laterality || 'OU';
        results.push({
          eye,
          triggerField: 'chiefComplaint',
          triggerValue: 'Chemical exposure reported'
        });
      }
      return results;
    },
    recommendedActions: [
      { action: 'Immediate copious irrigation (minimum 30 minutes)', priority: 1 },
      { action: 'Check pH and continue irrigation until pH 7.0-7.4', priority: 2 },
      { action: 'Remove any particulate matter', priority: 3 },
      { action: 'Document caustic agent if known', priority: 4 },
      { action: 'Assess limbal stem cell damage (Roper-Hall classification)', priority: 5 }
    ]
  },

  // ============ URGENT ALERTS (Non-blocking Banner) ============
  {
    code: 'IOP_CRITICAL',
    severity: 'URGENT',
    category: 'measurement',
    title: 'Critical IOP Elevation',
    message: 'IOP is critically elevated in {eye}: {value} mmHg (threshold: {threshold}).',
    evaluate: (examData) => {
      const results = [];
      const iop = examData?.tonometry;

      ['OD', 'OS'].forEach(eye => {
        const eyeIop = parseFloat(iop?.[eye]?.value || iop?.[eye]);
        if (eyeIop > 30) {
          results.push({
            eye,
            triggerField: `tonometry.${eye}`,
            triggerValue: `${eyeIop} mmHg`,
            triggerThreshold: '> 30 mmHg'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Initiate IOP-lowering therapy', priority: 1 },
      { action: 'Evaluate angle status', priority: 2 },
      { action: 'Consider gonioscopy if not yet performed', priority: 3 },
      { action: 'Recheck IOP in 30-60 minutes', priority: 4 }
    ]
  },

  {
    code: 'SUDDEN_VISION_LOSS',
    severity: 'URGENT',
    category: 'clinical',
    title: 'Sudden Vision Loss',
    message: 'Significant vision loss detected in {eye}. Current: {value}. Change from previous requires urgent evaluation.',
    evaluate: (examData, previousExam) => {
      const results = [];
      if (!previousExam) return results;

      const va = examData?.visualAcuity;
      const prevVa = previousExam?.visualAcuity;

      // Convert VA to LogMAR for comparison (simplified)
      const vaToLogMAR = (vaString) => {
        if (!vaString) return null;
        const snellenMap = {
          '20/20': 0, '20/25': 0.1, '20/30': 0.18, '20/40': 0.3,
          '20/50': 0.4, '20/60': 0.48, '20/70': 0.54, '20/80': 0.6,
          '20/100': 0.7, '20/200': 1.0, '20/400': 1.3,
          'CF': 1.7, 'HM': 2.0, 'LP': 2.5, 'NLP': 3.0, 'NPL': 3.0
        };
        return snellenMap[vaString.toUpperCase()] ?? null;
      };

      ['OD', 'OS'].forEach(eye => {
        const currentVA = va?.distance?.[eye]?.corrected;
        const prevVA = prevVa?.distance?.[eye]?.corrected;

        const currentLogMAR = vaToLogMAR(currentVA);
        const prevLogMAR = vaToLogMAR(prevVA);

        // 3+ lines = 0.3 LogMAR difference
        if (currentLogMAR !== null && prevLogMAR !== null && (currentLogMAR - prevLogMAR) >= 0.3) {
          results.push({
            eye,
            triggerField: `visualAcuity.distance.${eye}.corrected`,
            triggerValue: currentVA,
            triggerComparison: {
              previousValue: prevVA,
              currentValue: currentVA,
              changePercent: Math.round((currentLogMAR - prevLogMAR) / prevLogMAR * 100)
            }
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Perform dilated fundus examination', priority: 1 },
      { action: 'Consider OCT and visual field testing', priority: 2 },
      { action: 'Evaluate for neurological causes', priority: 3 },
      { action: 'Document onset timing and circumstances', priority: 4 }
    ]
  },

  {
    code: 'VITREOUS_HEMORRHAGE',
    severity: 'URGENT',
    category: 'clinical',
    title: 'Vitreous Hemorrhage',
    message: 'Vitreous hemorrhage detected in {eye}. Evaluation for underlying cause required.',
    evaluate: (examData) => {
      const results = [];
      const fundus = examData?.fundus || examData?.posteriorSegment;

      ['OD', 'OS'].forEach(eye => {
        const vh = fundus?.[eye]?.vitreousHemorrhage === true ||
                   fundus?.[eye]?.vitreous?.toLowerCase()?.includes('hemorrhage') ||
                   fundus?.[eye]?.findings?.toLowerCase()?.includes('vitreous hemorrhage');

        if (vh) {
          results.push({
            eye,
            triggerField: `fundus.${eye}.vitreous`,
            triggerValue: 'Vitreous hemorrhage present'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'B-scan ultrasound if view obscured', priority: 1 },
      { action: 'Rule out retinal detachment', priority: 2 },
      { action: 'Evaluate for diabetic retinopathy/PDR', priority: 3 },
      { action: 'Schedule retina consultation', priority: 4 }
    ]
  },

  {
    code: 'CORNEAL_ULCER',
    severity: 'URGENT',
    category: 'clinical',
    title: 'Corneal Ulcer',
    message: 'Active corneal ulcer detected in {eye}. Culture and treatment required.',
    evaluate: (examData) => {
      const results = [];
      const anteriorSegment = examData?.anteriorSegment;

      ['OD', 'OS'].forEach(eye => {
        const ulcer = anteriorSegment?.[eye]?.cornea?.ulcer === true ||
                     anteriorSegment?.[eye]?.cornea?.findings?.toLowerCase()?.includes('ulcer') ||
                     anteriorSegment?.[eye]?.cornea?.infiltrate === true;

        if (ulcer) {
          results.push({
            eye,
            triggerField: `anteriorSegment.${eye}.cornea`,
            triggerValue: 'Corneal ulcer/infiltrate present'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Obtain corneal cultures and gram stain', priority: 1 },
      { action: 'Start fortified antibiotics', priority: 2 },
      { action: 'Discontinue contact lens wear', priority: 3 },
      { action: 'Document size, depth, and location', priority: 4 },
      { action: 'Daily follow-up until improving', priority: 5 }
    ]
  },

  {
    code: 'HYPHEMA',
    severity: 'URGENT',
    category: 'clinical',
    title: 'Hyphema',
    message: 'Hyphema (blood in anterior chamber) detected in {eye}.',
    evaluate: (examData) => {
      const results = [];
      const anteriorSegment = examData?.anteriorSegment;

      ['OD', 'OS'].forEach(eye => {
        const hyphema = anteriorSegment?.[eye]?.anteriorChamber?.hyphema === true ||
                       anteriorSegment?.[eye]?.anteriorChamber?.findings?.toLowerCase()?.includes('hyphema') ||
                       anteriorSegment?.[eye]?.anteriorChamber?.blood === true;

        if (hyphema) {
          results.push({
            eye,
            triggerField: `anteriorSegment.${eye}.anteriorChamber`,
            triggerValue: 'Hyphema present'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Bed rest with head elevation 30-45 degrees', priority: 1 },
      { action: 'Shield eye (no patching)', priority: 2 },
      { action: 'Check IOP and monitor for rebleed', priority: 3 },
      { action: 'Test for sickle cell trait/disease', priority: 4 },
      { action: 'Cycloplegic and topical steroid', priority: 5 }
    ]
  },

  // ============ WARNING ALERTS (Non-blocking Banner) ============
  {
    code: 'IOP_ELEVATED',
    severity: 'WARNING',
    category: 'measurement',
    title: 'Elevated IOP',
    message: 'IOP is elevated in {eye}: {value} mmHg (normal: 10-21 mmHg).',
    evaluate: (examData) => {
      const results = [];
      const iop = examData?.tonometry;

      ['OD', 'OS'].forEach(eye => {
        const eyeIop = parseFloat(iop?.[eye]?.value || iop?.[eye]);
        if (eyeIop >= 21 && eyeIop <= 30) {
          results.push({
            eye,
            triggerField: `tonometry.${eye}`,
            triggerValue: `${eyeIop} mmHg`,
            triggerThreshold: '21-30 mmHg'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Evaluate optic nerve and cup/disc ratio', priority: 1 },
      { action: 'Consider pachymetry if not done', priority: 2 },
      { action: 'Consider visual field testing', priority: 3 },
      { action: 'Schedule follow-up for repeat IOP', priority: 4 }
    ]
  },

  {
    code: 'RAPD_DETECTED',
    severity: 'WARNING',
    category: 'clinical',
    title: 'RAPD Detected',
    message: 'Relative afferent pupillary defect (RAPD) detected in {eye}.',
    evaluate: (examData) => {
      const results = [];
      const pupils = examData?.pupils || examData?.anteriorSegment;

      ['OD', 'OS'].forEach(eye => {
        const rapd = pupils?.[eye]?.rapd === true ||
                    pupils?.[eye]?.apd === true ||
                    pupils?.rapd === eye;

        if (rapd) {
          results.push({
            eye,
            triggerField: `pupils.${eye}.rapd`,
            triggerValue: 'RAPD positive'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Perform dilated fundus examination', priority: 1 },
      { action: 'Order visual field test', priority: 2 },
      { action: 'Consider optic nerve imaging (OCT RNFL)', priority: 3 },
      { action: 'Evaluate for optic neuropathy causes', priority: 4 }
    ]
  },

  {
    code: 'NARROW_ANGLE',
    severity: 'WARNING',
    category: 'clinical',
    title: 'Narrow Angle',
    message: 'Narrow angle detected in {eye} on gonioscopy. Risk for angle closure.',
    evaluate: (examData) => {
      const results = [];
      const gonioscopy = examData?.gonioscopy;

      ['OD', 'OS'].forEach(eye => {
        const detailed = gonioscopy?.[`${eye}Detailed`];
        const legacy = gonioscopy?.[eye];

        // Check detailed grading
        let narrowAngle = false;
        if (detailed?.quadrants) {
          Object.values(detailed.quadrants).forEach(quad => {
            if (quad?.shaffer === '0' || quad?.shaffer === 'I' ||
                quad?.scheie === 'grade_III' || quad?.scheie === 'grade_IV') {
              narrowAngle = true;
            }
          });
        }

        // Check legacy field
        if (!narrowAngle && legacy) {
          const legacyLower = legacy.toLowerCase();
          if (legacyLower.includes('narrow') || legacyLower.includes('grade 0') ||
              legacyLower.includes('grade i') || legacyLower.includes('slit')) {
            narrowAngle = true;
          }
        }

        if (narrowAngle) {
          results.push({
            eye,
            triggerField: `gonioscopy.${eye}`,
            triggerValue: 'Narrow angle (Shaffer 0-I or Scheie III-IV)'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Consider prophylactic laser peripheral iridotomy', priority: 1 },
      { action: 'Counsel patient on angle closure symptoms', priority: 2 },
      { action: 'Avoid dilating drops in office', priority: 3 },
      { action: 'Anterior segment OCT for angle assessment', priority: 4 }
    ]
  },

  {
    code: 'CUP_DISC_HIGH',
    severity: 'WARNING',
    category: 'measurement',
    title: 'High Cup/Disc Ratio',
    message: 'Elevated cup/disc ratio in {eye}: {value}. Glaucoma evaluation recommended.',
    evaluate: (examData) => {
      const results = [];
      const fundus = examData?.fundus || examData?.posteriorSegment;

      ['OD', 'OS'].forEach(eye => {
        const cd = parseFloat(fundus?.[eye]?.opticDisc?.cupDiscRatio ||
                             fundus?.[eye]?.cupDiscRatio ||
                             fundus?.[eye]?.cd);

        if (cd > 0.7) {
          results.push({
            eye,
            triggerField: `fundus.${eye}.cupDiscRatio`,
            triggerValue: cd.toFixed(2),
            triggerThreshold: '> 0.7'
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Order visual field test', priority: 1 },
      { action: 'OCT optic nerve and RNFL analysis', priority: 2 },
      { action: 'Document optic nerve appearance in detail', priority: 3 },
      { action: 'Consider gonioscopy', priority: 4 }
    ]
  },

  {
    code: 'MYOPIA_PROGRESSION',
    severity: 'WARNING',
    category: 'measurement',
    title: 'Myopia Progression',
    message: 'Significant myopia progression in {eye}. Change: {value}D over monitoring period.',
    evaluate: (examData, previousExam) => {
      const results = [];
      if (!previousExam) return results;

      const refraction = examData?.refraction;
      const prevRefraction = previousExam?.refraction;

      ['OD', 'OS'].forEach(eye => {
        const currentSphere = parseFloat(refraction?.[eye]?.sphere || refraction?.[eye]?.sph);
        const prevSphere = parseFloat(prevRefraction?.[eye]?.sphere || prevRefraction?.[eye]?.sph);

        // Check for > 1D progression in myopia (more negative)
        if (!isNaN(currentSphere) && !isNaN(prevSphere) &&
            currentSphere < 0 && (prevSphere - currentSphere) >= 1) {
          results.push({
            eye,
            triggerField: `refraction.${eye}.sphere`,
            triggerValue: `${(prevSphere - currentSphere).toFixed(2)}D`,
            triggerComparison: {
              previousValue: `${prevSphere}D`,
              currentValue: `${currentSphere}D`
            }
          });
        }
      });
      return results;
    },
    recommendedActions: [
      { action: 'Discuss myopia control options (atropine, ortho-K, multifocal CL)', priority: 1 },
      { action: 'Measure axial length if available', priority: 2 },
      { action: 'Counsel on outdoor time and near work habits', priority: 3 },
      { action: 'Schedule 6-month follow-up', priority: 4 }
    ]
  },

  // CRITICAL: Drug-Drug Interaction Checking
  {
    code: 'DRUG_INTERACTION',
    severity: 'URGENT',
    category: 'medication',
    title: 'Drug-Drug Interaction Detected',
    message: 'Potential drug interaction detected: {value}.',
    evaluate: (examData, previousExam, patientData) => {
      const results = [];
      const prescriptions = examData?.prescriptions || [];
      const currentMedications = patientData?.currentMedications || patientData?.medications || [];

      // Comprehensive ophthalmology drug interaction database
      const drugInteractions = {
        // Beta-blockers (timolol, betaxolol, levobunolol, carteolol)
        'timolol': {
          interactions: [
            { drugs: ['verapamil', 'diltiazem'], severity: 'high', effect: 'Enhanced bradycardia and hypotension' },
            { drugs: ['insulin', 'metformin', 'glipizide'], severity: 'moderate', effect: 'May mask hypoglycemia symptoms' },
            { drugs: ['clonidine'], severity: 'high', effect: 'Rebound hypertension risk on clonidine withdrawal' },
            { drugs: ['epinephrine', 'adrenaline'], severity: 'high', effect: 'Severe hypertension, bradycardia' },
            { drugs: ['fluoxetine', 'paroxetine'], severity: 'moderate', effect: 'Increased beta-blocker levels (CYP2D6)' }
          ],
          contraindicated: ['asthma', 'copd', 'bradycardia', 'heart block']
        },
        'betaxolol': {
          interactions: [
            { drugs: ['verapamil', 'diltiazem'], severity: 'high', effect: 'Enhanced bradycardia' },
            { drugs: ['insulin'], severity: 'moderate', effect: 'May mask hypoglycemia symptoms' }
          ],
          contraindicated: ['severe bradycardia', 'heart block']
        },
        // Prostaglandin analogs
        'latanoprost': {
          interactions: [
            { drugs: ['bimatoprost', 'travoprost', 'tafluprost'], severity: 'moderate', effect: 'Additive IOP lowering but increased side effects' }
          ],
          contraindicated: []
        },
        // Alpha agonists
        'brimonidine': {
          interactions: [
            { drugs: ['maois', 'moclobemide', 'selegiline'], severity: 'high', effect: 'Hypertensive crisis' },
            { drugs: ['tricyclic antidepressants', 'amitriptyline', 'nortriptyline'], severity: 'moderate', effect: 'Reduced efficacy' },
            { drugs: ['clonidine'], severity: 'moderate', effect: 'Additive CNS depression' }
          ],
          contraindicated: ['maoi use']
        },
        // Carbonic anhydrase inhibitors
        'dorzolamide': {
          interactions: [
            { drugs: ['aspirin', 'salicylates'], severity: 'moderate', effect: 'Increased risk of metabolic acidosis' },
            { drugs: ['topiramate'], severity: 'moderate', effect: 'Increased risk of kidney stones' }
          ],
          contraindicated: ['sulfa allergy']
        },
        'brinzolamide': {
          interactions: [
            { drugs: ['aspirin', 'salicylates'], severity: 'moderate', effect: 'Increased risk of metabolic acidosis' }
          ],
          contraindicated: ['sulfa allergy']
        },
        // Mydriatics/Cycloplegics
        'atropine': {
          interactions: [
            { drugs: ['anticholinergics', 'antihistamines', 'tricyclic antidepressants'], severity: 'moderate', effect: 'Additive anticholinergic effects' }
          ],
          contraindicated: ['narrow angle glaucoma', 'urinary retention']
        },
        'phenylephrine': {
          interactions: [
            { drugs: ['maois'], severity: 'high', effect: 'Severe hypertensive crisis' },
            { drugs: ['beta-blockers', 'timolol'], severity: 'high', effect: 'Severe hypertension, reflex bradycardia' }
          ],
          contraindicated: ['severe hypertension', 'maoi use']
        },
        // Steroids
        'prednisolone': {
          interactions: [
            { drugs: ['nsaids', 'ibuprofen', 'aspirin'], severity: 'moderate', effect: 'Increased GI bleeding risk' },
            { drugs: ['warfarin'], severity: 'moderate', effect: 'Altered anticoagulant effect' },
            { drugs: ['diabetes medications', 'insulin', 'metformin'], severity: 'moderate', effect: 'May increase blood glucose' }
          ],
          contraindicated: ['fungal infection', 'herpes simplex keratitis']
        },
        'dexamethasone': {
          interactions: [
            { drugs: ['nsaids'], severity: 'moderate', effect: 'Increased GI bleeding risk' },
            { drugs: ['warfarin'], severity: 'moderate', effect: 'Altered anticoagulant effect' }
          ],
          contraindicated: ['fungal infection', 'viral infection']
        }
      };

      // Normalize drug name for matching
      const normalizeDrug = (name) => (name || '').toLowerCase().replace(/[^a-z]/g, '');

      // Combine all patient medications (current + new prescriptions)
      const allMeds = [
        ...currentMedications.map(m => normalizeDrug(m.name || m.medication || m)),
        ...prescriptions.map(p => normalizeDrug(p.medication || p.name || p))
      ];

      // Check each prescription against interaction database
      prescriptions.forEach(rx => {
        const rxName = normalizeDrug(rx.medication || rx.name || rx);

        // Check if this drug has known interactions
        Object.entries(drugInteractions).forEach(([drug, data]) => {
          if (rxName.includes(drug) || drug.includes(rxName)) {
            // Check against patient's other medications
            data.interactions.forEach(interaction => {
              interaction.drugs.forEach(interactingDrug => {
                // Check current medications and other prescriptions
                const hasInteraction = allMeds.some(med =>
                  med !== rxName && (med.includes(interactingDrug) || interactingDrug.includes(med))
                );

                if (hasInteraction) {
                  results.push({
                    eye: 'OU',
                    triggerField: 'prescription',
                    triggerValue: `${rx.medication || rx.name} interacts with ${interactingDrug}: ${interaction.effect}`,
                    severity: interaction.severity,
                    interactionType: 'drug-drug'
                  });
                }
              });
            });

            // Check contraindicated conditions
            const patientConditions = [
              ...(patientData?.medicalHistory || []).map(h => normalizeDrug(h.condition)),
              ...(patientData?.conditions || []).map(c => normalizeDrug(c))
            ];

            data.contraindicated.forEach(condition => {
              if (patientConditions.some(pc => pc.includes(condition) || condition.includes(pc))) {
                results.push({
                  eye: 'OU',
                  triggerField: 'prescription',
                  triggerValue: `${rx.medication || rx.name} is contraindicated in patients with ${condition}`,
                  severity: 'high',
                  interactionType: 'drug-condition'
                });
              }
            });
          }
        });
      });

      return results;
    },
    recommendedActions: [
      { action: 'Review interaction severity and clinical significance', priority: 1 },
      { action: 'Consider alternative medication if high severity', priority: 2 },
      { action: 'Adjust dosing if continuing with interaction', priority: 3 },
      { action: 'Document decision and patient counseling', priority: 4 },
      { action: 'Monitor for interaction effects at follow-up', priority: 5 }
    ]
  },

  {
    code: 'DRUG_ALLERGY_CONFLICT',
    severity: 'WARNING',
    category: 'medication',
    title: 'Drug Allergy Conflict',
    message: 'Prescribed medication may conflict with documented allergy: {value}.',
    evaluate: (examData, previousExam, patientData) => {
      const results = [];
      const allergies = patientData?.allergies || [];
      const prescriptions = examData?.prescriptions || [];

      // Common drug class mappings
      const drugClassConflicts = {
        'sulfa': ['brinzolamide', 'dorzolamide', 'acetazolamide', 'sulfacetamide'],
        'sulfonamide': ['brinzolamide', 'dorzolamide', 'acetazolamide', 'sulfacetamide'],
        'penicillin': ['ampicillin', 'amoxicillin'],
        'latex': [], // Flag for latex-containing dropper tips
        'iodine': ['povidone-iodine', 'betadine'],
        'preservative': ['bak', 'benzalkonium chloride']
      };

      allergies.forEach(allergy => {
        const allergyLower = (allergy.allergen || allergy.name || allergy).toLowerCase();

        prescriptions.forEach(rx => {
          const drugLower = (rx.medication || rx.name || rx).toLowerCase();

          // Check direct match
          if (drugLower.includes(allergyLower)) {
            results.push({
              eye: 'OU',
              triggerField: 'prescription',
              triggerValue: `${rx.medication || rx.name} conflicts with allergy to ${allergy.allergen || allergy.name || allergy}`
            });
          }

          // Check class conflicts
          Object.entries(drugClassConflicts).forEach(([allergyClass, drugs]) => {
            if (allergyLower.includes(allergyClass)) {
              drugs.forEach(conflictDrug => {
                if (drugLower.includes(conflictDrug)) {
                  results.push({
                    eye: 'OU',
                    triggerField: 'prescription',
                    triggerValue: `${rx.medication || rx.name} (${allergyClass} class) conflicts with documented ${allergyClass} allergy`
                  });
                }
              });
            }
          });
        });
      });

      return results;
    },
    recommendedActions: [
      { action: 'Review and confirm patient allergy history', priority: 1 },
      { action: 'Select alternative medication', priority: 2 },
      { action: 'Document allergy verification in chart', priority: 3 }
    ]
  },

  // ============ INFO ALERTS (Inline) ============
  {
    code: 'DIABETES_SCREENING_DUE',
    severity: 'INFO',
    category: 'follow_up',
    title: 'Diabetic Retinopathy Screening Due',
    message: 'Patient with diabetes is due for retinal screening examination.',
    evaluate: (examData, previousExam, patientData) => {
      const results = [];

      const hasDiabetes = patientData?.medicalHistory?.some(h =>
        h.condition?.toLowerCase()?.includes('diabetes') ||
        h.condition?.toLowerCase()?.includes('dm type')
      ) || patientData?.conditions?.some(c =>
        c.toLowerCase()?.includes('diabetes')
      );

      if (!hasDiabetes) return results;

      // Check if last DR screening > 12 months
      const lastScreening = previousExam?.fundus?.diabeticScreening?.date ||
                           previousExam?.createdAt;

      if (lastScreening) {
        const monthsSince = (Date.now() - new Date(lastScreening).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsSince >= 12) {
          results.push({
            eye: 'OU',
            triggerField: 'medicalHistory.diabetes',
            triggerValue: `Last screening: ${Math.round(monthsSince)} months ago`
          });
        }
      } else {
        results.push({
          eye: 'OU',
          triggerField: 'medicalHistory.diabetes',
          triggerValue: 'No previous DR screening on record'
        });
      }

      return results;
    },
    recommendedActions: [
      { action: 'Perform dilated fundus examination', priority: 1 },
      { action: 'Document diabetic retinopathy status', priority: 2 },
      { action: 'Coordinate with primary care/endocrinology', priority: 3 }
    ]
  },

  {
    code: 'FOLLOW_UP_OVERDUE',
    severity: 'INFO',
    category: 'follow_up',
    title: 'Follow-up Overdue',
    message: 'Patient is overdue for scheduled follow-up visit.',
    evaluate: (examData, previousExam, patientData) => {
      const results = [];

      const scheduledFollowUp = previousExam?.plan?.followUp?.date ||
                               previousExam?.followUpDate;

      if (scheduledFollowUp && new Date(scheduledFollowUp) < new Date()) {
        const daysOverdue = Math.round((Date.now() - new Date(scheduledFollowUp).getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue > 14) {
          results.push({
            eye: 'OU',
            triggerField: 'previousExam.followUp',
            triggerValue: `${daysOverdue} days overdue`
          });
        }
      }

      return results;
    },
    recommendedActions: [
      { action: 'Review reason for follow-up', priority: 1 },
      { action: 'Update follow-up schedule', priority: 2 }
    ]
  },

  {
    code: 'PRESCRIPTION_EXPIRED',
    severity: 'INFO',
    category: 'medication',
    title: 'Prescription Expired',
    message: 'Active prescription has expired and may need renewal.',
    evaluate: (examData, previousExam, patientData) => {
      const results = [];

      const activeMeds = patientData?.activeMedications || patientData?.medications || [];

      activeMeds.forEach(med => {
        const expiryDate = med.expiryDate || med.validUntil;
        if (expiryDate && new Date(expiryDate) < new Date()) {
          results.push({
            eye: 'OU',
            triggerField: 'medications',
            triggerValue: `${med.name || med.medication} expired on ${new Date(expiryDate).toLocaleDateString()}`
          });
        }
      });

      return results;
    },
    recommendedActions: [
      { action: 'Review medication necessity', priority: 1 },
      { action: 'Issue new prescription if indicated', priority: 2 }
    ]
  },

  {
    code: 'CONTACT_LENS_REVIEW',
    severity: 'INFO',
    category: 'follow_up',
    title: 'Contact Lens Review Due',
    message: 'Contact lens patient is due for annual review.',
    evaluate: (examData, previousExam, patientData) => {
      const results = [];

      const isContactLensWearer = patientData?.contactLensWearer === true ||
                                   patientData?.refraction?.contactLens;

      if (!isContactLensWearer) return results;

      const lastCLExam = previousExam?.contactLens?.date || previousExam?.createdAt;

      if (lastCLExam) {
        const monthsSince = (Date.now() - new Date(lastCLExam).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsSince >= 12) {
          results.push({
            eye: 'OU',
            triggerField: 'contactLens',
            triggerValue: `Last CL exam: ${Math.round(monthsSince)} months ago`
          });
        }
      }

      return results;
    },
    recommendedActions: [
      { action: 'Perform contact lens evaluation', priority: 1 },
      { action: 'Assess corneal health', priority: 2 },
      { action: 'Update contact lens prescription', priority: 3 }
    ]
  }
];

/**
 * Clinical Alert Service Class
 */
class ClinicalAlertService {
  constructor() {
    this.rules = ALERT_RULES;
  }

  /**
   * Evaluate all rules against exam data and create alerts
   * @param {Object} examData - Current exam data
   * @param {String} patientId - Patient ID
   * @param {String} examId - Exam ID (optional)
   * @param {String} visitId - Visit ID (optional)
   * @param {Object} previousExam - Previous exam for comparison
   * @param {Object} patientData - Patient demographic/history data
   * @param {String} userId - User creating the alerts (optional)
   * @returns {Array} Array of created/existing alerts
   */
  async evaluateAndCreateAlerts(examData, patientId, examId, visitId, previousExam = null, patientData = null, userId = null) {
    const alerts = [];

    for (const rule of this.rules) {
      try {
        const triggers = rule.evaluate(examData, previousExam, patientData);

        for (const trigger of triggers) {
          // Check if alert already exists
          const exists = await ClinicalAlert.alertExists(patientId, examId, rule.code, trigger.eye);

          if (!exists) {
            const alert = await this.createAlert(rule, trigger, patientId, examId, visitId, userId);
            alerts.push(alert);
          }
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.code}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Create a single alert
   */
  async createAlert(rule, trigger, patientId, examId, visitId, userId) {
    // Format message with placeholders
    let message = rule.message
      .replace('{eye}', this.formatEye(trigger.eye))
      .replace('{value}', trigger.triggerValue || 'N/A')
      .replace('{threshold}', trigger.triggerThreshold || '');

    const alertData = {
      patient: patientId,
      exam: examId || undefined,
      visit: visitId || undefined,
      severity: rule.severity,
      category: rule.category,
      code: rule.code,
      title: rule.title,
      message,
      eye: trigger.eye,
      triggerField: trigger.triggerField,
      triggerValue: trigger.triggerValue,
      triggerThreshold: trigger.triggerThreshold,
      triggerComparison: trigger.triggerComparison,
      recommendedActions: rule.recommendedActions.map(a => ({
        action: a.action,
        priority: a.priority,
        completed: false
      })),
      autoGenerated: true,
      createdBy: userId || undefined
    };

    const alert = new ClinicalAlert(alertData);
    await alert.save();

    return alert;
  }

  /**
   * Format eye laterality for display
   */
  formatEye(eye) {
    const eyeMap = {
      'OD': 'right eye (OD)',
      'OS': 'left eye (OS)',
      'OU': 'both eyes (OU)'
    };
    return eyeMap[eye] || eye;
  }

  /**
   * Get active alerts for a patient
   */
  async getPatientAlerts(patientId, options = {}) {
    return ClinicalAlert.getActiveForPatient(patientId, options);
  }

  /**
   * Get emergency alerts for an exam (for blocking modal)
   */
  async getEmergencyAlerts(examId) {
    return ClinicalAlert.getEmergencyForExam(examId);
  }

  /**
   * Get alert counts by severity for a patient
   */
  async getAlertCounts(patientId) {
    return ClinicalAlert.getCountsBySeverity(patientId);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId, reason = '') {
    const alert = await ClinicalAlert.findById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    return alert.acknowledge(userId, reason);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, userId, resolution = '') {
    const alert = await ClinicalAlert.findById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    return alert.resolve(userId, resolution);
  }

  /**
   * Escalate an alert
   */
  async escalateAlert(alertId, userId, toUserId, reason = '') {
    const alert = await ClinicalAlert.findById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    return alert.escalate(userId, toUserId, reason);
  }

  /**
   * Dismiss an alert
   * IMPORTANT: EMERGENCY alerts cannot be dismissed - they must be acknowledged or resolved
   */
  async dismissAlert(alertId, userId, reason = '') {
    const alert = await ClinicalAlert.findById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    // CRITICAL: EMERGENCY alerts cannot be simply dismissed
    // They require proper acknowledgment or resolution with documentation
    if (alert.severity === 'EMERGENCY') {
      const error = new Error('EMERGENCY alerts cannot be dismissed. They must be acknowledged with a documented reason or resolved with proper clinical documentation.');
      error.code = 'EMERGENCY_CANNOT_DISMISS';
      error.status = 403;
      throw error;
    }

    // For non-emergency alerts, require reason for WARNING/URGENT
    if ((alert.severity === 'URGENT' || alert.severity === 'WARNING') && !reason.trim()) {
      const error = new Error('A reason is required when dismissing URGENT or WARNING alerts.');
      error.code = 'REASON_REQUIRED';
      error.status = 400;
      throw error;
    }

    alert.status = 'dismissed';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;
    alert.acknowledgedReason = reason;
    return alert.save();
  }

  /**
   * Acknowledge an EMERGENCY alert
   * EMERGENCY alerts require special handling with mandatory reason and documentation
   */
  async acknowledgeEmergencyAlert(alertId, userId, acknowledgmentData = {}) {
    const alert = await ClinicalAlert.findById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.severity !== 'EMERGENCY') {
      // Use normal acknowledge for non-emergency alerts
      return this.acknowledgeAlert(alertId, userId, acknowledgmentData.reason || '');
    }

    const { reason, actionsTaken, clinicalJustification } = acknowledgmentData;

    // EMERGENCY alerts MUST have a reason and clinical justification
    if (!reason || !reason.trim()) {
      const error = new Error('A detailed reason is required when acknowledging EMERGENCY alerts.');
      error.code = 'REASON_REQUIRED';
      error.status = 400;
      throw error;
    }

    if (!clinicalJustification || !clinicalJustification.trim()) {
      const error = new Error('Clinical justification is required when acknowledging EMERGENCY alerts. Document why proceeding is safe.');
      error.code = 'JUSTIFICATION_REQUIRED';
      error.status = 400;
      throw error;
    }

    // Store the enhanced acknowledgment data
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;
    alert.acknowledgedReason = reason;
    alert.emergencyAcknowledgment = {
      clinicalJustification,
      actionsTaken: actionsTaken || [],
      acknowledgedAt: new Date(),
      acknowledgedBy: userId
    };

    return alert.save();
  }

  /**
   * Bulk acknowledge alerts (for acknowledging banner)
   */
  async bulkAcknowledge(alertIds, userId, reason = '') {
    const results = [];
    for (const alertId of alertIds) {
      try {
        const alert = await this.acknowledgeAlert(alertId, userId, reason);
        results.push({ alertId, success: true, alert });
      } catch (error) {
        results.push({ alertId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Get all available alert rules (for configuration UI)
   */
  getAlertRules() {
    return this.rules.map(rule => ({
      code: rule.code,
      severity: rule.severity,
      category: rule.category,
      title: rule.title,
      message: rule.message,
      recommendedActions: rule.recommendedActions
    }));
  }

  /**
   * Manual alert creation (for non-automated alerts)
   */
  async createManualAlert(alertData, userId) {
    const data = {
      ...alertData,
      autoGenerated: false,
      createdBy: userId
    };

    const alert = new ClinicalAlert(data);
    await alert.save();
    return alert;
  }

  /**
   * Re-evaluate alerts for an exam (after data changes)
   */
  async reEvaluateAlerts(examData, patientId, examId, visitId, previousExam, patientData, userId) {
    // Don't resolve existing alerts, just add new ones if conditions are met
    return this.evaluateAndCreateAlerts(examData, patientId, examId, visitId, previousExam, patientData, userId);
  }
}

// Export singleton instance
module.exports = new ClinicalAlertService();
