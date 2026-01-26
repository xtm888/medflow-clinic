# Granular Update Pattern - Reference Architecture

## Overview

This document describes the **Granular Update Pattern** derived from CareVision's proven `DonConsultation.cs` implementation. This pattern is the key architectural approach that enables CareVision's reliability and should be adopted in MedFlow to fix consultation save issues.

**Key Insight**: CareVision's reliability comes from saving each logical section of a consultation independently, preventing cascading failures that plague monolithic save operations.

---

## CareVision's Pattern: DonConsultation.cs

### Core Philosophy

CareVision's Data Access Object (DAO) layer follows a **section-specific update** strategy where each logical part of a consultation is updated independently:

| Method Name | Section Updated | Fields |
|-------------|-----------------|--------|
| `ModifierConsultationRefrac()` | Refraction | REFRACTION, LUNETTES |
| `ModifierConsultationPathologie()` | Diagnosis/Observation | Observation, DOMINANTE |
| `ModifierConsultationTraite()` | Treatment/Prescription | Ordonnance, Ordonnance2 |
| `ModifierConsultationRefra()` | IOP/Tonometry | TOD, TOG (tension oculaire) |

### CareVision Code Reference

```csharp
// Care.Vision.DAO/DonConsultation.cs

/// <summary>
/// Update ONLY refraction data - atomic operation
/// </summary>
public static void ModifierConsultationRefrac(Consultation c)
{
    // Simple SQL escaping to prevent injection
    c.REFRACTION = Regex.Replace(c.REFRACTION, "'", "''");
    c.LUNETTES = Regex.Replace(c.LUNETTES, "'", "''");

    // Targeted update - only refraction fields
    string sql = string.Format(
        "UPDATE Consultation SET REFRACTION='{1}', LUNETTES='{2}' WHERE Numconsultation='{0}'",
        c.Numconsultation,
        c.REFRACTION,
        c.LUNETTES
    );

    Clsdbs.MonExecution(sql);
}

/// <summary>
/// Update ONLY diagnosis/observation data - atomic operation
/// </summary>
public static void ModifierConsultationPathologie(Consultation c)
{
    c.Observation = Regex.Replace(c.Observation, "'", "''");

    string sql = string.Format(
        "UPDATE Consultation SET Observation='{1}', DOMINANTE='{2}' WHERE Numconsultation='{0}'",
        c.Numconsultation,
        c.Observation,
        c.DOMINANTE
    );

    Clsdbs.MonExecution(sql);
}

/// <summary>
/// Update ONLY treatment/prescription data - atomic operation
/// </summary>
public static void ModifierConsultationTraite(Consultation c)
{
    c.Ordonnance = Regex.Replace(c.Ordonnance, "'", "''");
    c.Ordonnance2 = Regex.Replace(c.Ordonnance2, "'", "''");

    string sql = string.Format(
        "UPDATE Consultation SET Ordonnance='{1}', Ordonnance2='{2}' WHERE Numconsultation='{0}'",
        c.Numconsultation,
        c.Ordonnance,
        c.Ordonnance2
    );

    Clsdbs.MonExecution(sql);
}

/// <summary>
/// Update ONLY IOP (intraocular pressure) data - atomic operation
/// TOD = Tension Oculaire Droite (right eye)
/// TOG = Tension Oculaire Gauche (left eye)
/// </summary>
public static void ModifierConsultationRefra(Consultation c)
{
    string sql = string.Format(
        "UPDATE Consultation SET TOD='{1}', TOG='{2}' WHERE Numconsultation='{0}'",
        c.Numconsultation,
        c.TOD,
        c.TOG
    );

    Clsdbs.MonExecution(sql);
}
```

### Why This Pattern Works

1. **Atomic Operations**: Each save is isolated - failure in one section doesn't affect others
2. **Minimal Surface Area**: Only the changed fields are updated, reducing validation overhead
3. **No Cascading Failures**: Refraction save doesn't depend on FeeSchedule lookups
4. **Simple Error Handling**: Each section can retry independently
5. **User Experience**: Partial saves are possible - user doesn't lose all work

---

## MedFlow's Current Problem

### Monolithic Pre-Save Hooks

MedFlow currently uses heavy pre-save hooks in `Visit.js` that create cascading failures:

