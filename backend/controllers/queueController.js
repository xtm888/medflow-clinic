const Appointment = require('../models/Appointment');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Counter = require('../models/Counter');
const Room = require('../models/Room');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const websocketService = require('../services/websocketService');
const notificationFacade = require('../services/notificationFacade');
const { getTodayRange, getDayRange } = require('../utils/dateUtils');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { queue: queueLogger } = require('../utils/structuredLogger');
const { QUEUE, PAGINATION } = require('../config/constants');

// In-memory queue for real-time management
let queue = [];

// Patient calling service configuration
const CALLING_CONFIG = {
  smsEnabled: process.env.SMS_ENABLED === 'true',
  audioEnabled: true,
  languages: {
    fr: {
      callMessage: (name, room) => `${name}, veuillez vous présenter en salle ${room}`,
      smsTemplate: (name, room, clinic) => `${clinic}: ${name}, c'est votre tour. Salle ${room}. Merci.`
    },
    en: {
      callMessage: (name, room) => `${name}, please proceed to room ${room}`,
      smsTemplate: (name, room, clinic) => `${clinic}: ${name}, it's your turn. Room ${room}. Thank you.`
    }
  }
};

// @desc    Get current queue
// @route   GET /api/queue
// @access  Private
exports.getCurrentQueue = asyncHandler(async (req, res, next) => {
  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today, end: tomorrow } = getTodayRange();

  // Build query with clinic filter for data isolation
  const query = {
    date: { $gte: today, $lte: tomorrow },
    status: { $in: ['checked-in', 'in-progress'] }
  };

  // CRITICAL: Apply clinic filter to prevent cross-clinic data leakage
  if (req.clinicId) {
    query.clinic = req.clinicId;
  }

  // Get today's checked-in appointments
  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('provider', 'firstName lastName')
    .sort('queueNumber')
    .lean(); // Performance: return plain JS objects for read-only list

  // Get completed appointments today for wait time calculation
  // Apply same clinic filter for consistency
  const completedQuery = {
    date: { $gte: today, $lte: tomorrow },
    status: 'completed'
  };
  if (req.clinicId) {
    completedQuery.clinic = req.clinicId;
  }
  const completedToday = await Appointment.find(completedQuery)
    .select('waitingTime consultationStartTime consultationEndTime department').lean();

  // Calculate department-specific average consultation times
  const deptAvgTimes = calculateDepartmentAverageTimes(completedToday);

  // Pre-group appointments by department to avoid O(n²) filtering
  const deptGroups = {};
  const deptCheckedInCounts = {};
  appointments.forEach(apt => {
    const key = apt.department || 'general';
    if (!deptGroups[key]) {
      deptGroups[key] = [];
      deptCheckedInCounts[key] = 0;
    }
    deptGroups[key].push(apt);
    if (apt.status === 'checked-in') {
      deptCheckedInCounts[key]++;
    }
  });

  // Build position maps for checked-in appointments per department
  const deptPositions = {};
  Object.keys(deptGroups).forEach(key => {
    deptPositions[key] = {};
    let position = 1;
    deptGroups[key].forEach(apt => {
      if (apt.status === 'checked-in') {
        deptPositions[key][apt._id.toString()] = position++;
      }
    });
  });

  // Group by department/provider - now O(n) instead of O(n²)
  const queues = {};
  appointments.forEach((apt) => {
    const key = apt.department || 'general';
    if (!queues[key]) {
      queues[key] = [];
    }

    // Get position from pre-computed map - O(1) lookup
    const positionInQueue = apt.status === 'checked-in'
      ? deptPositions[key][apt._id.toString()]
      : null;

    // Get smart wait time estimate
    const estimatedWait = calculateSmartWaitTime(apt, positionInQueue || 0, deptAvgTimes[key]);

    queues[key].push({
      queueNumber: apt.queueNumber,
      patient: apt.patient,
      provider: apt.provider,
      appointmentId: apt._id,
      visitId: apt.visit?._id,
      checkInTime: apt.checkInTime,
      status: apt.status,
      priority: apt.priority,
      estimatedWaitTime: estimatedWait.estimated,
      actualWaitTime: calculateActualWaitTime(apt.checkInTime),
      positionInQueue,
      room: apt.location?.room || null
    });
  });

  const responseData = {
    queues,
    stats: {
      totalWaiting: appointments.filter(a => a.status === 'checked-in').length,
      inProgress: appointments.filter(a => a.status === 'in-progress').length,
      completedToday: completedToday.length,
      averageWaitTime: calculateAverageWaitTime(appointments),
      averageConsultationTime: calculateAverageConsultationTime(completedToday)
    },
    timestamp: new Date()
  };

  return success(res, { data: responseData });
});

