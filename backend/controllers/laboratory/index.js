/**
 * Laboratory Controllers Index
 *
 * Re-exports all laboratory-related controller functions from their domain-specific modules.
 * This provides backward compatibility with routes that import from '../controllers/laboratoryController'.
 *
 * Modules:
 * - orders: Lab order CRUD, check-in workflow, rejection handling
 * - specimens: Specimen tracking, tube management, collection
 * - results: Result entry, validation, trends, critical values
 * - templates: Laboratory test template CRUD
 * - reports: PDF generation, worklist management
 * - statistics: Statistics, turnaround times, QC data
 * - billing: Lab invoicing, unbilled tests
 * - analyzers: Analyzer/instrument management
 */

const orders = require('./orders');
const specimens = require('./specimens');
const results = require('./results');
const templates = require('./templates');
const reports = require('./reports');
const statistics = require('./statistics');
const billing = require('./billing');
const analyzers = require('./analyzers');

// Re-export all functions for backward compatibility
module.exports = {
  // Orders & Check-in
  ...orders,

  // Specimens & Tubes
  ...specimens,

  // Results & Validation
  ...results,

  // Templates
  ...templates,

  // Reports & Worklist
  ...reports,

  // Statistics & QC
  ...statistics,

  // Billing
  ...billing,

  // Analyzers
  ...analyzers,

  // Also export grouped modules for more organized access
  orders,
  specimens,
  results,
  templates,
  reports,
  statistics,
  billing,
  analyzers
};
