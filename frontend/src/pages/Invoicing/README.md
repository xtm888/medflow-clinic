# Invoicing Module

This module has been refactored from a monolithic 1739-line file into smaller, maintainable components.

## Structure

```
Invoicing/
├── index.jsx              - Main orchestrator (manages state & business logic)
├── InvoiceHeader.jsx      - Page header with title and action buttons
├── InvoiceFilters.jsx     - Category cards, search bar, and status filter
├── InvoiceList.jsx        - Invoice list with expand/collapse functionality
├── InvoiceDetail.jsx      - Modal for viewing invoice details
├── PaymentModal.jsx       - Modal for recording payments
└── README.md              - This file
```

## Component Responsibilities

### index.jsx (Main Orchestrator)
- Manages all shared state
- Fetches data from API
- Contains business logic and handlers
- Composes all child components
- Handles category configuration and permissions

### InvoiceHeader.jsx
- Displays page title and active category
- Refresh button
- Create new invoice button (when user has permission)
- **Props**: filterCategory, categoryConfig, canCreateInvoice, onRefresh, onCreateNew

### InvoiceFilters.jsx
- Category summary cards with statistics
- Search input for filtering by invoice number or patient name
- Status dropdown filter
- **Props**: categoryStats, invoiceCategories, allowedCategories, filterCategory, filterStatus, searchTerm, and event handlers

### InvoiceList.jsx
- Displays list of invoices
- Expandable/collapsible invoice details
- Action buttons (View, Pay, Print, Cancel)
- Category-grouped items display
- Payment history
- Convention billing information
- **Props**: invoices, patients, invoiceCategories, filterCategory, permissions, helper functions, and event handlers

### InvoiceDetail.jsx
- Modal view for invoice details
- Grouped items by category
- Clinic information header
- Invoice totals and payment status
- Print and payment action buttons
- **Props**: invoice, clinic info, invoiceCategories, groupItemsByCategory, and event handlers

### PaymentModal.jsx
- Modal for recording payments
- Multi-currency support (CDF, USD, EUR)
- Exchange rate calculation
- Payment method selection
- Reference and notes fields
- **Props**: invoice, isProcessing, onClose, onProcessPayment

## Key Features

### Category System
The module supports 6 invoice categories:
- **Services** (consultations, procedures, examinations)
- **Surgery** (surgical procedures)
- **Medication** (pharmacy items)
- **Optical** (glasses, lenses)
- **Laboratory** (lab tests)
- **Imaging** (OCT, retinography, etc.)

### Role-Based Access
Different user roles see different categories:
- **Admin/Accountant/Receptionist**: All categories
- **Pharmacist**: Medication only
- **Optician**: Optical only
- **Lab Tech**: Laboratory only
- **Doctor**: All categories
- **Nurse**: Services and Medication

### Smart Category Detection
The system can detect invoice categories from item names and descriptions, ensuring correct categorization even for legacy data.

## Benefits of Refactoring

1. **Maintainability**: Each component has a single, clear responsibility
2. **Reusability**: Components can be reused or tested independently
3. **Performance**: Using React.memo() prevents unnecessary re-renders
4. **Type Safety**: PropTypes provide runtime type checking
5. **Readability**: Easier to understand and navigate the codebase
6. **Team Development**: Multiple developers can work on different components

## Usage

```jsx
import Invoicing from './pages/Invoicing';

// In your router
<Route path="/invoicing" element={<Invoicing />} />
```

## Backup

The original monolithic file has been backed up to:
`/Users/xtm888/magloire/frontend/src/pages/Invoicing.jsx.backup`

## Future Enhancements

- Add RefundModal.jsx component (currently handled inline)
- Add CreateInvoiceModal.jsx component (currently placeholder)
- Add unit tests for each component
- Add Storybook stories for component documentation
- Implement full print functionality in InvoiceList
