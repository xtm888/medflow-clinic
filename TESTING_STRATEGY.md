# 🧪 COMPREHENSIVE TESTING STRATEGY
## What to Test After Every Change

**Generated:** 2025-11-20
**Purpose:** Ensure no regressions during 9-week renovation

---

## 📋 TESTING LEVELS

### Level 1: Smoke Test (5 min) - After Every File Change
Quick verification that nothing broke

### Level 2: Component Test (15 min) - After Fixing Each Issue
Verify the specific fix works correctly

### Level 3: Integration Test (30 min) - After Each Day
Verify related systems still work together

### Level 4: Regression Test (2 hours) - After Each Week
Verify all functionality still works

### Level 5: Full System Test (1 day) - Before Production
Comprehensive end-to-end testing

---

## 🔥 LEVEL 1: SMOKE TEST (After Every Change)

Run this after EVERY file modification:

```bash
# Start servers
cd backend && npm run dev  # Terminal 1
cd frontend && npm run dev  # Terminal 2

# Open browser to http://localhost:5173
```

### Checklist (5 minutes):
- [ ] Application loads without errors
- [ ] Login page appears
- [ ] Can login successfully
- [ ] Dashboard loads
- [ ] Navigation menu works
- [ ] No red errors in browser console
- [ ] No 500 errors in backend logs

**If ANY of these fail, STOP and fix before continuing.**

---

## 🎯 LEVEL 2: COMPONENT TEST (After Each Fix)

### WEEK 1 DAY 1: Toast System Tests

#### After Fixing Each Page:
```bash
# For Queue.jsx
1. Navigate to http://localhost:5173/queue
2. Click "Check In" button
3. Verify toast notification appears (green success message)
4. Try to check in invalid patient
5. Verify toast error appears (red error message)
6. Open browser console
7. Verify NO errors related to useToast or ToastContext

# Repeat for each fixed page:
- Patients: Create patient → toast should show
- Appointments: Book appointment → toast should show
- Laboratory: Order test → toast should show
- Prescriptions: Create prescription → toast should show
```

**Expected Results:**
- ✅ Toast appears at top-right of screen
- ✅ Toast shows for 3-5 seconds then disappears
- ✅ Success = green, Error = red, Warning = yellow, Info = blue
- ✅ No console errors

---

### WEEK 1 DAY 2: API Token Refresh Test

#### After Fixing API Files:
```bash
# Test automatic token refresh
1. Login to application
2. Open browser DevTools → Application → Local Storage
3. Note the 'token' value
4. Wait 5 minutes (or manually change token expiry if you can)
5. Make an API call (e.g., refresh patient list)
6. Check Local Storage again
7. Verify token has been refreshed (new value)
8. Verify API call succeeded
9. Check browser console for "Token refreshed" log
```

**Test Error Toasts:**
```bash
1. Stop backend server
2. Try to create a patient (will fail)
3. Verify toast error appears: "Network error"
4. Start backend server
5. Try again - should work
```

**Expected Results:**
- ✅ Token auto-refreshes on 401
- ✅ API errors show toast notifications
- ✅ No random logouts
- ✅ Network errors handled gracefully

---

### WEEK 1 DAY 3: Auth State Test

#### After Fixing Auth Files:
```bash
# Test immediate auth updates
1. Logout
2. Login as user 'doctor@example.com'
3. Check Dashboard immediately shows "Dr. [Name]" (NO page refresh needed)
4. Navigate to Settings
5. Verify user data is correct
6. Open DevTools Console
7. Type: localStorage.clear()
8. Refresh page
9. Should redirect to login (auth state cleared)

# Test permissions
1. Login as 'receptionist@example.com'
2. Try to access admin-only page (e.g., /users)
3. Should be blocked or redirected
4. Verify PermissionGate components show/hide correctly
```

**Expected Results:**
- ✅ User data updates immediately (no refresh)
- ✅ Logout clears all user data
- ✅ Permissions enforced correctly
- ✅ No stale data from localStorage

---

### WEEK 1 DAY 4: Race Condition Test

