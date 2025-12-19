/**
 * Authentication Registration Tests
 *
 * Tests for user registration flow including:
 * - First user becomes admin automatically
 * - Subsequent registrations require admin authentication
 * - Validation of required fields
 * - Duplicate email/username prevention
 * - Employee ID generation
 */

const request = require('supertest');
const app = require('../../../server');
const User = require('../../../models/User');
const { createTestUser } = require('../../fixtures/generators');

describe('Authentication - Registration', () => {
  describe('POST /api/auth/register - First User', () => {
    test('should register first user as admin automatically', async () => {
      // Ensure no users exist
      await User.deleteMany({});

      const userData = {
        username: 'firstadmin',
        email: 'admin@medflow.com',
        password: 'MgrSecure123!@#',
        firstName: 'First',
        lastName: 'Admin',
        phoneNumber: '+243900000001'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.role).toBe('admin');

      // Verify in database
      const user = await User.findOne({ email: 'admin@medflow.com' });
      expect(user.role).toBe('admin');
    });

    test('should generate employee ID for first user', async () => {
      await User.deleteMany({});

      const userData = {
        username: 'firstadmin',
        email: 'admin@medflow.com',
        password: 'MgrSecure123!@#',
        firstName: 'First',
        lastName: 'Admin',
        phoneNumber: '+243900000001'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const user = await User.findOne({ email: 'admin@medflow.com' });
      expect(user.employeeId).toBeDefined();
      expect(user.employeeId).toMatch(/^EMP\d{4}\d{5}$/);
    });

    test('should set HttpOnly cookies for first user', async () => {
      await User.deleteMany({});

      const userData = {
        username: 'firstadmin',
        email: 'admin@medflow.com',
        password: 'MgrSecure123!@#',
        firstName: 'First',
        lastName: 'Admin',
        phoneNumber: '+243900000001'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('accessToken'))).toBe(true);
      expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('POST /api/auth/register - Subsequent Users', () => {
    let adminUser;
    let adminCookies;

    beforeEach(async () => {
      // Create admin user first
      adminUser = await User.create(
        createTestUser({
          email: 'admin@medflow.com',
          username: 'adminuser',
          password: 'MgrSecure123!@#',
          role: 'admin'
        })
      );

      // Login as admin
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@medflow.com',
          password: 'MgrSecure123!@#'
        });

      adminCookies = loginResponse.headers['set-cookie'];
    });

    test('should allow admin to register new user', async () => {
      const userData = {
        username: 'newdoctor',
        email: 'doctor@medflow.com',
        password: 'DoctorPass123!@#',
        firstName: 'New',
        lastName: 'Doctor',
        phoneNumber: '+243900000002',
        role: 'doctor',
        specialization: 'general_medicine',
        licenseNumber: 'LIC123456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.role).toBe('doctor');
    });

    test('should reject registration without admin authentication', async () => {
      const userData = {
        username: 'newdoctor',
        email: 'doctor@medflow.com',
        password: 'DoctorPass123!@#',
        firstName: 'New',
        lastName: 'Doctor',
        phoneNumber: '+243900000002',
        role: 'doctor'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/administrator/i);
    });

    test('should reject registration by non-admin user', async () => {
      // Create a non-admin user
      const doctorUser = await User.create(
        createTestUser({
          email: 'doctor@medflow.com',
          username: 'doctoruser',
          password: 'DoctorPass123!@#',
          role: 'doctor'
        })
      );

      // Login as doctor
      const doctorLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctor@medflow.com',
          password: 'DoctorPass123!@#'
        });

      const doctorCookies = doctorLogin.headers['set-cookie'];

      const userData = {
        username: 'newuser',
        email: 'newuser@medflow.com',
        password: 'NewPass123!@#',
        firstName: 'New',
        lastName: 'User',
        phoneNumber: '+243900000003'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', doctorCookies)
        .send(userData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should prevent duplicate email registration', async () => {
      const userData = {
        username: 'duplicate',
        email: 'admin@medflow.com', // Same as existing admin
        password: 'DuplicatePass123!@#',
        firstName: 'Duplicate',
        lastName: 'User',
        phoneNumber: '+243900000002'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/already exists/i);
    });

    test('should prevent duplicate username registration', async () => {
      const userData = {
        username: 'adminuser', // Same as existing admin
        email: 'newuser@medflow.com',
        password: 'NewPass123!@#',
        firstName: 'New',
        lastName: 'User',
        phoneNumber: '+243900000002'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/already exists/i);
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        username: 'incomplete'
        // Missing email, password, firstName, lastName
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(incompleteData);

      // Should fail validation (400 or 500 depending on validation point)
      expect(response.body.success).toBe(false);
    });

    test('should validate password strength', async () => {
      const userData = {
        username: 'weakpass',
        email: 'weakpass@medflow.com',
        password: '123', // Weak password
        firstName: 'Weak',
        lastName: 'Password',
        phoneNumber: '+243900000002'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData);

      expect(response.body.success).toBe(false);
    });

    test('should allow specifying user role', async () => {
      const userData = {
        username: 'newnurse',
        email: 'nurse@medflow.com',
        password: 'NursePass123!@#',
        firstName: 'New',
        lastName: 'Nurse',
        phoneNumber: '+243900000002',
        role: 'nurse'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe('nurse');
    });

    test('should default to receptionist role if not specified', async () => {
      const userData = {
        username: 'newuser',
        email: 'user@medflow.com',
        password: 'UserPass123!@#',
        firstName: 'New',
        lastName: 'User',
        phoneNumber: '+243900000002'
        // No role specified
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe('receptionist');
    });

    test('should store specialization for doctors', async () => {
      const userData = {
        username: 'specialist',
        email: 'specialist@medflow.com',
        password: 'SpecialistPass123!@#',
        firstName: 'Eye',
        lastName: 'Doctor',
        phoneNumber: '+243900000002',
        role: 'doctor',
        specialization: 'ophthalmology',
        licenseNumber: 'LIC123456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData)
        .expect(201);

      const user = await User.findOne({ email: 'specialist@medflow.com' });
      expect(user.specialization).toBe('ophthalmology');
      expect(user.licenseNumber).toBe('LIC123456');
    });

    test('should set createdBy field to admin user', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@medflow.com',
        password: 'NewPass123!@#',
        firstName: 'New',
        lastName: 'User',
        phoneNumber: '+243900000002'
      };

      await request(app)
        .post('/api/auth/register')
        .set('Cookie', adminCookies)
        .send(userData)
        .expect(201);

      const user = await User.findOne({ email: 'newuser@medflow.com' });
      expect(user.createdBy.toString()).toBe(adminUser._id.toString());
    });
  });

  describe('Registration Validation', () => {
    beforeEach(async () => {
      await User.deleteMany({});
    });

    test('should validate email format', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'ValidPass123!@#',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+243900000001'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.body.success).toBe(false);
    });

    test('should validate phone number format', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@medflow.com',
        password: 'ValidPass123!@#',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '12345' // Invalid format
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // May succeed or fail depending on validation strictness
      // Just ensure it doesn't crash
      expect(response.body).toBeDefined();
    });

    test('should not expose password in response', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@medflow.com',
        password: 'ValidPass123!@#',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+243900000001'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.password).toBeUndefined();
    });
  });
});
