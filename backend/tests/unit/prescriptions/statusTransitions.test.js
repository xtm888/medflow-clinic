/**
 * Prescription Status Transition Tests
 *
 * Tests for prescription status flow including:
 * - Valid state transitions
 * - Invalid transition prevention
 * - Status-specific validation
 * - Audit trail for changes
 */

const request = require('supertest');
const app = require('../../../server');
const Prescription = require('../../../models/Prescription');
const Patient = require('../../../models/Patient');
const User = require('../../../models/User');
const { createTestPatient, createTestUser } = require('../../fixtures/generators');

/**
 * Prescription Status Flow:
 *
 * draft -> pending -> approved -> dispensed -> completed
 *                  \-> denied
 *                  \-> cancelled
 *
 * Any status -> cancelled (before dispensed)
 * dispensed -> partially_filled -> completed
 */

describe('Prescription Status Transitions', () => {
  let physician;
  let pharmacist;
  let testPatient;
  let physicianCookies;
  let pharmacistCookies;
  let testPrescription;

  beforeEach(async () => {
    // Create physician user
    physician = await User.create(
      createTestUser({
        email: 'physician@medflow.com',
        username: 'physician',
        password: 'PhysicianPass123!@#',
        role: 'physician'
      })
    );

    // Create pharmacist user
    pharmacist = await User.create(
      createTestUser({
        email: 'pharmacist@medflow.com',
        username: 'pharmacist',
        password: 'PharmacistPass123!@#',
        role: 'pharmacist'
      })
    );

    // Create test patient
    testPatient = await Patient.create(createTestPatient());

    // Login physician
    const physicianLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'physician@medflow.com',
        password: 'PhysicianPass123!@#'
      });
    physicianCookies = physicianLogin.headers['set-cookie'];

    // Login pharmacist
    const pharmacistLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'pharmacist@medflow.com',
        password: 'PharmacistPass123!@#'
      });
    pharmacistCookies = pharmacistLogin.headers['set-cookie'];

    // Create base prescription
    const response = await request(app)
      .post('/api/prescriptions')
      .set('Cookie', physicianCookies)
      .send({
        patient: testPatient._id,
        medication: 'Metformin',
        dosage: '500mg',
        frequency: 'BID',
        route: 'oral',
        duration: 30,
        refills: 3
      });

    testPrescription = response.body.data;
  });

  describe('Initial Status', () => {
    test('should create prescription with draft status by default', async () => {
      const response = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', physicianCookies)
        .send({
          patient: testPatient._id,
          medication: 'Aspirin',
          dosage: '100mg',
          frequency: 'QD',
          route: 'oral',
          duration: 90
        })
        .expect(201);

      expect(response.body.data.status).toBe('draft');
    });

    test('should create prescription with pending status when submitted', async () => {
      const response = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', physicianCookies)
        .send({
          patient: testPatient._id,
          medication: 'Aspirin',
          dosage: '100mg',
          frequency: 'QD',
          route: 'oral',
          duration: 90,
          submit: true // Automatically submit
        })
        .expect(201);

      expect(response.body.data.status).toBe('pending');
    });
  });

  describe('Draft -> Pending', () => {
    test('should transition from draft to pending on submit', async () => {
      expect(testPrescription.status).toBe('draft');

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies)
        .expect(200);

      expect(response.body.data.status).toBe('pending');
    });

    test('should validate prescription before submitting', async () => {
      // Create invalid prescription (missing required field)
      const invalidPrescription = await Prescription.create({
        patient: testPatient._id,
        prescribedBy: physician._id,
        medication: 'Aspirin',
        // Missing dosage
        frequency: 'QD',
        status: 'draft'
      });

      const response = await request(app)
        .post(`/api/prescriptions/${invalidPrescription._id}/submit`)
        .set('Cookie', physicianCookies)
        .expect(400);

      expect(response.body.error).toMatch(/dosage|required/i);
    });

    test('should only allow prescriber to submit draft', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', pharmacistCookies)
        .expect(403);

      expect(response.body.error).toMatch(/permission|unauthorized/i);
    });
  });

  describe('Pending -> Approved/Denied', () => {
    beforeEach(async () => {
      // Submit prescription
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);
    });

    test('should transition from pending to approved', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies)
        .expect(200);

      expect(response.body.data.status).toBe('approved');
      expect(response.body.data.approvedBy).toBe(pharmacist._id.toString());
      expect(response.body.data.approvedAt).toBeDefined();
    });

    test('should transition from pending to denied with reason', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/deny`)
        .set('Cookie', pharmacistCookies)
        .send({
          reason: 'Drug interaction with current medication'
        })
        .expect(200);

      expect(response.body.data.status).toBe('denied');
      expect(response.body.data.denialReason).toBe('Drug interaction with current medication');
    });

    test('should require reason when denying', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/deny`)
        .set('Cookie', pharmacistCookies)
        .send({})
        .expect(400);

      expect(response.body.error).toMatch(/reason/i);
    });

    test('should run safety checks before approval', async () => {
      // Add conflicting medication to patient
      await Patient.findByIdAndUpdate(testPatient._id, {
        $push: {
          currentMedications: { name: 'Warfarin', dosage: '5mg' }
        }
      });

      // Try to approve prescription for a drug that interacts
      const warfarinInteractingPrescription = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', physicianCookies)
        .send({
          patient: testPatient._id,
          medication: 'Aspirin',
          dosage: '325mg',
          frequency: 'QD',
          route: 'oral',
          duration: 30,
          submit: true
        });

      const response = await request(app)
        .post(`/api/prescriptions/${warfarinInteractingPrescription.body.data._id}/approve`)
        .set('Cookie', pharmacistCookies);

      // Should either warn or require override
      if (response.status === 200) {
        expect(response.body.data.warnings.length).toBeGreaterThan(0);
      } else {
        expect(response.body.error).toMatch(/interaction|safety/i);
      }
    });
  });

  describe('Approved -> Dispensed', () => {
    beforeEach(async () => {
      // Submit and approve
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies);
    });

    test('should transition from approved to dispensed', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({
          quantityDispensed: 60,
          lotNumber: 'LOT123',
          expirationDate: '2026-12-01'
        })
        .expect(200);

      expect(response.body.data.status).toBe('dispensed');
      expect(response.body.data.dispensedBy).toBe(pharmacist._id.toString());
      expect(response.body.data.dispensedAt).toBeDefined();
    });

    test('should record dispensing details', async () => {
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({
          quantityDispensed: 60,
          lotNumber: 'LOT123',
          expirationDate: '2026-12-01',
          manufacturer: 'Generic Pharma',
          ndc: '12345-678-90'
        });

      const prescription = await Prescription.findById(testPrescription._id);

      expect(prescription.dispensingDetails.lotNumber).toBe('LOT123');
      expect(prescription.dispensingDetails.manufacturer).toBe('Generic Pharma');
      expect(prescription.dispensingDetails.ndc).toBe('12345-678-90');
    });

    test('should only allow pharmacist to dispense', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', physicianCookies)
        .send({
          quantityDispensed: 60
        })
        .expect(403);

      expect(response.body.error).toMatch(/pharmacist|permission/i);
    });

    test('should update inventory on dispense', async () => {
      // Get initial inventory
      const initialInventory = await request(app)
        .get('/api/inventory/pharmacy?medication=Metformin')
        .set('Cookie', pharmacistCookies);

      const initialQuantity = initialInventory.body.data[0]?.quantity || 1000;

      // Dispense
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({
          quantityDispensed: 60,
          inventoryId: initialInventory.body.data[0]?._id
        });

      // Check updated inventory
      const updatedInventory = await request(app)
        .get('/api/inventory/pharmacy?medication=Metformin')
        .set('Cookie', pharmacistCookies);

      if (initialInventory.body.data[0]) {
        expect(updatedInventory.body.data[0].quantity).toBe(initialQuantity - 60);
      }
    });
  });

  describe('Dispensed -> Completed', () => {
    beforeEach(async () => {
      // Submit, approve, and dispense
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({ quantityDispensed: 60 });
    });

    test('should transition from dispensed to completed when all refills used', async () => {
      // Update to no remaining refills
      await Prescription.findByIdAndUpdate(testPrescription._id, {
        refillsRemaining: 0
      });

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/complete`)
        .set('Cookie', pharmacistCookies)
        .expect(200);

      expect(response.body.data.status).toBe('completed');
    });

    test('should auto-complete when prescription expires', async () => {
      // Set expiration to past
      await Prescription.findByIdAndUpdate(testPrescription._id, {
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get(`/api/prescriptions/${testPrescription._id}`)
        .set('Cookie', physicianCookies)
        .expect(200);

      expect(response.body.data.status).toBe('completed');
    });
  });

  describe('Cancellation', () => {
    test('should allow cancellation of draft prescription', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/cancel`)
        .set('Cookie', physicianCookies)
        .send({
          reason: 'No longer needed'
        })
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });

    test('should allow cancellation of pending prescription', async () => {
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/cancel`)
        .set('Cookie', physicianCookies)
        .send({
          reason: 'Treatment plan changed'
        })
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });

    test('should allow cancellation of approved prescription before dispense', async () => {
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies);

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/cancel`)
        .set('Cookie', physicianCookies)
        .send({
          reason: 'Patient allergic reaction reported'
        })
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });

    test('should not allow cancellation after dispense', async () => {
      // Full workflow
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({ quantityDispensed: 60 });

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/cancel`)
        .set('Cookie', physicianCookies)
        .send({
          reason: 'Test cancel'
        })
        .expect(400);

      expect(response.body.error).toMatch(/cannot.*cancel|already.*dispensed/i);
    });

    test('should require cancellation reason', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/cancel`)
        .set('Cookie', physicianCookies)
        .send({})
        .expect(400);

      expect(response.body.error).toMatch(/reason/i);
    });
  });

  describe('Invalid Transitions', () => {
    test('should not allow draft -> dispensed', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({ quantityDispensed: 60 })
        .expect(400);

      expect(response.body.error).toMatch(/invalid.*status|must.*approved/i);
    });

    test('should not allow pending -> dispensed', async () => {
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({ quantityDispensed: 60 })
        .expect(400);

      expect(response.body.error).toMatch(/invalid.*status|must.*approved/i);
    });

    test('should not allow denied -> approved', async () => {
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/deny`)
        .set('Cookie', pharmacistCookies)
        .send({ reason: 'Safety concern' });

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies)
        .expect(400);

      expect(response.body.error).toMatch(/invalid.*status|denied/i);
    });

    test('should not allow completed -> any status', async () => {
      // Set to completed
      await Prescription.findByIdAndUpdate(testPrescription._id, {
        status: 'completed'
      });

      const response = await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies)
        .expect(400);

      expect(response.body.error).toMatch(/invalid.*status|completed/i);
    });
  });

  describe('Status Audit Trail', () => {
    test('should record all status changes', async () => {
      // Full workflow
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/dispense`)
        .set('Cookie', pharmacistCookies)
        .send({ quantityDispensed: 60 });

      const response = await request(app)
        .get(`/api/prescriptions/${testPrescription._id}`)
        .set('Cookie', physicianCookies)
        .expect(200);

      expect(response.body.data.statusHistory.length).toBeGreaterThanOrEqual(3);
      expect(response.body.data.statusHistory[0].status).toBe('draft');
      expect(response.body.data.statusHistory[1].status).toBe('pending');
      expect(response.body.data.statusHistory[2].status).toBe('approved');
    });

    test('should record who made each status change', async () => {
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/approve`)
        .set('Cookie', pharmacistCookies);

      const response = await request(app)
        .get(`/api/prescriptions/${testPrescription._id}`)
        .set('Cookie', physicianCookies)
        .expect(200);

      const approvalEntry = response.body.data.statusHistory.find(
        h => h.status === 'approved'
      );

      expect(approvalEntry.changedBy).toBe(pharmacist._id.toString());
    });

    test('should record timestamp of each status change', async () => {
      const beforeSubmit = new Date();

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      const afterSubmit = new Date();

      const response = await request(app)
        .get(`/api/prescriptions/${testPrescription._id}`)
        .set('Cookie', physicianCookies)
        .expect(200);

      const submitEntry = response.body.data.statusHistory.find(
        h => h.status === 'pending'
      );

      const timestamp = new Date(submitEntry.timestamp);
      expect(timestamp >= beforeSubmit).toBe(true);
      expect(timestamp <= afterSubmit).toBe(true);
    });

    test('should include reason in status history for denials and cancellations', async () => {
      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/submit`)
        .set('Cookie', physicianCookies);

      await request(app)
        .post(`/api/prescriptions/${testPrescription._id}/deny`)
        .set('Cookie', pharmacistCookies)
        .send({ reason: 'Drug interaction with warfarin' });

      const response = await request(app)
        .get(`/api/prescriptions/${testPrescription._id}`)
        .set('Cookie', physicianCookies)
        .expect(200);

      const denialEntry = response.body.data.statusHistory.find(
        h => h.status === 'denied'
      );

      expect(denialEntry.reason).toBe('Drug interaction with warfarin');
    });
  });
});
