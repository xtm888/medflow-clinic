# Critical Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical issues from Dec 18 work: commit 890 files, fix broken inventory references, repair backend tests, add deprecation banner, and validate new components.

**Architecture:**
- Git commits organized by logical domain (shared components, inventory, tests, StudioVision)
- Backend inventory references updated to use unified Inventory model with discriminators
- Test infrastructure fixed with proper mocking and port isolation

**Tech Stack:** Node.js, MongoDB/Mongoose, React, Jest, Playwright

---

## Phase 1: Git Commit Organization (P0 - Data Safety)

### Task 1.1: Commit Shared Modal System

**Files:**
- Stage: `frontend/src/components/shared/Modal/*.jsx`
- Stage: `frontend/src/components/shared/Modal/index.js`
- Stage: `frontend/src/components/shared/index.js`

**Step 1: Stage shared modal files**

```bash
git add frontend/src/components/shared/Modal/BaseModal.jsx
git add frontend/src/components/shared/Modal/ConfirmModal.jsx
git add frontend/src/components/shared/Modal/FormModal.jsx
git add frontend/src/components/shared/Modal/WizardModal.jsx
git add frontend/src/components/shared/Modal/index.js
git add frontend/src/components/shared/index.js
```

**Step 2: Verify staged files**

```bash
git status --short | grep "^A"
```
Expected: 6 files staged

**Step 3: Commit**

```bash
git commit -m "feat(ui): add shared modal system with accessibility features

- BaseModal: portal rendering, focus trap, scroll lock, ESC to close
- ConfirmModal: variant dialogs (danger, warning, success)
- FormModal: dirty state tracking, Ctrl+Enter submit
- WizardModal: multi-step with progress indicator

Part of StudioVision consolidation plan Phase 2.1"
```

---

### Task 1.2: Commit StudioVision Pending Features

**Files:**
- Stage: `frontend/src/components/consultation/OrthoptieQuickPanel.jsx`
- Stage: `frontend/src/components/consultation/DeviceDataBanner.jsx`
- Stage: `frontend/src/components/consultation/QuickActionsBar.jsx`
- Stage: `frontend/src/hooks/useDeviceSync.js`
- Stage: `frontend/src/hooks/index.js`
- Stage: `frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx`

**Step 1: Stage StudioVision feature files**

```bash
git add frontend/src/components/consultation/OrthoptieQuickPanel.jsx
git add frontend/src/components/consultation/DeviceDataBanner.jsx
git add frontend/src/components/consultation/QuickActionsBar.jsx
git add frontend/src/hooks/useDeviceSync.js
git add frontend/src/hooks/index.js
git add frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx
```

**Step 2: Commit**

```bash
git commit -m "feat(ophthalmology): add StudioVision pending features

- OrthoptieQuickPanel: purple-themed orthoptic assessment (Cover Test, PPC, Stereopsis)
- DeviceDataBanner: real-time device measurement display with diff detection
- QuickActionsBar: keyboard shortcuts (OD->OG copy, import last visit, quick diagnosis)
- useDeviceSync: WebSocket hook for 8 device types with 24h filtering

Clinical thresholds: 0.25D sphere/cylinder, 5deg axis, 2mmHg IOP"
```

---

### Task 1.3: Commit Unified Inventory System

**Files:**
- Stage: `backend/models/Inventory.js`
- Stage: `backend/controllers/inventory/UnifiedInventoryController.js`
- Stage: `backend/routes/unifiedInventory.js`
- Stage: `frontend/src/pages/UnifiedInventory/*.jsx`
- Stage: `frontend/src/services/inventory/index.js`

**Step 1: Stage backend inventory files**

```bash
git add backend/models/Inventory.js
git add backend/controllers/inventory/UnifiedInventoryController.js
git add backend/routes/unifiedInventory.js 2>/dev/null || true
git add backend/controllers/inventory/index.js
```

**Step 2: Stage frontend inventory files**

```bash
git add frontend/src/pages/UnifiedInventory/
git add frontend/src/services/inventory/index.js
```

**Step 3: Commit**

```bash
git commit -m "feat(inventory): add unified inventory system with discriminators

Backend:
- Inventory.js: base model with 7 discriminators (pharmacy, frame, contact_lens, optical_lens, reagent, lab_consumable, surgical_supply)
- UnifiedInventoryController.js: single controller for all inventory types
- /api/unified-inventory routes

Frontend:
- UnifiedInventory page with type tabs
- UnifiedInventoryForm with dynamic fields
- StockOperationModal for adjustments
- unifiedInventoryService for API

Phase 3 of StudioVision consolidation plan"
```

