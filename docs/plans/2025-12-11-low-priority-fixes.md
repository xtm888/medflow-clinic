# Low-Priority Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 low-priority issues identified during project verification: test password validation, ClinicContext Redux wrapper, nodemailer upgrade, and frontend chunk splitting.

**Architecture:** Each fix is independent and can be done in any order. Tasks are ordered by complexity (simplest first).

**Tech Stack:** Node.js, Jest, Vitest, React Testing Library, Vite, nodemailer

---

## Task 1: Fix Backend Test Password Validation (Est. 15min)

**Problem:** Password policy requires 12+ characters with uppercase, lowercase, number, and special character. Test fixtures use `Test123!@#` (10 chars) which fails validation.

**Files:**
- Modify: `/Users/xtm888/magloire/backend/tests/fixtures/generators.js:47`
- Modify: `/Users/xtm888/magloire/backend/tests/integration/patients.test.js:17,26`

**Step 1: Update test user generator default password**

In `generators.js`, change line 47:

```javascript
// FROM:
password: overrides.password || 'Test123!@#',

// TO:
password: overrides.password || 'TestPass123!@#',
```

**Step 2: Update integration test passwords**

In `patients.test.js`, update lines 17 and 26:

```javascript
// FROM:
password: 'Test123!@#'

// TO:
password: 'TestPass123!@#'
```

**Step 3: Run backend tests to verify**

Run: `cd /Users/xtm888/magloire/backend && npm test -- --testPathPattern=patients 2>&1 | tail -30`
Expected: Tests should pass or show different errors (not password validation)

**Step 4: Commit**

```bash
git add backend/tests/fixtures/generators.js backend/tests/integration/patients.test.js
git commit -m "fix(tests): update test passwords to meet 12-char policy

Test fixtures were using 10-character passwords, but the password
policy requires minimum 12 characters. Updated to 'TestPass123!@#'
which meets all requirements."
```

---

## Task 2: Fix ClinicContext.test.jsx Redux Wrapper (Est. 15min)

**Problem:** ClinicProvider uses `useDispatch()` from react-redux, but test wrapper doesn't include Redux Provider. Error: "could not find react-redux context value"

**Files:**
- Modify: `/Users/xtm888/magloire/frontend/src/test/contexts/ClinicContext.test.jsx`

**Step 1: Add Redux Provider import and store setup**

At the top of the file (after line 3), add:

```javascript
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Create a minimal test store
const createTestStore = () => configureStore({
  reducer: {
    // Minimal reducers needed for ClinicContext
    clinic: (state = { selectedClinic: null }) => state
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});
```

**Step 2: Update all test wrappers to include Redux Provider**

Find all wrapper definitions and wrap ClinicProvider with Redux Provider:

```javascript
// FROM:
const wrapper = ({ children }) => (
  <ClinicProvider>{children}</ClinicProvider>
);

// TO:
const wrapper = ({ children }) => (
  <Provider store={createTestStore()}>
    <ClinicProvider>{children}</ClinicProvider>
  </Provider>
);
```

There are 7 wrapper definitions to update (in each `it()` block).

**Step 3: Run tests to verify**

Run: `cd /Users/xtm888/magloire/frontend && npm run test -- --run src/test/contexts/ClinicContext.test.jsx`
Expected: All 6 tests should pass

**Step 4: Commit**

```bash
git add frontend/src/test/contexts/ClinicContext.test.jsx
git commit -m "fix(tests): add Redux Provider wrapper to ClinicContext tests

ClinicProvider uses useDispatch() from react-redux, which requires
a Redux Provider parent. Added minimal test store configuration."
```

---

## Task 3: Upgrade nodemailer to 7.0.11 (Est. 30min)

**Problem:** npm audit shows vulnerability in nodemailer 6.10.1. Need to upgrade to 7.0.11.

**Breaking Changes in nodemailer 7.x:**
- SESv2 SDK support (older SES SDK removed)
- SES rate limiting and idling features removed
- **This project uses SMTP, not SES, so upgrade should be simple**

