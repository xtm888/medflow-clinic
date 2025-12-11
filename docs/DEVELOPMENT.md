# MedFlow Development Guide

## Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 8+ | Package manager |
| MongoDB | 7+ | Database |
| Redis | 4+ | Caching/sessions (optional) |
| Git | Latest | Version control |

## Environment Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd magloire
```

### 2. Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Seed initial data
npm run seed
```

### 3. Configure Environment Variables

Edit `backend/.env`:

```env
# Server
PORT=5001
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/medflow

# Authentication
JWT_SECRET=your-secure-jwt-secret-here
JWT_EXPIRE=15m
REFRESH_TOKEN_SECRET=your-secure-refresh-secret-here
REFRESH_TOKEN_EXPIRE=30d

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Email (optional)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email
EMAIL_PASS=your-password

# Face Recognition Service
FACE_RECOGNITION_URL=http://localhost:5002
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file (optional)
echo "VITE_API_URL=http://localhost:5001/api" > .env.local
```

### 5. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Or use the start script:
```bash
./start-all.sh
```

## Project Structure

### Backend

```
backend/
├── config/
│   ├── constants.js     # Application constants
│   ├── errorMessages.js # Centralized error messages
│   ├── logger.js        # Winston logging config
│   ├── redis.js         # Redis client config
│   └── swagger.js       # API documentation
├── controllers/         # Request handlers (59 files)
│   ├── authController.js
│   ├── patientController.js
│   └── ...
├── middleware/
│   ├── auth.js          # JWT & permission middleware
│   ├── auditLogger.js   # Request logging
│   ├── errorHandler.js  # Error processing
│   ├── rateLimiter.js   # Rate limiting
│   └── validation.js    # Input validation
├── models/              # Mongoose schemas (84 files)
│   ├── Patient.js
│   ├── User.js
│   └── ...
├── routes/              # API endpoints (78 files)
│   ├── auth.js
│   ├── patients.js
│   └── ...
├── services/            # Business logic (63+ files)
│   ├── adapters/        # Device adapters
│   ├── notificationService.js
│   └── ...
├── scripts/             # Seed data & utilities
├── tests/               # Test files
└── server.js            # Application entry point
```

### Frontend

```
frontend/src/
├── components/          # Reusable UI components (70+)
│   ├── documents/
│   ├── laboratory/
│   ├── pharmacy/
│   └── ...
├── contexts/            # React Context providers
│   ├── AuthContext.jsx
│   ├── ClinicContext.jsx
│   └── PatientContext.jsx
├── hooks/               # Custom React hooks (16)
│   ├── useApi.js
│   ├── useAutoSave.js
│   └── ...
├── modules/             # Feature orchestrators
│   ├── clinical/
│   └── dashboard/
├── pages/               # Route components
│   ├── Dashboard.jsx
│   ├── Patients.jsx
│   ├── ophthalmology/
│   └── ...
├── services/            # API integration (70+)
│   ├── apiConfig.js
│   ├── patientService.js
│   └── ...
├── store/               # Redux state
│   ├── slices/
│   └── index.js
└── App.jsx              # Root component
```

## Coding Conventions

### JavaScript/Node.js

```javascript
// Use async/await
exports.getPatients = asyncHandler(async (req, res, next) => {
  const patients = await Patient.find({ clinic: req.clinic });
  res.status(200).json({ success: true, data: patients });
});

// Use destructuring
const { firstName, lastName, email } = req.body;

// Use template literals
const message = `Patient ${patient.firstName} created`;

// Use const by default, let when reassignment needed
const config = require('./config');
let counter = 0;
```

### React/Frontend

```jsx
// Functional components with hooks
const PatientCard = ({ patient, onSelect }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(() => {
    setIsLoading(true);
    onSelect(patient.id);
  }, [patient.id, onSelect]);

  return (
    <div className="card" onClick={handleClick}>
      {patient.name}
    </div>
  );
};

// PropTypes for type checking
PatientCard.propTypes = {
  patient: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase | `PatientCard.jsx` |
| Files (utilities) | camelCase | `apiConfig.js` |
| Functions | camelCase | `getPatients()` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| React components | PascalCase | `PatientCard` |
| CSS classes | kebab-case | `patient-card` |

## Testing

### Running Tests

```bash
# Backend
cd backend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests

