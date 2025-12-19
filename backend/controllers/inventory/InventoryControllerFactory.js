/**
 * Inventory Controller Factory
 *
 * Generates standardized controller handlers for inventory management.
 * All inventory controllers (frame, contactLens, opticalLens, reagent,
 * labConsumable, surgicalSupply) share common CRUD, stock, and alert patterns.
 *
 * Usage:
 *   const factory = new InventoryControllerFactory({
 *     Model: FrameInventory,
 *     entityName: 'frame',
 *     entityNamePlural: 'frames',
 *     searchFields: ['brand', 'model', 'sku', 'barcode', 'color'],
 *     defaultSort: 'brand',
 *     activeField: 'active',  // or 'isActive' for some models
 *     selectExclude: '-transactions -usage.salesHistory -reservations'
 *   });
 */

const mongoose = require('mongoose');

// Helper function to escape regex special characters
const escapeRegex = (str) => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

class InventoryControllerFactory {
  constructor(config) {
    this.Model = config.Model;
    this.entityName = config.entityName;
    this.entityNamePlural = config.entityNamePlural;
    this.searchFields = config.searchFields || ['name', 'sku'];
    this.defaultSort = config.defaultSort || '-updatedAt';
    this.activeField = config.activeField || 'active';
    this.selectExclude = config.selectExclude || '-transactions';
    this.populateFields = config.populateFields || {};

    // Bind all methods to preserve 'this' context
    this.getAll = this.getAll.bind(this);
    this.getOne = this.getOne.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.addStock = this.addStock.bind(this);
    this.adjustStock = this.adjustStock.bind(this);
    this.getStats = this.getStats.bind(this);
    this.getLowStock = this.getLowStock.bind(this);
    this.getInventoryValue = this.getInventoryValue.bind(this);
    this.search = this.search.bind(this);
    this.getBrands = this.getBrands.bind(this);
    this.getAlerts = this.getAlerts.bind(this);
    this.resolveAlert = this.resolveAlert.bind(this);
    this.getTransactions = this.getTransactions.bind(this);
    this.checkAvailability = this.checkAvailability.bind(this);
  }

  /**
   * Build search query from request params
   */
  buildSearchQuery(search) {
    if (!search) return null;
    const sanitizedSearch = escapeRegex(search);
    return {
      $or: this.searchFields.map(field => ({
        [field]: { $regex: sanitizedSearch, $options: 'i' }
      }))
    };
  }

