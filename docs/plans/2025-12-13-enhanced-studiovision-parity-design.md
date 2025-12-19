# Enhanced StudioVision Parity Implementation Design

**Date:** 2025-12-13
**Status:** Draft - Enhanced Version
**Supersedes:** 2025-12-13-critical-gaps-implementation-design.md

---

## Executive Summary

After analyzing the ultra-detailed StudioVision specification, this enhanced design expands our original scope significantly. The detailed breakdown reveals StudioVision's strength lies not just in individual features, but in its **holistic workflow optimization** - every click is minimized, every field is intelligently pre-filled, and efficiency is paramount.

### Original vs Enhanced Scope

| Original Design | Enhanced Design (This Document) |
|-----------------|--------------------------------|
| Contact Lens Fitting (basic) | Contact Lens Fitting (full 4-tab) |
| Compact Dashboard | Three-Column Dashboard with Alerts |
| LOCS III Grading | LOCS III + Visual Axis Wheel |
| Voice-to-Text (deferred) | Still deferred |
| - | **NEW:** Favorite Medications Panel |
| - | **NEW:** Treatment Protocol Templates |
| - | **NEW:** Patient Medication Schedule |
| - | **NEW:** Real-time Drug Interaction Checker |
| - | **NEW:** Device Integration Floating Panel |
| - | **NEW:** "2-Click" Workflow Optimization |

---

## PART 1: CONTACT LENS FITTING - ENHANCED

### 1.1 Four-Tab Architecture (StudioVision Parity)

StudioVision uses 4 distinct tabs. Our original design combined these. Enhanced structure:

```
┌────────────────────────────────────────────────────────────────┐
│  [ HISTORIQUE ]  [ PARAMÈTRES ]  [ ENTRETIEN ]  [ SUIVI ]     │
│    History         Fitting         Care           Follow-up    │
└────────────────────────────────────────────────────────────────┘
```

**Tab 1: PATIENT HISTORY (HISTORIQUE)**

This was partially in our design but needs expansion:

```javascript
// Enhanced wearingHistory schema
wearingHistory: {
  isWearer: Boolean,
  yearsWearing: Number,
  schedule: ['daily', 'extended', 'occasional', 'ortho_k'],
  frequency: ['daily_disposable', 'biweekly', 'monthly', 'quarterly', 'annual'],

  // NEW: Compliance with star rating (StudioVision feature)
  compliance: {
    rating: { type: Number, min: 1, max: 5 },  // Star rating
    notes: String
  },

  currentBrand: String,
  currentParameters: {
    OD: { sphere, cylinder, axis, baseCurve, diameter },
    OS: { sphere, cylinder, axis, baseCurve, diameter }
  },

  // NEW: Current issues checklist (StudioVision feature)
  currentIssues: [{
    type: {
      type: String,
      enum: [
        'dryness', 'redness', 'irritation', 'blurry_vision',
        'halos_glare', 'difficult_insertion', 'difficult_removal',
        'discomfort_after_6hrs', 'lens_decentration', 'none'
      ]
    },
    severity: ['mild', 'moderate', 'severe']
  }]
}
```

**Tab 2: FITTING PARAMETERS (PARAMÈTRES)**

Our original design covers this well. Add:

```javascript
// Enhanced fitting assessment
assessment: {
  OD: {
    // Original fields...
    centration, centrationDirection, movement, coverage, comfort, visionQuality,

    // NEW: Over-refraction (StudioVision feature)
    overRefraction: {
      needed: Boolean,
      sphere: Number,
      cylinder: Number,
      axis: Number,
      finalPower: Number  // Auto-calculated
    },

    // NEW: Fluorescein pattern for RGP (StudioVision feature)
    fluoresceinPattern: {
      type: String,
      enum: ['alignment', 'apical_clearance', 'apical_bearing', 'three_point_touch']
    },
    fluoresceinImageId: ObjectId  // Link to captured image
  },
  OS: { /* same */ }
}
```

**Tab 3: CARE & SUPPLIES (ENTRETIEN)** - NEW TAB

```javascript
// New schema section
careInstructions: {
  solutionType: {
    type: String,
    enum: ['multipurpose', 'hydrogen_peroxide', 'saline', 'rgp_solution', 'not_applicable']
  },
  solutionBrand: String,
  solutionQuantity: Number,  // Bottles prescribed

  // NEW: Annual supply calculator (StudioVision feature)
  annualSupply: {
    wearingDaysPerWeek: { type: Number, default: 7 },
    boxesNeeded: {
      OD: Number,  // Auto-calculated
      OS: Number
    },
    totalBoxes: Number,
    addToPrescription: Boolean
  },

  specialInstructions: String,

  // NEW: Rebate tracking (StudioVision feature)
  rebateInfo: {
    available: Boolean,
    amount: Number,
    manufacturerProgram: String,
    expirationDate: Date
  }
}
```

