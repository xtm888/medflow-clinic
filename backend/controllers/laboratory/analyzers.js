const LabAnalyzer = require('../../models/LabAnalyzer');
const LaboratoryTemplate = require('../../models/LaboratoryTemplate');
const ReagentLot = require('../../models/ReagentLot');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('Analyzers');

/**
 * Lab Analyzer Controller
 * Gestion des analyseurs/instruments de laboratoire
 */

// @desc    Get all analyzers for clinic
// @route   GET /api/lab-analyzers
exports.getAnalyzers = async (req, res) => {
  try {
    const {
      status,
      analyzerType,
      manufacturer,
      includeInactive
    } = req.query;

    const clinicId = req.user.clinic || req.query.clinic;

    const query = { clinic: clinicId };

    if (!includeInactive) {
      query.isActive = true;
    }
    if (status) {
      query.status = status;
    }
    if (analyzerType) {
      query.analyzerType = analyzerType;
    }
    if (manufacturer) {
      query.manufacturer = manufacturer;
    }

    const analyzers = await LabAnalyzer.find(query)
      .populate('createdBy', 'name')
      .populate('activeReagentLots.reagentLot', 'lotNumber expirationDate status')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: analyzers.length,
      data: analyzers
    });
  } catch (error) {
    log.error('Error fetching analyzers:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyseurs',
      error: error.message
    });
  }
};

// @desc    Get single analyzer
// @route   GET /api/lab-analyzers/:id
exports.getAnalyzer = async (req, res) => {
  try {
    const analyzer = await LabAnalyzer.findById(req.params.id)
      .populate('supportedTests.template', 'name code category')
      .populate('activeReagentLots.reagentLot')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    res.json({
      success: true,
      data: analyzer
    });
  } catch (error) {
    log.error('Error fetching analyzer:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'analyseur',
      error: error.message
    });
  }
};

// @desc    Create analyzer
// @route   POST /api/lab-analyzers
exports.createAnalyzer = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.body.clinic;

    // Check for duplicate code in same clinic
    const existing = await LabAnalyzer.findOne({
      clinic: clinicId,
      code: req.body.code.toUpperCase()
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Un analyseur avec le code ${req.body.code} existe déjà`
      });
    }

    const analyzer = await LabAnalyzer.create({
      ...req.body,
      clinic: clinicId,
      code: req.body.code.toUpperCase(),
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Analyseur créé avec succès',
      data: analyzer
    });
  } catch (error) {
    log.error('Error creating analyzer:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'analyseur',
      error: error.message
    });
  }
};

// @desc    Update analyzer
// @route   PUT /api/lab-analyzers/:id
exports.updateAnalyzer = async (req, res) => {
  try {
    let analyzer = await LabAnalyzer.findById(req.params.id);

    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    // If updating code, check for duplicates
    if (req.body.code && req.body.code.toUpperCase() !== analyzer.code) {
      const existing = await LabAnalyzer.findOne({
        clinic: analyzer.clinic,
        code: req.body.code.toUpperCase(),
        _id: { $ne: analyzer._id }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Un analyseur avec le code ${req.body.code} existe déjà`
        });
      }
    }

    analyzer = await LabAnalyzer.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        code: req.body.code ? req.body.code.toUpperCase() : analyzer.code,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Analyseur mis à jour avec succès',
      data: analyzer
    });
  } catch (error) {
    log.error('Error updating analyzer:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'analyseur',
      error: error.message
    });
  }
};

