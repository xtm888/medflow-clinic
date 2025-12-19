/**
 * Enhanced Notification Service
 *
 * @internal This is an INTERNAL implementation service.
 * For external use, import from notificationFacade.js instead:
 *   const notificationFacade = require('./notificationFacade');
 *
 * Provides robust multi-channel notifications with:
 * - SMS (Twilio, Africa's Talking)
 * - Email
 * - In-app notifications
 * - Retry logic
 * - Rate limiting
 * - Queue system
 * - Statistics tracking
 */

const sendEmail = require('../utils/sendEmail');
const CONSTANTS = require('../config/constants');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('EnhancedNotification');

class NotificationService {
  constructor() {
    // Provider instances
    this.smsProvider = null;
    this.smsProviderType = null;

    // Retry configuration
    this.maxRetries = CONSTANTS.NOTIFICATION.MAX_RETRY_ATTEMPTS;
    this.retryDelay = CONSTANTS.NOTIFICATION.RETRY_DELAY_MS;

    // Rate limiting counters
    this.smsCount = 0;
    this.emailCount = 0;
    this.smsResetTime = Date.now() + 3600000; // 1 hour
    this.emailResetTime = Date.now() + 3600000;

    // Statistics
    this.stats = {
      totalSMSSent: 0,
      totalSMSFailed: 0,
      totalEmailsSent: 0,
      totalEmailsFailed: 0,
      totalRetries: 0,
      rateLimitExceeded: 0
    };

    // Notification queue (in-memory, can be replaced with Redis/Bull)
    this.queue = [];
    this.processing = false;

    // Initialize providers
    this.initSMSProvider();
  }

  /**
   * Initialize SMS provider based on environment
   */
  initSMSProvider() {
    // Priority 1: Africa's Talking (recommended for DRC)
    if (process.env.SMS_PROVIDER === 'africastalking' || process.env.AFRICASTALKING_API_KEY) {
      try {
        const AfricasTalking = require('africastalking');
        const client = AfricasTalking({
          apiKey: process.env.AFRICASTALKING_API_KEY,
          username: process.env.AFRICASTALKING_USERNAME || 'sandbox'
        });
        this.smsProvider = client.SMS;
        this.smsProviderType = 'africastalking';
        log.info('✅ Africa\'s Talking SMS provider initialized');
      } catch (err) {
        log.warn('⚠️  Africa\'s Talking not available:', err.message);
      }
    }

    // Priority 2: Twilio (fallback)
    if (!this.smsProvider && process.env.SMS_PROVIDER === 'twilio' && process.env.TWILIO_ACCOUNT_SID) {
      try {
        const twilio = require('twilio');
        this.smsProvider = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        this.smsProviderType = 'twilio';
        log.info('✅ Twilio SMS provider initialized');
      } catch (err) {
        log.warn('⚠️  Twilio not available:', err.message);
      }
    }

    if (!this.smsProvider) {
      log.warn('⚠️  No SMS provider configured - SMS will be simulated');
      this.smsProviderType = 'simulated';
    }
  }

  /**
   * Check rate limits
   */
  checkRateLimit(type) {
    const now = Date.now();

    if (type === 'sms') {
      if (now > this.smsResetTime) {
        this.smsCount = 0;
        this.smsResetTime = now + 3600000;
      }

      if (this.smsCount >= CONSTANTS.NOTIFICATION.SMS_PER_HOUR_LIMIT) {
        this.stats.rateLimitExceeded++;
        return false;
      }
      return true;
    }

    if (type === 'email') {
      if (now > this.emailResetTime) {
        this.emailCount = 0;
        this.emailResetTime = now + 3600000;
      }

      if (this.emailCount >= CONSTANTS.NOTIFICATION.EMAIL_PER_HOUR_LIMIT) {
        this.stats.rateLimitExceeded++;
        return false;
      }
      return true;
    }

    return true;
  }

  /**
   * Format phone number for DRC
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;

    let formatted = phoneNumber.replace(/\s/g, '').replace(/-/g, '');

    // DRC country code is +243
    if (!formatted.startsWith('+')) {
      // Remove leading zero if present
      formatted = formatted.replace(/^0/, '');
      // Add DRC country code
      formatted = `+243${formatted}`;
    }

    // Validate format (basic check)
    if (!/^\+243\d{9}$/.test(formatted)) {
      log.warn(`Invalid DRC phone number format: ${phoneNumber}`);
      return null;
    }

    return formatted;
  }

  /**
   * Validate email address
   */
  validateEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send SMS with retry logic
   */
  async sendSMS(phoneNumber, message, options = {}) {
    const { maxRetries = this.maxRetries, priority = 'normal' } = options;

    // Validate phone number
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // Check rate limit
    if (!this.checkRateLimit('sms')) {
      return { success: false, error: 'SMS rate limit exceeded' };
    }

    // Truncate message if too long
    const truncatedMessage = message.length > CONSTANTS.NOTIFICATION.MAX_SMS_LENGTH
      ? `${message.substring(0, CONSTANTS.NOTIFICATION.MAX_SMS_LENGTH - 3)}...`
      : message;

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Wait before retry with exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          this.stats.totalRetries++;
        }

        let result;

