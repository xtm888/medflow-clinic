/**
 * BillingService - Domain Service for Payment Orchestration
 *
 * Centralizes billing logic that spans multiple models:
 * - Payment recording and validation
 * - SurgeryCase cascade creation (at 100% item payment)
 * - Optical/GlassesOrder dispatch
 * - Cross-service payment status synchronization
 * - WebSocket notifications
 *
 * This service extracts orchestration logic from invoiceController
 * to improve testability and separation of concerns.
 */

const mongoose = require('mongoose');
const Invoice = require('../../models/Invoice');
const GlassesOrder = require('../../models/GlassesOrder');
const Prescription = require('../../models/Prescription');
const LabOrder = require('../../models/LabOrder');
const SurgeryService = require('./SurgeryService');
const websocketService = require('../websocketService');
const notificationService = require('../notificationService');
const { invoice: invoiceLogger } = require('../../utils/structuredLogger');

class BillingService {
  /**
   * Process a payment on an invoice
   * Orchestrates all side effects: surgery cases, service sync, notifications
   *
   * @param {string} invoiceId - Invoice ID
   * @param {Object} paymentData - Payment details
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.method - Payment method
   * @param {string} [paymentData.reference] - Payment reference
   * @param {string} [paymentData.notes] - Payment notes
   * @param {Date} [paymentData.date] - Payment date
   * @param {string} [paymentData.currency] - Currency code
   * @param {number} [paymentData.exchangeRate] - Exchange rate to CDF
   * @param {Array} [paymentData.itemAllocations] - Item-level allocations
   * @param {string} userId - User making the payment
   * @returns {Object} { invoice, payment, surgeryCases, syncResults }
   */
  async processPayment(invoiceId, paymentData, userId) {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const { amount, method, reference, notes, date, currency, exchangeRate, itemAllocations } = paymentData;

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    // Multi-currency validation
    const paymentCurrency = currency || 'CDF';
    const rate = exchangeRate || 1;
    const amountInCDF = paymentCurrency === 'CDF' ? amount : amount * rate;

    if (amountInCDF > invoice.summary.amountDue) {
      throw new Error(
        `Payment amount (${amountInCDF.toFixed(0)} CDF) exceeds amount due (${invoice.summary.amountDue} CDF)`
      );
    }

    // 1. Record the payment using Invoice model method
    const paymentResult = await invoice.addPayment(
      {
        amount,
        method,
        reference,
        notes,
        date,
        currency: paymentCurrency,
        exchangeRate: rate,
        itemAllocations
      },
      userId
    );

    // 2. Create surgery cases for newly paid surgery items (at 100% item payment)
    const surgeryCases = await SurgeryService.createCasesForPaidItems(
      invoice,
      paymentResult.newlyPaidItems || [],
      userId
    );

    // Also check if invoice is fully paid for any remaining surgery items
    if (invoice.status === 'paid') {
      const remainingCases = await SurgeryService.createCasesIfNeeded(invoice, userId);
      surgeryCases.push(...remainingCases);
    }

    // 3. Sync payment status to related services
    const syncResults = await this.syncPaymentToServices(invoice);

    // 4. Dispatch optical items if fully paid
    if (invoice.status === 'paid') {
      await this.dispatchOpticalIfNeeded(invoice, userId);
    }

    // 5. Send WebSocket notification
    this.notifyPaymentReceived(invoice, paymentResult.payment);

    // 6. Create internal notification for cashier/admin
    await this.createPaymentNotification(invoice, paymentResult.payment, userId);

    invoiceLogger.info('Payment processed via BillingService', {
      invoiceId: invoice.invoiceId,
      amount: paymentResult.payment?.amount,
      method,
      newStatus: invoice.status,
      surgeryCasesCreated: surgeryCases.length,
      servicesUpdated: Object.values(syncResults).flat().length
    });

    return {
      invoice,
      payment: paymentResult.payment,
      surgeryCases: surgeryCases.length > 0 ? surgeryCases : undefined,
      syncResults
    };
  }

