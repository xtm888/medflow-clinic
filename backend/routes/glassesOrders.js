const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateStatus,
  deleteOrder,
  getPatientOrders,
  getExamOrders,
  getOrderStats
} = require('../controllers/glassesOrderController');
const { protect, authorize } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Statistics route (must be before :id routes)
router.get('/stats', authorize('admin', 'doctor', 'optometrist', 'receptionist'), getOrderStats);

// Patient and exam specific routes
router.get('/patient/:patientId', authorize('admin', 'doctor', 'optometrist', 'receptionist'), getPatientOrders);
router.get('/exam/:examId', authorize('admin', 'doctor', 'optometrist', 'receptionist'), getExamOrders);

// Main CRUD routes
router.route('/')
  .get(authorize('admin', 'doctor', 'optometrist', 'receptionist'), getOrders)
  .post(authorize('admin', 'doctor', 'optometrist'), createOrder);

router.route('/:id')
  .get(authorize('admin', 'doctor', 'optometrist', 'receptionist'), getOrder)
  .put(authorize('admin', 'doctor', 'optometrist'), updateOrder)
  .delete(authorize('admin'), deleteOrder);

// Status update route
router.put('/:id/status', authorize('admin', 'doctor', 'optometrist', 'receptionist'), updateStatus);

module.exports = router;
