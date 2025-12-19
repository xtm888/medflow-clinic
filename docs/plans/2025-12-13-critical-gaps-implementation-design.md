# Critical Gaps Implementation Design

**Date:** 2025-12-13
**Status:** Approved
**Priority Order:** Contact Lens Fitting (HIGH) → Single-Screen Dashboard (MEDIUM) → LOCS III Grading (MEDIUM)
**Deferred:** Voice-to-Text (LOW)

---

## Executive Summary

This design addresses the critical gaps identified in the StudioVision vs MedFlow comparison. Three features will be implemented:

1. **Contact Lens Fitting** - Full fitting assessment workflow with trial lens tracking
2. **Single-Screen Dashboard** - Compact patient view matching StudioVision's philosophy
3. **LOCS III Cataract Grading** - Visual grading component with schematic illustrations

---

## 1. Contact Lens Fitting

### 1.1 Overview

| Aspect | Decision |
|--------|----------|
| Integration | Step component + Standalone module |
| Assessment | Full 5 parameters (centration w/direction, movement, coverage, comfort 1-10, vision) |
| Trial Lens | Linked to ContactLensInventory with barcode |
| History | Stored on OphthalmologyExam |
| Follow-up | Auto-create appointment 1-2 weeks out |

### 1.2 File Structure

```
NEW FILES:
├── backend/
│   └── controllers/
│       └── contactLensFittingController.js
│
└── frontend/src/
    ├── pages/
    │   ├── ophthalmology/components/
    │   │   └── ContactLensFittingStep.jsx      # Step for exam workflow
    │   │
    │   └── ContactLensFitting/
    │       ├── index.jsx                        # Standalone module
    │       ├── FittingAssessmentGrid.jsx        # Reusable OD/OS grid
    │       ├── TrialLensDispenser.jsx           # Barcode scanner UI
    │       └── PatientCLHistory.jsx             # History summary

MODIFIED FILES:
├── backend/models/
│   ├── OphthalmologyExam.js                     # Add contactLensFitting schema
│   └── ContactLensInventory.js                  # Add isTrial flag
```

### 1.3 Data Model

**Add to `backend/models/OphthalmologyExam.js`:**

```javascript
const contactLensFittingSchema = new Schema({
  // Patient CL Status (captured each exam)
  wearingHistory: {
    isWearer: { type: Boolean, default: false },
    yearsWearing: { type: Number, min: 0, max: 80 },
    schedule: {
      type: String,
      enum: ['daily', 'extended', 'occasional', 'none']
    },
    compliance: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor']
    },
    currentBrand: String,
    currentParameters: {
      OD: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        baseCurve: Number,
        diameter: Number
      },
      OS: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        baseCurve: Number,
        diameter: Number
      }
    }
  },

  // Fitting Assessment per eye
  assessment: {
    OD: {
      centration: {
        type: String,
        enum: ['optimal', 'slight_decentered', 'decentered']
      },
      centrationDirection: {
        type: String,
        enum: ['superior', 'inferior', 'nasal', 'temporal', 'superonasal', 'superotemporal', 'inferonasal', 'inferotemporal']
      },
      movement: {
        type: String,
        enum: ['optimal', 'insufficient', 'excessive']
      },
      coverage: {
        type: String,
        enum: ['full_limbal', 'partial', 'inadequate']
      },
      comfort: { type: Number, min: 1, max: 10 },
      visionQuality: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor']
      }
    },
    OS: {
      centration: {
        type: String,
        enum: ['optimal', 'slight_decentered', 'decentered']
      },
      centrationDirection: {
        type: String,
        enum: ['superior', 'inferior', 'nasal', 'temporal', 'superonasal', 'superotemporal', 'inferonasal', 'inferotemporal']
      },
      movement: {
        type: String,
        enum: ['optimal', 'insufficient', 'excessive']
      },
      coverage: {
        type: String,
        enum: ['full_limbal', 'partial', 'inadequate']
      },
      comfort: { type: Number, min: 1, max: 10 },
      visionQuality: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor']
      }
    }
  },

  // Trial Lens Tracking
  trialLens: {
    dispensed: { type: Boolean, default: false },
    dispensedAt: Date,
    dispensedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    OD: {
      inventoryItemId: { type: Schema.Types.ObjectId, ref: 'ContactLensInventory' },
      lotNumber: String,
      parameters: {
        brand: String,
        baseCurve: Number,
        diameter: Number,
        sphere: Number,
        cylinder: Number,
        axis: Number
      }
    },
    OS: {
      inventoryItemId: { type: Schema.Types.ObjectId, ref: 'ContactLensInventory' },
      lotNumber: String,
      parameters: {
        brand: String,
        baseCurve: Number,
        diameter: Number,
        sphere: Number,
        cylinder: Number,
        axis: Number
      }
    },
    expectedReturnDate: Date,
    returnedAt: Date,
    returnedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    followUpAppointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    notes: String
  }
}, { _id: false });

// Add to OphthalmologyExam schema
contactLensFitting: contactLensFittingSchema
```

