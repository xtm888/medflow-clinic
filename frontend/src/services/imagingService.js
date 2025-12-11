import api from './apiConfig';

/**
 * Imaging Service
 * Handles all imaging order and study related API calls
 */

// ============================================
// IMAGING ORDER ENDPOINTS
// ============================================

/**
 * Get all imaging orders with optional filters
 */
export const getImagingOrders = async (params = {}) => {
  const response = await api.get('/imaging/orders', { params });
  return response.data;
};

/**
 * Get single imaging order by ID
 */
export const getImagingOrder = async (id) => {
  const response = await api.get(`/imaging/orders/${id}`);
  return response.data;
};

/**
 * Create a new imaging order
 */
export const createImagingOrder = async (orderData) => {
  const response = await api.post('/imaging/orders', orderData);
  return response.data;
};

/**
 * Update an imaging order
 */
export const updateImagingOrder = async (id, orderData) => {
  const response = await api.put(`/imaging/orders/${id}`, orderData);
  return response.data;
};

/**
 * Schedule an imaging order
 */
export const scheduleImagingOrder = async (id, scheduleData) => {
  const response = await api.put(`/imaging/orders/${id}/schedule`, scheduleData);
  return response.data;
};

/**
 * Check-in patient for imaging
 */
export const checkInImagingOrder = async (id) => {
  const response = await api.put(`/imaging/orders/${id}/checkin`);
  return response.data;
};

/**
 * Start imaging procedure
 */
export const startImagingOrder = async (id, data = {}) => {
  const response = await api.put(`/imaging/orders/${id}/start`, data);
  return response.data;
};

/**
 * Complete imaging order
 */
export const completeImagingOrder = async (id, data = {}) => {
  const response = await api.put(`/imaging/orders/${id}/complete`, data);
  return response.data;
};

/**
 * Cancel imaging order
 */
export const cancelImagingOrder = async (id, reason) => {
  const response = await api.put(`/imaging/orders/${id}/cancel`, { reason });
  return response.data;
};

/**
 * Get pending imaging orders
 */
export const getPendingImagingOrders = async (params = {}) => {
  const response = await api.get('/imaging/orders/pending', { params });
  return response.data;
};

/**
 * Get scheduled orders for a specific date
 */
export const getScheduledImagingOrders = async (date, params = {}) => {
  const response = await api.get(`/imaging/orders/schedule/${date}`, { params });
  return response.data;
};

/**
 * Get patient's imaging order history
 */
export const getPatientImagingOrders = async (patientId, params = {}) => {
  const response = await api.get(`/imaging/orders/patient/${patientId}`, { params });
  return response.data;
};

// ============================================
// IMAGING STUDY ENDPOINTS
// ============================================

/**
 * Get all imaging studies with optional filters
 */
export const getImagingStudies = async (params = {}) => {
  const response = await api.get('/imaging/studies', { params });
  return response.data;
};

/**
 * Get single imaging study by ID
 */
export const getImagingStudy = async (id) => {
  const response = await api.get(`/imaging/studies/${id}`);
  return response.data;
};

/**
 * Create a new imaging study
 */
export const createImagingStudy = async (studyData) => {
  const response = await api.post('/imaging/studies', studyData);
  return response.data;
};

/**
 * Draft report for imaging study
 */
export const draftImagingReport = async (id, reportData) => {
  const response = await api.put(`/imaging/studies/${id}/draft-report`, reportData);
  return response.data;
};

/**
 * Finalize report for imaging study
 */
export const finalizeImagingReport = async (id, reportData) => {
  const response = await api.put(`/imaging/studies/${id}/finalize-report`, reportData);
  return response.data;
};

/**
 * Verify imaging report
 */
export const verifyImagingReport = async (id) => {
  const response = await api.put(`/imaging/studies/${id}/verify-report`);
  return response.data;
};

/**
 * Add addendum to imaging report
 */
export const addImagingAddendum = async (id, text, reason) => {
  const response = await api.post(`/imaging/studies/${id}/addendum`, { text, reason });
  return response.data;
};

/**
 * Acknowledge critical findings
 */
export const acknowledgeCriticalFindings = async (id) => {
  const response = await api.put(`/imaging/studies/${id}/acknowledge-critical`);
  return response.data;
};

/**
 * Get unreported imaging studies
 */
export const getUnreportedStudies = async (params = {}) => {
  const response = await api.get('/imaging/studies/unreported', { params });
  return response.data;
};

/**
 * Get unacknowledged critical findings
 */
export const getUnacknowledgedCritical = async () => {
  const response = await api.get('/imaging/studies/critical-unacknowledged');
  return response.data;
};

/**
 * Get patient's imaging study history
 */
export const getPatientImagingStudies = async (patientId, params = {}) => {
  const response = await api.get(`/imaging/studies/patient/${patientId}`, { params });
  return response.data;
};

/**
 * Add image to study
 */
export const addImageToStudy = async (id, imageData) => {
  const response = await api.post(`/imaging/studies/${id}/images`, imageData);
  return response.data;
};

// ============================================
// STATISTICS
// ============================================

/**
 * Get imaging statistics
 */
export const getImagingStatistics = async () => {
  const response = await api.get('/imaging/stats');
  return response.data;
};

// ============================================
// FILE STREAMING (Network Shares)
// ============================================

