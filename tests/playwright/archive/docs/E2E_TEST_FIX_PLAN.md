# E2E Test Fix Plan - MedFlow

**Total Tests:** 104 | **Passed:** 88 (84.6%) | **Failed:** 16

---

## Category 1: Test Configuration Fixes (3 failures)

### Issue: Wrong Email Addresses in test_utils.py

The test file uses email addresses that don't match the actual database users.

**File:** `/tests/playwright/test_utils.py`

**Current (Wrong):**
```python
TEST_USERS = {
    'doctor': {'email': 'doctor@medflow.com', ...},
    'nurse': {'email': 'nurse@medflow.com', ...},
    'pharmacist': {'email': 'pharmacist@medflow.com', ...},
}
```

**Fix (Correct):**
```python
TEST_USERS = {
    'doctor': {'email': 'dr.lumumba@medflow.com', ...},
    'nurse': {'email': 'nurse.marie@medflow.com', ...},
    'pharmacist': {'email': 'pharmacy@medflow.com', ...},
    'ophthalmologist': {'email': 'dr.kabila@medflow.com', ...},
}
```

**Actual Users in Database:**
| Role | Email |
|------|-------|
| admin | admin@medflow.com |
| doctor | dr.lumumba@medflow.com |
| ophthalmologist | dr.kabila@medflow.com |
| nurse | nurse.marie@medflow.com |
| pharmacist | pharmacy@medflow.com |
| lab_technician | lab@medflow.com |
| accountant | accountant@medflow.com |
| receptionist | reception@medflow.com |
| manager | manager@medflow.com |
| optometrist | optometrist@medflow.com |
| orthoptist | orthoptist@medflow.com |
| technician | tech.jean@medflow.com |

---

## Category 2: Frontend Authorization (3 failures)

### Issue: Settings Page Not Protected by Role

**Problem:** Receptionist, lab_technician, and accountant can access `/settings` when they shouldn't.

**File:** `/frontend/src/App.jsx` (line ~261)

**Current:**
```jsx
<Route path="settings" element={<Settings />} />
```

**Fix Option A - Use PermissionGate wrapper:**
```jsx
import PermissionGate from './components/PermissionGate';

<Route path="settings" element={
  <PermissionGate roles={['admin']} fallback={<Navigate to="/home" replace />}>
    <Settings />
  </PermissionGate>
} />
```

**Fix Option B - Add role check inside Settings.jsx:**
```jsx
// In Settings.jsx, add at the top of component
const { user } = useAuth();
if (user?.role !== 'admin') {
  return <Navigate to="/home" replace />;
}
```

**Fix Option C - Use RequireRole HOC (if it exists):**
```jsx
<Route path="settings" element={<RequireRole role="admin"><Settings /></RequireRole>} />
```

---

## Category 3: Multi-Clinic UI Tests (3 failures)

### Issue: Clinic Switching Test Failures

**Problems:**
1. Can't find clinic dropdown options
2. X-Clinic-ID header not being captured
3. Data isolation test depends on switching

**Root Cause Analysis:**
- Dropdown component may use portal (renders outside DOM tree)
- Header is set via axios interceptor, not visible in Playwright network tab easily
- Timing issues with async state updates

**Fix Options:**

1. **Improve test selectors** in `/tests/playwright/test_multi_clinic.py`:
```python
# Instead of looking for options directly, click the selector first
page.click('[data-testid="clinic-selector"]')  # or appropriate selector
page.wait_for_timeout(500)  # Wait for dropdown animation
page.click('text=Centre Ophtalmologique Tombalbaye')
```

2. **Add data-testid attributes** to `ClinicSelector.jsx`:
```jsx
<Select data-testid="clinic-selector">
  {clinics.map(c => (
    <Option data-testid={`clinic-option-${c._id}`} value={c._id}>
      {c.name}
    </Option>
  ))}
</Select>
```

3. **Check network requests differently**:
```python
# Use request interception instead of checking after the fact
with page.expect_request(lambda r: 'x-clinic-id' in r.headers.keys().lower()):
    # Make an API call
    page.goto(f"{BASE_URL}/patients")
```

---

## Category 4: Document Generation (2 failures)

### 4.1 CERFA Document Generation - 403 Error

**Endpoint:** POST `/api/documents/generate/certificate`

**Current Authorization:**
```javascript
router.post('/generate/certificate',
  protect,
  authorize(['doctor', 'ophthalmologist', 'admin']),
  ...
);
```

**Investigation Needed:**
- The route allows `admin` role
- Test is using `admin` credentials
- 403 suggests authorize middleware issue

**Potential Fixes:**

1. **Check authorize middleware consistency** in `/backend/middleware/auth.js`:
```javascript
// Ensure authorize handles both string and array formats
const authorize = (...roles) => {
  const flatRoles = roles.flat(); // Handle nested arrays
  return (req, res, next) => {
    if (!flatRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};
```

