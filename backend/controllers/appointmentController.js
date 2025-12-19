const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Counter = require('../models/Counter');
const ProviderAvailability = require('../models/ProviderAvailability');
const WaitingList = require('../models/WaitingList');
const AppointmentType = require('../models/AppointmentType');
const User = require('../models/User');
const notificationFacade = require('../services/notificationFacade');
const { asyncHandler } = require('../middleware/errorHandler');
const websocketService = require('../services/websocketService');
const { getTodayRange, getDayRange } = require('../utils/dateUtils');
const { sanitizeForAssign } = require('../utils/sanitize');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { appointment: appointmentLogger } = require('../utils/structuredLogger');
const { APPOINTMENT, CANCELLATION, PAGINATION } = require('../config/constants');

// Appointment validation service for enhanced conflict detection
let appointmentValidationService;
try {
  appointmentValidationService = require('../services/appointmentValidationService');
} catch (e) {
  appointmentLogger.warn('Appointment validation service not available', { error: e.message });
}

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private
exports.getAppointments = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    date,
    status,
    provider,
    department,
    type,
    sort = 'date'
  } = req.query;

  const query = {};

  // Filter by date - TIMEZONE FIX: Use timezone-aware date range
  if (date) {
    const { start: startDate, end: endDate } = getDayRange(date);
    query.date = { $gte: startDate, $lte: endDate };
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by provider
  if (provider) {
    query.provider = provider;
  }

  // Filter by department
  if (department) {
    query.department = department;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Role-based filtering
  if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    query.provider = req.user.id;
  }

  // Multi-clinic: Filter by clinic unless admin with accessAllClinics
  if (req.clinicId && !req.accessAllClinics) {
    query.clinic = req.clinicId;
  }

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('provider', 'firstName lastName specialization')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort)
    .lean(); // Performance: return plain JS objects for read-only list

  const count = await Appointment.countDocuments(query);

  res.status(200).json({
    success: true,
    count: appointments.length,
    total: count,
    pages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: appointments
  });
});

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient')
    .populate('provider', 'firstName lastName specialization department')
    .populate('createdBy updatedBy', 'firstName lastName');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  return success(res, { data: appointment });
});

// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private
exports.createAppointment = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  // Check if patient exists
  const patient = await findPatientByIdOrCode(req.body.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // CRITICAL FIX: Use atomic operation to prevent overbooking race condition
  // Instead of check-then-save which has a race window, use a unique constraint approach
  const appointmentData = {
    ...req.body,
    createdBy: req.user.id
  };

  // Generate a unique slot identifier for this provider/date/time combination
  const slotKey = `${req.body.provider}_${req.body.date}_${req.body.startTime}`;

  let appointment;
  try {
    // Try to create with optimistic concurrency
    // First, atomically check if slot is taken using findOneAndUpdate with upsert
    const existingConflict = await Appointment.findOne({
      provider: req.body.provider,
      date: req.body.date,
      startTime: req.body.startTime,
      status: { $nin: ['cancelled', 'no-show'] }
    });

    if (existingConflict) {
      return res.status(409).json({
        success: false,
        error: 'Ce créneau horaire est déjà réservé pour ce praticien',
        conflictingAppointment: {
          id: existingConflict._id,
          patient: existingConflict.patient
        }
      });
    }

    // Create the appointment
    appointment = new Appointment(appointmentData);

    // Double-check with hasConflict (includes duration overlap checking)
    const hasConflict = await appointment.hasConflict();
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        error: 'Ce créneau horaire chevauche un rendez-vous existant'
      });
    }

    await appointment.save();
  } catch (err) {
    // Handle duplicate key error (concurrent booking of same slot)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Ce créneau vient d\'être réservé par un autre utilisateur. Veuillez rafraîchir et réessayer.'
      });
    }
    throw err;
  }

  // Update patient's next appointment
  patient.nextAppointment = appointment.date;
  await patient.save();

  // PERFORMANCE FIX: Use single chained populate instead of sequential calls (N+1 query fix)
  await appointment.populate([
    { path: 'patient', select: 'firstName lastName patientId' },
    { path: 'provider', select: 'firstName lastName' }
  ]);

  // Emit WebSocket event for real-time updates
  websocketService.emitAppointmentUpdate({
    type: 'appointment_created',
    appointmentId: appointment._id,
    appointment: appointment
  });

  res.status(201).json({
    success: true,
    data: appointment
  });
});

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
exports.updateAppointment = asyncHandler(async (req, res, next) => {
  req.body.updatedBy = req.user.id;

  // Prevent updating certain fields
  delete req.body.appointmentId;
  delete req.body.createdAt;
  delete req.body.createdBy;

  // CRITICAL FIX: First fetch current appointment to validate status transitions
  const currentAppointment = await Appointment.findById(req.params.id);

  if (!currentAppointment) {
    return notFound(res, 'Appointment');
  }

  // Validate status transitions - terminal states cannot be changed
  const terminalStates = ['completed', 'cancelled', 'no-show'];
  if (req.body.status && terminalStates.includes(currentAppointment.status)) {
    // Allow admin override, but warn
    if (req.user.role !== 'admin') {
      return error(res, `Cannot change status of ${currentAppointment.status} appointment. Status is terminal.`);
    }
    appointmentLogger.warn('Admin changing terminal status', {
      userId: req.user.id,
      appointmentId: req.params.id,
      oldStatus: currentAppointment.status,
      newStatus: req.body.status
    });
  }

  // Prevent updating appointments in the past (except status changes by admin)
  const appointmentDate = new Date(currentAppointment.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (appointmentDate < today && req.user.role !== 'admin') {
    // Only allow status changes for past appointments
    const allowedFields = ['status', 'notes', 'updatedBy'];
    const attemptedFields = Object.keys(req.body);
    const disallowedFields = attemptedFields.filter(f => !allowedFields.includes(f));

    if (disallowedFields.length > 0) {
      return error(res, 'Cannot modify past appointments. Only status and notes can be updated.');
    }
  }

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  // Emit WebSocket event for real-time updates
  websocketService.emitAppointmentUpdate({
    type: 'appointment_updated',
    appointmentId: appointment._id,
    appointment: appointment
  });

  return success(res, { data: appointment });
});

// @desc    Cancel appointment
// @route   PUT /api/appointments/:id/cancel
// @access  Private
exports.cancelAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName email');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  // CRITICAL FIX: Enforce cancellation policy with time-based validation
  const appointmentDateTime = new Date(appointment.date);
  // Combine date with startTime if available
  if (appointment.startTime) {
    const [hours, minutes] = appointment.startTime.split(':');
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }

  const now = new Date();
  const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

  // Determine cancellation policy tier
  let cancellationType = 'standard';
  let cancellationFee = 0;
  let requiresApproval = false;

  if (hoursUntilAppointment < 0) {
    // Appointment already passed - mark as no-show instead
    cancellationType = 'no_show';
    return error(res, 'Ce rendez-vous est déjà passé. Utilisez l\'option "Non présenté" à la place.');
  } else if (hoursUntilAppointment < CANCELLATION.VERY_LATE_THRESHOLD_HOURS) {
    // Less than 2 hours - very late cancellation
    cancellationType = 'very_late';
    cancellationFee = CANCELLATION.VERY_LATE_FEE_PERCENT; // 100% fee or configured amount
    requiresApproval = true;
  } else if (hoursUntilAppointment < CANCELLATION.LATE_THRESHOLD_HOURS) {
    // Less than 24 hours - late cancellation
    cancellationType = 'late';
    cancellationFee = CANCELLATION.LATE_FEE_PERCENT; // 50% fee or configured amount
  } else if (hoursUntilAppointment < 48) {
    // Less than 48 hours - standard policy
    cancellationType = 'standard';
    cancellationFee = 0;
  }

  // If admin is cancelling, skip policy enforcement
  const isAdminOverride = req.user.role === 'admin' && req.body.adminOverride;

  // Require reason for late cancellations
  if (cancellationType !== 'standard' && !req.body.reason && !isAdminOverride) {
    return res.status(400).json({
      success: false,
      error: 'Une raison est requise pour les annulations tardives (moins de 48h avant)',
      cancellationType,
      hoursUntilAppointment: Math.round(hoursUntilAppointment * 10) / 10
    });
  }

  appointment.status = 'cancelled';
  appointment.cancellation = {
    cancelledAt: Date.now(),
    cancelledBy: req.user.id,
    reason: req.body.reason,
    // NEW: Policy tracking fields
    hoursBeforeAppointment: Math.round(hoursUntilAppointment * 10) / 10,
    cancellationType,
    cancellationFee,
    feeWaived: isAdminOverride,
    waivedBy: isAdminOverride ? req.user.id : null,
    waiverReason: req.body.waiverReason
  };
  appointment.updatedBy = req.user.id;

  await appointment.save();

  // Log late cancellations for tracking
  if (cancellationType !== 'standard') {
    appointmentLogger.info('Late cancellation', {
      patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
      cancellationType,
      hoursBeforeAppointment: hoursUntilAppointment.toFixed(1),
      appointmentId: appointment._id
    });
  }

  // Emit WebSocket event for real-time updates
  websocketService.emitAppointmentUpdate({
    type: 'appointment_cancelled',
    appointmentId: appointment._id,
    appointment: appointment
  });

  return success(res, { data: appointment, message: 'Appointment cancelled successfully' });
});

// @desc    Check in appointment
// @route   PUT /api/appointments/:id/checkin
// @access  Private
exports.checkInAppointment = asyncHandler(async (req, res, next) => {
  const Visit = require('../models/Visit');

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  // Check if already checked in
  if (appointment.status === 'checked-in' && appointment.visit) {
    const existingVisit = await Visit.findById(appointment.visit);
    return success(res, {
      data: {
        queueNumber: appointment.queueNumber,
        appointment,
        visit: existingVisit ? {
          _id: existingVisit._id,
          visitId: existingVisit.visitId,
          status: existingVisit.status
        } : null
      },
      message: 'Patient already checked in'
    });
  }

  appointment.status = 'checked-in';
  appointment.checkInTime = Date.now();
  appointment.queueNumber = await generateQueueNumber();
  appointment.updatedBy = req.user.id;

  await appointment.save();

  // CRITICAL FIX: Create Visit with 'checked-in' status (not 'in-progress')
  // This matches the queue controller behavior and correctly represents that
  // the patient is waiting, not yet being seen by a provider
  let visit = null;
  if (!appointment.visit) {
    try {
      visit = await Visit.create({
        patient: appointment.patient._id || appointment.patient,
        appointment: appointment._id,
        visitDate: new Date(),
        visitType: appointment.type || 'consultation',
        chiefComplaint: {
          complaint: appointment.reason,
          duration: appointment.duration ? `${appointment.duration} min` : undefined
        },
        status: 'checked-in', // Patient is waiting, NOT in-progress
        checkInTime: new Date(),
        department: appointment.department,
        createdBy: req.user.id,
        updatedBy: req.user.id
      });

      // Capture convention snapshot at check-in time for consistent billing
      await visit.captureConventionSnapshot();

      // Link visit to appointment (bidirectional)
      appointment.visit = visit._id;
      await appointment.save();

      appointmentLogger.info('Visit created at check-in', {
        visitId: visit.visitId,
        status: 'checked-in',
        appointmentId: appointment._id
      });
    } catch (visitError) {
      appointmentLogger.error('Error creating visit', { error: visitError.message, appointmentId: appointment._id });
      // Continue - check-in still successful, visit can be created later
    }
  }

  // Send WebSocket notification for queue update
  // CRITICAL FIX: Use emitQueueUpdate() (notifyQueueUpdate doesn't exist)
  websocketService.emitQueueUpdate({
    event: 'patient_checked_in',
    appointmentId: appointment._id,
    patientId: appointment.patient?._id,
    queueNumber: appointment.queueNumber,
    visitId: visit?._id
  });

  return success(res, {
    data: {
      queueNumber: appointment.queueNumber,
      appointment,
      visit: visit ? {
        _id: visit._id,
        visitId: visit.visitId,
        status: visit.status
      } : null
    },
    message: 'Patient checked in successfully'
  });
});

