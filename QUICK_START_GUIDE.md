# 🚀 QUICK START GUIDE
## How to Begin Fixing CareVision

**Created:** 2025-11-20
**For:** Developers starting the renovation project

---

## ⚡ START HERE - First 30 Minutes

### Step 1: Read This First (5 min)
You have **103 issues** to fix across **9 weeks**.
**Good news:** They're organized systematically in `MASTER_EXECUTION_PLAN.md`

### Step 2: Set Up Your Environment (10 min)

```bash
# 1. Make sure you're on the right branch
cd /Users/xtm888/magloire
git status

# 2. Create a feature branch for Week 1
git checkout -b week-1-critical-fixes

# 3. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 4. Start development servers (separate terminals)
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev
```

### Step 3: Understand The Problem (10 min)

**Current State:**
- ❌ 22 pages will CRASH (broken toast)
- ❌ 30 files missing token refresh (users randomly logged out)
- ❌ 11 files with stale auth (security risk)
- ❌ 3 race conditions (duplicate IDs)
- ❌ Application CANNOT be deployed

**Goal Week 1:**
✅ Fix all P0 blockers → Make application deployable

### Step 4: Start With Day 1 (5 min)

**TODAY'S FOCUS: Fix Broken Toast System (22 files)**

Open: `MASTER_EXECUTION_PLAN.md` → Search for "WEEK 1, DAY 1"

---

## 📋 WEEK 1 OVERVIEW

| Day | Focus | Files | Time | Outcome |
|-----|-------|-------|------|---------|
| Mon | Broken toast system | 22 | 8h | Toasts work |
| Tue | Wrong API instance | 30 | 8h | Token refresh works |
| Wed | Stale auth data | 11 | 8h | Auth updates live |
| Thu | Backend race conditions | 3 | 8h | IDs atomic |
| Fri | Data model issues + deploy | 5 | 8h | Staging deployed |

**End of Week 1:**
✅ Application deployable
✅ All P0 blockers resolved
✅ Ready for Week 2 (redundancy elimination)

---

## 🎯 YOUR FIRST TASK (Right Now)

### Fix Broken Toast - First 5 Pages (2 hours)

**Problem:**
Pages import `useToast` from `../hooks/useToast.js`, but `ToastContext` is NOT in App.jsx providers → crashes when showing toast.

**Solution:**
Delete custom toast files, use `react-toastify` (already installed).

**Steps:**

1. **Delete 3 files** (2 min)
   ```bash
   cd frontend/src
   rm contexts/ToastContext.jsx
   rm hooks/useToast.js
   rm components/ToastContainer.jsx
   ```

2. **Update hooks/index.js** (1 min)
   ```bash
   # Open: frontend/src/hooks/index.js
   # Remove line: export { useToast } from './useToast';
   ```

3. **Fix Queue.jsx** (20 min)
   ```bash
   # Open: frontend/src/pages/Queue.jsx
   ```

   **Find and replace:**
   ```javascript
   // LINE 13-14: DELETE these imports
   import { useToast } from '../hooks/useToast';
   import { ToastContainer } from '../components/ToastContainer';

   // LINE ~45: DELETE this hook usage
   const { showToast } = useToast();

   // ADD at top instead:
   import { toast } from 'react-toastify';

   // REPLACE ALL toast calls:
   showToast.success('Patient checked in')  →  toast.success('Patient checked in')
   showToast.error('Error checking in')     →  toast.error('Error checking in')
   showToast.warning('Warning message')     →  toast.warning('Warning message')
   showToast.info('Info message')           →  toast.info('Info message')
   ```

4. **Test Queue.jsx** (10 min)
   ```bash
   # Start dev server if not running
   cd frontend && npm run dev

   # In browser:
   # 1. Navigate to http://localhost:5173/queue
   # 2. Try to check in a patient
   # 3. Verify toast notification appears
   # 4. Check browser console - no errors
   ```

5. **Fix remaining 4 pages** (same pattern, 90 min)
   - Patients.jsx (line 7-8)
   - Appointments.jsx (line 10-11)
   - Laboratory.jsx (line 5-6)
   - Prescriptions.jsx (line 10)

6. **Commit your work** (5 min)
   ```bash
   git add .
   git commit -m "Fix broken toast in 5 critical pages (Queue, Patients, Appointments, Lab, Prescriptions)"
   git push origin week-1-critical-fixes
   ```

**Success Criteria:**
- [ ] 5 pages no longer crash
- [ ] Toast notifications show correctly
- [ ] No console errors
- [ ] Commit pushed to GitHub

---

## 🔧 HELPFUL COMMANDS

### Development
```bash
# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# Run tests (if they exist)
npm test

# Build frontend
npm run build

# Check for errors
npm run lint
```

### Git Workflow
```bash
# Create feature branch
git checkout -b week-X-feature-name

# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Descriptive message"

# Push
git push origin week-X-feature-name

# Create PR (if using GitHub)
gh pr create --title "Week X: Feature Name" --body "Description"
```

