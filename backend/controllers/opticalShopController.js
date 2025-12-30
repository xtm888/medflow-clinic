const GlassesOrder = require('../models/GlassesOrder');
const Patient = require('../models/Patient');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Prescription = require('../models/Prescription');
const ConsultationSession = require('../models/ConsultationSession');
const { Inventory, FrameInventory, OpticalLensInventory, ContactLensInventory } = require('../models/Inventory');
const User = require('../models/User');
const Company = require('../models/Company');
const ConventionFeeSchedule = require('../models/ConventionFeeSchedule');
const FeeSchedule = require('../models/FeeSchedule');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const Clinic = require('../models/Clinic');
const mongoose = require('mongoose');
const { buildClinicFilter, verifyClinicAccess } = require('../utils/clinicFilter');
const { createSafeSearchRegex, isValidObjectId, sanitizeNumber, sanitizePrice } = require('../utils/sanitize');
const { asyncHandler } = require('../middleware/errorHandler');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { createContextLogger } = require('../utils/structuredLogger');
const opticalLogger = createContextLogger('OpticalShop');
const { INVENTORY, PAGINATION } = require('../config/constants');

// Helper: Apply clinic price modifier
const applyClinicPricing = async (frame, clinicId) => {
  if (!clinicId || !frame) return frame;

  const clinic = await Clinic.findById(clinicId).select('pricingModifiers').lean();
  const modifier = clinic?.pricingModifiers?.optical || 0;

  if (modifier === 0) return frame;

  const basePrice = frame.pricing?.sellingPrice || 0;
  const clinicPrice = Math.round(basePrice * (1 + modifier / 100));

  return {
    ...frame,
    pricing: {
      ...frame.pricing,
      clinicPrice,
      basePrice,
      modifier
    }
  };
};

// ============================================================
// OPTICIAN DASHBOARD & PATIENT LOOKUP
// ============================================================

/**
 * Get optical shop dashboard stats
 * Used by opticians and technicians
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userId = req.user._id;

    // Stats for current user (optician)
    const myStats = await GlassesOrder.aggregate([
      {
        $match: {
          'opticalShop.optician': new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: 1 },
          todayRevenue: { $sum: '$pricing.finalTotal' },
          avgDuration: { $avg: '$opticalShop.consultationDuration' }
        }
      }
    ]);

    // Pending verification count (for technicians)
    const pendingVerification = await GlassesOrder.countDocuments({
      status: 'pending_verification'
    });

    // Orders needing external ordering
    const pendingExternalOrders = await GlassesOrder.countDocuments({
      'lensAvailability.externalOrder.required': true,
      'lensAvailability.externalOrder.status': { $in: ['pending', 'ordered'] }
    });

    // Recent orders for optician
    const recentOrders = await GlassesOrder.find({
      'opticalShop.optician': userId
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('patient', 'firstName lastName fileNumber')
      .select('orderNumber status patient pricing.finalTotal createdAt');

    // Verification queue preview (for technicians)
    const verificationQueue = await GlassesOrder.find({
      status: 'pending_verification'
    })
      .sort({ 'opticalShop.verification.submittedAt': 1 })
      .limit(5)
      .populate('patient', 'firstName lastName fileNumber')
      .populate('opticalShop.optician', 'firstName lastName')
      .select('orderNumber patient opticalShop.optician opticalShop.verification.submittedAt');

    return success(res, {
      data: {
        myStats: myStats[0] || { todaySales: 0, todayRevenue: 0, avgDuration: 0 },
        pendingVerification,
        pendingExternalOrders,
        recentOrders,
        verificationQueue
      }
    });
  } catch (err) {
    opticalLogger.error('Error getting dashboard stats', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Search patients for optical shop
 */
