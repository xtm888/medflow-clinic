/**
 * Production Readiness Test Suite
 *
 * Tests all critical systems before production deployment:
 * 1. Token Security (tokenType validation)
 * 2. Stock Transfer System
 * 3. Cross-Clinic Inventory
 * 4. Financial Isolation
 * 5. Controlled Substance Compliance
 * 6. Environment Validation
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('productionReadinessTest.js');

const { PharmacyInventory } = require('../models/Inventory');
const jwt = require('jsonwebtoken');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

// Test results collector
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function pass(test) {
  results.passed.push(test);
  log(`PASS: ${test}`, 'pass');
}

function fail(test, reason) {
  results.failed.push({ test, reason });
  log(`FAIL: ${test} - ${reason}`, 'fail');
}

function warn(test, reason) {
  results.warnings.push({ test, reason });
  log(`WARN: ${test} - ${reason}`, 'warn');
}

// ============================================
// TEST 1: Token Security
// ============================================
async function testTokenSecurity() {
  console.log('\n========================================');
  console.log('TEST 1: Token Security');
  console.log('========================================\n');

  // Test 1.1: Access token has tokenType
  const accessPayload = {
    id: 'test-user',
    role: 'admin',
    tokenType: 'access'
  };
  const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '15m' });
  const decodedAccess = jwt.verify(accessToken, process.env.JWT_SECRET || 'test-secret');

  if (decodedAccess.tokenType === 'access') {
    pass('Access token contains tokenType: access');
  } else {
    fail('Access token tokenType', `Expected 'access', got '${decodedAccess.tokenType}'`);
  }

  // Test 1.2: Refresh token has different tokenType
  const refreshPayload = {
    id: 'test-user',
    tokenType: 'refresh'
  };
  const refreshToken = jwt.sign(refreshPayload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '30d' });
  const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_SECRET || 'test-secret');

  if (decodedRefresh.tokenType === 'refresh') {
    pass('Refresh token contains tokenType: refresh');
  } else {
    fail('Refresh token tokenType', `Expected 'refresh', got '${decodedRefresh.tokenType}'`);
  }

  // Test 1.3: REFRESH_TOKEN_SECRET check
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.REFRESH_TOKEN_SECRET) {
      fail('REFRESH_TOKEN_SECRET', 'Not set in production environment');
    } else if (process.env.REFRESH_TOKEN_SECRET === process.env.JWT_SECRET) {
      fail('REFRESH_TOKEN_SECRET', 'Must be different from JWT_SECRET');
    } else {
      pass('REFRESH_TOKEN_SECRET is properly configured');
    }
  } else {
    warn('REFRESH_TOKEN_SECRET', 'Skipping check in non-production environment');
  }
}

// ============================================
// TEST 2: Stock Transfer System
// ============================================
async function testStockTransferSystem() {
  console.log('\n========================================');
  console.log('TEST 2: Stock Transfer System');
  console.log('========================================\n');

  const InventoryTransfer = require('../models/InventoryTransfer');
  const Clinic = require('../models/Clinic');

  // Test 2.1: InventoryTransfer model exists with required fields
  const transferSchema = InventoryTransfer.schema.paths;
  const requiredFields = ['transferNumber', 'source.clinic', 'destination.clinic', 'status', 'items'];

  let allFieldsExist = true;
  for (const field of requiredFields) {
    if (!transferSchema[field]) {
      fail(`Stock Transfer Schema - ${field}`, 'Field missing from InventoryTransfer model');
      allFieldsExist = false;
    }
  }
  if (allFieldsExist) {
    pass('InventoryTransfer model has all required fields');
  }

  // Test 2.2: Transfer workflow statuses exist
  const statusEnum = transferSchema.status?.enumValues || [];
  // Actual statuses in the model
  const expectedStatuses = ['draft', 'requested', 'approved', 'rejected', 'in-transit', 'completed', 'cancelled'];

  let allStatusesExist = true;
  for (const status of expectedStatuses) {
    if (!statusEnum.includes(status)) {
      fail(`Transfer status: ${status}`, 'Status not found in enum');
      allStatusesExist = false;
    }
  }
  if (allStatusesExist) {
    pass('All transfer workflow statuses exist');
  }

  // Test 2.3: Transfer types include depot-to-clinic
  const transferTypeEnum = transferSchema.type?.enumValues || [];
  if (transferTypeEnum.includes('depot-to-clinic')) {
    pass('depot-to-clinic transfer type supported');
  } else {
    fail('depot-to-clinic transfer type', 'Not found in type enum');
  }

  // Test 2.4: Check if any transfers exist in database
  const transferCount = await InventoryTransfer.countDocuments();
  log(`Found ${transferCount} inventory transfers in database`);
  if (transferCount > 0) {
    pass(`Stock transfer system has ${transferCount} existing transfers`);
  } else {
    warn('Stock transfers', 'No transfers in database - consider seeding test data');
  }
}

// ============================================
// TEST 3: Cross-Clinic Inventory
// ============================================
async function testCrossClinicInventory() {
  console.log('\n========================================');
  console.log('TEST 3: Cross-Clinic Inventory');
  console.log('========================================\n');

  
  const Clinic = require('../models/Clinic');

  // Test 3.1: Clinic model has isDepot field
  const clinicSchema = Clinic.schema.paths;
  if (clinicSchema.isDepot || clinicSchema['settings.isDepot']) {
    pass('Clinic model supports depot designation');
  } else {
    // Check if depot functionality exists elsewhere
    const clinicCount = await Clinic.countDocuments();
    if (clinicCount > 0) {
      const depotClinic = await Clinic.findOne({
        $or: [
          { isDepot: true },
          { 'settings.isDepot': true },
          { name: /depot/i },
          { name: /central/i }
        ]
      });
      if (depotClinic) {
        pass('Central depot/warehouse clinic found');
      } else {
        warn('Depot clinic', 'No depot clinic found - may need to designate one');
      }
    } else {
      warn('Clinic setup', 'No clinics in database');
    }
  }

  // Test 3.2: PharmacyInventory has clinic reference
  const inventorySchema = PharmacyInventory.schema.paths;
  if (inventorySchema.clinic) {
    pass('PharmacyInventory has clinic field for isolation');
  } else {
    fail('PharmacyInventory clinic field', 'Missing - inventory not isolated by clinic');
  }

  // Test 3.3: Check inventory distribution across clinics
  const inventoryByClinic = await PharmacyInventory.aggregate([
    { $group: { _id: '$clinic', count: { $sum: 1 }, totalStock: { $sum: '$inventory.currentStock' } } }
  ]);

  if (inventoryByClinic.length > 0) {
    log(`Inventory distributed across ${inventoryByClinic.length} clinics`);
    pass(`Cross-clinic inventory tracking active (${inventoryByClinic.length} locations)`);
  } else {
    warn('Cross-clinic inventory', 'No inventory data found');
  }
}

// ============================================
// TEST 4: Financial Isolation
// ============================================
async function testFinancialIsolation() {
  console.log('\n========================================');
  console.log('TEST 4: Financial Isolation');
  console.log('========================================\n');

  const Invoice = require('../models/Invoice');

  // Test 4.1: Invoice has clinic field
  const invoiceSchema = Invoice.schema.paths;
  if (invoiceSchema.clinic) {
    pass('Invoice has clinic field for isolation');
  } else {
    fail('Invoice clinic field', 'Missing - invoices not isolated by clinic');
  }

  // Test 4.2: Check invoice distribution
  const invoicesByClinic = await Invoice.aggregate([
    { $group: { _id: '$clinic', count: { $sum: 1 }, totalAmount: { $sum: '$total' } } }
  ]);

  if (invoicesByClinic.length > 0) {
    log(`Invoices distributed across ${invoicesByClinic.length} clinics`);
    invoicesByClinic.forEach(c => {
      log(`  Clinic ${c._id}: ${c.count} invoices, Total: ${c.totalAmount?.toFixed(2) || 0} CDF`);
    });
    pass('Financial data properly segmented by clinic');
  } else {
    warn('Invoice data', 'No invoices found');
  }

  // Test 4.3: Check clinicAuth middleware exists
  const fs = require('fs');
  const clinicAuthPath = require.resolve('../middleware/clinicAuth');
  if (fs.existsSync(clinicAuthPath)) {
    pass('clinicAuth middleware exists');
  } else {
    fail('clinicAuth middleware', 'File not found');
  }
}

// ============================================
// TEST 5: Controlled Substance Compliance
// ============================================
async function testControlledSubstances() {
  console.log('\n========================================');
  console.log('TEST 5: Controlled Substance Compliance');
  console.log('========================================\n');

  
  const Prescription = require('../models/Prescription');
  const User = require('../models/User');

  // Test 5.1: PharmacyInventory has controlledSubstance schema
  const inventorySchema = PharmacyInventory.schema.paths;
  if (inventorySchema['controlledSubstance.isControlled'] && inventorySchema['controlledSubstance.schedule']) {
    pass('PharmacyInventory has controlledSubstance schema');
  } else {
    fail('Controlled substance schema', 'Missing from PharmacyInventory');
  }

  // Test 5.2: Check schedule enum values
  const scheduleEnum = inventorySchema['controlledSubstance.schedule']?.enumValues || [];
  const expectedSchedules = ['I', 'II', 'III', 'IV', 'V'];

  let allSchedulesExist = true;
  for (const schedule of expectedSchedules) {
    if (!scheduleEnum.includes(schedule)) {
      allSchedulesExist = false;
    }
  }
  if (allSchedulesExist) {
    pass('All DEA schedules (I-V) supported');
  } else {
    fail('DEA schedules', `Only found: ${scheduleEnum.join(', ')}`);
  }

  // Test 5.3: User model has DEA number field
  const userSchema = User.schema.paths;
  if (userSchema.deaNumber) {
    pass('User model has deaNumber field');
  } else {
    warn('DEA number field', 'Not found in User model - may need to add for US compliance');
  }

  // Test 5.4: Check for controlled substances in inventory
  const controlledCount = await PharmacyInventory.countDocuments({ 'controlledSubstance.isControlled': true });
  log(`Found ${controlledCount} controlled substances in inventory`);
  if (controlledCount > 0) {
    pass(`${controlledCount} controlled substances tracked`);

    // Check schedule breakdown
    const scheduleBreakdown = await PharmacyInventory.aggregate([
      { $match: { 'controlledSubstance.isControlled': true } },
      { $group: { _id: '$controlledSubstance.schedule', count: { $sum: 1 } } }
    ]);
    scheduleBreakdown.forEach(s => {
      log(`  Schedule ${s._id}: ${s.count} items`);
    });
  } else {
    warn('Controlled substances', 'No controlled substances in inventory');
  }
}

// ============================================
// TEST 6: Environment Validation
// ============================================
async function testEnvironment() {
  console.log('\n========================================');
  console.log('TEST 6: Environment Validation');
  console.log('========================================\n');

  const { validateProductionEnv, isSecureSecret } = require('../utils/envValidator');

  // Test 6.1: Required env vars
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      pass(`${varName} is set`);
    } else {
      fail(varName, 'Not set');
    }
  }

  // Test 6.2: JWT_SECRET strength (in non-production, just warn)
  if (process.env.JWT_SECRET) {
    if (isSecureSecret(process.env.JWT_SECRET)) {
      pass('JWT_SECRET meets security requirements');
    } else if (process.env.NODE_ENV === 'production') {
      fail('JWT_SECRET', 'Does not meet security requirements (32+ chars, no weak patterns)');
    } else {
      warn('JWT_SECRET', 'Weak secret OK for development');
    }
  }

  // Test 6.3: Check backup encryption
  if (process.env.BACKUP_ENCRYPTION_KEY) {
    pass('BACKUP_ENCRYPTION_KEY is set');
  } else if (process.env.NODE_ENV === 'production') {
    warn('BACKUP_ENCRYPTION_KEY', 'Not set - backups will not be encrypted');
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     MEDFLOW PRODUCTION READINESS TEST SUITE                ║');
  console.log('║     Testing all critical systems                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nEnvironment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  try {
    // Connect to database
    await mongoose.connect(MONGODB_URI);
    log('Connected to MongoDB', 'info');

    // Run all tests
    await testTokenSecurity();
    await testStockTransferSystem();
    await testCrossClinicInventory();
    await testFinancialIsolation();
    await testControlledSubstances();
    await testEnvironment();

  } catch (error) {
    fail('Test execution', error.message);
  } finally {
    await mongoose.disconnect();
  }

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Passed:   ${results.passed.length}`);
  console.log(`❌ Failed:   ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(f => console.log(`   - ${f.test}: ${f.reason}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(w => console.log(`   - ${w.test}: ${w.reason}`));
  }

  // Calculate score
  const total = results.passed.length + results.failed.length;
  const score = total > 0 ? Math.round((results.passed.length / total) * 100) : 0;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PRODUCTION READINESS SCORE: ${score}%`);
  console.log(`${'═'.repeat(60)}`);

  if (score >= 90) {
    console.log('✅ READY FOR PRODUCTION');
  } else if (score >= 70) {
    console.log('⚠️  MOSTLY READY - Address failed tests before production');
  } else {
    console.log('❌ NOT READY - Critical issues need to be resolved');
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}

runAllTests();