```javascript
// PROBLEM: Multiple pre-save hooks that ALL run on ANY save

// Hook 1: Date validation (lines 865-903)
visitSchema.pre('save', async function(next) {
  const now = new Date();
  if (this.visitDate && new Date(this.visitDate) > now) {
    const error = new Error('Visit date cannot be in the future');
    error.statusCode = 400;
    return next(error);
  }
  next();
});

// Hook 2: ID generation and calculations (lines 906-931)
visitSchema.pre('save', async function(next) {
  if (!this.visitId) {
    // Counter lookup - can fail
    const counter = await Counter.findOneAndUpdate(...);
    this.visitId = counter.sequence;
  }
  next();
});

// Hook 3: FeeSchedule price lookup (lines 934-976)
visitSchema.pre('save', async function(next) {
  if (this.isModified('clinicalActs') && this.clinicalActs?.length > 0) {
    const FeeSchedule = mongoose.model('FeeSchedule');
    for (const act of this.clinicalActs) {
      // ASYNC DATABASE QUERY - can timeout
      const fee = await FeeSchedule.findOne({ code: act.actCode });
      // ...
    }
  }
  next();
});
```

### Failure Cascade Diagram

```
User saves refraction data
        │
        ▼
┌─────────────────────────┐
│ Hook 1: Date Validation │ ── ✓ Pass
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Hook 2: ID Generation   │ ── ✓ Pass
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Hook 3: FeeSchedule     │ ── ✗ Database timeout
│         Lookup          │
└───────────┬─────────────┘
            │
            ▼
    ╔═══════════════╗
    ║ ENTIRE SAVE   ║
    ║    FAILS      ║
    ║               ║
    ║ User loses    ║
    ║ refraction    ║
    ║ data!         ║
    ╚═══════════════╝
```

---

## MedFlow Solution: Granular Service Layer

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
│  StudioVisionConsultation.jsx                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┬─────────────┐
        │             │             │             │             │
        ▼             ▼             ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│    PUT    │ │    PUT    │ │    PUT    │ │    PUT    │ │    PUT    │
│  /visits/ │ │  /visits/ │ │  /visits/ │ │  /visits/ │ │  /visits/ │
│ :id/refra │ │ :id/diagn │ │ :id/treat │ │  :id/iop  │ │    :id    │
│   ction   │ │   osis    │ │   ment    │ │           │ │  (full)   │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │             │
      ▼             ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│              visitGranularService.js                             │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ updateVisit     │  │ updateVisit     │  │ updateVisit     │  │
│  │ Refraction()    │  │ Diagnosis()     │  │ Treatment()     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│  ┌────────┴────────┐  ┌────────┴────────┐                       │
│  │ updateVisit     │  │ validateSection │                       │
│  │ IOP()           │  │ (lightweight)   │                       │
│  └────────┬────────┘  └─────────────────┘                       │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MongoDB                                    │
│                                                                  │
│   Visit.findByIdAndUpdate(                                      │
│     visitId,                                                    │
│     { $set: { 'examinations.refraction': data } },              │
│     { new: true, runValidators: false }  // BYPASS pre-save     │
│   )                                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation: visitGranularService.js

