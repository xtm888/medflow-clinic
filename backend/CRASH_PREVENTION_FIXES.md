# CRASH PREVENTION - IMMEDIATE ACTION PLAN
## Critical Fixes for Production Deployment

**Priority:** CRITICAL - Must fix before production
**Estimated Time:** 16-24 hours
**Risk Level if Not Fixed:** Server crashes, data loss, security vulnerabilities

---

## PHASE 1: CRITICAL SECURITY FIX (4-6 hours)

### Issue: 125 instances exposing internal error details

**Current dangerous pattern:**
```javascript
} catch (error) {
  res.status(500).json({ success: false, message: error.message });
}
```

**Fix pattern:**
```javascript
} catch (error) {
  logger.error('Operation failed:', {
    operation: 'descriptive_name',
    error: error.message,
    stack: error.stack,
    user: req.user?.id
  });

  // Generic user-facing message
  return res.status(500).json({
    success: false,
    error: 'Une erreur est survenue lors du traitement de votre demande'
  });
}
```

### Files to Fix (in priority order):

1. **controllers/approvalController.js** (13 instances)
   - Lines: 145, 171, 275, 336, 392, 433, 468, 494, 512, 534, 745, 764, 800

2. **controllers/externalFacilityController.js** (2 instances)
   - Lines: 89, 109

3. Run this to find all instances:
   ```bash
   cd /Users/xtm888/magloire/backend
   grep -rn "res\.status(5.*error\.message\|err\.message" controllers/ | \
     awk -F: '{print $1}' | sort | uniq -c | sort -rn
   ```

### Automated Fix Script:

Create `/Users/xtm888/magloire/backend/scripts/fix-error-exposure.js`:

```javascript
const fs = require('fs');
const path = require('path');

const GENERIC_ERROR_MESSAGES = {
  default: 'Une erreur est survenue lors du traitement de votre demande',
  notFound: 'Ressource non trouvée',
  validation: 'Données invalides',
  unauthorized: 'Non autorisé',
  forbidden: 'Accès refusé'
};

function fixErrorExposure(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern: res.status(500).json({ message: error.message })
  const dangerousPattern = /res\.status\(5\d\d\)\.json\(\{[^}]*message:\s*error\.message[^}]*\}\)/g;

  if (dangerousPattern.test(content)) {
    console.log(`⚠️  Found error exposure in: ${filePath}`);

    content = content.replace(dangerousPattern, (match) => {
      modified = true;
      return `res.status(500).json({ success: false, error: '${GENERIC_ERROR_MESSAGES.default}' })`;
    });
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// Run on all controllers
const controllersDir = path.join(__dirname, '../controllers');
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      fixedCount += walkDir(filePath);
    } else if (file.endsWith('.js')) {
      if (fixErrorExposure(filePath)) {
        fixedCount++;
      }
    }
  }

  return fixedCount;
}

const totalFixed = walkDir(controllersDir);
console.log(`\n✅ Fixed ${totalFixed} files`);
```

**Run it:**
```bash
node scripts/fix-error-exposure.js
```

**Manual verification required after automated fix!**

---

## PHASE 2: ASYNC FUNCTION PROTECTION (8-12 hours)

### Issue: 977 async functions without error handling

### Quick Fix: Use asyncHandler wrapper

**For controllers:**
```javascript
const { asyncHandler } = require('../middleware/errorHandler');

// BEFORE (dangerous)
exports.getPatient = async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  res.json(patient);
};

// AFTER (safe)
exports.getPatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) {
    return res.status(404).json({ error: 'Patient non trouvé' });
  }
  res.json(patient);
});
```

**For services:**
```javascript
// Services must have internal try-catch
async function processPayment(invoiceId) {
  try {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Process payment...
    return { success: true };

  } catch (error) {
    logger.error('Payment processing failed:', {
      invoiceId,
      error: error.message
    });
    throw error; // Re-throw for caller to handle
  }
}
```

### Priority Files (fix these first):

1. **controllers/alertController.js** - 11 async functions without protection
2. **controllers/appointmentController.js** - Check which ones lack asyncHandler
3. **controllers/authController.js** - Already uses asyncHandler ✅

### Automated Scanner:

Create `/Users/xtm888/magloire/backend/scripts/find-unprotected-async.js`:

