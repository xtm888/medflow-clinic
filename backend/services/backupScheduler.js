const cron = require('node-cron');
const backupService = require('./backupService');
const notificationService = require('./enhancedNotificationService');

/**
 * Backup Scheduler
 *
 * Manages automated backup scheduling using cron jobs
 */

class BackupScheduler {
  constructor() {
    this.jobs = {};
    this.isRunning = false;
  }

  /**
   * Start all backup schedules
   */
  start() {
    if (this.isRunning) {
      console.warn('Backup scheduler is already running');
      return;
    }

    // Daily backup at 2 AM
    this.jobs.daily = cron.schedule('0 2 * * *', async () => {
      await this.runBackup('daily');
    });

    // Monthly backup on 1st of month at 3 AM
    this.jobs.monthly = cron.schedule('0 3 1 * *', async () => {
      await this.runBackup('monthly');
    });

    // Yearly backup on January 1st at 4 AM
    this.jobs.yearly = cron.schedule('0 4 1 1 *', async () => {
      await this.runBackup('yearly');
    });

    this.isRunning = true;
    console.log('✅ Backup scheduler started');
    console.log('  - Daily backups: 2:00 AM every day');
    console.log('  - Monthly backups: 3:00 AM on 1st of each month');
    console.log('  - Yearly backups: 4:00 AM on January 1st');
  }

  /**
   * Run a backup and handle notifications
   */
  async runBackup(type) {
    const startTime = Date.now();

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Starting ${type.toUpperCase()} backup - ${new Date().toISOString()}`);
      console.log('='.repeat(60));

      const result = await backupService.createBackup(type);

      const duration = Date.now() - startTime;
      console.log(`\n✅ ${type.toUpperCase()} backup completed successfully`);
      console.log(`Duration: ${duration}ms`);
      console.log(`Size: ${result.sizeMB} MB`);
      console.log(`Path: ${result.path}`);
      console.log('='.repeat(60) + '\n');

      // Send success notification
      await this.sendSuccessNotification(type, result, duration);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ ${type.toUpperCase()} backup FAILED`);
      console.error(`Error: ${error.message}`);
      console.error(`Duration: ${duration}ms`);
      console.error('='.repeat(60) + '\n');

      // Send failure notification
      await this.sendFailureNotification(type, error, duration);

      throw error;
    }
  }

  /**
   * Send success notification
   */
  async sendSuccessNotification(type, result, duration) {
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      return;
    }

    try {
      await notificationService.sendEmailNotification(
        adminEmail,
        `✅ Backup Success: ${type.toUpperCase()}`,
        'backup-success',
        {
          type: type.toUpperCase(),
          backupName: result.backupName,
          size: result.sizeMB,
          duration: `${(duration / 1000).toFixed(2)}s`,
          encrypted: result.encrypted,
          timestamp: result.timestamp.toISOString(),
          path: result.path
        }
      );
    } catch (error) {
      console.error('Failed to send success notification:', error.message);
    }
  }

  /**
   * Send failure notification
   */
  async sendFailureNotification(type, error, duration) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPhone = process.env.ADMIN_PHONE;

    if (!adminEmail && !adminPhone) {
      return;
    }

    // Email notification
    if (adminEmail) {
      try {
        await notificationService.sendEmailNotification(
          adminEmail,
          `❌ URGENT: Backup Failed - ${type.toUpperCase()}`,
          'backup-failure',
          {
            type: type.toUpperCase(),
            error: error.message,
            stack: error.stack,
            duration: `${(duration / 1000).toFixed(2)}s`,
            timestamp: new Date().toISOString(),
            action: 'Please investigate immediately'
          }
        );
      } catch (emailError) {
        console.error('Failed to send failure email:', emailError.message);
      }
    }

    // SMS notification for critical failures
    if (adminPhone) {
      try {
        await notificationService.sendSMS(
          adminPhone,
          `URGENT: MedFlow ${type} backup failed at ${new Date().toLocaleString()}. Error: ${error.message.substring(0, 100)}`
        );
      } catch (smsError) {
        console.error('Failed to send failure SMS:', smsError.message);
      }
    }
  }

  /**
   * Run manual backup (triggered via API)
   */
  async runManualBackup(type = 'manual') {
    return await this.runBackup(type);
  }

  /**
   * Stop all backup schedules
   */
  stop() {
    if (!this.isRunning) {
      console.warn('Backup scheduler is not running');
      return;
    }

    Object.values(this.jobs).forEach(job => {
      if (job) {
        job.stop();
      }
    });

    this.jobs = {};
    this.isRunning = false;
    console.log('Backup scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedules: {
        daily: this.jobs.daily ? 'active' : 'inactive',
        monthly: this.jobs.monthly ? 'active' : 'inactive',
        yearly: this.jobs.yearly ? 'active' : 'inactive'
      },
      nextRuns: {
        daily: '2:00 AM daily',
        monthly: '3:00 AM on 1st of month',
        yearly: '4:00 AM on January 1st'
      }
    };
  }

  /**
   * Test backup scheduler
   */
  async test() {
    console.log('Testing backup scheduler...');

    try {
      // Run a test backup
      const result = await this.runBackup('test');

      return {
        success: true,
        message: 'Backup scheduler test passed',
        result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Backup scheduler test failed',
        error: error.message
      };
    }
  }
}

// Create singleton instance
const backupScheduler = new BackupScheduler();

module.exports = backupScheduler;
