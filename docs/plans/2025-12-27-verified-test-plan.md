# MedFlow EMR Verified Business Logic & Data Integrity Test Plan

**Document Version:** 1.0
**Generated:** December 27, 2025
**Status:** Verified against actual codebase

## Executive Summary

This test plan has been cross-referenced against the actual MedFlow codebase structure:
- **78 MongoDB models** verified
- **80+ API routes** verified
- **36+ frontend pages** verified
- **8-tab StudioVision** confirmed
- **Real-time WebSocket** confirmed
- **Offline-first architecture** confirmed

---

## Testing Methodology

### Verification Levels:
- **L1 - UI Display:** Does it render correctly?
- **L2 - API Response:** Does the API return correct data?
- **L3 - Database State:** Is MongoDB storing correct values?
- **L4 - Cross-Reference:** Do related records match?

### Environment Requirements:
- MongoDB running (replica set for transaction tests)
- Redis running (for sessions/caching)
- Face-service running (for biometric tests)
- All 3 test clinics seeded (Gombe, Tombalbaye, Limete)

---

# Module 1: Patient Management

## 1.1 Patient Registration

### Verified Schema Fields (Patient.js)

| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| `patientId` | String | Auto-generated, unique | Format: clinic prefix + number |
| `firstName` | String | Required, uppercase | PHI encrypted |
| `lastName` | String | Required, uppercase | PHI encrypted |
| `dateOfBirth` | Date | Required | |
| `gender` | Enum | male/female/other | |
| `phoneNumber` | String | Required, validated | Accepts +243, 00243, local |
| `alternativePhone` | String | Optional | PHI encrypted |
| `email` | String | Regex validated, lowercase | PHI encrypted |
| `address` | Object | street/city/state/postalCode/country | PHI encrypted (street) |
| `nationalId` | String | Unique, sparse | |
| `bloodType` | Enum | A+/A-/B+/B-/AB+/AB-/O+/O- | |
| `vip` | Boolean | Default: false | Priority flag |
| `priority` | Enum | normal/pregnant/elderly | |
| `registeredAtClinic` | ObjectId | Ref: Clinic | |
| `homeClinic` | ObjectId | Ref: Clinic, indexed | Multi-clinic key |

### Test Case PR-001: Complete Patient Registration

**Route:** `POST /api/patients`
**Middleware:** `protect`, `optionalClinic`, `requirePermission`

| Step | Action | Expected Result | Verify |
|------|--------|-----------------|--------|
| 1 | Click "Nouveau Patient" | Registration form opens | Form fields visible |
| 2 | Enter: Prénom = "Jean" | Field accepts, converts to uppercase | "JEAN" stored |
| 3 | Enter: Nom = "Mbeki" | Field accepts, converts to uppercase | "MBEKI" stored |
| 4 | Enter: Date naissance = 15/03/1985 | Date validated | ISODate stored |
| 5 | Select: Sexe = "Masculin" | Radio selected | `gender: "male"` |
| 6 | Enter: Téléphone = "+243 812 345 678" | Format validated | Normalized to +243812345678 |
| 7 | Enter: Email = "jean.mbeki@email.com" | Format validated | Lowercase stored |
| 8 | Enter: Adresse = "123 Avenue Lumumba, Gombe" | Free text | Encrypted at rest |
| 9 | Capture face photo | Camera opens, face detected | Embedding generated |
| 10 | Click "Enregistrer" | Loading indicator | API POST sent |
| 11 | Success | Redirect to patient profile | Toast "Patient créé" |

**Database Verification (L3):**
```javascript
db.patients.findOne({ firstName: "JEAN", lastName: "MBEKI" })

// Expected fields:
{
  _id: ObjectId("..."),
  patientId: "GMB-2024-XXXXX",  // Auto-generated with clinic prefix
  firstName: "JEAN",
  lastName: "MBEKI",
  dateOfBirth: ISODate("1985-03-15"),
  gender: "male",
  phoneNumber: "+243812345678",
  email: "jean.mbeki@email.com",
  address: {
    street: "123 Avenue Lumumba, Gombe",  // Encrypted
    city: "",
    state: "",
    postalCode: "",
    country: "RD Congo"
  },
  registeredAtClinic: ObjectId("gombe-clinic-id"),
  homeClinic: ObjectId("gombe-clinic-id"),
  biometric: {
    faceEncoding: [/* 128-D vector */],
    encodingCapturedAt: ISODate("..."),
    consentGiven: true
  },
  dataStatus: "complete",  // or "incomplete" if missing fields
  createdBy: ObjectId("user-id"),
  createdAt: ISODate("..."),
  isDeleted: false
}
```

### Test Case PR-002: Phone Number Validation

**Verified Regex:** `/^(\+243|00243|0)?[0-9\s\-()]{6,15}$/`

| Input | Expected | Notes |
|-------|----------|-------|
| `+243812345678` | Valid | International format |
| `00243812345678` | Valid | Alternative international |
| `0812345678` | Valid | Local format |
| `812345678` | Valid | Without prefix |
| `+243 81 234 5678` | Valid | Spaces allowed |
| `+243-81-234-5678` | Valid | Dashes allowed |
| `abc` | Invalid | "Format invalide" |
| `123` | Invalid | "Numéro trop court" (min 6 digits) |

