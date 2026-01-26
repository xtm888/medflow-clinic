# MedFlow Bug Catalog - Visit.js Pre-Save Hook Issues

## Overview

This document catalogs critical bugs in the Visit.js model that prevent MedFlow from reliably replacing CareVision. The primary issue is **monolithic pre-save hooks** that cause cascading failures when any single operation fails.

**Root Cause Pattern**: Unlike CareVision's granular update approach (see `DonConsultation.cs` with separate `ModifierConsultationRefrac`, `ModifierConsultationPathologie`, `ModifierConsultationTraite`), MedFlow uses complex pre-save hooks that bundle multiple operations together, causing all-or-nothing failures.

---

## Bug Summary Table

| Bug ID | Description | Severity | Affected Component | Root Cause | Status |
|--------|-------------|----------|-------------------|------------|--------|
| BUG-001 | Multiple cascading pre-save hooks | Critical | Visit.js lines 865-976 | 3 separate pre-save hooks run sequentially; any failure blocks entire save | Pending |
| BUG-002 | Async FeeSchedule lookup in pre-save | High | Visit.js lines 934-976 | Database query in pre-save can timeout or fail, blocking clinical data save | Pending |
| BUG-003 | Monolithic completeVisit method | Critical | Visit.js lines 1133-1461 | 330+ line method with complex transaction handling; partial failures leave inconsistent state | Pending |
| BUG-004 | Convention snapshot complexity | Medium | Visit.js lines 1014-1074 | Multiple model requires and async queries in instance method | Pending |
| BUG-005 | Invoice generation in pre-save chain | High | Visit.js lines 1694-2159 | 465+ line method with 15+ async operations; single failure blocks entire invoice | Pending |
| BUG-006 | Circular model dependencies | Medium | Visit.js (multiple locations) | Inline `require()` calls for Patient, Company, Prescription, Invoice, Appointment | Pending |
| BUG-007 | Silent post-save failures | Medium | Visit.js lines 2181-2241 | Post-save Patient.lastVisit update can silently fail | Pending |
| BUG-008 | No granular update API endpoints | Critical | visits.js routes | All updates use full document saves triggering all hooks | Pending |
| BUG-009 | Optimistic concurrency conflicts | Low | Visit.js lines 765-806 | Version field + editLock can conflict during concurrent edits | Pending |
| BUG-010 | Error swallowing in reservation flow | Medium | Visit.js lines 1261-1309 | Prescription reservation errors are logged but don't stop completion | Pending |

---

## Detailed Bug Analysis

### BUG-001: Multiple Cascading Pre-Save Hooks

**Location**: `backend/models/Visit.js` lines 865-976

**Description**: The Visit model has THREE separate pre-save hooks that execute sequentially:

1. **Hook 1 (lines 865-903)**: Date validation
   - Validates visitDate, checkInTime, endTime, completedAt are not in future
   - Can throw ValidationError with statusCode 400

2. **Hook 2 (lines 906-931)**: ID generation and calculations
   - Generates visitId using atomic Counter
   - Calculates BMI from vital signs
   - Calculates timeSpent from start/end times

3. **Hook 3 (lines 934-976)**: FeeSchedule price auto-population
   - Iterates through all clinicalActs
   - Performs async FeeSchedule.findOne() for each act without a price
   - Can fail on database timeout or connection issues

**Cascading Failure Pattern**:
```
User saves refraction data
  → Hook 1 runs (date validation) ✓
  → Hook 2 runs (ID generation) ✓
  → Hook 3 runs (FeeSchedule lookup)
    → Database timeout on FeeSchedule query
    → Error thrown
    → ENTIRE SAVE FAILS
    → User loses refraction data they just entered
```

**Impact**: Clinical data loss when unrelated FeeSchedule lookup fails.

