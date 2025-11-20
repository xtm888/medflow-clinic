const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllTests,
  orderTests,
  updateTestResults,
  getPendingTests,
  getTemplates,
  createTemplate,
  getStatistics,
  generateReport
} = require('../controllers/laboratoryController');

// Protect all routes
router.use(protect);

// Public routes (all authenticated users)
router.get('/tests', getAllTests);
router.get('/pending', getPendingTests);
router.get('/templates', getTemplates);
router.get('/stats', getStatistics);
router.get('/report/:visitId', generateReport);

// Protected routes (specific roles)
router.post('/tests', authorize('doctor', 'nurse', 'admin'), orderTests);
router.put('/tests/:visitId/:testId', authorize('lab_technician', 'doctor', 'admin'), updateTestResults);
router.post('/templates', authorize('admin'), createTemplate);

module.exports = router;