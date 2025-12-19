const { asyncHandler } = require('../middleware/errorHandler');
const ImagingOrder = require('../models/ImagingOrder');
const ImagingStudy = require('../models/ImagingStudy');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { createContextLogger } = require('../utils/structuredLogger');
const imagingLogger = createContextLogger('Imaging');
const { UPLOAD, PAGINATION } = require('../config/constants');

// Cache for thumbnails
const THUMBNAIL_CACHE_DIR = path.join(__dirname, '../cache/thumbnails');

// Ensure thumbnail cache directory exists
if (!fs.existsSync(THUMBNAIL_CACHE_DIR)) {
  fs.mkdirSync(THUMBNAIL_CACHE_DIR, { recursive: true });
}

// ============================================
// IMAGING ORDER ENDPOINTS
// ============================================

// @desc    Get all imaging orders
// @route   GET /api/imaging/orders
// @access  Private
exports.getOrders = asyncHandler(async (req, res) => {
  const { status, modality, priority, patientId, dateFrom, dateTo, limit = 50, page = 1 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (modality) query.modality = modality;
  if (priority) query.priority = priority;
  if (patientId) query.patient = patientId;

  if (dateFrom || dateTo) {
    query.orderDate = {};
    if (dateFrom) query.orderDate.$gte = new Date(dateFrom);
    if (dateTo) query.orderDate.$lte = new Date(dateTo);
  }

  const total = await ImagingOrder.countDocuments(query);
  const orders = await ImagingOrder.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .populate('orderedBy', 'firstName lastName')
    .populate('scheduledRoom', 'roomName roomNumber')
    .sort({ orderDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  return paginated(res, orders, page, limit, total);
});

// @desc    Get single imaging order
// @route   GET /api/imaging/orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await ImagingOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender phoneNumber')
    .populate('orderedBy', 'firstName lastName specialization')
    .populate('technician', 'firstName lastName')
    .populate('scheduledRoom', 'roomName roomNumber')
    .populate('scheduledEquipment', 'deviceName model')
    .populate('study')
    .lean();

  if (!order) {
    return notFound(res, 'Imaging order');
  }

  return success(res, { data: order });
});

// @desc    Create imaging order
// @route   POST /api/imaging/orders
// @access  Private (Doctor, Ophthalmologist)
exports.createOrder = asyncHandler(async (req, res) => {
  const orderData = {
    ...req.body,
    orderedBy: req.user.id,
    createdBy: req.user.id
  };

  const order = await ImagingOrder.create(orderData);

  // Populate for response
  await order.populate([
    { path: 'patient', select: 'firstName lastName patientId' },
    { path: 'orderedBy', select: 'firstName lastName' }
  ]);

  // Create notification for imaging technicians
  await Notification.create({
    recipient: 'imaging_tech', // Would typically be user IDs
    type: 'task_assigned',
    title: 'New Imaging Order',
    message: `${order.examType?.name || order.modality} ordered for patient`,
    priority: order.priority === 'stat' ? 'urgent' : order.priority === 'urgent' ? 'high' : 'normal',
    entityType: 'imaging_order',
    entityId: order._id,
    link: `/imaging/orders/${order._id}`
  });

  return success(res, { data: order, message: 'Imaging order created successfully', statusCode: 201 });
});

// @desc    Update imaging order
// @route   PUT /api/imaging/orders/:id
// @access  Private
exports.updateOrder = asyncHandler(async (req, res) => {
  let order = await ImagingOrder.findById(req.params.id);

  if (!order) {
    return notFound(res, 'Imaging order');
  }

  // Don't allow updates to completed/cancelled orders
  if (['completed', 'cancelled'].includes(order.status)) {
    return error(res, 'Cannot update completed or cancelled orders');
  }

  order = await ImagingOrder.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user.id },
    { new: true, runValidators: true }
  ).populate('patient', 'firstName lastName patientId');

  return success(res, { data: order });
});

// @desc    Schedule imaging order
// @route   PUT /api/imaging/orders/:id/schedule
// @access  Private
exports.scheduleOrder = asyncHandler(async (req, res) => {
  const order = await ImagingOrder.findById(req.params.id);

  if (!order) {
    return notFound(res, 'Imaging order');
  }

  await order.schedule(req.user.id, req.body);

  await order.populate([
    { path: 'patient', select: 'firstName lastName patientId phoneNumber' },
    { path: 'scheduledRoom', select: 'roomName roomNumber' }
  ]);

  return success(res, { data: order });
});

