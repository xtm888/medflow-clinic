# MedFlow - Ophthalmology Practice Management System

## Project Identity

You are working on **MedFlow**, a production-grade, enterprise-level ophthalmology Electronic Medical Records (EMR) and practice management system for multi-location eye care practices in Congo (DRC), using the French medical system.

MedFlow covers:
- Core patient management and medical history
- Ophthalmology exams (StudioVision), orthoptics, IVT, surgery
- Pharmacy, lab, optical shop
- Appointments, queue, billing, multi-clinic operations
- Device integration, analytics, security, and AI services

**Primary users**: Ophthalmologists, orthoptists, opticians, pharmacists, nurses, admin staff.
**Language**: French for all user-facing content.
**Context**: Francophone Africa (Congo/DRC), French medical standards, Monoyer/Parinaud scales, CDF/USD currencies.

---

## Technical Stack

### Frontend
- **React 19** with Vite
- **Tailwind CSS** with custom design system (medical color palette)
- React Router v6
- **Redux Toolkit** + **React Query** for state management
- **Yup** for form validation
- **Lucide React** for icons
- **Dexie** for IndexedDB (offline capability)
- Socket.io-client for real-time updates
- Sentry for error tracking
- Vitest for unit tests, Playwright for E2E tests

### Backend
- **Node.js 18+** with Express
- **MongoDB** with Mongoose ODM
- **Redis** for sessions/caching
- JWT auth with refresh tokens and optional 2FA (speakeasy)
- Socket.io for WebSocket connections
- PDFKit for document generation
- Sharp for image processing
- Local/network file storage (SMB2 support)
- Jest for unit/integration tests

### AI / Microservices
- Python microservices (FastAPI/Flask)
- **DeepFace** for face recognition (patient identification, duplicate detection)
- **OCR services** for legacy records import (Celery for async processing)

### Device Integration
- DICOM for imaging
- SMB/file polling for device export folders
- Supported devices: OCT, autorefractor, tonometer, visual field, fundus camera, specular microscope, keratometer

---

## Architecture & File Structure

### API Structure

```
/api/{module}/{resource}

GET    /api/patients          # List (paginated)
GET    /api/patients/:id      # Fetch one
POST   /api/patients          # Create
PUT    /api/patients/:id      # Update
DELETE /api/patients/:id      # Soft delete
```

**Note**: API routes are at `/api/` (not `/api/v1/`).

### Server/Client Layout

```
backend/
  routes/         # Express route handlers (77+ routes)
  controllers/    # Request handling logic
  services/       # Business logic (61+ services)
  models/         # Mongoose schemas (83+ models)
  middleware/     # Auth, validation, errors, CSRF, rate limiting
  utils/          # Helpers (PHI encryption, financial validation)
  config/         # Environment/configuration
  scripts/        # Seed scripts, migrations, utilities (127+ scripts)

frontend/
  src/
    pages/        # Route components (30+ pages)
    components/   # Reusable UI components (29+ domains)
    hooks/        # Custom hooks (useWebSocket, usePatientAlerts, etc.)
    contexts/     # Global state (ClinicContext, StudioVisionModeContext)
    services/     # API client functions (80+ services)
    store/        # Redux slices
    utils/        # Frontend helpers

face-service/     # Python face recognition microservice
ocr-service/      # Python OCR microservice with Celery
central-server/   # Multi-clinic coordination server
```

### Data Layer Pattern (Mongoose)

- Schema with validation and proper types
- Pre/post hooks for business rules (auto-generate IDs, audit logging)
- Static methods for complex queries
- Instance methods for entity operations
- Virtual fields for computed values
- Indexes for performance (clinicId, patient, date fields)
- Soft delete pattern with `isDeleted` and `deletedAt` fields

---

## Medical Domain Context

### Clinical Standards

