/**
 * Migration Script: Add itemId to Invoice Items and Convert Payment Allocations
 *
 * This script:
 * 1. Adds unique itemId to all invoice items that don't have one
 * 2. Converts payment itemAllocations from itemIndex to itemId
 * 3. Validates that all payment allocations reference valid items
 *
 * Usage:
 *   node backend/scripts/migrateInvoiceItemIds.js [--dry-run] [--limit=N]
 *
 * Options:
 *   --dry-run    Don't actually save changes, just report what would be done
 *   --limit=N    Only process N invoices (for testing)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

async function migrateInvoiceItemIds() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('\n🔄 Invoice ItemID Migration Script');
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be saved)' : 'LIVE (changes will be saved)'}`);
    if (limit) {
      console.log(`Limit: Processing ${limit} invoices only`);
    }
    console.log('\n');

    // Find all invoices
    let query = Invoice.find({});
    if (limit) {
      query = query.limit(limit);
    }
    const invoices = await query;

    console.log(`Found ${invoices.length} invoices to process\n`);

    const stats = {
      total: invoices.length,
      itemsUpdated: 0,
      paymentsConverted: 0,
      errors: 0,
      skipped: 0
    };

    const errors = [];

    for (const invoice of invoices) {
      try {
        let modified = false;

        // Step 1: Add itemId to items that don't have one
        invoice.items.forEach((item, index) => {
          if (!item.itemId) {
            item.itemId = new mongoose.Types.ObjectId().toString();
            stats.itemsUpdated++;
            modified = true;
            console.log(`  ✓ Added itemId to invoice ${invoice.invoiceId} item ${index}: ${item.description}`);
          }
        });

        // Step 2: Convert payment allocations from itemIndex to itemId
        if (invoice.payments && invoice.payments.length > 0) {
          invoice.payments.forEach(payment => {
            if (payment.itemAllocations && payment.itemAllocations.length > 0) {
              payment.itemAllocations.forEach(allocation => {
                // Only convert if using itemIndex and not already using itemId
                if (allocation.itemIndex !== undefined && !allocation.itemId) {
                  const item = invoice.items[allocation.itemIndex];

                  if (item && item.itemId) {
                    allocation.itemId = item.itemId;
                    // Keep itemIndex for backward compatibility (will be removed in future)
                    stats.paymentsConverted++;
                    modified = true;
                    console.log(`  ✓ Converted payment allocation in invoice ${invoice.invoiceId}: index ${allocation.itemIndex} → itemId ${item.itemId}`);
                  } else {
                    const error = `Invoice ${invoice.invoiceId}: Invalid itemIndex ${allocation.itemIndex} - item not found`;
                    console.error(`  ✗ ${error}`);
                    errors.push(error);
                    stats.errors++;
                  }
                } else if (allocation.itemId) {
                  // Already has itemId, verify it's valid
                  const item = invoice.items.find(i => i.itemId === allocation.itemId);
                  if (!item) {
                    const error = `Invoice ${invoice.invoiceId}: Invalid itemId ${allocation.itemId} - item not found`;
                    console.error(`  ✗ ${error}`);
                    errors.push(error);
                    stats.errors++;
                  }
                }
              });
            }
          });
        }

        // Save changes if modified and not dry run
        if (modified && !isDryRun) {
          await invoice.save();
          console.log(`  💾 Saved invoice ${invoice.invoiceId}\n`);
        } else if (modified && isDryRun) {
          console.log(`  📝 Would save invoice ${invoice.invoiceId} (dry run)\n`);
        } else {
          stats.skipped++;
        }

      } catch (error) {
        console.error(`\n❌ Error processing invoice ${invoice.invoiceId}:`, error.message);
        errors.push(`Invoice ${invoice.invoiceId}: ${error.message}`);
        stats.errors++;
      }
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Migration Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total invoices processed:     ${stats.total}`);
    console.log(`Items updated with itemId:    ${stats.itemsUpdated}`);
    console.log(`Payments converted:           ${stats.paymentsConverted}`);
    console.log(`Invoices skipped (no changes): ${stats.skipped}`);
    console.log(`Errors encountered:           ${stats.errors}`);
    console.log(`${'='.repeat(60)}\n`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:\n');
      errors.forEach(error => console.log(`  • ${error}`));
      console.log('\n');
    }

    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE: No changes were saved');
      console.log('   Run without --dry-run to apply changes\n');
    } else {
      console.log('\n✅ Migration complete!\n');
    }

    // Disconnect
    await mongoose.disconnect();
    process.exit(stats.errors > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateInvoiceItemIds();
