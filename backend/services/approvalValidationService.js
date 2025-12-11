/**
 * Approval Validation Service
 * Validates company billing against required délibérations (prior authorizations)
 *
 * Business Rules:
 * 1. Some companies require prior approval (délibération) for certain services
 * 2. If approval is required but not provided, company share = 0, patient pays 100%
 * 3. If approval exists and is valid, link it to the invoice item
 * 4. Approvals are consumed when invoice is finalized
 */

const Approval = require('../models/Approval');
const Company = require('../models/Company');
const FeeSchedule = require('../models/FeeSchedule');

/**
 * Check if an act/service requires approval from a company
 * @param {Object} company - Company document
 * @param {string} actCode - The billing code for the act
 * @param {string} category - The category of the service
 * @returns {Object} { required: boolean, reason: string }
 */
async function checkApprovalRequired(company, actCode, category) {
  // Check 1: Specific act in company's actsRequiringApproval list
  if (company.actsRequiringApproval && company.actsRequiringApproval.length > 0) {
    const specificAct = company.actsRequiringApproval.find(
      a => a.actCode && a.actCode.toUpperCase() === actCode?.toUpperCase()
    );
    if (specificAct) {
      return {
        required: true,
        reason: specificAct.reason || 'Acte spécifique nécessitant une approbation'
      };
    }
  }

  // Check 2: Category-level approval requirement
  if (company.coveredCategories && company.coveredCategories.length > 0) {
    const categorySettings = company.coveredCategories.find(c => c.category === category);
    if (categorySettings && categorySettings.requiresApproval) {
      return {
        required: true,
        reason: `Catégorie "${category}" nécessite une approbation`
      };
    }
  }

  return { required: false };
}

/**
 * Validate a single invoice item for company billing
 * @param {Object} item - Invoice item
 * @param {Object} company - Company document
 * @param {string} patientId - Patient ObjectId
 * @returns {Object} Validation result with approval info
 */
async function validateItemForCompanyBilling(item, company, patientId) {
  const actCode = item.code;
  const category = item.category;

  // Check if approval is required
  const approvalCheck = await checkApprovalRequired(company, actCode, category);

  if (!approvalCheck.required) {
    // No approval required - full coverage applies
    return {
      approved: true,
      approvalRequired: false,
      approvalStatus: 'not_required',
      coverageApplies: true,
      message: null
    };
  }

  // Approval is required - check if one exists
  const approvalResult = await Approval.checkApproval(patientId, company._id, actCode);

  if (!approvalResult.hasApproval) {
    // No valid approval found - patient pays 100%
    return {
      approved: false,
      approvalRequired: true,
      approvalStatus: 'missing',
      coverageApplies: false,
      message: approvalResult.reason ||
        `Délibération requise pour "${item.description || actCode}" - Patient responsable à 100%`,
      reason: approvalCheck.reason
    };
  }

  // Valid approval found
  const approval = approvalResult.approval;

  // Check if approval amount covers this item
  const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
  const amountWarning = approval.approvedAmount && itemTotal > approval.approvedAmount
    ? `Montant approuvé (${approval.approvedAmount}) inférieur au montant facturé (${itemTotal})`
    : null;

  return {
    approved: true,
    approvalRequired: true,
    approvalStatus: 'approved',
    coverageApplies: true,
    approval: approval._id,
    approvalId: approval.approvalId,
    approvalDetails: {
      approvedQuantity: approval.quantityApproved,
      approvedAmount: approval.approvedAmount,
      remainingQuantity: approvalResult.remainingQuantity,
      validUntil: approval.validUntil,
      externalReference: approval.externalReference
    },
    message: amountWarning,
    warning: amountWarning
  };
}

/**
 * Validate all items in an invoice for company billing
 * @param {Array} items - Invoice items array
 * @param {Object|string} companyOrId - Company document or ID
 * @param {string} patientId - Patient ObjectId
 * @returns {Object} Full validation result
 */