**Tab 4: FOLLOW-UP & EDUCATION (SUIVI)** - NEW TAB

```javascript
// New schema section
followUp: {
  fittingStatus: {
    type: String,
    enum: ['initial', 'refit', 'routine']
  },

  recommendedIntervals: {
    firstFollowUp: { type: String, default: '1-2 weeks' },
    secondFollowUp: { type: String, default: '1 month' },
    annualExam: { type: String, default: '12 months' }
  },

  // NEW: Patient education checklist (StudioVision feature)
  educationChecklist: {
    insertionRemovalDemo: { completed: Boolean, date: Date },
    cleaningStorageInstructions: { completed: Boolean, date: Date },
    wearingScheduleDiscussed: { completed: Boolean, date: Date },
    complicationSignsReviewed: { completed: Boolean, date: Date },
    emergencyContactProvided: { completed: Boolean, date: Date },
    replacementScheduleEmphasized: { completed: Boolean, date: Date },
    writtenInstructionsGiven: { completed: Boolean, date: Date },
    patientDemonstratedSkill: { completed: Boolean, date: Date }
  },

  educationNotes: String
}
```

### 1.2 Enhanced UI Components

**New File: `PatientEducationChecklist.jsx`**

```
┌─────────────────────────────────────────────────────────────────┐
│  PATIENT EDUCATION CHECKLIST                                    │
├─────────────────────────────────────────────────────────────────┤
│  Topics covered with patient:                                   │
│                                                                 │
│  [✓] Insertion and removal technique demonstrated              │
│  [✓] Cleaning and storage instructions provided                │
│  [✓] Wearing schedule discussed (hours per day)                │
│  [ ] Signs of complications reviewed                            │
│  [ ] Emergency contact information provided                     │
│  [ ] Replacement schedule emphasized                            │
│  [ ] Written instructions given                                 │
│  [ ] Patient demonstrated successful insertion/removal          │
│                                                                 │
│  Progress: ████████░░ 6/8 complete                             │
│                                                                 │
│  Notes: [_________________________________________]             │
└─────────────────────────────────────────────────────────────────┘
```

**New File: `AnnualSupplyCalculator.jsx`**