### Test Case PR-003: Face Recognition Enrollment

**Route:** `POST /api/face-recognition/enroll/:patientId`
**Service:** Python face-service at `http://127.0.0.1:5002`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click camera icon | Browser requests camera permission |
| 2 | Permission granted | Live camera feed shown |
| 3 | No face detected | "Aucun visage détecté" |
| 4 | Multiple faces | "Un seul visage SVP" |
| 5 | Face detected | Green bounding box |
| 6 | Click capture | Photo taken |
| 7 | Click confirm | 128-D embedding generated |
| 8 | Consent recorded | `biometric.consentGiven: true` |

**Biometric Data Structure:**
```javascript
{
  biometric: {
    faceEncoding: [0.123, -0.456, ...],  // 128 floats, select: false
    faceLocation: { top: 50, right: 200, bottom: 250, left: 50 },
    encodingCapturedAt: ISODate("..."),
    encodingCapturedBy: ObjectId("user-id"),
    consentGiven: true,
    consentDate: ISODate("..."),
    lastVerification: {
      date: ISODate("..."),
      success: true,
      confidence: 0.95,
      verifiedBy: ObjectId("user-id")
    }
  }
}
```

### Test Case PR-004: Convention (Insurance) Assignment

**Patient.conventions[] Array Structure:**

```javascript
{
  conventions: [{
    conventionId: ObjectId("sonas-id"),
    employeeId: "MAT-12345",
    relationship: "titular",  // titular, spouse, child
    startDate: ISODate("2024-01-15"),
    endDate: null,  // null = ongoing
    status: "active",
    // Note: Coverage details are on the Convention model, not patient
  }]
}
```

**Important:** The convention coverage percentages, annual limits, and category limits are stored on the `Company` model with `conventions` array, NOT on the patient. Patient only stores the link.

---

## 1.2 Patient Search & Retrieval

### Test Case PS-001: Patient Search

**Route:** `GET /api/patients/search`

| Search Input | Expected | Query |
|--------------|----------|-------|
| "Jean" | Matches firstName/lastName | Case-insensitive regex |
| "GMB-2024-00001" | Exact MRN match | Direct lookup |
| "+243812345678" | Phone match | Normalized comparison |
| "0812345678" | Same patient | Normalizes input |

### Test Case PS-002: Face Recognition Check-In

**Route:** `POST /api/face-recognition/verify/:patientId`

| Scenario | Expected |
|----------|----------|
| Known patient (>95% match) | Auto-identify, show confirmation |
| 80-95% confidence | Show top matches for selection |
| <80% confidence | "Non reconnu" |
| Poor lighting | "Rapprochez-vous" |
| Multiple faces | "Une personne à la fois" |

**Tolerance Setting:** 0.4 (60% similarity threshold)

### Test Case PS-003: Multi-Clinic Data Isolation

**Middleware:** `optionalClinic` or `requireClinic`

**Header:** `X-Clinic-ID` sets clinic context

| User at Gombe | Action | Expected |
|---------------|--------|----------|
| Search "Jean" | API call | Only Gombe patients returned |
| Direct URL to Tombalbaye patient | Navigate | 404 Not Found |
| API GET other clinic patient | Request | 403 or 404 |

**Backend Query Pattern:**
```javascript
// All queries MUST include clinic filter
const query = {
  ...baseQuery,
  homeClinic: req.clinicId  // or { $in: req.user.clinics } for multi-clinic users
};
```

---

## 1.3 Device Folder Linking

### Verified: Patient.folderIds[] Structure

```javascript
{
  folderIds: [{
    deviceType: "zeiss",  // zeiss, solix, nidek, tomey, topcon, heidelberg, quantel, other
    folderId: "MBEKI_JEAN_1985",
    path: "/Export/Patients/MBEKI_JEAN_1985",
    linkedAt: ISODate("..."),
    linkedBy: ObjectId("user-id")
  }]
}
```

**Routes:**
- `POST /api/patients/:id/link-folder`
- `DELETE /api/patients/:id/unlink-folder/:folderId`

---

# Module 2: Appointment Scheduling

## 2.1 Appointment Creation

### Verified Schema Fields (Appointment.js)

| Field | Type | Validation | Notes |
|-------|------|------------|-------|
| `appointmentId` | String | Auto-generated, unique | |
| `patient` | ObjectId | Required, ref: Patient | |
| `provider` | ObjectId | Required, ref: User | Doctor |
| `clinic` | ObjectId | Indexed, ref: Clinic | |
| `date` | Date | Required | |
| `startTime` | String | Required | "09:00" format |
| `endTime` | String | Required | |
| `duration` | Number | Default: 30 | Minutes |
| `type` | Enum | consultation/follow-up/emergency/... | 12 types |
| `status` | Enum | scheduled/confirmed/checked-in/... | 8 statuses |
| `priority` | Enum | normal/high/urgent/emergency/vip/pregnant/elderly | |
| `queueNumber` | Number | | Queue position |
| `checkInTime` | Date | | When checked in |

### Test Case AP-001: Schedule New Appointment

