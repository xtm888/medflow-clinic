# Architecture

**Analysis Date:** 2026-01-13

## Pattern Overview

**Overall:** Full-Stack Monolith with Microservices

**Key Characteristics:**
- Multi-tenant with clinic context isolation
- RESTful API backend with WebSocket real-time updates
- React SPA frontend with offline-first capabilities
- Python microservices for AI/ML features (face recognition, OCR)
- Central aggregation server for multi-clinic coordination

## Layers

**Layer 1: Frontend (React SPA)**
- Purpose: User interface and client-side state management
- Contains: Pages, components, hooks, contexts, Redux slices, API services
- Location: `frontend/src/`
- Depends on: Backend REST API, WebSocket server
- Technologies: React 19, Redux Toolkit, React Query, Tailwind CSS, Socket.io-client

**Layer 2: Backend API (Express)**
- Purpose: Business logic, data access, authentication, API endpoints
- Contains: Route handlers, controllers, services, middleware
- Location: `backend/`
- Depends on: MongoDB, Redis, microservices
- Technologies: Express.js, Mongoose, Socket.io, JWT, Winston

**Layer 3: Data Layer (MongoDB)**
- Purpose: Persistent data storage with schema validation
- Contains: 79+ Mongoose models with hooks, indexes, virtuals
- Location: `backend/models/`
- Depends on: MongoDB server
- Features: Soft deletes, clinic scoping, PHI encryption, audit trails

**Layer 4: Caching & Sessions (Redis)**
- Purpose: Session storage, rate limiting, caching, pub/sub
- Contains: Session store, rate limiter store, 2FA codes
- Location: `backend/config/redis.js`
- Depends on: Redis server

**Layer 5: Microservices (Python)**
- Purpose: AI/ML operations isolated from main application
- Contains: Face recognition service, OCR service
- Location: `face-service/`, `ocr-service/`
- Depends on: Backend API calls
- Technologies: Flask, FastAPI, Celery, DeepFace, PaddleOCR

**Layer 6: Central Server**
- Purpose: Multi-clinic aggregation and data synchronization
- Contains: Consolidated reporting, sync coordination, clinic registry
- Location: `central-server/`
- Depends on: Individual clinic backends

## Data Flow

**HTTP Request Lifecycle:**

1. Browser → React Component (user action)
2. React dispatches Redux action or calls API service
3. API Service (`frontend/src/services/*.js`) constructs axios request with auth headers
4. Express Server (`backend/server.js`) receives request
5. Security middleware: helmet, CORS, rate limiting, NoSQL injection protection
6. Auth middleware: JWT verification, clinic context (`backend/middleware/auth.js`, `clinicAuth.js`)
7. Validation middleware: express-validator rules
8. Route handler → Controller method
9. Controller calls service layer for business logic
10. Service interacts with Mongoose models
11. Response returns through layers → React updates UI/state

**WebSocket Flow:**

1. Frontend connects via Socket.io-client
2. Backend WebSocket server (`backend/services/websocketService.js`) handles connection
3. Client subscribes to events (queue updates, notifications)
4. Server broadcasts events via Redis pub/sub
5. Frontend socket listener updates Redux state
6. React re-renders affected components

**Offline Sync Flow:**

1. App detects offline state
2. Dexie (IndexedDB) provides cached data
3. User actions create SyncQueue entries
4. App reconnects → syncService processes queue
5. Backend merges with server state
6. Conflicts resolved via UI prompts

**State Management:**
- Redux Toolkit for global UI state (auth, clinic, appointments)
- React Query for server state caching
- Context providers for scoped state (patient, consultation)
- Dexie for offline data persistence

## Key Abstractions

**Controller:**
- Purpose: Parse requests, validate input, call services, format responses
- Examples: `backend/controllers/patients/coreController.js`, `backend/controllers/appointmentController.js`
- Pattern: Express async handlers with standardized error handling

