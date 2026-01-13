# Testing Patterns

**Analysis Date:** 2026-01-13

## Test Framework

**Backend Runner:**
- Jest 29.6.4
- Config: `backend/jest.config.js`
- MongoDB Memory Server for isolated database tests

**Frontend Runner:**
- Vitest 4.0.15
- Config: `frontend/vitest.config.js`

**E2E Runner:**
- Playwright 1.57.0
- Config: `playwright.config.ts` (project root)

**Run Commands:**
```bash
# Backend tests
cd backend && npm test                    # Run all backend tests
cd backend && npm test -- --watch         # Watch mode
cd backend && npm test -- path/to/file    # Single file

# Frontend tests
cd frontend && npm test                   # Run all frontend tests
cd frontend && npm run test:coverage      # With coverage

# E2E tests
npx playwright test                       # Run all E2E tests
npx playwright test --ui                  # Interactive UI mode
npx playwright test tests/playwright/file.spec.ts  # Single file
```

## Test File Organization

**Backend Location:**
- `backend/__tests__/` - Unit and integration tests
- Co-located test files also supported: `*.test.js`

**Frontend Location:**
- Co-located with source: `Component.test.jsx` alongside `Component.jsx`
- `frontend/src/**/*.test.js` pattern

**E2E Location:**
- `tests/playwright/` - All Playwright test files
- Pattern: `*.spec.ts`

**Naming:**
- Unit tests: `module-name.test.js`
- Integration tests: `feature.integration.test.js`
- E2E tests: `feature-name.spec.ts`

**Structure:**
```
backend/
  __tests__/
    unit/
      services/
        patientService.test.js
      utils/
        validation.test.js
    integration/
      api/
        patients.test.js
  services/
    patientService.js
    patientService.test.js    # Co-located also valid

frontend/
  src/
    components/
      PatientCard.jsx
      PatientCard.test.jsx    # Co-located
    services/
      patientService.js
      patientService.test.js

tests/
  playwright/
    site-crawler.spec.ts
    dynamic-routes.spec.ts
    role-workflow-validation.spec.ts
```

## Test Structure

**Jest/Vitest Suite Organization:**
```javascript
describe('PatientService', () => {
  beforeAll(async () => {
    // Setup database connection (MongoDB Memory Server)
  });

  afterAll(async () => {
    // Cleanup database connection
  });

  beforeEach(async () => {
    // Clear collections, reset state
  });

  describe('createPatient', () => {
    it('should create a patient with valid data', async () => {
      // Arrange
      const patientData = {
        firstName: 'Jean',
        lastName: 'Dupont',
        dateOfBirth: new Date('1980-01-15')
      };

      // Act
      const result = await patientService.create(patientData, clinicId);

      // Assert
      expect(result).toBeDefined();
      expect(result.firstName).toBe('Jean');
      expect(result._id).toBeDefined();
    });

    it('should throw error for missing required fields', async () => {
      // Arrange
      const invalidData = { firstName: 'Jean' };

      // Act & Assert
      await expect(patientService.create(invalidData, clinicId))
        .rejects.toThrow('lastName is required');
    });
  });
});
```

**Playwright E2E Structure:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Patient Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new patient', async ({ page }) => {
    await page.goto('/patients/new');
    await page.fill('[name="firstName"]', 'Jean');
    await page.fill('[name="lastName"]', 'Dupont');
    await page.click('button[type="submit"]');

    await expect(page.locator('.toast-success')).toBeVisible();
  });
});
```

## Mocking

**Jest Mocking (Backend):**
```javascript
// Mock external module
jest.mock('../services/externalService', () => ({
  callExternalApi: jest.fn()
}));

// Mock in test
const { callExternalApi } = require('../services/externalService');

describe('ServiceUsingExternal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle external API call', async () => {
    callExternalApi.mockResolvedValue({ data: 'mocked' });

    const result = await serviceUnderTest.doSomething();

    expect(callExternalApi).toHaveBeenCalledWith(expectedArgs);
    expect(result).toEqual(expectedResult);
  });
});
```

**Vitest Mocking (Frontend):**
```javascript
import { vi } from 'vitest';
import { patientService } from '../services/patientService';

