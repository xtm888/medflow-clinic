const {
  Inventory,
  PharmacyInventory,
  FrameInventory,
  ContactLensInventory,
  LabConsumableInventory,
  ReagentInventory,
  OpticalLensInventory,
  SurgicalSupplyInventory
} = require('../models/Inventory');
const InventoryTransfer = require('../models/InventoryTransfer');
const Clinic = require('../models/Clinic');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');

// Map inventory type to model
const INVENTORY_MODELS = {
  pharmacy: PharmacyInventory,
  frame: FrameInventory,
  contactLens: ContactLensInventory,
  labConsumable: LabConsumableInventory,
  reagent: ReagentInventory,
  opticalLens: OpticalLensInventory,
  surgicalSupply: SurgicalSupplyInventory
};

// Helper: Check if user can access all clinics
const canAccessAllClinics = (user) => {
  return ['admin', 'manager', 'depot_manager'].includes(user.role);
};

// Helper: Get user's accessible clinic IDs
const getUserClinicIds = (user) => {
  if (canAccessAllClinics(user)) return null; // null means all
  return user.clinics || (user.assignedClinic ? [user.assignedClinic] : []);
};

/**
 * @desc    Get consolidated inventory view across all clinics
 * @route   GET /api/cross-clinic-inventory
 * @access  Private (admin, manager, depot_manager)
 */
exports.getConsolidatedInventory = asyncHandler(async (req, res) => {
  const {
    inventoryType = 'pharmacy',
    search,
    category,
    status,
    page = 1,
    limit = 50
  } = req.query;

  // Only admins/managers can see all clinics
  if (!canAccessAllClinics(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to view cross-clinic inventory'
    });
  }

  const Model = INVENTORY_MODELS[inventoryType];
  if (!Model) {
    return res.status(400).json({
      success: false,
      error: 'Invalid inventory type'
    });
  }

  // Get all active clinics (status not set means active)
  const clinics = await Clinic.find({ status: { $ne: 'inactive' } })
    .select('_id name shortName clinicId')
    .sort({ name: 1 })
    .lean();

  // Build aggregation to group by product across clinics
  const matchStage = {};

  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (inventoryType === 'pharmacy') {
      matchStage.$or = [
        { 'medication.genericName': searchRegex },
        { 'medication.brandName': searchRegex }
      ];
    } else {
      matchStage.$or = [
        { brand: searchRegex },
        { model: searchRegex },
        { productLine: searchRegex },
        { name: searchRegex },
        { sku: searchRegex }
      ];
    }
  }

  if (category) {
    matchStage.category = category;
  }

  if (status) {
    matchStage['inventory.status'] = status;
  }

  // Aggregation to get stock by product and clinic
  let groupByField;
  let productFields;

  switch (inventoryType) {
    case 'pharmacy':
      groupByField = '$drug';
      productFields = {
        name: { $first: '$medication.genericName' },
        brandName: { $first: '$medication.brandName' },
        strength: { $first: '$medication.strength' },
        formulation: { $first: '$medication.formulation' },
        category: { $first: '$category' }
      };
      break;
    case 'frame':
      groupByField = '$sku';
      productFields = {
        name: { $first: { $concat: ['$brand', ' ', '$model'] } },
        brand: { $first: '$brand' },
        model: { $first: '$model' },
        color: { $first: '$color' },
        size: { $first: '$size' },
        category: { $first: '$category' },
        sku: { $first: '$sku' }
      };
      break;
    case 'contactLens':
      groupByField = '$sku';
      productFields = {
        name: { $first: { $concat: ['$brand', ' ', '$productLine'] } },
        brand: { $first: '$brand' },
        productLine: { $first: '$productLine' },
        parameters: { $first: '$parameters' },
        lensType: { $first: '$lensType' },
        wearSchedule: { $first: '$wearSchedule' },
        sku: { $first: '$sku' }
      };
      break;
    case 'opticalLens':
      groupByField = '$sku';
      productFields = {
        name: { $first: { $concat: ['$brand', ' ', '$productLine', ' ', '$material'] } },
        brand: { $first: '$brand' },
        productLine: { $first: '$productLine' },
        material: { $first: '$material' },
        design: { $first: '$design' },
        coatings: { $first: '$coatings' },
        isPhotochromic: { $first: '$isPhotochromic' },
        isPolarized: { $first: '$isPolarized' },
        category: { $first: '$category' },
        sku: { $first: '$sku' }
      };
      break;
    case 'surgicalSupply':
      groupByField = '$sku';
      productFields = {
        name: { $first: { $concat: ['$brand', ' ', '$productName'] } },
        brand: { $first: '$brand' },
        productName: { $first: '$productName' },
        manufacturer: { $first: '$manufacturer' },
        model: { $first: '$model' },
        category: { $first: '$category' },
        iol: { $first: '$iol' },
        sku: { $first: '$sku' }
      };
      break;
    default:
      groupByField = '$sku';
      productFields = {
        name: { $first: '$name' },
        sku: { $first: '$sku' },
        category: { $first: '$category' }
      };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: groupByField,
        ...productFields,
        stockByClinic: {
          $push: {
            clinic: '$clinic',
            currentStock: '$inventory.currentStock',
            reserved: '$inventory.reserved',
            status: '$inventory.status',
            minimumStock: '$inventory.minimumStock',
            reorderPoint: '$inventory.reorderPoint',
            isDepot: '$isDepot'
          }
        },
        totalStock: { $sum: '$inventory.currentStock' },
        totalReserved: { $sum: '$inventory.reserved' },
        clinicsOutOfStock: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'out-of-stock'] }, 1, 0] }
        },
        clinicsLowStock: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'low-stock'] }, 1, 0] }
        }
      }
    },
    {
      $addFields: {
        hasAlert: {
          $or: [
            { $gt: ['$clinicsOutOfStock', 0] },
            { $gt: ['$clinicsLowStock', 0] }
          ]
        },
        alertLevel: {
          $cond: [
            { $gt: ['$clinicsOutOfStock', 0] },
            'critical',
            { $cond: [{ $gt: ['$clinicsLowStock', 0] }, 'warning', 'ok'] }
          ]
        }
      }
    },
    { $sort: { hasAlert: -1, alertLevel: 1, name: 1 } },
    { $skip: (parseInt(page) - 1) * parseInt(limit) },
    { $limit: parseInt(limit) }
  ];

  const [results, totalCount] = await Promise.all([
    Model.aggregate(pipeline),
    Model.aggregate([
      { $match: matchStage },
      { $group: { _id: groupByField } },
      { $count: 'total' }
    ])
  ]);

  // Map clinic IDs to clinic info
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c._id.toString()] = c;
    return acc;
  }, {});

  // Enrich results with clinic names
  const enrichedResults = results.map(item => {
    const stockByClinic = {};

    // Initialize all clinics with 0
    clinics.forEach(c => {
      stockByClinic[c._id.toString()] = {
        clinicId: c._id,
        clinicName: c.name,
        clinicShortName: c.shortName,
        currentStock: 0,
        reserved: 0,
        status: 'not-stocked',
        minimumStock: 0,
        reorderPoint: 0
      };
    });

    // Fill in actual stock
    item.stockByClinic.forEach(s => {
      if (s.clinic) {
        const clinicId = s.clinic.toString();
        const clinic = clinicMap[clinicId];
        if (clinic) {
          stockByClinic[clinicId] = {
            clinicId: s.clinic,
            clinicName: clinic.name,
            clinicShortName: clinic.shortName,
            currentStock: s.currentStock,
            reserved: s.reserved || 0,
            status: s.status,
            minimumStock: s.minimumStock || 0,
            reorderPoint: s.reorderPoint || 0,
            isDepot: s.isDepot
          };
        }
      }
    });

    return {
      productId: item._id,
      ...item,
      stockByClinic: Object.values(stockByClinic)
    };
  });

  res.status(200).json({
    success: true,
    data: {
      clinics,
      products: enrichedResults
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount[0]?.total || 0,
      pages: Math.ceil((totalCount[0]?.total || 0) / parseInt(limit))
    }
  });
});

