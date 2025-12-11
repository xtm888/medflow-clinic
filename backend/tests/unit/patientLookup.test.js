/**
 * Unit Tests for Patient Lookup Utility
 *
 * Tests the centralized patient lookup functions that replace
 * 25+ duplicate patterns across controllers.
 */

const mongoose = require('mongoose');
const Patient = require('../../models/Patient');
const {
  findPatientByIdOrCode,
  findPatientOrFail,
  isValidObjectId,
  OBJECTID_REGEX
} = require('../../utils/patientLookup');
const { createTestPatient } = require('../fixtures/generators');

describe('Patient Lookup Utility', () => {
  describe('isValidObjectId', () => {
    test('should return true for valid 24-char hex string', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
      expect(isValidObjectId('000000000000000000000000')).toBe(true);
      expect(isValidObjectId('ffffffffffffffffffffffff')).toBe(true);
    });

    test('should return true for mongoose ObjectId', () => {
      const id = new mongoose.Types.ObjectId();
      expect(isValidObjectId(id.toString())).toBe(true);
    });

    test('should return false for invalid strings', () => {
      expect(isValidObjectId('P000001')).toBe(false);
      expect(isValidObjectId('abc')).toBe(false);
      expect(isValidObjectId('507f1f77bcf86cd79943901')).toBe(false); // 23 chars
      expect(isValidObjectId('507f1f77bcf86cd7994390111')).toBe(false); // 25 chars
      expect(isValidObjectId('507f1f77bcf86cd79943901g')).toBe(false); // invalid char
    });

    test('should return false for null/undefined', () => {
      expect(isValidObjectId(null)).toBe(false);
      expect(isValidObjectId(undefined)).toBe(false);
      expect(isValidObjectId('')).toBe(false);
    });

    test('should handle numbers gracefully', () => {
      expect(isValidObjectId(12345)).toBe(false);
      expect(isValidObjectId(0)).toBe(false);
    });
  });

  describe('OBJECTID_REGEX', () => {
    test('should match valid ObjectId patterns', () => {
      expect(OBJECTID_REGEX.test('507f1f77bcf86cd799439011')).toBe(true);
      expect(OBJECTID_REGEX.test('ABCDEF123456789012345678')).toBe(true);
    });

    test('should not match invalid patterns', () => {
      expect(OBJECTID_REGEX.test('P000001')).toBe(false);
      expect(OBJECTID_REGEX.test('short')).toBe(false);
    });
  });

  describe('findPatientByIdOrCode', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await Patient.create(createTestPatient({
        patientId: 'P000001'
      }));
    });

    test('should find patient by MongoDB ObjectId', async () => {
      const found = await findPatientByIdOrCode(testPatient._id.toString());
      expect(found).toBeTruthy();
      expect(found._id.toString()).toBe(testPatient._id.toString());
    });

    test('should find patient by patientId code', async () => {
      const found = await findPatientByIdOrCode('P000001');
      expect(found).toBeTruthy();
      expect(found.patientId).toBe('P000001');
    });

    test('should return null for non-existent ObjectId', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const found = await findPatientByIdOrCode(fakeId.toString());
      expect(found).toBeNull();
    });

    test('should return null for non-existent patientId', async () => {
      const found = await findPatientByIdOrCode('P999999');
      expect(found).toBeNull();
    });

    test('should return null for null/undefined', async () => {
      expect(await findPatientByIdOrCode(null)).toBeNull();
      expect(await findPatientByIdOrCode(undefined)).toBeNull();
      expect(await findPatientByIdOrCode('')).toBeNull();
    });

    test('should apply populate option', async () => {
      // Create a related document if needed
      const found = await findPatientByIdOrCode(testPatient._id.toString(), {
        populate: 'homeClinic' // Even if null, shouldn't error
      });
      expect(found).toBeTruthy();
    });

    test('should apply select option', async () => {
      const found = await findPatientByIdOrCode(testPatient._id.toString(), {
        select: 'firstName lastName'
      });
      expect(found).toBeTruthy();
      expect(found.firstName).toBeTruthy();
      expect(found.lastName).toBeTruthy();
      // Other fields should not be selected
      expect(found.email).toBeUndefined();
    });

    test('should apply lean option', async () => {
      const found = await findPatientByIdOrCode(testPatient._id.toString(), {
        lean: true
      });
      expect(found).toBeTruthy();
      // Lean documents are plain objects, not Mongoose documents
      expect(found.save).toBeUndefined();
    });

    test('should fallback to patientId search when ObjectId-like string not found', async () => {
      // Create patient with ObjectId-like patientId
      const specialPatient = await Patient.create(createTestPatient({
        patientId: '507f1f77bcf86cd799439999'
      }));

      // This looks like an ObjectId but won't exist as one
      // Should fallback to patientId search
      const found = await findPatientByIdOrCode('507f1f77bcf86cd799439999');
      expect(found).toBeTruthy();
      expect(found.patientId).toBe('507f1f77bcf86cd799439999');
    });
  });

  describe('findPatientOrFail', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await Patient.create(createTestPatient({
        patientId: 'P000002'
      }));
    });

    test('should return patient when found by ObjectId', async () => {
      const found = await findPatientOrFail(testPatient._id.toString());
      expect(found).toBeTruthy();
      expect(found._id.toString()).toBe(testPatient._id.toString());
    });

    test('should return patient when found by patientId', async () => {
      const found = await findPatientOrFail('P000002');
      expect(found).toBeTruthy();
      expect(found.patientId).toBe('P000002');
    });

    test('should throw error with statusCode 404 when not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      try {
        await findPatientOrFail(fakeId.toString());
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Patient not found');
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('PATIENT_NOT_FOUND');
      }
    });

    test('should throw error for non-existent patientId', async () => {
      try {
        await findPatientOrFail('P999999');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });

    test('should throw error for null identifier', async () => {
      try {
        await findPatientOrFail(null);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });

    test('should pass options to underlying lookup', async () => {
      const found = await findPatientOrFail(testPatient._id.toString(), {
        select: 'firstName lastName',
        lean: true
      });
      expect(found.firstName).toBeTruthy();
      expect(found.save).toBeUndefined(); // lean
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      // Create 100 test patients
      const patients = Array.from({ length: 100 }, (_, i) =>
        createTestPatient({ patientId: `PERF${String(i).padStart(5, '0')}` })
      );
      await Patient.insertMany(patients);
    });

    test('should lookup patient by ObjectId efficiently', async () => {
      const patient = await Patient.findOne({ patientId: 'PERF00050' });

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await findPatientByIdOrCode(patient._id.toString());
      }
      const duration = Date.now() - start;

      // Should complete 100 lookups in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    test('should lookup patient by patientId efficiently', async () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await findPatientByIdOrCode(`PERF${String(i).padStart(5, '0')}`);
      }
      const duration = Date.now() - start;

      // Should complete 100 lookups in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });
});
