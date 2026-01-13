# Technical Concerns

**Analysis Date:** 2026-01-13

## Technical Debt

### Large Files Requiring Refactoring

Several model and controller files have grown excessively large, making maintenance difficult:

**Backend Models (2000+ lines):**
- `backend/models/Invoice.js` (2860 lines) - Complex billing logic embedded in model
- `backend/models/Patient.js` (2622 lines) - Patient model with extensive virtuals and hooks
- `backend/models/Visit.js` (2063 lines) - Visit model with many computed fields
- `backend/models/OphthalmologyExam.js` (2000+ lines) - Clinical exam with all subspecialties

**Backend Controllers (1000+ lines):**
- `backend/controllers/ophthalmology/coreController.js` (1500+ lines)
- `backend/controllers/pharmacyController.js` (1200+ lines)
- `backend/controllers/opticalShopController.js` (1100+ lines)

**Recommendation:** Extract business logic into service layer, split large models into base + extensions pattern.

### Missing Test Coverage

Critical areas lacking automated tests:

**Backend:**
- Financial calculations in `backend/utils/financialValidation.js`
- PHI encryption/decryption in `backend/utils/phiEncryption.js`
- Payment processing flows
- Multi-clinic data isolation middleware
- Device adapter implementations in `backend/services/adapters/`

**Frontend:**
- StudioVision consultation workflow components
- Form validation logic across clinical forms
- Offline sync conflict resolution
- Complex state management in Redux slices

**Recommendation:** Prioritize tests for financial, security, and clinical data handling.

### Code Duplication

**Repeated Patterns:**
- Pagination logic duplicated across 20+ controllers
- Clinic context checking repeated in each controller
- Similar CRUD operations in multiple inventory controllers
- Date formatting/parsing logic scattered across frontend

**Files with Duplication:**
- `backend/controllers/inventory/*.js` - Similar stock movement patterns
- `frontend/src/pages/*/index.jsx` - Repeated loading/error state handling
- `backend/routes/*.js` - Similar middleware chains

**Recommendation:** Create shared utilities and higher-order functions for common patterns.

## Known Issues

### TODO/FIXME Comments

Found throughout codebase indicating incomplete implementations:

**Backend:**
- `backend/services/appointmentValidationService.js` - TODO: Add conflict detection for rooms
- `backend/controllers/billing/statistics.js` - Multiple TODO items for optimization
- `backend/services/dataSyncService.js` - TODO: Handle large batch sync better

**Frontend:**
- `frontend/src/pages/StudioVision/*.jsx` - TODO: Optimize re-renders
- `frontend/src/components/consultation/*.jsx` - TODO: Add keyboard shortcuts

**Total TODOs:** ~50+ across codebase

### Incomplete Error Handling

**Backend Gaps:**
- Some async operations lack proper try/catch blocks
- Error messages inconsistently formatted
- Missing error logging in some service methods

**Specific Files:**
- `backend/controllers/devices/*.js` - Device errors not properly propagated
- `backend/services/smb2ClientService.js` - Network errors need better handling

**Frontend Gaps:**
- Some API calls lack error boundary protection
- Toast messages not consistently shown for all error types

## Security Considerations

### Configuration Security

**Concerns:**
- `.env.example` contains placeholder secrets that could be mistaken for production values
- Some hardcoded timeout values could be security-relevant

**Recommendations:**
- Use clearly fake placeholder values in examples (e.g., `CHANGE_ME_IN_PRODUCTION`)
- Document all security-relevant configuration options

### Input Validation

**Strong Areas:**
- Express-validator used consistently for API inputs
- Mongoose schema validation in place
- NoSQL injection protection middleware active

**Areas for Review:**
- Complex nested object validation in some endpoints
- File upload validation (size, type checking)
- Query parameter sanitization for aggregation pipelines

### Session Management

**Current Implementation:**
- JWT with refresh tokens
- Redis session storage with fallback
- 2FA with replay protection

**Potential Improvements:**
- Session invalidation on password change
- Concurrent session limiting per user
- Geographic anomaly detection

## Performance Concerns

### Database Queries

**N+1 Query Patterns:**
- `backend/controllers/appointmentController.js` - Patient lookup in loops
- `backend/controllers/queueController.js` - Multiple related entity fetches

**Missing Indexes:**
- Some compound queries may benefit from additional indexes
- Large collections may need index analysis

**Recommendations:**
- Add `.populate()` optimization
- Review slow query logs in production
- Consider read replicas for reporting queries

### Frontend Performance

**Bundle Size:**
- Large component files increase initial load
- Some rarely-used features loaded eagerly

**Re-render Issues:**
- StudioVision components may re-render excessively
- Large lists without virtualization

**Recommendations:**
- Audit bundle with webpack-bundle-analyzer
- Implement more aggressive code splitting
- Add @tanstack/react-virtual for long lists

### Memory Considerations

**Backend:**
- Large file uploads processed in memory
- Some aggregation pipelines may be memory-intensive

**Frontend:**
- Dexie (IndexedDB) can grow large with cached data
- Redux store size with large datasets

## Documentation Gaps

### Missing Documentation

**API Documentation:**
- Swagger/OpenAPI present but some endpoints undocumented
- Complex query parameters not fully explained
- Error response schemas incomplete

**Code Documentation:**
- Large functions missing JSDoc
- Complex business logic without explanatory comments
- Service method contracts not documented

**Architecture Documentation:**
- Data flow diagrams would be helpful
- Deployment architecture not documented
- Integration patterns not formalized

### Outdated Documentation

**Files to Review:**
- `README.md` - May not reflect current setup process
- Inline comments in migrated code from legacy systems

## Migration/Legacy Issues

### Legacy System Data

**Data Migration Scripts:**
- Multiple import scripts for legacy systems in `backend/scripts/`
- Data format inconsistencies from different source systems
- Legacy IDs maintained for backwards compatibility

**Files:**
- `backend/scripts/importLV*.js` - LV system migration
- `backend/scripts/checkAllCareVisionData.js` - CareVision validation

### Schema Evolution

**Considerations:**
- Some fields deprecated but not removed
- Schema changes need migration scripts
- Backward compatibility maintained at cost of complexity

## Recommended Priorities

### High Priority (Security/Data Integrity)

1. Add tests for financial calculations
2. Add tests for PHI encryption
3. Review and document all security configurations
4. Audit session management flows

### Medium Priority (Maintainability)

1. Refactor large model files (Invoice, Patient, Visit)
2. Extract pagination into shared utility
3. Add error boundaries across frontend
4. Document complex business logic

### Lower Priority (Performance/Polish)

1. Optimize N+1 queries
2. Add index analysis
3. Implement frontend virtualization
4. Bundle size optimization

---

*Concerns analysis: 2026-01-13*
*Update as issues are resolved*
