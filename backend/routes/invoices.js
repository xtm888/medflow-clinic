const express = require('express');
const router = express.Router();

// Placeholder controller
const invoiceController = {
  getInvoices: (req, res) => res.json({ success: true, data: [] }),
  getInvoice: (req, res) => res.json({ success: true, data: {} }),
  createInvoice: (req, res) => res.status(201).json({ success: true, data: {} }),
  updateInvoice: (req, res) => res.json({ success: true, data: {} }),
  markAsPaid: (req, res) => res.json({ success: true, message: 'Invoice marked as paid' })
};

const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Routes
router
  .route('/')
  .get(invoiceController.getInvoices)
  .post(authorize('admin', 'receptionist'), invoiceController.createInvoice);

router
  .route('/:id')
  .get(invoiceController.getInvoice)
  .put(authorize('admin', 'receptionist'), invoiceController.updateInvoice);

router.put('/:id/pay', authorize('admin', 'receptionist'), invoiceController.markAsPaid);

module.exports = router;