const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Correspondence = require('../models/Correspondence');

// All routes require authentication
router.use(protect);

// @desc    Create new correspondence
// @route   POST /api/correspondence
// @access  Private (Admin, Doctor, Ophthalmologist, Nurse)
router.post('/', authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), async (req, res) => {
  try {
    const correspondence = await Correspondence.create({
      ...req.body,
      createdBy: req.user._id
    });

    const populated = await Correspondence.findById(correspondence._id)
      .populate('patient', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: populated
    });
  } catch (error) {
    console.error('Error creating correspondence:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get correspondence history for patient
// @route   GET /api/correspondence/patient/:patientId
// @access  Private (Admin, Doctor, Ophthalmologist, Nurse, Receptionist)
router.get('/patient/:patientId', authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const correspondence = await Correspondence.getHistory(req.params.patientId, req.query.limit);

    res.json({
      success: true,
      data: correspondence
    });
  } catch (error) {
    console.error('Error fetching correspondence:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Send correspondence
// @route   POST /api/correspondence/:id/send
// @access  Private (Admin, Doctor, Ophthalmologist, Nurse)
router.post('/:id/send', authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), async (req, res) => {
  try {
    const correspondence = await Correspondence.findById(req.params.id);

    if (!correspondence) {
      return res.status(404).json({
        success: false,
        error: 'Correspondence not found'
      });
    }

    await correspondence.send(req.user._id, req.body.method);

    res.json({
      success: true,
      data: correspondence
    });
  } catch (error) {
    console.error('Error sending correspondence:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;