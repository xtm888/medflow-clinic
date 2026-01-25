# Codebase Concerns

**Analysis Date:** 2025-01-25

## Tech Debt

### 1. Deprecated Model/API Migration Not Complete

**Issue**: ConsultationSession model and routes marked @deprecated but still actively used in controllers and routes

**Files**:
- `backend/models/ConsultationSession.js` (marked deprecated with console.warn)
- `backend/routes/consultationSessions.js` (marked deprecated)
- `backend/controllers/consultationSessionController.js` (marked deprecated)
- `backend/models/Visit.js` (contains DEPRECATED field references and TODO comments for migration)

**Impact**:
- Data duplication between ConsultationSession and OphthalmologyExam models
- Confusion for developers on which model to use for clinical exams
- Increased maintenance burden with parallel model support
- Potential data inconsistency if both models are modified independently

**Fix approach**:
1. Complete migration from ConsultationSession to OphthalmologyExam (migration exists at `backend/migrations/20260117-migrate-consultation-session-to-ophthalmology-exam.js` but unclear if fully applied)
2. Remove deprecated routes and controller references
3. Update all consuming code to use OphthalmologyExam exclusively
4. Add pre-migration validation to ensure no active records remain in old model

### 2. Large Monolithic Controllers and Services

**Issue**: Multiple files exceed 1500+ lines, making them difficult to maintain and test

**Files with high complexity**:
- `backend/services/pdfGenerator.js` (3679 lines) - entire PDF generation logic
- `backend/models/OphthalmologyExam.js` (2979 lines) - exam model with embedded business logic
- `backend/models/Patient.js` (2736 lines) - patient model with multiple concerns mixed
- `backend/models/Invoice.js` (2376 lines) - billing logic in model layer
- `backend/controllers/pharmacyController.js` (2033 lines) - all pharmacy operations
- `backend/controllers/opticalShopController.js` (1980 lines) - optical shop business logic
- `backend/controllers/appointmentController.js` (1961 lines) - appointment and queue operations
- `backend/services/websocketService.js` (1599 lines) - all real-time operations
- `backend/controllers/laboratory/orders.js` (1527 lines) - lab order management

**Impact**:
- Difficult to locate specific logic
- High cognitive load for code reviews
- Testing individual concerns is hard
- Increased risk of unintended side effects when modifying code

**Fix approach**:
1. Extract logical concerns into separate files/modules
2. Break large models into sub-documents or services
3. Create domain-specific service layers that handle business logic
4. Move validation logic out of models into dedicated validator services

### 3. Multiple Legacy System Integration Points

**Issue**: Complex integrations with legacy systems (CareVision, DMI, PACS) create scattered business logic

**Files**:
- `backend/services/careVisionBridge.js` - SQL Server connection bridge
- `backend/services/careVisionSqlClient.js` (1375 lines) - legacy SQL client
- `backend/services/dmiClient.js` - remote database client
- `backend/services/medicareBridge.js` - insurance system bridge
- `backend/scripts/importCareVisionData.js` - legacy data import (367+ lines)
- Multiple audit scripts in `backend/scripts/` for legacy data validation

**Impact**:
- Business logic scattered across multiple services and scripts
- Difficult to understand complete data flow through systems
- Error handling inconsistent across integration points
- Migration path unclear for moving legacy data

**Fix approach**:
1. Create unified integration facade pattern for legacy system access
2. Document legacy data migration strategy and progress
3. Consolidate legacy database client logic into single service
4. Add comprehensive integration tests for legacy system interaction

### 4. Script Sprawl (206+ Scripts in backend/scripts/)

**Issue**: Excessive number of one-off scripts for migrations, audits, and data management

**Files**: `backend/scripts/` directory contains:
- 206+ JavaScript files (many prefixed with `check*`, `audit*`, `seed*`, `import*`, `migrate*`)
- Orphaned scripts without documentation or test coverage
- Scripts that may depend on specific data states or environment conditions

**Examples of potential orphaned/duplicate scripts**:
- `checkArticlesCols.js`, `checkClientCols.js`, `checkStocksCols.js` - similar check patterns
- Multiple audit scripts: `auditByamungu.js`, `auditCareVision.js`, `auditCareVisionFraud.js`, `auditPharmacy.js`, `auditPharmacyFinal.js`, `auditPharmacyUnpaid.js`
- Multiple check scripts: `checkData.js`, `check_critical_data.js`, `check_db.js`