- **ICD-10**: Ophthalmology codes with laterality (OD/OS/OU)
- **Visual Acuity**:
  - **Monoyer scale** for distance vision: 10/10, 9/10, 8/10... 1/10, 1/20, 1/50
  - **Parinaud scale** for near vision: P1.5, P2, P3... P20
  - Special notations: CLD (compte les doigts), VBLM (voit bouger la main), PL+, PL-
  - LogMAR conversion supported
- **Refraction**: Sphere, cylinder, axis, addition with diopters (step 0.25, range -20.00 to +20.00)
- **IOP**: Intraocular pressure in mmHg (range 0-60, typical 10-21), with method and device
- **Exam Areas**:
  - Anterior segment (slit lamp)
  - Posterior segment/fundus
  - Keratometry, pachymetry, gonioscopy
  - LOCS III grading for cataracts
  - DR staging for diabetic retinopathy

### Geography / Currency

- Location: Congo (DRC)
- Currencies (defined in `financialValidation.js`):
  - **CDF** (Franc Congolais) - primary, 0 decimal places
  - **USD** (Dollar) - common, 2 decimal places
  - **EUR** (Euro) - supported, 2 decimal places
- Exchange rate bounds enforced for fraud prevention
- UI language: French
- Date format: DD/MM/YYYY
- Time format: 24h (e.g., 14:30)

---

## Key Modules

You must respect existing domain separation when extending functionality.

### Clinical Modules
- **Ophthalmology (StudioVision)**: Visual acuity (Monoyer/Parinaud), refraction, IOP, anterior/posterior segment, keratometry, pachymetry, gonioscopy, diagnoses, treatment plans. Uses StudioVision color-coded sections.
- **Orthoptics**: Cover test, motility, convergence, stereopsis, sensory tests, pediatric protocols, OrthoptieQuickPanel.
- **IVT (Intravitreal Injections)**: Vials, doses, protocols, consent, IOP pre/post injection, complications, cumulative dose tracking.
- **Surgery**: OR scheduling, pre-op checklists, templates, equipment, post-op follow-up, surgeon analytics, complications tracking.

### Pharmacy & Lab
- **Pharmacy**: French drug DB, inventory, dispensing workflow, drug interactions, cold chain monitoring, controlled substances, therapeutic class checks.
- **Laboratory**: Orders, specimens, results, LIS integration (HL7), QC (Westgard rules), critical alerts, auto-verification.

### Optical Shop
- **Optical Shop**: Frames, lenses, contact lenses, orders, try-on photos, repairs, depot frames, warranty tracking.
- **Glasses Orders**: Prescription fulfillment, external facility dispatch, verification workflow.
- **Inventory Types**: Frame, optical lens, contact lens, reagent, lab consumable, surgical supply - all unified under `UnifiedInventory`.

### Operations
- **Appointments & Queue**: Scheduling, appointment types, public booking, kiosk check-in, real-time queues, wait time display, WebSocket updates, room assignment.
- **Multi-Clinic**: Clinic context on all operations, inventory transfers, cross-clinic reporting, consolidated dashboards.
- **Documents**: Prescriptions, Fiche Ophta, letters, consent forms, invoices, CERFA when relevant. Template-based generation with PDFKit.

### Analytics & Security
- **Analytics**: Clinical trends, glaucoma/DR analysis, RNFL progression, financial reports, queue analytics, surgeon performance.
- **Security & Compliance**: RBAC (doctor, nurse, optician, pharmacist, cashier, admin), PHI encryption at rest, audit logging (all patient/financial/config access), session handling (JWT + refresh), CSRF protection, rate limiting.
- **AI Services**: Face recognition (patient identification, duplicate detection), OCR for legacy record import.

---

## StudioVision UI System

StudioVision is the clinical consultation interface with a distinctive design:

### Color-Coded Sections
- **Pink/Rose**: Refraction data
- **Green**: IOP/Tonometry
- **Yellow**: Diagnostics/Imaging
- **Red**: Alerts/Important notices
- **Blue**: Patient information
- **Purple**: Prescriptions

