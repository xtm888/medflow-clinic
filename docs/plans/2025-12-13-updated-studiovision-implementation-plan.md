# Updated StudioVision Parity Implementation Plan

**Date:** 2025-12-13
**Status:** VERIFIED - Ready for Implementation
**Based on:** Deep codebase analysis

---

## Executive Summary

After thorough verification, the situation is:

**Components Built but NOT Integrated:**
- Contact Lens Fitting (4-tab module with all tabs)
- LOCS III Grading (full component, missing SVGs)
- FavoriteMedicationsBar, TreatmentProtocolSelector, DrugInteractionPanel, MedicationScheduleGenerator
- PatientAlertsBanner, AxisWheelSelector

**Backend Systems Ready but Underutilized:**
- TreatmentProtocol model, controller, routes, seed data - ALL READY
- User.favoriteMedications schema with methods - READY
- Patient.patientAlerts schema - READY
- OphthalmologyExam.contactLensFitting schema - READY
- OphthalmologyExam.locsGrading schema - READY

**Actually Missing:**
- useViewPreference hook
- PatientCompactDashboard (3-column layout)
- contactLensFittingController + routes
- 24 LOCS III SVG illustration files
- DeviceIntegrationFloatingPanel

---

## PHASE 1: Quick Wins - Integration Tasks (1-2 days)

These are HIGH PRIORITY because components exist but aren't wired up.

### 1.1 Integrate LOCS III Grading into OphthalmologyExamStep

**File:** `frontend/src/pages/ophthalmology/components/OphthalmologyExamStep.jsx`

**Task:**
```jsx
// Add import
import LOCSIIIGrading from '../../../components/ophthalmology/LOCSIIIGrading';

// In the cristallin section (around line 23), after the lens status selector:
{exam.anteriorSegment?.[eye]?.cristallin?.includes('Cataracte') && (
  <LOCSIIIGrading
    data={data?.locsGrading?.[eye] || {}}
    onUpdate={(grading) => updateField(`locsGrading.${eye}`, grading)}
    eye={eye}
  />
)}
```

**Estimated:** 30 minutes

---

### 1.2 Add ContactLensFittingStep to Workflow

**File:** `frontend/src/pages/ophthalmology/NewConsultation.jsx`

**Tasks:**
1. Import the component:
```jsx
import ContactLensFitting from '../../components/contactLens/ContactLensFitting';
```

2. Add to stepComponents (line ~48):
```jsx
const stepComponents = {
  // ... existing
  ContactLensFittingStep: ContactLensFitting,
};
```

3. Update workflow config to include step (or create new "contact_lens" workflow type)

**Estimated:** 1 hour

---

### 1.3 Integrate Prescription Enhancement Components

**File:** `frontend/src/pages/ophthalmology/components/prescription/MedicationPrescriptionTab.jsx`

**Tasks:**
1. Add imports:
```jsx
import FavoriteMedicationsBar from '../../../../components/prescription/FavoriteMedicationsBar';
import TreatmentProtocolSelector from '../../../../components/prescription/TreatmentProtocolSelector';
import DrugInteractionPanel from '../../../../components/prescription/DrugInteractionPanel';
```

2. Add FavoriteMedicationsBar at top of medication tab:
```jsx
<FavoriteMedicationsBar onMedicationAdd={handleMedicationAdd} />
```

3. Add TreatmentProtocolSelector in standard mode:
```jsx
<TreatmentProtocolSelector
  diagnoses={patient?.diagnoses || []}
  onProtocolApply={handlePrescriptionComplete}
/>
```

4. Add DrugInteractionPanel that shows when medications are selected:
```jsx
{medicationList.length > 0 && (
  <DrugInteractionPanel
    medications={medicationList}
    patientAllergies={patient?.allergies}
    patientMedications={patient?.activeMedications}
  />
)}
```

**Estimated:** 2 hours

---

### 1.4 Add PatientAlertsBanner to PatientDetail

**File:** `frontend/src/pages/PatientDetail/index.jsx`