**Impact**:
- Difficulty in determining which script to run for a given task
- Unmaintained scripts may reference stale data structures
- Deployment becomes risky without understanding script dependencies
- Documentation gaps on when/why each script is needed
- Version control bloat

**Fix approach**:
1. Create script registry/manifest documenting purpose of each script
2. Consolidate duplicate check/audit/import functionality
3. Move scripts into organized subfolders by category (migrations/, audits/, seeding/, utilities/)
4. Add script dependencies and execution requirements documentation
5. Consider moving one-time scripts to archive or removing entirely

## Known Bugs

### 1. Error Handling Gaps (470+ Issues Documented)

**Issue**: 175+ async functions lack try-catch blocks, 199+ database operations have no error handling

**Files**: Throughout backend services and controllers

**Symptoms**:
- Unhandled promise rejections can crash Node.js process
- Incomplete operations may leave database in inconsistent state
- Network failures propagate as uncaught errors
- Silent failures in background processes

**Documented in**: `backend/ERROR_HANDLING_AUDIT_REPORT.md`

**Critical affected areas**:
- `backend/services/centralServerClient.js` - all async functions (46-287)
- `backend/services/appointmentValidationService.js` - database queries without error handling
- `backend/services/folderSyncService.js` - file system operations without proper error handling
- `backend/controllers/prescriptions/coreController.js` - database saves without error handlers
- `backend/services/websocketService.js` - event handler without error handling

**Workaround**: Currently, errors may be caught at middleware level, but this is unreliable

### 2. Missing Validation Before Database Operations

**Issue**: Some controllers directly process req.body without comprehensive validation

**Files**:
- `backend/controllers/patients/coreController.js` - accepts patient data with minimal validation
- `backend/controllers/invoices/coreController.js` - invoice creation without full validation
- Multiple controllers using express-validator inconsistently

**Example**:
```javascript
// In controllers: direct body assignment without validation
const updates = req.body;
const patient = await Patient.create(req.body);  // Dangerous if unexpected fields present
```

**Impact**: Invalid data may be persisted to database, requiring cleanup migrations

### 3. Potential Race Conditions

**Issue**: Promise.all() and concurrent operations without proper error handling or locking

**Files**:
- `backend/services/distributedLock.js` - lock implementation may have race windows
- `backend/controllers/inventory/` - inventory transfers may race
- `backend/services/paymentGateway.js` - concurrent payment processing

**Symptoms**:
- Double-charging or inventory discrepancies in high-concurrency scenarios
- Inconsistent state after payment operations

**Impact**: Financial data integrity compromise in multi-user scenarios

## Security Concerns

### 1. PHI Encryption Incomplete

**Issue**: While encryption middleware exists, not all PHI fields may be consistently encrypted

**Files**:
- `backend/utils/phiEncryption.js` - encryption utility
- `backend/models/Patient.js` - uses encryption plugin but fields may bypass it
- Audit reports indicate inconsistent encryption coverage

**Documented in**: `backend/PHI_ENCRYPTION_AUDIT_REPORT.md`

**Risk**:
- Patient medical records (PII) could be exposed if database is compromised
- Legal/GDPR compliance violation risk
- Audit logs may contain unencrypted sensitive data

**Current mitigation**:
- Encryption plugin applied to Patient model
- Access audit logging in place

**Recommendations**:
1. Audit all models containing PHI to ensure encryption is applied
2. Verify encryption is applied to audit logs containing medical data
3. Test encryption/decryption in all code paths
4. Add regular key rotation mechanism
5. Ensure backups are also encrypted

### 2. Child Process Execution Without Sanitization

**Issue**: Multiple services use child_process without full command sanitization

**Files**:
- `backend/services/solixAutoImportService.js` - uses `exec()`
- `backend/services/networkDiscoveryService.js` - uses `exec()`, `spawn()`, `execFile()`
- `backend/services/tomeyAutoImportService.js` - uses `exec()`
- `backend/services/smbStreamService.js` - uses `spawn()`, `execFile()`
- `backend/services/backupService.js` - uses `execFile()`, `spawn()`

