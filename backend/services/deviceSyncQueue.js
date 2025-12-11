/**
 * Device Sync Queue Service
 *
 * Redis-based job queue for background device synchronization tasks:
 * - File processing jobs
 * - Patient matching jobs
 * - Folder indexing jobs
 * - Unmatched folder resolution
 */

const EventEmitter = require('events');
const { getClient, isRedisConnected, initializeRedis, cache } = require('../config/redis');

class DeviceSyncQueue extends EventEmitter {
  constructor() {
    super();
    this.queuePrefix = 'device_sync:';
    this.jobPrefix = 'job:';
    this.isProcessing = false;
    this.concurrency = 3;  // Process 3 jobs concurrently
    this.activeJobs = new Map();
    this.handlers = new Map();  // Job type handlers
    this.stats = {
      processed: 0,
      failed: 0,
      pending: 0,
      startedAt: null
    };
    this.pollInterval = null;
  }

  /**
   * Initialize the queue service
   */
  async init() {
    await initializeRedis();
    this.stats.startedAt = new Date();

    // Register default handlers
    this.registerHandler('file_process', this.handleFileProcess.bind(this));
    this.registerHandler('patient_match', this.handlePatientMatch.bind(this));
    this.registerHandler('folder_index', this.handleFolderIndex.bind(this));
    this.registerHandler('batch_import', this.handleBatchImport.bind(this));

    console.log('Device Sync Queue initialized');
    return this;
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType, handler) {
    this.handlers.set(jobType, handler);
  }

