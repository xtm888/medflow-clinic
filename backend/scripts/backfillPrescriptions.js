const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

const Visit = require('../models/Visit');
const Prescription = require('../models/Prescription');
const ConsultationSession = require('../models/ConsultationSession');
const Invoice = require('../models/Invoice');

async function backfillPrescriptions() {
  console.log('Starting prescription backfill...');

  // Find visits with clinical acts (therapy type) but no prescriptions
  const visits = await Visit.find({
    'clinicalActs.actType': 'therapy',
    prescriptions: { $size: 0 }
  });

  console.log(`Found ${visits.length} visits with medications but no prescriptions`);

  for (const visit of visits) {
    // Get the consultation session for this visit
    const session = await ConsultationSession.findOne({ visit: visit._id });
    if (!session) continue;

    const medications = session.prescription && session.prescription.medications
      ? session.prescription.medications
      : (session.sessionData && session.sessionData.prescription && session.sessionData.prescription.medications
        ? session.sessionData.prescription.medications
        : null);

    if (!medications || medications.length === 0) continue;

    // Check if invoice is paid
    const invoice = await Invoice.findOne({ visit: visit._id });
    const isPaid = invoice && invoice.status === 'paid';

    console.log(`\nVisit ${visit.visitId}:`);
    console.log(`  - Has ${medications.length} medications`);
    console.log(`  - Invoice status: ${invoice ? invoice.status : 'none'}`);

    // Create prescription record
    const prescriptionMedications = medications.map(med => ({
      name: med.name || med.medication,
      genericName: med.genericName || med.name || med.medication,
      dosage: med.dosage || '',
      frequency: med.frequency || '',
      duration: med.duration || '',
      route: med.route || 'oral',
      instructions: med.instructions || '',
      quantity: med.quantity || 1,
      unit: med.unit || 'unit'
    }));

    // Calculate validity: 90 days for medications
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 90);

    const prescriptionData = {
      patient: visit.patient,
      visit: visit._id,
      prescriber: session.doctor,
      medications: prescriptionMedications,
      // If invoice is paid, mark as dispensed
      status: isPaid ? 'dispensed' : 'pending',
      type: 'medication',
      validUntil: validUntil,
      notes: 'Backfilled from consultation session'
    };

    if (isPaid) {
      prescriptionData.dispensedAt = new Date();
      prescriptionData.dispensedBy = session.doctor;
    }

    const newPrescription = await Prescription.create(prescriptionData);

    // Link to visit
    visit.prescriptions.push(newPrescription._id);
    await visit.save();

    console.log(`  - Created prescription ${newPrescription.prescriptionId || newPrescription._id}`);
    console.log(`  - Status: ${newPrescription.status}`);
  }

  console.log('\nBackfill complete!');
  process.exit(0);
}

backfillPrescriptions().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
