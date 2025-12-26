const mongoose = require('mongoose');
const Counter = require('./Counter');

const glassesOrderSchema = new mongoose.Schema({
  // Order identification
  orderNumber: {
    type: String,
    unique: true
  },

  // Links to related records
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OphthalmologyExam'
    // Not required - orders can come from prescriptions or manual entry
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Not required for draft orders - set when confirmed
  },

  // Order type
  orderType: {
    type: String,
    enum: ['glasses', 'contact-lenses', 'both'],
    default: 'glasses'
  },

  // Prescription data (from exam)
  prescriptionData: {
    od: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      add: Number,
      prism: Number,
      prismBase: String,
      visualAcuity: String
    },
    os: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      add: Number,
      prism: Number,
      prismBase: String,
      visualAcuity: String
    },
    pd: {
      binocular: Number,
      monocularOd: Number,
      monocularOs: Number
    }
  },

  // Glasses specifications
  glasses: {
    lensType: {
      type: String,
      enum: ['single-vision-distance', 'single-vision-near', 'bifocal', 'progressive', 'varifocal', 'two-pairs']
    },
    lensMaterial: {
      type: String,
      enum: ['cr39', 'polycarbonate', 'trivex', 'hi-index-1.60', 'hi-index-1.67', 'hi-index-1.74']
    },
    coatings: [{
      type: String,
      enum: ['anti-reflective', 'blue-light', 'photochromic', 'polarized', 'scratch-resistant', 'uv-protection', 'hydrophobic']
    }],
    tint: {
      type: String,
      enum: ['clear', 'gradient', 'solid', 'mirror']
    },
    tintColor: String,

    // Lens inventory integration (links to unified Inventory for stock tracking)
    lens: {
      // Inventory integration - linked to unified Inventory (optical_lens type)
      inventoryItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory'
      },
      sku: String,
      reservationId: String,
      costPrice: Number, // Captured at order time for margin tracking
      sellingPrice: Number,
      // Source of lens
      source: {
        type: String,
        enum: ['inventory', 'special-order', 'external-lab', 'manual'],
        default: 'inventory'
      },
      // Detailed specs (captured from inventory or manually entered)
      brand: String,
      productLine: String,
      material: String,
      design: String,
      coatings: [String],
      isPhotochromic: Boolean,
      photochromicType: String,
      isPolarized: Boolean,
      refractiveIndex: Number
    },

    frame: {
      brand: String,
      model: String,
      color: String,
      size: String,
      material: String,
      // Inventory integration - unified Inventory (frame type)
      inventoryItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory'
      },
      sku: String,
      reservationId: String,
      costPrice: Number, // Captured at order time for margin tracking
      sellingPrice: Number
    }
  },

  // Contact lens specifications
  contactLenses: {
    od: {
      brand: String,
      baseCurve: Number,
      diameter: Number,
      power: Number,
      cylinder: Number,
      axis: Number,
      color: String,
      // Inventory integration - unified Inventory (contact_lens type)
      inventoryItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory'
      },
      sku: String,
      reservationId: String,
      costPrice: Number,
      sellingPrice: Number
    },
    os: {
      brand: String,
      baseCurve: Number,
      diameter: Number,
      power: Number,
      cylinder: Number,
      axis: Number,
      color: String,
      // Inventory integration - unified Inventory (contact_lens type)
      inventoryItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory'
      },
      sku: String,
      reservationId: String,
      costPrice: Number,
      sellingPrice: Number
    },
    wearSchedule: {
      type: String,
      enum: ['daily', 'bi-weekly', 'monthly', 'extended']
    },
    boxQuantity: {
      od: { type: Number, default: 1 },
      os: { type: Number, default: 1 }
    }
  },

  // Frame try-on photos for customer visualization
  frameTryOnPhotos: [{
    frameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory' // Unified inventory (frame type)
    },
    frameName: {
      type: String,
      trim: true
    },
    frontPhoto: {
      path: String,
      url: String,
      filename: String,
      capturedAt: Date,
      capturedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    sidePhoto: {
      path: String,
      url: String,
      filename: String,
      capturedAt: Date,
      capturedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    isSelectedFrame: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Order status workflow
  // Flow: draft → pending_verification → verified → confirmed → sent-to-lab → in-production → received → qc-passed → ready → delivered
  //                      ↓                                                                        ↓
  //              verification_rejected                                                       qc-failed → (rework or return to lab)
  status: {
    type: String,
    enum: [
      'draft',                    // Initial order creation by optician
      'pending_verification',     // Submitted for technician verification
      'verified',                 // Technician approved, ready for payment
      'verification_rejected',    // Technician rejected, needs correction
      'confirmed',                // Paid, inventory reserved
      'sent-to-lab',              // Sent to external lab for fabrication
      'in-production',            // Lab is producing the glasses
      'received',                 // Received from lab, awaiting QC
      'qc-passed',                // Quality control passed
      'qc-failed',                // Quality control failed
      'ready',                    // Ready for patient pickup/delivery
      'delivered',                // Delivered to patient
      'cancelled'                 // Order cancelled
    ],
    default: 'draft'
  },

  // Priority
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'rush'],
    default: 'normal'
  },

  // Timeline tracking
  timeline: {
    createdAt: { type: Date, default: Date.now },
    confirmedAt: Date,
    sentToLabAt: Date,
    productionStartedAt: Date,
    readyAt: Date,
    deliveredAt: Date,
    cancelledAt: Date
  },

  // Estimated delivery
  estimatedDelivery: Date,

  // Lab/Supplier information
  lab: {
    name: String,
    orderReference: String,
    contactInfo: String
  },

  // External Lab Integration
  externalLab: {
    // Export status
    exported: { type: Boolean, default: false },
    exportedAt: Date,
    exportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    exportFormat: {
      type: String,
      enum: ['json', 'edi', 'xml', 'pdf', 'csv'],
      default: 'json'
    },

    // External lab details
    labId: String,
    labName: String,
    labEmail: String,
    labPhone: String,

    // Tracking
    labOrderNumber: String,
    trackingNumber: String,
    labStatus: {
      type: String,
      enum: ['pending', 'acknowledged', 'in-production', 'shipped', 'delivered', 'cancelled', 'on-hold'],
      default: 'pending'
    },

    // Communication
    lastStatusUpdate: Date,
    statusHistory: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      notes: String
    }],

    // Shipping
    shippingMethod: String,
    shippedAt: Date,
    estimatedArrival: Date,
    actualArrival: Date,

    // Export data snapshot (for audit)
    exportData: mongoose.Schema.Types.Mixed,

    // Error handling
    exportError: String,
    retryCount: { type: Number, default: 0 }
  },

  // Pricing
  items: [{
    description: String,
    category: {
      type: String,
      enum: ['lens', 'frame', 'coating', 'contact-lens', 'accessory', 'service']
    },
    quantity: { type: Number, default: 1 },
    unitPrice: Number,
    discount: { type: Number, default: 0 },
    total: Number
  }],

  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },

  // Payment tracking
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'refunded'],
    default: 'unpaid'
  },
  amountPaid: { type: Number, default: 0 },

  // Patient contact for delivery
  deliveryInfo: {
    method: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: 'pickup'
    },
    address: String,
    phone: String,
    instructions: String
  },

  // Notes
  notes: {
    clinical: String,
    production: String,
    internal: String
  },

  // Notifications
  notifications: [{
    type: {
      type: String,
      enum: ['confirmed', 'sent-to-lab', 'ready', 'delivered', 'pickup_reminder', 'sms', 'email', 'call']
    },
    sentAt: Date,
    message: String,
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending']
    },
    channels: {
      sms: Boolean,
      email: Boolean
    }
  }],

  // ============================================
  // QC/RECEIVING WORKFLOW
  // ============================================

  qualityControl: {
    // Receiving from lab
    receivedAt: Date,
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    receivedNotes: String,

    // Inspection
    inspectedAt: Date,
    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'passed', 'failed', 'rework'],
      default: 'pending'
    },

    // QC Checklist
    checklist: {
      lensClarity: { passed: Boolean, notes: String },
      prescriptionAccuracy: { passed: Boolean, notes: String },
      frameCondition: { passed: Boolean, notes: String },
      coatingsApplied: { passed: Boolean, notes: String },
      fitAndAlignment: { passed: Boolean, notes: String },
      cleanlinessPackaging: { passed: Boolean, notes: String }
    },

    // Issues found during QC
    issues: [{
      category: {
        type: String,
        enum: ['lens', 'frame', 'coating', 'prescription', 'cosmetic', 'packaging', 'other']
      },
      description: String,
      severity: {
        type: String,
        enum: ['minor', 'major', 'critical']
      },
      resolution: String,
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],

    overallNotes: String,

    // Override for failed QC (with manager approval)
    overrideApproved: { type: Boolean, default: false },
    overrideReason: String,
    overrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    overrideAt: Date
  },

  // ============================================
  // DELIVERY PROOF
  // ============================================

  delivery: {
    method: {
      type: String,
      enum: ['pickup', 'delivery', 'shipping']
    },
    scheduledDate: Date,
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // Recipient info
    recipient: {
      name: String,
      relationship: {
        type: String,
        enum: ['self', 'family', 'caregiver', 'other']
      },
      idVerified: Boolean
    },

    // Proof collection
    signature: {
      dataUrl: String, // Base64 signature image
      capturedAt: Date
    },
    photo: {
      url: String, // Storage URL
      capturedAt: Date
    },

    notes: String,

    // For shipping
    trackingNumber: String,
    carrier: String,
    shippedAt: Date
  },

  // Inventory tracking status - using unified Inventory model
  inventoryStatus: {
    frameReserved: { type: Boolean, default: false },
    frameInventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory' // frame type
    },
    frameReservationId: String,

    contactsOdReserved: { type: Boolean, default: false },
    contactsOdInventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory' // contact_lens type
    },
    contactsOdReservationId: String,

    contactsOsReserved: { type: Boolean, default: false },
    contactsOsInventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory' // contact_lens type
    },
    contactsOsReservationId: String,

    allReserved: { type: Boolean, default: false },
    reservedAt: Date,
    fulfilledAt: Date,

    // Source tracking for items not from inventory
    frameSource: {
      type: String,
      enum: ['inventory', 'special-order', 'patient-owned', 'manual'],
      default: 'manual'
    },
    contactsOdSource: {
      type: String,
      enum: ['inventory', 'on-demand', 'special-order', 'manual'],
      default: 'manual'
    },
    contactsOsSource: {
      type: String,
      enum: ['inventory', 'on-demand', 'special-order', 'manual'],
      default: 'manual'
    }
  },

  // Cost tracking for revenue/margin reports
  costTracking: {
    frameCost: { type: Number, default: 0 },
    lensesCost: { type: Number, default: 0 },
    coatingsCost: { type: Number, default: 0 },
    contactLensesCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    margin: Number, // Percentage
    profit: Number  // Absolute value
  },

  // ============================================
  // OPTICAL SHOP WORKFLOW
  // ============================================

  opticalShop: {
    // Sales agent (optician) who created/handled the order
    optician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    opticianName: String, // Denormalized for reports

    // Technician who verified the order
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    technicianName: String,

    // Sales timing for performance tracking
    saleStartedAt: Date,
    saleCompletedAt: Date,
    consultationDuration: Number, // Minutes spent with patient

    // Technician verification workflow
    verification: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'revision_requested'],
        default: 'pending'
      },
      submittedAt: Date,
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reviewedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },

      // Technician verification checklist
      checklist: {
        prescriptionCorrect: {
          checked: { type: Boolean, default: false },
          notes: String
        },
        measurementsCorrect: {
          checked: { type: Boolean, default: false },
          notes: String
        },
        frameCompatible: {
          checked: { type: Boolean, default: false },
          notes: String
        },
        lensTypeAppropriate: {
          checked: { type: Boolean, default: false },
          notes: String
        },
        coatingsValid: {
          checked: { type: Boolean, default: false },
          notes: String
        },
        pricingCorrect: {
          checked: { type: Boolean, default: false },
          notes: String
        }
      },

      notes: String,
      rejectionReason: String,

      // Revision history for tracking back-and-forth
      revisionHistory: [{
        action: {
          type: String,
          enum: ['submitted', 'approved', 'rejected', 'revised', 'resubmitted']
        },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        byName: String,
        at: { type: Date, default: Date.now },
        notes: String
      }]
    }
  },

  // ============================================
  // LENS AVAILABILITY & EXTERNAL ORDERING
  // ============================================

  lensAvailability: {
    // Overall availability status
    status: {
      type: String,
      enum: ['checking', 'available', 'partial', 'needs_order', 'ordered', 'received'],
      default: 'checking'
    },

    // Detailed availability per item
    items: [{
      itemType: {
        type: String,
        enum: ['frame', 'lens-od', 'lens-os', 'contact-od', 'contact-os']
      },
      description: String,
      available: { type: Boolean, default: false },
      inventoryItem: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'lensAvailability.items.inventoryModel'
      },
      inventoryModel: {
        type: String,
        enum: ['FrameInventory', 'OpticalLensInventory', 'ContactLensInventory']
      },
      quantity: { type: Number, default: 1 },
      needsExternalOrder: { type: Boolean, default: false }
    }],

    // External order tracking
    externalOrder: {
      required: { type: Boolean, default: false },
      supplier: String,
      supplierContact: String,
      orderNumber: String,
      orderedAt: Date,
      orderedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      expectedDelivery: Date,
      receivedAt: Date,
      receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['pending', 'ordered', 'confirmed', 'shipped', 'received', 'cancelled'],
        default: 'pending'
      },
      trackingNumber: String,
      cost: Number,
      notes: String,

      // Items being ordered externally
      items: [{
        itemType: String,
        description: String,
        specifications: String,
        quantity: { type: Number, default: 1 },
        unitCost: Number,
        status: {
          type: String,
          enum: ['pending', 'ordered', 'received', 'cancelled'],
          default: 'pending'
        },
        receivedAt: Date
      }],

      // History of status changes
      statusHistory: [{
        status: String,
        at: { type: Date, default: Date.now },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        notes: String
      }]
    },

    // When all items are available
    allAvailable: { type: Boolean, default: false },
    availableAt: Date,
    checkedAt: Date,
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Prescription source tracking (to detect if Rx changed after order)
  prescriptionSource: {
    type: {
      type: String,
      enum: ['exam', 'prescription', 'manual'],
      default: 'manual'
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OphthalmologyExam'
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription'
    },
    copiedAt: Date,
    examUpdatedAt: Date,
    prescriptionHash: String, // Hash of prescription for change detection
    snapshotAt: { type: Date, default: Date.now }
  },

  // ============================================
  // OPTICAL SHOP ORDER DATA
  // Simplified structure for optical shop sales
  // ============================================

  // Right lens prescription values (OD)
  rightLens: {
    sphere: Number,
    cylinder: Number,
    axis: Number,
    add: Number,
    prism: Number,
    prismBase: String
  },

  // Left lens prescription values (OS)
  leftLens: {
    sphere: Number,
    cylinder: Number,
    axis: Number,
    add: Number,
    prism: Number,
    prismBase: String
  },

  // Lens type selection
  lensType: {
    material: {
      type: String,
      enum: ['cr39', 'cr39-1.56', 'polycarbonate', 'trivex', 'hi-index-1.60', 'hi-index-1.67', 'hi-index-1.74'],
      default: 'cr39'
    },
    design: {
      type: String,
      enum: ['single_vision', 'bifocal', 'progressive'],
      default: 'single_vision'
    }
  },

  // Lens options/treatments
  lensOptions: {
    antiReflective: {
      selected: { type: Boolean, default: false },
      coatingType: { type: String },  // renamed from 'type' to avoid Mongoose conflict
      price: { type: Number, default: 0 }
    },
    photochromic: {
      selected: { type: Boolean, default: false },
      coatingType: { type: String },  // renamed from 'type' to avoid Mongoose conflict
      price: { type: Number, default: 0 }
    },
    blueLight: {
      selected: { type: Boolean, default: false },
      price: { type: Number, default: 0 }
    },
    tint: {
      selected: { type: Boolean, default: false },
      color: { type: String },
      price: { type: Number, default: 0 }
    },
    polarized: {
      selected: { type: Boolean, default: false },
      price: { type: Number, default: 0 }
    }
  },

  // Frame selection (simplified for optical shop)
  frame: {
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory' // Unified inventory (frame type)
    },
    brand: String,
    model: String,
    color: String,
    size: String,
    price: { type: Number, default: 0 }
  },

  // Patient measurements
  measurements: {
    pd: Number,        // Total PD
    pdRight: Number,   // Monocular PD right
    pdLeft: Number,    // Monocular PD left
    segmentHeight: Number,  // For bifocal/progressive
    vertexDistance: Number,
    pantoscopicTilt: Number,
    wrapAngle: Number
  },

  // Urgency level
  urgency: {
    type: String,
    enum: ['normal', 'rush', 'urgent'],
    default: 'normal'
  },

  // Pricing for optical shop orders
  pricing: {
    subtotal: { type: Number, default: 0 },
    framePrice: { type: Number, default: 0 },
    lensPrice: { type: Number, default: 0 },
    optionsPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    discountType: {
      type: String,
      enum: ['fixed', 'percent'],
      default: 'fixed'
    },
    discountReason: String,
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    finalTotal: { type: Number, default: 0 },
    // Convention split
    companyPortion: { type: Number, default: 0 },
    patientPortion: { type: Number, default: 0 }
  },

  // Convention billing information
  conventionBilling: {
    hasConvention: { type: Boolean, default: false },
    opticalNotCovered: { type: Boolean, default: false },
    company: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
      name: String,
      conventionCode: String
    },
    coveragePercentage: { type: Number, default: 0 },
    companyPortion: { type: Number, default: 0 },
    patientPortion: { type: Number, default: 0 },
    requiresApproval: { type: Boolean, default: false },
    autoApproved: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ['not_required', 'pending', 'approved', 'rejected'],
      default: 'not_required'
    },
    approvalNumber: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    frameLimit: Number,
    frameOverage: Number,
    additionalDiscount: Number,
    employeeId: String,
    notes: String,
    reason: String
  }

}, {
  timestamps: true
});

