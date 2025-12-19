# StudioVision Consolidation Plan

**Date:** December 18, 2025
**Status:** In Progress (Phases 1-2 Complete, Phase 4 Partial)
**Goal:** Consolidate MedFlow codebase following StudioVision patterns to eliminate 60-80% of duplicate code

## Current Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1.1 Delete backup files | ✅ Complete | 8 backup files deleted |
| 1.2 Consolidate seed scripts | ✅ Complete | setup.js with 40+ scripts |
| 2.1 Shared Modal system | ✅ Complete | BaseModal, ConfirmModal, FormModal, WizardModal |
| 2.2 Shared Step system | ✅ Complete | WizardContainer created |
| 2.3 Shared Form components | ✅ Complete | FormField, FormSection, ClinicalInput |
| 3.1 Unified Inventory model | ✅ Complete | Inventory.js with 7 discriminators (Dec 19) |
| 3.2 Unified Inventory controller | ✅ Complete | UnifiedInventoryController.js (Dec 19) |
| 3.3 Unified Inventory routes | ✅ Complete | /api/unified-inventory routes (Dec 19) |
| 3.4 Unified Inventory service | ✅ Complete | unifiedInventoryService in frontend (Dec 19) |
| 3.5 Unified frontend components | ✅ Complete | UnifiedInventory page, Form, StockOperationModal |
| 3.6 Data migration | ✅ Complete | 4,986 documents migrated (Dec 19) |
| 3.7 Delete legacy inventory | ⏳ Pending | After full transition verified |
| 4.1-4.2 Consultation consolidation | ✅ Complete | StudioVision as canonical, deprecation banner added |
| 4.3 Refraction consolidation | ⏳ Not Started | Deduplication needed |
| 5 Dashboard consolidation | ⏳ Not Started | 8 hours estimated |
| 6 Service layer cleanup | ⏳ Not Started | 12 hours estimated |

### Phase 3 Inventory Unification Details (Dec 19, 2025)

**Backend Architecture Created:**
- `backend/models/Inventory.js` - Unified model with Mongoose discriminators for all 7 inventory types
- `backend/controllers/inventory/UnifiedInventoryController.js` - Single controller handling all inventory operations
- `backend/routes/unifiedInventory.js` - Complete REST API at `/api/unified-inventory`
- `backend/controllers/inventory/index.js` - Updated exports

**Frontend Service Created:**
- `frontend/src/services/inventory/index.js` - Added `unifiedInventoryService` with full API coverage

**Inventory Types Unified:**
| Type | Model | Status |
|------|-------|--------|
| pharmacy | PharmacyInventory | ✅ Discriminator created |
| frame | FrameInventory | ✅ Discriminator created |
| contact_lens | ContactLensInventory | ✅ Discriminator created |
| optical_lens | OpticalLensInventory | ✅ Discriminator created |
| reagent | ReagentInventory | ✅ Discriminator created |
| lab_consumable | LabConsumableInventory | ✅ Discriminator created |
| surgical_supply | SurgicalSupplyInventory | ✅ Discriminator created |

**Phase 3 Completed Work (Dec 19, 2025):**
1. ~~Create unified frontend components~~ ✅ Complete - UnifiedInventory/index.jsx, UnifiedInventoryForm.jsx, StockOperationModal.jsx
2. ~~Write data migration script~~ ✅ Complete - migrateToUnifiedInventory.js
3. ~~Execute data migration~~ ✅ Complete - 4,986 documents migrated (806 frame, 206 contact_lens, 804 optical_lens, 2540 pharmacy, 336 reagent, 276 lab_consumable, 18 surgical_supply)
4. Update all references (prescriptions, invoices, etc.) - **PHASED APPROACH** (deferred)
5. Delete legacy inventory models/controllers - **AFTER FULL TRANSITION**

### Phase 3 Reference Update Strategy

Due to extensive cross-model references, the update follows a **parallel operation** approach:

**Legacy References Found:**
- `Prescription.js` → `PharmacyInventory`
- `GlassesOrder.js` → `FrameInventory`, `OpticalLensInventory`, `ContactLensInventory`
- `SurgeryCase.js` → `PharmacyInventory`, `SurgicalSupplyInventory`
- `InventoryTransfer.js` → All inventory types
- `OphthalmologyExam.js` → `ContactLensInventory`
- 23 controllers with inventory references

