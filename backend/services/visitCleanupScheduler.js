const cron = require('node-cron');
const Visit = require('../models/Visit');
const Appointment = require('../models/Appointment');
const Alert = require('../models/Alert');
const websocketService = require('./websocketService');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('VisitCleanupScheduler');

/**
 * Visit Cleanup Scheduler Service
 * CRITICAL: Automatically detects and handles stuck visits
 *
 * Background:
 * - Visits can become stuck in 'in-progress' if patient leaves without checkout
 * - Visits can be stuck in 'checked-in' if patient never seen
 * - This service detects these issues and takes appropriate action
 */

class VisitCleanupScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;

    // Configurable thresholds (in hours)
    this.thresholds = {
      inProgressMaxHours: 8,    // Visit in-progress > 8 hours = stuck
      checkedInMaxHours: 4,     // Checked-in but not seen > 4 hours = stuck
      signedNotCompletedHours: 1 // Signed but not completed > 1 hour = auto-fix
    };
  }

  /**
   * Start the visit cleanup scheduler
   */
  start() {
    if (this.isRunning) {
      log.info('  Visit cleanup scheduler is already running');
      return;
    }

    log.info('Starting visit cleanup scheduler...');

    // Job 1: Detect stuck visits (every 30 minutes)
    const detectionJob = cron.schedule('*/30 * * * *', async () => {
      await this.detectStuckVisits();
    });

    // Job 2: Auto-fix signed but not completed visits (every 15 minutes)
    const autoFixJob = cron.schedule('*/15 * * * *', async () => {
      await this.autoFixSignedVisits();
    });

    // Job 3: End-of-day cleanup (daily at 11 PM)
    const endOfDayJob = cron.schedule('0 23 * * *', async () => {
      await this.endOfDayCleanup();
    });

    // Job 4: Sync appointment-visit status (every hour)
    const syncJob = cron.schedule('0 * * * *', async () => {
      await this.syncAppointmentVisitStatus();
    });

    this.jobs = [detectionJob, autoFixJob, endOfDayJob, syncJob];
    this.isRunning = true;

    log.info('Visit cleanup scheduler started successfully');
    log.info('   - Stuck visit detection: Every 30 minutes');
    log.info('   - Auto-fix signed visits: Every 15 minutes');
    log.info('   - End-of-day cleanup: Daily at 11 PM');
    log.info('   - Appointment-Visit sync: Every hour');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      log.info('Visit cleanup scheduler is not running');
      return;
    }

    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;

    log.info('Visit cleanup scheduler stopped');
  }

  /**
   * Detect visits that have been stuck for too long
   * Creates alerts for staff to review
   */
  async detectStuckVisits() {
    try {
      const now = new Date();
      const alerts = [];

      // 1. Find visits stuck in 'in-progress' for too long
      const inProgressCutoff = new Date(now.getTime() - this.thresholds.inProgressMaxHours * 60 * 60 * 1000);
      const stuckInProgress = await Visit.find({
        status: 'in-progress',
        startTime: { $lt: inProgressCutoff },
        signatureStatus: { $ne: 'signed' } // Not signed = genuinely stuck
      }).populate('patient', 'firstName lastName patientId')
        .populate('primaryProvider', 'firstName lastName');

      for (const visit of stuckInProgress) {
        const hoursStuck = Math.round((now - visit.startTime) / (1000 * 60 * 60));

        // Check if we already have an active alert for this visit
        const existingAlert = await Alert.findOne({
          'metadata.visitId': visit._id.toString(),
          category: 'workflow',
          status: { $nin: ['dismissed', 'resolved'] }
        });

        if (!existingAlert) {
          const patientName = visit.patient
            ? `${visit.patient.firstName} ${visit.patient.lastName}`
            : 'Patient inconnu';

          alerts.push({
            category: 'workflow',
            priority: hoursStuck > 12 ? 'high' : 'medium',
            title: 'Visite bloquee en cours',
            message: `La visite ${visit.visitId} pour ${patientName} est en cours depuis ${hoursStuck} heures. Verification necessaire.`,
            targetRoles: ['admin', 'nurse', 'reception'],
            metadata: {
              visitId: visit._id.toString(),
              visitNumber: visit.visitId,
              patientId: visit.patient?._id?.toString(),
              hoursStuck,
              type: 'stuck_in_progress'
            },
            requiresAcknowledgment: true
          });
        }
      }

      // 2. Find visits stuck in 'checked-in' for too long
      const checkedInCutoff = new Date(now.getTime() - this.thresholds.checkedInMaxHours * 60 * 60 * 1000);
      const stuckCheckedIn = await Visit.find({
        status: 'checked-in',
        checkInTime: { $lt: checkedInCutoff }
      }).populate('patient', 'firstName lastName patientId');

      for (const visit of stuckCheckedIn) {
        const hoursWaiting = Math.round((now - visit.checkInTime) / (1000 * 60 * 60));

        const existingAlert = await Alert.findOne({
          'metadata.visitId': visit._id.toString(),
          'metadata.type': 'stuck_checked_in',
          status: { $nin: ['dismissed', 'resolved'] }
        });

        if (!existingAlert) {
          const patientName = visit.patient
            ? `${visit.patient.firstName} ${visit.patient.lastName}`
            : 'Patient inconnu';

          alerts.push({
            category: 'workflow',
            priority: 'medium',
            title: 'Patient en attente prolongee',
            message: `${patientName} attend depuis ${hoursWaiting} heures (Visite ${visit.visitId}). Le patient est-il encore present?`,
            targetRoles: ['admin', 'nurse', 'reception'],
            metadata: {
              visitId: visit._id.toString(),
              visitNumber: visit.visitId,
              patientId: visit.patient?._id?.toString(),
              hoursWaiting,
              type: 'stuck_checked_in'
            },
            requiresAcknowledgment: true
          });
        }
      }

      // Create all alerts
      if (alerts.length > 0) {
        await Alert.insertMany(alerts);
        log.info(`[VISIT CLEANUP] Created ${alerts.length} alert(s) for stuck visits`);

        // Emit WebSocket notification
        websocketService.emitToRole(['admin', 'nurse', 'reception'], 'alert:stuck_visits', {
          count: alerts.length,
          message: `${alerts.length} visite(s) bloquee(s) detectee(s)`
        });
      }

      return {
        success: true,
        stuckInProgress: stuckInProgress.length,
        stuckCheckedIn: stuckCheckedIn.length,
        alertsCreated: alerts.length
      };

    } catch (error) {
      log.error('[VISIT CLEANUP] Error detecting stuck visits:', { error: error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-fix visits that are signed but not marked as completed
   * This handles the common case where doctor signs but forgets to complete
   */
  async autoFixSignedVisits() {
    try {
      const cutoff = new Date(Date.now() - this.thresholds.signedNotCompletedHours * 60 * 60 * 1000);

      const signedButNotCompleted = await Visit.find({
        status: 'in-progress',
        signatureStatus: 'signed',
        signedAt: { $lt: cutoff }
      });

      if (signedButNotCompleted.length === 0) {
        return { success: true, fixed: 0 };
      }

      log.info(`[VISIT CLEANUP] Auto-fixing ${signedButNotCompleted.length} signed but not completed visit(s)`);

      let fixed = 0;
      let errors = 0;

      for (const visit of signedButNotCompleted) {
        try {
          // Complete the visit
          visit.status = 'completed';
          visit.completedAt = visit.signedAt || new Date();
          visit.completedBy = visit.signedBy;
          visit.endTime = visit.endTime || visit.signedAt || new Date();

          await visit.save();

          // Update linked appointment if exists
          if (visit.appointment) {
            await Appointment.findByIdAndUpdate(visit.appointment, {
              status: 'completed',
              completedAt: visit.completedAt
            });
          }

          log.info(`   Fixed: ${visit.visitId}`);
          fixed++;

        } catch (err) {
          log.error(`   Error fixing ${visit.visitId}:`, err.message);
          errors++;
        }
      }

      return { success: true, fixed, errors };

    } catch (error) {
      log.error('[VISIT CLEANUP] Error auto-fixing signed visits:', { error: error });
      return { success: false, error: error.message };
    }
  }

  /**
   * End-of-day cleanup
   * Marks visits that are still in-progress at end of day as requiring review
   */
  async endOfDayCleanup() {
    try {
      log.info('[VISIT CLEANUP] Running end-of-day cleanup...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find all visits from today that are still in-progress
      const openVisits = await Visit.find({
        visitDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['checked-in', 'in-progress'] }
      }).populate('patient', 'firstName lastName patientId');

      if (openVisits.length === 0) {
        log.info('[VISIT CLEANUP] No open visits at end of day');
        return { success: true, openVisits: 0 };
      }

      log.info(`[VISIT CLEANUP] Found ${openVisits.length} open visit(s) at end of day`);

      // Create summary alert for admins
      const visitSummary = openVisits.map(v => ({
        visitId: v.visitId,
        patient: v.patient ? `${v.patient.firstName} ${v.patient.lastName}` : 'Unknown',
        status: v.status
      }));

      await Alert.create({
        category: 'workflow',
        priority: 'high',
        title: 'Visites non terminees en fin de journee',
        message: `${openVisits.length} visite(s) n'ont pas ete terminees aujourd'hui. Veuillez verifier et mettre a jour les statuts.`,
        targetRoles: ['admin'],
        metadata: {
          date: today.toISOString().split('T')[0],
          visits: visitSummary,
          type: 'end_of_day_open_visits'
        },
        requiresAcknowledgment: true
      });

      return { success: true, openVisits: openVisits.length };

    } catch (error) {
      log.error('[VISIT CLEANUP] Error in end-of-day cleanup:', { error: error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync appointment and visit status
   * Ensures bidirectional consistency
   */
  async syncAppointmentVisitStatus() {
    try {
      let synced = 0;

      // 1. Find completed visits with non-completed appointments
      const completedVisits = await Visit.find({
        status: 'completed',
        appointment: { $exists: true, $ne: null }
      }).select('appointment completedAt');

      for (const visit of completedVisits) {
        const appointment = await Appointment.findById(visit.appointment);
        if (appointment && appointment.status !== 'completed' && appointment.status !== 'cancelled') {
          appointment.status = 'completed';
          appointment.completedAt = visit.completedAt;
          await appointment.save();
          synced++;
        }
      }

      // 2. Find cancelled visits with non-cancelled appointments
      const cancelledVisits = await Visit.find({
        status: 'cancelled',
        appointment: { $exists: true, $ne: null }
      }).select('appointment');

      for (const visit of cancelledVisits) {
        const appointment = await Appointment.findById(visit.appointment);
        if (appointment && !['completed', 'cancelled'].includes(appointment.status)) {
          appointment.status = 'cancelled';
          appointment.cancellation = {
            cancelledAt: new Date(),
            reason: 'Visite annulee'
          };
          await appointment.save();
          synced++;
        }
      }

      if (synced > 0) {
        log.info(`[VISIT CLEANUP] Synced ${synced} appointment-visit status(es)`);
      }

      return { success: true, synced };

    } catch (error) {
      log.error('[VISIT CLEANUP] Error syncing appointment-visit status:', { error: error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Manual trigger for stuck visit detection
   */
  async manualCheck() {
    log.info('[VISIT CLEANUP] Manual check triggered');
    const detection = await this.detectStuckVisits();
    const autoFix = await this.autoFixSignedVisits();
    const sync = await this.syncAppointmentVisitStatus();

    return { detection, autoFix, sync };
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length,
      thresholds: this.thresholds
    };
  }

  /**
   * Update thresholds
   */
  setThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('[VISIT CLEANUP] Thresholds updated:', this.thresholds);
  }
}

// Export singleton instance
const visitCleanupScheduler = new VisitCleanupScheduler();

module.exports = visitCleanupScheduler;
