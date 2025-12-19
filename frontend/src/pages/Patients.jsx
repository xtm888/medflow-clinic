/**
 * Patients - Backward Compatibility Export
 *
 * This file re-exports from the modular Patients structure.
 * The actual implementation is in ./Patients/ directory.
 *
 * New structure:
 * ./Patients/
 * ├── Patients.jsx          - Main orchestrator (~200 lines)
 * ├── constants.js          - Configuration and helper functions
 * ├── hooks/
 * │   ├── usePatientsData.js    - Data fetching, filtering, pagination
 * │   └── usePatientSelection.js - Batch selection operations
 * └── components/
 *     ├── PatientsHeader.jsx     - Header with actions
 *     ├── SearchFilters.jsx      - Search and filter controls
 *     ├── PatientTable.jsx       - Patient list table
 *     ├── BatchActionsToolbar.jsx - Floating batch actions
 *     └── modals/
 *         ├── PatientDetailsModal.jsx
 *         ├── MergeDuplicatesModal.jsx
 *         └── KeyboardShortcutsModal.jsx
 */

export { default } from './Patients/Patients';
