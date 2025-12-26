#!/usr/bin/env node

/**
 * Migrate Legacy Inventory to Unified Inventory Model
 *
 * This script migrates data from 7 legacy inventory collections to the
 * unified Inventory model using Mongoose discriminators.
 *
 * Usage:
 *   DRY_RUN=true node scripts/migrateToUnifiedInventory.js   # Preview only
 *   node scripts/migrateToUnifiedInventory.js                 # Execute migration
 *
 * Features:
 * - Preserves all original data
 * - Maps legacy fields to new schema structure
 * - Creates backup before migration
 * - Supports rollback
 * - Reports detailed statistics
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('migrateToUnifiedInventory.js');

const { withTransaction, supportsTransactions } = require('../utils/migrationTransaction');

// Unified model - import the discriminators
const {
  Inventory,
  FrameInventory: UnifiedFrame,
  ContactLensInventory: UnifiedContactLens,
  OpticalLensInventory: UnifiedOpticalLens,
  PharmacyInventory: UnifiedPharmacy,
  ReagentInventory: UnifiedReagent,
  LabConsumableInventory: UnifiedLabConsumable,
  SurgicalSupplyInventory: UnifiedSurgical
} = require('../models/Inventory');

// Legacy collection names - access via raw MongoDB collections
// (Legacy model files have been removed in favor of unified Inventory model)
const LEGACY_COLLECTIONS = {
  frame: 'frameinventories',
  contact_lens: 'contactlensinventories',
  optical_lens: 'opticallensinventories',
  pharmacy: 'pharmacyinventories',
  reagent: 'reagentinventories',
  lab_consumable: 'labconsumableinventories',
  surgical_supply: 'surgicalsupplyinventories'
};

const DRY_RUN = process.env.DRY_RUN === 'true';

// Migration configuration for each inventory type
const MIGRATION_CONFIG = [
  {
    name: 'Frame Inventory',
    legacyCollection: LEGACY_COLLECTIONS.frame,
    unifiedModel: UnifiedFrame,
    inventoryType: 'frame',
    fieldMapper: (doc) => ({
      // Common fields
      sku: doc.sku || doc.modelNumber,
      barcode: doc.barcode,
      name: doc.model || doc.name || doc.brand || 'Frame',
      brand: doc.brand,
      manufacturer: doc.manufacturer,
      description: doc.description,
      clinic: doc.clinic,
      isDepot: doc.isDepot || false,
      category: doc.category,

      // Nested inventory structure (matches schema)
      inventory: {
        currentStock: doc.inventory?.currentStock || doc.quantity || 0,
        reserved: doc.inventory?.reserved || doc.reserved || 0,
        available: (doc.inventory?.currentStock || 0) - (doc.inventory?.reserved || 0),
        minimumStock: doc.inventory?.minimumStock || 0,
        reorderPoint: doc.inventory?.reorderPoint || doc.reorderPoint || 5,
        status: mapStatus(doc.inventory?.status || doc.status, doc.inventory?.currentStock || 0)
      },

      // Pricing
      pricing: {
        sellingPrice: doc.pricing?.sellingPrice || doc.unitPrice || 0,
        costPrice: doc.pricing?.costPrice || doc.costPrice || 0,
        margin: doc.pricing?.margin || doc.margin,
        currency: doc.pricing?.currency || doc.currency || 'XAF'
      },

      // Frame-specific data in typeData
      typeData: {
        modelNumber: doc.modelNumber,
        color: doc.color,
        size: doc.size,
        frameType: doc.frameType || doc.type,
        material: doc.material,
        gender: doc.gender,
        bridgeSize: doc.bridgeSize,
        templeLength: doc.templeLength,
        lensWidth: doc.lensWidth,
        lensHeight: doc.lensHeight,
        images: doc.images,
        tags: doc.tags
      },
      location: doc.location,

      // Metadata
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      active: true,
      _legacyId: doc._id
    })
  },
  {
    name: 'Contact Lens Inventory',
    legacyCollection: LEGACY_COLLECTIONS.contact_lens,
    unifiedModel: UnifiedContactLens,
    inventoryType: 'contact_lens',
    fieldMapper: (doc) => ({
      // Common fields
      sku: doc.sku || doc.productCode,
      barcode: doc.barcode,
      name: doc.productLine || doc.name || doc.brand || 'Contact Lens',
      brand: doc.brand,
      manufacturer: doc.manufacturer,
      description: doc.description,
      clinic: doc.clinic,
      isDepot: doc.isDepot || false,

      // Nested inventory structure
      inventory: {
        currentStock: doc.inventory?.currentStock || doc.quantity || 0,
        reserved: doc.inventory?.reserved || doc.reserved || 0,
        available: (doc.inventory?.currentStock || 0) - (doc.inventory?.reserved || 0),
        reorderPoint: doc.inventory?.reorderPoint || doc.reorderPoint || 5,
        status: mapStatus(doc.inventory?.status || doc.status, doc.inventory?.currentStock || 0)
      },

      // Pricing
      pricing: {
        sellingPrice: doc.pricing?.sellingPrice || doc.unitPrice || 0,
        costPrice: doc.pricing?.costPrice || doc.costPrice || 0,
        currency: 'XAF'
      },

      // Contact lens-specific data in typeData
      typeData: {
        lensType: doc.lensType || doc.type,
        wearDuration: doc.wearDuration || doc.replacementSchedule || doc.wearSchedule,
        baseCurve: doc.baseCurve || doc.bc || doc.parameters?.baseCurve,
        diameter: doc.diameter || doc.dia || doc.parameters?.diameter,
        sphere: doc.sphere,
        cylinder: doc.cylinder,
        axis: doc.axis,
        addition: doc.addition,
        color: doc.color,
        waterContent: doc.waterContent,
        oxygenPermeability: doc.oxygenPermeability || doc.dk,
        uvProtection: doc.uvProtection,
        isToric: doc.isToric || !!doc.cylinder,
        isMultifocal: doc.isMultifocal || !!doc.addition,
        isColored: doc.isColored || !!doc.color,
        isTrial: doc.isTrial || false,
        packSize: doc.packSize
      },
      location: doc.location,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      active: true,
      _legacyId: doc._id
    })
  },
  {
    name: 'Optical Lens Inventory',
    legacyCollection: LEGACY_COLLECTIONS.optical_lens,
    unifiedModel: UnifiedOpticalLens,
    inventoryType: 'optical_lens',
    fieldMapper: (doc) => ({
      // Common fields
      sku: doc.sku || doc.productCode,
      barcode: doc.barcode,
      name: doc.productLine || doc.name || doc.brand || 'Optical Lens',
      brand: doc.brand,
      manufacturer: doc.manufacturer,
      description: doc.description,
      clinic: doc.clinic,
      isDepot: doc.isDepot || false,

      // Nested inventory structure
      inventory: {
        currentStock: doc.inventory?.currentStock || doc.quantity || 0,
        reserved: doc.inventory?.reserved || doc.reserved || 0,
        available: (doc.inventory?.currentStock || 0) - (doc.inventory?.reserved || 0),
        reorderPoint: doc.inventory?.reorderPoint || doc.reorderPoint || 5,
        status: mapStatus(doc.inventory?.status || doc.status, doc.inventory?.currentStock || 0)
      },

      // Pricing
      pricing: {
        sellingPrice: doc.pricing?.sellingPrice || doc.unitPrice || 0,
        costPrice: doc.pricing?.costPrice || doc.costPrice || 0,
        currency: 'XAF'
      },

      // Optical lens-specific data in typeData
      typeData: {
        lensType: doc.lensType || doc.type,
        design: doc.design,
        progressiveType: doc.progressiveType,
        material: doc.material,
        refractiveIndex: doc.index || doc.refractiveIndex,
        coatings: doc.coatings || [],
        isPhotochromic: doc.isPhotochromic,
        isPolarized: doc.isPolarized,
        powerRange: doc.powerRange,
        diameter: doc.diameter,
        category: doc.category
      },
      location: doc.location,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      active: true,
      _legacyId: doc._id
    })
  },
  {
    name: 'Pharmacy Inventory',
    legacyCollection: LEGACY_COLLECTIONS.pharmacy,
    unifiedModel: UnifiedPharmacy,
    inventoryType: 'pharmacy',
    fieldMapper: (doc) => {
      // Generate SKU from medication info + doc id
      const medName = doc.medication?.genericName || doc.medication?.brandName || 'MED';
      const clinicSuffix = doc.clinic?.toString().slice(-4) || '0000';
      const docIdSuffix = doc._id?.toString().slice(-6) || '000000';
      const generatedSku = `PHARM-${medName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10)}-${clinicSuffix}-${docIdSuffix}`;

      return {
        // Common fields
        sku: doc.sku || generatedSku,
        barcode: doc.barcode,
        name: doc.medication?.genericName || doc.medication?.brandName || doc.medication?.nameFr || 'Medication',
        brand: doc.medication?.brandName || doc.brand,
        manufacturer: doc.manufacturer,
        description: doc.description,
        clinic: doc.clinic,
        isDepot: doc.isDepot || false,

        // Nested inventory structure
        inventory: {
          currentStock: doc.inventory?.currentStock || doc.quantity || 0,
          reserved: doc.inventory?.reserved || doc.reserved || 0,
          available: (doc.inventory?.currentStock || 0) - (doc.inventory?.reserved || 0),
          minimumStock: doc.inventory?.minimumStock || 10,
          reorderPoint: doc.inventory?.reorderPoint || 10,
          status: mapStatus(doc.inventory?.status || doc.status, doc.inventory?.currentStock || 0)
        },

        // Pricing
        pricing: {
          sellingPrice: doc.pricing?.sellingPrice || doc.unitPrice || 0,
          costPrice: doc.pricing?.costPrice || doc.costPrice || 0,
          currency: 'XAF'
        },

        // Pharmacy-specific data in typeData
        typeData: {
          drugId: doc.drug || doc.drugId,
          genericName: doc.medication?.genericName,
          brandName: doc.medication?.brandName,
          dosageForm: doc.medication?.formulation || doc.dosageForm,
          strength: doc.medication?.strength || doc.strength,
          route: doc.medication?.route,
          packSize: doc.packSize || doc.unitsPerPack,
          category: doc.category || doc.categoryFr,
          therapeuticClass: doc.therapeuticClass,
          requiresPrescription: doc.requiresPrescription !== false,
          controlled: doc.controlled || doc.isControlled || false,
          storageTemperature: doc.storage?.temperature || doc.storageConditions
        },
        location: doc.location,
        batches: doc.batches || [],

        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        active: true,
      _legacyId: doc._id
      };
    }
  },
  {
    name: 'Reagent Inventory',
    legacyCollection: LEGACY_COLLECTIONS.reagent,
    unifiedModel: UnifiedReagent,
    inventoryType: 'reagent',
    fieldMapper: (doc) => ({
      // Common fields
      sku: doc.sku || doc.catalogNumber,
      barcode: doc.barcode,
      name: doc.name || doc.reagentName,
      brand: doc.brand,
      manufacturer: doc.manufacturer,
      description: doc.description,
      clinic: doc.clinic,
      currentStock: doc.quantity || doc.currentStock || 0,
      reserved: doc.reserved || 0,
      available: (doc.quantity || doc.currentStock || 0) - (doc.reserved || 0),
      reorderPoint: doc.reorderPoint || 2,
      reorderQuantity: doc.reorderQuantity || 5,
      status: mapStatus(doc.status, doc.quantity || doc.currentStock),
      location: doc.location,

      // Pricing
      pricing: {
        unitPrice: doc.unitPrice || 0,
        costPrice: doc.costPrice || 0,
        currency: 'XAF'
      },

      // Reagent-specific fields
      reagentType: doc.reagentType || doc.type,
      testType: doc.testType,
      analyzerCompatibility: doc.analyzerCompatibility || doc.analyzer,
      testsPerKit: doc.testsPerKit,
      testsRemaining: doc.testsRemaining,
      storageTemp: doc.storageTemp || doc.storageConditions,
      expirationDate: doc.expirationDate,
      lotNumber: doc.lotNumber,
      openedDate: doc.openedDate,
      stabilityAfterOpening: doc.stabilityAfterOpening,

      // Calibration
      calibration: doc.calibration ? {
        lastCalibrated: doc.calibration.lastCalibrated || doc.lastCalibrated,
        nextCalibrationDue: doc.calibration.nextCalibrationDue,
        calibrationInterval: doc.calibration.calibrationInterval || doc.calibrationInterval
      } : undefined,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      active: true,
      _legacyId: doc._id
    })
  },
  {
    name: 'Lab Consumable Inventory',
    legacyCollection: LEGACY_COLLECTIONS.lab_consumable,
    unifiedModel: UnifiedLabConsumable,
    inventoryType: 'lab_consumable',
    fieldMapper: (doc) => ({
      // Common fields
      sku: doc.sku || doc.catalogNumber,
      barcode: doc.barcode,
      name: doc.name || doc.productName,
      brand: doc.brand,
      manufacturer: doc.manufacturer,
      description: doc.description,
      clinic: doc.clinic,
      currentStock: doc.quantity || doc.currentStock || 0,
      reserved: doc.reserved || 0,
      available: (doc.quantity || doc.currentStock || 0) - (doc.reserved || 0),
      reorderPoint: doc.reorderPoint || 10,
      reorderQuantity: doc.reorderQuantity || 50,
      status: mapStatus(doc.status, doc.quantity || doc.currentStock),
      location: doc.location,

      // Pricing
      pricing: {
        unitPrice: doc.unitPrice || 0,
        costPrice: doc.costPrice || 0,
        currency: 'XAF'
      },

      // Lab consumable-specific fields
      consumableType: doc.consumableType || doc.type,
      size: doc.size,
      material: doc.material,
      color: doc.color,
      sterile: doc.sterile || doc.isSterile || false,
      singleUse: doc.singleUse !== false,
      unitsPerPack: doc.unitsPerPack || 1,
      expirationDate: doc.expirationDate,
      lotNumber: doc.lotNumber,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      active: true,
      _legacyId: doc._id
    })
  },
  {
    name: 'Surgical Supply Inventory',
    legacyCollection: LEGACY_COLLECTIONS.surgical_supply,
    unifiedModel: UnifiedSurgical,
    inventoryType: 'surgical_supply',
    fieldMapper: (doc) => ({
      // Common fields
      sku: doc.sku || doc.catalogNumber,
      barcode: doc.barcode,
      name: doc.name || doc.productName,
      brand: doc.brand,
      manufacturer: doc.manufacturer,
      description: doc.description,
      clinic: doc.clinic,
      currentStock: doc.quantity || doc.currentStock || 0,
      reserved: doc.reserved || 0,
      available: (doc.quantity || doc.currentStock || 0) - (doc.reserved || 0),
      reorderPoint: doc.reorderPoint || 3,
      reorderQuantity: doc.reorderQuantity || 10,
      status: mapStatus(doc.status, doc.quantity || doc.currentStock),
      location: doc.location,

      // Pricing
      pricing: {
        unitPrice: doc.unitPrice || 0,
        costPrice: doc.costPrice || 0,
        currency: 'XAF'
      },

      // Surgical supply-specific fields
      supplyType: doc.supplyType || doc.type,
      size: doc.size,
      sterile: doc.sterile || doc.isSterile || true,
      singleUse: doc.singleUse !== false,
      expirationDate: doc.expirationDate,
      lotNumber: doc.lotNumber,
      serialNumber: doc.serialNumber,

      // IOL-specific fields
      iolDetails: doc.supplyType === 'iol' ? {
        diopter: doc.diopter || doc.power,
        model: doc.iolModel || doc.model,
        aconstant: doc.aconstant,
        opticSize: doc.opticSize,
        overallLength: doc.overallLength
      } : undefined,

      // Traceability
      traceability: doc.implantable ? {
        implantable: true,
        trackingRequired: true
      } : undefined,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      active: true,
      _legacyId: doc._id
    })
  }
];

// Map legacy status to unified status
function mapStatus(legacyStatus, quantity) {
  if (quantity <= 0) return 'out_of_stock';

  const statusMap = {
    'in-stock': 'in_stock',
    'in_stock': 'in_stock',
    'inStock': 'in_stock',
    'available': 'in_stock',
    'low-stock': 'low_stock',
    'low_stock': 'low_stock',
    'lowStock': 'low_stock',
    'out-of-stock': 'out_of_stock',
    'out_of_stock': 'out_of_stock',
    'outOfStock': 'out_of_stock',
    'on-order': 'on_order',
    'on_order': 'on_order',
    'onOrder': 'on_order',
    'ordered': 'on_order',
    'discontinued': 'discontinued',
    'expired': 'expired'
  };

  return statusMap[legacyStatus] || 'in_stock';
}

// Migration statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  errors: 0,
  byType: {}
};

// Migrate a single collection
async function migrateCollection(config, session = null) {
  const { name, legacyCollection, unifiedModel, fieldMapper, inventoryType } = config;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migrating: ${name}`);
  console.log(`${'='.repeat(60)}`);

  // Initialize stats for this type
  stats.byType[inventoryType] = { total: 0, migrated: 0, skipped: 0, errors: 0 };

  // Access raw MongoDB collection (legacy models have been removed)
  const collection = mongoose.connection.collection(legacyCollection);

  try {
    // Count legacy documents
    const count = await collection.countDocuments();
    console.log(`Found ${count} documents in legacy collection (${legacyCollection})`);
    stats.byType[inventoryType].total = count;
    stats.total += count;

    if (count === 0) {
      console.log('No documents to migrate');
      return;
    }

    // Check for existing unified documents
    const existingCount = await Inventory.countDocuments({ inventoryType });
    if (existingCount > 0) {
      console.log(`Warning: ${existingCount} documents already exist in unified collection`);
      if (DRY_RUN) {
        console.log('(DRY RUN - would check for duplicates)');
      }
    }

    // Stream legacy documents in batches
    const batchSize = 100;
    let processed = 0;

    const cursor = collection.find();

    let batch = [];

    for await (const doc of cursor) {
      try {
        // Map fields
        const mappedData = fieldMapper(doc);

        // Skip if already migrated (check by legacyId)
        if (!DRY_RUN) {
          const existing = await Inventory.findOne({
            active: true,
      _legacyId: doc._id,
            inventoryType
          });
          if (existing) {
            stats.byType[inventoryType].skipped++;
            stats.skipped++;
            continue;
          }
        }

        batch.push(mappedData);

        if (batch.length >= batchSize) {
          if (!DRY_RUN) {
            try {
              // Use native MongoDB insertMany to avoid Mongoose discriminator issues with bulkWrite
              const docsToInsert = batch.map(doc => ({ ...doc, inventoryType }));
              const insertOptions = { ordered: false };
              if (session) insertOptions.session = session;
              const result = await mongoose.connection.db.collection('inventories').insertMany(docsToInsert, insertOptions);
              const insertedCount = result.insertedCount || 0;
              stats.byType[inventoryType].migrated += insertedCount;
              stats.migrated += insertedCount;
              if (insertedCount < batch.length) {
                const errorCount = batch.length - insertedCount;
                stats.byType[inventoryType].errors += errorCount;
                stats.errors += errorCount;
                console.error(`\nBatch: ${insertedCount}/${batch.length} succeeded`);
              }
            } catch (bulkError) {
              console.error(`\nBatch insert failed:`, bulkError.message);
              // Check if any were inserted despite error
              const insertedCount = bulkError.result?.insertedCount || 0;
              stats.byType[inventoryType].migrated += insertedCount;
              stats.migrated += insertedCount;
              stats.byType[inventoryType].errors += (batch.length - insertedCount);
              stats.errors += (batch.length - insertedCount);
            }
          } else {
            stats.byType[inventoryType].migrated += batch.length;
            stats.migrated += batch.length;
          }
          processed += batch.length;
          process.stdout.write(`\rProcessed: ${processed}/${count}`);
          batch = [];
        }
      } catch (docError) {
        console.error(`\nError processing document ${doc._id}:`, docError.message);
        stats.byType[inventoryType].errors++;
        stats.errors++;
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      if (!DRY_RUN) {
        try {
          // Use native MongoDB insertMany with optional session
          const docsToInsert = batch.map(doc => ({ ...doc, inventoryType }));
          const insertOptions = { ordered: false };
          if (session) insertOptions.session = session;
          const result = await mongoose.connection.db.collection('inventories').insertMany(docsToInsert, insertOptions);
          const insertedCount = result.insertedCount || 0;
          stats.byType[inventoryType].migrated += insertedCount;
          stats.migrated += insertedCount;
          if (insertedCount < batch.length) {
            const errorCount = batch.length - insertedCount;
            stats.byType[inventoryType].errors += errorCount;
            stats.errors += errorCount;
            console.error(`\nFinal batch: ${insertedCount}/${batch.length} succeeded`);
          }
        } catch (bulkError) {
          console.error(`\nFinal batch insert failed:`, bulkError.message);
          const insertedCount = bulkError.result?.insertedCount || 0;
          stats.byType[inventoryType].migrated += insertedCount;
          stats.migrated += insertedCount;
          stats.byType[inventoryType].errors += (batch.length - insertedCount);
          stats.errors += (batch.length - insertedCount);
        }
      } else {
        stats.byType[inventoryType].migrated += batch.length;
        stats.migrated += batch.length;
      }
      processed += batch.length;
    }

    console.log(`\nCompleted: ${stats.byType[inventoryType].migrated} migrated, ${stats.byType[inventoryType].skipped} skipped, ${stats.byType[inventoryType].errors} errors`);

  } catch (error) {
    console.error(`Error migrating ${name}:`, error.message);
    stats.byType[inventoryType].errors++;
    stats.errors++;
  }
}

// Main migration function
async function runMigration() {
  console.log('\n' + '='.repeat(60));
  console.log('UNIFIED INVENTORY MIGRATION');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');

    // Check transaction support
    const hasTransactions = await supportsTransactions();
    console.log(`Transaction support: ${hasTransactions ? '✅ Available (replica set)' : '⚠️ Not available (standalone)'}`);

    // Run migrations for each type (with transaction wrapper if available)
    await withTransaction(async (session) => {
      for (const config of MIGRATION_CONFIG) {
        await migrateCollection(config, session);
      }
    }, { operationName: 'Unified Inventory Migration', requireTransaction: false });

    // Legacy: Run migrations for each type
    // for (const config of MIGRATION_CONFIG) {
    //   await migrateCollection(config);
    // }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total documents: ${stats.total}`);
    console.log(`Migrated: ${stats.migrated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\nBy Type:');
    for (const [type, typeStats] of Object.entries(stats.byType)) {
      console.log(`  ${type}: ${typeStats.migrated}/${typeStats.total} migrated, ${typeStats.skipped} skipped, ${typeStats.errors} errors`);
    }

    if (DRY_RUN) {
      console.log('\n*** DRY RUN COMPLETE - No changes were made ***');
      console.log('Run without DRY_RUN=true to execute migration');
    } else {
      console.log('\n*** MIGRATION COMPLETE ***');

      // Verify counts
      console.log('\nVerifying migration...');
      const totalUnified = await Inventory.countDocuments();
      console.log(`Total documents in unified collection: ${totalUnified}`);
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run migration
runMigration().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
