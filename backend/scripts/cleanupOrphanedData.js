/**
 * Database Cleanup Script
 * Removes all orphaned records that reference non-existent patients
 *
 * Run with: node scripts/cleanupOrphanedData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Visit = require('../models/Visit');

async function cleanupOrphanedData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB\n');

    // Get all valid patient IDs
    const patients = await Patient.find({}, '_id firstName lastName patientId');
    const validPatientIds = patients.map(p => p._id.toString());

    console.log('='.repeat(60));
    console.log('DATABASE CLEANUP REPORT');
    console.log('='.repeat(60));
    console.log(`\nFound ${patients.length} valid patients in registry:\n`);
    patients.forEach(p => {
      console.log(`  - ${p.firstName} ${p.lastName} (${p.patientId})`);
    });
    console.log('\n' + '-'.repeat(60));

    // Track cleanup results
    const results = {
      appointments: { found: 0, deleted: 0 },
      prescriptions: { found: 0, deleted: 0 },
      ophthalmologyExams: { found: 0, deleted: 0 },
      visits: { found: 0, deleted: 0 }
    };

    // 1. Clean up orphaned Appointments
    console.log('\n1. APPOINTMENTS');
    const allAppointments = await Appointment.find({});
    results.appointments.found = allAppointments.length;

    const orphanedAppointments = allAppointments.filter(apt => {
      if (!apt.patient) return true;
      return !validPatientIds.includes(apt.patient.toString());
    });

    if (orphanedAppointments.length > 0) {
      console.log(`   Found ${orphanedAppointments.length} orphaned appointments:`);
      for (const apt of orphanedAppointments) {
        console.log(`   - ID: ${apt._id}, Date: ${apt.date}, Status: ${apt.status}`);
      }

      const appointmentIds = orphanedAppointments.map(a => a._id);
      await Appointment.deleteMany({ _id: { $in: appointmentIds } });
      results.appointments.deleted = orphanedAppointments.length;
      console.log(`   DELETED ${orphanedAppointments.length} orphaned appointments`);
    } else {
      console.log('   No orphaned appointments found');
    }

    // 2. Clean up orphaned Prescriptions
    console.log('\n2. PRESCRIPTIONS');
    const allPrescriptions = await Prescription.find({});
    results.prescriptions.found = allPrescriptions.length;

    const orphanedPrescriptions = allPrescriptions.filter(rx => {
      if (!rx.patient) return true;
      return !validPatientIds.includes(rx.patient.toString());
    });

    if (orphanedPrescriptions.length > 0) {
      console.log(`   Found ${orphanedPrescriptions.length} orphaned prescriptions:`);
      for (const rx of orphanedPrescriptions) {
        console.log(`   - ID: ${rx._id}, Date: ${rx.prescriptionDate || rx.createdAt}, Status: ${rx.status}`);
      }

      const prescriptionIds = orphanedPrescriptions.map(p => p._id);
      await Prescription.deleteMany({ _id: { $in: prescriptionIds } });
      results.prescriptions.deleted = orphanedPrescriptions.length;
      console.log(`   DELETED ${orphanedPrescriptions.length} orphaned prescriptions`);
    } else {
      console.log('   No orphaned prescriptions found');
    }

    // 3. Clean up orphaned Ophthalmology Exams
    console.log('\n3. OPHTHALMOLOGY EXAMS');
    const allExams = await OphthalmologyExam.find({});
    results.ophthalmologyExams.found = allExams.length;

    const orphanedExams = allExams.filter(exam => {
      if (!exam.patient) return true;
      return !validPatientIds.includes(exam.patient.toString());
    });

    if (orphanedExams.length > 0) {
      console.log(`   Found ${orphanedExams.length} orphaned ophthalmology exams:`);
      for (const exam of orphanedExams) {
        console.log(`   - ID: ${exam._id}, Type: ${exam.examType}, Date: ${exam.createdAt}`);
      }

      const examIds = orphanedExams.map(e => e._id);
      await OphthalmologyExam.deleteMany({ _id: { $in: examIds } });
      results.ophthalmologyExams.deleted = orphanedExams.length;
      console.log(`   DELETED ${orphanedExams.length} orphaned ophthalmology exams`);
    } else {
      console.log('   No orphaned ophthalmology exams found');
    }

    // 4. Clean up orphaned Visits
    console.log('\n4. VISITS');
    const allVisits = await Visit.find({});
    results.visits.found = allVisits.length;

    const orphanedVisits = allVisits.filter(visit => {
      if (!visit.patient) return true;
      return !validPatientIds.includes(visit.patient.toString());
    });

    if (orphanedVisits.length > 0) {
      console.log(`   Found ${orphanedVisits.length} orphaned visits:`);
      for (const visit of orphanedVisits) {
        console.log(`   - ID: ${visit._id}, Date: ${visit.visitDate}, Type: ${visit.visitType}`);
      }

      const visitIds = orphanedVisits.map(v => v._id);
      await Visit.deleteMany({ _id: { $in: visitIds } });
      results.visits.deleted = orphanedVisits.length;
      console.log(`   DELETED ${orphanedVisits.length} orphaned visits`);
    } else {
      console.log('   No orphaned visits found');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`
Collection           | Total | Orphaned | Deleted
---------------------|-------|----------|--------
Appointments         | ${results.appointments.found.toString().padStart(5)} | ${results.appointments.deleted.toString().padStart(8)} | ${results.appointments.deleted.toString().padStart(7)}
Prescriptions        | ${results.prescriptions.found.toString().padStart(5)} | ${results.prescriptions.deleted.toString().padStart(8)} | ${results.prescriptions.deleted.toString().padStart(7)}
Ophthalmology Exams  | ${results.ophthalmologyExams.found.toString().padStart(5)} | ${results.ophthalmologyExams.deleted.toString().padStart(8)} | ${results.ophthalmologyExams.deleted.toString().padStart(7)}
Visits               | ${results.visits.found.toString().padStart(5)} | ${results.visits.deleted.toString().padStart(8)} | ${results.visits.deleted.toString().padStart(7)}
`);

    const totalDeleted = results.appointments.deleted +
                        results.prescriptions.deleted +
                        results.ophthalmologyExams.deleted +
                        results.visits.deleted;

    if (totalDeleted > 0) {
      console.log(`Total orphaned records removed: ${totalDeleted}`);
      console.log('\nDatabase is now consistent with patient registry.');
    } else {
      console.log('No orphaned records found. Database is already consistent.');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the cleanup
cleanupOrphanedData();