```
┌─────────────────────────────────────────────────────────────────┐
│  ANNUAL SUPPLY CALCULATOR                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Replacement: Daily Disposable (from fitting)                   │
│                                                                 │
│  Wearing days per week: [ 7 ▼ ]                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ANNUAL SUPPLY NEEDED:                                   │   │
│  │                                                          │   │
│  │  OD: 12 boxes (360 lenses @ 30/box)                     │   │
│  │  OS: 12 boxes (360 lenses @ 30/box)                     │   │
│  │  ──────────────────────────────────────                  │   │
│  │  TOTAL: 24 boxes                                         │   │
│  │                                                          │   │
│  │  Estimated Cost: €480 - €720                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [✓] Add annual supply to prescription                         │
│                                                                 │
│  💰 Rebate Available: €80 off (Acuvue MyWay program)           │
│     [Check Rebates] [Apply to Order]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PART 2: THREE-COLUMN DASHBOARD - ENHANCED

### 2.1 StudioVision Layout Analysis

StudioVision uses a precise **three-column layout**:
- **Left (25%)**: Navigation + Quick Actions + Alerts + Document Archive
- **Center (50%)**: Clinical Data (VA, Refraction, IOP, Diagnoses, Medications)
- **Right (25%)**: Quick Print Actions + Device Status + Scheduling + Notes

### 2.2 Enhanced Compact Dashboard Design

Our original design showed a 2×2 grid. Enhanced to match StudioVision's three-column:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Photo] Jean Dupont #12345 │ 52 ans, M │ Last: 15/11/2025  [Toggle View]  │
├──────────────────┬─────────────────────────────────┬───────────────────────┤
│                  │                                 │                       │
│ NAVIGATION       │ CLINICAL SUMMARY                │ QUICK ACTIONS         │
│ ────────────     │ ────────────────                │ ─────────────         │
│                  │                                 │                       │
│ [Recent Patients]│ ┌─ VISUAL ACUITY ─────────────┐│ [📋 New Rx     ]      │
│ • Dupont, J      │ │     │ OD    │ OS    │ Date  ││ [🖨️ Print      ]      │
│ • Martin, P      │ │ Far │ 20/20 │ 20/25 │ 12/12 ││ [📅 Schedule   ]      │
│ • Bernard, L     │ │ Near│ J2    │ J2    │       ││ [✉️ Letter     ]      │
│                  │ └─────────────────────────────┘│                       │
│ ──────────────── │                                 │ DEVICE STATUS         │
│                  │ ┌─ REFRACTION ─────────────────┐│ ─────────────         │
│ QUICK ACCESS     │ │     │ OD     │ OS     │      ││ 🟢 Nidek ARK-1       │
│ [New Consult   ] │ │ Sph │ -2.50  │ -2.25  │      ││    [Capture Now]     │
│ [View Imaging  ] │ │ Cyl │ -0.75  │ -0.50  │      ││ 🟢 Zeiss OCT         │
│ [Print Summary ] │ │ Axis│ 180    │ 175    │      ││    [Import Images]   │
│ [Schedule Appt ] │ │ Add │ +1.50  │ +1.50  │      ││ 🔴 Topcon Camera     │
│ [Generate Letter]│ └─────────────────────────────┘│    [Reconnect]       │
│                  │                                 │                       │
│ ──────────────── │ ┌─ IOP ────────────────────────┐│ ──────────────────── │
│                  │ │ OD: 14 mmHg  📈 [Trend]     ││                       │
│ ALERTS           │ │ OS: 15 mmHg                  ││ NEXT APPOINTMENT     │
│ ────────         │ │ Method: Goldmann             ││ 📅 15/01/2026 14:30  │
│ ⚠️ Allergies:    │ └─────────────────────────────┘│ Type: IOP Follow-up  │
│   Penicillin     │                                 │ [Reschedule][Cancel] │
│                  │ ┌─ DIAGNOSES ──────────────────┐│                       │
│ ℹ️ Follow-up     │ │ 🔴 Glaucoma POAG (H40.11)   ││ ──────────────────── │
│   overdue 2mo    │ │    Target IOP: 12-14 mmHg   ││                       │
│                  │ │ 🟠 Cataract NO3 (H25.1)     ││ TODAY'S NOTES         │
│ ✓ All results    │ │ 🟢 Dry Eye (H04.12)         ││ [                   ] │
│   received       │ └─────────────────────────────┘│ [                   ] │
│                  │                                 │ [🎤 Voice]           │
│ ──────────────── │ ┌─ MEDICATIONS ────────────────┐│                       │
│                  │ │ 💧 Latanoprost 0.005% OU QHS││ Last saved: 30s ago  │
│ DOCUMENT ARCHIVE │ │    Refills: 2 remaining     ││                       │
│ ► Prescriptions  │ │ 💧 Timolol 0.5% OU BID      ││                       │
│ ► Imaging        │ │    Refills: 3 remaining     ││                       │
│ ► Lab Results    │ │ [+ Add Medication]          ││                       │
│ ► Surgery Reports│ └─────────────────────────────┘│                       │
│                  │                                 │                       │
└──────────────────┴─────────────────────────────────┴───────────────────────┘
```

### 2.3 New Components Needed

**File Structure:**
```
frontend/src/components/dashboard/
├── PatientCompactDashboard.jsx      # Main container (enhanced)
├── NavigationColumn.jsx              # Left column
├── ClinicalSummaryColumn.jsx         # Center column
├── ActionsColumn.jsx                 # Right column
├── AlertsBanner.jsx                  # NEW: Color-coded alerts
├── DeviceStatusPanel.jsx             # NEW: Real-time device status
├── RecentPatientsList.jsx            # NEW: Quick patient switching
├── DocumentArchiveTree.jsx           # NEW: Folder tree for documents
├── QuickNotesPanel.jsx               # NEW: With voice-to-text button
└── MedicationSummaryCard.jsx         # NEW: Current meds with refills
```

### 2.4 Alerts Banner System (NEW)

StudioVision has color-coded alert banners. New component:

```javascript
// AlertsBanner.jsx
const ALERT_TYPES = {
  allergy: {
    icon: '⚠️',
    background: '#FFEBEE',  // Light red
    border: '#F44336',
    label: 'Allergies'
  },
  reminder: {
    icon: 'ℹ️',
    background: '#FFF9E6',  // Light yellow
    border: '#FFC107',
    label: 'Reminder'
  },
  success: {
    icon: '✓',
    background: '#E6FFE6',  // Light green
    border: '#4CAF50',
    label: 'Info'
  },
  urgent: {
    icon: '🚨',
    background: '#FFCDD2',  // Red
    border: '#D32F2F',
    label: 'Urgent'
  }
};

// Schema addition for patient alerts
patientAlerts: [{
  type: { type: String, enum: ['allergy', 'reminder', 'success', 'urgent'] },
  message: String,
  createdAt: Date,
  dismissedAt: Date,
  autoGenerated: Boolean,  // System-generated vs manual
  sourceType: String,  // 'allergy', 'overdue_followup', 'lab_result', etc.
  sourceId: ObjectId
}]
```

