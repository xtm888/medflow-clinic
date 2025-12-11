/**
 * Billing Controllers Index
 *
 * Re-exports all billing-related controller functions from their domain-specific modules.
 * This provides backward compatibility with routes that import from '../controllers/billingController'.
 *
 * Modules:
 * - statistics: Billing reports, aging, revenue, optical analytics
 * - feeSchedule: Fee schedules, tax configuration, billing codes
 * - claims: Insurance claims workflow
 * - paymentPlans: Payment plan management
 * - documents: PDF generation (invoices, receipts, statements)
 * - payments: Core payments, refunds, gateway, multi-currency, credits
 * - cashDrawer: Cash drawer operations
 * - conventions: Convention/company billing
 */

const statistics = require('./statistics');
const feeSchedule = require('./feeSchedule');
const claims = require('./claims');
const paymentPlans = require('./paymentPlans');
const documents = require('./documents');
const payments = require('./payments');
const cashDrawer = require('./cashDrawer');
const conventions = require('./conventions');

// Re-export all functions for backward compatibility
module.exports = {
  // Statistics & Reports
  ...statistics,

  // Fee Schedule & Tax
  ...feeSchedule,

  // Insurance Claims
  ...claims,

  // Payment Plans
  ...paymentPlans,

  // Document Generation
  ...documents,

  // Payments (core, gateway, currency, credits, processing fees)
  ...payments,

  // Cash Drawer
  ...cashDrawer,

  // Convention/Company Billing
  ...conventions,

  // Also export grouped modules for more organized access
  statistics,
  feeSchedule,
  claims,
  paymentPlans,
  documents,
  payments,
  cashDrawer,
  conventions
};