#### Test Concurrent Requests:
```bash
# Test appointmentId uniqueness
# Create test script: test-race-condition.js

const axios = require('axios');

async function testRaceCondition() {
  const token = 'YOUR_TOKEN_HERE';

  // Simulate 10 simultaneous check-ins
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      axios.post('http://localhost:5001/api/queue', {
        patientInfo: {
          firstName: `Test${i}`,
          lastName: `Patient${i}`,
          phoneNumber: `+243${Math.random().toString().slice(2, 11)}`
        },
        reason: 'Test check-in'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );
  }

  const results = await Promise.all(promises);
  const appointmentIds = results.map(r => r.data.appointmentId);

  // Check for duplicates
  const unique = [...new Set(appointmentIds)];
  console.log(`Created: ${appointmentIds.length}`);
  console.log(`Unique: ${unique.length}`);

  if (unique.length === appointmentIds.length) {
    console.log('✅ PASS: All appointmentIds unique');
  } else {
    console.log('❌ FAIL: Duplicate appointmentIds found');
    console.log('Duplicates:', appointmentIds);
  }
}

testRaceCondition();
```

**Run test:**
```bash
node test-race-condition.js
```

**Expected Results:**
- ✅ All 10 appointmentIds are unique
- ✅ No errors during concurrent requests
- ✅ Counter model handles concurrency

---

### WEEK 1 DAY 5: Data Model Tests

#### Test Laboratory Field:
```bash
# Test lab orders save to correct field
1. Login as doctor
2. Create or open a visit
3. Order lab test
4. Check MongoDB directly:

db.visits.findOne({ _id: ObjectId("VISIT_ID") }, {
  laboratoryOrders: 1,
  laboratoryTests: 1
})

# Should show:
# - laboratoryOrders: [array with test data]
# - laboratoryTests: undefined or []
```

#### Test Patient Photo:
```bash
# Test photo upload
1. Go to patient profile
2. Upload photo
3. Check MongoDB:

db.patients.findOne({ _id: ObjectId("PATIENT_ID") }, {
  photoPath: 1,
  photoUrl: 1
})

# Should show:
# - photoPath: "/uploads/patients/xxx.jpg"
# - photoUrl: "http://localhost:5001/uploads/patients/xxx.jpg"
```

#### Test Payment ID Security:
```bash
# Test payment ID is cryptographically secure
1. Create invoice
2. Add payment
3. Check payment ID format
4. Should be: PAY1730000000ABC123DEF (not predictable)
5. Create another payment
6. Should be: PAY1730000001XYZ789GHI (different random part)
```

**Expected Results:**
- ✅ Lab tests in laboratoryOrders field
- ✅ Patient photos save correctly
- ✅ Payment IDs not predictable
- ✅ No Object.assign vulnerabilities

---

## 🔗 LEVEL 3: INTEGRATION TEST (End of Each Day)

### Critical Workflows to Test:

#### Workflow 1: Patient Check-In to Visit (15 min)
```
1. Navigate to Queue page
2. Check in a scheduled patient
   → Toast shows "Patient checked in"
   → Queue number appears
   → Patient appears in queue list
3. Navigate to patient detail
   → Visit created and visible
   → Status is "in-progress"
4. Click on visit
   → Opens consultation page
   → All tabs accessible
```

#### Workflow 2: Complete Clinical Workflow (30 min)
```
1. Start from Queue
2. Check in patient
3. Click "Start Consultation"
4. Complete all steps:
   - Vital signs
   - Chief complaint
   - Visual acuity
   - Refraction
   - Examination
   - Diagnosis
   - Prescription (add 2 medications)
   - Laboratory (order 2 tests)
5. Complete visit
6. Verify:
   - Invoice generated
   - Prescriptions created
   - Lab orders created
   - Inventory reserved (if applicable)
7. Navigate to Prescriptions page
8. Verify prescription appears
9. Try to dispense
10. Verify inventory deducted
```

#### Workflow 3: Appointment Booking (10 min)
```
1. Navigate to Appointments page
2. Click "New Appointment"
3. Select patient
4. Select provider
5. Select date/time
6. Select service
7. Book appointment
   → Toast shows "Appointment booked"
   → Appointment appears in list
   → Unique appointmentId generated
8. Check appointment detail
9. Try to book conflicting time
   → Should show error (conflict)
```

