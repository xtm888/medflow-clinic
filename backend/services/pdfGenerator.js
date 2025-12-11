/**
 * PDF Generator Service
 * Server-side PDF generation for invoices, receipts, and statements
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGeneratorService {
  constructor() {
    this.defaultOptions = {
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Producer: 'MedFlow EMR',
        Creator: 'MedFlow Billing System'
      }
    };

    this.colors = {
      primary: '#2563eb',
      secondary: '#64748b',
      success: '#16a34a',
      danger: '#dc2626',
      text: '#1e293b',
      lightText: '#64748b',
      border: '#e2e8f0',
      background: '#f8fafc'
    };

    this.clinicInfo = {
      name: process.env.CLINIC_NAME || 'Cabinet Médical',
      address: process.env.CLINIC_ADDRESS || 'Kinshasa, RD Congo',
      phone: process.env.CLINIC_PHONE || '+243 XXX XXX XXX',
      email: process.env.CLINIC_EMAIL || 'contact@cabinet.cd',
      website: process.env.CLINIC_WEBSITE || 'www.cabinet.cd',
      taxId: process.env.CLINIC_TAX_ID || 'NIF: XXXXXXXX',
      logo: process.env.CLINIC_LOGO_PATH
    };
  }

  /**
   * Generate Invoice PDF
   */
  async generateInvoicePDF(invoice) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'FACTURE');

        // Invoice details
        doc.moveDown(2);
        this.addInvoiceDetails(doc, invoice);

        // Patient info
        doc.moveDown(1);
        this.addPatientInfo(doc, invoice.patient);

        // Items table
        doc.moveDown(2);
        this.addItemsTable(doc, invoice.items);

        // Summary
        doc.moveDown(1);
        this.addInvoiceSummary(doc, invoice.summary);

        // Payment info
        if (invoice.payments && invoice.payments.length > 0) {
          doc.moveDown(1);
          this.addPaymentHistory(doc, invoice.payments);
        }

        // Footer
        this.addFooter(doc, invoice);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Receipt PDF
   */
  async generateReceiptPDF(payment, invoice, patient) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          size: [226, 350] // Thermal receipt size (80mm x ~140mm)
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const centerX = 113;

        // Header
        doc.fontSize(12).font('Helvetica-Bold')
          .text(this.clinicInfo.name, { align: 'center' });
        doc.fontSize(8).font('Helvetica')
          .text(this.clinicInfo.address, { align: 'center' })
          .text(`Tel: ${this.clinicInfo.phone}`, { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Bold')
          .text('RECU DE PAIEMENT', { align: 'center' });

        // Divider
        doc.moveDown(0.5);
        doc.strokeColor(this.colors.border).lineWidth(0.5)
          .moveTo(10, doc.y).lineTo(216, doc.y).stroke();

        // Receipt details
        doc.moveDown(0.5);
        doc.fontSize(8).font('Helvetica');
        doc.text(`N° Recu: ${payment.paymentId}`, { align: 'left' });
        doc.text(`Date: ${this.formatDate(payment.date)}`, { align: 'left' });
        doc.text(`Facture: ${invoice.invoiceId}`, { align: 'left' });

        // Patient
        doc.moveDown(0.5);
        doc.text(`Patient: ${patient.firstName} ${patient.lastName}`);
        doc.text(`ID: ${patient.patientId}`);

        // Divider
        doc.moveDown(0.5);
        doc.strokeColor(this.colors.border)
          .moveTo(10, doc.y).lineTo(216, doc.y).stroke();

        // Amount
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold')
          .text(`MONTANT: ${this.formatCurrency(payment.amount)}`, { align: 'center' });

        doc.fontSize(8).font('Helvetica')
          .text(`Mode: ${this.translatePaymentMethod(payment.method)}`, { align: 'center' });

        if (payment.reference) {
          doc.text(`Ref: ${payment.reference}`, { align: 'center' });
        }

        // Balance
        doc.moveDown(1);
        const balance = invoice.summary.amountDue - payment.amount;
        doc.text(`Solde restant: ${this.formatCurrency(Math.max(0, balance))}`, { align: 'center' });

        // Footer
        doc.moveDown(1);
        doc.strokeColor(this.colors.border)
          .moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(7)
          .text('Merci de votre confiance', { align: 'center' })
          .text(this.clinicInfo.website, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Statement PDF
   */
  async generateStatementPDF(patient, invoices, dateRange) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'RELEVE DE COMPTE');

        // Statement period
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica')
          .text(`Periode: ${this.formatDate(dateRange.start)} - ${this.formatDate(dateRange.end)}`);

        // Patient info
        doc.moveDown(1);
        this.addPatientInfo(doc, patient);

        // Account summary
        doc.moveDown(2);
        const totals = this.calculateStatementTotals(invoices);

        doc.fontSize(11).font('Helvetica-Bold').text('Resume du compte');
        doc.moveDown(0.5);

        const summaryStartY = doc.y;
        doc.rect(50, summaryStartY, 495, 80).fill(this.colors.background);

        doc.fillColor(this.colors.text).fontSize(10).font('Helvetica');
        doc.text(`Solde precedent:`, 60, summaryStartY + 10);
        doc.text(this.formatCurrency(totals.previousBalance), 400, summaryStartY + 10, { align: 'right', width: 130 });

        doc.text(`Nouveaux frais:`, 60, summaryStartY + 28);
        doc.text(this.formatCurrency(totals.newCharges), 400, summaryStartY + 28, { align: 'right', width: 130 });

        doc.text(`Paiements recus:`, 60, summaryStartY + 46);
        doc.fillColor(this.colors.success)
          .text(`-${this.formatCurrency(totals.payments)}`, 400, summaryStartY + 46, { align: 'right', width: 130 });

        doc.fillColor(this.colors.text).font('Helvetica-Bold')
          .text(`SOLDE DU:`, 60, summaryStartY + 64);
        doc.fillColor(totals.balance > 0 ? this.colors.danger : this.colors.success)
          .text(this.formatCurrency(totals.balance), 400, summaryStartY + 64, { align: 'right', width: 130 });

        // Transactions table
        doc.moveDown(6);
        this.addStatementTransactions(doc, invoices);

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Insurance Claim Form PDF
   */
  async generateClaimFormPDF(claim) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'DEMANDE DE REMBOURSEMENT');

        // Claim info
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica');
        doc.text(`N° Demande: ${claim.claimNumber}`);
        doc.text(`Date: ${this.formatDate(claim.createdAt)}`);

        // Insurance info
        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica-Bold').text('Informations Assurance');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Assureur: ${claim.provider.name}`);
        doc.text(`N° Police: ${claim.provider.policyNumber}`);
        if (claim.provider.groupNumber) {
          doc.text(`N° Groupe: ${claim.provider.groupNumber}`);
        }
        doc.text(`N° Assure: ${claim.provider.memberId || '-'}`);

        // Patient info
        doc.moveDown(1);
        this.addPatientInfo(doc, claim.patient);

        // Services table
        doc.moveDown(2);
        this.addClaimServicesTable(doc, claim.services);

        // Amounts
        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica-Bold').text('Montants');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total facture: ${this.formatCurrency(claim.amounts.totalCharged)}`);
        doc.text(`Montant demande: ${this.formatCurrency(claim.amounts.totalClaimed)}`);

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Helper methods

  addHeader(doc, title) {
    // Logo (if exists)
    if (this.clinicInfo.logo && fs.existsSync(this.clinicInfo.logo)) {
      doc.image(this.clinicInfo.logo, 50, 45, { width: 100 });
    }

    // Clinic info
    doc.fontSize(14).font('Helvetica-Bold')
      .fillColor(this.colors.primary)
      .text(this.clinicInfo.name, 350, 45, { align: 'right', width: 195 });

    doc.fontSize(9).font('Helvetica')
      .fillColor(this.colors.lightText)
      .text(this.clinicInfo.address, 350, 62, { align: 'right', width: 195 })
      .text(`Tel: ${this.clinicInfo.phone}`, 350, 74, { align: 'right', width: 195 })
      .text(this.clinicInfo.email, 350, 86, { align: 'right', width: 195 });

    // Title
    doc.moveDown(4);
    doc.fontSize(18).font('Helvetica-Bold')
      .fillColor(this.colors.text)
      .text(title, { align: 'center' });

    // Divider
    doc.moveDown(0.5);
    doc.strokeColor(this.colors.primary).lineWidth(2)
      .moveTo(200, doc.y).lineTo(395, doc.y).stroke();
  }

  addInvoiceDetails(doc, invoice) {
    const detailsY = doc.y;

    // Left column
    doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
      .text('Facture N°:', 50, detailsY);
    doc.font('Helvetica').text(invoice.invoiceId, 130, detailsY);

    doc.font('Helvetica-Bold').text('Date:', 50, detailsY + 15);
    doc.font('Helvetica').text(this.formatDate(invoice.dateIssued), 130, detailsY + 15);

    doc.font('Helvetica-Bold').text('Echeance:', 50, detailsY + 30);
    doc.font('Helvetica').text(this.formatDate(invoice.dueDate), 130, detailsY + 30);

    // Right column - Status
    const statusColors = {
      paid: this.colors.success,
      partial: '#f59e0b',
      overdue: this.colors.danger,
      issued: this.colors.primary
    };

    doc.fontSize(12).font('Helvetica-Bold')
      .fillColor(statusColors[invoice.status] || this.colors.secondary)
      .text(this.translateStatus(invoice.status), 400, detailsY, { align: 'right', width: 145 });
  }

  addPatientInfo(doc, patient) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.text)
      .text('Patient');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica')
      .text(`${patient.firstName} ${patient.lastName}`)
      .text(`ID: ${patient.patientId}`);
    if (patient.phoneNumber) {
      doc.text(`Tel: ${patient.phoneNumber}`);
    }
    if (patient.email) {
      doc.text(`Email: ${patient.email}`);
    }
  }

  addItemsTable(doc, items) {
    const tableTop = doc.y;
    const tableHeaders = ['Description', 'Qte', 'Prix unit.', 'Remise', 'Total'];
    const columnWidths = [220, 40, 80, 70, 85];
    const columnX = [50, 270, 310, 390, 460];

    // Header background
    doc.rect(50, tableTop, 495, 25).fill(this.colors.primary);

    // Headers
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, columnX[i] + 5, tableTop + 8, { width: columnWidths[i] - 10 });
    });

    // Items
    let y = tableTop + 30;
    doc.fillColor(this.colors.text).font('Helvetica');

    items.forEach((item, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(50, y - 3, 495, 22).fill(this.colors.background);
        doc.fillColor(this.colors.text);
      }

      doc.fontSize(9);
      doc.text(item.description, columnX[0] + 5, y, { width: columnWidths[0] - 10 });
      doc.text(item.quantity.toString(), columnX[1] + 5, y, { width: columnWidths[1] - 10 });
      doc.text(this.formatCurrency(item.unitPrice), columnX[2] + 5, y, { width: columnWidths[2] - 10 });
      doc.text(this.formatCurrency(item.discount || 0), columnX[3] + 5, y, { width: columnWidths[3] - 10 });
      doc.text(this.formatCurrency(item.total), columnX[4] + 5, y, { width: columnWidths[4] - 10 });

      y += 22;
    });

    doc.y = y;
  }

  addInvoiceSummary(doc, summary) {
    const summaryX = 360;
    const valueX = 460;
    const width = 85;

    doc.fontSize(10).font('Helvetica').fillColor(this.colors.text);

    doc.text('Sous-total:', summaryX, doc.y);
    doc.text(this.formatCurrency(summary.subtotal), valueX, doc.y - 12, { width, align: 'right' });

    if (summary.discountTotal > 0) {
      doc.text('Remise:', summaryX, doc.y);
      doc.text(`-${this.formatCurrency(summary.discountTotal)}`, valueX, doc.y - 12, { width, align: 'right' });
    }

    if (summary.taxTotal > 0) {
      doc.text('TVA:', summaryX, doc.y);
      doc.text(this.formatCurrency(summary.taxTotal), valueX, doc.y - 12, { width, align: 'right' });
    }

    // Total line
    doc.moveDown(0.5);
    doc.strokeColor(this.colors.border).lineWidth(0.5)
      .moveTo(summaryX, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('TOTAL:', summaryX, doc.y);
    doc.text(this.formatCurrency(summary.total), valueX, doc.y - 14, { width, align: 'right' });

    if (summary.amountPaid > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor(this.colors.success);
      doc.text('Paye:', summaryX, doc.y);
      doc.text(this.formatCurrency(summary.amountPaid), valueX, doc.y - 12, { width, align: 'right' });
    }

    if (summary.amountDue > 0) {
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.danger);
      doc.text('RESTE A PAYER:', summaryX, doc.y);
      doc.text(this.formatCurrency(summary.amountDue), valueX, doc.y - 13, { width, align: 'right' });
    }
  }

  addPaymentHistory(doc, payments) {
    doc.fillColor(this.colors.text).fontSize(11).font('Helvetica-Bold')
      .text('Historique des paiements');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica');
    payments.forEach(payment => {
      if (payment.amount > 0) {
        doc.text(`${this.formatDate(payment.date)} - ${this.translatePaymentMethod(payment.method)}: ${this.formatCurrency(payment.amount)}`);
        if (payment.reference) {
          doc.fontSize(8).fillColor(this.colors.lightText)
            .text(`  Ref: ${payment.reference}`);
          doc.fillColor(this.colors.text).fontSize(9);
        }
      }
    });
  }

  addStatementTransactions(doc, invoices) {
    doc.fillColor(this.colors.text).fontSize(11).font('Helvetica-Bold')
      .text('Detail des transactions');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Solde'];
    const columnX = [50, 120, 330, 410, 490];

    // Header
    doc.rect(50, tableTop, 495, 20).fill(this.colors.primary);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, columnX[i] + 5, tableTop + 5);
    });

    // Transactions
    let y = tableTop + 25;
    let runningBalance = 0;

    doc.fillColor(this.colors.text).font('Helvetica');

    invoices.forEach(inv => {
      // Invoice entry
      runningBalance += inv.summary.total;
      doc.fontSize(9);
      doc.text(this.formatDate(inv.dateIssued), columnX[0], y);
      doc.text(`Facture ${inv.invoiceId}`, columnX[1], y);
      doc.text(this.formatCurrency(inv.summary.total), columnX[2], y);
      doc.text('-', columnX[3], y);
      doc.text(this.formatCurrency(runningBalance), columnX[4], y);
      y += 15;

      // Payment entries
      if (inv.payments) {
        inv.payments.forEach(pmt => {
          if (pmt.amount > 0) {
            runningBalance -= pmt.amount;
            doc.fillColor(this.colors.success);
            doc.text(this.formatDate(pmt.date), columnX[0], y);
            doc.text(`Paiement - ${this.translatePaymentMethod(pmt.method)}`, columnX[1], y);
            doc.text('-', columnX[2], y);
            doc.text(this.formatCurrency(pmt.amount), columnX[3], y);
            doc.text(this.formatCurrency(runningBalance), columnX[4], y);
            doc.fillColor(this.colors.text);
            y += 15;
          }
        });
      }
    });

    doc.y = y;
  }

  addClaimServicesTable(doc, services) {
    doc.fillColor(this.colors.text).fontSize(11).font('Helvetica-Bold')
      .text('Services');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const headers = ['Code', 'Description', 'Date', 'Qte', 'Montant'];
    const columnX = [50, 100, 280, 380, 420];

    doc.rect(50, tableTop, 495, 20).fill(this.colors.primary);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, columnX[i] + 5, tableTop + 5);
    });

    let y = tableTop + 25;
    doc.fillColor(this.colors.text).font('Helvetica');

    services.forEach(service => {
      doc.fontSize(9);
      doc.text(service.code || '-', columnX[0], y);
      doc.text(service.description, columnX[1], y, { width: 175 });
      doc.text(this.formatDate(service.dateOfService), columnX[2], y);
      doc.text(service.units.toString(), columnX[3], y);
      doc.text(this.formatCurrency(service.claimedAmount), columnX[4], y);
      y += 20;
    });

    doc.y = y;
  }

  addFooter(doc, invoice = null) {
    const bottomY = doc.page.height - 80;

    doc.fontSize(8).fillColor(this.colors.lightText);

    // Payment instructions (if invoice has balance)
    if (invoice && invoice.summary?.amountDue > 0) {
      doc.text('Modes de paiement acceptes: Especes, Carte bancaire, Virement, Mobile Money', 50, bottomY - 30, { align: 'center', width: 495 });
    }

    // Footer line
    doc.strokeColor(this.colors.border).lineWidth(0.5)
      .moveTo(50, bottomY).lineTo(545, bottomY).stroke();

    // Footer text
    doc.text(`${this.clinicInfo.name} | ${this.clinicInfo.taxId} | ${this.clinicInfo.phone}`, 50, bottomY + 10, { align: 'center', width: 495 });
    doc.text('Document genere electroniquement - Merci de votre confiance', 50, bottomY + 22, { align: 'center', width: 495 });
  }

  // Utility functions

  formatCurrency(amount, currency = 'CDF') {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  translateStatus(status) {
    const translations = {
      draft: 'Brouillon',
      issued: 'Emise',
      sent: 'Envoyee',
      viewed: 'Vue',
      partial: 'Partiellement payee',
      paid: 'Payee',
      overdue: 'En retard',
      cancelled: 'Annulee',
      refunded: 'Remboursee'
    };
    return translations[status] || status;
  }

  translatePaymentMethod(method) {
    const translations = {
      cash: 'Especes',
      card: 'Carte bancaire',
      check: 'Cheque',
      'bank-transfer': 'Virement',
      'mobile-payment': 'Mobile Money',
      'orange-money': 'Orange Money',
      'mtn-money': 'MTN Money',
      insurance: 'Assurance',
      other: 'Autre'
    };
    return translations[method] || method;
  }

  calculateStatementTotals(invoices) {
    let newCharges = 0;
    let payments = 0;

    invoices.forEach(inv => {
      newCharges += inv.summary.total;
      payments += inv.summary.amountPaid;
    });

    return {
      previousBalance: 0, // Would be calculated from previous period
      newCharges,
      payments,
      balance: newCharges - payments
    };
  }

  /**
   * Generate Prescription PDF
   */
  async generatePrescriptionPDF(prescription) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          size: 'A5', // Smaller size for prescriptions
          margins: { top: 40, bottom: 40, left: 40, right: 40 }
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc);

        // Title
        doc.moveDown(2);
        doc.fontSize(16).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text('ORDONNANCE MEDICALE', { align: 'center' });
        doc.moveDown();

        // Prescription number and date
        doc.fontSize(10).font('Helvetica').fillColor(this.colors.text);
        doc.text(`N° ${prescription.prescriptionNumber || prescription._id?.toString().slice(-8).toUpperCase()}`, { align: 'right' });
        doc.text(`Date: ${this.formatDate(prescription.prescribedDate || prescription.createdAt)}`, { align: 'right' });
        doc.moveDown();

        // Patient info
        if (prescription.patient) {
          const patient = prescription.patient;
          doc.fontSize(11).font('Helvetica-Bold').text('Patient:');
          doc.font('Helvetica').text(`${patient.firstName} ${patient.lastName}`);
          if (patient.dateOfBirth) {
            const age = Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
            doc.text(`Age: ${age} ans`);
          }
          doc.moveDown();
        }

        // Medications
        doc.fontSize(11).font('Helvetica-Bold').text('Médicaments prescrits:');
        doc.moveDown(0.5);

        (prescription.medications || []).forEach((med, index) => {
          // Medication name with route and eye
          let medHeader = `${index + 1}. ${med.medication || med.name}`;
          if (med.route && med.route !== 'oral') {
            const routeLabels = {
              ophthalmic: 'Collyre',
              intravitreal: 'Intravitréen',
              subconjunctival: 'Sous-conjonctival',
              periocular: 'Périoculaire',
              intracameral: 'Intracaméral',
              topical: 'Topique',
              otic: 'Auriculaire',
              nasal: 'Nasal'
            };
            medHeader += ` (${routeLabels[med.route] || med.route})`;
          }
          if (med.applicationLocation?.eye) {
            medHeader += ` - ${med.applicationLocation.eye}`;
          }

          doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.primary)
            .text(medHeader);
          doc.font('Helvetica').fillColor(this.colors.text);
          if (med.dosage) doc.text(`   Dosage: ${med.dosage}`);
          if (med.frequency) doc.text(`   Fréquence: ${med.frequency}`);
          if (med.duration) doc.text(`   Durée: ${med.duration}`);
          if (med.instructions) doc.text(`   Instructions: ${med.instructions}`);

          // Tapering schedule if present
          if (med.tapering?.enabled && med.tapering.schedule?.length > 0) {
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').fontSize(9).fillColor(this.colors.warning || '#B45309')
              .text(`   Décroissance (${med.tapering.totalDurationDays || '?'} jours):`);
            doc.font('Helvetica').fontSize(9).fillColor(this.colors.text);
            med.tapering.schedule.forEach((step, stepIdx) => {
              doc.text(`      Étape ${step.stepNumber || stepIdx + 1}: ${step.frequency || step.dose?.amount + ' ' + step.dose?.unit} pendant ${step.durationDays} jours`);
            });
          }

          doc.moveDown(0.5);
        });

        // Special instructions
        if (prescription.notes) {
          doc.moveDown();
          doc.fontSize(10).font('Helvetica-Bold').text('Notes:');
          doc.font('Helvetica').text(prescription.notes);
        }

        // Prescriber signature
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica');
        if (prescription.prescriber) {
          doc.text(`Dr. ${prescription.prescriber.name || prescription.prescriber.firstName + ' ' + prescription.prescriber.lastName}`, { align: 'right' });
          if (prescription.prescriber.specialty) {
            doc.text(prescription.prescriber.specialty, { align: 'right' });
          }
        }
        doc.text('Signature:', { align: 'right' });

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).fillColor(this.colors.lightText)
          .text(`${this.clinicInfo.name} - ${this.clinicInfo.phone}`, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Lab Results PDF
   */
  async generateLabResultsPDF(labResult, patient) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc);

        // Title
        doc.moveDown(2);
        doc.fontSize(18).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text('RÉSULTATS D\'ANALYSES', { align: 'center' });
        doc.moveDown();

        // Patient and test info
        doc.fontSize(10).font('Helvetica').fillColor(this.colors.text);

        // Patient info box
        doc.rect(50, doc.y, 220, 80).stroke();
        const patientBoxY = doc.y + 10;
        doc.fontSize(11).font('Helvetica-Bold').text('Patient', 60, patientBoxY);
        doc.fontSize(10).font('Helvetica');
        doc.text(`${patient?.firstName || ''} ${patient?.lastName || ''}`, 60, patientBoxY + 15);
        doc.text(`ID: ${patient?.patientId || 'N/A'}`, 60, patientBoxY + 28);
        if (patient?.dateOfBirth) {
          doc.text(`Né(e) le: ${this.formatDate(patient.dateOfBirth)}`, 60, patientBoxY + 41);
        }

        // Test info box
        doc.rect(280, doc.y - 80, 220, 80).stroke();
        doc.fontSize(11).font('Helvetica-Bold').text('Analyse', 290, patientBoxY);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Date prélèvement: ${this.formatDate(labResult.collectionDate || labResult.createdAt)}`, 290, patientBoxY + 15);
        doc.text(`Date résultat: ${this.formatDate(labResult.resultDate || new Date())}`, 290, patientBoxY + 28);
        doc.text(`N° Dossier: ${labResult.labNumber || labResult._id?.toString().slice(-8)}`, 290, patientBoxY + 41);

        doc.y = patientBoxY + 70;
        doc.moveDown(2);

        // Results table
        const tableTop = doc.y;
        const headers = ['Analyse', 'Résultat', 'Unité', 'Ref. Normal', 'Status'];
        const columnWidths = [150, 80, 60, 100, 80];
        const columnX = [50, 200, 280, 340, 440];

        // Table header
        doc.rect(50, tableTop, 470, 25).fill(this.colors.primary);
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, columnX[i] + 5, tableTop + 8);
        });

        // Results rows
        let y = tableTop + 30;
        doc.fillColor(this.colors.text).font('Helvetica');

        const results = labResult.results || labResult.tests || [];
        results.forEach((result, index) => {
          if (index % 2 === 0) {
            doc.rect(50, y - 3, 470, 20).fill(this.colors.background);
            doc.fillColor(this.colors.text);
          }

          const isAbnormal = result.flag === 'high' || result.flag === 'low' || result.isAbnormal;

          doc.fontSize(9);
          doc.text(result.testName || result.name, columnX[0] + 5, y);

          if (isAbnormal) {
            doc.fillColor(this.colors.danger).font('Helvetica-Bold');
          }
          doc.text(result.value?.toString() || '-', columnX[1] + 5, y);
          doc.font('Helvetica').fillColor(this.colors.text);

          doc.text(result.unit || '', columnX[2] + 5, y);
          doc.text(result.referenceRange || result.normalRange || '-', columnX[3] + 5, y);

          // Status indicator
          if (isAbnormal) {
            doc.fillColor(this.colors.danger);
            doc.text(result.flag === 'high' ? '↑ Élevé' : result.flag === 'low' ? '↓ Bas' : 'Anormal', columnX[4] + 5, y);
          } else {
            doc.fillColor(this.colors.success);
            doc.text('Normal', columnX[4] + 5, y);
          }
          doc.fillColor(this.colors.text);

          y += 20;
        });

        // Comments/Notes
        if (labResult.notes || labResult.comments) {
          doc.y = y + 20;
          doc.fontSize(10).font('Helvetica-Bold').text('Commentaires:');
          doc.font('Helvetica').text(labResult.notes || labResult.comments);
        }

        // Validation
        doc.y = y + 40;
        doc.fontSize(9).fillColor(this.colors.lightText);
        doc.text(`Validé par: ${labResult.validatedBy?.name || 'Laboratoire'}`, { align: 'right' });
        doc.text(`Date validation: ${this.formatDate(labResult.validatedAt || new Date())}`, { align: 'right' });

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Ophthalmology Exam Report PDF
   */
  async generateOphthalmologyReportPDF(exam, patient) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc);

        // Title
        doc.moveDown(2);
        doc.fontSize(18).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text('RAPPORT D\'EXAMEN OPHTALMOLOGIQUE', { align: 'center' });
        doc.moveDown();

        // Patient info
        doc.fontSize(10).font('Helvetica').fillColor(this.colors.text);
        doc.text(`Patient: ${patient?.firstName || ''} ${patient?.lastName || ''}    |    Date: ${this.formatDate(exam.examDate || exam.createdAt)}`);
        doc.moveDown();

        // Chief Complaint
        if (exam.complaint || exam.chiefComplaint) {
          doc.fontSize(11).font('Helvetica-Bold').text('Motif de consultation:');
          doc.font('Helvetica').text(exam.complaint?.complaint || exam.chiefComplaint || 'Non spécifié');
          doc.moveDown();
        }

        // Visual Acuity
        if (exam.visualAcuity || exam.refraction) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary).text('ACUITÉ VISUELLE');
          doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          doc.fillColor(this.colors.text).font('Helvetica');

          const va = exam.visualAcuity?.distance || exam.refraction?.visualAcuity?.distance || {};
          doc.text(`Œil Droit (OD): SC ${va.OD?.unaided || '-'} | AC ${va.OD?.corrected || '-'}`);
          doc.text(`Œil Gauche (OS): SC ${va.OS?.unaided || '-'} | AC ${va.OS?.corrected || '-'}`);
          doc.moveDown();
        }

        // Refraction
        if (exam.refraction) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary).text('RÉFRACTION');
          doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          doc.fillColor(this.colors.text).font('Helvetica');

          const ref = exam.refraction;
          if (ref.subjective?.OD || ref.objective?.OD) {
            const od = ref.subjective?.OD || ref.objective?.OD || {};
            doc.text(`OD: ${od.sphere > 0 ? '+' : ''}${od.sphere || 0} (${od.cylinder || 0} à ${od.axis || 0}°) Add: ${od.add || 0}`);
          }
          if (ref.subjective?.OS || ref.objective?.OS) {
            const os = ref.subjective?.OS || ref.objective?.OS || {};
            doc.text(`OS: ${os.sphere > 0 ? '+' : ''}${os.sphere || 0} (${os.cylinder || 0} à ${os.axis || 0}°) Add: ${os.add || 0}`);
          }
          doc.moveDown();
        }

        // IOP
        if (exam.examination?.iop || exam.iop) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary).text('PRESSION INTRAOCULAIRE');
          doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          doc.fillColor(this.colors.text).font('Helvetica');

          const iop = exam.examination?.iop || exam.iop || {};
          doc.text(`OD: ${iop.OD?.value || iop.OD || '-'} mmHg | OS: ${iop.OS?.value || iop.OS || '-'} mmHg`);
          if (iop.OD?.method || iop.method) {
            doc.text(`Méthode: ${iop.OD?.method || iop.method}`);
          }
          doc.moveDown();
        }

        // Diagnosis
        if (exam.diagnosis) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary).text('DIAGNOSTIC');
          doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          doc.fillColor(this.colors.text).font('Helvetica');

          if (exam.diagnosis.primary) {
            doc.font('Helvetica-Bold').text('Principal: ', { continued: true });
            doc.font('Helvetica').text(exam.diagnosis.primary.name || exam.diagnosis.primary);
          }
          if (exam.diagnosis.secondary?.length > 0) {
            doc.font('Helvetica-Bold').text('Secondaires: ', { continued: true });
            doc.font('Helvetica').text(exam.diagnosis.secondary.map(d => d.name || d).join(', '));
          }
          doc.moveDown();
        }

        // Treatment Plan
        if (exam.prescription || exam.treatment) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary).text('TRAITEMENT');
          doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          doc.fillColor(this.colors.text).font('Helvetica');

          const meds = exam.prescription?.medications || exam.treatment?.medications || [];
          meds.forEach((med, i) => {
            doc.text(`${i + 1}. ${med.medication || med.name}: ${med.dosage || ''} - ${med.frequency || ''}`);
          });
          doc.moveDown();
        }

        // Follow-up
        if (exam.followUp) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary).text('SUIVI');
          doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          doc.fillColor(this.colors.text).font('Helvetica');

          if (exam.followUp.date) {
            doc.text(`Prochain RDV: ${this.formatDate(exam.followUp.date)}`);
          }
          if (exam.followUp.instructions) {
            doc.text(`Instructions: ${exam.followUp.instructions}`);
          }
        }

        // Examiner signature
        doc.moveDown(2);
        doc.fontSize(10);
        doc.text(`Médecin: ${exam.examiner?.name || exam.provider?.name || 'Dr.'}`, { align: 'right' });
        doc.text('Signature: _______________', { align: 'right' });

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Patient Record PDF
   */
  async generatePatientRecordPDF(patient, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'FICHE PATIENT');

        // Patient Photo placeholder
        doc.moveDown(2);
        doc.rect(50, doc.y, 80, 100).stroke(this.colors.border);
        doc.fontSize(8).fillColor(this.colors.lightText)
          .text('Photo', 75, doc.y - 50, { width: 30, align: 'center' });

        // Patient basic info (beside photo)
        const infoX = 150;
        const infoY = doc.y - 100;

        doc.fontSize(16).font('Helvetica-Bold').fillColor(this.colors.text)
          .text(`${patient.firstName} ${patient.lastName}`, infoX, infoY);
        doc.fontSize(10).font('Helvetica').fillColor(this.colors.lightText)
          .text(`ID: ${patient.patientId}`, infoX, doc.y);

        doc.moveDown(0.5);
        doc.fillColor(this.colors.text);

        // Demographics table
        const demographics = [
          ['Date de naissance', patient.dateOfBirth ? this.formatDate(patient.dateOfBirth) : 'N/A'],
          ['Sexe', patient.gender === 'male' ? 'Masculin' : patient.gender === 'female' ? 'Féminin' : patient.gender || 'N/A'],
          ['Groupe sanguin', patient.bloodType || 'N/A'],
          ['Téléphone', patient.phoneNumber || 'N/A'],
          ['Email', patient.email || 'N/A'],
          ['Adresse', patient.address ? `${patient.address.street || ''}, ${patient.address.city || ''} ${patient.address.postalCode || ''}` : 'N/A'],
          ['Assurance', patient.insurance?.provider || 'N/A'],
          ['N° Assurance', patient.insurance?.policyNumber || 'N/A']
        ];

        doc.y = infoY + 50;
        demographics.forEach(([label, value]) => {
          doc.fontSize(9).font('Helvetica-Bold').text(label + ':', infoX, doc.y, { continued: true });
          doc.font('Helvetica').text(' ' + value);
        });

        // Emergency Contact Section
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text('CONTACT D\'URGENCE');
        doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fillColor(this.colors.text).font('Helvetica').fontSize(10);

        if (patient.emergencyContact) {
          doc.text(`Nom: ${patient.emergencyContact.name || 'N/A'}`);
          doc.text(`Relation: ${patient.emergencyContact.relationship || 'N/A'}`);
          doc.text(`Téléphone: ${patient.emergencyContact.phone || 'N/A'}`);
        } else {
          doc.text('Aucun contact d\'urgence enregistré');
        }

        // Allergies Section
        doc.moveDown(1.5);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(this.colors.danger)
          .text('ALLERGIES');
        doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fillColor(this.colors.text).font('Helvetica').fontSize(10);

        if (patient.allergies && patient.allergies.length > 0) {
          patient.allergies.forEach((allergy, i) => {
            const allergyName = typeof allergy === 'string' ? allergy : allergy.name || allergy.allergen;
            const severity = typeof allergy === 'object' ? allergy.severity : '';
            doc.text(`• ${allergyName}${severity ? ` (${severity})` : ''}`);
          });
        } else {
          doc.text('Aucune allergie connue');
        }

        // Medical Conditions Section
        doc.moveDown(1.5);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text('ANTÉCÉDENTS MÉDICAUX');
        doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fillColor(this.colors.text).font('Helvetica').fontSize(10);

        if (patient.medicalHistory && patient.medicalHistory.length > 0) {
          patient.medicalHistory.forEach((condition) => {
            const condName = typeof condition === 'string' ? condition : condition.condition || condition.name;
            const diagDate = typeof condition === 'object' && condition.diagnosedDate
              ? ` (${this.formatDate(condition.diagnosedDate)})` : '';
            doc.text(`• ${condName}${diagDate}`);
          });
        } else {
          doc.text('Aucun antécédent médical enregistré');
        }

        // Current Medications Section
        doc.moveDown(1.5);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text('MÉDICAMENTS ACTUELS');
        doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fillColor(this.colors.text).font('Helvetica').fontSize(10);

        if (patient.currentMedications && patient.currentMedications.length > 0) {
          patient.currentMedications.forEach((med) => {
            const medName = typeof med === 'string' ? med : med.name || med.medication;
            const dosage = typeof med === 'object' ? med.dosage : '';
            doc.text(`• ${medName}${dosage ? ` - ${dosage}` : ''}`);
          });
        } else {
          doc.text('Aucun médicament en cours');
        }

        // Include visit history if requested
        if (options.includeVisits && patient.visits && patient.visits.length > 0) {
          doc.addPage();
          doc.fontSize(12).font('Helvetica-Bold').fillColor(this.colors.primary)
            .text('HISTORIQUE DES VISITES');
          doc.strokeColor(this.colors.border).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          doc.fillColor(this.colors.text).font('Helvetica').fontSize(10);

          patient.visits.slice(0, 20).forEach((visit, i) => {
            doc.font('Helvetica-Bold')
              .text(`${i + 1}. ${this.formatDate(visit.date || visit.createdAt)}`, { continued: true });
            doc.font('Helvetica')
              .text(` - ${visit.reason || visit.chiefComplaint || 'Consultation'}`);
            if (visit.diagnosis) {
              doc.text(`   Diagnostic: ${visit.diagnosis}`);
            }
            doc.moveDown(0.3);
          });
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).fillColor(this.colors.lightText)
          .text(`Document généré le ${this.formatDate(new Date())}`, { align: 'center' });
        doc.text('Ce document est confidentiel et réservé à usage médical', { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Company Statement PDF (Relevé de compte entreprise)
   */
  async generateCompanyStatementPDF(company, entries, summary, dateRange) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          size: 'A4',
          layout: 'portrait'
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'RELEVÉ DE COMPTE');

        doc.moveDown(2);

        // Company info box
        const companyBoxY = doc.y;
        doc.rect(50, companyBoxY, 240, 70).stroke(this.colors.border);

        doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.text)
          .text('ENTREPRISE', 60, companyBoxY + 10);
        doc.fontSize(10).font('Helvetica');
        doc.text(company.name || 'N/A', 60, companyBoxY + 25);
        doc.text(`ID: ${company.companyId || 'N/A'}`, 60, companyBoxY + 38);
        doc.text(`Convention: ${company.conventionCode || 'N/A'}`, 60, companyBoxY + 51);

        // Period info box
        doc.rect(300, companyBoxY, 245, 70).stroke(this.colors.border);
        doc.fontSize(11).font('Helvetica-Bold')
          .text('PÉRIODE', 310, companyBoxY + 10);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Du: ${this.formatDate(dateRange.from) || 'Début'}`, 310, companyBoxY + 25);
        doc.text(`Au: ${this.formatDate(dateRange.to) || 'Aujourd\'hui'}`, 310, companyBoxY + 38);
        doc.text(`Date émission: ${this.formatDate(new Date())}`, 310, companyBoxY + 51);

        doc.y = companyBoxY + 85;
        doc.moveDown(1);

        // Summary box
        const summaryBoxY = doc.y;
        doc.rect(50, summaryBoxY, 495, 80).fill(this.colors.background);

        doc.fillColor(this.colors.text).fontSize(11).font('Helvetica-Bold')
          .text('RÉSUMÉ', 60, summaryBoxY + 10);

        doc.fontSize(10).font('Helvetica');
        doc.text('Total facturé:', 60, summaryBoxY + 30);
        doc.text(this.formatCurrency(summary.totalDebit, summary.currency || 'CDF'), 200, summaryBoxY + 30, { width: 150, align: 'right' });

        doc.text('Total payé:', 60, summaryBoxY + 45);
        doc.fillColor(this.colors.success)
          .text(this.formatCurrency(summary.totalCredit || 0, summary.currency || 'CDF'), 200, summaryBoxY + 45, { width: 150, align: 'right' });

        doc.fillColor(this.colors.text).font('Helvetica-Bold')
          .text('SOLDE DÛ:', 60, summaryBoxY + 62);
        doc.fillColor(summary.balance > 0 ? this.colors.danger : this.colors.success).fontSize(12)
          .text(this.formatCurrency(summary.balance || 0, summary.currency || 'CDF'), 200, summaryBoxY + 60, { width: 150, align: 'right' });

        doc.y = summaryBoxY + 95;
        doc.moveDown(1);

        // Transactions table
        doc.fillColor(this.colors.text).fontSize(11).font('Helvetica-Bold')
          .text('DÉTAIL DES TRANSACTIONS');
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const headers = ['Date', 'Référence', 'Patient', 'Employé ID', 'Montant', 'Statut'];
        const colWidths = [70, 80, 130, 70, 80, 65];
        const colX = [50];
        colWidths.forEach((w, i) => {
          if (i > 0) colX.push(colX[i - 1] + colWidths[i - 1]);
        });

        // Header row
        doc.rect(50, tableTop, 495, 20).fill(this.colors.primary);
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, colX[i] + 3, tableTop + 6, { width: colWidths[i] - 6 });
        });

        // Data rows
        let y = tableTop + 25;
        doc.font('Helvetica');

        (entries || []).forEach((entry, index) => {
          // Check if we need a new page
          if (y > 720) {
            doc.addPage();
            y = 50;

            // Re-add header row on new page
            doc.rect(50, y, 495, 20).fill(this.colors.primary);
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
            headers.forEach((header, i) => {
              doc.text(header, colX[i] + 3, y + 6, { width: colWidths[i] - 6 });
            });
            y += 25;
            doc.font('Helvetica');
          }

          if (index % 2 === 0) {
            doc.rect(50, y - 2, 495, 16).fill(this.colors.background);
          }

          doc.fillColor(this.colors.text).fontSize(8);
          doc.text(this.formatDate(entry.date), colX[0] + 3, y, { width: colWidths[0] - 6 });
          doc.text(entry.reference || '-', colX[1] + 3, y, { width: colWidths[1] - 6 });
          doc.text(entry.patient?.name || '-', colX[2] + 3, y, { width: colWidths[2] - 6 });
          doc.text(entry.patient?.employeeId || '-', colX[3] + 3, y, { width: colWidths[3] - 6 });
          doc.text(this.formatCurrency(entry.debit || 0, summary.currency || 'CDF'), colX[4] + 3, y, { width: colWidths[4] - 6 });

          // Status with color
          const statusColors = {
            paid: this.colors.success,
            partial: '#f59e0b',
            issued: this.colors.primary,
            overdue: this.colors.danger
          };
          doc.fillColor(statusColors[entry.status] || this.colors.text)
            .text(this.translateStatus(entry.status || 'issued'), colX[5] + 3, y, { width: colWidths[5] - 6 });

          y += 16;
        });

        doc.y = y + 10;

        // Total row
        doc.moveDown(1);
        doc.strokeColor(this.colors.border).lineWidth(1)
          .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fillColor(this.colors.text).fontSize(10).font('Helvetica-Bold');
        doc.text(`TOTAL: ${entries?.length || 0} facture(s)`, 50, doc.y, { continued: true, width: 300 });
        doc.text(this.formatCurrency(summary.totalDebit || 0, summary.currency || 'CDF'), { align: 'right', width: 195 });

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Company Batch Invoice PDF (Bordereau)
   */
  async generateBatchInvoicePDF(batchData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          size: 'A4',
          layout: 'portrait'
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'BORDEREAU DE FACTURATION');

        doc.moveDown(2);

        // Batch info
        doc.fontSize(12).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text(`Référence: ${batchData.batchReference}`);
        doc.moveDown(0.5);

        // Company info
        doc.fontSize(10).font('Helvetica').fillColor(this.colors.text);
        doc.text(`Entreprise: ${batchData.company.name}`);
        doc.text(`ID: ${batchData.company.companyId}`);
        doc.text(`Période: ${batchData.period.from} - ${batchData.period.to}`);
        doc.moveDown(1);

        // Summary box
        const summaryY = doc.y;
        doc.rect(350, summaryY, 195, 60).fill(this.colors.background);
        doc.fillColor(this.colors.text).font('Helvetica-Bold').fontSize(10)
          .text('TOTAL', 360, summaryY + 8);
        doc.font('Helvetica').fontSize(9);
        doc.text(`Factures: ${batchData.summary.invoiceCount}`, 360, summaryY + 22);
        doc.text(`Part entreprise: ${this.formatCurrency(batchData.summary.totalCompanyShare, batchData.summary.currency)}`, 360, summaryY + 35);
        doc.text(`Part patient: ${this.formatCurrency(batchData.summary.totalPatientShare, batchData.summary.currency)}`, 360, summaryY + 48);

        doc.y = summaryY + 75;
        doc.moveDown(1);

        // Details by group
        doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text('DÉTAIL PAR ' + (batchData.groupBy === 'patient' ? 'PATIENT' : 'MOIS'));
        doc.moveDown(0.5);

        const tableTop = doc.y;
        let headers, colWidths;

        if (batchData.groupBy === 'patient') {
          headers = ['Patient', 'Employé ID', 'Nb Factures', 'Part Entreprise', 'Part Patient'];
          colWidths = [150, 80, 70, 100, 95];
        } else {
          headers = ['Période', 'Nb Factures', 'Part Entreprise', 'Part Patient'];
          colWidths = [150, 100, 125, 120];
        }

        const colX = [50];
        colWidths.forEach((w, i) => {
          if (i > 0) colX.push(colX[i - 1] + colWidths[i - 1]);
        });

        // Header row
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        doc.rect(50, tableTop, totalWidth, 20).fill(this.colors.primary);
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, colX[i] + 3, tableTop + 6, { width: colWidths[i] - 6 });
        });

        // Data rows
        let y = tableTop + 25;
        doc.font('Helvetica');

        (batchData.groups || []).forEach((group, index) => {
          if (y > 720) {
            doc.addPage();
            y = 50;
          }

          if (index % 2 === 0) {
            doc.rect(50, y - 2, totalWidth, 16).fill(this.colors.background);
          }

          doc.fillColor(this.colors.text).fontSize(8);

          if (batchData.groupBy === 'patient') {
            doc.text(group.patient?.name || '-', colX[0] + 3, y, { width: colWidths[0] - 6 });
            doc.text(group.patient?.employeeId || '-', colX[1] + 3, y, { width: colWidths[1] - 6 });
            doc.text(group.invoices?.length.toString() || '0', colX[2] + 3, y, { width: colWidths[2] - 6 });
            doc.text(this.formatCurrency(group.totalCompanyShare, batchData.summary.currency), colX[3] + 3, y, { width: colWidths[3] - 6 });
            doc.text(this.formatCurrency(group.totalPatientShare, batchData.summary.currency), colX[4] + 3, y, { width: colWidths[4] - 6 });
          } else {
            doc.text(group.period || '-', colX[0] + 3, y, { width: colWidths[0] - 6 });
            doc.text(group.invoices?.length.toString() || '0', colX[1] + 3, y, { width: colWidths[1] - 6 });
            doc.text(this.formatCurrency(group.totalCompanyShare, batchData.summary.currency), colX[2] + 3, y, { width: colWidths[2] - 6 });
            doc.text(this.formatCurrency(group.totalPatientShare, batchData.summary.currency), colX[3] + 3, y, { width: colWidths[3] - 6 });
          }

          y += 16;
        });

        // Grand total row
        doc.y = y + 10;
        doc.strokeColor(this.colors.primary).lineWidth(2)
          .moveTo(50, doc.y).lineTo(50 + totalWidth, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fillColor(this.colors.text).fontSize(11).font('Helvetica-Bold');
        doc.text('TOTAL À FACTURER: ', { continued: true });
        doc.fillColor(this.colors.primary)
          .text(this.formatCurrency(batchData.summary.totalCompanyShare, batchData.summary.currency));

        // Signature area
        doc.moveDown(3);
        doc.fillColor(this.colors.text).fontSize(9).font('Helvetica');
        doc.text('Fait à __________________ le ' + this.formatDate(new Date()));
        doc.moveDown(2);
        doc.text('Signature et cachet de l\'entreprise:', 50);
        doc.text('Signature du prestataire:', 350);

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Aging Report PDF (Rapport d'ancienneté des créances)
   */
  async generateAgingReportPDF(reportRows, grandTotals, asOfDate) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          size: 'A4',
          layout: 'landscape'
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(16).font('Helvetica-Bold').fillColor(this.colors.primary)
          .text(this.clinicInfo.name, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor(this.colors.text)
          .text('RAPPORT D\'ANCIENNETÉ DES CRÉANCES', { align: 'center' });
        doc.fontSize(10).font('Helvetica').fillColor(this.colors.lightText)
          .text(`Au ${this.formatDate(asOfDate)}`, { align: 'center' });

        doc.moveDown(2);

        // Summary box
        const summaryY = doc.y;
        doc.rect(50, summaryY, 700, 50).fill(this.colors.background);

        doc.fillColor(this.colors.text).fontSize(10).font('Helvetica-Bold');
        doc.text('Courant', 80, summaryY + 10);
        doc.text(this.formatCurrency(grandTotals.current), 80, summaryY + 25);

        doc.text('31-60 jours', 200, summaryY + 10);
        doc.text(this.formatCurrency(grandTotals.days30), 200, summaryY + 25);

        doc.text('61-90 jours', 320, summaryY + 10);
        doc.text(this.formatCurrency(grandTotals.days60), 320, summaryY + 25);

        doc.fillColor(this.colors.danger);
        doc.text('+90 jours', 440, summaryY + 10);
        doc.text(this.formatCurrency(grandTotals.days90Plus), 440, summaryY + 25);

        doc.fillColor(this.colors.primary).fontSize(12);
        doc.text('TOTAL', 580, summaryY + 10);
        doc.text(this.formatCurrency(grandTotals.total), 580, summaryY + 25);

        doc.y = summaryY + 65;
        doc.moveDown(1);

        // Table
        const tableTop = doc.y;
        const headers = ['Entreprise', 'Courant', '31-60 jours', '61-90 jours', '+90 jours', 'Total'];
        const colWidths = [250, 90, 90, 90, 90, 90];
        const colX = [50];
        colWidths.forEach((w, i) => {
          if (i > 0) colX.push(colX[i - 1] + colWidths[i - 1]);
        });

        // Header row
        doc.rect(50, tableTop, 700, 20).fill(this.colors.primary);
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, colX[i] + 5, tableTop + 6, { width: colWidths[i] - 10 });
        });

        // Data rows
        let y = tableTop + 25;
        doc.font('Helvetica');

        (reportRows || []).forEach((row, index) => {
          if (y > 520) {
            doc.addPage({ layout: 'landscape' });
            y = 50;

            // Re-add header
            doc.rect(50, y, 700, 20).fill(this.colors.primary);
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
            headers.forEach((header, i) => {
              doc.text(header, colX[i] + 5, y + 6, { width: colWidths[i] - 10 });
            });
            y += 25;
            doc.font('Helvetica');
          }

          if (index % 2 === 0) {
            doc.rect(50, y - 2, 700, 16).fill(this.colors.background);
          }

          doc.fillColor(this.colors.text).fontSize(8);
          doc.text(row.company, colX[0] + 5, y, { width: colWidths[0] - 10 });
          doc.text(this.formatCurrency(row.current), colX[1] + 5, y, { width: colWidths[1] - 10 });
          doc.text(this.formatCurrency(row.days30), colX[2] + 5, y, { width: colWidths[2] - 10 });
          doc.text(this.formatCurrency(row.days60), colX[3] + 5, y, { width: colWidths[3] - 10 });

          // Highlight overdue
          if (row.days90Plus > 0) {
            doc.fillColor(this.colors.danger);
          }
          doc.text(this.formatCurrency(row.days90Plus), colX[4] + 5, y, { width: colWidths[4] - 10 });

          doc.fillColor(this.colors.text).font('Helvetica-Bold');
          doc.text(this.formatCurrency(row.total), colX[5] + 5, y, { width: colWidths[5] - 10 });
          doc.font('Helvetica');

          y += 16;
        });

        // Grand total row
        doc.y = y + 5;
        doc.strokeColor(this.colors.primary).lineWidth(2)
          .moveTo(50, doc.y).lineTo(750, doc.y).stroke();

        y = doc.y + 8;
        doc.fillColor(this.colors.text).fontSize(10).font('Helvetica-Bold');
        doc.text('TOTAL GÉNÉRAL', colX[0] + 5, y);
        doc.text(this.formatCurrency(grandTotals.current), colX[1] + 5, y);
        doc.text(this.formatCurrency(grandTotals.days30), colX[2] + 5, y);
        doc.text(this.formatCurrency(grandTotals.days60), colX[3] + 5, y);
        doc.fillColor(this.colors.danger);
        doc.text(this.formatCurrency(grandTotals.days90Plus), colX[4] + 5, y);
        doc.fillColor(this.colors.primary).fontSize(11);
        doc.text(this.formatCurrency(grandTotals.total), colX[5] + 5, y);

        // Footer
        doc.moveDown(3);
        doc.fontSize(8).fillColor(this.colors.lightText);
        doc.text(`Généré le ${this.formatDate(new Date())} | ${this.clinicInfo.name}`, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Patient List PDF (for export)
   */
  async generatePatientListPDF(patients) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          size: 'A4',
          layout: 'landscape'
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'LISTE DES PATIENTS');

        doc.moveDown(2);

        // Table headers
        const tableTop = doc.y;
        const headers = ['ID', 'Nom', 'Prénom', 'Date Naiss.', 'Sexe', 'Téléphone', 'Email'];
        const colWidths = [60, 100, 100, 80, 50, 100, 150];
        const colX = [50];
        colWidths.forEach((w, i) => {
          if (i > 0) colX.push(colX[i - 1] + colWidths[i - 1]);
        });

        // Header row
        doc.rect(50, tableTop, 740, 20).fill(this.colors.primary);
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, colX[i] + 5, tableTop + 5, { width: colWidths[i] - 10 });
        });

        // Data rows
        let y = tableTop + 25;
        doc.fillColor(this.colors.text).font('Helvetica');

        patients.forEach((patient, index) => {
          if (y > 500) {
            doc.addPage({ layout: 'landscape' });
            y = 50;
          }

          if (index % 2 === 0) {
            doc.rect(50, y - 3, 740, 18).fill(this.colors.background);
            doc.fillColor(this.colors.text);
          }

          doc.fontSize(8);
          doc.text(patient.patientId || '-', colX[0] + 5, y, { width: colWidths[0] - 10 });
          doc.text(patient.lastName || '-', colX[1] + 5, y, { width: colWidths[1] - 10 });
          doc.text(patient.firstName || '-', colX[2] + 5, y, { width: colWidths[2] - 10 });
          doc.text(patient.dateOfBirth ? this.formatDate(patient.dateOfBirth) : '-', colX[3] + 5, y, { width: colWidths[3] - 10 });
          doc.text(patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : '-', colX[4] + 5, y, { width: colWidths[4] - 10 });
          doc.text(patient.phoneNumber || '-', colX[5] + 5, y, { width: colWidths[5] - 10 });
          doc.text(patient.email || '-', colX[6] + 5, y, { width: colWidths[6] - 10 });

          y += 18;
        });

        // Summary
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica-Bold')
          .text(`Total: ${patients.length} patients`, { align: 'right' });

        // Footer
        doc.fontSize(8).fillColor(this.colors.lightText)
          .text(`Exporté le ${this.formatDate(new Date())}`, 50, 550);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PDFGeneratorService();