**Migration Strategy:**
1. **Phase A (Complete):** Unified model, controller, routes, frontend created
2. **Phase B (Complete):** Migration script executed - 4,986 documents in unified collection
3. **Phase C (Future):** Gradually update model references as features are modified
4. **Phase D (Future):** Deprecate and remove legacy models after 100% migration

**Current Status (Dec 19, 2025):** ✅ Both systems work in parallel. Unified inventory API fully operational at `/api/unified-inventory`. Frontend accessible at `/unified-inventory`. Role-specific views (Pharmacist, Optician, Lab Tech) link to unified inventory. New features should use unified API. Legacy features continue to work with legacy models.

## Executive Summary

The MedFlow codebase has grown organically with significant duplication across 10 major areas. This plan consolidates the codebase using **StudioVision** as the canonical design pattern, reducing:
- 8 inventory systems → 1 unified system
- 24 prescription components → 6 focused components
- 6 consultation flows → 1 StudioVision flow
- 28 modals → 8-10 shared modal patterns
- 38 seed scripts → 1 unified setup script

**Estimated Code Reduction:** ~40,000 lines (from ~120,000 to ~80,000)

---

## Phase 1: Quick Wins (1-2 days)

### 1.1 Delete Backup Files
**Impact:** Immediate cleanup, removes confusion
**Risk:** None (all in git history)

```
Files to DELETE:
- backend/models/Invoice.backup.js
- backend/routes/prescriptions.backup.js
- backend/services/lisIntegrationService.backup.js
- backend/services/doseCalculationService.backup.js
- backend/routes/pharmacy.bak.js
- frontend/src/pages/Pharmacy.backup.jsx
- frontend/src/pages/PatientDetail.backup.jsx
- frontend/src/pages/PatientDetail.backup2.jsx
- frontend/src/pages/ophthalmology/NewConsultation.backup.jsx
```

**Action:** `git rm` all backup files

### 1.2 Consolidate Seed Scripts
**Impact:** 38 scripts → 1 unified setup
**Benefit:** Single command to seed complete system

**Current State:**
```
backend/scripts/
├── seedAdditionalServices.js
├── seedAllClinicEquipment.js
├── seedAllClinicMedications.js
├── seedAppointmentTypes.js
├── seedClinicDevices.js
├── seedClinicalProcedures.js
├── seedClinics.js
├── seedCompleteFeeSchedule.js
├── seedCongo.js
├── seedCongoData.js
├── seedContactLensInventory.js
├── seedConsultationTemplates.js
├── seedConventionRules.js
├── seedConventions.js
├── seedDepotFrames.js
├── seedDiscoveredDevices.js
├── seedDocumentTemplates.js
├── seedDoseTemplatesComplete.js
├── seedFeeScheduleAliases.js
├── seedFrameInventory.js
├── seedFrenchClinicalActs.js
├── seedFrenchDrugs.js
├── seedImagingData.js
├── seedLabConsumableInventory.js
├── seedLetterTemplates.js
├── seedMedicationFeeSchedules.js
├── seedOpticalLensInventory.js
├── seedPharmacyInventory.js
├── seedReagentInventory.js
├── seedRolePermissions.js
├── seedTemplates.js
├── seedTreatmentProtocolsComplete.js
├── seedVitaminsFromTemplates.js
└── ... (5 more)
```

**Target State:**
```
backend/scripts/
├── setup.js                    # MAIN: orchestrates all seeding
├── seeds/
│   ├── index.js               # Export all seed functions
│   ├── clinics.js             # Clinic + conventions
│   ├── users.js               # Admin + demo users + roles
│   ├── services.js            # Fee schedules + procedures
│   ├── inventory.js           # ALL inventory types unified
│   ├── templates.js           # ALL templates (document, letter, consultation)
│   ├── devices.js             # Device catalog + discovered
│   └── reference-data.js      # Drugs, ICD codes, etc.
```

**Implementation:**
1. Create `seeds/` directory
2. Move seed functions as exports (not standalone scripts)
3. Create unified `setup.js` with:
   - `--full` flag for complete seeding
   - `--inventory` flag for inventory only
   - `--users` flag for users only
   - Idempotent (safe to run multiple times)

