# 📁 FILE CHANGE MANIFEST
## Complete List of Every File That Needs Changes

**Generated:** 2025-11-20
**Total Files to Change:** 93 files
**Total Files to Delete:** 7 files
**Total Files to Create:** 8 files

---

## 🗑️ FILES TO DELETE (7 files)

### Frontend (4 files)
1. `frontend/src/contexts/ToastContext.jsx` - Broken toast context
2. `frontend/src/hooks/useToast.js` - Broken toast hook
3. `frontend/src/components/ToastContainer.jsx` - Broken toast container
4. `frontend/src/pages/PatientSummary.jsx` - Duplicate of PatientDetail
5. `frontend/src/pages/PatientVisit.jsx` - Replace with NewConsultation
6. `frontend/src/pages/ophthalmology/RefractionExam.jsx` - Duplicate workflow

### Backend (2 files)
7. `backend/services/api.js` - Wrong API instance (use apiConfig.js)

### To Delete Later (Week 5-7)
- `backend/routes/commentTemplates.js`
- `backend/routes/doseTemplates.js`
- `backend/controllers/commentTemplateController.js`
- `backend/controllers/doseTemplateController.js`

---

## ✏️ FILES TO MODIFY (93 files)

### WEEK 1: CRITICAL FIXES

#### Issue #1: Broken Toast System (22 files)

**Pattern for all:**
- Remove: `import { useToast } from '../hooks/useToast';`
- Remove: `const { showToast } = useToast();`
- Add: `import { toast } from 'react-toastify';`
- Replace: `showToast.success(...)` → `toast.success(...)`

**Files:**
1. `frontend/src/pages/Queue.jsx` (line 13-14, ~45)
2. `frontend/src/pages/Patients.jsx` (line 7-8, ~40)
3. `frontend/src/pages/Appointments.jsx` (line 10-11, ~50)
4. `frontend/src/pages/Laboratory.jsx` (line 5-6, ~35)
5. `frontend/src/pages/Prescriptions.jsx` (line 10, ~60)
6. `frontend/src/pages/PatientDetail.jsx` (line 10-11, ~55)
7. `frontend/src/pages/PatientSummary.jsx` (line 10-11) → **DELETE INSTEAD**
8. `frontend/src/pages/Invoicing.jsx` (line 6-7, ~45)
9. `frontend/src/pages/DocumentGeneration.jsx` (line 5-6, ~30)
10. `frontend/src/pages/DeviceDetail.jsx` (line 25-26, ~70)
11. `frontend/src/pages/DeviceImport.jsx` (line 17-18, ~50)
12. `frontend/src/pages/DeviceManager.jsx` (line 24-25, ~60)
13. `frontend/src/pages/DeviceStatusDashboard.jsx` (line 23-24, ~55)
14. `frontend/src/pages/ophthalmology/GlassesOrder.jsx` (line 11-12, ~40)
15. `frontend/src/pages/ophthalmology/RefractionExam.jsx` (line 14-15) → **DELETE INSTEAD**
16. `frontend/src/pages/patient/PatientAppointments.jsx` (line 8-9, ~30)
17. `frontend/src/hooks/index.js` - Remove: `export { useToast } from './useToast';`

---

#### Issue #2: Wrong API Instance (30 files)

**Pattern for all:**
- Change: `import api from './api';` → `import api from './apiConfig';`
- OR: `import api from '../services/api';` → `import api from '../services/apiConfig';`

**Services (2):**
18. `frontend/src/services/alertService.js` (line 1)
19. `frontend/src/services/syncService.js` (line 3)

**Template Components (4):**
20. `frontend/src/components/templates/ExaminationSelector.jsx` (line 2)
21. `frontend/src/components/templates/LaboratoryTestSelector.jsx` (line 2)
22. `frontend/src/components/templates/MedicationAutocomplete.jsx` (line 2)
23. `frontend/src/components/templates/PathologyFindingSelector.jsx` (line 2)

**Document Components (2):**
24. `frontend/src/components/documents/DocumentManager.jsx` (line 8)
25. `frontend/src/components/documents/DocumentViewer.jsx` (line 7)

