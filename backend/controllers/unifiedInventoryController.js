/**
 * Unified Inventory Controller
 *
 * Provides a single API for all inventory operations across all types.
 * Uses the unified inventory service to abstract model differences.
 */

const unifiedInventoryService = require('../services/unifiedInventoryService');
const { asyncHandler } = require('../middleware/errorHandler');

// Valid inventory types
const VALID_TYPES = ['pharmacy', 'frame', 'contactLens', 'opticalLens', 'reagent', 'labConsumable', 'surgicalSupply', 'equipment'];

// Validate inventory type middleware-style helper
const validateType = (type) => {
  if (!type || !VALID_TYPES.includes(type)) {
    const error = new Error(`Invalid inventory type. Valid types: ${VALID_TYPES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  return type;
};

/**
 * @desc    Get inventory items with unified query
 * @route   GET /api/unified-inventory/:type
 * @access  Private
 */
exports.getItems = asyncHandler(async (req, res) => {
  const type = validateType(req.params.type);
  const clinicId = req.user.assignedClinic || req.query.clinic;

  const options = {
    search: req.query.search,
    category: req.query.category,
    status: req.query.status,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
    sort: req.query.sort,
    includeExpiring: req.query.includeExpiring === 'true',
    expiringDays: parseInt(req.query.expiringDays) || 90
  };

  const result = await unifiedInventoryService.getItems(type, clinicId, options);

  res.status(200).json({
    success: true,
    ...result
  });
});

/**
 * @desc    Get single inventory item
 * @route   GET /api/unified-inventory/:type/:id
 * @access  Private
 */
exports.getItem = asyncHandler(async (req, res) => {
  const type = validateType(req.params.type);
  const { id } = req.params;

  const item = await unifiedInventoryService.getItem(type, id);

  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Item not found'
    });
  }

  res.status(200).json({
    success: true,
    data: item
  });
});

/**
 * @desc    Create inventory item
 * @route   POST /api/unified-inventory/:type
 * @access  Private
 */
exports.createItem = asyncHandler(async (req, res) => {
  const type = validateType(req.params.type);
  const clinicId = req.body.clinic || req.user.assignedClinic;

  if (!clinicId) {
    return res.status(400).json({
      success: false,
      error: 'Clinic ID is required'
    });
  }

  const data = { ...req.body, clinic: clinicId };
  const item = await unifiedInventoryService.createItem(type, data, req.user.id);

  res.status(201).json({
    success: true,
    data: item
  });
});

/**
 * @desc    Update inventory item
 * @route   PUT /api/unified-inventory/:type/:id
 * @access  Private
 */
exports.updateItem = asyncHandler(async (req, res) => {
  const type = validateType(req.params.type);
  const { id } = req.params;

  const item = await unifiedInventoryService.updateItem(type, id, req.body, req.user.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Item not found'
    });
  }

  res.status(200).json({
    success: true,
    data: item
  });
});

/**
 * @desc    Delete inventory item
 * @route   DELETE /api/unified-inventory/:type/:id
 * @access  Private (admin only)
 */
exports.deleteItem = asyncHandler(async (req, res) => {
  const type = validateType(req.params.type);
  const { id } = req.params;

  const success = await unifiedInventoryService.deleteItem(type, id);

  if (!success) {
    return res.status(404).json({
      success: false,
      error: 'Item not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Item deleted successfully'
  });
});

/**
 * @desc    Get low stock items across types
 * @route   GET /api/unified-inventory/alerts/low-stock
 * @access  Private
 */
exports.getLowStock = asyncHandler(async (req, res) => {
  const clinicId = req.user.assignedClinic || req.query.clinic;
  const types = req.query.types ? req.query.types.split(',') : VALID_TYPES;

  // Validate all types
  types.forEach(validateType);

  const result = await unifiedInventoryService.getLowStock(types, clinicId);

  res.status(200).json({
    success: true,
    ...result
  });
});

/**
 * @desc    Get expiring items across types
 * @route   GET /api/unified-inventory/alerts/expiring
 * @access  Private
 */
exports.getExpiring = asyncHandler(async (req, res) => {
  const clinicId = req.user.assignedClinic || req.query.clinic;
  const types = req.query.types ? req.query.types.split(',') : VALID_TYPES;
  const days = parseInt(req.query.days) || 90;

  // Validate all types
  types.forEach(validateType);

  const result = await unifiedInventoryService.getExpiring(types, clinicId, days);

  res.status(200).json({
    success: true,
    ...result
  });
});

/**
 * @desc    Get inventory value summary
 * @route   GET /api/unified-inventory/value
 * @access  Private (admin, manager)
 */
exports.getInventoryValue = asyncHandler(async (req, res) => {
  const clinicId = req.query.clinic; // Optional - if not provided, gets all clinics
  const types = req.query.types ? req.query.types.split(',') : VALID_TYPES;

  // Validate all types
  types.forEach(validateType);

  const result = await unifiedInventoryService.getInventoryValue(types, clinicId);

  res.status(200).json({
    success: true,
    ...result
  });
});

/**
 * @desc    Transfer stock between clinics
 * @route   POST /api/unified-inventory/:type/transfer
 * @access  Private (admin, manager, depot_manager)
 */
exports.transferBetweenClinics = asyncHandler(async (req, res) => {
  const type = validateType(req.params.type);
  const {
    itemId,
    fromClinicId,
    toClinicId,
    quantity,
    reason,
    notes
  } = req.body;

  // Validate required fields
  if (!itemId || !fromClinicId || !toClinicId || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: itemId, fromClinicId, toClinicId, quantity'
    });
  }

  if (quantity <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Quantity must be positive'
    });
  }

  const result = await unifiedInventoryService.transferBetweenClinics(
    type,
    itemId,
    fromClinicId,
    toClinicId,
    quantity,
    req.user.id,
    { reason, notes }
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Adjust stock (receive, damage, correction)
 * @route   POST /api/unified-inventory/:type/:id/adjust
 * @access  Private
 */
exports.adjustStock = asyncHandler(async (req, res) => {
  const type = validateType(req.params.type);
  const { id } = req.params;
  const {
    adjustmentType,
    quantity,
    reason,
    batchNumber,
    expirationDate,
    unitCost
  } = req.body;

  // Validate adjustment type
  const validAdjustments = ['receive', 'damage', 'expired', 'correction', 'return', 'dispense'];
  if (!validAdjustments.includes(adjustmentType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid adjustment type. Valid types: ${validAdjustments.join(', ')}`
    });
  }

  if (!quantity || quantity === 0) {
    return res.status(400).json({
      success: false,
      error: 'Quantity is required and must be non-zero'
    });
  }

  const result = await unifiedInventoryService.adjustStock(
    type,
    id,
    adjustmentType,
    quantity,
    req.user.id,
    { reason, batchNumber, expirationDate, unitCost }
  );

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get dashboard summary across all inventory types
 * @route   GET /api/unified-inventory/dashboard
 * @access  Private
 */
