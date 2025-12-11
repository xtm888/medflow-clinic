const Approval = require('../models/Approval');
const Company = require('../models/Company');
const Patient = require('../models/Patient');
const FeeSchedule = require('../models/FeeSchedule');
const Invoice = require('../models/Invoice');
const currencyService = require('../services/currencyService');

/**
 * Helper: Update pending invoices when approval status changes
 * - If APPROVED: Recalculate to apply company coverage
 * - If REJECTED: Keep patient paying 100% (no change needed, just update flag)
 */
async function updatePendingInvoicesForApproval(approval, isApproved) {
  try {
    // Find unpaid/partial invoices for this patient+company with matching actCode
    const invoices = await Invoice.find({
      patient: approval.patient,
      'companyBilling.company': approval.company,
      status: { $in: ['pending', 'issued', 'partial'] },
      'items.code': { $regex: new RegExp(`^${approval.actCode}$`, 'i') }
    });

    if (invoices.length === 0) {
      console.log(`[Approval] No pending invoices to update for ${approval.approvalId}`);
      return { updated: 0 };
    }

    const company = await Company.findById(approval.company);
    if (!company) {
      console.log(`[Approval] Company not found for ${approval.approvalId}`);
      return { updated: 0, error: 'Company not found' };
    }

    let updatedCount = 0;

    for (const invoice of invoices) {
      let invoiceModified = false;
      let totalCompanyShare = 0;
      let totalPatientShare = 0;

      const updatedItems = invoice.items.map(item => {
        const itemObj = item.toObject ? item.toObject() : { ...item };

        // Check if this item matches the approval actCode
        if (item.code?.toUpperCase() === approval.actCode?.toUpperCase()) {
          const categorySettings = company.coveredCategories?.find(c => c.category === item.category);
          const baseCoverage = categorySettings?.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;

          if (isApproved) {
            // APPROVED: Apply company coverage
            const companyShare = Math.round((item.total || item.unitPrice || 0) * baseCoverage / 100);
            const patientShare = (item.total || item.unitPrice || 0) - companyShare;

            itemObj.hasApproval = true;
            itemObj.approvalStatus = 'approved';
            itemObj.coveragePercentage = baseCoverage;
            itemObj.companyShare = companyShare;
            itemObj.patientShare = patientShare;

            totalCompanyShare += companyShare;
            totalPatientShare += patientShare;
            invoiceModified = true;
          } else {
            // REJECTED: Patient pays 100%
            itemObj.hasApproval = false;
            itemObj.approvalStatus = 'rejected';
            itemObj.coveragePercentage = 0;
            itemObj.companyShare = 0;
            itemObj.patientShare = item.total || item.unitPrice || 0;

            totalCompanyShare += 0;
            totalPatientShare += (item.total || item.unitPrice || 0);
            invoiceModified = true;
          }
        } else {
          // Keep existing shares for other items
          totalCompanyShare += itemObj.companyShare || 0;
          totalPatientShare += itemObj.patientShare || (itemObj.total || itemObj.unitPrice || 0);
        }

        return itemObj;
      });

      if (invoiceModified) {
        // Update invoice
        await Invoice.updateOne(
          { _id: invoice._id },
          {
            $set: {
              items: updatedItems,
              'companyBilling.companyShare': totalCompanyShare,
              'companyBilling.patientShare': totalPatientShare,
              'companyBilling.hasApprovalIssues': !isApproved,
              'summary.amountDue': Math.max(0, totalPatientShare - (invoice.summary?.amountPaid || 0))
            }
          }
        );
        updatedCount++;
        console.log(`[Approval] Updated invoice ${invoice.invoiceNumber} - Company: ${totalCompanyShare}, Patient: ${totalPatientShare}`);
      }
    }

    return { updated: updatedCount };
  } catch (error) {
    console.error('[Approval] Error updating invoices:', error);
    return { updated: 0, error: error.message };
  }
}

