/**
 * Appointment Reminder Scheduler Service
 *
 * This service handles automatic sending of appointment reminders.
 * It should be initialized when the server starts.
 */

const Appointment = require('../models/Appointment');
const notificationFacade = require('./notificationFacade');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ReminderScheduler');

// Configuration for reminder intervals (in hours before appointment)
const REMINDER_INTERVALS = {
  '24h': 24,    // 24 hours before
  '2h': 2,      // 2 hours before
  '1d': 24,     // 1 day before (same as 24h)
  '1w': 168     // 1 week before
};

// Default reminder schedule (hours before appointment)
const DEFAULT_REMINDERS = [24, 2]; // 24 hours and 2 hours before

let schedulerInterval = null;

/**
 * Check and send due reminders
 */
async function processReminders() {
  try {
    const now = new Date();

    // Find appointments that need reminders in the next check window
    // Check for appointments happening in the next 25 hours (to catch 24h reminders)
    const futureWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const appointments = await Appointment.find({
      date: { $gte: now, $lte: futureWindow },
      status: { $in: ['scheduled', 'confirmed'] }
    })
      .populate('patient', 'firstName lastName email phoneNumber notificationPreferences')
      .populate('provider', 'firstName lastName');

    for (const appointment of appointments) {
      await processAppointmentReminders(appointment, now);
    }

    log.info(`[Reminder Scheduler] Processed ${appointments.length} appointments`);
  } catch (error) {
    log.error('[Reminder Scheduler] Error processing reminders:', { error: error });
  }
}

/**
 * Process reminders for a single appointment
 */
async function processAppointmentReminders(appointment, now) {
  try {
    // Calculate appointment datetime
    const appointmentDateTime = new Date(appointment.date);
    const [hours, minutes] = appointment.startTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    // Time until appointment (in hours)
    const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

    // Check if patient has email
    if (!appointment.patient?.email) {
      return;
    }

    // Check what reminders have been sent
    const sentReminders = appointment.reminders || [];
    const sentTypes = sentReminders
      .filter(r => r.sent)
      .map(r => r.scheduledFor ? Math.round((appointmentDateTime - r.scheduledFor) / (1000 * 60 * 60)) : null);

    // Determine which reminders to send
    for (const reminderHours of DEFAULT_REMINDERS) {
      // Check if we're within the window for this reminder
      // e.g., for 24h reminder, send if appointment is 23-25 hours away
      const lowerBound = reminderHours - 1;
      const upperBound = reminderHours + 1;

      if (hoursUntilAppointment >= lowerBound && hoursUntilAppointment <= upperBound) {
        // Check if this reminder was already sent
        const alreadySent = sentReminders.some(r =>
          r.sent &&
          r.type === 'email' &&
          Math.abs(Math.round((appointmentDateTime - new Date(r.scheduledFor)) / (1000 * 60 * 60)) - reminderHours) < 2
        );

        if (!alreadySent) {
          await sendAppointmentReminder(appointment, reminderHours);
        }
      }
    }
  } catch (error) {
    log.error(`[Reminder Scheduler] Error processing appointment ${appointment._id}:`, { error: error });
  }
}

/**
 * Send an appointment reminder
 */
async function sendAppointmentReminder(appointment, hoursBeforeAppointment) {
  try {
    const reminder = {
      type: 'email',
      scheduledFor: new Date(),
      sent: false,
      status: 'pending'
    };

    // Send the email via notification facade (includes retry logic)
    const emailResult = await notificationFacade.sendEmail(
      appointment.patient.email,
      `Rappel de rendez-vous - ${new Date(appointment.date).toLocaleDateString('fr-FR')}`,
      'appointmentReminder',
      {
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        date: new Date(appointment.date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: appointment.startTime,
        provider: appointment.provider
          ? `Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}`
          : 'Votre médecin',
        department: translateDepartment(appointment.department),
        preparation: appointment.preparation?.instructions || '',
        hoursUntil: hoursBeforeAppointment
      }
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Email send failed');
    }

    // Update reminder record
    reminder.sent = true;
    reminder.sentAt = new Date();
    reminder.status = 'sent';

    // Save to appointment
    appointment.reminders.push(reminder);
    await appointment.save();

    log.info(`[Reminder Scheduler] Sent ${hoursBeforeAppointment}h reminder for appointment ${appointment.appointmentId}`);
  } catch (error) {
    log.error('[Reminder Scheduler] Failed to send reminder:', { error: error });

    // Record failed attempt
    appointment.reminders.push({
      type: 'email',
      scheduledFor: new Date(),
      sent: false,
      status: 'failed',
      error: error.message
    });
    await appointment.save();
  }
}

/**
 * Schedule reminders for a new appointment
 */
async function scheduleRemindersForAppointment(appointmentId) {
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'email notificationPreferences');

    if (!appointment || !appointment.patient?.email) {
      return;
    }

    // Calculate appointment datetime
    const appointmentDateTime = new Date(appointment.date);
    const [hours, minutes] = appointment.startTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    // Schedule reminders
    for (const reminderHours of DEFAULT_REMINDERS) {
      const reminderTime = new Date(appointmentDateTime.getTime() - reminderHours * 60 * 60 * 1000);

      // Only schedule if reminder time is in the future
      if (reminderTime > new Date()) {
        appointment.reminders.push({
          type: 'email',
          scheduledFor: reminderTime,
          sent: false,
          status: 'scheduled'
        });
      }
    }

    await appointment.save();
    log.info(`[Reminder Scheduler] Scheduled reminders for appointment ${appointment.appointmentId}`);
  } catch (error) {
    log.error('[Reminder Scheduler] Error scheduling reminders:', { error: error });
  }
}

/**
 * Helper to translate department names
 */
function translateDepartment(department) {
  const translations = {
    'general': 'Médecine Générale',
    'ophthalmology': 'Ophtalmologie',
    'pediatrics': 'Pédiatrie',
    'cardiology': 'Cardiologie',
    'orthopedics': 'Orthopédie',
    'emergency': 'Urgences',
    'laboratory': 'Laboratoire',
    'radiology': 'Radiologie'
  };
  return translations[department] || department;
}

/**
 * Start the reminder scheduler
 * Runs every 30 minutes to check for reminders to send
 */
function startScheduler() {
  if (schedulerInterval) {
    log.info('[Reminder Scheduler] Already running');
    return;
  }

  log.info('[Reminder Scheduler] Starting scheduler...');

  // Run immediately on start
  processReminders();

  // Then run every 30 minutes
  schedulerInterval = setInterval(processReminders, 30 * 60 * 1000);

  log.info('[Reminder Scheduler] Scheduler started (running every 30 minutes)');
}

/**
 * Stop the reminder scheduler
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log.info('[Reminder Scheduler] Scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
function getStatus() {
  return {
    running: !!schedulerInterval,
    defaultReminders: DEFAULT_REMINDERS,
    checkInterval: '30 minutes'
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  processReminders,
  scheduleRemindersForAppointment,
  getStatus
};
