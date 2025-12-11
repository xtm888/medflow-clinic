const GlassesOrder = require('../models/GlassesOrder');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const FrameInventory = require('../models/FrameInventory');
const ContactLensInventory = require('../models/ContactLensInventory');
const OpticalLensInventory = require('../models/OpticalLensInventory');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const notificationFacade = require('../services/notificationFacade');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { createContextLogger } = require('../utils/structuredLogger');
const glassesLogger = createContextLogger('GlassesOrder');
const { PAGINATION } = require('../config/constants');

// @desc    Get all glasses orders
// @route   GET /api/glasses-orders
// @access  Private
exports.getOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    patient,
    orderType,
    priority,
    dateFrom,
    dateTo,
    sort = '-createdAt'
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (patient) query.patient = patient;
  if (orderType) query.orderType = orderType;
  if (priority) query.priority = priority;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const orders = await GlassesOrder.find(query)
    .populate('patient', 'firstName lastName phoneNumber email')
    .populate('exam', 'examNumber examDate')
    .populate('orderedBy', 'firstName lastName')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await GlassesOrder.countDocuments(query);

  res.status(200).json({
    success: true,
    data: orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single glasses order
// @route   GET /api/glasses-orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth phoneNumber email address')
    .populate('exam')
    .populate('orderedBy', 'firstName lastName')
    .populate('invoice');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // CRITICAL: Check if prescription has changed since order was created
  let prescriptionChanged = false;
  let currentPrescription = null;

  if (order.exam && order.prescriptionSource?.prescriptionHash) {
    const currentHash = JSON.stringify(order.exam.finalPrescription);
    if (currentHash !== order.prescriptionSource.prescriptionHash) {
      prescriptionChanged = true;
      currentPrescription = order.exam.finalPrescription;
    }
  }

  // Convert to object to add computed properties
  const orderData = order.toObject();
  orderData.prescriptionChanged = prescriptionChanged;
  if (prescriptionChanged) {
    orderData.currentPrescription = currentPrescription;
    orderData.prescriptionWarning = 'ATTENTION: La prescription a été modifiée depuis la création de cette commande. Veuillez vérifier les valeurs.';
  }

  res.status(200).json({
    success: true,
    data: orderData
  });
});

// @desc    Create glasses order from exam
// @route   POST /api/glasses-orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { examId, orderType, glasses, contactLenses, items, notes, priority, deliveryInfo } = req.body;

  // Get exam data with full patient info including convention
  const exam = await OphthalmologyExam.findById(examId)
    .populate({
      path: 'patient',
      select: 'firstName lastName convention employeeId',
      populate: {
        path: 'convention.company',
        model: 'Company',
        select: 'name code coveredCategories defaultCoverage approvalRules'
      }
    });

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  // Extract prescription data from exam - KEEP A SNAPSHOT but also track the source
  const prescriptionData = {
    od: {
      sphere: exam.finalPrescription?.od?.sphere,
      cylinder: exam.finalPrescription?.od?.cylinder,
      axis: exam.finalPrescription?.od?.axis,
      add: exam.finalPrescription?.od?.add,
      visualAcuity: exam.finalPrescription?.od?.visualAcuity
    },
    os: {
      sphere: exam.finalPrescription?.os?.sphere,
      cylinder: exam.finalPrescription?.os?.cylinder,
      axis: exam.finalPrescription?.os?.axis,
      add: exam.finalPrescription?.os?.add,
      visualAcuity: exam.finalPrescription?.os?.visualAcuity
    },
    pd: {
      binocular: exam.finalPrescription?.pd?.binocular,
      monocularOd: exam.finalPrescription?.pd?.monocularOd,
      monocularOs: exam.finalPrescription?.pd?.monocularOs
    }
  };

  // CRITICAL FIX: Track prescription source and version for change detection
  const prescriptionSource = {
    examId: exam._id,
    examUpdatedAt: exam.updatedAt,
    prescriptionHash: JSON.stringify(exam.finalPrescription), // For change detection
    snapshotAt: new Date()
  };

  // Calculate item totals
  const processedItems = items?.map(item => ({
    ...item,
    total: (item.quantity || 1) * (item.unitPrice || 0) - (item.discount || 0)
  })) || [];

  // Calculate total for convention billing
  const orderTotal = processedItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // ============================================
  // AUTO-CALCULATE CONVENTION BILLING FOR OPTICAL
  // ============================================
  let conventionBilling = null;
  const patient = exam.patient;
  const company = patient?.convention?.company;

  if (company && patient?.convention?.isActive !== false) {
    // Get optical category settings from company
    const opticalConfig = company.coveredCategories?.find(c => c.category === 'optical');

    let coveragePercentage = 0;
    let opticalNotCovered = false;
    let requiresApproval = false;

    if (opticalConfig) {
      if (opticalConfig.notCovered) {
        // Optical not covered (e.g., CIGNA, GGA)
        opticalNotCovered = true;
        coveragePercentage = 0;
      } else {
        coveragePercentage = opticalConfig.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
        requiresApproval = opticalConfig.requiresApproval || false;
      }
    } else {
      // No specific optical config - use company default
      coveragePercentage = company.defaultCoverage?.percentage ?? 100;
    }

    // Check auto-approval threshold
    let autoApproved = false;
    if (requiresApproval && company.approvalRules?.autoApproveUnderAmount) {
      const threshold = company.approvalRules.autoApproveUnderAmount;
      // Convert to USD if needed (assuming order is in CDF)
      const orderInUsd = orderTotal / 2800; // Approximate CDF to USD
      if (orderInUsd < threshold) {
        autoApproved = true;
      }
    }

    // Calculate portions
    const companyPortion = Math.round(orderTotal * coveragePercentage / 100);
    const patientPortion = orderTotal - companyPortion;

    conventionBilling = {
      hasConvention: true,
      opticalNotCovered,
      company: {
        id: company._id,
        name: company.name,
        conventionCode: company.code
      },
      employeeId: patient.employeeId || patient.convention?.employeeId,
      coveragePercentage,
      companyPortion,
      patientPortion,
      requiresApproval,
      autoApproved,
      approvalStatus: requiresApproval && !autoApproved ? 'pending' : 'not_required'
    };
  }

  const order = await GlassesOrder.create({
    exam: examId,
    patient: exam.patient._id || exam.patient,
    orderedBy: req.user._id || req.user.id,
    orderType,
    prescriptionData,
    prescriptionSource, // NEW: Track where prescription came from
    glasses,
    contactLenses,
    items: processedItems,
    notes,
    priority: priority || 'normal',
    deliveryInfo,
    status: 'draft',
    conventionBilling // AUTO-CALCULATED convention billing
  });

  // Check if prescription has been updated since order creation (for existing orders being viewed)
  order.prescriptionChanged = false; // New orders always have current prescription

  // Populate for response
  await order.populate('patient', 'firstName lastName phoneNumber');
  await order.populate('orderedBy', 'firstName lastName');

  // Build response message with convention info if applicable
  let message = 'Order created successfully';
  if (conventionBilling?.hasConvention) {
    if (conventionBilling.opticalNotCovered) {
      message = `Commande créée - Convention ${conventionBilling.company.name}: Optique non couvert, patient paie 100%`;
    } else {
      message = `Commande créée - Convention ${conventionBilling.company.name}: ${conventionBilling.coveragePercentage}% couvert (${conventionBilling.companyPortion.toLocaleString()} CDF entreprise, ${conventionBilling.patientPortion.toLocaleString()} CDF patient)`;
    }
  }

  res.status(201).json({
    success: true,
    data: order,
    message,
    conventionApplied: conventionBilling?.hasConvention || false
  });
});

