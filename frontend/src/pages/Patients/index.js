/**
 * Patients Module Index
 *
 * This module provides the complete patient management interface.
 *
 * Structure:
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

export { default } from './Patients';