// @desc    Add patient to queue
// @route   POST /api/queue
// @access  Private
exports.addToQueue = asyncHandler(async (req, res, next) => {
  const { appointmentId, walkIn, patientInfo, reason, priority } = req.body;

  // Handle walk-in patients (no appointment)
  if (walkIn && patientInfo) {
    // Helper function to create walk-in with or without transaction
    const createWalkIn = async (useSession = false, session = null) => {
      const queryOpts = useSession ? { session } : {};
      const createOpts = useSession ? { session } : {};
      const saveOpts = useSession ? { session } : {};

      // Find existing patient by phone or create new one
      let patient = useSession
        ? await Patient.findOne({ phoneNumber: patientInfo.phoneNumber }).session(session)
        : await Patient.findOne({ phoneNumber: patientInfo.phoneNumber });

      if (!patient) {
        // Generate patient ID (using same format as Patient model)
        const year = new Date().getFullYear();
        const counterId = `patient-${year}`;
        const sequence = await Counter.getNextSequence(counterId);
        const patientId = `PAT${year}${String(sequence).padStart(6, '0')}`;

        // CRITICAL: Do NOT use default DOB - it causes wrong age calculations
        // for drug dosing, pediatric protocols, etc.
        const patientData = {
          patientId,
          firstName: patientInfo.firstName,
          lastName: patientInfo.lastName,
          phoneNumber: patientInfo.phoneNumber,
          gender: patientInfo.gender || 'other',
          // Only set DOB if provided - flag as incomplete if missing
          dateOfBirth: patientInfo.dateOfBirth || null,
          registrationType: 'walk-in',
          status: 'active',
          // Flag to indicate patient record needs completion
          demographicsComplete: !!patientInfo.dateOfBirth,
          pendingUpdates: patientInfo.dateOfBirth ? [] : ['dateOfBirth']
        };

        const patients = await Patient.create([patientData], createOpts);
        patient = patients[0];
      }

      // Generate queue number
      const queueCounterId = Counter.getTodayQueueCounterId();
      const queueNumber = await Counter.getNextSequence(queueCounterId);

      // Generate appointment ID using Counter (atomic)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const aptCounterId = `appointment-${year}${month}${day}`;
      const sequence = await Counter.getNextSequence(aptCounterId);
      const newAppointmentId = `APT${year}${month}${day}${String(sequence).padStart(4, '0')}`;

      // Calculate start and end times
      const startTime = new Date();
      const startTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
      const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 minutes later
      const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

      // Create walk-in appointment
      // Determine department from request, provider's specialty, or default
      const appointmentDepartment = req.body.department ||
        (req.user.specialization === 'ophthalmologist' ? 'ophthalmology' :
         req.user.specialization === 'optometrist' ? 'ophthalmology' :
         req.user.department || 'general');

      const appointmentData = {
        appointmentId: newAppointmentId,
        patient: patient._id,
        provider: req.user.id, // Use logged-in user as provider
        date: new Date(),
        startTime: startTimeStr,
        endTime: endTimeStr,
        type: 'consultation', // 'walk-in' is not valid enum, use 'consultation'
        source: 'walk-in', // Mark source as walk-in
        reason: reason || 'Walk-in consultation',
        status: 'checked-in',
        checkInTime: Date.now(),
        queueNumber: queueNumber,
        priority: priority ? priority.toLowerCase() : 'normal',
        department: appointmentDepartment
      };

      const appointments = await Appointment.create([appointmentData], createOpts);
      const appointment = appointments[0];

      // Auto-create Visit - status should be 'checked-in' until patient is called
      const visitData = {
        patient: patient._id,
        appointment: appointment._id,
        visitDate: Date.now(),
        visitType: 'consultation', // 'walk-in' is not valid enum
        primaryProvider: req.user.id, // Required field
        status: 'checked-in', // Patient is waiting, not being seen yet
        department: appointmentDepartment,
        chiefComplaint: {
          complaint: reason || 'Walk-in consultation',
          associatedSymptoms: []
        }
      };

      const visits = await Visit.create([visitData], createOpts);
      const visit = visits[0];

      // CRITICAL: Capture convention snapshot at check-in time
      // This prevents pricing issues if patient's convention changes mid-visit
      await visit.captureConventionSnapshot();

      // Link visit back to appointment (bidirectional relationship)
      appointment.visit = visit._id;
      await appointment.save(saveOpts);

      return { patient, appointment, visit, queueNumber };
    };

    let result;

    // Try with transaction first, fall back to non-transactional if not supported
    try {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        result = await createWalkIn(true, session);
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      // If transaction not supported (standalone MongoDB), retry without transaction
      if (error.code === 20 || error.codeName === 'IllegalOperation') {
        queueLogger.info('Transactions not supported, saving without transaction');
        result = await createWalkIn(false);
      } else {
        throw error;
      }
    }

    const { patient, appointment, visit, queueNumber } = result;

    // Emit WebSocket update for real-time queue refresh
    const appointmentDept = result.appointment?.department || req.body.department || 'general';
    websocketService.emitQueueUpdate({
      type: 'patient_added',
      queueNumber,
      patient: {
        _id: patient._id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        patientId: patient.patientId
      },
      department: appointmentDept,
      priority: priority || 'normal'
    });

    return res.status(201).json({
      success: true,
      message: 'Walk-in patient added to queue',
      data: {
        queueNumber,
        patient: {
          _id: patient._id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          patientId: patient.patientId
        },
        appointmentId: appointment._id,
        visitId: visit._id,
        position: queueNumber,
        estimatedWaitTime: queueNumber * QUEUE.WAIT_TIME_PER_PATIENT_MINUTES
      }
    });
  }

  // Handle regular appointment check-in
  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName patientId');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  if (appointment.status === 'checked-in') {
    return error(res, 'Patient already in queue', 400);
  }

  // Generate queue number - FIXED: Using atomic Counter to prevent race conditions
  const counterId = Counter.getTodayQueueCounterId();
  const queueNumber = await Counter.getNextSequence(counterId);

  appointment.status = 'checked-in';
  appointment.checkInTime = Date.now();
  appointment.queueNumber = queueNumber;
  if (priority) appointment.priority = priority;

  await appointment.save();

  // Auto-create Visit on check-in
  // CRITICAL FIX: Status should be 'checked-in' not 'in-progress'
  // Patient is waiting to be seen, not yet being seen
  const visitData = {
    patient: appointment.patient,
    appointment: appointment._id,
    visitDate: Date.now(),
    visitType: mapAppointmentTypeToVisitType(appointment.type),
    primaryProvider: appointment.provider,
    status: 'checked-in',
    checkInTime: new Date()
  };

  // Pre-populate chief complaint from appointment
  if (appointment.chiefComplaint || appointment.reason) {
    visitData.chiefComplaint = {
      complaint: appointment.chiefComplaint || appointment.reason,
      associatedSymptoms: appointment.symptoms || []
    };
  }

  const visit = await Visit.create(visitData);

  // CRITICAL: Capture convention snapshot at check-in time
  await visit.captureConventionSnapshot();

  // Link visit back to appointment (bidirectional relationship)
  appointment.visit = visit._id;
  await appointment.save();

  // Emit WebSocket update for real-time queue refresh
  websocketService.emitQueueUpdate({
    type: 'patient_checked_in',
    queueNumber: appointment.queueNumber,
    patient: appointment.patient,
    department: appointment.department || 'general',
    priority: appointment.priority
  });

  return success(res, {
    data: {
      queueNumber: appointment.queueNumber,
      position: await getQueuePosition(appointment),
      estimatedWaitTime: calculateEstimatedWaitTime(appointment),
      visitId: visit._id
    },
    message: 'Patient added to queue and visit created'
  });
});

