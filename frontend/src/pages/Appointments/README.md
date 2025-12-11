# Appointments Module

This folder contains the refactored Appointments page, split into smaller, more manageable components.

## File Structure

```
Appointments/
├── index.jsx                  - Main orchestrator component
├── AppointmentFilters.jsx     - View mode toggles and filter controls
├── AppointmentList.jsx        - List/table view component
├── AppointmentCalendar.jsx    - Calendar views (week, month, agenda)
└── AppointmentModal.jsx       - Create/edit appointment modal wrapper
```

## Component Responsibilities

### index.jsx
Main orchestrator that manages:
- State management (appointments, patients, providers)
- Data fetching and WebSocket updates
- View mode switching (list/week/month/agenda)
- Modal states (booking, patient panel, shortcuts help)
- Keyboard shortcuts
- No-show detection and alerts
- Action handlers (confirm, cancel, check-in, etc.)

### AppointmentFilters.jsx
Filter controls that include:
- View mode toggle buttons (list, week, month, agenda)
- Search input for patient names
- Status filter dropdown
- Uses forwardRef for search input focus control

### AppointmentList.jsx
List view component that displays:
- Appointment cards with patient info
- Status badges
- Action buttons (check-in, start, cancel, confirm, reject)
- Patient info panel trigger
- Empty state when no appointments

### AppointmentCalendar.jsx
Calendar views component that includes:
- Week view (7-day grid)
- Month view (calendar grid)
- Agenda view (chronological list)
- Navigation controls (previous/next/today)
- Shared date selection logic

### AppointmentModal.jsx
Simple wrapper component that:
- Wraps the AppointmentBookingForm component
- Passes through props for booking appointments

## Props and Data Flow

All components use PropTypes for type checking and React.memo for performance optimization where appropriate.

Data flows from index.jsx → child components via props, with callback functions for user interactions.

## Backup

The original monolithic file has been preserved as:
`/Users/xtm888/magloire/frontend/src/pages/Appointments.jsx.backup`