  /**
   * GET all items with filtering and pagination
   * Handles common query parameters: page, limit, search, status, sortBy, sortOrder
   */
  async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        status,
        sortBy = this.defaultSort,
        sortOrder = 'asc',
        ...customFilters
      } = req.query;

      const query = { [this.activeField]: true };

      // Apply search
      if (search) {
        const searchQuery = this.buildSearchQuery(search);
        if (searchQuery) Object.assign(query, searchQuery);
      }

      // Apply status filter
      if (status) {
        query['inventory.status'] = status;
      }

      // Apply custom filters (subclass can override buildCustomFilters)
      if (this.buildCustomFilters) {
        Object.assign(query, this.buildCustomFilters(customFilters, req));
      }

      // Validate pagination parameters
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 50));
      const skip = (validPage - 1) * validLimit;
      const sort = sortBy.startsWith('-')
        ? { [sortBy.slice(1)]: -1 }
        : { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [items, total] = await Promise.all([
        this.Model.find(query)
          .sort(sort)
          .skip(skip)
          .limit(validLimit)
          .select(this.selectExclude)
          .lean(),
        this.Model.countDocuments(query)
      ]);

      // Post-process items (subclass can override)
      const processedItems = this.postProcessItems
        ? this.postProcessItems(items)
        : items.map(item => ({
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
        pages: Math.ceil(total / validLimit)
      });
    } catch (error) {
      console.error(`Error getting ${this.entityNamePlural}:`, error);
      res.status(500).json({
        success: false,
        message: `Error retrieving ${this.entityName} inventory`,
        error: error.message
      });
    }
  }

  /**
   * GET single item by ID
   */
  async getOne(req, res) {
    try {
      let query = this.Model.findById(req.params.id);

      // Apply population if configured
      if (this.populateFields.getOne) {
        for (const pop of this.populateFields.getOne) {
          query = query.populate(pop.path, pop.select);
        }
      } else {
        // Default populations
        query = query
          .populate('createdBy', 'name firstName lastName')
          .populate('updatedBy', 'name firstName lastName');
      }

      const item = await query;

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
        });
      }

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      console.error(`Error getting ${this.entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error retrieving ${this.entityName}`,
        error: error.message
      });
    }
  }

  /**
   * CREATE new item
   */
  async create(req, res) {
    try {
      const itemData = {
        ...req.body,
        createdBy: req.user._id || req.user.id,
        updatedBy: req.user._id || req.user.id
      };

      // Check SKU uniqueness if SKU provided
      if (itemData.sku) {
        const existing = await this.Model.findOne({ sku: itemData.sku.toUpperCase() });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `A ${this.entityName} with this SKU already exists`
          });
        }
      }

      // Allow subclass to modify data before save
      if (this.beforeCreate) {
        await this.beforeCreate(itemData, req);
      }

      const item = new this.Model(itemData);
      await item.save();

      res.status(201).json({
        success: true,
        message: `${this.entityName} created successfully`,
        data: item
      });
    } catch (error) {
      console.error(`Error creating ${this.entityName}:`, error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
      res.status(500).json({
        success: false,
        message: `Error creating ${this.entityName}`,
        error: error.message
      });
    }
  }

  /**
   * UPDATE item
   */
  async update(req, res) {
    try {
      const item = await this.Model.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
        });
      }

      // Check SKU uniqueness if changed
      if (req.body.sku && req.body.sku.toUpperCase() !== item.sku) {
        const existing = await this.Model.findOne({
          sku: req.body.sku.toUpperCase(),
          _id: { $ne: item._id }
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `A ${this.entityName} with this SKU already exists`
          });
        }
      }

      // Allow subclass to validate/transform update
      if (this.beforeUpdate) {
        await this.beforeUpdate(item, req.body, req);
      }

      // Apply updates
      Object.assign(item, req.body);
      item.updatedBy = req.user._id || req.user.id;
      await item.save();

      res.json({
        success: true,
        message: `${this.entityName} updated successfully`,
        data: item
      });
    } catch (error) {
      console.error(`Error updating ${this.entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error updating ${this.entityName}`,
        error: error.message
      });
    }
  }

  /**
   * DELETE (soft delete) item
   */
  async delete(req, res) {
    try {
      const item = await this.Model.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
        });
      }

      // Check for active reservations
      if (item.reservations?.some(r => r.status === 'active')) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete ${this.entityName} with active reservations`
        });
      }

      // Check for reserved stock
      if (item.inventory?.reserved > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete ${this.entityName} with reserved stock`
        });
      }

      item[this.activeField] = false;
      item.discontinued = true;
      item.discontinuedDate = new Date();
      item.discontinuedReason = req.body.reason || 'Discontinued by user';
      item.updatedBy = req.user._id || req.user.id;

      await item.save();

      res.json({
        success: true,
        message: `${this.entityName} discontinued successfully`
      });
    } catch (error) {
      console.error(`Error deleting ${this.entityName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error deleting ${this.entityName}`,
        error: error.message
      });
    }
  }

  /**
   * ADD STOCK (receive new batch)
   */
  async addStock(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const item = await this.Model.findById(req.params.id).session(session);

      if (!item) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
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

      // Validate expiration if provided
      if (expirationDate && new Date(expirationDate) <= new Date()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be in the future'
        });
      }

      // Use model's addBatch method if available, otherwise manual add
      if (item.addBatch && typeof item.addBatch === 'function') {
        await item.addBatch({
          lotNumber,
          quantity,
          expirationDate,
          ...batchData
        }, req.user._id || req.user.id, session);
        await item.save({ session }); // Ensure save within transaction
      } else {
        // Manual batch addition
        item.batches = item.batches || [];
        item.batches.push({
          lotNumber,
          quantity,
          receivedDate: new Date(),
          expirationDate,
          status: 'active',
          ...batchData
        });
        item.inventory.currentStock += quantity;
        item.inventory.lastStockCheck = new Date();
        item.updatedBy = req.user._id || req.user.id;
        await item.save({ session });
      }

      await session.commitTransaction();

      res.json({
        success: true,
        message: `Stock added successfully. New total: ${item.inventory.currentStock}`,
        data: {
          currentStock: item.inventory.currentStock,
          status: item.inventory.status
        }
      });
    } catch (error) {
      await session.abortTransaction();
      console.error(`Error adding stock to ${this.entityName}:`, error);
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
   * ADJUST STOCK (manual adjustment)
   */
  async adjustStock(req, res) {
    try {
      const item = await this.Model.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
        });
      }

      const { quantity, type, reason, lotNumber, adjustment } = req.body;
      const adjustmentValue = adjustment !== undefined ? adjustment : quantity;

      if (adjustmentValue === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Quantity or adjustment value is required'
        });
      }

      const validTypes = ['adjusted', 'damaged', 'returned', 'transferred', 'correction', 'expired', 'recalled'];
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid adjustment type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      // Prevent negative stock
      const newStock = item.inventory.currentStock + parseInt(adjustmentValue);
      if (newStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Adjustment would result in negative stock'
        });
      }

      // Use model's method if available
      if (item.updateStock && typeof item.updateStock === 'function') {
        await item.updateStock(adjustmentValue, type || 'adjusted', req.user._id || req.user.id, 'Manual adjustment', reason);
      } else if (item.adjustStock && typeof item.adjustStock === 'function') {
        await item.adjustStock({ lotNumber, quantity: adjustmentValue, reason }, req.user._id || req.user.id);
      } else {
        // Manual adjustment
        item.inventory.currentStock = newStock;
        item.inventory.lastStockCheck = new Date();
        item.updatedBy = req.user._id || req.user.id;
        await item.save();
      }

      res.json({
        success: true,
        message: 'Stock adjusted successfully',
        data: {
          currentStock: item.inventory.currentStock,
          status: item.inventory.status
        }
      });
    } catch (error) {
      console.error(`Error adjusting ${this.entityName} stock:`, error);
      res.status(500).json({
        success: false,
        message: 'Error adjusting stock',
        error: error.message
      });
    }
  }

  /**
   * GET inventory statistics
   */
  async getStats(req, res) {
    try {
      // Use model's getStats if available
      if (this.Model.getStats && typeof this.Model.getStats === 'function') {
        const stats = await this.Model.getStats();
        return res.json({ success: true, data: stats });
      }

      // Generic stats aggregation
      const { clinic } = req.query;
      const match = { [this.activeField]: true };
      if (clinic) match.clinic = new mongoose.Types.ObjectId(clinic);

      const [stats, byStatus] = await Promise.all([
        this.Model.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              totalItems: { $sum: 1 },
              totalStock: { $sum: '$inventory.currentStock' },
              totalReserved: { $sum: '$inventory.reserved' },
              outOfStock: {
                $sum: { $cond: [{ $eq: ['$inventory.status', 'out-of-stock'] }, 1, 0] }
              },
              lowStock: {
                $sum: { $cond: [{ $eq: ['$inventory.status', 'low-stock'] }, 1, 0] }
              },
              totalValue: {
                $sum: { $multiply: ['$inventory.currentStock', { $ifNull: ['$pricing.costPrice', 0] }] }
              }
            }
          }
        ]),
        this.Model.aggregate([
          { $match: match },
          { $group: { _id: '$inventory.status', count: { $sum: 1 } } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          summary: stats[0] || {
            totalItems: 0,
            totalStock: 0,
            totalReserved: 0,
            outOfStock: 0,
            lowStock: 0,
            totalValue: 0
          },
          byStatus
        }
      });
    } catch (error) {
      console.error(`Error getting ${this.entityName} stats:`, error);
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
  async getLowStock(req, res) {
    try {
      // Use model's method if available
      if (this.Model.getLowStockItems && typeof this.Model.getLowStockItems === 'function') {
        const items = await this.Model.getLowStockItems();
        return res.json({
          success: true,
          data: items,
          count: items.length
        });
      }

      // Generic low stock query
      const { clinic } = req.query;
      const query = {
        [this.activeField]: true,
        $or: [
          { 'inventory.status': 'low-stock' },
          { 'inventory.status': 'out-of-stock' }
        ]
      };
      if (clinic) query.clinic = clinic;

      const items = await this.Model.find(query)
        .sort({ 'inventory.currentStock': 1 })
        .lean();

      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      console.error(`Error getting low stock ${this.entityNamePlural}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving low stock items',
        error: error.message
      });
    }
  }

  /**
   * GET inventory value
   */
  async getInventoryValue(req, res) {
    try {
      // Use model's method if available
      if (this.Model.getInventoryValue && typeof this.Model.getInventoryValue === 'function') {
        const value = await this.Model.getInventoryValue();
        return res.json({
          success: true,
          data: Array.isArray(value) ? value[0] : value || { totalCostValue: 0, totalSaleValue: 0, itemCount: 0 }
        });
      }

      // Generic value calculation
      const value = await this.Model.aggregate([
        { $match: { [this.activeField]: true } },
        {
          $group: {
            _id: null,
            totalCostValue: { $sum: { $multiply: [{ $ifNull: ['$inventory.currentStock', 0] }, { $ifNull: ['$pricing.costPrice', 0] }] } },
            totalSaleValue: { $sum: { $multiply: [{ $ifNull: ['$inventory.currentStock', 0] }, { $ifNull: ['$pricing.sellingPrice', 0] }] } },
            itemCount: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: value[0] || { totalCostValue: 0, totalSaleValue: 0, itemCount: 0 }
      });
    } catch (error) {
      console.error(`Error getting ${this.entityName} inventory value:`, error);
      res.status(500).json({
        success: false,
        message: 'Error calculating inventory value',
        error: error.message
      });
    }
  }

  /**
   * SEARCH items
   */
  async search(req, res) {
    try {
      const { q, inStockOnly, limit = 20, ...filters } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      // Use model's search method if available
      if (this.Model.search && typeof this.Model.search === 'function') {
        const items = await this.Model.search(q, { inStockOnly: inStockOnly === 'true', limit: parseInt(limit), ...filters });
        return res.json({
          success: true,
          data: items,
          count: items.length
        });
      }

      // Generic search
      const searchQuery = this.buildSearchQuery(q);
      const query = { [this.activeField]: true, ...searchQuery };

      if (inStockOnly === 'true') {
        query['inventory.currentStock'] = { $gt: 0 };
      }

      const items = await this.Model.find(query)
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      console.error(`Error searching ${this.entityNamePlural}:`, error);
      res.status(500).json({
        success: false,
        message: `Error searching ${this.entityNamePlural}`,
        error: error.message
      });
    }
  }

  /**
   * GET all brands
   */
  async getBrands(req, res) {
    try {
      // Use model's method if available
      if (this.Model.getBrands && typeof this.Model.getBrands === 'function') {
        const brands = await this.Model.getBrands();
        return res.json({ success: true, data: brands });
      }

      // Generic brands query
      const { clinic } = req.query;
      const match = { [this.activeField]: true };
      if (clinic) match.clinic = new mongoose.Types.ObjectId(clinic);

      const brands = await this.Model.aggregate([
        { $match: match },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: brands.map(b => ({ brand: b._id, count: b.count }))
      });
    } catch (error) {
      console.error(`Error getting ${this.entityName} brands:`, error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving brands',
        error: error.message
      });
    }
  }

  /**
   * GET active alerts
   */
  async getAlerts(req, res) {
    try {
      const { clinic, resolved = 'false', acknowledged = 'false' } = req.query;

      // Build query for unresolved/unacknowledged alerts
      const query = { [this.activeField]: true };
      if (resolved === 'false') {
        query['alerts.resolved'] = false;
      }
      if (acknowledged === 'false') {
        query['alerts.acknowledged'] = { $ne: true };
      }
      if (clinic) query.clinic = clinic;

      const items = await this.Model.find(query)
        .select('sku brand name productName productLine model alerts inventory');

      const alerts = [];

      items.forEach(item => {
        const itemAlerts = item.alerts || [];
        itemAlerts
          .filter(a => resolved === 'true' || !a.resolved)
          .filter(a => acknowledged === 'true' || !a.acknowledged)
          .forEach(alert => {
            alerts.push({
              itemId: item._id,
              sku: item.sku,
              itemName: item.name || item.productName || `${item.brand} ${item.productLine || item.model || ''}`.trim(),
              ...alert.toObject()
            });
          });
      });

      // Sort by severity
      const severityOrder = { critical: 0, high: 1, warning: 1, medium: 2, low: 3, info: 4 };
      alerts.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

      res.json({
        success: true,
        data: alerts,
        count: alerts.length
      });
    } catch (error) {
      console.error(`Error getting ${this.entityName} alerts:`, error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving alerts',
        error: error.message
      });
    }
  }

  /**
   * RESOLVE/ACKNOWLEDGE alert
   */
  async resolveAlert(req, res) {
    try {
      const item = await this.Model.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
        });
      }

      const alertId = req.params.alertId;
      const alert = item.alerts?.id(alertId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      // Support both 'resolved' and 'acknowledged' patterns
      alert.resolved = true;
      alert.acknowledged = true;
      alert.resolvedAt = new Date();
      alert.acknowledgedAt = new Date();
      alert.resolvedBy = req.user._id || req.user.id;
      alert.acknowledgedBy = req.user._id || req.user.id;

      await item.save();

      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      console.error(`Error resolving ${this.entityName} alert:`, error);
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
  async getTransactions(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;

      const item = await this.Model.findById(req.params.id)
        .select('transactions sku brand name productName productLine model')
        .populate('transactions.performedBy', 'name firstName lastName');

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
        });
      }

      // Sort transactions by date descending and paginate
      const sortedTransactions = [...(item.transactions || [])]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      // Validate pagination parameters
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 50));
      const startIndex = (validPage - 1) * validLimit;
      const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + validLimit);

      res.json({
        success: true,
        data: {
          item: {
            sku: item.sku,
            name: item.name || item.productName || `${item.brand} ${item.productLine || item.model || ''}`.trim()
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
      console.error(`Error getting ${this.entityName} transactions:`, error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving transactions',
        error: error.message
      });
    }
  }

  /**
   * CHECK availability for order
   */
  async checkAvailability(req, res) {
    try {
      const { itemId, quantity = 1 } = req.query;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: 'Item ID is required'
        });
      }

      const item = await this.Model.findById(itemId)
        .select('sku brand name productName productLine model inventory pricing');

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${this.entityName} not found`
        });
      }

      const available = (item.inventory?.currentStock || 0) - (item.inventory?.reserved || 0);
      const isAvailable = available >= parseInt(quantity);

      res.json({
        success: true,
        data: {
          itemId: item._id,
          sku: item.sku,
          name: item.name || item.productName || `${item.brand} ${item.productLine || item.model || ''}`.trim(),
          currentStock: item.inventory?.currentStock || 0,
          reserved: item.inventory?.reserved || 0,
          available,
          requestedQuantity: parseInt(quantity),
          isAvailable,
          status: item.inventory?.status,
          price: item.pricing?.sellingPrice,
          costPrice: item.pricing?.costPrice
        }
      });
    } catch (error) {
      console.error(`Error checking ${this.entityName} availability:`, error);
      res.status(500).json({
        success: false,
        message: 'Error checking availability',
        error: error.message
      });
    }
  }

  /**
   * Generate all handlers as an object
   * Useful for direct export or extending
   */
  getHandlers() {
    return {
      getAll: this.getAll,
      getOne: this.getOne,
      create: this.create,
      update: this.update,
      delete: this.delete,
      addStock: this.addStock,
      adjustStock: this.adjustStock,
      getStats: this.getStats,
      getLowStock: this.getLowStock,
      getInventoryValue: this.getInventoryValue,
      search: this.search,
      getBrands: this.getBrands,
      getAlerts: this.getAlerts,
      resolveAlert: this.resolveAlert,
      getTransactions: this.getTransactions,
      checkAvailability: this.checkAvailability
    };
  }
}

module.exports = InventoryControllerFactory;
