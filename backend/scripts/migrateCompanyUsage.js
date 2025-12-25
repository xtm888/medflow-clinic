#!/usr/bin/env node
/**
 * Migration Script: Populate CompanyUsage from Existing Invoices
 *
 * This script rebuilds the CompanyUsage cache from all existing convention invoices.
 * Run this once after deploying the CompanyUsage model to populate historical data.
 *
 * Usage:
 *   node scripts/migrateCompanyUsage.js
 *   node scripts/migrateCompanyUsage.js --year 2025
 *   node scripts/migrateCompanyUsage.js --dry-run
 *
 * Options:
 *   --year YYYY    Only migrate specific year (default: current year)
 *   --all-years    Migrate all years found in invoices
 *   --dry-run      Show what would be migrated without making changes
 *   --company ID   Only migrate specific company
 *   --verbose      Show detailed progress
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('migrateCompanyUsage.js');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  year: null,
  allYears: args.includes('--all-years'),
  dryRun: args.includes('--dry-run'),
  companyId: null,
  verbose: args.includes('--verbose')
};

// Parse --year YYYY
const yearIndex = args.indexOf('--year');
if (yearIndex !== -1 && args[yearIndex + 1]) {
  options.year = parseInt(args[yearIndex + 1]);
}

// Parse --company ID
const companyIndex = args.indexOf('--company');
if (companyIndex !== -1 && args[companyIndex + 1]) {
  options.companyId = args[companyIndex + 1];
}

// Default to current year if not specified
if (!options.year && !options.allYears) {
  options.year = new Date().getFullYear();
}

async function main() {
  console.log('='.repeat(60));
  console.log('CompanyUsage Migration Script');
  console.log('='.repeat(60));
  console.log('Options:', JSON.stringify(options, null, 2));
  console.log('');

  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/medflow';
  console.log(`Connecting to MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB\n');

  // Load models
  const Invoice = require('../models/Invoice');
  const CompanyUsage = require('../models/CompanyUsage');
  const Company = require('../models/Company');

  // Find all years with convention invoices
  let yearsToMigrate = [];
  if (options.allYears) {
    const yearAgg = await Invoice.aggregate([
      { $match: { isConventionInvoice: true } },
      { $group: { _id: { $year: '$dateIssued' } } },
      { $sort: { _id: 1 } }
    ]);
    yearsToMigrate = yearAgg.map(y => y._id).filter(y => y);
    console.log(`Found ${yearsToMigrate.length} years with convention invoices: ${yearsToMigrate.join(', ')}`);
  } else {
    yearsToMigrate = [options.year];
    console.log(`Migrating year: ${options.year}`);
  }

  // Get unique patient/company combinations
  const matchStage = {
    isConventionInvoice: true,
    'companyBilling.company': { $exists: true, $ne: null },
    status: { $nin: ['cancelled', 'voided', 'refunded'] }
  };

  if (options.companyId) {
    matchStage['companyBilling.company'] = new mongoose.Types.ObjectId(options.companyId);
  }

  const combinations = await Invoice.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          patient: '$patient',
          company: '$companyBilling.company',
          year: { $year: '$dateIssued' }
        }
      }
    }
  ]);

  console.log(`Found ${combinations.length} patient/company/year combinations to process\n`);

  if (options.dryRun) {
    console.log('DRY RUN - No changes will be made\n');
  }

  // Process each combination
  let processed = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const combo of combinations) {
    const { patient, company, year } = combo._id;

    if (!yearsToMigrate.includes(year)) {
      continue;
    }

    processed++;

    try {
      if (options.verbose) {
        console.log(`Processing: Patient ${patient}, Company ${company}, Year ${year}`);
      }

      if (options.dryRun) {
        // Just count what would be done
        const existing = await CompanyUsage.findOne({ patient, company, fiscalYear: year });
        if (existing) {
          updated++;
        } else {
          created++;
        }
      } else {
        // Actually rebuild
        const result = await CompanyUsage.rebuildFromInvoices(patient, company, year);

        if (result.createdAt && result.updatedAt &&
            result.createdAt.getTime() === result.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }

        if (options.verbose) {
          console.log(`  -> Total covered: ${result.totals.totalCovered}, Invoices: ${result.totals.invoiceCount}`);
        }
      }

      // Progress indicator
      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${combinations.length} (${Math.round(processed/combinations.length*100)}%)`);
      }

    } catch (err) {
      errors++;
      console.error(`Error processing Patient ${patient}, Company ${company}, Year ${year}:`, err.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total combinations processed: ${processed}`);
  console.log(`Records created: ${created}`);
  console.log(`Records updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  if (options.dryRun) {
    console.log('\nThis was a DRY RUN - no changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }

  // Get statistics
  if (!options.dryRun) {
    console.log('\nFinal Statistics:');
    for (const year of yearsToMigrate) {
      const count = await CompanyUsage.countDocuments({ fiscalYear: year });
      const totals = await CompanyUsage.aggregate([
        { $match: { fiscalYear: year } },
        {
          $group: {
            _id: null,
            totalCovered: { $sum: '$totals.totalCovered' },
            totalBilled: { $sum: '$totals.totalBilled' },
            invoiceCount: { $sum: '$totals.invoiceCount' }
          }
        }
      ]);

      if (totals[0]) {
        console.log(`  Year ${year}: ${count} records, ${totals[0].invoiceCount} invoices, ${totals[0].totalCovered.toLocaleString()} CDF covered`);
      } else {
        console.log(`  Year ${year}: ${count} records`);
      }
    }
  }

  await mongoose.disconnect();
  console.log('\nMigration complete.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
