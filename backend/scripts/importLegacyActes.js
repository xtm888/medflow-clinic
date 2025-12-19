/**
 * Import Legacy Medical Acts from LV_Actes.csv
 *
 * Updates: Visit.clinicalActs (embedded array)
 * Creates: Invoice records with line items
 *
 * MUST RUN AFTER: importLegacyConsultations.js
 *
 * Usage:
 *   DRY_RUN=true node scripts/importLegacyActes.js   # Validate without importing
 *   node scripts/importLegacyActes.js                 # Full import
 */

const mongoose = require('mongoose');
const fs = require('fs');
const Papa = require('papaparse');
require('dotenv').config();

// Models
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 200;
const ACTES_FILE = '/Users/xtm888/Downloads/LV_Actes.csv';

// Statistics
const stats = {
  totalRows: 0,
  uniqueActes: 0,
  visitsUpdated: 0,
  invoicesCreated: 0,
  clinicalActsAdded: 0,
  conventionInvoices: 0,
  skipped: 0,
  errors: [],
  patientNotFound: new Set(),
  visitNotFound: new Set(),
  startTime: null
};

/**
 * Map Service to Invoice category
 */
const SERVICE_TO_CATEGORY = {
  'Pharmacie': 'medication',
  'Ophtalmologie - Examens': 'examination',
  'Ophtalmologie - Actes': 'procedure',
  'Consultations': 'consultation',
  'Laboratoire': 'laboratory',
  'Chirurgie': 'surgery',
  'Verres et Montures': 'optical',
  'Echographie': 'imaging',
  'Imagerie': 'imaging',
  'Kinésithérapie': 'therapy',
  'ORL': 'procedure',
  'Gynécologie': 'procedure',
  'Radiographie': 'imaging',
  'Scanner': 'imaging',
  'IRM': 'imaging',
  'Stomatologie': 'procedure',
  'Cardiologie': 'procedure',
  'Médecine Interne': 'consultation'
};

/**
 * Map Service to Visit clinicalActs actType
 */
const SERVICE_TO_ACT_TYPE = {
  'Pharmacie': 'therapy',
  'Ophtalmologie - Examens': 'examination',
  'Ophtalmologie - Actes': 'procedure',
  'Consultations': 'consultation',
  'Laboratoire': 'laboratory',
  'Chirurgie': 'procedure',
  'Verres et Montures': 'procedure',
  'Echographie': 'imaging',
  'Imagerie': 'imaging',
  'Kinésithérapie': 'therapy'
};

/**
 * Generate act code from act name
 */
function generateActCode(actName, service) {
  if (!actName) return 'ACT-UNK';

  // Clean and abbreviate
  const cleaned = actName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 8);

  // Add service prefix
  const prefixes = {
    'Pharmacie': 'MED',
    'Ophtalmologie - Examens': 'OPH',
    'Ophtalmologie - Actes': 'OPA',
    'Consultations': 'CON',
    'Laboratoire': 'LAB',
    'Chirurgie': 'SUR',
    'Verres et Montures': 'OPT'
  };

  const prefix = prefixes[service] || 'ACT';
  return `${prefix}_${cleaned}`;
}

/**
 * Build patient lookup map
 */
async function buildPatientMap() {
  console.log('Building patient lookup map...');
  const patients = await Patient.find(
    { 'legacyIds.lv': { $exists: true } },
    { _id: 1, 'legacyIds.lv': 1, patientId: 1 }
  ).lean();

  const map = new Map();
  for (const p of patients) {
    if (p.legacyIds?.lv) {
      map.set(p.legacyIds.lv, p._id);
    }
  }
  console.log(`  Loaded ${map.size} patients with legacy IDs`);
  return map;
}

/**
 * Build visit lookup map by legacy NumActe
 */
async function buildVisitMap() {
  console.log('Building visit lookup map...');
  const visits = await Visit.find(
    { 'legacyIds.lv': { $exists: true } },
    { _id: 1, 'legacyIds.lv': 1, visitId: 1, patient: 1, visitDate: 1 }
  ).lean();

  const map = new Map();
  for (const v of visits) {
    if (v.legacyIds?.lv) {
      map.set(v.legacyIds.lv, v);
    }
  }
  console.log(`  Loaded ${map.size} visits with legacy IDs`);
  return map;
}

