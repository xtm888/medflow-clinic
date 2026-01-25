# Codebase Structure

**Analysis Date:** 2026-01-25

## Directory Layout

```
/Users/xtm888/magloire/
├── backend/                        # Node.js Express API server (main application logic)
├── frontend/                       # React Vite SPA client
├── central-server/                 # Multi-clinic coordination server
├── face-service/                   # Python FastAPI microservice (face recognition)
├── ocr-service/                    # Python FastAPI + Celery (document OCR/extraction)
├── dicom-bridge/                   # DICOM imaging integration service
├── tests/                          # E2E and integration test suites (Playwright)
├── docs/                           # Project documentation (architecture, procedures, guides)
├── local-multisite/                # Local multi-clinic development configs
├── scripts/                        # Root-level automation scripts
├── .planning/                      # GSD phase tracking and codebase analysis
├── models/                         # Shared data models and schemas
└── uploads/                        # User-generated files (photos, documents, tryons)
```

## Directory Purposes

**Backend (`backend/`):**
- Purpose: REST API, business logic, database models, background jobs
- Contains: Node.js/Express application with MongoDB, Redis integration
- Key subdirectories:
  - `routes/` (88 files): Express route handlers, grouped by domain
  - `controllers/` (59 files, many modular): Request handling logic, split by feature area
  - `services/` (97+ files): Business logic, integrations, schedulers
  - `models/` (90+ files): Mongoose schemas with validation and hooks
  - `middleware/` (18 files): Auth, validation, logging, security
  - `config/` (7 files): Environment, Redis, logging, constants
  - `utils/` (24 files): Helpers (encryption, validation, tokens, transactions)
  - `scripts/` (100+ files): Seed data, migrations, analysis utilities
  - `tests/` (7 files): Unit and integration test suites

**Frontend (`frontend/`):**
- Purpose: React Vite SPA, user interface
- Contains: React 19 components, pages, services, state management
- Key subdirectories:
  - `src/pages/` (75+ files): Route-level page components
  - `src/components/` (94+ files): Reusable UI components, domain-specific
  - `src/services/` (88+ files): API client functions, data fetching
  - `src/hooks/` (31 files): Custom React hooks (useWebSocket, useOffline, etc)
  - `src/contexts/` (6 files): Global state (Auth, Clinic, Patient, StudioVisionMode)
  - `src/store/` (5 files): Redux slices for shared state
  - `src/utils/` (16 files): Helpers (formatting, validation, calculations)
  - `public/`: Static assets, favicons
  - `dist/`: Production build output

**Central Server (`central-server/`):**
- Purpose: Coordinate data sync and operations across multiple clinic instances
- Contains: Smaller Express app with same layering as backend
- Key subdirectories:
  - `controllers/` (6 files): Sync orchestration
  - `models/` (10 files): Central aggregation models
  - `routes/` (7 files): Sync endpoints
  - `services/` (4 files): Synchronization logic

**Face Service (`face-service/`):**
- Purpose: Python microservice for face recognition, duplicate detection, patient identification
- Contains: FastAPI app with DeepFace integration
- Key files:
  - `app.py`: FastAPI application and routes

**OCR Service (`ocr-service/`):**
- Purpose: Python microservice for optical character recognition, form field detection
- Contains: FastAPI app with Celery async tasks
- Key subdirectories:
  - `app/main.py`: FastAPI entry point
  - `app/routers/`: API endpoints
  - `app/tasks/`: Celery async tasks
  - `app/services/`: OCR processing logic
  - `datasets/`: Training data for document analysis

**Tests (`tests/playwright/`):**
- Purpose: End-to-end testing with Playwright
- Contains: Test specs for critical workflows
- Key files:
  - `*.spec.ts`: Test specifications (role workflows, data verification, screenshots)
  - `get-entity-ids.js`: Utility to extract entity IDs from database

**Docs (`docs/`):**
- Purpose: Project documentation, architecture guides, procedures
- Contains: 100+ markdown files on system design, workflows, integrations

## Key File Locations

**Backend Entry Points:**
- `backend/server.js`: Main Express server, initializes middleware, routes, schedulers

**Frontend Entry Points:**
- `frontend/src/main.jsx`: Vite entry, React root initialization
- `frontend/src/App.jsx`: Router configuration, route definitions, lazy-loaded pages

**Configuration Files:**
- Backend environment: `backend/.env`, `backend/.env.example`
- Frontend environment: `frontend/.env.production`
- Vite config: `frontend/vite.config.js`
- Docker: `backend/Dockerfile`

**Core Logic Locations:**