// @desc    Get all approvals with filters
// @route   GET /api/approvals
// @access  Private
exports.getApprovals = async (req, res) => {
  try {
    const { status, company, patient, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (company) query.company = company;
    if (patient) query.patient = patient;

    const total = await Approval.countDocuments(query);
    const approvals = await Approval.find(query)
      .populate('patient', 'firstName lastName patientId')
      .populate('company', 'name companyId')
      .populate('requestedBy', 'firstName lastName')
      .sort({ requestedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: approvals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single approval
// @route   GET /api/approvals/:id
// @access  Private
exports.getApproval = async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id)
      .populate('patient', 'firstName lastName patientId convention')
      .populate('company', 'name companyId contact')
      .populate('requestedBy', 'firstName lastName')
      .populate('usageHistory.usedBy', 'firstName lastName')
      .populate('usageHistory.invoiceId', 'invoiceId');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approbation non trouvée'
      });
    }

    res.json({ success: true, data: approval });
  } catch (error) {
    console.error('Error fetching approval:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create approval request
// @route   POST /api/approvals
// @access  Private
exports.createApproval = async (req, res) => {
  try {
    const {
      patient: patientId,
      company: companyId,
      actCode,
      actName,
      actCategory,
      quantityRequested,
      estimatedCost,
      currency,
      medicalJustification,
      visit,
      appointment,
      internalNotes
    } = req.body;

    // Validate patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient non trouvé'
      });
    }

    // Validate company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Entreprise non trouvée'
      });
    }

    // Check if approval already exists
    const existingApproval = await Approval.findOne({
      patient: patientId,
      company: companyId,
      actCode: actCode.toUpperCase(),
      status: { $in: ['pending', 'approved'] }
    });

    if (existingApproval) {
      return res.status(400).json({
        success: false,
        message: 'Une demande d\'approbation existe déjà pour cet acte',
        existingApproval: {
          approvalId: existingApproval.approvalId,
          status: existingApproval.status,
          statusDisplay: existingApproval.statusDisplay
        }
      });
    }

    // Get act info from FeeSchedule if not provided
    let finalActName = actName;
    let finalActCategory = actCategory;

    if (!actName || !actCategory) {
      const feeScheduleItem = await FeeSchedule.findOne({
        code: actCode.toUpperCase(),
        active: true
      });

      if (feeScheduleItem) {
        finalActName = finalActName || feeScheduleItem.name;
        finalActCategory = finalActCategory || feeScheduleItem.category;
      }
    }

    const approval = await Approval.create({
      patient: patientId,
      company: companyId,
      actCode: actCode.toUpperCase(),
      actName: finalActName || actCode,
      actCategory: finalActCategory,
      quantityRequested: quantityRequested || 1,
      estimatedCost,
      currency: currency || company.defaultCoverage?.currency || 'CDF',
      medicalJustification,
      requestedBy: req.user.id,
      visit,
      appointment,
      internalNotes,
      createdBy: req.user.id
    });

    await approval.populate([
      { path: 'patient', select: 'firstName lastName patientId' },
      { path: 'company', select: 'name companyId' },
      { path: 'requestedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({ success: true, data: approval });
  } catch (error) {
    console.error('Error creating approval:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve an approval request
// @route   PUT /api/approvals/:id/approve
// @access  Private (Admin, Billing, Manager)
exports.approveRequest = async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approbation non trouvée'
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cette demande ne peut pas être approuvée (statut: ${approval.statusDisplay})`
      });
    }

    const {
      respondedBy,
      notes,
      quantityApproved,
      approvedAmount,
      externalReference,
      validFrom,
      validUntil
    } = req.body;

    await approval.approve({
      respondedBy: respondedBy || req.user.firstName + ' ' + req.user.lastName,
      notes,
      quantityApproved,
      approvedAmount,
      externalReference,
      validFrom,
      validUntil
    });

    // Auto-update pending invoices to apply company coverage
    const invoiceUpdateResult = await updatePendingInvoicesForApproval(approval, true);

    await approval.populate([
      { path: 'patient', select: 'firstName lastName patientId' },
      { path: 'company', select: 'name companyId' }
    ]);

    res.json({
      success: true,
      message: `Demande approuvée avec succès${invoiceUpdateResult.updated > 0 ? `. ${invoiceUpdateResult.updated} facture(s) mise(s) à jour.` : ''}`,
      data: approval,
      invoicesUpdated: invoiceUpdateResult.updated
    });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject an approval request
// @route   PUT /api/approvals/:id/reject
// @access  Private (Admin, Billing, Manager)
exports.rejectRequest = async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approbation non trouvée'
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cette demande ne peut pas être rejetée (statut: ${approval.statusDisplay})`
      });
    }

    const { respondedBy, reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Le motif du refus est requis'
      });
    }

    await approval.reject({
      respondedBy: respondedBy || req.user.firstName + ' ' + req.user.lastName,
      reason,
      notes
    });

    // Update pending invoices to mark item as rejected (patient pays 100%)
    const invoiceUpdateResult = await updatePendingInvoicesForApproval(approval, false);

    await approval.populate([
      { path: 'patient', select: 'firstName lastName patientId' },
      { path: 'company', select: 'name companyId' }
    ]);

    res.json({
      success: true,
      message: `Demande rejetée${invoiceUpdateResult.updated > 0 ? `. ${invoiceUpdateResult.updated} facture(s) mise(s) à jour - Patient responsable à 100%.` : ''}`,
      data: approval,
      invoicesUpdated: invoiceUpdateResult.updated
    });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Use an approval
