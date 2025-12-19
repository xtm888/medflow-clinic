const cron = require('node-cron');
const { PharmacyInventory } = require('../models/Inventory');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ReservationCleanupScheduler');

/**
 * Reservation Cleanup Scheduler Service
 * CRITICAL: Automatically releases expired inventory reservations to prevent stock lockup
 *
 * Background:
 * - Reservations have a 24-hour expiration by default
 * - Expired reservations lock stock that could be dispensed to other patients
 * - This service runs periodically to clean up expired reservations
 */

class ReservationCleanupScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start the reservation cleanup scheduler
   */
  start() {
    if (this.isRunning) {
      log.info('⚠️  Reservation cleanup scheduler is already running');
      return;
    }

    log.info('🧹 Starting reservation cleanup scheduler...');

    // Job 1: Clean up expired reservations (every hour)
    const cleanupJob = cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredReservations();
    });

    // Job 2: Clean up old queue number counters (daily at 3 AM)
    const counterCleanupJob = cron.schedule('0 3 * * *', async () => {
      await this.cleanupOldCounters();
    });

    this.jobs = [cleanupJob, counterCleanupJob];
    this.isRunning = true;

    log.info('✅ Reservation cleanup scheduler started successfully');
    log.info('   - Expired reservations cleanup: Every hour');
    log.info('   - Old counter cleanup: Daily at 3 AM');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      log.info('⚠️  Reservation cleanup scheduler is not running');
      return;
    }

    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;

    log.info('🛑 Reservation cleanup scheduler stopped');
  }

  /**
   * Clean up expired inventory reservations
   * CRITICAL: Releases reserved stock that has expired
   */
  async cleanupExpiredReservations() {
    try {
      log.info('🔍 Checking for expired reservations...');

      const now = new Date();
      let totalReleased = 0;
      let totalReservations = 0;
      const errors = [];

      // Find all inventory items with active reservations
      const inventoryItems = await PharmacyInventory.find({
        'reservations.status': 'active',
        active: true
      });

      for (const item of inventoryItems) {
        let itemUpdated = false;

        for (const reservation of item.reservations) {
          // Check if reservation is active and expired
          if (reservation.status === 'active' && reservation.expiresAt && new Date(reservation.expiresAt) < now) {
            totalReservations++;

            try {
              // Release stock from batches
              for (const reservedBatch of reservation.batches) {
                const batch = item.batches.find(b => b.lotNumber === reservedBatch.lotNumber);
                if (batch) {
                  batch.reserved = Math.max(0, (batch.reserved || 0) - reservedBatch.quantity);
                }
              }

              // Update total reserved
              item.inventory.reserved = Math.max(0, (item.inventory.reserved || 0) - reservation.quantity);

              // Mark reservation as expired
              reservation.status = 'expired';
              itemUpdated = true;
              totalReleased += reservation.quantity;

              log.info(`   ✓ Released ${reservation.quantity} units of ${item.medication.genericName} (Reservation: ${reservation.reservationId})`);

            } catch (error) {
              errors.push({
                medication: item.medication.genericName,
                reservationId: reservation.reservationId,
                error: error.message
              });
              log.error(`   ✗ Error releasing reservation ${reservation.reservationId}:`, error.message);
            }
          }
        }

        // Save the inventory item if any reservations were updated
        if (itemUpdated) {
          try {
            await item.save();
          } catch (error) {
            errors.push({
              medication: item.medication.genericName,
              error: `Failed to save: ${error.message}`
            });
            log.error(`   ✗ Error saving ${item.medication.genericName}:`, error.message);
          }
        }
      }

      // Summary
      log.info('📊 Expired reservation cleanup summary:');
      log.info(`   - Total expired reservations processed: ${totalReservations}`);
      log.info(`   - Total units released: ${totalReleased}`);
      log.info(`   - Errors encountered: ${errors.length}`);

      if (errors.length > 0) {
        log.info('⚠️  Errors during cleanup:');
        errors.forEach(err => {
          log.info(`   - ${err.medication || 'Unknown'}: ${err.error}`);
        });
      }

      return {
        success: true,
        totalReservations,
        totalReleased,
        errors
      };

    } catch (error) {
      log.error('❌ Fatal error in expired reservation cleanup:', { error: error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up old queue number counters (90 days retention)
   * Prevents counter collection from growing indefinitely
   */
  async cleanupOldCounters() {
    try {
      log.info('🔍 Cleaning up old queue number counters...');

      const Counter = require('../models/Counter');
      const deletedCount = await Counter.cleanupOldCounters(90);

      log.info(`✅ Deleted ${deletedCount} old queue number counters`);

      return {
        success: true,
        deletedCount
      };

    } catch (error) {
      log.error('❌ Error cleaning up old counters:', { error: error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual trigger for cleanup (for testing or manual intervention)
   */
  async manualCleanup() {
    log.info('🔧 Manual cleanup triggered');
    const result = await this.cleanupExpiredReservations();
    return result;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length
    };
  }
}

// Export singleton instance
const reservationCleanupScheduler = new ReservationCleanupScheduler();

module.exports = reservationCleanupScheduler;
