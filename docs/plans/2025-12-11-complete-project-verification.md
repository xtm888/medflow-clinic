# MedFlow Complete Project Verification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify the entire MedFlow medical clinic management system is production-ready with zero critical issues across security, code quality, testing, performance, and compliance.

**Architecture:** Full-stack JavaScript/Python application with React 19 frontend, Node.js/Express backend, MongoDB database, and Python microservices (face recognition, OCR). Offline-first PWA with multi-clinic support.

**Tech Stack:** React 19, Vite, Redux, Node.js, Express, MongoDB, Mongoose, Socket.io, Python, Flask, Jest, Vitest, Playwright

---

## Verification Phases Overview

| Phase | Focus Area | Critical Level |
|-------|------------|----------------|
| 1 | Security Verification | CRITICAL |
| 2 | Code Quality & Architecture | HIGH |
| 3 | Testing Coverage | HIGH |
| 4 | Performance & Reliability | MEDIUM |
| 5 | Production Readiness | CRITICAL |
| 6 | Documentation & Compliance | MEDIUM |

---

# PHASE 1: SECURITY VERIFICATION (CRITICAL)

## Task 1.1: Secrets & Credentials Audit

**Files:**
- Scan: `**/*.js`, `**/*.jsx`, `**/*.py`, `**/*.json`, `**/*.md`
- Check: `.env*`, `config/**/*`

**Step 1: Search for hardcoded secrets**

```bash
# Search for potential secrets in codebase
grep -rn --include="*.js" --include="*.jsx" --include="*.py" \
  -E "(password|secret|api_key|apikey|token|credential|private_key).*=.*['\"][^'\"]{8,}['\"]" \
  backend/ frontend/ face-service/ ocr-service/ central-server/
```

Expected: ZERO matches of hardcoded secrets

**Step 2: Verify .env files are gitignored**

```bash
# Check gitignore covers all env files
grep -E "\.env" .gitignore
# Verify no .env files are tracked
git ls-files | grep -E "\.env$"
```

Expected: .env patterns in .gitignore, no .env files tracked

**Step 3: Check for exposed API keys in frontend**

```bash
grep -rn --include="*.js" --include="*.jsx" \
  -E "(sk-|pk_|AIza|ghp_|gho_|ghu_|ghs_|ghr_|AKIA)" frontend/src/
```

Expected: ZERO matches

**Step 4: Verify environment variable usage**

```bash
# Check backend uses process.env correctly
grep -rn "process\.env\." backend/config/ | head -50
```

Expected: All secrets read from environment variables

---

## Task 1.2: Authentication & Authorization Audit

**Files:**
- Review: `backend/middleware/auth.js`
- Review: `backend/middleware/clinicAuth.js`
- Review: `backend/controllers/authController.js`
- Review: `backend/routes/auth.js`

**Step 1: Verify JWT implementation**

Read and verify:
- JWT secret length (minimum 32 characters)
- Token expiration configured
- Refresh token rotation implemented
- Tokens stored in httpOnly cookies (production)

**Step 2: Test authentication endpoints**

```bash
# Test login with invalid credentials
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid@test.com","password":"wrong"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: 401 status, no sensitive info leaked

**Step 3: Verify role-based access control**

Read `backend/middleware/auth.js` and verify:
- Role extraction from JWT
- Permission checking on routes
- Clinic-based filtering enforced

**Step 4: Check for broken access control**

```bash
# Find routes without auth middleware
grep -rn "router\." backend/routes/ | grep -v "auth" | grep -v "protect" | head -30
```

Expected: Only public routes (health, login) without auth

---

## Task 1.3: Input Validation & Injection Prevention

**Files:**
- Review: `backend/middleware/validate.js`
- Review: `backend/validators/**/*`
- Review: `backend/utils/sanitize.js`

**Step 1: Check for SQL/NoSQL injection vulnerabilities**

```bash
# Look for direct query interpolation
grep -rn --include="*.js" \
  -E "\.(find|findOne|update|delete|aggregate)\s*\(\s*\{.*\$" \
  backend/controllers/ backend/services/
