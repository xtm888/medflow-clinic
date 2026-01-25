# Testing Patterns

**Analysis Date:** 2026-01-25

## Test Framework

### Backend

**Runner:**
- Jest 29.6.4
- Config: `backend/jest.config.js`
- Environment: Node.js (test environment)
- Workers: Sequential (maxWorkers: 1) to avoid port conflicts

**Assertion Library:**
- Jest built-in assertions (expect API)

**Run Commands:**
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode (re-run on file changes)
npm run test:coverage      # Generate coverage report
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # E2E tests (if configured)
```

**Coverage Configuration:**
- Target: 60% global (branches, functions, lines, statements)
- Collected from: `controllers/**/*.js`, `services/**/*.js`, `utils/**/*.js`, `middleware/**/*.js`
- Coverage report: `backend/coverage/`
- Timeout: 60 seconds per test (for slow DB operations)

### Frontend

**Runner:**
- Vitest 4.0.15 (Vite-native test runner)
- Config: `frontend/vitest.config.js`
- Environment: happy-dom (Node.js DOM simulation)

**Assertion Library:**
- Vitest built-in assertions
- `@testing-library/react` for DOM queries and interactions

**E2E Framework:**
- Playwright 1.57.0 for end-to-end browser tests
- Config: `playwright.config.ts` (if present)

**Run Commands:**
```bash
npm test                    # Run all unit tests (watch mode)
npm run test:run           # Run tests once
npm run test:ui            # Open Vitest UI dashboard
npm run test:coverage      # Generate coverage report
npm run test:e2e           # Run Playwright E2E tests
npm run test:e2e:headed    # E2E tests with browser visible
npm run test:e2e:ui        # E2E tests in UI mode
npm run test:e2e:report    # View Playwright report
```

## Test File Organization

### Backend

**Location:** `backend/tests/`
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Fixtures: `tests/fixtures/`

**Structure:**
```
backend/tests/
├── setup.js                           # Global Jest setup
├── fixtures/
│   └── generators.js                  # Test data factories
├── unit/
│   ├── auth/
│   │   ├── login.test.js
│   │   ├── register.test.js
│   │   ├── passwordReset.test.js
│   │   └── twoFactor.test.js
│   ├── appointments/
│   │   ├── scheduling.test.js
│   │   ├── statusTransitions.test.js
│   │   └── availability.test.js
│   ├── phiEncryption.test.js
│   ├── invoiceCalculations.test.js
│   └── ...
└── integration/
    ├── labBilling.test.js
    └── ...
```

**Naming:**
- Pattern: `{module}.test.js` or `{feature}.test.js`
- Example: `login.test.js`, `phiEncryption.test.js`, `labBilling.test.js`

### Frontend

**Location:** `frontend/src/test/`
- Components: `test/components/`
- Services: `test/services/`
- Contexts: `test/contexts/`
- Integration: `test/integration/`
- Mocks: `test/mocks/`

**Structure:**
```
frontend/src/test/
├── setup.js                           # Global Vitest setup
├── mocks/
│   ├── msw.js                         # Mock Service Worker setup
│   └── handlers.js                    # HTTP mock handlers
├── components/
│   ├── auth/
│   │   ├── LoginForm.test.jsx
│   │   └── RegisterForm.test.jsx
│   ├── patients/
│   │   ├── PatientList.test.jsx
│   │   └── PatientForm.test.jsx
│   └── ...
├── services/
│   ├── authService.test.js
│   ├── patientService.test.js
│   └── ...
├── contexts/
│   └── ClinicContext.test.jsx
└── integration/
    ├── offlineIntegration.test.js
    └── offlineWorkflow.test.js
```

**Naming:**
- Pattern: `{component}.test.jsx` or `{hook}.test.js`
- Example: `LoginForm.test.jsx`, `useStudioVisionConsultation.test.js`
- Match source file name exactly

## Test Structure

### Backend Test Template

```javascript
/**
 * Authentication Login Tests
 *
 * Tests for user login flow including:
 * - Valid login returns tokens
 * - Invalid credentials return 401
 * - Rate limiting blocks brute force
 */

const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const { createTestUser } = require('../fixtures/generators');

