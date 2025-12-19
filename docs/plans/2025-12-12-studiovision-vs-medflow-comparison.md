# StudioVision vs MedFlow EMR - Comprehensive UI/UX Comparison

## Executive Summary

This document provides an in-depth comparison between **StudioVision** (French ophthalmology EMR competitor) and **MedFlow** (ROCH GROUP's ophthalmology EMR). The analysis covers UI philosophy, module architecture, workflows, and feature gaps.

---

## 1. Overall Interface Philosophy

### StudioVision
| Aspect | Implementation |
|--------|---------------|
| **Navigation** | Two-menu system: horizontal top menu (app-level) + patient-level secondary menu |
| **Design Philosophy** | "Everything visible at a glance" - single-screen dashboard, no scrolling |
| **Customization** | Fixed/frozen layout, not customizable per user |
| **Efficiency Focus** | Heavy keyboard shortcuts, mouse shortcuts, pre-filled dropdowns |

### MedFlow
| Aspect | Implementation |
|--------|---------------|
| **Navigation** | Sidebar-based MainLayout + PatientLayout for patient context |
| **Design Philosophy** | Collapsible sections approach - expandable panels in PatientDetail |
| **Customization** | Role-based menu configurations (`rolePermissions.js`) |
| **Efficiency Focus** | Keyboard shortcuts (`useKeyboardShortcuts.js`), GlobalSearch component |

### Gap Analysis

| Feature | StudioVision | MedFlow | Gap? |
|---------|-------------|---------|------|
| Single-screen dashboard | Yes (core design) | No (collapsible sections) | **MODERATE GAP** |
| Keyboard shortcuts | Extensive system-wide | Present but limited | Minor gap |
| Mouse shortcuts | Right-click menus, drag | Not extensively documented | **GAP** |
| Pre-filled dropdowns | Doctor-customizable | Template-based | Equivalent |

**Recommendation**: Consider adding a "Dashboard View" toggle that consolidates patient summary into single-screen mode for doctors who prefer StudioVision-style workflow.

---

## 2. Patient Dashboard/File (Fiche Patient)

### StudioVision Structure

```
+--------------------------------------------------+
|  [Patient Name] [ID] [DOB/Age] [Gender] [SSN]    |  <- Identity Bar
+--------------------------------------------------+
| Quick Nav  |      Clinical Summary Grid           |  Quick
| - Patient  | +------+------+--------+--------+   |  Actions
|   List     | |      | OD   | OS     | Notes  |   |  --------
| - Recent   | | VA   | 20/20| 20/25  |        |   |  [Print Rx]
| - History  | | Ref  |-2.00 |-1.75   |        |   |  [Letter]
| - Archive  | | IOP  | 14   | 15     |        |   |  [Invoice]
|            | +------+------+--------+--------+   |  [Schedule]
+--------------------------------------------------+
|  Clinical Notes / Voice-to-text                  |  Device Status
+--------------------------------------------------+
```

### MedFlow Structure

```
+--------------------------------------------------+
|  MainLayout (Sidebar)  |  PatientLayout           |
+--------------------------------------------------+
| - Dashboard            |  PatientInfoSection      |
| - Patients             |  (Collapsible)           |
| - Appointments         |  +--------------------+  |
| - Prescriptions        |  | Demographics       |  |
| - Billing              |  | Photo/Avatar       |  |
| ...                    |  +--------------------+  |
|                        |  OphthalmologySection    |
|                        |  (Collapsible)           |
|                        |  BillingSection          |
|                        |  ImagingSection          |
|                        |  PrescriptionsSection    |
+--------------------------------------------------+
```

### Feature Comparison

| Component | StudioVision | MedFlow | Notes |
|-----------|-------------|---------|-------|
| **Patient Identity Bar** | Fixed top bar with all key info | `PatientInfoSection` with photo avatar | MedFlow has **biometric face recognition** (advantage) |
| **Quick Navigation** | Left sidebar with recent patients | `PatientContextPanel`, `PatientPreviewCard` | Equivalent |
| **Clinical Summary Grid** | Single visible grid (VA, Ref, IOP) | Separate sections for each data type | StudioVision more compact |
| **Diagnosis List** | Dedicated panel with ICD-10 + color coding | Within OphthalmologySection | Equivalent |
| **Quick Actions** | Right column buttons | Throughout sections | **GAP**: No dedicated quick action column |
| **Device Status** | Real-time indicators | Present in DeviceManager | Equivalent |
| **Notes/Voice-to-text** | Bottom section | Per-section notes | **GAP**: No voice-to-text |

### MedFlow Advantages
- **Face Recognition**: `PatientPhotoAvatar.jsx` with biometric verification
- **Patient Timeline**: `PatientTimeline.jsx` for historical view
- **IOP History Charts**: `PatientIOPHistory.jsx` with graphical trends
- **Medical Summary Panel**: `PatientMedicalSummary.jsx`

---

## 3. Refraction Module

### StudioVision Layout
```
+------------------------+------------------------+
|        OD (Right)      |        OS (Left)       |
+------------------------+------------------------+
| Objective Refraction   | Objective Refraction   |
| [Import from Device]   | [Import from Device]   |
| Sph: [-20 to +20]     | Sph: [-20 to +20]     |
| Cyl: [-6 to +6]       | Cyl: [-6 to +6]       |
| Axis: [0° to 180°]    | Axis: [0° to 180°]    |
+------------------------+------------------------+
| Subjective Refraction  | Subjective Refraction  |
| ADD: [+0.75 to +3.50] | ADD: [+0.75 to +3.50] |
+------------------------+------------------------+
| Visual Acuity          | Visual Acuity          |
| Far: [20/20 - NLP]    | Far: [20/20 - NLP]    |
| Near: [J1-J11/P2-P14] | Near: [J1-J11/P2-P14] |
| [x] With Correction   | [x] With Correction   |
| [x] Pinhole Improve   | [x] Pinhole Improve   |
+------------------------+------------------------+
| [Auto-Calculate] [Compare] [Send to Rx] [Print] |
+------------------------+------------------------+
```

### MedFlow Refraction Components

**File Structure:**
```
frontend/src/pages/ophthalmology/components/
├── VisualAcuityStep.jsx
├── ObjectiveRefractionStep.jsx
├── SubjectiveRefractionStep.jsx
├── PrescriptionStep.jsx
└── panels/ExaminationPanel.jsx
```

**Backend Model** (`OphthalmologyExam.js`):
```javascript
{
  refraction: {
    autorefraction: { OD: {...}, OS: {...} },
    subjective: { OD: {...}, OS: {...} },
    nearAddition: { OD, OS }
  },
  visualAcuity: {
    uncorrected: { far: {OD, OS}, near: {OD, OS} },
    corrected: { far: {OD, OS}, near: {OD, OS} },
    pinhole: { OD, OS }
  }
}
```

### Feature Comparison

| Feature | StudioVision | MedFlow | Status |
|---------|-------------|---------|--------|
| OD/OS Split View | Yes | Yes (step-based) | **DIFFERENT APPROACH** |
| Device Import | "Import from Device" button | `usePreviousExamData` hook + device adapters | Equivalent |
| Autorefractor Integration | Nidek ARK-1 mentioned | `AutorefractorAdapter.js` | Equivalent |
| Compare with Previous | Button in UI | `RefractionComparisonView.jsx` | Equivalent |
| Visual Acuity Dropdowns | Snellen + Jaeger scales | Configurable in `ophthalmologyData.js` | Equivalent |
| Auto-Calculate Glasses Rx | Yes | `ophthalmologyCalculations.js` | Equivalent |
| Axis Wheel Selector | Visual degree wheel | Standard input | **MINOR GAP** |

### MedFlow Advantages
- **Workflow Steps**: Guided step-by-step process vs. single-screen
- **Calculations**: `ophthalmologyCalculations.js` utilities
- **Historical Data Hook**: `usePreviousExamData.js` for trend analysis

---

## 4. Contact Lens Module

### StudioVision Features

**Detailed Fitting System:**
- Patient wearing history (years, schedule, compliance)
- Lens type selection (Soft, RGP, Hybrid, Scleral)
- OD/OS parameter entry (BC, Diameter, Power, Cyl, Axis, ADD)
- Fitting assessment grid (centration, movement, coverage, comfort)
- Trial lens inventory tracker with barcode
- Vertex distance auto-calculation
- Supply management (boxes, solution)

### MedFlow Contact Lens Implementation

**Backend Model** (`ContactLensInventory.js`):
- Inventory management focus
- Brand, type, parameters tracking
- Stock levels, reorder points

**GlassesOrder Model** includes:
```javascript
contactLens: {
  OD: { sphere, cylinder, axis, baseCurve, diameter, brand },
  OS: { sphere, cylinder, axis, baseCurve, diameter, brand }
}
```

**Frontend:**
- `ContactLensInventory/index.jsx` - Inventory management page
- Integrated in `PrescriptionStep.jsx` for optical prescriptions

### Gap Analysis

| Feature | StudioVision | MedFlow | Gap Level |
|---------|-------------|---------|-----------|
| Patient Wearing History | Dedicated section | Not found | **CRITICAL GAP** |
| Compliance Rating | Yes | No | **GAP** |
| Fitting Assessment Grid | Centration, movement, coverage, comfort | No | **CRITICAL GAP** |
| Trial Lens Tracking | Barcode scanner, return date | Not found | **GAP** |
| Material Selection | RGP-specific params | Basic soft lens params | **MODERATE GAP** |
| Follow-up Auto-Schedule | Yes | Manual | **MINOR GAP** |
| Supply Calculator | Annual supply calc | No | **GAP** |

**Recommendation**: Create dedicated `ContactLensFitting.jsx` module with:
1. Patient contact lens history form
2. Fitting assessment grid (OD/OS)
3. Trial lens management with barcode integration
4. Follow-up scheduling integration

---

## 5. Pathology/Diagnosis Entry

### StudioVision Approach

**Disease-Specific Modules:**
- Glaucoma: Type, staging, IOP targets, C/D ratio, VF defect, RNFL link
- Cataract: LOCS III grading with visual references
- AMD/DMLA: Type, subtype, activity status, CNV size
- Diabetic Retinopathy: Implied but not detailed

**Features:**
- Quick search with ICD-10 + French terms
- Favorite diagnoses panel (8-12 buttons)
- Associated findings section
- Treatment planning integration
- Image linking per diagnosis

### MedFlow Diagnosis Implementation

**Components:**
```
frontend/src/pages/ophthalmology/components/
├── DiagnosisStep.jsx
├── GlaucomaPanel.jsx
├── panels/DiagnosticPanel.jsx
```
```
frontend/src/components/
├── PathologyQuickPick.jsx
├── templates/PathologyFindingSelector.jsx
```

**Backend Services:**
- `ClinicalAlert.js` - Alert triggering based on findings
- `clinicalAlertService.js` - Alert logic and notifications
- `drGradingService.js` - Diabetic retinopathy AI grading
- `rnflAnalysisService.js` - RNFL analysis for glaucoma
- `gpaService.js` - Glaucoma progression analysis
- `PathologyTemplate.js` - Template-based diagnoses

### Feature Comparison

| Feature | StudioVision | MedFlow | Status |
|---------|-------------|---------|--------|
| ICD-10 Integration | Auto-assignment | Referenced in model | Equivalent |
| Favorite Diagnoses | 8-12 quick buttons | `PathologyQuickPick.jsx` | Equivalent |
| Glaucoma Module | Type, staging, targets | `GlaucomaPanel.jsx` + services | **MedFlow SUPERIOR** |
| Cataract Grading | LOCS III with images | Not detailed | **GAP** |
| AMD Module | Type, subtype, CNV | Supported in model | Equivalent |
| DR Grading | Not mentioned | `drGradingService.js` with AI | **MedFlow SUPERIOR** |
| Clinical Alerts | Not mentioned | `ClinicalAlert` system | **MedFlow SUPERIOR** |
| Image Linking | Per diagnosis | `ImageTimelineSelector.jsx` | Equivalent |
| Progression Analysis | Not mentioned | `gpaService.js`, `rnflAnalysisService.js` | **MedFlow SUPERIOR** |

### MedFlow Advantages
- **AI-Powered DR Grading**: Automated diabetic retinopathy classification
- **GPA Analysis**: Glaucoma Progression Analysis service
- **RNFL Analysis**: Nerve fiber layer tracking
- **Clinical Alerts**: Proactive alert system for critical findings

### Gap: LOCS III Cataract Grading
StudioVision has visual reference images for LOCS III grading. Consider adding:
- Visual grading scale component
- Reference images for NO1-NO6, NC1-NC6, C1-C5, P1-P5

---

## 6. Prescription Module

### StudioVision Features

**Tabs:**
1. Glasses Prescription (Lunettes)
2. Contact Lens Prescription (Lentilles)
3. Medication Prescription (Médicaments)
4. Imaging/Lab Orders

**Glasses Rx Features:**
- Auto-import from refraction
- OD/OS split form
- Prism fields
- ADD for near vision
- Lens type, material, coatings
- Monocular/binocular PD
- "2-click" print emphasized

**Medication Rx Features:**
- Drug search with Vidal database
- Favorite medications (10-15 buttons)
- Eye-specific (OD/OS/OU)
- Frequency buttons (QID, TID, BID, QD, QHS)
- Duration fields
- Refills management
- Generic substitution toggle
- Treatment templates
- Drug interaction checker

### MedFlow Prescription Implementation

**Backend Model** (`Prescription.js` - 1,716 lines):
```javascript
{
  type: ['medication', 'optical', 'therapy', 'medical-device', 'lab-test'],
  status: ['draft', 'pending', 'ready', 'partial', 'dispensed', 'cancelled', 'expired'],

  // Medication
  dosage: { amount, unit, frequency, duration, timing, withFood },
  tapering: { enabled, schedule: [...], totalDurationDays },
  applicationLocation: { eye: ['OD', 'OS', 'OU'], eyeArea, bodyPart },
  route: ['oral', 'ophthalmic', 'intravitreal', 'subconjunctival', ...],

  // Optical
  optical: {
    prescriptionType: ['glasses', 'contacts', 'both'],
    OD: { sphere, cylinder, axis, add, prism, base, baseCurve, diameter },
    OS: { ... },
    pupilDistance: { binocular, monocular: { OD, OS } },
    lensType, lensMaterial, lensCoatings: []
  },

  // Safety & Compliance
  safetyOverride: { overridden, reason, acknowledgedWarnings },
  priorAuthorization: { status, clinicalInfo, approval },
  ePrescription: { enabled, transmittedAt, sentTo }
}
```

### Feature Comparison

| Feature | StudioVision | MedFlow | Status |
|---------|-------------|---------|--------|
| **GLASSES PRESCRIPTION** |
| Auto-import from refraction | Yes | Yes | Equivalent |
| OD/OS fields | Complete | Complete | Equivalent |
| Prism prescription | Yes | Yes (prism, base) | Equivalent |
| Lens materials | Listed | `organic, mineral, polycarbonate, trivex` | Equivalent |
| Coatings | Checkboxes | Array field | Equivalent |
| PD (monocular/binocular) | Yes | `pupilDistance.monocular/binocular` | Equivalent |
| **MEDICATION PRESCRIPTION** |
| Drug database | Vidal (French) | BDPM, RxNorm, OpenFDA | **MedFlow SUPERIOR** |
| Favorite drugs | 10-15 buttons | Template-based | Equivalent |
| Eye-specific dosing | OD/OS/OU dropdown | `applicationLocation.eye` | Equivalent |
| Frequency options | QID, TID, BID, QD, QHS | `dosage.frequency` object | Equivalent |
| Duration | Days/Weeks/Months | `dosage.duration.unit` | Equivalent |
| **TAPERING SCHEDULES** | Not mentioned | Full support | **MedFlow SUPERIOR** |
| **Drug interactions** | Pop-up warning | `drugSafetyService` with severity levels | Equivalent |
| **Age-appropriate dosing** | Not mentioned | Pediatric/elderly checks | **MedFlow SUPERIOR** |
| **Pregnancy safety** | Not mentioned | FDA categories | **MedFlow SUPERIOR** |
| **Prior Authorization** | Not mentioned | Full workflow | **MedFlow SUPERIOR** |
| **E-Prescribing** | Not mentioned | NCPDP integration | **MedFlow SUPERIOR** |
| Generic substitution | Toggle | `substitutionAllowed` | Equivalent |
| Refills | Not detailed | `refills: { allowed, remaining }` | Equivalent |
| **PRINT/EXPORT** |
| "2-click" print | Emphasized | `printPrescription()` | Equivalent |
| Email to patient | Yes | Yes | Equivalent |
| Send to pharmacy | If integrated | E-prescribing + external dispatch | **MedFlow SUPERIOR** |

### MedFlow Advantages
- **Comprehensive Drug Safety**: Allergy, contraindication, interaction, age, pregnancy checks
- **Tapering Schedules**: Built-in for corticosteroids, opioids
- **Prior Authorization Workflow**: Full PA lifecycle management
- **E-Prescribing**: NCPDP network integration
- **External Pharmacy Dispatch**: Multi-channel (email, fax, API, SMS, portal)
- **Inventory Reservation**: Batch/lot tracking for dispensing

---

## 7. Device Integration

### StudioVision
- Real-time connection indicators
- Autorefractor support (Nidek ARK-1 mentioned)
- OCT device status
- Fundus camera status
- "Auto-import on exam completion" toggle

### MedFlow Device System

**Architecture:**
```
backend/services/
├── deviceIntegration/
│   └── DeviceIntegrationService.js
├── adapters/
│   ├── BaseAdapter.js
│   ├── AdapterFactory.js
│   ├── AutorefractorAdapter.js
│   ├── TonometryAdapter.js
│   └── OctAdapter.js
└── folderSyncService.js
```

**Models:**
- `Device.js` - Device registration and configuration
- `DeviceMeasurement.js` - Measurement data storage
- `DeviceImage.js` - Image storage with DICOM support
- `DeviceIntegrationLog.js` - Integration audit logging

**Frontend:**
- `DeviceManager.jsx` - Device management page

### Feature Comparison

| Feature | StudioVision | MedFlow | Status |
|---------|-------------|---------|--------|
| Autorefractor | Nidek ARK-1 | Generic adapter | Equivalent |
| Tonometer | Listed | `TonometryAdapter.js` | Equivalent |
| OCT | Listed | `OctAdapter.js` | Equivalent |
| Fundus Camera | Listed | Supported via adapters | Equivalent |
| DICOM Support | Not mentioned | `DeviceImage.js` | **MedFlow SUPERIOR** |
| Folder Sync | Not mentioned | `folderSyncService.js` | **MedFlow SUPERIOR** |
| Connection Status | Real-time indicators | DeviceManager | Equivalent |
| Auto-import Toggle | Yes | Per-device configuration | Equivalent |

---

## 8. Billing/Accounting

### StudioVision
- French 2035 tax form integration
- "Bill Patient" button on consultation screens
- Payment methods: Cash, Check, Credit Card, Third-party
- Feuille de Soins (French medical invoice)
- Télétransmission to Social Security

### MedFlow Billing System

**Backend:**
```
backend/controllers/billing/
├── claims.js
├── conventions.js
├── documents.js
├── feeSchedule.js
├── payments.js
├── paymentPlans.js
└── statistics.js
```

**Models:**
- `Invoice.js` - Comprehensive invoice management
- `FeeSchedule.js` - Service pricing
- `TaxConfig.js` - Tax calculations
- `PaymentPlan.js` - Installment plans
- `ConventionFeeSchedule.js` - Insurance conventions
- `Company.js` - Corporate billing

**Services:**
- `pdfGenerator.js` - Document generation
- `paymentGateway.js` - Payment processing

### Feature Comparison

| Feature | StudioVision | MedFlow | Status |
|---------|-------------|---------|--------|
| Invoice Generation | Yes | Comprehensive | Equivalent |
| Payment Methods | Cash, Check, Card, Third-party | Multiple gateways | Equivalent |
| Fee Schedules | Not detailed | `FeeSchedule.js` | Equivalent |
| Payment Plans | Not mentioned | `PaymentPlan.js` | **MedFlow SUPERIOR** |
| Convention Billing | Third-party payment | Full convention support | Equivalent |
| Tax Handling | 2035 form | `TaxConfig.js` | Equivalent |
| Claims Processing | Télétransmission | `claims.js` | Equivalent |
| PDF Generation | Yes | `pdfGenerator.js` | Equivalent |
| Corporate Billing | Not mentioned | `Company.js` | **MedFlow SUPERIOR** |

---

## 9. Summary: Gaps and Recommendations

### Critical Gaps (Require Action)

| Gap | StudioVision Has | MedFlow Missing | Priority |
|-----|-----------------|-----------------|----------|
| **Contact Lens Fitting Workflow** | Full fitting assessment, trial tracking | Only inventory management | **HIGH** |
| **Single-Screen Dashboard** | Core design philosophy | Collapsible sections only | **MEDIUM** |
| **LOCS III Cataract Grading** | Visual reference images | Text-only grading | **MEDIUM** |
| **Voice-to-Text** | Clinical notes | Not implemented | **LOW** |

### MedFlow Superiority Areas

| Feature | MedFlow Advantage |
|---------|-------------------|
| **Drug Safety** | Multi-source API integration (BDPM, RxNorm, OpenFDA) |
| **AI Diagnostics** | DR grading, GPA, RNFL analysis services |
| **Clinical Alerts** | Proactive alert system for critical findings |
| **Prior Authorization** | Full PA workflow management |
| **E-Prescribing** | NCPDP network integration |
| **Payment Plans** | Installment billing support |
| **Face Recognition** | Biometric patient verification |
| **DICOM Support** | Native imaging standard support |

### Recommended Enhancements

1. **Contact Lens Module** (Priority: HIGH)
   - Create `ContactLensFitting.jsx` with fitting assessment grid
   - Add patient CL history form
   - Implement trial lens tracking with barcode
   - Auto-schedule follow-up appointments

2. **Dashboard View Toggle** (Priority: MEDIUM)
   - Add "Compact View" option for PatientDetail
   - Single-screen mode showing VA, Refraction, IOP, Diagnoses
   - Quick action column

3. **Cataract Grading Component** (Priority: MEDIUM)
   - LOCS III visual grading scale
   - Reference images for each grade
   - Auto-calculate visual impact

4. **Voice-to-Text** (Priority: LOW)
   - Browser Web Speech API integration
   - Clinical notes dictation
   - Consider privacy implications

---

## 10. Design Principles Comparison

### StudioVision Philosophy
- **Efficiency over flexibility**: Fixed layout, optimized for speed
- **Everything visible**: No scrolling, single-screen approach
- **Muscle memory**: Extensive keyboard shortcuts
- **Pre-configured**: Doctor customizes once, uses consistently

### MedFlow Philosophy
- **Comprehensive over compact**: Full data capture, detailed forms
- **Workflow-guided**: Step-by-step processes
- **Role-based**: Different views per user type
- **Safety-first**: Drug interactions, clinical alerts, audit logging

### Recommendation
MedFlow's approach is more appropriate for:
- Multi-specialty clinics (beyond pure ophthalmology)
- Regulatory compliance (HIPAA, GDPR)
- Complex billing scenarios (conventions, payment plans)
- AI-assisted diagnostics

Consider offering a "StudioVision Mode" preference that:
- Condenses PatientDetail into single-screen view
- Shows quick action buttons prominently
- Emphasizes keyboard navigation

---

*Document generated: 2025-12-12*
*Analysis based on StudioVision documentation and MedFlow codebase exploration*
