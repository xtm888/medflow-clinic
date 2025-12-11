// IndexedDB Configuration using Dexie
import Dexie from 'dexie';
import { toast } from 'react-toastify';
import {
  encryptEntityData,
  decryptEntityData,
  encryptEntityArray,
  decryptEntityArray,
  hasSensitiveFields,
  isEncryptionActive
} from './crypto';

// Create database instance
export const db = new Dexie('MedFlowDB');

// Define database schema - Version 2 (legacy)
db.version(2).stores({
  users: 'id, email, username, role, lastSync',
  patients: 'id, patientId, nationalId, firstName, lastName, phoneNumber, email, lastSync, *allergies',
  appointments: 'id, appointmentId, patientId, providerId, date, status, queueNumber, checkInTime, lastSync',
  queue: 'id, patientId, appointmentId, status, priority, queueNumber, checkInTime, providerId, lastSync',
  visits: 'id, visitId, patientId, providerId, date, status, chiefComplaint, lastSync',
  prescriptions: 'id, prescriptionId, patientId, prescriberId, type, status, lastSync',
  ophthalmologyExams: 'id, examId, patientId, examinerId, examType, status, visitId, lastSync',
  syncQueue: '++id, timestamp, operation, entity, entityId, data, status, retryCount, lastError',
  conflicts: '++id, timestamp, entity, entityId, localData, serverData, resolution, resolvedBy, resolvedAt',
  cacheMetadata: 'key, timestamp, expiresAt',
  settings: 'key, value',
  notifications: '++id, type, title, message, timestamp, read',
  auditLog: '++id, userId, action, entity, entityId, timestamp, details',
  files: 'id, patientId, type, name, data, mimeType, size, uploadStatus, lastSync'
});

// Define database schema - Version 3 (adds lab, billing, enhanced sync)
db.version(3).stores({
  // User data
  users: 'id, email, username, role, lastSync',

  // Patient data - expanded for offline access
  patients: 'id, patientId, nationalId, firstName, lastName, phoneNumber, email, lastSync, *allergies',

  // Appointments - includes queue data (queueNumber, checkInTime)
  appointments: 'id, appointmentId, patientId, providerId, date, status, queueNumber, checkInTime, lastSync',

  // Queue view - mirrors appointments for quick queue access
  queue: 'id, patientId, appointmentId, status, priority, queueNumber, checkInTime, providerId, lastSync',

  // Visits - for patient history
  visits: 'id, visitId, patientId, providerId, date, status, chiefComplaint, lastSync',

  // Prescriptions
  prescriptions: 'id, prescriptionId, patientId, prescriberId, type, status, lastSync',

  // Ophthalmology exams
  ophthalmologyExams: 'id, examId, patientId, examinerId, examType, status, visitId, lastSync',

  // Laboratory orders - NEW
  labOrders: 'id, patientId, visitId, status, priority, orderedBy, orderedAt, lastSync',

  // Laboratory results - NEW
  labResults: 'id, orderId, patientId, testCode, status, resultedAt, verifiedBy, lastSync',

  // Invoices - NEW
  invoices: 'id, invoiceNumber, patientId, visitId, status, dueDate, totalAmount, lastSync',

  // Payments - NEW
  payments: 'id, invoiceId, patientId, method, amount, paymentDate, lastSync',

  // Consultation sessions - for multi-step workflow state
  consultationSessions: 'id, patientId, doctorId, visitId, status, step, lastSync',

  // Devices - for device management and offline access
  devices: 'id, serialNumber, type, status, clinicId',

  // Sync queue for offline operations - enhanced with nextRetryAt for exponential backoff
  syncQueue: '++id, timestamp, operation, entity, entityId, data, status, retryCount, lastError, nextRetryAt',

  // Conflict resolution log
  conflicts: '++id, timestamp, entity, entityId, localData, serverData, resolution, resolvedBy, resolvedAt',

  // Cache metadata
  cacheMetadata: 'key, timestamp, expiresAt',

  // Settings
  settings: 'key, value',

  // Notifications
  notifications: '++id, type, title, message, timestamp, read',

  // Audit log
  auditLog: '++id, userId, action, entity, entityId, timestamp, details',

  // Images and files
  files: 'id, patientId, type, name, data, mimeType, size, uploadStatus, lastSync'
});

