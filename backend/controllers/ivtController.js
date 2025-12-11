const IVTInjection = require('../models/IVTInjection');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const FeeSchedule = require('../models/FeeSchedule');
const PharmacyInventory = require('../models/PharmacyInventory');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { asyncHandler } = require('../middleware/errorHandler');

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
    console.error('Error validating IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error validating IVT injection',
      error: error.message
    });
  }
};

// @desc    Create new IVT injection record
// @route   POST /api/ivt
// @access  Private (ophthalmologist only)
exports.createIVTInjection = async (req, res) => {
  try {
    const { patientId, forceCreate, autoGenerateInvoice = true, ...injectionData } = req.body;

    // Validate patient exists (with convention for billing)
    const patient = await Patient.findById(patientId).populate('convention');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get previous injection for this eye to establish series
    const previousInjection = await IVTInjection.findOne({
      patient: patientId,
      eye: injectionData.eye,
      status: 'completed'
    }).sort({ injectionDate: -1 });

    // Calculate series information
    const seriesInfo = {
      injectionNumber: injectionData.series?.injectionNumber || 1,
      protocol: injectionData.series?.protocol || 'loading',
      previousInjection: previousInjection?._id,
      initialInjection: previousInjection?.series?.initialInjection || null,
      totalInjectionsThisEye: previousInjection ? (previousInjection.series.totalInjectionsThisEye || 0) + 1 : 1
    };

    // Calculate interval from last injection
    if (previousInjection) {
      const daysDiff = Math.floor((new Date() - previousInjection.injectionDate) / (1000 * 60 * 60 * 24));
      seriesInfo.intervalFromLast = Math.round(daysDiff / 7); // weeks
    }

    // Create IVT injection document
    const ivtInjection = new IVTInjection({
      patient: patientId,
      ...injectionData,
      series: {
        ...injectionData.series,
        ...seriesInfo
      },
      performedBy: req.user._id,
      status: 'scheduled'
    });

    // Set force flag if bypassing validation
    if (forceCreate) {
      ivtInjection._forceCreate = true;
    }

    await ivtInjection.save();

    // CRITICAL FIX: Consume medication from inventory
    let inventoryConsumption = null;
    if (ivtInjection.medication?.inventoryItem || ivtInjection.medication?.name) {
      try {
        // Try to find the medication in inventory
        let inventoryItem = null;

        if (ivtInjection.medication.inventoryItem) {
          inventoryItem = await PharmacyInventory.findById(ivtInjection.medication.inventoryItem);
        } else if (ivtInjection.medication.name) {
          // Search by medication name
          inventoryItem = await PharmacyInventory.findOne({
            $or: [
              { 'medication.genericName': { $regex: new RegExp(ivtInjection.medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
              { 'medication.brandName': { $regex: new RegExp(ivtInjection.medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
            ],
            active: true,
            'inventory.currentStock': { $gt: 0 }
          });
        }

        if (inventoryItem) {
          // Consume 1 unit of the medication
          await inventoryItem.dispenseMedication(
            1, // IVT uses 1 vial/unit per injection
            ivtInjection._id,
            patientId,
            req.user._id,
            ivtInjection.medication.lotNumber || null
          );

          inventoryConsumption = {
            item: inventoryItem.medication?.genericName || inventoryItem.medication?.brandName,
            quantity: 1,
            lotNumber: ivtInjection.medication.lotNumber
          };

          console.log(`[IVT] Consumed medication from inventory: ${inventoryItem.medication?.genericName}`);
        } else {
          console.log(`[IVT] Warning: Medication ${ivtInjection.medication?.name} not found in inventory`);
        }
      } catch (invError) {
        console.error('[IVT] Error consuming medication from inventory:', invError);
        // Continue without failing - log the error but don't block IVT creation
      }
    }

    // AUTO-GENERATE INVOICE for IVT
    let invoice = null;
    if (autoGenerateInvoice) {
      try {
        // Get medication and procedure pricing
        const medicationName = ivtInjection.medication?.name || 'Anti-VEGF';
        const invoiceItems = [];
        let totalAmount = 0;

        // Find fee schedule for IVT procedure
        const procedureFeeSchedule = await FeeSchedule.findOne({
          $or: [
            { code: 'IVT' },
            { aliases: 'IVT' },
            { name: { $regex: /IVT|injection.*intravitréenne/i } }
          ],
          isActive: true
        });

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

        // Find fee schedule for the medication
        const medicationFeeSchedule = await FeeSchedule.findOne({
          $or: [
            { name: { $regex: new RegExp(medicationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
            { aliases: { $regex: new RegExp(medicationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
          ],
          isActive: true
        });

        // Medication cost
        const medicationPrice = medicationFeeSchedule?.price || ivtInjection.medication?.price || 0;
        if (medicationPrice > 0) {
          invoiceItems.push({
            service: medicationFeeSchedule?._id,
            description: `Médicament: ${medicationName} ${ivtInjection.medication?.dose || ''}`,
            category: 'medication',
            quantity: 1,
            unitPrice: medicationPrice,
            amount: medicationPrice,
            code: ivtInjection.medication?.code
          });
          totalAmount += medicationPrice;
        }

        if (invoiceItems.length > 0) {
          // Create invoice first with basic info
          invoice = await Invoice.create({
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
            notes: `IVT ${medicationName} - Œil: ${ivtInjection.eye} - ${ivtInjection.indication?.primary || ''}`,
            createdBy: req.user._id
          });

          // CRITICAL FIX: Apply proper convention billing if patient has company/convention
          // This uses the full convention billing logic with contract validation,
          // waiting periods, category coverage, and approval requirements
          if (patient.convention?.company) {
            try {
              await invoice.applyCompanyBilling(
                patient.convention.company,
                req.user._id,
                null, // exchangeRateUSD
                { bypassWaitingPeriod: false }
              );
              console.log(`[IVT] Applied convention billing for company ${patient.convention.company}`);
            } catch (conventionError) {
              // Convention billing failed but invoice was created
              console.warn(`[IVT] Convention billing failed: ${conventionError.message}. Patient will pay full amount.`);
              // Invoice remains without convention - patient pays 100%
            }
          }

          // Update IVT with invoice reference
          ivtInjection.invoice = invoice._id;
          await ivtInjection.save();

          console.log(`[IVT] Auto-created invoice ${invoice.invoiceNumber || invoice._id} for IVT ${ivtInjection.injectionId}`);
        }
      } catch (invoiceError) {
        console.error('[IVT] Error auto-generating invoice:', invoiceError);
        // Continue without failing - invoice can be created manually
      }
    }

    // Log the action
    await logCriticalOperation(req, 'CREATE_IVT_INJECTION', {
      injectionId: ivtInjection.injectionId,
      patientId: patient._id,
      eye: ivtInjection.eye,
      medication: ivtInjection.medication.name,
      invoiceId: invoice?._id
    });

    // Populate references
    await ivtInjection.populate('performedBy', 'firstName lastName role');
    await ivtInjection.populate('patient', 'firstName lastName patientId');

    // Include validation warnings in response if any
    const response = {
      success: true,
      data: ivtInjection,
      invoice: invoice ? {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        status: invoice.status
      } : null
    };

    if (ivtInjection._validationWarnings && ivtInjection._validationWarnings.length > 0) {
      response.warnings = ivtInjection._validationWarnings;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating IVT injection:', error);

    // Handle IVT validation errors specially
    if (error.name === 'IVTValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
        validationErrors: error.validationErrors,
        validationWarnings: error.validationWarnings,
        canForce: true // Indicate that forceCreate can bypass this
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error creating IVT injection',
      error: error.message
    });
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
    console.error('Error fetching IVT injections:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching IVT injections',
      error: error.message
    });
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
    console.error('Error fetching IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching IVT injection',
      error: error.message
    });
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
    console.error('Error updating IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating IVT injection',
      error: error.message
    });
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
        console.error('Error scheduling follow-up:', followUpError);
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
    console.error('Error completing IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error completing IVT injection',
      error: error.message
    });
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
    console.error('Error cancelling IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling IVT injection',
      error: error.message
    });
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
    console.error('Error recording follow-up:', error);
    res.status(500).json({
      success: false,
      message: 'Server error recording follow-up',
      error: error.message
    });
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
    console.error('Error planning next injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error planning next injection',
      error: error.message
    });
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
    console.error('Error fetching patient IVT history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient IVT history',
      error: error.message
    });
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
    console.error('Error fetching treatment history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching treatment history',
      error: error.message
    });
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
    console.error('Error fetching upcoming injections:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching upcoming injections',
      error: error.message
    });
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
    console.error('Error fetching patients due:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patients due for injection',
      error: error.message
    });
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
    console.error('Error fetching IVT stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching statistics',
      error: error.message
    });
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

    await injection.deleteOne();

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
    console.error('Error deleting IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting IVT injection',
      error: error.message
    });
  }
};
