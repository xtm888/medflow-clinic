/**
 * Import CareVision Orders from Commande/DetailCommande Tables
 *
 * Imports orders from CareVision SQL Server to MedFlow MongoDB.
 * ~250,000 records in production (Commande + DetailCommande)
 *
 * Features:
 * - Patient matching via legacyIds.lv (CareVision patient ID)
 * - Order type mapping (optical, pharmacy, contact-lenses)
 * - Status mapping from CareVision to MedFlow
 * - Line items import from DetailCommande
 * - Prescription data extraction for optical orders
 * - Idempotent: tracks orderNumber with CV- prefix to prevent duplicates
 * - Batch processing for memory efficiency
 *
 * Usage:
 *   DRY_RUN=true node scripts/importCareVisionOrders.js   # Validate without importing
 *   node scripts/importCareVisionOrders.js                 # Full import
 *   node scripts/importCareVisionOrders.js --start-date 2024-01-01  # From specific date
 *   node scripts/importCareVisionOrders.js --type optical  # Only optical orders
 *
 * @module scripts/importCareVisionOrders
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict, isDryRun } = require('./_guards');
requireNonProductionStrict('importCareVisionOrders.js');

// CareVision SQL Client
const careVisionSqlClient = require('../services/careVisionSqlClient');

// Models
const Patient = require('../models/Patient');
const GlassesOrder = require('../models/GlassesOrder');
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
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1] ||
                   args[args.indexOf('--type') + 1];

// Statistics
const stats = {
  totalInCareVision: 0,
  fetched: 0,
  created: 0,
  lineItemsImported: 0,
  skipped: {
    alreadyImported: 0,
    patientNotFound: 0,
    invalidData: 0,
    nonOpticalType: 0
  },
  byType: {
    optical: 0,
    'contact-lenses': 0,
    pharmacy: 0,
    other: 0
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
 * Build set of already imported order IDs
 * Uses orderNumber field with CV- prefix for legacy imports
 * @returns {Promise<Set<string>>} Set of CareVision order IDs already in MedFlow
 */
async function buildImportedSet() {
  console.log('Checking for previously imported orders...');
  const imported = await GlassesOrder.find(
    { orderNumber: { $regex: /^CV-/ } },
    { orderNumber: 1 }
  ).lean();

  const set = new Set();
  for (const order of imported) {
    if (order.orderNumber) {
      // Extract CareVision ID from orderNumber format "CV-XXXXX"
      const cvId = order.orderNumber.replace('CV-', '');
      set.add(cvId.toString());
    }
  }
  console.log(`  Found ${set.size} previously imported orders`);
  return set;
}

/**
 * Get system user for attribution
 * @returns {Promise<Object>} System admin user
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
 * Map CareVision order type to MedFlow order type
 * @param {string} cvType - CareVision order type
 * @returns {string} MedFlow order type
 */
function mapOrderType(cvType) {
  if (!cvType) return 'glasses';

  const typeMap = {
    'optical': 'glasses',
    'optique': 'glasses',
    'lunettes': 'glasses',
    'glasses': 'glasses',
    'lentilles': 'contact-lenses',
    'contact': 'contact-lenses',
    'contact-lenses': 'contact-lenses',
    'contacts': 'contact-lenses',
    'pharmacie': 'pharmacy',
    'pharmacy': 'pharmacy',
    'laboratoire': 'laboratory',
    'laboratory': 'laboratory',
    'autre': 'other',
    'other': 'other'
  };

  const normalized = cvType.toLowerCase().trim().replace(/[-\s]+/g, '_');
  return typeMap[normalized] || 'glasses';
}

/**
 * Map CareVision order status to MedFlow GlassesOrder status
 * @param {string} cvStatus - CareVision order status
 * @returns {string} MedFlow order status
 */
function mapOrderStatus(cvStatus) {
  if (!cvStatus) return 'delivered';

  const statusMap = {
    'processing': 'in-production',
    'en_cours': 'in-production',
    'encours': 'in-production',
    'pending': 'confirmed',
    'en_attente': 'confirmed',
    'attente': 'confirmed',
    'ready': 'ready',
    'prete': 'ready',
    'pret': 'ready',
    'delivered': 'delivered',
    'livree': 'delivered',
    'livre': 'delivered',
    'completed': 'delivered',
    'terminee': 'delivered',
    'termine': 'delivered',
    'cancelled': 'cancelled',
    'annulee': 'cancelled',
    'annule': 'cancelled'
  };

  const normalized = cvStatus.toLowerCase().trim().replace(/[-\s]+/g, '_');
  return statusMap[normalized] || 'delivered';
}

