# MedFlow Comprehensive E2E Test Plan

## Executive Summary

This document provides an exhaustive E2E test plan covering **all possible user interactions, edge cases, and functionality** based on analysis of:
- 42+ production screenshots
- 75+ React page components
- 78+ API routes
- All sidebar navigation items

**Test Categories**: 15 major modules with 200+ individual test cases

---

## Critical Bugs Discovered During Analysis

### BUG-001: Glasses Order Form Error
- **Location**: `/glasses-orders/new`
- **Issue**: "Erreur lors du chargement de la commande" + "Ressource demandee introuvable"
- **Severity**: HIGH - Blocks optical shop workflow
- **Screenshot**: `prod_j3_new_order_form_20251229_015352.png`

### BUG-002: User Management Not Accessible from Settings
- **Location**: Settings page sidebar
- **Issue**: `/users` route exists but no navigation link in Settings menu
- **Severity**: MEDIUM - Admin must know URL to access user management
- **Expected**: Link in Parametres > Users or dedicated sidebar item

---

## Module 1: Authentication & Session Management

### 1.1 Login Flow
| Test ID | Test Case | Steps | Expected Result | Edge Cases |
|---------|-----------|-------|-----------------|------------|
| AUTH-001 | Valid login | Enter valid credentials, click submit | Redirect to dashboard, JWT token stored | - |
| AUTH-002 | Invalid password | Enter wrong password | Error message "Identifiants invalides" | Rate limiting after 5 attempts |
| AUTH-003 | Invalid email | Enter non-existent email | Error message | - |
| AUTH-004 | Empty fields | Submit empty form | Validation errors on both fields | - |
| AUTH-005 | SQL injection attempt | Enter `' OR '1'='1` | Safely rejected, no error exposure | - |
| AUTH-006 | Remember me | Check "Se souvenir de moi" | Extended session | Token refresh behavior |
| AUTH-007 | Session timeout | Wait for token expiry | Auto-refresh or redirect to login | - |
| AUTH-008 | Concurrent sessions | Login from two browsers | Both sessions valid OR one invalidated | - |
| AUTH-009 | Logout | Click "Deconnexion" | Clear tokens, redirect to login | - |
| AUTH-010 | 2FA flow (if enabled) | Login with 2FA account | Prompt for code, verify | Invalid code, expired code, resend |

### 1.2 Password Management
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-011 | Password reset request | Click "Mot de passe oublie" | Email sent confirmation |
| AUTH-012 | Password reset with valid token | Follow reset link | Password change form |
| AUTH-013 | Password reset with expired token | Use old reset link | Error: token expired |
| AUTH-014 | Password strength validation | Enter weak password | Rejection with requirements |

---

## Module 2: Dashboard

### 2.1 Main Dashboard Widgets
| Test ID | Test Case | Expected Behavior | Data Dependencies |
|---------|-----------|-------------------|-------------------|
| DASH-001 | Patients aujourd'hui count | Shows count of today's patients | Appointments for today |
| DASH-002 | File d'attente count | Shows current queue size | Queue entries |
| DASH-003 | Revenus du jour | Shows today's revenue in CDF | Paid invoices |
| DASH-004 | Prescriptions en attente | Shows pending prescriptions | Prescription status |
| DASH-005 | Taches du jour | Lists today's tasks | Task assignments |
| DASH-006 | Patients recents | Lists recent patient visits | Visit records |
| DASH-007 | Actions en attente | Color-coded pending actions | Various pending items |
| DASH-008 | Evolution du chiffre d'affaires | Revenue trend chart | Historical financial data |
| DASH-009 | Revenus par service | Service breakdown chart | Invoice line items |
| DASH-010 | File d'attente actuelle | Real-time queue display | Queue WebSocket |
| DASH-011 | Alertes et notifications | System alerts | Alert configurations |

### 2.2 Quick Actions
| Test ID | Test Case | Action | Expected |
|---------|-----------|--------|----------|
| DASH-012 | Nouveau patient | Click button | Open patient wizard |
| DASH-013 | Prendre RDV | Click button | Open appointment form |
| DASH-014 | Prescription | Click button | Open prescription form |
| DASH-015 | Facturation | Click button | Navigate to invoicing |

---

## Module 3: Patient Management

### 3.1 Patient Registration Wizard (5 Steps)

#### Step 0: Photo Capture
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PAT-001 | Skip photo | Click "Passer" | Proceed to step 1 |
| PAT-002 | Capture photo | Click camera button | Webcam activation |
| PAT-003 | Upload photo | Click upload | File picker, JPG/PNG only, max 2MB |
| PAT-004 | Retake photo | After capture, click "Reprendre" | Reset camera |