// @desc    Update glasses order
// @route   PUT /api/glasses-orders/:id
// @access  Private
exports.updateOrder = asyncHandler(async (req, res) => {
  let order = await GlassesOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Don't allow updates to delivered or cancelled orders
  if (['delivered', 'cancelled'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot update ${order.status} order`
    });
  }

  // Recalculate item totals if items are updated
  if (req.body.items) {
    req.body.items = req.body.items.map(item => ({
      ...item,
      total: (item.quantity || 1) * (item.unitPrice || 0) - (item.discount || 0)
    }));
  }

  order = await GlassesOrder.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('patient', 'firstName lastName phoneNumber')
   .populate('orderedBy', 'firstName lastName');

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Update order status
// @route   PUT /api/glasses-orders/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id)
      .populate('patient', 'firstName lastName')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Validate status transition
    // QC WORKFLOW: in-production → received → qc-passed → ready → delivered
    //                                      ↳ qc-failed → (requires override or rework)
    const validTransitions = {
      'draft': ['confirmed', 'cancelled'],
      'confirmed': ['sent-to-lab', 'cancelled'],
      'sent-to-lab': ['in-production', 'cancelled'],
      'in-production': ['received', 'cancelled'],  // Goes to received first for QC
      'received': ['qc-passed', 'qc-failed', 'cancelled'],  // QC inspection
      'qc-passed': ['ready', 'cancelled'],  // Passed QC, can mark ready
      'qc-failed': ['received', 'ready', 'cancelled'],  // Can retry QC or override to ready
      'ready': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    };

    if (!validTransitions[order.status]?.includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: `Cannot transition from ${order.status} to ${status}`
      });
    }

    const previousStatus = order.status;
    order.status = status;

    // ============================================
    // AUTOMATIC INVENTORY MANAGEMENT
    // ============================================

    // When CONFIRMED: Reserve inventory
    if (status === 'confirmed' && previousStatus === 'draft') {
      const reservationResults = { frame: null, opticalLens: null, contactLensOd: null, contactLensOs: null };

      // Reserve frame
      if (order.glasses?.frame?.inventoryItem && !order.glasses.frame.reservationId) {
        const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
        if (frame) {
          const available = frame.inventory.currentStock - frame.inventory.reserved;
          if (available < 1) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              error: `Monture ${frame.brand} ${frame.model} n'est plus disponible en stock`
            });
          }
          const reservation = await frame.reserveStock(1, order._id, req.user._id || req.user.id, session);
          order.glasses.frame.reservationId = reservation.reservationId;
          order.glasses.frame.costPrice = frame.pricing.costPrice;
          order.glasses.frame.sellingPrice = frame.pricing.sellingPrice;
          reservationResults.frame = reservation;
        }
      }

      // Reserve optical lens (for glasses orders)
      if (order.glasses?.lens?.inventoryItem && !order.glasses.lens.reservationId) {
        const opticalLens = await OpticalLensInventory.findById(order.glasses.lens.inventoryItem).session(session);
        if (opticalLens) {
          // Need 1 pair of lenses for glasses order
          const available = opticalLens.inventory.currentStock - opticalLens.inventory.reserved;
          if (available < 1) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              error: `Verre optique ${opticalLens.brand} ${opticalLens.productLine} n'est plus disponible en stock`
            });
          }
          const reservation = await opticalLens.reserveStock(1, order._id);
          order.glasses.lens.reservationId = reservation.reserved ? `RES-${Date.now()}` : null;
          order.glasses.lens.costPrice = opticalLens.pricing.costPrice;
          order.glasses.lens.sellingPrice = opticalLens.pricing.sellingPrice;
          // Capture lens specs from inventory
          order.glasses.lens.brand = opticalLens.brand;
          order.glasses.lens.productLine = opticalLens.productLine;
          order.glasses.lens.material = opticalLens.material;
          order.glasses.lens.design = opticalLens.design;
          order.glasses.lens.coatings = opticalLens.coatings;
          order.glasses.lens.isPhotochromic = opticalLens.isPhotochromic;
          order.glasses.lens.photochromicType = opticalLens.photochromicType;
          order.glasses.lens.isPolarized = opticalLens.isPolarized;
          order.glasses.lens.refractiveIndex = opticalLens.refractiveIndex;
          order.glasses.lens.sku = opticalLens.sku;
          reservationResults.opticalLens = reservation;
        }
      }

      // Reserve contact lens OD
      if (order.contactLenses?.od?.inventoryItem && !order.contactLenses.od.reservationId) {
        const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
        if (lens) {
          const qty = order.contactLenses.od.quantity || 1;
          const available = lens.inventory.currentStock - lens.inventory.reserved;
          if (available < qty) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              error: `Lentilles OD ${lens.brand} - stock insuffisant (${available} disponible, ${qty} demandé)`
            });
          }
          const reservation = await lens.reserveStock(qty, order._id, req.user._id || req.user.id, session);
          order.contactLenses.od.reservationId = reservation.reservationId;
          order.contactLenses.od.costPrice = lens.pricing.costPrice;
          order.contactLenses.od.sellingPrice = lens.pricing.sellingPrice;
          reservationResults.contactLensOd = reservation;
        }
      }

      // Reserve contact lens OS
      if (order.contactLenses?.os?.inventoryItem && !order.contactLenses.os.reservationId) {
        const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
        if (lens) {
          const qty = order.contactLenses.os.quantity || 1;
          const available = lens.inventory.currentStock - lens.inventory.reserved;
          if (available < qty) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              error: `Lentilles OS ${lens.brand} - stock insuffisant (${available} disponible, ${qty} demandé)`
            });
          }
          const reservation = await lens.reserveStock(qty, order._id, req.user._id || req.user.id, session);
          order.contactLenses.os.reservationId = reservation.reservationId;
          order.contactLenses.os.costPrice = lens.pricing.costPrice;
          order.contactLenses.os.sellingPrice = lens.pricing.sellingPrice;
          reservationResults.contactLensOs = reservation;
        }
      }

      // Update inventory status on order
      order.inventoryStatus = {
        frameReserved: !!reservationResults.frame,
        lensReserved: !!reservationResults.opticalLens,
        contactsOdReserved: !!reservationResults.contactLensOd,
        contactsOsReserved: !!reservationResults.contactLensOs,
        allReserved: true,
        reservedAt: new Date()
      };
    }

    // When DELIVERED: Fulfill inventory (dispense from stock)
    if (status === 'delivered') {
      let totalCost = 0;
      let totalRevenue = 0;

      // Fulfill frame
      if (order.glasses?.frame?.inventoryItem && order.glasses?.frame?.reservationId) {
        const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
        if (frame) {
          await frame.fulfillReservation(
            order.glasses.frame.reservationId,
            order.patient._id,
            req.user._id || req.user.id,
            session
          );
          totalCost += frame.pricing.costPrice || 0;
          totalRevenue += order.glasses.frame.sellingPrice || frame.pricing.sellingPrice || 0;
        }
      }

      // Fulfill optical lens
      if (order.glasses?.lens?.inventoryItem && order.glasses?.lens?.reservationId) {
        const opticalLens = await OpticalLensInventory.findById(order.glasses.lens.inventoryItem).session(session);
        if (opticalLens) {
          await opticalLens.fulfillReservation(1);
          totalCost += opticalLens.pricing.costPrice || 0;
          totalRevenue += order.glasses.lens.sellingPrice || opticalLens.pricing.sellingPrice || 0;
        }
      }

      // Fulfill contact lens OD
      if (order.contactLenses?.od?.inventoryItem && order.contactLenses?.od?.reservationId) {
        const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
        if (lens) {
          await lens.fulfillReservation(
            order.contactLenses.od.reservationId,
            order.patient._id,
            req.user._id || req.user.id,
            session
          );
          const qty = order.contactLenses.od.quantity || 1;
          totalCost += (lens.pricing.costPrice || 0) * qty;
          totalRevenue += (order.contactLenses.od.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
        }
      }

      // Fulfill contact lens OS
      if (order.contactLenses?.os?.inventoryItem && order.contactLenses?.os?.reservationId) {
        const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
        if (lens) {
          await lens.fulfillReservation(
            order.contactLenses.os.reservationId,
            order.patient._id,
            req.user._id || req.user.id,
            session
          );
          const qty = order.contactLenses.os.quantity || 1;
          totalCost += (lens.pricing.costPrice || 0) * qty;
          totalRevenue += (order.contactLenses.os.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
        }
      }

      // Update cost tracking
      order.costTracking = {
        frameCost: order.glasses?.frame?.costPrice || 0,
        lensCost: order.glasses?.lens?.costPrice || 0,
        contactsOdCost: (order.contactLenses?.od?.costPrice || 0) * (order.contactLenses?.od?.quantity || 1),
        contactsOsCost: (order.contactLenses?.os?.costPrice || 0) * (order.contactLenses?.os?.quantity || 1),
        totalCost,
        totalRevenue,
        margin: totalRevenue - totalCost,
        marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0
      };

      // Set delivery timestamp
      order.timeline = order.timeline || {};
      order.timeline.deliveredAt = new Date();
    }

    // When CANCELLED: Release all reservations
    if (status === 'cancelled') {
      // Release frame reservation
      if (order.glasses?.frame?.inventoryItem && order.glasses?.frame?.reservationId) {
        const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
        if (frame) {
          await frame.releaseReservation(order.glasses.frame.reservationId, session);
          order.glasses.frame.reservationId = undefined;
        }
      }

      // Release optical lens reservation
      if (order.glasses?.lens?.inventoryItem && order.glasses?.lens?.reservationId) {
        const opticalLens = await OpticalLensInventory.findById(order.glasses.lens.inventoryItem).session(session);
        if (opticalLens) {
          await opticalLens.releaseReservation(1);
          order.glasses.lens.reservationId = undefined;
        }
      }

      // Release contact lens OD reservation
      if (order.contactLenses?.od?.inventoryItem && order.contactLenses?.od?.reservationId) {
        const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
        if (lens) {
          await lens.releaseReservation(order.contactLenses.od.reservationId, session);
          order.contactLenses.od.reservationId = undefined;
        }
      }

      // Release contact lens OS reservation
      if (order.contactLenses?.os?.inventoryItem && order.contactLenses?.os?.reservationId) {
        const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
        if (lens) {
          await lens.releaseReservation(order.contactLenses.os.reservationId, session);
          order.contactLenses.os.reservationId = undefined;
        }
      }

      // Clear inventory status
      order.inventoryStatus = {
        frameReserved: false,
        lensReserved: false,
        contactsOdReserved: false,
        contactsOsReserved: false,
        allReserved: false,
        reservedAt: null
      };
    }

    if (notes) {
      order.notes = order.notes || {};
      order.notes.internal = (order.notes.internal || '') + `\n[${new Date().toISOString()}] ${notes}`;
    }

    await order.save({ session });
    await session.commitTransaction();

    await order.populate('patient', 'firstName lastName phone email');

    // ============================================
    // SEND PATIENT NOTIFICATIONS (after commit)
    // ============================================
    let notificationResult = null;

    try {
      if (order.patient) {
        const patient = order.patient;

        switch (status) {
          case 'confirmed':
            notificationResult = await notificationFacade.sendGlassesOrderConfirmation(order, patient);
            console.log(`[GlassesOrder] Confirmation notification sent for ${order.orderNumber}`);
            break;

          case 'ready':
            // CRITICAL: Patient needs to know glasses are ready
            notificationResult = await notificationFacade.sendGlassesReadyNotification(order, patient);
            console.log(`[GlassesOrder] READY notification sent for ${order.orderNumber}`);
            break;

          case 'delivered':
            notificationResult = await notificationFacade.sendGlassesDeliveredNotification(order, patient);
            console.log(`[GlassesOrder] Delivery confirmation sent for ${order.orderNumber}`);
            break;
        }
      }
    } catch (notifError) {
      console.error('[GlassesOrder] Notification error (non-blocking):', notifError.message);
      // Don't fail the request - notifications are best-effort
    }

    res.status(200).json({
      success: true,
      data: order,
      message: `Order status updated to ${status}`,
      notification: notificationResult
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Delete/cancel glasses order
// @route   DELETE /api/glasses-orders/:id
// @access  Private (Admin)
exports.deleteOrder = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Only allow deletion of draft orders; otherwise cancel
  if (order.status === 'draft') {
    await order.deleteOne();
    return res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  }

  // Cancel instead of delete
  order.status = 'cancelled';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: order
  });
});

