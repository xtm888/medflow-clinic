const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixAdmin() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

  const User = require('../models/User');
  const Clinic = require('../models/Clinic');

  const admin = await User.findOne({ email: 'admin@medflow.com' }).select('+password');
  const clinics = await Clinic.find({});

  console.log('Admin found:', admin ? 'yes' : 'no');
  console.log('Clinics found:', clinics.length);

  if (admin) {
    // Reset password - set plain password, let pre-save hook hash it
    const testPassword = 'MedFlow$ecure1';
    admin.password = testPassword; // Pre-save hook will hash this

    // Ensure clinic access
    admin.accessAllClinics = true;
    admin.role = 'admin';
    admin.failedLoginAttempts = 0;
    admin.lockUntil = undefined;
    admin.isLocked = false;

    if (clinics.length > 0) {
      admin.clinic = clinics[0]._id;
      admin.clinics = clinics.map(c => c._id);
    }

    await admin.save();
    console.log('✓ Admin password reset to: MedFlow$ecure1');
    console.log('✓ Admin role:', admin.role);
    console.log('✓ Admin accessAllClinics:', admin.accessAllClinics);
    console.log('✓ Admin clinic:', clinics[0]?.name || 'none');

    // Reload and verify password
    const reloaded = await User.findOne({ email: 'admin@medflow.com' }).select('+password');
    const verify = await bcrypt.compare(testPassword, reloaded.password);
    console.log('✓ Password verification:', verify ? 'PASS' : 'FAIL');
  }

  await mongoose.disconnect();
}

fixAdmin().catch(console.error);
