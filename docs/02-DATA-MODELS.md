# MedFlow Data Models Documentation

## Overview

MedFlow uses **MongoDB** with **Mongoose ODM** for data persistence. The system contains **73 data models** organized by domain. All models support multi-clinic operations and include comprehensive audit trails.

### Core Design Patterns

1. **Multi-Clinic Support**: Nearly all models include a `clinic` ObjectId reference
2. **Atomic ID Generation**: Uses `Counter` model with `$inc` for sequential IDs
3. **Optimistic Concurrency**: Version fields (`__v`) for conflict detection
4. **Audit Fields**: `createdBy`, `updatedBy`, `createdAt`, `updatedAt` on all models
5. **Soft Deletes**: Most models use `active`/`isActive` flags instead of hard deletes
6. **State Machines**: Status transitions with validation (e.g., Visit, SurgeryCase)

---

## Model Categories

| Category | Count | Description |
|----------|-------|-------------|
| Core Clinical | 15 | Patient records, visits, exams, prescriptions |
| Billing & Financial | 10 | Invoices, payments, fees, companies |
| Inventory | 7 | Pharmacy, optical, lab consumables |
| Laboratory | 8 | Lab orders, results, analyzers, reagents |
| Devices & Integration | 5 | Medical device management |
| Users & Access Control | 4 | Authentication, roles, audit |
| Multi-Clinic | 3 | Clinic management, synchronization |
| Templates & Configuration | 15 | Clinical templates, settings |
| Scheduling | 4 | Appointments, availability, rooms |
| Documents & Communication | 7 | Documents, correspondence, notifications |

---

## 1. Core Clinical Models

### 1.1 Patient (`Patient.js`)
**Purpose**: Central patient record - the core entity of the system.

```javascript
// Key Fields
{
  patientId: String,           // Auto-generated: "2025000001"
  medicalRecordNumber: String, // Legacy MRN support
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: 'male' | 'female' | 'other',
  nationalId: String,
  phone: String,
  email: String,

  // Address
  address: {
    street: String,
    city: String,
    province: String,
    country: String  // Default: 'RDC'
  },

  // Insurance/Convention
  convention: ObjectId,        // Ref: Company
  conventionNumber: String,    // Employee ID at company

  // Medical History
  allergies: [{
    allergen: String,
    severity: 'mild' | 'moderate' | 'severe',
    reaction: String
  }],

  medicalHistory: {
    diabetes: Boolean,
    hypertension: Boolean,
    glaucoma: Boolean,
    // ... other conditions
  },

  // Face Recognition
  faceEmbedding: [Number],     // 512-dimensional vector
  faceEnrolledAt: Date,

  // Multi-Clinic
  clinic: ObjectId,            // Primary clinic
  registeredClinics: [ObjectId] // Can visit multiple clinics
}
```

**Indexes**: `patientId` (unique), `nationalId` (unique, sparse), `phone`, `clinic`, `convention`, text search on names

**Key Methods**:
- `getAge()`: Calculate current age
- `getFullName()`: Return formatted name
- `checkDuplicates()`: Find potential duplicate patients

---

### 1.2 Visit (`Visit.js`)
**Purpose**: Clinical visit/encounter - tracks a patient's journey through the clinic.

```javascript
// Key Fields
{
  visitId: String,             // Auto-generated: "V2025000001"
  patient: ObjectId,           // Required, Ref: Patient
  clinic: ObjectId,

  // Status Machine
  status: 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'no-show',

  // Queue Management
  queueNumber: Number,
  queueStatus: 'waiting' | 'in-room' | 'completed',
  assignedRoom: ObjectId,

  // Visit Details
  visitType: 'consultation' | 'follow-up' | 'procedure' | 'emergency' | 'ivt',
  chiefComplaint: String,
  duration: Number,            // Estimated duration in minutes

  // Clinical Data (Embedded)
  vitals: {
    bloodPressure: { systolic: Number, diastolic: Number },
    heartRate: Number,
    temperature: Number,
    weight: Number,
    height: Number
  },

  // Clinical Acts Performed
  clinicalActs: [{
    act: ObjectId,             // Ref: ClinicalAct
    code: String,
    name: String,
    price: Number,
    quantity: Number,
    performedBy: ObjectId,
    performedAt: Date
  }],

  // Laboratory Orders
  laboratoryOrders: [{
    template: ObjectId,
    testName: String,
    status: 'ordered' | 'collected' | 'completed',
    results: Mixed
  }],

  // Pathology Findings
  pathologyFindings: [{
    organ: String,
    finding: String,
    laterality: 'OD' | 'OS' | 'OU'
  }],

  // Billing
  invoice: ObjectId,
  totalAmount: Number
}
```

**Status Transitions**:
```
scheduled → checked-in → in-progress → completed
         ↘ cancelled
         ↘ no-show → checked-in (can retry)
```

**Key Methods**:
- `completeVisit()`: Transaction-safe completion with invoice generation
- `checkIn()`: Assign queue number, update status
- `assignRoom()`: Move patient to examination room

---

### 1.3 OphthalmologyExam (`OphthalmologyExam.js`)
**Purpose**: Comprehensive ophthalmic examination record - 1493 lines, largest clinical model.

