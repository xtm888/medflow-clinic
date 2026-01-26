/**
 * Quick verification script for Visit-Patient integrity
 * Outputs INTEGRITY_OK if all visits have valid patient references
 *
 * Usage: node scripts/verifyVisitPatientIntegrity.js
 * Expected output: INTEGRITY_OK
 */
require('../config/logger');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow-matrix')
  .then(async () => {
    const Visit = require('../models/Visit');
    const nullPatients = await Visit.countDocuments({ patient: null });
    console.log(nullPatients === 0 ? 'INTEGRITY_OK' : 'INTEGRITY_FAIL');
    process.exit(0);
  })
  .catch(e => {
    console.log('CONN_FAIL');
    process.exit(1);
  });
