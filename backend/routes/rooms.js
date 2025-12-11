const express = require('express');
const router = express.Router();
const {
  getRooms,
  getAvailableRooms,
  getRoom,
  createRoom,
  updateRoom,
  updateRoomStatus,
  occupyRoom,
  releaseRoom,
  getDisplayBoardData,
  getRoomStats,
  deleteRoom,
  seedDefaultRooms
} = require('../controllers/roomController');

const { protect, authorize } = require('../middleware/auth');

// Public route for display boards (no auth required)
router.get('/display-board', getDisplayBoardData);

// Protect all other routes
router.use(protect);

// Room management routes
router.route('/')
  .get(getRooms)
  .post(authorize('admin'), createRoom);

router.get('/available', getAvailableRooms);
router.get('/stats', getRoomStats);
router.post('/seed', authorize('admin'), seedDefaultRooms);

router.route('/:id')
  .get(getRoom)
  .put(authorize('admin'), updateRoom)
  .delete(authorize('admin'), deleteRoom);

router.put('/:id/status', authorize('admin', 'receptionist', 'nurse'), updateRoomStatus);
router.post('/:id/occupy', authorize('admin', 'receptionist', 'nurse', 'doctor', 'ophthalmologist'), occupyRoom);
router.post('/:id/release', authorize('admin', 'receptionist', 'nurse', 'doctor', 'ophthalmologist'), releaseRoom);

module.exports = router;
