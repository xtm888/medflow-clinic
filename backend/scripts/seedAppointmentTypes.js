const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const AppointmentType = require('../models/AppointmentType');
const ClinicalAct = require('../models/ClinicalAct');
require('dotenv').config();

// Generate unique type ID
function generateTypeId(name, index) {
  const prefix = 'APPT';
  const year = new Date().getFullYear();
  const paddedIndex = String(index).padStart(4, '0');
  return `${prefix}${year}${paddedIndex}`;
}

// Map category to scheduling rules
function getSchedulingRules(category, name) {
  const nameLower = name.toLowerCase();

  const rules = {
    allowOnline: false,
    requiresApproval: false,
    minAdvanceBooking: 1, // hours
    maxAdvanceBooking: 90, // days
    allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    bufferBefore: 0,
    bufferAfter: 0
  };

  // Consultations can be booked online
  if (category === 'consultation' && !nameLower.includes('emergency') && !nameLower.includes('urgence')) {
    rules.allowOnline = true;
    rules.minAdvanceBooking = 24; // 24 hours advance
  }

  // Surgical procedures require approval
  if (category === 'surgical' || category === 'laser') {
    rules.requiresApproval = true;
    rules.minAdvanceBooking = 168; // 1 week
    rules.bufferBefore = 30;
    rules.bufferAfter = 30;

    // Surgeries typically only certain days
    if (nameLower.includes('chirurgie') || nameLower.includes('surgery')) {
      rules.allowedDays = ['tuesday', 'wednesday', 'thursday'];
      rules.maxPerDay = 8;
    }
  }

  // Imaging can be booked with short notice
  if (category === 'imaging' || category === 'diagnostic') {
    rules.allowOnline = true;
    rules.minAdvanceBooking = 12; // 12 hours
  }

  // Emergency appointments
  if (nameLower.includes('urgence') || nameLower.includes('emergency')) {
    rules.allowOnline = false;
    rules.minAdvanceBooking = 0;
    rules.allowedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  }

  // IVT injections
  if (nameLower.includes('ivt') || nameLower.includes('injection')) {
    rules.allowOnline = false;
    rules.requiresApproval = true;
    rules.minAdvanceBooking = 48; // 2 days
    rules.bufferAfter = 15; // observation time
  }

  return rules;
}

// Map procedure to required staff
function getRequiredStaff(category, procedure) {
  const staff = [];

  if (category === 'surgical') {
    staff.push({ role: 'ophthalmologist', quantity: 1, required: true });
    staff.push({ role: 'nurse', quantity: 1, required: true });
    staff.push({ role: 'assistant', quantity: 1, required: false });

    if (procedure.anesthesiaType === 'general') {
      staff.push({ role: 'anesthetist', quantity: 1, required: true });
    }
  } else if (category === 'consultation') {
    staff.push({ role: 'doctor', quantity: 1, required: true });
  } else if (category === 'diagnostic' || category === 'imaging') {
    staff.push({ role: 'lab_technician', quantity: 1, required: true });
  } else if (category === 'laser' || category === 'injection') {
    staff.push({ role: 'ophthalmologist', quantity: 1, required: true });
    staff.push({ role: 'nurse', quantity: 1, required: false });
  } else {
    staff.push({ role: 'doctor', quantity: 1, required: true });
  }

  return staff;
}

// Determine room requirements
function getRoomRequirements(category, procedure) {
  const requirements = {
    type: 'exam_room',
    features: [],
    minSize: 15
  };

  if (category === 'surgical') {
    requirements.type = 'operating_room';
    requirements.features = ['sterile', 'monitoring', 'anesthesia_equipment'];
    requirements.minSize = 30;
  } else if (category === 'laser') {
    requirements.type = 'procedure_room';
    requirements.features = ['laser', 'slit_lamp', 'darkroom'];
    requirements.minSize = 20;
  } else if (category === 'imaging') {
    requirements.type = 'imaging_room';
    requirements.features = ['darkroom', 'imaging_equipment'];
    requirements.minSize = 15;
  } else if (category === 'consultation') {
    requirements.type = 'consultation_room';
    requirements.features = ['slit_lamp', 'tonometer'];
    requirements.minSize = 12;
  }

  return requirements;
}

