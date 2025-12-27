#!/usr/bin/env node
/**
 * Error Handling Audit Script
 * Analyzes backend code for error handling issues
 */

const fs = require('fs');
const path = require('path');

const issues = {
  asyncWithoutTryCatch: [],
  promiseWithoutCatch: [],
  eventEmitterWithoutError: [],
  dbWithoutErrorHandling: [],
  externalApiWithoutTimeout: [],
  fileOpsWithoutErrorHandling: [],
  jsonParseWithoutTryCatch: [],
  missingValidation: [],
  potentialRaceConditions: []
};

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative('/Users/xtm888/magloire/backend', filePath);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const location = `${relativePath}:${lineNum}`;

    // 1. Check for async functions without try-catch
    if (line.match(/async\s+(function|[\w]+\s*\()/)) {
      const nextLines = lines.slice(idx, Math.min(idx + 50, lines.length)).join('\n');
      if (!nextLines.includes('try {') && !nextLines.includes('try{')) {
        // Check if the entire function body is present
        const funcBody = extractFunctionBody(lines, idx);
        if (funcBody && !funcBody.includes('try') && funcBody.includes('await')) {
          issues.asyncWithoutTryCatch.push({
            location,
            line: line.trim(),
            severity: 'HIGH'
          });
        }
      }
    }

    // 2. Promise chains without .catch()
    if (line.includes('.then(') && !line.includes('.catch(')) {
      const nextLines = lines.slice(idx, Math.min(idx + 10, lines.length)).join('');
      if (!nextLines.includes('.catch(')) {
        issues.promiseWithoutCatch.push({
          location,
          line: line.trim(),
          severity: 'MEDIUM'
        });
      }
    }

    // 3. EventEmitter without error handler
    if (line.includes('new EventEmitter') || line.includes('extends EventEmitter')) {
      const nextLines = lines.slice(idx, Math.min(idx + 100, lines.length)).join('\n');
      if (!nextLines.includes("on('error'") && !nextLines.includes('on("error"')) {
        issues.eventEmitterWithoutError.push({
          location,
          line: line.trim(),
          severity: 'HIGH'
        });
      }
    }

    // 4. Database operations without error handling
    if (line.match(/\.(find|findOne|save|update|delete|create|insertMany|updateMany)\(/)) {
      if (!line.includes('await') && !line.includes('.catch(')) {
        issues.dbWithoutErrorHandling.push({
          location,
          line: line.trim(),
          severity: 'HIGH'
        });
      }
    }

    // 5. External API calls without timeout
    if (line.includes('axios.') || line.includes('fetch(')) {
      if (!line.includes('timeout') && !content.slice(0, content.indexOf(line)).includes('timeout:')) {
        const contextLines = lines.slice(Math.max(0, idx - 5), idx + 5).join('\n');
        if (!contextLines.includes('timeout')) {
          issues.externalApiWithoutTimeout.push({
            location,
            line: line.trim(),
            severity: 'MEDIUM'
          });
        }
      }
    }

    // 6. File operations without error handling
    if (line.match(/fs\.(readFile|writeFile|unlink|mkdir|stat|access|readdir)\(/)) {
      if (!line.includes('await') && !line.includes('.catch(') && !line.includes('try')) {
        const contextLines = lines.slice(Math.max(0, idx - 3), idx + 3).join('\n');
        if (!contextLines.includes('try') && !contextLines.includes('.catch(')) {
          issues.fileOpsWithoutErrorHandling.push({
            location,
            line: line.trim(),
            severity: 'HIGH'
          });
        }
      }
    }

    // 7. JSON.parse without try-catch
    if (line.includes('JSON.parse(')) {
      const contextLines = lines.slice(Math.max(0, idx - 5), idx + 5).join('\n');
      if (!contextLines.includes('try') && !contextLines.includes('.catch(')) {
        issues.jsonParseWithoutTryCatch.push({
          location,
          line: line.trim(),
          severity: 'HIGH'
        });
      }
    }

    // 8. Missing validation before database operations
    if (line.match(/new\s+\w+\(/) && line.match(/new\s+(Patient|Invoice|Appointment|User|Device)/)) {
      const prevLines = lines.slice(Math.max(0, idx - 10), idx).join('\n');
      if (!prevLines.includes('validate') && !prevLines.includes('check(') && !prevLines.includes('body(')) {
        issues.missingValidation.push({
          location,
          line: line.trim(),
          severity: 'MEDIUM'
        });
      }
    }

    // 9. Potential race conditions
    if (line.includes('Promise.all([') || line.includes('Promise.race([')) {
      const nextLines = lines.slice(idx, Math.min(idx + 20, lines.length)).join('\n');
      if (!nextLines.includes('catch')) {
        issues.potentialRaceConditions.push({
          location,
          line: line.trim(),
          severity: 'MEDIUM'
        });
      }
    }
  });
}

function extractFunctionBody(lines, startIdx) {
  let braceCount = 0;
  let body = '';
  let started = false;

  for (let i = startIdx; i < Math.min(startIdx + 100, lines.length); i++) {
    const line = lines[i];
    body += line + '\n';

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return body;
        }
      }
    }
  }
  return body;
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        analyzeFile(fullPath);
      } catch (error) {
        console.error(`Error analyzing ${fullPath}: ${error.message}`);
      }
    }
  }
}

// Main execution
const backendDir = '/Users/xtm888/magloire/backend';
const dirsToScan = ['services', 'controllers', 'middleware'];

console.log('Starting error handling audit...\n');

for (const dir of dirsToScan) {
  const fullPath = path.join(backendDir, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`Scanning ${dir}/...`);
    scanDirectory(fullPath);
  }
}

// Generate report
console.log('\n=== ERROR HANDLING AUDIT REPORT ===\n');

let totalIssues = 0;
for (const [category, items] of Object.entries(issues)) {
  if (items.length > 0) {
    totalIssues += items.length;
    console.log(`\n## ${category.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${items.length} issues`);

    // Show top 10 per category
    items.slice(0, 10).forEach((issue, idx) => {
      console.log(`  ${idx + 1}. [${issue.severity}] ${issue.location}`);
      console.log(`     ${issue.line.substring(0, 100)}`);
    });

    if (items.length > 10) {
      console.log(`     ... and ${items.length - 10} more`);
    }
  }
}

console.log(`\n\nTOTAL ISSUES FOUND: ${totalIssues}\n`);

// Write detailed report to file
const reportPath = path.join(backendDir, 'error_handling_audit_report.json');
fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
console.log(`Detailed report saved to: ${reportPath}`);