2. **Verify admin user has correct role** in database:
```bash
mongosh medflow --eval "db.users.findOne({email: 'admin@medflow.com'})"
```

### 4.2 Document Templates - 500 Error

**Endpoint:** GET `/api/documents/templates`

**Problem:** This endpoint doesn't exist in the routes.

**Fix Option A - Create the endpoint:**

Add to `/backend/routes/documents.js`:
```javascript
router.get('/templates', protect, authorize('admin', 'doctor'), async (req, res) => {
  try {
    const DocumentTemplate = require('../models/DocumentTemplate');
    const templates = await DocumentTemplate.find({ active: true });
    res.json({ data: templates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

**Fix Option B - Update test to use correct endpoint:**

If templates are in the lab routes, update test to use:
```python
response = api.get('/api/laboratory/templates')  # Instead of /api/documents/templates
```

---

## Category 5: Laboratory Workflow (5 failures)

### 5.1 Lab Test Catalog - 404 Error

**Problem:** GET `/api/laboratory/catalog` doesn't exist.

**Fix:** The correct endpoint is `/api/laboratory/templates`

Update test in `/tests/playwright/test_laboratory_workflow.py`:
```python
def test_lab_catalog(reporter: TestReporter):
    api = APIClient('admin')
    response = api.get('/api/laboratory/templates')  # Changed from /catalog
    ...
```

### 5.2 Create Lab Order - 403 Error

**Endpoint:** POST `/api/lab-orders`

**Current Authorization:**
```javascript
.post(
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  ...
)
```

**Investigation:**
- Admin is in the allowed roles
- Could be permission-based check in controller

**Check labOrderController.js for additional checks:**
```javascript
// Look for any requirePermission or hasPermission checks inside the controller
```

### 5.3 Westgard QC - 403 Errors (3 tests)

**Endpoint:** POST `/api/labQC/qc/westgard/evaluate`

**Current Authorization:**
```javascript
requirePermission('manage_laboratory')
```

**Problem:** Uses `requirePermission` instead of role-based `authorize`.

**Admin has `manage_laboratory` permission**, but the middleware might not be checking correctly.

**Fix Option A - Debug requirePermission middleware:**
```javascript
// In /backend/middleware/auth.js, add logging:
const requirePermission = (...permissions) => {
  return async (req, res, next) => {
    console.log('User permissions:', req.user.permissions);
    console.log('Required:', permissions);
    // ... rest of logic
  };
};
```

**Fix Option B - Add role fallback:**
```javascript
// Allow admin role to bypass permission check
if (req.user.role === 'admin') return next();
```

---

## Quick Fix Summary Table

| # | Issue | File | Fix Type | Priority |
|---|-------|------|----------|----------|
| 1 | Wrong test emails | test_utils.py | Update config | HIGH |
| 2 | Settings unprotected | App.jsx | Add PermissionGate | HIGH |
| 3 | Clinic switching | test_multi_clinic.py | Improve selectors | MEDIUM |
| 4 | CERFA 403 | auth.js / routes | Debug authorize | MEDIUM |
| 5 | Templates 500 | documents.js | Add endpoint | LOW |
| 6 | Lab catalog 404 | test_laboratory_workflow.py | Fix endpoint path | HIGH |
| 7 | Lab order 403 | labOrders.js | Debug auth | MEDIUM |
| 8 | Westgard QC 403 | labQC.js / auth.js | Fix permissions | MEDIUM |

---

## Implementation Order

### Phase 1: Test Configuration (5 min)
1. Fix email addresses in test_utils.py
2. Fix lab catalog endpoint in test_laboratory_workflow.py

### Phase 2: Frontend Security (10 min)
3. Add PermissionGate to Settings route in App.jsx

### Phase 3: Backend Auth Investigation (20 min)
4. Debug authorize middleware for array handling
5. Debug requirePermission middleware
6. Add missing /api/documents/templates endpoint

### Phase 4: Test Improvements (15 min)
7. Improve multi-clinic test selectors
8. Add data-testid attributes to ClinicSelector

---

## After Fixes - Expected Results

| Suite | Current | Expected |
|-------|---------|----------|
| Role-Based Access | 47/53 | 50/53 |
| Multi-Clinic | 5/8 | 7/8 |
| Document Generation | 5/7 | 7/7 |
| Laboratory Workflow | 3/8 | 6/8 |
| Billing Calculations | 12/12 | 12/12 |
| Device Integration | 16/16 | 16/16 |
| **TOTAL** | **88/104** | **~98/104** |

---

## Commands to Verify Fixes

```bash
# Run specific test suites
cd /Users/xtm888/magloire/tests/playwright

# Test role access after email fixes
python3 test_role_access.py

# Test documents after endpoint fixes
python3 test_document_generation.py

# Test lab workflow after path fixes
python3 test_laboratory_workflow.py

# Run full suite
python3 run_all_tests.py
```
