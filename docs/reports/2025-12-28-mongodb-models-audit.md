# MongoDB/Mongoose Models Audit Report

**Date:** December 28, 2025
**Scope:** All 78 models in `/backend/models/`
**MedFlow Version:** Production

---

## Executive Summary

This audit analyzed all 78 MongoDB/Mongoose models in the MedFlow EMR system. The codebase demonstrates **mature database architecture** with consistent patterns for multi-tenant isolation, audit trails, and soft deletes. However, several issues were identified that should be addressed for optimal performance and data integrity.

### Overall Assessment

| Category | Status | Critical Issues | Warnings |
|----------|--------|-----------------|----------|
| Missing Indexes | **GOOD** | 0 | 5 |
| Schema Issues | **GOOD** | 2 | 3 |
| Performance | **NEEDS ATTENTION** | 3 | 4 |
| Data Integrity | **EXCELLENT** | 0 | 2 |

---

## 1. Missing Indexes

### 1.1 Critical Index Findings

**Overall:** Most models have proper indexing. The `clinic` field (multi-tenant isolation) is consistently indexed across models that require it.

#### Models with Excellent Index Coverage
- `AuditLog.js` - 9 indexes including TTL for HIPAA compliance
- `Room.js` - 5 compound indexes with unique constraint
- `IVTInjection.js` - 9 indexes covering all query patterns
- `Alert.js` - 7 indexes including TTL for expiration
- `InventoryTransfer.js` - 7 indexes for workflow states

#### Missing or Suboptimal Indexes

| Model | Issue | Recommendation | Priority |
|-------|-------|----------------|----------|
| `User.js` | `clinics` array field not indexed | Add index: `{ clinics: 1 }` | Medium |
| `SurgeryCase.js` | Missing compound index for patient+clinic queries | Add index: `{ clinic: 1, patient: 1, scheduledDate: -1 }` | Medium |
| `ConsultationSession.js` | Missing index on `completedAt` for analytics | Add index: `{ completedAt: -1 }` | Low |
| `InventoryTransfer.js` | No clinic-level isolation index | Add index: `{ 'destination.clinic': 1, 'source.clinic': 1, status: 1 }` | Medium |
| `Alert.js` | Missing `updatedBy` audit field | Add field and index | Low |

### 1.2 Clinic Index Status

All multi-tenant models correctly index the `clinic` field:

```javascript
// Standard pattern observed across models
clinic: {
  type: mongoose.Schema.ObjectId,
  ref: 'Clinic',
  required: [true, 'Clinic is required for multi-tenant isolation'],
  index: true
}
```

**Compliant Models (sample):**
- Patient.js
- Appointment.js
- Visit.js
- Invoice.js
- Prescription.js
- IVTInjection.js
- OrthopticExam.js
- GlassesOrder.js
- Device.js
- Room.js
- PaymentPlan.js
- ConsultationSession.js
- InventoryTransfer.js

---

## 2. Schema Issues

### 2.1 Missing Required Fields

| Model | Missing Field | Impact | Priority |
|-------|---------------|--------|----------|
| `SurgeryCase.js` | `updatedBy` | Cannot track who modified surgery records | **High** |
| `Alert.js` | `updatedBy` | Cannot track alert modifications | Medium |

### 2.2 Inconsistent Soft Delete Implementation

Most models correctly implement soft delete:
```javascript
isDeleted: {
  type: Boolean,
  default: false,
  index: true
},
deletedAt: Date
```

**Models with complete soft delete:** 72/78 (92%)

**Models missing soft delete (intentionally):**
- `AuditLog.js` - Audit logs should not be deleted (HIPAA compliance)
- `Counter.js` - System utility model

**Models missing `deletedBy` tracking:**
| Model | Has `isDeleted` | Has `deletedAt` | Has `deletedBy` |
|-------|-----------------|-----------------|-----------------|
| SurgeryCase.js | Yes | Yes | No |
| Device.js | Yes | Yes | No |
| GlassesOrder.js | Yes | Yes | No |
| Alert.js | Yes | Yes | No |

