#!/usr/bin/env node
/**
 * Console.log Migration Script
 *
 * This script helps identify and migrate console.log statements to structured logging.
 *
 * Usage:
 *   node scripts/migrateConsoleLogs.js [--dry-run] [--file path]
 *
 * This is a HELPER script - it analyzes files and suggests replacements.
 * Manual review is required before applying changes.
 *
 * MIGRATION STRATEGY:
 * ===================
 * 1. console.log with emoji (✅, ⚠️, ❌, 🚀) -> logger.info/warn/error
 * 2. console.error -> logger.error
 * 3. console.warn -> logger.warn
 * 4. console.log in try/catch -> logger.error (likely error handling)
 * 5. console.log with request data -> requestLogger middleware
 * 6. Temporary debug logs -> logger.debug (or remove)
 *
 * PRIORITY FILES:
 * ===============
 * High: server.js, controllers/*.js, middleware/*.js, services/*.js
 * Medium: routes/*.js, models/*.js
 * Low: scripts/*.js, tests/*.js (can keep console.log)
 */

const fs = require('fs');
const path = require('path');

// Files/directories to skip
const SKIP_PATTERNS = [
  'node_modules',
  '.test.js',
  'tests/',
  'scripts/migrate', // Don't migrate migration scripts
  'agents/' // Windows agents may need console.log
];

// Count and categorize console statements
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const stats = {
    console_log: 0,
    console_error: 0,
    console_warn: 0,
    console_info: 0,
    console_debug: 0,
    emoji_logs: 0, // ✅, ⚠️, ❌, 🚀
    suggestions: []
  };

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    if (line.includes('console.log')) {
      stats.console_log++;
      if (/[✅⚠️❌🚀📡🔌🛑]/.test(line)) {
        stats.emoji_logs++;
        stats.suggestions.push({
          line: lineNum,
          type: 'startup_log',
          original: line.trim(),
          suggestion: 'Replace with logger.info() - startup/status message'
        });
      } else if (line.includes('error') || line.includes('Error') || line.includes('fail')) {
        stats.suggestions.push({
          line: lineNum,
          type: 'potential_error',
          original: line.trim(),
          suggestion: 'Consider logger.error() - contains error-related text'
        });
      }
    } else if (line.includes('console.error')) {
      stats.console_error++;
      stats.suggestions.push({
        line: lineNum,
        type: 'error',
        original: line.trim(),
        suggestion: 'Replace with logger.error()'
      });
    } else if (line.includes('console.warn')) {
      stats.console_warn++;
      stats.suggestions.push({
        line: lineNum,
        type: 'warn',
        original: line.trim(),
        suggestion: 'Replace with logger.warn()'
      });
    }
  });

  return stats;
}

// Analyze directory
function analyzeDirectory(dirPath, results = {}) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);

    // Skip patterns
    if (SKIP_PATTERNS.some(pattern => relativePath.includes(pattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      analyzeDirectory(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const stats = analyzeFile(fullPath);
      const total = stats.console_log + stats.console_error + stats.console_warn;

      if (total > 0) {
        results[relativePath] = stats;
      }
    }
  }

  return results;
}

// Main
const backendPath = path.join(__dirname, '..');
console.log('Analyzing backend directory for console.log usage...\n');

const results = analyzeDirectory(backendPath);

// Summary
let totalLog = 0, totalError = 0, totalWarn = 0;

console.log('FILES WITH CONSOLE STATEMENTS:');
console.log('=' . repeat(60));

const sortedFiles = Object.entries(results)
  .sort((a, b) => {
    const aTotal = a[1].console_log + a[1].console_error + a[1].console_warn;
    const bTotal = b[1].console_log + b[1].console_error + b[1].console_warn;
    return bTotal - aTotal;
  })
  .slice(0, 30); // Top 30 files

for (const [file, stats] of sortedFiles) {
  const total = stats.console_log + stats.console_error + stats.console_warn;
  console.log(`\n${file}: ${total} statements`);
  console.log(`  log: ${stats.console_log}, error: ${stats.console_error}, warn: ${stats.console_warn}`);

  totalLog += stats.console_log;
  totalError += stats.console_error;
  totalWarn += stats.console_warn;

  // Show first 3 suggestions
  if (stats.suggestions.length > 0) {
    console.log('  Suggestions:');
    stats.suggestions.slice(0, 3).forEach(s => {
      console.log(`    Line ${s.line}: ${s.suggestion}`);
    });
    if (stats.suggestions.length > 3) {
      console.log(`    ... and ${stats.suggestions.length - 3} more`);
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY:');
console.log(`  Total console.log: ${totalLog}`);
console.log(`  Total console.error: ${totalError}`);
console.log(`  Total console.warn: ${totalWarn}`);
console.log(`  Files affected: ${Object.keys(results).length}`);
console.log('\nTo migrate, import the structured logger:');
console.log("  const { logger, createContextLogger } = require('./utils/structuredLogger');");
console.log("  const log = createContextLogger('ModuleName');");
console.log('\nThen replace:');
console.log("  console.log('message') -> log.info('message')");
console.log("  console.error('err') -> log.error('err')");
console.log("  console.warn('warn') -> log.warn('warn')");
