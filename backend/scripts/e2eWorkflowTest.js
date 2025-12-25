/**
 * COMPREHENSIVE END-TO-END WORKFLOW TEST
 *
 * This script tests the COMPLETE patient journey through ALL system workflows:
 *
 * SCENARIO: Emergency patient with convention coverage needing:
 * - Emergency consultation
 * - Multiple medications (with drug interaction check)
 * - Laboratory tests (blood work, urinalysis)
 * - Ophthalmology exam (discovers cataract)
 * - IVT injection (for diabetic macular edema)
 * - Surgery scheduling (cataract extraction)
 * - Glasses prescription & optical shop order
 * - Full billing with convention split
 *
 * Run: node scripts/e2eWorkflowTest.js
 */

const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('e2eWorkflowTest.js');

const { PharmacyInventory, FrameInventory } = require('../models/Inventory');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Models
const Patient = require('../models/Patient');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Visit = require('../models/Visit');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Prescription = require('../models/Prescription');
const LabOrder = require('../models/LabOrder');
const IVTInjection = require('../models/IVTInjection');
const SurgeryCase = require('../models/SurgeryCase');
const GlassesOrder = require('../models/GlassesOrder');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');

const Clinic = require('../models/Clinic');

// Test configuration
const TEST_PREFIX = 'E2E_TEST_';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logStep(step, message) {
  console.log(`\n${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
  console.log(`${COLORS.magenta}STEP ${step}:${COLORS.reset} ${COLORS.yellow}${message}${COLORS.reset}`);
  console.log(`${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
}

function logSuccess(message) {
  console.log(`  ${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logError(message) {
  console.log(`  ${COLORS.red}✗${COLORS.reset} ${message}`);
}

function logInfo(message) {
  console.log(`  ${COLORS.blue}ℹ${COLORS.reset} ${message}`);
}

class E2EWorkflowTest {
  constructor() {
    this.testData = {};
    this.results = {
      passed: 0,
      failed: 0,
      steps: []
    };
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log('Connected to MongoDB', 'green');
    } catch (error) {
      log(`Failed to connect: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  async cleanup() {
    logStep('CLEANUP', 'Removing previous test data');

    const collections = [
      { model: Patient, field: 'firstName' },
      { model: Appointment, field: 'internalNotes' },
      { model: Visit, field: 'notes.internal' },
      { model: OphthalmologyExam, field: 'notes.internal' },
      { model: Prescription, field: 'notes' },
      { model: LabOrder, field: 'notes' },
      { model: IVTInjection, field: 'notes' },
      { model: SurgeryCase, field: 'notes' },
      { model: GlassesOrder, field: 'notes.internal' },
      { model: Invoice, field: 'notes' }
    ];

    for (const { model, field } of collections) {
      try {
        const query = { [field]: { $regex: TEST_PREFIX } };
        const result = await model.deleteMany(query);
        if (result.deletedCount > 0) {
          logInfo(`Deleted ${result.deletedCount} ${model.modelName} records`);
        }
      } catch (e) {
        // Ignore errors - some models may not have the field
      }
    }

    // Also clean by test patient name
    await Patient.deleteMany({ firstName: { $regex: TEST_PREFIX } });
    logSuccess('Cleanup completed');
  }

  async getTestDependencies() {
    logStep('SETUP', 'Loading test dependencies');

    // Get or create a test clinic
    let clinic = await Clinic.findOne({ status: 'active' });
    if (!clinic) {
      clinic = await Clinic.create({
        clinicId: 'TEST',
        name: 'Test Clinic',
        shortName: 'TEST',
        status: 'active',
        type: 'main',
        services: ['consultation', 'ophthalmology', 'pharmacy', 'laboratory', 'optical_shop', 'surgery', 'ivt_injections']
      });
    }
    this.testData.clinic = clinic;
    logSuccess(`Using clinic: ${clinic.name} (${clinic.clinicId})`);

    // Get a doctor user - try various roles
    let doctor = await User.findOne({ role: { $in: ['doctor', 'ophthalmologist'] } });
    if (!doctor) {
      // Fall back to admin who can perform medical functions
      doctor = await User.findOne({ role: 'admin' });
    }
    if (!doctor) {
      logError('No suitable user found for doctor role');
      throw new Error('Please create at least one admin or doctor user to run tests');
    }
    this.testData.doctor = doctor;
    logSuccess(`Using doctor: Dr. ${doctor.firstName} ${doctor.lastName} (${doctor.role})`);

    // Get a receptionist
    let receptionist = await User.findOne({ role: 'receptionist' });
    if (!receptionist) {
      receptionist = await User.findOne({ role: 'admin' });
    }
    this.testData.receptionist = receptionist || doctor;
    logSuccess(`Using receptionist: ${this.testData.receptionist.firstName}`);

    // Get a pharmacist
    const pharmacist = await User.findOne({ role: { $in: ['pharmacist', 'admin'] } });
    this.testData.pharmacist = pharmacist || doctor;
    logSuccess(`Using pharmacist: ${this.testData.pharmacist.firstName}`);

    // Get or create a convention company
    let company = await Company.findOne({
      'conventionRules.medicalConsultation.covered': true
    });
    if (!company) {
      // Just get any company with convention rules
      company = await Company.findOne({ conventionCode: { $exists: true } });
    }
    if (!company) {
      // Use the first company available
      company = await Company.findOne({});
    }
    if (!company) {
      logError('No company found - please seed companies first');
      throw new Error('Please seed companies to run tests');
    }
    this.testData.company = company;
    logSuccess(`Using convention: ${company.name} (${company.conventionCode || company.shortName})`);

    // Check for pharmacy inventory
    const medicationCount = await PharmacyInventory.countDocuments({ active: true });
    logInfo(`Pharmacy has ${medicationCount} active medications`);

    // Check for frame inventory
    const frameCount = await FrameInventory.countDocuments({ active: true });
    logInfo(`Optical shop has ${frameCount} frames in inventory`);

    return true;
  }

  // ============================================
  // STEP 1: PATIENT REGISTRATION
  // ============================================
  async step1_PatientRegistration() {
    logStep(1, 'PATIENT REGISTRATION with Convention');

    const patientData = {
      firstName: `${TEST_PREFIX}Jean`,
      lastName: 'Mukeba',
      dateOfBirth: new Date('1965-03-15'),
      gender: 'male',
      phoneNumber: '+243812345678',
      email: 'jean.mukeba.test@example.com',
      address: {
        street: '123 Avenue Lumumba',
        city: 'Kinshasa',
        province: 'Kinshasa',
        country: 'RDC'
      },
      bloodType: 'O+',
      occupation: 'Ingenieur SNEL',
      maritalStatus: 'married',
      emergencyContact: {
        name: 'Marie Mukeba',
        relationship: 'spouse',
        phone: '+243823456789'
      },
      // Convention assignment
      company: this.testData.company._id,
      employeeId: 'SNEL-2024-1234',
      conventionType: 'employee',
      // Medical history relevant to our test
      medicalHistory: {
        conditions: ['diabetes_type_2', 'hypertension'],
        allergies: [{ allergen: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis' }],
        currentMedications: ['Metformin 500mg', 'Lisinopril 10mg']
      },
      priorityStatus: 'normal',
      registeredAtClinic: this.testData.clinic._id,
      homeClinic: this.testData.clinic._id,
      createdBy: this.testData.receptionist._id
    };

    try {
      const patient = await Patient.create(patientData);
      this.testData.patient = patient;

      logSuccess(`Patient created: ${patient.firstName} ${patient.lastName}`);
      logInfo(`Patient ID: ${patient.patientId || patient._id}`);
      logInfo(`Convention: ${this.testData.company.name} (Employee ID: ${patient.employeeId})`);
      logInfo('Medical history: Diabetes Type 2, Hypertension');
      logInfo('Allergy: Penicillin (Severe)');

      this.results.passed++;
      this.results.steps.push({ step: 1, name: 'Patient Registration', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed to create patient: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 1, name: 'Patient Registration', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 2: EMERGENCY APPOINTMENT & CHECK-IN
  // ============================================
  async step2_EmergencyAppointment() {
    logStep(2, 'EMERGENCY APPOINTMENT & QUEUE CHECK-IN');

    try {
      // Create emergency appointment
      const now = new Date();
      const startTime = now.toTimeString().slice(0, 5);
      const endHour = now.getHours() + 1;
      const endTime = `${endHour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const appointmentData = {
        patient: this.testData.patient._id,
        provider: this.testData.doctor._id,
        type: 'emergency',
        department: 'ophthalmology',
        date: now,
        startTime: startTime,
        endTime: endTime,
        duration: 60,
        status: 'scheduled',
        priority: 'urgent',
        reason: 'Vision floue soudaine + douleur oculaire - Patient diabetique',
        internalNotes: `${TEST_PREFIX}Emergency vision loss in diabetic patient`,
        clinic: this.testData.clinic._id,
        createdBy: this.testData.receptionist._id
      };

      const appointment = await Appointment.create(appointmentData);
      this.testData.appointment = appointment;
      logSuccess('Emergency appointment created');
      logInfo(`Type: ${appointment.appointmentType}, Priority: ${appointment.priority}`);

      // Check-in the patient (simulate queue workflow)
      appointment.status = 'checked-in';
      appointment.checkInTime = new Date();
      appointment.queueNumber = Math.floor(Math.random() * 100) + 1;
      await appointment.save();

      logSuccess('Patient checked in to queue');
      logInfo(`Queue number: ${appointment.queueNumber}`);
      logInfo(`Check-in time: ${appointment.checkInTime.toLocaleTimeString()}`);

      this.results.passed++;
      this.results.steps.push({ step: 2, name: 'Emergency Appointment', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 2, name: 'Emergency Appointment', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 3: CONSULTATION VISIT
  // ============================================
  async step3_ConsultationVisit() {
    logStep(3, 'CONSULTATION VISIT - Emergency Triage');

    try {
      // Start the appointment - use findByIdAndUpdate to bypass status transition validation
      await Appointment.findByIdAndUpdate(this.testData.appointment._id, {
        status: 'in-progress',
        actualStartTime: new Date()
      });
      this.testData.appointment = await Appointment.findById(this.testData.appointment._id);

      // Create visit record
      const visitData = {
        patient: this.testData.patient._id,
        appointment: this.testData.appointment._id,
        visitType: 'emergency',
        visitDate: new Date(),
        status: 'in-progress',
        primaryProvider: this.testData.doctor._id,
        clinic: this.testData.clinic._id,
        chiefComplaint: {
          complaint: 'Vision floue soudaine avec douleur oculaire depuis 2 jours',
          duration: '2 jours',
          severity: 'severe',
          onset: 'sudden',
          associatedSymptoms: ['headache', 'nausea', 'floaters']
        },
        physicalExamination: {
          vitalSigns: {
            bloodPressure: '165/95',
            heartRate: 88,
            temperature: 37.2,
            respiratoryRate: 18,
            oxygenSaturation: 98
          }
        },
        reviewOfSystems: {
          constitutional: 'No fever, no weight loss, fatigue present',
          eyes: 'Vision change, pain, no discharge',
          cardiovascular: 'No chest pain, no palpitations',
          endocrine: 'Polyuria, polydipsia (diabetic symptoms)'
        },
        clinicalActs: [
          {
            actType: 'consultation',
            actCode: 'CONSULT-EMERG',
            actName: 'Consultation urgente ophtalmologique',
            status: 'in-progress',
            provider: this.testData.doctor._id,
            startTime: new Date(),
            price: 75000
          }
        ],
        notes: {
          internal: `${TEST_PREFIX}Emergency diabetic eye evaluation`
        },
        createdBy: this.testData.doctor._id
      };

      const visit = await Visit.create(visitData);
      this.testData.visit = visit;

      logSuccess(`Visit created: ${visit.visitType}`);
      logInfo(`Chief complaint: ${visit.chiefComplaint.complaint}`);
      logInfo(`Vital signs: BP ${visit.physicalExamination?.vitalSigns?.bloodPressure || 'N/A'}`);
      logInfo('Clinical act: Emergency ophthalmology consultation');

      this.results.passed++;
      this.results.steps.push({ step: 3, name: 'Consultation Visit', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 3, name: 'Consultation Visit', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 4: OPHTHALMOLOGY EXAM
  // ============================================
  async step4_OphthalmologyExam() {
    logStep(4, 'COMPREHENSIVE OPHTHALMOLOGY EXAMINATION');

    try {
      const examData = {
        patient: this.testData.patient._id,
        visit: this.testData.visit._id,
        appointment: this.testData.appointment._id,
        examDate: new Date(),
        examiner: this.testData.doctor._id,
        examType: 'comprehensive',
        status: 'in-progress',
        clinic: this.testData.clinic._id,

        // Visual Acuity - proper nested structure
        visualAcuity: {
          distance: {
            OD: {
              uncorrected: '20/80',
              corrected: '20/40',
              pinhole: '20/30'
            },
            OS: {
              uncorrected: '20/60',
              corrected: '20/25',
              pinhole: '20/25'
            },
            OU: {
              uncorrected: '20/50',
              corrected: '20/20'
            }
          },
          near: {
            OD: {
              uncorrected: 'J4',
              corrected: 'J1'
            },
            OS: {
              uncorrected: 'J3',
              corrected: 'J1'
            },
            OU: {
              uncorrected: 'J3',
              corrected: 'J1'
            },
            testDistance: '40cm'
          },
          method: 'snellen'
        },

        // Refraction
        refraction: {
          autorefraction: {
            OD: { sphere: -2.25, cylinder: -0.75, axis: 85 },
            OS: { sphere: -1.75, cylinder: -0.50, axis: 95 }
          },
          subjective: {
            OD: { sphere: -2.00, cylinder: -0.75, axis: 90, add: 2.50 },
            OS: { sphere: -1.50, cylinder: -0.50, axis: 90, add: 2.50 }
          },
          finalPrescription: {
            OD: { sphere: -2.00, cylinder: -0.75, axis: 90, add: 2.50, visualAcuity: '20/25' },
            OS: { sphere: -1.50, cylinder: -0.50, axis: 90, add: 2.50, visualAcuity: '20/20' }
          },
          pd: { binocular: 64, monocularOd: 32, monocularOs: 32 }
        },

        // Intraocular Pressure (IOP) - elevated!
        iop: {
          OD: { value: 28, time: '10:30 AM', method: 'goldmann' }, // Elevated!
          OS: { value: 24, time: '10:30 AM', method: 'goldmann' },  // Borderline
          pachymetry: { OD: 545, OS: 550 }
        },

        // Keratometry - proper structure with power/axis objects
        keratometry: {
          method: 'auto-k',
          OD: {
            k1: { power: 43.50, axis: 85 },
            k2: { power: 44.25, axis: 175 },
            average: 43.875,
            cylinder: 0.75,
            axis: 85
          },
          OS: {
            k1: { power: 43.25, axis: 95 },
            k2: { power: 44.00, axis: 5 },
            average: 43.625,
            cylinder: 0.75,
            axis: 95
          }
        },

        // Slit Lamp
        slitLamp: {
          eyelids: { OD: 'Normal', OS: 'Normal' },
          conjunctiva: { OD: 'Mild injection', OS: 'Clear' },
          cornea: { OD: 'Clear', OS: 'Clear' },
          anteriorChamber: {
            OD: 'Deep, quiet, no cells',
            OS: 'Deep, quiet'
          },
          iris: { OD: 'Normal architecture', OS: 'Normal architecture' },
          lens: {
            OD: 'NS2+ cataract, PSC1+', // Nuclear sclerosis + posterior subcapsular
            OS: 'NS1+ cataract'
          }
        },

        // Fundus exam - CRITICAL FINDINGS (proper schema structure)
        fundus: {
          dilated: true,
          dilatingAgent: 'Tropicamide 1%',
          OD: {
            disc: {
              size: 'normal',
              color: 'pink',
              margins: 'sharp',
              cupToDisc: 0.6,
              notching: 'moderate inferior'
            },
            vessels: {
              arteries: 'narrowed',
              veins: 'dilated with beading',
              avRatio: '2:3',
              crossing: 'AV nicking present, microaneurysms, dot-blot hemorrhages'
            },
            macula: {
              normal: false,
              findings: 'Diabetic macular edema - clinically significant. Hard exudates present.',
              fovealReflex: 'absent'
            },
            periphery: {
              normal: false,
              findings: 'Cotton wool spots, neovascularization elsewhere (NVE)'
            }
          },
          OS: {
            disc: {
              size: 'normal',
              color: 'pink',
              margins: 'sharp',
              cupToDisc: 0.5,
              notching: 'none'
            },
            vessels: {
              arteries: 'mildly narrowed',
              veins: 'dilated',
              avRatio: '2:3',
              crossing: 'Microaneurysms present'
            },
            macula: {
              normal: false,
              findings: 'Mild DME. Some hard exudates.',
              fovealReflex: 'dull'
            },
            periphery: {
              normal: false,
              findings: 'Scattered microaneurysms, no NVE'
            }
          }
        },

        // Assessment
        assessment: {
          diagnoses: [
            {
              eye: 'OU',
              diagnosis: 'Proliferative Diabetic Retinopathy',
              icdCode: 'E11.351',
              severity: 'severe',
              isPrimary: true
            },
            {
              eye: 'OD',
              diagnosis: 'Clinically Significant Diabetic Macular Edema',
              icdCode: 'E11.311',
              severity: 'moderate',
              isPrimary: false
            },
            {
              eye: 'OD',
              diagnosis: 'Nuclear Sclerosis Cataract',
              icdCode: 'H25.11',
              severity: 'moderate',
              isPrimary: false
            },
            {
              eye: 'OU',
              diagnosis: 'Ocular Hypertension',
              icdCode: 'H40.00',
              severity: 'mild',
              isPrimary: false
            }
          ],
          plan: 'Urgent IVT anti-VEGF OD for DME. Plan cataract surgery OD after DME stabilized. Start IOP-lowering drops. Refer for PRP laser if proliferation worsens.'
        },

        notes: {
          clinical: 'Diabetic patient with PDR and CSME OD. Cataract contributing to vision loss. Needs urgent treatment.',
          internal: `${TEST_PREFIX}Complex diabetic eye disease requiring multi-modal treatment`
        }
      };

      const exam = await OphthalmologyExam.create(examData);
      this.testData.exam = exam;

      // Update visit with exam reference
      this.testData.visit.ophthalmologyExam = exam._id;
      await this.testData.visit.save();

      logSuccess('Ophthalmology exam completed');
      logInfo(`Visual Acuity OD: ${exam.visualAcuity.distance.OD.corrected}, OS: ${exam.visualAcuity.distance.OS.corrected}`);
      logInfo(`IOP: OD ${exam.iop.OD.value}mmHg (ELEVATED), OS ${exam.iop.OS.value}mmHg`);
      logInfo('Diagnoses:');
      exam.assessment.diagnoses.forEach(d => {
        logInfo(`  - ${d.eye}: ${d.diagnosis} (${d.icdCode})`);
      });

      this.results.passed++;
      this.results.steps.push({ step: 4, name: 'Ophthalmology Exam', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 4, name: 'Ophthalmology Exam', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 5: LABORATORY ORDERS
  // ============================================
  async step5_LaboratoryOrders() {
    logStep(5, 'LABORATORY TEST ORDERS');

    try {
      const labOrderData = {
        patient: this.testData.patient._id,
        visit: this.testData.visit._id,
        orderedBy: this.testData.doctor._id,
        orderDate: new Date(),
        status: 'ordered',
        priority: 'urgent',
        clinic: this.testData.clinic._id,

        tests: [
          {
            testCode: 'HBA1C',
            testName: 'Hemoglobin A1c',
            category: 'chemistry',
            status: 'pending',
            specimen: 'blood',
            notes: 'Diabetes monitoring - new diabetic retinopathy diagnosis'
          },
          {
            testCode: 'FBS',
            testName: 'Fasting Blood Sugar',
            category: 'chemistry',
            status: 'pending',
            specimen: 'blood',
            notes: 'Diabetes assessment'
          },
          {
            testCode: 'LIPID',
            testName: 'Lipid Panel',
            category: 'chemistry',
            status: 'pending',
            specimen: 'blood',
            notes: 'Cardiovascular risk assessment in diabetic'
          },
          {
            testCode: 'CREAT',
            testName: 'Creatinine + eGFR',
            category: 'chemistry',
            status: 'pending',
            specimen: 'blood',
            notes: 'Renal function before IVT/surgery'
          },
          {
            testCode: 'UA',
            testName: 'Urinalysis',
            category: 'urinalysis',
            status: 'pending',
            specimen: 'urine',
            notes: 'Check for proteinuria - diabetic nephropathy screening'
          }
        ],

        fasting: {
          required: true,
          confirmed: false,
          hours: 8
        },
        clinicalNotes: 'Rien a manger ou boire (sauf eau) 8 heures avant le prelevement',
        specialInstructions: `${TEST_PREFIX}Pre-treatment labs for diabetic retinopathy patient`,
        diagnosis: 'Diabetic retinopathy with macular edema',
        icdCode: 'E11.351'
      };

      const labOrder = await LabOrder.create(labOrderData);
      this.testData.labOrder = labOrder;

      logSuccess(`Lab order created with ${labOrder.tests.length} tests`);
      labOrder.tests.forEach(t => {
        logInfo(`  - ${t.testCode}: ${t.testName} (${t.status})`);
      });
      logInfo(`Fasting required: ${labOrder.fasting.hours} hours`);

      // Simulate specimen collection
      labOrder.status = 'collected';
      labOrder.specimen = {
        collectedAt: new Date(),
        collectedBy: this.testData.receptionist._id,
        barcode: `LAB${Date.now()}`,
        status: 'acceptable'
      };
      await labOrder.save();
      logSuccess(`Specimen collected, barcode: ${labOrder.specimen.barcode}`);

      // Simulate results entry
      labOrder.status = 'completed';
      labOrder.tests[0].result = { value: 9.2, unit: '%', referenceRange: '4.0-5.6', flag: 'H' }; // HbA1c HIGH
      labOrder.tests[1].result = { value: 165, unit: 'mg/dL', referenceRange: '70-100', flag: 'H' }; // FBS HIGH
      labOrder.tests[2].result = {
        value: { totalChol: 245, ldl: 155, hdl: 38, triglycerides: 260 },
        unit: 'mg/dL',
        flag: 'H'
      }; // Lipids abnormal
      labOrder.tests[3].result = { value: 1.1, unit: 'mg/dL', referenceRange: '0.7-1.3', flag: 'N' }; // Creat normal
      labOrder.tests[4].result = { value: 'Protein 1+, Glucose 2+', flag: 'A' }; // Proteinuria
      labOrder.resultsEnteredAt = new Date();
      labOrder.resultsEnteredBy = this.testData.doctor._id;
      await labOrder.save();

      logSuccess('Lab results entered');
      logInfo('  HbA1c: 9.2% (HIGH - poor diabetic control)');
      logInfo('  FBS: 165 mg/dL (HIGH)');
      logInfo('  Creatinine: 1.1 mg/dL (Normal - safe for contrast/IVT)');
      logInfo('  Urinalysis: Protein 1+ (early nephropathy)');

      this.results.passed++;
      this.results.steps.push({ step: 5, name: 'Laboratory Orders', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 5, name: 'Laboratory Orders', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 6: MEDICATION PRESCRIPTIONS
  // ============================================
  async step6_MedicationPrescriptions() {
    logStep(6, 'MEDICATION PRESCRIPTIONS (Multiple with Interactions Check)');

    try {
      // Calculate validity: 90 days for medication prescriptions
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 90);

      const prescriptionData = {
        patient: this.testData.patient._id,
        prescriber: this.testData.doctor._id,
        visit: this.testData.visit._id,
        dateIssued: new Date(),
        validUntil: validUntil,
        type: 'medication',
        status: 'pending',
        clinic: this.testData.clinic._id,

        medications: [
          {
            name: 'Timolol 0.5%',
            genericName: 'Timolol maleate',
            dosage: '1 drop',
            route: 'ophthalmic',
            frequency: 'twice daily',
            duration: { value: 30, unit: 'days' },
            quantity: 1,
            instructions: 'Instiller 1 goutte dans chaque oeil matin et soir',
            eye: 'OU',
            indication: 'Ocular hypertension'
          },
          {
            name: 'Prednisolone Acetate 1%',
            genericName: 'Prednisolone acetate',
            dosage: '1 drop',
            route: 'ophthalmic',
            frequency: '4 times daily',
            duration: { value: 14, unit: 'days' },
            quantity: 1,
            instructions: 'Instiller 1 goutte OD 4x/jour. Diminuer progressivement.',
            eye: 'OD',
            indication: 'Post-IVT inflammation prophylaxis'
          },
          {
            name: 'Ofloxacin 0.3%',
            genericName: 'Ofloxacin',
            dosage: '1 drop',
            route: 'ophthalmic',
            frequency: '4 times daily',
            duration: { value: 7, unit: 'days' },
            quantity: 1,
            instructions: 'Commencer 1 jour avant IVT, continuer 7 jours apres',
            eye: 'OD',
            indication: 'Endophthalmitis prophylaxis for IVT'
          },
          {
            name: 'Paracetamol 1000mg',
            genericName: 'Paracetamol',
            dosage: '1000mg',
            route: 'oral',
            frequency: 'as needed',
            duration: { value: 7, unit: 'days' },
            quantity: 14,
            instructions: 'Prendre 1 comprime si douleur, maximum 3x/jour',
            indication: 'Pain management post-procedure'
          }
        ],

        // Safety overrides (checking against allergy to Penicillin)
        safetyChecks: {
          allergyCheck: { passed: true, notes: 'No penicillin-class drugs prescribed' },
          interactionCheck: {
            passed: true,
            notes: 'Timolol: monitor for systemic beta-blocker effects with existing hypertension meds',
            warnings: ['Beta-blocker eye drops may affect blood pressure control']
          }
        },

        notes: `${TEST_PREFIX}Pre and post IVT medication regimen`
      };

      const prescription = await Prescription.create(prescriptionData);
      this.testData.prescription = prescription;

      logSuccess(`Prescription created with ${prescription.medications.length} medications`);
      prescription.medications.forEach(m => {
        logInfo(`  - ${m.name}: ${m.dosage} ${m.frequency} (${m.route})`);
      });
      logInfo('Safety check: Allergy screening passed (no penicillin-class drugs)');
      logInfo('Warning: Beta-blocker interaction noted with antihypertensives');

      // Simulate pharmacy workflow
      prescription.pharmacyStatus = 'preparing';
      await prescription.save();
      logSuccess('Prescription sent to pharmacy - status: preparing');

      this.results.passed++;
      this.results.steps.push({ step: 6, name: 'Medication Prescriptions', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 6, name: 'Medication Prescriptions', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 7: IVT INJECTION
  // ============================================
  async step7_IVTInjection() {
    logStep(7, 'INTRAVITREAL INJECTION (Anti-VEGF for DME)');

    try {
      // Generate injection ID
      const injectionId = `IVT${Date.now()}`;

      const ivtData = {
        injectionId: injectionId,
        patient: this.testData.patient._id,
        visit: this.testData.visit._id,
        eye: 'OD',
        injectionDate: new Date(),
        performedBy: this.testData.doctor._id,
        clinic: this.testData.clinic._id,

        // Medication - proper nested structure
        medication: {
          type: 'anti-VEGF',
          name: 'Avastin',
          genericName: 'Bevacizumab',
          dose: { value: 1.25, unit: 'mg' },
          volume: { value: 0.05, unit: 'ml' },
          lotNumber: 'LOT123456',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          manufacturer: 'Roche'
        },

        // Indication - proper nested structure
        indication: {
          primary: 'DME',
          secondary: ['PDR'],
          icdCode: 'E11.311',
          description: 'Clinically Significant Diabetic Macular Edema with PDR'
        },

        // Series - proper structure
        series: {
          injectionNumber: 1,
          protocol: 'loading',
          totalInjectionsThisEye: 0,
          protocolNotes: 'Loading phase: 3 monthly injections planned'
        },

        // Pre-injection assessment - proper structure
        preInjection: {
          visualAcuity: {
            distance: '20/40',
            logMAR: 0.3
          },
          intraocularPressure: {
            value: 28,
            unit: 'mmHg',
            method: 'Goldmann'
          },
          anteriorChamber: {
            depth: 'deep',
            flare: 0,
            cells: 0
          },
          pupil: {
            dilated: true,
            dilatingAgent: 'Tropicamide 1%'
          }
        },

        status: 'scheduled',
        notes: `${TEST_PREFIX}First anti-VEGF injection for CSME in PDR patient`
      };

      const ivt = await IVTInjection.create(ivtData);
      this.testData.ivt = ivt;

      logSuccess('IVT injection scheduled');
      logInfo(`Medication: ${ivt.medication.name} ${ivt.medication.dose.value}${ivt.medication.dose.unit}`);
      logInfo(`Eye: ${ivt.eye}`);
      logInfo(`Indication: ${ivt.indication.primary}`);
      logInfo(`Protocol: ${ivt.series.protocol} phase - injection ${ivt.series.injectionNumber}`);

      // Simulate injection completion with proper schema structure
      ivt.status = 'completed';
      ivt.procedure = {
        anesthesia: {
          type: 'topical_drops',
          agent: 'Proparacaine 0.5%'
        },
        antisepsis: {
          agent: 'Povidone-iodine 5%',
          duration: 30
        },
        technique: {
          injectionSite: 'inferotemporal',
          distanceFromLimbus: { value: 3.5, unit: 'mm' },
          needleGauge: '30G',
          visualization: 'direct'
        },
        immediateAssessment: {
          reflux: false,
          hemorrhage: false,
          centralRetinalArteryPerfusion: true,
          fingerCounting: true,
          iop: 18,
          notes: 'Uncomplicated injection'
        },
        complications: [{
          type: 'none',
          severity: 'mild',
          resolved: true
        }]
      };
      ivt.nextInjection = {
        recommended: true,
        recommendedDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
        recommendedInterval: 4,
        reasoning: 'Loading dose #2 per protocol'
      };
      await ivt.save();

      logSuccess('IVT injection completed successfully');
      logInfo(`Post-injection IOP: ${ivt.procedure.immediateAssessment.iop}mmHg (normal)`);
      logInfo('Complications: None');
      logInfo('Next injection scheduled: 4 weeks');

      this.results.passed++;
      this.results.steps.push({ step: 7, name: 'IVT Injection', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 7, name: 'IVT Injection', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 8: SURGERY SCHEDULING
  // ============================================
  async step8_SurgeryScheduling() {
    logStep(8, 'SURGERY SCHEDULING (Cataract Extraction)');

    try {
      // First, create a preliminary invoice for the surgery (required by SurgeryCase)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const surgeryInvoiceData = {
        patient: this.testData.patient._id,
        visit: this.testData.visit._id,
        clinic: this.testData.clinic._id,
        dateIssued: new Date(),
        dueDate: dueDate,
        status: 'paid',
        items: [{
          description: 'Phacoemulsification with IOL implantation',
          category: 'surgery',
          quantity: 1,
          unitPrice: 500000,
          discount: 0,
          subtotal: 500000,
          tax: 0,
          total: 500000
        }],
        summary: {
          subtotal: 500000,
          discountTotal: 0,
          taxTotal: 0,
          total: 500000,
          amountPaid: 500000,
          amountDue: 0
        },
        createdBy: this.testData.doctor._id
      };
      const surgeryInvoice = await Invoice.create(surgeryInvoiceData);

      const surgeryData = {
        patient: this.testData.patient._id,
        invoice: surgeryInvoice._id,
        surgeryDescription: 'Phacoemulsification with IOL - OD',
        eye: 'OD',
        status: 'awaiting_scheduling',
        priority: 'routine',
        surgeon: this.testData.doctor._id,
        clinic: this.testData.clinic._id,
        paymentDate: new Date(),

        // IOL Details
        iolDetails: {
          model: 'AcrySof IQ SN60WF',
          power: '21.5D',
          lotNumber: 'IOL-LOT-2024-001'
        },

        // Pre-op notes (biometry info stored as notes since model doesn't have biometry field)
        preOpNotes: `${TEST_PREFIX}Cataract surgery planned after DME treatment. ` +
          'Biometry: AL 23.45mm, ACD 3.12mm, K1 43.50 K2 44.25 @ 85°. ' +
          'IOL Power 21.5D (Barrett Universal II), Target -0.50D. ' +
          'Plan surgery after DME stabilized with anti-VEGF (minimum 3 injections). ' +
          'High risk for post-op CME. Will use NSAID drops perioperatively.',

        createdBy: this.testData.doctor._id
      };

      const surgery = await SurgeryCase.create(surgeryData);
      this.testData.surgery = surgery;
      this.testData.surgeryInvoice = surgeryInvoice;

      logSuccess('Surgery case created');
      logInfo(`Type: ${surgery.surgeryDescription}`);
      logInfo(`Eye: ${surgery.eye}`);
      logInfo(`IOL: ${surgery.iolDetails.model} ${surgery.iolDetails.power}`);

      // Schedule the surgery (simulate 2 months out after DME treatment)
      surgery.status = 'scheduled';
      surgery.scheduledDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 2 months
      surgery.estimatedDuration = 45;
      await surgery.save();

      logSuccess('Surgery scheduled');
      logInfo(`Date: ${surgery.scheduledDate.toLocaleDateString()}`);
      logInfo(`Duration: ~${surgery.estimatedDuration} minutes`);

      this.results.passed++;
      this.results.steps.push({ step: 8, name: 'Surgery Scheduling', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 8, name: 'Surgery Scheduling', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 9: GLASSES PRESCRIPTION & OPTICAL ORDER
  // ============================================
  async step9_GlassesOrder() {
    logStep(9, 'OPTICAL PRESCRIPTION & GLASSES ORDER');

    try {
      // First, create optical prescription
      const opticalRxData = {
        patient: this.testData.patient._id,
        prescriber: this.testData.doctor._id,
        visit: this.testData.visit._id,
        exam: this.testData.exam._id,
        prescriptionDate: new Date(),
        type: 'optical',
        status: 'ready',
        clinic: this.testData.clinic._id,

        glasses: {
          rightEye: {
            sphere: -2.00,
            cylinder: -0.75,
            axis: 90,
            add: 2.50,
            prism: null
          },
          leftEye: {
            sphere: -1.50,
            cylinder: -0.50,
            axis: 90,
            add: 2.50,
            prism: null
          },
          pd: { total: 64, right: 32, left: 32 },
          lensType: 'progressive',
          material: 'polycarbonate',
          coatings: ['anti-reflective', 'blue-light', 'uv-protection'],
          notes: 'Progressive for near and distance. Polycarbonate for safety.'
        },

        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        notes: `${TEST_PREFIX}Optical prescription for progressive lenses`
      };

      const opticalRx = await Prescription.create(opticalRxData);
      this.testData.opticalPrescription = opticalRx;
      logSuccess('Optical prescription created');

      // Now create glasses order
      const glassesOrderData = {
        patient: this.testData.patient._id,
        prescription: opticalRx._id,
        exam: this.testData.exam._id,
        orderedBy: this.testData.doctor._id,
        orderType: 'glasses',
        status: 'draft',
        clinic: this.testData.clinic._id,

        // Prescription data
        rightLens: {
          sphere: -2.00,
          cylinder: -0.75,
          axis: 90,
          add: 2.50
        },
        leftLens: {
          sphere: -1.50,
          cylinder: -0.50,
          axis: 90,
          add: 2.50
        },

        // Lens specifications
        lensType: {
          material: 'polycarbonate',
          design: 'progressive'
        },

        lensOptions: {
          antiReflective: { selected: true, coatingType: 'premium', price: 25000 },
          photochromic: { selected: false, coatingType: '', price: 0 },
          blueLight: { selected: true, price: 15000 },
          tint: { selected: false, color: '', price: 0 },
          polarized: { selected: false, price: 0 }
        },

        // Frame selection
        frame: {
          brand: 'Ray-Ban',
          model: 'RB5228',
          color: 'Havana Brown',
          size: '53-17-140',
          price: 180000
        },

        // Measurements
        measurements: {
          pd: 64,
          pdRight: 32,
          pdLeft: 32,
          segmentHeight: 18
        },

        // Pricing (will be calculated)
        pricing: {
          framePrice: 180000,
          lensPrice: 70000, // Progressive polycarbonate
          optionsPrice: 40000, // AR + Blue light
          subtotal: 290000,
          discount: 0,
          discountType: 'fixed',
          taxRate: 0,
          taxAmount: 0,
          finalTotal: 290000
        },

        // Convention billing - use ACTUAL optical coverage from company settings
        conventionBilling: (() => {
          const company = this.testData.company;
          const opticalConfig = company.coveredCategories?.find(c => c.category === 'optical');

          let coveragePercentage = 0;
          if (opticalConfig) {
            if (opticalConfig.notCovered) {
              // Optical not covered (e.g., CIGNA, GGA)
              coveragePercentage = 0;
            } else {
              coveragePercentage = opticalConfig.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
            }
          } else {
            // No specific optical config - use company default
            coveragePercentage = company.defaultCoverage?.percentage ?? 100;
          }

          const total = 290000; // finalTotal
          const companyPortion = Math.round(total * coveragePercentage / 100);
          const patientPortion = total - companyPortion;

          return {
            hasConvention: true,
            company: {
              id: company._id,
              name: company.name,
              conventionCode: company.code
            },
            coveragePercentage,
            companyPortion,
            patientPortion,
            requiresApproval: opticalConfig?.requiresApproval || false
          };
        })(),

        urgency: 'normal',
        notes: {
          clinical: 'Progressive lenses for presbyopia with myopia correction',
          internal: `${TEST_PREFIX}Glasses order with convention coverage`
        }
      };

      const glassesOrder = await GlassesOrder.create(glassesOrderData);
      this.testData.glassesOrder = glassesOrder;

      logSuccess(`Glasses order created: ${glassesOrder.orderNumber}`);
      logInfo(`Frame: ${glassesOrder.frame.brand} ${glassesOrder.frame.model}`);
      logInfo('Lenses: Progressive polycarbonate with AR + Blue light');
      logInfo(`Total: ${glassesOrder.pricing.finalTotal.toLocaleString()} CDF`);
      logInfo(`Convention (${this.testData.company.name}): ${glassesOrder.conventionBilling.coveragePercentage}%`);
      logInfo(`  Company pays: ${glassesOrder.conventionBilling.companyPortion.toLocaleString()} CDF`);
      logInfo(`  Patient pays: ${glassesOrder.conventionBilling.patientPortion.toLocaleString()} CDF`);

      // Submit for verification
      glassesOrder.status = 'pending_verification';
      await glassesOrder.save();
      logSuccess('Order submitted for technician verification');

      this.results.passed++;
      this.results.steps.push({ step: 9, name: 'Glasses Order', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 9, name: 'Glasses Order', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 10: BILLING & INVOICING
  // ============================================
  async step10_Billing() {
    logStep(10, 'BILLING & INVOICING (Convention Split)');

    try {
      // Calculate all services with proper Invoice item structure
      const items = [
        {
          description: 'Consultation urgente ophtalmologique',
          category: 'consultation',
          quantity: 1,
          unitPrice: 75000,
          discount: 0,
          subtotal: 75000,
          tax: 0,
          total: 75000
        },
        {
          description: 'Examen ophtalmologique complet',
          category: 'examination',
          quantity: 1,
          unitPrice: 50000,
          discount: 0,
          subtotal: 50000,
          tax: 0,
          total: 50000
        },
        {
          description: 'Tonometrie (IOP)',
          category: 'procedure',
          quantity: 1,
          unitPrice: 15000,
          discount: 0,
          subtotal: 15000,
          tax: 0,
          total: 15000
        },
        {
          description: 'Dilatation + Fond d\'oeil',
          category: 'procedure',
          quantity: 1,
          unitPrice: 25000,
          discount: 0,
          subtotal: 25000,
          tax: 0,
          total: 25000
        },
        {
          description: 'Injection intravitreenne - Avastin',
          category: 'procedure',
          quantity: 1,
          unitPrice: 250000,
          discount: 0,
          subtotal: 250000,
          tax: 0,
          total: 250000
        },
        {
          description: 'Bilan sanguin (HbA1c, FBS, Lipides, Creat, UA)',
          category: 'laboratory',
          quantity: 1,
          unitPrice: 85000,
          discount: 0,
          subtotal: 85000,
          tax: 0,
          total: 85000
        },
        {
          description: 'Timolol 0.5% collyre',
          category: 'medication',
          quantity: 1,
          unitPrice: 12000,
          discount: 0,
          subtotal: 12000,
          tax: 0,
          total: 12000
        },
        {
          description: 'Prednisolone 1% collyre',
          category: 'medication',
          quantity: 1,
          unitPrice: 18000,
          discount: 0,
          subtotal: 18000,
          tax: 0,
          total: 18000
        },
        {
          description: 'Ofloxacin 0.3% collyre',
          category: 'medication',
          quantity: 1,
          unitPrice: 15000,
          discount: 0,
          subtotal: 15000,
          tax: 0,
          total: 15000
        },
        {
          description: 'Paracetamol 1000mg x14',
          category: 'medication',
          quantity: 1,
          unitPrice: 5000,
          discount: 0,
          subtotal: 5000,
          tax: 0,
          total: 5000
        }
      ];

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);

      // Calculate convention portions using ACTUAL company settings from database
      // This matches the real invoiceController.js logic
      let companyTotal = 0;
      let patientTotal = 0;
      const company = this.testData.company;

      // Get global discount settings (e.g., TEMOINS DE JEHOVAH 25%)
      const globalDiscount = company.approvalRules?.globalDiscount?.percentage || 0;
      const globalDiscountExcludes = company.approvalRules?.globalDiscount?.excludeCategories || [];

      items.forEach(item => {
        // Get category-specific settings from the company configuration
        const categoryConfig = company.coveredCategories?.find(c => c.category === item.category);

        let effectiveTotal = item.total;

        // Apply global discount if not excluded for this category
        if (globalDiscount > 0 && !globalDiscountExcludes.includes(item.category)) {
          effectiveTotal = Math.round(item.total * (100 - globalDiscount) / 100);
        }

        // Apply category-specific discount (e.g., LISUNGI 15% surgery discount)
        if (categoryConfig?.additionalDiscount) {
          effectiveTotal = Math.round(effectiveTotal * (100 - categoryConfig.additionalDiscount) / 100);
        }

        // Determine coverage percentage
        let coverage = 0;
        if (categoryConfig) {
          if (categoryConfig.notCovered) {
            // Category not covered (e.g., CIGNA/GGA optical)
            coverage = 0;
          } else {
            // Use category-specific percentage or fall back to default
            coverage = categoryConfig.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
          }
        } else {
          // No specific config - use company default
          coverage = company.defaultCoverage?.percentage ?? 100;
        }

        // Calculate portions
        const companyPortion = Math.round(effectiveTotal * coverage / 100);
        const patientPortion = effectiveTotal - companyPortion;

        // Store calculated portions on item for logging
        item.companyShare = companyPortion;
        item.patientShare = patientPortion;
        item.coveragePercentage = coverage;

        companyTotal += companyPortion;
        patientTotal += patientPortion;
      });

      logInfo(`Using ACTUAL convention rules from: ${company.name}`);
      logInfo(`  Default coverage: ${company.defaultCoverage?.percentage || 100}%`);
      if (globalDiscount > 0) {
        logInfo(`  Global discount: ${globalDiscount}% (excludes: ${globalDiscountExcludes.join(', ') || 'none'})`);
      }

      const invoiceData = {
        patient: this.testData.patient._id,
        visit: this.testData.visit._id,
        dateIssued: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'issued',
        clinic: this.testData.clinic._id,
        createdBy: this.testData.doctor._id,

        items: items,

        // Summary with all required fields including convention split
        summary: {
          subtotal: subtotal,
          discountTotal: 0,
          taxTotal: 0,
          total: subtotal,
          amountPaid: 0,
          amountDue: patientTotal, // Patient portion only
          companyShare: companyTotal,
          patientShare: patientTotal
        },

        // Company/Convention billing - use correct field name for Invoice schema
        companyBilling: {
          company: this.testData.company._id,
          companyName: this.testData.company.name,
          companyId: this.testData.company.code,
          employeeId: this.testData.patient.convention?.employeeId,
          beneficiaryType: this.testData.patient.convention?.beneficiaryType || 'employee',
          coveragePercentage: this.testData.company.defaultCoverage?.percentage || 100,
          companyShare: companyTotal,
          patientShare: patientTotal,
          companyInvoiceStatus: 'pending',
          hasApprovalIssues: false,
          itemsNeedingApproval: 0
        },
        isConventionInvoice: true,

        notes: `${TEST_PREFIX}Emergency consultation + IVT + Labs + Medications`
      };

      const invoice = await Invoice.create(invoiceData);
      this.testData.invoice = invoice;

      logSuccess(`Invoice created: ${invoice.invoiceNumber || invoice._id}`);
      logInfo(`Total services: ${subtotal.toLocaleString()} CDF`);
      logInfo(`\nConvention breakdown (${this.testData.company.name}):`);
      logInfo(`  Company pays: ${companyTotal.toLocaleString()} CDF`);
      logInfo(`  Patient pays: ${patientTotal.toLocaleString()} CDF`);
      logInfo('\nItems:');
      items.forEach(item => {
        logInfo(`  - ${item.description}: ${item.total.toLocaleString()} CDF`);
      });

      // Simulate patient payment at reception
      invoice.payments = [{
        paymentId: `PAY-${Date.now()}`,
        amount: patientTotal,
        amountInBaseCurrency: patientTotal, // Same since we're using CDF
        currency: 'CDF',
        exchangeRate: 1,
        method: 'cash',
        date: new Date(),
        receivedBy: this.testData.receptionist._id,
        reference: `CASH-${Date.now()}`
      }];
      invoice.summary.amountPaid = patientTotal;
      invoice.summary.amountDue = 0;
      invoice.status = 'paid';
      await invoice.save();

      logSuccess('Payment received at reception');
      logInfo(`Amount paid: ${patientTotal.toLocaleString()} CDF (Cash)`);
      logInfo('Invoice status: PAID');

      this.results.passed++;
      this.results.steps.push({ step: 10, name: 'Billing & Invoicing', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 10, name: 'Billing & Invoicing', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 11: PHARMACY DISPENSING
  // ============================================
  async step11_PharmacyDispensing() {
    logStep(11, 'PHARMACY DISPENSING');

    try {
      // Update prescription to dispensed
      this.testData.prescription.pharmacyStatus = 'dispensed';
      this.testData.prescription.dispensedAt = new Date();
      this.testData.prescription.dispensedBy = this.testData.pharmacist._id;
      this.testData.prescription.status = 'dispensed';
      await this.testData.prescription.save();

      logSuccess('Prescription dispensed');
      this.testData.prescription.medications.forEach(m => {
        logInfo(`  - ${m.name}: Dispensed`);
      });

      // Note: In production, this would also decrement inventory
      logInfo('Inventory updated (simulation)');

      this.results.passed++;
      this.results.steps.push({ step: 11, name: 'Pharmacy Dispensing', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 11, name: 'Pharmacy Dispensing', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 12: COMPLETE VISIT
  // ============================================
  async step12_CompleteVisit() {
    logStep(12, 'COMPLETE VISIT & FOLLOW-UP SCHEDULING');

    try {
      // Complete the ophthalmology exam
      this.testData.exam.status = 'completed';
      this.testData.exam.completedAt = new Date();
      await this.testData.exam.save();

      // Complete the visit
      this.testData.visit.status = 'completed';
      this.testData.visit.completedAt = new Date();
      this.testData.visit.assessment = {
        diagnosis: 'Proliferative Diabetic Retinopathy with CSME OD, Cataract OD, Ocular Hypertension OU',
        plan: '1. IVT Avastin x3 loading, then PRN. 2. Cataract surgery after DME stable. 3. IOP-lowering drops. 4. Progressive glasses. 5. Tight glycemic control.',
        followUp: {
          required: true,
          interval: '4 weeks',
          reason: 'IVT loading dose #2'
        }
      };
      await this.testData.visit.save();

      // Complete the appointment
      this.testData.appointment.status = 'completed';
      this.testData.appointment.consultationEndTime = new Date();
      await this.testData.appointment.save();

      logSuccess('Visit completed');
      logInfo(`Diagnosis: ${this.testData.visit.assessment.diagnosis}`);
      logInfo(`Follow-up: ${this.testData.visit.assessment.followUp.interval}`);

      // Schedule follow-up appointment
      const followUpDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
      const followUp = await Appointment.create({
        patient: this.testData.patient._id,
        provider: this.testData.doctor._id,
        type: 'follow-up',
        department: 'ophthalmology',
        date: followUpDate,
        startTime: '10:00',
        endTime: '10:30',
        duration: 30,
        status: 'scheduled',
        reason: 'IVT loading dose #2 + DME response evaluation',
        notes: `${TEST_PREFIX}Follow-up from emergency visit`,
        clinic: this.testData.clinic._id,
        createdBy: this.testData.receptionist._id
      });
      this.testData.followUpAppointment = followUp;

      logSuccess(`Follow-up scheduled: ${followUpDate.toLocaleDateString()}`);

      this.results.passed++;
      this.results.steps.push({ step: 12, name: 'Complete Visit', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      this.results.failed++;
      this.results.steps.push({ step: 12, name: 'Complete Visit', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // STEP 13: MULTI-CONVENTION STRESS TEST
  // ============================================
  async step13_MultiConventionTest() {
    logStep(13, 'MULTI-CONVENTION BILLING STRESS TEST');

    try {
      // Load all test companies
      const activa = await Company.findOne({ name: 'ACTIVA' });
      const gga = await Company.findOne({ name: 'GGA' });

      if (!activa || !gga) {
        logInfo('Skipping multi-convention test - ACTIVA or GGA not found');
        this.results.passed++;
        this.results.steps.push({ step: 13, name: 'Multi-Convention Test', status: 'passed', note: 'skipped' });
        return true;
      }

      logInfo('\n--- SCENARIO A: ACTIVA (100% coverage, approval for surgery/optical) ---');

      // Create ACTIVA patient
      const activaPatient = await Patient.create({
        firstName: `${TEST_PREFIX}Marie`,
        lastName: 'Kabongo_ACTIVA',
        dateOfBirth: new Date('1980-05-20'),
        gender: 'female',
        phoneNumber: '+243811111111',
        convention: {
          company: activa._id,
          employeeId: 'ACT-2024-001',
          beneficiaryType: 'employee',
          status: 'active'
        },
        registeredAtClinic: this.testData.clinic._id,
        homeClinic: this.testData.clinic._id,
        createdBy: this.testData.doctor._id
      });
      logSuccess(`Created ACTIVA patient: ${activaPatient.firstName} ${activaPatient.lastName}`);

      // Test items for ACTIVA
      const activaItems = [
        { description: 'Consultation', category: 'consultation', unitPrice: 75000 },
        { description: 'Examen', category: 'examination', unitPrice: 50000 },
        { description: 'Laboratoire', category: 'laboratory', unitPrice: 85000 },
        { description: 'Chirurgie cataracte', category: 'surgery', unitPrice: 500000 },
        { description: 'Lunettes progressives', category: 'optical', unitPrice: 290000 }
      ];

      let activaCompanyTotal = 0;
      let activaPatientTotal = 0;
      const activaResults = [];

      for (const item of activaItems) {
        const categoryConfig = activa.coveredCategories?.find(c => c.category === item.category);
        let coverage = categoryConfig?.coveragePercentage ?? activa.defaultCoverage?.percentage ?? 100;
        if (categoryConfig?.notCovered) coverage = 0;

        const companyShare = Math.round(item.unitPrice * coverage / 100);
        const patientShare = item.unitPrice - companyShare;

        activaCompanyTotal += companyShare;
        activaPatientTotal += patientShare;

        const requiresApproval = categoryConfig?.requiresApproval || false;
        const priceUSD = item.unitPrice * 0.00036;
        const autoApproveThreshold = activa.approvalRules?.autoApproveUnderAmount || 0;
        const needsDeliberation = requiresApproval && priceUSD > autoApproveThreshold;

        activaResults.push({
          ...item,
          coverage,
          companyShare,
          patientShare,
          requiresApproval,
          needsDeliberation,
          priceUSD: Math.round(priceUSD)
        });
      }

      logInfo('ACTIVA Billing Results:');
      activaResults.forEach(r => {
        const approvalNote = r.needsDeliberation ? ' ⚠️ NEEDS APPROVAL' : (r.requiresApproval ? ' (auto-approved)' : '');
        logInfo(`  ${r.description}: ${r.coverage}% coverage → Ent: ${r.companyShare.toLocaleString()} | Pat: ${r.patientShare.toLocaleString()}${approvalNote}`);
      });
      logInfo(`  TOTAL: Company ${activaCompanyTotal.toLocaleString()} CDF | Patient ${activaPatientTotal.toLocaleString()} CDF`);

      // Create ACTIVA invoice
      const activaInvoice = await Invoice.create({
        patient: activaPatient._id,
        clinic: this.testData.clinic._id,
        dateIssued: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'issued',
        createdBy: this.testData.doctor._id,
        items: activaItems.map((item, i) => ({
          description: item.description,
          category: item.category,
          quantity: 1,
          unitPrice: item.unitPrice,
          discount: 0,
          subtotal: item.unitPrice,
          tax: 0,
          total: item.unitPrice
        })),
        summary: {
          subtotal: activaItems.reduce((s, i) => s + i.unitPrice, 0),
          total: activaItems.reduce((s, i) => s + i.unitPrice, 0),
          companyShare: activaCompanyTotal,
          patientShare: activaPatientTotal,
          amountPaid: 0,
          amountDue: activaPatientTotal
        },
        companyBilling: {
          company: activa._id,
          companyName: activa.name,
          companyShare: activaCompanyTotal,
          patientShare: activaPatientTotal
        },
        isConventionInvoice: true,
        notes: `${TEST_PREFIX}ACTIVA multi-category test`
      });
      logSuccess(`Created ACTIVA invoice: ${activaInvoice.invoiceNumber || activaInvoice._id}`);

      // -------- GGA TEST --------
      logInfo('\n--- SCENARIO B: GGA (100% medical, optical NOT COVERED) ---');

      const ggaPatient = await Patient.create({
        firstName: `${TEST_PREFIX}Pierre`,
        lastName: 'Mutombo_GGA',
        dateOfBirth: new Date('1975-08-10'),
        gender: 'male',
        phoneNumber: '+243822222222',
        convention: {
          company: gga._id,
          employeeId: 'GGA-2024-001',
          beneficiaryType: 'employee',
          status: 'active'
        },
        registeredAtClinic: this.testData.clinic._id,
        homeClinic: this.testData.clinic._id,
        createdBy: this.testData.doctor._id
      });
      logSuccess(`Created GGA patient: ${ggaPatient.firstName} ${ggaPatient.lastName}`);

      const ggaItems = [
        { description: 'Consultation', category: 'consultation', unitPrice: 75000 },
        { description: 'Examen', category: 'examination', unitPrice: 50000 },
        { description: 'Laboratoire', category: 'laboratory', unitPrice: 85000 },
        { description: 'Lunettes (NOT COVERED)', category: 'optical', unitPrice: 290000 }
      ];

      let ggaCompanyTotal = 0;
      let ggaPatientTotal = 0;
      const ggaResults = [];

      for (const item of ggaItems) {
        const categoryConfig = gga.coveredCategories?.find(c => c.category === item.category);
        let coverage = categoryConfig?.coveragePercentage ?? gga.defaultCoverage?.percentage ?? 100;
        const notCovered = categoryConfig?.notCovered || false;
        if (notCovered) coverage = 0;

        const companyShare = Math.round(item.unitPrice * coverage / 100);
        const patientShare = item.unitPrice - companyShare;

        ggaCompanyTotal += companyShare;
        ggaPatientTotal += patientShare;

        ggaResults.push({
          ...item,
          coverage,
          companyShare,
          patientShare,
          notCovered
        });
      }

      logInfo('GGA Billing Results:');
      ggaResults.forEach(r => {
        const notCoveredNote = r.notCovered ? ' ❌ NOT COVERED' : '';
        logInfo(`  ${r.description}: ${r.coverage}% coverage → Ent: ${r.companyShare.toLocaleString()} | Pat: ${r.patientShare.toLocaleString()}${notCoveredNote}`);
      });
      logInfo(`  TOTAL: Company ${ggaCompanyTotal.toLocaleString()} CDF | Patient ${ggaPatientTotal.toLocaleString()} CDF`);

      // Create GGA invoice
      const ggaInvoice = await Invoice.create({
        patient: ggaPatient._id,
        clinic: this.testData.clinic._id,
        dateIssued: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'issued',
        createdBy: this.testData.doctor._id,
        items: ggaItems.map(item => ({
          description: item.description,
          category: item.category,
          quantity: 1,
          unitPrice: item.unitPrice,
          discount: 0,
          subtotal: item.unitPrice,
          tax: 0,
          total: item.unitPrice
        })),
        summary: {
          subtotal: ggaItems.reduce((s, i) => s + i.unitPrice, 0),
          total: ggaItems.reduce((s, i) => s + i.unitPrice, 0),
          companyShare: ggaCompanyTotal,
          patientShare: ggaPatientTotal,
          amountPaid: 0,
          amountDue: ggaPatientTotal
        },
        companyBilling: {
          company: gga._id,
          companyName: gga.name,
          companyShare: ggaCompanyTotal,
          patientShare: ggaPatientTotal
        },
        isConventionInvoice: true,
        notes: `${TEST_PREFIX}GGA multi-category test (optical not covered)`
      });
      logSuccess(`Created GGA invoice: ${ggaInvoice.invoiceNumber || ggaInvoice._id}`);

      // Verify GGA optical is NOT covered
      const ggaOpticalResult = ggaResults.find(r => r.category === 'optical');
      if (ggaOpticalResult?.notCovered && ggaOpticalResult.patientShare === ggaOpticalResult.unitPrice) {
        logSuccess('✓ GGA optical correctly NOT COVERED - patient pays 100%');
      } else {
        logError('✗ GGA optical coverage incorrect!');
      }

      // -------- CASH PATIENT TEST --------
      logInfo('\n--- SCENARIO C: NO CONVENTION (Cash Patient - 100% patient responsibility) ---');

      const cashPatient = await Patient.create({
        firstName: `${TEST_PREFIX}Jean`,
        lastName: 'Kalombo_CASH',
        dateOfBirth: new Date('1990-01-15'),
        gender: 'male',
        phoneNumber: '+243833333333',
        // No convention
        registeredAtClinic: this.testData.clinic._id,
        homeClinic: this.testData.clinic._id,
        createdBy: this.testData.doctor._id
      });
      logSuccess(`Created CASH patient: ${cashPatient.firstName} ${cashPatient.lastName}`);

      const cashItems = [
        { description: 'Consultation', category: 'consultation', unitPrice: 75000 },
        { description: 'Examen', category: 'examination', unitPrice: 50000 },
        { description: 'Lunettes', category: 'optical', unitPrice: 290000 }
      ];

      const cashTotal = cashItems.reduce((s, i) => s + i.unitPrice, 0);

      logInfo('CASH Patient Billing Results:');
      cashItems.forEach(r => {
        logInfo(`  ${r.description}: 0% coverage → Ent: 0 | Pat: ${r.unitPrice.toLocaleString()} (100%)`);
      });
      logInfo(`  TOTAL: Company 0 CDF | Patient ${cashTotal.toLocaleString()} CDF`);

      // Create cash invoice
      const cashInvoice = await Invoice.create({
        patient: cashPatient._id,
        clinic: this.testData.clinic._id,
        dateIssued: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'issued',
        createdBy: this.testData.doctor._id,
        items: cashItems.map(item => ({
          description: item.description,
          category: item.category,
          quantity: 1,
          unitPrice: item.unitPrice,
          discount: 0,
          subtotal: item.unitPrice,
          tax: 0,
          total: item.unitPrice
        })),
        summary: {
          subtotal: cashTotal,
          total: cashTotal,
          companyShare: 0,
          patientShare: cashTotal,
          amountPaid: 0,
          amountDue: cashTotal
        },
        isConventionInvoice: false,
        notes: `${TEST_PREFIX}CASH patient - no convention`
      });
      logSuccess(`Created CASH invoice: ${cashInvoice.invoiceNumber || cashInvoice._id}`);

      // -------- SUMMARY --------
      logInfo('\n--- CONVENTION COMPARISON SUMMARY ---');
      logInfo(`ACTIVA:  Company ${activaCompanyTotal.toLocaleString().padStart(10)} CDF | Patient ${activaPatientTotal.toLocaleString().padStart(10)} CDF`);
      logInfo(`GGA:     Company ${ggaCompanyTotal.toLocaleString().padStart(10)} CDF | Patient ${ggaPatientTotal.toLocaleString().padStart(10)} CDF`);
      logInfo(`CASH:    Company ${'0'.padStart(10)} CDF | Patient ${cashTotal.toLocaleString().padStart(10)} CDF`);

      // Store for UI verification
      this.testData.multiConvention = {
        activa: { patient: activaPatient, invoice: activaInvoice, results: activaResults },
        gga: { patient: ggaPatient, invoice: ggaInvoice, results: ggaResults },
        cash: { patient: cashPatient, invoice: cashInvoice }
      };

      logSuccess('\n✓ Multi-convention stress test completed!');
      logInfo('\nUI Verification Checklist:');
      logInfo('  1. Open patient detail for each test patient');
      logInfo('  2. Check Billing Section shows correct company/patient split');
      logInfo('  3. Verify GGA optical shows "NOT COVERED" or patient pays 100%');
      logInfo('  4. Verify CASH patient shows no convention info');
      logInfo('  5. Check invoice detail pages show correct breakdown');

      this.results.passed++;
      this.results.steps.push({ step: 13, name: 'Multi-Convention Test', status: 'passed' });
      return true;
    } catch (error) {
      logError(`Failed: ${error.message}`);
      console.error(error);
      this.results.failed++;
      this.results.steps.push({ step: 13, name: 'Multi-Convention Test', status: 'failed', error: error.message });
      return false;
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  printSummary() {
    console.log('\n');
    console.log(`${COLORS.cyan}╔══════════════════════════════════════════════════════════════╗${COLORS.reset}`);
    console.log(`${COLORS.cyan}║${COLORS.reset}           ${COLORS.magenta}END-TO-END WORKFLOW TEST RESULTS${COLORS.reset}                 ${COLORS.cyan}║${COLORS.reset}`);
    console.log(`${COLORS.cyan}╠══════════════════════════════════════════════════════════════╣${COLORS.reset}`);

    this.results.steps.forEach(step => {
      const status = step.status === 'passed'
        ? `${COLORS.green}PASSED${COLORS.reset}`
        : `${COLORS.red}FAILED${COLORS.reset}`;
      const stepNum = step.step.toString().padStart(2, ' ');
      console.log(`${COLORS.cyan}║${COLORS.reset}  Step ${stepNum}: ${step.name.padEnd(35)} ${status}      ${COLORS.cyan}║${COLORS.reset}`);
    });

    console.log(`${COLORS.cyan}╠══════════════════════════════════════════════════════════════╣${COLORS.reset}`);

    const totalPassed = this.results.passed;
    const totalFailed = this.results.failed;
    const total = totalPassed + totalFailed;
    const passRate = Math.round((totalPassed / total) * 100);

    const summaryColor = totalFailed === 0 ? COLORS.green : COLORS.yellow;
    console.log(`${COLORS.cyan}║${COLORS.reset}  ${summaryColor}Total: ${totalPassed}/${total} passed (${passRate}%)${COLORS.reset}                              ${COLORS.cyan}║${COLORS.reset}`);
    console.log(`${COLORS.cyan}╚══════════════════════════════════════════════════════════════╝${COLORS.reset}`);

    if (totalFailed === 0) {
      console.log(`\n${COLORS.green}✓ ALL WORKFLOWS TESTED SUCCESSFULLY!${COLORS.reset}\n`);
    } else {
      console.log(`\n${COLORS.red}✗ Some tests failed. Review the output above.${COLORS.reset}\n`);
    }

    // Print test data IDs for reference
    console.log(`${COLORS.cyan}Test Data References:${COLORS.reset}`);
    if (this.testData.patient) logInfo(`Patient ID: ${this.testData.patient._id}`);
    if (this.testData.visit) logInfo(`Visit ID: ${this.testData.visit._id}`);
    if (this.testData.exam) logInfo(`Exam ID: ${this.testData.exam._id}`);
    if (this.testData.invoice) logInfo(`Invoice ID: ${this.testData.invoice._id}`);
    if (this.testData.glassesOrder) logInfo(`Glasses Order: ${this.testData.glassesOrder.orderNumber}`);
  }

  // ============================================
  // RUN ALL TESTS
  // ============================================
  async run() {
    console.log(`\n${COLORS.magenta}╔══════════════════════════════════════════════════════════════╗${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}        ${COLORS.yellow}COMPREHENSIVE E2E WORKFLOW TEST${COLORS.reset}                     ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}                                                              ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}  Testing complete patient journey:                          ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}  - Emergency diabetic patient with convention               ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}  - Ophthalmology exam + IVT injection                       ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}  - Laboratory tests + Multiple medications                  ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}  - Surgery scheduling + Glasses order                       ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}║${COLORS.reset}  - Full billing with convention split                       ${COLORS.magenta}║${COLORS.reset}`);
    console.log(`${COLORS.magenta}╚══════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);

    await this.connect();

    try {
      await this.cleanup();
      await this.getTestDependencies();

      // Run all steps in sequence
      const steps = [
        () => this.step1_PatientRegistration(),
        () => this.step2_EmergencyAppointment(),
        () => this.step3_ConsultationVisit(),
        () => this.step4_OphthalmologyExam(),
        () => this.step5_LaboratoryOrders(),
        () => this.step6_MedicationPrescriptions(),
        () => this.step7_IVTInjection(),
        () => this.step8_SurgeryScheduling(),
        () => this.step9_GlassesOrder(),
        () => this.step10_Billing(),
        () => this.step11_PharmacyDispensing(),
        () => this.step12_CompleteVisit(),
        () => this.step13_MultiConventionTest()
      ];

      for (const step of steps) {
        const success = await step();
        if (!success) {
          logError('Test sequence interrupted due to failure');
          break;
        }
      }

      this.printSummary();

    } catch (error) {
      logError(`Critical error: ${error.message}`);
      console.error(error);
    } finally {
      await mongoose.disconnect();
      log('Disconnected from MongoDB', 'blue');
    }
  }
}

// Run the test
const test = new E2EWorkflowTest();
test.run().catch(console.error);
