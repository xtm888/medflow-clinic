const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all prescriptions
// @route   GET /api/prescriptions
// @access  Private
exports.getPrescriptions = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    status,
    type,
    patient,
    prescriber,
    dateFrom,
    dateTo,
    sort = '-dateIssued'
  } = req.query;

  const query = {};

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Filter by patient
  if (patient) {
    query.patient = patient;
  }

  // Filter by prescriber
  if (prescriber) {
    query.prescriber = prescriber;
  } else if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    // Doctors can only see their own prescriptions
    query.prescriber = req.user.id;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) {
      query.dateIssued.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      query.dateIssued.$lte = new Date(dateTo);
    }
  }

  const prescriptions = await Prescription.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('prescriber', 'firstName lastName licenseNumber')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort);

  const count = await Prescription.countDocuments(query);

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    total: count,
    pages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: prescriptions
  });
});

// @desc    Get single prescription
// @route   GET /api/prescriptions/:id
// @access  Private
exports.getPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient')
    .populate('prescriber', 'firstName lastName licenseNumber department')
    .populate('appointment', 'date type');

  if (!prescription) {
    return res.status(404).json({
      success: false,
      error: 'Prescription not found'
    });
  }

  // Add view to history
  prescription.viewHistory.push({
    viewedBy: req.user.id,
    viewedAt: Date.now(),
    action: 'VIEW'
  });
  await prescription.save();

  res.status(200).json({
    success: true,
    data: prescription
  });
});

// @desc    Create prescription
// @route   POST /api/prescriptions
// @access  Private (Doctor, Ophthalmologist)
exports.createPrescription = asyncHandler(async (req, res, next) => {
  req.body.prescriber = req.user.id;
  req.body.createdBy = req.user.id;

  // Validate patient exists
  const patient = await Patient.findById(req.body.patient);
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Check for drug interactions if medication prescription
  if (req.body.type === 'medication') {
    const interactions = await checkDrugInteractions(req.body.medications, patient);
    if (interactions.length > 0) {
      req.body.warnings = [...(req.body.warnings || []), ...interactions];
    }
  }

  const prescription = await Prescription.create(req.body);

  // Add prescription to patient record
  patient.prescriptions.push(prescription._id);

  // Update patient medications if medication prescription
  if (prescription.type === 'medication') {
    prescription.medications.forEach(med => {
      patient.medications.push({
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        startDate: prescription.dateIssued,
        prescribedBy: req.user.id,
        reason: med.indication,
        status: 'active'
      });
    });
  }

  // Update patient ophthalmology data if optical prescription
  if (prescription.type === 'optical') {
    patient.ophthalmology.currentPrescription = {
      OD: prescription.optical.OD,
      OS: prescription.optical.OS,
      pd: prescription.optical.pd,
      prescribedDate: prescription.dateIssued,
      prescribedBy: req.user.id
    };
  }

  await patient.save();

  // Populate for response
  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName');

  res.status(201).json({
    success: true,
    data: prescription
  });
});

// @desc    Update prescription
// @route   PUT /api/prescriptions/:id
// @access  Private (Doctor, Ophthalmologist)
exports.updatePrescription = asyncHandler(async (req, res, next) => {
  req.body.updatedBy = req.user.id;

  // Prevent updating certain fields
  delete req.body.prescriptionId;
  delete req.body.prescriber;
  delete req.body.createdAt;

  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return res.status(404).json({
      success: false,
      error: 'Prescription not found'
    });
  }

  // Check if user is the prescriber
  if (prescription.prescriber.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You can only update your own prescriptions'
    });
  }

  // Check if prescription is already dispensed
  if (prescription.status === 'filled' || prescription.status === 'partially-filled') {
    return res.status(400).json({
      success: false,
      error: 'Cannot update a prescription that has been dispensed'
    });
  }

  Object.assign(prescription, req.body);
  await prescription.save();

  res.status(200).json({
    success: true,
    data: prescription
  });
});

// @desc    Cancel prescription
// @route   PUT /api/prescriptions/:id/cancel
// @access  Private
exports.cancelPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return res.status(404).json({
      success: false,
      error: 'Prescription not found'
    });
  }

  // Check permissions
  if (prescription.prescriber.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You can only cancel your own prescriptions'
    });
  }

  prescription.status = 'cancelled';
  prescription.cancellation = {
    cancelled: true,
    cancelledAt: Date.now(),
    cancelledBy: req.user.id,
    reason: req.body.reason
  };

  await prescription.save();

  res.status(200).json({
    success: true,
    message: 'Prescription cancelled successfully',
    data: prescription
  });
});

