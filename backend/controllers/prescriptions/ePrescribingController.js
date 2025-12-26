/**
 * E-Prescribing Controller
 *
 * Handles electronic prescribing (NCPDP) operations:
 * - E-prescription transmission
 * - Transmission status tracking
 * - E-prescription cancellation
 * - Refill request responses
 * - Pharmacy search and verification
 * - Prior authorization workflows
 */

const Prescription = require('../../models/Prescription');
const { asyncHandler } = require('../../middleware/errorHandler');
const ePrescribingService = require('../../services/ePrescribingService');
const { success, error, notFound } = require('../../utils/apiResponse');
const { PRESCRIPTION } = require('../../config/constants');

// Prior authorization status constants
const PRIOR_AUTH_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  DENIED: 'denied',
  APPEAL_PENDING: 'appeal_pending',
  EXPIRED: 'expired'
};

// @desc    Transmit prescription electronically
// @route   POST /api/prescriptions/:id/e-prescribe
// @access  Private (Doctor, Admin)
exports.transmitEPrescription = asyncHandler(async (req, res) => {
  const { pharmacyId, pharmacyNcpdpId, pharmacyName, pharmacyAddress, pharmacyPhone, urgent } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth gender address phoneNumber patientId')
    .populate('prescriber', 'firstName lastName licenseNumber specialization phoneNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if prescription is valid for transmission
  if (prescription.status === 'cancelled') {
    return error(res, 'Cannot transmit a cancelled prescription');
  }

  if (prescription.isExpired) {
    return error(res, 'Cannot transmit an expired prescription');
  }

  // Check if already transmitted
  if (prescription.ePrescription?.transmittedAt && prescription.ePrescription?.status === 'transmitted') {
    return res.status(400).json({
      success: false,
      error: 'Prescription has already been transmitted. Use cancel and resend if needed.',
      transmissionId: prescription.ePrescription.transmissionId
    });
  }

  // Build pharmacy object
  const pharmacy = {
    ncpdpId: pharmacyNcpdpId || pharmacyId,
    name: pharmacyName || 'Unknown Pharmacy',
    address: pharmacyAddress || {},
    phone: pharmacyPhone || ''
  };

  // Transmit prescription
  const result = await ePrescribingService.transmitPrescription(
    prescription,
    pharmacy,
    prescription.prescriber,
    ePrescribingService.MESSAGE_TYPES.NEW_RX
  );

  if (result.success) {
    // Update prescription with e-prescription details
    prescription.ePrescription = {
      enabled: true,
      transmittedAt: new Date(),
      transmissionId: result.transmissionId,
      sentTo: {
        pharmacy: pharmacy.name,
        ncpdpId: pharmacy.ncpdpId
      },
      status: result.status,
      messageId: result.messageId,
      urgent: urgent || false,
      testMode: result.testMode || false
    };

    // Update pharmacy status
    prescription.pharmacyStatus = 'received';

    // Add to status history
    if (!prescription.pharmacyStatusHistory) {
      prescription.pharmacyStatusHistory = [];
    }
    prescription.pharmacyStatusHistory.push({
      status: 'e-prescribed',
      changedAt: new Date(),
      changedBy: req.user._id || req.user.id,
      notes: `E-prescription sent to ${pharmacy.name} (NCPDP: ${pharmacy.ncpdpId})`
    });

    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription transmitted successfully',
      data: {
        transmissionId: result.transmissionId,
        messageId: result.messageId,
        status: result.status,
        pharmacy: pharmacy.name,
        testMode: result.testMode
      }
    });
  } else {
    // Update prescription with error
    prescription.ePrescription = {
      enabled: true,
      status: 'error',
      errorMessage: result.error
    };
    await prescription.save();

    res.status(400).json({
      success: false,
      error: result.error,
      status: result.status
    });
  }
});

// @desc    Get e-prescription transmission status
// @route   GET /api/prescriptions/:id/e-prescribe/status
// @access  Private
exports.getEPrescriptionStatus = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.ePrescription?.transmissionId) {
    return error(res, 'Prescription has not been e-prescribed');
  }

  // Check current status from e-prescribing service
  const status = await ePrescribingService.checkTransmissionStatus(
    prescription.ePrescription.transmissionId
  );

  // Update prescription if status changed
  if (status.status && status.status !== prescription.ePrescription.status) {
    prescription.ePrescription.status = status.status;
    if (status.receivedAt) {
      prescription.ePrescription.receivedAt = status.receivedAt;
    }
    if (status.pharmacyResponse) {
      prescription.ePrescription.pharmacyResponse = status.pharmacyResponse;
    }
    await prescription.save();
  }

  res.json({
    success: true,
    data: {
      transmissionId: prescription.ePrescription.transmissionId,
      status: status.status || prescription.ePrescription.status,
      transmittedAt: prescription.ePrescription.transmittedAt,
      receivedAt: status.receivedAt || prescription.ePrescription.receivedAt,
      pharmacy: prescription.ePrescription.sentTo,
      testMode: status.testMode || prescription.ePrescription.testMode
    }
  });
});

