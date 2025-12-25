/**
 * Production Safety Guards for MedFlow Scripts
 *
 * This module provides safety utilities to prevent destructive scripts
 * from running in production environments.
 *
 * Usage:
 *   const { requireNonProduction, requireConfirmation, logScriptExecution } = require('./_guards');
 *   requireNonProduction('myScript.js');
 *
 * @module _guards
 */

const readline = require('readline');

// Environments where destructive operations are allowed
const ALLOWED_ENVS = ['development', 'dev', 'test', 'local', 'staging', undefined];

// Get current environment (case-insensitive)
const currentEnv = process.env.NODE_ENV?.toLowerCase();

/**
 * Blocks script execution if running in production
 * @param {string} scriptName - Name of the script for logging
 * @throws {Error} If NODE_ENV is 'production'
 */
function requireNonProduction(scriptName) {
  if (currentEnv === 'production' || currentEnv === 'prod') {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║  ⛔ BLOCKED: Script cannot run in production environment!      ║');
    console.error('╠════════════════════════════════════════════════════════════════╣');
    console.error(`║  Script: ${scriptName.padEnd(53)}║`);
    console.error(`║  NODE_ENV: ${(process.env.NODE_ENV || 'undefined').padEnd(51)}║`);
    console.error('║                                                                ║');
    console.error('║  This script contains potentially destructive operations.     ║');
    console.error('║  Running it in production could cause data loss or corruption.║');
    console.error('║                                                                ║');
    console.error('║  If you need to run this in production:                       ║');
    console.error('║  1. Take a full database backup first                         ║');
    console.error('║  2. Use the --force-production flag (if supported)            ║');
    console.error('║  3. Or run with DRY_RUN=true to preview changes               ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }

  // Log allowed execution
  console.log(`✅ Environment check passed: ${currentEnv || 'development'}`);
}

/**
 * Blocks script unless explicitly allowed via --force-production flag
 * Use for scripts that MIGHT need to run in production with extra caution
 * @param {string} scriptName - Name of the script for logging
 * @param {object} options - Options for the check
 * @param {boolean} options.allowForce - Allow --force-production override
 */
function requireNonProductionStrict(scriptName, options = { allowForce: true }) {
  const isProduction = currentEnv === 'production' || currentEnv === 'prod';
  const hasForceFlag = process.argv.includes('--force-production');
  const isDryRun = process.env.DRY_RUN === 'true';

  if (isProduction && !hasForceFlag && !isDryRun) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║  ⛔ BLOCKED: Script requires explicit production permission!   ║');
    console.error('╠════════════════════════════════════════════════════════════════╣');
    console.error(`║  Script: ${scriptName.padEnd(53)}║`);
    console.error('║                                                                ║');
    if (options.allowForce) {
      console.error('║  To run in production, use one of:                            ║');
      console.error('║    node script.js --force-production                          ║');
      console.error('║    DRY_RUN=true node script.js                                ║');
    }
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE: No changes will be made');
  } else if (hasForceFlag && isProduction) {
    console.warn('⚠️  PRODUCTION MODE with --force-production flag');
  } else {
    console.log(`✅ Environment check passed: ${currentEnv || 'development'}`);
  }
}

/**
 * Prompts user for confirmation before proceeding
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} - True if confirmed
 */
async function requireConfirmation(message) {
  // Skip in non-interactive mode or if auto-confirmed
  if (process.env.AUTO_CONFIRM === 'true' || !process.stdin.isTTY) {
    console.log('⚡ Auto-confirmed (non-interactive mode)');
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`\n⚠️  ${message}\nType 'yes' to continue: `, (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'yes') {
        console.log('✅ Confirmed');
        resolve(true);
      } else {
        console.log('❌ Cancelled by user');
        process.exit(0);
      }
    });
  });
}

/**
 * Logs script execution for audit purposes
 * @param {string} scriptName - Name of the script
 * @param {object} metadata - Additional metadata to log
 */
function logScriptExecution(scriptName, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    script: scriptName,
    environment: currentEnv || 'development',
    user: process.env.USER || process.env.USERNAME || 'unknown',
    pid: process.pid,
    argv: process.argv.slice(2),
    ...metadata
  };

  console.log('📋 Script execution log:', JSON.stringify(logEntry, null, 2));
}

/**
 * Wrapper for safe script execution with all guards
 * @param {string} scriptName - Name of the script
 * @param {Function} mainFunction - The main script function to execute
 * @param {object} options - Options
 * @param {boolean} options.requireConfirm - Require user confirmation
 * @param {boolean} options.allowProduction - Allow in production with force flag
 */
async function safeExecute(scriptName, mainFunction, options = {}) {
  const { requireConfirm = false, allowProduction = false } = options;

  try {
    // Environment check
    if (allowProduction) {
      requireNonProductionStrict(scriptName);
    } else {
      requireNonProduction(scriptName);
    }

    // Log execution
    logScriptExecution(scriptName);

    // Confirmation if required
    if (requireConfirm) {
      await requireConfirmation(`This will execute ${scriptName}. Are you sure?`);
    }

    // Execute main function
    const startTime = Date.now();
    await mainFunction();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ ${scriptName} completed successfully in ${duration}s`);
  } catch (error) {
    console.error(`\n❌ ${scriptName} failed:`, error.message);
    if (process.env.DEBUG === 'true') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Check if running in dry run mode
 * @returns {boolean}
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true';
}

/**
 * Get the current environment
 * @returns {string}
 */
function getEnvironment() {
  return currentEnv || 'development';
}

module.exports = {
  requireNonProduction,
  requireNonProductionStrict,
  requireConfirmation,
  logScriptExecution,
  safeExecute,
  isDryRun,
  getEnvironment,
  ALLOWED_ENVS
};