// @desc    Get orders for a patient
// @route   GET /api/glasses-orders/patient/:patientId
// @access  Private
exports.getPatientOrders = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({ patient: req.params.patientId })
    .populate('exam', 'examNumber examDate')
    .populate('orderedBy', 'firstName lastName')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: orders
  });
});

// @desc    Get orders for an exam
// @route   GET /api/glasses-orders/exam/:examId
// @access  Private
exports.getExamOrders = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({ exam: req.params.examId })
    .populate('patient', 'firstName lastName')
    .populate('orderedBy', 'firstName lastName')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: orders
  });
});

// @desc    Get order statistics
// @route   GET /api/glasses-orders/stats
// @access  Private
exports.getOrderStats = asyncHandler(async (req, res) => {
  const stats = await GlassesOrder.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$total' }
      }
    }
  ]);

  const pending = await GlassesOrder.countDocuments({
    status: { $in: ['draft', 'confirmed', 'sent-to-lab', 'in-production'] }
  });

  const ready = await GlassesOrder.countDocuments({ status: 'ready' });

  const todayDeliveries = await GlassesOrder.countDocuments({
    status: 'delivered',
    'timeline.deliveredAt': {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
  });

  res.status(200).json({
    success: true,
    data: {
      byStatus: stats,
      pending,
      ready,
      todayDeliveries
    }
  });
});

// ============================================
// BILLING INTEGRATION
// ============================================

// @desc    Generate invoice for glasses order (supports optical shop convention billing)
// @route   POST /api/glasses-orders/:id/invoice
// @access  Private (Admin, Billing, Receptionist)
exports.generateInvoice = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId convention')
    .populate('exam', 'examNumber')
    .populate('conventionBilling.company.id', 'name companyId conventionCode');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Glasses order not found'
    });
  }

  // Check if invoice already exists
  if (order.invoice) {
    const existingInvoice = await Invoice.findById(order.invoice);
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        error: 'Invoice already exists for this order',
        data: { invoiceId: existingInvoice.invoiceId }
      });
    }
  }

  // Build invoice items - support both old items array and new optical shop structure
  const invoiceItems = [];
  const orderRef = `GlassesOrder:${order.orderNumber}`;

  // Check if this is an optical shop order (has pricing.framePrice, pricing.lensPrice)
  const isOpticalShopOrder = order.pricing?.framePrice !== undefined ||
                              order.pricing?.lensPrice !== undefined;

  if (isOpticalShopOrder) {
    // Optical shop order - build items from pricing breakdown
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

    if (order.pricing?.lensPrice > 0) {
      const lensDesc = `Verres ${order.lensType?.design || 'simple vision'} - ${order.lensType?.material || 'CR39'}`;
      invoiceItems.push({
        description: lensDesc,
        category: 'optical',
        code: `LENS-${(order.lensType?.design || 'SV').toUpperCase()}`,
        quantity: 2, // Both eyes
        unitPrice: order.pricing.lensPrice / 2,
        discount: 0,
        subtotal: order.pricing.lensPrice,
        tax: 0,
        total: order.pricing.lensPrice,
        reference: orderRef
      });
    }

    if (order.pricing?.optionsPrice > 0 && order.lensOptions) {
      // Add each selected option as a line item
      if (order.lensOptions.antiReflective?.selected) {
        const price = order.lensOptions.antiReflective.price || 0;
        if (price > 0) {
          invoiceItems.push({
            description: `Traitement anti-reflet${order.lensOptions.antiReflective.type ? ` (${order.lensOptions.antiReflective.type})` : ''}`,
            category: 'optical',
            code: 'LENS-AR',
            quantity: 1,
            unitPrice: price,
            discount: 0,
            subtotal: price,
            tax: 0,
            total: price,
            reference: orderRef
          });
        }
      }

      if (order.lensOptions.photochromic?.selected) {
        const price = order.lensOptions.photochromic.price || 0;
        if (price > 0) {
          invoiceItems.push({
            description: `Verres photochromiques${order.lensOptions.photochromic.type ? ` (${order.lensOptions.photochromic.type})` : ''}`,
            category: 'optical',
            code: 'LENS-PHOTO',
            quantity: 1,
            unitPrice: price,
            discount: 0,
            subtotal: price,
            tax: 0,
            total: price,
            reference: orderRef
          });
        }
      }

      if (order.lensOptions.blueLight?.selected) {
        const price = order.lensOptions.blueLight.price || 0;
        if (price > 0) {
          invoiceItems.push({
            description: 'Filtre lumiere bleue',
            category: 'optical',
            code: 'LENS-BLUE',
            quantity: 1,
            unitPrice: price,
            discount: 0,
            subtotal: price,
            tax: 0,
            total: price,
            reference: orderRef
          });
        }
      }

      if (order.lensOptions.tint?.selected) {
        const price = order.lensOptions.tint.price || 0;
        if (price > 0) {
          invoiceItems.push({
            description: `Teinte${order.lensOptions.tint.color ? ` (${order.lensOptions.tint.color})` : ''}`,
            category: 'optical',
            code: 'LENS-TINT',
            quantity: 1,
            unitPrice: price,
            discount: 0,
            subtotal: price,
            tax: 0,
            total: price,
            reference: orderRef
          });
        }
      }

      if (order.lensOptions.polarized?.selected) {
        const price = order.lensOptions.polarized.price || 0;
        if (price > 0) {
          invoiceItems.push({
            description: 'Verres polarises',
            category: 'optical',
            code: 'LENS-POL',
            quantity: 1,
            unitPrice: price,
            discount: 0,
            subtotal: price,
            tax: 0,
            total: price,
            reference: orderRef
          });
        }
      }
    }
  } else if (order.items && order.items.length > 0) {
    // Legacy order structure with items array
    for (const item of order.items) {
      invoiceItems.push({
        description: item.description,
        category: 'optical',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0,
        subtotal: (item.unitPrice || 0) * (item.quantity || 1),
        tax: 0,
        total: item.total || ((item.unitPrice || 0) * (item.quantity || 1) - (item.discount || 0)),
        reference: orderRef
      });
    }
  } else {
    // Fallback - single line item with total
    invoiceItems.push({
      description: `Commande optique ${order.orderNumber}`,
      category: 'optical',
      quantity: 1,
      unitPrice: order.pricing?.finalTotal || order.total || 0,
      discount: 0,
      subtotal: order.pricing?.subtotal || order.subtotal || order.total || 0,
      tax: 0,
      total: order.pricing?.finalTotal || order.total || 0,
      reference: orderRef
    });
  }

  // Calculate totals from pricing or fallback
  const subtotal = order.pricing?.subtotal || invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountTotal = order.pricing?.discount || order.discount || 0;
  const taxTotal = order.pricing?.taxAmount || order.tax || 0;
  const total = order.pricing?.finalTotal || order.total || (subtotal - discountTotal + taxTotal);

  // Create invoice data
  const invoiceData = {
    patient: order.patient._id,
    dateIssued: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    items: invoiceItems,
    summary: {
      subtotal,
      discountTotal,
      taxTotal,
      total,
      amountPaid: order.amountPaid || 0,
      amountDue: total - (order.amountPaid || 0)
    },
    status: (order.amountPaid || 0) >= total ? 'paid' :
            (order.amountPaid || 0) > 0 ? 'partial' : 'issued',
    billing: {
      currency: process.env.BASE_CURRENCY || 'CDF'
    },
    notes: {
      internal: `Glasses order ${order.orderNumber}`,
      billing: `Type: ${order.orderType || 'glasses'}, Urgence: ${order.urgency || 'normal'}`
    },
    createdBy: req.user.id
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

    // Update summary amounts to reflect patient portion only for payment due
    invoiceData.summary.amountDue = invoiceData.companyBilling.patientShare - (order.amountPaid || 0);

    // Add approval tracking if required
    if (order.conventionBilling.requiresApproval && !order.conventionBilling.autoApproved) {
      invoiceData.companyBilling.approvalRequired = true;
      invoiceData.companyBilling.approvalStatus = order.conventionBilling.approvalStatus || 'pending';
    }
  }

  const invoice = await Invoice.create(invoiceData);

  // Link invoice to order
  order.invoice = invoice._id;
  await order.save();

  // Audit log
  await AuditLog.create({
    user: req.user.id,
    action: 'INVOICE_CREATE',
    resource: `/api/glasses-orders/${order._id}/invoice`,
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
      ? `Facture creee - Convention ${invoiceData.companyBilling.companyName}: Part entreprise ${invoiceData.companyBilling.companyShare} CDF, Part patient ${invoiceData.companyBilling.patientShare} CDF`
      : 'Facture creee avec succes',
    data: invoice
  });
});