**Task:**
```jsx
// Add import
import PatientAlertsBanner from '../../components/alerts/PatientAlertsBanner';

// Add after patient header, before sections (around line 200):
{patient && (
  <PatientAlertsBanner
    alerts={patient.patientAlerts}
    patientId={patient._id}
    onDismiss={handleAlertDismiss}
  />
)}
```

**Estimated:** 30 minutes

---

## PHASE 2: Backend Integration (1 day)

### 2.1 Create Contact Lens Fitting Controller & Routes

**New File:** `backend/controllers/contactLensFittingController.js`

```javascript
const OphthalmologyExam = require('../models/OphthalmologyExam');
const ContactLensInventory = require('../models/ContactLensInventory');
const Appointment = require('../models/Appointment');

// POST /api/contact-lens-fitting/dispense-trial
exports.dispenseTrialLens = async (req, res) => {
  const { examId, eye, inventoryItemId, lotNumber, expectedReturnDate, createFollowUp } = req.body;

  // 1. Validate inventory item exists and is trial lens
  const item = await ContactLensInventory.findById(inventoryItemId);
  if (!item || !item.isTrial) {
    return res.status(400).json({ error: 'Invalid trial lens item' });
  }

  // 2. Check stock
  if (item.quantity <= 0) {
    return res.status(400).json({ error: 'No stock available' });
  }

  // 3. Update exam with trial lens data
  const exam = await OphthalmologyExam.findById(examId);
  exam.contactLensFitting.trialLens[eye] = {
    inventoryItemId,
    lotNumber,
    parameters: {
      brand: item.brand,
      baseCurve: item.baseCurve,
      diameter: item.diameter,
      sphere: item.sphere,
      cylinder: item.cylinder,
      axis: item.axis
    },
    dispensedAt: new Date(),
    dispensedBy: req.user._id,
    expectedReturnDate
  };
  exam.contactLensFitting.trialLens.dispensed = true;

  // 4. Create follow-up appointment if requested
  if (createFollowUp) {
    const followUp = await Appointment.create({
      patient: exam.patient,
      type: 'contact_lens_followup',
      scheduledDate: expectedReturnDate,
      notes: 'Contact lens fitting follow-up'
    });
    exam.contactLensFitting.trialLens.followUpAppointmentId = followUp._id;
  }

  await exam.save();

  // 5. Decrement inventory
  item.quantity -= 1;
  item.trialTracking.totalDispensed += 1;
  item.trialTracking.currentlyOut += 1;
  item.trialTracking.lastDispensedAt = new Date();
  await item.save();

  res.json({ success: true, exam });
};

// POST /api/contact-lens-fitting/return-trial
exports.returnTrialLens = async (req, res) => {
  const { examId, eye } = req.body;

  const exam = await OphthalmologyExam.findById(examId);
  if (!exam?.contactLensFitting?.trialLens?.[eye]?.inventoryItemId) {
    return res.status(400).json({ error: 'No trial lens to return' });
  }

  exam.contactLensFitting.trialLens[eye].returnedAt = new Date();
  exam.contactLensFitting.trialLens[eye].returnedTo = req.user._id;
  await exam.save();

  // Update inventory tracking
  const item = await ContactLensInventory.findById(
    exam.contactLensFitting.trialLens[eye].inventoryItemId
  );
  if (item) {
    item.trialTracking.currentlyOut = Math.max(0, item.trialTracking.currentlyOut - 1);
    await item.save();
  }

  res.json({ success: true, exam });
};

// GET /api/contact-lens-fitting/pending-returns
exports.getPendingReturns = async (req, res) => {
  const exams = await OphthalmologyExam.find({
    'contactLensFitting.trialLens.dispensed': true,
    $or: [
      { 'contactLensFitting.trialLens.OD.returnedAt': { $exists: false } },
      { 'contactLensFitting.trialLens.OS.returnedAt': { $exists: false } }
    ]
  }).populate('patient', 'firstName lastName phone');

  res.json(exams);
};

// GET /api/contact-lens-fitting/patient-history/:patientId
exports.getPatientHistory = async (req, res) => {
  const { patientId } = req.params;

  const exams = await OphthalmologyExam.find({
    patient: patientId,
    'contactLensFitting': { $exists: true }
  }).sort({ createdAt: -1 });

  res.json(exams.map(e => e.contactLensFitting));
};
```

