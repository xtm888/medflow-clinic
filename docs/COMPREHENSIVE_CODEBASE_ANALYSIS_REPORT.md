# MEDFLOW/CAREVISION COMPREHENSIVE CODEBASE ANALYSIS

**Generated:** 2025-12-12
**Total Files Analyzed:** ~980 source files
**Analysis Method:** Deep parallel analysis with 10 specialized agents

---

## EXECUTIVE SUMMARY

MedFlow is a **comprehensive multi-clinic healthcare management system** specializing in ophthalmology. The codebase demonstrates professional healthcare software engineering with:

- **Backend:** Node.js/Express with MongoDB (Mongoose ODM)
- **Frontend:** React 18+ with Redux, Tailwind CSS, Vite
- **External Services:** Central sync server, OCR service (Python/FastAPI), Face recognition (Flask/DeepFace)
- **Real-time:** WebSocket for live updates
- **Offline-First:** IndexedDB with sync queue
- **Multi-Clinic:** Complete data isolation with central aggregation

### Key Statistics

| Category | Count | Details |
|----------|-------|---------|
| Backend Models | 83 | MongoDB schemas with Mongoose |
| Backend Controllers | 77 | 1200+ API endpoints |
| Backend Services | 71 | Business logic services |
| Backend Routes | 76 | 1200+ route definitions |
| Frontend Services | 84 | API wrappers + offline |
| Frontend Components | 107 | Reusable React components |
| Frontend Pages | 196 | Full page components |
| Backend Support Files | 152 | Middleware, utils, scripts |
| External Services | 47 | Central server, OCR, tests |
| **Test Files** | 32 | Unit, integration, service tests |
| **Database Indexes** | 72 | Across 9 collections |
| **Config/Deploy Files** | 15 | PM2, Docker, env configs |

---

## TABLE OF CONTENTS

