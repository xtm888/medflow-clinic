/**
 * Unified Inventory Service
 *
 * Provides a consistent API across all inventory types:
 * - pharmacy (drugs/medications)
 * - frame (eyeglass frames)
 * - contactLens (contact lenses)
 * - opticalLens (optical lenses)
 * - reagent (lab reagents)
 * - labConsumable (lab consumables)
 * - surgicalSupply (surgical supplies)
 * - equipment (medical equipment)
 *
 * This service abstracts the differences between inventory types while
 * preserving the specialized functionality of each model.
 */

const {
  Inventory,
  PharmacyInventory,
  FrameInventory,
  ContactLensInventory,
  OpticalLensInventory,
  ReagentInventory,
  LabConsumableInventory,
  SurgicalSupplyInventory
} = require('../models/Inventory');
const EquipmentCatalog = require('../models/EquipmentCatalog');

// Model registry
const INVENTORY_MODELS = {
  pharmacy: PharmacyInventory,
  frame: FrameInventory,
  contactLens: ContactLensInventory,
  opticalLens: OpticalLensInventory,
  reagent: ReagentInventory,
  labConsumable: LabConsumableInventory,
  surgicalSupply: SurgicalSupplyInventory,
  equipment: EquipmentCatalog
};

// Type-specific configuration
const TYPE_CONFIG = {
  pharmacy: {
    nameField: 'medication.genericName',
    searchFields: ['medication.genericName', 'medication.brandName'],
    categoryField: 'category',
    defaultPopulate: ['drug'],
    displayName: 'Médicament'
  },
  frame: {
    nameField: 'model',
    searchFields: ['brand', 'model', 'sku'],
    categoryField: 'category',
    defaultPopulate: [],
    displayName: 'Monture'
  },
  contactLens: {
    nameField: 'productName',
    searchFields: ['productName', 'brand', 'sku'],
    categoryField: 'lensType',
    defaultPopulate: [],
    displayName: 'Lentille de contact'
  },
  opticalLens: {
    nameField: 'name',
    searchFields: ['name', 'manufacturer', 'sku'],
    categoryField: 'lensType',
    defaultPopulate: [],
    displayName: 'Verre optique'
  },
  reagent: {
    nameField: 'name',
    searchFields: ['name', 'catalogNumber'],
    categoryField: 'reagentType',
    defaultPopulate: [],
    displayName: 'Réactif'
  },
  labConsumable: {
    nameField: 'name',
    searchFields: ['name', 'catalogNumber'],
    categoryField: 'consumableType',
    defaultPopulate: [],
    displayName: 'Consommable labo'
  },
  surgicalSupply: {
    nameField: 'name',
    searchFields: ['name', 'catalogNumber'],
    categoryField: 'supplyCategory',
    defaultPopulate: [],
    displayName: 'Fourniture chirurgicale'
  },
  equipment: {
    nameField: 'name',
    searchFields: ['name', 'manufacturer', 'model'],
    categoryField: 'equipmentType',
    defaultPopulate: [],
    displayName: 'Équipement'
  }
};

class UnifiedInventoryService {

  /**
   * Get the model for an inventory type
   */
  getModel(type) {
    const Model = INVENTORY_MODELS[type];
    if (!Model) {
      throw new Error(`Unknown inventory type: ${type}. Valid types: ${Object.keys(INVENTORY_MODELS).join(', ')}`);
    }
    return Model;
  }

  /**
   * Get configuration for an inventory type
   */
  getConfig(type) {
    return TYPE_CONFIG[type] || TYPE_CONFIG.pharmacy;
  }

  /**
   * List all available inventory types
   */
  getTypes() {
    return Object.keys(INVENTORY_MODELS).map(type => ({
      id: type,
      displayName: TYPE_CONFIG[type]?.displayName || type
    }));
  }

