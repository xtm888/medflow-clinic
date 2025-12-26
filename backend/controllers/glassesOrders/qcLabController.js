/**
 * QC & External Lab Integration Controller
 *
 * Handles:
 * - Status workflow management (with inventory reservation/fulfillment)
 * - Quality Control workflow (receive, inspect, pass/fail, override)
 * - External lab integration (export, status updates, tracking)
 */

const {
  GlassesOrder,
  Patient,
  AuditLog,
  FrameInventory,
  ContactLensInventory,
  OpticalLensInventory,
  mongoose,
  asyncHandler,
  notificationFacade,
  log
} = require('./shared');

// ============================================
// STATUS WORKFLOW (includes inventory management)
// ============================================

/**
 * @desc    Update order status with automatic inventory management
 * @route   PUT /api/glasses-orders/:id/status
 * @access  Private (Staff)
 */
const updateStatus = asyncHandler(async (req, res) => {
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
      order.notes.internal = `${order.notes.internal || ''}\n[${new Date().toISOString()}] ${notes}`;
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
            log.info('Confirmation notification sent', { orderNumber: order.orderNumber });
            break;

          case 'ready':
            // CRITICAL: Patient needs to know glasses are ready
            notificationResult = await notificationFacade.sendGlassesReadyNotification(order, patient);
            log.info('READY notification sent', { orderNumber: order.orderNumber });
            break;

          case 'delivered':
            notificationResult = await notificationFacade.sendGlassesDeliveredNotification(order, patient);
            log.info('Delivery confirmation sent', { orderNumber: order.orderNumber });
            break;
        }
      }
    } catch (notifError) {
      log.error('Notification error (non-blocking)', { error: notifError.message });
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

// ============================================
// QC WORKFLOW FUNCTIONS
// ============================================

/**
 * @desc    Mark order as received from lab (ready for QC)
 * @route   PUT /api/glasses-orders/:id/receive
 * @access  Private (Staff)
 */
const receiveFromLab = asyncHandler(async (req, res) => {
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

/**
 * @desc    Perform QC inspection
 * @route   PUT /api/glasses-orders/:id/qc
 * @access  Private (Staff, Optician)
 */
const performQC = asyncHandler(async (req, res) => {
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

/**
 * @desc    Override failed QC (manager approval)
 * @route   PUT /api/glasses-orders/:id/qc-override
 * @access  Private (Admin, Manager)
 */
const qcOverride = asyncHandler(async (req, res) => {
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
    log.error('Notification error', { error: notifError.message });
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

/**
 * @desc    Record delivery with proof (signature/photo)
 * @route   PUT /api/glasses-orders/:id/deliver
 * @access  Private (Staff)
 */
const recordDelivery = asyncHandler(async (req, res) => {
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
      log.error('Notification error', { error: notifError.message });
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

/**
 * @desc    Get orders pending QC
 * @route   GET /api/glasses-orders/pending-qc
 * @access  Private
 */
const getPendingQC = asyncHandler(async (req, res) => {
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

/**
 * @desc    Get orders ready for pickup
 * @route   GET /api/glasses-orders/ready-for-pickup
 * @access  Private
 */
const getReadyForPickup = asyncHandler(async (req, res) => {
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

/**
 * @desc    Send pickup reminder to patient
 * @route   POST /api/glasses-orders/:id/send-reminder
 * @access  Private
 */
const sendPickupReminder = asyncHandler(async (req, res) => {
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

/**
 * @desc    Export order to external lab
 * @route   POST /api/glasses-orders/:id/export-to-lab
 * @access  Private
 */
const exportToLab = asyncHandler(async (req, res) => {
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
      log.error('Error sending export email', { error: emailError.message });
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

/**
 * @desc    Get export data for an order in specified format
 * @route   GET /api/glasses-orders/:id/export-data
 * @access  Private
 */
const getExportData = asyncHandler(async (req, res) => {
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

/**
 * @desc    Update lab status from external callback
 * @route   PUT /api/glasses-orders/:id/lab-status
 * @access  Private
 */
const updateLabStatus = asyncHandler(async (req, res) => {
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

/**
 * @desc    Get orders pending export to lab
 * @route   GET /api/glasses-orders/pending-export
 * @access  Private
 */
const getPendingExport = asyncHandler(async (req, res) => {
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

/**
 * @desc    Get orders with pending lab status updates
 * @route   GET /api/glasses-orders/awaiting-lab
 * @access  Private
 */
const getAwaitingFromLab = asyncHandler(async (req, res) => {
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

// ============================================
// HELPER FUNCTIONS FOR EXPORT FORMATS
// ============================================

/**
 * Generate EDI-like format for optical labs
 */
function generateEDIFormat(data) {
  const lines = [];
  lines.push(`ST*850*${data.orderInfo.orderNumber}~`);
  lines.push(`BEG*00*NE*${data.orderInfo.orderNumber}**${formatDate(data.orderInfo.orderDate)}~`);
  lines.push(`N1*BT*${data.patient.name}~`);
  lines.push(`PER*BD*${data.patient.phone}~`);

  // OD prescription
  if (data.prescription.od) {
    lines.push('LIN*1*SK*OD~');
    lines.push(`PO1*1*1*EA***SPH*${data.prescription.od.sphere || 0}*CYL*${data.prescription.od.cylinder || 0}*AXIS*${data.prescription.od.axis || 0}~`);
  }

  // OS prescription
  if (data.prescription.os) {
    lines.push('LIN*2*SK*OS~');
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

  lines.push('CTT*2~');
  lines.push(`SE*${lines.length + 1}*${data.orderInfo.orderNumber}~`);

  return lines.join('\n');
}

/**
 * Generate CSV format for optical labs
 */
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

  return `${headers.join(',')}\n${values.map(v => `"${v}"`).join(',')}`;
}

/**
 * Generate XML format for optical labs
 */
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

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  // Status workflow
  updateStatus,

  // QC Workflow
  receiveFromLab,
  performQC,
  qcOverride,
  recordDelivery,
  getPendingQC,
  getReadyForPickup,
  sendPickupReminder,

  // External Lab Integration
  exportToLab,
  getExportData,
  updateLabStatus,
  getPendingExport,
  getAwaitingFromLab
};
