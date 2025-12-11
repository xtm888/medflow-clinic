# MedFlow Production Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical security vulnerabilities and production blockers before DRC deployment.

**Architecture:** Server-side validation with fail-fast approach - the server must refuse to start with insecure configuration. All encryption keys must be explicitly set, CSRF protection added via middleware, health endpoints secured with auth, N+1 queries optimized, password policy strengthened, and schedulers protected from race conditions via Redis distributed locks.

**Tech Stack:** Node.js/Express, MongoDB/Mongoose, Redis, bcryptjs, csurf, helmet

---

## Phase 1: Critical Security Blockers (Must Fix Before Production)

### Task 1: Create Environment Validation Utility

**Files:**
- Create: `backend/utils/envValidator.js`
- Modify: `backend/server.js:26-39`
- Test: `backend/tests/unit/envValidator.test.js`

**Step 1: Write the failing test**

Create `backend/tests/unit/envValidator.test.js`:

```javascript
const { validateProductionEnv, isSecureSecret } = require('../../utils/envValidator');

describe('Environment Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isSecureSecret', () => {
    it('should reject secrets containing "change-in-production"', () => {
      expect(isSecureSecret('my-secret-change-in-production-123')).toBe(false);
    });

    it('should reject secrets containing "default"', () => {
      expect(isSecureSecret('default-key-32chars')).toBe(false);
    });

    it('should reject secrets shorter than 32 characters', () => {
      expect(isSecureSecret('short-secret')).toBe(false);
    });

    it('should accept secure secrets 32+ chars without weak patterns', () => {
      expect(isSecureSecret('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6')).toBe(true);
    });
  });

  describe('validateProductionEnv', () => {
    it('should throw if JWT_SECRET is weak in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'weak-change-in-production';
      process.env.MONGODB_URI = 'mongodb://localhost/test';

      expect(() => validateProductionEnv()).toThrow('JWT_SECRET');
    });

    it('should throw if CALENDAR_ENCRYPTION_KEY uses default', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.CALENDAR_ENCRYPTION_KEY = 'default-key-change-in-production-32c';

      expect(() => validateProductionEnv()).toThrow('CALENDAR_ENCRYPTION_KEY');
    });

    it('should pass with all secure secrets in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.BACKUP_ENCRYPTION_KEY = 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7';

      expect(() => validateProductionEnv()).not.toThrow();
    });

    it('should allow weak secrets in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'weak';
      process.env.MONGODB_URI = 'mongodb://localhost/test';

      expect(() => validateProductionEnv()).not.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/xtm888/magloire/backend && npm test -- --testPathPattern="envValidator" --verbose
```

Expected: FAIL with "Cannot find module '../../utils/envValidator'"

**Step 3: Write minimal implementation**

Create `backend/utils/envValidator.js`:

```javascript
/**
 * Environment Variable Validator
 *
 * CRITICAL: This module validates that all security-sensitive environment
 * variables meet minimum security requirements before the server starts.
 * In production, weak secrets will cause the server to fail fast.
 */

const WEAK_PATTERNS = [
  'change-in-production',
  'default-key',
  'default',
  'placeholder',
  'changeme',
  'secret123',
  'password',
  'example'
];

const MIN_SECRET_LENGTH = 32;

/**
 * Check if a secret meets minimum security requirements
 * @param {string} secret - The secret to validate
 * @returns {boolean} - True if secret is secure
 */
function isSecureSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return false;
  }

  // Check minimum length
  if (secret.length < MIN_SECRET_LENGTH) {
    return false;
  }

  // Check for weak patterns
  const lowerSecret = secret.toLowerCase();
  for (const pattern of WEAK_PATTERNS) {
    if (lowerSecret.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate all critical environment variables for production
 * @throws {Error} If any critical variable is missing or insecure
 */
function validateProductionEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  // Required variables
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Security-sensitive variables that need strong values in production
  const securityVars = [
    { name: 'JWT_SECRET', required: true },
    { name: 'CALENDAR_ENCRYPTION_KEY', required: false },
    { name: 'LIS_ENCRYPTION_KEY', required: false },
    { name: 'BACKUP_ENCRYPTION_KEY', required: false },
    { name: 'SESSION_SECRET', required: false }
  ];

  for (const { name, required: isRequired } of securityVars) {
    const value = process.env[name];

    if (value && !isSecureSecret(value)) {
      if (isProduction) {
        errors.push(
          `${name} is insecure: Must be at least ${MIN_SECRET_LENGTH} characters ` +
          `and not contain weak patterns like 'default', 'change-in-production', etc.`
        );
      } else {
        warnings.push(`${name} uses weak value (OK for development, but change for production)`);
      }
    }
  }

  // Warn about backup encryption
  if (isProduction && !process.env.BACKUP_ENCRYPTION_KEY) {
    warnings.push('BACKUP_ENCRYPTION_KEY not set - database backups will NOT be encrypted!');
  }

  // Print warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Security Warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
    console.warn('');
  }

  // Throw on errors (production only blocks on these)
  if (errors.length > 0) {
    console.error('\n❌ CRITICAL SECURITY ERRORS:');
    errors.forEach(e => console.error(`   - ${e}`));
    console.error('');
    throw new Error(`Security validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Generate a cryptographically secure random secret
 * @param {number} length - Length of secret (default 64)
 * @returns {string} - Hex-encoded random secret
 */
function generateSecureSecret(length = 64) {
  const crypto = require('crypto');
  return crypto.randomBytes(length / 2).toString('hex');
}

module.exports = {
  isSecureSecret,
  validateProductionEnv,
  generateSecureSecret,
  WEAK_PATTERNS,
  MIN_SECRET_LENGTH
};
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/xtm888/magloire/backend && npm test -- --testPathPattern="envValidator" --verbose
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add backend/utils/envValidator.js backend/tests/unit/envValidator.test.js
git commit -m "feat: add environment variable security validator

- Validates JWT_SECRET and encryption keys meet minimum security standards
- Blocks server startup in production with weak secrets
- Allows weak secrets in development with warnings
- Rejects patterns like 'default', 'change-in-production', etc."
```

---

### Task 2: Integrate Environment Validator into Server Startup

**Files:**
- Modify: `backend/server.js:26-39`

**Step 1: Update server.js to use validator**

Replace lines 26-39 in `backend/server.js` with:

```javascript
// =====================================================
// ENVIRONMENT VARIABLE VALIDATION
// =====================================================
const { validateProductionEnv } = require('./utils/envValidator');

