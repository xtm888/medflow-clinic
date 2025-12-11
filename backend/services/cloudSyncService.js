/**
 * Cloud Sync Service
 *
 * Manages bidirectional sync between local clinic and central cloud.
 * Handles:
 * - Outbound sync (local changes → cloud)
 * - Inbound sync (cloud changes → local)
 * - Cross-clinic patient lookup
 * - Conflict resolution
 * - Large file references
 */

const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Prescription = require('../models/Prescription');
const DeviceImage = require('../models/DeviceImage');
const DeviceMeasurement = require('../models/DeviceMeasurement');
const SyncQueue = require('../models/SyncQueue');
const Clinic = require('../models/Clinic');

class CloudSyncService {
  constructor() {
    this.cloudUrl = process.env.CLOUD_API_URL || null;
    this.clinicId = process.env.CLINIC_ID || 'KINSHASA_MAIN';
    this.syncInterval = null;
    this.isOnline = false;
    this.lastSyncTime = null;

    // Models that sync to cloud
    this.syncableModels = {
      Patient: { priority: 1, fullSync: true },
      Visit: { priority: 2, fullSync: true },
      OphthalmologyExam: { priority: 3, fullSync: true },
      Prescription: { priority: 4, fullSync: true },
      Invoice: { priority: 5, fullSync: true },
      // Device data syncs metadata only (images stay local)
      DeviceMeasurement: { priority: 6, fullSync: true },
      DeviceImage: { priority: 7, fullSync: false, metadataOnly: true }
    };
  }

  /**
   * Initialize sync service
   */
  async init() {
    console.log('[CloudSync] Initializing...');

    // Check if cloud is configured
    if (!this.cloudUrl) {
      console.log('[CloudSync] No cloud URL configured - running in local-only mode');
      return;
    }

    // Check connectivity
    await this.checkConnectivity();

    // Start periodic sync
    this.startPeriodicSync();

    // Watch for local changes
    this.watchLocalChanges();

    console.log('[CloudSync] Initialized for clinic:', this.clinicId);
  }

  /**
   * Check cloud connectivity
   */
  async checkConnectivity() {
    if (!this.cloudUrl) {
      this.isOnline = false;
      return false;
    }

    try {
      const axios = require('axios');
      const response = await axios.get(`${this.cloudUrl}/health`, { timeout: 5000 });
      this.isOnline = response.status === 200;
      console.log('[CloudSync] Cloud connectivity:', this.isOnline ? 'ONLINE' : 'OFFLINE');
      return this.isOnline;
    } catch (error) {
      this.isOnline = false;
      console.log('[CloudSync] Cloud unreachable:', error.message);
      return false;
    }
  }