vi.mock('../services/patientService', () => ({
  patientService: {
    getAll: vi.fn(),
    getById: vi.fn()
  }
}));

describe('PatientList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display patients', async () => {
    patientService.getAll.mockResolvedValue({
      items: [{ id: '1', firstName: 'Jean' }]
    });

    // Render and test component
  });
});
```

**What to Mock:**
- External API calls (Axios requests)
- Database operations (in unit tests)
- File system operations
- Time/dates (use fake timers)
- Environment variables
- WebSocket connections

**What NOT to Mock:**
- Internal pure functions
- Simple utilities
- Business logic under test
- Database in integration tests

## Fixtures and Factories

**Test Data Factories:**
```javascript
// backend/__tests__/factories/patientFactory.js
const mongoose = require('mongoose');

function createTestPatient(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'M',
    clinic: new mongoose.Types.ObjectId(),
    ...overrides
  };
}

function createTestAppointment(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    patient: new mongoose.Types.ObjectId(),
    clinic: new mongoose.Types.ObjectId(),
    dateTime: new Date(),
    type: 'consultation',
    status: 'scheduled',
    ...overrides
  };
}

module.exports = { createTestPatient, createTestAppointment };
```

**Fixture Files:**
```javascript
// backend/__tests__/fixtures/clinics.js
module.exports = {
  testClinic: {
    name: 'Test Clinic',
    code: 'TEST001',
    address: '123 Test Street',
    currency: 'CDF'
  },
  secondClinic: {
    name: 'Second Clinic',
    code: 'TEST002',
    address: '456 Test Avenue',
    currency: 'USD'
  }
};
```

**Location:**
- Factories: `backend/__tests__/factories/`
- Fixtures: `backend/__tests__/fixtures/`
- Shared test utilities: `backend/__tests__/helpers/`

## Coverage

**Requirements:**
- No strict enforcement threshold
- Coverage tracked for awareness
- Focus on critical paths: authentication, financial operations, clinical data

**Backend Configuration:**
```javascript
// backend/jest.config.js
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    'services/**/*.js',
    'controllers/**/*.js',
    'utils/**/*.js',
    '!**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
```

**View Coverage:**
```bash
# Backend
cd backend && npm test -- --coverage
open backend/coverage/lcov-report/index.html

# Frontend
cd frontend && npm run test:coverage
open frontend/coverage/index.html
```

## Test Types

**Unit Tests:**
- Scope: Single function/class in isolation
- Mocking: All external dependencies
- Speed: <100ms per test
- Location: Co-located or `__tests__/unit/`
- Examples: Service methods, utility functions, model validations

**Integration Tests:**
- Scope: Multiple modules together
- Mocking: External services only, real database (Memory Server)
- Setup: Test database with seed data
- Location: `__tests__/integration/`
- Examples: API endpoint tests, service + model integration

**E2E Tests:**
- Framework: Playwright
- Scope: Full user flows through browser
- Setup: Running dev server, test database
- Location: `tests/playwright/`
- Examples: Login flow, patient creation, appointment booking

## Common Patterns

**Async Testing:**
```javascript
// Jest/Vitest
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

// With timeout
it('should complete within timeout', async () => {
  const result = await longOperation();
  expect(result).toBeDefined();
}, 10000); // 10 second timeout
```

**Error Testing:**
```javascript
// Sync error
it('should throw on invalid input', () => {
  expect(() => validateInput(null)).toThrow('Input required');
});

// Async error
it('should reject on not found', async () => {
  await expect(service.getById('invalid'))
    .rejects.toThrow('Not found');
});
```

**Database Testing (MongoDB Memory Server):**
```javascript
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

**Playwright Page Object Pattern:**
```typescript
// tests/playwright/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }

  async expectError(message: string) {
    await expect(this.page.locator('.error')).toContainText(message);
  }
}
```

**Snapshot Testing:**
- Not heavily used in this codebase
- Prefer explicit assertions for clarity
- If used: `__snapshots__/` directories

---

*Testing analysis: 2026-01-13*
*Update when test patterns change*
