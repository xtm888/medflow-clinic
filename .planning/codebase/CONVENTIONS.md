# Code Conventions

**Analysis Date:** 2026-01-13

## Code Style

**Formatting:**
- Prettier for consistent formatting (`backend/.prettierrc`)
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in ES5 contexts

**Linting:**
- ESLint for both backend and frontend
- Backend: `backend/.eslintrc.js`
- Frontend: `frontend/.eslintrc.cjs`
- Rules enforce consistent patterns and catch common errors

**Line Length:**
- Max ~100-120 characters per line
- Break long function calls across multiple lines

## Naming Conventions

**Files:**
- `camelCase.js` - Backend modules (e.g., `appointmentController.js`, `patientService.js`)
- `PascalCase.jsx` - React components (e.g., `PatientList.jsx`, `AppointmentForm.jsx`)
- `UPPER_CASE.md` - Important documentation (e.g., `README.md`, `CLAUDE.md`)
- `kebab-case` - Config files (e.g., `docker-compose.yml`)

**Variables & Functions:**
- `camelCase` for variables and functions (e.g., `patientData`, `getAppointments`)
- `PascalCase` for classes and React components (e.g., `Patient`, `AppointmentCard`)
- `UPPER_SNAKE_CASE` for constants (e.g., `MAX_PAGE_SIZE`, `JWT_EXPIRY`)

**Database:**
- Collections: `camelCase` plural (e.g., `patients`, `appointments`, `invoices`)
- Fields: `camelCase` (e.g., `firstName`, `dateOfBirth`, `clinicId`)
- Foreign keys: Referenced model name + `Id` (e.g., `patientId`, `clinicId`, `createdBy`)

**API Routes:**
- `/api/{resource}` - Resource-based REST endpoints
- Plural nouns for collections (e.g., `/api/patients`, `/api/appointments`)
- Nested for relationships (e.g., `/api/patients/:id/visits`)

## Common Patterns

**Backend Controller Pattern:**
```javascript
// backend/controllers/{domain}Controller.js
const { success, error } = require('../utils/apiResponse');
const Service = require('../services/{domain}Service');

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, ...filters } = req.query;
    const clinicId = req.user.currentClinicId;

    const result = await Service.findAll({
      clinicId,
      ...filters,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return success(res, result, 'Resources retrieved successfully');
  } catch (err) {
    return error(res, err.message, 500);
  }
};
```

**Backend Service Pattern:**
```javascript
// backend/services/{domain}Service.js
const Model = require('../models/{Domain}');

class DomainService {
  async findAll({ clinicId, page, limit, ...filters }) {
    const query = { clinic: clinicId, isDeleted: { $ne: true }, ...filters };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Model.find(query).skip(skip).limit(limit).lean(),
      Model.countDocuments(query)
    ]);

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }
}

module.exports = new DomainService();
```

**Mongoose Model Pattern:**
```javascript
// backend/models/{Domain}.js
const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
  clinic: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
domainSchema.index({ clinic: 1, status: 1 });
domainSchema.index({ clinic: 1, createdAt: -1 });

// Pre-save hook
domainSchema.pre('save', function(next) {
  // Business logic
  next();
});

// Static methods
domainSchema.statics.findByClinic = function(clinicId) {
  return this.find({ clinic: clinicId, isDeleted: { $ne: true } });
};

module.exports = mongoose.model('Domain', domainSchema);
```

**React Component Pattern:**
```jsx
// frontend/src/components/{domain}/{ComponentName}.jsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { domainService } from '../../services/domainService';

const ComponentName = ({ propA, propB }) => {
  const [localState, setLocalState] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['domain', propA],
    queryFn: () => domainService.getById(propA),
    enabled: !!propA
  });

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error.message}</div>;

  return (
    <div className="p-4">
      {/* Component content */}
    </div>
  );
};

export default ComponentName;
```

**API Service Pattern:**
```javascript
// frontend/src/services/{domain}Service.js
import api from './api';

export const domainService = {
  getAll: async (params = {}) => {
    const response = await api.get('/api/domains', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/domains/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/api/domains', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/api/domains/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/domains/${id}`);
    return response.data;
  }
};
```

## Documentation Style

**JSDoc Comments:**
```javascript
/**
 * Create a new patient record
 * @param {Object} patientData - Patient information
 * @param {string} patientData.firstName - Patient's first name
 * @param {string} patientData.lastName - Patient's last name
 * @param {string} clinicId - Clinic identifier
 * @returns {Promise<Object>} Created patient document
 * @throws {ValidationError} If required fields are missing
 */
async function createPatient(patientData, clinicId) {
  // Implementation
}
```

**Inline Comments:**
- Use sparingly for complex logic
- Explain "why" not "what"
- Keep comments up-to-date with code

**API Documentation:**
- OpenAPI 3.0 via swagger-jsdoc
- Located in `backend/config/swagger.js`
- Accessible at `/api-docs` endpoint

## Error Handling

**Backend Error Pattern:**
```javascript
// Using apiResponse utility
const { success, error } = require('../utils/apiResponse');

// Success response
return success(res, data, 'Operation successful');

// Error response
return error(res, 'Resource not found', 404);

// Validation error
return error(res, 'Invalid input data', 400);
```

**Frontend Error Pattern:**
```javascript
try {
  const result = await apiService.operation();
  toast.success('Opération réussie');
} catch (err) {
  console.error('Operation failed:', err);
  toast.error(err.response?.data?.message || 'Une erreur est survenue');
}
```

## Async Patterns

**Backend:**
```javascript
// Async/await preferred
exports.handler = async (req, res) => {
  try {
    const result = await asyncOperation();
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Promise.all for parallel operations
const [items, count] = await Promise.all([
  Model.find(query).lean(),
  Model.countDocuments(query)
]);
```

**Frontend:**
```javascript
// React Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => service.getById(id)
});

// useMutation for mutations
const mutation = useMutation({
  mutationFn: (data) => service.create(data),
  onSuccess: () => queryClient.invalidateQueries(['resources'])
});
```

## Import Organization

**Backend:**
```javascript
// 1. Node.js built-ins
const path = require('path');
const fs = require('fs');

// 2. External packages
const express = require('express');
const mongoose = require('mongoose');

// 3. Internal modules - config
const { logger } = require('../config/logger');

// 4. Internal modules - models
const Patient = require('../models/Patient');

// 5. Internal modules - services
const patientService = require('../services/patientService');

// 6. Internal modules - utils
const { success, error } = require('../utils/apiResponse');
```

**Frontend:**
```javascript
// 1. React
import React, { useState, useEffect } from 'react';

// 2. External packages
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';

// 3. Internal - components
import { Button } from '../components/common/Button';

// 4. Internal - services
import { patientService } from '../services/patientService';

// 5. Internal - utils
import { formatDate } from '../utils/dateUtils';

// 6. Styles (if any)
import './ComponentName.css';
```

## French Language Convention

All user-facing text is in French:

```javascript
// Messages
toast.success('Patient créé avec succès');
toast.error('Une erreur est survenue');

// Labels
<label>Nom du patient</label>
<label>Date de naissance</label>

// Placeholders
<input placeholder="Rechercher un patient..." />

// Button text
<button>Enregistrer</button>
<button>Annuler</button>

// Status values
const STATUS_LABELS = {
  active: 'Actif',
  inactive: 'Inactif',
  pending: 'En attente'
};
```

---

*Conventions analysis: 2026-01-13*
*Update when code style guidelines change*
