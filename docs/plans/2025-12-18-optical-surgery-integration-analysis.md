# Optical & Surgery Module Integration Analysis

## E2E Module Connections Verified

Date: 2025-12-18

---

## 1. OPTICAL MODULE (Glasses Orders)

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Ophthalmology Consultation                           │
│                 (StudioVision or NewConsultation)                           │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ finalPrescription (OD/OS values)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GlassesOrder.create()                              │
│  • Links to OphthalmologyExam                                               │
│  • Captures prescription snapshot                                           │
│  • Auto-calculates convention billing                                       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌──────────────┐     ┌──────────────────┐    ┌──────────────────┐
│FrameInventory│     │OpticalLensInvent.│    │ContactLensInvent.│
│              │     │                  │    │                  │
│ • Reserve    │     │ • Reserve        │    │ • Reserve OD/OS  │
│ • Fulfill    │     │ • Track specs    │    │ • Multi-box      │
│ • Track cost │     │ • Index/coating  │    │ • Base curve/dia │
└──────────────┘     └──────────────────┘    └──────────────────┘
```

### Order Status Flow (with QC)

```
draft ──► confirmed ──► sent-to-lab ──► in-production ──► received
                                                              │
                                        ┌─────────────────────┴─────────────────────┐
                                        ▼                                           ▼
                                   qc-passed ──► ready ──► delivered           qc-failed
                                                     │                              │
                                                     ▼                              │
                                              Stock Dispensed                       │
                                              (FIFO fulfillment)                    │
                                                                                    ▼
                                                                         Rework or Override
```

### Key Integration Points

| Integration | Backend Location | Description |
|-------------|------------------|-------------|
| **Prescription → Order** | `glassesOrderController.createOrder():115` | Creates order from exam's `finalPrescription`, captures snapshot with hash for change detection |
| **Confirm → Reserve Stock** | `glassesOrderController.updateStatus():377-482` | When status=confirmed, reserves from FrameInventory, OpticalLensInventory, ContactLensInventory |
| **QC Workflow** | `validTransitions:348-358` | `received → qc-passed/qc-failed → ready` - Quality control gate |
| **Deliver → Dispense Stock** | `updateStatus():486+` | When status=delivered, fulfills reservations (FIFO dispense from batches) |
| **Order → Invoice** | `generateInvoice():778+` | Creates invoice with convention billing (company portion / patient portion) |

### Inventory Reservation Logic

```javascript
// On CONFIRMED status (glassesOrderController.js:377-482)
if (status === 'confirmed' && previousStatus === 'draft') {
  // Reserve frame
  if (order.glasses?.frame?.inventoryItem) {
    const frame = await FrameInventory.findById(inventoryItem);
    const available = frame.inventory.currentStock - frame.inventory.reserved;
    if (available < 1) throw new Error('Stock insuffisant');
    await frame.reserveStock(1, order._id, userId, session);
    order.glasses.frame.costPrice = frame.pricing.costPrice;  // Price capture
    order.glasses.frame.sellingPrice = frame.pricing.sellingPrice;
  }
  // Similar for optical lens and contact lenses...
}
```

### Convention Billing Support

```javascript
// Auto-calculated convention billing (glassesOrderController.js:170-237)
conventionBilling = {
  hasConvention: true,
  company: { id, name, conventionCode },
  employeeId: patient.employeeId,
  coveragePercentage: 80,  // From company config
  companyPortion: 800000,   // Auto-calculated
  patientPortion: 200000,   // Auto-calculated
  requiresApproval: true,
  autoApproved: false,     // If under threshold
  approvalStatus: 'pending'
};
```

---

## 2. SURGERY MODULE

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Invoice Payment                                    │
│  (Contains surgery items: phaco, vitrectomy, IOL implant, etc.)             │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ createSurgeryCasesIfNeeded()
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SurgeryCase                                         │
│  • status: awaiting_scheduling                                               │
│  • Links to: patient, invoice, clinic                                        │
│  • surgeryType: auto-detected from invoice item keywords                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────────┐
│                              │                                               │
▼                              ▼                                               ▼
Schedule                    Check-in                                    Surgery + Report
│                              │                                               │
├─ Date/time selection         ├─ Surgeon assignment                           ├─ Start surgery
├─ OR room assignment          ├─ Assistant surgeon (opt)                      ├─ Track times
├─ Duration estimate           ├─ Pre-op notes                                 ├─ Specimens
└─ Conflict check              └─ Clinical background review                   └─ Follow-up appt
```

### Surgery Case Status Flow

```
awaiting_scheduling ──► scheduled ──► checked_in ──► in_surgery ──► completed
         │                  │             │                             │
         │                  │             │                             ▼
         │                  │             │                     SurgeryReport
         │                  │             │                     (auto-linked)
         │                  │             │                             │
         └──────────────────┴─────────────┴──────────► cancelled        │
                                                     (with reason)       ▼
                                                                    Follow-up
                                                                    Appointment
```

### Key Integration Points