**Add to `backend/models/ContactLensInventory.js`:**

```javascript
// Add field to existing schema
isTrial: {
  type: Boolean,
  default: false,
  index: true
},
trialTracking: {
  totalDispensed: { type: Number, default: 0 },
  currentlyOut: { type: Number, default: 0 },
  lastDispensedAt: Date
}
```

### 1.4 UI Layout - Step Component

```
┌─────────────────────────────────────────────────────────────────┐
│  Contact Lens Fitting                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Patient CL History ──────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Current Contact Lens Wearer:  [Yes] [No]                │  │
│  │                                                           │  │
│  │  Years Wearing: [___]    Schedule: [Daily Wear    ▼]     │  │
│  │                                                           │  │
│  │  Compliance Rating:                                       │  │
│  │  [Excellent] [Good] [Fair] [Poor]                        │  │
│  │                                                           │  │
│  │  Current Brand: [_______________________________]         │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Fitting Assessment ──────────────────────────────────────┐  │
│  │                                                           │  │
│  │  [OD - Œil Droit]  [OS - Œil Gauche]    [Copy OD → OS]   │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │                                                           │  │
│  │  Centration:                                              │  │
│  │  [Optimal] [Légèrement décentré] [Décentré]              │  │
│  │  Direction: [Supérieur ▼] (if decentered)                │  │
│  │                                                           │  │
│  │  Movement (0.5-1mm optimal):                              │  │
│  │  [Optimal] [Insuffisant] [Excessif]                      │  │
│  │                                                           │  │
│  │  Coverage:                                                │  │
│  │  [Limbique complète] [Partielle] [Inadéquate]            │  │
│  │                                                           │  │
│  │  Comfort Score:                                           │  │
│  │  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]               │  │
│  │                                                           │  │
│  │  Vision Quality:                                          │  │
│  │  [Excellente] [Bonne] [Moyenne] [Mauvaise]               │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Trial Lens ──────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  [x] Dispenser lentilles d'essai                         │  │
│  │                                                           │  │
│  │  ┌─── OD ────────────┐    ┌─── OS ────────────┐          │  │
│  │  │ [Scan Barcode]    │    │ [Scan Barcode]    │          │  │
│  │  │ ou [Rechercher]   │    │ ou [Rechercher]   │          │  │
│  │  │                   │    │                   │          │  │
│  │  │ Acuvue Oasys      │    │ Acuvue Oasys      │          │  │
│  │  │ BC: 8.4           │    │ BC: 8.4           │          │  │
│  │  │ Dia: 14.0         │    │ Dia: 14.0         │          │  │
│  │  │ Sph: -2.50        │    │ Sph: -2.25        │          │  │
│  │  │ Stock: 5 avail    │    │ Stock: 8 avail    │          │  │
│  │  └───────────────────┘    └───────────────────┘          │  │
│  │                                                           │  │
│  │  Date de retour prévue: [26/12/2025] (dans 14 jours)     │  │
│  │                                                           │  │
│  │  [x] Créer RDV de suivi automatiquement                  │  │
│  │      Type: [Suivi lentilles ▼]                           │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 Controller API

**`backend/controllers/contactLensFittingController.js`:**

```javascript
// POST /api/contact-lens-fitting/dispense-trial
// Dispense trial lens from inventory
exports.dispenseTrialLens = async (req, res) => {
  const { examId, eye, inventoryItemId, lotNumber } = req.body;
  // 1. Validate inventory item is trial lens
  // 2. Check stock availability
  // 3. Create reservation
  // 4. Update exam with trial lens data
  // 5. Auto-create follow-up appointment if requested
  // 6. Return updated exam
};

