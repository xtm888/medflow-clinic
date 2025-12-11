const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const clinicController = require('../controllers/clinicController');

// Protect all routes
router.use(protect);

// ============================================
// PUBLIC ROUTES (all authenticated users)
// ============================================

// Get clinics for dropdown
router.get('/dropdown', clinicController.getClinicsForDropdown);

// Get user's accessible clinics
router.get('/my-clinics', clinicController.getMyClinics);

// ============================================
// CLINIC CRUD (Admin/Manager)
// ============================================

router.route('/')
  .get(authorize('admin', 'manager', 'doctor', 'ophthalmologist'), clinicController.getClinics)
  .post(authorize('admin'), clinicController.createClinic);

router.route('/:id')
  .get(authorize('admin', 'manager', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'), clinicController.getClinic)
  .put(authorize('admin'), clinicController.updateClinic)
  .delete(authorize('admin'), clinicController.deleteClinic);

// ============================================
// CLINIC STAFF MANAGEMENT
// ============================================

router.get('/:id/staff',
  authorize('admin', 'manager'),
  clinicController.getClinicStaff
);

router.post('/:id/staff/:userId',
  authorize('admin'),
  clinicController.assignUserToClinic
);

router.delete('/:id/staff/:userId',
  authorize('admin'),
  clinicController.removeUserFromClinic
);

// ============================================
// STATISTICS
// ============================================

router.get('/stats/summary',
  authorize('admin', 'manager'),
  clinicController.getAllClinicsStats
);

router.get('/:id/stats',
  authorize('admin', 'manager', 'doctor', 'ophthalmologist'),
  clinicController.getClinicStats
);

module.exports = router;