# Frontend (not yet configured)
cd frontend
npm run lint          # ESLint check
```

### Test Structure

```
backend/tests/
├── setup.js           # Jest config with MongoDB Memory Server
├── fixtures/
│   └── generators.js  # Test data generators
├── unit/
│   ├── invoiceCalculations.test.js
│   ├── prescriptionValidation.test.js
│   └── queueManagement.test.js
└── integration/
    └── patients.test.js
```

### Writing Tests

```javascript
const { createTestPatient, createTestUser } = require('../fixtures/generators');

describe('Patient API', () => {
  let authToken;

  beforeAll(async () => {
    const user = await createTestUser({ role: 'admin' });
    authToken = generateToken(user._id);
  });

  test('should create a patient', async () => {
    const patientData = createTestPatient();

    const response = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send(patientData);

    expect(response.status).toBe(201);
    expect(response.body.data.firstName).toBe(patientData.firstName);
  });
});
```

## API Development

### Creating a New Endpoint

1. **Define Model** (if needed)
```javascript
// models/NewFeature.js
const mongoose = require('mongoose');

const newFeatureSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('NewFeature', newFeatureSchema);
```

2. **Create Controller**
```javascript
// controllers/newFeatureController.js
const NewFeature = require('../models/NewFeature');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const features = await NewFeature.find();
  res.json({ success: true, data: features });
});

exports.create = asyncHandler(async (req, res) => {
  const feature = await NewFeature.create(req.body);
  res.status(201).json({ success: true, data: feature });
});
```

3. **Define Routes**
```javascript
// routes/newFeatures.js
const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/auth');
const { getAll, create } = require('../controllers/newFeatureController');

router.route('/')
  .get(protect, requirePermission('view_features'), getAll)
  .post(protect, requirePermission('create_features'), create);

module.exports = router;
```

4. **Register in Server**
```javascript
// server.js
app.use('/api/new-features', require('./routes/newFeatures'));
```

### Input Validation

```javascript
// middleware/validation.js
const { body, validationResult } = require('express-validator');

exports.validateNewFeature = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
  body('status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('Invalid status'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];
```

## Error Handling

### Backend

```javascript
// Use asyncHandler wrapper
exports.getPatient = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  res.json({ success: true, data: patient });
});

// Or throw custom errors
const ErrorResponse = require('../utils/errorResponse');

if (!patient) {
  throw new ErrorResponse('Patient not found', 404);
}
```

### Frontend

```javascript
// services/patientService.js
export const getPatient = async (id) => {
  try {
    const response = await api.get(`/patients/${id}`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch patient'
    };
  }
};

// In component
const { success, data, error } = await getPatient(id);
if (!success) {
  toast.error(error);
  return;
}
setPatient(data);
```

## Debugging

### Backend Logging

```javascript
const logger = require('./config/logger');

logger.info('Patient created', { patientId: patient._id });
logger.error('Database error', { error: err.message, stack: err.stack });
logger.warn('Rate limit exceeded', { ip: req.ip });
```

### Frontend Debugging

```javascript
// Enable Redux DevTools in development
// Already configured in store/index.js

// Use React DevTools browser extension

// Console logging (remove in production)
console.log('[PatientService]', 'Fetching patient:', id);
```

### MongoDB Queries

```bash
# Connect to MongoDB
mongosh medflow

# View collections
show collections

# Query patients
db.patients.find({ firstName: /john/i }).limit(5)

# Check indexes
db.patients.getIndexes()
```

## Common Tasks

### Add a New Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.jsx`
3. Add menu item in `frontend/src/layouts/MainLayout.jsx`
4. Add permission in `frontend/src/config/rolePermissions.js`

### Add a New Service

1. Create service file in `backend/services/`
2. Export functions following existing patterns
3. Import and use in controllers
4. Add tests in `backend/tests/`

### Database Migration

```bash
# Using migrate-mongo
cd backend
npx migrate-mongo create add-new-field
# Edit the generated migration file
npx migrate-mongo up
```

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB status
mongosh --eval "db.adminCommand('ping')"

# Check connection string in .env
MONGO_URI=mongodb://localhost:27017/medflow
```

### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Application works without Redis (uses in-memory fallback)
```

### Port Already in Use
```bash
# Find process using port
lsof -i :5001
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf frontend/node_modules/.vite
```