// @route   PUT /api/approvals/:id/use
// @access  Private
exports.useApproval = async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approbation non trouvée'
      });
    }

    const { invoiceId, quantity, notes } = req.body;

    try {
      await approval.use(req.user.id, invoiceId, quantity || 1, notes);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: 'Approbation utilisée',
      data: {
        approvalId: approval.approvalId,
        usedCount: approval.usedCount,
        remainingQuantity: approval.remainingQuantity,
        status: approval.status
      }
    });
  } catch (error) {
    console.error('Error using approval:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel an approval
// @route   PUT /api/approvals/:id/cancel
// @access  Private
exports.cancelApproval = async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approbation non trouvée'
      });
    }

    if (['used', 'cancelled', 'expired'].includes(approval.status)) {
      return res.status(400).json({
        success: false,
        message: `Cette approbation ne peut pas être annulée (statut: ${approval.statusDisplay})`
      });
    }

    const { reason } = req.body;
    await approval.cancel(reason, req.user.id);

    res.json({
      success: true,
      message: 'Approbation annulée',
      data: approval
    });
  } catch (error) {
    console.error('Error cancelling approval:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if approval exists for patient/company/act
// @route   GET /api/approvals/check
// @access  Private
exports.checkApproval = async (req, res) => {
  try {
    const { patient, company, actCode } = req.query;

    if (!patient || !company || !actCode) {
      return res.status(400).json({
        success: false,
        message: 'Patient, entreprise et code acte requis'
      });
    }

    const result = await Approval.checkApproval(patient, company, actCode);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking approval:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pending approvals for a company
// @route   GET /api/approvals/company/:companyId/pending
// @access  Private
exports.getPendingForCompany = async (req, res) => {
  try {
    const approvals = await Approval.getPendingForCompany(req.params.companyId);

    res.json({
      success: true,
      data: approvals,
      count: approvals.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get patient's approvals
// @route   GET /api/approvals/patient/:patientId
// @access  Private
exports.getPatientApprovals = async (req, res) => {
  try {
    const { includeExpired } = req.query;
    const approvals = await Approval.getForPatient(
      req.params.patientId,
      includeExpired === 'true'
    );

    res.json({
      success: true,
      data: approvals,
      count: approvals.length
    });
  } catch (error) {
    console.error('Error fetching patient approvals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check which acts require approval for a patient
// @route   POST /api/approvals/check-requirements
// @access  Private
exports.checkApprovalRequirements = async (req, res) => {
  try {
    const { patientId, actCodes } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID requis'
      });
    }

    if (!actCodes || !Array.isArray(actCodes) || actCodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste des codes actes requise'
      });
    }

    // Get patient with convention
    const patient = await Patient.findById(patientId)
      .populate('convention.company', 'name companyId actsRequiringApproval coveredCategories defaultCoverage');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient non trouvé'
      });
    }

    // No company = no approval requirements
    if (!patient.convention?.company) {
      return res.json({
        success: true,
        hasConvention: false,
        requirements: actCodes.map(code => ({
          actCode: code,
          requiresApproval: false,
          reason: 'Patient non conventionné'
        }))
      });
    }

    const company = patient.convention.company;
    const results = [];

    // Get existing approvals for this patient/company
    const existingApprovals = await Approval.find({
      patient: patientId,
      company: company._id,
      actCode: { $in: actCodes.map(c => c.toUpperCase()) },
      status: { $in: ['pending', 'approved'] }
    });

    const approvalMap = {};
    existingApprovals.forEach(a => {
      approvalMap[a.actCode] = a;
    });

    // Get fee schedule info for act names and categories
    const feeScheduleItems = await FeeSchedule.find({
      code: { $in: actCodes.map(c => c.toUpperCase()) },
      active: true
    });

    const feeScheduleMap = {};
    feeScheduleItems.forEach(f => {
      feeScheduleMap[f.code] = f;
    });

    for (const actCode of actCodes) {
      const upperCode = actCode.toUpperCase();
      const feeItem = feeScheduleMap[upperCode];
      const existingApproval = approvalMap[upperCode];
      const actPrice = feeItem?.price || 0;
      const actCategory = feeItem?.category || 'other';

      // Check category settings
      const categorySettings = company.coveredCategories?.find(
        c => c.category === actCategory
      );

      // Check 0: Category not covered at all (CIGNA/GGA - optical not covered)
      let notCovered = false;
      if (categorySettings?.notCovered) {
        notCovered = true;
      }

      // Check 1: Specific act in company's actsRequiringApproval
      let requiresApproval = false;
      let reason = null;

      if (company.actsRequiringApproval && company.actsRequiringApproval.length > 0) {
        const specificAct = company.actsRequiringApproval.find(
          a => a.actCode && a.actCode.toUpperCase() === upperCode
        );
        if (specificAct) {
          requiresApproval = true;
          reason = specificAct.reason || 'Acte spécifique nécessitant une approbation';
        }
      }

      // Check 2: Category-level approval requirement
      if (!requiresApproval && categorySettings?.requiresApproval) {
        requiresApproval = true;
        reason = `Catégorie "${actCategory}" nécessite une approbation`;
      }

      // Check 3: Price threshold auto-approval (ACTIVA/CICR style)
      // If price is under threshold, approval is NOT required
      if (requiresApproval && company.approvalRules?.autoApproveUnderAmount) {
        const threshold = company.approvalRules.autoApproveUnderAmount;
        // FIXED: Use currencyService instead of hardcoded rate
        const usdRate = currencyService.fallbackRates?.USD || 0.00036;
        const priceInUSD = company.approvalRules.autoApproveUnderCurrency === 'USD'
          ? actPrice * usdRate // Convert CDF to USD using service rate
          : actPrice;

        if (priceInUSD < threshold) {
          requiresApproval = false;
          reason = null;
        }
      }

      // Check 4: Category-level auto-approve threshold
      if (requiresApproval && categorySettings?.autoApproveUnder) {
        if (actPrice < categorySettings.autoApproveUnder) {
          requiresApproval = false;
          reason = null;
        }
      }

      // Check 5: Is this act part of a package deal?
      let isInPackage = false;
      let packageName = null;
      if (company.packageDeals && company.packageDeals.length > 0) {
        for (const pkg of company.packageDeals) {
          if (pkg.active && pkg.includedActs?.some(a => a.actCode?.toUpperCase() === upperCode)) {
            isInPackage = true;
            packageName = pkg.name;
            requiresApproval = false;
            reason = null;
            break;
          }
        }
      }

      results.push({
        actCode: upperCode,
        actName: feeItem?.name || actCode,
        category: actCategory,
        price: actPrice,
        requiresApproval,
        notCovered,
        isInPackage,
        packageName,
        reason,
        approvalStatus: existingApproval ? existingApproval.status : null,
        existingApproval: existingApproval ? {
          _id: existingApproval._id,
          approvalId: existingApproval.approvalId,
          status: existingApproval.status,
          statusDisplay: existingApproval.statusDisplay,
          validUntil: existingApproval.validUntil,
          remainingQuantity: existingApproval.remainingQuantity
        } : null,
        warning: notCovered
          ? `❌ Non couvert par ${company.name}`
          : (requiresApproval && !existingApproval
            ? `⚠️ Délibération requise pour "${feeItem?.name || actCode}"`
            : null),
        canProceed: !notCovered && (!requiresApproval || (existingApproval && existingApproval.status === 'approved'))
      });
    }

    // Summary
    const actsNotCovered = results.filter(r => r.notCovered);
    const actsNeedingApproval = results.filter(r => r.requiresApproval && !r.existingApproval && !r.notCovered);
    const actsPendingApproval = results.filter(r => r.approvalStatus === 'pending');
    const actsApproved = results.filter(r => r.approvalStatus === 'approved');
    const actsInPackage = results.filter(r => r.isInPackage);

    res.json({
      success: true,
      hasConvention: true,
      company: {
        _id: company._id,
        name: company.name,
        companyId: company.companyId,
        defaultCoverage: company.defaultCoverage,
        hasPackageDeals: company.packageDeals?.length > 0
      },
      summary: {
        totalActs: actCodes.length,
        actsNotCovered: actsNotCovered.length,
        actsNeedingApproval: actsNeedingApproval.length,
        actsPendingApproval: actsPendingApproval.length,
        actsApproved: actsApproved.length,
        actsInPackage: actsInPackage.length,
        hasBlockingWarnings: actsNeedingApproval.length > 0 || actsNotCovered.length > 0
      },
      requirements: results
    });
  } catch (error) {
    console.error('Error checking approval requirements:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get expiring approvals
// @route   GET /api/approvals/expiring
// @access  Private
exports.getExpiringApprovals = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const approvals = await Approval.getExpiring(parseInt(days));

    res.json({
      success: true,
      data: approvals,
      count: approvals.length
    });
  } catch (error) {
    console.error('Error fetching expiring approvals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Attach document to approval
// @route   POST /api/approvals/:id/documents
// @access  Private
exports.attachDocument = async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approbation non trouvée'
      });
    }

    const { name, documentId } = req.body;

    approval.documents.push({
      name,
      documentId,
      uploadedAt: new Date()
    });

    approval.updatedBy = req.user.id;
    await approval.save();

    res.json({
      success: true,
      message: 'Document attaché',
      data: approval.documents
    });
  } catch (error) {
    console.error('Error attaching document:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
