import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import db from './database';

/**
 * Lab Order Service
 * Handles all lab order and result related API calls
 *
 * SAFETY CONSIDERATIONS:
 * - Order creation can work offline (queued for sync)
 * - Result entry MUST stay ONLINE-ONLY (critical values)
 * - Verification MUST stay ONLINE-ONLY
 */

// ============================================
// OFFLINE HELPERS
// ============================================

const isOnline = () => navigator.onLine;

const requireOnline = (operation) => {
  if (!isOnline()) {
    throw new Error(`${operation} nécessite une connexion internet pour la sécurité du patient.`);
  }
};

// ============================================
// LAB ORDER ENDPOINTS
// ============================================

/**
 * Get all lab orders with optional filters
 */
export const getLabOrders = async (params = {}) => {
  return offlineWrapper.get(
    () => api.get('/lab-orders', { params }),
    'labOrders',
    `list_${JSON.stringify(params)}`,
    { cacheTime: 15 * 60 * 1000 }
  );
};

/**
 * Get single lab order by ID
 */
export const getLabOrder = async (id) => {
  return offlineWrapper.get(
    () => api.get(`/lab-orders/${id}`),
    'labOrders',
    id,
    { cacheTime: 15 * 60 * 1000 }
  );
};

/**
 * Create a new lab order - CAN work offline (queued for sync)
 */
export const createLabOrder = async (orderData) => {
  return offlineWrapper.mutate(
    () => api.post('/lab-orders', orderData),
    'labOrders',
    orderData,
    'create'
  );
};

/**
 * Update a lab order - CAN work offline (queued for sync)
 */
export const updateLabOrder = async (id, orderData) => {
  return offlineWrapper.mutate(
    () => api.put(`/lab-orders/${id}`, orderData),
    'labOrders',
    { id, ...orderData },
    'update'
  );
};

/**
 * Collect specimen for lab order - ONLINE ONLY (sample tracking)
 */
export const collectSpecimen = async (id, specimenData) => {
  requireOnline('Collecter le spécimen');
  const response = await api.put(`/lab-orders/${id}/collect`, specimenData);
  return response.data;
};

/**
 * Receive specimen at lab - ONLINE ONLY (quality control)
 */
export const receiveSpecimen = async (id, qualityData = {}) => {
  requireOnline('Recevoir le spécimen');
  const response = await api.put(`/lab-orders/${id}/receive`, qualityData);
  return response.data;
};

/**
 * Cancel lab order - ONLINE ONLY (audit trail)
 */
export const cancelLabOrder = async (id, reason) => {
  requireOnline('Annuler la commande');
  const response = await api.put(`/lab-orders/${id}/cancel`, { reason });
  return response.data;
};

/**
 * Get pending lab orders
 */
export const getPendingLabOrders = async (params = {}) => {
  return offlineWrapper.get(
    () => api.get('/lab-orders/pending', { params }),
    'labOrders',
    'pending',
    { cacheTime: 5 * 60 * 1000 }
  );
};

/**
 * Get patient's lab order history
 */
export const getPatientLabOrders = async (patientId, params = {}) => {
  return offlineWrapper.get(
    () => api.get(`/lab-orders/patient/${patientId}`, { params }),
    'labOrders',
    `patient_${patientId}`,
    { cacheTime: 15 * 60 * 1000 }
  );
};

/**
 * Get lab order by barcode
 */
export const getLabOrderByBarcode = async (barcode) => {
  const response = await api.get(`/lab-orders/barcode/${barcode}`);
  return response.data;
};

/**
 * Get lab order statistics
 */
export const getLabOrderStatistics = async () => {
  const response = await api.get('/lab-orders/stats');
  return response.data;
};

// ============================================
// CHECK-IN ENDPOINTS
// ============================================

/**
 * Get orders scheduled for today (for check-in page)
 */
export const getScheduledToday = async (params = {}) => {
  const response = await api.get('/lab-orders/scheduled-today', { params });
  return response.data;
};

/**
 * Get checked-in patients awaiting specimen collection
 */
export const getCheckedIn = async () => {
  const response = await api.get('/lab-orders/checked-in');
  return response.data;
};

/**
 * Check-in patient for specimen collection
 */
export const checkInPatient = async (id, checkInData = {}) => {
  const response = await api.put(`/lab-orders/${id}/check-in`, checkInData);
  return response.data;
};

/**
 * Reject lab order with automatic 25% penalty
 * Patient is sent to reception for payment and rescheduling
 */
export const rejectAndReschedule = async (id, rejectionData) => {
  const response = await api.put(`/lab-orders/${id}/reject-reschedule`, rejectionData);
  return response.data;
};