// @desc    Start consultation (changes status to in-progress and creates/updates visit)
// @route   PUT /api/appointments/:id/start-consultation
// @access  Private (Doctor, Ophthalmologist)
exports.startConsultation = asyncHandler(async (req, res, next) => {
  const Visit = require('../models/Visit');

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  // Already in-progress - return existing visit (idempotent)
  if (appointment.status === 'in-progress' && appointment.visit) {
    const existingVisit = await Visit.findById(appointment.visit);
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patient', 'firstName lastName patientId phoneNumber')
      .populate('provider', 'firstName lastName specialization');

    return success(res, {
      data: {
        appointment: populatedAppointment,
        visit: existingVisit ? {
          _id: existingVisit._id,
          visitId: existingVisit.visitId,
          status: existingVisit.status
        } : null
      },
      message: 'Consultation already in progress'
    });
  }

  // Validate status transition
  if (!['checked-in', 'confirmed', 'scheduled'].includes(appointment.status)) {
    return error(res, `Cannot start consultation for appointment with status: ${appointment.status}`);
  }

  // Update appointment status
  appointment.status = 'in-progress';
  appointment.consultationStartTime = new Date();
  appointment.updatedBy = req.user.id;
  await appointment.save();

  let visit = null;

  // Case 1: Visit already exists (from check-in) - just update status to in-progress
  if (appointment.visit) {
    visit = await Visit.findById(appointment.visit);
    if (visit && visit.status === 'checked-in') {
      visit.status = 'in-progress';
      visit.startTime = new Date();
      visit.primaryProvider = req.user.id;
      visit.updatedBy = req.user.id;
      await visit.save();
      appointmentLogger.info('Visit transitioned to in-progress', {
        visitId: visit.visitId,
        appointmentId: appointment._id
      });
    }
  }

  // Case 2: No visit yet - create one (backwards compatibility)
  if (!visit) {
    try {
      visit = await Visit.create({
        patient: appointment.patient._id || appointment.patient,
        appointment: appointment._id,
        visitDate: new Date(),
        visitType: appointment.type || 'consultation',
        primaryProvider: req.user.id,
        chiefComplaint: {
          complaint: appointment.reason,
          duration: appointment.duration ? `${appointment.duration} min` : undefined
        },
        status: 'in-progress',
        startTime: new Date(),
        createdBy: req.user.id,
        updatedBy: req.user.id
      });

      // Capture convention snapshot
      await visit.captureConventionSnapshot();

      // Link visit to appointment
      appointment.visit = visit._id;
      await appointment.save();

      appointmentLogger.info('New visit created at consultation start', {
        visitId: visit.visitId,
        status: 'in-progress',
        appointmentId: appointment._id
      });
    } catch (visitError) {
      appointmentLogger.error('Error creating visit', { error: visitError, appointmentId: appointment._id });
      appointment.status = 'checked-in';
      appointment.consultationStartTime = undefined;
      await appointment.save();

      return res.status(500).json({
        success: false,
        error: 'Failed to create visit record',
        details: visitError.message
      });
    }
  }

  // Calculate waiting time
  if (appointment.checkInTime) {
    appointment.calculateWaitingTime();
    await appointment.save();
  }

  // Populate for response
  const populatedAppointment = await Appointment.findById(appointment._id)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('provider', 'firstName lastName specialization');

  return success(res, {
    data: {
      appointment: populatedAppointment,
      visit: visit ? {
        _id: visit._id,
        visitId: visit.visitId,
        status: visit.status
      } : null
    },
    message: 'Consultation started successfully'
  });
});

// @desc    Complete appointment
// @route   PUT /api/appointments/:id/complete
// @access  Private (Doctor, Ophthalmologist)
exports.completeAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  appointment.status = 'completed';
  appointment.consultationEndTime = Date.now();
  appointment.outcome = req.body.outcome || {};
  appointment.updatedBy = req.user.id;

  // Calculate waiting time if checked in
  if (appointment.checkInTime && appointment.consultationStartTime) {
    appointment.calculateWaitingTime();
  }

  await appointment.save();

  // If appointment has linked visit, complete the visit too (cascade)
  if (appointment.visit) {
    const Visit = require('../models/Visit');
    const visit = await Visit.findById(appointment.visit);

    if (visit && visit.status !== 'completed') {
      // Complete the visit (triggers invoice generation, inventory reservation)
      try {
        await visit.completeVisit(req.user.id);
        appointmentLogger.info('Visit auto-completed from appointment completion', { visitId: visit.visitId });
      } catch (err) {
        appointmentLogger.error('Error auto-completing visit', { error: err, visitId: visit.visitId });
        // Don't fail appointment completion if visit completion fails
      }
    }
  }

  // Update patient's last visit
  await Patient.findByIdAndUpdate(appointment.patient, {
    lastVisit: Date.now()
  });

  return success(res, { data: appointment, message: 'Appointment completed successfully' });
});

