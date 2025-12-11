const cerfaGenerator = require('../services/cerfaGenerator');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { createContextLogger } = require('../utils/structuredLogger');
const documentLogger = createContextLogger('Document');
const { UPLOAD, PAGINATION } = require('../config/constants');

/**
 * Generate medical prescription PDF
 */
exports.generatePrescription = asyncHandler(async (req, res) => {
  const {
    patientId,
    prescriptions,
    notes,
    prescriptionId
  } = req.body;

  // Get patient data
  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get doctor data (current user)
  const doctor = await User.findById(req.user._id);

  // Clinic information (from environment or settings)
  const clinicInfo = {
    name: process.env.CLINIC_NAME || 'MedFlow Clinic',
    address: process.env.CLINIC_ADDRESS || '',
    phone: process.env.CLINIC_PHONE || '',
    email: process.env.CLINIC_EMAIL || '',
    city: process.env.CLINIC_CITY || '',
    footer: 'Document généré par MedFlow - Système de gestion médicale'
  };

  // Generate PDF
  const result = await cerfaGenerator.generatePrescription({
    doctor: {
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
      licenseNumber: doctor.licenseNumber
    },
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      socialSecurityNumber: patient.socialSecurityNumber
    },
    prescriptions,
    notes,
    prescriptionId,
    clinicInfo
  });

  return success(res, { data: result, message: 'Prescription generated successfully' });
});

/**
 * Generate medical certificate PDF
 */
exports.generateMedicalCertificate = asyncHandler(async (req, res) => {
  const {
    patientId,
    certificateType,
    reason,
    findings,
    certificateId
  } = req.body;

  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  const doctor = await User.findById(req.user._id);

  const clinicInfo = {
    name: process.env.CLINIC_NAME || 'MedFlow Clinic',
    address: process.env.CLINIC_ADDRESS || '',
    phone: process.env.CLINIC_PHONE || '',
    email: process.env.CLINIC_EMAIL || '',
    city: process.env.CLINIC_CITY || '',
    footer: 'Document généré par MedFlow - Système de gestion médicale'
  };

  const result = await cerfaGenerator.generateMedicalCertificate({
    doctor: {
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
      licenseNumber: doctor.licenseNumber
    },
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      address: patient.address
    },
    certificateType,
    reason,
    findings,
    certificateId,
    clinicInfo
  });

  return success(res, { data: result, message: 'Medical certificate generated successfully' });
});

/**
 * Generate sick leave certificate PDF
 */
exports.generateSickLeave = asyncHandler(async (req, res) => {
  const {
    patientId,
    startDate,
    endDate,
    reason,
    restrictions,
    outingsAllowed,
    includeReason,
    certificateId
  } = req.body;

  if (!startDate || !endDate) {
    return error(res, 'Start date and end date are required');
  }

  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  const doctor = await User.findById(req.user._id);

  const clinicInfo = {
    name: process.env.CLINIC_NAME || 'MedFlow Clinic',
    address: process.env.CLINIC_ADDRESS || '',
    phone: process.env.CLINIC_PHONE || '',
    email: process.env.CLINIC_EMAIL || '',
    city: process.env.CLINIC_CITY || '',
    footer: 'Document généré par MedFlow - Système de gestion médicale'
  };

  const result = await cerfaGenerator.generateSickLeave({
    doctor: {
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
      licenseNumber: doctor.licenseNumber
    },
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      socialSecurityNumber: patient.socialSecurityNumber
    },
    startDate,
    endDate,
    reason,
    restrictions,
    outingsAllowed,
    includeReason,
    certificateId,
    clinicInfo
  });

  return success(res, { data: result, message: 'Sick leave certificate generated successfully' });
});

/**
 * Generate invoice PDF
 */
