// Set test environment BEFORE loading any modules
process.env.NODE_ENV = 'test';
process.env.DISABLE_SCHEDULERS = 'true';
process.env.DISABLE_CACHE_WARMING = 'true';

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

// Global test timeout
jest.setTimeout(30000);
