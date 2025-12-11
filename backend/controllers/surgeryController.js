const mongoose = require('mongoose');
const SurgeryCase = require('../models/SurgeryCase');
const SurgeryReport = require('../models/SurgeryReport');
const Patient = require('../models/Patient');
const ClinicalAct = require('../models/ClinicalAct');
const ConsultationSession = require('../models/ConsultationSession');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Prescription = require('../models/Prescription');
const Document = require('../models/Document');
const Room = require('../models/Room');
const PharmacyInventory = require('../models/PharmacyInventory');
const { withTransaction } = require('../utils/transactions');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { createContextLogger } = require('../utils/structuredLogger');
const surgeryLogger = createContextLogger('Surgery');
const { APPOINTMENT, PAGINATION } = require('../config/constants');

/**
 * Surgery Controller
 *
 * Handles all surgery case management including:
 * - Queue management (awaiting scheduling)
 * - Scheduling/rescheduling
 * - Check-in workflow
 * - Surgery reports
 * - Dashboard statistics
 */

// ============================================
// DASHBOARD & STATISTICS
// ============================================

/**
 * Get surgery dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const clinicId = req.query.clinic || req.user.clinic;

    const [
      awaitingScheduling,
      scheduledToday,
      inProgress,
      completedToday,
      overdueCases
    ] = await Promise.all([
      SurgeryCase.countDocuments({
        status: 'awaiting_scheduling',
        ...(clinicId && { clinic: clinicId })
      }),
      SurgeryCase.countDocuments({
        status: 'scheduled',
        scheduledDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        },
        ...(clinicId && { clinic: clinicId })
      }),
      SurgeryCase.countDocuments({
        status: { $in: ['checked_in', 'in_surgery'] },
        ...(clinicId && { clinic: clinicId })
      }),
      SurgeryCase.countDocuments({
        status: 'completed',
        surgeryEndTime: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        },
        ...(clinicId && { clinic: clinicId })
      }),
      SurgeryCase.findOverdue(30, clinicId).then(cases => cases.length)
    ]);

    return success(res, {
      awaitingScheduling,
      scheduledToday,
      inProgress,
      completedToday,
      overdueCases
    });
  } catch (err) {
    surgeryLogger.error('Error getting dashboard stats', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

// ============================================
// SURGERY QUEUE (Awaiting Scheduling)
// ============================================

/**
 * Get cases awaiting scheduling
 */
