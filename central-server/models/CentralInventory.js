const mongoose = require('mongoose');

/**
 * CentralInventory Model
 * Aggregated inventory data from all clinics
 * Supports pharmacy, frames, contact lenses, reagents, lab consumables
 */
const centralInventorySchema = new mongoose.Schema({
  // Original ID from source clinic
  _originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Source clinic
  _sourceClinic: {
    type: String,
    required: true,
    index: true
  },

  // Sync metadata
  _syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  _lastModified: Date,
  _deleted: {
    type: Boolean,
    default: false
  },
  _version: {
    type: Number,
    default: 1
  },

  // Inventory type (which model this came from)
  inventoryType: {
    type: String,
    enum: ['pharmacy', 'frame', 'contactLens', 'reagent', 'labConsumable'],
    required: true,
    index: true
  },

  // Common identification
  sku: {
    type: String,
    index: true
  },
  barcode: String,

  // Product info (varies by type)
  productInfo: {
    // Common
    name: String,
    brand: String,
    category: String,

    // Pharmacy specific
    genericName: String,
    brandName: String,
    strength: String,
    formulation: String,
    dciCode: String,

    // Frame specific
    model: String,
    color: String,
    size: String,
    material: String,
    frameType: String,
    gender: String,

    // Contact lens specific
    productLine: String,
    baseCurve: Number,
    diameter: Number,
    power: { from: Number, to: Number },
    lensType: String,
    wearSchedule: String,
    packSize: Number,

    // Lab specific
    unit: String,
    storageTemp: String,
    tubeType: String,
    tubeColor: String
  },

  // Stock levels
  inventory: {
    currentStock: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    minimumStock: { type: Number, default: 0 },
    reorderPoint: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['in-stock', 'low-stock', 'out-of-stock', 'discontinued', 'on-order'],
      default: 'in-stock',
      index: true
    }
  },

  // Pricing
  pricing: {
    costPrice: Number,
    sellingPrice: Number,
    margin: Number,
    currency: { type: String, default: 'CDF' }
  },

  // Expiration tracking (for pharmacy, reagents)
  hasExpiration: { type: Boolean, default: false },
  nearestExpiry: Date,
  expiredStock: { type: Number, default: 0 },

  // Depot flag
  isDepot: {
    type: Boolean,
    default: false,
    index: true
  },

  // Usage stats
  usage: {
    totalSold: { type: Number, default: 0 },
    lastSoldDate: Date,
    averageMonthlyUsage: Number
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
centralInventorySchema.index({ _originalId: 1, _sourceClinic: 1 }, { unique: true });
centralInventorySchema.index({ sku: 1, _sourceClinic: 1 });
centralInventorySchema.index({ inventoryType: 1, 'inventory.status': 1 });
centralInventorySchema.index({ inventoryType: 1, sku: 1 });

// Text index for search
centralInventorySchema.index({
  sku: 'text',
  'productInfo.name': 'text',
  'productInfo.brand': 'text',
  'productInfo.genericName': 'text',
  'productInfo.brandName': 'text'
});

// Static: Get consolidated inventory across clinics
centralInventorySchema.statics.getConsolidated = async function(options = {}) {
  const {
    inventoryType,
    search,
    category,
    status,
    page = 1,
    limit = 50
  } = options;

  const matchStage = { _deleted: { $ne: true } };

  if (inventoryType) {
    matchStage.inventoryType = inventoryType;
  }

  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    matchStage.$or = [
      { sku: searchRegex },
      { 'productInfo.name': searchRegex },
      { 'productInfo.brand': searchRegex },
      { 'productInfo.genericName': searchRegex },
      { 'productInfo.brandName': searchRegex }
    ];
  }

  if (category) {
    matchStage['productInfo.category'] = category;
  }

  if (status) {
    matchStage['inventory.status'] = status;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$sku',
        inventoryType: { $first: '$inventoryType' },
        productInfo: { $first: '$productInfo' },
        stockByClinic: {
          $push: {
            clinic: '$_sourceClinic',
            originalId: '$_originalId',
            currentStock: '$inventory.currentStock',
            reserved: '$inventory.reserved',
            available: '$inventory.available',
            status: '$inventory.status',
            minimumStock: '$inventory.minimumStock',
            reorderPoint: '$inventory.reorderPoint',
            isDepot: '$isDepot',
            pricing: '$pricing',
            nearestExpiry: '$nearestExpiry'
          }
        },
        totalStock: { $sum: '$inventory.currentStock' },
        totalReserved: { $sum: '$inventory.reserved' },
        clinicsWithStock: {
          $sum: { $cond: [{ $gt: ['$inventory.currentStock', 0] }, 1, 0] }
        },
        clinicsOutOfStock: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'out-of-stock'] }, 1, 0] }
        },
        clinicsLowStock: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'low-stock'] }, 1, 0] }
        },
        hasDepotStock: {
          $max: { $cond: ['$isDepot', '$inventory.currentStock', 0] }
        }
      }
    },
    {
      $addFields: {
        alertLevel: {
          $cond: [
            { $gt: ['$clinicsOutOfStock', 0] },
            'critical',
            { $cond: [{ $gt: ['$clinicsLowStock', 0] }, 'warning', 'ok'] }
          ]
        }
      }
    },
    { $sort: { clinicsOutOfStock: -1, clinicsLowStock: -1, totalStock: 1 } },
    { $skip: (parseInt(page) - 1) * parseInt(limit) },
    { $limit: parseInt(limit) }
  ];

  const [results, countResult] = await Promise.all([
    this.aggregate(pipeline),
    this.aggregate([
      { $match: matchStage },
      { $group: { _id: '$sku' } },
      { $count: 'total' }
    ])
  ]);

  return {
    products: results,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult[0]?.total || 0,
      pages: Math.ceil((countResult[0]?.total || 0) / parseInt(limit))
    }
  };
};