### Finding Files
```bash
# Search for text in files
grep -r "useToast" frontend/src/

# Find files by name
find frontend/src -name "*Toast*"

# Count lines in file
wc -l frontend/src/pages/PatientVisit.jsx
```

### Testing Specific Issues
```bash
# Test toast
# Navigate to /queue → Check in patient → Toast should show

# Test API token refresh
# Login → Wait 10 min → Make API call → Should auto-refresh

# Test auth updates
# Login → Check Dashboard shows user name immediately
```

---

## 📖 DOCUMENT REFERENCE

### Main Planning Documents
- **MASTER_EXECUTION_PLAN.md** - Complete 9-week plan (all 103 issues)
- **CONSOLIDATION_REPORT.md** - Redundancy analysis (5,400 lines to delete)
- **MASTER_FRONTEND_ANALYSIS.md** - Frontend file-by-file analysis
- **COMPLETE_BUSINESS_LOGIC_AUDIT.md** - Backend function audit
- **BACKEND_DISCOVERIES.md** - Architecture patterns

### Quick Reference
- **QUICK_START_GUIDE.md** - This file (start here)
- **FILE_CHANGE_MANIFEST.md** - Which files to change (to be created)

### Issue Reports (Original)
All stored in `/Users/xtm888/magloire/*.md`

---

## 🚨 COMMON ISSUES & SOLUTIONS

### Issue: "npm install fails"
**Solution:** Fix package.json axios version first
```bash
# frontend/package.json line 16
# Change: "axios": "^1.13.2"
# To: "axios": "^1.6.0"
```

### Issue: "ESLint not working"
**Solution:** Week 7 task, ignore for now or disable temporarily
```bash
# Temporary: Disable ESLint
# Add to package.json scripts:
"lint": "echo 'ESLint temporarily disabled'"
```

### Issue: "Toast still not working after fix"
**Checklist:**
- [ ] Deleted ToastContext.jsx?
- [ ] Deleted useToast.js?
- [ ] Deleted ToastContainer.jsx?
- [ ] Updated imports to use react-toastify?
- [ ] App.jsx has ToastContainer from react-toastify?
- [ ] Cleared browser cache?

### Issue: "Page crashes with 'Cannot read property of undefined'"
**Likely cause:** Stale auth data (Week 1 Day 3 issue)
**Quick fix:** Use AuthContext instead of localStorage
```javascript
// WRONG:
const user = JSON.parse(localStorage.getItem('user'));

// RIGHT:
import { useAuth } from '../contexts/AuthContext';
const { user } = useAuth();
```

---

## 📊 PROGRESS TRACKING

### Daily Checklist
At end of each day, verify:
- [ ] All planned tasks completed
- [ ] Tests passed
- [ ] Code committed and pushed
- [ ] No new console errors
- [ ] Documentation updated
- [ ] Tomorrow's tasks reviewed

### Weekly Checklist
At end of each week, verify:
- [ ] All weekly goals met
- [ ] Full regression test passed
- [ ] Deployed to staging
- [ ] No critical bugs
- [ ] Next week planned

---

## 👥 TEAM COORDINATION

### If Working Alone
- Focus on one issue at a time
- Complete Week 1 before Week 2
- Test thoroughly after each fix
- Document any decisions

### If Working with Team
- **Frontend Dev:** Days 1-3 (frontend fixes)
- **Backend Dev:** Days 4-5 (backend fixes)
- **QA:** Continuous testing
- Daily standup to sync progress

---

## 🎯 SUCCESS METRICS FOR WEEK 1

By Friday end of day, you should have:
- ✅ Fixed 63 files (22 toast + 30 API + 11 auth)
- ✅ Fixed 7 backend critical bugs
- ✅ Application deployed to staging
- ✅ 0 crashes
- ✅ All critical workflows working

**If you achieve this, Week 1 is SUCCESS! 🎉**

---

## 🔜 WHAT'S NEXT

After Week 1, you'll move to **PHASE 2: REDUNDANCY ELIMINATION**

**Week 2 Preview:**
- Delete PatientSummary.jsx (400 lines)
- Delete PatientVisit.jsx (2,564 lines)
- Delete RefractionExam.jsx (900 lines)
- Total: 3,864 lines deleted in one week!

This is when you'll see MASSIVE code reduction.

---

## ❓ NEED HELP?

### Stuck on Something?
1. Check MASTER_EXECUTION_PLAN.md for detailed steps
2. Check original report for context
3. Search codebase for similar patterns
4. Ask for clarification (create GitHub issue)

### Found a Bug Not in Plan?
1. Document it
2. Assess priority (P0/P1/P2/P3)
3. Add to appropriate week in plan
4. Continue with current task

### Timeline Slipping?
1. Focus on P0 issues first
2. Skip P3/P4 if needed
3. Extend Week 1 if necessary
4. DO NOT skip testing

---

**NOW GO FIX THAT TOAST SYSTEM! 🚀**

Open `MASTER_EXECUTION_PLAN.md` and start with Week 1, Day 1, Morning Task.

You got this! 💪
