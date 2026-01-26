/**
 * Import CareVision Invoices from Facture Table
 *
 * Imports invoices from CareVision SQL Server (Facture table) to MedFlow MongoDB.
 * ~94,000+ records in production
 *
 * Features:
 * - Patient matching via legacyIds.lv (CareVision patient ID)
 * - Status mapping from CareVision to MedFlow
 * - Payment method mapping to MedFlow payment methods
 * - Currency handling (CDF default)
 * - Idempotent: tracks legacyId to prevent duplicates
 * - Batch processing for memory efficiency
 *
 * Usage:
 *   DRY_RUN=true node scripts/importCareVisionInvoices.js   # Validate without importing
 *   node scripts/importCareVisionInvoices.js                 # Full import
 *   node scripts/importCareVisionInvoices.js --start-date 2024-01-01  # From specific date
 *
 * @module scripts/importCareVisionInvoices
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict, isDryRun } = require('./_guards');
requireNonProductionStrict('importCareVisionInvoices.js');

// CareVision SQL Client
const careVisionSqlClient = require('../services/careVisionSqlClient');

// Models
const Patient = require('../models/Patient');
const Invoice = require('../models/Invoice');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// Configuration
const DRY_RUN = isDryRun();
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 500;
const SQL_BATCH_SIZE = parseInt(process.env.SQL_BATCH_SIZE) || 2000;

// Parse command line arguments
const args = process.argv.slice(2);
const startDateArg = args.find(a => a.startsWith('--start-date='))?.split('=')[1] ||
                     args[args.indexOf('--start-date') + 1];
const endDateArg = args.find(a => a.startsWith('--end-date='))?.split('=')[1] ||
                   args[args.indexOf('--end-date') + 1];

// Statistics
const stats = {
  totalInCareVision: 0,
  fetched: 0,
  created: 0,
  skipped: {
    alreadyImported: 0,
    patientNotFound: 0,
    invalidData: 0
  },
  errors: [],
  patientNotFoundIds: new Set(),
  startTime: null
};

/**
 * Build patient lookup map from legacyIds.lv (CareVision patient ID)
 * @returns {Promise<Map<string, Object>>} Map of CareVision patient ID to MedFlow patient
 */
async function buildPatientMap() {
  console.log('Building patient lookup map from legacyIds.lv...');
  const patients = await Patient.find(
    { 'legacyIds.lv': { $exists: true, $ne: null } },
    { _id: 1, patientId: 1, 'legacyIds.lv': 1, firstName: 1, lastName: 1 }
  ).lean();

  const map = new Map();
  for (const p of patients) {
    if (p.legacyIds?.lv) {
      map.set(p.legacyIds.lv.toString(), {
        _id: p._id,
        patientId: p.patientId,
        name: `${p.firstName} ${p.lastName}`
      });
    }
  }
  console.log(`  Loaded ${map.size} patients with CareVision legacy IDs`);
  return map;
}

/**
 * Build set of already imported invoice IDs
 * Uses invoiceId field with CV- prefix for legacy imports
 * @returns {Promise<Set<string>>} Set of CareVision invoice IDs already in MedFlow
 */
async function buildImportedSet() {
  console.log('Checking for previously imported invoices...');
  const imported = await Invoice.find(
    { invoiceId: { $regex: /^CV-/ } },
    { invoiceId: 1 }
  ).lean();

  const set = new Set();
  for (const inv of imported) {
    if (inv.invoiceId) {
      // Extract CareVision ID from invoiceId format "CV-XXXXX"
      const cvId = inv.invoiceId.replace('CV-', '');
      set.add(cvId.toString());
    }
  }
  console.log(`  Found ${set.size} previously imported invoices`);
  return set;
}

/**
 * Build user lookup map for receivedBy attribution
 * @returns {Promise<mongoose.Types.ObjectId>} System admin user ID for attribution
 */
async function getSystemUser() {
  console.log('Getting system user for attribution...');
  const systemUser = await User.findOne({ role: 'admin' });
  if (!systemUser) {
    throw new Error('No admin user found! Create admin user first.');
  }
  console.log(`  System User: ${systemUser.firstName} ${systemUser.lastName}`);
  return systemUser;
}

