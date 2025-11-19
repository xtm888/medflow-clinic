const cron = require('node-cron');
const PharmacyInventory = require('../models/PharmacyInventory');

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
      console.log('⚠️  Reservation cleanup scheduler is already running');
      return;
    }

    console.log('🧹 Starting reservation cleanup scheduler...');

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

    console.log('✅ Reservation cleanup scheduler started successfully');
    console.log('   - Expired reservations cleanup: Every hour');
    console.log('   - Old counter cleanup: Daily at 3 AM');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Reservation cleanup scheduler is not running');
      return;
    }

    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;

    console.log('🛑 Reservation cleanup scheduler stopped');
  }

  /**
   * Clean up expired inventory reservations
   * CRITICAL: Releases reserved stock that has expired
   */
  async cleanupExpiredReservations() {
    try {
      console.log('🔍 Checking for expired reservations...');

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

              console.log(`   ✓ Released ${reservation.quantity} units of ${item.medication.genericName} (Reservation: ${reservation.reservationId})`);

            } catch (error) {
              errors.push({
                medication: item.medication.genericName,
                reservationId: reservation.reservationId,
                error: error.message
              });
              console.error(`   ✗ Error releasing reservation ${reservation.reservationId}:`, error.message);
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
            console.error(`   ✗ Error saving ${item.medication.genericName}:`, error.message);
          }
        }
      }

      // Summary
      console.log('📊 Expired reservation cleanup summary:');
      console.log(`   - Total expired reservations processed: ${totalReservations}`);
      console.log(`   - Total units released: ${totalReleased}`);
      console.log(`   - Errors encountered: ${errors.length}`);

      if (errors.length > 0) {
        console.log('⚠️  Errors during cleanup:');
        errors.forEach(err => {
          console.log(`   - ${err.medication || 'Unknown'}: ${err.error}`);
        });
      }

      return {
        success: true,
        totalReservations,
        totalReleased,
        errors
      };

    } catch (error) {
      console.error('❌ Fatal error in expired reservation cleanup:', error);
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
      console.log('🔍 Cleaning up old queue number counters...');

      const Counter = require('../models/Counter');
      const deletedCount = await Counter.cleanupOldCounters(90);

      console.log(`✅ Deleted ${deletedCount} old queue number counters`);

      return {
        success: true,
        deletedCount
      };

    } catch (error) {
      console.error('❌ Error cleaning up old counters:', error);
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
    console.log('🔧 Manual cleanup triggered');
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
