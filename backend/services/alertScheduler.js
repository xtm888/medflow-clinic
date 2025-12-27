const cron = require('node-cron');
const Alert = require('../models/Alert');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('AlertScheduler');

/**
 * Alert Scheduler Service
 * Handles scheduled delivery of alerts and recurring alert management
 */

class AlertScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start the alert scheduler
   */
  start() {
    if (this.isRunning) {
      log.info('⚠️  Alert scheduler is already running');
      return;
    }

    log.info('🔔 Starting alert scheduler...');

    // Job 1: Check for alerts ready to deliver (every 1 minute)
    const deliveryJob = cron.schedule('* * * * *', async () => {
      await this.deliverScheduledAlerts();
    });

    // Job 2: Process recurring alerts (every 5 minutes)
    const recurringJob = cron.schedule('*/5 * * * *', async () => {
      await this.processRecurringAlerts();
    });

    // Job 3: Clean up expired alerts (every hour)
    const cleanupJob = cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredAlerts();
    });

    this.jobs = [deliveryJob, recurringJob, cleanupJob];
    this.isRunning = true;

    log.info('✅ Alert scheduler started successfully');
    log.info('   - Alert delivery check: Every 1 minute');
    log.info('   - Recurring alerts: Every 5 minutes');
    log.info('   - Cleanup expired: Every hour');
  }

  /**
   * Stop the alert scheduler
   */
  stop() {
    if (!this.isRunning) {
      log.info('⚠️  Alert scheduler is not running');
      return;
    }

    log.info('🛑 Stopping alert scheduler...');

    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;

    log.info('✅ Alert scheduler stopped');
  }

  /**
   * Deliver alerts that are scheduled for now or past
   */
  async deliverScheduledAlerts() {
    try {
      const alertsToDeliver = await Alert.getScheduledForDelivery();

      if (alertsToDeliver.length === 0) {
        return;
      }

      log.info(`📨 Delivering ${alertsToDeliver.length} scheduled alert(s)...`);

      let deliveredCount = 0;
      let failedCount = 0;

      for (const alert of alertsToDeliver) {
        try {
          await alert.deliver();
          deliveredCount++;

          // If this is a recurring alert, schedule the next occurrence
          if (alert.isRecurring) {
            await this.scheduleNextRecurrence(alert);
          }
        } catch (error) {
          log.error(`❌ Failed to deliver alert ${alert.alertId}:`, error.message);
          failedCount++;
        }
      }

      log.info(`✅ Delivered ${deliveredCount} alert(s), ${failedCount} failed`);
    } catch (error) {
      log.error('❌ Error in deliverScheduledAlerts:', { error: error });
    }
  }

  /**
   * Schedule the next occurrence of a recurring alert
   */
  async scheduleNextRecurrence(alert) {
    try {
      if (!alert.isRecurring || !alert.recurrencePattern) {
        return;
      }

      const { frequency, interval = 1, daysOfWeek, dayOfMonth, endDate } = alert.recurrencePattern;

      // Calculate next scheduled date
      let nextScheduledFor = new Date(alert.scheduledFor);

      switch (frequency) {
        case 'daily':
          nextScheduledFor.setDate(nextScheduledFor.getDate() + interval);
          break;

        case 'weekly':
          // If daysOfWeek is specified, find next matching day
          if (daysOfWeek && daysOfWeek.length > 0) {
            nextScheduledFor = this.getNextWeekday(nextScheduledFor, daysOfWeek);
          } else {
            nextScheduledFor.setDate(nextScheduledFor.getDate() + (7 * interval));
          }
          break;

        case 'monthly':
          if (dayOfMonth) {
            nextScheduledFor.setMonth(nextScheduledFor.getMonth() + interval);
            nextScheduledFor.setDate(Math.min(dayOfMonth, this.getDaysInMonth(nextScheduledFor)));
          } else {
            nextScheduledFor.setMonth(nextScheduledFor.getMonth() + interval);
          }
          break;

        case 'yearly':
          nextScheduledFor.setFullYear(nextScheduledFor.getFullYear() + interval);
          break;

        default:
          log.warn(`Unknown recurrence frequency: ${frequency}`);
          return;
      }

      // Check if next occurrence is past end date
      if (endDate && nextScheduledFor > new Date(endDate)) {
        log.info(`🔚 Recurring alert ${alert.alertId} has reached end date`);
        return;
      }

      // Create new alert for next occurrence
      const nextAlert = new Alert({
        targetUser: alert.targetUser,
        targetRole: alert.targetRole,
        title: alert.title,
        message: alert.message,
        type: alert.type,
        category: alert.category,
        priority: alert.priority,
        relatedPatient: alert.relatedPatient,
        relatedAppointment: alert.relatedAppointment,
        relatedVisit: alert.relatedVisit,
        relatedPrescription: alert.relatedPrescription,
        scheduledFor: nextScheduledFor,
        actionRequired: alert.actionRequired,
        actionUrl: alert.actionUrl,
        actionLabel: alert.actionLabel,
        isRecurring: true,
        recurrencePattern: alert.recurrencePattern,
        icon: alert.icon,
        color: alert.color,
        metadata: alert.metadata,
        createdBy: alert.createdBy,
        expiresAt: alert.expiresAt ? new Date(nextScheduledFor.getTime() + (new Date(alert.expiresAt) - new Date(alert.scheduledFor))) : undefined
      });

      await nextAlert.save();
      log.info(`🔄 Scheduled next recurrence for alert ${alert.alertId}: ${nextScheduledFor.toISOString()}`);
    } catch (error) {
      log.error(`❌ Error scheduling next recurrence for alert ${alert.alertId}:`, error.message);
    }
  }

  /**
   * Get next occurrence of a specific weekday
   */
  getNextWeekday(currentDate, daysOfWeek) {
    const date = new Date(currentDate);
    const currentDay = date.getDay();

    // Find next matching day
    let daysToAdd = 1;
    for (let i = 1; i <= 7; i++) {
      const nextDay = (currentDay + i) % 7;
      if (daysOfWeek.includes(nextDay)) {
        daysToAdd = i;
        break;
      }
    }

    date.setDate(date.getDate() + daysToAdd);
    return date;
  }

  /**
   * Get number of days in a month
   */
  getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Process recurring alerts (check for any that need attention)
   */
  async processRecurringAlerts() {
    try {
      // Find recurring alerts that have been delivered but have no next occurrence scheduled
      const deliveredRecurringAlerts = await Alert.find({
        isRecurring: true,
        status: { $in: ['delivered', 'read'] },
        scheduledFor: { $lt: new Date() }
      }).sort({ scheduledFor: -1 });

      for (const alert of deliveredRecurringAlerts) {
        // Check if next occurrence already exists
        const nextOccurrenceExists = await Alert.findOne({
          targetUser: alert.targetUser,
          type: alert.type,
          title: alert.title,
          isRecurring: true,
          status: 'scheduled',
          scheduledFor: { $gt: alert.scheduledFor }
        });

        if (!nextOccurrenceExists) {
          await this.scheduleNextRecurrence(alert);
        }
      }
    } catch (error) {
      log.error('❌ Error in processRecurringAlerts:', { error: error });
    }
  }

  /**
   * Clean up expired alerts
   */
  async cleanupExpiredAlerts() {
    try {
      const result = await Alert.updateMany(
        {
          expiresAt: { $lt: new Date() },
          status: { $ne: 'expired' }
        },
        {
          $set: { status: 'expired' }
        }
      );

      if (result.modifiedCount > 0) {
        log.info(`🧹 Marked ${result.modifiedCount} alert(s) as expired`);
      }
    } catch (error) {
      log.error('❌ Error in cleanupExpiredAlerts:', { error: error });
    }
  }

  /**
   * Create appointment reminder alerts
   * Called when appointments are created/updated
   */
  async createAppointmentReminder(appointment, reminderTime = 24) {
    try {
      const appointmentDate = new Date(appointment.date);
      const reminderDate = new Date(appointmentDate);
      reminderDate.setHours(reminderDate.getHours() - reminderTime);

      // Don't create reminder if appointment is in the past
      if (reminderDate < new Date()) {
        return null;
      }

      const alert = new Alert({
        targetUser: appointment.doctor || appointment.assignedTo,
        title: 'Rappel de rendez-vous',
        message: `Rendez-vous avec ${appointment.patient?.firstName || 'patient'} ${appointment.patient?.lastName || ''} prévu le ${appointmentDate.toLocaleDateString('fr-FR')} à ${appointmentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        type: 'appointment_reminder',
        category: 'reminder',
        priority: 3,
        relatedPatient: appointment.patient?._id || appointment.patient,
        relatedAppointment: appointment._id,
        scheduledFor: reminderDate,
        actionRequired: true,
        actionUrl: `/appointments/${appointment._id}`,
        actionLabel: 'Voir le rendez-vous',
        icon: 'calendar',
        color: 'blue',
        expiresAt: appointmentDate,
        createdBy: appointment.createdBy
      });

      await alert.save();
      log.info(`✅ Created appointment reminder for ${appointment._id}`);
      return alert;
    } catch (error) {
      log.error('❌ Error creating appointment reminder:', error.message);
      return null;
    }
  }

  /**
   * Create low inventory alert
   */
  async createLowInventoryAlert(medication, currentStock, threshold, pharmacist) {
    try {
      const alert = new Alert({
        targetUser: pharmacist,
        targetRole: 'pharmacist',
        title: 'Stock faible',
        message: `Le stock de ${medication.name} est faible (${currentStock} unités restantes, seuil: ${threshold})`,
        type: 'inventory_low',
        category: 'important',
        priority: 4,
        scheduledFor: new Date(),
        actionRequired: true,
        actionUrl: `/pharmacy/inventory/${medication._id}`,
        actionLabel: 'Gérer le stock',
        icon: 'alert-triangle',
        color: 'orange',
        metadata: new Map([
          ['medicationId', medication._id.toString()],
          ['currentStock', currentStock],
          ['threshold', threshold]
        ]),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expire in 7 days
      });

      await alert.save();
      await alert.deliver();
      log.info(`✅ Created low inventory alert for ${medication.name}`);
      return alert;
    } catch (error) {
      log.error('❌ Error creating low inventory alert:', error.message);
      return null;
    }
  }

  /**
   * Create patient waiting alert
   */
  async createPatientWaitingAlert(patient, queuePosition, assignedDoctor) {
    try {
      const alert = new Alert({
        targetUser: assignedDoctor,
        title: 'Patient en attente',
        message: `${patient.firstName} ${patient.lastName} est en position ${queuePosition} dans la file d'attente`,
        type: 'patient_waiting',
        category: 'info',
        priority: 2,
        relatedPatient: patient._id,
        scheduledFor: new Date(),
        actionRequired: true,
        actionUrl: '/queue',
        actionLabel: 'Voir la file d\'attente',
        icon: 'users',
        color: 'blue',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expire in 24 hours
      });

      await alert.save();
      await alert.deliver();
      // SECURITY: Log patient ID only, not name (PHI protection)
      log.info(`✅ Created patient waiting alert for patient ID: ${patient._id}`);
      return alert;
    } catch (error) {
      log.error('❌ Error creating patient waiting alert:', error.message);
      return null;
    }
  }
}

// Create singleton instance
const alertScheduler = new AlertScheduler();

module.exports = alertScheduler;