**Route:** `POST /api/appointments`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open patient profile | "Nouveau RDV" button visible |
| 2 | Click "Nouveau RDV" | Appointment modal opens |
| 3 | Select date | Calendar shows, unavailable dates grayed |
| 4 | Select doctor | Doctors at current clinic only |
| 5 | Select time slot | Only available slots shown |
| 6 | Select type "Consultation" | Dropdown selection |
| 7 | Add reason | Required field |
| 8 | Click "Confirmer" | Appointment created |

### Test Case AP-002: Appointment Status Transitions

**Verified State Machine (from Appointment.js):**

```
scheduled → [confirmed, checked-in, cancelled, no_show, rescheduled]
confirmed → [checked-in, cancelled, no_show, rescheduled]
checked-in → [in-progress, cancelled, no_show]
in-progress → [completed, cancelled]
completed → [] (terminal)
cancelled → [] (terminal)
no_show → [rescheduled, scheduled]
rescheduled → [scheduled, confirmed, cancelled]
```

**Routes:**
- `PUT /api/appointments/:id/checkin` (DEPRECATED)
- `PUT /api/appointments/:id/start-consultation`
- `PUT /api/appointments/:id/complete`
- `PUT /api/appointments/:id/cancel`
- `PUT /api/appointments/:id/no-show`
- `PUT /api/appointments/:id/reschedule`

### Test Case AP-003: Slot Availability

**Route:** `GET /api/appointments/available-slots`

| Check | Expected |
|-------|----------|
| Before work hours | Unavailable |
| During lunch | Unavailable (if configured) |
| Existing appointment time | Unavailable |
| After work hours | Unavailable |
| Doctor at different clinic | Not shown in dropdown |

---

## 2.2 Queue Management

### Queue Integration

**Note:** Queue is managed via Appointment model + WebSocket, NOT a separate Queue collection.

**Key Fields on Appointment:**
- `queueNumber` - Position in queue
- `checkInTime` - When checked in
- `waitingTime` - Calculated wait
- `consultationStartTime` - When seen
- `consultationEndTime` - When complete

### Test Case QM-001: Add to Queue

**Route:** `POST /api/queue` or `PUT /api/appointments/:id/checkin`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Patient arrives | Search by appointment |
| 2 | Click "Ajouter à la file" | Queue number assigned |
| 3 | Queue updates | WebSocket event sent |
| 4 | Dashboard shows | Real-time update |

### Test Case QM-002: Queue Display Board

**Route:** `GET /api/queue/display-board` (PUBLIC, rate-limited)

**Features:**
- No authentication required
- Rate limited: 30 req/min
- Returns only: first name, last initial, queue number
- Privacy-safe for waiting room TV

**Multi-language Support:**
- French, English, Swahili, Lingala

### Test Case QM-003: Real-Time Updates

**WebSocket Events:**
- `queue:add` - Patient added
- `queue:call` - Patient called
- `queue:complete` - Consultation complete

**Frontend Hook:** `useQueueUpdates()`

---

# Module 3: Clinical Consultation (StudioVision)

## 3.1 Verified StudioVision 8-Tab Structure

| Tab | Name | Color | Key Features |
|-----|------|-------|--------------|
| 1 | Résumé | Gray | Overview, chief complaint, history |
| 2 | Réfraction | Pink | Visual acuity, refraction, keratometry |
| 3 | Lentilles | Cyan | Contact lens fitting |
| 4 | Pathologies | Yellow | Diagnoses, ICD-10, procedures |
| 5 | Orthoptie | Purple | Orthoptic examination |
| 6 | Examen | Green | Slit lamp, fundus, IOP |
| 7 | Traitement | Blue | Medications, prescriptions |
| 8 | Règlement | Emerald | Billing, payments |

**Frontend Component:** `StudioVisionConsultation.jsx` with `StudioVisionTabNavigation.jsx`

**Keyboard Navigation:** Arrow keys, number keys 1-8

## 3.2 Visual Acuity (Monoyer/Parinaud)

### Verified Validation Constants (OphthalmologyExam.js)

**Distance Vision (Monoyer):**
```javascript
MONOYER_DISTANCE_VALUES = [
  '10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10',
  '1/20', '1/50',
  'CLD',   // Compte les doigts
  'VBLM',  // Voit bouger la main
  'PL+',   // Perception lumineuse positive
  'PL-'    // Perception lumineuse négative
]
```

**Near Vision (Parinaud):**
```javascript
PARINAUD_NEAR_VALUES = [
  'P1.5', 'P2', 'P3', 'P4', 'P5', 'P6', 'P8', 'P10', 'P14', 'P20'
]
```

### Test Case VA-001: Visual Acuity Entry

| Input | Scale | Expected |
|-------|-------|----------|
| "10/10" | Monoyer | Accepted |
| "20/20" | Snellen | **Rejected** "Utilisez échelle Monoyer" |
| "6/6" | Metric | **Rejected** |
| "CLD" | Special | Accepted |
| "PL+" | Special | Accepted |
| "P2" | Parinaud | Accepted for near vision |
| "J1" | Jaeger | **Rejected** "Utilisez échelle Parinaud" |

## 3.3 Refraction Data

### Verified Limits (OphthalmologyExam.js)

```javascript
REFRACTION_LIMITS = {
  sphere: { min: -25, max: 25 },    // Wider than test plan assumed
  cylinder: { min: -10, max: 10 },
  axis: { min: 0, max: 180 },
  addition: { min: 0.25, max: 4.00 }
}
```

