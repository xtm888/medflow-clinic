const PharmacyInventory = require('../models/PharmacyInventory');
const { escapeRegex } = require('../utils/sanitize');

// Get all pharmacy inventory with filtering and pagination
exports.getInventory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status
    } = req.query;

    const query = {};

    if (search) {
      const sanitizedSearch = escapeRegex(search);
      query.$or = [
        { 'medication.brandName': { $regex: sanitizedSearch, $options: 'i' } },
        { 'medication.genericName': { $regex: sanitizedSearch, $options: 'i' } },
        { sku: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [medications, total] = await Promise.all([
      PharmacyInventory.find(query)
        .sort({ 'medication.brandName': 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PharmacyInventory.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: medications,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventory',
      error: error.message
    });
  }
};

// Get inventory statistics
exports.getStats = async (req, res) => {
  try {
    const [totalItems, lowStockItems, expiringItems] = await Promise.all([
      PharmacyInventory.countDocuments(),
      PharmacyInventory.countDocuments({ status: 'low-stock' }),
      PharmacyInventory.countDocuments({
        'batches.expirationDate': {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        'batches.status': 'active'
      })
    ]);

    const medications = await PharmacyInventory.find().lean();
    const totalValue = medications.reduce((sum, med) => {
      const stock = med.inventory?.currentStock || 0;
      const price = med.pricing?.sellingPrice || 0;
      return sum + (stock * price);
    }, 0);

    res.json({
      totalItems,
      lowStock: lowStockItems,
      expiringSoon: expiringItems,
      totalValue
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics',
      error: error.message
    });
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
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      'batches.status': 'active'
    }).lean();

    expiringSoon.forEach(med => {
      const name = med.medication?.brandName || med.medication?.genericName || 'Unknown medication';
      med.batches
        .filter(b => b.status === 'active')
        .forEach(batch => {
          const daysToExpiry = Math.floor((new Date(batch.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysToExpiry <= 30) {
            alerts.push({
              type: daysToExpiry < 7 ? 'error' : 'warning',
              message: `${name} (Lot ${batch.lotNumber}) expires in ${daysToExpiry} days`
            });
          }
        });
    });

    res.json(alerts);
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving alerts',
      error: error.message
    });
  }
};

// Get low stock items
exports.getLowStock = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [medications, total] = await Promise.all([
      PharmacyInventory.find({ status: 'low-stock' })
        .sort({ 'inventory.currentStock': 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PharmacyInventory.countDocuments({ status: 'low-stock' })
    ]);

    res.json({
      success: true,
      data: medications,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error getting low stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving low stock items',
      error: error.message
    });
  }
};

// Get expiring items
exports.getExpiring = async (req, res) => {
  try {
    const { days = 30, page = 1, limit = 20 } = req.query;
    const expiryDate = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000);

    const medications = await PharmacyInventory.find({
      'batches.expirationDate': { $lte: expiryDate },
      'batches.status': 'active'
    })
      .sort({ 'batches.expirationDate': 1 })
      .lean();

    res.json({
      success: true,
      data: medications,
      total: medications.length
    });
  } catch (error) {
    console.error('Error getting expiring items:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving expiring items',
      error: error.message
    });
  }
};

// Get single medication
exports.getMedication = async (req, res) => {
  try {
    const medication = await PharmacyInventory.findById(req.params.id).lean();

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    res.json({
      success: true,
      data: medication
    });
  } catch (error) {
    console.error('Error getting medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving medication',
      error: error.message
    });
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

    res.status(201).json({
      success: true,
      data: medication
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating medication',
      error: error.message
    });
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
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    res.json({
      success: true,
      data: medication
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating medication',
      error: error.message
    });
  }
};

// Adjust stock
exports.adjustStock = async (req, res) => {
  try {
    const { type, quantity, notes, lotNumber } = req.body;
    const medication = await PharmacyInventory.findById(req.params.id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    // Update stock based on type
    if (type === 'received' || type === 'returned' || type === 'correction') {
      medication.inventory.currentStock += quantity;
    } else {
      medication.inventory.currentStock -= quantity;
    }

    // Add transaction
    if (!medication.inventory.transactions) {
      medication.inventory.transactions = [];
    }
    medication.inventory.transactions.push({
      type,
      quantity,
      balanceAfter: medication.inventory.currentStock,
      performedBy: req.user._id,
      notes,
      lotNumber
    });

    // Update status
    medication.updateStatus();

    medication.updatedBy = req.user._id;
    await medication.save();

    res.json({
      success: true,
      data: medication
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(400).json({
      success: false,
      message: 'Error adjusting stock',
      error: error.message
    });
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
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const result = await prescription.reserveInventory(req.user._id);

    res.json({
      success: result.success,
      message: result.success ? 'Inventory reserved successfully' : 'Some medications could not be reserved',
      data: result.results
    });
  } catch (error) {
    console.error('Error reserving inventory:', error);
    res.status(400).json({
      success: false,
      message: 'Error reserving inventory',
      error: error.message
    });
  }
};

// Search medications for prescription (Drug + Inventory data)
exports.searchMedications = async (req, res) => {
  try {
    const { q, category, inStockOnly = false, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
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

    // For each drug, check inventory availability
    const results = await Promise.all(drugs.map(async (drug) => {
      const inventoryItem = await PharmacyInventory.findOne({ drug: drug._id }).lean();

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
    }));

    // Filter by stock if requested
    const filteredResults = inStockOnly
      ? results.filter(r => r.inStock)
      : results;

    res.json({
      success: true,
      data: filteredResults,
      total: filteredResults.length
    });
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching medications',
      error: error.message
    });
  }
};