describe('Authentication - Login', () => {
  let testUser;

  beforeAll(async () => {
    // Setup shared test data
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    testUser = await User.create(createTestUser({
      email: 'test@medflow.com',
      password: 'TestPass123!@#'
    }));
  });

  afterEach(async () => {
    // Clean up (handled by jest setup for DB)
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@medflow.com');
    });

    test('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid credentials/i);
    });
  });
});
```

**Patterns:**
- Use `describe()` blocks for feature grouping
- Use `test()` or `it()` for individual test cases
- Use `beforeAll/beforeEach` for setup, `afterEach/afterAll` for cleanup
- Use `expect()` for assertions
- Use `supertest` for HTTP endpoint testing
- One assertion per test (or tightly related assertions)

### Frontend Test Template

```javascript
/**
 * Login Form Component Tests
 *
 * Tests for:
 * - Form rendering
 * - Validation
 * - Submission
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../LoginForm';
import * as authService from '../../services/authService';

// Mock the service
vi.mock('../../services/authService');

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <LoginForm />
    </BrowserRouter>
  );
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render email and password inputs', () => {
      renderComponent();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/mot de passe|password/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should not submit with empty email', async () => {
      renderComponent();
      const user = userEvent.setup();

      const submitButton = screen.getByRole('button', { name: /connexion/i });
      await user.click(submitButton);

      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      vi.mocked(authService.login).mockResolvedValueOnce({
        user: { id: '1', email: 'test@test.com' }
      });

      renderComponent();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email/i), 'test@test.com');
      await user.type(screen.getByLabelText(/password/i), 'Password123');
      await user.click(screen.getByRole('button', { name: /connexion/i }));

      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          email: 'test@test.com',
          password: 'Password123'
        });
      });
    });
  });
});
```

**Patterns:**
- Import from `vitest` for test API
- Use `@testing-library/react` for component rendering
- Use `vi.mock()` for mocking services
- Use `userEvent` for simulating user interactions (prefer over `fireEvent`)
- Use `waitFor()` for async assertions
- Group related tests with `describe()`
- Test accessibility (use semantic queries like `getByRole`, `getByLabelText`)
- Test French labels and validation messages

## Mocking

### Backend Mocking

**Framework:** Jest's built-in mocking

**Mocked Services (in `tests/setup.js`):**
```javascript
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue({ success: true }));

// Mock timers (prevent background tasks)
jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
```

**Test-Level Mocking:**
```javascript
test('should handle payment success', async () => {
  // Mock external service
  jest.spyOn(websocketService, 'notifyPayment').mockResolvedValueOnce();

  const result = await BillingService.processPayment(...);

  expect(websocketService.notifyPayment).toHaveBeenCalled();
  websocketService.notifyPayment.mockRestore();
});
```

**What to Mock:**
- External services (email, SMS, payment gateways)
- WebSocket service (notifications)
- Redis/caching service
- Email sending
- Timers and scheduling

**What NOT to Mock:**
- Mongoose models (use in-memory MongoDB via MongoMemoryServer)
- Controllers and services under test
- Utilities and helpers
- Validators

### Frontend Mocking

**Framework:** Vitest's `vi` mock API + Mock Service Worker (MSW)

**Service Mocking:**
```javascript
import { vi } from 'vitest';

vi.mock('../../services/authService', () => ({
  default: {
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn().mockResolvedValue(null)
  }
}));

// In test
vi.mocked(authService.login).mockResolvedValueOnce({ user: {...} });
expect(authService.login).toHaveBeenCalledWith(expectedData);
```

**HTTP Mocking (MSW):**
```javascript
// test/mocks/handlers.js
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/auth/login', async () => {
    return HttpResponse.json({ success: true, user: {...} });
  }),

  http.get('/api/patients/:id', async ({ params }) => {
    if (params.id === 'invalid') {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json({ data: {...} });
  })
];

// test/setup.js
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**What to Mock:**
- API services (use MSW for HTTP)
- External libraries with side effects
- Router navigation
- Custom hooks (when testing components that use them)

**What NOT to Mock:**
- Components under test
- React Router context (use BrowserRouter wrapper)
- Redux store (use real Redux for integration tests)
- DOM queries and testing library utilities

## Fixtures and Factories

**Backend Generators (`tests/fixtures/generators.js`):**
```javascript
const crypto = require('crypto');
const User = require('../../models/User');

/**
 * Create a test user with defaults
 * @param {Object} overrides - Fields to override defaults
 * @returns {Object} Test user data
 */
function createTestUser(overrides = {}) {
  return {
    email: 'test@medflow.com',
    username: 'testuser',
    password: 'TestPass123!@#',
    firstName: 'Test',
    lastName: 'User',
    role: 'doctor',
    ...overrides
  };
}

