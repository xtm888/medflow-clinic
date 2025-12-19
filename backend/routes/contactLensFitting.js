/**
 * Contact Lens Fitting Routes
 *
 * API endpoints for trial lens dispensing, returns, and fitting workflow.
 */

const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const controller = require('../controllers/contactLensFittingController');

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/contact-lens-fitting/dispense-trial
 * @desc    Dispense a trial lens to a patient
 * @access  Private (Doctor, Optometrist, Ophthalmologist)
 */
router.post(
  '/dispense-trial',
  authorize('admin', 'doctor', 'optometrist', 'ophthalmologist', 'orthoptist'),
  controller.dispenseTrialLens
);

/**
 * @route   POST /api/contact-lens-fitting/return-trial
 * @desc    Return a trial lens
 * @access  Private (Doctor, Optometrist, Ophthalmologist, Technician)
 */
router.post(
  '/return-trial',
  authorize('admin', 'doctor', 'optometrist', 'ophthalmologist', 'orthoptist', 'technician'),
  controller.returnTrialLens
);

/**
 * @route   GET /api/contact-lens-fitting/pending-returns
 * @desc    Get list of pending trial lens returns
 * @access  Private
 */
router.get('/pending-returns', controller.getPendingReturns);

/**
 * @route   GET /api/contact-lens-fitting/patient-history/:patientId
 * @desc    Get patient's contact lens fitting history
 * @access  Private
 */
router.get('/patient-history/:patientId', controller.getPatientHistory);

/**
 * @route   GET /api/contact-lens-fitting/trial-lenses
 * @desc    Get available trial lenses in inventory
 * @access  Private
 */
router.get('/trial-lenses', controller.getAvailableTrialLenses);

/**
 * @route   GET /api/contact-lens-fitting/stats
 * @desc    Get trial lens statistics
 * @access  Private
 */
router.get('/stats', controller.getTrialLensStats);

module.exports = router;