### Test Case RF-001: Refraction Values

| Field | Valid Range | Invalid Test |
|-------|-------------|--------------|
| Sphère | -25.00 to +25.00 | -30.00 → Rejected |
| Cylindre | -10.00 to +10.00 | -15.00 → Rejected |
| Axe | 0 to 180 | 185 → Rejected |
| Addition | +0.25 to +4.00 | +5.00 → Rejected |

### Test Case RF-002: OD→OS Axis Transposition

**Important Bug Fixed:** The `axis=0` copy bug was fixed in StudioVisionConsultation.jsx

**Rule:**
```javascript
// If OD axis <= 90: OS axis = OD axis + 90
// If OD axis > 90: OS axis = OD axis - 90
function transposeAxis(odAxis) {
  if (odAxis === 0) return 90;  // Fixed: was treating 0 as falsy
  return odAxis <= 90 ? odAxis + 90 : odAxis - 90;
}
```

| OD Axis | Expected OS Axis |
|---------|-----------------|
| 0 | 90 |
| 45 | 135 |
| 90 | 180 |
| 120 | 30 |
| 180 | 90 |

## 3.4 IOP (Intraocular Pressure)

### Verified Limits (OphthalmologyExam.js)

```javascript
IOP_LIMITS = { min: 0, max: 80 }  // Wider than 60 in original plan
```

### Test Case IOP-001: IOP Entry and Alerts

| Value | Expected |
|-------|----------|
| 14 mmHg | Normal, no alert |
| 21 mmHg | Normal high boundary |
| 22 mmHg | Borderline, yellow warning |
| 28 mmHg | Elevated, orange alert |
| 35+ mmHg | Critical, red alert |
| 80 mmHg | Maximum accepted |
| 81 mmHg | Rejected "Hors limites" |

### IOP Data Structure:

```javascript
{
  iop: {
    OD: {
      value: 16,
      method: "applanation",  // applanation, tonopen, icare, palpation
      device: "Goldmann",
      time: "09:30",
      pachymetry: {
        thickness: 545,
        method: "ultrasound"
      }
    },
    OS: { /* same structure */ }
  }
}
```

## 3.5 Pathology Findings

### Verified Structure (Visit.js)

```javascript
{
  pathologyFindings: [{
    template: ObjectId("..."),  // ref: PathologyTemplate
    category: "anterior_segment",
    subcategory: "cornea",
    type: "finding",  // symptom, description, finding
    laterality: "OD",  // OD, OS, OU, OG, ODG
    severity: "++",  // -, +/-, +, ++, +++, ++++, 0
    details: "..."
  }]
}
```

**Laterality Options:** OD, OS, OU (both), OG (French OS), ODG (French both)

## 3.6 Diagnosis (ICD-10)

### Test Case DX-001: Diagnosis Search

**Route:** `GET /api/ophthalmology/exams/:id/diagnosis` (or search endpoint)

| Search | Expected |
|--------|----------|
| "glaucome" | H40.x codes |
| "H40.11" | Primary open-angle glaucoma |
| "cataracte" | H25.x, H26.x codes |
| "DMLA" | H35.30, H35.31, H35.32 |

### Diagnosis Data Structure:

```javascript
{
  diagnosis: [{
    icd10: "H40.11X1",
    description: "Glaucome primitif à angle ouvert, stade léger, œil droit",
    eye: "od",
    status: "confirmed",  // suspected, confirmed, ruled_out
    onset: "chronic",     // acute, chronic, unknown
    notes: "..."
  }]
}
```

---

# Module 4: Prescriptions

## 4.1 Prescription Model (Verified - Large Model)

### Key Fields (Prescription.js - 1779 lines)

| Field | Type | Notes |
|-------|------|-------|
| `prescriptionId` | String | Auto-generated |
| `type` | Enum | medication/optical/therapy/medical-device/lab-test |
| `status` | Enum | draft/pending/ready/partial/dispensed/cancelled/expired |
| `pharmacyStatus` | Enum | pending/reviewing/preparing/ready/dispensed/issue |
| `patient` | ObjectId | Required |
| `prescriber` | ObjectId | Required (must be doctor) |
| `clinic` | ObjectId | Required, indexed |
| `dateIssued` | Date | Required |
| `validUntil` | Date | 90 days for meds, 365 for optical |

### Medication Structure:

```javascript
{
  medications: [{
    drug: ObjectId("..."),  // ref: Drug (BDPM)
    inventoryItem: ObjectId("..."),  // CRITICAL: must link to Inventory
    name: "Timoptol 0.5% collyre",
    genericName: "Timolol",
    strength: "0.5%",
    form: "collyre",

    // Administration
    route: "ophthalmic",  // 20+ options
    eye: "both",  // OD, OS, OU, null
    eyeArea: "conjunctiva",  // for ophthalmic

    // Dosage
    dosage: {
      amount: "1",
      unit: "goutte",
      frequency: { times: 2, period: "day" },
      duration: { value: 3, unit: "months" },
      timing: ["matin", "soir"],
      withFood: null
    },

    // Quantity
    quantity: 2,  // bottles
    refills: { allowed: 2, remaining: 2 },
    substitutionAllowed: true,

    // Tapering (for corticosteroids)
    taperingSchedule: {
      enabled: false,
      schedule: []
    },

    // Inventory Reservation
    reservation: {
      reservationId: "...",
      reservedQuantity: 2,
      reservedBatches: [{ lotNumber: "LOT2024A", quantity: 2, expirationDate: Date }],
      status: "reserved"  // pending, reserved, fulfilled, cancelled
    },

    // Safety Checks
    safetyCheck: {
      allergies: [],
      interactions: [],
      contraindications: [],
      warnings: [],
      checksPerformedAt: Date,
      overridden: false
    },

    // Dispensing
    dispensing: {
      dispensed: false,
      dispensedQuantity: 0,
      dispensedBatches: [],
      dispensedBy: ObjectId,
      dispensedAt: Date,
      invoiceItemId: ObjectId  // Links to invoice
    }
  }]
}
```

### Test Case RX-001: Drug Prescription Creation

**Route:** `POST /api/prescriptions`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Search medication | BDPM results shown |
| 2 | Select "Timoptol 0.5%" | Drug details populate |
| 3 | Set dosage "1 goutte 2x/jour" | Validated |
| 4 | Set duration "3 mois" | Expiry calculated |
| 5 | Set quantity "2 flacons" | Inventory checked |
| 6 | Click save | Prescription created |

### Test Case RX-002: Drug Interaction Check

**Route:** `POST /api/prescriptions/check-interactions`

**Features:**
- Drug-drug interactions from BDPM
- Allergy checking
- Contraindication warnings
- Override with audit logging

| Scenario | Expected |
|----------|----------|
| No interactions | Green checkmark |
| Minor interaction | Info message |
| Moderate interaction | Warning, confirm to proceed |
| Severe interaction | Alert, must acknowledge risk |
| Patient allergy match | Block prescription |

### Test Case RX-003: Optical Prescription

**Type:** `optical`

**Structure:**
```javascript
{
  optical: {
    prescriptionType: "glasses",  // glasses, contacts, both
    OD: {
      sphere: -2.50,
      cylinder: -0.75,
      axis: 90,
      add: null,
      prism: null,
      base: null,
      va: "10/10",
      // For contacts:
      baseCurve: null,
      diameter: null,
      brand: null
    },
    OS: { /* same */ },
    pd: {
      binocular: 64,
      monocular: { od: 32, os: 32 }
    },
    vertexDistance: 12,
    pantoscopicTilt: 10,
    frameWrap: 5,
    lensType: "progressive",
    lensMaterial: "polycarbonate",
    lensCoatings: ["anti-reflective", "blue-light"],
    tint: null,
    specialInstructions: "..."
  }
}
```

---

# Module 5: Pharmacy & Inventory

## 5.1 Unified Inventory Model (Verified)

### Inventory Types (Discriminator Pattern):

| Type | Description |
|------|-------------|
| `pharmacy` | Medications/drugs |
| `frame` | Eyeglass frames |
| `contact_lens` | Contact lenses |
| `optical_lens` | Optical lenses |
| `reagent` | Laboratory reagents |
| `lab_consumable` | Lab supplies |
| `surgical_supply` | Surgical supplies |

### Key Fields (Inventory.js):

```javascript
{
  inventoryType: "pharmacy",  // Discriminator
  sku: "TIM-05-30",
  barcode: "3400936...",
  name: "Timoptol 0.5% 30ml",
  brand: "MSD",
  manufacturer: "Merck",
  category: "glaucoma",

  clinic: ObjectId("..."),  // Multi-clinic
  isDepot: false,  // Central warehouse flag

  inventory: {
    currentStock: 50,
    reserved: 5,
    available: 45,  // currentStock - reserved
    unit: "bottle",
    minimumStock: 10,
    reorderPoint: 20,
    maximumStock: 100,
    status: "in_stock"  // in_stock, low_stock, out_of_stock, overstocked, discontinued
  },

  batches: [{
    lotNumber: "LOT2024A",
    quantity: 30,
    expirationDate: ISODate("2026-12-15"),
    receivedDate: ISODate("2024-01-15"),
    cost: 2500,  // Purchase price per unit
    supplier: ObjectId("..."),
    status: "available"  // available, reserved, expired, recalled, quarantine
  }],

  pricing: {
    costPrice: 2500,
    sellingPrice: 3500,
    wholesalePrice: 3000,
    margin: 0.40,
    currency: "CDF",
    taxRate: 0.16
  },

  transactions: [{
    type: "dispensed",  // received, dispensed, adjusted, transferred, returned, expired, damaged, reserved, released
    quantity: 2,
    previousQuantity: 52,
    newQuantity: 50,
    batchId: ObjectId("..."),
    reason: "Prescription #RX-2024-001",
    reference: ObjectId("prescription-id"),
    referenceType: "prescription",
    performedBy: ObjectId("pharmacist-id"),
    performedAt: ISODate("...")
  }]
}
```

### Test Case INV-001: Stock Receipt

