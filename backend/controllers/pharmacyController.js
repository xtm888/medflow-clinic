const { Inventory, PharmacyInventory } = require('../models/Inventory');
const { escapeRegex } = require('../utils/sanitize');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { pharmacy: pharmacyLogger } = require('../utils/structuredLogger');
const { INVENTORY, PAGINATION } = require('../config/constants');
const { withTransactionRetry } = require('../utils/transactions');

/**
 * ALLERGY CHECK: Word boundary matching for allergen detection
 * Prevents false positives like "ASA" matching "NASAL" spray
 * Uses regex word boundaries to match whole words only
 *
 * @param {string} text - The text to search in (drug name, ingredient)
 * @param {string} allergen - The allergen to search for
 * @returns {boolean} True if allergen matches as a whole word
 */
const matchesAllergen = (text, allergen) => {
  if (!text || !allergen) return false;

  // Escape regex special characters in allergen
  const escapedAllergen = allergen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create word boundary regex - matches allergen as whole word
  // Also matches at start/end of strings and around hyphens/spaces
  const wordBoundaryRegex = new RegExp(
    `(?:^|[\\s\\-\\/,;])${escapedAllergen}(?:$|[\\s\\-\\/,;])`,
    'i'
  );

  // Also check for exact match (entire string equals allergen)
  const normalizedText = text.trim().toLowerCase();
  const normalizedAllergen = allergen.trim().toLowerCase();

  if (normalizedText === normalizedAllergen) {
    return true;
  }

  // Add padding for regex to match at boundaries
  return wordBoundaryRegex.test(` ${text} `);
};

// Get all pharmacy inventory with filtering and pagination
// MULTI-CLINIC: Filters by clinic from X-Clinic-ID header
// When "All Clinics" is selected, aggregates inventory by drug across all clinics
exports.getInventory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // MULTI-CLINIC: If specific clinic, use simple query
    if (req.clinicId) {
      const query = { clinic: req.clinicId };

      if (search) {
        const sanitizedSearch = escapeRegex(search);
        query.$or = [
          { 'medication.brandName': { $regex: sanitizedSearch, $options: 'i' } },
          { 'medication.genericName': { $regex: sanitizedSearch, $options: 'i' } },
          { sku: { $regex: sanitizedSearch, $options: 'i' } }
        ];
      }

      if (category && category !== 'all') {
        query.category = category;
      }

      if (status && status !== 'all') {
        query['inventory.status'] = status;
      }

      const [medications, total] = await Promise.all([
        PharmacyInventory.find(query)
          .sort({ 'medication.brandName': 1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        PharmacyInventory.countDocuments(query)
      ]);

      return paginated(res, medications, {
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }

    // ALL CLINICS: Aggregate inventory by drug across all clinics
    const matchStage = {};

    if (search) {
      const sanitizedSearch = escapeRegex(search);
      matchStage.$or = [
        { 'medication.brandName': { $regex: sanitizedSearch, $options: 'i' } },
        { 'medication.genericName': { $regex: sanitizedSearch, $options: 'i' } },
        { sku: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      matchStage.category = category;
    }

    // Aggregation pipeline to combine inventory across clinics
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$drug', // Group by drug reference
          medication: { $first: '$medication' },
          category: { $first: '$category' },
          categoryFr: { $first: '$categoryFr' },
          // Sum stock across clinics
          totalStock: { $sum: '$inventory.currentStock' },
          totalMinimum: { $sum: '$inventory.minimumStock' },
          totalReorderPoint: { $sum: '$inventory.reorderPoint' },
          totalMaximum: { $sum: '$inventory.maximumStock' },
          // Collect all batches from all clinics
          allBatches: { $push: '$batches' },
          // Use first pricing (should be same across clinics)
          pricing: { $first: '$pricing' },
          // Count how many clinics have this drug
          clinicCount: { $sum: 1 },
          // Keep one _id for reference
          firstId: { $first: '$_id' }
        }
      },
      {
        $project: {
          _id: '$firstId',
          drug: '$_id',
          medication: 1,
          category: 1,
          categoryFr: 1,
          inventory: {
            currentStock: '$totalStock',
            minimumStock: '$totalMinimum',
            reorderPoint: '$totalReorderPoint',
            maximumStock: '$totalMaximum',
            status: {
              $cond: {
                if: { $lte: ['$totalStock', 0] },
                then: 'out-of-stock',
                else: {
                  $cond: {
                    if: { $lte: ['$totalStock', '$totalReorderPoint'] },
                    then: 'low-stock',
                    else: 'in-stock'
                  }
                }
              }
            }
          },
          // Flatten batches array
          batches: {
            $reduce: {
              input: '$allBatches',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] }
            }
          },
          pricing: 1,
          clinicCount: 1
        }
      },
      { $sort: { 'medication.brandName': 1 } }
    ];

    // Add status filter after aggregation if needed
    if (status && status !== 'all') {
      pipeline.push({
        $match: { 'inventory.status': status }
      });
    }

    // Get total count first
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await PharmacyInventory.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const medications = await PharmacyInventory.aggregate(pipeline);

    return paginated(res, medications, {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      aggregated: true // Flag to indicate this is aggregated data
    });
  } catch (error) {
    pharmacyLogger.error('Error getting inventory', { error: error.message, stack: error.stack });
    return error(res, 'Error retrieving inventory');
  }
};