```javascript
/**
 * Granular Update Service for Visits
 *
 * Mirrors CareVision's DonConsultation.cs pattern:
 * - ModifierConsultationRefrac -> updateVisitRefraction
 * - ModifierConsultationPathologie -> updateVisitDiagnosis
 * - ModifierConsultationTraite -> updateVisitTreatment
 * - ModifierConsultationRefra -> updateVisitIOP
 *
 * Key Principle: Use findByIdAndUpdate() with runValidators: false
 * to BYPASS the heavy pre-save hooks that cause cascading failures.
 */

const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const log = require('../config/logger');

/**
 * Update refraction data ONLY
 * Mirrors: CareVision's ModifierConsultationRefrac()
 *
 * @param {string} visitId - Visit ID
 * @param {Object} refractionData - Refraction examination data
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitRefraction(visitId, refractionData, userId) {
  // Lightweight validation at service layer
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    throw new Error('Invalid visit ID');
  }

  const update = {
    $set: {
      'examinations.refraction': refractionData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false  // Skip heavy pre-save hooks
    }
  );

  if (!visit) {
    throw new Error('Visit not found');
  }

  log.info('[VISIT] Refraction updated', {
    visitId: visit.visitId,
    userId
  });

  return visit;
}

/**
 * Update diagnosis/observation ONLY
 * Mirrors: CareVision's ModifierConsultationPathologie()
 *
 * @param {string} visitId - Visit ID
 * @param {Array} diagnosisData - Array of diagnosis objects
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitDiagnosis(visitId, diagnosisData, userId) {
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    throw new Error('Invalid visit ID');
  }

  // Validate diagnosis structure at service layer
  if (diagnosisData && !Array.isArray(diagnosisData)) {
    throw new Error('Diagnoses must be an array');
  }

  const update = {
    $set: {
      diagnoses: diagnosisData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    throw new Error('Visit not found');
  }

  log.info('[VISIT] Diagnosis updated', {
    visitId: visit.visitId,
    userId,
    diagnosisCount: diagnosisData?.length || 0
  });

  return visit;
}

/**
 * Update treatment/prescription plan ONLY
 * Mirrors: CareVision's ModifierConsultationTraite()
 *
 * @param {string} visitId - Visit ID
 * @param {Object} treatmentData - Treatment plan data (medications, recommendations)
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitTreatment(visitId, treatmentData, userId) {
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    throw new Error('Invalid visit ID');
  }

  const updateFields = {
    updatedBy: userId,
    updatedAt: new Date()
  };

  // Allow updating specific treatment sub-fields
  if (treatmentData.medications !== undefined) {
    updateFields['plan.medications'] = treatmentData.medications;
  }
  if (treatmentData.recommendations !== undefined) {
    updateFields['plan.recommendations'] = treatmentData.recommendations;
  }
  if (treatmentData.followUpInstructions !== undefined) {
    updateFields['plan.followUpInstructions'] = treatmentData.followUpInstructions;
  }
  if (treatmentData.referrals !== undefined) {
    updateFields['plan.referrals'] = treatmentData.referrals;
  }

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    { $set: updateFields },
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    throw new Error('Visit not found');
  }

  log.info('[VISIT] Treatment updated', {
    visitId: visit.visitId,
    userId
  });

  return visit;
}

/**
 * Update IOP (intraocular pressure) data ONLY
 * Mirrors: CareVision's ModifierConsultationRefra() (TOD/TOG)
 *
 * @param {string} visitId - Visit ID
 * @param {Object} iopData - IOP data with OD (right) and OS (left) values
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitIOP(visitId, iopData, userId) {
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    throw new Error('Invalid visit ID');
  }

  // IOP validation (0-60 mmHg range)
  if (iopData.OD !== undefined && (iopData.OD < 0 || iopData.OD > 60)) {
    throw new Error('IOP OD value must be between 0 and 60 mmHg');
  }
  if (iopData.OS !== undefined && (iopData.OS < 0 || iopData.OS > 60)) {
    throw new Error('IOP OS value must be between 0 and 60 mmHg');
  }

  const update = {
    $set: {
      'examinations.iop': iopData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    throw new Error('Visit not found');
  }

  log.info('[VISIT] IOP updated', {
    visitId: visit.visitId,
    userId,
    iopOD: iopData.OD,
    iopOS: iopData.OS
  });

  return visit;
}

/**
 * Update visual acuity ONLY
 * Additional granular method for StudioVision workflow
 *
 * @param {string} visitId - Visit ID
 * @param {Object} vaData - Visual acuity data (Monoyer/Parinaud scales)
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitVisualAcuity(visitId, vaData, userId) {
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    throw new Error('Invalid visit ID');
  }

  const update = {
    $set: {
      'examinations.visualAcuity': vaData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    throw new Error('Visit not found');
  }

  log.info('[VISIT] Visual acuity updated', {
    visitId: visit.visitId,
    userId
  });

  return visit;
}

/**
 * Update anterior segment examination ONLY
 *
 * @param {string} visitId - Visit ID
 * @param {Object} anteriorData - Anterior segment examination data
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitAnteriorSegment(visitId, anteriorData, userId) {
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    throw new Error('Invalid visit ID');
  }

  const update = {
    $set: {
      'examinations.anteriorSegment': anteriorData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    throw new Error('Visit not found');
  }

  log.info('[VISIT] Anterior segment updated', {
    visitId: visit.visitId,
    userId
  });

  return visit;
}

/**
 * Update posterior segment/fundus examination ONLY
 *
 * @param {string} visitId - Visit ID
 * @param {Object} posteriorData - Posterior segment examination data
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitPosteriorSegment(visitId, posteriorData, userId) {
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    throw new Error('Invalid visit ID');
  }

  const update = {
    $set: {
      'examinations.posteriorSegment': posteriorData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    throw new Error('Visit not found');
  }

  log.info('[VISIT] Posterior segment updated', {
    visitId: visit.visitId,
    userId
  });

  return visit;
}

module.exports = {
  // Core methods (matching CareVision's DonConsultation.cs)
  updateVisitRefraction,      // ModifierConsultationRefrac
  updateVisitDiagnosis,       // ModifierConsultationPathologie
  updateVisitTreatment,       // ModifierConsultationTraite
  updateVisitIOP,             // ModifierConsultationRefra (TOD/TOG)

  // Extended methods for MedFlow's ophthalmology workflow
  updateVisitVisualAcuity,
  updateVisitAnteriorSegment,
  updateVisitPosteriorSegment
};
```