**Route:** `POST /api/pharmacy` or stock operation endpoint

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click "Réception" | Receipt form |
| 2 | Search medication | Results shown |
| 3 | Enter quantity: 50 | Validated |
| 4 | Enter batch: "LOT2024A" | Accepted |
| 5 | Enter expiry: 15/12/2026 | Validated (future date) |
| 6 | Enter cost: 2500 CDF | Per unit |
| 7 | Click save | Stock updated |

### Test Case INV-002: FEFO Dispensing

**First Expiry, First Out Logic:**

```javascript
// Auto-select batch with nearest expiry that has sufficient quantity
batches
  .filter(b => b.status === 'available' && b.quantity >= requestedQuantity)
  .sort((a, b) => a.expirationDate - b.expirationDate)[0]
```

### Test Case INV-003: Expiry Alerts

| Days to Expiry | Alert Level |
|----------------|-------------|
| >90 days | None |
| 60-90 days | Info (yellow) |
| 30-60 days | Warning (orange) |
| <30 days | Critical (red) |
| ≤0 | Expired - cannot dispense |

### Test Case INV-004: Inter-Clinic Transfer

**Structure:**
```javascript
{
  type: "transfer",
  fromClinic: ObjectId("gombe-id"),
  toClinic: ObjectId("limete-id"),
  items: [{
    inventoryItem: ObjectId("..."),
    quantity: 20,
    batch: "LOT2024A"
  }],
  status: "completed",  // requested, approved, shipped, received
  requestedBy: ObjectId("..."),
  approvedBy: ObjectId("..."),
  shippedAt: ISODate("..."),
  receivedBy: ObjectId("..."),
  receivedAt: ISODate("...")
}
```

---

# Module 6: Financial & Billing

## 6.1 Invoice Model (Verified)

### Key Fields (Invoice.js):

```javascript
{
  invoiceId: "INV-2024-001234",  // Auto-generated
  patient: ObjectId("..."),
  visit: ObjectId("..."),
  clinic: ObjectId("..."),

  dateIssued: ISODate("..."),
  dueDate: ISODate("..."),  // Default: 30 days

  items: [{
    itemId: "item-uuid",  // Immutable ObjectId string
    description: "Consultation ophtalmologie",
    category: "consultation",  // consultation, procedure, medication, imaging, laboratory, therapy, device, surgery, examination, optical, other
    code: "OPHC001",  // CPT/billing code
    quantity: 1,
    unitPrice: 50000,
    discount: 0,
    subtotal: 50000,
    tax: 8000,
    total: 58000,

    // Realization tracking
    realization: {
      realized: false,  // Was the service actually performed?
      realizedAt: Date,
      realizedBy: ObjectId,
      notes: ""
    },

    // Prescriber info
    prescriber: {
      userId: ObjectId,
      name: "Dr. Kabongo",
      prescribedAt: Date
    },

    // Prior approval
    approval: {
      required: false,
      approvalStatus: "not_required",
      approvalNumber: "",
      approvalDate: Date
    }
  }],

  summary: {
    subtotal: 150000,
    tax: 24000,
    total: 174000,
    amountDue: 174000,
    amountPaid: 0
  },

  payments: [{
    method: "cash",  // cash, card, check, bank-transfer, insurance, mobile-payment, orange-money, mtn-money, wave, other
    amount: 50000,
    reference: "RCPT-001",
    receivedBy: ObjectId,
    receivedAt: ISODate
  }],

  currency: "CDF",  // CDF, USD, EUR
  status: "pending",  // draft, pending, finalized, closed
  source: "consultation"  // pharmacy, consultation, lab, imaging
}
```

### Test Case FN-001: Invoice Line Items

| Item | Qty | Unit Price | Line Total |
|------|-----|------------|------------|
| Consultation | 1 | 50,000 CDF | 50,000 CDF |
| OCT bilatéral | 1 | 75,000 CDF | 75,000 CDF |
| Timoptol 0.5% | 2 | 15,000 CDF | 30,000 CDF |
| **Subtotal** | | | **155,000 CDF** |

### Test Case FN-002: Payment Methods

**Verified Payment Methods:**
- `cash` - Cash payment
- `card` - Card payment
- `check` - Check
- `bank-transfer` - Bank transfer
- `insurance` - Convention/insurance
- `mobile-payment` - Generic mobile
- `orange-money` - Orange Money
- `mtn-money` - MTN Mobile Money
- `wave` - Wave
- `other` - Other

### Test Case FN-003: Multi-Currency

**Verified Currencies (financialValidation.js):**

| Currency | Decimals | Max Amount |
|----------|----------|------------|
| CDF | 0 | 1 trillion |
| USD | 2 | 500 million |
| EUR | 2 | 500 million |

**Display Formats:**
- CDF: `150 000 FC` (space separator, no decimals)
- USD: `52,50 $` (comma decimal)
- EUR: `48,00 €` (comma decimal)

### Test Case FN-004: Convention Billing (Company Split)

**Route:** `POST /api/invoices/:id/apply-company-billing`

**Calculation Logic (with Global Annual Limit Fix):**

```javascript
// 1. Calculate company share based on coverage %
const companyShare = invoiceTotal * (coverage.percentage / 100);

// 2. Check category-specific limit
if (companyShare > categoryRemainingLimit) {
  companyShare = categoryRemainingLimit;
}

// 3. Check GLOBAL annual limit (Fixed in Invoice.js)
const globalRemaining = company.defaultCoverage.maxAnnual - ytdUsage;
if (companyShare > globalRemaining) {
  companyShare = globalRemaining;
}

// 4. Patient pays remainder
const patientShare = invoiceTotal - companyShare;
```

