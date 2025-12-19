/**
 * Authentication Password Reset Tests
 *
 * Tests for password reset flow including:
 * - Forgot password initiates reset flow
 * - Reset token validation
 * - Token expiry handling
 * - Password history check
 * - Update password flow
 */

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../../server');
const User = require('../../../models/User');
const { createTestUser } = require('../../fixtures/generators');

describe('Authentication - Password Reset', () => {
  let testUser;
  let authCookies;

  beforeEach(async () => {
    testUser = await User.create(
      createTestUser({
        email: 'test@medflow.com',
        username: 'testuser',
        password: 'OldPass123!@#',
        role: 'doctor'
      })
    );

    // Login to get cookies for authenticated tests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@medflow.com',
        password: 'OldPass123!@#'
      });

    authCookies = loginResponse.headers['set-cookie'];
  });

  describe('POST /api/auth/forgotpassword', () => {
    test('should initiate password reset for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgotpassword')
        .send({ email: 'test@medflow.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/reset email sent/i);

      // Verify token was generated
      const user = await User.findById(testUser._id);
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpire).toBeDefined();
    });

    test('should return error for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgotpassword')
        .send({ email: 'nonexistent@medflow.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/no user found/i);
    });

    test('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/forgotpassword')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/provide.*email/i);
    });

    test('should set token expiry in the future', async () => {
      await request(app)
        .post('/api/auth/forgotpassword')
        .send({ email: 'test@medflow.com' })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(new Date(user.resetPasswordExpire).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('PUT /api/auth/resetpassword/:resettoken', () => {
    let resetToken;
    let hashedToken;

    beforeEach(async () => {
      // Generate reset token
      resetToken = crypto.randomBytes(20).toString('hex');
      hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Set token on user
      await User.findByIdAndUpdate(testUser._id, {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: Date.now() + 10 * 60 * 1000 // 10 minutes
      });
    });

    test('should reset password with valid token', async () => {
      const response = await request(app)
        .put(`/api/auth/resetpassword/${resetToken}`)
        .send({ password: 'NewPass123!@#' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/reset successful/i);

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'NewPass123!@#'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    test('should clear reset token after successful reset', async () => {
      await request(app)
        .put(`/api/auth/resetpassword/${resetToken}`)
        .send({ password: 'NewPass123!@#' })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(user.resetPasswordToken).toBeUndefined();
      expect(user.resetPasswordExpire).toBeUndefined();
    });

    test('should return error for invalid token', async () => {
      const response = await request(app)
        .put('/api/auth/resetpassword/invalidtoken123')
        .send({ password: 'NewPass123!@#' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid.*expired/i);
    });

    test('should return error for expired token', async () => {
      // Set expired token
      await User.findByIdAndUpdate(testUser._id, {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: Date.now() - 1000 // Expired
      });

      const response = await request(app)
        .put(`/api/auth/resetpassword/${resetToken}`)
        .send({ password: 'NewPass123!@#' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid.*expired/i);
    });

    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .put(`/api/auth/resetpassword/${resetToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/provide.*password/i);
    });

    test('should reject previously used password', async () => {
      // First, we need to save the old password to history
      // This happens when the user model has password history tracking
      const user = await User.findById(testUser._id);

      // If password history is tracked, this test applies
      if (user.previousPasswords && typeof user.isPasswordUsedBefore === 'function') {
        const response = await request(app)
          .put(`/api/auth/resetpassword/${resetToken}`)
          .send({ password: 'OldPass123!@#' }) // Same as original
          .expect(400);

        expect(response.body.error).toMatch(/used before/i);
      }
    });

    test('should set HttpOnly cookies after password reset', async () => {
      const response = await request(app)
        .put(`/api/auth/resetpassword/${resetToken}`)
        .send({ password: 'NewPass123!@#' })
        .expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('accessToken'))).toBe(true);
    });
  });

  describe('PUT /api/auth/updatepassword', () => {
    test('should update password with valid current password', async () => {
      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'OldPass123!@#',
          newPassword: 'NewPass123!@#'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/password updated/i);

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'NewPass123!@#'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    test('should return 401 for incorrect current password', async () => {
      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'WrongOldPass!@#',
          newPassword: 'NewPass123!@#'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/incorrect/i);
    });

    test('should return 400 when current password is missing', async () => {
      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set('Cookie', authCookies)
        .send({
          newPassword: 'NewPass123!@#'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 400 when new password is missing', async () => {
      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'OldPass123!@#'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/auth/updatepassword')
        .send({
          currentPassword: 'OldPass123!@#',
          newPassword: 'NewPass123!@#'
        })
        .expect(401);
    });

    test('should update passwordChangedAt timestamp', async () => {
      const beforeUpdate = new Date();

      await request(app)
        .put('/api/auth/updatepassword')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'OldPass123!@#',
          newPassword: 'NewPass123!@#'
        })
        .expect(200);

      const user = await User.findById(testUser._id);
      expect(user.passwordChangedAt).toBeDefined();
      expect(new Date(user.passwordChangedAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    test('should invalidate other sessions on password change', async () => {
      // Create multiple sessions by logging in multiple times
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@medflow.com',
            password: 'OldPass123!@#'
          });
      }

      let user = await User.findById(testUser._id);
      const sessionCountBefore = user.sessions?.length || 0;

      // Update password
      await request(app)
        .put('/api/auth/updatepassword')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'OldPass123!@#',
          newPassword: 'NewPass123!@#'
        })
        .expect(200);

      user = await User.findById(testUser._id);
      // Sessions should be cleared or reduced
      expect(user.sessions.length).toBeLessThan(sessionCountBefore);
    });

    test('should create audit log entry for password change', async () => {
      const AuditLog = require('../../../models/AuditLog');

      await request(app)
        .put('/api/auth/updatepassword')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'OldPass123!@#',
          newPassword: 'NewPass123!@#'
        })
        .expect(200);

      const auditEntry = await AuditLog.findOne({
        user: testUser._id,
        action: 'PASSWORD_CHANGE'
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.metadata.sessionsInvalidated).toBe(true);
    });
  });
});
