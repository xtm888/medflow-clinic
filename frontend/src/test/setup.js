/**
 * Vitest Test Setup
 *
 * Global test configuration, mocks, and utilities.
 * This file runs before each test file.
 */

import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { server } from './mocks/server';

// Extend Vitest expect with jest-dom matchers
expect.extend(matchers);

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Stop server after all tests
afterAll(() => {
  server.close();
});

// Mock browser APIs not available in jsdom

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  })
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  store: {},
  getItem: vi.fn((key) => sessionStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => {
    sessionStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete sessionStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    sessionStorageMock.store = {};
  })
};
global.sessionStorage = sessionStorageMock;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
  configurable: true
});

// Mock crypto.subtle for encryption tests
const mockCrypto = {
  getRandomValues: vi.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    importKey: vi.fn().mockResolvedValue({ type: 'secret' }),
    deriveKey: vi.fn().mockResolvedValue({ type: 'secret' }),
    encrypt: vi.fn().mockImplementation(async (algorithm, key, data) => {
      // Simple mock - just return the data with a prefix
      return new TextEncoder().encode('ENCRYPTED:' + new TextDecoder().decode(data));
    }),
    decrypt: vi.fn().mockImplementation(async (algorithm, key, data) => {
      const text = new TextDecoder().decode(data);
      if (text.startsWith('ENCRYPTED:')) {
        return new TextEncoder().encode(text.slice(10));
      }
      return data;
    })
  }
};

if (typeof global.crypto === 'undefined') {
  global.crypto = mockCrypto;
}

// Mock IndexedDB (basic mock for tests that don't need full Dexie)
global.indexedDB = {
  open: vi.fn()
};

// Mock service worker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      sync: {
        register: vi.fn().mockResolvedValue(undefined)
      }
    }),
    addEventListener: vi.fn()
  },
  writable: true,
  configurable: true
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver;

// Mock ResizeObserver
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

// Mock fetch
global.fetch = vi.fn();

// Mock console.warn and console.error to reduce noise in tests
// Uncomment these lines to suppress console output during tests
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Clear mocks before each test
beforeEach(() => {
  localStorageMock.store = {};
  sessionStorageMock.store = {};
  vi.clearAllMocks();
});

// Utility to set online/offline status
export function setOnlineStatus(isOnline) {
  Object.defineProperty(navigator, 'onLine', {
    value: isOnline,
    writable: true,
    configurable: true
  });
  // Dispatch event
  window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
}

// Utility to wait for promises to resolve
export function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Utility to create a mock API response
export function mockApiResponse(data, status = 200) {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {}
  };
}

// Export vi for use in tests
export { vi };