#### Step 1: Personal Information (Informations personnelles)
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| PAT-005 | Valid data entry | Fill all required fields | Enable "Suivant" | - |
| PAT-006 | Empty required fields | Leave Prenom empty | Validation error | - |
| PAT-007 | Invalid date | Enter future birthdate | Validation error | - |
| PAT-008 | Gender selection | Click Homme/Femme | Visual selection | Neither selected |
| PAT-009 | Special characters in name | Enter "Jean-Pierre" | Accepted | Apostrophes, accents |
| PAT-010 | Very long name | Enter 100+ character name | Truncation or error | - |
| PAT-011 | Duplicate patient check | Enter existing patient name | Warning/merge option | Face recognition match |

#### Step 2: Contact Information
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| PAT-012 | Valid phone number | Enter +243XXXXXXXXX | Accepted | Various formats |
| PAT-013 | Invalid phone format | Enter letters | Validation error | - |
| PAT-014 | Address entry | Fill address fields | Accepted | Long addresses |
| PAT-015 | Emergency contact | Add emergency contact | Contact saved | Multiple contacts |

#### Step 3: Convention/Insurance
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| PAT-016 | No convention | Leave empty | Patient = self-pay | - |
| PAT-017 | Select company | Choose from dropdown | Company linked | - |
| PAT-018 | Employee number | Enter matricule | Validated if required | Duplicate matricule |
| PAT-019 | Coverage verification | System checks eligibility | Show coverage % | API timeout |

#### Step 4: Medical History
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PAT-020 | Allergies entry | Add allergy | Saved in profile |
| PAT-021 | Chronic conditions | Select conditions | Linked to patient |
| PAT-022 | Current medications | List medications | Drug interaction check |
| PAT-023 | Family history | Enter family medical history | Saved |
| PAT-024 | Complete wizard | Click "Terminer" | Patient created, redirect |

### 3.2 Patient List & Search
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PAT-025 | Search by name | Type partial name | Filtered results |
| PAT-026 | Search by phone | Type phone number | Match found |
| PAT-027 | Search by ID | Type patient ID | Exact match |
| PAT-028 | Empty search results | Search non-existent | "Aucun patient trouve" |
| PAT-029 | Pagination | Navigate pages | Correct page data |
| PAT-030 | Sort by name | Click column header | Alphabetical sort |
| PAT-031 | Filter by status | Select active/inactive | Filtered list |
| PAT-032 | Export patients | Click export | CSV/Excel download |

### 3.3 Patient Detail View
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PAT-033 | View patient details | Click patient row | Full profile display |
| PAT-034 | Edit patient | Click "Modifier" | Edit form opens |
| PAT-035 | View visit history | Check history tab | Past visits listed |
| PAT-036 | View documents | Check documents tab | Patient documents |
| PAT-037 | View invoices | Check invoices tab | Billing history |
| PAT-038 | View prescriptions | Check Rx tab | Prescription history |
| PAT-039 | Delete patient | Click delete (soft) | Patient deactivated |

---

## Module 4: Appointments (Rendez-vous)

### 4.1 Calendar Views
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| APT-001 | Day view | Click "Jour" | Single day display |
| APT-002 | Week view | Click "Semaine" | Week grid |
| APT-003 | Month view | Click "Mois" | Monthly calendar |
| APT-004 | List view | Click "Liste" | Appointment list |
| APT-005 | Navigate dates | Click arrows | Date change |
| APT-006 | Today button | Click "Aujourd'hui" | Return to current date |

### 4.2 Appointment Creation
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| APT-007 | New appointment | Click "Nouveau rendez-vous" | Form opens | - |
| APT-008 | Select patient | Search and select | Patient linked | New patient option |
| APT-009 | Select date/time | Pick from calendar | Time slot selected | Past dates blocked |
| APT-010 | Select type | Choose appointment type | Type set | Color coding |
| APT-011 | Select doctor | Choose provider | Doctor assigned | Availability check |
| APT-012 | Add notes | Enter notes | Notes saved | - |
| APT-013 | Double booking | Book same slot | Warning displayed | Override option |
| APT-014 | Outside hours | Select non-working hours | Blocked or warning | - |
| APT-015 | Recurring appointment | Set repeat | Series created | Edit single vs all |