  /**
   * Get all inventory items with unified query interface
   *
   * @param {string} type - Inventory type
   * @param {Object} options - Query options
   * @param {string} options.clinicId - Filter by clinic
   * @param {string} options.search - Search term
   * @param {string} options.category - Filter by category
   * @param {string} options.status - Stock status filter
   * @param {boolean} options.includeInactive - Include inactive items
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.sortBy - Sort field
   * @param {string} options.sortOrder - Sort order (asc/desc)
   */
  async getItems(type, options = {}) {
    const Model = this.getModel(type);
    const config = this.getConfig(type);
    const {
      clinicId,
      search,
      category,
      status,
      includeInactive = false,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Build query
    const query = {};

    // Clinic filter (required for most queries)
    if (clinicId) {
      query.clinic = clinicId;
    }

    // Active filter
    if (!includeInactive) {
      query.active = { $ne: false };
    }

    // Search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = config.searchFields.map(field => ({
        [field]: searchRegex
      }));
    }

    // Category filter
    if (category) {
      query[config.categoryField] = category;
    }

    // Status filter
    if (status) {
      query['inventory.status'] = status;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      Model.find(query)
        .populate(config.defaultPopulate)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      type,
      typeName: config.displayName
    };
  }

  /**
   * Get a single inventory item by ID
   */
  async getItem(type, itemId) {
    const Model = this.getModel(type);
    const config = this.getConfig(type);

    const item = await Model.findById(itemId)
      .populate(config.defaultPopulate);

    if (!item) {
      const error = new Error('Item not found');
      error.status = 404;
      throw error;
    }

    return item;
  }

  /**
   * Create a new inventory item
   */
  async createItem(type, data, userId) {
    const Model = this.getModel(type);

    const item = new Model({
      ...data,
      createdBy: userId
    });

    await item.save();
    return item;
  }

  /**
   * Update an inventory item
   */
  async updateItem(type, itemId, data, userId) {
    const Model = this.getModel(type);

    const item = await Model.findByIdAndUpdate(
      itemId,
      {
        ...data,
        updatedBy: userId
      },
      { new: true, runValidators: true }
    );

    if (!item) {
      const error = new Error('Item not found');
      error.status = 404;
      throw error;
    }

    return item;
  }

  /**
   * Delete (soft delete) an inventory item
   */
  async deleteItem(type, itemId, userId) {
    const Model = this.getModel(type);

    const item = await Model.findByIdAndUpdate(
      itemId,
      {
        active: false,
        deletedAt: new Date(),
        deletedBy: userId
      },
      { new: true }
    );

    if (!item) {
      const error = new Error('Item not found');
      error.status = 404;
      throw error;
    }

    return item;
  }

  /**
   * Get low stock items across all or specific inventory types
   *
   * @param {string[]} types - Array of inventory types (or null for all)
   * @param {string} clinicId - Filter by clinic
   */
  async getLowStock(types = null, clinicId = null) {
    const typesToQuery = types || Object.keys(INVENTORY_MODELS);
    const results = {};

    await Promise.all(typesToQuery.map(async (type) => {
      try {
        const Model = this.getModel(type);
        const config = this.getConfig(type);

        const query = {
          active: { $ne: false },
          $or: [
            { 'inventory.status': 'low-stock' },
            { 'inventory.status': 'out-of-stock' }
          ]
        };

        if (clinicId) {
          query.clinic = clinicId;
        }

        const items = await Model.find(query)
          .populate(config.defaultPopulate)
          .sort({ 'inventory.currentStock': 1 })
          .limit(100)
          .lean();

        results[type] = {
          items,
          count: items.length,
          typeName: config.displayName
        };
      } catch (error) {
        console.error(`Error getting low stock for ${type}:`, error.message);
        results[type] = { items: [], count: 0, error: error.message };
      }
    }));

    // Calculate totals
    const summary = {
      totalLowStock: Object.values(results).reduce((sum, r) => sum + r.count, 0),
      byType: results
    };

    return summary;
  }

  /**
   * Get expiring items across all or specific inventory types
   *
   * @param {string[]} types - Array of inventory types (or null for all)
   * @param {string} clinicId - Filter by clinic
   * @param {number} days - Days until expiration threshold
   */
  async getExpiring(types = null, clinicId = null, days = 30) {
    const typesToQuery = types || Object.keys(INVENTORY_MODELS);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const results = {};

    await Promise.all(typesToQuery.map(async (type) => {
      try {
        const Model = this.getModel(type);
        const config = this.getConfig(type);

        const query = {
          active: { $ne: false },
          'batches.expirationDate': {
            $gte: new Date(),
            $lte: futureDate
          },
          'batches.status': 'active'
        };

        if (clinicId) {
          query.clinic = clinicId;
        }

        const items = await Model.find(query)
          .populate(config.defaultPopulate)
          .sort({ 'batches.expirationDate': 1 })
          .limit(100)
          .lean();

        results[type] = {
          items,
          count: items.length,
          typeName: config.displayName
        };
      } catch (error) {
        // Some models don't have batches/expiration
        results[type] = { items: [], count: 0 };
      }
    }));

    // Calculate totals
    const summary = {
      totalExpiring: Object.values(results).reduce((sum, r) => sum + r.count, 0),
      threshold: `${days} days`,
      byType: results
    };

    return summary;
  }

  /**
   * Get inventory value summary
   *
   * @param {string} clinicId - Filter by clinic
   */
  async getInventoryValue(clinicId = null) {
    const results = {};

    await Promise.all(Object.keys(INVENTORY_MODELS).map(async (type) => {
      try {
        const Model = this.getModel(type);
        const config = this.getConfig(type);

        const matchStage = { active: { $ne: false } };
        if (clinicId) {
          matchStage.clinic = require('mongoose').Types.ObjectId(clinicId);
        }

        const aggregation = await Model.aggregate([
          { $match: matchStage },
          {
            $project: {
              totalValue: {
                $multiply: [
                  { $ifNull: ['$inventory.currentStock', 0] },
                  { $ifNull: ['$pricing.costPrice', { $ifNull: ['$pricing.sellingPrice', 0] }] }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              totalValue: { $sum: '$totalValue' },
              itemCount: { $sum: 1 }
            }
          }
        ]);

        results[type] = {
          totalValue: aggregation[0]?.totalValue || 0,
          itemCount: aggregation[0]?.itemCount || 0,
          typeName: config.displayName
        };
      } catch (error) {
        console.error(`Error calculating value for ${type}:`, error.message);
        results[type] = { totalValue: 0, itemCount: 0 };
      }
    }));

    // Calculate grand total
    const grandTotal = Object.values(results).reduce((sum, r) => sum + r.totalValue, 0);
    const totalItems = Object.values(results).reduce((sum, r) => sum + r.itemCount, 0);

    return {
      grandTotal,
      totalItems,
      byType: results
    };
  }

  /**
   * Transfer inventory between clinics
   *
   * @param {string} type - Inventory type
   * @param {string} itemId - Item ID
   * @param {number} quantity - Quantity to transfer
   * @param {string} fromClinicId - Source clinic
   * @param {string} toClinicId - Destination clinic
   * @param {string} userId - User performing transfer
   */
  async transferBetweenClinics(type, itemId, quantity, fromClinicId, toClinicId, userId) {
    const Model = this.getModel(type);

    // Find source item
    const sourceItem = await Model.findOne({
      _id: itemId,
      clinic: fromClinicId
    });

    if (!sourceItem) {
      const error = new Error('Source item not found');
      error.status = 404;
      throw error;
    }

    // Check available quantity
    const available = (sourceItem.inventory?.currentStock || 0) - (sourceItem.inventory?.reserved || 0);
    if (available < quantity) {
      const error = new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
      error.status = 400;
      throw error;
    }

    // Find or create destination item
    let destItem = await Model.findOne({
      clinic: toClinicId,
      // Match by SKU or name depending on type
      $or: [
        { sku: sourceItem.sku },
        { [this.getConfig(type).nameField]: sourceItem[this.getConfig(type).nameField.split('.')[0]] }
      ]
    });

    if (!destItem) {
      // Create new item at destination
      const sourceData = sourceItem.toObject();
      delete sourceData._id;
      delete sourceData.createdAt;
      delete sourceData.updatedAt;
      sourceData.clinic = toClinicId;
      sourceData.inventory = {
        ...sourceData.inventory,
        currentStock: 0,
        reserved: 0
      };
      sourceData.createdBy = userId;

      destItem = new Model(sourceData);
    }

    // Update quantities
    sourceItem.inventory.currentStock -= quantity;
    destItem.inventory.currentStock += quantity;

    // Add transaction records
    const transferId = `TRF-${Date.now()}`;

    if (sourceItem.transactions) {
      sourceItem.transactions.push({
        type: 'transferred',
        quantity,
        date: new Date(),
        performedBy: userId,
        reference: transferId,
        notes: `Transferred to clinic ${toClinicId}`,
        balanceBefore: sourceItem.inventory.currentStock + quantity,
        balanceAfter: sourceItem.inventory.currentStock
      });
    }

    if (destItem.transactions) {
      destItem.transactions.push({
        type: 'received',
        quantity,
        date: new Date(),
        performedBy: userId,
        reference: transferId,
        notes: `Transferred from clinic ${fromClinicId}`,
        balanceBefore: destItem.inventory.currentStock - quantity,
        balanceAfter: destItem.inventory.currentStock
      });
    }

    // Save both items
    await Promise.all([
      sourceItem.save(),
      destItem.save()
    ]);

    return {
      transferId,
      quantity,
      sourceItem: {
        id: sourceItem._id,
        newStock: sourceItem.inventory.currentStock
      },
      destItem: {
        id: destItem._id,
        newStock: destItem.inventory.currentStock
      }
    };
  }

  /**
   * Adjust stock quantity
   *
   * @param {string} type - Inventory type
   * @param {string} itemId - Item ID
   * @param {number} adjustment - Quantity adjustment (positive or negative)
   * @param {string} reason - Reason for adjustment
   * @param {string} userId - User performing adjustment
   */
  async adjustStock(type, itemId, adjustment, reason, userId) {
    const Model = this.getModel(type);

    const item = await Model.findById(itemId);
    if (!item) {
      const error = new Error('Item not found');
      error.status = 404;
      throw error;
    }

    const balanceBefore = item.inventory.currentStock;
    item.inventory.currentStock += adjustment;

    if (item.inventory.currentStock < 0) {
      const error = new Error('Stock cannot go negative');
      error.status = 400;
      throw error;
    }

    // Add transaction record
    if (item.transactions) {
      item.transactions.push({
        type: 'adjusted',
        quantity: Math.abs(adjustment),
        date: new Date(),
        performedBy: userId,
        notes: reason,
        balanceBefore,
        balanceAfter: item.inventory.currentStock
      });
    }

    await item.save();

    return {
      itemId: item._id,
      balanceBefore,
      balanceAfter: item.inventory.currentStock,
      adjustment
    };
  }

  /**
   * Get inventory dashboard summary for a clinic
   *
   * @param {string} clinicId - Clinic ID
   */
  async getDashboardSummary(clinicId) {
    const [lowStock, expiring, value] = await Promise.all([
      this.getLowStock(null, clinicId),
      this.getExpiring(null, clinicId, 30),
      this.getInventoryValue(clinicId)
    ]);

    return {
      lowStock: {
        total: lowStock.totalLowStock,
        critical: Object.values(lowStock.byType).reduce(
          (sum, t) => sum + t.items.filter(i => i.inventory?.status === 'out-of-stock').length,
          0
        )
      },
      expiring: {
        total: expiring.totalExpiring,
        within7Days: 0 // Would need additional query
      },
      value: {
        total: value.grandTotal,
        itemCount: value.totalItems
      },
      byType: Object.keys(INVENTORY_MODELS).map(type => ({
        type,
        name: TYPE_CONFIG[type].displayName,
        lowStock: lowStock.byType[type]?.count || 0,
        expiring: expiring.byType[type]?.count || 0,
        value: value.byType[type]?.totalValue || 0
      }))
    };
  }
}

module.exports = new UnifiedInventoryService();
