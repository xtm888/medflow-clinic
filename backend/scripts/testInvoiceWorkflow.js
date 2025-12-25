/**
 * Test Invoice Workflow - Verify exams are added to invoices
 *
 * This script tests the complete workflow:
 * 1. Create a consultation session
 * 2. Add exam data (ophthalmology, refraction, tonometry)
 * 3. Complete the session
 * 4. Verify the invoice includes all exam fees
 */

require('dotenv').config();
const { requireNonProduction } = require('./_guards');
requireNonProduction('testInvoiceWorkflow.js');

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function testInvoiceWorkflow() {
  try {
    console.log('=== TESTING INVOICE WORKFLOW ===\n');

    await mongoose.connect(MONGODB_URI);

    // Load models
    const Patient = require('../models/Patient');
    const ConsultationSession = require('../models/ConsultationSession');
    const Visit = require('../models/Visit');
    const Invoice = require('../models/Invoice');
    const User = require('../models/User');

    // 1. Get a test patient
    const patient = await Patient.findOne({ deleted: { $ne: true } }).sort({ createdAt: -1 });
    if (!patient) {
      console.error('❌ No patients found. Please create a patient first.');
      process.exit(1);
    }
    console.log(`✅ Using patient: ${patient.firstName} ${patient.lastName} (${patient.patientId})`);

    // 2. Get a doctor
    const doctor = await User.findOne({ role: { $in: ['doctor', 'ophthalmologist'] } });
    if (!doctor) {
      console.error('❌ No doctor found. Please create a doctor user first.');
      process.exit(1);
    }
    console.log(`✅ Using doctor: ${doctor.firstName} ${doctor.lastName}\n`);

    // 3. Create consultation session with exam data
    console.log('📝 Creating consultation session with exam data...');
    const session = await ConsultationSession.create({
      patient: patient._id,
      doctor: doctor._id,
      sessionType: 'comprehensive',
      status: 'active',
      notes: 'Patient complains of blurry vision for reading',
      // Refraction data (actual schema field)
      refractionData: {
        OD: {
          eye: 'OD',
          sphere: -2.00,
          cylinder: -0.50,
          axis: 90,
          visualAcuity: '20/20'
        },
        OG: {
          eye: 'OG',
          sphere: -2.25,
          cylinder: -0.75,
          axis: 85,
          visualAcuity: '20/20'
        },
        notes: 'Myopic correction with slight astigmatism'
      },
      // Contact lens data (actual schema field)
      contactLensData: {
        OD: {
          eye: 'OD',
          type: 'soft',
          baseCurve: 8.6,
          diameter: 14.0,
          power: -2.00,
          brand: 'Acuvue Oasys'
        },
        OG: {
          eye: 'OG',
          type: 'soft',
          baseCurve: 8.6,
          diameter: 14.0,
          power: -2.25,
          brand: 'Acuvue Oasys'
        },
        notes: 'Trial lenses provided, good fit and comfort'
      },
      // Orthoptic data (actual schema field)
      orthopticData: {
        visualAcuity: {
          farOD: '20/20',
          farOG: '20/20',
          farBinocular: '20/20'
        },
        ocularMotility: {
          versions: 'Full ROM OU',
          ductions: 'Normal',
          nystagmus: 'None'
        },
        coverTest: {
          farWithCorrection: 'Orthophoric',
          nearWithCorrection: 'Orthophoric'
        },
        notes: 'Normal binocular vision'
      }
    });

    console.log(`✅ Session created: ${session._id}\n`);

    // 4. Complete the session
    console.log('🏁 Completing consultation session...');
    console.log('   (This should create Visit, add clinical acts, and generate invoice)\n');

    await session.complete(doctor._id);

    // 5. Check the results
    console.log('🔍 Checking results...\n');

    // Get the created visit
    const visit = await Visit.findOne({ consultationSession: session._id })
      .populate('patient', 'firstName lastName patientId')
      .populate('billing.invoice');

    if (!visit) {
      console.error('❌ No visit created!');
      process.exit(1);
    }

    console.log('✅ Visit created:');
    console.log(`   Visit ID: ${visit.visitId}`);
    console.log(`   Status: ${visit.status}`);
    console.log(`   Clinical Acts: ${visit.clinicalActs?.length || 0}`);

    // Check clinical acts
    if (visit.clinicalActs && visit.clinicalActs.length > 0) {
      console.log('\n📋 Clinical Acts on Visit:');
      let totalActsAmount = 0;
      visit.clinicalActs.forEach(act => {
        console.log(`   - ${act.actName}: ${act.price} CDF`);
        totalActsAmount += act.price;
      });
      console.log(`   TOTAL ACTS: ${totalActsAmount} CDF`);
    } else {
      console.log('\n❌ No clinical acts found on visit!');
    }

    // Check invoice
    if (visit.billing?.invoice) {
      const invoice = await Invoice.findById(visit.billing.invoice);

      console.log('\n💰 Invoice Generated:');
      console.log(`   Invoice ID: ${invoice.invoiceId}`);
      console.log(`   Items: ${invoice.items?.length || 0}`);

      if (invoice.items && invoice.items.length > 0) {
        console.log('\n📄 Invoice Items:');
        invoice.items.forEach(item => {
          console.log(`   - ${item.description}: ${item.total} ${invoice.currency}`);
        });
        console.log(`\n   TOTAL AMOUNT: ${invoice.summary?.total || invoice.totalAmount} ${invoice.currency}`);
      }

      // Verify expected items
      console.log('\n✅ Verification:');
      const hasConsultation = invoice.items.some(i => i.category === 'consultation');
      const hasRefraction = invoice.items.some(i => i.code === 'EXAM-REFRACTION');
      const hasContactLens = invoice.items.some(i => i.code === 'EXAM-CONTACT-LENS');
      const hasOrthoptic = invoice.items.some(i => i.code === 'EXAM-ORTHOPTIC');

      console.log(`   Consultation fee: ${hasConsultation ? '✅' : '❌'}`);
      console.log(`   Refraction test: ${hasRefraction ? '✅' : '❌'}`);
      console.log(`   Contact lens fitting: ${hasContactLens ? '✅' : '❌'}`);
      console.log(`   Orthoptic exam: ${hasOrthoptic ? '✅' : '❌'}`);

      if (hasConsultation && hasRefraction && hasContactLens && hasOrthoptic) {
        console.log('\n🎉 SUCCESS! All exams are included in the invoice!');
      } else {
        console.log('\n⚠️  WARNING: Some exams are missing from the invoice');
      }

    } else {
      console.log('\n❌ No invoice generated!');
    }

    console.log('\n=== TEST COMPLETE ===');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testInvoiceWorkflow();
