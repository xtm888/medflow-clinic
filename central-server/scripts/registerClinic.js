/**
 * Clinic Registration Script
 *
 * Usage:
 *   node scripts/registerClinic.js
 *
 * This script registers a new clinic with the central server.
 * It generates a sync token that the clinic will use for authentication.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const readline = require('readline');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const ClinicRegistry = require('../models/ClinicRegistry');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

async function registerClinic() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              CLINIC REGISTRATION WIZARD                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!\n');

    // Gather clinic information
    const clinicId = await question('Clinic ID (unique, e.g., "clinic-kinshasa"): ');

    // Check if clinic already exists
    const existing = await ClinicRegistry.findOne({ clinicId });
    if (existing) {
      console.log('\n❌ Error: A clinic with this ID already exists.');
      console.log(`   Status: ${existing.status}`);
      console.log(`   Name: ${existing.name}`);

      const overwrite = await question('\nDo you want to regenerate the sync token? (yes/no): ');
      if (overwrite.toLowerCase() === 'yes') {
        const syncToken = crypto.randomBytes(32).toString('hex');
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        existing.syncTokenHash = await bcrypt.hash(syncToken, salt);
        await existing.save();

        console.log('\n✅ Sync token regenerated!');
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║              NEW SYNC TOKEN (SAVE THIS!)                      ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log(`║  Clinic ID:   ${clinicId.padEnd(47)}║`);
        console.log(`║  Sync Token:  ${syncToken.substring(0, 32)}...  ║`);
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('\nFull Sync Token (copy this):');
        console.log(syncToken);
        console.log('\n⚠️  Store this token securely - it cannot be retrieved later!');
      }

      rl.close();
      await mongoose.connection.close();
      return;
    }

    const name = await question('Clinic Name (e.g., "Centre Ophtalmologique de Kinshasa"): ');
    const shortName = await question('Short Name (e.g., "COK"): ');
    const city = await question('City: ');
    const address = await question('Address: ');
    const phone = await question('Phone: ');
    const email = await question('Email: ');

    console.log('\nClinic Type:');
    console.log('  1. main - Main/headquarters clinic');
    console.log('  2. satellite - Branch clinic');
    console.log('  3. mobile - Mobile clinic unit');
    const typeChoice = await question('Select type (1/2/3): ');
    const typeMap = { '1': 'main', '2': 'satellite', '3': 'mobile' };
    const type = typeMap[typeChoice] || 'satellite';

    console.log('\nAvailable Services (comma-separated):');
    console.log('  consultation, ophthalmology, pharmacy, laboratory, surgery, optical');
    const servicesInput = await question('Services: ');
    const services = servicesInput.split(',').map(s => s.trim()).filter(s => s);

    // Generate sync token
    const syncToken = crypto.randomBytes(32).toString('hex');

    // Register the clinic
    const clinic = await ClinicRegistry.registerClinic({
      clinicId,
      name,
      shortName,
      location: {
        city,
        address,
        country: 'DRC'
      },
      contact: {
        phone,
        email
      },
      type,
      services: services.length > 0 ? services : ['consultation', 'ophthalmology', 'pharmacy']
    }, syncToken);

    console.log('\n✅ Clinic registered successfully!');
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              CLINIC CREDENTIALS (SAVE THESE!)                 ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  Clinic ID:   ${clinicId.padEnd(47)}║`);
    console.log(`║  API Key:     ${clinic.apiKey.padEnd(47)}║`);
    console.log(`║  Status:      ${clinic.status.padEnd(47)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    console.log('\nSync Token (copy this to the clinic\'s .env file):');
    console.log('─'.repeat(64));
    console.log(syncToken);
    console.log('─'.repeat(64));

    console.log('\n⚠️  IMPORTANT:');
    console.log('   1. Store the sync token securely - it cannot be retrieved later!');
    console.log('   2. Add these values to the clinic\'s backend .env file:');
    console.log(`      CENTRAL_SERVER_URL=http://your-central-server:5002`);
    console.log(`      CLINIC_ID=${clinicId}`);
    console.log(`      SYNC_TOKEN=${syncToken}`);
    console.log(`   3. The clinic status is "${clinic.status}" - you may need to approve it.`);

    if (clinic.status === 'pending') {
      const approve = await question('\nDo you want to approve this clinic now? (yes/no): ');
      if (approve.toLowerCase() === 'yes') {
        clinic.status = 'active';
        clinic.approvedAt = new Date();
        clinic.approvedBy = 'registration-script';
        await clinic.save();
        console.log('✅ Clinic approved and activated!');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\nDone.');
  }
}

// Run the script
registerClinic();
