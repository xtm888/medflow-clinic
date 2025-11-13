const Appointment = require('../models/Appointment');
const { asyncHandler } = require('../middleware/errorHandler');

// In-memory queue for real-time management
let queue = [];

// @desc    Get current queue
// @route   GET /api/queue
// @access  Private
exports.getCurrentQueue = asyncHandler(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's checked-in appointments
  const appointments = await Appointment.find({
    date: { $gte: today, $lt: tomorrow },
    status: { $in: ['checked-in', 'in-progress'] }
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('provider', 'firstName lastName')
    .sort('queueNumber');

  // Group by department/provider
  const queues = {};
  appointments.forEach(apt => {
    const key = apt.department || 'general';
    if (!queues[key]) {
      queues[key] = [];
    }
    queues[key].push({
      queueNumber: apt.queueNumber,
      patient: apt.patient,
      provider: apt.provider,
      appointmentId: apt._id,
      checkInTime: apt.checkInTime,
      status: apt.status,
      priority: apt.priority,
      estimatedWaitTime: calculateEstimatedWaitTime(apt, queues[key])
    });
  });

  res.status(200).json({
    success: true,
    data: queues,
    stats: {
      totalWaiting: appointments.filter(a => a.status === 'checked-in').length,
      inProgress: appointments.filter(a => a.status === 'in-progress').length,
      averageWaitTime: calculateAverageWaitTime(appointments)
    }
  });
});

// @desc    Add patient to queue
// @route   POST /api/queue
// @access  Private
exports.addToQueue = asyncHandler(async (req, res, next) => {
  const { appointmentId, priority } = req.body;

  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName patientId');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  if (appointment.status === 'checked-in') {
    return res.status(400).json({
      success: false,
      error: 'Patient already in queue'
    });
  }

  // Generate queue number
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const count = await Appointment.countDocuments({
    checkInTime: { $gte: today, $lt: tomorrow }
  });

  appointment.status = 'checked-in';
  appointment.checkInTime = Date.now();
  appointment.queueNumber = count + 1;
  if (priority) appointment.priority = priority;

  await appointment.save();

  res.status(200).json({
    success: true,
    message: 'Patient added to queue',
    data: {
      queueNumber: appointment.queueNumber,
      position: await getQueuePosition(appointment),
      estimatedWaitTime: calculateEstimatedWaitTime(appointment)
    }
  });
});

// @desc    Update queue status
// @route   PUT /api/queue/:id
// @access  Private
exports.updateQueueStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  const oldStatus = appointment.status;
  appointment.status = status;

  // Track consultation times
  if (status === 'in-progress' && oldStatus === 'checked-in') {
    appointment.consultationStartTime = Date.now();
    appointment.calculateWaitingTime();
  } else if (status === 'completed' && oldStatus === 'in-progress') {
    appointment.consultationEndTime = Date.now();
  }

  await appointment.save();

  res.status(200).json({
    success: true,
    message: 'Queue status updated',
    data: appointment
  });
});

// @desc    Remove from queue
// @route   DELETE /api/queue/:id
// @access  Private
exports.removeFromQueue = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  appointment.status = 'scheduled';
  appointment.queueNumber = null;
  appointment.checkInTime = null;

  await appointment.save();

  res.status(200).json({
    success: true,
    message: 'Patient removed from queue'
  });
});

// @desc    Call next patient
// @route   POST /api/queue/next
// @access  Private (Doctor, Nurse)
exports.callNext = asyncHandler(async (req, res, next) => {
  const { department = 'general', room } = req.body;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find next patient in queue
  let query = {
    date: { $gte: today, $lt: tomorrow },
    status: 'checked-in',
    department
  };

  // If doctor/ophthalmologist, filter by provider
  if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    query.provider = req.user.id;
  }

  const nextPatient = await Appointment.findOne(query)
    .populate('patient', 'firstName lastName patientId')
    .sort('priority queueNumber');

  if (!nextPatient) {
    return res.status(404).json({
      success: false,
      error: 'No patients in queue'
    });
  }

  // Update status to in-progress
  nextPatient.status = 'in-progress';
  nextPatient.consultationStartTime = Date.now();
  nextPatient.calculateWaitingTime();
  if (room) nextPatient.location.room = room;

  await nextPatient.save();

  res.status(200).json({
    success: true,
    message: 'Next patient called',
    data: {
      queueNumber: nextPatient.queueNumber,
      patient: nextPatient.patient,
      room: nextPatient.location.room,
      waitingTime: nextPatient.waitingTime
    }
  });
});

// @desc    Get queue statistics
// @route   GET /api/queue/stats
// @access  Private
exports.getQueueStats = asyncHandler(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await Appointment.find({
    date: { $gte: today, $lt: tomorrow }
  });

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

  res.status(200).json({
    success: true,
    data: stats
  });
});

// Helper functions
function calculateEstimatedWaitTime(appointment, queueAhead = []) {
  // Simple estimation: 15 minutes per patient ahead
  const patientsAhead = queueAhead.filter(a => a.status === 'checked-in').length;
  return patientsAhead * 15;
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const ahead = await Appointment.countDocuments({
    date: { $gte: today, $lt: tomorrow },
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