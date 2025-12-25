/**
 * SurgeryService - Domain Service for Surgery Case Management
 *
 * Handles:
 * - SurgeryCase creation from paid invoice items (at 100% payment)
 * - Surgery type detection from clinical acts and descriptions
 * - Eye laterality detection (OD/OS/OU)
 * - Status management and history tracking
 *
 * Extracted from invoiceController for better separation of concerns.
 */

const SurgeryCase = require('../../models/SurgeryCase');
const ClinicalAct = require('../../models/ClinicalAct');
const { invoice: invoiceLogger } = require('../../utils/structuredLogger');

// Surgery keywords in descriptions (French/English)
const SURGERY_KEYWORDS = [
  'phaco', 'phacoémulsification', 'cataracte', 'cataract',
  'trabéculectomie', 'trabeculectomie', 'trabeculectomy',
  'vitrectomie', 'vitrectomy',
  'kératoplastie', 'keratoplastie', 'keratoplasty',
  'implant', 'iol', 'lentille intraoculaire',
  'chirurgie', 'surgery', 'opération',
  'greffe', 'transplant', 'cornée',
  'glaucome', 'glaucoma',
  'strabisme', 'ptosis', 'blépharoplastie',
  'injection intravitréenne', 'ivt'
];

class SurgeryService {
  constructor() {
    this._surgeryActsCache = null;
    this._cacheExpiry = null;
  }

  /**
   * Get surgery clinical acts with caching (5 min TTL)
   * @private
   */
  async getSurgeryActs() {
    const now = Date.now();
    if (this._surgeryActsCache && this._cacheExpiry && now < this._cacheExpiry) {
      return this._surgeryActsCache;
    }

    this._surgeryActsCache = await ClinicalAct.find({
      category: { $regex: /chirurgie/i }
    }).select('_id code name category').lean();

    this._cacheExpiry = now + 5 * 60 * 1000; // 5 minutes
    return this._surgeryActsCache;
  }

  /**
   * Clear the surgery acts cache (for testing or config changes)
   */
  clearCache() {
    this._surgeryActsCache = null;
    this._cacheExpiry = null;
  }

  /**
   * Detect if an invoice item is a surgery item
   *
   * @param {Object} item - Invoice item
   * @param {Array} surgeryActCodes - Array of surgery act codes (lowercase)
   * @returns {boolean}
   */
  isSurgeryItem(item, surgeryActCodes = []) {
    const itemCode = item.code?.toLowerCase() || '';
    const itemCategory = item.category?.toLowerCase() || '';
    const itemDesc = item.description?.toLowerCase() || '';

    return (
      // 1. Item category is 'surgery' (Invoice schema enum)
      itemCategory === 'surgery' ||
      // 2. Item code matches a surgery clinical act code
      surgeryActCodes.includes(itemCode) ||
      // 3. Item category contains 'chirurgie'
      itemCategory.includes('chirurgie') ||
      // 4. Description contains surgery keywords
      SURGERY_KEYWORDS.some(keyword => itemDesc.includes(keyword))
    );
  }

  /**
   * Detect eye laterality from item description
   *
   * @param {string} description - Item description
   * @returns {string} 'OD' | 'OS' | 'OU' | 'N/A'
   */
  detectEye(description) {
    const desc = description?.toLowerCase() || '';

    if (desc.includes(' od') || desc.includes('(od)') ||
        desc.includes('œil droit') || desc.includes('oeil droit')) {
      return 'OD';
    }

    if (desc.includes(' os') || desc.includes('(os)') ||
        desc.includes('œil gauche') || desc.includes('oeil gauche')) {
      return 'OS';
    }

    if (desc.includes(' ou') || desc.includes('(ou)') ||
        desc.includes('deux yeux') || desc.includes('bilatéral')) {
      return 'OU';
    }

    return 'N/A';
  }

  /**
   * Find matching surgery type (ClinicalAct) for an item
   *
   * @param {Object} item - Invoice item
   * @param {Array} surgeryActs - Available surgery clinical acts
   * @returns {ObjectId|null} Surgery type ID
   */
  findSurgeryType(item, surgeryActs) {
    const itemCode = item.code?.toLowerCase() || '';
    const itemDesc = item.description?.toLowerCase() || '';

    // Try to match by code first
    if (itemCode) {
      const matchByCode = surgeryActs.find(act =>
        act.code?.toLowerCase() === itemCode
      );
      if (matchByCode) return matchByCode._id;
    }

    // Try to find by name similarity in description
    if (itemDesc) {
      const matchByName = surgeryActs.find(act =>
        itemDesc.includes(act.name?.toLowerCase() || '')
      );
      if (matchByName) return matchByName._id;
    }

    // Fallback: try to find a generic cataract surgery
    const genericMatch = surgeryActs.find(act =>
      act.code?.toLowerCase().includes('phaco') ||
      act.name?.toLowerCase().includes('cataracte')
    );
    if (genericMatch) return genericMatch._id;

    return null;
  }