// @desc    Get unbilled glasses orders
// @route   GET /api/glasses-orders/unbilled
// @access  Private (Admin, Billing)
exports.getUnbilledOrders = asyncHandler(async (req, res) => {
  const { patientId } = req.query;

  const query = { invoice: { $exists: false } };
  if (patientId) {
    query.patient = patientId;
  }

  const orders = await GlassesOrder.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('exam', 'examNumber')
    .select('orderNumber orderType status total amountPaid createdAt')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// ============================================
// INVENTORY INTEGRATION
// ============================================

// @desc    Check inventory availability for order items
// @route   POST /api/glasses-orders/check-inventory
// @access  Private
exports.checkInventoryAvailability = asyncHandler(async (req, res) => {
  const { frameId, contactLensOdId, contactLensOsId } = req.body;

  const availability = {
    frame: null,
    contactLensOd: null,
    contactLensOs: null,
    allAvailable: true
  };

  // Check frame availability
  if (frameId) {
    const frame = await FrameInventory.findById(frameId);
    if (frame) {
      const available = frame.inventory.currentStock - frame.inventory.reserved;
      availability.frame = {
        id: frame._id,
        sku: frame.sku,
        brand: frame.brand,
        model: frame.model,
        color: frame.color,
        currentStock: frame.inventory.currentStock,
        reserved: frame.inventory.reserved,
        available,
        status: frame.inventory.status,
        price: frame.pricing.sellingPrice,
        costPrice: frame.pricing.costPrice,
        isAvailable: available >= 1
      };
      if (available < 1) availability.allAvailable = false;
    } else {
      availability.frame = { error: 'Frame not found', isAvailable: false };
      availability.allAvailable = false;
    }
  }

  // Check contact lens OD availability
  if (contactLensOdId) {
    const lens = await ContactLensInventory.findById(contactLensOdId);
    if (lens) {
      const available = lens.inventory.currentStock - lens.inventory.reserved;
      availability.contactLensOd = {
        id: lens._id,
        sku: lens.sku,
        brand: lens.brand,
        productLine: lens.productLine,
        parameters: lens.parameters,
        currentStock: lens.inventory.currentStock,
        reserved: lens.inventory.reserved,
        available,
        status: lens.inventory.status,
        price: lens.pricing.sellingPrice,
        costPrice: lens.pricing.costPrice,
        packSize: lens.packSize,
        isAvailable: available >= 1
      };
      if (available < 1) availability.allAvailable = false;
    } else {
      availability.contactLensOd = { error: 'Contact lens not found', isAvailable: false };
      availability.allAvailable = false;
    }
  }

  // Check contact lens OS availability
  if (contactLensOsId) {
    const lens = await ContactLensInventory.findById(contactLensOsId);
    if (lens) {
      const available = lens.inventory.currentStock - lens.inventory.reserved;
      availability.contactLensOs = {
        id: lens._id,
        sku: lens.sku,
        brand: lens.brand,
        productLine: lens.productLine,
        parameters: lens.parameters,
        currentStock: lens.inventory.currentStock,
        reserved: lens.inventory.reserved,
        available,
        status: lens.inventory.status,
        price: lens.pricing.sellingPrice,
        costPrice: lens.pricing.costPrice,
        packSize: lens.packSize,
        isAvailable: available >= 1
      };
      if (available < 1) availability.allAvailable = false;
    } else {
      availability.contactLensOs = { error: 'Contact lens not found', isAvailable: false };
      availability.allAvailable = false;
    }
  }

  res.status(200).json({
    success: true,
    data: availability
  });
});

// @desc    Reserve inventory for glasses order
// @route   POST /api/glasses-orders/:id/reserve-inventory
// @access  Private
exports.reserveInventory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const reservations = {
      frame: null,
      contactLensOd: null,
      contactLensOs: null
    };

    // Reserve frame
    if (order.glasses?.frame?.inventoryItem) {
      const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
      if (frame) {
        const reservation = await frame.reserveStock(
          1,
          order._id,
          req.user._id || req.user.id,
          session
        );
        reservations.frame = reservation;

        // Update order with reservation info
        order.glasses.frame.reservationId = reservation.reservationId;
        order.glasses.frame.costPrice = frame.pricing.costPrice;
        order.glasses.frame.sellingPrice = frame.pricing.sellingPrice;
      }
    }

    // Reserve contact lens OD
    if (order.contactLenses?.od?.inventoryItem) {
      const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
      if (lens) {
        const reservation = await lens.reserveStock(
          order.contactLenses.od.quantity || 1,
          order._id,
          req.user._id || req.user.id,
          session
        );
        reservations.contactLensOd = reservation;

        order.contactLenses.od.reservationId = reservation.reservationId;
        order.contactLenses.od.costPrice = lens.pricing.costPrice;
        order.contactLenses.od.sellingPrice = lens.pricing.sellingPrice;
      }
    }

    // Reserve contact lens OS
    if (order.contactLenses?.os?.inventoryItem) {
      const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
      if (lens) {
        const reservation = await lens.reserveStock(
          order.contactLenses.os.quantity || 1,
          order._id,
          req.user._id || req.user.id,
          session
        );
        reservations.contactLensOs = reservation;

        order.contactLenses.os.reservationId = reservation.reservationId;
        order.contactLenses.os.costPrice = lens.pricing.costPrice;
        order.contactLenses.os.sellingPrice = lens.pricing.sellingPrice;
      }
    }

    // Update inventory status
    order.inventoryStatus = {
      frameReserved: !!reservations.frame,
      contactsOdReserved: !!reservations.contactLensOd,
      contactsOsReserved: !!reservations.contactLensOs,
      allReserved: true,
      reservedAt: new Date()
    };

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Inventory reserved successfully',
      data: {
        orderId: order._id,
        reservations
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Release inventory reservations for glasses order
// @route   POST /api/glasses-orders/:id/release-inventory
// @access  Private
exports.releaseInventory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const released = {
      frame: false,
      contactLensOd: false,
      contactLensOs: false
    };

    // Release frame reservation
    if (order.glasses?.frame?.inventoryItem && order.glasses?.frame?.reservationId) {
      const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
      if (frame) {
        await frame.releaseReservation(order.glasses.frame.reservationId, session);
        released.frame = true;
        order.glasses.frame.reservationId = undefined;
      }
    }

    // Release contact lens OD reservation
    if (order.contactLenses?.od?.inventoryItem && order.contactLenses?.od?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
      if (lens) {
        await lens.releaseReservation(order.contactLenses.od.reservationId, session);
        released.contactLensOd = true;
        order.contactLenses.od.reservationId = undefined;
      }
    }

    // Release contact lens OS reservation
    if (order.contactLenses?.os?.inventoryItem && order.contactLenses?.os?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
      if (lens) {
        await lens.releaseReservation(order.contactLenses.os.reservationId, session);
        released.contactLensOs = true;
        order.contactLenses.os.reservationId = undefined;
      }
    }

    // Update inventory status
    order.inventoryStatus = {
      frameReserved: false,
      contactsOdReserved: false,
      contactsOsReserved: false,
      allReserved: false,
      reservedAt: null
    };

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Inventory reservations released',
      data: {
        orderId: order._id,
        released
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Fulfill inventory (convert reservations to sales) on delivery
// @route   POST /api/glasses-orders/:id/fulfill-inventory
// @access  Private
exports.fulfillInventory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id)
      .populate('patient', 'firstName lastName')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const fulfilled = {
      frame: false,
      contactLensOd: false,
      contactLensOs: false
    };

    let totalCost = 0;
    let totalRevenue = 0;

    // Fulfill frame
    if (order.glasses?.frame?.inventoryItem && order.glasses?.frame?.reservationId) {
      const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
      if (frame) {
        await frame.fulfillReservation(
          order.glasses.frame.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        fulfilled.frame = true;

        // Track costs
        totalCost += frame.pricing.costPrice || 0;
        totalRevenue += order.glasses.frame.sellingPrice || frame.pricing.sellingPrice || 0;
      }
    }

    // Fulfill contact lens OD
    if (order.contactLenses?.od?.inventoryItem && order.contactLenses?.od?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
      if (lens) {
        await lens.fulfillReservation(
          order.contactLenses.od.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        fulfilled.contactLensOd = true;

        const qty = order.contactLenses.od.quantity || 1;
        totalCost += (lens.pricing.costPrice || 0) * qty;
        totalRevenue += (order.contactLenses.od.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
      }
    }

    // Fulfill contact lens OS
    if (order.contactLenses?.os?.inventoryItem && order.contactLenses?.os?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
      if (lens) {
        await lens.fulfillReservation(
          order.contactLenses.os.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        fulfilled.contactLensOs = true;

        const qty = order.contactLenses.os.quantity || 1;
        totalCost += (lens.pricing.costPrice || 0) * qty;
        totalRevenue += (order.contactLenses.os.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
      }
    }

    // Update cost tracking on order
    order.costTracking = {
      frameCost: order.glasses?.frame?.costPrice || 0,
      contactsOdCost: (order.contactLenses?.od?.costPrice || 0) * (order.contactLenses?.od?.quantity || 1),
      contactsOsCost: (order.contactLenses?.os?.costPrice || 0) * (order.contactLenses?.os?.quantity || 1),
      lensCost: 0, // Add if tracking lens costs separately
      totalCost,
      totalRevenue,
      margin: totalRevenue - totalCost,
      marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0
    };

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Inventory fulfilled successfully',
      data: {
        orderId: order._id,
        fulfilled,
        costTracking: order.costTracking
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Search frames for order (autocomplete)
// @route   GET /api/glasses-orders/search-frames
// @access  Private
exports.searchFrames = asyncHandler(async (req, res) => {
  const { query, category, status = 'in-stock' } = req.query;

  const searchQuery = {
    isActive: true,
    'inventory.status': { $in: status === 'all' ? ['in-stock', 'low-stock', 'out-of-stock'] : [status, 'low-stock'] }
  };

  if (query) {
    searchQuery.$or = [
      { brand: { $regex: query, $options: 'i' } },
      { model: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } },
      { barcode: { $regex: query, $options: 'i' } }
    ];
  }

  if (category) {
    searchQuery.category = category;
  }

  const frames = await FrameInventory.find(searchQuery)
    .select('sku brand model color size category frameType pricing inventory')
    .limit(20)
    .sort('brand model');

  res.status(200).json({
    success: true,
    data: frames.map(frame => ({
      id: frame._id,
      sku: frame.sku,
      brand: frame.brand,
      model: frame.model,
      color: frame.color,
      size: frame.size,
      category: frame.category,
      frameType: frame.frameType,
      price: frame.pricing.sellingPrice,
      costPrice: frame.pricing.costPrice,
      available: frame.inventory.currentStock - frame.inventory.reserved,
      status: frame.inventory.status
    }))
  });
});

// @desc    Search contact lenses for order (with parameter matching)
// @route   GET /api/glasses-orders/search-contact-lenses
// @access  Private
exports.searchContactLenses = asyncHandler(async (req, res) => {
  const { query, power, baseCurve, diameter, cylinder, axis, lensType } = req.query;

  const searchQuery = {
    isActive: true,
    'inventory.status': { $in: ['in-stock', 'low-stock'] }
  };

  if (query) {
    searchQuery.$or = [
      { brand: { $regex: query, $options: 'i' } },
      { productLine: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } }
    ];
  }

  if (lensType) searchQuery.lensType = lensType;
  if (baseCurve) searchQuery['parameters.baseCurve'] = parseFloat(baseCurve);
  if (diameter) searchQuery['parameters.diameter'] = parseFloat(diameter);

  // For power, check if the value is in range
  if (power) {
    const powerVal = parseFloat(power);
    searchQuery.$and = searchQuery.$and || [];
    searchQuery.$and.push({
      $or: [
        { 'parameters.power.from': { $lte: powerVal }, 'parameters.power.to': { $gte: powerVal } },
        { 'parameters.power': powerVal }
      ]
    });
  }

  // For toric lenses
  if (cylinder) searchQuery['parameters.cylinder'] = parseFloat(cylinder);
  if (axis) searchQuery['parameters.axis'] = parseInt(axis);

  const lenses = await ContactLensInventory.find(searchQuery)
    .select('sku brand productLine parameters lensType wearSchedule packSize pricing inventory')
    .limit(20)
    .sort('brand productLine');

  res.status(200).json({
    success: true,
    data: lenses.map(lens => ({
      id: lens._id,
      sku: lens.sku,
      brand: lens.brand,
      productLine: lens.productLine,
      parameters: lens.parameters,
      lensType: lens.lensType,
      wearSchedule: lens.wearSchedule,
      packSize: lens.packSize,
      price: lens.pricing.sellingPrice,
      costPrice: lens.pricing.costPrice,
      available: lens.inventory.currentStock - lens.inventory.reserved,
      status: lens.inventory.status
    }))
  });
});

// @desc    Get order with full inventory details
// @route   GET /api/glasses-orders/:id/with-inventory
// @access  Private
exports.getOrderWithInventory = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth phoneNumber email')
    .populate('exam')
    .populate('orderedBy', 'firstName lastName')
    .populate('invoice')
    .populate('glasses.frame.inventoryItem', 'sku brand model color size pricing inventory')
    .populate('contactLenses.od.inventoryItem', 'sku brand productLine parameters pricing inventory')
    .populate('contactLenses.os.inventoryItem', 'sku brand productLine parameters pricing inventory');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// ============================================
// QC WORKFLOW ENDPOINTS
// ============================================

// @desc    Receive order from lab (mark as received, start QC)
// @route   PUT /api/glasses-orders/:id/receive
// @access  Private (Staff)
exports.receiveFromLab = asyncHandler(async (req, res) => {
  const { notes, labOrderReference } = req.body;

  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Validate current status
  if (order.status !== 'in-production') {
    return res.status(400).json({
      success: false,
      error: `Cannot receive order in ${order.status} status. Order must be in-production.`
    });
  }

  // Update status and QC data
  order.status = 'received';
  order.qualityControl = order.qualityControl || {};
  order.qualityControl.receivedAt = new Date();
  order.qualityControl.receivedBy = req.user._id || req.user.id;
  order.qualityControl.receivedNotes = notes;
  order.qualityControl.status = 'pending';

  if (labOrderReference) {
    order.lab = order.lab || {};
    order.lab.orderReference = labOrderReference;
  }

  await order.save();

  // Audit log
  await AuditLog.create({
    user: req.user._id || req.user.id,
    action: 'GLASSES_ORDER_RECEIVED',
    resource: `/api/glasses-orders/${order._id}/receive`,
    ipAddress: req.ip,
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      notes
    }
  });

  res.status(200).json({
    success: true,
    message: 'Order received from lab. Ready for QC inspection.',
    data: order
  });
});

// @desc    Perform QC inspection
// @route   PUT /api/glasses-orders/:id/qc
// @access  Private (Staff, Optician)
exports.performQC = asyncHandler(async (req, res) => {
  const {
    checklist,
    issues,
    overallNotes,
    passed
  } = req.body;

  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName phone email');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Validate current status
  if (!['received', 'qc-failed'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot perform QC on order in ${order.status} status. Order must be received or qc-failed.`
    });
  }

  // Update QC data
  order.qualityControl = order.qualityControl || {};
  order.qualityControl.inspectedAt = new Date();
  order.qualityControl.inspectedBy = req.user._id || req.user.id;
  order.qualityControl.overallNotes = overallNotes;

  // Update checklist
  if (checklist) {
    order.qualityControl.checklist = {
      lensClarity: checklist.lensClarity || { passed: false, notes: '' },
      prescriptionAccuracy: checklist.prescriptionAccuracy || { passed: false, notes: '' },
      frameCondition: checklist.frameCondition || { passed: false, notes: '' },
      coatingsApplied: checklist.coatingsApplied || { passed: false, notes: '' },
      fitAndAlignment: checklist.fitAndAlignment || { passed: false, notes: '' },
      cleanlinessPackaging: checklist.cleanlinessPackaging || { passed: false, notes: '' }
    };
  }

  // Record issues if any
  if (issues && issues.length > 0) {
    order.qualityControl.issues = issues.map(issue => ({
      category: issue.category,
      description: issue.description,
      severity: issue.severity || 'minor',
      resolution: issue.resolution,
      resolvedAt: issue.resolved ? new Date() : null,
      resolvedBy: issue.resolved ? (req.user._id || req.user.id) : null
    }));
  }

  // Determine QC result
  if (passed) {
    order.status = 'qc-passed';
    order.qualityControl.status = 'passed';
  } else {
    order.status = 'qc-failed';
    order.qualityControl.status = 'failed';
  }

  await order.save();

  // Audit log
  await AuditLog.create({
    user: req.user._id || req.user.id,
    action: passed ? 'GLASSES_ORDER_QC_PASSED' : 'GLASSES_ORDER_QC_FAILED',
    resource: `/api/glasses-orders/${order._id}/qc`,
    ipAddress: req.ip,
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      passed,
      issues: issues?.length || 0
    }
  });

  res.status(200).json({
    success: true,
    message: passed ? 'QC passed. Order can be marked as ready.' : 'QC failed. Issues recorded.',
    data: order
  });
});

// @desc    Override failed QC (manager approval)
// @route   PUT /api/glasses-orders/:id/qc-override
// @access  Private (Admin, Manager)
exports.qcOverride = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Override reason is required (minimum 10 characters)'
    });
  }

  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Validate current status
  if (order.status !== 'qc-failed') {
    return res.status(400).json({
      success: false,
      error: `Cannot override QC for order in ${order.status} status. Order must have failed QC.`
    });
  }

  // Record override
  order.qualityControl = order.qualityControl || {};
  order.qualityControl.overrideApproved = true;
  order.qualityControl.overrideReason = reason;
  order.qualityControl.overrideBy = req.user._id || req.user.id;
  order.qualityControl.overrideAt = new Date();
  order.qualityControl.status = 'passed'; // Mark as passed via override

  // Move to ready
  order.status = 'ready';
  order.timeline = order.timeline || {};
  order.timeline.readyAt = new Date();

  await order.save();

  // Send ready notification
  try {
    if (order.patient) {
      await notificationFacade.sendGlassesReadyNotification(order, order.patient);
    }
  } catch (notifError) {
    console.error('[GlassesOrder] Notification error:', notifError.message);
  }

  // Audit log with special flag for override
  await AuditLog.create({
    user: req.user._id || req.user.id,
    action: 'GLASSES_ORDER_QC_OVERRIDE',
    resource: `/api/glasses-orders/${order._id}/qc-override`,
    ipAddress: req.ip,
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      overrideReason: reason,
      critical: true
    }
  });

  res.status(200).json({
    success: true,
    message: 'QC override approved. Order marked as ready.',
    data: order
  });
});

// @desc    Record delivery with proof (signature/photo)
// @route   PUT /api/glasses-orders/:id/deliver
// @access  Private (Staff)
exports.recordDelivery = asyncHandler(async (req, res) => {
  const {
    recipientName,
    recipientRelationship,
    idVerified,
    signatureDataUrl,
    photoUrl,
    notes,
    deliveryMethod
  } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id)
      .populate('patient', 'firstName lastName phone email')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Validate current status
    if (order.status !== 'ready') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: `Cannot deliver order in ${order.status} status. Order must be ready.`
      });
    }

    // CRITICAL FIX: Require signature or photo proof for delivery confirmation
    // This ensures proper documentation of handover
    if (!signatureDataUrl && !photoUrl) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: 'Delivery confirmation requires either a signature or photo proof'
      });
    }

    // Require recipient name for accountability
    if (!recipientName) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: 'Recipient name is required for delivery'
      });
    }

    // Record delivery details
    order.delivery = {
      method: deliveryMethod || 'pickup',
      completedAt: new Date(),
      completedBy: req.user._id || req.user.id,
      recipient: {
        name: recipientName || `${order.patient.firstName} ${order.patient.lastName}`,
        relationship: recipientRelationship || 'self',
        idVerified: idVerified || false
      },
      notes
    };

    // Record signature if provided
    if (signatureDataUrl) {
      order.delivery.signature = {
        dataUrl: signatureDataUrl,
        capturedAt: new Date()
      };
    }

    // Record photo if provided
    if (photoUrl) {
      order.delivery.photo = {
        url: photoUrl,
        capturedAt: new Date()
      };
    }

    // Update status
    order.status = 'delivered';
    order.timeline = order.timeline || {};
    order.timeline.deliveredAt = new Date();

    // Fulfill inventory
    let totalCost = 0;
    let totalRevenue = 0;

    // Fulfill frame
    if (order.glasses?.frame?.inventoryItem && order.glasses?.frame?.reservationId) {
      const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
      if (frame) {
        await frame.fulfillReservation(
          order.glasses.frame.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        totalCost += frame.pricing.costPrice || 0;
        totalRevenue += order.glasses.frame.sellingPrice || frame.pricing.sellingPrice || 0;
      }
    }

    // Fulfill contact lenses
    if (order.contactLenses?.od?.inventoryItem && order.contactLenses?.od?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
      if (lens) {
        await lens.fulfillReservation(
          order.contactLenses.od.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        const qty = order.contactLenses.od.quantity || 1;
        totalCost += (lens.pricing.costPrice || 0) * qty;
        totalRevenue += (order.contactLenses.od.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
      }
    }

    if (order.contactLenses?.os?.inventoryItem && order.contactLenses?.os?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
      if (lens) {
        await lens.fulfillReservation(
          order.contactLenses.os.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        const qty = order.contactLenses.os.quantity || 1;
        totalCost += (lens.pricing.costPrice || 0) * qty;
        totalRevenue += (order.contactLenses.os.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
      }
    }

    // Update cost tracking
    order.costTracking = {
      frameCost: order.glasses?.frame?.costPrice || 0,
      contactsOdCost: (order.contactLenses?.od?.costPrice || 0) * (order.contactLenses?.od?.quantity || 1),
      contactsOsCost: (order.contactLenses?.os?.costPrice || 0) * (order.contactLenses?.os?.quantity || 1),
      totalCost,
      totalRevenue,
      margin: totalRevenue - totalCost,
      marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0
    };

    await order.save({ session });
    await session.commitTransaction();

    // Send delivery notification
    try {
      if (order.patient) {
        await notificationFacade.sendGlassesDeliveredNotification(order, order.patient);
      }
    } catch (notifError) {
      console.error('[GlassesOrder] Notification error:', notifError.message);
    }

    // Audit log
    await AuditLog.create({
      user: req.user._id || req.user.id,
      action: 'GLASSES_ORDER_DELIVERED',
      resource: `/api/glasses-orders/${order._id}/deliver`,
      ipAddress: req.ip,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        recipientName: order.delivery.recipient.name,
        recipientRelationship: order.delivery.recipient.relationship,
        hasSignature: !!signatureDataUrl,
        hasPhoto: !!photoUrl
      }
    });

    res.status(200).json({
      success: true,
      message: 'Order delivered successfully. Patient notified.',
      data: order
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Get orders pending QC
// @route   GET /api/glasses-orders/pending-qc
// @access  Private
exports.getPendingQC = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({
    status: { $in: ['received', 'qc-failed'] }
  })
    .populate('patient', 'firstName lastName')
    .populate('orderedBy', 'firstName lastName')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get orders ready for pickup
// @route   GET /api/glasses-orders/ready-for-pickup
// @access  Private
exports.getReadyForPickup = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({
    status: 'ready'
  })
    .populate('patient', 'firstName lastName phoneNumber email')
    .populate('orderedBy', 'firstName lastName')
    .sort('timeline.readyAt'); // Oldest first

  // Calculate days since ready for each order
  const ordersWithDays = orders.map(order => {
    const orderObj = order.toObject();
    if (order.timeline?.readyAt) {
      const daysSinceReady = Math.floor(
        (Date.now() - new Date(order.timeline.readyAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      orderObj.daysSinceReady = daysSinceReady;
      orderObj.needsReminder = daysSinceReady >= 3; // Flag if waiting 3+ days
    }
    return orderObj;
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: ordersWithDays
  });
});

// @desc    Send pickup reminder to patient
// @route   POST /api/glasses-orders/:id/send-reminder
// @access  Private
exports.sendPickupReminder = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName phone email');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  if (order.status !== 'ready') {
    return res.status(400).json({
      success: false,
      error: 'Can only send reminders for orders that are ready'
    });
  }

  // Calculate days since ready
  const daysSinceReady = order.timeline?.readyAt
    ? Math.floor((Date.now() - new Date(order.timeline.readyAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Send reminder
  const result = await notificationFacade.sendGlassesPickupReminder(order, order.patient, daysSinceReady);

  res.status(200).json({
    success: true,
    message: 'Pickup reminder sent',
    data: {
      orderNumber: order.orderNumber,
      daysSinceReady,
      notification: result
    }
  });
});

// ============================================
// EXTERNAL LAB INTEGRATION
// ============================================

// @desc    Export order to external lab
// @route   POST /api/glasses-orders/:id/export-to-lab
// @access  Private
exports.exportToLab = asyncHandler(async (req, res) => {
  const { labId, labName, labEmail, labPhone, format = 'json', sendEmail = false } = req.body;

  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth phone email patientId')
    .populate('exam')
    .populate('orderedBy', 'firstName lastName title');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  if (!['confirmed', 'sent-to-lab'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: 'Order must be confirmed before exporting to lab'
    });
  }

  // Build export data structure
  const exportData = {
    orderInfo: {
      orderNumber: order.orderNumber,
      priority: order.priority,
      estimatedDelivery: order.estimatedDelivery,
      orderDate: order.createdAt,
      notes: order.notes?.production || ''
    },
    patient: {
      id: order.patient.patientId,
      name: `${order.patient.firstName} ${order.patient.lastName}`,
      dateOfBirth: order.patient.dateOfBirth,
      phone: order.patient.phone
    },
    prescription: {
      od: order.prescriptionData?.od,
      os: order.prescriptionData?.os,
      pd: order.prescriptionData?.pd
    },
    glasses: order.glasses,
    orderingPhysician: order.orderedBy ?
      `${order.orderedBy.title || 'Dr.'} ${order.orderedBy.firstName} ${order.orderedBy.lastName}` : null,
    exportedAt: new Date().toISOString(),
    format
  };

  // Generate formatted export based on format type
  let formattedExport;
  switch (format) {
    case 'edi':
      // Simple EDI-like format for optical labs
      formattedExport = generateEDIFormat(exportData);
      break;
    case 'csv':
      formattedExport = generateCSVFormat(exportData);
      break;
    case 'xml':
      formattedExport = generateXMLFormat(exportData);
      break;
    default:
      formattedExport = exportData;
  }

  // Update order with export info
  order.externalLab = {
    exported: true,
    exportedAt: new Date(),
    exportedBy: req.user._id,
    exportFormat: format,
    labId,
    labName,
    labEmail,
    labPhone,
    labStatus: 'pending',
    exportData: exportData,
    statusHistory: [{
      status: 'exported',
      timestamp: new Date(),
      notes: `Exported in ${format} format to ${labName || 'external lab'}`
    }]
  };

  // Update status if not already sent to lab
  if (order.status === 'confirmed') {
    order.status = 'sent-to-lab';
    order.timeline.sentToLabAt = new Date();
  }

  await order.save();

  // Optionally send email to lab
  if (sendEmail && labEmail) {
    try {
      await notificationFacade.sendEmailDirect({
        to: labEmail,
        subject: `New Glasses Order: ${order.orderNumber}`,
        html: `
          <h2>New Glasses Order Received</h2>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Patient:</strong> ${exportData.patient.name}</p>
          <p><strong>Priority:</strong> ${order.priority}</p>
          <p><strong>Lens Type:</strong> ${order.glasses?.lensType || 'N/A'}</p>
          <h3>Prescription</h3>
          <p><strong>OD:</strong> Sph: ${exportData.prescription.od?.sphere || '0'}, Cyl: ${exportData.prescription.od?.cylinder || '0'}, Axis: ${exportData.prescription.od?.axis || '0'}</p>
          <p><strong>OS:</strong> Sph: ${exportData.prescription.os?.sphere || '0'}, Cyl: ${exportData.prescription.os?.cylinder || '0'}, Axis: ${exportData.prescription.os?.axis || '0'}</p>
          <p><strong>PD:</strong> ${exportData.prescription.pd?.binocular || 'N/A'}mm</p>
          <hr/>
          <p>Please confirm receipt of this order.</p>
        `
      });
    } catch (emailError) {
      console.error('[GlassesOrder] Error sending export email:', emailError);
    }
  }

  res.status(200).json({
    success: true,
    message: `Order exported successfully${sendEmail ? ' and email sent' : ''}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      exportFormat: format,
      exportedAt: order.externalLab.exportedAt,
      labName: labName || 'External Lab',
      export: formattedExport
    }
  });
});

// @desc    Get export data for an order in specified format
// @route   GET /api/glasses-orders/:id/export-data
// @access  Private
exports.getExportData = asyncHandler(async (req, res) => {
  const { format = 'json' } = req.query;

  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth phone email patientId')
    .populate('exam')
    .populate('orderedBy', 'firstName lastName title');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  const exportData = {
    orderInfo: {
      orderNumber: order.orderNumber,
      priority: order.priority,
      estimatedDelivery: order.estimatedDelivery,
      orderDate: order.createdAt,
      notes: order.notes?.production || ''
    },
    patient: {
      id: order.patient.patientId,
      name: `${order.patient.firstName} ${order.patient.lastName}`,
      dateOfBirth: order.patient.dateOfBirth,
      phone: order.patient.phone
    },
    prescription: {
      od: order.prescriptionData?.od,
      os: order.prescriptionData?.os,
      pd: order.prescriptionData?.pd
    },
    glasses: order.glasses,
    orderingPhysician: order.orderedBy ?
      `${order.orderedBy.title || 'Dr.'} ${order.orderedBy.firstName} ${order.orderedBy.lastName}` : null
  };

  let formattedExport;
  switch (format) {
    case 'edi':
      formattedExport = generateEDIFormat(exportData);
      res.set('Content-Type', 'text/plain');
      res.set('Content-Disposition', `attachment; filename="${order.orderNumber}.edi"`);
      return res.send(formattedExport);
    case 'csv':
      formattedExport = generateCSVFormat(exportData);
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', `attachment; filename="${order.orderNumber}.csv"`);
      return res.send(formattedExport);
    case 'xml':
      formattedExport = generateXMLFormat(exportData);
      res.set('Content-Type', 'application/xml');
      res.set('Content-Disposition', `attachment; filename="${order.orderNumber}.xml"`);
      return res.send(formattedExport);
    default:
      return res.status(200).json({
        success: true,
        data: exportData
      });
  }
});

// @desc    Update lab status from external callback
// @route   PUT /api/glasses-orders/:id/lab-status
// @access  Private
exports.updateLabStatus = asyncHandler(async (req, res) => {
  const {
    labOrderNumber,
    labStatus,
    trackingNumber,
    shippingMethod,
    estimatedArrival,
    notes
  } = req.body;

  const order = await GlassesOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  if (!order.externalLab?.exported) {
    return res.status(400).json({
      success: false,
      error: 'Order has not been exported to external lab'
    });
  }

  // Update external lab info
  if (labOrderNumber) order.externalLab.labOrderNumber = labOrderNumber;
  if (labStatus) order.externalLab.labStatus = labStatus;
  if (trackingNumber) order.externalLab.trackingNumber = trackingNumber;
  if (shippingMethod) order.externalLab.shippingMethod = shippingMethod;
  if (estimatedArrival) order.externalLab.estimatedArrival = new Date(estimatedArrival);

  order.externalLab.lastStatusUpdate = new Date();
  order.externalLab.statusHistory.push({
    status: labStatus,
    timestamp: new Date(),
    notes: notes || `Status updated to: ${labStatus}`
  });

  // Update order status based on lab status
  if (labStatus === 'shipped' && order.status === 'sent-to-lab') {
    order.status = 'in-production';
    order.timeline.productionStartedAt = new Date();
  } else if (labStatus === 'delivered' && order.status !== 'received') {
    // Lab marked as delivered means we should receive it
    order.externalLab.actualArrival = new Date();
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: 'Lab status updated',
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      labStatus: order.externalLab.labStatus,
      orderStatus: order.status
    }
  });
});

// @desc    Get orders pending export to lab
// @route   GET /api/glasses-orders/pending-export
// @access  Private
exports.getPendingExport = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({
    status: 'confirmed',
    'externalLab.exported': { $ne: true }
  })
    .populate('patient', 'firstName lastName phone')
    .populate('orderedBy', 'firstName lastName')
    .sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get orders with pending lab status updates
// @route   GET /api/glasses-orders/awaiting-lab
// @access  Private
exports.getAwaitingFromLab = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({
    'externalLab.exported': true,
    'externalLab.labStatus': { $in: ['pending', 'acknowledged', 'in-production', 'shipped'] },
    status: { $in: ['sent-to-lab', 'in-production'] }
  })
    .populate('patient', 'firstName lastName phone')
    .populate('orderedBy', 'firstName lastName')
    .sort({ 'externalLab.exportedAt': 1 });

  // Calculate days waiting
  const ordersWithDays = orders.map(order => {
    const orderObj = order.toObject();
    const exportedAt = order.externalLab?.exportedAt;
    if (exportedAt) {
      orderObj.daysWaiting = Math.floor((Date.now() - new Date(exportedAt).getTime()) / (1000 * 60 * 60 * 24));
    }
    return orderObj;
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: ordersWithDays
  });
});

// Helper functions for export formats
function generateEDIFormat(data) {
  // Simple EDI-like format for optical labs
  const lines = [];
  lines.push(`ST*850*${data.orderInfo.orderNumber}~`);
  lines.push(`BEG*00*NE*${data.orderInfo.orderNumber}**${formatDate(data.orderInfo.orderDate)}~`);
  lines.push(`N1*BT*${data.patient.name}~`);
  lines.push(`PER*BD*${data.patient.phone}~`);

  // OD prescription
  if (data.prescription.od) {
    lines.push(`LIN*1*SK*OD~`);
    lines.push(`PO1*1*1*EA***SPH*${data.prescription.od.sphere || 0}*CYL*${data.prescription.od.cylinder || 0}*AXIS*${data.prescription.od.axis || 0}~`);
  }

  // OS prescription
  if (data.prescription.os) {
    lines.push(`LIN*2*SK*OS~`);
    lines.push(`PO1*2*1*EA***SPH*${data.prescription.os.sphere || 0}*CYL*${data.prescription.os.cylinder || 0}*AXIS*${data.prescription.os.axis || 0}~`);
  }

  // PD
  if (data.prescription.pd) {
    lines.push(`MEA*PD**${data.prescription.pd.binocular || 'N/A'}~`);
  }

  // Lens info
  if (data.glasses) {
    lines.push(`ITD*${data.glasses.lensType || 'SV'}*${data.glasses.lensMaterial || 'CR39'}~`);
    if (data.glasses.coatings?.length) {
      lines.push(`MSG*COATINGS:${data.glasses.coatings.join(',')}~`);
    }
  }

  lines.push(`CTT*2~`);
  lines.push(`SE*${lines.length + 1}*${data.orderInfo.orderNumber}~`);

  return lines.join('\n');
}

function generateCSVFormat(data) {
  const headers = [
    'Order Number', 'Order Date', 'Priority', 'Patient Name', 'Patient DOB', 'Patient Phone',
    'OD Sphere', 'OD Cylinder', 'OD Axis', 'OD Add',
    'OS Sphere', 'OS Cylinder', 'OS Axis', 'OS Add',
    'PD Binocular', 'PD OD', 'PD OS',
    'Lens Type', 'Lens Material', 'Coatings', 'Tint',
    'Frame Brand', 'Frame Model', 'Frame Color',
    'Ordering Physician', 'Notes'
  ];

  const values = [
    data.orderInfo.orderNumber,
    formatDate(data.orderInfo.orderDate),
    data.orderInfo.priority,
    data.patient.name,
    formatDate(data.patient.dateOfBirth),
    data.patient.phone || '',
    data.prescription.od?.sphere || '',
    data.prescription.od?.cylinder || '',
    data.prescription.od?.axis || '',
    data.prescription.od?.add || '',
    data.prescription.os?.sphere || '',
    data.prescription.os?.cylinder || '',
    data.prescription.os?.axis || '',
    data.prescription.os?.add || '',
    data.prescription.pd?.binocular || '',
    data.prescription.pd?.monocularOd || '',
    data.prescription.pd?.monocularOs || '',
    data.glasses?.lensType || '',
    data.glasses?.lensMaterial || '',
    (data.glasses?.coatings || []).join(';'),
    data.glasses?.tint || '',
    data.glasses?.frame?.brand || '',
    data.glasses?.frame?.model || '',
    data.glasses?.frame?.color || '',
    data.orderingPhysician || '',
    data.orderInfo.notes || ''
  ];

  return headers.join(',') + '\n' + values.map(v => `"${v}"`).join(',');
}

function generateXMLFormat(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<GlassesOrder>
  <OrderInfo>
    <OrderNumber>${data.orderInfo.orderNumber}</OrderNumber>
    <OrderDate>${formatDate(data.orderInfo.orderDate)}</OrderDate>
    <Priority>${data.orderInfo.priority}</Priority>
  </OrderInfo>
  <Patient>
    <ID>${data.patient.id}</ID>
    <Name>${escapeXml(data.patient.name)}</Name>
    <DOB>${formatDate(data.patient.dateOfBirth)}</DOB>
    <Phone>${data.patient.phone || ''}</Phone>
  </Patient>
  <Prescription>
    <OD>
      <Sphere>${data.prescription.od?.sphere || 0}</Sphere>
      <Cylinder>${data.prescription.od?.cylinder || 0}</Cylinder>
      <Axis>${data.prescription.od?.axis || 0}</Axis>
      <Add>${data.prescription.od?.add || ''}</Add>
    </OD>
    <OS>
      <Sphere>${data.prescription.os?.sphere || 0}</Sphere>
      <Cylinder>${data.prescription.os?.cylinder || 0}</Cylinder>
      <Axis>${data.prescription.os?.axis || 0}</Axis>
      <Add>${data.prescription.os?.add || ''}</Add>
    </OS>
    <PD>
      <Binocular>${data.prescription.pd?.binocular || ''}</Binocular>
      <MonocularOD>${data.prescription.pd?.monocularOd || ''}</MonocularOD>
      <MonocularOS>${data.prescription.pd?.monocularOs || ''}</MonocularOS>
    </PD>
  </Prescription>
  <Glasses>
    <LensType>${data.glasses?.lensType || ''}</LensType>
    <LensMaterial>${data.glasses?.lensMaterial || ''}</LensMaterial>
    <Coatings>${(data.glasses?.coatings || []).join(',')}</Coatings>
    <Frame>
      <Brand>${escapeXml(data.glasses?.frame?.brand || '')}</Brand>
      <Model>${escapeXml(data.glasses?.frame?.model || '')}</Model>
      <Color>${escapeXml(data.glasses?.frame?.color || '')}</Color>
    </Frame>
  </Glasses>
  <OrderingPhysician>${escapeXml(data.orderingPhysician || '')}</OrderingPhysician>
  <Notes>${escapeXml(data.orderInfo.notes || '')}</Notes>
</GlassesOrder>`;
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