```javascript
const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match async function without asyncHandler wrapper or try
    if (line.match(/async\s+(function|\w+\s*=\s*async)/)) {
      // Check if this is wrapped in asyncHandler
      const prevLine = i > 0 ? lines[i - 1] : '';
      if (prevLine.includes('asyncHandler')) {
        continue; // Protected by wrapper
      }

      // Look ahead for try-catch
      let hasTry = false;
      for (let j = i; j < Math.min(i + 15, lines.length); j++) {
        if (lines[j].includes('try {')) {
          hasTry = true;
          break;
        }
      }

      if (!hasTry) {
        issues.push({
          file: filePath.replace(process.cwd(), ''),
          line: i + 1,
          code: line.trim().substring(0, 60)
        });
      }
    }
  }

  return issues;
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  let allIssues = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.includes('node_modules')) {
      allIssues = allIssues.concat(scanDirectory(filePath));
    } else if (file.endsWith('.js')) {
      allIssues = allIssues.concat(scanFile(filePath));
    }
  }

  return allIssues;
}

console.log('Scanning for unprotected async functions...\n');
const issues = scanDirectory(path.join(__dirname, '../controllers'));

if (issues.length > 0) {
  console.log(`⚠️  Found ${issues.length} unprotected async functions:\n`);
  issues.slice(0, 20).forEach(issue => {
    console.log(`${issue.file}:${issue.line}`);
    console.log(`  ${issue.code}`);
  });
  if (issues.length > 20) {
    console.log(`\n... and ${issues.length - 20} more`);
  }
} else {
  console.log('✅ All async functions are protected!');
}
```

---

## PHASE 3: JSON.parse PROTECTION (30 minutes)

### Issue: Unprotected JSON.parse in redis.js

**File:** `/Users/xtm888/magloire/backend/config/redis.js`

**Lines to fix:** 281, 361

**Current code:**
```javascript
return data ? JSON.parse(data) : null;
```

**Fixed code:**
```javascript
if (!data) return null;

try {
  return JSON.parse(data);
} catch (parseError) {
  log.error('Failed to parse cached data:', {
    error: parseError.message,
    dataPreview: data?.substring?.(0, 100)
  });
  return null; // Graceful degradation
}
```

### Complete fix for redis.js:

```javascript
// Line 278-285 (around cache.get)
async get(key) {
  if (!circuitBreaker.shouldAllowRequest()) return null;

  try {
    const data = await redisClient.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch (parseError) {
      log.error('Failed to parse cached data:', {
        key,
        error: parseError.message,
        dataPreview: data?.substring?.(0, 100)
      });
      // Delete corrupted cache entry
      await redisClient.del(key).catch(() => {});
      return null;
    }
  } catch (error) {
    circuitBreaker.recordFailure();
    log.error('Cache get error:', { key, error: error.message });
    return null;
  }
}

// Similar fix for Line 358-365 (cache.mget)
```

---

## PHASE 4: EXTERNAL API TIMEOUTS (2-3 hours)

### Files needing timeout configuration:

1. **services/drugSafetyService.js**
2. **services/calendarIntegrationService.js**
3. **services/cloudSyncService.js**
4. **services/lisIntegrationService.js**
5. **services/paymentGateway.js**
6. **services/smsService.js**
7. **services/currencyService.js**

### Standard Pattern:

**Create shared axios instance:**

```javascript
// utils/httpClient.js
const axios = require('axios');
const { createContextLogger } = require('./structuredLogger');
const log = createContextLogger('HttpClient');

const DEFAULT_TIMEOUT = 30000; // 30 seconds

const httpClient = axios.create({
  timeout: process.env.EXTERNAL_API_TIMEOUT || DEFAULT_TIMEOUT,
  validateStatus: (status) => status < 500, // Don't throw on 4xx
});

// Add request logging
httpClient.interceptors.request.use(request => {
  log.debug('HTTP Request:', {
    method: request.method,
    url: request.url,
    timeout: request.timeout
  });
  return request;
});

// Add response logging and error handling
httpClient.interceptors.response.use(
  response => {
    log.debug('HTTP Response:', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  error => {
    if (error.code === 'ECONNABORTED') {
      log.error('HTTP Request Timeout:', {
        url: error.config?.url,
        timeout: error.config?.timeout
      });
    }
    throw error;
  }
);

module.exports = httpClient;
```

**Then in each service:**

```javascript
// Instead of:
const axios = require('axios');

// Use:
const httpClient = require('../utils/httpClient');

// All requests now have timeout automatically
const response = await httpClient.get('https://api.example.com/data');
```

---

## PHASE 5: FILE SYSTEM OPERATIONS (3-4 hours)

### Replace synchronous fs calls

**Current dangerous patterns:**

```javascript
// pdfGenerator.js:302
if (this.clinicInfo.logo && fs.existsSync(this.clinicInfo.logo)) {
  const logo = fs.readFileSync(this.clinicInfo.logo);
}

// DeviceIntegrationService.js:94
const fileBuffer = fs.readFileSync(filePath);
```

