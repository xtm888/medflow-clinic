const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getReferrers,
  getReferrer,
  createReferrer,
  updateReferrer,
  deleteReferrer,
  getReferrerCommissions,
  getCommissionsReport,
  markCommissionPaid,
  calculateCommission
} = require('../controllers/referrerController');

// All routes require authentication
router.use(protect);

// Commission routes (specific routes before :id routes)
router.get('/commissions/report', authorize('admin', 'accountant', 'manager'), getCommissionsReport);
router.post('/calculate-commission', calculateCommission);
router.put('/commissions/:invoiceId/pay', authorize('admin', 'accountant'), markCommissionPaid);

// CRUD routes
router.route('/')
  .get(getReferrers)
  .post(authorize('admin', 'manager'), createReferrer);

router.route('/:id')
  .get(getReferrer)
  .put(authorize('admin', 'manager'), updateReferrer)
  .delete(authorize('admin'), deleteReferrer);

// Referrer-specific commission report
router.get('/:id/commissions', authorize('admin', 'accountant', 'manager'), getReferrerCommissions);

module.exports = router;