---

## Phase 2: Shared Component Library (3-5 days)

### 2.1 Create Shared Modal System
**Impact:** 28 modals → BaseModal + 8-10 specialized variants

**Current Problem:**
Every modal reimplements: overlay, animation, close-on-escape, close-on-outside-click, header, footer buttons.

**Solution: Create `frontend/src/components/shared/Modal/`**

```jsx
// BaseModal.jsx - shared foundation
export function BaseModal({
  isOpen,
  onClose,
  title,
  size = 'md', // sm, md, lg, xl, full
  children,
  footer,
  closeOnOverlay = true,
  closeOnEscape = true,
}) { /* shared logic */ }

// ConfirmModal.jsx - yes/no dialogs
export function ConfirmModal({ onConfirm, confirmLabel, danger, ...props })

// FormModal.jsx - form with save/cancel
export function FormModal({ onSave, loading, dirty, ...props })

// WizardModal.jsx - multi-step with progress
export function WizardModal({ steps, currentStep, onNext, onBack, ...props })
```

**Migration Path:**
1. Create BaseModal with all shared behavior
2. Create specialized variants
3. Migrate existing modals one-by-one (keep old working during migration)
4. Delete old modal implementations

### 2.2 Create Shared Step System
**Impact:** 28 step components → StepContainer + domain-specific steps

**Current Problem:**
Each step file has identical progress indicator, navigation buttons, validation patterns.

**Solution: Create `frontend/src/components/shared/Wizard/`**

```jsx
// WizardContainer.jsx
export function WizardContainer({
  steps,        // [{id, title, component, validate?}]
  data,
  onChange,
  onComplete,
}) { /* shared step navigation */ }

// StepProgress.jsx - visual progress indicator
// StepNavigation.jsx - next/back/skip buttons
```

**Current Step Files to Consolidate:**
```
Patient Registration Steps (6 files):
- PatientPersonalInfoStep.jsx → PatientWizard with PersonalInfoContent
- PatientContactStep.jsx → PatientWizard with ContactContent
- PatientMedicalHistoryStep.jsx → PatientWizard with MedicalHistoryContent
- PatientInsuranceStep.jsx → PatientWizard with InsuranceContent
- PatientSummaryStep.jsx → PatientWizard with SummaryContent
- PatientPhotoStep.jsx → PatientWizard with PhotoContent

Consultation Steps (8 files) → StudioVision tabs (already done)
Lab Steps (4 files) → LabWizard
Prescription Steps (4 files) → PrescriptionWizard
```

### 2.3 Create Shared Form Components
**Impact:** Consistent form UX across all modules

```
frontend/src/components/shared/Form/
├── FormField.jsx          # Label + input + error
├── FormSection.jsx        # Collapsible section with header
├── FormGrid.jsx           # Responsive grid layout
├── ClinicalInput.jsx      # OD/OS aware input
├── SearchableSelect.jsx   # Patient/drug/service search
└── index.js
```

---

## Phase 3: Inventory Unification (5-7 days)

### 3.1 Analysis of Current Inventory Systems

**8 Inventory Models (85%+ identical):**
| Model | Unique Fields | Shared Fields |
|-------|--------------|---------------|
| PharmacyInventory | drugId, dosageForm | quantity, reorderPoint, clinic, location, lastRestocked |
| FrameInventory | frameStyle, material | quantity, reorderPoint, clinic, location, lastRestocked |
| ContactLensInventory | baseCurve, diameter | quantity, reorderPoint, clinic, location, lastRestocked |
| OpticalLensInventory | lensType, coating | quantity, reorderPoint, clinic, location, lastRestocked |
| ReagentInventory | reagentType, calibration | quantity, reorderPoint, clinic, location, lastRestocked |
| LabConsumableInventory | consumableType | quantity, reorderPoint, clinic, location, lastRestocked |
| SurgicalSupplyInventory | supplyCategory | quantity, reorderPoint, clinic, location, lastRestocked |
| EquipmentCatalog | equipmentType, warranty | quantity, reorderPoint, clinic, location, lastRestocked |

### 3.2 Unified Inventory Architecture