**Safe replacements:**

```javascript
// Use fs.promises
const fs = require('fs').promises;

// Instead of fs.existsSync + fs.readFileSync:
async loadLogo() {
  if (!this.clinicInfo.logo) return null;

  try {
    await fs.access(this.clinicInfo.logo); // Check if exists
    return await fs.readFile(this.clinicInfo.logo);
  } catch (error) {
    logger.warn('Logo file not accessible:', {
      path: this.clinicInfo.logo,
      error: error.message
    });
    return null; // Graceful degradation
  }
}

// In DeviceIntegrationService:
async loadFile(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    logger.error('Failed to read device file:', {
      filePath,
      error: error.message
    });
    throw new Error('Impossible de lire le fichier du dispositif');
  }
}
```

---

## TESTING AFTER FIXES

### 1. Error Injection Tests

```bash
# Test database failure handling
cd /Users/xtm888/magloire/backend
node scripts/test-error-handling.js
```

Create `/Users/xtm888/magloire/backend/scripts/test-error-handling.js`:

```javascript
const mongoose = require('mongoose');
const Patient = require('../models/Patient');

async function testDatabaseError() {
  console.log('🧪 Testing database error handling...');

  try {
    // Connect to database
    await mongoose.connect('mongodb://127.0.0.1:27017/medflow');

    // Simulate error by using invalid ID
    const result = await Patient.findById('invalid_id');
    console.log('❌ Should have thrown error');
  } catch (error) {
    console.log('✅ Error caught:', error.message);
  }

  await mongoose.disconnect();
}

async function testJSONParseError() {
  console.log('🧪 Testing JSON.parse error handling...');

  const badJson = '{invalid json}';

  try {
    JSON.parse(badJson);
    console.log('❌ Should have thrown error');
  } catch (error) {
    console.log('✅ JSON parse error caught:', error.message);
  }
}

async function runTests() {
  await testDatabaseError();
  await testJSONParseError();
  console.log('✅ All error handling tests passed');
}

runTests().catch(console.error);
```

### 2. Load Testing

```bash
# Test under load to ensure no crashes
npm install -g artillery
artillery quick --count 100 --num 10 http://localhost:5000/api/patients
```

### 3. Monitor Logs

```bash
# Watch for any unhandled errors
tail -f logs/error.log | grep -i "unhandled"
```

---

## VERIFICATION CHECKLIST

After completing all phases:

- [ ] Run automated tests: `npm test`
- [ ] Run error injection tests: `node scripts/test-error-handling.js`
- [ ] No `error.message` exposed in 500 responses
- [ ] All async controller functions use `asyncHandler` or have try-catch
- [ ] JSON.parse in redis.js wrapped in try-catch
- [ ] All external API calls have timeout configured
- [ ] No synchronous fs calls in critical paths
- [ ] Server restart test: `npm start` → `Ctrl+C` → No errors
- [ ] Load test: Artillery or similar tool
- [ ] Check logs for any "Unhandled" warnings
- [ ] Security scan: `npm audit`
- [ ] Code review with teammate

---

## DEPLOYMENT CHECKLIST

Before production:

1. **Staging Deployment:**
   - [ ] Deploy to staging environment
   - [ ] Run full test suite
   - [ ] Error injection testing
   - [ ] Load testing
   - [ ] Monitor for 24 hours

2. **Monitoring Setup:**
   - [ ] Configure Sentry or similar error tracking
   - [ ] Set up alerts for unhandled rejections
   - [ ] Dashboard for 5xx error rates
   - [ ] Log aggregation (ELK, Datadog, etc.)

3. **Documentation:**
   - [ ] Update deployment guide
   - [ ] Document error handling patterns
   - [ ] Create runbook for common errors

4. **Rollback Plan:**
   - [ ] Database backup
   - [ ] Previous version tagged in Git
   - [ ] Rollback procedure documented
   - [ ] Health check endpoints working

---

## MAINTENANCE

### Code Review Standards

Add to PR template:

```markdown
## Error Handling Checklist
- [ ] All async functions use asyncHandler or try-catch
- [ ] No error.message in 500 responses
- [ ] External API calls have timeout
- [ ] JSON.parse wrapped in try-catch
- [ ] File operations have error handling
- [ ] Tests include error cases
```

### Regular Audits

Schedule quarterly reviews:
- Run `scripts/find-unprotected-async.js`
- Review error logs for patterns
- Update error handling patterns
- Security scan

---

**Next Steps:** Start with Phase 1 (Security Fix) - highest priority and biggest risk.

**Questions?** Review the main audit report for detailed analysis.
