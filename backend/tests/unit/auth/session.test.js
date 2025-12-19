/**
 * Session Management Tests
 *
 * Tests for session management including:
 * - Session creation on login
 * - Session limits (max 5)
 * - Logout clears session
 * - Session info tracking (device, IP)
 * - Multiple concurrent sessions
 */

const request = require('supertest');
const app = require('../../../server');
const User = require('../../../models/User');
const { createTestUser } = require('../../fixtures/generators');

describe('Authentication - Session Management', () => {
  let testUser;
  let authCookies;

  beforeEach(async () => {
    testUser = await User.create(
      createTestUser({
        email: 'test@medflow.com',
        username: 'testuser',
        password: 'TestPass123!@#',
        role: 'doctor'
      })
    );

    // Login to get cookies
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@medflow.com',
        password: 'TestPass123!@#'
      });

    authCookies = loginResponse.headers['set-cookie'];
  });

  describe('Session Creation', () => {
    test('should create session on login', async () => {
      const user = await User.findById(testUser._id);

      expect(user.sessions).toBeDefined();
      expect(user.sessions.length).toBeGreaterThan(0);
    });

    test('should store session metadata', async () => {
      const user = await User.findById(testUser._id);
      const session = user.sessions[0];

      expect(session.token).toBeDefined();
      expect(session.createdAt).toBeDefined();
      expect(session.lastActivity).toBeDefined();
    });

    test('should store user agent in session', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Test Browser/1.0')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      const user = await User.findById(testUser._id);
      const latestSession = user.sessions[user.sessions.length - 1];

      expect(latestSession.userAgent).toBeDefined();
    });

    test('should update lastLogin on successful login', async () => {
      const beforeLogin = new Date();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(new Date(user.lastLogin).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });
  });

  describe('Session Limits', () => {
    test('should limit sessions to 5 maximum', async () => {
      // Login 7 times (more than limit)
      for (let i = 0; i < 7; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@medflow.com',
            password: 'TestPass123!@#'
          })
          .expect(200);
      }

      const user = await User.findById(testUser._id);
      expect(user.sessions.length).toBeLessThanOrEqual(5);
    });

    test('should keep most recent sessions when limit exceeded', async () => {
      // Clear existing sessions
      await User.findByIdAndUpdate(testUser._id, { sessions: [] });

      // Login 7 times with delays to differentiate timestamps
      for (let i = 0; i < 7; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@medflow.com',
            password: 'TestPass123!@#'
          });
      }

      const user = await User.findById(testUser._id);

      // Should have kept most recent 5
      expect(user.sessions.length).toBe(5);

      // Sessions should be sorted by time (oldest first based on slice behavior)
      if (user.sessions.length > 1) {
        const firstSession = new Date(user.sessions[0].createdAt);
        const lastSession = new Date(user.sessions[user.sessions.length - 1].createdAt);
        expect(lastSession.getTime()).toBeGreaterThanOrEqual(firstSession.getTime());
      }
    });
  });

  describe('Logout', () => {
    test('should clear session on logout', async () => {
      // Get session count before logout
      let user = await User.findById(testUser._id);
      const sessionsBeforeLogout = user.sessions.length;

      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookies)
        .expect(200);

      user = await User.findById(testUser._id);
      expect(user.sessions.length).toBeLessThan(sessionsBeforeLogout);
    });

    test('should clear auth cookies on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookies)
        .expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Cookies should be set to 'none' or have immediate expiry
      const accessCookie = cookies.find(c => c.includes('accessToken'));
      const refreshCookie = cookies.find(c => c.includes('refreshToken'));

      expect(accessCookie).toMatch(/accessToken=none/);
      expect(refreshCookie).toMatch(/refreshToken=none/);
    });

    test('should return success message on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/logged out/i);
    });

    test('should not access protected routes after logout', async () => {
      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookies)
        .expect(200);

      const clearedCookies = logoutResponse.headers['set-cookie'];

      // Try to access protected route with cleared cookies
      await request(app)
        .get('/api/auth/me')
        .set('Cookie', clearedCookies)
        .expect(401);
    });
  });

  describe('Multiple Concurrent Sessions', () => {
    test('should allow multiple concurrent sessions from different devices', async () => {
      // Login from "device 1"
      await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Device1/1.0')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      // Login from "device 2"
      await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Device2/1.0')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(user.sessions.length).toBeGreaterThanOrEqual(2);
    });

    test('should only logout current session, not all sessions', async () => {
      // Login twice to create two sessions
      const login1 = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Device1/1.0')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      const cookies1 = login1.headers['set-cookie'];

      const login2 = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Device2/1.0')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      const cookies2 = login2.headers['set-cookie'];

      // Logout from device 1
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies1)
        .expect(200);

      // Device 2 should still be able to access protected routes
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies2)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user info with valid session', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.email).toBe('test@medflow.com');
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.role).toBe('doctor');
    });

    test('should not expose sensitive data in /me response', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.twoFactorSecret).toBeUndefined();
      expect(response.body.data.resetPasswordToken).toBeUndefined();
    });

    test('should return 401 without authentication', async () => {
      await request(app).get('/api/auth/me').expect(401);
    });

    test('should return 401 with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['accessToken=invalidtoken; HttpOnly'])
        .expect(401);
    });
  });

  describe('PUT /api/auth/updatedetails', () => {
    test('should update user details with valid session', async () => {
      const response = await request(app)
        .put('/api/auth/updatedetails')
        .set('Cookie', authCookies)
        .send({
          firstName: 'UpdatedFirst',
          lastName: 'UpdatedLast',
          phoneNumber: '+243900999999'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('UpdatedFirst');
      expect(response.body.data.lastName).toBe('UpdatedLast');
    });

    test('should not update protected fields', async () => {
      const originalEmail = testUser.email;

      await request(app)
        .put('/api/auth/updatedetails')
        .set('Cookie', authCookies)
        .send({
          email: 'hacker@evil.com', // Should not be allowed
          role: 'admin' // Should not be allowed
        })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(user.email).toBe(originalEmail);
      expect(user.role).toBe('doctor'); // Original role
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/auth/updatedetails')
        .send({ firstName: 'Test' })
        .expect(401);
    });
  });
});
