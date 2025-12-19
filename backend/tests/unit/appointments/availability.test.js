/**
 * Provider Availability Tests
 *
 * Tests for availability checking including:
 * - Provider schedule lookup
 * - Available slot calculation
 * - Blocked time handling
 * - Working hours validation
 */

const request = require('supertest');
const app = require('../../../server');
const ProviderAvailability = require('../../../models/ProviderAvailability');
const User = require('../../../models/User');
const { createTestUser } = require('../../fixtures/generators');

describe('Provider Availability', () => {
  let testProvider;
  let authCookies;
  let adminUser;

  beforeEach(async () => {
    // Create admin user
    adminUser = await User.create(
      createTestUser({
        email: 'admin@medflow.com',
        username: 'admin',
        password: 'MgrSecure123!@#',
        role: 'admin'
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

    // Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@medflow.com',
        password: 'MgrSecure123!@#'
      });

    authCookies = loginResponse.headers['set-cookie'];

    // Set up provider availability
    await ProviderAvailability.create({
      provider: testProvider._id,
      schedule: [
        {
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true
        },
        {
          dayOfWeek: 2, // Tuesday
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true
        },
        {
          dayOfWeek: 3, // Wednesday
          startTime: '09:00',
          endTime: '13:00', // Half day
          isAvailable: true
        },
        {
          dayOfWeek: 4, // Thursday
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true
        },
        {
          dayOfWeek: 5, // Friday
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true
        }
        // Saturday (6) and Sunday (0) not available
      ]
    });
  });

  describe('GET /api/appointments/availability/:providerId', () => {
    test('should return available slots for a provider on a working day', async () => {
      // Find next Monday
      const nextMonday = getNextDayOfWeek(1);

      const response = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slots).toBeDefined();
      expect(response.body.data.slots.length).toBeGreaterThan(0);

      // First slot should be at 09:00
      expect(response.body.data.slots[0].startTime).toBe('09:00');
    });

    test('should return empty slots for non-working day', async () => {
      // Find next Sunday
      const nextSunday = getNextDayOfWeek(0);

      const response = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextSunday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      expect(response.body.data.slots.length).toBe(0);
      expect(response.body.data.isWorkingDay).toBe(false);
    });

    test('should respect slot duration when calculating slots', async () => {
      const nextMonday = getNextDayOfWeek(1);

      // 30-minute slots from 09:00-17:00 = 16 slots
      const response30 = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      // 60-minute slots from 09:00-17:00 = 8 slots
      const response60 = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          duration: 60
        })
        .expect(200);

      expect(response30.body.data.slots.length).toBe(16);
      expect(response60.body.data.slots.length).toBe(8);
    });

    test('should exclude already booked slots', async () => {
      const nextMonday = getNextDayOfWeek(1);
      const Patient = require('../../../models/Patient');
      const testPatient = await Patient.create(
        require('../../fixtures/generators').createTestPatient()
      );

      // Book 10:00 slot
      await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: nextMonday,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        });

      const response = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      const hasBookedSlot = response.body.data.slots.some(
        slot => slot.startTime === '10:00'
      );
      expect(hasBookedSlot).toBe(false);
    });

    test('should handle half-day schedules', async () => {
      // Wednesday is half-day (09:00-13:00)
      const nextWednesday = getNextDayOfWeek(3);

      const response = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextWednesday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      // 09:00-13:00 = 8 slots of 30 minutes
      expect(response.body.data.slots.length).toBe(8);

      // Last slot should end by 13:00
      const lastSlot = response.body.data.slots[response.body.data.slots.length - 1];
      expect(lastSlot.endTime).toBe('13:00');
    });

    test('should return 404 for non-existent provider', async () => {
      const response = await request(app)
        .get('/api/appointments/availability/507f1f77bcf86cd799439011')
        .set('Cookie', authCookies)
        .query({
          date: '2025-01-15',
          duration: 30
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Blocked Time Handling', () => {
    test('should respect blocked time periods', async () => {
      const nextMonday = getNextDayOfWeek(1);

      // Block lunch time
      await ProviderAvailability.findOneAndUpdate(
        { provider: testProvider._id },
        {
          $push: {
            blockedTimes: {
              date: nextMonday,
              startTime: '12:00',
              endTime: '13:00',
              reason: 'Lunch break'
            }
          }
        }
      );

      const response = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      // Should not have 12:00 or 12:30 slots
      const has1200 = response.body.data.slots.some(s => s.startTime === '12:00');
      const has1230 = response.body.data.slots.some(s => s.startTime === '12:30');

      expect(has1200).toBe(false);
      expect(has1230).toBe(false);
    });

    test('should handle all-day blocked dates', async () => {
      const nextMonday = getNextDayOfWeek(1);

      // Block entire day (vacation)
      await ProviderAvailability.findOneAndUpdate(
        { provider: testProvider._id },
        {
          $push: {
            blockedTimes: {
              date: nextMonday,
              startTime: '00:00',
              endTime: '23:59',
              reason: 'Vacation',
              isAllDay: true
            }
          }
        }
      );

      const response = await request(app)
        .get(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      expect(response.body.data.slots.length).toBe(0);
      expect(response.body.data.blockedReason).toBe('Vacation');
    });
  });

  describe('POST /api/appointments/availability', () => {
    test('should create availability for provider', async () => {
      // Create new provider without availability
      const newProvider = await User.create(
        createTestUser({
          email: 'newdoctor@medflow.com',
          username: 'newdoctor',
          role: 'physician'
        })
      );

      const response = await request(app)
        .post('/api/appointments/availability')
        .set('Cookie', authCookies)
        .send({
          provider: newProvider._id,
          schedule: [
            {
              dayOfWeek: 1,
              startTime: '08:00',
              endTime: '16:00',
              isAvailable: true
            }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.schedule.length).toBe(1);
    });

    test('should update existing availability', async () => {
      const response = await request(app)
        .put(`/api/appointments/availability/${testProvider._id}`)
        .set('Cookie', authCookies)
        .send({
          schedule: [
            {
              dayOfWeek: 1,
              startTime: '10:00', // Changed from 09:00
              endTime: '18:00', // Changed from 17:00
              isAvailable: true
            }
          ]
        })
        .expect(200);

      expect(response.body.data.schedule[0].startTime).toBe('10:00');
      expect(response.body.data.schedule[0].endTime).toBe('18:00');
    });

    test('should validate time format', async () => {
      const response = await request(app)
        .post('/api/appointments/availability')
        .set('Cookie', authCookies)
        .send({
          provider: testProvider._id,
          schedule: [
            {
              dayOfWeek: 1,
              startTime: 'invalid',
              endTime: '16:00',
              isAvailable: true
            }
          ]
        })
        .expect(400);

      expect(response.body.error).toMatch(/time|format|invalid/i);
    });

    test('should validate day of week', async () => {
      const response = await request(app)
        .post('/api/appointments/availability')
        .set('Cookie', authCookies)
        .send({
          provider: testProvider._id,
          schedule: [
            {
              dayOfWeek: 8, // Invalid
              startTime: '09:00',
              endTime: '17:00',
              isAvailable: true
            }
          ]
        })
        .expect(400);

      expect(response.body.error).toMatch(/day|invalid/i);
    });
  });

  describe('POST /api/appointments/block-time', () => {
    test('should block a time period', async () => {
      const nextMonday = getNextDayOfWeek(1);

      const response = await request(app)
        .post('/api/appointments/block-time')
        .set('Cookie', authCookies)
        .send({
          provider: testProvider._id,
          date: nextMonday,
          startTime: '14:00',
          endTime: '15:00',
          reason: 'Meeting'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.blockedTimes).toBeDefined();
    });

    test('should reject blocking time outside working hours', async () => {
      const nextMonday = getNextDayOfWeek(1);

      const response = await request(app)
        .post('/api/appointments/block-time')
        .set('Cookie', authCookies)
        .send({
          provider: testProvider._id,
          date: nextMonday,
          startTime: '18:00', // After working hours
          endTime: '19:00',
          reason: 'Meeting'
        })
        .expect(400);

      expect(response.body.error).toMatch(/outside.*working|hours/i);
    });

    test('should reject blocking time with existing appointments', async () => {
      const nextMonday = getNextDayOfWeek(1);
      const Patient = require('../../../models/Patient');
      const testPatient = await Patient.create(
        require('../../fixtures/generators').createTestPatient()
      );

      // Create appointment at 14:00
      await request(app)
        .post('/api/appointments')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          provider: testProvider._id,
          date: nextMonday,
          startTime: '14:00',
          endTime: '14:30',
          type: 'consultation',
          department: 'general',
          reason: 'Test'
        });

      // Try to block time that has appointment
      const response = await request(app)
        .post('/api/appointments/block-time')
        .set('Cookie', authCookies)
        .send({
          provider: testProvider._id,
          date: nextMonday,
          startTime: '14:00',
          endTime: '15:00',
          reason: 'Meeting'
        })
        .expect(409);

      expect(response.body.error).toMatch(/existing.*appointment|conflict/i);
    });
  });

  describe('Availability by Department', () => {
    test('should filter availability by department', async () => {
      // Update provider with department specialization
      await User.findByIdAndUpdate(testProvider._id, {
        department: 'ophthalmology'
      });

      const nextMonday = getNextDayOfWeek(1);

      const response = await request(app)
        .get('/api/appointments/availability')
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          department: 'ophthalmology',
          duration: 30
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toBeDefined();

      // Should include our provider
      const providerResult = response.body.data.providers.find(
        p => p.providerId === testProvider._id.toString()
      );
      expect(providerResult).toBeDefined();
    });

    test('should return all providers when no department filter', async () => {
      const nextMonday = getNextDayOfWeek(1);

      const response = await request(app)
        .get('/api/appointments/availability')
        .set('Cookie', authCookies)
        .query({
          date: nextMonday.toISOString().split('T')[0],
          duration: 30
        })
        .expect(200);

      expect(response.body.data.providers.length).toBeGreaterThan(0);
    });
  });
});

// Helper function to get next occurrence of a day of week
function getNextDayOfWeek(dayOfWeek) {
  const today = new Date();
  const daysUntilTarget = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + daysUntilTarget);
  nextDay.setHours(0, 0, 0, 0);
  return nextDay;
}
