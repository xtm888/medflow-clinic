const ReagentLot = require('../models/ReagentLot');
const LabAnalyzer = require('../models/LabAnalyzer');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const { createContextLogger } = require('../utils/structuredLogger');
const { serverError } = require('../utils/apiResponse');
const logger = createContextLogger('ReagentLotController');

/**
 * Reagent Lot Controller
 * Gestion des lots de réactifs avec valeurs de référence
 */

// @desc    Get all reagent lots
// @route   GET /api/reagent-lots
exports.getReagentLots = async (req, res) => {
  try {
    const {
      analyzer,
      testCode,
      status,
      validationStatus,
      expiringSoon,
      includeInactive
    } = req.query;

    const clinicId = req.user.clinic || req.query.clinic;

    const query = { clinic: clinicId };

    if (!includeInactive) {
      query.isActive = true;
    }
    if (analyzer) {
      query.analyzer = analyzer;
    }
    if (testCode) {
      query['test.testCode'] = testCode.toUpperCase();
    }
    if (status) {
      query.status = status;
    }
    if (validationStatus) {
      query['validation.status'] = validationStatus;
    }
    if (expiringSoon === 'true') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      query.expirationDate = {
        $gt: new Date(),
        $lte: futureDate
      };
      query.status = { $in: ['validated', 'active'] };
    }

    const lots = await ReagentLot.find(query)
      .populate('analyzer', 'name code manufacturer model')
      .populate('test.template', 'name code')
      .populate('createdBy', 'name')
      .populate('validation.validatedBy', 'name')
      .sort({ receivedDate: -1 });

    res.json({
      success: true,
      count: lots.length,
      data: lots
    });
  } catch (error) {
    logger.error('Error fetching reagent lots', { error: error.message });
    return serverError(res, 'Erreur lors de la récupération des lots de réactifs');
  }
};

// @desc    Get single reagent lot
// @route   GET /api/reagent-lots/:id
exports.getReagentLot = async (req, res) => {
  try {
    const lot = await ReagentLot.findById(req.params.id)
      .populate('analyzer', 'name code manufacturer model')
      .populate('test.template', 'name code category')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .populate('validation.validatedBy', 'name')
      .populate('validation.approvedBy', 'name')
      .populate('activatedBy', 'name')
      .populate('deactivatedBy', 'name');

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    res.json({
      success: true,
      data: lot
    });
  } catch (error) {
    logger.error('Error fetching reagent lot', { error: error.message });
    return serverError(res, 'Erreur lors de la récupération du lot');
  }
};