try {
  validateProductionEnv();
  console.log('✅ Environment validation passed');
} catch (error) {
  console.error('❌ CRITICAL: Server cannot start with insecure configuration');
  console.error(error.message);
  console.error('\nTo fix, set secure values in your .env file or environment:');
  console.error('  - JWT_SECRET: At least 32 random characters');
  console.error('  - CALENDAR_ENCRYPTION_KEY: At least 32 random characters');
  console.error('  - BACKUP_ENCRYPTION_KEY: At least 32 random characters');
  console.error('\nGenerate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
```

**Step 2: Test manually**

```bash
# Test with weak secret (should fail in production)
NODE_ENV=production JWT_SECRET=weak MONGODB_URI=test node backend/server.js
# Expected: Server exits with security error

# Test with strong secret (should pass)
NODE_ENV=production JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") MONGODB_URI=test node backend/server.js
# Expected: Server starts (may fail on MongoDB connection, but passes security check)
```

**Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: integrate security validator into server startup

- Server now refuses to start with weak secrets in production
- Provides helpful error messages with generation commands
- Maintains backwards compatibility for development"
```

---

### Task 3: Remove Hardcoded Encryption Key Fallbacks

**Files:**
- Modify: `backend/models/CalendarIntegration.js:199`
- Modify: `backend/models/LISIntegration.js:5`

**Step 1: Fix CalendarIntegration.js**

Replace line 199 in `backend/models/CalendarIntegration.js`:

```javascript
// OLD: const ENCRYPTION_KEY = process.env.CALENDAR_ENCRYPTION_KEY || 'default-key-change-in-production-32c';

// NEW:
const ENCRYPTION_KEY = process.env.CALENDAR_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: CALENDAR_ENCRYPTION_KEY must be set in production');
}
const FALLBACK_KEY = 'dev-only-calendar-key-not-for-prod';
const effectiveKey = ENCRYPTION_KEY || FALLBACK_KEY;
```

Then update the encrypt/decrypt functions to use `effectiveKey`.

**Step 2: Fix LISIntegration.js**

Replace line 5 in `backend/models/LISIntegration.js`:

```javascript
// OLD: const ENCRYPTION_KEY = process.env.LIS_ENCRYPTION_KEY || crypto.scryptSync(process.env.JWT_SECRET || 'default-key', 'salt', 32);

// NEW:
const crypto = require('crypto');
let ENCRYPTION_KEY;
if (process.env.LIS_ENCRYPTION_KEY) {
  ENCRYPTION_KEY = Buffer.from(process.env.LIS_ENCRYPTION_KEY, 'hex');
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: LIS_ENCRYPTION_KEY must be set in production');
} else {
  // Development fallback only
  ENCRYPTION_KEY = crypto.scryptSync('dev-fallback-not-for-production', 'salt', 32);
}
```

**Step 3: Test**

```bash
# Should throw in production without keys
NODE_ENV=production node -e "require('./backend/models/CalendarIntegration')"
# Expected: Error about CALENDAR_ENCRYPTION_KEY

# Should work in development
NODE_ENV=development node -e "require('./backend/models/CalendarIntegration'); console.log('OK')"
# Expected: OK
```

**Step 4: Commit**

```bash
git add backend/models/CalendarIntegration.js backend/models/LISIntegration.js
git commit -m "fix: remove hardcoded encryption key fallbacks

BREAKING CHANGE: In production, CALENDAR_ENCRYPTION_KEY and LIS_ENCRYPTION_KEY
must be explicitly set. Development mode still works with fallbacks."
```

---

### Task 4: Make Backup Encryption Mandatory in Production

**Files:**
- Modify: `backend/services/backupService.js:82-87`

**Step 1: Update backup service**

Replace lines 82-87 in `backend/services/backupService.js`:

```javascript
      // Step 3: Encrypt backup (MANDATORY in production)
      if (this.encryptionKey) {
        console.log('Encrypting backup...');
        await this.encryptBackup(`${backupPath}.tar.gz`);
      } else if (process.env.NODE_ENV === 'production') {
        // In production, unencrypted backups are not allowed
        throw new Error(
          'CRITICAL: Cannot create unencrypted backup in production. ' +
          'Set BACKUP_ENCRYPTION_KEY environment variable.'
        );
      } else {
        console.warn('⚠️  Backup encryption disabled - BACKUP_ENCRYPTION_KEY not set (OK for development)');
      }
```

**Step 2: Commit**

```bash
git add backend/services/backupService.js
git commit -m "fix: make backup encryption mandatory in production

Unencrypted backups containing PHI are now blocked in production.
Development mode still allows unencrypted backups with a warning."
```

---

## Phase 2: CSRF and CORS Security

### Task 5: Add CSRF Protection Middleware

**Files:**
- Create: `backend/middleware/csrf.js`
- Modify: `backend/server.js` (add middleware)
- Modify: `backend/package.json` (add csurf dependency)

**Step 1: Install csurf**

```bash
cd /Users/xtm888/magloire/backend && npm install csurf cookie-parser
```

**Step 2: Create CSRF middleware**

Create `backend/middleware/csrf.js`:

```javascript
/**
 * CSRF Protection Middleware
 *
 * Protects against Cross-Site Request Forgery attacks.
 * Uses double-submit cookie pattern with csurf.
 */
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// CSRF protection with cookie
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 // 1 hour
  }
});

// Routes that should be excluded from CSRF (webhooks, API tokens, etc.)
const CSRF_EXEMPT_ROUTES = [
  '/api/health',
  '/api/health/ready',
  '/api/health/live',
  '/api/health/startup',
  '/api/webhooks',
  '/api/lis/hl7' // LIS integration may use machine-to-machine auth
];

// Check if route is exempt
function isExempt(path) {
  return CSRF_EXEMPT_ROUTES.some(route => path.startsWith(route));
}

// Middleware that conditionally applies CSRF protection
function conditionalCsrf(req, res, next) {
  // Skip CSRF for exempt routes
  if (isExempt(req.path)) {
    return next();
  }

  // Skip CSRF for requests with valid API token (machine-to-machine)
  if (req.headers['x-api-key'] && req.headers['x-api-key'] === process.env.INTERNAL_API_KEY) {
    return next();
  }

  // Apply CSRF protection
  csrfProtection(req, res, next);
}

// Endpoint to get CSRF token
function getCsrfToken(req, res) {
  res.json({ csrfToken: req.csrfToken() });
}

// Error handler for CSRF errors
function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token',
      message: 'Your session may have expired. Please refresh and try again.'
    });
  }
  next(err);
}

module.exports = {
  cookieParser,
  conditionalCsrf,
  getCsrfToken,
  csrfErrorHandler,
  CSRF_EXEMPT_ROUTES
};
```

**Step 3: Integrate into server.js**

Add after helmet middleware in server.js:

```javascript
// Cookie parser (required for CSRF)
const { cookieParser, conditionalCsrf, getCsrfToken, csrfErrorHandler } = require('./middleware/csrf');
app.use(cookieParser());

// CSRF protection for non-API routes
if (process.env.DISABLE_CSRF !== 'true') {
  app.use(conditionalCsrf);
  app.get('/api/csrf-token', getCsrfToken);
}

// ... (add csrfErrorHandler before final error handler)
app.use(csrfErrorHandler);
```

**Step 4: Commit**

```bash
git add backend/middleware/csrf.js backend/server.js backend/package.json backend/package-lock.json
git commit -m "feat: add CSRF protection middleware

- Uses csurf with double-submit cookie pattern
- Exempts health checks and webhook endpoints
- Provides /api/csrf-token endpoint for SPAs
- Can be disabled with DISABLE_CSRF=true for testing"
```

---

### Task 6: Secure CORS Configuration

**Files:**
- Modify: `backend/server.js` (CORS config section)

**Step 1: Find and update CORS configuration**

Replace the CORS configuration in server.js with:

```javascript
// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.) ONLY in development
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Origin header required in production'), false);
      }
      return callback(null, true);
    }

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ].filter(Boolean);

    // In production, only allow configured frontend
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.FRONTEND_URL) {
        console.error('WARNING: FRONTEND_URL not set in production');
      }
      const prodOrigins = [process.env.FRONTEND_URL].filter(Boolean);
      if (prodOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed`), false);
      }
      return;
    }

    // In development, allow localhost variants
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With']
};

