/**
 * Patient Cascade Service
 *
 * Handles cascading deletion and restoration for patient entities.
 * Ensures all 24+ patient-dependent entities are properly handled when
 * a patient is soft-deleted or restored.
 *
 * This service:
 * - Validates deletion is allowed (no blocking items)
 * - Creates PatientArchive for compliance retention
 * - Uses distributed locking to prevent concurrent deletions
 * - Wraps operations in transactions when available (replica set)
 * - Falls back gracefully on standalone MongoDB
 * - Creates tombstones in SyncQueue for multi-clinic sync
 * - Creates audit log entries for compliance
 *
 * @module services/patientCascadeService
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { DistributedLock } = require('./distributedLock');
const { withTransaction } = require('../utils/migrationTransaction');
const logger = require('../config/logger');

/**
 * Complete list of patient-dependent entities with cascade configuration
 *
 * Actions:
 * - 'mark': Soft delete - set metadata.patientDeleted and isDeleted flags
 * - 'cancel': Cancel future appointments (preserve past)
 * - 'delete': Hard delete transient data
 * - 'clear': Clear reference field (e.g., room occupancy)
 */
const PATIENT_DEPENDENT_MODELS = [
  // Clinical Records (soft delete - preserve for medical history)
  { model: 'Visit', field: 'patient', action: 'mark' },
  { model: 'OphthalmologyExam', field: 'patient', action: 'mark' },
  { model: 'OrthopticExam', field: 'patient', action: 'mark' },
  { model: 'LabOrder', field: 'patient', action: 'mark' },
  { model: 'LabResult', field: 'patient', action: 'mark' },
  { model: 'ImagingOrder', field: 'patient', action: 'mark' },
  { model: 'ImagingStudy', field: 'patient', action: 'mark' },
  { model: 'IVTInjection', field: 'patient', action: 'mark' },
  { model: 'IVTVial', field: 'patient', action: 'mark' },
  { model: 'SurgeryCase', field: 'patient', action: 'mark' },
  { model: 'SurgeryReport', field: 'patient', action: 'mark' },
  { model: 'TreatmentProtocol', field: 'patient', action: 'mark' },
  { model: 'Prescription', field: 'patient', action: 'mark' },
  { model: 'Document', field: 'patient', action: 'mark' },
  { model: 'DeviceImage', field: 'patient', action: 'mark' },
  { model: 'DeviceMeasurement', field: 'patient', action: 'mark' },

  // Financial Records (soft delete - preserve for audit)
  { model: 'Invoice', field: 'patient', action: 'mark' },
  { model: 'CompanyUsage', field: 'patient', action: 'mark' },
  { model: 'PaymentPlan', field: 'patient', action: 'mark' },

  // Optical Orders (soft delete - preserve for audit/inventory tracking)
  { model: 'GlassesOrder', field: 'patient', action: 'mark' },
  { model: 'ContactLensFitting', field: 'patient', action: 'mark' },

  // Scheduling (cancel future, preserve past)
  { model: 'Appointment', field: 'patient', action: 'cancel', statusField: 'status' },

  // Transient Data (hard delete)
  { model: 'WaitingList', field: 'patient', action: 'delete' },
  { model: 'PatientAlert', field: 'patient', action: 'delete' },

  // References to clear
  { model: 'Room', field: 'currentPatient', action: 'clear' },
];

/**
 * Safely get a Mongoose model, returning null if not registered
 * @param {string} modelName - Name of the model
 * @returns {Model|null} - Mongoose model or null
 */
