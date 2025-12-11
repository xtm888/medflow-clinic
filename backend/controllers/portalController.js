const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Invoice = require('../models/Invoice');
const Visit = require('../models/Visit');
const { asyncHandler } = require('../middleware/errorHandler');

// Helper to get patient from user
const getPatientFromUser = async (userId) => {
  // For patient portal, we need to link user to patient
  // This could be via email match or a direct link
  // Escape special regex characters to prevent ReDoS/injection attacks
  const escapedUserId = userId.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patient = await Patient.findOne({
    $or: [
      { userId: userId },
      { email: { $regex: new RegExp(`^${escapedUserId}$`, 'i') } }
    ]
  });
  return patient;
};

// @desc    Get patient portal dashboard data
// @route   GET /api/portal/dashboard
// @access  Private (Patient)
exports.getDashboard = asyncHandler(async (req, res) => {
  // Get patient record linked to this user
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    // If no patient record, return user as patient (for staff using portal)
    return res.status(200).json({
      success: true,
      data: {
        upcomingAppointments: 0,
        activePrescriptions: 0,
        pendingResults: 0,
        outstandingBalance: 0,
        nextAppointment: null,
        recentPrescriptions: [],
        recentInvoices: []
      }
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    upcomingAppointments,
    activePrescriptions,
    outstandingInvoices,
    pendingLabResults,
    nextAppointment,
    recentPrescriptions,
    recentInvoices
  ] = await Promise.all([
    // Count upcoming appointments
    Appointment.countDocuments({
      patient: patient._id,
      date: { $gte: today },
      status: { $in: ['scheduled', 'confirmed'] }
    }),
    // Count active prescriptions
    Prescription.countDocuments({
      patient: patient._id,
      status: { $in: ['pending', 'active'] }
    }),
    // Get outstanding balance
    Invoice.aggregate([
      {
        $match: {
          patient: patient._id,
          status: { $in: ['issued', 'sent', 'partial'] },
          'summary.amountDue': { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$summary.amountDue' }
        }
      }
    ]),
    // Count pending lab results
    Visit.aggregate([
      {
        $match: { patient: patient._id }
      },
      {
        $unwind: { path: '$laboratoryOrders', preserveNullAndEmptyArrays: false }
      },
      {
        $match: {
          'laboratoryOrders.status': { $in: ['ordered', 'collected', 'processing'] }
        }
      },
      {
        $count: 'pendingCount'
      }
    ]),
    // Get next appointment
    Appointment.findOne({
      patient: patient._id,
      date: { $gte: today },
      status: { $in: ['scheduled', 'confirmed'] }
    })
      .populate('provider', 'firstName lastName')
      .sort('date startTime'),
    // Get recent prescriptions
    Prescription.find({ patient: patient._id })
      .populate('prescriber', 'firstName lastName')
      .sort('-createdAt')
      .limit(3),
    // Get recent invoices
    Invoice.find({ patient: patient._id })
      .sort('-dateIssued')
      .limit(3)
  ]);

  res.status(200).json({
    success: true,
    data: {
      upcomingAppointments,
      activePrescriptions,
      pendingResults: pendingLabResults[0]?.pendingCount || 0,
      outstandingBalance: outstandingInvoices[0]?.total || 0,
      nextAppointment,
      recentPrescriptions,
      recentInvoices
    }
  });
});

// @desc    Get patient's appointments
// @route   GET /api/portal/appointments
// @access  Private (Patient)
exports.getMyAppointments = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    return res.status(200).json({
      success: true,
      data: { upcoming: [], past: [] }
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [upcoming, past] = await Promise.all([
    Appointment.find({
      patient: patient._id,
      date: { $gte: today },
      status: { $nin: ['cancelled'] }
    })
      .populate('provider', 'firstName lastName specialization')
      .sort('date startTime'),
    Appointment.find({
      patient: patient._id,
      date: { $lt: today }
    })
      .populate('provider', 'firstName lastName')
      .sort('-date')
      .limit(20)
  ]);

  res.status(200).json({
    success: true,
    data: { upcoming, past }
  });
});

// @desc    Request a new appointment
// @route   POST /api/portal/appointments
// @access  Private (Patient)
exports.requestAppointment = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    return res.status(400).json({
      success: false,
      error: 'No patient profile found for this user'
    });
  }

  const { date, time, type, reason, preferredProvider, department } = req.body;

  // Generate appointment ID
  const appointmentDate = new Date(date);
  const year = appointmentDate.getFullYear();
  const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
  const day = String(appointmentDate.getDate()).padStart(2, '0');
  const aptCount = await Appointment.countDocuments({
    date: {
      $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
      $lt: new Date(appointmentDate.setHours(23, 59, 59, 999))
    }
  });
  const appointmentId = `APT${year}${month}${day}${String(aptCount + 1).padStart(4, '0')}`;

  // Calculate end time (30 minutes after start)
  const [hours, minutes] = time.split(':').map(Number);
  const endHours = Math.floor((hours * 60 + minutes + 30) / 60);
  const endMinutes = (hours * 60 + minutes + 30) % 60;
  const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

  const appointment = await Appointment.create({
    appointmentId,
    patient: patient._id,
    date: new Date(date),
    startTime: time,
    endTime,
    type: type || 'consultation',
    reason: reason || 'Appointment request',
    provider: preferredProvider || req.user.id, // Use requester if no provider specified
    department: department || 'general',
    status: 'pending', // Needs staff confirmation
    priority: 'normal',
    source: 'patient-portal',
    notes: `Requested via patient portal: ${reason || ''}`,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Appointment request submitted successfully',
    data: appointment
  });
});