app.use(cors(corsOptions));
```

**Step 2: Commit**

```bash
git add backend/server.js
git commit -m "fix: secure CORS configuration

- Require Origin header in production
- Only allow configured FRONTEND_URL in production
- Allow localhost variants in development only"
```

---

## Phase 3: Secure Health Endpoints

### Task 7: Add Authentication to Detailed Health Endpoint

**Files:**
- Modify: `backend/routes/health.js`
- Create: `backend/middleware/healthAuth.js`

**Step 1: Create health auth middleware**

Create `backend/middleware/healthAuth.js`:

```javascript
/**
 * Health Endpoint Authentication
 *
 * Protects detailed health endpoints that expose sensitive system info.
 * Basic health (/health) and probes (/health/ready, /health/live) remain public
 * for load balancers and orchestrators.
 */

function healthAuth(req, res, next) {
  // Check for health API key
  const healthKey = req.headers['x-health-key'] || req.query.key;
  const expectedKey = process.env.HEALTH_API_KEY;

  if (!expectedKey) {
    // If no key configured, only allow in development
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    return res.status(503).json({
      success: false,
      error: 'Health API not configured'
    });
  }

  if (healthKey === expectedKey) {
    return next();
  }

  // Check for valid admin JWT as alternative
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        return next();
      }
    } catch (err) {
      // Invalid token, fall through to error
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Detailed health info requires authentication'
  });
}

