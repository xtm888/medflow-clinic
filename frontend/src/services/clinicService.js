import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Clinic Service
 * Handles all clinic/location related API calls
 * READ operations work offline, WRITE operations require internet
 */

// ============================================
// CLINIC CRUD - READ: OFFLINE, WRITE: ONLINE ONLY
// ============================================

/**
 * Get all clinics with optional filters
 */
export const getClinics = async (params = {}) => {
  const cacheKey = `clinics_all_${JSON.stringify(params)}`;
  return offlineWrapper.get(
    () => api.get('/clinics', { params }),
    'clinics',
    cacheKey,
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

/**
 * Get clinics for dropdown (minimal data)
 */
export const getClinicsForDropdown = async () => {
  return offlineWrapper.get(
    () => api.get('/clinics/dropdown'),
    'clinics',
    'dropdown',
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

/**
 * Get user's accessible clinics
 */
export const getMyClinics = async () => {
  return offlineWrapper.get(
    () => api.get('/clinics/my-clinics'),
    'clinics',
    'my_clinics',
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

/**
 * Get single clinic by ID
 */
export const getClinic = async (id) => {
  return offlineWrapper.get(
    () => api.get(`/clinics/${id}`),
    'clinics',
    id,
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

// Admin operations - ONLINE ONLY
/**
 * Create new clinic
 */
export const createClinic = async (clinicData) => {
  if (!navigator.onLine) throw new Error('Creating clinics requires internet connection.');
  const response = await api.post('/clinics', clinicData);
  return response.data;
};

/**
 * Update clinic
 */
export const updateClinic = async (id, clinicData) => {
  if (!navigator.onLine) throw new Error('Updating clinics requires internet connection.');
  const response = await api.put(`/clinics/${id}`, clinicData);
  return response.data;
};

/**
 * Delete clinic
 */
export const deleteClinic = async (id) => {
  if (!navigator.onLine) throw new Error('Deleting clinics requires internet connection.');
  const response = await api.delete(`/clinics/${id}`);
  return response.data;
};

// ============================================
// CLINIC STAFF - READ: OFFLINE, WRITE: ONLINE ONLY
// ============================================

/**
 * Get staff for a clinic
 */
export const getClinicStaff = async (clinicId) => {
  return offlineWrapper.get(
    () => api.get(`/clinics/${clinicId}/staff`),
    'clinics',
    `staff_${clinicId}`,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

/**
 * Assign user to clinic
 */
export const assignUserToClinic = async (clinicId, userId) => {
  if (!navigator.onLine) throw new Error('Staff assignment requires internet connection.');
  const response = await api.post(`/clinics/${clinicId}/staff/${userId}`);
  return response.data;
};

/**
 * Remove user from clinic
 */
export const removeUserFromClinic = async (clinicId, userId) => {
  if (!navigator.onLine) throw new Error('Staff removal requires internet connection.');
  const response = await api.delete(`/clinics/${clinicId}/staff/${userId}`);
  return response.data;
};

// ============================================
// STATISTICS - WORKS OFFLINE
// ============================================

/**
 * Get clinic statistics
 */
export const getClinicStats = async (clinicId) => {
  return offlineWrapper.get(
    () => api.get(`/clinics/${clinicId}/stats`),
    'clinics',
    `stats_${clinicId}`,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

/**
 * Get all clinics summary stats
 */
export const getAllClinicsStats = async () => {
  return offlineWrapper.get(
    () => api.get('/clinics/stats/summary'),
    'clinics',
    'stats_summary',
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

// ============================================
// OFFLINE HELPERS
// ============================================

/**
 * Pre-cache essential clinic data for offline use
 */
export const preCacheClinicData = async () => {
  const results = { cached: 0, errors: [] };
  try { await getClinics(); results.cached++; } catch { results.errors.push('clinics'); }
  try { await getMyClinics(); results.cached++; } catch { results.errors.push('myClinics'); }
  try { await getClinicsForDropdown(); results.cached++; } catch { results.errors.push('dropdown'); }
  return results;
};

/**
 * Get cached clinic by ID
 */
export const getCachedClinic = async (id) => {
  try { return await db.clinics.get(id); } catch { return null; }
};

/**
 * Get all cached clinics
 */
export const getCachedClinics = async () => {
  try { return await db.clinics.toArray(); } catch { return []; }
};

/**
 * Get clinic sync interval
 */
export const getClinicSyncInterval = async (clinicId) => {
  try {
    const clinic = await db.clinics.get(clinicId);
    return clinic?.syncInterval || 900000; // Default 15 min
  } catch { return 900000; }
};

// ============================================
// CONSTANTS
// ============================================

export const CLINIC_TYPES = [
  { value: 'main', label: 'Main Clinic' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'mobile', label: 'Mobile Unit' },
  { value: 'partner', label: 'Partner Clinic' },
  { value: 'depot', label: 'Depot/Warehouse' }
];

export const CLINIC_SERVICES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'optometry', label: 'Optometry' },
  { value: 'refraction', label: 'Refraction' },
  { value: 'oct', label: 'OCT Imaging' },
  { value: 'visual_field', label: 'Visual Field' },
  { value: 'fundus_photography', label: 'Fundus Photography' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'ivt_injections', label: 'IVT Injections' },
  { value: 'laser', label: 'Laser Treatment' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'optical_shop', label: 'Optical Shop' },
  { value: 'orthoptic', label: 'Orthoptic' }
];

// Default export for backward compatibility
export default {
  getClinics,
  getClinicsForDropdown,
  getMyClinics,
  getClinic,
  createClinic,
  updateClinic,
  deleteClinic,
  getClinicStaff,
  assignUserToClinic,
  removeUserFromClinic,
  getClinicStats,
  getAllClinicsStats,
  preCacheClinicData,
  getCachedClinic,
  getCachedClinics,
  getClinicSyncInterval,
  CLINIC_TYPES,
  CLINIC_SERVICES
};