/**
 * Map CareVision invoice status to MedFlow status
 * @param {string} cvStatus - CareVision invoice status (etat)
 * @param {number} amountPaid - Amount paid
 * @param {number} total - Total amount
 * @returns {string} MedFlow invoice status
 */
function mapInvoiceStatus(cvStatus, amountPaid, total) {
  // First check payment status
  if (amountPaid >= total && total > 0) {
    return 'paid';
  }
  if (amountPaid > 0 && amountPaid < total) {
    return 'partial';
  }

  // Then check CareVision status
  if (!cvStatus) return 'issued';

  const statusMap = {
    'paid': 'paid',
    'paye': 'paid',
    'payee': 'paid',
    'partial': 'partial',
    'partiel': 'partial',
    'unpaid': 'issued',
    'impaye': 'issued',
    'impayee': 'issued',
    'cancelled': 'cancelled',
    'annule': 'cancelled',
    'annulee': 'cancelled',
    'pending': 'issued',
    'en_attente': 'issued',
    'attente': 'issued'
  };

  const normalized = cvStatus.toLowerCase().trim().replace(/\s+/g, '_');
  return statusMap[normalized] || 'issued';
}

/**
 * Map CareVision payment method to MedFlow payment method
 * @param {string} cvMethod - CareVision payment method
 * @returns {string} MedFlow payment method
 */
function mapPaymentMethod(cvMethod) {
  if (!cvMethod) return 'cash';

  const methodMap = {
    'especes': 'cash',
    'espece': 'cash',
    'cash': 'cash',
    'carte': 'card',
    'cb': 'card',
    'card': 'card',
    'cheque': 'check',
    'check': 'check',
    'virement': 'bank-transfer',
    'bank_transfer': 'bank-transfer',
    'assurance': 'insurance',
    'convention': 'insurance',
    'insurance': 'insurance',
    'mobile': 'mobile-payment',
    'mobile_money': 'mobile-payment',
    'orange': 'orange-money',
    'orange_money': 'orange-money',
    'mtn': 'mtn-money',
    'mtn_money': 'mtn-money',
    'wave': 'wave'
  };

  const normalized = cvMethod.toLowerCase().trim().replace(/[-\s]+/g, '_');
  return methodMap[normalized] || 'other';
}

/**
 * Transform CareVision invoice to MedFlow Invoice document
 * @param {Object} cvInvoice - CareVision invoice from SQL client
 * @param {Object} context - Import context with maps and references
 * @returns {Object|null} MedFlow invoice document or null if invalid
 */