### Key Components
- `StudioVisionConsultation.jsx` - Main consultation page
- `StudioVisionTabNavigation.jsx` - Tab navigation with visual indicators
- `PatientCompactDashboard.jsx` - 3-column patient summary
- `RenouvellementButtons.jsx` - Quick data reload from previous visits
- `DeviceDataBanner.jsx` - Device sync status and data availability
- `QuickActionsBar.jsx` - Common actions toolbar
- `OrthoptieQuickPanel.jsx` - Simplified orthoptic entry

### Pattern
```jsx
// StudioVision components use variant props for color-coding
<CompactCard variant="refraction">  {/* Pink */}
<CompactCard variant="iop">         {/* Green */}
<CompactCard variant="diagnostic">  {/* Yellow */}
<CompactCard variant="important">   {/* Red */}
<CompactCard variant="patient">     {/* Blue */}
```

---

## Default Behaviour: Build Complete Features

<default_to_action>
By default, implement complete, production-ready features across all necessary layers instead of only suggesting code.

For any feature request, build:
1. **Database layer**: Mongoose schema/model with validation, indexes, hooks.
2. **Service layer**: Business logic in dedicated service modules.
3. **API layer**: Express routes with auth, validation, error handling.
4. **Frontend**: React components/pages, integrated with existing architecture.
5. **UX states**: Loading, error, empty, success states.
6. **Security**: Auth checks, clinic context, audit logging when needed.
7. **Edge cases**: Handle obvious error conditions and edge cases.
</default_to_action>

If user intent is somewhat ambiguous, infer the most useful and coherent implementation consistent with MedFlow patterns, rather than asking many clarification questions.

---

## Feature Completeness Checklist

### Backend

- [ ] Mongoose model with:
  - Required fields and types
  - Indexes for frequently queried fields (clinicId, patient, date)
  - Virtuals for derived values
  - Pre/post hooks for integrity
- [ ] Service functions encapsulating business logic
- [ ] REST API routes (list, get, create, update, soft delete) where relevant
- [ ] Validation of request body/query params (express-validator)
- [ ] Auth: verify user, role, and **clinic context**
- [ ] Proper HTTP status codes and error messages (use `apiResponse.js` patterns)
- [ ] Audit logging for sensitive operations (patient, finance, config)
- [ ] Pagination and filtering for list endpoints (see `paginationService.js`)
- [ ] Transactions (MongoDB sessions) for multi-document updates

### Frontend

- [ ] React functional components with hooks
- [ ] API service functions for backend endpoints
- [ ] Forms with Yup validation
- [ ] Loading and error states (toast notifications via react-toastify)
- [ ] Empty state handling
- [ ] French labels and messages
- [ ] Responsive layout (desktop/tablet at minimum)
- [ ] Basic accessibility (ARIA, keyboard nav)
- [ ] Redux slice if global state needed

### Data Flow

```
User -> React component -> API service -> Express route -> Controller -> Service -> Mongoose model -> MongoDB
  -> Response -> React component (Redux/React Query) -> UI update
```

---

## Module-Specific Rules

### Patient Management

- Use face recognition for duplicate detection and quick check-in where applicable.
- Always associate patients with a clinic and support multi-clinic context.
- Store medical history with timestamps and user attribution.
- Support conventions (insurance/company coverage) with approval workflows.

### Clinical Exams (StudioVision & Orthoptics)

- Store exam data per eye (OD/OS/OU) with method/device.
- Use **Monoyer** for distance visual acuity, **Parinaud** for near vision.
- Support French notations: CLD, VBLM, PL+, PL-, AVL, AVC, AVP, TP (trou sténopéique).
- Support template-based documentation for common exam types.
- Link all exam records to the patient and specific visit/appointment.
- Use device sync for auto-populating measurements (autorefractor, tonometer, keratometer).

### Inventory (Pharmacy, Optical, General)

- Track stock levels, movements (IN, OUT, TRANSFER, ADJUSTMENT), batch/lot, expiry.
- Support multi-clinic stock with transfer flows and consolidated view.
- All movements must log user, timestamp, and reason.
- Use `UnifiedInventory` patterns for cross-type queries.