        if (this.smsProviderType === 'africastalking') {
          result = await this.sendViAfricasTalking(formattedPhone, truncatedMessage);
        } else if (this.smsProviderType === 'twilio') {
          result = await this.sendViaTwilio(formattedPhone, truncatedMessage);
        } else {
          // Simulated mode
          result = this.simulateSMS(formattedPhone, truncatedMessage);
        }

        // Success
        this.smsCount++;
        this.stats.totalSMSSent++;
        log.info(`✅ SMS sent to ${formattedPhone} (attempt ${attempt + 1})`);
        return result;

      } catch (error) {
        lastError = error;
        log.warn(`⚠️  SMS attempt ${attempt + 1} failed:`, error.message);

        if (attempt === maxRetries) {
          this.stats.totalSMSFailed++;
          return { success: false, error: lastError.message, attempts: attempt + 1 };
        }
      }
    }

    this.stats.totalSMSFailed++;
    return { success: false, error: lastError?.message || 'Max retries exceeded' };
  }

  /**
   * Send via Africa's Talking
   */
  async sendViAfricasTalking(phoneNumber, message) {
    const result = await this.smsProvider.send({
      to: [phoneNumber],
      message: message,
      from: process.env.AFRICASTALKING_SHORTCODE || null
    });

    if (result.SMSMessageData.Recipients[0].status === 'Success') {
      return {
        success: true,
        provider: 'africastalking',
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    } else {
      throw new Error(result.SMSMessageData.Recipients[0].status);
    }
  }

  /**
   * Send via Twilio
   */
  async sendViaTwilio(phoneNumber, message) {
    const result = await this.smsProvider.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    return {
      success: true,
      provider: 'twilio',
      sid: result.sid,
      status: result.status
    };
  }

  /**
   * Simulate SMS (no provider configured)
   */
  simulateSMS(phoneNumber, message) {
    log.info(`[SMS SIMULATED] To: ${phoneNumber}, Message: ${message}`);
    return {
      success: true,
      provider: 'simulated',
      simulated: true
    };
  }

  /**
   * Send Email with retry logic
   */
  async sendEmailNotification(to, subject, template, context, options = {}) {
    const { maxRetries = this.maxRetries } = options;

    // Validate email
    if (!this.validateEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    // Check rate limit
    if (!this.checkRateLimit('email')) {
      return { success: false, error: 'Email rate limit exceeded' };
    }

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          this.stats.totalRetries++;
        }

        await sendEmail({
          to,
          subject,
          template,
          context
        });

        // Success
        this.emailCount++;
        this.stats.totalEmailsSent++;
        log.info(`✅ Email sent to ${to} (attempt ${attempt + 1})`);
        return { success: true, attempts: attempt + 1 };

      } catch (error) {
        lastError = error;
        log.warn(`⚠️  Email attempt ${attempt + 1} failed:`, error.message);

        if (attempt === maxRetries) {
          this.stats.totalEmailsFailed++;
          return { success: false, error: lastError.message, attempts: attempt + 1 };
        }
      }
    }

    this.stats.totalEmailsFailed++;
    return { success: false, error: lastError?.message || 'Max retries exceeded' };
  }

  /**
   * Send bulk SMS (with rate limiting and queue)
   */
  async sendBulkSMS(recipients, message, options = {}) {
    const { batchSize = CONSTANTS.NOTIFICATION.MAX_SMS_BATCH_SIZE } = options;

    const results = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(recipient =>
          this.sendSMS(recipient.phoneNumber, message)
            .catch(error => ({ success: false, error: error.message, recipient }))
        )
      );

      results.push(...batchResults);

      // Delay between batches to respect rate limits
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    log.info(`📊 Bulk SMS complete: ${successCount} sent, ${failureCount} failed`);

    return {
      total: recipients.length,
      successful: successCount,
      failed: failureCount,
      results
    };
  }

  /**
   * Queue notification for later sending
   */
  queueNotification(type, data) {
    this.queue.push({
      type,
      data,
      queuedAt: new Date(),
      attempts: 0
    });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process queued notifications
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const item = this.queue.shift();

    try {
      if (item.type === 'sms') {
        await this.sendSMS(item.data.phoneNumber, item.data.message);
      } else if (item.type === 'email') {
        await this.sendEmailNotification(
          item.data.to,
          item.data.subject,
          item.data.template,
          item.data.context
        );
      }
    } catch (error) {
      log.error('Queue processing error:', { error: error });
      // Requeue with attempt tracking
      if (item.attempts < this.maxRetries) {
        item.attempts++;
        this.queue.push(item);
      }
    }

    // Process next item after delay
    setTimeout(() => this.processQueue(), 100);
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      smsRateLimit: {
        count: this.smsCount,
        limit: CONSTANTS.NOTIFICATION.SMS_PER_HOUR_LIMIT,
        resetIn: this.smsResetTime - Date.now()
      },
      emailRateLimit: {
        count: this.emailCount,
        limit: CONSTANTS.NOTIFICATION.EMAIL_PER_HOUR_LIMIT,
        resetIn: this.emailResetTime - Date.now()
      },
      provider: this.smsProviderType
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalSMSSent: 0,
      totalSMSFailed: 0,
      totalEmailsSent: 0,
      totalEmailsFailed: 0,
      totalRetries: 0,
      rateLimitExceeded: 0
    };
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;
