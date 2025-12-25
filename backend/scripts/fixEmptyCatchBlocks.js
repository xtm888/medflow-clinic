#!/usr/bin/env node
/**
 * Fix Empty Catch Blocks
 *
 * Finds and fixes empty catch blocks by adding error logging.
 *
 * Usage:
 *   node scripts/fixEmptyCatchBlocks.js [--dry-run] [--services-only]
 *
 * Options:
 *   --dry-run        Show changes without applying
 *   --services-only  Only fix services/ directory
 */

const fs = require('fs');
const path = require('path');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('fixEmptyCatchBlocks.js');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SERVICES_ONLY = args.includes('--services-only');

// Skip patterns
const SKIP_PATTERNS = [
  'node_modules',
  '.test.js',
  'tests/',
  'scripts/',
  'agents/'
];

// Get context name from file path
function getContextName(filePath) {
  const fileName = path.basename(filePath, '.js');
  let context = fileName
    .replace(/Controller$/, '')
    .replace(/Service$/, '')
    .replace(/Middleware$/, '');
  return context.charAt(0).toUpperCase() + context.slice(1);
}

// Check if file already has structuredLogger
function hasStructuredLogger(content) {
  return content.includes('structuredLogger') || content.includes('createContextLogger');
}

// Add import if needed
function ensureLoggerImport(content, context) {
  if (hasStructuredLogger(content)) {
    return content;
  }

  // Find where to insert import (after existing requires)
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

  const importLine = `const { createContextLogger } = require('../utils/structuredLogger');\nconst log = createContextLogger('${context}');`;
  lines.splice(insertIndex, 0, '', importLine);

  return lines.join('\n');
}

// Fix a single file
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Find empty catch blocks patterns:
  // 1. catch (e) {} or catch (err) {}
  // 2. catch (error) { }
  // 3. catch { } (no param)
  // 4. .catch(() => {}) or .catch(e => {})

  const context = getContextName(filePath);
  let fixCount = 0;

  // Pattern 1: catch (variable) { } - empty or whitespace only
  content = content.replace(
    /catch\s*\((\w+)\)\s*\{\s*\}/g,
    (match, errorVar) => {
      fixCount++;
      return `catch (${errorVar}) {\n      // Log silently - error expected in some scenarios\n      log.debug('Suppressed error', { error: ${errorVar}.message });\n    }`;
    }
  );

  // Pattern 2: catch (variable) { /* comment */ } - comment but no code
  content = content.replace(
    /catch\s*\((\w+)\)\s*\{\s*\/\/[^\n]*\s*\}/g,
    (match, errorVar) => {
      fixCount++;
      return `catch (${errorVar}) {\n      log.debug('Suppressed error', { error: ${errorVar}.message });\n    }`;
    }
  );

  // Pattern 3: .catch(() => {}) - promise catch with empty handler
  content = content.replace(
    /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
    () => {
      fixCount++;
      return `.catch(err => log.debug('Promise error suppressed', { error: err?.message }))`;
    }
  );

  // Pattern 4: .catch(err => {}) - promise catch with param but empty
  content = content.replace(
    /\.catch\s*\(\s*(\w+)\s*=>\s*\{\s*\}\s*\)/g,
    (match, errorVar) => {
      fixCount++;
      return `.catch(${errorVar} => log.debug('Promise error suppressed', { error: ${errorVar}?.message }))`;
    }
  );

  // Pattern 5: .catch(() => null) - common pattern to suppress errors
  // Leave as-is but count

  if (fixCount > 0) {
    // Ensure logger is imported
    content = ensureLoggerImport(content, context);

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content);
    }

    return { modified: true, fixCount, context };
  }

  return { modified: false };
}

// Main
function main() {
  const servicesPath = path.join(__dirname, '../services');
  const controllersPath = path.join(__dirname, '../controllers');
  const middlewarePath = path.join(__dirname, '../middleware');
  const modelsPath = path.join(__dirname, '../models');

  const targetDirs = SERVICES_ONLY
    ? [servicesPath]
    : [servicesPath, controllersPath, middlewarePath, modelsPath];

  console.log(`\n${'='.repeat(60)}`);
  console.log('Empty Catch Block Fixer');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const results = {
    fixed: [],
    unchanged: 0,
    errors: []
  };

  for (const dirPath of targetDirs) {
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath, { recursive: true });

    for (const file of files) {
      if (typeof file !== 'string' || !file.endsWith('.js')) continue;

      const fullPath = path.join(dirPath, file);
      const relativePath = path.relative(path.join(__dirname, '..'), fullPath);

      if (SKIP_PATTERNS.some(p => relativePath.includes(p))) continue;

      try {
        const result = fixFile(fullPath);

        if (result.modified) {
          results.fixed.push({ file: relativePath, ...result });
        } else {
          results.unchanged++;
        }
      } catch (error) {
        results.errors.push({ file: relativePath, error: error.message });
      }
    }
  }

  // Print results
  console.log('\n--- FIXED FILES ---');
  let totalFixes = 0;

  for (const r of results.fixed) {
    console.log(`${r.file}: ${r.fixCount} catch blocks fixed (context: ${r.context})`);
    totalFixes += r.fixCount;
  }

  if (results.errors.length > 0) {
    console.log('\n--- ERRORS ---');
    for (const e of results.errors) {
      console.log(`  ${e.file}: ${e.error}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY:');
  console.log(`  Files modified: ${results.fixed.length}`);
  console.log(`  Total catch blocks fixed: ${totalFixes}`);
  console.log(`  Files unchanged: ${results.unchanged}`);
  console.log(`  Errors: ${results.errors.length}`);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. Run without --dry-run to apply changes.');
  }
}

main();