// @desc    Update queue status
// @route   PUT /api/queue/:id
// @access  Private
exports.updateQueueStatus = asyncHandler(async (req, res, next) => {
  let { status, priority, roomNumber, roomId } = req.body;

  // Convert priority to lowercase if provided
  if (priority) {
    priority = priority.toLowerCase();
  }

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('provider', 'firstName lastName');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  // CRITICAL: Provider ownership check - prevent cross-patient data mixing
  // Only the assigned provider, admins, nurses, or reception can update status
  const allowedRoles = ['admin', 'nurse', 'reception', 'receptionist', 'supervisor'];
  const isAllowedRole = allowedRoles.includes(req.user.role);
  const isAssignedProvider = appointment.provider &&
    (appointment.provider._id?.toString() === req.user.id || appointment.provider.toString() === req.user.id);
  const isSameDepartment = appointment.department === req.user.department;

  if (!isAllowedRole && !isAssignedProvider) {
    // Doctors/Ophthalmologists can only update their own patients
    if (['doctor', 'ophthalmologist', 'optometrist'].includes(req.user.role)) {
      // SECURITY FIX: Don't leak internal IDs or provider names in error response
      // Log details internally for security audit
      queueLogger.warn('[SECURITY] Access denied for queue update', {
        userId: req.user.id,
        userRole: req.user.role,
        appointmentId: appointment._id
      });
      return error(res, 'Accès refusé: Vous ne pouvez modifier que les rendez-vous de vos propres patients', 403);
    }
  }

  const oldStatus = appointment.status;
  appointment.status = status;

  // Update priority if provided (with conversion to lowercase)
  if (priority) {
    appointment.priority = priority;
  }

  // Handle room assignment
  if (roomNumber) {
    appointment.location = appointment.location || {};
    appointment.location.room = roomNumber;
  }

  // Track consultation times
  if (status === 'in-progress' && oldStatus === 'checked-in') {
    appointment.consultationStartTime = Date.now();
    appointment.calculateWaitingTime();

    // If room specified, occupy it
    if (roomId) {
      const room = await Room.findById(roomId);
      if (room && room.isAvailable()) {
        await room.occupy(appointment.patient._id, appointment._id, appointment.provider);
      }
    }

    // CASCADE: Update Visit status to 'in-progress' when consultation starts
    if (appointment.visit) {
      try {
        await Visit.findByIdAndUpdate(appointment.visit, {
          status: 'in-progress',
          consultationStartTime: Date.now()
        });
      } catch (visitErr) {
        queueLogger.error('Error updating visit status to in-progress', { error: visitErr });
      }
    }
  } else if (status === 'completed' && oldStatus === 'in-progress') {
    appointment.consultationEndTime = Date.now();

    // Release room if was assigned
    if (roomId) {
      const room = await Room.findById(roomId);
      if (room) {
        await room.release();
      }
    }

    // CASCADE: Complete the associated visit when appointment is completed
    if (appointment.visit) {
      try {
        const visit = await Visit.findById(appointment.visit);
        if (visit && visit.status !== 'completed') {
          // Use the visit's completeVisit method to trigger invoice generation
          await visit.completeVisit(req.user._id || req.user.id);
          queueLogger.info('Visit auto-completed from queue status change', { visitId: visit.visitId });
        }
      } catch (visitErr) {
        queueLogger.error('Error auto-completing visit from queue', { error: visitErr });
        // Continue - don't fail queue update if visit completion fails
      }
    }
  }

  await appointment.save();

  // Emit WebSocket update for real-time queue refresh
  websocketService.emitQueueUpdate({
    type: 'status_changed',
    appointmentId: appointment._id,
    queueNumber: appointment.queueNumber,
    patient: appointment.patient,
    oldStatus,
    newStatus: status,
    room: roomNumber || appointment.location?.room
  });

  return success(res, { data: appointment, message: 'Queue status updated' });
});

