/**
 * Prescription Refill Logic Tests
 *
 * Tests for refill handling including:
 * - Refill count enforcement
 * - Refill eligibility
 * - Controlled substance rules
 * - Early refill prevention
 */

const request = require('supertest');
const app = require('../../../server');
const Prescription = require('../../../models/Prescription');
const Patient = require('../../../models/Patient');
const User = require('../../../models/User');
const { createTestPatient, createTestUser } = require('../../fixtures/generators');

describe('Prescription Refill Logic', () => {
  let testUser;
  let testPatient;
  let authCookies;
  let basePrescription;

  beforeEach(async () => {
    // Create test user (physician)
    testUser = await User.create(
      createTestUser({
        email: 'physician@medflow.com',
        username: 'physician',
        password: 'PhysicianPass123!@#',
        role: 'physician'
      })
    );

    // Create test patient
    testPatient = await Patient.create(createTestPatient());

    // Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'physician@medflow.com',
        password: 'PhysicianPass123!@#'
      });

    authCookies = loginResponse.headers['set-cookie'];

    // Create base prescription
    const prescriptionResponse = await request(app)
      .post('/api/prescriptions')
      .set('Cookie', authCookies)
      .send({
        patient: testPatient._id,
        medication: 'Metformin',
        dosage: '500mg',
        frequency: 'BID',
        route: 'oral',
        duration: 30,
        refills: 3,
        instructions: 'Take with food'
      });

    basePrescription = prescriptionResponse.body.data;
  });

  describe('Refill Count Enforcement', () => {
    test('should allow refill when refills remaining', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refillsRemaining).toBe(2);
    });

    test('should decrement refill count after each refill', async () => {
      // First refill
      await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies);

      // Second refill
      await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies);

      // Third refill
      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.refillsRemaining).toBe(0);
    });

    test('should reject refill when no refills remaining', async () => {
      // Use all refills
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/prescriptions/${basePrescription._id}/refill`)
          .set('Cookie', authCookies);
      }

      // Try one more
      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/no.*refill/i);
    });

    test('should handle prescription with zero refills', async () => {
      // Create prescription with no refills
      const prescResponse = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          medication: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'TID',
          route: 'oral',
          duration: 7,
          refills: 0
        });

      const prescription = prescResponse.body.data;

      // Try to refill
      const response = await request(app)
        .post(`/api/prescriptions/${prescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Refill Eligibility Windows', () => {
    test('should allow refill near end of supply', async () => {
      // Set last fill date to 25 days ago (30-day supply)
      await Prescription.findByIdAndUpdate(basePrescription._id, {
        lastFilledDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        daysSupply: 30
      });

      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject too-early refill (more than 80% supply remaining)', async () => {
      // Set last fill date to 5 days ago (30-day supply)
      await Prescription.findByIdAndUpdate(basePrescription._id, {
        lastFilledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        daysSupply: 30
      });

      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/too.*early|not.*eligible/i);
    });

    test('should calculate early refill date correctly', async () => {
      // Set last fill date to 10 days ago (30-day supply)
      const lastFilledDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await Prescription.findByIdAndUpdate(basePrescription._id, {
        lastFilledDate,
        daysSupply: 30
      });

      const response = await request(app)
        .get(`/api/prescriptions/${basePrescription._id}`)
        .set('Cookie', authCookies)
        .expect(200);

      // Should be able to refill when 80% used (day 24)
      const earliestRefillDate = new Date(lastFilledDate);
      earliestRefillDate.setDate(earliestRefillDate.getDate() + 24);

      expect(new Date(response.body.data.earliestRefillDate).toDateString())
        .toBe(earliestRefillDate.toDateString());
    });

    test('should allow override for early refill with reason', async () => {
      // Set last fill date to 10 days ago
      await Prescription.findByIdAndUpdate(basePrescription._id, {
        lastFilledDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        daysSupply: 30
      });

      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .send({
          earlyRefillReason: 'Patient traveling internationally',
          overrideEarlyRefill: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.earlyRefillReason).toBe('Patient traveling internationally');
    });
  });

  describe('Controlled Substance Rules', () => {
    let controlledPrescription;

    beforeEach(async () => {
      // Create Schedule II controlled substance prescription
      const response = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          medication: 'Oxycodone',
          dosage: '5mg',
          frequency: 'Q6H PRN',
          route: 'oral',
          duration: 7,
          refills: 0, // Schedule II cannot have refills
          controlledSubstance: true,
          schedule: 'II',
          instructions: 'Take as needed for pain'
        });

      controlledPrescription = response.body.data;
    });

    test('should not allow refills for Schedule II substances', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${controlledPrescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.error).toMatch(/schedule.*II|controlled|no.*refill/i);
    });

    test('should allow limited refills for Schedule III-V substances', async () => {
      // Create Schedule III prescription
      const scheduleIIIResponse = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          medication: 'Codeine with Acetaminophen',
          dosage: '30/300mg',
          frequency: 'Q4H PRN',
          route: 'oral',
          duration: 30,
          refills: 5, // Schedule III-V can have up to 5 refills
          controlledSubstance: true,
          schedule: 'III'
        });

      const prescription = scheduleIIIResponse.body.data;

      // Should allow refill
      const refillResponse = await request(app)
        .post(`/api/prescriptions/${prescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(refillResponse.body.success).toBe(true);
    });

    test('should enforce 6-month limit for Schedule III-V refills', async () => {
      // Create Schedule III prescription from 7 months ago
      const sevenMonthsAgo = new Date();
      sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

      const prescResponse = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          medication: 'Codeine with Acetaminophen',
          dosage: '30/300mg',
          frequency: 'Q4H PRN',
          route: 'oral',
          duration: 30,
          refills: 5,
          controlledSubstance: true,
          schedule: 'III',
          writtenDate: sevenMonthsAgo
        });

      const prescription = prescResponse.body.data;

      // Should reject refill after 6 months
      const response = await request(app)
        .post(`/api/prescriptions/${prescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.error).toMatch(/expired|6.*month/i);
    });

    test('should require DEA number for controlled substance prescriptions', async () => {
      // Create user without DEA
      const nonDEAUser = await User.create(
        createTestUser({
          email: 'nodeaphysician@medflow.com',
          username: 'nodeaphysician',
          password: 'Pass123!@#',
          role: 'physician',
          deaNumber: null
        })
      );

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nodeaphysician@medflow.com',
          password: 'Pass123!@#'
        });

      const noDEACookies = loginResponse.headers['set-cookie'];

      const response = await request(app)
        .post('/api/prescriptions')
        .set('Cookie', noDEACookies)
        .send({
          patient: testPatient._id,
          medication: 'Oxycodone',
          dosage: '5mg',
          frequency: 'Q6H PRN',
          route: 'oral',
          duration: 7,
          controlledSubstance: true,
          schedule: 'II'
        })
        .expect(403);

      expect(response.body.error).toMatch(/DEA|controlled/i);
    });
  });

  describe('Refill History Tracking', () => {
    test('should track all refills in prescription history', async () => {
      // Perform multiple refills
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post(`/api/prescriptions/${basePrescription._id}/refill`)
          .set('Cookie', authCookies);
      }

      const response = await request(app)
        .get(`/api/prescriptions/${basePrescription._id}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.refillHistory.length).toBe(2);
      expect(response.body.data.refillHistory[0].date).toBeDefined();
      expect(response.body.data.refillHistory[0].filledBy).toBeDefined();
    });

    test('should track pharmacy that filled refill', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .send({
          pharmacy: 'City Pharmacy',
          pharmacyId: 'PHARM001'
        })
        .expect(200);

      const prescription = await Prescription.findById(basePrescription._id);
      const lastRefill = prescription.refillHistory[prescription.refillHistory.length - 1];

      expect(lastRefill.pharmacy).toBe('City Pharmacy');
    });

    test('should record quantity dispensed on each refill', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .send({
          quantityDispensed: 60
        })
        .expect(200);

      const prescription = await Prescription.findById(basePrescription._id);
      const lastRefill = prescription.refillHistory[prescription.refillHistory.length - 1];

      expect(lastRefill.quantityDispensed).toBe(60);
    });
  });

  describe('Expiration Handling', () => {
    test('should reject refill for expired prescription', async () => {
      // Set expiration to past date
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 1);

      await Prescription.findByIdAndUpdate(basePrescription._id, {
        expirationDate: expiredDate
      });

      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/refill`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.error).toMatch(/expired/i);
    });

    test('should calculate prescription expiration from written date', async () => {
      const response = await request(app)
        .get(`/api/prescriptions/${basePrescription._id}`)
        .set('Cookie', authCookies)
        .expect(200);

      // Standard prescriptions expire 1 year from written date
      const writtenDate = new Date(response.body.data.writtenDate);
      const expectedExpiration = new Date(writtenDate);
      expectedExpiration.setFullYear(expectedExpiration.getFullYear() + 1);

      expect(new Date(response.body.data.expirationDate).toDateString())
        .toBe(expectedExpiration.toDateString());
    });

    test('should warn when prescription nearing expiration', async () => {
      // Set expiration to 7 days from now
      const nearExpiration = new Date();
      nearExpiration.setDate(nearExpiration.getDate() + 7);

      await Prescription.findByIdAndUpdate(basePrescription._id, {
        expirationDate: nearExpiration
      });

      const response = await request(app)
        .get(`/api/prescriptions/${basePrescription._id}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.warnings).toContain(
        expect.stringMatching(/expir|renew/i)
      );
    });
  });

  describe('Renewal Requests', () => {
    test('should create renewal request for prescription without refills', async () => {
      // Use all refills
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/prescriptions/${basePrescription._id}/refill`)
          .set('Cookie', authCookies);
      }

      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/renewal-request`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Continued need for medication'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
    });

    test('should notify prescriber of renewal request', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/renewal-request`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Patient doing well on medication'
        })
        .expect(201);

      expect(response.body.data.notificationSent).toBe(true);
    });

    test('should approve renewal and create new prescription', async () => {
      // Create renewal request
      const requestResponse = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/renewal-request`)
        .set('Cookie', authCookies)
        .send({ reason: 'Continued treatment' });

      const renewalId = requestResponse.body.data._id;

      // Approve renewal
      const approvalResponse = await request(app)
        .post(`/api/prescriptions/renewals/${renewalId}/approve`)
        .set('Cookie', authCookies)
        .send({
          refills: 3,
          modifications: null
        })
        .expect(200);

      expect(approvalResponse.body.success).toBe(true);
      expect(approvalResponse.body.data.newPrescription).toBeDefined();
      expect(approvalResponse.body.data.newPrescription.refillsRemaining).toBe(3);
    });

    test('should deny renewal with reason', async () => {
      const requestResponse = await request(app)
        .post(`/api/prescriptions/${basePrescription._id}/renewal-request`)
        .set('Cookie', authCookies)
        .send({ reason: 'Patient needs refill' });

      const renewalId = requestResponse.body.data._id;

      const response = await request(app)
        .post(`/api/prescriptions/renewals/${renewalId}/deny`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Need follow-up appointment before renewal'
        })
        .expect(200);

      expect(response.body.data.status).toBe('denied');
      expect(response.body.data.denialReason).toBe('Need follow-up appointment before renewal');
    });
  });
});