/**
 * Get rejected lab orders awaiting rescheduling (for reception)
 */
export const getRejectedAwaitingReschedule = async () => {
  const response = await api.get('/lab-orders/rejected-awaiting-reschedule');
  return response.data;
};

/**
 * Reschedule rejected lab order after penalty payment
 */
export const rescheduleAfterRejection = async (id, scheduledDate, notes = '') => {
  const response = await api.put(`/lab-orders/${id}/reschedule`, { scheduledDate, notes });
  return response.data;
};

/**
 * Get rejection statistics
 */
export const getRejectionStats = async (params = {}) => {
  const response = await api.get('/lab-orders/rejection-stats', { params });
  return response.data;
};

// ============================================
// LAB RESULT ENDPOINTS
// ============================================

/**
 * Get all lab results with optional filters
 */
export const getLabResults = async (params = {}) => {
  const response = await api.get('/lab-results', { params });
  return response.data;
};

/**
 * Get single lab result by ID
 */
export const getLabResult = async (id) => {
  const response = await api.get(`/lab-results/${id}`);
  return response.data;
};

/**
 * Create a new lab result - ONLINE ONLY (critical values)
 */
export const createLabResult = async (resultData) => {
  requireOnline('Saisir les résultats');
  const response = await api.post('/lab-results', resultData);
  return response.data;
};

/**
 * Verify lab result - ONLINE ONLY (must check critical values)
 */
export const verifyLabResult = async (id) => {
  requireOnline('Vérifier les résultats');
  const response = await api.put(`/lab-results/${id}/verify`);
  return response.data;
};

/**
 * Correct lab result - ONLINE ONLY (audit trail)
 */
export const correctLabResult = async (id, results, reason) => {
  requireOnline('Corriger les résultats');
  const response = await api.put(`/lab-results/${id}/correct`, { results, reason });
  return response.data;
};

/**
 * Acknowledge critical value - ONLINE ONLY (immediate notification required)
 */
export const acknowledgeCriticalValue = async (id, notes) => {
  requireOnline('Accuser réception de la valeur critique');
  const response = await api.put(`/lab-results/${id}/acknowledge-critical`, { notes });
  return response.data;
};

/**
 * Get unacknowledged critical results
 */
export const getUnacknowledgedCriticalResults = async () => {
  const response = await api.get('/lab-results/critical-unacknowledged');
  return response.data;
};

/**
 * Get patient's lab results
 */
export const getPatientLabResults = async (patientId, params = {}) => {
  const response = await api.get(`/lab-results/patient/${patientId}`, { params });
  return response.data;
};

/**
 * Get patient's test history for a specific test
 */
export const getPatientTestHistory = async (patientId, testCode, params = {}) => {
  const response = await api.get(`/lab-results/patient/${patientId}/test/${testCode}`, { params });
  return response.data;
};

// ============================================
// CONSTANTS
// ============================================

export const LAB_ORDER_STATUSES = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'collected', label: 'Collected' },
  { value: 'received', label: 'Received' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const LAB_PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'stat', label: 'STAT' }
];

