/**
 * Inventory Controllers Index
 *
 * Central export for all inventory controllers built with InventoryControllerFactory.
 * Each controller extends the base factory with type-specific operations.
 *
 * Pattern:
 * - Factory provides: CRUD, stock ops, alerts, stats, search, transactions
 * - Extensions add: Type-specific workflows (reservations, consumption, QC, etc.)
 *
 * Usage:
 *   const { frameInventory, surgicalSupply } = require('./controllers/inventory');
 *   router.get('/frames', frameInventory.getFrames);
 *   router.post('/frames/:id/reserve', frameInventory.reserveForOrder);
 */

// Base factory class
const InventoryControllerFactory = require('./InventoryControllerFactory');

// Type-specific controller extensions
const frameInventory = require('./frameInventory');
const contactLensInventory = require('./contactLensInventory');
const opticalLensInventory = require('./opticalLensInventory');
const reagentInventory = require('./reagentInventory');
const labConsumableInventory = require('./labConsumableInventory');
const surgicalSupplyInventory = require('./surgicalSupplyInventory');

module.exports = {
  // Factory class for creating custom inventory controllers
  InventoryControllerFactory,

  // Pre-configured controllers
  frameInventory,
  contactLensInventory,
  opticalLensInventory,
  reagentInventory,
  labConsumableInventory,
  surgicalSupplyInventory
};