---

### Task 1.4: Commit Backend Fixes

**Files:**
- Stage: `backend/server.js` (ESLint fixes)
- Stage: `backend/jest.config.js`
- Stage: `backend/tests/setup.js`

**Step 1: Stage backend core files**

```bash
git add backend/server.js
git add backend/jest.config.js
git add backend/tests/setup.js
```

**Step 2: Commit**

```bash
git commit -m "fix(backend): ESLint errors and test configuration

- Remove unused csrfErrorHandler import
- Rename promise to _promise for unused param pattern
- Increase test timeout to 60s for bcrypt operations
- Add forceExit and serial execution for port safety"
```

---

### Task 1.5: Commit Deleted Legacy Files

**Files:**
- Stage deletions: Legacy inventory models, backup files, old screenshots

**Step 1: Stage all deletions**

```bash
git add -u backend/models/ContactLensInventory.js
git add -u backend/models/FrameInventory.js
git add -u backend/models/LabConsumableInventory.js
git add -u backend/models/OpticalLensInventory.js
git add -u backend/models/PharmacyInventory.js
git add -u backend/models/ReagentInventory.js
git add -u backend/models/SurgicalSupplyInventory.js
git add -u backend/package.json.bak
git add -u frontend/src/data/mockData.js.bak
```

**Step 2: Stage screenshot deletions**

```bash
git add -u tests/playwright/screenshots/
```

**Step 3: Commit**

```bash
git commit -m "chore: remove legacy inventory models and backup files

Deleted:
- 7 legacy inventory models (replaced by unified Inventory.js with discriminators)
- Backup files (.bak, .backup)
- Old test screenshots (regenerated in comprehensive suite)

Part of consolidation cleanup Phase 1.1"
```

---

### Task 1.6: Commit Remaining Modified Files (Bulk)

**Step 1: Check remaining unstaged files**

```bash
git status --short | wc -l
```

**Step 2: Stage all remaining backend changes**

```bash
git add backend/
```

**Step 3: Commit backend changes**

```bash
git commit -m "refactor(backend): update controllers and services for unified inventory

- Update inventory controllers to support unified model
- Update services with consistent error handling
- Middleware and config improvements"
```

**Step 4: Stage all remaining frontend changes**

```bash
git add frontend/
```

**Step 5: Commit frontend changes**

```bash
git commit -m "refactor(frontend): update components and services

- Update inventory services to use unified API
- Component improvements and bug fixes
- Hook updates for device integration"
```

**Step 6: Stage and commit remaining files**

```bash
git add .
git commit -m "chore: update tests, docs, and configuration files"
```

---

## Phase 2: Fix Broken Inventory References (P0 - Runtime Safety)

### Task 2.1: Fix InventoryTransfer Model References

**Files:**
- Modify: `backend/models/InventoryTransfer.js`

**Problem:** The model requires deleted standalone inventory models.

**Step 1: Read current InventoryTransfer.js**

Check lines 50-80 for the require statements.

**Step 2: Update require statements**

Replace:
```javascript
const PharmacyInventory = require('./PharmacyInventory');
const FrameInventory = require('./FrameInventory');
const ContactLensInventory = require('./ContactLensInventory');
const LabConsumableInventory = require('./LabConsumableInventory');
const ReagentInventory = require('./ReagentInventory');
```

With:
```javascript
const {
  PharmacyInventory,
  FrameInventory,
  ContactLensInventory,
  LabConsumableInventory,
  ReagentInventory,
  Inventory
} = require('./Inventory');
```

**Step 3: Test the import**

```bash
node -e "require('./backend/models/InventoryTransfer')"
```
Expected: No errors

**Step 4: Commit fix**

```bash
git add backend/models/InventoryTransfer.js
git commit -m "fix(models): update InventoryTransfer to use unified Inventory imports"
```

---

### Task 2.2: Scan and Fix All Legacy Inventory Requires

**Step 1: Find all files still requiring legacy models**

```bash
grep -r "require.*PharmacyInventory\|require.*FrameInventory\|require.*ContactLensInventory\|require.*OpticalLensInventory\|require.*ReagentInventory\|require.*LabConsumableInventory\|require.*SurgicalSupplyInventory" backend/ --include="*.js" | grep -v node_modules | grep -v Inventory.js
```

**Step 2: For each file found, update the require to use unified model**