function transformToMedFlowInvoice(cvInvoice, context) {
  const { patientMap, importedSet, clinic, systemUser } = context;

  // Check if already imported
  const cvId = cvInvoice.legacyId?.toString();
  if (!cvId || importedSet.has(cvId)) {
    stats.skipped.alreadyImported++;
    return null;
  }

  // Find patient
  const cvPatientId = cvInvoice.careVisionPatientId?.toString();
  const patient = patientMap.get(cvPatientId);
  if (!patient) {
    stats.skipped.patientNotFound++;
    stats.patientNotFoundIds.add(cvPatientId);
    return null;
  }

  // Validate invoice date
  if (!cvInvoice.invoiceDate) {
    stats.skipped.invalidData++;
    stats.errors.push(`Invoice ${cvId}: Missing invoice date`);
    return null;
  }

  const invoiceDate = new Date(cvInvoice.invoiceDate);
  if (isNaN(invoiceDate.getTime())) {
    stats.skipped.invalidData++;
    stats.errors.push(`Invoice ${cvId}: Invalid date`);
    return null;
  }

  // Parse financial data
  const total = cvInvoice.total || 0;
  const amountPaid = cvInvoice.amountPaid || 0;
  const amountDue = cvInvoice.amountDue || (total - amountPaid);

  // Validate amounts
  if (total < 0) {
    stats.skipped.invalidData++;
    stats.errors.push(`Invoice ${cvId}: Negative total amount`);
    return null;
  }

  // Map status based on payment state
  const status = mapInvoiceStatus(cvInvoice.originalStatus, amountPaid, total);

  // Create a single line item to represent the CareVision invoice
  // (CareVision doesn't have detailed line items in the Facture table)
  const itemId = new mongoose.Types.ObjectId().toString();
  const items = [{
    itemId: itemId,
    description: `Facture CareVision #${cvInvoice.invoiceNumber || cvId}`,
    category: 'consultation',
    quantity: 1,
    unitPrice: total,
    discount: 0,
    subtotal: total,
    tax: 0,
    total: total,
    reference: `CV-${cvId}`,
    paidAmount: amountPaid,
    isPaid: amountPaid >= total && total > 0
  }];

  // Build payments array if there was a payment
  const payments = [];
  if (amountPaid > 0) {
    const paymentMethod = mapPaymentMethod(cvInvoice.originalPaymentMethod);
    payments.push({
      paymentId: `CV-PAY-${cvId}`,
      amount: amountPaid,
      currency: 'CDF',
      amountInBaseCurrency: amountPaid,
      exchangeRate: 1,
      method: paymentMethod,
      date: invoiceDate,
      reference: cvInvoice.invoiceNumber || null,
      notes: `Paiement importé depuis CareVision`,
      receivedBy: systemUser._id,
      isSystemGenerated: true,
      itemAllocations: [{
        itemId: itemId,
        amount: amountPaid
      }]
    });
  }

  // Calculate due date (30 days from invoice date for legacy invoices)
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);

  // Build invoice document
  return {
    invoiceId: `CV-${cvId}`,
    patient: patient._id,
    clinic: clinic._id,

    // Dates
    dateIssued: invoiceDate,
    dueDate: dueDate,

    // Items
    items: items,

    // Financial summary
    summary: {
      subtotal: total,
      discountTotal: 0,
      taxTotal: 0,
      total: total,
      companyShare: 0,
      patientShare: total,
      amountPaid: amountPaid,
      amountDue: amountDue
    },

    // Payments
    payments: payments,

    // Currency breakdown
    currencyBreakdown: {
      CDF: amountPaid,
      USD: 0,
      EUR: 0
    },

    // Status
    status: status,
    source: 'import',

    // Billing details
    billing: {
      currency: 'CDF',
      taxRate: 0
    },

    // Audit
    createdBy: systemUser._id,
    createdAt: cvInvoice.createdAt || invoiceDate,
    updatedAt: cvInvoice.updatedAt || invoiceDate,

    // Tracking
    isDeleted: false,

    // Notes from CareVision
    notes: cvInvoice.notes || null
  };
}

/**
 * Process a batch of invoices
 * @param {Array} invoices - Array of MedFlow invoice documents
 */
async function processBatch(invoices) {
  if (invoices.length === 0) return;

  if (DRY_RUN) {
    stats.created += invoices.length;
    return;
  }

  try {
    // Use native MongoDB driver for reliable bulk inserts
    const collection = mongoose.connection.db.collection('invoices');
    const result = await collection.insertMany(invoices, { ordered: false });
    stats.created += result.insertedCount || invoices.length;
  } catch (error) {
    if (error.writeErrors) {
      // Partial success - some documents inserted
      const inserted = invoices.length - error.writeErrors.length;
      stats.created += inserted;
      for (const writeErr of error.writeErrors.slice(0, 5)) {
        stats.errors.push(`Insert error: ${writeErr.errmsg}`);
      }
    } else {
      stats.errors.push(`Batch error: ${error.message}`);
    }
  }
}

/**
 * Main import function
 */