exports.getAwaitingScheduling = async (req, res) => {
  try {
    const clinicId = req.query.clinic || req.user.clinic;
    const cases = await SurgeryCase.findAwaitingScheduling(clinicId);

    return success(res, { data: cases });
  } catch (err) {
    surgeryLogger.error('Error getting awaiting scheduling', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

/**
 * Get overdue cases (waiting too long)
 */
exports.getOverdueCases = async (req, res) => {
  try {
    const maxDays = parseInt(req.query.maxDays) || 30;
    const clinicId = req.query.clinic || req.user.clinic;

    const cases = await SurgeryCase.findOverdue(maxDays, clinicId);

    return success(res, { data: cases });
  } catch (err) {
    surgeryLogger.error('Error getting overdue cases', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

// ============================================
// SCHEDULING & AGENDA
// ============================================

/**
 * Schedule a surgery case with OR room assignment
 */
exports.scheduleCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, roomId, estimatedDuration, notes } = req.body;

    const surgeryCase = await SurgeryCase.findById(id);
    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    if (surgeryCase.status !== 'awaiting_scheduling') {
      return error(res, 'Ce cas ne peut pas être programmé dans son état actuel');
    }

    const startTime = new Date(scheduledDate);
    const duration = estimatedDuration || 60; // Default 60 min
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    // If room is specified, check availability
    if (roomId) {
      const room = await Room.findById(roomId);
      if (!room) {
        return notFound(res, 'Surgery');
      }

      if (room.type !== 'surgery') {
        return error(res, 'Cette salle n\'est pas un bloc opératoire');
      }

      // Check for conflicts with other surgeries at same time
      const conflictingCase = await SurgeryCase.findOne({
        _id: { $ne: id },
        operatingRoom: roomId,
        status: { $in: ['scheduled', 'checked_in', 'in_surgery'] },
        $or: [
          // New surgery starts during existing surgery
          { scheduledDate: { $lte: startTime }, scheduledEndTime: { $gt: startTime } },
          // New surgery ends during existing surgery
          { scheduledDate: { $lt: endTime }, scheduledEndTime: { $gte: endTime } },
          // New surgery completely contains existing surgery
          { scheduledDate: { $gte: startTime }, scheduledEndTime: { $lte: endTime } }
        ]
      });

      if (conflictingCase) {
        return res.status(409).json({
          success: false,
          message: 'La salle est déjà réservée pour ce créneau horaire',
          conflict: {
            caseId: conflictingCase._id,
            scheduledDate: conflictingCase.scheduledDate,
            scheduledEndTime: conflictingCase.scheduledEndTime
          }
        });
      }

      surgeryCase.operatingRoom = roomId;
    }

    surgeryCase.scheduledDate = startTime;
    surgeryCase.scheduledEndTime = endTime;
    surgeryCase.estimatedDuration = duration;
    surgeryCase.updateStatus('scheduled', req.user._id, notes);
    await surgeryCase.save();

    await surgeryCase.populate([
      { path: 'patient', select: 'firstName lastName medicalRecordNumber' },
      { path: 'surgeryType', select: 'name code' },
      { path: 'operatingRoom', select: 'name roomNumber' }
    ]);

    return success(res, { data: surgeryCase, message: 'Chirurgie programmée avec succès' });
  } catch (err) {
    surgeryLogger.error('Error scheduling case', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Reschedule a surgery case
 */
exports.rescheduleCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, reason } = req.body;

    if (!reason) {
      return error(res, 'Une raison est requise pour reprogrammer');
    }

    const surgeryCase = await SurgeryCase.findById(id);
    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    if (!['scheduled', 'awaiting_scheduling'].includes(surgeryCase.status)) {
      return error(res, 'Ce cas ne peut pas être reprogrammé dans son état actuel');
    }

    surgeryCase.reschedule(new Date(newDate), reason, req.user._id);
    if (surgeryCase.status === 'awaiting_scheduling') {
      surgeryCase.updateStatus('scheduled', req.user._id, `Programmé après reprogrammation: ${reason}`);
    }
    await surgeryCase.save();

    return success(res, { data: surgeryCase, message: 'Chirurgie reprogrammée avec succès' });
  } catch (err) {
    surgeryLogger.error('Error rescheduling case', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Cancel a surgery case
 */
exports.cancelCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return error(res, 'Une raison est requise pour annuler');
    }

    const surgeryCase = await SurgeryCase.findById(id);
    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    if (['completed', 'cancelled'].includes(surgeryCase.status)) {
      return error(res, 'Ce cas ne peut pas être annulé');
    }

    surgeryCase.cancellationReason = reason;
    surgeryCase.cancellationNotes = notes;
    surgeryCase.updateStatus('cancelled', req.user._id, notes);
    await surgeryCase.save();

    return success(res, { data: surgeryCase, message: 'Chirurgie annulée' });
  } catch (err) {
    surgeryLogger.error('Error cancelling case', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Get agenda for date range
 */
exports.getAgenda = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const clinicId = req.query.clinic || req.user.clinic;

    const start = new Date(startDate || new Date());
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate || startDate || new Date());
    end.setHours(23, 59, 59, 999);

    const cases = await SurgeryCase.findScheduledByDateRange(start, end, clinicId);

    return success(res, { data: cases });
  } catch (err) {
    surgeryLogger.error('Error getting agenda', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

// ============================================
// CHECK-IN WORKFLOW
// ============================================

/**
 * Get cases ready for check-in (scheduled for today)
 */
exports.getReadyForCheckIn = async (req, res) => {
  try {
    const clinicId = req.query.clinic || req.user.clinic;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const cases = await SurgeryCase.find({
      status: 'scheduled',
      scheduledDate: { $gte: today, $lt: tomorrow },
      ...(clinicId && { clinic: clinicId })
    })
      .populate('patient', 'firstName lastName dateOfBirth medicalRecordNumber phone')
      .populate('surgeryType', 'name code category')
      .sort({ scheduledDate: 1 });

    return success(res, { data: cases });
  } catch (err) {
    surgeryLogger.error('Error getting ready for check-in', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

/**
 * Check in a patient and assign surgeon
 */
exports.checkInPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { surgeonId, assistantSurgeonId, preOpNotes } = req.body;

    if (!surgeonId) {
      return error(res, 'Un chirurgien doit être assigné lors du check-in');
    }

    const surgeryCase = await SurgeryCase.findById(id);
    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    if (surgeryCase.status !== 'scheduled') {
      return error(res, 'Ce patient ne peut pas être enregistré');
    }

    surgeryCase.surgeon = surgeonId;
    if (assistantSurgeonId) {
      surgeryCase.assistantSurgeon = assistantSurgeonId;
    }
    if (preOpNotes) {
      surgeryCase.preOpNotes = preOpNotes;
    }
    surgeryCase.updateStatus('checked_in', req.user._id, 'Patient enregistré');
    await surgeryCase.save();

    await surgeryCase.populate([
      { path: 'patient', select: 'firstName lastName medicalRecordNumber' },
      { path: 'surgeon', select: 'firstName lastName' },
      { path: 'surgeryType', select: 'name code' }
    ]);

    return success(res, { data: surgeryCase, message: 'Patient enregistré avec succès' });
  } catch (err) {
    surgeryLogger.error('Error checking in patient', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Get full clinical background for surgeon check-in view
 */
exports.getClinicalBackground = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId - skip query for invalid IDs like "new"
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, 'Invalid surgery case ID', 400);
    }

    const surgeryCase = await SurgeryCase.findById(id)
      .populate('patient')
      .populate('surgeryType', 'name code category description')
      .populate('surgeon', 'firstName lastName title')
      .populate('consultation');

    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    const patientId = surgeryCase.patient._id;

    // Fetch all clinical data in parallel
    const [
      recentConsultations,
      ophthalmologyExams,
      activePrescriptions,
      documents,
      previousSurgeries
    ] = await Promise.all([
      // Recent consultations
      ConsultationSession.find({ patient: patientId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('provider', 'firstName lastName title'),

      // Ophthalmology exams
      OphthalmologyExam.find({ patient: patientId })
        .sort({ createdAt: -1 })
        .limit(3),

      // Active prescriptions
      Prescription.find({
        patient: patientId,
        status: { $in: ['active', 'pending'] }
      }).sort({ createdAt: -1 }),

      // Documents (images, scans, etc.)
      Document.find({
        patient: patientId,
        type: { $in: ['imaging', 'scan', 'photo', 'oct', 'fundus'] }
      })
        .sort({ createdAt: -1 })
        .limit(20),

      // Previous surgeries
      SurgeryCase.find({
        patient: patientId,
        _id: { $ne: id },
        status: 'completed'
      })
        .populate('surgeryType', 'name code')
        .populate('surgeryReport')
        .sort({ surgeryEndTime: -1 })
    ]);

    return success(res, {
      surgeryCase,
      patient: surgeryCase.patient,
      clinicalData: {
        recentConsultations,
        ophthalmologyExams,
        activePrescriptions,
        documents,
        previousSurgeries
      }
    });
  } catch (err) {
    surgeryLogger.error('Error getting clinical background', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Update pre-op checklist
 */
exports.updatePreOpChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const checklistUpdates = req.body;

    const surgeryCase = await SurgeryCase.findById(id);
    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    // Merge checklist updates
    surgeryCase.preOpChecklist = {
      ...surgeryCase.preOpChecklist,
      ...checklistUpdates,
      checklistCompletedBy: req.user._id,
      checklistCompletedAt: new Date()
    };

    await surgeryCase.save();

    return success(res, { data: surgeryCase.preOpChecklist, message: 'Checklist mise à jour' });
  } catch (err) {
    surgeryLogger.error('Error updating checklist', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

// ============================================
// SURGERY IN PROGRESS
// ============================================

/**
 * Start surgery
 */
exports.startSurgery = async (req, res) => {
  try {
    const { id } = req.params;

    const surgeryCase = await SurgeryCase.findById(id);
    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    if (surgeryCase.status !== 'checked_in') {
      return error(res, 'Le patient doit être enregistré avant de commencer la chirurgie');
    }

    surgeryCase.updateStatus('in_surgery', req.user._id, 'Chirurgie démarrée');
    await surgeryCase.save();

    return success(res, { data: surgeryCase, message: 'Chirurgie démarrée' });
  } catch (err) {
    surgeryLogger.error('Error starting surgery', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Add consumables used during surgery
 * CRITICAL FIX: Now actually decrements inventory for each consumable used
 */
exports.addConsumables = async (req, res) => {
  try {
    const { id } = req.params;
    const { consumables, equipment, iolDetails } = req.body;

    const surgeryCase = await SurgeryCase.findById(id);
    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    const inventoryUpdates = [];
    const consumableErrors = [];

    // CRITICAL FIX: Decrement inventory for each consumable
    if (consumables && consumables.length > 0) {
      for (const consumable of consumables) {
        // If consumable has an inventory item reference, decrement it
        if (consumable.item) {
          try {
            const inventoryItem = await PharmacyInventory.findById(consumable.item);
            if (inventoryItem) {
              const quantity = consumable.quantity || 1;

              // Check if enough stock available
              if (inventoryItem.inventory.currentStock < quantity) {
                consumableErrors.push({
                  item: consumable.itemName || consumable.item,
                  error: `Stock insuffisant. Disponible: ${inventoryItem.inventory.currentStock}, Demandé: ${quantity}`
                });
                continue;
              }

              // Use dispenseMedication method to properly track the usage
              await inventoryItem.dispenseMedication(
                quantity,
                surgeryCase._id, // Use surgery case as reference
                surgeryCase.patient,
                req.user._id,
                consumable.lotNumber
              );

              inventoryUpdates.push({
                item: consumable.itemName || inventoryItem.medication?.genericName,
                quantity,
                lotNumber: consumable.lotNumber
              });

              surgeryLogger.info('Decremented inventory for consumable', {
                itemName: consumable.itemName,
                quantity,
                caseId: id
              });
            }
          } catch (invError) {
            surgeryLogger.error('Error decrementing inventory for consumable', {
              itemName: consumable.itemName,
              error: invError.message,
              caseId: id
            });
            consumableErrors.push({
              item: consumable.itemName || consumable.item,
              error: invError.message
            });
          }
        }

        // Always record the consumable in the surgery case
        surgeryCase.consumablesUsed.push(consumable);
      }
    }

    if (equipment && equipment.length > 0) {
      surgeryCase.equipmentUsed.push(...equipment);
    }

    if (iolDetails) {
      surgeryCase.iolDetails = iolDetails;

      // If IOL has inventory reference, decrement it too
      if (iolDetails.inventoryItem) {
        try {
          const iolInventory = await PharmacyInventory.findById(iolDetails.inventoryItem);
          if (iolInventory) {
            await iolInventory.dispenseMedication(
              1,
              surgeryCase._id,
              surgeryCase.patient,
              req.user._id,
              iolDetails.lotNumber
            );
            inventoryUpdates.push({
              item: `IOL ${iolDetails.model}`,
              quantity: 1,
              lotNumber: iolDetails.lotNumber
            });
            surgeryLogger.info('Decremented IOL inventory', {
              model: iolDetails.model,
              caseId: id
            });
          }
        } catch (iolError) {
          surgeryLogger.error('Error decrementing IOL inventory', {
            model: iolDetails.model,
            error: iolError.message,
            caseId: id
          });
          consumableErrors.push({
            item: `IOL ${iolDetails.model}`,
            error: iolError.message
          });
        }
      }
    }

    await surgeryCase.save();

    const response = {
      success: true,
      data: surgeryCase,
      message: 'Consommables enregistrés',
      inventoryUpdates
    };

    if (consumableErrors.length > 0) {
      response.warnings = consumableErrors;
      response.message = 'Consommables enregistrés avec avertissements';
    }

    res.json(response);
  } catch (err) {
    surgeryLogger.error('Error adding consumables', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

// ============================================
// SURGERY REPORT
// ============================================

/**
 * Create surgery report (auto-populates from case)
 */
exports.createReport = async (req, res) => {
  try {
    const { id } = req.params;
    const reportData = req.body;

    const surgeryCase = await SurgeryCase.findById(id)
      .populate('surgeryType');

    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    if (!['in_surgery', 'completed'].includes(surgeryCase.status)) {
      return error(res, 'La chirurgie doit être en cours ou terminée pour créer un rapport');
    }

    // Check if report already exists
    if (surgeryCase.surgeryReport) {
      return error(res, 'Un rapport existe déjà pour cette chirurgie');
    }

    // Create report with auto-populated fields
    const report = new SurgeryReport({
      surgeryCase: id,
      patient: surgeryCase.patient,
      surgeryType: surgeryCase.surgeryType._id,
      surgeon: surgeryCase.surgeon,
      assistantSurgeon: surgeryCase.assistantSurgeon,
      eye: surgeryCase.eye,
      clinic: surgeryCase.clinic,
      surgeryDate: surgeryCase.surgeryStartTime || new Date(),
      ...reportData
    });

    await report.save();

    // Link report to case and mark completed
    surgeryCase.surgeryReport = report._id;
    if (surgeryCase.status === 'in_surgery') {
      surgeryCase.updateStatus('completed', req.user._id, 'Rapport créé');
    }
    await surgeryCase.save();

    return success(res, { data: report, message: 'Rapport créé avec succès' });
  } catch (err) {
    surgeryLogger.error('Error creating report', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Update surgery report
 */
exports.updateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const updates = req.body;

    const report = await SurgeryReport.findById(reportId);
    if (!report) {
      return notFound(res, 'Surgery');
    }

    if (report.status === 'finalized') {
      return error(res, 'Ce rapport est finalisé et ne peut plus être modifié');
    }

    Object.assign(report, updates);
    await report.save();

    return success(res, { data: report, message: 'Rapport mis à jour' });
  } catch (err) {
    surgeryLogger.error('Error updating report', { error: err.message, stack: err.stack, reportId: req.params.reportId });
    return error(res, err.message);
  }
};

/**
 * Finalize and sign report
 * AUTO-CREATES follow-up appointment if followUpDate is set
 */
exports.finalizeReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await SurgeryReport.findById(reportId);
    if (!report) {
      return notFound(res, 'Surgery');
    }

    // Validate required fields
    const requiredFields = ['preOpDiagnosis', 'postOpDiagnosis', 'procedurePerformed', 'operativeFindings'];
    const missingFields = requiredFields.filter(field => !report[field]);

    if (missingFields.length > 0) {
      return error(res, `Champs requis manquants: ${missingFields.join(', ')}`);
    }

    report.finalize(req.user._id);
    await report.save();

    // AUTO-CREATE FOLLOW-UP APPOINTMENT if followUpDate is set
    let followUpAppointment = null;
    if (report.followUpDate) {
      try {
        const Appointment = require('../models/Appointment');
        const surgeryCase = await SurgeryCase.findById(report.surgeryCase)
          .populate('surgeryType', 'name code');

        if (surgeryCase) {
          // Create follow-up appointment
          followUpAppointment = await Appointment.create({
            patient: surgeryCase.patient,
            appointmentType: 'follow-up',
            scheduledDate: report.followUpDate,
            duration: APPOINTMENT.SURGERY_DURATION_MINUTES, // Default surgery duration for post-op check
            provider: report.surgeon,
            status: 'scheduled',
            notes: `Suivi post-opératoire: ${surgeryCase.surgeryType?.name || 'Chirurgie'}\n${report.followUpInstructions || ''}`,
            relatedSurgery: surgeryCase._id,
            priority: 'normal',
            createdBy: req.user._id
          });

          // Update surgery case with follow-up reference
          surgeryCase.followUpAppointment = followUpAppointment._id;
          surgeryCase.followUpScheduled = true;
          await surgeryCase.save();

          surgeryLogger.info('Auto-created follow-up appointment', {
            appointmentId: followUpAppointment._id,
            surgeryId: surgeryCase._id
          });
        }
      } catch (followUpError) {
        surgeryLogger.error('Error creating follow-up appointment', {
          error: followUpError.message,
          reportId
        });
        // Don't fail the whole operation, just log the error
      }
    }

    res.json({
      success: true,
      data: report,
      followUpAppointment: followUpAppointment ? {
        id: followUpAppointment._id,
        scheduledDate: followUpAppointment.scheduledDate
      } : null,
      message: followUpAppointment
        ? 'Rapport finalisé et RDV de suivi créé'
        : 'Rapport finalisé et signé'
    });
  } catch (err) {
    surgeryLogger.error('Error finalizing report', { error: err.message, stack: err.stack, reportId: req.params.reportId });
    return error(res, err.message);
  }
};

/**
 * Get report by ID
 */
exports.getReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await SurgeryReport.findById(reportId)
      .populate('patient', 'firstName lastName dateOfBirth medicalRecordNumber')
      .populate('surgeon', 'firstName lastName title')
      .populate('assistantSurgeon', 'firstName lastName title')
      .populate('surgeryType', 'name code category');

    if (!report) {
      return notFound(res, 'Surgery');
    }

    return success(res, { data: report });
  } catch (err) {
    surgeryLogger.error('Error getting report', { error: err.message, stack: err.stack, reportId: req.params.reportId });
    return error(res, err.message);
  }
};

// ============================================
// PATIENT SURGERY HISTORY
// ============================================

/**
 * Get all surgeries for a patient
 */
exports.getPatientSurgeries = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await findPatientByIdOrCode(patientId);
    if (!patient) {
      return notFound(res, 'Patient');
    }

    const surgeries = await SurgeryCase.find({ patient: patient._id })
      .populate('surgeryType', 'name code category')
      .populate('surgeon', 'firstName lastName title')
      .populate('surgeryReport')
      .sort({ createdAt: -1 });

    return success(res, { data: surgeries });
  } catch (err) {
    surgeryLogger.error('Error getting patient surgeries', { error: err.message, stack: err.stack, patientId: req.params.patientId });
    return error(res, err.message);
  }
};

// ============================================
// CASE MANAGEMENT
// ============================================

/**
 * Get single case by ID
 */
exports.getCase = async (req, res) => {
  try {
    const { id } = req.params;

    const surgeryCase = await SurgeryCase.findById(id)
      .populate('patient')
      .populate('surgeryType', 'name code category description')
      .populate('surgeon', 'firstName lastName title')
      .populate('assistantSurgeon', 'firstName lastName title')
      .populate('consultation')
      .populate('invoice')
      .populate('surgeryReport');

    if (!surgeryCase) {
      return notFound(res, 'Surgery');
    }

    return success(res, { data: surgeryCase });
  } catch (err) {
    surgeryLogger.error('Error getting case', { error: err.message, stack: err.stack, caseId: req.params.id });
    return error(res, err.message);
  }
};

/**
 * Create surgery case manually (usually auto-created from invoice)
 */
exports.createCase = async (req, res) => {
  try {
    const caseData = req.body;

    const surgeryCase = new SurgeryCase({
      ...caseData,
      createdBy: req.user._id,
      paymentDate: caseData.paymentDate || new Date()
    });

    surgeryCase.statusHistory.push({
      status: 'awaiting_scheduling',
      changedAt: new Date(),
      changedBy: req.user._id,
      notes: 'Cas créé manuellement'
    });

    await surgeryCase.save();

    await surgeryCase.populate([
      { path: 'patient', select: 'firstName lastName medicalRecordNumber' },
      { path: 'surgeryType', select: 'name code' }
    ]);

    return success(res, { data: surgeryCase, message: 'Cas de chirurgie créé' });
  } catch (err) {
    surgeryLogger.error('Error creating case', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

/**
 * Get all cases with filters
 */
exports.getCases = async (req, res) => {
  try {
    const {
      status,
      surgeryType,
      surgeon,
      startDate,
      endDate,
      clinic,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (surgeryType) query.surgeryType = surgeryType;
    if (surgeon) query.surgeon = surgeon;
    if (clinic || req.user.clinic) query.clinic = clinic || req.user.clinic;

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const cases = await SurgeryCase.find(query)
      .populate('patient', 'firstName lastName medicalRecordNumber')
      .populate('surgeryType', 'name code category')
      .populate('surgeon', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SurgeryCase.countDocuments(query);

    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    surgeryLogger.error('Error getting cases', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

// ============================================
// SURGERY TYPES (from ClinicalAct)
// ============================================

/**
 * Get available surgery types
 */
exports.getSurgeryTypes = async (req, res) => {
  try {
    const surgeryTypes = await ClinicalAct.find({
      category: { $regex: /chirurgie/i }
    }).sort({ category: 1, name: 1 });

    return success(res, { data: surgeryTypes });
  } catch (err) {
    surgeryLogger.error('Error getting surgery types', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

// ============================================
// SURGEON DASHBOARD
// ============================================

/**
 * Get surgeon's schedule for a date
 */
exports.getSurgeonSchedule = async (req, res) => {
  try {
    const surgeonId = req.params.surgeonId || req.user._id;
    const date = req.query.date || new Date();

    const schedule = await SurgeryCase.findSurgeonSchedule(surgeonId, new Date(date));

    return success(res, { data: schedule });
  } catch (err) {
    surgeryLogger.error('Error getting surgeon schedule', { error: err.message, stack: err.stack, surgeonId: req.params.surgeonId || req.user._id });
    return error(res, err.message);
  }
};

/**
 * Get surgeon's checked-in patients
 */
exports.getSurgeonCheckedInPatients = async (req, res) => {
  try {
    const surgeonId = req.params.surgeonId || req.user._id;

    const patients = await SurgeryCase.find({
      surgeon: surgeonId,
      status: { $in: ['checked_in', 'in_surgery'] }
    })
      .populate('patient', 'firstName lastName dateOfBirth medicalRecordNumber')
      .populate('surgeryType', 'name code')
      .sort({ checkInTime: 1 });

    return success(res, { data: patients });
  } catch (err) {
    surgeryLogger.error('Error getting checked-in patients', { error: err.message, stack: err.stack, surgeonId: req.params.surgeonId || req.user._id });
    return error(res, err.message);
  }
};

/**
 * Get surgeon's draft reports
 */
exports.getSurgeonDraftReports = async (req, res) => {
  try {
    const surgeonId = req.params.surgeonId || req.user._id;

    const drafts = await SurgeryReport.findDraftsBySurgeon(surgeonId);

    return success(res, { data: drafts });
  } catch (err) {
    surgeryLogger.error('Error getting draft reports', { error: err.message, stack: err.stack, surgeonId: req.params.surgeonId || req.user._id });
    return error(res, err.message);
  }
};

// ============================================
// SPECIMEN COLLECTION & PATHOLOGY
// ============================================

/**
 * Add specimen to surgery report and auto-create LabOrder
 */
exports.addSpecimen = async (req, res) => {
  try {
    const { reportId } = req.params;
    const {
      specimenType,
      description,
      source,
      eye,
      sendToLab,
      labName,
      pathologyTests,
      priority,
      notes
    } = req.body;

    // Find the surgery report
    const report = await SurgeryReport.findById(reportId)
      .populate('surgeryCase');

    if (!report) {
      return notFound(res, 'Surgery');
    }

    // Create specimen record
    const specimen = {
      specimenType,
      description,
      source,
      eye: eye || report.eye || 'N/A',
      collectedAt: new Date(),
      collectedBy: req.user._id,
      sentToLab: sendToLab || false,
      sentTo: labName,
      notes
    };

    // If sending to lab, create LabOrder automatically
    let labOrder = null;
    if (sendToLab && pathologyTests && pathologyTests.length > 0) {
      const LabOrder = require('../models/LabOrder');

      const labOrderData = {
        patient: report.surgeryCase.patient,
        visit: report.surgeryCase.consultation,
        orderedBy: req.user._id,
        priority: priority || 'routine',
        status: 'ordered',
        tests: pathologyTests.map(test => ({
          testName: test.name || test,
          testCode: test.code,
          category: 'pathology',
          specimen: specimenType,
          status: 'pending'
        })),
        specimen: {
          collectedAt: new Date(),
          collectedBy: req.user._id,
          specimenType: specimenType,
          quality: 'acceptable'
        },
        clinicalNotes: `Surgical specimen from ${report.surgeryCase.surgeryType?.name || 'surgery'}. Eye: ${eye || 'N/A'}. Source: ${source || 'surgical field'}. ${description || ''}`,
        diagnosis: report.surgeryCase.preOpDiagnosis,
        billing: {
          billable: true
        },
        specialInstructions: notes,
        createdBy: req.user._id
      };

      labOrder = await LabOrder.create(labOrderData);

      // Update specimen with lab order reference
      specimen.labOrder = labOrder._id;
      specimen.labOrderStatus = 'ordered';
      specimen.sentAt = new Date();

      surgeryLogger.info('Created pathology LabOrder for specimen', {
        labOrderId: labOrder.orderId,
        reportId
      });
    }

    // Add specimen to report
    report.specimensCollected = report.specimensCollected || [];
    report.specimensCollected.push(specimen);
    await report.save();

    res.json({
      success: true,
      message: labOrder
        ? `Specimen recorded and lab order ${labOrder.orderId} created`
        : 'Specimen recorded successfully',
      data: {
        specimen: report.specimensCollected[report.specimensCollected.length - 1],
        labOrder: labOrder ? {
          _id: labOrder._id,
          orderId: labOrder.orderId,
          status: labOrder.status
        } : null
      }
    });
  } catch (err) {
    surgeryLogger.error('Error adding specimen', { error: err.message, stack: err.stack, reportId: req.params.reportId });
    return error(res, err.message);
  }
};

/**
 * Get specimens for a surgery report
 */
exports.getSpecimens = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await SurgeryReport.findById(reportId)
      .populate('specimensCollected.labOrder')
      .populate('specimensCollected.collectedBy', 'firstName lastName')
      .select('specimensCollected');

    if (!report) {
      return notFound(res, 'Surgery');
    }

    return success(res, { data: report.specimensCollected || [] });
  } catch (err) {
    surgeryLogger.error('Error getting specimens', { error: err.message, stack: err.stack, reportId: req.params.reportId });
    return error(res, err.message);
  }
};

/**
 * Update specimen with pathology results
 */
exports.updateSpecimenResults = async (req, res) => {
  try {
    const { reportId, specimenId } = req.params;
    const { pathologyDiagnosis, resultNotes } = req.body;

    const report = await SurgeryReport.findById(reportId);

    if (!report) {
      return notFound(res, 'Surgery');
    }

    // Find the specimen
    const specimen = report.specimensCollected.id(specimenId);
    if (!specimen) {
      return notFound(res, 'Surgery');
    }

    // Update specimen with results
    specimen.resultReceived = true;
    specimen.resultReceivedAt = new Date();
    specimen.pathologyDiagnosis = pathologyDiagnosis;
    if (resultNotes) {
      specimen.notes = (specimen.notes || '') + '\n' + resultNotes;
    }
    specimen.labOrderStatus = 'completed';

    await report.save();

    return success(res, { data: specimen, message: 'Specimen results updated' });
  } catch (err) {
    surgeryLogger.error('Error updating specimen results', { error: err.message, stack: err.stack, reportId: req.params.reportId, specimenId: req.params.specimenId });
    return error(res, err.message);
  }
};

/**
 * Get pending pathology results for surgeon
 */
exports.getPendingPathology = async (req, res) => {
  try {
    const surgeonId = req.params.surgeonId || req.user._id;

    // Find all reports with pending pathology
    const reportsWithPending = await SurgeryReport.find({
      surgeon: surgeonId,
      'specimensCollected.sentToLab': true,
      'specimensCollected.resultReceived': false
    })
      .populate('surgeryCase', 'patient surgeryType scheduledDate')
      .populate({
        path: 'surgeryCase',
        populate: {
          path: 'patient',
          select: 'firstName lastName patientId'
        }
      })
      .populate('specimensCollected.labOrder', 'orderId status')
      .select('specimensCollected surgeryCase createdAt')
      .sort({ createdAt: -1 });

    // Flatten to just the pending specimens
    const pendingSpecimens = [];
    for (const report of reportsWithPending) {
      for (const specimen of report.specimensCollected) {
        if (specimen.sentToLab && !specimen.resultReceived) {
          pendingSpecimens.push({
            reportId: report._id,
            specimenId: specimen._id,
            surgeryCase: report.surgeryCase,
            specimenType: specimen.specimenType,
            collectedAt: specimen.collectedAt,
            sentAt: specimen.sentAt,
            sentTo: specimen.sentTo,
            labOrder: specimen.labOrder,
            eye: specimen.eye,
            daysPending: Math.floor((Date.now() - new Date(specimen.sentAt).getTime()) / (1000 * 60 * 60 * 24))
          });
        }
      }
    }

    return success(res, { data: pendingSpecimens });
  } catch (err) {
    surgeryLogger.error('Error getting pending pathology', { error: err.message, stack: err.stack, surgeonId: req.params.surgeonId || req.user._id });
    return error(res, err.message);
  }
};

// ============================================
// OR ROOM SCHEDULING
// ============================================

/**
 * Get available OR rooms for a time slot
 */
exports.getAvailableORRooms = async (req, res) => {
  try {
    const { startTime, duration } = req.query;
    const clinicId = req.query.clinic || req.user.clinic;

    if (!startTime) {
      return error(res, 'startTime is required');
    }

    const start = new Date(startTime);
    const durationMins = parseInt(duration) || 60;
    const end = new Date(start.getTime() + durationMins * 60 * 1000);

    // Get all OR rooms for the clinic
    const allORRooms = await Room.find({
      type: 'surgery',
      isActive: true,
      ...(clinicId && { clinic: clinicId })
    }).select('_id name roomNumber floor equipment features');

    // Find all conflicting surgeries
    const conflictingCases = await SurgeryCase.find({
      operatingRoom: { $in: allORRooms.map(r => r._id) },
      status: { $in: ['scheduled', 'checked_in', 'in_surgery'] },
      $or: [
        { scheduledDate: { $lte: start }, scheduledEndTime: { $gt: start } },
        { scheduledDate: { $lt: end }, scheduledEndTime: { $gte: end } },
        { scheduledDate: { $gte: start }, scheduledEndTime: { $lte: end } }
      ]
    }).select('operatingRoom');

    const busyRoomIds = conflictingCases.map(c => c.operatingRoom.toString());

    // Filter available rooms
    const availableRooms = allORRooms.filter(room => !busyRoomIds.includes(room._id.toString()));

    return success(res, {
      availableRooms,
      busyRooms: allORRooms.filter(room => busyRoomIds.includes(room._id.toString())),
      requestedSlot: { start, end, duration: durationMins }
    });
  } catch (err) {
    surgeryLogger.error('Error getting available OR rooms', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

/**
 * Get OR room schedule for a date
 */
exports.getRoomSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;
    const clinicId = req.query.clinic || req.user.clinic;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // If roomId is provided, get schedule for specific room
    // Otherwise get schedule for all OR rooms
    let roomQuery = { type: 'surgery', isActive: true };
    if (roomId) {
      roomQuery._id = roomId;
    }
    if (clinicId) {
      roomQuery.clinic = clinicId;
    }

    const rooms = await Room.find(roomQuery).select('_id name roomNumber floor');

    const surgeries = await SurgeryCase.find({
      operatingRoom: { $in: rooms.map(r => r._id) },
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['scheduled', 'checked_in', 'in_surgery', 'completed'] }
    })
      .populate('patient', 'firstName lastName medicalRecordNumber')
      .populate('surgeryType', 'name code')
      .populate('surgeon', 'firstName lastName')
      .populate('operatingRoom', 'name roomNumber')
      .sort({ scheduledDate: 1 });

    // Group by room
    const scheduleByRoom = {};
    for (const room of rooms) {
      scheduleByRoom[room._id] = {
        room: room,
        surgeries: surgeries.filter(s => s.operatingRoom?._id?.toString() === room._id.toString())
      };
    }

    return success(res, {
      date: targetDate,
      rooms: Object.values(scheduleByRoom)
    });
  } catch (err) {
    surgeryLogger.error('Error getting room schedule', { error: err.message, stack: err.stack, roomId: req.params.roomId });
    return error(res, err.message);
  }
};

/**
 * Get all OR rooms for the clinic
 */
exports.getORRooms = async (req, res) => {
  try {
    const clinicId = req.query.clinic || req.user.clinic;

    const rooms = await Room.find({
      type: 'surgery',
      isActive: true,
      ...(clinicId && { clinic: clinicId })
    })
      .populate('clinic', 'name shortName')
      .sort('floor roomNumber');

    return success(res, { data: rooms });
  } catch (err) {
    surgeryLogger.error('Error getting OR rooms', { error: err.message, stack: err.stack });
    return error(res, err.message);
  }
};

module.exports = exports;