/**
 * Map CareVision payment status to MedFlow payment status
 * @param {number} amountPaid - Amount paid
 * @param {number} total - Total amount
 * @returns {string} MedFlow payment status
 */
function mapPaymentStatus(amountPaid, total) {
  if (amountPaid >= total && total > 0) {
    return 'paid';
  }
  if (amountPaid > 0 && amountPaid < total) {
    return 'partial';
  }
  return 'unpaid';
}

/**
 * Map CareVision lens material to MedFlow lens material
 * @param {string} material - CareVision lens material
 * @returns {string} MedFlow lens material
 */
function mapLensMaterial(material) {
  if (!material) return 'cr39';

  const materialMap = {
    'cr39': 'cr39',
    'cr-39': 'cr39',
    'organique': 'cr39',
    'organic': 'cr39',
    'polycarbonate': 'polycarbonate',
    'polycarb': 'polycarbonate',
    'trivex': 'trivex',
    '1.60': 'hi-index-1.60',
    '1.67': 'hi-index-1.67',
    '1.74': 'hi-index-1.74',
    'hi-index': 'hi-index-1.67'
  };

  const normalized = material.toLowerCase().trim();
  return materialMap[normalized] || 'cr39';
}

/**
 * Map CareVision lens design to MedFlow lens design
 * @param {string} design - CareVision lens design
 * @returns {string} MedFlow lens design
 */
function mapLensDesign(design) {
  if (!design) return 'single_vision';

  const designMap = {
    'unifocal': 'single_vision',
    'single': 'single_vision',
    'single_vision': 'single_vision',
    'simple_vision': 'single_vision',
    'bifocal': 'bifocal',
    'double_foyer': 'bifocal',
    'progressif': 'progressive',
    'progressive': 'progressive',
    'multifocal': 'progressive'
  };

  const normalized = design.toLowerCase().trim().replace(/[-\s]+/g, '_');
  return designMap[normalized] || 'single_vision';
}

/**
 * Transform line items from CareVision to MedFlow format
 * @param {Array} lineItems - CareVision line items
 * @returns {Array} MedFlow items array
 */
function transformLineItems(lineItems) {
  if (!lineItems || lineItems.length === 0) return [];

  return lineItems.map((item, index) => {
    // Determine category based on product code or description
    let category = 'service';
    const desc = (item.description || '').toLowerCase();
    const code = (item.productCode || '').toLowerCase();

    if (desc.includes('verre') || desc.includes('lens') || code.includes('vr')) {
      category = 'lens';
    } else if (desc.includes('monture') || desc.includes('frame') || code.includes('mt')) {
      category = 'frame';
    } else if (desc.includes('traitement') || desc.includes('coating') || code.includes('tr')) {
      category = 'coating';
    } else if (desc.includes('lentille') || desc.includes('contact') || code.includes('lc')) {
      category = 'contact-lens';
    }

    const quantity = item.quantity || 1;
    const unitPrice = item.unitPrice || 0;
    const discount = item.discount || 0;
    const total = item.lineTotal || (quantity * unitPrice - discount);

    return {
      description: item.description || `Article ${index + 1}`,
      category: category,
      quantity: quantity,
      unitPrice: unitPrice,
      discount: discount,
      total: total
    };
  });
}

/**
 * Extract prescription data from line items
 * @param {Array} lineItems - CareVision line items
 * @returns {Object} Prescription data for OD and OS
 */
function extractPrescriptionData(lineItems) {
  const prescription = {
    od: { sphere: null, cylinder: null, axis: null, add: null },
    os: { sphere: null, cylinder: null, axis: null, add: null }
  };

  if (!lineItems || lineItems.length === 0) return prescription;

  // Look for items with eye designation
  for (const item of lineItems) {
    if (item.eye === 'OD' && item.prescription) {
      prescription.od = {
        sphere: item.prescription.sphere,
        cylinder: item.prescription.cylinder,
        axis: item.prescription.axis,
        add: item.prescription.addition
      };
    } else if (item.eye === 'OS' && item.prescription) {
      prescription.os = {
        sphere: item.prescription.sphere,
        cylinder: item.prescription.cylinder,
        axis: item.prescription.axis,
        add: item.prescription.addition
      };
    }
  }

  return prescription;
}

/**
 * Transform CareVision order to MedFlow GlassesOrder document
 * @param {Object} cvOrder - CareVision order from SQL client
 * @param {Object} context - Import context with maps and references
 * @returns {Object|null} MedFlow order document or null if invalid
 */
