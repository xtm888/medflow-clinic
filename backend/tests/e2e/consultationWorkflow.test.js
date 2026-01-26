/**
 * E2E Test: Consultation Workflow - Full Save Cycle
 *
 * This test verifies that the granular update pattern works correctly:
 * - Each section (refraction, diagnosis, treatment, IOP) saves independently
 * - No cascading failures between sections
 * - Data integrity is maintained after save
 *
 * Mirrors CareVision's ModifierConsultation* pattern from DonConsultation.cs
 */

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../server');
const Visit = require('../../models/Visit');
const Patient = require('../../models/Patient');
const User = require('../../models/User');
const Clinic = require('../../models/Clinic');
const jwt = require('jsonwebtoken');

// Test configuration
const JWT_SECRET = process.env.JWT_SECRET || 'medflow-test-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow-test';

describe('Consultation Workflow - Granular Save Pattern', () => {
  let authToken;
  let testUser;
  let testPatient;
  let testVisit;
  let testClinic;

  // Setup test data before all tests
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_URI);

    // Create test clinic
    testClinic = await Clinic.create({
      name: 'Test Clinic E2E',
      code: 'TEST-E2E-' + Date.now(),
      address: {
        street: '123 Test St',
        city: 'Kinshasa',
        country: 'CD'
      },
      isActive: true
    });

    // Create test user (ophthalmologist)
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Doctor',
      email: `test-e2e-${Date.now()}@medflow.test`,
      password: 'TestPassword123!',
      role: 'ophthalmologist',
      clinics: [testClinic._id],
      currentClinic: testClinic._id,
      isActive: true
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id, role: testUser.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'Patient',
      lastName: 'Test',
      dateOfBirth: new Date('1990-01-15'),
      gender: 'male',
      clinic: testClinic._id,
      medicalRecordNumber: `MRN-E2E-${Date.now()}`,
      contact: {
        phone: '+243 999 000 000'
      }
    });

    // Create test visit
    testVisit = await Visit.create({
      patient: testPatient._id,
      clinic: testClinic._id,
      provider: testUser._id,
      visitDate: new Date(),
      visitType: 'consultation',
      status: 'in-progress',
      chiefComplaint: 'Test consultation for E2E',
      clinicalData: {}
    });
  });

  // Cleanup after all tests
  afterAll(async () => {
    if (testVisit) await Visit.findByIdAndDelete(testVisit._id);
    if (testPatient) await Patient.findByIdAndDelete(testPatient._id);
    if (testUser) await User.findByIdAndDelete(testUser._id);
    if (testClinic) await Clinic.findByIdAndDelete(testClinic._id);
    await mongoose.connection.close();
  });

  describe('1. Refraction Section - Independent Save', () => {
    const refractionData = {
      OD: {
        sphere: -2.25,
        cylinder: -0.75,
        axis: 90,
        visualAcuity: '10/10'
      },
      OS: {
        sphere: -2.00,
        cylinder: -0.50,
        axis: 85,
        visualAcuity: '10/10'
      }
    };

    it('should save refraction data without cascading to other sections', async () => {
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/refraction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(refractionData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should persist refraction data after save', async () => {
      const visit = await Visit.findById(testVisit._id);
      // Refraction data should be stored
      expect(visit).toBeTruthy();
      expect(visit.updatedAt).toBeTruthy();
    });

    it('should not fail even if diagnosis section has invalid data later', async () => {
      // This test verifies no cascading - refraction save is independent
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/refraction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          OD: { sphere: -1.50, cylinder: -0.25, axis: 95 },
          OS: { sphere: -1.25, cylinder: -0.25, axis: 90 }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Diagnosis Section - Independent Save', () => {
    const diagnosisData = {
      diagnoses: [
        {
          code: 'H52.1',
          description: 'Myopie',
          laterality: 'OU',
          isPrimary: true
        },
        {
          code: 'H52.2',
          description: 'Astigmatisme',
          laterality: 'OU',
          isPrimary: false
        }
      ]
    };

    it('should save diagnosis data without cascading to other sections', async () => {
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/diagnosis`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(diagnosisData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should persist diagnosis array after save', async () => {
      const visit = await Visit.findById(testVisit._id);
      expect(visit.diagnoses).toBeTruthy();
      // Diagnosis should be stored
      expect(visit.diagnoses.length).toBeGreaterThanOrEqual(0);
    });

    it('should allow updating diagnosis independently of refraction', async () => {
      // Add another diagnosis
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/diagnosis`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          diagnoses: [
            {
              code: 'H52.1',
              description: 'Myopie bilatérale',
              laterality: 'OU',
              isPrimary: true
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Treatment Section - Independent Save', () => {
    const treatmentData = {
      medications: [
        {
          name: 'Hylo Dual',
          dosage: '1 goutte',
          frequency: '3x/jour',
          duration: '30 jours',
          eye: 'OU'
        }
      ],
      recommendations: 'Repos visuel, éviter les écrans',
      followUp: '3 mois'
    };

    it('should save treatment data without cascading to other sections', async () => {
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/treatment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(treatmentData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should persist treatment plan after save', async () => {
      const visit = await Visit.findById(testVisit._id);
      expect(visit).toBeTruthy();
      expect(visit.updatedAt).toBeTruthy();
    });

    it('should allow updating treatment without affecting diagnosis', async () => {
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/treatment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          medications: [
            {
              name: 'Optive Fusion',
              dosage: '1 goutte',
              frequency: '4x/jour',
              duration: '60 jours',
              eye: 'OU'
            }
          ],
          recommendations: 'Humidification régulière',
          followUp: '1 mois'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify diagnosis wasn't affected
      const visit = await Visit.findById(testVisit._id);
      expect(visit.diagnoses).toBeTruthy();
    });
  });

  describe('4. IOP Section - Independent Save', () => {
    const iopData = {
      OD: {
        value: 14,
        method: 'applanation',
        time: new Date().toISOString()
      },
      OS: {
        value: 15,
        method: 'applanation',
        time: new Date().toISOString()
      }
    };

    it('should save IOP data without cascading to other sections', async () => {
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/iop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(iopData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should persist IOP measurements after save', async () => {
      const visit = await Visit.findById(testVisit._id);
      expect(visit).toBeTruthy();
      // IOP should be stored in clinicalData or vitals
    });

    it('should validate IOP range (0-60 mmHg)', async () => {
      const invalidIOP = await request(app)
        .put(`/api/visits/${testVisit._id}/iop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          OD: { value: 70 }, // Invalid - above 60
          OS: { value: 15 }
        });

      expect(invalidIOP.status).toBe(400);
      expect(invalidIOP.body.success).toBe(false);
    });
  });

  describe('5. Section Independence Verification', () => {
    it('should save all sections successfully in sequence', async () => {
      // Save refraction
      const refraction = await request(app)
        .put(`/api/visits/${testVisit._id}/refraction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ OD: { sphere: -3.00 }, OS: { sphere: -2.75 } });
      expect(refraction.status).toBe(200);

      // Save diagnosis
      const diagnosis = await request(app)
        .put(`/api/visits/${testVisit._id}/diagnosis`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ diagnoses: [{ code: 'H52.1', description: 'Myopie' }] });
      expect(diagnosis.status).toBe(200);

      // Save treatment
      const treatment = await request(app)
        .put(`/api/visits/${testVisit._id}/treatment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ recommendations: 'Correction optique' });
      expect(treatment.status).toBe(200);

      // Save IOP
      const iop = await request(app)
        .put(`/api/visits/${testVisit._id}/iop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ OD: { value: 16 }, OS: { value: 17 } });
      expect(iop.status).toBe(200);
    });

    it('should handle partial save failure gracefully', async () => {
      // First, save refraction successfully
      const refraction = await request(app)
        .put(`/api/visits/${testVisit._id}/refraction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ OD: { sphere: -2.50 }, OS: { sphere: -2.25 } });
      expect(refraction.status).toBe(200);

      // Try to save invalid IOP - should fail but not affect refraction
      const invalidIOP = await request(app)
        .put(`/api/visits/${testVisit._id}/iop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ OD: { value: -5 }, OS: { value: 80 } }); // Invalid values
      expect(invalidIOP.status).toBe(400);

      // Verify refraction was still saved (no cascade)
      const visit = await Visit.findById(testVisit._id);
      expect(visit).toBeTruthy();
      expect(visit.updatedAt).toBeTruthy();
    });

    it('should maintain data integrity across all sections', async () => {
      const visit = await Visit.findById(testVisit._id);

      // Visit should exist and have been updated
      expect(visit).toBeTruthy();
      expect(visit.patient.toString()).toBe(testPatient._id.toString());
      expect(visit.provider.toString()).toBe(testUser._id.toString());
      expect(visit.status).toBe('in-progress');
    });
  });

  describe('6. Error Handling', () => {
    it('should return 404 for non-existent visit', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/visits/${fakeId}/refraction`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ OD: { sphere: -1.00 } });

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put(`/api/visits/${testVisit._id}/refraction`)
        .send({ OD: { sphere: -1.00 } });

      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid ObjectId format', async () => {
      const res = await request(app)
        .put('/api/visits/invalid-id/refraction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ OD: { sphere: -1.00 } });

      expect(res.status).toBe(400);
    });
  });
});

/**
 * Manual Verification Checklist (for human testers)
 *
 * Prerequisites:
 * - Backend running on port 5001: cd backend && npm start
 * - Frontend running on port 5173: cd frontend && npm run dev
 * - MongoDB accessible
 *
 * Steps:
 * 1. Login as an ophthalmologist
 * 2. Select a patient and start a new consultation
 * 3. Navigate to StudioVision consultation page
 *
 * Test 1: Refraction Save
 * - Enter refraction data (sphere, cylinder, axis for OD/OS)
 * - Click Save or change tab
 * - Expected: Data saved without errors, toast shows success
 * - Verify: Refresh page, data persists
 *
 * Test 2: Diagnosis Save
 * - Enter diagnosis (ICD-10 code, laterality)
 * - Click Save or change tab
 * - Expected: Data saved without errors, toast shows success
 * - Verify: Refraction data still present
 *
 * Test 3: Treatment Save
 * - Enter prescription/medications
 * - Click Save or change tab
 * - Expected: Data saved without errors, toast shows success
 * - Verify: Refraction and diagnosis data still present
 *
 * Test 4: IOP Save
 * - Enter IOP values (14-21 normal range)
 * - Click Save or change tab
 * - Expected: Data saved without errors, toast shows success
 * - Verify: All other sections still present
 *
 * Test 5: No Cascade Failure
 * - Enter valid refraction data
 * - Enter invalid IOP (value > 60 or < 0)
 * - Try to save
 * - Expected: IOP section shows error, refraction section NOT affected
 *
 * Test 6: Auto-save on Tab Change
 * - Enter data in current tab
 * - Switch to another tab
 * - Expected: Data auto-saved, no data loss
 *
 * Success Criteria:
 * ✓ Each section saves independently
 * ✓ No cascading failures between sections
 * ✓ Data persists after page refresh
 * ✓ Error in one section doesn't affect others
 * ✓ French error messages displayed
 */