**CareVision Comparison**: CareVision's `DonConsultation.cs` saves each section independently:
```csharp
// Each section saved atomically - failure of one doesn't affect others
ModifierConsultationRefrac(c);    // Saves refraction only
ModifierConsultationPathologie(c); // Saves diagnosis only
ModifierConsultationTraite(c);     // Saves treatment only
```

---

### BUG-002: Async FeeSchedule Lookup in Pre-Save

**Location**: `backend/models/Visit.js` lines 934-976

**Description**: The pre-save hook performs database queries for FeeSchedule lookups:

```javascript
visitSchema.pre('save', async function(next) {
  if (this.isModified('clinicalActs') && this.clinicalActs?.length > 0) {
    const FeeSchedule = mongoose.model('FeeSchedule');

    for (const act of this.clinicalActs) {
      if ((act.price === undefined || act.price === null || act.price === 0) &&
          act.actCode && !act.priceCapturedAt) {
        try {
          const fee = await FeeSchedule.findOne({  // <-- ASYNC DB QUERY IN PRE-SAVE
            code: act.actCode,
            active: true,
            // Complex date range query
          });
          // ...
        } catch (err) {
          log.error('Error looking up FeeSchedule...', { error: err.message });
          // Error is logged but doesn't block - but the pattern is still problematic
        }
      }
    }
  }
  next();
});
```

**Problems**:
1. N+1 query pattern - one query per clinical act
2. Database connection issues cause save failures
3. Slow FeeSchedule queries block clinical data save
4. Complex date range filtering adds query overhead

**Recommended Fix**: Move price lookup to a dedicated service method, not pre-save hook.

---

### BUG-003: Monolithic completeVisit Method

**Location**: `backend/models/Visit.js` lines 1133-1461

**Description**: The `completeVisit()` method is 330+ lines performing multiple operations:

1. Idempotency check
2. Status transition validation
3. Transaction detection (replica set check)
4. Auto-create prescriptions from plan.medications
5. Reserve inventory for all prescriptions (loop)
6. Generate invoice
7. Update appointment status
8. Update visit status
9. Update Patient.lastVisit
10. Commit/abort transaction

**Cascading Failure Pattern**:
```
visit.completeVisit(userId)
  → Check if completed (idempotency) ✓
  → Validate status transition ✓
  → Start transaction (if replica set) ✓
  → Create prescriptions from plan.medications ✓
  → Reserve inventory for prescription 1 ✓
  → Reserve inventory for prescription 2 FAILS
    → Rollback triggered
    → Prescription 1 reservation needs compensation
    → Patient.lastVisit update never happens
    → VISIT STUCK IN INCONSISTENT STATE
```

**Compensating Transaction Issues** (lines 1466-1657):
- `_executeCompensatingRollback` method attempts to undo changes
- Complex LIFO stack processing
- Individual compensation failures are logged but don't stop others
- Can leave database in partially-rolled-back state

**Impact**: High risk of data inconsistency during visit completion.

---

### BUG-004: Convention Snapshot Complexity

**Location**: `backend/models/Visit.js` lines 1014-1074

**Description**: The `captureConventionSnapshot()` method performs extensive async work:

```javascript
visitSchema.methods.captureConventionSnapshot = async function() {
  try {
    const Patient = require('./Patient');  // <-- INLINE REQUIRE
    const Company = require('./Company');  // <-- INLINE REQUIRE

    const patient = await Patient.findById(this.patient)
      .select('convention')
      .populate('convention.company', 'name companyId contract.status defaultCoverage coverageRules');

    // Multiple validation checks
    // Complex coverage calculations

    await this.save();  // <-- RECURSIVE SAVE TRIGGERS ALL PRE-SAVE HOOKS AGAIN

    return this.billing.conventionSnapshot;
  } catch (error) {
    log.error('[VISIT] Error capturing convention snapshot:', error.message);
    return null;  // <-- ERROR SWALLOWED, RETURNS NULL
  }
};
```