**Impact**:
- Potential shell injection if user input is not fully sanitized
- Command injection attacks possible through file paths or device names
- Elevation of privilege if Node.js runs with elevated permissions

**Current mitigation**: Utility at `backend/utils/shellSecurity.js` provides sanitization

**Risk level**: MEDIUM (shell utilities are used, but coverage unclear)

### 3. NoSQL Injection Protection May Be Incomplete

**Issue**: NoSQL injection middleware exists but may not cover all attack vectors

**Files**:
- `backend/middleware/noSqlInjectionProtection.js` - sanitization middleware
- Blocks dangerous operators like `$gt`, `$regex`, `$where`
- Checks for prototype pollution

**Known gaps**:
- Protection is disabled in development mode by default
- Some services may bypass middleware for direct database queries
- Field validation may allow nested object injection

**Recommendations**:
1. Ensure middleware is always applied in production
2. Add parameterized query patterns for direct MongoDB access
3. Implement input schema validation at API level
4. Regular security audits of query patterns

### 4. Secrets Management

**Issue**: Environment variable validation exists but secrets rotation is manual

**Files**:
- `backend/utils/envValidator.js` - validates required secrets at startup
- `backend/server.js` - checks JWT_SECRET length
- `backend/scripts/rotateSecrets.js` - manual rotation script

**Risk**:
- If JWT_SECRET is compromised, attacker can forge tokens
- No automatic secret rotation mechanism
- Multiple .env files in repository (some with production values)

**Files with committed secrets**:
- `backend/.env.production` - should not be in repo
- `backend/scripts/crackCareVisionPasswords.js` - contains legacy password examples

**Recommendations**:
1. Remove .env.production from repository
2. Use external secrets management (AWS Secrets Manager, HashiCorp Vault)
3. Implement automatic secret rotation
4. Audit all shell/script files for hardcoded secrets

## Performance Bottlenecks

### 1. Large Query Results Without Pagination

**Issue**: Some list endpoints may return large result sets

**Files**:
- `backend/controllers/patients/coreController.js` - uses pagination but unclear if all endpoints do
- `backend/controllers/laboratory/orders.js` - may fetch all orders without limit
- `backend/controllers/inventory/UnifiedInventoryController.js` - inventory queries may be unbounded

**Impact**:
- Memory spikes on server when returning large datasets
- Slow API responses with many records
- Client-side UI performance degradation

### 2. Inefficient N+1 Query Patterns

**Issue**: Multiple controllers may fetch related data in loops

**Example concern areas**:
- `backend/controllers/ophthalmology/coreController.js` - exam with related patient/visit/device data
- `backend/controllers/invoices/coreController.js` - invoice with line items, payments, allocations
- `backend/controllers/laboratory/orders.js` - orders with specimens, results, QC data

**Fix approach**:
1. Implement `populate()` with careful field selection
2. Use `.lean()` for read-only queries
3. Add database query performance monitoring
4. Profile hot endpoints with slow query logs

### 3. WebSocket Cleanup Intervals

**Issue**: WebSocket service uses setInterval for cleanup without graceful shutdown

**File**: `backend/services/websocketService.js`

**Patterns**:
```javascript
this.cleanupInterval = setInterval(() => { ... });  // No clearInterval on shutdown
this.pingInterval = setInterval(() => { ... });     // No cleanup
```

**Impact**:
- Memory leaks if server restarts frequently
- Zombie intervals continuing after unsubscribe
- Potential CPU waste with overlapping intervals

**Fix approach**:
1. Store interval IDs and clear on service shutdown
2. Add graceful shutdown handler
3. Implement connection timeout cleanup

### 4. PDF Generation Performance

**Issue**: Large monolithic PDF service may be slow for complex documents

**File**: `backend/services/pdfGenerator.js` (3679 lines)

**Impact**:
- Invoice/prescription generation slowness
- Blocking requests while generating PDFs
- Potential timeout on slow networks

**Fix approach**:
1. Implement async PDF generation with background queue
2. Cache static template elements
3. Consider streaming PDF responses for large files

## Fragile Areas

### 1. Multi-Clinic Data Isolation

**Issue**: While clinic context is checked in many places, enforcement is inconsistent