### 4.3 Appointment Management
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| APT-016 | View appointment | Click appointment | Details modal |
| APT-017 | Edit appointment | Click edit | Edit form |
| APT-018 | Cancel appointment | Click cancel | Status = cancelled |
| APT-019 | Reschedule | Change date/time | New slot assigned |
| APT-020 | No-show marking | Mark as no-show | Status updated |
| APT-021 | Check-in from appointment | Click check-in | Add to queue |

---

## Module 5: Queue Management (File d'Attente)

### 5.1 Queue Operations
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| QUE-001 | View queue | Navigate to queue | Current queue displayed |
| QUE-002 | Check-in patient | Click "Enregistrer arrivee" | Patient added to queue |
| QUE-003 | Walk-in patient | Click "Patient sans RDV" | Quick registration |
| QUE-004 | Call next patient | Click "Appeler Suivant" | Next patient called |
| QUE-005 | Priority sorting | Select "Trier par priorite" | Urgent first |
| QUE-006 | Start consultation | Click patient | Move to "En consultation" |
| QUE-007 | Complete consultation | End visit | Remove from queue |
| QUE-008 | Cancel queue entry | Remove patient | Patient removed |
| QUE-009 | Wait time display | View stats | Average wait shown |
| QUE-010 | Queue analytics | Click "Analyses" | Analytics view |

### 5.2 Real-time Updates
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| QUE-011 | WebSocket connection | Open queue page | Real-time updates |
| QUE-012 | Multi-user updates | Two users view queue | Both see changes |
| QUE-013 | Connection loss | Disable network | Reconnection attempt |

---

## Module 6: StudioVision Ophthalmology

### 6.1 Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| OPH-001 | Dashboard load | Navigate to ophthalmology | Stats displayed |
| OPH-002 | Examens aujourd'hui | View count | Correct count |
| OPH-003 | Start StudioVision | Click StudioVision button | Patient selection modal |
| OPH-004 | Select patient | Search and select | Navigate to consultation |
| OPH-005 | Quick access buttons | Click Vue d'Attente, Refraction, etc. | Navigate to views |

### 6.2 StudioVision Consultation
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| OPH-006 | Load patient data | Open patient consultation | Previous data loaded | First visit |
| OPH-007 | Visual acuity OD | Enter Monoyer values | Values saved | CLD, VBLM, PL+, PL- |
| OPH-008 | Visual acuity OS | Enter Monoyer values | Values saved | Same as OD |
| OPH-009 | Near vision | Enter Parinaud values | Values saved | P1.5 to P20 |
| OPH-010 | Refraction entry | Enter sphere/cyl/axis | Validated range | -20 to +20, axis 0-180 |
| OPH-011 | IOP measurement | Enter mmHg value | Range validated | 0-60 mmHg |
| OPH-012 | Anterior segment | Complete slit lamp exam | Findings saved | LOCS III grading |
| OPH-013 | Posterior segment | Complete fundus exam | Findings saved | DR staging |
| OPH-014 | Renouvellement buttons | Click to copy from last visit | Data populated | No previous data |
| OPH-015 | Device data sync | Import from devices | Data auto-filled | Device offline |
| OPH-016 | Add diagnosis | Select ICD-10 codes | Diagnosis linked | Laterality (OD/OS/OU) |
| OPH-017 | Create prescription | Generate Rx | Prescription created | Multiple prescriptions |
| OPH-018 | Create glasses order | Generate optical Rx | Order created | - |
| OPH-019 | Generate documents | Create Fiche Ophta | PDF generated | - |
| OPH-020 | Save consultation | Click save | All data persisted | Partial save |

### 6.3 Tab Navigation
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| OPH-021 | Refraction tab | Click tab | Pink section visible |
| OPH-022 | IOP tab | Click tab | Green section visible |
| OPH-023 | Diagnostic tab | Click tab | Yellow section visible |
| OPH-024 | Segment anterieur | Click tab | Slit lamp form |
| OPH-025 | Fond d'oeil | Click tab | Fundus form |

---

## Module 7: Prescriptions

### 7.1 Prescription List
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| RX-001 | View all prescriptions | Navigate to prescriptions | List displayed |
| RX-002 | Filter "Tous" | Click tab | All prescriptions |
| RX-003 | Filter "Sans Rx" | Click tab | Non-pharmacy |
| RX-004 | Filter "PA En cours" | Click tab | Pending approvals |
| RX-005 | Filter "PA Approuvees" | Click tab | Approved |
| RX-006 | Filter "PA Refusees" | Click tab | Rejected |
| RX-007 | Search prescription | Type patient name | Filtered results |

