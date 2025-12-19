const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const ClinicalAct = require('../models/ClinicalAct');
require('dotenv').config();

// Generate unique act ID
function generateActId(name, index) {
  const prefix = 'ACT';
  const year = new Date().getFullYear();
  const paddedIndex = String(index).padStart(5, '0');
  return `${prefix}${year}${paddedIndex}`;
}

// Determine required roles based on category and procedure type
function determineRequiredRoles(category, subcategory, name) {
  const nameLower = name.toLowerCase();

  if (category === 'surgical' || category === 'laser') {
    return ['doctor', 'ophthalmologist'];
  }

  if (category === 'injection' && nameLower.includes('ivt')) {
    return ['ophthalmologist'];
  }

  if (category === 'consultation') {
    if (nameLower.includes('orthoptic') || nameLower.includes('orthoptique')) {
      return ['nurse', 'ophthalmologist'];
    }
    return ['doctor', 'ophthalmologist'];
  }

  if (category === 'imaging' || category === 'diagnostic') {
    if (nameLower.includes('oct') || nameLower.includes('angio') || nameLower.includes('topo')) {
      return ['technician', 'ophthalmologist'];
    }
    if (nameLower.includes('radio') || nameLower.includes('echographie')) {
      return ['lab_technician'];
    }
    return ['nurse', 'technician', 'ophthalmologist'];
  }

  return ['doctor', 'ophthalmologist', 'nurse'];
}

// Determine department
function determineDepartment(category, name) {
  // All procedures from this document are ophthalmology-related
  if (name.toLowerCase().includes('radio') || name.toLowerCase().includes('echographie abdominale')) {
    return 'general_medicine';
  }
  return 'ophthalmology';
}

// Determine if procedure requires specific ophthalmic details
function determineOphthalmicDetails(name, category, subcategory) {
  const nameLower = name.toLowerCase();
  const details = {};

  // Cataract surgery
  if (nameLower.includes('phaco') || nameLower.includes('sics') || nameLower.includes('cataract')) {
    details.isCataractSurgery = true;

    if (nameLower.includes('premium')) {
      details.iolType = 'premium';
    } else if (nameLower.includes('privilege') || nameLower.includes('privilège')) {
      details.iolType = 'multifocal';
    } else if (nameLower.includes('standard')) {
      details.iolType = 'standard';
    }
  }

  // Retinal procedures
  if (nameLower.includes('vitreo') || nameLower.includes('rétinien') || nameLower.includes('retinien') ||
      nameLower.includes('endolaser') || nameLower.includes('photocoagulation')) {
    details.isRetinalProcedure = true;
  }

  // Glaucoma procedures
  if (nameLower.includes('glaucom') || nameLower.includes('trabeculectomie') ||
      nameLower.includes('sclerectomie') || nameLower.includes('slt') || nameLower.includes('iridotomie')) {
    details.isGlaucomaProcedure = true;
  }

  // Requires dilation
  if (category === 'diagnostic' && (nameLower.includes('fond') || nameLower.includes('retino') ||
      nameLower.includes('angio') || nameLower.includes('oct'))) {
    details.requiresDilation = true;
  }

  // Requires pressure check
  if (nameLower.includes('tono') || nameLower.includes('pression') ||
      details.isGlaucomaProcedure || details.isRetinalProcedure) {
    details.requiresPressureCheck = true;
  }

  // Refractive surgery
  if (nameLower.includes('refract') || nameLower.includes('kératoplastie') ||
      nameLower.includes('keratoplastie')) {
    details.isRefractiveSurgery = true;
  }

  return Object.keys(details).length > 0 ? details : null;
}

