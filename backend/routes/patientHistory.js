const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getCompleteProfile,
  // getTimeline, // DEPRECATED - removed, now redirects to /api/visits/timeline/:id
  getMedicalIssues,
  updateMedicalIssue,
  getProviders,
  getAuditTrail
} = require('../controllers/patientHistoryController');

// All routes require authentication
router.use(protect);

// @desc    Get complete patient profile with all history
// @route   GET /api/patients/:id/complete-profile
// @access  Private (Medical staff only)
router.get('/:id/complete-profile', authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), getCompleteProfile);

// @desc    Get patient timeline
// @route   GET /api/patients/:id/timeline
// @access  Private (Medical staff only)
// DEPRECATED: Redirect to /api/visits/timeline/:patientId (uses Visit.getTimeline() model method)
router.get('/:id/timeline', (req, res) => {
  res.setHeader('X-API-Warn', 'DEPRECATED: Use /api/visits/timeline/:patientId instead');
  res.setHeader('X-Deprecation-Date', '2025-01-01');
  res.setHeader('X-Sunset-Date', '2025-06-01');
  console.warn(`[DEPRECATED] GET /api/patients/${req.params.id}/timeline → Use /api/visits/timeline/${req.params.id}`);
  res.redirect(307, `/api/visits/timeline/${req.params.id}`);
});

// @desc    Get patient medical issues
// @route   GET /api/patients/:id/medical-issues
// @access  Private (Medical staff only)
router.get('/:id/medical-issues', authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), getMedicalIssues);

// @desc    Update medical issue status
// @route   PUT /api/patients/:id/medical-issues/:issueId
// @access  Private (Doctor, Admin)
router.put('/:id/medical-issues/:issueId', authorize('admin', 'doctor', 'ophthalmologist'), updateMedicalIssue);

// @desc    Get all providers who treated patient
// @route   GET /api/patients/:id/providers
// @access  Private (Medical staff only)
router.get('/:id/providers', authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), getProviders);

// @desc    Get patient audit trail
// @route   GET /api/patients/:id/audit
// @access  Private (Admin only)
router.get('/:id/audit', authorize('admin'), getAuditTrail);

module.exports = router;