  /**
   * Add a job to the queue
   */
  async addJob(jobType, data, options = {}) {
    const {
      priority = 5,  // 1-10, lower is higher priority
      delay = 0,     // Delay in milliseconds
      retries = 3,
      timeout = 60000
    } = options;

    const jobId = `${jobType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job = {
      id: jobId,
      type: jobType,
      data,
      status: delay > 0 ? 'delayed' : 'pending',
      priority,
      retries,
      retriesLeft: retries,
      timeout,
      createdAt: new Date().toISOString(),
      scheduledFor: delay > 0 ? new Date(Date.now() + delay).toISOString() : null,
      attempts: []
    };

    if (!isRedisConnected()) {
      // Fallback: process immediately if Redis not available
      console.warn('Redis not available, processing job immediately');
      return this.processJobImmediately(job);
    }

    const client = getClient();
    const queueKey = `${this.queuePrefix}queue:${priority}`;

    try {
      // Store job data
      await client.set(
        `${this.queuePrefix}${this.jobPrefix}${jobId}`,
        JSON.stringify(job),
        { EX: 86400 }  // 24 hour expiry
      );

      // Add to priority queue
      if (delay > 0) {
        // Add to delayed queue (sorted set by execution time)
        await client.zAdd(`${this.queuePrefix}delayed`, {
          score: Date.now() + delay,
          value: jobId
        });
      } else {
        // Add to immediate queue
        await client.lPush(queueKey, jobId);
      }

      this.emit('jobAdded', { jobId, jobType, priority });
      return { jobId, status: job.status };
    } catch (error) {
      console.error('Failed to add job to queue:', error);
      // Fallback: process immediately
      return this.processJobImmediately(job);
    }
  }

  /**
   * Process a job immediately (fallback when Redis unavailable)
   */
  async processJobImmediately(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      return { jobId: job.id, status: 'failed', error: 'No handler registered' };
    }

    try {
      const result = await handler(job.data);
      this.stats.processed++;
      return { jobId: job.id, status: 'completed', result };
    } catch (error) {
      this.stats.failed++;
      return { jobId: job.id, status: 'failed', error: error.message };
    }
  }

  /**
   * Start processing jobs from the queue
   */
  async startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log('Starting queue processing...');

    // Process delayed jobs
    this.pollInterval = setInterval(() => this.processDelayedJobs(), 5000);

    // Main processing loop
    this.processLoop();
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    while (this.isProcessing) {
      // Check if we can accept more jobs
      if (this.activeJobs.size >= this.concurrency) {
        await this.sleep(100);
        continue;
      }

      try {
        const job = await this.getNextJob();
        if (job) {
          this.processJob(job).catch(err => {
            console.error(`Job ${job.id} failed:`, err);
          });
        } else {
          // No jobs available, wait a bit
          await this.sleep(1000);
        }
      } catch (error) {
        console.error('Error in process loop:', error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * Get next job from priority queues
   */
  async getNextJob() {
    if (!isRedisConnected()) return null;

    const client = getClient();

    // Check priority queues from 1-10
    for (let priority = 1; priority <= 10; priority++) {
      const queueKey = `${this.queuePrefix}queue:${priority}`;

      try {
        const jobId = await client.rPop(queueKey);
        if (jobId) {
          const jobData = await client.get(`${this.queuePrefix}${this.jobPrefix}${jobId}`);
          if (jobData) {
            return JSON.parse(jobData);
          }
        }
      } catch (error) {
        // Continue to next priority level
      }
    }

    return null;
  }

  /**
   * Process delayed jobs that are ready
   */
  async processDelayedJobs() {
    if (!isRedisConnected()) return;

    const client = getClient();
    const now = Date.now();

    try {
      // Get jobs that are ready to execute
      const readyJobs = await client.zRangeByScore(
        `${this.queuePrefix}delayed`,
        0,
        now
      );

      for (const jobId of readyJobs) {
        // Move from delayed to active queue
        await client.zRem(`${this.queuePrefix}delayed`, jobId);

        const jobData = await client.get(`${this.queuePrefix}${this.jobPrefix}${jobId}`);
        if (jobData) {
          const job = JSON.parse(jobData);
          job.status = 'pending';

          // Add to priority queue
          await client.lPush(`${this.queuePrefix}queue:${job.priority}`, jobId);
          await client.set(
            `${this.queuePrefix}${this.jobPrefix}${jobId}`,
            JSON.stringify(job),
            { EX: 86400 }
          );
        }
      }
    } catch (error) {
      console.error('Error processing delayed jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      console.error(`No handler for job type: ${job.type}`);
      await this.failJob(job, 'No handler registered');
      return;
    }

    this.activeJobs.set(job.id, job);
    job.status = 'processing';
    job.attempts.push({
      startedAt: new Date().toISOString(),
      attempt: job.retries - job.retriesLeft + 1
    });

    this.emit('jobStarted', { jobId: job.id, type: job.type });

    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), job.timeout);
      });

      // Execute handler
      const result = await Promise.race([
        handler(job.data),
        timeoutPromise
      ]);

      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = result;

      this.stats.processed++;
      this.activeJobs.delete(job.id);
      this.emit('jobCompleted', { jobId: job.id, result });

      // Update in Redis
      await this.updateJob(job);

    } catch (error) {
      job.attempts[job.attempts.length - 1].error = error.message;
      job.retriesLeft--;

      if (job.retriesLeft > 0) {
        // Retry the job
        job.status = 'pending';
        await this.retryJob(job);
        this.emit('jobRetry', { jobId: job.id, retriesLeft: job.retriesLeft });
      } else {
        // Job failed permanently
        await this.failJob(job, error.message);
      }

      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(job) {
    if (!isRedisConnected()) return;

    const client = getClient();
    const delay = Math.pow(2, job.retries - job.retriesLeft) * 1000;  // Exponential backoff

    await client.zAdd(`${this.queuePrefix}delayed`, {
      score: Date.now() + delay,
      value: job.id
    });

    await this.updateJob(job);
  }

  /**
   * Mark a job as failed
   */
  async failJob(job, error) {
    job.status = 'failed';
    job.failedAt = new Date().toISOString();
    job.error = error;

    this.stats.failed++;
    this.emit('jobFailed', { jobId: job.id, error });

    await this.updateJob(job);

    // Add to failed jobs list for review
    if (isRedisConnected()) {
      const client = getClient();
      await client.lPush(`${this.queuePrefix}failed`, job.id);
      await client.lTrim(`${this.queuePrefix}failed`, 0, 999);  // Keep last 1000 failed jobs
    }
  }

  /**
   * Update job in Redis
   */
  async updateJob(job) {
    if (!isRedisConnected()) return;

    const client = getClient();
    await client.set(
      `${this.queuePrefix}${this.jobPrefix}${job.id}`,
      JSON.stringify(job),
      { EX: 86400 }
    );
  }

  /**
   * Get job by ID
   */
  async getJob(jobId) {
    if (!isRedisConnected()) return null;

    const client = getClient();
    const data = await client.get(`${this.queuePrefix}${this.jobPrefix}${jobId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Stop processing
   */
  stopProcessing() {
    this.isProcessing = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('Queue processing stopped');
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const stats = { ...this.stats };
    stats.activeJobs = this.activeJobs.size;

    if (isRedisConnected()) {
      const client = getClient();

      // Count pending jobs across all priority queues
      let pending = 0;
      for (let p = 1; p <= 10; p++) {
        const len = await client.lLen(`${this.queuePrefix}queue:${p}`);
        pending += len;
      }
      stats.pending = pending;

      // Count delayed jobs
      stats.delayed = await client.zCard(`${this.queuePrefix}delayed`);

      // Count failed jobs
      stats.failedInQueue = await client.lLen(`${this.queuePrefix}failed`);
    }

    return stats;
  }

  /**
   * Clear failed jobs
   */
  async clearFailedJobs() {
    if (!isRedisConnected()) return { cleared: 0 };

    const client = getClient();
    const count = await client.lLen(`${this.queuePrefix}failed`);
    await client.del(`${this.queuePrefix}failed`);
    return { cleared: count };
  }

  /**
   * Retry all failed jobs
   */
  async retryAllFailed() {
    if (!isRedisConnected()) return { retried: 0 };

    const client = getClient();
    const failedJobIds = await client.lRange(`${this.queuePrefix}failed`, 0, -1);

    let retried = 0;
    for (const jobId of failedJobIds) {
      const job = await this.getJob(jobId);
      if (job) {
        job.retriesLeft = job.retries;
        job.status = 'pending';
        await client.lPush(`${this.queuePrefix}queue:${job.priority}`, jobId);
        await this.updateJob(job);
        retried++;
      }
    }

    await client.del(`${this.queuePrefix}failed`);
    return { retried };
  }

  // =====================================================
  // DEFAULT JOB HANDLERS
  // =====================================================

  /**
   * Handle file processing job
   */
  async handleFileProcess(data) {
    const { deviceId, filePath, patientId } = data;

    // Lazy load dependencies to avoid circular imports
    const Device = require('../models/Device');
    const smb2Client = require('./smb2ClientService');

    const device = await Device.findById(deviceId);
    if (!device) throw new Error('Device not found');

    // Read the file
    const fileResult = await smb2Client.readFile(device, filePath);

    // Process based on file type
    const AdapterFactory = require('./adapters/AdapterFactory');
    const adapter = AdapterFactory.getAdapter(device.type);

    if (adapter) {
      const measurements = await adapter.parseFile(fileResult.localPath, {
        deviceId,
        patientId,
        source: filePath
      });

      this.emit('fileProcessed', {
        deviceId,
        filePath,
        measurements: measurements.length
      });

      return { processed: true, measurements: measurements.length };
    }

    return { processed: false, reason: 'No adapter for device type' };
  }

  /**
   * Handle patient matching job
   */
  async handlePatientMatch(data) {
    const { folderName, deviceType, suggestions } = data;

    // Lazy load
    const Patient = require('../models/Patient');
    const PatientFolderIndexer = require('./patientFolderIndexer');

    // Try to find a match
    const indexer = new PatientFolderIndexer();
    const match = await indexer.findPatientMatch(folderName, suggestions);

    if (match) {
      this.emit('patientMatched', {
        folderName,
        patientId: match.patientId,
        confidence: match.confidence
      });

      return { matched: true, patientId: match.patientId };
    }

    // Add to unmatched queue for manual review
    await cache.set(`unmatched:${folderName}`, {
      folderName,
      deviceType,
      suggestions,
      addedAt: new Date().toISOString()
    }, 604800);  // 7 days

    return { matched: false, addedToReview: true };
  }

  /**
   * Handle folder indexing job
   */
  async handleFolderIndex(data) {
    const { deviceId, basePath } = data;

    const Device = require('../models/Device');
    const smb2Client = require('./smb2ClientService');
    const PatientFolderIndexer = require('./patientFolderIndexer');

    const device = await Device.findById(deviceId);
    if (!device) throw new Error('Device not found');

    // Scan the folder
    const result = await smb2Client.scanDirectoryRecursive(device, basePath, {
      maxDepth: 5,
      maxFiles: 2000
    });

    // Index the folders
    const indexer = new PatientFolderIndexer();
    const indexed = await indexer.indexFolders(result.directories, device);

    this.emit('foldersIndexed', {
      deviceId,
      indexed: indexed.length,
      unmatched: indexed.filter(i => !i.matched).length
    });

    return {
      indexed: indexed.length,
      matched: indexed.filter(i => i.matched).length,
      unmatched: indexed.filter(i => !i.matched).length
    };
  }

  /**
   * Handle batch import job
   */
  async handleBatchImport(data) {
    const { deviceId, files, patientId } = data;

    const results = [];

    for (const file of files) {
      try {
        const result = await this.handleFileProcess({
          deviceId,
          filePath: file,
          patientId
        });
        results.push({ file, success: true, result });
      } catch (error) {
        results.push({ file, success: false, error: error.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    this.emit('batchImportComplete', { deviceId, total: files.length, successful });

    return {
      total: files.length,
      successful,
      failed: files.length - successful,
      results
    };
  }

  // Utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
const instance = new DeviceSyncQueue();
module.exports = instance;
