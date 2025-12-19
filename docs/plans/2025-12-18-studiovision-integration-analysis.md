# StudioVision Integration Analysis

## E2E Module Connections Analysis

Date: 2025-12-18

## Overview

This document analyzes how the StudioVision consultation module integrates with other MedFlow modules (invoicing, pharmacy, stock management).

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          StudioVision Consultation                          │
│  /ophthalmology/studio/:patientId                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Tabs: Résumé │ Réfraction │ Lentilles │ Pathologies │ Orthoptie │         │
│        Examen │ Traitement │ Règlement                                      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Visit Model                                     │
│  - Stores clinical data (refraction, examination, diagnoses)                │
│  - Links to prescriptions, clinical acts, appointments                       │
│  - Triggers invoice generation on completion                                 │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Invoice Module  │  │ Prescription Mod │  │  Pharmacy Module │
│                  │  │                  │  │                  │
│ - Auto-generated │  │ - Optical        │  │ - Dispensing     │
│   on visit.      │  │ - Medication     │  │ - Stock FIFO     │
│   complete()     │  │ - Status flow    │  │ - Reservation    │
│ - FeeSchedule    │  │                  │  │                  │
│   lookups        │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Integration Flows

### 1. Consultation → Invoice (AUTO-INVOICING)

**Location**: `backend/models/Visit.js:1445` - `generateInvoice()`

**Flow**:
```
Visit.complete(userId)
    │
    ├── 1. Process prescriptions (reserve inventory)
    │
    ├── 2. Check if invoice exists
    │       └── If not: call this.generateInvoice()
    │
    ├── 3. Update appointment status → 'completed'
    │
    └── 4. Set visit.status = 'completed'
```

**Invoice Generation Logic** (`Visit.generateInvoice()`):
1. **Consultation Fee**: Based on visit type (initial=15,000 CFA, followup=10,000 CFA)
2. **Clinical Acts**: Only COMPLETED acts are billed (planned acts excluded)
3. **Device Charges**: OCT, tonometry, visual field, etc. with FeeSchedule lookups
4. **Price Capture**: Prices captured at service time with audit trail

**FeeSchedule Integration**:
```javascript
const devicePriceMapping = {
  'autorefractor': { code: 'EXAM-AUTOREFRACTION', fallback: 3000 },
  'tonometer': { code: 'EXAM-TONOMETRY', fallback: 5000 },
  'oct': { code: 'EXAM-OCT-MACULA', fallback: 25000 },
  'visual-field': { code: 'EXAM-VISUAL-FIELD-HUMPHREY', fallback: 15000 },
  // ... etc
};
```

### 2. Prescription → Pharmacy (DISPENSING FLOW)

**Location**: `backend/utils/transactions.js:348` - `dispensePrescription()`

**Prescription Status Flow**:
```
draft → pending → approved → dispensed → completed
                              ↑
                   Pharmacist dispenses
                   Stock decremented
```

**Dispensing Process**:
```javascript
async function dispensePrescription(prescriptionId, items, options) {
  // 1. Validate prescription status
  if (prescription.status === 'dispensed') {
    throw new Error('Already dispensed');
  }

  // 2. Process each medication
  for (const item of items) {
    // FIFO batch dispensing
    const result = await dispenseBatchFIFO(medicationId, quantity, session);
    dispensedItems.push({ medication, quantity, batches: result.dispensedFrom });
  }

  // 3. Update prescription status
  prescription.status = 'dispensed';
  prescription.dispensedAt = new Date();
  prescription.dispensedBy = options.userId;

  // 4. Record in dispensing history
  prescription.dispensingHistory.push({ date, items, dispensedBy });
}
```

**Unified Billing Integration**:
When medications are dispensed, they're marked as completed on the visit invoice:
```javascript
// Prescription.js:1552
prescriptionSchema.methods.markMedicationsCompletedOnVisitInvoice()
```

### 3. Stock Management (FIFO DISPENSING)

**Location**: `backend/utils/transactions.js:159` - `dispenseBatchFIFO()`

