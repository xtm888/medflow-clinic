const express = require('express');
const router = express.Router();
const {
  getPrescriptions,
  getPrescription,
  createPrescription,
  updatePrescription,
  cancelPrescription,
  dispensePrescription,
  verifyPrescription,
  printPrescription,
  renewPrescription
} = require('../controllers/prescriptionController');

const { protect, authorize, checkPermission } = require('../middleware/auth');
const { logPrescriptionActivity } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Routes
router
  .route('/')
  .get(getPrescriptions)
  .post(
    authorize('doctor', 'ophthalmologist', 'admin'),
    logPrescriptionActivity,
    createPrescription
  );

router
  .route('/:id')
  .get(logPrescriptionActivity, getPrescription)
  .put(
    authorize('doctor', 'ophthalmologist', 'admin'),
    logPrescriptionActivity,
    updatePrescription
  );

router.put(
  '/:id/cancel',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logPrescriptionActivity,
  cancelPrescription
);

router.put(
  '/:id/dispense',
  authorize('pharmacist', 'admin'),
  logPrescriptionActivity,
  dispensePrescription
);

router.post(
  '/:id/verify',
  authorize('pharmacist', 'doctor', 'admin'),
  logPrescriptionActivity,
  verifyPrescription
);

router.get(
  '/:id/print',
  authorize('doctor', 'ophthalmologist', 'pharmacist', 'admin'),
  logPrescriptionActivity,
  printPrescription
);

router.post(
  '/:id/renew',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logPrescriptionActivity,
  renewPrescription
);

module.exports = router;