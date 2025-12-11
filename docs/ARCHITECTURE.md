# MedFlow Architecture Guide

## System Architecture

MedFlow follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│         React 19 + Redux Toolkit + Tailwind CSS                 │
│   Pages (124K LOC) | Components (70+) | Hooks (16) | Services   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                            │
│              Express.js + Middleware Stack                      │
│   Auth (JWT+2FA) | Rate Limiter | Audit Logger | Clinic Context │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                           │
│              Controllers (59) + Services (63)                   │
│   Clinical | Billing | Pharmacy | Lab | Queue | Devices | Sync  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                  │
│           MongoDB + Redis + IndexedDB (Offline)                 │
│      84 Models | Sessions/Cache | Dexie Offline Store           │
└─────────────────────────────────────────────────────────────────┘
```

## Design Patterns

### MVC Pattern (Backend)
- **Models** (`backend/models/`): 84 Mongoose schemas defining data structure
- **Controllers** (`backend/controllers/`): 59 files handling business logic
- **Routes** (`backend/routes/`): 78 files defining API endpoints

### Factory Pattern
**File:** `backend/services/adapters/AdapterFactory.js`
- Manages device adapters for ophthalmology equipment
- Registry-based mapping of device types to adapter classes
- Supports 17+ device types with fallback to BaseAdapter

### Service Layer Pattern
- Core business logic isolated in 63+ service files
- Examples:
  - `notificationService.js` - Multi-channel notifications (SMS/Email)
  - `pdfGenerator.js` - Document generation
  - `websocketService.js` - Real-time communication

### Middleware Pattern
Layered middleware stack with specific responsibilities:
- `auth.js` - JWT validation, permission checking, 2FA support
- `clinicAuth.js` - Multi-clinic access control
- `auditLogger.js` - Request/response logging
- `errorHandler.js` - Centralized error processing
- `rateLimiter.js` - Redis-backed distributed rate limiting

## Data Flow

### Clinical Workflow

```
Patient Registration → Queue → Vitals → Consultation → Examination
                                              │
                    ┌───────────────┬─────────┴──────────┬────────────┐
                    ▼               ▼                    ▼            ▼
              Prescription    Lab Orders           Imaging       Surgery
                    │               │                    │            │
                    ▼               ▼                    ▼            ▼
               Pharmacy        Laboratory          Device Sync   Surgical
              (Dispense)       (Results)           (NIDEK/Zeiss)   Suite
                    │               │                    │            │
                    └───────────────┴────────────────────┴────────────┘
                                              │
                                              ▼
                                          Billing
                                    (Multi-Currency)
                                              │
                                              ▼
                                         Complete
                                    (Documents/Reports)
```

### Request Flow

```
HTTP Request
     │
     ▼
Express Router → Rate Limiter → Auth Middleware → Clinic Context
                                                       │
                                                       ▼
                                              Route Handler
                                                       │
                                                       ▼
                                               Controller
                                                       │
                    ┌──────────────────┬───────────────┴──────────────┐
                    ▼                  ▼                              ▼
              Validation           Service(s)                    Model(s)
                                       │                              │
                                       ▼                              ▼
                              External Services              MongoDB Query
                                       │                              │
                                       └──────────────┬───────────────┘
                                                      ▼
                                               JSON Response
```

## Database Models

### Core Domain Models (84 total)

**Patient-Centric:**
- `Patient.js` - Patient demographics, identifiers, folder mappings
- `User.js` (421 lines) - User accounts with 11 role types
- `Visit.js` (1,666 lines) - Comprehensive visit tracking

**Clinical Workflow:**
- `Appointment.js` - Scheduling with type variants
- `ConsultationSession.js` - Clinical session tracking
- `OphthalmologyExam.js` - Eye examination data
- `Prescription.js` - Medication/optical prescriptions

**Financial:**
- `Invoice.js` - Multi-currency billing
- `FeeSchedule.js` - Service pricing
- `Approval.js` - Invoice approval workflow

**Inventory:**
- `PharmacyInventory.js`, `FrameInventory.js`
- `ContactLensInventory.js`, `OpticalLensInventory.js`
- `ReagentInventory.js`, `LabConsumableInventory.js`
- `SurgicalSupplyInventory.js`

### Key Relationships

```
Patient ─┬─▶ Appointments
         ├─▶ Visits ─────▶ ClinicalActs (embedded)
         ├─▶ Prescriptions ─▶ Medications (embedded)
         ├─▶ Invoices ─────▶ Items (embedded)
         └─▶ OphthalmologyExams

User ◀──▶ Clinic (many-to-many via User.clinics)

