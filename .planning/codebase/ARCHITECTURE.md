# Architecture

**Analysis Date:** 2026-01-25

## Pattern Overview

**Overall:** Layered MVC architecture with domain-driven services and microservices for specialized tasks

**Key Characteristics:**
- Three-tier vertical layering: HTTP routes → controllers → services → data models
- Modular controllers grouped by domain (patients, ophthalmology, invoices, etc)
- Centralized business logic in specialized service classes
- Multi-clinic context isolation enforced at middleware level
- Horizontal separation by responsibility: clinics, inventory, billing, clinical domains
- Microservices for AI/ML: Python-based face recognition and OCR services
- Centralized server for multi-clinic data synchronization

## Layers

**HTTP & Routing Layer:**
- Purpose: Parse requests, apply middleware, route to controllers
- Location: `backend/routes/` (88 route files)
- Contains: Express Router definitions with security middleware (auth, clinic validation, CSRF, rate limiting)
- Depends on: Middleware stack, controllers
- Used by: Frontend client, third-party integrations

**Middleware Layer:**
- Purpose: Cross-cutting concerns (auth, validation, logging, rate limiting, security)
- Location: `backend/middleware/` (18 files)
- Contains: Authentication (JWT with refresh tokens), clinic context verification, audit logging, error handling, rate limiting by endpoint type
- Key middleware:
  - `auth.js`: JWT validation with token revocation checking via Redis
  - `clinicAuth.js`: Multi-clinic context enforcement
  - `auditLogger.js`: Sensitive operation logging
  - `rateLimiter.js`: Tiered rate limiting (auth, sensitive, reports, search)
  - `csrf.js`: CSRF token validation
  - `errorHandler.js`: Unified error response formatting
- Depends on: Redis, User models, config
- Used by: All routes

**Controller Layer:**
- Purpose: Handle request/response, orchestrate business logic, validate inputs
- Location: `backend/controllers/` (59 controller files, many organized in subdirectories)
- Contains: Request parsing, response building, delegation to services
- Structure: Controllers often split by responsibility (e.g., `patients/coreController.js`, `patients/advancedController.js`)
- Key controllers:
  - `patients/coreController.js`: CRUD, search, basic operations
  - `patients/advancedController.js`: Complex queries, analytics
  - `invoices/billingController.js`: Payment processing
  - `invoices/paymentController.js`: Payment lifecycle
  - `ophthalmology/coreController.js`: Exam CRUD
  - `ophthalmology/clinicalTestsController.js`: Specialized tests
- Depends on: Services, middleware helpers, request validation
- Used by: Routes

**Service Layer:**
- Purpose: Encapsulate business logic, state management, orchestration
- Location: `backend/services/` (97+ service files in flat and nested structure)
- Contains: Domain-specific logic, integrations, state machines, calculations
- Key service categories:
  - **Data Services** (>60): Inventory, patient, appointment, lab, pharmacy, billing operations
  - **Domain Services** (`domain/`): Cross-domain orchestration (BillingService, SurgeryService)
  - **Integration Services**: Device sync, PACS, CareVision bridge, DMI client, SMS/email
  - **Device Parsers** (`deviceParsers/`): Parse device output (OCT, visual field, tonometry)
  - **Adapters** (`adapters/`): Standardize device data (VisualFieldAdapter)
  - **Schedulers**: Background jobs (alerts, device sync, backup, calendar, payment plans)
  - **Real-time**: WebSocket service for live updates (queue, alerts, device data)
- Depends on: Models, config, utilities, external APIs
- Used by: Controllers, other services, scheduled jobs

**Data Model Layer:**
- Purpose: Define schema, validation, relationships, persistence
- Location: `backend/models/` (90+ Mongoose schemas)
- Contains: Schema definitions with validation, indexes, hooks, instance/static methods
- Key models:
  - **Clinical**: Patient, OphthalmologyExam, Prescription, Surgery, IVTInjection
  - **Operational**: Appointment, Clinic, Room, Queue, Device
  - **Inventory**: Inventory, InventoryTransaction, InventoryTransfer, GlassesOrder
  - **Financial**: Invoice, Payment, ConventionFeeSchedule, InsuranceClaim
  - **Infrastructure**: User, AuditLog, Device, ConsultationSession, Alert
- Features: Soft delete pattern (isDeleted, deletedAt), clinic context on all, timestamps
- Depends on: Mongoose, validation utils, encryption utilities
- Used by: Services, controllers, migrations