```javascript
// Key Fields
{
  patient: ObjectId,
  visit: ObjectId,
  examiner: ObjectId,
  examDate: Date,

  // Visual Acuity
  visualAcuity: {
    OD: {
      uncorrected: { distance: String, near: String },
      bestCorrected: { distance: String, near: String },
      pinhole: String
    },
    OS: { /* same structure */ }
  },

  // Refraction (Auto & Manifest)
  autorefraction: {
    OD: { sphere: Number, cylinder: Number, axis: Number, pupilSize: Number },
    OS: { /* same */ }
  },

  manifestRefraction: {
    OD: { sphere: Number, cylinder: Number, axis: Number, add: Number, pd: Number },
    OS: { /* same */ }
  },

  // Intraocular Pressure
  tonometry: {
    OD: { iop: Number, time: String, method: String },
    OS: { /* same */ },
    cct: { OD: Number, OS: Number }  // Pachymetry
  },

  // Anterior Segment
  anteriorSegment: {
    OD: {
      lids: String,
      conjunctiva: String,
      cornea: String,
      anteriorChamber: String,
      iris: String,
      pupil: String,
      lens: String,
      cataractGrade: String  // e.g., "NO2 NC2"
    },
    OS: { /* same */ }
  },

  // Posterior Segment
  posteriorSegment: {
    OD: {
      vitreous: String,
      disc: String,
      cdRatio: String,
      macula: String,
      vessels: String,
      periphery: String
    },
    OS: { /* same */ }
  },

  // Gonioscopy
  gonioscopy: {
    OD: { /* angles by quadrant */ },
    OS: { /* same */ }
  },

  // Device Measurements (Auto-imported)
  deviceMeasurements: [{
    measurement: ObjectId,
    device: ObjectId,
    measurementType: 'autorefractor' | 'tonometer' | 'keratometer' | 'oct',
    appliedToExam: Boolean
  }],

  // Diagnosis & Plan
  diagnosis: [{
    eye: 'OD' | 'OS' | 'OU',
    condition: String,
    icdCode: String,
    severity: String
  }],

  plan: String,
  followUp: { recommended: Boolean, interval: String }
}
```

**Key Methods**:
- `copyFromPrevious(examId)`: Copy baseline data from previous exam
- `applyDeviceMeasurement(measurementId)`: Apply device data to exam fields
- `generateRefractionSummary()`: Create prescription summary

---

### 1.4 Prescription (`Prescription.js`)
**Purpose**: Medication and optical prescriptions with drug safety integration.

```javascript
// Key Fields
{
  prescriptionId: String,      // "RX2025000001"
  patient: ObjectId,
  visit: ObjectId,
  prescriber: ObjectId,

  type: 'medication' | 'optical' | 'both',
  status: 'draft' | 'active' | 'dispensed' | 'cancelled' | 'expired',

  // Medications
  medications: [{
    drug: ObjectId,            // Ref: Drug
    drugName: String,
    dosage: String,
    frequency: String,
    duration: String,
    quantity: Number,
    route: 'oral' | 'topical' | 'injectable' | 'IV',
    instructions: String,

    // Tapering Support (for corticosteroids)
    tapering: {
      enabled: Boolean,
      schedule: [{
        startDay: Number,
        endDay: Number,
        frequency: String
      }]
    },

    // Safety Checks
    safetyChecks: {
      allergyCheck: { passed: Boolean, warnings: [String] },
      interactionCheck: { passed: Boolean, warnings: [String] },
      contraindications: [String]
    },

    // Inventory Reservation
    reserved: Boolean,
    reservedQuantity: Number,
    reservedFrom: ObjectId     // PharmacyInventory batch
  }],

  // Optical Prescription
  opticalPrescription: {
    OD: { sphere: Number, cylinder: Number, axis: Number, add: Number, prism: Number, base: String },
    OS: { /* same */ },
    pd: { distance: Number, near: Number },
    lensType: 'single-vision' | 'bifocal' | 'progressive',
    material: String,
    coatings: [String],
    expiryDate: Date           // Usually 2 years
  },

  // Dispensing
  dispensedAt: Date,
  dispensedBy: ObjectId,
  invoice: ObjectId
}
```

---

### 1.5 ConsultationSession (`ConsultationSession.js`)
**Purpose**: Tracks a complete consultation workflow with multiple steps.

```javascript
{
  sessionId: String,
  patient: ObjectId,
  visit: ObjectId,
  provider: ObjectId,

  status: 'in-progress' | 'completed' | 'paused' | 'cancelled',

  // Workflow Steps Completed
  stepsCompleted: {
    chiefComplaint: Boolean,
    visualAcuity: Boolean,
    refraction: Boolean,
    examination: Boolean,
    diagnosis: Boolean,
    prescription: Boolean,
    billing: Boolean
  },

  // Session Data
  chiefComplaint: String,
  duration: Number,

  // References to created records
  ophthalmologyExam: ObjectId,
  prescription: ObjectId,
  invoice: ObjectId,

  // Auto-save support
  draftData: Mixed,
  lastAutoSave: Date
}
```

---

### 1.6 IVTInjection (`IVTInjection.js`)
**Purpose**: Intravitreal injection tracking for AMD, DME, RVO treatments.

```javascript
{
  injectionId: String,
  patient: ObjectId,
  visit: ObjectId,

  // Injection Details
  eye: 'OD' | 'OS',
  medication: String,          // e.g., "Eylea", "Lucentis", "Avastin"
  dose: String,
  lotNumber: String,
  expiryDate: Date,

  // Treatment Protocol
  protocol: ObjectId,          // Ref: TreatmentProtocol
  indication: 'AMD' | 'DME' | 'RVO' | 'other',
  injectionNumber: Number,     // e.g., "3rd injection"

  // Pre-Injection Assessment
  preIOP: Number,
  visualAcuity: String,

  // Post-Injection
  postIOP: Number,
  complications: [String],

  // Scheduling
  nextInjectionDue: Date,
  status: 'scheduled' | 'completed' | 'cancelled' | 'missed'
}
```

---

### 1.7 OrthopticExam (`OrthopticExam.js`)
**Purpose**: Orthoptic (binocular vision) examination records.

```javascript
{
  patient: ObjectId,
  visit: ObjectId,
  examiner: ObjectId,

  // Cover Tests
  coverTest: {
    distance: { withCorrection: String, withoutCorrection: String },
    near: { withCorrection: String, withoutCorrection: String }
  },

  // Prism Measurements
  prismCover: {
    distance: { horizontal: Number, vertical: Number },
    near: { horizontal: Number, vertical: Number }
  },

  // Motility
  versions: { /* 9 positions of gaze */ },
  ductions: { OD: Mixed, OS: Mixed },

  // Near Point of Convergence
  npc: { breakPoint: Number, recoveryPoint: Number },

  // Stereopsis
  stereopsis: Number,          // Arc seconds
  stereopsisTest: String,      // e.g., "Titmus", "TNO"

  // Accommodation
  amplitude: { OD: Number, OS: Number },
  facility: { OD: Number, OS: Number },

  // Diagnosis
  diagnosis: String,
  recommendation: String
}
```