// @desc    Get available time slots
// @route   GET /api/appointments/available-slots
// @access  Private
exports.getAvailableSlots = asyncHandler(async (req, res, next) => {
  const { date, provider, duration = APPOINTMENT.DEFAULT_DURATION_MINUTES } = req.query;

  if (!date || !provider) {
    return error(res, 'Date and provider are required');
  }

  // Get provider's availability configuration
  let availability;
  try {
    availability = await ProviderAvailability.getOrCreateDefault(provider);
  } catch (err) {
    // Fall back to default if model not available
    availability = null;
  }

  let workingHours;
  if (availability) {
    const daySchedule = availability.getWorkingHoursForDate(date);
    if (!daySchedule.isWorkingDay || daySchedule.shifts.length === 0) {
      return success(res, { data: [], message: 'Provider not available on this date' });
    }
    // Use first shift for simplicity (can be extended for multiple shifts)
    const primaryShift = daySchedule.shifts[0];
    const primaryBreak = daySchedule.breaks[0];
    workingHours = {
      start: primaryShift.startTime,
      end: primaryShift.endTime,
      breakStart: primaryBreak?.startTime || null,
      breakEnd: primaryBreak?.endTime || null
    };
  } else {
    // Fallback to default working hours
    workingHours = {
      start: '09:00',
      end: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    };
  }

  // Get existing appointments for the date and provider
  // TIMEZONE FIX: Use timezone-aware date range
  const { start: startDate, end: endDate } = getDayRange(date);

  const appointments = await Appointment.find({
    provider,
    date: { $gte: startDate, $lte: endDate },
    status: { $nin: ['cancelled', 'no-show'] }
  }).select('startTime endTime');

  // Generate available slots
  const slots = generateTimeSlots(workingHours, appointments, duration);

  return success(res, { data: slots });
});

// @desc    Get today's appointments
// @route   GET /api/appointments/today
// @access  Private
exports.getTodaysAppointments = asyncHandler(async (req, res, next) => {
  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today, end: tomorrow } = getTodayRange();

  const query = {
    date: { $gte: today, $lte: tomorrow }
  };

  // Role-based filtering
  if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    query.provider = req.user.id;
  }

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('provider', 'firstName lastName')
    .sort('startTime');

  const stats = {
    total: appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    checkedIn: appointments.filter(a => a.status === 'checked-in').length,
    inProgress: appointments.filter(a => a.status === 'in-progress').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no-show').length
  };

  res.status(200).json({
    success: true,
    stats,
    data: appointments
  });
});

// @desc    Reschedule appointment
// @route   PUT /api/appointments/:id/reschedule
// @access  Private
exports.rescheduleAppointment = asyncHandler(async (req, res, next) => {
  const { date, startTime, endTime } = req.body;

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  // Store old date/time for rescheduling record
  const oldDate = appointment.date;
  const oldTime = appointment.startTime;

  // Update appointment
  appointment.date = date;
  appointment.startTime = startTime;
  appointment.endTime = endTime;
  appointment.rescheduled = {
    from: oldDate,
    to: date,
    by: req.user.id,
    reason: req.body.reason,
    count: (appointment.rescheduled?.count || 0) + 1
  };
  appointment.updatedBy = req.user.id;

  // Check for conflicts
  const hasConflict = await appointment.hasConflict();

  if (hasConflict) {
    return res.status(409).json({
      success: false,
      error: 'Time slot already booked for this provider'
    });
  }

  await appointment.save();

  return success(res, { data: appointment, message: 'Appointment rescheduled successfully' });
});

// Helper functions
// FIXED: Atomic queue number generation using Counter model
// Prevents race conditions when multiple patients check in simultaneously
async function generateQueueNumber() {
  // Use Counter model's helper to get today's counter ID
  const counterId = Counter.getTodayQueueCounterId();

  // Get next sequence number atomically (thread-safe)
  const queueNumber = await Counter.getNextSequence(counterId);

  return queueNumber;
}

function generateTimeSlots(workingHours, appointments, duration) {
  const slots = [];
  const { start, end, breakStart, breakEnd } = workingHours;

  // Convert times to minutes for easier calculation
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const breakStartMin = breakStart ? timeToMinutes(breakStart) : null;
  const breakEndMin = breakEnd ? timeToMinutes(breakEnd) : null;

  for (let time = startMin; time < endMin; time += duration) {
    // Skip break time if defined
    if (breakStartMin && breakEndMin && time >= breakStartMin && time < breakEndMin) {
      continue;
    }

    const slotStart = minutesToTime(time);
    const slotEnd = minutesToTime(time + duration);

    // Check if slot is available
    const isBooked = appointments.some(apt => {
      return (apt.startTime === slotStart) ||
             (apt.startTime < slotEnd && apt.endTime > slotStart);
    });

    if (!isBooked) {
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        available: true
      });
    }
  }

  return slots;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// =====================================================
// NEW ENDPOINTS FOR MISSING FUNCTIONALITY
// =====================================================

// @desc    Get appointments by provider
// @route   GET /api/appointments/provider/:providerId
// @access  Private
exports.getAppointmentsByProvider = asyncHandler(async (req, res, next) => {
  const { providerId } = req.params;
  const { startDate, endDate, status, page = 1, limit = 20 } = req.query;

  const query = { provider: providerId };

  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  if (status) {
    query.status = status;
  }

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ date: 1, startTime: 1 });

  const count = await Appointment.countDocuments(query);

  res.status(200).json({
    success: true,
    count: appointments.length,
    total: count,
    pages: Math.ceil(count / limit),
    data: appointments
  });
});

