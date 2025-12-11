/**
 * OCR Import Controller
 * Handles communication with OCR microservice and patient matching
 */

const axios = require('axios');
const Document = require('../models/Document');
const Patient = require('../models/Patient');
const Device = require('../models/Device');
const { asyncHandler } = require('../middleware/errorHandler');

// OCR Service URL
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5003';

/**
 * @desc    Get available network shares
 * @route   GET /api/ocr/shares
 * @access  Private
 */
exports.getNetworkShares = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${OCR_SERVICE_URL}/api/shares`, {
      timeout: 10000
    });

    res.json({
      success: true,
      data: response.data.shares
    });
  } catch (error) {
    console.error('Error fetching network shares:', error.message);
    res.status(503).json({
      success: false,
      error: 'OCR service unavailable'
    });
  }
});

/**
 * @desc    Scan a folder for files
 * @route   GET /api/ocr/scan
 * @access  Private
 */
exports.scanFolder = asyncHandler(async (req, res) => {
  const { folder_path, max_files = 1000, recursive = true } = req.query;

  if (!folder_path) {
    return res.status(400).json({
      success: false,
      error: 'folder_path is required'
    });
  }

  try {
    const response = await axios.get(`${OCR_SERVICE_URL}/api/ocr/scan`, {
      params: { folder_path, max_files, recursive },
      timeout: 30000
    });

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error scanning folder:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.detail || 'Failed to scan folder'
    });
  }
});

/**
 * @desc    Preview patients that would be imported
 * @route   GET /api/ocr/preview
 * @access  Private
 */
exports.previewPatients = asyncHandler(async (req, res) => {
  const { folder_path, device_type = 'generic', max_patients = 20 } = req.query;

  if (!folder_path) {
    return res.status(400).json({
      success: false,
      error: 'folder_path is required'
    });
  }

  try {
    const response = await axios.get(`${OCR_SERVICE_URL}/api/ocr/patients-preview`, {
      params: { folder_path, device_type, max_patients },
      timeout: 60000
    });

    // Enrich with existing patient matches
    const enrichedPatients = await Promise.all(
      response.data.patients.map(async (p) => {
        const matches = await findPatientMatches(p.patient_key);
        return {
          ...p,
          existing_matches: matches
        };
      })
    );

    res.json({
      success: true,
      data: {
        ...response.data,
        patients: enrichedPatients
      }
    });
  } catch (error) {
    console.error('Error previewing patients:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.detail || 'Failed to preview patients'
    });
  }
});

/**
 * @desc    Start batch import
 * @route   POST /api/ocr/import
 * @access  Private
 */
exports.startImport = asyncHandler(async (req, res) => {
  const {
    folder_path,
    device_type,
    max_files = 100,
    max_patients = 20,
    device_id
  } = req.body;

  if (!folder_path || !device_type) {
    return res.status(400).json({
      success: false,
      error: 'folder_path and device_type are required'
    });
  }

  try {
    // Start batch processing in OCR service
    const response = await axios.post(
      `${OCR_SERVICE_URL}/api/ocr/batch`,
      {
        folder_path,
        device_type,
        max_files,
        max_patients
      },
      { timeout: 30000 }
    );

    // Store import job info
    const importJob = {
      task_id: response.data.task_id,
      folder_path,
      device_type,
      device_id,
      started_by: req.user.id,
      started_at: new Date(),
      status: 'processing'
    };

    // Could store in Redis or MongoDB for tracking

    res.json({
      success: true,
      data: {
        task_id: response.data.task_id,
        message: response.data.message
      }
    });
  } catch (error) {
    console.error('Error starting import:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.detail || 'Failed to start import'
    });
  }
});

/**
 * @desc    Get import task status
 * @route   GET /api/ocr/import/:taskId/status
 * @access  Private
 */
exports.getImportStatus = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  try {
    const response = await axios.get(
      `${OCR_SERVICE_URL}/api/ocr/status/${taskId}`,
      { timeout: 10000 }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error fetching import status:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch import status'
    });
  }
});

/**
 * @desc    Cancel import task
 * @route   POST /api/ocr/import/:taskId/cancel
 * @access  Private
 */
exports.cancelImport = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  try {
    await axios.post(
      `${OCR_SERVICE_URL}/api/ocr/status/${taskId}/cancel`,
      {},
      { timeout: 10000 }
    );

    res.json({
      success: true,
      message: 'Import cancellation requested'
    });
  } catch (error) {
    console.error('Error cancelling import:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel import'
    });
  }
});

/**
 * @desc    Receive OCR results from microservice
 * @route   POST /api/ocr/results
 * @access  Internal (from OCR service)
 */
exports.receiveOCRResults = asyncHandler(async (req, res) => {
  const {
    file_path,
    file_name,
    file_type,
    device_type,
    ocr_text,
    extracted_info,
    thumbnail_path,
    auto_link_threshold = 0.85
  } = req.body;

  // Try to match to existing patient
  const matchResult = await matchPatient(extracted_info, auto_link_threshold);

  // Create document record
  const documentData = {
    title: file_name,
    category: 'imaging',
    type: file_type === 'pdf' ? 'pdf' : 'image',
    file: {
      filename: file_name,
      originalName: file_name,
      path: file_path,
      size: 0 // We don't copy the file
    },
    metadata: {
      source: 'ocr-import',
      deviceType: device_type,
      ocrText: ocr_text?.substring(0, 5000), // Limit stored text
      extractedInfo: extracted_info,
      thumbnailPath: thumbnail_path
    },
    tags: ['imported', device_type],
    // Link to patient if confident match
    patient: matchResult.matched ? matchResult.patient_id : null,
    // Store match info for review
    customFields: {
      matchConfidence: matchResult.confidence,
      matchStatus: matchResult.matched ? 'auto-linked' : 'pending-review',
      suggestedPatientId: matchResult.suggested_patient_id,
      suggestedPatientName: matchResult.suggested_patient_name
    }
  };

  // Determine subcategory based on device type
  const subCategoryMap = {
    'zeiss': 'fundus-photo',
    'solix': 'oct',
    'tomey': 'topography',
    'quantel': 'ultrasound'
  };

  if (subCategoryMap[device_type]) {
    documentData.subCategory = subCategoryMap[device_type];
  }

  const document = await Document.create(documentData);

  res.json({
    success: true,
    data: {
      document_id: document._id,
      matched: matchResult.matched,
      confidence: matchResult.confidence
    }
  });
});

/**
 * @desc    Get pending review queue
 * @route   GET /api/ocr/review-queue
 * @access  Private
 */
exports.getReviewQueue = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const documents = await Document.find({
    'customFields.matchStatus': 'pending-review',
    'metadata.source': 'ocr-import'
  })
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  const total = await Document.countDocuments({
    'customFields.matchStatus': 'pending-review',
    'metadata.source': 'ocr-import'
  });

  // Enrich with suggested patient info
  const enrichedDocs = await Promise.all(
    documents.map(async (doc) => {
      let suggestedPatient = null;
      if (doc.customFields?.suggestedPatientId) {
        suggestedPatient = await Patient.findById(
          doc.customFields.suggestedPatientId,
          'firstName lastName patientId dateOfBirth'
        ).lean();
      }
      return {
        ...doc,
        suggestedPatient
      };
    })
  );

  res.json({
    success: true,
    data: enrichedDocs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

/**
 * @desc    Link document to patient (manual review)
 * @route   POST /api/ocr/review/:documentId/link
 * @access  Private
 */
exports.linkToPatient = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { patient_id } = req.body;

  const document = await Document.findById(documentId);
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }

  // Verify patient exists
  const patient = await Patient.findById(patient_id);
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Link document to patient
  document.patient = patient_id;
  document.customFields = {
    ...document.customFields,
    matchStatus: 'manually-linked',
    linkedBy: req.user.id,
    linkedAt: new Date()
  };

  await document.save();

  res.json({
    success: true,
    data: document
  });
});

/**
 * @desc    Skip/reject document from review
 * @route   POST /api/ocr/review/:documentId/skip
 * @access  Private
 */
exports.skipDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { reason } = req.body;

  const document = await Document.findByIdAndUpdate(
    documentId,
    {
      $set: {
        'customFields.matchStatus': 'skipped',
        'customFields.skipReason': reason,
        'customFields.skippedBy': req.user.id,
        'customFields.skippedAt': new Date()
      }
    },
    { new: true }
  );

  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }

  res.json({
    success: true,
    data: document
  });
});

/**
 * @desc    Search patients for manual linking
 * @route   GET /api/ocr/patients/search
 * @access  Private
 */
exports.searchPatients = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const patients = await Patient.find({
    isDeleted: { $ne: true },
    $or: [
      { firstName: new RegExp(q, 'i') },
      { lastName: new RegExp(q, 'i') },
      { patientId: new RegExp(q, 'i') }
    ]
  })
    .select('firstName lastName patientId dateOfBirth')
    .limit(parseInt(limit))
    .lean();

  res.json({
    success: true,
    data: patients
  });
});

// ==================== Helper Functions ====================

/**
 * Find potential patient matches based on extracted info
 */
async function findPatientMatches(patientKey) {
  const parts = patientKey.split('_').filter(Boolean);
  if (parts.length === 0) return [];

  const query = {
    isDeleted: { $ne: true },
    $or: []
  };

  // Add name-based search
  if (parts.length >= 2) {
    query.$or.push(
      {
        lastName: new RegExp(`^${parts[0]}$`, 'i'),
        firstName: new RegExp(`^${parts[1]}`, 'i')
      },
      {
        firstName: new RegExp(`^${parts[0]}$`, 'i'),
        lastName: new RegExp(`^${parts[1]}`, 'i')
      }
    );
  }

  // Add patient ID search
  for (const part of parts) {
    if (/^[A-Z0-9]{4,}$/i.test(part)) {
      query.$or.push({ patientId: new RegExp(part, 'i') });
    }
  }

  if (query.$or.length === 0) return [];

  const matches = await Patient.find(query)
    .select('firstName lastName patientId dateOfBirth')
    .limit(5)
    .lean();

  return matches;
}

/**
 * Match extracted patient info to existing patients
 */
async function matchPatient(extractedInfo, threshold = 0.85) {
  if (!extractedInfo) {
    return { matched: false, confidence: 0 };
  }

  const { first_name, last_name, patient_id, date_of_birth } = extractedInfo;

  // Build query
  const query = { isDeleted: { $ne: true } };
  const conditions = [];

  // Exact patient ID match (highest confidence)
  if (patient_id) {
    const byId = await Patient.findOne({
      patientId: patient_id,
      ...query
    }).lean();

    if (byId) {
      return {
        matched: true,
        confidence: 0.95,
        patient_id: byId._id,
        patient_name: `${byId.firstName} ${byId.lastName}`
      };
    }
  }

  // Name + DOB match
  if (last_name && date_of_birth) {
    const byNameDob = await Patient.findOne({
      lastName: new RegExp(`^${last_name}$`, 'i'),
      dateOfBirth: date_of_birth,
      ...query
    }).lean();

    if (byNameDob) {
      return {
        matched: true,
        confidence: 0.90,
        patient_id: byNameDob._id,
        patient_name: `${byNameDob.firstName} ${byNameDob.lastName}`
      };
    }
  }

  // Fuzzy name match
  if (last_name && first_name) {
    const byName = await Patient.findOne({
      lastName: new RegExp(`^${last_name}$`, 'i'),
      firstName: new RegExp(`^${first_name}`, 'i'),
      ...query
    }).lean();

    if (byName) {
      const confidence = date_of_birth ? 0.80 : 0.70;
      const matched = confidence >= threshold;

      return {
        matched,
        confidence,
        patient_id: matched ? byName._id : null,
        suggested_patient_id: byName._id,
        suggested_patient_name: `${byName.firstName} ${byName.lastName}`
      };
    }
  }

  // Last name only match (low confidence)
  if (last_name) {
    const byLastName = await Patient.find({
      lastName: new RegExp(`^${last_name}$`, 'i'),
      ...query
    })
      .limit(3)
      .lean();

    if (byLastName.length === 1) {
      return {
        matched: false,
        confidence: 0.50,
        suggested_patient_id: byLastName[0]._id,
        suggested_patient_name: `${byLastName[0].firstName} ${byLastName[0].lastName}`
      };
    }
  }

  return { matched: false, confidence: 0 };
}

module.exports = exports;
