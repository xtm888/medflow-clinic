const mongoose = require('mongoose');
const fs = require('fs');
const Papa = require('papaparse');
require('dotenv').config();

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('importPatientsWithPapa.js');

const Clinic = require('../models/Clinic');
const Patient = require('../models/Patient');

async function importPatients() {
  console.log('\n=== IMPORTING PATIENTS WITH PAPAPARSE ===\n');

  // Get clinics
  const matrix = await Clinic.findOne({ clinicId: 'MATRIX_KIN' });
  const tombalbaye = await Clinic.findOne({ clinicId: 'TOMBALBAYE_KIN' });
  const matadi = await Clinic.findOne({ clinicId: 'MATADI_KC' });

  if (!matrix || !tombalbaye || !matadi) {
    throw new Error('Clinics not found!');
  }

  console.log('Found clinics:');
  console.log(' - Matrix:', matrix._id);
  console.log(' - Tombalbaye:', tombalbaye._id);
  console.log(' - Matadi:', matadi._id);
  console.log('');

  const patientsFile = '/Users/xtm888/Downloads/LV_Patients.csv';
  const fileContent = fs.readFileSync(patientsFile, 'utf8');

  console.log('Parsing CSV file...');
  const parseResult = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (parseResult.errors.length > 0) {
    console.log('Parse errors:', parseResult.errors.length);
    parseResult.errors.slice(0, 5).forEach(err => {
      console.log('  -', err.message, 'at row', err.row);
    });
  }

  console.log(`Parsed ${parseResult.data.length} records from CSV\n`);

  const patients = [];
  let skipped = 0;
  const patientIndex = 0;

  for (const row of parseResult.data) {
    // Skip if no patient ID
    if (!row.NumFiche || row.NumFiche.trim() === '' || row.NumFiche === 'NumFiche') {
      skipped++;
      continue;
    }

    // ALL patients go to Tombalbaye (this backup is only for Tombalbaye)
    // Matrix and Matadi data will be imported separately when available
    const clinic = tombalbaye._id;

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
  }

  console.log(`Prepared ${patients.length} patients for import (skipped ${skipped})`);
  console.log('Inserting into database...\n');

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
        // Log first few errors from first batch
        if (i === 0) {
          error.writeErrors.slice(0, 5).forEach(e => {
            const doc = batch[e.index];
            console.log(`  Error on ${doc.patientId}: ${e.errmsg || e.err?.message}`);
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
    { $project: { clinicId: '$clinic.clinicId', name: '$clinic.name', count: 1 } },
    { $sort: { count: -1 } }
  ]);

  console.log('Distribution by clinic:');
  distribution.forEach(d => {
    console.log(`  ${d.name} (${d.clinicId}): ${d.count} patients`);
  });

  return totalInserted;
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