---

### 1.8 GlassesOrder (`GlassesOrder.js`)
**Purpose**: Optical lab orders for spectacles.

```javascript
{
  orderId: String,
  patient: ObjectId,
  prescription: ObjectId,

  // Frame Selection
  frame: {
    inventory: ObjectId,       // Ref: FrameInventory
    brand: String,
    model: String,
    color: String,
    size: String,
    price: Number
  },

  // Lens Specifications
  lenses: {
    type: 'single-vision' | 'bifocal' | 'progressive',
    material: 'CR39' | 'polycarbonate' | 'hi-index-1.67' | 'hi-index-1.74',
    coatings: ['anti-reflective', 'blue-light', 'photochromic', 'scratch-resistant'],
    tint: String
  },

  // Order Status
  status: 'ordered' | 'in-production' | 'ready' | 'delivered' | 'cancelled',

  // Pricing
  framePrice: Number,
  lensPrice: Number,
  coatingPrice: Number,
  totalPrice: Number,
  currency: String,

  // Lab Details
  sentToLab: Date,
  expectedDelivery: Date,
  labReference: String
}
```

---

### 1.9 SurgeryCase (`SurgeryCase.js`)
**Purpose**: Surgical case management from payment to completion.

```javascript
{
  patient: ObjectId,
  clinic: ObjectId,
  invoice: ObjectId,           // Link to paid invoice

  surgeryType: ObjectId,       // Ref: ClinicalAct
  surgeryDescription: String,
  eye: 'OD' | 'OS' | 'OU' | 'N/A',

  // Status Workflow
  status: 'awaiting_scheduling' | 'scheduled' | 'checked_in' |
          'in_surgery' | 'completed' | 'cancelled',
  priority: 'routine' | 'urgent' | 'emergency',

  // Timeline
  paymentDate: Date,           // When case was created
  scheduledDate: Date,
  checkInTime: Date,
  surgeryStartTime: Date,
  surgeryEndTime: Date,

  // Assignment
  surgeon: ObjectId,
  assistantSurgeon: ObjectId,
  operatingRoom: ObjectId,

  // Pre-Op Checklist
  preOpChecklist: {
    identityVerified: Boolean,
    siteMarked: Boolean,
    allergiesReviewed: Boolean,
    fastingConfirmed: Boolean,
    eyeDropsAdministered: Boolean,
    pupilDilated: Boolean
  },

  // IOL Details (Cataract Surgery)
  iolDetails: {
    model: String,
    power: String,
    lotNumber: String,
    serialNumber: String
  },

  // Consumables
  consumablesUsed: [{
    item: ObjectId,
    itemName: String,
    quantity: Number,
    lotNumber: String
  }],

  // Post-Op
  surgeryReport: ObjectId,
  followUpAppointment: ObjectId
}
```

**Virtual Fields**:
- `daysWaiting`: Days since payment
- `surgeryDuration`: Surgery time in minutes

---

### 1.10 SurgeryReport (`SurgeryReport.js`)
**Purpose**: Detailed operative report documentation.

```javascript
{
  surgeryCase: ObjectId,
  patient: ObjectId,
  surgeon: ObjectId,

  // Procedure Details
  procedureName: String,
  anesthesia: 'topical' | 'peribulbar' | 'retrobulbar' | 'general',

  // Operative Notes
  preOpDiagnosis: String,
  postOpDiagnosis: String,
  indication: String,
  procedure: String,           // Detailed description
  findings: String,
  complications: String,

  // IOL Implant (if applicable)
  iolImplanted: {
    model: String,
    power: String,
    location: 'bag' | 'sulcus' | 'anterior-chamber'
  },

  // Post-Op Orders
  postOpMedications: [String],
  followUpInstructions: String,

  // Signature
  signedAt: Date,
  signedBy: ObjectId
}
```

---

### 1.11-1.15 Additional Clinical Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ClinicalAct.js` | Billable clinical procedures | `code`, `name`, `category`, `price`, `duration` |
| `ClinicalAlert.js` | Clinical warnings/flags | `patient`, `alertType`, `severity`, `active` |
| `TreatmentProtocol.js` | IVT injection protocols | `name`, `drug`, `schedule`, `intervals` |
| `Referrer.js` | External referring doctors | `name`, `specialty`, `institution`, `contact` |
| `ImagingOrder.js` | OCT/imaging study orders | `patient`, `modality`, `status`, `study` |

---

## 2. Billing & Financial Models

### 2.1 Invoice (`Invoice.js`)
**Purpose**: Financial invoicing with multi-currency support - 76KB, most complex model.

```javascript
{
  invoiceId: String,           // "INV202501000001"
  patient: ObjectId,
  visit: ObjectId,
  prescription: ObjectId,
  clinic: ObjectId,

  dateIssued: Date,
  dueDate: Date,

  // Line Items
  items: [{
    itemId: String,            // Immutable unique ID
    description: String,
    category: 'consultation' | 'procedure' | 'medication' | 'imaging' |
              'laboratory' | 'surgery' | 'optical' | 'other',
    code: String,              // Fee schedule code
    quantity: Number,
    unitPrice: Number,
    discount: Number,
    subtotal: Number,
    tax: Number,
    total: Number,

    // Realization Tracking
    realization: {
      realized: Boolean,
      realizedAt: Date,
      realizedBy: ObjectId
    },

    // Prior Approval
    approval: ObjectId,
    approvalRequired: Boolean,
    approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected',

    // Package Deals
    isPackage: Boolean,
    packageDetails: {
      packageCode: String,
      includedActs: [{ code: String, description: String }],
      originalTotal: Number,
      savings: Number
    }
  }],

  // Totals
  subtotal: Number,
  discountTotal: Number,
  taxTotal: Number,
  grandTotal: Number,

  // Payment Tracking
  payments: [{
    paymentId: String,
    amount: Number,
    currency: 'CDF' | 'USD',
    exchangeRate: Number,
    method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'check',
    reference: String,
    receivedBy: ObjectId,
    receivedAt: Date
  }],

  totalPaid: Number,
  balanceDue: Number,

  // Convention/Insurance
  convention: ObjectId,
  conventionCoverage: {
    percentage: Number,
    maxAmount: Number,
    coveredAmount: Number,
    patientShare: Number,
    companyShare: Number
  },

  // Status
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded',

  // Refunds
  refunds: [{
    amount: Number,
    reason: String,
    refundedAt: Date,
    refundedBy: ObjectId
  }]
}
```

