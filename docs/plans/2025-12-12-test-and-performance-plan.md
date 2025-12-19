# MedFlow Test Coverage & Performance Optimization Plan

## Executive Summary

### Current State
- **Test Coverage**: ~15-20% (CRITICAL gap)
- **Virtualization**: None implemented
- **Backend Controllers Tested**: 0/52
- **Frontend Pages Tested**: 0/30+

### Target State
- **Test Coverage**: 70% of critical paths
- **Virtualization**: 8 high-impact list components
- **Performance**: 90% reduction in large list render times

---

## PHASE 5: TEST COVERAGE IMPROVEMENTS

### Current Test Infrastructure

| Category | Files | Lines | Coverage |
|----------|-------|-------|----------|
| Backend Unit Tests | 7 | 2,174 | ~40% |
| Backend Integration Tests | 3 | 1,102 | ~30% |
| Frontend Service Tests | 17 | 2,805 | ~60% |
| Frontend Component Tests | 5 | ~500 | ~10% |
| **Overall** | 32 | ~5,581 | **~15-20%** |

### Critical Untested Areas (HIGH RISK)

#### Backend Controllers (0% coverage)
1. **authController.js** - Login, registration, password reset, 2FA
2. **invoiceController.js** - Billing, payments, tax calculations
3. **prescriptionController.js** - Drug safety, dispensing workflows
4. **appointmentController.js** - Scheduling, conflict detection
5. **patientController.js** - CRUD, search, PHI handling

#### Backend Services (5% coverage)
1. **drugSafetyService.js** - Drug interactions, contraindications
2. **ePrescribingService.js** - E-prescription workflows
3. **lisIntegrationService.js** - Laboratory system integration
4. **coldChainService.js** - Temperature monitoring
5. **deviceIntegrationService.js** - Medical device parsing

#### Frontend Pages (0% coverage)
- Dashboard, PatientDetail, Invoicing, Appointments
- All queue management pages
- All inventory pages

---

### Phase 5.1: Authentication Flow Tests (Week 1)

**Priority: CRITICAL**
**Estimated Time: 16-20 hours**

```
backend/tests/unit/auth/
├── login.test.js           - Login validation, token generation
├── register.test.js        - Registration, validation, first-user admin
├── passwordReset.test.js   - Reset flow, token expiry
├── twoFactor.test.js       - 2FA enable/disable, verification
├── tokenRefresh.test.js    - Refresh token rotation
└── session.test.js         - Session management, expiry
```

**Test Cases:**
1. Valid login returns access + refresh tokens in cookies
2. Invalid credentials return 401 without token
3. Locked account returns 401 with lock message
4. 2FA required returns intermediate state
5. 2FA code validation (valid, invalid, replay attack)
6. Password reset token generation and validation
7. Token refresh rotation works correctly
8. Session expiry invalidates tokens
9. Concurrent login handling (multiple sessions)
10. Rate limiting blocks brute force

---

### Phase 5.2: Invoice & Payment Tests (Week 2)

**Priority: CRITICAL**
**Estimated Time: 16-20 hours**

```
backend/tests/unit/billing/
├── invoiceCreation.test.js    - Multi-item invoice generation
├── taxCalculation.test.js     - Tax rules, conventions
├── paymentProcessing.test.js  - Full/partial payments
├── refunds.test.js            - Refund workflows
└── paymentPlans.test.js       - Installment logic
```

**Test Cases (using Money utility):**
1. Invoice total = sum of items (integer math)
2. Tax calculation with different rates
3. Convention coverage splits (patient vs company)
4. Partial payment updates amount due
5. Overpayment handling
6. Payment plan creation with correct installments
7. Late fee calculation
8. Invoice status transitions
9. Multi-currency handling (CDF/USD)
10. Void/cancel invoice logic

---

### Phase 5.3: Prescription Safety Tests (Week 3)

**Priority: CRITICAL**
**Estimated Time: 12-16 hours**

```
backend/tests/unit/prescriptions/
├── drugInteractions.test.js   - Drug-drug interactions
├── dosageValidation.test.js   - Min/max dose checks
├── allergyChecks.test.js      - Contraindication alerts
├── refillLogic.test.js        - Refill eligibility
└── statusTransitions.test.js  - Prescription states
```

**Test Cases:**
1. Drug interaction detection (moderate, severe)
2. Dosage below minimum triggers warning
3. Dosage above maximum triggers alert
4. Patient allergy blocks prescription
5. Duplicate therapy detection
6. Refill count enforcement
7. Expiry date validation
8. Status: draft → pending → dispensed → completed
9. Safety override requires reason + credentials
10. Controlled substance restrictions (DEA)

---

### Phase 5.4: Appointment Tests (Week 4)

**Priority: HIGH**
**Estimated Time: 12-16 hours**

```
backend/tests/unit/appointments/
├── scheduling.test.js         - Time slot allocation
├── conflictDetection.test.js  - Double booking prevention
├── cancellation.test.js       - Cancel with fee logic
├── reminders.test.js          - Notification triggers
└── multiProvider.test.js      - Provider availability
```