| Domain | Controllers | Models | Services |
|--------|-------------|--------|----------|
| Patients | `controllers/patients/` | `models/Patient.js` | `patientService.js`, `patientCascadeService.js` |
| Ophthalmology | `controllers/ophthalmology/` | `models/OphthalmologyExam.js` | `ophthalmologyService.js` |
| Invoices & Billing | `controllers/invoices/` | `models/Invoice.js`, `models/Payment.js` | `domain/BillingService.js`, `invoicePaymentService.js` |
| Inventory | `controllers/inventory/`, `controllers/glassesOrders/` | `models/Inventory.js`, `models/GlassesOrder.js` | `inventoryService.js`, `glassesOrderService.js` |
| Appointments | `controllers/appointmentController.js` | `models/Appointment.js` | `appointmentService.js` |
| Pharmacy | `controllers/pharmacyController.js` | `models/Drug.js` | `pharmacyService.js`, `drugSafetyService.js` |
| Laboratory | `controllers/laboratory/` | `models/LabOrder.js`, `models/LabResult.js` | `labBillingService.js`, `laboratory/orderService.js` |
| Queue | `controllers/queueController.js` | `models/Queue.js` | `queueService.js` |
| Devices | `controllers/devices/`, `controllers/deviceDataController.js` | `models/Device.js`, `models/DeviceImage.js` | `deviceSyncScheduler.js`, `deviceParsers/` |
| Surgery | `controllers/surgeryController.js` | `models/SurgeryCase.js` | `domain/SurgeryService.js` |

**Testing:**
- Backend: `backend/tests/unit/`, `backend/tests/integration/`
- Frontend: `frontend/tests/`, `tests/playwright/`

**Utilities & Shared:**
- Encryption: `backend/utils/phiEncryption.js`
- Financial validation: `backend/utils/financialValidation.js`
- Database: `backend/utils/mongoConnection.js`, `backend/utils/migrationTransaction.js`
- Logging: `backend/config/logger.js`, `backend/utils/structuredLogger.js`
- API response: `backend/utils/apiResponse.js`
- Frontend API: `frontend/src/services/apiConfig.js` (centralized HTTP client)

**Database Models:**
- Clinical: `models/Patient.js`, `models/OphthalmologyExam.js`, `models/Prescription.js`, `models/SurgeryCase.js`
- Financial: `models/Invoice.js`, `models/ConventionFeeSchedule.js`, `models/InsuranceClaim.js`
- Operational: `models/Appointment.js`, `models/Room.js`, `models/Queue.js`, `models/Device.js`
- Audit & Security: `models/AuditLog.js`, `models/User.js`, `models/RolePermission.js`

## Naming Conventions

**Files:**
- Backend controllers: `camelCase` + domain suffix (e.g., `patientController.js`, `invoices/billingController.js`)
- Backend services: `camelCaseService.js` (e.g., `patientService.js`, `websocketService.js`)
- Backend models: `PascalCase.js` (e.g., `Patient.js`, `OphthalmologyExam.js`)
- Backend routes: `camelCase.js` matching resource (e.g., `patients.js`, `invoices.js`)
- Frontend pages: `PascalCase.jsx` (e.g., `Dashboard.jsx`, `PatientDetail.jsx`)
- Frontend components: `PascalCase.jsx` (e.g., `PatientCard.jsx`, `InvoiceForm.jsx`)
- Frontend hooks: `useXxx.js` (e.g., `useWebSocket.js`, `useOffline.js`)
- Frontend services: `camelCaseService.js` (e.g., `patientService.js`, `apiConfig.js`)

**Directories:**
- Domains: lowercase plural (e.g., `patients/`, `invoices/`, `ophthalmology/`)
- Utilities: `utils/`, `services/`, `helpers/`
- Layout/Infrastructure: `layouts/`, `middleware/`, `config/`
- Shared: `contexts/`, `components/`, `hooks/`, `store/`

**Backend Mongoose Collections:**
- lowercase, pluralized: `patients`, `appointments`, `invoices`, `oculars_exams`
- Fields: camelCase (e.g., `dateOfBirth`, `clinicId`, `isDeleted`)

## Where to Add New Code

**New Feature (end-to-end):**
1. **Database Model**: Create `backend/models/FeatureName.js` with Mongoose schema
   - Include clinic context, timestamps, soft delete if needed
   - Add indexes for queried fields
2. **API Route**: Create or extend `backend/routes/featureNames.js`
   - Define GET, POST, PUT, DELETE endpoints
   - Apply auth and clinic context middleware
3. **Service Logic**: Create `backend/services/featureNameService.js`
   - Encapsulate business logic, validation, integrations
4. **Controller**: Create or extend `backend/controllers/featureNameController.js`
   - Handle request parsing, call service, format response
5. **Frontend Service**: Create `frontend/src/services/featureNameService.js`
   - API wrapper functions (fetch, create, update, delete)
6. **Frontend Page/Component**: Create `frontend/src/pages/FeatureName.jsx` or component in `components/`
   - Use API service, display data, handle forms, loading/error states
