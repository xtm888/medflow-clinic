/**
 * Auto-Reorder Scheduler Service
 * Automatically generates purchase orders when inventory falls below reorder points
 */

const {
  PharmacyInventory,
  FrameInventory,
  ContactLensInventory,
  ReagentInventory,
  LabConsumableInventory
} = require('../models/Inventory');
const PurchaseOrder = require('../models/PurchaseOrder');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('AutoReorder');

/**
 * Inventory configurations for auto-reorder
 */
const INVENTORY_CONFIGS = {
  pharmacy: {
    model: PharmacyInventory,
    name: 'Pharmacy Inventory',
    department: 'pharmacy',
    quantityField: 'stockQuantity',
    reorderPointField: 'reorderLevel',
    reorderQuantityField: 'reorderQuantity',
    supplierField: 'supplier',
    unitPriceField: 'costPrice',
    nameField: 'name',
    codeField: 'sku'
  },
  frame: {
    model: FrameInventory,
    name: 'Frame Inventory',
    department: 'optical',
    quantityField: 'quantity',
    reorderPointField: 'reorderPoint',
    reorderQuantityField: 'reorderQuantity',
    supplierField: 'supplier',
    unitPriceField: 'wholesalePrice',
    nameField: 'modelName',
    codeField: 'sku'
  },
  contactLens: {
    model: ContactLensInventory,
    name: 'Contact Lens Inventory',
    department: 'optical',
    quantityField: 'quantity',
    reorderPointField: 'reorderPoint',
    reorderQuantityField: 'reorderQuantity',
    supplierField: 'supplier',
    unitPriceField: 'wholesalePrice',
    nameField: 'productName',
    codeField: 'sku'
  },
  reagent: {
    model: ReagentInventory,
    name: 'Reagent Inventory',
    department: 'laboratory',
    quantityField: 'quantity',
    reorderPointField: 'reorderPoint',
    reorderQuantityField: 'reorderQuantity',
    supplierField: 'supplier',
    unitPriceField: 'unitCost',
    nameField: 'name',
    codeField: 'catalogNumber'
  },
  labConsumable: {
    model: LabConsumableInventory,
    name: 'Lab Consumable Inventory',
    department: 'laboratory',
    quantityField: 'quantity',
    reorderPointField: 'reorderPoint',
    reorderQuantityField: 'reorderQuantity',
    supplierField: 'supplier',
    unitPriceField: 'unitCost',
    nameField: 'name',
    codeField: 'catalogNumber'
  }
};

/**
 * Check inventory levels and identify items needing reorder
 * @param {String} inventoryType - Type of inventory to check
 * @param {String} clinicId - Clinic ID
 * @returns {Array} Items below reorder point
 */
async function checkReorderNeeds(inventoryType, clinicId) {
  const config = INVENTORY_CONFIGS[inventoryType];
  if (!config) {
    throw new Error(`Unknown inventory type: ${inventoryType}`);
  }

  try {
    const Model = config.model;

    // Find items where quantity is at or below reorder point
    const query = {
      clinic: clinicId,
      [config.quantityField]: { $lte: `$${config.reorderPointField}` },
      isActive: { $ne: false }
    };

    // Use aggregation for dynamic field comparison
    const itemsNeedingReorder = await Model.aggregate([
      { $match: { clinic: clinicId, isActive: { $ne: false } } },
      {
        $addFields: {
          needsReorder: {
            $lte: [`$${config.quantityField}`, `$${config.reorderPointField}`]
          }
        }
      },
      { $match: { needsReorder: true } },
      {
        $project: {
          itemId: '$_id',
          itemName: `$${config.nameField}`,
          itemCode: `$${config.codeField}`,
          currentQuantity: `$${config.quantityField}`,
          reorderPoint: `$${config.reorderPointField}`,
          reorderQuantity: `$${config.reorderQuantityField}`,
          supplier: `$${config.supplierField}`,
          unitPrice: `$${config.unitPriceField}`,
          unit: '$unit',
          category: '$category'
        }
      }
    ]);

    return itemsNeedingReorder.map(item => ({
      ...item,
      inventoryType,
      department: config.department,
      deficit: item.reorderPoint - item.currentQuantity,
      suggestedQuantity: item.reorderQuantity || Math.max(10, item.reorderPoint * 2)
    }));
  } catch (error) {
    log.error(`Error checking reorder needs for ${inventoryType}:`, { error: error });
    throw new Error(`Failed to check reorder needs: ${error.message}`);
  }
}