/**
 * Get streaming URL for a file from network share
 * @param {string} filePath - Path to the file on network share
 * @returns {string} URL for streaming the file
 */
export const getFileStreamUrl = (filePath) => {
  const encodedPath = encodeURIComponent(filePath);
  return `/api/imaging/files/stream?filePath=${encodedPath}`;
};

/**
 * Get thumbnail URL for an image
 * @param {string} filePath - Path to the source image
 * @param {number} size - Thumbnail size (default 200)
 * @returns {string} URL for the thumbnail
 */
export const getThumbnailUrl = (filePath, size = 200) => {
  const encodedPath = encodeURIComponent(filePath);
  return `/api/imaging/files/thumbnail?filePath=${encodedPath}&size=${size}`;
};

/**
 * Get file metadata without downloading content
 */
export const getFileInfo = async (filePath) => {
  const encodedPath = encodeURIComponent(filePath);
  const response = await api.get(`/imaging/files/info?filePath=${encodedPath}`);
  return response.data;
};

/**
 * Get exam files for a patient (metadata only - fast loading)
 */
export const getPatientExamFiles = async (patientId, params = {}) => {
  const response = await api.get(`/imaging/files/patient/${patientId}`, { params });
  return response.data;
};

/**
 * List files in a network share directory (admin only)
 */
export const listDirectoryFiles = async (directory, recursive = false, pattern = '') => {
  const response = await api.get('/imaging/files/list', {
    params: { directory, recursive, pattern }
  });
  return response.data;
};

/**
 * Lazy load image with progressive loading support
 * @param {string} filePath - Path to the image
 * @param {function} onProgress - Progress callback (optional)
 * @returns {Promise<string>} Blob URL for the loaded image
 */
export const lazyLoadImage = async (filePath, onProgress = null) => {
  const url = getFileStreamUrl(filePath);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to load image');
  }

  const reader = response.body.getReader();
  const contentLength = +response.headers.get('Content-Length');

  let receivedLength = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (onProgress && contentLength) {
      onProgress(Math.round((receivedLength / contentLength) * 100));
    }
  }

  const blob = new Blob(chunks);
  return URL.createObjectURL(blob);
};

/**
 * Preload thumbnails for a list of files
 * @param {string[]} filePaths - Array of file paths
 * @param {number} size - Thumbnail size
 */
export const preloadThumbnails = (filePaths, size = 200) => {
  filePaths.forEach(filePath => {
    const img = new Image();
    img.src = getThumbnailUrl(filePath, size);
  });
};

// ============================================
// MODALITY OPTIONS
// ============================================

export const IMAGING_MODALITIES = [
  { value: 'xray', label: 'X-Ray' },
  { value: 'ct', label: 'CT Scan' },
  { value: 'mri', label: 'MRI' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'mammography', label: 'Mammography' },
  { value: 'oct', label: 'OCT' },
  { value: 'fundus', label: 'Fundus Photography' },
  { value: 'fluorescein', label: 'Fluorescein Angiography' },
  { value: 'icg', label: 'ICG Angiography' },
  { value: 'visual_field', label: 'Visual Field' },
  { value: 'topography', label: 'Corneal Topography' },
  { value: 'biometry', label: 'Biometry' },
  { value: 'specular_microscopy', label: 'Specular Microscopy' },
  { value: 'pet', label: 'PET Scan' },
  { value: 'nuclear', label: 'Nuclear Medicine' },
  { value: 'dexa', label: 'DEXA Scan' },
  { value: 'other', label: 'Other' }
];

export const IMAGING_PRIORITIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'stat', label: 'STAT' },
  { value: 'asap', label: 'ASAP' }
];

export const IMAGING_ORDER_STATUSES = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'checked-in', label: 'Checked In' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no-show', label: 'No Show' }
];

export const IMAGING_STUDY_STATUSES = [
  { value: 'acquired', label: 'Acquired' },
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'final', label: 'Final' },
  { value: 'addendum', label: 'Addendum' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const REPORT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'draft', label: 'Draft' },
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'final', label: 'Final' },
  { value: 'addendum', label: 'Addendum' }
];

export default {
  // Orders
  getImagingOrders,
  getImagingOrder,
  createImagingOrder,
  updateImagingOrder,
  scheduleImagingOrder,
  checkInImagingOrder,
  startImagingOrder,
  completeImagingOrder,
  cancelImagingOrder,
  getPendingImagingOrders,
  getScheduledImagingOrders,
  getPatientImagingOrders,
  // Studies
  getImagingStudies,
  getImagingStudy,
  createImagingStudy,
  draftImagingReport,
  finalizeImagingReport,
  verifyImagingReport,
  addImagingAddendum,
  acknowledgeCriticalFindings,
  getUnreportedStudies,
  getUnacknowledgedCritical,
  getPatientImagingStudies,
  addImageToStudy,
  // Stats
  getImagingStatistics,
  // File Streaming (Network Shares)
  getFileStreamUrl,
  getThumbnailUrl,
  getFileInfo,
  getPatientExamFiles,
  listDirectoryFiles,
  lazyLoadImage,
  preloadThumbnails,
  // Constants
  IMAGING_MODALITIES,
  IMAGING_PRIORITIES,
  IMAGING_ORDER_STATUSES,
  IMAGING_STUDY_STATUSES,
  REPORT_STATUSES
};
