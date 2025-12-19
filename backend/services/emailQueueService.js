/**
 * Email Queue Service
 *
 * @internal This is an INTERNAL implementation service used by notificationFacade.
 * For external use, import from notificationFacade.js instead:
 *   const notificationFacade = require('./notificationFacade');
 *
 * Provides queued email delivery with:
 * - Persistent queue in MongoDB
 * - Retry logic with exponential backoff
 * - Concurrent processing
 * - Template support
 */

const nodemailer = require('nodemailer');
const EmailQueue = require('../models/EmailQueue');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('EmailQueue');

class EmailQueueService {
  constructor() {
    this.transporter = null;
    this.isProcessing = false;
    this.processInterval = null;
    this.initialized = false;
    this.concurrency = 3; // Process 3 emails at a time

    // Email templates
    this.templates = {
      emailVerification: (data) => ({
        subject: 'Vérification de votre email - CareVision',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3498db;">Vérification de votre Email</h2>
            <p>Bonjour ${data.name},</p>
            <p>Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous:</p>
            <p style="margin: 20px 0;">
              <a href="${data.verificationUrl}" style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                Vérifier mon email
              </a>
            </p>
            <p style="color: #7f8c8d; font-size: 12px;">Ce lien expire dans 24 heures.</p>
          </div>
        `
      }),
      passwordReset: (data) => ({
        subject: 'Réinitialisation de mot de passe - CareVision',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Réinitialisation de Mot de Passe</h2>
            <p>Bonjour ${data.name},</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe:</p>
            <p style="margin: 20px 0;">
              <a href="${data.resetUrl}" style="background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                Réinitialiser
              </a>
            </p>
            <p style="color: #7f8c8d; font-size: 12px;">Ce lien expire dans 10 minutes.</p>
          </div>
        `
      }),
      appointmentConfirmation: (data) => ({
        subject: `Confirmation de RDV - ${new Date(data.date).toLocaleDateString('fr-FR')}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #27ae60;">Rendez-vous Confirmé</h2>
            <p>Bonjour ${data.patientName},</p>
            <div style="background: #d5f4e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date:</strong> ${new Date(data.date).toLocaleDateString('fr-FR')}</p>
              <p><strong>Heure:</strong> ${data.time}</p>
              <p><strong>Médecin:</strong> Dr. ${data.provider}</p>
              <p><strong>Lieu:</strong> ${data.location || 'CareVision'}</p>
            </div>
            <p style="color: #e74c3c;"><strong>Rappel:</strong> Veuillez arriver 15 minutes avant.</p>
          </div>
        `
      }),
      appointmentReminder: (data) => ({
        subject: `Rappel: RDV demain à ${data.time}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f39c12;">Rappel de Rendez-vous</h2>
            <p>Bonjour ${data.patientName},</p>
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12;">
              <p><strong>Date:</strong> ${new Date(data.date).toLocaleDateString('fr-FR')}</p>
              <p><strong>Heure:</strong> ${data.time}</p>
              <p><strong>Médecin:</strong> Dr. ${data.provider}</p>
            </div>
            <p>N'oubliez pas d'apporter votre carte d'identité.</p>
          </div>
        `
      }),
      prescriptionReady: (data) => ({
        subject: 'Votre ordonnance est prête - CareVision',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #27ae60;">Ordonnance Prête</h2>
            <p>Bonjour ${data.patientName},</p>
            <div style="background: #d5f4e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>N° Ordonnance:</strong> ${data.prescriptionId}</p>
              <p><strong>Médicaments:</strong> ${data.medications}</p>
            </div>
            <p>Présentez-vous à la pharmacie avec votre pièce d'identité.</p>
          </div>
        `
      }),
      twoFactorBackupWarning: (data) => ({
        subject: 'Alerte Sécurité: Codes de secours faibles - CareVision',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Alerte Sécurité</h2>
            <p>Bonjour ${data.name},</p>
            <p>Il ne vous reste que <strong>${data.remainingCodes}</strong> codes de secours pour l'authentification à deux facteurs.</p>
            <p>Nous vous recommandons de régénérer de nouveaux codes dans les paramètres de sécurité.</p>
          </div>
        `
      })
    };
  }

