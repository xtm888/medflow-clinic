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