### 7.2 Prescription Creation
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| RX-008 | New prescription | Click "Nouvelle Prescription" | Form opens | - |
| RX-009 | Select patient | Search and select | Patient linked | - |
| RX-010 | Add medication | Search drug database | Drug added | Drug not found |
| RX-011 | Set dosage | Enter dosage details | Validated | Max dose warning |
| RX-012 | Set duration | Enter treatment duration | Days calculated | - |
| RX-013 | Drug interaction check | Add conflicting drugs | Warning displayed | Override option |
| RX-014 | Allergy check | Add allergenic drug | Alert displayed | - |
| RX-015 | Generic substitution | Select generic option | Generic suggested | - |
| RX-016 | Save prescription | Click save | Prescription created | - |
| RX-017 | Print prescription | Click "Imprimer" | PDF generated | - |

### 7.3 Prior Authorization
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| RX-018 | Request PA | Click "voir PA" | PA form opens |
| RX-019 | Submit PA | Complete and submit | Status = "En attente" |
| RX-020 | Approve PA | Admin approves | Status = "Approuve" |
| RX-021 | Reject PA | Admin rejects | Status = "Refuse" |

---

## Module 8: Pharmacy

### 8.1 Pharmacy Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PHRM-001 | View dashboard | Navigate to pharmacy | Stats displayed |
| PHRM-002 | Total articles | Check count | Correct inventory count |
| PHRM-003 | Stock faible | Check alerts | Low stock items listed |
| PHRM-004 | Expire bientot | Check alerts | Near-expiry items |
| PHRM-005 | Valeur totale | Check value | Total in CFA |

### 8.2 Inventory Management
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| PHRM-006 | Add medication | Click "Ajouter un medicament" | Form opens | - |
| PHRM-007 | Set stock level | Enter quantity | Stock updated | Negative stock |
| PHRM-008 | Set expiry date | Enter date | Date saved | Past date |
| PHRM-009 | Set price | Enter price in CFA | Price saved | - |
| PHRM-010 | Category assignment | Select category | Category linked | - |
| PHRM-011 | Search medication | Type name/code | Results filtered | - |
| PHRM-012 | Filter by status | Select status | Filtered list | - |
| PHRM-013 | Stock adjustment | Adjust quantity | Movement logged | Reason required |

### 8.3 Dispensing
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PHRM-014 | View pending | Click "En attente" | Pending Rx list |
| PHRM-015 | Dispense medication | Click dispense | Stock reduced |
| PHRM-016 | Partial dispense | Enter partial quantity | Remaining tracked |
| PHRM-017 | Out of stock | Try to dispense 0 stock | Error shown |
| PHRM-018 | Complete dispensing | Finish all items | Rx marked complete |

---

## Module 9: Laboratory

### 9.1 Lab Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| LAB-001 | View dashboard | Navigate to laboratory | Stats displayed |
| LAB-002 | Echantillons count | Check count | Total samples |
| LAB-003 | En attente count | Check pending | Pending tests |
| LAB-004 | Resultats count | Check results | Completed tests |

### 9.2 Lab Orders
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| LAB-005 | New lab order | Click "Nouvelle demande" | Order form |
| LAB-006 | Select tests | Choose from catalogue | Tests added |
| LAB-007 | Priority setting | Set urgency | Priority tagged |
| LAB-008 | Sample collection | Mark collected | Status updated |
| LAB-009 | Result entry | Enter results | Values saved |
| LAB-010 | Abnormal flagging | Enter out-of-range | Auto-flagged |
| LAB-011 | Critical alert | Enter critical value | Alert triggered |
| LAB-012 | Approve results | Verify and approve | Results final |

### 9.3 Lab Configuration
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| LAB-013 | Test catalogue | View catalogue | All tests listed |
| LAB-014 | Add test type | Create new test | Test added |
| LAB-015 | Set reference ranges | Enter normal values | Ranges saved |
| LAB-016 | LIS integration | Configure HL7 | Connection tested |

---

## Module 10: Surgery

### 10.1 Surgery Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SURG-001 | View dashboard | Navigate to surgery | Stats displayed |
| SURG-002 | Agenda operatoire | View schedule | Today's surgeries |
| SURG-003 | Date navigation | Change dates | Schedule updates |
| SURG-004 | Status filters | Filter by status | Filtered list |

