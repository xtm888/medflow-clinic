# MedFlow Comprehensive UI Component Map

**Generated:** December 16, 2025
**Total Screenshots:** 600+ screenshots across 15+ categories
**Total Pages Documented:** 30 main pages
**Total UI Elements Mapped:** 376 interactive elements
**Test Coverage:** 99% pass rate (677/684 tests)

---

## Table of Contents

1. [Application Architecture Overview](#application-architecture-overview)
2. [Navigation Structure](#navigation-structure)
3. [Page Catalog](#page-catalog)
4. [Module Breakdown](#module-breakdown)
5. [Responsive Breakpoints](#responsive-breakpoints)
6. [Modal & Form Reference](#modal--form-reference)
7. [Screenshot Directory Reference](#screenshot-directory-reference)

---

## Application Architecture Overview

MedFlow is a comprehensive ophthalmology clinic management system with the following main modules:

### Module Categories

| Category | Modules | Description |
|----------|---------|-------------|
| **Accueil (Reception)** | 7 modules | Dashboard, Patients, Queue, Appointments, Notifications, Settings, Audit |
| **Clinique (Clinical)** | 11 modules | Ophthalmology, Orthoptics, IVT, Surgery, Laboratory, Imaging, Pharmacy, Prescriptions |
| **Postes de Travail (Workstations)** | 7 modules | Specialized role-based views |
| **Optique & Vente (Optical & Sales)** | 5 modules | Optical Shop, Glasses Orders, Frame Inventory, Contact Lenses |
| **Finances** | Multiple | Invoicing, Financial Reports, Conventions, Approvals, Services |
| **Inventaire (Inventory)** | 7+ types | Pharmacy, Frames, Lenses, Reagents, Lab Consumables, Contact Lenses, Surgical Supplies |

---

## Navigation Structure

### Global Header Bar Components

Every page includes these persistent elements:

| Component | Function | Screenshot Reference |
|-----------|----------|---------------------|
| **Clinic Selector** | Switch between clinics (All Clinics, Centre Ophtalmologique Matadi, etc.) | `Dashboard_button_All_Clinics.jpg` |
| **Sync Status** | Shows "Synchronisé" (synced) or pending status | `Dashboard_button_Synchronisé.jpg` |
| **Online Status** | Shows "En ligne" (online) connectivity | `Dashboard_button_En_ligne.jpg` |
| **Module Buttons** | Clinique, Finances, Inventaire quick access | `Dashboard_button_Clinique.jpg` |
| **Home Button** | Return to main menu | `Dashboard_button_Accueil.jpg` |

### Sidebar Navigation Links

| Link | Route | Icon |
|------|-------|------|
| Tableau de bord | `/dashboard` | Dashboard icon |
| Patients | `/patients` | Person icon |
| File d'attente | `/queue` | Queue icon |
| Rendez-vous | `/appointments` | Calendar icon |
| Ordonnances | `/prescriptions` | Prescription icon |
| Laboratoire | `/laboratory` | Lab icon |
| Imagerie | `/imaging` | Image icon |
| Pharmacie | `/pharmacy` | Pharmacy icon |
| Ophtalmologie | `/ophthalmology` | Eye icon |
| Orthoptie | `/orthoptics` | Orthoptic icon |
| IVT | `/ivt` | Injection icon |
| Chirurgie | `/surgery` | Surgery icon |
| Boutique Optique | `/optical-shop` | Shop icon |
| Appareils | `/devices` | Device icon |
| Notifications | `/notifications` | Bell icon |
| Paramètres | `/settings` | Gear icon |
| Journal d'audit | `/audit` | Log icon |
| Documents | `/documents` | Document icon |

---

## Page Catalog

### 1. Home (`/home`)
**Main Screenshot:** `0001_Home_view.jpg`
**Screenshot Location:** `screenshots/complete_ui/`

#### Elements
| Element | Type | Action | Screenshot |
|---------|------|--------|------------|
| Accueil (7 modules) | Button | State change | `0002_Home_button_Accueil_7_modules.jpg` |
| Clinique (11 modules) | Button | Navigate | `0003_Home_button_11_Clinique_11_modules.jpg` |
| Postes de Travail (7 modules) | Button | State change | `0004_Home_button_Postes_de_Travail_7_mod.jpg` |
| Optique & Vente (5 modules) | Button | Navigate | `0005_Home_button_Optique___Vente_5_modul.jpg` |

---

### 2. Dashboard (`/dashboard`)
**Main Screenshot:** `0006_Dashboard_view.jpg`
**Full Page Screenshot:** `complete/home/home_dashboard.png`

#### Components
- **Stats Cards:** 12 cards showing key metrics
- **Quick Actions:** Common tasks shortcuts
- **Alerts Section:** System notifications and warnings
- **Activity Feed:** Recent actions (expandable to 10 items)

#### Elements (19 total)
| Element | Type | Action |
|---------|------|--------|
| Clinique | Button | Toggle clinical view |
| Finances | Button | Toggle financial view |
| Inventaire | Button | Toggle inventory view |
| All Clinics | Button | Clinic selector |
| Actualiser | Button | Refresh data |
| Voir toutes les actions | Button | Expand activity feed |

---

### 3. Patients (`/patients`)
**Main Screenshot:** `0026_Patients_view.jpg`
**Full Page Screenshot:** `complete/patients/patients_list.png`

#### Components
- Search input with type filter (Name, ID, Phone)
- Patient table/list with sorting options
- New patient button (opens wizard)
- Selection mode toggle
- Filters panel

#### UI Tests Passed: 7/7
- Page title present
- Search input present
- Search type filter present
- New patient button present
- Filters button present
- Patient table/list present
- Sort options present

---

### 4. Patient Wizard (Modal)
**Screenshots:** `complete/patient_wizard/`

#### Steps
| Step | Name | Screenshot | Components |
|------|------|------------|------------|
| 1 | Photo | `step_1_photo.png` | Photo capture/upload, webcam integration |
| 2 | Personnel | `step_2_personnel.png` | Name, DOB, gender, ID fields |
| 3 | Contact | `step_3_contact.png` | Address, phone, email, emergency contact |
| 4 | Convention | `step_4_convention.png` | Insurance/convention selection |
| 5 | Médical | `step_5_médical.png` | Medical history, allergies |

---

### 5. Queue (`/queue`)
**Main Screenshot:** `0037_Queue_view.jpg`
**Full Page Screenshot:** `complete/queue/queue.png`

#### Components
- Real-time queue display
- Sort options (arrival time, priority)
- Check-in button ("Enregistrer arrivée")
- Call next patient button
- Queue statistics panel
- Analytics view available

#### Elements
| Element | Function |
|---------|----------|
| Enregistrer arrivée | Open check-in modal |
| Sort dropdown | Change queue order |
| Patient cards | Show status, wait time |

---

### 6. Appointments (`/appointments`)
**Main Screenshot:** `0047_Appointments_view.jpg`
**Full Page Screenshot:** `complete/appointments/appointments.png`

#### Components
- Calendar view (day/week/month)
- List view toggle
- Date navigation controls
- Status filter (All, Confirmed, Pending, Cancelled)
- New appointment button
- Provider availability management

#### Modal: Appointment Booking
**Screenshot:** `complete/modals/appointment_modal.png`
- Patient search/selection
- Date/time picker
- Appointment type selector
- Provider selection
- Notes field

---

### 7. Ophthalmology Dashboard (`/ophthalmology`)
**Main Screenshot:** `0057_Ophthalmology_view.jpg`
**Full Page Screenshot:** `complete/ophthalmology/ophthalmology.png`

#### Action Cards
| Card | Function | Screenshot |
|------|----------|------------|
| Consultation (Nouvelle visite) | Start new consultation | `0065_Ophthalmology_button_Consultation_N.jpg` |
| File d'Attente (X patients) | View ophthalmology queue | `0066_Ophthalmology_button_File_d_Attente.jpg` |
| Réfraction (Examen rapide) | Quick refraction exam | `0067_Ophthalmology_button_Réfraction_Exa.jpg` |

#### Sub-pages
- `/ophthalmology/new` - New consultation wizard
- `/ophthalmology/queue` - Ophthalmology-specific queue

---

### 8. New Consultation (`/ophthalmology/new`)
**Main Screenshot:** `0068_OphthalmologyConsultation_view.jpg`
**Full Page Screenshot:** `complete/ophthalmology/ophthalmology_consultation.png`

#### Consultation Steps
1. Patient Selection
2. Medical History Review
3. Visual Acuity
4. Refraction
5. Anterior Segment
6. Posterior Segment
7. Tonometry
8. Diagnosis
9. Prescription
10. Summary

---

### 9. Prescriptions (`/prescriptions`)
**Main Screenshot:** `0071_Prescriptions_view.jpg`
**Full Page Screenshot:** `complete/prescriptions/prescriptions.png`

#### Filter Tabs (Prior Authorization Status)
| Tab | Description | Screenshot |
|-----|-------------|------------|
| Toutes | All prescriptions | `0081_Prescriptions_button_Toutes.jpg` |
| Sans PA | Without prior auth | `0082_Prescriptions_button_Sans_PA.jpg` |
| PA En cours | PA pending | `0083_Prescriptions_button_PA_En_cours.jpg` |
| PA Approuvées | PA approved | `0084_Prescriptions_button_PA_Approuvées.jpg` |
| PA Refusées | PA rejected | `0085_Prescriptions_button_PA_Refusées.jpg` |

---

### 10. Surgery Dashboard (`/surgery`)
**Main Screenshot:** `0103_Surgery_view.jpg`
**Full Page Screenshot:** `complete/surgery/surgery_dashboard.png`

#### Components
- Surgery case list with status filter
- Surgeon view toggle
- New case button
- Queue indicator
- Planning sub-page (`/surgery/planning`)

---

### 11. Laboratory (`/laboratory`)
**Main Screenshot:** `0133_Laboratory_view.jpg`
**Full Page Screenshot:** `complete/laboratory/laboratory.png`

#### Tabs
| Tab | Route | Description |
|-----|-------|-------------|
| Main Dashboard | `/laboratory` | Overview with pending/results counts |
| Pending Orders | `/laboratory/pending` | Orders awaiting processing |
| Results | `/laboratory/results` | Completed test results |
| Check-in | `/laboratory/checkin` | Sample check-in |
| Configuration | `/laboratory/config` | Test templates, reference ranges |
| Worklist | `/laboratory/worklist` | Technician worklist |

---

### 12. Pharmacy Dashboard (`/pharmacy`)
**Main Screenshot:** `0222_Pharmacy_view.jpg`
**Full Page Screenshot:** `complete/pharmacy/pharmacy_dashboard.png`

#### Inventory Stats
| Stat | Description |
|------|-------------|
| Stock Faible | Low stock alerts |
| Expire Bientôt | Expiring soon items |
| Inventaire Complet | Total inventory count (635 articles) |

#### Elements
- Add medication button
- Category filter
- Search input
- Inventory table with row actions

---

### 13. Invoicing (`/invoicing`)
**Main Screenshot:** `0168_Invoicing_view.jpg`
**Full Page Screenshot:** `complete/financial/invoicing.png`

#### Category Tabs
- All invoices
- Patient invoices
- Convention invoices
- Pharmacy invoices

#### Status Filters
- All, Paid, Pending, Overdue, Cancelled

#### Actions
- New invoice button
- View details
- Print
- Record payment

---

### 14. Financial Reports (`/reports/financial`)
**Main Screenshot:** `0181_FinancialReports_view.jpg`
**Full Page Screenshot:** `complete/financial/financial.png`

#### Components
- Revenue summary cards
- Date range selector
- Export functionality
- Charts and graphs

---

### 15. Companies/Conventions (`/companies`)
**Main Screenshot:** `0287_Companies_view.jpg`
**Full Page Screenshot:** `complete/companies/companies.png`

#### Views
| View | Description |
|------|-------------|
| Hiérarchie | Hierarchical tree view |
| Liste | Flat list view |

#### Elements
- New company button
- Filters panel
- Company cards with actions

---

### 16. Approvals (`/approvals`)
**Main Screenshot:** `0187_Approvals_view.jpg`
**Full Page Screenshot:** `complete/companies/approvals.png`

#### Components
- Status filter (Pending, Approved, Rejected)
- New request button
- Approval queue
- Filter panel

---

### 17. Optical Shop (`/optical-shop`)
**Main Screenshot:** `0271_OpticalShop_view.jpg`
**Full Page Screenshot:** `complete/optical_shop/optical_shop_dashboard.png`

#### Sub-sections
| Section | Route | Screenshot |
|---------|-------|------------|
| Verification | `/optical-shop/verification` | `optical_shop_verification.png` |
| External Orders | `/optical-shop/external` | `optical_shop_external.png` |
| Performance | `/optical-shop/performance` | `optical_shop_performance.png` |
| All Orders | `/glasses-orders` | `glasses_orders.png` |

---

### 18. Frame Inventory (`/inventory/frames`)
**Screenshot:** `complete/optical_inventory/frame_inventory.png`

#### Components
- Add frame button
- Search and filters
- Brand/model filter
- Stock levels display

---

### 19. Contact Lens Inventory (`/inventory/contact-lenses`)
**Screenshot:** `complete/optical_inventory/contact_lens_inventory.png`

---

### 20. Optical Lens Inventory (`/inventory/optical-lenses`)
**Screenshot:** `complete/optical_inventory/optical_lens_inventory.png`

---

### 21. Reagent Inventory (`/inventory/reagents`)
**Screenshot:** `complete/lab_inventory/reagent_inventory.png`

---

### 22. Lab Consumable Inventory (`/inventory/lab-consumables`)
**Screenshot:** `complete/lab_inventory/lab_consumable_inventory.png`

---

### 23. Devices (`/devices`)
**Screenshot:** `complete/devices/devices_list.png`

#### Sub-pages
| Page | Route | Screenshot |
|------|-------|------------|
| Device List | `/devices` | `devices_list.png` |
| Discovery | `/devices/discovery` | `devices_discovery.png` |
| Status | `/devices/status` | `devices_status.png` |

---

### 24. Settings (`/settings`)
**Main Screenshot:** `0317_Settings_view.jpg`
**Full Page Screenshot:** `complete/admin/settings.png`

#### Tabs
| Tab | Description |
|-----|-------------|
| Profil | User profile settings |
| Notifications | Notification preferences |
| Calendrier | Calendar integration |
| Sécurité | Security settings |
| Facturation | Billing defaults |
| Tarifs | Price schedules |

---

### 25. User Management (`/users`)
**Screenshot:** `complete/admin/user_management.png`

#### Components
- User list with roles
- Add user button
- Role assignment
- Permission management

---

### 26. Audit Trail (`/audit`)
**Main Screenshot:** `0341_AuditLog_view.jpg`
**Full Page Screenshot:** `complete/admin/audit_trail.png`

#### Filter Categories
| Filter | Description |
|--------|-------------|
| Tous les événements | All events |
| Activités suspectes | Suspicious activity |
| Sécurité | Security events |
| Accès Patients | Patient access logs |
| Rapports Conformité | Compliance reports |
| Modifications | Data modifications |
| Opérations Critiques | Critical operations |

---

### 27. Analytics (`/analytics`)
**Main Screenshot:** `0388_Analytics_view.jpg`
**Full Page Screenshot:** `complete/analytics/analytics_dashboard.png`

#### Components
- KPI charts
- Date range selector
- Export functionality
- Multiple visualization types

---

### 28. Templates (`/templates`)
**Screenshot:** `complete/analytics/templates.png`

#### Template Types
- Consultation templates
- Letter templates
- Laboratory report templates
- Document templates

---

### 29. Notifications (`/notifications`)
**Main Screenshot:** `0370_Notifications_view.jpg`
**Full Page Screenshot:** `complete/notifications/notifications.png`

---

### 30. Documents (`/documents`)
**Main Screenshot:** `0331_Documents_view.jpg`
**Full Page Screenshot:** `complete/documents/document_generation.png`

---

## Module Breakdown

### Clinical Modules

| Module | Route | Key Features |
|--------|-------|--------------|
| Ophthalmology | `/ophthalmology` | Consultations, exams, refraction |
| Orthoptics | `/orthoptics` | Orthoptic exams, new exam wizard |
| IVT | `/ivt` | Injection tracking, due dates, vial management |
| Surgery | `/surgery` | Case planning, OR scheduling |
| Laboratory | `/laboratory` | Order management, results, QC |
| Imaging | `/imaging` | Device images, DICOM viewer |
| Pharmacy | `/pharmacy` | Inventory, dispensing |

### Financial Modules

| Module | Route | Key Features |
|--------|-------|--------------|
| Invoicing | `/invoicing` | Invoice creation, payments |
| Financial Reports | `/reports/financial` | Revenue analysis |
| Conventions | `/conventions` | Insurance contracts |
| Approvals | `/approvals` | Prior authorization workflow |
| Services | `/services` | Fee schedules |

### Inventory Modules

| Module | Route | Key Features |
|--------|-------|--------------|
| Pharmacy | `/pharmacy/inventory` | Medications, stock alerts |
| Frames | `/inventory/frames` | Eyeglass frames |
| Optical Lenses | `/inventory/optical-lenses` | Prescription lenses |
| Contact Lenses | `/inventory/contact-lenses` | Contact lens stock |
| Reagents | `/inventory/reagents` | Lab reagents |
| Lab Consumables | `/inventory/lab-consumables` | Lab supplies |
| Surgical Supplies | `/inventory/surgical` | OR supplies |

---

## Responsive Breakpoints

### Tested Viewports

| Breakpoint | Resolution | Device Type | Screenshot Location |
|------------|------------|-------------|---------------------|
| Desktop Full | 1920x1080 | Large monitor | `responsive/desktop_full/` |
| Desktop Standard | 1366x768 | Standard laptop | `responsive/desktop_standard/` |
| Laptop | 1024x768 | Small laptop | `responsive/laptop/` |
| Tablet Landscape | 1024x768 | iPad landscape | `responsive/tablet_landscape/` |
| Tablet Portrait | 768x1024 | iPad portrait | `responsive/tablet_portrait/` |
| Mobile Large | 414x896 | iPhone Plus | `responsive/mobile_large/` |
| Mobile Medium | 390x844 | iPhone 12/13 | `responsive/mobile_medium/` |
| Mobile Small | 375x667 | iPhone 8 | `responsive/mobile_small/` |

### Pages Tested at Each Breakpoint
- Home/Dashboard
- Patients
- Queue
- Appointments
- Invoicing
- Pharmacy

**All 6 responsive tests passed (100%)**

---

## Modal & Form Reference

### Primary Modals

| Modal | Trigger | Screenshot |
|-------|---------|------------|
| Patient Wizard | New Patient button | `complete/modals/patient_wizard.png` |
| Appointment Booking | New Appointment button | `complete/modals/appointment_modal.png` |
| Invoice Creation | New Invoice button | `complete/modals/invoice_modal.png` |
| Queue Check-in | Check-in button | `complete/modals/queue_checkin_modal.png` |
| Add Medication | Add Medication button | `complete/modals/pharmacy_add_modal.png` |

### Form Validation
All forms include:
- Required field indicators
- Real-time validation feedback
- Error messages in French
- Success confirmations

---

## Screenshot Directory Reference

### Directory Structure

```
tests/playwright/screenshots/
├── admin/                      # Administrative pages
│   ├── analytics.png
│   ├── audit.png
│   ├── backups.png
│   ├── settings.png
│   ├── templates.png
│   └── users.png
├── clinical/                   # Clinical module pages
│   ├── ivt.png
│   ├── laboratory.png
│   ├── ophthalmology.png
│   ├── orthoptic.png
│   ├── pharmacy.png
│   └── surgery.png
├── coherence/                  # Workflow coherence tests
│   ├── appointment_calendar.png
│   ├── appointment_modal.png
│   ├── device_status.png
│   ├── financial_dashboard.png
│   ├── form_validation.png
│   ├── home_dashboard_modules.png
│   ├── invoicing_tabs.png
│   ├── laboratory_workflow.png
│   ├── ophthalmology_consultation.png
│   ├── patient_count_check.png
│   ├── patient_detail.png
│   ├── patient_search_test.png
│   ├── pharmacy_inventory.png
│   ├── pharmacy_low_stock.png
│   ├── prescription_queue.png
│   └── queue_display.png
├── complete/                   # Complete page captures
│   ├── admin/
│   ├── analytics/
│   ├── appointments/
│   ├── companies/
│   ├── cross_clinic/
│   ├── devices/
│   ├── documents/
│   ├── external/
│   ├── financial/
│   ├── glasses/
│   ├── home/
│   ├── imaging/
│   ├── ivt/
│   ├── lab_inventory/
│   ├── laboratory/
│   ├── modals/
│   ├── navigation/
│   ├── notifications/
│   ├── nursing/
│   ├── ocr/
│   ├── ophthalmology/
│   ├── optical_inventory/
│   ├── optical_shop/
│   ├── orthoptic/
│   ├── patient_wizard/
│   ├── patients/
│   ├── pharmacy/
│   ├── prescriptions/
│   ├── procurement/
│   ├── public/
│   ├── queue/
│   ├── responsive/
│   ├── surgery/
│   └── visits/
├── complete_ui/                # Element-level screenshots (406 files)
│   ├── 0001_Home_view.jpg
│   ├── 0002_Home_button_Accueil_7_modules.jpg
│   └── ... (404 more)
├── comprehensive/              # Comprehensive test screenshots
├── cross_clinic/               # Multi-clinic feature screenshots
├── deep_explore/               # Deep exploration screenshots
├── diagnostics/                # Diagnostic test screenshots
├── documents/                  # Document generation screenshots
├── forms/                      # Form interaction screenshots
├── functional/                 # Functional test screenshots
├── interactions/               # UI interaction screenshots
├── inventory/                  # Inventory module screenshots
├── ivt/                        # IVT workflow screenshots
├── multi_clinic/               # Multi-clinic screenshots
├── patient_detail/             # Patient detail page screenshots
├── patient_journey/            # Full patient journey screenshots
├── role_access/                # Role-based access screenshots
├── surgery/                    # Surgery workflow screenshots
├── verified/                   # Verified/validated screenshots
├── workflows/                  # Workflow test screenshots
└── worklists/                  # Role-specific worklist screenshots
```

### Screenshot Counts by Category

| Category | Count | Description |
|----------|-------|-------------|
| complete_ui | 406 | Element-level interaction captures |
| complete | 200+ | Full page captures with viewport variants |
| comprehensive | 50+ | Comprehensive test screenshots |
| responsive | 56 | Responsive design tests (8 breakpoints × 7 pages) |
| workflows | 30+ | Workflow test screenshots |
| role_access | 20+ | Role-based access tests |
| inventory | 8 | Inventory module screenshots |
| cross_clinic | 7 | Multi-clinic feature screenshots |

---

## Test Coverage Summary

### Overall Results
- **Total Test Suites:** 23
- **Total Tests:** 684
- **Passed:** 677
- **Pass Rate:** 99.0%

### Test Suite Breakdown

| Suite | Passed | Total | Rate |
|-------|--------|-------|------|
| Billing Calculations | 12 | 12 | 100% |
| Coherence | 62 | 62 | 100% |
| Cross Clinic Extended | 27 | 27 | 100% |
| Device Import | 10 | 10 | 100% |
| Device Integration | 16 | 16 | 100% |
| Document Generation | 7 | 7 | 100% |
| Document Management | 22 | 22 | 100% |
| Form Submission | 12 | 12 | 100% |
| Full Patient Journey | 30 | 30 | 100% |
| Interaction Test | 14 | 14 | 100% |
| Inventory Extended | 34 | 34 | 100% |
| IVT Workflow | 25 | 25 | 100% |
| Laboratory Workflow | 8 | 8 | 100% |
| Multi Clinic | 8 | 8 | 100% |
| Patient Detail | 23 | 23 | 100% |
| Payment Processing | 10 | 10 | 100% |
| Role Access | 82 | 82 | 100% |
| Role Worklists | 27 | 27 | 100% |
| Surgery Workflow | 23 | 23 | 100% |
| Visual Verification | 14 | 14 | 100% |
| Workflow Test | 18 | 18 | 100% |
| Comprehensive Test | 129 | 133 | 97% |
| Complete Workflow Coverage | 64 | 67 | 95.5% |

### Keyboard Shortcuts Tested
| Shortcut | Action | Status |
|----------|--------|--------|
| `/` | Focus search (on Patients page) | Passed |
| `?` | Show shortcuts help | Passed |

---

## Quick Reference: Common Routes

```
/home                    - Main home/module selection
/dashboard               - Operational dashboard
/patients                - Patient list
/patients/new            - New patient wizard
/patients/:id            - Patient detail
/queue                   - Queue management
/appointments            - Appointment calendar
/ophthalmology           - Ophthalmology dashboard
/ophthalmology/new       - New consultation
/prescriptions           - Prescription list
/surgery                 - Surgery dashboard
/surgery/planning        - Surgery planning
/laboratory              - Laboratory dashboard
/pharmacy                - Pharmacy dashboard
/invoicing               - Invoice list
/reports/financial       - Financial reports
/companies               - Companies/Conventions
/approvals               - Prior authorization
/optical-shop            - Optical shop dashboard
/glasses-orders          - Glasses orders list
/devices                 - Device management
/devices/discovery       - Network discovery
/settings                - User settings
/users                   - User management
/audit                   - Audit trail
/analytics               - Analytics dashboard
/templates               - Template management
/notifications           - Notifications
/documents               - Document generation
/display-board           - Public queue display
/book                    - Public booking page
```

---

## JSON Report Files

For programmatic access, refer to these JSON files:

| File | Description |
|------|-------------|
| `complete_ui_map.json` | Full UI element map with screenshots |
| `comprehensive_report.json` | Comprehensive test results |
| `FINAL_TEST_SUMMARY.json` | Final test summary |
| `coherence_report.json` | Workflow coherence tests |
| `e2e_journey_report.json` | End-to-end journey tests |
| `deep_ui_map.json` | Deep UI exploration map |

---

*This document was auto-generated from E2E test results and screenshot analysis.*
