/**
 * Verify CareVision Data Import Counts
 *
 * This script verifies that CareVision data has been properly imported
 * by checking counts against expected minimums.
 *
 * Expected minimums (from spec):
 * - Appointments: >= 32,000 (from Ag_Rdv table)
 * - Invoices: >= 94,000 (from Facture table)
 * - Orders: >= 95,000 (from Commande table)
 *
 * Usage:
 *   node scripts/verifyCareVisionImportCounts.js          # Full verification
 *   node scripts/verifyCareVisionImportCounts.js --json   # JSON output for CI
 *   node scripts/verifyCareVisionImportCounts.js --verbose # Detailed breakdown
 *
 * Exit codes:
 *   0 - All counts meet minimums
 *   1 - One or more counts below minimum
 *
 * @module scripts/verifyCareVisionImportCounts
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const GlassesOrder = require('../models/GlassesOrder');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');

// Expected minimum counts from CareVision (from spec.md)
const EXPECTED_MINIMUMS = {
  appointments: 32000,
  invoices: 94000,
  orders: 95000,
  // Additional reference counts (already verified as imported)
  patients: 50000,
  visits: 200000
};

// Parse command line arguments
const args = process.argv.slice(2);
const isJsonOutput = args.includes('--json');
const isVerbose = args.includes('--verbose');

/**
 * Get count of CareVision-imported appointments
 * CareVision appointments have externalId matching pattern CV-{id}
 * @returns {Promise<Object>} Count and breakdown
 */