  /**
   * Create surgery cases for newly paid invoice items (at 100% item payment)
   * This is called when individual items are fully paid.
   *
   * @param {Object} invoice - Invoice document
   * @param {Array} paidItems - Array of { itemIndex, item } for newly paid items
   * @param {string} userId - User ID
   * @param {Object} session - Optional MongoDB session for transaction support
   * @returns {Array} Created SurgeryCase documents
   */
  async createCasesForPaidItems(invoice, paidItems, userId, session = null) {
    if (!paidItems || paidItems.length === 0) {
      return [];
    }

    try {
      const surgeryActs = await this.getSurgeryActs();
      const surgeryActCodes = surgeryActs.map(act => act.code?.toLowerCase()).filter(Boolean);

      const casesToCreate = [];

      for (const { itemIndex, item } of paidItems) {
        // Skip if already processed
        if (item.surgeryCaseCreated) {
          continue;
        }

        // Check if this is a surgery item
        if (!this.isSurgeryItem(item, surgeryActCodes)) {
          continue;
        }

        const surgeryType = this.findSurgeryType(item, surgeryActs);
        const eye = this.detectEye(item.description);

        casesToCreate.push({
          patient: invoice.patient,
          clinic: invoice.clinic,
          consultation: invoice.consultation,
          invoice: invoice._id,
          surgeryType: surgeryType,
          surgeryDescription: !surgeryType ? item.description : undefined,
          eye: eye,
          status: 'awaiting_scheduling',
          paymentDate: new Date(),
          createdBy: userId,
          statusHistory: [{
            status: 'awaiting_scheduling',
            changedAt: new Date(),
            changedBy: userId,
            notes: `Créé après paiement de l'item "${item.description}" sur facture ${invoice.invoiceId}`
          }],
          _invoiceItemIndex: itemIndex // Temporary field for linking
        });

        invoiceLogger.info('Surgery item fully paid', {
          description: item.description,
          itemIndex,
          surgeryType: surgeryType || 'none'
        });
      }

      if (casesToCreate.length === 0) {
        return [];
      }

      // Create cases in batch (with optional session for transaction support)
      const insertOptions = session ? { session } : {};
      const createdCases = await SurgeryCase.insertMany(casesToCreate, insertOptions);

      // Update invoice items to mark surgery cases created
      for (let i = 0; i < createdCases.length; i++) {
        const surgeryCase = createdCases[i];
        const itemIndex = casesToCreate[i]._invoiceItemIndex;

        if (itemIndex !== undefined && invoice.items[itemIndex]) {
          invoice.items[itemIndex].surgeryCaseCreated = true;
          invoice.items[itemIndex].surgeryCaseId = surgeryCase._id;
        }
      }

      // Save with session if provided
      if (session) {
        await invoice.save({ session });
      } else {
        await invoice.save();
      }

      invoiceLogger.info('Surgery cases created for paid items', {
        invoiceId: invoice.invoiceId,
        count: createdCases.length
      });

      return createdCases;

    } catch (err) {
      invoiceLogger.error('Error creating surgery cases for paid items', {
        error: err.message,
        stack: err.stack,
        invoiceId: invoice._id
      });
      // If in transaction, let the error bubble up; otherwise return empty
      if (session) {
        throw err;
      }
      return [];
    }
  }

