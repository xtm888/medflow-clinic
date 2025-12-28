# StudioVision Consultation - Integration Gap Analysis

**Date:** 2025-12-28
**Status:** CRITICAL - Multiple disconnected data flows identified

---

## Executive Summary

The StudioVision consultation interface has comprehensive UI components for clinical workflow, but **critical backend integrations are missing**. Data entered during consultation (prescriptions, lab orders, procedures, surgeries) stays in local component state and is NOT connected to the backend services that would:

1. Create actual lab orders
2. Send prescriptions to pharmacy
3. Schedule surgery cases
4. Generate invoices from procedures

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    StudioVisionConsultation.jsx                  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Refraction  │  │ Diagnostic  │  │    TreatmentBuilder     │  │
│  │   Panel     │  │   Panel     │  │    (Prescriptions)      │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         ▼                ▼                      ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Local State: data = {...}                    │   │
│  │  - data.refraction                                        │   │
│  │  - data.diagnostic.diagnoses[]                            │   │
│  │  - data.diagnostic.procedures[]                           │   │
│  │  - data.diagnostic.laboratory[]    ◄── NOT SENT TO BACKEND│   │
│  │  - data.diagnostic.surgery[]       ◄── NOT SENT TO BACKEND│   │
│  │  - data.prescription.medications[] ◄── NOT SENT TO BACKEND│   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│                   handleSave() ──► ophthalmologyService.saveExam │
│                                    (ONLY saves exam data)        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WHAT GETS SAVED                              │
│                                                                  │
│  ✅ OphthalmologyExam (MongoDB)                                  │
│     - visualAcuity, refraction, tonometry                        │
│     - slitLamp, fundus, diagnostic                               │
│     - Raw prescription data embedded in exam                     │
│                                                                  │
│  ❌ LabOrder - NOT CREATED                                       │
│  ❌ Prescription - NOT CREATED                                   │
│  ❌ SurgeryCase - NOT CREATED                                    │
│  ❌ Invoice - NOT CREATED                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Gap #1: Lab Orders Not Created

### Current Behavior
- `DiagnosticPanel.jsx` has a "Laboratory" tab
- User can search and add lab tests (e.g., HBA1C, FNS, NFS)
- Tests are added to `diagnosticData.laboratory[]` array
- **But no `labOrderService.createLabOrder()` is ever called**

### What Should Happen
```javascript
// When user adds lab test in DiagnosticPanel:
const addLabTest = async (test) => {
  // Current: Just updates local state
  newData.laboratory.push({...test, addedAt: new Date()});
  onChange?.(newData);

  // MISSING: Should also call:
  await labOrderService.createLabOrder({
    patientId,
    visitId,
    tests: [{ code: test.code, name: test.name }],
    orderedBy: currentUser._id,
    priority: 'routine',
    clinic: currentClinicId
  });
};
```

### Impact
- Lab staff never sees the order
- No specimen collection workflow triggered
- No billing for lab tests

---

## Gap #2: Prescriptions Not Sent to Pharmacy

### Current Behavior
- `TreatmentBuilder.jsx` builds prescription data
- User can add medications with dosing, frequency, duration
- Data stored in `data.prescription.medications[]`
- **But no `prescriptionService.createDrugPrescription()` is ever called**

### What Should Happen
```javascript
// When consultation is completed/saved:
const handleComplete = async () => {
  // Current: Just saves exam and navigates
  const saved = await handleSave();
  if (saved) navigate(`/patients/${patientId}`);

  // MISSING: Should also create prescription:
  if (data.prescription?.medications?.length > 0) {
    await prescriptionService.createDrugPrescription({
      patientId,
      visitId,
      medications: data.prescription.medications,
      prescriber: currentUser._id,
      clinic: currentClinicId
    });
  }
};
```

### Impact
- Pharmacy never sees the prescription
- No drug interaction checks performed
- No stock reservation or dispensing workflow
- No billing for medications

---

## Gap #3: Surgery Cases Not Created

### Current Behavior
- `DiagnosticPanel.jsx` has a "Surgery" tab
- User can select surgical procedures (cataract, vitrectomy, etc.)
- Procedures added to `diagnosticData.surgery[]`
- **But no `surgeryService.createCase()` is ever called**

### What Should Happen
```javascript
// When surgery is prescribed:
const addSurgeryAct = async (surgeryAct) => {
  // Current: Just updates local state
  newData.surgery.push({...surgeryAct, addedAt: new Date()});
  onChange?.(newData);

  // MISSING: Should also create surgery case:
  await surgeryService.createCase({
    patientId,
    surgeryType: surgeryAct.code,
    eye: surgeryAct.eye, // OD/OS/OU
    indication: diagnosis,
    requestedBy: currentUser._id,
    clinic: currentClinicId,
    status: 'awaiting_scheduling'
  });
};
```

### Impact
- Surgery scheduler never sees the case
- No OR booking workflow triggered
- No pre-op checklist generated
- No billing for surgical procedure

---

## Gap #4: Invoices Not Generated

### Current Behavior
- Règlement (Payment) tab is a **placeholder**
- Just shows "Accessible via le module Facturation"
- Button redirects to `/invoicing?patientId=`
- **No invoice auto-generated from consultation procedures**