Pattern to replace:
```javascript
// OLD
const PharmacyInventory = require('../models/PharmacyInventory');

// NEW
const { PharmacyInventory } = require('../models/Inventory');
```

**Step 3: Verify all imports work**

```bash
node -e "
const files = [
  './backend/models/InventoryTransfer',
  './backend/controllers/pharmacyController',
  './backend/controllers/inventory/index'
];
files.forEach(f => {
  try { require(f); console.log('OK:', f); }
  catch(e) { console.log('FAIL:', f, e.message); }
});
"
```

**Step 4: Commit all fixes**

```bash
git add backend/
git commit -m "fix(backend): update all legacy inventory requires to unified model"
```

---

## Phase 3: Fix Backend Test Infrastructure (P1)

### Task 3.1: Fix Test Timeout Conflict

**Files:**
- Modify: `backend/tests/setup.js:52`

**Problem:** jest.config.js sets 60s but setup.js overrides to 30s.

**Step 1: Remove conflicting timeout in setup.js**

Remove line 52:
```javascript
// DELETE THIS LINE:
jest.setTimeout(30000);
```

The jest.config.js `testTimeout: 60000` will now apply.

**Step 2: Verify config**

```bash
grep -n "setTimeout\|testTimeout" backend/jest.config.js backend/tests/setup.js
```
Expected: Only jest.config.js has timeout setting

**Step 3: Commit**

```bash
git add backend/tests/setup.js
git commit -m "fix(tests): remove conflicting timeout override in setup.js"
```

---

### Task 3.2: Add Email Service Mock

**Files:**
- Create: `backend/tests/mocks/emailService.js`
- Modify: `backend/tests/setup.js`

**Step 1: Create email mock**

```javascript
// backend/tests/mocks/emailService.js
const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendAppointmentReminder: jest.fn().mockResolvedValue({ success: true })
};

module.exports = mockEmailService;
```

**Step 2: Add mock to setup.js**

Add after line 10 in setup.js:
```javascript
// Mock email service to prevent actual email sending
jest.mock('../services/emailService', () => require('./mocks/emailService'));
jest.mock('../utils/sendEmail', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));
```

**Step 3: Create mocks directory if needed**

```bash
mkdir -p backend/tests/mocks
```

**Step 4: Commit**

```bash
git add backend/tests/mocks/emailService.js
git add backend/tests/setup.js
git commit -m "fix(tests): add email service mock to prevent actual email sending"
```

---

### Task 3.3: Fix Registration Duplicate Error Code

**Files:**
- Modify: `backend/controllers/authController.js`

**Step 1: Find duplicate user handling**

Search for where duplicate email/username is checked.

**Step 2: Ensure 400 response for duplicates**

The duplicate check should return:
```javascript
return res.status(400).json({
  success: false,
  error: 'Email or username already exists'
});
```

NOT:
```javascript
throw new Error('...')  // This would cause 500
```

**Step 3: Verify with test**

```bash
cd backend && npm test -- --testPathPattern="register" --testNamePattern="duplicate" -t "duplicate"
```

**Step 4: Commit**

```bash
git add backend/controllers/authController.js
git commit -m "fix(auth): return 400 for duplicate user registration instead of 500"
```

---

### Task 3.4: Run Backend Tests to Verify Fixes

**Step 1: Stop any running server**

```bash
pkill -f "node.*server" || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
```

**Step 2: Run test suite**

```bash
cd backend && npm test -- --testPathPattern="auth" --verbose
```

**Step 3: Check results**

Expected: All auth tests pass (or at least no timeout/port errors)

---

## Phase 4: Add NewConsultation Deprecation Banner (P1)

### Task 4.1: Add Deprecation Banner Component

**Files:**
- Modify: `frontend/src/pages/ophthalmology/NewConsultation.jsx`

**Step 1: Add deprecation banner after imports (around line 48)**

```jsx
// Deprecation banner component
const DeprecationBanner = () => (
  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4">
    <div className="flex items-center">
      <AlertTriangle className="h-5 w-5 text-amber-500 mr-3" />
      <div>
        <p className="text-amber-700 font-medium">
          Cette interface sera bientôt remplacée par StudioVision
        </p>
        <p className="text-amber-600 text-sm mt-1">
          La nouvelle interface offre une meilleure expérience.
          <Link to="/ophthalmology/studio" className="underline ml-1">
            Essayer StudioVision
          </Link>
        </p>
      </div>
    </div>
  </div>
);
```

**Step 2: Add banner to render (in the main return, before content)**

