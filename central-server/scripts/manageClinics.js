/**
 * Clinic Management Script
 *
 * Usage:
 *   node scripts/manageClinics.js list
 *   node scripts/manageClinics.js approve <clinicId>
 *   node scripts/manageClinics.js suspend <clinicId>
 *   node scripts/manageClinics.js stats
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const ClinicRegistry = require('../models/ClinicRegistry');

const commands = {
  async list() {
    const clinics = await ClinicRegistry.find()
      .select('clinicId name shortName status type connection.lastSeenAt stats')
      .sort({ name: 1 })
      .lean();

    if (clinics.length === 0) {
      console.log('No clinics registered.');
      return;
    }

    console.log('\n╔═════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                            REGISTERED CLINICS                                   ║');
    console.log('╠═════════════════════════════════════════════════════════════════════════════════╣');

    clinics.forEach(clinic => {
      const lastSeen = clinic.connection?.lastSeenAt
        ? new Date(clinic.connection.lastSeenAt).toLocaleString()
        : 'Never';
      const isOnline = clinic.connection?.lastSeenAt
        ? (new Date() - new Date(clinic.connection.lastSeenAt)) < 5 * 60 * 1000
        : false;
      const statusIcon = isOnline ? '🟢' : '🔴';
      const statusText = {
        'active': '✅ Active',
        'pending': '⏳ Pending',
        'suspended': '⛔ Suspended'
      }[clinic.status] || clinic.status;

      console.log(`║  ${statusIcon} ${clinic.name.padEnd(40)} ${statusText.padEnd(15)} ║`);
      console.log(`║     ID: ${clinic.clinicId.padEnd(30)} Type: ${clinic.type.padEnd(15)} ║`);
      console.log(`║     Last Seen: ${lastSeen.padEnd(55)} ║`);
      if (clinic.stats) {
        console.log(`║     Synced: ${(clinic.stats.patientsCount || 0)} patients, ${(clinic.stats.invoicesCount || 0)} invoices`);
      }
      console.log('║' + '─'.repeat(85) + '║');
    });

    console.log('╚═════════════════════════════════════════════════════════════════════════════════╝');
    console.log(`\nTotal: ${clinics.length} clinic(s)`);
  },

  async approve(clinicId) {
    if (!clinicId) {
      console.log('Usage: node scripts/manageClinics.js approve <clinicId>');
      return;
    }

    const clinic = await ClinicRegistry.findOne({ clinicId });
    if (!clinic) {
      console.log(`❌ Clinic not found: ${clinicId}`);
      return;
    }

    if (clinic.status === 'active') {
      console.log(`ℹ️  Clinic "${clinic.name}" is already active.`);
      return;
    }

    clinic.status = 'active';
    clinic.approvedAt = new Date();
    clinic.approvedBy = 'management-script';
    await clinic.save();

    console.log(`✅ Clinic "${clinic.name}" has been approved and activated.`);
  },

  async suspend(clinicId) {
    if (!clinicId) {
      console.log('Usage: node scripts/manageClinics.js suspend <clinicId>');
      return;
    }

    const clinic = await ClinicRegistry.findOne({ clinicId });
    if (!clinic) {
      console.log(`❌ Clinic not found: ${clinicId}`);
      return;
    }

    if (clinic.status === 'suspended') {
      console.log(`ℹ️  Clinic "${clinic.name}" is already suspended.`);
      return;
    }

    clinic.status = 'suspended';
    clinic.suspendedAt = new Date();
    clinic.suspendedReason = 'Suspended via management script';
    await clinic.save();

    console.log(`⛔ Clinic "${clinic.name}" has been suspended.`);
  },

  async stats() {
    const clinics = await ClinicRegistry.find({ status: 'active' }).lean();

    const totalPatients = clinics.reduce((sum, c) => sum + (c.stats?.patientsCount || 0), 0);
    const totalInvoices = clinics.reduce((sum, c) => sum + (c.stats?.invoicesCount || 0), 0);
    const totalInventory = clinics.reduce((sum, c) => sum + (c.stats?.inventoryCount || 0), 0);

    const onlineClinics = clinics.filter(c =>
      c.connection?.lastSeenAt &&
      (new Date() - new Date(c.connection.lastSeenAt)) < 5 * 60 * 1000
    ).length;

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    CENTRAL SERVER STATS                       ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total Clinics:        ${clinics.length.toString().padEnd(38)}║`);
    console.log(`║  Online Clinics:       ${onlineClinics.toString().padEnd(38)}║`);
    console.log(`║  Synced Patients:      ${totalPatients.toString().padEnd(38)}║`);
    console.log(`║  Synced Invoices:      ${totalInvoices.toString().padEnd(38)}║`);
    console.log(`║  Synced Inventory:     ${totalInventory.toString().padEnd(38)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════╝');
  }
};

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command || !commands[command]) {
    console.log('Usage: node scripts/manageClinics.js <command> [args]');
    console.log('\nCommands:');
    console.log('  list              - List all registered clinics');
    console.log('  approve <id>      - Approve a pending clinic');
    console.log('  suspend <id>      - Suspend a clinic');
    console.log('  stats             - Show aggregate statistics');
    return;
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);

    await commands[command](...args);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();
