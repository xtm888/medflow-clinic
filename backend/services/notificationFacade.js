/**
 * Unified Notification Facade
 *
 * Consolidates all notification services into a single entry point:
 * - Uses enhancedNotificationService for SMS (rate limiting, retry, multi-provider)
 * - Uses enhancedNotificationService for emails with retry
 * - Preserves clinical workflow methods from notificationService
 * - Provides backward compatibility for all existing callers
 *
 * @see enhancedNotificationService.js - Core SMS/email with retry
 * @see notificationService.js - Clinical workflows (deprecated, use facade)
 * @see emailQueueService.js - For bulk/queued emails
 */

const enhancedService = require('./enhancedNotificationService');
const emailQueueService = require('./emailQueueService');
const sendEmailDirect = require('../utils/sendEmail');

/**
 * Notification Facade - Unified notification API
 */
const notificationFacade = {
  // =============================================
  // CORE SMS METHODS (via enhancedNotificationService)
  // =============================================

  /**
   * Send SMS with retry logic and rate limiting
   * @param {string} phoneNumber - Phone number (DRC format handled automatically)
   * @param {string} message - Message content
   * @param {Object} options - Optional: maxRetries, priority
   * @returns {Promise<{success: boolean, error?: string, provider?: string}>}
   */
  async sendSMS(phoneNumber, message, options = {}) {
    return enhancedService.sendSMS(phoneNumber, message, options);
  },

  /**
   * Send bulk SMS with batching and rate limiting
   * @param {Array<{phoneNumber: string}>} recipients - List of recipients
   * @param {string} message - Message to send
   * @param {Object} options - Optional: batchSize
   * @returns {Promise<{total: number, successful: number, failed: number, results: Array}>}
   */
  async sendBulkSMS(recipients, message, options = {}) {
    return enhancedService.sendBulkSMS(recipients, message, options);
  },

  // =============================================
  // CORE EMAIL METHODS
  // =============================================

  /**
   * Send email with retry logic (immediate delivery)
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} template - Template name
   * @param {Object} context - Template variables
   * @param {Object} options - Optional: maxRetries
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendEmail(to, subject, template, context, options = {}) {
    return enhancedService.sendEmailNotification(to, subject, template, context, options);
  },

  /**
   * Alias for sendEmail (backward compatibility with enhancedNotificationService)
   */
  async sendEmailNotification(to, subject, template, context, options = {}) {
    return enhancedService.sendEmailNotification(to, subject, template, context, options);
  },

  /**
   * Send email directly without retry (for simple use cases)
   * @param {Object} options - { to, subject, template, context, html, text }
   * @returns {Promise<void>}
   */
  async sendEmailDirect(options) {
    return sendEmailDirect(options);
  },

  /**
   * Queue email for later delivery (bulk/non-urgent)
   * Uses emailQueueService.enqueue() for database-backed queue
   * @param {Object} emailData - Email data with to, subject, template, data (context)
   * @param {Object} options - Optional: priority, scheduledFor, context
   * @returns {Promise<Object>} - Queued email document
   */
  async queueEmail(emailData, options = {}) {
    // Map to emailQueueService.enqueue() API
    return emailQueueService.enqueue({
      to: emailData.to,
      subject: emailData.subject,
      template: emailData.template,
      data: emailData.data || emailData.context,
      html: emailData.html,
      text: emailData.text,
      priority: options.priority || 5,
      scheduledFor: options.scheduledFor,
      context: options.context || 'other',
      relatedId: options.relatedId,
      relatedModel: options.relatedModel,
      createdBy: options.createdBy
    });
  },

  /**
   * Queue multiple emails
   * @param {Array<Object>} emails - Array of email data objects
   * @param {Object} options - Optional: priority, context
   * @returns {Promise<Array>} - Array of queued email documents
   */
  async queueBulkEmails(emails, options = {}) {
    const results = [];
    for (const email of emails) {
      try {
        const result = await this.queueEmail(email, options);
        results.push({ success: true, email: result });
      } catch (error) {
        results.push({ success: false, error: error.message, to: email.to });
      }
    }
    return results;
  },

  // =============================================
  // QUEUE MANAGEMENT
  // =============================================

  /**
   * Queue notification for later sending (in-memory queue)
   * @param {'sms'|'email'} type - Notification type
   * @param {Object} data - Notification data
   */
  queueNotification(type, data) {
    return enhancedService.queueNotification(type, data);
  },

  /**
   * Process email queue (call periodically or on demand)
   * Note: emailQueueService.processQueue() takes no arguments
   * @returns {Promise<void>}
   */
  async processEmailQueue() {
    return emailQueueService.processQueue();
  },

  /**
   * Get email queue statistics
   * @returns {Promise<Object>} - Queue stats by status
   */
  async getEmailQueueStats() {
    return emailQueueService.getStats();
  },

  // =============================================
  // GLASSES ORDER NOTIFICATIONS
  // =============================================

  /**
   * Notify patient when glasses order is confirmed
   * @param {Object} order - Glasses order document
   * @param {Object} patient - Patient document
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendGlassesOrderConfirmation(order, patient) {
    const message = `Bonjour ${patient.firstName}, votre commande de lunettes #${order.orderNumber} a été confirmée. ` +
      `Nous vous contacterons dès qu'elles seront prêtes. - Clinique Ophtalmologique`;

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        `Confirmation de commande #${order.orderNumber}`,
        'glasses-order-confirmed',
        { patient, order }
      );
    }

    await this._logNotification(order, 'confirmed', message, results);
    return results;
  },

  /**
   * Notify patient when glasses are READY for pickup
   * @param {Object} order - Glasses order document
   * @param {Object} patient - Patient document
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendGlassesReadyNotification(order, patient) {
    const message = `Bonjour ${patient.firstName}! Vos lunettes sont PRÊTES! ` +
      `Veuillez passer les récupérer à la clinique. Ref: ${order.orderNumber}. ` +
      `Horaires: Lun-Ven 8h-17h, Sam 8h-12h. - Clinique Ophtalmologique`;

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        `Vos lunettes sont prêtes! - ${order.orderNumber}`,
        'glasses-ready',
        { patient, order }
      );
    }

    await this._logNotification(order, 'ready', message, results);
    return results;
  },

  /**
   * Notify patient when glasses are delivered
   * @param {Object} order - Glasses order document
   * @param {Object} patient - Patient document
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendGlassesDeliveredNotification(order, patient) {
    const message = `Merci ${patient.firstName}! Vos lunettes #${order.orderNumber} ont été remises. ` +
      `Pour toute question, contactez-nous. Prenez soin de vos yeux! - Clinique Ophtalmologique`;

    const results = { sms: null, email: null };

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        `Confirmation de remise - ${order.orderNumber}`,
        'glasses-delivered',
        { patient, order }
      );
    }

    await this._logNotification(order, 'delivered', message, results);
    return results;
  },

  /**
   * Send pickup reminder for orders ready but not picked up
   * @param {Object} order - Glasses order document
   * @param {Object} patient - Patient document
   * @param {number} daysSinceReady - Days since order was marked ready
   * @returns {Promise<{sms: Object|null}>}
   */
  async sendGlassesPickupReminder(order, patient, daysSinceReady) {
    const message = `Rappel: Vos lunettes #${order.orderNumber} vous attendent depuis ${daysSinceReady} jours! ` +
      `Passez les récupérer à la clinique. - Clinique Ophtalmologique`;

    const results = { sms: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    await this._logNotification(order, 'pickup_reminder', message, results);
    return results;
  },

  // =============================================
  // SURGERY NOTIFICATIONS
  // =============================================

  /**
   * Notify patient of surgery scheduling
   * @param {Object} surgeryCase - Surgery case document
   * @param {Object} patient - Patient document
   * @param {Date|string} scheduledDate - Surgery date
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendSurgeryScheduledNotification(surgeryCase, patient, scheduledDate) {
    const dateStr = new Date(scheduledDate).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const message = `Bonjour ${patient.firstName}, votre chirurgie est programmée pour le ${dateStr}. ` +
      `Veuillez respecter les consignes pré-opératoires. Contactez-nous pour toute question. - Clinique Ophtalmologique`;

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        `Confirmation de chirurgie - ${dateStr}`,
        'surgery-scheduled',
        { patient, surgeryCase, scheduledDate: dateStr }
      );
    }

    return results;
  },

  /**
   * Send surgery reminder (day before)
   * @param {Object} surgeryCase - Surgery case document
   * @param {Object} patient - Patient document
   * @returns {Promise<{sms: Object|null}>}
   */
  async sendSurgeryReminder(surgeryCase, patient) {
    const message = `Rappel: Votre chirurgie est demain. ` +
      `Présentez-vous à jeun. N'oubliez pas vos documents d'identité. - Clinique Ophtalmologique`;

    const results = { sms: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    return results;
  },

  /**
   * Notify about follow-up appointment after surgery
   * @param {Object} appointment - Appointment document
   * @param {Object} patient - Patient document
   * @param {string} surgeryType - Type of surgery
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendFollowUpAppointmentNotification(appointment, patient, surgeryType) {
    const dateStr = new Date(appointment.scheduledDate).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const message = `Bonjour ${patient.firstName}, votre RDV de suivi post-opératoire (${surgeryType}) ` +
      `est prévu le ${dateStr}. - Clinique Ophtalmologique`;

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        `RDV de suivi post-opératoire - ${dateStr}`,
        'surgery-followup',
        { patient, appointment, surgeryType }
      );
    }

    return results;
  },

  // =============================================
  // LAB NOTIFICATIONS
  // =============================================

  /**
   * Notify patient when lab results are ready
   * @param {Object} labOrder - Lab order document
   * @param {Object} patient - Patient document
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendLabResultsReadyNotification(labOrder, patient) {
    const message = `Bonjour ${patient.firstName}, vos résultats d'analyses sont disponibles. ` +
      `Vous pouvez les récupérer à la clinique ou consulter votre médecin. - Clinique Ophtalmologique`;

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        "Vos résultats d'analyses sont prêts",
        'lab-results-ready',
        { patient, labOrder }
      );
    }

    return results;
  },

  // =============================================
  // APPOINTMENT NOTIFICATIONS
  // =============================================

  /**
   * Send appointment reminder
   * @param {Object} appointment - Appointment document
   * @param {Object} patient - Patient document
   * @param {number} hoursBeforeAppointment - Hours before (default 24)
   * @returns {Promise<{sms: Object|null}>}
   */
  async sendAppointmentReminder(appointment, patient, hoursBeforeAppointment = 24) {
    const dateStr = new Date(appointment.scheduledDate || appointment.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const timeStr = appointment.startTime || '';
    const reminderText = hoursBeforeAppointment >= 24 ? 'demain' : `dans ${hoursBeforeAppointment} heures`;

    const message = `Rappel: Votre RDV est ${reminderText} (${dateStr} ${timeStr}). ` +
      `Merci de vous présenter 15 min à l'avance. - Clinique Ophtalmologique`;

    const results = { sms: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    return results;
  },

  /**
   * Notify patient of new appointment
   * @param {Object} appointment - Appointment document
   * @param {Object} patient - Patient document
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendNewAppointmentNotification(appointment, patient) {
    const dateStr = new Date(appointment.scheduledDate || appointment.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const timeStr = appointment.startTime || '';

    const message = `Bonjour ${patient.firstName}, votre RDV a été confirmé pour le ${dateStr} ${timeStr}. ` +
      `Merci de vous présenter 15 min à l'avance. - Clinique Ophtalmologique`;

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        `Confirmation de rendez-vous - ${dateStr}`,
        'appointment-confirmed',
        { patient, appointment, dateStr, timeStr }
      );
    }

    return results;
  },

  /**
   * Notify patient of appointment update/change
   * @param {Object} appointment - Appointment document
   * @param {Object} patient - Patient document
   * @param {string} changeType - Type of change (rescheduled, cancelled, etc.)
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendAppointmentUpdateNotification(appointment, patient, changeType) {
    const dateStr = new Date(appointment.scheduledDate || appointment.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const timeStr = appointment.startTime || '';

    let message;
    let subject;

    switch (changeType) {
      case 'rescheduled':
        message = `Bonjour ${patient.firstName}, votre RDV a été reprogrammé au ${dateStr} ${timeStr}. ` +
          `Contactez-nous si cela ne vous convient pas. - Clinique Ophtalmologique`;
        subject = `RDV reprogrammé - ${dateStr}`;
        break;
      case 'cancelled':
        message = `Bonjour ${patient.firstName}, votre RDV du ${dateStr} a été annulé. ` +
          `Contactez-nous pour reprogrammer. - Clinique Ophtalmologique`;
        subject = `RDV annulé`;
        break;
      default:
        message = `Bonjour ${patient.firstName}, votre RDV du ${dateStr} ${timeStr} a été modifié. ` +
          `Contactez-nous pour plus d'informations. - Clinique Ophtalmologique`;
        subject = `Modification de RDV - ${dateStr}`;
    }

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        subject,
        'appointment-update',
        { patient, appointment, changeType, dateStr, timeStr }
      );
    }

    return results;
  },

  // =============================================
  // INVOICE/PAYMENT NOTIFICATIONS
  // =============================================

  /**
   * Send payment reminder for overdue invoice
   * @param {Object} invoice - Invoice document
   * @param {Object} patient - Patient document
   * @param {number} daysOverdue - Days past due date
   * @returns {Promise<{sms: Object|null, email: Object|null}>}
   */
  async sendPaymentReminder(invoice, patient, daysOverdue = 0) {
    const amountDue = invoice.amountDue || invoice.total || 0;
    const currency = invoice.currency || 'USD';

    let message;
    if (daysOverdue > 0) {
      message = `Rappel: Facture #${invoice.invoiceNumber} de ${amountDue} ${currency} en attente depuis ${daysOverdue} jours. ` +
        `Merci de régulariser. - Clinique Ophtalmologique`;
    } else {
      message = `Rappel: Facture #${invoice.invoiceNumber} de ${amountDue} ${currency} à régler. ` +
        `Merci de votre attention. - Clinique Ophtalmologique`;
    }

    const results = { sms: null, email: null };

    if (patient.phone) {
      results.sms = await this.sendSMS(patient.phone, message);
    }

    if (patient.email) {
      results.email = await this.sendEmail(
        patient.email,
        `Rappel de paiement - Facture #${invoice.invoiceNumber}`,
        'payment-reminder',
        { patient, invoice, daysOverdue, amountDue, currency }
      );
    }

    return results;
  },

  // =============================================
  // STATISTICS & UTILITIES
  // =============================================

  /**
   * Get notification statistics
   * @returns {Object} - Stats including totals, rates, queue info
   */
  getStats() {
    return enhancedService.getStats();
  },

  /**
   * Reset notification statistics
   */
  resetStats() {
    return enhancedService.resetStats();
  },

  /**
   * Format phone number for DRC
   * @param {string} phoneNumber - Raw phone number
   * @returns {string|null} - Formatted number or null if invalid
   */
  formatPhoneNumber(phoneNumber) {
    return enhancedService.formatPhoneNumber(phoneNumber);
  },

  /**
   * Validate email address format
   * @param {string} email - Email address
   * @returns {boolean} - True if valid
   */
  validateEmail(email) {
    return enhancedService.validateEmail(email);
  },

  /**
   * Schedule a notification for later
   * @param {string} type - Notification type
   * @param {string} entityId - Entity ID
   * @param {string} entityType - Entity type (patient, order, etc.)
   * @param {Date} scheduledFor - When to send
   * @param {Object} data - Notification data
   * @returns {Promise<{scheduled: boolean, scheduledFor: Date}>}
   */
  async scheduleNotification(type, entityId, entityType, scheduledFor, data) {
    console.log(`[NotificationFacade] Scheduled ${type} notification for ${entityType}:${entityId} at ${scheduledFor}`);
    // TODO: Integrate with job queue (Bull/Agenda)
    return { scheduled: true, scheduledFor };
  },

  // =============================================
  // INTERNAL HELPERS
  // =============================================

  /**
   * Log notification to entity (internal use)
   * @private
   */
  async _logNotification(entity, type, message, results) {
    if (!entity) return;

    if (!entity.notifications) {
      entity.notifications = [];
    }

    entity.notifications.push({
      type,
      sentAt: new Date(),
      message: message.substring(0, 200),
      status: (results.sms?.success || results.email?.success) ? 'sent' : 'failed',
      channels: {
        sms: results.sms?.success || false,
        email: results.email?.success || false
      }
    });

    try {
      if (entity.save) {
        await entity.save();
      }
    } catch (err) {
      console.error('[NotificationFacade] Error logging notification:', err.message);
    }
  }
};

module.exports = notificationFacade;
