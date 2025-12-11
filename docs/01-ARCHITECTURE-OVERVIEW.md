# MedFlow - System Architecture Overview

**Version:** 1.0
**Last Updated:** December 2024
**Document Type:** Technical Architecture Documentation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Component Architecture](#4-component-architecture)
5. [Data Flow Architecture](#5-data-flow-architecture)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Real-Time Communication](#7-real-time-communication)
8. [Multi-Clinic Architecture](#8-multi-clinic-architecture)
9. [Device Integration Architecture](#9-device-integration-architecture)
10. [Security Architecture](#10-security-architecture)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Technology Stack](#12-technology-stack)

---

## 1. Executive Summary

MedFlow is an enterprise-grade **ophthalmology clinic management system** designed for multi-clinic operations in the Democratic Republic of Congo. The system provides comprehensive functionality for:

- **Clinical Operations**: Patient management, ophthalmology exams, IVT injections, prescriptions
- **Administrative Operations**: Appointments, queue management, billing, invoicing
- **Inventory Management**: Pharmacy, optical frames, contact lenses, laboratory reagents
- **Laboratory Operations**: Lab orders, results, analyzer integration (HL7/LIS)
- **Device Integration**: Medical device data synchronization via SMB/network shares
- **Multi-Clinic Support**: Central synchronization, cross-clinic patient search, consolidated reporting

### Key Metrics

| Metric | Count |
|--------|-------|
| Backend Models | 73 |
| API Endpoints | 64 route files |
| Frontend Pages | 60+ |
| Frontend Components | 50+ |
| Backend Services | 42+ |
| Microservices | 3 (OCR, Face Recognition, Central Sync) |

---

## 2. System Overview

### 2.1 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SYSTEMS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Medical    │  │   Calendar   │  │    Email     │  │     SMS      │     │
│  │   Devices    │  │   (Google/   │  │   (SMTP)     │  │   Provider   │     │
│  │  (SMB/DICOM) │  │   Outlook)   │  │              │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │                 │              │
└─────────┼─────────────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MEDFLOW SYSTEM                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         BACKEND (Node.js/Express)                      │  │
│  │                              Port: 5001                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                    ▲                              │                          │
│                    │ REST API + WebSocket         │                          │
│                    ▼                              ▼                          │
│  ┌────────────────────────────┐    ┌────────────────────────────────────┐   │
│  │   FRONTEND (React/Vite)   │    │         MICROSERVICES              │   │
│  │       Port: 5173          │    │  ┌─────────┐ ┌─────────┐ ┌───────┐ │   │
│  │                           │    │  │   OCR   │ │  Face   │ │Central│ │   │
│  │  • Staff Portal           │    │  │  :5003  │ │  :5002  │ │ :5002 │ │   │
│  │  • Patient Portal         │    │  └─────────┘ └─────────┘ └───────┘ │   │
│  │  • Public Booking         │    └────────────────────────────────────┘   │
│  └────────────────────────────┘                                             │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         DATA LAYER                                     │  │
│  │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │  │
│  │   │    MongoDB      │    │     Redis       │    │   File Storage  │   │  │
│  │   │  (Replica Set)  │    │    (Cache/      │    │   (Imaging/     │   │  │
│  │   │                 │    │    Sessions)    │    │    Documents)   │   │  │
│  │   └─────────────────┘    └─────────────────┘    └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Design Principles

1. **Offline-First**: IndexedDB (Dexie.js) for client-side storage, sync queue for offline operations
2. **Real-Time Updates**: WebSocket (Socket.io) for live queue, notifications, and collaboration
3. **Multi-Currency**: Native support for CDF (Congolese Franc) and USD
4. **Multi-Clinic**: Central server for cross-clinic data synchronization
5. **Device Agnostic**: Adapters for various ophthalmic devices (autorefractor, OCT, biometer, etc.)
6. **Audit Complete**: Every action logged for compliance and traceability

---

## 3. High-Level Architecture

### 3.1 Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  React 19 + Vite + Tailwind CSS                                         ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐││
│  │  │   Pages     │ │ Components  │ │   Hooks     │ │   Redux Store       │││
│  │  │   (60+)     │ │   (50+)     │ │   (16)      │ │   (10 slices)       │││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Express.js REST API                                                     ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐││
│  │  │   Routes    │ │ Controllers │ │ Middleware  │ │   Validators        │││
│  │  │   (64)      │ │   (47)      │ │   (9)       │ │                     │││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BUSINESS LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Services (42+)                                                          ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐││
│  │  │  Clinical   │ │ Integration │ │  Financial  │ │   Device Adapters   │││
│  │  │  Services   │ │  Services   │ │  Services   │ │   (8 adapters)      │││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DATA LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Mongoose ODM + MongoDB                                                  ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐││
│  │  │   Models    │ │   Indexes   │ │ Transactions│ │   Aggregations      │││
│  │  │   (73)      │ │  (Compound) │ │ (Replica)   │ │                     │││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture

### 4.1 Backend Components

```
backend/
├── server.js                    # Application entry point
│
├── config/
│   ├── constants.js             # System constants & timeouts
│   ├── logger.js                # Winston logging configuration
│   ├── redis.js                 # Redis connection & helpers
│   └── swagger.js               # OpenAPI/Swagger documentation
│
├── middleware/
│   ├── auth.js                  # JWT authentication & authorization
│   ├── clinicAuth.js            # Multi-clinic authorization
│   ├── auditLogger.js           # Comprehensive audit trail
│   ├── rateLimiter.js           # Redis-backed rate limiting
│   ├── validation.js            # Request validation (express-validator)
│   ├── validate.js              # Joi validation wrapper
│   ├── metrics.js               # Prometheus metrics collection
│   └── errorHandler.js          # Global error handling
│
├── models/                      # 73 Mongoose schemas
│   ├── Patient.js               # Core patient data (55KB)
│   ├── Invoice.js               # Billing (76KB, largest model)
│   ├── OphthalmologyExam.js     # Eye exams (37KB)
│   ├── Prescription.js          # Medications & optical Rx (38KB)
│   └── ... (69 more models)
│
├── controllers/                 # 47 business logic handlers
│   ├── prescriptionController.js  # Rx management (153KB, largest)
│   ├── billingController.js       # Financial operations (129KB)
│   └── ... (45 more controllers)
│
├── routes/                      # 64 API endpoint definitions
│   ├── patients.js              # /api/patients
│   ├── ophthalmology.js         # /api/ophthalmology
│   └── ... (62 more route files)
│
├── services/                    # 42+ business services
│   ├── websocketService.js      # Real-time events (857 lines)
│   ├── drugSafetyService.js     # Drug interaction checking (47KB)
│   ├── pdfGenerator.js          # PDF generation (63KB)
│   ├── adapters/                # Device adapters (8 files)
│   │   ├── AdapterFactory.js
│   │   ├── AutorefractorAdapter.js
│   │   ├── OctAdapter.js
│   │   └── ...
│   └── deviceParsers/           # Device-specific file parsers
│
├── scripts/                     # Database seeding & migrations
│   ├── seedRolePermissions.js
│   ├── seedClinics.js
│   └── ...
│
└── utils/                       # Helper utilities
    ├── apiResponse.js           # Standardized API responses
    ├── tokenUtils.js            # JWT token helpers
    └── ...
```

### 4.2 Frontend Components

```
frontend/src/
├── App.jsx                      # Main application with routing
│
├── layouts/
│   ├── MainLayout.jsx           # Staff portal layout (sidebar + header)
│   └── PatientLayout.jsx        # Patient portal layout
│
├── pages/                       # 60+ route pages
│   ├── Dashboard.jsx            # Main dashboard
│   ├── Patients.jsx             # Patient list (61KB)
│   ├── Queue.jsx                # Real-time queue (90KB, largest)
│   ├── Invoicing.jsx            # Invoice management (81KB)
│   ├── ophthalmology/           # Ophthalmology module
│   │   ├── NewConsultation.jsx  # Multi-step exam wizard
│   │   └── components/          # Exam step components (17+ files)
│   ├── patient/                 # Patient portal pages
│   ├── visits/                  # Visit management
│   └── ...
│
├── components/                  # 50+ reusable UI components
│   ├── PatientRegistrationWizard.jsx  # Registration wizard (69KB)
│   ├── prescriptions/
│   │   └── EnhancedPrescription.jsx
│   ├── documents/
│   ├── biometric/               # Face recognition components
│   ├── imaging/
│   └── ...
│
├── services/                    # 66 API service files
│   ├── apiConfig.js             # Axios configuration
│   ├── patientService.js        # Patient API calls (28KB)
│   ├── websocketService.js      # WebSocket client (16KB)
│   └── ...
│
├── store/                       # Redux state management
│   ├── index.js                 # Store configuration
│   └── slices/                  # 10 Redux slices
│       ├── authSlice.js
│       ├── patientSlice.js
│       └── ...
│
├── contexts/                    # 5 React contexts
│   ├── AuthContext.jsx
│   ├── PatientContext.jsx
│   ├── ClinicContext.jsx
│   └── ...
│
├── hooks/                       # 16 custom hooks
│   ├── useApi.js
│   ├── useWebSocket.js
│   ├── useAutoSave.js
│   └── ...
│
└── modules/                     # Clinical workflow modules
    └── clinical/
        ├── ClinicalWorkflow.jsx
        └── useClinicalSession.js
```

---

## 5. Data Flow Architecture

### 5.1 Request/Response Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Express   │────▶│ Middleware  │────▶│ Controller  │
│  (React)    │     │   Router    │     │   Chain     │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
     ┌──────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Service   │────▶│   Model     │────▶│  MongoDB    │────▶│   Redis     │
│   Layer     │     │  (Mongoose) │     │  (Data)     │     │  (Cache)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 5.2 Middleware Chain

```
Request
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. helmet()           - Security headers                                    │
│  2. cors()             - CORS handling                                       │
│  3. rateLimiter        - Redis-backed rate limiting                          │
│  4. morgan()           - Request logging (Winston)                           │
│  5. metricsMiddleware  - Prometheus metrics                                  │
│  6. express.json()     - Body parsing (1MB limit, 10MB for uploads)          │
│  7. compression()      - Response compression                                │
│  8. auditLogger        - Audit trail for all requests                        │
│  9. attachToResponse   - Standardized res.api.* helpers                      │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
Route Handler
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  10. protect()           - JWT authentication                                │
│  11. authorize()/        - Role-based access (legacy)                        │
│      requirePermission() - Permission-based access (database-driven)         │
│  12. validate            - Request validation                                │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
Controller
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  13. errorHandler        - Global error handling                             │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
Response
```

### 5.3 Clinical Workflow Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PATIENT CONSULTATION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. REGISTRATION/CHECK-IN
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │  Patient │────▶│  Check   │────▶│   Add    │
   │  Arrives │     │  Queue   │     │  to DB   │
   └──────────┘     └──────────┘     └──────────┘
                          │
                          ▼ WebSocket
   ┌──────────────────────────────────────────────┐
   │  emit('queue:update') → All connected users  │
   └──────────────────────────────────────────────┘

2. CONSULTATION (Multi-Step Wizard)
   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
   │  Chief   │────▶│  Visual  │────▶│Refraction│────▶│ Slit Lamp│
   │ Complaint│     │  Acuity  │     │          │     │          │
   └──────────┘     └──────────┘     └──────────┘     └──────────┘
        │                                                   │
        │                                                   ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
   │  Summary │◀────│Procedures│◀────│Prescription◀────│  Fundus  │
   │  & Plan  │     │          │     │          │     │  & IOP   │
   └──────────┘     └──────────┘     └──────────┘     └──────────┘
        │
        ▼
   ┌──────────────────────────────────────────────┐
   │  Create: Visit, OphthalmologyExam,           │
   │          Prescription, Invoice (if needed)   │
   └──────────────────────────────────────────────┘

3. POST-CONSULTATION
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ Pharmacy │────▶│ Glasses  │────▶│  Billing │
   │ Dispense │     │  Order   │     │ Payment  │
   └──────────┘     └──────────┘     └──────────┘
```

---

## 6. Authentication & Authorization

### 6.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOGIN FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Login   │────▶│ Validate │────▶│  Check   │────▶│  Generate│
│  Request │     │Credentials│    │   2FA    │     │   JWT    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                                  │
                      ▼                                  ▼
              ┌──────────────┐              ┌──────────────────────┐
              │  bcrypt      │              │  Access Token (15m)  │
              │  compare     │              │  Refresh Token (7d)  │
              └──────────────┘              │  Session ID (Redis)  │
                                            └──────────────────────┘
```

### 6.2 JWT Token Structure

```javascript
// Access Token Payload
{
  id: "user_id",
  role: "ophthalmologist",
  permissions: [],           // From RolePermission collection
  tokenType: "access",
  sessionId: "redis_session_key",
  iat: 1234567890,
  exp: 1234568790            // 15 minutes
}

// Refresh Token Payload
{
  id: "user_id",
  tokenType: "refresh",
  sessionId: "redis_session_key",
  iat: 1234567890,
  exp: 1235172690            // 7 days
}
```

### 6.3 Authorization Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLE-BASED ACCESS CONTROL (RBAC)                          │
└─────────────────────────────────────────────────────────────────────────────┘

User ──────▶ Role ──────▶ Permissions ──────▶ Resources

ROLES (13 defined):
┌─────────────────────────────────────────────────────────────────────────────┐
│  admin           │ Full system access                                       │
│  ophthalmologist │ Clinical + prescriptions + billing view                  │
│  doctor          │ General clinical access                                  │
│  nurse           │ Vitals, queue management, limited clinical               │
│  receptionist    │ Appointments, check-in, basic patient info               │
│  pharmacist      │ Pharmacy inventory, dispensing                           │
│  lab_technician  │ Laboratory orders, results, analyzers                    │
│  optician        │ Optical orders, frame inventory                          │
│  accountant      │ Financial reports, invoicing                             │
│  cashier         │ Payments, receipts                                       │
│  secretary       │ Documents, correspondence                                │
│  manager         │ Reports, approvals, limited admin                        │
│  patient         │ Patient portal (self-service)                            │
└─────────────────────────────────────────────────────────────────────────────┘

PERMISSION EXAMPLES:
┌─────────────────────────────────────────────────────────────────────────────┐
│  patients:read        │ View patient records                                │
│  patients:write       │ Create/edit patients                                │
│  prescriptions:write  │ Create prescriptions                                │
│  prescriptions:dispense│ Dispense medications                               │
│  invoices:discount    │ Apply discounts (requires approval)                 │
│  audit:read           │ View audit logs                                     │
│  settings:write       │ Modify system settings                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Session Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REDIS SESSION STORE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Key: session:{sessionId}
Value: {
  userId: "...",
  role: "...",
  loginTime: "...",
  lastActivity: "...",
  deviceInfo: "...",
  ip: "..."
}
TTL: 7 days (matches refresh token)

Features:
• Session validation on each request
• Activity tracking (updated on API calls)
• Single sign-on support (multiple sessions per user)
• Force logout capability (delete session key)
```

---

## 7. Real-Time Communication

### 7.1 WebSocket Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WEBSOCKET SERVICE (Socket.io)                           │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────┐
                    │     WebSocket Server            │
                    │     (Socket.io on Express)      │
                    └─────────────────┬───────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
           ▼                          ▼                          ▼
   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
   │  User Rooms   │         │  Role Rooms   │         │ Feature Rooms │
   │               │         │               │         │               │
   │ user:{userId} │         │ role:doctor   │         │ queue:updates │
   │               │         │ role:nurse    │         │ patient:{id}  │
   │               │         │ role:admin    │         │ notifications │
   └───────────────┘         └───────────────┘         └───────────────┘
```

### 7.2 Event Types

```javascript
// QUEUE EVENTS
'queue:update'        // Queue status changed
'queue:updated'       // Alias for compatibility
'queue_update'        // Global broadcast

// PATIENT EVENTS
'patient:updated'     // Patient record changed
'patient_update'      // Global broadcast
'patient_called'      // Patient called to room

// NOTIFICATION EVENTS
'notification:new'    // New notification
'notification:update' // Notification status change

// APPOINTMENT EVENTS
'appointment:updated' // Appointment changed
'appointment_update'  // Global broadcast

// PRESCRIPTION EVENTS
'prescription:updated' // Prescription changed
'prescription:new'     // New prescription for pharmacy

// LAB EVENTS
'lab:results'         // Lab results ready
'lab:worklist:update' // Lab worklist changed
'lab:critical'        // Critical value alert
'lab:specimen:collected' // Specimen collected
'lab:qc:failure'      // QC failure alert

// INVENTORY EVENTS
'inventory:alert'     // Low stock / expiry alert

// DASHBOARD EVENTS
'dashboard:update'    // Dashboard metrics changed

// DEVICE EVENTS
'device:sync:complete' // Device sync finished
'device:measurement:new' // New measurement available

// SYSTEM EVENTS
'server:shutdown'     // Server shutting down
'ping' / 'pong'       // Connection health check
```

### 7.3 Message Replay System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MESSAGE REPLAY FOR OFFLINE USERS                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   Message Buffer │  • Room buffers: 100 messages max, 15 min retention
│                  │  • User buffers: 50 messages max, 15 min retention
└────────┬─────────┘
         │
         ▼ On Reconnect
┌──────────────────┐
│ Check lastSeen   │  • Stored per user in userLastSeen Map
│                  │  • Updated on disconnect
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Replay Messages  │  • emit('replay:start', { count, since })
│                  │  • emit(event, { ...data, _replayed: true })
│                  │  • emit('replay:complete', { count })
└──────────────────┘
```

---

## 8. Multi-Clinic Architecture

### 8.1 Clinic Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-CLINIC TOPOLOGY                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌───────────────────────┐
                         │    CENTRAL SERVER     │
                         │      (Port 5002)      │
                         │                       │
                         │ • Clinic Registry     │
                         │ • Cross-clinic Search │
                         │ • Consolidated Reports│
                         │ • Inventory Transfers │
                         └───────────┬───────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│   CLINIC: GOMA    │    │ CLINIC: KINSHASA  │    │ CLINIC: LUBUMBASHI│
│                   │    │                   │    │                   │
│ • Backend :5001   │    │ • Backend :5001   │    │ • Backend :5001   │
│ • Frontend :5173  │    │ • Frontend :5173  │    │ • Frontend :5173  │
│ • MongoDB (local) │    │ • MongoDB (local) │    │ • MongoDB (local) │
│ • Redis (local)   │    │ • Redis (local)   │    │ • Redis (local)   │
└───────────────────┘    └───────────────────┘    └───────────────────┘
```

### 8.2 Data Synchronization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYNC FLOW (Clinic → Central)                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. LOCAL OPERATION
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │  Create  │────▶│  Save to │────▶│  Add to  │
   │  Patient │     │  Local DB│     │SyncQueue │
   └──────────┘     └──────────┘     └──────────┘

2. BACKGROUND SYNC (dataSyncService)
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │  Check   │────▶│   POST   │────▶│  Update  │
   │SyncQueue │     │ /api/sync│     │  Status  │
   └──────────┘     └──────────┘     └──────────┘

3. CENTRAL PROCESSING
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ Validate │────▶│ Merge to │────▶│   ACK    │
   │  Data    │     │ Central  │     │ to Clinic│
   └──────────┘     └──────────┘     └──────────┘
```

### 8.3 Offline Sync Queue

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST DATA ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND (IndexedDB via Dexie.js):
┌──────────────────────────────────────────────────────────────────┐
│  Tables:                                                          │
│  • patients        - Cached patient data                         │
│  • appointments    - Cached appointments                         │
│  • syncQueue       - Pending operations                          │
│  • offlineChanges  - Changes made while offline                  │
└──────────────────────────────────────────────────────────────────┘

SYNC FLOW:
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   User Action  │────▶│  Save Locally  │────▶│  Queue Sync    │
│   (Offline)    │     │  (IndexedDB)   │     │  Operation     │
└────────────────┘     └────────────────┘     └────────────────┘
                                                      │
                                                      │ When Online
                                                      ▼
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   Conflict     │◀────│   Push to      │◀────│   Detect       │
│   Resolution   │     │   Server       │     │   Connectivity │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

## 9. Device Integration Architecture

### 9.1 Device Communication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MEDICAL DEVICE INTEGRATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│  MEDICAL DEVICE   │    │   NETWORK SHARE   │    │   MEDFLOW         │
│                   │    │   (SMB/CIFS)      │    │                   │
│  • Autorefractor  │───▶│                   │───▶│  folderSyncService│
│  • OCT            │    │  \\device\export  │    │  patientFolderIdx │
│  • Biometer       │    │                   │    │  universalFilePrc │
│  • Tonometer      │    │                   │    │                   │
└───────────────────┘    └───────────────────┘    └───────────────────┘
                                                          │
                                                          ▼
                                                   ┌───────────────────┐
                                                   │  ADAPTER FACTORY  │
                                                   │                   │
                                                   │  • Parse Data     │
                                                   │  • Map to Patient │
                                                   │  • Store Results  │
                                                   └───────────────────┘
```

### 9.2 Supported Device Adapters

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEVICE ADAPTERS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┬────────────────────────────────────────────────────────┐
│ Adapter             │ Supported Devices / Data Types                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ AutorefractorAdapter│ Nidek, Topcon, Canon, Huvitz autorefractors           │
│                     │ Output: Sphere, Cylinder, Axis, PD                     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ TonometryAdapter    │ Nidek, Canon, Reichert tonometers                      │
│                     │ Output: IOP (mmHg), pachymetry                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ OctAdapter          │ Zeiss Cirrus, Heidelberg Spectralis, Topcon Maestro   │
│                     │ Output: RNFL, GCL, macular thickness                   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ BiometerAdapter     │ Zeiss IOLMaster, Haag-Streit Lenstar                   │
│                     │ Output: AL, ACD, K1/K2, IOL calculations               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ NidekAdapter        │ Nidek-specific device protocols                        │
│                     │ Output: Various (device-specific)                      │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ SpecularMicroscope  │ Topcon, Konan specular microscopes                     │
│ Adapter             │ Output: Cell density, CV, hexagonality                 │
└─────────────────────┴────────────────────────────────────────────────────────┘
```

### 9.3 SMB/Network Share Access

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SMB2 CLIENT SERVICE                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Network Discovery:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Scan Local  │────▶│  Identify    │────▶│  Register    │
│  Network     │     │  Med Devices │     │  in System   │
└──────────────┘     └──────────────┘     └──────────────┘

File Sync:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Watch       │────▶│  Download    │────▶│  Parse &     │
│  SMB Share   │     │  New Files   │     │  Store       │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │ Uses: smb2ClientService.js
       │       smbStreamService.js
       │       folderSyncService.js
       ▼
┌──────────────────────────────────────────────────────────┐
│  Features:                                                │
│  • Automatic file watching                               │
│  • Patient ID extraction from folder names               │
│  • Duplicate detection                                   │
│  • Error recovery & retry                                │
└──────────────────────────────────────────────────────────┘
```

---

## 10. Security Architecture

### 10.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1: TRANSPORT
├── HTTPS (TLS 1.3)
├── Secure WebSocket (WSS)
└── CORS with whitelist

Layer 2: RATE LIMITING (Redis-backed)
├── API: 100 req/15min (general)
├── Auth: 5 req/15min (login/register)
├── Sensitive: 30 req/15min (billing, pharmacy)
├── Uploads: 10 req/15min (file uploads)
├── Reports: 10 req/15min (document generation)
└── Search: 60 req/15min (patient search)

Layer 3: AUTHENTICATION
├── JWT tokens (access + refresh)
├── Session validation (Redis)
├── 2FA support (TOTP via speakeasy)
└── Account lockout (5 failed attempts)

Layer 4: AUTHORIZATION
├── Role-based (13 roles)
├── Permission-based (database-driven)
└── Resource ownership checks

Layer 5: INPUT VALIDATION
├── express-validator
├── Joi schemas
└── Mongoose schema validation

Layer 6: OUTPUT SANITIZATION
├── XSS prevention (Helmet)
├── SQL injection prevention (ODM)
└── Generic error messages (no info leakage)

Layer 7: AUDIT
├── All API requests logged
├── Permission denials logged
├── Sensitive action tracking
└── IP and user agent capture
```

### 10.2 Security Headers (Helmet.js)

```javascript
// Applied security headers:
{
  "Content-Security-Policy": "default-src 'self'; ...",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "cross-origin"  // For images
}
```

---

## 11. Deployment Architecture

### 11.1 Service Ports

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE PORTS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┬────────────┬───────────────────────────────────────────┐
│ Service             │ Port       │ Description                               │
├─────────────────────┼────────────┼───────────────────────────────────────────┤
│ Backend API         │ 5001       │ Express.js REST API + WebSocket           │
│ Frontend            │ 5173       │ Vite dev server / nginx (prod)            │
│ Central Server      │ 5002       │ Multi-clinic sync hub                     │
│ Face Service        │ 5002*      │ Python/Flask face recognition             │
│ OCR Service         │ 5003       │ Python/FastAPI OCR processing             │
│ MongoDB             │ 27017      │ Database (replica set)                    │
│ Redis               │ 6379       │ Cache, sessions, rate limiting            │
├─────────────────────┼────────────┼───────────────────────────────────────────┤
│ * Note: Face Service and Central Server share port 5002                     │
│   (they are typically not deployed together)                                 │
└─────────────────────┴────────────┴───────────────────────────────────────────┘
```

### 11.2 Environment Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT VARIABLES                                     │
└─────────────────────────────────────────────────────────────────────────────┘

REQUIRED:
├── MONGODB_URI          # MongoDB connection string (with replica set)
├── JWT_SECRET           # Secret for JWT signing
└── PORT                 # Server port (default: 5001)

OPTIONAL (with defaults):
├── NODE_ENV             # development | production
├── FRONTEND_URL         # CORS origin for frontend
├── REDIS_HOST           # Redis host (default: localhost)
├── REDIS_PORT           # Redis port (default: 6379)
├── EMAIL_USER           # SMTP username
├── EMAIL_PASS           # SMTP password
├── BACKUP_ENABLED       # Enable automated backups (default: true)
└── SYNC_ENABLED         # Enable multi-clinic sync (default: false)

MULTI-CLINIC:
├── CLINIC_ID            # Unique clinic identifier
├── CENTRAL_SYNC_URL     # Central server URL
└── SYNC_TOKEN           # Authentication token for sync
```

### 11.3 Scheduled Tasks

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND SCHEDULERS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┬────────────────────────────────────────────────────┐
│ Scheduler               │ Interval / Description                             │
├─────────────────────────┼────────────────────────────────────────────────────┤
│ alertScheduler          │ Continuous - Clinical alert evaluation             │
│ deviceSyncScheduler     │ 5 min - Medical device data sync                   │
│ reservationCleanup      │ 1 min - Release expired inventory reservations     │
│ reminderScheduler       │ Hourly - Appointment reminders (email/SMS)         │
│ invoiceReminderScheduler│ Daily - Payment reminders                          │
│ paymentPlanAutoCharge   │ Daily - Automatic payment plan charges             │
│ calendarSyncScheduler   │ 15 min - Google/Outlook calendar sync              │
│ backupScheduler         │ Daily - Automated database backups                 │
│ emailQueueService       │ 30 sec - Process email queue                       │
│ counterCleanup          │ Weekly - Remove old counter records                │
└─────────────────────────┴────────────────────────────────────────────────────┘
```

---

## 12. Technology Stack

### 12.1 Complete Stack Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TECHNOLOGY STACK                                    │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND
├── Framework:     React 19
├── Build Tool:    Vite
├── Styling:       Tailwind CSS
├── State:         Redux Toolkit + redux-persist
├── Routing:       React Router v6
├── HTTP Client:   Axios
├── Real-time:     Socket.io Client
├── Offline:       Dexie.js (IndexedDB)
├── Forms:         react-hook-form (assumed)
├── Notifications: react-toastify
└── Charts:        Chart.js / Recharts (assumed)

BACKEND
├── Runtime:       Node.js 18+
├── Framework:     Express.js 4.18
├── Database:      MongoDB 7.x (replica set required)
├── ODM:           Mongoose 7.5
├── Cache:         Redis
├── Real-time:     Socket.io
├── Auth:          JWT (jsonwebtoken)
├── 2FA:           speakeasy (TOTP)
├── Validation:    express-validator, Joi
├── Security:      Helmet.js
├── Logging:       Winston + Morgan
├── PDF:           PDFKit
├── Email:         Nodemailer
├── API Docs:      Swagger (OpenAPI)
├── Metrics:       Prometheus
└── Testing:       Jest

PYTHON SERVICES
├── OCR Service:
│   ├── Framework: FastAPI
│   ├── Task Queue: Celery
│   └── OCR Engine: Tesseract / Google Cloud Vision
│
└── Face Service:
    ├── Framework: Flask
    ├── ML Library: TensorFlow
    └── Face Library: DeepFace (Facenet model)

DATABASE
├── Primary:       MongoDB (with transactions)
├── Cache:         Redis
├── Offline:       IndexedDB (Dexie.js)
└── Backup:        Automated mongodump

INFRASTRUCTURE
├── Process Mgr:   PM2 (ecosystem.config.js)
├── Reverse Proxy: nginx (production)
└── SSL:           Let's Encrypt / Cloudflare
```

### 12.2 Key Dependencies

```
BACKEND (package.json):
├── express: ^4.18.x         # Web framework
├── mongoose: ^7.5.x         # MongoDB ODM
├── socket.io: ^4.x          # WebSocket server
├── jsonwebtoken: ^9.x       # JWT authentication
├── bcryptjs: ^2.4.x         # Password hashing
├── helmet: ^7.x             # Security headers
├── cors: ^2.8.x             # CORS middleware
├── compression: ^1.7.x      # Response compression
├── express-validator: ^7.x  # Request validation
├── joi: ^17.x               # Schema validation
├── redis: ^4.x              # Redis client
├── pdfkit: ^0.14.x          # PDF generation
├── nodemailer: ^6.x         # Email sending
├── speakeasy: ^2.x          # 2FA TOTP
├── swagger-ui-express: ^5.x # API documentation
├── winston: ^3.x            # Logging
└── morgan: ^1.10.x          # HTTP logging

FRONTEND (package.json):
├── react: ^19.x             # UI framework
├── react-router-dom: ^6.x   # Routing
├── @reduxjs/toolkit: ^2.x   # State management
├── redux-persist: ^6.x      # State persistence
├── axios: ^1.x              # HTTP client
├── socket.io-client: ^4.x   # WebSocket client
├── dexie: ^4.x              # IndexedDB wrapper
├── tailwindcss: ^3.x        # CSS framework
├── react-toastify: ^10.x    # Toast notifications
└── vite: ^5.x               # Build tool
```

---

## Appendix A: API Documentation

The backend provides Swagger/OpenAPI documentation at:
- Development: `http://localhost:5001/api-docs`
- JSON spec: `http://localhost:5001/api-docs.json`

## Appendix B: Health Endpoints

```
GET /health              # System health check
GET /metrics             # Prometheus metrics
GET /api/health          # Detailed API health
```

## Appendix C: File Locations

```
Configuration:
├── backend/.env                    # Backend environment
├── frontend/.env                   # Frontend environment
├── ecosystem.config.js             # PM2 configuration
└── start-all.sh                    # Development startup script

Logs:
├── backend/logs/                   # Winston log files
└── /var/log/medflow/               # Production logs (typical)

Uploads:
├── backend/public/imaging/         # Medical images
├── backend/public/images_ophta/    # Ophthalmology images
└── backend/public/datasets/        # Datasets
```

---

*This document is part of the MedFlow Technical Documentation series.*

**Next Document:** [02-DATA-MODELS.md](./02-DATA-MODELS.md) - Comprehensive Data Model Reference