| Integration | Backend Location | Description |
|-------------|------------------|-------------|
| **Invoice Payment → Case Creation** | `invoiceController.createSurgeryCasesIfNeeded():19-80` | Auto-creates SurgeryCase when invoice with surgery items is paid |
| **Surgery Type Detection** | Keywords: `phaco, phacoémulsification, cataracte, trabéculectomie, vitrectomie, kératoplastie, implant, ivt` |
| **Scheduling** | `surgeryController.scheduleCase():133-208` | Assigns date, OR room, checks for conflicts |
| **Check-in** | `surgeryController.checkInPatient():335-373` | Assigns surgeon, loads clinical background |
| **Clinical Background** | `getClinicalBackground():379-458` | Loads consultations, exams, prescriptions, previous surgeries |
| **Start Surgery** | `startSurgery():498-517` | Transitions to `in_surgery`, records start time |
| **Surgery Report** | `createReport():687-708` | Creates SurgeryReport, links to case |
| **Report Finalization** | `finalizeReport():768-800` | Signs report, auto-creates follow-up appointment |
| **Specimen Tracking** | `addSpecimen():1086+` | Records specimens, auto-creates LabOrder for pathology |

### Auto Surgery Case Creation Logic

```javascript
// invoiceController.js:19-80
async function createSurgeryCasesIfNeeded(invoice, userId) {
  const surgeryKeywords = [
    'phaco', 'phacoémulsification', 'cataracte',
    'trabéculectomie', 'vitrectomie', 'kératoplastie',
    'implant', 'iol', 'chirurgie', 'ivt'
  ];

  for (const item of invoice.items) {
    const isSurgery =
      item.category === 'surgery' ||
      surgeryKeywords.some(kw => item.description?.toLowerCase().includes(kw));

    if (isSurgery && !item.surgeryCaseCreated) {
      // Detect eye from description (OD/OS/OU)
      const eye = detectEye(item.description);

      const surgeryCase = await SurgeryCase.create({
        patient: invoice.patient,
        clinic: invoice.clinic,
        invoice: invoice._id,
        surgeryType: matchedClinicalAct?._id,
        surgeryDescription: item.description,
        eye,
        status: 'awaiting_scheduling',
        paymentDate: new Date()
      });

      item.surgeryCaseCreated = true;
      item.surgeryCase = surgeryCase._id;
    }
  }
}
```

### Surgery Report Features

```javascript
// SurgeryReport model features
{
  // Core fields
  preOpDiagnosis, postOpDiagnosis, procedurePerformed,
  operativeFindings, intraopComplications,

  // Anesthesia
  anesthesiaType, anesthesiologist,

  // Implants/Materials
  iolUsed: { brand, model, power, serialNumber },
  implants: [{ type, manufacturer, serialNumber }],

  // Specimens
  specimensCollected: [{
    specimenType, eye, collectedAt, collectedBy,
    sentToLab, labOrder, pathologyDiagnosis
  }],

  // Follow-up
  followUpDate,  // Auto-creates appointment when finalized
  postOpInstructions
}
```

---

## Screenshots Captured

### Optical Module
| Screenshot | Description |
|------------|-------------|
| `01_glasses_orders_list.png` | Commandes de Lunettes - 4 status cards, QC tabs |
| `02_optical_shop_dashboard.png` | Boutique Optique dashboard |
| `03_frame_inventory.png` | Inventaire Montures |
| `04_optical_lens_inventory.png` | Inventaire Verres Optiques |
| `05_contact_lens_inventory.png` | Inventaire Lentilles de Contact |

### Surgery Module
| Screenshot | Description |
|------------|-------------|
| `10_surgery_dashboard.png` | Module Chirurgie - 5 status cards, agenda |
| `11_surgery_queue.png` | File d'attente (awaiting scheduling) |
| `12_surgery_agenda.png` | Agenda opératoire (OR calendar) |

---

## Integration Status Summary

### Optical Module ✅ FULLY INTEGRATED

| Flow | Status |
|------|--------|
| Consultation → Prescription → Glasses Order | ✅ |
| Order confirmation → Inventory reservation | ✅ |
| QC workflow (qc-passed/qc-failed) | ✅ |
| Delivery → Stock dispense (FIFO) | ✅ |
| Order → Invoice with convention billing | ✅ |
| Price capture at order time | ✅ |

### Surgery Module ✅ FULLY INTEGRATED

| Flow | Status |
|------|--------|
| Invoice payment → Auto surgery case creation | ✅ |
| Surgery type auto-detection (keywords) | ✅ |
| Scheduling with OR room conflict check | ✅ |
| Check-in with surgeon assignment | ✅ |
| Clinical background for surgeon review | ✅ |
| Surgery report with specimens | ✅ |
| Report finalization → Follow-up appointment | ✅ |
| Specimen → Lab order integration | ✅ |

---

## Conclusion

Both the **Optical** and **Surgery** modules are **fully integrated** with the rest of the MedFlow system:

1. **Optical Orders** flow seamlessly from consultation prescriptions through inventory management to invoicing with convention support.

2. **Surgery Cases** are automatically created when surgery invoices are paid, with a complete workflow from scheduling through report finalization.

3. **Stock management** is integrated with FIFO/FEFO dispensing and reservation systems.

4. **Billing integration** supports both patient and convention (company) billing with auto-calculated portions.
