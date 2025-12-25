/**
 * Recalculate Invoice Totals
 * Updates invoice company/patient shares based on per-item approval status
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('recalculateInvoiceTotals.js');

const Invoice = require('../models/Invoice');

async function recalculateTotals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const invoices = await Invoice.find({ isConventionInvoice: true });

    for (const inv of invoices) {
      let totalCompanyShare = 0;
      let totalPatientShare = 0;

      for (const item of inv.items) {
        totalCompanyShare += item.companyShare || 0;
        totalPatientShare += item.patientShare || 0;
      }

      const needsUpdate =
        inv.summary?.companyShare !== totalCompanyShare ||
        inv.summary?.patientShare !== totalPatientShare ||
        inv.companyBilling?.companyShare !== totalCompanyShare ||
        inv.companyBilling?.patientShare !== totalPatientShare;

      if (needsUpdate) {
        console.log(`\n📋 Invoice ${inv.invoiceNumber || inv._id}:`);
        console.log(`   Total: ${(inv.summary?.total || 0).toLocaleString()} FC`);
        console.log(`   Company Share: ${totalCompanyShare.toLocaleString()} FC`);
        console.log(`   Patient Share: ${totalPatientShare.toLocaleString()} FC`);

        const needsDeliberation = inv.items.filter(i => i.requiresApproval && !i.hasApproval);
        if (needsDeliberation.length > 0) {
          console.log('   ⚠️  Items needing délibération:');
          needsDeliberation.forEach(item => {
            console.log(`      - ${item.description}: ${(item.patientShare || 0).toLocaleString()} FC`);
          });
        }

        await Invoice.updateOne(
          { _id: inv._id },
          {
            $set: {
              'summary.companyShare': totalCompanyShare,
              'summary.patientShare': totalPatientShare,
              'companyBilling.companyShare': totalCompanyShare,
              'companyBilling.patientShare': totalPatientShare,
              'summary.amountDue': totalPatientShare
            }
          }
        );
      }
    }

    console.log('\n✅ Done');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

recalculateTotals();
