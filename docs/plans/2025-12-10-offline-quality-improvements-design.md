# Offline & Quality Improvements Design

**Date:** 2025-12-10
**Status:** Approved
**Priority:** Feature First

## Overview

Implementation of 8 features to improve offline capabilities, data security, and code quality for MedFlow.

## Features

### Phase 1-4: Offline Service Wrappers

Full offline support for three services following `prescriptionService.js` pattern:

1. **ophthalmologyService** - Exams, refraction, fundus images, patient history
2. **laboratoryService** - Lab orders, results, pending tests, templates
3. **billingService** - Invoices, payments, patient billing

**IndexedDB Schema Additions:**
```javascript
labOrders: 'id, patientId, visitId, status, priority, lastSync'
labResults: 'id, orderId, patientId, testCode, status, lastSync'
invoices: 'id, patientId, visitId, status, dueDate, lastSync'
payments: 'id, invoiceId, patientId, method, lastSync'
```

### Phase 5-6: Sync Improvements

**Exponential Backoff:**
- Base delay: 1s
- Max delay: 5 minutes
- Max retries: 5
- Jitter: ±30%
- Retry sequence: ~1s → ~2s → ~4s → ~8s → ~16s

**Background Sync:**
- Register sync via Service Worker API
- Trigger on queue additions
- Auto-sync when device comes online

### Phase 7: IndexedDB Encryption

**Strategy:** Field-level encryption using Web Crypto API (AES-GCM)

**Sensitive Fields:**
- patients: firstName, lastName, nationalId, phoneNumber, email, address, allergies, medicalHistory
- prescriptions: medications, notes, diagnosis
- ophthalmologyExams: findings, diagnosis, notes, recommendations
- labOrders: notes, clinicalInfo
- labResults: results, interpretation, notes
- invoices: notes
- visits: chiefComplaint, diagnosis, notes, findings

**Key Management:**
- PBKDF2 key derivation from user session
- Stored in sessionStorage (cleared on logout)
- 100,000 iterations, SHA-256

### Phase 8: Frontend Testing

**Stack:** Vitest + React Testing Library + MSW

**Initial Coverage:**
- Critical services (offlineWrapper, syncService, encryptionService)
- Key components (Login, Queue, OfflineIndicator)

### Phase 9: Sentry Configuration

**Scope:** Frontend only
- Error tracking with PHI scrubbing
- 10% performance sampling
- Production environment only

## Implementation Order

```
4 (DB Schema) → 1-3 (Offline Services) → 5-6 (Sync) → 7 (Encryption) → 8-9 (Testing/Sentry)
```

## Files Changed

| Phase | Files | Est. Lines |
|-------|-------|------------|
| 1 | ophthalmologyService.js, database.js | ~450 |
| 2 | laboratoryService.js | ~400 |
| 3 | billingService.js | ~450 |
| 4 | database.js | ~50 |
| 5 | syncService.js | ~60 |
| 6 | offlineWrapper.js, syncService.js | ~40 |
| 7 | crypto/*.js (3 new), database.js | ~350 |
| 8 | vitest.config.js, test/*.js (5 new) | ~300 |
| 9 | sentry.js, main.jsx, ErrorBoundary.jsx | ~80 |

**Total: ~2,180 lines across 23 files**