// Define database schema - Version 4 (adds multi-clinic offline support)
db.version(4).stores({
  // User data
  users: 'id, email, username, role, lastSync',

  // Patient data - expanded for offline access
  patients: 'id, patientId, nationalId, firstName, lastName, phoneNumber, email, lastSync, *allergies',

  // Appointments - includes queue data (queueNumber, checkInTime)
  appointments: 'id, appointmentId, patientId, providerId, date, status, queueNumber, checkInTime, lastSync',

  // Queue view - mirrors appointments for quick queue access
  queue: 'id, patientId, appointmentId, status, priority, queueNumber, checkInTime, providerId, lastSync',

  // Visits - for patient history
  visits: 'id, visitId, patientId, providerId, date, status, chiefComplaint, lastSync',

  // Prescriptions
  prescriptions: 'id, prescriptionId, patientId, prescriberId, type, status, lastSync',

  // Ophthalmology exams
  ophthalmologyExams: 'id, examId, patientId, examinerId, examType, status, visitId, lastSync',

  // Laboratory orders
  labOrders: 'id, patientId, visitId, status, priority, orderedBy, orderedAt, lastSync',

  // Laboratory results
  labResults: 'id, orderId, patientId, testCode, status, resultedAt, verifiedBy, lastSync',

  // Invoices
  invoices: 'id, invoiceNumber, patientId, visitId, status, dueDate, totalAmount, lastSync',

  // Payments
  payments: 'id, invoiceId, patientId, method, amount, paymentDate, lastSync',

  // Consultation sessions - for multi-step workflow state
  consultationSessions: 'id, patientId, doctorId, visitId, status, step, lastSync',

  // Devices - for device management and offline access
  devices: 'id, serialNumber, type, status, clinicId',

  // Sync queue for offline operations - enhanced with nextRetryAt for exponential backoff
  syncQueue: '++id, timestamp, operation, entity, entityId, data, status, retryCount, lastError, nextRetryAt',

  // Conflict resolution log
  conflicts: '++id, timestamp, entity, entityId, localData, serverData, resolution, resolvedBy, resolvedAt',

  // Cache metadata
  cacheMetadata: 'key, timestamp, expiresAt',

  // Settings
  settings: 'key, value',

  // Notifications
  notifications: '++id, type, title, message, timestamp, read',

  // Audit log
  auditLog: '++id, userId, action, entity, entityId, timestamp, details',

  // Images and files
  files: 'id, patientId, type, name, data, mimeType, size, uploadStatus, lastSync',

  // NEW: Multi-clinic offline support stores
  pharmacyInventory: 'id, medicationName, genericName, category, clinicId, stockLevel, expiryDate, lastSync',
  orthopticExams: 'id, patientId, visitId, examinerId, status, examDate, clinicId, lastSync',
  glassesOrders: 'id, patientId, examId, status, orderDate, clinicId, lastSync',
  frameInventory: 'id, brand, model, sku, category, clinicId, stockLevel, lastSync',
  contactLensInventory: 'id, brand, type, power, baseCurve, clinicId, stockLevel, lastSync',
  clinics: 'id, name, type, isHub, syncInterval, lastSync',
  approvals: 'id, patientId, companyId, actCode, status, expiresAt, clinicId, lastSync',
  stockReconciliations: 'id, inventoryType, status, clinicId, startedAt, lastSync'
});

