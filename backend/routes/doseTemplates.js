const express = require('express');
const router = express.Router();

// ⚠️  DEPRECATED: This endpoint is deprecated
// 📍 Use /api/templates?category=dose instead
//
// This route now redirects to the unified template system.
// Migration Guide:
// - GET /dose-templates → GET /templates?category=dose
// - GET /dose-templates/by-form/:form → GET /templates?category=dose&tags=:form
// - POST /dose-templates → POST /templates (with category: 'dose')
// - PUT /dose-templates/:id → PUT /templates/:id
// - DELETE /dose-templates/:id → DELETE /templates/:id

const { protect } = require('../middleware/auth');
router.use(protect);

// Add deprecation warning header
router.use((req, res, next) => {
  res.setHeader('X-API-Warn', 'DEPRECATED: Use /api/templates?category=dose');
  res.setHeader('X-Deprecation-Date', '2025-01-01');
  res.setHeader('X-Sunset-Date', '2025-06-01');
  console.warn(`[DEPRECATED] ${req.method} /api/dose-templates${req.path} → Use /api/templates?category=dose`);
  next();
});

// Redirect to unified template system
router.all('*', (req, res) => {
  let redirectPath;

  if (req.path === '/' || req.path === '') {
    // List/Create operations
    redirectPath = '/api/templates?category=dose';
  } else if (req.path.startsWith('/by-form/')) {
    // Form-specific templates
    const form = req.path.split('/')[2];
    redirectPath = `/api/templates?category=dose&tags=${form}`;
  } else {
    // Single template operations
    redirectPath = `/api/templates${req.path}`;
  }

  // Preserve query parameters
  if (Object.keys(req.query).length > 0 && !redirectPath.includes('?')) {
    const queryString = new URLSearchParams(req.query).toString();
    redirectPath += (redirectPath.includes('?') ? '&' : '?') + queryString;
  }

  res.redirect(307, redirectPath); // 307 preserves HTTP method
});

module.exports = router;
