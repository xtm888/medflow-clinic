/**
 * Email Service
 *
 * @internal This is an INTERNAL implementation service used by notificationFacade.
 * For external use, import from notificationFacade.js instead:
 *   const notificationFacade = require('./notificationFacade');
 *
 * Provides direct email sending with:
 * - Template rendering
 * - Attachment support
 * - HTML/text content
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Email');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      // Create transporter with environment variables
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      log.info('✅ Email service initialized successfully');
    } catch (error) {
      log.error('❌ Email service initialization failed:', error.message);
      this.initialized = false;
    }
  }

  // Send appointment confirmation email
  async sendAppointmentConfirmation(recipient, appointmentData) {
    if (!this.initialized) {
      log.warn('Email service not initialized');
      return false;
    }

    const { patientName, date, time, provider, location, appointmentId } = appointmentData;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Confirmation de Rendez-vous</h2>
        <p>Bonjour ${patientName},</p>
        <p>Votre rendez-vous a été confirmé avec les détails suivants:</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Date:</strong> ${new Date(date).toLocaleDateString('fr-FR')}</p>
          <p><strong>Heure:</strong> ${time}</p>
          <p><strong>Médecin:</strong> Dr. ${provider}</p>
          <p><strong>Lieu:</strong> ${location || 'Clinique CareVision'}</p>
          <p><strong>Numéro de confirmation:</strong> ${appointmentId}</p>
        </div>

        <p style="color: #e74c3c;"><strong>Important:</strong> Veuillez arriver 15 minutes avant votre rendez-vous.</p>

        <p>Si vous devez annuler ou reporter votre rendez-vous, veuillez nous contacter au moins 24 heures à l'avance.</p>

        <hr style="border: 1px solid #ecf0f1; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 12px;">
          CareVision Medical Center<br>
          Email: contact@carevision.com<br>
          Tél: +243 900 000 000
        </p>
      </div>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: `"CareVision Medical" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: `Confirmation de rendez-vous - ${new Date(date).toLocaleDateString('fr-FR')}`,
        html: htmlContent
      });

      console.log('Appointment confirmation email sent:', info.messageId);
      return true;
    } catch (error) {
      log.error('Failed to send appointment email:', { error: error });
      return false;
    }
  }

  // Send appointment reminder email
  async sendAppointmentReminder(recipient, appointmentData) {
    if (!this.initialized) return false;

    const { patientName, date, time, provider } = appointmentData;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f39c12;">Rappel de Rendez-vous</h2>
        <p>Bonjour ${patientName},</p>
        <p>Ceci est un rappel de votre rendez-vous demain:</p>

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12;">
          <p><strong>Date:</strong> ${new Date(date).toLocaleDateString('fr-FR')}</p>
          <p><strong>Heure:</strong> ${time}</p>
          <p><strong>Médecin:</strong> Dr. ${provider}</p>
        </div>

        <p>N'oubliez pas d'apporter:</p>
        <ul>
          <li>Votre carte d'identité</li>
          <li>Votre carte d'assurance (si applicable)</li>
          <li>Vos médicaments actuels</li>
          <li>Résultats d'examens récents</li>
        </ul>

        <p>À demain!</p>

        <hr style="border: 1px solid #ecf0f1; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 12px;">CareVision Medical Center</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"CareVision Reminders" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: `Rappel: Rendez-vous demain à ${time}`,
        html: htmlContent
      });
      return true;
    } catch (error) {
      log.error('Failed to send reminder email:', { error: error });
      return false;
    }
  }

  // Send prescription ready notification
  async sendPrescriptionReady(recipient, prescriptionData) {
    if (!this.initialized) return false;

    const { patientName, prescriptionId, medications } = prescriptionData;

    const medicationList = medications.map(med =>
      `<li>${med.name} - ${med.dosage}</li>`
    ).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">Ordonnance Prête</h2>
        <p>Bonjour ${patientName},</p>
        <p>Votre ordonnance est prête à être retirée à la pharmacie.</p>

        <div style="background: #d5f4e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Numéro d'ordonnance:</strong> ${prescriptionId}</p>
          <p><strong>Médicaments prescrits:</strong></p>
          <ul>${medicationList}</ul>
        </div>

        <p>Veuillez vous présenter à la pharmacie avec votre carte d'identité.</p>

        <p style="color: #7f8c8d; font-size: 14px;">
          <em>Note: Cette ordonnance est valable pour 30 jours à compter de la date de prescription.</em>
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"CareVision Pharmacy" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: 'Votre ordonnance est prête',
        html: htmlContent
      });
      return true;
    } catch (error) {
      log.error('Failed to send prescription email:', { error: error });
      return false;
    }
  }

  // Send lab results ready notification
  async sendLabResultsReady(recipient, labData) {
    if (!this.initialized) return false;

    const { patientName, testNames, visitId } = labData;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3498db;">Résultats de Laboratoire Disponibles</h2>
        <p>Bonjour ${patientName},</p>
        <p>Les résultats de vos analyses sont maintenant disponibles.</p>

        <div style="background: #e8f6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Tests effectués:</strong></p>
          <ul>
            ${testNames.map(test => `<li>${test}</li>`).join('')}
          </ul>
        </div>

        <p>Vous pouvez:</p>
        <ul>
          <li>Consulter vos résultats en ligne via le portail patient</li>
          <li>Demander une copie papier à la réception</li>
          <li>Prendre rendez-vous avec votre médecin pour discuter des résultats</li>
        </ul>

        <p>Référence: ${visitId}</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"CareVision Laboratory" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: 'Vos résultats de laboratoire sont disponibles',
        html: htmlContent
      });
      return true;
    } catch (error) {
      log.error('Failed to send lab results email:', { error: error });
      return false;
    }
  }

  // Send invoice
  async sendInvoice(recipient, invoiceData) {
    if (!this.initialized) return false;

    const { patientName, invoiceNumber, amount, dueDate, items } = invoiceData;

    const itemsList = items.map(item =>
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.amount.toFixed(2)}</td>
      </tr>`
    ).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Facture</h2>
        <p>Bonjour ${patientName},</p>
        <p>Veuillez trouver ci-dessous votre facture:</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Numéro de facture:</strong> ${invoiceNumber}</p>
          <p><strong>Date d'échéance:</strong> ${new Date(dueDate).toLocaleDateString('fr-FR')}</p>

          <table style="width: 100%; margin: 20px 0;">
            <thead>
              <tr style="background: #e9ecef;">
                <th style="padding: 8px; text-align: left;">Description</th>
                <th style="padding: 8px; text-align: right;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
            <tfoot>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Total</td>
                <td style="padding: 8px; text-align: right; font-weight: bold;">$${amount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p>Modes de paiement acceptés:</p>
        <ul>
          <li>En personne à la réception</li>
          <li>Par virement bancaire</li>
          <li>Via le portail patient en ligne</li>
        </ul>

        <p style="color: #e74c3c;">Veuillez effectuer le paiement avant le ${new Date(dueDate).toLocaleDateString('fr-FR')}.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"CareVision Billing" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: `Facture ${invoiceNumber} - Montant: $${amount.toFixed(2)}`,
        html: htmlContent
      });
      return true;
    } catch (error) {
      log.error('Failed to send invoice email:', { error: error });
      return false;
    }
  }

  // Send password reset email
  async sendPasswordReset(recipient, resetData) {
    if (!this.initialized) return false;

    const { userName, resetLink, expiresIn } = resetData;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Réinitialisation du Mot de Passe</h2>
        <p>Bonjour ${userName},</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>

        <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
          <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe:</p>
          <p style="margin: 20px 0;">
            <a href="${resetLink}" style="background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Réinitialiser le mot de passe
            </a>
          </p>
          <p style="font-size: 12px; color: #7f8c8d;">
            Ce lien expirera dans ${expiresIn} heures.
          </p>
        </div>

        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>

        <p style="color: #7f8c8d; font-size: 12px;">
          Pour des raisons de sécurité, ce lien ne peut être utilisé qu'une seule fois.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"CareVision Security" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: 'Réinitialisation de votre mot de passe CareVision',
        html: htmlContent
      });
      return true;
    } catch (error) {
      log.error('Failed to send password reset email:', { error: error });
      return false;
    }
  }

  // Send welcome email for new patients
  async sendWelcomeEmail(recipient, patientData) {
    if (!this.initialized) return false;

    const { patientName, patientId, temporaryPassword } = patientData;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">Bienvenue chez CareVision!</h2>
        <p>Bonjour ${patientName},</p>
        <p>Votre compte patient a été créé avec succès.</p>

        <div style="background: #d5f4e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Votre identifiant patient:</strong> ${patientId}</p>
          ${temporaryPassword ? `<p><strong>Mot de passe temporaire:</strong> ${temporaryPassword}</p>` : ''}
        </div>

        <p>Avec votre compte patient, vous pouvez:</p>
        <ul>
          <li>Prendre des rendez-vous en ligne</li>
          <li>Consulter vos ordonnances</li>
          <li>Accéder à vos résultats de laboratoire</li>
          <li>Voir l'historique de vos visites</li>
          <li>Payer vos factures en ligne</li>
        </ul>

        <p>
          <a href="${process.env.FRONTEND_URL}/patient/login" style="background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Accéder au portail patient
          </a>
        </p>

        <p>Nous sommes ravis de vous accueillir!</p>

        <hr style="border: 1px solid #ecf0f1; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 12px;">
          CareVision Medical Center<br>
          Votre santé, notre priorité
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"CareVision Welcome" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: 'Bienvenue chez CareVision Medical Center',
        html: htmlContent
      });
      return true;
    } catch (error) {
      log.error('Failed to send welcome email:', { error: error });
      return false;
    }
  }

  // Test email configuration
  async testConnection() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'Email service is configured correctly' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new EmailService();