**New File:** `backend/routes/contactLensFitting.js`

```javascript
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const controller = require('../controllers/contactLensFittingController');

router.post('/dispense-trial', protect, controller.dispenseTrialLens);
router.post('/return-trial', protect, controller.returnTrialLens);
router.get('/pending-returns', protect, controller.getPendingReturns);
router.get('/patient-history/:patientId', protect, controller.getPatientHistory);

module.exports = router;
```

**Update:** `backend/server.js`
```javascript
const contactLensFittingRoutes = require('./routes/contactLensFitting');
app.use('/api/contact-lens-fitting', contactLensFittingRoutes);
```

**Estimated:** 3 hours

---

### 2.2 Add isTrial field to ContactLensInventory

**File:** `backend/models/ContactLensInventory.js`

```javascript
// Add to schema
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

**Estimated:** 15 minutes

---

## PHASE 3: View Toggle & Compact Dashboard (2 days)

### 3.1 Create useViewPreference Hook

**New File:** `frontend/src/hooks/useViewPreference.js`

```javascript
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import userService from '../services/userService';

export function useViewPreference() {
  const { user, updateUser } = useAuth();
  const [viewPreference, setViewPreference] = useState(
    user?.preferences?.viewPreference || 'standard'
  );
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user?.preferences?.viewPreference) {
      setViewPreference(user.preferences.viewPreference);
    }
  }, [user]);

  const toggleView = useCallback(async () => {
    const newView = viewPreference === 'standard' ? 'compact' : 'standard';
    setViewPreference(newView);

    try {
      setIsUpdating(true);
      await userService.updatePreferences({ viewPreference: newView });
      updateUser({
        ...user,
        preferences: { ...user.preferences, viewPreference: newView }
      });
    } catch (error) {
      console.error('Failed to save view preference:', error);
      setViewPreference(viewPreference); // Revert
    } finally {
      setIsUpdating(false);
    }
  }, [viewPreference, user, updateUser]);

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

export default useViewPreference;
```

**Estimated:** 1 hour

---

### 3.2 Create PatientCompactDashboard Component

**New File:** `frontend/src/components/patient/PatientCompactDashboard.jsx`

This is a larger component (~400 lines) implementing the 3-column StudioVision layout:
- Left (25%): Navigation + Quick Actions + Alerts + Document Archive
- Center (50%): Clinical Data (VA, Refraction, IOP, Diagnoses, Medications)
- Right (25%): Quick Print Actions + Device Status + Scheduling + Notes

**Estimated:** 6 hours

---

### 3.3 Integrate View Toggle in PatientDetail

**File:** `frontend/src/pages/PatientDetail/index.jsx`

```jsx
import useViewPreference from '../../hooks/useViewPreference';
import PatientCompactDashboard from '../../components/patient/PatientCompactDashboard';

