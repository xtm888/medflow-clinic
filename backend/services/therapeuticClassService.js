/**
 * Therapeutic Class Duplication Detection Service
 * Detects duplicate medications within the same therapeutic class
 */

const Prescription = require('../models/Prescription');

/**
 * Therapeutic Drug Classifications
 * Based on ATC (Anatomical Therapeutic Chemical) classification
 */
const THERAPEUTIC_CLASSES = {
  // Glaucoma Medications
  'prostaglandin_analogs': {
    name: 'Prostaglandin Analogs',
    drugs: ['latanoprost', 'travoprost', 'bimatoprost', 'tafluprost', 'latanoprostene bunod'],
    maxConcurrent: 1,
    warning: 'Multiple prostaglandin analogs provide no additional benefit and may cause paradoxical IOP elevation'
  },
  'beta_blockers_ophthalmic': {
    name: 'Beta Blockers (Ophthalmic)',
    drugs: ['timolol', 'betaxolol', 'levobunolol', 'carteolol', 'metipranolol'],
    maxConcurrent: 1,
    warning: 'Multiple beta blockers increase systemic absorption risk without additional IOP benefit'
  },
  'alpha_agonists_ophthalmic': {
    name: 'Alpha Agonists (Ophthalmic)',
    drugs: ['brimonidine', 'apraclonidine'],
    maxConcurrent: 1,
    warning: 'Duplicate alpha agonists increase CNS depression risk'
  },
  'carbonic_anhydrase_inhibitors': {
    name: 'Carbonic Anhydrase Inhibitors',
    drugs: ['dorzolamide', 'brinzolamide', 'acetazolamide', 'methazolamide'],
    maxConcurrent: 1,
    warning: 'Multiple CAIs increase risk of metabolic acidosis and electrolyte imbalances'
  },

  // Anti-inflammatory
  'nsaids_ophthalmic': {
    name: 'NSAIDs (Ophthalmic)',
    drugs: ['ketorolac', 'diclofenac', 'bromfenac', 'nepafenac', 'flurbiprofen'],
    maxConcurrent: 1,
    warning: 'Multiple ophthalmic NSAIDs increase corneal melting risk'
  },
  'corticosteroids_ophthalmic': {
    name: 'Corticosteroids (Ophthalmic)',
    drugs: ['prednisolone', 'dexamethasone', 'fluorometholone', 'loteprednol', 'difluprednate', 'rimexolone'],
    maxConcurrent: 1,
    warning: 'Multiple corticosteroids increase IOP elevation and cataract risk'
  },

  // Antibiotics
  'fluoroquinolones_ophthalmic': {
    name: 'Fluoroquinolones (Ophthalmic)',
    drugs: ['moxifloxacin', 'gatifloxacin', 'besifloxacin', 'ofloxacin', 'ciprofloxacin', 'levofloxacin'],
    maxConcurrent: 1,
    warning: 'Multiple fluoroquinolones provide no additional coverage and increase resistance risk'
  },
  'aminoglycosides_ophthalmic': {
    name: 'Aminoglycosides (Ophthalmic)',
    drugs: ['tobramycin', 'gentamicin', 'neomycin'],
    maxConcurrent: 1,
    warning: 'Multiple aminoglycosides increase corneal toxicity risk'
  },

  // Anti-VEGF agents
  'anti_vegf': {
    name: 'Anti-VEGF Agents',
    drugs: ['aflibercept', 'ranibizumab', 'bevacizumab', 'brolucizumab', 'faricimab'],
    maxConcurrent: 1,
    warning: 'Multiple anti-VEGF agents should not be used concurrently'
  },

  // Systemic - Pain
  'opioid_analgesics': {
    name: 'Opioid Analgesics',
    drugs: ['morphine', 'oxycodone', 'hydrocodone', 'codeine', 'tramadol', 'fentanyl', 'hydromorphone'],
    maxConcurrent: 1,
    warning: 'ALERT: Multiple opioids significantly increase overdose and respiratory depression risk'
  },
  'nsaids_systemic': {
    name: 'NSAIDs (Systemic)',
    drugs: ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'meloxicam', 'indomethacin', 'ketorolac'],
    maxConcurrent: 1,
    warning: 'Multiple NSAIDs increase GI bleeding and renal toxicity risk without added benefit'
  },

  // Cardiovascular
  'ace_inhibitors': {
    name: 'ACE Inhibitors',
    drugs: ['lisinopril', 'enalapril', 'ramipril', 'benazepril', 'captopril', 'fosinopril', 'quinapril'],
    maxConcurrent: 1,
    warning: 'Multiple ACE inhibitors increase hyperkalemia and renal dysfunction risk'
  },
  'arbs': {
    name: 'Angiotensin Receptor Blockers',
    drugs: ['losartan', 'valsartan', 'irbesartan', 'olmesartan', 'telmisartan', 'candesartan'],
    maxConcurrent: 1,
    warning: 'Multiple ARBs not recommended - no additional benefit, increased adverse effects'
  },
  'calcium_channel_blockers': {
    name: 'Calcium Channel Blockers',
    drugs: ['amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'felodipine'],
    maxConcurrent: 1,
    warning: 'Multiple CCBs may cause severe hypotension and bradycardia'
  },
  'beta_blockers_systemic': {
    name: 'Beta Blockers (Systemic)',
    drugs: ['metoprolol', 'atenolol', 'propranolol', 'carvedilol', 'bisoprolol', 'nebivolol'],
    maxConcurrent: 1,
    warning: 'Multiple systemic beta blockers increase bradycardia and heart block risk'
  },
  'statins': {
    name: 'Statins',
    drugs: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin', 'fluvastatin'],
    maxConcurrent: 1,
    warning: 'Multiple statins dramatically increase myopathy and rhabdomyolysis risk'
  },

  // Diabetes
  'sulfonylureas': {
    name: 'Sulfonylureas',
    drugs: ['glipizide', 'glyburide', 'glimepiride', 'gliclazide'],
    maxConcurrent: 1,
    warning: 'Multiple sulfonylureas significantly increase hypoglycemia risk'
  },
  'sglt2_inhibitors': {
    name: 'SGLT2 Inhibitors',
    drugs: ['empagliflozin', 'dapagliflozin', 'canagliflozin', 'ertugliflozin'],
    maxConcurrent: 1,
    warning: 'Multiple SGLT2 inhibitors increase ketoacidosis and genitourinary infection risk'
  },

  // Psychiatric
  'ssris': {
    name: 'SSRIs',
    drugs: ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'fluvoxamine'],
    maxConcurrent: 1,
    warning: 'ALERT: Multiple SSRIs significantly increase serotonin syndrome risk'
  },
  'snris': {
    name: 'SNRIs',
    drugs: ['venlafaxine', 'duloxetine', 'desvenlafaxine', 'levomilnacipran'],
    maxConcurrent: 1,
    warning: 'ALERT: Multiple SNRIs significantly increase serotonin syndrome risk'
  },
  'benzodiazepines': {
    name: 'Benzodiazepines',
    drugs: ['alprazolam', 'lorazepam', 'diazepam', 'clonazepam', 'temazepam', 'triazolam'],
    maxConcurrent: 1,
    warning: 'ALERT: Multiple benzodiazepines increase sedation, falls, and respiratory depression risk'
  },

  // Anticoagulants
  'anticoagulants': {
    name: 'Anticoagulants',
    drugs: ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'enoxaparin', 'heparin'],
    maxConcurrent: 1,
    warning: 'CRITICAL: Multiple anticoagulants dramatically increase bleeding risk'
  },
  'antiplatelet_agents': {
    name: 'Antiplatelet Agents',
    drugs: ['aspirin', 'clopidogrel', 'prasugrel', 'ticagrelor', 'dipyridamole'],
    maxConcurrent: 2, // Dual antiplatelet therapy is sometimes indicated
    warning: 'Multiple antiplatelet agents increase bleeding risk - ensure dual therapy is intentional'
  },

  // Proton Pump Inhibitors
  'ppis': {
    name: 'Proton Pump Inhibitors',
    drugs: ['omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole'],
    maxConcurrent: 1,
    warning: 'Multiple PPIs provide no additional benefit'
  }
};