1. [System Architecture](#1-system-architecture)
2. [Backend Analysis](#2-backend-analysis)
3. [Frontend Analysis](#3-frontend-analysis)
4. [External Services](#4-external-services)
5. [Security Analysis](#5-security-analysis)
6. [Critical Issues](#6-critical-issues)
7. [Recommendations](#7-recommendations)
8. [Test Coverage Analysis](#8-test-coverage-analysis)
9. [WebSocket Architecture](#9-websocket-architecture)
10. [Database Index Strategy](#10-database-index-strategy)
11. [Backup & Recovery](#11-backup--recovery)
12. [Deployment Configuration](#12-deployment-configuration)
13. [Redis Infrastructure](#13-redis-infrastructure)
14. [Error Handling](#14-error-handling)

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (React/Vite)                     │
│                    http://localhost:5173                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┼──────────────┐
         │         │              │
         ▼         ▼              ▼
    ┌────────────────────┐  ┌──────────────────┐
    │   MAIN BACKEND     │  │  FACE SERVICE    │
    │   Node.js/Express  │  │  Flask/DeepFace  │
    │  Port 5001         │  │  Port 5002       │
    └─────────┬──────────┘  └──────────────────┘
              │
              ├─────────────────────┬──────────────────┐
              │                     │                  │
              ▼                     ▼                  ▼
         ┌─────────────────┐  ┌──────────────────┐  ┌──────────┐
         │  CENTRAL SERVER │  │  OCR SERVICE     │  │ MongoDB  │
         │  Node.js        │  │  FastAPI/Python  │  │ Database │
         │  Port 5002      │  │  Port ~5003      │  │          │
         │  (Multi-clinic) │  │  (Document OCR)  │  └──────────┘
         └─────────────────┘  └──────────────────┘
```

### 1.2 Multi-Clinic Architecture

The system supports 4 clinic locations with data synchronization:
- DEPOT_CENTRAL (Hub) - 5 min sync
- TOMBALBAYE_KIN (Main) - 5 min sync
- MATRIX_KIN (Satellite) - 10 min sync
- MATADI_KC (Satellite) - 30 min sync

### 1.3 Database Architecture

**MongoDB Collections (83 models):**
- **Core:** Patient, Visit, Appointment, User, Company
- **Clinical:** OphthalmologyExam, OrthopticExam, Prescription, LabOrder
- **Financial:** Invoice, PaymentPlan, FeeSchedule, Approval
- **Inventory:** PharmacyInventory, FrameInventory, ContactLensInventory, ReagentInventory, IVTVial
- **Integration:** DeviceMeasurement, DeviceImage, LISIntegration

---

## 2. BACKEND ANALYSIS

### 2.1 Models (83 files)

**Key Patterns:**
- Multi-tenancy via `clinic` field with isolation
- Soft deletes with `deletedAt` timestamps
- Audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`
- PHI encryption for sensitive fields (AES-256-GCM)

**Critical Models:**

| Model | Purpose | Key Features |
|-------|---------|--------------|
| Patient | Core patient record | Convention billing, multi-source insurance |
| Invoice | Financial transactions | Multi-item, multi-payer, convention coverage |
| Visit | Clinical encounters | Status workflow, acts, diagnoses |
| OphthalmologyExam | Eye examinations | Comprehensive sections (VA, IOP, OCT, etc.) |
| Prescription | Medications/Optical | Drug safety integration, dispensing workflow |

### 2.2 Controllers (77 files, 400+ endpoints)

**Endpoint Categories:**
- Authentication & Users: 50+ endpoints
- Patient Management: 50+ endpoints
- Clinical Workflows: 100+ endpoints
- Billing & Financial: 100+ endpoints
- Inventory Management: 80+ endpoints
- Laboratory: 40+ endpoints
- Device Integration: 100+ endpoints

**Notable Controllers:**

| Controller | Endpoints | Key Features |
|------------|-----------|--------------|
| prescriptionController | 50+ | Drug safety, e-prescribing, prior auth |
| invoiceController | 30+ | Multi-currency, convention billing |
| queueController | 15+ | Real-time WebSocket updates |
| deviceController | 100+ | SMB share mounting, auto-sync |

### 2.3 Services (71 files)

**Critical Services:**

| Service | Purpose | Complexity |
|---------|---------|------------|
| drugSafetyService | Drug interactions, external API fallback | 200+ interactions |
| enhancedNotificationService | Multi-provider SMS with retry | High |
| DeviceIntegrationService | Unified device management | High |
| clinicalAlertService | Context-aware clinical alerts | Medium |
| coldChainService | IVT vial temperature monitoring | Medium |

**Scheduler Services (9):**
- alertScheduler, backupScheduler, reminderScheduler
- autoReorderService, clinicalAlertService
- labAutoVerificationService, westgardQCService

### 2.4 Routes (76 files, 700+ endpoints)

**HTTP Method Distribution:**
- GET: ~350+ endpoints (read operations)
- POST: ~150+ endpoints (create/action)
- PUT: ~100+ endpoints (update)
- DELETE: ~30 endpoints (soft-delete)
- PATCH: ~10 endpoints (partial update)

**Special Routes:**
- Public display board (rate-limited)
- Payment gateway webhooks (unauthenticated, signature-verified)
- Health check endpoints (Kubernetes probes)

### 2.5 Middleware Chain

```
Request → CORS → Helmet → RateLimit → Auth → ClinicContext → AuditLog → Route Handler
```

| Middleware | Purpose |
|------------|---------|
| auth.js | JWT validation, session management, 2FA |
| auditLogger.js | HIPAA-compliant logging, PHI redaction |
| rateLimiter.js | Redis-backed, per-endpoint limits |
| clinicAuth.js | Multi-clinic context injection |
| fileUpload.js | Secure file handling, DICOM support |

---

## 3. FRONTEND ANALYSIS

### 3.1 Services (85 files)

**Architecture:** Offline-first with Dexie.js (IndexedDB)

**Key Services:**

| Service | Purpose | Offline Support |
|---------|---------|-----------------|
| patientService | Patient CRUD | Full |
| visitService | Visit management | Full |
| prescriptionService | Prescriptions | Medication: Online only |
| billingService | Invoicing/payments | Cash: Full, Card: Online |
| ophthalmologyService | Eye exams | Full |

**Caching Strategy:**
- Patient list: 1 hour
- Single patient: 30 minutes
- Appointments: 5 minutes
- Fee schedule: 24 hours

### 3.2 Components (107 files)

**Categories:**
- Core UI: Modals, spinners, error boundaries (22 files)
- Patient Management: Registration, selection, preview (7 files)
- Clinical: Medication entry, prescription safety (10 files)
- Imaging/Device: Image viewer, measurement selector (4 files)
- Financial: Multi-currency payment, currency converter (3 files)
- Offline: Indicators, sync status, conflict resolution (6 files)

**Notable Components:**

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| MedicationEntryForm | Drug entry | Tapering, route selection, eye-specific |
| DeviceImageViewer | Medical image viewer | Zoom, annotations, DICOM metadata |
| MultiCurrencyPayment | Payment processing | CDF/USD/EUR, multiple methods |
| ConflictResolver | Sync conflicts | Three-way merge support |

### 3.3 Pages (196 files)

**Major Page Categories:**
- Dashboard & Auth: 6 pages
- Patient Management: 7 pages
- Appointments: 6 pages
- Queue Management: 7 pages
- Clinical Workflows: 25+ pages
- Billing/Financial: 14 pages
- Inventory: 8 pages
- Surgery/IVT: 9 pages
- Settings/Admin: 13 pages

### 3.4 State Management

**Architecture:** Redux + Context + Custom Hooks

| Layer | Purpose | Persistence |
|-------|---------|-------------|
| Redux Store | Global state | Auth/UI persisted |
| Contexts (5) | Scoped state | Memory |
| Custom Hooks (17) | Data fetching | Cache + IndexedDB |

**Redux Slices:**
- authSlice, patientSlice, appointmentSlice
- visitSlice, queueSlice, notificationSlice

**Contexts:**
- AuthContext, ClinicContext, PatientContext
- PatientCacheContext, HistoryContext

### 3.5 Real-time Features

**WebSocket Events:**
- Queue updates (check-in, call, complete)
- Appointment changes (create, cancel, confirm)
- Lab results (ready, critical alerts)
- Billing updates (invoice, payment)

---

## 4. EXTERNAL SERVICES

### 4.1 Central Sync Server

**Purpose:** Multi-clinic data aggregation and synchronization

**Features:**
- Bidirectional sync (push/pull)
- Cross-clinic patient search
- Consolidated financial reports
- Inventory transfer recommendations

**Models:**
- CentralPatient, CentralVisit, CentralInvoice
- CentralInventory, ClinicRegistry

### 4.2 OCR Service (Python/FastAPI)

**Purpose:** Extract patient info from medical imaging files

**Features:**
- PaddleOCR (French language)
- PDF, DICOM, image support
- Celery async processing
- Patient matching with confidence scores

**Supported Devices:**
- ZEISS retinal imaging
- Solix OCT
- TOMEY devices

### 4.3 Face Recognition Service (Flask)

**Purpose:** Biometric patient identification

**Features:**
- DeepFace/Facenet embeddings
- Duplicate detection during registration
- Identity verification for record access
- 128-dimensional face encoding

---

## 5. SECURITY ANALYSIS

### 5.1 Authentication

| Feature | Implementation |
|---------|----------------|
| JWT Tokens | HS256, 15-min access, 30-day refresh (default) |
| Password Policy | 12+ chars, 4 types, weak pattern detection |
| 2FA | TOTP with backup codes, replay prevention |
| Session Management | Redis-backed, timeout enforcement |

### 5.2 Authorization

| Level | Implementation |
|-------|----------------|
| Role-Based | 13 system roles (admin, doctor, ophthalmologist, nurse, receptionist, pharmacist, lab_technician, accountant, manager, technician, orthoptist, optometrist, radiologist) |
| Permission-Based | Database-driven, cacheable |
| Clinic Isolation | Middleware-enforced data filtering |
| Resource Ownership | Ownership checks per resource |

### 5.3 Data Protection

| Protection | Implementation |
|------------|----------------|
| PHI Encryption | AES-256-GCM, field-level |
| Input Validation | Express-validator + Joi schemas |
| NoSQL Injection | Regex escaping, $ operator filtering |
| Command Injection | execFile + array args (no shell) |
| File Upload | Type validation, size limits, path protection |

### 5.4 Audit Logging

- Automatic sensitive data redaction
- Request/response logging with timing
- Patient data access logging (HIPAA)
- Critical operation alerts
- 7-year retention for medical records

---

## 6. CRITICAL ISSUES

### 6.1 High Priority

| Issue | Location | Risk | Impact |
|-------|----------|------|--------|
| Float arithmetic for money | invoiceController.js | HIGH | Financial miscalculation |
| 2FA codes in-memory | auth.js:454 | HIGH | Lost on restart |
| Token in localStorage | authService.js | HIGH | XSS vulnerability |
| Manual conflict resolution | syncService.js | MEDIUM | Stuck data |
| **Port collision bug** | face-service/Dockerfile:35 | HIGH | Service conflict |

**Port Collision Detail:** Face service Dockerfile exposes port 5001 (same as main backend). PM2 config correctly uses 5002, but Docker deployments will fail. The Dockerfile EXPOSE directive must be changed from 5001 to 5002.

**Token Expiry Mismatch:** `constants.js` defines `REFRESH_TOKEN_EXPIRY_DAYS: 7` but `User.js:337` uses `'30d'` as default. The constants file is not being used for token generation, causing configuration drift.

### 6.2 Medium Priority

| Issue | Location | Risk |
|-------|----------|------|
| No visit locking | visitService.js | Data tampering |
| Exchange rates 1hr cache | billingService.js | Financial variance |
| Large components (>300 lines) | Dashboard, Queue pages | Maintainability |
| Missing TypeScript | Entire frontend | Runtime errors |

### 6.3 Technical Debt

| Issue | Scope | Effort |
|-------|-------|--------|
| State duplication (Context + Redux) | Frontend | 2 weeks |
| Service consolidation (84 → 40) | Frontend | 3 weeks |
| Test coverage gaps | Backend/Frontend | 4 weeks |
| IndexedDB TTL cleanup | Frontend | 1 week |

---

## 7. RECOMMENDATIONS

### 7.1 Security (Immediate)

1. **Switch to HttpOnly cookies** for JWT storage
2. **Move 2FA codes to Redis** for distributed systems
3. **Use Decimal.js** for all financial calculations
4. **Implement CSRF protection** for state-changing requests
5. **Add request signing** for critical operations

### 7.2 Architecture (Short-term)

1. **Consolidate state management** - Single source of truth
2. **Implement optimistic locking** - Version fields on entities
3. **Add visit locking** - Prevent concurrent edits
4. **Optimize sync strategy** - Delta sync, per-entity tracking

### 7.3 Performance (Medium-term)

1. **Add virtualization** for large lists (queue, patients)
2. **Implement RTK Query** for data fetching
3. **Add database indexes** for common queries
4. **Implement query pagination** everywhere

### 7.4 Operations (Long-term)

1. **Add comprehensive test coverage** (70%+ target)
2. **Migrate to TypeScript** for type safety
3. **Implement API versioning** for backward compatibility
4. **Add circuit breakers** for external services

---

## 8. TEST COVERAGE ANALYSIS

### 8.1 Test Infrastructure

| Framework | Location | Purpose |
|-----------|----------|---------|
| Jest | Backend | Unit & Integration tests |
| Vitest | Frontend | Unit & Integration tests |
| Supertest | Backend | API integration testing |
| Testing Library | Frontend | Component testing |
| mongodb-memory-server | Backend | In-memory DB for tests |

### 8.2 Backend Test Coverage

**Test Files Found: 11 files**

| Category | Files | Test Cases |
|----------|-------|------------|
| Unit Tests | 7 | ~50+ |
| Integration Tests | 3 | ~30+ |
| Service Tests | 1 | ~10+ |

**Covered Areas:**
- `invoiceCalculations.test.js` - 15+ test cases (basic calculations, convention coverage, payments, discounts, taxes, multi-currency)
- `prescriptionValidation.test.js` - Drug safety validation
- `queueManagement.test.js` - Queue operations
- `patientLookup.test.js` - Patient search
- `apiResponse.test.js` - Response formatting
- `envValidator.test.js` - Environment validation
- `patients.test.js` (integration) - Full CRUD workflow
- `appointments.test.js` (integration) - Appointment lifecycle
- `queue.test.js` (integration) - Queue management

### 8.3 Frontend Test Coverage

**Test Files Found: 21 files**

| Category | Files | Purpose |
|----------|-------|---------|
| Service Tests | 17 | API wrapper testing |
| Integration Tests | 2 | Offline workflow |
| Utility Tests | 2 | Logger, encryption |

**Key Test Suites:**
- `offlineWorkflow.test.js` - Complete online→offline→sync cycle (660+ lines)
- `offlineIntegration.test.js` - Deep offline integration
- `syncService.test.js` - Sync queue management
- `visitService.test.js` - Visit CRUD + offline
- Multiple inventory services (pharmacy, frames, contact lens, reagent)

### 8.4 Test Coverage Gaps

| Area | Current | Target | Risk |
|------|---------|--------|------|
| Backend Controllers | ~20% | 70% | HIGH |
| Backend Services | ~15% | 70% | HIGH |
| Frontend Components | ~5% | 60% | MEDIUM |
| Frontend Pages | ~0% | 40% | MEDIUM |
| E2E Tests | 0% | 30% | HIGH |

**Critical Untested Areas:**
- Invoice generation and payment processing
- Prescription safety checks (backend)
- Authentication flow (login, 2FA, refresh)
- WebSocket event handling
- Device integration workflows

---

## 9. WEBSOCKET ARCHITECTURE

### 9.1 Implementation Details

**File:** `backend/services/websocketService.js` (875 lines)

**Core Features:**
```javascript
// Configuration
MESSAGE_BUFFER_MAX_AGE: 15 * 60 * 1000   // 15 minutes
MESSAGE_BUFFER_MAX_SIZE: 100              // per room
MAX_CONNECTION_ERRORS: 5                  // before disconnect
HEALTH_CHECK_INTERVAL: 30 * 1000          // 30 seconds
```

### 9.2 Event Types

| Category | Events | Direction |
|----------|--------|-----------|
| Queue | queue_update, queue_call, queue_complete | Server→Client |
| Patient | patient_update, patient_create | Bidirectional |
| Appointment | appointment_create, appointment_update, appointment_cancel | Bidirectional |
| Billing | billing_update, invoice_paid, payment_received | Server→Client |
| Lab | lab_results, critical_alert | Server→Client |
| System | user_joined, user_left, error | Server→Client |

### 9.3 Advanced Features

**Message Replay Buffer:**
- Per-room buffer storing last 100 messages
- 15-minute max age for replay eligibility
- Automatic cleanup on message overflow

**User-Specific Buffering:**
- Messages buffered for disconnected users
- Delivered on reconnection
- Prevents data loss during network issues

**Connection Health Monitoring:**
```javascript
connectionHealth: {
  errors: 0,
  lastActivity: timestamp,
  status: 'healthy' | 'warning' | 'unhealthy'
}
```

**Graceful Shutdown:**
- Broadcasts shutdown notification to all clients
- 5-second timeout for connection cleanup
- Statistics logging before termination

### 9.4 Room Structure

```
clinic:{clinicId}           // Clinic-wide broadcasts
department:{dept}:{clinic}  // Department-specific
user:{userId}               // Private messages
patient:{patientId}         // Patient-specific updates
```

---

## 10. DATABASE INDEX STRATEGY

### 10.1 Index Summary

**Total Indexes: 72 across 9 collections**

| Collection | Indexes | Key Patterns |
|------------|---------|--------------|
| patients | 8 | patientId (unique), name search, clinic+date |
| visits | 11 | visitId (unique), patient+date, status, provider |
| appointments | 10 | appointmentId (unique), provider+date+status, queue |
| prescriptions | 8 | prescriptionId (unique), patient+date, pharmacy status |
| invoices | 12 | invoiceId (unique), patient+status, payment tracking |
| users | 6 | email (unique), role, clinic |
| pharmacyinventories | 7 | drug names, stock levels, expiry |
| ophthalmologyexams | 4 | patient+date, visit, provider |
| auditlogs | 6 | user+time, action+time, TTL (7 years) |

### 10.2 Text Indexes

**Patient Search:**
```javascript
{
  firstName: 'text',
  lastName: 'text',
  patientId: 'text'
}
// Weights: patientId(10), lastName(5), firstName(3)
```

### 10.3 TTL Indexes

**Audit Log Retention:**
```javascript
{ createdAt: 1 }
{ expireAfterSeconds: 7 * 365 * 24 * 60 * 60 } // 7 years
```

### 10.4 Compound Indexes for Performance

```javascript
// Visit queries
{ patient: 1, status: 1, visitDate: -1 }
{ primaryProvider: 1, status: 1, visitDate: -1 }
{ clinic: 1, status: 1, visitDate: -1 }

// Appointment queries
{ date: 1, status: 1, department: 1 }
{ date: 1, status: 1, queueNumber: 1 }
{ status: 1, date: 1, priority: 1 }

// Invoice queries
{ patient: 1, paymentStatus: 1, dateIssued: -1 }
{ status: 1, paymentStatus: 1, dateIssued: -1 }
{ dueDate: 1, paymentStatus: 1 }
```

---

## 11. BACKUP & RECOVERY

### 11.1 Backup Schedule

**File:** `backend/services/backupScheduler.js` (237 lines)

| Frequency | Schedule | Retention |
|-----------|----------|-----------|
| Daily | 2:00 AM | 30 backups |
| Monthly | 1st at 3:00 AM | 12 backups |
| Yearly | Jan 1st at 4:00 AM | 7 backups |

### 11.2 Backup Features

- **Encryption:** AES-256 for backup files
- **Compression:** gzip before encryption
- **Validation:** Checksum verification
- **Cloud sync:** Optional S3/cloud storage

### 11.3 Notification System

| Event | Channels | Recipients |
|-------|----------|------------|
| Backup Success | Email | Admin |
| Backup Failure | Email + SMS | Admin + On-call |
| Storage Warning | Email | Admin |
| Restore Complete | Email | Requesting user |

### 11.4 Recovery Procedures

1. **Point-in-time recovery** via MongoDB oplog
2. **Full restore** from encrypted backup
3. **Collection-level restore** for targeted recovery
4. **Cross-clinic restore** via central server

---

## 12. DEPLOYMENT CONFIGURATION

### 12.1 PM2 Configuration

**File:** `ecosystem.config.js`

| Service | Port | Memory Limit | Workers |
|---------|------|--------------|---------|
| medflow-backend | 5001 | 500MB | 1 (fork) |
| medflow-face-service | 5002 | 300MB | 2 (gunicorn) |

### 12.2 Service Architecture

```
Production Deployment:
┌─────────────────────────────────────────────────────────────┐
│ PM2 Process Manager                                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│ medflow-backend │ face-service    │ (OCR via Docker)        │
│ Node.js :5001   │ Gunicorn :5002  │ FastAPI :5003           │
│ 500MB limit     │ 300MB limit     │ Celery workers: 2       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### 12.3 Docker Configuration

**OCR Service** (`ocr-service/docker-compose.yml`):
```yaml
services:
  ocr-api:     # FastAPI on :5003
  celery:      # Worker, concurrency=2
  redis:       # Queue on :6380 (avoids conflict)
```

**Face Service** (`face-service/Dockerfile`):
- Python 3.10-slim base
- Non-root user (security)
- Health check: `/health` endpoint
- **BUG:** EXPOSE 5001 should be 5002

### 12.4 Environment Configuration

**Required Secrets (12):**
```
JWT_SECRET              # Access token signing
REFRESH_TOKEN_SECRET    # Refresh token signing
SESSION_SECRET          # Express session
ENCRYPTION_KEY          # General encryption
BACKUP_ENCRYPTION_KEY   # Backup encryption
CALENDAR_ENCRYPTION_KEY # Calendar data
LIS_ENCRYPTION_KEY      # Lab integration
PHI_ENCRYPTION_KEY      # Patient health info
HEALTH_API_KEY          # Health endpoints
```

**Critical Settings:**
- `NODE_ENV=production`
- `BACKUP_ENABLED=true`
- `SYNC_ENABLED=false` (default, enable for multi-clinic)

---

## 13. REDIS INFRASTRUCTURE

### 13.1 Redis Usage

**File:** `backend/config/redis.js` (373 lines)

| Feature | Purpose | Fallback |
|---------|---------|----------|
| Session Store | User sessions | In-memory Map |
| Cache | Query results | In-memory LRU |
| Rate Limiter | Request throttling | In-memory counter |
| 2FA Codes | TOTP storage | In-memory Map (⚠️) |
| Message Queue | Background jobs | Not implemented |

### 13.2 Reconnection Strategy

```javascript
reconnectStrategy: (retries) => {
  if (retries > 10) return false; // Give up
  return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
}
```

### 13.3 Cache Configuration

| Data Type | TTL | Purpose |
|-----------|-----|---------|
| User sessions | 7 days | Authentication |
| Patient cache | 30 min | Quick lookup |
| Fee schedules | 24 hours | Billing |
| Rate limit counters | 1-15 min | Per endpoint |

### 13.4 Fallback Behavior

When Redis is unavailable:
- **Sessions:** Memory-backed Map (not distributed)
- **Cache:** In-memory LRU (per-instance only)
- **Rate limiting:** Per-instance counters (⚠️ can be bypassed)

**Production Warning:** Without Redis, rate limiting and session management are not distributed across instances.

---

## 14. ERROR HANDLING

### 14.1 Error Handler Middleware

**File:** `backend/middleware/errorHandler.js` (220 lines)

### 14.2 Error Types Handled

| Error Type | HTTP Status | Handling |
|------------|-------------|----------|
| CastError (MongoDB) | 404 | "Resource not found" |
| Duplicate Key (11000) | 400 | Field-specific message |
| ValidationError | 400 | Aggregated field errors |
| JsonWebTokenError | 401 | "Invalid token" |
| TokenExpiredError | 401 | "Token expired" |
| LIMIT_FILE_SIZE | 400 | "File too large" |
| Rate limit (429) | 429 | "Too many requests" |

### 14.3 Custom Error Classes

```javascript
BadRequestError(400)
UnauthorizedError(401)
ForbiddenError(403)
NotFoundError(404)
ConflictError(409)
ValidationError(422)
InternalServerError(500)
```

### 14.4 Security Error Handling

**Detected Attack Types:**
- XSS attempts
- SQL injection (logged despite NoSQL)
- Path traversal
- CSRF violations
- Unauthorized access

**Response:** All security violations are:
1. Logged to AuditLog with `threatLevel: 'high'`
2. Return generic 403 (no information disclosure)
3. Include IP, user agent, user ID for investigation

### 14.5 Async Handler Pattern

```javascript
exports.asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

All route handlers wrapped to ensure unhandled rejections flow to error middleware.

---

## APPENDIX A: API ENDPOINT SUMMARY

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/verify-2fa
POST /api/auth/forgot-password
PUT  /api/auth/reset-password/:token
```

### Patients
```
GET    /api/patients
POST   /api/patients
GET    /api/patients/:id
PUT    /api/patients/:id
DELETE /api/patients/:id
GET    /api/patients/:id/history
GET    /api/patients/:id/appointments
GET    /api/patients/:id/prescriptions
GET    /api/patients/:id/visits
GET    /api/patients/:id/billing
```

### Visits
```
GET    /api/visits
POST   /api/visits
GET    /api/visits/:id
PUT    /api/visits/:id
PUT    /api/visits/:id/complete
PUT    /api/visits/:id/sign
PUT    /api/visits/:id/lock
POST   /api/visits/:id/acts
POST   /api/visits/:id/invoice
```

### Invoicing
```
GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/:id
PUT    /api/invoices/:id
POST   /api/invoices/:id/payments
POST   /api/invoices/:id/refund
POST   /api/invoices/:id/apply-discount
```

---

## APPENDIX B: DATABASE SCHEMA RELATIONSHIPS

```
Patient
├── Visits (1:N)
│   ├── OphthalmologyExam (1:1)
│   ├── Prescriptions (1:N)
│   ├── LabOrders (1:N)
│   └── Invoice (1:1)
├── Appointments (1:N)
├── Approvals (1:N)
└── Documents (1:N)

Invoice
├── Items (embedded)
├── Payments (embedded)
├── Company (reference)
└── Approvals (references)

Inventory (Abstract)
├── PharmacyInventory
├── FrameInventory
├── ContactLensInventory
├── ReagentInventory
└── LabConsumableInventory
```

---

## APPENDIX C: OFFLINE CAPABILITY MATRIX

| Feature | Read | Create | Update | Delete |
|---------|------|--------|--------|--------|
| Patients | ✓ | ✓ | ✓ | ✓ |
| Appointments | ✓ | ✓ | ✓ | ✓ |
| Visits | ✓ | ✓ | ✓ | - |
| Optical Rx | ✓ | ✓ | ✓ | ✓ |
| Medication Rx | ✓ | - | - | - |
| Cash Payments | ✓ | ✓ | - | - |
| Card Payments | - | - | - | - |
| Lab Orders | ✓ | ✓ | ✓ | - |
| Ophthalmology | ✓ | ✓ | ✓ | - |

---

## APPENDIX D: ROLE PERMISSIONS

| Role | Patients | Visits | Invoices | Inventory | Admin |
|------|----------|--------|----------|-----------|-------|
| admin | Full | Full | Full | Full | Full |
| manager | Full | Full | Full | Full | Partial |
| doctor | Read/Edit | Full | View | - | - |
| ophthalmologist | Read/Edit | Full | View | - | - |
| optometrist | Read/Edit | Full | View | Optical | - |
| orthoptist | Read/Edit | Read/Add | View | - | - |
| nurse | Read/Edit | Read/Add | - | - | - |
| receptionist | Full | Create | Create/View | - | - |
| pharmacist | Read | - | Meds only | Full | - |
| accountant | Read | - | Full | - | - |
| technician | Read | Read | - | Equipment | - |
| radiologist | Read | Read/Add | View | - | - |
| lab_technician | Read | - | Lab only | Lab | - |

---

## APPENDIX E: NO CI/CD CONFIGURATION

**Finding:** No CI/CD workflows found in project root `.github/workflows/`

**Impact:**
- No automated testing on pull requests
- No automated deployment pipeline
- Manual deployment via PM2 required

**Recommendation:** Implement GitHub Actions for:
1. Test execution on PR
2. Linting and type checking
3. Security scanning (npm audit)
4. Docker image building
5. Staging/production deployments

---

**Report Generated:** 2025-12-12
**Report Updated:** 2025-12-12 (Gap Analysis)
**Analysis Agents:** 10 parallel agents + gap analysis
**Total Analysis Time:** ~20 minutes
**Files Analyzed:** ~1,010 source files (including tests, configs, deployment)
