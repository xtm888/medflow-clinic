/**
 * Approval Warning Service
 * Checks and manages délibération (prior authorization) requirements during consultations
 */

import api from './apiConfig';

/**
 * Check which acts require approval for a patient's company
 * @param {string} patientId - Patient MongoDB ID
 * @param {string[]} actCodes - Array of act codes to check
 * @returns {Promise<Object>} Requirements check result
 */
export const checkApprovalRequirements = async (patientId, actCodes) => {
  if (!patientId || !actCodes || actCodes.length === 0) {
    return {
      success: true,
      hasConvention: false,
      requirements: []
    };
  }

  try {
    const response = await api.post('/approvals/check-requirements', {
      patientId,
      actCodes
    });
    return response.data;
  } catch (error) {
    console.error('Error checking approval requirements:', error);
    throw error;
  }
};

/**
 * Get patient's existing approvals
 * @param {string} patientId - Patient MongoDB ID
 * @param {boolean} includeExpired - Include expired approvals
 * @returns {Promise<Object>} Patient approvals
 */
export const getPatientApprovals = async (patientId, includeExpired = false) => {
  try {
    const response = await api.get(`/approvals/patient/${patientId}`, {
      params: { includeExpired }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching patient approvals:', error);
    throw error;
  }
};

/**
 * Create an approval request
 * @param {Object} data - Approval request data
 * @returns {Promise<Object>} Created approval
 */
export const createApprovalRequest = async (data) => {
  try {
    const response = await api.post('/approvals', data);
    return response.data;
  } catch (error) {
    console.error('Error creating approval request:', error);
    throw error;
  }
};

/**
 * Check if a single act requires approval
 * @param {string} patientId - Patient MongoDB ID
 * @param {string} companyId - Company MongoDB ID
 * @param {string} actCode - Act code to check
 * @returns {Promise<Object>} Approval check result
 */
export const checkSingleApproval = async (patientId, companyId, actCode) => {
  try {
    const response = await api.get('/approvals/check', {
      params: { patient: patientId, company: companyId, actCode }
    });
    return response.data;
  } catch (error) {
    console.error('Error checking single approval:', error);
    throw error;
  }
};

/**
 * Filter procedures that need approval warnings
 * @param {Object} checkResult - Result from checkApprovalRequirements
 * @returns {Object} Filtered results by warning severity
 */
export const categorizeWarnings = (checkResult) => {
  if (!checkResult?.requirements) {
    return {
      notCovered: [],
      needsApproval: [],
      pendingApproval: [],
      approved: [],
      inPackage: [],
      noApprovalNeeded: []
    };
  }

  return {
    // Acts not covered at all by this convention
    notCovered: checkResult.requirements.filter(
      r => r.notCovered
    ),
    // Acts that require approval but don't have any request yet
    needsApproval: checkResult.requirements.filter(
      r => r.requiresApproval && !r.existingApproval && !r.notCovered
    ),
    // Acts with pending approval requests
    pendingApproval: checkResult.requirements.filter(
      r => r.approvalStatus === 'pending'
    ),
    // Acts that are already approved
    approved: checkResult.requirements.filter(
      r => r.approvalStatus === 'approved'
    ),
    // Acts included in a package deal
    inPackage: checkResult.requirements.filter(
      r => r.isInPackage
    ),
    // Acts that don't require approval
    noApprovalNeeded: checkResult.requirements.filter(
      r => !r.requiresApproval && !r.notCovered && !r.isInPackage
    )
  };
};

/**
 * Generate warning messages for display
 * @param {Object} categorized - Result from categorizeWarnings
 * @param {string} companyName - Company name for messages
 * @returns {Object} Warning messages by severity
 */
export const generateWarningMessages = (categorized, companyName) => {
  const messages = {
    excluded: [],  // Black/Gray - not covered at all
    blocking: [],  // Red - cannot proceed without approval
    warning: [],   // Orange - pending approval
    info: [],      // Green - approved
    package: []    // Blue - included in package
  };

  // Not covered at all (highest severity)
  if (categorized.notCovered?.length > 0) {
    categorized.notCovered.forEach(act => {
      messages.excluded.push({
        actCode: act.actCode,
        actName: act.actName,
        message: `Non couvert par ${companyName}`,
        detail: 'Cet acte sera facturé à 100% au patient',
        category: act.category
      });
    });
  }

  // Needs approval
  if (categorized.needsApproval?.length > 0) {
    categorized.needsApproval.forEach(act => {
      messages.blocking.push({
        actCode: act.actCode,
        actName: act.actName,
        message: `Délibération requise pour "${act.actName}"`,
        detail: `${companyName} exige une approbation préalable`,
        reason: act.reason,
        price: act.price
      });
    });
  }

  // Pending approval
  if (categorized.pendingApproval?.length > 0) {
    categorized.pendingApproval.forEach(act => {
      messages.warning.push({
        actCode: act.actCode,
        actName: act.actName,
        message: `Approbation en attente pour "${act.actName}"`,
        detail: `Demande soumise - Référence: ${act.existingApproval?.approvalId}`,
        approvalId: act.existingApproval?._id
      });
    });
  }

  // Approved
  if (categorized.approved?.length > 0) {
    categorized.approved.forEach(act => {
      messages.info.push({
        actCode: act.actCode,
        actName: act.actName,
        message: `Approuvé: "${act.actName}"`,
        detail: `Valide jusqu'au ${act.existingApproval?.validUntil ? new Date(act.existingApproval.validUntil).toLocaleDateString('fr-FR') : 'N/A'}`,
        remainingQuantity: act.existingApproval?.remainingQuantity
      });
    });
  }

  // In package deal
  if (categorized.inPackage?.length > 0) {
    categorized.inPackage.forEach(act => {
      messages.package.push({
        actCode: act.actCode,
        actName: act.actName,
        message: `Inclus dans le forfait "${act.packageName}"`,
        detail: 'Couvert sans approbation supplémentaire',
        packageName: act.packageName
      });
    });
  }

  return messages;
};

export default {
  checkApprovalRequirements,
  getPatientApprovals,
  createApprovalRequest,
  checkSingleApproval,
  categorizeWarnings,
  generateWarningMessages
};