// POST /api/contact-lens-fitting/return-trial
// Return trial lens to inventory
exports.returnTrialLens = async (req, res) => {
  const { examId, eye } = req.body;
  // 1. Find exam with trial lens
  // 2. Release reservation
  // 3. Update exam returnedAt
  // 4. Return updated exam
};

// GET /api/contact-lens-fitting/pending-returns
// Get all pending trial lens returns
exports.getPendingReturns = async (req, res) => {
  // Query exams with dispensed trial lenses not yet returned
};

// GET /api/contact-lens-fitting/patient-history/:patientId
// Get patient's CL fitting history across all exams
exports.getPatientHistory = async (req, res) => {
  // Aggregate contactLensFitting data from all patient exams
};
```

### 1.6 Workflow Integration

**Step Registration in `NewConsultation.jsx`:**

```javascript
import ContactLensFittingStep from './components/ContactLensFittingStep';

const stepComponents = {
  // ... existing steps ...
  ContactLensFittingStep,
};

// Add to workflow configurations where appropriate
const WORKFLOW_STEPS = {
  full: [..., 'ContactLensFittingStep', ...],
  refraction: [..., 'ContactLensFittingStep', ...],
};
```

**Standalone Module Route:**

```javascript
// In App.jsx or routes config
<Route path="/contact-lens-fitting/:patientId?" element={<ContactLensFitting />} />
```

---

## 2. Single-Screen Dashboard

### 2.1 Overview

| Aspect | Decision |
|--------|----------|
| Content | Clinical summary (VA, Refraction, IOP, Diagnoses) + Quick actions |
| Access | User preference setting (default view) + per-session toggle |

### 2.2 File Structure

```
NEW FILES:
├── frontend/src/
│   ├── components/
│   │   └── PatientCompactDashboard.jsx
│   └── hooks/
│       └── useViewPreference.js