### 10.2 Surgery Cases
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SURG-005 | New case | Click "Nouveau Cas" | Case form |
| SURG-006 | Select patient | Search and select | Patient linked |
| SURG-007 | Select procedure | Choose surgery type | Procedure set |
| SURG-008 | Schedule surgery | Set date/time | Slot reserved |
| SURG-009 | Pre-op checklist | Complete checklist | Status updated |
| SURG-010 | Surgery check-in | Start surgery | Status = "En cours" |
| SURG-011 | Surgery report | Complete report | Report saved |
| SURG-012 | Post-op notes | Add notes | Notes saved |
| SURG-013 | Complications | Log complications | Tracked |
| SURG-014 | Complete surgery | Mark complete | Status = "Termine" |

### 10.3 Surgeon View
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SURG-015 | Surgeon dashboard | Click "Vue Chirurgien" | Personal schedule |
| SURG-016 | Performance stats | View stats | Metrics displayed |

---

## Module 11: Optical Shop (Boutique Optique)

### 11.1 Optical Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| OPT-001 | View dashboard | Navigate to optical shop | Stats displayed |
| OPT-002 | Mes ventes aujourd'hui | Check sales | Daily sales total |
| OPT-003 | En attente verification | Check pending | Items to verify |
| OPT-004 | Commandes externes | Check external | External orders |

### 11.2 New Sale
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| OPT-005 | Start new sale | Click "Nouvelle Vente" | Patient search |
| OPT-006 | Select patient | Search and select | Patient linked |
| OPT-007 | Load prescription | Select Rx | Rx data loaded |
| OPT-008 | Select frame | Choose from inventory | Frame added |
| OPT-009 | Select lenses | Choose lens type | Lenses added |
| OPT-010 | Add coatings | Select options | Options added |
| OPT-011 | Calculate price | View total | Price calculated |
| OPT-012 | Process payment | Complete sale | Invoice created |

### 11.3 Verification
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| OPT-013 | View pending | Click "Verification" | Pending list |
| OPT-014 | Verify order | Check parameters | Status updated |
| OPT-015 | Reject order | Mark issue | Status = rejected |
| OPT-016 | Approve order | Mark verified | Ready for delivery |

### 11.4 Glasses Orders
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| OPT-017 | View orders | Navigate to glasses-orders | Order list |
| OPT-018 | Track order | View status | Status timeline |
| OPT-019 | Order delivery | Mark delivered | Status = delivered |
| OPT-020 | Order pickup | Patient pickup | Complete order |

---

## Module 12: IVT (Intravitreal Injections)

### 12.1 IVT Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| IVT-001 | View dashboard | Navigate to IVT | Stats displayed |
| IVT-002 | Total injections | Check count | Injection total |
| IVT-003 | Taux complications | Check percentage | Complication rate |
| IVT-004 | A venir (30j) | Check upcoming | Next 30 days |
| IVT-005 | Patients en retard | Check overdue | Late patients |

### 12.2 IVT Management
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| IVT-006 | New IVT | Click "Nouvelle IVT" | Injection form |
| IVT-007 | Select patient | Search and select | Patient linked |
| IVT-008 | Select eye | Choose OD/OS | Eye set |
| IVT-009 | Select medication | Choose drug | Drug set |
| IVT-010 | Set dose | Enter dose | Dose validated |
| IVT-011 | Pre-injection IOP | Enter IOP | IOP recorded |
| IVT-012 | Consent form | Mark consent obtained | Consent logged |
| IVT-013 | Perform injection | Complete procedure | Injection recorded |
| IVT-014 | Post-injection IOP | Enter IOP | IOP recorded |
| IVT-015 | Log complication | Record issue | Complication tracked |
| IVT-016 | Schedule follow-up | Set next injection | Appointment created |

---

## Module 13: Invoicing & Billing

### 13.1 Invoice List
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| INV-001 | View invoices | Navigate to invoicing | Invoice list |
| INV-002 | Filter by status | Select paid/pending | Filtered list |
| INV-003 | Filter by date | Set date range | Filtered list |
| INV-004 | Filter by clinic | Select clinic | Filtered list |
| INV-005 | Search invoice | Type number/patient | Results found |

### 13.2 Invoice Creation
| Test ID | Test Case | Steps | Expected | Edge Cases |
|---------|-----------|-------|----------|------------|
| INV-006 | New invoice | Click create | Invoice form | - |
| INV-007 | Select patient | Search and select | Patient linked | - |
| INV-008 | Add services | Select services | Items added | - |
| INV-009 | Apply prices | Fee schedule applied | Prices calculated | Clinic-specific |
| INV-010 | Convention split | System splits patient/company | Two amounts | Coverage limits |
| INV-011 | Apply discount | Enter discount | Total adjusted | Max discount |
| INV-012 | Currency selection | Choose CDF/USD | Currency set | Exchange rate |
| INV-013 | Save invoice | Click save | Invoice created | - |
| INV-014 | Print invoice | Click print | PDF generated | - |