---

## API Route Pattern

### New Section-Specific Endpoints

```javascript
// backend/routes/visits.js

const visitGranularService = require('../services/visitGranularService');

/**
 * PUT /api/visits/:id/refraction
 * Update refraction data only - mirrors CareVision's ModifierConsultationRefrac
 */
router.put('/:id/refraction', protect, authorize('doctor', 'orthoptist'), async (req, res) => {
  try {
    const visit = await visitGranularService.updateVisitRefraction(
      req.params.id,
      req.body,
      req.user._id
    );
    return success(res, visit, 'Refraction updated successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
});

/**
 * PUT /api/visits/:id/diagnosis
 * Update diagnosis only - mirrors CareVision's ModifierConsultationPathologie
 */
router.put('/:id/diagnosis', protect, authorize('doctor'), async (req, res) => {
  try {
    const visit = await visitGranularService.updateVisitDiagnosis(
      req.params.id,
      req.body.diagnoses,
      req.user._id
    );
    return success(res, visit, 'Diagnosis updated successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
});

/**
 * PUT /api/visits/:id/treatment
 * Update treatment only - mirrors CareVision's ModifierConsultationTraite
 */
router.put('/:id/treatment', protect, authorize('doctor'), async (req, res) => {
  try {
    const visit = await visitGranularService.updateVisitTreatment(
      req.params.id,
      req.body,
      req.user._id
    );
    return success(res, visit, 'Treatment updated successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
});

/**
 * PUT /api/visits/:id/iop
 * Update IOP only - mirrors CareVision's ModifierConsultationRefra (TOD/TOG)
 */
router.put('/:id/iop', protect, authorize('doctor', 'orthoptist', 'nurse'), async (req, res) => {
  try {
    const visit = await visitGranularService.updateVisitIOP(
      req.params.id,
      req.body,
      req.user._id
    );
    return success(res, visit, 'IOP updated successfully');
  } catch (err) {
    return error(res, err.message, 400);
  }
});
```

---

## Frontend Integration Pattern

### visitService.js - Granular Save Methods

```javascript
// frontend/src/services/visitService.js

/**
 * Save refraction data only - atomic operation
 */
export const saveRefraction = async (visitId, refractionData) => {
  const response = await api.put(`/visits/${visitId}/refraction`, refractionData);
  return response.data;
};

/**
 * Save diagnosis data only - atomic operation
 */
export const saveDiagnosis = async (visitId, diagnoses) => {
  const response = await api.put(`/visits/${visitId}/diagnosis`, { diagnoses });
  return response.data;
};

/**
 * Save treatment data only - atomic operation
 */
export const saveTreatment = async (visitId, treatmentData) => {
  const response = await api.put(`/visits/${visitId}/treatment`, treatmentData);
  return response.data;
};

/**
 * Save IOP data only - atomic operation
 */
export const saveIOP = async (visitId, iopData) => {
  const response = await api.put(`/visits/${visitId}/iop`, iopData);
  return response.data;
};
```

### StudioVision Component Pattern

```jsx
// frontend/src/pages/StudioVisionConsultation.jsx

import { saveRefraction, saveDiagnosis, saveTreatment, saveIOP } from '../services/visitService';

const StudioVisionConsultation = () => {
  // Section-specific save handlers with independent error handling

  const handleRefractionSave = async (refractionData) => {
    try {
      await saveRefraction(visitId, refractionData);
      toast.success('Réfraction enregistrée');
    } catch (error) {
      toast.error(`Erreur réfraction: ${error.message}`);
      // Other sections remain unaffected
    }
  };

  const handleDiagnosisSave = async (diagnoses) => {
    try {
      await saveDiagnosis(visitId, diagnoses);
      toast.success('Diagnostic enregistré');
    } catch (error) {
      toast.error(`Erreur diagnostic: ${error.message}`);
      // Refraction and other sections remain saved
    }
  };

  const handleTreatmentSave = async (treatmentData) => {
    try {
      await saveTreatment(visitId, treatmentData);
      toast.success('Traitement enregistré');
    } catch (error) {
      toast.error(`Erreur traitement: ${error.message}`);
    }
  };

  const handleIOPSave = async (iopData) => {
    try {
      await saveIOP(visitId, iopData);
      toast.success('Tension oculaire enregistrée');
    } catch (error) {
      toast.error(`Erreur tension: ${error.message}`);
    }
  };

  return (
    <div className="studio-vision-consultation">
      {/* Each section has independent save */}
      <RefractionSection onSave={handleRefractionSave} />
      <DiagnosisSection onSave={handleDiagnosisSave} />
      <TreatmentSection onSave={handleTreatmentSave} />
      <IOPSection onSave={handleIOPSave} />
    </div>
  );
};
```

