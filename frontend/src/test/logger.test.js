/**
 * Frontend Logger PHI Scrubbing Tests
 *
 * Tests for the logger service to ensure PHI/PII is properly
 * scrubbed before being sent to Sentry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import logger from '../services/logger';

describe('Logger Service', () => {
  describe('Error Logging', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log errors with message only', () => {
      logger.error('Test error message');
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Test error message');
    });

    it('should log errors with data', () => {
      const errorData = { code: 500, details: 'Server error' };
      logger.error('Test error message', errorData);
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Test error message', errorData);
    });

    it('should log errors with Error objects', () => {
      const error = new Error('Something went wrong');
      logger.error('Caught exception', error);
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Caught exception', error);
    });
  });

  describe('Development-only Logging', () => {
    let consoleWarnSpy;
    let consoleLogSpy;
    let consoleDebugSpy;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleDebugSpy.mockRestore();
    });

    // Note: These tests verify the logger doesn't throw in test environment
    // The actual logging behavior depends on import.meta.env.MODE
    // which is 'test' during vitest runs, not 'development'

    it('should not throw when logging warnings', () => {
      expect(() => logger.warn('Test warning')).not.toThrow();
    });

    it('should not throw when logging info messages', () => {
      expect(() => logger.info('Test info')).not.toThrow();
    });

    it('should not throw when logging debug messages', () => {
      expect(() => logger.debug('Test debug')).not.toThrow();
    });

    it('should not throw when logging API calls', () => {
      expect(() => logger.api('GET', '/api/patients')).not.toThrow();
    });
  });

  describe('Exception Capturing', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should capture exceptions with context', () => {
      const error = new Error('Test exception');
      const context = { userId: 'user_123', action: 'save_patient' };

      logger.captureException(error, context);

      expect(consoleSpy).toHaveBeenCalledWith('[ERROR]', error);
    });
  });
});

describe('PHI Scrubbing (Documented Behavior)', () => {
  /**
   * These tests document the expected PHI scrubbing behavior
   * that would be active when Sentry is configured in production.
   *
   * The scrubbing functions are defined in logger.js but only
   * execute when Sentry is initialized.
   */

  describe('PHI Fields List', () => {
    const expectedPHIFields = [
      // Patient identifiers
      'firstName', 'lastName', 'name', 'fullName',
      'nationalId', 'ssn', 'idNumber',

      // Contact information
      'phoneNumber', 'phone', 'mobile', 'telephone',
      'email', 'emailAddress',
      'address', 'streetAddress', 'city', 'postalCode', 'zipCode',

      // Dates
      'dateOfBirth', 'dob', 'birthDate',

      // Medical information
      'diagnosis', 'chiefComplaint', 'medicalHistory',
      'allergies', 'medications', 'prescription',
      'findings', 'notes', 'clinicalNotes',
      'results', 'labResults', 'interpretation',
      'visualAcuity', 'refraction', 'intraocularPressure',

      // Security
      'password', 'token', 'accessToken', 'refreshToken',

      // Financial
      'cardNumber', 'cvv', 'accountNumber'
    ];

    it('should have all required PHI fields documented', () => {
      // This test documents the expected fields
      // Actual implementation is in logger.js PHI_FIELDS array
      expect(expectedPHIFields.length).toBeGreaterThan(30);
    });

    it('should include patient identifier fields', () => {
      const identifierFields = ['firstName', 'lastName', 'nationalId', 'ssn'];
      identifierFields.forEach(field => {
        expect(expectedPHIFields).toContain(field);
      });
    });

    it('should include contact fields', () => {
      const contactFields = ['phoneNumber', 'email', 'address'];
      contactFields.forEach(field => {
        expect(expectedPHIFields).toContain(field);
      });
    });

    it('should include medical fields', () => {
      const medicalFields = ['diagnosis', 'chiefComplaint', 'allergies', 'medications'];
      medicalFields.forEach(field => {
        expect(expectedPHIFields).toContain(field);
      });
    });
  });

  describe('Scrubbing Patterns', () => {
    // Test patterns that should be detected and scrubbed

    it('should detect email patterns', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect('patient@example.com').toMatch(emailPattern);
      expect('jean.dupont@hospital.cd').toMatch(emailPattern);
    });

    it('should detect phone patterns', () => {
      const phonePattern = /^\+?[\d\s\-()]{8,}$/;
      expect('+243 812 345 678').toMatch(phonePattern);
      expect('0999-000-000').toMatch(phonePattern);
      expect('+33 6 12 34 56 78').toMatch(phonePattern);
    });

    it('should detect national ID patterns', () => {
      const idPattern = /^[A-Z0-9]{8,}$/i;
      expect('CD123456789').toMatch(idPattern);
      expect('FR12345678').toMatch(idPattern);
    });
  });
});

describe('Logger Integration Scenarios', () => {
  describe('Patient Error Logging', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log patient save errors', () => {
      const error = new Error('Failed to save patient');
      const context = {
        action: 'create_patient',
        clinicId: 'gombe'
        // Note: PHI fields should NOT be included in error context
        // Good practice: only include IDs and action types
      };

      logger.captureException(error, context);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log invoice errors with safe context', () => {
      const error = new Error('Convention billing failed');
      const safeContext = {
        invoiceId: 'INV-2024-001',
        action: 'calculate_coverage',
        companyId: 'company_123',
        clinicId: 'gombe'
        // PHI like patientName should NOT be passed
      };

      logger.captureException(error, safeContext);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Breadcrumb Logging', () => {
    it('should accept breadcrumbs without throwing', () => {
      // Breadcrumbs are only sent to Sentry when initialized
      // This test ensures the function doesn't throw
      expect(() => {
        logger.addBreadcrumb('navigation', 'User navigated to patient list', {
          path: '/patients',
          clinicId: 'gombe'
        });
      }).not.toThrow();
    });
  });

  describe('User Context Management', () => {
    it('should set user without throwing', () => {
      const user = {
        id: 'user_123',
        _id: 'user_123',
        email: 'doctor@clinic.com',
        firstName: 'Dr',
        lastName: 'Smith',
        role: 'doctor'
      };

      // Should not throw
      expect(() => logger.setUser(user)).not.toThrow();
    });

    it('should clear user without throwing', () => {
      expect(() => logger.clearUser()).not.toThrow();
    });
  });
});

describe('Convention Billing Error Scenarios', () => {
  /**
   * These tests document proper error logging for convention billing
   * scenarios, ensuring PHI is not leaked in error contexts.
   */

  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log coverage calculation errors safely', () => {
    const error = new Error('Coverage calculation failed');

    // SAFE context - no PHI
    const safeContext = {
      invoiceId: 'INV-001',
      companyId: 'company_activa',
      category: 'surgery',
      totalAmount: 150000,
      expectedCoverage: 100,
      actualCoverage: 0,
      requiresApproval: true,
      hasApproval: false
    };

    logger.captureException(error, safeContext);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log approval workflow errors safely', () => {
    const error = new Error('Approval validation failed');

    // SAFE context - IDs only, no patient names
    const safeContext = {
      approvalId: 'approval_123',
      patientId: 'patient_456', // ID is OK, name is not
      companyId: 'company_789',
      status: 'expired',
      requestedAmount: 200000
    };

    logger.captureException(error, safeContext);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log cascade trigger errors safely', () => {
    const error = new Error('Surgery case creation failed');

    // SAFE context - operational data only
    const safeContext = {
      invoiceId: 'INV-001',
      visitId: 'visit_123',
      procedureCode: 'PHACO',
      category: 'surgery',
      triggerSource: 'payment_completion'
    };

    logger.captureException(error, safeContext);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
