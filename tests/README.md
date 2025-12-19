# MedFlow Test Suite

**Total Tests:** ~1,200+ across 3 test layers
**Last Updated:** December 17, 2025

---

## Quick Start

```bash
# Run ALL tests
./tests/run-all-tests.sh

# Run specific layer
npm run test:unit --prefix backend     # Backend unit tests
npm run test:run --prefix frontend     # Frontend unit tests
cd tests/playwright && python3 run_all_tests.py  # E2E tests
```

---

## Test Locations

| Layer | Location | Framework | Count |
|-------|----------|-----------|-------|
| Backend Unit | `/backend/tests/unit/` | Jest | ~650 |
| Backend Integration | `/backend/tests/integration/` | Jest | ~20 |
| Frontend Unit | `/frontend/src/test/` | Vitest | ~465 |
| E2E | `/tests/playwright/` | Playwright (Python) | ~110 |

---

## Directory Structure

```
magloire/
├── backend/tests/                 # Backend Jest tests
│   ├── setup.js                   # Jest setup with MongoDB Memory Server
│   ├── fixtures/                  # Test data fixtures
│   ├── unit/                      # Unit tests
│   │   ├── auth/                  # Authentication tests
│   │   ├── appointments/          # Appointment tests
│   │   ├── billing/               # Billing/invoice tests
│   │   ├── prescriptions/         # Prescription tests
│   │   ├── invoiceCalculations.test.js
│   │   ├── patientLookup.test.js
│   │   ├── prescriptionValidation.test.js
│   │   └── queueManagement.test.js
│   └── integration/               # Integration tests
│
├── frontend/src/test/             # Frontend Vitest tests
│   ├── setup.js                   # Vitest setup
│   ├── mocks/                     # Mock implementations
│   ├── components/                # Component tests
│   │   ├── auth/                  # Auth component tests
│   │   ├── billing/               # Billing component tests
│   │   └── patients/              # Patient component tests
│   ├── services/                  # Service tests
│   ├── contexts/                  # Context tests
│   └── integration/               # Frontend integration tests
│
└── tests/                         # Root test directory
    ├── README.md                  # This file
    ├── run-all-tests.sh           # Master test runner
    └── playwright/                # E2E browser tests
        ├── test_comprehensive.py  # Main comprehensive test
        ├── test_workflows.py      # Workflow tests
        ├── screenshots/           # Test screenshots (263 files)
        └── *.py                   # 48 test files
```

---

## Running Tests

### Backend Tests (Jest)

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- invoiceCalculations.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should calculate"
```

### Frontend Tests (Vitest)

```bash
cd frontend

# Run all tests (watch mode)
npm test

# Run once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Run specific file
npm run test:run -- src/test/components/auth/
```

### E2E Tests (Playwright)

```bash
cd tests/playwright

# Run all E2E tests
python3 run_all_tests.py

# Run specific test file
python3 test_comprehensive.py

# Run with browser visible
HEADED=1 python3 test_comprehensive.py

# Run single test
python3 -m pytest test_workflows.py::test_patient_journey -v
```

---

## Test Configuration Files

| File | Purpose |
|------|---------|
| `backend/jest.config.js` | Backend Jest configuration |
| `backend/tests/setup.js` | MongoDB Memory Server setup |
| `frontend/vitest.config.js` | Frontend Vitest configuration |
| `frontend/src/test/setup.js` | Frontend test setup |

---

## Test Categories

### Backend Unit Tests

- **Auth**: Password hashing, JWT tokens, session management
- **Billing**: Invoice calculations, payment processing, conventions
- **Appointments**: Scheduling, validation, conflicts
- **Prescriptions**: Validation, drug interactions
- **Queue**: Queue management, priorities

### Frontend Unit Tests

- **Components**: React component rendering, user interactions
- **Services**: API service functions, data transformations
- **Contexts**: State management, provider tests
- **Integration**: Multi-component workflows

### E2E Tests

- **Workflows**: Patient journey, consultation, invoicing
- **CRUD**: Patient, appointment, invoice operations
- **Roles**: Access control per user role
- **Responsive**: Mobile/tablet/desktop layouts

---

## Test Status

| Suite | Pass Rate | Notes |
|-------|-----------|-------|
| Backend Unit | ~35% | MongoDB setup issues (fixed) |
| Frontend Unit | ~98% | Minor selector issues |
| E2E Playwright | ~91% | CSS selector mismatches |

---

## Fixing Common Issues

### MongoDB Connection Error (Backend)

If you see `MongooseError: Can't call openUri() on an active connection`:

```javascript
// In backend/tests/setup.js - ensure disconnect before connect
beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});
```

### Admin Login Failing (E2E)

If E2E tests fail to login:

```bash
cd backend
node scripts/resetAdmin.js
```

Default credentials: `admin@medflow.com` / `MedFlow$ecure1`

---

## Screenshots

E2E tests generate screenshots in `/tests/playwright/screenshots/`:

- `comprehensive/` - Main UI pages (57 files)
- `interactions/` - User workflows (76 files)
- `missing/` - Role-based views (58 files)
- `untested/` - Gap coverage (67 files)

See `/tests/playwright/screenshots/INDEX.md` for complete catalog.

---

## Adding New Tests

### Backend Test

```javascript
// backend/tests/unit/myFeature.test.js
const mongoose = require('mongoose');
const MyModel = require('../../models/MyModel');

describe('MyFeature', () => {
  it('should do something', async () => {
    const result = await MyModel.create({ name: 'test' });
    expect(result.name).toBe('test');
  });
});
```

### Frontend Test

```jsx
// frontend/src/test/components/MyComponent.test.jsx
import { render, screen } from '@testing-library/react';
import MyComponent from '../../components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Test

```python
# tests/playwright/test_myfeature.py
from playwright.sync_api import sync_playwright

def test_my_feature():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('http://localhost:3000')
        assert page.title() == 'MedFlow'
        browser.close()
```

---

## CI/CD Integration

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Backend Tests
        run: cd backend && npm test
      - name: Frontend Tests
        run: cd frontend && npm run test:run
      - name: E2E Tests
        run: cd tests/playwright && python3 run_all_tests.py
```

---

*Documentation generated: December 17, 2025*
