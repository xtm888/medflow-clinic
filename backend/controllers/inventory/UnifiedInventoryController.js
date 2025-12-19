/**
 * Unified Inventory Controller
 *
 * Single controller for all inventory types using the unified Inventory model
 * with Mongoose discriminators. Replaces separate controllers while maintaining
 * type-specific functionality through the inventoryType discriminator.
 *
 * @module controllers/inventory/UnifiedInventoryController
 */

const mongoose = require('mongoose');
const {
  Inventory,
  PharmacyInventory,
  FrameInventory,
  ContactLensInventory,
  OpticalLensInventory,
  ReagentInventory,
  LabConsumableInventory,
  SurgicalSupplyInventory
} = require('../../models/Inventory');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('UnifiedInventory');

// Helper: Escape regex special characters
const escapeRegex = (str) => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Map inventory types to their discriminator models
const TYPE_MODELS = {
  pharmacy: PharmacyInventory,
  frame: FrameInventory,
  contact_lens: ContactLensInventory,
  optical_lens: OpticalLensInventory,
  reagent: ReagentInventory,
  lab_consumable: LabConsumableInventory,
  surgical_supply: SurgicalSupplyInventory
};

// Search fields by inventory type
const SEARCH_FIELDS_BY_TYPE = {
  pharmacy: ['name', 'genericName', 'sku', 'barcode', 'brand', 'therapeuticClass'],
  frame: ['name', 'brand', 'model', 'sku', 'barcode', 'color'],
  contact_lens: ['name', 'brand', 'sku', 'barcode', 'material'],
  optical_lens: ['name', 'brand', 'sku', 'barcode', 'material'],
  reagent: ['name', 'sku', 'barcode', 'brand', 'reagentType'],
  lab_consumable: ['name', 'sku', 'barcode', 'brand', 'consumableType'],
  surgical_supply: ['name', 'sku', 'barcode', 'brand', 'supplyType']
};

// Default search fields
const DEFAULT_SEARCH_FIELDS = ['name', 'sku', 'barcode', 'brand', 'description'];

class UnifiedInventoryController {
  /**
   * Get the appropriate model for an inventory type
   */
  static getModel(inventoryType) {
    if (!inventoryType) return Inventory;
    const model = TYPE_MODELS[inventoryType];
    if (!model) {
      throw new Error(`Invalid inventory type: ${inventoryType}. Valid types: ${Object.keys(TYPE_MODELS).join(', ')}`);
    }
    return model;
  }

  /**
   * Build search query for text search
   */
  static buildSearchQuery(search, inventoryType) {
    if (!search) return null;
    const sanitizedSearch = escapeRegex(search);
    const fields = SEARCH_FIELDS_BY_TYPE[inventoryType] || DEFAULT_SEARCH_FIELDS;
    return {
      $or: fields.map(field => ({
        [field]: { $regex: sanitizedSearch, $options: 'i' }
      }))
    };
  }

