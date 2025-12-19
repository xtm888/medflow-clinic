# Complete E2E Test Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve comprehensive E2E test coverage for all MedFlow pages and workflows, increasing coverage from 44% to 90%+

**Architecture:** Create 8 new test files following established patterns in test_utils.py. Each file tests a specific module with UI navigation, element verification, and API validation. All tests use TestReporter for consistent reporting and screenshot capture.

**Tech Stack:** Python 3, Playwright, requests, pytest-compatible structure

---

## Task 1: Patient Detail Tests

**Files:**
- Create: `tests/playwright/test_patient_detail.py`

**Tests to implement:**
1. Patient detail page loads with patient data
2. Patient tabs (Info, History, Documents, Imaging, Visits)
3. Patient edit functionality
4. Patient history timeline
5. Patient documents list
6. Patient imaging section with device data

---

## Task 2: Surgery Workflow Tests

**Files:**
- Create: `tests/playwright/test_surgery_workflow.py`

**Tests to implement:**
1. Surgery dashboard loads with cases
2. New surgery case form
3. Surgery case detail view
4. Pre-op checklist (check-in)
5. Post-op report form
6. Surgery calendar view
7. Surgery status workflow (scheduled → checked-in → completed)

---

## Task 3: IVT Workflow Tests

**Files:**
- Create: `tests/playwright/test_ivt_workflow.py`

**Tests to implement:**
1. IVT dashboard with due injections
2. New injection form
3. Injection detail view
4. Injection edit form
5. Patient injection history
6. Cumulative dose tracking
7. Follow-up scheduling

---

## Task 4: Full Patient Journey Tests

**Files:**
- Create: `tests/playwright/test_full_patient_journey.py`

**Tests to implement:**
1. Complete patient registration flow
2. Queue check-in process
3. Consultation workflow
4. Diagnosis and prescription
5. Invoice creation from consultation
6. Payment processing
7. End-to-end journey verification

---

## Task 5: Document Management Tests

**Files:**
- Create: `tests/playwright/test_document_management.py`

**Tests to implement:**
1. Documents list page
2. Document upload (API)
3. Document viewer
4. Document templates
5. PDF generation (invoice, prescription, CERFA)
6. Document association with patients

---

## Task 6: Role-Specific Worklist Tests

**Files:**
- Create: `tests/playwright/test_role_worklists.py`

**Tests to implement:**
1. Prescription queue (pharmacist view)
2. Lab worklist (lab tech view)
3. Lab check-in page
4. Nurse vitals entry
5. Role-based access verification
6. Worklist filtering and sorting

---

## Task 7: Cross-Clinic Extended Tests

**Files:**
- Create: `tests/playwright/test_cross_clinic_extended.py`

**Tests to implement:**
1. Cross-clinic dashboard
2. Consolidated reports
3. Inventory transfer workflow
4. External facilities management
5. Dispatch dashboard
6. Multi-clinic patient access

---

## Task 8: Extended Inventory Tests

**Files:**
- Create: `tests/playwright/test_inventory_extended.py`

**Tests to implement:**
1. Contact lens inventory
2. Reagent inventory
3. Lab consumables
4. Surgical supplies
5. Procurement: purchase orders
6. Procurement: stock reconciliation
7. Low stock alerts

---

## Execution Order

1. test_patient_detail.py (HIGH - core functionality)
2. test_surgery_workflow.py (HIGH - clinical workflow)
3. test_ivt_workflow.py (HIGH - clinical workflow)
4. test_full_patient_journey.py (HIGH - E2E journey)
5. test_document_management.py (MEDIUM)
6. test_role_worklists.py (MEDIUM)
7. test_cross_clinic_extended.py (MEDIUM)
8. test_inventory_extended.py (MEDIUM)

---

*Plan created: December 15, 2025*
