const mongoose = require('mongoose');

/**
 * Test Data Generators
 *
 * These functions generate realistic test data for all major entities
 */

// Counter for unique IDs
let counter = 0;
const getUniqueId = () => ++counter;

/**
 * Generate test patient
 */
function createTestPatient(overrides = {}) {
  const id = getUniqueId();
  return {
    firstName: overrides.firstName || `Patient${id}`,
    lastName: overrides.lastName || `Test${id}`,
    dateOfBirth: overrides.dateOfBirth || new Date('1980-01-01'),
    gender: overrides.gender || 'male',
    phoneNumber: overrides.phoneNumber || `+24390000${String(id).padStart(4, '0')}`,
    email: overrides.email || `patient${id}@test.com`,
    patientId: overrides.patientId || `P${String(id).padStart(6, '0')}`,
    address: {
      street: '123 Test Street',
      city: 'Kinshasa',
      province: 'Kinshasa',
      country: 'DRC',
      ...overrides.address
    },
    ...overrides
  };
}

/**
 * Generate test user
 */
function createTestUser(overrides = {}) {
  const id = getUniqueId();
  return {
    username: overrides.username || `user${id}`,
    firstName: overrides.firstName || `User${id}`,
    lastName: overrides.lastName || `Test${id}`,
    email: overrides.email || `user${id}@test.com`,
    password: overrides.password || 'Test123!@#',
    phoneNumber: overrides.phoneNumber || `+24390${String(id).padStart(7, '0')}`,
    role: overrides.role || 'doctor',
    employeeId: overrides.employeeId || `EMP${String(id).padStart(5, '0')}`,
    licenseNumber: overrides.licenseNumber || `LIC${String(id).padStart(6, '0')}`,
    specialization: overrides.specialization || 'general_medicine',
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides
  };
}

/**
 * Generate test appointment
 */
function createTestAppointment(patientId, providerId, overrides = {}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  return {
    patient: patientId,
    provider: providerId,
    appointmentDate: overrides.appointmentDate || tomorrow,
    duration: overrides.duration || 30,
    type: overrides.type || 'consultation',
    status: overrides.status || 'scheduled',
    reason: overrides.reason || 'Routine checkup',
    ...overrides
  };
}

/**
 * Generate test visit
 */
function createTestVisit(patientId, providerId, overrides = {}) {
  return {
    patient: patientId,
    provider: providerId,
    visitDate: overrides.visitDate || new Date(),
    type: overrides.type || 'consultation',
    status: overrides.status || 'in_progress',
    chiefComplaint: overrides.chiefComplaint || 'Test complaint',
    vitalSigns: {
      temperature: 36.7,
      bloodPressure: '120/80',
      heartRate: 72,
      respiratoryRate: 16,
      weight: 70,
      height: 170,
      ...overrides.vitalSigns
    },
    ...overrides
  };
}

/**
 * Generate test prescription
 */
function createTestPrescription(patientId, prescriberId, overrides = {}) {
  const validUntil = overrides.validUntil || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  return {
    patient: patientId,
    prescriber: prescriberId,
    type: overrides.type || 'medication',
    status: overrides.status || 'pending', // Valid: draft, pending, ready, partial, dispensed, cancelled, expired
    medications: overrides.medications || [
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'TID',
        duration: 7,
        durationUnit: 'days',
        route: 'oral',
        quantity: 21, // Required field
        unit: 'tablets',
        instructions: 'Take with food'
      }
    ],
    prescriptionDate: overrides.prescriptionDate || new Date(),
    validUntil, // Required field (renamed from expiryDate)
    ...overrides
  };
}

/**
 * Generate test invoice
 * Valid statuses: draft, issued, sent, viewed, partial, paid, overdue, cancelled, refunded
 */
function createTestInvoice(patientId, createdById, overrides = {}) {
  const id = getUniqueId();
  const items = overrides.items || [
    {
      itemId: new mongoose.Types.ObjectId(),
      description: 'General Consultation',
      category: 'consultation',
      quantity: 1,
      unitPrice: 5000,
      subtotal: 5000,
      total: 5000
    }
  ];

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return {
    patient: patientId,
    createdBy: createdById,
    invoiceNumber: overrides.invoiceNumber || `INV-${String(id).padStart(6, '0')}`,
    items,
    summary: {
      subtotal,
      tax: 0,
      discount: 0,
      total,
      amountPaid: overrides.amountPaid || 0,
      amountDue: overrides.amountDue || total,
      ...overrides.summary
    },
    status: overrides.status || 'draft',
    currency: overrides.currency || 'CDF',
    invoiceDate: overrides.invoiceDate || new Date(),
    dueDate: overrides.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides
  };
}

/**
 * Generate test fee schedule entry
 */
function createTestFeeSchedule(overrides = {}) {
  const id = getUniqueId();
  return {
    code: overrides.code || `TEST${id}`,
    description: overrides.description || `Test Service ${id}`,
    category: overrides.category || 'consultation',
    basePrice: overrides.basePrice || 5000,
    currency: overrides.currency || 'CDF',
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides
  };
}

/**
 * Generate test queue entry
 */
function createTestQueueEntry(patientId, overrides = {}) {
  return {
    patient: patientId,
    department: overrides.department || 'consultation',
    priority: overrides.priority || 'normal',
    status: overrides.status || 'waiting',
    arrivalTime: overrides.arrivalTime || new Date(),
    reason: overrides.reason || 'Consultation',
    ...overrides
  };
}

/**
 * Generate test laboratory order
 */
function createTestLabOrder(patientId, orderingProviderId, overrides = {}) {
  return {
    patient: patientId,
    orderingProvider: orderingProviderId,
    tests: overrides.tests || [
      {
        testCode: 'CBC',
        testName: 'Complete Blood Count',
        status: 'pending'
      }
    ],
    status: overrides.status || 'pending',
    orderDate: overrides.orderDate || new Date(),
    priority: overrides.priority || 'routine',
    ...overrides
  };
}

/**
 * Generate test ophthalmology exam
 */
function createTestOphthalmologyExam(patientId, providerId, overrides = {}) {
  return {
    patient: patientId,
    provider: providerId,
    examDate: overrides.examDate || new Date(),
    visualAcuity: {
      rightEye: { distance: '20/20', near: 'J1' },
      leftEye: { distance: '20/20', near: 'J1' },
      ...overrides.visualAcuity
    },
    refraction: {
      rightEye: { sphere: 0, cylinder: 0, axis: 0 },
      leftEye: { sphere: 0, cylinder: 0, axis: 0 },
      ...overrides.refraction
    },
    intraocularPressure: {
      rightEye: 15,
      leftEye: 15,
      ...overrides.intraocularPressure
    },
    ...overrides
  };
}

/**
 * Create multiple test records
 */
function createMultiple(generator, count, baseData = {}) {
  return Array.from({ length: count }, (_, i) =>
    generator({ ...baseData, index: i })
  );
}

module.exports = {
  createTestPatient,
  createTestUser,
  createTestAppointment,
  createTestVisit,
  createTestPrescription,
  createTestInvoice,
  createTestFeeSchedule,
  createTestQueueEntry,
  createTestLabOrder,
  createTestOphthalmologyExam,
  createMultiple
};
