/**
 * Face Recognition Routes
 *
 * Handles facial recognition operations for patient registration
 * and identity verification. Proxies requests to the Python
 * face recognition microservice.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { protect, authorize } = require('../middleware/auth');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');

// Face service URL - use explicit IPv4 to avoid IPv6 resolution issues on macOS
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:5002';

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/patient-photos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `patient-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
    }
  }
});

/**
 * @route   GET /api/face-recognition/health
 * @desc    Check face service health
 * @access  Private
 */
router.get('/health', protect, async (req, res) => {
  try {
    const response = await axios.get(`${FACE_SERVICE_URL}/health`, {
      timeout: 5000
    });
    res.json({
      success: true,
      faceService: response.data
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Face recognition service unavailable',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/face-recognition/detect
 * @desc    Detect faces in an image
 * @access  Private (nurses, doctors, receptionists)
 */
router.post('/detect', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'No image provided'
      });
    }

    const response = await axios.post(`${FACE_SERVICE_URL}/api/face/detect`, {
      image
    }, {
      timeout: 30000
    });

    res.json(response.data);
  } catch (error) {
    console.error('Face detection error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Face detection failed'
    });
  }
});

/**
 * @route   POST /api/face-recognition/check-duplicates
 * @desc    Check for duplicate patients using facial recognition
 * @access  Private (nurses, doctors, receptionists)
 */
router.post('/check-duplicates', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'No image provided'
      });
    }

    // Get all patients with face encodings
    const patientsWithEncodings = await Patient.find({
      'biometric.faceEncoding': { $exists: true, $ne: null }
    }).select('+biometric.faceEncoding firstName lastName dateOfBirth phoneNumber photoUrl patientId');

    // Prepare data for face service
    const existingPatients = patientsWithEncodings.map(p => ({
      patientId: p._id.toString(),
      name: `${p.firstName} ${p.lastName}`,
      dateOfBirth: p.dateOfBirth,
      phone: p.phoneNumber,
      photoUrl: p.photoUrl,
      encoding: p.biometric?.faceEncoding
    })).filter(p => p.encoding && p.encoding.length > 0);

    // Try to call face service for batch comparison
    try {
      const response = await axios.post(`${FACE_SERVICE_URL}/api/face/batch-compare`, {
        image,
        existingPatients,
        tolerance: 0.4  // Recommended tolerance for face matching (0.4 = 60% similarity threshold)
      }, {
        timeout: 30000 // 30 second timeout for DeepFace model loading
      });

      // Debug log the response
      console.log('[Face Service Response]', {
        success: response.data.success,
        hasEncoding: !!response.data.newEncoding,
        encodingLength: response.data.newEncoding?.length,
        duplicateCount: response.data.duplicateCount,
        hasPossibleDuplicates: response.data.hasPossibleDuplicates
      });

      // Log the duplicate check
      await AuditLog.create({
        user: req.user._id,
        action: 'FACE_DUPLICATE_CHECK',
        resource: 'Patient',
        details: {
          totalCompared: existingPatients.length,
          duplicatesFound: response.data.duplicateCount || 0,
          hasDefiniteDuplicates: response.data.hasDefiniteDuplicates
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        ...response.data
      });
    } catch (faceServiceError) {
      // Check if it's a real service error (network, timeout) vs a valid face detection error (400)
      const isNetworkError = !faceServiceError.response ||
        faceServiceError.code === 'ECONNREFUSED' ||
        faceServiceError.code === 'ETIMEDOUT' ||
        faceServiceError.code === 'ENOTFOUND';

      if (isNetworkError) {
        // Face service truly unavailable - allow proceeding without face check
        console.log('Face service unavailable, skipping duplicate check:', faceServiceError.message);
        res.json({
          success: true,
          serviceUnavailable: true,
          hasPossibleDuplicates: false,
          hasDefiniteDuplicates: false,
          duplicateCount: 0,
          totalCompared: 0,
          potentialDuplicates: [],
          message: 'Service de reconnaissance faciale non disponible. Vérification ignorée.'
        });
      } else {
        // Face service responded with an error (400 = no face, multiple faces, etc.)
        // Pass the actual error to the user so they can retry
        const errorData = faceServiceError.response?.data || {};
        console.log('Face service error:', errorData.error || faceServiceError.message);

        res.status(faceServiceError.response?.status || 400).json({
          success: false,
          error: errorData.error || 'Erreur lors de la vérification faciale',
          suggestion: errorData.suggestion || 'Veuillez réessayer avec une photo claire du visage',
          // Include encoding if it was generated before the error
          newEncoding: errorData.newEncoding
        });
      }
    }
  } catch (error) {
    console.error('Duplicate check error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Duplicate check failed'
    });
  }
});

