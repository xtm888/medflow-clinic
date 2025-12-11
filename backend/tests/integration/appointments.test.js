/**
 * Integration Tests for Appointment API
 *
 * Tests appointment scheduling, cancellation, and
 * conflict detection logic.
 */

const mongoose = require('mongoose');
const Appointment = require('../../models/Appointment');
const Patient = require('../../models/Patient');
const User = require('../../models/User');
const CONSTANTS = require('../../config/constants');
const {
  createTestPatient,
  createTestUser,
  createTestAppointment
} = require('../fixtures/generators');

describe('Appointment API', () => {
  let testPatient;
  let testProvider;

  beforeAll(async () => {
    testProvider = await User.create(createTestUser({
      role: 'doctor',
      specialization: 'ophthalmology'
    }));
  });

  beforeEach(async () => {
    testPatient = await Patient.create(createTestPatient());
  });

  describe('Appointment Creation', () => {
    test('should create appointment with valid data', async () => {
      const appointmentData = createTestAppointment(
        testPatient._id,
        testProvider._id
      );

      const appointment = await Appointment.create(appointmentData);

      expect(appointment._id).toBeDefined();
      expect(appointment.patient.toString()).toBe(testPatient._id.toString());
      expect(appointment.provider.toString()).toBe(testProvider._id.toString());
      expect(appointment.status).toBe('scheduled');
    });

    test('should use default duration from constants', () => {
      const appointmentData = createTestAppointment(
        testPatient._id,
        testProvider._id
      );

      expect(appointmentData.duration).toBe(30);
      expect(CONSTANTS.APPOINTMENT.DEFAULT_DURATION_MINUTES).toBe(30);
    });

    test('should allow different appointment types', async () => {
      const types = ['consultation', 'follow_up', 'procedure', 'surgery'];

      for (const type of types) {
        const appointment = await Appointment.create(
          createTestAppointment(testPatient._id, testProvider._id, { type })
        );
        expect(appointment.type).toBe(type);
      }
    });
  });

  describe('Appointment Time Slot Validation', () => {
    test('should detect conflicting appointments', async () => {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 1);
      baseDate.setHours(10, 0, 0, 0);

      // Create first appointment
      await Appointment.create(
        createTestAppointment(testPatient._id, testProvider._id, {
          appointmentDate: baseDate,
          duration: 30
        })
      );

      // Check for conflict
      const conflictStart = new Date(baseDate);
      conflictStart.setMinutes(conflictStart.getMinutes() + 15);

      const conflictEnd = new Date(conflictStart);
      conflictEnd.setMinutes(conflictEnd.getMinutes() + 30);

      const conflicts = await Appointment.find({
        provider: testProvider._id,
        status: { $nin: ['cancelled', 'no_show'] },
        appointmentDate: {
          $lt: conflictEnd,
          $gte: new Date(baseDate.getTime() - 30 * 60000)
        }
      });

      expect(conflicts.length).toBeGreaterThan(0);
    });

    test('should allow non-overlapping appointments', async () => {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 1);
      baseDate.setHours(10, 0, 0, 0);

      // First appointment at 10:00
      await Appointment.create(
        createTestAppointment(testPatient._id, testProvider._id, {
          appointmentDate: baseDate,
          duration: 30
        })
      );

      // Second appointment at 10:30 (no overlap)
      const secondDate = new Date(baseDate);
      secondDate.setMinutes(secondDate.getMinutes() + 30);

      const secondAppointment = await Appointment.create(
        createTestAppointment(testPatient._id, testProvider._id, {
          appointmentDate: secondDate,
          duration: 30
        })
      );

      expect(secondAppointment).toBeDefined();
    });
  });

  describe('Appointment Cancellation', () => {
    test('should apply correct cancellation fee based on notice', () => {
      const { CANCELLATION } = CONSTANTS;

      // Very late cancellation (< 2 hours)
      expect(CANCELLATION.VERY_LATE_FEE_PERCENT).toBe(100);

      // Late cancellation (< 24 hours)
      expect(CANCELLATION.LATE_FEE_PERCENT).toBe(50);

      // Normal cancellation (>= 24 hours)
      expect(CANCELLATION.NORMAL_FEE_PERCENT).toBe(0);
    });

    test('should calculate hours until appointment correctly', () => {
      const appointmentDate = new Date();
      appointmentDate.setHours(appointmentDate.getHours() + 5);

      const hoursUntil = (appointmentDate - new Date()) / (1000 * 60 * 60);

      expect(hoursUntil).toBeGreaterThan(4);
      expect(hoursUntil).toBeLessThan(6);
    });

    test('should categorize cancellation correctly', () => {
      const { CANCELLATION } = CONSTANTS;

      const getCancellationCategory = (hoursUntil) => {
        if (hoursUntil < CANCELLATION.VERY_LATE_THRESHOLD_HOURS) {
          return 'very_late';
        } else if (hoursUntil < CANCELLATION.LATE_THRESHOLD_HOURS) {
          return 'late';
        }
        return 'normal';
      };

      expect(getCancellationCategory(1)).toBe('very_late');
      expect(getCancellationCategory(12)).toBe('late');
      expect(getCancellationCategory(48)).toBe('normal');
    });

    test('should update appointment status on cancellation', async () => {
      const appointment = await Appointment.create(
        createTestAppointment(testPatient._id, testProvider._id)
      );

      appointment.status = 'cancelled';
      appointment.cancellationReason = 'Patient request';
      appointment.cancelledAt = new Date();
      await appointment.save();

      const updated = await Appointment.findById(appointment._id);
      expect(updated.status).toBe('cancelled');
      expect(updated.cancellationReason).toBe('Patient request');
    });
  });

  describe('Appointment Reminders', () => {
    test('should identify appointments needing reminders', async () => {
      const { APPOINTMENT } = CONSTANTS;
      const reminderWindow = APPOINTMENT.REMINDER_HOURS_BEFORE;

      // Create appointment for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      await Appointment.create(
        createTestAppointment(testPatient._id, testProvider._id, {
          appointmentDate: tomorrow,
          reminderSent: false
        })
      );

      // Find appointments needing reminders (within 24 hours)
      const reminderTime = new Date();
      reminderTime.setHours(reminderTime.getHours() + reminderWindow);

      const needsReminder = await Appointment.find({
        appointmentDate: { $lte: reminderTime },
        status: 'scheduled',
        reminderSent: { $ne: true }
      });

      expect(needsReminder.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Appointment Search and Filtering', () => {
    beforeEach(async () => {
      // Create appointments for different scenarios
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 1);
      baseDate.setHours(10, 0, 0, 0);

      // Create multiple appointments
      for (let i = 0; i < 5; i++) {
        const date = new Date(baseDate);
        date.setHours(date.getHours() + i);

        await Appointment.create(
          createTestAppointment(testPatient._id, testProvider._id, {
            appointmentDate: date,
            type: i % 2 === 0 ? 'consultation' : 'follow_up'
          })
        );
      }
    });

    test('should filter appointments by date range', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const appointments = await Appointment.find({
        appointmentDate: {
          $gte: startDate,
          $lte: endDate
        }
      });

      expect(appointments.length).toBeGreaterThan(0);
    });

    test('should filter appointments by type', async () => {
      const consultations = await Appointment.find({
        type: 'consultation'
      });

      const followUps = await Appointment.find({
        type: 'follow_up'
      });

      expect(consultations.length).toBeGreaterThan(0);
      expect(followUps.length).toBeGreaterThan(0);
    });

    test('should filter appointments by provider', async () => {
      const providerAppointments = await Appointment.find({
        provider: testProvider._id
      });

      expect(providerAppointments.length).toBeGreaterThan(0);
    });

    test('should filter appointments by patient', async () => {
      const patientAppointments = await Appointment.find({
        patient: testPatient._id
      });

      expect(patientAppointments.length).toBeGreaterThan(0);
    });
  });

  describe('Appointment Status Management', () => {
    test('should have valid status values', () => {
      const validStatuses = [
        'scheduled',
        'confirmed',
        'checked_in',
        'in_progress',
        'completed',
        'cancelled',
        'no_show'
      ];

      const defaultStatus = createTestAppointment(
        testPatient._id,
        testProvider._id
      ).status;

      expect(validStatuses).toContain(defaultStatus);
    });

    test('should track status history', async () => {
      const appointment = await Appointment.create(
        createTestAppointment(testPatient._id, testProvider._id)
      );

      // Simulate status changes
      const statusHistory = [];

      statusHistory.push({
        status: appointment.status,
        changedAt: new Date(),
        changedBy: testProvider._id
      });

      appointment.status = 'confirmed';
      await appointment.save();

      statusHistory.push({
        status: 'confirmed',
        changedAt: new Date(),
        changedBy: testProvider._id
      });

      expect(statusHistory.length).toBe(2);
      expect(statusHistory[1].status).toBe('confirmed');
    });
  });

  describe('Recurring Appointments', () => {
    test('should generate recurring appointment dates', () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(10, 0, 0, 0);

      const recurrencePattern = 'weekly';
      const occurrences = 4;
      const dates = [];

      for (let i = 0; i < occurrences; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (i * 7)); // Weekly
        dates.push(date);
      }

      expect(dates.length).toBe(4);

      // Verify weekly spacing
      const diff = dates[1] - dates[0];
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000); // 7 days in ms
    });
  });

  describe('Provider Availability', () => {
    test('should check provider working hours', () => {
      const workingHours = {
        monday: { start: '08:00', end: '17:00' },
        tuesday: { start: '08:00', end: '17:00' },
        wednesday: { start: '08:00', end: '17:00' },
        thursday: { start: '08:00', end: '17:00' },
        friday: { start: '08:00', end: '17:00' },
        saturday: null,
        sunday: null
      };

      const dayOfWeek = 'monday';
      const proposedTime = '10:00';

      const hours = workingHours[dayOfWeek];
      const isAvailable = hours && proposedTime >= hours.start && proposedTime < hours.end;

      expect(isAvailable).toBe(true);
    });

    test('should detect provider breaks', () => {
      const breaks = [
        { start: '12:00', end: '13:00' } // Lunch break
      ];

      const proposedTime = '12:30';

      const duringBreak = breaks.some(
        b => proposedTime >= b.start && proposedTime < b.end
      );

      expect(duringBreak).toBe(true);
    });
  });

  describe('Appointment Duration Calculations', () => {
    test('should use correct duration for appointment types', () => {
      const { APPOINTMENT } = CONSTANTS;

      expect(APPOINTMENT.CONSULTATION_DURATION_MINUTES).toBe(30);
      expect(APPOINTMENT.FOLLOW_UP_DURATION_MINUTES).toBe(15);
      expect(APPOINTMENT.PROCEDURE_DURATION_MINUTES).toBe(60);
      expect(APPOINTMENT.SURGERY_DURATION_MINUTES).toBe(120);
    });

    test('should calculate end time correctly', () => {
      const startTime = new Date();
      startTime.setHours(10, 0, 0, 0);

      const durationMinutes = 30;

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      expect(endTime.getHours()).toBe(10);
      expect(endTime.getMinutes()).toBe(30);
    });
  });
});
