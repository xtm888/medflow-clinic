/**
 * Transaction Fallback Verification Script
 *
 * Verifies that MongoDB transaction utilities work correctly in standalone mode.
 * Production runs MongoDB 7.0.5 standalone (no replica set), so transactions
 * must gracefully fall back to non-transactional execution.
 *
 * Usage: cd backend && node scripts/verifyTransactionFallback.js
 *
 * @module scripts/verifyTransactionFallback
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { isTransactionSupported, withTransactionRetry, atomicInventoryUpdate } = require('../utils/transactions');
const { Inventory } = require('../models/Inventory');

async function verifyFallback() {
  console.log('='.repeat(60));
  console.log('Transaction Fallback Verification');
  console.log('='.repeat(60));

  // Connect to MongoDB
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';
  console.log(`\nConnecting to MongoDB: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Get MongoDB server info
  const admin = mongoose.connection.db.admin();
  const serverInfo = await admin.serverStatus();
  console.log(`\nMongoDB Version: ${serverInfo.version}`);
  console.log(`Process: ${serverInfo.process}`);
  console.log(`Uptime: ${Math.floor(serverInfo.uptime / 3600)} hours`);

  // Check if replica set
  const hasReplicaSet = serverInfo.repl !== undefined;
  console.log(`Replica Set: ${hasReplicaSet ? 'YES' : 'NO (standalone)'}`);

  console.log('\n' + '-'.repeat(60));
  console.log('Test 1: Check transaction support detection');
  console.log('-'.repeat(60));

  const supported = await isTransactionSupported();
  console.log(`Transaction support: ${supported ? 'YES (replica set)' : 'NO (standalone)'}`);

  if (supported && !hasReplicaSet) {
    console.error('ERROR: isTransactionSupported() returned true but no replica set detected!');
    process.exit(1);
  }

  if (!supported && hasReplicaSet) {
    console.error('WARNING: isTransactionSupported() returned false but replica set detected');
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Test 2: Verify withTransactionRetry runs without transaction in standalone');
  console.log('-'.repeat(60));

  let sessionWasNull = false;
  let operationExecuted = false;

  const result = await withTransactionRetry(async (session) => {
    sessionWasNull = session === null;
    operationExecuted = true;
    console.log(`Session provided: ${session ? 'YES (transaction)' : 'NULL (standalone fallback)'}`);
    return { success: true, standalone: session === null };
  });

  console.log('withTransactionRetry result:', JSON.stringify(result, null, 2));

  if (!operationExecuted) {
    console.error('ERROR: Operation was not executed!');
    process.exit(1);
  }

  if (!supported && !sessionWasNull) {
    console.error('ERROR: Session should be null in standalone mode!');
    process.exit(1);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Test 3: Verify atomicInventoryUpdate function exists');
  console.log('-'.repeat(60));

  console.log('atomicInventoryUpdate available:', typeof atomicInventoryUpdate === 'function');

  if (typeof atomicInventoryUpdate !== 'function') {
    console.error('ERROR: atomicInventoryUpdate is not a function!');
    process.exit(1);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Test 4: Verify Inventory model has atomicDeduct method');
  console.log('-'.repeat(60));

  console.log('Inventory.atomicDeduct available:', typeof Inventory.atomicDeduct === 'function');
  console.log('Inventory.atomicAdd available:', typeof Inventory.atomicAdd === 'function');

  if (typeof Inventory.atomicDeduct !== 'function') {
    console.error('ERROR: Inventory.atomicDeduct is not a function!');
    process.exit(1);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Test 5: Verify $inc atomic operations work');
  console.log('-'.repeat(60));

  // Test that $inc operations work (the basis of atomic inventory updates)
  const testResult = await mongoose.connection.db.collection('test_atomic').findOneAndUpdate(
    { _id: 'test-atomic-increment' },
    {
      $inc: { counter: 1 },
      $set: { lastTest: new Date() }
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('Atomic $inc test result:', testResult ? 'SUCCESS' : 'FAILED');
  console.log('Counter value:', testResult?.counter || 'N/A');

  // Cleanup test document
  await mongoose.connection.db.collection('test_atomic').deleteOne({ _id: 'test-atomic-increment' });

  await mongoose.disconnect();

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(60));

  if (!supported) {
    console.log('\nSUMMARY: MongoDB is running in STANDALONE mode.');
    console.log('- Transactions will be skipped (withTransactionRetry passes null session)');
    console.log('- Atomic operations ($inc) still work correctly');
    console.log('- Race condition prevention relies on atomic operators and pessimistic locking');
    console.log('\nThis is the expected configuration for production (SERVEUR).');
  } else {
    console.log('\nSUMMARY: MongoDB is running with REPLICA SET.');
    console.log('- Full transaction support available');
    console.log('- withTransactionRetry will use actual sessions');
  }

  console.log('\nAll tests passed!');
}

verifyFallback()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
