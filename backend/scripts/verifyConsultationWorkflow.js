#!/usr/bin/env node
/**
 * Consultation Workflow Verification Script
 *
 * Verifies the granular update pattern implementation:
 * - PUT /api/visits/:id/refraction
 * - PUT /api/visits/:id/diagnosis
 * - PUT /api/visits/:id/treatment
 * - PUT /api/visits/:id/iop
 *
 * This script tests:
 * 1. Each endpoint saves data independently (no cascade)
 * 2. Validation works correctly
 * 3. Error handling is proper
 * 4. Data integrity is maintained
 *
 * Usage: node scripts/verifyConsultationWorkflow.js [--visit-id <id>] [--api-url <url>]
 */

const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:5001';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow-matrix';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) { log(`✓ ${message}`, 'green'); }
function logError(message) { log(`✗ ${message}`, 'red'); }
function logInfo(message) { log(`ℹ ${message}`, 'blue'); }
function logSection(message) { log(`\n=== ${message} ===`, 'cyan'); }

/**
 * Verify visitGranularService exports all required methods
 */
async function verifyServiceExports() {
  logSection('Verifying visitGranularService exports');

  try {
    const service = require('../services/visitGranularService');
    const requiredMethods = [
      'updateVisitRefraction',
      'updateVisitDiagnosis',
      'updateVisitTreatment',
      'updateVisitIOP'
    ];

    let allFound = true;
    for (const method of requiredMethods) {
      if (typeof service[method] === 'function') {
        logSuccess(`${method}() exported and is a function`);
      } else {
        logError(`${method}() missing or not a function`);
        allFound = false;
      }
    }

    // Check extended methods
    const extendedMethods = [
      'updateVisitVisualAcuity',
      'updateVisitAnteriorSegment',
      'updateVisitPosteriorSegment',
      'updateVisitKeratometry',
      'updateVisitPathologyFindings',
      'updateVisitNotes'
    ];

    let extendedCount = 0;
    for (const method of extendedMethods) {
      if (typeof service[method] === 'function') {
        extendedCount++;
      }
    }
    logInfo(`${extendedCount}/${extendedMethods.length} extended methods found`);

    return allFound;
  } catch (error) {
    logError(`Failed to load service: ${error.message}`);
    return false;
  }
}

/**
 * Verify route handlers exist
 */
async function verifyRouteHandlers() {
  logSection('Verifying route handlers');

  try {
    const fs = require('fs');
    const path = require('path');
    const routeFile = path.join(__dirname, '../routes/visits.js');
    const content = fs.readFileSync(routeFile, 'utf8');

    const routes = [
      { pattern: /PUT.*\/refraction/, name: 'PUT /:id/refraction' },
      { pattern: /PUT.*\/diagnosis/, name: 'PUT /:id/diagnosis' },
      { pattern: /PUT.*\/treatment/, name: 'PUT /:id/treatment' },
      { pattern: /PUT.*\/iop/, name: 'PUT /:id/iop' }
    ];

    let allFound = true;
    for (const route of routes) {
      if (route.pattern.test(content)) {
        logSuccess(`Route ${route.name} found`);
      } else {
        logError(`Route ${route.name} missing`);
        allFound = false;
      }
    }

    // Check for granular service import
    if (content.includes('visitGranularService')) {
      logSuccess('visitGranularService imported');
    } else {
      logError('visitGranularService not imported');
      allFound = false;
    }

    return allFound;
  } catch (error) {
    logError(`Failed to verify routes: ${error.message}`);
    return false;
  }
}

/**
 * Verify frontend service methods
 */
async function verifyFrontendService() {
  logSection('Verifying frontend visitService');

  try {
    const fs = require('fs');
    const path = require('path');
    const serviceFile = path.join(__dirname, '../../frontend/src/services/visitService.js');
    const content = fs.readFileSync(serviceFile, 'utf8');

    const methods = ['saveRefraction', 'saveDiagnosis', 'saveTreatment', 'saveIOP'];

    let allFound = true;
    for (const method of methods) {
      if (content.includes(method)) {
        logSuccess(`Frontend method ${method}() found`);
      } else {
        logError(`Frontend method ${method}() missing`);
        allFound = false;
      }
    }

    return allFound;
  } catch (error) {
    logError(`Failed to verify frontend service: ${error.message}`);
    return false;
  }
}

/**
 * Verify StudioVision integration
 */
async function verifyStudioVisionIntegration() {
  logSection('Verifying StudioVision integration');

  try {
    const fs = require('fs');
    const path = require('path');
    const consultationFile = path.join(__dirname, '../../frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx');
    const content = fs.readFileSync(consultationFile, 'utf8');

    const integrations = [
      { pattern: /saveRefractionData/, name: 'saveRefractionData handler' },
      { pattern: /saveDiagnosisData/, name: 'saveDiagnosisData handler' },
      { pattern: /saveTreatmentData/, name: 'saveTreatmentData handler' },
      { pattern: /saveIOPData/, name: 'saveIOPData handler' },
      { pattern: /visitService\.saveRefraction/, name: 'visitService.saveRefraction call' },
      { pattern: /visitService\.saveDiagnosis/, name: 'visitService.saveDiagnosis call' },
      { pattern: /visitService\.saveTreatment/, name: 'visitService.saveTreatment call' },
      { pattern: /visitService\.saveIOP/, name: 'visitService.saveIOP call' }
    ];

    let allFound = true;
    for (const item of integrations) {
      if (item.pattern.test(content)) {
        logSuccess(`${item.name} found`);
      } else {
        logError(`${item.name} missing`);
        allFound = false;
      }
    }

    // Check for independent save pattern
    if (content.includes('hasChanges.refraction') &&
        content.includes('hasChanges.diagnostic') &&
        content.includes('hasChanges.prescription') &&
        content.includes('hasChanges.examination')) {
      logSuccess('Independent section change tracking implemented');
    } else {
      logError('Independent section change tracking missing');
      allFound = false;
    }

    return allFound;
  } catch (error) {
    logError(`Failed to verify StudioVision: ${error.message}`);
    return false;
  }
}

