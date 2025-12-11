const request = require('supertest');
const app = require('../../server');
const Patient = require('../../models/Patient');
const User = require('../../models/User');
const { createTestPatient, createTestUser } = require('../fixtures/generators');

describe('Patient API Integration Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user and get auth token
    testUser = await User.create(
      createTestUser({
        role: 'doctor',
        email: 'testdoctor@medflow.com',
        password: 'Test123!@#'
      })
    );

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testdoctor@medflow.com',
        password: 'Test123!@#'
      });

    authToken = loginResponse.body.token;
  });

  describe('POST /api/patients', () => {
    test('should create new patient with valid data', async () => {
      const patientData = createTestPatient({
        firstName: 'Jean',
        lastName: 'Kabongo',
        phoneNumber: '+243900000001'
      });

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Jean');
      expect(response.body.data.lastName).toBe('Kabongo');
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Jean'
          // Missing lastName, dateOfBirth, gender
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should return 401 without authentication', async () => {
      const patientData = createTestPatient();

      await request(app).post('/api/patients').send(patientData).expect(401);
    });

    test('should prevent duplicate patient creation', async () => {
      const patientData = createTestPatient({
        patientId: 'P000001',
        phoneNumber: '+243900000001'
      });

      // Create first patient
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      // Attempt to create duplicate
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/already exists/i);
    });
  });

  describe('GET /api/patients', () => {
    beforeEach(async () => {
      // Create test patients
      await Patient.create([
        createTestPatient({ firstName: 'Jean', lastName: 'Kabongo' }),
        createTestPatient({ firstName: 'Marie', lastName: 'Tshimanga' }),
        createTestPatient({ firstName: 'Pierre', lastName: 'Mukendi' })
      ]);
    });

    test('should get all patients with pagination', async () => {
      const response = await request(app)
        .get('/api/patients?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });

    test('should search patients by name', async () => {
      const response = await request(app)
        .get('/api/patients?search=Jean')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].firstName).toMatch(/Jean/i);
    });

    test('should filter patients by gender', async () => {
      const response = await request(app)
        .get('/api/patients?gender=male')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((p) => p.gender === 'male')).toBe(true);
    });
  });

  describe('GET /api/patients/:id', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await Patient.create(createTestPatient());
    });

    test('should get patient by ID', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testPatient._id.toString());
      expect(response.body.data.firstName).toBe(testPatient.firstName);
    });

    test('should return 404 for non-existent patient', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/not found/i);
    });

    test('should return 400 for invalid patient ID format', async () => {
      await request(app)
        .get('/api/patients/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PUT /api/patients/:id', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await Patient.create(createTestPatient());
    });

    test('should update patient information', async () => {
      const updates = {
        phoneNumber: '+243900999999',
        email: 'updated@email.com'
      };

      const response = await request(app)
        .put(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.phoneNumber).toBe('+243900999999');
      expect(response.body.data.email).toBe('updated@email.com');
    });

    test('should not update protected fields', async () => {
      const updates = {
        patientId: 'NEWID123' // Should not be allowed to change
      };

      const response = await request(app)
        .put(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      // Patient ID should remain unchanged
      expect(response.body.data.patientId).toBe(testPatient.patientId);
    });

    test('should return 404 for non-existent patient', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .put(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phoneNumber: '+243900000000' })
        .expect(404);
    });
  });

  describe('DELETE /api/patients/:id', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await Patient.create(createTestPatient());
    });

    test('should soft delete patient (admin only)', async () => {
      // Update user to admin role
      await User.findByIdAndUpdate(testUser._id, { role: 'admin' });

      const response = await request(app)
        .delete(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify patient is soft deleted
      const deletedPatient = await Patient.findById(testPatient._id);
      expect(deletedPatient.isActive).toBe(false);
    });

    test('should return 403 for non-admin users', async () => {
      // Ensure user is not admin
      await User.findByIdAndUpdate(testUser._id, { role: 'doctor' });

      await request(app)
        .delete(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('GET /api/patients/:id/visits', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await Patient.create(createTestPatient());
    });

    test('should get patient visit history', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/visits`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/patients/:id/prescriptions', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await Patient.create(createTestPatient());
    });

    test('should get patient prescription history', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/prescriptions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });
});