// Define database schema - Version 5 (adds treatment protocols and clinicId indexes)
db.version(5).stores({
  // User data
  users: 'id, email, username, role, clinicId, lastSync',

  // Patient data - expanded for offline access
  patients: 'id, patientId, nationalId, firstName, lastName, phoneNumber, email, lastSync, *allergies',

  // Appointments - includes queue data (queueNumber, checkInTime)
  appointments: 'id, appointmentId, patientId, providerId, date, status, queueNumber, checkInTime, clinicId, lastSync',

  // Queue view - mirrors appointments for quick queue access
  queue: 'id, patientId, appointmentId, status, priority, queueNumber, checkInTime, providerId, clinicId, lastSync',

  // Visits - for patient history
  visits: 'id, visitId, patientId, providerId, date, status, chiefComplaint, clinicId, lastSync',

  // Prescriptions
  prescriptions: 'id, prescriptionId, patientId, prescriberId, type, status, clinicId, lastSync',

  // Ophthalmology exams
  ophthalmologyExams: 'id, examId, patientId, examinerId, examType, status, visitId, clinicId, lastSync',

  // Laboratory orders
  labOrders: 'id, patientId, visitId, status, priority, orderedBy, orderedAt, clinicId, lastSync',

  // Laboratory results
  labResults: 'id, orderId, patientId, testCode, status, resultedAt, verifiedBy, clinicId, lastSync',

  // Invoices
  invoices: 'id, invoiceNumber, patientId, visitId, status, dueDate, totalAmount, clinicId, lastSync',

  // Payments
  payments: 'id, invoiceId, patientId, method, amount, paymentDate, lastSync',

  // Consultation sessions - for multi-step workflow state
  consultationSessions: 'id, patientId, doctorId, visitId, status, step, lastSync',

  // Devices - for device management and offline access
  devices: 'id, serialNumber, type, status, clinicId',

  // Sync queue for offline operations - enhanced with nextRetryAt for exponential backoff
  syncQueue: '++id, timestamp, operation, entity, entityId, data, status, retryCount, lastError, nextRetryAt',

  // Conflict resolution log
  conflicts: '++id, timestamp, entity, entityId, localData, serverData, resolution, resolvedBy, resolvedAt',

  // Cache metadata
  cacheMetadata: 'key, timestamp, expiresAt',

  // Settings
  settings: 'key, value',

  // Notifications
  notifications: '++id, type, title, message, timestamp, read',

  // Audit log
  auditLog: '++id, userId, action, entity, entityId, timestamp, details',

  // Images and files
  files: 'id, patientId, type, name, data, mimeType, size, uploadStatus, lastSync',

  // Multi-clinic offline support stores
  pharmacyInventory: 'id, medicationName, genericName, category, clinicId, stockLevel, expiryDate, lastSync',
  orthopticExams: 'id, patientId, visitId, examinerId, status, examDate, clinicId, lastSync',
  glassesOrders: 'id, patientId, examId, status, orderDate, clinicId, lastSync',
  frameInventory: 'id, brand, model, sku, category, clinicId, stockLevel, lastSync',
  contactLensInventory: 'id, brand, type, power, baseCurve, clinicId, stockLevel, lastSync',
  clinics: 'id, name, type, isHub, syncInterval, lastSync',
  approvals: 'id, patientId, companyId, actCode, status, expiresAt, clinicId, lastSync',
  stockReconciliations: 'id, inventoryType, status, clinicId, startedAt, lastSync',

  // Treatment protocols - NEW in version 5
  treatmentProtocols: 'id, name, category, diagnosis, createdBy, isSystemWide, clinicId, lastSync',

  // IVT Vials - NEW in version 5 (safety-critical medication tracking)
  ivtVials: 'id, medication, batchNumber, status, expiryDate, openedAt, clinicId, lastSync'
});

