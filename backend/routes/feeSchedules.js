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
//          Returns merged view: clinic-specific prices override templates
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { category, department, search, all, templatesOnly } = req.query;
    const { page, limit, sort } = getPaginationParams(req.query, 'category');
    const clinicId = req.user?.currentClinicId;

    const baseQuery = {
      active: true,
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    };

    // Filter by category if provided
    if (category) {
      baseQuery.category = category;
    }

    // Filter by department if provided
    if (department) {
      baseQuery.department = department;
    }

    // Search by name, code, or description
    if (search) {
      // Escape regex special characters for safety
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      baseQuery.$and = baseQuery.$and || [];
      baseQuery.$and.push({
        $or: [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { code: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } }
        ]
      });
    }

    let data;

    // If templatesOnly=true, return only templates (for admin catalog management)
    if (templatesOnly === 'true') {
      const templateQuery = { ...baseQuery, isTemplate: true };
      data = await FeeSchedule.find(templateQuery)
        .sort({ category: 1, name: 1 })
        .lean();
    }
    // If clinic context exists, return merged view (clinic prices override templates)
    else if (clinicId) {
      // Get all templates
      const templates = await FeeSchedule.find({ ...baseQuery, isTemplate: true })
        .sort({ category: 1, name: 1 })
        .lean();

      // Get clinic-specific prices
      const clinicPrices = await FeeSchedule.find({
        ...baseQuery,
        clinic: clinicId,
        isTemplate: false
      }).lean();

      // Create a map of clinic prices by code for quick lookup
      const clinicPriceMap = new Map();
      clinicPrices.forEach(price => {
        clinicPriceMap.set(price.code, price);
      });

      // Merge: clinic prices override templates
      data = templates.map(template => {
        const clinicOverride = clinicPriceMap.get(template.code);
        if (clinicOverride) {
          return {
            ...clinicOverride,
            isClinicOverride: true,
            templatePrice: template.price
          };
        }
        return {
          ...template,
          isClinicOverride: false
        };
      });
    }
    // No clinic context: return templates only
    else {
      const templateQuery = { ...baseQuery, isTemplate: true };
      data = await FeeSchedule.find(templateQuery)
        .sort({ category: 1, name: 1 })
        .lean();
    }

    // If all=true, return all without pagination
    if (all === 'true') {
      return res.json({
        success: true,
        count: data.length,
        data,
        pagination: {
          page: 1,
          limit: data.length,
          total: data.length,
          pages: 1
        }
      });
    }

    // Apply manual pagination for merged data
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    res.json({
      success: true,
      count: paginatedData.length,
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: data.length,
        pages: Math.ceil(data.length / limit)
      }
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
// @desc    Get single fee schedule by code (clinic-specific price overrides template)
// @access  Private
router.get('/:code', protect, async (req, res) => {
  try {
    const clinicId = req.user?.currentClinicId;
    const code = req.params.code.toUpperCase();

    const baseQuery = {
      code,
      active: true,
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    };

    // Try clinic-specific price first if clinic context exists
    if (clinicId) {
      const clinicPrice = await FeeSchedule.findOne({
        ...baseQuery,
        clinic: clinicId,
        isTemplate: false
      }).lean();

      if (clinicPrice) {
        // Get template price for reference
        const template = await FeeSchedule.findOne({
          ...baseQuery,
          isTemplate: true
        }).lean();

        return res.json({
          success: true,
          data: {
            ...clinicPrice,
            isClinicOverride: true,
            templatePrice: template?.price
          }
        });
      }
    }

    // Fall back to template price
    const template = await FeeSchedule.findOne({
      ...baseQuery,
      isTemplate: true
    }).lean();

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Fee schedule not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...template,
        isClinicOverride: false
      }
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
