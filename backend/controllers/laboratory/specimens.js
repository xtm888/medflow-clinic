const { asyncHandler } = require('../../middleware/errorHandler');
const Visit = require('../../models/Visit');
const LabOrder = require('../../models/LabOrder');
const LaboratoryTemplate = require('../../models/LaboratoryTemplate');
const websocketService = require('../../services/websocketService');
const { generateUniqueBarcode } = require('./utils/barcodeGenerator');

// ============================================
// SPECIMEN TRACKING
// ============================================

// @desc    Register new specimen
// @route   POST /api/laboratory/specimens
// @access  Private (Lab Tech, Nurse)
exports.registerSpecimen = asyncHandler(async (req, res) => {
  const { visitId, testIds, specimenType, collectedBy, collectionTime, notes } = req.body;

  const visit = await Visit.findById(visitId);
  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Visit not found'
    });
  }

  // Generate unique barcode with collision detection
  const barcode = await generateUniqueBarcode();

  // Create specimen record
  const specimen = {
    barcode,
    specimenType: specimenType || 'Sang',
    collectedBy: collectedBy || req.user.id,
    collectionTime: collectionTime || new Date(),
    status: 'collected',
    notes,
    testIds: testIds || [],
    statusHistory: [{
      status: 'collected',
      timestamp: new Date(),
      updatedBy: req.user.id
    }]
  };

  // Add specimen to visit
  if (!visit.specimens) visit.specimens = [];
  visit.specimens.push(specimen);

  // Update test status to collected
  if (testIds && testIds.length > 0) {
    testIds.forEach(testId => {
      const test = visit.laboratoryOrders.id(testId);
      if (test) {
        test.specimenBarcode = barcode;
        test.specimenCollectedAt = specimen.collectionTime;
        test.specimenCollectedBy = specimen.collectedBy;
        if (test.status === 'ordered') {
          test.status = 'collected';
        }
      }
    });
  }

  await visit.save();

  // Emit WebSocket event for specimen collection
  websocketService.emitSpecimenCollected({
    barcode,
    specimenType: specimen.specimenType,
    patientId: visit.patient?._id || visit.patient,
    visitId: visit._id,
    testIds: testIds || [],
    collectedBy: specimen.collectedBy
  });

  res.status(201).json({
    success: true,
    data: {
      barcode,
      specimen,
      message: 'Specimen registered successfully'
    }
  });
});

// @desc    Update specimen status
// @route   PUT /api/laboratory/specimens/:specimenId
// @access  Private (Lab Tech)
exports.updateSpecimenStatus = asyncHandler(async (req, res) => {
  const { specimenId } = req.params;
  const { status, notes, location, temperature } = req.body;

  const visit = await Visit.findOne({ 'specimens._id': specimenId });
  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Specimen not found'
    });
  }

  const specimen = visit.specimens.id(specimenId);
  specimen.status = status;
  if (notes) specimen.notes = notes;
  if (location) specimen.location = location;
  if (temperature) specimen.temperature = temperature;

  specimen.statusHistory.push({
    status,
    timestamp: new Date(),
    updatedBy: req.user.id,
    notes
  });

  await visit.save();

  res.status(200).json({
    success: true,
    data: specimen
  });
});

// @desc    Get specimen by ID
// @route   GET /api/laboratory/specimens/:specimenId
// @access  Private
exports.getSpecimenDetails = asyncHandler(async (req, res) => {
  const visit = await Visit.findOne({ 'specimens._id': req.params.specimenId })
    .populate('patient', 'firstName lastName patientId')
    .lean();

  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Specimen not found'
    });
  }

  const specimen = visit.specimens.find(s => s._id.toString() === req.params.specimenId);

  res.status(200).json({
    success: true,
    data: {
      ...specimen,
      patient: visit.patient,
      visitId: visit._id
    }
  });
});