function transformToMedFlowOrder(cvOrder, context) {
  const { patientMap, importedSet, clinic, systemUser } = context;

  // Check if already imported
  const cvId = cvOrder.legacyId?.toString();
  if (!cvId || importedSet.has(cvId)) {
    stats.skipped.alreadyImported++;
    return null;
  }

  // Find patient
  const cvPatientId = cvOrder.careVisionPatientId?.toString();
  const patient = patientMap.get(cvPatientId);
  if (!patient) {
    stats.skipped.patientNotFound++;
    stats.patientNotFoundIds.add(cvPatientId);
    return null;
  }

  // Map order type
  const orderType = mapOrderType(cvOrder.originalType);

  // Skip non-optical orders if type filter specified
  if (typeFilter) {
    const filterType = mapOrderType(typeFilter);
    if (orderType !== filterType && filterType !== 'other') {
      stats.skipped.nonOpticalType++;
      return null;
    }
  }

  // Track by type
  if (stats.byType[orderType] !== undefined) {
    stats.byType[orderType]++;
  } else {
    stats.byType.other++;
  }

  // Validate order date
  if (!cvOrder.orderDate) {
    stats.skipped.invalidData++;
    stats.errors.push(`Order ${cvId}: Missing order date`);
    return null;
  }

  const orderDate = new Date(cvOrder.orderDate);
  if (isNaN(orderDate.getTime())) {
    stats.skipped.invalidData++;
    stats.errors.push(`Order ${cvId}: Invalid date`);
    return null;
  }

  // Parse financial data
  const total = cvOrder.total || 0;
  const amountPaid = cvOrder.amountPaid || 0;
  const amountDue = cvOrder.amountDue || (total - amountPaid);

  // Validate amounts
  if (total < 0) {
    stats.skipped.invalidData++;
    stats.errors.push(`Order ${cvId}: Negative total amount`);
    return null;
  }

  // Map status
  const status = mapOrderStatus(cvOrder.status);
  const paymentStatus = mapPaymentStatus(amountPaid, total);

  // Transform line items
  const items = transformLineItems(cvOrder.lineItems || []);
  stats.lineItemsImported += items.length;

  // Extract prescription data from line items
  const prescriptionData = extractPrescriptionData(cvOrder.lineItems || []);

  // Calculate totals from items
  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalFromItems = subtotal > 0 ? subtotal : total;

  // Determine lens type from items or notes
  let lensDesign = 'single_vision';
  let lensMaterial = 'cr39';

  if (cvOrder.notes) {
    const notesLower = cvOrder.notes.toLowerCase();
    if (notesLower.includes('progressi')) {
      lensDesign = 'progressive';
    } else if (notesLower.includes('bifocal') || notesLower.includes('double')) {
      lensDesign = 'bifocal';
    }
    if (notesLower.includes('polycarb')) {
      lensMaterial = 'polycarbonate';
    } else if (notesLower.includes('1.67')) {
      lensMaterial = 'hi-index-1.67';
    } else if (notesLower.includes('1.60')) {
      lensMaterial = 'hi-index-1.60';
    }
  }

  // Build delivery date from CareVision data
  const deliveryDate = cvOrder.deliveryDate ? new Date(cvOrder.deliveryDate) : null;

  // Build timeline based on status
  const timeline = {
    createdAt: cvOrder.createdAt || orderDate
  };

  if (status === 'confirmed' || status === 'in-production' || status === 'ready' || status === 'delivered') {
    timeline.confirmedAt = orderDate;
  }
  if (status === 'in-production' || status === 'ready' || status === 'delivered') {
    timeline.sentToLabAt = orderDate;
  }
  if (status === 'ready' || status === 'delivered') {
    timeline.readyAt = deliveryDate || orderDate;
  }
  if (status === 'delivered') {
    timeline.deliveredAt = deliveryDate || orderDate;
  }
  if (status === 'cancelled') {
    timeline.cancelledAt = cvOrder.updatedAt || orderDate;
  }

  // Map order type to MedFlow orderType
  let medflowOrderType = 'glasses';
  if (orderType === 'contact-lenses') {
    medflowOrderType = 'contact-lenses';
  }

  // Build order document
  return {
    orderNumber: `CV-${cvId}`,
    patient: patient._id,
    clinic: clinic._id,
    orderedBy: systemUser._id,

    // Order type
    orderType: medflowOrderType,

    // Prescription data (if optical order with prescription)
    prescriptionData: {
      od: prescriptionData.od,
      os: prescriptionData.os,
      pd: {
        binocular: null,
        monocularOd: null,
        monocularOs: null
      }
    },

    // Right/Left lens simplified
    rightLens: prescriptionData.od,
    leftLens: prescriptionData.os,

    // Lens type
    lensType: {
      material: lensMaterial,
      design: lensDesign
    },

    // Order status
    status: status,
    priority: 'normal',

    // Timeline
    timeline: timeline,

    // Estimated/actual delivery
    estimatedDelivery: deliveryDate,

    // Lab info (if provider specified)
    lab: {
      name: cvOrder.provider || null,
      orderReference: cvOrder.prescriptionRef || null
    },

    // Pricing items
    items: items,

    // Financial summary
    subtotal: totalFromItems,
    discount: 0,
    tax: 0,
    total: total,

    // Payment tracking
    paymentStatus: paymentStatus,
    amountPaid: amountPaid,

    // Simplified pricing
    pricing: {
      subtotal: totalFromItems,
      framePrice: 0,
      lensPrice: 0,
      optionsPrice: 0,
      discount: 0,
      discountType: 'fixed',
      taxRate: 0,
      taxAmount: 0,
      finalTotal: total,
      companyPortion: 0,
      patientPortion: total
    },

    // Notes
    notes: {
      clinical: null,
      production: cvOrder.notes || null,
      internal: `Importation CareVision - Commande originale: ${cvOrder.orderNumber || cvId}`
    },

    // Audit fields
    createdBy: systemUser._id,
    createdAt: cvOrder.createdAt || orderDate,
    updatedAt: cvOrder.updatedAt || orderDate,

    // Tracking
    isDeleted: false
  };
}