/**
 * Build company lookup map by name
 */
async function buildCompanyMap() {
  console.log('Building company lookup map...');
  const companies = await Company.find({}, { _id: 1, name: 1, companyId: 1, defaultCoverage: 1 }).lean();

  const map = new Map();
  for (const c of companies) {
    map.set(c.name.toLowerCase(), c);
    // Also add by companyId if available
    if (c.companyId) {
      map.set(c.companyId.toLowerCase(), c);
    }
  }
  console.log(`  Loaded ${map.size} company name mappings`);
  return map;
}

/**
 * Group acts by NumActe (one invoice per NumActe)
 */
function groupActesByNumActe(rows) {
  const groups = new Map();

  for (const row of rows) {
    const numActe = row.NumActe?.trim();
    if (!numActe || numActe === '' || numActe === 'NumActe') continue;

    if (!groups.has(numActe)) {
      groups.set(numActe, {
        numActe,
        numFiche: row.NumFiche?.trim(),
        convention: row.Convention?.trim(),
        dateCreation: row.DateCreation?.trim(),
        dateRealisation: row.DateRealisation?.trim(),
        items: []
      });
    }

    groups.get(numActe).items.push({
      acte: row.Acte?.trim() || 'Acte non spécifié',
      service: row.Service?.trim() || 'Autre',
      famille: row.Famille?.trim(),
      prix: parseFloat(row.Prix) || 0,
      quantite: parseInt(row.Quantite) || 1,
      paiement: parseFloat(row.Paiement) || 0,
      resultat: row.Resultat1?.trim(),
      destination: row.Destination?.trim()
    });
  }

  return groups;
}

/**
 * Main import function
 */