async function getAppointmentCounts() {
  const careVisionCount = await Appointment.countDocuments({
    externalId: { $regex: /^CV-/ }
  });

  const totalCount = await Appointment.countDocuments({
    isDeleted: { $ne: true }
  });

  let breakdown = null;
  if (isVerbose) {
    // Get breakdown by status
    const byStatus = await Appointment.aggregate([
      { $match: { externalId: { $regex: /^CV-/ } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get breakdown by type
    const byType = await Appointment.aggregate([
      { $match: { externalId: { $regex: /^CV-/ } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get date range
    const dateRange = await Appointment.aggregate([
      { $match: { externalId: { $regex: /^CV-/ } } },
      {
        $group: {
          _id: null,
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' }
        }
      }
    ]);

    breakdown = {
      byStatus,
      byType,
      dateRange: dateRange[0] || { minDate: null, maxDate: null }
    };
  }

  return {
    careVisionCount,
    totalCount,
    breakdown
  };
}

/**
 * Get count of CareVision-imported invoices
 * CareVision invoices have invoiceId matching pattern CV-{id}
 * @returns {Promise<Object>} Count and breakdown
 */
async function getInvoiceCounts() {
  const careVisionCount = await Invoice.countDocuments({
    invoiceId: { $regex: /^CV-/ }
  });

  const totalCount = await Invoice.countDocuments({
    isDeleted: { $ne: true }
  });

  let breakdown = null;
  if (isVerbose) {
    // Get breakdown by status
    const byStatus = await Invoice.aggregate([
      { $match: { invoiceId: { $regex: /^CV-/ } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get total amount
    const financials = await Invoice.aggregate([
      { $match: { invoiceId: { $regex: /^CV-/ } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$summary.total' },
          totalPaid: { $sum: '$summary.amountPaid' },
          totalDue: { $sum: '$summary.amountDue' }
        }
      }
    ]);

    // Get date range
    const dateRange = await Invoice.aggregate([
      { $match: { invoiceId: { $regex: /^CV-/ } } },
      {
        $group: {
          _id: null,
          minDate: { $min: '$dateIssued' },
          maxDate: { $max: '$dateIssued' }
        }
      }
    ]);

    breakdown = {
      byStatus,
      financials: financials[0] || { totalAmount: 0, totalPaid: 0, totalDue: 0 },
      dateRange: dateRange[0] || { minDate: null, maxDate: null }
    };
  }

  return {
    careVisionCount,
    totalCount,
    breakdown
  };
}

/**
 * Get count of CareVision-imported orders
 * CareVision orders have orderNumber matching pattern CV-{id}
 * @returns {Promise<Object>} Count and breakdown
 */
async function getOrderCounts() {
  const careVisionCount = await GlassesOrder.countDocuments({
    orderNumber: { $regex: /^CV-/ }
  });

  const totalCount = await GlassesOrder.countDocuments({
    isDeleted: { $ne: true }
  });

  let breakdown = null;
  if (isVerbose) {
    // Get breakdown by status
    const byStatus = await GlassesOrder.aggregate([
      { $match: { orderNumber: { $regex: /^CV-/ } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get breakdown by order type
    const byType = await GlassesOrder.aggregate([
      { $match: { orderNumber: { $regex: /^CV-/ } } },
      { $group: { _id: '$orderType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get total amount
    const financials = await GlassesOrder.aggregate([
      { $match: { orderNumber: { $regex: /^CV-/ } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$total' },
          totalPaid: { $sum: '$amountPaid' }
        }
      }
    ]);

    // Get date range from timeline
    const dateRange = await GlassesOrder.aggregate([
      { $match: { orderNumber: { $regex: /^CV-/ } } },
      {
        $group: {
          _id: null,
          minDate: { $min: '$timeline.createdAt' },
          maxDate: { $max: '$timeline.createdAt' }
        }
      }
    ]);

    breakdown = {
      byStatus,
      byType,
      financials: financials[0] || { totalAmount: 0, totalPaid: 0 },
      dateRange: dateRange[0] || { minDate: null, maxDate: null }
    };
  }

  return {
    careVisionCount,
    totalCount,
    breakdown
  };
}

/**
 * Get reference counts for patients and visits (already imported)
 * @returns {Promise<Object>} Reference counts
 */
async function getReferenceCounts() {
  const patientCount = await Patient.countDocuments({
    'legacyIds.lv': { $exists: true }
  });

  const visitCount = await Visit.countDocuments({
    'legacyIds.careVision': { $exists: true }
  });

  // Alternative: count visits with careVisionId
  const visitWithCareVisionId = await Visit.countDocuments({
    careVisionId: { $exists: true, $ne: null }
  });

  return {
    patients: patientCount,
    visits: visitCount || visitWithCareVisionId
  };
}

/**
 * Format number with thousand separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  return num.toLocaleString('fr-FR');
}

/**
 * Print verification report in console format
 * @param {Object} results - Verification results
 */
function printConsoleReport(results) {
  console.log('\n' + '='.repeat(70));
  console.log('  CAREVISION DATA IMPORT VERIFICATION REPORT');
  console.log('='.repeat(70));
  console.log(`  Generated: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  console.log('\n--- PRIMARY IMPORT COUNTS (from CareVision) ---\n');

  // Appointments
  const apptResult = results.appointments;
  const apptStatus = apptResult.careVisionCount >= EXPECTED_MINIMUMS.appointments ? '✓ PASS' : '✗ FAIL';
  console.log(`  APPOINTMENTS:`);
  console.log(`    CareVision imports: ${formatNumber(apptResult.careVisionCount)}`);
  console.log(`    Expected minimum:   ${formatNumber(EXPECTED_MINIMUMS.appointments)}`);
  console.log(`    Total in database:  ${formatNumber(apptResult.totalCount)}`);
  console.log(`    Status: ${apptStatus}`);

  if (isVerbose && apptResult.breakdown) {
    console.log('\n    Status breakdown:');
    apptResult.breakdown.byStatus.forEach(s => {
      console.log(`      ${s._id || 'unknown'}: ${formatNumber(s.count)}`);
    });
    if (apptResult.breakdown.dateRange.minDate) {
      console.log(`    Date range: ${apptResult.breakdown.dateRange.minDate?.toISOString().split('T')[0]} to ${apptResult.breakdown.dateRange.maxDate?.toISOString().split('T')[0]}`);
    }
  }

  console.log('');

  // Invoices
  const invResult = results.invoices;
  const invStatus = invResult.careVisionCount >= EXPECTED_MINIMUMS.invoices ? '✓ PASS' : '✗ FAIL';
  console.log(`  INVOICES:`);
  console.log(`    CareVision imports: ${formatNumber(invResult.careVisionCount)}`);
  console.log(`    Expected minimum:   ${formatNumber(EXPECTED_MINIMUMS.invoices)}`);
  console.log(`    Total in database:  ${formatNumber(invResult.totalCount)}`);
  console.log(`    Status: ${invStatus}`);

  if (isVerbose && invResult.breakdown) {
    console.log('\n    Status breakdown:');
    invResult.breakdown.byStatus.forEach(s => {
      console.log(`      ${s._id || 'unknown'}: ${formatNumber(s.count)}`);
    });
    if (invResult.breakdown.financials) {
      console.log(`    Total amount: ${formatNumber(invResult.breakdown.financials.totalAmount)} CDF`);
      console.log(`    Total paid: ${formatNumber(invResult.breakdown.financials.totalPaid)} CDF`);
    }
    if (invResult.breakdown.dateRange.minDate) {
      console.log(`    Date range: ${invResult.breakdown.dateRange.minDate?.toISOString().split('T')[0]} to ${invResult.breakdown.dateRange.maxDate?.toISOString().split('T')[0]}`);
    }
  }

  console.log('');

  // Orders
  const ordResult = results.orders;
  const ordStatus = ordResult.careVisionCount >= EXPECTED_MINIMUMS.orders ? '✓ PASS' : '✗ FAIL';
  console.log(`  ORDERS (Glasses/Optical):`);
  console.log(`    CareVision imports: ${formatNumber(ordResult.careVisionCount)}`);
  console.log(`    Expected minimum:   ${formatNumber(EXPECTED_MINIMUMS.orders)}`);
  console.log(`    Total in database:  ${formatNumber(ordResult.totalCount)}`);
  console.log(`    Status: ${ordStatus}`);

  if (isVerbose && ordResult.breakdown) {
    console.log('\n    Status breakdown:');
    ordResult.breakdown.byStatus.forEach(s => {
      console.log(`      ${s._id || 'unknown'}: ${formatNumber(s.count)}`);
    });
    console.log('    Type breakdown:');
    ordResult.breakdown.byType.forEach(t => {
      console.log(`      ${t._id || 'unknown'}: ${formatNumber(t.count)}`);
    });
    if (ordResult.breakdown.financials) {
      console.log(`    Total amount: ${formatNumber(ordResult.breakdown.financials.totalAmount)} CDF`);
    }
    if (ordResult.breakdown.dateRange.minDate) {
      console.log(`    Date range: ${ordResult.breakdown.dateRange.minDate?.toISOString().split('T')[0]} to ${ordResult.breakdown.dateRange.maxDate?.toISOString().split('T')[0]}`);
    }
  }

  console.log('\n--- REFERENCE COUNTS (previously imported) ---\n');

  console.log(`  PATIENTS with CareVision ID: ${formatNumber(results.reference.patients)}`);
  console.log(`  VISITS with CareVision ID:   ${formatNumber(results.reference.visits)}`);

  console.log('\n' + '='.repeat(70));
  console.log('  OVERALL RESULT');
  console.log('='.repeat(70));

  const allPassed = apptResult.careVisionCount >= EXPECTED_MINIMUMS.appointments &&
                    invResult.careVisionCount >= EXPECTED_MINIMUMS.invoices &&
                    ordResult.careVisionCount >= EXPECTED_MINIMUMS.orders;

  if (allPassed) {
    console.log('\n  ✓ ALL CAREVISION DATA IMPORT COUNTS VERIFIED');
    console.log('  All imports meet or exceed expected minimums.\n');
  } else {
    console.log('\n  ✗ SOME IMPORT COUNTS BELOW EXPECTED MINIMUMS');
    console.log('  Review the failed items above and re-run import scripts if needed.\n');

    if (apptResult.careVisionCount < EXPECTED_MINIMUMS.appointments) {
      console.log(`  - Appointments: missing ${formatNumber(EXPECTED_MINIMUMS.appointments - apptResult.careVisionCount)} records`);
      console.log('    Run: node scripts/importCareVisionAppointments.js');
    }
    if (invResult.careVisionCount < EXPECTED_MINIMUMS.invoices) {
      console.log(`  - Invoices: missing ${formatNumber(EXPECTED_MINIMUMS.invoices - invResult.careVisionCount)} records`);
      console.log('    Run: node scripts/importCareVisionInvoices.js');
    }
    if (ordResult.careVisionCount < EXPECTED_MINIMUMS.orders) {
      console.log(`  - Orders: missing ${formatNumber(EXPECTED_MINIMUMS.orders - ordResult.careVisionCount)} records`);
      console.log('    Run: node scripts/importCareVisionOrders.js');
    }
    console.log('');
  }

  console.log('='.repeat(70));

  return allPassed;
}

/**
 * Main verification function
 */
async function verifyImportCounts() {
  const startTime = Date.now();

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow-matrix';

  try {
    await mongoose.connect(mongoUri);

    if (!isJsonOutput) {
      console.log('Connected to MongoDB...');
      console.log('Verifying CareVision import counts...');
    }

    // Get all counts in parallel
    const [appointments, invoices, orders, reference] = await Promise.all([
      getAppointmentCounts(),
      getInvoiceCounts(),
      getOrderCounts(),
      getReferenceCounts()
    ]);

    const results = {
      appointments,
      invoices,
      orders,
      reference,
      expectedMinimums: EXPECTED_MINIMUMS,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime
    };

    // Determine overall pass/fail
    const allPassed = appointments.careVisionCount >= EXPECTED_MINIMUMS.appointments &&
                      invoices.careVisionCount >= EXPECTED_MINIMUMS.invoices &&
                      orders.careVisionCount >= EXPECTED_MINIMUMS.orders;

    results.passed = allPassed;
    results.summary = {
      appointments: {
        count: appointments.careVisionCount,
        minimum: EXPECTED_MINIMUMS.appointments,
        passed: appointments.careVisionCount >= EXPECTED_MINIMUMS.appointments
      },
      invoices: {
        count: invoices.careVisionCount,
        minimum: EXPECTED_MINIMUMS.invoices,
        passed: invoices.careVisionCount >= EXPECTED_MINIMUMS.invoices
      },
      orders: {
        count: orders.careVisionCount,
        minimum: EXPECTED_MINIMUMS.orders,
        passed: orders.careVisionCount >= EXPECTED_MINIMUMS.orders
      }
    };

    if (isJsonOutput) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printConsoleReport(results);
    }

    await mongoose.disconnect();

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    if (isJsonOutput) {
      console.log(JSON.stringify({
        error: error.message,
        passed: false,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      console.error('\nVerification failed:', error.message);
      if (process.env.DEBUG === 'true') {
        console.error(error.stack);
      }
    }

    try {
      await mongoose.disconnect();
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Run verification
verifyImportCounts();
