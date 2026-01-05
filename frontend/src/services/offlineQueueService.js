/**
 * Offline-Enabled Queue Service
 * Critical for medical operations - queue must work even without internet
 */

import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import databaseService, { db } from './database';

const offlineQueueService = {
  /**
   * Get today's queue with offline fallback
   * This is the most critical offline function
   */
  async getQueue(params = {}) {
    const today = new Date().toISOString().split('T')[0];

    return offlineWrapper.get(
      () => api.get('/queue', { params }),
      'queue',
      { date: today, ...params },
      {
        transform: (response) => response.data?.data || response.data || [],
        cacheExpiry: 60, // Shorter cache for queue (1 minute)
      }
    );
  },

  /**
   * Get active queue (waiting + in-progress)
   */
  async getActiveQueue() {
    if (!navigator.onLine) {
      // Get from local cache
      const queue = await db.queue
        .where('status')
        .anyOf(['waiting', 'in-progress', 'called'])
        .toArray();

      return {
        success: true,
        data: queue.sort((a, b) => a.queueNumber - b.queueNumber),
        _fromCache: true
      };
    }

    return offlineWrapper.get(
      () => api.get('/queue/active'),
      'queue',
      'active',
      {
        transform: (response) => response.data?.data || response.data || [],
      }
    );
  },

  /**
   * Add patient to queue - MUST work offline
   */
  async addToQueue(data) {
    // Generate local queue number if offline
    const localData = {
      ...data,
      queueNumber: data.queueNumber || await this.getNextQueueNumber(),
      status: 'waiting',
      checkInTime: new Date().toISOString(),
    };

    return offlineWrapper.mutate(
      () => api.post('/queue', data),
      'CREATE',
      'queue',
      localData
    );
  },

  /**
   * Update queue status - MUST work offline
   */
  async updateStatus(id, status, additionalData = {}) {
    const updateData = {
      status,
      ...additionalData,
      updatedAt: new Date().toISOString(),
    };

    // Add timestamps based on status
    if (status === 'called') {
      updateData.calledAt = new Date().toISOString();
    } else if (status === 'in-progress') {
      updateData.startedAt = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    return offlineWrapper.mutate(
      () => api.put(`/queue/${id}/status`, updateData),
      'UPDATE',
      'queue',
      updateData,
      id
    );
  },

  /**
   * Call next patient in queue
   */
  async callNext(providerId, room) {
    // Helper function for offline logic (avoid recursion)
    const handleOffline = async () => {
      const queue = await db.queue
        .where('status')
        .equals('waiting')
        .sortBy('queueNumber');

      if (queue.length === 0) {
        return {
          success: false,
          message: 'No patients waiting',
          _offline: true
        };
      }

      const nextPatient = queue[0];
      return this.updateStatus(nextPatient.id, 'called', { providerId, room });
    };

    // If offline, use local queue directly
    if (!navigator.onLine) {
      return handleOffline();
    }

    try {
      const response = await api.post('/queue/next', { providerId, room });

      // Update local cache
      if (response.data?.data) {
        await offlineWrapper.cacheData('queue', response.data.data, response.data.data._id);
      }

      return response.data;
    } catch (error) {
      // CRITICAL FIX: Call handleOffline() directly instead of recursing
      // Previous code caused infinite recursion when offline
      console.warn('[OfflineQueueService] callNext failed, using offline mode');
      return handleOffline();
    }
  },

  /**
   * Start consultation (mark as in-progress)
   */
  async startConsultation(queueId, providerId) {
    return this.updateStatus(queueId, 'in-progress', { providerId });
  },

  /**
   * Complete consultation
   */
  async completeConsultation(queueId, notes = '') {
    return this.updateStatus(queueId, 'completed', { notes });
  },

  /**
   * Skip patient (move to end of queue or mark as no-show)
   */
  async skipPatient(queueId, reason = 'no-show') {
    return this.updateStatus(queueId, reason === 'no-show' ? 'no-show' : 'skipped', { skipReason: reason });
  },

  /**
   * Get next queue number (for offline creation)
   */
  async getNextQueueNumber() {
    const today = new Date().toISOString().split('T')[0];

    // Get max queue number from local cache
    const todaysQueue = await db.queue
      .where('checkInTime')
      .startsWith(today)
      .toArray();

    if (todaysQueue.length === 0) {
      return 1;
    }

    const maxNumber = Math.max(...todaysQueue.map(q => q.queueNumber || 0));
    return maxNumber + 1;
  },

  /**
   * Get queue statistics for today
   */
  async getQueueStats() {
    if (!navigator.onLine) {
      const today = new Date().toISOString().split('T')[0];
      const queue = await db.queue
        .where('checkInTime')
        .startsWith(today)
        .toArray();

      const stats = {
        total: queue.length,
        waiting: queue.filter(q => q.status === 'waiting').length,
        inProgress: queue.filter(q => q.status === 'in-progress').length,
        completed: queue.filter(q => q.status === 'completed').length,
        noShow: queue.filter(q => q.status === 'no-show').length,
        _fromCache: true
      };

      return { success: true, data: stats };
    }

    return offlineWrapper.get(
      () => api.get('/queue/stats'),
      'queue',
      'stats',
      {
        transform: (response) => response.data?.data || response.data,
      }
    );
  },

  /**
   * Get queue by provider
   */
  async getProviderQueue(providerId) {
    if (!navigator.onLine) {
      const queue = await db.queue
        .where('providerId')
        .equals(providerId)
        .toArray();

      return {
        success: true,
        data: queue.filter(q => ['waiting', 'called', 'in-progress'].includes(q.status)),
        _fromCache: true
      };
    }

    return offlineWrapper.get(
      () => api.get(`/queue/provider/${providerId}`),
      'queue',
      { providerId },
      {
        transform: (response) => response.data?.data || response.data || [],
      }
    );
  },

  /**
   * Pre-cache today's queue for offline use
   * Should be called on app startup
   */
  async preCacheTodaysQueue() {
    if (!navigator.onLine) {
      console.warn('[OfflineQueueService] Cannot pre-cache while offline');
      return { success: false, message: 'Offline' };
    }

    try {
      console.log('[OfflineQueueService] Pre-caching today\'s queue...');

      const response = await api.get('/queue');
      // Safely extract array from various API response formats
      const rawQueue = response?.data?.data ?? response?.data ?? [];
      const queue = Array.isArray(rawQueue) ? rawQueue : [];

      if (queue.length > 0) {
        await databaseService.bulkSave('queue', queue);
        console.log(`[OfflineQueueService] Cached ${queue.length} queue items`);
      }

      return { success: true, cached: queue.length };
    } catch (error) {
      console.error('[OfflineQueueService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all locally cached queue items
   */
  async getCachedQueue() {
    return db.queue.toArray();
  },

  /**
   * Clear old queue data (keep only today's)
   */
  async clearOldQueueData() {
    const today = new Date().toISOString().split('T')[0];

    const oldItems = await db.queue
      .filter(item => !item.checkInTime?.startsWith(today))
      .toArray();

    const oldIds = oldItems.map(item => item.id);

    if (oldIds.length > 0) {
      await db.queue.bulkDelete(oldIds);
      console.log(`[OfflineQueueService] Cleared ${oldIds.length} old queue items`);
    }
  },

  /**
   * Get estimated wait time (offline calculation)
   */
  async getEstimatedWaitTime(queueNumber) {
    const queue = await db.queue
      .where('status')
      .equals('waiting')
      .toArray();

    const avgConsultTime = 15; // minutes
    const position = queue.filter(q => q.queueNumber < queueNumber).length;

    return {
      position: position + 1,
      estimatedMinutes: position * avgConsultTime,
      _calculated: true
    };
  },
};

export default offlineQueueService;
