# Unified Visit Invoice Billing System

## Overview

Single invoice per visit with category-based permissions. Items added progressively as services are ordered. Each department sees and manages only their category items. Multiple payment collection points.

## Core Requirements

1. **ONE invoice per visit** - Created at visit start (draft), items added as services ordered
2. **Category-based visibility** - Each role sees only relevant categories
3. **External tracking** - Mark items as "external" when patient gets service elsewhere (pharmacy, optical)
4. **Decentralized payment** - Three collection points: Pharmacy, Optical, Clinic receptionist

## Invoice Item Structure

```javascript
{
  category: 'consultation' | 'medication' | 'laboratory' | 'imaging' | 'surgery' | 'optical' | 'examination',
  description: String,
  code: String,
  quantity: Number,
  unitPrice: Number,
  total: Number,

  // Status tracking
  status: 'pending' | 'completed' | 'external' | 'cancelled',
  completedAt: Date,
  completedBy: ObjectId,

  // Payment tracking (per-item)
  paidAmount: Number,
  isPaid: Boolean,
  paidAt: Date,
  paidTo: 'pharmacy' | 'optical' | 'clinic',
  paymentCollectedBy: ObjectId,

  // Traceability
  addedBy: ObjectId,
  addedAt: Date,
  reference: String  // 'Prescription:xxx', 'LabOrder:xxx', etc.
}
```

## Category Permission Matrix

| Category | Can View | Can Complete/Dispense | Can Collect Payment | Can Mark External |
|----------|----------|----------------------|---------------------|-------------------|
| consultation | doctor, receptionist, cashier, admin | doctor | receptionist, cashier | - |
| medication | pharmacist, pharmacy_receptionist, doctor, cashier, admin | pharmacist | pharmacy_receptionist, cashier | pharmacist, pharmacy_receptionist |
| laboratory | lab_technician, doctor, cashier, admin | lab_technician | receptionist, cashier | - |
| imaging | imaging_tech, radiologist, doctor, cashier, admin | imaging_tech | receptionist, cashier | - |
| surgery | surgeon, doctor, cashier, admin | surgeon | receptionist, cashier | - |
| optical | optician, optical_receptionist, optometrist, doctor, cashier, admin | optician | optical_receptionist, cashier | optician, optical_receptionist |
| examination | orthoptist, technician, doctor, cashier, admin | orthoptist, technician | receptionist, cashier | - |

## Payment Collection Points

| Collection Point | Categories | Location |
|-----------------|------------|----------|
| Pharmacy Receptionist | medication | Pharmacy counter |
| Optical Receptionist | optical, frames, lenses | Optical shop |
| Clinic Receptionist | consultation, surgery, laboratory, imaging, examination | Main reception |

## Workflow

### 1. Visit Creation
- Receptionist creates appointment
- Visit record created
- Invoice created (status: draft, items: empty)

### 2. Consultation
- Doctor examines patient, orders services
- Each order automatically adds item to visit invoice:
  - Prescription → medication items added
  - Lab order → laboratory items added
  - Imaging order → imaging items added
  - Procedure → surgery/examination items added
  - Glasses prescription → optical items added

### 3. Service Completion (each department)
- Staff sees ONLY their category items
- Marks items as completed when service rendered
- OR marks as "external" if patient getting elsewhere

### 4. Payment Collection (decentralized)
- Pharmacy receptionist: Collects for medication items
- Optical receptionist: Collects for optical items
- Clinic receptionist: Collects for all other items

### 5. Invoice Finalization
- Invoice status = 'paid' when all non-external items paid
- Invoice status = 'partial' when some items paid
- Invoice status = 'pending' when no items paid

## API Endpoints

### Invoice Item Management
```
GET    /api/invoices/:id/items?category=medication   # Filtered by category + permission
POST   /api/invoices/:id/items                       # Add item (checks category permission)
PATCH  /api/invoices/:id/items/:itemId/status        # Update status (complete/external)
POST   /api/invoices/:id/items/:itemId/payment       # Record payment for item
```

### Category-Filtered Views
```
GET /api/invoices/pharmacy/:visitId     # Pharmacy view (medication only)
GET /api/invoices/optical/:visitId      # Optical view (optical only)
GET /api/invoices/clinic/:visitId       # Clinic view (all categories)
```

## Database Changes

### Invoice Model Updates
- Add `paidTo` field to track which department collected
- Add `paymentCollectedBy` to track who collected
- Add `completedBy`, `completedAt` for service completion tracking
- Update `status` enum to include 'external'

### Role Permissions Updates
- Add category-specific permissions:
  - `invoice.view.medication`
  - `invoice.dispense.medication`
  - `invoice.payment.medication`
  - `invoice.external.medication`
  - (similar for each category)

## UI Components

### Pharmacy Invoice View
- Shows ONLY medication items for current visit
- Actions: Dispense, Mark External, Collect Payment
- Cannot see lab, consultation, optical items

### Optical Invoice View
- Shows ONLY optical items for current visit
- Actions: Complete, Mark External, Collect Payment
- Cannot see pharmacy, lab items

### Clinic Invoice View (Receptionist/Cashier)
- Shows ALL items grouped by category
- Can collect payment for consultation, lab, surgery, imaging, examination
- Can see pharmacy/optical items but marked as "paid at pharmacy/optical"

## Migration Steps

1. Update Invoice model with new fields
2. Add category permissions to RolePermission
3. Update generateInvoice to add all items at once
4. Create category-filtered API endpoints
5. Update pharmacy UI to use invoice items instead of separate billing
6. Update optical UI similarly
7. Update cashier UI to show unified view