---

## PART 3: PRESCRIPTION MODULE ENHANCEMENTS

This is where the detailed spec reveals the most improvement opportunities.

### 3.1 Favorite Medications Panel (NEW - HIGH PRIORITY)

StudioVision's "Favoris" panel with 10-15 quick buttons is a **major efficiency feature**.

**New Schema: `UserPreferences.favoritemedications`**

```javascript
// Add to User.js preferences
preferences: {
  // ... existing

  favoriteMedications: [{
    drugId: { type: Schema.Types.ObjectId, ref: 'Drug' },
    drugName: String,
    genericName: String,
    icon: String,  // '💧', '💊', '💉', '🧴'
    defaultDosage: {
      eye: { type: String, enum: ['OD', 'OS', 'OU'], default: 'OU' },
      frequency: { type: String, default: 'BID' },
      duration: { value: Number, unit: String },
      instructions: String
    },
    position: Number,  // Order in favorites bar
    color: String  // For visual distinction
  }],

  // Limit to 15 favorites per user
  maxFavorites: { type: Number, default: 15 }
}
```

**New Component: `FavoriteMedicationsBar.jsx`**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ MÉDICAMENTS FAVORIS                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ [💧Latanoprost] [💧Timolol] [💧Bimatoprost] [💧Prednisolone] [💧Tobramycine]│
│ [💧Levofloxacine] [💧Larmes art.] [💧Dexamethasone] [+ Add Favorite]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Single click → Adds medication to prescription with default dosage
- Right-click → Context menu (Remove, Edit defaults, Move position)
- Drag-and-drop → Reorder favorites
- "Add Favorite" → Search modal to add new favorite

### 3.2 Treatment Protocol Templates (NEW - HIGH PRIORITY)

StudioVision has 25+ pre-configured treatment protocols. This is essential for workflow efficiency.

**New Model: `TreatmentProtocol.js`**

```javascript
const TreatmentProtocolSchema = new Schema({
  name: { type: String, required: true },
  nameFr: String,  // French name
  category: {
    type: String,
    enum: [
      'glaucoma', 'post_surgical', 'infection',
      'inflammation', 'injection', 'allergy', 'dry_eye'
    ]
  },
  description: String,

  medications: [{
    drugId: { type: Schema.Types.ObjectId, ref: 'Drug' },
    drugName: String,
    genericName: String,

    // Default prescription values
    dosage: {
      eye: { type: String, default: 'OU' },
      frequency: String,
      frequencyCode: String,  // 'QD', 'BID', 'TID', 'QID'
      timing: [String],  // ['morning', 'evening', 'bedtime']
      duration: {
        value: Number,
        unit: { type: String, enum: ['days', 'weeks', 'months', 'continuous'] }
      }
    },

    // Tapering schedule if applicable
    taper: {
      enabled: Boolean,
      schedule: [{
        week: Number,
        frequency: String,
        instructions: String
      }]
    },

    quantity: Number,
    instructions: String,
    orderInProtocol: Number  // Display order
  }],

  // Protocol metadata
  isSystemProtocol: { type: Boolean, default: true },  // vs user-created
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic' },

  // Usage tracking
  usageCount: { type: Number, default: 0 },
  lastUsed: Date
}, { timestamps: true });
```

**Seed Data: Standard Protocols**

