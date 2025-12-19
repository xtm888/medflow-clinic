/**
 * Appointment Status Transition Tests
 *
 * Tests for appointment status flow including:
 * - Valid state transitions
 * - Check-in process
 * - No-show handling
 * - Rescheduling
 * - Cancellation
 */

const request = require('supertest');
const app = require('../../../server');
const Appointment = require('../../../models/Appointment');
const Patient = require('../../../models/Patient');
const User = require('../../../models/User');
const { createTestPatient, createTestUser } = require('../../fixtures/generators');

/**
 * Appointment Status Flow:
 *
 * scheduled -> confirmed -> checked-in -> in-progress -> completed
 *          \-> cancelled
 *          \-> rescheduled
 *          \-> no_show
 */

describe('Appointment Status Transitions', () => {
  let testUser;
  let testProvider;
  let testPatient;
  let authCookies;
  let testAppointment;
  let tomorrow;

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

    // Create physician
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

    // Create test appointment
    tomorrow = new Date();
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
        type: 'consultation',
        department: 'general',
        reason: 'General checkup'
      });

    testAppointment = response.body.data;
  });

  describe('Initial Status', () => {
    test('should create appointment with scheduled status', async () => {
      expect(testAppointment.status).toBe('scheduled');
    });
  });

  describe('Scheduled -> Confirmed', () => {
    test('should transition from scheduled to confirmed', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.status).toBe('confirmed');
    });

    test('should record confirmation method', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies)
        .send({
          confirmationMethod: 'phone',
          confirmedBy: 'Patient'
        })
        .expect(200);

      expect(response.body.data.confirmation.method).toBe('phone');
      expect(response.body.data.confirmation.confirmedBy).toBe('Patient');
    });

    test('should record confirmation timestamp', async () => {
      const beforeConfirm = new Date();

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies)
        .expect(200);

      const afterConfirm = new Date();
      const confirmedAt = new Date(response.body.data.confirmation.confirmedAt);

      expect(confirmedAt >= beforeConfirm).toBe(true);
      expect(confirmedAt <= afterConfirm).toBe(true);
    });
  });

  describe('Check-In Process', () => {
    beforeEach(async () => {
      // Confirm appointment first
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies);
    });

    test('should transition from confirmed to checked-in', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.status).toBe('checked-in');
    });

    test('should record check-in time', async () => {
      const beforeCheckIn = new Date();

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.checkInTime).toBeDefined();
      const checkInTime = new Date(response.body.data.checkInTime);
      expect(checkInTime >= beforeCheckIn).toBe(true);
    });

    test('should assign queue number on check-in', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.queueNumber).toBeDefined();
      expect(typeof response.body.data.queueNumber).toBe('number');
    });

    test('should allow direct check-in from scheduled status', async () => {
      // Create new appointment (scheduled status)
      const newAppointmentResponse = await request(app)
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

      const newAppointment = newAppointmentResponse.body.data;

      // Check-in directly
      const response = await request(app)
        .put(`/api/appointments/${newAppointment._id}/check-in`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.status).toBe('checked-in');
    });

    test('should record who performed check-in', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.checkedInBy).toBe(testUser._id.toString());
    });
  });

  describe('In-Progress -> Completed', () => {
    beforeEach(async () => {
      // Progress to checked-in status
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies);
    });

    test('should transition from checked-in to in-progress', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.status).toBe('in-progress');
    });

    test('should record consultation start time', async () => {
      const beforeStart = new Date();

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.consultationStartTime).toBeDefined();
      const startTime = new Date(response.body.data.consultationStartTime);
      expect(startTime >= beforeStart).toBe(true);
    });

    test('should calculate waiting time when consultation starts', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.waitingTime).toBeDefined();
      expect(typeof response.body.data.waitingTime).toBe('number');
    });

    test('should transition from in-progress to completed', async () => {
      // Start consultation
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      // Complete consultation
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies)
        .send({
          notes: 'Consultation completed successfully'
        })
        .expect(200);

      expect(response.body.data.status).toBe('completed');
    });

    test('should record consultation end time on completion', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.consultationEndTime).toBeDefined();
    });

    test('should calculate consultation duration on completion', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.actualDuration).toBeDefined();
      expect(typeof response.body.data.actualDuration).toBe('number');
    });
  });

  describe('Cancellation', () => {
    test('should cancel scheduled appointment', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Patient request'
        })
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });

    test('should cancel confirmed appointment', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Provider unavailable'
        })
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });

    test('should require cancellation reason', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({})
        .expect(400);

      expect(response.body.error).toMatch(/reason/i);
    });

    test('should record who cancelled the appointment', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Patient request'
        })
        .expect(200);

      expect(response.body.data.cancellation.cancelledBy).toBe(testUser._id.toString());
    });

    test('should record cancellation timestamp', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Patient request'
        })
        .expect(200);

      expect(response.body.data.cancellation.cancelledAt).toBeDefined();
    });

    test('should not cancel completed appointment', async () => {
      // Progress to completed
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies);

      // Try to cancel
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Test'
        })
        .expect(400);

      expect(response.body.error).toMatch(/cannot.*cancel|completed/i);
    });

    test('should not cancel in-progress appointment without override', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Patient left'
        })
        .expect(400);

      expect(response.body.error).toMatch(/cannot.*cancel|in.*progress/i);
    });
  });

  describe('No-Show Handling', () => {
    test('should mark appointment as no-show', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/no-show`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.status).toBe('no_show');
    });

    test('should record no-show timestamp', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/no-show`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.noShowMarkedAt).toBeDefined();
    });

    test('should not mark checked-in appointment as no-show', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/no-show`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.error).toMatch(/cannot.*no.*show|already.*checked/i);
    });

    test('should increment patient no-show count', async () => {
      const beforeNoShow = await Patient.findById(testPatient._id);
      const initialCount = beforeNoShow.noShowCount || 0;

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/no-show`)
        .set('Cookie', authCookies);

      const afterNoShow = await Patient.findById(testPatient._id);
      expect(afterNoShow.noShowCount).toBe(initialCount + 1);
    });
  });

  describe('Rescheduling', () => {
    test('should reschedule appointment to new date/time', async () => {
      const newDate = new Date(tomorrow);
      newDate.setDate(newDate.getDate() + 1);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookies)
        .send({
          newDate: newDate,
          newStartTime: '14:00',
          newEndTime: '14:30',
          reason: 'Patient request'
        })
        .expect(200);

      expect(response.body.data.status).toBe('rescheduled');
      expect(response.body.data.rescheduledTo).toBeDefined();
    });

    test('should create new appointment when rescheduling', async () => {
      const newDate = new Date(tomorrow);
      newDate.setDate(newDate.getDate() + 1);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookies)
        .send({
          newDate: newDate,
          newStartTime: '14:00',
          newEndTime: '14:30',
          reason: 'Patient request'
        })
        .expect(200);

      expect(response.body.data.newAppointment).toBeDefined();
      expect(response.body.data.newAppointment._id).not.toBe(testAppointment._id);
    });

    test('should link old and new appointments', async () => {
      const newDate = new Date(tomorrow);
      newDate.setDate(newDate.getDate() + 1);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookies)
        .send({
          newDate: newDate,
          newStartTime: '14:00',
          newEndTime: '14:30',
          reason: 'Schedule conflict'
        })
        .expect(200);

      const newAppointment = response.body.data.newAppointment;
      expect(newAppointment.rescheduledFrom).toBe(testAppointment._id);
    });

    test('should require reason for rescheduling', async () => {
      const newDate = new Date(tomorrow);
      newDate.setDate(newDate.getDate() + 1);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookies)
        .send({
          newDate: newDate,
          newStartTime: '14:00',
          newEndTime: '14:30'
        })
        .expect(400);

      expect(response.body.error).toMatch(/reason/i);
    });

    test('should validate new time slot availability', async () => {
      // Create another appointment at the target time
      const newDate = new Date(tomorrow);
      newDate.setDate(newDate.getDate() + 1);

      await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: newDate,
          startTime: '14:00',
          endTime: '14:30',
          type: 'consultation',
          department: 'general',
          reason: 'Blocking appointment'
        });

      // Try to reschedule to that slot
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookies)
        .send({
          newDate: newDate,
          newStartTime: '14:00',
          newEndTime: '14:30',
          reason: 'Patient request'
        })
        .expect(409);

      expect(response.body.error).toMatch(/conflict|unavailable/i);
    });

    test('should not reschedule completed appointment', async () => {
      // Complete the appointment
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies);

      const newDate = new Date(tomorrow);
      newDate.setDate(newDate.getDate() + 1);

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/reschedule`)
        .set('Cookie', authCookies)
        .send({
          newDate: newDate,
          newStartTime: '14:00',
          newEndTime: '14:30',
          reason: 'Test'
        })
        .expect(400);

      expect(response.body.error).toMatch(/cannot.*reschedule|completed/i);
    });
  });

  describe('Status History', () => {
    test('should record all status changes', async () => {
      // Progress through workflow
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies);

      const response = await request(app)
        .get(`/api/appointments/${testAppointment._id}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.statusHistory).toBeDefined();
      expect(response.body.data.statusHistory.length).toBeGreaterThanOrEqual(4);
    });

    test('should record who made each status change', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies);

      const response = await request(app)
        .get(`/api/appointments/${testAppointment._id}`)
        .set('Cookie', authCookies)
        .expect(200);

      const confirmEntry = response.body.data.statusHistory.find(
        h => h.status === 'confirmed'
      );

      expect(confirmEntry.changedBy).toBe(testUser._id.toString());
    });
  });

  describe('Invalid Transitions', () => {
    test('should not allow completed -> checked-in', async () => {
      // Complete the appointment
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/start`)
        .set('Cookie', authCookies);

      await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies);

      // Try to check-in again
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/check-in`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.error).toMatch(/invalid.*status|completed/i);
    });

    test('should not allow cancelled -> confirmed', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment._id}/cancel`)
        .set('Cookie', authCookies)
        .send({ reason: 'Test' });

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/confirm`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.error).toMatch(/invalid.*status|cancelled/i);
    });

    test('should not allow scheduled -> completed directly', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}/complete`)
        .set('Cookie', authCookies)
        .expect(400);

      expect(response.body.error).toMatch(/invalid.*status|must/i);
    });
  });
});
