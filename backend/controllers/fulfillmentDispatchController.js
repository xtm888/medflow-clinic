const FulfillmentDispatch = require('../models/FulfillmentDispatch');
const ExternalFacility = require('../models/ExternalFacility');
const Invoice = require('../models/Invoice');
const Prescription = require('../models/Prescription');
const Visit = require('../models/Visit');
const SurgeryCase = require('../models/SurgeryCase');
const { apiResponse } = require('../utils/apiResponse');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('FulfillmentDispatchController');

/**
 * Fulfillment Dispatch Controller
 * Unified tracking for all external service dispatches
 */

// @desc    Get all dispatches with filters
// @route   GET /api/fulfillment-dispatches
// @access  Private
exports.getDispatches = async (req, res) => {
  try {
    const {
      status,
      sourceType,
      externalFacility,
      patient,
      priority,
      overdue,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (sourceType) query.sourceType = sourceType;
    if (externalFacility) query.externalFacility = externalFacility;
    if (patient) query.patient = patient;
    if (priority) query.priority = priority;

    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $in: ['pending', 'dispatched', 'acknowledged', 'in_progress'] };
    }

    if (req.query.clinic) {
      query.clinic = req.query.clinic;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [dispatches, total] = await Promise.all([
      FulfillmentDispatch.find(query)
        .populate('patient', 'firstName lastName fileNumber phone')
        .populate('externalFacility', 'name type contact')
        .populate('dispatch.dispatchedBy', 'firstName lastName')
        .populate('createdBy', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      FulfillmentDispatch.countDocuments(query)
    ]);

    res.json(apiResponse(true, 'Dispatches retrieved', {
      dispatches,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    }));
  } catch (error) {
    log.error('Error fetching dispatches', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get dispatch by ID
// @route   GET /api/fulfillment-dispatches/:id
// @access  Private
exports.getDispatch = async (req, res) => {
  try {
    const dispatch = await FulfillmentDispatch.findById(req.params.id)
      .populate('patient', 'firstName lastName fileNumber phone email dateOfBirth')
      .populate('visit')
      .populate('externalFacility')
      .populate('dispatch.dispatchedBy', 'firstName lastName')
      .populate('completion.confirmedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean(); // Performance: return plain JS object for read-only response

    if (!dispatch) {
      return res.status(404).json(apiResponse(false, 'Dispatch not found'));
    }

    res.json(apiResponse(true, 'Dispatch retrieved', dispatch));
  } catch (error) {
    log.error('Error fetching dispatch', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Create a new dispatch
// @route   POST /api/fulfillment-dispatches
// @access  Private
exports.createDispatch = async (req, res) => {
  try {
    const dispatchData = {
      ...req.body,
      createdBy: req.user._id,
      clinic: req.body.clinic || req.user.clinic,
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        by: req.user._id,
        notes: 'Dispatch created'
      }]
    };

    const dispatch = await FulfillmentDispatch.create(dispatchData);

    // Update external facility referral count
    if (dispatch.externalFacility) {
      await ExternalFacility.findByIdAndUpdate(dispatch.externalFacility, {
        $inc: { 'performance.totalReferrals': 1 },
        $set: { 'performance.lastReferralDate': new Date() }
      });
    }

    const populated = await dispatch.populate([
      { path: 'patient', select: 'firstName lastName fileNumber' },
      { path: 'externalFacility', select: 'name type' }
    ]);

    res.status(201).json(apiResponse(true, 'Dispatch created', populated));
  } catch (error) {
    log.error('Error creating dispatch', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Update dispatch status
// @route   PUT /api/fulfillment-dispatches/:id/status
// @access  Private
exports.updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const dispatch = await FulfillmentDispatch.findById(req.params.id);

    if (!dispatch) {
      return res.status(404).json(apiResponse(false, 'Dispatch not found'));
    }

    await dispatch.updateStatus(status, req.user._id, notes);

    res.json(apiResponse(true, 'Status updated', dispatch));
  } catch (error) {
    log.error('Error updating status', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Mark dispatch as dispatched
// @route   POST /api/fulfillment-dispatches/:id/dispatch
// @access  Private
exports.markDispatched = async (req, res) => {
  try {
    const dispatch = await FulfillmentDispatch.findById(req.params.id);

    if (!dispatch) {
      return res.status(404).json(apiResponse(false, 'Dispatch not found'));
    }

    const dispatchData = {
      method: req.body.method || 'manual',
      externalReference: req.body.externalReference,
      documents: req.body.documents,
      email: req.body.email,
      print: req.body.print,
      api: req.body.api
    };

    await dispatch.markDispatched(dispatchData, req.user._id);

    // Update source document's dispatch status
    await updateSourceDispatchStatus(dispatch, 'dispatched');

    res.json(apiResponse(true, 'Marked as dispatched', dispatch));
  } catch (error) {
    log.error('Error marking dispatched', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Record acknowledgment from external facility
// @route   POST /api/fulfillment-dispatches/:id/acknowledge
// @access  Private
exports.recordAcknowledgment = async (req, res) => {
  try {
    const dispatch = await FulfillmentDispatch.findById(req.params.id);

    if (!dispatch) {
      return res.status(404).json(apiResponse(false, 'Dispatch not found'));
    }

    dispatch.acknowledgment = {
      received: true,
      receivedAt: req.body.receivedAt || new Date(),
      receivedBy: req.body.receivedBy,
      referenceNumber: req.body.referenceNumber,
      estimatedCompletionDate: req.body.estimatedCompletionDate,
      notes: req.body.notes
    };

    await dispatch.updateStatus('acknowledged', req.user._id, req.body.notes);

    // Update source document's dispatch status
    await updateSourceDispatchStatus(dispatch, 'acknowledged');

    res.json(apiResponse(true, 'Acknowledgment recorded', dispatch));
  } catch (error) {
    log.error('Error recording acknowledgment', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Confirm completion
// @route   POST /api/fulfillment-dispatches/:id/complete
// @access  Private
exports.confirmCompletion = async (req, res) => {
  try {
    const dispatch = await FulfillmentDispatch.findById(req.params.id);

    if (!dispatch) {
      return res.status(404).json(apiResponse(false, 'Dispatch not found'));
    }

    const completionData = {
      completedAt: req.body.completedAt || new Date(),
      completedBy: req.body.completedBy,
      reportReceived: req.body.reportReceived,
      reportDocument: req.body.reportDocument,
      results: req.body.results,
      notes: req.body.notes
    };

    await dispatch.confirmCompletion(completionData, req.user._id);

    // Update external facility completion count
    if (dispatch.externalFacility) {
      await ExternalFacility.findByIdAndUpdate(dispatch.externalFacility, {
        $inc: { 'performance.completedReferrals': 1 }
      });
    }

    // Update source document's dispatch status
    await updateSourceDispatchStatus(dispatch, 'completed');

    res.json(apiResponse(true, 'Completion confirmed', dispatch));
  } catch (error) {
    log.error('Error confirming completion', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get pending dispatches
// @route   GET /api/fulfillment-dispatches/pending
// @access  Private
exports.getPending = async (req, res) => {
  try {
    const options = {};
    if (req.query.clinic) options.clinic = req.query.clinic;
    if (req.query.sourceType) options.sourceType = req.query.sourceType;

    const dispatches = await FulfillmentDispatch.findPending(options);

    res.json(apiResponse(true, 'Pending dispatches retrieved', dispatches));
  } catch (error) {
    log.error('Error fetching pending dispatches', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get overdue dispatches
// @route   GET /api/fulfillment-dispatches/overdue
// @access  Private
exports.getOverdue = async (req, res) => {
  try {
    const options = {};
    if (req.query.clinic) options.clinic = req.query.clinic;

    const dispatches = await FulfillmentDispatch.findOverdue(options);

    res.json(apiResponse(true, 'Overdue dispatches retrieved', dispatches));
  } catch (error) {
    log.error('Error fetching overdue dispatches', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get dispatch statistics
// @route   GET /api/fulfillment-dispatches/stats
// @access  Private
exports.getStats = async (req, res) => {
  try {
    const options = {};
    if (req.query.clinic) options.clinic = req.query.clinic;
    if (req.query.startDate) options.startDate = new Date(req.query.startDate);
    if (req.query.endDate) options.endDate = new Date(req.query.endDate);

    const stats = await FulfillmentDispatch.getStats(options);

    res.json(apiResponse(true, 'Stats retrieved', stats));
  } catch (error) {
    log.error('Error fetching stats', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get dispatches for a patient
// @route   GET /api/fulfillment-dispatches/patient/:patientId
// @access  Private
exports.getPatientDispatches = async (req, res) => {
  try {
    const dispatches = await FulfillmentDispatch.find({
      patient: req.params.patientId
    })
      .populate('externalFacility', 'name type')
      .populate('visit', 'visitId visitDate')
      .sort({ createdAt: -1 });

    res.json(apiResponse(true, 'Patient dispatches retrieved', dispatches));
  } catch (error) {
    log.error('Error fetching patient dispatches', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Add reminder to dispatch
// @route   POST /api/fulfillment-dispatches/:id/reminder
// @access  Private
exports.addReminder = async (req, res) => {
  try {
    const dispatch = await FulfillmentDispatch.findById(req.params.id);

    if (!dispatch) {
      return res.status(404).json(apiResponse(false, 'Dispatch not found'));
    }

    dispatch.reminders.push({
      type: req.body.type,
      method: req.body.method,
      sentAt: new Date(),
      sentBy: req.user._id,
      response: req.body.response
    });

    await dispatch.save();

    res.json(apiResponse(true, 'Reminder added', dispatch));
  } catch (error) {
    log.error('Error adding reminder', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get dispatch dashboard summary
// @route   GET /api/fulfillment-dispatches/dashboard
// @access  Private
exports.getDashboard = async (req, res) => {
  try {
    const clinicQuery = req.query.clinic ? { clinic: req.query.clinic } : {};

    const [
      pendingCount,
      dispatchedCount,
      inProgressCount,
      overdueCount,
      completedToday,
      recentDispatches,
      byType
    ] = await Promise.all([
      FulfillmentDispatch.countDocuments({ ...clinicQuery, status: 'pending' }),
      FulfillmentDispatch.countDocuments({ ...clinicQuery, status: 'dispatched' }),
      FulfillmentDispatch.countDocuments({ ...clinicQuery, status: 'in_progress' }),
      FulfillmentDispatch.countDocuments({
        ...clinicQuery,
        status: { $in: ['dispatched', 'acknowledged', 'in_progress'] },
        dueDate: { $lt: new Date() }
      }),
      FulfillmentDispatch.countDocuments({
        ...clinicQuery,
        status: 'completed',
        'completion.completedAt': {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }),
      FulfillmentDispatch.find({ ...clinicQuery, status: { $ne: 'completed' } })
        .populate('patient', 'firstName lastName fileNumber')
        .populate('externalFacility', 'name type')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      FulfillmentDispatch.aggregate([
        { $match: { ...clinicQuery, status: { $ne: 'completed' } } },
        { $group: { _id: '$sourceType', count: { $sum: 1 } } }
      ])
    ]);

    res.json(apiResponse(true, 'Dashboard retrieved', {
      summary: {
        pending: pendingCount,
        dispatched: dispatchedCount,
        inProgress: inProgressCount,
        overdue: overdueCount,
        completedToday
      },
      byType: byType.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
      recentDispatches
    }));
  } catch (error) {
    log.error('Error fetching dashboard', { error: error.message, stack: error.stack });
    res.status(500).json(apiResponse(false, error.message));
  }
};

// Helper function to update source document's dispatch status
async function updateSourceDispatchStatus(dispatch, status) {
  try {
    switch (dispatch.sourceType) {
      case 'invoice_item':
        await updateInvoiceItemStatus(dispatch, status);
        break;
      case 'prescription':
        await updatePrescriptionStatus(dispatch, status);
        break;
      case 'surgery_referral':
        await updateSurgeryStatus(dispatch, status);
        break;
      // Add other source types as needed
    }
  } catch (error) {
    log.error('Error updating source dispatch status', { sourceType: dispatch.sourceType, error: error.message, stack: error.stack });
  }
}

async function updateInvoiceItemStatus(dispatch, status) {
  if (!dispatch.invoiceItemId) return;

  await Invoice.updateOne(
    { _id: dispatch.sourceId, 'items._id': dispatch.invoiceItemId },
    {
      $set: {
        'items.$.fulfillment.dispatchStatus': status,
        ...(status === 'dispatched' && {
          'items.$.fulfillment.dispatchedAt': new Date()
        }),
        ...(status === 'acknowledged' && {
          'items.$.fulfillment.acknowledgedAt': new Date()
        }),
        ...(status === 'completed' && {
          'items.$.fulfillment.completedAt': new Date()
        })
      }
    }
  );
}

async function updatePrescriptionStatus(dispatch, status) {
  const prescription = await Prescription.findById(dispatch.sourceId);
  if (!prescription) return;

  prescription.externalPharmacy.dispatchStatus = status;

  if (status === 'dispatched') {
    prescription.externalPharmacy.dispatchedAt = new Date();
  } else if (status === 'completed') {
    prescription.externalPharmacy.completed = true;
    prescription.externalPharmacy.completedAt = new Date();
  }

  prescription.externalPharmacy.statusHistory.push({
    status,
    timestamp: new Date(),
    by: dispatch._statusChangeBy
  });

  await prescription.save();
}

async function updateSurgeryStatus(dispatch, status) {
  const surgery = await SurgeryCase.findById(dispatch.sourceId);
  if (!surgery) return;

  surgery.externalSurgery.dispatchStatus = status;

  if (status === 'dispatched') {
    surgery.externalSurgery.dispatchedAt = new Date();
  } else if (status === 'completed') {
    surgery.externalSurgery.completedAt = new Date();
  }

  surgery.externalSurgery.statusHistory.push({
    status,
    timestamp: new Date(),
    by: dispatch._statusChangeBy
  });

  await surgery.save();
}