**Core Components (4):**
26. `frontend/src/components/GlobalSearch.jsx` (line 4)
27. `frontend/src/components/PatientSelectorModal.jsx` (line 3)
28. `frontend/src/components/PrintManager.jsx` (line 3)
29. `frontend/src/components/QuickTreatmentBuilder.jsx` (line 17)

**Patient Portal Pages (5):**
30. `frontend/src/pages/patient/PatientDashboard.jsx` (line 6)
31. `frontend/src/pages/patient/PatientBills.jsx` (line 5)
32. `frontend/src/pages/patient/PatientPrescriptions.jsx` (line 5)
33. `frontend/src/pages/patient/PatientProfile.jsx` (line 3)
34. `frontend/src/pages/patient/PatientAppointments.jsx` (line 5)

**Main Pages (6):**
35. `frontend/src/pages/Imaging.jsx` (line 4)
36. `frontend/src/pages/Notifications.jsx` (line 3)
37. `frontend/src/pages/Services.jsx` (line 3)
38. `frontend/src/pages/PublicBooking.jsx` (line 4)
39. `frontend/src/pages/Prescriptions.jsx` (line 9)
40. `frontend/src/pages/Invoicing.jsx` (line 5)

**Specialty Pages (5):**
41. `frontend/src/pages/ophthalmology/OphthalmologyDashboard.jsx` (line 10)
42. `frontend/src/pages/templates/TemplateManager.jsx` (line 7)
43. `frontend/src/pages/visits/VisitDashboard.jsx` (line 6)
44. `frontend/src/pages/visits/VisitTimeline.jsx` (line 6)
45. `frontend/src/pages/analytics/AnalyticsDashboard.jsx` (line 24)

---

#### Issue #3: Stale Authentication (11 files)

**Pattern for all:**
- Remove: `const user = JSON.parse(localStorage.getItem('user') || '{}');`
- Add: `import { useAuth } from '../contexts/AuthContext';`
- Add: `const { user } = useAuth();` inside component

**Files:**
46. `frontend/src/hooks/usePermissions.js` (line 19-26)
47. `frontend/src/components/PermissionGate.jsx` (line 26-32)
48. `frontend/src/components/RoleGuard.jsx` (line 22-28)
49. `frontend/src/pages/Dashboard.jsx` (line 88-94)
50. `frontend/src/pages/Settings.jsx` (line 60-64)
51. `frontend/src/layouts/PatientLayout.jsx` (line 33-39) - Also remove mock data!
52. `frontend/src/store/slices/authSlice.js` (line 7-8) - Remove localStorage from initialState

**Name Collision Fix:**
53. `frontend/src/hooks/useRedux.js` - Rename `useAuth` → `useAuthRedux`

**Package.json Fix:**
54. `frontend/package.json` (line 16) - Change axios version

---

#### Backend Critical Bugs (Week 1 Day 4-5)

**Race Condition Fixes (3 files):**
55. `backend/controllers/queueController.js` (line 91-101) - Use Counter for appointmentId
56. `backend/controllers/authController.js` + `userController.js` - Use Counter for employeeId
57. `backend/models/Invoice.js` (line 290-294) - Use Counter for invoiceId

**Data Model Fixes (5 files):**
58. `backend/controllers/laboratoryController.js` (line 100-103, 149) - Change `laboratoryTests` → `laboratoryOrders`
59. `backend/models/Patient.js` - Add `photoPath` and `photoUrl` fields
60. `backend/models/Invoice.js` (line 335) - Use crypto.randomBytes for paymentId
61. `backend/controllers/treatmentProtocolController.js` (line 199) - Field whitelisting

**Business Logic Fixes (3 files):**
62. `backend/controllers/prescriptionController.js` (line 507-566) - Release inventory on cancel
63. `backend/controllers/appointmentController.js` (line 236-268) - Trigger visit completion
64. `backend/models/Invoice.js` (line 374-399) - Add payment reversal record

---

### WEEK 2: REDUNDANCY ELIMINATION