**Key Methods**:
- `recordPayment()`: Add payment with currency conversion
- `processRefund()`: Handle refund with inventory rollback
- `calculateConventionSplit()`: Calculate company vs patient share
- `recalculateTotals()`: Update all computed fields

---

### 2.2 Company (`Company.js`)
**Purpose**: Corporate contracts, insurance, and conventions (Entreprises Conventionnées).

```javascript
{
  companyId: String,           // "ENT0001"
  name: String,
  type: 'employer' | 'insurance' | 'ngo' | 'government' | 'convention',

  // Convention Hierarchy
  parentConvention: ObjectId,  // For sub-companies (e.g., MSO → MSO VODACOM)
  isParentConvention: Boolean,
  conventionCode: String,      // e.g., "MSO", "ACTIVA", "GGA"
  packageType: 'P0' | 'P1' | ... | 'P9',
  tariffStructure: 'CV' | 'MSP' | 'TJ',

  // Contract Details
  contract: {
    contractNumber: String,
    startDate: Date,
    endDate: Date,
    status: 'active' | 'pending' | 'suspended' | 'expired',
    paymentTerms: Number       // Days to pay
  },

  // Default Coverage
  defaultCoverage: {
    percentage: Number,        // 0-100%
    maxPerVisit: Number,
    maxAnnual: Number,
    copayAmount: Number,
    currency: 'CDF' | 'USD'
  },

  // Category-Specific Coverage
  coveredCategories: [{
    category: String,
    coveragePercentage: Number,
    notCovered: Boolean,
    requiresApproval: Boolean,
    autoApproveUnder: Number
  }],

  // Package Deals (BRALIMA, MSO style bundles)
  packageDeals: [{
    name: String,
    code: String,
    price: Number,
    includedActs: [{ actCode: String, actName: String }]
  }],

  // Approval Rules
  approvalRules: {
    autoApproveUnderAmount: Number,
    requiresMedicalReport: [String],
    globalDiscount: { percentage: Number }
  },

  // Account Balance
  balance: {
    totalBilled: Number,
    totalPaid: Number,
    outstanding: Number
  }
}
```

**Key Methods**:
- `calculatePatientShare()`: Determine patient vs company split
- `getCategorySettings()`: Get coverage for specific category
- `getEffectiveSettings()`: Inherit from parent convention

---

### 2.3 FeeSchedule (`FeeSchedule.js`)
**Purpose**: Master fee schedule with date-based versioning and cache invalidation.

```javascript
{
  code: String,                // Unique, uppercase (e.g., "CONS-001")
  name: String,
  description: String,
  category: 'consultation' | 'procedure' | 'medication' | ...,
  subcategory: String,
  displayCategory: String,     // UI display name

  price: Number,
  currency: String,            // Default from env.BASE_CURRENCY
  unit: String,

  // Tax Settings
  taxable: Boolean,
  taxRate: Number,

  // Insurance
  insuranceClaimable: Boolean,
  cptCode: String,
  icdCode: String,

  // Date-Based Versioning
  effectiveFrom: Date,
  effectiveTo: Date,
  minPrice: Number,
  maxPrice: Number,

  active: Boolean
}
```

**Key Methods**:
- `getEffectivePriceForDate(code, date)`: Get price valid for service date
- `validatePriceForDate()`: Verify price matches fee schedule
- `createNewVersion()`: Create dated version for price changes
- Cache invalidation middleware on save/update/delete

---

### 2.4-2.10 Additional Financial Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ConventionFeeSchedule.js` | Convention-specific pricing | `convention`, `feeOverrides`, `discounts` |
| `PaymentPlan.js` | Installment payment plans | `invoice`, `schedule`, `payments`, `status` |
| `InsuranceClaim.js` | Insurance claim tracking | `patient`, `invoice`, `claimNumber`, `status` |
| `FiscalYear.js` | Fiscal year management | `year`, `startDate`, `endDate`, `closed` |
| `TaxConfig.js` | Tax configuration | `name`, `rate`, `categories`, `active` |
| `Approval.js` | Prior authorization requests | `patient`, `act`, `status`, `approvedBy` |
| `Service.js` | Service catalog | `name`, `category`, `price`, `duration` |

---

## 3. Inventory Models

### 3.1 PharmacyInventory (`PharmacyInventory.js`)
**Purpose**: Medication inventory with batch tracking and reservations.

```javascript
{
  inventoryId: String,
  clinic: ObjectId,

  // Product Info
  drug: ObjectId,              // Ref: Drug
  name: String,
  genericName: String,
  manufacturer: String,

  // Batch/Lot Tracking
  batchNumber: String,
  lotNumber: String,
  expiryDate: Date,
  manufacturingDate: Date,

  // Quantities
  quantity: Number,
  reservedQuantity: Number,    // For pending prescriptions
  availableQuantity: Number,   // Virtual: quantity - reserved
  minStockLevel: Number,
  reorderPoint: Number,

  // Pricing
  purchasePrice: Number,
  sellingPrice: Number,
  currency: String,

  // Location
  location: String,
  shelf: String,

  // Warehouse Type
  isDepot: Boolean,            // Central warehouse vs clinic stock

  // Status
  status: 'available' | 'low-stock' | 'out-of-stock' | 'expired' | 'recalled',
  active: Boolean
}
```

