/**
 * Fix Admin Password Script
 * Uses centralized password from config/defaults.js
 */
require('dotenv').config({ path: '/Users/xtm888/magloire/backend/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const defaults = require('../config/defaults');

const { requireNonProduction } = require('./_guards');
requireNonProduction('fix_admin.js');

async function fixPassword() {
  await mongoose.connect(process.env.MONGODB_URI);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(defaults.admin.password, salt);

  const result = await mongoose.connection.db.collection('users').updateOne(
    { email: defaults.admin.email },
    { $set: { password: hashedPassword } }
  );

  console.log('Update result:', result.modifiedCount);

  // Verify
  const admin = await mongoose.connection.db.collection('users').findOne({ email: defaults.admin.email });
  const testPwd = await bcrypt.compare(defaults.admin.password, admin.password);
  console.log(`Password test (${defaults.admin.password}):`, testPwd ? 'CORRECT' : 'INCORRECT');

  process.exit(0);
}
fixPassword();