```

Review each match for user input sanitization

**Step 2: Verify input sanitization**

Read `backend/utils/sanitize.js` and verify:
- XSS prevention with DOMPurify or similar
- HTML entity encoding
- Dangerous characters stripped

**Step 3: Check command injection prevention**

```bash
grep -rn --include="*.js" \
  -E "(exec|spawn|execSync|spawnSync)\s*\(" \
  backend/
```

Review each for input sanitization (check `shellSecurity.js`)

**Step 4: Validate file upload security**

Read `backend/middleware/fileUpload.js` and verify:
- File type validation (MIME + extension)
- File size limits
- Filename sanitization
- Storage outside web root

---

## Task 1.4: Encryption & Data Protection Audit

**Files:**
- Review: `backend/utils/phiEncryption.js`
- Review: `backend/config/*.js`
- Check: All models with sensitive fields

**Step 1: Verify PHI encryption**

Read `backend/utils/phiEncryption.js` and verify:
- Strong encryption algorithm (AES-256 or better)
- Proper IV/nonce handling
- Key derivation if applicable

**Step 2: Check encrypted fields in models**

```bash
# Find models that should have encryption
grep -rn --include="*.js" \
  -E "(ssn|social_security|medical_record|diagnosis|prescription)" \
  backend/models/
```

Verify each sensitive field has encryption applied

**Step 3: Verify encryption key configuration**

```bash
# Check all encryption keys are environment variables
grep -rn "ENCRYPTION_KEY\|PHI_ENCRYPTION_KEY\|BACKUP_ENCRYPTION_KEY" \
  backend/config/ backend/utils/
```

Expected: Keys from process.env only, never hardcoded

**Step 4: Audit password hashing**

```bash
grep -rn "bcrypt\|argon2\|scrypt" backend/
```

Verify:
- bcrypt/argon2 used for password hashing
- Proper salt rounds (minimum 10 for bcrypt)
- No MD5/SHA1 for passwords

---

## Task 1.5: API Security Headers & CORS

**Files:**
- Review: `backend/server.js`
- Review: Security middleware configuration

**Step 1: Verify Helmet.js configuration**

```bash
grep -rn "helmet" backend/server.js
```

Read configuration and verify all security headers enabled:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

**Step 2: Audit CORS configuration**

```bash
grep -rn -A 10 "cors" backend/server.js
```

Verify:
- Origin whitelist (not wildcard in production)
- Credentials enabled only for trusted origins
- Methods restricted appropriately

**Step 3: Check rate limiting**

```bash
grep -rn "rateLimiter\|rate-limit" backend/
```

Verify different limits for:
- Authentication endpoints (stricter)
- General API
- File uploads
- Search endpoints

**Step 4: Verify CSRF protection**

Read `backend/middleware/csrf.js` and verify:
- CSRF tokens required for state-changing operations
- Double-submit cookie pattern or synchronizer token

---

## Task 1.6: Dependency Vulnerability Scan

**Step 1: Audit backend dependencies**

```bash
cd /Users/xtm888/magloire/backend && npm audit --json 2>/dev/null | head -100
```

Expected: No critical/high vulnerabilities

**Step 2: Audit frontend dependencies**

```bash
cd /Users/xtm888/magloire/frontend && npm audit --json 2>/dev/null | head -100
```

Expected: No critical/high vulnerabilities

**Step 3: Audit Python dependencies**

```bash
cd /Users/xtm888/magloire/face-service && pip-audit 2>/dev/null || \
  pip install pip-audit && pip-audit
```

Expected: No critical vulnerabilities

**Step 4: Check for outdated packages with known issues**

```bash
cd /Users/xtm888/magloire/backend && npm outdated
cd /Users/xtm888/magloire/frontend && npm outdated
```

Review for security-critical packages needing updates

---

# PHASE 2: CODE QUALITY & ARCHITECTURE

## Task 2.1: Linting & Static Analysis

**Step 1: Run backend linter**

```bash
cd /Users/xtm888/magloire/backend && npm run lint 2>&1 | head -100
```

Expected: No errors (warnings acceptable)

**Step 2: Run frontend linter**

```bash
cd /Users/xtm888/magloire/frontend && npm run lint 2>&1 | head -100
```

Expected: No errors (warnings acceptable)

**Step 3: Check for console.log statements**

```bash
grep -rn --include="*.js" --include="*.jsx" \
  "console\.(log|debug|info)" \
  backend/controllers/ backend/services/ \
  frontend/src/services/ frontend/src/pages/ 2>/dev/null | wc -l
```

Expected: Minimal console statements in production code

**Step 4: Check for TODO/FIXME/HACK comments**

```bash
grep -rn --include="*.js" --include="*.jsx" \
  -E "(TODO|FIXME|HACK|XXX|BUG):" \
  backend/ frontend/src/ | wc -l
```

Document all findings for review

---

## Task 2.2: Code Complexity Analysis

**Step 1: Identify complex controllers**

```bash
# Check file sizes as complexity indicator
find backend/controllers -name "*.js" -exec wc -l {} \; | sort -rn | head -10
```

Review files > 500 lines for refactoring opportunities

**Step 2: Check function length**

```bash
# Find potentially long functions
grep -rn --include="*.js" "^const.*=.*async.*=>" backend/controllers/ | head -20
```

Review functions > 50 lines for extraction

**Step 3: Identify duplicate code**

```bash
# Use simple duplicate detection
jscpd backend/controllers --min-lines 10 --reporters console 2>/dev/null || echo "Install jscpd: npm i -g jscpd"
```

**Step 4: Check for deep nesting**

```bash
# Find deeply nested code (indicator: many closing braces)
grep -rn --include="*.js" "^\s*}\s*}\s*}\s*}" backend/controllers/
```

Review and refactor deeply nested code

---

## Task 2.3: Architecture Pattern Verification

**Step 1: Verify controller-service separation**

```bash
# Controllers should not contain direct MongoDB operations
grep -rn --include="*.js" "\.save()\|\.findOne(\|\.find(\|\.updateOne(" \
  backend/controllers/ | wc -l
```

Expected: Minimal direct DB operations in controllers

**Step 2: Check for proper error handling**

```bash
# Find try-catch usage
grep -rn --include="*.js" "try {" backend/controllers/ | wc -l
# Find async functions
grep -rn --include="*.js" "async" backend/controllers/ | wc -l
```

Ratio should be reasonable (most async functions wrapped)

**Step 3: Verify consistent API response format**

```bash
# Check apiResponse utility usage
grep -rn "apiResponse\|sendSuccess\|sendError" backend/controllers/ | wc -l
```

Expected: Consistent response formatting

**Step 4: Check model validation schemas**

```bash
# Verify all models have validation
grep -rn "required:\|validate:\|enum:" backend/models/ | wc -l
```

Spot check models for comprehensive validation

---

## Task 2.4: Frontend Architecture Verification

**Step 1: Check for prop drilling issues**

```bash
# Find components with many props
grep -rn --include="*.jsx" "props\." frontend/src/components/ | \
  awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10
```

Review components with excessive prop usage

**Step 2: Verify consistent hook usage**

```bash
# Check for direct API calls outside services
grep -rn --include="*.jsx" "axios\." frontend/src/pages/ frontend/src/components/
```

Expected: All API calls through services/hooks

**Step 3: Check for memory leaks**

```bash
# Find useEffect without cleanup
grep -rn -A 5 "useEffect" frontend/src/ | grep -B 3 "return;" | wc -l
```

Verify effects with subscriptions have cleanup

**Step 4: Verify error boundary coverage**

```bash
grep -rn "ErrorBoundary" frontend/src/App.jsx
```

Expected: Error boundaries around major routes

---

# PHASE 3: TESTING COVERAGE

## Task 3.1: Backend Test Execution

**Step 1: Run all backend tests**

```bash
cd /Users/xtm888/magloire/backend && npm test 2>&1 | tail -50
```

Expected: All tests pass

**Step 2: Run tests with coverage**

```bash
cd /Users/xtm888/magloire/backend && npm run test:coverage 2>&1 | tail -50
```

Expected: Coverage meets threshold (60%+)

**Step 3: Check unit test coverage**

```bash
cd /Users/xtm888/magloire/backend && npm run test:unit 2>&1
```

Document coverage per module

**Step 4: Check integration test coverage**

```bash
cd /Users/xtm888/magloire/backend && npm run test:integration 2>&1
```

Document coverage per feature

---

## Task 3.2: Frontend Test Execution

**Step 1: Run all frontend tests**

```bash
cd /Users/xtm888/magloire/frontend && npm run test:run 2>&1 | tail -50
```

Expected: All tests pass

**Step 2: Run tests with coverage**

```bash
cd /Users/xtm888/magloire/frontend && npm run test:coverage 2>&1 | tail -50
```

Document coverage metrics

**Step 3: Verify service tests exist**

```bash
ls -la frontend/src/test/services/
```

Expected: Test file for each critical service

**Step 4: Verify component tests exist**

```bash
ls -la frontend/src/test/components/
```

Expected: Test file for critical components

---

## Task 3.3: E2E Test Execution

**Step 1: Verify Playwright tests exist**

```bash
ls -la tests/playwright/ | wc -l
```

Expected: Comprehensive test coverage (26+ files noted)

**Step 2: Check test coverage by feature**

```bash
ls tests/playwright/*.spec.js | head -30
```

Map tests to critical user journeys

**Step 3: Run E2E test suite (if services running)**

```bash
cd /Users/xtm888/magloire/tests && ./run_all_tests.sh 2>&1 | tail -50
```

Expected: All critical paths pass

**Step 4: Verify test data management**

```bash
grep -rn "beforeEach\|afterEach\|beforeAll\|afterAll" tests/playwright/
```

Expected: Proper test isolation and cleanup

---

## Task 3.4: Missing Test Identification

**Step 1: List untested controllers**

```bash
# Controllers
ls backend/controllers/*.js | wc -l
# Controller tests
ls backend/tests/**/*.test.js 2>/dev/null | wc -l
```

Identify gap and prioritize critical controllers

**Step 2: List untested services**

```bash
# Frontend services
ls frontend/src/services/*.js | wc -l
# Service tests
ls frontend/src/test/services/*.test.js 2>/dev/null | wc -l
```

Identify gap and prioritize

**Step 3: Check for critical path coverage**

Critical paths to verify tests exist:
- [ ] User authentication (login/logout/register)
- [ ] Patient registration
- [ ] Appointment scheduling
- [ ] Prescription workflow
- [ ] Invoice generation
- [ ] Queue management

**Step 4: Verify edge case coverage**

```bash
# Look for error scenario tests
grep -rn "should.*error\|should.*fail\|expect.*throw" \
  backend/tests/ frontend/src/test/ | wc -l
```

Expected: Significant number of error case tests

---

# PHASE 4: PERFORMANCE & RELIABILITY

## Task 4.1: Database Query Optimization

**Step 1: Check for missing indexes**

```bash
# Find frequently queried fields
grep -rn "\.find(\|\.findOne(" backend/controllers/ backend/services/ | \
  head -20
```

Cross-reference with model indexes

**Step 2: Verify indexes in models**

```bash
grep -rn "\.index(\|index:" backend/models/ | head -20
```

Expected: Indexes on:
- Patient: name, phone, email, clinicId
- Appointment: date, status, patientId, clinicId
- Visit: date, patientId, clinicId
- Invoice: date, status, patientId

**Step 3: Check for N+1 query patterns**

```bash
# Find loops with await inside
grep -rn -A 3 "for.*await\|forEach.*await" backend/controllers/ backend/services/
```

Review for batch query optimization

**Step 4: Verify populate efficiency**

```bash
grep -rn "\.populate(" backend/controllers/ | head -20
```

Check for over-population or missing select fields

---

## Task 4.2: API Performance Verification

**Step 1: Check for response compression**

```bash
grep -rn "compression" backend/server.js backend/package.json
```

Expected: Compression middleware enabled

**Step 2: Verify pagination on list endpoints**

```bash
grep -rn "limit\|skip\|page" backend/controllers/ | head -20
```

Expected: All list endpoints support pagination

**Step 3: Check caching implementation**

```bash
grep -rn "redis\|cache" backend/services/ | head -20
```

Verify caching for:
- User sessions
- Frequently accessed data
- Search results

**Step 4: Verify async operations**

```bash
# Check for blocking operations
grep -rn "Sync(" backend/ | grep -v "node_modules"
```

Expected: Minimal sync operations in request handlers

---

## Task 4.3: Frontend Performance

**Step 1: Verify code splitting**

```bash
grep -rn "lazy\|Suspense\|React.lazy" frontend/src/App.jsx
```

Expected: Routes use lazy loading

**Step 2: Check bundle size**

```bash
cd /Users/xtm888/magloire/frontend && npm run build 2>&1 | tail -30
```

Review bundle sizes for optimization opportunities

**Step 3: Verify image optimization**

```bash
# Check for large images in public folder
find frontend/public -name "*.png" -o -name "*.jpg" | xargs ls -lh 2>/dev/null | head -10
```

Expected: Images optimized (<200KB each)

**Step 4: Check for memory leaks in components**

```bash
# Find components without cleanup
grep -rn -B 5 "setInterval\|addEventListener" frontend/src/components/ | \
  grep -v "clearInterval\|removeEventListener" | head -20
```

Review for proper cleanup

---

## Task 4.4: Reliability & Error Handling

**Step 1: Verify global error handler**

```bash
cat backend/middleware/errorHandler.js
```

Expected:
- Catches all errors
- Logs errors properly
- Returns sanitized error messages
- Different handling for production/development

**Step 2: Check database connection resilience**

```bash
grep -rn "mongoose.connection\|reconnect" backend/server.js backend/config/
```

Expected: Auto-reconnection configured

**Step 3: Verify graceful shutdown**

```bash
grep -rn "SIGTERM\|SIGINT\|graceful" backend/server.js
```

Expected: Graceful shutdown handling

**Step 4: Check WebSocket reconnection**

```bash
grep -rn "reconnect" backend/services/websocketService.js frontend/src/services/websocketService.js
```

Expected: Auto-reconnection for dropped connections

---

# PHASE 5: PRODUCTION READINESS

## Task 5.1: Environment Configuration

**Step 1: Verify .env.example completeness**

```bash
# Count env vars in example
grep -c "=" backend/.env.example
# Count env vars used in code
grep -rn "process\.env\." backend/ | grep -oE "process\.env\.\w+" | sort -u | wc -l
```

Expected: Example covers all required variables

**Step 2: Check for localhost URLs**

```bash
grep -rn "localhost\|127\.0\.0\.1" backend/ frontend/src/ | \
  grep -v node_modules | grep -v "\.test\." | grep -v ".md"
```

Expected: No hardcoded localhost in production code

**Step 3: Verify NODE_ENV handling**

```bash
grep -rn "NODE_ENV\|production\|development" backend/config/ backend/server.js
```

Expected: Different behavior for production/development

**Step 4: Check logging configuration**

```bash
grep -rn "winston\|logger" backend/config/logger.js | head -20
```

Expected: Log levels, file rotation, structured logging

---

## Task 5.2: Health Check & Monitoring

**Step 1: Verify health endpoints**

```bash
grep -rn "/health\|/ready\|/live" backend/routes/ backend/server.js
```

Expected: Health and readiness endpoints exist

**Step 2: Check metrics collection**

```bash
grep -rn "prometheus\|prom-client\|metrics" backend/
```

Expected: Prometheus metrics configured

**Step 3: Verify Sentry integration**

```bash
grep -rn "sentry\|Sentry" frontend/src/ | head -10
```

Expected: Error tracking configured

**Step 4: Check structured logging**

```bash
grep -rn "structuredLogger\|winston" backend/services/ | head -10
```

Expected: Structured logging in critical services

---

## Task 5.3: Build & Deploy Verification

**Step 1: Verify frontend build succeeds**

```bash
cd /Users/xtm888/magloire/frontend && npm run build 2>&1
echo "Exit code: $?"
```

Expected: Build completes without errors

**Step 2: Verify backend starts cleanly**

```bash
cd /Users/xtm888/magloire/backend && timeout 10 npm start 2>&1 || true
```

Expected: No startup errors (will timeout waiting for MongoDB)

**Step 3: Check PM2 configuration**

```bash
cat /Users/xtm888/magloire/ecosystem.config.js
```

Verify:
- Memory limits set
- Restart policies configured
- Log paths defined

**Step 4: Verify Docker configuration (if applicable)**

```bash
cat /Users/xtm888/magloire/face-service/Dockerfile
```

Expected: Production-ready Dockerfile

---

## Task 5.4: Database Migration & Backup

**Step 1: Check migration configuration**

```bash
cat backend/migrate-mongo-config.js
```

Expected: Proper MongoDB migration setup

**Step 2: Verify migration files exist**

```bash
ls backend/migrations/ 2>/dev/null | head -10
```

Expected: Migration files for schema changes

**Step 3: Check backup service**

```bash
grep -rn "backup" backend/services/backupService.js | head -10
```

Expected: Automated backup configured

**Step 4: Verify backup encryption**

```bash
grep -rn "BACKUP_ENCRYPTION\|encrypt" backend/services/backupService.js
```

Expected: Backups encrypted at rest

---

# PHASE 6: DOCUMENTATION & COMPLIANCE

## Task 6.1: API Documentation Verification

**Step 1: Verify Swagger/OpenAPI setup**

```bash
grep -rn "swagger" backend/server.js backend/config/swagger.js
```

Expected: Swagger UI available at /api-docs

**Step 2: Check route documentation**

```bash
grep -rn "@swagger\|@openapi" backend/routes/ | wc -l
```

Expected: All routes documented

**Step 3: Verify API documentation accuracy**

Access `/api-docs` when server running and verify:
- All endpoints listed
- Request/response schemas correct
- Authentication documented

**Step 4: Check README completeness**

```bash
cat /Users/xtm888/magloire/README.md 2>/dev/null | head -50 || \
cat /Users/xtm888/magloire/docs/README.md 2>/dev/null | head -50
```

Expected: Setup instructions, environment variables, deployment guide

---

## Task 6.2: Code Documentation

**Step 1: Check JSDoc coverage**

```bash
grep -rn "/\*\*" backend/controllers/ backend/services/ | wc -l
```

Expected: Critical functions documented

**Step 2: Verify inline comments for complex logic**

```bash
# Find complex files
find backend/controllers -name "*.js" -exec wc -l {} \; | sort -rn | head -5
```

Review for adequate comments

**Step 3: Check architecture documentation**

```bash
ls -la /Users/xtm888/magloire/docs/
```

Expected: ARCHITECTURE.md exists and is current

**Step 4: Verify deployment documentation**

```bash
cat /Users/xtm888/magloire/docs/DEPLOYMENT.md 2>/dev/null | head -30
```

Expected: Complete deployment instructions

---

## Task 6.3: Healthcare Compliance Checks

**Step 1: Verify audit logging**

```bash
grep -rn "AuditLog\|audit" backend/middleware/auditLogger.js backend/models/AuditLog.js
```

Expected: Comprehensive audit trail

**Step 2: Check PHI handling**

```bash
grep -rn "PHI\|phi" backend/ | head -20
```

Verify:
- PHI identified and marked
- Encryption applied
- Access logged

**Step 3: Verify data retention policies**

```bash
grep -rn "retention\|expire\|delete.*old" backend/
```

Expected: Data retention policies implemented

**Step 4: Check access control granularity**

```bash
cat backend/models/RolePermission.js
```

Expected: Fine-grained permission model

---

## Task 6.4: Security Documentation

**Step 1: Check security headers documentation**

```bash
grep -rn "helmet\|security" /Users/xtm888/magloire/docs/
```

Expected: Security configuration documented

**Step 2: Verify incident response documentation**

```bash
ls /Users/xtm888/magloire/docs/ | grep -i "security\|incident"
```

Expected: Security incident response plan

**Step 3: Check backup/recovery documentation**

```bash
grep -rn "backup\|restore\|recovery" /Users/xtm888/magloire/docs/
```

Expected: Backup and recovery procedures

**Step 4: Verify environment variable documentation**

```bash
cat backend/.env.example | head -30
```

Expected: All variables documented with descriptions

---

# VERIFICATION SUMMARY CHECKLIST

## Phase 1: Security (CRITICAL)
- [ ] 1.1 Secrets & credentials audit complete
- [ ] 1.2 Authentication & authorization verified
- [ ] 1.3 Input validation & injection prevention checked
- [ ] 1.4 Encryption & data protection audited
- [ ] 1.5 API security headers & CORS verified
- [ ] 1.6 Dependency vulnerabilities scanned

## Phase 2: Code Quality
- [ ] 2.1 Linting passes without errors
- [ ] 2.2 Code complexity within acceptable limits
- [ ] 2.3 Architecture patterns followed
- [ ] 2.4 Frontend architecture verified

## Phase 3: Testing
- [ ] 3.1 Backend tests pass (60%+ coverage)
- [ ] 3.2 Frontend tests pass
- [ ] 3.3 E2E tests pass
- [ ] 3.4 Critical paths have test coverage

## Phase 4: Performance
- [ ] 4.1 Database queries optimized
- [ ] 4.2 API performance verified
- [ ] 4.3 Frontend performance optimized
- [ ] 4.4 Error handling comprehensive

## Phase 5: Production Readiness
- [ ] 5.1 Environment configuration complete
- [ ] 5.2 Health checks & monitoring configured
- [ ] 5.3 Build & deploy verified
- [ ] 5.4 Database migration & backup ready

## Phase 6: Documentation
- [ ] 6.1 API documentation complete
- [ ] 6.2 Code documentation adequate
- [ ] 6.3 Healthcare compliance verified
- [ ] 6.4 Security documentation complete

---

# ISSUE TRACKING TEMPLATE

For each issue found, document:

```markdown
### Issue [ID]: [Title]

**Phase:** [1-6]
**Task:** [X.X]
**Severity:** [Critical/High/Medium/Low]
**File:** [path:line]

**Description:**
[What was found]

**Impact:**
[Why this matters]

**Recommendation:**
[How to fix]

**Effort:** [Hours estimate]
```

---

# EXECUTION NOTES

1. **Start services before testing:**
   ```bash
   ./start-all.sh --skip-face
   ```

2. **Run phases in order:** Security issues must be fixed before proceeding

3. **Document everything:** Use issue template for all findings

4. **Track progress:** Update checklist as phases complete

5. **Prioritize fixes:**
   - Critical security issues: Immediate
   - High: Before production
   - Medium: Scheduled maintenance
   - Low: Backlog