// Static: Get stock alerts
centralInventorySchema.statics.getAlerts = async function(options = {}) {
  const { inventoryType, clinicId } = options;

  const matchStage = {
    _deleted: { $ne: true },
    'inventory.status': { $in: ['out-of-stock', 'low-stock'] }
  };

  if (inventoryType) {
    matchStage.inventoryType = inventoryType;
  }

  if (clinicId) {
    matchStage._sourceClinic = clinicId;
  }

  const alerts = await this.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'centralinventories',
        let: { sku: '$sku', sourceClinic: '$_sourceClinic' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$sku', '$$sku'] },
                  { $ne: ['$_sourceClinic', '$$sourceClinic'] },
                  { $gt: ['$inventory.currentStock', '$inventory.minimumStock'] }
                ]
              }
            }
          },
          {
            $project: {
              clinic: '$_sourceClinic',
              available: { $subtract: ['$inventory.currentStock', '$inventory.minimumStock'] }
            }
          }
        ],
        as: 'availableSources'
      }
    },
    {
      $project: {
        _id: 1,
        _originalId: 1,
        _sourceClinic: 1,
        inventoryType: 1,
        sku: 1,
        productInfo: 1,
        inventory: 1,
        alertType: '$inventory.status',
        severity: {
          $cond: [{ $eq: ['$inventory.status', 'out-of-stock'] }, 'critical', 'warning']
        },
        neededQuantity: {
          $subtract: [
            { $ifNull: ['$inventory.reorderPoint', '$inventory.minimumStock'] },
            '$inventory.currentStock'
          ]
        },
        availableSources: 1,
        canTransfer: { $gt: [{ $size: '$availableSources' }, 0] }
      }
    },
    { $sort: { severity: 1, 'productInfo.name': 1 } }
  ]);

  return alerts;
};

// Static: Get transfer recommendations
centralInventorySchema.statics.getTransferRecommendations = async function(limit = 20) {
  const recommendations = [];

  // Find items where one clinic is out and another has surplus
  const imbalances = await this.aggregate([
    { $match: { _deleted: { $ne: true } } },
    {
      $group: {
        _id: '$sku',
        inventoryType: { $first: '$inventoryType' },
        productInfo: { $first: '$productInfo' },
        clinicStocks: {
          $push: {
            clinic: '$_sourceClinic',
            originalId: '$_originalId',
            stock: '$inventory.currentStock',
            min: '$inventory.minimumStock',
            status: '$inventory.status',
            isDepot: '$isDepot'
          }
        }
      }
    },
    {
      $match: {
        $or: [
          { 'clinicStocks.status': 'out-of-stock' },
          { 'clinicStocks.status': 'low-stock' }
        ]
      }
    }
  ]);

  for (const item of imbalances) {
    const needy = item.clinicStocks.filter(c =>
      c.status === 'out-of-stock' || c.status === 'low-stock'
    );
    const surplus = item.clinicStocks.filter(c =>
      c.stock > (c.min || 0) * 1.5 || c.isDepot
    ).sort((a, b) => b.stock - a.stock);

    if (needy.length > 0 && surplus.length > 0) {
      for (const needyClinic of needy) {
        const supplier = surplus.find(s => s.clinic !== needyClinic.clinic);
        if (!supplier) continue;

        const suggestedQty = Math.min(
          Math.floor(supplier.stock - (supplier.min || 0)),
          (needyClinic.min || 10) - needyClinic.stock
        );

        if (suggestedQty > 0) {
          recommendations.push({
            sku: item._id,
            inventoryType: item.inventoryType,
            productName: item.productInfo?.name || item.productInfo?.genericName || item._id,
            productInfo: item.productInfo,
            fromClinic: supplier.clinic,
            fromClinicStock: supplier.stock,
            fromOriginalId: supplier.originalId,
            toClinic: needyClinic.clinic,
            toClinicStock: needyClinic.stock,
            toOriginalId: needyClinic.originalId,
            suggestedQuantity: suggestedQty,
            priority: needyClinic.status === 'out-of-stock' ? 'high' : 'normal',
            reason: needyClinic.status === 'out-of-stock' ? 'stock-out' : 'rebalancing'
          });
        }
      }
    }
  }

  // Sort by priority and return top recommendations
  return recommendations
    .sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return 0;
    })
    .slice(0, limit);
};