// @desc    Create reagent lot
// @route   POST /api/reagent-lots
exports.createReagentLot = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.body.clinic;

    // Verify analyzer exists
    const analyzer = await LabAnalyzer.findById(req.body.analyzer);
    if (!analyzer) {
      return res.status(404).json({
        success: false,
        message: 'Analyseur non trouvé'
      });
    }

    // Check for duplicate lot number for same test/analyzer
    const existing = await ReagentLot.findOne({
      clinic: clinicId,
      analyzer: req.body.analyzer,
      'test.testCode': req.body.test.testCode.toUpperCase(),
      lotNumber: req.body.lotNumber.toUpperCase(),
      isActive: true
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Le lot ${req.body.lotNumber} existe déjà pour ce test et analyseur`
      });
    }

    const lot = await ReagentLot.create({
      ...req.body,
      clinic: clinicId,
      lotNumber: req.body.lotNumber.toUpperCase(),
      'test.testCode': req.body.test.testCode.toUpperCase(),
      createdBy: req.user.id
    });

    await lot.populate('analyzer', 'name code manufacturer');

    res.status(201).json({
      success: true,
      message: 'Lot de réactif créé avec succès',
      data: lot
    });
  } catch (error) {
    logger.error('Error creating reagent lot', { error: error.message });
    return serverError(res, 'Erreur lors de la création du lot');
  }
};

// @desc    Update reagent lot
// @route   PUT /api/reagent-lots/:id
exports.updateReagentLot = async (req, res) => {
  try {
    let lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    // Don't allow updates to active lots except for certain fields
    if (lot.status === 'active') {
      const allowedFields = ['notes', 'stock', 'storageConditions', 'validatedReferenceRange', 'useValidatedRange'];
      const updateFields = Object.keys(req.body);
      const hasDisallowed = updateFields.some(f => !allowedFields.includes(f));

      if (hasDisallowed) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de modifier certains champs d\'un lot actif'
        });
      }
    }

    lot = await ReagentLot.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    ).populate('analyzer', 'name code manufacturer');

    res.json({
      success: true,
      message: 'Lot mis à jour avec succès',
      data: lot
    });
  } catch (error) {
    logger.error('Error updating reagent lot', { error: error.message });
    return serverError(res, 'Erreur lors de la mise à jour du lot');
  }
};

// @desc    Delete reagent lot (soft delete)
// @route   DELETE /api/reagent-lots/:id
exports.deleteReagentLot = async (req, res) => {
  try {
    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    if (lot.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un lot actif. Désactivez-le d\'abord.'
      });
    }

    lot.isActive = false;
    lot.updatedBy = req.user.id;
    await lot.save();

    res.json({
      success: true,
      message: 'Lot supprimé avec succès'
    });
  } catch (error) {
    logger.error('Error deleting reagent lot', { error: error.message });
    return serverError(res, 'Erreur lors de la suppression du lot');
  }
};

// @desc    Add validation result to lot
// @route   POST /api/reagent-lots/:id/validation-results
exports.addValidationResult = async (req, res) => {
  try {
    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    if (lot.validation.status === 'passed' || lot.validation.status === 'failed') {
      return res.status(400).json({
        success: false,
        message: 'La validation est déjà terminée'
      });
    }

    // Start validation if pending
    if (lot.validation.status === 'pending') {
      lot.validation.status = 'in-progress';
      lot.validation.startedAt = new Date();
      lot.status = 'validating';
    }

    lot.addValidationResult(req.body);
    lot.updatedBy = req.user.id;
    await lot.save();

    res.json({
      success: true,
      message: 'Résultat de validation ajouté',
      data: {
        results: lot.validation.results,
        summary: lot.validation.summary
      }
    });
  } catch (error) {
    logger.error('Error adding validation result', { error: error.message });
    return serverError(res, 'Erreur lors de l\'ajout du résultat');
  }
};

// @desc    Complete validation
// @route   POST /api/reagent-lots/:id/complete-validation
exports.completeValidation = async (req, res) => {
  try {
    const { approved, notes } = req.body;

    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    if (lot.validation.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'La validation doit être en cours pour être terminée'
      });
    }

    try {
      lot.completeValidation(req.user.id, approved, notes);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    lot.updatedBy = req.user.id;
    await lot.save();

    res.json({
      success: true,
      message: lot.validation.status === 'passed'
        ? 'Validation réussie - lot validé'
        : 'Validation échouée - lot rejeté',
      data: lot
    });
  } catch (error) {
    logger.error('Error completing validation', { error: error.message });
    return serverError(res, 'Erreur lors de la validation');
  }
};

// @desc    Waive validation (for urgent cases)
// @route   POST /api/reagent-lots/:id/waive-validation
exports.waiveValidation = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Une raison est requise pour dispenser de validation'
      });
    }

    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    lot.validation.status = 'waived';
    lot.validation.notes = reason;
    lot.validation.completedAt = new Date();
    lot.validation.validatedBy = req.user.id;
    lot.status = 'validated';
    lot.updatedBy = req.user.id;

    await lot.save();

    res.json({
      success: true,
      message: 'Validation dispensée',
      data: lot
    });
  } catch (error) {
    logger.error('Error waiving validation', { error: error.message });
    return serverError(res, 'Erreur lors de la dispense de validation');
  }
};

// @desc    Activate lot
// @route   POST /api/reagent-lots/:id/activate
exports.activateLot = async (req, res) => {
  try {
    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    try {
      lot.activate(req.user.id);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    lot.updatedBy = req.user.id;
    await lot.save();

    // Optionally set as active lot on analyzer
    if (req.body.setAsActiveOnAnalyzer) {
      const analyzer = await LabAnalyzer.findById(lot.analyzer);
      if (analyzer) {
        await analyzer.setActiveReagentLot(lot.test.testCode, lot._id, req.user.id);
      }
    }

    res.json({
      success: true,
      message: 'Lot activé avec succès',
      data: lot
    });
  } catch (error) {
    logger.error('Error activating lot', { error: error.message });
    return serverError(res, 'Erreur lors de l\'activation du lot');
  }
};

// @desc    Deactivate lot
// @route   POST /api/reagent-lots/:id/deactivate
exports.deactivateLot = async (req, res) => {
  try {
    const { reason } = req.body;

    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    if (lot.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Le lot n\'est pas actif'
      });
    }

    lot.status = 'depleted';
    lot.deactivatedAt = new Date();
    lot.deactivatedBy = req.user.id;
    lot.deactivationReason = reason;
    lot.updatedBy = req.user.id;

    await lot.save();

    // Remove from analyzer active lots
    await LabAnalyzer.updateOne(
      { _id: lot.analyzer },
      { $pull: { activeReagentLots: { reagentLot: lot._id } } }
    );

    res.json({
      success: true,
      message: 'Lot désactivé',
      data: lot
    });
  } catch (error) {
    logger.error('Error deactivating lot', { error: error.message });
    return serverError(res, 'Erreur lors de la désactivation du lot');
  }
};

// @desc    Record usage
// @route   POST /api/reagent-lots/:id/record-usage
exports.recordUsage = async (req, res) => {
  try {
    const { count } = req.body;

    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    lot.recordUsage(count || 1);
    await lot.save();

    res.json({
      success: true,
      data: {
        testsPerformed: lot.testsPerformed,
        currentQuantity: lot.stock.currentQuantity,
        status: lot.status
      }
    });
  } catch (error) {
    logger.error('Error recording usage', { error: error.message });
    return serverError(res, 'Erreur lors de l\'enregistrement de l\'utilisation');
  }
};

// @desc    Get reference range for a patient
// @route   GET /api/reagent-lots/:id/reference-range
exports.getReferenceRange = async (req, res) => {
  try {
    const { patientAge, patientGender } = req.query;

    const lot = await ReagentLot.findById(req.params.id);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Lot de réactif non trouvé'
      });
    }

    const range = lot.getReferenceRangeForPatient(
      patientAge ? parseFloat(patientAge) : undefined,
      patientGender
    );

    res.json({
      success: true,
      data: {
        ...range,
        lotNumber: lot.lotNumber,
        manufacturer: lot.manufacturer,
        useValidatedRange: lot.useValidatedRange
      }
    });
  } catch (error) {
    logger.error('Error getting reference range', { error: error.message });
    return serverError(res, 'Erreur lors de la récupération des valeurs de référence');
  }
};

// @desc    Get active lot for test
// @route   GET /api/reagent-lots/active/:analyzerId/:testCode
exports.getActiveLot = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.query.clinic;

    const lot = await ReagentLot.findActiveLot(
      clinicId,
      req.params.analyzerId,
      req.params.testCode
    );

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: 'Aucun lot actif trouvé pour ce test et analyseur'
      });
    }

    res.json({
      success: true,
      data: lot
    });
  } catch (error) {
    logger.error('Error getting active lot', { error: error.message });
    return serverError(res, 'Erreur lors de la récupération du lot actif');
  }
};

// @desc    Get lots expiring soon
// @route   GET /api/reagent-lots/expiring-soon
exports.getExpiringSoon = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.query.clinic;
    const daysAhead = parseInt(req.query.days) || 30;

    const lots = await ReagentLot.findExpiringSoon(clinicId, daysAhead);

    res.json({
      success: true,
      count: lots.length,
      data: lots
    });
  } catch (error) {
    logger.error('Error getting expiring lots', { error: error.message });
    return serverError(res, 'Erreur lors de la récupération des lots expirants');
  }
};

// @desc    Get lots pending validation
// @route   GET /api/reagent-lots/pending-validation
exports.getPendingValidation = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.query.clinic;

    const lots = await ReagentLot.findPendingValidation(clinicId);

    res.json({
      success: true,
      count: lots.length,
      data: lots
    });
  } catch (error) {
    logger.error('Error getting pending validation lots', { error: error.message });
    return serverError(res, 'Erreur lors de la récupération des lots en attente');
  }
};

// @desc    Get stats
// @route   GET /api/reagent-lots/stats
exports.getStats = async (req, res) => {
  try {
    const clinicId = req.user.clinic || req.query.clinic;

    const stats = await ReagentLot.aggregate([
      { $match: { clinic: clinicId, isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          validated: {
            $sum: { $cond: [{ $eq: ['$status', 'validated'] }, 1, 0] }
          },
          pendingValidation: {
            $sum: {
              $cond: [{ $in: ['$validation.status', ['pending', 'in-progress']] }, 1, 0]
            }
          },
          expired: {
            $sum: { $cond: [{ $lt: ['$expirationDate', new Date()] }, 1, 0] }
          }
        }
      }
    ]);

    // Get expiring soon count
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringSoon = await ReagentLot.countDocuments({
      clinic: clinicId,
      isActive: true,
      status: { $in: ['validated', 'active'] },
      expirationDate: {
        $gt: new Date(),
        $lte: thirtyDaysFromNow
      }
    });

    const result = stats[0] || {
      total: 0,
      active: 0,
      validated: 0,
      pendingValidation: 0,
      expired: 0
    };
    result.expiringSoon = expiringSoon;

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error getting reagent lot stats', { error: error.message });
    return serverError(res, 'Erreur lors de la récupération des statistiques');
  }
};