// Generate order number before saving
glassesOrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const counterId = Counter.getMonthlyCounterId('glassesOrder');
    const sequence = await Counter.getNextSequence(counterId);
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.orderNumber = `GO-${year}${month}-${sequence.toString().padStart(4, '0')}`;
  }

  // Calculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + (item.total || 0), 0);
    this.total = this.subtotal - (this.discount || 0) + (this.tax || 0);
  }

  // Calculate cost tracking and margins
  if (this.costTracking) {
    this.costTracking.totalCost = (this.costTracking.frameCost || 0) +
      (this.costTracking.lensesCost || 0) +
      (this.costTracking.coatingsCost || 0) +
      (this.costTracking.contactLensesCost || 0);

    if (this.total > 0 && this.costTracking.totalCost > 0) {
      this.costTracking.profit = this.total - this.costTracking.totalCost;
      this.costTracking.margin = ((this.total - this.costTracking.totalCost) / this.total) * 100;
    }
  }

  // Update allReserved status
  if (this.inventoryStatus) {
    const needsFrame = this.orderType === 'glasses' || this.orderType === 'both';
    const needsContacts = this.orderType === 'contact-lenses' || this.orderType === 'both';

    const frameOk = !needsFrame ||
      this.inventoryStatus.frameReserved ||
      this.inventoryStatus.frameSource !== 'inventory';

    const contactsOk = !needsContacts || (
      (this.inventoryStatus.contactsOdReserved || this.inventoryStatus.contactsOdSource !== 'inventory') &&
      (this.inventoryStatus.contactsOsReserved || this.inventoryStatus.contactsOsSource !== 'inventory')
    );

    this.inventoryStatus.allReserved = frameOk && contactsOk;
  }

  next();
});

// Update status timestamps
glassesOrderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case 'confirmed':
        this.timeline.confirmedAt = now;
        break;
      case 'sent-to-lab':
        this.timeline.sentToLabAt = now;
        break;
      case 'in-production':
        this.timeline.productionStartedAt = now;
        break;
      case 'ready':
        this.timeline.readyAt = now;
        break;
      case 'delivered':
        this.timeline.deliveredAt = now;
        break;
      case 'cancelled':
        this.timeline.cancelledAt = now;
        break;
    }
  }
  next();
});

// Virtual for balance due
glassesOrderSchema.virtual('balanceDue').get(function() {
  return this.total - this.amountPaid;
});

// Index for efficient queries
glassesOrderSchema.index({ patient: 1, createdAt: -1 });
glassesOrderSchema.index({ clinic: 1, status: 1, createdAt: -1 });
glassesOrderSchema.index({ clinic: 1, patient: 1, createdAt: -1 });
glassesOrderSchema.index({ exam: 1 });
glassesOrderSchema.index({ status: 1 });
glassesOrderSchema.index({ orderNumber: 1 });
glassesOrderSchema.index({ 'frameTryOnPhotos.frameId': 1 });

module.exports = mongoose.model('GlassesOrder', glassesOrderSchema);
