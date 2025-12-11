# Patient Registration Wizard Refactoring

## Summary

Successfully split the large `PatientRegistrationWizard.jsx` (1687 lines) into smaller, focused components.

## New Structure

```
frontend/src/components/PatientRegistration/
├── index.jsx                  (main orchestrator, 673 lines)
├── BiometricStep.jsx         (photo capture, 194 lines)
├── PersonalInfoStep.jsx      (name, DOB, gender, 180 lines)
├── ContactInfoStep.jsx       (phone, email, address, 98 lines)
├── InsuranceStep.jsx         (company/convention, 265 lines)
└── MedicalHistoryStep.jsx    (allergies, medications, referrer, 422 lines)
```

## Component Breakdown

### 1. `index.jsx` - Main Orchestrator
- **Responsibilities:**
  - Wizard state management (current step, form data)
  - Step navigation and validation logic
  - API calls (duplicate check, company search, medication search)
  - Form submission
  - Event handlers coordination

- **Key Features:**
  - 5-step wizard configuration
  - Validation for each step
  - Async duplicate checking
  - Company and medication search with debouncing
  - Biometric data handling

### 2. `BiometricStep.jsx` - Photo Capture
- **Responsibilities:**
  - Webcam photo capture
  - Facial duplicate checking UI
  - Biometric consent handling
  - Admin override for duplicates

- **Props:**
  - formData, errors
  - showCamera, showDuplicateCheck
  - duplicateCheckStatus, duplicateCheckResults
  - isAdmin
  - Event handlers (onPhotoCapture, onNoDuplicates, etc.)

- **React.memo:** Yes - only re-renders when props change

### 3. `PersonalInfoStep.jsx` - Personal Information
- **Responsibilities:**
  - Name input (first name, last name)
  - Date of birth selection
  - Gender selection
  - Photo status indicator

- **Props:**
  - formData, errors
  - duplicateCheckStatus
  - onChange handler

- **React.memo:** Yes

### 4. `ContactInfoStep.jsx` - Contact Information
- **Responsibilities:**
  - Phone number input (required)
  - Email input (optional)
  - Address, city, country

- **Props:**
  - formData, errors
  - onChange handler

- **React.memo:** Yes

### 5. `InsuranceStep.jsx` - Convention/Company
- **Responsibilities:**
  - Company search and selection
  - Employee details (ID, job title, department)
  - Beneficiary type selection
  - Convention toggle

- **Props:**
  - formData, errors
  - Company search state (companySearch, companyResults, etc.)
  - selectedCompany
  - Event handlers (onSelectCompany, onClearCompany, etc.)

- **React.memo:** Yes

### 6. `MedicalHistoryStep.jsx` - Medical Information
- **Responsibilities:**
  - Blood type selection
  - Insurance (if no convention)
  - Allergies input
  - Current medications with search
  - Referrer selection
  - VIP status and priority settings

- **Props:**
  - formData, errors
  - Medication search state
  - Referrers list
  - Event handlers

- **React.memo:** Yes

## Benefits

### Code Organization
- **Separation of concerns:** Each step component handles its own UI
- **Single responsibility:** Orchestrator manages state, steps manage presentation
- **Easier testing:** Can test each step component independently

### Performance
- **React.memo optimization:** Steps only re-render when their specific data changes
- **Reduced bundle size:** Better code splitting potential
- **Cleaner diffs:** Changes to one step don't affect others

### Maintainability
- **Smaller files:** Easier to read and understand (98-673 lines vs 1687)
- **Focused components:** Each file has a clear, single purpose
- **Easier debugging:** Isolate issues to specific steps
- **Better collaboration:** Multiple developers can work on different steps

### Developer Experience
- **Better IDE performance:** Smaller files load faster
- **Easier navigation:** Jump to specific step file
- **Clear structure:** Folder organization mirrors wizard flow
- **Type safety:** Props clearly define component interfaces

## Migration

### Original File
- Backed up to: `PatientRegistrationWizard.jsx.backup`
- Original size: 70,983 bytes (1687 lines)

### Import Update
```javascript
// Before
import PatientRegistrationWizard from '../components/PatientRegistrationWizard';

// After
import PatientRegistrationWizard from '../components/PatientRegistration';
```

### Files Updated
- `frontend/src/pages/Patients.jsx` - Updated import path

## Testing Checklist

- [ ] Photo capture works
- [ ] Duplicate check functions correctly
- [ ] All form validations work
- [ ] Step navigation (next/back) works
- [ ] Company search works
- [ ] Medication search works
- [ ] Form submission succeeds
- [ ] Admin override for duplicates works
- [ ] Biometric consent is recorded
- [ ] Convention data is saved correctly

## Future Enhancements

1. **WizardNavigation Component:** Extract navigation buttons to separate component
2. **Form Hooks:** Create custom hooks for form state management
3. **Validation Library:** Consider using Yup or Zod for schema validation
4. **Step Configuration:** Move step definitions to separate config file
5. **Error Boundary:** Add error boundaries around each step component

## Notes

- All step components use React.memo() for performance optimization
- Props are passed explicitly (no prop drilling beyond one level)
- Event handlers are defined in the orchestrator for consistent state management
- Validation logic remains in the orchestrator for centralized control