#### Delete Old Visit Pages
65. `frontend/src/pages/PatientVisit.jsx` - **DELETE** (2,564 lines)
66. `frontend/src/pages/ophthalmology/RefractionExam.jsx` - **DELETE** (900 lines)

#### Complete NewConsultation
67. `frontend/src/pages/ophthalmology/NewConsultation.jsx` - Add error handling, workflow selector
68. `frontend/src/modules/clinical/workflows/ophthalmologyWorkflow.js` - Add 4 workflow configs

#### Update Navigation
69. `frontend/src/pages/Queue.jsx` - Change navigation to NewConsultation
70. `frontend/src/pages/ophthalmology/OphthalmologyDashboard.jsx` - Update links
71. `frontend/src/App.jsx` - Add route for NewConsultation

---

### WEEK 3: LABORATORY & PRESCRIPTION CONSOLIDATION

#### Laboratory Unification
72. `backend/routes/visits.js` - Remove lab-orders endpoints (line 63-343)
73. `backend/routes/laboratory.js` - Keep and enhance
74. `backend/controllers/laboratoryController.js` - Absorb visit lab logic
75. `frontend/src/pages/Laboratory.jsx` - Primary lab management
76. `frontend/src/pages/PatientVisit.jsx` - Simplify lab tab (or remove if deleted)

#### Prescription Consolidation
77. `backend/routes/prescriptions.js` - Add visitId requirement
78. `backend/routes/visits.js` - Remove prescription endpoint
79. `frontend/src/pages/Prescriptions.jsx` - Remove creation form, keep management
80. `frontend/src/pages/ophthalmology/components/PrescriptionStep.jsx` - Primary prescription creation

---

### WEEK 4: DISPENSING & PATIENT VIEWS

#### Dispensing Unification
81. `backend/routes/prescriptions.js` - Keep dispense endpoint
82. `backend/routes/pharmacy.js` - Remove dispense endpoint
83. `backend/controllers/pharmacyController.js` - Remove dispenseMedication function

#### Patient History Unification
84. `backend/routes/patients.js` - Create unified visit-history endpoint
85. `backend/routes/patients.js` - Remove old history/visits/timeline endpoints
86. `backend/routes/visits.js` - Remove patient/:patientId endpoint
87. `backend/controllers/patientController.js` - Consolidate functions
88. `frontend/src/pages/PatientDetail.jsx` - Merge PatientSummary functionality

---

### WEEK 5: APPOINTMENT & TEMPLATES

#### Appointment Booking
89. `frontend/src/pages/Appointments.jsx` - Use AppointmentBookingForm
90. `frontend/src/pages/PublicBooking.jsx` - Use AppointmentBookingForm
91. `frontend/src/pages/patient/PatientAppointments.jsx` - Use AppointmentBookingForm

#### Template Unification
92. `backend/routes/templates.js` - Unified endpoint with category
93. `backend/controllers/templateController.js` - Single controller for all templates

---

### WEEK 6-7: CONFIGURATION & ENCODING

#### Extract Hardcoded Values
- `backend/controllers/appointmentController.js` - Working hours to model
- `backend/controllers/billingController.js` - Fee schedule to model
- `backend/controllers/billingController.js` - Billing codes to model
- `backend/controllers/documentController.js` - Clinic info to Settings

#### French Encoding
- `frontend/src/utils/formatters.js` - Fix encoding, replace � with proper characters
- `frontend/src/utils/validationSchemas.js` - Fix encoding

#### ESLint & Routes
- `frontend/eslint.config.js` - Fix configuration
- `frontend/src/App.jsx` - Add missing routes

---

### WEEK 8: PERFORMANCE

#### Query Optimization
- `backend/controllers/pharmacyController.js` - Use aggregation pipeline for stats
- `backend/controllers/pharmacyController.js` - Optimize expiring items query
- Add indexes to models (Appointment, Prescription, Queue)

---

## ➕ FILES TO CREATE (8 files)