// @desc    Get appointments by patient
// @route   GET /api/appointments/patient/:patientId
// @access  Private
exports.getAppointmentsByPatient = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  const query = { patient: patientId };

  if (status) {
    query.status = status;
  }

  const appointments = await Appointment.find(query)
    .populate('provider', 'firstName lastName specialization')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ date: -1 });

  const count = await Appointment.countDocuments(query);

  res.status(200).json({
    success: true,
    count: appointments.length,
    total: count,
    pages: Math.ceil(count / limit),
    data: appointments
  });
});

// @desc    Get upcoming appointments
// @route   GET /api/appointments/upcoming
// @access  Private
exports.getUpcomingAppointments = asyncHandler(async (req, res, next) => {
  const { days = 7 } = req.query;

  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today } = getTodayRange();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + parseInt(days));
  endDate.setHours(23, 59, 59, 999);

  const query = {
    date: { $gte: today, $lte: endDate },
    status: { $in: ['scheduled', 'confirmed'] }
  };

  // Role-based filtering
  if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    query.provider = req.user.id;
  }

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('provider', 'firstName lastName')
    .sort({ date: 1, startTime: 1 });

  return success(res, { data: appointments });
});

// @desc    Get appointment statistics
// @route   GET /api/appointments/statistics
// @access  Private
exports.getAppointmentStatistics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, provider, department } = req.query;

  const matchQuery = {};

  if (startDate && endDate) {
    matchQuery.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  if (provider) {
    matchQuery.provider = require('mongoose').Types.ObjectId(provider);
  }

  if (department) {
    matchQuery.department = department;
  }

  const stats = await Appointment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        noShow: {
          $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
        },
        avgWaitingTime: { $avg: '$waitingTime' }
      }
    }
  ]);

  const byStatus = await Appointment.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const byType = await Appointment.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);

  const byDepartment = await Appointment.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$department', count: { $sum: 1 } } }
  ]);

  return success(res, {
    data: {
      overview: stats[0] || {
        total: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        avgWaitingTime: 0
      },
      byStatus,
      byType,
      byDepartment
    }
  });
});

// @desc    Send appointment reminder
// @route   POST /api/appointments/:id/reminder
// @access  Private
exports.sendReminder = asyncHandler(async (req, res, next) => {
  const { method = 'email' } = req.body;

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName email phoneNumber')
    .populate('provider', 'firstName lastName');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  // Create reminder record
  const reminder = {
    type: method,
    scheduledFor: new Date(),
    sent: false
  };

  try {
    if (method === 'email' && appointment.patient.email) {
      const result = await notificationFacade.sendEmail(
        appointment.patient.email,
        `Rappel de rendez-vous - ${new Date(appointment.date).toLocaleDateString('fr-FR')}`,
        'appointmentReminder',
        {
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          date: new Date(appointment.date).toLocaleDateString('fr-FR'),
          time: appointment.startTime,
          provider: `Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}`,
          department: appointment.department,
          preparation: appointment.preparation?.instructions || ''
        }
      );

      if (result.success) {
        reminder.sent = true;
        reminder.sentAt = new Date();
        reminder.status = 'sent';
      } else {
        throw new Error(result.error || 'Email send failed');
      }
    } else if (method === 'sms' && appointment.patient.phoneNumber) {
      // Use notification facade for SMS
      const result = await notificationFacade.sendAppointmentReminder(appointment, appointment.patient);
      if (result.sms?.success) {
        reminder.sent = true;
        reminder.sentAt = new Date();
        reminder.status = 'sent';
      } else {
        reminder.status = 'failed';
        reminder.error = result.sms?.error || 'SMS send failed';
      }
    }
  } catch (err) {
    reminder.status = 'failed';
    reminder.error = err.message;
  }

  appointment.reminders.push(reminder);
  await appointment.save();

  return success(res, { data: reminder, message: reminder.sent ? 'Reminder sent successfully' : 'Reminder queued' });
});

// @desc    Add note to appointment
// @route   POST /api/appointments/:id/notes
// @access  Private
exports.addNote = asyncHandler(async (req, res, next) => {
  const { content, isInternal = false } = req.body;

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  if (isInternal) {
    appointment.internalNotes = appointment.internalNotes
      ? `${appointment.internalNotes}\n\n[${new Date().toISOString()}] ${content}`
      : `[${new Date().toISOString()}] ${content}`;
  } else {
    appointment.notes = appointment.notes
      ? `${appointment.notes}\n\n[${new Date().toISOString()}] ${content}`
      : `[${new Date().toISOString()}] ${content}`;
  }

  appointment.updatedBy = req.user.id;
  await appointment.save();

  return success(res, { data: appointment, message: 'Note added successfully' });
});

// @desc    Get appointment notes
// @route   GET /api/appointments/:id/notes
// @access  Private
exports.getNotes = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id)
    .select('notes internalNotes');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  return success(res, {
    data: {
      notes: appointment.notes,
      internalNotes: appointment.internalNotes
    }
  });
});

