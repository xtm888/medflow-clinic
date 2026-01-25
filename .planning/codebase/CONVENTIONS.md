# Coding Conventions

**Analysis Date:** 2026-01-25

## Naming Patterns

### Backend (Node.js)

**Files:**
- Controllers: camelCase + `Controller` suffix (e.g., `authController.js`, `invoiceController.js`)
- Services: camelCase + `Service` suffix (e.g., `BillingService.js`, `sessionService.js`)
- Models: PascalCase (e.g., `Patient.js`, `Invoice.js`)
- Utilities: camelCase (e.g., `apiResponse.js`, `tokenUtils.js`, `phiEncryption.js`)
- Middleware: camelCase (e.g., `auth.js`, `auditLogger.js`)
- Routes: camelCase (e.g., `auth.js`, `patients.js`)

**Functions/Variables:**
- camelCase for functions and variables (e.g., `processPayment()`, `invoiceId`, `isActive`)
- Underscore prefix for private/internal functions: `_internalHelper()`
- Callback parameters can use underscore to ignore: `(req, res, _next) => {}`

**Classes:**
- PascalCase for Model classes (e.g., `Patient`, `Invoice`)
- PascalCase for Service classes (e.g., `BillingService`, `CareVisionBridge`)

**Constants:**
- UPPER_SNAKE_CASE for constants (e.g., `MAX_LOGIN_ATTEMPTS`, `PHI_ENCRYPTION_KEY`)
- Example: `const AUTH = { TOKEN_EXPIRY: 900 }` defined in `backend/config/constants.js`

**Database Collections:**
- camelCase (e.g., `patients`, `invoices`, `appointments`)

**Database Fields:**
- camelCase (e.g., `dateOfBirth`, `clinicId`, `amountDue`, `isActive`)
- Timestamps: `createdAt`, `updatedAt` (Mongoose auto-generated)
- Soft deletes: `isDeleted`, `deletedAt`, `deletedBy`
- Laterality (eyes): `od` (oculus dexter), `os` (oculus sinister)

### Frontend (React)

**Files:**
- Components: PascalCase + `.jsx` (e.g., `StudioVisionConsultation.jsx`, `PatientList.jsx`)
- Hooks: camelCase + `use` prefix + `.js` (e.g., `useWebSocket.js`, `usePatientAlerts.js`)
- Services: camelCase + `.js` (e.g., `authService.js`, `patientService.js`)
- Utilities: camelCase + `.js` (e.g., `dateHelpers.js`, `validationHelpers.js`)
- Redux slices: camelCase + `Slice` + `.js` (e.g., `authSlice.js`, `clinicSlice.js`)
- Test files: match source name + `.test.jsx` or `.spec.js`

**Functions/Variables:**
- camelCase for functions and variables (e.g., `handleClick()`, `isLoading`, `patientData`)
- useCallback dependencies: list all dependencies explicitly

**React Hooks:**
- Always use `const [state, setState] = useState()` pattern
- Always destructure props explicitly
- Use camelCase for custom hook names: `useStudioVisionConsultation`

**Constants:**
- UPPER_SNAKE_CASE for constants (e.g., `MONOYER_SCALES`, `PARINAUD_SCALES`)
- Example: `const VISUAL_ACUITY_SCALES = { ... }` in page/component files

**Redux Store:**
- Slice names: camelCase (e.g., `auth`, `clinic`, `patients`)
- Action names: descriptive camelCase (e.g., `setCurrentUser`, `updatePatientData`)

## Code Style

### Formatting

**Tool:** Prettier 3.2.5
- Config: `backend/.prettierrc`

**Settings:**
- Semicolons: always required (`semi: true`)
- Quotes: single quotes preferred (e.g., `'use strict'`)
- Print width: 100 characters (lines > 100 chars wrap)
- Tab width: 2 spaces
- Trailing commas: none in arrays/objects
- Arrow parentheses: avoid when possible (e.g., `x => x * 2` not `(x) => x * 2`)
- Bracket spacing: enabled (e.g., `{ name: 'test' }` not `{name: 'test'}`)