async function importActes() {
  console.log('\n=== IMPORTING LEGACY MEDICAL ACTS ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}\n`);

  stats.startTime = Date.now();

  // Get clinic and system user
  const tombalbaye = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
  if (!tombalbaye) {
    throw new Error('Tombalbaye clinic not found!');
  }

  const systemUser = await User.findOne({ role: 'admin' });
  if (!systemUser) {
    throw new Error('No admin user found!');
  }

  console.log(`Clinic: ${tombalbaye.name}`);
  console.log(`System User: ${systemUser.firstName} ${systemUser.lastName}`);

  // Build lookup maps
  const patientMap = await buildPatientMap();
  const visitMap = await buildVisitMap();
  const companyMap = await buildCompanyMap();

  // Read and parse actes file
  if (!fs.existsSync(ACTES_FILE)) {
    throw new Error(`Actes file not found: ${ACTES_FILE}`);
  }

  const fileContent = fs.readFileSync(ACTES_FILE, 'utf8');
  console.log('\nParsing actes CSV...');

  const parsed = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim()
  });

  stats.totalRows = parsed.data.length;
  console.log(`Parsed ${stats.totalRows} act records`);

  // Group by NumActe
  const groups = groupActesByNumActe(parsed.data);
  stats.uniqueActes = groups.size;
  console.log(`Grouped into ${stats.uniqueActes} unique consultations\n`);

  // Process each group
  let processedCount = 0;
  const invoicesToInsert = [];

  for (const [numActe, group] of groups) {
    try {
      // Find patient
      const patientId = patientMap.get(group.numFiche);
      if (!patientId) {
        stats.patientNotFound.add(group.numFiche);
        stats.skipped++;
        continue;
      }

      // Find visit (may not exist if consultations import was skipped/partial)
      const visit = visitMap.get(numActe);

      // Parse dates
      let invoiceDate = new Date();
      if (group.dateCreation) {
        const parsed = new Date(group.dateCreation);
        if (!isNaN(parsed.getTime())) {
          invoiceDate = parsed;
        }
      }

      // Calculate totals
      let subtotal = 0;
      let totalPaid = 0;
      const invoiceItems = [];

      for (const item of group.items) {
        const itemTotal = item.prix * item.quantite;
        subtotal += itemTotal;
        totalPaid += item.paiement;

        const category = SERVICE_TO_CATEGORY[item.service] || 'other';
        const actCode = generateActCode(item.acte, item.service);

        invoiceItems.push({
          itemId: new mongoose.Types.ObjectId().toString(),
          description: item.acte,
          category: category,
          code: actCode,
          quantity: item.quantite,
          unitPrice: item.prix,
          discount: 0,
          subtotal: itemTotal,
          tax: 0,
          total: itemTotal,
          reference: item.resultat || undefined,
          realization: {
            realized: !!group.dateRealisation,
            realizedAt: group.dateRealisation ? new Date(group.dateRealisation) : undefined,
            realizedBy: systemUser._id
          }
        });

        stats.clinicalActsAdded++;
      }

      // Check for convention (company billing)
      const isConvention = group.convention &&
                          group.convention !== '[Patient Privé]' &&
                          group.convention !== 'Patient Privé' &&
                          group.convention.trim() !== '';

      let companyInfo = null;
      if (isConvention) {
        companyInfo = companyMap.get(group.convention.toLowerCase());
        if (!companyInfo) {
          // Try to find by partial match
          for (const [key, company] of companyMap) {
            if (key.includes(group.convention.toLowerCase()) ||
                group.convention.toLowerCase().includes(key)) {
              companyInfo = company;
              break;
            }
          }
        }
      }

      // Calculate company/patient split
      let companyShare = 0;
      let patientShare = subtotal;

      if (companyInfo) {
        const coveragePercentage = companyInfo.defaultCoverage?.percentage || 80;
        companyShare = Math.round((subtotal * coveragePercentage) / 100);
        patientShare = subtotal - companyShare;
        stats.conventionInvoices++;
      }

      // Determine payment status
      let status = 'draft';
      let amountDue = patientShare;

      if (totalPaid >= subtotal) {
        status = 'paid';
        amountDue = 0;
      } else if (totalPaid > 0) {
        status = 'partial';
        amountDue = Math.max(0, patientShare - totalPaid);
      } else if (group.dateCreation) {
        status = 'issued';
      }

      // Create invoice document
      const invoice = {
        patient: patientId,
        visit: visit ? visit._id : undefined,
        clinic: tombalbaye._id,
        dateIssued: invoiceDate,
        dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        items: invoiceItems,
        summary: {
          subtotal: subtotal,
          discountTotal: 0,
          taxTotal: 0,
          total: subtotal,
          amountPaid: Math.min(totalPaid, patientShare),
          amountDue: amountDue
        },
        payments: totalPaid > 0 ? [{
          paymentId: `PAY-LV-${numActe}`,
          amount: Math.min(totalPaid, patientShare),
          currency: 'CDF',
          amountInBaseCurrency: Math.min(totalPaid, patientShare),
          exchangeRate: 1,
          method: 'cash',
          date: invoiceDate,
          reference: `Legacy payment - ${numActe}`,
          notes: 'Imported from legacy system',
          isSystemGenerated: true
        }] : [],
        status: status,
        billing: {
          currency: 'CDF',
          taxRate: 0
        },
        isConventionInvoice: !!companyInfo,
        companyBilling: companyInfo ? {
          company: companyInfo._id,
          companyName: companyInfo.name,
          companyId: companyInfo.companyId,
          coveragePercentage: companyInfo.defaultCoverage?.percentage || 80,
          companyShare: companyShare,
          patientShare: patientShare,
          companyInvoiceStatus: 'pending'
        } : undefined,
        notes: {
          internal: `Imported from legacy system. NumActe: ${numActe}`
        },
        legacyIds: {
          lv: numActe
        },
        isLegacyData: true,
        createdBy: systemUser._id,
        createdAt: invoiceDate,
        updatedAt: invoiceDate
      };

      invoicesToInsert.push(invoice);

      // Update visit with clinical acts if visit exists
      if (visit && !DRY_RUN) {
        const clinicalActs = group.items.map(item => ({
          actName: item.acte,
          actCode: generateActCode(item.acte, item.service),
          actType: SERVICE_TO_ACT_TYPE[item.service] || 'other',
          price: item.prix,
          quantity: item.quantite,
          status: group.dateRealisation ? 'completed' : 'pending',
          startTime: group.dateRealisation ? new Date(group.dateRealisation) : undefined,
          endTime: group.dateRealisation ? new Date(group.dateRealisation) : undefined,
          provider: systemUser._id,
          results: item.resultat ? { notes: item.resultat } : undefined
        }));

        await Visit.updateOne(
          { _id: visit._id },
          {
            $push: { clinicalActs: { $each: clinicalActs } },
            $set: { updatedAt: new Date() }
          }
        );
        stats.visitsUpdated++;
      } else if (!visit) {
        stats.visitNotFound.add(numActe);
      }

      processedCount++;

      // Batch insert invoices
      if (invoicesToInsert.length >= BATCH_SIZE) {
        await insertInvoiceBatch(invoicesToInsert);
        invoicesToInsert.length = 0;

        // Progress
        const progress = Math.round((processedCount / stats.uniqueActes) * 100);
        const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
        console.log(`Progress: ${progress}% (${processedCount}/${stats.uniqueActes}) - ${elapsed}s`);
      }

    } catch (error) {
      stats.errors.push(`NumActe ${numActe}: ${error.message}`);
    }
  }

  // Insert remaining invoices
  if (invoicesToInsert.length > 0) {
    await insertInvoiceBatch(invoicesToInsert);
  }

  printSummary();
}