export const LAB_RESULT_STATUSES = [
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'partial', label: 'Partial' },
  { value: 'final', label: 'Final' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'amended', label: 'Amended' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const SPECIMEN_QUALITY = [
  { value: 'acceptable', label: 'Acceptable' },
  { value: 'hemolyzed', label: 'Hemolyzed' },
  { value: 'lipemic', label: 'Lipemic' },
  { value: 'icteric', label: 'Icteric' },
  { value: 'clotted', label: 'Clotted' },
  { value: 'insufficient', label: 'Insufficient' },
  { value: 'rejected', label: 'Rejected' }
];

export const RESULT_FLAGS = [
  { value: 'normal', label: 'Normal', color: 'green' },
  { value: 'low', label: 'Low', color: 'orange' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'critical-low', label: 'Critical Low', color: 'red' },
  { value: 'critical-high', label: 'Critical High', color: 'red' },
  { value: 'abnormal', label: 'Abnormal', color: 'orange' },
  { value: 'panic', label: 'Panic', color: 'red' }
];

export const SPECIMEN_TYPES = [
  { value: 'blood', label: 'Blood' },
  { value: 'serum', label: 'Serum' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'urine', label: 'Urine' },
  { value: 'stool', label: 'Stool' },
  { value: 'csf', label: 'CSF' },
  { value: 'swab', label: 'Swab' },
  { value: 'tissue', label: 'Tissue' },
  { value: 'other', label: 'Other' }
];

/**
 * Get flag color for display
 */
export const getFlagColor = (flag) => {
  const flagObj = RESULT_FLAGS.find(f => f.value === flag);
  return flagObj?.color || 'gray';
};

/**
 * Check if flag is critical
 */
export const isCriticalFlag = (flag) => {
  return ['critical-low', 'critical-high', 'panic'].includes(flag);
};

/**
 * Check if flag is abnormal
 */
export const isAbnormalFlag = (flag) => {
  return flag && flag !== 'normal';
};

// ============================================
// OFFLINE SUPPORT HELPERS
// ============================================

/**
 * Pre-cache pending orders for shift
 */
export const preCacheForShift = async () => {
  if (!isOnline()) return { cached: 0 };

  try {
    const [pendingResponse, todayResponse] = await Promise.all([
      api.get('/lab-orders/pending'),
      api.get('/lab-orders/scheduled-today')
    ]);

    // Safely extract arrays from various API response formats
    const rawPending = pendingResponse?.data?.data ?? pendingResponse?.data ?? [];
    const rawToday = todayResponse?.data?.data ?? todayResponse?.data ?? [];
    const pendingOrders = Array.isArray(rawPending) ? rawPending : [];
    const todayOrders = Array.isArray(rawToday) ? rawToday : [];

    const orders = [...pendingOrders, ...todayOrders];

    if (orders.length > 0) {
      await db.labOrders.bulkPut(orders);
    }

    return { cached: orders.length };
  } catch (error) {
    console.error('[LabOrderService] Pre-cache failed:', error);
    return { cached: 0, error: error.message };
  }
};

/**
 * Search cached orders offline
 */
export const searchOffline = async (query) => {
  const orders = await db.labOrders.toArray();
  if (!query) return orders;

  const lowerQuery = query.toLowerCase();
  return orders.filter(o =>
    o.patientName?.toLowerCase().includes(lowerQuery) ||
    o.orderNumber?.toLowerCase().includes(lowerQuery) ||
    o.testCodes?.some(t => t.toLowerCase().includes(lowerQuery))
  );
};

/**
 * Get pending count for badge
 */
export const getPendingCount = async () => {
  if (isOnline()) {
    try {
      const response = await api.get('/lab-orders/pending/count');
      return response.data?.count || 0;
    } catch {
      // Fall through to offline count
    }
  }
  return await db.labOrders.where('status').equals('pending').count();
};

// ============================================
// REJECTION REASONS
// ============================================

export const REJECTION_REASONS = [
  { value: 'patient_ate', label: 'Patient a mangé (jeûne non respecté)', penaltySuggested: 5000 },
  { value: 'medication_taken', label: 'Médicaments pris', penaltySuggested: 3000 },
  { value: 'wrong_preparation', label: 'Mauvaise préparation', penaltySuggested: 5000 },
  { value: 'patient_sick', label: 'Patient malade', penaltySuggested: 0 },
  { value: 'no_show', label: 'Patient absent', penaltySuggested: 10000 },
  { value: 'wrong_time', label: 'Mauvais horaire', penaltySuggested: 0 },
  { value: 'insufficient_fasting', label: 'Jeûne insuffisant', penaltySuggested: 5000 },
  { value: 'other', label: 'Autre', penaltySuggested: 0 }
];

export default {
  // Orders
  getLabOrders,
  getLabOrder,
  createLabOrder,
  updateLabOrder,
  collectSpecimen,
  receiveSpecimen,
  cancelLabOrder,
  getPendingLabOrders,
  getPatientLabOrders,
  getLabOrderByBarcode,
  getLabOrderStatistics,
  // Check-in
  getScheduledToday,
  getCheckedIn,
  checkInPatient,
  rejectAndReschedule,
  getRejectedAwaitingReschedule,
  rescheduleAfterRejection,
  getRejectionStats,
  // Results
  getLabResults,
  getLabResult,
  createLabResult,
  verifyLabResult,
  correctLabResult,
  acknowledgeCriticalValue,
  getUnacknowledgedCriticalResults,
  getPatientLabResults,
  getPatientTestHistory,
  // Utils
  getFlagColor,
  isCriticalFlag,
  isAbnormalFlag,
  // Offline Support
  preCacheForShift,
  searchOffline,
  getPendingCount,
  // Constants
  LAB_ORDER_STATUSES,
  LAB_PRIORITIES,
  LAB_RESULT_STATUSES,
  SPECIMEN_QUALITY,
  RESULT_FLAGS,
  SPECIMEN_TYPES,
  REJECTION_REASONS
};