**Key Methods**:
- `reserve(quantity)`: Reserve stock for prescription
- `release(quantity)`: Release reserved stock
- `dispense(quantity)`: Reduce stock on dispensing
- `getExpiringStock()`: Find items expiring within N days

---

### 3.2 FrameInventory (`FrameInventory.js`)
**Purpose**: Optical frame inventory management.

```javascript
{
  sku: String,
  clinic: ObjectId,

  // Frame Details
  brand: String,
  model: String,
  color: String,
  size: String,                // e.g., "52-18-140"
  material: 'metal' | 'plastic' | 'titanium' | 'acetate',
  type: 'full-rim' | 'half-rim' | 'rimless',
  gender: 'men' | 'women' | 'unisex' | 'kids',

  // Inventory
  quantity: Number,
  reservedQuantity: Number,
  costPrice: Number,
  sellingPrice: Number,

  // Images
  imageUrls: [String],

  // Status
  status: 'in-stock' | 'low-stock' | 'out-of-stock' | 'discontinued',
  location: String
}
```

---

### 3.3 ContactLensInventory (`ContactLensInventory.js`)
**Purpose**: Contact lens inventory with power/parameters tracking.

```javascript
{
  clinic: ObjectId,

  // Lens Details
  brand: String,
  name: String,
  type: 'daily' | 'weekly' | 'monthly' | 'yearly',
  material: String,

  // Parameters
  baseCurve: Number,
  diameter: Number,

  // Power Range Stocked
  sphereRange: { min: Number, max: Number },
  cylinderRange: { min: Number, max: Number },

  // Inventory by Power
  stockByPower: [{
    sphere: Number,
    cylinder: Number,
    axis: Number,
    quantity: Number,
    expiryDate: Date
  }],

  // Pricing
  boxPrice: Number,
  unitsPerBox: Number,

  status: String
}
```

---

### 3.4-3.7 Additional Inventory Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ReagentInventory.js` | Lab reagent stock | `reagent`, `lotNumber`, `expiryDate`, `quantity` |
| `LabConsumableInventory.js` | Lab consumables | `name`, `type`, `quantity`, `reorderLevel` |
| `InventoryTransfer.js` | Inter-clinic transfers | `from`, `to`, `items`, `status`, `approvedBy` |
| `ReagentLot.js` | Reagent lot tracking | `reagent`, `lotNumber`, `qcStatus`, `calibration` |

---

## 4. Laboratory Models

### 4.1 LabOrder (`LabOrder.js`)
**Purpose**: Laboratory test orders with specimen tracking.

```javascript
{
  orderId: String,             // "LAB2025000001"
  patient: ObjectId,
  visit: ObjectId,
  orderedBy: ObjectId,

  orderDate: Date,
  priority: 'routine' | 'urgent' | 'stat',
  status: 'ordered' | 'collected' | 'received' | 'in-progress' | 'completed' | 'cancelled',

  // Tests Ordered
  tests: [{
    template: ObjectId,        // Ref: LaboratoryTemplate
    testName: String,
    testCode: String,
    status: String,
    results: ObjectId          // Ref: LabResult
  }],

  // Specimen Details
  specimen: {
    collectedAt: Date,
    collectedBy: ObjectId,
    specimenType: String,
    barcode: String,
    quality: 'acceptable' | 'hemolyzed' | 'lipemic' | 'rejected',
    rejectionReason: String
  },

  // Fasting Requirements
  fasting: {
    required: Boolean,
    confirmed: Boolean,
    hours: Number
  },

  // Check-In Workflow
  checkIn: {
    arrivedAt: Date,
    checkedInBy: ObjectId,
    fastingVerified: Boolean
  },

  // Rejection/Reschedule (Patient ate, etc.)
  rejection: {
    rejected: Boolean,
    reason: 'patient_ate' | 'medication_taken' | 'wrong_preparation' | 'no_show',
    penaltyApplied: Boolean,
    penaltyAmount: Number,
    rescheduledTo: Date
  },

  billing: {
    invoice: ObjectId,
    paymentStatus: String
  }
}
```

**Key Methods**:
- `collectSpecimen()`: Mark specimen as collected
- `receiveSpecimen()`: Quality check and receive
- `checkInPatient()`: Patient arrival workflow
- `rejectAndReschedule()`: Handle fasting failures with penalty

---

### 4.2 LabResult (`LabResult.js`)
**Purpose**: Laboratory test results with reference ranges.

```javascript
{
  labOrder: ObjectId,
  patient: ObjectId,
  test: ObjectId,              // Ref: LaboratoryTemplate

  // Results
  results: [{
    parameter: String,
    value: Mixed,
    unit: String,
    referenceRange: { min: Number, max: Number },
    flag: 'normal' | 'low' | 'high' | 'critical',
    notes: String
  }],

  // Validation
  validatedBy: ObjectId,
  validatedAt: Date,
  status: 'pending' | 'validated' | 'amended',

  // Critical Results
  criticalValue: Boolean,
  criticalNotified: Boolean,
  criticalNotifiedAt: Date,

  // External Lab
  externalLabName: String,
  externalReferenceNumber: String
}
```

---

### 4.3 LabAnalyzer (`LabAnalyzer.js`)
**Purpose**: Laboratory instrument integration settings.

```javascript
{
  name: String,
  manufacturer: String,
  model: String,
  serialNumber: String,

  // Connection
  connectionType: 'serial' | 'tcp' | 'file' | 'hl7',
  connectionSettings: {
    port: String,
    baudRate: Number,
    ipAddress: String,
    filePath: String
  },

  // Protocol
  protocol: 'astm' | 'hl7' | 'proprietary',

  // Test Mapping
  testMapping: [{
    analyzerTestCode: String,
    systemTestCode: String,
    unit: String,
    multiplier: Number
  }],

  // QC
  lastCalibration: Date,
  qcStatus: 'passed' | 'failed' | 'due',

  status: 'online' | 'offline' | 'error'
}
```

---