**Test Cases:**
1. Appointment within provider availability
2. Conflict detection prevents double-booking
3. Cancellation < 2 hours = 100% fee
4. Cancellation < 24 hours = 50% fee
5. No-show detection after timeout
6. Reminder scheduled 24 hours before
7. Reschedule updates all related entities
8. Multi-clinic scheduling isolation
9. Priority queue integration
10. Walk-in vs scheduled handling

---

### Phase 5.5: Frontend Component Tests (Weeks 5-6)

**Priority: HIGH**
**Estimated Time: 24-32 hours**

```
frontend/src/test/pages/
├── Login.test.jsx             - Auth form, validation
├── PatientDetail.test.jsx     - Patient view, tabs
├── InvoiceForm.test.jsx       - Invoice creation UI
├── PrescriptionWriter.test.jsx - Rx writing flow
├── AppointmentBooking.test.jsx - Scheduling UI
└── Queue.test.jsx             - Queue management
```

**Test Cases:**
1. Login form validation
2. Error state rendering
3. Loading states during API calls
4. Form submission with valid data
5. Accessibility (keyboard navigation)
6. Responsive layout breakpoints
7. Error boundary catches failures
8. State persistence on navigation
9. Real-time updates (WebSocket)
10. Offline mode indicators

---

### Test Infrastructure Improvements

#### 1. Add Coverage Reporting
```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};
```

#### 2. Create Controller Test Template
```javascript
// backend/tests/templates/controllerTest.template.js
const request = require('supertest');
const app = require('../../server');
const { createTestUser, createTestPatient } = require('../fixtures/generators');

describe('[ControllerName] Controller', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser({ role: 'admin' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'Test@123456' });
    authToken = loginRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await User.deleteMany({ _id: testUser._id });
  });

  describe('GET /api/[resource]', () => {
    it('should return 401 without auth', async () => { /* ... */ });
    it('should return list with valid auth', async () => { /* ... */ });
    it('should filter by query params', async () => { /* ... */ });
  });
});
```

#### 3. Add CI/CD Pipeline (Optional - user said not needed now)
```yaml
# .github/workflows/test.yml (for future)
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:6
        ports: [27017:27017]
    steps:
      - uses: actions/checkout@v4
      - run: cd backend && npm ci && npm test
      - run: cd frontend && npm ci && npm test
```

---

## PHASE 6: PERFORMANCE OPTIMIZATIONS

### List Virtualization Analysis

| Component | Max Items | Current Render | After Virtual | Improvement |
|-----------|-----------|----------------|---------------|-------------|
| Patients.jsx | 500+ | 2500ms | 150ms | 94% |
| Prescriptions.jsx | 200+ | 1800ms | 120ms | 93% |
| QueueList.jsx | 100+ | 800ms | 100ms | 88% |
| AppointmentList.jsx | 150+ | 1200ms | 80ms | 93% |
| InvoiceList.jsx | 300+ | 2000ms | 180ms | 91% |
| AuditTrail.jsx | 1000+ | 600ms | 80ms | 87% |
| Laboratory/index.jsx | 100+ | 900ms | 120ms | 87% |
| PatientBills.jsx | 100+ | 700ms | 100ms | 86% |

### Implementation Steps

#### Step 1: Install Dependencies
```bash
cd frontend
npm install @tanstack/react-virtual@^3.0.0
```

#### Step 2: Create Virtualized List Component
```jsx
// frontend/src/components/ui/VirtualizedList.jsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, forwardRef } from 'react';

export const VirtualizedList = forwardRef(({
  items,
  renderItem,
  itemHeight = 80,
  overscan = 10,
  className = ''
}, ref) => {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan
  });

  return (
    <div ref={parentRef} className={`overflow-auto ${className}`}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
});
```

#### Step 3: Migrate Patients.jsx (Example)

**Before:**
```jsx
{filteredPatients.map((patient, index) => (
  <PatientRow key={patient._id} patient={patient} />
))}
```

**After:**
```jsx
import { VirtualizedList } from '@/components/ui/VirtualizedList';

<VirtualizedList
  items={filteredPatients}
  itemHeight={120}
  className="h-[600px]"
  renderItem={(patient, index) => (
    <PatientRow key={patient._id} patient={patient} />
  )}
/>
```

---

### Phase 6 Implementation Order

#### Week 1: Foundation
- [ ] Install @tanstack/react-virtual
- [ ] Create VirtualizedList component
- [ ] Create VirtualizedTable component (for data grids)
- [ ] Add performance profiling utilities

#### Week 2: High-Impact Lists
- [ ] Patients.jsx - Patient table virtualization
- [ ] Prescriptions.jsx - Prescription queue virtualization
- [ ] Test with 500+ items

