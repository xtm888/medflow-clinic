const nodemailer = require('nodemailer');

// Email validation regex (RFC 5322 compliant, simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321 max length
  return EMAIL_REGEX.test(email.trim());
};

const sendEmail = async (options) => {
  // CRITICAL FIX: Validate email address before attempting to send
  if (!options.to) {
    throw new Error('Email recipient (to) is required');
  }

  // Handle both single email and array of emails
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const invalidEmails = recipients.filter(email => !isValidEmail(email));

  if (invalidEmails.length > 0) {
    console.error(`[EMAIL] Invalid email addresses detected: ${invalidEmails.join(', ')}`);
    throw new Error(`Invalid email address(es): ${invalidEmails.join(', ')}`);
  }

  // Create transporter
  let transporter;

  if (process.env.NODE_ENV === 'production') {
    // Production email service configuration
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Development: Use Ethereal Email for testing
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }

  // Email templates
  const templates = {
    emailVerification: (data) => ({
      subject: 'Email Verification - MedFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Email Verification</h1>
          <p>Hello ${data.name},</p>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${data.verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>If you didn't create this account, please ignore this email.</p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `
    }),
    passwordReset: (data) => ({
      subject: 'Password Reset Request - MedFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Password Reset</h1>
          <p>Hello ${data.name},</p>
          <p>You requested to reset your password. Click the link below to proceed:</p>
          <a href="${data.resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 10 minutes.</p>
        </div>
      `
    }),
    appointmentConfirmation: (data) => ({
      subject: 'Appointment Confirmation - MedFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Appointment Confirmed</h1>
          <p>Dear ${data.patientName},</p>
          <p>Your appointment has been confirmed:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
            <p><strong>Date:</strong> ${data.date}</p>
            <p><strong>Time:</strong> ${data.time}</p>
            <p><strong>Provider:</strong> ${data.provider}</p>
            <p><strong>Department:</strong> ${data.department}</p>
            <p><strong>Location:</strong> ${data.location}</p>
          </div>
          <p>Please arrive 15 minutes early for check-in.</p>
          <p>If you need to reschedule, please contact us at least 24 hours in advance.</p>
        </div>
      `
    }),
    appointmentReminder: (data) => ({
      subject: 'Appointment Reminder - MedFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Appointment Reminder</h1>
          <p>Dear ${data.patientName},</p>
          <p>This is a reminder about your upcoming appointment:</p>
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border: 1px solid #ffc107;">
            <p><strong>Date:</strong> ${data.date}</p>
            <p><strong>Time:</strong> ${data.time}</p>
            <p><strong>Provider:</strong> ${data.provider}</p>
            <p><strong>Department:</strong> ${data.department}</p>
          </div>
          ${data.preparation ? `
          <div style="margin-top: 20px;">
            <h3>Preparation Instructions:</h3>
            <p>${data.preparation}</p>
          </div>
          ` : ''}
        </div>
      `
    }),
    prescriptionReady: (data) => ({
      subject: 'Prescription Ready - MedFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Prescription Ready</h1>
          <p>Dear ${data.patientName},</p>
          <p>Your prescription is ready for pickup:</p>
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; border: 1px solid #28a745;">
            <p><strong>Prescription ID:</strong> ${data.prescriptionId}</p>
            <p><strong>Medication(s):</strong> ${data.medications}</p>
            <p><strong>Pharmacy:</strong> ${data.pharmacy}</p>
          </div>
          <p>Please bring your ID when picking up your prescription.</p>
        </div>
      `
    })
  };

  // Get template or use custom
  let emailContent;
  if (options.template && templates[options.template]) {
    emailContent = templates[options.template](options.data);
  } else {
    emailContent = {
      subject: options.subject,
      text: options.text,
      html: options.html
    };
  }

  // Email options
  const mailOptions = {
    from: `MedFlow <${process.env.EMAIL_USER || 'noreply@medflow.com'}>`,
    to: options.to,
    ...emailContent
  };

  // Send email
  const info = await transporter.sendMail(mailOptions);

  if (process.env.NODE_ENV !== 'production') {
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }

  return info;
};

module.exports = sendEmail;
