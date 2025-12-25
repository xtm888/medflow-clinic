require('dotenv').config();
const { requireNonProduction } = require('./_guards');
requireNonProduction('testPharmacyInvoice.js');

const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

  // Register all required models
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Visit = require('../models/Visit');
  const Invoice = require('../models/Invoice');
  const Prescription = require('../models/Prescription');

  console.log('=== Looking for visits with prescriptions ===');

  // Find visits that have prescriptions
  const visits = await Visit.find({
    prescriptions: { $exists: true, $ne: [] }
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('prescriptions')
    .limit(5)
    .lean();

  console.log(`Found ${visits.length} visits with prescriptions`);

  if (visits.length === 0) {
    console.log('No visits with prescriptions found.');
    console.log('\n=== Creating test data ===');

    // Find a patient
    const patient = await Patient.findOne();

    if (!patient) {
      console.log('No patients found. Create a patient first.');
      process.exit(1);
    }

    console.log(`Using patient: ${patient.firstName} ${patient.lastName}`);

    // Create a new visit
    const visit = await Visit.create({
      patient: patient._id,
      type: 'consultation',
      status: 'checked_in',
      priority: 'normal',
      chiefComplaint: 'Test for pharmacy invoice',
      location: { type: 'clinic', clinic: mongoose.Types.ObjectId() }
    });

    console.log(`Created visit: ${visit._id}`);

    // Create a prescription with medications
    const prescription = await Prescription.create({
      patient: patient._id,
      visit: visit._id,
      prescribedBy: mongoose.Types.ObjectId(),
      type: 'medication',
      status: 'active',
      pharmacyStatus: 'pending',
      medications: [
        {
          name: 'Paracetamol 500mg',
          genericName: 'Acetaminophen',
          dosage: '500mg',
          form: 'tablet',
          frequency: '3x/jour',
          duration: '5 jours',
          quantity: 15,
          pricing: {
            unitPrice: 500,
            totalCost: 7500
          }
        },
        {
          name: 'Amoxicilline 250mg',
          genericName: 'Amoxicillin',
          dosage: '250mg',
          form: 'capsule',
          frequency: '2x/jour',
          duration: '7 jours',
          quantity: 14,
          pricing: {
            unitPrice: 1000,
            totalCost: 14000
          }
        }
      ]
    });

    console.log(`Created prescription: ${prescription._id}`);

    // Add prescription to visit
    visit.prescriptions = [prescription._id];
    await visit.save();

    // Generate invoice
    console.log('\n=== Generating invoice ===');
    const invoice = await visit.generateInvoice({ generateInvoiceNumber: true });
    console.log(`Invoice created: ${invoice._id}`);
    console.log(`Invoice number: ${invoice.invoiceNumber}`);
    console.log(`Invoice items: ${invoice.items.length}`);

    // Show medication items
    const medItems = invoice.items.filter(i => i.category === 'medication');
    console.log(`\nMedication items (${medItems.length}):`);
    medItems.forEach(item => {
      console.log(`  - ${item.description}: ${item.quantity} x ${item.unitPrice} = ${item.total} (status: ${item.status})`);
    });

    console.log(`\n=== TEST PHARMACY ENDPOINT WITH VISIT ID: ${visit._id} ===`);
  } else {
    // Use existing visit
    for (const visit of visits) {
      console.log(`\nVisit: ${visit._id}`);
      console.log(`  Patient: ${visit.patient?.firstName} ${visit.patient?.lastName}`);
      console.log(`  Prescriptions: ${visit.prescriptions?.length || 0}`);

      // Check if this visit has an invoice
      const invoice = await Invoice.findOne({ visit: visit._id });
      if (invoice) {
        console.log(`  Has invoice: ${invoice._id}`);
        const medItems = invoice.items?.filter(i => i.category === 'medication') || [];
        console.log(`  Medication items: ${medItems.length}`);
        if (medItems.length > 0) {
          console.log(`\n=== TEST PHARMACY ENDPOINT WITH VISIT ID: ${visit._id} ===`);
          break;
        }
      } else {
        console.log('  No invoice - generating one...');
        try {
          const fullVisit = await Visit.findById(visit._id);
          const invoice = await fullVisit.generateInvoice({ generateInvoiceNumber: true });
          console.log(`  Generated invoice: ${invoice._id}`);
          const medItems = invoice.items?.filter(i => i.category === 'medication') || [];
          console.log(`  Medication items: ${medItems.length}`);
          if (medItems.length > 0) {
            console.log(`\n=== TEST PHARMACY ENDPOINT WITH VISIT ID: ${visit._id} ===`);
            break;
          }
        } catch (err) {
          console.log(`  Failed to generate invoice: ${err.message}`);
        }
      }
    }
  }

  await mongoose.disconnect();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