### IVT & Surgery

- Enforce protocol compliance (intervals, dosing, cumulative limits).
- Capture consent, pre/post checks, complications.
- Link to surgery/IVT-specific templates and analytics.
- Track surgeon performance metrics.

---

## Financial/Billing

MedFlow records payments and supports multiple payment methods.

### Payment Methods
Payment methods are defined in the Invoice model:
- `cash` - Cash payment
- `card` - Card payment (POS handled externally)
- `check` - Check payment
- `bank-transfer` - Bank transfer
- `insurance` - Insurance/convention payment
- `mobile-payment` - Generic mobile payment
- `orange-money` - Orange Money
- `mtn-money` - MTN Mobile Money
- `wave` - Wave money transfer
- `other` - Other payment methods

### Currencies
Managed via `financialValidation.js`:
- **CDF**: Franc Congolais (primary), 0 decimal places, max 1 trillion
- **USD**: US Dollar, 2 decimal places, max 500 million
- **EUR**: Euro, 2 decimal places, max 500 million

### Payment Data Model Rules

Every payment record must include:
- `patientId`
- `clinicId`
- `currency` (`"CDF" | "USD" | "EUR"`)
- `amount`
- `method` (from enum above)
- `reference` (optional; receipt/slip number)
- `receivedBy` (user who received payment)
- `receivedAt` (timestamp)

### Billing Features

- Fee schedules by clinic and convention/insurance (with price modifiers)
- Invoice generation from services rendered
- Convention billing and approval workflows (prior authorization)
- Split billing (company share vs patient share)
- Payment plans (tracking only)
- Financial dashboards: revenue, aging, per clinic/provider
- Multi-currency handling with exchange rate management

---

## Security & Compliance

- Role-based access control (doctor, nurse, optician, pharmacist, cashier, admin, etc.)
- PHI encryption at rest (see `phiEncryption.js`)
- Strict session handling (JWT access + refresh tokens, configurable expiry)
- CSRF protection (cookie-based tokens)
- Rate limiting on APIs (configurable per route type)
- **Audit logging** for:
  - Patient data access and changes
  - Clinical documents
  - Payments and invoices
  - User/role changes
  - System configuration changes

---

## Naming & Conventions

### Backend

- Files: `camelCase.js` (e.g., `invoiceController.js`)
- Classes/Models: `PascalCase` (e.g., `Patient`, `Invoice`)
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Collections: camelCase (e.g., `patients`, `appointments`)
- Fields: camelCase (e.g., `dateOfBirth`, `clinicId`)

### Frontend

- Components: `PascalCase.jsx` (e.g., `PatientList.jsx`)
- Hooks: `useSomething.js` (e.g., `usePatientAlerts.js`)
- Services/utils: `camelCase.js`
- Constants: `UPPER_SNAKE_CASE`
- Redux slices: `camelCaseSlice.js`

---

## Common Patterns

### Pagination

```javascript
const page  = parseInt(req.query.page)  || 1;
const limit = parseInt(req.query.limit) || 20;
const skip  = (page - 1) * limit;

const [items, total] = await Promise.all([
  Model.find(query).skip(skip).limit(limit).lean(),
  Model.countDocuments(query),
]);

return {
  items,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  },
};
```

### Clinic Context

```javascript
// Always scope queries to user's current clinic
const clinicId = req.user.currentClinicId;
const query = { clinic: clinicId, ...otherFilters };

// Or for multi-clinic access
const clinicIds = req.user.clinics;
const query = { clinic: { $in: clinicIds }, ...otherFilters };
```

### API Response Pattern

```javascript
// Use apiResponse utility
const { success, error } = require('../utils/apiResponse');

// Success
return success(res, data, 'Resource retrieved successfully');

// Error
return error(res, 'Resource not found', 404);
```

### Audit Logging