exports.searchPatients = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return success(res, { data: [] });
    }

    const searchRegex = createSafeSearchRegex(query, { minLength: 2, maxLength: 100 });

    if (!searchRegex) {
      return error(res, 'Invalid search query');
    }

    const patients = await Patient.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { fileNumber: searchRegex },
        { phoneNumber: searchRegex },
        { patientId: searchRegex }
      ]
    })
      .limit(15)
      .select('firstName lastName fileNumber phoneNumber patientId dateOfBirth convention')
      .populate('convention.company', 'name conventionCode')
      .sort({ lastName: 1, firstName: 1 });

    // Add convention summary and normalize phone field for frontend
    const patientsWithConvention = patients.map(p => {
      const patient = p.toObject();
      // Normalize phone field for frontend compatibility
      patient.phone = patient.phoneNumber;
      if (patient.convention?.company) {
        patient.hasConvention = true;
        patient.conventionName = patient.convention.company.name;
        patient.conventionCode = patient.convention.company.conventionCode;
      }
      return patient;
    });

    return success(res, { data: patientsWithConvention });
  } catch (err) {
    opticalLogger.error('Error searching patients', { error: err.message, query: req.query.query });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get patient's convention info for optical services
 */
exports.getPatientConventionInfo = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate ObjectId
    if (!isValidObjectId(patientId)) {
      return error(res, 'Invalid patient ID format');
    }

    const patient = await findPatientByIdOrCode(patientId)
      .select('firstName lastName convention')
      .populate('convention.company', 'name companyId conventionCode coveredCategories defaultCoverage approvalRules contract parentConvention');

    if (!patient) {
      return notFound(res, 'Patient');
    }

    // Verify clinic access if patient has clinic field
    if (patient.clinic && !verifyClinicAccess(patient, req)) {
      return error(res, 'Access denied - patient belongs to different clinic', 403);
    }

    if (!patient.convention?.company) {
      return success(res, {
        data: {
          hasConvention: false,
          message: 'Patient sans convention - Paiement cash'
        }
      });
    }

    const company = patient.convention.company;

    // Check if company contract is active
    if (company.contract?.status && company.contract.status !== 'active') {
      return success(res, {
        data: {
          hasConvention: false,
          company: { name: company.name, conventionCode: company.conventionCode },
          reason: 'Contrat convention expiré ou suspendu'
        }
      });
    }

    // Check patient's convention status
    if (patient.convention.status && patient.convention.status !== 'active') {
      return success(res, {
        data: {
          hasConvention: false,
          company: { name: company.name, conventionCode: company.conventionCode },
          reason: 'Convention patient non active'
        }
      });
    }

    // Get optical category settings
    let opticalSettings = company.coveredCategories?.find(c => c.category === 'optical');

    // Check if optical is excluded
    if (opticalSettings?.notCovered) {
      return success(res, {
        data: {
          hasConvention: true,
          opticalCovered: false,
          company: {
            id: company._id,
            name: company.name,
            conventionCode: company.conventionCode
          },
          reason: 'Services optiques NON COUVERTS par cette convention',
          message: 'Le patient doit payer en cash pour les services optiques'
        }
      });
    }

    // If no specific optical settings, use defaults
    if (!opticalSettings) {
      opticalSettings = {
        category: 'optical',
        coveragePercentage: company.defaultCoverage?.percentage || 100,
        requiresApproval: false
      };
    }

    // Get effective settings (inherit from parent if needed)
    let effectiveSettings = { ...opticalSettings };
    if (company.parentConvention) {
      const parentCompany = await Company.findById(company.parentConvention)
        .select('name coveredCategories defaultCoverage approvalRules');

      if (parentCompany) {
        const parentOptical = parentCompany.coveredCategories?.find(c => c.category === 'optical');
        if (parentOptical && !opticalSettings.coveragePercentage) {
          effectiveSettings = { ...parentOptical, ...opticalSettings };
        }
      }
    }

    const coveragePercentage = patient.convention.coveragePercentage ||
      effectiveSettings.coveragePercentage ||
      company.defaultCoverage?.percentage || 100;

    return success(res, {
      data: {
        hasConvention: true,
        opticalCovered: true,
        company: {
          id: company._id,
          name: company.name,
          conventionCode: company.conventionCode
        },
        coveragePercentage,
        patientPays: 100 - coveragePercentage,
        requiresApproval: effectiveSettings.requiresApproval || false,
        autoApproveUnder: effectiveSettings.autoApproveUnder || company.approvalRules?.autoApproveUnderAmount,
        autoApproveUnderCurrency: company.approvalRules?.autoApproveUnderCurrency || 'USD',
        maxPerItem: effectiveSettings.maxPerItem,
        maxPerItemCurrency: effectiveSettings.maxPerItemCurrency,
        additionalDiscount: effectiveSettings.additionalDiscount,
        notes: effectiveSettings.notes || company.approvalRules?.notes,
        employeeId: patient.convention.employeeId,
        beneficiaryType: patient.convention.beneficiaryType,
        message: coveragePercentage === 100
          ? 'Convention 100% - Facturation entreprise'
          : `Convention ${coveragePercentage}% - Patient paie ${100 - coveragePercentage}%`
      }
    });
  } catch (err) {
    opticalLogger.error('Error getting convention info', { error: err.message, patientId: req.params.patientId });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get patient's latest prescription/refraction
 */
exports.getPatientPrescription = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate ObjectId
    if (!isValidObjectId(patientId)) {
      return error(res, 'Invalid patient ID format');
    }

    // Verify patient exists and user has access
    const patient = await findPatientByIdOrCode(patientId).select('clinic');
    if (!patient) {
      return notFound(res, 'Patient');
    }

    // Verify clinic access if patient has clinic field
    if (patient.clinic && !verifyClinicAccess(patient, req)) {
      return error(res, 'Access denied - patient belongs to different clinic', 403);
    }

    // Get latest ophthalmology exam with refraction
    const latestExam = await OphthalmologyExam.findOne({
      patient: patientId,
      $or: [
        { 'refraction.subjective.OD': { $exists: true } },
        { 'refraction.subjective.OS': { $exists: true } },
        { 'refraction.finalPrescription.OD': { $exists: true } },
        { 'refraction.finalPrescription.OS': { $exists: true } }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('examiner', 'firstName lastName')
      .select('examId examDate refraction examiner createdAt');

    // Also check ConsultationSession for refraction data (new consultation workflow stores data here)
    const latestSession = await ConsultationSession.findOne({
      patient: patientId,
      status: 'completed',
      $or: [
        { 'stepData.refraction.subjective.OD': { $exists: true } },
        { 'stepData.refraction.subjective.OS': { $exists: true } },
        { 'stepData.refraction.finalPrescription.OD': { $exists: true } },
        { 'stepData.refraction.finalPrescription.OS': { $exists: true } }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('doctor', 'firstName lastName')
      .select('sessionId stepData doctor createdAt completedAt');

    // Determine which source has the most recent refraction data
    let examData = null;
    let examSource = null;

    const examDate = latestExam?.createdAt ? new Date(latestExam.createdAt) : null;
    const sessionDate = latestSession?.completedAt || latestSession?.createdAt ?
      new Date(latestSession.completedAt || latestSession.createdAt) : null;

    // Use the most recent data source
    if (examDate && sessionDate) {
      if (examDate >= sessionDate && latestExam?.refraction) {
        examData = {
          examId: latestExam.examId,
          examDate: latestExam.examDate || latestExam.createdAt,
          refraction: latestExam.refraction,
          performedBy: latestExam.examiner
        };
        examSource = 'ophthalmologyExam';
      } else if (latestSession?.stepData?.refraction) {
        examData = {
          examId: latestSession.sessionId,
          examDate: latestSession.completedAt || latestSession.createdAt,
          refraction: latestSession.stepData.refraction,
          performedBy: latestSession.doctor
        };
        examSource = 'consultationSession';
      }
    } else if (latestExam?.refraction) {
      examData = {
        examId: latestExam.examId,
        examDate: latestExam.examDate || latestExam.createdAt,
        refraction: latestExam.refraction,
        performedBy: latestExam.examiner
      };
      examSource = 'ophthalmologyExam';
    } else if (latestSession?.stepData?.refraction) {
      examData = {
        examId: latestSession.sessionId,
        examDate: latestSession.completedAt || latestSession.createdAt,
        refraction: latestSession.stepData.refraction,
        performedBy: latestSession.doctor
      };
      examSource = 'consultationSession';
    }

    // Get latest glasses prescription
    const latestPrescription = await Prescription.findOne({
      patient: patientId,
      prescriptionType: 'glasses'
    })
      .sort({ createdAt: -1 })
      .populate('prescriber', 'firstName lastName')
      .select('createdAt glasses prescriber expiryDate');

    // Get patient's previous glasses orders
    const previousOrders = await GlassesOrder.find({
      patient: patientId,
      status: { $in: ['delivered', 'ready', 'confirmed'] }
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('orderNumber createdAt rightLens leftLens frame status');

    // Return empty data if no prescription - don't 404, patient may just not have one yet
    return success(res, {
      data: {
        exam: examData,
        examSource,
        prescription: latestPrescription || null,
        previousOrders: previousOrders || [],
        hasPrescription: !!(examData || latestPrescription)
      }
    });
  } catch (err) {
    opticalLogger.error('Error getting patient prescription', { error: err.message, patientId: req.params.patientId });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// SALES WORKFLOW
// ============================================================

/**
 * Start a new sale (create draft order)
 */
exports.startSale = async (req, res) => {
  try {
    const { patientId, prescriptionData } = req.body;

    // Validate patient exists
    const patient = await findPatientByIdOrCode(patientId);
    if (!patient) {
      return notFound(res, 'Patient');
    }

    // Generate order number
    const today = new Date();
    const datePrefix = `GL${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await GlassesOrder.countDocuments({
      orderNumber: { $regex: `^${datePrefix}` }
    });
    const orderNumber = `${datePrefix}${String(count + 1).padStart(4, '0')}`;

    // Create draft order
    const order = new GlassesOrder({
      orderNumber,
      patient: patientId,
      status: 'draft',
      prescriptionSource: {
        type: prescriptionData?.examId ? 'exam' : prescriptionData?.prescriptionId ? 'prescription' : 'manual',
        examId: prescriptionData?.examId,
        prescriptionId: prescriptionData?.prescriptionId,
        copiedAt: new Date()
      },
      opticalShop: {
        optician: req.user._id,
        opticianName: `${req.user.firstName} ${req.user.lastName}`,
        saleStartedAt: new Date()
      },
      rightLens: prescriptionData?.rightLens || {},
      leftLens: prescriptionData?.leftLens || {},
      lensAvailability: {
        status: 'checking',
        items: [],
        allAvailable: false
      }
    });

    await order.save();

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (err) {
    opticalLogger.error('Error starting sale', { error: err.message, patientId: req.body.patientId });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update sale order (frame, lenses, options)
 */
exports.updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const order = await GlassesOrder.findById(id);
    if (!order) {
      return notFound(res, 'Order');
    }

    if (!['draft', 'verification_rejected'].includes(order.status)) {
      return error(res, 'Cette commande ne peut plus être modifiée');
    }

    // Update allowed fields
    const allowedFields = [
      'frame', 'rightLens', 'leftLens', 'lensType', 'lensOptions',
      'measurements', 'pricing', 'notes', 'urgency'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        order[field] = updates[field];
      }
    });

    // Recalculate pricing if items changed
    if (updates.frame || updates.rightLens || updates.leftLens || updates.lensOptions) {
      await calculatePricing(order);
    }

    await order.save();

    return success(res, { data: order });
  } catch (err) {
    opticalLogger.error('Error updating sale', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Check lens availability and reserve if available
 */
exports.checkAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await GlassesOrder.findById(id);
    if (!order) {
      return notFound(res, 'Order');
    }

    const availabilityItems = [];
    let allAvailable = true;
    let needsExternalOrder = false;

    // Apply clinic pricing if applicable
    const clinicId = req.user?.clinic || req.clinicId;

    // Check frame availability
    if (order.frame?.inventoryItem) {
      let frame = await FrameInventory.findById(order.frame.inventoryItem);

      // Apply clinic pricing to frame
      if (clinicId && frame) {
        frame = await applyClinicPricing(frame, clinicId);
      }

      const available = frame && frame.inventory.currentStock > frame.inventory.reserved;
      availabilityItems.push({
        itemType: 'frame',
        description: `${frame?.brand} ${frame?.model}`,
        available,
        inventoryItem: order.frame.inventoryItem,
        needsExternalOrder: !available,
        pricing: frame?.pricing
      });
      if (!available) {
        allAvailable = false;
        needsExternalOrder = true;
      }
    }

    // Check right lens availability
    if (order.rightLens?.power || order.lensType) {
      const rightLensAvailable = await checkLensInventory(order, 'right');
      availabilityItems.push({
        itemType: 'rightLens',
        description: `Verre OD: ${order.rightLens?.sphere || 0} / ${order.rightLens?.cylinder || 0}`,
        available: rightLensAvailable.available,
        inventoryItem: rightLensAvailable.inventoryItem,
        needsExternalOrder: !rightLensAvailable.available
      });
      if (!rightLensAvailable.available) {
        allAvailable = false;
        needsExternalOrder = true;
      }
    }

    // Check left lens availability
    if (order.leftLens?.power || order.lensType) {
      const leftLensAvailable = await checkLensInventory(order, 'left');
      availabilityItems.push({
        itemType: 'leftLens',
        description: `Verre OS: ${order.leftLens?.sphere || 0} / ${order.leftLens?.cylinder || 0}`,
        available: leftLensAvailable.available,
        inventoryItem: leftLensAvailable.inventoryItem,
        needsExternalOrder: !leftLensAvailable.available
      });
      if (!leftLensAvailable.available) {
        allAvailable = false;
        needsExternalOrder = true;
      }
    }

    // Update order with availability info
    order.lensAvailability = {
      status: allAvailable ? 'available' : needsExternalOrder ? 'needs_order' : 'partial',
      items: availabilityItems,
      allAvailable,
      externalOrder: needsExternalOrder ? {
        required: true,
        status: 'pending',
        items: availabilityItems.filter(i => i.needsExternalOrder).map(i => ({
          itemType: i.itemType,
          description: i.description,
          specifications: {},
          quantity: 1,
          status: 'pending'
        }))
      } : order.lensAvailability.externalOrder
    };

    await order.save();

    return success(res, {
      data: {
        allAvailable,
        needsExternalOrder,
        items: availabilityItems
      }
    });
  } catch (err) {
    opticalLogger.error('Error checking availability', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Submit order for technician verification
 */
exports.submitForVerification = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await GlassesOrder.findById(id);
    if (!order) {
      return notFound(res, 'Order');
    }

    if (!['draft', 'verification_rejected'].includes(order.status)) {
      return error(res, 'Cette commande ne peut pas être soumise pour vérification');
    }

    // Validate required fields
    const validationErrors = validateOrderForSubmission(order);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Données manquantes',
        errors: validationErrors
      });
    }

    // Update status
    order.status = 'pending_verification';
    order.opticalShop.saleCompletedAt = new Date();
    order.opticalShop.consultationDuration = Math.round(
      (new Date() - order.opticalShop.saleStartedAt) / 60000
    );
    order.opticalShop.verification = {
      status: 'pending',
      submittedAt: new Date(),
      checklist: {
        prescriptionCorrect: { checked: false },
        measurementsCorrect: { checked: false },
        frameCompatible: { checked: false },
        lensTypeAppropriate: { checked: false },
        coatingsValid: { checked: false },
        pricingCorrect: { checked: false }
      },
      revisionHistory: [{
        action: 'submitted',
        by: req.user._id,
        byName: `${req.user.firstName} ${req.user.lastName}`,
        at: new Date()
      }]
    };

    await order.save();

    return success(res, { data: order });
  } catch (err) {
    opticalLogger.error('Error submitting for verification', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// TECHNICIAN VERIFICATION
// ============================================================

/**
 * Get verification queue for technicians
 */
exports.getVerificationQueue = async (req, res) => {
  try {
    const { page = 1, limit = 20, urgency } = req.query;

    const query = { status: 'pending_verification' };
    if (urgency) query.urgency = urgency;

    const orders = await GlassesOrder.find(query)
      .sort({ urgency: -1, 'opticalShop.verification.submittedAt': 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('patient', 'firstName lastName fileNumber dateOfBirth')
      .populate('opticalShop.optician', 'firstName lastName')
      .select('orderNumber patient opticalShop rightLens leftLens frame lensType measurements urgency');

    const total = await GlassesOrder.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    opticalLogger.error('Error getting verification queue', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get order details for verification
 */
exports.getOrderForVerification = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await GlassesOrder.findById(id)
      .populate('patient', 'firstName lastName fileNumber dateOfBirth phone')
      .populate('opticalShop.optician', 'firstName lastName')
      .populate('frame.inventoryItem');

    if (!order) {
      return notFound(res, 'Order');
    }

    // Get original prescription for comparison
    let originalPrescription = null;
    if (order.prescriptionSource?.examId) {
      originalPrescription = await OphthalmologyExam.findById(order.prescriptionSource.examId)
        .select('refraction examDate');
    } else if (order.prescriptionSource?.prescriptionId) {
      originalPrescription = await Prescription.findById(order.prescriptionSource.prescriptionId)
        .select('glasses createdAt');
    }

    return success(res, {
      data: {
        order,
        originalPrescription
      }
    });
  } catch (err) {
    opticalLogger.error('Error getting order for verification', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Approve order verification
 */
exports.approveVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { checklist, notes } = req.body;

    const order = await GlassesOrder.findById(id);
    if (!order) {
      return notFound(res, 'Order');
    }

    if (order.status !== 'pending_verification') {
      return error(res, 'Cette commande n\'est pas en attente de vérification');
    }

    // Ensure opticalShop and nested objects are initialized
    if (!order.opticalShop) {
      order.opticalShop = {};
    }
    if (!order.opticalShop.verification) {
      order.opticalShop.verification = { status: 'pending' };
    }
    if (!Array.isArray(order.opticalShop.verification.revisionHistory)) {
      order.opticalShop.verification.revisionHistory = [];
    }

    // Update verification status
    order.status = 'verified';
    order.opticalShop.technician = req.user._id;
    order.opticalShop.technicianName = `${req.user.firstName} ${req.user.lastName}`;
    order.opticalShop.verification.status = 'approved';
    order.opticalShop.verification.reviewedAt = new Date();
    order.opticalShop.verification.reviewedBy = req.user._id;
    order.opticalShop.verification.checklist = checklist;
    order.opticalShop.verification.revisionHistory.push({
      action: 'approved',
      by: req.user._id,
      byName: `${req.user.firstName} ${req.user.lastName}`,
      at: new Date(),
      notes
    });

    // Reserve inventory if available
    if (order.lensAvailability && order.lensAvailability.allAvailable) {
      await reserveInventory(order);
      order.status = 'confirmed';
    }

    await order.save();

    return success(res, { data: order });
  } catch (err) {
    opticalLogger.error('Error approving verification', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Reject order verification
 */
exports.rejectVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, checklist } = req.body;

    if (!reason) {
      return error(res, 'La raison du rejet est requise');
    }

    const order = await GlassesOrder.findById(id);
    if (!order) {
      return notFound(res, 'Order');
    }

    if (order.status !== 'pending_verification') {
      return error(res, 'Cette commande n\'est pas en attente de vérification');
    }

    // Ensure opticalShop and nested objects are initialized
    if (!order.opticalShop) {
      order.opticalShop = {};
    }
    if (!order.opticalShop.verification) {
      order.opticalShop.verification = { status: 'pending' };
    }
    if (!Array.isArray(order.opticalShop.verification.revisionHistory)) {
      order.opticalShop.verification.revisionHistory = [];
    }

    // Update verification status
    order.status = 'verification_rejected';
    order.opticalShop.technician = req.user._id;
    order.opticalShop.technicianName = `${req.user.firstName} ${req.user.lastName}`;
    order.opticalShop.verification.status = 'rejected';
    order.opticalShop.verification.reviewedAt = new Date();
    order.opticalShop.verification.reviewedBy = req.user._id;
    order.opticalShop.verification.rejectionReason = reason;
    order.opticalShop.verification.checklist = checklist;
    order.opticalShop.verification.revisionHistory.push({
      action: 'rejected',
      by: req.user._id,
      byName: `${req.user.firstName} ${req.user.lastName}`,
      at: new Date(),
      notes: reason
    });

    await order.save();

    return success(res, { data: order });
  } catch (err) {
    opticalLogger.error('Error rejecting verification', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// EXTERNAL ORDERS
// ============================================================

/**
 * Get orders needing external ordering
 */
exports.getExternalOrderQueue = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const orders = await GlassesOrder.find({
      'lensAvailability.externalOrder.required': true,
      'lensAvailability.externalOrder.status': status
    })
      .sort({ createdAt: 1 })
      .populate('patient', 'firstName lastName fileNumber')
      .select('orderNumber patient lensAvailability.externalOrder createdAt urgency');

    return success(res, { data: orders });
  } catch (err) {
    opticalLogger.error('Error getting external order queue', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update external order status
 */
exports.updateExternalOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, supplier, orderNumber, notes, items } = req.body;

    const order = await GlassesOrder.findById(id);
    if (!order) {
      return notFound(res, 'Order');
    }

    if (!order.lensAvailability?.externalOrder?.required) {
      return error(res, 'Cette commande ne nécessite pas de commande externe');
    }

    // Update external order info
    if (supplier) order.lensAvailability.externalOrder.supplier = supplier;
    if (orderNumber) order.lensAvailability.externalOrder.orderNumber = orderNumber;
    if (status) {
      order.lensAvailability.externalOrder.status = status;
      order.lensAvailability.externalOrder.statusHistory.push({
        status,
        at: new Date(),
        by: req.user._id,
        notes
      });

      // Update main availability status
      if (status === 'received') {
        order.lensAvailability.status = 'received';
        order.lensAvailability.allAvailable = true;
      } else if (status === 'ordered' || status === 'confirmed' || status === 'shipped') {
        order.lensAvailability.status = 'ordered';
      }
    }

    if (items) {
      order.lensAvailability.externalOrder.items = items;
    }

    await order.save();

    return success(res, { data: order });
  } catch (err) {
    opticalLogger.error('Error updating external order', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Mark external order items as received
 */
exports.receiveExternalOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { receivedItems, notes } = req.body;

    const order = await GlassesOrder.findById(id);
    if (!order) {
      return notFound(res, 'Order');
    }

    // Update items status
    let allReceived = true;
    order.lensAvailability.externalOrder.items.forEach((item, index) => {
      if (receivedItems.includes(index) || receivedItems.includes(item.itemType)) {
        item.status = 'received';
      }
      if (item.status !== 'received') {
        allReceived = false;
      }
    });

    if (allReceived) {
      order.lensAvailability.externalOrder.status = 'received';
      order.lensAvailability.status = 'received';
      order.lensAvailability.allAvailable = true;
    }

    order.lensAvailability.externalOrder.statusHistory.push({
      status: allReceived ? 'received' : 'partial_received',
      at: new Date(),
      by: req.user._id,
      notes
    });

    await order.save();

    return success(res, { data: order });
  } catch (err) {
    opticalLogger.error('Error receiving external order', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// INVOICE GENERATION
// ============================================================

/**
 * Generate invoice for optical shop order
 */
exports.generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await GlassesOrder.findById(id)
      .populate('patient', 'firstName lastName patientId fileNumber convention')
      .populate('conventionBilling.company.id', 'name companyId conventionCode');

    if (!order) {
      return notFound(res, 'Order');
    }

    // CRITICAL: Verify clinic access
    if (!verifyClinicAccess(order, req)) {
      return error(res, 'Access denied', 403);
    }

    // CRITICAL: Check order status - cannot invoice cancelled orders
    const invoiceableStatuses = ['verified', 'confirmed', 'ready', 'delivered'];
    if (!invoiceableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot generate invoice for order with status: ${order.status}`,
        allowedStatuses: invoiceableStatuses
      });
    }

    // CRITICAL: Verify patient still exists
    if (!order.patient) {
      return error(res, 'Patient record not found - cannot generate invoice');
    }

    // CRITICAL: Validate pricing
    if (!order.pricing?.finalTotal || order.pricing.finalTotal <= 0) {
      return error(res, 'Invalid order total - cannot generate invoice');
    }

    // Check if invoice already exists
    if (order.invoice) {
      const existingInvoice = await Invoice.findById(order.invoice);
      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: 'Une facture existe déjà pour cette commande',
          data: { invoiceId: existingInvoice.invoiceId, invoice: existingInvoice }
        });
      }
    }

    // Build invoice items from optical shop structure
    const invoiceItems = [];
    const orderRef = `GlassesOrder:${order.orderNumber}`;

    // Frame
    if (order.pricing?.framePrice > 0 && order.frame) {
      invoiceItems.push({
        description: `Monture: ${order.frame.brand || ''} ${order.frame.model || ''}`.trim() || 'Monture optique',
        category: 'optical',
        code: 'FRAME-OPT',
        quantity: 1,
        unitPrice: order.pricing.framePrice,
        discount: 0,
        subtotal: order.pricing.framePrice,
        tax: 0,
        total: order.pricing.framePrice,
        reference: orderRef
      });
    }

    // Lenses
    if (order.pricing?.lensPrice > 0) {
      const lensDesc = `Verres ${order.lensType?.design || 'simple vision'} - ${order.lensType?.material || 'CR39'}`;
      invoiceItems.push({
        description: lensDesc,
        category: 'optical',
        code: `LENS-${(order.lensType?.design || 'SV').toUpperCase()}`,
        quantity: 2,
        unitPrice: order.pricing.lensPrice / 2,
        discount: 0,
        subtotal: order.pricing.lensPrice,
        tax: 0,
        total: order.pricing.lensPrice,
        reference: orderRef
      });
    }

    // Lens options
    if (order.pricing?.optionsPrice > 0 && order.lensOptions) {
      const options = [
        { key: 'antiReflective', name: 'Traitement anti-reflet', code: 'LENS-AR' },
        { key: 'photochromic', name: 'Verres photochromiques', code: 'LENS-PHOTO' },
        { key: 'blueLight', name: 'Filtre lumière bleue', code: 'LENS-BLUE' },
        { key: 'tint', name: 'Teinte', code: 'LENS-TINT' },
        { key: 'polarized', name: 'Verres polarisés', code: 'LENS-POL' }
      ];

      for (const opt of options) {
        if (order.lensOptions[opt.key]?.selected && order.lensOptions[opt.key]?.price > 0) {
          invoiceItems.push({
            description: opt.name,
            category: 'optical',
            code: opt.code,
            quantity: 1,
            unitPrice: order.lensOptions[opt.key].price,
            discount: 0,
            subtotal: order.lensOptions[opt.key].price,
            tax: 0,
            total: order.lensOptions[opt.key].price,
            reference: orderRef
          });
        }
      }
    }

    // Fallback if no items
    if (invoiceItems.length === 0) {
      invoiceItems.push({
        description: `Commande optique ${order.orderNumber}`,
        category: 'optical',
        quantity: 1,
        unitPrice: order.pricing?.finalTotal || 0,
        discount: 0,
        subtotal: order.pricing?.subtotal || 0,
        tax: 0,
        total: order.pricing?.finalTotal || 0,
        reference: orderRef
      });
    }

    // Calculate totals
    const subtotal = order.pricing?.subtotal || invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discountTotal = order.pricing?.discount || 0;
    const taxTotal = order.pricing?.taxAmount || 0;
    const total = order.pricing?.finalTotal || (subtotal - discountTotal + taxTotal);

    // Create invoice data
    const invoiceData = {
      patient: order.patient._id,
      dateIssued: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: invoiceItems,
      summary: {
        subtotal,
        discountTotal,
        taxTotal,
        total,
        amountPaid: 0,
        amountDue: total
      },
      status: 'issued',
      billing: {
        currency: process.env.BASE_CURRENCY || 'CDF'
      },
      notes: {
        internal: `Optical shop order ${order.orderNumber}`,
        billing: `Type: ${order.orderType || 'glasses'}, Urgence: ${order.urgency || 'normal'}`
      },
      createdBy: req.user._id
    };

    // Add convention billing if applicable
    if (order.conventionBilling?.hasConvention && !order.conventionBilling?.opticalNotCovered) {
      const companyInfo = order.conventionBilling.company;

      invoiceData.companyBilling = {
        company: companyInfo.id,
        companyName: companyInfo.name,
        companyId: companyInfo.conventionCode,
        employeeId: order.conventionBilling.employeeId,
        coveragePercentage: order.conventionBilling.coveragePercentage,
        companyShare: order.conventionBilling?.companyPortion ?? order.pricing?.companyPortion ?? 0,
        patientShare: order.conventionBilling?.patientPortion ?? order.pricing?.patientPortion ?? total,
        billingNotes: order.conventionBilling.notes,
        companyInvoiceStatus: 'pending'
      };

      invoiceData.isConventionInvoice = true;
      invoiceData.summary.amountDue = invoiceData.companyBilling.patientShare;

      if (order.conventionBilling.requiresApproval && !order.conventionBilling.autoApproved) {
        invoiceData.companyBilling.approvalRequired = true;
        invoiceData.companyBilling.approvalStatus = order.conventionBilling.approvalStatus || 'pending';
      }
    }

    // Use transaction to ensure invoice creation and order update are atomic
    const { withTransactionRetry } = require('../utils/transactions');

    const invoice = await withTransactionRetry(async (session) => {
      // Create invoice within transaction (array syntax for session support)
      const [createdInvoice] = await Invoice.create([invoiceData], { session });

      // Link invoice to order within same transaction
      order.invoice = createdInvoice._id;
      await order.save({ session });

      return createdInvoice;
    });

    // Audit log (outside transaction - non-critical)
    await AuditLog.create({
      user: req.user._id,
      action: 'INVOICE_CREATE',
      resource: `/api/optical-shop/orders/${order._id}/invoice`,
      ipAddress: req.ip,
      metadata: {
        invoiceId: invoice.invoiceId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        total,
        isConventionInvoice: !!invoiceData.isConventionInvoice,
        companyName: invoiceData.companyBilling?.companyName,
        companyShare: invoiceData.companyBilling?.companyShare,
        patientShare: invoiceData.companyBilling?.patientShare
      }
    });

    res.status(201).json({
      success: true,
      message: invoiceData.isConventionInvoice
        ? `Facture créée - Convention ${invoiceData.companyBilling.companyName}`
        : 'Facture créée avec succès',
      data: {
        invoice,
        conventionSplit: invoiceData.isConventionInvoice ? {
          company: invoiceData.companyBilling.companyName,
          coveragePercentage: invoiceData.companyBilling.coveragePercentage,
          companyShare: invoiceData.companyBilling.companyShare,
          patientShare: invoiceData.companyBilling.patientShare
        } : null
      }
    });
  } catch (err) {
    opticalLogger.error('Error generating invoice', { error: err.message, orderId: req.params.id });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get unbilled orders for optical shop
 */
exports.getUnbilledOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = {
      invoice: { $exists: false },
      status: { $in: ['verified', 'confirmed', 'in_production', 'ready', 'delivered'] }
    };

    const orders = await GlassesOrder.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('patient', 'firstName lastName fileNumber')
      .populate('conventionBilling.company.id', 'name conventionCode')
      .select('orderNumber patient pricing conventionBilling status createdAt');

    const total = await GlassesOrder.countDocuments(query);

    res.json({
      success: true,
      data: orders.map(o => ({
        ...o.toObject(),
        hasConvention: o.conventionBilling?.hasConvention,
        conventionName: o.conventionBilling?.company?.name,
        total: o.pricing?.finalTotal,
        patientPortion: o.pricing?.patientPortion || o.pricing?.finalTotal
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    opticalLogger.error('Error getting unbilled orders', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// OPTICIAN PERFORMANCE
// ============================================================

/**
 * Get optician performance metrics
 */
exports.getOpticianPerformance = async (req, res) => {
  try {
    const { opticianId, startDate, endDate } = req.query;

    const matchStage = {};
    if (opticianId) {
      matchStage['opticalShop.optician'] = new mongoose.Types.ObjectId(opticianId);
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1)); // First of month
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    matchStage.createdAt = { $gte: start, $lte: end };

    const performance = await GlassesOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$opticalShop.optician',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.finalTotal' },
          avgOrderValue: { $avg: '$pricing.finalTotal' },
          avgConsultationTime: { $avg: '$opticalShop.consultationDuration' },
          confirmedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['confirmed', 'in_production', 'ready', 'delivered']] }, 1, 0] }
          },
          rejectedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'verification_rejected'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'optician'
        }
      },
      { $unwind: '$optician' },
      {
        $project: {
          opticianId: '$_id',
          opticianName: { $concat: ['$optician.firstName', ' ', '$optician.lastName'] },
          totalOrders: 1,
          totalRevenue: 1,
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          avgConsultationTime: { $round: ['$avgConsultationTime', 0] },
          confirmedOrders: 1,
          rejectedOrders: 1,
          cancelledOrders: 1,
          conversionRate: {
            $multiply: [
              { $divide: ['$confirmedOrders', { $max: ['$totalOrders', 1] }] },
              100
            ]
          },
          rejectionRate: {
            $multiply: [
              { $divide: ['$rejectedOrders', { $max: ['$totalOrders', 1] }] },
              100
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Daily breakdown
    const dailyStats = await GlassesOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$pricing.finalTotal' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return success(res, {
      data: {
        period: { start, end },
        opticians: performance,
        dailyStats
      }
    });
  } catch (err) {
    opticalLogger.error('Error getting optician performance', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get leaderboard for opticians
 */
exports.getOpticianLeaderboard = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const leaderboard = await GlassesOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: { $nin: ['cancelled', 'verification_rejected'] }
        }
      },
      {
        $group: {
          _id: '$opticalShop.optician',
          sales: { $sum: 1 },
          revenue: { $sum: '$pricing.finalTotal' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'optician'
        }
      },
      { $unwind: '$optician' },
      {
        $project: {
          name: { $concat: ['$optician.firstName', ' ', '$optician.lastName'] },
          sales: 1,
          revenue: 1
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    return success(res, { data: leaderboard });
  } catch (err) {
    opticalLogger.error('Error getting leaderboard', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if lens is available in inventory
 */
async function checkLensInventory(order, eye) {
  const lensData = eye === 'right' ? order.rightLens : order.leftLens;
  const material = order.lensType?.material || 'cr39';
  const design = order.lensType?.design || 'single_vision';

  // Try to find matching lens in inventory
  const lens = await OpticalLensInventory.findOne({
    material,
    design,
    isActive: true,
    'inventory.currentStock': { $gt: 0 }
  });

  if (lens && lens.inventory.currentStock > lens.inventory.reserved) {
    return { available: true, inventoryItem: lens._id };
  }

  return { available: false, inventoryItem: null };
}

/**
 * Get patient's convention info for optical pricing
 */
async function getPatientConventionInfo(patientId) {
  const patient = await findPatientByIdOrCode(patientId)
    .select('convention')
    .populate('convention.company', 'name companyId conventionCode coveredCategories defaultCoverage approvalRules parentConvention');

  if (!patient?.convention?.company) {
    return { hasConvention: false };
  }

  const company = patient.convention.company;

  // Check if company contract is active
  if (company.contract?.status && company.contract.status !== 'active') {
    return { hasConvention: false, reason: 'Contrat convention non actif' };
  }

  // Check patient's convention status
  if (patient.convention.status && patient.convention.status !== 'active') {
    return { hasConvention: false, reason: 'Convention patient non active' };
  }

  // Get optical category settings
  let opticalSettings = company.coveredCategories?.find(c => c.category === 'optical');

  // If no specific optical settings, use default coverage
  if (!opticalSettings) {
    opticalSettings = {
      category: 'optical',
      coveragePercentage: company.defaultCoverage?.percentage || 100,
      requiresApproval: false,
      notCovered: false
    };
  }

  // Check if optical is excluded for this company
  if (opticalSettings.notCovered) {
    return {
      hasConvention: true,
      opticalCovered: false,
      reason: 'Services optiques non couverts par cette convention',
      company: {
        id: company._id,
        name: company.name,
        conventionCode: company.conventionCode
      }
    };
  }

  // Get effective settings (may inherit from parent)
  let effectiveSettings = opticalSettings;
  if (company.parentConvention) {
    const parentCompany = await Company.findById(company.parentConvention)
      .select('coveredCategories defaultCoverage approvalRules');

    if (parentCompany) {
      const parentOptical = parentCompany.coveredCategories?.find(c => c.category === 'optical');
      if (parentOptical && !opticalSettings.coveragePercentage) {
        effectiveSettings = { ...parentOptical, ...opticalSettings };
      }
    }
  }

  return {
    hasConvention: true,
    opticalCovered: true,
    company: {
      id: company._id,
      name: company.name,
      conventionCode: company.conventionCode
    },
    coveragePercentage: patient.convention.coveragePercentage || effectiveSettings.coveragePercentage || company.defaultCoverage?.percentage || 100,
    requiresApproval: effectiveSettings.requiresApproval || false,
    autoApproveUnder: effectiveSettings.autoApproveUnder || company.approvalRules?.autoApproveUnderAmount,
    autoApproveUnderCurrency: company.approvalRules?.autoApproveUnderCurrency || 'USD',
    maxPerItem: effectiveSettings.maxPerItem,
    maxPerItemCurrency: effectiveSettings.maxPerItemCurrency,
    additionalDiscount: effectiveSettings.additionalDiscount,
    notes: effectiveSettings.notes,
    employeeId: patient.convention.employeeId
  };
}

/**
 * Calculate order pricing with convention support
 */
async function calculatePricing(order) {
  let subtotal = 0;
  let framePrice = 0;
  let lensPrice = 0;
  let optionsPrice = 0;

  // Get clinic modifier
  const clinicId = order.clinic;
  let priceModifier = 0;

  if (clinicId) {
    const clinic = await Clinic.findById(clinicId).select('pricingModifiers').lean();
    priceModifier = clinic?.pricingModifiers?.optical || 0;
  }

  // Get patient's convention info
  const conventionInfo = await getPatientConventionInfo(order.patient);

  // Frame price
  if (order.frame?.inventoryItem) {
    const frame = await FrameInventory.findById(order.frame.inventoryItem);
    if (frame) {
      framePrice = frame.pricing?.retailPrice || 0;

      // Apply clinic modifier
      if (priceModifier !== 0) {
        framePrice = Math.round(framePrice * (1 + priceModifier / 100));
      }

      // Apply frame limit if convention has one (e.g., BOA $60 max)
      if (conventionInfo.hasConvention && conventionInfo.opticalCovered && conventionInfo.maxPerItem) {
        // Convert limit to CDF if needed
        let limitInCDF = conventionInfo.maxPerItem;
        if (conventionInfo.maxPerItemCurrency === 'USD') {
          limitInCDF = conventionInfo.maxPerItem * 2800; // Approximate rate
        }

        if (framePrice > limitInCDF) {
          // Patient pays overage, convention pays up to limit
          order.conventionBilling = order.conventionBilling || {};
          order.conventionBilling.frameLimit = limitInCDF;
          order.conventionBilling.frameOverage = framePrice - limitInCDF;
        }
      }
    }
  } else if (order.frame?.price) {
    framePrice = order.frame.price;
  }

  // Lens prices from inventory or standard fee schedule
  const lensMaterial = order.lensType?.material || 'cr39';
  const lensDesign = order.lensType?.design || 'single_vision';

  // Try to get price from fee schedule
  const lensCode = `LENS-${lensDesign.toUpperCase()}-${lensMaterial.toUpperCase()}`.replace(/-/g, '_');

  // Check convention fee schedule first
  if (conventionInfo.hasConvention && conventionInfo.opticalCovered) {
    const conventionPrice = await ConventionFeeSchedule.getPriceForCompanyAndCode(
      conventionInfo.company.id,
      lensCode
    );

    if (conventionPrice.found) {
      lensPrice = conventionPrice.price * 2; // Both eyes
    }
  }

  // Fall back to standard prices if no convention price
  if (lensPrice === 0) {
    const standardPrice = await FeeSchedule.getEffectivePriceForDate(lensCode, new Date());
    if (standardPrice.found) {
      lensPrice = standardPrice.price * 2;
    } else {
      // Fallback to hardcoded prices
      const lensPrices = {
        'cr39': 15000,
        'cr39-1.56': 25000,
        'polycarbonate': 35000,
        'hi-index-1.60': 50000,
        'hi-index-1.67': 75000,
        'hi-index-1.74': 100000
      };
      lensPrice = (lensPrices[lensMaterial] || 15000) * 2;
    }
  }

  // Progressive/bifocal add
  if (lensDesign === 'progressive') {
    lensPrice += 50000;
  } else if (lensDesign === 'bifocal') {
    lensPrice += 25000;
  }

  // Apply clinic modifier to lens price
  if (priceModifier !== 0) {
    lensPrice = Math.round(lensPrice * (1 + priceModifier / 100));
  }

  // Lens options
  if (order.lensOptions) {
    if (order.lensOptions.antiReflective?.selected) {
      optionsPrice += order.lensOptions.antiReflective.price || 15000;
    }
    if (order.lensOptions.photochromic?.selected) {
      optionsPrice += order.lensOptions.photochromic.price || 25000;
    }
    if (order.lensOptions.blueLight?.selected) {
      optionsPrice += order.lensOptions.blueLight.price || 10000;
    }
    if (order.lensOptions.tint?.selected) {
      optionsPrice += order.lensOptions.tint.price || 8000;
    }
    if (order.lensOptions.polarized?.selected) {
      optionsPrice += order.lensOptions.polarized.price || 20000;
    }
  }

  subtotal = framePrice + lensPrice + optionsPrice;

  // CRITICAL: Validate and clamp discount
  let discount = order.pricing?.discount || 0;
  if (typeof discount !== 'number' || isNaN(discount)) discount = 0;
  if (discount < 0) discount = 0;
  // Discount cannot exceed subtotal
  if (discount > subtotal) {
    opticalLogger.warn('Discount clamped', { discount, subtotal, orderId: order._id });
    discount = subtotal;
  }
  let discountedTotal = subtotal - discount;
  // Ensure non-negative
  discountedTotal = Math.max(0, discountedTotal);

  // Apply additional convention discount if applicable
  if (conventionInfo.hasConvention && conventionInfo.opticalCovered && conventionInfo.additionalDiscount) {
    const additionalDiscountAmount = discountedTotal * (conventionInfo.additionalDiscount / 100);
    discountedTotal -= additionalDiscountAmount;
    order.conventionBilling = order.conventionBilling || {};
    order.conventionBilling.additionalDiscount = additionalDiscountAmount;
  }

  // Calculate tax
  const taxRate = order.pricing?.taxRate || 0;
  const taxAmount = discountedTotal * (taxRate / 100);
  const finalTotal = discountedTotal + taxAmount;

  // Calculate convention split
  let companyPortion = 0;
  let patientPortion = finalTotal;

  if (conventionInfo.hasConvention && conventionInfo.opticalCovered) {
    // CRITICAL: Validate and clamp coverage percentage to 0-100
    const rawCoveragePercentage = conventionInfo.coveragePercentage || 0;
    const coveragePercent = Math.min(100, Math.max(0, rawCoveragePercentage));
    companyPortion = Math.round(finalTotal * coveragePercent / 100);

    // Adjust for frame overage (patient pays full overage)
    if (order.conventionBilling?.frameOverage) {
      companyPortion = Math.round((finalTotal - order.conventionBilling.frameOverage) * coveragePercent / 100);
    }

    patientPortion = finalTotal - companyPortion;

    order.conventionBilling = {
      ...order.conventionBilling,
      hasConvention: true,
      company: conventionInfo.company,
      coveragePercentage: coveragePercent,
      companyPortion,
      patientPortion,
      requiresApproval: conventionInfo.requiresApproval,
      employeeId: conventionInfo.employeeId,
      notes: conventionInfo.notes
    };

    // Check if requires approval based on amount
    if (conventionInfo.requiresApproval && conventionInfo.autoApproveUnder) {
      let checkAmount = companyPortion;
      if (conventionInfo.autoApproveUnderCurrency === 'USD') {
        checkAmount = companyPortion / 2800; // Convert to USD for comparison
      }

      if (checkAmount < conventionInfo.autoApproveUnder) {
        order.conventionBilling.requiresApproval = false;
        order.conventionBilling.autoApproved = true;
      }
    }
  } else if (conventionInfo.hasConvention && !conventionInfo.opticalCovered) {
    order.conventionBilling = {
      hasConvention: true,
      opticalNotCovered: true,
      company: conventionInfo.company,
      patientPortion: finalTotal,
      companyPortion: 0,
      reason: conventionInfo.reason
    };
  }

  order.pricing = {
    ...order.pricing,
    subtotal,
    framePrice,
    lensPrice,
    optionsPrice,
    discount,
    taxRate,
    taxAmount,
    finalTotal,
    companyPortion,
    patientPortion
  };
}

/**
 * Reserve inventory for confirmed order
 */
async function reserveInventory(order) {
  // Reserve frame
  if (order.frame?.inventoryItem) {
    await FrameInventory.findByIdAndUpdate(order.frame.inventoryItem, {
      $inc: { 'inventory.reserved': 1 }
    });
  }

  // Reserve lenses
  for (const item of order.lensAvailability.items) {
    if (item.inventoryItem && item.itemType.includes('Lens')) {
      await OpticalLensInventory.findByIdAndUpdate(item.inventoryItem, {
        $inc: { 'inventory.reserved': 1 }
      });
    }
  }
}

/**
 * Validate order has all required fields for submission
 */
function validateOrderForSubmission(order) {
  const errors = [];

  if (!order.patient) errors.push('Patient requis');
  if (!order.rightLens?.sphere && !order.leftLens?.sphere) {
    errors.push('Au moins une prescription de verre est requise');
  }
  if (!order.frame?.brand && !order.frame?.inventoryItem) {
    errors.push('Monture requise');
  }
  if (!order.measurements?.pd) {
    errors.push('Écart pupillaire (PD) requis');
  }

  return errors;
}

/**
 * @desc    Request frames from depot
 * @route   POST /api/optical-shop/request-from-depot
 * @access  Private (optician, manager)
 */
exports.requestFromDepot = asyncHandler(async (req, res) => {
  const { items, priority = 'normal', reason = 'replenishment', notes } = req.body;
  const clinicId = req.user?.clinic || req.clinicId;

  if (!clinicId) {
    return error(res, 'Clinic not identified');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return error(res, 'No items specified');
  }

  const Clinic = require('../models/Clinic');
  const InventoryTransfer = require('../models/InventoryTransfer');

  // Find depot clinic
  const depotClinic = await Clinic.findOne({
    $or: [{ type: 'main' }, { name: /depot/i }, { name: /tombalbaye/i }]
  });

  if (!depotClinic) {
    return error(res, 'Depot not configured');
  }

  const destinationClinic = await Clinic.findById(clinicId);

  if (!destinationClinic) {
    return error(res, 'Destination clinic not found');
  }

  // Build transfer items
  const transferItems = [];
  for (const item of items) {
    const frame = await FrameInventory.findOne({
      sku: item.sku,
      isDepot: true
    });

    if (!frame) {
      return res.status(404).json({
        success: false,
        error: `Frame ${item.sku} not found in depot`
      });
    }

    if (frame.inventory.currentStock < item.quantity) {
      return error(res, `Insufficient depot stock for ${item.sku}. Available: ${frame.inventory.currentStock}`);
    }

    transferItems.push({
      inventoryType: 'frame',
      inventoryId: frame._id,
      inventoryModel: 'FrameInventory',
      productName: `${frame.brand} ${frame.model}`,
      productSku: frame.sku,
      productDetails: `${frame.color} - ${frame.category}`,
      requestedQuantity: item.quantity
    });
  }

  // Create transfer request
  const transfer = await InventoryTransfer.create({
    type: 'depot-to-clinic',
    source: {
      clinic: depotClinic._id,
      isDepot: true,
      name: depotClinic.name
    },
    destination: {
      clinic: clinicId,
      name: destinationClinic.name
    },
    items: transferItems,
    status: 'requested',
    priority,
    reason,
    reasonNotes: notes,
    requestedBy: req.user.id,
    dates: { requested: new Date() },
    approvalHistory: [{
      action: 'submitted',
      performedBy: req.user.id,
      date: new Date(),
      previousStatus: 'draft',
      newStatus: 'requested'
    }]
  });

  return success(res, { data: transfer, message: 'Transfer request created', statusCode: 201 });
});

/**
 * @desc    Get depot inventory available for request
 * @route   GET /api/optical-shop/depot-inventory
 * @access  Private
 */
exports.getDepotInventory = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 50 } = req.query;

  const query = { isDepot: true, active: true, 'inventory.currentStock': { $gt: 0 } };

  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { brand: searchRegex },
      { model: searchRegex },
      { sku: searchRegex },
      { color: searchRegex }
    ];
  }

  if (category) {
    query.category = category;
  }

  const frames = await FrameInventory.find(query)
    .select('sku brand model color category inventory.currentStock pricing.sellingPrice')
    .sort({ brand: 1, model: 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  const total = await FrameInventory.countDocuments(query);

  res.json({
    success: true,
    count: frames.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: frames
  });
});