// @desc    Cancel e-prescription
// @route   POST /api/prescriptions/:id/e-prescribe/cancel
// @access  Private (Doctor, Admin)
exports.cancelEPrescription = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.ePrescription?.transmissionId) {
    return error(res, 'Prescription has not been e-prescribed');
  }

  const pharmacy = {
    ncpdpId: prescription.ePrescription.sentTo?.ncpdpId,
    name: prescription.ePrescription.sentTo?.pharmacy
  };

  const result = await ePrescribingService.cancelTransmittedPrescription(
    prescription,
    pharmacy,
    prescription.prescriber,
    reason || 'Cancelled by prescriber'
  );

  if (result.success) {
    prescription.ePrescription.status = 'cancelled';
    prescription.ePrescription.cancelledAt = new Date();
    prescription.ePrescription.cancelReason = reason;

    // Add to status history
    if (!prescription.pharmacyStatusHistory) {
      prescription.pharmacyStatusHistory = [];
    }
    prescription.pharmacyStatusHistory.push({
      status: 'e-prescription-cancelled',
      changedAt: new Date(),
      changedBy: req.user._id || req.user.id,
      notes: `E-prescription cancelled: ${reason || 'No reason provided'}`
    });

    await prescription.save();

    res.json({
      success: true,
      message: 'E-prescription cancelled successfully',
      data: {
        transmissionId: result.transmissionId,
        status: 'cancelled'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

// @desc    Respond to refill request
// @route   POST /api/prescriptions/:id/e-prescribe/refill-response
// @access  Private (Doctor, Admin)
exports.respondToRefillRequest = asyncHandler(async (req, res) => {
  const { approved, reason, newQuantity, newRefills } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const pharmacy = {
    ncpdpId: prescription.ePrescription?.sentTo?.ncpdpId,
    name: prescription.ePrescription?.sentTo?.pharmacy
  };

  const result = await ePrescribingService.respondToRefillRequest(
    prescription,
    pharmacy,
    prescription.prescriber,
    approved,
    reason
  );

  if (result.success) {
    // Update prescription based on approval
    if (approved) {
      prescription.medications.forEach(med => {
        if (med.refills) {
          med.refills.remaining = newRefills || (med.refills.remaining + 1);
        }
      });
    }

    prescription.refillResponse = {
      approved,
      reason,
      respondedAt: new Date(),
      respondedBy: req.user._id || req.user.id,
      transmissionId: result.transmissionId
    };

    await prescription.save();

    res.json({
      success: true,
      message: `Refill request ${approved ? 'approved' : 'denied'}`,
      data: {
        approved,
        transmissionId: result.transmissionId
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

// @desc    Search for e-prescribing pharmacies
// @route   GET /api/prescriptions/e-prescribing/pharmacies
// @access  Private
exports.searchEPrescribingPharmacies = asyncHandler(async (req, res) => {
  const { city, state, postalCode, name, radius } = req.query;

  const result = await ePrescribingService.searchEPrescribingPharmacies({
    city,
    state,
    postalCode,
    name,
    radius: radius || 10
  });

  res.json({
    success: result.success,
    count: result.pharmacies?.length || 0,
    data: result.pharmacies,
    testMode: result.testMode
  });
});

// @desc    Verify pharmacy for e-prescribing
// @route   GET /api/prescriptions/e-prescribing/pharmacy/:ncpdpId/verify
// @access  Private
exports.verifyPharmacy = asyncHandler(async (req, res) => {
  const { ncpdpId } = req.params;

  const result = await ePrescribingService.verifyPharmacy(ncpdpId);

  res.json({
    success: result.verified,
    data: result
  });
});

// @desc    Get e-prescribing service status
// @route   GET /api/prescriptions/e-prescribing/status
// @access  Private
exports.getEPrescribingServiceStatus = asyncHandler(async (req, res) => {
  const status = ePrescribingService.getServiceStatus();

  res.json({
    success: true,
    data: status
  });
});

// ============================================
// PRIOR AUTHORIZATION ENDPOINTS
// ============================================

// @desc    Request prior authorization
// @route   POST /api/prescriptions/:id/prior-auth/request
// @access  Private (Doctor, Admin, Nurse)
exports.requestPriorAuthorization = asyncHandler(async (req, res) => {
  const {
    insuranceProvider,
    policyNumber,
    groupNumber,
    diagnosis,
    clinicalJustification,
    previousTherapies,
    urgency,
    contactPhone,
    contactFax,
    additionalDocuments
  } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth patientId insurance')
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if prior auth already exists and is active
  if (prescription.priorAuthorization?.status === PRIOR_AUTH_STATUS.SUBMITTED ||
      prescription.priorAuthorization?.status === PRIOR_AUTH_STATUS.IN_REVIEW) {
    return res.status(400).json({
      success: false,
      error: 'Prior authorization already submitted and pending review',
      currentStatus: prescription.priorAuthorization.status
    });
  }

  // Generate prior auth reference number
  const authReference = `PA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Create prior authorization record
  prescription.priorAuthorization = {
    required: true,
    status: PRIOR_AUTH_STATUS.SUBMITTED,
    referenceNumber: authReference,
    requestedAt: new Date(),
    requestedBy: req.user._id || req.user.id,

    // Insurance info
    insurance: {
      provider: insuranceProvider || prescription.patient?.insurance?.provider,
      policyNumber: policyNumber || prescription.patient?.insurance?.policyNumber,
      groupNumber: groupNumber || prescription.patient?.insurance?.groupNumber
    },

    // Clinical information
    clinicalInfo: {
      diagnosis: diagnosis || prescription.diagnosis,
      justification: clinicalJustification,
      previousTherapies: previousTherapies || [],
      urgency: urgency || 'routine' // routine, urgent, emergent
    },

    // Contact information
    contact: {
      phone: contactPhone || prescription.prescriber?.phone,
      fax: contactFax || prescription.prescriber?.fax
    },

    // Document references
    documents: additionalDocuments || [],

    // History
    statusHistory: [{
      status: PRIOR_AUTH_STATUS.SUBMITTED,
      changedAt: new Date(),
      changedBy: req.user._id || req.user.id,
      notes: 'Prior authorization request submitted'
    }]
  };

  // Update insurance on prescription
  prescription.insurance = {
    used: true,
    provider: insuranceProvider || prescription.patient?.insurance?.provider,
    policyNumber: policyNumber || prescription.patient?.insurance?.policyNumber,
    groupNumber: groupNumber,
    priorAuthRequired: true,
    priorAuthNumber: authReference,
    coverageStatus: 'pending'
  };

  await prescription.save();

  res.status(201).json({
    success: true,
    message: 'Prior authorization request submitted',
    data: {
      referenceNumber: authReference,
      status: PRIOR_AUTH_STATUS.SUBMITTED,
      requestedAt: prescription.priorAuthorization.requestedAt,
      insurance: prescription.priorAuthorization.insurance
    }
  });
});

// @desc    Update prior authorization status
// @route   PUT /api/prescriptions/:id/prior-auth/update
// @access  Private (Admin, Pharmacist)
exports.updatePriorAuthorization = asyncHandler(async (req, res) => {
  const {
    status,
    authorizationNumber,
    approvedQuantity,
    approvedRefills,
    approvedDays,
    expirationDate,
    denialReason,
    notes,
    insuranceResponse
  } = req.body;

  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.priorAuthorization) {
    return error(res, 'No prior authorization request found for this prescription');
  }

  // Validate status transition
  const validStatuses = Object.values(PRIOR_AUTH_STATUS);
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  const previousStatus = prescription.priorAuthorization.status;

  // Update prior authorization
  if (status) {
    prescription.priorAuthorization.status = status;
  }

  if (status === PRIOR_AUTH_STATUS.APPROVED) {
    prescription.priorAuthorization.approval = {
      authorizationNumber: authorizationNumber,
      approvedAt: new Date(),
      approvedBy: req.user._id || req.user.id,
      approvedQuantity: approvedQuantity,
      approvedRefills: approvedRefills,
      approvedDays: approvedDays,
      expirationDate: expirationDate || new Date(Date.now() + PRESCRIPTION.OPTICAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
    };

    // Update insurance info
    prescription.insurance.priorAuthNumber = authorizationNumber;
    prescription.insurance.coverageStatus = 'approved';
  }

  if (status === PRIOR_AUTH_STATUS.DENIED) {
    prescription.priorAuthorization.denial = {
      deniedAt: new Date(),
      deniedBy: req.user._id || req.user.id,
      reason: denialReason,
      appealDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days to appeal
    };

    prescription.insurance.coverageStatus = 'denied';
  }

  if (insuranceResponse) {
    prescription.priorAuthorization.insuranceResponse = insuranceResponse;
  }

  // Add to status history
  if (!prescription.priorAuthorization.statusHistory) {
    prescription.priorAuthorization.statusHistory = [];
  }
  prescription.priorAuthorization.statusHistory.push({
    status: status || prescription.priorAuthorization.status,
    previousStatus,
    changedAt: new Date(),
    changedBy: req.user._id || req.user.id,
    notes: notes || `Status updated to ${status}`
  });

  prescription.priorAuthorization.lastUpdated = new Date();
  prescription.priorAuthorization.lastUpdatedBy = req.user._id || req.user.id;

  await prescription.save();

  res.json({
    success: true,
    message: `Prior authorization ${status === PRIOR_AUTH_STATUS.APPROVED ? 'approved' : status === PRIOR_AUTH_STATUS.DENIED ? 'denied' : 'updated'}`,
    data: {
      referenceNumber: prescription.priorAuthorization.referenceNumber,
      status: prescription.priorAuthorization.status,
      authorizationNumber: prescription.priorAuthorization.approval?.authorizationNumber,
      approval: prescription.priorAuthorization.approval,
      denial: prescription.priorAuthorization.denial
    }
  });
});

// @desc    Get prior authorization status
// @route   GET /api/prescriptions/:id/prior-auth/status
// @access  Private
exports.getPriorAuthorizationStatus = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('priorAuthorization.requestedBy', 'firstName lastName')
    .populate('priorAuthorization.approval.approvedBy', 'firstName lastName')
    .populate('priorAuthorization.statusHistory.changedBy', 'firstName lastName');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.priorAuthorization) {
    return res.json({
      success: true,
      data: {
        required: false,
        status: 'not_required',
        message: 'Prior authorization not required for this prescription'
      }
    });
  }

  res.json({
    success: true,
    data: {
      required: prescription.priorAuthorization.required,
      referenceNumber: prescription.priorAuthorization.referenceNumber,
      status: prescription.priorAuthorization.status,
      requestedAt: prescription.priorAuthorization.requestedAt,
      requestedBy: prescription.priorAuthorization.requestedBy,
      insurance: prescription.priorAuthorization.insurance,
      clinicalInfo: prescription.priorAuthorization.clinicalInfo,
      approval: prescription.priorAuthorization.approval,
      denial: prescription.priorAuthorization.denial,
      statusHistory: prescription.priorAuthorization.statusHistory,
      lastUpdated: prescription.priorAuthorization.lastUpdated
    }
  });
});

// @desc    Get all pending prior authorizations
// @route   GET /api/prescriptions/prior-auth/pending
// @access  Private (Admin, Pharmacist, Doctor)
exports.getPendingPriorAuthorizations = asyncHandler(async (req, res) => {
  const { status, urgency, page = 1, limit = 20 } = req.query;

  const query = {
    'priorAuthorization.status': status || {
      $in: [PRIOR_AUTH_STATUS.SUBMITTED, PRIOR_AUTH_STATUS.IN_REVIEW, PRIOR_AUTH_STATUS.APPEAL_PENDING]
    }
  };

  if (urgency) {
    query['priorAuthorization.clinicalInfo.urgency'] = urgency;
  }

  const prescriptions = await Prescription.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('prescriber', 'firstName lastName')
    .populate('priorAuthorization.requestedBy', 'firstName lastName')
    .select('prescriptionId type medications priorAuthorization dateIssued')
    .sort({ 'priorAuthorization.requestedAt': -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Prescription.countDocuments(query);

  // Format response
  const pendingAuths = prescriptions.map(p => ({
    prescriptionId: p.prescriptionId,
    _id: p._id,
    type: p.type,
    medication: p.medications?.[0]?.name || 'N/A',
    patient: p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : 'Unknown',
    patientId: p.patient?.patientId,
    prescriber: p.prescriber ? `Dr. ${p.prescriber.firstName} ${p.prescriber.lastName}` : 'Unknown',
    priorAuth: {
      referenceNumber: p.priorAuthorization?.referenceNumber,
      status: p.priorAuthorization?.status,
      urgency: p.priorAuthorization?.clinicalInfo?.urgency,
      insurance: p.priorAuthorization?.insurance?.provider,
      requestedAt: p.priorAuthorization?.requestedAt,
      requestedBy: p.priorAuthorization?.requestedBy
    },
    dateIssued: p.dateIssued
  }));

  res.json({
    success: true,
    count: prescriptions.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: pendingAuths
  });
});

// Export PRIOR_AUTH_STATUS for use in other modules
exports.PRIOR_AUTH_STATUS = PRIOR_AUTH_STATUS;