**Test Scenario:**
- Patient has SONAS: 80% company / 20% patient
- Annual limit: 500,000 CDF
- YTD usage: 450,000 CDF
- Invoice: 100,000 CDF

**Expected:**
```
Remaining limit: 50,000 CDF
Company share requested: 80,000 CDF
Capped to remaining: 50,000 CDF
Patient pays: 50,000 CDF
```

---

# Module 7: IVT (Intravitreal Injection)

## 7.1 IVT Model (Verified)

### Key Fields (IVTInjection.js):

```javascript
{
  patient: ObjectId,
  clinic: ObjectId,
  visit: ObjectId,

  eye: "OD",  // OD, OS
  medication: "lucentis",  // avastin, lucentis, eylea, etc.

  protocol: {
    type: "loading",  // loading, maintenance, prn, treat_and_extend
    injectionNumber: 2,
    totalPlanned: 3
  },

  preOperative: {
    iop: 16,
    consent: true,
    allergiesVerified: true,
    pupilDilated: true
  },

  injection: {
    dose: 0.5,  // mg
    batch: "LOT-2024-LUC-005",
    site: "inferotemporal",  // inferotemporal, supratemporal, etc.
    distance: 3.5,  // mm from limbus
    time: ISODate,
    injector: ObjectId
  },

  postOperative: {
    iop: 18,
    lightPerception: true,
    complications: [],
    instructions: "..."
  },

  nextDue: ISODate,
  status: "completed"  // scheduled, in_progress, completed, cancelled
}
```

### Test Case IVT-001: Pre-Injection Validation

| Check | Required | Fail Condition |
|-------|----------|----------------|
| Pre-IOP | Yes | >30 mmHg → Cannot proceed |
| Consent | Yes | Not signed → Cannot proceed |
| Allergies verified | Yes | Not confirmed → Warning |
| Pupil dilated | Yes | Not confirmed → Warning |

### Test Case IVT-002: Protocol Tracking

**Loading Phase (Lucentis example):**
| Injection | Due Date | Status |
|-----------|----------|--------|
| 1 | Jan 15 | Completed |
| 2 | Feb 15 (4 weeks) | Completed |
| 3 | Mar 15 (4 weeks) | Due |

**After Loading:**
- Maintenance or PRN based on response

---

# Module 8: Real-Time Features

## 8.1 WebSocket Implementation

### Verified Services

**Backend:** `websocketService.js` (Socket.io v4+)
- Path: `/socket.io/`
- Ping interval: 5 seconds
- Message buffer: 100 messages/room, 15-min TTL
- User buffer: 50 messages/user

**Frontend Hook:** `useWebSocket.js`
- Auto-reconnect with backoff
- Room subscription
- Event listeners

### WebSocket Events

| Event | Room | Payload |
|-------|------|---------|
| `queue:add` | `queue:${clinicId}` | Patient, position |
| `queue:call` | `queue:${clinicId}` | Patient ID, caller |
| `queue:complete` | `queue:${clinicId}` | Patient ID |
| `inventory:low` | `inventory:${clinicId}` | Item, quantity |
| `appointment:created` | `appointments:${clinicId}` | Appointment |

### Test Case WS-001: Real-Time Queue Update

| Step | User A Action | User B Sees |
|------|---------------|-------------|
| 1 | Add patient to queue | New row appears |
| 2 | Call patient | Status changes to "Appelé" |
| 3 | Start consultation | Patient moves to "En cours" |
| 4 | Complete | Patient removed |

**Timing:** Updates within 1 second

---

# Module 9: Offline Mode

## 9.1 Offline-First Architecture (Verified)

### Frontend Services

| Service | Purpose |
|---------|---------|
| `syncService.js` | 23 entity types, clinic-specific intervals |
| `offlineWrapper.js` | API wrapper with fallback |
| `databaseService.js` | IndexedDB via Dexie.js |
| `offlinePatientService.js` | Patient data persistence |
| `offlineQueueService.js` | Queue persistence |

### Sync Entities (23 types)

Standard sync: patients, appointments, prescriptions, visits, invoices, drugs, clinicalTemplates, ophthalmologyExams, laboratoryResults, imagingStudies

Extended sync: pharmacyInventory, orthopticExams, glassesOrders, frameInventory, contactLensInventory, clinics, approvals, stockReconciliations, treatmentProtocols, ivtVials, surgeryCases, consultationSessions, devices

### Test Case OF-001: Offline Patient Creation

| Step | Network | Action | Expected |
|------|---------|--------|----------|
| 1 | Online | Note patient count | N patients |
| 2 | Offline | Disconnect | OfflineIndicator shows |
| 3 | Offline | Create patient | Saved to IndexedDB |
| 4 | Offline | Search patient | Found locally |
| 5 | Online | Reconnect | Sync starts |
| 6 | Online | Verify MongoDB | Patient synced |
| 7 | Online | Count | N + 1 |

### Test Case OF-002: Conflict Resolution

