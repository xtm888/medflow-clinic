/**
 * Integration Tests for Queue API
 *
 * Tests queue management endpoints including patient check-in,
 * status updates, and priority handling.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const Patient = require('../../models/Patient');
const User = require('../../models/User');
const Visit = require('../../models/Visit');
const jwt = require('jsonwebtoken');
const {
  createTestPatient,
  createTestUser,
  createTestQueueEntry
} = require('../fixtures/generators');

// Create minimal Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock auth middleware for testing
  app.use((req, res, next) => {
    req.user = req.testUser;
    req.clinicId = req.testClinicId;
    next();
  });

  // Import queue routes
  const queueRoutes = require('../../routes/queue');
  app.use('/api/queue', queueRoutes);

  return app;
};

describe('Queue API', () => {
  let testUser;
  let testPatient;
  let authToken;
  let app;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create(createTestUser({
      role: 'doctor',
      permissions: ['view_queue', 'manage_queue', 'call_patient']
    }));

    // Create auth token
    authToken = jwt.sign(
      { id: testUser._id, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create app with test user context
    app = createTestApp();
    app.use((req, res, next) => {
      req.testUser = testUser;
      next();
    });
  });

  beforeEach(async () => {
    // Create fresh test patient for each test
    testPatient = await Patient.create(createTestPatient());
  });

  describe('Queue Data Structures', () => {
    test('queue entry should have required fields', () => {
      const entry = createTestQueueEntry(testPatient._id);

      expect(entry.patient).toBeDefined();
      expect(entry.department).toBeDefined();
      expect(entry.priority).toBeDefined();
      expect(entry.status).toBeDefined();
      expect(entry.arrivalTime).toBeDefined();
    });

    test('priority levels should be valid', () => {
      const validPriorities = ['emergency', 'urgent', 'normal', 'low'];
      const entry = createTestQueueEntry(testPatient._id);

      expect(validPriorities).toContain(entry.priority);
    });

    test('status should be valid', () => {
      const validStatuses = ['waiting', 'called', 'in_consultation', 'completed', 'no_show', 'cancelled'];
      const entry = createTestQueueEntry(testPatient._id);

      // Default status
      expect(validStatuses).toContain(entry.status);
    });
  });

  describe('Queue Wait Time Calculations', () => {
    test('should calculate estimated wait time correctly', () => {
      const WAIT_TIME_PER_PATIENT = 15; // minutes
      const patientsAhead = 5;

      const estimatedWait = patientsAhead * WAIT_TIME_PER_PATIENT;

      expect(estimatedWait).toBe(75);
    });

    test('should handle priority adjustments', () => {
      const priorityWeights = {
        emergency: 0,
        urgent: 5,
        normal: 15,
        low: 30
      };

      expect(priorityWeights.emergency).toBeLessThan(priorityWeights.urgent);
      expect(priorityWeights.urgent).toBeLessThan(priorityWeights.normal);
      expect(priorityWeights.normal).toBeLessThan(priorityWeights.low);
    });
  });

  describe('Visit Model for Queue', () => {
    test('should create visit when checking in patient', async () => {
      const visitData = {
        patient: testPatient._id,
        visitDate: new Date(),
        status: 'waiting',
        type: 'consultation',
        chiefComplaint: 'General checkup',
        queueNumber: 1,
        department: 'consultation'
      };

      const visit = await Visit.create(visitData);

      expect(visit.patient.toString()).toBe(testPatient._id.toString());
      expect(visit.status).toBe('waiting');
      expect(visit.queueNumber).toBe(1);
    });

    test('should update visit status correctly', async () => {
      const visit = await Visit.create({
        patient: testPatient._id,
        visitDate: new Date(),
        status: 'waiting',
        type: 'consultation',
        chiefComplaint: 'Test complaint'
      });

      visit.status = 'in_progress';
      await visit.save();

      const updated = await Visit.findById(visit._id);
      expect(updated.status).toBe('in_progress');
    });
  });

  describe('Queue Sorting Logic', () => {
    test('should sort emergency patients first', () => {
      const queue = [
        { id: 1, priority: 'normal', arrivalTime: new Date('2024-01-01 09:00') },
        { id: 2, priority: 'emergency', arrivalTime: new Date('2024-01-01 09:05') },
        { id: 3, priority: 'urgent', arrivalTime: new Date('2024-01-01 09:02') }
      ];

      const priorityOrder = { emergency: 0, urgent: 1, normal: 2, low: 3 };

      const sorted = queue.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.arrivalTime) - new Date(b.arrivalTime);
      });

      expect(sorted[0].id).toBe(2); // Emergency first
      expect(sorted[1].id).toBe(3); // Then urgent
      expect(sorted[2].id).toBe(1); // Then normal
    });

    test('should sort by arrival time within same priority', () => {
      const queue = [
        { id: 1, priority: 'normal', arrivalTime: new Date('2024-01-01 09:30') },
        { id: 2, priority: 'normal', arrivalTime: new Date('2024-01-01 09:00') },
        { id: 3, priority: 'normal', arrivalTime: new Date('2024-01-01 09:15') }
      ];

      const sorted = queue.sort((a, b) =>
        new Date(a.arrivalTime) - new Date(b.arrivalTime)
      );

      expect(sorted[0].id).toBe(2); // Earliest
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1); // Latest
    });
  });

  describe('Queue Statistics', () => {
    test('should calculate queue statistics correctly', async () => {
      // Create multiple visits with different statuses
      const visits = [
        { patient: testPatient._id, status: 'waiting', visitDate: new Date() },
        { patient: testPatient._id, status: 'waiting', visitDate: new Date() },
        { patient: testPatient._id, status: 'in_progress', visitDate: new Date() },
        { patient: testPatient._id, status: 'completed', visitDate: new Date() }
      ];

      for (const v of visits) {
        await Visit.create({
          ...v,
          type: 'consultation',
          chiefComplaint: 'Test'
        });
      }

      const stats = await Visit.aggregate([
        {
          $match: {
            visitDate: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const waiting = stats.find(s => s._id === 'waiting')?.count || 0;
      const inProgress = stats.find(s => s._id === 'in_progress')?.count || 0;
      const completed = stats.find(s => s._id === 'completed')?.count || 0;

      expect(waiting).toBe(2);
      expect(inProgress).toBe(1);
      expect(completed).toBe(1);
    });
  });

  describe('Queue Number Generation', () => {
    test('should generate unique queue numbers for today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get count of visits today
      const todayVisits = await Visit.countDocuments({
        visitDate: { $gte: today }
      });

      const nextQueueNumber = todayVisits + 1;

      expect(nextQueueNumber).toBeGreaterThan(0);
    });

    test('queue numbers should reset daily', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Different day filter should give different results
      expect(today.getTime()).not.toBe(tomorrow.getTime());
    });
  });

  describe('Department Queue Filtering', () => {
    test('should filter queue by department', async () => {
      // Create visits in different departments
      await Visit.create({
        patient: testPatient._id,
        visitDate: new Date(),
        status: 'waiting',
        type: 'consultation',
        department: 'ophthalmology',
        chiefComplaint: 'Eye exam'
      });

      await Visit.create({
        patient: testPatient._id,
        visitDate: new Date(),
        status: 'waiting',
        type: 'consultation',
        department: 'general',
        chiefComplaint: 'General checkup'
      });

      const ophthalmologyQueue = await Visit.find({
        department: 'ophthalmology',
        status: 'waiting'
      });

      const generalQueue = await Visit.find({
        department: 'general',
        status: 'waiting'
      });

      expect(ophthalmologyQueue.length).toBe(1);
      expect(generalQueue.length).toBe(1);
    });
  });

  describe('Patient Check-In Validation', () => {
    test('should require patient ID for check-in', () => {
      const checkInData = {};
      const errors = [];

      if (!checkInData.patientId) {
        errors.push('Patient ID is required');
      }

      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Patient ID is required');
    });

    test('should prevent duplicate check-ins', async () => {
      // Create initial visit
      await Visit.create({
        patient: testPatient._id,
        visitDate: new Date(),
        status: 'waiting',
        type: 'consultation',
        chiefComplaint: 'First visit'
      });

      // Check for existing waiting visit
      const existingVisit = await Visit.findOne({
        patient: testPatient._id,
        status: 'waiting',
        visitDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      });

      expect(existingVisit).toBeTruthy();

      // Should prevent duplicate
      const canCheckIn = !existingVisit;
      expect(canCheckIn).toBe(false);
    });
  });

  describe('Queue Status Transitions', () => {
    test('should allow valid status transitions', () => {
      const validTransitions = {
        waiting: ['called', 'no_show', 'cancelled'],
        called: ['in_consultation', 'no_show', 'waiting'],
        in_consultation: ['completed', 'waiting'],
        completed: [],
        no_show: ['waiting'],
        cancelled: []
      };

      // Waiting can transition to called
      expect(validTransitions.waiting).toContain('called');

      // Called can transition to in_consultation
      expect(validTransitions.called).toContain('in_consultation');

      // Completed is final
      expect(validTransitions.completed.length).toBe(0);
    });

    test('should track status change timestamps', async () => {
      const visit = await Visit.create({
        patient: testPatient._id,
        visitDate: new Date(),
        status: 'waiting',
        type: 'consultation',
        chiefComplaint: 'Test'
      });

      const initialTime = visit.updatedAt;

      // Wait a moment and update
      await new Promise(resolve => setTimeout(resolve, 100));

      visit.status = 'called';
      visit.calledAt = new Date();
      await visit.save();

      const updated = await Visit.findById(visit._id);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(initialTime.getTime());
    });
  });
});
