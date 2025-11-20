const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.init();
  }

  init() {
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.initialized = true;
        console.log('✅ SMS service initialized successfully');
      } else {
        console.warn('⚠️ SMS service not configured - missing Twilio credentials');
      }
    } catch (error) {
      console.error('❌ SMS service initialization failed:', error.message);
      this.initialized = false;
    }
  }

  // Format phone number for international SMS
  formatPhoneNumber(phoneNumber, countryCode = '+243') {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If number doesn't start with country code, add it
    if (!phoneNumber.startsWith('+')) {
      // If number starts with 0, remove it
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      return `${countryCode}${cleaned}`;
    }

    return phoneNumber;
  }

  // Send appointment confirmation SMS
  async sendAppointmentConfirmation(phoneNumber, appointmentData) {
    if (!this.initialized) {
      console.warn('SMS service not initialized');
      return false;
    }

    const { patientName, date, time, provider, appointmentId } = appointmentData;
    const formattedDate = new Date(date).toLocaleDateString('fr-FR');

    const message = `CareVision: Bonjour ${patientName}, votre RDV du ${formattedDate} à ${time} avec Dr. ${provider} est confirmé. Réf: ${appointmentId}`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send appointment reminder SMS
  async sendAppointmentReminder(phoneNumber, appointmentData) {
    if (!this.initialized) return false;

    const { patientName, time, provider } = appointmentData;

    const message = `CareVision: Rappel - ${patientName}, vous avez RDV demain à ${time} avec Dr. ${provider}. Merci d'arriver 15 min en avance.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send queue notification SMS
  async sendQueueNotification(phoneNumber, queueData) {
    if (!this.initialized) return false;

    const { patientName, queueNumber, estimatedWaitTime } = queueData;

    const message = `CareVision: ${patientName}, votre numéro est ${queueNumber}. Temps d'attente estimé: ${estimatedWaitTime} min. Nous vous appellerons bientôt.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send patient called SMS
  async sendPatientCalledNotification(phoneNumber, callData) {
    if (!this.initialized) return false;

    const { patientName, roomNumber } = callData;

    const message = `CareVision: ${patientName}, c'est votre tour! Veuillez vous diriger vers la salle ${roomNumber}.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send prescription ready SMS
  async sendPrescriptionReady(phoneNumber, prescriptionData) {
    if (!this.initialized) return false;

    const { patientName, prescriptionId } = prescriptionData;

    const message = `CareVision: ${patientName}, votre ordonnance ${prescriptionId} est prête. Vous pouvez la retirer à la pharmacie.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send lab results ready SMS
  async sendLabResultsReady(phoneNumber, labData) {
    if (!this.initialized) return false;

    const { patientName, testCount } = labData;

    const message = `CareVision: ${patientName}, vos ${testCount} résultats de laboratoire sont disponibles. Connectez-vous au portail patient ou passez les récupérer.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send payment reminder SMS
  async sendPaymentReminder(phoneNumber, paymentData) {
    if (!this.initialized) return false;

    const { patientName, amount, dueDate } = paymentData;
    const formattedDate = new Date(dueDate).toLocaleDateString('fr-FR');

    const message = `CareVision: ${patientName}, rappel de paiement de $${amount} dû le ${formattedDate}. Merci de régler votre facture.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send verification code SMS
  async sendVerificationCode(phoneNumber, code) {
    if (!this.initialized) return false;

    const message = `CareVision: Votre code de vérification est ${code}. Valide pendant 10 minutes. Ne le partagez avec personne.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send emergency alert SMS
  async sendEmergencyAlert(phoneNumber, alertData) {
    if (!this.initialized) return false;

    const { alertType, location, severity } = alertData;

    const message = `URGENT CareVision: ${alertType} - Niveau ${severity}. Lieu: ${location}. Action requise immédiatement.`;

    return this.sendSMS(phoneNumber, message);
  }

  // Send custom SMS
  async sendCustomSMS(phoneNumber, message) {
    if (!this.initialized) return false;

    // Add prefix if not present
    if (!message.startsWith('CareVision:')) {
      message = `CareVision: ${message}`;
    }

    return this.sendSMS(phoneNumber, message);
  }

  // Core SMS sending function
  async sendSMS(to, body) {
    if (!this.initialized) {
      console.warn('Cannot send SMS - service not initialized');
      return false;
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);

      // Truncate message if too long (SMS limit is 160 characters)
      if (body.length > 160) {
        body = body.substring(0, 157) + '...';
      }

      const message = await this.client.messages.create({
        body,
        to: formattedNumber,
        from: this.fromNumber
      });

      console.log(`SMS sent successfully: ${message.sid}`);
      return {
        success: true,
        messageId: message.sid,
        to: formattedNumber,
        status: message.status
      };
    } catch (error) {
      console.error('Failed to send SMS:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send bulk SMS (for announcements)
  async sendBulkSMS(phoneNumbers, message) {
    if (!this.initialized) return [];

    const results = [];

    for (const phoneNumber of phoneNumbers) {
      const result = await this.sendSMS(phoneNumber, message);
      results.push({
        phoneNumber,
        ...result
      });

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  // Check SMS delivery status
  async checkDeliveryStatus(messageId) {
    if (!this.initialized) return null;

    try {
      const message = await this.client.messages(messageId).fetch();
      return {
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
      };
    } catch (error) {
      console.error('Failed to check SMS status:', error.message);
      return null;
    }
  }

  // Get SMS usage statistics
  async getUsageStats(startDate, endDate) {
    if (!this.initialized) return null;

    try {
      const messages = await this.client.messages.list({
        dateSentAfter: startDate,
        dateSentBefore: endDate,
        from: this.fromNumber
      });

      const stats = {
        total: messages.length,
        sent: messages.filter(m => m.status === 'sent').length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        failed: messages.filter(m => m.status === 'failed').length,
        undelivered: messages.filter(m => m.status === 'undelivered').length
      };

      return stats;
    } catch (error) {
      console.error('Failed to get SMS stats:', error.message);
      return null;
    }
  }

  // Test SMS configuration
  async testConnection(testPhoneNumber) {
    if (!this.initialized) {
      return {
        success: false,
        message: 'SMS service not initialized - check Twilio credentials'
      };
    }

    try {
      const result = await this.sendSMS(
        testPhoneNumber,
        'CareVision: Test SMS - Configuration successful!'
      );

      if (result.success) {
        return {
          success: true,
          message: 'SMS service is configured correctly',
          messageId: result.messageId
        };
      } else {
        return {
          success: false,
          message: result.error
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new SMSService();