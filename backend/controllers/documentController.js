const cerfaGenerator = require('../services/cerfaGenerator');
const Patient = require('../models/Patient');
const User = require('../models/User');

/**
 * Generate medical prescription PDF
 */
exports.generatePrescription = async (req, res) => {
  try {
    const {
      patientId,
      prescriptions,
      notes,
      prescriptionId
    } = req.body;

    // Get patient data
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
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

    res.json({
      success: true,
      message: 'Prescription generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error generating prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating prescription',
      error: error.message
    });
  }
};

/**
 * Generate medical certificate PDF
 */
exports.generateMedicalCertificate = async (req, res) => {
  try {
    const {
      patientId,
      certificateType,
      reason,
      findings,
      certificateId
    } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
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

    res.json({
      success: true,
      message: 'Medical certificate generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error generating medical certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating medical certificate',
      error: error.message
    });
  }
};

/**
 * Generate sick leave certificate PDF
 */
exports.generateSickLeave = async (req, res) => {
  try {
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
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
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

    res.json({
      success: true,
      message: 'Sick leave certificate generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error generating sick leave:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating sick leave certificate',
      error: error.message
    });
  }
};

/**
 * Generate invoice PDF
 */
exports.generateInvoice = async (req, res) => {
  try {
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
      return res.status(400).json({
        success: false,
        message: 'Invoice items are required'
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
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

    res.json({
      success: true,
      message: 'Invoice generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoice',
      error: error.message
    });
  }
};

/**
 * Download document
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    const filepath = cerfaGenerator.getDocumentPath(filename);

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Send file
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading document:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error downloading document'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error in downloadDocument:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading document',
      error: error.message
    });
  }
};

/**
 * Delete document
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    const result = await cerfaGenerator.deleteDocument(filename);

    if (result.success) {
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting document',
      error: error.message
    });
  }
};
