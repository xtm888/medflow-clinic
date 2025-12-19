/**
 * PatientEdit - Backward Compatibility Export
 *
 * This file re-exports from the modular PatientEdit structure.
 * The actual implementation is in ./PatientEdit/ directory.
 *
 * New structure:
 * ./PatientEdit/
 * ├── PatientEdit.jsx       - Main orchestrator (~200 lines)
 * ├── constants.js          - Form config, options, mappers
 * ├── hooks/
 * │   ├── usePatientForm.js      - Form state and handlers
 * │   ├── useMedicationSearch.js - Medication search
 * │   └── useCompanySearch.js    - Company search for convention
 * └── components/
 *     ├── PatientEditHeader.jsx  - Header with save button
 *     ├── SectionNavigation.jsx  - Sidebar nav
 *     └── sections/
 *         ├── PersonalInfoSection.jsx
 *         ├── ContactSection.jsx
 *         ├── EmergencyContactSection.jsx
 *         ├── MedicalInfoSection.jsx
 *         ├── MedicationsSection.jsx
 *         ├── ConventionSection.jsx
 *         └── PreferencesSection.jsx
 */

export { default } from './PatientEdit/PatientEdit';