/**
 * @desc    Get inventory alerts across all clinics
 * @route   GET /api/cross-clinic-inventory/alerts
 * @access  Private (admin, manager, depot_manager)
 */
exports.getAlerts = asyncHandler(async (req, res) => {
  const { inventoryType } = req.query;

  if (!canAccessAllClinics(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to view cross-clinic alerts'
    });
  }

  const alerts = [];
  const inventoryTypes = inventoryType ? [inventoryType] : ['pharmacy', 'frame', 'contactLens', 'reagent', 'labConsumable', 'opticalLens', 'surgicalSupply'];

  for (const type of inventoryTypes) {
    const Model = INVENTORY_MODELS[type];
    if (!Model) continue;

    // Find out of stock and low stock items
    const criticalItems = await Model.find({
      'inventory.status': { $in: ['out-of-stock', 'low-stock'] }
    })
      .populate('clinic', 'name shortName clinicId')
      .select('clinic inventory medication brand model productLine name sku drug')
      .lean();

    for (const item of criticalItems) {
      // Skip items with null clinic (orphaned references)
      if (!item.clinic) continue;

      let productName;
      switch (type) {
        case 'pharmacy':
          productName = item.medication?.genericName || item.medication?.brandName;
          break;
        case 'frame':
          productName = `${item.brand} ${item.model}`;
          break;
        case 'contactLens':
          productName = `${item.brand} ${item.productLine}`;
          break;
        case 'opticalLens':
          productName = `${item.brand} ${item.productLine} ${item.material || ''}`.trim();
          break;
        case 'surgicalSupply':
          productName = `${item.brand} ${item.productName}`;
          break;
        default:
          productName = item.name || item.sku;
      }

      // Check if other clinics have surplus
      let surplusQuery;
      if (type === 'pharmacy') {
        surplusQuery = { drug: item.drug, clinic: { $ne: item.clinic._id } };
      } else {
        surplusQuery = { sku: item.sku, clinic: { $ne: item.clinic._id } };
      }

      const surplusLocations = await Model.find({
        ...surplusQuery,
        'inventory.currentStock': { $gt: 0 },
        $expr: { $gt: ['$inventory.currentStock', '$inventory.minimumStock'] }
      })
        .populate('clinic', 'name shortName')
        .select('clinic inventory.currentStock inventory.minimumStock')
        .lean();

      alerts.push({
        id: item._id,
        inventoryType: type,
        productName,
        sku: item.sku,
        alertType: item.inventory.status === 'out-of-stock' ? 'rupture' : 'low-stock',
        severity: item.inventory.status === 'out-of-stock' ? 'critical' : 'warning',
        clinic: {
          id: item.clinic._id,
          name: item.clinic.name,
          shortName: item.clinic.shortName
        },
        currentStock: item.inventory.currentStock,
        minimumStock: item.inventory.minimumStock,
        neededQuantity: (item.inventory.reorderPoint || item.inventory.minimumStock || 10) - item.inventory.currentStock,
        availableFrom: surplusLocations.map(s => ({
          clinicId: s.clinic._id,
          clinicName: s.clinic.name,
          clinicShortName: s.clinic.shortName,
          availableStock: s.inventory.currentStock - (s.inventory.minimumStock || 0)
        })),
        canTransfer: surplusLocations.length > 0
      });
    }
  }

  // Sort by severity (critical first)
  alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return a.productName.localeCompare(b.productName);
  });

  res.status(200).json({
    success: true,
    data: alerts,
    summary: {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      canTransfer: alerts.filter(a => a.canTransfer).length
    }
  });
});

