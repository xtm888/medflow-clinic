const { asyncHandler } = require('../middleware/errorHandler');
const CentralInventory = require('../models/CentralInventory');
const ClinicRegistry = require('../models/ClinicRegistry');

/**
 * @desc    Get consolidated inventory across all clinics
 * @route   GET /api/inventory
 * @access  Private (clinic auth)
 */
exports.getConsolidatedInventory = asyncHandler(async (req, res) => {
  const { inventoryType, search, category, status, page = 1, limit = 50 } = req.query;

  const result = await CentralInventory.getConsolidated({
    inventoryType,
    search,
    category,
    status,
    page: parseInt(page),
    limit: parseInt(limit)
  });

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  // Enrich products with clinic names
  const enrichedProducts = result.products.map(product => ({
    ...product,
    stockByClinic: product.stockByClinic.map(s => ({
      ...s,
      clinicName: clinicMap[s.clinic]?.name || s.clinic,
      clinicShortName: clinicMap[s.clinic]?.shortName || s.clinic
    }))
  }));

  res.json({
    success: true,
    clinics: clinics.map(c => ({
      clinicId: c.clinicId,
      name: c.name,
      shortName: c.shortName
    })),
    products: enrichedProducts,
    pagination: result.pagination
  });
});

/**
 * @desc    Get stock alerts across all clinics
 * @route   GET /api/inventory/alerts
 * @access  Private (clinic auth)
 */
exports.getAlerts = asyncHandler(async (req, res) => {
  const { inventoryType, clinicId } = req.query;

  const alerts = await CentralInventory.getAlerts({ inventoryType, clinicId });

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  // Enrich alerts with clinic names
  const enrichedAlerts = alerts.map(alert => ({
    ...alert,
    clinicName: clinicMap[alert._sourceClinic]?.name || alert._sourceClinic,
    clinicShortName: clinicMap[alert._sourceClinic]?.shortName || alert._sourceClinic,
    availableSources: alert.availableSources.map(s => ({
      ...s,
      clinicName: clinicMap[s.clinic]?.name || s.clinic,
      clinicShortName: clinicMap[s.clinic]?.shortName || s.clinic
    }))
  }));

  res.json({
    success: true,
    alerts: enrichedAlerts,
    summary: {
      total: enrichedAlerts.length,
      critical: enrichedAlerts.filter(a => a.severity === 'critical').length,
      warning: enrichedAlerts.filter(a => a.severity === 'warning').length,
      canTransfer: enrichedAlerts.filter(a => a.canTransfer).length
    }
  });
});

/**
 * @desc    Get transfer recommendations
 * @route   GET /api/inventory/recommendations
 * @access  Private (clinic auth)
 */
exports.getRecommendations = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const recommendations = await CentralInventory.getTransferRecommendations(parseInt(limit));

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  // Enrich with clinic names
  const enrichedRecommendations = recommendations.map(rec => ({
    ...rec,
    fromClinicName: clinicMap[rec.fromClinic]?.name || rec.fromClinic,
    fromClinicShortName: clinicMap[rec.fromClinic]?.shortName || rec.fromClinic,
    toClinicName: clinicMap[rec.toClinic]?.name || rec.toClinic,
    toClinicShortName: clinicMap[rec.toClinic]?.shortName || rec.toClinic
  }));

  res.json({
    success: true,
    recommendations: enrichedRecommendations,
    count: enrichedRecommendations.length
  });
});

/**
 * @desc    Get inventory summary by clinic
 * @route   GET /api/inventory/summary
 * @access  Private (clinic auth)
 */