7. **Tests**: Add test files matching pattern
   - Backend: `backend/tests/unit/featureNameService.test.js`
   - Frontend: `tests/playwright/featureName.spec.ts`

**New Component (frontend):**
- Location: `frontend/src/components/DomainName/ComponentName.jsx`
- Or if general-purpose UI: `frontend/src/components/ComponentName.jsx`
- Convention: PascalCase, functional component with hooks
- Pattern: Accept props, use local useState, call custom hooks for data

**New Service (backend):**
- Location: `backend/services/featureNameService.js`
- Convention: Export functions or class methods
- Pattern: Async functions with error handling, call models and utilities
- For cross-domain logic: `backend/services/domain/DomainService.js`

**New Utility:**
- Location: `backend/utils/featureName.js` or `frontend/src/utils/featureName.js`
- Convention: Pure functions, no side effects
- Pattern: Exported helper functions

**New Page (frontend):**
- Location: `frontend/src/pages/FeatureName/index.jsx` or `frontend/src/pages/FeatureName.jsx`
- Convention: Lazy-loaded in `App.jsx`
- Pattern: Functional component, calls API service, renders layout + sections
- Required: Loading state, error state, empty state

**New Hook (frontend):**
- Location: `frontend/src/hooks/useFeature.js`
- Convention: `useXxx` pattern
- Pattern: Encapsulate complex state logic or side effects
- Example: `useWebSocket`, `useOffline`, `usePatientAlerts`

## Special Directories

**Backend Scripts** (`backend/scripts/`):**
- Purpose: Data seeding, migrations, analysis utilities
- Generated: Not generated, checked in to source
- Committed: Yes, part of codebase
- Examples:
  - `seedComprehensivConfig.js`: Initialize all clinic data
  - `seedPharmacyInventory.js`: Populate drug database
  - `importCareVisionData.js`: Legacy system migration
  - Usage: `node backend/scripts/seedRolePermissions.js`

**Backend Migrations** (`backend/migrations/`):**
- Purpose: Database schema changes, data migrations
- Generated: No
- Committed: Yes
- Examples: Rename fields, add indexes, transform data
- Pattern: Timestamped files, manual execution

**Frontend Build Output** (`frontend/dist/`):**
- Purpose: Production build artifacts
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)
- Usage: Served by backend on production

**Backend Logs** (`backend/logs/`, `backend/coverage/`):**
- Purpose: Runtime logs, test coverage reports
- Generated: Yes (at runtime/test)
- Committed: No
- Retention: Rotating logs, coverage cleared between runs

**Uploads** (`uploads/`, `backend/uploads/`):**
- Purpose: Patient photos, documents, optical try-on images
- Generated: Yes (at runtime)
- Committed: No
- Structure:
  - `optical-tryons/`: Frame try-on photos
  - Patient-specific folders for documents

**Tests Results** (`test-results/`, `backend/test-results/`):**
- Purpose: Test execution reports, artifacts
- Generated: Yes (by test suite)
- Committed: No

**Temporary** (`backend/temp/`):**
- Purpose: Scratch space for processing
- Generated: Yes
- Committed: No
- Examples: File uploads during processing, generated PDFs

## Module Organization Pattern

**Modular Controllers by Domain:**

Example: `backend/controllers/patients/`
- `shared.js`: Shared imports, constants, helpers (used by all patient controllers)
- `coreController.js`: CRUD operations (list, get, create, update, delete)
- `advancedController.js`: Complex queries (search, analytics, aggregation)
- `recordsController.js`: Medical records (history, documents, medications)
- `index.js`: Exports all functions for backward compatibility via `require('../controllers/patients')`

Example: `backend/controllers/invoices/`
- `shared.js`: Invoice constants, pagination defaults
- `coreController.js`: CRUD (list, get, create)
- `billingController.js`: Domain-specific (items, categories, adjustments)
- `paymentController.js`: Payment handling and recording
- `index.js`: Barrel export

**Route Organization Pattern:**

Express routes mirror controller organization:
- `backend/routes/patients.js`: Imports from `controllers/patients/index.js`
- Each route file is a single Express Router
- Middleware applied at route level (auth, clinic context, validation)
- Routes delegate entirely to controllers

**Frontend Feature Organization:**

Example: Ophthalmology section
- `frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx`: Main page
- `frontend/src/pages/ophthalmology/components/`: Domain-specific components
  - `StudioVisionTabContent.jsx`
  - `RNFLPanel.jsx`
  - `VisualFieldPanel.jsx`
  - `AnteriorChamberPanel.jsx`
- `frontend/src/services/ophthalmologyService.js`: API calls
- `frontend/src/hooks/useConsultationData.js`: Consultation state logic

---

*Structure analysis: 2026-01-25*
