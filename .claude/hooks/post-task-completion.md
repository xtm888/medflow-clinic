---
trigger: post-task-completion
description: Verification steps after completing a development task
---

# Post-Task Verification

After completing any significant code change:

## 1. Build Verification
```bash
# Frontend builds without errors
cd frontend && npm run build

# Backend syntax valid
cd backend && node --check server.js
```

## 2. Test Suite
```bash
# Run relevant tests
cd frontend && npm run test:run
cd backend && npm test
```

## 3. Security Review (if applicable)
For changes involving:
- Authentication/authorization
- Patient data (PHI)
- Payments/invoicing
- File uploads
- API endpoints

Invoke healthcare-security-auditor agent.

## 4. Documentation
- [ ] Updated CLAUDE.md if patterns changed
- [ ] Added JSDoc comments for new functions
- [ ] Updated API documentation if endpoints changed

## 5. Multi-Clinic Testing
- [ ] Tested with different clinic contexts
- [ ] Data isolation verified
- [ ] Cross-clinic features work correctly

## 6. Congo Context Check
- [ ] Works offline (if applicable)
- [ ] Handles network errors gracefully
- [ ] Currency handling correct (CDF/USD)
