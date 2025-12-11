const mongoose = require('mongoose');
require('dotenv').config();

async function createTestData() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

  // Register all required models
  const Patient = require('../models/Patient');
  const User = require('../models/User');
  const Visit = require('../models/Visit');
  const Invoice = require('../models/Invoice');
  const Prescription = require('../models/Prescription');

  console.log('=== Creating Test Pharmacy Data ===\n');

  // Find a patient
  const patient = await Patient.findOne();
  if (!patient) {
    console.log('No patients found. Create a patient first.');
    process.exit(1);
  }
  console.log(`Using patient: ${patient.firstName} ${patient.lastName} (${patient._id})`);

  // Find admin user for prescriber
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.log('No admin user found');
    process.exit(1);
  }
  console.log(`Using prescriber: ${admin.firstName} ${admin.lastName}`);

  // Create a new visit
  const visit = new Visit({
    patient: patient._id,
    type: 'consultation',
    status: 'in-progress',
    priority: 'normal',
    chiefComplaint: 'Test for pharmacy unified billing',
    clinicalNotes: 'Test consultation with medications',
    primaryProvider: admin._id
  });
  await visit.save();
  console.log(`\nCreated visit: ${visit._id}`);

  // Create a prescription with medications
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30); // Valid for 30 days

  const prescription = new Prescription({
    patient: patient._id,
    visit: visit._id,
    prescriber: admin._id,
    type: 'medication',
    status: 'pending',
    pharmacyStatus: 'pending',
    validUntil: validUntil,
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
      },
      {
        name: 'Vitamine C 1000mg',
        genericName: 'Ascorbic Acid',
        dosage: '1000mg',
        form: 'tablet',
        frequency: '1x/jour',
        duration: '30 jours',
        quantity: 30,
        pricing: {
          unitPrice: 200,
          totalCost: 6000
        }
      }
    ]
  });
  await prescription.save();
  console.log(`Created prescription: ${prescription._id}`);
  console.log(`  Medications: ${prescription.medications.length}`);
  prescription.medications.forEach(med => {
    console.log(`    - ${med.name}: ${med.quantity} x ${med.pricing.unitPrice} = ${med.pricing.totalCost} FC`);
  });

  // Add prescription to visit
  visit.prescriptions = [prescription._id];
  await visit.save();
  console.log(`Added prescription to visit`);

  // Generate invoice (which should now include medications)
  console.log('\n=== Generating Invoice ===');
  const result = await visit.generateInvoice(admin._id, { generateInvoiceNumber: true });
  const invoice = result.invoice;
  console.log(`Invoice created: ${invoice._id}`);
  console.log(`Invoice number: ${invoice.invoiceNumber}`);
  console.log(`Total items: ${invoice.items.length}`);

  // Show all items
  console.log('\nInvoice Items:');
  invoice.items.forEach(item => {
    console.log(`  [${item.category}] ${item.description}: ${item.quantity} x ${item.unitPrice} = ${item.total} (status: ${item.status})`);
  });

  // Show medication items specifically
  const medItems = invoice.items.filter(i => i.category === 'medication');
  console.log(`\n=== Medication Items (${medItems.length}) ===`);
  medItems.forEach(item => {
    console.log(`  - ${item.description}: ${item.total} FC (${item.status})`);
  });

  console.log(`\n========================================`);
  console.log(`TEST DATA READY!`);
  console.log(`========================================`);
  console.log(`Visit ID: ${visit._id}`);
  console.log(`Invoice ID: ${invoice._id}`);
  console.log(`Prescription ID: ${prescription._id}`);
  console.log(`\nTest pharmacy endpoint with:`);
  console.log(`curl -s "http://localhost:5001/api/invoices/pharmacy/${visit._id}" -H "Authorization: Bearer <TOKEN>"`);

  await mongoose.disconnect();
}

createTestData().catch(err => {
  console.error(err);
  process.exit(1);
});