// @desc    Check-in patient for imaging
// @route   PUT /api/imaging/orders/:id/checkin
// @access  Private
exports.checkInOrder = asyncHandler(async (req, res) => {
  const order = await ImagingOrder.findById(req.params.id);

  if (!order) {
    return notFound(res, 'Imaging order');
  }

  await order.checkIn(req.user.id);

  return success(res, { data: order, message: 'Patient checked in successfully' });
});

// @desc    Start imaging procedure
// @route   PUT /api/imaging/orders/:id/start
// @access  Private
exports.startOrder = asyncHandler(async (req, res) => {
  const order = await ImagingOrder.findById(req.params.id);

  if (!order) {
    return notFound(res, 'Imaging order');
  }

  await order.start(req.user.id, req.body.technicianId);

  return success(res, { data: order, message: 'Imaging procedure started' });
});

// @desc    Complete imaging order
// @route   PUT /api/imaging/orders/:id/complete
// @access  Private
exports.completeOrder = asyncHandler(async (req, res) => {
  const order = await ImagingOrder.findById(req.params.id);

  if (!order) {
    return notFound(res, 'Imaging order');
  }

  await order.complete(req.user.id, req.body.studyId);

  // Notify ordering provider
  await Notification.create({
    recipient: order.orderedBy,
    type: 'result_available',
    title: 'Imaging Complete',
    message: `${order.examType?.name || order.modality} has been completed`,
    priority: 'normal',
    entityType: 'imaging_order',
    entityId: order._id,
    link: `/imaging/orders/${order._id}`
  });

  return success(res, { data: order, message: 'Imaging order completed' });
});

// @desc    Cancel imaging order
// @route   PUT /api/imaging/orders/:id/cancel
// @access  Private
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await ImagingOrder.findById(req.params.id);

  if (!order) {
    return notFound(res, 'Imaging order');
  }

  if (order.status === 'completed') {
    return error(res, 'Cannot cancel completed orders');
  }

  await order.cancel(req.user.id, req.body.reason);

  return success(res, { data: order, message: 'Imaging order cancelled' });
});

// @desc    Get pending imaging orders
// @route   GET /api/imaging/orders/pending
// @access  Private
exports.getPendingOrders = asyncHandler(async (req, res) => {
  const orders = await ImagingOrder.getPending(req.query);

  return success(res, { data: orders });
});

// @desc    Get scheduled orders for a date
// @route   GET /api/imaging/orders/schedule/:date
// @access  Private
exports.getScheduledOrders = asyncHandler(async (req, res) => {
  const date = new Date(req.params.date);
  const orders = await ImagingOrder.getScheduledForDate(date, req.query);

  return success(res, { data: orders });
});

// @desc    Get patient imaging history
// @route   GET /api/imaging/orders/patient/:patientId
// @access  Private
exports.getPatientOrders = asyncHandler(async (req, res) => {
  const orders = await ImagingOrder.getPatientHistory(req.params.patientId, req.query);

  return success(res, { data: orders });
});

// ============================================
// IMAGING STUDY ENDPOINTS
// ============================================