  /**
   * Start periodic sync (every 5 minutes when online)
   */
  startPeriodicSync(intervalMs = 5 * 60 * 1000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (await this.checkConnectivity()) {
        await this.syncPendingChanges();
        await this.pullRemoteChanges();
      }
    }, intervalMs);

    console.log('[CloudSync] Periodic sync started (every', intervalMs / 1000, 'seconds)');
  }

  /**
   * Watch for local changes using MongoDB change streams
   */
  watchLocalChanges() {
    const modelsToWatch = ['patients', 'visits', 'ophthalmologyexams', 'prescriptions'];

    for (const collectionName of modelsToWatch) {
      try {
        const collection = mongoose.connection.collection(collectionName);
        const changeStream = collection.watch();

        changeStream.on('change', async (change) => {
          await this.queueChange(collectionName, change);
        });

        console.log('[CloudSync] Watching changes on:', collectionName);
      } catch (error) {
        console.error('[CloudSync] Failed to watch', collectionName, error.message);
      }
    }
  }

  /**
   * Queue a local change for sync
   */
  async queueChange(collection, change) {
    const { operationType, documentKey, fullDocument, updateDescription } = change;

    // Map collection to model name
    const modelMap = {
      patients: 'Patient',
      visits: 'Visit',
      ophthalmologyexams: 'OphthalmologyExam',
      prescriptions: 'Prescription',
      invoices: 'Invoice'
    };

    const modelName = modelMap[collection];
    if (!modelName) return;

    try {
      await SyncQueue.create({
        clinic: this.clinicId,
        modelName,
        documentId: documentKey._id,
        operation: operationType,
        data: operationType === 'delete' ? null : (fullDocument || updateDescription),
        status: 'pending',
        priority: this.syncableModels[modelName]?.priority || 10,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('[CloudSync] Failed to queue change:', error.message);
    }
  }

  /**
   * Sync pending local changes to cloud
   */
  async syncPendingChanges() {
    if (!this.isOnline) return { synced: 0, failed: 0 };

    const pending = await SyncQueue.find({
      status: 'pending',
      clinic: this.clinicId
    })
    .sort({ priority: 1, createdAt: 1 })
    .limit(100);

    if (pending.length === 0) return { synced: 0, failed: 0 };

    console.log('[CloudSync] Syncing', pending.length, 'pending changes...');

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        await this.pushToCloud(item);
        item.status = 'synced';
        item.syncedAt = new Date();
        await item.save();
        synced++;
      } catch (error) {
        item.status = 'failed';
        item.error = error.message;
        item.retryCount = (item.retryCount || 0) + 1;

        // Retry up to 3 times, then mark as failed permanently
        if (item.retryCount < 3) {
          item.status = 'pending';
        }
        await item.save();
        failed++;
      }
    }

    console.log('[CloudSync] Sync complete:', synced, 'synced,', failed, 'failed');
    return { synced, failed };
  }

  /**
   * Push a single item to cloud
   */
  async pushToCloud(syncItem) {
    const axios = require('axios');

    const endpoint = `${this.cloudUrl}/sync/${syncItem.modelName.toLowerCase()}`;

    const payload = {
      clinic: this.clinicId,
      operation: syncItem.operation,
      documentId: syncItem.documentId,
      data: syncItem.data,
      timestamp: syncItem.createdAt
    };

    await axios.post(endpoint, payload, {
      headers: {
        'X-Clinic-ID': this.clinicId,
        'X-Sync-Token': process.env.CLOUD_SYNC_TOKEN
      },
      timeout: 30000
    });
  }

  /**
   * Pull remote changes from cloud
   */
  async pullRemoteChanges() {
    if (!this.isOnline) return;

    try {
      const axios = require('axios');

      const response = await axios.get(`${this.cloudUrl}/sync/changes`, {
        params: {
          clinic: this.clinicId,
          since: this.lastSyncTime?.toISOString()
        },
        headers: {
          'X-Clinic-ID': this.clinicId,
          'X-Sync-Token': process.env.CLOUD_SYNC_TOKEN
        },
        timeout: 60000
      });

      const changes = response.data?.changes || [];
      console.log('[CloudSync] Pulled', changes.length, 'remote changes');

      for (const change of changes) {
        await this.applyRemoteChange(change);
      }

      this.lastSyncTime = new Date();

    } catch (error) {
      console.error('[CloudSync] Failed to pull changes:', error.message);
    }
  }

  /**
   * Apply a remote change to local database
   */
  async applyRemoteChange(change) {
    const { modelName, operation, documentId, data, sourceClinic } = change;

    // Skip changes from our own clinic
    if (sourceClinic === this.clinicId) return;

    const Model = mongoose.model(modelName);

    try {
      switch (operation) {
        case 'insert':
        case 'update':
        case 'replace':
          await Model.findByIdAndUpdate(
            documentId,
            { ...data, _syncedFrom: sourceClinic, _syncedAt: new Date() },
            { upsert: true, new: true }
          );
          break;

        case 'delete':
          // Soft delete - mark as deleted from remote
          await Model.findByIdAndUpdate(documentId, {
            _deletedAt: new Date(),
            _deletedFrom: sourceClinic
          });
          break;
      }
    } catch (error) {
      console.error('[CloudSync] Failed to apply change:', error.message);
    }
  }

  // ===========================================================================
  // CROSS-CLINIC PATIENT LOOKUP
  // ===========================================================================

  /**
   * Search for a patient across all clinics
   */
  async searchPatientAcrossClinics(searchParams) {
    const { name, dob, phone, patientId, legacyId } = searchParams;

    // First search locally
    const localResults = await this.searchLocalPatients(searchParams);

    // If online, also search cloud
    let cloudResults = [];
    if (this.isOnline) {
      cloudResults = await this.searchCloudPatients(searchParams);
    }

    // Merge results, preferring local data
    const merged = this.mergePatientResults(localResults, cloudResults);

    return {
      local: localResults,
      remote: cloudResults,
      merged,
      isOnline: this.isOnline
    };
  }

  /**
   * Search local patients
   */
  async searchLocalPatients(params) {
    const query = { active: true };

    if (params.name) {
      query.$or = [
        { firstName: new RegExp(params.name, 'i') },
        { lastName: new RegExp(params.name, 'i') }
      ];
    }

    if (params.dob) {
      query.dateOfBirth = params.dob;
    }

    if (params.phone) {
      query['contact.phone'] = new RegExp(params.phone);
    }

    if (params.patientId) {
      query.patientId = params.patientId;
    }

    if (params.legacyId) {
      query['legacyIds.dmi'] = params.legacyId;
    }

    return Patient.find(query).limit(50).lean();
  }

  /**
   * Search cloud for patients from other clinics
   */
  async searchCloudPatients(params) {
    if (!this.isOnline) return [];

    try {
      const axios = require('axios');

      const response = await axios.get(`${this.cloudUrl}/patients/search`, {
        params: {
          ...params,
          excludeClinic: this.clinicId
        },
        headers: {
          'X-Clinic-ID': this.clinicId,
          'X-Sync-Token': process.env.CLOUD_SYNC_TOKEN
        },
        timeout: 10000
      });

      return response.data?.patients || [];

    } catch (error) {
      console.error('[CloudSync] Cloud patient search failed:', error.message);
      return [];
    }
  }

  /**
   * Merge local and cloud patient results
   */
  mergePatientResults(local, cloud) {
    const merged = new Map();

    // Add local results first (priority)
    for (const patient of local) {
      merged.set(patient.patientId, { ...patient, source: 'local' });
    }

    // Add cloud results if not already present
    for (const patient of cloud) {
      if (!merged.has(patient.patientId)) {
        merged.set(patient.patientId, { ...patient, source: 'remote' });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Fetch full patient data from another clinic
   */
  async fetchRemotePatient(patientId, sourceClinic) {
    if (!this.isOnline) {
      throw new Error('Cannot fetch remote patient while offline');
    }

    try {
      const axios = require('axios');

      const response = await axios.get(`${this.cloudUrl}/patients/${patientId}/full`, {
        params: { sourceClinic },
        headers: {
          'X-Clinic-ID': this.clinicId,
          'X-Sync-Token': process.env.CLOUD_SYNC_TOKEN
        },
        timeout: 30000
      });

      const patientData = response.data;

      // Cache patient locally
      await Patient.findOneAndUpdate(
        { patientId },
        {
          ...patientData.patient,
          _syncedFrom: sourceClinic,
          _syncedAt: new Date(),
          _localClinic: false
        },
        { upsert: true }
      );

      // Also cache their recent visits/exams
      for (const visit of patientData.visits || []) {
        await Visit.findOneAndUpdate(
          { _id: visit._id },
          { ...visit, _syncedFrom: sourceClinic },
          { upsert: true }
        );
      }

      for (const exam of patientData.exams || []) {
        await OphthalmologyExam.findOneAndUpdate(
          { _id: exam._id },
          { ...exam, _syncedFrom: sourceClinic },
          { upsert: true }
        );
      }

      return patientData;

    } catch (error) {
      throw new Error(`Failed to fetch remote patient: ${error.message}`);
    }
  }

  // ===========================================================================
  // LARGE FILE HANDLING
  // ===========================================================================

  /**
   * Get image from remote clinic on-demand
   */
  async fetchRemoteImage(imageId, sourceClinic) {
    if (!this.isOnline) {
      throw new Error('Cannot fetch image while offline');
    }

    try {
      const axios = require('axios');
      const fs = require('fs').promises;
      const path = require('path');

      const response = await axios.get(
        `${this.cloudUrl}/files/images/${imageId}`,
        {
          params: { sourceClinic },
          headers: {
            'X-Clinic-ID': this.clinicId,
            'X-Sync-Token': process.env.CLOUD_SYNC_TOKEN
          },
          responseType: 'arraybuffer',
          timeout: 120000
        }
      );

      // Cache locally
      const cacheDir = path.join(process.cwd(), 'cache', 'remote_images');
      await fs.mkdir(cacheDir, { recursive: true });

      const cachePath = path.join(cacheDir, `${imageId}.dat`);
      await fs.writeFile(cachePath, response.data);

      return {
        data: response.data,
        cachePath,
        contentType: response.headers['content-type']
      };

    } catch (error) {
      throw new Error(`Failed to fetch remote image: ${error.message}`);
    }
  }

  /**
   * Upload large file to cloud (for backup/cross-clinic access)
   */
  async uploadFileToCloud(filePath, metadata) {
    if (!this.isOnline) {
      // Queue for later
      await SyncQueue.create({
        clinic: this.clinicId,
        modelName: 'File',
        documentId: metadata.fileId,
        operation: 'upload',
        data: { filePath, metadata },
        status: 'pending',
        priority: 10
      });
      return { queued: true };
    }

    try {
      const axios = require('axios');
      const fs = require('fs');
      const FormData = require('form-data');

      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('metadata', JSON.stringify(metadata));

      const response = await axios.post(
        `${this.cloudUrl}/files/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'X-Clinic-ID': this.clinicId,
            'X-Sync-Token': process.env.CLOUD_SYNC_TOKEN
          },
          timeout: 300000 // 5 min for large files
        }
      );

      return response.data;

    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // SYNC STATUS & STATS
  // ===========================================================================

  /**
   * Get sync status and statistics
   */
  async getStatus() {
    const pending = await SyncQueue.countDocuments({
      clinic: this.clinicId,
      status: 'pending'
    });

    const failed = await SyncQueue.countDocuments({
      clinic: this.clinicId,
      status: 'failed'
    });

    const synced = await SyncQueue.countDocuments({
      clinic: this.clinicId,
      status: 'synced',
      syncedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    return {
      isOnline: this.isOnline,
      clinicId: this.clinicId,
      cloudUrl: this.cloudUrl ? 'configured' : 'not configured',
      lastSyncTime: this.lastSyncTime,
      queue: {
        pending,
        failed,
        syncedToday: synced
      }
    };
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    const online = await this.checkConnectivity();

    if (!online) {
      return {
        success: false,
        error: 'Cloud is not reachable'
      };
    }

    const pushResult = await this.syncPendingChanges();
    await this.pullRemoteChanges();

    return {
      success: true,
      ...pushResult,
      lastSyncTime: this.lastSyncTime
    };
  }
}

// Export singleton
module.exports = new CloudSyncService();