/**
 * @desc    Get dashboard summary for cross-clinic inventory
 * @route   GET /api/cross-clinic-inventory/summary
 * @access  Private (admin, manager, depot_manager)
 */
exports.getSummary = asyncHandler(async (req, res) => {
  if (!canAccessAllClinics(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to view cross-clinic summary'
    });
  }

  const clinics = await Clinic.find({ status: { $ne: 'inactive' } })
    .select('_id name shortName')
    .lean();

  // Get stats for each inventory type
  const inventoryStats = {};

  for (const [type, Model] of Object.entries(INVENTORY_MODELS)) {
    const stats = await Model.aggregate([
      {
        $group: {
          _id: '$clinic',
          totalItems: { $sum: 1 },
          totalStock: { $sum: '$inventory.currentStock' },
          outOfStock: {
            $sum: { $cond: [{ $eq: ['$inventory.status', 'out-of-stock'] }, 1, 0] }
          },
          lowStock: {
            $sum: { $cond: [{ $eq: ['$inventory.status', 'low-stock'] }, 1, 0] }
          },
          depotItems: {
            $sum: { $cond: ['$isDepot', 1, 0] }
          }
        }
      }
    ]);

    inventoryStats[type] = stats;
  }

  // Get transfer stats
  const transferStats = await InventoryTransfer.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get recent transfers
  const recentTransfers = await InventoryTransfer.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('source.clinic', 'name shortName')
    .populate('destination.clinic', 'name shortName')
    .select('transferNumber status type source destination items.length dates')
    .lean();

  // Calculate summary per clinic
  const clinicSummaries = clinics.map(clinic => {
    const summary = {
      clinic,
      pharmacy: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 },
      frame: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 },
      contactLens: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 },
      reagent: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 },
      labConsumable: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 },
      opticalLens: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 },
      surgicalSupply: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 },
      // Aggregated totals
      total: { totalItems: 0, totalStock: 0, outOfStock: 0, lowStock: 0 }
    };

    for (const [type, stats] of Object.entries(inventoryStats)) {
      const clinicStats = stats.find(s => s._id?.toString() === clinic._id.toString());
      if (clinicStats) {
        summary[type] = {
          totalItems: clinicStats.totalItems,
          totalStock: clinicStats.totalStock,
          outOfStock: clinicStats.outOfStock,
          lowStock: clinicStats.lowStock
        };
        // Add to totals
        summary.total.totalItems += clinicStats.totalItems;
        summary.total.totalStock += clinicStats.totalStock;
        summary.total.outOfStock += clinicStats.outOfStock;
        summary.total.lowStock += clinicStats.lowStock;
      }
    }

    return summary;
  });

  // Depot summary (items marked as depot)
  const depotSummary = {};
  for (const [type, stats] of Object.entries(inventoryStats)) {
    const depotItems = stats.reduce((sum, s) => sum + (s.depotItems || 0), 0);
    depotSummary[type] = depotItems;
  }

  res.status(200).json({
    success: true,
    data: {
      clinics: clinicSummaries,
      depot: depotSummary,
      transfers: {
        byStatus: transferStats.reduce((acc, { _id, count }) => {
          acc[_id] = count;
          return acc;
        }, {}),
        recent: recentTransfers
      },
      totalAlerts: {
        pharmacy: inventoryStats.pharmacy?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0,
        frame: inventoryStats.frame?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0,
        contactLens: inventoryStats.contactLens?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0,
        reagent: inventoryStats.reagent?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0,
        labConsumable: inventoryStats.labConsumable?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0,
        opticalLens: inventoryStats.opticalLens?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0,
        surgicalSupply: inventoryStats.surgicalSupply?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0,
        total: Object.values(inventoryStats).reduce((total, stats) =>
          total + (stats?.reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0) || 0), 0)
      }
    }
  });
});