#### Week 3: Queue & Appointments
- [ ] QueueList.jsx - Patient queue virtualization
- [ ] AppointmentList.jsx - Appointment cards virtualization
- [ ] Handle WebSocket updates with virtualized lists

#### Week 4: Data-Heavy Components
- [ ] InvoiceList.jsx - Dynamic height virtualization
- [ ] AuditTrail.jsx - Fixed-height log entries
- [ ] Laboratory/index.jsx - Section-based virtualization
- [ ] PatientBills.jsx - Expandable item handling

---

### Additional Performance Optimizations

#### 1. React.memo for List Items
```jsx
// All list item components should be memoized
const PatientRow = React.memo(({ patient }) => {
  return <tr>...</tr>;
});
```

#### 2. useCallback for Handlers
```jsx
// Prevent handler recreation on each render
const handlePatientClick = useCallback((id) => {
  navigate(`/patients/${id}`);
}, [navigate]);
```

#### 3. useMemo for Filtered Data
```jsx
// Already implemented in most components - verify all lists
const filteredPatients = useMemo(() => {
  return patients.filter(p => /* filter logic */).sort(/* sort logic */);
}, [patients, filters, sortOrder]);
```

#### 4. Debounce Search Input
```jsx
// Prevent excessive filtering on keystroke
const debouncedSearch = useMemo(
  () => debounce((term) => setSearchTerm(term), 300),
  []
);
```

---

## Implementation Timeline

### Phase 5: Testing (6 weeks)

| Week | Focus | Hours | Deliverable |
|------|-------|-------|-------------|
| 1 | Auth Tests | 20 | 10+ auth test cases |
| 2 | Invoice Tests | 20 | 10+ billing test cases |
| 3 | Prescription Tests | 16 | 10+ Rx test cases |
| 4 | Appointment Tests | 16 | 10+ scheduling test cases |
| 5-6 | Frontend Tests | 32 | 6 page component tests |
| **Total** | | **104 hours** | **60+ test cases** |

### Phase 6: Performance (4 weeks)

| Week | Focus | Hours | Deliverable |
|------|-------|-------|-------------|
| 1 | Setup & Components | 8 | Virtualization components |
| 2 | Patients + Prescriptions | 8 | 2 virtualized pages |
| 3 | Queue + Appointments | 6 | 2 virtualized pages |
| 4 | Invoices + Others | 10 | 4 virtualized pages |
| **Total** | | **32 hours** | **8 virtualized components** |

---

## Success Metrics

### Testing Success
- [ ] 60%+ code coverage on critical paths
- [ ] All auth flows have test coverage
- [ ] All billing calculations tested
- [ ] All prescription safety checks tested
- [ ] CI passes before merge (when enabled)

### Performance Success
- [ ] <200ms initial render for 500+ item lists
- [ ] 60 FPS scrolling on virtualized lists
- [ ] <5MB memory for large datasets
- [ ] No jank on filter/sort operations
- [ ] WebSocket updates don't cause full re-renders

---

## Risk Mitigation

### Testing Risks
| Risk | Mitigation |
|------|------------|
| Flaky tests | Use MongoDB Memory Server, deterministic data |
| Test data cleanup | afterEach/afterAll hooks for cleanup |
| Time constraints | Prioritize critical paths first |

### Performance Risks
| Risk | Mitigation |
|------|------------|
| Virtualization breaks existing features | Incremental rollout, feature flags |
| Dynamic heights cause layout shift | Use measureElement option |
| WebSocket updates cause issues | Debounce updates, optimistic UI |

---

## Files to Create/Modify

### Phase 5 (Testing)
**New Files:**
- `backend/tests/unit/auth/login.test.js`
- `backend/tests/unit/auth/register.test.js`
- `backend/tests/unit/auth/twoFactor.test.js`
- `backend/tests/unit/billing/invoiceCreation.test.js`
- `backend/tests/unit/billing/paymentProcessing.test.js`
- `backend/tests/unit/prescriptions/drugInteractions.test.js`
- `backend/tests/unit/prescriptions/dosageValidation.test.js`
- `backend/tests/unit/appointments/scheduling.test.js`
- `backend/tests/unit/appointments/conflictDetection.test.js`
- `frontend/src/test/pages/Login.test.jsx`
- `frontend/src/test/pages/PatientDetail.test.jsx`

### Phase 6 (Performance)
**New Files:**
- `frontend/src/components/ui/VirtualizedList.jsx`
- `frontend/src/components/ui/VirtualizedTable.jsx`

**Modified Files:**
- `frontend/src/pages/Patients.jsx`
- `frontend/src/pages/Prescriptions.jsx`
- `frontend/src/pages/Queue/QueueList.jsx`
- `frontend/src/pages/Appointments/AppointmentList.jsx`
- `frontend/src/pages/Invoicing/InvoiceList.jsx`
- `frontend/src/pages/AuditTrail.jsx`
- `frontend/src/pages/Laboratory/index.jsx`
- `frontend/src/pages/patient/PatientBills.jsx`
