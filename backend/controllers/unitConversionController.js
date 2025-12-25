const UnitConversion = require('../models/UnitConversion');
const { createContextLogger } = require('../utils/structuredLogger');
const logger = createContextLogger('UnitConversionController');

/**
 * Unit Conversion Controller
 * Gestion des conversions d'unités SI/conventionnelles
 */

// @desc    Get all unit conversions
// @route   GET /api/unit-conversions
exports.getConversions = async (req, res) => {
  try {
    const { category, search } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { testCode: { $regex: search, $options: 'i' } },
        { testName: { $regex: search, $options: 'i' } }
      ];
    }

    const conversions = await UnitConversion.find(query)
      .sort({ category: 1, testCode: 1 });

    res.json({
      success: true,
      count: conversions.length,
      data: conversions
    });
  } catch (error) {
    logger.error('Error fetching unit conversions', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des conversions',
      error: error.message
    });
  }
};

// @desc    Get single conversion by test code
// @route   GET /api/unit-conversions/:testCode
exports.getConversion = async (req, res) => {
  try {
    const conversion = await UnitConversion.findOne({
      testCode: req.params.testCode.toUpperCase(),
      isActive: true
    });

    if (!conversion) {
      return res.status(404).json({
        success: false,
        message: 'Conversion non trouvée pour ce test'
      });
    }

    res.json({
      success: true,
      data: conversion
    });
  } catch (error) {
    logger.error('Error fetching unit conversion', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la conversion',
      error: error.message
    });
  }
};