**Batch Selection Logic**:
```javascript
async function dispenseBatchFIFO(inventoryId, quantity, session) {
  // 1. Get inventory with batches sorted by expiration (FEFO)
  const inventory = await PharmacyInventory.findById(inventoryId);

  // 2. Sort batches by expiration date (First Expired, First Out)
  const batches = inventory.batches
    .filter(b => b.status === 'active' && b.quantity > 0)
    .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

  // 3. Dispense from batches
  const dispensedFrom = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const toDispense = Math.min(batch.quantity, remaining);
    batch.quantity -= toDispense;
    remaining -= toDispense;
    dispensedFrom.push({ batchId, lotNumber, quantity: toDispense });
  }

  // 4. Update inventory totals
  inventory.inventory.currentStock -= quantity;

  return { dispensedFrom };
}
```

### 4. Surgery Case Auto-Creation

**Location**: `backend/controllers/invoiceController.js:18` - `createSurgeryCasesIfNeeded()`

**Trigger**: When invoice is paid and contains surgery items

**Detection Logic**:
```javascript
const surgeryKeywords = [
  'phaco', 'phacoémulsification', 'cataracte',
  'trabéculectomie', 'vitrectomie', 'kératoplastie',
  'implant', 'iol', 'chirurgie', 'ivt'
];

// Surgery case created with:
{
  patient: invoice.patient,
  clinic: invoice.clinic,
  surgeryType: matchedClinicalAct._id,
  eye: 'OD' | 'OS' | 'OU', // Detected from description
  status: 'awaiting_scheduling',
  paymentDate: new Date()
}
```

## Frontend Integration Points

### StudioVision Consultation Page

**File**: `frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx`

**Service Calls**:
```javascript
// Patient data
const patientResponse = await patientService.getPatient(patientId);

// Consultation history
const historyResponse = await ophthalmologyService.getPatientExamHistory(patientId);

// Visit data (if resuming)
const visitResponse = await visitService.getVisit(visitId);

// Save exam
await ophthalmologyService.saveExam({ patientId, visitId, data });
```

### Pharmacy Dispensing UI

**File**: `frontend/src/components/pharmacy/DispenseDialog.jsx`

**Dispensing Options**:
1. **From Prescription**: `pharmacyInventoryService.dispensePrescription(prescriptionId, medicationIndex, pharmacyNotes)`
2. **Direct from Inventory**: `pharmacyInventoryService.dispense(medicationId, { quantity, lotNumber, patientId, notes })`

## Verified Integration Points

| Integration | Status | Backend Location | Frontend Location |
|-------------|--------|------------------|-------------------|
| Visit → Invoice | ✅ Working | `Visit.generateInvoice()` | Auto on completion |
| Visit → Prescription | ✅ Working | Visit.prescriptions[] | TreatmentBuilder |
| Prescription → Pharmacy Queue | ✅ Working | prescription.status | PrescriptionQueue |
| Dispense → Stock Decrement | ✅ Working | `dispenseBatchFIFO()` | DispenseDialog |
| Invoice → Surgery Case | ✅ Working | `createSurgeryCasesIfNeeded()` | Auto on payment |
| FeeSchedule → Pricing | ✅ Working | `getFeeFromSchedule()` | Invoice display |

## Minor Issues Fixed During Analysis

1. **Patient address rendering**: Fixed object rendering (`{street, city, country}`)
2. **Medical history rendering**: Fixed nested object (`{allergies, chronicConditions, surgeries}`)
3. **Consultation history array**: Fixed response structure handling
4. **Service method names**: Fixed `getById` → `getPatient`/`getVisit`

## Screenshots Captured

| Screenshot | Description |
|------------|-------------|
| `20_studiovision_main.png` | Full StudioVision Résumé tab with color-coded sections |
| `21_refraction.png` | Réfraction tab with OD/OG grid, renouvellement buttons |
| `22_lentilles.png` | Contact lens fitting tab |
| `23_pathologies.png` | Pathology picker |
| `24_examen.png` | Clinical examination panel |
| `25_traitement.png` | TreatmentBuilder with 26 medication categories |
| `40_visits_dashboard.png` | Visits list showing completed visits |
| `50_pharmacy_main.png` | Pharmacy inventory (635 items, 1.4B CFA) |

## Conclusion

The StudioVision consultation module is fully integrated with:
- **Auto-invoicing**: Invoice generated automatically when visit is completed
- **Pharmacy dispensing**: Prescriptions flow to pharmacy queue with FIFO stock management
- **Price capture**: FeeSchedule lookups with fallback pricing
- **Surgery workflow**: Automatic surgery case creation on invoice payment

The implementation matches the original StudioVision XP workflow while adding modern features like offline support and multi-clinic capabilities.