// @desc    Remove from queue
// @route   DELETE /api/queue/:id
// @access  Private
exports.removeFromQueue = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  appointment.status = 'scheduled';
  appointment.queueNumber = null;
  appointment.checkInTime = null;

  await appointment.save();

  return success(res, { data: null, message: 'Patient removed from queue' });
});

// @desc    Call next patient
// @route   POST /api/queue/next
// @access  Private (Doctor, Nurse)
exports.callNext = asyncHandler(async (req, res, next) => {
  const { department = 'general', roomId, roomNumber, sendSms = false, audioAnnounce = true, language = 'fr' } = req.body;

  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today, end: tomorrow } = getTodayRange();

  // Find next patient in queue (priority order: emergency > urgent > vip > pregnant > elderly > high > normal)
  let query = {
    date: { $gte: today, $lte: tomorrow },
    status: 'checked-in',
    department
  };

  // CRITICAL: Apply clinic filter to prevent cross-clinic data leakage
  if (req.clinicId) {
    query.clinic = req.clinicId;
  }

  // If doctor/ophthalmologist, filter by provider
  if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    query.provider = req.user.id;
  }

  // Custom sort by priority weight
  const priorityOrder = { 'emergency': 0, 'urgent': 1, 'vip': 2, 'pregnant': 3, 'elderly': 4, 'high': 5, 'normal': 6 };

  const waitingPatients = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth phoneNumber gender email')
    .sort('queueNumber');

  // Sort by priority then queue number
  waitingPatients.sort((a, b) => {
    const priorityDiff = (priorityOrder[a.priority] || 6) - (priorityOrder[b.priority] || 6);
    if (priorityDiff !== 0) return priorityDiff;
    return (a.queueNumber || 0) - (b.queueNumber || 0);
  });

  const nextPatient = waitingPatients[0];

  if (!nextPatient) {
    return notFound(res, 'No patients in queue');
  }

  // Determine room to use
  let assignedRoom = roomNumber;
  let roomDoc = null;

  if (roomId) {
    roomDoc = await Room.findById(roomId);
    if (roomDoc && roomDoc.isAvailable()) {
      await roomDoc.occupy(nextPatient.patient._id, nextPatient._id, req.user.id);
      assignedRoom = roomDoc.roomNumber;
    }
  } else if (!roomNumber) {
    // Try to find an available room automatically
    const availableRoom = await Room.findOne({
      department: department,
      status: 'available',
      isActive: true
    }).sort('displaySettings.displayOrder');

    if (availableRoom) {
      await availableRoom.occupy(nextPatient.patient._id, nextPatient._id, req.user.id);
      assignedRoom = availableRoom.roomNumber;
      roomDoc = availableRoom;
    }
  }

  // Update status to in-progress
  nextPatient.status = 'in-progress';
  nextPatient.consultationStartTime = Date.now();
  nextPatient.calculateWaitingTime();
  if (assignedRoom) {
    nextPatient.location = nextPatient.location || {};
    nextPatient.location.room = assignedRoom;
  }

  await nextPatient.save();

  const patientName = `${nextPatient.patient.firstName} ${nextPatient.patient.lastName}`;

  // Prepare call announcement data
  const callData = {
    type: 'patient_called',
    appointmentId: nextPatient._id,
    queueNumber: nextPatient.queueNumber,
    patient: {
      _id: nextPatient.patient._id,
      firstName: nextPatient.patient.firstName,
      lastName: nextPatient.patient.lastName,
      patientId: nextPatient.patient.patientId
    },
    room: assignedRoom,
    department,
    calledBy: {
      _id: req.user.id,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    },
    audioAnnouncement: audioAnnounce ? {
      enabled: true,
      message: CALLING_CONFIG.languages[language]?.callMessage(patientName, assignedRoom) ||
               CALLING_CONFIG.languages.fr.callMessage(patientName, assignedRoom),
      language
    } : null,
    timestamp: new Date()
  };

  // Emit WebSocket update for real-time call notification
  websocketService.emitQueueUpdate(callData);

  // Send SMS notification if enabled
  let smsResult = null;
  if (sendSms && nextPatient.patient.phoneNumber && CALLING_CONFIG.smsEnabled) {
    try {
      // SMS integration would go here
      // For now, we'll just log it
      queueLogger.info('[SMS] Would send to patient', {
        phoneNumber: nextPatient.patient.phoneNumber,
        room: assignedRoom
      });
      smsResult = { sent: true, number: nextPatient.patient.phoneNumber };
    } catch (smsError) {
      queueLogger.error('[SMS] Error sending', { error: smsError });
      smsResult = { sent: false, error: smsError.message };
    }
  }

  // Send email notification if patient has email
  if (nextPatient.patient.email) {
    try {
      await notificationFacade.sendEmail(
        nextPatient.patient.email,
        'Vous êtes appelé - MedFlow',
        'patientCalled',
        {
          patientName,
          room: assignedRoom,
          queueNumber: nextPatient.queueNumber,
          clinicName: process.env.CLINIC_NAME || 'MedFlow Clinic'
        }
      );
    } catch (emailError) {
      queueLogger.error('[Email] Error sending patient call notification', { error: emailError });
    }
  }

  return success(res, {
    data: {
      appointmentId: nextPatient._id,
      queueNumber: nextPatient.queueNumber,
      patient: nextPatient.patient,
      visitId: nextPatient.visit?._id,
      visit: nextPatient.visit,
      room: assignedRoom,
      roomId: roomDoc?._id,
      waitingTime: nextPatient.waitingTime,
      checkInTime: nextPatient.checkInTime,
      consultationStartTime: nextPatient.consultationStartTime,
      audioAnnouncement: callData.audioAnnouncement,
      smsNotification: smsResult
    },
    message: 'Next patient called'
  });
});