**Sync Queue Model (SyncQueue.js):**
```javascript
{
  syncId: "SYNC-...",
  clinicId: "...",
  operation: "update",  // create, update, delete
  collection: "patients",
  documentId: ObjectId,
  data: { /* changes */ },
  status: "pending",  // pending, syncing, synced, failed, conflict, dead_letter

  conflict: {
    detected: true,
    centralVersion: { /* server data */ },
    resolution: "pending"  // pending, local_wins, central_wins, merged, manual
  }
}
```

**UI Component:** `ConflictResolutionModal.jsx`

---

# Module 10: Multi-Clinic Isolation

## 10.1 Clinic Context Middleware

### Verified Implementation (clinicAuth.js)

**Header:** `X-Clinic-ID`

**Middleware Functions:**
- `clinicContext()` - Extract and validate clinic
- `requireClinic` - Strict requirement
- `optionalClinic` - Flexible (most routes)
- `buildClinicQuery(req, baseQuery)` - Query helper

### Test Case MC-001: Data Isolation

| User at Gombe | Action | Expected |
|---------------|--------|----------|
| List patients | GET /api/patients | Only Gombe patients |
| Access Tombalbaye patient | Direct URL | 404 Not Found |
| API with wrong clinic header | Request | 403 Forbidden |
| Admin with accessAllClinics | No header | All clinics |

---

# Module 11: Audit Logging

## 11.1 Verified Audit Points

### Logged Operations

| Category | Examples |
|----------|----------|
| Patient Access | View, edit, delete patient |
| Critical Operations | Payments, refunds, write-offs |
| Prescriptions | Create, dispense, override safety |
| Permissions | Denied access attempts |
| Appointments | Cancel, no-show, reschedule |

### Audit Log Fields (AuditLog.js)

```javascript
{
  user: ObjectId,
  action: "PATIENT_VIEWED",
  resource: "Patient",
  resourceId: ObjectId,
  changes: { before: {...}, after: {...} },
  ipAddress: "...",
  userAgent: "...",
  timestamp: ISODate,
  clinic: ObjectId,
  details: { /* context-specific */ }
}
```

**TTL:** 6 years (HIPAA compliance - fixed from 2 years)

---

# Data Integrity Verification Queries

## Cross-Module Integrity Checks

```javascript
// Orphaned visits (no patient)
db.visits.aggregate([
  { $lookup: { from: "patients", localField: "patient", foreignField: "_id", as: "p" }},
  { $match: { p: { $size: 0 } }}
])

// Prescriptions with invalid inventory links
db.prescriptions.aggregate([
  { $unwind: "$medications" },
  { $match: { "medications.inventoryItem": { $ne: null } }},
  { $lookup: { from: "inventories", localField: "medications.inventoryItem", foreignField: "_id", as: "inv" }},
  { $match: { inv: { $size: 0 } }}
])

// Convention YTD exceeding limit
db.patients.aggregate([
  { $unwind: "$conventions" },
  { $lookup: { from: "companies", localField: "conventions.conventionId", foreignField: "_id", as: "company" }},
  { $match: {
    $expr: { $gt: ["$conventions.yearToDateUsage", { $arrayElemAt: ["$company.defaultCoverage.maxAnnual", 0] }] }
  }}
])

// Duplicate MRNs (should be empty)
db.patients.aggregate([
  { $group: { _id: { mrn: "$patientId", clinic: "$homeClinic" }, count: { $sum: 1 } }},
  { $match: { count: { $gt: 1 } }}
])
```

---

# Test Execution Checklist

## Pre-Testing Setup
- [ ] MongoDB running (replica set for transactions)
- [ ] Redis running (sessions/cache)
- [ ] Face-service running (port 5002)
- [ ] Test clinics seeded (Gombe, Tombalbaye, Limete)
- [ ] Test users for all 7+ roles
- [ ] Test conventions configured
- [ ] Test inventory stocked

## Module Execution Order

| Order | Module | Priority | Dependencies |
|-------|--------|----------|--------------|
| 1 | Authentication | Critical | None |
| 2 | Patient Management | Critical | Auth |
| 3 | Appointments | High | Patients |
| 4 | Queue | High | Appointments |
| 5 | StudioVision (8 tabs) | Critical | Patients, Queue |
| 6 | Prescriptions | High | Visits |
| 7 | Pharmacy/Inventory | High | Prescriptions |
| 8 | Billing/Invoices | Critical | All |
| 9 | IVT Protocol | Medium | Patients, Visits |
| 10 | Offline Mode | High | All |
| 11 | Real-Time | Medium | Queue, Billing |
| 12 | Multi-Clinic | Critical | All |

---

# Sign-Off

| Module | Tester | Date | Status | Notes |
|--------|--------|------|--------|-------|
| Patient Management | | | | |
| Appointments | | | | |
| Queue | | | | |
| StudioVision | | | | |
| Prescriptions | | | | |
| Pharmacy | | | | |
| Billing | | | | |
| IVT Protocol | | | | |
| Offline Mode | | | | |
| Real-Time | | | | |
| Multi-Clinic | | | | |

**Final Approval:**
- [ ] All critical tests passed
- [ ] Data integrity verified
- [ ] Performance acceptable
- [ ] Ready for production

**Approved By:** _________________ **Date:** _________________