// @desc    Dispense prescription
// @route   PUT /api/prescriptions/:id/dispense
// @access  Private (Pharmacist, Admin)
exports.dispensePrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return res.status(404).json({
      success: false,
      error: 'Prescription not found'
    });
  }

  // Check if prescription is expired
  if (prescription.isExpired) {
    return res.status(400).json({
      success: false,
      error: 'Cannot dispense an expired prescription'
    });
  }

  // Check if already cancelled
  if (prescription.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      error: 'Cannot dispense a cancelled prescription'
    });
  }

  // Add dispensing record
  const dispensingRecord = {
    dispensedBy: req.user.id,
    dispensedAt: Date.now(),
    pharmacy: req.body.pharmacy,
    quantity: req.body.quantity,
    daysSupply: req.body.daysSupply,
    lotNumber: req.body.lotNumber,
    expirationDate: req.body.expirationDate,
    copayAmount: req.body.copayAmount,
    totalCost: req.body.totalCost,
    notes: req.body.notes
  };

  prescription.dispensing.push(dispensingRecord);

  // Update status based on refills
  if (prescription.type === 'medication') {
    const totalDispensed = prescription.dispensing.length;
    const totalAllowed = prescription.medications[0]?.refills?.allowed || 0;

    if (totalDispensed >= totalAllowed + 1) {
      prescription.status = 'filled';
    } else {
      prescription.status = 'partially-filled';
      // Update remaining refills
      prescription.medications.forEach(med => {
        if (med.refills) {
          med.refills.remaining = totalAllowed - totalDispensed;
        }
      });
    }
  } else {
    prescription.status = 'filled';
  }

  await prescription.save();

  res.status(200).json({
    success: true,
    message: 'Prescription dispensed successfully',
    data: prescription
  });
});

// @desc    Verify prescription
// @route   POST /api/prescriptions/:id/verify
// @access  Private
exports.verifyPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return res.status(404).json({
      success: false,
      error: 'Prescription not found'
    });
  }

  // Perform verification checks
  const verificationResult = {
    valid: true,
    checks: {
      notExpired: !prescription.isExpired,
      prescriberLicenseValid: !!prescription.prescriber.licenseNumber,
      notCancelled: prescription.status !== 'cancelled',
      refillsAvailable: true
    }
  };

  if (prescription.type === 'medication' && prescription.medications[0]?.refills) {
    verificationResult.checks.refillsAvailable = prescription.medications[0].refills.remaining > 0;
  }

  verificationResult.valid = Object.values(verificationResult.checks).every(check => check === true);

  // Save verification record
  prescription.verification = {
    required: true,
    verifiedBy: req.user.id,
    verifiedAt: Date.now(),
    method: req.body.method || 'manual',
    notes: req.body.notes
  };

  await prescription.save();

  res.status(200).json({
    success: true,
    data: verificationResult
  });
});

// @desc    Print prescription
// @route   GET /api/prescriptions/:id/print
// @access  Private
exports.printPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth patientId address phoneNumber')
    .populate('prescriber', 'firstName lastName licenseNumber department signature')
    .populate('appointment', 'date');

  if (!prescription) {
    return res.status(404).json({
      success: false,
      error: 'Prescription not found'
    });
  }

  // Format prescription for printing
  const printData = prescription.formatForPrint();

  // Add view to history
  prescription.viewHistory.push({
    viewedBy: req.user.id,
    viewedAt: Date.now(),
    action: 'PRINT'
  });
  await prescription.save();

  res.status(200).json({
    success: true,
    data: printData
  });
});

// @desc    Renew prescription
// @route   POST /api/prescriptions/:id/renew
// @access  Private (Doctor, Ophthalmologist)
exports.renewPrescription = asyncHandler(async (req, res, next) => {
  const originalPrescription = await Prescription.findById(req.params.id);

  if (!originalPrescription) {
    return res.status(404).json({
      success: false,
      error: 'Original prescription not found'
    });
  }

  // Create new prescription based on original
  const renewalData = originalPrescription.toObject();
  delete renewalData._id;
  delete renewalData.prescriptionId;
  delete renewalData.createdAt;
  delete renewalData.updatedAt;
  delete renewalData.dispensing;
  delete renewalData.viewHistory;

  // Update renewal specific fields
  renewalData.prescriber = req.user.id;
  renewalData.createdBy = req.user.id;
  renewalData.dateIssued = Date.now();
  renewalData.status = 'active';
  renewalData.renewal = {
    isRenewal: true,
    originalPrescription: originalPrescription._id,
    renewalApproved: true,
    renewalApprovedBy: req.user.id,
    renewalApprovedAt: Date.now()
  };

  // Reset validity period
  const validityDays = renewalData.type === 'optical' ? 365 : 90;
  renewalData.validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

  const newPrescription = await Prescription.create(renewalData);

  // Update original prescription
  originalPrescription.renewal.renewalRequested = true;
  originalPrescription.renewal.renewalRequestedAt = Date.now();
  await originalPrescription.save();

  // Populate for response
  await newPrescription.populate('patient', 'firstName lastName patientId');
  await newPrescription.populate('prescriber', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Prescription renewed successfully',
    data: newPrescription
  });
});

// Helper function to check drug interactions
async function checkDrugInteractions(newMedications, patient) {
  const interactions = [];

  // Get patient's current medications
  const currentMeds = patient.medications.filter(med => med.status === 'active');

  // This is a simplified example - in production, you would use a drug interaction API
  newMedications.forEach(newMed => {
    currentMeds.forEach(currentMed => {
      // Check for duplicate medications
      if (newMed.name.toLowerCase() === currentMed.name.toLowerCase()) {
        interactions.push(`Duplicate medication: ${newMed.name}`);
      }

      // Check for known interactions (simplified)
      const knownInteractions = {
        'warfarin': ['aspirin', 'ibuprofen'],
        'metformin': ['contrast dye'],
        'sildenafil': ['nitrates']
      };

      const newMedLower = newMed.name.toLowerCase();
      const currentMedLower = currentMed.name.toLowerCase();

      if (knownInteractions[newMedLower]?.includes(currentMedLower)) {
        interactions.push(`Potential interaction between ${newMed.name} and ${currentMed.name}`);
      }
    });
  });

  return interactions;
}