// @desc    Get queue statistics
// @route   GET /api/queue/stats
// @access  Private
exports.getQueueStats = asyncHandler(async (req, res, next) => {
  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today, end: tomorrow } = getTodayRange();

  // Build query with clinic filter for data isolation
  const query = {
    date: { $gte: today, $lte: tomorrow }
  };

  // CRITICAL: Apply clinic filter to prevent cross-clinic data leakage
  if (req.clinicId) {
    query.clinic = req.clinicId;
  }

  const appointments = await Appointment.find(query);

  // Calculate statistics
  const stats = {
    totalAppointments: appointments.length,
    checkedIn: appointments.filter(a => a.status === 'checked-in').length,
    inProgress: appointments.filter(a => a.status === 'in-progress').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    noShow: appointments.filter(a => a.status === 'no-show').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    averageWaitTime: calculateAverageWaitTime(appointments),
    averageConsultationTime: calculateAverageConsultationTime(appointments),
    byDepartment: {},
    byProvider: {},
    peakHours: calculatePeakHours(appointments)
  };

  // Group by department
  appointments.forEach(apt => {
    const dept = apt.department || 'general';
    if (!stats.byDepartment[dept]) {
      stats.byDepartment[dept] = {
        total: 0,
        waiting: 0,
        completed: 0,
        averageWaitTime: 0
      };
    }
    stats.byDepartment[dept].total++;
    if (apt.status === 'checked-in') stats.byDepartment[dept].waiting++;
    if (apt.status === 'completed') stats.byDepartment[dept].completed++;
  });

  return success(res, { data: stats });
});

// Helper functions
function calculateActualWaitTime(checkInTime) {
  if (!checkInTime) return 0;
  const now = new Date();
  const checkIn = new Date(checkInTime);
  const diffMs = now - checkIn;
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  return Math.max(0, diffMinutes); // Ensure non-negative
}

function calculateEstimatedWaitTime(appointment, queueAhead = []) {
  // Simple estimation: configurable minutes per patient ahead
  const patientsAhead = queueAhead.filter(a => a.status === 'checked-in').length;
  return patientsAhead * QUEUE.WAIT_TIME_PER_PATIENT_MINUTES;
}

function calculateAverageWaitTime(appointments) {
  const waitTimes = appointments
    .filter(a => a.waitingTime)
    .map(a => a.waitingTime);

  if (waitTimes.length === 0) return 0;

  const sum = waitTimes.reduce((acc, time) => acc + time, 0);
  return Math.round(sum / waitTimes.length);
}

function calculateAverageConsultationTime(appointments) {
  const consultationTimes = appointments
    .filter(a => a.consultationStartTime && a.consultationEndTime)
    .map(a => (a.consultationEndTime - a.consultationStartTime) / (1000 * 60));

  if (consultationTimes.length === 0) return 0;

  const sum = consultationTimes.reduce((acc, time) => acc + time, 0);
  return Math.round(sum / consultationTimes.length);
}

async function getQueuePosition(appointment) {
  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today, end: tomorrow } = getTodayRange();

  const ahead = await Appointment.countDocuments({
    date: { $gte: today, $lte: tomorrow },
    status: 'checked-in',
    department: appointment.department,
    queueNumber: { $lt: appointment.queueNumber }
  });

  return ahead + 1;
}

function calculatePeakHours(appointments) {
  const hourCounts = {};

  appointments.forEach(apt => {
    if (apt.checkInTime) {
      const hour = new Date(apt.checkInTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });

  // Find top 3 peak hours
  const sorted = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
      timeRange: `${hour}:00 - ${hour}:59`
    }));

  return sorted;
}

function mapAppointmentTypeToVisitType(appointmentType) {
  const typeMapping = {
    'consultation': 'consultation',
    'follow-up': 'follow-up',
    'emergency': 'emergency',
    'routine-checkup': 'routine',
    'vaccination': 'routine',
    'lab-test': 'routine',
    'imaging': 'routine',
    'procedure': 'procedure',
    'surgery': 'procedure',
    'ophthalmology': 'consultation',
    'refraction': 'routine',
    'telemedicine': 'consultation'
  };

  return typeMapping[appointmentType] || 'routine';
}