#### Workflow 4: Prescription to Dispensing (15 min)
```
1. Create prescription during visit
2. Complete visit
   → Inventory should be reserved
3. Go to Prescriptions page
4. Find prescription
5. Click "Dispense"
6. Verify:
   - Stock deducted
   - Prescription status = "dispensed"
   - Transaction recorded
7. Try to cancel dispensed prescription
   → Should be blocked
8. Create new prescription
9. Cancel before dispensing
   → Inventory released
```

---

## 🏗️ LEVEL 4: REGRESSION TEST (End of Each Week)

### Week 1 Regression Test Checklist (2 hours)

Run through ALL critical workflows:

#### 1. Authentication & Authorization (20 min)
- [ ] Register new user
- [ ] Login with multiple users
- [ ] Logout
- [ ] Password reset
- [ ] Role-based access (admin, doctor, nurse, receptionist)
- [ ] Permission gates work
- [ ] Session management (max 5 sessions)

#### 2. Patient Management (20 min)
- [ ] Create patient
- [ ] Search patient
- [ ] Update patient info
- [ ] Upload patient photo
- [ ] View patient detail (all tabs)
- [ ] Patient timeline
- [ ] Patient history

#### 3. Queue & Appointments (20 min)
- [ ] Book appointment (staff)
- [ ] Book appointment (public)
- [ ] Check in patient
- [ ] Walk-in registration
- [ ] Queue management
- [ ] Call next patient
- [ ] Complete appointment
- [ ] Reschedule appointment
- [ ] Cancel appointment

#### 4. Clinical Workflow (30 min)
- [ ] Start consultation
- [ ] Complete all exam steps
- [ ] Add vital signs
- [ ] Record chief complaint
- [ ] Perform refraction
- [ ] Add diagnosis
- [ ] Create prescription
- [ ] Order lab tests
- [ ] Complete visit
- [ ] Verify invoice generated

#### 5. Prescriptions & Pharmacy (20 min)
- [ ] Create medication prescription
- [ ] Create optical prescription
- [ ] Drug interaction warnings
- [ ] Allergy checks
- [ ] Dispense prescription
- [ ] Inventory management
- [ ] Low stock alerts
- [ ] Expiring medication alerts

#### 6. Laboratory (10 min)
- [ ] Order lab tests
- [ ] Enter results
- [ ] View pending tests
- [ ] Mark test complete
- [ ] Link results to visit

#### 7. Billing & Invoicing (20 min)
- [ ] Generate invoice
- [ ] Add payment
- [ ] Apply discount
- [ ] Issue refund
- [ ] View invoice history
- [ ] Financial reports

**Pass Criteria:**
- ✅ All workflows complete without errors
- ✅ No console errors
- ✅ No data loss
- ✅ Performance acceptable
- ✅ Toast notifications work everywhere
- ✅ Auth state updates correctly

---

## 🌐 LEVEL 5: FULL SYSTEM TEST (Before Production)

### Day-Long Comprehensive Test (Week 9)

#### Morning: Core Functionality (4 hours)
Run through every page and feature:

**Pages to Test (59 pages):**
- [ ] Login
- [ ] Dashboard
- [ ] Queue
- [ ] Patients (list, detail, summary)
- [ ] Appointments (calendar, list)
- [ ] Prescriptions
- [ ] Laboratory
- [ ] Pharmacy (dashboard, detail)
- [ ] Invoicing
- [ ] Financial reports
- [ ] Device management (4 pages)
- [ ] IVT injection (3 pages)
- [ ] Ophthalmology (8 pages)
- [ ] Patient portal (8 pages)
- [ ] Settings
- [ ] Users
- [ ] Analytics

**For EACH page, verify:**
- [ ] Loads without errors
- [ ] All buttons work
- [ ] All forms submit correctly
- [ ] All tables load data
- [ ] All modals open/close
- [ ] Toasts appear on actions
- [ ] Navigation works

#### Afternoon: User Roles (2 hours)
Test each role has correct access:

**Admin:**
- [ ] Can access all pages
- [ ] Can create users
- [ ] Can modify settings
- [ ] Can view all reports

