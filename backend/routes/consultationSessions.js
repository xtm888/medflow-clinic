const express = require('express');
const router = express.Router();
const consultationSessionController = require('../controllers/consultationSessionController');
const { protect, authorize } = require('../middleware/auth');
const { optionalClinic, requireClinic } = require('../middleware/clinicAuth');

// All routes require authentication
router.use(protect);
// MULTI-CLINIC: Apply optional clinic context to all routes
router.use(optionalClinic);

// GET /api/consultation-sessions/recent - Get recent sessions for logged-in doctor
router.get('/recent',
  consultationSessionController.getRecentSessions
);

// GET /api/consultation-sessions/active/:patientId - Get active session for patient
router.get('/active/:patientId',
  consultationSessionController.getActiveSession
);

// GET /api/consultation-sessions/:id - Get single session
router.get('/:id',
  consultationSessionController.getSessionById
);

// POST /api/consultation-sessions - Create new session
router.post('/',
  authorize('doctor', 'ophthalmologist', 'orthoptist', 'admin'),
  consultationSessionController.createSession
);

// PUT /api/consultation-sessions/:id - Update session (auto-save or manual)
router.put('/:id',
  authorize('doctor', 'ophthalmologist', 'orthoptist', 'admin'),
  consultationSessionController.updateSession
);

// POST /api/consultation-sessions/:id/complete - Complete session
router.post('/:id/complete',
  authorize('doctor', 'ophthalmologist', 'orthoptist', 'admin'),
  consultationSessionController.completeSession
);

// POST /api/consultation-sessions/:id/abandon - Abandon session
router.post('/:id/abandon',
  authorize('doctor', 'ophthalmologist', 'orthoptist', 'admin'),
  consultationSessionController.abandonSession
);

// DELETE /api/consultation-sessions/:id - Delete session
router.delete('/:id',
  authorize('doctor', 'ophthalmologist', 'orthoptist', 'admin'),
  consultationSessionController.deleteSession
);

module.exports = router;