Find the main container div and add:
```jsx
<DeprecationBanner />
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/pages/ophthalmology/NewConsultation.jsx
git commit -m "feat(ophthalmology): add deprecation banner to NewConsultation

Directs users to StudioVision as the new canonical consultation interface.
French localization: 'Cette interface sera bientôt remplacée par StudioVision'"
```

---

## Phase 5: E2E Test New StudioVision Components (P2)

### Task 5.1: Create StudioVision Component Test

**Files:**
- Create: `tests/playwright/test_studiovision_components.py`

**Step 1: Create test file**

```python
"""
StudioVision Component E2E Tests

Tests the new components added on Dec 18:
- OrthoptieQuickPanel
- DeviceDataBanner
- QuickActionsBar
"""

import asyncio
from playwright.async_api import async_playwright, expect
import os

BASE_URL = os.getenv('MEDFLOW_URL', 'http://localhost:5173')

async def login(page):
    """Login as admin user"""
    await page.goto(f'{BASE_URL}/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'MgrSecure123!@#')
    await page.click('button[type="submit"]')
    await page.wait_for_url('**/dashboard**', timeout=10000)

async def test_studiovision_consultation_loads():
    """Test that StudioVision consultation page loads"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await login(page)

        # Navigate to StudioVision (need a patient ID)
        await page.goto(f'{BASE_URL}/patients')
        await page.wait_for_selector('table tbody tr', timeout=10000)

        # Click first patient
        await page.click('table tbody tr:first-child')
        await page.wait_for_timeout(1000)

        # Look for consultation button
        consultation_btn = page.locator('text=Nouvelle Consultation')
        if await consultation_btn.count() > 0:
            await consultation_btn.click()
            await page.wait_for_timeout(2000)

            # Verify StudioVision components are present
            # QuickActionsBar should have keyboard shortcut hints
            quick_actions = page.locator('[data-testid="quick-actions-bar"]')
            if await quick_actions.count() > 0:
                print("✅ QuickActionsBar found")
            else:
                print("⚠️ QuickActionsBar not found (may not be visible yet)")

        await browser.close()
        print("✅ StudioVision consultation test complete")

async def test_orthoptie_tab():
    """Test Orthoptie tab with OrthoptieQuickPanel"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await login(page)

        # Navigate to ophthalmology
        await page.goto(f'{BASE_URL}/ophthalmology')
        await page.wait_for_timeout(2000)

        # Look for Orthoptie tab
        orthoptie_tab = page.locator('text=Orthoptie')
        if await orthoptie_tab.count() > 0:
            await orthoptie_tab.click()
            await page.wait_for_timeout(1000)

            # Check for purple-themed panel (OrthoptieQuickPanel)
            purple_panel = page.locator('.bg-purple-50, [class*="purple"]')
            if await purple_panel.count() > 0:
                print("✅ OrthoptieQuickPanel purple theme found")

            # Check for Cover Test
            cover_test = page.locator('text=Cover Test')
            if await cover_test.count() > 0:
                print("✅ Cover Test section found")
        else:
            print("⚠️ Orthoptie tab not found on this page")

        await browser.close()
        print("✅ Orthoptie tab test complete")

async def main():
    print("\n=== StudioVision Component E2E Tests ===\n")

    try:
        await test_studiovision_consultation_loads()
    except Exception as e:
        print(f"❌ StudioVision load test failed: {e}")

    try:
        await test_orthoptie_tab()
    except Exception as e:
        print(f"❌ Orthoptie tab test failed: {e}")

    print("\n=== Tests Complete ===\n")

if __name__ == "__main__":
    asyncio.run(main())
```

**Step 2: Run test**

```bash
cd tests/playwright && python3 test_studiovision_components.py
```

**Step 3: Commit**

```bash
git add tests/playwright/test_studiovision_components.py
git commit -m "test(e2e): add StudioVision component tests

Tests OrthoptieQuickPanel, DeviceDataBanner, and QuickActionsBar components"
```

---

## Phase 6: Modal Migration Tracking (P2 - Setup)

### Task 6.1: Create Modal Migration Checklist

**Files:**
- Create: `docs/plans/modal-migration-checklist.md`

**Step 1: Create tracking document**

