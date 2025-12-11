const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const externalFacilityController = require('../controllers/externalFacilityController');

// All routes require authentication
router.use(protect);

// Summary and stats routes (before :id to avoid conflicts)
router.get('/summary', externalFacilityController.getFacilitySummary);
router.get('/by-type/:type', externalFacilityController.getFacilitiesByType);
router.get('/preferred/:serviceCode', externalFacilityController.getPreferredForService);

// CRUD operations
router.route('/')
  .get(externalFacilityController.getExternalFacilities)
  .post(authorize('admin', 'manager'), externalFacilityController.createExternalFacility);

router.route('/:id')
  .get(externalFacilityController.getExternalFacility)
  .put(authorize('admin', 'manager'), externalFacilityController.updateExternalFacility)
  .delete(authorize('admin'), externalFacilityController.deleteExternalFacility);

// Facility-specific operations
router.get('/:id/stats', externalFacilityController.getFacilityStats);
router.get('/:id/is-open', externalFacilityController.checkIfOpen);
router.post('/:id/record-referral', externalFacilityController.recordReferral);

module.exports = router;