// @desc    Delete analyzer (soft delete)
// @route   DELETE /api/lab-analyzers/:id
exports.deleteAnalyzer = async (req, res) => {
  try {
    const analyzer = await LabAnalyzer.findById(req.params.id);

    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    // Check if there are active reagent lots
    const activeLots = await ReagentLot.countDocuments({
      analyzer: analyzer._id,
      status: 'active',
      isActive: true
    });

    if (activeLots > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer: ${activeLots} lot(s) de réactifs actif(s) associé(s)`
      });
    }

    analyzer.isActive = false;
    analyzer.status = 'retired';
    analyzer.updatedBy = req.user.id;
    await analyzer.save();

    res.json({
      success: true,
      message: 'Analyseur désactivé avec succès'
    });
  } catch (error) {
    log.error('Error deleting analyzer:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'analyseur',
      error: error.message
    });
  }
};

// @desc    Add supported test to analyzer
// @route   POST /api/lab-analyzers/:id/tests
exports.addSupportedTest = async (req, res) => {
  try {
    const analyzer = await LabAnalyzer.findById(req.params.id);

    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    const { templateId, testCode, testName, methodName, methodCode } = req.body;

    // Check if test already exists
    const exists = analyzer.supportedTests.some(t =>
      t.testCode === testCode || (templateId && t.template?.toString() === templateId)
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Ce test est déjà supporté par cet analyseur'
      });
    }

    analyzer.supportedTests.push({
      template: templateId,
      testCode,
      testName,
      methodName,
      methodCode
    });

    analyzer.updatedBy = req.user.id;
    await analyzer.save();

    res.json({
      success: true,
      message: 'Test ajouté avec succès',
      data: analyzer
    });
  } catch (error) {
    log.error('Error adding supported test:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du test',
      error: error.message
    });
  }
};

// @desc    Remove supported test from analyzer
// @route   DELETE /api/lab-analyzers/:id/tests/:testCode
exports.removeSupportedTest = async (req, res) => {
  try {
    const analyzer = await LabAnalyzer.findById(req.params.id);

    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    analyzer.supportedTests = analyzer.supportedTests.filter(
      t => t.testCode !== req.params.testCode
    );

    analyzer.updatedBy = req.user.id;
    await analyzer.save();

    res.json({
      success: true,
      message: 'Test supprimé avec succès',
      data: analyzer
    });
  } catch (error) {
    log.error('Error removing supported test:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du test',
      error: error.message
    });
  }
};

// @desc    Update analyzer status
// @route   PUT /api/lab-analyzers/:id/status
exports.updateAnalyzerStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const analyzer = await LabAnalyzer.findById(req.params.id);

    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    const oldStatus = analyzer.status;
    analyzer.status = status;

    // Update maintenance/calibration dates based on status
    if (status === 'maintenance') {
      analyzer.lastMaintenanceDate = new Date();
    } else if (status === 'calibrating') {
      analyzer.lastCalibrationDate = new Date();
    }

    if (notes) {
      analyzer.notes = notes;
    }

    analyzer.updatedBy = req.user.id;
    await analyzer.save();

    res.json({
      success: true,
      message: `Statut changé de ${oldStatus} à ${status}`,
      data: analyzer
    });
  } catch (error) {
    log.error('Error updating analyzer status:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// @desc    Get analyzers that support a specific test
// @route   GET /api/lab-analyzers/for-test/:testCode
exports.getAnalyzersForTest = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.query.clinic;

    const analyzers = await LabAnalyzer.findForTest(clinicId, req.params.testCode);

    res.json({
      success: true,
      count: analyzers.length,
      data: analyzers
    });
  } catch (error) {
    log.error('Error fetching analyzers for test:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyseurs',
      error: error.message
    });
  }
};

// @desc    Get analyzer statistics
// @route   GET /api/lab-analyzers/stats
exports.getAnalyzerStats = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.query.clinic;

    const stats = await LabAnalyzer.aggregate([
      { $match: { clinic: clinicId, isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          maintenance: {
            $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
          },
          offline: {
            $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] }
          },
          byType: { $push: '$analyzerType' },
          byManufacturer: { $push: '$manufacturer' }
        }
      }
    ]);

    // Count by type and manufacturer
    const result = stats[0] || { total: 0, active: 0, maintenance: 0, offline: 0 };

    if (result.byType) {
      result.byType = result.byType.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
    }

    if (result.byManufacturer) {
      result.byManufacturer = result.byManufacturer.reduce((acc, mfr) => {
        acc[mfr] = (acc[mfr] || 0) + 1;
        return acc;
      }, {});
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error('Error fetching analyzer stats:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

// @desc    Set active reagent lot for a test
// @route   POST /api/lab-analyzers/:id/active-lot
exports.setActiveReagentLot = async (req, res) => {
  try {
    const { testCode, reagentLotId } = req.body;

    const analyzer = await LabAnalyzer.findById(req.params.id);
    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    // Verify reagent lot exists and is valid
    const lot = await ReagentLot.findById(reagentLotId);
    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    if (lot.status !== 'active' && lot.status !== 'validated') {
      return res.status(400).json({
        success: false,
        message: 'Le lot doit être validé ou actif pour être utilisé'
      });
    }

    if (lot.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'utiliser un lot expiré'
      });
    }

    await analyzer.setActiveReagentLot(testCode, reagentLotId, req.user.id);

    // If lot was just validated, activate it
    if (lot.status === 'validated') {
      lot.activate(req.user.id);
      await lot.save();
    }

    res.json({
      success: true,
      message: 'Lot de réactif activé avec succès',
      data: analyzer
    });
  } catch (error) {
    log.error('Error setting active reagent lot:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'activation du lot',
      error: error.message
    });
  }
};

// Aliases for backward compatibility with route names
exports.updateStatus = exports.updateAnalyzerStatus;
exports.getStats = exports.getAnalyzerStats;

module.exports = exports;