### 4.4-4.8 Additional Lab Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `LaboratoryTemplate.js` | Test definitions | `name`, `code`, `parameters`, `referenceRanges` |
| `PathologyTemplate.js` | Pathology templates | `organ`, `findings`, `codes` |
| `LISIntegration.js` | LIS connection config | `labName`, `protocol`, `endpoint`, `mapping` |
| `UnitConversion.js` | Unit conversions | `fromUnit`, `toUnit`, `factor` |

---

## 5. Device & Integration Models

### 5.1 Device (`Device.js`)
**Purpose**: Medical device management with 21 device types supported.

```javascript
{
  deviceId: String,            // "AUT0001" (type prefix + sequence)
  name: String,
  manufacturer: String,
  model: String,
  serialNumber: String,

  // Device Type
  type: 'auto-refractor' | 'keratometer' | 'tonometer' | 'perimeter' | 'oct' |
        'fundus-camera' | 'slit-lamp' | 'phoropter' | 'lensmeter' | 'topographer' |
        'biometer' | 'pachymeter' | 'ultrasound' | 'specular-microscope' | ...,
  category: 'diagnostic' | 'imaging' | 'measurement' | 'therapeutic' | 'surgical',

  // Connection
  connection: {
    type: 'network' | 'serial' | 'usb' | 'wifi' | 'manual',
    protocol: 'dicom' | 'hl7' | 'proprietary' | 'file-based',
    ipAddress: String,
    port: Number
  },

  // Integration Method
  integration: {
    status: 'connected' | 'disconnected' | 'error' | 'not-configured',
    method: 'webhook' | 'folder-sync' | 'manual' | 'api',

    // Webhook Integration
    webhook: {
      enabled: Boolean,
      url: String,
      apiKey: String,
      lastWebhookReceived: Date
    },

    // Folder Sync Integration
    folderSync: {
      enabled: Boolean,
      sharedFolderPath: String,   // SMB network path
      filePattern: String,        // e.g., "*.csv"
      fileFormat: 'csv' | 'json' | 'xml' | 'dicom' | 'hl7',
      syncSchedule: String,       // Cron format
      lastFolderSync: Date,
      filesProcessed: Number
    }
  },

  // Data Mapping
  dataMapping: {
    fields: [{
      deviceField: String,
      systemField: String,
      dataType: String,
      transformation: String     // JS expression
    }]
  },

  // Calibration
  calibration: {
    required: Boolean,
    frequency: 'daily' | 'weekly' | 'monthly',
    lastCalibration: Date,
    nextCalibration: Date,
    calibrationHistory: [{ date: Date, passed: Boolean, notes: String }]
  },

  // Device-Specific Config
  configurations: {
    autoRefractor: { sphereRange: {}, cylinderRange: {}, measurementMode: String },
    tonometer: { type: String, correctionFactor: Number },
    oct: { scanProtocols: [String], resolution: String }
  },

  // Location
  location: { facility: String, department: String, room: String },

  status: {
    operational: Boolean,
    currentStatus: 'available' | 'in-use' | 'maintenance' | 'error'
  }
}
```

**Key Methods**:
- `connect()` / `disconnect()`: Manage connection state
- `syncData()`: Trigger data synchronization
- `performCalibration()`: Record calibration
- `checkCalibrationDue()`: Check if calibration needed

---

### 5.2 DeviceMeasurement (`DeviceMeasurement.js`)
**Purpose**: Raw measurement data from devices.

```javascript
{
  device: ObjectId,
  patient: ObjectId,
  measurementType: String,

  // Raw Data
  rawData: Mixed,
  parsedData: Mixed,

  // Matching
  matchedPatient: ObjectId,
  matchConfidence: Number,
  matchMethod: 'patientId' | 'name' | 'manual',

  // Application
  appliedToExam: Boolean,
  appliedExam: ObjectId,
  appliedAt: Date,
  appliedBy: ObjectId,

  // File Reference
  sourceFile: String,

  status: 'pending' | 'matched' | 'applied' | 'rejected'
}
```

---

### 5.3-5.5 Additional Device Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `DeviceImage.js` | Device-captured images | `device`, `patient`, `imageType`, `filePath` |
| `DeviceIntegrationLog.js` | Integration event log | `device`, `event`, `status`, `errorMessage` |
| `ImagingStudy.js` | DICOM/imaging studies | `patient`, `modality`, `studyUID`, `images` |

---

## 6. User & Access Control Models

### 6.1 User (`User.js`)
**Purpose**: Staff accounts with multi-clinic assignment and 2FA support.

```javascript
{
  employeeId: String,          // "EMP2025000001"
  firstName: String,
  lastName: String,
  email: String,
  phone: String,

  // Authentication
  password: String,            // Bcrypt hashed
  passwordChangedAt: Date,
  passwordHistory: [String],   // Last 5 passwords

  // Two-Factor Authentication
  twoFactorEnabled: Boolean,
  twoFactorSecret: String,
  backupCodes: [String],

  // Role & Permissions
  role: 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'pharmacist' |
        'lab_technician' | 'ophthalmologist' | 'manager' | 'technician' |
        'orthoptist' | 'optometrist' | 'radiologist' | 'accountant',
  permissions: [String],       // Granular permissions

  // Multi-Clinic
  clinics: [ObjectId],         // Clinics user can access
  primaryClinic: ObjectId,

  // Professional Info
  specialty: String,
  licenseNumber: String,
  signature: String,           // Base64 or path to signature image

  // Session Management
  refreshToken: String,
  tokenVersion: Number,        // For invalidating all tokens
  lastLogin: Date,

  status: 'active' | 'inactive' | 'suspended' | 'pending'
}
```

**Key Methods**:
- `comparePassword()`: Verify password
- `generateAuthToken()`: Create JWT access token
- `generateRefreshToken()`: Create refresh token
- `canAccessClinic(clinicId)`: Check clinic permission

---

### 6.2 RolePermission (`RolePermission.js`)
**Purpose**: Role-based permission definitions.