**New Model: `Inventory.js`**
```javascript
const InventorySchema = new mongoose.Schema({
  // SHARED FIELDS (all inventory types)
  inventoryType: {
    type: String,
    enum: ['pharmacy', 'frame', 'contact_lens', 'optical_lens',
           'reagent', 'lab_consumable', 'surgical_supply', 'equipment'],
    required: true,
    index: true
  },
  name: String,
  sku: String,
  quantity: Number,
  reorderPoint: Number,
  reorderQuantity: Number,
  clinic: { type: ObjectId, ref: 'Clinic' },
  location: String,
  expirationDate: Date,
  lastRestocked: Date,
  unitPrice: Number,
  supplier: { type: ObjectId, ref: 'Supplier' },

  // TYPE-SPECIFIC FIELDS (discriminator pattern)
  typeData: mongoose.Schema.Types.Mixed
}, {
  discriminatorKey: 'inventoryType'
});

// Create discriminators for type-specific validation
const PharmacyInventory = Inventory.discriminator('pharmacy', pharmacySchema);
const FrameInventory = Inventory.discriminator('frame', frameSchema);
// etc.
```

**New Controller: `inventoryController.js`**
```javascript
// Single controller handles all inventory types
class UnifiedInventoryController {
  // Generic CRUD
  async getItems(req, res) { /* filter by inventoryType */ }
  async createItem(req, res) { /* validate typeData based on inventoryType */ }
  async updateItem(req, res) { /* ... */ }
  async deleteItem(req, res) { /* ... */ }

  // Shared operations
  async getLowStock(req, res) { /* works for ALL types */ }
  async transfer(req, res) { /* inter-clinic transfer */ }
  async adjustQuantity(req, res) { /* stock adjustment */ }
  async getExpiringItems(req, res) { /* expiration alerts */ }
}
```

**New Routes: `/api/inventory`**
```
GET    /api/inventory?type=pharmacy&clinic=xxx
POST   /api/inventory
PUT    /api/inventory/:id
DELETE /api/inventory/:id
GET    /api/inventory/low-stock?type=all
POST   /api/inventory/transfer
GET    /api/inventory/expiring?days=30
```

### 3.3 Frontend Inventory Components

**New: `frontend/src/pages/Inventory/`**
```
Inventory/
├── index.jsx                    # Main inventory page with type tabs
├── InventoryTable.jsx           # Shared table component
├── InventoryFilters.jsx         # Type-aware filters
├── InventoryForm.jsx            # Dynamic form based on type
├── types/
│   ├── PharmacyFields.jsx       # Pharmacy-specific form fields
│   ├── FrameFields.jsx          # Frame-specific form fields
│   ├── ContactLensFields.jsx    # Contact lens-specific fields
│   └── ... (one per type)
└── hooks/
    └── useInventory.js          # Unified inventory hook
```

**Migration Path:**
1. Create unified Inventory model with discriminators
2. Write migration script to move existing data
3. Create unified controller and routes
4. Create unified frontend components
5. Update all references (prescriptions, invoices, etc.)
6. Delete old inventory models/controllers/components

---

## Phase 4: Consultation Flow Consolidation (3-5 days)

### 4.1 Current Consultation Flows

**6 Different Consultation Implementations:**
1. `StudioVisionConsultation.jsx` - Tab-based (CANONICAL)
2. `NewConsultation.jsx` - Wizard-based (DEPRECATE)
3. `ConsultationDashboard.jsx` - Read-only view (KEEP as archive viewer)
4. `OphthalmologyDashboard.jsx` - Clinic view (REFACTOR to use StudioVision)
5. `OphthalmologyExamStep.jsx` - Step in wizard (DEPRECATE)
6. `DiagnosticPanel.jsx` - Embedded panel (REFACTOR to StudioVision tab)

### 4.2 StudioVision as Canonical Flow

**Keep and Enhance:**
```
StudioVisionConsultation.jsx
├── QuickActionsBar         ✓ Implemented
├── DeviceDataBanner        ✓ Implemented
├── Tabs:
│   ├── Résumé              ✓ ResumeTab.jsx
│   ├── Réfraction          ✓ StudioVisionRefractionGrid
│   ├── Lentilles           ✓ LentillesTab (needs enhancement)
│   ├── Pathologies         ✓ PathologiesTab
│   ├── Orthoptie           ✓ OrthoptieQuickPanel (implemented)
│   ├── Examen              ✓ ExamenTab
│   ├── Traitement          ✓ TraitementTab
│   └── Règlement           ✓ ReglementTab
```

