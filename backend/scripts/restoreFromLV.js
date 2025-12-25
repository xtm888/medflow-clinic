const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('restoreFromLV.js');

const Clinic = require('../models/Clinic');
const Patient = require('../models/Patient');
const User = require('../models/User');

async function createClinics() {
  console.log('\n=== SETTING UP MULTI-CLINIC STRUCTURE ===\n');

  // Check if clinics already exist
  let matrix = await Clinic.findOne({ clinicId: 'MATRIX-001' });
  if (matrix) {
    console.log('✓ Matrix clinic already exists');
    let tombalbaye = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
    let matadi = await Clinic.findOne({ clinicId: 'MATADI-001' });
    return { matrix, tombalbaye, matadi };
  }

  // Delete the temporary clinic we created earlier
  await Clinic.deleteOne({ clinicId: 'MAIN-001' });

  // Create Matrix (Main Clinic)
  matrix = await Clinic.create({
    clinicId: 'MATRIX-001',
    name: 'Centre Ophtalmologique Matrix',
    shortName: 'Matrix',
    type: 'main',
    status: 'active',
    contact: {
      phone: '+243 123 456 789',
      email: 'matrix@medflow.com'
    },
    address: {
      street: 'Avenue de la Santé',
      city: 'Kinshasa',
      province: 'Kinshasa',
      country: 'RDC'
    },
    timezone: 'Africa/Kinshasa',
    operatingHours: {
      monday: { open: '08:00', close: '18:00', closed: false },
      tuesday: { open: '08:00', close: '18:00', closed: false },
      wednesday: { open: '08:00', close: '18:00', closed: false },
      thursday: { open: '08:00', close: '18:00', closed: false },
      friday: { open: '08:00', close: '18:00', closed: false },
      saturday: { open: '08:00', close: '14:00', closed: false },
      sunday: { closed: true }
    },
    services: ['consultation', 'ophthalmology', 'pharmacy', 'laboratory', 'refraction', 'oct']
  });
  console.log('✓ Created Matrix (Main):', matrix.clinicId);

  // Create Tombalbaye (Satellite)
  const tombalbaye = await Clinic.create({
    clinicId: 'TOMBALBAYE-001',
    name: 'Centre Ophtalmologique Tombalbaye',
    shortName: 'Tombalbaye',
    type: 'satellite',
    status: 'active',
    parentClinic: matrix._id,
    contact: {
      phone: '+243 234 567 890',
      email: 'tombalbaye@medflow.com'
    },
    address: {
      street: 'Boulevard Tombalbaye',
      city: 'Kinshasa',
      province: 'Kinshasa',
      country: 'RDC'
    },
    timezone: 'Africa/Kinshasa',
    operatingHours: {
      monday: { open: '08:00', close: '18:00', closed: false },
      tuesday: { open: '08:00', close: '18:00', closed: false },
      wednesday: { open: '08:00', close: '18:00', closed: false },
      thursday: { open: '08:00', close: '18:00', closed: false },
      friday: { open: '08:00', close: '18:00', closed: false },
      saturday: { open: '08:00', close: '14:00', closed: false },
      sunday: { closed: true }
    },
    services: ['consultation', 'ophthalmology', 'pharmacy', 'refraction']
  });
  console.log('✓ Created Tombalbaye (Satellite):', tombalbaye.clinicId);

  // Create Matadi (Satellite)
  const matadi = await Clinic.create({
    clinicId: 'MATADI-001',
    name: 'Centre Ophtalmologique Matadi',
    shortName: 'Matadi',
    type: 'satellite',
    status: 'active',
    parentClinic: matrix._id,
    contact: {
      phone: '+243 345 678 901',
      email: 'matadi@medflow.com'
    },
    address: {
      street: 'Avenue du Port',
      city: 'Matadi',
      province: 'Kongo-Central',
      country: 'RDC'
    },
    timezone: 'Africa/Kinshasa',
    operatingHours: {
      monday: { open: '08:00', close: '17:00', closed: false },
      tuesday: { open: '08:00', close: '17:00', closed: false },
      wednesday: { open: '08:00', close: '17:00', closed: false },
      thursday: { open: '08:00', close: '17:00', closed: false },
      friday: { open: '08:00', close: '17:00', closed: false },
      saturday: { open: '08:00', close: '13:00', closed: false },
      sunday: { closed: true }
    },
    services: ['consultation', 'ophthalmology', 'pharmacy']
  });
  console.log('✓ Created Matadi (Satellite):', matadi.clinicId);

  return { matrix, tombalbaye, matadi };
}

async function updateAdminUser(clinics) {
  console.log('\n=== UPDATING ADMIN USER ===\n');

  const admin = await User.findOneAndUpdate(
    { role: 'admin' },
    {
      $set: {
        accessAllClinics: true,
        primaryClinic: clinics.matrix._id,
        clinics: [clinics.matrix._id, clinics.tombalbaye._id, clinics.matadi._id]
      }
    },
    { new: true }
  );

  console.log('✓ Updated admin user with access to all clinics');
}

