// Set test environment BEFORE loading any modules
process.env.NODE_ENV = 'test';
process.env.DISABLE_SCHEDULERS = 'true';
process.env.DISABLE_CACHE_WARMING = 'true';

// Mock email service to prevent actual email sending during tests
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendAppointmentReminder: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../utils/sendEmail', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Mock timers to prevent background tasks
jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

// Setup before all tests
beforeAll(async () => {
  // Disconnect any existing connection first
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri);

  console.log('✅ Test database connected');
});

// Cleanup after each test
afterEach(async () => {
  // Clear all fake timers
  jest.clearAllTimers();

  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  jest.useRealTimers();

  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('✅ Test database disconnected');
});

// Note: Global timeout is set in jest.config.js (60000ms)
// Don't override here to avoid conflicts
