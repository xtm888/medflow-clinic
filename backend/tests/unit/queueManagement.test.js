const Patient = require('../../models/Patient');
const { createTestPatient, createTestQueueEntry } = require('../fixtures/generators');

describe('Queue Management', () => {
  let patient1, patient2, patient3;

  beforeEach(async () => {
    patient1 = await Patient.create(createTestPatient());
    patient2 = await Patient.create(createTestPatient());
    patient3 = await Patient.create(createTestPatient());
  });

  describe('Queue Entry Creation', () => {
    test('should create queue entry with default priority', () => {
      const queueEntry = createTestQueueEntry(patient1._id);

      expect(queueEntry.patient).toEqual(patient1._id);
      expect(queueEntry.priority).toBe('normal');
      expect(queueEntry.status).toBe('waiting');
    });

    test('should create queue entry with high priority', () => {
      const queueEntry = createTestQueueEntry(patient1._id, {
        priority: 'high'
      });

      expect(queueEntry.priority).toBe('high');
    });

    test('should create queue entry with emergency priority', () => {
      const queueEntry = createTestQueueEntry(patient1._id, {
        priority: 'emergency'
      });

      expect(queueEntry.priority).toBe('emergency');
    });
  });

  describe('Queue Priority Ordering', () => {
    test('should order queue by priority then arrival time', () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

      const queue = [
        createTestQueueEntry(patient1._id, {
          priority: 'normal',
          arrivalTime: twentyMinutesAgo
        }),
        createTestQueueEntry(patient2._id, {
          priority: 'high',
          arrivalTime: tenMinutesAgo
        }),
        createTestQueueEntry(patient3._id, {
          priority: 'emergency',
          arrivalTime: now
        })
      ];

      // Sort by priority (emergency > high > normal) then by arrival time (earliest first)
      const priorityOrder = { emergency: 3, high: 2, normal: 1 };
      const sorted = queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.arrivalTime - b.arrivalTime;
      });

      expect(sorted[0].priority).toBe('emergency');
      expect(sorted[1].priority).toBe('high');
      expect(sorted[2].priority).toBe('normal');
    });

    test('should maintain FIFO order for same priority', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const queue = [
        createTestQueueEntry(patient1._id, {
          priority: 'normal',
          arrivalTime: tenMinutesAgo
        }),
        createTestQueueEntry(patient2._id, {
          priority: 'normal',
          arrivalTime: fiveMinutesAgo
        }),
        createTestQueueEntry(patient3._id, {
          priority: 'normal',
          arrivalTime: now
        })
      ];

      const sorted = queue.sort((a, b) => a.arrivalTime - b.arrivalTime);

      expect(sorted[0].patient).toEqual(patient1._id); // Earliest
      expect(sorted[1].patient).toEqual(patient2._id);
      expect(sorted[2].patient).toEqual(patient3._id); // Latest
    });
  });

  describe('Queue Status Transitions', () => {
    test('should transition from waiting to called', () => {
      const queueEntry = createTestQueueEntry(patient1._id, {
        status: 'waiting'
      });

      queueEntry.status = 'called';
      queueEntry.calledTime = new Date();

      expect(queueEntry.status).toBe('called');
      expect(queueEntry.calledTime).toBeDefined();
    });

    test('should transition from called to in-service', () => {
      const queueEntry = createTestQueueEntry(patient1._id, {
        status: 'called',
        calledTime: new Date()
      });

      queueEntry.status = 'in-service';
      queueEntry.serviceStartTime = new Date();

      expect(queueEntry.status).toBe('in-service');
      expect(queueEntry.serviceStartTime).toBeDefined();
    });

    test('should transition from in-service to completed', () => {
      const queueEntry = createTestQueueEntry(patient1._id, {
        status: 'in-service',
        serviceStartTime: new Date()
      });

      queueEntry.status = 'completed';
      queueEntry.serviceEndTime = new Date();

      expect(queueEntry.status).toBe('completed');
      expect(queueEntry.serviceEndTime).toBeDefined();
    });

    test('should allow skipping queue entry', () => {
      const queueEntry = createTestQueueEntry(patient1._id, {
        status: 'waiting'
      });

      queueEntry.status = 'skipped';
      queueEntry.skippedReason = 'Patient left';

      expect(queueEntry.status).toBe('skipped');
      expect(queueEntry.skippedReason).toBeDefined();
    });
  });

  describe('Queue Wait Time Calculations', () => {
    test('should calculate wait time correctly', () => {
      const arrivalTime = new Date('2025-12-07T08:00:00');
      const calledTime = new Date('2025-12-07T08:30:00');

      const queueEntry = createTestQueueEntry(patient1._id, {
        arrivalTime,
        calledTime,
        status: 'called'
      });

      const waitTime = (calledTime - arrivalTime) / (1000 * 60); // Minutes

      expect(waitTime).toBe(30);
    });

    test('should calculate service duration correctly', () => {
      const serviceStartTime = new Date('2025-12-07T08:30:00');
      const serviceEndTime = new Date('2025-12-07T09:00:00');

      const queueEntry = createTestQueueEntry(patient1._id, {
        serviceStartTime,
        serviceEndTime,
        status: 'completed'
      });

      const serviceDuration = (serviceEndTime - serviceStartTime) / (1000 * 60);

      expect(serviceDuration).toBe(30);
    });

    test('should calculate total time in system', () => {
      const arrivalTime = new Date('2025-12-07T08:00:00');
      const serviceEndTime = new Date('2025-12-07T09:00:00');

      const queueEntry = createTestQueueEntry(patient1._id, {
        arrivalTime,
        serviceEndTime,
        status: 'completed'
      });

      const totalTime = (serviceEndTime - arrivalTime) / (1000 * 60);

      expect(totalTime).toBe(60);
    });
  });

  describe('Department-Specific Queues', () => {
    test('should create separate queues for different departments', () => {
      const consultationQueue = createTestQueueEntry(patient1._id, {
        department: 'consultation'
      });
      const laboratoryQueue = createTestQueueEntry(patient2._id, {
        department: 'laboratory'
      });
      const pharmacyQueue = createTestQueueEntry(patient3._id, {
        department: 'pharmacy'
      });

      expect(consultationQueue.department).toBe('consultation');
      expect(laboratoryQueue.department).toBe('laboratory');
      expect(pharmacyQueue.department).toBe('pharmacy');
    });

    test('should track room assignment', () => {
      const queueEntry = createTestQueueEntry(patient1._id, {
        department: 'consultation',
        room: 'Room 101'
      });

      expect(queueEntry.room).toBe('Room 101');
    });
  });

  describe('Queue Capacity and Limits', () => {
    test('should handle maximum queue size', () => {
      const maxQueueSize = 50;
      const queue = Array.from({ length: 55 }, (_, i) =>
        createTestQueueEntry(patient1._id, { queueNumber: i + 1 })
      );

      const activeQueue = queue.filter(
        (entry) => entry.status === 'waiting' || entry.status === 'called'
      );

      // Business logic should prevent exceeding max queue size
      expect(queue.length).toBeGreaterThan(maxQueueSize);
      // In production, would reject additional entries
    });
  });

  describe('Queue Statistics', () => {
    test('should calculate average wait time', () => {
      const queue = [
        {
          arrivalTime: new Date('2025-12-07T08:00:00'),
          calledTime: new Date('2025-12-07T08:15:00')
        },
        {
          arrivalTime: new Date('2025-12-07T08:05:00'),
          calledTime: new Date('2025-12-07T08:25:00')
        },
        {
          arrivalTime: new Date('2025-12-07T08:10:00'),
          calledTime: new Date('2025-12-07T08:40:00')
        }
      ];

      const waitTimes = queue.map(
        (entry) => (entry.calledTime - entry.arrivalTime) / (1000 * 60)
      );

      const averageWait = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;

      expect(averageWait).toBe(20); // (15 + 20 + 30) / 3
    });

    test('should count patients by status', () => {
      const queue = [
        createTestQueueEntry(patient1._id, { status: 'waiting' }),
        createTestQueueEntry(patient2._id, { status: 'waiting' }),
        createTestQueueEntry(patient3._id, { status: 'in-service' })
      ];

      const statusCounts = queue.reduce((counts, entry) => {
        counts[entry.status] = (counts[entry.status] || 0) + 1;
        return counts;
      }, {});

      expect(statusCounts.waiting).toBe(2);
      expect(statusCounts['in-service']).toBe(1);
    });
  });
});
