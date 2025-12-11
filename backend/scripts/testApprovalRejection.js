/**
 * Test Approval REJECTION → Invoice Workflow
 *
 * When délibération is REJECTED, patient must pay 100%
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Approval = require('../models/Approval');
const Company = require('../models/Company');
const Patient = require('../models/Patient');
const User = require('../models/User');

async function testRejectionWorkflow() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  try {
    const patient = await Patient.findOne({
      'convention.company': { $exists: true }
    }).populate('convention.company');

    const company = patient.convention.company;
    const user = await User.findOne({ role: 'admin' });

    console.log('='.repeat(60));
    console.log('TEST: REJECTION WORKFLOW');
    console.log('='.repeat(60));
    console.log('Patient:', patient.firstName, patient.lastName);
    console.log('Convention:', company.name);
    console.log();

    // Clean up
    await Invoice.deleteMany({ patient: patient._id, 'items.code': 'REJECT-TEST' });
    await Approval.deleteMany({ patient: patient._id, actCode: 'REJECT-TEST' });

    // Create invoice with surgery (patient pays 100% pending approval)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await Invoice.create({
      patient: patient._id,
      dueDate: dueDate,
      items: [{
        description: 'Test: Trabeculectomy (Glaucoma Surgery)',
        code: 'REJECT-TEST',
        category: 'surgery',
        quantity: 1,
        unitPrice: 600000,
        subtotal: 600000,
        total: 600000,
        requiresApproval: true,
        hasApproval: false,
        approvalStatus: 'pending',
        companyShare: 0,
        patientShare: 600000,
        coveragePercentage: 0
      }],
      isConventionInvoice: true,
      companyBilling: {
        company: company._id,
        companyName: company.name,
        coveragePercentage: 0,
        companyShare: 0,
        patientShare: 600000,
        hasApprovalIssues: true,
        itemsNeedingApproval: 1
      },
      summary: {
        subtotal: 600000,
        discount: 0,
        tax: 0,
        total: 600000,
        amountPaid: 0,
        amountDue: 600000
      },
      status: 'issued',
      createdBy: user._id
    });

    console.log('STEP 1: Invoice Created (Awaiting Approval)');
    console.log('─'.repeat(40));
    console.log('Invoice:', invoice.invoiceNumber || invoice._id.toString().slice(-8));
    console.log('Total:           ', invoice.summary.total.toLocaleString().padStart(10), 'FC');
    console.log('Patient Owes:    ', invoice.companyBilling.patientShare.toLocaleString().padStart(10), 'FC');
    console.log('Status: Awaiting délibération');
    console.log();

    // Create pending approval
    const approval = await Approval.create({
      patient: patient._id,
      company: company._id,
      actCode: 'REJECT-TEST',
      actName: 'Test: Trabeculectomy (Glaucoma Surgery)',
      actCategory: 'surgery',
      quantityRequested: 1,
      estimatedCost: 600000,
      currency: 'CDF',
      medicalJustification: {
        diagnosis: 'Primary Open Angle Glaucoma',
        clinicalNotes: 'IOP uncontrolled on maximum medical therapy',
        urgency: 'urgent'
      },
      status: 'pending',
      requestedBy: user._id,
      createdBy: user._id
    });

    console.log('STEP 2: Approval Request Created');
    console.log('─'.repeat(40));
    console.log('Approval ID:', approval.approvalId);
    console.log('Status:', approval.status);
    console.log();

    // REJECT the approval
    console.log('STEP 3: REJECT THE DÉLIBÉRATION');
    console.log('─'.repeat(40));
    console.log('Rejecting with reason: "Procedure not covered under current policy"');
    console.log();

    await approval.reject({
      respondedBy: 'Insurance Reviewer',
      reason: 'Procedure not covered under current policy. Patient must pay out of pocket.',
      notes: 'Alternative: Consider medical management first'
    });

    // Update invoice to mark as rejected
    await Invoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          'items.0.hasApproval': false,
          'items.0.approvalStatus': 'rejected',
          'items.0.coveragePercentage': 0,
          'items.0.companyShare': 0,
          'items.0.patientShare': 600000,
          'companyBilling.hasApprovalIssues': false,  // No longer "pending" - it's been decided
          'companyBilling.itemsNeedingApproval': 0
        }
      }
    );

    // Verify
    const updatedInvoice = await Invoice.findById(invoice._id);
    const updatedApproval = await Approval.findById(approval._id);

    console.log('RESULTS AFTER REJECTION:');
    console.log('='.repeat(40));
    console.log('Approval Status:', updatedApproval.status);
    console.log('Rejection Reason:', updatedApproval.rejectionReason);
    console.log();
    console.log('Invoice Updated:');
    console.log('  Total:           ', updatedInvoice.summary.total.toLocaleString().padStart(10), 'FC');
    console.log('  Company Share:   ', updatedInvoice.companyBilling.companyShare.toLocaleString().padStart(10), 'FC');
    console.log('  Patient Share:   ', updatedInvoice.companyBilling.patientShare.toLocaleString().padStart(10), 'FC');
    console.log('  Amount Due:      ', updatedInvoice.summary.amountDue.toLocaleString().padStart(10), 'FC');
    console.log();
    console.log('Item Status:', updatedInvoice.items[0].approvalStatus);
    console.log();

    console.log('='.repeat(60));
    console.log('REJECTION TEST COMPLETE');
    console.log('='.repeat(60));
    console.log();
    console.log('When délibération is REJECTED:');
    console.log('  → Company pays: 0 FC');
    console.log('  → Patient pays: 600,000 FC (100%)');
    console.log('  → Patient must pay directly for the surgery');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testRejectionWorkflow();