/**
 * @route   POST /api/face-recognition/enroll/:patientId
 * @desc    Enroll a patient's face encoding
 * @access  Private (nurses, doctors, receptionists)
 */
router.post('/enroll/:patientId', protect, authorize('admin', 'doctor', 'nurse', 'receptionist'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { image, encoding, faceLocation, consentGiven } = req.body;

    if (!image && !encoding) {
      return res.status(400).json({
        success: false,
        error: 'Image or encoding required'
      });
    }

    if (!consentGiven) {
      return res.status(400).json({
        success: false,
        error: 'Patient consent required for biometric enrollment'
      });
    }

    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    let finalEncoding = encoding;
    let finalFaceLocation = faceLocation;

    // If image provided but no encoding, generate it
    if (image && !encoding) {
      const response = await axios.post(`${FACE_SERVICE_URL}/api/face/encode`, {
        image
      }, {
        timeout: 30000
      });

      if (!response.data.success) {
        return res.status(400).json({
          success: false,
          error: response.data.error || 'Failed to generate face encoding'
        });
      }

      finalEncoding = response.data.encoding;
      finalFaceLocation = response.data.faceLocation;
    }

    // Save the photo
    if (image) {
      const photoBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const photoFileName = `patient-${patientId}-${Date.now()}.jpg`;
      const photoPath = path.join(__dirname, '../uploads/patient-photos', photoFileName);

      await fs.mkdir(path.dirname(photoPath), { recursive: true });
      await fs.writeFile(photoPath, photoBuffer);

      patient.photoPath = photoPath;
      patient.photoUrl = `/uploads/patient-photos/${photoFileName}`;
    }

    // Track encoding history if updating
    if (patient.biometric?.faceEncoding?.length > 0) {
      if (!patient.biometric.encodingHistory) {
        patient.biometric.encodingHistory = [];
      }
      patient.biometric.encodingHistory.push({
        updatedAt: new Date(),
        updatedBy: req.user._id,
        reason: 'Photo update'
      });
    }

    // Save biometric data
    patient.biometric = {
      ...patient.biometric,
      faceEncoding: finalEncoding,
      encodingCapturedAt: new Date(),
      encodingCapturedBy: req.user._id,
      faceLocation: finalFaceLocation,
      consentGiven: true,
      consentDate: new Date(),
      encodingHistory: patient.biometric?.encodingHistory || []
    };

    await patient.save();

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      action: 'FACE_ENROLLMENT',
      resource: 'Patient',
      resourceId: patient._id,
      details: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        consentGiven: true
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Face enrollment successful',
      patient: {
        _id: patient._id,
        patientId: patient.patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        photoUrl: patient.photoUrl,
        biometricEnrolled: true,
        enrolledAt: patient.biometric.encodingCapturedAt
      }
    });
  } catch (error) {
    console.error('Face enrollment error:', error);
    res.status(500).json({
      success: false,
      error: 'Face enrollment failed'
    });
  }
});

/**
 * @route   POST /api/face-recognition/verify/:patientId
 * @desc    Verify a patient's identity using facial recognition
 * @access  Private
 */