SurgeryCase ◀──▶ Visit (bi-directional)
```

## API Structure

### Route Categories

| Category | Prefix | Files | Description |
|----------|--------|-------|-------------|
| Core Clinical | `/api/patients`, `/api/appointments`, `/api/queue`, `/api/visits` | 4 | Patient management |
| Ophthalmology | `/api/ophthalmology`, `/api/orthoptic`, `/api/glasses-orders` | 3 | Eye care workflows |
| Prescriptions | `/api/prescriptions`, `/api/pharmacy` | 2 | Medication management |
| Financial | `/api/invoices`, `/api/billing`, `/api/fee-schedules` | 3 | Billing operations |
| Inventory | `/api/frame-inventory`, `/api/contact-lens-inventory`, etc. | 8 | Stock management |
| Laboratory | `/api/laboratory`, `/api/lab-orders`, `/api/lab-results` | 5 | Lab operations |
| Surgical | `/api/surgery`, `/api/surgical-consents`, `/api/ivt` | 4 | Surgical workflows |
| Admin | `/api/audit`, `/api/role-permissions`, `/api/backups` | 5 | System administration |

### Authentication Flow

1. **Login Request** → `POST /api/auth/login`
2. **JWT Token** (15 min) + **Refresh Token** (30 days)
3. **2FA Challenge** (if enabled) → `POST /api/auth/verify-two-factor`
4. **Token Refresh** → `POST /api/auth/refresh-token`
5. **Logout** → `POST /api/auth/logout`

## Frontend Architecture

### State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                        Redux Store                              │
├─────────────────────────────────────────────────────────────────┤
│ authReducer (persisted)     │ uiReducer (persisted)            │
│ patientReducer              │ notificationReducer               │
│ appointmentReducer          │ queueReducer                      │
│ visitReducer                │ prescriptionReducer               │
│ billingReducer              │ documentReducer                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      React Context                              │
├─────────────────────────────────────────────────────────────────┤
│ AuthContext      │ PatientContext    │ ClinicContext           │
│ PatientCacheContext │ HistoryContext                           │
└─────────────────────────────────────────────────────────────────┘
```

### Route Structure

```
/
├── /login (public)
├── /book (public booking)
└── Protected Routes (ProtectedRoute)
    ├── /home (navigation launcher)
    └── / (MainLayout)
        ├── /dashboard
        ├── /patients, /patients/:patientId
        ├── /queue, /appointments
        ├── /prescriptions
        ├── /clinical/* (ophthalmology workflows)
        ├── /ivt/* (anti-VEGF injections)
        ├── /pharmacy/*, /laboratory/*
        ├── /financial/*
        ├── /devices/*
        ├── /surgery/*
        └── /audit, /users, /backups (admin)
```

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useApi` | Data fetching with caching/retry |
| `useApiMutation` | POST/PUT/DELETE operations |
| `usePaginatedApi` | Paginated list endpoints |
| `useAutoSave` | Debounced auto-save (2s) |
| `useWebSocket` | Real-time data connections |
| `usePermissions` | Role-based access control |
| `useOffline` | Offline detection |
| `useOfflineData` | IndexedDB querying |

## External Integrations

### Medical Devices
- **SMB2 Network Shares**: Device data folders (NIDEK, Zeiss, Solix)
- **Adapter Factory**: 17+ device type adapters
- **File Processors**: Parse device export formats

### Communication
- **Email**: Nodemailer SMTP (appointments, password resets)
- **SMS**: Twilio integration (appointment reminders)
- **WebSocket**: Socket.io for real-time updates

### Calendars
- **Google Calendar**: Appointment sync
- **Microsoft Graph**: Outlook integration

### Healthcare Standards
- **HL7 Parser**: HL7 message processing
- **FHIR Service**: FHIR standard support
- **LIS Integration**: Laboratory information systems

## Security Architecture

### Authentication
- JWT with separate refresh tokens
- TOTP-based 2FA (speakeasy)
- Session tracking in Redis
- Account locking after failed attempts

### Authorization
- Role-based access control (11 roles)
- Permission-based middleware
- Clinic-scoped data access
- Admin "All Clinics" mode

### Data Protection
- bcrypt password hashing
- Sensitive field redaction in logs
- Audit trail for all actions
- Rate limiting (Redis-backed)

### Security Headers
- Helmet.js configuration
- CSP with image allowlist
- CORS with origin validation

## Offline Support

### IndexedDB Schema (Dexie)
```javascript
{
  users, patients, appointments, queue,
  visits, prescriptions, ophthalmologyExams,
  syncQueue, conflicts, cacheMetadata,
  settings, notifications, auditLog, files
}
```

### Sync Strategy
1. **Network First**: Try API, fall back to cache
2. **Sync Queue**: Store failed writes for retry
3. **Conflict Resolution**: Server version wins
4. **Automatic Retry**: Exponential backoff

## Performance Considerations

### Frontend
- Code splitting via React.lazy()
- Suspense boundaries
- Debounced saves and WebSocket updates
- Throttled Redux dispatches (100ms)

### Backend
- Redis caching for sessions
- MongoDB indexing strategies
- Pagination service (offset/cursor)
- Rate limiting per endpoint type

### Known Issues
- Main bundle: 812KB (needs code splitting)
- Visit.js model: 1,666 lines (needs refactoring)
- 63+ services (consider consolidation)