**Example:**
```javascript
// Correct
const result = users.map(user => ({
  id: user._id,
  name: user.firstName,
  email: user.email
}));

// Incorrect
const result = users.map((user) => {
  return {
    id: user._id,
    name: user.firstName,
    email: user.email,  // trailing comma not allowed
  };
});
```

### Linting

**Tool:** ESLint 8.57.0 (Backend), ESLint 9.36.0 (Frontend)
- Config: `backend/.eslintrc.js`

**Key Rules:**

**Error Level (Fail tests):**
- `eqeqeq: 'error'` - Always use `===`, never `==`
- `no-var: 'error'` - Use `const`/`let`, never `var`
- `prefer-const: 'error'` - Use `const` for variables that don't change
- `no-console: ['warn', { allow: ['warn', 'error'] }]` - Only `console.warn()` and `console.error()` allowed
- `no-eval: 'error'` - No eval() functions
- `no-throw-literal: 'error'` - Throw only Error objects, not strings
- `indent: ['error', 2, { SwitchCase: 1 }]` - 2-space indentation, switch cases indented once
- `quotes: ['error', 'single']` - Single quotes required
- `semi: ['error', 'always']` - Semicolons always required
- `no-trailing-spaces: 'error'` - No trailing whitespace
- `eol-last: ['error', 'always']` - Single newline at end of file

**Warning Level:**
- `no-console: warn` - Warns on all console calls
- `require-await: warn` - Warns on async functions without await
- `prefer-arrow-callback: warn` - Prefer arrow functions in callbacks

**Ignored for Tests:**
- Override rules in `*.test.js` files to allow unused variables

## Import Organization

**Order (Backend):**
1. Node.js built-in modules (`fs`, `path`, `crypto`)
2. Third-party packages (`mongoose`, `express`, `jwt`)
3. Local models and services (`../models/`, `../services/`)
4. Local utilities and middleware (`../utils/`, `../middleware/`)
5. Config and constants (`../config/`, `../constants/`)

**Example:**
```javascript
// Built-in
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Third-party
const express = require('express');
const mongoose = require('mongoose');

// Local models
const User = require('../models/User');
const Invoice = require('../models/Invoice');

// Local services
const BillingService = require('../services/domain/BillingService');
const websocketService = require('../services/websocketService');

// Local utilities
const { success, error } = require('../utils/apiResponse');
const { createContextLogger } = require('../utils/structuredLogger');

// Config
const { AUTH } = require('../config/constants');
```

**Order (Frontend):**
1. React and hooks (`import React`, `useState`, `useEffect`)
2. React Router (`useNavigate`, `useParams`)
3. Third-party libraries (`axios`, `react-toastify`)
4. Redux/State management
5. Local components and modules
6. Local hooks and services
7. Utilities and helpers
8. Styles

**Example:**
```javascript
// React
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Third-party
import axios from 'axios';
import { toast } from 'react-toastify';

// Redux
import { useDispatch, useSelector } from 'react-redux';

// Components and modules
import StudioVisionHeader from './StudioVisionHeader';
import { useStudioVisionConsultation } from './hooks/useStudioVisionConsultation';

// Services and hooks
import ophthalmologyService from '../../services/ophthalmologyService';
import { useWebSocket } from '../../hooks/useWebSocket';

// Utils
import logger from '../../services/logger';
import { formatDate } from '../../utils/dateHelpers';

// Styles
import styles from './StudioVision.module.css';
```

**Path Aliases (Frontend):**
- `@` → `src/`
- `@components` → `src/components/`
- `@pages` → `src/pages/`
- `@services` → `src/services/`
- `@hooks` → `src/hooks/`
- `@utils` → `src/utils/`

## Error Handling

**Backend Pattern - Structured Responses:**

