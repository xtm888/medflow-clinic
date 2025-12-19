# MedFlow Comprehensive Test Plan - Missing Workflows

**Created:** December 16, 2025
**Status:** IN PROGRESS
**Target:** 95%+ test coverage

---

## Executive Summary

This plan covers all untested workflows identified in the gap analysis. Testing will be executed in priority order, with screenshots captured for documentation.

---

## PHASE 1: Role-Based Access Testing (CRITICAL)

### 1.1 Test Users to Create/Use
| Role | Username | Password | Expected Access |
|------|----------|----------|-----------------|
| Admin | admin | TestPass123!@# | Full access |
| Doctor | doctor | TestPass123!@# | Clinical + limited admin |
| Nurse | nurse | TestPass123!@# | Vitals, queue, limited clinical |
| Receptionist | receptionist | TestPass123!@# | Queue, appointments, billing |
| Lab Technician | labtech | TestPass123!@# | Laboratory only |
| Pharmacist | pharmacist | TestPass123!@# | Pharmacy only |
| Optician | optician | TestPass123!@# | Optical shop, glasses orders |

### 1.2 Tests per Role
For each role, verify:
- [ ] Login successful
- [ ] Dashboard shows role-appropriate widgets
- [ ] Sidebar shows only permitted menu items
- [ ] Protected pages redirect/show error
- [ ] Actions within permitted pages work
- [ ] Screenshot each role's dashboard

### 1.3 Permission Boundaries to Test
| Feature | Admin | Doctor | Nurse | Receptionist | Lab Tech | Pharmacist | Optician |
|---------|-------|--------|-------|--------------|----------|------------|----------|
| User Management | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Settings | ✓ | Limited | ✗ | ✗ | ✗ | ✗ | ✗ |
| Patient Create | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Consultation | ✓ | ✓ | View | ✗ | ✗ | ✗ | ✗ |
| Prescribe | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Lab Orders | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Dispense Meds | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Invoicing | ✓ | View | ✗ | ✓ | ✗ | ✗ | ✗ |
| Audit Trail | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## PHASE 2: PDF Document Generation Testing

### 2.1 Prescription PDF
- [ ] Navigate to existing prescription
- [ ] Click "Imprimer" button
- [ ] Verify PDF opens/downloads
- [ ] Screenshot the print preview
- [ ] Check PDF contains: patient info, medications, dosage, doctor signature

### 2.2 Invoice PDF
- [ ] Navigate to existing invoice
- [ ] Click "Imprimer" button
- [ ] Verify PDF opens/downloads
- [ ] Screenshot the print preview
- [ ] Check PDF contains: patient info, line items, totals, convention info

### 2.3 Medical Report PDF
- [ ] Navigate to patient detail
- [ ] Click "Fiche d'Examen" button
- [ ] Verify PDF generates
- [ ] Screenshot the output

### 2.4 Certificate PDF
- [ ] Navigate to patient detail
- [ ] Click "Certificat Médical" button
- [ ] Verify certificate generates
- [ ] Screenshot the output

### 2.5 Glasses Prescription PDF
- [ ] Navigate to glasses order
- [ ] Click "Ordonnance Lunettes" button
- [ ] Verify PDF generates
- [ ] Screenshot the output

---

## PHASE 3: Device Data Import Testing

### 3.1 Device Discovery
- [ ] Navigate to /devices/discovery
- [ ] Run network scan
- [ ] Screenshot discovered devices
- [ ] Verify SMB shares detected

### 3.2 Device Configuration
- [ ] Navigate to /devices
- [ ] Add new device manually
- [ ] Configure device path
- [ ] Screenshot configuration form

### 3.3 Data Import Flow
- [ ] Select device with data
- [ ] Click import/sync button
- [ ] Monitor import progress
- [ ] Screenshot import results
- [ ] Verify data appears in patient records

### 3.4 Auto-Sync Status
- [ ] Check auto-sync dashboard
- [ ] Verify folder watching status
- [ ] Screenshot sync queue

---

## PHASE 4: Surgery Complete Workflow

### 4.1 Surgery Case Creation
- [ ] Navigate to /surgery/new
- [ ] Fill all required fields
- [ ] Screenshot each step
- [ ] Submit case

### 4.2 Surgery Check-in
- [ ] Navigate to surgery case
- [ ] Click check-in button
- [ ] Complete pre-op checklist
- [ ] Screenshot check-in form

### 4.3 Surgery Report
- [ ] Complete surgery
- [ ] Generate surgery report
- [ ] Screenshot report form
- [ ] Verify PDF generation

### 4.4 Surgery to Invoice
- [ ] Verify invoice auto-created
- [ ] Check line items correct
- [ ] Screenshot cascade result