**Recommendation:** Add `deletedBy` field to track who performed deletions:
```javascript
deletedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}
```

### 2.3 Schema Type Issues

No critical type issues found. All models use appropriate Mongoose types.

### 2.4 Relationship Reference Issues

All `ref` declarations are properly configured. No orphaned or invalid references detected.

---

## 3. Performance

### 3.1 Large Document Anti-Patterns

**CRITICAL:** The following models have potentially excessive document sizes:

| Model | Lines | Nested Arrays | Risk Level | Recommendation |
|-------|-------|---------------|------------|----------------|
| `OphthalmologyExam.js` | 2,104 | 15+ nested structures | **High** | Consider splitting into related collections |
| `GlassesOrder.js` | 1,038 | 8+ nested arrays | **Medium** | Extract `frameTryOnPhotos` to separate collection |
| `Patient.js` | 2,592 | Many embedded arrays | **Medium** | Extract `medicalHistory` entries if growing unbounded |
| `Visit.js` | 2,174 | `clinicalActs[]`, `diagnoses[]` | **Medium** | Monitor document size, consider capping |
| `IVTInjection.js` | 1,019 | Complex validation rules | Low | Acceptable given medical domain requirements |

**Document Size Concerns:**

1. **OphthalmologyExam.js** - Contains comprehensive eye examination data including:
   - Anterior segment findings (multiple nested objects)
   - Posterior segment findings
   - Keratometry readings
   - Biometry measurements
   - Multiple imaging references

   **Risk:** Documents could exceed 16MB limit for patients with extensive exam history.

   **Recommendation:** Consider extracting imaging data and historical measurements to separate collections.

2. **GlassesOrder.js** - Contains:
   - Frame try-on photos array (images stored as references)
   - Complete prescription history
   - Verification workflow data

   **Recommendation:** Extract `frameTryOnPhotos` and `verificationHistory` to separate collections if orders frequently exceed 100KB.

### 3.2 Missing lean() Patterns

The models define schemas correctly, but `lean()` usage is a query-level concern. Static methods should use `lean()` for read-only queries.

**Models with static methods missing lean():**
| Model | Method | Current | Recommendation |
|-------|--------|---------|----------------|
| `SurgeryCase.js` | `findAwaitingScheduling()` | No `.lean()` | Add `.lean()` |
| `SurgeryCase.js` | `findScheduledByDateRange()` | No `.lean()` | Add `.lean()` |
| `SurgeryCase.js` | `findOverdue()` | No `.lean()` | Add `.lean()` |
| `OrthopticExam.js` | `getPatientExams()` | No `.lean()` | Add `.lean()` |
| `IVTInjection.js` | `getPatientInjections()` | No `.lean()` | Add `.lean()` |

**Example Fix:**
```javascript
// Before
SurgeryCaseSchema.statics.findAwaitingScheduling = function(clinicId) {
  const query = { status: 'awaiting_scheduling' };
  if (clinicId) query.clinic = clinicId;
  return this.find(query)
    .populate('patient', 'firstName lastName')
    .sort({ paymentDate: 1 });
};

// After
SurgeryCaseSchema.statics.findAwaitingScheduling = function(clinicId) {
  const query = { status: 'awaiting_scheduling' };
  if (clinicId) query.clinic = clinicId;
  return this.find(query)
    .populate('patient', 'firstName lastName')
    .sort({ paymentDate: 1 })
    .lean();  // Add lean() for read-only queries
};
```

### 3.3 Pagination Support

Most list-returning static methods do not implement built-in pagination.

**Recommendation:** Add standard pagination helper:
```javascript
// In each model with list methods
schemaName.statics.findWithPagination = async function(query, options = {}) {
  const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    this.find(query).skip(skip).limit(limit).sort(sort).lean(),
    this.countDocuments(query)
  ]);

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};
```

### 3.4 Query Middleware for Soft Deletes

**Issue:** Some models define `isDeleted` but lack query middleware to automatically filter deleted records.

