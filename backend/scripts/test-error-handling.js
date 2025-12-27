/**
 * Error Handling Test Suite
 * Tests that critical error scenarios are handled gracefully
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(color, emoji, message) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
}

async function testDatabaseConnectionError() {
  log('blue', '🧪', 'Test 1: Database Connection Error');

  try {
    // Try to connect to non-existent database
    await mongoose.connect('mongodb://invalid-host:27017/test', {
      serverSelectionTimeoutMS: 2000
    });
    log('red', '❌', 'FAIL: Should have thrown connection error');
    return false;
  } catch (error) {
    if (error.name === 'MongooseServerSelectionError') {
      log('green', '✅', 'PASS: Connection error caught correctly');
      return true;
    }
    log('red', '❌', `FAIL: Unexpected error: ${error.message}`);
    return false;
  }
}

async function testDatabaseQueryError() {
  log('blue', '🧪', 'Test 2: Database Query Error (Invalid ObjectId)');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow');

    const Patient = require('../models/Patient');

    // Try to query with invalid ID
    await Patient.findById('invalid_id_format');
    log('red', '❌', 'FAIL: Should have thrown CastError');
    return false;
  } catch (error) {
    if (error.name === 'CastError') {
      log('green', '✅', 'PASS: Invalid ObjectId error caught');
      return true;
    }
    log('red', '❌', `FAIL: Unexpected error: ${error.message}`);
    return false;
  }
}

function testJSONParseError() {
  log('blue', '🧪', 'Test 3: JSON.parse Error (Malformed JSON)');

  const badJson = '{invalid: json}';

  try {
    JSON.parse(badJson);
    log('red', '❌', 'FAIL: Should have thrown SyntaxError');
    return false;
  } catch (error) {
    if (error instanceof SyntaxError) {
      log('green', '✅', 'PASS: JSON parse error caught');
      return true;
    }
    log('red', '❌', `FAIL: Unexpected error: ${error.message}`);
    return false;
  }
}

function testUnhandledPromiseRejection() {
  log('blue', '🧪', 'Test 4: Unhandled Promise Rejection Detection');

  let rejectionCaught = false;

  const handler = (reason, promise) => {
    rejectionCaught = true;
    log('green', '✅', 'PASS: Unhandled rejection caught by global handler');
  };

  process.on('unhandledRejection', handler);

  // Create unhandled rejection
  Promise.reject(new Error('Test rejection'));

  // Give it time to trigger
  return new Promise(resolve => {
    setTimeout(() => {
      process.removeListener('unhandledRejection', handler);
      if (!rejectionCaught) {
        log('red', '❌', 'FAIL: Unhandled rejection not caught');
      }
      resolve(rejectionCaught);
    }, 100);
  });
}

async function testFileSystemError() {
  log('blue', '🧪', 'Test 5: File System Error (Non-existent file)');

  const fs = require('fs').promises;

  try {
    await fs.readFile('/nonexistent/path/file.txt');
    log('red', '❌', 'FAIL: Should have thrown ENOENT error');
    return false;
  } catch (error) {
    if (error.code === 'ENOENT') {
      log('green', '✅', 'PASS: File system error caught');
      return true;
    }
    log('red', '❌', `FAIL: Unexpected error: ${error.message}`);
    return false;
  }
}

async function testAsyncErrorPropagation() {
  log('blue', '🧪', 'Test 6: Async Error Propagation');

  async function throwError() {
    throw new Error('Test error');
  }

  async function catchError() {
    try {
      await throwError();
      return false;
    } catch (error) {
      return true;
    }
  }

  const caught = await catchError();
  if (caught) {
    log('green', '✅', 'PASS: Async error propagated correctly');
    return true;
  } else {
    log('red', '❌', 'FAIL: Async error not caught');
    return false;
  }
}

async function testEventEmitterError() {
  log('blue', '🧪', 'Test 7: EventEmitter Error Handler');

  const EventEmitter = require('events');

  class TestEmitter extends EventEmitter {
    constructor() {
      super();
      this.errorCaught = false;

      this.on('error', (error) => {
        this.errorCaught = true;
      });
    }

    triggerError() {
      this.emit('error', new Error('Test error'));
    }
  }

  const emitter = new TestEmitter();
  emitter.triggerError();

  if (emitter.errorCaught) {
    log('green', '✅', 'PASS: EventEmitter error handler works');
    return true;
  } else {
    log('red', '❌', 'FAIL: EventEmitter error not caught');
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  log('blue', '🚀', 'STARTING ERROR HANDLING TESTS');
  console.log('='.repeat(60) + '\n');

  const results = [];

  results.push(await testDatabaseConnectionError());
  console.log('');

  results.push(await testDatabaseQueryError());
  console.log('');

  results.push(testJSONParseError());
  console.log('');

  results.push(await testUnhandledPromiseRejection());
  console.log('');

  results.push(await testFileSystemError());
  console.log('');

  results.push(await testAsyncErrorPropagation());
  console.log('');

  results.push(testEventEmitterError());
  console.log('');

  // Cleanup
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  // Summary
  console.log('='.repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;

  if (passed === total) {
    log('green', '✅', `ALL TESTS PASSED (${passed}/${total})`);
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } else {
    log('red', '❌', `SOME TESTS FAILED (${passed}/${total} passed)`);
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  log('red', '💥', `Test suite crashed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