**Utility Layer:**
- Purpose: Reusable helpers and common functionality
- Location: `backend/utils/` (24 files)
- Contains: Financial validation, PHI encryption, token handling, transactions, pagination, loggers
- Key utilities:
  - `phiEncryption.js`: Encrypt/decrypt sensitive patient data
  - `financialValidation.js`: Multi-currency validation, fraud detection
  - `tokenUtils.js`: JWT generation and refresh logic
  - `migrationTransaction.js`: MongoDB session handling for ACID-like transactions
  - `structuredLogger.js`: Context-aware logging for debugging
  - `apiResponse.js`: Standardized response formatting
  - `mongoConnection.js`: Database connection management
- Depends on: Config, models (for logging)
- Used by: Services, controllers, models

## Data Flow

**User Request Flow:**

1. **Client Request** → Browser/API client sends HTTP request
2. **Middleware Chain** → Auth (verify JWT) → Clinic context (scope to clinic) → Validation (body/query)
3. **Route Handler** → Express router matches path, calls controller
4. **Controller** → Validates input, calls appropriate service method(s), formats response
5. **Service** → Executes business logic, may call multiple services, models, utilities
6. **Data Layer** → Mongoose queries MongoDB, applies hooks (pre/post), returns document
7. **Response** → Service returns result to controller → Controller formats as JSON → Middleware (audit log if needed) → HTTP response
8. **WebSocket Notification** (optional) → Service emits via websocketService if real-time update needed

**Example: Create Invoice Payment**

1. POST `/api/invoices/:id/payments`
2. Middleware validates JWT, checks clinic ownership of invoice
3. `invoices/paymentController.invoicePayment()` extracts amount, method, date
4. Calls `BillingService.processPayment(invoiceId, paymentData, userId)`
5. BillingService:
   - Loads Invoice via Mongoose
   - Validates amount (CDF/USD/EUR)
   - Calls `invoice.addPayment()` instance method
   - Invoice model increments `payments` array, updates `summary.amountDue`
   - If 100% paid on an item, triggers `SurgeryService` to create surgery case
   - Calls `websocketService.emit('payment:recorded')` for real-time UI update
   - Returns updated invoice
6. Controller returns payment details
7. Audit logger records transaction (user, clinic, amount, timestamp)

**State Management (Frontend):**

1. React component uses Redux for auth/clinic context
2. API service calls backend endpoint
3. Response cached via React Query (server state)
4. Component local state (useState) for form/UI state
5. WebSocket listener updates UI when backend events fire (via useWebSocketEvent hook)
6. Dexie IndexedDB stores offline data for sync later

## Key Abstractions

**Clinic Context:**
- Purpose: Enforce data isolation across multi-clinic deployments
- Examples: `backend/middleware/clinicAuth.js`, `backend/utils/clinicFilter.js`
- Pattern: Every query decorated with `{ clinic: req.user.currentClinicId }` or equivalent
- Enforced at: Middleware level via `clinicVerification.verifyClinicOwnership()`

**Service Orchestration:**
- Purpose: Handle complex workflows involving multiple models/services
- Examples: `backend/services/domain/BillingService.js`, `backend/services/domain/SurgeryService.js`
- Pattern: Class with async methods that coordinate lower-level services
- Usage: Controllers call domain service, domain service calls multiple utility services, updates multiple models

**Device Integration Adapter:**
- Purpose: Standardize different device outputs (OCT, tonometer, refractor, visual field)
- Examples: `backend/services/adapters/VisualFieldAdapter.js`, parser files in `backend/services/deviceParsers/`
- Pattern: Adapter reads device-specific format → normalizes to exam measurement object
- Flow: Device exports file → Sync service detects → Parser reads format → Adapter normalizes → Updates OphthalmologyExam

**Soft Delete Pattern:**
- Purpose: Preserve audit trail, allow restoration, prevent cascade issues
- Pattern: Model has `isDeleted: Boolean`, `deletedAt: Date` fields
- Queries automatically filter: `{ isDeleted: { $ne: true } }` via Mongoose middleware
- Explicit restore via `restorePatient()` or service method

**Pagination Service:**
- Purpose: Standardize list endpoint pagination
- Example: `backend/services/paginationService.js`
- Pattern: Extract `page`, `limit`, `sort` from query → Calculate offset → Apply to Mongoose → Return with total count
- Used in: All list endpoints (getPatients, getInvoices, getAppointments, etc)