// @desc    Get specimen by barcode
// @route   GET /api/laboratory/specimens/barcode/:barcode
// @access  Private
exports.getSpecimenByBarcode = asyncHandler(async (req, res) => {
  const visit = await Visit.findOne({ 'specimens.barcode': req.params.barcode })
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .lean();

  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Specimen not found'
    });
  }

  const specimen = visit.specimens.find(s => s.barcode === req.params.barcode);
  const relatedTests = visit.laboratoryOrders?.filter(t =>
    t.specimenBarcode === req.params.barcode
  ) || [];

  res.status(200).json({
    success: true,
    data: {
      ...specimen,
      patient: visit.patient,
      visitId: visit._id,
      tests: relatedTests
    }
  });
});

// @desc    Get all specimens
// @route   GET /api/laboratory/specimens
// @access  Private
exports.getAllSpecimens = asyncHandler(async (req, res) => {
  const { status, dateFrom, dateTo, limit = 50 } = req.query;

  const matchStage = { specimens: { $exists: true, $ne: [] } };

  const visits = await Visit.find(matchStage)
    .populate('patient', 'firstName lastName patientId')
    .select('specimens patient')
    .sort('-createdAt')
    .limit(limit * 1)
    .lean();

  let allSpecimens = [];
  visits.forEach(visit => {
    visit.specimens?.forEach(specimen => {
      if (!status || specimen.status === status) {
        allSpecimens.push({
          ...specimen,
          patient: visit.patient,
          visitId: visit._id
        });
      }
    });
  });

  // Filter by date if provided
  if (dateFrom || dateTo) {
    allSpecimens = allSpecimens.filter(s => {
      const collTime = new Date(s.collectionTime);
      if (dateFrom && collTime < new Date(dateFrom)) return false;
      if (dateTo && collTime > new Date(dateTo)) return false;
      return true;
    });
  }

  res.status(200).json({
    success: true,
    count: allSpecimens.length,
    data: allSpecimens
  });
});

// ============================================
// TUBE CONSUMPTION INTEGRATION
// ============================================

/**
 * @desc    Consume tube when collecting specimen
 * @route   POST /api/laboratory/specimens/consume-tube
 * @access  Private (Lab Tech, Nurse)
 */
exports.consumeTubeForSpecimen = asyncHandler(async (req, res) => {
  const { specimenId, tubeType, quantity = 1 } = req.body;

  if (!tubeType) {
    return res.status(400).json({
      success: false,
      error: 'Tube type is required'
    });
  }

  const LabConsumableInventory = require('../../models/LabConsumableInventory');

  // Find matching tube in inventory
  const tube = await LabConsumableInventory.findOne({
    tubeType,
    isActive: true,
    'inventory.currentStock': { $gte: quantity }
  }).sort({ 'batches.expiryDate': 1 }); // FIFO - oldest expiry first

  if (!tube) {
    return res.status(400).json({
      success: false,
      error: `No ${tubeType} tubes available in stock`,
      suggestion: 'Please restock or use alternative tube type'
    });
  }

  // Consume from inventory
  const userId = req.user._id || req.user.id;
  await tube.consumeFIFO(quantity, {
    department: 'laboratory',
    purpose: 'specimen_collection',
    reference: specimenId,
    userId
  });

  // Update specimen record with tube info
  if (specimenId) {
    const visit = await Visit.findOne({ 'specimens._id': specimenId });
    if (visit) {
      const specimen = visit.specimens.id(specimenId);
      if (specimen) {
        specimen.tubeType = tubeType;
        specimen.tubeConsumed = true;
        specimen.tubeInventoryId = tube._id;
        await visit.save();
      }
    }
  }

  res.status(200).json({
    success: true,
    message: `${quantity} ${tubeType} tube(s) consumed successfully`,
    data: {
      tubeType,
      quantityConsumed: quantity,
      remainingStock: tube.inventory.currentStock - quantity,
      specimenId
    }
  });
});

/**
 * @desc    Get available tubes for specimen collection
 * @route   GET /api/laboratory/tubes/available
 * @access  Private (Lab Tech, Nurse)
 */
