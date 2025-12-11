# Fee Schedule Management (Tarifs) - Design Document

**Date:** 2025-12-08
**Status:** Approved
**Author:** Claude Code

## Overview

Add a "Tarifs" tab to the Settings page allowing admins to manage all service prices with full CRUD operations.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Price editing mode | Both quick edit AND scheduled changes | Flexibility for corrections vs planned increases |
| Location | Settings > New "Tarifs" tab | Centralized admin config, matches existing patterns |
| UI Layout | Paginated table | Performant for 710+ items, familiar pattern |
| Edit interface | Modal dialog | Consistent with existing Settings modals |

## Architecture

### Existing Backend (No Changes Needed)

Endpoints already exist in `/api/billing/fee-schedule`:

```
GET    /api/billing/fee-schedule           → List all (with search/filter)
POST   /api/billing/fee-schedule           → Create new
PUT    /api/billing/fee-schedule/:id       → Update existing
DELETE /api/billing/fee-schedule/:id       → Soft delete (active=false)
```

Permissions: `requirePermission('manage_system')` with audit logging.

### Frontend Changes

#### 1. Update `feeScheduleService.js`

Add CRUD methods:
- `createFeeSchedule(data)` → POST /billing/fee-schedule
- `updateFeeSchedule(id, data)` → PUT /billing/fee-schedule/:id
- `deleteFeeSchedule(id)` → DELETE /billing/fee-schedule/:id
- `getAllFeeSchedules(params)` → GET /billing/fee-schedule (with pagination)

#### 2. Create `TarifManagement.jsx` Component

Location: `frontend/src/components/settings/TarifManagement.jsx`

Features:
- Paginated table (50 items per page)
- Search by name/code
- Filter by category dropdown
- "Ajouter" button → Create modal
- Row click → Edit modal
- Delete button → Confirmation → Soft delete

Table columns:
| Code | Nom | Catégorie | Prix | Devise | Statut | Actions |

Modal form fields:
- code (required, uppercase)
- name (required)
- category (dropdown - 11 options)
- displayCategory (text)
- department (text)
- price (required, number)
- currency (dropdown - CDF, USD)
- description (textarea)
- effectiveFrom (date picker - for scheduled changes)
- effectiveTo (date picker)
- taxable (checkbox)
- insuranceClaimable (checkbox)

#### 3. Update `Settings.jsx`

- Import TarifManagement component
- Add 'tarifs' tab to tabs array (after 'billing')
- Render TarifManagement when activeTab === 'tarifs'
- Access control: `canManageBilling` (admin or accountant)

## Data Flow

```
User clicks "Tarifs" tab
    ↓
TarifManagement loads → feeScheduleService.getAllFeeSchedules()
    ↓
User searches/filters → Re-fetch with params
    ↓
User clicks "Ajouter" → Modal opens
    ↓
User submits form → feeScheduleService.createFeeSchedule()
    ↓
Success → Reload list, show toast
```

## Access Control

- Tab visible only to: `admin`, `accountant` roles
- Backend enforces: `requirePermission('manage_system')`
- All writes logged via: `logCriticalOperation()`

## UI Patterns (Matching Existing)

Following ReferrerManagement.jsx patterns:
- useState for: items, loading, search, showForm, editingItem, saving
- useEffect to load on mount
- handleSubmit, handleEdit, handleDelete functions
- toast notifications for success/error
- ConfirmationModal for delete

## Implementation Tasks

1. [ ] Add CRUD methods to feeScheduleService.js
2. [ ] Create TarifManagement.jsx component
3. [ ] Add Tarifs tab to Settings.jsx
4. [ ] Test all CRUD operations
5. [ ] Verify permissions work correctly

## File Changes

| File | Change |
|------|--------|
| `frontend/src/services/feeScheduleService.js` | Add create/update/delete methods |
| `frontend/src/components/settings/TarifManagement.jsx` | New file |
| `frontend/src/pages/Settings.jsx` | Add import and tab |