### 13.3 Payment Processing
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| INV-015 | Cash payment | Select cash, enter amount | Payment recorded |
| INV-016 | Card payment | Select card | Payment recorded |
| INV-017 | Mobile money | Select Orange/MTN/Wave | Payment recorded |
| INV-018 | Partial payment | Enter less than total | Balance remaining |
| INV-019 | Overpayment | Enter more than due | Change calculated |
| INV-020 | Multi-currency | Pay in different currency | Exchange applied |

---

## Module 14: Companies & Conventions

### 14.1 Company List
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| COMP-001 | View companies | Navigate to companies | Company list |
| COMP-002 | Search company | Type name | Results filtered |
| COMP-003 | Filter by status | Select active/inactive | Filtered list |

### 14.2 Company Management
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| COMP-004 | Add company | Click "Nouvelle entreprise" | Company form |
| COMP-005 | Enter details | Fill company info | Details saved |
| COMP-006 | Set coverage | Define coverage % | Coverage saved |
| COMP-007 | Set limits | Define annual/visit limits | Limits saved |
| COMP-008 | Add employees | Link patients | Employees linked |
| COMP-009 | View balances | Check outstanding | Balance displayed |
| COMP-010 | Generate statement | Export statement | PDF generated |

### 14.3 Approvals
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| APPR-001 | View approvals | Navigate to approvals | Approval list |
| APPR-002 | Filter pending | Select "En attente" | Pending only |
| APPR-003 | Create approval request | Click "Nouvelle demande" | Request form |
| APPR-004 | Approve request | Click approve | Status updated |
| APPR-005 | Reject request | Click reject with reason | Status updated |
| APPR-006 | Request more info | Request details | Status = info needed |

---

## Module 15: Settings & Administration

### 15.1 Profile Settings
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-001 | View profile | Navigate to settings | Profile displayed |
| SET-002 | Update profile | Change name/email | Changes saved |
| SET-003 | Change photo | Upload new photo | Photo updated |
| SET-004 | Update phone | Change phone number | Number saved |

### 15.2 Notification Settings
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-005 | Email notifications | Toggle settings | Preferences saved |
| SET-006 | SMS notifications | Toggle settings | Preferences saved |
| SET-007 | In-app notifications | Toggle settings | Preferences saved |

### 15.3 Calendar Settings
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-008 | Working hours | Set clinic hours | Hours saved |
| SET-009 | Appointment duration | Set default duration | Duration saved |
| SET-010 | Buffer time | Set buffer between appointments | Buffer saved |

### 15.4 Security Settings
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-011 | Change password | Enter new password | Password changed |
| SET-012 | Enable 2FA | Set up authenticator | 2FA enabled |
| SET-013 | View sessions | List active sessions | Sessions shown |
| SET-014 | Logout all | Terminate all sessions | All logged out |

### 15.5 Billing Settings (Facturation)
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-015 | Invoice prefix | Set prefix | Prefix saved |
| SET-016 | Tax settings | Configure tax | Tax saved |
| SET-017 | Payment methods | Enable/disable methods | Methods saved |

### 15.6 Tarifs (Fee Schedules)
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-018 | View fee schedules | Navigate to tarifs | Schedules listed |
| SET-019 | Edit prices | Modify service prices | Prices saved |
| SET-020 | Clinic-specific prices | Set per-clinic prices | Variations saved |

### 15.7 Permissions
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-021 | View roles | Navigate to permissions | Roles listed |
| SET-022 | Edit role permissions | Modify permissions | Permissions saved |

### 15.8 Clinic Settings
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-023 | View clinic info | Navigate to clinique | Clinic details |
| SET-024 | Update clinic | Modify clinic info | Changes saved |

### 15.9 LIS/HL7 Integration
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| SET-025 | Configure LIS | Set connection details | Connection saved |
| SET-026 | Test connection | Click test | Connection verified |

---

## Module 16: User Management (Missing from Settings Navigation)

### 16.1 User List
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| USR-001 | Access via URL | Navigate to /users | User list displayed |
| USR-002 | Search users | Type name/email | Results filtered |
| USR-003 | Filter by role | Select role | Filtered list |
| USR-004 | Filter by status | Select active/inactive | Filtered list |

### 16.2 User Creation
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| USR-005 | Add user | Click add button | User form |
| USR-006 | Enter details | Fill first/last/email | Details entered |
| USR-007 | Set role | Select from dropdown | Role assigned |
| USR-008 | Set department | Select department | Department set |
| USR-009 | Set permissions | Check permissions | Permissions saved |
| USR-010 | Save user | Click save | User created |
| USR-011 | Duplicate email | Use existing email | Error shown |

