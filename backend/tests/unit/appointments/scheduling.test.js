/**
 * Appointment Scheduling Tests
 *
 * Tests for appointment scheduling including:
 * - Creating appointments
 * - Conflict detection
 * - Duration validation
 * - Type-specific validation
 */

const request = require('supertest');
const app = require('../../../server');
const Appointment = require('../../../models/Appointment');
const Patient = require('../../../models/Patient');
const User = require('../../../models/User');
const { createTestPatient, createTestUser } = require('../../fixtures/generators');

describe('Appointment Scheduling', () => {
  let testUser;
  let testProvider;
  let testPatient;
  let authCookies;

  beforeEach(async () => {
    // Create receptionist user
    testUser = await User.create(
      createTestUser({
        email: 'receptionist@medflow.com',
        username: 'receptionist',
        password: 'ReceptionPass123!@#',
        role: 'receptionist'
      })
    );

    // Create physician (provider)
    testProvider = await User.create(
      createTestUser({
        email: 'doctor@medflow.com',
        username: 'doctor',
        password: 'DoctorPass123!@#',
        role: 'physician'
      })
    );

    // Create test patient
    testPatient = await Patient.create(createTestPatient());

    // Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'receptionist@medflow.com',
        password: 'ReceptionPass123!@#'
      });

    authCookies = loginResponse.headers['set-cookie'];
  });

  describe('POST /api/appointments', () => {
    test('should create appointment with valid data', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          duration: 30,
          type: 'consultation',
          department: 'general',
          reason: 'General checkup'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient).toBe(testPatient._id.toString());
      expect(response.body.data.provider).toBe(testProvider._id.toString());
      expect(response.body.data.status).toBe('scheduled');
    });

    test('should generate unique appointment ID', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response1 = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:00',
          endTime: '09:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        });

      const response2 = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '11:00',
          endTime: '11:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        });

      expect(response1.body.data.appointmentId).toBeDefined();
      expect(response2.body.data.appointmentId).toBeDefined();
      expect(response1.body.data.appointmentId).not.toBe(response2.body.data.appointmentId);
    });

    test('should reject appointment without required fields', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject appointment with invalid patient', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: '507f1f77bcf86cd799439011', // Non-existent
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should reject appointment in the past', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: yesterday,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        })
        .expect(400);

      expect(response.body.error).toMatch(/past|date/i);
    });

    test('should reject appointment with invalid time range', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:30',
          endTime: '10:00', // End before start
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        })
        .expect(400);

      expect(response.body.error).toMatch(/time|invalid/i);
    });

    test('should set default duration if not provided', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        })
        .expect(201);

      expect(response.body.data.duration).toBe(30);
    });

    test('should return 401 without authentication', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await request(app)
        .post('/api/appointments')
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        })
        .expect(401);
    });
  });

  describe('Conflict Detection', () => {
    let existingAppointment;
    let tomorrow;

    beforeEach(async () => {
      tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // Create existing appointment
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Existing appointment'
        });

      existingAppointment = response.body.data;
    });

    test('should detect exact time overlap for same provider', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Conflicting appointment'
        })
        .expect(409);

      expect(response.body.error).toMatch(/conflict|overlap/i);
    });

    test('should detect partial overlap (new starts during existing)', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:15',
          endTime: '10:45',
          type: 'consultation',
          department: 'general',
          reason: 'Overlapping appointment'
        })
        .expect(409);

      expect(response.body.error).toMatch(/conflict|overlap/i);
    });

    test('should detect partial overlap (existing starts during new)', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:45',
          endTime: '10:15',
          type: 'consultation',
          department: 'general',
          reason: 'Overlapping appointment'
        })
        .expect(409);

      expect(response.body.error).toMatch(/conflict|overlap/i);
    });

    test('should detect new appointment contains existing', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:30',
          endTime: '11:00',
          type: 'consultation',
          department: 'general',
          reason: 'Encompassing appointment'
        })
        .expect(409);

      expect(response.body.error).toMatch(/conflict|overlap/i);
    });

    test('should allow adjacent appointments (no gap)', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:30',
          endTime: '11:00',
          type: 'consultation',
          department: 'general',
          reason: 'Adjacent appointment'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should allow same time with different provider', async () => {
      // Create another provider
      const anotherProvider = await User.create(
        createTestUser({
          email: 'doctor2@medflow.com',
          username: 'doctor2',
          role: 'physician'
        })
      );

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: anotherProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Same time, different doctor'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should ignore cancelled appointments for conflict detection', async () => {
      // Cancel existing appointment
      await request(app)
        .put(`/api/appointments/${existingAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({ reason: 'Cancelled' });

      // Should now allow same slot
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Replacement appointment'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should detect patient double-booking', async () => {
      // Try to book same patient at same time with different provider
      const anotherProvider = await User.create(
        createTestUser({
          email: 'doctor3@medflow.com',
          username: 'doctor3',
          role: 'physician'
        })
      );

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: anotherProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Patient double-booking attempt'
        })
        .expect(409);

      expect(response.body.error).toMatch(/patient.*already|double.*book/i);
    });
  });

  describe('Appointment Types', () => {
    test('should enforce minimum duration for surgery appointments', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:00',
          endTime: '09:30',
          duration: 30, // Too short for surgery
          type: 'surgery',
          department: 'general',
          reason: 'Appendectomy'
        })
        .expect(400);

      expect(response.body.error).toMatch(/duration|minimum/i);
    });

    test('should allow longer duration for surgery appointments', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:00',
          endTime: '12:00',
          duration: 180,
          type: 'surgery',
          department: 'general',
          reason: 'Appendectomy'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should set default duration based on appointment type', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Lab test should be 15 min
      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:00',
          endTime: '09:15',
          type: 'lab-test',
          department: 'laboratory',
          reason: 'Blood work'
        })
        .expect(201);

      expect(response.body.data.duration).toBe(15);
    });

    test('should require virtual link for telemedicine appointments', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:00',
          endTime: '09:30',
          type: 'telemedicine',
          department: 'general',
          reason: 'Virtual consultation',
          location: {
            isVirtual: true
            // Missing virtualLink
          }
        })
        .expect(400);

      expect(response.body.error).toMatch(/virtual.*link|required/i);
    });

    test('should accept telemedicine with virtual link', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '09:00',
          endTime: '09:30',
          type: 'telemedicine',
          department: 'general',
          reason: 'Virtual consultation',
          location: {
            isVirtual: true,
            virtualLink: 'https://meet.medflow.com/abc123'
          }
        })
        .expect(201);

      expect(response.body.data.location.isVirtual).toBe(true);
    });
  });

  describe('Priority Handling', () => {
    test('should allow setting priority on appointment', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Urgent consultation',
          priority: 'urgent'
        })
        .expect(201);

      expect(response.body.data.priority).toBe('urgent');
    });

    test('should default to normal priority', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Regular consultation'
        })
        .expect(201);

      expect(response.body.data.priority).toBe('normal');
    });

    test('should automatically set priority for elderly patients', async () => {
      // Create elderly patient
      const elderlyPatient = await Patient.create(
        createTestPatient({
          dateOfBirth: new Date('1940-01-01')
        })
      );

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: elderlyPatient._id,
          provider: testProvider._id,
          date: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Check-up'
        })
        .expect(201);

      expect(['elderly', 'high']).toContain(response.body.data.priority);
    });
  });
});