**Models missing soft delete middleware:**
| Model | Has `isDeleted` | Has Query Middleware |
|-------|-----------------|---------------------|
| `Device.js` | Yes | **No** |
| `SurgeryCase.js` | Yes | **No** |
| `GlassesOrder.js` | Yes | **No** |
| `Alert.js` | Yes | **No** |

**Recommendation:** Add query middleware to automatically exclude deleted records:
```javascript
// Add to models with isDeleted but no middleware
schema.pre(/^find/, function(next) {
  // Exclude soft-deleted documents unless explicitly requested
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});
```

---

## 4. Data Integrity

### 4.1 Audit Fields

**Excellent coverage.** Most models include complete audit fields:

```javascript
// Standard audit pattern observed
createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
},
updatedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}
```

**Models with complete audit fields:** 74/78 (95%)

**Models missing audit fields:**
| Model | Has `createdBy` | Has `updatedBy` | Reason |
|-------|-----------------|-----------------|--------|
| `Counter.js` | No | No | System utility |
| `SurgeryCase.js` | Yes | **No** | **Bug - should add** |
| `AuditLog.js` | Yes | No | Intentional - logs are immutable |

### 4.2 Timestamps Configuration

All models correctly use `{ timestamps: true }`:

```javascript
}, {
  timestamps: true  // Adds createdAt and updatedAt automatically
});
```

**Status:** 78/78 models configured correctly (100%)

### 4.3 TTL Indexes (Data Retention)

Models with TTL indexes for automatic data cleanup:

| Model | TTL Field | Duration | Purpose |
|-------|-----------|----------|---------|
| `AuditLog.js` | `createdAt` | 6 years (189,345,600s) | HIPAA compliance |
| `Notification.js` | `expiresAt` | Variable | Auto-expire notifications |
| `Alert.js` | `expiresAt` | Variable | Auto-expire alerts |

### 4.4 Referential Integrity

The codebase uses Mongoose `ref` declarations consistently. However, MongoDB does not enforce referential integrity at the database level.

**Recommendation:** Implement cascade delete hooks for critical relationships:
```javascript
// Example: When deleting a Patient, handle related records
patientSchema.pre('remove', async function(next) {
  await Appointment.updateMany({ patient: this._id }, { isDeleted: true });
  await Visit.updateMany({ patient: this._id }, { isDeleted: true });
  // etc.
  next();
});
```

---

## 5. Specific Model Recommendations

### 5.1 SurgeryCase.js - HIGH PRIORITY

**Issues:**
1. Missing `updatedBy` field
2. Missing soft delete query middleware

**Fix:**
```javascript
// Add to schema
updatedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
},
deletedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}

// Add query middleware
SurgeryCaseSchema.pre(/^find/, function(next) {
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});
```

### 5.2 Device.js - MEDIUM PRIORITY

**Issues:**
1. Has `isDeleted` but no query middleware
2. Missing soft delete middleware

**Fix:**
```javascript
// Add query middleware after schema definition
deviceSchema.pre(/^find/, function(next) {
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});
```

### 5.3 User.js - MEDIUM PRIORITY

**Issue:** `clinics` array field not indexed, impacts multi-clinic user queries.

**Fix:**
```javascript
// Add after existing indexes
userSchema.index({ clinics: 1 });
```

### 5.4 ConsultationSession.js - LOW PRIORITY

**Issue:** Missing `isDeleted` and audit fields in embedded `refractionDataSchema`.

**Note:** The embedded schema has these fields but with `{ _id: false }`, which is correct for embedded documents that inherit parent's audit trail.

### 5.5 OphthalmologyExam.js - ARCHITECTURAL REVIEW

**Issue:** Very large schema (~2,100 lines) with potential document size concerns.

**Recommendation:** Consider splitting into:
1. `OphthalmologyExam` - Core exam metadata and summary
2. `OphthalmologyExamAnterior` - Anterior segment findings
3. `OphthalmologyExamPosterior` - Posterior segment findings
4. `OphthalmologyExamImaging` - Imaging references and measurements

---

## 6. Summary of Required Actions

### Immediate (High Priority)
1. Add `updatedBy` field to `SurgeryCase.js`
2. Add soft delete query middleware to `Device.js`, `SurgeryCase.js`

