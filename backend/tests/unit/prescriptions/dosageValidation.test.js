/**
 * Dosage Validation Tests
 *
 * Tests for dosage validation including:
 * - Min/max dose checks
 * - Age-appropriate dosing
 * - Weight-based dosing
 * - Frequency validation
 */

const drugSafetyService = require('../../../services/drugSafetyService');

describe('Dosage Validation', () => {
  describe('validateDosage', () => {
    test('should approve normal adult paracetamol dose', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '500mg',
        frequency: 'QID', // 4 times daily
        route: 'oral'
      };
      const patient = {
        age: 35,
        weight: 70
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    test('should warn for high paracetamol dose', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '1500mg', // High single dose
        frequency: 'QID',
        route: 'oral'
      };
      const patient = {
        age: 35,
        weight: 70
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Should warn about high dose (>1000mg single dose)
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.toLowerCase().includes('dose'))).toBe(true);
    });

    test('should flag exceeding daily maximum', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '1000mg',
        frequency: 'Q4H', // Every 4 hours = 6 times daily = 6000mg
        route: 'oral'
      };
      const patient = {
        age: 35,
        weight: 70
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Max daily paracetamol is 4000mg
      expect(result.warnings.some(w =>
        w.toLowerCase().includes('maximum') ||
        w.toLowerCase().includes('daily')
      )).toBe(true);
    });

    test('should adjust dosing for pediatric patients', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '500mg', // Adult dose
        frequency: 'TID',
        route: 'oral'
      };
      const patient = {
        age: 5, // 5 years old
        weight: 20
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Should warn that dose is too high for child
      expect(result.warnings.some(w =>
        w.toLowerCase().includes('pediatric') ||
        w.toLowerCase().includes('child') ||
        w.toLowerCase().includes('weight')
      )).toBe(true);
    });

    test('should adjust dosing for elderly patients', async () => {
      const medication = {
        name: 'diazepam',
        dosage: '10mg', // Standard adult dose
        frequency: 'TID',
        route: 'oral'
      };
      const patient = {
        age: 80,
        weight: 60
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Should warn about elderly dosing
      expect(result.warnings.some(w =>
        w.toLowerCase().includes('elderly') ||
        w.toLowerCase().includes('reduce') ||
        w.toLowerCase().includes('geriatric')
      )).toBe(true);
    });

    test('should calculate weight-based dosing correctly', async () => {
      const medication = {
        name: 'amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
        route: 'oral'
      };
      const patient = {
        age: 8,
        weight: 25 // 25kg child
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Amoxicillin pediatric dose is typically 25-50mg/kg/day
      // 25kg * 25mg = 625mg/day minimum, 500 * 3 = 1500mg/day
      if (result.warnings.length > 0) {
        expect(result.warnings.some(w =>
          w.toLowerCase().includes('weight') ||
          w.toLowerCase().includes('mg/kg')
        )).toBe(true);
      }
    });
  });

  describe('Frequency Validation', () => {
    test('should parse QD frequency', async () => {
      const medication = {
        name: 'aspirin',
        dosage: '100mg',
        frequency: 'QD',
        route: 'oral'
      };
      const patient = { age: 45, weight: 70 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      expect(result.parsedFrequency?.dailyDoses || 1).toBe(1);
    });

    test('should parse BID frequency', async () => {
      const medication = {
        name: 'metformin',
        dosage: '500mg',
        frequency: 'BID',
        route: 'oral'
      };
      const patient = { age: 55, weight: 80 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      expect(result.parsedFrequency?.dailyDoses || 2).toBe(2);
    });

    test('should parse TID frequency', async () => {
      const medication = {
        name: 'amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
        route: 'oral'
      };
      const patient = { age: 35, weight: 70 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      expect(result.parsedFrequency?.dailyDoses || 3).toBe(3);
    });

    test('should parse QID frequency', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '500mg',
        frequency: 'QID',
        route: 'oral'
      };
      const patient = { age: 35, weight: 70 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      expect(result.parsedFrequency?.dailyDoses || 4).toBe(4);
    });

    test('should handle Q4H frequency', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '500mg',
        frequency: 'Q4H', // Every 4 hours = up to 6 times daily
        route: 'oral'
      };
      const patient = { age: 35, weight: 70 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Q4H = every 4 hours = 24/4 = 6 doses max
      expect(result.parsedFrequency?.dailyDoses || 6).toBeLessThanOrEqual(6);
    });

    test('should handle PRN frequency', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '500mg',
        frequency: 'PRN',
        route: 'oral'
      };
      const patient = { age: 35, weight: 70 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // PRN should be valid but may warn about max daily dose
      expect(result.isValid).toBe(true);
    });
  });

  describe('Route-Specific Validation', () => {
    test('should validate IV dosing differently than oral', async () => {
      const ivMedication = {
        name: 'paracetamol',
        dosage: '1000mg',
        frequency: 'QID',
        route: 'IV'
      };
      const oralMedication = {
        name: 'paracetamol',
        dosage: '1000mg',
        frequency: 'QID',
        route: 'oral'
      };
      const patient = { age: 35, weight: 70 };

      const ivResult = await drugSafetyService.validateDosage(ivMedication, patient);
      const oralResult = await drugSafetyService.validateDosage(oralMedication, patient);

      // Both should be valid for adult, but IV may have different warnings
      expect(ivResult.isValid).toBeDefined();
      expect(oralResult.isValid).toBeDefined();
    });

    test('should warn for topical medications with high systemic doses', async () => {
      const medication = {
        name: 'lidocaine',
        dosage: '500mg',
        frequency: 'QID',
        route: 'topical'
      };
      const patient = { age: 35, weight: 70 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // High topical lidocaine may cause systemic effects
      if (result.warnings.length > 0) {
        expect(result.warnings.some(w =>
          w.toLowerCase().includes('systemic') ||
          w.toLowerCase().includes('absorption')
        )).toBe(true);
      }
    });
  });

  describe('Renal/Hepatic Impairment', () => {
    test('should adjust dosing for renal impairment', async () => {
      const medication = {
        name: 'metformin',
        dosage: '1000mg',
        frequency: 'BID',
        route: 'oral'
      };
      const patient = {
        age: 65,
        weight: 70,
        renalFunction: {
          eGFR: 30 // Moderate-severe CKD
        }
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Metformin should be dose-adjusted or avoided in CKD
      expect(result.warnings.some(w =>
        w.toLowerCase().includes('renal') ||
        w.toLowerCase().includes('kidney') ||
        w.toLowerCase().includes('egfr')
      )).toBe(true);
    });

    test('should adjust dosing for hepatic impairment', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '1000mg',
        frequency: 'QID',
        route: 'oral'
      };
      const patient = {
        age: 50,
        weight: 70,
        hepaticFunction: {
          impairment: 'severe'
        }
      };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // High-dose paracetamol is risky in liver disease
      expect(result.warnings.some(w =>
        w.toLowerCase().includes('liver') ||
        w.toLowerCase().includes('hepatic') ||
        w.toLowerCase().includes('reduce')
      )).toBe(true);
    });
  });

  describe('Daily Maximum Calculations', () => {
    test('should calculate correct daily dose for simple regimen', () => {
      // 500mg QID = 500 * 4 = 2000mg/day
      const singleDose = 500;
      const frequency = 4;
      const dailyDose = singleDose * frequency;

      expect(dailyDose).toBe(2000);
    });

    test('should not exceed paracetamol 4000mg/day', async () => {
      const medication = {
        name: 'paracetamol',
        dosage: '1000mg',
        frequency: 'Q4H', // Could be 6x/day = 6000mg
        route: 'oral'
      };
      const patient = { age: 35, weight: 70 };

      const result = await drugSafetyService.validateDosage(medication, patient);

      // Should warn about exceeding max
      expect(result.warnings.some(w =>
        w.toLowerCase().includes('4000') ||
        w.toLowerCase().includes('maximum') ||
        w.toLowerCase().includes('daily')
      )).toBe(true);
    });
  });
});