// @desc    Get all imaging studies
// @route   GET /api/imaging/studies
// @access  Private
exports.getStudies = asyncHandler(async (req, res) => {
  const { status, modality, patientId, reportStatus, dateFrom, dateTo, limit = 50, page = 1 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (modality) query.modality = modality;
  if (patientId) query.patient = patientId;
  if (reportStatus) query['report.status'] = reportStatus;

  if (dateFrom || dateTo) {
    query.studyDate = {};
    if (dateFrom) query.studyDate.$gte = new Date(dateFrom);
    if (dateTo) query.studyDate.$lte = new Date(dateTo);
  }

  const total = await ImagingStudy.countDocuments(query);
  const studies = await ImagingStudy.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('imagingOrder', 'orderId examType orderedBy')
    .populate('report.reportedBy', 'firstName lastName')
    .sort({ studyDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  return paginated(res, studies, page, limit, total);
});

// @desc    Get single imaging study
// @route   GET /api/imaging/studies/:id
// @access  Private
exports.getStudy = asyncHandler(async (req, res) => {
  const study = await ImagingStudy.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .populate('imagingOrder')
    .populate('technician', 'firstName lastName')
    .populate('equipment', 'deviceName model manufacturer')
    .populate('report.reportedBy', 'firstName lastName')
    .populate('report.verifiedBy', 'firstName lastName')
    .lean();

  if (!study) {
    return notFound(res, 'Imaging study');
  }

  return success(res, { data: study });
});

// @desc    Create imaging study
// @route   POST /api/imaging/studies
// @access  Private
exports.createStudy = asyncHandler(async (req, res) => {
  const studyData = {
    ...req.body,
    createdBy: req.user.id
  };

  const study = await ImagingStudy.create(studyData);

  await study.populate([
    { path: 'patient', select: 'firstName lastName patientId' },
    { path: 'imagingOrder', select: 'orderId examType' }
  ]);

  return success(res, { data: study, message: 'Imaging study created successfully', statusCode: 201 });
});

// @desc    Draft report for imaging study
// @route   PUT /api/imaging/studies/:id/draft-report
// @access  Private
exports.draftReport = asyncHandler(async (req, res) => {
  const study = await ImagingStudy.findById(req.params.id);

  if (!study) {
    return notFound(res, 'Imaging study');
  }

  await study.draftReport(req.user.id, req.body);

  return success(res, { data: study, message: 'Report draft saved' });
});

// @desc    Finalize report for imaging study
// @route   PUT /api/imaging/studies/:id/finalize-report
// @access  Private
exports.finalizeReport = asyncHandler(async (req, res) => {
  const study = await ImagingStudy.findById(req.params.id);

  if (!study) {
    return notFound(res, 'Imaging study');
  }

  await study.finalizeReport(req.user.id, req.body);

  // Notify ordering provider
  if (study.imagingOrder) {
    const order = await ImagingOrder.findById(study.imagingOrder);
    if (order) {
      await Notification.create({
        recipient: order.orderedBy,
        type: 'result_available',
        title: 'Imaging Report Available',
        message: `Report for ${study.modality} study is now available`,
        priority: study.report?.criticalFindings?.present ? 'urgent' : 'normal',
        entityType: 'imaging_study',
        entityId: study._id,
        link: `/imaging/studies/${study._id}`
      });
    }
  }

  return success(res, { data: study, message: 'Report finalized' });
});

// @desc    Verify report
// @route   PUT /api/imaging/studies/:id/verify-report
// @access  Private
exports.verifyReport = asyncHandler(async (req, res) => {
  const study = await ImagingStudy.findById(req.params.id);

  if (!study) {
    return notFound(res, 'Imaging study');
  }

  await study.verifyReport(req.user.id);

  return success(res, { data: study, message: 'Report verified' });
});

// @desc    Add addendum to report
// @route   POST /api/imaging/studies/:id/addendum
// @access  Private
exports.addAddendum = asyncHandler(async (req, res) => {
  const study = await ImagingStudy.findById(req.params.id);

  if (!study) {
    return notFound(res, 'Imaging study');
  }

  if (!study.report || study.report.status !== 'final') {
    return error(res, 'Can only add addendum to finalized reports');
  }

  await study.addAddendum(req.user.id, req.body.text, req.body.reason);

  return success(res, { data: study, message: 'Addendum added' });
});

// @desc    Acknowledge critical findings
// @route   PUT /api/imaging/studies/:id/acknowledge-critical
// @access  Private
exports.acknowledgeCritical = asyncHandler(async (req, res) => {
  const study = await ImagingStudy.findById(req.params.id);

  if (!study) {
    return notFound(res, 'Imaging study');
  }

  await study.acknowledgeCritical(req.user.id);

  return success(res, { data: study, message: 'Critical findings acknowledged' });
});

// @desc    Get unreported studies
// @route   GET /api/imaging/studies/unreported
// @access  Private
exports.getUnreportedStudies = asyncHandler(async (req, res) => {
  const studies = await ImagingStudy.getUnreported(req.query);

  return success(res, { data: studies });
});

// @desc    Get unacknowledged critical findings
// @route   GET /api/imaging/studies/critical-unacknowledged
// @access  Private
exports.getUnacknowledgedCritical = asyncHandler(async (req, res) => {
  const studies = await ImagingStudy.getUnacknowledgedCritical();

  return success(res, { data: studies });
});

// @desc    Get patient imaging history
// @route   GET /api/imaging/studies/patient/:patientId
// @access  Private
exports.getPatientStudies = asyncHandler(async (req, res) => {
  const studies = await ImagingStudy.getPatientHistory(req.params.patientId, req.query);

  return success(res, { data: studies });
});

// @desc    Add image to study
// @route   POST /api/imaging/studies/:id/images
// @access  Private
exports.addImage = asyncHandler(async (req, res) => {
  const study = await ImagingStudy.findById(req.params.id);

  if (!study) {
    return notFound(res, 'Imaging study');
  }

  await study.addImage(req.body, req.user.id);

  return success(res, { data: study, message: 'Image added to study' });
});

// ============================================
// STATISTICS & DASHBOARD
// ============================================

// @desc    Get imaging statistics
// @route   GET /api/imaging/stats
// @access  Private
exports.getStatistics = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's counts
  const [todayOrders, todayCompleted, pendingOrders, unreportedStudies] = await Promise.all([
    ImagingOrder.countDocuments({ orderDate: { $gte: today, $lt: tomorrow } }),
    ImagingOrder.countDocuments({ status: 'completed', actualEndTime: { $gte: today, $lt: tomorrow } }),
    ImagingOrder.countDocuments({ status: { $in: ['ordered', 'scheduled', 'checked-in', 'in-progress'] } }),
    ImagingStudy.countDocuments({ 'report.status': { $in: ['pending', 'draft'] } })
  ]);

  // By modality
  const byModality = await ImagingOrder.aggregate([
    { $match: { orderDate: { $gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: '$modality', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  return success(res, {
    data: {
      today: {
        ordered: todayOrders,
        completed: todayCompleted
      },
      pending: pendingOrders,
      unreported: unreportedStudies,
      byModality: byModality.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    }
  });
});

// ============================================
// NETWORK FILE STREAMING ENDPOINTS
// ============================================

// Allowed image extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp', '.dcm'];

// @desc    Stream file from network share with range support
// @route   GET /api/imaging/files/stream
// @access  Private
exports.streamFile = asyncHandler(async (req, res) => {
  const { filePath } = req.query;

  if (!filePath) {
    return error(res, 'File path is required');
  }

  // Decode the file path
  const decodedPath = decodeURIComponent(filePath);

  // Security: Validate file extension
  const ext = path.extname(decodedPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return error(res, 'File type not allowed');
  }

  // Check if file exists
  if (!fs.existsSync(decodedPath)) {
    return notFound(res, 'File');
  }

  try {
    const stat = fs.statSync(decodedPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine content type
    const contentType = getContentType(ext);

    if (range) {
      // Range request (progressive loading)
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(decodedPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      });

      stream.pipe(res);
    } else {
      // Full file request
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      });

      fs.createReadStream(decodedPath).pipe(res);
    }
  } catch (err) {
    imagingLogger.error('File streaming error', { error: err.message, filePath: decodedPath });
    return error(res, 'Error streaming file', 500);
  }
});

// @desc    Get or generate thumbnail for an image
// @route   GET /api/imaging/files/thumbnail
// @access  Private
exports.getThumbnail = asyncHandler(async (req, res) => {
  const { filePath, size = 200 } = req.query;

  if (!filePath) {
    return error(res, 'File path is required');
  }

  const decodedPath = decodeURIComponent(filePath);
  const ext = path.extname(decodedPath).toLowerCase();

  // Validate extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return error(res, 'File type not allowed');
  }

  // Check source file exists
  if (!fs.existsSync(decodedPath)) {
    return notFound(res, 'Source file');
  }

  // Generate cache key from file path and size
  const cacheKey = Buffer.from(`${decodedPath}-${size}`).toString('base64url');
  const thumbnailPath = path.join(THUMBNAIL_CACHE_DIR, `${cacheKey}.jpg`);

  try {
    // Check if thumbnail exists in cache
    if (fs.existsSync(thumbnailPath)) {
      const stat = fs.statSync(thumbnailPath);
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=604800' // Cache for 7 days
      });
      return fs.createReadStream(thumbnailPath).pipe(res);
    }

    // Generate thumbnail
    const thumbnailSize = Math.min(parseInt(size) || 200, 400);

    await sharp(decodedPath)
      .resize(thumbnailSize, thumbnailSize, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    // Serve the generated thumbnail
    const stat = fs.statSync(thumbnailPath);
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=604800'
    });
    fs.createReadStream(thumbnailPath).pipe(res);
  } catch (err) {
    imagingLogger.error('Thumbnail generation error', { error: err.message, filePath: decodedPath });
    // If thumbnail generation fails, serve a placeholder or the original
    return error(res, 'Error generating thumbnail', 500);
  }
});