**Service:**
- Purpose: Encapsulate business logic, database operations, external integrations
- Examples: `backend/services/ivtComplianceService.js`, `backend/services/pdfGenerator.js`
- Pattern: Stateless modules with async functions

**Model (Mongoose):**
- Purpose: Schema definition, validation, data access methods
- Examples: `backend/models/Patient.js`, `backend/models/Invoice.js`
- Pattern: Schema with hooks, statics, methods, virtuals, indexes

**Middleware:**
- Purpose: Request processing pipeline (auth, validation, logging)
- Examples: `backend/middleware/auth.js`, `backend/middleware/auditLogger.js`
- Pattern: Express middleware functions

**API Service (Frontend):**
- Purpose: Encapsulate backend API calls with error handling
- Examples: `frontend/src/services/ophthalmologyService.js`, `frontend/src/services/patientService.js`
- Pattern: Async functions returning promises

**Context Provider (Frontend):**
- Purpose: Scoped state management for component trees
- Examples: `frontend/src/contexts/ClinicContext.jsx`, `frontend/src/contexts/PatientContext.jsx`
- Pattern: React Context with useReducer

## Entry Points

**Backend Server:**
- Location: `backend/server.js`
- Triggers: `npm start` or `npm run dev`
- Responsibilities: Initialize Express, load middleware, mount routes, connect MongoDB/Redis, start WebSocket server, initialize schedulers

**Frontend App:**
- Location: `frontend/src/main.jsx` → `frontend/src/App.jsx`
- Triggers: Vite dev server or production build
- Responsibilities: Render React app, setup providers (Redux, Router, Contexts), configure Sentry, lazy-load routes

**Central Server:**
- Location: `central-server/server.js`
- Triggers: `npm start` in central-server directory
- Responsibilities: Multi-clinic aggregation, sync coordination, consolidated reporting

**Face Recognition Service:**
- Location: `face-service/app.py`
- Triggers: Flask server startup
- Responsibilities: Face detection, encoding, verification for patient identification

**OCR Service:**
- Location: `ocr-service/app/main.py`
- Triggers: FastAPI + Celery workers
- Responsibilities: Document OCR, legacy record import, async processing

## Error Handling

**Strategy:** Exceptions bubble up through layers; caught at controller/middleware level

**Backend Patterns:**
- Try/catch in controllers with `asyncHandler` wrapper
- Centralized error handler middleware (`backend/middleware/errorHandler.js`)
- Standardized API response format via `backend/utils/apiResponse.js`
- Winston logger for error recording

**Frontend Patterns:**
- Error boundaries for component-level failures
- Toast notifications for user-facing errors (react-toastify)
- Redux middleware for auth error handling
- Sentry for error tracking and reporting

## Cross-Cutting Concerns

**Authentication:**
- JWT access tokens + refresh tokens
- Optional 2FA via speakeasy TOTP
- Session management via Redis
- Clinic context embedded in JWT claims

**Authorization:**
- RBAC with roles: doctor, nurse, optician, pharmacist, cashier, admin
- Middleware checks: `protect`, `authorize(['role1', 'role2'])`
- Clinic-scoped data access via `req.user.currentClinicId`

**Logging:**
- Winston structured logging (`backend/config/logger.js`)
- Morgan HTTP request logging
- Audit logging for sensitive operations (`backend/middleware/auditLogger.js`)
- Prometheus metrics (`backend/middleware/metrics.js`)

**Validation:**
- express-validator for request validation
- Joi for complex schema validation
- Mongoose schema validation
- Yup for frontend form validation

**Clinic Context:**
- All queries scoped by clinic ID
- Middleware enforces clinic context (`backend/middleware/clinicAuth.js`)
- Multi-clinic users can switch context
- Data isolation prevents cross-clinic access

**Audit Logging:**
- Sensitive operations logged (patient access, financial changes, config updates)
- Includes user, action, resource, changes, timestamp
- Stored in AuditLog collection

---

*Architecture analysis: 2026-01-13*
*Update when major patterns change*