function getModelSafely(modelName) {
  try {
    return mongoose.model(modelName);
  } catch (error) {
    // Model not registered - this is expected for optional modules
    logger.debug(`Model ${modelName} not registered, skipping cascade`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Create a SHA-256 hash of a value for identifier matching
 * @param {string} value - Value to hash
 * @returns {string|null} - Hash or null if value is empty
 */
function createIdentifierHash(value) {
  if (!value) return null;
  const normalized = String(value).toLowerCase().trim();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Validates whether a patient can be safely deleted
 * Checks for blocking items that prevent deletion
 *
 * @param {ObjectId|string} patientId - Patient to validate
 * @returns {Promise<Object>} - { canDelete: boolean, blockingItems: Array }
 *
 * @example
 * const validation = await validateDeletion(patientId);
 * if (!validation.canDelete) {
 *   console.log('Cannot delete:', validation.blockingItems);
 * }
 */
async function validateDeletion(patientId) {
  const blockingItems = [];

  // Check for active surgeries (not completed or cancelled)
  const SurgeryCase = getModelSafely('SurgeryCase');
  if (SurgeryCase) {
    const activeSurgeries = await SurgeryCase.countDocuments({
      patient: patientId,
      status: { $nin: ['completed', 'cancelled'] },
      isDeleted: { $ne: true }
    });
    if (activeSurgeries > 0) {
      blockingItems.push({
        type: 'surgery',
        count: activeSurgeries,
        message: `${activeSurgeries} chirurgie(s) en cours`,
        severity: 'blocking'
      });
    }
  }

  // Check for unpaid invoices (pending or partial)
  const Invoice = getModelSafely('Invoice');
  if (Invoice) {
    const unpaidInvoices = await Invoice.countDocuments({
      patient: patientId,
      status: { $in: ['pending', 'partial'] },
      isDeleted: { $ne: true }
    });
    if (unpaidInvoices > 0) {
      blockingItems.push({
        type: 'invoice',
        count: unpaidInvoices,
        message: `${unpaidInvoices} facture(s) impayee(s)`,
        severity: 'blocking'
      });
    }
  }

  // Check for pending lab orders (not completed, cancelled, or rejected)
  const LabOrder = getModelSafely('LabOrder');
  if (LabOrder) {
    const pendingLabOrders = await LabOrder.countDocuments({
      patient: patientId,
      status: { $nin: ['completed', 'cancelled', 'rejected'] },
      isDeleted: { $ne: true }
    });
    if (pendingLabOrders > 0) {
      blockingItems.push({
        type: 'lab_order',
        count: pendingLabOrders,
        message: `${pendingLabOrders} examen(s) de laboratoire en cours`,
        severity: 'blocking'
      });
    }
  }

  // Check for pending glasses orders (not delivered or cancelled)
  const GlassesOrder = getModelSafely('GlassesOrder');
  if (GlassesOrder) {
    const pendingGlassesOrders = await GlassesOrder.countDocuments({
      patient: patientId,
      status: { $nin: ['delivered', 'cancelled'] },
      isDeleted: { $ne: true }
    });
    if (pendingGlassesOrders > 0) {
      blockingItems.push({
        type: 'glasses_order',
        count: pendingGlassesOrders,
        message: `${pendingGlassesOrders} commande(s) optique(s) en cours`,
        severity: 'blocking'
      });
    }
  }

  // Check for active prescription stock reservations
  const Prescription = getModelSafely('Prescription');
  if (Prescription) {
    const activeReservations = await Prescription.countDocuments({
      patient: patientId,
      status: { $in: ['pending', 'ready', 'partial'] },
      'items.reservedStock': { $exists: true, $not: { $size: 0 } },
      isDeleted: { $ne: true }
    });
    if (activeReservations > 0) {
      blockingItems.push({
        type: 'reservation',
        count: activeReservations,
        message: `${activeReservations} reservation(s) de stock active(s)`,
        severity: 'blocking'
      });
    }
  }

  // Check for pending IVT injections
  const IVTInjection = getModelSafely('IVTInjection');
  if (IVTInjection) {
    const pendingIVT = await IVTInjection.countDocuments({
      patient: patientId,
      status: { $in: ['scheduled', 'prepared'] },
      isDeleted: { $ne: true }
    });
    if (pendingIVT > 0) {
      blockingItems.push({
        type: 'ivt_injection',
        count: pendingIVT,
        message: `${pendingIVT} injection(s) IVT programmee(s)`,
        severity: 'blocking'
      });
    }
  }

  logger.info('Patient deletion validation completed', {
    patientId: patientId.toString(),
    canDelete: blockingItems.length === 0,
    blockingItemsCount: blockingItems.length
  });

  return {
    canDelete: blockingItems.length === 0,
    blockingItems
  };
}

/**
 * Archive patient data for compliance before deletion
 * Creates an anonymized record in PatientArchive collection
 *
 * @param {Object} patient - Patient document
 * @param {ObjectId} archivedBy - User performing the archival
 * @param {string} reason - Reason for deletion
 * @param {Object} cascadeResults - Results of cascade operations
 * @param {ClientSession|null} session - MongoDB session for transaction
 * @returns {Promise<Object>} - Created archive record
 */
async function archivePatientData(patient, archivedBy, reason, cascadeResults, session) {
  const PatientArchive = getModelSafely('PatientArchive');

  if (!PatientArchive) {
    logger.warn('PatientArchive model not available, skipping archival', {
      patientId: patient._id.toString()
    });
    return null;
  }

  // Check if archive already exists
  const existingArchive = await PatientArchive.findOne({ originalId: patient._id });
  if (existingArchive) {
    logger.info('Archive already exists for patient', {
      patientId: patient._id.toString(),
      archiveId: existingArchive._id.toString()
    });
    return existingArchive;
  }

  // Calculate age at archival
  let ageAtArchival = null;
  if (patient.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth);
    const now = new Date();
    ageAtArchival = Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000));
  }

  // Create identifier hashes for potential future matching
  const identifierHashes = {
    nameAndDobHash: createIdentifierHash(
      `${patient.firstName}${patient.lastName}${patient.dateOfBirth?.toISOString?.()?.split('T')[0] || ''}`
    ),
    phoneHash: createIdentifierHash(patient.phoneNumber || patient.phone),
    nationalIdHash: createIdentifierHash(patient.nationalId),
    emailHash: createIdentifierHash(patient.email)
  };

  // Build cascade summary
  const affectedModels = Object.entries(cascadeResults || {}).map(([model, data]) => ({
    model,
    count: data.count || 0,
    action: PATIENT_DEPENDENT_MODELS.find(m => m.model === model)?.action || 'unknown'
  }));

  const totalRecordsAffected = affectedModels.reduce((sum, m) => sum + m.count, 0);

  // Calculate retention expiry (10 years from now)
  const retentionExpires = new Date();
  retentionExpires.setFullYear(retentionExpires.getFullYear() + 10);

  // Create the archive
  const opts = session ? { session } : {};
  const archive = await PatientArchive.create([{
    originalId: patient._id,
    patientNumber: patient.patientId || patient.patientNumber,
    clinic: patient.homeClinic || patient.clinic || patient.clinicId,
    anonymizedData: {
      gender: patient.gender,
      birthYear: patient.dateOfBirth?.getFullYear?.() || null,
      ageAtArchival,
      createdYear: patient.createdAt?.getFullYear?.() || new Date().getFullYear(),
      lastVisitYear: patient.lastVisit?.getFullYear?.() || null,
      visitCount: patient.visitCount || 0,
      appointmentCount: patient.appointmentCount || 0,
      surgeryCount: cascadeResults?.SurgeryCase?.count || 0,
      ivtCount: cascadeResults?.IVTInjection?.count || 0,
      glassesOrderCount: cascadeResults?.GlassesOrder?.count || 0,
      invoiceCount: cascadeResults?.Invoice?.count || 0,
      prescriptionCount: cascadeResults?.Prescription?.count || 0,
      hadConvention: !!patient.convention?.company,
      conventionCompanyId: patient.convention?.company,
      dataStatus: patient.dataStatus || 'complete'
    },
    archivedAt: new Date(),
    archivedBy,
    deletionReason: reason,
    retentionExpires,
    cascadeSummary: {
      totalRecordsAffected,
      affectedModels
    },
    identifierHashes,
    auditLog: [{
      action: 'created',
      performedBy: archivedBy,
      performedAt: new Date(),
      reason: `Patient deletion: ${reason}`
    }]
  }], opts);

  logger.info('Patient data archived successfully', {
    patientId: patient._id.toString(),
    archiveId: archive[0]._id.toString(),
    retentionExpires: retentionExpires.toISOString()
  });

  return archive[0];
}

/**
 * Execute cascade operation for a single entity type
 *
 * @param {Object} config - Cascade configuration
 * @param {ObjectId} patientId - Patient ID
 * @param {ObjectId} deletedBy - User performing deletion
 * @param {string} reason - Deletion reason
 * @param {Date} now - Timestamp for consistency
 * @param {ClientSession|null} session - MongoDB session for transaction
 * @returns {Promise<Object>} - Operation result
 */
async function executeCascadeOperation(config, patientId, deletedBy, reason, now, session) {
  const Model = getModelSafely(config.model);

  if (!Model) {
    return {
      model: config.model,
      action: config.action,
      count: 0,
      status: 'skipped',
      reason: 'Model not registered',
    };
  }

  const query = { [config.field]: patientId };
  const opts = session ? { session } : {};

  try {
    let result;

    switch (config.action) {
      case 'mark':
        // Soft delete: mark as deleted with patient deletion metadata
        result = await Model.updateMany(
          query,
          {
            $set: {
              'metadata.patientDeleted': true,
              'metadata.patientDeletedAt': now,
              'metadata.patientDeletedBy': deletedBy,
              'metadata.patientDeleteReason': reason,
              isDeleted: true,
              deletedAt: now,
              deletedBy: deletedBy,
            },
          },
          opts
        );
        break;

      case 'cancel':
        // Cancel future appointments only (preserve history)
        result = await Model.updateMany(
          {
            ...query,
            [config.statusField]: { $nin: ['completed', 'cancelled', 'no-show'] },
            date: { $gte: now },
          },
          {
            $set: {
              [config.statusField]: 'cancelled',
              'cancellation.cancelledAt': now,
              'cancellation.cancelledBy': deletedBy,
              'cancellation.reason': `Patient supprime: ${reason}`,
              'cancellation.cancellationType': 'system_cascade',
            },
          },
          opts
        );
        break;

      case 'delete':
        // Hard delete transient data
        result = await Model.deleteMany(query, opts);
        break;

      case 'clear':
        // Clear reference field (e.g., room occupancy)
        result = await Model.updateMany(
          query,
          { $unset: { [config.field]: 1 } },
          opts
        );
        break;

      default:
        throw new Error(`Unknown cascade action: ${config.action}`);
    }

    return {
      model: config.model,
      action: config.action,
      count: result.modifiedCount || result.deletedCount || 0,
      status: 'success',
    };
  } catch (error) {
    logger.error(`Cascade operation failed for ${config.model}`, {
      patientId: patientId.toString(),
      action: config.action,
      error: error.message,
    });

    return {
      model: config.model,
      action: config.action,
      count: 0,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Delete patient with full cascade to all 24 dependent entities
 *
 * This function:
 * 1. Acquires a distributed lock to prevent concurrent deletions
 * 2. Fetches patient data for tombstone creation
 * 3. Executes all cascade operations in parallel
 * 4. Soft-deletes the patient record
 * 5. Creates a tombstone in SyncQueue for multi-clinic sync
 * 6. Creates an audit log entry
 *
 * @param {ObjectId|string} patientId - Patient to delete
 * @param {ObjectId|string} deletedBy - User performing deletion
 * @param {string} reason - Reason for deletion
 * @param {ObjectId|string} clinicId - Clinic context
 * @returns {Promise<Object>} - Cascade results with affected counts
 * @throws {Error} - If lock cannot be acquired or critical failures occur
 *
 * @example
 * const result = await deletePatientWithCascade(
 *   patientId,
 *   req.user._id,
 *   'Patient requested data deletion',
 *   req.user.currentClinicId
 * );
 * // result: { success: true, patientId, cascadeResults: {...}, totalAffected: 42 }
 */
async function deletePatientWithCascade(patientId, deletedBy, reason, clinicId, options = {}) {
  const startTime = Date.now();
  const { skipValidation = false, forceDelete = false } = options;
  const lockKey = `patient-delete:${patientId}`;
  const lock = new DistributedLock(lockKey, { ttl: 120, maxRetries: 3 });

  logger.info('Starting patient cascade deletion', {
    patientId: patientId.toString(),
    deletedBy: deletedBy.toString(),
    clinicId: clinicId.toString(),
    reason,
    skipValidation,
    forceDelete
  });

  // Validate deletion is allowed (unless explicitly skipped by admin)
  if (!skipValidation && !forceDelete) {
    const validation = await validateDeletion(patientId);
    if (!validation.canDelete) {
      const blockingMessages = validation.blockingItems.map(i => i.message).join(', ');
      logger.warn('Patient deletion blocked', {
        patientId: patientId.toString(),
        blockingItems: validation.blockingItems
      });
      throw new Error(`Impossible de supprimer le patient: ${blockingMessages}`);
    }
  }

  if (!(await lock.acquire())) {
    logger.warn('Patient deletion already in progress', {
      patientId: patientId.toString(),
    });
    throw new Error('Patient deletion already in progress. Please try again later.');
  }

  try {
    const result = await withTransaction(
      async (session) => {
        const Patient = mongoose.model('Patient');
        const opts = session ? { session } : {};

        // 1. Fetch patient for tombstone data and archiving
        const patient = await Patient.findById(patientId)
          .select('firstName lastName dateOfBirth nationalId phone phoneNumber email clinicId homeClinic patientId patientNumber gender convention visitCount appointmentCount lastVisit createdAt dataStatus')
          .session(session)
          .lean();

        if (!patient) {
          throw new Error('Patient not found');
        }

        // Check if already deleted
        if (patient.isDeleted) {
          throw new Error('Patient is already deleted');
        }

        const now = new Date();
        const cascadeResults = {};

        // 2. Build and execute parallel cascade operations
        const cascadeOperations = PATIENT_DEPENDENT_MODELS.map((config) =>
          executeCascadeOperation(config, patientId, deletedBy, reason, now, session)
        );

        // 3. Execute ALL cascades in parallel
        const cascadeSettled = await Promise.allSettled(cascadeOperations);

        // 4. Check for critical failures
        const failures = cascadeSettled.filter(
          (r) => r.status === 'rejected' || r.value?.status === 'failed'
        );

        if (failures.length > 0) {
          const failedModels = failures
            .map((f) => f.reason?.message || f.value?.model || 'unknown')
            .join(', ');

          logger.error('Cascade deletion had failures', {
            patientId: patientId.toString(),
            failedModels,
            failureCount: failures.length,
          });

          // Require 100% cascade success unless explicitly forced by admin
          // forceDelete option should only be used after manual review
          if (!forceDelete) {
            throw new Error(
              `Echec cascade pour: ${failedModels}. ` +
              `Utilisez forceDelete avec privileges admin pour continuer.`
            );
          }

          logger.warn('Continuing cascade deletion despite failures (forceDelete=true)', {
            patientId: patientId.toString(),
            failedModels,
            failureCount: failures.length,
          });
        }

        // 5. Aggregate results
        cascadeSettled.forEach((r) => {
          if (r.status === 'fulfilled' && r.value) {
            cascadeResults[r.value.model] = {
              count: r.value.count,
              status: r.value.status,
            };
          }
        });

        // 6. Archive patient data for compliance (10-year retention)
        try {
          await archivePatientData(patient, deletedBy, reason, cascadeResults, session);
        } catch (archiveError) {
          // Log but don't fail - archival is important but not critical
          logger.error('Failed to archive patient data', {
            patientId: patientId.toString(),
            error: archiveError.message
          });
        }

        // 7. Soft delete patient and clear biometric data
        await Patient.updateOne(
          { _id: patientId },
          {
            $set: {
              isDeleted: true,
              deletedAt: now,
              deletedBy: deletedBy,
              deletionReason: reason,
            },
            $unset: {
              // Remove biometric data for privacy
              faceEncoding: 1,
              faceEncodingUpdatedAt: 1,
              faceImagePath: 1,
              'biometric.faceEncoding': 1,
              'biometric.encodingCapturedAt': 1,
            },
          },
          opts
        );

        // 8. Create tombstone in SyncQueue for multi-clinic sync
        const SyncQueue = getModelSafely('SyncQueue');
        if (SyncQueue) {
          try {
            await SyncQueue.create(
              [
                {
                  syncId: `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  clinicId: clinicId.toString(),
                  operation: 'delete',
                  collection: 'patients',
                  documentId: patientId,
                  tombstone: {
                    entityType: 'Patient',
                    entityIdentifiers: {
                      firstName: patient.firstName,
                      lastName: patient.lastName,
                      dateOfBirth: patient.dateOfBirth,
                      nationalId: patient.nationalId,
                    },
                    childReferences: Object.entries(cascadeResults).map(
                      ([model, data]) => ({
                        collection: model.toLowerCase() + 's',
                        count: data.count,
                        cascadeAction: PATIENT_DEPENDENT_MODELS.find(
                          (m) => m.model === model
                        )?.action,
                      })
                    ),
                  },
                  changedAt: now,
                  changedBy: deletedBy,
                  status: 'pending',
                  priority: 1,
                },
              ],
              { session }
            );
          } catch (syncError) {
            // Log but don't fail - sync can be recovered manually
            logger.warn('Failed to create sync queue tombstone', {
              patientId: patientId.toString(),
              error: syncError.message,
            });
          }
        }

        // 9. Create audit log entry
        const AuditLog = getModelSafely('AuditLog');
        if (AuditLog) {
          try {
            await AuditLog.create(
              [
                {
                  user: deletedBy,
                  action: 'PATIENT_DELETE',
                  resource: 'patient',
                  clinic: clinicId,
                  ipAddress: 'system-cascade',
                  metadata: {
                    patientId: patientId.toString(),
                    operation: 'cascade_delete',
                    reason: reason,
                    cascadeResults: cascadeResults,
                    totalAffected: Object.values(cascadeResults).reduce(
                      (sum, r) => sum + (r.count || 0),
                      0
                    ),
                    modelsAffected: Object.keys(cascadeResults).length,
                  },
                  compliance: {
                    hipaaRelevant: true,
                    dataClassification: 'confidential',
                  },
                },
              ],
              { session }
            );
          } catch (auditError) {
            // Log but don't fail - audit can be recovered from logs
            logger.warn('Failed to create audit log entry', {
              patientId: patientId.toString(),
              error: auditError.message,
            });
          }
        }

        const totalAffected = Object.values(cascadeResults).reduce(
          (sum, r) => sum + (r.count || 0),
          0
        );

        logger.info('Patient cascade deletion completed', {
          patientId: patientId.toString(),
          totalAffected,
          modelsAffected: Object.keys(cascadeResults).length,
          durationMs: Date.now() - startTime,
        });

        return {
          success: true,
          patientId,
          deletedAt: now,
          cascadeResults,
          totalAffected,
        };
      },
      { requireTransaction: false, operationName: 'patient-cascade-delete' }
    );

    return result.result || result;
  } catch (error) {
    logger.error('Patient cascade deletion failed', {
      patientId: patientId.toString(),
      error: error.message,
      stack: error.stack,
      durationMs: Date.now() - startTime,
    });
    throw error;
  } finally {
    await lock.release();
  }
}

/**
 * Restore a soft-deleted patient and all cascaded entities
 *
 * This function reverses the cascade deletion by:
 * 1. Restoring the patient record
 * 2. Restoring all 'mark' cascaded entities
 * 3. Creating an audit log entry
 *
 * Note: Hard-deleted entities (WaitingList, PatientAlert) cannot be restored.
 * Note: Cancelled appointments are not automatically restored - they may need
 *       manual rebooking.
 *
 * @param {ObjectId|string} patientId - Patient to restore
 * @param {ObjectId|string} restoredBy - User performing restoration
 * @returns {Promise<Object>} - Restore results with affected counts
 * @throws {Error} - If patient not found or not deleted
 *
 * @example
 * const result = await restorePatientWithCascade(patientId, req.user._id);
 * // result: { success: true, patientId, restoreResults: {...} }
 */
async function restorePatientWithCascade(patientId, restoredBy) {
  const startTime = Date.now();

  logger.info('Starting patient cascade restoration', {
    patientId: patientId.toString(),
    restoredBy: restoredBy.toString(),
  });

  try {
    const result = await withTransaction(
      async (session) => {
        const Patient = mongoose.model('Patient');
        const opts = session ? { session } : {};

        // 1. Verify patient exists and is deleted
        const patient = await Patient.findById(patientId)
          .select('isDeleted clinicId')
          .session(session)
          .lean();

        if (!patient) {
          throw new Error('Patient not found');
        }

        if (!patient.isDeleted) {
          throw new Error('Patient is not deleted');
        }

        const now = new Date();
        const restoreResults = {};

        // 2. Restore patient record
        await Patient.updateOne(
          { _id: patientId, isDeleted: true },
          {
            $set: {
              isDeleted: false,
              restoredAt: now,
              restoredBy: restoredBy,
            },
            $unset: {
              deletedAt: 1,
              deletedBy: 1,
              deletionReason: 1,
            },
          },
          opts
        );

        // 3. Build restore operations for 'mark' cascades only
        // Hard-deleted and cancelled items cannot be automatically restored
        const restoreOperations = PATIENT_DEPENDENT_MODELS.filter(
          (c) => c.action === 'mark'
        ).map(async (config) => {
          const Model = getModelSafely(config.model);

          if (!Model) {
            return {
              model: config.model,
              count: 0,
              status: 'skipped',
            };
          }

          try {
            const result = await Model.updateMany(
              {
                [config.field]: patientId,
                'metadata.patientDeleted': true,
              },
              {
                $set: {
                  isDeleted: false,
                  'metadata.patientRestored': true,
                  'metadata.patientRestoredAt': now,
                  'metadata.patientRestoredBy': restoredBy,
                },
                $unset: {
                  'metadata.patientDeleted': 1,
                  'metadata.patientDeletedAt': 1,
                  'metadata.patientDeletedBy': 1,
                  'metadata.patientDeleteReason': 1,
                  deletedAt: 1,
                  deletedBy: 1,
                },
              },
              opts
            );

            return {
              model: config.model,
              count: result.modifiedCount,
              status: 'success',
            };
          } catch (error) {
            logger.error(`Restore failed for ${config.model}`, {
              patientId: patientId.toString(),
              error: error.message,
            });

            return {
              model: config.model,
              count: 0,
              status: 'failed',
              error: error.message,
            };
          }
        });

        // 4. Execute all restore operations
        const restoreSettled = await Promise.allSettled(restoreOperations);

        restoreSettled.forEach((r) => {
          if (r.status === 'fulfilled') {
            restoreResults[r.value.model] = {
              count: r.value.count,
              status: r.value.status,
            };
          }
        });

        // 5. Create audit log entry
        const AuditLog = getModelSafely('AuditLog');
        if (AuditLog) {
          try {
            await AuditLog.create(
              [
                {
                  user: restoredBy,
                  action: 'PATIENT_UPDATE',
                  resource: 'patient',
                  clinic: patient.clinicId,
                  ipAddress: 'system-cascade',
                  metadata: {
                    patientId: patientId.toString(),
                    operation: 'cascade_restore',
                    restoreResults: restoreResults,
                    totalRestored: Object.values(restoreResults).reduce(
                      (sum, r) => sum + (r.count || 0),
                      0
                    ),
                  },
                  compliance: {
                    hipaaRelevant: true,
                    dataClassification: 'confidential',
                  },
                },
              ],
              { session }
            );
          } catch (auditError) {
            logger.warn('Failed to create restore audit log', {
              patientId: patientId.toString(),
              error: auditError.message,
            });
          }
        }

        const totalRestored = Object.values(restoreResults).reduce(
          (sum, r) => sum + (r.count || 0),
          0
        );

        logger.info('Patient cascade restoration completed', {
          patientId: patientId.toString(),
          totalRestored,
          durationMs: Date.now() - startTime,
        });

        return {
          success: true,
          patientId,
          restoredAt: now,
          restoreResults,
          totalRestored,
          note: 'Hard-deleted entities (WaitingList, PatientAlert) and cancelled appointments cannot be restored automatically.',
        };
      },
      { requireTransaction: false, operationName: 'patient-cascade-restore' }
    );

    return result.result || result;
  } catch (error) {
    logger.error('Patient cascade restoration failed', {
      patientId: patientId.toString(),
      error: error.message,
      stack: error.stack,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Get cascade status for a patient
 * Useful for preview before deletion or debugging
 *
 * @param {ObjectId|string} patientId - Patient to check
 * @returns {Promise<Object>} - Counts of dependent entities by model
 */
async function getPatientCascadePreview(patientId) {
  const preview = {};

  for (const config of PATIENT_DEPENDENT_MODELS) {
    const Model = getModelSafely(config.model);

    if (!Model) {
      preview[config.model] = { count: 0, action: config.action, available: false };
      continue;
    }

    try {
      const query = { [config.field]: patientId };

      // For appointments, only count future non-cancelled
      if (config.action === 'cancel') {
        query[config.statusField] = { $nin: ['completed', 'cancelled', 'no-show'] };
        query.date = { $gte: new Date() };
      }

      const count = await Model.countDocuments(query);
      preview[config.model] = { count, action: config.action, available: true };
    } catch (error) {
      preview[config.model] = {
        count: 0,
        action: config.action,
        available: false,
        error: error.message,
      };
    }
  }

  const totalEntities = Object.values(preview).reduce(
    (sum, p) => sum + (p.count || 0),
    0
  );

  return {
    patientId,
    entities: preview,
    totalEntities,
    models: Object.keys(preview).length,
  };
}

module.exports = {
  validateDeletion,
  deletePatientWithCascade,
  restorePatientWithCascade,
  getPatientCascadePreview,
  archivePatientData,
  PATIENT_DEPENDENT_MODELS,
};
