const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const labOrderController = require('../controllers/laboratory');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

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
    logAction('LAB_ORDER_CREATE'),
    labOrderController.createOrder
  );

router.route('/:id')
  .get(
    authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician', 'nurse'),
    logAction('LAB_ORDER_VIEW'),
    labOrderController.getOrder
  )
  .put(
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

module.exports = router;