```javascript
{
  role: String,                // Role name
  permissions: [{
    resource: String,          // e.g., 'patients', 'invoices'
    actions: ['create', 'read', 'update', 'delete', 'export']
  }],

  // Feature Flags
  features: [{
    feature: String,
    enabled: Boolean
  }],

  // Menu Access
  menuAccess: [String],        // Accessible menu items

  // Data Scope
  dataScope: 'own' | 'clinic' | 'all',

  description: String,
  active: Boolean
}
```

---

### 6.3 AuditLog (`AuditLog.js`)
**Purpose**: Comprehensive audit trail for all system actions.

```javascript
{
  action: String,              // e.g., 'patient.create', 'invoice.update'
  user: ObjectId,
  clinic: ObjectId,

  // Target
  resourceType: String,        // Model name
  resourceId: ObjectId,

  // Changes
  before: Mixed,               // Previous state
  after: Mixed,                // New state
  changes: [String],           // List of changed fields

  // Request Context
  ipAddress: String,
  userAgent: String,
  requestId: String,

  // Outcome
  status: 'success' | 'failure',
  errorMessage: String,

  timestamp: Date
}
```

---

### 6.4 Alert (`Alert.js`)
**Purpose**: System alerts and notifications.

```javascript
{
  alertId: String,
  type: 'stock_low' | 'expiry_warning' | 'calibration_due' | 'payment_overdue' | 'system',
  severity: 'info' | 'warning' | 'critical',

  title: String,
  message: String,

  // Target
  targetType: String,          // e.g., 'inventory', 'device', 'invoice'
  targetId: ObjectId,

  // Recipients
  assignedTo: [ObjectId],
  clinic: ObjectId,

  // Status
  status: 'active' | 'acknowledged' | 'resolved',
  acknowledgedBy: ObjectId,
  resolvedAt: Date,

  // Auto-dismiss
  expiresAt: Date
}
```

---

## 7. Multi-Clinic Models

### 7.1 Clinic (`Clinic.js`)
**Purpose**: Physical clinic/location management.

```javascript
{
  clinicId: String,            // e.g., "KIN", "GOM", "LUB"
  name: String,
  shortName: String,

  // Location
  address: {
    street: String,
    city: String,
    province: String,
    country: String,           // Default: 'RDC'
    coordinates: { latitude: Number, longitude: Number }
  },

  // Contact
  contact: {
    phone: String,
    email: String
  },

  // Operating Hours
  operatingHours: {
    monday: { open: String, close: String, closed: Boolean },
    // ... other days
  },

  timezone: String,            // Default: 'Africa/Kinshasa'

  // Clinic Type
  type: 'main' | 'satellite' | 'mobile' | 'partner',
  parentClinic: ObjectId,      // For satellites

  // Services Offered
  services: ['consultation', 'ophthalmology', 'surgery', 'pharmacy', 'laboratory', ...],

  // Network Shares (for device integration)
  networkShares: [{
    name: String,
    path: String,              // SMB path
    deviceType: String,
    isActive: Boolean
  }],

  // Billing Settings
  billing: {
    taxId: String,
    defaultCurrency: String,
    invoicePrefix: String,
    useCentralFeeSchedule: Boolean
  },

  // Cached Stats
  stats: {
    totalPatients: Number,
    totalVisitsThisMonth: Number,
    activeStaff: Number,
    lastUpdated: Date
  },

  status: 'active' | 'inactive' | 'temporarily_closed'
}
```

**Key Methods**:
- `getActive()`: List active clinics
- `offersService(service)`: Check if clinic offers a service
- `updateStats()`: Refresh cached statistics

---

### 7.2 SyncQueue (`SyncQueue.js`)
**Purpose**: Cross-clinic data synchronization queue.

```javascript
{
  sourceClinic: ObjectId,
  targetClinic: ObjectId,      // null for central server

  // Sync Item
  operation: 'create' | 'update' | 'delete',
  modelName: String,
  documentId: ObjectId,
  data: Mixed,

  // Status
  status: 'pending' | 'syncing' | 'completed' | 'failed',
  attempts: Number,
  lastAttempt: Date,
  error: String,

  // Priority
  priority: 'low' | 'normal' | 'high',

  createdAt: Date,
  completedAt: Date
}
```

---

### 7.3 LegacyMapping (`LegacyMapping.js`)
**Purpose**: Map legacy system IDs to new system IDs during migration.

```javascript
{
  legacySystem: String,        // e.g., 'LV', 'old_excel'
  modelName: String,
  legacyId: String,
  newId: ObjectId,

  // Additional Legacy Data
  legacyData: Mixed,

  migratedAt: Date,
  migratedBy: ObjectId
}
```

---

## 8. Template & Configuration Models

### 8.1 Counter (`Counter.js`)
**Purpose**: Atomic sequential number generation.

```javascript
{
  _id: String,                 // e.g., 'patient-2025', 'queue-20250120'
  sequence: Number,
  lastUsed: Date,
  description: String
}
```

**Key Methods**:
- `getNextSequence(name)`: Atomically increment and return next number
- `getDailyCounterId(prefix)`: Generate daily counter ID
- `getMonthlyCounterId(prefix)`: Generate monthly counter ID
- `getYearlyCounterId(prefix)`: Generate yearly counter ID
- `cleanupOldCounters(days)`: Remove old daily counters

---

### 8.2-8.15 Template Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ConsultationTemplate.js` | Consultation workflow templates | `name`, `steps`, `defaultValues` |
| `MedicationTemplate.js` | Common medication combinations | `name`, `medications`, `indication` |
| `ExaminationTemplate.js` | Exam finding templates | `organ`, `findings`, `phrases` |
| `ClinicalTemplate.js` | Clinical note templates | `name`, `sections`, `content` |
| `CommentTemplate.js` | Quick comment templates | `category`, `text`, `shortcut` |
| `DoseTemplate.js` | Dosage presets | `drug`, `dose`, `frequency`, `duration` |
| `DocumentTemplate.js` | Document generation templates | `type`, `template`, `variables` |
| `LetterTemplate.js` | Correspondence letter templates | `type`, `subject`, `body` |
| `AppointmentType.js` | Appointment type definitions | `name`, `duration`, `color`, `requiredRole` |
| `Settings.js` | System configuration | `key`, `value`, `category` |
| `Drug.js` | Drug database | `name`, `genericName`, `doseForms`, `interactions` |
| `EquipmentCatalog.js` | Equipment reference catalog | `name`, `manufacturer`, `type`, `specs` |
| `Room.js` | Clinic rooms | `name`, `clinic`, `type`, `equipment` |
| `ProviderAvailability.js` | Provider schedules | `provider`, `dayOfWeek`, `slots` |
| `WaitingList.js` | Appointment waiting list | `patient`, `service`, `priority`, `notes` |