/**
 * Normalize drug name for matching
 */
function normalizeDrugName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Find therapeutic class for a drug
 * @param {String} drugName - Drug name
 * @returns {Object|null} Therapeutic class info
 */
function findTherapeuticClass(drugName) {
  const normalizedName = normalizeDrugName(drugName);

  for (const [classCode, classInfo] of Object.entries(THERAPEUTIC_CLASSES)) {
    for (const drug of classInfo.drugs) {
      if (normalizedName.includes(drug) || drug.includes(normalizedName)) {
        return {
          classCode,
          className: classInfo.name,
          matchedDrug: drug,
          maxConcurrent: classInfo.maxConcurrent,
          warning: classInfo.warning
        };
      }
    }
  }

  return null;
}

/**
 * Check for therapeutic duplications in a medication list
 * @param {Array} medications - Array of medication objects
 * @returns {Object} Duplication analysis
 */
function checkDuplications(medications) {
  const classificationMap = {};
  const duplications = [];
  const warnings = [];

  // Classify each medication
  for (const med of medications) {
    const medName = med.genericName || med.name || '';
    const classification = findTherapeuticClass(medName);

    if (classification) {
      if (!classificationMap[classification.classCode]) {
        classificationMap[classification.classCode] = {
          ...classification,
          medications: []
        };
      }
      classificationMap[classification.classCode].medications.push({
        name: medName,
        prescriptionId: med.prescriptionId,
        matchedAs: classification.matchedDrug
      });
    }
  }

  // Check for duplications
  for (const [classCode, classData] of Object.entries(classificationMap)) {
    if (classData.medications.length > classData.maxConcurrent) {
      const duplication = {
        classCode,
        className: classData.className,
        maxAllowed: classData.maxConcurrent,
        found: classData.medications.length,
        medications: classData.medications,
        severity: determineSeverity(classCode, classData.medications.length),
        warning: classData.warning
      };

      duplications.push(duplication);
      warnings.push({
        severity: duplication.severity,
        message: `Therapeutic duplication: ${classData.medications.length} ${classData.className} medications detected. ${classData.warning}`
      });
    }
  }

  return {
    hasDuplications: duplications.length > 0,
    duplications,
    warnings,
    classificationMap,
    totalMedicationsAnalyzed: medications.length,
    classesIdentified: Object.keys(classificationMap).length
  };
}

