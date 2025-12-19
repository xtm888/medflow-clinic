/**
 * Comprehensive Database Index Creation Script
 *
 * Creates optimized indexes for all collections to improve query performance.
 * This script should be run once after deployment or when schema changes.
 *
 * Usage:
 *   node backend/scripts/createOptimizedIndexes.js [--drop-existing]
 *
 * Options:
 *   --drop-existing   Drop existing indexes before creating new ones (use with caution!)
 */

const mongoose = require('mongoose');
const { PharmacyInventory } = require('../models/Inventory');
require('dotenv').config();

// Import all models to ensure they're registered
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

const OphthalmologyExam = require('../models/OphthalmologyExam');
const AuditLog = require('../models/AuditLog');

// Parse command line arguments
const dropExisting = process.argv.includes('--drop-existing');

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('\n🔧 Database Index Optimization Script\n');
    console.log(`Mode: ${dropExisting ? 'DROP & RECREATE' : 'CREATE NEW'}\n`);

    const stats = {
      created: 0,
      dropped: 0,
      errors: 0
    };

    // ==========================================
    // PATIENT INDEXES
    // ==========================================
    console.log('📊 Creating Patient indexes...');
    if (dropExisting) {
      await Patient.collection.dropIndexes();
      stats.dropped += 1;
    }

    await Patient.collection.createIndex({ patientId: 1 }, { unique: true, sparse: true });
    await Patient.collection.createIndex({ firstName: 1, lastName: 1 });
    await Patient.collection.createIndex({ dateOfBirth: 1 });
    await Patient.collection.createIndex({ phoneNumber: 1 });
    await Patient.collection.createIndex({ email: 1 }, { sparse: true });
    await Patient.collection.createIndex({ clinic: 1, createdAt: -1 });
    await Patient.collection.createIndex({ lastVisitDate: -1 });
    // Home clinic + status for active patients by clinic queries
    await Patient.collection.createIndex({ homeClinic: 1, status: 1 });
    // Allergy lookups for drug safety checks
    await Patient.collection.createIndex({ 'medicalHistory.allergies.allergen': 1 });
    // Text index for search
    await Patient.collection.createIndex(
      { firstName: 'text', lastName: 'text', patientId: 'text' },
      { weights: { patientId: 10, lastName: 5, firstName: 3 } }
    );
    stats.created += 10;
    console.log('  ✓ Patient indexes created (10)');

    // ==========================================
    // VISIT INDEXES
    // ==========================================
    console.log('📊 Creating Visit indexes...');
    if (dropExisting) {
      await Visit.collection.dropIndexes();
      stats.dropped += 1;
    }

    await Visit.collection.createIndex({ visitId: 1 }, { unique: true, sparse: true });
    await Visit.collection.createIndex({ patient: 1, visitDate: -1 });
    await Visit.collection.createIndex({ primaryProvider: 1, visitDate: -1 });
    await Visit.collection.createIndex({ status: 1 });
    await Visit.collection.createIndex({ appointment: 1 });
    await Visit.collection.createIndex({ clinic: 1, visitDate: -1 });
    // Compound indexes for common queries
    await Visit.collection.createIndex({ patient: 1, status: 1, visitDate: -1 });
    await Visit.collection.createIndex({ primaryProvider: 1, status: 1, visitDate: -1 });
    await Visit.collection.createIndex({ status: 1, visitDate: -1 });
    await Visit.collection.createIndex({ clinic: 1, status: 1, visitDate: -1 });
    // Invoice lookup
    await Visit.collection.createIndex({ 'billing.invoice': 1 });
    // Surgery-linked visits
    await Visit.collection.createIndex({ surgeryCase: 1 }, { sparse: true });
    stats.created += 12;
    console.log('  ✓ Visit indexes created (12)');

    // ==========================================
    // APPOINTMENT INDEXES
    // ==========================================
    console.log('📊 Creating Appointment indexes...');
    if (dropExisting) {
      await Appointment.collection.dropIndexes();
      stats.dropped += 1;
    }

    await Appointment.collection.createIndex({ appointmentId: 1 }, { unique: true });
    await Appointment.collection.createIndex({ patient: 1, date: -1 });
    await Appointment.collection.createIndex({ provider: 1, date: 1, status: 1 });
    await Appointment.collection.createIndex({ date: 1, startTime: 1 });
    await Appointment.collection.createIndex({ status: 1 });
    await Appointment.collection.createIndex({ type: 1, department: 1 });
    await Appointment.collection.createIndex({ clinic: 1, date: 1 });
    // Queue management indexes
    await Appointment.collection.createIndex({ date: 1, status: 1, department: 1 });
    await Appointment.collection.createIndex({ date: 1, status: 1, queueNumber: 1 });
    await Appointment.collection.createIndex({ status: 1, date: 1, priority: 1 });
    // Visit lookup (for appointment-to-visit relationships)
    await Appointment.collection.createIndex({ visit: 1 }, { sparse: true });
    stats.created += 11;
    console.log('  ✓ Appointment indexes created (11)');

    // ==========================================
    // PRESCRIPTION INDEXES
    // ==========================================
    console.log('📊 Creating Prescription indexes...');
    if (dropExisting) {
      await Prescription.collection.dropIndexes();
      stats.dropped += 1;
    }

    await Prescription.collection.createIndex({ prescriptionId: 1 }, { unique: true });
    await Prescription.collection.createIndex({ patient: 1, dateIssued: -1 });
    await Prescription.collection.createIndex({ prescriber: 1, dateIssued: -1 });
    await Prescription.collection.createIndex({ visit: 1 });
    await Prescription.collection.createIndex({ status: 1 });
    await Prescription.collection.createIndex({ pharmacyStatus: 1 });
    // Compound indexes for pharmacy workflow
    await Prescription.collection.createIndex({ status: 1, pharmacyStatus: 1, dateIssued: -1 });
    await Prescription.collection.createIndex({ patient: 1, status: 1, dateIssued: -1 });
    stats.created += 8;
    console.log('  ✓ Prescription indexes created (8)');

    // ==========================================
    // INVOICE INDEXES
    // ==========================================
    console.log('📊 Creating Invoice indexes...');
    if (dropExisting) {
      await Invoice.collection.dropIndexes();
      stats.dropped += 1;
    }

    await Invoice.collection.createIndex({ invoiceId: 1 }, { unique: true, sparse: true });
    await Invoice.collection.createIndex({ patient: 1, dateIssued: -1 });
    await Invoice.collection.createIndex({ visit: 1 });
    await Invoice.collection.createIndex({ prescription: 1 }, { sparse: true });
    await Invoice.collection.createIndex({ status: 1 });
    await Invoice.collection.createIndex({ paymentStatus: 1 });
    await Invoice.collection.createIndex({ clinic: 1, dateIssued: -1 });
    // Payment tracking
    await Invoice.collection.createIndex({ 'summary.amountDue': 1 });
    await Invoice.collection.createIndex({ dueDate: 1, paymentStatus: 1 });
    // Overdue reports (status + dueDate descending)
    await Invoice.collection.createIndex({ status: 1, dueDate: -1 });
    // Compound indexes for common queries
    await Invoice.collection.createIndex({ patient: 1, paymentStatus: 1, dateIssued: -1 });
    await Invoice.collection.createIndex({ status: 1, paymentStatus: 1, dateIssued: -1 });
    await Invoice.collection.createIndex({ clinic: 1, status: 1, dateIssued: -1 });
    stats.created += 13;
    console.log('  ✓ Invoice indexes created (13)');

    // ==========================================
    // USER INDEXES
    // ==========================================
    console.log('📊 Creating User indexes...');
    if (dropExisting) {
      await User.collection.dropIndexes();
      stats.dropped += 1;
    }

    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ active: 1 });
    await User.collection.createIndex({ clinic: 1, role: 1 });
    // Authentication
    await User.collection.createIndex({ resetPasswordToken: 1 }, { sparse: true });
    await User.collection.createIndex({ resetPasswordExpire: 1 }, { sparse: true });
    stats.created += 6;
    console.log('  ✓ User indexes created (6)');

    // ==========================================
    // PHARMACY INVENTORY INDEXES
    // ==========================================
    console.log('📊 Creating Pharmacy Inventory indexes...');
    if (dropExisting) {
      await PharmacyInventory.collection.dropIndexes();
      stats.dropped += 1;
    }

    await PharmacyInventory.collection.createIndex({ 'drug.genericName': 1 });
    await PharmacyInventory.collection.createIndex({ 'drug.brandName': 1 });
    await PharmacyInventory.collection.createIndex({ category: 1 });
    await PharmacyInventory.collection.createIndex({ 'inventory.currentStock': 1 });
    await PharmacyInventory.collection.createIndex({ clinic: 1, category: 1 });
    // Low stock alerts
    await PharmacyInventory.collection.createIndex({ 'inventory.currentStock': 1, 'inventory.reorderPoint': 1 });
    // Expiry tracking
    await PharmacyInventory.collection.createIndex({ 'batches.expirationDate': 1 });
    stats.created += 7;
    console.log('  ✓ Pharmacy Inventory indexes created (7)');

    // ==========================================
    // OPHTHALMOLOGY EXAM INDEXES
    // ==========================================
    console.log('📊 Creating Ophthalmology Exam indexes...');
    if (dropExisting) {
      await OphthalmologyExam.collection.dropIndexes();
      stats.dropped += 1;
    }

    await OphthalmologyExam.collection.createIndex({ patient: 1, examDate: -1 });
    await OphthalmologyExam.collection.createIndex({ visit: 1 });
    await OphthalmologyExam.collection.createIndex({ provider: 1, examDate: -1 });
    await OphthalmologyExam.collection.createIndex({ clinic: 1, examDate: -1 });
    stats.created += 4;
    console.log('  ✓ Ophthalmology Exam indexes created (4)');

    // ==========================================
    // AUDIT LOG INDEXES
    // ==========================================
    console.log('📊 Creating Audit Log indexes...');
    if (dropExisting) {
      await AuditLog.collection.dropIndexes();
      stats.dropped += 1;
    }

    await AuditLog.collection.createIndex({ user: 1, createdAt: -1 });
    await AuditLog.collection.createIndex({ action: 1, createdAt: -1 });
    await AuditLog.collection.createIndex({ resource: 1, createdAt: -1 });
    await AuditLog.collection.createIndex({ createdAt: -1 });
    // Critical action tracking
    await AuditLog.collection.createIndex({ action: 1, user: 1, createdAt: -1 });
    // TTL index for auto-deletion (7 years retention)
    await AuditLog.collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 } // 7 years
    );
    stats.created += 6;
    console.log('  ✓ Audit Log indexes created (6)');

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Index Creation Summary');
    console.log('='.repeat(60));
    console.log(`Total indexes created:    ${stats.created}`);
    if (dropExisting) {
      console.log(`Collections dropped:      ${stats.dropped}`);
    }
    console.log(`Errors encountered:       ${stats.errors}`);
    console.log('='.repeat(60));

    // Get index statistics
    console.log('\n📈 Index Statistics:\n');
    const collections = [
      { name: 'patients', model: Patient },
      { name: 'visits', model: Visit },
      { name: 'appointments', model: Appointment },
      { name: 'prescriptions', model: Prescription },
      { name: 'invoices', model: Invoice },
      { name: 'users', model: User },
      { name: 'pharmacyinventories', model: PharmacyInventory },
      { name: 'ophthalmologyexams', model: OphthalmologyExam },
      { name: 'auditlogs', model: AuditLog }
    ];

    for (const { name, model } of collections) {
      const indexes = await model.collection.getIndexes();
      console.log(`  ${name.padEnd(25)} : ${Object.keys(indexes).length} indexes`);
    }

    console.log('\n✅ Index optimization complete!\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Index creation failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
createIndexes();