**Deprecation Path:**
1. Add banner to `NewConsultation.jsx`: "Cette interface sera remplacée par StudioVision"
2. Route `/ophthalmology/new` → `/consultation/studio/:patientId/:visitId`
3. Keep `NewConsultation.jsx` for 2 weeks for staff transition
4. Delete after transition period

### 4.3 Refraction Component Consolidation

**Current Duplicates:**
```
frontend/src/pages/ophthalmology/components/panels/RefractionPanel.jsx  (main)
frontend/src/components/ophthalmology/RefractionPanel.jsx               (duplicate)
frontend/src/pages/ophthalmology/components/RefractionStep.jsx          (wizard step)
frontend/src/components/consultation/StudioVisionRefractionGrid.jsx     (StudioVision)
frontend/src/components/refraction/VisualAcuityPanel.jsx
frontend/src/components/refraction/SubjectiveRefraction.jsx
frontend/src/components/refraction/ObjectiveRefraction.jsx
frontend/src/components/refraction/CycloplegicRefraction.jsx
```

**Target State:**
```
frontend/src/components/refraction/
├── index.js                      # Exports all
├── RefractionPanel.jsx           # Main panel (enhanced)
├── VisualAcuityPanel.jsx         # AV SC/AC for OD/OS
├── SubjectiveRefraction.jsx      # Subjective with trial lens
├── ObjectiveRefraction.jsx       # AR/Keratometry
├── CycloplegicRefraction.jsx     # Cycloplegic refraction
├── StudioVisionRefractionGrid.jsx # Grid layout for StudioVision
└── hooks/
    └── useRefractionCalculations.js # Shared calculations
```

**Action:**
1. Identify which `RefractionPanel.jsx` has the most complete implementation
2. Merge unique features from both into one
3. Delete duplicate
4. Update all imports

---

## Phase 5: Dashboard Consolidation (2-3 days)

### 5.1 Current Dashboard Situation

**13 Dashboard Files:**
```
frontend/src/pages/
├── Dashboard.jsx              # Generic dashboard
├── HomeDashboard.jsx          # Home with modules
├── Home.jsx                   # Simple home (redirect?)
├── FinancialDashboard.jsx     # Financial metrics
├── Analytics.jsx              # Analytics page
├── ophthalmology/
│   └── OphthalmologyDashboard.jsx
├── surgery/
│   └── SurgeryDashboard.jsx
├── IVT/
│   └── IVTDashboard.jsx
├── laboratory/
│   └── LabDashboard.jsx
├── optical-shop/
│   └── OpticalShopDashboard.jsx
├── pharmacy/
│   └── PharmacyDashboard.jsx
├── visits/
│   └── VisitDashboard.jsx
└── queue/
    └── QueueDashboard.jsx
```

### 5.2 Unified Dashboard Architecture

**Keep Domain Dashboards, Consolidate Home:**
```
frontend/src/pages/
├── Dashboard/
│   ├── index.jsx              # Smart router based on user role
│   ├── AdminDashboard.jsx     # Admin view (merge Dashboard + Analytics)
│   ├── ClinicalDashboard.jsx  # Clinical staff view
│   ├── widgets/
│   │   ├── PatientStats.jsx
│   │   ├── AppointmentCalendar.jsx
│   │   ├── RevenueChart.jsx
│   │   └── AlertsWidget.jsx
│   └── hooks/
│       └── useDashboardData.js
```

**Delete/Merge:**
- `Home.jsx` → Redirect to `/dashboard`
- `HomeDashboard.jsx` → Merge into `Dashboard/index.jsx`
- `Dashboard.jsx` → Merge into `AdminDashboard.jsx`

---

## Phase 6: Service Layer Cleanup (2-3 days)

### 6.1 Offline Service Pattern Standardization

**Current Inconsistency:**
```javascript
// Pattern A: Dedicated offline service
import { offlinePatientService } from './offline/offlinePatientService';

// Pattern B: Wrapper function
import { offlineWrapper } from '../utils/offlineWrapper';
const getPatients = offlineWrapper('patients', patientService.getPatients);

// Pattern C: Mixed in service
export const patientService = {
  getPatients: async () => {
    if (isOffline()) return localDB.get('patients');
    return api.get('/patients');
  }
};
```