/**
 * Determine severity based on drug class and count
 */
function determineSeverity(classCode, count) {
  // High-risk duplications
  const highRiskClasses = [
    'opioid_analgesics', 'anticoagulants', 'ssris', 'snris',
    'benzodiazepines', 'statins'
  ];

  if (highRiskClasses.includes(classCode)) {
    return 'CRITICAL';
  }

  if (count > 2) {
    return 'HIGH';
  }

  return 'MODERATE';
}

/**
 * Check patient's current medications for duplications
 * @param {String} patientId - Patient ID
 * @param {Array} newMedications - New medications being prescribed
 * @returns {Object} Duplication check result
 */
async function checkPatientDuplications(patientId, newMedications = []) {
  try {
    // Get patient's active prescriptions
    const activePrescriptions = await Prescription.find({
      patient: patientId,
      status: { $in: ['active', 'dispensed'] }
    }).lean();

    // Collect all current medications
    const currentMedications = [];
    for (const rx of activePrescriptions) {
      for (const med of rx.medications || []) {
        currentMedications.push({
          ...med,
          prescriptionId: rx._id,
          prescriptionDate: rx.createdAt
        });
      }
    }

    // Add new medications for combined analysis
    const allMedications = [
      ...currentMedications,
      ...newMedications.map(m => ({ ...m, isNew: true }))
    ];

    // Check for duplications
    const result = checkDuplications(allMedications);

    // Identify new duplications (involving new medications)
    const newDuplications = result.duplications.filter(dup =>
      dup.medications.some(m => m.isNew || newMedications.some(nm =>
        normalizeDrugName(nm.name || nm.genericName).includes(m.matchedAs)
      ))
    );

    return {
      ...result,
      currentMedicationsCount: currentMedications.length,
      newMedicationsCount: newMedications.length,
      newDuplicationsIntroduced: newDuplications,
      canProceed: newDuplications.every(d => d.severity !== 'CRITICAL'),
      requiresOverride: newDuplications.some(d => d.severity === 'CRITICAL')
    };
  } catch (error) {
    console.error('Error checking patient duplications:', error);
    throw new Error(`Duplication check failed: ${error.message}`);
  }
}

/**
 * Generate duplication alert
 * @param {String} patientId - Patient ID
 * @param {Object} duplicationData - Duplication check result
 * @returns {Object|null} Alert object
 */
function generateDuplicationAlert(patientId, duplicationData) {
  if (!duplicationData.hasDuplications) return null;

  const mostSevere = duplicationData.duplications.reduce((max, dup) => {
    const severityOrder = { CRITICAL: 3, HIGH: 2, MODERATE: 1 };
    return severityOrder[dup.severity] > severityOrder[max.severity] ? dup : max;
  }, duplicationData.duplications[0]);

  const alertSeverity = {
    CRITICAL: 'EMERGENCY',
    HIGH: 'URGENT',
    MODERATE: 'WARNING'
  };

  const recommendedActions = duplicationData.duplications.map((dup, idx) => ({
    action: `Review ${dup.className}: ${dup.medications.map(m => m.name).join(', ')}`,
    priority: idx + 1
  }));

  return {
    patient: patientId,
    severity: alertSeverity[mostSevere.severity] || 'WARNING',
    category: 'prescription',
    code: 'THERAPEUTIC_DUPLICATION',
    title: `Therapeutic Duplication Detected`,
    message: `${duplicationData.duplications.length} therapeutic class duplication(s) found. ${mostSevere.warning}`,
    triggerField: 'medications',
    triggerValue: duplicationData.duplications.map(d => d.className).join(', '),
    recommendedActions,
    duplicationDetails: duplicationData.duplications
  };
}

/**
 * Get all therapeutic class definitions
 */
function getAllTherapeuticClasses() {
  return THERAPEUTIC_CLASSES;
}

/**
 * Get therapeutic class for display/reference
 */
function getTherapeuticClassInfo(classCode) {
  return THERAPEUTIC_CLASSES[classCode] || null;
}

module.exports = {
  findTherapeuticClass,
  checkDuplications,
  checkPatientDuplications,
  generateDuplicationAlert,
  getAllTherapeuticClasses,
  getTherapeuticClassInfo,
  THERAPEUTIC_CLASSES
};