MODIFIED FILES:
├── backend/models/User.js                       # Add preferences field
└── frontend/src/pages/PatientDetail/index.jsx   # Add view toggle
```

### 2.3 Data Model

**Add to `backend/models/User.js`:**

```javascript
preferences: {
  patientView: {
    type: String,
    enum: ['standard', 'compact'],
    default: 'standard'
  },
  // Future preferences can be added here
  theme: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'system'
  }
}
```

### 2.4 UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌──────┐  Jean Dupont                    [Standard View] [Toggle]  │
│  │ Photo│  #PAT-12345 │ 52 ans, M │ Dernière visite: 15/11/2025   │
│  └──────┘                                                           │
│                                                                     │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │                                   │
│  ACUITÉ VISUELLE               │  RÉFRACTION                       │
│  15/11/2025                    │  15/11/2025                       │
│  ┌─────────────────────────┐   │  ┌───────────────────────────┐   │
│  │           │  OD  │  OS  │   │  │           │  OD    │  OS   │   │
│  │───────────┼──────┼──────│   │  │───────────┼────────┼───────│   │
│  │ Loin SC   │20/40 │20/30 │   │  │ Sphère    │ -2.50  │ -2.25 │   │
│  │ Loin AC   │20/20 │20/20 │   │  │ Cylindre  │ -0.75  │ -0.50 │   │
│  │ Près      │ J2   │ J2   │   │  │ Axe       │  180   │  175  │   │
│  │ Trou stn. │20/25 │20/25 │   │  │ Addition  │ +1.50  │ +1.50 │   │
│  └─────────────────────────┘   │  └───────────────────────────┘   │
│                                 │                                   │
├─────────────────────────────────┼───────────────────────────────────┤
│                                 │                                   │
│  TENSION OCULAIRE              │  DIAGNOSTICS ACTIFS               │
│  15/11/2025                    │                                   │
│  ┌─────────────────────────┐   │  ┌───────────────────────────┐   │
│  │ OD: 14 mmHg            │   │  │ • Glaucome GPAO (H40.11)  │   │
│  │ OS: 15 mmHg            │   │  │   Stade: Modéré           │   │
│  │                         │   │  │   Cible PIO: 12-14 mmHg   │   │
│  │ Méthode: Goldmann      │   │  │                           │   │
│  │                         │   │  │ • Cataracte (H25.1)       │   │
│  │ [📈 Voir tendance]     │   │  │   LOCS: NO3, NC2, C1      │   │
│  └─────────────────────────┘   │  │                           │   │
│                                 │  │ • Sécheresse (H04.12)     │   │
│                                 │  └───────────────────────────┘   │
│                                 │                                   │
├─────────────────────────────────┴───────────────────────────────────┤
│                                                                     │
│  ACTIONS RAPIDES                                                    │
│                                                                     │
│  [📋 Nouvelle Rx]  [🖨️ Imprimer]  [📅 RDV]  [✉️ Courrier]  [📷 Imagerie] │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.5 Hook Implementation

**`frontend/src/hooks/useViewPreference.js`:**

```javascript
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserPreferences } from '../services/userService';

export function useViewPreference() {
  const { user, updateUser } = useAuth();
  const [viewPreference, setViewPreference] = useState(
    user?.preferences?.patientView || 'standard'
  );
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync with user preferences on mount
  useEffect(() => {
    if (user?.preferences?.patientView) {
      setViewPreference(user.preferences.patientView);
    }
  }, [user]);

  // Toggle view and persist preference
  const toggleView = useCallback(async () => {
    const newView = viewPreference === 'standard' ? 'compact' : 'standard';
    setViewPreference(newView);

    try {
      setIsUpdating(true);
      await updateUserPreferences({ patientView: newView });
      updateUser({ preferences: { ...user.preferences, patientView: newView } });
    } catch (error) {
      console.error('Failed to save view preference:', error);
      // Revert on error
      setViewPreference(viewPreference);
    } finally {
      setIsUpdating(false);
    }
  }, [viewPreference, user, updateUser]);

  // Set view without persisting (session only)
  const setSessionView = useCallback((view) => {
    setViewPreference(view);
  }, []);

  return {
    viewPreference,
    toggleView,
    setSessionView,
    isUpdating,
    isCompact: viewPreference === 'compact'
  };
}
```

### 2.6 Integration in PatientDetail

**Modify `frontend/src/pages/PatientDetail/index.jsx`:**

```javascript
import { useViewPreference } from '../../hooks/useViewPreference';
import PatientCompactDashboard from '../../components/PatientCompactDashboard';