### What Should Happen
```javascript
// When consultation is completed:
const handleComplete = async () => {
  // Current behavior:
  const saved = await handleSave();
  if (saved) navigate(`/patients/${patientId}`);

  // MISSING: Auto-generate invoice from all services rendered:
  const invoiceItems = [
    // Consultation fee
    { type: 'consultation', code: 'CONSULT_OPHTA', ... },
    // All procedures from diagnostic panel
    ...data.diagnostic.procedures.map(p => ({
      type: 'procedure', code: p.code, price: p.price
    })),
    // Lab tests
    ...data.diagnostic.laboratory.map(l => ({
      type: 'laboratory', code: l.code, price: l.price
    })),
    // Medications (if dispensed in-house)
    ...data.prescription.medications.map(m => ({
      type: 'medication', code: m.code, quantity: m.quantity
    }))
  ];

  await billingService.createInvoice({
    patientId,
    visitId,
    items: invoiceItems,
    clinic: currentClinicId
  });
};
```

### Impact
- Patient not billed for services
- Convention coverage not applied
- Revenue not tracked
- No payment workflow

---

## Gap #5: Missing `saveExam` Method

### Critical Bug Found
- `StudioVisionConsultation.jsx` line 256 calls:
  ```javascript
  await ophthalmologyService.saveExam({...});
  ```
- **But `saveExam` does not exist in `ophthalmologyService.js`**
- Available methods: `createExam`, `updateExam`, but no `saveExam`

### Impact
- Save button may silently fail
- Exam data potentially lost
- Inconsistent behavior between create vs update

---

## Required Integration Points

### 1. Consultation Start
```
Visit Created → OphthalmologyExam Created → StudioVision Opens
```

### 2. During Consultation (Real-time)
```
Lab Test Added     → labOrderService.createLabOrder()
Surgery Prescribed → surgeryService.createCase()
Procedure Added    → (queue for invoice generation)
```

### 3. Consultation Complete
```
Save Exam Data     → ophthalmologyService.updateExam()
Create Prescription → prescriptionService.createDrugPrescription()
Generate Invoice   → billingService.createInvoice()
Update Visit Status → visitService.completeVisit()
```

---

## Recommended Solution Architecture

### Option A: Backend Orchestration (Recommended)
Create a new endpoint that handles all the cross-domain logic:

```javascript
// POST /api/ophthalmology/consultations/:visitId/complete
app.post('/consultations/:visitId/complete', async (req, res) => {
  const { examData, prescriptions, labOrders, surgeries, procedures } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Save exam
    await OphthalmologyExam.findByIdAndUpdate(examId, examData, { session });

    // 2. Create lab orders
    for (const lab of labOrders) {
      await LabOrder.create([{ ...lab, visitId }], { session });
    }

    // 3. Create prescription
    if (prescriptions.medications?.length) {
      await Prescription.create([{ ...prescriptions, visitId }], { session });
    }

    // 4. Create surgery cases
    for (const surgery of surgeries) {
      await SurgeryCase.create([{ ...surgery, visitId }], { session });
    }

    // 5. Generate invoice
    const invoice = await Invoice.createFromVisit(visitId, { session });

    // 6. Update visit status
    await Visit.findByIdAndUpdate(visitId, { status: 'completed' }, { session });

    await session.commitTransaction();

    res.json({ success: true, invoiceId: invoice._id });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  }
});
```

### Option B: Frontend Orchestration
Update `handleComplete()` to call all services sequentially:

```javascript
const handleComplete = async () => {
  setSaving(true);
  try {
    // 1. Save exam
    await ophthalmologyService.updateExam(examId, data);

    // 2. Create lab orders
    if (data.diagnostic.laboratory?.length) {
      await labOrderService.createLabOrder({
        patientId, visitId,
        tests: data.diagnostic.laboratory
      });
    }

    // 3. Create prescription
    if (data.prescription.medications?.length) {
      await prescriptionService.createDrugPrescription({
        patientId, visitId,
        medications: data.prescription.medications
      });
    }

    // 4. Create surgery cases
    for (const surgery of data.diagnostic.surgery) {
      await surgeryService.createCase({
        patientId, visitId, ...surgery
      });
    }

    // 5. Create invoice
    const invoiceItems = buildInvoiceItems(data);
    await billingService.createInvoice({
      patientId, visitId, items: invoiceItems
    });

    navigate(`/patients/${patientId}`);
  } catch (error) {
    // Handle partial failures - this is why Option A is preferred
  }
};
```

---

## Services Analysis Summary

| Service | File | Key Methods | Connected to StudioVision? |
|---------|------|-------------|---------------------------|
| ophthalmologyService | ophthalmologyService.js | createExam, updateExam, saveDiagnosis | Partially (missing saveExam) |
| labOrderService | labOrderService.js | createLabOrder, collectSpecimen | **NO** |
| prescriptionService | prescriptionService.js | createDrugPrescription, createOpticalPrescription | **NO** |
| surgeryService | surgeryService.js | createCase, scheduleCase | **NO** |
| billingService | billingService.js | createInvoice, processPayment | **NO** |

---

## Priority Implementation Order

1. **P0 - Fix `saveExam` bug** - Exam data may not be saving
2. **P1 - Lab Order integration** - Most common workflow gap
3. **P1 - Prescription integration** - Patient safety (drug checks)
4. **P2 - Invoice generation** - Revenue impact
5. **P2 - Surgery case creation** - Scheduling workflow
6. **P3 - Real-time approval warnings** - Convention délibération

---

## Files Requiring Changes

### Frontend
- `frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx` - Main orchestration
- `frontend/src/pages/ophthalmology/components/panels/DiagnosticPanel.jsx` - Lab/surgery triggers
- `frontend/src/components/treatment/TreatmentBuilder.jsx` - Prescription creation
- `frontend/src/services/ophthalmologyService.js` - Add saveExam method

### Backend (if Option A)
- `backend/controllers/ophthalmology/index.js` - Add consultation completion endpoint
- `backend/routes/ophthalmology.js` - Add route

---

*Report generated: 2025-12-28*