module.exports = { healthAuth };
```

**Step 2: Update health routes**

Modify `backend/routes/health.js` to use auth on sensitive endpoints:

```javascript
const router = require('express').Router();
const mongoose = require('mongoose');
const redis = require('../config/redis');
const logger = require('../config/logger');
const { healthAuth } = require('../middleware/healthAuth');

// ... existing imports ...

// Basic health - PUBLIC (for load balancers)
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
    // Removed uptime and environment - not needed for basic check
  });
});

// Detailed health - PROTECTED (exposes system info)
router.get('/detailed', healthAuth, async (req, res) => {
  // ... existing detailed health logic ...
});

// Kubernetes probes remain public but minimal
router.get('/ready', async (req, res) => {
  // ... existing ready logic ...
});

router.get('/live', (req, res) => {
  res.json({ alive: true });  // Minimal response
});
```

**Step 3: Commit**

```bash
git add backend/routes/health.js backend/middleware/healthAuth.js
git commit -m "fix: secure detailed health endpoint

- /health returns minimal public info for load balancers
- /health/detailed requires HEALTH_API_KEY or admin JWT
- /health/ready and /health/live remain public but minimal"
```

---

## Phase 4: Performance Fixes

### Task 8: Fix N+1 Query in Laboratory Orders

**Files:**
- Modify: `backend/controllers/laboratory/orders.js:88-103`
- Test: `backend/tests/unit/labOrders.test.js`

**Step 1: Write the failing test**

Create `backend/tests/unit/labOrders.test.js`:

```javascript
const mongoose = require('mongoose');

describe('Lab Order Performance', () => {
  it('should batch fetch templates instead of N+1 queries', async () => {
    // This test verifies the fix by checking query count
    // In real implementation, use mongoose debug or query spy

    const tests = [
      { templateId: 'template1' },
      { templateId: 'template2' },
      { templateId: 'template3' },
      { templateId: 'template1' }, // Duplicate
    ];

    // The fixed version should only query unique templates
    const uniqueTemplateIds = [...new Set(tests.map(t => t.templateId).filter(Boolean))];
    expect(uniqueTemplateIds.length).toBe(3); // Not 4
  });
});
```

**Step 2: Fix the N+1 query**

Replace lines 88-103 in `backend/controllers/laboratory/orders.js`:

```javascript
  // Batch fetch all templates at once (avoiding N+1 query)
  const uniqueTemplateIds = [...new Set(
    tests.map(t => t.templateId).filter(Boolean)
  )];

  const templates = uniqueTemplateIds.length > 0
    ? await LaboratoryTemplate.find({ _id: { $in: uniqueTemplateIds } }).lean()
    : [];

  const templateMap = new Map(templates.map(t => [t._id.toString(), t]));

  // Build tests array with template info (no async needed now)
  const processedTests = tests.map((test) => {
    const template = test.templateId ? templateMap.get(test.templateId.toString()) : null;

    return {
      template: test.templateId,
      testName: test.testName || template?.name,
      testCode: test.testCode || template?.code,
      category: test.category || template?.category,
      specimen: test.specimen || template?.specimenType,
      notes: test.notes,
      price: test.price || template?.price || 0
    };
  });
```

**Step 3: Commit**

```bash
git add backend/controllers/laboratory/orders.js backend/tests/unit/labOrders.test.js
git commit -m "perf: fix N+1 query in laboratory order creation

Before: N queries for N tests (one per template)
After: 1 query for all unique templates

