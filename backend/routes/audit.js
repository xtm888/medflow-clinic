const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const AuditLog = require('../models/AuditLog');
const { generateAuditReport } = require('../middleware/auditLogger');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { escapeRegex } = require('../utils/sanitize');

/**
 * Generate PDF for audit log export
 * @param {Array} logs - Array of audit log entries
 * @param {Object} options - Export options (startDate, endDate)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateAuditPDF(logs, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: 'Rapport d\'Audit - MedFlow',
          Author: 'MedFlow EMR',
          Creator: 'MedFlow Audit System'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colors
      const colors = {
        primary: '#2563eb',
        header: '#1e3a5f',
        text: '#1e293b',
        lightText: '#64748b',
        border: '#e2e8f0',
        rowAlt: '#f8fafc',
        critical: '#dc2626',
        warning: '#f59e0b',
        success: '#16a34a'
      };

      // Header
      doc.fillColor(colors.header)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('RAPPORT D\'AUDIT', { align: 'center' });

      doc.moveDown(0.5);
      doc.fillColor(colors.lightText)
        .fontSize(10)
        .font('Helvetica')
        .text('MedFlow - Système de Gestion Médicale', { align: 'center' });

      // Date range
      doc.moveDown(1);
      const startStr = options.startDate ? new Date(options.startDate).toLocaleDateString('fr-CD') : 'Non spécifié';
      const endStr = options.endDate ? new Date(options.endDate).toLocaleDateString('fr-CD') : 'Non spécifié';
      doc.fillColor(colors.text)
        .fontSize(10)
        .text(`Période: ${startStr} - ${endStr}`, { align: 'center' });
      doc.text(`Total d'entrées: ${logs.length}`, { align: 'center' });
      doc.text(`Généré le: ${new Date().toLocaleString('fr-CD')}`, { align: 'center' });

      doc.moveDown(1.5);

      // Summary Statistics
      const actionCounts = {};
      const userCounts = {};
      let suspiciousCount = 0;
      let criticalCount = 0;

      logs.forEach(log => {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
        if (log.user) {
          const userName = log.user.firstName ? `${log.user.firstName} ${log.user.lastName}` : 'Système';
          userCounts[userName] = (userCounts[userName] || 0) + 1;
        }
        if (log.security?.suspicious) suspiciousCount++;
        if (log.action?.startsWith('CRITICAL_')) criticalCount++;
      });

      // Stats box
      doc.fillColor(colors.header)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Résumé Statistique');
      doc.moveDown(0.5);

      const topActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      doc.fillColor(colors.text)
        .fontSize(9)
        .font('Helvetica');

      doc.text(`Actions critiques: ${criticalCount}  |  Activités suspectes: ${suspiciousCount}`);
      doc.moveDown(0.3);
      doc.text('Top 5 actions: ' + topActions.map(([action, count]) => `${action} (${count})`).join(', '));

      doc.moveDown(1.5);

      // Table header
      const tableTop = doc.y;
      const colWidths = { date: 80, time: 50, user: 100, action: 140, resource: 150, ip: 80, status: 50 };
      let xPos = 40;

      doc.fillColor(colors.header)
        .rect(40, tableTop, 750, 20)
        .fill();

      doc.fillColor('#ffffff')
        .fontSize(8)
        .font('Helvetica-Bold');

      doc.text('Date', xPos + 5, tableTop + 6, { width: colWidths.date });
      xPos += colWidths.date;
      doc.text('Heure', xPos + 5, tableTop + 6, { width: colWidths.time });
      xPos += colWidths.time;
      doc.text('Utilisateur', xPos + 5, tableTop + 6, { width: colWidths.user });
      xPos += colWidths.user;
      doc.text('Action', xPos + 5, tableTop + 6, { width: colWidths.action });
      xPos += colWidths.action;
      doc.text('Ressource', xPos + 5, tableTop + 6, { width: colWidths.resource });
      xPos += colWidths.resource;
      doc.text('Adresse IP', xPos + 5, tableTop + 6, { width: colWidths.ip });
      xPos += colWidths.ip;
      doc.text('Status', xPos + 5, tableTop + 6, { width: colWidths.status });

      // Table rows
      let rowY = tableTop + 22;
      const rowHeight = 16;
      const maxRowsPerPage = 35;
      let rowCount = 0;

      logs.forEach((log, index) => {
        if (rowCount >= maxRowsPerPage) {
          doc.addPage();
          rowY = 40;
          rowCount = 0;

          // Re-draw header on new page
          doc.fillColor(colors.header)
            .rect(40, rowY, 750, 20)
            .fill();

          xPos = 40;
          doc.fillColor('#ffffff')
            .fontSize(8)
            .font('Helvetica-Bold');

          doc.text('Date', xPos + 5, rowY + 6, { width: colWidths.date });
          xPos += colWidths.date;
          doc.text('Heure', xPos + 5, rowY + 6, { width: colWidths.time });
          xPos += colWidths.time;
          doc.text('Utilisateur', xPos + 5, rowY + 6, { width: colWidths.user });
          xPos += colWidths.user;
          doc.text('Action', xPos + 5, rowY + 6, { width: colWidths.action });
          xPos += colWidths.action;
          doc.text('Ressource', xPos + 5, rowY + 6, { width: colWidths.resource });
          xPos += colWidths.resource;
          doc.text('Adresse IP', xPos + 5, rowY + 6, { width: colWidths.ip });
          xPos += colWidths.ip;
          doc.text('Status', xPos + 5, rowY + 6, { width: colWidths.status });

          rowY += 22;
        }

        // Alternate row background
        if (index % 2 === 0) {
          doc.fillColor(colors.rowAlt)
            .rect(40, rowY, 750, rowHeight)
            .fill();
        }

        // Row data
        const date = new Date(log.createdAt);
        const userName = log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : 'Système';

        // Color based on action type
        let actionColor = colors.text;
        if (log.action?.startsWith('CRITICAL_')) actionColor = colors.critical;
        else if (log.security?.suspicious) actionColor = colors.warning;
        else if (log.action?.includes('SUCCESS')) actionColor = colors.success;

        xPos = 40;
        doc.fillColor(colors.text)
          .fontSize(7)
          .font('Helvetica');

        doc.text(date.toLocaleDateString('fr-CD'), xPos + 5, rowY + 4, { width: colWidths.date - 10 });
        xPos += colWidths.date;
        doc.text(date.toLocaleTimeString('fr-CD'), xPos + 5, rowY + 4, { width: colWidths.time - 10 });
        xPos += colWidths.time;
        doc.text(userName.substring(0, 15), xPos + 5, rowY + 4, { width: colWidths.user - 10 });
        xPos += colWidths.user;
        doc.fillColor(actionColor)
          .text((log.action || '').substring(0, 25), xPos + 5, rowY + 4, { width: colWidths.action - 10 });
        xPos += colWidths.action;
        doc.fillColor(colors.text)
          .text((log.resource || '').substring(0, 25), xPos + 5, rowY + 4, { width: colWidths.resource - 10 });
        xPos += colWidths.resource;
        doc.text(log.ipAddress || '-', xPos + 5, rowY + 4, { width: colWidths.ip - 10 });
        xPos += colWidths.ip;
        doc.text(log.responseStatus ? String(log.responseStatus) : '-', xPos + 5, rowY + 4, { width: colWidths.status - 10 });

        rowY += rowHeight;
        rowCount++;
      });

      // Footer on last page
      doc.moveDown(2);
      doc.fillColor(colors.lightText)
        .fontSize(8)
        .text('Ce rapport est confidentiel et destiné à un usage interne uniquement.', { align: 'center' });
      doc.text('MedFlow EMR - Système de Gestion de Cabinet Médical', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Protect all routes and require admin role
router.use(protect);
router.use(authorize('admin'));

// @desc    Get audit logs with pagination and filtering
// @route   GET /api/audit
// @access  Private/Admin
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    action,
    user,
    userId,
    startDate,
    endDate,
    resource,
    suspicious,
    threatLevel,
    search,
    securityEvents,
    modifications,
    critical
  } = req.query;

  const query = {};

  // Filter by action type
  if (action) {
    query.action = action;
  }

  // Filter by user (support both 'user' and 'userId' for backwards compatibility)
  if (userId || user) {
    query.user = userId || user;
  }

  // Tab-specific filters
  if (securityEvents === 'true') {
    query.action = { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'SECURITY_ALERT', 'SUSPICIOUS_ACTIVITY', 'PERMISSION_CHANGE', 'ROLE_CHANGE'] };
  }

  if (modifications === 'true') {
    query.action = { $regex: /CREATE|UPDATE|DELETE/ };
  }

  if (critical === 'true') {
    query.action = { $regex: /^CRITICAL_/ };
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  // Filter by resource (partial match) - sanitized to prevent ReDoS
  if (resource) {
    query.resource = new RegExp(escapeRegex(resource), 'i');
  }

  // Filter suspicious activities
  if (suspicious === 'true') {
    query['security.suspicious'] = true;
  }

  // Filter by threat level
  if (threatLevel) {
    query['security.threatLevel'] = threatLevel;
  }

  // General search - sanitized to prevent ReDoS
  if (search) {
    const sanitizedSearch = escapeRegex(search);
    query.$or = [
      { resource: new RegExp(sanitizedSearch, 'i') },
      { 'metadata.operation': new RegExp(sanitizedSearch, 'i') },
      { ipAddress: new RegExp(sanitizedSearch, 'i') }
    ];
  }

  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: logs
  });
}));

// @desc    Get audit statistics
// @route   GET /api/audit/stats
// @access  Private/Admin
router.get('/stats', asyncHandler(async (req, res) => {
  const { period = '24h' } = req.query;

  let startDate;
  switch (period) {
    case '1h':
      startDate = new Date(Date.now() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  // Get counts by action type
  const actionStats = await AuditLog.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Get counts by user
  const userStats = await AuditLog.aggregate([
    { $match: { createdAt: { $gte: startDate }, user: { $ne: null } } },
    { $group: { _id: '$user', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        count: 1,
        userName: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
        email: '$userInfo.email'
      }
    }
  ]);

  // Get security stats
  const securityStats = {
    suspicious: await AuditLog.countDocuments({
      createdAt: { $gte: startDate },
      'security.suspicious': true
    }),
    failedLogins: await AuditLog.countDocuments({
      createdAt: { $gte: startDate },
      action: 'LOGIN_FAILED'
    }),
    successfulLogins: await AuditLog.countDocuments({
      createdAt: { $gte: startDate },
      action: 'LOGIN_SUCCESS'
    }),
    criticalActions: await AuditLog.countDocuments({
      createdAt: { $gte: startDate },
      action: { $regex: /^CRITICAL_/ }
    }),
    threatsByLevel: await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          'security.threatLevel': { $ne: null }
        }
      },
      { $group: { _id: '$security.threatLevel', count: { $sum: 1 } } }
    ])
  };

  // Get hourly activity for the last 24 hours
  const hourlyActivity = await AuditLog.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: {
          hour: { $hour: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.day': 1, '_id.hour': 1 } }
  ]);

  // Total counts
  const totalCount = await AuditLog.countDocuments({
    createdAt: { $gte: startDate }
  });

  res.status(200).json({
    success: true,
    data: {
      period,
      totalEvents: totalCount,
      actionStats,
      userStats,
      securityStats,
      hourlyActivity
    }
  });
}));

// @desc    Get suspicious activities
// @route   GET /api/audit/suspicious
// @access  Private/Admin
router.get('/suspicious', asyncHandler(async (req, res) => {
  const { hours = 24, limit = 100 } = req.query;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const logs = await AuditLog.find({
    'security.suspicious': true,
    createdAt: { $gte: since }
  })
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: logs.length,
    data: logs
  });
}));

// @desc    Get user activity history
// @route   GET /api/audit/user/:userId
// @access  Private/Admin
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const total = await AuditLog.countDocuments({ user: req.params.userId });
  const logs = await AuditLog.find({ user: req.params.userId })
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: logs
  });
}));

// @desc    Get patient access logs (HIPAA)
// @route   GET /api/audit/patient/:patientId
// @access  Private/Admin
router.get('/patient/:patientId', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const query = {
    $or: [
      { 'metadata.patientId': req.params.patientId },
      { resource: new RegExp(`patients.*${req.params.patientId}`, 'i') }
    ]
  };

  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: logs
  });
}));

// @desc    Get available action types
// @route   GET /api/audit/actions
// @access  Private/Admin
router.get('/actions', asyncHandler(async (req, res) => {
  const actions = await AuditLog.distinct('action');

  res.status(200).json({
    success: true,
    data: actions.sort()
  });
}));

// @desc    Generate compliance report
// @route   GET /api/audit/compliance
// @access  Private/Admin
router.get('/compliance', asyncHandler(async (req, res) => {
  const { startDate, endDate, type = 'hipaa' } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Start date and end date are required'
    });
  }

  const report = await AuditLog.generateComplianceReport(startDate, endDate, type);

  res.status(200).json({
    success: true,
    data: report
  });
}));

// Legacy report endpoint
router.get('/report', generateAuditReport);

// =====================
// EMPLOYEE ACTIVITY TRACKING
// =====================

// @desc    Get all employees activity summary
// @route   GET /api/audit/employees
// @access  Private/Admin
router.get('/employees', asyncHandler(async (req, res) => {
  const { startDate, endDate, role } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  } else {
    // Default to last 30 days
    dateFilter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  }

  const pipeline = [
    { $match: { ...dateFilter, user: { $ne: null } } },
    {
      $group: {
        _id: '$user',
        totalActions: { $sum: 1 },
        lastActivity: { $max: '$createdAt' },
        firstActivity: { $min: '$createdAt' },
        creates: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /CREATE/ } }, 1, 0] } },
        updates: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /UPDATE/ } }, 1, 0] } },
        deletes: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /DELETE/ } }, 1, 0] } },
        views: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /VIEW|ACCESS/ } }, 1, 0] } },
        logins: { $sum: { $cond: [{ $eq: ['$action', 'LOGIN_SUCCESS'] }, 1, 0] } },
        failedLogins: { $sum: { $cond: [{ $eq: ['$action', 'LOGIN_FAILED'] }, 1, 0] } },
        criticalActions: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /^CRITICAL_/ } }, 1, 0] } },
        actions: { $push: '$action' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        user: {
          firstName: '$userInfo.firstName',
          lastName: '$userInfo.lastName',
          email: '$userInfo.email',
          role: '$userInfo.role',
          department: '$userInfo.department'
        },
        totalActions: 1,
        lastActivity: 1,
        firstActivity: 1,
        breakdown: {
          creates: '$creates',
          updates: '$updates',
          deletes: '$deletes',
          views: '$views',
          logins: '$logins',
          failedLogins: '$failedLogins',
          criticalActions: '$criticalActions'
        },
        topActions: {
          $slice: [
            {
              $map: {
                input: {
                  $slice: [
                    { $setUnion: ['$actions'] },
                    10
                  ]
                },
                as: 'action',
                in: '$$action'
              }
            },
            5
          ]
        }
      }
    },
    { $sort: { totalActions: -1 } }
  ];

  // Filter by role if specified
  if (role) {
    pipeline.push({ $match: { 'user.role': role } });
  }

  const employeeActivity = await AuditLog.aggregate(pipeline);

  res.status(200).json({
    success: true,
    count: employeeActivity.length,
    period: {
      start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate || new Date()
    },
    data: employeeActivity
  });
}));

// @desc    Get detailed daily activity for an employee
// @route   GET /api/audit/employees/:userId/daily
// @access  Private/Admin
router.get('/employees/:userId/daily', asyncHandler(async (req, res) => {
  const { days = 30, startDate: startDateParam, endDate: endDateParam } = req.query;

  // Support both date range and days parameter
  let startDate, endDate;
  if (startDateParam && endDateParam) {
    startDate = new Date(startDateParam);
    endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999); // Include the entire end day
  } else {
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    endDate = new Date();
  }

  const mongoose = require('mongoose');
  const dailyActivity = await AuditLog.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.params.userId),
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        count: { $sum: 1 },
        actions: { $push: '$action' },
        firstAction: { $min: '$createdAt' },
        lastAction: { $max: '$createdAt' }
      }
    },
    { $sort: { '_id.date': -1 } }
  ]);

  // Get user info
  const User = require('../models/User');
  const user = await User.findById(req.params.userId).select('firstName lastName email role');

  res.status(200).json({
    success: true,
    user,
    days: parseInt(days),
    data: dailyActivity
  });
}));

// @desc    Get login history
// @route   GET /api/audit/logins
// @access  Private/Admin
router.get('/logins', asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, status, userId } = req.query;

  const query = {
    action: { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'] }
  };

  if (status === 'success') query.action = 'LOGIN_SUCCESS';
  if (status === 'failed') query.action = 'LOGIN_FAILED';
  if (userId) query.user = userId;

  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: logs
  });
}));

// @desc    Get all data modifications (creates, updates, deletes)
// @route   GET /api/audit/modifications
// @access  Private/Admin
router.get('/modifications', asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, type, resource, userId, startDate, endDate } = req.query;

  const query = {
    action: { $in: [
      'DATA_CREATE', 'DATA_UPDATE', 'DATA_DELETE',
      'PATIENT_CREATE', 'PATIENT_UPDATE', 'PATIENT_DELETE',
      'PRESCRIPTION_CREATE', 'PRESCRIPTION_UPDATE', 'PRESCRIPTION_DELETE',
      'APPOINTMENT_CREATE', 'APPOINTMENT_UPDATE', 'APPOINTMENT_DELETE',
      'INVOICE_CREATE', 'INVOICE_UPDATE', 'INVOICE_DELETE',
      'USER_CREATE', 'USER_UPDATE', 'USER_DELETE'
    ] }
  };

  if (type === 'create') query.action = { $regex: /CREATE/ };
  if (type === 'update') query.action = { $regex: /UPDATE/ };
  if (type === 'delete') query.action = { $regex: /DELETE/ };
  if (resource) query.resource = new RegExp(escapeRegex(resource), 'i');
  if (userId) query.user = userId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: logs
  });
}));

// @desc    Get critical operations
// @route   GET /api/audit/critical
// @access  Private/Admin
router.get('/critical', asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, startDate, endDate } = req.query;

  const query = {
    action: { $regex: /^CRITICAL_/ }
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: logs
  });
}));

// @desc    Export audit logs to CSV or PDF
// @route   GET /api/audit/export
// @access  Private/Admin
router.get('/export', asyncHandler(async (req, res) => {
  const { startDate, endDate, format = 'csv', action, userId } = req.query;

  const query = {};
  if (action) query.action = action;
  if (userId) query.user = userId;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // PDF has lower limit due to file size constraints
  const limit = format === 'pdf' ? 5000 : 10000;

  const logs = await AuditLog.find(query)
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt')
    .limit(limit);

  if (format === 'pdf') {
    // Generate PDF
    const pdfBuffer = await generateAuditPDF(logs, { startDate, endDate });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rapport-audit-${Date.now()}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } else if (format === 'csv') {
    // Generate CSV
    const csvRows = [
      'Date,Heure,Utilisateur,Email,Rôle,Action,Ressource,Adresse IP,Status,Détails'
    ];

    logs.forEach(log => {
      const date = new Date(log.createdAt);
      const row = [
        date.toLocaleDateString('fr-CD'),
        date.toLocaleTimeString('fr-CD'),
        log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système',
        log.user?.email || '',
        log.user?.role || '',
        log.action,
        log.resource,
        log.ipAddress || '',
        log.responseStatus || '',
        JSON.stringify(log.metadata || {}).replace(/,/g, ';')
      ];
      csvRows.push(row.map(v => `"${v}"`).join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${Date.now()}.csv`);
    res.send(`\ufeff${csvRows.join('\n')}`); // BOM for Excel UTF-8
  } else {
    // JSON format
    res.status(200).json({
      success: true,
      count: logs.length,
      exportDate: new Date(),
      data: logs
    });
  }
}));

// @desc    Get audit timeline (hourly breakdown)
// @route   GET /api/audit/timeline
// @access  Private/Admin
router.get('/timeline', asyncHandler(async (req, res) => {
  const { hours = 24 } = req.query;
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  const timeline = await AuditLog.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          hour: { $hour: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        creates: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /CREATE/ } }, 1, 0] } },
        updates: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /UPDATE/ } }, 1, 0] } },
        deletes: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /DELETE/ } }, 1, 0] } },
        logins: { $sum: { $cond: [{ $eq: ['$action', 'LOGIN_SUCCESS'] }, 1, 0] } }
      }
    },
    { $sort: { '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
  ]);

  res.status(200).json({
    success: true,
    hours: parseInt(hours),
    data: timeline
  });
}));

// @desc    Mark audit log as reviewed
// @route   PUT /api/audit/:id/review
// @access  Private/Admin
router.put('/:id/review', asyncHandler(async (req, res) => {
  const log = await AuditLog.findById(req.params.id);

  if (!log) {
    return res.status(404).json({ success: false, error: 'Audit log not found' });
  }

  log.metadata = log.metadata || {};
  log.metadata.reviewed = true;
  log.metadata.reviewedBy = req.user._id;
  log.metadata.reviewedAt = new Date();
  log.metadata.reviewNotes = req.body.notes;

  await log.save();

  res.status(200).json({
    success: true,
    data: log
  });
}));

// @desc    Add note to audit log
// @route   POST /api/audit/:id/note
// @access  Private/Admin
router.post('/:id/note', asyncHandler(async (req, res) => {
  const { note } = req.body;

  if (!note) {
    return res.status(400).json({ success: false, error: 'Note is required' });
  }

  const log = await AuditLog.findById(req.params.id);

  if (!log) {
    return res.status(404).json({ success: false, error: 'Audit log not found' });
  }

  log.metadata = log.metadata || {};
  log.metadata.adminNotes = log.metadata.adminNotes || [];
  log.metadata.adminNotes.push({
    note,
    addedBy: req.user._id,
    addedAt: new Date()
  });

  await log.save();

  res.status(200).json({
    success: true,
    data: log
  });
}));

module.exports = router;