**Files**:
- 40+ controllers check `clinicId` but implementation varies
- Some queries may not enforce clinic boundaries
- Cross-clinic inventory operations may have edge cases

**Risk**:
- Patient data leak between clinics if any endpoint misses clinic check
- Inventory counted twice if cross-clinic transfer has bugs
- Financial data mixing across clinics

**Safe modification approach**:
1. Always verify `req.user.currentClinicId` or `req.user.clinics`
2. Add clinic ID to all MongoDB queries as filter
3. Add integration tests that verify clinic isolation
4. Use middleware to enforce clinic context on all routes

**Test coverage gaps**: Multi-clinic scenarios may lack test coverage

### 2. Invoice Billing State Machine

**Issue**: Invoice status transitions have complex logic scattered across multiple files

**Files**:
- `backend/models/Invoice.js` (2376 lines)
- `backend/controllers/invoices/coreController.js` (1063 lines)
- `backend/controllers/invoices/paymentController.js` (1509 lines)
- `backend/controllers/invoices/billingController.js` (61+ console.logs)
- `backend/controllers/companies/billingController.js` (294 checks)
- `backend/services/invoicePaymentService.js`
- `backend/services/invoiceAuditService.js`

**Status flow**: draft → issued → partial → paid → cancelled

**Risks**:
- State transitions may be invalid if called out of order
- Concurrent payment updates could corrupt invoice state
- Refunds may not properly reverse state
- Company billing has separate logic that may diverge

**Safe modification approach**:
1. Centralize state transition logic in single service
2. Use database transactions for multi-step updates
3. Add pre-update validation of current state
4. Log all state transitions for audit trail
5. Test all valid/invalid state transitions

**Test coverage gaps**: Edge cases like partial refunds, payment failures during state transition

### 3. Device Sync and Data Import

**Issue**: Device data import has multiple async processes that may conflict

**Files**:
- `backend/services/folderSyncService.js` - folder monitoring
- `backend/services/deviceSyncScheduler.js` - periodic sync
- `backend/services/solixAutoImportService.js` - Solix device import
- `backend/services/tomeyAutoImportService.js` - Tomey device import
- Multiple device parsers in `backend/services/deviceParsers/`

**Risks**:
- Same device file processed twice if sync intervals overlap
- Patient matching may fail if biometric data is incomplete
- Device data may be lost if queue full or service restarts
- Duplicate imaging records if retry logic not idempotent

**Safe modification approach**:
1. Use distributed lock to ensure single processor per device
2. Make file processing idempotent with checksum/hash tracking
3. Implement dead-letter queue for failed imports
4. Add comprehensive logging of all import attempts
5. Test with concurrent sync attempts

**Test coverage gaps**: Failure scenarios during import, concurrent sync

### 4. Orthoptic Exam Validation

**Issue**: OrthoptieQuickPanel and orthoptic exam forms may have conflicting validation

**Files**:
- `frontend/src/components/ophthalmology/OrthoptieQuickPanel.jsx`
- `frontend/src/pages/OrthopticExamForm.jsx` (1118 lines)
- `backend/models/OphthalmologyExam.js` - orthoptic sub-schema
- `backend/controllers/orthopticController.js`

**Fragility**:
- Client-side and server-side validation may differ
- Motility grading scale may have interpretation issues
- Stereo testing results format may vary

**Safe modification approach**:
1. Define canonical orthoptic data schema in backend
2. Add strict validation on both client and server
3. Add integration tests with real exam data samples
4. Document valid value ranges for each field

## Scaling Limits

### 1. Database Connection Pooling

**Issue**: Default MongoDB connection pool may be insufficient for high concurrency

**File**: `backend/utils/mongoConnection.js`

**Current approach**: Uses default Mongoose connection pool

**Scaling concern**:
- At high patient visit volume, connection pool may exhaust
- No automatic pool resizing
- No monitoring of connection usage

**Scaling path**:
1. Monitor connection pool usage in production
2. Increase maxPoolSize if connections saturate
3. Implement connection pool metrics
4. Consider read replicas for heavy read operations

### 2. Redis Session Storage

**Issue**: Redis stores session tokens and may have memory pressure

**File**: `backend/config/redis.js`