exports.generateInvoice = asyncHandler(async (req, res) => {
  const {
    patientId,
    invoiceNumber,
    items,
    subtotal,
    tax,
    total,
    paymentMethod
  } = req.body;

  if (!items || items.length === 0) {
    return error(res, 'Invoice items are required');
  }

  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  const doctor = await User.findById(req.user._id);

  const clinicInfo = {
    name: process.env.CLINIC_NAME || 'MedFlow Clinic',
    address: process.env.CLINIC_ADDRESS || '',
    phone: process.env.CLINIC_PHONE || '',
    email: process.env.CLINIC_EMAIL || '',
    city: process.env.CLINIC_CITY || '',
    footer: 'Document généré par MedFlow - Système de gestion médicale'
  };

  const result = await cerfaGenerator.generateInvoice({
    invoiceNumber,
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      address: patient.address,
      phone: patient.phone
    },
    doctor: {
      firstName: doctor.firstName,
      lastName: doctor.lastName
    },
    items,
    subtotal,
    tax,
    total,
    paymentMethod,
    clinicInfo
  });

  return success(res, { data: result, message: 'Invoice generated successfully' });
});

/**
 * Download document
 */
exports.downloadDocument = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const Document = require('../models/Document');
  const AuditLog = require('../models/AuditLog');

  // Validate filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return error(res, 'Invalid filename');
  }

  // SECURITY FIX: Look up document and check access permissions
  const document = await Document.findOne({
    'file.filename': filename,
    deleted: false
  }).populate('patient', '_id');

  if (document) {
    // Check access permissions based on security.accessLevel and user role
    const userRole = req.user?.role || 'staff';
    const userId = req.user?.id || req.user?._id;
    const accessLevel = document.security?.accessLevel || 'staff';

    let hasAccess = false;

    // Admin always has access
    if (userRole === 'admin') {
      hasAccess = true;
    }
    // Creator always has access
    else if (document.createdBy?.toString() === userId?.toString()) {
      hasAccess = true;
    }
    // Check access level permissions
    else if (accessLevel === 'public') {
      hasAccess = true;
    }
    else if (accessLevel === 'staff' && ['admin', 'doctor', 'nurse', 'reception', 'receptionist', 'billing', 'pharmacist', 'lab_tech', 'ophthalmologist', 'optometrist'].includes(userRole)) {
      hasAccess = true;
    }
    else if (accessLevel === 'provider' && ['admin', 'doctor', 'ophthalmologist', 'optometrist', 'nurse'].includes(userRole)) {
      hasAccess = true;
    }
    // Check if explicitly shared with user
    else if (document.security?.sharedWith?.length > 0) {
      const share = document.security.sharedWith.find(s =>
        s.user?.toString() === userId?.toString() &&
        (!s.expiresAt || new Date(s.expiresAt) > new Date())
      );
      if (share && ['view', 'edit', 'delete'].includes(share.permission)) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      // Log unauthorized access attempt
      await AuditLog.create({
        user: userId,
        action: 'DOCUMENT_ACCESS_DENIED',
        resource: `/api/documents/download/${filename}`,
        ipAddress: req.ip,
        metadata: {
          documentId: document._id,
          filename,
          reason: 'Insufficient permissions',
          userRole,
          accessLevel
        }
      });

      return error(res, 'Accès refusé: Vous n\'avez pas la permission d\'accéder à ce document', 403);
    }

    // Track document access
    try {
      await document.trackView();
      document.stats = document.stats || {};
      document.stats.downloads = (document.stats.downloads || 0) + 1;
      document.stats.lastDownloaded = new Date();
      await document.save();
    } catch (trackError) {
      documentLogger.error('Error tracking document download', { error: trackError.message, filename });
    }

    // Log successful access
    await AuditLog.create({
      user: userId,
      action: 'DOCUMENT_DOWNLOAD',
      resource: `/api/documents/download/${filename}`,
      ipAddress: req.ip,
      metadata: {
        documentId: document._id,
        filename,
        patientId: document.patient?._id
      }
    });
  }

  const filepath = cerfaGenerator.getDocumentPath(filename);

  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(filepath)) {
    return notFound(res, 'Document');
  }

  // Send file
  res.download(filepath, filename, (err) => {
    if (err) {
      documentLogger.error('Error downloading document', { error: err.message, filename });
      if (!res.headersSent) {
        return error(res, 'Error downloading document', 500);
      }
    }
  });
});

/**
 * Delete document
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Validate filename
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return error(res, 'Invalid filename');
  }

  const result = await cerfaGenerator.deleteDocument(filename);

  if (result.success) {
    return success(res, { data: null, message: 'Document deleted successfully' });
  } else {
    return notFound(res, 'Document');
  }
});