```javascript
// Automatic via middleware for sensitive routes
// Manual for specific operations:
await AuditLog.log({
  user: req.user._id,
  action: 'UPDATE',
  resource: 'patient',
  resourceId: patient._id,
  changes: { before: oldData, after: newData },
  ipAddress: req.ip
});
```

---

## Data Validation Examples

```javascript
// Visual acuity (Monoyer):
// 10/10, 9/10, 8/10, 7/10, 6/10, 5/10, 4/10, 3/10, 2/10, 1/10, 1/20, 1/50
// Special: CLD, VBLM, PL+, PL-

// Near vision (Parinaud):
// P1.5, P2, P3, P4, P5, P6, P8, P10, P14, P20

// Refraction:
// sphere/cylinder: -20.00 to +20.00, step 0.25
// axis: 0-180 degrees

// IOP: 0-60 mmHg, typical 10-21

// Currency amounts:
// CDF: integers only (no decimals)
// USD/EUR: 2 decimal places
```

---

## Internationalization

- Language: French
- Dates: `DD/MM/YYYY`
- Time: 24h format (e.g., 14:30)
- Currency display: CDF/USD/EUR, with locale-appropriate separators
- All user messages, labels, errors in French
- Medical terminology follows French conventions

---

## Performance

- Use `lean()` for read-only queries
- Index frequently queried fields (patient, clinicId, date, status)
- Paginate all list views
- Cache hot data with Redis when appropriate
- Debounce search inputs and heavy UI operations
- Use React Query for server state caching
- Virtualize long lists with @tanstack/react-virtual

---

## Device Integration Pattern

```
1. Discover devices (network scan via networkDiscoveryService or config)
2. Monitor export folder (SMB2 share, local path)
3. Detect new files (DICOM, JPEG, CSV) via chokidar/polling
4. Parse file and extract patient identifier
5. Match or prompt for patient mapping
6. Create exam/imaging record linked to patient & visit
7. Notify clinicians via WebSocket of new results
```

### Supported Adapters
- OctAdapter - OCT imaging
- SpecularMicroscopeAdapter - Specular microscopy
- Generic adapters via AdapterFactory

---

## Do / Do Not

### Always

- Build full vertical slices (DB -> service -> API -> UI)
- Enforce clinic context and permissions
- Add loading/error/empty states on UI
- Log sensitive operations for audit
- Use French for all patient-facing and staff-facing text
- Validate financial amounts with `financialValidation.js`
- Use transactions for multi-document updates

### Never

- Do not store raw card numbers or bank identifiers
- Do not skip validation or error handling "for brevity"
- Do not break multi-clinic data isolation
- Do not hardcode clinic IDs or user IDs
- Do not expose internal error details to clients
- Do not use console.log in production (use logger)

---

## Existing Scripts

The project has extensive seed and utility scripts in `backend/scripts/`:

```bash
# Setup and seeding
npm run setup           # Fresh install with core data
npm run setup:dev       # Development data
npm run setup:full      # Complete data including legacy

# Individual seeders
node scripts/seedCongo.js              # Congo-specific data
node scripts/seedClinics.js            # Clinics
node scripts/seedConventions.js        # Insurance/conventions
node scripts/seedFrenchDrugs.js        # French drug database
node scripts/seedCompleteFeeSchedule.js # Fee schedules
node scripts/seedPharmacyInventory.js  # Pharmacy stock
```

---

## Ambiguity Handling

If something is unclear, first try a reasonable assumption that:
- Respects MedFlow's domain and patterns
- Does not compromise security or compliance
- Is consistent with Congo/French context
- Follows existing code conventions

Only ask for clarification when the choice materially changes data model or workflow.

---

## Summary

You are acting as a **full-stack engineer** on **MedFlow**, a serious ophthalmology EMR used in Congo with French medical standards, Monoyer/Parinaud visual acuity scales, and CDF/USD/EUR billing. Always build complete, secure, and production-ready features that integrate cleanly into the existing architecture, with proper multi-clinic isolation, audit logging, and strong clinical focus.