exports.getDashboardSummary = asyncHandler(async (req, res) => {
  const clinicId = req.user.assignedClinic || req.query.clinic;

  const summary = await unifiedInventoryService.getDashboardSummary(clinicId);

  res.status(200).json({
    success: true,
    data: summary
  });
});

/**
 * @desc    Search across all inventory types
 * @route   GET /api/unified-inventory/search
 * @access  Private
 */
exports.globalSearch = asyncHandler(async (req, res) => {
  const { q: search } = req.query;
  const clinicId = req.user.assignedClinic || req.query.clinic;
  const types = req.query.types ? req.query.types.split(',') : VALID_TYPES;
  const limit = parseInt(req.query.limit) || 10;

  if (!search || search.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 2 characters'
    });
  }

  // Validate all types
  types.forEach(validateType);

  const results = {};
  let totalResults = 0;

  for (const type of types) {
    const typeResults = await unifiedInventoryService.getItems(type, clinicId, {
      search,
      limit,
      page: 1
    });

    results[type] = typeResults.data;
    totalResults += typeResults.data.length;
  }

  res.status(200).json({
    success: true,
    data: {
      query: search,
      totalResults,
      results
    }
  });
});

/**
 * @desc    Get valid inventory types
 * @route   GET /api/unified-inventory/types
 * @access  Public
 */
exports.getTypes = asyncHandler(async (req, res) => {
  const typeInfo = {
    pharmacy: {
      name: 'Pharmacy',
      description: 'Medications, drugs, and pharmaceutical products',
      icon: 'pill'
    },
    frame: {
      name: 'Frames',
      description: 'Eyeglass frames and accessories',
      icon: 'glasses'
    },
    contactLens: {
      name: 'Contact Lenses',
      description: 'Contact lenses and solutions',
      icon: 'eye'
    },
    opticalLens: {
      name: 'Optical Lenses',
      description: 'Prescription lenses and blanks',
      icon: 'circle'
    },
    reagent: {
      name: 'Reagents',
      description: 'Laboratory reagents and chemicals',
      icon: 'flask'
    },
    labConsumable: {
      name: 'Lab Consumables',
      description: 'Laboratory consumable supplies',
      icon: 'test-tube'
    },
    surgicalSupply: {
      name: 'Surgical Supplies',
      description: 'Surgical instruments and supplies including IOLs',
      icon: 'scalpel'
    },
    equipment: {
      name: 'Equipment',
      description: 'Medical and office equipment',
      icon: 'monitor'
    }
  };

  res.status(200).json({
    success: true,
    data: {
      types: VALID_TYPES,
      info: typeInfo
    }
  });
});
