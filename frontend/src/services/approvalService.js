import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Approval Service
 * Handles prior authorization (approbation préalable) API calls
 * READ operations work offline, ACTIONS require internet for audit trail
 */

// ============================================
// APPROVAL CRUD - READ: OFFLINE, ACTIONS: ONLINE ONLY
// ============================================

/**
 * Get all approvals with optional filters
 * WORKS OFFLINE - cached for 30 minutes
 */
export const getApprovals = async (params = {}) => {
  const cacheKey = `approvals_all_${JSON.stringify(params)}`;
  return offlineWrapper.get(
    () => api.get('/approvals', { params }),
    'approvals',
    cacheKey,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

/**
 * Get single approval by ID
 * WORKS OFFLINE - cached for 30 minutes
 */
export const getApproval = async (id) => {
  return offlineWrapper.get(
    () => api.get(`/approvals/${id}`),
    'approvals',
    id,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

/**
 * Create approval request
 * ONLINE ONLY - requires audit trail
 */
export const createApproval = async (approvalData) => {
  if (!navigator.onLine) throw new Error('Creating approvals requires internet connection.');
  const response = await api.post('/approvals', approvalData);
  return response.data;
};

// ============================================
// APPROVAL ACTIONS - ONLINE ONLY (audit trail)
// ============================================

/**
 * Approve an approval request
 * ONLINE ONLY - requires audit trail
 */
export const approveRequest = async (id, data) => {
  if (!navigator.onLine) throw new Error('Approving requests requires internet connection for audit trail.');
  const response = await api.put(`/approvals/${id}/approve`, data);
  return response.data;
};

/**
 * Reject an approval request
 * ONLINE ONLY - requires audit trail
 */
export const rejectRequest = async (id, data) => {
  if (!navigator.onLine) throw new Error('Rejecting requests requires internet connection for audit trail.');
  const response = await api.put(`/approvals/${id}/reject`, data);
  return response.data;
};

/**
 * Use an approval
 * ONLINE ONLY - requires tracking
 */
export const useApproval = async (id, invoiceId, quantity = 1, notes = '') => {
  if (!navigator.onLine) throw new Error('Using approvals requires internet connection for tracking.');
  const response = await api.put(`/approvals/${id}/use`, {
    invoiceId,
    quantity,
    notes
  });
  return response.data;
};

/**
 * Cancel an approval
 * ONLINE ONLY - requires audit trail
 */
export const cancelApproval = async (id, reason) => {
  if (!navigator.onLine) throw new Error('Cancelling approvals requires internet connection.');
  const response = await api.put(`/approvals/${id}/cancel`, { reason });
  return response.data;
};

// ============================================
// APPROVAL CHECKS - WORKS OFFLINE
// ============================================

/**
 * Check if approval exists for patient/company/act
 * WORKS OFFLINE - cached for 10 minutes
 */
export const checkApproval = async (patient, company, actCode) => {
  const cacheKey = `approval_check_${patient}_${company}_${actCode}`;
  return offlineWrapper.get(
    () => api.get('/approvals/check', { params: { patient, company, actCode } }),
    'approvals',
    cacheKey,
    { transform: (response) => response.data, cacheExpiry: 600 }
  );
};

// ============================================
// PATIENT & COMPANY APPROVALS - WORKS OFFLINE
// ============================================

/**
 * Get patient's approvals
 * WORKS OFFLINE - cached for 30 minutes
 */
export const getPatientApprovals = async (patientId, includeExpired = false) => {
  const cacheKey = `approvals_patient_${patientId}_${includeExpired}`;
  return offlineWrapper.get(
    () => api.get(`/approvals/patient/${patientId}`, { params: { includeExpired } }),
    'approvals',
    cacheKey,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

/**
 * Get pending approvals for a company
 * WORKS OFFLINE - cached for 10 minutes
 */
export const getPendingForCompany = async (companyId) => {
  return offlineWrapper.get(
    () => api.get(`/approvals/company/${companyId}/pending`),
    'approvals',
    `pending_company_${companyId}`,
    { transform: (response) => response.data, cacheExpiry: 600 }
  );
};

// ============================================
// EXPIRING APPROVALS - WORKS OFFLINE
// ============================================

/**
 * Get expiring approvals
 * WORKS OFFLINE - cached for 30 minutes
 */
export const getExpiringApprovals = async (days = 7) => {
  return offlineWrapper.get(
    () => api.get('/approvals/expiring', { params: { days } }),
    'approvals',
    `expiring_${days}`,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

// ============================================
// DOCUMENTS - ONLINE ONLY
// ============================================

/**
 * Attach document to approval
 * ONLINE ONLY - requires audit trail
 */
export const attachDocument = async (id, name, documentId) => {
  if (!navigator.onLine) throw new Error('Attaching documents requires internet connection.');
  const response = await api.post(`/approvals/${id}/documents`, { name, documentId });
  return response.data;
};

// ============================================
// OFFLINE HELPERS
// ============================================

/**
 * Pre-cache patient approvals for offline use
 */
export const preCachePatientApprovals = async (patientId) => {
  const results = { cached: 0, errors: [] };
  try { await getPatientApprovals(patientId); results.cached++; } catch { results.errors.push('approvals'); }
  return results;
};

/**
 * Get cached approval by ID (direct DB access)
 */
export const getCachedApproval = async (id) => {
  try { return await db.approvals.get(id); } catch { return null; }
};

/**
 * Get cached patient approvals (direct DB access)
 */
export const getCachedPatientApprovals = async (patientId) => {
  try {
    return await db.approvals.where('patientId').equals(patientId).toArray();
  } catch { return []; }
};

/**
 * Check approval offline (direct DB access)
 */
export const checkApprovalOffline = async (patientId, companyId, actCode) => {
  try {
    const approvals = await db.approvals.where('patientId').equals(patientId).toArray();
    return approvals.find(a =>
      a.companyId === companyId &&
      a.actCode === actCode &&
      a.status === 'approved' &&
      new Date(a.expiresAt) > new Date()
    );
  } catch { return null; }
};

export default {
  getApprovals,
  getApproval,
  createApproval,
  approveRequest,
  rejectRequest,
  useApproval,
  cancelApproval,
  checkApproval,
  getPatientApprovals,
  getPendingForCompany,
  getExpiringApprovals,
  attachDocument,
  preCachePatientApprovals,
  getCachedApproval,
  getCachedPatientApprovals,
  checkApprovalOffline
};
