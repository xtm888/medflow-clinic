const CalendarIntegration = require('../models/CalendarIntegration');
const calendarService = require('./calendarIntegrationService');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('CalendarSyncScheduler');

/**
 * Calendar Sync Scheduler
 * Automatically syncs appointments to external calendars at configured intervals
 */
class CalendarSyncScheduler {
  constructor() {
    this.intervalId = null;
    this.running = false;
    this.lastRun = null;
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.intervalId) {
      log.info('⚠️ Calendar sync scheduler already running');
      return;
    }

    log.info('📅 Starting calendar sync scheduler...');

    // Run immediately on start
    this.runSync();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runSync();
    }, this.checkInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('📅 Calendar sync scheduler stopped');
    }
  }

  /**
   * Run sync for all eligible integrations
   */
  async runSync() {
    if (this.running) {
      log.info('⏳ Calendar sync already in progress, skipping...');
      return;
    }

    this.running = true;
    this.lastRun = new Date();

    try {
      // Get integrations that need syncing
      const integrations = await this.getIntegrationsToSync();

      if (integrations.length === 0) {
        return;
      }

      log.info(`📅 Syncing ${integrations.length} calendar integration(s)...`);

      for (const integration of integrations) {
        try {
          await this.syncIntegration(integration);
        } catch (error) {
          log.error(`Calendar sync error for ${integration.provider}:`, error.message);
          integration.updateSyncState('failed', error.message);
          await integration.save();
        }
      }
    } catch (error) {
      log.error('Calendar sync scheduler error:', { error: error });
    } finally {
      this.running = false;
    }
  }

  /**
   * Get integrations that are due for sync
   */
  async getIntegrationsToSync() {
    const now = new Date();

    const integrations = await CalendarIntegration.find({
      status: 'active',
      'syncSettings.enabled': true
    }).populate('user', 'firstName lastName email');

    // Filter to those that need syncing based on their interval
    return integrations.filter(integration => {
      if (!integration.syncState.lastSyncAt) return true;

      const intervalMs = (integration.syncSettings.syncInterval || 15) * 60 * 1000;
      const nextSyncTime = new Date(integration.syncState.lastSyncAt.getTime() + intervalMs);

      return now >= nextSyncTime;
    });
  }

  /**
   * Sync a single integration
   */
  async syncIntegration(integration) {
    const userId = integration.user._id || integration.user;
    const provider = integration.provider;

    log.info(`📅 Syncing ${provider} calendar for user ${userId}...`);

    try {
      const results = await calendarService.fullSync(userId);

      const providerResult = results.find(r => r.provider === provider);

      if (providerResult?.success) {
        console.log(
          `✅ ${provider} sync complete: ${providerResult.stats?.created || 0} created, ` +
          `${providerResult.stats?.updated || 0} updated`
        );
      } else {
        log.warn(`⚠️ ${provider} sync partial/failed:`, providerResult?.error);
      }

      return providerResult;
    } catch (error) {
      log.error(`❌ ${provider} sync error:`, error.message);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: !!this.intervalId,
      syncing: this.running,
      lastRun: this.lastRun,
      checkInterval: this.checkInterval
    };
  }

  /**
   * Force immediate sync for all integrations
   */
  async forceSync() {
    this.running = false; // Reset running state
    await this.runSync();
  }
}

// Export singleton instance
module.exports = new CalendarSyncScheduler();
