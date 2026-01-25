const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const labOrderController = require('../controllers/laboratory');
const labBillingController = require('../controllers/laboratory/billing');
const preEmptiveController = require('../controllers/laboratory/preEmptiveController');
const { optionalClinic } = require('../middleware/clinicAuth');
const {
  validateLabOrderCreate,
  validateObjectIdParam
} = require('../middleware/validation');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// ============================================
// PRE-EMPTIVE LAB ORDER ROUTES (Point-of-Care Optimization)
// ============================================

// Request lab order with smart merge and instant label printing
router.post('/preemptive',
  authorize('admin', 'doctor', 'ophthalmologist'),
  logAction('LAB_ORDER_PREEMPTIVE'),
  preEmptiveController.requestPreEmptiveOrder
);

// Check merge opportunities before ordering
router.get('/preemptive/check-merge/:patientId',
  authorize('admin', 'doctor', 'ophthalmologist'),
  preEmptiveController.checkMergeOpportunities
);

// Get pre-emptive order configuration
router.get('/preemptive/config',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  preEmptiveController.getPreEmptiveConfig
);

// Get pending critical results for current user
router.get('/preemptive/critical-pending',
  authorize('admin', 'doctor', 'ophthalmologist'),
  preEmptiveController.getPendingCriticalResults
);

// Acknowledge critical lab result
router.post('/preemptive/acknowledge-critical/:resultId',
  authorize('admin', 'doctor', 'ophthalmologist'),
  logCriticalOperation('LAB_CRITICAL_ACKNOWLEDGE'),
  preEmptiveController.acknowledgeCriticalResult
);

// Reprint label for existing order
router.post('/preemptive/:orderId/reprint-label',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'lab_technician'),
  logAction('LAB_LABEL_REPRINT'),
  preEmptiveController.reprintLabel
);

// ============================================
// LAB ORDER ROUTES
// ============================================

// Get pending orders (before :id routes to prevent conflicts)
router.get('/pending',
  authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician', 'nurse'),
  labOrderController.getPendingOrders
);

// Check-in routes (before :id routes)
router.get('/scheduled-today',
  authorize('admin', 'lab_technician', 'nurse', 'receptionist'),
  labOrderController.getScheduledToday
);

router.get('/checked-in',
  authorize('admin', 'lab_technician', 'nurse'),
  labOrderController.getCheckedIn
);

router.get('/rejection-stats',
  authorize('admin', 'lab_technician', 'doctor'),
  labOrderController.getRejectionStats
);

// ============================================
// PENALTY MANAGEMENT ROUTES
// ============================================

// Get penalty statistics (Admin)
router.get('/penalty-stats',
  authorize('admin'),
  labOrderController.getPenaltyStats
);

// Manually run penalty check (Admin)
router.post('/run-penalty-check',
  authorize('admin'),
  logCriticalOperation('LAB_PENALTY_CHECK_MANUAL'),
  labOrderController.runPenaltyCheck
);

// Get rejected lab orders awaiting rescheduling (for reception)
router.get('/rejected-awaiting-reschedule',
  authorize('admin', 'receptionist', 'lab_technician', 'nurse'),
  labOrderController.getRejectedAwaitingReschedule
);

// Get patient lab order history
router.get('/patient/:patientId',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  labOrderController.getPatientOrders
);

// Get order by barcode
router.get('/barcode/:barcode',
  authorize('admin', 'lab_technician'),
  labOrderController.getOrderByBarcode
);

// Statistics
router.get('/stats',
  authorize('admin', 'lab_technician', 'doctor'),
  labOrderController.getStatistics
);

// Main order CRUD routes
router.route('/')
  .get(
    authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician', 'nurse'),
    logAction('LAB_ORDER_VIEW'),
    labOrderController.getOrders
  )
  .post(
    authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
    validateLabOrderCreate,
    logAction('LAB_ORDER_CREATE'),
    labOrderController.createOrder
  );

router.route('/:id')
  .get(
    validateObjectIdParam,
    authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician', 'nurse'),
    logAction('LAB_ORDER_VIEW'),
    labOrderController.getOrder
  )
  .put(
    validateObjectIdParam,
    authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician'),
    logAction('LAB_ORDER_UPDATE'),
    labOrderController.updateOrder
  );

// Order workflow routes
router.put('/:id/collect',
  authorize('admin', 'lab_technician', 'nurse'),
  logAction('LAB_SPECIMEN_COLLECT'),
  labOrderController.collectSpecimen
);

router.put('/:id/receive',
  authorize('admin', 'lab_technician'),
  logAction('LAB_SPECIMEN_RECEIVE'),
  labOrderController.receiveSpecimen
);

router.put('/:id/cancel',
  authorize('admin', 'doctor', 'ophthalmologist'),
  logAction('LAB_ORDER_CANCEL'),
  labOrderController.cancelOrder
);

// Check-in patient for specimen collection
router.put('/:id/check-in',
  authorize('admin', 'lab_technician', 'nurse', 'receptionist'),
  logAction('LAB_PATIENT_CHECKIN'),
  labOrderController.checkInPatient
);

// Reject and reschedule with penalty
router.put('/:id/reject-reschedule',
  authorize('admin', 'lab_technician', 'nurse'),
  logAction('LAB_ORDER_REJECT'),
  labOrderController.rejectAndReschedule
);

// Reschedule after rejection (for reception - after penalty is paid)
router.put('/:id/reschedule',
  authorize('admin', 'receptionist', 'nurse'),
  logAction('LAB_ORDER_RESCHEDULE'),
  labOrderController.rescheduleAfterRejection
);

// Waive penalty for a lab order (Admin only)
router.put('/:id/waive-penalty',
  authorize('admin'),
  logCriticalOperation('LAB_PENALTY_WAIVE'),
  labOrderController.waivePenalty
);

// ============================================
// LAB BILLING ROUTES
// ============================================

// Generate invoice for lab order (with transaction support)
router.post('/:id/invoice',
  authorize('admin', 'cashier', 'billing'),
  logCriticalOperation('LAB_INVOICE_CREATE'),
  labBillingController.generateLabOrderInvoice
);

module.exports = router;
