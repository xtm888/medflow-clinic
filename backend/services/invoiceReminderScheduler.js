/**
 * Invoice Payment Reminder Scheduler Service
 *
 * This service handles automatic sending of payment reminders for overdue invoices.
 * It should be initialized when the server starts.
 */

const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const PaymentPlan = require('../models/PaymentPlan');
const notificationFacade = require('./notificationFacade');
const AuditLog = require('../models/AuditLog');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('InvoiceReminderScheduler');

// Configuration for reminder intervals (in days after due date)
const REMINDER_INTERVALS = [
  { days: 1, type: 'first_reminder', urgency: 'low' },
  { days: 7, type: 'second_reminder', urgency: 'medium' },
  { days: 14, type: 'third_reminder', urgency: 'high' },
  { days: 30, type: 'final_notice', urgency: 'critical' }
];

let schedulerInterval = null;

/**
 * Check and send due payment reminders
 */
async function processPaymentReminders() {
  try {
    const now = new Date();
    log.info(`[Invoice Reminder] Processing payment reminders at ${now.toISOString()}`);

    // Get all overdue invoices
    const overdueInvoices = await Invoice.find({
      status: { $in: ['issued', 'sent', 'viewed', 'partial', 'overdue'] },
      dueDate: { $lt: now },
      'summary.amountDue': { $gt: 0 }
    })
      .populate('patient', 'firstName lastName email phoneNumber notificationPreferences')
      .lean();

    let remindersSent = 0;
    let errors = 0;

    for (const invoice of overdueInvoices) {
      try {
        const result = await processInvoiceReminder(invoice, now);
        if (result.sent) {
          remindersSent++;
        }
      } catch (error) {
        log.error(`[Invoice Reminder] Error processing invoice ${invoice.invoiceId}:`, error.message);
        errors++;
      }
    }

    // Also process payment plan reminders
    const planRemindersSent = await processPaymentPlanReminders(now);

    log.info(`[Invoice Reminder] Processed ${overdueInvoices.length} overdue invoices. Sent ${remindersSent} reminders. Errors: ${errors}. Payment plan reminders: ${planRemindersSent}`);

    return { invoicesProcessed: overdueInvoices.length, remindersSent, planRemindersSent, errors };
  } catch (error) {
    log.error('[Invoice Reminder] Error processing reminders:', { error: error });
    throw error;
  }
}

/**
 * Process reminder for a single invoice
 */
async function processInvoiceReminder(invoice, now) {
  // Check if patient has email
  if (!invoice.patient?.email) {
    return { sent: false, reason: 'no_email' };
  }

  // Check patient notification preferences
  const prefs = invoice.patient.notificationPreferences;
  if (prefs && prefs.billing === false) {
    return { sent: false, reason: 'opted_out' };
  }

  // Calculate days overdue
  const dueDate = new Date(invoice.dueDate);
  const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

  // Determine which reminder to send
  const reminderToSend = REMINDER_INTERVALS.find(interval => {
    // Check if we're at or past this interval
    if (daysOverdue < interval.days) return false;

    // Check if this reminder was already sent
    const alreadySent = invoice.reminders?.some(r =>
      r.type === interval.type ||
      (r.type === 'payment' && r.daysOverdue >= interval.days && r.daysOverdue < (interval.days + 7))
    );

    return !alreadySent;
  });

  if (!reminderToSend) {
    return { sent: false, reason: 'already_sent_or_not_due' };
  }

  // Send the reminder
  try {
    await sendPaymentReminder(invoice, reminderToSend, daysOverdue);

    // Update invoice with reminder record
    await Invoice.findByIdAndUpdate(invoice._id, {
      $push: {
        reminders: {
          sentDate: new Date(),
          method: 'email',
          type: 'payment',
          daysOverdue,
          urgency: reminderToSend.urgency
        }
      },
      $set: { status: 'overdue' }
    });

    return { sent: true, type: reminderToSend.type };
  } catch (error) {
    log.error(`[Invoice Reminder] Failed to send reminder for ${invoice.invoiceId}:`, error.message);
    return { sent: false, reason: 'send_failed', error: error.message };
  }
}

/**
 * Send a payment reminder email
 */
async function sendPaymentReminder(invoice, reminderConfig, daysOverdue) {
  const patient = invoice.patient;
  const currency = process.env.BASE_CURRENCY || 'CDF';

  const urgencyMessages = {
    low: 'Nous vous rappelons qu\'un paiement est en attente.',
    medium: 'Votre facture est en retard de paiement. Veuillez regulariser votre situation.',
    high: 'RAPPEL IMPORTANT: Votre facture est significativement en retard.',
    critical: 'AVIS FINAL: Votre compte necessite une attention immediate.'
  };

  // Send email via notification facade (includes retry logic)
  const emailResult = await notificationFacade.sendEmail(
    patient.email,
    `Rappel de paiement - Facture #${invoice.invoiceId}`,
    'paymentReminder',
    {
      patientName: `${patient.firstName} ${patient.lastName}`,
      invoiceId: invoice.invoiceId,
      invoiceDate: new Date(invoice.dateIssued).toLocaleDateString('fr-FR'),
      dueDate: new Date(invoice.dueDate).toLocaleDateString('fr-FR'),
      daysOverdue,
      amountDue: invoice.summary.amountDue.toLocaleString('fr-FR'),
      currency,
      urgency: reminderConfig.urgency,
      urgencyMessage: urgencyMessages[reminderConfig.urgency],
      paymentLink: `${process.env.APP_URL || 'https://app.medflow.health'}/pay/${invoice._id}`
    }
  );

  if (!emailResult.success) {
    throw new Error(emailResult.error || 'Payment reminder email failed');
  }

  // Log to audit
  try {
    await AuditLog.create({
      action: 'PAYMENT_REMINDER_SENT',
      resource: `/api/invoices/${invoice._id}`,
      metadata: {
        invoiceId: invoice.invoiceId,
        patientId: patient.patientId,
        daysOverdue,
        reminderType: reminderConfig.type,
        urgency: reminderConfig.urgency,
        amountDue: invoice.summary.amountDue
      }
    });
  } catch (err) {
    log.error('Failed to log reminder to audit:', err.message);
  }
}