async function validateInvoiceForCompanyBilling(items, companyOrId, patientId) {
  // Get company if ID was passed
  let company = companyOrId;
  if (typeof companyOrId === 'string' || companyOrId.toString) {
    company = await Company.findById(companyOrId);
    if (!company) {
      return {
        valid: false,
        error: 'Entreprise non trouvée',
        items: []
      };
    }
  }

  // Check if company contract is active
  if (company.contract?.status !== 'active') {
    return {
      valid: false,
      error: `Contrat de l'entreprise ${company.name} n'est pas actif (${company.contract?.status})`,
      items: []
    };
  }

  // Check if contract has expired
  if (company.contract?.endDate && new Date(company.contract.endDate) < new Date()) {
    return {
      valid: false,
      error: `Contrat de l'entreprise ${company.name} a expiré le ${new Date(company.contract.endDate).toLocaleDateString('fr-FR')}`,
      items: []
    };
  }

  // Validate each item
  const validationResults = [];
  let totalCoveredAmount = 0;
  let totalUncoveredAmount = 0;
  let hasApprovalIssues = false;
  const warnings = [];
  const itemsNeedingApproval = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);

    const result = await validateItemForCompanyBilling(item, company, patientId);

    // Calculate coverage for this item
    let itemCoverage = 0;
    if (result.coverageApplies) {
      const categorySettings = company.getCategorySettings(item.category);
      itemCoverage = (itemTotal * (categorySettings.percentage || company.defaultCoverage.percentage)) / 100;

      // Apply category max if set
      if (categorySettings.maxAmount && itemCoverage > categorySettings.maxAmount) {
        itemCoverage = categorySettings.maxAmount;
      }

      totalCoveredAmount += itemCoverage;
    } else {
      totalUncoveredAmount += itemTotal;
      hasApprovalIssues = true;
      itemsNeedingApproval.push({
        index: i,
        description: item.description,
        code: item.code,
        amount: itemTotal
      });
    }

    if (result.warning) {
      warnings.push(`Ligne ${i + 1}: ${result.warning}`);
    }

    validationResults.push({
      itemIndex: i,
      ...result,
      itemTotal,
      companyShareForItem: Math.round(itemCoverage),
      patientShareForItem: Math.round(itemTotal - itemCoverage)
    });
  }

  // Apply overall maximum limits
  if (company.defaultCoverage.maxPerVisit && totalCoveredAmount > company.defaultCoverage.maxPerVisit) {
    const excess = totalCoveredAmount - company.defaultCoverage.maxPerVisit;
    totalCoveredAmount = company.defaultCoverage.maxPerVisit;
    totalUncoveredAmount += excess;
    warnings.push(`Plafond par visite (${company.defaultCoverage.maxPerVisit} ${company.defaultCoverage.currency}) appliqué`);
  }

  const grandTotal = items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0);

  return {
    valid: true,
    company: {
      _id: company._id,
      companyId: company.companyId,
      name: company.name,
      coveragePercentage: company.defaultCoverage.percentage,
      currency: company.defaultCoverage.currency
    },
    summary: {
      grandTotal,
      companyShare: Math.round(totalCoveredAmount),
      patientShare: Math.round(grandTotal - totalCoveredAmount),
      effectiveCoveragePercentage: grandTotal > 0
        ? Math.round((totalCoveredAmount / grandTotal) * 100)
        : 0
    },
    hasApprovalIssues,
    itemsNeedingApproval,
    warnings,
    items: validationResults
  };
}

/**
 * Consume approvals when invoice is finalized
 * @param {Object} invoice - Invoice document with items that have approval references
 * @param {string} userId - User performing the action
 * @returns {Object} Result of consumption
 */
async function consumeApprovalsForInvoice(invoice, userId) {
  const consumed = [];
  const errors = [];

  for (const item of invoice.items) {
    if (item.approval && item.approvalStatus === 'approved') {
      try {
        const approval = await Approval.findById(item.approval);
        if (approval && approval.isUsable) {
          await approval.use(userId, invoice._id, item.quantity || 1, `Facture ${invoice.invoiceId}`);
          consumed.push({
            approvalId: approval.approvalId,
            actCode: item.code,
            quantity: item.quantity || 1
          });
        }
      } catch (error) {
        errors.push({
          approvalId: item.approval,
          error: error.message
        });
      }
    }
  }

  return { consumed, errors };
}

/**
 * Get pending approval requests for invoice items
 * Useful when creating invoice and items need approval
 * @param {Array} items - Invoice items
 * @param {string} companyId - Company ObjectId
 * @param {string} patientId - Patient ObjectId
 * @returns {Array} List of items that need approval requests created
 */
async function getItemsNeedingApprovalRequest(items, companyId, patientId) {
  const company = await Company.findById(companyId);
  if (!company) return [];

  const needsRequest = [];

  for (const item of items) {
    const approvalCheck = await checkApprovalRequired(company, item.code, item.category);

    if (approvalCheck.required) {
      // Check if pending or approved approval exists
      const existingApproval = await Approval.findOne({
        patient: patientId,
        company: companyId,
        actCode: item.code?.toUpperCase(),
        status: { $in: ['pending', 'approved'] }
      });

      if (!existingApproval) {
        needsRequest.push({
          actCode: item.code,
          actName: item.description,
          category: item.category,
          quantity: item.quantity || 1,
          estimatedCost: (item.quantity || 1) * (item.unitPrice || 0),
          reason: approvalCheck.reason
        });
      } else if (existingApproval.status === 'pending') {
        needsRequest.push({
          actCode: item.code,
          actName: item.description,
          category: item.category,
          quantity: item.quantity || 1,
          estimatedCost: (item.quantity || 1) * (item.unitPrice || 0),
          reason: approvalCheck.reason,
          pendingApproval: existingApproval.approvalId,
          status: 'pending'
        });
      }
    }
  }

  return needsRequest;
}

module.exports = {
  checkApprovalRequired,
  validateItemForCompanyBilling,
  validateInvoiceForCompanyBilling,
  consumeApprovalsForInvoice,
  getItemsNeedingApprovalRequest
};
