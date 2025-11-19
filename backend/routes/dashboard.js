const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Appointment = require('../models/Appointment');
const Visit = require('../models/Visit');
const Prescription = require('../models/Prescription');
const Invoice = require('../models/Invoice');

// Protect all routes
router.use(protect);

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayAppointments, waitingCount, pendingPrescriptions, todayRevenue] = await Promise.all([
    Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    }),
    Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'checked-in'
    }),
    Prescription.countDocuments({ status: 'pending' }),
    Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      todayPatients: todayAppointments,
      waitingNow: waitingCount,
      revenue: todayRevenue[0]?.total || 0,
      pendingPrescriptions
    }
  });
}));

// @desc    Get today's tasks for current user
// @route   GET /api/dashboard/today-tasks
// @access  Private
router.get('/today-tasks', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get appointments for current user (if provider) or all (if admin/receptionist)
  const query = {
    date: { $gte: today, $lt: tomorrow },
    status: { $in: ['scheduled', 'confirmed', 'checked-in'] }
  };

  // If user is a provider, filter by their appointments
  if (['doctor', 'ophthalmologist', 'orthoptist'].includes(req.user.role)) {
    query.provider = req.user.id;
  }

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId')
    .sort('startTime')
    .lean();

  const tasks = appointments.map(apt => ({
    id: apt._id,
    type: 'appointment',
    title: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Unknown Patient',
    description: apt.reason || apt.type || 'Consultation',
    time: apt.startTime ? new Date(apt.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
    priority: apt.priority || 'normal',
    link: '/queue'
  }));

  res.status(200).json({
    success: true,
    data: tasks
  });
}));

// @desc    Get recent patients for current user
// @route   GET /api/dashboard/recent-patients
// @access  Private
router.get('/recent-patients', asyncHandler(async (req, res) => {
  // Get recent visits
  const query = {};

  // If user is a provider, filter by their visits
  if (['doctor', 'ophthalmologist', 'orthoptist'].includes(req.user.role)) {
    query.primaryProvider = req.user.id;
  }

  // Fetch more visits to ensure we get enough unique patients after de-duplication
  const visits = await Visit.find(query)
    .sort('-visitDate')
    .limit(50)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .lean();

  // De-duplicate by patient ID, keeping only the most recent visit per patient
  const patientMap = new Map();
  visits.forEach(v => {
    if (v.patient && !patientMap.has(v.patient._id.toString())) {
      patientMap.set(v.patient._id.toString(), v);
    }
  });

  // Convert to array and limit to 10 unique patients
  const patients = Array.from(patientMap.values()).slice(0, 10).map(v => {
    // Calculate age if dateOfBirth exists
    let age = null;
    if (v.patient?.dateOfBirth) {
      const dob = new Date(v.patient.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - dob.getFullYear();
    }

    return {
      id: v.patient?._id,
      patientId: v.patient?.patientId,
      firstName: v.patient?.firstName || 'Unknown',
      lastName: v.patient?.lastName || '',
      age,
      visitType: v.visitType,
      visitDate: v.visitDate
    };
  });

  res.status(200).json({
    success: true,
    data: patients
  });
}));

// @desc    Get pending actions for current user
// @route   GET /api/dashboard/pending-actions
// @access  Private
router.get('/pending-actions', asyncHandler(async (req, res) => {
  const actions = [];

  // Query for user-specific items if provider
  const userQuery = ['doctor', 'ophthalmologist', 'orthoptist'].includes(req.user.role)
    ? { primaryProvider: req.user.id }
    : {};

  const prescriberQuery = ['doctor', 'ophthalmologist'].includes(req.user.role)
    ? { prescriber: req.user.id }
    : {};

  // Get unsigned visits
  const unsignedVisits = await Visit.find({
    ...userQuery,
    signatureStatus: { $in: ['pending', 'unsigned'] }
  })
    .populate('patient', 'firstName lastName')
    .sort('-visitDate')
    .limit(50)
    .lean();

  // Group unsigned visits by patient
  const unsignedByPatient = new Map();
  unsignedVisits.forEach(v => {
    if (v.patient) {
      const patientId = v.patient._id.toString();
      if (!unsignedByPatient.has(patientId)) {
        unsignedByPatient.set(patientId, {
          patient: v.patient,
          visits: [],
          mostRecentDate: v.visitDate,
          mostRecentId: v._id
        });
      }
      unsignedByPatient.get(patientId).visits.push(v);
    }
  });

  // Create one action per patient with count
  unsignedByPatient.forEach(data => {
    const count = data.visits.length;
    const patientName = `${data.patient?.firstName || ''} ${data.patient?.lastName || ''}`;
    actions.push({
      id: data.mostRecentId,
      type: 'unsigned_note',
      title: count > 1 ? `${count} Notes de consultation non signées` : 'Note de consultation non signée',
      description: `Patient: ${patientName} - ${new Date(data.mostRecentDate).toLocaleDateString('fr-FR')}`,
      urgency: 'high',
      patient: patientName,
      link: `/visits/${data.mostRecentId}`
    });
  });

  // Get pending prescriptions
  const pendingPrescriptions = await Prescription.find({
    ...prescriberQuery,
    status: 'pending'
  })
    .populate('patient', 'firstName lastName')
    .sort('-createdAt')
    .limit(10)
    .lean();

  pendingPrescriptions.forEach(p => {
    actions.push({
      id: p._id,
      type: 'prescription_pending',
      title: 'Prescription en attente',
      description: `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`,
      urgency: 'medium',
      patient: `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`,
      link: '/prescriptions'
    });
  });

  // Get overdue follow-ups
  const overdueFollowups = await Appointment.find({
    ...(userQuery.primaryProvider ? { provider: userQuery.primaryProvider } : {}),
    type: 'follow-up',
    date: { $lt: new Date() },
    status: 'scheduled'
  })
    .populate('patient', 'firstName lastName')
    .sort('date')
    .limit(5)
    .lean();

  overdueFollowups.forEach(a => {
    actions.push({
      id: a._id,
      type: 'overdue_followup',
      title: 'Suivi en retard',
      description: `${a.patient?.firstName || ''} ${a.patient?.lastName || ''} - Prévu le ${new Date(a.date).toLocaleDateString('fr-FR')}`,
      urgency: 'high',
      patient: `${a.patient?.firstName || ''} ${a.patient?.lastName || ''}`,
      link: '/appointments'
    });
  });

  res.status(200).json({
    success: true,
    data: actions
  });
}));

// @desc    Get revenue trends
// @route   GET /api/dashboard/revenue-trends
// @access  Private
router.get('/revenue-trends', asyncHandler(async (req, res) => {
  const { period = '30days' } = req.query;

  let startDate = new Date();
  if (period === '7days') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30days') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === '90days') {
    startDate.setDate(startDate.getDate() - 90);
  }

  const trends = await Invoice.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: 'paid'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: trends.map(t => ({
      date: t._id,
      revenue: t.revenue,
      invoiceCount: t.count
    }))
  });
}));

module.exports = router;