**Standardize on Pattern B (offlineWrapper):**
```javascript
// All services use wrapper
import { offlineWrapper, offlineSync } from '../utils/offlineWrapper';

export const patientService = {
  getPatients: offlineWrapper('patients', () => api.get('/patients')),
  createPatient: offlineSync('patients', (data) => api.post('/patients', data)),
  // ...
};
```

### 6.2 Service Consolidation

**Merge Similar Services:**
```
Current:
- authService.js + sessionService.js → authService.js
- appointmentService.js + calendarService.js → scheduleService.js
- invoiceService.js + billingService.js + paymentService.js → billingService.js
```

---

## Implementation Priority Matrix

| Phase | Task | Impact | Effort | Priority |
|-------|------|--------|--------|----------|
| 1.1 | Delete backup files | Low | 5 min | P0 - Do Now |
| 1.2 | Consolidate seed scripts | Medium | 4 hrs | P1 - This Week |
| 2.1 | Shared Modal system | High | 8 hrs | P1 - This Week |
| 2.2 | Shared Step system | High | 6 hrs | P1 - This Week |
| 3 | Inventory unification | Very High | 20 hrs | P2 - Next Week |
| 4 | Consultation consolidation | Very High | 16 hrs | P2 - Next Week |
| 5 | Dashboard consolidation | Medium | 8 hrs | P3 - Following Week |
| 6 | Service layer cleanup | Medium | 12 hrs | P3 - Following Week |

---

## Files to Delete (After Migration)

**Immediate Deletion (backup files):**
```
backend/models/Invoice.backup.js
backend/routes/prescriptions.backup.js
backend/services/lisIntegrationService.backup.js
backend/services/doseCalculationService.backup.js
backend/routes/pharmacy.bak.js
frontend/src/pages/Pharmacy.backup.jsx
frontend/src/pages/PatientDetail.backup.jsx
frontend/src/pages/PatientDetail.backup2.jsx
frontend/src/pages/ophthalmology/NewConsultation.backup.jsx
```

**After Inventory Unification:**
```
backend/models/PharmacyInventory.js → merged into Inventory.js
backend/models/FrameInventory.js
backend/models/ContactLensInventory.js
backend/models/OpticalLensInventory.js
backend/models/ReagentInventory.js
backend/models/LabConsumableInventory.js
backend/models/SurgicalSupplyInventory.js

backend/controllers/inventory/*.js → merged into inventoryController.js

frontend/src/pages/PharmacyInventory.jsx → merged into Inventory/
frontend/src/pages/FrameInventory.jsx
frontend/src/pages/ContactLensInventory.jsx
... (all inventory pages)
```

**After Consultation Consolidation:**
```
frontend/src/pages/ophthalmology/NewConsultation.jsx → replaced by StudioVision
frontend/src/pages/ophthalmology/components/OphthalmologyExamStep.jsx
frontend/src/components/ophthalmology/RefractionPanel.jsx (duplicate)
```

---

## Success Metrics

| Metric | Current | Target | Reduction |
|--------|---------|--------|-----------|
| Total JS/JSX files | 674 | ~450 | 33% |
| Lines of code | ~120,000 | ~80,000 | 33% |
| Inventory models | 8 | 1 | 87% |
| Seed scripts | 38 | 8 | 79% |
| Modal components | 28 | 10 | 64% |
| Consultation flows | 6 | 2 | 67% |

---

## Risk Mitigation

1. **Data Migration Risk:** Write reversible migration scripts with rollback capability
2. **Breaking Changes:** Keep old routes working with deprecation warnings
3. **Staff Training:** Update user documentation before removing old UIs
4. **Regression Risk:** Run full E2E test suite after each phase

---

## Next Steps

1. ☐ Execute Phase 1.1 (delete backup files) - 5 minutes
2. ☐ Create `backend/scripts/seeds/` directory structure
3. ☐ Create `frontend/src/components/shared/Modal/` structure
4. ☐ Design unified Inventory model discriminators
5. ☐ Update frontend routing to prioritize StudioVision