  /**
   * Sync payment status to related services (GlassesOrders, Prescriptions, LabOrders)
   * Uses bulk operations for performance
   *
   * @param {Object} invoice - Invoice document
   * @returns {Object} Sync results per service type
   */
  async syncPaymentToServices(invoice) {
    const results = {
      glassesOrders: [],
      prescriptions: [],
      labOrders: []
    };

    try {
      const newPaymentStatus = invoice.status === 'paid' ? 'paid' : 'partial';

      // Bulk update GlassesOrders linked directly to invoice
      const linkedOrders = await GlassesOrder.find({ invoice: invoice._id });
      if (linkedOrders.length > 0) {
        await GlassesOrder.updateMany(
          { invoice: invoice._id },
          {
            $set: {
              paymentStatus: newPaymentStatus,
              amountPaid: invoice.summary.amountPaid
            }
          }
        );
        linkedOrders.forEach(order => {
          results.glassesOrders.push({
            id: order._id,
            orderNumber: order.orderNumber,
            status: newPaymentStatus
          });
        });
      }

      // Process item references for additional linked entities
      if (invoice.items?.length > 0) {
        const { glassesOrderNumbers, prescriptionIds, labOrderIds } = this.extractItemReferences(invoice.items);

        // Update GlassesOrders by reference (exclude already updated)
        if (glassesOrderNumbers.length > 0) {
          const existingNumbers = results.glassesOrders.map(o => o.orderNumber);
          const newNumbers = glassesOrderNumbers.filter(n => !existingNumbers.includes(n));
          if (newNumbers.length > 0) {
            await GlassesOrder.updateMany(
              { orderNumber: { $in: newNumbers } },
              { $set: { paymentStatus: newPaymentStatus } }
            );
            newNumbers.forEach(orderNumber => {
              results.glassesOrders.push({ orderNumber, status: newPaymentStatus });
            });
          }
        }

        // Update Prescriptions
        if (prescriptionIds.length > 0) {
          await Prescription.updateMany(
            { _id: { $in: prescriptionIds } },
            {
              $set: {
                'dispensing.paymentStatus': newPaymentStatus,
                'dispensing.paidAt': new Date()
              }
            }
          );
          prescriptionIds.forEach(id => {
            results.prescriptions.push({ id, status: newPaymentStatus });
          });
        }

        // Update LabOrders
        if (labOrderIds.length > 0) {
          await LabOrder.updateMany(
            { _id: { $in: labOrderIds } },
            {
              $set: {
                'billing.paymentStatus': newPaymentStatus,
                'billing.paidAt': invoice.status === 'paid' ? new Date() : null
              }
            }
          );
          const labOrders = await LabOrder.find({ _id: { $in: labOrderIds } }).select('orderId');
          labOrders.forEach(lo => {
            results.labOrders.push({ id: lo._id, orderId: lo.orderId, status: newPaymentStatus });
          });
        }
      }

      invoiceLogger.info('Payment synced to services', results);
    } catch (syncError) {
      invoiceLogger.error('Error syncing payment to services (non-blocking)', {
        error: syncError.message,
        invoiceId: invoice._id
      });
    }

    return results;
  }

  /**
   * Extract service references from invoice items
   * @private
   */
  extractItemReferences(items) {
    const glassesOrderNumbers = [];
    const prescriptionIds = [];
    const labOrderIds = [];

    for (const item of items) {
      if (item.reference) {
        if (item.reference.startsWith('GlassesOrder:')) {
          glassesOrderNumbers.push(item.reference.split(':')[1]);
        } else if (item.reference.startsWith('Prescription:')) {
          prescriptionIds.push(item.reference.split(':')[1]);
        } else if (item.reference.startsWith('LabOrder:')) {
          labOrderIds.push(item.reference.split(':')[1]);
        }
      }
    }

    return { glassesOrderNumbers, prescriptionIds, labOrderIds };
  }

  /**
   * Dispatch optical items to external facilities if invoice is fully paid
   *
   * @param {Object} invoice - Invoice document
   * @param {string} userId - User ID
   */
  async dispatchOpticalIfNeeded(invoice, userId) {
    try {
      // Find optical items marked for external facility
      const opticalItems = invoice.items.filter(
        item => item.category === 'optical' && item.externalFacility && !item.dispatched
      );

      if (opticalItems.length === 0) return;

      // Find or update linked glasses orders
      for (const item of opticalItems) {
        if (item.reference?.startsWith('GlassesOrder:')) {
          const orderNumber = item.reference.split(':')[1];
          await GlassesOrder.updateOne(
            { orderNumber },
            {
              $set: {
                status: 'dispatched',
                dispatchedAt: new Date(),
                dispatchedBy: userId
              }
            }
          );

          // Mark item as dispatched
          item.dispatched = true;
          item.dispatchedAt = new Date();
        }
      }

      if (opticalItems.some(i => i.dispatched)) {
        await invoice.save();
        invoiceLogger.info('Optical items dispatched after full payment', {
          invoiceId: invoice.invoiceId,
          dispatchedCount: opticalItems.filter(i => i.dispatched).length
        });
      }
    } catch (err) {
      invoiceLogger.error('Error dispatching optical items (non-blocking)', {
        error: err.message,
        invoiceId: invoice._id
      });
    }
  }