**Doctor:**
- [ ] Can access clinical pages
- [ ] Can create prescriptions
- [ ] Can complete visits
- [ ] CANNOT access admin pages
- [ ] Can only see own prescriptions

**Nurse:**
- [ ] Can check in patients
- [ ] Can enter vitals
- [ ] CANNOT create prescriptions
- [ ] CANNOT access admin pages

**Receptionist:**
- [ ] Can book appointments
- [ ] Can manage queue
- [ ] CANNOT access clinical pages
- [ ] CANNOT view prescriptions

**Pharmacist:**
- [ ] Can dispense medications
- [ ] Can manage inventory
- [ ] CANNOT create prescriptions
- [ ] Can view all prescriptions

**Lab Technician:**
- [ ] Can view lab orders
- [ ] Can enter results
- [ ] CANNOT access other modules

**Patient:**
- [ ] Can view own appointments
- [ ] Can view own prescriptions
- [ ] Can view own bills
- [ ] CANNOT access clinical data of others

#### Late Afternoon: Performance & Load (2 hours)

**Performance Tests:**
```bash
# Test with realistic data
# Seed 1000 patients
# Seed 500 appointments
# Seed 200 prescriptions

# Time critical operations:
1. Patient search (< 1 second)
2. Queue load (< 2 seconds)
3. Patient detail (< 2 seconds)
4. Appointment booking (< 3 seconds)
5. Visit completion (< 5 seconds)
```

**Load Testing:**
```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 http://localhost:5001/api/patients

# Should handle:
# - 10 concurrent users
# - 100 requests per second
# - No errors or timeouts
```

---

## 🐛 BUG TRACKING

### If You Find a Bug During Testing:

1. **STOP TESTING**
2. **Document the bug:**
   ```markdown
   ## Bug Report
   - **Date:** YYYY-MM-DD
   - **Tester:** Your Name
   - **Page:** Page name
   - **Issue:** Brief description
   - **Steps to Reproduce:**
     1. Step 1
     2. Step 2
     3. Expected vs Actual
   - **Console Errors:** [Copy/paste]
   - **Priority:** P0/P1/P2/P3
   ```
3. **Fix immediately if P0 (blocks testing)**
4. **Add to backlog if P1-P3**
5. **Resume testing after fix**

---

## ✅ TEST COMPLETION CHECKLIST

### Week 1 Complete When:
- [ ] All smoke tests pass
- [ ] All component tests pass
- [ ] All integration tests pass
- [ ] Regression test passes
- [ ] Deployed to staging
- [ ] No P0 bugs remaining

### Week 2-8 Complete When:
- [ ] All new features tested
- [ ] All refactored code tested
- [ ] Regression test passes
- [ ] No new bugs introduced
- [ ] Performance acceptable

### Week 9 Complete When:
- [ ] Full system test passes
- [ ] All user roles tested
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Load testing passed
- [ ] Ready for production

---

## 🚨 CRITICAL PATH TESTING

These workflows MUST work at all times:

1. **Login → Dashboard**
2. **Queue → Check-In → Consultation**
3. **Consultation → Prescription → Dispense**
4. **Appointment Booking**
5. **Patient Search & Detail**

**Test these after EVERY significant change.**

If ANY of these break, STOP and fix immediately.

---

## 📊 TESTING METRICS

Track these metrics weekly:

| Metric | Target | Week 1 | Week 2 | Week 3 | ... |
|--------|--------|--------|--------|--------|-----|
| Test Pass Rate | 100% | | | | |
| Bugs Found | < 5 | | | | |
| P0 Bugs | 0 | | | | |
| Performance | < 2s | | | | |
| Console Errors | 0 | | | | |

---

## 🎯 FINAL CHECKLIST BEFORE PRODUCTION

- [ ] All 103 issues resolved
- [ ] All tests passing
- [ ] No console errors
- [ ] No broken pages
- [ ] Performance acceptable
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] User training complete
- [ ] Backup created
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] Error tracking (Sentry) configured

**Only deploy when ALL checkboxes are checked.**

---

**END OF TESTING STRATEGY**

Follow this systematically to ensure quality throughout the 9-week renovation.
Test early, test often, test thoroughly.
