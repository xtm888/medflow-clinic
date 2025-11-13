const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');

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

  // Filter by date
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
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

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('provider', 'firstName lastName specialization')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort);

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
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  res.status(200).json({
    success: true,
    data: appointment
  });
});

// @desc    Create appointment
// @route   POST /api/appointments
// @access  Private
exports.createAppointment = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  // Check if patient exists
  const patient = await Patient.findById(req.body.patient);
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Check for appointment conflicts
  const appointment = new Appointment(req.body);
  const hasConflict = await appointment.hasConflict();

  if (hasConflict) {
    return res.status(409).json({
      success: false,
      error: 'Time slot already booked for this provider'
    });
  }

  await appointment.save();

  // Update patient's next appointment
  patient.nextAppointment = appointment.date;
  await patient.save();

  // Populate provider and patient for response
  await appointment.populate('patient', 'firstName lastName patientId');
  await appointment.populate('provider', 'firstName lastName');

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

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  res.status(200).json({
    success: true,
    data: appointment
  });
});

// @desc    Cancel appointment
// @route   PUT /api/appointments/:id/cancel
// @access  Private
exports.cancelAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  appointment.status = 'cancelled';
  appointment.cancellation = {
    cancelledAt: Date.now(),
    cancelledBy: req.user.id,
    reason: req.body.reason
  };
  appointment.updatedBy = req.user.id;

  await appointment.save();

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully',
    data: appointment
  });
});

// @desc    Check in appointment
// @route   PUT /api/appointments/:id/checkin
// @access  Private
exports.checkInAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  appointment.status = 'checked-in';
  appointment.checkInTime = Date.now();
  appointment.queueNumber = await generateQueueNumber();
  appointment.updatedBy = req.user.id;

  await appointment.save();

  res.status(200).json({
    success: true,
    message: 'Patient checked in successfully',
    data: {
      queueNumber: appointment.queueNumber,
      appointment
    }
  });
});

// @desc    Complete appointment
// @route   PUT /api/appointments/:id/complete
// @access  Private (Doctor, Ophthalmologist)
exports.completeAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
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

  // Update patient's last visit
  await Patient.findByIdAndUpdate(appointment.patient, {
    lastVisit: Date.now()
  });

  res.status(200).json({
    success: true,
    message: 'Appointment completed successfully',
    data: appointment
  });
});

// @desc    Get available time slots
// @route   GET /api/appointments/available-slots
// @access  Private
exports.getAvailableSlots = asyncHandler(async (req, res, next) => {
  const { date, provider, duration = 30 } = req.query;

  if (!date || !provider) {
    return res.status(400).json({
      success: false,
      error: 'Date and provider are required'
    });
  }

  // Get provider's working hours (simplified example)
  const workingHours = {
    start: '09:00',
    end: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00'
  };

  // Get existing appointments for the date and provider
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const appointments = await Appointment.find({
    provider,
    date: { $gte: startDate, $lte: endDate },
    status: { $nin: ['cancelled', 'no-show'] }
  }).select('startTime endTime');

  // Generate available slots
  const slots = generateTimeSlots(workingHours, appointments, duration);

  res.status(200).json({
    success: true,
    data: slots
  });
});

// @desc    Get today's appointments
// @route   GET /api/appointments/today
// @access  Private
exports.getTodaysAppointments = asyncHandler(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const query = {
    date: { $gte: today, $lt: tomorrow }
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
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
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

  res.status(200).json({
    success: true,
    message: 'Appointment rescheduled successfully',
    data: appointment
  });
});

// Helper functions
async function generateQueueNumber() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const count = await Appointment.countDocuments({
    checkInTime: { $gte: today, $lt: tomorrow }
  });

  return count + 1;
}

function generateTimeSlots(workingHours, appointments, duration) {
  const slots = [];
  const { start, end, breakStart, breakEnd } = workingHours;

  // Convert times to minutes for easier calculation
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const breakStartMin = timeToMinutes(breakStart);
  const breakEndMin = timeToMinutes(breakEnd);

  for (let time = startMin; time < endMin; time += duration) {
    // Skip break time
    if (time >= breakStartMin && time < breakEndMin) {
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