**Problems**:
1. Inline `require()` calls create potential circular dependencies
2. Recursive `this.save()` triggers all pre-save hooks again
3. Errors are swallowed and return null silently
4. Complex population chain can fail on missing relations

---

### BUG-005: Invoice Generation Complexity

**Location**: `backend/models/Visit.js` lines 1694-2159

**Description**: The `generateInvoice()` method is 465+ lines with extensive operations:

1. Check existing invoice
2. Lookup consultation fee from FeeSchedule
3. Process clinical acts (with fallback FeeSchedule lookup)
4. Add device/diagnostic charges from OphthalmologyExam
5. Add IVT treatments
6. Add laboratory orders
7. Add examination orders
8. Add surgery case charges
9. Add medications from prescriptions
10. Calculate totals
11. Create Invoice document
12. Update visit billing fields

**Problems**:
```javascript
// Example: Each section has try/catch that swallows errors
try {
  // Add device charges...
} catch (examError) {
  log.error('Error adding device charges to invoice:', examError);
  // Continue without device charges if exam lookup fails  <-- SILENT FAILURE
}
```

- 15+ try/catch blocks that swallow errors
- Invoice may be created missing significant charges
- No rollback if final Invoice.create() fails after calculations

---

### BUG-006: Circular Model Dependencies

**Location**: Multiple locations in Visit.js

**Description**: Models are required inline within methods rather than at module top:

```javascript
// Line 1016
const Patient = require('./Patient');
const Company = require('./Company');

// Line 1135
const Invoice = require('./Invoice');
const Prescription = require('./Prescription');
const Appointment = require('./Appointment');

// Line 1661
const Alert = require('./Alert');

// Line 1822
const OphthalmologyExam = require('./OphthalmologyExam');
```

**Problems**:
1. Potential circular dependency issues
2. Runtime require() adds overhead on each method call
3. Harder to trace dependencies
4. Can cause "Cannot read property of undefined" errors during startup

---

### BUG-007: Silent Post-Save Failures

**Location**: `backend/models/Visit.js` lines 2181-2241

**Description**: Post-save hook updates Patient.lastVisit but errors are swallowed:

```javascript
visitSchema.post('save', async (doc) => {
  try {
    const Patient = require('./Patient');

    if (doc.status === 'completed' && doc.patient) {
      await Patient.findOneAndUpdate(/* ... */);
      log.info('Auto-updated lastVisit for patient', /* ... */);
    }

    // Handle cancelled visits...
  } catch (error) {
    log.error('[VISIT] Error auto-updating patient lastVisit:', error);
    // Don't throw - this is a non-critical operation  <-- SILENT FAILURE
  }
});
```

**Impact**: Patient.lastVisit may become stale, affecting patient timeline displays.

---

### BUG-008: No Granular Update API Endpoints

**Location**: `backend/routes/visits.js`

**Description**: All visit updates go through the generic PUT endpoint:

```javascript
// Line 470
router.put('/:id', protect, authorize(...), async (req, res) => {
  // ...
  Object.assign(visit, req.body);  // Merge ALL fields
  await visit.save();  // Triggers ALL pre-save hooks
  // ...
});
```

**Missing Endpoints** (compared to CareVision pattern):
- `PUT /visits/:id/refraction` - Save refraction only
- `PUT /visits/:id/diagnosis` - Save diagnosis only
- `PUT /visits/:id/treatment` - Save treatment only
- `PUT /visits/:id/iop` - Save IOP only

**Impact**: Cannot save individual sections without triggering full validation chain.

---

### BUG-009: Optimistic Concurrency Conflicts

**Location**: `backend/models/Visit.js` lines 765-806

**Description**: Two concurrency mechanisms that can conflict:

1. **Mongoose optimistic concurrency** (version field):
```javascript
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});
```

2. **Custom edit lock mechanism** (lines 2246-2348):
```javascript
editLock: {
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lockedAt: Date,
  lockExpires: Date
}
```

