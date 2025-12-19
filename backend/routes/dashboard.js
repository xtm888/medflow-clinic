const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalClinic } = require('../middleware/clinicAuth');
const Appointment = require('../models/Appointment');
const Visit = require('../models/Visit');
const Prescription = require('../models/Prescription');
const Invoice = require('../models/Invoice');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get first day of current month
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Multi-clinic: Build base query with clinic filter
  const clinicFilter = (req.clinicId && !req.accessAllClinics) ? { clinic: req.clinicId } : {};

  const [todayAppointments, waitingCount, pendingPrescriptions, todayRevenue, todayConsultations, monthlyStats] = await Promise.all([
    Appointment.countDocuments({
      ...clinicFilter,
      date: { $gte: today, $lt: tomorrow }
    }),
    Appointment.countDocuments({
      ...clinicFilter,
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ['checked-in', 'in-progress'] }  // Match queue page logic - only show actually waiting/in-progress
    }),
    Prescription.countDocuments({ ...clinicFilter, status: 'pending' }),
    Invoice.aggregate([
      {
        $match: {
          ...clinicFilter,
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$summary.amountPaid' }
        }
      }
    ]),
    // Today's completed consultations (visits)
    Visit.countDocuments({
      ...clinicFilter,
      visitDate: { $gte: today, $lt: tomorrow }
    }),
    // This month's totals
    Promise.all([
      // Monthly visits count
      Visit.countDocuments({
        ...clinicFilter,
        visitDate: { $gte: firstDayOfMonth, $lt: firstDayOfNextMonth }
      }),
      // Monthly revenue
      Invoice.aggregate([
        {
          $match: {
            ...clinicFilter,
            createdAt: { $gte: firstDayOfMonth, $lt: firstDayOfNextMonth },
            status: { $in: ['paid', 'partial'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$summary.amountPaid' }
          }
        }
      ]),
      // Monthly appointments count
      Appointment.countDocuments({
        ...clinicFilter,
        date: { $gte: firstDayOfMonth, $lt: firstDayOfNextMonth }
      })
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      todayPatients: todayAppointments,
      waitingNow: waitingCount,
      revenue: todayRevenue[0]?.total || 0,
      pendingPrescriptions,
      todayConsultations,
      monthlyVisits: monthlyStats[0],
      monthlyRevenue: monthlyStats[1][0]?.total || 0,
      monthlyAppointments: monthlyStats[2]
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

  // Multi-clinic: Filter by clinic unless admin with accessAllClinics
  if (req.clinicId && !req.accessAllClinics) {
    query.clinic = req.clinicId;
  }

  // If user is a provider, filter by their appointments
  if (['doctor', 'ophthalmologist', 'orthoptist'].includes(req.user.role)) {
    query.provider = req.user.id;
  }

  const appointments = await Appointment.find(query)
    .populate('patient', 'firstName lastName patientId')
    .sort('startTime')
    .lean();

  const tasks = appointments.map(apt => {
    const patientId = apt.patient?._id;
    const patientName = apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Unknown Patient';

    // Determine task type and link based on user role and appointment status
    let taskDescription = apt.reason || apt.type || 'Consultation';
    let taskLink = '/queue';

    switch (req.user.role) {
      case 'receptionist':
      case 'secretary':
        // Receptionists handle check-ins
        if (apt.status === 'scheduled' || apt.status === 'confirmed') {
          taskDescription = `Enregistrement - ${apt.reason || apt.type || 'Consultation'}`;
          taskLink = '/queue';
        } else {
          taskLink = `/patients/${patientId}`;
        }
        break;

      case 'doctor':
      case 'ophthalmologist':
        // Doctors handle consultations
        if (apt.status === 'checked-in' || apt.status === 'in-progress') {
          taskDescription = `Consultation - ${apt.reason || apt.type || 'Examen'}`;
          taskLink = `/ophthalmology/new-consultation?patientId=${patientId}`;
        } else {
          taskDescription = `RDV prévu - ${apt.reason || apt.type || 'Consultation'}`;
          taskLink = '/queue';
        }
        break;

      case 'nurse':
        // Nurses handle vitals and triage
        if (apt.status === 'checked-in') {
          taskDescription = `Signes vitaux - ${patientName}`;
          taskLink = `/nurse/vitals/${patientId}`;
        } else {
          taskDescription = `Préparer - ${apt.reason || apt.type || 'Consultation'}`;
          taskLink = `/patients/${patientId}`;
        }
        break;

      case 'orthoptist':
        // Orthoptists handle orthoptic exams
        if (apt.status === 'checked-in' || apt.status === 'in-progress') {
          taskDescription = `Examen orthoptique - ${patientName}`;
          taskLink = `/orthoptic-exams?patientId=${patientId}`;
        } else {
          taskLink = '/queue';
        }
        break;

      case 'pharmacist':
        // Pharmacists see prescription tasks (different endpoint should provide this)
        taskDescription = apt.reason || 'Consultation programmée';
        taskLink = `/patients/${patientId}?tab=prescriptions`;
        break;

      case 'admin':
      default:
        // Admins get overview links
        taskLink = `/patients/${patientId}`;
        break;
    }

    return {
      id: apt._id,
      type: 'appointment',
      title: patientName,
      description: taskDescription,
      time: apt.date ? new Date(apt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      priority: apt.priority || 'normal',
      link: taskLink,
      patientId: patientId,
      appointmentId: apt._id,
      status: apt.status
    };
  });

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

  // Multi-clinic: Filter by clinic unless admin with accessAllClinics
  if (req.clinicId && !req.accessAllClinics) {
    query.clinic = req.clinicId;
  }

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

  // Multi-clinic: Build base clinic filter
  const clinicFilter = (req.clinicId && !req.accessAllClinics) ? { clinic: req.clinicId } : {};

  // Query for user-specific items if provider
  const userQuery = ['doctor', 'ophthalmologist', 'orthoptist'].includes(req.user.role)
    ? { ...clinicFilter, primaryProvider: req.user.id }
    : { ...clinicFilter };

  const prescriberQuery = ['doctor', 'ophthalmologist'].includes(req.user.role)
    ? { ...clinicFilter, prescriber: req.user.id }
    : { ...clinicFilter };

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
    const patientId = data.patient?._id;

    // Determine link based on role
    let actionLink = `/patients/${patientId}?tab=ophthalmology`;
    if (['doctor', 'ophthalmologist'].includes(req.user.role)) {
      // Doctors go to ophthalmology section to see/sign visits
      actionLink = `/patients/${patientId}?tab=ophthalmology`;
    } else if (req.user.role === 'admin') {
      // Admins can see all unsigned notes
      actionLink = `/patients/${patientId}?tab=ophthalmology`;
    }
    // Other roles shouldn't see these, but if they do, link to patient

    actions.push({
      id: data.mostRecentId,
      type: 'unsigned_note',
      title: count > 1 ? `${count} Notes de consultation non signées` : 'Note de consultation non signée',
      description: `Patient: ${patientName} - ${new Date(data.mostRecentDate).toLocaleDateString('fr-FR')}`,
      urgency: 'high',
      patient: patientName,
      patientId: patientId,
      link: actionLink,
      visitId: data.mostRecentId
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
    const patientId = p.patient?._id;

    // Determine link based on role
    let actionLink = `/patients/${patientId}?tab=prescriptions`;
    if (req.user.role === 'pharmacist') {
      // Pharmacists go to pharmacy dashboard to process
      actionLink = `/pharmacy?prescriptionId=${p._id}`;
    } else if (['doctor', 'ophthalmologist'].includes(req.user.role)) {
      // Doctors review/edit prescriptions
      actionLink = `/prescriptions/${p._id}`;
    } else if (req.user.role === 'admin') {
      actionLink = `/prescriptions/${p._id}`;
    }

    actions.push({
      id: p._id,
      type: 'prescription_pending',
      title: 'Prescription en attente',
      description: `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`,
      urgency: 'medium',
      patient: `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`,
      patientId: patientId,
      link: actionLink,
      prescriptionId: p._id
    });
  });

  // Get overdue follow-ups
  const overdueFollowups = await Appointment.find({
    ...clinicFilter,
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
    const patientId = a.patient?._id;

    // Determine link based on role
    let actionLink = `/patients/${patientId}?tab=appointments`;
    if (['receptionist', 'secretary'].includes(req.user.role)) {
      // Receptionists reschedule appointments
      actionLink = `/appointments?appointmentId=${a._id}`;
    } else if (['doctor', 'ophthalmologist'].includes(req.user.role)) {
      // Doctors view patient appointments
      actionLink = `/patients/${patientId}?tab=appointments`;
    } else if (req.user.role === 'admin') {
      actionLink = `/appointments?appointmentId=${a._id}`;
    }

    actions.push({
      id: a._id,
      type: 'overdue_followup',
      title: 'Suivi en retard',
      description: `${a.patient?.firstName || ''} ${a.patient?.lastName || ''} - Prévu le ${new Date(a.date).toLocaleDateString('fr-FR')}`,
      urgency: 'high',
      patient: `${a.patient?.firstName || ''} ${a.patient?.lastName || ''}`,
      patientId: patientId,
      link: actionLink,
      appointmentId: a._id
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

  const startDate = new Date();
  if (period === '7days') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30days') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === '90days') {
    startDate.setDate(startDate.getDate() - 90);
  }

  // Multi-clinic: Build clinic filter for aggregation
  const clinicFilter = (req.clinicId && !req.accessAllClinics) ? { clinic: req.clinicId } : {};

  const trends = await Invoice.aggregate([
    {
      $match: {
        ...clinicFilter,
        createdAt: { $gte: startDate },
        status: 'paid'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        revenue: { $sum: '$summary.amountPaid' },
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