/**
 * Check all inventory types for reorder needs
 * @param {String} clinicId - Clinic ID
 * @returns {Object} All items needing reorder grouped by type
 */
async function checkAllReorderNeeds(clinicId) {
  const results = {
    itemsNeedingReorder: [],
    byType: {},
    bySupplier: {},
    byDepartment: {},
    totalItems: 0,
    urgentItems: 0
  };

  for (const [type, config] of Object.entries(INVENTORY_CONFIGS)) {
    try {
      const items = await checkReorderNeeds(type, clinicId);
      results.byType[type] = items;
      results.itemsNeedingReorder.push(...items);

      // Group by supplier
      for (const item of items) {
        const supplierName = item.supplier?.name || 'Unknown Supplier';
        if (!results.bySupplier[supplierName]) {
          results.bySupplier[supplierName] = [];
        }
        results.bySupplier[supplierName].push(item);

        // Group by department
        if (!results.byDepartment[config.department]) {
          results.byDepartment[config.department] = [];
        }
        results.byDepartment[config.department].push(item);

        // Check if urgent (below 50% of reorder point)
        if (item.currentQuantity < item.reorderPoint * 0.5) {
          results.urgentItems++;
        }
      }
    } catch (error) {
      log.error(`Error checking ${type}:`, { error: error });
      results.byType[type] = { error: error.message };
    }
  }

  results.totalItems = results.itemsNeedingReorder.length;

  return results;
}

/**
 * Generate purchase orders from reorder needs
 * @param {String} clinicId - Clinic ID
 * @param {String} userId - User creating the PO
 * @param {Object} options - Generation options
 * @returns {Array} Created purchase orders
 */
async function generatePurchaseOrders(clinicId, userId, options = {}) {
  const {
    groupBySupplier = true,
    groupByDepartment = false,
    autoSubmit = false,
    priorityThreshold = 0.25 // Items below 25% of reorder point are urgent
  } = options;

  try {
    const reorderNeeds = await checkAllReorderNeeds(clinicId);

    if (reorderNeeds.totalItems === 0) {
      return {
        purchaseOrders: [],
        message: 'No items currently need reordering'
      };
    }

    const purchaseOrders = [];
    const grouping = groupBySupplier ? reorderNeeds.bySupplier :
      groupByDepartment ? reorderNeeds.byDepartment :
        { 'All Items': reorderNeeds.itemsNeedingReorder };

    for (const [groupKey, items] of Object.entries(grouping)) {
      if (Array.isArray(items) && items.length > 0) {
        // Determine priority
        const hasUrgent = items.some(i => i.currentQuantity < i.reorderPoint * priorityThreshold);
        const priority = hasUrgent ? 'urgent' : 'normal';

        // Determine department
        const departments = [...new Set(items.map(i => i.department))];
        const department = departments.length === 1 ? departments[0] : 'general';

        // Build PO items
        const poItems = items.map(item => ({
          inventoryType: item.inventoryType,
          inventoryItemId: item.itemId,
          itemName: item.itemName,
          itemCode: item.itemCode,
          quantityOrdered: item.suggestedQuantity,
          unit: item.unit || 'unit',
          unitPrice: item.unitPrice || 0,
          notes: `Current stock: ${item.currentQuantity}, Reorder point: ${item.reorderPoint}`
        }));

        // Create PO
        const po = new PurchaseOrder({
          clinic: clinicId,
          department,
          supplier: {
            name: groupBySupplier ? groupKey : items[0]?.supplier?.name || 'Unknown',
            supplierId: items[0]?.supplier?._id
          },
          items: poItems,
          orderType: 'auto_reorder',
          priority,
          status: autoSubmit ? 'pending_approval' : 'draft',
          createdBy: userId,
          notes: `Auto-generated reorder for ${items.length} item(s) below reorder point`,
          reorderTriggerItems: items.map(i => i.itemId)
        });

        await po.save();
        purchaseOrders.push(po);
      }
    }

    return {
      purchaseOrders,
      totalPOs: purchaseOrders.length,
      totalItems: reorderNeeds.totalItems,
      urgentItems: reorderNeeds.urgentItems,
      message: `Generated ${purchaseOrders.length} purchase order(s) for ${reorderNeeds.totalItems} items`
    };
  } catch (error) {
    log.error('Error generating purchase orders:', { error: error });
    throw new Error(`Failed to generate purchase orders: ${error.message}`);
  }
}