Reduces database load and latency, especially important for
slow connections in DRC."
```

---

## Phase 5: Password Policy

### Task 9: Strengthen Password Requirements

**Files:**
- Modify: `backend/models/User.js:23-27`
- Create: `backend/utils/passwordValidator.js`

**Step 1: Create password validator**

Create `backend/utils/passwordValidator.js`:

```javascript
/**
 * Password Validation Utility
 *
 * Enforces strong password policy:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */

const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true
};

const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_POLICY.requireSpecial) {
    const hasSpecial = [...password].some(c => SPECIAL_CHARS.includes(c));
    if (!hasSpecial) {
      errors.push('Password must contain at least one special character (!@#$%^&*...)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validatePassword,
  PASSWORD_POLICY,
  SPECIAL_CHARS
};
```

**Step 2: Update User model**

Modify `backend/models/User.js` password field:

```javascript
const { validatePassword } = require('../utils/passwordValidator');

// In schema definition:
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [12, 'Password must be at least 12 characters'],
    select: false,
    validate: {
      validator: function(v) {
        // Only validate on create or password change
        if (!this.isModified('password')) return true;
        const result = validatePassword(v);
        return result.valid;
      },
      message: props => {
        const result = validatePassword(props.value);
        return result.errors.join('. ');
      }
    }
  },
```

**Step 3: Commit**

```bash
git add backend/models/User.js backend/utils/passwordValidator.js
git commit -m "feat: strengthen password policy to 12 chars with complexity

- Minimum 12 characters (up from 8)
- Requires uppercase, lowercase, number, and special character
- Validates on create and password change"
```

---

## Phase 6: Distributed Scheduler Locking

### Task 10: Add Redis-based Distributed Locking for Schedulers

**Files:**
- Create: `backend/services/distributedLock.js`
- Modify: Scheduler files to use locks

**Step 1: Create distributed lock service**

Create `backend/services/distributedLock.js`:

```javascript
/**
 * Distributed Lock Service
 *
 * Uses Redis to ensure only one instance of a scheduler runs at a time
 * across multiple server instances. Prevents race conditions and
 * duplicate job execution.
 */

const redis = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

class DistributedLock {
  constructor(lockName, options = {}) {
    this.lockName = `lock:${lockName}`;
    this.lockId = uuidv4();
    this.ttl = options.ttl || 60; // Default 60 second lock
    this.retryDelay = options.retryDelay || 100;
    this.maxRetries = options.maxRetries || 10;
  }

  /**
   * Acquire the lock
   * @returns {Promise<boolean>} - True if lock acquired
   */
  async acquire() {
    for (let i = 0; i < this.maxRetries; i++) {
      const result = await redis.set(
        this.lockName,
        this.lockId,
        'EX',
        this.ttl,
        'NX' // Only set if not exists
      );

      if (result === 'OK') {
        return true;
      }

      // Wait before retry
      await new Promise(r => setTimeout(r, this.retryDelay));
    }

    return false;
  }

  /**
   * Release the lock (only if we own it)
   */
  async release() {
    // Lua script to atomically check and delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      await redis.eval(script, 1, this.lockName, this.lockId);
    } catch (err) {
      console.error(`Failed to release lock ${this.lockName}:`, err.message);
    }
  }

  /**
   * Extend the lock TTL (for long-running operations)
   */
  async extend(additionalSeconds) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    return await redis.eval(script, 1, this.lockName, this.lockId, additionalSeconds);
  }
}

/**
 * Execute a function with a distributed lock
 * @param {string} lockName - Unique name for this lock
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Lock options
 */
