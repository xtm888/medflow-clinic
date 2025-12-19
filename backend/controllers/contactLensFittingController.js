/**
 * Contact Lens Fitting Controller
 *
 * Handles trial lens dispensing, returns, and fitting workflow tracking.
 * Integrates with ContactLensInventory for trial lens stock management.
 */

const OphthalmologyExam = require('../models/OphthalmologyExam');
const { Inventory, ContactLensInventory } = require('../models/Inventory');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const { logger } = require('../utils/structuredLogger');

/**
 * Dispense trial lens to patient
 * POST /api/contact-lens-fitting/dispense-trial
 */
exports.dispenseTrialLens = async (req, res) => {
  try {
    const {
      examId,
      eye,
      inventoryItemId,
      lotNumber,
      expectedReturnDate,
      createFollowUp,
      notes
    } = req.body;

    // Validate required fields
    if (!examId || !eye || !inventoryItemId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: examId, eye, inventoryItemId'
      });
    }

    if (!['OD', 'OS'].includes(eye)) {
      return res.status(400).json({
        success: false,
        error: 'Eye must be OD or OS'
      });
    }

    // Find and validate inventory item
    const item = await ContactLensInventory.findById(inventoryItemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found'
      });
    }

    if (!item.isTrial) {
      return res.status(400).json({
        success: false,
        error: 'This inventory item is not marked as a trial lens'
      });
    }

    // Check stock availability
    const available = item.inventory.currentStock - (item.inventory.reserved || 0);
    if (available <= 0) {
      return res.status(400).json({
        success: false,
        error: 'No trial lenses available in stock'
      });
    }

    // Find and update exam
    const exam = await OphthalmologyExam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Ophthalmology exam not found'
      });
    }

    // Initialize contactLensFitting if not present
    if (!exam.contactLensFitting) {
      exam.contactLensFitting = {
        trialLens: { OD: {}, OS: {} }
      };
    }
    if (!exam.contactLensFitting.trialLens) {
      exam.contactLensFitting.trialLens = { OD: {}, OS: {} };
    }

    // Store trial lens info on exam
    const trialLensData = {
      inventoryItemId: item._id,
      lotNumber: lotNumber || null,
      parameters: {
        brand: item.brand,
        productLine: item.productLine,
        baseCurve: item.parameters.baseCurve,
        diameter: item.parameters.diameter,
        power: item.parameters.power?.value || null,
        cylinder: item.parameters.cylinder || null,
        axis: item.parameters.axis || null
      },
      dispensedAt: new Date(),
      dispensedBy: req.user._id,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      notes
    };

    exam.contactLensFitting.trialLens[eye] = trialLensData;
    exam.contactLensFitting.trialLens.dispensed = true;

    // Create follow-up appointment if requested
    let followUpAppointment = null;
    if (createFollowUp && expectedReturnDate) {
      followUpAppointment = await Appointment.create({
        patient: exam.patient,
        type: 'contact_lens_followup',
        scheduledDate: new Date(expectedReturnDate),
        duration: 30,
        notes: `Suivi adaptation lentilles - retour lentille d'essai (${eye})`,
        createdBy: req.user._id,
        status: 'scheduled'
      });
      exam.contactLensFitting.trialLens.followUpAppointmentId = followUpAppointment._id;
    }

    await exam.save();

    // Update inventory tracking
    item.trialTracking.totalDispensed = (item.trialTracking.totalDispensed || 0) + 1;
    item.trialTracking.currentlyOut = (item.trialTracking.currentlyOut || 0) + 1;
    item.trialTracking.lastDispensedAt = new Date();

    // Add to dispensings history
    if (!item.trialTracking.dispensings) {
      item.trialTracking.dispensings = [];
    }
    item.trialTracking.dispensings.push({
      examId: exam._id,
      patientId: exam.patient,
      eye,
      dispensedBy: req.user._id,
      dispensedAt: new Date(),
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      notes
    });

    // Decrement available stock for trial
    item.inventory.currentStock = Math.max(0, item.inventory.currentStock - 1);
    item.updateStockStatus();

    // Add transaction record
    item.transactions.push({
      type: 'trial',
      quantity: 1,
      date: new Date(),
      performedBy: req.user._id,
      reference: `Exam: ${examId}`,
      notes: `Trial lens dispensed for ${eye}`,
      balanceBefore: item.inventory.currentStock + 1,
      balanceAfter: item.inventory.currentStock
    });

    await item.save();

    logger.info(`Trial lens dispensed: ${item.brand} ${item.productLine} for exam ${examId} (${eye})`);

    res.json({
      success: true,
      message: 'Trial lens dispensed successfully',
      data: {
        exam: {
          _id: exam._id,
          contactLensFitting: exam.contactLensFitting
        },
        followUpAppointment,
        inventory: {
          remainingStock: item.inventory.currentStock,
          currentlyOut: item.trialTracking.currentlyOut
        }
      }
    });
  } catch (error) {
    logger.error('Error dispensing trial lens:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error dispensing trial lens'
    });
  }
};