/**
 * Schedule automatic reorder check
 * This should be called by a cron job
 * @param {String} clinicId - Clinic ID
 * @param {String} systemUserId - System user for auto-generated POs
 * @returns {Object} Execution result
 */
async function runScheduledReorderCheck(clinicId, systemUserId) {
  const startTime = Date.now();

  try {
    const result = await generatePurchaseOrders(clinicId, systemUserId, {
      groupBySupplier: true,
      autoSubmit: false // Draft by default, requires human approval
    });

    const endTime = Date.now();

    return {
      success: true,
      executionTime: endTime - startTime,
      ...result,
      executedAt: new Date()
    };
  } catch (error) {
    log.error('Scheduled reorder check failed:', { error: error });
    return {
      success: false,
      error: error.message,
      executedAt: new Date()
    };
  }
}

/**
 * Get reorder status report
 * @param {String} clinicId - Clinic ID
 * @returns {Object} Status report
 */
async function getReorderStatusReport(clinicId) {
  const needs = await checkAllReorderNeeds(clinicId);

  // Get pending POs
  const pendingPOs = await PurchaseOrder.find({
    clinic: clinicId,
    orderType: 'auto_reorder',
    status: { $in: ['draft', 'pending_approval', 'approved', 'sent'] }
  }).lean();

  // Items already in pending POs
  const itemsInPOs = new Set();
  for (const po of pendingPOs) {
    for (const item of po.reorderTriggerItems || []) {
      itemsInPOs.add(item.toString());
    }
  }

  // Filter out items already ordered
  const newItemsNeeded = needs.itemsNeedingReorder.filter(
    item => !itemsInPOs.has(item.itemId?.toString())
  );

  return {
    totalItemsBelowReorderPoint: needs.totalItems,
    urgentItems: needs.urgentItems,
    itemsAlreadyOnOrder: itemsInPOs.size,
    newItemsNeedingOrders: newItemsNeeded.length,
    pendingPOCount: pendingPOs.length,
    byDepartment: Object.entries(needs.byDepartment).map(([dept, items]) => ({
      department: dept,
      count: items.length,
      urgent: items.filter(i => i.currentQuantity < i.reorderPoint * 0.5).length
    })),
    byType: Object.entries(needs.byType).map(([type, items]) => ({
      type,
      count: Array.isArray(items) ? items.length : 0
    })),
    topUrgentItems: needs.itemsNeedingReorder
      .filter(i => i.currentQuantity < i.reorderPoint * 0.5)
      .slice(0, 10)
      .map(i => ({
        name: i.itemName,
        type: i.inventoryType,
        current: i.currentQuantity,
        reorderPoint: i.reorderPoint,
        deficit: i.deficit
      })),
    generatedAt: new Date()
  };
}

/**
 * Configure reorder settings for an item
 * @param {String} inventoryType - Type of inventory
 * @param {String} itemId - Item ID
 * @param {Object} settings - Reorder settings
 * @returns {Object} Updated item
 */
async function configureReorderSettings(inventoryType, itemId, settings) {
  const config = INVENTORY_CONFIGS[inventoryType];
  if (!config) {
    throw new Error(`Unknown inventory type: ${inventoryType}`);
  }

  const Model = config.model;

  const updateFields = {};
  if (settings.reorderPoint !== undefined) {
    updateFields[config.reorderPointField] = settings.reorderPoint;
  }
  if (settings.reorderQuantity !== undefined) {
    updateFields[config.reorderQuantityField] = settings.reorderQuantity;
  }
  if (settings.supplier !== undefined) {
    updateFields[config.supplierField] = settings.supplier;
  }

  const item = await Model.findByIdAndUpdate(
    itemId,
    { $set: updateFields },
    { new: true }
  );

  if (!item) {
    throw new Error('Item not found');
  }

  return {
    itemId,
    inventoryType,
    updatedSettings: updateFields,
    item
  };
}

module.exports = {
  checkReorderNeeds,
  checkAllReorderNeeds,
  generatePurchaseOrders,
  runScheduledReorderCheck,
  getReorderStatusReport,
  configureReorderSettings,
  INVENTORY_CONFIGS
};
