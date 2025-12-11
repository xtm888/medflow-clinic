# MedFlow - Complete System Documentation

**Last Updated:** 2025-12-07
**Version:** 2.0
**System:** Ophthalmic Clinic Management System

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Architecture](#3-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Backend Reference](#5-backend-reference)
6. [Frontend Reference](#6-frontend-reference)
7. [Clinical Workflows](#7-clinical-workflows)
8. [Multi-Clinic Deployment](#8-multi-clinic-deployment)
9. [Device Integration](#9-device-integration)
10. [Security & Audit](#10-security--audit)
11. [Current Roadmap](#11-current-roadmap)
12. [Operations Guide](#12-operations-guide)
13. [Quick Reference](#13-quick-reference)

---

## 1. Overview

MedFlow is a comprehensive **ophthalmic clinic management system** designed for multi-clinic operations in Central Africa. It provides complete digital workflows for patient registration, clinical examinations, prescriptions, billing, pharmacy, laboratory, and administrative functions.

### Key Capabilities

| Module | Features |
|--------|----------|
| **Patient Management** | Registration, biometric photo, face recognition duplicate detection, medical history |
| **Ophthalmology** | Consultations, IVT injections, orthoptic exams, device integration (OCT, visual fields) |
| **Prescriptions** | Drug & optical prescriptions, safety checks, drug interaction detection |
| **Billing** | Multi-currency (CDF/USD), insurance/conventions, payment plans, automated invoicing |
| **Pharmacy** | Inventory management, dispensing, expiry tracking, profit margins |
| **Laboratory** | Test orders, LIS integration (HL7), results management |
| **Queue** | Real-time queue with WebSocket updates, display boards |
| **Surgery** | Case management, scheduling, OR workflow |
| **Multi-Clinic** | Centralized sync, cross-clinic patient search, consolidated reporting |

### System Stats

- **58 Mongoose models** - Complete data layer
- **45 route files / 200+ API endpoints** - Full REST API
- **48 frontend services** - Offline-first architecture
- **27 backend services** - Business logic layer

---

## 2. Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 7.0 (replica set recommended)
- Redis (optional but recommended)
- Python 3.9+ (for face recognition service)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env  # Configure your settings

# Create indexes
node scripts/createIndexes.js

# Seed initial data
node scripts/createAdminUser.js
node scripts/seedRolePermissions.js
node scripts/seedPharmacyInventory.js

# Start server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Face Recognition Service

```bash
cd face-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

---

## 3. Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│    React 19 | Vite | Redux | Tailwind | Socket.io Client         │
│    PWA with Offline Support (IndexedDB/Dexie)                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS / WebSocket
┌────────────────────────────┴─────────────────────────────────────┐
│                         BACKEND                                   │
│    Node.js | Express | Mongoose | Socket.io | Redis              │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Routes   │ │Controllers│ │ Services │ │Middleware│            │
│  │ (45)     │ │ (33)     │ │ (27)     │ │ (auth,   │            │
│  │          │ │          │ │          │ │ audit)   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────────────┐
│                      DATA LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   MongoDB    │  │    Redis     │  │ Face Service │           │
│  │  (Primary)   │  │   (Cache)    │  │  (Python)    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
magloire/
├── backend/                 # Node.js API server
│   ├── config/             # Configuration (Redis, etc.)
│   ├── controllers/        # Business logic (33 files)
│   ├── models/             # Mongoose schemas (58 files)
│   ├── routes/             # API endpoints (45 files)
│   ├── middleware/         # Auth, validation, audit
│   ├── services/           # Reusable services (27 files)
│   ├── utils/              # Helper functions
│   ├── scripts/            # Setup & migration scripts
│   └── server.js           # Entry point
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API services (48 files)
│   │   ├── store/          # Redux store & slices
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Utilities
│   └── vite.config.js
├── face-service/           # Python face recognition
└── ocr-service/            # Python OCR (planned)
```

---

## 4. Technology Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | >=18.0.0 | Runtime |
| Express.js | 4.18.2 | Web framework |
| MongoDB | 7.5.0 | Database |
| Mongoose | 7.5.0 | ODM |
| Redis | 4.6.8 | Caching |
| Socket.io | 4.5.4 | WebSocket |
| jsonwebtoken | 9.0.2 | JWT auth |
| pdfkit | 0.17.2 | PDF generation |
| node-cron | 3.0.2 | Scheduling |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.1.1 | UI framework |
| Vite | 4.5.3 | Build tool |
| Redux Toolkit | 2.10.1 | State management |
| React Query | 5.90.8 | Server state |
| Tailwind CSS | 3.4.1 | Styling |
| Socket.io Client | 4.8.1 | Real-time |
| Dexie | - | Offline storage |
| Recharts | 3.3.0 | Charts |

### Services

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| Backend API | Node.js | 5001 | REST API & WebSocket |
| Face Recognition | Python/Flask | 5002 | Duplicate detection |
| OCR Service | Python (planned) | 5003 | Document processing |

---

## 5. Backend Reference

### Core Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| Patient | Patient records | firstName, lastName, dateOfBirth, allergies, faceEncoding |
| Appointment | Scheduling | patient, provider, date, status, type |
| Visit | Clinical encounters | patient, appointment, visitType, diagnoses, treatments |
| Invoice | Billing | patient, visit, items, payments, status |
| Prescription | Medications | patient, medications, prescriber, status |
| OphthalmologyExam | Eye exams | patient, visit, visualAcuity, refraction, fundus |

### Key API Endpoints

```
# Authentication
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/me

# Patients
GET    /api/patients
POST   /api/patients
GET    /api/patients/:id
PUT    /api/patients/:id

# Appointments
GET    /api/appointments
POST   /api/appointments
PUT    /api/appointments/:id/checkin
PUT    /api/appointments/:id/start-consultation

# Visits
GET    /api/visits
POST   /api/visits
PUT    /api/visits/:id/complete

# Invoices
GET    /api/invoices
POST   /api/invoices
POST   /api/invoices/:id/payments

# Queue
GET    /api/queue
POST   /api/queue
PUT    /api/queue/:id

# Dashboard
GET    /api/dashboard/stats
GET    /api/dashboard/today-tasks
```

### Multi-Clinic Middleware

All clinical routes use `optionalClinic` middleware for clinic-aware filtering:

```javascript
// Extracts clinic from X-Clinic-ID header
router.use(optionalClinic);

// In controllers, filter by clinic:
if (req.clinicId && !req.accessAllClinics) {
  query.clinic = req.clinicId;
}
```

---

## 6. Frontend Reference

### Key Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/dashboard` | Overview, stats, tasks |
| Patients | `/patients` | Patient list & search |
| Patient Detail | `/patients/:id` | Full patient record |
| Queue | `/queue` | Real-time queue management |
| Appointments | `/appointments` | Calendar & scheduling |
| New Consultation | `/ophthalmology/new-consultation` | Clinical workflow |
| Billing | `/billing` | Invoices & payments |
| Pharmacy | `/pharmacy` | Inventory & dispensing |
| Laboratory | `/laboratory` | Lab orders & results |

### State Management

```javascript
// Redux slices
store/slices/
├── authSlice.js        // User & authentication
├── patientSlice.js     // Patient data
├── appointmentSlice.js // Appointments
├── queueSlice.js       // Queue state
├── billingSlice.js     // Invoices & payments
└── prescriptionSlice.js // Prescriptions
```

### Offline Support

- **Dexie (IndexedDB)** for local data storage
- **Service Worker** for PWA capabilities
- **WebSocket reconnection** with message replay
- Automatic sync when connection restored

---

## 7. Clinical Workflows

### Patient Visit Flow

```
1. ARRIVAL
   └── Check-in at reception
       └── Face recognition verification
       └── Appointment lookup or walk-in registration

2. QUEUE
   └── Added to waiting queue
   └── Real-time display board updates
   └── Called by provider

3. CONSULTATION
   └── Chief complaint & history
   └── Examination (visual acuity, refraction, etc.)
   └── Diagnosis & treatment plan
   └── Prescriptions (drug or optical)

4. BILLING
   └── Auto-generated invoice from visit
   └── Payment processing (cash/card/insurance)
   └── Receipt generation

5. PHARMACY/OPTICAL
   └── Prescription dispensing
   └── Inventory deduction
   └── Patient education

6. FOLLOW-UP
   └── Next appointment scheduling
   └── Reminder setup
```

### Invoice Auto-Generation

When a visit is completed, the system automatically:
1. Collects all clinical acts performed
2. Looks up prices from FeeSchedule
3. Applies convention discounts if applicable
4. Creates invoice with all line items
5. Sends notification to billing desk

---

## 8. Multi-Clinic Deployment

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              HETZNER CENTRAL SERVER                      │
│                    €7.59/month                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │ Node.js │  │ MongoDB │  │  Redis  │                 │
│  │  :5002  │  │ :27017  │  │  :6379  │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS Sync
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Clinic A │  │ Clinic B │  │ Clinic C │
   │ (Local)  │  │ (Local)  │  │ (Local)  │
   └─────────┘  └─────────┘  └─────────┘
```

### Key Features

- **Works offline** - Each clinic runs independently
- **Syncs when online** - Changes push to central every 60 seconds
- **Cross-clinic search** - Find patients from any location
- **Consolidated reports** - Organization-wide analytics

### Clinic Context

Users have:
- `clinics[]` - Which clinics they can work at
- `primaryClinic` - Their default clinic
- `accessAllClinics` - Admin flag for full access

Frontend sends `X-Clinic-ID` header with all API requests.

---

## 9. Device Integration

### Supported Devices

| Device | Type | Integration |
|--------|------|-------------|
| Zeiss CLARUS 700 | Fundus Camera | Folder sync (JPEG/DICOM) |
| Optovue Solix | OCT | Folder sync |
| Zeiss IOL Master 700 | Biometer | Folder sync (PDF/XML) |
| NIDEK CEM-530 | Specular Microscope | Folder sync |
| Quantel Compact Touch | Ultrasound | Folder sync |

### Sync Configuration

Devices sync automatically via `DeviceSyncScheduler`:
- Monitors configured folder paths
- Parses filenames for patient matching
- Imports images/PDFs to patient records
- Moves processed files to archive

---

## 10. Security & Audit

### Authentication

- JWT-based authentication
- Refresh token rotation
- Session management via Redis
- Rate limiting on auth endpoints

### Role-Based Access Control

| Role | Key Permissions |
|------|-----------------|
| Admin | Full system access |
| Doctor/Ophthalmologist | Clinical, prescriptions, view billing |
| Receptionist | Registration, appointments, check-in, billing |
| Nurse | Vitals, triage, view clinical |
| Pharmacist | Pharmacy inventory, dispensing |
| Lab Technician | Lab orders, results entry |

### Audit Logging

All critical operations logged to `AuditLog` collection:

```javascript
{
  userId: ObjectId,
  action: 'VISIT_CREATE',
  targetType: 'Visit',
  targetId: ObjectId,
  changes: { before: {...}, after: {...} },
  ipAddress: '192.168.1.1',
  timestamp: Date
}
```

### Audit Query Examples

```javascript
// User activity in last 24 hours
db.auditlogs.find({
  userId: ObjectId("..."),
  timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
})

// All invoice modifications
db.auditlogs.find({
  targetType: 'Invoice',
  action: { $regex: /UPDATE|DELETE/ }
})
```

---

## 11. Current Roadmap

### CRITICAL Priority

| Item | Status | Est. Effort |
|------|--------|-------------|
| Testing infrastructure (Jest) | Pending | 1-2 weeks |
| Prescription safety fields (allergies, interactions) | Pending | 1 week |
| Permission fixes (9 roles) | Pending | 3 days |

### HIGH Priority

| Item | Status | Est. Effort |
|------|--------|-------------|
| Surgery module completion | Pending | 2 weeks |
| Glasses order notifications | Pending | 1 week |
| Invoice-service bidirectional sync | Pending | 1 week |

### MEDIUM Priority

| Item | Status | Est. Effort |
|------|--------|-------------|
| OCR integration for auto-population | Planned Q2 | 3-4 weeks |
| Device integration security hardening | Planned | 1 week |
| Performance optimization | Ongoing | 1 week |

### Completed (December 2025)

- [x] Multi-clinic architecture
- [x] Clinic context middleware on all routes
- [x] Audit logging system (65+ action types)
- [x] Database indexes (72 indexes)
- [x] Compensating transactions for non-replica MongoDB
- [x] Immutable invoice item IDs

---

## 12. Operations Guide

### Health Monitoring

```bash
# Check backend status
curl http://localhost:5001/api/auth/me

# Check MongoDB connection
mongosh --eval "db.adminCommand('ping')"

# Check Redis
redis-cli ping

# View recent errors
tail -100 /var/log/medflow/error.log
```

### Database Maintenance

```bash
# Backup database
mongodump --db medflow --out /backup/$(date +%Y%m%d)

# Check collection sizes
mongosh medflow --eval "db.stats()"

# Find zombie records
mongosh medflow --eval "db.visits.find({ appointment: null, deleted: { \$ne: true } }).count()"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| WebSocket disconnection | Check Redis, restart backend |
| Slow queries | Check indexes, enable query profiling |
| Duplicate visits | Unique index prevents, check appointment flow |
| Missing invoices | Check Visit.completeVisit() was called |

---

## 13. Quick Reference

### Environment Variables

```env
# Backend (.env)
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb://localhost:27017/medflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d

# Services
FACE_SERVICE_URL=http://localhost:5002
OCR_SERVICE_URL=http://localhost:5003 (future)
```

### Useful Scripts

```bash
# Create admin user
node scripts/createAdminUser.js

# Seed permissions
node scripts/seedRolePermissions.js

# Create database indexes
node scripts/createIndexes.js

# Migrate from legacy system
node scripts/migrate-lv-data.js
```

### MongoDB Queries

```javascript
// Today's appointments
db.appointments.find({
  date: {
    $gte: ISODate().setHours(0,0,0,0),
    $lt: ISODate().setHours(23,59,59,999)
  }
}).count()

// Unpaid invoices
db.invoices.find({
  status: { $in: ['issued', 'partial'] },
  'summary.amountDue': { $gt: 0 }
})

// User activity audit
db.auditlogs.find({ userId: ObjectId("...") }).sort({ timestamp: -1 }).limit(50)
```

### API Testing

```bash
# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinic.com","password":"password"}'

# Get patients (with auth)
curl http://localhost:5001/api/patients \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Clinic-ID: CLINIC_ID"
```

---

## Document History

| Date | Change |
|------|--------|
| 2025-12-07 | Unified documentation created from 31 separate files |
| 2025-12-07 | Added multi-clinic architecture section |
| 2025-11-30 | Original audit documentation completed |

---

*This document consolidates: BACKEND_DOCUMENTATION, FRONTEND_DOCUMENTATION, PATIENT_JOURNEY_DOCUMENTATION, MULTI_CLINIC_DEPLOYMENT_GUIDE, FIXABLE_ISSUES_CONSOLIDATED, COMPREHENSIVE_IMPLEMENTATION_PLAN, AUDIT_IMPLEMENTATION_PROGRESS, DEVICE_CONFIGURATION_PLAN, and 23 other documentation files.*