All API endpoints use the standardized response format from `utils/apiResponse.js`:

```javascript
// Success response
const { success, error, badRequest, unauthorized, forbidden, notFound } = require('../utils/apiResponse');

// Return success
return success(res, {
  statusCode: 200,
  message: 'Opération réussie',
  data: results,
  pagination: { page, limit, total, pages }
});

// Return error
return badRequest(res, 'Données invalides', { field: 'email' });
return unauthorized(res, 'Non autorisé');
return forbidden(res, 'Accès interdit');
return notFound(res, 'Patient');
```

**Response Format:**
```javascript
{
  success: true,
  message: "...",
  data: { ... },
  pagination: { page, limit, total, pages },
  meta: { timestamp: "2026-01-25T..." }
}

// Or on error:
{
  success: false,
  error: "...",
  code: "BAD_REQUEST",
  details: { ... },
  meta: { timestamp: "..." }
}
```

**Try-Catch in Controllers:**
```javascript
exports.processPayment = async (req, res) => {
  try {
    const { amount, method } = req.body;

    // Validate
    if (!amount || amount <= 0) {
      return badRequest(res, 'Montant invalide');
    }

    // Process
    const result = await BillingService.processPayment(invoiceId, { amount, method }, req.user._id);

    // Return
    return success(res, { data: result, message: 'Paiement enregistré' });
  } catch (err) {
    // Let global error handler catch
    throw err;
  }
};
```

**Global Error Handler:**
- Errors not caught by try-catch bubble to global error middleware
- Global middleware logs and returns 500 response
- Do NOT catch and silence errors at route level unless intentional

**Frontend Error Handling:**

Use toast notifications from `react-toastify`:
```javascript
import { toast } from 'react-toastify';

try {
  const response = await patientService.createPatient(data);
  toast.success('Patient créé avec succès');
  navigate('/patients');
} catch (error) {
  const message = error.response?.data?.error || 'Erreur lors de la création';
  toast.error(message);
  logger.error('Patient creation failed', { error });
}
```

**Error Logging:**
- Backend: Use `structuredLogger` with context (e.g., `log.error('Payment failed', { invoiceId, error })`)
- Frontend: Use logger service (e.g., `logger.error('consultation save failed', { data: JSON.stringify(error) })`)

## Logging

**Backend - Structured Logger:**

```javascript
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('PaymentService');

// Log levels
log.info('Payment processed', { invoiceId: '123', amount: 50000 });
log.warn('Suspicious transaction', { userId: '456', amount: 1000000 });
log.error('Payment failed', { invoiceId: '123', error: err.message });
log.debug('Processing step completed', { step: 'validation' });
```

**Output Format:**
```
2026-01-25 14:30:45 INFO [PaymentService] Payment processed {"invoiceId":"123","amount":50000}
2026-01-25 14:30:46 ERROR [Auth] Login failed {"userId":"456","reason":"incorrect password"}
```

**Allowed Console Methods:**
- `console.error()` - Critical errors
- `console.warn()` - Warnings

**NOT allowed in production code:**
- `console.log()` - Use logger instead
- `console.info()` - Use logger instead
- `console.debug()` - Use logger instead

Note: Frontend build strips `console.log/info/debug/warn` in production via Vite esbuild config.

**Pre-defined Context Loggers (Backend):**
- `auth`: Authentication operations
- `invoice`: Billing operations
- `patient`: Patient data operations
- `devices`: Device sync operations
- `queue`: Queue management

## Comments

**When to Comment:**

1. **Complex algorithms** - Explain the "why", not the "what"
   ```javascript
   // Calculate CDF conversion considering rate volatility
   // Rate is adjusted for inflation over past 3 months
   const adjustedRate = baseRate * (1 + volatilityFactor);
   ```

2. **Non-obvious business logic** - Reference domain rules
   ```javascript
   // Per convention: patient must pay 30% before surgery approval
   const minimumRequired = invoice.total * 0.3;
   ```

