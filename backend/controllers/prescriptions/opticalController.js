/**
 * Optical Prescription Controller
 *
 * Handles optical/glasses prescription operations:
 * - Optical prescription CRUD
 * - Lens power calculations
 * - Frame recommendations
 * - Lens options and coatings
 */

const Prescription = require('../../models/Prescription');
const { asyncHandler } = require('../../middleware/errorHandler');
const { success, error, notFound } = require('../../utils/apiResponse');
const { findPatientByIdOrCode } = require('../../utils/patientLookup');
const { PRESCRIPTION } = require('../../config/constants');

// @desc    Get optical prescriptions
// @route   GET /api/prescriptions/optical
// @access  Private
exports.getOpticalPrescriptions = asyncHandler(async (req, res) => {
  const { patient, status, page = 1, limit = 20 } = req.query;

  const query = { type: 'optical' };

  if (patient) query.patient = patient;
  if (status) query.status = status;

  const prescriptions = await Prescription.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('prescriber', 'firstName lastName specialization')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Prescription.countDocuments(query);

  res.json({
    success: true,
    count: prescriptions.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: prescriptions
  });
});

// @desc    Create optical prescription
// @route   POST /api/prescriptions/optical
// @access  Private (Doctor, Ophthalmologist, Optometrist, Admin)
exports.createOpticalPrescription = asyncHandler(async (req, res) => {
  const {
    patient,
    rightEye,
    leftEye,
    pupillaryDistance,
    addPower,
    recommendations,
    lensType,
    coatings,
    frameRecommendations,
    notes,
    validUntil
  } = req.body;

  // Validate patient exists
  const patientExists = await findPatientByIdOrCode(patient);
  if (!patientExists) {
    return notFound(res, 'Patient');
  }

  // Generate prescription ID
  const count = await Prescription.countDocuments();
  const prescriptionId = `OPT-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;

  const prescription = await Prescription.create({
    prescriptionId,
    type: 'optical',
    patient,
    prescriber: req.user._id || req.user.id,
    optical: {
      rightEye: rightEye || {},
      leftEye: leftEye || {},
      pupillaryDistance,
      addPower,
      recommendations,
      lensType,
      coatings: coatings || [],
      frameRecommendations
    },
    notes,
    dateIssued: new Date(),
    validUntil: validUntil || new Date(Date.now() + PRESCRIPTION.OPTICAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000), // 1 year for optical
    status: 'active',
    signature: {
      prescriber: {
        signed: false
      }
    }
  });

  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName specialization');

  res.status(201).json({
    success: true,
    data: prescription
  });
});

// @desc    Update optical prescription
// @route   PUT /api/prescriptions/optical/:id
// @access  Private (Doctor, Ophthalmologist, Optometrist, Admin)
exports.updateOpticalPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (prescription.type !== 'optical') {
    return error(res, 'This is not an optical prescription');
  }

  const {
    rightEye,
    leftEye,
    pupillaryDistance,
    addPower,
    recommendations,
    lensType,
    coatings,
    frameRecommendations,
    notes,
    status
  } = req.body;

  // Initialize opticalData if not present
  if (!prescription.opticalData) {
    prescription.opticalData = {};
  }

  if (rightEye) prescription.opticalData.rightEye = { ...prescription.opticalData.rightEye, ...rightEye };
  if (leftEye) prescription.opticalData.leftEye = { ...prescription.opticalData.leftEye, ...leftEye };
  if (pupillaryDistance) prescription.opticalData.pupillaryDistance = pupillaryDistance;
  if (addPower) prescription.opticalData.addPower = addPower;
  if (recommendations) prescription.opticalData.recommendations = recommendations;
  if (lensType) prescription.opticalData.lensType = lensType;
  if (coatings) prescription.opticalData.coatings = coatings;
  if (frameRecommendations) prescription.opticalData.frameRecommendations = frameRecommendations;
  if (notes) prescription.notes = notes;
  if (status) prescription.status = status;

  prescription.updatedAt = new Date();
  await prescription.save();

  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName specialization');

  res.json({
    success: true,
    data: prescription
  });
});

// @desc    Get lens options for optical prescription
// @route   GET /api/prescriptions/optical/:id/lens-options
// @access  Private
exports.getLensOptions = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Generate lens options based on prescription data
  const lensOptions = {
    materials: [
      { name: 'CR-39 Plastic', index: 1.5, description: 'Standard plastic lens' },
      { name: 'Polycarbonate', index: 1.59, description: 'Impact-resistant, lightweight' },
      { name: 'High-Index 1.67', index: 1.67, description: 'Thinner lens for higher prescriptions' },
      { name: 'High-Index 1.74', index: 1.74, description: 'Thinnest available' },
      { name: 'Trivex', index: 1.53, description: 'Lightweight, impact-resistant' }
    ],
    coatings: [
      { name: 'Anti-Reflective', description: 'Reduces glare and reflections' },
      { name: 'Scratch-Resistant', description: 'Protects lens surface' },
      { name: 'UV Protection', description: 'Blocks harmful UV rays' },
      { name: 'Blue Light Filter', description: 'Reduces digital eye strain' },
      { name: 'Photochromic', description: 'Darkens in sunlight' },
      { name: 'Hydrophobic', description: 'Water and smudge resistant' }
    ],
    designs: [
      { name: 'Single Vision', description: 'One prescription power throughout' },
      { name: 'Bifocal', description: 'Two prescription powers' },
      { name: 'Progressive', description: 'Gradual power change, no line' },
      { name: 'Office Progressive', description: 'Optimized for near and intermediate' }
    ]
  };

  res.json({
    success: true,
    data: lensOptions
  });
});

// @desc    Calculate lens power
// @route   POST /api/prescriptions/optical/calculate-power
// @access  Private (Doctor, Ophthalmologist, Optometrist)
exports.calculateLensPower = asyncHandler(async (req, res) => {
  const { sphere, cylinder, axis, addPower, vertexDistance = 12 } = req.body;

  // Vertex distance compensation for high prescriptions
  let compensatedSphere = sphere;
  let compensatedCylinder = cylinder;

  if (Math.abs(sphere) >= 4) {
    // Compensate for vertex distance
    const effectivePower = sphere / (1 - (vertexDistance / 1000) * sphere);
    compensatedSphere = Math.round(effectivePower * 4) / 4; // Round to nearest 0.25
  }

  if (cylinder && Math.abs(cylinder) >= 2) {
    const effectiveCyl = cylinder / (1 - (vertexDistance / 1000) * cylinder);
    compensatedCylinder = Math.round(effectiveCyl * 4) / 4;
  }

  // Calculate transposition (plus to minus cylinder)
  const transposed = {
    sphere: sphere + (cylinder || 0),
    cylinder: cylinder ? -cylinder : 0,
    axis: cylinder ? (axis + 90) % 180 : axis
  };

  // Calculate reading addition
  const readingPower = addPower ? {
    sphere: compensatedSphere + addPower,
    cylinder: compensatedCylinder,
    axis
  } : null;

  res.json({
    success: true,
    data: {
      original: { sphere, cylinder, axis },
      compensated: { sphere: compensatedSphere, cylinder: compensatedCylinder, axis },
      transposed,
      reading: readingPower,
      vertexDistance
    }
  });
});

// @desc    Get frame recommendations
// @route   GET /api/prescriptions/optical/:id/frame-recommendations
// @access  Private
exports.getFrameRecommendations = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const opticalData = prescription.opticalData || {};
  const recommendations = [];

  // High prescription recommendations
  const maxSphere = Math.max(
    Math.abs(opticalData.rightEye?.sphere || 0),
    Math.abs(opticalData.leftEye?.sphere || 0)
  );

  if (maxSphere > 4) {
    recommendations.push({
      type: 'frame_size',
      recommendation: 'Smaller frames recommended for thinner edge thickness',
      priority: 'high'
    });
  }

  if (maxSphere > 6) {
    recommendations.push({
      type: 'lens_material',
      recommendation: 'High-index lenses (1.67 or 1.74) strongly recommended',
      priority: 'high'
    });
  }

  // Cylinder recommendations
  const maxCylinder = Math.max(
    Math.abs(opticalData.rightEye?.cylinder || 0),
    Math.abs(opticalData.leftEye?.cylinder || 0)
  );

  if (maxCylinder > 2) {
    recommendations.push({
      type: 'frame_fit',
      recommendation: 'Frame with good wrap angle for astigmatism correction',
      priority: 'medium'
    });
  }

  // Add power recommendations (presbyopia)
  if (opticalData.addPower > 0) {
    recommendations.push({
      type: 'frame_height',
      recommendation: 'Taller frame (30mm+ B measurement) for progressive lenses',
      priority: 'high'
    });
  }

  // PD recommendations
  if (opticalData.pupillaryDistance) {
    if (opticalData.pupillaryDistance < 60) {
      recommendations.push({
        type: 'frame_width',
        recommendation: 'Narrower frames recommended for optimal optical center',
        priority: 'medium'
      });
    } else if (opticalData.pupillaryDistance > 68) {
      recommendations.push({
        type: 'frame_width',
        recommendation: 'Wider frames recommended for optimal optical center',
        priority: 'medium'
      });
    }
  }

  // General recommendations
  recommendations.push({
    type: 'general',
    recommendation: 'Frame should sit comfortably on nose bridge and ears',
    priority: 'low'
  });

  res.json({
    success: true,
    data: {
      prescriptionId: prescription.prescriptionId,
      patient: prescription.patient,
      recommendations
    }
  });
});