// @desc    Convert a value
// @route   POST /api/unit-conversions/convert
exports.convertValue = async (req, res) => {
  try {
    const { testCode, value, fromUnit, toUnit } = req.body;

    if (!testCode || value === undefined || !fromUnit || !toUnit) {
      return res.status(400).json({
        success: false,
        message: 'testCode, value, fromUnit et toUnit sont requis'
      });
    }

    const conversion = await UnitConversion.findForTest(testCode);

    if (!conversion) {
      return res.status(404).json({
        success: false,
        message: `Aucune conversion trouvée pour ${testCode}`
      });
    }

    try {
      const result = conversion.convert(parseFloat(value), fromUnit, toUnit);

      res.json({
        success: true,
        data: {
          originalValue: parseFloat(value),
          originalUnit: fromUnit,
          convertedValue: result,
          convertedUnit: toUnit,
          testCode: conversion.testCode,
          testName: conversion.testName
        }
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  } catch (error) {
    logger.error('Error converting value', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la conversion',
      error: error.message
    });
  }
};

// @desc    Batch convert values
// @route   POST /api/unit-conversions/batch-convert
exports.batchConvert = async (req, res) => {
  try {
    const { conversions } = req.body;

    if (!Array.isArray(conversions) || conversions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Un tableau de conversions est requis'
      });
    }

    const results = [];

    for (const item of conversions) {
      const { testCode, value, fromUnit, toUnit } = item;

      try {
        const conversion = await UnitConversion.findForTest(testCode);

        if (!conversion) {
          results.push({
            testCode,
            success: false,
            error: 'Conversion non trouvée'
          });
          continue;
        }

        const convertedValue = conversion.convert(parseFloat(value), fromUnit, toUnit);

        results.push({
          testCode,
          success: true,
          originalValue: parseFloat(value),
          originalUnit: fromUnit,
          convertedValue,
          convertedUnit: toUnit
        });
      } catch (err) {
        results.push({
          testCode,
          success: false,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Error batch converting', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la conversion par lot',
      error: error.message
    });
  }
};

// @desc    Get available units for a test
// @route   GET /api/unit-conversions/:testCode/units
exports.getAvailableUnits = async (req, res) => {
  try {
    const conversion = await UnitConversion.findForTest(req.params.testCode);

    if (!conversion) {
      return res.status(404).json({
        success: false,
        message: `Aucune conversion trouvée pour ${req.params.testCode}`
      });
    }

    const units = conversion.getAvailableUnits();

    res.json({
      success: true,
      data: {
        testCode: conversion.testCode,
        testName: conversion.testName,
        primaryUnit: conversion.primaryUnit,
        primaryUnitType: conversion.primaryUnitType,
        units
      }
    });
  } catch (error) {
    logger.error('Error getting available units', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des unités',
      error: error.message
    });
  }
};

// @desc    Create unit conversion
// @route   POST /api/unit-conversions
exports.createConversion = async (req, res) => {
  try {
    // Check for duplicate
    const existing = await UnitConversion.findOne({
      testCode: req.body.testCode.toUpperCase()
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Une conversion existe déjà pour ${req.body.testCode}`
      });
    }

    const conversion = await UnitConversion.create({
      ...req.body,
      testCode: req.body.testCode.toUpperCase(),
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Conversion créée avec succès',
      data: conversion
    });
  } catch (error) {
    logger.error('Error creating unit conversion', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la conversion',
      error: error.message
    });
  }
};

// @desc    Update unit conversion
// @route   PUT /api/unit-conversions/:testCode
exports.updateConversion = async (req, res) => {
  try {
    let conversion = await UnitConversion.findOne({
      testCode: req.params.testCode.toUpperCase()
    });

    if (!conversion) {
      return res.status(404).json({
        success: false,
        message: 'Conversion non trouvée'
      });
    }

    conversion = await UnitConversion.findOneAndUpdate(
      { testCode: req.params.testCode.toUpperCase() },
      {
        ...req.body,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Conversion mise à jour avec succès',
      data: conversion
    });
  } catch (error) {
    logger.error('Error updating unit conversion', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la conversion',
      error: error.message
    });
  }
};

// @desc    Delete unit conversion (soft delete)
// @route   DELETE /api/unit-conversions/:testCode
exports.deleteConversion = async (req, res) => {
  try {
    const conversion = await UnitConversion.findOne({
      testCode: req.params.testCode.toUpperCase()
    });

    if (!conversion) {
      return res.status(404).json({
        success: false,
        message: 'Conversion non trouvée'
      });
    }

    conversion.isActive = false;
    conversion.updatedBy = req.user.id;
    await conversion.save();

    res.json({
      success: true,
      message: 'Conversion supprimée'
    });
  } catch (error) {
    logger.error('Error deleting unit conversion', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la conversion',
      error: error.message
    });
  }
};

// @desc    Seed common conversions
// @route   POST /api/unit-conversions/seed
exports.seedConversions = async (req, res) => {
  try {
    const result = await UnitConversion.seedCommonConversions();

    res.json({
      success: true,
      message: `${result.created} conversions créées, ${result.skipped} existantes ignorées`,
      data: result
    });
  } catch (error) {
    logger.error('Error seeding conversions', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors du seeding des conversions',
      error: error.message
    });
  }
};

// @desc    Get categories
// @route   GET /api/unit-conversions/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await UnitConversion.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.filter(c => c) // Remove null/undefined
    });
  } catch (error) {
    logger.error('Error getting categories', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des catégories',
      error: error.message
    });
  }
};

// @desc    Get conversion factor between units
// @route   GET /api/unit-conversions/:testCode/factor
exports.getConversionFactor = async (req, res) => {
  try {
    const { fromUnit, toUnit } = req.query;

    if (!fromUnit || !toUnit) {
      return res.status(400).json({
        success: false,
        message: 'fromUnit et toUnit sont requis'
      });
    }

    const conversion = await UnitConversion.findForTest(req.params.testCode);

    if (!conversion) {
      return res.status(404).json({
        success: false,
        message: `Aucune conversion trouvée pour ${req.params.testCode}`
      });
    }

    try {
      const factor = conversion.getConversionFactor(fromUnit, toUnit);

      res.json({
        success: true,
        data: {
          testCode: conversion.testCode,
          fromUnit,
          toUnit,
          factor,
          formula: `${fromUnit} × ${factor} = ${toUnit}`
        }
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  } catch (error) {
    logger.error('Error getting conversion factor', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du facteur de conversion',
      error: error.message
    });
  }
};