/**
 * Return trial lens
 * POST /api/contact-lens-fitting/return-trial
 */
exports.returnTrialLens = async (req, res) => {
  try {
    const { examId, eye, condition, notes } = req.body;

    if (!examId || !eye) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: examId, eye'
      });
    }

    const exam = await OphthalmologyExam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Ophthalmology exam not found'
      });
    }

    const trialLensData = exam.contactLensFitting?.trialLens?.[eye];
    if (!trialLensData?.inventoryItemId) {
      return res.status(400).json({
        success: false,
        error: `No trial lens found for ${eye} on this exam`
      });
    }

    if (trialLensData.returnedAt) {
      return res.status(400).json({
        success: false,
        error: 'Trial lens already returned'
      });
    }

    // Update exam with return info
    exam.contactLensFitting.trialLens[eye].returnedAt = new Date();
    exam.contactLensFitting.trialLens[eye].returnedTo = req.user._id;
    exam.contactLensFitting.trialLens[eye].returnCondition = condition || 'good';

    // Check if both eyes returned (if both were dispensed)
    const odReturned = !exam.contactLensFitting.trialLens.OD?.inventoryItemId || exam.contactLensFitting.trialLens.OD?.returnedAt;
    const osReturned = !exam.contactLensFitting.trialLens.OS?.inventoryItemId || exam.contactLensFitting.trialLens.OS?.returnedAt;
    if (odReturned && osReturned) {
      exam.contactLensFitting.trialLens.dispensed = false;
    }

    await exam.save();

    // Update inventory
    const item = await ContactLensInventory.findById(trialLensData.inventoryItemId);
    if (item) {
      item.trialTracking.currentlyOut = Math.max(0, (item.trialTracking.currentlyOut || 0) - 1);
      item.trialTracking.lastReturnedAt = new Date();

      // Update the dispensing record
      const dispensingRecord = item.trialTracking.dispensings?.find(
        d => d.examId?.toString() === examId && d.eye === eye && !d.returnedAt
      );
      if (dispensingRecord) {
        dispensingRecord.returnedAt = new Date();
        dispensingRecord.returnedTo = req.user._id;
        dispensingRecord.condition = condition || 'good';
        dispensingRecord.notes = notes || dispensingRecord.notes;
      }

      // If condition is good, return to stock
      if (!condition || condition === 'good' || condition === 'new') {
        item.inventory.currentStock += 1;
        item.updateStockStatus();

        item.transactions.push({
          type: 'returned',
          quantity: 1,
          date: new Date(),
          performedBy: req.user._id,
          reference: `Exam: ${examId}`,
          notes: `Trial lens returned (${eye}) - condition: ${condition || 'good'}`,
          balanceBefore: item.inventory.currentStock - 1,
          balanceAfter: item.inventory.currentStock
        });
      } else {
        // Damaged or lost - mark in transactions but don't return to stock
        item.transactions.push({
          type: 'damaged',
          quantity: 1,
          date: new Date(),
          performedBy: req.user._id,
          reference: `Exam: ${examId}`,
          notes: `Trial lens returned ${condition} (${eye})`,
          balanceBefore: item.inventory.currentStock,
          balanceAfter: item.inventory.currentStock
        });
      }

      await item.save();
    }

    logger.info(`Trial lens returned: exam ${examId} (${eye}) - condition: ${condition || 'good'}`);

    res.json({
      success: true,
      message: 'Trial lens returned successfully',
      data: {
        exam: {
          _id: exam._id,
          contactLensFitting: exam.contactLensFitting
        }
      }
    });
  } catch (error) {
    logger.error('Error returning trial lens:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error returning trial lens'
    });
  }
};

/**
 * Get pending trial lens returns
 * GET /api/contact-lens-fitting/pending-returns
 */
exports.getPendingReturns = async (req, res) => {
  try {
    const { clinic } = req.query;

    const query = {
      'contactLensFitting.trialLens.dispensed': true,
      $or: [
        {
          'contactLensFitting.trialLens.OD.inventoryItemId': { $exists: true },
          'contactLensFitting.trialLens.OD.returnedAt': { $exists: false }
        },
        {
          'contactLensFitting.trialLens.OS.inventoryItemId': { $exists: true },
          'contactLensFitting.trialLens.OS.returnedAt': { $exists: false }
        }
      ]
    };

    if (clinic) {
      query.clinic = clinic;
    }

    const exams = await OphthalmologyExam.find(query)
      .populate('patient', 'firstName lastName phone email patientId')
      .populate('contactLensFitting.trialLens.OD.dispensedBy', 'name')
      .populate('contactLensFitting.trialLens.OS.dispensedBy', 'name')
      .sort({ 'contactLensFitting.trialLens.OD.expectedReturnDate': 1 });

    // Calculate overdue status
    const now = new Date();
    const results = exams.map(exam => {
      const odData = exam.contactLensFitting?.trialLens?.OD;
      const osData = exam.contactLensFitting?.trialLens?.OS;

      const pendingEyes = [];
      if (odData?.inventoryItemId && !odData.returnedAt) {
        pendingEyes.push({
          eye: 'OD',
          ...odData.toObject(),
          isOverdue: odData.expectedReturnDate && new Date(odData.expectedReturnDate) < now
        });
      }
      if (osData?.inventoryItemId && !osData.returnedAt) {
        pendingEyes.push({
          eye: 'OS',
          ...osData.toObject(),
          isOverdue: osData.expectedReturnDate && new Date(osData.expectedReturnDate) < now
        });
      }

      return {
        examId: exam._id,
        patient: exam.patient,
        examDate: exam.createdAt,
        pendingEyes,
        followUpAppointmentId: exam.contactLensFitting?.trialLens?.followUpAppointmentId
      };
    });

    res.json({
      success: true,
      data: results,
      count: results.length,
      overdueCount: results.filter(r => r.pendingEyes.some(e => e.isOverdue)).length
    });
  } catch (error) {
    logger.error('Error getting pending returns:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error getting pending returns'
    });
  }
};