**Scaling concern**:
- Session TTL may be too long, accumulating tokens
- No automatic eviction policy visible
- No monitoring of Redis memory usage

**Scaling path**:
1. Configure Redis maxmemory policy (allkeys-lru recommended)
2. Monitor Redis memory usage
3. Set aggressive session TTL timeouts
4. Use Redis cluster for high availability

### 3. Queue Processing (Bull Job Queue)

**Issue**: Async job queue may accumulate jobs if processors slow

**Files**:
- `backend/` uses Bull for async processing (background jobs)
- `backend/services/` may queue operations without monitoring

**Scaling concern**:
- If job processors slower than job producers, queue grows
- Failed jobs may retry indefinitely
- No apparent DLQ (dead-letter queue) mechanism

**Scaling path**:
1. Monitor queue depth and processing rate
2. Implement exponential backoff for retries
3. Add max retry limits
4. Move failed jobs to DLQ after max retries
5. Scale processor workers based on queue depth

### 4. File Storage (SMB/Local)

**Issue**: Device images and documents stored on network share or local storage

**Files**:
- `backend/services/smbStreamService.js` - network file access
- `backend/services/smb2ClientService.js` - SMB2 protocol client

**Scaling concern**:
- Network share bandwidth may limit concurrent file operations
- No apparent sharding or distribution
- Storage capacity may be local disk limited
- No apparent cleanup of old files

**Scaling path**:
1. Migrate to object storage (S3, Azure Blob) for scalability
2. Implement file lifecycle policies (archive/delete old files)
3. Add CDN for image delivery
4. Monitor storage capacity and I/O

## Dependencies at Risk

### 1. Deprecated/Old Version Dependencies

**Issue**: Some dependencies may be outdated or have known vulnerabilities

**Package concerns**:
- `axios` (^1.6.0) - using range that allows old versions
- `mongoose` (^7.5.0) - version 7 is older, latest is 8+
- `pdfkit` (^0.17.2) - stable but not latest
- `redis` (^4.6.8) - latest is 5.x
- `socket.io` (^4.5.4) - latest is 4.7.x+
- `tesseract.js` (^5.0.5) - OCR library maintenance unclear
- `uuid` (^13.0.0) - latest is much higher

**Risk**:
- Known CVEs in older versions
- Compatibility issues with Node 20+
- Missing performance improvements

**Migration plan**:
1. Run `npm audit` and address vulnerabilities
2. Test and upgrade to latest major versions incrementally
3. Pay special attention to security-critical packages (jsonwebtoken, bcryptjs)
4. Test each upgrade with full test suite

### 2. pdf-parse Multiple Bundled Versions

**Issue**: package.json includes pdf-parse which bundles multiple pdf.js versions internally

**Files**:
- `backend/node_modules/pdf-parse/lib/pdf.js/` contains v1.9.426, v1.10.88, v1.10.100, v2.0.550
- Bundle size bloat

**Risk**:
- Increased dependencies footprint
- Potential security issues in bundled libraries
- Unclear which version is actually used

**Fix approach**:
1. Check if all bundled versions are necessary
2. Consider lighter PDF parsing library
3. Document why pdf-parse is needed (OCR-related?)

### 3. Sharp Image Processing

**Issue**: sharp (native binding for image processing) may have compilation issues

**Files**:
- `backend/package.json` - depends on sharp
- Used for image resizing, compression

**Risk**:
- Native bindings may fail to compile on some systems
- Platform-specific binary issues in CI/CD
- Performance unpredictable on slow hardware

**Mitigation**:
- Add prebuilt binary support
- Test builds on all deployment targets
- Consider lightweight image processing alternative

## Missing Critical Features

### 1. Comprehensive Audit Trail for Financial Operations

**Issue**: While audit logging exists, coverage of financial operations unclear

**Files**:
- `backend/middleware/auditLogger.js` - general audit logging
- Not clear if all invoice changes, payments, refunds are logged

**Missing**:
- Who changed invoice amount
- Who approved convention billing
- Payment method change audit trail
- Fee schedule version control

**Impact**: Compliance/legal issue if can't track financial decisions

### 2. Rate Limiting on Financial Operations

**Issue**: Rate limiters applied to some routes but not comprehensively on payment/invoice endpoints

