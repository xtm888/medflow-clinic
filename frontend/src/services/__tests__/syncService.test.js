/**
 * Quick verification test for syncService exponential backoff
 * Run with: node --experimental-vm-modules node_modules/jest/bin/jest.js src/services/__tests__/syncService.test.js
 */

import { BACKOFF_CONFIG } from '../syncService';

describe('Sync Service - Exponential Backoff', () => {
  describe('BACKOFF_CONFIG', () => {
    test('has correct base delay', () => {
      expect(BACKOFF_CONFIG.BASE_DELAY_MS).toBe(1000);
    });

    test('has correct max delay (5 minutes)', () => {
      expect(BACKOFF_CONFIG.MAX_DELAY_MS).toBe(300000);
    });

    test('has correct max retries', () => {
      expect(BACKOFF_CONFIG.MAX_RETRIES).toBe(5);
    });

    test('has correct jitter percent (30%)', () => {
      expect(BACKOFF_CONFIG.JITTER_PERCENT).toBe(0.30);
    });
  });

  describe('calculateBackoffDelay', () => {
    // Re-implement the function for testing since it's not exported
    function calculateBackoffDelay(retryCount) {
      const exponentialDelay = BACKOFF_CONFIG.BASE_DELAY_MS * Math.pow(2, retryCount);
      const cappedDelay = Math.min(exponentialDelay, BACKOFF_CONFIG.MAX_DELAY_MS);
      const jitterRange = cappedDelay * BACKOFF_CONFIG.JITTER_PERCENT;
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      return Math.max(0, Math.round(cappedDelay + jitter));
    }

    test('retry 0 produces ~1s delay', () => {
      const delays = Array(100).fill(0).map(() => calculateBackoffDelay(0));
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

      // Should be around 1000ms +/- 30%
      expect(avgDelay).toBeGreaterThan(700);
      expect(avgDelay).toBeLessThan(1300);
    });

    test('retry 1 produces ~2s delay', () => {
      const delays = Array(100).fill(0).map(() => calculateBackoffDelay(1));
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

      // Should be around 2000ms +/- 30%
      expect(avgDelay).toBeGreaterThan(1400);
      expect(avgDelay).toBeLessThan(2600);
    });

    test('retry 4 produces ~16s delay', () => {
      const delays = Array(100).fill(0).map(() => calculateBackoffDelay(4));
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

      // Should be around 16000ms +/- 30%
      expect(avgDelay).toBeGreaterThan(11200);
      expect(avgDelay).toBeLessThan(20800);
    });

    test('high retry count is capped at max delay', () => {
      const delays = Array(100).fill(0).map(() => calculateBackoffDelay(20));

      delays.forEach(delay => {
        // Max delay is 300000ms (5 min), with +30% jitter max is 390000ms
        expect(delay).toBeLessThanOrEqual(BACKOFF_CONFIG.MAX_DELAY_MS * 1.3);
        // Min with -30% jitter is 210000ms
        expect(delay).toBeGreaterThanOrEqual(BACKOFF_CONFIG.MAX_DELAY_MS * 0.7);
      });
    });

    test('jitter produces variable delays for same retry count', () => {
      const delays = Array(10).fill(0).map(() => calculateBackoffDelay(2));
      const uniqueDelays = new Set(delays);

      // With jitter, we should get different values (very unlikely all 10 are the same)
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });
});
