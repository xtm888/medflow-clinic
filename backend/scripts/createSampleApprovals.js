/**
 * Create Sample Approval Requests for Testing
 *
 * This script creates sample délibération (approval) requests
 * for testing the Approvals workflow.
 *
 * Run with: node scripts/createSampleApprovals.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('createSampleApprovals.js');

const Approval = require('../models/Approval');
const Patient = require('../models/Patient');
const Company = require('../models/Company');
const User = require('../models/User');

async function createSampleApprovals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Find a patient with ACTIVA convention
    const patient = await Patient.findOne({
      'convention.company': { $exists: true }
    }).populate('convention.company');

    if (!patient) {
      console.log('No patient with convention found. Creating one...');

      // Find ACTIVA company
      const activa = await Company.findOne({ name: /activa/i });
      if (!activa) {
        console.log('ACTIVA company not found. Please run seedConventions.js first.');
        process.exit(1);
      }

      // Find any patient to update
      const anyPatient = await Patient.findOne({});
      if (!anyPatient) {
        console.log('No patients found in database.');
        process.exit(1);
      }

      anyPatient.convention = {
        hasConvention: true,
        company: activa._id,
        membershipNumber: 'ACT-TEST-001',
        effectiveDate: new Date(),
        beneficiaryType: 'employee'
      };
      await anyPatient.save();
      console.log(`Updated patient ${anyPatient.firstName} ${anyPatient.lastName} with ACTIVA convention`);
    }

    // Re-fetch patient with convention
    const targetPatient = await Patient.findOne({
      'convention.company': { $exists: true }
    }).populate('convention.company');

    if (!targetPatient) {
      console.log('Could not find or create patient with convention');
      process.exit(1);
    }

    const company = targetPatient.convention.company;
    console.log(`Using patient: ${targetPatient.firstName} ${targetPatient.lastName}`);
    console.log(`Convention: ${company.name}\n`);

    // Find a user to be the requester
    const requester = await User.findOne({ role: { $in: ['admin', 'doctor', 'nurse'] } });
    if (!requester) {
      console.log('No staff user found');
      process.exit(1);
    }

    // Define sample approval requests (matching Approval schema)
    const sampleRequests = [
      {
        patient: targetPatient._id,
        company: company._id,
        actCode: 'PHACO',
        actName: 'Phacoemulsification with IOL implantation - Cataract Surgery',
        actCategory: 'surgery',
        quantityRequested: 1,
        estimatedCost: 500000,
        currency: 'CDF',
        medicalJustification: {
          diagnosis: 'Mature cataract OD',
          clinicalNotes: 'Patient presents with mature cataract in right eye causing significant visual impairment. BCVA 20/200. Surgery recommended to restore vision.',
          urgency: 'routine'
        },
        status: 'pending',
        requestedBy: requester._id,
        requestedAt: new Date(),
        createdBy: requester._id,
        internalNotes: 'Patient is diabetic - requires pre-op clearance from endocrinologist'
      },
      {
        patient: targetPatient._id,
        company: company._id,
        actCode: 'PROG-LENS',
        actName: 'Progressive Multifocal Lenses (Premium)',
        actCategory: 'optical',
        quantityRequested: 1,
        estimatedCost: 150000,
        currency: 'CDF',
        medicalJustification: {
          diagnosis: 'Presbyopia',
          clinicalNotes: 'Patient requires progressive lenses for presbyopia correction. Current glasses are outdated and causing eye strain.',
          urgency: 'routine'
        },
        status: 'pending',
        requestedBy: requester._id,
        requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        createdBy: requester._id,
        internalNotes: 'Prescription attached'
      },
      {
        patient: targetPatient._id,
        company: company._id,
        actCode: 'IVT-LUCENTIS',
        actName: 'Intravitreal Injection - Lucentis (Ranibizumab)',
        actCategory: 'surgery',
        quantityRequested: 3, // Series of injections
        estimatedCost: 800000,
        currency: 'CDF',
        medicalJustification: {
          diagnosis: 'Wet AMD',
          clinicalNotes: 'Wet AMD diagnosed with OCT findings showing subretinal fluid. Anti-VEGF therapy indicated to prevent further vision loss.',
          urgency: 'urgent'
        },
        status: 'pending',
        requestedBy: requester._id,
        requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        createdBy: requester._id,
        internalNotes: 'OCT scan attached. Urgent - risk of permanent vision loss if delayed.'
      },
      {
        patient: targetPatient._id,
        company: company._id,
        actCode: 'TRAB',
        actName: 'Trabeculectomy - Glaucoma Surgery',
        actCategory: 'surgery',
        quantityRequested: 1,
        estimatedCost: 450000,
        currency: 'CDF',
        medicalJustification: {
          diagnosis: 'Primary Open Angle Glaucoma - Uncontrolled',
          clinicalNotes: 'Uncontrolled IOP despite maximum medical therapy. IOP consistently above 30mmHg. Progressive visual field loss documented.',
          urgency: 'urgent'
        },
        status: 'approved',
        requestedBy: requester._id,
        requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        respondedBy: 'Dr. Martin (ACTIVA)',
        respondedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        responseNotes: 'Approved for surgical intervention',
        quantityApproved: 1,
        approvedAmount: 450000,
        externalReference: 'ACT-APR-2024-00125',
        validFrom: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdBy: requester._id,
        internalNotes: 'Surgery scheduled for next week'
      }
    ];

    // Clear existing sample approvals
    const deleted = await Approval.deleteMany({
      patient: targetPatient._id,
      actCode: { $in: sampleRequests.map(r => r.actCode) }
    });
    console.log(`Cleared ${deleted.deletedCount} existing sample approvals\n`);

    // Create new approvals
    let createdCount = 0;
    for (const request of sampleRequests) {
      try {
        await Approval.create(request);
        const statusIcon = request.status === 'approved' ? '✅' : '⏳';
        const urgency = request.medicalJustification?.urgency || 'routine';
        const urgencyIcon = urgency === 'urgent' ? '🔴' : urgency === 'emergency' ? '🚨' : '🟢';
        console.log(`${statusIcon} Created: ${request.actName}`);
        console.log(`   ${urgencyIcon} ${urgency.toUpperCase()} | Status: ${request.status} | Cost: ${request.estimatedCost.toLocaleString()} ${request.currency}`);
        createdCount++;
      } catch (err) {
        console.log(`Failed to create ${request.actCode}: ${err.message}`);
      }
    }

    console.log('\n========================================');
    console.log(`Created ${createdCount} sample approval requests`);
    console.log('========================================\n');
    console.log('You can now view them at: http://localhost:5173/approvals\n');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createSampleApprovals();
