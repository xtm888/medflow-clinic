const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploads, handleUploadError, fileUtils } = require('../middleware/fileUpload');
const { asyncHandler } = require('../middleware/errorHandler');
const Patient = require('../models/Patient');
const Document = require('../models/Document');
const Visit = require('../models/Visit');
const path = require('path');
const fs = require('fs');

// Protect all routes
router.use(protect);

// @desc    Upload patient photo
// @route   POST /api/uploads/patient/:patientId/photo
// @access  Private
router.post('/patient/:patientId/photo',
  handleUploadError(uploads.patientPhoto),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      await fileUtils.deleteFile(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Delete old photo if exists
    if (patient.photoPath) {
      await fileUtils.deleteFile(patient.photoPath).catch(console.error);
    }

    // Update patient with new photo path
    patient.photoPath = req.file.path;
    patient.photoUrl = fileUtils.getFileUrl(req.file.path);
    await patient.save();

    res.status(200).json({
      success: true,
      data: {
        photoUrl: patient.photoUrl,
        photoPath: patient.photoPath,
        filename: req.file.filename,
        size: req.file.size
      }
    });
  })
);

// @desc    Upload patient documents
// @route   POST /api/uploads/patient/:patientId/documents
// @access  Private
router.post('/patient/:patientId/documents',
  handleUploadError(uploads.patientDocuments),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      // Delete uploaded files
      for (const file of req.files) {
        await fileUtils.deleteFile(file.path).catch(console.error);
      }
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    const documents = [];
    for (const file of req.files) {
      const doc = await Document.create({
        patient: patient._id,
        uploadedBy: req.user.id,
        documentType: req.body.documentType || 'other',
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileUrl: fileUtils.getFileUrl(file.path),
        fileSize: file.size,
        mimeType: file.mimetype,
        description: req.body.description || '',
        tags: req.body.tags ? req.body.tags.split(',') : []
      });
      documents.push(doc);
    }

    res.status(201).json({
      success: true,
      count: documents.length,
      data: documents
    });
  })
);

// @desc    Upload lab results
// @route   POST /api/uploads/visit/:visitId/lab-results
// @access  Private (Lab technician, Doctor)
router.post('/visit/:visitId/lab-results',
  authorize('lab_technician', 'doctor', 'admin'),
  handleUploadError(uploads.labResults),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const visit = await Visit.findById(req.params.visitId);
    if (!visit) {
      // Delete uploaded files
      for (const file of req.files) {
        await fileUtils.deleteFile(file.path).catch(console.error);
      }
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const labFiles = [];
    for (const file of req.files) {
      const labFile = {
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileUrl: fileUtils.getFileUrl(file.path),
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      };

      if (!visit.laboratoryFiles) {
        visit.laboratoryFiles = [];
      }
      visit.laboratoryFiles.push(labFile);
      labFiles.push(labFile);
    }

    await visit.save();

    res.status(201).json({
      success: true,
      message: 'Lab results uploaded successfully',
      count: labFiles.length,
      data: labFiles
    });
  })
);

// @desc    Upload medical imaging
// @route   POST /api/uploads/visit/:visitId/imaging
// @access  Private
router.post('/visit/:visitId/imaging',
  authorize('doctor', 'radiologist', 'admin'),
  handleUploadError(uploads.medicalImaging),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const visit = await Visit.findById(req.params.visitId);
    if (!visit) {
      // Delete uploaded files
      for (const file of req.files) {
        await fileUtils.deleteFile(file.path).catch(console.error);
      }
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const imagingFiles = [];
    for (const file of req.files) {
      const imagingFile = {
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileUrl: fileUtils.getFileUrl(file.path),
        fileSize: file.size,
        mimeType: file.mimetype,
        imagingType: req.body.imagingType || 'other',
        bodyPart: req.body.bodyPart || '',
        notes: req.body.notes || '',
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      };

      if (!visit.imagingFiles) {
        visit.imagingFiles = [];
      }
      visit.imagingFiles.push(imagingFile);
      imagingFiles.push(imagingFile);
    }

    await visit.save();

    res.status(201).json({
      success: true,
      message: 'Medical imaging uploaded successfully',
      count: imagingFiles.length,
      data: imagingFiles
    });
  })
);

// @desc    Upload prescription scan
// @route   POST /api/uploads/prescription
// @access  Private
router.post('/prescription',
  handleUploadError(uploads.prescription),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const prescriptionFile = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileUrl: fileUtils.getFileUrl(req.file.path),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      patientId: req.body.patientId,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    };

    res.status(201).json({
      success: true,
      message: 'Prescription uploaded successfully',
      data: prescriptionFile
    });
  })
);

// @desc    Get uploaded file
// @route   GET /api/uploads/file/:filename
// @access  Private
router.get('/file/:filename', asyncHandler(async (req, res) => {
  // SECURITY: Sanitize filename to prevent path traversal attacks
  const filename = path.basename(req.params.filename);

  // Reject filenames with suspicious patterns
  if (!filename || filename.includes('..') || filename.includes('\0')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid filename'
    });
  }

  // Search for file in all upload directories
  let filePath = null;
  const uploadDirs = require('../middleware/fileUpload').uploadDirs;

  for (const [category, dir] of Object.entries(uploadDirs)) {
    const possiblePath = path.join(dir, filename);
    const resolvedPath = path.resolve(possiblePath);
    const resolvedDir = path.resolve(dir);

    // SECURITY: Ensure the resolved path is within the upload directory
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      continue;
    }

    if (fileUtils.fileExists(possiblePath)) {
      filePath = possiblePath;
      break;
    }
  }

  if (!filePath) {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }

  // Send file
  res.sendFile(path.resolve(filePath));
}));

// @desc    Delete uploaded file
// @route   DELETE /api/uploads/file/:filename
// @access  Private (Admin)
router.delete('/file/:filename',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    // SECURITY: Sanitize filename to prevent path traversal attacks
    const filename = path.basename(req.params.filename);

    // Reject filenames with suspicious patterns
    if (!filename || filename.includes('..') || filename.includes('\0')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }

    // Search for file in all upload directories
    let filePath = null;
    const uploadDirs = require('../middleware/fileUpload').uploadDirs;

    for (const [category, dir] of Object.entries(uploadDirs)) {
      const possiblePath = path.join(dir, filename);
      const resolvedPath = path.resolve(possiblePath);
      const resolvedDir = path.resolve(dir);

      // SECURITY: Ensure the resolved path is within the upload directory
      if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
        continue;
      }

      if (fileUtils.fileExists(possiblePath)) {
        filePath = possiblePath;
        break;
      }
    }

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    await fileUtils.deleteFile(filePath);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  })
);

// @desc    Get patient documents
// @route   GET /api/uploads/patient/:patientId/documents
// @access  Private
router.get('/patient/:patientId/documents', asyncHandler(async (req, res) => {
  const documents = await Document.find({ patient: req.params.patientId })
    .populate('uploadedBy', 'firstName lastName')
    .sort('-uploadedAt');

  res.status(200).json({
    success: true,
    count: documents.length,
    data: documents
  });
}));

// @desc    Serve uploaded files statically
// @route   GET /uploads/*
// @access  Private
router.use('/uploads', protect, express.static('uploads'));

module.exports = router;