// Static: Upsert from clinic sync
centralInventorySchema.statics.upsertFromSync = async function(clinicId, inventoryType, data) {
  const { _id, ...itemData } = data;

  // Map the data structure based on inventory type
  const productInfo = {};
  const inventory = {
    currentStock: itemData.inventory?.currentStock || itemData.currentStock || 0,
    reserved: itemData.inventory?.reserved || itemData.reserved || 0,
    available: itemData.inventory?.available || 0,
    minimumStock: itemData.inventory?.minimumStock || itemData.minimumStock || 0,
    reorderPoint: itemData.inventory?.reorderPoint || itemData.reorderPoint || 0,
    status: itemData.inventory?.status || itemData.status || 'in-stock'
  };

  switch (inventoryType) {
    case 'pharmacy':
      productInfo.genericName = itemData.medication?.genericName;
      productInfo.brandName = itemData.medication?.brandName;
      productInfo.strength = itemData.medication?.strength;
      productInfo.formulation = itemData.medication?.formulation;
      productInfo.category = itemData.category;
      productInfo.dciCode = itemData.medication?.dciCode;
      break;

    case 'frame':
      productInfo.brand = itemData.brand;
      productInfo.model = itemData.model;
      productInfo.color = itemData.color;
      productInfo.size = itemData.size;
      productInfo.material = itemData.material;
      productInfo.frameType = itemData.frameType;
      productInfo.gender = itemData.gender;
      productInfo.category = itemData.category;
      break;

    case 'contactLens':
      productInfo.brand = itemData.brand;
      productInfo.productLine = itemData.productLine;
      productInfo.baseCurve = itemData.parameters?.baseCurve;
      productInfo.diameter = itemData.parameters?.diameter;
      productInfo.lensType = itemData.lensType;
      productInfo.wearSchedule = itemData.wearSchedule;
      productInfo.packSize = itemData.packSize;
      break;

    case 'reagent':
    case 'labConsumable':
      productInfo.name = itemData.name;
      productInfo.brand = itemData.brand;
      productInfo.category = itemData.category;
      productInfo.unit = itemData.unit;
      productInfo.storageTemp = itemData.storageConditions?.temperature;
      productInfo.tubeType = itemData.tubeType;
      productInfo.tubeColor = itemData.tubeColor;
      break;
  }

  return this.findOneAndUpdate(
    { _originalId: _id, _sourceClinic: clinicId },
    {
      $set: {
        _originalId: _id,
        _sourceClinic: clinicId,
        _syncedAt: new Date(),
        _lastModified: itemData.updatedAt || new Date(),
        inventoryType,
        sku: itemData.sku,
        barcode: itemData.barcode,
        productInfo,
        inventory,
        pricing: itemData.pricing,
        hasExpiration: ['pharmacy', 'reagent', 'contactLens'].includes(inventoryType),
        nearestExpiry: itemData.nearestExpiry || itemData.batches?.[0]?.expirationDate,
        isDepot: itemData.isDepot || false,
        usage: itemData.usage
      },
      $inc: { _version: 1 }
    },
    { upsert: true, new: true }
  );
};

// Static: Get inventory value summary
centralInventorySchema.statics.getValueSummary = async function() {
  return this.aggregate([
    { $match: { _deleted: { $ne: true } } },
    {
      $group: {
        _id: {
          clinic: '$_sourceClinic',
          type: '$inventoryType'
        },
        totalItems: { $sum: 1 },
        totalStock: { $sum: '$inventory.currentStock' },
        totalValue: {
          $sum: { $multiply: ['$inventory.currentStock', { $ifNull: ['$pricing.costPrice', 0] }] }
        },
        outOfStock: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'out-of-stock'] }, 1, 0] }
        },
        lowStock: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'low-stock'] }, 1, 0] }
        }
      }
    },
    {
      $group: {
        _id: '$_id.clinic',
        byType: {
          $push: {
            type: '$_id.type',
            totalItems: '$totalItems',
            totalStock: '$totalStock',
            totalValue: '$totalValue',
            outOfStock: '$outOfStock',
            lowStock: '$lowStock'
          }
        },
        grandTotalItems: { $sum: '$totalItems' },
        grandTotalValue: { $sum: '$totalValue' },
        totalOutOfStock: { $sum: '$outOfStock' },
        totalLowStock: { $sum: '$lowStock' }
      }
    }
  ]);
};

module.exports = mongoose.model('CentralInventory', centralInventorySchema);
