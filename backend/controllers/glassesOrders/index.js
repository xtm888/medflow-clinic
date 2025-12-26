/**
 * Glasses Orders Controllers Index
 *
 * Re-exports all glasses order controller functions for backward compatibility.
 * The original glassesOrderController.js (2,604 lines) has been split into:
 *
 * - coreController.js: Core CRUD, patient/exam queries, statistics, invoicing
 * - inventoryController.js: Stock checks, reservations, fulfillment, product search
 * - qcLabController.js: Status workflow, QC workflow, external lab integration
 */

const coreController = require('./coreController');
const inventoryController = require('./inventoryController');
const qcLabController = require('./qcLabController');

// Re-export all functions maintaining backward compatibility
module.exports = {
  // =====================================================
  // Core Controller Functions
  // =====================================================
  // CRUD Operations
  getOrders: coreController.getOrders,
  getOrder: coreController.getOrder,
  createOrder: coreController.createOrder,
  updateOrder: coreController.updateOrder,
  deleteOrder: coreController.deleteOrder,

  // Patient/Exam Queries
  getPatientOrders: coreController.getPatientOrders,
  getExamOrders: coreController.getExamOrders,

  // Statistics & Reporting
  getOrderStats: coreController.getOrderStats,

  // Invoicing
  generateInvoice: coreController.generateInvoice,
  getUnbilledOrders: coreController.getUnbilledOrders,

  // =====================================================
  // Inventory Controller Functions
  // =====================================================
  // Stock Management
  checkInventoryAvailability: inventoryController.checkInventoryAvailability,
  reserveInventory: inventoryController.reserveInventory,
  releaseInventory: inventoryController.releaseInventory,
  fulfillInventory: inventoryController.fulfillInventory,

  // Product Search
  searchFrames: inventoryController.searchFrames,
  searchContactLenses: inventoryController.searchContactLenses,
  getOrderWithInventory: inventoryController.getOrderWithInventory,

  // =====================================================
  // QC & Lab Controller Functions
  // =====================================================
  // Status Workflow
  updateStatus: qcLabController.updateStatus,

  // QC Workflow
  receiveFromLab: qcLabController.receiveFromLab,
  performQC: qcLabController.performQC,
  qcOverride: qcLabController.qcOverride,
  recordDelivery: qcLabController.recordDelivery,
  getPendingQC: qcLabController.getPendingQC,
  getReadyForPickup: qcLabController.getReadyForPickup,
  sendPickupReminder: qcLabController.sendPickupReminder,

  // External Lab Integration
  exportToLab: qcLabController.exportToLab,
  getExportData: qcLabController.getExportData,
  updateLabStatus: qcLabController.updateLabStatus,
  getPendingExport: qcLabController.getPendingExport,
  getAwaitingFromLab: qcLabController.getAwaitingFromLab
};