---

## 9. Scheduling Models

### 9.1 Appointment (`Appointment.js`)
**Purpose**: Patient appointment scheduling.

```javascript
{
  appointmentId: String,
  patient: ObjectId,
  clinic: ObjectId,

  // Schedule
  date: Date,
  startTime: String,
  endTime: String,
  duration: Number,            // Minutes

  // Provider
  provider: ObjectId,
  room: ObjectId,

  // Type
  appointmentType: ObjectId,
  visitType: 'consultation' | 'follow-up' | 'procedure' | 'ivt',

  // Status
  status: 'scheduled' | 'confirmed' | 'checked-in' | 'completed' |
          'cancelled' | 'no-show' | 'rescheduled',

  // Reminders
  reminderSent: Boolean,
  confirmationReceived: Boolean,

  // Recurring
  recurring: {
    enabled: Boolean,
    frequency: 'daily' | 'weekly' | 'monthly',
    endDate: Date,
    parentAppointment: ObjectId
  },

  // Queue Integration
  visit: ObjectId,
  queueNumber: Number,

  notes: String,
  cancellationReason: String
}
```

---

## 10. Document & Communication Models

### 10.1 Document (`Document.js`)
**Purpose**: Document management and generation.

```javascript
{
  documentId: String,
  patient: ObjectId,
  clinic: ObjectId,

  // Document Info
  title: String,
  type: 'prescription' | 'certificate' | 'referral' | 'report' | 'consent' | 'other',
  category: String,

  // File
  filePath: String,
  fileType: String,
  fileSize: Number,

  // Source
  source: 'generated' | 'uploaded' | 'scanned',
  sourceRecord: {
    model: String,
    id: ObjectId
  },

  // Status
  status: 'draft' | 'final' | 'signed' | 'sent',
  signedBy: ObjectId,
  signedAt: Date,

  // Sharing
  sharedWith: [{
    recipient: String,
    method: 'email' | 'portal' | 'print',
    sentAt: Date
  }],

  tags: [String],
  metadata: Mixed
}
```

---

### 10.2-10.7 Additional Communication Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Correspondence.js` | Patient correspondence | `patient`, `type`, `subject`, `body`, `sent` |
| `Notification.js` | In-app notifications | `user`, `type`, `message`, `read`, `actionUrl` |
| `EmailQueue.js` | Outbound email queue | `to`, `subject`, `body`, `status`, `attempts` |
| `CalendarIntegration.js` | External calendar sync | `user`, `provider`, `credentials`, `lastSync` |

---

## Model Relationships Diagram

```
Patient ─────────────┬─────── Visit ─────────────┬─── OphthalmologyExam
                     │                           │
                     ├─── Prescription ──────────├─── ConsultationSession
                     │                           │
                     ├─── Appointment ───────────├─── LabOrder ── LabResult
                     │                           │
                     ├─── Invoice ───────────────├─── IVTInjection
                     │                           │
                     └─── Document               └─── SurgeryCase ── SurgeryReport

Clinic ──────┬─── User (staff)
             ├─── Device ── DeviceMeasurement
             ├─── PharmacyInventory
             ├─── FrameInventory
             └─── SyncQueue (cross-clinic sync)

Company ─────┬─── Patient (convention)
             ├─── Invoice (billing)
             └─── ConventionFeeSchedule

FeeSchedule ─── Invoice.items (pricing)
```

---

## Index Summary

Critical indexes for query performance:

| Model | Indexes |
|-------|---------|
| Patient | `patientId` (unique), `clinic`, `convention`, `nationalId`, text(names) |
| Visit | `patient`, `clinic`, `status`, `createdAt`, `queueNumber` |
| Invoice | `invoiceId` (unique), `patient`, `clinic`, `status`, `dateIssued` |
| Appointment | `patient`, `clinic`, `provider`, `date`, `status` |
| LabOrder | `orderId` (unique), `patient`, `status`, `scheduledDate`, `barcode` |
| Device | `type`, `serialNumber`, `integration.status` |
| PharmacyInventory | `clinic`, `drug`, `batchNumber`, `expiryDate` |
| AuditLog | `user`, `resourceType`, `timestamp` |

---

## Middleware Patterns

### Pre-Save Hooks
- Auto-generate IDs using Counter model
- Calculate derived fields (balances, totals)
- Validate state transitions
- Track status history

### Post-Save Hooks
- Cache invalidation (FeeSchedule → cacheService)
- Emit WebSocket events
- Queue sync operations (SyncQueue)

### Virtual Fields
- `age` on Patient (calculated from DOB)
- `fullName` on Patient, User
- `availableQuantity` on Inventory (quantity - reserved)
- `daysWaiting` on SurgeryCase

---

## Transaction Patterns

The system uses MongoDB transactions where available, with compensating rollback for standalone instances:

```javascript
// Visit.completeVisit() pattern
async completeVisit() {
  const hasReplicaSet = await checkReplicaSet();

  if (hasReplicaSet) {
    // Use native transactions
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // operations...
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  } else {
    // Compensating rollback for standalone
    const rollbackActions = [];
    try {
      // operations with rollback tracking...
    } catch (error) {
      // Execute rollback actions in reverse
      for (const action of rollbackActions.reverse()) {
        await action();
      }
      throw error;
    }
  }
}
```

---

*Document generated: Phase 2 of MedFlow Documentation*
*Next: Phase 3 - Backend API Endpoints*
