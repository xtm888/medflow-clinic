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
   * Generate Invoice PDF - Enhanced with Legal/Tax Information
   * Features: Business registration, tax info, payment terms, legal footer
   */
  async generateInvoicePDF(invoice) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          info: {
            Producer: 'MedFlow EMR',
            Creator: 'MedFlow Billing System',
            Title: `Facture ${invoice.invoiceId || 'N/A'}`
          }
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header with business registration info
        this.addInvoiceHeader(doc, invoice);

        // Invoice details section with enhanced formatting
        doc.moveDown(2);
        this.addEnhancedInvoiceDetails(doc, invoice);

        // Patient info
        doc.moveDown(1);
        this.addPatientInfo(doc, invoice.patient);

        // Items table with Code column
        doc.moveDown(2);
        this.addEnhancedItemsTable(doc, invoice.items);

        // Enhanced summary with tax breakdown
        doc.moveDown(1);
        this.addEnhancedInvoiceSummary(doc, invoice);

        // Payment info
        if (invoice.payments && invoice.payments.length > 0) {
          doc.moveDown(1);
          this.addPaymentHistory(doc, invoice.payments);
        }

        // Payment terms section (if configured)
        if (invoice.paymentTerms || invoice.bankDetails) {
          doc.moveDown(1);
          this.addPaymentTerms(doc, invoice);
        }

        // Legal footer
        this.addLegalFooter(doc, invoice);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add invoice header with business registration info
   * @private
   */
  addInvoiceHeader(doc, invoice) {
    // Logo (if exists)
    if (this.clinicInfo.logo && fs.existsSync(this.clinicInfo.logo)) {
      doc.image(this.clinicInfo.logo, 50, 45, { width: 100 });
    }

    // Clinic info with NIF/RCCM
    doc.fontSize(14).font('Helvetica-Bold')
      .fillColor(this.colors.primary)
      .text(this.clinicInfo.name, 300, 45, { align: 'right', width: 245 });

    doc.fontSize(9).font('Helvetica')
      .fillColor(this.colors.lightText)
      .text(this.clinicInfo.address, 300, 62, { align: 'right', width: 245 })
      .text(`Tel: ${this.clinicInfo.phone}`, 300, 74, { align: 'right', width: 245 })
      .text(this.clinicInfo.email, 300, 86, { align: 'right', width: 245 });

    // Business registration info (NIF/RCCM)
    if (this.clinicInfo.taxId) {
      doc.text(this.clinicInfo.taxId, 300, 98, { align: 'right', width: 245 });
    }
    // Add RCCM if configured in environment
    const rccm = process.env.CLINIC_RCCM;
    if (rccm) {
      doc.text(`RCCM: ${rccm}`, 300, 110, { align: 'right', width: 245 });
    }

    // Title
    doc.moveDown(5);
    doc.fontSize(18).font('Helvetica-Bold')
      .fillColor(this.colors.text)
      .text('FACTURE', { align: 'center' });

    // Divider
    doc.moveDown(0.5);
    doc.strokeColor(this.colors.primary).lineWidth(2)
      .moveTo(200, doc.y).lineTo(395, doc.y).stroke();
  }

  /**
   * Add enhanced invoice details with better formatting
   * @private
   */
  addEnhancedInvoiceDetails(doc, invoice) {
    const detailsY = doc.y;

    // Generate formatted invoice number: FACT-YYYY-NNNNNN
    const invoiceDate = invoice.dateIssued ? new Date(invoice.dateIssued) : new Date();
    const year = invoiceDate.getFullYear();
    const invoiceNum = invoice.invoiceId || invoice._id?.toString().slice(-6).toUpperCase() || '000000';
    const formattedInvoiceNum = invoiceNum.startsWith('FACT-') ? invoiceNum : `FACT-${year}-${invoiceNum.padStart(6, '0')}`;

    // Left column
    doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
      .text('Facture N°:', 50, detailsY);
    doc.font('Helvetica').text(formattedInvoiceNum, 130, detailsY);

    doc.font('Helvetica-Bold').text('Date emission:', 50, detailsY + 15);
    doc.font('Helvetica').text(this.formatDate(invoice.dateIssued), 130, detailsY + 15);

    // Due date if payment terms configured
    if (invoice.dueDate) {
      doc.font('Helvetica-Bold').text('Echeance:', 50, detailsY + 30);
      doc.font('Helvetica').text(this.formatDate(invoice.dueDate), 130, detailsY + 30);
    }

    // Clinic ID/branch code if multi-clinic
    const clinicCode = invoice.clinic?.code || invoice.clinicId;
    if (clinicCode) {
      doc.font('Helvetica-Bold').text('Site:', 50, detailsY + 45);
      doc.font('Helvetica').text(clinicCode, 130, detailsY + 45);
    }

    // Right column - Status
    const statusColors = {
      paid: this.colors.success,
      partial: '#f59e0b',
      overdue: this.colors.danger,
      issued: this.colors.primary,
      draft: this.colors.lightText,
      cancelled: this.colors.danger
    };

    doc.fontSize(12).font('Helvetica-Bold')
      .fillColor(statusColors[invoice.status] || this.colors.secondary)
      .text(this.translateStatus(invoice.status), 400, detailsY, { align: 'right', width: 145 });
  }

  /**
   * Add enhanced items table with Code column
   * @private
   */
  addEnhancedItemsTable(doc, items) {
    const tableTop = doc.y;
    // Added 'Code' column for procedure codes
    const tableHeaders = ['Code', 'Description', 'Qte', 'Prix unit.', 'Remise', 'Total'];
    const columnWidths = [60, 180, 35, 75, 60, 85];
    const columnX = [50, 110, 290, 325, 400, 460];

    // Header background
    doc.rect(50, tableTop, 495, 25).fill(this.colors.primary);

    // Headers
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, columnX[i] + 3, tableTop + 8, { width: columnWidths[i] - 6 });
    });

    // Items
    let y = tableTop + 30;
    doc.fillColor(this.colors.text).font('Helvetica');

    (items || []).forEach((item, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(50, y - 3, 495, 22).fill(this.colors.background);
        doc.fillColor(this.colors.text);
      }

      doc.fontSize(9);
      // Code column (procedure code)
      doc.text(item.code || item.procedureCode || '-', columnX[0] + 3, y, { width: columnWidths[0] - 6 });
      // Description
      doc.text(item.description || item.name || '-', columnX[1] + 3, y, { width: columnWidths[1] - 6 });
      // Quantity
      doc.text((item.quantity || 1).toString(), columnX[2] + 3, y, { width: columnWidths[2] - 6 });
      // Unit price
      doc.text(this.formatCurrency(item.unitPrice || item.price || 0), columnX[3] + 3, y, { width: columnWidths[3] - 6 });
      // Discount
      doc.text(this.formatCurrency(item.discount || 0), columnX[4] + 3, y, { width: columnWidths[4] - 6 });
      // Line total (subtotal per line)
      const lineTotal = item.total || ((item.unitPrice || item.price || 0) * (item.quantity || 1) - (item.discount || 0));
      doc.text(this.formatCurrency(lineTotal), columnX[5] + 3, y, { width: columnWidths[5] - 6 });

      y += 22;
    });

    doc.y = y;
  }

  /**
   * Add enhanced invoice summary with tax breakdown
   * @private
   */
  addEnhancedInvoiceSummary(doc, invoice) {
    const summary = invoice.summary || {};
    const summaryX = 340;
    const labelX = summaryX;
    const valueX = 460;
    const width = 85;
    const currency = invoice.currency || 'CDF';

    doc.fontSize(10).font('Helvetica').fillColor(this.colors.text);

    // Subtotal (before discounts)
    const subtotal = summary.subtotal || summary.total || 0;
    doc.text('Sous-total:', labelX, doc.y);
    doc.text(this.formatCurrency(subtotal, currency), valueX, doc.y - 12, { width, align: 'right' });

    // Discount amount (if any)
    if (summary.discountTotal > 0) {
      doc.text('Remise:', labelX, doc.y);
      doc.fillColor(this.colors.success)
        .text(`-${this.formatCurrency(summary.discountTotal, currency)}`, valueX, doc.y - 12, { width, align: 'right' });
      doc.fillColor(this.colors.text);
    }

    // Tax info - Total HT (before tax if applicable)
    const taxRate = invoice.taxRate || summary.taxRate || 0;
    if (taxRate > 0) {
      const totalHT = subtotal - (summary.discountTotal || 0);
      doc.text('Total HT:', labelX, doc.y);
      doc.text(this.formatCurrency(totalHT, currency), valueX, doc.y - 12, { width, align: 'right' });

      // Tax amount
      const taxAmount = summary.taxTotal || (totalHT * taxRate / 100);
      doc.text(`TVA (${taxRate}%)`, labelX, doc.y);
      doc.text(this.formatCurrency(taxAmount, currency), valueX, doc.y - 12, { width, align: 'right' });
    }

    // Total line separator
    doc.moveDown(0.5);
    doc.strokeColor(this.colors.border).lineWidth(0.5)
      .moveTo(summaryX, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    // Total TTC (final amount)
    const totalLabel = taxRate > 0 ? 'TOTAL TTC:' : 'TOTAL:';
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(totalLabel, labelX, doc.y);
    doc.text(this.formatCurrency(summary.total || 0, currency), valueX, doc.y - 14, { width, align: 'right' });

    // Amount paid so far
    if (summary.amountPaid > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor(this.colors.success);
      doc.text('Deja paye:', labelX, doc.y);
      doc.text(this.formatCurrency(summary.amountPaid, currency), valueX, doc.y - 12, { width, align: 'right' });
    }

    // Amount due (bold, highlighted if >0)
    const amountDue = summary.amountDue ?? (summary.total - (summary.amountPaid || 0));
    if (amountDue > 0) {
      doc.moveDown(0.5);
      // Highlight box for amount due
      doc.rect(summaryX - 5, doc.y - 3, 210, 20).fill('#fef2f2');
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.danger);
      doc.text('RESTE A PAYER:', labelX, doc.y);
      doc.text(this.formatCurrency(amountDue, currency), valueX, doc.y - 13, { width, align: 'right' });
    } else if (amountDue <= 0 && summary.amountPaid > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.success);
      doc.text('SOLDE: Paye', labelX, doc.y);
    }

    doc.fillColor(this.colors.text);
  }

  /**
   * Add payment terms section
   * @private
   */
  addPaymentTerms(doc, invoice) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
      .text('Conditions de paiement');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');

    // Payment terms text
    if (invoice.paymentTerms) {
      doc.text(invoice.paymentTerms);
    } else {
      doc.text('Paiement a reception de facture.');
    }

    // Bank details if configured for transfers
    if (invoice.bankDetails || process.env.CLINIC_BANK_DETAILS) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Coordonnees bancaires:');
      doc.font('Helvetica');
      const bankDetails = invoice.bankDetails || process.env.CLINIC_BANK_DETAILS;
      doc.text(bankDetails);
    }
  }

  /**
   * Add legal footer with tax and legal notices
   * @private
   */
  addLegalFooter(doc, invoice) {
    const bottomY = doc.page.height - 100;

    doc.fontSize(8).fillColor(this.colors.lightText);

    // Payment instructions (if invoice has balance)
    if (invoice?.summary?.amountDue > 0) {
      doc.text('Modes de paiement acceptes: Especes, Carte bancaire, Virement, Mobile Money', 50, bottomY - 40, { align: 'center', width: 495 });
    }

    // Tax notice
    const taxRate = invoice?.taxRate || invoice?.summary?.taxRate || 0;
    if (taxRate === 0) {
      doc.text('TVA non applicable - Article en vigueur', 50, bottomY - 25, { align: 'center', width: 495 });
    }

    // Legal dispute clause
    doc.text('En cas de litige, seuls les tribunaux de Kinshasa sont competents.', 50, bottomY - 12, { align: 'center', width: 495 });

    // Footer line
    doc.strokeColor(this.colors.border).lineWidth(0.5)
      .moveTo(50, bottomY).lineTo(545, bottomY).stroke();

    // Business info footer
    doc.text(`${this.clinicInfo.name} | ${this.clinicInfo.taxId} | ${this.clinicInfo.phone}`, 50, bottomY + 10, { align: 'center', width: 495 });

    // Invoice validity notice
    doc.text('Facture valable 30 jours - Document genere electroniquement', 50, bottomY + 22, { align: 'center', width: 495 });
  }

  /**
   * Calculate dynamic receipt height based on content
   * @private
   */
  _calculateReceiptHeight(payment, invoice) {
    // Base height for header, title, and footer
    let height = 180;

    // Add height for address lines
    if (this.clinicInfo.address) height += 12;

    // Add height for payment reference if present
    if (payment.reference) height += 12;

    // Add height for balance display
    height += 25;

    // Add extra height for long patient names
    const patientName = `${payment.patient?.firstName || ''} ${payment.patient?.lastName || ''}`;
    if (patientName.length > 25) height += 10;

    // Minimum height for thermal receipt
    return Math.max(height, 220);
  }

  /**
   * Generate Receipt PDF - Improved Thermal Format
   * Features: Dynamic height, dotted separators, better formatting
   */
  async generateReceiptPDF(payment, invoice, patient) {
    return new Promise((resolve, reject) => {
      try {
        // Calculate dynamic height based on content
        const receiptHeight = this._calculateReceiptHeight(payment, invoice);

        const doc = new PDFDocument({
          size: [226, receiptHeight], // 80mm width = 226 points, dynamic height
          margins: { top: 10, bottom: 10, left: 10, right: 10 },
          info: {
            Producer: 'MedFlow EMR',
            Creator: 'MedFlow Receipt System'
          }
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const contentWidth = 206; // 226 - 20 (margins)
        const leftMargin = 10;

        // ===== HEADER SECTION =====
        // Clinic name in bold, centered
        doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.text)
          .text(this.clinicInfo.name, leftMargin, 10, { width: contentWidth, align: 'center' });

        // Address line 1
        doc.fontSize(7).font('Helvetica').fillColor(this.colors.lightText)
          .text(this.clinicInfo.address, { width: contentWidth, align: 'center' });

        // Phone number
        doc.text(`Tel: ${this.clinicInfo.phone}`, { width: contentWidth, align: 'center' });

        // Dotted line separator
        doc.moveDown(0.3);
        doc.fillColor(this.colors.text).fontSize(8)
          .text('- - - - - - - - - - - - - - - - - - - - -', { width: contentWidth, align: 'center' });

        // ===== RECEIPT TITLE =====
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold')
          .text('RECU', { width: contentWidth, align: 'center' });

        // Receipt number
        doc.fontSize(8).font('Helvetica')
          .text(`N° ${payment.paymentId || payment._id?.toString().slice(-8).toUpperCase()}`, { width: contentWidth, align: 'center' });

        // Date/time
        const paymentDate = payment.date || payment.createdAt || new Date();
        const dateStr = this.formatDate(paymentDate);
        const timeStr = new Date(paymentDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        doc.text(`${dateStr} ${timeStr}`, { width: contentWidth, align: 'center' });

        // ===== DOTTED SEPARATOR =====
        doc.moveDown(0.3);
        doc.text('- - - - - - - - - - - - - - - - - - - - -', { width: contentWidth, align: 'center' });

        // ===== PATIENT INFO =====
        doc.moveDown(0.3);
        doc.fontSize(8).font('Helvetica');
        const patientName = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : 'N/A';
        doc.text(`Patient: ${patientName}`, leftMargin, doc.y, { width: contentWidth });

        const patientId = patient?.patientId || patient?._id?.toString().slice(-8) || 'N/A';
        doc.text(`ID: ${patientId}`, { width: contentWidth });

        // ===== INVOICE REFERENCE =====
        const invoiceNum = invoice?.invoiceId || invoice?._id?.toString().slice(-8) || 'N/A';
        doc.text(`Facture: ${invoiceNum}`, { width: contentWidth });

        // ===== DOTTED SEPARATOR =====
        doc.moveDown(0.3);
        doc.text('- - - - - - - - - - - - - - - - - - - - -', { width: contentWidth, align: 'center' });

        // ===== AMOUNT SECTION (prominent) =====
        doc.moveDown(0.5);

        // "MONTANT PAYE" label
        doc.fontSize(8).font('Helvetica')
          .text('MONTANT PAYE', { width: contentWidth, align: 'center' });

        // Amount in large bold font with currency
        const currency = payment.currency || invoice?.currency || 'CDF';
        doc.fontSize(14).font('Helvetica-Bold')
          .text(this.formatCurrency(payment.amount, currency), { width: contentWidth, align: 'center' });

        // Payment method in French
        doc.fontSize(8).font('Helvetica')
          .text(`Mode: ${this.translatePaymentMethod(payment.method)}`, { width: contentWidth, align: 'center' });

        // Reference number if present
        if (payment.reference) {
          doc.text(`Ref: ${payment.reference}`, { width: contentWidth, align: 'center' });
        }

        // ===== BALANCE SECTION =====
        doc.moveDown(0.5);
        const invoiceTotal = invoice?.summary?.total || invoice?.totalAmount || 0;
        const invoicePaid = invoice?.summary?.amountPaid || 0;
        const balance = Math.max(0, invoiceTotal - invoicePaid - payment.amount);

        if (balance <= 0) {
          // Fully paid
          doc.fontSize(9).font('Helvetica-Bold').fillColor(this.colors.success)
            .text('SOLDE: 0 (Paye en totalite)', { width: contentWidth, align: 'center' });
        } else {
          // Balance remaining
          doc.fontSize(9).font('Helvetica').fillColor(this.colors.text)
            .text(`Solde restant: ${this.formatCurrency(balance, currency)}`, { width: contentWidth, align: 'center' });
        }

        // ===== DOTTED SEPARATOR =====
        doc.moveDown(0.3);
        doc.fillColor(this.colors.text).fontSize(8)
          .text('- - - - - - - - - - - - - - - - - - - - -', { width: contentWidth, align: 'center' });

        // ===== FOOTER =====
        doc.moveDown(0.3);
        doc.fontSize(7).font('Helvetica').fillColor(this.colors.lightText)
          .text('Merci de votre confiance', { width: contentWidth, align: 'center' })
          .text('Conservez ce recu', { width: contentWidth, align: 'center' });

        // Website if configured
        if (this.clinicInfo.website) {
          doc.text(this.clinicInfo.website, { width: contentWidth, align: 'center' });
        }

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
        doc.text('Solde precedent:', 60, summaryStartY + 10);
        doc.text(this.formatCurrency(totals.previousBalance), 400, summaryStartY + 10, { align: 'right', width: 130 });

        doc.text('Nouveaux frais:', 60, summaryStartY + 28);
        doc.text(this.formatCurrency(totals.newCharges), 400, summaryStartY + 28, { align: 'right', width: 130 });

        doc.text('Paiements recus:', 60, summaryStartY + 46);
        doc.fillColor(this.colors.success)
          .text(`-${this.formatCurrency(totals.payments)}`, 400, summaryStartY + 46, { align: 'right', width: 130 });

        doc.fillColor(this.colors.text).font('Helvetica-Bold')
          .text('SOLDE DU:', 60, summaryStartY + 64);
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
   * Generate Prescription PDF - CareVision Legacy Format
   * Features: Header box with clinic info, signature/stamp box, French formatting
   */
  async generatePrescriptionPDF(prescription) {
    return new Promise((resolve, reject) => {
      try {
        // A5 size: 420 x 595 points
        const doc = new PDFDocument({
          size: 'A5',
          margins: { top: 30, bottom: 30, left: 30, right: 30 },
          info: {
            Producer: 'MedFlow EMR',
            Creator: 'MedFlow Prescription System'
          }
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageWidth = 420;
        const contentWidth = pageWidth - 60; // 30 margin each side

        // ===== HEADER BOX with clinic info =====
        const headerBoxY = 30;
        const headerBoxHeight = 55;
        doc.rect(30, headerBoxY, contentWidth, headerBoxHeight)
          .strokeColor(this.colors.border)
          .lineWidth(1)
          .stroke();

        // Clinic name (bold, 14pt)
        doc.fontSize(14).font('Helvetica-Bold').fillColor(this.colors.text)
          .text(this.clinicInfo.name, 35, headerBoxY + 8, { width: contentWidth - 10, align: 'center' });

        // Clinic address
        doc.fontSize(9).font('Helvetica').fillColor(this.colors.lightText)
          .text(this.clinicInfo.address, 35, headerBoxY + 25, { width: contentWidth - 10, align: 'center' });

        // Phone and email
        doc.text(`Tel: ${this.clinicInfo.phone} | ${this.clinicInfo.email}`, 35, headerBoxY + 38, { width: contentWidth - 10, align: 'center' });

        // ===== TITLE SECTION =====
        doc.y = headerBoxY + headerBoxHeight + 15;

        // "ORDONNANCE MEDICALE" centered, underlined
        doc.fontSize(14).font('Helvetica-Bold').fillColor(this.colors.text)
          .text('ORDONNANCE MEDICALE', { align: 'center', underline: true });

        doc.moveDown(0.5);

        // Prescription number aligned right
        const prescNum = prescription.prescriptionNumber || `ORD-${prescription._id?.toString().slice(-8).toUpperCase() || 'XXXX'}`;
        doc.fontSize(9).font('Helvetica').fillColor(this.colors.lightText)
          .text(`N° ${prescNum}`, { align: 'right' });

        // Date aligned right in French format: "Kinshasa, le DD/MM/YYYY"
        const prescDate = this.formatDate(prescription.prescribedDate || prescription.createdAt);
        doc.text(`Kinshasa, le ${prescDate}`, { align: 'right' });

        doc.moveDown(1);

        // ===== PATIENT SECTION (boxed) =====
        if (prescription.patient) {
          const patient = prescription.patient;
          const patientBoxY = doc.y;
          const patientBoxHeight = 45;

          // Light gray background box
          doc.rect(30, patientBoxY, contentWidth, patientBoxHeight)
            .fillColor('#f5f5f5')
            .fill();
          doc.rect(30, patientBoxY, contentWidth, patientBoxHeight)
            .strokeColor(this.colors.border)
            .lineWidth(0.5)
            .stroke();

          // Patient info inside box
          doc.fillColor(this.colors.text).fontSize(10).font('Helvetica-Bold')
            .text(`Patient: ${patient.firstName || ''} ${patient.lastName || ''}`, 38, patientBoxY + 8);

          // Birth date and age
          if (patient.dateOfBirth) {
            const age = Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
            doc.font('Helvetica').fontSize(9)
              .text(`Né(e) le: ${this.formatDate(patient.dateOfBirth)}  (${age} ans)`, 38, patientBoxY + 22);
          }

          // Patient MRN/ID
          const mrn = patient.patientId || patient.mrn || patient._id?.toString().slice(-8);
          doc.text(`N° Dossier: ${mrn}`, 38, patientBoxY + 33);

          doc.y = patientBoxY + patientBoxHeight + 10;
        }

        // ===== MEDICATIONS SECTION =====
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
          .text('Prescription:');
        doc.moveDown(0.3);

        const routeLabels = {
          ophthalmic: 'Collyre',
          intravitreal: 'Intravitréen',
          subconjunctival: 'Sous-conjonctival',
          periocular: 'Périoculaire',
          intracameral: 'Intracaméral',
          topical: 'Topique',
          otic: 'Auriculaire',
          nasal: 'Nasal',
          oral: 'Oral'
        };

        const eyeLabels = {
          OD: 'Oeil Droit (OD)',
          OS: 'Oeil Gauche (OS)',
          OU: 'Les deux yeux (OU)'
        };

        (prescription.medications || []).forEach((med, index) => {
          // Medication number and name
          const medName = med.medication || med.name || 'Médicament';
          doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
            .text(`${index + 1}) ${medName}`);

          // Indented details with bullet points
          doc.font('Helvetica').fontSize(9).fillColor(this.colors.text);

          if (med.dosage) {
            doc.text(`   • Dosage: ${med.dosage}`, { indent: 10 });
          }

          if (med.frequency) {
            doc.text(`   • Posologie: ${med.frequency}`, { indent: 10 });
          }

          if (med.duration) {
            doc.text(`   • Durée: ${med.duration}`, { indent: 10 });
          }

          // Eye specification for ophthalmic medications
          const eye = med.applicationLocation?.eye || med.eye;
          if (eye && med.route !== 'oral') {
            doc.text(`   • Oeil: ${eyeLabels[eye] || eye}`, { indent: 10 });
          }

          // Route if not oral
          if (med.route && med.route !== 'oral') {
            doc.text(`   • Voie: ${routeLabels[med.route] || med.route}`, { indent: 10 });
          }

          if (med.instructions) {
            doc.text(`   • Instructions: ${med.instructions}`, { indent: 10 });
          }

          // Tapering schedule if present
          if (med.tapering?.enabled && med.tapering.schedule?.length > 0) {
            doc.fillColor('#B45309').font('Helvetica-Bold').fontSize(8)
              .text(`   • Décroissance (${med.tapering.totalDurationDays || '?'} jours):`, { indent: 10 });
            doc.font('Helvetica').fillColor(this.colors.text);
            med.tapering.schedule.forEach((step, stepIdx) => {
              const freq = step.frequency || `${step.dose?.amount || ''} ${step.dose?.unit || ''}`.trim();
              doc.text(`      - Étape ${step.stepNumber || stepIdx + 1}: ${freq} pendant ${step.durationDays} jours`, { indent: 20 });
            });
          }

          // Horizontal separator between medications (except last)
          if (index < (prescription.medications || []).length - 1) {
            doc.moveDown(0.3);
            doc.strokeColor('#e0e0e0').lineWidth(0.3)
              .moveTo(40, doc.y).lineTo(contentWidth + 20, doc.y).stroke();
            doc.moveDown(0.3);
          } else {
            doc.moveDown(0.5);
          }
        });

        // ===== SPECIAL INSTRUCTIONS =====
        if (prescription.notes) {
          doc.moveDown(0.5);
          doc.fontSize(9).font('Helvetica-Bold').fillColor(this.colors.text)
            .text('Instructions particulières:');
          doc.font('Helvetica').text(prescription.notes);
        }

        // ===== SIGNATURE BOX (bottom right) =====
        // Calculate position - try to place at bottom of page
        const signatureBoxWidth = 100;
        const signatureBoxHeight = 60;
        const signatureBoxX = pageWidth - 30 - signatureBoxWidth; // Right aligned
        let signatureBoxY = Math.max(doc.y + 30, 480); // At least 30pt below content, or near bottom

        // Ensure we don't go off page
        if (signatureBoxY + signatureBoxHeight + 30 > 595) {
          signatureBoxY = 595 - signatureBoxHeight - 50;
        }

        // "Cachet et Signature" label above box
        doc.fontSize(9).font('Helvetica-Bold').fillColor(this.colors.text)
          .text('Cachet et Signature', signatureBoxX, signatureBoxY - 12, { width: signatureBoxWidth, align: 'center' });

        // Signature box border
        doc.rect(signatureBoxX, signatureBoxY, signatureBoxWidth, signatureBoxHeight)
          .strokeColor(this.colors.border)
          .lineWidth(1)
          .stroke();

        // Doctor name and specialty below box
        doc.y = signatureBoxY + signatureBoxHeight + 5;
        if (prescription.prescriber) {
          const prescriberName = prescription.prescriber.name ||
            `${prescription.prescriber.firstName || ''} ${prescription.prescriber.lastName || ''}`.trim();
          doc.fontSize(8).font('Helvetica-Bold')
            .text(`Dr. ${prescriberName}`, signatureBoxX, doc.y, { width: signatureBoxWidth, align: 'center' });
          if (prescription.prescriber.specialty) {
            doc.font('Helvetica').fontSize(7)
              .text(prescription.prescriber.specialty, signatureBoxX, doc.y, { width: signatureBoxWidth, align: 'center' });
          }
        }

        // ===== FOOTER =====
        const footerY = 565;
        doc.fontSize(7).font('Helvetica').fillColor(this.colors.lightText);

        // Validity notice
        const validityDays = prescription.validityDays || 90;
        doc.text(`Ordonnance valable ${validityDays === 90 ? '3 mois' : validityDays + ' jours'}`, 30, footerY, { width: contentWidth, align: 'center' });

        // Clinic contact
        doc.text(`${this.clinicInfo.name} | Tel: ${this.clinicInfo.phone}`, 30, footerY + 10, { width: contentWidth, align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Determine lab result category from test data
   * @param {Object} labResult - Lab result object
   * @returns {string} Category: 'biochemistry', 'hematology', 'microbiology', 'urinalysis', 'coagulation', 'serology', or 'general'
   */
  getLabCategory(labResult) {
    // Priority 1: Check explicit category field
    if (labResult?.test?.category) {
      const category = labResult.test.category.toLowerCase();
      if (['biochemistry', 'biochimie', 'chemistry'].includes(category)) return 'biochemistry';
      if (['hematology', 'hematologie', 'hémato'].includes(category)) return 'hematology';
      if (['microbiology', 'microbiologie', 'bacteriology', 'bactériologie'].includes(category)) return 'microbiology';
      if (['urinalysis', 'urologie', 'urine'].includes(category)) return 'urinalysis';
      if (['coagulation', 'hemostase', 'hémostase'].includes(category)) return 'coagulation';
      if (['serology', 'sérologie', 'immunology', 'immunologie'].includes(category)) return 'serology';
    }

    // Priority 2: Check testCode prefix patterns
    const testCode = (labResult?.test?.testCode || '').toUpperCase();

    // Biochemistry prefixes
    if (/^(BIO|GLU|LIP|HEP|REN|CREA|URE|CHOL|TG|ALT|AST|GGT|BIL|PROT|ALB|ALP|LDH|CK|UREA|GLUC|HBA1C)/.test(testCode)) {
      return 'biochemistry';
    }

    // Hematology prefixes
    if (/^(CBC|HEM|WBC|RBC|HGB|HCT|PLT|MCV|MCH|MCHC|RDW|MPV|RETI|NFS|GB|GR|HB|VGM)/.test(testCode)) {
      return 'hematology';
    }

    // Microbiology prefixes
    if (/^(CUL|SENS|BACT|MICRO|ECBU|HEMO|COPRO|PARASIT|CULT)/.test(testCode)) {
      return 'microbiology';
    }

    // Urinalysis prefixes
    if (/^(URI|BU|ECBU|SED|URIN)/.test(testCode)) {
      return 'urinalysis';
    }

    // Coagulation prefixes
    if (/^(PT|INR|COAG|TCA|TQ|FIB|APTT|PTT|TP)/.test(testCode)) {
      return 'coagulation';
    }

    // Serology prefixes
    if (/^(SER|AB|IGG|IGM|IGA|HIV|HBS|HCV|VIH|SERO|ASLO|CRP|RF|ANA)/.test(testCode)) {
      return 'serology';
    }

    // Priority 3: Check test name patterns
    const testName = (labResult?.test?.testName || '').toLowerCase();

    if (/glucose|glycémie|lipid|cholestérol|triglyc|créatinine|urée|transaminase|bilirubine|albumine|protéine|ionogramme|calcium|phosphore|magnésium|fer|ferritine/.test(testName)) {
      return 'biochemistry';
    }

    if (/hémogramme|numération|formule|nfs|globule|hémoglobine|plaquette|hématocrite|leucocyte|érythrocyte/.test(testName)) {
      return 'hematology';
    }

    if (/culture|antibiogramme|bactério|ecbu|uroculture|hémoculture|coproculture|prélèvement/.test(testName)) {
      return 'microbiology';
    }

    if (/urine|bandelette|sédiment|protéinurie|glycosurie/.test(testName)) {
      return 'urinalysis';
    }

    if (/coagulation|tp|tca|inr|fibrinogène|hémostase/.test(testName)) {
      return 'coagulation';
    }

    if (/sérologie|anticorps|antigène|hiv|vih|hépatite|hbs|hcv|aslo|crp|facteur rhumatoïde/.test(testName)) {
      return 'serology';
    }

    // Default fallback
    return 'general';
  }

  /**
   * Add biochemistry-specific layout to lab result PDF
   * Displays analytes grouped by organ system with reference ranges
   * @private
   */
  _addBiochemistryLayout(doc, labResult, patient) {
    const results = labResult.results || labResult.tests || [];

    // Group results by organ system
    const organGroups = {
      'Fonction rénale': [],
      'Bilan hépatique': [],
      'Bilan lipidique': [],
      'Glycémie': [],
      'Ionogramme': [],
      'Autres': []
    };

    // Classify each result into an organ group
    results.forEach(result => {
      const param = (result.parameter || result.testName || result.name || '').toLowerCase();
      if (/créatinine|urée|urea|acide urique|dfu|dfg|clairance/.test(param)) {
        organGroups['Fonction rénale'].push(result);
      } else if (/alt|ast|ggt|gamma|bilirubine|alat|asat|transaminase|phosphatase|ldh|albumine/.test(param)) {
        organGroups['Bilan hépatique'].push(result);
      } else if (/cholestérol|triglyc|hdl|ldl|lipid|apolipoprotéine/.test(param)) {
        organGroups['Bilan lipidique'].push(result);
      } else if (/glucose|glycémie|hba1c|hémoglobine glyquée/.test(param)) {
        organGroups['Glycémie'].push(result);
      } else if (/sodium|potassium|chlore|calcium|phosphore|magnésium|na|k|cl|ca|mg|bicarbonate|co2/.test(param)) {
        organGroups['Ionogramme'].push(result);
      } else {
        organGroups['Autres'].push(result);
      }
    });

    // Draw each group with results
    Object.entries(organGroups).forEach(([groupName, groupResults]) => {
      if (groupResults.length === 0) return;

      // Check if we need a new page
      if (doc.y > 680) {
        doc.addPage();
        doc.y = 50;
      }

      // Group header
      doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.primary)
        .text(groupName, 50, doc.y);
      doc.moveDown(0.3);

      // Table header for this group
      const tableTop = doc.y;
      const colX = [50, 180, 260, 320, 420];
      const colW = [130, 80, 60, 100, 75];
      const headers = ['Paramètre', 'Valeur', 'Unité', 'Réf. Normale', 'Statut'];

      doc.rect(50, tableTop, 495, 18).fill('#e8e8e8');
      doc.fillColor(this.colors.text).fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i] + 3, tableTop + 5, { width: colW[i] }));

      let y = tableTop + 22;
      doc.font('Helvetica');

      groupResults.forEach((result, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        // Alternating row background
        if (idx % 2 === 0) {
          doc.rect(50, y - 2, 495, 16).fill(this.colors.background);
        }

        const isAbnormal = result.flag && result.flag !== 'normal';
        const isCritical = result.flag && (result.flag.includes('critical') || result.flag === 'panic');
        const value = result.value ?? result.numericValue ?? result.textValue ?? '-';
        const refRange = this._formatReferenceRange(result);

        doc.fillColor(this.colors.text).fontSize(8);
        doc.text(result.parameter || result.testName || result.name || '-', colX[0] + 3, y, { width: colW[0] });

        // Value with color coding
        if (isCritical) {
          doc.fillColor('#b91c1c').font('Helvetica-Bold');
        } else if (isAbnormal) {
          doc.fillColor(this.colors.danger).font('Helvetica-Bold');
        }
        doc.text(value.toString(), colX[1] + 3, y, { width: colW[1] });
        doc.font('Helvetica').fillColor(this.colors.text);

        doc.text(result.unit || '', colX[2] + 3, y, { width: colW[2] });
        doc.text(refRange, colX[3] + 3, y, { width: colW[3] });

        // Status with delta if available
        let statusText = 'Normal';
        if (isCritical) {
          statusText = result.flag === 'critical-high' ? '↑↑ Critique' : '↓↓ Critique';
          doc.fillColor('#b91c1c');
        } else if (result.flag === 'high') {
          statusText = '↑ Élevé';
          doc.fillColor(this.colors.danger);
        } else if (result.flag === 'low') {
          statusText = '↓ Bas';
          doc.fillColor(this.colors.danger);
        } else {
          doc.fillColor(this.colors.success);
        }

        // Add trend indicator if delta available
        if (result.delta?.trend && result.delta.trend !== 'na') {
          const trendSymbol = result.delta.trend === 'increasing' ? '⬆' : result.delta.trend === 'decreasing' ? '⬇' : '→';
          statusText += ` ${trendSymbol}`;
        }

        doc.text(statusText, colX[4] + 3, y, { width: colW[4] });
        doc.fillColor(this.colors.text);

        y += 16;
      });

      doc.y = y + 10;
    });
  }

  /**
   * Add hematology-specific layout to lab result PDF
   * Displays CBC, WBC differential, and platelet sections
   * @private
   */
  _addHematologyLayout(doc, labResult, patient) {
    const results = labResult.results || labResult.tests || [];

    // Categorize results into hematology sections
    const sections = {
      'Numération Globulaire (CBC)': [],
      'Indices Érythrocytaires': [],
      'Formule Leucocytaire': [],
      'Plaquettes': []
    };

    results.forEach(result => {
      const param = (result.parameter || result.testName || result.name || '').toLowerCase();
      if (/hémoglobine|hgb|hb(?!s)|hématocrite|hct|globule rouge|gr|rbc|érythrocyte/.test(param)) {
        sections['Numération Globulaire (CBC)'].push(result);
      } else if (/vgm|mcv|ccmh|mchc|tcmh|mch|rdw|idé|idr/.test(param)) {
        sections['Indices Érythrocytaires'].push(result);
      } else if (/globule blanc|gb|wbc|leucocyte|neutrophile|lymphocyte|monocyte|éosinophile|basophile|polynucléaire|pnn|pne|pnb/.test(param)) {
        sections['Formule Leucocytaire'].push(result);
      } else if (/plaquette|plt|thrombocyte|vpm|mpv|pct|pdw/.test(param)) {
        sections['Plaquettes'].push(result);
      } else {
        // Default to CBC
        sections['Numération Globulaire (CBC)'].push(result);
      }
    });

    // Draw each section
    Object.entries(sections).forEach(([sectionName, sectionResults]) => {
      if (sectionResults.length === 0) return;

      if (doc.y > 650) {
        doc.addPage();
        doc.y = 50;
      }

      // Section header with colored bar
      doc.rect(50, doc.y, 495, 20).fill(this.colors.primary);
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text(sectionName.toUpperCase(), 55, doc.y + 5);
      doc.y += 25;

      // Table for this section
      const colX = [50, 200, 280, 340, 430];
      const colW = [150, 80, 60, 90, 65];
      const headers = ['Paramètre', 'Valeur', 'Unité', 'Réf.', 'Statut'];

      // Header row
      doc.rect(50, doc.y, 495, 16).fill('#f0f0f0');
      doc.fillColor(this.colors.text).fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i] + 3, doc.y + 4, { width: colW[i] }));

      let y = doc.y + 20;
      doc.font('Helvetica');

      sectionResults.forEach((result, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        if (idx % 2 === 0) {
          doc.rect(50, y - 2, 495, 16).fill(this.colors.background);
        }

        const isAbnormal = result.flag && result.flag !== 'normal';
        const value = result.value ?? result.numericValue ?? result.textValue ?? '-';
        const refRange = this._formatReferenceRange(result);

        doc.fillColor(this.colors.text).fontSize(8);
        doc.text(result.parameter || result.testName || result.name || '-', colX[0] + 3, y, { width: colW[0] });

        // Value with color and visual indicator
        if (isAbnormal) {
          doc.fillColor(this.colors.danger).font('Helvetica-Bold');
        }
        doc.text(value.toString(), colX[1] + 3, y, { width: colW[1] });
        doc.font('Helvetica').fillColor(this.colors.text);

        doc.text(result.unit || '', colX[2] + 3, y, { width: colW[2] });
        doc.text(refRange, colX[3] + 3, y, { width: colW[3] });

        // Visual bar indicator
        const barWidth = 60;
        const barX = colX[4] + 3;
        if (result.referenceRange && result.numericValue != null) {
          const low = result.referenceRange.low ?? 0;
          const high = result.referenceRange.high ?? 100;
          const val = result.numericValue;
          const range = high - low;
          const pos = Math.min(Math.max((val - low) / range, 0), 1);

          // Draw bar background
          doc.rect(barX, y + 2, barWidth, 8).fill('#e0e0e0');
          // Draw normal range
          doc.rect(barX + barWidth * 0.2, y + 2, barWidth * 0.6, 8).fill('#90EE90');
          // Draw value marker
          const markerX = barX + pos * barWidth;
          doc.rect(markerX - 2, y, 4, 12).fill(isAbnormal ? this.colors.danger : this.colors.success);
        } else {
          // Just show text status
          let statusText = result.flag === 'high' ? '↑' : result.flag === 'low' ? '↓' : '✓';
          doc.fillColor(isAbnormal ? this.colors.danger : this.colors.success)
            .text(statusText, barX, y, { width: barWidth });
        }
        doc.fillColor(this.colors.text);

        y += 16;
      });

      doc.y = y + 10;
    });
  }

  /**
   * Add microbiology-specific layout to lab result PDF
   * Displays specimen info, organism, and antibiotic sensitivity table
   * @private
   */
  _addMicrobiologyLayout(doc, labResult, patient) {
    const results = labResult.results || labResult.tests || [];

    // Specimen information section
    doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary)
      .text('INFORMATIONS PRÉLÈVEMENT', 50, doc.y);
    doc.moveDown(0.3);

    doc.rect(50, doc.y, 495, 50).stroke(this.colors.border);
    const specimenY = doc.y + 5;
    doc.fontSize(9).font('Helvetica').fillColor(this.colors.text);
    doc.text(`Type de prélèvement: ${labResult.specimen?.type || labResult.test?.testName || 'Non spécifié'}`, 55, specimenY);
    doc.text(`Site de prélèvement: ${labResult.specimen?.source || 'Non spécifié'}`, 55, specimenY + 12);
    doc.text(`Date de prélèvement: ${this.formatDate(labResult.collectionDate || labResult.createdAt)}`, 55, specimenY + 24);
    doc.text(`Méthode de collecte: ${labResult.specimen?.collectionMethod || 'Standard'}`, 300, specimenY);
    doc.text(`Volume/Quantité: ${labResult.specimen?.volume || 'N/A'}`, 300, specimenY + 12);
    doc.y = specimenY + 55;

    // Organism identification section
    doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary)
      .text('IDENTIFICATION DES ORGANISMES', 50, doc.y);
    doc.moveDown(0.3);

    // Find organism results
    const organismResults = results.filter(r => {
      const param = (r.parameter || r.testName || r.name || '').toLowerCase();
      return /organisme|bactérie|germe|culture|identification|croissance/.test(param);
    });

    if (organismResults.length > 0) {
      organismResults.forEach(result => {
        const value = result.value || result.textValue || result.numericValue || 'Négatif';
        doc.rect(50, doc.y, 495, 20).fill(this.colors.background);
        doc.fillColor(this.colors.text).fontSize(9).font('Helvetica');
        doc.text(`Organisme: ${value}`, 55, doc.y + 5);
        doc.y += 25;
      });
    } else {
      doc.rect(50, doc.y, 495, 20).fill(this.colors.background);
      doc.fillColor(this.colors.text).fontSize(9).font('Helvetica');
      doc.text('Culture: En cours d\'analyse ou Pas de croissance', 55, doc.y + 5);
      doc.y += 25;
    }
    doc.moveDown(0.5);

    // Antibiotic sensitivity table (antibiogramme)
    const sensitivityResults = results.filter(r => {
      const param = (r.parameter || r.testName || r.name || '').toLowerCase();
      return /sensibilité|résistance|antibiogramme|antibiotique|mic|cmi/.test(param) ||
             (r.interpretation && /^[SIR]$/.test(r.interpretation));
    });

    if (sensitivityResults.length > 0 || results.some(r => r.sensitivity)) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary)
        .text('ANTIBIOGRAMME', 50, doc.y);
      doc.moveDown(0.3);

      // Table header
      const tableTop = doc.y;
      const colX = [50, 200, 280, 360];
      const colW = [150, 80, 80, 135];
      const headers = ['Antibiotique', 'CMI', 'Interprétation', 'Recommandation'];

      doc.rect(50, tableTop, 495, 18).fill(this.colors.primary);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i] + 3, tableTop + 5, { width: colW[i] }));

      let y = tableTop + 22;
      doc.font('Helvetica');

      // If results have sensitivity array, use that
      const sensitivities = sensitivityResults.length > 0 ? sensitivityResults :
        results.flatMap(r => r.sensitivity || []);

      sensitivities.forEach((sens, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        if (idx % 2 === 0) {
          doc.rect(50, y - 2, 495, 16).fill(this.colors.background);
        }

        const antibiotic = sens.antibiotic || sens.parameter || sens.testName || sens.name || '-';
        const mic = sens.mic || sens.value || '-';
        const interp = sens.interpretation || sens.flag || '-';

        doc.fillColor(this.colors.text).fontSize(8);
        doc.text(antibiotic, colX[0] + 3, y, { width: colW[0] });
        doc.text(mic.toString(), colX[1] + 3, y, { width: colW[1] });

        // Interpretation with color coding (S=Sensible, I=Intermédiaire, R=Résistant)
        let interpText = interp;
        let interpColor = this.colors.text;
        if (interp === 'S' || /sensible/i.test(interp)) {
          interpText = 'S (Sensible)';
          interpColor = this.colors.success;
        } else if (interp === 'R' || /résistant/i.test(interp)) {
          interpText = 'R (Résistant)';
          interpColor = this.colors.danger;
        } else if (interp === 'I' || /intermédaire/i.test(interp)) {
          interpText = 'I (Intermédiaire)';
          interpColor = '#ca8a04'; // amber
        }
        doc.fillColor(interpColor).font('Helvetica-Bold');
        doc.text(interpText, colX[2] + 3, y, { width: colW[2] });
        doc.font('Helvetica').fillColor(this.colors.text);

        // Recommendation
        const rec = interp === 'S' || /sensible/i.test(interp) ? 'Utilisable' :
                    interp === 'R' || /résistant/i.test(interp) ? 'Non recommandé' : 'Prudence';
        doc.text(rec, colX[3] + 3, y, { width: colW[3] });

        y += 16;
      });

      doc.y = y + 10;
    }

    // Comments/Growth notes section
    if (labResult.comments || labResult.notes || labResult.growthNotes) {
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
        .text('Notes de culture:', 50, doc.y);
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9)
        .text(labResult.comments || labResult.notes || labResult.growthNotes || 'Aucune note', 50, doc.y);
    }
  }

  /**
   * Add urinalysis-specific layout to lab result PDF
   * Displays physical, chemical (dipstick), and microscopic exam sections
   * @private
   */
  _addUrinalysisLayout(doc, labResult, patient) {
    const results = labResult.results || labResult.tests || [];

    // Categorize results into urinalysis sections
    const sections = {
      physical: [],
      chemical: [],
      microscopic: []
    };

    results.forEach(result => {
      const param = (result.parameter || result.testName || result.name || '').toLowerCase();
      if (/couleur|color|aspect|apparence|clarté|turbidité|odeur|densité|gravité spécifique|sg/.test(param)) {
        sections.physical.push(result);
      } else if (/ph|protéine|glucose|cétone|bilirubine|urobilinogène|nitrite|leucocyte|sang|hémoglobine|bandelette/.test(param)) {
        sections.chemical.push(result);
      } else if (/cellule|leucocyte|érythrocyte|cylindre|cristal|bactérie|levure|épithél|mucus|sédiment|globule/.test(param)) {
        sections.microscopic.push(result);
      } else {
        // Default to chemical
        sections.chemical.push(result);
      }
    });

    // Physical Examination Section
    if (sections.physical.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary)
        .text('EXAMEN PHYSIQUE', 50, doc.y);
      doc.moveDown(0.3);

      // Display in 2-column format
      doc.rect(50, doc.y, 495, Math.ceil(sections.physical.length / 2) * 18 + 10).fill(this.colors.background);
      const startY = doc.y + 5;
      let col1Y = startY, col2Y = startY;

      sections.physical.forEach((result, idx) => {
        const param = result.parameter || result.testName || result.name || '-';
        const value = result.value ?? result.textValue ?? '-';
        const isAbnormal = result.flag && result.flag !== 'normal';

        doc.fillColor(this.colors.text).fontSize(9).font('Helvetica');
        if (idx % 2 === 0) {
          doc.text(`${param}: `, 55, col1Y, { continued: true });
          doc.fillColor(isAbnormal ? this.colors.danger : this.colors.text).font(isAbnormal ? 'Helvetica-Bold' : 'Helvetica')
            .text(value.toString());
          col1Y += 18;
        } else {
          doc.text(`${param}: `, 300, col2Y, { continued: true });
          doc.fillColor(isAbnormal ? this.colors.danger : this.colors.text).font(isAbnormal ? 'Helvetica-Bold' : 'Helvetica')
            .text(value.toString());
          col2Y += 18;
        }
      });

      doc.y = Math.max(col1Y, col2Y) + 10;
    }

    // Chemical Examination Section (Dipstick)
    if (sections.chemical.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary)
        .text('EXAMEN CHIMIQUE (BANDELETTE)', 50, doc.y);
      doc.moveDown(0.3);

      const tableTop = doc.y;
      const colX = [50, 180, 280, 380];
      const colW = [130, 100, 100, 115];
      const headers = ['Paramètre', 'Résultat', 'Réf. Normale', 'Interprétation'];

      doc.rect(50, tableTop, 495, 18).fill('#e8e8e8');
      doc.fillColor(this.colors.text).fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i] + 3, tableTop + 5, { width: colW[i] }));

      let y = tableTop + 22;
      doc.font('Helvetica');

      sections.chemical.forEach((result, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        if (idx % 2 === 0) {
          doc.rect(50, y - 2, 495, 16).fill(this.colors.background);
        }

        const isAbnormal = result.flag && result.flag !== 'normal';
        const value = result.value ?? result.textValue ?? result.numericValue ?? '-';
        const refRange = this._formatReferenceRange(result) || 'Négatif';

        doc.fillColor(this.colors.text).fontSize(8);
        doc.text(result.parameter || result.testName || result.name || '-', colX[0] + 3, y, { width: colW[0] });

        // Display dipstick results with +/- scale visual
        let displayValue = value.toString();
        let valueColor = this.colors.text;
        if (/^(\+{1,4}|trace|pos|positif)/i.test(displayValue)) {
          valueColor = this.colors.danger;
        } else if (/^(nég|neg|-)/i.test(displayValue)) {
          valueColor = this.colors.success;
        }

        doc.fillColor(valueColor).font(isAbnormal ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(displayValue, colX[1] + 3, y, { width: colW[1] });
        doc.font('Helvetica').fillColor(this.colors.text);

        doc.text(refRange, colX[2] + 3, y, { width: colW[2] });

        // Interpretation
        let interp = 'Normal';
        if (isAbnormal) {
          interp = result.interpretation || 'Anormal';
          doc.fillColor(this.colors.danger);
        } else {
          doc.fillColor(this.colors.success);
        }
        doc.text(interp, colX[3] + 3, y, { width: colW[3] });
        doc.fillColor(this.colors.text);

        y += 16;
      });

      doc.y = y + 10;
    }

    // Microscopic Examination Section
    if (sections.microscopic.length > 0) {
      if (doc.y > 620) {
        doc.addPage();
        doc.y = 50;
      }

      doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.primary)
        .text('EXAMEN MICROSCOPIQUE', 50, doc.y);
      doc.moveDown(0.3);

      const tableTop = doc.y;
      const colX = [50, 200, 300, 400];
      const colW = [150, 100, 100, 95];
      const headers = ['Élément', 'Quantité', 'Unité', 'Remarque'];

      doc.rect(50, tableTop, 495, 18).fill('#e8e8e8');
      doc.fillColor(this.colors.text).fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i] + 3, tableTop + 5, { width: colW[i] }));

      let y = tableTop + 22;
      doc.font('Helvetica');

      sections.microscopic.forEach((result, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        if (idx % 2 === 0) {
          doc.rect(50, y - 2, 495, 16).fill(this.colors.background);
        }

        const isAbnormal = result.flag && result.flag !== 'normal';
        const value = result.value ?? result.numericValue ?? result.textValue ?? '-';

        doc.fillColor(this.colors.text).fontSize(8);
        doc.text(result.parameter || result.testName || result.name || '-', colX[0] + 3, y, { width: colW[0] });

        doc.fillColor(isAbnormal ? this.colors.danger : this.colors.text)
           .font(isAbnormal ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(value.toString(), colX[1] + 3, y, { width: colW[1] });
        doc.font('Helvetica').fillColor(this.colors.text);

        doc.text(result.unit || '/champ', colX[2] + 3, y, { width: colW[2] });

        // Remarks for abnormal findings
        const remark = isAbnormal ? (result.interpretation || 'Anormal') : '-';
        doc.text(remark, colX[3] + 3, y, { width: colW[3] });

        y += 16;
      });

      doc.y = y + 10;
    }
  }

  /**
   * Add general/default lab layout to lab result PDF
   * Standard table format for any test type (fallback)
   * @private
   */
  _addGeneralLabLayout(doc, labResult, patient) {
    const results = labResult.results || labResult.tests || [];

    // Standard table layout
    const tableTop = doc.y;
    const headers = ['Analyse', 'Résultat', 'Unité', 'Réf. Normale', 'Statut'];
    const columnWidths = [150, 80, 60, 110, 95];
    const columnX = [50, 200, 280, 340, 450];

    // Table header
    doc.rect(50, tableTop, 495, 22).fill(this.colors.primary);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, columnX[i] + 5, tableTop + 7);
    });

    // Results rows
    let y = tableTop + 27;
    doc.fillColor(this.colors.text).font('Helvetica');

    results.forEach((result, index) => {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }

      if (index % 2 === 0) {
        doc.rect(50, y - 3, 495, 20).fill(this.colors.background);
        doc.fillColor(this.colors.text);
      }

      const isAbnormal = result.flag === 'high' || result.flag === 'low' ||
                         result.flag === 'abnormal' || result.isAbnormal;
      const isCritical = result.flag && (result.flag.includes('critical') || result.flag === 'panic');
      const value = result.value ?? result.numericValue ?? result.textValue ?? '-';
      const refRange = this._formatReferenceRange(result);

      doc.fontSize(9);
      doc.text(result.testName || result.parameter || result.name || '-', columnX[0] + 5, y);

      if (isCritical) {
        doc.fillColor('#b91c1c').font('Helvetica-Bold');
      } else if (isAbnormal) {
        doc.fillColor(this.colors.danger).font('Helvetica-Bold');
      }
      doc.text(value.toString(), columnX[1] + 5, y);
      doc.font('Helvetica').fillColor(this.colors.text);

      doc.text(result.unit || '', columnX[2] + 5, y);
      doc.text(refRange, columnX[3] + 5, y);

      // Status indicator
      if (isCritical) {
        doc.fillColor('#b91c1c');
        doc.text(result.flag === 'critical-high' ? '↑↑ CRITIQUE' : '↓↓ CRITIQUE', columnX[4] + 5, y);
      } else if (result.flag === 'high') {
        doc.fillColor(this.colors.danger);
        doc.text('↑ Élevé', columnX[4] + 5, y);
      } else if (result.flag === 'low') {
        doc.fillColor(this.colors.danger);
        doc.text('↓ Bas', columnX[4] + 5, y);
      } else if (isAbnormal) {
        doc.fillColor(this.colors.danger);
        doc.text('Anormal', columnX[4] + 5, y);
      } else {
        doc.fillColor(this.colors.success);
        doc.text('Normal', columnX[4] + 5, y);
      }
      doc.fillColor(this.colors.text);

      y += 20;
    });

    doc.y = y;
  }

  /**
   * Format reference range for display
   * @private
   */
  _formatReferenceRange(result) {
    if (result.referenceRange) {
      if (result.referenceRange.text) {
        return result.referenceRange.text;
      }
      if (result.referenceRange.low != null && result.referenceRange.high != null) {
        return `${result.referenceRange.low} - ${result.referenceRange.high}`;
      }
      if (result.referenceRange.low != null) {
        return `> ${result.referenceRange.low}`;
      }
      if (result.referenceRange.high != null) {
        return `< ${result.referenceRange.high}`;
      }
    }
    if (result.normalRange) {
      return result.normalRange;
    }
    return '-';
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
          doc.fontSize(9).font('Helvetica-Bold').text(`${label}:`, infoX, doc.y, { continued: true });
          doc.font('Helvetica').text(` ${value}`);
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
          .text(`DÉTAIL PAR ${batchData.groupBy === 'patient' ? 'PATIENT' : 'MOIS'}`);
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
        doc.text(`Fait à __________________ le ${this.formatDate(new Date())}`);
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
   * Generate Fiche d'Ophtalmologie PDF
   * Matches the exact format from the reference image
   */
  async generateFicheOphtalmologiePDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          size: 'A4',
          margins: { top: 40, bottom: 60, left: 40, right: 40 }
        });
        const chunks = [];
        const pageNumber = 1;
        const totalPages = data.totalPages || 1;

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const { patient, visit, prescriptions, provider, clinicInfo: customClinicInfo } = data;
        const clinic = customClinicInfo || this.clinicInfo;

        // Document number format: PatientID + Visit sequence
        const documentNumber = data.documentNumber ||
          `${patient?.patientId || ''}${visit?.visitNumber ? `/${visit.visitNumber}` : ''}`;

        // ===== HEADER SECTION =====
        // Logo (left side) - wider for better visibility
        const logoPath = path.join(__dirname, '../public/images/optical-logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 20, { width: 120 });
        } else {
          // Fallback: draw a placeholder
          doc.rect(40, 20, 120, 70).stroke(this.colors.border);
          doc.fontSize(20).font('Helvetica-Bold').fillColor(this.colors.primary)
            .text('LOGO', 70, 45);
        }

        // Document title (center-right)
        doc.fontSize(16).font('Helvetica-Bold').fillColor(this.colors.text)
          .text(`FICHE D'OPHTALMOLOGIE  N° ${documentNumber}`, 170, 45, {
            width: 380,
            align: 'center'
          });

        doc.y = 100;

        // ===== PATIENT INFO TABLE (2 columns, bordered) =====
        const tableStartY = doc.y;
        const tableWidth = 515;
        const leftColWidth = 255;
        const rightColWidth = 260;
        const rowHeight = 18;
        const tablePadding = 5;

        // Patient data with fallbacks
        const patientData = {
          fullName: patient?.firstName && patient?.lastName
            ? `${patient.lastName.toUpperCase()} ${patient.firstName}`
            : patient?.fullName || '',
          dateOfBirth: patient?.dateOfBirth ? this.formatDate(patient.dateOfBirth) : '',
          sex: patient?.gender === 'male' ? 'M' : patient?.gender === 'female' ? 'F' : patient?.gender || '',
          civilStatus: patient?.civilStatus || patient?.maritalStatus || '',
          birthPlace: patient?.birthPlace || patient?.placeOfBirth || '',
          phones: Array.isArray(patient?.phones) ? patient.phones.join(' - ') :
            patient?.phoneNumber || patient?.phone || '',
          email: patient?.email || '',
          address: patient?.address?.street || patient?.avenue || '',
          commune: patient?.address?.commune || patient?.commune || '',
          quartier: patient?.address?.quartier || patient?.quartier || '',
          profession: patient?.profession || patient?.occupation || '',
          nationality: patient?.nationality || '',
          tarif: patient?.tarif || patient?.rateCode || '',
          convention: patient?.convention?.name || patient?.insuranceType || '[Patient Privé]',
          bloodType: patient?.bloodType || patient?.gsRhesus || '',
          hemoglobin: patient?.hemoglobinElectrophoresis || patient?.elHb || ''
        };

        // Draw table border
        doc.rect(40, tableStartY, tableWidth, rowHeight * 7).stroke(this.colors.text);
        // Vertical divider
        doc.moveTo(40 + leftColWidth, tableStartY)
          .lineTo(40 + leftColWidth, tableStartY + rowHeight * 7).stroke(this.colors.text);

        // Row 1: Noms | Né(e) le + Sexe
        let rowY = tableStartY;
        this.drawFicheTableRow(doc, 40, rowY, leftColWidth, rowHeight, 'Noms:', patientData.fullName);
        this.drawFicheTableRowMulti(doc, 40 + leftColWidth, rowY, rightColWidth, rowHeight, [
          { label: 'Né (e) le:', value: patientData.dateOfBirth, width: 150 },
          { label: 'Sexe:', value: patientData.sex, width: 80 }
        ]);
        doc.moveTo(40, rowY + rowHeight).lineTo(40 + tableWidth, rowY + rowHeight).stroke(this.colors.border);

        // Row 2: État-civil | Né(e) à
        rowY += rowHeight;
        this.drawFicheTableRow(doc, 40, rowY, leftColWidth, rowHeight, 'Etat-civil:', patientData.civilStatus);
        this.drawFicheTableRow(doc, 40 + leftColWidth, rowY, rightColWidth, rowHeight, 'Né (e) à:', patientData.birthPlace);
        doc.moveTo(40, rowY + rowHeight).lineTo(40 + tableWidth, rowY + rowHeight).stroke(this.colors.border);

        // Row 3: Téléphone | Profession
        rowY += rowHeight;
        this.drawFicheTableRow(doc, 40, rowY, leftColWidth, rowHeight, 'Téléphone:', patientData.phones);
        this.drawFicheTableRow(doc, 40 + leftColWidth, rowY, rightColWidth, rowHeight, 'Profession:', patientData.profession);
        doc.moveTo(40, rowY + rowHeight).lineTo(40 + tableWidth, rowY + rowHeight).stroke(this.colors.border);

        // Row 4: E-mail | Nationalité
        rowY += rowHeight;
        this.drawFicheTableRow(doc, 40, rowY, leftColWidth, rowHeight, 'E-mail:', patientData.email);
        this.drawFicheTableRow(doc, 40 + leftColWidth, rowY, rightColWidth, rowHeight, 'Nationalité:', patientData.nationality);
        doc.moveTo(40, rowY + rowHeight).lineTo(40 + tableWidth, rowY + rowHeight).stroke(this.colors.border);

        // Row 5: Avenue/N° | Quartier
        rowY += rowHeight;
        this.drawFicheTableRow(doc, 40, rowY, leftColWidth, rowHeight, 'Avenue / N°:', patientData.address);
        this.drawFicheTableRow(doc, 40 + leftColWidth, rowY, rightColWidth, rowHeight, 'Quartier:', patientData.quartier);
        doc.moveTo(40, rowY + rowHeight).lineTo(40 + tableWidth, rowY + rowHeight).stroke(this.colors.border);

        // Row 6: Commune | Tarif
        rowY += rowHeight;
        this.drawFicheTableRow(doc, 40, rowY, leftColWidth, rowHeight, 'Commune:', patientData.commune);
        this.drawFicheTableRow(doc, 40 + leftColWidth, rowY, rightColWidth, rowHeight, 'Tarif:', patientData.tarif);
        doc.moveTo(40, rowY + rowHeight).lineTo(40 + tableWidth, rowY + rowHeight).stroke(this.colors.border);

        // Row 7: Convention | GS Rhésus + El. Hb
        rowY += rowHeight;
        this.drawFicheTableRow(doc, 40, rowY, leftColWidth, rowHeight, 'Convention:', patientData.convention);
        this.drawFicheTableRowMulti(doc, 40 + leftColWidth, rowY, rightColWidth, rowHeight, [
          { label: 'GS Rhésus:', value: patientData.bloodType, width: 130 },
          { label: 'El. Hb:', value: patientData.hemoglobin, width: 100 }
        ]);

        doc.y = tableStartY + rowHeight * 7 + 15;

        // ===== ANTECEDENTS & ALLERGIES SECTION =====
        const antecedents = patient?.medicalHistory?.conditions?.join(', ') ||
                          patient?.antecedents || '';
        const allergies = Array.isArray(patient?.allergies)
          ? patient.allergies.map(a => typeof a === 'string' ? a : a.name || a.allergen).join(', ')
          : patient?.allergies || '';

        doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
          .text('Antécédents:', 40, doc.y);
        doc.font('Helvetica').text(antecedents || '', 110, doc.y - 12, { width: 440 });

        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text('Allergies:', 40, doc.y);
        doc.font('Helvetica').text(allergies || '', 100, doc.y - 12, { width: 450 });

        doc.moveDown(1);

        // ===== EXAM INFO BOX (bordered) =====
        const examBoxY = doc.y;
        const examBoxHeight = 55;
        doc.rect(40, examBoxY, tableWidth, examBoxHeight).stroke(this.colors.text);

        // Exam header row
        doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.text)
          .text('Réalisation Examen Ophta', 50, examBoxY + 8);

        const providerName = provider?.title ? `${provider.title} ${provider.firstName || ''} ${provider.lastName || ''}`.trim() :
          provider?.name || visit?.provider?.name || 'Dr';
        doc.text('Réalisé par:', 320, examBoxY + 8);
        doc.font('Helvetica').text(providerName, 395, examBoxY + 8);

        // Date and time
        const examDate = visit?.createdAt || visit?.date || new Date();
        const examTime = visit?.time || new Date(examDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        doc.font('Helvetica').fontSize(10)
          .text(`Date:  ${this.formatDate(examDate)}    ${examTime}`, 50, examBoxY + 25);

        // Visit number
        const visitNumber = visit?.visitId || visit?.visitNumber || documentNumber;
        doc.text(`N° Visite:  ${visitNumber}`, 50, examBoxY + 40);

        doc.y = examBoxY + examBoxHeight + 20;

        // ===== CLINICAL NOTES =====
        // Chief complaint
        const chiefComplaint = visit?.chiefComplaint || visit?.complaint?.complaint || visit?.reason || '';
        if (chiefComplaint) {
          doc.fontSize(10).font('Helvetica')
            .text(`- Plaintes / Symptômes :  ${chiefComplaint}`, 40, doc.y);
          doc.moveDown(1);
        }

        // ===== PRESCRIPTIONS SECTION =====
        if (prescriptions && prescriptions.length > 0) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor(this.colors.text)
            .text('PRESCRIPTIONS:', 40, doc.y);

          // Dashed line separator
          doc.strokeColor(this.colors.text).lineWidth(0.5);
          const dashY = doc.y + 3;
          for (let x = 40; x < 180; x += 6) {
            doc.moveTo(x, dashY).lineTo(x + 3, dashY).stroke();
          }
          doc.moveDown(0.8);

          prescriptions.forEach((rx, index) => {
            const medName = rx.medication || rx.name || rx.drug?.name || '';
            const dosageInstructions = this.buildPrescriptionInstructions(rx);
            const renewInstruction = rx.renew || rx.instruction || '';

            doc.fontSize(10).font('Helvetica').fillColor(this.colors.text);
            doc.text(`- ${medName}`, 40, doc.y);
            if (dosageInstructions) {
              doc.text(`  ${dosageInstructions}`, 50, doc.y);
            }
            if (renewInstruction) {
              doc.moveDown(0.3);
              doc.font('Helvetica-Bold').text(renewInstruction.toUpperCase(), 40, doc.y);
            }
            doc.moveDown(0.8);
          });
        }

        // ===== WARNING TEXT (bold, prominent) =====
        const warning = data.warning || visit?.warning || '';
        if (warning) {
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
            .text(warning.toUpperCase(), 40, doc.y);
          doc.moveDown(0.8);
        }

        // ===== NEXT APPOINTMENT =====
        const nextAppointment = data.nextAppointment || visit?.followUp?.instructions || '';
        if (nextAppointment) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
            .text('PROCHAIN RENDEZ-VOUS:', 40, doc.y);
          doc.font('Helvetica').text(nextAppointment, 40, doc.y);
          doc.moveDown(0.5);
        }

        // ===== DIAGNOSIS =====
        const diagnosis = visit?.diagnosis?.primary?.name || visit?.diagnosis?.primary ||
                         visit?.diagnosis || data.diagnosis || '';
        if (diagnosis) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(this.colors.text)
            .text('Diagnostics:', 40, doc.y, { continued: true });
          doc.font('Helvetica')
            .text(`   ${typeof diagnosis === 'object' ? diagnosis.name || JSON.stringify(diagnosis) : diagnosis}`);
        }

        // ===== FOOTER =====
        this.addFicheFooter(doc, clinic, pageNumber, totalPages);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Helper: Draw a row in the Fiche patient info table
   */
  drawFicheTableRow(doc, x, y, width, height, label, value) {
    const padding = 5;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(this.colors.text)
      .text(label, x + padding, y + 4, { width: 70 });
    doc.font('Helvetica').fontSize(9)
      .text(value || '', x + 75, y + 4, { width: width - 80 });
  }

  /**
   * Helper: Draw a row with multiple label-value pairs
   */
  drawFicheTableRowMulti(doc, x, y, width, height, items) {
    const padding = 5;
    let currentX = x + padding;

    items.forEach((item, index) => {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(this.colors.text)
        .text(item.label, currentX, y + 4);
      const labelWidth = doc.widthOfString(item.label) + 3;
      doc.font('Helvetica')
        .text(item.value || '', currentX + labelWidth, y + 4, { width: item.width - labelWidth - 5 });
      currentX += item.width;
    });
  }

  /**
   * Helper: Build prescription instructions string
   */
  buildPrescriptionInstructions(rx) {
    const parts = [];

    if (rx.dosage) parts.push(rx.dosage);
    if (rx.frequency) parts.push(rx.frequency);
    if (rx.applicationLocation?.eye) {
      const eyeMap = { 'OD': 'œil droit', 'OS': 'œil gauche', 'OU': 'les 2 yeux', 'both': 'les 2 yeux' };
      parts.push(`dans ${eyeMap[rx.applicationLocation.eye] || rx.applicationLocation.eye}`);
    }
    if (rx.duration) parts.push(`pendant ${rx.duration}`);

    return parts.join(', ');
  }

  /**
   * Helper: Add footer for Fiche d'Ophtalmologie
   */
  addFicheFooter(doc, clinic, pageNumber, totalPages) {
    const footerY = doc.page.height - 50;

    // Footer line
    doc.strokeColor(this.colors.border).lineWidth(0.5)
      .moveTo(40, footerY).lineTo(555, footerY).stroke();

    // Clinic info (centered)
    doc.fontSize(8).font('Helvetica').fillColor(this.colors.lightText);

    const address = clinic.address || '72A, Avenue Tombalbaye, C. Gombe, Kinshasa R.D. Congo';
    const phones = Array.isArray(clinic.phones) ? clinic.phones.join('  ') :
      clinic.phone || '+243 977 917 476  +243 993 715 460  +243 999 060 457';
    const taxInfo = clinic.taxId || 'N.I.F: A0707382H / ID Nat: N34964N';
    const email = clinic.email || 'info@laelvision.com';

    doc.text(`${address}`, 40, footerY + 8, { width: 450, align: 'left' });
    doc.text(`Tel: ${phones}`, 40, footerY + 18, { width: 450, align: 'left' });
    doc.text(`${taxInfo}  /  E-mail: ${email}`, 40, footerY + 28, { width: 450, align: 'left' });

    // Page number (right)
    doc.text(`Page ${pageNumber} sur ${totalPages}`, 480, footerY + 18, { width: 75, align: 'right' });
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