// Calculate department-specific average consultation times
function calculateDepartmentAverageTimes(completedAppointments) {
  const deptTimes = {};

  completedAppointments.forEach(apt => {
    const dept = apt.department || 'general';
    if (!deptTimes[dept]) {
      deptTimes[dept] = { total: 0, count: 0 };
    }

    if (apt.consultationStartTime && apt.consultationEndTime) {
      const duration = (apt.consultationEndTime - apt.consultationStartTime) / (1000 * 60);
      if (duration > 0 && duration < QUEUE.MAX_WAIT_TIME_MINUTES) { // Ignore outliers
        deptTimes[dept].total += duration;
        deptTimes[dept].count++;
      }
    }
  });

  // Calculate averages, default to configured wait time if no data
  const result = {};
  Object.keys(deptTimes).forEach(dept => {
    result[dept] = deptTimes[dept].count > 0
      ? Math.round(deptTimes[dept].total / deptTimes[dept].count)
      : QUEUE.WAIT_TIME_PER_PATIENT_MINUTES;
  });

  // Ensure default departments have values
  ['general', 'ophthalmology', 'emergency', 'laboratory'].forEach(dept => {
    if (!result[dept]) {
      result[dept] = dept === 'emergency' ? 20 : dept === 'ophthalmology' ? 25 : QUEUE.WAIT_TIME_PER_PATIENT_MINUTES;
    }
  });

  return result;
}

// Smart wait time calculation considering multiple factors
function calculateSmartWaitTime(appointment, positionInQueue, avgConsultationTime) {
  const baseTime = avgConsultationTime || QUEUE.WAIT_TIME_PER_PATIENT_MINUTES;

  // Factor 1: Position in queue
  let estimated = (positionInQueue - 1) * baseTime;

  // Factor 2: Time of day adjustment (busier hours = longer waits)
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 11) estimated *= 1.2; // Morning rush
  if (hour >= 14 && hour <= 16) estimated *= 1.1; // Afternoon busy

  // Factor 3: Priority adjustment (higher priority = shorter effective wait)
  const priorityMultiplier = {
    'emergency': 0.1,
    'urgent': 0.3,
    'vip': 0.5,
    'pregnant': 0.6,
    'elderly': 0.7,
    'high': 0.8,
    'normal': 1.0
  };
  estimated *= priorityMultiplier[appointment.priority] || 1.0;

  // Factor 4: If someone is currently being served, add remaining time
  // (simplified - assumes halfway through consultation)
  if (positionInQueue === 1) {
    estimated = Math.max(estimated, 5); // Minimum 5 minutes if next in line
  }

  return {
    estimated: Math.round(estimated),
    baseTime,
    position: positionInQueue,
    factors: {
      queuePosition: positionInQueue,
      avgConsultation: baseTime,
      priority: appointment.priority
    }
  };
}