// Get inventory statistics
// MULTI-CLINIC: Filters by clinic from X-Clinic-ID header
// When "All Clinics", aggregates unique medications with summed stock
exports.getStats = async (req, res) => {
  try {
    // MULTI-CLINIC: If specific clinic, use simple counts
    if (req.clinicId) {
      const clinicFilter = { clinic: req.clinicId };

      const [totalItems, lowStockItems, expiringItems, valueResult] = await Promise.all([
        PharmacyInventory.countDocuments(clinicFilter),
        PharmacyInventory.countDocuments({ ...clinicFilter, 'inventory.status': 'low-stock' }),
        PharmacyInventory.countDocuments({
          ...clinicFilter,
          'batches.expirationDate': {
            $lte: new Date(Date.now() + INVENTORY.EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
          },
          'batches.status': 'active'
        }),
        PharmacyInventory.aggregate([
          { $match: clinicFilter },
          {
            $project: {
              itemValue: {
                $multiply: [
                  { $ifNull: ['$inventory.currentStock', 0] },
                  { $ifNull: ['$pricing.sellingPrice', 0] }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              totalValue: { $sum: '$itemValue' }
            }
          }
        ])
      ]);

      const totalValue = valueResult.length > 0 ? valueResult[0].totalValue : 0;

      return success(res, {
        data: {
          totalItems,
          lowStock: lowStockItems,
          expiringSoon: expiringItems,
          totalValue
        }
      });
    }

    // ALL CLINICS: Aggregate by unique drug
    const [statsResult, expiringResult] = await Promise.all([
      // Get unique drugs with aggregated stats
      PharmacyInventory.aggregate([
        {
          $group: {
            _id: '$drug',
            totalStock: { $sum: '$inventory.currentStock' },
            totalReorderPoint: { $sum: '$inventory.reorderPoint' },
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$inventory.currentStock', 0] },
                  { $ifNull: ['$pricing.sellingPrice', 0] }
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            lowStock: {
              $sum: {
                $cond: [{ $lte: ['$totalStock', '$totalReorderPoint'] }, 1, 0]
              }
            },
            totalValue: { $sum: '$totalValue' }
          }
        }
      ]),
      // Get unique drugs with expiring batches
      PharmacyInventory.aggregate([
        {
          $match: {
            'batches.expirationDate': {
              $lte: new Date(Date.now() + INVENTORY.EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
            },
            'batches.status': 'active'
          }
        },
        {
          $group: {
            _id: '$drug'
          }
        },
        {
          $count: 'total'
        }
      ])
    ]);

    const stats = statsResult[0] || { totalItems: 0, lowStock: 0, totalValue: 0 };
    const expiringSoon = expiringResult[0]?.total || 0;

    return success(res, {
      data: {
        totalItems: stats.totalItems,
        lowStock: stats.lowStock,
        expiringSoon,
        totalValue: stats.totalValue
      }
    });
  } catch (error) {
    pharmacyLogger.error('Error getting stats', { error: error.message, stack: error.stack });
    return error(res, 'Error retrieving statistics');
  }
};

// Get inventory alerts
exports.getAlerts = async (req, res) => {
  try {
    const alerts = [];

    // Low stock alerts
    const lowStock = await PharmacyInventory.find({ status: 'low-stock' }).lean();
    lowStock.forEach(med => {
      const name = med.medication?.brandName || med.medication?.genericName || 'Unknown medication';
      const stock = med.inventory?.currentStock || 0;
      alerts.push({
        type: 'warning',
        message: `${name} is running low (${stock} units remaining)`
      });
    });

    // Out of stock alerts
    const outOfStock = await PharmacyInventory.find({ status: 'out-of-stock' }).lean();
    outOfStock.forEach(med => {
      const name = med.medication?.brandName || med.medication?.genericName || 'Unknown medication';
      alerts.push({
        type: 'error',
        message: `${name} is out of stock`
      });
    });

    // Expiring soon alerts
    const expiringSoon = await PharmacyInventory.find({
      'batches.expirationDate': {
        $lte: new Date(Date.now() + INVENTORY.EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)
      },
      'batches.status': 'active'
    }).lean();

    expiringSoon.forEach(med => {
      const name = med.medication?.brandName || med.medication?.genericName || 'Unknown medication';
      med.batches
        .filter(b => b.status === 'active')
        .forEach(batch => {
          const daysToExpiry = Math.floor((new Date(batch.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysToExpiry <= INVENTORY.EXPIRING_SOON_DAYS) {
            alerts.push({
              type: daysToExpiry < 7 ? 'error' : 'warning',
              message: `${name} (Lot ${batch.lotNumber}) expires in ${daysToExpiry} days`
            });
          }
        });
    });

    return success(res, { data: alerts });
  } catch (error) {
    pharmacyLogger.error('Error getting alerts', { error: error.message, stack: error.stack });
    return error(res, 'Error retrieving alerts');
  }
};

// Get low stock items
// MULTI-CLINIC: Filters by clinic or aggregates across all clinics
exports.getLowStock = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // MULTI-CLINIC: If specific clinic, use simple query
    if (req.clinicId) {
      const query = { clinic: req.clinicId, 'inventory.status': 'low-stock' };

      const [medications, total] = await Promise.all([
        PharmacyInventory.find(query)
          .sort({ 'inventory.currentStock': 1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        PharmacyInventory.countDocuments(query)
      ]);

      return paginated(res, medications, {
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }

    // ALL CLINICS: Aggregate by drug and find low stock
    const pipeline = [
      {
        $group: {
          _id: '$drug',
          medication: { $first: '$medication' },
          category: { $first: '$category' },
          totalStock: { $sum: '$inventory.currentStock' },
          totalReorderPoint: { $sum: '$inventory.reorderPoint' },
          pricing: { $first: '$pricing' },
          firstId: { $first: '$_id' }
        }
      },
      {
        $match: {
          $expr: { $lte: ['$totalStock', '$totalReorderPoint'] }
        }
      },
      {
        $project: {
          _id: '$firstId',
          drug: '$_id',
          medication: 1,
          category: 1,
          inventory: {
            currentStock: '$totalStock',
            reorderPoint: '$totalReorderPoint',
            status: 'low-stock'
          },
          pricing: 1
        }
      },
      { $sort: { 'inventory.currentStock': 1 } }
    ];

    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await PharmacyInventory.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const medications = await PharmacyInventory.aggregate(pipeline);

    return paginated(res, medications, {
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    pharmacyLogger.error('Error getting low stock', { error: error.message, stack: error.stack });
    return error(res, 'Error retrieving low stock items');
  }
};

// Get expiring items
// MULTI-CLINIC: Filters by clinic or aggregates across all clinics
exports.getExpiring = async (req, res) => {
  try {
    const { days = 30, page = 1, limit = 20 } = req.query;
    const expiryDate = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000);

    // MULTI-CLINIC: If specific clinic, use simple query
    if (req.clinicId) {
      const query = {
        clinic: req.clinicId,
        'batches.expirationDate': { $lte: expiryDate },
        'batches.status': 'active'
      };

      const medications = await PharmacyInventory.find(query)
        .sort({ 'batches.expirationDate': 1 })
        .lean();

      return success(res, { data: medications });
    }

    // ALL CLINICS: Aggregate by drug and find expiring
    const pipeline = [
      {
        $match: {
          'batches.expirationDate': { $lte: expiryDate },
          'batches.status': 'active'
        }
      },
      {
        $group: {
          _id: '$drug',
          medication: { $first: '$medication' },
          category: { $first: '$category' },
          totalStock: { $sum: '$inventory.currentStock' },
          allBatches: { $push: '$batches' },
          pricing: { $first: '$pricing' },
          firstId: { $first: '$_id' }
        }
      },
      {
        $project: {
          _id: '$firstId',
          drug: '$_id',
          medication: 1,
          category: 1,
          inventory: {
            currentStock: '$totalStock'
          },
          batches: {
            $reduce: {
              input: '$allBatches',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] }
            }
          },
          pricing: 1
        }
      },
      { $sort: { 'batches.expirationDate': 1 } }
    ];

    const medications = await PharmacyInventory.aggregate(pipeline);

    return success(res, { data: medications });
  } catch (error) {
    pharmacyLogger.error('Error getting expiring items', { error: error.message, stack: error.stack });
    return error(res, 'Error retrieving expiring items');
  }
};

// Get single medication
exports.getMedication = async (req, res) => {
  try {
    const medication = await PharmacyInventory.findById(req.params.id).lean();

    if (!medication) {
      return notFound(res, 'Medication');
    }

    return success(res, { data: medication });
  } catch (error) {
    pharmacyLogger.error('Error getting medication', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error retrieving medication');
  }
};

// Create new medication
exports.createMedication = async (req, res) => {
  try {
    const medication = await PharmacyInventory.create({
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    return success(res, { data: medication, message: 'Medication created successfully', statusCode: 201 });
  } catch (error) {
    pharmacyLogger.error('Error creating medication', { body: req.body, error: error.message, stack: error.stack });
    return error(res, 'Error creating medication', 400);
  }
};

// Update medication
exports.updateMedication = async (req, res) => {
  try {
    const medication = await PharmacyInventory.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    if (!medication) {
      return notFound(res, 'Medication');
    }

    return success(res, { data: medication, message: 'Medication updated successfully' });
  } catch (error) {
    pharmacyLogger.error('Error updating medication', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error updating medication', 400);
  }
};

// Adjust stock - USES ATOMIC OPERATIONS to prevent race conditions
exports.adjustStock = async (req, res) => {
  try {
    const { type, quantity, notes, lotNumber } = req.body;

    if (!quantity || quantity <= 0) {
      return error(res, 'Quantity must be a positive number', 400);
    }

    // CRITICAL: Use atomic $inc to prevent race conditions
    // Calculate the delta based on operation type
    const isAddition = ['received', 'returned', 'correction'].includes(type);
    const stockDelta = isAddition ? quantity : -quantity;

    // First, atomically update the stock and add transaction
    const result = await PharmacyInventory.findOneAndUpdate(
      {
        _id: req.params.id,
        // For deductions, ensure we have enough stock (atomic check)
        ...(stockDelta < 0 ? { 'inventory.currentStock': { $gte: Math.abs(stockDelta) } } : {})
      },
      {
        $inc: { 'inventory.currentStock': stockDelta },
        $push: {
          'inventory.transactions': {
            type,
            quantity,
            // Note: balanceAfter will be calculated after update via post-hook or next read
            performedBy: req.user._id,
            notes,
            lotNumber,
            date: new Date()
          }
        },
        $set: { updatedBy: req.user._id }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!result) {
      // Check if medication exists at all
      const exists = await PharmacyInventory.findById(req.params.id).select('_id inventory.currentStock').lean();
      if (!exists) {
        return notFound(res, 'Medication');
      }
      // Medication exists but condition failed (insufficient stock)
      return error(res, `Stock insuffisant. Stock actuel: ${exists.inventory?.currentStock || 0}`, 400);
    }

    // Update status based on new stock level (this is safe as it's idempotent)
    result.updateStatus();
    await result.save();

    // Update the balanceAfter in the last transaction
    const lastTxIndex = result.inventory.transactions.length - 1;
    if (lastTxIndex >= 0) {
      result.inventory.transactions[lastTxIndex].balanceAfter = result.inventory.currentStock;
      await PharmacyInventory.updateOne(
        { _id: req.params.id },
        { $set: { [`inventory.transactions.${lastTxIndex}.balanceAfter`]: result.inventory.currentStock } }
      );
    }

    pharmacyLogger.info('Stock adjusted', {
      id: req.params.id,
      type,
      quantity,
      newStock: result.inventory.currentStock,
      userId: req.user._id
    });

    return success(res, { data: result, message: 'Stock adjusted successfully' });
  } catch (err) {
    pharmacyLogger.error('Error adjusting stock', { id: req.params.id, error: err.message, stack: err.stack });
    return error(res, 'Error adjusting stock', 400);
  }
};

// Dispense medication (integrated with prescription system)

// Reserve inventory for prescription
exports.reserveForPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.body;
    const Prescription = require('../models/Prescription');

    const prescription = await Prescription.findById(prescriptionId);

    if (!prescription) {
      return notFound(res, 'Prescription');
    }

    const result = await prescription.reserveInventory(req.user._id);

    return success(res, { data: result.results, message: result.success ? 'Inventory reserved successfully' : 'Some medications could not be reserved' });
  } catch (error) {
    pharmacyLogger.error('Error reserving inventory', { prescriptionId: req.body.prescriptionId, error: error.message, stack: error.stack });
    return error(res, 'Error reserving inventory', 400);
  }
};

// Search medications for prescription (Drug + Inventory data)
exports.searchMedications = async (req, res) => {
  try {
    const { q, category, inStockOnly = false, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return error(res, 'Search query must be at least 2 characters', 400);
    }

    const Drug = require('../models/Drug');

    // Build search query (sanitize input to prevent NoSQL injection)
    const sanitizedQ = escapeRegex(q);
    const searchQuery = {
      $or: [
        { brandName: { $regex: sanitizedQ, $options: 'i' } },
        { genericName: { $regex: sanitizedQ, $options: 'i' } },
        { 'activeIngredients.name': { $regex: sanitizedQ, $options: 'i' } }
      ]
    };

    if (category) {
      searchQuery.category = category;
    }

    // Search drugs
    const drugs = await Drug.find(searchQuery)
      .limit(parseInt(limit))
      .lean();

    // OPTIMIZATION: Batch fetch all inventory items in a single query
    // instead of N+1 individual findOne calls
    const drugIds = drugs.map(d => d._id);
    const inventoryItems = await PharmacyInventory.find({ drug: { $in: drugIds } }).lean();

    const inventoryMap = new Map(
      inventoryItems.map(item => [item.drug.toString(), item])
    );

    const results = drugs.map(drug => {
      const inventoryItem = inventoryMap.get(drug._id.toString());
      const available = inventoryItem ? (inventoryItem.inventory?.currentStock - (inventoryItem.inventory?.reserved || 0)) : 0;
      const inStock = available > 0;

      return {
        drugId: drug._id,
        brandName: drug.brandName,
        genericName: drug.genericName,
        category: drug.category,
        form: drug.form,
        strength: drug.strength,
        route: drug.route,
        activeIngredients: drug.activeIngredients,
        inventory: inventoryItem ? {
          inventoryId: inventoryItem._id,
          currentStock: inventoryItem.inventory?.currentStock || 0,
          reserved: inventoryItem.inventory?.reserved || 0,
          available: available,
          reorderLevel: inventoryItem.inventory?.reorderLevel || 0,
          pricing: inventoryItem.pricing,
          status: inventoryItem.status
        } : null,
        inStock
      };
    });

    // Filter by stock if requested
    const filteredResults = inStockOnly
      ? results.filter(r => r.inStock)
      : results;

    return success(res, { data: filteredResults });
  } catch (error) {
    pharmacyLogger.error('Error searching medications', { query: req.query.q, error: error.message, stack: error.stack });
    return error(res, 'Error searching medications');
  }
};

// ============================================
// BATCH MANAGEMENT - CRITICAL
// ============================================

// Get batches for a medication
exports.getBatches = async (req, res) => {
  try {
    const medication = await PharmacyInventory.findById(req.params.id)
      .select('batches medication')
      .lean();

    if (!medication) {
      return notFound(res, 'Medication');
    }

    return success(res, {
      data: {
        batches: medication.batches || [],
        medication: medication.medication
      }
    });
  } catch (error) {
    pharmacyLogger.error('Error getting batches', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error retrieving batches');
  }
};

// Add new batch to inventory - CRITICAL for receiving stock
exports.addBatch = async (req, res) => {
  try {
    const { lotNumber, quantity, expirationDate, manufactureDate, supplier, cost, notes } = req.body;

    if (!lotNumber || !quantity || !expirationDate) {
      return error(res, 'Lot number, quantity, and expiration date are required', 400);
    }

    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    // Check if lot number already exists
    const existingBatch = medication.batches.find(b => b.lotNumber === lotNumber);
    if (existingBatch) {
      return error(res, 'A batch with this lot number already exists', 400);
    }

    // Add batch using model method
    await medication.addBatch({
      lotNumber,
      quantity: parseInt(quantity),
      expirationDate: new Date(expirationDate),
      manufactureDate: manufactureDate ? new Date(manufactureDate) : undefined,
      supplier: supplier || {},
      cost: cost || {},
      notes
    }, req.user._id);

    return success(res, { data: medication.batches.find(b => b.lotNumber === lotNumber), message: 'Batch added successfully', statusCode: 201 });
  } catch (error) {
    pharmacyLogger.error('Error adding batch', { id: req.params.id, lotNumber: req.body.lotNumber, error: error.message, stack: error.stack });
    return error(res, 'Error adding batch', 400);
  }
};

// Update batch
exports.updateBatch = async (req, res) => {
  try {
    const { lotNumber } = req.params;
    const updateData = req.body;

    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    const batchIndex = medication.batches.findIndex(b => b.lotNumber === lotNumber);
    if (batchIndex === -1) {
      return notFound(res, 'Batch');
    }

    // Update batch fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'lotNumber' && key !== '_id') {
        medication.batches[batchIndex][key] = updateData[key];
      }
    });

    medication.updatedBy = req.user._id;
    await medication.save();

    return success(res, { data: medication.batches[batchIndex], message: 'Batch updated successfully' });
  } catch (error) {
    pharmacyLogger.error('Error updating batch', { id: req.params.id, lotNumber: req.params.lotNumber, error: error.message, stack: error.stack });
    return error(res, 'Error updating batch', 400);
  }
};

// Mark batch as expired
exports.markBatchExpired = async (req, res) => {
  try {
    const { lotNumber } = req.params;

    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    await medication.markBatchExpired(lotNumber, req.user._id);

    return success(res, { data: null, message: `Batch ${lotNumber} marked as expired` });
  } catch (error) {
    pharmacyLogger.error('Error marking batch expired', { id: req.params.id, lotNumber: req.params.lotNumber, error: error.message, stack: error.stack });
    return error(res, 'Error marking batch expired', 400);
  }
};

// ============================================
// DISPENSING - CRITICAL
// ============================================

// Dispense from inventory directly (not tied to prescription)
exports.dispenseFromInventory = async (req, res) => {
  try {
    const { quantity, patientId, lotNumber, notes, reason } = req.body;

    if (!quantity) {
      return error(res, 'Quantity is required', 400);
    }

    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    await medication.dispenseMedication(
      parseInt(quantity),
      null, // No prescription
      patientId || null,
      req.user._id,
      lotNumber
    );

    return success(res, {
      data: {
        medication: medication.medication.brandName || medication.medication.genericName,
        quantity,
        lotNumber,
        currentStock: medication.inventory.currentStock
      },
      message: `Dispensed ${quantity} units successfully`
    });
  } catch (error) {
    pharmacyLogger.error('Error dispensing medication', { id: req.params.id, quantity: req.body.quantity, error: error.message, stack: error.stack });
    return error(res, 'Error dispensing medication', 400);
  }
};

// Dispense prescription medications - CRITICAL (prescription-to-dispensing flow)
exports.dispensePrescription = async (req, res) => {
  try {
    const { prescriptionId, medicationIndex, pharmacyNotes, overrideAllergyCheck } = req.body;

    if (!prescriptionId) {
      return error(res, 'Prescription ID is required', 400);
    }

    const Prescription = require('../models/Prescription');
    const Patient = require('../models/Patient');
    const Drug = require('../models/Drug');

    const prescription = await Prescription.findById(prescriptionId).populate('patient');

    if (!prescription) {
      return notFound(res, 'Prescription');
    }

    // CRITICAL: Check prescription validity
    if (prescription.isExpired) {
      return error(res, 'Ordonnance expirée. Veuillez obtenir une nouvelle ordonnance.', 400);
    }

    // CRITICAL: Check for patient allergies before dispensing
    if (!overrideAllergyCheck && prescription.patient) {
      const patient = await findPatientByIdOrCode(prescription.patient._id || prescription.patient);

      if (patient && patient.allergies && patient.allergies.length > 0) {
        const allergyWarnings = [];

        // Check each medication against patient allergies
        const medicationsToCheck = medicationIndex !== undefined
          ? [prescription.medications[medicationIndex]]
          : prescription.medications.filter(m => m.reservation?.status === 'reserved' && !m.dispensing?.dispensed);

        for (const med of medicationsToCheck) {
          // Get drug details if available
          let drugDetails = null;
          if (med.drug) {
            drugDetails = await Drug.findById(med.drug).lean();
          }

          for (const allergy of patient.allergies) {
            const allergen = (allergy.allergen || allergy.name || allergy);
            const medName = med.name || med.genericName || '';
            const genericName = med.genericName || drugDetails?.genericName || '';
            const brandName = med.brand || drugDetails?.brandName || '';

            // Check for direct name match using word boundary matching
            // FIX: Use matchesAllergen() instead of includes() to prevent false positives
            // e.g., "ASA" should NOT match "NASAL" spray
            if (matchesAllergen(medName, allergen) ||
                matchesAllergen(genericName, allergen) ||
                matchesAllergen(brandName, allergen)) {
              allergyWarnings.push({
                medication: med.name || med.genericName,
                allergen: allergy.allergen || allergy.name || allergy,
                severity: allergy.severity || 'unknown',
                reaction: allergy.reaction || 'Réaction inconnue'
              });
            }

            // Check active ingredients if drug details available
            if (drugDetails && drugDetails.activeIngredients) {
              for (const ingredient of drugDetails.activeIngredients) {
                // FIX: Use word boundary matching for ingredients too
                if (matchesAllergen(ingredient.name, allergen)) {
                  allergyWarnings.push({
                    medication: med.name || med.genericName,
                    allergen: ingredient.name,
                    matchedPatientAllergy: allergy.allergen || allergy.name || allergy,
                    severity: allergy.severity || 'unknown',
                    reaction: allergy.reaction || 'Réaction inconnue'
                  });
                }
              }
            }
          }
        }

        if (allergyWarnings.length > 0) {
          return error(res, 'ALERTE ALLERGIE: Le patient est allergique à un ou plusieurs médicaments prescrits', 409);
        }
      }
    }

    // CRITICAL: Check for expired batches before dispensing
    const { Inventory, PharmacyInventory } = require('../models/Inventory');
    const expiredBatchWarnings = [];
    const medicationsToDispense = medicationIndex !== undefined
      ? [prescription.medications[medicationIndex]]
      : prescription.medications.filter(m => m.reservation?.status === 'reserved' && !m.dispensing?.dispensed);

    for (const med of medicationsToDispense) {
      if (med.inventoryItem) {
        const inventory = await PharmacyInventory.findById(med.inventoryItem);
        if (inventory && inventory.batches) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Check reserved batches for expiration
          // CRITICAL FIX: Use lotNumber (schema field) not batchNumber
          for (const batch of inventory.batches) {
            if (batch.expirationDate && new Date(batch.expirationDate) < today) {
              // Check if this batch was reserved for this medication
              if (med.reservation?.batches?.some(rb => rb.lotNumber === batch.lotNumber)) {
                expiredBatchWarnings.push({
                  medication: med.name || med.genericName,
                  lotNumber: batch.lotNumber,
                  expirationDate: batch.expirationDate,
                  message: `Le lot ${batch.lotNumber} est expiré depuis ${batch.expirationDate.toLocaleDateString('fr-FR')}`
                });
              }
            }
          }
        }
      }
    }

    if (expiredBatchWarnings.length > 0) {
      return error(res, 'ALERTE: Des lots expirés ont été détectés. Veuillez sélectionner des lots valides.', 400);
    }

    // Helper: Audit controlled substance dispensing
    const auditControlledDispensing = async (medications, patientInfo) => {
      const AuditLog = require('../models/AuditLog');
      const controlledMeds = medications.filter(m => m.controlledSubstance?.isControlled);

      if (controlledMeds.length > 0) {
        await AuditLog.create({
          action: 'CONTROLLED_SUBSTANCE_DISPENSED',
          userId: req.user._id,
          resource: 'Prescription',
          resourceId: prescription._id,
          details: {
            prescriptionId: prescription.prescriptionId,
            patientId: patientInfo?._id || prescription.patient,
            patientName: patientInfo ? `${patientInfo.firstName} ${patientInfo.lastName}` : 'Unknown',
            medications: controlledMeds.map(m => ({
              name: m.name || m.genericName,
              schedule: m.controlledSubstance.schedule,
              quantity: m.quantity,
              dispensedQuantity: m.dispensing?.dispensedQuantity
            })),
            dispensedBy: req.user._id,
            dispensedAt: new Date(),
            pharmacyNotes: pharmacyNotes
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          severity: 'high' // Controlled substance operations are always high severity
        });

        pharmacyLogger.info('ControlledSubstanceDispensed', {
          prescriptionId: prescription.prescriptionId,
          medications: controlledMeds.map(m => `${m.name} (Schedule ${m.controlledSubstance.schedule})`),
          dispensedBy: req.user._id
        });
      }
    };

    // If medicationIndex provided, dispense specific medication
    if (medicationIndex !== undefined) {
      const result = await prescription.dispenseMedication(
        parseInt(medicationIndex),
        req.user._id,
        pharmacyNotes
      );

      // Audit controlled substance if applicable
      const med = prescription.medications[medicationIndex];
      if (med?.controlledSubstance?.isControlled) {
        await auditControlledDispensing([med], prescription.patient);
      }

      return success(res, { data: result, message: 'Medication dispensed successfully' });
    }

    // Otherwise, dispense all reserved medications atomically
    // CRITICAL: Wrap in transaction to prevent partial dispensing
    const medicationsToDispenseAll = [];
    for (let i = 0; i < prescription.medications.length; i++) {
      const med = prescription.medications[i];
      if (med.reservation?.status === 'reserved' && !med.dispensing?.dispensed) {
        medicationsToDispenseAll.push({ index: i, medication: med });
      }
    }

    let results = [];
    let dispensedMeds = [];

    if (medicationsToDispenseAll.length > 0) {
      try {
        // Use transaction to ensure all medications dispense atomically or none
        const transactionResult = await withTransactionRetry(async (session) => {
          const txResults = [];
          const txDispensedMeds = [];

          for (const { index, medication } of medicationsToDispenseAll) {
            // Pass session to dispenseMedication for transaction support
            const result = await prescription.dispenseMedication(index, req.user._id, pharmacyNotes, session);
            txResults.push(result);
            txDispensedMeds.push(medication);
          }

          return { results: txResults, dispensedMeds: txDispensedMeds };
        }, { maxRetries: 3 });

        results = transactionResult.results;
        dispensedMeds = transactionResult.dispensedMeds;
      } catch (txError) {
        // Transaction failed - no medications were dispensed
        pharmacyLogger.error('Transaction failed during batch dispensing', {
          prescriptionId: prescription.prescriptionId,
          error: txError.message,
          stack: txError.stack
        });

        // Return error indicating complete rollback
        return error(res, `Dispensing annule: ${txError.message}. Aucun medicament n'a ete dispense.`, 400);
      }
    }

    // Audit all controlled substances that were dispensed
    await auditControlledDispensing(dispensedMeds, prescription.patient);

    return success(res, {
      data: {
        prescriptionId: prescription.prescriptionId,
        status: prescription.status,
        pharmacyStatus: prescription.pharmacyStatus,
        results
      },
      message: 'Prescription dispensing completed'
    });
  } catch (error) {
    pharmacyLogger.error('Error dispensing prescription', { prescriptionId: req.body.prescriptionId, error: error.message, stack: error.stack });
    return error(res, 'Error dispensing prescription', 400);
  }
};

// ============================================
// RESERVATION MANAGEMENT
// ============================================

// Reserve stock for a specific inventory item
exports.reserveStock = async (req, res) => {
  try {
    const { quantity, type, referenceId, referenceModel, notes } = req.body;

    if (!quantity || !type || !referenceId) {
      return error(res, 'Quantity, type, and reference ID are required', 400);
    }

    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    const reservation = await medication.reserveStock(
      parseInt(quantity),
      type,
      referenceId,
      referenceModel || 'Prescription',
      req.user._id
    );

    return success(res, { data: reservation, message: 'Stock reserved successfully' });
  } catch (error) {
    pharmacyLogger.error('Error reserving stock', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error reserving stock', 400);
  }
};

// Release a reservation
exports.releaseReservation = async (req, res) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      return error(res, 'Reservation ID is required', 400);
    }

    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    const result = await medication.releaseReservation(reservationId);

    return success(res, { data: result, message: 'Reservation released successfully' });
  } catch (error) {
    pharmacyLogger.error('Error releasing reservation', { id: req.params.id, reservationId: req.body.reservationId, error: error.message, stack: error.stack });
    return error(res, 'Error releasing reservation', 400);
  }
};

// ============================================
// TRANSACTION HISTORY
// ============================================

// Get transactions for a specific medication
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query;

    const medication = await PharmacyInventory.findById(req.params.id)
      .select('transactions medication')
      .populate('transactions.performedBy', 'name email')
      .lean();

    if (!medication) {
      return notFound(res, 'Medication');
    }

    let transactions = medication.transactions || [];

    // Filter by type if provided
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Paginate
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedTransactions = transactions.slice(skip, skip + parseInt(limit));

    return paginated(res, paginatedTransactions, {
      total: transactions.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    pharmacyLogger.error('Error getting transactions', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error retrieving transactions');
  }
};

// Get all transactions across all inventory
exports.getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;

    const matchStage = {};
    if (type) {
      matchStage['transactions.type'] = type;
    }

    const dateMatch = {};
    if (startDate) {
      dateMatch.$gte = new Date(startDate);
    }
    if (endDate) {
      dateMatch.$lte = new Date(endDate);
    }
    if (Object.keys(dateMatch).length > 0) {
      matchStage['transactions.date'] = dateMatch;
    }

    const results = await PharmacyInventory.aggregate([
      { $unwind: '$transactions' },
      { $match: matchStage },
      { $sort: { 'transactions.date': -1 } },
      {
        $project: {
          medication: '$medication',
          transaction: '$transactions'
        }
      },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    const total = await PharmacyInventory.aggregate([
      { $unwind: '$transactions' },
      { $match: matchStage },
      { $count: 'total' }
    ]);

    return paginated(res, results, {
      total: total[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    pharmacyLogger.error('Error getting all transactions', { error: error.message, stack: error.stack });
    return error(res, 'Error retrieving transactions');
  }
};

// ============================================
// INVENTORY VALUE
// ============================================

// Get total inventory value
exports.getInventoryValue = async (req, res) => {
  try {
    const result = await PharmacyInventory.getInventoryValue();
    const value = result[0]?.totalInventoryValue || 0;

    // Get breakdown by category
    const categoryBreakdown = await PharmacyInventory.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: '$category',
          totalValue: {
            $sum: { $multiply: ['$inventory.currentStock', { $ifNull: ['$pricing.costPrice', 0] }] }
          },
          itemCount: { $sum: 1 },
          totalUnits: { $sum: '$inventory.currentStock' }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    return success(res, {
      data: {
        totalValue: value,
        currency: process.env.BASE_CURRENCY || 'CDF',
        breakdown: categoryBreakdown
      }
    });
  } catch (error) {
    pharmacyLogger.error('Error getting inventory value', { error: error.message, stack: error.stack });
    return error(res, 'Error calculating inventory value');
  }
};

// Export inventory report
exports.exportInventory = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    // Safety limit for exports - 10,000 max to prevent memory issues
    const EXPORT_LIMIT = 10000;

    const inventory = await PharmacyInventory.find({ active: true })
      .select('medication inventory pricing category batches')
      .limit(EXPORT_LIMIT)
      .lean();

    if (format === 'csv') {
      const headers = 'Name,Generic Name,Category,Current Stock,Reserved,Available,Cost Price,Selling Price,Status\n';
      const rows = inventory.map(item => {
        const available = (item.inventory?.currentStock || 0) - (item.inventory?.reserved || 0);
        return [
          item.medication?.brandName || '',
          item.medication?.genericName || '',
          item.category || '',
          item.inventory?.currentStock || 0,
          item.inventory?.reserved || 0,
          available,
          item.pricing?.costPrice || 0,
          item.pricing?.sellingPrice || 0,
          item.inventory?.status || ''
        ].join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
      return res.send(headers + rows);
    } else {
      return success(res, { data: inventory });
    }
  } catch (error) {
    pharmacyLogger.error('Error exporting inventory', { format: req.query.format, error: error.message, stack: error.stack });
    return error(res, 'Error exporting inventory');
  }
};

// ============================================
// PROFIT MARGIN REPORTING
// ============================================

// Get profit margin report
exports.getProfitMarginReport = async (req, res) => {
  try {
    const { startDate, endDate, category, groupBy = 'item' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Build match stage for dispensing transactions
    const matchStage = {
      'transactions.type': 'dispense',
      'transactions.date': { $gte: start, $lte: end }
    };

    if (category) {
      matchStage.category = category;
    }

    // Get sales data with cost and selling prices
    const salesData = await PharmacyInventory.aggregate([
      { $match: { active: true } },
      { $unwind: '$transactions' },
      { $match: matchStage },
      {
        $project: {
          medication: '$medication',
          category: 1,
          costPrice: '$pricing.costPrice',
          sellingPrice: '$pricing.sellingPrice',
          quantity: '$transactions.quantity',
          transactionDate: '$transactions.date',
          // Calculate revenue and cost per transaction
          revenue: { $multiply: ['$transactions.quantity', { $ifNull: ['$pricing.sellingPrice', 0] }] },
          cost: { $multiply: ['$transactions.quantity', { $ifNull: ['$pricing.costPrice', 0] }] }
        }
      },
      {
        $group: {
          _id: groupBy === 'category' ? '$category' : {
            itemId: '$_id',
            name: '$medication.brandName',
            genericName: '$medication.genericName',
            category: '$category'
          },
          totalQuantitySold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$revenue' },
          totalCost: { $sum: '$cost' },
          avgCostPrice: { $avg: '$costPrice' },
          avgSellingPrice: { $avg: '$sellingPrice' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          grossProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
          marginPercent: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              { $multiply: [{ $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] }, 100] }
            ]
          },
          markupPercent: {
            $cond: [
              { $eq: ['$totalCost', 0] },
              0,
              { $multiply: [{ $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalCost'] }, 100] }
            ]
          }
        }
      },
      { $sort: { grossProfit: -1 } }
    ]);

    // Calculate summary totals
    const summary = salesData.reduce((acc, item) => ({
      totalRevenue: acc.totalRevenue + item.totalRevenue,
      totalCost: acc.totalCost + item.totalCost,
      totalQuantity: acc.totalQuantity + item.totalQuantitySold,
      totalTransactions: acc.totalTransactions + item.transactionCount
    }), { totalRevenue: 0, totalCost: 0, totalQuantity: 0, totalTransactions: 0 });

    summary.grossProfit = summary.totalRevenue - summary.totalCost;
    summary.marginPercent = summary.totalRevenue > 0
      ? Math.round((summary.grossProfit / summary.totalRevenue) * 10000) / 100
      : 0;
    summary.markupPercent = summary.totalCost > 0
      ? Math.round((summary.grossProfit / summary.totalCost) * 10000) / 100
      : 0;

    // Format the items for response
    const formattedItems = salesData.map(item => {
      const itemData = groupBy === 'category' ? {
        category: item._id
      } : {
        itemId: item._id.itemId,
        name: item._id.name,
        genericName: item._id.genericName,
        category: item._id.category
      };

      return {
        ...itemData,
        quantitySold: item.totalQuantitySold,
        revenue: Math.round(item.totalRevenue * 100) / 100,
        cost: Math.round(item.totalCost * 100) / 100,
        grossProfit: Math.round(item.grossProfit * 100) / 100,
        marginPercent: Math.round(item.marginPercent * 100) / 100,
        markupPercent: Math.round(item.markupPercent * 100) / 100,
        avgCostPrice: Math.round(item.avgCostPrice * 100) / 100,
        avgSellingPrice: Math.round(item.avgSellingPrice * 100) / 100,
        transactions: item.transactionCount
      };
    });

    // Get items with low/negative margins
    const lowMarginItems = formattedItems.filter(item => item.marginPercent < 20);
    const negativeMarginItems = formattedItems.filter(item => item.marginPercent < 0);

    return success(res, {
      data: {
        period: { start, end },
        summary: {
          totalRevenue: Math.round(summary.totalRevenue * 100) / 100,
          totalCost: Math.round(summary.totalCost * 100) / 100,
          grossProfit: Math.round(summary.grossProfit * 100) / 100,
          marginPercent: summary.marginPercent,
          markupPercent: summary.markupPercent,
          totalQuantitySold: summary.totalQuantity,
          totalTransactions: summary.totalTransactions,
          currency: process.env.BASE_CURRENCY || 'CDF'
        },
        alerts: {
          lowMarginItemCount: lowMarginItems.length,
          negativeMarginItemCount: negativeMarginItems.length
        },
        items: formattedItems,
        lowMarginItems: lowMarginItems.slice(0, 10),
        topProfitItems: formattedItems.slice(0, 10)
      }
    });
  } catch (error) {
    pharmacyLogger.error('Error getting profit margin report', { error: error.message, stack: error.stack });
    return error(res, 'Error generating profit margin report');
  }
};

// Get item-level margin analysis
exports.getItemMarginAnalysis = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { months = 6 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const item = await PharmacyInventory.findById(itemId);
    if (!item) {
      return notFound(res, 'Item');
    }

    // Get monthly sales data
    const monthlyData = await PharmacyInventory.aggregate([
      { $match: { _id: item._id } },
      { $unwind: '$transactions' },
      {
        $match: {
          'transactions.type': 'dispense',
          'transactions.date': { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$transactions.date' } },
          quantity: { $sum: '$transactions.quantity' },
          revenue: { $sum: { $multiply: ['$transactions.quantity', { $ifNull: ['$pricing.sellingPrice', 0] }] } },
          cost: { $sum: { $multiply: ['$transactions.quantity', { $ifNull: ['$pricing.costPrice', 0] }] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const formattedMonthly = monthlyData.map(m => ({
      month: m._id,
      quantity: m.quantity,
      revenue: Math.round(m.revenue * 100) / 100,
      cost: Math.round(m.cost * 100) / 100,
      profit: Math.round((m.revenue - m.cost) * 100) / 100,
      marginPercent: m.revenue > 0 ? Math.round(((m.revenue - m.cost) / m.revenue) * 10000) / 100 : 0
    }));

    return success(res, {
      data: {
        item: {
          id: item._id,
          name: item.medication?.brandName,
          genericName: item.medication?.genericName,
          category: item.category,
          currentCostPrice: item.pricing?.costPrice || 0,
          currentSellingPrice: item.pricing?.sellingPrice || 0,
          currentMargin: item.pricing?.margin || 0
        },
        monthlyAnalysis: formattedMonthly,
        averages: {
          avgMonthlyQuantity: formattedMonthly.length > 0
            ? Math.round(formattedMonthly.reduce((sum, m) => sum + m.quantity, 0) / formattedMonthly.length)
            : 0,
          avgMonthlyRevenue: formattedMonthly.length > 0
            ? Math.round(formattedMonthly.reduce((sum, m) => sum + m.revenue, 0) / formattedMonthly.length * 100) / 100
            : 0,
          avgMarginPercent: formattedMonthly.length > 0
            ? Math.round(formattedMonthly.reduce((sum, m) => sum + m.marginPercent, 0) / formattedMonthly.length * 100) / 100
            : 0
        }
      }
    });
  } catch (error) {
    pharmacyLogger.error('Error getting item margin analysis', { itemId: req.params.itemId, error: error.message, stack: error.stack });
    return error(res, 'Error analyzing item margins');
  }
};

// ============================================
// SUPPLIER MANAGEMENT
// ============================================

// Get all suppliers (extracted from inventory items)
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await PharmacyInventory.aggregate([
      { $unwind: '$suppliers' },
      {
        $group: {
          _id: '$suppliers.name',
          contact: { $first: '$suppliers.contact' },
          isPrimary: { $first: '$suppliers.isPrimary' },
          leadTime: { $first: '$suppliers.leadTime' },
          minimumOrder: { $first: '$suppliers.minimumOrder' },
          medicationCount: { $sum: 1 }
        }
      },
      { $sort: { medicationCount: -1 } }
    ]);

    return success(res, { data: suppliers });
  } catch (error) {
    pharmacyLogger.error('Error getting suppliers', { error: error.message, stack: error.stack });
    return error(res, 'Error retrieving suppliers');
  }
};

// Create/Add supplier to a medication
exports.createSupplier = async (req, res) => {
  try {
    const { medicationId, name, contact, isPrimary, leadTime, minimumOrder, notes } = req.body;

    if (!medicationId || !name) {
      return error(res, 'Medication ID and supplier name are required', 400);
    }

    const medication = await PharmacyInventory.findById(medicationId);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    // Check if supplier already exists
    const existingSupplier = medication.suppliers.find(s => s.name === name);
    if (existingSupplier) {
      return error(res, 'Supplier already exists for this medication', 400);
    }

    medication.suppliers.push({
      name,
      contact: contact || {},
      isPrimary: isPrimary || false,
      leadTime,
      minimumOrder,
      notes
    });

    medication.updatedBy = req.user._id;
    await medication.save();

    return success(res, { data: medication.suppliers[medication.suppliers.length - 1], message: 'Supplier added successfully', statusCode: 201 });
  } catch (error) {
    pharmacyLogger.error('Error creating supplier', { medicationId: req.body.medicationId, error: error.message, stack: error.stack });
    return error(res, 'Error creating supplier', 400);
  }
};

// Get supplier details
exports.getSupplier = async (req, res) => {
  try {
    const { id } = req.params; // This is the supplier name (encoded)
    const supplierName = decodeURIComponent(id);

    const medicationsWithSupplier = await PharmacyInventory.find({
      'suppliers.name': supplierName
    })
      .select('medication suppliers category')
      .lean();

    const supplier = medicationsWithSupplier[0]?.suppliers.find(s => s.name === supplierName);

    if (!supplier) {
      return notFound(res, 'Supplier');
    }

    return success(res, {
      data: {
        ...supplier,
        medications: medicationsWithSupplier.map(m => ({
          id: m._id,
          name: m.medication?.brandName || m.medication?.genericName,
          category: m.category
        }))
      }
    });
  } catch (error) {
    pharmacyLogger.error('Error getting supplier', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error retrieving supplier');
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierName = decodeURIComponent(id);
    const { newName, contact, isPrimary, leadTime, minimumOrder, notes, medicationId } = req.body;

    if (!medicationId) {
      return error(res, 'Medication ID is required', 400);
    }

    const medication = await PharmacyInventory.findById(medicationId);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    const supplierIndex = medication.suppliers.findIndex(s => s.name === supplierName);
    if (supplierIndex === -1) {
      return notFound(res, 'Supplier');
    }

    // Update supplier fields
    if (newName) medication.suppliers[supplierIndex].name = newName;
    if (contact) medication.suppliers[supplierIndex].contact = contact;
    if (isPrimary !== undefined) medication.suppliers[supplierIndex].isPrimary = isPrimary;
    if (leadTime !== undefined) medication.suppliers[supplierIndex].leadTime = leadTime;
    if (minimumOrder !== undefined) medication.suppliers[supplierIndex].minimumOrder = minimumOrder;
    if (notes !== undefined) medication.suppliers[supplierIndex].notes = notes;

    medication.updatedBy = req.user._id;
    await medication.save();

    return success(res, { data: medication.suppliers[supplierIndex], message: 'Supplier updated successfully' });
  } catch (error) {
    pharmacyLogger.error('Error updating supplier', { id: req.params.id, medicationId: req.body.medicationId, error: error.message, stack: error.stack });
    return error(res, 'Error updating supplier', 400);
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierName = decodeURIComponent(id);
    const { medicationId } = req.body;

    if (!medicationId) {
      return error(res, 'Medication ID is required', 400);
    }

    const medication = await PharmacyInventory.findById(medicationId);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    medication.suppliers = medication.suppliers.filter(s => s.name !== supplierName);
    medication.updatedBy = req.user._id;
    await medication.save();

    return success(res, { data: null, message: 'Supplier removed successfully' });
  } catch (error) {
    pharmacyLogger.error('Error deleting supplier', { id: req.params.id, medicationId: req.body.medicationId, error: error.message, stack: error.stack });
    return error(res, 'Error deleting supplier', 400);
  }
};

// ============================================
// REORDER MANAGEMENT
// ============================================

// Get reorder suggestions
exports.getReorderSuggestions = async (req, res) => {
  try {
    const lowStockItems = await PharmacyInventory.find({
      $or: [
        { 'inventory.status': 'low-stock' },
        { 'inventory.status': 'out-of-stock' },
        {
          $expr: {
            $lte: ['$inventory.currentStock', '$inventory.reorderPoint']
          }
        }
      ],
      active: true,
      discontinued: false
    })
      .select('medication inventory pricing suppliers reorder category')
      .lean();

    const suggestions = lowStockItems.map(item => {
      const available = (item.inventory?.currentStock || 0) - (item.inventory?.reserved || 0);
      const reorderQty = item.reorder?.reorderQuantity ||
        (item.inventory?.optimalStock || item.inventory?.maximumStock || 100) - available;

      return {
        medicationId: item._id,
        name: item.medication?.brandName || item.medication?.genericName,
        genericName: item.medication?.genericName,
        category: item.category,
        currentStock: item.inventory?.currentStock || 0,
        reserved: item.inventory?.reserved || 0,
        available,
        reorderPoint: item.inventory?.reorderPoint,
        suggestedQuantity: Math.max(reorderQty, 0),
        primarySupplier: item.suppliers?.find(s => s.isPrimary) || item.suppliers?.[0],
        estimatedCost: reorderQty * (item.pricing?.costPrice || 0),
        onOrder: item.reorder?.onOrder || false,
        lastOrderDate: item.reorder?.lastOrderDate
      };
    });

    // Sort by urgency (out of stock first, then low stock)
    suggestions.sort((a, b) => {
      if (a.available === 0 && b.available > 0) return -1;
      if (b.available === 0 && a.available > 0) return 1;
      return a.available - b.available;
    });

    return success(res, { data: suggestions });
  } catch (error) {
    pharmacyLogger.error('Error getting reorder suggestions', { error: error.message, stack: error.stack });
    return error(res, 'Error getting reorder suggestions');
  }
};

// Create reorder
exports.createReorder = async (req, res) => {
  try {
    const { medicationId, quantity, supplier, expectedDeliveryDate, notes, orderReference } = req.body;

    if (!medicationId || !quantity) {
      return error(res, 'Medication ID and quantity are required', 400);
    }

    const medication = await PharmacyInventory.findById(medicationId);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    medication.reorder = {
      ...medication.reorder,
      onOrder: true,
      orderQuantity: parseInt(quantity),
      orderDate: new Date(),
      orderReference: orderReference || `ORD-${Date.now()}`,
      supplier: supplier || medication.suppliers?.find(s => s.isPrimary)?.name,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined
    };

    medication.inventory.status = 'on-order';
    medication.updatedBy = req.user._id;
    await medication.save();

    return success(res, {
      data: {
        medication: medication.medication?.brandName || medication.medication?.genericName,
        orderReference: medication.reorder.orderReference,
        quantity: medication.reorder.orderQuantity,
        supplier: medication.reorder.supplier,
        expectedDeliveryDate: medication.reorder.expectedDeliveryDate
      },
      message: 'Reorder created successfully',
      statusCode: 201
    });
  } catch (error) {
    pharmacyLogger.error('Error creating reorder', { medicationId: req.body.medicationId, error: error.message, stack: error.stack });
    return error(res, 'Error creating reorder', 400);
  }
};

// Receive order (complete reorder and add to inventory)
exports.receiveOrder = async (req, res) => {
  try {
    const { lotNumber, quantity, expirationDate, manufactureDate, cost, notes } = req.body;

    if (!lotNumber || !quantity || !expirationDate) {
      return error(res, 'Lot number, quantity, and expiration date are required', 400);
    }

    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    // Add the batch
    await medication.addBatch({
      lotNumber,
      quantity: parseInt(quantity),
      expirationDate: new Date(expirationDate),
      manufactureDate: manufactureDate ? new Date(manufactureDate) : undefined,
      supplier: {
        name: medication.reorder?.supplier,
        reference: medication.reorder?.orderReference
      },
      cost: cost || {},
      notes
    }, req.user._id);

    // Update reorder status
    medication.reorder = {
      ...medication.reorder,
      onOrder: false,
      lastOrderDate: medication.reorder?.orderDate,
      lastOrderQuantity: medication.reorder?.orderQuantity
    };

    await medication.save();

    return success(res, {
      data: {
        medication: medication.medication?.brandName || medication.medication?.genericName,
        lotNumber,
        quantity: parseInt(quantity),
        currentStock: medication.inventory.currentStock
      },
      message: 'Order received and added to inventory'
    });
  } catch (error) {
    pharmacyLogger.error('Error receiving order', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error receiving order', 400);
  }
};

// ============================================
// ALERT MANAGEMENT
// ============================================

// Resolve an alert
exports.resolveAlert = async (req, res) => {
  try {
    const { id, alertId } = req.params;

    const medication = await PharmacyInventory.findById(id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    const alert = medication.alerts.id(alertId);
    if (!alert) {
      return notFound(res, 'Alert');
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = req.user._id;

    await medication.save();

    return success(res, { data: null, message: 'Alert resolved successfully' });
  } catch (error) {
    pharmacyLogger.error('Error resolving alert', { id: req.params.id, alertId: req.params.alertId, error: error.message, stack: error.stack });
    return error(res, 'Error resolving alert', 400);
  }
};

// ============================================
// DELETE MEDICATION
// ============================================

// Delete/deactivate medication
exports.deleteMedication = async (req, res) => {
  try {
    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return notFound(res, 'Medication');
    }

    // Check for active reservations
    const activeReservations = medication.reservations?.filter(r => r.status === 'active') || [];
    if (activeReservations.length > 0) {
      return error(res, 'Cannot delete medication with active reservations', 400);
    }

    // Soft delete - mark as inactive/discontinued
    medication.active = false;
    medication.discontinued = true;
    medication.discontinuedDate = new Date();
    medication.discontinuedReason = 'Deleted by user';
    medication.updatedBy = req.user._id;

    await medication.save();

    return success(res, { data: null, message: 'Medication deactivated successfully' });
  } catch (error) {
    pharmacyLogger.error('Error deleting medication', { id: req.params.id, error: error.message, stack: error.stack });
    return error(res, 'Error deleting medication', 400);
  }
};