function createTestPatient(overrides = {}) {
  return {
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    nationalId: 'CD12345678',
    phoneNumber: '+243812345678',
    ...overrides
  };
}

function createTestLabOrder(overrides = {}) {
  return {
    orderId: `LAB-${Date.now()}`,
    status: 'pending',
    tests: [
      {
        testCode: 'CBC',
        testName: 'Complete Blood Count'
      }
    ],
    ...overrides
  };
}

module.exports = {
  createTestUser,
  createTestPatient,
  createTestLabOrder
};
```

**Usage in Tests:**
```javascript
const testUser = await User.create(createTestUser({
  email: 'admin@test.com',
  role: 'admin'
}));

const testPatient = await Patient.create(createTestPatient({
  firstName: 'Jane',
  nationalId: 'CD87654321'
}));
```

**Location:** `backend/tests/fixtures/generators.js`

## Coverage

**Target Coverage:**
- Branches: 60%
- Functions: 60%
- Lines: 60%
- Statements: 60%

**View Coverage:**

Backend:
```bash
npm run test:coverage
# Open backend/coverage/lcov-report/index.html
```

Frontend:
```bash
npm run test:coverage
# Opens coverage report in terminal or HTML
```

**Coverage Gaps (Common Untested Areas):**
1. Error handling paths (throw statements)
2. Edge cases (null checks, boundary values)
3. Multi-clinic isolation checks
4. Offline mode fallbacks
5. Permission/role-based access control
6. Rate limiting and throttling

## Test Types

### Unit Tests

**Scope:** Single function or method in isolation

**Backend Examples:**
- `phiEncryption.test.js` - Test encrypt/decrypt functions
- `invoiceCalculations.test.js` - Test fee calculations
- `prescriptionValidation.test.js` - Test drug interaction checks

**Frontend Examples:**
- `useStudioVisionConsultation.test.js` - Custom hook logic
- `dateHelpers.test.js` - Date formatting/parsing utilities
- `refractionValidation.test.js` - Validation helper logic

**Characteristics:**
- Use mocks for dependencies
- Test single code path per test
- Fast execution (< 100ms per test)
- Focus on business logic, not implementation details

```javascript
describe('calculateInvoiceTotal', () => {
  test('should sum all item amounts', () => {
    const items = [
      { description: 'Exam', amount: 10000 },
      { description: 'Refraction', amount: 5000 }
    ];
    const total = calculateInvoiceTotal(items);
    expect(total).toBe(15000);
  });

  test('should apply discount if percentage provided', () => {
    const items = [{ description: 'Service', amount: 10000 }];
    const total = calculateInvoiceTotal(items, { discountPercent: 10 });
    expect(total).toBe(9000);
  });
});
```

### Integration Tests

**Scope:** Multiple components interacting (service + model + controller)

**Backend Examples:**
- `labBilling.test.js` - LabOrder → Invoice creation flow
- Auth with password hashing and token generation
- Payment processing with surgery case cascade

**Frontend Examples:**
- Form submission → API call → Redux state update
- Offline sync with local DB → API → store
- Multi-step consultation workflow

**Characteristics:**
- Use real Mongoose models with in-memory MongoDB
- Test complete request/response cycle
- Test data mutations and state changes
- Validate side effects (WebSocket calls, audit logs)

```javascript
describe('Lab Invoice Generation - Integration', () => {
  test('should create invoice and update lab order atomically', async () => {
    // Setup
    const labOrder = await LabOrder.create({...});

    // Execute
    const result = await BillingService.createInvoice(labOrder._id, userId);

    // Assert
    expect(result.invoice).toBeDefined();
    expect(result.invoice.status).toBe('draft');

    // Verify side effects
    const updatedOrder = await LabOrder.findById(labOrder._id);
    expect(updatedOrder.invoice).toBe(result.invoice._id);
  });
});
```

### E2E Tests

**Framework:** Playwright (Browser automation)

**Scope:** Complete user workflows from login to task completion

**Examples:**
- User logs in → views patient → creates consultation → saves
- Admin creates invoice → patient pays → surgery case generated
- Clinician views queue → checks in patient → starts consultation

**Run:**
```bash
npm run test:e2e              # Headless
npm run test:e2e:headed       # Browser visible
npm run test:e2e:ui           # Debug mode
```

## Common Patterns

### Async Testing (Backend)

```javascript
// Using async/await
test('should fetch user from database', async () => {
  const user = await User.create({...});
  expect(user._id).toBeDefined();
});