/**
 * Insert batch of invoices using native MongoDB driver
 * (Mongoose insertMany has issues in v7)
 */
async function insertInvoiceBatch(invoices) {
  if (DRY_RUN) {
    stats.invoicesCreated += invoices.length;
    return;
  }

  try {
    // Generate invoiceIds and add timestamps
    const now = new Date();
    for (const invoice of invoices) {
      if (!invoice.invoiceId) {
        // Generate unique invoiceId based on legacy reference
        const dateIssued = new Date(invoice.dateIssued);
        const year = dateIssued.getFullYear();
        const month = String(dateIssued.getMonth() + 1).padStart(2, '0');
        const uniquePart = invoice.legacyIds?.lv?.slice(-6) || Math.random().toString(36).slice(2, 8);
        invoice.invoiceId = `INV${year}${month}${uniquePart}`;
      }
      invoice.createdAt = invoice.createdAt || now;
      invoice.updatedAt = invoice.updatedAt || now;
      if (!invoice._id) {
        invoice._id = new mongoose.Types.ObjectId();
      }
    }

    // Use native MongoDB driver for reliable inserts
    const collection = mongoose.connection.db.collection('invoices');
    const result = await collection.insertMany(invoices, { ordered: false });
    stats.invoicesCreated += result.insertedCount || 0;
  } catch (error) {
    if (error.writeErrors) {
      const inserted = invoices.length - error.writeErrors.length;
      stats.invoicesCreated += inserted;
      stats.errors.push(`Batch: ${error.writeErrors.length} invoice insert errors`);
    } else {
      stats.errors.push(`Batch error: ${error.message}`);
    }
  }
}

/**
 * Print summary
 */
function printSummary() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);

  console.log(`\n${'='.repeat(50)}`);
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log(`Total Rows: ${stats.totalRows}`);
  console.log(`Unique Actes (Visits): ${stats.uniqueActes}`);
  console.log(`Invoices Created: ${stats.invoicesCreated}`);
  console.log(`Convention Invoices: ${stats.conventionInvoices}`);
  console.log(`Visits Updated: ${stats.visitsUpdated}`);
  console.log(`Clinical Acts Added: ${stats.clinicalActsAdded}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Patients Not Found: ${stats.patientNotFound.size}`);
  console.log(`Visits Not Found: ${stats.visitNotFound.size}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Time: ${elapsed}s`);

  if (stats.errors.length > 0) {
    console.log('\nFirst 10 errors:');
    stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }

  console.log('='.repeat(50));
}

/**
 * Main entry point
 */
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB\n');

    await importActes();

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