/**
 * @desc    Quick transfer from recommendation
 * @route   POST /api/cross-clinic-inventory/quick-transfer
 * @access  Private (admin, manager, depot_manager)
 */
exports.createQuickTransfer = asyncHandler(async (req, res) => {
  const {
    inventoryType,
    inventoryId,
    fromClinicId,
    toClinicId,
    quantity,
    priority = 'high',
    reason = 'stock-out'
  } = req.body;

  if (!canAccessAllClinics(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to create quick transfers'
    });
  }

  const Model = INVENTORY_MODELS[inventoryType];
  if (!Model) {
    return res.status(400).json({
      success: false,
      error: 'Invalid inventory type'
    });
  }

  // Get product info
  const item = await Model.findById(inventoryId);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
    });
  }

  // Get clinic info
  const [fromClinic, toClinic] = await Promise.all([
    Clinic.findById(fromClinicId),
    Clinic.findById(toClinicId)
  ]);

  if (!fromClinic || !toClinic) {
    return res.status(400).json({
      success: false,
      error: 'Invalid clinic(s)'
    });
  }

  // Get product name
  let productName, productDetails;
  switch (inventoryType) {
    case 'pharmacy':
      productName = item.medication?.genericName || item.medication?.brandName;
      productDetails = `${item.medication?.brandName || ''} ${item.medication?.strength || ''}`.trim();
      break;
    case 'frame':
      productName = `${item.brand} ${item.model}`;
      productDetails = `${item.color} - ${item.size}`;
      break;
    case 'contactLens':
      productName = `${item.brand} ${item.productLine}`;
      productDetails = `BC:${item.parameters?.baseCurve} D:${item.parameters?.diameter}`;
      break;
    case 'opticalLens':
      productName = `${item.brand} ${item.productLine}`;
      productDetails = `${item.material} - ${item.design} ${item.coatings?.join(', ') || ''}`.trim();
      break;
    case 'surgicalSupply':
      productName = `${item.brand} ${item.productName}`;
      productDetails = `${item.category} - ${item.manufacturer}`;
      break;
    default:
      productName = item.name || item.sku;
  }

  // Create and submit transfer
  const transfer = await InventoryTransfer.create({
    type: 'clinic-to-clinic',
    source: {
      clinic: fromClinicId,
      isDepot: false,
      name: fromClinic.name
    },
    destination: {
      clinic: toClinicId,
      name: toClinic.name
    },
    items: [{
      inventoryType,
      inventoryId,
      inventoryModel: {
        pharmacy: 'PharmacyInventory',
        frame: 'FrameInventory',
        contactLens: 'ContactLensInventory',
        labConsumable: 'LabConsumableInventory',
        reagent: 'ReagentInventory',
        opticalLens: 'OpticalLensInventory',
        surgicalSupply: 'SurgicalSupplyInventory'
      }[inventoryType],
      productName,
      productSku: item.sku,
      productDetails,
      requestedQuantity: quantity,
      status: 'pending'
    }],
    priority,
    reason,
    reasonNotes: 'Quick transfer created from cross-clinic dashboard',
    requestedBy: req.user.id,
    isAutoGenerated: true,
    status: 'requested', // Submit immediately
    approvalHistory: [
      {
        action: 'created',
        performedBy: req.user.id,
        newStatus: 'draft'
      },
      {
        action: 'submitted',
        performedBy: req.user.id,
        previousStatus: 'draft',
        newStatus: 'requested'
      }
    ],
    dates: {
      requested: new Date()
    }
  });

  res.status(201).json({
    success: true,
    data: transfer,
    message: 'Quick transfer created and submitted for approval'
  });
});
