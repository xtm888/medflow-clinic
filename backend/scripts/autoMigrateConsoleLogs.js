#!/usr/bin/env node
/**
 * Auto-Migrate Console.log to Structured Logger
 *
 * This script AUTOMATICALLY migrates console.log/error/warn to structured logging.
 *
 * Usage:
 *   node scripts/autoMigrateConsoleLogs.js [--dry-run] [--services-only]
 *
 * Options:
 *   --dry-run        Show changes without applying them
 *   --services-only  Only migrate files in services/ directory
 */

const fs = require('fs');
const path = require('path');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('autoMigrateConsoleLogs.js');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SERVICES_ONLY = args.includes('--services-only');

// Files/directories to skip
const SKIP_PATTERNS = [
  'node_modules',
  '.test.js',
  'tests/',
  'scripts/',
  'agents/',
  'structuredLogger.js' // Don't migrate the logger itself
];

// Map of directory to context name
const CONTEXT_MAP = {
  'services/': 'Service',
  'controllers/': 'Controller',
  'middleware/': 'Middleware',
  'models/': 'Model',
  'routes/': 'Route'
};

// Get context name from file path
function getContextName(filePath) {
  const fileName = path.basename(filePath, '.js');
  // Remove common suffixes
  let context = fileName
    .replace(/Controller$/, '')
    .replace(/Service$/, '')
    .replace(/Middleware$/, '')
    .replace(/Route$/, '');

  // Capitalize first letter
  context = context.charAt(0).toUpperCase() + context.slice(1);

  return context;
}

// Generate import statement
function generateImport(context) {
  return `const { createContextLogger } = require('../utils/structuredLogger');\nconst log = createContextLogger('${context}');\n`;
}

// Check if file already has structuredLogger
function hasStructuredLogger(content) {
  return content.includes('structuredLogger') || content.includes('createContextLogger');
}