/**
 * Process payment plan reminders (upcoming installments)
 */
async function processPaymentPlanReminders(now) {
  let remindersSent = 0;

  try {
    // Find active payment plans with upcoming installments in next 3 days
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const activePlans = await PaymentPlan.find({
      status: 'active',
      'installments.status': { $in: ['pending', 'overdue'] }
    })
      .populate('patient', 'firstName lastName email phoneNumber')
      .lean();

    for (const plan of activePlans) {
      const patient = plan.patient;
      if (!patient?.email) continue;

      for (const installment of plan.installments) {
        if (installment.status !== 'pending' && installment.status !== 'overdue') continue;

        const dueDate = new Date(installment.dueDate);
        const daysUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));

        // Send reminder 3 days before or if overdue
        const shouldRemind = (daysUntilDue >= 0 && daysUntilDue <= 3) || daysUntilDue < 0;

        // Check if reminder was already sent for this installment
        const alreadySent = plan.reminders?.some(r =>
          r.installmentNumber === installment.number &&
          new Date(r.sentDate) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        );

        if (shouldRemind && !alreadySent) {
          try {
            // Send via notification facade (includes retry logic)
            const emailResult = await notificationFacade.sendEmail(
              patient.email,
              `Rappel d'échéance - Plan de paiement #${plan.planId}`,
              'paymentPlanReminder',
              {
                patientName: `${patient.firstName} ${patient.lastName}`,
                planId: plan.planId,
                installmentNumber: installment.number,
                totalInstallments: plan.numberOfInstallments,
                amount: installment.amount.toLocaleString('fr-FR'),
                currency: process.env.BASE_CURRENCY || 'CDF',
                dueDate: dueDate.toLocaleDateString('fr-FR'),
                isOverdue: daysUntilDue < 0,
                daysOverdue: daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0
              }
            );

            if (!emailResult.success) {
              throw new Error(emailResult.error || 'Payment plan reminder failed');
            }

            // Record reminder sent
            await PaymentPlan.findByIdAndUpdate(plan._id, {
              $push: {
                reminders: {
                  sentDate: new Date(),
                  method: 'email',
                  installmentNumber: installment.number
                }
              }
            });

            remindersSent++;
          } catch (error) {
            log.error(`[Invoice Reminder] Failed to send plan reminder for ${plan.planId}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    log.error('[Invoice Reminder] Error processing payment plan reminders:', { error: error });
  }

  return remindersSent;
}

/**
 * Update overdue status for all invoices
 */
async function updateOverdueStatuses() {
  try {
    const now = new Date();

    const result = await Invoice.updateMany(
      {
        status: { $in: ['issued', 'sent', 'viewed', 'partial'] },
        dueDate: { $lt: now },
        'summary.amountDue': { $gt: 0 }
      },
      {
        $set: { status: 'overdue' }
      }
    );

    log.info(`[Invoice Reminder] Updated ${result.modifiedCount} invoices to overdue status`);
    return result.modifiedCount;
  } catch (error) {
    log.error('[Invoice Reminder] Error updating overdue statuses:', { error: error });
    return 0;
  }
}

/**
 * Get overdue invoice statistics
 */
async function getOverdueStats() {
  const now = new Date();

  const stats = await Invoice.aggregate([
    {
      $match: {
        status: { $in: ['issued', 'sent', 'viewed', 'partial', 'overdue'] },
        dueDate: { $lt: now },
        'summary.amountDue': { $gt: 0 }
      }
    },
    {
      $addFields: {
        daysOverdue: {
          $divide: [
            { $subtract: [now, '$dueDate'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalOverdue: { $sum: '$summary.amountDue' },
        count: { $sum: 1 },
        avgDaysOverdue: { $avg: '$daysOverdue' },
        maxDaysOverdue: { $max: '$daysOverdue' }
      }
    }
  ]);

  return stats[0] || { totalOverdue: 0, count: 0, avgDaysOverdue: 0, maxDaysOverdue: 0 };
}

/**
 * Start the invoice reminder scheduler
 * Runs every 6 hours to check for reminders to send
 */
function startScheduler() {
  if (schedulerInterval) {
    log.info('[Invoice Reminder] Already running');
    return;
  }

  log.info('[Invoice Reminder] Starting scheduler...');

  // Run immediately on start
  updateOverdueStatuses().then(() => processPaymentReminders());

  // Then run every 6 hours
  schedulerInterval = setInterval(async () => {
    await updateOverdueStatuses();
    await processPaymentReminders();
  }, 6 * 60 * 60 * 1000);

  log.info('[Invoice Reminder] Scheduler started (running every 6 hours)');
}

/**
 * Stop the invoice reminder scheduler
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log.info('[Invoice Reminder] Scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
function getStatus() {
  return {
    running: !!schedulerInterval,
    reminderIntervals: REMINDER_INTERVALS,
    checkInterval: '6 hours'
  };
}

/**
 * Manually trigger reminder processing (for testing/admin)
 */
async function triggerReminders() {
  await updateOverdueStatuses();
  return await processPaymentReminders();
}

module.exports = {
  startScheduler,
  stopScheduler,
  processPaymentReminders,
  updateOverdueStatuses,
  getOverdueStats,
  getStatus,
  triggerReminders
};
