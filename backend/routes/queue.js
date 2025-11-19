const express = require('express');
const router = express.Router();
const {
  getCurrentQueue,
  addToQueue,
  updateQueueStatus,
  removeFromQueue,
  callNext,
  getQueueStats
} = require('../controllers/queueController');

const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Routes
router.get('/', getCurrentQueue);
router.post('/', authorize('receptionist', 'nurse', 'admin'), addToQueue);
router.get('/stats', getQueueStats);
router.put('/:id', authorize('receptionist', 'nurse', 'doctor', 'admin'), updateQueueStatus);
router.delete('/:id', authorize('receptionist', 'nurse', 'admin'), removeFromQueue);
router.post('/next', authorize('doctor', 'nurse', 'ophthalmologist', 'admin', 'receptionist'), callNext);

module.exports = router;