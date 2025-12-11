const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const imagingController = require('../controllers/imagingController');

// Protect all routes
router.use(protect);

// ============================================
// IMAGING ORDER ROUTES
// ============================================

// Get pending orders (before :id routes to prevent conflicts)
router.get('/orders/pending',
  authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse'),
  imagingController.getPendingOrders
);

// Get scheduled orders for a date
router.get('/orders/schedule/:date',
  authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse'),
  imagingController.getScheduledOrders
);

// Get patient imaging order history
router.get('/orders/patient/:patientId',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  imagingController.getPatientOrders
);

// Main order CRUD routes
router.route('/orders')
  .get(authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse'), imagingController.getOrders)
  .post(authorize('admin', 'doctor', 'ophthalmologist'), imagingController.createOrder);

router.route('/orders/:id')
  .get(authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse'), imagingController.getOrder)
  .put(authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech'), imagingController.updateOrder);

// Order workflow routes
router.put('/orders/:id/schedule',
  authorize('admin', 'imaging_tech', 'receptionist'),
  imagingController.scheduleOrder
);

router.put('/orders/:id/checkin',
  authorize('admin', 'imaging_tech', 'receptionist', 'nurse'),
  imagingController.checkInOrder
);

router.put('/orders/:id/start',
  authorize('admin', 'imaging_tech'),
  imagingController.startOrder
);

router.put('/orders/:id/complete',
  authorize('admin', 'imaging_tech'),
  imagingController.completeOrder
);

router.put('/orders/:id/cancel',
  authorize('admin', 'doctor', 'ophthalmologist'),
  imagingController.cancelOrder
);

// ============================================
// IMAGING STUDY ROUTES
// ============================================

// Get unreported studies (before :id routes)
router.get('/studies/unreported',
  authorize('admin', 'doctor', 'ophthalmologist', 'radiologist'),
  imagingController.getUnreportedStudies
);

// Get critical findings needing acknowledgment
router.get('/studies/critical-unacknowledged',
  authorize('admin', 'doctor', 'ophthalmologist'),
  imagingController.getUnacknowledgedCritical
);

// Get patient imaging study history
router.get('/studies/patient/:patientId',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  imagingController.getPatientStudies
);

// Main study CRUD routes
router.route('/studies')
  .get(authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse', 'radiologist'), imagingController.getStudies)
  .post(authorize('admin', 'imaging_tech'), imagingController.createStudy);

router.route('/studies/:id')
  .get(authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse', 'radiologist'), imagingController.getStudy);

// Report workflow routes
router.put('/studies/:id/draft-report',
  authorize('admin', 'doctor', 'ophthalmologist', 'radiologist'),
  imagingController.draftReport
);

router.put('/studies/:id/finalize-report',
  authorize('admin', 'doctor', 'ophthalmologist', 'radiologist'),
  imagingController.finalizeReport
);

router.put('/studies/:id/verify-report',
  authorize('admin', 'doctor', 'ophthalmologist'),
  imagingController.verifyReport
);

router.post('/studies/:id/addendum',
  authorize('admin', 'doctor', 'ophthalmologist', 'radiologist'),
  imagingController.addAddendum
);

router.put('/studies/:id/acknowledge-critical',
  authorize('admin', 'doctor', 'ophthalmologist'),
  imagingController.acknowledgeCritical
);

// Add image to study
router.post('/studies/:id/images',
  authorize('admin', 'imaging_tech'),
  imagingController.addImage
);

// ============================================
// STATISTICS
// ============================================

router.get('/stats',
  authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech'),
  imagingController.getStatistics
);

// ============================================
// FILE STREAMING ROUTES (Network Shares)
// ============================================

// Stream file from network share (with HTTP range support for progressive loading)
router.get('/files/stream',
  authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse'),
  imagingController.streamFile
);

// Get thumbnail (auto-generated and cached)
router.get('/files/thumbnail',
  authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse'),
  imagingController.getThumbnail
);

// Get file metadata (without content)
router.get('/files/info',
  authorize('admin', 'doctor', 'ophthalmologist', 'imaging_tech', 'nurse'),
  imagingController.getFileInfo
);

// List files in directory (admin only - for indexing)
router.get('/files/list',
  authorize('admin'),
  imagingController.listDirectoryFiles
);

// Get exam files for a patient (metadata only)
router.get('/files/patient/:patientId',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  imagingController.getPatientExamFiles
);

module.exports = router;
