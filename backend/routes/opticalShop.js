const express = require('express');
const router = express.Router();
const opticalShopController = require('../controllers/opticalShopController');
const tryOnPhotoController = require('../controllers/tryOnPhotoController');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation, logPatientDataAccess } = require('../middleware/auditLogger');
const { uploads, handleUploadError } = require('../middleware/fileUpload');

// All routes require authentication
router.use(protect);

// ============================================================
// DASHBOARD & PATIENT LOOKUP
// ============================================================

// Get dashboard stats (opticians & technicians)
router.get('/dashboard', logAction('OPTICAL_SHOP_DASHBOARD_VIEW'), opticalShopController.getDashboardStats);

// Search patients for optical shop
router.get('/patients/search', logAction('OPTICAL_SHOP_PATIENT_SEARCH'), opticalShopController.searchPatients);

// Get patient convention info for optical services
router.get('/patients/:patientId/convention', logPatientDataAccess, logAction('OPTICAL_SHOP_CONVENTION_VIEW'), opticalShopController.getPatientConventionInfo);

// Get patient prescription/refraction
router.get('/patients/:patientId/prescription', logPatientDataAccess, logAction('OPTICAL_SHOP_PRESCRIPTION_VIEW'), opticalShopController.getPatientPrescription);

// ============================================================
// SALES WORKFLOW (Opticians)
// ============================================================

// Start a new sale
router.post('/sales',
  authorize('admin', 'optician', 'receptionist', 'ophthalmologist'),
  logCriticalOperation('OPTICAL_SALE_START'),
  opticalShopController.startSale
);

// Update sale order
router.put('/sales/:id',
  authorize('admin', 'optician', 'receptionist'),
  logAction('OPTICAL_SALE_UPDATE'),
  opticalShopController.updateSale
);

// Check lens/frame availability
router.post('/sales/:id/check-availability',
  authorize('admin', 'optician', 'technician'),
  logAction('OPTICAL_AVAILABILITY_CHECK'),
  opticalShopController.checkAvailability
);

// Submit for technician verification
router.post('/sales/:id/submit',
  authorize('admin', 'optician', 'receptionist'),
  logAction('OPTICAL_SALE_SUBMIT'),
  opticalShopController.submitForVerification
);

// ============================================================
// TECHNICIAN VERIFICATION
// ============================================================

// Get verification queue
router.get('/verification/queue',
  authorize('admin', 'technician', 'optician', 'manager'),
  logAction('OPTICAL_VERIFICATION_QUEUE_VIEW'),
  opticalShopController.getVerificationQueue
);

// Get order details for verification
router.get('/verification/:id',
  authorize('admin', 'technician', 'optician', 'manager'),
  logAction('OPTICAL_VERIFICATION_VIEW'),
  opticalShopController.getOrderForVerification
);

// Approve verification
router.post('/verification/:id/approve',
  authorize('admin', 'technician'),
  logCriticalOperation('OPTICAL_VERIFICATION_APPROVE'),
  opticalShopController.approveVerification
);

// Reject verification
router.post('/verification/:id/reject',
  authorize('admin', 'technician'),
  logCriticalOperation('OPTICAL_VERIFICATION_REJECT'),
  opticalShopController.rejectVerification
);

// ============================================================
// EXTERNAL ORDERS
// ============================================================

// Get external order queue
router.get('/external-orders',
  authorize('admin', 'technician', 'optician', 'manager'),
  logAction('OPTICAL_EXTERNAL_ORDER_VIEW'),
  opticalShopController.getExternalOrderQueue
);

// Update external order status
router.put('/external-orders/:id',
  authorize('admin', 'technician', 'manager'),
  logAction('OPTICAL_EXTERNAL_ORDER_UPDATE'),
  opticalShopController.updateExternalOrder
);

// Mark items as received
router.post('/external-orders/:id/receive',
  authorize('admin', 'technician', 'manager'),
  logCriticalOperation('OPTICAL_EXTERNAL_ORDER_RECEIVE'),
  opticalShopController.receiveExternalOrder
);

// ============================================================
// BILLING & INVOICING
// ============================================================

// Get unbilled orders
router.get('/billing/unbilled',
  authorize('admin', 'receptionist', 'billing', 'caissier'),
  logAction('OPTICAL_UNBILLED_VIEW'),
  opticalShopController.getUnbilledOrders
);

// Generate invoice for order
router.post('/orders/:id/invoice',
  authorize('admin', 'receptionist', 'billing', 'caissier'),
  logCriticalOperation('OPTICAL_INVOICE_GENERATE'),
  opticalShopController.generateInvoice
);

// ============================================================
// PERFORMANCE METRICS
// ============================================================

// Get optician performance
router.get('/performance',
  authorize('admin', 'manager'),
  logAction('OPTICAL_PERFORMANCE_VIEW'),
  opticalShopController.getOpticianPerformance
);

// Get leaderboard
router.get('/leaderboard',
  logAction('OPTICAL_LEADERBOARD_VIEW'),
  opticalShopController.getOpticianLeaderboard
);

// ============================================================
// FRAME TRY-ON PHOTOS
// ============================================================

router.post('/orders/:orderId/try-on-photos',
  authorize('admin', 'optician', 'receptionist', 'ophthalmologist'),
  handleUploadError(uploads.tryOnPhotos),
  logAction('OPTICAL_TRYON_PHOTO_UPLOAD'),
  tryOnPhotoController.uploadTryOnPhotos
);

router.get('/orders/:orderId/try-on-photos',
  logAction('OPTICAL_TRYON_PHOTOS_VIEW'),
  tryOnPhotoController.getTryOnPhotos
);

router.delete('/orders/:orderId/try-on-photos/:photoSetId',
  authorize('admin', 'optician'),
  logCriticalOperation('OPTICAL_TRYON_PHOTO_DELETE'),
  tryOnPhotoController.deleteTryOnPhotos
);

router.put('/orders/:orderId/try-on-photos/:photoSetId/select',
  authorize('admin', 'optician', 'receptionist'),
  logAction('OPTICAL_TRYON_FRAME_SELECT'),
  tryOnPhotoController.selectFrame
);

// ============================================================
// DEPOT INVENTORY REQUESTS
// ============================================================

// Get depot inventory available for request
router.get('/depot-inventory',
  authorize('admin', 'optician', 'manager', 'receptionist'),
  logAction('OPTICAL_DEPOT_INVENTORY_VIEW'),
  opticalShopController.getDepotInventory
);

// Request frames from depot
router.post('/request-from-depot',
  authorize('admin', 'optician', 'manager'),
  logCriticalOperation('OPTICAL_DEPOT_REQUEST'),
  opticalShopController.requestFromDepot
);

module.exports = router;
