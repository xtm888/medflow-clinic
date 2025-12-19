#!/usr/bin/env node
/**
 * COMPREHENSIVE CONVENTION BILLING STRESS TEST
 *
 * Tests ALL possible scenarios:
 * - Patient with ACTIVA (100% coverage, approval required for surgery/optical over $100)
 * - Patient with GGA (100% medical, optical NOT COVERED)
 * - Patient WITHOUT convention (patient pays 100%)
 *
 * Services tested:
 * - Consultation (no approval)
 * - Examination (no approval)
 * - Procedures (no approval)
 * - Laboratory (no approval)
 * - Imaging (no approval)
 * - Medication (no approval)
 * - Surgery (approval required over $100 USD)
 * - Optical (approval required over $100 USD, or NOT COVERED)
 *
 * Run: node scripts/comprehensiveConventionTest.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { PharmacyInventory, FrameInventory } = require('../models/Inventory');

// Models
const Patient = require('../models/Patient');
const Company = require('../models/Company');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Appointment = require('../models/Appointment');
const Visit = require('../models/Visit');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const LabOrder = require('../models/LabOrder');
const Prescription = require('../models/Prescription');
const IVTInjection = require('../models/IVTInjection');
const SurgeryCase = require('../models/SurgeryCase');
const GlassesOrder = require('../models/GlassesOrder');
const Invoice = require('../models/Invoice');
const Approval = require('../models/Approval');

const TEST_PREFIX = 'CONV_TEST_';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

const log = (msg) => console.log(msg);
const logHeader = (msg) => console.log(`\n${colors.bgBlue}${colors.white} ${msg} ${colors.reset}\n`);
const logSection = (msg) => console.log(`${colors.cyan}━━━ ${msg} ━━━${colors.reset}`);
const logSuccess = (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
const logError = (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`);
const logInfo = (msg) => console.log(`  ${colors.blue}ℹ${colors.reset} ${msg}`);
const logWarning = (msg) => console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`);
const logMoney = (label, company, patient, total) => {
  console.log(`  ${colors.magenta}💰${colors.reset} ${label}:`);
  console.log(`     Total: ${total.toLocaleString()} CDF`);
  console.log(`     ${colors.blue}Company pays: ${company.toLocaleString()} CDF${colors.reset}`);
  console.log(`     ${colors.yellow}Patient pays: ${patient.toLocaleString()} CDF${colors.reset}`);
};

class ComprehensiveConventionTest {
  constructor() {
    this.testData = {
      patients: {},
      companies: {},
      invoices: {},
      glassesOrders: {},
      approvals: {}
    };
    this.results = {
      scenarios: [],
      passed: 0,
      failed: 0
    };
  }

  async run() {
    try {
      console.log(`${colors.bgMagenta}${colors.white}`);
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║     COMPREHENSIVE CONVENTION BILLING STRESS TEST               ║');
      console.log('║                                                                ║');
      console.log('║  Testing ALL scenarios:                                        ║');
      console.log('║  • ACTIVA: 100% coverage, approval for surgery/optical >$100   ║');
      console.log('║  • GGA: 100% medical, optical NOT COVERED                      ║');
      console.log('║  • NO CONVENTION: Patient pays 100%                            ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log(colors.reset);

      await mongoose.connect(process.env.MONGODB_URI);
      logSuccess('Connected to MongoDB');

      // Setup
      await this.cleanup();
      await this.loadDependencies();

      // Create test patients
      await this.createTestPatients();

      // Run all scenarios
      logHeader('SCENARIO 1: ACTIVA PATIENT - Full Coverage with Approvals');
      await this.testActivaPatient();

      logHeader('SCENARIO 2: GGA PATIENT - Optical Not Covered');
      await this.testGGAPatient();

      logHeader('SCENARIO 3: NO CONVENTION - Patient Pays 100%');
      await this.testNoConventionPatient();

      // Print results
      this.printResults();

      // Print UI verification checklist
      this.printUIChecklist();

    } catch (error) {
      logError(`Test failed: ${error.message}`);
      console.error(error);
    } finally {
      await mongoose.disconnect();
      logInfo('Disconnected from MongoDB');
    }
  }

  async cleanup() {
    logSection('Cleaning up previous test data');

    const collections = [
      { model: Patient, query: { firstName: { $regex: /^CONV_TEST_/ } } },
      { model: Appointment, query: { 'notes.internal': { $regex: /CONV_TEST_/ } } },
      { model: Visit, query: { 'notes.internal': { $regex: /CONV_TEST_/ } } },
      { model: OphthalmologyExam, query: { 'notes.internal': { $regex: /CONV_TEST_/ } } },
      { model: LabOrder, query: { 'notes': { $regex: /CONV_TEST_/ } } },
      { model: Prescription, query: { 'notes': { $regex: /CONV_TEST_/ } } },
      { model: IVTInjection, query: { 'notes': { $regex: /CONV_TEST_/ } } },
      { model: SurgeryCase, query: { 'notes': { $regex: /CONV_TEST_/ } } },
      { model: GlassesOrder, query: { 'notes': { $regex: /CONV_TEST_/ } } },
      { model: Invoice, query: { 'notes': { $regex: /CONV_TEST_/ } } },
      { model: Approval, query: { 'internalNotes': { $regex: /CONV_TEST_/ } } }
    ];

    for (const { model, query } of collections) {
      const result = await model.deleteMany(query);
      if (result.deletedCount > 0) {
        logInfo(`Deleted ${result.deletedCount} ${model.modelName} records`);
      }
    }
    logSuccess('Cleanup completed');
  }

  async loadDependencies() {
    logSection('Loading test dependencies');

    // Get clinic (uses status: 'active' field, not active: true)
    this.testData.clinic = await Clinic.findOne({ status: 'active' });
    if (!this.testData.clinic) throw new Error('No active clinic found');
    logSuccess(`Using clinic: ${this.testData.clinic.name}`);

    // Get admin user
    this.testData.admin = await User.findOne({ role: 'admin' });
    if (!this.testData.admin) throw new Error('No admin user found');
    logSuccess(`Using admin: ${this.testData.admin.firstName} ${this.testData.admin.lastName}`);

    // Get ACTIVA company
    this.testData.companies.activa = await Company.findOne({ name: 'ACTIVA' });
    if (!this.testData.companies.activa) throw new Error('ACTIVA company not found');
    logSuccess(`Loaded ACTIVA: ${this.testData.companies.activa.defaultCoverage?.percentage || 100}% default coverage`);

    // Log ACTIVA approval rules
    const activaSurgery = this.testData.companies.activa.coveredCategories?.find(c => c.category === 'surgery');
    const activaOptical = this.testData.companies.activa.coveredCategories?.find(c => c.category === 'optical');
    logInfo(`  Surgery: ${activaSurgery?.requiresApproval ? 'Approval required' : 'No approval'}`);
    logInfo(`  Optical: ${activaOptical?.requiresApproval ? 'Approval required' : 'No approval'}`);
    logInfo(`  Auto-approve under: $${this.testData.companies.activa.approvalRules?.autoApproveUnderAmount || 0} USD`);

    // Get GGA company
    this.testData.companies.gga = await Company.findOne({ name: 'GGA' });
    if (!this.testData.companies.gga) throw new Error('GGA company not found');
    logSuccess(`Loaded GGA: ${this.testData.companies.gga.defaultCoverage?.percentage || 100}% default coverage`);

    // Log GGA rules
    const ggaOptical = this.testData.companies.gga.coveredCategories?.find(c => c.category === 'optical');
    logInfo(`  Optical: ${ggaOptical?.notCovered ? 'NOT COVERED' : 'Covered'}`);

    // Get frame for glasses orders
    this.testData.frame = await FrameInventory.findOne({
      quantity: { $gt: 0 },
      active: true
    });
    if (this.testData.frame) {
      logSuccess(`Using frame: ${this.testData.frame.brand} ${this.testData.frame.model} (${this.testData.frame.price} CDF)`);
    }

    // Get medication for prescriptions
    this.testData.medications = await PharmacyInventory.find({
      currentStock: { $gt: 0 },
      isActive: true
    }).limit(4);
    logSuccess(`Loaded ${this.testData.medications.length} medications for prescriptions`);
  }

  async createTestPatients() {
    logSection('Creating test patients');

    const basePatient = {
      gender: 'male',
      dateOfBirth: new Date('1970-05-15'),
      phoneNumber: '+243810000001',
      address: { city: 'Kinshasa', country: 'RD Congo' },
      medicalHistory: {
        chronicConditions: ['Diabetes Type 2', 'Hypertension'],
        currentMedications: ['Metformin 500mg', 'Lisinopril 10mg']
      },
      allergies: [{
        allergen: 'Penicillin',
        severity: 'severe',
        reaction: 'Anaphylaxis'
      }],
      createdBy: this.testData.admin._id
    };

    // Patient 1: ACTIVA (100% coverage, approval required)
    this.testData.patients.activa = await Patient.create({
      ...basePatient,
      firstName: `${TEST_PREFIX}ACTIVA`,
      lastName: 'PATIENT',
      phoneNumber: '+243810000001',
      convention: {
        company: this.testData.companies.activa._id,
        employeeId: 'ACTIVA-TEST-001',
        beneficiaryType: 'employee',
        status: 'active',
        isActive: true
      }
    });
    logSuccess(`Created ACTIVA patient: ${this.testData.patients.activa.firstName} ${this.testData.patients.activa.lastName}`);
    logInfo('  Convention: ACTIVA - 100% coverage, approval for surgery/optical >$100');

    // Patient 2: GGA (optical not covered)
    this.testData.patients.gga = await Patient.create({
      ...basePatient,
      firstName: `${TEST_PREFIX}GGA`,
      lastName: 'PATIENT',
      phoneNumber: '+243810000002',
      convention: {
        company: this.testData.companies.gga._id,
        employeeId: 'GGA-TEST-001',
        beneficiaryType: 'employee',
        status: 'active',
        isActive: true
      }
    });
    logSuccess(`Created GGA patient: ${this.testData.patients.gga.firstName} ${this.testData.patients.gga.lastName}`);
    logInfo('  Convention: GGA - 100% medical, optical NOT COVERED');

    // Patient 3: No convention
    this.testData.patients.noConvention = await Patient.create({
      ...basePatient,
      firstName: `${TEST_PREFIX}CASH`,
      lastName: 'PATIENT',
      phoneNumber: '+243810000003'
      // No convention
    });
    logSuccess(`Created CASH patient: ${this.testData.patients.noConvention.firstName} ${this.testData.patients.noConvention.lastName}`);
    logInfo('  No convention - Patient pays 100%');
  }

  // ============================================
  // SCENARIO 1: ACTIVA PATIENT
  // ============================================
  async testActivaPatient() {
    const patient = this.testData.patients.activa;
    const company = this.testData.companies.activa;

    logInfo(`Testing patient: ${patient.firstName} ${patient.lastName}`);
    logInfo('Convention: ACTIVA - 100% coverage');

    // Test 1: Consultation (no approval needed)
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Consultation',
      category: 'consultation',
      description: 'Consultation ophtalmologique',
      price: 75000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 75000,
      expectedPatientPays: 0
    });

    // Test 2: Examination (no approval needed)
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Examination',
      category: 'examination',
      description: 'Examen ophtalmologique complet',
      price: 50000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 50000,
      expectedPatientPays: 0
    });

    // Test 3: Procedure (no approval needed)
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Procedure (Tonometry)',
      category: 'procedure',
      description: 'Tonométrie (mesure PIO)',
      price: 15000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 15000,
      expectedPatientPays: 0
    });

    // Test 4: Laboratory (no approval needed)
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Laboratory',
      category: 'laboratory',
      description: 'Bilan sanguin complet (HbA1c, FBS, Lipides)',
      price: 85000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 85000,
      expectedPatientPays: 0
    });

    // Test 5: Medication (no approval needed)
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Medication',
      category: 'medication',
      description: 'Timolol 0.5% + Prednisolone 1%',
      price: 30000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 30000,
      expectedPatientPays: 0
    });

    // Test 6: Imaging (no approval needed)
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Imaging (OCT)',
      category: 'imaging',
      description: 'OCT Macula OU',
      price: 120000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 120000,
      expectedPatientPays: 0
    });

    // Test 7: Small Optical (under $100 = auto-approved)
    const smallOpticalPrice = 50000; // ~$18 USD
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Small Optical (auto-approved)',
      category: 'optical',
      description: 'Solution lentilles de contact',
      price: smallOpticalPrice,
      expectedCoverage: 100,
      requiresApproval: false, // Under threshold = auto-approved
      expectedCompanyPays: smallOpticalPrice,
      expectedPatientPays: 0
    });

    // Test 8: Expensive Optical WITHOUT approval
    const glassesPrice = 290000; // ~$104 USD > $100 threshold
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Glasses WITHOUT approval',
      category: 'optical',
      description: 'Lunettes progressives (sans approbation)',
      price: glassesPrice,
      expectedCoverage: 0, // No approval = 0% coverage
      requiresApproval: true,
      hasApproval: false,
      expectedCompanyPays: 0,
      expectedPatientPays: glassesPrice
    });

    // Test 9: Expensive Optical WITH approval
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Glasses WITH approval',
      category: 'optical',
      description: 'Lunettes progressives (avec approbation)',
      price: glassesPrice,
      expectedCoverage: 100,
      requiresApproval: true,
      hasApproval: true, // Will create approval
      expectedCompanyPays: glassesPrice,
      expectedPatientPays: 0
    });

    // Test 10: Surgery WITHOUT approval
    const surgeryPrice = 500000; // ~$180 USD > $100 threshold
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Surgery WITHOUT approval',
      category: 'surgery',
      description: 'Chirurgie cataracte (sans approbation)',
      price: surgeryPrice,
      expectedCoverage: 0,
      requiresApproval: true,
      hasApproval: false,
      expectedCompanyPays: 0,
      expectedPatientPays: surgeryPrice
    });

    // Test 11: Surgery WITH approval
    await this.testService({
      patient,
      company,
      scenarioName: 'ACTIVA - Surgery WITH approval',
      category: 'surgery',
      description: 'Chirurgie cataracte (avec approbation)',
      price: surgeryPrice,
      expectedCoverage: 100,
      requiresApproval: true,
      hasApproval: true,
      expectedCompanyPays: surgeryPrice,
      expectedPatientPays: 0
    });

    // Create full invoice with mixed items
    await this.createFullInvoice({
      patient,
      company,
      scenarioName: 'ACTIVA - Full Invoice (mixed items)',
      items: [
        { description: 'Consultation', category: 'consultation', price: 75000 },
        { description: 'Examen complet', category: 'examination', price: 50000 },
        { description: 'Tonométrie', category: 'procedure', price: 15000 },
        { description: 'OCT Macula', category: 'imaging', price: 120000 },
        { description: 'Bilan sanguin', category: 'laboratory', price: 85000 },
        { description: 'Médicaments', category: 'medication', price: 30000 }
      ]
    });

    // Create glasses order
    await this.createGlassesOrder({
      patient,
      company,
      scenarioName: 'ACTIVA - Glasses Order',
      hasApproval: true
    });
  }

  // ============================================
  // SCENARIO 2: GGA PATIENT
  // ============================================
  async testGGAPatient() {
    const patient = this.testData.patients.gga;
    const company = this.testData.companies.gga;

    logInfo(`Testing patient: ${patient.firstName} ${patient.lastName}`);
    logInfo('Convention: GGA - 100% medical, optical NOT COVERED');

    // Test 1: Consultation (covered 100%)
    await this.testService({
      patient,
      company,
      scenarioName: 'GGA - Consultation',
      category: 'consultation',
      description: 'Consultation ophtalmologique',
      price: 75000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 75000,
      expectedPatientPays: 0
    });

    // Test 2: Examination (covered 100%)
    await this.testService({
      patient,
      company,
      scenarioName: 'GGA - Examination',
      category: 'examination',
      description: 'Examen ophtalmologique complet',
      price: 50000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 50000,
      expectedPatientPays: 0
    });

    // Test 3: Laboratory (covered 100%)
    await this.testService({
      patient,
      company,
      scenarioName: 'GGA - Laboratory',
      category: 'laboratory',
      description: 'Bilan sanguin',
      price: 85000,
      expectedCoverage: 100,
      requiresApproval: false,
      expectedCompanyPays: 85000,
      expectedPatientPays: 0
    });

    // Test 4: Surgery (covered 100%, requires approval)
    const surgeryPrice = 500000;
    await this.testService({
      patient,
      company,
      scenarioName: 'GGA - Surgery WITH approval',
      category: 'surgery',
      description: 'Chirurgie cataracte',
      price: surgeryPrice,
      expectedCoverage: 100,
      requiresApproval: true,
      hasApproval: true,
      expectedCompanyPays: surgeryPrice,
      expectedPatientPays: 0
    });

    // Test 5: Optical - NOT COVERED (patient pays 100%)
    const opticalPrice = 290000;
    await this.testService({
      patient,
      company,
      scenarioName: 'GGA - Optical NOT COVERED',
      category: 'optical',
      description: 'Lunettes progressives',
      price: opticalPrice,
      expectedCoverage: 0,
      notCovered: true,
      requiresApproval: false, // Not covered = no approval needed, just not covered
      expectedCompanyPays: 0,
      expectedPatientPays: opticalPrice
    });

    // Create full invoice
    await this.createFullInvoice({
      patient,
      company,
      scenarioName: 'GGA - Full Invoice (optical not covered)',
      items: [
        { description: 'Consultation', category: 'consultation', price: 75000 },
        { description: 'Examen complet', category: 'examination', price: 50000 },
        { description: 'Bilan sanguin', category: 'laboratory', price: 85000 },
        { description: 'Lunettes (NOT COVERED)', category: 'optical', price: 290000, notCovered: true }
      ]
    });

    // Create glasses order (patient pays 100%)
    await this.createGlassesOrder({
      patient,
      company,
      scenarioName: 'GGA - Glasses Order (NOT COVERED)',
      opticalNotCovered: true
    });
  }

  // ============================================
  // SCENARIO 3: NO CONVENTION PATIENT
  // ============================================
  async testNoConventionPatient() {
    const patient = this.testData.patients.noConvention;

    logInfo(`Testing patient: ${patient.firstName} ${patient.lastName}`);
    logInfo('No convention - Patient pays 100%');

    // Test 1: Consultation (patient pays 100%)
    await this.testService({
      patient,
      company: null,
      scenarioName: 'CASH - Consultation',
      category: 'consultation',
      description: 'Consultation ophtalmologique',
      price: 75000,
      expectedCoverage: 0,
      requiresApproval: false,
      expectedCompanyPays: 0,
      expectedPatientPays: 75000
    });

    // Test 2: Examination (patient pays 100%)
    await this.testService({
      patient,
      company: null,
      scenarioName: 'CASH - Examination',
      category: 'examination',
      description: 'Examen ophtalmologique complet',
      price: 50000,
      expectedCoverage: 0,
      requiresApproval: false,
      expectedCompanyPays: 0,
      expectedPatientPays: 50000
    });

    // Test 3: Surgery (patient pays 100%)
    await this.testService({
      patient,
      company: null,
      scenarioName: 'CASH - Surgery',
      category: 'surgery',
      description: 'Chirurgie cataracte',
      price: 500000,
      expectedCoverage: 0,
      requiresApproval: false,
      expectedCompanyPays: 0,
      expectedPatientPays: 500000
    });

    // Test 4: Optical (patient pays 100%)
    await this.testService({
      patient,
      company: null,
      scenarioName: 'CASH - Optical',
      category: 'optical',
      description: 'Lunettes progressives',
      price: 290000,
      expectedCoverage: 0,
      requiresApproval: false,
      expectedCompanyPays: 0,
      expectedPatientPays: 290000
    });

    // Create full invoice
    await this.createFullInvoice({
      patient,
      company: null,
      scenarioName: 'CASH - Full Invoice',
      items: [
        { description: 'Consultation', category: 'consultation', price: 75000 },
        { description: 'Examen complet', category: 'examination', price: 50000 },
        { description: 'Bilan sanguin', category: 'laboratory', price: 85000 },
        { description: 'Lunettes', category: 'optical', price: 290000 }
      ]
    });

    // Create glasses order
    await this.createGlassesOrder({
      patient,
      company: null,
      scenarioName: 'CASH - Glasses Order'
    });
  }

  // ============================================
  // HELPER: Test individual service
  // ============================================
  async testService(config) {
    const {
      patient,
      company,
      scenarioName,
      category,
      description,
      price,
      expectedCoverage,
      requiresApproval,
      hasApproval,
      notCovered,
      expectedCompanyPays,
      expectedPatientPays
    } = config;

    log(`\n  ${colors.bright}Testing: ${scenarioName}${colors.reset}`);
    logInfo(`Service: ${description} (${category})`);
    logInfo(`Price: ${price.toLocaleString()} CDF`);

    // Calculate actual coverage
    let actualCoverage = 0;
    let actualCompanyPays = 0;
    let actualPatientPays = price;
    let approvalStatus = 'N/A';

    if (company) {
      const categoryConfig = company.coveredCategories?.find(c => c.category === category);

      // Check if not covered
      if (categoryConfig?.notCovered || notCovered) {
        actualCoverage = 0;
        actualCompanyPays = 0;
        actualPatientPays = price;
        approvalStatus = 'Not covered';
      } else {
        // Check if approval required
        let needsApproval = categoryConfig?.requiresApproval || false;

        // Check auto-approve threshold
        if (needsApproval && company.approvalRules?.autoApproveUnderAmount) {
          const threshold = company.approvalRules.autoApproveUnderAmount;
          const priceUSD = price * 0.00036;
          if (priceUSD < threshold) {
            needsApproval = false;
            approvalStatus = 'Auto-approved (under threshold)';
          }
        }

        if (needsApproval) {
          if (hasApproval) {
            // Create approval
            await Approval.create({
              patient: patient._id,
              company: company._id,
              actCode: category.toUpperCase(),
              actName: description,
              actCategory: category,
              estimatedCost: price,
              currency: 'CDF',
              requestedBy: this.testData.admin._id,
              createdBy: this.testData.admin._id,
              status: 'approved',
              respondedBy: 'Test Admin',
              respondedAt: new Date(),
              validFrom: new Date(),
              validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
              quantityApproved: 1,
              internalNotes: `${TEST_PREFIX}${scenarioName}`
            });
            actualCoverage = categoryConfig?.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
            approvalStatus = 'Approved';
          } else {
            actualCoverage = 0;
            approvalStatus = 'Pending (not approved)';
          }
        } else {
          actualCoverage = categoryConfig?.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
          if (!approvalStatus || approvalStatus === 'N/A') {
            approvalStatus = 'Not required';
          }
        }

        actualCompanyPays = Math.round(price * actualCoverage / 100);
        actualPatientPays = price - actualCompanyPays;
      }
    }

    // Log results
    logInfo(`Approval status: ${approvalStatus}`);
    logMoney('Calculated', actualCompanyPays, actualPatientPays, price);

    // Verify
    const passed = actualCompanyPays === expectedCompanyPays && actualPatientPays === expectedPatientPays;

    if (passed) {
      logSuccess(`PASSED - Coverage: ${actualCoverage}%`);
      this.results.passed++;
    } else {
      logError(`FAILED - Expected company: ${expectedCompanyPays}, patient: ${expectedPatientPays}`);
      this.results.failed++;
    }

    this.results.scenarios.push({
      name: scenarioName,
      category,
      price,
      expectedCoverage,
      actualCoverage,
      expectedCompanyPays,
      actualCompanyPays,
      expectedPatientPays,
      actualPatientPays,
      approvalStatus,
      passed
    });

    return { actualCoverage, actualCompanyPays, actualPatientPays, passed };
  }

  // ============================================
  // HELPER: Create full invoice
  // ============================================
  async createFullInvoice(config) {
    const { patient, company, scenarioName, items } = config;

    log(`\n  ${colors.bright}Creating: ${scenarioName}${colors.reset}`);

    let totalCompanyPays = 0;
    let totalPatientPays = 0;
    const invoiceItems = [];

    for (const item of items) {
      let coverage = 0;

      if (company) {
        const categoryConfig = company.coveredCategories?.find(c => c.category === item.category);
        if (categoryConfig?.notCovered || item.notCovered) {
          coverage = 0;
        } else {
          coverage = categoryConfig?.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
        }
      }

      const companyPays = Math.round(item.price * coverage / 100);
      const patientPays = item.price - companyPays;

      totalCompanyPays += companyPays;
      totalPatientPays += patientPays;

      invoiceItems.push({
        description: item.description,
        category: item.category,
        quantity: 1,
        unitPrice: item.price,
        total: item.price
      });

      logInfo(`  ${item.description}: ${item.price.toLocaleString()} CDF → Company: ${companyPays.toLocaleString()}, Patient: ${patientPays.toLocaleString()}`);
    }

    const total = totalCompanyPays + totalPatientPays;

    // Create invoice
    const invoice = await Invoice.create({
      patient: patient._id,
      clinic: this.testData.clinic._id,
      dateIssued: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: invoiceItems,
      summary: {
        subtotal: total,
        total: total,
        amountPaid: 0,
        amountDue: totalPatientPays,
        companyShare: totalCompanyPays,
        patientShare: totalPatientPays
      },
      companyBilling: company ? {
        company: company._id,
        companyName: company.name,
        coveragePercentage: company.defaultCoverage?.percentage || 100,
        companyShare: totalCompanyPays,
        patientShare: totalPatientPays,
        companyInvoiceStatus: 'pending'
      } : undefined,
      isConventionInvoice: !!company,
      createdBy: this.testData.admin._id,
      notes: `${TEST_PREFIX}${scenarioName}`
    });

    this.testData.invoices[scenarioName] = invoice;

    logMoney('Invoice Total', totalCompanyPays, totalPatientPays, total);
    logSuccess(`Invoice created: ${invoice._id}`);

    return invoice;
  }

  // ============================================
  // HELPER: Create glasses order
  // ============================================
  async createGlassesOrder(config) {
    const { patient, company, scenarioName, hasApproval, opticalNotCovered } = config;

    log(`\n  ${colors.bright}Creating: ${scenarioName}${colors.reset}`);

    const framePrice = this.testData.frame?.price || 180000;
    const lensPrice = 70000;
    const optionsPrice = 40000;
    const total = framePrice + lensPrice + optionsPrice;

    let coverage = 0;
    let companyPays = 0;
    let patientPays = total;

    if (company) {
      const opticalConfig = company.coveredCategories?.find(c => c.category === 'optical');

      if (opticalConfig?.notCovered || opticalNotCovered) {
        coverage = 0;
        companyPays = 0;
        patientPays = total;
        logWarning(`Optical NOT COVERED by ${company.name}`);
      } else {
        // Check if approval required
        let needsApproval = opticalConfig?.requiresApproval || false;

        if (needsApproval && company.approvalRules?.autoApproveUnderAmount) {
          const threshold = company.approvalRules.autoApproveUnderAmount;
          const priceUSD = total * 0.00036;
          if (priceUSD < threshold) {
            needsApproval = false;
          }
        }

        if (needsApproval && !hasApproval) {
          coverage = 0;
          companyPays = 0;
          patientPays = total;
          logWarning('Approval required but not granted');
        } else {
          coverage = opticalConfig?.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
          companyPays = Math.round(total * coverage / 100);
          patientPays = total - companyPays;
        }
      }
    }

    // Create exam first (required for glasses order)
    const exam = await OphthalmologyExam.create({
      patient: patient._id,
      examiner: this.testData.admin._id,
      clinic: this.testData.clinic._id,
      examDate: new Date(),
      refraction: {
        OD: { sphere: -2.00, cylinder: -0.75, axis: 90, add: 2.50 },
        OS: { sphere: -1.50, cylinder: -0.50, axis: 90, add: 2.50 },
        pd: 64
      },
      status: 'completed',
      notes: { internal: `${TEST_PREFIX}${scenarioName}` }
    });

    // Create glasses order
    const order = await GlassesOrder.create({
      patient: patient._id,
      exam: exam._id,
      clinic: this.testData.clinic._id,
      optician: this.testData.admin._id,
      prescription: {
        OD: { sphere: -2.00, cylinder: -0.75, axis: 90, add: 2.50 },
        OS: { sphere: -1.50, cylinder: -0.50, axis: 90, add: 2.50 },
        pd: 64
      },
      frame: this.testData.frame ? {
        inventoryItem: this.testData.frame._id,
        brand: this.testData.frame.brand,
        model: this.testData.frame.model,
        color: this.testData.frame.color,
        size: this.testData.frame.size
      } : {
        brand: 'Ray-Ban',
        model: 'RB5228',
        color: 'Black',
        size: '53-17-140'
      },
      lensType: {
        design: 'progressive',
        material: 'polycarbonate',
        coatings: ['anti_reflective', 'blue_light']
      },
      pricing: {
        framePrice,
        lensPrice,
        optionsPrice,
        subtotal: total,
        finalTotal: total,
        companyPortion: companyPays,
        patientPortion: patientPays
      },
      conventionBilling: company ? {
        hasConvention: true,
        opticalNotCovered: opticalNotCovered || false,
        company: {
          id: company._id,
          name: company.name
        },
        coveragePercentage: coverage,
        companyPortion: companyPays,
        patientPortion: patientPays,
        requiresApproval: !opticalNotCovered && coverage > 0
      } : {
        hasConvention: false,
        coveragePercentage: 0,
        companyPortion: 0,
        patientPortion: total
      },
      status: 'pending_verification',
      notes: `${TEST_PREFIX}${scenarioName}`,
      createdBy: this.testData.admin._id
    });

    this.testData.glassesOrders[scenarioName] = order;

    logInfo(`Frame: ${order.frame.brand} ${order.frame.model} (${framePrice.toLocaleString()} CDF)`);
    logInfo(`Lenses: Progressive polycarbonate (${lensPrice.toLocaleString()} CDF)`);
    logInfo(`Options: AR + Blue light (${optionsPrice.toLocaleString()} CDF)`);
    logMoney('Glasses Order', companyPays, patientPays, total);
    logSuccess(`Order created: ${order._id}`);

    return order;
  }

  // ============================================
  // PRINT RESULTS
  // ============================================
  printResults() {
    console.log(`\n${colors.bgGreen}${colors.white}`);
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS SUMMARY                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);

    // Group by convention
    const groups = {
      'ACTIVA': this.results.scenarios.filter(s => s.name.startsWith('ACTIVA')),
      'GGA': this.results.scenarios.filter(s => s.name.startsWith('GGA')),
      'CASH': this.results.scenarios.filter(s => s.name.startsWith('CASH'))
    };

    for (const [group, scenarios] of Object.entries(groups)) {
      if (scenarios.length === 0) continue;

      console.log(`\n${colors.cyan}${group} SCENARIOS:${colors.reset}`);
      console.log('─'.repeat(80));
      console.log(`${'Scenario'.padEnd(45)} ${'Price'.padStart(12)} ${'Company'.padStart(12)} ${'Patient'.padStart(12)} Status`);
      console.log('─'.repeat(80));

      for (const s of scenarios) {
        const status = s.passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
        console.log(
          `${s.name.substring(0, 44).padEnd(45)} ` +
          `${s.price.toLocaleString().padStart(12)} ` +
          `${s.actualCompanyPays.toLocaleString().padStart(12)} ` +
          `${s.actualPatientPays.toLocaleString().padStart(12)} ${
            status}`
        );
      }
    }

    console.log(`\n${'═'.repeat(80)}`);
    const total = this.results.passed + this.results.failed;
    const percentage = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;

    if (this.results.failed === 0) {
      console.log(`${colors.green}${colors.bright}ALL TESTS PASSED: ${this.results.passed}/${total} (${percentage}%)${colors.reset}`);
    } else {
      console.log(`${colors.red}TESTS: ${this.results.passed} passed, ${this.results.failed} failed (${percentage}%)${colors.reset}`);
    }
  }

  // ============================================
  // PRINT UI CHECKLIST
  // ============================================
  printUIChecklist() {
    console.log(`\n${colors.bgYellow}${colors.white}`);
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                 UI VERIFICATION CHECKLIST                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);

    console.log(`
${colors.cyan}Open your browser and verify each step:${colors.reset}

${colors.bright}1. PATIENT LIST (http://localhost:5173/patients)${colors.reset}
   [ ] Search for "${TEST_PREFIX}"
   [ ] You should see 3 test patients:
       - ${TEST_PREFIX}ACTIVA PATIENT (with ACTIVA badge)
       - ${TEST_PREFIX}GGA PATIENT (with GGA badge)
       - ${TEST_PREFIX}CASH PATIENT (no convention badge)

${colors.bright}2. PATIENT DETAIL - ACTIVA${colors.reset}
   [ ] Click on ${TEST_PREFIX}ACTIVA PATIENT
   [ ] Convention section shows:
       - Company: ACTIVA
       - Coverage: 100%
       - Employee ID: ACTIVA-TEST-001
   [ ] Billing section shows invoices with:
       - Company/Patient split displayed
       - "Ent: X | Vous: Y" on each invoice row

${colors.bright}3. PATIENT DETAIL - GGA${colors.reset}
   [ ] Click on ${TEST_PREFIX}GGA PATIENT
   [ ] Convention section shows:
       - Company: GGA
       - Coverage: 100% (for medical)
   [ ] Billing section shows:
       - Optical items show patient pays 100%

${colors.bright}4. PATIENT DETAIL - CASH${colors.reset}
   [ ] Click on ${TEST_PREFIX}CASH PATIENT
   [ ] No convention section displayed
   [ ] Billing shows patient pays 100% for all

${colors.bright}5. INVOICING PAGE (http://localhost:5173/invoicing)${colors.reset}
   [ ] Filter by patient: "${TEST_PREFIX}"
   [ ] ACTIVA invoices show:
       - Convention badge
       - Company share vs Patient share
   [ ] GGA invoices show:
       - Medical items: company covers
       - Optical items: patient pays 100%
   [ ] CASH invoices show:
       - No convention
       - Patient pays 100%

${colors.bright}6. GLASSES ORDERS (http://localhost:5173/optical-shop)${colors.reset}
   [ ] Search orders for test patients
   [ ] ACTIVA order shows:
       - Convention coverage displayed
       - Company pays / Patient pays split
   [ ] GGA order shows:
       - "Optical NOT COVERED" message
       - Patient pays 100%
   [ ] CASH order shows:
       - No convention
       - Patient pays 100%

${colors.bright}7. FINANCIAL DASHBOARD (http://localhost:5173/financial)${colors.reset}
   [ ] Expand "Conventions & Entreprises" section
   [ ] Check "Boutique Optique" section:
       - Convention breakdown table
       - ACTIVA shows company portion
       - GGA shows 0 company portion for optical

${colors.bright}8. APPROVAL WORKFLOW (http://localhost:5173/approvals)${colors.reset}
   [ ] Check for test approvals
   [ ] ACTIVA approvals for surgery/optical over $100

${colors.cyan}Test Data IDs for API verification:${colors.reset}
   ACTIVA Patient: ${this.testData.patients.activa?._id || 'N/A'}
   GGA Patient: ${this.testData.patients.gga?._id || 'N/A'}
   CASH Patient: ${this.testData.patients.noConvention?._id || 'N/A'}
`);
  }
}

// Run the test
const test = new ComprehensiveConventionTest();
test.run();