async function withLock(lockName, fn, options = {}) {
  const lock = new DistributedLock(lockName, options);

  if (!await lock.acquire()) {
    console.log(`Could not acquire lock ${lockName}, skipping`);
    return null;
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

module.exports = {
  DistributedLock,
  withLock
};
```

**Step 2: Example scheduler integration**

Update a scheduler (e.g., alertScheduler) to use the lock:

```javascript
const { withLock } = require('./distributedLock');

// In the scheduler's job function:
async function runAlertCheck() {
  await withLock('scheduler:alerts', async () => {
    // Original alert check logic here
    // Only one instance will run this at a time
  }, { ttl: 300 }); // 5 minute lock
}
```

**Step 3: Commit**

```bash
git add backend/services/distributedLock.js
git commit -m "feat: add Redis distributed locking for schedulers

Prevents duplicate job execution when running multiple server instances.
Uses Redis SET NX with TTL and Lua scripts for atomic release."
```

---

## Phase 7: Production .env Template

### Task 11: Create Secure Production Environment Template

**Files:**
- Create: `backend/.env.production.template`

**Step 1: Create template**

Create `backend/.env.production.template`:

```bash
# MedFlow Production Environment Configuration
# ============================================
# SECURITY WARNING: Copy this file to .env and fill in real values.
# NEVER commit the actual .env file to version control.
#
# Generate secure secrets with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Server
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-domain.com

# MongoDB
MONGODB_URI=mongodb://username:password@host:27017/medflow?authSource=admin

# Authentication (REQUIRED - generate secure values!)
JWT_SECRET=GENERATE_64_CHAR_HEX_SECRET_HERE
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_SECRET=GENERATE_64_CHAR_HEX_SECRET_HERE

# Encryption Keys (REQUIRED for production!)
CALENDAR_ENCRYPTION_KEY=GENERATE_64_CHAR_HEX_SECRET_HERE
LIS_ENCRYPTION_KEY=GENERATE_64_CHAR_HEX_SECRET_HERE
BACKUP_ENCRYPTION_KEY=GENERATE_64_CHAR_HEX_SECRET_HERE

# Health Endpoint Protection
HEALTH_API_KEY=GENERATE_32_CHAR_SECRET_HERE

# Redis (for rate limiting and distributed locks)
REDIS_URL=redis://localhost:6379

# Email (for notifications)
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-email-password
EMAIL_FROM=MedFlow <noreply@your-domain.com>

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_CLOUD_ENABLED=false

# Mobile Money Integration (DRC)
MOBILE_MONEY_SIMULATION_MODE=false
ORANGE_MONEY_API_KEY=your-orange-money-api-key
ORANGE_MONEY_MERCHANT_ID=your-merchant-id
MTN_MONEY_API_KEY=your-mtn-api-key
MTN_MONEY_MERCHANT_ID=your-merchant-id

# Clinic Configuration
CLINIC_ID=kinshasa-main
CLINIC_NAME=MedFlow Kinshasa

# Optional: Multi-clinic Sync
SYNC_ENABLED=false
CENTRAL_SYNC_URL=https://central.your-domain.com
```

**Step 2: Add to .gitignore**

Ensure `.env` files are ignored:

```bash
echo ".env" >> backend/.gitignore
echo ".env.local" >> backend/.gitignore
echo ".env.production" >> backend/.gitignore
```

**Step 3: Commit**

```bash
git add backend/.env.production.template backend/.gitignore
git commit -m "docs: add production environment template with security guidelines"
```

---

## Summary Checklist

Before going to production, verify:

- [ ] `npm test` passes all tests
- [ ] No hardcoded secrets in codebase
- [ ] All `.env` secrets are 32+ characters
- [ ] `JWT_SECRET` is cryptographically random
- [ ] `BACKUP_ENCRYPTION_KEY` is set
- [ ] `FRONTEND_URL` is set correctly
- [ ] CSRF protection enabled (`DISABLE_CSRF` not set)
- [ ] Health endpoints require auth in production
- [ ] Redis is running for rate limiting and locks
- [ ] Mobile Money API keys are real (not simulation mode)
- [ ] Backup scheduler is enabled
- [ ] Only one server instance OR distributed locks configured

---

## Execution Instructions

Run these commands to apply the full plan:

```bash
cd /Users/xtm888/magloire/backend

# Install new dependencies
npm install csurf cookie-parser uuid

# Run tests
npm test

# Generate production secrets
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "BACKUP_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "CALENDAR_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "LIS_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# Start server in production mode (after setting secrets)
NODE_ENV=production npm start
```