  /**
   * Send WebSocket notification for payment received
   * @private
   */
  notifyPaymentReceived(invoice, payment) {
    try {
      websocketService.emitBillingUpdate({
        event: 'payment_received',
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
        patientId: invoice.patient,
        amount: payment?.amount,
        newStatus: invoice.status,
        amountPaid: invoice.summary?.amountPaid,
        amountDue: invoice.summary?.amountDue
      });
    } catch (err) {
      invoiceLogger.error('WebSocket notification failed (non-blocking)', { error: err.message });
    }
  }

  /**
   * Create internal notification for payment
   * @private
   */
  async createPaymentNotification(invoice, payment, userId) {
    try {
      if (!notificationService?.createNotification) return;

      const statusText = invoice.status === 'paid' ? 'entièrement payée' : 'partiellement payée';

      await notificationService.createNotification({
        type: 'billing',
        title: 'Paiement reçu',
        message: `Facture ${invoice.invoiceId} ${statusText}. Montant: ${payment?.amount?.toLocaleString()} ${payment?.currency || 'CDF'}`,
        priority: 'medium',
        relatedTo: {
          model: 'Invoice',
          id: invoice._id
        },
        clinic: invoice.clinic,
        createdBy: userId
      });
    } catch (err) {
      // Non-blocking notification error
    }
  }

  /**
   * Process a refund on an invoice
   *
   * @param {string} invoiceId - Invoice ID
   * @param {Object} refundData - Refund details
   * @param {string} userId - User processing the refund
   * @returns {Object} Updated invoice with refund
   */
  async processRefund(invoiceId, refundData, userId) {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const { paymentId, amount, reason } = refundData;

    if (!paymentId) {
      throw new Error('Payment ID is required for refund');
    }

    // Find the payment to refund
    const payment = invoice.payments?.id(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      throw new Error(`Refund amount (${refundAmount}) exceeds payment amount (${payment.amount})`);
    }

    // Add refund to invoice
    if (!invoice.refunds) {
      invoice.refunds = [];
    }

    invoice.refunds.push({
      originalPayment: paymentId,
      amount: refundAmount,
      reason: reason || 'Remboursement',
      processedBy: userId,
      processedAt: new Date()
    });

    // Update summary
    invoice.summary.amountPaid -= refundAmount;
    invoice.summary.amountDue += refundAmount;
    invoice.summary.refundTotal = (invoice.summary.refundTotal || 0) + refundAmount;

    // Update status
    if (invoice.summary.amountPaid <= 0) {
      invoice.status = 'refunded';
    } else if (invoice.summary.amountDue > 0) {
      invoice.status = 'partial';
    }

    await invoice.save();

    // Reverse CompanyUsage if convention invoice is refunded
    if (invoice.isConventionInvoice && invoice.status === 'refunded') {
      try {
        const CompanyUsage = require('../../models/CompanyUsage');
        await CompanyUsage.reverseInvoiceUsage(invoice, userId, reason || 'Remboursement');
      } catch (err) {
        invoiceLogger.error('Failed to reverse CompanyUsage on refund', { error: err.message });
      }
    }

    // Send WebSocket notification
    websocketService.emitBillingUpdate({
      event: 'refund_processed',
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
      patientId: invoice.patient,
      refundAmount,
      newStatus: invoice.status
    });

    invoiceLogger.info('Refund processed via BillingService', {
      invoiceId: invoice.invoiceId,
      refundAmount,
      reason,
      newStatus: invoice.status
    });

    return invoice;
  }

  /**
   * Cancel an invoice and reverse all related effects
   *
   * @param {string} invoiceId - Invoice ID
   * @param {string} reason - Cancellation reason
   * @param {string} userId - User cancelling the invoice
   * @returns {Object} Cancelled invoice
   */
  async cancelInvoice(invoiceId, reason, userId) {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'cancelled' || invoice.status === 'voided') {
      throw new Error('Invoice is already cancelled');
    }

    // Check if payments exist
    if (invoice.payments?.length > 0 && invoice.summary.amountPaid > 0) {
      throw new Error('Cannot cancel invoice with payments. Process refunds first.');
    }

    // Update status
    invoice.status = 'cancelled';
    invoice.cancellation = {
      cancelledBy: userId,
      cancelledAt: new Date(),
      reason
    };

    await invoice.save();

