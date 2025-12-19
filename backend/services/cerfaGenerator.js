const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * CERFA Document Generator Service
 * Generates CERFA-compliant medical documents in PDF format
 */

class CERFAGenerator {
  constructor() {
    this.documentDir = path.join(__dirname, '../generated_documents');

    // Create directory if it doesn't exist
    if (!fs.existsSync(this.documentDir)) {
      fs.mkdirSync(this.documentDir, { recursive: true });
    }
  }

  /**
   * Generate medical prescription (Ordonnance)
   */
  async generatePrescription(data) {
    const {
      doctor,
      patient,
      prescriptions,
      date = new Date(),
      prescriptionId,
      clinicInfo
    } = data;

    const filename = `ordonnance_${prescriptionId || Date.now()}.pdf`;
    const filepath = path.join(this.documentDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header with clinic info
        this._addHeader(doc, clinicInfo || {});

        // Doctor information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, { align: 'left' });
        doc.fontSize(10).font('Helvetica');
        if (doctor.specialization) {
          doc.text(doctor.specialization);
        }
        if (doctor.licenseNumber) {
          doc.text(`N° RPPS: ${doctor.licenseNumber}`);
        }

        // Date
        doc.moveDown(1);
        doc.fontSize(10);
        doc.text(`Date: ${this._formatDate(date)}`, { align: 'right' });

        // Document title
        doc.moveDown(2);
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text('ORDONNANCE', { align: 'center', underline: true });

        // Patient information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Patient:', { continued: false });
        doc.fontSize(11).font('Helvetica');
        doc.text(`${patient.firstName} ${patient.lastName}`);
        if (patient.dateOfBirth) {
          doc.text(`Né(e) le: ${this._formatDate(new Date(patient.dateOfBirth))}`);
        }
        if (patient.socialSecurityNumber) {
          doc.text(`N° Sécurité Sociale: ${patient.socialSecurityNumber}`);
        }

        // Prescriptions
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Prescriptions:', { underline: true });
        doc.moveDown(1);

        prescriptions.forEach((prescription, index) => {
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text(`${index + 1}. ${prescription.medication}`, { continued: false });

          doc.fontSize(10).font('Helvetica');
          const details = [];
          if (prescription.dosage) details.push(`Dosage: ${prescription.dosage}`);
          if (prescription.frequency) details.push(`Fréquence: ${prescription.frequency}`);
          if (prescription.duration) details.push(`Durée: ${prescription.duration}`);
          if (prescription.instructions) details.push(`Instructions: ${prescription.instructions}`);

          details.forEach(detail => {
            doc.text(`   ${detail}`);
          });

          doc.moveDown(0.5);
        });

        // Additional notes
        if (data.notes) {
          doc.moveDown(1);
          doc.fontSize(10).font('Helvetica-Oblique');
          doc.text(`Notes: ${data.notes}`, { align: 'left' });
        }

        // Signature section
        doc.moveDown(3);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Fait à ${clinicInfo?.city || '___________'}, le ${this._formatDate(date)}`, { align: 'right' });
        doc.moveDown(1);
        doc.text('Signature et cachet du médecin:', { align: 'right' });
        doc.moveDown(3);
        doc.text('_________________________', { align: 'right' });

        // Footer
        this._addFooter(doc, clinicInfo || {});

        doc.end();

        stream.on('finish', () => {
          resolve({ filepath, filename });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate medical certificate (Certificat Médical)
   */
  async generateMedicalCertificate(data) {
    const {
      doctor,
      patient,
      certificateType = 'general',
      reason,
      findings,
      date = new Date(),
      certificateId,
      clinicInfo
    } = data;

    const filename = `certificat_medical_${certificateId || Date.now()}.pdf`;
    const filepath = path.join(this.documentDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header
        this._addHeader(doc, clinicInfo || {});

        // Doctor information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, { align: 'left' });
        doc.fontSize(10).font('Helvetica');
        if (doctor.specialization) doc.text(doctor.specialization);
        if (doctor.licenseNumber) doc.text(`N° RPPS: ${doctor.licenseNumber}`);

        // Document title
        doc.moveDown(3);
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text('CERTIFICAT MÉDICAL', { align: 'center', underline: true });

        // Certificate content
        doc.moveDown(2);
        doc.fontSize(11).font('Helvetica');
        doc.text('Je soussigné(e),', { continued: false });
        doc.moveDown(0.5);
        doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}, ${doctor.specialization || 'Médecin'}`, { indent: 20 });

        doc.moveDown(1);
        doc.text('Certifie avoir examiné ce jour:', { continued: false });
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold');
        doc.text(`${patient.firstName} ${patient.lastName}`, { indent: 20 });
        doc.font('Helvetica');
        if (patient.dateOfBirth) {
          doc.text(`Né(e) le: ${this._formatDate(new Date(patient.dateOfBirth))}`, { indent: 20 });
        }
        if (patient.address) {
          doc.text(`Domicilié(e): ${patient.address}`, { indent: 20 });
        }

        // Findings
        if (findings) {
          doc.moveDown(1.5);
          doc.text('Constatations:', { continued: false });
          doc.moveDown(0.5);
          doc.text(findings, { indent: 20, align: 'justify' });
        }

        // Reason for certificate
        if (reason) {
          doc.moveDown(1.5);
          doc.text('Motif du certificat:', { continued: false });
          doc.moveDown(0.5);
          doc.text(reason, { indent: 20, align: 'justify' });
        }

        // Legal notice
        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica-Oblique');
        doc.text('Certificat établi à la demande de l\'intéressé(e) et remis en main propre pour faire valoir ce que de droit.',
          { align: 'justify' });

        // Date and signature
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Fait à ${clinicInfo?.city || '___________'}, le ${this._formatDate(date)}`, { align: 'right' });
        doc.moveDown(1);
        doc.text('Signature et cachet du médecin:', { align: 'right' });
        doc.moveDown(3);
        doc.text('_________________________', { align: 'right' });

        // Footer
        this._addFooter(doc, clinicInfo || {});

        doc.end();

        stream.on('finish', () => {
          resolve({ filepath, filename });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate sick leave certificate (Arrêt de travail)
   */
  async generateSickLeave(data) {
    const {
      doctor,
      patient,
      startDate,
      endDate,
      reason,
      restrictions = [],
      date = new Date(),
      certificateId,
      clinicInfo
    } = data;

    const filename = `arret_travail_${certificateId || Date.now()}.pdf`;
    const filepath = path.join(this.documentDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header
        this._addHeader(doc, clinicInfo || {});

        // Doctor information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, { align: 'left' });
        doc.fontSize(10).font('Helvetica');
        if (doctor.specialization) doc.text(doctor.specialization);
        if (doctor.licenseNumber) doc.text(`N° RPPS: ${doctor.licenseNumber}`);

        // Document title
        doc.moveDown(3);
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text('ARRÊT DE TRAVAIL', { align: 'center', underline: true });

        // Patient information
        doc.moveDown(2);
        doc.fontSize(11).font('Helvetica');
        doc.text('Je soussigné(e),', { continued: false });
        doc.moveDown(0.5);
        doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}, ${doctor.specialization || 'Médecin'}`, { indent: 20 });