export default function PatientDetail() {
  const { viewPreference, toggleView, isCompact } = useViewPreference();

  // ... existing code ...

  // Render based on preference
  if (isCompact) {
    return (
      <PatientCompactDashboard
        patient={patient}
        latestExam={latestExam}
        diagnoses={activeDiagnoses}
        onToggleView={toggleView}
        onAction={handleQuickAction}
      />
    );
  }

  // Existing standard view with toggle button added
  return (
    <div>
      {/* Add toggle in header */}
      <div className="flex justify-between items-center mb-4">
        <h1>{patient.name}</h1>
        <button
          onClick={toggleView}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          {isCompact ? 'Vue standard' : 'Vue compacte'}
        </button>
      </div>

      {/* Existing collapsible sections */}
    </div>
  );
}
```

---

## 3. LOCS III Cataract Grading

### 3.1 Overview

| Aspect | Decision |
|--------|----------|
| UI Pattern | Clickable image grid |
| Integration | OphthalmologyExamStep under Anterior Segment |
| Images | Schematic illustrations (custom SVGs) |

### 3.2 File Structure

```
NEW FILES:
├── frontend/src/components/grading/
│   ├── LOCSGradingPanel.jsx
│   ├── LOCSImageGrid.jsx
│   └── locsIllustrations/
│       ├── nuclear-opalescence/
│       │   ├── NO1.svg
│       │   ├── NO2.svg
│       │   ├── NO3.svg
│       │   ├── NO4.svg
│       │   ├── NO5.svg
│       │   └── NO6.svg
│       ├── nuclear-color/
│       │   ├── NC1.svg
│       │   ├── NC2.svg
│       │   ├── NC3.svg
│       │   ├── NC4.svg
│       │   ├── NC5.svg
│       │   └── NC6.svg
│       ├── cortical/
│       │   ├── C1.svg
│       │   ├── C2.svg
│       │   ├── C3.svg
│       │   ├── C4.svg
│       │   └── C5.svg
│       └── posterior-subcapsular/
│           ├── P1.svg
│           ├── P2.svg
│           ├── P3.svg
│           ├── P4.svg
│           └── P5.svg

MODIFIED FILES:
├── backend/models/OphthalmologyExam.js
└── frontend/src/pages/ophthalmology/components/OphthalmologyExamStep.jsx
```

### 3.3 Data Model

**Add to `backend/models/OphthalmologyExam.js` anteriorSegment schema:**

```javascript
// Within anteriorSegment.OD and anteriorSegment.OS
lens: {
  status: {
    type: String,
    enum: ['clear', 'cataract', 'pseudophakia', 'aphakia'],
    default: 'clear'
  },
  iolType: String,  // For pseudophakia
  iolPower: Number, // For pseudophakia

  locsGrading: {
    nuclearOpalescence: {
      type: Number,
      min: 1,
      max: 6,
      validate: {
        validator: Number.isInteger,
        message: 'Nuclear opalescence must be integer 1-6'
      }
    },
    nuclearColor: {
      type: Number,
      min: 1,
      max: 6,
      validate: {
        validator: Number.isInteger,
        message: 'Nuclear color must be integer 1-6'
      }
    },
    cortical: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Cortical must be integer 1-5'
      }
    },
    posteriorSubcapsular: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'PSC must be integer 1-5'
      }
    }
  },

  // Computed visual impact (optional)
  visualSignificance: {
    type: String,
    enum: ['none', 'mild', 'moderate', 'significant', 'severe']
  },

  notes: String
}
```

### 3.4 UI Components

**`LOCSGradingPanel.jsx`:**

```jsx
import React from 'react';
import LOCSImageGrid from './LOCSImageGrid';

const LOCS_SCALES = {
  nuclearOpalescence: {
    label: 'Opalescence Nucléaire (NO)',
    min: 1,
    max: 6,
    descriptions: {
      1: 'Transparent',
      2: 'Légère opacité',
      3: 'Opacité modérée',
      4: 'Opacité marquée',
      5: 'Opacité dense',
      6: 'Très dense'
    }
  },
  nuclearColor: {
    label: 'Couleur Nucléaire (NC)',
    min: 1,
    max: 6,
    descriptions: {
      1: 'Incolore',
      2: 'Jaune pâle',
      3: 'Jaune',
      4: 'Ambre',
      5: 'Brun',
      6: 'Brun foncé'
    }
  },
  cortical: {
    label: 'Cortical (C)',
    min: 1,
    max: 5,
    descriptions: {
      1: 'Traces (<5%)',
      2: 'Légère (5-25%)',
      3: 'Modérée (25-50%)',
      4: 'Marquée (50-75%)',
      5: 'Sévère (>75%)'
    }
  },
  posteriorSubcapsular: {
    label: 'Sous-capsulaire Postérieur (P)',
    min: 1,
    max: 5,
    descriptions: {
      1: 'Traces (<1mm)',
      2: 'Petite (1-2mm)',
      3: 'Modérée (2-3mm)',
      4: 'Large (3-4mm)',
      5: 'Extensive (>4mm)'
    }
  }
};