// Using done callback (legacy, don't use)
test('should fetch user', (done) => {
  User.findById('123', (err, user) => {
    expect(user).toBeDefined();
    done();
  });
});
```

### Async Testing (Frontend)

```javascript
import { waitFor, screen } from '@testing-library/react';

test('should load and display patient data', async () => {
  render(<PatientDetail />);

  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  }, { timeout: 3000 });
});

// Alternative: using userEvent which returns Promise
test('should submit form', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);

  await user.type(screen.getByLabelText(/email/i), 'test@test.com');
  await user.click(screen.getByRole('button'));

  expect(authService.login).toHaveBeenCalled();
});
```

### Error Testing (Backend)

```javascript
describe('Error Handling', () => {
  test('should throw error if invoice not found', async () => {
    await expect(
      BillingService.processPayment('invalid-id', {...}, userId)
    ).rejects.toThrow('Invoice not found');
  });

  test('should return 404 if patient not found', async () => {
    const response = await request(app)
      .get('/api/patients/invalid-id')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
```

### Error Testing (Frontend)

```javascript
test('should display error message on failed login', async () => {
  vi.mocked(authService.login).mockRejectedValueOnce(
    new Error('Invalid credentials')
  );

  const user = userEvent.setup();
  render(<LoginForm />);

  await user.type(screen.getByLabelText(/email/i), 'test@test.com');
  await user.type(screen.getByLabelText(/password/i), 'wrong');
  await user.click(screen.getByRole('button'));

  await waitFor(() => {
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

### Testing Protected Routes (Backend)

```javascript
test('should require authentication for protected routes', async () => {
  const response = await request(app)
    .get('/api/patients')
    .expect(401);

  expect(response.body.error).toMatch(/authorized/i);
});

test('should allow authenticated requests', async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@test.com', password: 'Password123' });

  const token = loginRes.body.data.accessToken;

  const response = await request(app)
    .get('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(Array.isArray(response.body.data)).toBe(true);
});
```

### Testing Forms (Frontend)

```javascript
test('should validate required fields', async () => {
  const user = userEvent.setup();
  render(<PatientForm />);

  // Try to submit empty form
  await user.click(screen.getByRole('button', { name: /créer|create/i }));

  // Should show validation errors
  await waitFor(() => {
    expect(screen.getByText(/prénom requis|first name required/i)).toBeInTheDocument();
    expect(screen.getByText(/nom requis|last name required/i)).toBeInTheDocument();
  });
});

test('should submit valid form', async () => {
  const mockCreate = vi.fn().mockResolvedValueOnce({ id: '123' });
  vi.mocked(patientService.createPatient).mockImplementation(mockCreate);

  const user = userEvent.setup();
  render(<PatientForm />);

  await user.type(screen.getByLabelText(/prénom|first name/i), 'John');
  await user.type(screen.getByLabelText(/nom|last name/i), 'Doe');
  await user.click(screen.getByRole('button', { name: /créer|create/i }));

  await waitFor(() => {
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe'
      })
    );
  });
});
```

## Test Coverage Gaps

**Critical Areas Requiring More Tests:**

1. **Multi-clinic Isolation** (`backend/tests/unit/multiClinic/`)
   - Verify clinic context enforcement on all queries
   - Test cross-clinic data leakage prevention

2. **Permission-Based Access Control** (`backend/tests/unit/permissions/`)
   - Doctor can view own patients but not other doctors' patients
   - Admin can view all data
   - Pharmacist can only view pharmacy data

3. **Offline Sync** (`frontend/src/test/integration/offlineIntegration.test.js`)
   - Data queues correctly when offline
   - Sync merges local and server changes
   - Conflict resolution for concurrent edits

4. **Financial Calculations** (`backend/tests/unit/invoiceCalculations.test.js`)
   - Multi-currency conversion with exchange rates
   - Fee schedule application and overrides
   - Discount and tax calculations

5. **Device Integration** (`backend/tests/unit/deviceParsers/`)
   - OCT file parsing and data extraction
   - Autorefractor result mapping
   - Patient folder matching

6. **Error Recovery** (`backend/tests/integration/failover/`)
   - Database connection retry logic
   - Payment transaction rollback
   - Failed WebSocket notification recovery

---

*Testing analysis: 2026-01-25*
