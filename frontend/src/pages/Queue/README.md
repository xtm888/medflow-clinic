# Queue Page Refactoring

This directory contains the refactored Queue page components, split from a single 2319-line file into smaller, maintainable components.

## Structure

```
Queue/
├── index.jsx              # Main orchestrator (~650 lines - still needs modal extraction)
├── QueueHeader.jsx        # Title, WebSocket indicator, action buttons
├── QueueStats.jsx         # Stats cards (waiting, in-progress, completed, avg time)
├── QueueList.jsx          # List container for waiting patients
├── QueueItem.jsx          # Individual queue item card (memoized)
├── QueueSidebar.jsx       # In-progress patients, alerts, rejected lab orders
├── utils.js               # Utility functions (priorities, sorting, wait time)
├── modals/                # Modal components (TO BE EXTRACTED)
│   ├── CheckInModal.jsx   # TODO: Extract check-in modal
│   ├── WalkInModal.jsx    # TODO: Extract walk-in patient modal
│   ├── RoomModal.jsx      # TODO: Extract room selection modal
│   └── ShortcutsModal.jsx # TODO: Extract keyboard shortcuts modal
└── README.md              # This file
```

## Completed Components

### QueueHeader.jsx
- WebSocket connection indicator
- Action buttons (Call Next, Check In, Walk-In)
- Navigation to analytics and display board
- Keyboard shortcuts button
- **Props**: wsConnected, onCallNext, onOpenCheckIn, onOpenWalkIn, onShowShortcuts, loading, waitingCount
- **Memoized**: Yes

### QueueStats.jsx
- Four stat cards: waiting, in-progress, completed today, average wait time
- Gradient backgrounds with icons
- **Props**: stats (object with totalWaiting, inProgress, completedToday, averageWaitTime)
- **Memoized**: Yes

### QueueItem.jsx
- Individual patient card in queue
- Priority indicator, patient photo, wait time
- Action buttons (View Info, Start Visit, Generate Document, Call Patient)
- Long wait alert (>30 min)
- **Props**: patient, waitTime, onViewInfo, onStartVisit, onGenerateDocument, onCallPatient, loading
- **Memoized**: Yes (important for performance)

### QueueList.jsx
- Container for waiting patients list
- Sort dropdown (priority, arrival time, wait time)
- Empty state handling
- Maps over patients and renders QueueItem components
- **Props**: patients, sortBy, onSortChange, calculateWaitTime, handlers, loading
- **Memoized**: Yes

### QueueSidebar.jsx
- In-progress consultations
- Alert cards (long wait, high priority)
- Rejected lab orders section (for reception)
- **Props**: inProgressPatients, alertCounts, rejectedLabOrders, handlers, loading
- **Memoized**: Yes

### utils.js
- Priority colors and labels
- Wait time colors and bar colors
- Patient sorting logic
- Wait time calculation

## Still TODO

### 1. Extract Modals (High Priority)
The index.jsx is still ~650 lines because the modals are not yet extracted. These need to be moved to separate files:

#### CheckInModal.jsx
- Appointment selection with search
- Room selection
- Priority selection with visual buttons
- Age-based priority suggestions
- Form validation

#### WalkInModal.jsx
- Patient search/selector
- New patient form
- Priority selection
- Reason for visit

#### RoomSelectionModal.jsx
- Patient info display
- Room dropdown/selection
- Audio announcement toggle
- Handles room assignment and patient call

#### RescheduleLabModal.jsx
- Rejected lab order details
- Date picker for rescheduling
- Notes field
- Penalty amount display

#### ShortcutsModal.jsx
- Keyboard shortcuts help
- Organized by category (Queue Actions, Quick Call, Interface)

### 2. Further Optimization
- Consider virtualizing the patient list for very long queues (react-window or react-virtual)
- Extract repeated priority button components into reusable PrioritySelector
- Consider extracting the patient info panel sidebar logic
- Add unit tests for each component
- Add Storybook stories for visual testing

### 3. PropTypes
All components currently use PropTypes. Consider migrating to TypeScript for better type safety in the future.

## Usage

```jsx
import Queue from './pages/Queue';

// The component is fully self-contained and manages its own state
<Queue />
```

## Performance Considerations

- All list components use `React.memo()` to prevent unnecessary re-renders
- Patient sorting is memoized with `useMemo()`
- Wait time calculation updates only every 30 seconds
- WebSocket updates trigger targeted state changes, not full page refreshes

## Migration Notes

The original file has been backed up to `Queue.jsx.backup`. Once the modal extraction is complete and testing is done, the backup can be removed.

### Breaking Changes
None - the refactored components maintain the same functionality and API.

### Dependencies
- react
- react-redux
- react-router-dom
- react-toastify
- lucide-react
- prop-types

## Next Steps

1. Extract modal components to `modals/` subdirectory
2. Update index.jsx to use extracted modal components
3. Test all functionality (check-in, walk-in, call patient, complete, etc.)
4. Add unit tests for each component
5. Remove backup file once confirmed working
6. Consider further optimizations if needed