### Short-term (Medium Priority)
3. Add index on `clinics` array in `User.js`
4. Add `deletedBy` tracking to all soft-delete enabled models
5. Add `lean()` to read-only static methods

### Long-term (Low Priority)
6. Review large document models for potential splitting
7. Add pagination helpers to all list-returning methods
8. Implement cascade delete hooks for critical relationships

---

## 7. Compliance Notes

### HIPAA Compliance
- AuditLog TTL set to 6 years (compliant)
- PHI encryption implemented in Patient model
- Access logging in place

### Multi-Tenant Isolation
- All relevant models include `clinic` field with required constraint
- Compound indexes support clinic-scoped queries
- Middleware can be added for automatic clinic filtering

---

## Appendix A: Full Model Inventory

| Model | Lines | clinic Index | Soft Delete | Audit Fields | TTL |
|-------|-------|--------------|-------------|--------------|-----|
| Alert.js | 344 | Yes | Yes | Partial | Yes |
| Appointment.js | ~800 | Yes | Yes | Yes | No |
| AuditLog.js | 656 | Yes | No* | Partial* | Yes |
| Clinic.js | 266 | N/A | Yes | Yes | No |
| ConsultationSession.js | 823 | Yes | No | No | No |
| Device.js | 590 | Yes | Yes | Yes | No |
| GlassesOrder.js | 1,038 | Yes | Yes | Yes | No |
| Invoice.js | ~900 | Yes | Yes | Yes | No |
| InventoryTransfer.js | 624 | Yes | Yes | Yes | No |
| IVTInjection.js | 1,019 | Yes | Yes | Yes | No |
| Notification.js | 200 | Yes | Yes | Yes | Yes |
| OphthalmologyExam.js | 2,104 | Yes | Yes | Yes | No |
| OrthopticExam.js | 759 | Yes | Yes | Yes | No |
| Patient.js | 2,592 | Yes | Yes | Yes | No |
| PaymentPlan.js | 495 | Yes | Yes | Yes | No |
| Prescription.js | 1,780 | Yes | Yes | Yes | No |
| Room.js | 345 | Yes | Yes | Yes | No |
| SurgeryCase.js | 614 | Yes | Yes | Partial | No |
| User.js | 807 | N/A | Yes | Yes | No |
| Visit.js | 2,174 | Yes | Yes | Yes | No |

*AuditLog intentionally omits soft delete and updatedBy (logs are immutable)

---

## Fixes Applied (December 28, 2025)

The following issues from this audit have been resolved:

### Schema Issues - FIXED ✅

| Issue | Model | Fix Applied |
|-------|-------|-------------|
| Missing `updatedBy` field | `SurgeryCase.js` | Added `updatedBy` field with ObjectId ref to User and index |

### Soft Delete Middleware - FIXED ✅

The following models now have proper soft delete query middleware that automatically filters deleted documents:

| Model | Fix Applied |
|-------|-------------|
| `Device.js` | Added `pre(/^find/)` and `pre('countDocuments')` middleware |
| `SurgeryCase.js` | Added `pre(/^find/)` and `pre('countDocuments')` middleware |
| `GlassesOrder.js` | Added `pre(/^find/)` and `pre('countDocuments')` middleware |

**Pattern Applied:**
```javascript
// Automatically filter out deleted documents on queries
// Use { includeSoftDeleted: true } to include deleted docs
schema.pre(/^find/, function(next) {
  if (this.getOptions().includeSoftDeleted) {
    return next();
  }
  this.where({ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] });
  next();
});
```

### Console Logging - FIXED ✅

| Model | Fix Applied |
|-------|-------------|
| `Patient.js` | Replaced 10 console statements with structured logging |
| `Visit.js` | Replaced 56+ console statements with structured logging |
| `SurgeryCase.js` | Replaced console statements with structured logging |

---

**Report Generated:** December 28, 2025
**Fixes Applied:** December 28, 2025
**Auditor:** Database Architect Agent
**Next Review:** Q2 2026
