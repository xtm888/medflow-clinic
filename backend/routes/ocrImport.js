/**
 * OCR Import Routes
 * Routes for medical imaging import with OCR processing
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ocrImportController = require('../controllers/ocrImportController');

// All routes require authentication
router.use(protect);

// Network shares and scanning
router.get('/shares', ocrImportController.getNetworkShares);
router.get('/scan', ocrImportController.scanFolder);
router.get('/preview', ocrImportController.previewPatients);

// Import operations
router.post('/import', authorize('admin', 'doctor', 'technician'), ocrImportController.startImport);
router.get('/import/:taskId/status', ocrImportController.getImportStatus);
router.post('/import/:taskId/cancel', ocrImportController.cancelImport);

// Receive results from OCR service (internal)
router.post('/results', ocrImportController.receiveOCRResults);

// Review queue
router.get('/review-queue', ocrImportController.getReviewQueue);
router.post('/review/:documentId/link', ocrImportController.linkToPatient);
router.post('/review/:documentId/skip', ocrImportController.skipDocument);

// Patient search for manual linking
router.get('/patients/search', ocrImportController.searchPatients);

module.exports = router;