  // Initialize the service
  async init() {
    try {
      // Create transporter
      if (process.env.NODE_ENV === 'production') {
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.EMAIL_PORT) || 587,
          secure: process.env.EMAIL_PORT === '465',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          pool: true, // Use pooled connections
          maxConnections: 5,
          maxMessages: 100
        });
      } else {
        // Development: Use Ethereal Email for testing
        try {
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
          log.info('📧 Email queue using Ethereal test account');
        } catch (err) {
          log.warn('⚠️ Could not create Ethereal account, email queue disabled');
          return;
        }
      }

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      log.info('✅ Email queue service initialized');
    } catch (error) {
      log.error('❌ Email queue service init failed:', error.message);
      this.initialized = false;
    }
  }

  // Start processing the queue
  start(intervalMs = 30000) {
    if (this.processInterval) {
      log.warn('Email queue processor already running');
      return;
    }

    log.info(`📧 Starting email queue processor (interval: ${intervalMs}ms)`);

    // Process immediately, then on interval
    this.processQueue();
    this.processInterval = setInterval(() => this.processQueue(), intervalMs);
  }

  // Stop processing
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      log.info('📧 Email queue processor stopped');
    }
  }

  // Process pending emails in the queue
  async processQueue() {
    if (this.isProcessing || !this.initialized) return;

    this.isProcessing = true;

    try {
      // Get emails ready to send
      const emails = await EmailQueue.getReadyEmails(this.concurrency);

      if (emails.length === 0) {
        this.isProcessing = false;
        return;
      }

      log.info(`📧 Processing ${emails.length} queued email(s)`);

      // Process emails concurrently
      const results = await Promise.allSettled(
        emails.map(email => this.sendEmail(email))
      );

      // Log results
      const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failed = results.filter(r => r.status === 'rejected' || !r.value).length;

      if (sent > 0 || failed > 0) {
        log.info(`📧 Queue processed: ${sent} sent, ${failed} failed/retried`);
      }
    } catch (error) {
      log.error('❌ Email queue processing error:', { error: error });
    } finally {
      this.isProcessing = false;
    }
  }

  // Send a single email
  async sendEmail(emailDoc) {
    try {
      // Mark as processing
      emailDoc.status = 'processing';
      await emailDoc.save();

      // Build mail options
      const mailOptions = {
        from: emailDoc.from || `CareVision <${process.env.EMAIL_USER || 'noreply@carevision.com'}>`,
        to: emailDoc.to,
        subject: emailDoc.subject,
        html: emailDoc.html
      };

      if (emailDoc.text) {
        mailOptions.text = emailDoc.text;
      }

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      // Mark as sent
      emailDoc.markSent(info.messageId);
      await emailDoc.save();

      // Log preview URL in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('📧 Preview:', nodemailer.getTestMessageUrl(info));
      }

      return true;
    } catch (error) {
      // Mark as failed with retry
      emailDoc.markFailed(error);
      await emailDoc.save();

      log.error(`❌ Email failed (attempt ${emailDoc.attempts}/${emailDoc.maxAttempts}):`, error.message);

      // If permanently failed, could trigger notification
      if (emailDoc.status === 'failed') {
        log.error(`📧 Email permanently failed after ${emailDoc.attempts} attempts: ${emailDoc.to}`);
      }

      return false;
    }
  }

  // Enqueue an email (main entry point)
  async enqueue(options) {
    const {
      to,
      subject,
      html,
      text,
      template,
      data,
      priority = 5,
      context = 'other',
      relatedId,
      relatedModel,
      scheduledFor,
      createdBy
    } = options;

    // Build content from template or use provided
    let emailSubject = subject;
    let emailHtml = html;

    if (template && this.templates[template]) {
      const templateContent = this.templates[template](data);
      emailSubject = templateContent.subject;
      emailHtml = templateContent.html;
    }

    if (!emailSubject || !emailHtml) {
      throw new Error('Email must have subject and html content');
    }

    // Create queue entry
    const queueEntry = await EmailQueue.create({
      to,
      subject: emailSubject,
      html: emailHtml,
      text,
      template,
      templateData: data,
      priority,
      context,
      relatedId,
      relatedModel,
      scheduledFor: scheduledFor || new Date(),
      createdBy
    });

    // If high priority, trigger immediate processing
    if (priority <= 2) {
      setImmediate(() => this.processQueue());
    }

    return queueEntry;
  }

  // Convenience methods for common email types
  async sendVerificationEmail(to, data, userId) {
    return this.enqueue({
      to,
      template: 'emailVerification',
      data,
      priority: 2, // High priority
      context: 'auth',
      createdBy: userId
    });
  }

  async sendPasswordResetEmail(to, data, userId) {
    return this.enqueue({
      to,
      template: 'passwordReset',
      data,
      priority: 1, // Highest priority
      context: 'auth',
      createdBy: userId
    });
  }

  async sendAppointmentConfirmation(to, data, appointmentId, userId) {
    return this.enqueue({
      to,
      template: 'appointmentConfirmation',
      data,
      priority: 3,
      context: 'appointment',
      relatedId: appointmentId,
      relatedModel: 'Appointment',
      createdBy: userId
    });
  }

  async sendAppointmentReminder(to, data, appointmentId) {
    return this.enqueue({
      to,
      template: 'appointmentReminder',
      data,
      priority: 4,
      context: 'appointment',
      relatedId: appointmentId,
      relatedModel: 'Appointment'
    });
  }

  async sendPrescriptionReady(to, data, prescriptionId, userId) {
    return this.enqueue({
      to,
      template: 'prescriptionReady',
      data,
      priority: 4,
      context: 'prescription',
      relatedId: prescriptionId,
      relatedModel: 'Prescription',
      createdBy: userId
    });
  }

  // Get queue statistics
  async getStats() {
    return EmailQueue.getStats();
  }

  // Retry a failed email
  async retryEmail(emailId) {
    const email = await EmailQueue.findById(emailId);
    if (!email) throw new Error('Email not found');

    if (email.status !== 'failed') {
      throw new Error('Only failed emails can be retried');
    }

    email.status = 'pending';
    email.attempts = 0;
    email.nextAttempt = new Date();
    email.errorHistory = [];
    email.lastError = null;
    await email.save();

    // Trigger immediate processing
    setImmediate(() => this.processQueue());

    return email;
  }

  // Cancel a pending email
  async cancelEmail(emailId) {
    const email = await EmailQueue.findById(emailId);
    if (!email) throw new Error('Email not found');

    if (!['pending', 'failed'].includes(email.status)) {
      throw new Error('Only pending or failed emails can be cancelled');
    }

    email.status = 'cancelled';
    await email.save();

    return email;
  }

  // Clean up old emails
  async cleanup(daysOld = 30) {
    return EmailQueue.cleanupOld(daysOld);
  }
}

// Export singleton
module.exports = new EmailQueueService();
