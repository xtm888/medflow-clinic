const express = require('express');
const router = express.Router();
// Import from split controller modules (maintains backward compatibility via index.js)
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateStatus,
  deleteOrder,
  getPatientOrders,
  getExamOrders,
  getOrderStats,
  generateInvoice,
  getUnbilledOrders,
  // Inventory integration
  checkInventoryAvailability,
  reserveInventory,
  releaseInventory,
  fulfillInventory,
  searchFrames,
  searchContactLenses,
  getOrderWithInventory,
  // QC Workflow
  receiveFromLab,
  performQC,
  qcOverride,
  recordDelivery,
  getPendingQC,
  getReadyForPickup,
  sendPickupReminder,
  // External Lab Integration
  exportToLab,
  getExportData,
  updateLabStatus,
  getPendingExport,
  getAwaitingFromLab
} = require('../controllers/glassesOrders');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation, logPatientDataAccess } = require('../middleware/auditLogger');

// Apply authentication to all routes
router.use(protect);

// Statistics route (must be before :id routes)
router.get('/stats', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_STATS_VIEW'), getOrderStats);

// Billing routes (must be before :id routes)
router.get('/unbilled', authorize('admin', 'receptionist', 'billing'), logAction('GLASSES_ORDER_UNBILLED_VIEW'), getUnbilledOrders);

// QC Workflow list endpoints (must be before :id routes)
router.get('/pending-qc', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_PENDING_QC_VIEW'), getPendingQC);
router.get('/ready-for-pickup', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_READY_PICKUP_VIEW'), getReadyForPickup);

// External Lab Integration list endpoints (must be before :id routes)
router.get('/pending-export', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_PENDING_EXPORT_VIEW'), getPendingExport);
router.get('/awaiting-lab', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_AWAITING_LAB_VIEW'), getAwaitingFromLab);

// Inventory search routes (must be before :id routes)
router.get('/search-frames', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_FRAME_SEARCH'), searchFrames);
router.get('/search-contact-lenses', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_CONTACT_LENS_SEARCH'), searchContactLenses);
router.post('/check-inventory', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_INVENTORY_CHECK'), checkInventoryAvailability);

// Patient and exam specific routes
router.get('/patient/:patientId', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logPatientDataAccess, logAction('GLASSES_ORDER_PATIENT_VIEW'), getPatientOrders);
router.get('/exam/:examId', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_EXAM_VIEW'), getExamOrders);

// Main CRUD routes
router.route('/')
  .get(authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_LIST'), getOrders)
  .post(authorize('admin', 'doctor', 'optometrist'), logCriticalOperation('GLASSES_ORDER_CREATE'), createOrder);

router.route('/:id')
  .get(authorize('admin', 'doctor', 'optometrist', 'receptionist'), logPatientDataAccess, logAction('GLASSES_ORDER_VIEW'), getOrder)
  .put(authorize('admin', 'doctor', 'optometrist'), logAction('GLASSES_ORDER_UPDATE'), updateOrder)
  .delete(authorize('admin'), logCriticalOperation('GLASSES_ORDER_DELETE'), deleteOrder);

// Status update route
router.put('/:id/status', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_STATUS_UPDATE'), updateStatus);

// Invoice generation route
router.post('/:id/invoice', authorize('admin', 'receptionist', 'billing'), logCriticalOperation('GLASSES_ORDER_INVOICE_GENERATE'), generateInvoice);

// Inventory management routes
router.get('/:id/with-inventory', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_INVENTORY_VIEW'), getOrderWithInventory);
router.post('/:id/reserve-inventory', authorize('admin', 'doctor', 'optometrist'), logCriticalOperation('GLASSES_ORDER_INVENTORY_RESERVE'), reserveInventory);
router.post('/:id/release-inventory', authorize('admin', 'doctor', 'optometrist'), logAction('GLASSES_ORDER_INVENTORY_RELEASE'), releaseInventory);
router.post('/:id/fulfill-inventory', authorize('admin', 'doctor', 'optometrist'), logCriticalOperation('GLASSES_ORDER_INVENTORY_FULFILL'), fulfillInventory);

// QC action endpoints
router.put('/:id/receive', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_RECEIVE'), receiveFromLab);
router.put('/:id/qc', authorize('admin', 'optometrist'), logCriticalOperation('GLASSES_ORDER_QC'), performQC);
router.put('/:id/qc-override', authorize('admin'), logCriticalOperation('GLASSES_ORDER_QC_OVERRIDE'), qcOverride);  // Admin only for override
router.put('/:id/deliver', authorize('admin', 'optometrist', 'receptionist'), logCriticalOperation('GLASSES_ORDER_DELIVER'), recordDelivery);
router.post('/:id/send-reminder', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_PICKUP_REMINDER'), sendPickupReminder);

// External Lab Integration endpoints
router.post('/:id/export-to-lab', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_EXPORT_TO_LAB'), exportToLab);
router.get('/:id/export-data', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_EXPORT_DATA_VIEW'), getExportData);
router.put('/:id/lab-status', authorize('admin', 'optometrist', 'receptionist'), logAction('GLASSES_ORDER_LAB_STATUS_UPDATE'), updateLabStatus);

module.exports = router;
