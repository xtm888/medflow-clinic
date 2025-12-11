const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const Clinic = require('../models/Clinic');
const Patient = require('../models/Patient');

async function diagnosticImport() {
  console.log('\n=== DIAGNOSTIC PATIENT IMPORT ===\n');

  // Get clinics
  const matrix = await Clinic.findOne({ clinicId: 'MATRIX-001' });
  const tombalbaye = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
  const matadi = await Clinic.findOne({ clinicId: 'MATADI-001' });

  if (!matrix || !tombalbaye || !matadi) {
    throw new Error('Clinics not found!');
  }

  console.log('Found clinics:');
  console.log(' - Matrix:', matrix._id);
  console.log(' - Tombalbaye:', tombalbaye._id);
  console.log(' - Matadi:', matadi._id);
  console.log('');

  const patientsFile = '/Users/xtm888/Downloads/LV_Patients.csv';
  const patients = [];
  let count = 0;
  let skipped = 0;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(patientsFile)
      .pipe(csv())
      .on('data', (row) => {
        // Stop processing after 100 records
        if (count >= 100) {
          return;
        }

        // Skip if no patient ID
        if (!row.NumFiche || row.NumFiche.trim() === '' || row.NumFiche === 'NumFiche') {
          skipped++;
          return;
        }

        // Distribute patients across clinics
        let clinic;
        const num = parseInt(row.NumFiche.replace(/[^0-9]/g, '')) || 0;
        const mod = num % 100;
        if (mod < 60) {
          clinic = matrix._id;
        } else if (mod < 85) {
          clinic = tombalbaye._id;
        } else {
          clinic = matadi._id;
        }

        // Parse birth date - REQUIRED, use default if missing
        let dateOfBirth = new Date('1900-01-01');
        if (row.Naissance) {
          try {
            const parsed = new Date(row.Naissance);
            if (!isNaN(parsed.getTime())) {
              dateOfBirth = parsed;
            }
          } catch (e) {
            console.warn(`Date parsing failed for patient ${row.NumFiche}:`, e.message);
          }
        }

        // Parse gender - REQUIRED, use 'other' if missing
        let gender = 'other';
        if (row.Sexe === 'M') gender = 'male';
        else if (row.Sexe === 'F') gender = 'female';

        // Default phone if missing
        const phone = row.Telephone && row.Telephone.trim() !== '' ? row.Telephone : '0000000000';

        const patient = {
          patientId: row.NumFiche.trim(),
          firstName: row.Prenom && row.Prenom.trim() !== '' ? row.Prenom.trim() : 'N/A',
          lastName: row.Noms && row.Noms.trim() !== '' ? row.Noms.trim() : 'N/A',
          middleName: row.Postnom && row.Postnom.trim() !== '' ? row.Postnom.trim() : undefined,
          gender: gender,
          dateOfBirth: dateOfBirth,
          phoneNumber: phone,
          email: row.Messagerie && row.Messagerie.trim() !== '' ? row.Messagerie.trim() : undefined,
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
            lv: row.NumFiche.trim()
          },
          isLegacyData: true,
          insurance: {
            provider: row.Convention && row.Convention !== '[Patient Privé]' ? row.Convention : null,
            policyNumber: row.Code
          }
        };

        patients.push(patient);
        count++;

        // Destroy stream after collecting 100 records
        if (count >= 100) {
          stream.destroy();
        }
      })
      .on('close', async () => {
        console.log(`Parsed ${patients.length} patients from CSV (skipped ${skipped} empty rows)`);
        console.log('\n=== VALIDATION TEST (First 10 records) ===\n');

        // Test validation on first 10 records
        for (let i = 0; i < Math.min(10, patients.length); i++) {
          const patientData = patients[i];
          console.log(`\nRecord ${i + 1}: ${patientData.patientId} - ${patientData.firstName} ${patientData.lastName}`);

          try {
            const patient = new Patient(patientData);
            const validationError = patient.validateSync();

            if (validationError) {
              console.log('  ❌ Validation FAILED:');
              Object.keys(validationError.errors).forEach(key => {
                console.log(`    - ${key}: ${validationError.errors[key].message}`);
              });
            } else {
              console.log('  ✓ Validation passed');
            }
          } catch (err) {
            console.log('  ❌ Error creating patient:', err.message);
          }
        }

        console.log('\n\n=== ATTEMPTING SMALL BATCH INSERT ===\n');

        // Try inserting first 10 records
        const testBatch = patients.slice(0, 10);
        try {
          const result = await Patient.insertMany(testBatch, { ordered: false, rawResult: true });
          console.log(`✓ Successfully inserted: ${result.insertedCount || result.length || 0} patients`);
        } catch (error) {
          if (error.writeErrors) {
            console.log(`⚠ Inserted: ${testBatch.length - error.writeErrors.length}/${testBatch.length}`);
            console.log(`\nWrite Errors (${error.writeErrors.length}):`);
            error.writeErrors.forEach((e, idx) => {
              const doc = testBatch[e.index];
              console.log(`\n  Error ${idx + 1} on ${doc.patientId}:`);
              console.log(`    Code: ${e.code}`);
              console.log(`    Message: ${e.errmsg || e.err?.message}`);
            });
          } else {
            console.log(`✗ Batch insert FAILED:`, error.message);
          }
        }

        console.log('\n\n=== CHECKING FOR DUPLICATE PATIENT IDs IN DATABASE ===\n');

        // Check if any of these patient IDs already exist
        const patientIds = testBatch.map(p => p.patientId);
        const existing = await Patient.find({ patientId: { $in: patientIds } }, { patientId: 1, firstName: 1, lastName: 1 });

        if (existing.length > 0) {
          console.log(`Found ${existing.length} existing patients with same IDs:`);
          existing.forEach(p => {
            console.log(`  - ${p.patientId}: ${p.firstName} ${p.lastName}`);
          });
        } else {
          console.log('No duplicate patient IDs found in database.');
        }

        resolve();
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('✓ Connected to MongoDB\n');

    await diagnosticImport();

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
