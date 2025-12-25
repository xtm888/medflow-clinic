---
trigger: pre-commit
description: Validation checks before committing code to MedFlow
---

# Pre-Commit Validation

Before committing, verify:

## 1. Code Quality
```bash
# Frontend linting
cd frontend && npm run lint

# Backend syntax check
cd backend && node --check server.js
```

## 2. Security Checks
- [ ] No hardcoded secrets (passwords, tokens, API keys)
- [ ] No console.log with sensitive data
- [ ] No PHI in comments or test data
- [ ] Environment variables used for configuration

## 3. Test Critical Paths
```bash
# Frontend unit tests
cd frontend && npm run test:run

# Backend constants test (quick sanity check)
cd backend && npm test -- tests/unit/constants.test.js
```

## 4. French Localization
- [ ] All new user-facing strings in French
- [ ] Date format: DD/MM/YYYY
- [ ] Currency: CDF/USD/EUR with proper formatting

## 5. Multi-Clinic Safety
- [ ] Queries include clinic context
- [ ] No global operations without clinic filter
- [ ] Audit logging for sensitive operations

## Auto-Fixes Applied
- ESLint auto-fix for formatting
- Trailing whitespace removal
- Consistent line endings