**File**: `backend/middleware/rateLimiter.js`

**Missing**:
- Rate limiting on payment creation (could spam payments)
- Rate limiting on refund operations
- Rate limiting on inventory adjustment (prevents adjustment spam)

**Fix approach**:
1. Add strict rate limits on all financial mutation endpoints
2. Rate limit by user + resource to prevent automated abuse
3. Add monitoring for rate limit violations

### 3. Data Archival/Retention Policy

**Issue**: No visible mechanism for archiving old data or enforcing retention policies

**Concern**:
- Database grows indefinitely as records accumulate
- Soft deletes mark data as deleted but never purged
- No apparent data lifecycle management

**Impact**: Performance degradation, storage costs, compliance issues

**Fix approach**:
1. Implement data archival strategy (move old records to archive collection)
2. Set retention policy (e.g., keep 7 years for financial records)
3. Implement purge process for records past retention
4. Add archival verification before deletion

### 4. Backup and Disaster Recovery

**Issue**: Backup service exists but recovery procedures unclear

**File**: `backend/services/backupService.js`

**Missing**:
- Documented RTO/RPO targets
- Backup verification procedure
- Restore testing procedure
- Point-in-time recovery capability

**Impact**: Extended downtime in disaster scenario

## Test Coverage Gaps

### 1. Untested Error Paths

**Issue**: 470+ error handling issues means most error paths are untested

**Files**: Most controller and service files

**Untested scenarios**:
- Database connection failure during payment processing
- Network timeout during legacy system sync
- Concurrent inventory transfers
- Partial failure in multi-step workflows

**Risk**: Undetected bugs may cause production issues

**Priority**: HIGH - implement error path testing

### 2. Multi-Clinic Integration Tests

**Issue**: Test coverage unclear for multi-clinic scenarios

**Concern**:
- Inventory transfers between clinics
- Cross-clinic patient visibility
- Cross-clinic billing and payments
- Revenue aggregation

**Priority**: HIGH - clinic isolation is critical

### 3. Device Integration Tests

**Issue**: Device sync, import, and duplicate handling may lack test coverage

**Concern**:
- Concurrent device sync from multiple devices
- Duplicate device file handling
- Patient matching failures
- OCT/Visual field data parsing edge cases

**Priority**: MEDIUM

### 4. Billing State Transitions

**Issue**: Invoice state machine transitions unclear if fully tested

**Concern**:
- Invalid state transitions (e.g., paid → issued)
- Refund scenarios
- Company billing approval workflows
- Convention/insurance billing edge cases

**Priority**: HIGH - financial data integrity critical

## Code Quality & Consistency Issues

### 1. Inconsistent Error Response Format

**Issue**: Multiple error response patterns used throughout codebase

**Examples**:
- Some endpoints use `apiResponse.error()` utility
- Some return raw errors
- Some return HTTP status codes only
- Some use custom error objects

**Impact**:
- Inconsistent API contracts
- Frontend error handling complexity
- Documentation unclear

**Fix approach**:
1. Enforce single error response format
2. Update all endpoints to use consistent format
3. Document error response schema
4. Add linting rule to prevent regression

### 2. Logging Inconsistency

**Issue**: Mix of console.log, Winston logger, and structured logging

**Files**:
- Some files use `console.log()` (against best practices)
- `backend/utils/structuredLogger.js` provides structured logging
- Some files log to Winston directly
- Inconsistent log levels

**Found**: 68+ instances of console.log in error handling audit controller

**Impact**:
- Production logs polluted with debug output
- Structured logging not maximized
- Performance impact from excessive logging

**Fix approach**:
1. Remove all console.log from production code
2. Use structured logger consistently
3. Configure log levels per environment
4. Add linting to prevent console statements

### 3. Magic Numbers and Strings

**Issue**: Hard-coded values scattered throughout codebase

**Examples**:
- Visual acuity scales hardcoded in multiple components
- Monoyer/Parinaud scale values in UI and backend
- IOP ranges, refraction limits
- Status enum values duplicated in multiple files

**Files affected**: Models, controllers, frontend components

**Fix approach**:
1. Create centralized constants/enums module
2. Export from single source of truth
3. Use TypeScript enums or frozen objects
4. Add linting for magic numbers

