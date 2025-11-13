const express = require('express');
const router = express.Router();
const { generateAuditReport } = require('../middleware/auditLogger');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes and require admin role
router.use(protect);
router.use(authorize('admin'));

// Routes
router.get('/report', generateAuditReport);

module.exports = router;