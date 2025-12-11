/**
 * Encryption Service Tests
 *
 * Tests for field-level encryption configuration and helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  SENSITIVE_FIELDS,
  getSensitiveFields,
  hasSensitiveFields
} from '../../services/crypto/fieldEncryption';
import {
  ENCRYPTION_CONFIG,
  isEncrypted
} from '../../services/crypto/encryptionService';

describe('Encryption Configuration', () => {
  describe('ENCRYPTION_CONFIG', () => {
    it('uses AES-GCM algorithm', () => {
      expect(ENCRYPTION_CONFIG.ALGORITHM).toBe('AES-GCM');
    });

    it('uses 256-bit key length', () => {
      expect(ENCRYPTION_CONFIG.KEY_LENGTH).toBe(256);
    });

    it('uses 12-byte IV (recommended for GCM)', () => {
      expect(ENCRYPTION_CONFIG.IV_LENGTH).toBe(12);
    });

    it('uses 128-bit auth tag', () => {
      expect(ENCRYPTION_CONFIG.TAG_LENGTH).toBe(128);
    });
  });
});

describe('Sensitive Fields Configuration', () => {
  describe('SENSITIVE_FIELDS', () => {
    it('has sensitive fields defined for patients', () => {
      expect(SENSITIVE_FIELDS.patients).toBeDefined();
      expect(SENSITIVE_FIELDS.patients).toContain('firstName');
      expect(SENSITIVE_FIELDS.patients).toContain('lastName');
      expect(SENSITIVE_FIELDS.patients).toContain('nationalId');
      expect(SENSITIVE_FIELDS.patients).toContain('phoneNumber');
      expect(SENSITIVE_FIELDS.patients).toContain('email');
      expect(SENSITIVE_FIELDS.patients).toContain('allergies');
    });

    it('has sensitive fields defined for prescriptions', () => {
      expect(SENSITIVE_FIELDS.prescriptions).toBeDefined();
      expect(SENSITIVE_FIELDS.prescriptions).toContain('medications');
      expect(SENSITIVE_FIELDS.prescriptions).toContain('diagnosis');
      expect(SENSITIVE_FIELDS.prescriptions).toContain('notes');
    });

    it('has sensitive fields defined for ophthalmologyExams', () => {
      expect(SENSITIVE_FIELDS.ophthalmologyExams).toBeDefined();
      expect(SENSITIVE_FIELDS.ophthalmologyExams).toContain('findings');
      expect(SENSITIVE_FIELDS.ophthalmologyExams).toContain('diagnosis');
      expect(SENSITIVE_FIELDS.ophthalmologyExams).toContain('visualAcuity');
    });

    it('has sensitive fields defined for labOrders', () => {
      expect(SENSITIVE_FIELDS.labOrders).toBeDefined();
      expect(SENSITIVE_FIELDS.labOrders).toContain('notes');
      expect(SENSITIVE_FIELDS.labOrders).toContain('clinicalInfo');
    });

    it('has sensitive fields defined for labResults', () => {
      expect(SENSITIVE_FIELDS.labResults).toBeDefined();
      expect(SENSITIVE_FIELDS.labResults).toContain('results');
      expect(SENSITIVE_FIELDS.labResults).toContain('interpretation');
    });

    it('has sensitive fields defined for invoices', () => {
      expect(SENSITIVE_FIELDS.invoices).toBeDefined();
      expect(SENSITIVE_FIELDS.invoices).toContain('notes');
    });

    it('has sensitive fields defined for visits', () => {
      expect(SENSITIVE_FIELDS.visits).toBeDefined();
      expect(SENSITIVE_FIELDS.visits).toContain('chiefComplaint');
      expect(SENSITIVE_FIELDS.visits).toContain('diagnosis');
      expect(SENSITIVE_FIELDS.visits).toContain('findings');
    });
  });

  describe('getSensitiveFields', () => {
    it('returns sensitive fields for known entities', () => {
      expect(getSensitiveFields('patients')).toEqual(SENSITIVE_FIELDS.patients);
      expect(getSensitiveFields('prescriptions')).toEqual(SENSITIVE_FIELDS.prescriptions);
    });

    it('returns empty array for unknown entities', () => {
      expect(getSensitiveFields('unknown')).toEqual([]);
      expect(getSensitiveFields('randomEntity')).toEqual([]);
    });
  });

  describe('hasSensitiveFields', () => {
    it('returns true for entities with sensitive fields', () => {
      expect(hasSensitiveFields('patients')).toBe(true);
      expect(hasSensitiveFields('prescriptions')).toBe(true);
      expect(hasSensitiveFields('ophthalmologyExams')).toBe(true);
      expect(hasSensitiveFields('labOrders')).toBe(true);
      expect(hasSensitiveFields('invoices')).toBe(true);
    });

    it('returns falsy for unknown entities', () => {
      expect(hasSensitiveFields('unknown')).toBeFalsy();
      expect(hasSensitiveFields('')).toBeFalsy();
    });
  });
});

describe('Encryption Detection', () => {
  describe('isEncrypted', () => {
    it('returns true for valid encrypted format', () => {
      // Simulated encrypted format: 16-char base64 IV + ':' + base64 ciphertext
      const encrypted = 'AQIDBAUGCAAJCAAA:SGVsbG8gV29ybGQhIQ==';
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(isEncrypted('Hello World')).toBe(false);
      expect(isEncrypted('Jean Dupont')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isEncrypted(123)).toBe(false);
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted({ name: 'test' })).toBe(false);
    });

    it('returns false for invalid format', () => {
      expect(isEncrypted('no:colon:allowed')).toBe(false);
      expect(isEncrypted('tooshort:x')).toBe(false);
      expect(isEncrypted('validiv123456:x')).toBe(false);
    });
  });
});

describe('Patient Data Encryption Fields', () => {
  const patientFields = SENSITIVE_FIELDS.patients;

  it('includes PII fields', () => {
    const piiFields = ['firstName', 'lastName', 'nationalId', 'phoneNumber', 'email'];
    piiFields.forEach(field => {
      expect(patientFields).toContain(field);
    });
  });

  it('includes PHI fields', () => {
    const phiFields = ['allergies', 'medicalHistory'];
    phiFields.forEach(field => {
      expect(patientFields).toContain(field);
    });
  });

  it('does not include non-sensitive fields', () => {
    const nonSensitive = ['_id', 'id', 'patientId', 'createdAt', 'updatedAt', 'lastSync'];
    nonSensitive.forEach(field => {
      expect(patientFields).not.toContain(field);
    });
  });
});

describe('Medical Data Encryption Fields', () => {
  describe('Prescriptions', () => {
    it('encrypts medication-related data', () => {
      const fields = SENSITIVE_FIELDS.prescriptions;
      expect(fields).toContain('medications');
      expect(fields).toContain('diagnosis');
      expect(fields).toContain('instructions');
    });
  });

  describe('Ophthalmology Exams', () => {
    it('encrypts clinical findings', () => {
      const fields = SENSITIVE_FIELDS.ophthalmologyExams;
      expect(fields).toContain('findings');
      expect(fields).toContain('visualAcuity');
      expect(fields).toContain('refraction');
      expect(fields).toContain('intraocularPressure');
    });
  });

  describe('Lab Results', () => {
    it('encrypts result data and interpretations', () => {
      const fields = SENSITIVE_FIELDS.labResults;
      expect(fields).toContain('results');
      expect(fields).toContain('interpretation');
      expect(fields).toContain('criticalValues');
    });
  });
});