### 4. Duplicate Validation Logic

**Issue**: Similar validation patterns repeated across multiple controllers

**Examples**:
- Patient phone number validation
- Currency validation
- Status enum validation
- Date range validation

**Fix approach**:
1. Create shared validator utilities
2. Use express-validator chains consistently
3. Centralize Yup schemas
4. Document expected input formats

## Database Coherence Issues

### 1. Field Naming Inconsistencies

**Issue**: Different models use different naming conventions for same concept

**Examples**:
- Some models use `createdAt`, others use `dateCreated`
- Some use `clinic`, others use `clinicId`
- Status fields named inconsistently (`status`, `state`, `workflowStatus`)

**Impact**:
- Query complexity increases
- Higher bug risk with wrong field names
- API contract less clear

**Fix approach**:
1. Standardize on camelCase field names
2. Use migration to rename fields
3. Update models to use consistent naming
4. Add linting for field naming patterns

### 2. Unique Index Issues

**Issue**: Multiple unique fields may cause update challenges

**File**: `backend/models/Patient.js` - has multiple unique fields

**Concerns**:
- `patientId`, `nationalId` both unique and sparse
- `legacyIds.dmi`, `legacyIds.lv` may have sparse/unique issues
- Unique index conflicts during migrations

**Risk**: Update failures if trying to change these fields

### 3. Soft Delete Inconsistency

**Issue**: Not all models consistently support soft deletes

**Patterns seen**:
- `isDeleted` + `deletedAt` + `deletedBy` + `deletionReason` in some models
- Only `isDeleted` in others
- No soft delete in some models

**Impact**:
- Recovery complexity varies
- Audit trail incomplete in some models
- Queries must remember to filter `isDeleted:false`

**Fix approach**:
1. Create soft-delete plugin
2. Apply consistently to all models
3. Add automatic `isDeleted` filtering in base queries
4. Document soft delete approach

## Unstructured/Undocumented Areas

### 1. Device Parser Adapters

**Issue**: Multiple device parsers but unclear which devices are supported

**Files**:
- `backend/services/deviceParsers/hfaVisualFieldParser.js`
- `backend/services/deviceParsers/solixOctParser.js`
- `backend/services/deviceParsers/tomeyParser.js`
- `backend/services/deviceParsers/tonorefParser.js`
- `backend/services/adapters/VisualFieldAdapter.js`

**Missing**:
- Device compatibility matrix
- Supported file formats per device
- Field mapping documentation
- Example output for each device
- Error handling for malformed device data

### 2. Template System Complexity

**Issue**: Multiple template systems may exist

**Files**:
- `backend/models/ConsultationTemplate.js`
- `backend/models/PathologyTemplate.js`
- `backend/models/SurgeryReport.js` (report templates)
- Prescription templates
- Document templates

**Missing**:
- Template composition/inheritance rules
- Which template system to use for what
- How templates are versioned
- Migration path for template changes

### 3. Convention/Insurance Billing Rules

**Issue**: Complex business logic for insurance billing scattered across multiple files

**Files**:
- `backend/models/ConventionFeeSchedule.js`
- `backend/services/conventionValidationService.js`
- `backend/controllers/companies/billingController.js` (294 lines of checks)
- Multiple approval workflows

**Missing**:
- Rules engine documentation
- Coverage determination algorithm
- Co-insurance/deductible calculation rules
- Denial reasons and appeals process

---

## Summary

**High Priority Fixes**:
1. Complete ConsultationSession → OphthalmologyExam migration (BLOCKER for data consistency)
2. Implement comprehensive error handling in 175+ async functions
3. Fix 199+ database operations without error handling
4. Ensure multi-clinic data isolation with integration tests
5. Implement financial audit trail for all invoice/payment changes

**Medium Priority**:
1. Refactor 10+ large controllers/services over 1500 lines
2. Consolidate 206 scripts into organized structure
3. Complete PHI encryption audit and fixes
4. Add test coverage for error paths
5. Implement data archival/retention policies

**Low Priority**:
1. Upgrade dependencies to latest versions
2. Standardize logging and error formats
3. Consolidate duplicate validation logic
4. Document undocumented areas (templates, device parsers)

---

*Concerns audit: 2025-01-25*