**Files:**
- Modify: `/Users/xtm888/magloire/backend/package.json`
- Review: `/Users/xtm888/magloire/backend/services/emailService.js`
- Review: `/Users/xtm888/magloire/backend/utils/sendEmail.js`

**Step 1: Review current nodemailer usage**

Verify the project uses SMTP transport (not SES):

```javascript
// emailService.js line 16 uses:
this.transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

This is SMTP-based - no SES. Safe to upgrade.

**Step 2: Upgrade nodemailer**

Run: `cd /Users/xtm888/magloire/backend && npm install nodemailer@7.0.11`

**Step 3: Verify installation**

Run: `cd /Users/xtm888/magloire/backend && npm ls nodemailer`
Expected: `nodemailer@7.0.11`

**Step 4: Test email service initialization**

Create a quick test script (or just start the backend):
Run: `cd /Users/xtm888/magloire/backend && node -e "const emailService = require('./services/emailService'); console.log('Email service loaded:', typeof emailService)"`
Expected: No errors, output shows "Email service loaded: object"

**Step 5: Run full test suite to verify no regressions**

Run: `cd /Users/xtm888/magloire/backend && npm test 2>&1 | tail -20`
Expected: No new failures related to email

**Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(deps): upgrade nodemailer from 6.10.1 to 7.0.11

Fixes security vulnerability. Project uses SMTP transport (not SES),
so no breaking changes affect this codebase."
```

---

## Task 4: Split Large Frontend Chunks (Est. 45min)

**Problem:** NewConsultation chunk is 435KB (too large). Need to configure Vite manual chunks to split heavy dependencies.

**Files:**
- Modify: `/Users/xtm888/magloire/frontend/vite.config.js`

**Step 1: Analyze current bundle**

Run: `cd /Users/xtm888/magloire/frontend && npm run build 2>&1 | grep -E "NewConsultation|chunk-" | head -20`

**Step 2: Add rollup manual chunks configuration**

In `vite.config.js`, add build configuration with manualChunks:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    hmr: {
      port: 5173,
      host: 'localhost',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - split large libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-ui': ['lucide-react'],

          // Clinical module - used by ophthalmology pages
          'clinical': [
            './src/modules/clinical/index.js',
          ],

          // Heavy page components - lazy loaded anyway, but separate chunks
          'ophthalmology': [
            './src/pages/ophthalmology/NewConsultation.jsx',
          ],
        },
      },
    },
    // Increase chunk size warning limit (optional, for visibility)
    chunkSizeWarningLimit: 500,
  },
})
```

**Step 3: Build and verify chunk sizes**

Run: `cd /Users/xtm888/magloire/frontend && npm run build 2>&1 | grep -E "\.js\s+" | head -30`
Expected: NewConsultation chunk should be smaller, vendor chunks should be separate

**Step 4: Test the build works**

Run: `cd /Users/xtm888/magloire/frontend && npm run preview &`
Then check the app loads correctly.

**Step 5: Commit**

```bash
git add frontend/vite.config.js
git commit -m "perf(frontend): configure manual chunks for better code splitting

Split large vendor libraries (react, redux, ui) and heavy page
components into separate chunks. Improves initial load time by
enabling better caching and parallel downloads."
```

---

## Verification Checklist

After completing all tasks:

1. [ ] Backend tests pass with new password policy
2. [ ] ClinicContext tests pass with Redux wrapper
3. [ ] nodemailer 7.0.11 installed, email service works
4. [ ] Frontend builds successfully with smaller chunks
5. [ ] All changes committed

---

## Summary

| Task | Files Modified | Risk | Verification |
|------|---------------|------|--------------|
| Password validation | 2 files | Low | Run backend tests |
| Redux wrapper | 1 file | Low | Run ClinicContext tests |
| nodemailer upgrade | 2 files | Low | npm ls, test email |
| Chunk splitting | 1 file | Low | Build, check sizes |

**Total estimated effort:** ~1.5 hours

---

## References

- [nodemailer Changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md)
- [Vite Manual Chunks](https://vitejs.dev/guide/build.html#chunking-strategy)
