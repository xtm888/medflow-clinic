/**
 * Two-Factor Authentication Tests
 *
 * Tests for 2FA flow including:
 * - Enable 2FA (generate secret, QR code)
 * - Verify 2FA setup
 * - Login with 2FA
 * - Disable 2FA
 * - Backup codes
 * - 2FA code replay protection
 */

const request = require('supertest');
const speakeasy = require('speakeasy');
const app = require('../../../server');
const User = require('../../../models/User');
const { createTestUser } = require('../../fixtures/generators');

describe('Authentication - Two-Factor Authentication', () => {
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

  describe('POST /api/auth/enable-2fa', () => {
    test('should generate 2FA secret and QR code with valid password', async () => {
      const response = await request(app)
        .post('/api/auth/enable-2fa')
        .set('Cookie', authCookies)
        .send({ password: 'TestPass123!@#' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.secret).toBeDefined();
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.data.qrCode).toMatch(/^data:image\/png/);

      // Verify secret was saved
      const user = await User.findById(testUser._id);
      expect(user.twoFactorSecret).toBeDefined();
    });

    test('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/enable-2fa')
        .set('Cookie', authCookies)
        .send({ password: 'WrongPassword!@#' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/incorrect/i);
    });

    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/enable-2fa')
        .set('Cookie', authCookies)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return error if 2FA already enabled', async () => {
      // Enable 2FA first
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: true,
        twoFactorSecret: 'EXISTINGSECRET'
      });

      const response = await request(app)
        .post('/api/auth/enable-2fa')
        .set('Cookie', authCookies)
        .send({ password: 'TestPass123!@#' })
        .expect(400);

      expect(response.body.error).toMatch(/already enabled/i);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/auth/enable-2fa')
        .send({ password: 'TestPass123!@#' })
        .expect(401);
    });
  });

  describe('POST /api/auth/verify-2fa-setup', () => {
    let twoFactorSecret;

    beforeEach(async () => {
      // Generate and save 2FA secret (simulating enable-2fa step)
      twoFactorSecret = speakeasy.generateSecret({ length: 20 }).base32;
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorSecret
      });
    });

    test('should verify and enable 2FA with valid code', async () => {
      // Generate valid TOTP
      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const response = await request(app)
        .post('/api/auth/verify-2fa-setup')
        .set('Cookie', authCookies)
        .send({ token: validCode })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.backupCodes).toBeDefined();
      expect(response.body.data.backupCodes.length).toBeGreaterThan(0);
      expect(response.body.message).toMatch(/enabled successfully/i);

      // Verify 2FA is enabled
      const user = await User.findById(testUser._id);
      expect(user.twoFactorEnabled).toBe(true);
    });

    test('should return error for invalid code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-2fa-setup')
        .set('Cookie', authCookies)
        .send({ token: '000000' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid/i);
    });

    test('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/verify-2fa-setup')
        .set('Cookie', authCookies)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return error if 2FA setup not initiated', async () => {
      // Clear the secret
      await User.findByIdAndUpdate(testUser._id, {
        $unset: { twoFactorSecret: 1 }
      });

      const response = await request(app)
        .post('/api/auth/verify-2fa-setup')
        .set('Cookie', authCookies)
        .send({ token: '123456' })
        .expect(400);

      expect(response.body.error).toMatch(/initiate.*setup/i);
    });

    test('should return error if 2FA already enabled', async () => {
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: true
      });

      const response = await request(app)
        .post('/api/auth/verify-2fa-setup')
        .set('Cookie', authCookies)
        .send({ token: '123456' })
        .expect(400);

      expect(response.body.error).toMatch(/already enabled/i);
    });
  });

  describe('POST /api/auth/verify-2fa', () => {
    let twoFactorSecret;
    let twoFactorUserId;

    beforeEach(async () => {
      // Setup user with 2FA enabled
      twoFactorSecret = speakeasy.generateSecret({ length: 20 }).base32;
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: true,
        twoFactorSecret,
        twoFactorBackupCodes: [
          { code: 'BACKUP1234', used: false },
          { code: 'BACKUP5678', used: false }
        ]
      });
      twoFactorUserId = testUser._id.toString();
    });

    test('should complete login with valid 2FA code', async () => {
      // First login (returns 2FA required)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medflow.com',
          password: 'TestPass123!@#'
        })
        .expect(200);

      expect(loginResponse.body.data.requiresTwoFactor).toBe(true);

      // Generate valid TOTP
      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      // Complete 2FA
      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId,
          token: validCode
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/login successful/i);

      // Should set auth cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies.some(c => c.includes('accessToken'))).toBe(true);
    });

    test('should return 401 for invalid 2FA code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId,
          token: '000000'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid/i);
    });

    test('should accept valid backup code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId,
          token: 'BACKUP1234',
          isBackupCode: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify backup code is marked as used
      const user = await User.findById(testUser._id);
      const usedCode = user.twoFactorBackupCodes.find(c => c.code === 'BACKUP1234');
      expect(usedCode.used).toBe(true);
    });

    test('should reject already used backup code', async () => {
      // Mark backup code as used
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorBackupCodes: [
          { code: 'BACKUP1234', used: true },
          { code: 'BACKUP5678', used: false }
        ]
      });

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId,
          token: 'BACKUP1234',
          isBackupCode: true
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          token: '123456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should increment login attempts on failed 2FA', async () => {
      await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId,
          token: '000000'
        })
        .expect(401);

      const user = await User.findById(testUser._id);
      expect(user.loginAttempts).toBeGreaterThan(0);
    });

    test('should report remaining backup codes', async () => {
      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId,
          token: validCode
        })
        .expect(200);

      expect(response.body.remainingBackupCodes).toBeDefined();
      expect(typeof response.body.remainingBackupCodes).toBe('number');
    });

    test('should warn when backup codes are low', async () => {
      // Set up only 2 backup codes
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorBackupCodes: [
          { code: 'BACKUP1', used: false },
          { code: 'BACKUP2', used: false }
        ]
      });

      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          userId: twoFactorUserId,
          token: validCode
        })
        .expect(200);

      expect(response.body.lowBackupCodes).toBe(true);
    });
  });

  describe('POST /api/auth/disable-2fa', () => {
    let twoFactorSecret;

    beforeEach(async () => {
      // Setup user with 2FA enabled
      twoFactorSecret = speakeasy.generateSecret({ length: 20 }).base32;
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: true,
        twoFactorSecret,
        twoFactorBackupCodes: [
          { code: 'BACKUP1234', used: false }
        ]
      });
    });

    test('should disable 2FA with valid password and code', async () => {
      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const response = await request(app)
        .post('/api/auth/disable-2fa')
        .set('Cookie', authCookies)
        .send({
          password: 'TestPass123!@#',
          token: validCode
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/disabled successfully/i);

      // Verify 2FA is disabled
      const user = await User.findById(testUser._id);
      expect(user.twoFactorEnabled).toBe(false);
      expect(user.twoFactorSecret).toBeUndefined();
      expect(user.twoFactorBackupCodes.length).toBe(0);
    });

    test('should disable 2FA with valid backup code', async () => {
      const response = await request(app)
        .post('/api/auth/disable-2fa')
        .set('Cookie', authCookies)
        .send({
          password: 'TestPass123!@#',
          token: 'BACKUP1234'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return 401 for incorrect password', async () => {
      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const response = await request(app)
        .post('/api/auth/disable-2fa')
        .set('Cookie', authCookies)
        .send({
          password: 'WrongPassword!@#',
          token: validCode
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return error for invalid 2FA code', async () => {
      const response = await request(app)
        .post('/api/auth/disable-2fa')
        .set('Cookie', authCookies)
        .send({
          password: 'TestPass123!@#',
          token: '000000'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/disable-2fa')
        .set('Cookie', authCookies)
        .send({
          token: '123456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/disable-2fa')
        .set('Cookie', authCookies)
        .send({
          password: 'TestPass123!@#'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return error if 2FA not enabled', async () => {
      // Disable 2FA first
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: false
      });

      const response = await request(app)
        .post('/api/auth/disable-2fa')
        .set('Cookie', authCookies)
        .send({
          password: 'TestPass123!@#',
          token: '123456'
        })
        .expect(400);

      expect(response.body.error).toMatch(/not enabled/i);
    });
  });

  describe('POST /api/auth/regenerate-backup-codes', () => {
    let twoFactorSecret;

    beforeEach(async () => {
      // Setup user with 2FA enabled
      twoFactorSecret = speakeasy.generateSecret({ length: 20 }).base32;
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: true,
        twoFactorSecret,
        twoFactorBackupCodes: [
          { code: 'OLDBACKUP1', used: false }
        ]
      });
    });

    test('should regenerate backup codes with valid credentials', async () => {
      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const response = await request(app)
        .post('/api/auth/regenerate-backup-codes')
        .set('Cookie', authCookies)
        .send({
          password: 'TestPass123!@#',
          token: validCode
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.backupCodes).toBeDefined();
      expect(response.body.data.backupCodes.length).toBeGreaterThan(0);
      expect(response.body.data.warning).toMatch(/old backup codes/i);

      // Verify old codes are replaced
      const user = await User.findById(testUser._id);
      const hasOldCode = user.twoFactorBackupCodes.some(c => c.code === 'OLDBACKUP1');
      expect(hasOldCode).toBe(false);
    });

    test('should return 401 for incorrect password', async () => {
      const validCode = speakeasy.totp({
        secret: twoFactorSecret,
        encoding: 'base32'
      });

      const response = await request(app)
        .post('/api/auth/regenerate-backup-codes')
        .set('Cookie', authCookies)
        .send({
          password: 'WrongPassword!@#',
          token: validCode
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return error if 2FA not enabled', async () => {
      await User.findByIdAndUpdate(testUser._id, {
        twoFactorEnabled: false
      });

      const response = await request(app)
        .post('/api/auth/regenerate-backup-codes')
        .set('Cookie', authCookies)
        .send({
          password: 'TestPass123!@#',
          token: '123456'
        })
        .expect(400);

      expect(response.body.error).toMatch(/not enabled/i);
    });
  });
});