export default function PatientDetail() {
  const { viewPreference, toggleView, isCompact } = useViewPreference();

  // ... existing code ...

  if (isCompact && patient) {
    return (
      <PatientCompactDashboard
        patient={patient}
        onToggleView={toggleView}
        onAction={handleQuickAction}
      />
    );
  }

  // ... existing standard view with toggle button added ...
}
```

**Estimated:** 2 hours

---

## PHASE 4: Visual Assets (1 day)

### 4.1 Create LOCS III SVG Illustrations

**Directory:** `frontend/src/assets/locs/`

Create 24 SVG files:
- `NO1.svg` through `NO6.svg` (Nuclear Opalescence)
- `NC1.svg` through `NC6.svg` (Nuclear Color)
- `C1.svg` through `C5.svg` (Cortical)
- `P1.svg` through `P5.svg` (Posterior Subcapsular)

**Design Specifications:**
- Canvas: 64x64px, viewBox="0 0 64 64"
- Style: Clean schematic representations
- NO: Circle with increasing opacity (transparent → dark gray)
- NC: Circle with color gradient (clear → yellow → amber → brown)
- C: Circle with spoke patterns from edge
- P: Circle with central dot (tiny → large)

**Update LOCSIIIGrading.jsx** to use actual SVG files instead of placeholders.

**Estimated:** 4 hours (or use AI image generation)

---

## PHASE 5: Testing & Verification (1 day)

### 5.1 Integration Tests
- Contact lens fitting workflow end-to-end
- Prescription with protocols flow
- View toggle persistence
- LOCS grading save/load

### 5.2 Manual Testing Checklist
- [ ] Contact lens history tab saves correctly
- [ ] Trial lens dispense decrements inventory
- [ ] Trial lens return updates tracking
- [ ] Follow-up appointment auto-created
- [ ] LOCS grading persists with exam
- [ ] Favorite medications bar shows user favorites
- [ ] Treatment protocols auto-fill medications
- [ ] Drug interactions detected and displayed
- [ ] Patient alerts banner shows/dismisses
- [ ] Compact dashboard renders all data
- [ ] View preference persists across sessions

---

## Implementation Order Summary

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| 1 | Integrate LOCS III into OphthalmologyExamStep | 30 min | None |
| 2 | Integrate PatientAlertsBanner | 30 min | None |
| 3 | Integrate Prescription components | 2 hours | None |
| 4 | Add ContactLensFitting to workflow | 1 hour | None |
| 5 | Create contact lens fitting controller/routes | 3 hours | None |
| 6 | Add isTrial field to ContactLensInventory | 15 min | None |
| 7 | Create useViewPreference hook | 1 hour | None |
| 8 | Create PatientCompactDashboard | 6 hours | 7 |
| 9 | Integrate view toggle | 2 hours | 7, 8 |
| 10 | Create LOCS SVG illustrations | 4 hours | None |
| 11 | Testing & verification | 4 hours | All above |

**Total Estimated Effort:** ~24 hours (3-4 days)

---

## Files to Create

```
NEW FILES:
├── backend/
│   ├── controllers/contactLensFittingController.js
│   └── routes/contactLensFitting.js
├── frontend/src/
│   ├── hooks/useViewPreference.js
│   ├── components/patient/PatientCompactDashboard.jsx
│   └── assets/locs/
│       ├── NO1.svg through NO6.svg
│       ├── NC1.svg through NC6.svg
│       ├── C1.svg through C5.svg
│       └── P1.svg through P5.svg

MODIFIED FILES:
├── backend/
│   ├── models/ContactLensInventory.js (add isTrial)
│   └── server.js (register new routes)
├── frontend/src/pages/
│   ├── ophthalmology/
│   │   ├── NewConsultation.jsx (add ContactLensFitting step)
│   │   └── components/
│   │       ├── OphthalmologyExamStep.jsx (integrate LOCS)
│   │       └── prescription/MedicationPrescriptionTab.jsx (integrate components)
│   └── PatientDetail/index.jsx (add alerts, view toggle)
```

---

## Success Metrics

After implementation:

| Feature | Current State | Target State |
|---------|---------------|--------------|
| Contact Lens Fitting | Components exist, not integrated | Full workflow in exam |
| LOCS III Grading | Component exists, not integrated | Integrated with visual SVGs |
| Prescription Enhancements | Components exist, not integrated | Favorites + Protocols + Interactions live |
| Patient Alerts | Component exists, not integrated | Visible on patient detail |
| Compact Dashboard | Not started | Full 3-column StudioVision view |
| View Toggle | Schema only | Working preference toggle |

**Expected Parity After Implementation:** 93% (up from ~70%)

---

*Plan created: 2025-12-13*
*Based on verified codebase analysis*