### 16.3 User Management
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| USR-012 | Edit user | Click edit | Edit form |
| USR-013 | Deactivate user | Toggle status | User deactivated |
| USR-014 | Reset password | Click reset | Password email sent |
| USR-015 | Delete user | Click delete | User removed |

---

## Module 17: Multi-Clinic Operations

### 17.1 Clinic Switching
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| MULTI-001 | View current clinic | Check header | Clinic name shown |
| MULTI-002 | Open dropdown | Click clinic selector | Clinic list |
| MULTI-003 | Switch clinic | Select different clinic | Data reloaded |
| MULTI-004 | All Clinics view | Select "All Clinics" | Aggregated data |

### 17.2 Cross-Clinic Data
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| MULTI-005 | Patient visibility | View patients | Only current clinic |
| MULTI-006 | Inventory visibility | View inventory | Clinic-specific |
| MULTI-007 | Consolidated reports | View reports | All clinics data |
| MULTI-008 | Inventory transfer | Transfer between clinics | Stock moved |

---

## Module 18: Documents

### 18.1 Document Generation
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| DOC-001 | View templates | Navigate to documents | Templates listed |
| DOC-002 | Generate prescription | Create Rx PDF | PDF generated |
| DOC-003 | Generate Fiche Ophta | Create exam PDF | PDF generated |
| DOC-004 | Generate invoice | Create invoice PDF | PDF generated |
| DOC-005 | Generate letter | Create medical letter | PDF generated |
| DOC-006 | Download document | Click download | File downloaded |
| DOC-007 | Print document | Click print | Print dialog |

---

## Module 19: Audit Trail

### 19.1 Audit Log
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| AUD-001 | View audit log | Navigate to audit | Log entries |
| AUD-002 | Filter by user | Select user | Filtered log |
| AUD-003 | Filter by action | Select action type | Filtered log |
| AUD-004 | Filter by date | Set date range | Filtered log |
| AUD-005 | View details | Click entry | Full details |
| AUD-006 | Export audit | Click export | PDF/CSV export |

---

## Module 20: Device Integration

### 20.1 Device Manager
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| DEV-001 | View devices | Navigate to devices | Device list |
| DEV-002 | Add device | Click add | Device form |
| DEV-003 | Configure device | Set connection details | Config saved |
| DEV-004 | Test connection | Click test | Connection verified |
| DEV-005 | Device sync | Trigger sync | Data imported |

### 20.2 Network Discovery
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| DEV-006 | Scan network | Click discover | Devices found |
| DEV-007 | Auto-configure | Select discovered | Device added |

---

## Module 21: Financial Reports

### 21.1 Report Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| FIN-001 | View dashboard | Navigate to financial | Dashboard displayed |
| FIN-002 | Revenue today | Check stat | Correct amount |
| FIN-003 | Monthly trend | View chart | Chart rendered |
| FIN-004 | Revenue by service | View breakdown | Services listed |
| FIN-005 | Aging report | View A/R aging | Aging buckets |
| FIN-006 | Convention balances | View company balances | Balances shown |
| FIN-007 | Export report | Click export | Report downloaded |

---

## Module 22: Patient Portal

### 22.1 Patient Login
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PORTAL-001 | Patient login | Navigate to /patient/login | Login form |
| PORTAL-002 | Valid login | Enter credentials | Portal dashboard |
| PORTAL-003 | Invalid login | Wrong credentials | Error shown |

### 22.2 Patient Dashboard
| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| PORTAL-004 | View appointments | Check appointments | Upcoming shown |
| PORTAL-005 | View prescriptions | Check prescriptions | Rx history |
| PORTAL-006 | View bills | Check bills | Invoice list |
| PORTAL-007 | View results | Check results | Lab results |
| PORTAL-008 | Send message | Click messages | Message form |
| PORTAL-009 | Update profile | Click profile | Edit form |

---

## Edge Case Test Matrix

### Data Validation Edge Cases
| Category | Edge Case | Test Approach |
|----------|-----------|---------------|
| Dates | Future birthdate | Should be rejected |
| Dates | Very old date (1900) | Should be accepted |
| Dates | Invalid format | Validation error |
| Numbers | Negative amounts | Should be rejected |
| Numbers | Zero values | Depends on field |
| Numbers | Very large numbers | Overflow handling |
| Text | Empty required fields | Validation error |
| Text | Very long strings (10000 chars) | Truncation or error |
| Text | Special characters | Proper escaping |
| Text | Unicode/emojis | Proper handling |
| Text | SQL injection attempts | Safely rejected |
| Text | XSS attempts | Properly escaped |