async function importInvoices() {
  console.log('\n' + '='.repeat(60));
  console.log('  CAREVISION INVOICES IMPORT');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  if (startDateArg) console.log(`Start Date Filter: ${startDateArg}`);
  if (endDateArg) console.log(`End Date Filter: ${endDateArg}`);
  console.log('');

  stats.startTime = Date.now();

  // Test CareVision connection
  console.log('Testing CareVision database connection...');
  const connTest = await careVisionSqlClient.testConnection();
  if (!connTest.connected) {
    throw new Error(`CareVision connection failed: ${connTest.message}`);
  }
  console.log(`  Connected to ${connTest.server}/${connTest.database}`);

  // Get total count from CareVision
  stats.totalInCareVision = await careVisionSqlClient.getInvoiceCount();
  console.log(`  Total invoices in CareVision: ${stats.totalInCareVision.toLocaleString()}`);

  // Get clinic and system user
  const clinic = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
  if (!clinic) {
    throw new Error('Tombalbaye clinic not found! Run seedClinics.js first.');
  }

  const systemUser = await getSystemUser();

  console.log(`Clinic: ${clinic.name} (${clinic._id})`);

  // Build lookup maps
  const patientMap = await buildPatientMap();
  const importedSet = await buildImportedSet();

  const context = {
    patientMap,
    importedSet,
    clinic,
    systemUser
  };

  // Process in batches from SQL Server
  console.log('\nImporting invoices...');
  let offset = 0;
  let hasMore = true;
  const invoiceBatch = [];

  while (hasMore) {
    // Build query options
    const queryOptions = {
      limit: SQL_BATCH_SIZE,
      offset: offset
    };

    if (startDateArg) {
      queryOptions.startDate = new Date(startDateArg);
    }
    if (endDateArg) {
      queryOptions.endDate = new Date(endDateArg);
    }

    // Fetch batch from CareVision
    const { records, total } = await careVisionSqlClient.getInvoices(queryOptions);
    stats.fetched += records.length;

    if (records.length === 0) {
      hasMore = false;
      break;
    }

    // Transform and accumulate
    for (const cvInvoice of records) {
      const medflowInvoice = transformToMedFlowInvoice(cvInvoice, context);
      if (medflowInvoice) {
        // Add required MongoDB _id
        medflowInvoice._id = new mongoose.Types.ObjectId();
        invoiceBatch.push(medflowInvoice);
      }

      // Process batch when full
      if (invoiceBatch.length >= BATCH_SIZE) {
        await processBatch([...invoiceBatch]);
        invoiceBatch.length = 0;

        // Progress update
        const progress = Math.round((stats.fetched / total) * 100);
        const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
        process.stdout.write(`\r  Progress: ${progress}% (${stats.fetched.toLocaleString()}/${total.toLocaleString()}) - ${stats.created.toLocaleString()} created - ${elapsed}s elapsed`);
      }
    }

    offset += records.length;
    if (records.length < SQL_BATCH_SIZE) {
      hasMore = false;
    }
  }

  // Process remaining batch
  if (invoiceBatch.length > 0) {
    await processBatch(invoiceBatch);
  }

  console.log('\n');
}

/**
 * Print import summary
 */
function printSummary() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);

  console.log('='.repeat(60));
  console.log('  IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log(`Total in CareVision: ${stats.totalInCareVision.toLocaleString()}`);
  console.log(`Fetched: ${stats.fetched.toLocaleString()}`);
  console.log(`Created: ${stats.created.toLocaleString()}`);
  console.log('');
  console.log('Skipped:');
  console.log(`  Already imported: ${stats.skipped.alreadyImported.toLocaleString()}`);
  console.log(`  Patient not found: ${stats.skipped.patientNotFound.toLocaleString()}`);
  console.log(`  Invalid data: ${stats.skipped.invalidData.toLocaleString()}`);
  console.log('');
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Duration: ${elapsed}s`);

  if (stats.patientNotFoundIds.size > 0 && stats.patientNotFoundIds.size <= 20) {
    console.log('\nSample patients not found (CareVision IDs):');
    Array.from(stats.patientNotFoundIds).slice(0, 20).forEach(id => {
      console.log(`  - ${id}`);
    });
  } else if (stats.patientNotFoundIds.size > 20) {
    console.log(`\n${stats.patientNotFoundIds.size} unique patients not found in MedFlow`);
  }

  if (stats.errors.length > 0) {
    console.log('\nFirst 10 errors:');
    stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }

  console.log('='.repeat(60));
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow-matrix';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Run import
    await importInvoices();

    // Print summary
    printSummary();

    // Cleanup
    await careVisionSqlClient.closePool();
    await mongoose.disconnect();

    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\nImport failed:', error.message);
    if (process.env.DEBUG === 'true') {
      console.error(error.stack);
    }

    // Cleanup on error
    try {
      await careVisionSqlClient.closePool();
      await mongoose.disconnect();
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Run the import
main();