exports.getAvailableTubes = asyncHandler(async (req, res) => {
  const LabConsumableInventory = require('../../models/LabConsumableInventory');

  const tubes = await LabConsumableInventory.find({
    category: 'collection_tube',
    isActive: true,
    'inventory.currentStock': { $gt: 0 }
  })
    .select('name tubeType inventory.currentStock inventory.status batches')
    .sort('tubeType')
    .lean();

  // Group by tube type with stock info
  const tubesByType = tubes.reduce((acc, tube) => {
    const type = tube.tubeType || 'other';
    if (!acc[type]) {
      acc[type] = {
        tubeType: type,
        totalStock: 0,
        items: []
      };
    }
    acc[type].totalStock += tube.inventory?.currentStock || 0;
    acc[type].items.push({
      id: tube._id,
      name: tube.name,
      stock: tube.inventory?.currentStock || 0,
      status: tube.inventory?.status
    });
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    data: Object.values(tubesByType)
  });
});

/**
 * @desc    Auto-suggest tubes based on test requirements
 * @route   GET /api/laboratory/tubes/suggest/:templateId
 * @access  Private
 */
exports.suggestTubesForTest = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const template = await LaboratoryTemplate.findById(templateId);
  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Test template not found'
    });
  }

  // Map specimen type to tube type
  const tubeMapping = {
    'Sang': {
      default: 'edta-purple',
      alternatives: ['heparin-green', 'sst-gold', 'plain-red']
    },
    'Sang (Coagulation)': {
      default: 'citrate-blue',
      alternatives: []
    },
    'Sang (Glucose)': {
      default: 'fluoride-gray',
      alternatives: ['edta-purple']
    }
  };

  const specimenType = template.specimen || 'Sang';
  const containerColor = template.specimenDetails?.containerColor;

  let suggestedTube = 'edta-purple'; // default
  let alternatives = [];

  // Use template-specific container if specified
  if (containerColor) {
    const colorToType = {
      'Purple': 'edta-purple',
      'Green': 'heparin-green',
      'Gold': 'sst-gold',
      'Blue': 'citrate-blue',
      'Gray': 'fluoride-gray',
      'Red': 'plain-red',
      'Pink': 'edta-pink',
      'Yellow': 'acd-yellow'
    };
    suggestedTube = colorToType[containerColor] || 'edta-purple';
  } else if (tubeMapping[specimenType]) {
    suggestedTube = tubeMapping[specimenType].default;
    alternatives = tubeMapping[specimenType].alternatives;
  }

  // Check stock availability
  const LabConsumableInventory = require('../../models/LabConsumableInventory');
  const stockInfo = await LabConsumableInventory.findOne({
    tubeType: suggestedTube,
    isActive: true
  }).select('inventory.currentStock inventory.status');

  res.status(200).json({
    success: true,
    data: {
      testName: template.name,
      specimen: specimenType,
      suggestedTube,
      alternatives,
      volume: template.specimenDetails?.volume || '3-5 mL',
      handling: template.specimenDetails?.handling,
      requiresFasting: template.requiresFasting,
      stockAvailable: stockInfo?.inventory?.currentStock || 0,
      stockStatus: stockInfo?.inventory?.status || 'unknown'
    }
  });
});

// ============================================
// SPECIMEN COLLECTION FROM LABORDER
// ============================================

// @desc    Collect specimen for lab order
// @route   PUT /api/lab-orders/:id/collect
// @access  Private
exports.collectSpecimen = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  // Generate unique barcode with crypto-secure randomness
  const barcode = await generateUniqueBarcode();

  await order.collectSpecimen(req.user.id, {
    ...req.body,
    barcode
  });

  res.status(200).json({
    success: true,
    message: 'Specimen collected',
    data: {
      barcode,
      order
    }
  });
});

// @desc    Receive specimen at lab
// @route   PUT /api/lab-orders/:id/receive
// @access  Private
exports.receiveSpecimen = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  await order.receiveSpecimen(req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: req.body.quality === 'rejected' ? 'Specimen rejected' : 'Specimen received',
    data: order
  });
});

module.exports = exports;
