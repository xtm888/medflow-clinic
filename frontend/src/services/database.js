// IndexedDB Configuration using Dexie
import Dexie from 'dexie';

// Create database instance
export const db = new Dexie('MedFlowDB');

// Define database schema
db.version(1).stores({
  // User data
  users: 'id, email, username, role, lastSync',

  // Patient data
  patients: 'id, patientId, nationalId, firstName, lastName, phoneNumber, email, lastSync',

  // Appointments
  appointments: 'id, appointmentId, patientId, providerId, date, status, lastSync',

  // Prescriptions
  prescriptions: 'id, prescriptionId, patientId, prescriberId, type, status, lastSync',

  // Ophthalmology exams
  ophthalmologyExams: 'id, examId, patientId, examinerId, examType, status, lastSync',

  // Queue management
  queue: 'id, patientId, appointmentId, status, priority, checkInTime, lastSync',

  // Sync queue for offline operations
  syncQueue: '++id, timestamp, operation, entity, entityId, data, status, retryCount',

  // Conflict resolution log
  conflicts: '++id, timestamp, entity, entityId, localData, serverData, resolution, resolvedBy',

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
    if ('serviceWorker' in navigator && 'sync' in self.registration) {
      await self.registration.sync.register('sync-queue');
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

    return await table.bulkPut(itemsWithSync);
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
}

// Create singleton instance
const databaseService = new DatabaseService();

// Initialize on load
if (typeof window !== 'undefined') {
  databaseService.init().catch(console.error);
}

export default databaseService;