  /**
   * Build type-specific filters
   */
  static buildTypeFilters(inventoryType, filters) {
    const query = {};

    // Common filters
    if (filters.brand) query.brand = { $regex: escapeRegex(filters.brand), $options: 'i' };
    if (filters.category) query.category = filters.category;
    if (filters.inStockOnly === 'true') query['inventory.currentStock'] = { $gt: 0 };

    // Type-specific filters
    switch (inventoryType) {
      case 'pharmacy':
        if (filters.dosageForm) query.dosageForm = filters.dosageForm;
        if (filters.controlled) query.controlled = filters.controlled === 'true';
        if (filters.therapeuticClass) query.therapeuticClass = filters.therapeuticClass;
        if (filters.prescriptionRequired) query.prescriptionRequired = filters.prescriptionRequired === 'true';
        break;

      case 'frame':
        if (filters.material) query.material = filters.material;
        if (filters.frameStyle) query.frameStyle = filters.frameStyle;
        if (filters.gender) query.gender = filters.gender;
        if (filters.tier) query.tier = filters.tier;
        break;

      case 'contact_lens':
        if (filters.lensType) query.lensType = filters.lensType;
        if (filters.wearSchedule) query.wearSchedule = filters.wearSchedule;
        if (filters.design) query.design = filters.design;
        if (filters.isTrial) query.isTrial = filters.isTrial === 'true';
        break;

      case 'optical_lens':
        if (filters.design) query.design = filters.design;
        if (filters.lensType) query.lensType = filters.lensType;
        if (filters.material) query.material = filters.material;
        if (filters.photochromic) query.photochromic = filters.photochromic === 'true';
        if (filters.polarized) query.polarized = filters.polarized === 'true';
        break;

      case 'reagent':
        if (filters.reagentType) query.reagentType = filters.reagentType;
        if (filters.qcRequired) query.qcRequired = filters.qcRequired === 'true';
        break;

      case 'lab_consumable':
        if (filters.consumableType) query.consumableType = filters.consumableType;
        if (filters.sterile) query['specifications.sterile'] = filters.sterile === 'true';
        break;

      case 'surgical_supply':
        if (filters.supplyType) query.supplyType = filters.supplyType;
        if (filters.sterile) query.sterile = filters.sterile === 'true';
        break;
    }

    return query;
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * GET all inventory items with filtering and pagination
   */
  static async getAll(req, res) {
    try {
      const {
        inventoryType,
        clinic,
        page = 1,
        limit = 50,
        search,
        status,
        sortBy = '-updatedAt',
        sortOrder = 'asc',
        ...customFilters
      } = req.query;

      // Build base query
      const query = { active: true };

      // Filter by inventory type if specified
      if (inventoryType) {
        query.inventoryType = inventoryType;
      }

      // Filter by clinic if specified (from query or user context)
      if (clinic) {
        query.clinic = clinic;
      } else if (req.user?.clinic) {
        query.clinic = req.user.clinic;
      }

      // Apply search
      if (search) {
        const searchQuery = UnifiedInventoryController.buildSearchQuery(search, inventoryType);
        if (searchQuery) Object.assign(query, searchQuery);
      }

      // Apply status filter
      if (status) {
        query['inventory.status'] = status;
      }

      // Apply type-specific filters
      if (inventoryType) {
        Object.assign(query, UnifiedInventoryController.buildTypeFilters(inventoryType, customFilters));
      }

      // Pagination
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 50));
      const skip = (validPage - 1) * validLimit;

      // Sorting
      const sort = sortBy.startsWith('-')
        ? { [sortBy.slice(1)]: -1 }
        : { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Get the appropriate model
      const Model = UnifiedInventoryController.getModel(inventoryType);

      const [items, total] = await Promise.all([
        Model.find(query)
          .sort(sort)
          .skip(skip)
          .limit(validLimit)
          .select('-transactions')
          .lean(),
        Model.countDocuments(query)
      ]);

      // Post-process: calculate available stock
      const processedItems = items.map(item => ({
        ...item,
        inventory: {
          ...item.inventory,
          available: (item.inventory?.currentStock || 0) - (item.inventory?.reserved || 0)
        }
      }));

      res.json({
        success: true,
        data: processedItems,
        total,
        page: validPage,
        pages: Math.ceil(total / validLimit),
        inventoryType: inventoryType || 'all'
      });
    } catch (error) {
      log.error('Error getting inventory items', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving inventory',
        error: error.message
      });
    }
  }

  /**
   * GET single item by ID
   */
  static async getOne(req, res) {
    try {
      const item = await Inventory.findById(req.params.id)
        .populate('createdBy', 'name firstName lastName')
        .populate('updatedBy', 'name firstName lastName')
        .populate('suppliers.supplier', 'name contactName email phone');

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      log.error('Error getting inventory item', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Error retrieving inventory item',
        error: error.message
      });
    }
  }

  /**
   * CREATE new inventory item
   */
  static async create(req, res) {
    try {
      const { inventoryType, ...itemData } = req.body;

      if (!inventoryType) {
        return res.status(400).json({
          success: false,
          message: 'inventoryType is required'
        });
      }

      // Get the appropriate discriminator model
      const Model = UnifiedInventoryController.getModel(inventoryType);

      // Prepare item data
      const data = {
        ...itemData,
        inventoryType,
        clinic: itemData.clinic || req.user?.clinic,
        createdBy: req.user?._id || req.user?.id,
        updatedBy: req.user?._id || req.user?.id
      };

      // Check SKU uniqueness within clinic
      if (data.sku && data.clinic) {
        const existing = await Inventory.findOne({
          clinic: data.clinic,
          sku: data.sku.toUpperCase()
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'An item with this SKU already exists in this clinic'
          });
        }
      }

      const item = new Model(data);
      await item.save();

      res.status(201).json({
        success: true,
        message: 'Inventory item created successfully',
        data: item
      });
    } catch (error) {
      log.error('Error creating inventory item', { error: error.message });
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate SKU or barcode'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error creating inventory item',
        error: error.message
      });
    }
  }

  /**
   * UPDATE inventory item
   */
  static async update(req, res) {
    try {
      const item = await Inventory.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      // Check SKU uniqueness if changed
      if (req.body.sku && req.body.sku.toUpperCase() !== item.sku) {
        const existing = await Inventory.findOne({
          clinic: item.clinic,
          sku: req.body.sku.toUpperCase(),
          _id: { $ne: item._id }
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'An item with this SKU already exists'
          });
        }
      }

      // Don't allow changing inventoryType
      delete req.body.inventoryType;

      // Apply updates
      Object.assign(item, req.body);
      item.updatedBy = req.user?._id || req.user?.id;
      await item.save();

      res.json({
        success: true,
        message: 'Inventory item updated successfully',
        data: item
      });
    } catch (error) {
      log.error('Error updating inventory item', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Error updating inventory item',
        error: error.message
      });
    }
  }

  /**
   * DELETE (soft delete) inventory item
   */
  static async delete(req, res) {
    try {
      const item = await Inventory.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      // Check for reserved stock
      if (item.inventory?.reserved > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete item with reserved stock'
        });
      }

      item.active = false;
      item.discontinued = true;
      item.discontinuedDate = new Date();
      item.discontinuedReason = req.body.reason || 'Discontinued by user';
      item.updatedBy = req.user?._id || req.user?.id;

      await item.save();

      res.json({
        success: true,
        message: 'Inventory item discontinued successfully'
      });
    } catch (error) {
      log.error('Error deleting inventory item', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Error deleting inventory item',
        error: error.message
      });
    }
  }

  // ============================================================================
  // STOCK OPERATIONS
  // ============================================================================

  /**
   * ADD stock (receive new batch)
   */
  static async addStock(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const item = await Inventory.findById(req.params.id).session(session);

      if (!item) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      const { lotNumber, quantity, expirationDate, ...batchData } = req.body;

      // Validate required fields
      if (!lotNumber || !quantity || quantity <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Lot number and positive quantity are required'
        });
      }

      // Check for duplicate lot number
      const existingLot = item.batches?.find(b => b.lotNumber === lotNumber);
      if (existingLot) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'A batch with this lot number already exists'
        });
      }

      // Use model's addBatch method
      await item.addBatch({
        lotNumber,
        quantity: parseInt(quantity),
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        ...batchData
      }, req.user?._id || req.user?.id);

      await session.commitTransaction();

      res.json({
        success: true,
        message: `Stock added successfully. New total: ${item.inventory.currentStock}`,
        data: {
          currentStock: item.inventory.currentStock,
          available: item.inventory.available,
          status: item.inventory.status
        }
      });
    } catch (error) {
      await session.abortTransaction();
      log.error('Error adding stock', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Error adding stock',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * ADJUST stock (manual adjustment)
   */
  static async adjustStock(req, res) {
    try {
      const item = await Inventory.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      const { quantity, adjustment, type = 'adjusted', reason } = req.body;
      const adjustmentValue = adjustment !== undefined ? parseInt(adjustment) : parseInt(quantity);

      if (isNaN(adjustmentValue)) {
        return res.status(400).json({
          success: false,
          message: 'Valid quantity or adjustment value is required'
        });
      }

      // Prevent negative stock
      const newStock = (item.inventory.currentStock || 0) + adjustmentValue;
      if (newStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Adjustment would result in negative stock'
        });
      }

      // Use model's adjustStock method
      await item.adjustStock(adjustmentValue, type, reason, req.user?._id || req.user?.id);

      res.json({
        success: true,
        message: 'Stock adjusted successfully',
        data: {
          currentStock: item.inventory.currentStock,
          available: item.inventory.available,
          status: item.inventory.status
        }
      });
    } catch (error) {
      log.error('Error adjusting stock', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Error adjusting stock',
        error: error.message
      });
    }
  }

  /**
   * RESERVE stock
   */
  static async reserveStock(req, res) {
    try {
      const item = await Inventory.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      const { quantity = 1, reference } = req.body;

      if (!reference) {
        return res.status(400).json({
          success: false,
          message: 'Reference (order ID, prescription ID, etc.) is required'
        });
      }

      await item.reserveStock(parseInt(quantity), reference, req.user?._id || req.user?.id);

      res.json({
        success: true,
        message: 'Stock reserved successfully',
        data: {
          currentStock: item.inventory.currentStock,
          reserved: item.inventory.reserved,
          available: item.inventory.available
        }
      });
    } catch (error) {
      log.error('Error reserving stock', { error: error.message, id: req.params.id });
      res.status(error.message.includes('Insufficient') ? 400 : 500).json({
        success: false,
        message: error.message || 'Error reserving stock'
      });
    }
  }

  /**
   * RELEASE reservation
   */
  static async releaseReservation(req, res) {
    try {
      const item = await Inventory.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      const { quantity = 1, reference } = req.body;

      await item.releaseReservation(parseInt(quantity), reference, req.user?._id || req.user?.id);

      res.json({
        success: true,
        message: 'Reservation released successfully',
        data: {
          currentStock: item.inventory.currentStock,
          reserved: item.inventory.reserved,
          available: item.inventory.available
        }
      });
    } catch (error) {
      log.error('Error releasing reservation', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Error releasing reservation',
        error: error.message
      });
    }
  }

  /**
   * TRANSFER between clinics
   */
  static async transfer(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { targetClinicId, quantity, reason } = req.body;

      if (!targetClinicId || !quantity || quantity <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Target clinic ID and positive quantity are required'
        });
      }

      const sourceItem = await Inventory.findById(req.params.id).session(session);

      if (!sourceItem) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Source inventory item not found'
        });
      }

      // Check available stock
      if (sourceItem.availableStock < quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient available stock. Available: ${sourceItem.availableStock}`
        });
      }

      // Find or create target item
      let targetItem = await Inventory.findOne({
        clinic: targetClinicId,
        sku: sourceItem.sku,
        inventoryType: sourceItem.inventoryType
      }).session(session);

      if (!targetItem) {
        // Create new item in target clinic with same details
        const Model = UnifiedInventoryController.getModel(sourceItem.inventoryType);
        targetItem = new Model({
          ...sourceItem.toObject(),
          _id: undefined,
          clinic: targetClinicId,
          inventory: {
            ...sourceItem.inventory.toObject(),
            currentStock: 0,
            reserved: 0,
            available: 0
          },
          batches: [],
          transactions: [],
          alerts: [],
          createdBy: req.user?._id,
          updatedBy: req.user?._id
        });
      }

      // Deduct from source
      await sourceItem.adjustStock(
        -quantity,
        'transferred',
        reason || `Transferred to clinic ${targetClinicId}`,
        req.user?._id,
        { reference: targetClinicId, referenceType: 'transfer' }
      );

      // Add to target
      await targetItem.adjustStock(
        quantity,
        'received',
        reason || `Received from clinic ${sourceItem.clinic}`,
        req.user?._id,
        { reference: sourceItem.clinic.toString(), referenceType: 'transfer' }
      );

      await session.commitTransaction();

      res.json({
        success: true,
        message: `${quantity} units transferred successfully`,
        data: {
          source: {
            id: sourceItem._id,
            currentStock: sourceItem.inventory.currentStock
          },
          target: {
            id: targetItem._id,
            currentStock: targetItem.inventory.currentStock
          }
        }
      });
    } catch (error) {
      await session.abortTransaction();
      log.error('Error transferring stock', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error transferring stock',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  }

  // ============================================================================
  // REPORTING & ANALYTICS
  // ============================================================================

  /**
   * GET inventory statistics
   */
  static async getStats(req, res) {
    try {
      const { clinic, inventoryType } = req.query;
      const clinicId = clinic || req.user?.clinic;

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: 'Clinic ID is required'
        });
      }

      const summary = await Inventory.getSummary(clinicId);

      // If specific type requested, filter results
      const data = inventoryType
        ? summary.filter(s => s._id === inventoryType)
        : summary;

      // Calculate totals
      const totals = data.reduce((acc, type) => ({
        totalItems: acc.totalItems + type.totalItems,
        totalValue: acc.totalValue + type.totalValue,
        lowStockCount: acc.lowStockCount + type.lowStockCount,
        outOfStockCount: acc.outOfStockCount + type.outOfStockCount
      }), { totalItems: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0 });

      res.json({
        success: true,
        data: {
          byType: data,
          totals
        }
      });
    } catch (error) {
      log.error('Error getting inventory stats', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving statistics',
        error: error.message
      });
    }
  }

  /**
   * GET low stock items
   */
  static async getLowStock(req, res) {
    try {
      const { clinic, inventoryType } = req.query;
      const clinicId = clinic || req.user?.clinic;

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: 'Clinic ID is required'
        });
      }

      const items = await Inventory.getLowStock(clinicId, inventoryType);

      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      log.error('Error getting low stock items', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving low stock items',
        error: error.message
      });
    }
  }

  /**
   * GET expiring items
   */
  static async getExpiring(req, res) {
    try {
      const { clinic, days = 30 } = req.query;
      const clinicId = clinic || req.user?.clinic;

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: 'Clinic ID is required'
        });
      }

      const items = await Inventory.getExpiring(clinicId, parseInt(days));

      res.json({
        success: true,
        data: items,
        count: items.length,
        daysThreshold: parseInt(days)
      });
    } catch (error) {
      log.error('Error getting expiring items', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving expiring items',
        error: error.message
      });
    }
  }

  /**
   * GET inventory value
   */
  static async getInventoryValue(req, res) {
    try {
      const { clinic, inventoryType } = req.query;
      const clinicId = clinic || req.user?.clinic;

      const match = { active: true };
      if (clinicId) match.clinic = new mongoose.Types.ObjectId(clinicId);
      if (inventoryType) match.inventoryType = inventoryType;

      const value = await Inventory.aggregate([
        { $match: match },
        {
          $group: {
            _id: inventoryType ? null : '$inventoryType',
            totalCostValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$inventory.currentStock', 0] },
                  { $ifNull: ['$pricing.costPrice', 0] }
                ]
              }
            },
            totalSaleValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$inventory.currentStock', 0] },
                  { $ifNull: ['$pricing.sellingPrice', 0] }
                ]
              }
            },
            itemCount: { $sum: 1 },
            totalUnits: { $sum: { $ifNull: ['$inventory.currentStock', 0] } }
          }
        }
      ]);

      res.json({
        success: true,
        data: inventoryType ? (value[0] || { totalCostValue: 0, totalSaleValue: 0, itemCount: 0 }) : value
      });
    } catch (error) {
      log.error('Error getting inventory value', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error calculating inventory value',
        error: error.message
      });
    }
  }

  // ============================================================================
  // SEARCH & LOOKUP
  // ============================================================================

  /**
   * SEARCH inventory
   */
  static async search(req, res) {
    try {
      const { q, clinic, inventoryType, inStockOnly, limit = 20 } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query (q) is required'
        });
      }

      const clinicId = clinic || req.user?.clinic;

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: 'Clinic ID is required'
        });
      }

      const items = await Inventory.search(clinicId, q, {
        inventoryType,
        inStockOnly: inStockOnly === 'true',
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      log.error('Error searching inventory', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error searching inventory',
        error: error.message
      });
    }
  }

  /**
   * GET brands
   */
  static async getBrands(req, res) {
    try {
      const { clinic, inventoryType } = req.query;
      const clinicId = clinic || req.user?.clinic;

      const match = { active: true };
      if (clinicId) match.clinic = new mongoose.Types.ObjectId(clinicId);
      if (inventoryType) match.inventoryType = inventoryType;

      const brands = await Inventory.aggregate([
        { $match: match },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: brands.map(b => ({ brand: b._id, count: b.count }))
      });
    } catch (error) {
      log.error('Error getting brands', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving brands',
        error: error.message
      });
    }
  }

  /**
   * GET categories
   */
  static async getCategories(req, res) {
    try {
      const { clinic, inventoryType } = req.query;
      const clinicId = clinic || req.user?.clinic;

      const match = { active: true };
      if (clinicId) match.clinic = new mongoose.Types.ObjectId(clinicId);
      if (inventoryType) match.inventoryType = inventoryType;

      const categories = await Inventory.aggregate([
        { $match: match },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: categories.map(c => ({ category: c._id, count: c.count }))
      });
    } catch (error) {
      log.error('Error getting categories', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving categories',
        error: error.message
      });
    }
  }

  /**
   * CHECK availability
   */
  static async checkAvailability(req, res) {
    try {
      const { itemId, quantity = 1 } = req.query;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      const item = await Inventory.findById(itemId)
        .select('sku name brand inventory pricing inventoryType');

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }

      const available = (item.inventory?.currentStock || 0) - (item.inventory?.reserved || 0);
      const isAvailable = available >= parseInt(quantity);

      res.json({
        success: true,
        data: {
          itemId: item._id,
          sku: item.sku,
          name: item.name,
          brand: item.brand,
          inventoryType: item.inventoryType,
          currentStock: item.inventory?.currentStock || 0,
          reserved: item.inventory?.reserved || 0,
          available,
          requestedQuantity: parseInt(quantity),
          isAvailable,
          status: item.inventory?.status,
          price: item.pricing?.sellingPrice
        }
      });
    } catch (error) {
      log.error('Error checking availability', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error checking availability',
        error: error.message
      });
    }
  }

  // ============================================================================
  // ALERTS & TRANSACTIONS
  // ============================================================================

  /**
   * GET alerts
   */
  static async getAlerts(req, res) {
    try {
      const { clinic, inventoryType, resolved = 'false' } = req.query;
      const clinicId = clinic || req.user?.clinic;

      const query = { active: true };
      if (clinicId) query.clinic = clinicId;
      if (inventoryType) query.inventoryType = inventoryType;
      if (resolved === 'false') query['alerts.resolved'] = false;

      const items = await Inventory.find(query)
        .select('sku name brand inventoryType alerts inventory');

      const alerts = [];
      items.forEach(item => {
        (item.alerts || [])
          .filter(a => resolved === 'true' || !a.resolved)
          .forEach(alert => {
            alerts.push({
              itemId: item._id,
              sku: item.sku,
              name: item.name,
              brand: item.brand,
              inventoryType: item.inventoryType,
              ...alert.toObject()
            });
          });
      });

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

      res.json({
        success: true,
        data: alerts,
        count: alerts.length
      });
    } catch (error) {
      log.error('Error getting alerts', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving alerts',
        error: error.message
      });
    }
  }

  /**
   * RESOLVE alert
   */
  static async resolveAlert(req, res) {
    try {
      const { alertId } = req.params;

      const item = await Inventory.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      const alert = item.alerts?.id(alertId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      alert.resolved = true;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = req.user?._id || req.user?.id;

      await item.save();

      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      log.error('Error resolving alert', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error resolving alert',
        error: error.message
      });
    }
  }

  /**
   * GET transaction history
   */
  static async getTransactions(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;

      const item = await Inventory.findById(req.params.id)
        .select('transactions sku name brand inventoryType')
        .populate('transactions.performedBy', 'name firstName lastName');

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      // Sort transactions by date descending
      const sortedTransactions = [...(item.transactions || [])]
        .sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt));

      // Paginate
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 50));
      const startIndex = (validPage - 1) * validLimit;
      const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + validLimit);

      res.json({
        success: true,
        data: {
          item: {
            _id: item._id,
            sku: item.sku,
            name: item.name,
            brand: item.brand,
            inventoryType: item.inventoryType
          },
          transactions: paginatedTransactions,
          pagination: {
            page: validPage,
            limit: validLimit,
            total: sortedTransactions.length,
            pages: Math.ceil(sortedTransactions.length / validLimit)
          }
        }
      });
    } catch (error) {
      log.error('Error getting transactions', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving transactions',
        error: error.message
      });
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * CHECK expirations and generate alerts
   */
  static async checkExpirations(req, res) {
    try {
      const { clinic, inventoryType, days = 30 } = req.query;
      const clinicId = clinic || req.user?.clinic;

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: 'Clinic ID is required'
        });
      }

      const query = { clinic: clinicId, active: true };
      if (inventoryType) query.inventoryType = inventoryType;

      const items = await Inventory.find(query);

      let alertsGenerated = 0;
      for (const item of items) {
        const alerts = item.checkExpirations(parseInt(days));
        if (alerts.length > 0) {
          alertsGenerated += alerts.length;
          await item.save();
        }
      }

      res.json({
        success: true,
        message: `Expiration check complete. ${alertsGenerated} alerts generated.`,
        data: {
          itemsChecked: items.length,
          alertsGenerated
        }
      });
    } catch (error) {
      log.error('Error checking expirations', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error checking expirations',
        error: error.message
      });
    }
  }

  /**
   * GET inventory types enum
   */
  static async getTypes(_req, res) {
    res.json({
      success: true,
      data: Object.keys(TYPE_MODELS).map(type => ({
        value: type,
        label: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }))
    });
  }
}

module.exports = UnifiedInventoryController;
