const express = require('express');
const router = express.Router();
const treatmentProtocolController = require('../controllers/treatmentProtocolController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/treatment-protocols - Get user's protocols (personal + system-wide)
router.get('/',
  treatmentProtocolController.getTreatmentProtocols
);

// GET /api/treatment-protocols/popular - Get popular protocols
router.get('/popular',
  treatmentProtocolController.getPopularProtocols
);

// GET /api/treatment-protocols/favorites - Get user's favorite protocols
router.get('/favorites',
  treatmentProtocolController.getFavoriteProtocols
);

// =====================================================
// STUDIOVISION PARITY - ENHANCED ROUTES
// =====================================================

// GET /api/treatment-protocols/categories - Get all categories with counts
router.get('/categories',
  treatmentProtocolController.getCategories
);

// GET /api/treatment-protocols/category/:category - Get protocols by category
router.get('/category/:category',
  treatmentProtocolController.getProtocolsByCategory
);

// GET /api/treatment-protocols/diagnosis/:icdCode - Get protocols for diagnosis
router.get('/diagnosis/:icdCode',
  treatmentProtocolController.getProtocolsForDiagnosis
);

// POST /api/treatment-protocols/:id/apply - Apply protocol (get prescription-ready meds)
router.post('/:id/apply',
  authorize(['doctor', 'ophthalmologist', 'admin']),
  treatmentProtocolController.applyProtocol
);

// POST /api/treatment-protocols/:id/duplicate - Duplicate protocol for personalization
router.post('/:id/duplicate',
  authorize(['doctor', 'ophthalmologist', 'admin']),
  treatmentProtocolController.duplicateProtocol
);

// =====================================================
// STANDARD CRUD ROUTES
// =====================================================

// GET /api/treatment-protocols/:id - Get single protocol
router.get('/:id',
  treatmentProtocolController.getTreatmentProtocolById
);

// POST /api/treatment-protocols - Create new protocol
router.post('/',
  authorize(['doctor', 'ophthalmologist', 'admin']),
  treatmentProtocolController.createTreatmentProtocol
);

// PUT /api/treatment-protocols/:id - Update protocol
router.put('/:id',
  authorize(['doctor', 'ophthalmologist', 'admin']),
  treatmentProtocolController.updateTreatmentProtocol
);

// DELETE /api/treatment-protocols/:id - Delete protocol
router.delete('/:id',
  authorize(['doctor', 'ophthalmologist', 'admin']),
  treatmentProtocolController.deleteTreatmentProtocol
);

// POST /api/treatment-protocols/:id/use - Increment usage count
router.post('/:id/use',
  treatmentProtocolController.incrementUsage
);

// POST /api/treatment-protocols/:id/favorite - Toggle favorite
router.post('/:id/favorite',
  authorize(['doctor', 'ophthalmologist']),
  treatmentProtocolController.toggleFavorite
);

module.exports = router;