// @desc    Get exam files for a patient (metadata only for fast loading)
// @route   GET /api/imaging/files/patient/:patientId
// @access  Private
exports.getPatientExamFiles = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { modality, dateFrom, dateTo, limit = 50 } = req.query;

  // Get imaging studies for this patient
  const query = { patient: patientId };

  if (modality) query.modality = modality;
  if (dateFrom || dateTo) {
    query.studyDate = {};
    if (dateFrom) query.studyDate.$gte = new Date(dateFrom);
    if (dateTo) query.studyDate.$lte = new Date(dateTo);
  }

  const studies = await ImagingStudy.find(query)
    .select('studyId modality studyDate description images attachments storage numberOfImages')
    .sort({ studyDate: -1 })
    .limit(parseInt(limit))
    .lean();

  // Format response with file metadata (no actual file content)
  const examFiles = studies.map(study => ({
    studyId: study.studyId,
    modality: study.modality,
    date: study.studyDate,
    description: study.description,
    imageCount: study.numberOfImages || study.images?.length || 0,
    images: (study.images || []).map(img => ({
      id: img._id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      description: img.description,
      rows: img.rows,
      columns: img.columns
    })),
    attachments: (study.attachments || []).map(att => ({
      id: att._id,
      filename: att.originalName || att.filename,
      url: att.url,
      mimeType: att.mimeType,
      size: att.size,
      category: att.category
    })),
    storage: study.storage
  }));

  return success(res, { data: examFiles });
});