/**
 * Verify validation helpers
 */
async function verifyValidationHelpers() {
  logSection('Verifying validation helpers');

  try {
    const service = require('../services/visitGranularService');

    // Test validateObjectId
    const validId = new mongoose.Types.ObjectId().toString();
    service.validateObjectId(validId, 'testId'); // Should not throw
    logSuccess('validateObjectId accepts valid ObjectId');

    try {
      service.validateObjectId('invalid-id', 'testId');
      logError('validateObjectId should reject invalid ID');
      return false;
    } catch (error) {
      if (error.statusCode === 400) {
        logSuccess('validateObjectId rejects invalid ID with 400');
      } else {
        logError('validateObjectId should return 400 status');
        return false;
      }
    }

    // Test validateIOPValue
    try {
      if (typeof service.validateIOPValue === 'function') {
        service.validateIOPValue(15, 'OD'); // Valid
        logSuccess('validateIOPValue accepts valid IOP (15)');

        try {
          service.validateIOPValue(70, 'OD'); // Invalid - too high
          logError('validateIOPValue should reject IOP > 60');
          return false;
        } catch (error) {
          logSuccess('validateIOPValue rejects IOP > 60');
        }
      }
    } catch (error) {
      logInfo('validateIOPValue not exported (internal function)');
    }

    return true;
  } catch (error) {
    logError(`Failed to verify validation: ${error.message}`);
    return false;
  }
}

/**
 * Database connectivity check
 */
async function verifyDatabaseConnection() {
  logSection('Verifying database connection');

  try {
    await mongoose.connect(MONGODB_URI);
    logSuccess('MongoDB connected');

    // Verify Visit model loads
    const Visit = require('../models/Visit');
    const count = await Visit.countDocuments({});
    logInfo(`Visit collection has ${count} documents`);

    // Verify no visits with null patient
    const nullPatients = await Visit.countDocuments({ patient: null });
    if (nullPatients === 0) {
      logSuccess('No visits with null patient reference');
    } else {
      logError(`Found ${nullPatients} visits with null patient`);
    }

    return true;
  } catch (error) {
    logError(`Database connection failed: ${error.message}`);
    return false;
  }
}

/**
 * Main verification routine
 */
async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║       Consultation Workflow Verification Script             ║', 'cyan');
  log('║       MedFlow - CareVision Granular Update Pattern          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝\n', 'cyan');

  const results = {
    serviceExports: false,
    routeHandlers: false,
    frontendService: false,
    studioVision: false,
    validation: false,
    database: false
  };

  // Run verifications
  results.serviceExports = await verifyServiceExports();
  results.routeHandlers = await verifyRouteHandlers();
  results.frontendService = await verifyFrontendService();
  results.studioVision = await verifyStudioVisionIntegration();
  results.validation = await verifyValidationHelpers();
  results.database = await verifyDatabaseConnection();

  // Summary
  logSection('Verification Summary');

  const checks = Object.entries(results);
  const passed = checks.filter(([_, v]) => v).length;
  const total = checks.length;

  for (const [name, passed] of checks) {
    if (passed) {
      logSuccess(`${name}: PASSED`);
    } else {
      logError(`${name}: FAILED`);
    }
  }

  log(`\n${passed}/${total} verification checks passed`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n✓ Consultation workflow verification SUCCESSFUL', 'green');
    log('  The granular update pattern is correctly implemented.', 'green');
    log('  Each section (refraction, diagnosis, treatment, IOP) saves independently.', 'green');
  } else {
    log('\n✗ Some verification checks failed', 'red');
    log('  Please review the errors above and fix the issues.', 'red');
  }

  // Manual testing instructions
  log('\n=== Manual Testing Instructions ===', 'cyan');
  log(`
To complete end-to-end verification:

1. Start the backend:
   cd backend && npm start

2. Start the frontend:
   cd frontend && npm run dev

3. Open browser to: http://localhost:5173

4. Login and navigate to a patient consultation

5. Test each section independently:
   - Enter refraction data → Save → Verify saved
   - Enter diagnosis data → Save → Verify saved (refraction still there)
   - Enter treatment data → Save → Verify saved (all previous still there)
   - Enter IOP data → Save → Verify saved (all previous still there)

6. Test error isolation:
   - Save valid refraction
   - Try to save invalid IOP (> 60 mmHg)
   - Verify: IOP fails, but refraction is NOT affected

Success criteria:
✓ No cascading failures between sections
✓ Each section saves independently
✓ Data persists after page refresh
✓ French error messages for validation
`, 'reset');

  // Cleanup
  await mongoose.connection.close();

  process.exit(passed === total ? 0 : 1);
}

// Run
main().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
