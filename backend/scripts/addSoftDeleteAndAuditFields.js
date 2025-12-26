#!/usr/bin/env node
/**
 * Add soft delete and audit fields to Mongoose models
 * V3 - Properly handles comma before new fields
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const modelsDir = path.join(__dirname, '..', 'models');

const SKIP_SOFT_DELETE = ['Patient.js', 'OphthalmologyExam.js', 'LabResult.js', 'Visit.js', 'Prescription.js', 'AuditLog.js', 'Counter.js'];
const SKIP_AUDIT = ['AuditLog.js', 'Counter.js'];

function processFile(filePath, fileName) {
  let content = fs.readFileSync(filePath, 'utf8');
  const changes = [];

  const needsSoft = !SKIP_SOFT_DELETE.includes(fileName) && !content.includes('isDeleted:');
  const needsAudit = !SKIP_AUDIT.includes(fileName) && !content.includes('createdBy:');

  if (!needsSoft && !needsAudit) return { modified: false };

  // Determine ObjectId type used
  const usesShort = content.includes('Schema.Types.ObjectId') && !content.includes('mongoose.Schema.Types.ObjectId');
  const objIdType = usesShort ? 'Schema.Types.ObjectId' : 'mongoose.Schema.Types.ObjectId';

  // Build the fields block (with leading comma to ensure proper syntax)
  let fields = '';
  if (needsSoft) {
    fields += `,

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date`;
    changes.push('soft delete');
  }
  if (needsAudit) {
    fields += `,

  // Audit fields
  createdBy: {
    type: ${objIdType},
    ref: 'User'
  },
  updatedBy: {
    type: ${objIdType},
    ref: 'User'
  }`;
    changes.push('audit');
  }

  // Find the }, { separator (schema end, options start)
  // Match pattern: "}\n}, {" or "}\n},\n{" - the last field closing brace before schema options

  // Strategy: Find "}, {" and insert before it, ensuring the previous line ends properly
  const schemaOptionsRegex = /(\n)(}, \{)/;
  const schemaOptionsRegex2 = /(\n)(},\s*\{)/;

  let match = content.match(schemaOptionsRegex) || content.match(schemaOptionsRegex2);

  if (match) {
    const insertPos = content.indexOf(match[0]);
    const before = content.substring(0, insertPos);
    const after = content.substring(insertPos);

    // Check if the last non-whitespace character before the newline is a comma
    // If so, don't add another comma
    const trimmedBefore = before.trimEnd();
    if (trimmedBefore.endsWith(',')) {
      // Already has comma, adjust fields to not start with comma
      fields = fields.substring(1); // Remove leading comma
    }

    content = before + fields + after;

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    return { modified: true, changes };
  }

  // Fallback: try to find }); at the end (simple schema without options)
  const simpleEndRegex = /(\n)(}\);[\s]*$)/;
  match = content.match(simpleEndRegex);

  if (match) {
    const insertPos = content.indexOf(match[0]);
    const before = content.substring(0, insertPos);
    const after = content.substring(insertPos);

    const trimmedBefore = before.trimEnd();
    if (trimmedBefore.endsWith(',')) {
      fields = fields.substring(1);
    }

    content = before + fields + after;

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    return { modified: true, changes };
  }

  return { modified: false, warning: 'No insertion point found' };
}

// Main
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
let modCount = 0, skipCount = 0;
const warnings = [];

for (const f of files) {
  const result = processFile(path.join(modelsDir, f), f);
  if (result.modified) {
    console.log(`✅ ${f}: ${result.changes.join(', ')}`);
    modCount++;
  } else if (result.warning) {
    console.log(`⚠️  ${f}: ${result.warning}`);
    warnings.push(f);
  } else {
    skipCount++;
  }
}

console.log(`\nDone: ${modCount} modified, ${skipCount} skipped, ${warnings.length} warnings`);
if (warnings.length > 0) {
  console.log('Manual attention needed:', warnings.join(', '));
}