async function importPatients(clinics) {
  console.log('\n=== IMPORTING PATIENTS ===\n');

  const patientsFile = '/Users/xtm888/Downloads/LV_Patients.csv';
  const patients = [];
  let count = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(patientsFile)
      .pipe(csv())
      .on('data', (row) => {
        // Skip header or empty rows
        if (!row.NumFiche || row.NumFiche === 'NumFiche') return;

        // Distribute patients across clinics based on patient ID
        // Matrix gets 60%, Tombalbaye 25%, Matadi 15%
        let clinic;
        const num = parseInt(row.NumFiche.replace(/[^0-9]/g, '')) || 0;
        const mod = num % 100;
        if (mod < 60) {
          clinic = clinics.matrix._id;
        } else if (mod < 85) {
          clinic = clinics.tombalbaye._id;
        } else {
          clinic = clinics.matadi._id;
        }

        // Parse birth date
        let dateOfBirth = null;
        if (row.Naissance) {
          try {
            dateOfBirth = new Date(row.Naissance);
            if (isNaN(dateOfBirth.getTime())) dateOfBirth = null;
          } catch (e) {
            console.warn(`Date parsing failed for patient ${row.NumFiche}:`, e.message);
          }
        }

        // Parse gender - default to 'other' if not specified
        let gender = 'other';
        if (row.Sexe === 'M') gender = 'male';
        else if (row.Sexe === 'F') gender = 'female';

        // Default date of birth if not parseable
        if (!dateOfBirth) {
          dateOfBirth = new Date('1900-01-01');
        }

        // Clean phone number - take first number, remove invalid chars
        let phoneNumber = row.Telephone || '';
        if (phoneNumber) {
          phoneNumber = phoneNumber.split(/[\/,]/)[0].trim(); // Take first number before / or ,
          phoneNumber = phoneNumber.replace(/[^\d+\-\s()]/g, '').trim(); // Remove invalid chars
        }
        if (!phoneNumber || phoneNumber === '' || phoneNumber.length < 6) {
          phoneNumber = '0000000000'; // Default placeholder
        }

        const patient = {
          patientId: row.NumFiche,
          firstName: row.Prenom || 'Unknown',
          lastName: row.Noms || 'Unknown',
          middleName: row.Postnom,
          gender: gender,
          dateOfBirth: dateOfBirth,
          phoneNumber: phoneNumber,
          email: row.Messagerie,
          address: {
            street: row.Avenue,
            neighborhood: row.Quartier,
            commune: row.Commune,
            city: row.Ville || 'Kinshasa',
            country: 'RDC'
          },
          occupation: row.Profession,
          maritalStatus: row.EtatCivil,
          nationality: row.Nationalite || 'Congolaise (RDC)',
          homeClinic: clinic,
          clinic: clinic,
          status: 'active',
          isDeleted: false,
          legacyIds: {
            lv: row.NumFiche
          },
          isLegacyData: true,
          insurance: {
            provider: row.Convention !== '[Patient Privé]' ? row.Convention : null,
            policyNumber: row.Code
          }
        };

        patients.push(patient);
        count++;

        if (count % 1000 === 0) {
          console.log(`Processed ${count} patients...`);
        }
      })
      .on('end', async () => {
        console.log(`\nParsed ${patients.length} patients from CSV`);
        console.log('Inserting into database...');

        try {
          // Use native MongoDB driver to bypass Mongoose validation for legacy data
          const collection = mongoose.connection.db.collection('patients');

          // Insert in batches
          const batchSize = 1000;
          let totalInserted = 0;
          let totalErrors = 0;

          // Add timestamps and _id to each patient
          const now = new Date();
          for (const patient of patients) {
            patient._id = new mongoose.Types.ObjectId();
            patient.createdAt = now;
            patient.updatedAt = now;
          }

          for (let i = 0; i < patients.length; i += batchSize) {
            const batch = patients.slice(i, i + batchSize);
            try {
              const result = await collection.insertMany(batch, { ordered: false });
              totalInserted += result.insertedCount || 0;
              console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(patients.length / batchSize)} - ${result.insertedCount} patients`);
            } catch (error) {
              // insertMany with ordered:false will still insert valid docs even if some fail
              if (error.insertedCount !== undefined) {
                totalInserted += error.insertedCount;
                const failed = batch.length - error.insertedCount;
                totalErrors += failed;
                console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${error.insertedCount} inserted, ${failed} errors`);
              } else if (error.result) {
                totalInserted += error.result.nInserted || 0;
                totalErrors += (batch.length - (error.result.nInserted || 0));
                console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${error.result.nInserted || 0} inserted, ${batch.length - (error.result.nInserted || 0)} errors`);
              } else {
                totalErrors += batch.length;
                console.log(`Batch ${Math.floor(i / batchSize) + 1}: FAILED -`, error.message);
              }
            }
          }

          console.log(`\n✓ Import complete: ${totalInserted} patients inserted, ${totalErrors} errors`);

          // Count actual patients in database
          const dbCount = await Patient.countDocuments();
          console.log(`Database now contains: ${dbCount} patients`);

          resolve(totalInserted);
        } catch (error) {
          console.error('Error inserting patients:', error);
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Step 1: Create clinics
    const clinics = await createClinics();

    // Step 2: Update admin user
    await updateAdminUser(clinics);

    // Step 3: Import patients
    const patientCount = await importPatients(clinics);

    console.log('\n=== RESTORATION COMPLETE ===');
    console.log('Clinics created: 3');
    console.log('Patients imported:', patientCount);
    console.log('\nClinic distribution:');
    console.log('  Matrix (main): ~60%');
    console.log('  Tombalbaye (satellite): ~25%');
    console.log('  Matadi (satellite): ~15%');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