// Define database schema - Version 6 (adds surgery cases for offline support)
db.version(6).stores({
  // User data
  users: 'id, email, username, role, clinicId, lastSync',

  // Patient data - expanded for offline access
  patients: 'id, patientId, nationalId, firstName, lastName, phoneNumber, email, lastSync, *allergies',

  // Appointments - includes queue data (queueNumber, checkInTime)
  appointments: 'id, appointmentId, patientId, providerId, date, status, queueNumber, checkInTime, clinicId, lastSync',

  // Queue view - mirrors appointments for quick queue access
  queue: 'id, patientId, appointmentId, status, priority, queueNumber, checkInTime, providerId, clinicId, lastSync',

  // Visits - for patient history
  visits: 'id, visitId, patientId, providerId, date, status, chiefComplaint, clinicId, lastSync',

  // Prescriptions
  prescriptions: 'id, prescriptionId, patientId, prescriberId, type, status, clinicId, lastSync',

  // Ophthalmology exams
  ophthalmologyExams: 'id, examId, patientId, examinerId, examType, status, visitId, clinicId, lastSync',

  // Laboratory orders
  labOrders: 'id, patientId, visitId, status, priority, orderedBy, orderedAt, clinicId, lastSync',

  // Laboratory results
  labResults: 'id, orderId, patientId, testCode, status, resultedAt, verifiedBy, clinicId, lastSync',

  // Invoices
  invoices: 'id, invoiceNumber, patientId, visitId, status, dueDate, totalAmount, clinicId, lastSync',

  // Payments
  payments: 'id, invoiceId, patientId, method, amount, paymentDate, lastSync',

  // Consultation sessions - for multi-step workflow state
  consultationSessions: 'id, patientId, doctorId, visitId, status, step, lastSync',

  // Devices - for device management and offline access
  devices: 'id, serialNumber, type, status, clinicId',

  // Sync queue for offline operations - enhanced with nextRetryAt for exponential backoff
  syncQueue: '++id, timestamp, operation, entity, entityId, data, status, retryCount, lastError, nextRetryAt',

  // Conflict resolution log
  conflicts: '++id, timestamp, entity, entityId, localData, serverData, resolution, resolvedBy, resolvedAt',

  // Cache metadata
  cacheMetadata: 'key, timestamp, expiresAt',

  // Settings
  settings: 'key, value',

  // Notifications
  notifications: '++id, type, title, message, timestamp, read',

  // Audit log
  auditLog: '++id, userId, action, entity, entityId, timestamp, details',

  // Images and files
  files: 'id, patientId, type, name, data, mimeType, size, uploadStatus, lastSync',

  // Multi-clinic offline support stores
  pharmacyInventory: 'id, medicationName, genericName, category, clinicId, stockLevel, expiryDate, lastSync',
  orthopticExams: 'id, patientId, visitId, examinerId, status, examDate, clinicId, lastSync',
  glassesOrders: 'id, patientId, examId, status, orderDate, clinicId, lastSync',
  frameInventory: 'id, brand, model, sku, category, clinicId, stockLevel, lastSync',
  contactLensInventory: 'id, brand, type, power, baseCurve, clinicId, stockLevel, lastSync',
  clinics: 'id, name, type, isHub, syncInterval, lastSync',
  approvals: 'id, patientId, companyId, actCode, status, expiresAt, clinicId, lastSync',
  stockReconciliations: 'id, inventoryType, status, clinicId, startedAt, lastSync',

  // Treatment protocols
  treatmentProtocols: 'id, name, category, diagnosis, createdBy, isSystemWide, clinicId, lastSync',

  // IVT Vials (safety-critical medication tracking)
  ivtVials: 'id, medication, batchNumber, status, expiryDate, openedAt, clinicId, lastSync',

  // Surgery cases - NEW in version 6
  surgeryCases: 'id, patientId, scheduledDate, status, procedureType, surgeonId, clinicId, lastSync'
});

// ============================================
// QUOTA ERROR HANDLING
// ============================================

/**
 * Handle IndexedDB quota exceeded errors
 * @param {Error} error - The error object
 * @param {string} operation - The operation that failed
 * @returns {boolean} - True if quota error was handled
 */
const handleQuotaError = async (error, operation) => {
  if (error.name === 'QuotaExceededError' ||
      error.message?.includes('quota') ||
      error.inner?.name === 'QuotaExceededError') {
    console.error('[Database] Storage quota exceeded:', operation);

    // Notify user in French
    toast.error(
      'Stockage local plein. Veuillez libérer de l\'espace ou effacer les données anciennes.',
      { autoClose: 10000 }
    );

    // Try to clear old cache data
    try {
      await clearOldCacheData();
    } catch (clearError) {
      console.error('[Database] Failed to clear old cache:', clearError);
    }

    return true; // Indicate quota error was handled
  }
  return false;
};