// @desc    Mark appointment as no-show
// @route   PUT /api/appointments/:id/no-show
// @access  Private
exports.markNoShow = asyncHandler(async (req, res, next) => {
  const Visit = require('../models/Visit');
  const Room = require('../models/Room');

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  const previousStatus = appointment.status;
  appointment.status = 'no-show';
  appointment.noShowAt = new Date();
  appointment.updatedBy = req.user.id;
  await appointment.save();

  // CASCADE 1: Update linked Visit to no-show
  let updatedVisit = null;
  if (appointment.visit) {
    updatedVisit = await Visit.findById(appointment.visit);
    if (updatedVisit && !['completed', 'cancelled'].includes(updatedVisit.status)) {
      updatedVisit.status = 'no-show';
      updatedVisit.noShowAt = new Date();
      updatedVisit.updatedBy = req.user.id;
      await updatedVisit.save();
      appointmentLogger.info('Visit marked as no-show', {
        visitId: updatedVisit._id,
        appointmentId: appointment._id
      });
    }
  }

  // CASCADE 2: Release room if currently occupied by this appointment
  let roomReleased = false;
  if (appointment.room) {
    try {
      const room = await Room.findById(appointment.room);
      if (room && room.currentAppointment?.toString() === appointment._id.toString()) {
        // Room is currently occupied by this appointment - release it
        await room.release(false); // Don't update stats since consultation didn't happen
        roomReleased = true;
        appointmentLogger.info('Room released for no-show', {
          roomName: room.name,
          appointmentId: appointment._id
        });
      }
    } catch (roomError) {
      appointmentLogger.warn('Error releasing room', { error: roomError.message });
    }
  }

  // CASCADE 3: Remove from waiting list if present
  try {
    const waitingEntry = await WaitingList.findOne({
      patient: appointment.patient?._id || appointment.patient,
      status: 'waiting'
    });
    if (waitingEntry) {
      waitingEntry.status = 'no_show';
      waitingEntry.updatedBy = req.user.id;
      await waitingEntry.save();
      appointmentLogger.info('Patient removed from waiting list');
    }
  } catch (waitError) {
    appointmentLogger.warn('Error updating waiting list', { error: waitError.message });
  }

  // Send WebSocket notification
  // CRITICAL FIX: Use emitQueueUpdate() (notifyQueueUpdate doesn't exist)
  websocketService.emitQueueUpdate({
    event: 'appointment_no_show',
    appointmentId: appointment._id,
    patientId: appointment.patient?._id,
    previousStatus,
    newStatus: 'no-show',
    visitUpdated: !!updatedVisit,
    roomReleased
  });

  res.status(200).json({
    success: true,
    message: 'Appointment marked as no-show',
    data: appointment,
    cascade: {
      visitUpdated: !!updatedVisit,
      roomReleased
    }
  });
});

// @desc    Get waiting list
// @route   GET /api/appointments/waiting-list
// @access  Private
exports.getWaitingList = asyncHandler(async (req, res, next) => {
  const { department, status = 'waiting', priority, page = 1, limit = 20 } = req.query;

  const query = {};

  if (department) query.department = department;
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const waitingList = await WaitingList.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber email')
    .populate('requestedProvider', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ priority: -1, position: 1 });

  const count = await WaitingList.countDocuments(query);

  res.status(200).json({
    success: true,
    count: waitingList.length,
    total: count,
    pages: Math.ceil(count / limit),
    data: waitingList
  });
});

// @desc    Add to waiting list
// @route   POST /api/appointments/waiting-list
// @access  Private
exports.addToWaitingList = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  // Check if patient exists
  const patient = await findPatientByIdOrCode(req.body.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Check if already on waiting list for same department/type
  const existing = await WaitingList.findOne({
    patient: req.body.patient,
    department: req.body.department,
    appointmentType: req.body.appointmentType,
    status: 'waiting'
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'Patient already on waiting list for this type of appointment'
    });
  }

  const waitingListEntry = await WaitingList.create(req.body);

  await waitingListEntry.populate('patient', 'firstName lastName patientId');

  res.status(201).json({
    success: true,
    message: 'Added to waiting list',
    data: waitingListEntry
  });
});

// @desc    Remove from waiting list
// @route   DELETE /api/appointments/waiting-list/:id
// @access  Private
exports.removeFromWaitingList = asyncHandler(async (req, res, next) => {
  const entry = await WaitingList.findById(req.params.id);

  if (!entry) {
    return notFound(res, 'Waiting list entry');
  }

  entry.status = 'cancelled';
  entry.updatedBy = req.user.id;
  await entry.save();

  return success(res, { data: null, message: 'Removed from waiting list' });
});

// @desc    Get appointment types
// @route   GET /api/appointments/types
// @access  Private
exports.getAppointmentTypes = asyncHandler(async (req, res, next) => {
  const { category, department, onlineBookable } = req.query;

  const query = { active: true };

  if (category) query.category = category;
  if (department) query.department = department;
  if (onlineBookable === 'true') query['schedulingRules.allowOnline'] = true;

  const types = await AppointmentType.find(query)
    .sort({ priority: -1, name: 1 });

  res.status(200).json({
    success: true,
    count: types.length,
    data: types
  });
});

// Helper: Normalize time string to "HH:MM" format for consistent comparison
function normalizeTimeString(timeStr) {
  if (!timeStr) return null;

  // If already in HH:MM format with leading zero, return as-is
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;

  // Handle "H:MM" format - add leading zero
  if (/^\d:\d{2}$/.test(timeStr)) return `0${timeStr}`;

  // Handle "HH:MM:SS" format - strip seconds
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) return timeStr.slice(0, 5);

  // Handle "H:MM AM/PM" or "HH:MM AM/PM" formats
  const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2];
    const period = amPmMatch[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  // Return original if no pattern matched
  return timeStr;
}