3. **Workarounds and hacks** - Explain why temporary solution exists
   ```javascript
   // TODO: Replace with native MongoDB transaction once all clinics on MongoDB 4.4+
   // Some legacy systems still use version 4.0
   await withTransaction(async (session) => { ... });
   ```

4. **Gotchas and non-obvious behavior** - Warn future developers
   ```javascript
   // CRITICAL: Do not reorder these steps - payment must be recorded
   // BEFORE creating surgery cases. Order is enforced by tests.
   ```

**JSDoc/TSDoc (Required for Public APIs):**

```javascript
/**
 * Process payment on an invoice and create related surgery cases
 *
 * @param {string} invoiceId - MongoDB invoice ID
 * @param {Object} paymentData - Payment details
 * @param {number} paymentData.amount - Payment amount in primary currency
 * @param {string} paymentData.method - Payment method (cash, card, check, etc)
 * @param {string} paymentData.reference - Optional receipt/check number
 * @param {string} userId - User ID making the payment
 * @returns {Promise<Object>} { invoice, payment, surgeryCases }
 * @throws {Error} If invoice not found or payment exceeds amount due
 *
 * @example
 * const result = await BillingService.processPayment(
 *   invoiceId,
 *   { amount: 50000, method: 'cash', reference: 'RCP-001' },
 *   userId
 * );
 */
async processPayment(invoiceId, paymentData, userId) {
  // implementation
}
```

**Frontend Component Props Documentation:**

```javascript
/**
 * StudioVisionConsultation - Main clinical consultation interface
 *
 * Features:
 * - Tab-based layout: Résumé | Réfraction | Pathologies | etc
 * - Color-coded sections (pink=refraction, green=IOP, etc)
 * - Device data auto-sync
 * - Auto-save to backend
 */
export default function StudioVisionConsultation() {
  // ...
}
```

## Function Design

**Size:** Keep functions focused
- Controllers: 20-50 lines (request validation + response)
- Services: 30-100 lines (business logic)
- Utilities: 10-30 lines (single responsibility)

**Parameters:**
- Use object destructuring for multiple params (> 2)
  ```javascript
  // Good
  async function processPayment({ invoiceId, amount, method }, userId) { }

  // Bad
  async function processPayment(invoiceId, amount, method, userId, notes, reference) { }
  ```

**Return Values:**
- Always return consistent types for same function
- Use objects for multiple return values
  ```javascript
  // Good
  return { invoice, payment, surgeryCases };

  // Bad
  return [invoice, payment, surgeryCases]; // Array makes meaning unclear
  ```

**Async/Await:**
- Always prefer `async/await` over `.then()` chains
- Always `await` promises that matter for control flow
- Never swallow errors - let them bubble or handle explicitly

```javascript
// Good
const user = await User.findById(id);
if (!user) return notFound(res, 'User');

// Bad
const user = await User.findById(id);
// Missing null check
```

## Module Design

**Exports Pattern:**

**Backend (Models):**
```javascript
// models/Patient.js
const patientSchema = new mongoose.Schema({ ... });

// Add instance methods
patientSchema.methods.getAge = function() { ... };

// Add static methods
patientSchema.statics.findByPatientId = function(patientId) { ... };

module.exports = mongoose.model('Patient', patientSchema);
```

**Backend (Services):**
```javascript
// services/domain/BillingService.js
class BillingService {
  async processPayment(invoiceId, paymentData, userId) { ... }
  async refundPayment(paymentId, reason) { ... }
  static validatePaymentAmount(amount, invoiceDue) { ... }
}

module.exports = BillingService;
```

**Backend (Utils):**
```javascript
// utils/apiResponse.js
const success = (res, options = {}) => { ... };
const error = (res, options = {}) => { ... };

module.exports = {
  success,
  error,
  badRequest,
  unauthorized,
  // ... other helpers
};
```

