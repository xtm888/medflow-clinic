/**
 * Find Unprotected Async Functions
 * Scans controllers and services for async functions without error handling
 */

const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match async function declarations
    if (line.match(/async\s+(function|\w+\s*=\s*async|\(.*\)\s*=>)/)) {
      // Check if wrapped in asyncHandler (same line or function wrapper)
      if (line.includes('asyncHandler')) {
        continue; // Protected by wrapper
      }

      // Check previous lines for asyncHandler wrapper
      const prevLines = lines.slice(Math.max(0, i - 2), i).join(' ');
      if (prevLines.includes('asyncHandler')) {
        continue; // Protected by wrapper
      }

      // Look ahead for try-catch within next 20 lines
      let hasTry = false;
      for (let j = i; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j].includes('try {') || lines[j].includes('try{')) {
          hasTry = true;
          break;
        }
      }

      if (!hasTry) {
        issues.push({
          file: filePath.replace(process.cwd(), ''),
          line: i + 1,
          code: line.trim().substring(0, 80)
        });
      }
    }
  }

  return issues;
}

function scanDirectory(dir, filePattern = '**/*.js') {
  const files = fs.readdirSync(dir);
  let allIssues = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('test')) {
      allIssues = allIssues.concat(scanDirectory(filePath, filePattern));
    } else if (file.endsWith('.js') && !file.includes('.test.')) {
      const issues = scanFile(filePath);
      if (issues.length > 0) {
        allIssues = allIssues.concat(issues);
      }
    }
  }

  return allIssues;
}

function groupByFile(issues) {
  const grouped = {};
  issues.forEach(issue => {
    if (!grouped[issue.file]) {
      grouped[issue.file] = [];
    }
    grouped[issue.file].push(issue);
  });
  return grouped;
}

// Main execution
console.log('🔍 Scanning for unprotected async functions...\n');

const controllersDir = path.join(__dirname, '../controllers');
const servicesDir = path.join(__dirname, '../services');

const controllerIssues = scanDirectory(controllersDir);
const serviceIssues = scanDirectory(servicesDir);

const allIssues = [...controllerIssues, ...serviceIssues];

if (allIssues.length === 0) {
  console.log('✅ All async functions are protected!');
  process.exit(0);
}

console.log(`⚠️  Found ${allIssues.length} unprotected async functions\n`);

console.log('📁 CONTROLLERS:');
const groupedControllers = groupByFile(controllerIssues);
Object.entries(groupedControllers)
  .sort(([, a], [, b]) => b.length - a.length)
  .forEach(([file, issues]) => {
    console.log(`\n  ${file} (${issues.length} issues):`);
    issues.slice(0, 3).forEach(issue => {
      console.log(`    Line ${issue.line}: ${issue.code}`);
    });
    if (issues.length > 3) {
      console.log(`    ... and ${issues.length - 3} more`);
    }
  });

console.log('\n\n📁 SERVICES:');
const groupedServices = groupByFile(serviceIssues);
Object.entries(groupedServices)
  .sort(([, a], [, b]) => b.length - a.length)
  .forEach(([file, issues]) => {
    console.log(`\n  ${file} (${issues.length} issues):`);
    issues.slice(0, 3).forEach(issue => {
      console.log(`    Line ${issue.line}: ${issue.code}`);
    });
    if (issues.length > 3) {
      console.log(`    ... and ${issues.length - 3} more`);
    }
  });

console.log('\n\n📊 SUMMARY:');
console.log(`  Controllers: ${controllerIssues.length} issues`);
console.log(`  Services: ${serviceIssues.length} issues`);
console.log(`  Total: ${allIssues.length} issues`);

console.log('\n💡 RECOMMENDED FIXES:');
console.log('  1. Controllers: Wrap exports in asyncHandler()');
console.log('  2. Services: Add try-catch blocks internally');
console.log('  3. See CRASH_PREVENTION_FIXES.md for examples\n');

process.exit(1);