exports.getSummary = asyncHandler(async (req, res) => {
  const valueSummary = await CentralInventory.getValueSummary();

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName, type: c.type };
    return acc;
  }, {});

  // Enrich with clinic info
  const enrichedSummary = valueSummary.map(item => ({
    clinic: {
      clinicId: item._id,
      name: clinicMap[item._id]?.name || item._id,
      shortName: clinicMap[item._id]?.shortName || item._id,
      type: clinicMap[item._id]?.type || 'satellite'
    },
    byType: item.byType,
    totals: {
      totalItems: item.grandTotalItems,
      totalValue: item.grandTotalValue,
      outOfStock: item.totalOutOfStock,
      lowStock: item.totalLowStock
    }
  }));

  // Calculate grand totals
  const grandTotals = enrichedSummary.reduce((acc, clinic) => {
    acc.totalItems += clinic.totals.totalItems;
    acc.totalValue += clinic.totals.totalValue;
    acc.outOfStock += clinic.totals.outOfStock;
    acc.lowStock += clinic.totals.lowStock;
    return acc;
  }, { totalItems: 0, totalValue: 0, outOfStock: 0, lowStock: 0 });

  res.json({
    success: true,
    clinics: enrichedSummary,
    grandTotals
  });
});

/**
 * @desc    Get specific product stock across clinics
 * @route   GET /api/inventory/product/:sku
 * @access  Private (clinic auth)
 */
exports.getProductStock = asyncHandler(async (req, res) => {
  const { sku } = req.params;

  const stockData = await CentralInventory.find({
    sku,
    _deleted: { $ne: true }
  }).lean();

  if (stockData.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  const enrichedStock = stockData.map(s => ({
    clinic: {
      clinicId: s._sourceClinic,
      name: clinicMap[s._sourceClinic]?.name || s._sourceClinic,
      shortName: clinicMap[s._sourceClinic]?.shortName || s._sourceClinic
    },
    inventory: s.inventory,
    pricing: s.pricing,
    isDepot: s.isDepot,
    nearestExpiry: s.nearestExpiry
  }));

  res.json({
    success: true,
    sku,
    productInfo: stockData[0].productInfo,
    inventoryType: stockData[0].inventoryType,
    stockByClinic: enrichedStock,
    totalStock: enrichedStock.reduce((sum, s) => sum + (s.inventory?.currentStock || 0), 0)
  });
});

/**
 * @desc    Get inventory categories
 * @route   GET /api/inventory/categories
 * @access  Private (clinic auth)
 */
exports.getCategories = asyncHandler(async (req, res) => {
  const { inventoryType } = req.query;

  const matchStage = { _deleted: { $ne: true } };
  if (inventoryType) {
    matchStage.inventoryType = inventoryType;
  }

  const categories = await CentralInventory.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          type: '$inventoryType',
          category: '$productInfo.category'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        categories: {
          $push: {
            category: '$_id.category',
            count: '$count'
          }
        }
      }
    }
  ]);

  res.json({
    success: true,
    categories
  });
});

/**
 * @desc    Get expiring items across clinics
 * @route   GET /api/inventory/expiring
 * @access  Private (clinic auth)
 */
exports.getExpiringItems = asyncHandler(async (req, res) => {
  const { days = 90 } = req.query;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + parseInt(days));

  const expiring = await CentralInventory.find({
    _deleted: { $ne: true },
    hasExpiration: true,
    nearestExpiry: { $lte: cutoffDate }
  })
    .sort({ nearestExpiry: 1 })
    .limit(100)
    .lean();

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  const enrichedExpiring = expiring.map(item => ({
    _id: item._id,
    sku: item.sku,
    productInfo: item.productInfo,
    inventoryType: item.inventoryType,
    clinic: {
      clinicId: item._sourceClinic,
      name: clinicMap[item._sourceClinic]?.name || item._sourceClinic
    },
    currentStock: item.inventory?.currentStock,
    nearestExpiry: item.nearestExpiry,
    daysUntilExpiry: Math.ceil((new Date(item.nearestExpiry) - new Date()) / (1000 * 60 * 60 * 24))
  }));

  res.json({
    success: true,
    days: parseInt(days),
    count: enrichedExpiring.length,
    items: enrichedExpiring
  });
});