// @desc    Cancel an appointment
// @route   PUT /api/portal/appointments/:id/cancel
// @access  Private (Patient)
exports.cancelMyAppointment = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    return res.status(400).json({
      success: false,
      error: 'No patient profile found'
    });
  }

  const appointment = await Appointment.findOne({
    _id: req.params.id,
    patient: patient._id
  });

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  // Can only cancel future appointments
  if (new Date(appointment.date) < new Date()) {
    return res.status(400).json({
      success: false,
      error: 'Cannot cancel past appointments'
    });
  }

  appointment.status = 'cancelled';
  appointment.cancellationReason = req.body.reason || 'Cancelled by patient';
  appointment.cancelledBy = req.user.id;
  appointment.cancelledAt = new Date();
  await appointment.save();

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully'
  });
});

// @desc    Get patient's prescriptions
// @route   GET /api/portal/prescriptions
// @access  Private (Patient)
exports.getMyPrescriptions = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    return res.status(200).json({
      success: true,
      data: []
    });
  }

  const prescriptions = await Prescription.find({ patient: patient._id })
    .populate('prescriber', 'firstName lastName specialization')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    data: prescriptions
  });
});

// @desc    Get patient's invoices/bills
// @route   GET /api/portal/bills
// @access  Private (Patient)
exports.getMyBills = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    return res.status(200).json({
      success: true,
      data: { invoices: [], summary: { total: 0, paid: 0, due: 0 } }
    });
  }

  const [invoices, summary] = await Promise.all([
    Invoice.find({ patient: patient._id })
      .sort('-dateIssued')
      .limit(50),
    Invoice.aggregate([
      { $match: { patient: patient._id } },
      {
        $group: {
          _id: null,
          total: { $sum: '$summary.total' },
          paid: { $sum: '$summary.amountPaid' },
          due: { $sum: '$summary.amountDue' }
        }
      }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      invoices,
      summary: summary[0] || { total: 0, paid: 0, due: 0 }
    }
  });
});

// @desc    Get patient's profile
// @route   GET /api/portal/profile
// @access  Private (Patient)
exports.getMyProfile = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    // Return user data if no patient record
    const User = require('../models/User');
    const user = await User.findById(req.user.id)
      .select('-password -twoFactorSecret -sessions');

    return res.status(200).json({
      success: true,
      data: user
    });
  }

  res.status(200).json({
    success: true,
    data: patient
  });
});

// @desc    Update patient's profile
// @route   PUT /api/portal/profile
// @access  Private (Patient)
exports.updateMyProfile = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient profile not found'
    });
  }

  // Only allow updating certain fields
  const allowedFields = [
    'phoneNumber',
    'email',
    'address',
    'emergencyContact'
  ];

  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const updatedPatient = await Patient.findByIdAndUpdate(
    patient._id,
    updates,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedPatient
  });
});

// @desc    Get patient's medical results
// @route   GET /api/portal/results
// @access  Private (Patient)
exports.getMyResults = asyncHandler(async (req, res) => {
  const patient = await getPatientFromUser(req.user.id);

  if (!patient) {
    return res.status(200).json({
      success: true,
      data: []
    });
  }

  // Get visits with results/findings
  const visits = await Visit.find({
    patient: patient._id,
    'diagnosis.0': { $exists: true }
  })
    .populate('primaryProvider', 'firstName lastName')
    .sort('-visitDate')
    .limit(20)
    .select('visitDate visitType diagnosis notes');

  res.status(200).json({
    success: true,
    data: visits
  });
});

// @desc    Get available appointment slots
// @route   GET /api/portal/available-slots
// @access  Private (Patient)
exports.getAvailableSlots = asyncHandler(async (req, res) => {
  const { date, providerId, type } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      error: 'Date is required'
    });
  }

  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(selectedDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Get existing appointments for that day
  const query = {
    date: { $gte: selectedDate, $lt: nextDay },
    status: { $nin: ['cancelled'] }
  };

  if (providerId) {
    query.provider = providerId;
  }

  const existingAppointments = await Appointment.find(query)
    .select('startTime endTime');

  // Generate available slots (8am to 6pm, 30 min slots)
  const slots = [];
  const bookedTimes = existingAppointments.map(apt => apt.startTime);

  for (let hour = 8; hour < 18; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      if (!bookedTimes.includes(timeStr)) {
        slots.push({
          time: timeStr,
          available: true
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    data: slots
  });
});