```javascript
const STANDARD_PROTOCOLS = [
  // GLAUCOMA
  {
    name: 'Glaucoma Monotherapy - Prostaglandin',
    nameFr: 'Glaucome monothérapie - Prostaglandine',
    category: 'glaucoma',
    medications: [
      { drugName: 'Latanoprost 0.005%', frequency: 'QD', timing: ['bedtime'], duration: { value: 3, unit: 'months' } }
    ]
  },
  {
    name: 'Glaucoma Dual Therapy',
    nameFr: 'Glaucome bithérapie',
    category: 'glaucoma',
    medications: [
      { drugName: 'Latanoprost 0.005%', frequency: 'QD', timing: ['bedtime'] },
      { drugName: 'Timolol 0.5%', frequency: 'BID', timing: ['morning', 'evening'] }
    ]
  },

  // POST-SURGICAL
  {
    name: 'Post-Cataract Surgery Standard',
    nameFr: 'Post-opératoire cataracte standard',
    category: 'post_surgical',
    medications: [
      {
        drugName: 'Prednisolone Acetate 1%',
        frequency: 'QID',
        duration: { value: 2, unit: 'weeks' },
        taper: {
          enabled: true,
          schedule: [
            { week: 1, frequency: 'QID', instructions: '4 fois par jour' },
            { week: 2, frequency: 'TID', instructions: '3 fois par jour' },
            { week: 3, frequency: 'BID', instructions: '2 fois par jour' },
            { week: 4, frequency: 'QD', instructions: '1 fois par jour puis arrêt' }
          ]
        }
      },
      { drugName: 'Moxifloxacin 0.5%', frequency: 'QID', duration: { value: 1, unit: 'weeks' } }
    ]
  },
  {
    name: 'Post-Injection Prophylaxis',
    nameFr: 'Prophylaxie post-injection',
    category: 'injection',
    medications: [
      { drugName: 'Ofloxacin 0.3%', frequency: 'QID', duration: { value: 3, unit: 'days' }, instructions: 'Commencer le soir de l\'injection' }
    ]
  },

  // INFECTION
  {
    name: 'Bacterial Conjunctivitis',
    nameFr: 'Conjonctivite bactérienne',
    category: 'infection',
    medications: [
      { drugName: 'Tobramycin 0.3%', frequency: 'QID', duration: { value: 7, unit: 'days' } }
    ]
  },
  {
    name: 'Corneal Ulcer - Aggressive',
    nameFr: 'Ulcère cornéen - Traitement intensif',
    category: 'infection',
    medications: [
      { drugName: 'Fortified Tobramycin 14mg/ml', frequency: 'Q1H', duration: { value: 48, unit: 'hours' }, instructions: 'Toutes les heures, jour et nuit x48h' },
      { drugName: 'Fortified Cefazolin 50mg/ml', frequency: 'Q1H', duration: { value: 48, unit: 'hours' }, instructions: 'Alterner avec Tobramycine' }
    ]
  },

  // INFLAMMATION
  {
    name: 'Anterior Uveitis - Initial',
    nameFr: 'Uvéite antérieure - Traitement initial',
    category: 'inflammation',
    medications: [
      { drugName: 'Prednisolone Acetate 1%', frequency: 'Q1H', instructions: 'Toutes les heures pendant éveil' },
      { drugName: 'Cyclopentolate 1%', frequency: 'TID', instructions: 'Pour cycloplégie' }
    ]
  },
  {
    name: 'Anterior Uveitis - Steroid Taper',
    nameFr: 'Uvéite antérieure - Décroissance corticoïdes',
    category: 'inflammation',
    medications: [
      {
        drugName: 'Prednisolone Acetate 1%',
        taper: {
          enabled: true,
          schedule: [
            { week: 1, frequency: 'Q2H', instructions: 'Toutes les 2 heures' },
            { week: 2, frequency: 'QID', instructions: '4 fois par jour' },
            { week: 3, frequency: 'TID', instructions: '3 fois par jour' },
            { week: 4, frequency: 'BID', instructions: '2 fois par jour' },
            { week: 5, frequency: 'QD', instructions: '1 fois par jour' },
            { week: 6, frequency: 'QOD', instructions: '1 jour sur 2 puis arrêt' }
          ]
        }
      }
    ]
  },

  // DRY EYE
  {
    name: 'Dry Eye - Comprehensive',
    nameFr: 'Sécheresse oculaire - Traitement complet',
    category: 'dry_eye',
    medications: [
      { drugName: 'Artificial Tears (preservative-free)', frequency: 'QID', duration: { unit: 'continuous' }, instructions: 'Au minimum 4 fois par jour, plus si nécessaire' },
      { drugName: 'Gel lubrifiant', frequency: 'QHS', duration: { unit: 'continuous' }, instructions: 'Au coucher' }
    ]
  },

  // ALLERGY
  {
    name: 'Allergic Conjunctivitis - Seasonal',
    nameFr: 'Conjonctivite allergique saisonnière',
    category: 'allergy',
    medications: [
      { drugName: 'Olopatadine 0.1%', frequency: 'BID', instructions: 'Matin et soir pendant la saison allergique' }
    ]
  }
];
```

