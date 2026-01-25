const IVTInjection = require('../models/IVTInjection');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const FeeSchedule = require('../models/FeeSchedule');
const { Inventory, PharmacyInventory } = require('../models/Inventory');
const { logActionDirect: logAction, logCriticalOperationDirect: logCriticalOperation } = require('../middleware/auditLogger');
const { asyncHandler } = require('../middleware/errorHandler');
const { createContextLogger } = require('../utils/structuredLogger');
const { withTransactionRetry } = require('../utils/transactions');
const { withLock } = require('../services/distributedLock');
const { serverError } = require('../utils/apiResponse');
const log = createContextLogger('IVTController');

// @desc    Validate IVT injection before creation
// @route   POST /api/ivt/validate
// @access  Private (ophthalmologist only)
exports.validateIVTInjection = async (req, res) => {
  try {
    const { patientId, eye, injectionDate, medication, series } = req.body;

    if (!patientId || !eye) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and eye are required for validation'
      });
    }

    const validation = await IVTInjection.validateNewInjection(
      { injectionDate, medication, series, eye },
      patientId,
      eye
    );

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    log.error('Error validating IVT injection', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la validation de l\'injection IVT');
  }
};

// @desc    Create new IVT injection record
// @route   POST /api/ivt
// @access  Private (ophthalmologist only)
exports.createIVTInjection = async (req, res) => {
  try {
    const { patientId, forceCreate, autoGenerateInvoice = true, ...injectionData } = req.body;

    const patient = await Patient.findById(patientId).populate('convention');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const previousInjection = await IVTInjection.findOne({
      patient: patientId,
      eye: injectionData.eye,
      status: 'completed',
      isDeleted: { $ne: true }
    }).sort({ injectionDate: -1 });

    const seriesInfo = {
      injectionNumber: injectionData.series?.injectionNumber || 1,
      protocol: injectionData.series?.protocol || 'loading',
      previousInjection: previousInjection?._id,
      initialInjection: previousInjection?.series?.initialInjection || null,
      totalInjectionsThisEye: previousInjection ? (previousInjection.series.totalInjectionsThisEye || 0) + 1 : 1
    };

    if (previousInjection) {
      const daysDiff = Math.floor((new Date() - previousInjection.injectionDate) / (1000 * 60 * 60 * 24));
      seriesInfo.intervalFromLast = Math.round(daysDiff / 7);
    }

    let procedureFeeSchedule = null;
    let medicationFeeSchedule = null;
    const medicationName = injectionData.medication?.name || 'Anti-VEGF';

    if (autoGenerateInvoice) {
      procedureFeeSchedule = await FeeSchedule.findOne({
        $or: [
          { code: 'IVT' },
          { aliases: 'IVT' },
          { name: { $regex: /IVT|injection.*intravitréenne/i } }
        ],
        isActive: true
      });

      medicationFeeSchedule = await FeeSchedule.findOne({
        $or: [
          { name: { $regex: new RegExp(medicationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
          { aliases: { $regex: new RegExp(medicationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
        ],
        isActive: true
      });
    }

    let inventoryItemId = null;
    if (injectionData.medication?.inventoryItem || injectionData.medication?.name) {
      if (injectionData.medication.inventoryItem) {
        const item = await PharmacyInventory.findById(injectionData.medication.inventoryItem);
        if (item) inventoryItemId = item._id;
      } else if (injectionData.medication.name) {
        const item = await PharmacyInventory.findOne({
          $or: [
            { 'medication.genericName': { $regex: new RegExp(injectionData.medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
            { 'medication.brandName': { $regex: new RegExp(injectionData.medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
          ],
          active: true,
          'inventory.currentStock': { $gt: 0 }
        });
        if (item) inventoryItemId = item._id;
      }
    }

    const transactionResult = await withTransactionRetry(async (session) => {
      const ivtInjectionData = {
        patient: patientId,
        clinic: req.user.currentClinicId || injectionData.clinic,
        ...injectionData,
        series: {
          ...injectionData.series,
          ...seriesInfo
        },
        performedBy: req.user._id,
        createdBy: req.user._id,
        status: 'scheduled'
      };

      const ivtInjection = await IVTInjection.createWithIntervalCheck(
        ivtInjectionData,
        { session, forceCreate: !!forceCreate }
      );

      // 2. Consume medication from inventory (within transaction with distributed lock)
      let inventoryConsumption = null;
      if (inventoryItemId) {
        // Use distributed lock to prevent race conditions across server instances
        const lockResult = await withLock(`vial:${inventoryItemId}`, async () => {
          // Re-fetch inventory item within session for transaction isolation
          const inventoryItem = await PharmacyInventory.findById(inventoryItemId).session(session || null);

          if (inventoryItem && inventoryItem.inventory.currentStock > 0) {
            // Use adjustStock method which supports session via save()
            const previousQuantity = inventoryItem.inventory.currentStock;
            inventoryItem.inventory.currentStock = Math.max(0, previousQuantity - 1);
            inventoryItem.inventory.available = Math.max(0, inventoryItem.inventory.currentStock - (inventoryItem.inventory.reserved || 0));

            // Update status based on new stock level
            inventoryItem.updateInventoryStatus();

            // Add transaction record
            inventoryItem.transactions.push({
              type: 'dispensed',
              quantity: -1,
              previousQuantity,
              newQuantity: inventoryItem.inventory.currentStock,
              reason: 'IVT injection consumption',
              reference: ivtInjection._id.toString(),
              referenceType: 'ivt_injection',
              performedBy: req.user._id,
              notes: `IVT ${ivtInjection.eye} - ${injectionData.medication?.name || 'medication'}`
            });

            // Update usage stats
            inventoryItem.usage.totalDispensed = (inventoryItem.usage.totalDispensed || 0) + 1;
            inventoryItem.usage.lastUsedDate = new Date();
            inventoryItem.updatedBy = req.user._id;
            inventoryItem.version += 1;

            await inventoryItem.save(session ? { session } : {});

            return {
              item: inventoryItem.medication?.genericName || inventoryItem.medication?.brandName || inventoryItem.name,
              quantity: 1,
              lotNumber: injectionData.medication?.lotNumber
            };
          } else {
            log.warn('Medication not found in inventory or out of stock', { medication: injectionData.medication?.name });
            return null;
          }
        }, { ttl: 30, maxRetries: 5, retryDelay: 200 });

        if (lockResult === null) {
          log.warn('Could not acquire lock for vial dispensing, operation may be in progress', { vialId: inventoryItemId });
        } else {
          inventoryConsumption = lockResult;
          if (inventoryConsumption) {
            log.info('Consumed medication from inventory', { medication: inventoryConsumption.item, ivtId: ivtInjection._id });
          }
        }
      }

      // 3. Auto-generate invoice (within transaction)
      let invoice = null;
      if (autoGenerateInvoice) {
        const invoiceItems = [];
        let totalAmount = 0;

        // Procedure fee
        const procedurePrice = procedureFeeSchedule?.price || injectionData.procedurePrice || 0;
        if (procedurePrice > 0) {
          invoiceItems.push({
            service: procedureFeeSchedule?._id,
            description: `Injection intravitréenne (IVT) - ${ivtInjection.eye}`,
            category: 'procedure',
            quantity: 1,
            unitPrice: procedurePrice,
            amount: procedurePrice,
            code: 'IVT'
          });
          totalAmount += procedurePrice;
        }

        // Medication cost
        const medicationPrice = medicationFeeSchedule?.price || injectionData.medication?.price || 0;
        if (medicationPrice > 0) {
          invoiceItems.push({
            service: medicationFeeSchedule?._id,
            description: `Médicament: ${medicationName} ${injectionData.medication?.dose || ''}`,
            category: 'medication',
            quantity: 1,
            unitPrice: medicationPrice,
            amount: medicationPrice,
            code: injectionData.medication?.code
          });
          totalAmount += medicationPrice;
        }

        if (invoiceItems.length > 0) {
          // Create invoice within transaction
          const invoiceDoc = new Invoice({
            patient: patientId,
            ivtInjection: ivtInjection._id,
            items: invoiceItems,
            summary: {
              subtotal: totalAmount,
              total: totalAmount,
              amountDue: totalAmount,
              amountPaid: 0
            },
            status: 'pending',
            type: 'procedure',
            notes: `IVT ${medicationName} - Œil: ${ivtInjection.eye} - ${injectionData.indication?.primary || ''}`,
            createdBy: req.user._id
          });

          await invoiceDoc.save(session ? { session } : {});
          invoice = invoiceDoc;

          // Apply convention billing if patient has company/convention
          // Note: This may involve additional reads, so we handle errors gracefully
          if (patient.convention?.company) {
            try {
              await invoice.applyCompanyBilling(
                patient.convention.company,
                req.user._id,
                null, // exchangeRateUSD
                { bypassWaitingPeriod: false, session }
              );
              log.info('Applied convention billing', { company: patient.convention.company });
            } catch (conventionError) {
              // Convention billing failed but invoice was created
              log.warn('Convention billing failed, patient will pay full amount', { error: conventionError.message });
              // Invoice remains without convention - patient pays 100%
            }
          }

          ivtInjection.invoice = invoice._id;
          await ivtInjection.save(session ? { session } : {});

          log.info('Auto-created invoice for IVT', { invoiceNumber: invoice.invoiceNumber || invoice._id, injectionId: ivtInjection.injectionId });
        }
      }

      // Return all results from the transaction
      return {
        ivtInjection,
        invoice,
        inventoryConsumption,
        validationWarnings: ivtInjection._validationWarnings
      };
    }, { maxRetries: 3 });

    // ========================================================================
    // POST-TRANSACTION PHASE
    // Operations that can happen after commit (audit logging, population)
    // ========================================================================

    const { ivtInjection, invoice, validationWarnings } = transactionResult;

    // Log the action (audit logging can happen after transaction)
    await logCriticalOperation(req, 'CREATE_IVT_INJECTION', {
      injectionId: ivtInjection.injectionId,
      patientId: patient._id,
      eye: ivtInjection.eye,
      medication: ivtInjection.medication?.name,
      invoiceId: invoice?._id
    });

    // Populate references for response
    await ivtInjection.populate('performedBy', 'firstName lastName role');
    await ivtInjection.populate('patient', 'firstName lastName patientId');

    // Build response
    const response = {
      success: true,
      data: ivtInjection,
      invoice: invoice ? {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.summary?.total,
        status: invoice.status
      } : null
    };

    if (validationWarnings && validationWarnings.length > 0) {
      response.warnings = validationWarnings;
    }

    res.status(201).json(response);
  } catch (error) {
    log.error('Error creating IVT injection', { error: error.message, stack: error.stack });

    if (error.name === 'IVTValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
        validationErrors: error.validationErrors,
        validationWarnings: error.validationWarnings,
        canForce: true
      });
    }

    if (error.name === 'IVTIntervalViolationError') {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
        canForce: true
      });
    }

    if (error.name === 'IVTDuplicateError') {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: error.code,
        existingInjectionId: error.existingInjection?.injectionId
      });
    }

    return serverError(res, 'Erreur lors de la création de l\'injection IVT');
  }
};

// @desc    Get all IVT injections with filters
// @route   GET /api/ivt
// @access  Private
exports.getIVTInjections = async (req, res) => {
  try {
    const {
      patientId,
      eye,
      indication,
      medication,
      status,
      startDate,
      endDate,
      protocol,
      limit = 50,
      page = 1
    } = req.query;

    const query = {};

    if (patientId) query.patient = patientId;
    if (eye) query.eye = eye;
    if (indication) query['indication.primary'] = indication;
    if (medication) {
      // Escape special regex characters to prevent ReDoS/injection attacks
      const escapedMedication = medication.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query['medication.name'] = new RegExp(escapedMedication, 'i');
    }
    if (status) query.status = status;
    if (protocol) query['series.protocol'] = protocol;

    if (startDate || endDate) {
      query.injectionDate = {};
      if (startDate) query.injectionDate.$gte = new Date(startDate);
      if (endDate) query.injectionDate.$lte = new Date(endDate);
    }

    const injections = await IVTInjection.find(query)
      .sort({ injectionDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('patient', 'firstName lastName patientId dateOfBirth')
      .populate('performedBy', 'firstName lastName role')
      .populate('visit')
      .populate('series.previousInjection', 'injectionDate medication.name');

    const total = await IVTInjection.countDocuments(query);

    res.json({
      success: true,
      count: injections.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: injections
    });
  } catch (error) {
    log.error('Error fetching IVT injections', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la récupération des injections IVT');
  }
};

// @desc    Get single IVT injection
// @route   GET /api/ivt/:id
// @access  Private
exports.getIVTInjection = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id)
      .populate('patient')
      .populate('performedBy', 'firstName lastName role')
      .populate('assistedBy', 'firstName lastName role')
      .populate('visit')
      .populate('appointment')
      .populate('series.previousInjection')
      .populate('series.initialInjection')
      .populate('consent.obtainedBy', 'firstName lastName');

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    log.error('Error fetching IVT injection', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la récupération de l\'injection IVT');
  }
};

// @desc    Update IVT injection
// @route   PUT /api/ivt/:id
// @access  Private (ophthalmologist only)
exports.updateIVTInjection = async (req, res) => {
  try {
    let injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    // Update injection
    injection = await IVTInjection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('patient')
      .populate('performedBy', 'firstName lastName role');

    // Log the action
    await logAction(req, 'UPDATE_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient._id
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    log.error('Error updating IVT injection', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la mise à jour de l\'injection IVT');
  }
};

// Protocol-based follow-up intervals (in weeks)
const PROTOCOL_FOLLOWUP_INTERVALS = {
  'loading': 4,              // Follow-up in 4 weeks for next loading dose
  'maintenance_monthly': 4,  // Monthly follow-up
  'maintenance_q6w': 6,      // Every 6 weeks
  'maintenance_q8w': 8,      // Every 8 weeks
  'maintenance_q12w': 12,    // Every 12 weeks
  'PRN': 4,                  // PRN typically 4-week follow-up to assess
  'treat_and_extend': 4,     // Start at 4 weeks, then extend
  'observe': 8,              // Observation every 8 weeks
  'other': 4
};

// @desc    Complete IVT injection
// @route   PUT /api/ivt/:id/complete
// @access  Private (ophthalmologist only)
exports.completeIVTInjection = async (req, res) => {
  try {
    const { autoScheduleFollowUp = true, customFollowUpDate, customFollowUpInterval } = req.body;

    const injection = await IVTInjection.findById(req.params.id)
      .populate('patient', 'firstName lastName patientId');

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.completeInjection(req.user._id);

    // Auto-schedule follow-up appointment
    let followUpAppointment = null;
    let nextInjectionPlan = null;

    if (autoScheduleFollowUp) {
      try {
        // Calculate follow-up date based on protocol
        const protocol = injection.series?.protocol || 'other';
        const followUpWeeks = customFollowUpInterval || PROTOCOL_FOLLOWUP_INTERVALS[protocol] || 4;

        const followUpDate = customFollowUpDate
          ? new Date(customFollowUpDate)
          : new Date(injection.injectionDate);

        if (!customFollowUpDate) {
          followUpDate.setDate(followUpDate.getDate() + (followUpWeeks * 7));
        }

        // Create follow-up appointment
        const appointmentData = {
          patient: injection.patient._id,
          provider: injection.performedBy,
          date: followUpDate,
          startTime: '09:00', // Default morning slot
          endTime: '09:30',
          type: 'follow-up',
          department: 'ophthalmology',
          reason: `IVT Follow-up (${injection.medication.name} - ${injection.eye})`,
          status: 'scheduled',
          priority: 'normal',
          notes: `Follow-up for IVT injection ${injection.injectionId}. Protocol: ${protocol}. Eye: ${injection.eye}.`,
          createdBy: req.user._id
        };

        // Check for conflicts before creating
        const tempAppointment = new Appointment(appointmentData);
        const hasConflict = await tempAppointment.hasConflict();

        if (!hasConflict) {
          followUpAppointment = await Appointment.create(appointmentData);

          // Update injection with follow-up info
          injection.followUp.scheduled = true;
          injection.followUp.scheduledDate = followUpDate;
          injection.followUp.appointmentId = followUpAppointment._id;
          await injection.save();
        } else {
          // Try alternative time slots
          const alternativeSlots = ['10:00', '11:00', '14:00', '15:00', '16:00'];
          for (const slot of alternativeSlots) {
            appointmentData.startTime = slot;
            const [hours, minutes] = slot.split(':').map(Number);
            appointmentData.endTime = `${String(hours).padStart(2, '0')}:${String(minutes + 30).padStart(2, '0')}`;

            const altAppointment = new Appointment(appointmentData);
            const altHasConflict = await altAppointment.hasConflict();

            if (!altHasConflict) {
              followUpAppointment = await Appointment.create(appointmentData);
              injection.followUp.scheduled = true;
              injection.followUp.scheduledDate = followUpDate;
              injection.followUp.appointmentId = followUpAppointment._id;
              await injection.save();
              break;
            }
          }
        }

        // Plan next injection based on protocol
        if (protocol !== 'observe') {
          const nextInjectionDate = new Date(followUpDate);

          // For loading phase, next injection is same as follow-up
          // For maintenance, calculate based on protocol interval
          let recommendedInterval = followUpWeeks;

          if (protocol === 'treat_and_extend') {
            // If disease is controlled (would need outcome data), extend by 2 weeks
            // Default: keep same interval until follow-up assessment
            recommendedInterval = injection.series.intervalFromLast
              ? Math.min(injection.series.intervalFromLast + 2, 16) // Max 16 weeks
              : followUpWeeks;
          }

          nextInjectionPlan = {
            recommended: true,
            recommendedDate: nextInjectionDate,
            recommendedInterval: recommendedInterval,
            reasoning: `Based on ${protocol} protocol, next injection recommended in ${recommendedInterval} weeks.`
          };

          injection.nextInjection = nextInjectionPlan;
          await injection.save();
        }
      } catch (followUpError) {
        log.error('Error scheduling follow-up', { error: followUpError.message, stack: followUpError.stack });
        // Don't fail the completion, just log the error
        // Store warning for response
        injection.followUpWarning = `Follow-up scheduling failed: ${followUpError.message}`;
      }
    }

    // Check if follow-up was requested but not scheduled (due to conflicts)
    const followUpWarning = autoScheduleFollowUp && !followUpAppointment
      ? 'Follow-up appointment could not be scheduled automatically. Please schedule manually.'
      : null;

    // Log the action
    await logCriticalOperation(req, 'COMPLETE_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient._id || injection.patient,
      eye: injection.eye,
      medication: injection.medication.name,
      followUpScheduled: !!followUpAppointment
    });

    res.json({
      success: true,
      data: injection,
      followUpAppointment: followUpAppointment ? {
        _id: followUpAppointment._id,
        appointmentId: followUpAppointment.appointmentId,
        date: followUpAppointment.date,
        startTime: followUpAppointment.startTime
      } : null,
      nextInjectionPlan,
      warning: followUpWarning // Include warning if follow-up couldn't be scheduled
    });
  } catch (error) {
    log.error('Error completing IVT injection', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la finalisation de l\'injection IVT');
  }
};

// @desc    Cancel IVT injection
// @route   PUT /api/ivt/:id/cancel
// @access  Private (ophthalmologist only)
exports.cancelIVTInjection = async (req, res) => {
  try {
    const { reason } = req.body;

    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.cancelInjection(reason);

    // Log the action
    await logAction(req, 'CANCEL_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient,
      reason
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    log.error('Error cancelling IVT injection', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de l\'annulation de l\'injection IVT');
  }
};

// @desc    Record follow-up for IVT injection
// @route   PUT /api/ivt/:id/followup
// @access  Private
exports.recordFollowUp = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.recordFollowUp(req.body);

    // Log the action
    await logAction(req, 'RECORD_IVT_FOLLOWUP', {
      injectionId: injection.injectionId,
      patientId: injection.patient
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    log.error('Error recording follow-up', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de l\'enregistrement du suivi');
  }
};

// @desc    Plan next IVT injection
// @route   PUT /api/ivt/:id/plan-next
// @access  Private (ophthalmologist only)
exports.planNextInjection = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.planNextInjection(req.body);

    // Log the action
    await logAction(req, 'PLAN_NEXT_IVT', {
      injectionId: injection.injectionId,
      patientId: injection.patient,
      recommendedDate: req.body.recommendedDate
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    log.error('Error planning next injection', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la planification de l\'injection suivante');
  }
};

// @desc    Get patient's IVT injection history
// @route   GET /api/ivt/patient/:patientId/history
// @access  Private
exports.getPatientIVTHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { eye } = req.query;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const injections = await IVTInjection.getPatientInjections(patientId, eye);

    res.json({
      success: true,
      count: injections.length,
      data: injections
    });
  } catch (error) {
    log.error('Error fetching patient IVT history', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la récupération de l\'historique IVT');
  }
};

// @desc    Get treatment history with outcomes
// @route   GET /api/ivt/patient/:patientId/treatment-history
// @access  Private
exports.getTreatmentHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { eye } = req.query;

    if (!eye) {
      return res.status(400).json({
        success: false,
        message: 'Eye parameter is required'
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const history = await IVTInjection.getTreatmentHistory(patientId, eye);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    log.error('Error fetching treatment history', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la récupération de l\'historique de traitement');
  }
};

// @desc    Get upcoming IVT injections
// @route   GET /api/ivt/upcoming
// @access  Private
exports.getUpcomingInjections = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const upcoming = await IVTInjection.getUpcomingInjections(parseInt(days));

    res.json({
      success: true,
      count: upcoming.length,
      data: upcoming
    });
  } catch (error) {
    log.error('Error fetching upcoming injections', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la récupération des injections à venir');
  }
};

// @desc    Get patients due for injection
// @route   GET /api/ivt/due
// @access  Private
exports.getPatientsDue = async (req, res) => {
  try {
    const patientsDue = await IVTInjection.getPatientDueForInjection();

    res.json({
      success: true,
      count: patientsDue.length,
      data: patientsDue
    });
  } catch (error) {
    log.error('Error fetching patients due', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la récupération des patients en attente');
  }
};

// @desc    Get IVT statistics
// @route   GET /api/ivt/stats
// @access  Private
exports.getIVTStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await IVTInjection.getStatsByIndication(start, end);

    // Get overall stats
    const totalInjections = await IVTInjection.countDocuments({
      injectionDate: { $gte: start, $lte: end },
      status: 'completed'
    });

    const complicationRate = await IVTInjection.aggregate([
      {
        $match: {
          injectionDate: { $gte: start, $lte: end },
          status: 'completed'
        }
      },
      {
        $project: {
          hasComplications: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$procedure.complications',
                    cond: { $ne: ['$$this.type', 'none'] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withComplications: { $sum: { $cond: ['$hasComplications', 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalInjections,
        byIndication: stats,
        complicationRate: complicationRate.length > 0
          ? (complicationRate[0].withComplications / complicationRate[0].total) * 100
          : 0,
        period: { start, end }
      }
    });
  } catch (error) {
    log.error('Error fetching IVT stats', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la récupération des statistiques');
  }
};

// @desc    Delete IVT injection
// @route   DELETE /api/ivt/:id
// @access  Private (admin only)
exports.deleteIVTInjection = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    // Only allow deletion of scheduled injections
    if (injection.status !== 'scheduled' && injection.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed injections'
      });
    }

    // Soft delete instead of hard delete for audit trail
    injection.isDeleted = true;
    injection.deletedAt = new Date();
    injection.deletedBy = req.user._id;
    await injection.save();

    // Log the action
    await logCriticalOperation(req, 'DELETE_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient
    });

    res.json({
      success: true,
      message: 'IVT injection deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting IVT injection', { error: error.message, stack: error.stack });
    return serverError(res, 'Erreur lors de la suppression de l\'injection IVT');
  }
};
