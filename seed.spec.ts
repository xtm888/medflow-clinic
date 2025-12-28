import { test, expect } from '@playwright/test';

/**
 * MedFlow Seed Test - Sets up authenticated session for all test plans
 *
 * This seed file:
 * 1. Navigates to MedFlow
 * 2. Logs in as admin user
 * 3. Waits for home page to load
 *
 * All generated tests will use this as the starting point.
 */
test.describe('MedFlow Test Environment', () => {
  test('seed - Login as admin', async ({ page }) => {
    // Navigate to MedFlow login
    await page.goto('http://localhost:5173/login');

    // Wait for login page to load
    await page.waitForSelector('#email', { timeout: 10000 });

    // Enter admin credentials (from test_utils.py)
    await page.fill('#email', 'admin@medflow.com');
    await page.fill('#password', 'MedFlow$ecure1');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for redirect to home page
    await page.waitForURL('**/home', { timeout: 15000 });

    // Verify we're logged in by checking for navigation/sidebar
    await expect(page.locator('nav, [class*="sidebar"], [class*="navigation"]').first()).toBeVisible();
  });
});