// @desc    Check for appointment conflicts
// @route   POST /api/appointments/check-conflicts
// @access  Private
exports.checkConflicts = asyncHandler(async (req, res, next) => {
  const { provider, date, startTime, endTime, excludeId } = req.body;

  // Normalize input times to ensure consistent comparison
  const normalizedStartTime = normalizeTimeString(startTime);
  const normalizedEndTime = normalizeTimeString(endTime);

  // Parse date for day boundary query - TIMEZONE FIX: Use timezone-aware date range
  const { start: startDate, end: endDate } = getDayRange(date);

  // Build base query - get all appointments for this provider on this date
  const query = {
    provider,
    date: { $gte: startDate, $lte: endDate },
    status: { $nin: ['cancelled', 'no-show'] }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  // Get potential conflicts and check overlap in JavaScript
  // This is more reliable than MongoDB string comparison
  const potentialConflicts = await Appointment.find(query)
    .populate('patient', 'firstName lastName')
    .select('appointmentId startTime endTime type patient')
    .lean();

  // Filter for actual time conflicts using normalized times
  const conflicts = potentialConflicts.filter(apt => {
    const aptStartTime = normalizeTimeString(apt.startTime);
    const aptEndTime = normalizeTimeString(apt.endTime);

    // Check for any overlap:
    // 1. Existing appointment starts during our slot
    // 2. Existing appointment ends during our slot
    // 3. Existing appointment completely contains our slot
    const startsInSlot = aptStartTime >= normalizedStartTime && aptStartTime < normalizedEndTime;
    const endsInSlot = aptEndTime > normalizedStartTime && aptEndTime <= normalizedEndTime;
    const containsSlot = aptStartTime <= normalizedStartTime && aptEndTime >= normalizedEndTime;

    return startsInSlot || endsInSlot || containsSlot;
  });

  res.status(200).json({
    success: true,
    hasConflicts: conflicts.length > 0,
    data: conflicts
  });
});

// @desc    Bulk update appointments
// @route   PUT /api/appointments/bulk-update
// @access  Private (Admin)
exports.bulkUpdate = asyncHandler(async (req, res, next) => {
  const { ids, status, provider, date } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return error(res, 'Appointment IDs array is required');
  }

  const updateData = { updatedBy: req.user.id };
  if (status) updateData.status = status;
  if (provider) updateData.provider = provider;
  if (date) updateData.date = new Date(date);

  const result = await Appointment.updateMany(
    { _id: { $in: ids } },
    { $set: updateData }
  );

  return success(res, { data: { modified: result.modifiedCount }, message: `${result.modifiedCount} appointments updated` });
});

// @desc    Get calendar view
// @route   GET /api/appointments/calendar
// @access  Private
exports.getCalendarView = asyncHandler(async (req, res, next) => {
  const { start, end, providerId } = req.query;

  if (!start || !end) {
    return error(res, 'Start and end dates are required');
  }

  const query = {
    date: {
      $gte: new Date(start),
      $lte: new Date(end)
    },
    status: { $nin: ['cancelled'] }
  };

  if (providerId) {
    query.provider = providerId;
  }

  // Role-based filtering
  if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    query.provider = req.user.id;
  }

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('provider', 'firstName lastName')
    .select('appointmentId date startTime endTime type status patient provider department priority');

  // Format for calendar display
  const events = appointments.map(apt => ({
    id: apt._id,
    appointmentId: apt.appointmentId,
    title: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
    start: `${apt.date.toISOString().split('T')[0]}T${apt.startTime}`,
    end: `${apt.date.toISOString().split('T')[0]}T${apt.endTime}`,
    type: apt.type,
    status: apt.status,
    department: apt.department,
    priority: apt.priority,
    provider: apt.provider ? `${apt.provider.firstName} ${apt.provider.lastName}` : null,
    patientId: apt.patient?.patientId
  }));

  return success(res, { data: events });
});

// @desc    Get queue status
// @route   GET /api/appointments/queue
// @access  Private
exports.getQueueStatus = asyncHandler(async (req, res, next) => {
  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today, end: tomorrow } = getTodayRange();

  const queue = await Appointment.find({
    date: { $gte: today, $lte: tomorrow },
    status: { $in: ['checked-in', 'in-progress'] },
    queueNumber: { $exists: true }
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('provider', 'firstName lastName')
    .sort({ queueNumber: 1 });

  const waiting = queue.filter(a => a.status === 'checked-in');
  const inProgress = queue.filter(a => a.status === 'in-progress');

  return success(res, {
    data: {
      waiting: waiting.length,
      inProgress: inProgress.length,
      queue: queue.map(apt => ({
        id: apt._id,
        queueNumber: apt.queueNumber,
        patient: apt.patient,
        provider: apt.provider,
        status: apt.status,
        checkInTime: apt.checkInTime,
        waitingTime: apt.checkInTime
          ? Math.round((Date.now() - apt.checkInTime) / 60000)
          : null
      }))
    }
  });
});

// @desc    Update queue position
// @route   PUT /api/appointments/:id/queue-position
// @access  Private
exports.updateQueuePosition = asyncHandler(async (req, res, next) => {
  const { position } = req.body;

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  appointment.queueNumber = position;
  appointment.updatedBy = req.user.id;
  await appointment.save();

  return success(res, { data: appointment, message: 'Queue position updated' });
});

// @desc    Get recurring appointment series
// @route   GET /api/appointments/series/:seriesId
// @access  Private
exports.getRecurringSeries = asyncHandler(async (req, res, next) => {
  const { seriesId } = req.params;

  const appointments = await Appointment.find({
    $or: [
      { _id: seriesId },
      { 'recurrence.parentAppointment': seriesId }
    ]
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('provider', 'firstName lastName')
    .sort({ date: 1 });

  return success(res, { data: appointments });
});

// @desc    Create recurring appointments
// @route   POST /api/appointments/recurring
// @access  Private
exports.createRecurring = asyncHandler(async (req, res, next) => {
  const { recurrence, ...appointmentData } = req.body;
  appointmentData.createdBy = req.user.id;

  if (!recurrence || !recurrence.pattern) {
    return error(res, 'Recurrence pattern is required');
  }

  // Check if patient exists
  const patient = await findPatientByIdOrCode(appointmentData.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  const appointments = [];
  const maxOccurrences = recurrence.occurrences || 12;
  const endDate = recurrence.endDate ? new Date(recurrence.endDate) : null;

  // Create parent appointment
  const parentAppointment = new Appointment({
    ...appointmentData,
    isRecurring: true,
    recurrence: {
      pattern: recurrence.pattern,
      interval: recurrence.interval || 1,
      daysOfWeek: recurrence.daysOfWeek,
      dayOfMonth: recurrence.dayOfMonth,
      endDate: endDate,
      occurrences: maxOccurrences
    },
    source: 'recurring'
  });

  // Check for conflicts on first appointment
  const hasConflict = await parentAppointment.hasConflict();
  if (hasConflict) {
    return res.status(409).json({
      success: false,
      error: 'Time slot already booked for this provider on the first date'
    });
  }

  await parentAppointment.save();
  appointments.push(parentAppointment);

  // Generate recurring appointments
  const currentDate = new Date(appointmentData.date);
  let count = 1;

  while (count < maxOccurrences) {
    // Calculate next date based on pattern
    switch (recurrence.pattern) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + (recurrence.interval || 1));
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7 * (recurrence.interval || 1));
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + (recurrence.interval || 1));
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
    }

    // Check end date
    if (endDate && currentDate > endDate) {
      break;
    }

    // Create child appointment
    const childAppointment = new Appointment({
      ...appointmentData,
      date: new Date(currentDate),
      isRecurring: true,
      recurrence: {
        pattern: recurrence.pattern,
        parentAppointment: parentAppointment._id
      },
      source: 'recurring'
    });

    // Skip if conflict (but continue with others)
    const childHasConflict = await childAppointment.hasConflict();
    if (!childHasConflict) {
      await childAppointment.save();
      appointments.push(childAppointment);
    }

    count++;
  }

  res.status(201).json({
    success: true,
    message: `Created ${appointments.length} recurring appointments`,
    data: {
      seriesId: parentAppointment._id,
      appointments
    }
  });
});