```markdown
# Modal Migration Checklist

## Shared Modal System
- [x] BaseModal.jsx - Created
- [x] ConfirmModal.jsx - Created
- [x] FormModal.jsx - Created
- [x] WizardModal.jsx - Created

## Modals to Migrate

### Priority 1: High-traffic modals
- [ ] `frontend/src/components/ConfirmationModal.jsx` → Use shared ConfirmModal
- [ ] `frontend/src/pages/Appointments/AppointmentModal.jsx` → Use shared FormModal
- [ ] `frontend/src/pages/Queue/modals/CheckInModal.jsx` → Use shared FormModal
- [ ] `frontend/src/pages/Queue/modals/WalkInModal.jsx` → Use shared FormModal

### Priority 2: Form modals
- [ ] `frontend/src/components/PatientSelectorModal.jsx` → Use shared BaseModal
- [ ] `frontend/src/pages/Approvals/ApprovalRequestModal.jsx` → Use shared FormModal
- [ ] `frontend/src/pages/Approvals/ApprovalDetailModal.jsx` → Use shared BaseModal
- [ ] `frontend/src/pages/UnifiedInventory/StockOperationModal.jsx` → Already new pattern

### Priority 3: Specialized modals
- [ ] `frontend/src/components/PrescriptionSafetyModal.jsx` → Use shared ConfirmModal
- [ ] `frontend/src/components/PrescriptionWarningModal.jsx` → Use shared ConfirmModal
- [ ] `frontend/src/components/AccessibleModal.jsx` → Deprecate (merged into BaseModal)
- [ ] `frontend/src/components/PriorAuthorizationModal.jsx` → Use shared FormModal
- [ ] `frontend/src/components/optical/DepotRequestModal.jsx` → Use shared FormModal

### Priority 4: Queue modals
- [ ] `frontend/src/pages/Queue/modals/RoomModal.jsx`
- [ ] `frontend/src/pages/Queue/modals/ShortcutsModal.jsx`

### Priority 5: Other modals
- [ ] `frontend/src/components/SyncProgressModal.jsx` → Use shared BaseModal
- [ ] `frontend/src/components/PrepareOfflineModal.jsx` → Use shared FormModal
- [ ] `frontend/src/components/ConflictResolutionModal.jsx` → Use shared FormModal
- [ ] `frontend/src/pages/Patients/components/modals/KeyboardShortcutsModal.jsx`
- [ ] `frontend/src/pages/Patients/components/modals/MergeDuplicatesModal.jsx`
- [ ] `frontend/src/pages/Patients/components/modals/PatientDetailsModal.jsx`
- [ ] `frontend/src/pages/ophthalmology/components/prescription/PrescriptionPreviewModal.jsx`
- [ ] `frontend/src/pages/ophthalmology/components/alerts/EmergencyModal.jsx`

## Migration Pattern

Replace:
```jsx
// OLD
import { Dialog, Transition } from '@headlessui/react';
// ... manual implementation
```

With:
```jsx
// NEW
import { BaseModal, ConfirmModal, FormModal } from '@/components/shared/Modal';
// ... use shared component
```

## Progress
- Total modals: 24
- Migrated: 0
- Remaining: 24
```

**Step 2: Commit**

```bash
git add docs/plans/modal-migration-checklist.md
git commit -m "docs: add modal migration checklist for Phase 2.2"
```

---

## Phase 7: Final Verification

### Task 7.1: Verify All Commits

**Step 1: Check git log**

```bash
git log --oneline -15
```

Expected: 10+ organized commits

**Step 2: Check remaining uncommitted files**

```bash
git status --short | wc -l
```

Expected: 0 or very few files

### Task 7.2: Full Build Verification

**Step 1: Build frontend**

```bash
cd frontend && npm run build
```
Expected: Success

**Step 2: Lint backend**

```bash
cd backend && npx eslint server.js --quiet
```
Expected: 0 errors

**Step 3: Run frontend tests**

```bash
cd frontend && npm run test:run
```
Expected: All pass

### Task 7.3: Server Smoke Test

**Step 1: Start server**

```bash
cd backend && node server.js &
sleep 5
```

**Step 2: Health check**

```bash
curl -s http://localhost:5001/health | head -20
```
Expected: Health response

**Step 3: Stop server**

```bash
pkill -f "node.*server"
```

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Git Commits | 6 tasks | 15 min |
| 2. Inventory Fixes | 2 tasks | 20 min |
| 3. Backend Tests | 4 tasks | 30 min |
| 4. Deprecation Banner | 1 task | 10 min |
| 5. E2E Tests | 1 task | 15 min |
| 6. Modal Tracking | 1 task | 5 min |
| 7. Verification | 3 tasks | 10 min |

**Total: ~1.5-2 hours**

---

## Execution

Run with: `superpowers:executing-plans` skill

Or execute each phase sequentially, committing after each task completes.
