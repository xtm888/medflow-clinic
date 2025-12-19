/**
 * Payment Plan Auto-Charge Service
 * Automatically processes scheduled payments for payment plans with auto-pay enabled
 */

const PaymentPlan = require('../models/PaymentPlan');
const Patient = require('../models/Patient');
const paymentGateway = require('./paymentGateway');
const crypto = require('crypto');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('PaymentPlanAutoCharge');

class PaymentPlanAutoChargeService {
  constructor() {
    this.schedulerInterval = null;
    this.notificationInterval = null;
    this.isRunning = false;
  }

  /**
   * Start the auto-charge scheduler
   * Runs every hour to check for due payments
   */
  startScheduler() {
    if (this.schedulerInterval) {
      log.info('Auto-charge scheduler already running');
      return;
    }

    log.info('Starting payment plan auto-charge scheduler...');

    // Run immediately on start
    this.processAutoCharges();

    // Then run every hour
    this.schedulerInterval = setInterval(() => {
      this.processAutoCharges();
    }, 60 * 60 * 1000); // Every hour

    // Notification scheduler - runs daily at 8 AM
    this.scheduleNotifications();
  }

  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      log.info('Auto-charge scheduler stopped');
    }
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = null;
    }
  }

  /**
   * Process all due auto-charges
   */
  async processAutoCharges() {
    if (this.isRunning) {
      log.info('Auto-charge process already running, skipping...');
      return;
    }

    this.isRunning = true;
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      log.info(`[${new Date().toISOString()}] Processing payment plan auto-charges...`);

      // Find all active payment plans with auto-payment enabled
      const plans = await PaymentPlan.find({
        status: 'active',
        'autoPayment.enabled': true,
        'autoPayment.paymentMethodId': { $exists: true, $ne: null }
      }).populate('patient', 'firstName lastName email phone storedPaymentMethods');

      const now = new Date();

      for (const plan of plans) {
        try {
          // Find installments due today or overdue that haven't been paid
          const dueInstallments = plan.installments.filter(inst => {
            const dueDate = new Date(inst.dueDate);
            return (
              (inst.status === 'pending' || inst.status === 'overdue') &&
              dueDate <= now &&
              inst.paidAmount < inst.amount
            );
          });

          for (const installment of dueInstallments) {
            results.processed++;

            // Check if we've already attempted today
            if (installment.lastAutoChargeAttempt) {
              const lastAttempt = new Date(installment.lastAutoChargeAttempt);
              const hoursSinceAttempt = (now - lastAttempt) / (1000 * 60 * 60);
              if (hoursSinceAttempt < 24) {
                results.skipped++;
                continue;
              }
            }

            // Get stored payment method
            const paymentMethod = await this.getStoredPaymentMethod(
              plan.patient._id,
              plan.autoPayment.paymentMethodId
            );

            if (!paymentMethod) {
              results.failed++;
              results.errors.push({
                planId: plan.planId,
                installmentNumber: installment.number,
                error: 'Payment method not found'
              });
              continue;
            }

            // Calculate amount to charge
            const amountDue = installment.amount - (installment.paidAmount || 0);

            // Attempt the charge
            const chargeResult = await this.chargePaymentMethod(
              paymentMethod,
              amountDue,
              plan,
              installment
            );

            if (chargeResult.success) {
              // Record the payment
              await plan.recordPayment(
                installment.number,
                amountDue,
                chargeResult.transactionId,
                null // System auto-charge
              );

              // Log success
              await this.logAutoChargeResult(plan, installment, 'success', chargeResult);
              results.successful++;
            } else {
              // Log failure
              await this.logAutoChargeResult(plan, installment, 'failed', chargeResult);

              // Mark the attempt
              installment.lastAutoChargeAttempt = now;
              installment.autoChargeFailures = (installment.autoChargeFailures || 0) + 1;

              // Disable auto-pay after 3 failures
              if (installment.autoChargeFailures >= 3) {
                plan.autoPayment.enabled = false;
                plan.autoPayment.disabledReason = `Auto-charge disabled after 3 failures: ${chargeResult.error}`;
                plan.autoPayment.disabledAt = now;
              }

              await plan.save();

              results.failed++;
              results.errors.push({
                planId: plan.planId,
                installmentNumber: installment.number,
                error: chargeResult.error
              });
            }
          }
        } catch (planError) {
          log.error(`Error processing plan ${plan.planId}:`, { error: planError });
          results.errors.push({
            planId: plan.planId,
            error: planError.message
          });
        }
      }

      log.info(`Auto-charge complete: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`);
    } catch (error) {
      log.error('Auto-charge scheduler error:', { error: error });
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Get stored payment method for a patient
   */
  async getStoredPaymentMethod(patientId, paymentMethodId) {
    const patient = await Patient.findById(patientId);
    if (!patient || !patient.storedPaymentMethods) {
      return null;
    }

    return patient.storedPaymentMethods.find(
      pm => pm._id.toString() === paymentMethodId || pm.id === paymentMethodId
    );
  }

  /**
   * Charge a stored payment method
   */
  async chargePaymentMethod(paymentMethod, amount, plan, installment) {
    const paymentData = {
      amount,
      currency: 'CDF',
      patientId: plan.patient._id.toString(),
      invoiceId: plan.invoices[0]?.toString(),
      description: `Payment Plan ${plan.planId} - Installment ${installment.number}`,
      metadata: {
        paymentPlanId: plan._id.toString(),
        installmentNumber: installment.number,
        autoCharge: true
      }
    };

    switch (paymentMethod.type) {
      case 'card':
      case 'stripe':
        paymentData.method = 'card';
        paymentData.paymentMethodId = paymentMethod.stripePaymentMethodId;
        paymentData.customerId = paymentMethod.stripeCustomerId;
        break;
      case 'mobile-money':
      case 'orange-money':
      case 'mtn-money':
        paymentData.method = paymentMethod.type;
        paymentData.phoneNumber = paymentMethod.phoneNumber;
        break;
      default:
        return {
          success: false,
          error: `Unsupported payment method type: ${paymentMethod.type}`
        };
    }

    try {
      const result = await paymentGateway.processPayment(paymentData);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log auto-charge result for audit trail
   */
  async logAutoChargeResult(plan, installment, status, result) {
    const AutoChargeLog = require('../models/AuditLog');

    try {
      await AutoChargeLog.create({
        action: 'AUTO_CHARGE',
        resourceType: 'PaymentPlan',
        resourceId: plan._id,
        userId: null, // System action
        details: {
          planId: plan.planId,
          installmentNumber: installment.number,
          amount: installment.amount - (installment.paidAmount || 0),
          status,
          transactionId: result.transactionId,
          error: result.error,
          provider: result.provider
        },
        ipAddress: 'system',
        userAgent: 'AutoChargeService'
      });
    } catch (logError) {
      log.error('Failed to log auto-charge result:', { error: logError });
    }
  }

  /**
   * Schedule notifications for upcoming auto-charges
   */
  scheduleNotifications() {
    // Run daily
    this.notificationInterval = setInterval(() => {
      this.sendUpcomingChargeNotifications();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    // Also run on start
    this.sendUpcomingChargeNotifications();
  }

  /**
   * Send notifications for upcoming auto-charges
   */
  async sendUpcomingChargeNotifications() {
    try {
      const plans = await PaymentPlan.find({
        status: 'active',
        'autoPayment.enabled': true
      }).populate('patient', 'firstName lastName email phone');

      const now = new Date();

      for (const plan of plans) {
        const notifyDays = plan.autoPayment.notifyBeforeDays || 3;

        // Find installments due within notification window
        const upcomingInstallments = plan.installments.filter(inst => {
          if (inst.status !== 'pending') return false;

          const dueDate = new Date(inst.dueDate);
          const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

          return daysUntilDue > 0 && daysUntilDue <= notifyDays;
        });

        for (const installment of upcomingInstallments) {
          // Check if already notified for this installment
          const alreadyNotified = plan.reminders?.some(
            r => r.installmentNumber === installment.number && r.method === 'auto_charge_notice'
          );

          if (!alreadyNotified) {
            await this.sendAutoChargeNotification(plan, installment);

            // Record the reminder
            if (!plan.reminders) plan.reminders = [];
            plan.reminders.push({
              sentDate: now,
              method: 'auto_charge_notice',
              installmentNumber: installment.number
            });
            await plan.save();
          }
        }
      }
    } catch (error) {
      log.error('Error sending auto-charge notifications:', { error: error });
    }
  }

  /**
   * Send notification about upcoming auto-charge
   */
  async sendAutoChargeNotification(plan, installment) {
    const patient = plan.patient;
    const dueDate = new Date(installment.dueDate);
    const amount = installment.amount - (installment.paidAmount || 0);

    console.log(`[AutoCharge Notice] Patient: ${patient.firstName} ${patient.lastName}, ` +
      `Plan: ${plan.planId}, Installment: ${installment.number}, ` +
      `Amount: ${amount} CDF, Due: ${dueDate.toLocaleDateString()}`);

    // TODO: Integrate with actual notification service (email, SMS)
    // This is a placeholder for the notification logic
  }

  /**
   * Manually trigger auto-charge for a specific plan
   */
  async manualTrigger(planId) {
    const plan = await PaymentPlan.findById(planId)
      .populate('patient', 'firstName lastName email phone storedPaymentMethods');

    if (!plan) {
      throw new Error('Payment plan not found');
    }

    if (!plan.autoPayment.enabled) {
      throw new Error('Auto-payment is not enabled for this plan');
    }

    const now = new Date();
    const results = [];

    const dueInstallments = plan.installments.filter(inst =>
      (inst.status === 'pending' || inst.status === 'overdue') &&
      inst.paidAmount < inst.amount
    );

    for (const installment of dueInstallments) {
      const paymentMethod = await this.getStoredPaymentMethod(
        plan.patient._id,
        plan.autoPayment.paymentMethodId
      );

      if (!paymentMethod) {
        results.push({
          installmentNumber: installment.number,
          success: false,
          error: 'Payment method not found'
        });
        continue;
      }

      const amountDue = installment.amount - (installment.paidAmount || 0);
      const chargeResult = await this.chargePaymentMethod(
        paymentMethod,
        amountDue,
        plan,
        installment
      );

      if (chargeResult.success) {
        await plan.recordPayment(
          installment.number,
          amountDue,
          chargeResult.transactionId,
          null
        );
      }

      results.push({
        installmentNumber: installment.number,
        ...chargeResult
      });
    }

    return results;
  }

  /**
   * Get auto-charge status and history for a plan
   */
  async getAutoChargeStatus(planId) {
    const plan = await PaymentPlan.findById(planId)
      .populate('patient', 'firstName lastName storedPaymentMethods');

    if (!plan) {
      throw new Error('Payment plan not found');
    }

    const AuditLog = require('../models/AuditLog');
    const history = await AuditLog.find({
      action: 'AUTO_CHARGE',
      resourceType: 'PaymentPlan',
      resourceId: planId
    }).sort('-createdAt').limit(20);

    const paymentMethod = plan.autoPayment.paymentMethodId
      ? await this.getStoredPaymentMethod(plan.patient._id, plan.autoPayment.paymentMethodId)
      : null;

    return {
      enabled: plan.autoPayment.enabled,
      paymentMethod: paymentMethod ? {
        type: paymentMethod.type,
        last4: paymentMethod.last4 || paymentMethod.phoneNumber?.slice(-4),
        expiryDate: paymentMethod.expiryDate
      } : null,
      notifyBeforeDays: plan.autoPayment.notifyBeforeDays,
      disabledReason: plan.autoPayment.disabledReason,
      disabledAt: plan.autoPayment.disabledAt,
      history: history.map(h => ({
        date: h.createdAt,
        installmentNumber: h.details?.installmentNumber,
        amount: h.details?.amount,
        status: h.details?.status,
        error: h.details?.error,
        transactionId: h.details?.transactionId
      }))
    };
  }
}

module.exports = new PaymentPlanAutoChargeService();