**WebSocket Event Broadcast:**
- Purpose: Push updates to connected clients in real-time
- Examples: `backend/services/websocketService.js`
- Pattern: Service emits event on state change → WebSocket broadcasts to room (clinic, queue, patient) → Frontend listeners update UI
- Events: `payment:recorded`, `queue:updated`, `device:data_ready`, `consultation:completed`

## Entry Points

**Backend Server:**
- Location: `backend/server.js`
- Triggers: Node process start
- Responsibilities:
  - Load environment, validate secrets
  - Initialize database connection (MongoDB)
  - Initialize Redis (sessions, caching, token revocation)
  - Spin up Express app
  - Register all 88 route modules
  - Start background schedulers (alerts, device sync, backups)
  - Create HTTP/WebSocket server
  - Bind to port (default 5000)

**Frontend App:**
- Location: `frontend/src/main.jsx`
- Entry: Renders App.jsx root component
- Responsibilities:
  - Initialize Sentry error tracking
  - Create React root
  - Wrap with Redux provider and persistence
  - Wrap with auth/clinic/patient context providers
  - Initialize React Router with lazy-loaded pages

**Frontend Router:**
- Location: `frontend/src/App.jsx`
- Responsibilities:
  - Define all routes and their components
  - Apply route guards (ProtectedRoute, RoleGuard)
  - Lazy load 80+ pages for code splitting
  - Handle authentication redirect
  - Show loading spinner while code splitting
  - Global error boundary wrapping

**Central Server:**
- Location: `central-server/server.js`
- Triggers: Separate Node process on coordinator machine
- Responsibilities:
  - Sync inventory data across clinics
  - Aggregate financial reports
  - Consolidate patient data
  - Coordinate multi-clinic operations

**Microservices:**
- **Face Service**: `face-service/app.py` (FastAPI) - Face recognition, duplicate detection
- **OCR Service**: `ocr-service/app/main.py` (FastAPI + Celery) - Document text extraction, form field detection

## Error Handling

**Strategy:** Centralized error handler with structured logging and user-friendly messages

**Patterns:**
- Backend: Controllers wrap in `asyncHandler()` → Errors thrown → Caught by global error handler → Formatted response
- Frontend: Try/catch in API services → Toast notifications (react-toastify) → Retry logic in some services
- Logging: Context-aware logger (structuredLogger.js) includes user, clinic, resource IDs
- Audit: Sensitive errors logged to AuditLog for compliance

**Error Response Format:**
```javascript
{
  success: false,
  error: 'User-friendly message',
  code: 'ERROR_CODE', // Machine-readable
  details: { ...context }, // Only in dev/non-production
  timestamp: '2026-01-25T12:00:00Z'
}
```

## Cross-Cutting Concerns

**Logging:**
- Implementation: `backend/config/logger.js`, `backend/utils/structuredLogger.js`
- Approach: Winston logger with context (user, clinic, resource IDs)
- Usage: Services call `log.info()`, `log.error()` with structured data

**Validation:**
- Implementation: Express-validator at route level, Mongoose schema validation
- Approach: Request body validated before reaching controller, Yup on frontend
- Pattern: Validation middleware applies sanitization and type checking

**Authentication:**
- Implementation: JWT (access + refresh token), Redis session store, 2FA support (speakeasy)
- Approach: Middleware verifies token, checks revocation list, validates session
- Flow: Login → Issue access token (15 min) + refresh token (30 days) → Refresh on expiry → Logout revokes tokens

**Multi-Clinic Isolation:**
- Implementation: Middleware decorates query with clinic context
- Approach: Verify user.currentClinicId, scope all queries to clinic
- Enforcement: Pre-save hooks, query filters, controller checks
- Fallback: Users can see cross-clinic data if explicitly allowed (e.g., reports)

**Audit Logging:**
- Implementation: AuditLog model + middleware + service calls
- Approach: Auto-log via middleware for sensitive routes, manual for custom operations
- Tracked: Patient access, financial transactions, configuration changes, user actions

**Rate Limiting:**
- Implementation: Redis-backed rate limiter with tiered configs
- Approach: Different limits per endpoint type (auth stricter, search more lenient)
- Enforcement: Middleware rejects with 429 if limit exceeded

---

*Architecture analysis: 2026-01-25*