// Create clinical act document from procedure data
function createClinicalActDocument(procedure, index) {
  // Parse duration - handle non-numeric values like "variable"
  let duration = 30; // default
  if (procedure.duration) {
    const parsedDuration = parseInt(procedure.duration);
    if (!isNaN(parsedDuration) && parsedDuration > 0) {
      duration = parsedDuration;
    }
  }

  const actDoc = {
    actId: generateActId(procedure.nameFr, index),
    name: procedure.nameEn,
    nameFr: procedure.nameFr,
    category: procedure.category,
    subCategory: procedure.subcategory || procedure.category,
    description: procedure.description,
    descriptionFr: procedure.description,
    duration: duration,
    cptCode: procedure.cptCode || undefined,
    anesthesiaType: procedure.anesthesiaType,
    requiredRole: determineRequiredRoles(procedure.category, procedure.subcategory, procedure.nameFr),
    requiredEquipment: procedure.requiredEquipment || [],
    department: determineDepartment(procedure.category, procedure.nameFr),
    active: true
  };

  // Add instructions if available
  if (procedure.preOpInstructions || procedure.postOpInstructions) {
    actDoc.instructions = {
      preInstructions: procedure.preOpInstructions ? procedure.preOpInstructions.join('; ') : '',
      preInstructionsFr: procedure.preOpInstructions ? procedure.preOpInstructions.join('; ') : '',
      postInstructions: procedure.postOpInstructions ? procedure.postOpInstructions.join('; ') : '',
      postInstructionsFr: procedure.postOpInstructions ? procedure.postOpInstructions.join('; ') : '',
      followUpRequired: procedure.postOpInstructions && procedure.postOpInstructions.length > 0,
      followUpTiming: procedure.category === 'surgical' ? '1 day, 1 week, 1 month' : undefined
    };
  }

  // Add ophthalmic-specific details
  const ophthalmicDetails = determineOphthalmicDetails(procedure.nameFr, procedure.category, procedure.subcategory);
  if (ophthalmicDetails) {
    actDoc.ophthalmicDetails = ophthalmicDetails;
  }

  // Add pricing (basic estimates - should be customized)
  const pricingMap = {
    'consultation': 50,
    'diagnostic': 75,
    'imaging': 100,
    'surgical': 1500,
    'laser': 500,
    'injection': 200,
    'anesthesia': 200
  };

  actDoc.pricing = {
    basePrice: pricingMap[procedure.category] || 50,
    insuranceCode: procedure.cptCode || undefined
  };

  return actDoc;
}

// Main seeding function
async function seedClinicalProcedures() {
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

    console.log(`Found ${proceduresData.procedures.length} clinical procedures`);

    // Clear existing clinical procedures (optional - comment out to preserve existing data)
    console.log('Clearing existing ophthalmology clinical procedures...');
    await ClinicalAct.deleteMany({ department: 'ophthalmology' });

    let totalProcessed = 0;
    let totalCreated = 0;
    const errors = [];

    // Process each procedure
    console.log('\nProcessing clinical procedures...');
    for (let i = 0; i < proceduresData.procedures.length; i++) {
      const procedure = proceduresData.procedures[i];
      totalProcessed++;

      try {
        // Create clinical act document
        const actDoc = createClinicalActDocument(procedure, i + 1);

        // Check if procedure already exists
        const existingAct = await ClinicalAct.findOne({
          name: actDoc.name,
          category: actDoc.category
        });

        if (existingAct) {
          console.log(`  - Skipping duplicate: ${procedure.nameFr}`);
          continue;
        }

        // Create new clinical act
        await ClinicalAct.create(actDoc);
        totalCreated++;

        if (totalCreated % 20 === 0) {
          console.log(`  - Created ${totalCreated} procedures so far...`);
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
    console.log(`Total procedures created: ${totalCreated}`);
    console.log(`Total errors: ${errors.length}`);

    if (errors.length > 0 && errors.length < 20) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.procedure}: ${err.error}`);
      });
    }

    console.log('\n✓ Clinical procedures seeding completed successfully!');

    // Verify count and display summary
    const count = await ClinicalAct.countDocuments({ department: 'ophthalmology' });
    console.log(`\nTotal ophthalmology procedures in database: ${count}`);

    // Display category breakdown
    console.log('\nCategory breakdown:');
    const categories = await ClinicalAct.aggregate([
      { $match: { department: 'ophthalmology' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    categories.forEach(cat => {
      console.log(`  - ${cat._id}: ${cat.count} procedures`);
    });

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
  seedClinicalProcedures()
    .then(() => {
      console.log('\nSeeding script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nSeeding script failed:', error);
      process.exit(1);
    });
}

module.exports = seedClinicalProcedures;