        doc.moveDown(1);
        doc.text('Certifie que l\'état de santé de:', { continued: false });
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold');
        doc.text(`${patient.firstName} ${patient.lastName}`, { indent: 20 });
        doc.font('Helvetica');
        if (patient.dateOfBirth) {
          doc.text(`Né(e) le: ${this._formatDate(new Date(patient.dateOfBirth))}`, { indent: 20 });
        }
        if (patient.socialSecurityNumber) {
          doc.text(`N° Sécurité Sociale: ${patient.socialSecurityNumber}`, { indent: 20 });
        }

        // Leave period
        doc.moveDown(1.5);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Nécessite un arrêt de travail:', { continued: false });
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Du ${this._formatDate(new Date(startDate))} au ${this._formatDate(new Date(endDate))} inclus`,
          { indent: 20 });

        // Calculate duration
        const duration = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        doc.text(`Durée: ${duration} jour(s)`, { indent: 20 });

        // Restrictions
        if (restrictions && restrictions.length > 0) {
          doc.moveDown(1.5);
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('Restrictions:', { continued: false });
          doc.font('Helvetica');
          doc.moveDown(0.5);
          restrictions.forEach(restriction => {
            doc.text(`• ${restriction}`, { indent: 20 });
          });
        }

        // Authorization for outings
        doc.moveDown(1.5);
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Sorties autorisées:', { continued: false });
        doc.font('Helvetica');
        doc.moveDown(0.5);
        const outingsAllowed = data.outingsAllowed !== false;
        doc.text(outingsAllowed ? '☑ Oui  ☐ Non' : '☐ Oui  ☑ Non', { indent: 20 });

        // Reason (optional, medical confidentiality)
        if (reason && data.includeReason) {
          doc.moveDown(1.5);
          doc.fontSize(10).font('Helvetica-Oblique');
          doc.text(`Motif (confidentiel): ${reason}`, { indent: 20 });
        }

        // Legal notice
        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica-Oblique');
        doc.text('Certificat établi conformément aux dispositions du Code de la Sécurité Sociale.',
          { align: 'justify' });

        // Date and signature
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Fait à ${clinicInfo?.city || '___________'}, le ${this._formatDate(date)}`, { align: 'right' });
        doc.moveDown(1);
        doc.text('Signature et cachet du médecin:', { align: 'right' });
        doc.moveDown(3);
        doc.text('_________________________', { align: 'right' });

        // Footer
        this._addFooter(doc, clinicInfo || {});

        doc.end();

        stream.on('finish', () => {
          resolve({ filepath, filename });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate invoice (Facture)
   */
  async generateInvoice(data) {
    const {
      invoiceNumber,
      date = new Date(),
      patient,
      doctor,
      items = [],
      subtotal,
      tax = 0,
      total,
      paymentMethod,
      clinicInfo
    } = data;

    const filename = `facture_${invoiceNumber || Date.now()}.pdf`;
    const filepath = path.join(this.documentDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header
        this._addHeader(doc, clinicInfo || {});

        // Invoice title and number
        doc.moveDown(2);
        doc.fontSize(20).font('Helvetica-Bold');
        doc.text('FACTURE', { align: 'center' });
        doc.fontSize(12);
        doc.text(`N° ${invoiceNumber}`, { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Date: ${this._formatDate(date)}`, { align: 'right' });

        // Patient information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Patient:', { continued: false });
        doc.fontSize(10).font('Helvetica');
        doc.text(`${patient.firstName} ${patient.lastName}`);
        if (patient.address) doc.text(patient.address);
        if (patient.phone) doc.text(`Tél: ${patient.phone}`);

        // Items table header
        doc.moveDown(2);
        const tableTop = doc.y;
        const descriptionX = 50;
        const quantityX = 350;
        const priceX = 420;
        const totalX = 490;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Description', descriptionX, tableTop);
        doc.text('Qté', quantityX, tableTop);
        doc.text('Prix unit.', priceX, tableTop);
        doc.text('Total', totalX, tableTop);

        // Draw line
        doc.moveTo(50, tableTop + 15)
          .lineTo(550, tableTop + 15)
          .stroke();

        // Items
        let currentY = tableTop + 25;
        doc.font('Helvetica');
        items.forEach(item => {
          doc.text(item.description, descriptionX, currentY, { width: 280 });
          doc.text(item.quantity.toString(), quantityX, currentY);
          doc.text(`${item.price.toFixed(2)} €`, priceX, currentY);
          doc.text(`${(item.quantity * item.price).toFixed(2)} €`, totalX, currentY);
          currentY += 25;
        });

        // Totals
        currentY += 10;
        doc.moveTo(50, currentY)
          .lineTo(550, currentY)
          .stroke();

        currentY += 15;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Sous-total:', priceX, currentY);
        doc.font('Helvetica');
        doc.text(`${subtotal.toFixed(2)} €`, totalX, currentY);

        if (tax > 0) {
          currentY += 20;
          doc.font('Helvetica-Bold');
          doc.text('TVA:', priceX, currentY);
          doc.font('Helvetica');
          doc.text(`${tax.toFixed(2)} €`, totalX, currentY);
        }

        currentY += 25;
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('TOTAL:', priceX, currentY);
        doc.text(`${total.toFixed(2)} €`, totalX, currentY);

        // Payment information
        if (paymentMethod) {
          doc.moveDown(2);
          doc.fontSize(10).font('Helvetica');
          doc.text(`Mode de paiement: ${paymentMethod}`, { align: 'left' });
        }

        // Footer
        this._addFooter(doc, clinicInfo || {});

        doc.end();

        stream.on('finish', () => {
          resolve({ filepath, filename });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate optical prescription (Ordonnance Optique)
   */
  async generateOpticalPrescription(data) {
    const {
      doctor,
      patient,
      refraction,
      keratometry,
      iop,
      pupilDistance,
      lensTypes = [],
      comments,
      date = new Date(),
      prescriptionId,
      clinicInfo,
      validityMonths = 12
    } = data;

    const filename = `ordonnance_optique_${prescriptionId || Date.now()}.pdf`;
    const filepath = path.join(this.documentDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header
        this._addHeader(doc, clinicInfo || {});

        // Doctor information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, { align: 'left' });
        doc.fontSize(10).font('Helvetica');
        if (doctor.specialization) {
          doc.text(doctor.specialization);
        }
        if (doctor.licenseNumber) {
          doc.text(`N° RPPS: ${doctor.licenseNumber}`);
        }

        // Date
        doc.moveDown(1);
        doc.fontSize(10);
        doc.text(`Date: ${this._formatDate(date)}`, { align: 'right' });

        // Document title
        doc.moveDown(2);
        doc.fontSize(18).font('Helvetica-Bold');
        doc.text('ORDONNANCE OPTIQUE', { align: 'center', underline: true });

        // Patient information
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Patient:', { continued: false });
        doc.fontSize(11).font('Helvetica');
        doc.text(`${patient.firstName} ${patient.lastName}`);
        if (patient.dateOfBirth) {
          const age = Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
          doc.text(`Né(e) le: ${this._formatDate(new Date(patient.dateOfBirth))} (${age} ans)`);
        }
        if (patient.socialSecurityNumber) {
          doc.text(`N° Sécurité Sociale: ${patient.socialSecurityNumber}`);
        }

        // Refraction table
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('CORRECTION PRESCRITE', { underline: true });
        doc.moveDown(1);

        // Table headers
        const tableTop = doc.y;
        const col1 = 80;
        const col2 = 180;
        const col3 = 280;
        const col4 = 380;
        const col5 = 480;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Œil', col1, tableTop);
        doc.text('Sphère', col2, tableTop);
        doc.text('Cylindre', col3, tableTop);
        doc.text('Axe', col4, tableTop);
        doc.text('AV', col5, tableTop);

        // Line under headers
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // OD (Right eye) data
        doc.fontSize(10).font('Helvetica');
        const row1Y = tableTop + 25;
        doc.font('Helvetica-Bold').text('OD (Droit)', col1, row1Y);
        doc.font('Helvetica');
        if (refraction?.OD) {
          doc.text(this._formatDiopter(refraction.OD.sphere), col2, row1Y);
          doc.text(this._formatDiopter(refraction.OD.cylinder), col3, row1Y);
          doc.text(refraction.OD.axis ? `${refraction.OD.axis}°` : '-', col4, row1Y);
          doc.text(refraction.OD.va || '-', col5, row1Y);
        }

        // OS (Left eye) data
        const row2Y = row1Y + 20;
        doc.font('Helvetica-Bold').text('OG (Gauche)', col1, row2Y);
        doc.font('Helvetica');
        if (refraction?.OS) {
          doc.text(this._formatDiopter(refraction.OS.sphere), col2, row2Y);
          doc.text(this._formatDiopter(refraction.OS.cylinder), col3, row2Y);
          doc.text(refraction.OS.axis ? `${refraction.OS.axis}°` : '-', col4, row2Y);
          doc.text(refraction.OS.va || '-', col5, row2Y);
        }

        doc.moveTo(50, row2Y + 15).lineTo(550, row2Y + 15).stroke();

        // Addition for presbyopia
        if (refraction?.add) {
          doc.moveDown(3);
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text(`Addition pour la vision de près: +${refraction.add.toFixed(2)} D`, { indent: 20 });
        }

        // Pupillary distance
        if (pupilDistance) {
          doc.moveDown(1);
          doc.fontSize(10).font('Helvetica');
          doc.text(`Écart pupillaire: ${pupilDistance.binocular}mm (OD: ${pupilDistance.OD}mm, OG: ${pupilDistance.OS}mm)`, { indent: 20 });
        }

        // IOP/Tension
        if (iop) {
          doc.moveDown(1);
          doc.fontSize(10).font('Helvetica');
          doc.text(`Tension oculaire: TOD ${iop.OD?.value || 0} mmHg, TOG ${iop.OS?.value || 0} mmHg`, { indent: 20 });
        }

        // Lens types prescribed
        if (lensTypes && lensTypes.length > 0) {
          doc.moveDown(2);
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('Type de verres prescrits:', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica');
          const lensTypeLabels = {
            far: 'Vision de loin',
            near: 'Vision de près',
            two_pairs: 'Deux paires (loin + près)',
            progressive: 'Verres progressifs',
            bifocal: 'Verres bifocaux',
            varifocal: 'Verres varifocaux'
          };
          lensTypes.forEach(type => {
            doc.text(`• ${lensTypeLabels[type] || type}`, { indent: 20 });
          });
        }

        // Comments
        if (comments) {
          doc.moveDown(2);
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('Commentaires:', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica');
          doc.text(comments, { indent: 20, align: 'justify' });
        }

        // Keratometry (if provided)
        if (keratometry && (keratometry.OD || keratometry.OS)) {
          doc.moveDown(2);
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('Kératométrie:', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(9).font('Helvetica');
          if (keratometry.OD) {
            doc.text(`OD: K1 ${keratometry.OD.k1?.power || 0}D à ${keratometry.OD.k1?.axis || 0}°, K2 ${keratometry.OD.k2?.power || 0}D à ${keratometry.OD.k2?.axis || 0}°`, { indent: 20 });
          }
          if (keratometry.OS) {
            doc.text(`OG: K1 ${keratometry.OS.k1?.power || 0}D à ${keratometry.OS.k1?.axis || 0}°, K2 ${keratometry.OS.k2?.power || 0}D à ${keratometry.OS.k2?.axis || 0}°`, { indent: 20 });
          }
        }

        // Validity period
        doc.moveDown(2);
        const validUntil = new Date(date);
        validUntil.setMonth(validUntil.getMonth() + validityMonths);
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(`Ordonnance valable jusqu'au: ${this._formatDate(validUntil)}`, { align: 'center' });

        // Signature section
        doc.moveDown(3);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Fait à ${clinicInfo?.city || '___________'}, le ${this._formatDate(date)}`, { align: 'right' });
        doc.moveDown(1);
        doc.text('Signature et cachet du prescripteur:', { align: 'right' });
        doc.moveDown(3);
        doc.text('_________________________', { align: 'right' });

        // Footer
        this._addFooter(doc, clinicInfo || {});

        doc.end();

        stream.on('finish', () => {
          resolve({ filepath, filename });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Helper: Format diopter value with + or - sign
   */
  _formatDiopter(value) {
    if (value === null || value === undefined || value === '') return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return num >= 0 ? `+${num.toFixed(2)}` : `${num.toFixed(2)}`;
  }

  /**
   * Helper: Add header to document
   */
  _addHeader(doc, clinicInfo) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text(clinicInfo.name || 'Cabinet Médical', { align: 'center' });

    doc.fontSize(10).font('Helvetica');
    if (clinicInfo.address) doc.text(clinicInfo.address, { align: 'center' });
    if (clinicInfo.phone) doc.text(`Tél: ${clinicInfo.phone}`, { align: 'center' });
    if (clinicInfo.email) doc.text(`Email: ${clinicInfo.email}`, { align: 'center' });

    doc.moveDown(1);
    doc.moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();
  }

  /**
   * Helper: Add footer to document
   */
  _addFooter(doc, clinicInfo) {
    const bottomY = doc.page.height - 80;

    doc.fontSize(8).font('Helvetica-Oblique');
    doc.text(
      clinicInfo.footer || 'Document généré automatiquement par MedFlow',
      50,
      bottomY,
      { align: 'center', width: 500 }
    );
  }

  /**
   * Helper: Format date in French format
   */
  _formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Delete generated document
   */
  async deleteDocument(filename) {
    const filepath = path.join(this.documentDir, filename);

    return new Promise((resolve, reject) => {
      fs.unlink(filepath, (err) => {
        if (err) {
          if (err.code === 'ENOENT') {
            resolve({ success: false, message: 'File not found' });
          } else {
            reject(err);
          }
        } else {
          resolve({ success: true, message: 'Document deleted' });
        }
      });
    });
  }

  /**
   * Get document path
   */
  getDocumentPath(filename) {
    return path.join(this.documentDir, filename);
  }
}

// Create singleton instance
const cerfaGenerator = new CERFAGenerator();

module.exports = cerfaGenerator;
