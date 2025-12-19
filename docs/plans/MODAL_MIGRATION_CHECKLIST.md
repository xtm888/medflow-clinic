# Modal Migration Checklist

> **For Claude:** Use this checklist when migrating modals to the shared modal system.

## Shared Modal System Location
`frontend/src/components/shared/Modal/`

## Available Shared Modal Types

| Type | Use Case | Key Props |
|------|----------|-----------|
| BaseModal | Foundation for custom modals | isOpen, onClose, title, size, children |
| ConfirmModal | Yes/no confirmation dialogs | onConfirm, confirmLabel, danger |
| FormModal | Form submission with dirty tracking | onSave, loading, dirty |
| WizardModal | Multi-step wizards | steps, currentStep, onNext, onBack |

## Migration Priority

### Priority 1: High-Traffic Modals (Migrate First)
These modals are used frequently and will have the most impact.

| File | Current Modal | Target Type | Status |
|------|---------------|-------------|--------|
| `pages/Queue/modals/CheckInModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Queue/modals/WalkInModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Appointments/AppointmentModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Invoicing/PaymentModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Patients/components/modals/PatientDetailsModal.jsx` | Custom | BaseModal | ⏳ Pending |

### Priority 2: Confirmation Dialogs
Simple confirm/cancel dialogs are easy wins.

| File | Current Modal | Target Type | Status |
|------|---------------|-------------|--------|
| `components/ConfirmationModal.jsx` | Custom | ConfirmModal | ⏳ Pending |
| `pages/Patients/components/modals/MergeDuplicatesModal.jsx` | Custom | ConfirmModal | ⏳ Pending |
| `components/PrescriptionWarningModal.jsx` | Custom | ConfirmModal | ⏳ Pending |

### Priority 3: Form Modals
Modals with form submission logic.

| File | Current Modal | Target Type | Status |
|------|---------------|-------------|--------|
| `pages/Companies/CompanyFormModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Companies/PaymentModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Approvals/ApprovalRequestModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Approvals/ApprovalDetailModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `components/optical/DepotRequestModal.jsx` | Custom | FormModal | ⏳ Pending |
| `components/AppointmentBookingForm.jsx` | Custom | FormModal | ⏳ Pending |

### Priority 4: Specialized Modals
Complex modals that may need custom handling.

| File | Current Modal | Target Type | Status |
|------|---------------|-------------|--------|
| `pages/Queue/modals/RoomModal.jsx` | Custom | FormModal | ⏳ Pending |
| `pages/Queue/modals/ShortcutsModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `pages/Patients/components/modals/KeyboardShortcutsModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `pages/ophthalmology/components/prescription/PrescriptionPreviewModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `pages/ophthalmology/components/alerts/EmergencyModal.jsx` | Custom | ConfirmModal | ⏳ Pending |
| `components/PriorAuthorizationModal.jsx` | Custom | FormModal | ⏳ Pending |
| `components/PrescriptionSafetyModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `components/PatientSelectorModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `components/DeviceImageViewer.jsx` | Custom | BaseModal | ⏳ Pending |
| `components/DeviceImageSelector.jsx` | Custom | FormModal | ⏳ Pending |
| `components/KeyboardShortcutsHelp.jsx` | Custom | BaseModal | ⏳ Pending |

### Priority 5: Sync/Offline Modals
System-related modals.

| File | Current Modal | Target Type | Status |
|------|---------------|-------------|--------|
| `components/PrepareOfflineModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `components/SyncProgressModal.jsx` | Custom | BaseModal | ⏳ Pending |
| `components/ConflictResolutionModal.jsx` | Custom | FormModal | ⏳ Pending |
| `components/AccessibleModal.jsx` | DEPRECATED | BaseModal | 🗑️ Delete |

### Already Using Shared System
These modals or their parents already use the shared modal system.

| File | Notes |
|------|-------|
| `pages/UnifiedInventory/StockOperationModal.jsx` | Uses shared patterns |
| `components/shared/Modal/*` | The shared system itself |

## Migration Instructions

### Step 1: Import Shared Modal
```jsx
import { BaseModal, FormModal, ConfirmModal, WizardModal } from '@/components/shared/Modal';
```

### Step 2: Replace Custom Implementation
```jsx
// Before
<div className={`fixed inset-0 ${isOpen ? '' : 'hidden'}`}>
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content">
      {children}
    </div>
  </div>
</div>

// After
<BaseModal isOpen={isOpen} onClose={onClose} title={title} size="lg">
  {children}
</BaseModal>
```

### Step 3: Use Specialized Variants
```jsx
// For confirmations
<ConfirmModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="Confirmer la suppression"
  message="Voulez-vous vraiment supprimer cet élément?"
  confirmLabel="Supprimer"
  danger
/>

// For forms
<FormModal
  isOpen={isEditing}
  onClose={handleClose}
  onSave={handleSave}
  title="Modifier le patient"
  loading={saving}
  dirty={isDirty}
>
  <form>{/* form fields */}</form>
</FormModal>
```

### Step 4: Verify Accessibility
- [ ] Focus trap works (Tab cycles within modal)
- [ ] Escape key closes modal
- [ ] Click outside closes modal (if not form with dirty state)
- [ ] Screen reader announces modal title
- [ ] Return focus to trigger element on close

## Progress Summary

| Priority | Total | Migrated | Remaining |
|----------|-------|----------|-----------|
| P1 (High Traffic) | 5 | 0 | 5 |
| P2 (Confirmations) | 3 | 0 | 3 |
| P3 (Forms) | 6 | 0 | 6 |
| P4 (Specialized) | 11 | 0 | 11 |
| P5 (Sync/Offline) | 4 | 0 | 4 |
| **Total** | **29** | **0** | **29** |

## Notes

- The shared modal system was created on Dec 18, 2025
- Modals should be migrated incrementally - keep old implementation working during transition
- Delete AccessibleModal.jsx as it's superseded by BaseModal's built-in accessibility
- Consider creating additional specialized variants if common patterns emerge during migration