**Conflict Scenario**:
- User A acquires edit lock
- User B (admin) bypasses lock check in API
- Both save concurrently
- Version conflict throws VersionError
- Edit lock still held by User A
- Confusing error state

---

### BUG-010: Error Swallowing in Reservation Flow

**Location**: `backend/models/Visit.js` lines 1261-1309

**Description**: Prescription inventory reservation errors are captured but don't stop completion:

```javascript
for (const prescriptionId of this.prescriptions) {
  try {
    const prescription = await Prescription.findById(prescriptionId);
    if (prescription && prescription.type === 'medication') {
      const result = await prescription.reserveInventory(userId, session);
      reservationResults.push({
        prescriptionId: prescription.prescriptionId,
        success: result.success,
        results: result.results
      });
      // ...
    }
  } catch (error) {
    reservationResults.push({
      prescriptionId,
      success: false,
      error: error.message
    });
    // Continue processing other prescriptions  <-- SILENT CONTINUE
  }
}
```

**Impact**: Visit marked complete even with failed inventory reservations, causing pharmacy workflow issues.

---

## Recommended Fix Priority

### Phase 1: Critical (Immediate)
1. **BUG-008**: Create granular update endpoints (highest impact)
2. **BUG-001**: Refactor pre-save hooks to minimal validation only
3. **BUG-003**: Break down completeVisit into atomic operations

### Phase 2: High Priority
4. **BUG-002**: Move FeeSchedule lookup to service layer
5. **BUG-005**: Simplify invoice generation, add rollback

### Phase 3: Medium Priority
6. **BUG-004**: Simplify convention snapshot
7. **BUG-006**: Fix circular dependencies
8. **BUG-007**: Make post-save updates more robust
9. **BUG-010**: Add configurable strictness for reservations

### Phase 4: Low Priority
10. **BUG-009**: Consolidate concurrency mechanisms

---

## Implementation Strategy

Following CareVision's proven pattern from `DonConsultation.cs`:

```javascript
// NEW: backend/services/visitGranularService.js

/**
 * Update refraction data ONLY - mirrors CareVision's ModifierConsultationRefrac
 * Uses findByIdAndUpdate to BYPASS pre-save hooks
 */
async function updateVisitRefraction(visitId, refractionData, userId) {
  return Visit.findByIdAndUpdate(
    visitId,
    {
      $set: {
        'examinations.refraction': refractionData,
        updatedBy: userId,
        updatedAt: new Date()
      }
    },
    { new: true, runValidators: false }  // Skip heavy pre-save hooks
  );
}

/**
 * Update diagnosis ONLY - mirrors CareVision's ModifierConsultationPathologie
 */
async function updateVisitDiagnosis(visitId, diagnosisData, userId) {
  return Visit.findByIdAndUpdate(
    visitId,
    {
      $set: {
        diagnoses: diagnosisData,
        updatedBy: userId,
        updatedAt: new Date()
      }
    },
    { new: true, runValidators: false }
  );
}

/**
 * Update treatment ONLY - mirrors CareVision's ModifierConsultationTraite
 */
async function updateVisitTreatment(visitId, treatmentData, userId) {
  return Visit.findByIdAndUpdate(
    visitId,
    {
      $set: {
        'plan.medications': treatmentData,
        updatedBy: userId,
        updatedAt: new Date()
      }
    },
    { new: true, runValidators: false }
  );
}
```

---

## References

- **CareVision Pattern**: `comparison/carevision-source/Care.Vision.DAO/DonConsultation.cs`
- **Spec Document**: `.auto-claude/specs/001-complete-the-project/spec.md`
- **Implementation Plan**: `.auto-claude/specs/001-complete-the-project/implementation_plan.json`

---

*Document generated: 2026-01-26*
*Author: Auto-Claude Build System*
*Task: subtask-1-1 - Catalog existing Visit.js pre-save hook issues*
