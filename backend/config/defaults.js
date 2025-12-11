/**
 * Default credentials and configuration for development/seeding
 *
 * IMPORTANT: These are default development credentials only.
 * In production, always use environment variables and strong passwords.
 *
 * ⚠️  SECURITY WARNING: Default passwords should be changed in production!
 * Set DEFAULT_ADMIN_PASSWORD and DEFAULT_USER_PASSWORD in your .env file.
 */

const defaults = {
  // Default admin account
  admin: {
    email: 'admin@medflow.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'MedFlow$ecure1',
    firstName: 'Admin',
    lastName: 'System',
    role: 'admin'
  },

  // Default test users (for seedUsers.js)
  testUsers: {
    password: process.env.DEFAULT_USER_PASSWORD || 'MedFlow$ecure1'
  },

  // Password requirements reminder
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true
  }
};

module.exports = defaults;
