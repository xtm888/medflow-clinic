const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('importPatientsOnly.js');

const Clinic = require('../models/Clinic');
const Patient = require('../models/Patient');

async function importPatients() {
  console.log('\n=== IMPORTING PATIENTS ===\n');

  // Get clinics
  const matrix = await Clinic.findOne({ clinicId: 'MATRIX-001' });
  const tombalbaye = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
  const matadi = await Clinic.findOne({ clinicId: 'MATADI-001' });

  if (!matrix || !tombalbaye || !matadi) {
    throw new Error('Clinics not found! Run restoreFromLV.js first.');
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
    fs.createReadStream(patientsFile)
      .pipe(csv())
      .on('data', (row) => {
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
        let dateOfBirth = new Date('1900-01-01'); // Default for missing dates
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
        let gender = 'other'; // Default
        if (row.Sexe === 'M') gender = 'male';
        else if (row.Sexe === 'F') gender = 'female';

        // Parse marital status - map French to English
        let maritalStatus = '';
        if (row.EtatCivil) {
          const status = row.EtatCivil.trim().toLowerCase();
          if (status.includes('marié') || status.includes('marie')) {
            maritalStatus = 'married';
          } else if (status.includes('célibataire') || status.includes('celibataire')) {
            maritalStatus = 'single';
          } else if (status.includes('divorcé') || status.includes('divorce')) {
            maritalStatus = 'divorced';
          } else if (status.includes('veuf') || status.includes('veuve')) {
            maritalStatus = 'widowed';
          } else if (status.includes('séparé') || status.includes('separe')) {
            maritalStatus = 'separated';
          }
        }

        // Default phone if missing - use valid format
        const phone = row.Telephone && row.Telephone.trim() !== '' ? row.Telephone : '+243000000000';

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
          maritalStatus: maritalStatus,
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

        if (count % 5000 === 0) {
          console.log(`Processed ${count} patients...`);
        }
      })
      .on('end', async () => {
        console.log(`\nParsed ${patients.length} patients from CSV (skipped ${skipped} empty rows)`);
        console.log('Inserting into database...\n');

        try {
          const batchSize = 500;
          let totalInserted = 0;
          let totalErrors = 0;

          for (let i = 0; i < patients.length; i += batchSize) {
            const batch = patients.slice(i, i + batchSize);
            try {
              const result = await Patient.insertMany(batch, { ordered: false, rawResult: true });
              const inserted = result.insertedCount || result.length || 0;
              totalInserted += inserted;
              console.log(`✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(patients.length / batchSize)}: ${inserted}/${batch.length} patients inserted`);
            } catch (error) {
              if (error.writeErrors) {
                const inserted = batch.length - error.writeErrors.length;
                totalInserted += inserted;
                totalErrors += error.writeErrors.length;
                console.log(`⚠ Batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${batch.length} inserted, ${error.writeErrors.length} errors`);
                // Log first few errors
                if (i === 0) { // Only log errors from first batch
                  error.writeErrors.slice(0, 5).forEach(e => {
                    const doc = batch[e.index];
                    console.log(`  Error on ${doc.patientId}: ${e.err.errmsg || e.err.message}`);
                  });
                }
              } else {
                totalErrors += batch.length;
                console.log(`✗ Batch ${Math.floor(i / batchSize) + 1} FAILED:`, error.message);
              }
            }
          }

          console.log('\n=== IMPORT COMPLETE ===');
          console.log(`Inserted: ${totalInserted} patients`);
          console.log(`Errors: ${totalErrors}`);

          const dbCount = await Patient.countDocuments();
          console.log(`Database total: ${dbCount} patients\n`);

          // Show distribution
          const distribution = await Patient.aggregate([
            { $group: { _id: '$homeClinic', count: { $sum: 1 } } },
            { $lookup: { from: 'clinics', localField: '_id', foreignField: '_id', as: 'clinic' } },
            { $unwind: '$clinic' },
            { $project: { clinic: '$clinic.name', count: 1 } },
            { $sort: { count: -1 } }
          ]);

          console.log('Distribution by clinic:');
          distribution.forEach(d => {
            console.log(`  ${d.clinic}: ${d.count} patients`);
          });

          resolve(totalInserted);
        } catch (error) {
          console.error('Fatal error:', error);
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('✓ Connected to MongoDB\n');

    await importPatients();

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
