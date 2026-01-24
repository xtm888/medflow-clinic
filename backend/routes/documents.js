const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const Document = require('../models/Document');
const documentController = require('../controllers/documentController');
const documentGenerationController = require('../controllers/documentGenerationController');
const DocumentTemplate = require('../models/DocumentTemplate');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'documents');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|mp3|wav|m4a|webm|mp4|dicom|dcm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Helper function to calculate file hash
async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Helper function to determine document type
function determineDocumentType(mimeType, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType.includes('pdf') || ext === '.pdf') return 'pdf';
  if (mimeType.includes('image') || ['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return 'image';
  if (mimeType.includes('audio') || ['.mp3', '.wav', '.m4a', '.webm'].includes(ext)) return 'audio';
  if (mimeType.includes('video') || ['.mp4', '.avi', '.mov'].includes(ext)) return 'video';
  if (mimeType.includes('dicom') || ['.dcm', '.dicom'].includes(ext)) return 'dicom';
  if (mimeType.includes('text') || ['.txt', '.doc', '.docx'].includes(ext)) return 'text';
  return 'other';
}

// @desc    Upload document
// @route   POST /api/documents/upload
// @access  Private (Medical staff)
router.post('/upload', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'radiologist', 'technician'), logAction('DOCUMENT_UPLOAD'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Calculate file hash for deduplication
    const fileHash = await calculateFileHash(req.file.path);

    // Check for duplicate
    const existingDoc = await Document.checkDuplicate(fileHash);
    if (existingDoc) {
      // Delete the uploaded file
      await fs.unlink(req.file.path);

      return res.status(409).json({
        success: false,
        error: 'Duplicate document detected',
        existingDocument: existingDoc._id
      });
    }

    // Determine document type
    const docType = determineDocumentType(req.file.mimetype, req.file.originalname);

    // Create document record
    const documentData = {
      title: req.body.title || req.file.originalname,
      description: req.body.description,
      category: req.body.category || 'other',
      subCategory: req.body.subCategory,
      type: docType,
      mimeType: req.file.mimetype,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        hash: fileHash
      },
      patient: req.body.patientId,
      visit: req.body.visitId,
      appointment: req.body.appointmentId,
      tags: req.body.tags ? req.body.tags.split(',') : [],
      metadata: {
        dateCreated: new Date(),
        source: req.body.source || 'upload'
      },
      security: {
        accessLevel: req.body.accessLevel || 'staff',
        sensitiveData: req.body.sensitiveData === 'true'
      },
      createdBy: req.user._id
    };

    const document = await Document.create(documentData);

    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error uploading document:', error);

    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Record audio note
// @route   POST /api/documents/audio
// @access  Private (Medical staff)
router.post('/audio', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logAction('DOCUMENT_UPLOAD'), upload.single('audio'), async (req, res) => {
  try {
    const documentData = {
      title: req.body.title || `Audio Note - ${new Date().toLocaleString()}`,
      description: req.body.description,
      category: 'audio',
      subCategory: req.body.subCategory || 'voice-memo',
      type: 'audio',
      mimeType: req.file.mimetype,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      },
      audio: {
        duration: parseFloat(req.body.duration) || 0
      },
      patient: req.body.patientId,
      visit: req.body.visitId,
      tags: ['audio-note'],
      metadata: {
        dateCreated: new Date(),
        source: 'upload'
      },
      createdBy: req.user._id
    };

    const document = await Document.create(documentData);

    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error saving audio note:', error);

    if (req.file && req.file.path) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Search documents
// @route   GET /api/documents/search
// @access  Private (Medical staff)
router.get('/search', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'), logAction('DOCUMENT_SEARCH'), async (req, res) => {
  try {
    const { q, patientId, visitId, category, dateFrom, dateTo, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const options = {
      patientId,
      visitId,
      category,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: parseInt(limit) || 50
    };

    const documents = await Document.searchDocuments(q, options);

    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get documents by patient
// @route   GET /api/documents/patient/:patientId
// @access  Private (Medical staff only)
router.get('/patient/:patientId', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logAction('DOCUMENT_VIEW'), async (req, res) => {
  try {
    const { category, type, limit, offset } = req.query;

    const query = {
      patient: req.params.patientId,
      deleted: false
    };

    if (category) query.category = category;
    if (type) query.type = type;

    const documents = await Document.find(query)
      .populate('visit', 'visitDate chiefComplaint')
      .populate('createdBy', 'firstName lastName')
      .sort('-createdAt')
      .limit(parseInt(limit) || 50)
      .skip(parseInt(offset) || 0);

    const total = await Document.countDocuments(query);

    res.json({
      success: true,
      count: documents.length,
      total,
      data: documents
    });
  } catch (error) {
    console.error('Error fetching patient documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get documents by visit
// @route   GET /api/documents/visit/:visitId
// @access  Private (Medical staff only)
router.get('/visit/:visitId', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logAction('DOCUMENT_VIEW'), async (req, res) => {
  try {
    const documents = await Document.getByVisit(req.params.visitId);

    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('Error fetching visit documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get recent audio notes
// @route   GET /api/documents/audio/recent/:patientId
// @access  Private (Medical staff only)
router.get('/audio/recent/:patientId', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logAction('DOCUMENT_VIEW'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const audioNotes = await Document.getRecentAudioNotes(req.params.patientId, limit);

    res.json({
      success: true,
      count: audioNotes.length,
      data: audioNotes
    });
  } catch (error) {
    console.error('Error fetching audio notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Document Templates Routes (must be before /:id route)
// ============================================================

// @desc    Get document templates
// @route   GET /api/documents/templates
// @access  Private (Medical staff)
router.get('/templates', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const { category, specialty, status } = req.query;

    const query = { status: status || 'active' };
    if (category) query.category = category;
    if (specialty) query.specialty = specialty;

    const templates = await DocumentTemplate.find(query)
      .sort({ category: 1, name: 1 })
      .select('-previousVersions');

    res.json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching document templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get single document template
// @route   GET /api/documents/templates/:id
// @access  Private (Medical staff)
router.get('/templates/:id', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const template = await DocumentTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching document template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get document by ID
// @route   GET /api/documents/:id
// @access  Private (Medical staff)
router.get('/:id', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist', 'radiologist', 'technician'), logAction('DOCUMENT_VIEW'), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('patient', 'firstName lastName')
      .populate('visit', 'visitDate chiefComplaint')
      .populate('createdBy', 'firstName lastName');

    if (!document || document.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Track view
    document.trackView().catch(console.error);

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Add annotation to image
// @route   POST /api/documents/:id/annotate
// @access  Private (Medical staff)
router.post('/:id/annotate', protect, authorize('admin', 'doctor', 'ophthalmologist', 'radiologist'), logAction('DOCUMENT_ANNOTATE'), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document || document.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    if (document.type !== 'image') {
      return res.status(400).json({
        success: false,
        error: 'Annotations can only be added to images'
      });
    }

    const annotationData = {
      ...req.body,
      createdBy: req.user._id
    };

    await document.addAnnotation(annotationData);

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error adding annotation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Note: Transcribe and OCR routes removed - features not currently available

// @desc    Share document
// @route   POST /api/documents/:id/share
// @access  Private (Admin, Doctor)
router.post('/:id/share', protect, authorize('admin', 'doctor', 'ophthalmologist'), logAction('DOCUMENT_SHARE'), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document || document.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const { userId, permission, expiresInDays } = req.body;

    await document.shareWith(userId, permission, expiresInDays);

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error sharing document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update document
// @route   PUT /api/documents/:id
// @access  Private (Medical staff)
router.put('/:id', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logAction('DOCUMENT_UPDATE'), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document || document.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Update allowed fields
    const updateFields = ['title', 'description', 'category', 'subCategory', 'tags', 'labels', 'status'];
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        document[field] = req.body[field];
      }
    });

    document.updatedBy = req.user._id;
    await document.save();

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Delete document (soft delete)
// @route   DELETE /api/documents/:id
// @access  Private (Admin and document creator only)
router.delete('/:id', protect, authorize('admin', 'doctor', 'ophthalmologist'), logCriticalOperation('DOCUMENT_DELETE'), async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document || document.deleted) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    document.deleted = true;
    document.deletedAt = new Date();
    document.deletedBy = req.user._id;
    await document.save();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// SURGERY REPORT PDF ROUTES
// ============================================================

// @desc    Generate Surgery Report (Operative Report) PDF
// @route   GET /api/documents/surgery-report/:surgeryReportId/pdf
// @access  Private (doctor, ophthalmologist, admin)
router.get('/surgery-report/:surgeryReportId/pdf', protect, authorize(['doctor', 'ophthalmologist', 'admin']), logAction('DOCUMENT_GENERATE'), documentGenerationController.generateSurgeryReportPDF);

// @desc    Generate Pre-Op Checklist PDF
// @route   GET /api/documents/surgery-case/:surgeryCaseId/preop-checklist/pdf
// @access  Private (doctor, nurse, ophthalmologist, admin)
router.get('/surgery-case/:surgeryCaseId/preop-checklist/pdf', protect, authorize(['doctor', 'nurse', 'ophthalmologist', 'admin']), logAction('DOCUMENT_GENERATE'), documentGenerationController.generatePreOpChecklistPDF);

// @desc    Generate Post-Op Note (Patient Instructions) PDF
// @route   GET /api/documents/surgery-report/:surgeryReportId/postop-note/pdf
// @access  Private (doctor, nurse, ophthalmologist, admin)
router.get('/surgery-report/:surgeryReportId/postop-note/pdf', protect, authorize(['doctor', 'nurse', 'ophthalmologist', 'admin']), logAction('DOCUMENT_GENERATE'), documentGenerationController.generatePostOpNotePDF);

// ============================================================
// CERFA Document Generation Routes
// ============================================================

// @desc    Generate prescription PDF
// @route   POST /api/documents/generate/prescription
// @access  Private (doctor, ophthalmologist)
router.post('/generate/prescription', protect, authorize(['doctor', 'ophthalmologist', 'admin']), logAction('DOCUMENT_GENERATE'), documentController.generatePrescription);

// @desc    Generate medical certificate PDF
// @route   POST /api/documents/generate/certificate
// @access  Private (doctor, ophthalmologist)
router.post('/generate/certificate', protect, authorize(['doctor', 'ophthalmologist', 'admin']), logAction('DOCUMENT_GENERATE'), documentController.generateMedicalCertificate);

// @desc    Generate sick leave certificate PDF
// @route   POST /api/documents/generate/sick-leave
// @access  Private (doctor, ophthalmologist)
router.post('/generate/sick-leave', protect, authorize(['doctor', 'ophthalmologist', 'admin']), logAction('DOCUMENT_GENERATE'), documentController.generateSickLeave);

// @desc    Generate invoice PDF
// @route   POST /api/documents/generate/invoice
// @access  Private (doctor, receptionist, accountant, admin)
router.post('/generate/invoice', protect, authorize(['doctor', 'ophthalmologist', 'receptionist', 'accountant', 'admin']), logAction('DOCUMENT_GENERATE'), documentController.generateInvoice);

// @desc    Download generated document
// @route   GET /api/documents/download/:filename
// @access  Private (Medical staff)
router.get('/download/:filename', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist', 'accountant'), logAction('DOCUMENT_DOWNLOAD'), documentController.downloadDocument);

// @desc    Delete generated document
// @route   DELETE /api/documents/delete/:filename
// @access  Private
router.delete('/delete/:filename', protect, authorize(['doctor', 'admin']), logCriticalOperation('DOCUMENT_DELETE'), documentController.deleteDocument);

module.exports = router;