### Week 2-4: Shared Components
1. `frontend/src/components/appointments/AppointmentBookingForm.jsx` - Unified booking form
2. `frontend/src/components/prescriptions/MedicationSelectionForm.jsx` - Shared medication selector
3. `frontend/src/hooks/usePatientDetail.js` - Unified patient data hook

### Week 3-4: Backend Services
4. `backend/services/PharmacyDispenseService.js` - Shared dispensing logic
5. `backend/services/DrugInteractionService.js` - Extract drug interaction checks

### Week 6: Configuration Models
6. `backend/models/WorkingHours.js` - Provider working hours
7. `backend/models/FeeSchedule.js` - Fee schedule
8. `backend/models/BillingCode.js` - Billing codes

---

## 📊 CHANGE SUMMARY BY COMPONENT

### Frontend Components (45 changes)
- Pages: 30 files
- Components: 10 files
- Hooks: 3 files
- Services: 2 files

### Backend (27 changes)
- Controllers: 12 files
- Routes: 8 files
- Models: 7 files

### Configuration (3 changes)
- package.json: 1 file
- eslint.config.js: 1 file
- App.jsx: 1 file

---

## 🔍 SEARCH PATTERNS

### Finding Files to Fix

**Broken Toast:**
```bash
grep -r "useToast" frontend/src/pages/
grep -r "ToastContext" frontend/src/
```

**Wrong API:**
```bash
grep -r "from './api'" frontend/src/
grep -r "from '../services/api'" frontend/src/
```

**Stale Auth:**
```bash
grep -r "localStorage.getItem('user')" frontend/src/
```

**Race Conditions:**
```bash
grep -r "countDocuments" backend/controllers/
grep -r "count + 1" backend/
```

---

## ✅ VALIDATION CHECKLIST

After modifying files, verify:

**For Toast Fixes:**
- [ ] Import from 'react-toastify'
- [ ] No import from '../hooks/useToast'
- [ ] All showToast → toast
- [ ] No console errors

**For API Fixes:**
- [ ] Import from './apiConfig' or '../services/apiConfig'
- [ ] No import from './api'
- [ ] Token refresh works

**For Auth Fixes:**
- [ ] Import useAuth from AuthContext
- [ ] No localStorage.getItem('user')
- [ ] User updates immediately

**For Backend Fixes:**
- [ ] Use Counter model for IDs
- [ ] No countDocuments + 1
- [ ] Transaction used if multiple operations
- [ ] Error handling present

---

## 📝 COMMIT MESSAGE TEMPLATES

### For Batch Fixes
```
Fix broken toast in 5 critical pages

- Replace custom useToast with react-toastify
- Files: Queue, Patients, Appointments, Laboratory, Prescriptions
- Issue #1 from MASTER_EXECUTION_PLAN Week 1 Day 1
```

### For Individual Fixes
```
Fix race condition in appointmentId generation

- Replace countDocuments with atomic Counter model
- Prevents duplicate IDs under concurrent load
- Issue #4 from MASTER_EXECUTION_PLAN Week 1 Day 4
```

### For Deletions
```
Delete duplicate PatientSummary page

- 100% duplicate of PatientDetail
- All functionality preserved in PatientDetail
- Issue #61 from MASTER_EXECUTION_PLAN Week 2 Day 1
- Saves 400 lines
```

---

## 🎯 QUICK REFERENCE TABLE

| Week | Files Changed | Files Deleted | Files Created | Total Changes |
|------|---------------|---------------|---------------|---------------|
| 1 | 65 | 3 | 0 | 68 |
| 2 | 5 | 2 | 1 | 8 |
| 3 | 8 | 0 | 2 | 10 |
| 4 | 6 | 0 | 2 | 8 |
| 5 | 5 | 2 | 1 | 8 |
| 6-7 | 8 | 0 | 3 | 11 |
| 8 | 3 | 0 | 0 | 3 |
| **Total** | **93** | **7** | **8** | **108** |

---

**END OF FILE CHANGE MANIFEST**

Use this as your checklist to track which files you've changed.
Cross-reference with MASTER_EXECUTION_PLAN.md for detailed steps.