**Frontend (Components):**
```javascript
// Components export as default
export default function PatientList() { ... }

// Subcomponents as named exports
export function PatientRow({ patient }) { ... }
export function PatientFilter({ onFilter }) { ... }
```

**Frontend (Hooks):**
```javascript
// src/hooks/useStudioVisionConsultation.js
export function useStudioVisionConsultation() {
  // ... hook logic
  return {
    // public API
    patient,
    loading,
    data,
    updateSection,
    handleSave
  };
}
```

**Frontend (Services):**
```javascript
// src/services/patientService.js
const patientService = {
  async getPatient(id) { ... },
  async createPatient(data) { ... },
  async updatePatient(id, data) { ... },
  async deletePatient(id) { ... }
};

export default patientService;
```

**Barrel Files (index.js):**
- Use for exporting related components/utilities
- Do NOT use barrel files that re-export everything (creates circular deps)

Example:
```javascript
// components/ophthalmology/index.js
export { default as RefractionPanel } from './RefractionPanel.jsx';
export { default as IOPPanel } from './IOPPanel.jsx';
export { EyeSchemaModal } from './EyeSchemaModal.jsx';
```

## Code Patterns

**Clinic Context (Multi-clinic isolation):**
```javascript
// Backend: Always scope queries to user's clinic
const clinicId = req.user.currentClinicId;
const query = { clinic: clinicId, ...otherFilters };

// Frontend: Use Redux clinic context
const currentClinic = useSelector(state => state.clinic.current);
const data = useSelector(state => state.clinic.patients[currentClinic._id]);
```

**Transactions (Multi-document updates):**
```javascript
// Use withTransaction utility for atomicity
const { withTransaction } = require('../utils/migrationTransaction');

await withTransaction(async (session) => {
  await Invoice.updateOne({ _id: invoiceId }, { status: 'paid' }, { session });
  await SurgeryCase.create([...cases], { session });
});
```

**Pagination:**
```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const skip = (page - 1) * limit;

const [items, total] = await Promise.all([
  Model.find(query).skip(skip).limit(limit).lean(),
  Model.countDocuments(query)
]);

return paginated(res, items, { page, limit, total });
```

**Validation:**
```javascript
// Backend: Use express-validator middleware
const { body, validationResult } = require('express-validator');

router.post('/payments', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Montant invalide'),
  body('method').isIn(['cash', 'card', 'check']).withMessage('Méthode invalide')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }
  // process
});
```

**Frontend Validation:**
```javascript
// Use Yup for form validation
import * as Yup from 'yup';

const paymentSchema = Yup.object({
  amount: Yup.number().min(0.01, 'Montant requis').required(),
  method: Yup.string().oneOf(['cash', 'card', 'check']).required()
});

// In component
const [errors, setErrors] = useState({});
const handleSubmit = async (data) => {
  try {
    await paymentSchema.validate(data);
    // submit
  } catch (error) {
    setErrors({ [error.path]: error.message });
  }
};
```

## Inconsistencies and Anti-Patterns to Avoid

**DO NOT:**
- Use `var` - always `const` or `let`
- Use `==` or `!=` - always `===` and `!==`
- Log sensitive data (PHI, passwords, payment details)
- Hardcode clinic IDs or user IDs
- Skip validation "for speed"
- Return plain Error messages without context
- Use `console.log()` in production code - use logger
- Create deeply nested ternaries
- Export default objects with many properties (prefer named exports)
- Use prop-types in components (use TypeScript JSDoc if needed)

**DO:**
- Break long functions into smaller, testable units
- Add JSDoc for public APIs
- Always validate and sanitize user input
- Always check clinic context before data access
- Use meaningful variable names
- Use descriptive commit messages
- Implement error boundaries in React components
- Use React Query for server state, Redux for app state
- Always await async operations that affect control flow
- Test error cases, not just happy paths

---

*Convention analysis: 2026-01-25*