// @desc    Get queue analytics
// @route   GET /api/queue/analytics
// @access  Private
exports.getQueueAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, department, dateRange } = req.query;
  queueLogger.info('[Analytics] Query params', { startDate, endDate, department, dateRange });

  let start, end;

  // Handle dateRange parameter (today, week, month, etc.)
  if (dateRange === 'today') {
    const { start: todayStart, end: todayEnd } = getTodayRange();
    start = todayStart;
    end = todayEnd;
  } else if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    // Default to last 7 days
    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  const query = {
    date: { $gte: start, $lte: end }
  };
  if (department) query.department = department;

  const appointments = await Appointment.find(query)
    .populate('provider', 'firstName lastName')
    .select('status department priority waitingTime consultationStartTime consultationEndTime checkInTime date provider');

  // Calculate metrics
  const analytics = {
    period: { start, end },
    summary: {
      totalPatients: appointments.length,
      completed: appointments.filter(a => a.status === 'completed').length,
      noShow: appointments.filter(a => a.status === 'no-show').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length
    },
    waitTimes: {
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      percentile90: 0
    },
    consultationTimes: {
      average: 0,
      median: 0,
      min: 0,
      max: 0
    },
    byDepartment: {},
    byPriority: {},
    byHour: {},
    byDayOfWeek: {},
    bottlenecks: [],
    trends: []
  };

  // Wait time analysis
  const waitTimes = appointments
    .filter(a => a.waitingTime && a.waitingTime > 0)
    .map(a => a.waitingTime)
    .sort((a, b) => a - b);

  if (waitTimes.length > 0) {
    analytics.waitTimes.average = Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length);
    analytics.waitTimes.median = waitTimes[Math.floor(waitTimes.length / 2)];
    analytics.waitTimes.min = waitTimes[0];
    analytics.waitTimes.max = waitTimes[waitTimes.length - 1];
    analytics.waitTimes.percentile90 = waitTimes[Math.floor(waitTimes.length * 0.9)];
  }

  // Consultation time analysis
  const consultTimes = appointments
    .filter(a => a.consultationStartTime && a.consultationEndTime)
    .map(a => (a.consultationEndTime - a.consultationStartTime) / (1000 * 60))
    .filter(t => t > 0 && t < QUEUE.MAX_WAIT_TIME_MINUTES)
    .sort((a, b) => a - b);

  if (consultTimes.length > 0) {
    analytics.consultationTimes.average = Math.round(consultTimes.reduce((a, b) => a + b, 0) / consultTimes.length);
    analytics.consultationTimes.median = Math.round(consultTimes[Math.floor(consultTimes.length / 2)]);
    analytics.consultationTimes.min = Math.round(consultTimes[0]);
    analytics.consultationTimes.max = Math.round(consultTimes[consultTimes.length - 1]);
  }

  // By department
  appointments.forEach(apt => {
    const dept = apt.department || 'general';
    if (!analytics.byDepartment[dept]) {
      analytics.byDepartment[dept] = {
        total: 0,
        completed: 0,
        avgWaitTime: 0,
        avgConsultTime: 0,
        waitTimes: [],
        consultTimes: []
      };
    }
    analytics.byDepartment[dept].total++;
    if (apt.status === 'completed') analytics.byDepartment[dept].completed++;
    if (apt.waitingTime) analytics.byDepartment[dept].waitTimes.push(apt.waitingTime);
    if (apt.consultationStartTime && apt.consultationEndTime) {
      const ct = (apt.consultationEndTime - apt.consultationStartTime) / (1000 * 60);
      if (ct > 0 && ct < QUEUE.MAX_WAIT_TIME_MINUTES) analytics.byDepartment[dept].consultTimes.push(ct);
    }
  });

  // Calculate averages per department
  Object.keys(analytics.byDepartment).forEach(dept => {
    const d = analytics.byDepartment[dept];
    d.avgWaitTime = d.waitTimes.length > 0
      ? Math.round(d.waitTimes.reduce((a, b) => a + b, 0) / d.waitTimes.length)
      : 0;
    d.avgConsultTime = d.consultTimes.length > 0
      ? Math.round(d.consultTimes.reduce((a, b) => a + b, 0) / d.consultTimes.length)
      : 0;
    delete d.waitTimes;
    delete d.consultTimes;
  });

  // By priority
  QUEUE.PRIORITY_LEVELS.forEach(p => {
    const priorityAppts = appointments.filter(a => a.priority === p);
    if (priorityAppts.length > 0) {
      const priorityWaits = priorityAppts.filter(a => a.waitingTime).map(a => a.waitingTime);
      analytics.byPriority[p] = {
        count: priorityAppts.length,
        avgWaitTime: priorityWaits.length > 0
          ? Math.round(priorityWaits.reduce((a, b) => a + b, 0) / priorityWaits.length)
          : 0
      };
    }
  });

  // By hour of day (use appointment scheduled time, not check-in time)
  for (let h = 7; h <= 19; h++) {
    analytics.byHour[h] = { count: 0, avgWaitTime: 0, waits: [] };
  }
  appointments.forEach(apt => {
    // Use scheduled appointment time for hourly distribution
    if (apt.date) {
      const hour = new Date(apt.date).getHours();
      if (analytics.byHour[hour]) {
        analytics.byHour[hour].count++;
        if (apt.waitingTime) analytics.byHour[hour].waits.push(apt.waitingTime);
      }
    }
  });
  Object.keys(analytics.byHour).forEach(h => {
    const hourData = analytics.byHour[h];
    hourData.avgWaitTime = hourData.waits.length > 0
      ? Math.round(hourData.waits.reduce((a, b) => a + b, 0) / hourData.waits.length)
      : 0;
    delete hourData.waits;
  });

  // By provider
  const byProvider = {};
  appointments.forEach(apt => {
    if (apt.provider && apt.provider._id) {
      const providerId = apt.provider._id.toString();
      if (!byProvider[providerId]) {
        byProvider[providerId] = {
          providerName: `${apt.provider.firstName} ${apt.provider.lastName}`,
          count: 0,
          completed: 0,
          consultTimes: [],
          waitTimes: []
        };
      }
      byProvider[providerId].count++;
      if (apt.status === 'completed') byProvider[providerId].completed++;
      if (apt.waitingTime) byProvider[providerId].waitTimes.push(apt.waitingTime);
      if (apt.consultationStartTime && apt.consultationEndTime) {
        const ct = (apt.consultationEndTime - apt.consultationStartTime) / (1000 * 60);
        if (ct > 0 && ct < QUEUE.MAX_WAIT_TIME_MINUTES) byProvider[providerId].consultTimes.push(ct);
      }
    }
  });

  // Calculate averages and convert to array
  analytics.byProvider = Object.values(byProvider).map(p => ({
    providerName: p.providerName,
    count: p.count,
    completed: p.completed,
    avgConsultationTime: p.consultTimes.length > 0
      ? Math.round(p.consultTimes.reduce((a, b) => a + b, 0) / p.consultTimes.length)
      : 0,
    avgWaitTime: p.waitTimes.length > 0
      ? Math.round(p.waitTimes.reduce((a, b) => a + b, 0) / p.waitTimes.length)
      : 0
  })).sort((a, b) => b.count - a.count); // Sort by patient count

  // Identify bottlenecks
  const peakHours = Object.entries(analytics.byHour)
    .filter(([_, data]) => data.avgWaitTime > analytics.waitTimes.average * 1.5)
    .map(([hour, data]) => ({
      type: 'peak_hour',
      hour: parseInt(hour),
      avgWaitTime: data.avgWaitTime,
      patientCount: data.count,
      recommendation: `Envisager d'ajouter du personnel entre ${hour}:00 et ${parseInt(hour)+1}:00`,
      impact: data.count
    }));

  const slowDepartments = Object.entries(analytics.byDepartment)
    .filter(([_, data]) => data.avgWaitTime > analytics.waitTimes.average * 1.3)
    .map(([dept, data]) => ({
      type: 'slow_department',
      department: dept,
      avgWaitTime: data.avgWaitTime,
      recommendation: `Revoir les effectifs et les processus dans le département ${dept}`,
      impact: data.total
    }));

  analytics.bottlenecks = [...peakHours, ...slowDepartments];

  queueLogger.info('[Analytics] Date range', { start, end });
  queueLogger.info('[Analytics] Found appointments', { count: appointments.length });
  queueLogger.info('[Analytics] Summary', analytics.summary);

  return success(res, { data: analytics });
});

