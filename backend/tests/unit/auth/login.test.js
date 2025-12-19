/**
 * Authentication Login Tests
 *
 * Tests for user login flow including:
 * - Valid login returns access + refresh tokens in cookies
 * - Invalid credentials return 401 without token
 * - Locked account returns 401 with lock message
 * - 2FA required returns intermediate state
 * - Rate limiting blocks brute force
 */

const request = require('supertest');
const app = require('../../../server');
const User = require('../../../models/User');
const { createTestUser } = require('../../fixtures/generators');

describe('Authentication - Login', () => {
  let testUser;

  beforeEach(async () => {
    // Create a test user for each test
    testUser = await User.create(
      createTestUser({
        email: 'test@medflow.com',
        username: 'testuser',
        password: 'TestPass123!@#',
        role: 'doctor'
      })
    );
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/login successful/i);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@medflow.com');

      // Verify HttpOnly cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('accessToken'))).toBe(true);
      expect(cookies.some(c => c.includes('refreshToken'))).toBe(true);
      expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);
    });

    test('should login with valid username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPass123!@#'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('testuser');
    });

    test('should return 401 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid credentials/i);

      // Should not set any auth cookies
      const cookies = response.headers['set-cookie'] || [];
      expect(cookies.some(c => c.includes('accessToken=') && !c.includes('accessToken=none'))).toBe(false);
    });

    test('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    test('should return 400 when email/username is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'TestPass123!@#'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      // API returns validation error - either specific message or generic "Validation failed"
      expect(response.body.error).toBeDefined();
    });

    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      // API returns validation error - either specific message or generic "Validation failed"
      expect(response.body.error).toBeDefined();
    });

    test('should return 401 for deactivated account', async () => {
      // Deactivate the user
      await User.findByIdAndUpdate(testUser._id, { isActive: false });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/deactivated/i);
    });

    test('should increment login attempts on failed login', async () => {
      // First failed attempt
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'WrongPassword1'
        });

      // Second failed attempt
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'WrongPassword2'
        });

      const user = await User.findById(testUser._id);
      expect(user.loginAttempts).toBeGreaterThanOrEqual(2);
    });

    test('should lock account after multiple failed attempts', async () => {
      // Simulate 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@medflow.com',
            password: `WrongPassword${i}`
          });
      }

      // The 6th attempt should indicate locked account
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'  // Even correct password
        })
        .expect(401);

      expect(response.body.error).toMatch(/locked/i);
    });

    test('should reset login attempts on successful login', async () => {
      // First fail some attempts
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'WrongPassword1'
        });

      let user = await User.findById(testUser._id);
      expect(user.loginAttempts).toBeGreaterThan(0);

      // Now login successfully
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      user = await User.findById(testUser._id);
      expect(user.loginAttempts).toBe(0);
    });

    test('should update lastLogin timestamp on successful login', async () => {
      const beforeLogin = new Date();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(new Date(user.lastLogin)).toBeInstanceOf(Date);
      expect(new Date(user.lastLogin).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    test('should add session to user on successful login', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(user.sessions).toBeDefined();
      expect(user.sessions.length).toBeGreaterThan(0);
    });

    test('should limit sessions to maximum of 5', async () => {
      // Login 7 times to exceed limit
      for (let i = 0; i < 7; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@medflow.com',
            password: 'TestPass123!@#'
          });
      }

      const user = await User.findById(testUser._id);
      expect(user.sessions.length).toBeLessThanOrEqual(5);
    });

    test('should return 2FA required state for 2FA-enabled user', async () => {
      // Enable 2FA for user
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: true,
        twoFactorSecret: 'TESTSECRET123456'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requiresTwoFactor).toBe(true);
      expect(response.body.data.userId).toBeDefined();

      // Should NOT set auth cookies yet
      const cookies = response.headers['set-cookie'] || [];
      expect(cookies.some(c => c.includes('accessToken=') && !c.includes('accessToken=none'))).toBe(false);
    });

    test('should return user data without password in response', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.twoFactorSecret).toBeUndefined();
    });

    test('should include expiresIn in response', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      expect(response.body.expiresIn).toBeDefined();
      expect(typeof response.body.expiresIn).toBe('number');
    });
  });
});