    // Reverse CompanyUsage for convention invoices
    if (invoice.isConventionInvoice) {
      try {
        const CompanyUsage = require('../../models/CompanyUsage');
        await CompanyUsage.reverseInvoiceUsage(invoice, userId, reason);
      } catch (err) {
        invoiceLogger.error('Failed to reverse CompanyUsage on cancel', { error: err.message });
      }
    }

    // Update related entities
    await this.reverseRelatedEntities(invoice);

    // Send WebSocket notification
    websocketService.emitBillingUpdate({
      event: 'invoice_cancelled',
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
      patientId: invoice.patient,
      reason
    });

    invoiceLogger.info('Invoice cancelled via BillingService', {
      invoiceId: invoice.invoiceId,
      reason
    });

    return invoice;
  }

  /**
   * Reverse related entity statuses when invoice is cancelled
   * @private
   */
  async reverseRelatedEntities(invoice) {
    try {
      // Cancel linked surgery cases
      const SurgeryCase = require('../../models/SurgeryCase');
      await SurgeryCase.updateMany(
        { invoice: invoice._id },
        {
          $set: { status: 'cancelled' },
          $push: {
            statusHistory: {
              status: 'cancelled',
              changedAt: new Date(),
              notes: `Facture ${invoice.invoiceId} annulée`
            }
          }
        }
      );

      // Reset GlassesOrder payment status
      await GlassesOrder.updateMany(
        { invoice: invoice._id },
        { $set: { paymentStatus: 'pending' } }
      );

      // Reset prescription dispensing status
      const { prescriptionIds } = this.extractItemReferences(invoice.items || []);
      if (prescriptionIds.length > 0) {
        await Prescription.updateMany(
          { _id: { $in: prescriptionIds } },
          {
            $set: {
              'dispensing.paymentStatus': 'pending',
              'dispensing.paidAt': null
            }
          }
        );
      }

      // Reset lab order billing status
      const { labOrderIds } = this.extractItemReferences(invoice.items || []);
      if (labOrderIds.length > 0) {
        await LabOrder.updateMany(
          { _id: { $in: labOrderIds } },
          {
            $set: {
              'billing.paymentStatus': 'pending',
              'billing.paidAt': null
            }
          }
        );
      }
    } catch (err) {
      invoiceLogger.error('Error reversing related entities (non-blocking)', { error: err.message });
    }
  }

  /**
   * Finalize a draft invoice (e.g., pharmacy draft)
   *
   * @param {string} invoiceId - Invoice ID
   * @param {string} userId - User finalizing
   * @param {Object} [options] - Options
   * @param {boolean} [options.sendNotification] - Whether to send notification
   * @returns {Object} Finalized invoice
   */
  async finalizeInvoice(invoiceId, userId, options = {}) {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'draft') {
      throw new Error(`Cannot finalize invoice with status: ${invoice.status}`);
    }

    // Update to issued status
    invoice.status = 'issued';
    invoice.requiresReview = false;
    invoice.reviewedBy = userId;
    invoice.reviewedAt = new Date();
    invoice.dateIssued = invoice.dateIssued || new Date();

    await invoice.save();

    // Record CompanyUsage for convention invoices
    if (invoice.isConventionInvoice) {
      try {
        const CompanyUsage = require('../../models/CompanyUsage');
        await CompanyUsage.recordInvoiceUsage(invoice);
      } catch (err) {
        invoiceLogger.error('Failed to record CompanyUsage on finalize', { error: err.message });
      }
    }

    if (options.sendNotification !== false) {
      websocketService.emitBillingUpdate({
        event: 'invoice_finalized',
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
        patientId: invoice.patient,
        source: invoice.source
      });
    }

    invoiceLogger.info('Invoice finalized via BillingService', {
      invoiceId: invoice.invoiceId,
      source: invoice.source,
      reviewedBy: userId
    });

    return invoice;
  }

  /**
   * Get pending pharmacy invoices for review
   *
   * @param {string} clinicId - Clinic ID
   * @param {Object} [pagination] - Pagination options
   * @returns {Object} { invoices, total, pagination }
   */
  async getPendingPharmacyInvoices(clinicId, pagination = { page: 1, limit: 20 }) {
    const query = {
      source: 'pharmacy',
      status: 'draft',
      requiresReview: true
    };

    if (clinicId) {
      query.clinic = clinicId;
    }

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('patient', 'firstName lastName patientId')
        .populate('clinic', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query)
    ]);

    return {
      invoices,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

// Export singleton instance
module.exports = new BillingService();