---

## Comparison: Before vs After

### Before (Monolithic)

```
┌─────────────────────────────────────────────────────────────────┐
│                     User saves any field                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PUT /api/visits/:id                           │
│                                                                  │
│   Object.assign(visit, req.body);                               │
│   await visit.save();  // TRIGGERS ALL PRE-SAVE HOOKS           │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Pre-save Hook 1: Date validation                        │   │
│   │ Pre-save Hook 2: ID generation + calculations           │   │
│   │ Pre-save Hook 3: FeeSchedule lookup (N+1 queries)       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   If ANY hook fails → ENTIRE SAVE FAILS → USER LOSES ALL DATA   │
└─────────────────────────────────────────────────────────────────┘
```

### After (Granular - CareVision Pattern)

```
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ User saves         │  │ User saves         │  │ User saves         │
│ refraction         │  │ diagnosis          │  │ treatment          │
└─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ PUT /visits/:id/   │  │ PUT /visits/:id/   │  │ PUT /visits/:id/   │
│ refraction         │  │ diagnosis          │  │ treatment          │
└─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ findByIdAndUpdate  │  │ findByIdAndUpdate  │  │ findByIdAndUpdate  │
│ runValidators:false│  │ runValidators:false│  │ runValidators:false│
│ (BYPASSES hooks)   │  │ (BYPASSES hooks)   │  │ (BYPASSES hooks)   │
└─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘
          │                       │                       │
          ▼                       ▼                       ▼
      ✓ SAVED              ✓ SAVED               ✓ SAVED
   (independent)        (independent)         (independent)
```

---

## Key Implementation Rules

### DO

1. **Use `findByIdAndUpdate()`** with `runValidators: false` for section-specific updates
2. **Validate at service layer** - lightweight, section-specific validation
3. **Create separate API endpoints** for each logical section
4. **Log all updates** with visitId and userId for audit trail
5. **Return updated document** using `{ new: true }` option
6. **Handle errors independently** - each section save has its own try/catch

### DON'T

1. **Don't add more logic to pre-save hooks** - keep them minimal
2. **Don't use `document.save()`** for partial updates - it triggers all hooks
3. **Don't cascade transactions** across sections
4. **Don't swallow errors** - always propagate to the caller
5. **Don't skip validation entirely** - do lightweight validation at service layer

---

## Field Mapping: CareVision → MedFlow

| CareVision Field | MedFlow Field | Section |
|------------------|---------------|---------|
| REFRACTION | examinations.refraction | Refraction |
| LUNETTES | examinations.glasses / prescriptions | Refraction |
| Observation | diagnoses.notes | Diagnosis |
| DOMINANTE | diagnoses.dominant | Diagnosis |
| Ordonnance | plan.medications | Treatment |
| Ordonnance2 | prescriptions | Treatment |
| TOD | examinations.iop.OD | IOP |
| TOG | examinations.iop.OS | IOP |

---

## Testing Strategy

### Unit Tests for Granular Service

```javascript
// backend/tests/unit/visitGranularService.test.js

describe('visitGranularService', () => {
  describe('updateVisitRefraction', () => {
    it('should update only refraction fields', async () => {
      // Verify that only refraction is updated, not other fields
    });

    it('should bypass pre-save hooks', async () => {
      // Verify that FeeSchedule lookup is NOT triggered
    });

    it('should fail independently without affecting other sections', async () => {
      // Verify that diagnosis/treatment remain intact on refraction error
    });
  });

  // Similar tests for updateVisitDiagnosis, updateVisitTreatment, updateVisitIOP
});
```

### Integration Tests

```javascript
describe('Granular Update Integration', () => {
  it('should allow saving refraction while diagnosis save fails', async () => {
    // 1. Save refraction successfully
    // 2. Attempt to save invalid diagnosis
    // 3. Verify refraction is still saved
    // 4. Fix and save diagnosis
    // 5. Verify both are now saved
  });
});
```

---

## References

- **CareVision Source**: `comparison/carevision-source/Care.Vision.DAO/DonConsultation.cs`
- **Bug Catalog**: `backend/docs/BUG_CATALOG.md`
- **Spec Document**: `.auto-claude/specs/001-complete-the-project/spec.md`
- **Implementation Plan**: `.auto-claude/specs/001-complete-the-project/implementation_plan.json`

---

*Document generated: 2026-01-26*
*Author: Auto-Claude Build System*
*Task: subtask-1-2 - Document CareVision's granular update pattern*