### Concurrency Edge Cases
| Scenario | Test Approach |
|----------|---------------|
| Two users edit same patient | Last write wins or conflict resolution |
| Double-submit form | Prevent duplicate creation |
| Stock goes negative during sale | Transaction rollback |
| Appointment double-booking | Prevention or warning |

### Network Edge Cases
| Scenario | Test Approach |
|----------|---------------|
| Slow network (3G) | Loading states, timeouts |
| Network disconnection | Offline handling, retry |
| API timeout | User-friendly error |
| Large file upload | Progress indicator, size limits |

### Permission Edge Cases
| Scenario | Test Approach |
|----------|---------------|
| Access without permission | 403 error, redirect |
| Expired session | Token refresh or re-login |
| Role downgrade during session | Immediate restriction |

---

## Test Execution Priority

### P0 - Critical (Must pass before deployment)
- AUTH-001 to AUTH-010 (Authentication)
- PAT-001 to PAT-024 (Patient Registration)
- APT-007 to APT-015 (Appointment Creation)
- OPH-006 to OPH-020 (StudioVision)
- INV-006 to INV-020 (Invoicing)
- MULTI-001 to MULTI-004 (Multi-Clinic)

### P1 - High (Should pass before deployment)
- All Queue operations
- Prescription workflow
- Pharmacy dispensing
- Surgery scheduling
- IVT management

### P2 - Medium (Should pass within first week)
- Settings configurations
- User management
- Device integration
- Audit trail

### P3 - Low (Nice to have)
- Patient portal
- Advanced analytics
- Edge cases

---

## Test Data Requirements

### Required Test Patients
1. New patient (for registration tests)
2. Existing patient with history
3. Patient with convention
4. Patient with pending items
5. Patient with complete visit history

### Required Test Users
1. Admin user (full permissions)
2. Doctor user
3. Nurse user
4. Receptionist user
5. Pharmacist user
6. Optician user
7. Billing user

### Required Test Companies
1. Active company with balance
2. Company with exhausted limits
3. Inactive company

---

## Automation Strategy

### Playwright Test Structure
```
tests/
  playwright/
    auth/
      login.spec.ts
      logout.spec.ts
      password-reset.spec.ts
    patients/
      registration.spec.ts
      search.spec.ts
      edit.spec.ts
    appointments/
      calendar.spec.ts
      booking.spec.ts
      management.spec.ts
    ophthalmology/
      dashboard.spec.ts
      studiovision.spec.ts
      prescriptions.spec.ts
    ...
```

### Test Data Seeding
- Create dedicated test clinic
- Seed test patients before test run
- Clean up after test completion
- Use unique identifiers for test data

---

## Appendix: Screenshot Inventory

| Screenshot | Module | Elements Visible | Test Coverage |
|------------|--------|------------------|---------------|
| prod_settings_main | Settings | Profile form, Settings tabs | SET-001 to SET-025 |
| prod_j5_companies_list | Companies | Company list, filters | COMP-001 to COMP-003 |
| prod_dashboard_main | Dashboard | All widgets, quick actions | DASH-001 to DASH-015 |
| prod_j1_wizard_step1 | Patients | Registration wizard | PAT-005 to PAT-011 |
| prod_j1_appointments | Appointments | Calendar, list | APT-001 to APT-021 |
| prod_j1_pharmacy | Pharmacy | Dashboard, inventory | PHRM-001 to PHRM-018 |
| prod_laboratory | Laboratory | Orders, catalogue | LAB-001 to LAB-016 |
| prod_j1_invoicing | Invoicing | Invoice list | INV-001 to INV-020 |
| prod_j1_queue | Queue | Queue management | QUE-001 to QUE-013 |
| prod_surgery | Surgery | Surgery dashboard | SURG-001 to SURG-016 |
| prod_optical_shop | Optical | Shop dashboard | OPT-001 to OPT-020 |
| prod_ivt | IVT | IVT dashboard | IVT-001 to IVT-016 |
| prod_ophthalmology | Ophthalmology | Dashboard | OPH-001 to OPH-025 |
| prod_approvals | Approvals | Approval list | APPR-001 to APPR-006 |
| prod_financial | Financial | Reports | FIN-001 to FIN-007 |

---

*Generated: December 29, 2025*
*Total Test Cases: 200+*
*Modules Covered: 22*
