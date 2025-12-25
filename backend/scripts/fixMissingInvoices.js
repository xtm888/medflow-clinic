/**
 * Fix visits that were completed without invoices
 * These were created by the ConsultationSession bug before it was fixed
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('fixMissingInvoices.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function fixMissingInvoices() {
  try {
    console.log('=== FIXING MISSING INVOICES ===\n');

    await mongoose.connect(MONGODB_URI);

    // Load all required models
    const Patient = require('../models/Patient');
    const Visit = require('../models/Visit');
    const Invoice = require('../models/Invoice');
    const Appointment = require('../models/Appointment');
    const Prescription = require('../models/Prescription');

    // Find completed visits without invoices
    const visitsWithoutInvoice = await Visit.find({
      status: 'completed',
      'billing.invoice': { $exists: false }
    }).populate('patient', 'firstName lastName patientId');

    if (visitsWithoutInvoice.length === 0) {
      console.log('✅ No visits missing invoices!');
      process.exit(0);
    }

    console.log(`Found ${visitsWithoutInvoice.length} visits without invoices:\n`);

    let fixed = 0;
    let failed = 0;

    for (const visit of visitsWithoutInvoice) {
      console.log(`Processing Visit ${visit.visitId}...`);
      console.log(`  Patient: ${visit.patient?.firstName} ${visit.patient?.lastName}`);
      console.log(`  Created: ${visit.createdAt}`);
      console.log(`  Status: ${visit.status}`);

      try {
        // Generate invoice manually
        const invoiceResult = await visit.generateInvoice(visit.completedBy || visit.primaryProvider);

        if (invoiceResult.invoice) {
          visit.billing.invoice = invoiceResult.invoice._id;

          // Set completedAt if missing
          if (!visit.completedAt) {
            visit.completedAt = visit.updatedAt || visit.createdAt;
          }

          await visit.save();

          console.log(`  ✅ Invoice generated: ${invoiceResult.invoice.invoiceId}`);
          console.log(`  Amount: ${invoiceResult.invoice.totalAmount} ${invoiceResult.invoice.currency}`);
          fixed++;
        } else {
          console.log(`  ⚠️ No invoice generated: ${invoiceResult.message}`);
          failed++;
        }

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        failed++;
      }

      console.log('');
    }

    console.log('=== SUMMARY ===');
    console.log(`Total visits processed: ${visitsWithoutInvoice.length}`);
    console.log(`Invoices generated: ${fixed}`);
    console.log(`Failed: ${failed}`);

    if (fixed > 0) {
      console.log('\n✅ Missing invoices have been generated!');
      console.log('Revenue recovered from previously unbilled visits.');
    }

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixMissingInvoices();
