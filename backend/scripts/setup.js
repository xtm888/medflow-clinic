#!/usr/bin/env node
/**
 * MedFlow Unified Setup Script
 * ============================
 *
 * A comprehensive script that handles all database setup, seeding, and initialization.
 * Consolidates all seed, create, and setup scripts into a single entry point.
 *
 * MODES:
 *   --fresh       Fresh install: indexes + all seeds (no test data)
 *   --dev         Development: fresh + test data + demo users
 *   --test        Test environment: minimal data for testing
 *   --production  Production: only essential seeds (no test data)
 *   --reset       WARNING: Drops database and starts fresh
 *
 * OPTIONS:
 *   --phase=N         Run only specific phase (1-8)
 *   --skip=name       Skip specific script (can be repeated)
 *   --only=name       Run only specific script
 *   --dry-run         Show what would be run without executing
 *   --continue        Continue from last failure
 *   --verbose         Show detailed output
 *   --no-indexes      Skip index creation
 *   --no-legacy       Skip legacy patient import
 *
 * EXAMPLES:
 *   node scripts/setup.js --dev                    # Full dev setup
 *   node scripts/setup.js --fresh --no-legacy      # Fresh without patient import
 *   node scripts/setup.js --phase=1                # Only foundation phase
 *   node scripts/setup.js --only=seedUsers         # Only seed users
 *   node scripts/setup.js --test --dry-run         # Preview test setup
 *
 * RUN VIA NPM:
 *   npm run setup                    # Default: --fresh
 *   npm run setup:dev                # Development mode
 *   npm run setup:test               # Test mode
 *   npm run setup:prod               # Production mode
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const { requireNonProduction } = require('./_guards');
requireNonProduction('setup.js');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCRIPTS_DIR = __dirname;
const STATE_FILE = path.join(SCRIPTS_DIR, '.setup-state.json');

// All scripts organized by phase and purpose
const SCRIPT_REGISTRY = {
  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 0: DATABASE PREPARATION (always runs first)
  // ══════════════════════════════════════════════════════════════════════════
  phase0: {
    name: 'Database Preparation',
    scripts: [
      { name: 'createIndexes', file: 'createIndexes.js', desc: 'Core database indexes', required: true },
      { name: 'createOptimizedIndexes', file: 'createOptimizedIndexes.js', desc: 'Performance indexes' },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1: FOUNDATION (must run before anything else)
  // ══════════════════════════════════════════════════════════════════════════
  phase1: {
    name: 'Foundation',
    scripts: [
      { name: 'seedClinics', file: 'seedClinics.js', desc: 'Clinic locations', required: true },
      { name: 'seedUsers', file: 'seedUsers.js', desc: 'Staff users', required: true },
      { name: 'seedRolePermissions', file: 'seedRolePermissions.js', desc: 'Role-based access control', required: true },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2: CONVENTIONS & BILLING
  // ══════════════════════════════════════════════════════════════════════════
  phase2: {
    name: 'Conventions & Billing',
    scripts: [
      { name: 'seedConventions', file: 'seedConventions.js', desc: 'Insurance companies' },
      { name: 'seedConventionRules', file: 'seedConventionRules.js', desc: 'Coverage rules' },
      { name: 'seedCompleteFeeSchedule', file: 'seedCompleteFeeSchedule.js', desc: 'Service pricing' },
      { name: 'seedMedicationFeeSchedules', file: 'seedMedicationFeeSchedules.js', desc: 'Drug pricing' },
      { name: 'seedFeeScheduleAliases', file: 'seedFeeScheduleAliases.js', desc: 'Fee code mappings' },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3: CLINICAL SERVICES & TEMPLATES
  // ══════════════════════════════════════════════════════════════════════════
  phase3: {
    name: 'Clinical Services',
    scripts: [
      { name: 'seedFrenchClinicalActs', file: 'seedFrenchClinicalActs.js', desc: 'Clinical procedures (French)' },
      { name: 'seedClinicalProcedures', file: 'seedClinicalProcedures.js', desc: 'Clinical procedures' },
      { name: 'seedCompleteServices', file: 'seedCompleteServices.js', desc: 'All medical services' },
      { name: 'seedAppointmentTypes', file: 'seedAppointmentTypes.js', desc: 'Appointment types' },
      { name: 'seedFrenchDrugs', file: 'seedFrenchDrugs.js', desc: 'French drug database' },
      { name: 'seedAllClinicMedications', file: 'seedAllClinicMedications.js', desc: 'Clinic medications' },
      { name: 'seedAllClinicEquipment', file: 'seedAllClinicEquipment.js', desc: 'Medical equipment' },
      { name: 'seedClinicDevices', file: 'seedClinicDevices.js', desc: 'Device configs' },
      { name: 'seedDiscoveredDevices', file: 'seedDiscoveredDevices.js', desc: 'Auto-discovered devices' },
      { name: 'seedTreatmentProtocols', file: 'seedTreatmentProtocolsComplete.js', desc: 'Treatment protocols' },
      { name: 'seedDoseTemplates', file: 'seedDoseTemplatesComplete.js', desc: 'Dosing guidelines' },
      { name: 'seedVitamins', file: 'seedVitaminsFromTemplates.js', desc: 'Vitamin templates' },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 4: DOCUMENT & LETTER TEMPLATES
  // ══════════════════════════════════════════════════════════════════════════
  phase4: {
    name: 'Document Templates',
    scripts: [
      { name: 'seedConsultationTemplates', file: 'seedConsultationTemplates.js', desc: 'Exam templates' },
      { name: 'seedDocumentTemplates', file: 'seedDocumentTemplates.js', desc: 'Document types' },
      { name: 'seedLetterTemplates', file: 'seedLetterTemplates.js', desc: 'Letter templates' },
      { name: 'seedCommentTemplates', file: 'seedCommentTemplates.js', desc: 'Common comments' },
      { name: 'seedTemplates', file: 'seedTemplates.js', desc: 'All clinical templates' },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 5: INVENTORY
  // ══════════════════════════════════════════════════════════════════════════
  phase5: {
    name: 'Inventory',
    scripts: [
      { name: 'seedPharmacyInventory', file: 'seedPharmacyInventory.js', desc: 'Pharmacy stock' },
      { name: 'seedFrameInventory', file: 'seedFrameInventory.js', desc: 'Eyeglass frames' },
      { name: 'seedDepotFrames', file: 'seedDepotFrames.js', desc: 'Depot frames' },
      { name: 'seedContactLensInventory', file: 'seedContactLensInventory.js', desc: 'Contact lenses' },
      { name: 'seedOpticalLensInventory', file: 'seedOpticalLensInventory.js', desc: 'Optical lenses' },
      { name: 'seedReagentInventory', file: 'seedReagentInventory.js', desc: 'Lab reagents' },
      { name: 'seedLabConsumableInventory', file: 'seedLabConsumableInventory.js', desc: 'Lab consumables' },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 6: IMAGING & ADDITIONAL
  // ══════════════════════════════════════════════════════════════════════════
  phase6: {
    name: 'Imaging & Additional',
    scripts: [
      { name: 'seedImagingData', file: 'seedImagingData.js', desc: 'Imaging equipment' },
      { name: 'seedAdditionalServices', file: 'seedAdditionalServices.js', desc: 'Extra services' },
      { name: 'seedComprehensiveConfig', file: 'seedComprehensiveConfig.js', desc: 'Rooms, taxes, fiscal years, referrers, surgical supplies, etc.' },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 7: LEGACY DATA IMPORT (optional, takes a long time)
  // ══════════════════════════════════════════════════════════════════════════
  phase7: {
    name: 'Legacy Data Import',
    optional: true,
    scripts: [
      { name: 'importPatients', file: 'importPatientsWithPapa.js', desc: 'Import ~38,929 legacy patients', slow: true },
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 8: TEST/DEMO DATA (only for dev/test modes)
  // ══════════════════════════════════════════════════════════════════════════
  phase8: {
    name: 'Test & Demo Data',
    devOnly: true,
    scripts: [
      { name: 'createAdminUser', file: 'createAdminFixed.js', desc: 'Admin user' },
      { name: 'createDemoUsers', file: 'createDemoUsers.js', desc: 'Demo users' },
      { name: 'seedCongoData', file: 'seedCongoData.js', desc: 'Sample patients & appointments' },
      { name: 'createTestPatients', file: 'createTestPatients.js', desc: 'Test patients' },
      { name: 'createTestPharmacyData', file: 'createTestPharmacyData.js', desc: 'Test pharmacy data' },
      { name: 'createSampleApprovals', file: 'createSampleApprovals.js', desc: 'Sample approvals' },
      { name: 'seedTestTransactionalData', file: 'seedTestTransactionalData.js', desc: 'All transactional test data (prescriptions, lab orders, etc.)' },
    ]
  },
};

// Mode configurations
const MODES = {
  fresh: {
    phases: [0, 1, 2, 3, 4, 5, 6],
    description: 'Fresh install with all base data (no test data, no legacy import)'
  },
  dev: {
    phases: [0, 1, 2, 3, 4, 5, 6, 8],
    description: 'Development setup with test data'
  },
  test: {
    phases: [0, 1, 8],
    description: 'Minimal setup for testing'
  },
  production: {
    phases: [0, 1, 2, 3, 4, 5, 6],
    description: 'Production setup (same as fresh)'
  },
  full: {
    phases: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    description: 'Everything including legacy import and test data'
  }
};

// ============================================================================
// UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(msg, color = '') {
  console.log(`${color}${msg}${colors.reset}`);
}

function logPhase(phase, name) {
  console.log('\n' + '═'.repeat(70));
  log(`  PHASE ${phase}: ${name.toUpperCase()}`, colors.cyan + colors.bright);
  console.log('═'.repeat(70));
}

function logScript(index, total, name, desc) {
  log(`\n  [${index}/${total}] ${name}`, colors.blue);
  log(`  ${desc}`, colors.gray);
  console.log('  ' + '-'.repeat(50));
}

function logSuccess(msg) {
  log(`  ✅ ${msg}`, colors.green);
}

function logError(msg) {
  log(`  ❌ ${msg}`, colors.red);
}

function logWarning(msg) {
  log(`  ⚠️  ${msg}`, colors.yellow);
}

function logSkip(msg) {
  log(`  ⏭️  ${msg}`, colors.gray);
}

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'fresh',
    phase: null,
    skip: [],
    only: null,
    dryRun: false,
    continue: false,
    verbose: false,
    noIndexes: false,
    noLegacy: true, // Default to skipping legacy import
    reset: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--fresh') options.mode = 'fresh';
    else if (arg === '--dev') options.mode = 'dev';
    else if (arg === '--test') options.mode = 'test';
    else if (arg === '--production' || arg === '--prod') options.mode = 'production';
    else if (arg === '--full') options.mode = 'full';
    else if (arg === '--reset') options.reset = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--continue') options.continue = true;
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg === '--no-indexes') options.noIndexes = true;
    else if (arg === '--no-legacy') options.noLegacy = true;
    else if (arg === '--with-legacy') options.noLegacy = false;
    else if (arg.startsWith('--phase=')) options.phase = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--skip=')) options.skip.push(arg.split('=')[1]);
    else if (arg.startsWith('--only=')) options.only = arg.split('=')[1];
  }

  return options;
}

function showHelp() {
  console.log(`
${colors.cyan}${colors.bright}MedFlow Unified Setup Script${colors.reset}
${'─'.repeat(50)}

${colors.yellow}MODES:${colors.reset}
  --fresh       Fresh install: indexes + all seeds (default)
  --dev         Development: fresh + test data + demo users
  --test        Test environment: minimal data for testing
  --production  Production: only essential seeds
  --full        Everything including legacy import

${colors.yellow}OPTIONS:${colors.reset}
  --phase=N       Run only specific phase (0-8)
  --skip=name     Skip specific script (repeatable)
  --only=name     Run only specific script
  --dry-run       Show what would run without executing
  --continue      Continue from last failure
  --verbose       Show detailed output
  --no-indexes    Skip index creation
  --no-legacy     Skip legacy patient import (default)
  --with-legacy   Include legacy patient import
  --reset         DROP DATABASE and start fresh (DANGEROUS!)
  --help          Show this help

${colors.yellow}EXAMPLES:${colors.reset}
  node scripts/setup.js --dev
  node scripts/setup.js --fresh --no-legacy
  node scripts/setup.js --phase=1
  node scripts/setup.js --only=seedUsers
  node scripts/setup.js --test --dry-run

${colors.yellow}NPM SCRIPTS:${colors.reset}
  npm run setup           # Fresh install
  npm run setup:dev       # Development mode
  npm run setup:test      # Test mode
  npm run setup:prod      # Production mode
`);
}

// ============================================================================
// STATE MANAGEMENT (for --continue)
// ============================================================================

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { completedScripts: [], lastRun: null };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState() {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

function runScript(scriptFile, options) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptFile);

  if (!fs.existsSync(scriptPath)) {
    return { success: false, error: 'File not found', skipped: true };
  }

  if (options.dryRun) {
    log(`  [DRY RUN] Would execute: node ${scriptFile}`, colors.gray);
    return { success: true, dryRun: true };
  }

  try {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: path.dirname(SCRIPTS_DIR),
      stdio: options.verbose ? 'inherit' : 'pipe',
      timeout: 600000, // 10 minute timeout
      encoding: 'utf8'
    });

    if (options.verbose && output) {
      console.log(output);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString()
    };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const startTime = Date.now();
  const state = options.continue ? loadState() : { completedScripts: [] };
  const results = { success: 0, failed: 0, skipped: 0 };
  const failures = [];

  // Header
  console.log('\n' + '╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(20) + 'MEDFLOW SETUP SCRIPT' + ' '.repeat(28) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  const modeConfig = MODES[options.mode];
  log(`\nMode: ${options.mode.toUpperCase()}`, colors.cyan);
  log(`Description: ${modeConfig.description}`, colors.gray);

  if (options.dryRun) {
    logWarning('DRY RUN - No changes will be made');
  }

  // Reset warning
  if (options.reset) {
    logWarning('RESET MODE - This will DROP the database!');
    log('  Press Ctrl+C within 5 seconds to cancel...', colors.red);
    await new Promise(r => setTimeout(r, 5000));
    // TODO: Implement database drop
    logWarning('Database reset not yet implemented - continuing with normal setup');
  }

  // Determine which phases to run
  let phasesToRun = options.phase !== null
    ? [options.phase]
    : modeConfig.phases;

  // Skip phase 0 if --no-indexes
  if (options.noIndexes) {
    phasesToRun = phasesToRun.filter(p => p !== 0);
  }

  // Skip phase 7 if --no-legacy
  if (options.noLegacy) {
    phasesToRun = phasesToRun.filter(p => p !== 7);
  }

  // Count total scripts
  let totalScripts = 0;
  let currentScript = 0;

  for (const phaseNum of phasesToRun) {
    const phase = SCRIPT_REGISTRY[`phase${phaseNum}`];
    if (phase) {
      totalScripts += phase.scripts.length;
    }
  }

  // Execute phases
  for (const phaseNum of phasesToRun) {
    const phase = SCRIPT_REGISTRY[`phase${phaseNum}`];
    if (!phase) continue;

    // Skip dev-only phases in production
    if (phase.devOnly && options.mode === 'production') {
      logSkip(`Skipping phase ${phaseNum} (dev only)`);
      continue;
    }

    logPhase(phaseNum, phase.name);

    for (const script of phase.scripts) {
      currentScript++;

      // Handle --only option
      if (options.only && script.name !== options.only) {
        continue;
      }

      // Handle --skip option
      if (options.skip.includes(script.name)) {
        logSkip(`Skipping ${script.name} (--skip)`);
        results.skipped++;
        continue;
      }

      // Handle --continue option
      if (options.continue && state.completedScripts.includes(script.name)) {
        logSkip(`Skipping ${script.name} (already completed)`);
        results.skipped++;
        continue;
      }

      logScript(currentScript, totalScripts, script.name, script.desc);

      const result = runScript(script.file, options);

      if (result.skipped) {
        logWarning(`Script not found: ${script.file}`);
        results.skipped++;
      } else if (result.dryRun) {
        results.success++;
      } else if (result.success) {
        logSuccess('Completed successfully');
        results.success++;
        state.completedScripts.push(script.name);
        saveState(state);
      } else {
        logError(`Failed: ${result.error}`);
        if (result.stderr) {
          log(`  ${result.stderr.slice(0, 200)}...`, colors.gray);
        }
        results.failed++;
        failures.push({ name: script.name, error: result.error });

        // Continue even on failure unless it's a required script
        if (script.required) {
          logError('Required script failed - aborting setup');
          break;
        }
      }
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(70));
  console.log('                           SETUP SUMMARY');
  console.log('═'.repeat(70));

  log(`\n  ✅ Successful: ${results.success}`, colors.green);
  log(`  ❌ Failed:     ${results.failed}`, results.failed > 0 ? colors.red : colors.gray);
  log(`  ⏭️  Skipped:    ${results.skipped}`, colors.gray);
  log(`  ⏱️  Duration:   ${duration}s`, colors.gray);

  if (failures.length > 0) {
    log('\n  Failed scripts:', colors.red);
    for (const f of failures) {
      log(`    - ${f.name}: ${f.error.slice(0, 50)}...`, colors.gray);
    }
    log('\n  Run with --continue to retry failed scripts', colors.yellow);
  }

  console.log('\n' + '═'.repeat(70));

  if (results.failed === 0) {
    log('  ✅ SETUP COMPLETED SUCCESSFULLY!', colors.green + colors.bright);
    clearState();
  } else {
    log('  ⚠️  SETUP COMPLETED WITH ERRORS', colors.yellow + colors.bright);
  }

  console.log('═'.repeat(70) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run
main().catch(error => {
  logError(`Setup failed: ${error.message}`);
  process.exit(1);
});