// @desc    Get file metadata (without content)
// @route   GET /api/imaging/files/info
// @access  Private
exports.getFileInfo = asyncHandler(async (req, res) => {
  const { filePath } = req.query;

  if (!filePath) {
    return error(res, 'File path is required');
  }

  const decodedPath = decodeURIComponent(filePath);

  if (!fs.existsSync(decodedPath)) {
    return notFound(res, 'File');
  }

  try {
    const stat = fs.statSync(decodedPath);
    const ext = path.extname(decodedPath).toLowerCase();

    const info = {
      path: decodedPath,
      filename: path.basename(decodedPath),
      extension: ext,
      size: stat.size,
      sizeFormatted: formatFileSize(stat.size),
      createdAt: stat.birthtime,
      modifiedAt: stat.mtime,
      contentType: getContentType(ext)
    };

    // Try to get image dimensions if it's an image
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif'].includes(ext)) {
      try {
        const metadata = await sharp(decodedPath).metadata();
        info.width = metadata.width;
        info.height = metadata.height;
        info.format = metadata.format;
      } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }
    }

    return success(res, { data: info });
  } catch (err) {
    imagingLogger.error('File info error', { error: err.message, filePath: decodedPath });
    return error(res, 'Error getting file info', 500);
  }
});

// @desc    List files in a network share directory
// @route   GET /api/imaging/files/list
// @access  Private (Admin only)
exports.listDirectoryFiles = asyncHandler(async (req, res) => {
  const { directory, recursive = false, pattern } = req.query;

  if (!directory) {
    return error(res, 'Directory path is required');
  }

  const decodedDir = decodeURIComponent(directory);

  if (!fs.existsSync(decodedDir)) {
    return notFound(res, 'Directory');
  }

  try {
    const files = [];
    const maxFiles = 500; // Limit to prevent memory issues

    const scanDirectory = (dir, depth = 0) => {
      if (files.length >= maxFiles) return;
      if (!recursive && depth > 0) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= maxFiles) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && recursive) {
          scanDirectory(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();

          // Filter by pattern if provided
          if (pattern && !entry.name.toLowerCase().includes(pattern.toLowerCase())) {
            continue;
          }

          // Only include allowed image types
          if (ALLOWED_EXTENSIONS.includes(ext)) {
            try {
              const stat = fs.statSync(fullPath);
              files.push({
                path: fullPath,
                filename: entry.name,
                extension: ext,
                size: stat.size,
                modifiedAt: stat.mtime
              });
            } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }
          }
        }
      }
    };

    scanDirectory(decodedDir);

    return success(res, {
      data: {
        files,
        count: files.length,
        truncated: files.length >= maxFiles
      }
    });
  } catch (err) {
    imagingLogger.error('Directory listing error', { error: err.message, directory: decodedDir });
    return error(res, 'Error listing directory', 500);
  }
});

// Helper function to get content type from extension
function getContentType(ext) {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.webp': 'image/webp',
    '.dcm': 'application/dicom'
  };
  return types[ext] || 'application/octet-stream';
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = exports;