/**
 * Process a batch of orders
 * @param {Array} orders - Array of MedFlow order documents
 */
async function processBatch(orders) {
  if (orders.length === 0) return;

  if (DRY_RUN) {
    stats.created += orders.length;
    return;
  }

  try {
    // Use native MongoDB driver for reliable bulk inserts
    const collection = mongoose.connection.db.collection('glassesorders');
    const result = await collection.insertMany(orders, { ordered: false });
    stats.created += result.insertedCount || orders.length;
  } catch (error) {
    if (error.writeErrors) {
      // Partial success - some documents inserted
      const inserted = orders.length - error.writeErrors.length;
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
async function importOrders() {
  console.log('\n' + '='.repeat(60));
  console.log('  CAREVISION ORDERS IMPORT');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  if (startDateArg) console.log(`Start Date Filter: ${startDateArg}`);
  if (endDateArg) console.log(`End Date Filter: ${endDateArg}`);
  if (typeFilter) console.log(`Type Filter: ${typeFilter}`);
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
  stats.totalInCareVision = await careVisionSqlClient.getOrderCount();
  console.log(`  Total orders in CareVision: ${stats.totalInCareVision.toLocaleString()}`);

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
  console.log('\nImporting orders with line items...');
  let offset = 0;
  let hasMore = true;
  const orderBatch = [];

  while (hasMore) {
    // Build query options
    const queryOptions = {
      limit: SQL_BATCH_SIZE,
      offset: offset,
      includeDetails: true // Include DetailCommande line items
    };

    if (startDateArg) {
      queryOptions.startDate = new Date(startDateArg);
    }
    if (endDateArg) {
      queryOptions.endDate = new Date(endDateArg);
    }
    if (typeFilter) {
      queryOptions.type = typeFilter;
    }

    // Fetch batch from CareVision
    const { records, total } = await careVisionSqlClient.getOrders(queryOptions);
    stats.fetched += records.length;

    if (records.length === 0) {
      hasMore = false;
      break;
    }

    // Transform and accumulate
    for (const cvOrder of records) {
      const medflowOrder = transformToMedFlowOrder(cvOrder, context);
      if (medflowOrder) {
        // Add required MongoDB _id
        medflowOrder._id = new mongoose.Types.ObjectId();
        orderBatch.push(medflowOrder);
      }

      // Process batch when full
      if (orderBatch.length >= BATCH_SIZE) {
        await processBatch([...orderBatch]);
        orderBatch.length = 0;

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
  if (orderBatch.length > 0) {
    await processBatch(orderBatch);
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
  console.log(`Line items imported: ${stats.lineItemsImported.toLocaleString()}`);
  console.log('');
  console.log('By Order Type:');
  console.log(`  Optical (glasses): ${stats.byType.optical.toLocaleString()}`);
  console.log(`  Contact lenses: ${stats.byType['contact-lenses'].toLocaleString()}`);
  console.log(`  Pharmacy: ${stats.byType.pharmacy.toLocaleString()}`);
  console.log(`  Other: ${stats.byType.other.toLocaleString()}`);
  console.log('');
  console.log('Skipped:');
  console.log(`  Already imported: ${stats.skipped.alreadyImported.toLocaleString()}`);
  console.log(`  Patient not found: ${stats.skipped.patientNotFound.toLocaleString()}`);
  console.log(`  Invalid data: ${stats.skipped.invalidData.toLocaleString()}`);
  if (typeFilter) {
    console.log(`  Non-matching type: ${stats.skipped.nonOpticalType.toLocaleString()}`);
  }
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
    await importOrders();

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
