const { validateProductionEnv, isSecureSecret } = require('../../utils/envValidator');

describe('Environment Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isSecureSecret', () => {
    it('should reject secrets containing "change-in-production"', () => {
      expect(isSecureSecret('my-secret-change-in-production-123')).toBe(false);
    });

    it('should reject secrets containing "default"', () => {
      expect(isSecureSecret('default-key-32chars-aaaaaaaaaaaa')).toBe(false);
    });

    it('should reject secrets shorter than 32 characters', () => {
      expect(isSecureSecret('short-secret')).toBe(false);
    });

    it('should accept secure secrets 32+ chars without weak patterns', () => {
      expect(isSecureSecret('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6')).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isSecureSecret(null)).toBe(false);
      expect(isSecureSecret(undefined)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isSecureSecret(12345678901234567890123456789012)).toBe(false);
    });
  });

  describe('validateProductionEnv', () => {
    it('should throw if JWT_SECRET is weak in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'weak-change-in-production';
      process.env.MONGODB_URI = 'mongodb://localhost/test';

      expect(() => validateProductionEnv()).toThrow('JWT_SECRET');
    });

    it('should throw if JWT_SECRET is too short in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'tooshort';
      process.env.MONGODB_URI = 'mongodb://localhost/test';

      expect(() => validateProductionEnv()).toThrow('JWT_SECRET');
    });

    it('should throw if CALENDAR_ENCRYPTION_KEY uses default', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.CALENDAR_ENCRYPTION_KEY = 'default-key-change-in-production-32c';

      expect(() => validateProductionEnv()).toThrow('CALENDAR_ENCRYPTION_KEY');
    });

    it('should pass with all secure secrets in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.BACKUP_ENCRYPTION_KEY = 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7';

      expect(() => validateProductionEnv()).not.toThrow();
    });

    it('should allow weak secrets in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'weak';
      process.env.MONGODB_URI = 'mongodb://localhost/test';

      expect(() => validateProductionEnv()).not.toThrow();
    });

    it('should throw if MONGODB_URI is missing', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'test';
      delete process.env.MONGODB_URI;

      expect(() => validateProductionEnv()).toThrow('MONGODB_URI');
    });
  });
});
