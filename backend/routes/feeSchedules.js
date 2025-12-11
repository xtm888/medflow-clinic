const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const FeeSchedule = require('../models/FeeSchedule');

// @route   GET /api/fee-schedules
// @desc    Get all active fee schedules with optional filtering
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { category, department, search } = req.query;

    const query = {
      active: true,
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    };

    // Filter by category if provided
    if (category) {
      query.category = category;
    }

    // Filter by department if provided
    if (department) {
      query.department = department;
    }

    // Search by name, code, or description
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const feeSchedules = await FeeSchedule.find(query)
      .sort({ category: 1, name: 1 })
      .lean();

    res.json({
      success: true,
      count: feeSchedules.length,
      data: feeSchedules
    });
  } catch (error) {
    console.error('Error fetching fee schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fee schedules',
      error: error.message
    });
  }
});

// @route   GET /api/fee-schedules/categories
// @desc    Get unique categories for filtering
// @access  Private
router.get('/categories', protect, async (req, res) => {
  try {
    const categories = await FeeSchedule.distinct('category', {
      active: true,
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

// @route   GET /api/fee-schedules/:code
// @desc    Get single fee schedule by code
// @access  Private
router.get('/:code', protect, async (req, res) => {
  try {
    const feeSchedule = await FeeSchedule.findOne({
      code: req.params.code,
      active: true,
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    }).lean();

    if (!feeSchedule) {
      return res.status(404).json({
        success: false,
        message: 'Fee schedule not found'
      });
    }

    res.json({
      success: true,
      data: feeSchedule
    });
  } catch (error) {
    console.error('Error fetching fee schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fee schedule',
      error: error.message
    });
  }
});

module.exports = router;