router.post('/verify/:patientId', protect, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'No image provided'
      });
    }

    const patient = await Patient.findById(patientId).select('+biometric.faceEncoding');

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    if (!patient.biometric?.faceEncoding?.length) {
      return res.status(400).json({
        success: false,
        error: 'Patient does not have face encoding enrolled',
        requiresEnrollment: true
      });
    }

    // Call face service for verification
    const response = await axios.post(`${FACE_SERVICE_URL}/api/face/verify`, {
      liveImage: image,
      storedEncoding: patient.biometric.faceEncoding,
      patientId: patient._id.toString()
    }, {
      timeout: 30000
    });

    // Update last verification
    patient.biometric.lastVerification = {
      date: new Date(),
      success: response.data.verified,
      confidence: response.data.confidence,
      verifiedBy: req.user._id
    };
    await patient.save();

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      action: response.data.verified ? 'FACE_VERIFICATION_SUCCESS' : 'FACE_VERIFICATION_FAILED',
      resource: 'Patient',
      resourceId: patient._id,
      details: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        confidence: response.data.confidence,
        verified: response.data.verified
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      verified: response.data.verified,
      confidence: response.data.confidence,
      patient: response.data.verified ? {
        _id: patient._id,
        patientId: patient.patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        photoUrl: patient.photoUrl
      } : null,
      message: response.data.message
    });
  } catch (error) {
    // Check if it's a network error vs a valid face service response
    const isNetworkError = !error.response ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND';

    if (isNetworkError) {
      console.error('Face service unavailable:', error.message);
      res.status(503).json({
        success: false,
        verified: false,
        serviceUnavailable: true,
        error: 'Service de reconnaissance faciale non disponible',
        suggestion: 'Veuillez vérifier manuellement l\'identité du patient'
      });
    } else {
      // Pass through the actual error from face service (no face detected, etc.)
      console.error('Face verification error:', error.response?.data || error.message);
      res.status(error.response?.status || 400).json({
        success: false,
        verified: false,
        error: error.response?.data?.error || 'Échec de la vérification faciale',
        suggestion: error.response?.data?.suggestion || 'Veuillez réessayer avec une photo claire'
      });
    }
  }
});

/**
 * @route   DELETE /api/face-recognition/encoding/:patientId
 * @desc    Remove a patient's face encoding (GDPR compliance)
 * @access  Private (admin only)
 */
router.delete('/encoding/:patientId', protect, authorize('admin'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;

    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Clear biometric data but keep audit history
    const previousEnrollment = patient.biometric?.encodingCapturedAt;

    patient.biometric = {
      faceEncoding: null,
      encodingCapturedAt: null,
      encodingCapturedBy: null,
      faceLocation: null,
      consentGiven: false,
      consentDate: null,
      lastVerification: patient.biometric?.lastVerification,
      encodingHistory: [
        ...(patient.biometric?.encodingHistory || []),
        {
          updatedAt: new Date(),
          updatedBy: req.user._id,
          reason: reason || 'Biometric data removed'
        }
      ]
    };

    await patient.save();

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      action: 'FACE_ENCODING_DELETED',
      resource: 'Patient',
      resourceId: patient._id,
      details: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        previousEnrollment,
        reason
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Face encoding removed successfully'
    });
  } catch (error) {
    console.error('Face encoding deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove face encoding'
    });
  }
});

/**
 * @route   GET /api/face-recognition/stats
 * @desc    Get face recognition statistics
 * @access  Private (admin)
 */
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const enrolledPatients = await Patient.countDocuments({
      'biometric.faceEncoding': { $exists: true, $ne: null }
    });

    const recentVerifications = await AuditLog.find({
      action: { $in: ['face_verification_success', 'face_verification_failed'] }
    })
      .sort({ createdAt: -1 })
      .limit(100);

    const successfulVerifications = recentVerifications.filter(
      v => v.action === 'face_verification_success'
    ).length;

    res.json({
      success: true,
      stats: {
        totalPatients,
        enrolledPatients,
        enrollmentRate: totalPatients > 0 ? ((enrolledPatients / totalPatients) * 100).toFixed(1) : 0,
        recentVerifications: recentVerifications.length,
        verificationSuccessRate: recentVerifications.length > 0
          ? ((successfulVerifications / recentVerifications.length) * 100).toFixed(1)
          : 0
      }
    });
  } catch (error) {
    console.error('Face stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