export default function LOCSGradingPanel({
  eye,
  value = {},
  onChange,
  readOnly = false
}) {
  const handleGradeChange = (scale, grade) => {
    if (readOnly) return;
    onChange({
      ...value,
      [scale]: grade
    });
  };

  const copyToOtherEye = () => {
    // Emit event for parent to handle
    onChange(value, { copyToOtherEye: true });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-gray-900">
          Classification LOCS III - {eye}
        </h4>
        {!readOnly && (
          <button
            onClick={copyToOtherEye}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Copier vers {eye === 'OD' ? 'OS' : 'OD'}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(LOCS_SCALES).map(([scaleKey, scale]) => (
          <div key={scaleKey}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {scale.label}
            </label>
            <LOCSImageGrid
              scale={scaleKey}
              min={scale.min}
              max={scale.max}
              value={value[scaleKey]}
              descriptions={scale.descriptions}
              onChange={(grade) => handleGradeChange(scaleKey, grade)}
              readOnly={readOnly}
            />
          </div>
        ))}
      </div>

      {/* Summary */}
      {(value.nuclearOpalescence || value.nuclearColor ||
        value.cortical || value.posteriorSubcapsular) && (
        <div className="mt-4 pt-4 border-t">
          <span className="text-sm text-gray-600">Résumé: </span>
          <span className="text-sm font-medium">
            {value.nuclearOpalescence && `NO${value.nuclearOpalescence}`}
            {value.nuclearColor && `, NC${value.nuclearColor}`}
            {value.cortical && `, C${value.cortical}`}
            {value.posteriorSubcapsular && `, P${value.posteriorSubcapsular}`}
          </span>
        </div>
      )}
    </div>
  );
}
```

**`LOCSImageGrid.jsx`:**

```jsx
import React from 'react';

// Import all illustrations
const illustrations = {
  nuclearOpalescence: {
    1: () => import('./locsIllustrations/nuclear-opalescence/NO1.svg'),
    // ... etc
  },
  // ... other scales
};

export default function LOCSImageGrid({
  scale,
  min,
  max,
  value,
  descriptions,
  onChange,
  readOnly
}) {
  const grades = Array.from(
    { length: max - min + 1 },
    (_, i) => min + i
  );

  return (
    <div className="grid grid-cols-5 md:grid-cols-6 gap-2">
      {grades.map((grade) => (
        <button
          key={grade}
          onClick={() => !readOnly && onChange(grade)}
          disabled={readOnly}
          className={`
            relative p-2 border-2 rounded-lg transition-all
            ${value === grade
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }
            ${readOnly ? 'cursor-default' : 'cursor-pointer'}
          `}
        >
          {/* SVG Illustration */}
          <div className="w-12 h-12 mx-auto mb-1">
            <LOCSIllustration scale={scale} grade={grade} />
          </div>

          {/* Grade Label */}
          <div className="text-center">
            <span className={`
              text-sm font-medium
              ${value === grade ? 'text-blue-700' : 'text-gray-700'}
            `}>
              {scale === 'nuclearOpalescence' && `NO${grade}`}
              {scale === 'nuclearColor' && `NC${grade}`}
              {scale === 'cortical' && `C${grade}`}
              {scale === 'posteriorSubcapsular' && `P${grade}`}
            </span>
          </div>

          {/* Description tooltip on hover */}
          <div className="
            absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
            px-2 py-1 bg-gray-800 text-white text-xs rounded
            opacity-0 group-hover:opacity-100 transition-opacity
            whitespace-nowrap pointer-events-none
          ">
            {descriptions[grade]}
          </div>

          {/* Selected indicator */}
          {value === grade && (
            <div className="absolute top-1 right-1">
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// Placeholder component for illustrations
function LOCSIllustration({ scale, grade }) {
  // This will render the appropriate SVG based on scale and grade
  // SVGs should be simple schematic representations:
  // - Nuclear Opalescence: Circle with increasing opacity (white → dark gray)
  // - Nuclear Color: Circle with color gradient (clear → yellow → amber → brown)
  // - Cortical: Circle with spoke patterns from edge (none → full coverage)
  // - PSC: Circle with central dot (tiny → large)

  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      {/* Placeholder - actual SVGs will be designed */}
      <circle
        cx="24"
        cy="24"
        r="20"
        fill={`rgba(0,0,0,${grade * 0.15})`}
        stroke="#ccc"
        strokeWidth="1"
      />
    </svg>
  );
}
```

### 3.5 Integration in OphthalmologyExamStep

**Modify `frontend/src/pages/ophthalmology/components/OphthalmologyExamStep.jsx`:**

```jsx
import LOCSGradingPanel from '../../../components/grading/LOCSGradingPanel';

// Inside the Anterior Segment section for each eye
{/* Lens Status */}
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Cristallin
  </label>
  <div className="flex gap-2 mb-2">
    {['clear', 'cataract', 'pseudophakia', 'aphakia'].map((status) => (
      <button
        key={status}
        onClick={() => updateField(`anteriorSegment.${eye}.lens.status`, status)}
        className={`px-3 py-1 text-sm rounded border ${
          exam.anteriorSegment?.[eye]?.lens?.status === status
            ? 'bg-blue-100 border-blue-300 text-blue-800'
            : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}
        disabled={readOnly}
      >
        {status === 'clear' && 'Transparent'}
        {status === 'cataract' && 'Cataracte'}
        {status === 'pseudophakia' && 'Pseudophaque'}
        {status === 'aphakia' && 'Aphaque'}
      </button>
    ))}
  </div>

  {/* LOCS III Grading - shown when cataract selected */}
  {exam.anteriorSegment?.[eye]?.lens?.status === 'cataract' && (
    <LOCSGradingPanel
      eye={eye}
      value={exam.anteriorSegment?.[eye]?.lens?.locsGrading || {}}
      onChange={(grading, options) => {
        updateField(`anteriorSegment.${eye}.lens.locsGrading`, grading);
        if (options?.copyToOtherEye) {
          const otherEye = eye === 'OD' ? 'OS' : 'OD';
          updateField(`anteriorSegment.${otherEye}.lens.locsGrading`, grading);
        }
      }}
      readOnly={readOnly}
    />
  )}
</div>
```

---

## 4. SVG Illustration Specifications

### 4.1 Design Guidelines

All LOCS III illustrations should follow these specifications:

**Canvas:** 48x48 pixels, viewBox="0 0 48 48"

**Style:**
- Clean, schematic representations
- Consistent stroke width (1-2px)
- Grayscale for opalescence, color gradient for nuclear color
- Clear visual progression between grades

### 4.2 Nuclear Opalescence (NO1-NO6)

```svg
<!-- NO1 - Clear -->
<circle cx="24" cy="24" r="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>

<!-- NO3 - Moderate -->
<circle cx="24" cy="24" r="20" fill="#d1d5db" stroke="#9ca3af" stroke-width="1"/>

<!-- NO6 - Very Dense -->
<circle cx="24" cy="24" r="20" fill="#374151" stroke="#1f2937" stroke-width="1"/>
```

### 4.3 Nuclear Color (NC1-NC6)

```svg
<!-- NC1 - Clear -->
<circle cx="24" cy="24" r="20" fill="#fefefe" stroke="#e5e7eb" stroke-width="1"/>

<!-- NC3 - Yellow -->
<circle cx="24" cy="24" r="20" fill="#fef08a" stroke="#eab308" stroke-width="1"/>

<!-- NC6 - Dark Brown -->
<circle cx="24" cy="24" r="20" fill="#78350f" stroke="#451a03" stroke-width="1"/>
```

### 4.4 Cortical (C1-C5)

Spoke patterns radiating from edge toward center:

```svg
<!-- C1 - Trace spokes -->
<circle cx="24" cy="24" r="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
<path d="M24 4 L24 10" stroke="#d1d5db" stroke-width="2"/>

<!-- C3 - Moderate spokes (25-50%) -->
<circle cx="24" cy="24" r="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
<path d="M24 4 L24 16 M44 24 L32 24 M24 44 L24 32 M4 24 L16 24" stroke="#9ca3af" stroke-width="3"/>

<!-- C5 - Extensive (>75%) -->
<circle cx="24" cy="24" r="20" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1"/>
<path d="M24 4 L24 20 M44 24 L28 24 M24 44 L24 28 M4 24 L20 24 M38 10 L30 18 M38 38 L30 30 M10 38 L18 30 M10 10 L18 18" stroke="#6b7280" stroke-width="4"/>
```

### 4.5 Posterior Subcapsular (P1-P5)

Central opacity growing from center:

```svg
<!-- P1 - Trace central dot -->
<circle cx="24" cy="24" r="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
<circle cx="24" cy="24" r="2" fill="#9ca3af"/>

<!-- P3 - Moderate central opacity -->
<circle cx="24" cy="24" r="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
<circle cx="24" cy="24" r="8" fill="#6b7280"/>

<!-- P5 - Extensive central opacity -->
<circle cx="24" cy="24" r="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
<circle cx="24" cy="24" r="16" fill="#374151"/>
```

---

## 5. Implementation Order

### Phase 1: Contact Lens Fitting (HIGH Priority)

1. **Backend Schema** - Add contactLensFitting to OphthalmologyExam
2. **Backend Controller** - Create contactLensFittingController.js
3. **Inventory Update** - Add isTrial flag to ContactLensInventory
4. **Step Component** - Create ContactLensFittingStep.jsx
5. **Reusable Components** - FittingAssessmentGrid, TrialLensDispenser
6. **Standalone Module** - ContactLensFitting page
7. **Workflow Integration** - Register in NewConsultation

### Phase 2: Single-Screen Dashboard (MEDIUM Priority)

1. **Backend** - Add preferences to User model
2. **Hook** - Create useViewPreference.js
3. **Component** - Create PatientCompactDashboard.jsx
4. **Integration** - Modify PatientDetail/index.jsx

### Phase 3: LOCS III Grading (MEDIUM Priority)

1. **SVG Creation** - Design 24 schematic illustrations
2. **Backend Schema** - Add locsGrading to anteriorSegment.lens
3. **Components** - Create LOCSGradingPanel, LOCSImageGrid
4. **Integration** - Add to OphthalmologyExamStep

---

## 6. Testing Strategy

### Unit Tests

- Contact lens fitting validation logic
- LOCS grading boundary values (1-6, 1-5)
- View preference persistence

### Integration Tests

- Trial lens dispense → inventory reservation → appointment creation flow
- Exam save with contact lens fitting data
- View toggle persists across sessions

### E2E Tests

- Complete contact lens fitting workflow
- Dashboard view switching
- Cataract grading during exam

---

## 7. Deferred Items

### Voice-to-Text (LOW Priority)

Deferred for future implementation. When ready:

- Use Web Speech API (browser native)
- Add microphone button to notes fields
- Implement in ChiefComplaintStep first as pilot
- Consider privacy/HIPAA implications for cloud alternatives

---

*Design approved: 2025-12-13*