/**
 * Get patient's contact lens fitting history
 * GET /api/contact-lens-fitting/patient-history/:patientId
 */
exports.getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;

    const exams = await OphthalmologyExam.find({
      patient: patientId,
      'contactLensFitting': { $exists: true, $ne: null }
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('contactLensFitting createdAt visit')
      .populate('visit', 'visitDate reason');

    const history = exams.map(exam => ({
      examId: exam._id,
      date: exam.createdAt,
      visit: exam.visit,
      fitting: exam.contactLensFitting
    }));

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    logger.error('Error getting patient history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error getting patient history'
    });
  }
};

/**
 * Get available trial lenses
 * GET /api/contact-lens-fitting/trial-lenses
 */
exports.getAvailableTrialLenses = async (req, res) => {
  try {
    const { clinic, baseCurve, diameter, lensType, search } = req.query;

    const query = {
      isTrial: true,
      active: true,
      'inventory.currentStock': { $gt: 0 }
    };

    if (clinic) {
      query.clinic = clinic;
    }

    if (baseCurve) {
      query['parameters.baseCurve'] = parseFloat(baseCurve);
    }

    if (diameter) {
      query['parameters.diameter'] = parseFloat(diameter);
    }

    if (lensType) {
      query.lensType = lensType;
    }

    if (search) {
      query.$or = [
        { brand: new RegExp(search, 'i') },
        { productLine: new RegExp(search, 'i') },
        { sku: new RegExp(search, 'i') }
      ];
    }

    const lenses = await ContactLensInventory.find(query)
      .select('sku brand productLine parameters lensType wearSchedule inventory.currentStock trialTracking.currentlyOut location')
      .sort({ brand: 1, productLine: 1 })
      .limit(50);

    res.json({
      success: true,
      data: lenses,
      count: lenses.length
    });
  } catch (error) {
    logger.error('Error getting trial lenses:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error getting trial lenses'
    });
  }
};

/**
 * Get trial lens statistics
 * GET /api/contact-lens-fitting/stats
 */
exports.getTrialLensStats = async (req, res) => {
  try {
    const { clinic, dateFrom, dateTo } = req.query;

    const inventoryQuery = { isTrial: true, active: true };
    if (clinic) {
      inventoryQuery.clinic = clinic;
    }

    // Get inventory stats
    const inventoryStats = await ContactLensInventory.aggregate([
      { $match: inventoryQuery },
      {
        $group: {
          _id: null,
          totalTrialLenses: { $sum: 1 },
          totalStock: { $sum: '$inventory.currentStock' },
          totalDispensed: { $sum: '$trialTracking.totalDispensed' },
          currentlyOut: { $sum: '$trialTracking.currentlyOut' }
        }
      }
    ]);

    // Get exams with pending returns
    const pendingReturnsCount = await OphthalmologyExam.countDocuments({
      'contactLensFitting.trialLens.dispensed': true,
      $or: [
        {
          'contactLensFitting.trialLens.OD.inventoryItemId': { $exists: true },
          'contactLensFitting.trialLens.OD.returnedAt': { $exists: false }
        },
        {
          'contactLensFitting.trialLens.OS.inventoryItemId': { $exists: true },
          'contactLensFitting.trialLens.OS.returnedAt': { $exists: false }
        }
      ]
    });

    // Get by lens type
    const byLensType = await ContactLensInventory.aggregate([
      { $match: inventoryQuery },
      {
        $group: {
          _id: '$lensType',
          count: { $sum: 1 },
          stock: { $sum: '$inventory.currentStock' },
          dispensed: { $sum: '$trialTracking.totalDispensed' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: inventoryStats[0] || {
          totalTrialLenses: 0,
          totalStock: 0,
          totalDispensed: 0,
          currentlyOut: 0
        },
        pendingReturnsCount,
        byLensType
      }
    });
  } catch (error) {
    logger.error('Error getting trial lens stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error getting trial lens stats'
    });
  }
};
