const express = require('express');
const router = express.Router();

// ⚠️  DEPRECATED: This endpoint is deprecated
// 📍 Use /api/templates?category=comment instead
//
// This route now redirects to the unified template system.
// Migration Guide:
// - GET /comment-templates → GET /templates?category=comment
// - POST /comment-templates → POST /templates (with category: 'comment')
// - PUT /comment-templates/:id → PUT /templates/:id
// - DELETE /comment-templates/:id → DELETE /templates/:id

const { protect } = require('../middleware/auth');
router.use(protect);

// Add deprecation warning header to all responses
router.use((req, res, next) => {
  res.setHeader('X-API-Warn', 'DEPRECATED: Use /api/templates?category=comment');
  res.setHeader('X-Deprecation-Date', '2025-01-01');
  res.setHeader('X-Sunset-Date', '2025-06-01');
  console.warn(`[DEPRECATED] ${req.method} /api/comment-templates${req.path} → Use /api/templates?category=comment`);
  next();
});

// Redirect to unified template system
router.all('*', (req, res) => {
  let redirectPath;

  if (req.path === '/' || req.path === '') {
    // List/Create operations
    redirectPath = '/api/templates?category=comment';
  } else if (req.path === '/most-used') {
    redirectPath = '/api/templates/favorites?category=comment';
  } else if (req.path.startsWith('/category/')) {
    const subcat = req.path.split('/')[2];
    redirectPath = `/api/templates?category=comment&tags=${subcat}`;
  } else if (req.path.match(/^\/[^\/]+\/use$/)) {
    // Usage tracking - redirect to apply
    const id = req.path.split('/')[1];
    redirectPath = `/api/templates/${id}/apply`;
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
