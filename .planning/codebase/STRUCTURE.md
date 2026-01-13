# Codebase Structure

**Analysis Date:** 2026-01-13

## Directory Layout

```
magloire/
├── backend/                # Express.js API server
│   ├── config/            # Database, Redis, logger configuration
│   ├── controllers/       # Request handlers organized by domain
│   ├── middleware/        # Auth, validation, audit, metrics
│   ├── models/            # Mongoose schemas (79+ models)
│   ├── routes/            # Express route definitions
│   ├── services/          # Business logic layer
│   ├── scripts/           # Seed, migration, utility scripts
│   └── utils/             # Helpers (encryption, validation)
├── frontend/              # React SPA application
│   └── src/
│       ├── components/    # Reusable UI components (33 domains)
│       ├── contexts/      # React Context providers
│       ├── hooks/         # Custom React hooks
│       ├── pages/         # Route components
│       ├── services/      # API client functions
│       ├── store/         # Redux slices
│       └── utils/         # Frontend utilities
├── central-server/        # Multi-clinic aggregation server
├── face-service/          # Python face recognition microservice
├── ocr-service/           # Python OCR microservice
└── tests/                 # Playwright E2E tests
```

## Directory Purposes

**backend/**
- Purpose: Express.js REST API server with WebSocket support
- Contains: All server-side code for the medical application
- Key files: `server.js` (entry point), `package.json`
- Subdirectories: Organized by architectural layer

**backend/config/**
- Purpose: Application configuration and connections
- Contains: Database, Redis, logger, environment configs
- Key files: `db.js` (MongoDB), `redis.js` (Redis + circuit breaker), `logger.js` (Winston)

**backend/controllers/**
- Purpose: HTTP request handling, input validation, response formatting
- Contains: 43+ controller files organized by domain
- Key files: `patients/coreController.js`, `appointmentController.js`, `authController.js`
- Subdirectories: `billing/`, `devices/`, `glassesOrders/`, `inventory/`, `invoices/`, `laboratory/`, `ophthalmology/`, `patients/`, `prescriptions/`

**backend/middleware/**
- Purpose: Request processing pipeline
- Contains: Auth, validation, audit, metrics, error handling
- Key files: `auth.js`, `clinicAuth.js`, `auditLogger.js`, `errorHandler.js`

**backend/models/**
- Purpose: Mongoose schema definitions with validation and hooks
- Contains: 79+ model files representing medical domain entities
- Key files: `Patient.js` (2622 lines), `Invoice.js` (2860 lines), `Visit.js`, `OphthalmologyExam.js`

**backend/routes/**
- Purpose: Express route definitions mapping URLs to controllers
- Contains: 79 route files organized by domain
- Key files: `patients.js`, `appointments.js`, `auth.js`, `billing.js`

**backend/services/**
- Purpose: Business logic, external integrations, complex operations
- Contains: 61+ service modules
- Key files: `pdfGenerator.js`, `clinicalAlertService.js`, `dataSyncService.js`, `websocketService.js`
- Subdirectories: `adapters/` (device adapters)

**backend/scripts/**
- Purpose: Database seeding, migrations, utilities
- Contains: 127+ utility scripts
- Key files: `seedClinics.js`, `seedPatients.js`, `seedFrenchDrugs.js`

**backend/utils/**
- Purpose: Shared helper functions
- Contains: Encryption, validation, response formatting
- Key files: `apiResponse.js`, `financialValidation.js`, `phiEncryption.js`

**frontend/src/**
- Purpose: React SPA source code
- Contains: Components, pages, state management, API services
- Key files: `main.jsx` (entry), `App.jsx` (root component)

**frontend/src/components/**
- Purpose: Reusable UI components organized by domain
- Contains: 33 component directories
- Key directories: `consultation/`, `appointments/`, `billing/`, `common/`, `patient/`, `inventory/`, `pharmacy/`

**frontend/src/pages/**
- Purpose: Route-level page components
- Contains: 30+ page components
- Key files: `PatientDetail/`, `Appointments/`, `StudioVision/`, `Pharmacy/`, `Laboratory/`
- Subdirectories: Nested by feature domain

**frontend/src/services/**
- Purpose: API client functions for backend communication
- Contains: 78+ service files
- Key files: `patientService.js`, `appointmentService.js`, `ophthalmologyService.js`, `api.js`

**frontend/src/store/**
- Purpose: Redux state management
- Contains: Redux slices for global state
- Key files: `slices/authSlice.js`, `slices/clinicSlice.js`

**frontend/src/contexts/**
- Purpose: React Context providers for scoped state
- Contains: Context definitions and providers
- Key files: `ClinicContext.jsx`, `PatientContext.jsx`, `StudioVisionModeContext.jsx`

**central-server/**
- Purpose: Multi-clinic data aggregation and coordination
- Contains: Separate Express server for cross-clinic operations
- Key files: `server.js`, `controllers/syncController.js`

**face-service/**
- Purpose: Face recognition microservice for patient identification
- Contains: Python Flask application with DeepFace
- Key files: `app.py`, `requirements.txt`

**ocr-service/**
- Purpose: OCR processing for legacy record import
- Contains: Python FastAPI application with Celery workers
- Key files: `app/main.py`, `requirements.txt`
- Subdirectories: `app/` (application code)

## Key File Locations

**Entry Points:**
- `backend/server.js` - Backend server startup
- `frontend/src/main.jsx` - Frontend React entry
- `central-server/server.js` - Central aggregation server
- `face-service/app.py` - Face recognition service
- `ocr-service/app/main.py` - OCR service

**Configuration:**
- `backend/.env.example` - Environment template
- `backend/config/db.js` - MongoDB connection
- `backend/config/redis.js` - Redis with circuit breaker
- `frontend/vite.config.js` - Vite build config
- `frontend/tailwind.config.js` - Tailwind CSS config
- `playwright.config.ts` - E2E test config

**Core Logic:**
- `backend/services/` - All business logic services
- `backend/models/` - Data models and validation
- `backend/controllers/` - Request handling
- `frontend/src/services/` - API client layer

**Testing:**
- `backend/__tests__/` - Backend Jest tests
- `frontend/src/**/*.test.js` - Frontend Vitest tests
- `tests/playwright/` - E2E Playwright tests

**Documentation:**
- `CLAUDE.md` - Project instructions for AI assistants
- `README.md` - Project documentation
- `.planning/` - Planning and codebase documentation

## Naming Conventions

**Files:**
- `camelCase.js` - Backend JavaScript files (e.g., `patientController.js`)
- `PascalCase.jsx` - React components (e.g., `PatientList.jsx`)
- `camelCase.test.js` - Test files
- `UPPERCASE.md` - Important project files

**Directories:**
- `camelCase` - Feature directories (e.g., `patients/`, `billing/`)
- Plural names for collections (e.g., `controllers/`, `models/`, `services/`)

**Special Patterns:**
- `index.js` / `index.jsx` - Directory exports
- `*Slice.js` - Redux slices
- `use*.js` - React hooks
- `*Service.js` - API service files

## Where to Add New Code

**New Feature (Full-Stack):**
- Model: `backend/models/{Feature}.js`
- Service: `backend/services/{feature}Service.js`
- Controller: `backend/controllers/{feature}Controller.js`
- Routes: `backend/routes/{feature}.js`
- Frontend service: `frontend/src/services/{feature}Service.js`
- Page: `frontend/src/pages/{Feature}/index.jsx`
- Components: `frontend/src/components/{feature}/`

**New API Endpoint:**
- Route: `backend/routes/{domain}.js`
- Controller: `backend/controllers/{domain}Controller.js` or `backend/controllers/{domain}/`
- Service: `backend/services/{domain}Service.js`

**New React Component:**
- Component: `frontend/src/components/{domain}/{ComponentName}.jsx`
- If page-level: `frontend/src/pages/{PageName}/index.jsx`

**New Hook:**
- Location: `frontend/src/hooks/use{HookName}.js`

**Utilities:**
- Backend: `backend/utils/{utilName}.js`
- Frontend: `frontend/src/utils/{utilName}.js`

**Tests:**
- Backend: `backend/__tests__/{feature}.test.js`
- Frontend: Co-located as `{component}.test.jsx`
- E2E: `tests/playwright/{feature}.spec.ts`

## Special Directories

**backend/scripts/**
- Purpose: Database seeding, migrations, one-time utilities
- Source: Manually created for deployment/setup
- Committed: Yes
- Run via: `node scripts/{scriptName}.js`

**backend/uploads/**
- Purpose: File upload storage
- Source: User uploads, generated documents
- Committed: No (in .gitignore)

**frontend/dist/**
- Purpose: Production build output
- Source: Generated by `npm run build`
- Committed: No (in .gitignore)

**node_modules/**
- Purpose: NPM dependencies
- Source: `npm install`
- Committed: No (in .gitignore)

**.planning/**
- Purpose: Project planning and codebase documentation
- Source: GSD workflow outputs
- Committed: Yes

---

*Structure analysis: 2026-01-13*
*Update when directory structure changes*
