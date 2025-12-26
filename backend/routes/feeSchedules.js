const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const FeeSchedule = require('../models/FeeSchedule');
const { paginateOffset, getPaginationParams } = require('../services/paginationService');
const CONSTANTS = require('../config/constants');

// @route   GET /api/fee-schedules/public
// @desc    Get public booking services (no auth required)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    // Only return bookable services (consultations and procedures)
    const services = await FeeSchedule.find({
      active: true,
      category: { $in: ['consultation', 'procedure', 'examination', 'ophthalmology'] },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    })
      .select('name code category description defaultPrice department estimatedDuration')
      .sort({ category: 1, name: 1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      count: services.length,
      data: services.map(s => ({
        id: s._id,
        name: s.name,
        code: s.code,
        category: s.category,
        description: s.description || '',
        price: s.defaultPrice || 0,
        duration: s.estimatedDuration || 30,
        department: s.department
      }))
    });
  } catch (error) {
    console.error('Error fetching public services:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services',
      error: error.message
    });
  }
});

// @route   GET /api/fee-schedules
// @desc    Get all active fee schedules with optional filtering and pagination
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { category, department, search } = req.query;
    const { page, limit, sort } = getPaginationParams(req.query, 'category');

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
      // Escape regex special characters for safety
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { code: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } }
        ]
      });
    }

    const result = await paginateOffset(FeeSchedule, {
      filter: query,
      page,
      limit,
      sort: { category: 1, name: 1 }
    });

    res.json({
      success: true,
      count: result.data.length,
      data: result.data,
      pagination: result.pagination
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