/**
 * Clear old cache data to free up storage space
 */
const clearOldCacheData = async () => {
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  try {
    // Clear old cache metadata
    const deletedCache = await db.cacheMetadata
      .where('timestamp')
      .below(new Date(oneWeekAgo).toISOString())
      .delete();

    // Clear old notifications
    const deletedNotifications = await db.notifications
      .where('timestamp')
      .below(new Date(oneWeekAgo).toISOString())
      .delete();

    console.log(`[Database] Cleared old cache data: ${deletedCache} cache entries, ${deletedNotifications} notifications`);
  } catch (error) {
    console.error('[Database] Error clearing old cache data:', error);
    throw error;
  }
};

// Database helper functions
class DatabaseService {
  // Initialize database
  async init() {
    try {
      await db.open();
      console.log('IndexedDB initialized successfully');

      // Set default settings if not exists
      const offlineMode = await this.getSetting('offlineMode');
      if (offlineMode === undefined) {
        await this.setSetting('offlineMode', false);
      }

      const lastSync = await this.getSetting('lastSync');
      if (!lastSync) {
        await this.setSetting('lastSync', new Date().toISOString());
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      return false;
    }
  }

  // Settings management
  async getSetting(key) {
    const setting = await db.settings.get(key);
    return setting ? setting.value : undefined;
  }

  async setSetting(key, value) {
    return await db.settings.put({ key, value });
  }

  // Patient operations
  async savePatient(patient) {
    patient.lastSync = new Date().toISOString();
    return await db.patients.put(patient);
  }

  async getPatient(id) {
    return await db.patients.get(id);
  }

  async getAllPatients() {
    return await db.patients.toArray();
  }

  async searchPatients(query) {
    const lowerQuery = query.toLowerCase();
    return await db.patients
      .filter(patient =>
        patient.firstName.toLowerCase().includes(lowerQuery) ||
        patient.lastName.toLowerCase().includes(lowerQuery) ||
        patient.patientId.toLowerCase().includes(lowerQuery) ||
        patient.email?.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }

  // Appointment operations
  async saveAppointment(appointment) {
    appointment.lastSync = new Date().toISOString();
    return await db.appointments.put(appointment);
  }

  async getAppointment(id) {
    return await db.appointments.get(id);
  }

  async getAppointmentsByDate(date) {
    return await db.appointments
      .where('date')
      .equals(date)
      .toArray();
  }

  async getAppointmentsByPatient(patientId) {
    return await db.appointments
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  // Prescription operations
  async savePrescription(prescription) {
    prescription.lastSync = new Date().toISOString();
    return await db.prescriptions.put(prescription);
  }

  async getPrescription(id) {
    return await db.prescriptions.get(id);
  }

  async getPrescriptionsByPatient(patientId) {
    return await db.prescriptions
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  // Ophthalmology exam operations
  async saveOphthalmologyExam(exam) {
    exam.lastSync = new Date().toISOString();
    return await db.ophthalmologyExams.put(exam);
  }

  async getOphthalmologyExam(id) {
    return await db.ophthalmologyExams.get(id);
  }

  async getOphthalmologyExamsByPatient(patientId) {
    return await db.ophthalmologyExams
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  // Laboratory order operations
  async saveLabOrder(order) {
    order.lastSync = new Date().toISOString();
    return await db.labOrders.put({
      ...order,
      id: order._id || order.id
    });
  }

  async getLabOrder(id) {
    return await db.labOrders.get(id);
  }

  async getLabOrdersByPatient(patientId) {
    return await db.labOrders
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  async getLabOrdersByVisit(visitId) {
    return await db.labOrders
      .where('visitId')
      .equals(visitId)
      .toArray();
  }

  async getLabOrdersByStatus(status) {
    return await db.labOrders
      .where('status')
      .equals(status)
      .toArray();
  }

  async getPendingLabOrders() {
    return await db.labOrders
      .where('status')
      .anyOf(['pending', 'in_progress', 'collected'])
      .toArray();
  }

  // Laboratory result operations
  async saveLabResult(result) {
    result.lastSync = new Date().toISOString();
    return await db.labResults.put({
      ...result,
      id: result._id || result.id
    });
  }

  async getLabResult(id) {
    return await db.labResults.get(id);
  }

  async getLabResultsByOrder(orderId) {
    return await db.labResults
      .where('orderId')
      .equals(orderId)
      .toArray();
  }

  async getLabResultsByPatient(patientId) {
    return await db.labResults
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  // Invoice operations
  async saveInvoice(invoice) {
    invoice.lastSync = new Date().toISOString();
    return await db.invoices.put({
      ...invoice,
      id: invoice._id || invoice.id
    });
  }

  async getInvoice(id) {
    return await db.invoices.get(id);
  }

  async getInvoicesByPatient(patientId) {
    return await db.invoices
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  async getInvoicesByVisit(visitId) {
    return await db.invoices
      .where('visitId')
      .equals(visitId)
      .toArray();
  }

  async getInvoicesByStatus(status) {
    return await db.invoices
      .where('status')
      .equals(status)
      .toArray();
  }

  async getUnpaidInvoices() {
    return await db.invoices
      .where('status')
      .anyOf(['pending', 'partial', 'overdue'])
      .toArray();
  }

  // Payment operations
  async savePayment(payment) {
    payment.lastSync = new Date().toISOString();
    return await db.payments.put({
      ...payment,
      id: payment._id || payment.id
    });
  }

  async getPayment(id) {
    return await db.payments.get(id);
  }

  async getPaymentsByInvoice(invoiceId) {
    return await db.payments
      .where('invoiceId')
      .equals(invoiceId)
      .toArray();
  }

  async getPaymentsByPatient(patientId) {
    return await db.payments
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  // Queue operations
  async addToQueue(queueItem) {
    queueItem.lastSync = new Date().toISOString();
    queueItem.checkInTime = new Date().toISOString();
    return await db.queue.put(queueItem);
  }

  async updateQueueStatus(id, status) {
    return await db.queue.update(id, { status, lastSync: new Date().toISOString() });
  }

  async getActiveQueue() {
    return await db.queue
      .where('status')
      .notEqual('completed')
      .toArray();
  }

  // Sync queue operations
  async addToSyncQueue(operation, entity, entityId, data) {
    const syncItem = {
      timestamp: new Date().toISOString(),
      operation, // CREATE, UPDATE, DELETE
      entity, // patients, appointments, prescriptions, etc.
      entityId,
      data,
      status: 'pending',
      retryCount: 0
    };

    const id = await db.syncQueue.add(syncItem);

    // Trigger background sync if available
    if ('serviceWorker' in navigator && self.registration && 'sync' in self.registration) {
      await self.registration.sync.register('medflow-sync-queue');
    }

    return id;
  }

  async getSyncQueue() {
    return await db.syncQueue
      .where('status')
      .equals('pending')
      .toArray();
  }

  async updateSyncItem(id, updates) {
    return await db.syncQueue.update(id, updates);
  }

  async clearSyncQueue() {
    return await db.syncQueue
      .where('status')
      .equals('completed')
      .delete();
  }

  // Conflict resolution
  async logConflict(entity, entityId, localData, serverData, resolution, resolvedBy) {
    return await db.conflicts.add({
      timestamp: new Date().toISOString(),
      entity,
      entityId,
      localData,
      serverData,
      resolution, // 'local', 'server', 'merged'
      resolvedBy
    });
  }

  async getConflicts() {
    return await db.conflicts.toArray();
  }

  // Notifications
  async addNotification(type, title, message) {
    return await db.notifications.add({
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  async getUnreadNotifications() {
    return await db.notifications
      .where('read')
      .equals(false)
      .toArray();
  }

  async markNotificationAsRead(id) {
    return await db.notifications.update(id, { read: true });
  }

  // Audit logging
  async logAction(userId, action, entity, entityId, details) {
    return await db.auditLog.add({
      userId,
      action,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      details
    });
  }

  async getAuditLog(filters = {}) {
    let query = db.auditLog;

    if (filters.userId) {
      query = query.where('userId').equals(filters.userId);
    }

    if (filters.entity) {
      query = query.where('entity').equals(filters.entity);
    }

    return await query.reverse().limit(100).toArray();
  }

  // File operations
  async saveFile(file) {
    file.lastSync = new Date().toISOString();
    file.uploadStatus = 'pending';
    return await db.files.put(file);
  }

  async getFile(id) {
    return await db.files.get(id);
  }

  async getFilesByPatient(patientId) {
    return await db.files
      .where('patientId')
      .equals(patientId)
      .toArray();
  }

  async updateFileUploadStatus(id, status) {
    return await db.files.update(id, { uploadStatus: status });
  }

  // Cache management
  async setCacheMetadata(key, expiresIn = 3600) {
    return await db.cacheMetadata.put({
      key,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    });
  }

  async isCacheValid(key) {
    const metadata = await db.cacheMetadata.get(key);
    if (!metadata) return false;

    return new Date(metadata.expiresAt) > new Date();
  }

  // Bulk operations for sync
  async bulkSave(entity, items) {
    const table = db[entity];
    if (!table) {
      throw new Error(`Entity ${entity} not found in database`);
    }

    const itemsWithSync = items.map(item => ({
      ...item,
      lastSync: new Date().toISOString()
    }));

    try {
      return await table.bulkPut(itemsWithSync);
    } catch (error) {
      const wasHandled = await handleQuotaError(error, `bulkSave ${entity}`);
      if (wasHandled) {
        // Re-throw with user-friendly message
        throw new Error('Stockage local plein. Impossible de sauvegarder les données hors ligne.');
      }
      throw error;
    }
  }

  async getChangedSince(entity, timestamp) {
    const table = db[entity];
    if (!table) {
      throw new Error(`Entity ${entity} not found in database`);
    }

    return await table
      .where('lastSync')
      .above(timestamp)
      .toArray();
  }

  // Clear all data (use with caution)
  async clearAll() {
    const tables = db.tables;
    const promises = tables.map(table => table.clear());
    await Promise.all(promises);
    console.log('All IndexedDB data cleared');
  }

  // Export data for backup
  async exportData() {
    const data = {};
    const tables = db.tables;

    for (const table of tables) {
      data[table.name] = await table.toArray();
    }

    return data;
  }

  // Import data from backup
  async importData(data) {
    for (const [tableName, records] of Object.entries(data)) {
      const table = db[tableName];
      if (table) {
        await table.bulkPut(records);
      }
    }
  }

  // Get database statistics
  async getStats() {
    const stats = {};
    const tables = db.tables;

    for (const table of tables) {
      stats[table.name] = await table.count();
    }

    return stats;
  }

  // =====================================================
  // ENCRYPTION-ENABLED OPERATIONS
  // These methods automatically encrypt/decrypt sensitive fields
  // =====================================================

  /**
   * Save data with automatic encryption of sensitive fields
   * @param {string} entity - Table name (e.g., 'patients', 'prescriptions')
   * @param {Object} data - Data to save
   * @returns {Promise}
   */
  async saveEncrypted(entity, data) {
    const table = db[entity];
    if (!table) {
      throw new Error(`Entity ${entity} not found in database`);
    }

    // Encrypt if entity has sensitive fields and encryption is active
    let dataToSave = data;
    if (hasSensitiveFields(entity) && isEncryptionActive()) {
      try {
        dataToSave = await encryptEntityData(entity, data);
      } catch (error) {
        console.warn(`[DB] Encryption failed for ${entity}, saving unencrypted:`, error.message);
      }
    }

    dataToSave.lastSync = new Date().toISOString();
    dataToSave.id = data._id || data.id;

    try {
      return await table.put(dataToSave);
    } catch (error) {
      const wasHandled = await handleQuotaError(error, `saveEncrypted ${entity}`);
      if (wasHandled) {
        throw new Error('Stockage local plein. Impossible de sauvegarder les données hors ligne.');
      }
      throw error;
    }
  }

  /**
   * Get data with automatic decryption of sensitive fields
   * @param {string} entity - Table name
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async getDecrypted(entity, id) {
    const table = db[entity];
    if (!table) {
      throw new Error(`Entity ${entity} not found in database`);
    }

    const data = await table.get(id);
    if (!data) return null;

    // Decrypt if data is encrypted and encryption is active
    if (data._encrypted && isEncryptionActive()) {
      try {
        return await decryptEntityData(entity, data);
      } catch (error) {
        console.warn(`[DB] Decryption failed for ${entity}, returning encrypted:`, error.message);
      }
    }

    return data;
  }

  /**
   * Get all records with automatic decryption
   * @param {string} entity - Table name
   * @returns {Promise<Array>}
   */
  async getAllDecrypted(entity) {
    const table = db[entity];
    if (!table) {
      throw new Error(`Entity ${entity} not found in database`);
    }

    const items = await table.toArray();

    if (isEncryptionActive() && items.some(item => item._encrypted)) {
      try {
        return await decryptEntityArray(entity, items);
      } catch (error) {
        console.warn(`[DB] Batch decryption failed for ${entity}:`, error.message);
      }
    }

    return items;
  }

  /**
   * Bulk save with encryption
   * @param {string} entity - Table name
   * @param {Array} items - Array of items to save
   * @returns {Promise}
   */
  async bulkSaveEncrypted(entity, items) {
    const table = db[entity];
    if (!table) {
      throw new Error(`Entity ${entity} not found in database`);
    }

    let itemsToSave = items;

    if (hasSensitiveFields(entity) && isEncryptionActive()) {
      try {
        itemsToSave = await encryptEntityArray(entity, items);
      } catch (error) {
        console.warn(`[DB] Bulk encryption failed for ${entity}:`, error.message);
      }
    }

    const itemsWithSync = itemsToSave.map(item => ({
      ...item,
      id: item._id || item.id,
      lastSync: new Date().toISOString()
    }));

    try {
      return await table.bulkPut(itemsWithSync);
    } catch (error) {
      const wasHandled = await handleQuotaError(error, `bulkSaveEncrypted ${entity}`);
      if (wasHandled) {
        throw new Error('Stockage local plein. Impossible de sauvegarder les données hors ligne.');
      }
      throw error;
    }
  }

  /**
   * Query with decryption
   * @param {string} entity - Table name
   * @param {string} field - Field to query
   * @param {*} value - Value to match
   * @returns {Promise<Array>}
   */
  async queryDecrypted(entity, field, value) {
    const table = db[entity];
    if (!table) {
      throw new Error(`Entity ${entity} not found in database`);
    }

    const items = await table.where(field).equals(value).toArray();

    if (isEncryptionActive() && items.some(item => item._encrypted)) {
      try {
        return await decryptEntityArray(entity, items);
      } catch (error) {
        console.warn(`[DB] Query decryption failed for ${entity}:`, error.message);
      }
    }

    return items;
  }

  /**
   * Check if encryption is currently active
   * @returns {boolean}
   */
  isEncryptionEnabled() {
    return isEncryptionActive();
  }

  /**
   * Get encryption status info
   * @returns {Object}
   */
  getEncryptionStatus() {
    return {
      enabled: isEncryptionActive(),
      entitiesWithEncryption: [
        'patients',
        'prescriptions',
        'ophthalmologyExams',
        'labOrders',
        'labResults',
        'invoices',
        'visits',
        'appointments'
      ]
    };
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

// Initialize on load
if (typeof window !== 'undefined') {
  databaseService.init().catch(console.error);
}

export default databaseService;