// Determine ophthalmic details
function getOphthalmicDetails(procedure, category) {
  const details = {};
  const nameLower = procedure.nameFr.toLowerCase();

  // Procedures that require dilation
  if (category === 'diagnostic' && (
    nameLower.includes('fond') ||
    nameLower.includes('retino') ||
    nameLower.includes('angio') ||
    nameLower.includes('oct')
  )) {
    details.requiresDilation = true;
    details.dilationTime = 30;
    details.affectsVision = true;
  }

  // Procedures that require pressure check
  if (nameLower.includes('tono') ||
      nameLower.includes('pression') ||
      nameLower.includes('glaucom')) {
    details.requiresPressureCheck = true;
  }

  // Procedures that can be bilateral
  if (!nameLower.includes('od') && !nameLower.includes('os') &&
      (category === 'diagnostic' || category === 'imaging' || category === 'consultation')) {
    details.canBeBilateral = true;
    details.eye = 'OU';
  } else {
    details.eye = 'NA';
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

// Get patient preparation instructions
function getPatientPreparation(procedure, category) {
  const preparation = {
    before: [],
    during: [],
    after: []
  };

  // Surgical prep
  if (category === 'surgical') {
    preparation.before.push({
      instruction: 'Fast for 6 hours before surgery',
      instructionFr: 'Jeûner 6 heures avant la chirurgie',
      timing: '6 hours before',
      required: true
    });
    preparation.before.push({
      instruction: 'Arrange transportation home',
      instructionFr: 'Organiser le transport pour rentrer à la maison',
      timing: 'day before',
      required: true
    });

    preparation.during.push({
      instruction: 'Remain calm and follow surgeon instructions',
      instructionFr: 'Rester calme et suivre les instructions du chirurgien'
    });

    preparation.after.push({
      instruction: 'Rest and avoid strenuous activity',
      instructionFr: 'Se reposer et éviter les activités intenses',
      duration: '1 week'
    });
    preparation.after.push({
      instruction: 'Use prescribed eye drops as directed',
      instructionFr: 'Utiliser les gouttes oculaires prescrites selon les instructions',
      duration: '4 weeks'
    });
  }

  // Laser procedures
  if (category === 'laser') {
    preparation.before.push({
      instruction: 'No eye makeup on day of procedure',
      instructionFr: 'Pas de maquillage des yeux le jour de la procédure',
      timing: 'day of',
      required: true
    });

    preparation.after.push({
      instruction: 'Avoid driving for 24 hours',
      instructionFr: 'Éviter de conduire pendant 24 heures',
      duration: '24 hours'
    });
  }

  // IVT injections
  if (procedure.nameFr.toLowerCase().includes('ivt')) {
    preparation.before.push({
      instruction: 'Remove contact lenses',
      instructionFr: 'Retirer les lentilles de contact',
      timing: '1 hour before',
      required: true
    });

    preparation.after.push({
      instruction: 'Use antibiotic drops as prescribed',
      instructionFr: 'Utiliser les gouttes antibiotiques selon prescription',
      duration: '3 days'
    });
    preparation.after.push({
      instruction: 'Report any pain, redness, or vision changes immediately',
      instructionFr: 'Signaler immédiatement toute douleur, rougeur ou changement de vision',
      duration: '1 week'
    });
  }

  // Dilated exams
  if (procedure.nameFr.toLowerCase().includes('fond') ||
      procedure.nameFr.toLowerCase().includes('angio')) {
    preparation.before.push({
      instruction: 'Arrange transportation (vision will be blurred)',
      instructionFr: 'Organiser le transport (la vision sera floue)',
      timing: 'day of',
      required: true
    });

    preparation.after.push({
      instruction: 'Wear sunglasses for light sensitivity',
      instructionFr: 'Porter des lunettes de soleil pour la sensibilité à la lumière',
      duration: '4-6 hours'
    });
  }

  return preparation;
}

// Map category to valid AppointmentType category
function mapCategory(category) {
  const categoryMap = {
    'anesthesia': 'surgical', // anesthesia is usually for surgical procedures
    'other': 'consultation', // general fallback
    'procedure': 'diagnostic',
    'examination': 'diagnostic',
    'laboratory': 'diagnostic',
    'therapy': 'therapy',
    'vaccination': 'consultation',
    'screening': 'diagnostic'
  };

  // If category is already valid, return it
  const validCategories = ['consultation', 'diagnostic', 'imaging', 'surgical', 'laser', 'injection', 'therapy', 'follow-up', 'emergency'];
  if (validCategories.includes(category)) {
    return category;
  }

  // Otherwise map it
  return categoryMap[category] || 'consultation';
}

// Create appointment type from procedure
function createAppointmentType(procedure, index) {
  // Parse duration - handle non-numeric values like "variable"
  let duration = 30; // default
  if (procedure.duration) {
    const parsedDuration = parseInt(procedure.duration);
    if (!isNaN(parsedDuration) && parsedDuration > 0) {
      duration = parsedDuration;
    }
  }

  // Map category to valid AppointmentType category
  const mappedCategory = mapCategory(procedure.category);

  const typeDoc = {
    typeId: generateTypeId(procedure.nameFr, index),
    name: procedure.nameEn,
    nameFr: procedure.nameFr,
    category: mappedCategory,
    subcategory: procedure.subcategory,
    description: procedure.description,
    descriptionFr: procedure.description,
    duration: {
      estimated: duration,
      preparation: mappedCategory === 'surgical' ? 30 : 0,
      recovery: mappedCategory === 'surgical' ? 60 : (mappedCategory === 'laser' ? 15 : 0)
    },
    requiredStaff: getRequiredStaff(mappedCategory, procedure),
    requiredEquipment: procedure.requiredEquipment?.map(eq => ({
      name: eq,
      nameFr: eq,
      required: true
    })) || [],
    roomRequirements: getRoomRequirements(mappedCategory, procedure),
    schedulingRules: getSchedulingRules(mappedCategory, procedure.nameFr),
    anesthesiaRequired: procedure.anesthesiaType || 'none',
    ophthalmicDetails: getOphthalmicDetails(procedure, mappedCategory),
    patientPreparation: getPatientPreparation(procedure, mappedCategory),
    active: true,
    department: 'ophthalmology',
    priority: mappedCategory === 'surgical' ? 10 : (mappedCategory === 'consultation' ? 5 : 3),
    tags: [mappedCategory, procedure.subcategory].filter(Boolean)
  };

  // Add billing information
  const pricingMap = {
    'consultation': { min: 50, max: 150 },
    'diagnostic': { min: 75, max: 250 },
    'imaging': { min: 100, max: 500 },
    'surgical': { min: 1000, max: 5000 },
    'laser': { min: 300, max: 1500 },
    'injection': { min: 150, max: 800 }
  };

  const pricing = pricingMap[mappedCategory] || { min: 50, max: 200 };

  typeDoc.billing = {
    cptCode: procedure.cptCode,
    insuranceCoverage: mappedCategory === 'surgical' ? 'partial' : 'varies',
    estimatedCost: {
      min: pricing.min,
      max: pricing.max,
      currency: 'EUR'
    }
  };

  // Add documentation requirements for surgical procedures
  if (mappedCategory === 'surgical' || mappedCategory === 'laser') {
    typeDoc.documentation = {
      consentFormRequired: true,
      photographsAllowed: true,
      recordingAllowed: false
    };
  }

  // Add follow-up requirements for surgical/laser/injection
  if (['surgical', 'laser', 'injection'].includes(mappedCategory)) {
    typeDoc.followUp = {
      required: true,
      defaultTiming: mappedCategory === 'surgical' ? '1 day, 1 week, 1 month' : '1 week'
    };
  }

  return typeDoc;
}

// Main seeding function
async function seedAppointmentTypes() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/care-vision');
    console.log('Connected to MongoDB');

    // Read clinical procedures JSON file
    console.log('Reading clinical procedures data...');
    const dataPath = path.join(__dirname, '../data/clinical-procedures.json');
    const jsonData = await fs.readFile(dataPath, 'utf-8');
    const proceduresData = JSON.parse(jsonData);

    console.log(`Found ${proceduresData.procedures.length} procedures to convert to appointment types`);

    // Clear existing appointment types (optional)
    console.log('Clearing existing appointment types...');
    await AppointmentType.deleteMany({ department: 'ophthalmology' });

    let totalProcessed = 0;
    let totalCreated = 0;
    const errors = [];

    // Process each procedure
    console.log('\nProcessing appointment types...');
    for (let i = 0; i < proceduresData.procedures.length; i++) {
      const procedure = proceduresData.procedures[i];
      totalProcessed++;

      try {
        // Create appointment type
        const typeDoc = createAppointmentType(procedure, i + 1);

        // Create new appointment type
        const created = await AppointmentType.create(typeDoc);
        totalCreated++;

        if (totalCreated % 20 === 0) {
          console.log(`  - Created ${totalCreated} appointment types so far...`);
        }

        // Try to link to clinical act if it exists
        const clinicalAct = await ClinicalAct.findOne({
          nameFr: procedure.nameFr,
          category: procedure.category
        });

        if (clinicalAct) {
          created.clinicalAct = clinicalAct._id;
          await created.save();
        }
      } catch (error) {
        errors.push({
          procedure: procedure.nameFr,
          error: error.message
        });
        console.error(`  - Error creating ${procedure.nameFr}: ${error.message}`);
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total procedures processed: ${totalProcessed}`);
    console.log(`Total appointment types created: ${totalCreated}`);
    console.log(`Total errors: ${errors.length}`);

    if (errors.length > 0 && errors.length < 20) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.procedure}: ${err.error}`);
      });
    }

    console.log('\n✓ Appointment types seeding completed successfully!');

    // Verify count and display summary
    const count = await AppointmentType.countDocuments({ department: 'ophthalmology' });
    console.log(`\nTotal ophthalmology appointment types in database: ${count}`);

    // Display category breakdown
    console.log('\nCategory breakdown:');
    const categories = await AppointmentType.aggregate([
      { $match: { department: 'ophthalmology' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    categories.forEach(cat => {
      console.log(`  - ${cat._id}: ${cat.count} types`);
    });

    // Display online bookable count
    const onlineBookable = await AppointmentType.countDocuments({
      department: 'ophthalmology',
      'schedulingRules.allowOnline': true
    });
    console.log(`\nOnline bookable appointments: ${onlineBookable}`);

  } catch (error) {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedAppointmentTypes()
    .then(() => {
      console.log('\nSeeding script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nSeeding script failed:', error);
      process.exit(1);
    });
}

module.exports = seedAppointmentTypes;