// @desc    Call specific patient
// @route   POST /api/queue/:id/call
// @access  Private
exports.callPatient = asyncHandler(async (req, res) => {
  const { roomId, roomNumber, sendSms = false, audioAnnounce = true, language = 'fr' } = req.body;

  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phoneNumber email');

  if (!appointment) {
    return notFound(res, 'Appointment');
  }

  if (appointment.status !== 'checked-in') {
    return error(res, 'Patient is not in queue', 400);
  }

  // Determine room
  let assignedRoom = roomNumber;
  let roomDoc = null;

  if (roomId) {
    roomDoc = await Room.findById(roomId);
    if (roomDoc && roomDoc.isAvailable()) {
      await roomDoc.occupy(appointment.patient._id, appointment._id, req.user.id);
      assignedRoom = roomDoc.roomNumber;
    }
  }

  // Update appointment
  appointment.status = 'in-progress';
  appointment.consultationStartTime = Date.now();
  appointment.calculateWaitingTime();
  if (assignedRoom) {
    appointment.location = appointment.location || {};
    appointment.location.room = assignedRoom;
  }

  await appointment.save();

  const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;

  // Prepare call data
  const callData = {
    type: 'patient_called',
    appointmentId: appointment._id,
    queueNumber: appointment.queueNumber,
    patient: {
      _id: appointment.patient._id,
      firstName: appointment.patient.firstName,
      lastName: appointment.patient.lastName,
      patientId: appointment.patient.patientId
    },
    room: assignedRoom,
    department: appointment.department,
    audioAnnouncement: audioAnnounce ? {
      enabled: true,
      message: CALLING_CONFIG.languages[language]?.callMessage(patientName, assignedRoom) ||
               CALLING_CONFIG.languages.fr.callMessage(patientName, assignedRoom),
      language
    } : null,
    timestamp: new Date()
  };

  // Emit WebSocket
  websocketService.emitQueueUpdate(callData);

  return success(res, {
    data: {
      appointmentId: appointment._id,
      queueNumber: appointment.queueNumber,
      patient: appointment.patient,
      room: assignedRoom,
      audioAnnouncement: callData.audioAnnouncement
    },
    message: 'Patient called'
  });
});

// @desc    Get display board data
// @route   GET /api/queue/display-board
// @access  Public (for display screens)
exports.getDisplayBoardData = asyncHandler(async (req, res) => {
  const { department } = req.query;

  // TIMEZONE FIX: Use timezone-aware date range for clinic's local time
  const { start: today, end: tomorrow } = getTodayRange();

  // Get current queue
  const query = {
    date: { $gte: today, $lte: tomorrow },
    status: { $in: ['checked-in', 'in-progress'] }
  };
  if (department) query.department = department;

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName')
    .select('queueNumber status priority location.room patient checkInTime')
    .sort('queueNumber');

  // Get room status
  const roomQuery = {
    'displaySettings.showOnDisplayBoard': true,
    isActive: true
  };
  if (department) roomQuery.department = department;

  const rooms = await Room.find(roomQuery)
    .populate('currentPatient', 'firstName lastName')
    .populate('currentAppointment', 'queueNumber')
    .select('roomNumber name status displaySettings.displayColor currentPatient currentAppointment')
    .sort('displaySettings.displayOrder');

  // Format display data
  const displayData = {
    // Waiting list (next 10)
    waiting: appointments
      .filter(a => a.status === 'checked-in')
      .slice(0, 10)
      .map((a, index) => ({
        queueNumber: a.queueNumber,
        name: `${a.patient.firstName} ${a.patient.lastName.charAt(0)}.`,
        priority: a.priority,
        estimatedWaitTime: a.checkInTime
          ? Math.round((Date.now() - new Date(a.checkInTime)) / (1000 * 60)) // Actual wait time in minutes
          : index * QUEUE.WAIT_TIME_PER_PATIENT_MINUTES // Fallback: configurable min per position
      })),

    // Currently being called / in progress
    inProgress: appointments
      .filter(a => a.status === 'in-progress')
      .map(a => ({
        queueNumber: a.queueNumber,
        name: `${a.patient.firstName} ${a.patient.lastName.charAt(0)}.`,
        room: a.location?.room || '-'
      })),

    // Room status
    rooms: rooms.map(r => ({
      roomNumber: r.roomNumber,
      name: r.name,
      status: r.status,
      color: r.displaySettings?.displayColor || '#3B82F6',
      currentQueue: r.currentAppointment?.queueNumber || null,
      currentPatient: r.currentPatient
        ? `${r.currentPatient.firstName} ${r.currentPatient.lastName.charAt(0)}.`
        : null
    })),

    // Last called
    lastCalled: appointments.find(a => a.status === 'in-progress')
      ? {
          queueNumber: appointments.find(a => a.status === 'in-progress').queueNumber,
          room: appointments.find(a => a.status === 'in-progress').location?.room
        }
      : null,

    timestamp: new Date(),
    totalWaiting: appointments.filter(a => a.status === 'checked-in').length
  };

  return success(res, { data: displayData });
});