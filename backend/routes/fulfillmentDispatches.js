const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const fulfillmentDispatchController = require('../controllers/fulfillmentDispatchController');

// All routes require authentication
router.use(protect);

// Dashboard and summary routes (before :id to avoid conflicts)
router.get('/dashboard', fulfillmentDispatchController.getDashboard);
router.get('/stats', fulfillmentDispatchController.getStats);
router.get('/pending', fulfillmentDispatchController.getPending);
router.get('/overdue', fulfillmentDispatchController.getOverdue);
router.get('/patient/:patientId', fulfillmentDispatchController.getPatientDispatches);

// CRUD operations
router.route('/')
  .get(fulfillmentDispatchController.getDispatches)
  .post(fulfillmentDispatchController.createDispatch);

router.route('/:id')
  .get(fulfillmentDispatchController.getDispatch);

// Status and action routes
router.put('/:id/status', fulfillmentDispatchController.updateStatus);
router.post('/:id/dispatch', fulfillmentDispatchController.markDispatched);
router.post('/:id/acknowledge', fulfillmentDispatchController.recordAcknowledgment);
router.post('/:id/complete', fulfillmentDispatchController.confirmCompletion);
router.post('/:id/reminder', fulfillmentDispatchController.addReminder);

module.exports = router;