  /**
   * Create surgery cases when entire invoice is paid (legacy behavior)
   * Checks for any remaining surgery items that don't have cases yet.
   *
   * @param {Object} invoice - Invoice document
   * @param {string} userId - User ID
   * @param {Object} session - Optional MongoDB session for transaction support
   * @returns {Array} Created SurgeryCase documents
   */
  async createCasesIfNeeded(invoice, userId, session = null) {
    try {
      const surgeryActs = await this.getSurgeryActs();
      const surgeryActCodes = surgeryActs.map(act => act.code?.toLowerCase()).filter(Boolean);

      const casesToCreate = [];

      for (let i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i];

        // Skip if already processed
        if (item.surgeryCaseCreated) {
          continue;
        }

        // Check if this is a surgery item
        if (!this.isSurgeryItem(item, surgeryActCodes)) {
          continue;
        }

        const surgeryType = this.findSurgeryType(item, surgeryActs);
        const eye = this.detectEye(item.description);

        casesToCreate.push({
          patient: invoice.patient,
          clinic: invoice.clinic,
          consultation: invoice.consultation,
          invoice: invoice._id,
          surgeryType: surgeryType,
          surgeryDescription: !surgeryType ? item.description : undefined,
          eye: eye,
          status: 'awaiting_scheduling',
          paymentDate: new Date(),
          createdBy: userId,
          statusHistory: [{
            status: 'awaiting_scheduling',
            changedAt: new Date(),
            changedBy: userId,
            notes: `Créé automatiquement après paiement de la facture ${invoice.invoiceId}`
          }],
          _invoiceItemIndex: i
        });

        invoiceLogger.info('Detected surgery item', {
          description: item.description,
          category: item.category,
          code: item.code,
          surgeryType: surgeryType || 'none'
        });
      }

      if (casesToCreate.length === 0) {
        return [];
      }

      // Create cases in batch (with optional session for transaction support)
      const insertOptions = session ? { session } : {};
      const createdCases = await SurgeryCase.insertMany(casesToCreate, insertOptions);

      // Update invoice items
      for (let j = 0; j < createdCases.length; j++) {
        const surgeryCase = createdCases[j];
        const itemIndex = casesToCreate[j]._invoiceItemIndex;

        if (itemIndex !== undefined && invoice.items[itemIndex]) {
          invoice.items[itemIndex].surgeryCaseCreated = true;
          invoice.items[itemIndex].surgeryCaseId = surgeryCase._id;
        }
      }

      // Save with session if provided
      if (session) {
        await invoice.save({ session });
      } else {
        await invoice.save();
      }

      invoiceLogger.info('Surgery cases created from invoice', {
        invoiceId: invoice.invoiceId,
        count: createdCases.length
      });

      return createdCases;

    } catch (err) {
      invoiceLogger.error('Error creating surgery cases from invoice', {
        error: err.message,
        stack: err.stack
      });
      // If in transaction, let the error bubble up; otherwise return empty
      if (session) {
        throw err;
      }
      return [];
    }
  }

  /**
   * Update surgery case status with history tracking
   *
   * @param {string} caseId - SurgeryCase ID
   * @param {string} newStatus - New status
   * @param {string} userId - User making the change
   * @param {string} [notes] - Optional notes
   * @returns {Object} Updated SurgeryCase
   */
  async updateStatus(caseId, newStatus, userId, notes = '') {
    const surgeryCase = await SurgeryCase.findById(caseId);

    if (!surgeryCase) {
      throw new Error('Surgery case not found');
    }

    const previousStatus = surgeryCase.status;

    surgeryCase.status = newStatus;
    surgeryCase.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy: userId,
      previousStatus,
      notes
    });

    // Set specific date fields based on status
    if (newStatus === 'scheduled') {
      // scheduledDate should be set separately
    } else if (newStatus === 'completed') {
      surgeryCase.completedAt = new Date();
      surgeryCase.completedBy = userId;
    } else if (newStatus === 'cancelled') {
      surgeryCase.cancelledAt = new Date();
      surgeryCase.cancelledBy = userId;
      surgeryCase.cancellationReason = notes;
    }

    await surgeryCase.save();

    invoiceLogger.info('Surgery case status updated', {
      caseId,
      previousStatus,
      newStatus,
      userId
    });

    return surgeryCase;
  }

  /**
   * Cancel a surgery case
   *
   * @param {string} caseId - SurgeryCase ID
   * @param {string} reason - Cancellation reason
   * @param {string} userId - User cancelling
   * @returns {Object} Cancelled SurgeryCase
   */
  async cancelCase(caseId, reason, userId) {
    return this.updateStatus(caseId, 'cancelled', userId, reason);
  }

  /**
   * Get pending surgery cases for a clinic
   *
   * @param {string} clinicId - Clinic ID
   * @param {Object} [options] - Options
   * @param {string} [options.status] - Filter by status
   * @param {Date} [options.fromDate] - From date
   * @param {Date} [options.toDate] - To date
   * @returns {Array} Surgery cases
   */
  async getPendingCases(clinicId, options = {}) {
    const query = {
      clinic: clinicId,
      status: { $nin: ['completed', 'cancelled'] }
    };

    if (options.status) {
      query.status = options.status;
    }

    if (options.fromDate || options.toDate) {
      query.createdAt = {};
      if (options.fromDate) query.createdAt.$gte = options.fromDate;
      if (options.toDate) query.createdAt.$lte = options.toDate;
    }

    return SurgeryCase.find(query)
      .populate('patient', 'firstName lastName patientId')
      .populate('surgeryType', 'code name category')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get surgery cases for a specific patient
   *
   * @param {string} patientId - Patient ID
   * @returns {Array} Surgery cases
   */
  async getPatientCases(patientId) {
    return SurgeryCase.find({ patient: patientId })
      .populate('surgeryType', 'code name category')
      .populate('clinic', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }
}

// Export singleton instance
module.exports = new SurgeryService();
