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

// Import transaction utilities for standalone-compatible operations
const { withTransactionRetry, isTransactionSupported } = require('../../utils/transactions');

// Helper: Escape regex special characters
const escapeRegex = (str) => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Helper: Validate and convert to ObjectId string
const toValidObjectIdString = (id) => {
  if (!id) return null;
  // If it's already an ObjectId object, convert to string
  const idStr = id.toString ? id.toString() : String(id);
  // Validate it's a valid 24-character hex string
  if (/^[a-fA-F0-9]{24}$/.test(idStr)) {
    return idStr;
  }
  return null;
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
   * Flatten nested inventory fields for frontend compatibility
   * @param {Object} item - Raw inventory item from database
   * @returns {Object} - Item with flattened fields
   */
  static flattenItem(item) {
    if (!item) return item;

    const flattened = {
      ...item,
      // Flatten inventory subdocument fields
      currentStock: item.inventory?.currentStock || 0,
      reserved: item.inventory?.reserved || 0,
      available: (item.inventory?.currentStock || 0) - (item.inventory?.reserved || 0),
      status: item.inventory?.status || 'in_stock',
      reorderPoint: item.inventory?.reorderPoint || 0,
      minimumStock: item.inventory?.minimumStock || 0,
      unit: item.inventory?.unit || 'unit',
      // Flatten pricing fields
      price: item.pricing?.sellingPrice || item.pricing?.unitPrice || 0,
      costPrice: item.pricing?.costPrice || 0,
      // Keep nested objects for backward compatibility
      inventory: {
        ...item.inventory,
        available: (item.inventory?.currentStock || 0) - (item.inventory?.reserved || 0)
      }
    };

    // For pharmacy items, also flatten medication fields
    if (item.inventoryType === 'pharmacy') {
      if (!flattened.name && item.medication?.brandName) {
        flattened.name = item.medication.brandName;
      }
      if (!flattened.genericName && item.medication?.genericName) {
        flattened.genericName = item.medication.genericName;
      }
      if (item.medication?.dosageForm) {
        flattened.dosageForm = flattened.dosageForm || item.medication.dosageForm;
      }
      if (item.medication?.strength) {
        flattened.strength = flattened.strength || item.medication.strength;
      }
    }

    return flattened;
  }

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

      // Post-process: flatten nested fields for frontend compatibility
      const processedItems = items.map(item => UnifiedInventoryController.flattenItem(item));

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
        .populate('suppliers.supplier', 'name contactName email phone')
        .lean();

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      res.json({
        success: true,
        data: UnifiedInventoryController.flattenItem(item)
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
   *
   * Uses withTransactionRetry for standalone-compatible operation.
   * In standalone mode, falls back to atomic operations without transaction.
   */
  static async addStock(req, res) {
    try {
      const { lotNumber, quantity, expirationDate, ...batchData } = req.body;

      // Validate required fields before transaction
      if (!lotNumber || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Numero de lot et quantite positive requis'
        });
      }

      const result = await withTransactionRetry(async (session) => {
        const queryOptions = session ? { session } : {};
        const item = await Inventory.findById(req.params.id, null, queryOptions);

        if (!item) {
          throw new Error('Article introuvable');
        }

        // Check for duplicate lot number
        const existingLot = item.batches?.find(b => b.lotNumber === lotNumber);
        if (existingLot) {
          throw new Error('Un lot avec ce numero existe deja');
        }

        // Use model's addBatch method
        await item.addBatch({
          lotNumber,
          quantity: parseInt(quantity),
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
          ...batchData
        }, req.user?._id || req.user?.id);

        return {
          currentStock: item.inventory.currentStock,
          available: item.inventory.available,
          status: item.inventory.status
        };
      });

      res.json({
        success: true,
        message: `Stock ajoute avec succes. Nouveau total: ${result.currentStock}`,
        data: result
      });
    } catch (error) {
      log.error('Error adding stock', { error: error.message, id: req.params.id });

      // Return appropriate status code based on error type
      const statusCode = error.message.includes('introuvable') ? 404 :
                        error.message.includes('existe deja') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erreur lors de l\'ajout du stock'
      });
    }
  }

  /**
   * ADJUST stock (manual adjustment)
   *
   * Uses atomic $inc operation with condition to prevent negative stock.
   * This prevents race conditions where concurrent adjustments could
   * result in inconsistent stock levels.
   */
  static async adjustStock(req, res) {
    try {
      const { quantity, adjustment, type = 'adjusted', reason } = req.body;
      const adjustmentValue = adjustment !== undefined ? parseInt(adjustment) : parseInt(quantity);

      if (isNaN(adjustmentValue)) {
        return res.status(400).json({
          success: false,
          message: 'Valeur de quantite ou ajustement valide requise'
        });
      }

      const userId = req.user?._id || req.user?.id;
      const now = new Date();

      // Build atomic update query
      const updateQuery = {
        $inc: {
          'inventory.currentStock': adjustmentValue,
          'usage.totalAdjusted': Math.abs(adjustmentValue),
          version: 1
        },
        $set: {
          updatedBy: userId
        },
        $push: {
          transactions: {
            type: type || 'adjusted',
            quantity: adjustmentValue,
            reason: reason || 'Ajustement manuel',
            performedBy: userId,
            performedAt: now
          }
        }
      };

      // Build condition - for decrements, ensure sufficient stock
      const condition = { _id: req.params.id };
      if (adjustmentValue < 0) {
        condition['inventory.currentStock'] = { $gte: Math.abs(adjustmentValue) };
      }

      // Use atomic findOneAndUpdate
      const result = await Inventory.findOneAndUpdate(
        condition,
        updateQuery,
        { new: true, runValidators: true }
      );

      if (!result) {
        // Determine specific error
        const item = await Inventory.findById(req.params.id).select('inventory.currentStock').lean();

        if (!item) {
          return res.status(404).json({
            success: false,
            message: 'Article introuvable'
          });
        }

        // Stock insufficient for negative adjustment
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant. Disponible: ${item.inventory.currentStock}, Demande: ${Math.abs(adjustmentValue)}`
        });
      }

      // Update status based on new stock level (separate operation for simplicity)
      result.updateInventoryStatus();
      await result.save();

      res.json({
        success: true,
        message: 'Stock ajuste avec succes',
        data: {
          currentStock: result.inventory.currentStock,
          available: result.inventory.available,
          status: result.inventory.status
        }
      });
    } catch (error) {
      log.error('Error adjusting stock', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajustement du stock',
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
   *
   * Uses withTransactionRetry for atomic transfer that works in standalone mode.
   * In standalone, operations are still atomic at the document level via $inc.
   */
  static async transfer(req, res) {
    try {
      const { targetClinicId, quantity, reason } = req.body;

      // Validate before transaction
      if (!targetClinicId || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'ID clinique cible et quantite positive requis'
        });
      }

      const userId = req.user?._id || req.user?.id;
      const transferQuantity = parseInt(quantity);

      const result = await withTransactionRetry(async (session) => {
        const queryOptions = session ? { session } : {};

        // Step 1: Atomic deduct from source (prevents negative stock)
        const sourceCondition = {
          _id: req.params.id,
          'inventory.currentStock': { $gte: transferQuantity }
        };

        const sourceUpdate = {
          $inc: {
            'inventory.currentStock': -transferQuantity,
            version: 1
          },
          $set: { updatedBy: userId },
          $push: {
            transactions: {
              type: 'transferred',
              quantity: -transferQuantity,
              reason: reason || `Transfere vers clinique ${targetClinicId}`,
              reference: targetClinicId.toString(),
              referenceType: 'transfer',
              performedBy: userId,
              performedAt: new Date()
            }
          }
        };

        const sourceItem = await Inventory.findOneAndUpdate(
          sourceCondition,
          sourceUpdate,
          { new: true, ...queryOptions }
        );

        if (!sourceItem) {
          // Check why - not found or insufficient stock
          const checkItem = await Inventory.findById(req.params.id).select('inventory.currentStock availableStock').lean();
          if (!checkItem) {
            throw new Error('Article source introuvable');
          }
          throw new Error(`Stock insuffisant. Disponible: ${checkItem.inventory?.currentStock || 0}`);
        }

        // Step 2: Find or create target item
        let targetItem = await Inventory.findOne({
          clinic: targetClinicId,
          sku: sourceItem.sku,
          inventoryType: sourceItem.inventoryType
        }, null, queryOptions);

        if (!targetItem) {
          // Create new item in target clinic
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
            createdBy: userId,
            updatedBy: userId
          });
          await targetItem.save(queryOptions);
        }

        // Step 3: Atomic add to target
        const targetUpdate = {
          $inc: {
            'inventory.currentStock': transferQuantity,
            version: 1
          },
          $set: { updatedBy: userId },
          $push: {
            transactions: {
              type: 'received',
              quantity: transferQuantity,
              reason: reason || `Recu de clinique ${sourceItem.clinic}`,
              reference: sourceItem.clinic.toString(),
              referenceType: 'transfer',
              performedBy: userId,
              performedAt: new Date()
            }
          }
        };

        const updatedTarget = await Inventory.findByIdAndUpdate(
          targetItem._id,
          targetUpdate,
          { new: true, ...queryOptions }
        );

        // Update statuses
        sourceItem.updateInventoryStatus();
        await sourceItem.save(queryOptions);

        if (updatedTarget) {
          updatedTarget.updateInventoryStatus();
          await updatedTarget.save(queryOptions);
        }

        return {
          source: {
            id: sourceItem._id,
            currentStock: sourceItem.inventory.currentStock
          },
          target: {
            id: updatedTarget?._id || targetItem._id,
            currentStock: updatedTarget?.inventory.currentStock || transferQuantity
          }
        };
      });

      res.json({
        success: true,
        message: `${quantity} unites transferees avec succes`,
        data: result
      });
    } catch (error) {
      log.error('Error transferring stock', { error: error.message });

      const statusCode = error.message.includes('introuvable') ? 404 :
                        error.message.includes('insuffisant') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erreur lors du transfert de stock'
      });
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
      const { clinic, clinicId: queryClinicId, inventoryType } = req.query;
      // Accept both 'clinic' and 'clinicId' query params for frontend compatibility
      const rawClinicId = clinic || queryClinicId || req.user?.clinic || req.user?.assignedClinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      if (!clinicId) {
        // Return empty stats if no clinic context (allows page to load without error)
        return res.json({
          success: true,
          data: {
            byType: [],
            totals: { totalItems: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0 }
          },
          message: 'No clinic context - select a clinic to view statistics'
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
      const { clinic, clinicId: queryClinicId, inventoryType } = req.query;
      const rawClinicId = clinic || queryClinicId || req.user?.clinic || req.user?.assignedClinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      if (!clinicId) {
        // Return empty list if no clinic context
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'No clinic context - select a clinic to view low stock items'
        });
      }

      const items = await Inventory.getLowStock(clinicId, inventoryType);

      // Flatten items for frontend compatibility
      const processedItems = items.map(item =>
        UnifiedInventoryController.flattenItem(item.toObject ? item.toObject() : item)
      );

      res.json({
        success: true,
        data: processedItems,
        count: processedItems.length
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
      const { clinic, clinicId: queryClinicId, days = 30 } = req.query;
      const rawClinicId = clinic || queryClinicId || req.user?.clinic || req.user?.assignedClinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      if (!clinicId) {
        // Return empty list if no clinic context
        return res.json({
          success: true,
          data: [],
          count: 0,
          daysThreshold: parseInt(days),
          message: 'No clinic context - select a clinic to view expiring items'
        });
      }

      const items = await Inventory.getExpiring(clinicId, parseInt(days));

      // Flatten items for frontend compatibility
      const processedItems = items.map(item =>
        UnifiedInventoryController.flattenItem(item.toObject ? item.toObject() : item)
      );

      res.json({
        success: true,
        data: processedItems,
        count: processedItems.length,
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
      const rawClinicId = clinic || req.user?.clinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      const match = { active: true };
      // Only add clinic filter if valid ObjectId
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
      const { q, clinic, clinicId: queryClinicId, inventoryType, inStockOnly, limit = 20 } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query (q) is required'
        });
      }

      const rawClinicId = clinic || queryClinicId || req.user?.clinic || req.user?.assignedClinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      if (!clinicId) {
        // Return empty list if no clinic context
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'No clinic context - select a clinic to search inventory'
        });
      }

      const items = await Inventory.search(clinicId, q, {
        inventoryType,
        inStockOnly: inStockOnly === 'true',
        limit: parseInt(limit)
      });

      // Flatten items for frontend compatibility
      const processedItems = items.map(item =>
        UnifiedInventoryController.flattenItem(item.toObject ? item.toObject() : item)
      );

      res.json({
        success: true,
        data: processedItems,
        count: processedItems.length
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
      const rawClinicId = clinic || req.user?.clinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      const match = { active: true };
      // Only add clinic filter if valid ObjectId
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
      const rawClinicId = clinic || req.user?.clinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      const match = { active: true };
      // Only add clinic filter if valid ObjectId
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
      const { clinic, clinicId: queryClinicId, inventoryType, resolved = 'false' } = req.query;
      const rawClinicId = clinic || queryClinicId || req.user?.clinic || req.user?.assignedClinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      const query = { active: true };
      // Only add clinic filter if valid ObjectId
      if (clinicId) query.clinic = new mongoose.Types.ObjectId(clinicId);
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
      const { clinic, clinicId: queryClinicId, inventoryType, days = 30 } = req.query;
      const rawClinicId = clinic || queryClinicId || req.user?.clinic || req.user?.assignedClinic;
      const clinicId = toValidObjectIdString(rawClinicId);

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: 'Clinic ID is required for expiration checks'
        });
      }

      const query = { clinic: new mongoose.Types.ObjectId(clinicId), active: true };
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
