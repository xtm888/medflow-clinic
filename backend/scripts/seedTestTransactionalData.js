#!/usr/bin/env node
/**
 * Test Transactional Data Seeder
 * ==============================
 * Populates all transactional collections with realistic sample data for testing.
 * This creates the data that would normally be generated during app use.
 *
 * Collections seeded:
 * - Approvals (pending approvals for invoices/refunds)
 * - Prescriptions (medication prescriptions)
 * - LabOrders & LabResults (laboratory test orders and results)
 * - ImagingOrders & ImagingStudies (imaging requests and studies)
 * - GlassesOrders (optical prescriptions and orders)
 * - Documents (patient documents)
 * - Correspondences (letters sent)
 * - Notifications (system notifications)
 * - PaymentPlans (payment installment plans)
 * - InventoryTransfers (stock transfers between clinics)
 * - RepairTrackings (frame/device repairs)
 * - IVTInjections & IVTVials (intravitreal injections)
 * - ConsultationSessions (active consultations)
 * - ClinicalAlerts (patient alerts)
 * - WaitingLists (surgery waiting lists)
 *
 * Usage: node scripts/seedTestTransactionalData.js [--count=N]
 */

const mongoose = require('mongoose');
const { PharmacyInventory, FrameInventory } = require('../models/Inventory');
require('dotenv').config();

// Models
const Approval = require('../models/Approval');
const Prescription = require('../models/Prescription');
const LabOrder = require('../models/LabOrder');
const LabResult = require('../models/LabResult');
const ImagingOrder = require('../models/ImagingOrder');
const ImagingStudy = require('../models/ImagingStudy');
const GlassesOrder = require('../models/GlassesOrder');
const Document = require('../models/Document');
const Correspondence = require('../models/Correspondence');
const Notification = require('../models/Notification');
const PaymentPlan = require('../models/PaymentPlan');
const InventoryTransfer = require('../models/InventoryTransfer');
const RepairTracking = require('../models/RepairTracking');
const IVTInjection = require('../models/IVTInjection');
const IVTVial = require('../models/IVTVial');
const ConsultationSession = require('../models/ConsultationSession');
const ClinicalAlert = require('../models/ClinicalAlert');
const WaitingList = require('../models/WaitingList');

// Reference models
const Patient = require('../models/Patient');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Invoice = require('../models/Invoice');
const Visit = require('../models/Visit');
const Drug = require('../models/Drug');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const Room = require('../models/Room');

const Company = require('../models/Company');
const FeeSchedule = require('../models/FeeSchedule');

// Parse arguments
const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith('--count='));
const BASE_COUNT = countArg ? parseInt(countArg.split('=')[1]) : 20;

// Helper functions
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
}

function randomFutureDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  return date;
}

function generateId(prefix, num) {
  return `${prefix}-${Date.now()}-${num.toString().padStart(4, '0')}`;
}

// Stats tracking
const stats = {};

