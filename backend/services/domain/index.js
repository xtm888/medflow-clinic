/**
 * Domain Services
 *
 * These services encapsulate complex business logic that spans multiple models.
 * They are orchestration layers that coordinate between entities.
 *
 * Usage:
 *   const { BillingService, SurgeryService } = require('../services/domain');
 *   await BillingService.processPayment(invoiceId, paymentData, userId);
 */

const BillingService = require('./BillingService');
const SurgeryService = require('./SurgeryService');

module.exports = {
  BillingService,
  SurgeryService
};