**New Component: `TreatmentProtocolSelector.jsx`**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📋 USE TREATMENT PROTOCOL                                      [Expand ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Category: [ All ▼ ]                                                        │
│                                                                             │
│  ┌─ GLAUCOMA ───────────────────────────────────────────────────────────┐  │
│  │ • Glaucoma Monotherapy - Prostaglandin                               │  │
│  │ • Glaucoma Dual Therapy                                              │  │
│  │ • Glaucoma Triple Therapy                                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ POST-SURGICAL ──────────────────────────────────────────────────────┐  │
│  │ • Post-Cataract Surgery Standard                                     │  │
│  │ • Post-Glaucoma Surgery                                              │  │
│  │ • Post-Vitrectomy                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Select protocol → Auto-fills all medications with standard dosing          │
│                                                                             │
│  [⚙️ Create Custom Protocol]  [📝 Edit Protocol]                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Patient Medication Schedule Generator (NEW)

StudioVision generates a patient-friendly printable schedule. This is excellent for compliance.

**New Component: `MedicationScheduleGenerator.jsx`**

**Output Format:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VOTRE PROGRAMME DE GOUTTES                               │
│                    YOUR EYE DROP SCHEDULE                                   │
│                                                                             │
│  Patient: Jean Dupont                         Date: 12/12/2025             │
│  Médecin: Dr. Martin                          Tél: 01 23 45 67 89          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ☀️ MATIN (8h00)                                                            │
│  ─────────────────                                                          │
│  💧 Timolol 0.5% - 1 goutte dans chaque œil                                │
│                                                                             │
│  ⏳ Attendre 5 minutes                                                      │
│                                                                             │
│  💧 Prednisolone 1% - 1 goutte dans chaque œil                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ☀️ MIDI (12h00)                                                            │
│  ─────────────                                                              │
│  💧 Prednisolone 1% - 1 goutte dans chaque œil                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🌆 SOIR (18h00)                                                            │
│  ──────────────                                                             │
│  💧 Timolol 0.5% - 1 goutte dans chaque œil                                │
│                                                                             │
│  ⏳ Attendre 5 minutes                                                      │
│                                                                             │
│  💧 Prednisolone 1% - 1 goutte dans chaque œil                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🌙 COUCHER (22h00)                                                         │
│  ─────────────────                                                          │
│  💧 Latanoprost 0.005% - 1 goutte dans chaque œil                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚠️ RAPPELS IMPORTANTS:                                                     │
│  • Attendre 5 minutes entre chaque goutte                                   │
│  • Ne pas toucher l'embout du flacon                                        │
│  • Fermer les yeux 2 minutes après chaque goutte                            │
│  • Appuyer légèrement sur le coin interne de l'œil                          │
│                                                                             │
│  📞 En cas de problème: 01 23 45 67 89                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Real-Time Drug Interaction Checker (ENHANCED)

Our current `drugSafetyService.js` exists but needs real-time UI integration.

**New Component: `DrugInteractionPanel.jsx`**

```
┌─────────────────────────────────────────────────────────────────┐
│ DRUG INTERACTIONS                                    [Collapse] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ No interactions detected                                     │
│                                                                 │
│ ─── OR ───                                                      │
│                                                                 │
│ ⚠️ 2 INTERACTIONS DETECTED                                      │
│                                                                 │
│ ┌─ MINOR ───────────────────────────────────────────────────┐  │
│ │ Timolol + Latanoprost                                     │  │
│ │ Both are glaucoma medications. Additive effect expected.  │  │
│ │ Clinical significance: Low                                │  │
│ │ [View Details]                                            │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ MAJOR ───────────────────────────────────────────────────┐  │
│ │ 🚨 Prednisolone + Ketorolac (NSAID)                       │  │
│ │ Increased risk of corneal melting with concurrent use.   │  │
│ │ RECOMMENDATION: Avoid combining or separate by 10 min    │  │
│ │ Clinical significance: HIGH                               │  │
│ │ [View Details] [Override - Doctor Aware]                  │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Real-time behavior:**
- Panel updates automatically as medications are added/removed
- Checks against:
  - Other medications in current prescription
  - Patient's existing active medications
  - Patient's allergies
- Color-coded severity: Green (none), Yellow (minor), Orange (moderate), Red (major)

---

## PART 4: REFRACTION MODULE ENHANCEMENTS

### 4.1 Visual Axis Wheel Selector (NEW)

StudioVision has a visual axis wheel for selecting cylinder axis. This is more intuitive than numeric input.

**New Component: `AxisWheelSelector.jsx`**

```
                    90°
                     |
                     |
         135° ───────┼─────── 45°
                    /|\
                   / | \
                  /  |  \
       180° ─────┼───┼───┼───── 0°
                  \  |  /
                   \ | /
                    \|/
         135° ───────┼─────── 45°
                     |
                     |
                    90°

        Selected: 175° [Apply]
```

**Features:**
- Click anywhere on the semicircle to select angle
- Drag handle for fine adjustment
- Current selection highlighted with blue marker
- Real-time display of selected angle
- Click "Apply" or press Enter to confirm

### 4.2 Device Integration Floating Panel (NEW)

StudioVision has a floating panel showing device status with "Capture Now" button.

**New Component: `DeviceIntegrationFloatingPanel.jsx`**

```
┌─────────────────────────────────────┐
│ 🟢 Nidek ARK-1 Connected           │
│ Last measurement: 14:32:15          │
│                                     │
│ [📡 CAPTURE NOW]                    │
│                                     │
│ [ ] Show Live Feed                  │
│                                     │
│ Auto-import: [ON]                   │
└─────────────────────────────────────┘
```

**Position:** Fixed, top-right corner of Refraction module
**Behavior:**
- Shows real-time connection status
- "Capture Now" triggers device measurement
- Live feed option shows real-time values updating
- Auto-import toggle for automatic data capture

---

## PART 5: "2-CLICK" WORKFLOW OPTIMIZATION

StudioVision emphasizes "2 clicks to prescription" as a core feature. We need to audit our workflows.

### 5.1 Current Click Count Analysis

**Glasses Prescription (Current MedFlow):**
1. Open patient file
2. Navigate to Prescriptions section
3. Click "New Prescription"
4. Select "Optical" type
5. Enter OD values
6. Enter OS values
7. Select lens type
8. Select coatings
9. Click "Save"
10. Click "Print"
**Total: ~10 clicks**

**StudioVision Target: 2 clicks**

### 5.2 Optimized Workflow Design

**Glasses Prescription (Optimized):**
1. Click "📋 New Rx" quick action button (auto-imports refraction data)
2. Click "🖨️ Print" (saves and prints)
**Total: 2 clicks**

**Implementation Requirements:**

1. **Quick Action Button** on dashboard
2. **Auto-import** from latest refraction (no manual entry)
3. **Smart defaults** for lens type/coatings based on:
   - Patient age (progressive for >45)
   - Prescription strength (high-index for |SPH| > 4)
   - Previous preferences
4. **Combined Save+Print** action

### 5.3 "2-Click Badge" UI Element

Add visual badge to emphasize efficiency:

```jsx
// BadgeClickCount.jsx
<span className="
  absolute top-0 right-0
  bg-orange-500 text-white text-xs font-bold
  px-2 py-0.5 rounded-full
  animate-pulse
">
  2 CLICS
</span>
```

---

## PART 6: ENHANCED FILE STRUCTURE

### 6.1 New Files Summary

```
frontend/src/
├── components/
│   ├── dashboard/
│   │   ├── PatientCompactDashboard.jsx        # Enhanced 3-column
│   │   ├── NavigationColumn.jsx               # NEW
│   │   ├── ClinicalSummaryColumn.jsx          # NEW
│   │   ├── ActionsColumn.jsx                  # NEW
│   │   ├── AlertsBanner.jsx                   # NEW
│   │   ├── DeviceStatusPanel.jsx              # NEW
│   │   ├── RecentPatientsList.jsx             # NEW
│   │   ├── DocumentArchiveTree.jsx            # NEW
│   │   ├── QuickNotesPanel.jsx                # NEW
│   │   └── MedicationSummaryCard.jsx          # NEW
│   │
│   ├── prescription/
│   │   ├── FavoriteMedicationsBar.jsx         # NEW
│   │   ├── TreatmentProtocolSelector.jsx      # NEW
│   │   ├── MedicationScheduleGenerator.jsx    # NEW
│   │   ├── DrugInteractionPanel.jsx           # NEW (enhanced)
│   │   └── TwoClickBadge.jsx                  # NEW
│   │
│   ├── refraction/
│   │   ├── AxisWheelSelector.jsx              # NEW
│   │   └── DeviceIntegrationFloatingPanel.jsx # NEW
│   │
│   ├── contactLens/
│   │   ├── PatientEducationChecklist.jsx      # NEW
│   │   ├── AnnualSupplyCalculator.jsx         # NEW
│   │   └── RebateLookup.jsx                   # NEW
│   │
│   └── grading/
│       ├── LOCSGradingPanel.jsx               # From original design
│       ├── LOCSImageGrid.jsx                  # From original design
│       └── locsIllustrations/*.svg            # 24 SVG files
│
├── pages/
│   ├── ContactLensFitting/
│   │   ├── index.jsx                          # 4-tab container
│   │   ├── tabs/
│   │   │   ├── HistoryTab.jsx                 # NEW
│   │   │   ├── FittingTab.jsx                 # Enhanced
│   │   │   ├── CareTab.jsx                    # NEW
│   │   │   └── FollowUpTab.jsx                # NEW
│   │   └── components/
│   │       ├── FittingAssessmentGrid.jsx
│   │       └── TrialLensDispenser.jsx
│
├── hooks/
│   ├── useViewPreference.js                   # From original
│   ├── useFavoriteMedications.js              # NEW
│   ├── useTreatmentProtocols.js               # NEW
│   └── useDrugInteractions.js                 # NEW
│
└── services/
    ├── treatmentProtocolService.js            # NEW
    └── medicationScheduleService.js           # NEW

backend/
├── models/
│   ├── TreatmentProtocol.js                   # NEW
│   └── (existing models enhanced)
│
├── controllers/
│   ├── treatmentProtocolController.js         # NEW
│   └── medicationScheduleController.js        # NEW
│
├── scripts/
│   └── seedTreatmentProtocols.js              # NEW
│
└── routes/
    └── treatmentProtocols.js                  # NEW
```

### 6.2 Modified Files Summary

```
backend/models/
├── OphthalmologyExam.js       # Add enhanced contactLensFitting + locsGrading
├── User.js                    # Add preferences (viewPreference, favoriteMedications)
├── ContactLensInventory.js    # Add isTrial flag
└── Patient.js                 # Add patientAlerts array

frontend/src/pages/
├── PatientDetail/index.jsx    # Add view toggle + 3-column support
├── ophthalmology/components/
│   ├── OphthalmologyExamStep.jsx  # Add LOCS panel + axis wheel
│   └── ContactLensFittingStep.jsx # Enhanced 4-tab version
└── Prescriptions.jsx          # Add favorites bar + protocols + interactions
```

---

## PART 7: IMPLEMENTATION PHASES (REVISED)

### Phase 1: Foundation (Week 1)
**Goal:** Core infrastructure for enhanced features

1. TreatmentProtocol model + seed data
2. User preferences schema (favorites, view)
3. Enhanced OphthalmologyExam schema
4. Basic API endpoints

### Phase 2: Prescription Efficiency (Week 2)
**Goal:** "2-click" prescription workflow

1. FavoriteMedicationsBar component
2. TreatmentProtocolSelector component
3. DrugInteractionPanel (real-time)
4. Quick action buttons on dashboard
5. Auto-import from refraction

### Phase 3: Contact Lens Complete (Week 3)
**Goal:** Full 4-tab contact lens module

1. 4-tab container structure
2. HistoryTab with issues checklist
3. CareTab with supply calculator
4. FollowUpTab with education checklist
5. Trial lens inventory integration

### Phase 4: Dashboard Enhancement (Week 4)
**Goal:** Three-column StudioVision-style dashboard

1. NavigationColumn (recent patients, quick access)
2. ClinicalSummaryColumn (VA, Refraction, IOP, Diagnoses)
3. ActionsColumn (quick print, device status, notes)
4. AlertsBanner system
5. View toggle + preference persistence

### Phase 5: Visual Components (Week 5)
**Goal:** LOCS III + Refraction enhancements

1. 24 LOCS III SVG illustrations
2. LOCSGradingPanel + LOCSImageGrid
3. AxisWheelSelector
4. DeviceIntegrationFloatingPanel

### Phase 6: Patient Tools (Week 6)
**Goal:** Patient-facing outputs

1. MedicationScheduleGenerator
2. Print schedule as PDF
3. Education checklist printout
4. Enhanced prescription printout

---

## PART 8: SUCCESS METRICS

### Workflow Efficiency Targets

| Action | Current Clicks | Target Clicks | Improvement |
|--------|---------------|---------------|-------------|
| New glasses Rx | ~10 | 2 | 80% reduction |
| New medication Rx | ~8 | 3 | 63% reduction |
| Add favorite drug | ~6 | 1 | 83% reduction |
| Apply protocol | ~12 | 2 | 83% reduction |
| CL fitting complete | ~15 | ~10 | 33% reduction |
| View patient summary | ~4 | 1 | 75% reduction |

### Feature Parity Score

| Category | StudioVision Features | MedFlow Current | MedFlow Enhanced |
|----------|----------------------|-----------------|------------------|
| Dashboard | 100% | 40% | 95% |
| Refraction | 100% | 75% | 95% |
| Contact Lens | 100% | 30% | 90% |
| Pathology | 100% | 70% | 90% |
| Prescription | 100% | 60% | 95% |
| **OVERALL** | **100%** | **55%** | **93%** |

---

## Conclusion

This enhanced design brings MedFlow to **93% feature parity** with StudioVision while maintaining our existing advantages (AI diagnostics, drug safety, e-prescribing, DICOM support).

The key insight from the detailed StudioVision spec is that **workflow efficiency is paramount**. Every feature is designed to minimize clicks and maximize pre-filled, intelligent defaults. Our implementation must prioritize:

1. **Favorites and Templates** - One-click access to common actions
2. **Auto-import and Smart Defaults** - Minimize manual data entry
3. **Visual Feedback** - Clear status indicators, color coding, progress
4. **"2-Click" Mindset** - Audit every workflow for efficiency

---

*Enhanced Design v2.0 - 2025-12-13*