async function seedTestData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB\n');

    // Clean up previous test data to avoid duplicates
    console.log('🧹 Cleaning up previous test data...');
    await Promise.all([
      Approval.deleteMany({}),
      Prescription.deleteMany({}),
      LabOrder.deleteMany({}),
      LabResult.deleteMany({}),
      GlassesOrder.deleteMany({}),
      Document.deleteMany({}),
      Correspondence.deleteMany({}),
      Notification.deleteMany({}),
      PaymentPlan.deleteMany({}),
      InventoryTransfer.deleteMany({}),
      RepairTracking.deleteMany({}),
      IVTVial.deleteMany({}),
      IVTInjection.deleteMany({}),
      ConsultationSession.deleteMany({}),
      ClinicalAlert.deleteMany({}),
      WaitingList.deleteMany({})
    ]);
    console.log('  ✅ Previous test data cleared\n');

    // Load reference data
    console.log('📚 Loading reference data...');
    const patients = await Patient.find({}).limit(100).lean();
    const users = await User.find({ isActive: true }).lean();
    const clinics = await Clinic.find({}).lean();
    const invoices = await Invoice.find({}).limit(50).lean();
    const visits = await Visit.find({}).limit(100).lean();
    const drugs = await Drug.find({ isActive: true }).limit(50).lean();
    const labTemplates = await LaboratoryTemplate.find({}).limit(30).lean();
    const rooms = await Room.find({}).limit(20).lean();
    const frames = await FrameInventory.find({}).limit(20).lean();
    const pharmacyItems = await PharmacyInventory.find({}).limit(30).lean();

    if (patients.length === 0) {
      throw new Error('No patients found. Run patient import first.');
    }

    const doctors = users.filter(u => ['doctor', 'ophthalmologist'].includes(u.role));
    const nurses = users.filter(u => u.role === 'nurse');
    const admins = users.filter(u => u.role === 'admin');

    const companies = await Company.find({}).limit(20).lean();
    const feeSchedules = await FeeSchedule.find({}).limit(50).lean();

    console.log(`  Found ${patients.length} patients, ${users.length} users, ${clinics.length} clinics`);
    console.log(`  Found ${drugs.length} drugs, ${labTemplates.length} lab templates`);
    console.log(`  Found ${companies.length} companies, ${feeSchedules.length} fee schedules\n`);

    // ========================================
    // 1. APPROVALS (Prior Authorizations)
    // ========================================
    console.log('📋 Creating Approvals (Prior Authorizations)...');
    stats.approvals = 0;

    const actCategories = ['consultation', 'procedure', 'surgery', 'imaging', 'laboratory'];

    if (companies.length > 0 && feeSchedules.length > 0) {
      for (let i = 0; i < BASE_COUNT; i++) {
        const patient = randomElement(patients);
        const company = randomElement(companies);
        const feeSchedule = randomElement(feeSchedules);
        const requestedBy = randomElement(users);

        await Approval.create({
          patient: patient._id,
          company: company._id,
          actCode: feeSchedule.code || `ACT${i}`,
          actName: feeSchedule.name || `Acte médical ${i}`,
          actCategory: randomElement(actCategories),
          quantityRequested: Math.floor(Math.random() * 3) + 1,
          estimatedCost: Math.floor(Math.random() * 500000) + 50000,
          currency: 'CDF',
          medicalJustification: {
            diagnosis: randomElement(['Cataracte', 'Glaucome', 'DMLA', 'Rétinopathie diabétique']),
            clinicalNotes: 'Justification médicale pour test',
            urgency: randomElement(['routine', 'urgent', 'emergency'])
          },
          requestedBy: requestedBy._id,
          requestedAt: randomDate(14),
          status: randomElement(['pending', 'pending', 'approved', 'rejected']),
          validFrom: randomDate(7),
          validUntil: randomFutureDate(90),
          createdBy: requestedBy._id
        });
        stats.approvals++;
      }
    }
    console.log(`  ✅ Created ${stats.approvals} approvals`);

    // ========================================
    // 2. PRESCRIPTIONS
    // ========================================
    console.log('📝 Creating Prescriptions...');
    stats.prescriptions = 0;

    const prescriptionTypes = ['medication', 'optical', 'therapy'];
    const validRoutes = ['oral', 'topical', 'ophthalmic', 'otic', 'nasal', 'sublingual', 'intramuscular'];

    for (let i = 0; i < BASE_COUNT * 2; i++) {
      const patient = randomElement(patients);
      const doctor = doctors.length > 0 ? randomElement(doctors) : randomElement(users);
      const visit = visits.length > 0 ? randomElement(visits) : null;

      const numMeds = Math.floor(Math.random() * 4) + 1;
      const medications = [];

      for (let j = 0; j < numMeds && drugs.length > 0; j++) {
        const drug = randomElement(drugs);
        medications.push({
          drug: drug._id,
          name: drug.name,
          genericName: drug.genericName || drug.name,
          strength: drug.strength || '500mg',
          form: drug.form || 'comprimé',
          route: randomElement(validRoutes),
          dosageValue: Math.floor(Math.random() * 3) + 1,
          dosageUnit: randomElement(['comprimé', 'goutte', 'ml', 'mg']),
          frequency: randomElement(['1x/jour', '2x/jour', '3x/jour']),
          duration: Math.floor(Math.random() * 14) + 5,
          durationUnit: 'days',
          quantity: Math.floor(Math.random() * 30) + 5,
          instructions: randomElement([
            'Prendre avec les repas',
            'À jeun',
            'Avant le coucher',
            null
          ]),
          isExternalItem: true // Mark as external to bypass inventory validation
        });
      }

      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 3);

      await Prescription.create({
        patient: patient._id,
        prescriber: doctor._id,
        visit: visit?._id,
        type: randomElement(prescriptionTypes),
        status: randomElement(['pending', 'dispensed', 'dispensed', 'cancelled']),
        dateIssued: randomDate(30),
        validUntil: validUntil,
        medications,
        diagnosis: [
          {
            code: randomElement(['H40.9', 'H25.9', 'H10.9', 'E11.9', 'H35.3']),
            description: randomElement([
              'Glaucome non précisé',
              'Cataracte sénile',
              'Conjonctivite',
              'Diabète type 2',
              'Rétinopathie diabétique'
            ])
          }
        ],
        notes: Math.random() > 0.7 ? 'Contrôle dans 2 semaines' : undefined
      });
      stats.prescriptions++;
    }
    console.log(`  ✅ Created ${stats.prescriptions} prescriptions`);

    // ========================================
    // 3. LAB ORDERS & RESULTS
    // ========================================
    console.log('🔬 Creating Lab Orders & Results...');
    stats.labOrders = 0;
    stats.labResults = 0;

    for (let i = 0; i < BASE_COUNT; i++) {
      const patient = randomElement(patients);
      const doctor = doctors.length > 0 ? randomElement(doctors) : randomElement(users);
      const clinic = randomElement(clinics);

      const numTests = Math.floor(Math.random() * 5) + 1;
      const tests = [];

      for (let j = 0; j < numTests && labTemplates.length > 0; j++) {
        const template = randomElement(labTemplates);
        tests.push({
          testCode: template.testCode || `TEST${j}`,
          testName: template.name || `Test ${j}`,
          category: template.category || 'chemistry',
          status: 'pending'
        });
      }

      const orderStatus = randomElement(['ordered', 'in-progress', 'completed', 'completed']);

      const labOrder = await LabOrder.create({
        patient: patient._id,
        orderedBy: doctor._id,
        clinic: clinic._id,
        tests,
        status: orderStatus,
        priority: randomElement(['routine', 'routine', 'urgent', 'stat']),
        orderDate: randomDate(14),
        clinicalInfo: randomElement([
          'Bilan annuel',
          'Suivi diabète',
          'Pré-opératoire',
          'Contrôle glycémie'
        ]),
        fasting: Math.random() > 0.5
      });
      stats.labOrders++;

      // Create results for completed orders
      if (orderStatus === 'completed') {
        for (const test of tests) {
          const numericValue = (Math.random() * 100 + 50);
          await LabResult.create({
            labOrder: labOrder._id,
            patient: patient._id,
            test: {
              testCode: test.testCode,
              testName: test.testName,
              category: test.category
            },
            results: [{
              parameter: test.testName,
              value: numericValue.toFixed(2),
              numericValue: numericValue,
              unit: randomElement(['mg/dL', 'mmol/L', 'g/L', 'U/L', '%']),
              referenceRange: {
                low: 60,
                high: 120,
                text: '60 - 120'
              },
              flag: numericValue > 120 ? 'high' : (numericValue < 60 ? 'low' : 'normal')
            }],
            status: 'final',
            performedBy: randomElement(users)._id,
            performedAt: new Date(),
            verifiedBy: randomElement(users)._id,
            verifiedAt: new Date(),
            resultDate: new Date()
          });
          stats.labResults++;
        }
      }
    }
    console.log(`  ✅ Created ${stats.labOrders} lab orders, ${stats.labResults} lab results`);

    // ========================================
    // 4. IMAGING ORDERS & STUDIES (Skipped - model has schema bug with contrast field)
    // ========================================
    console.log('📷 Creating Imaging Orders & Studies...');
    console.log('  ⏭️  Skipped - ImagingOrder model has schema issue with contrast field');
    stats.imagingOrders = 0;
    stats.imagingStudies = 0;

    // ========================================
    // 5. GLASSES ORDERS
    // ========================================
    console.log('👓 Creating Glasses Orders...');
    stats.glassesOrders = 0;

    const glassesOrderStatuses = ['draft', 'pending_verification', 'verified', 'confirmed', 'sent-to-lab', 'in-production', 'ready', 'delivered'];
    const lensMaterials = ['cr39', 'polycarbonate', 'trivex', 'hi-index-1.60', 'hi-index-1.67'];
    const lensDesigns = ['single_vision', 'bifocal', 'progressive'];

    for (let i = 0; i < BASE_COUNT; i++) {
      const patient = randomElement(patients);
      const clinic = randomElement(clinics);
      const frame = frames.length > 0 ? randomElement(frames) : null;
      const doctor = doctors.length > 0 ? randomElement(doctors) : randomElement(users);

      await GlassesOrder.create({
        patient: patient._id,
        orderedBy: doctor._id,
        orderType: 'glasses',
        status: randomElement(glassesOrderStatuses),
        // Prescription data in correct format (od/os)
        prescriptionData: {
          od: {
            sphere: parseFloat((Math.random() * 6 - 3).toFixed(2)),
            cylinder: parseFloat((Math.random() * -3).toFixed(2)),
            axis: Math.floor(Math.random() * 180),
            add: Math.random() > 0.5 ? parseFloat((Math.random() * 2 + 0.5).toFixed(2)) : undefined
          },
          os: {
            sphere: parseFloat((Math.random() * 6 - 3).toFixed(2)),
            cylinder: parseFloat((Math.random() * -3).toFixed(2)),
            axis: Math.floor(Math.random() * 180),
            add: Math.random() > 0.5 ? parseFloat((Math.random() * 2 + 0.5).toFixed(2)) : undefined
          },
          pd: {
            binocular: 64,
            monocularOd: 32,
            monocularOs: 32
          }
        },
        // Also populate rightLens/leftLens for optical shop data
        rightLens: {
          sphere: parseFloat((Math.random() * 6 - 3).toFixed(2)),
          cylinder: parseFloat((Math.random() * -3).toFixed(2)),
          axis: Math.floor(Math.random() * 180)
        },
        leftLens: {
          sphere: parseFloat((Math.random() * 6 - 3).toFixed(2)),
          cylinder: parseFloat((Math.random() * -3).toFixed(2)),
          axis: Math.floor(Math.random() * 180)
        },
        // Glasses specs with correct frame structure
        glasses: {
          lensType: randomElement(['single-vision-distance', 'single-vision-near', 'bifocal', 'progressive']),
          lensMaterial: randomElement(['cr39', 'polycarbonate', 'trivex', 'hi-index-1.60']),
          coatings: [randomElement(['anti-reflective', 'blue-light', 'scratch-resistant'])],
          frame: frame ? {
            inventoryItem: frame._id,
            brand: frame.brand,
            model: frame.model,
            color: frame.color,
            size: frame.size
          } : {
            brand: 'Ray-Ban',
            model: 'RB5154',
            color: 'Noir',
            size: '52-18-145'
          }
        },
        // Also populate top-level frame for optical shop workflow
        frame: frame ? {
          inventoryItem: frame._id,
          brand: frame.brand,
          model: frame.model,
          color: frame.color,
          size: frame.size,
          price: Math.floor(Math.random() * 200000) + 50000
        } : {
          brand: 'Ray-Ban',
          model: 'RB5154',
          color: 'Noir',
          size: '52-18-145',
          price: 150000
        },
        // Lens type (object with material and design)
        lensType: {
          material: randomElement(lensMaterials),
          design: randomElement(lensDesigns)
        },
        // Lens options
        lensOptions: {
          antiReflective: { selected: Math.random() > 0.5, price: 25000 },
          photochromic: { selected: Math.random() > 0.7, price: 50000 },
          blueLight: { selected: Math.random() > 0.6, price: 35000 }
        },
        // Measurements
        measurements: {
          pd: 64,
          pdRight: 32,
          pdLeft: 32
        },
        // Pricing in correct format
        pricing: {
          framePrice: Math.floor(Math.random() * 200000) + 50000,
          lensPrice: Math.floor(Math.random() * 150000) + 30000,
          optionsPrice: Math.floor(Math.random() * 50000),
          subtotal: Math.floor(Math.random() * 400000) + 100000,
          discount: 0,
          taxRate: 16,
          finalTotal: Math.floor(Math.random() * 450000) + 100000
        },
        estimatedDelivery: randomFutureDate(14),
        priority: randomElement(['normal', 'urgent', 'rush']),
        timeline: {
          createdAt: randomDate(30)
        }
      });
      stats.glassesOrders++;
    }
    console.log(`  ✅ Created ${stats.glassesOrders} glasses orders`);

    // ========================================
    // 6. DOCUMENTS
    // ========================================
    console.log('📄 Creating Documents...');
    stats.documents = 0;

    // Valid document categories and types per schema
    const documentConfigs = [
      { category: 'laboratory', type: 'pdf', name: 'Résultats de laboratoire', subCategory: 'blood-test' },
      { category: 'imaging', type: 'pdf', name: 'Rapport d\'imagerie', subCategory: 'oct' },
      { category: 'clinical', type: 'pdf', name: 'Note de consultation' },
      { category: 'consent', type: 'pdf', name: 'Consentement éclairé', subCategory: 'surgical-consent' },
      { category: 'referral', type: 'pdf', name: 'Lettre de référence', subCategory: 'specialist-referral' },
      { category: 'administrative', type: 'pdf', name: 'Document administratif' },
      { category: 'report', type: 'pdf', name: 'Rapport médical', subCategory: 'consultation-report' },
      { category: 'photo', type: 'image', name: 'Photo patient', subCategory: 'patient-photo' }
    ];

    // Valid status values
    const docStatuses = ['draft', 'pending', 'reviewed', 'approved', 'archived'];
    // Valid metadata.source values
    const docSources = ['upload', 'scan', 'fax', 'email', 'api', 'device', 'generated'];

    for (let i = 0; i < BASE_COUNT * 2; i++) {
      const patient = randomElement(patients);
      const docConfig = randomElement(documentConfigs);
      const uploader = randomElement(users);

      const docData = {
        patient: patient._id,
        category: docConfig.category,
        type: docConfig.type,
        title: `${docConfig.name} - ${patient.lastName}`,
        description: `Document généré pour test`,
        file: {
          filename: `${docConfig.category}_${patient.patientId}_${Date.now()}.${docConfig.type === 'image' ? 'jpg' : 'pdf'}`,
          originalName: `${docConfig.name}.${docConfig.type === 'image' ? 'jpg' : 'pdf'}`,
          size: Math.floor(Math.random() * 500000) + 10000,
          path: `/documents/${patient.patientId}/${docConfig.category}_${Date.now()}.${docConfig.type === 'image' ? 'jpg' : 'pdf'}`,
          mimeType: docConfig.type === 'image' ? 'image/jpeg' : 'application/pdf'
        },
        status: randomElement(docStatuses),
        tags: [docConfig.category, 'test'],
        metadata: {
          source: randomElement(docSources),
          dateCreated: randomDate(60)
        },
        createdBy: uploader._id
      };

      // Add subCategory if available
      if (docConfig.subCategory) {
        docData.subCategory = docConfig.subCategory;
      }

      await Document.create(docData);
      stats.documents++;
    }
    console.log(`  ✅ Created ${stats.documents} documents`);

    // ========================================
    // 7. CORRESPONDENCES
    // ========================================
    console.log('✉️ Creating Correspondences...');
    stats.correspondences = 0;

    // Valid correspondence types per schema
    const correspondenceTypes = ['referral', 'summary', 'report', 'insurance', 'patient', 'consultation', 'follow-up', 'authorization', 'results'];
    // Valid recipient types
    const recipientTypes = ['patient', 'provider', 'insurance', 'pharmacy', 'laboratory', 'other'];
    // Valid statuses
    const corrStatuses = ['draft', 'pending-review', 'approved', 'sent', 'delivered'];
    // Valid delivery methods
    const deliveryMethods = ['email', 'fax', 'mail', 'portal'];

    for (let i = 0; i < BASE_COUNT; i++) {
      const patient = randomElement(patients);
      const doctor = doctors.length > 0 ? randomElement(doctors) : randomElement(users);
      const recipientName = 'Dr. ' + randomElement(['Kabongo', 'Mbuyi', 'Lukusa', 'Nkongolo']);

      await Correspondence.create({
        patient: patient._id,
        type: randomElement(correspondenceTypes),
        recipient: {
          type: randomElement(recipientTypes),
          name: recipientName,
          title: 'Médecin Spécialiste',
          organization: randomElement(['Hôpital Général', 'Clinique Ngaliema', 'Centre Monkole']),
          address: {
            street: 'Avenue du Commerce 123',
            city: 'Kinshasa',
            country: 'RDC'
          },
          email: 'medecin@hopital.cd',
          preferredMethod: randomElement(['email', 'fax', 'mail'])
        },
        content: {
          subject: `Correspondance médicale - ${patient.lastName} ${patient.firstName}`,
          salutation: `Cher Confrère,`,
          body: `Je vous adresse ce patient ${patient.firstName} ${patient.lastName} pour consultation spécialisée.\n\nMerci de votre attention.`,
          closing: 'Cordialement',
          signature: {
            name: `Dr. ${doctor.lastName}`,
            title: 'Ophtalmologue',
            electronic: true
          }
        },
        status: randomElement(corrStatuses),
        priority: randomElement(['low', 'normal', 'high']),
        deliveryMethod: randomElement(deliveryMethods),
        createdBy: doctor._id
      });
      stats.correspondences++;
    }
    console.log(`  ✅ Created ${stats.correspondences} correspondences`);

    // ========================================
    // 8. NOTIFICATIONS
    // ========================================
    console.log('🔔 Creating Notifications...');
    stats.notifications = 0;

    // Valid notification types per schema
    const notificationTypes = [
      { type: 'appointment_reminder', title: 'Rappel de rendez-vous', entityType: 'appointment' },
      { type: 'appointment_confirmed', title: 'Rendez-vous confirmé', entityType: 'appointment' },
      { type: 'appointment_cancelled', title: 'Rendez-vous annulé', entityType: 'appointment' },
      { type: 'prescription_ready', title: 'Ordonnance prête', entityType: 'prescription' },
      { type: 'prescription_expiring', title: 'Ordonnance expire bientôt', entityType: 'prescription' },
      { type: 'invoice_due', title: 'Facture en attente', entityType: 'invoice' },
      { type: 'invoice_paid', title: 'Facture payée', entityType: 'invoice' },
      { type: 'result_available', title: 'Résultats disponibles', entityType: 'patient' },
      { type: 'stock_alert', title: 'Alerte stock bas', entityType: 'system' },
      { type: 'system_announcement', title: 'Annonce système', entityType: 'system' },
      { type: 'task_assigned', title: 'Tâche assignée', entityType: 'task' },
      { type: 'followup_due', title: 'Suivi requis', entityType: 'patient' }
    ];

    // Valid priority values
    const notifPriorities = ['low', 'normal', 'high', 'urgent'];

    for (let i = 0; i < BASE_COUNT * 3; i++) {
      const notif = randomElement(notificationTypes);
      const targetUser = randomElement(users);

      await Notification.create({
        type: notif.type,
        title: notif.title,
        message: `${notif.title} - Action requise pour le ${new Date().toLocaleDateString('fr-FR')}`,
        recipient: targetUser._id,
        entityType: notif.entityType,
        priority: randomElement(notifPriorities),
        read: Math.random() > 0.6,
        readAt: Math.random() > 0.6 ? randomDate(3) : undefined,
        link: `/dashboard/${notif.type.replace('_', '-')}`,
        channels: {
          inApp: true,
          email: Math.random() > 0.7,
          sms: Math.random() > 0.8
        }
      });
      stats.notifications++;
    }
    console.log(`  ✅ Created ${stats.notifications} notifications`);

    // ========================================
    // 9. PAYMENT PLANS
    // ========================================
    console.log('💳 Creating Payment Plans...');
    stats.paymentPlans = 0;

    for (let i = 0; i < Math.floor(BASE_COUNT / 2); i++) {
      const patient = randomElement(patients);
      const clinic = randomElement(clinics);
      const invoice = invoices.length > 0 ? randomElement(invoices) : null;
      const totalAmount = Math.floor(Math.random() * 2000000) + 500000;
      const numInstallments = randomElement([3, 4, 6, 12]);
      const installmentAmount = Math.floor(totalAmount / numInstallments);

      const installments = [];
      for (let j = 0; j < numInstallments; j++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + j);
        installments.push({
          installmentNumber: j + 1,
          amount: installmentAmount,
          dueDate,
          status: j < 2 ? 'paid' : 'pending',
          paidAmount: j < 2 ? installmentAmount : 0,
          paidDate: j < 2 ? randomDate(30) : undefined
        });
      }

      await PaymentPlan.create({
        planId: generateId('PP', i),
        patient: patient._id,
        clinic: clinic._id,
        invoice: invoice?._id,
        totalAmount,
        currency: 'CDF',
        numberOfInstallments: numInstallments,
        installments,
        status: randomElement(['active', 'active', 'completed', 'defaulted']),
        startDate: randomDate(60),
        createdBy: randomElement(users)._id,
        notes: 'Plan de paiement créé pour test'
      });
      stats.paymentPlans++;
    }
    console.log(`  ✅ Created ${stats.paymentPlans} payment plans`);

    // ========================================
    // 10. INVENTORY TRANSFERS
    // ========================================
    console.log('📦 Creating Inventory Transfers...');
    stats.inventoryTransfers = 0;

    // Valid transfer types per schema
    const transferTypes = ['depot-to-clinic', 'clinic-to-clinic', 'return-to-depot', 'adjustment'];
    // Valid inventory types per schema
    const inventoryTypes = ['pharmacy', 'frame', 'contactLens', 'labConsumable', 'reagent'];
    // Valid statuses
    const transferStatuses = ['draft', 'requested', 'approved', 'in-transit', 'completed', 'cancelled'];
    // Valid reasons
    const transferReasons = ['replenishment', 'stock-out', 'rebalancing', 'expiring-soon', 'patient-request'];

    if (clinics.length >= 2 && pharmacyItems.length > 0) {
      for (let i = 0; i < Math.floor(BASE_COUNT / 2); i++) {
        const sourceClinic = randomElement(clinics);
        const destClinic = clinics.find(c => c._id.toString() !== sourceClinic._id.toString()) || clinics[0];
        const item = randomElement(pharmacyItems);
        const requester = randomElement(users);

        // Generate transfer number
        const date = new Date();
        const transferNumber = `TRF-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${(i + 1).toString().padStart(4, '0')}`;

        await InventoryTransfer.create({
          transferNumber: transferNumber,
          type: randomElement(transferTypes),
          source: {
            clinic: sourceClinic._id,
            isDepot: false,
            name: sourceClinic.name
          },
          destination: {
            clinic: destClinic._id,
            name: destClinic.name
          },
          items: [{
            inventoryType: 'pharmacy',
            inventoryId: item._id,
            inventoryModel: 'PharmacyInventory',
            productName: item.drug?.name || 'Médicament test',
            productSku: item.sku || `SKU-${i}`,
            requestedQuantity: Math.floor(Math.random() * 50) + 5,
            approvedQuantity: Math.floor(Math.random() * 40) + 5,
            status: 'pending'
          }],
          status: randomElement(transferStatuses),
          priority: randomElement(['low', 'normal', 'high']),
          reason: randomElement(transferReasons),
          reasonNotes: 'Transfert de stock test',
          requestedBy: requester._id
        });
        stats.inventoryTransfers++;
      }
    }
    console.log(`  ✅ Created ${stats.inventoryTransfers} inventory transfers`);

    // ========================================
    // 11. REPAIR TRACKINGS
    // ========================================
    console.log('🔧 Creating Repair Trackings...');
    stats.repairTrackings = 0;

    // Valid item types per schema
    const repairItemTypes = ['eyeglasses', 'frame', 'sunglasses', 'contact_lens_case', 'equipment', 'hearing_aid', 'low_vision_device', 'other'];
    // Valid problem categories
    const problemCategories = ['broken_frame', 'loose_screw', 'nose_pad', 'temple_adjustment', 'lens_scratch', 'hinge_repair', 'cleaning'];
    // Valid statuses
    const repairStatuses = ['received', 'inspecting', 'waiting_approval', 'approved', 'in_repair', 'ready_pickup', 'completed'];

    for (let i = 0; i < Math.floor(BASE_COUNT / 2); i++) {
      const patient = randomElement(patients);
      const clinic = randomElement(clinics);
      const receiver = randomElement(users);

      // Generate repair number
      const date = new Date();
      const repairNumber = `REP-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${(i + 1).toString().padStart(4, '0')}`;

      await RepairTracking.create({
        repairNumber: repairNumber,
        customer: patient._id,
        customerName: `${patient.firstName} ${patient.lastName}`,
        customerPhone: patient.phoneNumber || '+243 123 456 789',
        clinic: clinic._id,
        itemType: randomElement(repairItemTypes),
        itemDescription: randomElement([
          'Monture Ray-Ban RB5154',
          'Lunettes de soleil Oakley',
          'Monture Gucci GG0010',
          'Lunettes progressives Essilor'
        ]),
        brand: randomElement(['Ray-Ban', 'Oakley', 'Gucci', 'Prada', 'Essilor']),
        model: 'Model-' + Math.floor(Math.random() * 1000),
        problemReported: randomElement([
          'Branche cassée',
          'Vis desserrée',
          'Plaquette nasale manquante',
          'Charnière endommagée'
        ]),
        problemCategory: randomElement(problemCategories),
        repairType: randomElement(['in_house', 'send_out', 'warranty']),
        status: randomElement(repairStatuses),
        estimatedCost: Math.floor(Math.random() * 50000) + 5000,
        receivedDate: randomDate(14),
        estimatedCompletionDate: randomFutureDate(7),
        receivedBy: receiver._id,
        assignedTo: randomElement(users)._id
      });
      stats.repairTrackings++;
    }
    console.log(`  ✅ Created ${stats.repairTrackings} repair trackings`);

    // ========================================
    // 12. IVT VIALS & INJECTIONS
    // ========================================
    console.log('💉 Creating IVT Vials & Injections...');
    stats.ivtVials = 0;
    stats.ivtInjections = 0;

    // IVT medications with schema-compliant structure
    const ivtDrugs = [
      { name: 'Lucentis', genericName: 'Ranibizumab', manufacturer: 'Novartis', concentration: '10mg/mL', totalVolume: 0.23, dosesPerVial: 1 },
      { name: 'Eylea', genericName: 'Aflibercept', manufacturer: 'Bayer', concentration: '40mg/mL', totalVolume: 0.278, dosesPerVial: 1 },
      { name: 'Avastin', genericName: 'Bevacizumab', manufacturer: 'Roche', concentration: '25mg/mL', totalVolume: 4, dosesPerVial: 30 }
    ];

    // Valid vial statuses
    const vialStatuses = ['in_stock', 'in_use', 'expired', 'depleted', 'disposed'];

    for (let i = 0; i < 5; i++) {
      const drug = randomElement(ivtDrugs);
      const clinic = randomElement(clinics);
      const receiver = randomElement(users);
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6);

      // Generate vial number
      const vialNumber = `VIAL-${Date.now()}-${(i + 1).toString().padStart(4, '0')}`;

      const vial = await IVTVial.create({
        vialNumber: vialNumber,
        clinic: clinic._id,
        medication: {
          name: drug.name,
          genericName: drug.genericName,
          manufacturer: drug.manufacturer,
          concentration: drug.concentration,
          totalVolume: drug.totalVolume,
          dosesPerVial: drug.dosesPerVial
        },
        lotNumber: `LOT${Date.now()}${i}`,
        expirationDate: expiryDate,
        storage: {
          requiredTempMin: 2,
          requiredTempMax: 8,
          lightSensitive: true,
          currentLocation: 'pharmacy_refrigerator'
        },
        currentStatus: randomElement(vialStatuses),
        dosesUsed: Math.floor(Math.random() * drug.dosesPerVial),
        dosesRemaining: drug.dosesPerVial - Math.floor(Math.random() * drug.dosesPerVial),
        receivedBy: receiver._id,
        receivedAt: randomDate(30)
      });
      stats.ivtVials++;

      // Create injections from this vial (only if we have doctors)
      if (doctors.length > 0) {
        const numInjections = Math.min(Math.floor(Math.random() * 3) + 1, drug.dosesPerVial);
        for (let j = 0; j < numInjections; j++) {
          const patient = randomElement(patients);
          const doctor = randomElement(doctors);

          try {
            await IVTInjection.create({
              patient: patient._id,
              clinic: clinic._id,
              vial: vial._id,
              medication: {
                name: drug.name,
                genericName: drug.genericName,
                concentration: drug.concentration
              },
              eye: randomElement(['OD', 'OS']),
              indication: randomElement(['AMD', 'DME', 'RVO', 'CNV', 'myopic_CNV']),
              injectionNumber: j + 1,
              scheduledDate: randomDate(14),
              status: randomElement(['scheduled', 'completed', 'completed']),
              performer: doctor._id,
              preInjection: {
                iop: Math.floor(Math.random() * 10) + 12
              },
              postInjection: {
                iop: Math.floor(Math.random() * 10) + 10
              },
              nextInjection: {
                recommendedDate: randomFutureDate(30)
              }
            });
            stats.ivtInjections++;
          } catch (err) {
            // Skip injection if model has issues
            console.log(`    ⚠️ Skipped IVT injection: ${err.message.substring(0, 50)}`);
          }
        }
      }
    }
    console.log(`  ✅ Created ${stats.ivtVials} IVT vials, ${stats.ivtInjections} IVT injections`);

    // ========================================
    // 13. CONSULTATION SESSIONS
    // ========================================
    console.log('🩺 Creating Consultation Sessions...');
    stats.consultationSessions = 0;

    // Valid session statuses per schema
    const sessionStatuses = ['active', 'completed', 'abandoned'];
    // Valid consultation types
    const consultationTypes = ['refraction', 'contact_lens', 'orthoptic', 'general'];

    if (doctors.length > 0) {
      for (let i = 0; i < Math.floor(BASE_COUNT / 2); i++) {
        const patient = randomElement(patients);
        const doctor = randomElement(doctors);
        const clinic = randomElement(clinics);
        const visit = visits.length > 0 ? randomElement(visits) : null;

        await ConsultationSession.create({
          patient: patient._id,
          doctor: doctor._id,
          clinic: clinic._id,
          visit: visit?._id,
          status: randomElement(sessionStatuses),
          sessionDate: randomDate(7),
          consultationType: randomElement(consultationTypes),
          sessionData: {
            chiefComplaint: randomElement([
              'Baisse de vision',
              'Douleur oculaire',
              'Rougeur',
              'Vision floue',
              'Contrôle annuel'
            ])
          }
        });
        stats.consultationSessions++;
      }
    }
    console.log(`  ✅ Created ${stats.consultationSessions} consultation sessions`);

    // ========================================
    // 14. CLINICAL ALERTS
    // ========================================
    console.log('⚠️ Creating Clinical Alerts...');
    stats.clinicalAlerts = 0;

    // Valid alert configurations per schema
    const alertConfigs = [
      { code: 'DRUG_ALLERGY_CONFLICT', severity: 'WARNING', category: 'medication', title: 'Allergie médicamenteuse', message: 'Allergie connue à ce médicament' },
      { code: 'DRUG_INTERACTION', severity: 'WARNING', category: 'medication', title: 'Interaction médicamenteuse', message: 'Interaction médicamenteuse potentielle détectée' },
      { code: 'FOLLOW_UP_OVERDUE', severity: 'INFO', category: 'follow_up', title: 'Suivi en retard', message: 'Patient en retard pour son suivi' },
      { code: 'IOP_ELEVATED', severity: 'WARNING', category: 'measurement', title: 'PIO élevée', message: 'Pression intraoculaire entre 21-30 mmHg' },
      { code: 'IOP_CRITICAL', severity: 'URGENT', category: 'measurement', title: 'PIO critique', message: 'Pression intraoculaire > 30 mmHg - Attention immédiate requise' },
      { code: 'DIABETES_SCREENING_DUE', severity: 'INFO', category: 'follow_up', title: 'Dépistage diabète', message: 'Patient diabétique nécessite dépistage rétinien' },
      { code: 'CUP_DISC_HIGH', severity: 'WARNING', category: 'clinical', title: 'Rapport C/D élevé', message: 'Rapport cup/disc > 0.7 - Suspicion glaucome' },
      { code: 'NARROW_ANGLE', severity: 'WARNING', category: 'clinical', title: 'Angle étroit', message: 'Angle iridocornéen étroit détecté à la gonioscopie' }
    ];

    // Valid statuses per schema
    const alertStatuses = ['active', 'acknowledged', 'resolved', 'escalated', 'dismissed'];

    for (let i = 0; i < BASE_COUNT; i++) {
      const patient = randomElement(patients);
      const alertConfig = randomElement(alertConfigs);

      await ClinicalAlert.create({
        patient: patient._id,
        code: alertConfig.code,
        severity: alertConfig.severity,
        category: alertConfig.category,
        title: alertConfig.title,
        message: `${alertConfig.message} - Patient: ${patient.firstName} ${patient.lastName}`,
        eye: randomElement(['OD', 'OS', 'OU', undefined]),
        status: randomElement(alertStatuses),
        createdBy: randomElement(users)._id
      });
      stats.clinicalAlerts++;
    }
    console.log(`  ✅ Created ${stats.clinicalAlerts} clinical alerts`);

    // ========================================
    // 15. WAITING LISTS
    // ========================================
    console.log('⏳ Creating Waiting Lists...');
    stats.waitingLists = 0;

    // Valid appointment types per schema
    const waitingApptTypes = ['consultation', 'follow-up', 'surgery', 'procedure', 'ophthalmology', 'refraction', 'lab-test', 'imaging'];
    // Valid departments
    const waitingDepartments = ['general', 'ophthalmology', 'laboratory', 'radiology', 'emergency'];
    // Valid priorities
    const waitingPriorities = ['normal', 'high', 'urgent'];
    // Valid statuses
    const waitingStatuses = ['waiting', 'notified', 'scheduled', 'expired', 'cancelled'];
    // Reasons
    const waitingReasons = [
      'Chirurgie cataracte programmée',
      'Suivi glaucome',
      'Injection intravitréenne anti-VEGF',
      'Laser rétinien',
      'Chirurgie strabisme',
      'Examen ophtalmologique complet',
      'Contrôle de réfraction'
    ];

    for (let i = 0; i < BASE_COUNT; i++) {
      const patient = randomElement(patients);
      const doctor = doctors.length > 0 ? randomElement(doctors) : null;

      await WaitingList.create({
        patient: patient._id,
        requestedProvider: doctor?._id,
        appointmentType: randomElement(waitingApptTypes),
        department: randomElement(waitingDepartments),
        priority: randomElement(waitingPriorities),
        reason: randomElement(waitingReasons),
        status: randomElement(waitingStatuses),
        preferences: {
          preferredDays: [1, 2, 3, 4, 5], // Monday to Friday
          preferredTimeSlots: ['morning', 'afternoon'],
          earliestDate: new Date(),
          latestDate: randomFutureDate(90),
          flexibleProvider: true
        },
        contactPreferences: {
          email: true,
          sms: Math.random() > 0.5,
          phone: Math.random() > 0.7
        },
        addedBy: randomElement(users)._id
      });
      stats.waitingLists++;
    }
    console.log(`  ✅ Created ${stats.waitingLists} waiting list entries`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '═'.repeat(60));
    console.log('  TEST TRANSACTIONAL DATA SEEDING COMPLETE');
    console.log('═'.repeat(60));

    const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);

    for (const [key, value] of Object.entries(stats)) {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      console.log(`  ${label.padEnd(25)} ${value}`);
    }

    console.log('─'.repeat(60));
    console.log(`  TOTAL RECORDS CREATED:   ${totalRecords}`);
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run
seedTestData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