---

## PHASE 5: Glasses Order Delivery Flow

### 5.1 Order Creation
- [ ] Navigate to /glasses-orders
- [ ] Create new order
- [ ] Screenshot order form
- [ ] Submit order

### 5.2 Quality Control
- [ ] Find order in "Contrôle Qualité" tab
- [ ] Perform QC check
- [ ] Screenshot QC form
- [ ] Approve/reject

### 5.3 Ready for Pickup
- [ ] Move to "Prêts à retirer" status
- [ ] Screenshot status change

### 5.4 Delivery
- [ ] Process delivery
- [ ] Record patient signature
- [ ] Screenshot delivery form
- [ ] Verify order completed

---

## PHASE 6: Laboratory Advanced Features

### 6.1 Lab QC Management
- [ ] Navigate to lab QC section
- [ ] View QC rules
- [ ] Run QC check
- [ ] Screenshot results

### 6.2 Lab Analyzer Integration
- [ ] Check configured analyzers
- [ ] Screenshot analyzer list
- [ ] Test result import

### 6.3 Lab Worklist
- [ ] Navigate to /lab-worklist
- [ ] Screenshot technician view
- [ ] Process sample

### 6.4 Result Validation
- [ ] Find pending results
- [ ] Validate result
- [ ] Screenshot validation flow

---

## PHASE 7: Template System (Fix & Test)

### 7.1 Diagnose Template Issues
- [ ] Navigate to /templates
- [ ] Capture error screenshot
- [ ] Check console errors
- [ ] Identify root cause

### 7.2 Template List
- [ ] View template list
- [ ] Screenshot available templates

### 7.3 Template Builder
- [ ] Navigate to /templates/new
- [ ] Screenshot builder interface
- [ ] Create test template

### 7.4 Template Preview
- [ ] Preview existing template
- [ ] Screenshot preview

---

## PHASE 8: Additional Untested Features

### 8.1 Drug Safety
- [ ] Navigate to drug safety section
- [ ] Screenshot safety alerts
- [ ] Test interaction check

### 8.2 Clinical Alerts Dashboard
- [ ] Navigate to /alerts
- [ ] Screenshot alert types
- [ ] Acknowledge alert

### 8.3 Patient Portal
- [ ] Login as patient
- [ ] Screenshot patient dashboard
- [ ] Test appointment booking
- [ ] View prescriptions
- [ ] View bills

### 8.4 Calendar Integration
- [ ] Navigate to calendar settings
- [ ] Screenshot sync options
- [ ] Test calendar sync

### 8.5 Correspondence/Letters
- [ ] Navigate to correspondence
- [ ] Generate letter
- [ ] Screenshot letter form

---

## Test Execution Commands

```bash
# Run complete missing workflow tests
HEADED=1 python3 test_missing_workflows.py

# Run role-based access tests
HEADED=1 python3 test_role_access_complete.py

# Run PDF generation tests
HEADED=1 python3 test_pdf_generation.py

# Run device import tests
HEADED=1 python3 test_device_import_complete.py
```

---

## Screenshot Naming Convention

```
screenshots/missing/
├── roles/
│   ├── admin_dashboard.png
│   ├── doctor_dashboard.png
│   ├── nurse_dashboard.png
│   ├── receptionist_dashboard.png
│   ├── labtech_dashboard.png
│   ├── pharmacist_dashboard.png
│   └── optician_dashboard.png
├── pdf/
│   ├── prescription_pdf.png
│   ├── invoice_pdf.png
│   ├── medical_report_pdf.png
│   └── certificate_pdf.png
├── devices/
│   ├── discovery_scan.png
│   ├── device_config.png
│   └── import_results.png
├── surgery/
│   ├── new_case.png
│   ├── checkin.png
│   └── report.png
├── glasses/
│   ├── order_form.png
│   ├── qc_check.png
│   └── delivery.png
├── lab/
│   ├── qc_management.png
│   ├── worklist.png
│   └── validation.png
└── templates/
    ├── list.png
    ├── builder.png
    └── preview.png
```

---

## Success Criteria

| Phase | Target | Metric |
|-------|--------|--------|
| Role Access | 7 roles tested | All permission boundaries verified |
| PDF Generation | 5 document types | All PDFs render correctly |
| Device Import | 3 device types | Data imports successfully |
| Surgery | Full workflow | Case → Report → Invoice |
| Glasses | Full workflow | Order → QC → Delivery |
| Lab Advanced | 4 features | QC, worklist, validation |
| Templates | Fix + test | Pages load, builder works |

**Overall Target:** Increase coverage from 68% to 95%+

---

*Plan created: December 16, 2025*