// @desc    Confirm appointment
// @route   PUT /api/appointments/:id/confirm
// @access  Private
exports.confirmAppointment = asyncHandler(async (req, res, next) => {
  const { method = 'in-person' } = req.body;

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName email');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  appointment.status = 'confirmed';
  appointment.confirmation = {
    required: true,
    confirmed: true,
    confirmedAt: new Date(),
    confirmedBy: req.user.role === 'receptionist' ? 'staff' : 'patient',
    method
  };
  appointment.updatedBy = req.user.id;

  await appointment.save();

  // Send confirmation email if patient has email
  if (appointment.patient?.email) {
    try {
      await notificationFacade.sendEmail(
        appointment.patient.email,
        `Confirmation de rendez-vous - ${new Date(appointment.date).toLocaleDateString('fr-FR')}`,
        'appointmentConfirmation',
        {
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          date: new Date(appointment.date).toLocaleDateString('fr-FR'),
          time: appointment.startTime,
          provider: 'Dr.',
          department: appointment.department,
          location: appointment.location?.room || 'Main Building'
        }
      );
    } catch (err) {
      appointmentLogger.error('Failed to send confirmation email', { error: err });
    }
  }

  // Emit WebSocket event for real-time updates
  websocketService.emitAppointmentUpdate({
    type: 'appointment_confirmed',
    appointmentId: appointment._id,
    appointment: appointment
  });

  return success(res, { data: appointment, message: 'Appointment confirmed' });
});

// @desc    Get provider availability
// @route   GET /api/appointments/provider-availability/:providerId
// @access  Private
exports.getProviderAvailability = asyncHandler(async (req, res, next) => {
  const { providerId } = req.params;

  let availability = await ProviderAvailability.findOne({ provider: providerId });

  if (!availability) {
    availability = await ProviderAvailability.getOrCreateDefault(providerId);
  }

  return success(res, { data: availability });
});

// @desc    Update provider availability
// @route   PUT /api/appointments/provider-availability/:providerId
// @access  Private (Admin)
exports.updateProviderAvailability = asyncHandler(async (req, res, next) => {
  const { providerId } = req.params;
  req.body.updatedBy = req.user.id;

  let availability = await ProviderAvailability.findOne({ provider: providerId });

  if (!availability) {
    req.body.provider = providerId;
    req.body.createdBy = req.user.id;
    availability = await ProviderAvailability.create(req.body);
  } else {
    Object.assign(availability, sanitizeForAssign(req.body));
    await availability.save();
  }

  return success(res, { data: availability, message: 'Provider availability updated' });
});

// @desc    Add provider time-off
// @route   POST /api/appointments/provider-availability/:providerId/time-off
// @access  Private
exports.addProviderTimeOff = asyncHandler(async (req, res, next) => {
  const { providerId } = req.params;
  const { date, type = 'day-off', reason, shifts } = req.body;

  let availability = await ProviderAvailability.findOne({ provider: providerId });

  if (!availability) {
    availability = await ProviderAvailability.getOrCreateDefault(providerId);
  }

  availability.overrides.push({
    date: new Date(date),
    type,
    reason,
    shifts
  });

  availability.updatedBy = req.user.id;
  await availability.save();

  return success(res, { data: availability, message: 'Time-off added' });
});

// @desc    Get list of providers (doctors/ophthalmologists)
// @route   GET /api/appointments/providers
// @access  Private (All staff roles)
exports.getProviders = asyncHandler(async (req, res, next) => {
  // Fetch active users with doctor/ophthalmologist roles
  const providers = await User.find({
    role: { $in: ['doctor', 'ophthalmologist'] },
    isActive: true
  })
    .select('firstName lastName role email')
    .sort('firstName lastName');

  return success(res, { data: providers });
});