// Migrate a single file
function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Skip if already migrated
  if (hasStructuredLogger(content)) {
    return { skipped: true, reason: 'already migrated' };
  }

  // Count original console statements
  const originalLogCount = (content.match(/console\.log/g) || []).length;
  const originalErrorCount = (content.match(/console\.error/g) || []).length;
  const originalWarnCount = (content.match(/console\.warn/g) || []).length;

  if (originalLogCount + originalErrorCount + originalWarnCount === 0) {
    return { skipped: true, reason: 'no console statements' };
  }

  const context = getContextName(filePath);

  // Replace console statements
  // Pattern: console.log('message') -> log.info('message')
  // Pattern: console.log(`message ${var}`) -> log.info(`message ${var}`)
  // Pattern: console.error('error', error) -> log.error('error', { error })

  // Replace console.error
  content = content.replace(
    /console\.error\((['"`])(.+?)\1,\s*(\w+)\)/g,
    'log.error($1$2$1, { error: $3 })'
  );
  content = content.replace(
    /console\.error\((['"`])(.+?)\1\)/g,
    'log.error($1$2$1)'
  );
  content = content.replace(
    /console\.error\((['"`])(.*?)\1,\s*(['"`])(.*?)\3\)/g,
    'log.error($1$2$1, { detail: $3$4$3 })'
  );
  content = content.replace(
    /console\.error\((`[^`]+`)\)/g,
    'log.error($1)'
  );
  content = content.replace(
    /console\.error\(([^)]+)\)/g,
    'log.error($1)'
  );

  // Replace console.warn
  content = content.replace(
    /console\.warn\((['"`])(.+?)\1,\s*(\w+)\)/g,
    'log.warn($1$2$1, { data: $3 })'
  );
  content = content.replace(
    /console\.warn\((['"`])(.+?)\1\)/g,
    'log.warn($1$2$1)'
  );
  content = content.replace(
    /console\.warn\((`[^`]+`)\)/g,
    'log.warn($1)'
  );
  content = content.replace(
    /console\.warn\(([^)]+)\)/g,
    'log.warn($1)'
  );

  // Replace console.log - skip if inside string (common in help text)
  // Handle tagged logs like [FolderIndexer] or [SMB] prefix
  content = content.replace(
    /console\.log\((['"`])\[(\w+)\]\s*(.+?)\1\)/g,
    'log.info($1$3$1)'
  );

  // Handle standard console.log
  content = content.replace(
    /console\.log\((['"`])(.+?)\1,\s*(\w+)\)/g,
    'log.info($1$2$1, { data: $3 })'
  );
  content = content.replace(
    /console\.log\((['"`])(.+?)\1\)/g,
    'log.info($1$2$1)'
  );
  content = content.replace(
    /console\.log\((`[^`]+`)\)/g,
    'log.info($1)'
  );
  // Don't replace console.log with complex expressions (likely intentional)
  // Only replace simple console.log(variable) patterns
  content = content.replace(
    /console\.log\((['"`][^'"`)]+['"`])\)/g,
    'log.info($1)'
  );

  // If changes were made, add import
  if (content !== originalContent) {
    // Find the best place to insert import
    // After existing requires, before main code
    const lines = content.split('\n');
    let insertIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('const ') && line.includes('require(')) {
        insertIndex = i + 1;
      } else if (line.startsWith('module.exports') || line.startsWith('class ') || line.startsWith('function ')) {
        break;
      }
    }

    // Insert import
    const importLine = `const { createContextLogger } = require('../utils/structuredLogger');\nconst log = createContextLogger('${context}');`;
    lines.splice(insertIndex, 0, '', importLine);
    content = lines.join('\n');

    // Count final console statements
    const finalLogCount = (content.match(/console\.log/g) || []).length;
    const finalErrorCount = (content.match(/console\.error/g) || []).length;
    const finalWarnCount = (content.match(/console\.warn/g) || []).length;

    const stats = {
      migrated: true,
      context,
      replaced: {
        log: originalLogCount - finalLogCount,
        error: originalErrorCount - finalErrorCount,
        warn: originalWarnCount - finalWarnCount
      },
      remaining: {
        log: finalLogCount,
        error: finalErrorCount,
        warn: finalWarnCount
      }
    };

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content);
    }

    return stats;
  }

  return { skipped: true, reason: 'no changes needed' };
}

// Main
function main() {
  const servicesPath = path.join(__dirname, '../services');
  const controllersPath = path.join(__dirname, '../controllers');
  const middlewarePath = path.join(__dirname, '../middleware');

  const targetDirs = SERVICES_ONLY
    ? [servicesPath]
    : [servicesPath, controllersPath, middlewarePath];

  console.log(`\n${'='.repeat(60)}`);
  console.log('Console.log Auto-Migration Script');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (applying changes)'}`);
  console.log(`Scope: ${SERVICES_ONLY ? 'services/ only' : 'services/, controllers/, middleware/'}`);
  console.log('='.repeat(60));

  const results = {
    migrated: [],
    skipped: [],
    errors: []
  };

  for (const dirPath of targetDirs) {
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath, { recursive: true });

    for (const file of files) {
      if (typeof file !== 'string' || !file.endsWith('.js')) continue;

      const fullPath = path.join(dirPath, file);
      const relativePath = path.relative(path.join(__dirname, '..'), fullPath);

      // Skip patterns
      if (SKIP_PATTERNS.some(p => relativePath.includes(p))) continue;

      try {
        const result = migrateFile(fullPath);

        if (result.skipped) {
          results.skipped.push({ file: relativePath, reason: result.reason });
        } else if (result.migrated) {
          results.migrated.push({ file: relativePath, ...result });
        }
      } catch (error) {
        results.errors.push({ file: relativePath, error: error.message });
      }
    }
  }

  // Print results
  console.log('\n--- MIGRATED FILES ---');
  let totalReplaced = { log: 0, error: 0, warn: 0 };

  for (const r of results.migrated) {
    console.log(`\n${r.file}:`);
    console.log(`  Context: ${r.context}`);
    console.log(`  Replaced: log=${r.replaced.log}, error=${r.replaced.error}, warn=${r.replaced.warn}`);
    if (r.remaining.log + r.remaining.error + r.remaining.warn > 0) {
      console.log(`  Remaining: log=${r.remaining.log}, error=${r.remaining.error}, warn=${r.remaining.warn}`);
    }
    totalReplaced.log += r.replaced.log;
    totalReplaced.error += r.replaced.error;
    totalReplaced.warn += r.replaced.warn;
  }

  console.log(`\n--- SKIPPED FILES (${results.skipped.length}) ---`);
  const skippedByReason = {};
  for (const s of results.skipped) {
    skippedByReason[s.reason] = (skippedByReason[s.reason] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(skippedByReason)) {
    console.log(`  ${reason}: ${count} files`);
  }

  if (results.errors.length > 0) {
    console.log('\n--- ERRORS ---');
    for (const e of results.errors) {
      console.log(`  ${e.file}: ${e.error}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY:');
  console.log(`  Files migrated: ${results.migrated.length}`);
  console.log(`  Total replacements: log=${totalReplaced.log}, error=${totalReplaced.error}, warn=${totalReplaced.warn}`);
  console.log(`  Files skipped: ${results.skipped.length}`);
  console.log(`  Errors: ${results.errors.length}`);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. Run without --dry-run to apply changes.');
  }
}

main();
