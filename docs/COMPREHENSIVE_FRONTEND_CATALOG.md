# MedFlow Frontend Element Catalog

**Generated:** December 13, 2025
**Total Elements:** 628+ files across Pages, Components, Hooks, Services, Contexts, Modules, Layouts, and Utils

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Pages (60+)](#pages)
4. [Components (100+)](#components)
5. [Hooks (20+)](#hooks)
6. [Services (80+)](#services)
7. [Contexts (5)](#contexts)
8. [Modules (4)](#modules)
9. [Layouts (2)](#layouts)
10. [Utilities (8)](#utilities)
11. [Workflow Connections](#workflow-connections)
12. [StudioVision Parity Features](#studiovision-parity-features)

---

## Overview

The MedFlow frontend is a comprehensive ophthalmology clinic management system built with:

- **React 18** with functional components and hooks
- **Redux Toolkit** for global state management
- **Tailwind CSS** for styling
- **Socket.IO** for real-time updates
- **IndexedDB** for offline-first data persistence
- **Vite** for build tooling

### Key Architectural Patterns

| Pattern | Implementation |
|---------|---------------|
| **Offline-First** | IndexedDB caching, sync queue, conflict resolution |
| **Real-Time** | WebSocket for queue, appointments, billing, lab updates |
| **Role-Based Access** | Database-driven permissions, PermissionGate component |
| **Multi-Clinic** | ClinicContext with clinic-scoped data filtering |
| **Clinical Workflows** | Configuration-driven ClinicalWorkflow orchestrator |
| **StudioVision Parity** | 4-column layouts, favorite medications, treatment protocols |

---

## Architecture Summary

```
frontend/src/
├── pages/           # Route-level components (60+ pages)
├── components/      # Reusable UI components (100+)
├── hooks/           # Custom React hooks (20+)
├── services/        # API service layer (80+)
├── contexts/        # React Context providers (5)
├── modules/         # Feature modules (4)
├── layouts/         # Page layouts (2)
├── utils/           # Utility functions (8)
├── store/           # Redux store & slices
├── styles/          # Design tokens & CSS
├── assets/          # Static assets (LOCS III SVGs, etc.)
└── config/          # Configuration files
```

---

## Pages

### Core Application Pages

| Page | Path | Purpose |
|------|------|---------|
| **Dashboard** | `/dashboard` | Admin KPIs, charts, quick actions |
| **HomeDashboard** | `/home` | Category-based navigation hub |
| **Login** | `/login` | Authentication with demo accounts |

### Patient Management

| Page | Path | Purpose |
|------|------|---------|
| **Patients** | `/patients` | Patient list with search, batch ops, merge |
| **PatientDetail** | `/patients/:id` | Full patient dossier (sections, timeline) |
| **PatientEdit** | `/patients/:id/edit` | 7-section patient form |

### Clinical Workflows

| Page | Path | Purpose |
|------|------|---------|
| **NewConsultation** | `/ophthalmology/consultation/:id` | 4 workflow modes (dashboard, full, followup, refraction) |
| **GlassesOrder** | `/ophthalmology/glasses-order` | Prescription glasses ordering |
| **OrthopticExams** | `/orthoptic-exams` | Orthoptic examination management |

### Appointments & Queue

| Page | Path | Purpose |
|------|------|---------|
| **Appointments** | `/appointments` | Calendar views (list, week, month, agenda) |
| **Queue** | `/queue` | Real-time patient queue with check-in |
| **QueueDisplayBoard** | `/queue-display` | Public kiosk/TV display |

### Laboratory

| Page | Path | Purpose |
|------|------|---------|
| **Laboratory** | `/laboratory` | Lab orders, results, specimens |
| **LabCheckIn** | `/lab-checkin` | Specimen check-in workflow |
| **LabTechWorklist** | `/lab-worklist` | Technician worklist |

### Pharmacy

| Page | Path | Purpose |
|------|------|---------|
| **Prescriptions** | `/prescriptions` | Dispensing with prior auth workflow |
| **PharmacyDashboard** | `/pharmacy` | Inventory, alerts, low stock |

### Billing & Financial

| Page | Path | Purpose |
|------|------|---------|
| **Invoicing** | `/invoicing` | Invoice creation, payments |
| **Financial** | `/financial` | Revenue reports, aging, commissions |
| **Companies** | `/companies` | Convention/insurance management |

### Inventory Management

| Page | Path | Purpose |
|------|------|---------|
| **FrameInventory** | `/inventory/frames` | Eyeglass frames |
| **OpticalLensInventory** | `/inventory/lenses` | Optical lenses |
| **ContactLensInventory** | `/inventory/contacts` | Contact lenses |
| **ReagentInventory** | `/inventory/reagents` | Lab reagents |
| **CrossClinicInventory** | `/inventory/cross-clinic` | Multi-clinic transfers |

### Optical Shop

| Page | Path | Purpose |
|------|------|---------|
| **OpticalShop** | `/optical-shop` | Retail dashboard |
| **NewSale** | `/optical-shop/new-sale` | Sales wizard |

### Device & Equipment

| Page | Path | Purpose |
|------|------|---------|
| **DeviceManager** | `/devices` | Device registration, maintenance |
| **DeviceStatusDashboard** | `/device-status` | Equipment monitoring |
| **NetworkDiscovery** | `/network-discovery` | Auto-discovery |

### Surgery

| Page | Path | Purpose |
|------|------|---------|
| **Surgery** | `/surgery` | Case management, scheduling |

### Settings & Admin

| Page | Path | Purpose |
|------|------|---------|
| **Settings** | `/settings` | User, clinic, billing, security settings |
| **AuditTrail** | `/audit` | Activity logging |
| **BackupManagement** | `/backup` | Backup/restore |

### Special Purpose

| Page | Path | Purpose |
|------|------|---------|
| **IVTDashboard** | `/ivt` | Intravitreal therapy tracking |
| **NurseVitalsEntry** | `/nurse-vitals` | Vitals data entry |
| **Approvals** | `/approvals` | Invoice approval workflow |
| **PublicBooking** | `/booking` | Self-service appointment booking |

---

## Components

### UI Foundation (14 components)

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **Button** | Standardized button | 9 variants, icons, loading |
| **Card** | Container component | 7 variants, StatCard subcomponent |
| **AccessibleModal** | Accessible dialog | Focus trap, ARIA, portal |
| **ConfirmationModal** | Action confirmation | Type-based icons/colors |
| **Toast** | Notifications | Auto-dismiss, types |
| **LoadingSpinner** | Loading indicator | Size variants |
| **EmptyState** | Empty content | Type-based messages, tips |
| **StatusBadge** | Status indicator | Multiple status types |
| **ErrorBoundary** | Error catching | PHI scrubbing, recovery |

### Layout Components

| Component | Purpose |
|-----------|---------|
| **ColumnLayout** | 2-4 column responsive layouts with StudioVision colors |
| **CollapsibleSection** | Expandable content sections |
| **PanelBase** | Base collapsible panel with pinning |

### Biometric Components

| Component | Purpose |
|-----------|---------|
| **WebcamCapture** | Camera photo capture with face detection |
| **FaceVerification** | Patient identity verification |
| **PatientPhotoAvatar** | Profile photo display with badges |

### Clinical Components

| Component | Purpose |
|-----------|---------|
| **PatientAlertsBanner** | Real-time safety alerts, allergies |
| **TemplateSelector** | Consultation template dropdown |
| **DocumentManager** | Document upload/search |

### Ophthalmology Components

| Component | Purpose |
|-----------|---------|
| **RefractionPanel** | Complete refraction entry |
| **AxisWheelSelector** | Visual axis dial |
| **IOPInput** | Intraocular pressure input |
| **KeratometryInput** | Corneal curvature entry |
| **VisualAcuitySelector** | VA notation selector |
| **LOCSIIIGrading** | Cataract classification |

### Prescription Components (StudioVision)

| Component | Purpose |
|-----------|---------|
| **TreatmentBuilder** | 4-column prescription builder |
| **DrugInteractionPanel** | Real-time drug safety |
| **FavoriteMedicationsBar** | 1-click favorites |
| **TreatmentProtocolSelector** | 2-click protocols |
| **MedicationScheduleGenerator** | Schedule generation |

### Pharmacy Components

| Component | Purpose |
|-----------|---------|
| **ReorderPanel** | Reorder suggestions |
| **BatchManager** | Lot/batch tracking |
| **DispenseDialog** | Dispensing workflow |

### Virtualized Components

| Component | Purpose |
|-----------|---------|
| **VirtualizedTable** | High-performance tables |
| **VirtualizedList** | Large list rendering |
| **VirtualizedPatientTable** | Patient-specific table |

### Patient Registration Flow (5 steps)

1. **PersonalInfoStep** - Name, DOB, gender
2. **ContactInfoStep** - Phone, email, address
3. **MedicalHistoryStep** - Allergies, conditions
4. **BiometricStep** - Photo capture
5. **InsuranceStep** - Insurance info

---

## Hooks

### Core Hooks

| Hook | Purpose |
|------|---------|
| **useApi** | Standardized API calls with retry |
| **useApiMutation** | POST/PUT/DELETE operations |
| **usePaginatedApi** | Paginated endpoint handling |
| **usePermissions** | Role-based access checks |
| **useRedux** | Custom Redux selectors/dispatchers |

### Offline Support

| Hook | Purpose |
|------|---------|
| **useOfflineData** | Offline-first data fetching |
| **useOfflineMutation** | Offline-capable mutations |
| **useOnlineStatus** | Connection status |
| **useSyncStatus** | Sync progress tracking |
| **useOffline** | Comprehensive offline management |

### Clinical Hooks

| Hook | Purpose |
|------|---------|
| **useAutoSave** | Debounced auto-save with conflict handling |
| **usePreviousExamData** | Copy from previous exam |
| **useAlertEvaluation** | Real-time clinical alerts |
| **useTrendData** | IOP, VA, Cup/Disc trends |
| **usePatientAlerts** | Patient safety alerts |

### StudioVision Parity Hooks

| Hook | Purpose |
|------|---------|
| **useTreatmentProtocols** | Protocol management |
| **useFavoriteMedications** | Favorite medications |
| **useViewPreference** | Standard/compact toggle |

### Utility Hooks

| Hook | Purpose |
|------|---------|
| **useFileUpload** | File upload with progress |
| **useTabProgression** | Multi-step wizard |
| **useKeyboardShortcuts** | Keyboard navigation |
| **useWebSocket** | Real-time connections |
| **useInventory** | Inventory management |
| **useAbortController** | Request cancellation |

---

## Services

### Core Services

| Service | Endpoints | Offline Support |
|---------|-----------|-----------------|
| **apiConfig** | Base axios configuration | CSRF, auth, interceptors |
| **authService** | `/auth/*` | Login, logout, refresh |
| **database** | IndexedDB | Full offline storage |
| **syncService** | Sync queue | Auto-sync on reconnect |
| **websocketService** | Socket.IO | Real-time messaging |

### Patient/Clinical Services

| Service | Endpoints | Offline Support |
|---------|-----------|-----------------|
| **patientService** | `/patients/*` | Yes (1hr cache) |
| **visitService** | `/visits/*` | Yes (30min cache) |
| **ophthalmologyService** | `/ophthalmology/*` | Yes (30min cache) |
| **prescriptionService** | `/prescriptions/*` | Optical only (safety) |
| **laboratoryService** | `/laboratory/*` | Yes (5min cache) |

### Billing Services

| Service | Endpoints | Offline Support |
|---------|-----------|-----------------|
| **billingService** | `/invoices/*`, `/payments/*` | Yes (5min cache) |
| **appointmentService** | `/appointments/*` | Yes (5min cache) |
| **queueService** | `/queue/*` | Yes (1min cache) |

### StudioVision Services

| Service | Endpoints | Purpose |
|---------|-----------|---------|
| **treatmentProtocolService** | `/treatment-protocols/*` | Protocol management |
| **userService** | `/users/favorites/*` | Favorite medications |

### Inventory Services (6)

- frameInventoryService
- opticalLensInventoryService
- contactLensInventoryService
- pharmacyInventoryService
- reagentInventoryService
- labConsumableInventoryService

---

## Contexts

| Context | Purpose | Key State |
|---------|---------|-----------|
| **AuthContext** | Authentication | user, permissions, roles |
| **PatientContext** | Selected patient | selectedPatient, history |
| **PatientCacheContext** | Patient caching | LRU cache with 5min TTL |
| **HistoryContext** | Medical history | 7 history sections |
| **ClinicContext** | Multi-clinic | selectedClinic, clinics |

---

## Modules

### Patient Module

| Export | Purpose |
|--------|---------|
| **PatientSelector** | Unified patient search (dropdown/modal/inline) |
| **usePatientData** | Comprehensive patient data hook |
| **usePatientProfile** | Profile-only hook |
| **usePatientClinical** | Clinical data bundle |

### Clinical Module

| Export | Purpose |
|--------|---------|
| **ClinicalWorkflow** | Configuration-driven workflow orchestrator |
| **useClinicalSession** | Session management |
| **ophthalmologyWorkflowConfig** | Full 14-step workflow |
| **quickFollowUpWorkflowConfig** | 5-step follow-up |
| **refractionOnlyWorkflowConfig** | 5-step refraction |

### Prescription Module

| Export | Purpose |
|--------|---------|
| **usePrescriptionSafety** | Comprehensive safety checking |
| **quickAllergyCheck** | Standalone allergy check |
| **quickInteractionCheck** | Standalone interaction check |

### Dashboard Module

| Export | Purpose |
|--------|---------|
| **DashboardContainer** | Role-based dashboard |
| **useDashboardData** | Dashboard data fetching |
| **StatsWidget** | Reusable stat cards |

---

## Layouts

### MainLayout
- Desktop sidebar with role-based navigation
- Top bar with PatientSelector, ClinicSelector
- Offline indicators, sync status
- Keyboard shortcuts (Ctrl+H, Ctrl+P, Ctrl+Q, etc.)

### PatientLayout
- Patient portal layout
- Blue theme, simplified navigation
- 7 menu items for patient self-service

---

## Utilities

| File | Functions | Purpose |
|------|-----------|---------|
| **apiHelpers.js** | 15+ | Response normalization, safe access |
| **exportUtils.js** | 8+ | CSV/JSON export |
| **formatters.js** | 25+ | Date, currency, name formatting |
| **ophthalmologyCalculations.js** | 15+ | SE, IOL, VA conversions |
| **performance.js** | 8+ | Debounce, throttle, LRU cache |
| **prescriptionSafety.js** | 8+ | Drug safety checks |
| **statusHelpers.js** | 20+ | Status configs, priority sorting |
| **validationSchemas.js** | 15+ | Form validation |

---

## Workflow Connections

### Consultation Flow
```
NewConsultation
├── PatientSelector → PatientContext
├── FaceVerification → biometric/FaceVerification
├── ClinicalWorkflow (clinical module)
│   ├── ChiefComplaintStep
│   ├── VitalSignsStep
│   ├── VisualAcuityStep (VisualAcuitySelector)
│   ├── ObjectiveRefractionStep (RefractionPanel)
│   ├── SubjectiveRefractionStep (RefractionPanel)
│   ├── OphthalmologyExamStep (LOCSIIIGrading, PatientAlertsBanner)
│   ├── ContactLensFittingStep (ContactLensFitting)
│   ├── DiagnosisStep
│   ├── PrescriptionStep
│   │   ├── OpticalPrescriptionTab
│   │   └── MedicationPrescriptionTab
│   │       ├── TreatmentBuilder (4-column StudioVision)
│   │       ├── FavoriteMedicationsBar (1-click)
│   │       ├── TreatmentProtocolSelector (2-click)
│   │       └── DrugInteractionPanel (safety)
│   └── SummaryStep
└── ConsultationDashboard (consolidated view)
    ├── RefractionPanel
    ├── ExaminationPanel
    ├── DiagnosticPanel
    └── PrescriptionModule
        ├── FavoriteMedicationsBar
        ├── TreatmentProtocolSelector
        └── DrugInteractionPanel
```

### Patient Record Flow
```
PatientDetail
├── PatientPhotoAvatar
├── PatientAlertsBanner (usePatientAlerts)
├── PatientCompactDashboard (compact view)
├── OphthalmologySection
├── PrescriptionsSection
├── AppointmentsSection
├── ImagingSection
├── LabSection
├── BillingSection
├── SurgeryHistorySection
└── TimelineSection
```

---

## StudioVision Parity Features

### Implemented Features (~98% parity)

| Feature | Component/Hook | Status |
|---------|---------------|--------|
| 4-column TreatmentBuilder | TreatmentBuilder | Complete |
| 1-click favorite medications | FavoriteMedicationsBar, useFavoriteMedications | Complete |
| 2-click treatment protocols | TreatmentProtocolSelector, useTreatmentProtocols | Complete |
| Drug interaction checking | DrugInteractionPanel | Complete |
| Patient safety alerts | PatientAlertsBanner, usePatientAlerts | Complete |
| LOCS III cataract grading | LOCSIIIGrading | Complete |
| View preference toggle | useViewPreference | Complete |
| Compact dashboard view | PatientCompactDashboard | Complete |

### Integration Points

1. **ConsultationDashboard** - All prescription tools integrated
2. **OphthalmologyExamStep** - LOCS III + patient alerts
3. **PrescriptionStep** - StudioVision mode indicator
4. **NewConsultation** - View preference toggle
5. **PatientDetail** - Compact view toggle

---

## File Statistics

| Category | Count |
|----------|-------|
| Pages | 60+ |
| Components | 100+ |
| Hooks | 20+ |
| Services | 80+ |
| Contexts | 5 |
| Modules | 4 |
| Layouts | 2 |
| Utils | 8 |
| **Total** | **628+** |

---

## Key Design Patterns

1. **Offline-First**: All read ops cached, mutations queued
2. **Real-Time**: WebSocket for queue/appointments/billing/lab
3. **Role-Based**: Database-driven permissions, PermissionGate
4. **Multi-Clinic**: ClinicContext with scoped filtering
5. **Clinical Workflows**: ClinicalWorkflow orchestrator
6. **StudioVision**: 4-column layouts, favorites, protocols
7. **Accessibility**: ARIA, focus trap, keyboard nav
8. **Performance**: Virtualization, LRU caching, debouncing

---

*This catalog was generated by comprehensive exploration of the MedFlow frontend codebase.*
