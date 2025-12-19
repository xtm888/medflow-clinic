/**
 * Allergy and Contraindication Tests
 *
 * Tests for allergy checking including:
 * - Drug allergy detection
 * - Cross-reactivity alerts
 * - Drug class allergies
 * - Contraindication checks
 */

const drugSafetyService = require('../../../services/drugSafetyService');

describe('Allergy Checks', () => {
  describe('checkAllergies', () => {
    test('should detect direct drug allergy', async () => {
      const medication = { name: 'penicillin', dosage: '500mg' };
      const patientAllergies = ['penicillin'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.alerts.length).toBeGreaterThan(0);
    });

    test('should detect cross-reactivity between penicillin and amoxicillin', async () => {
      const medication = { name: 'amoxicillin', dosage: '500mg' };
      const patientAllergies = ['penicillin'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(true);
      expect(result.crossReactivity).toBe(true);
      expect(result.alerts.some(a =>
        a.toLowerCase().includes('cross-react') ||
        a.toLowerCase().includes('related')
      )).toBe(true);
    });

    test('should detect cephalosporin cross-reactivity with penicillin allergy', async () => {
      const medication = { name: 'cephalexin', dosage: '500mg' };
      const patientAllergies = ['penicillin'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      // Cephalosporins have ~10% cross-reactivity with penicillins
      expect(result.hasAllergy || result.hasCaution).toBe(true);
    });

    test('should detect sulfa drug allergy', async () => {
      const medication = { name: 'sulfamethoxazole', dosage: '800mg' };
      const patientAllergies = ['sulfa', 'sulfonamide'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(true);
    });

    test('should detect NSAID allergy', async () => {
      const medication = { name: 'ibuprofen', dosage: '400mg' };
      const patientAllergies = ['NSAIDs', 'aspirin'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(true);
    });

    test('should return no allergy for safe medication', async () => {
      const medication = { name: 'paracetamol', dosage: '500mg' };
      const patientAllergies = ['penicillin', 'sulfa'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(false);
      expect(result.alerts.length).toBe(0);
    });

    test('should handle case-insensitive allergy matching', async () => {
      const medication = { name: 'PENICILLIN V', dosage: '500mg' };
      const patientAllergies = ['penicillin'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(true);
    });

    test('should handle empty allergy list', async () => {
      const medication = { name: 'penicillin', dosage: '500mg' };
      const patientAllergies = [];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(false);
    });

    test('should handle null allergy list', async () => {
      const medication = { name: 'penicillin', dosage: '500mg' };

      const result = await drugSafetyService.checkAllergies(medication, null);

      expect(result.hasAllergy).toBe(false);
    });
  });

  describe('Drug Class Allergies', () => {
    test('should detect beta-lactam class allergy', async () => {
      const medications = [
        { name: 'ampicillin', dosage: '500mg' },
        { name: 'ceftriaxone', dosage: '1g' },
        { name: 'meropenem', dosage: '500mg' }
      ];
      const patientAllergies = ['beta-lactam'];

      for (const medication of medications) {
        const result = await drugSafetyService.checkAllergies(medication, patientAllergies);
        expect(result.hasAllergy || result.hasCaution).toBe(true);
      }
    });

    test('should detect fluoroquinolone class allergy', async () => {
      const medications = [
        { name: 'ciprofloxacin', dosage: '500mg' },
        { name: 'levofloxacin', dosage: '500mg' },
        { name: 'moxifloxacin', dosage: '400mg' }
      ];
      const patientAllergies = ['fluoroquinolone', 'quinolone'];

      for (const medication of medications) {
        const result = await drugSafetyService.checkAllergies(medication, patientAllergies);
        expect(result.hasAllergy).toBe(true);
      }
    });

    test('should detect opioid class allergy', async () => {
      const medication = { name: 'morphine', dosage: '10mg' };
      const patientAllergies = ['opioids'];

      const result = await drugSafetyService.checkAllergies(medication, patientAllergies);

      expect(result.hasAllergy).toBe(true);
    });

    test('should detect statin class allergy', async () => {
      const medications = [
        { name: 'atorvastatin', dosage: '20mg' },
        { name: 'simvastatin', dosage: '40mg' }
      ];
      const patientAllergies = ['statins'];

      for (const medication of medications) {
        const result = await drugSafetyService.checkAllergies(medication, patientAllergies);
        expect(result.hasAllergy).toBe(true);
      }
    });
  });

  describe('Contraindication Checks', () => {
    test('should flag metformin contraindication with renal impairment', async () => {
      const medication = { name: 'metformin', dosage: '500mg' };
      const patient = {
        conditions: ['chronic kidney disease'],
        labResults: { eGFR: 25 }
      };

      const result = await drugSafetyService.checkContraindications(medication, patient);

      expect(result.hasContraindication).toBe(true);
      expect(result.alerts.some(a =>
        a.toLowerCase().includes('renal') ||
        a.toLowerCase().includes('kidney')
      )).toBe(true);
    });

    test('should flag warfarin contraindication with active bleeding', async () => {
      const medication = { name: 'warfarin', dosage: '5mg' };
      const patient = {
        conditions: ['active GI bleeding', 'peptic ulcer']
      };

      const result = await drugSafetyService.checkContraindications(medication, patient);

      expect(result.hasContraindication).toBe(true);
    });

    test('should flag NSAIDs contraindication with peptic ulcer', async () => {
      const medication = { name: 'ibuprofen', dosage: '400mg' };
      const patient = {
        conditions: ['peptic ulcer disease', 'gastritis']
      };

      const result = await drugSafetyService.checkContraindications(medication, patient);

      expect(result.hasContraindication || result.hasCaution).toBe(true);
    });

    test('should flag ACE inhibitor contraindication with angioedema history', async () => {
      const medication = { name: 'lisinopril', dosage: '10mg' };
      const patient = {
        conditions: ['angioedema'],
        history: ['angioedema from ACE inhibitor']
      };

      const result = await drugSafetyService.checkContraindications(medication, patient);

      expect(result.hasContraindication).toBe(true);
    });

    test('should flag beta-blocker caution with asthma', async () => {
      const medication = { name: 'propranolol', dosage: '40mg' };
      const patient = {
        conditions: ['asthma', 'reactive airway disease']
      };

      const result = await drugSafetyService.checkContraindications(medication, patient);

      expect(result.hasCaution).toBe(true);
      expect(result.alerts.some(a =>
        a.toLowerCase().includes('asthma') ||
        a.toLowerCase().includes('bronchospasm')
      )).toBe(true);
    });

    test('should return no contraindication for appropriate patient', async () => {
      const medication = { name: 'paracetamol', dosage: '500mg' };
      const patient = {
        conditions: ['hypertension'],
        labResults: { eGFR: 90 }
      };

      const result = await drugSafetyService.checkContraindications(medication, patient);

      expect(result.hasContraindication).toBe(false);
    });
  });

  describe('Pregnancy and Lactation', () => {
    test('should flag category X drug in pregnancy', async () => {
      const medication = { name: 'isotretinoin', dosage: '20mg' };
      const patient = {
        isPregnant: true,
        conditions: []
      };

      const result = await drugSafetyService.checkPregnancySafety(medication, patient);

      expect(result.isContraindicated).toBe(true);
      expect(result.category).toBe('X');
      expect(result.recommendation).toMatch(/NEVER/i);
    });

    test('should flag warfarin in pregnancy', async () => {
      const medication = { name: 'warfarin', dosage: '5mg' };
      const patient = {
        isPregnant: true
      };

      const result = await drugSafetyService.checkPregnancySafety(medication, patient);

      expect(result.isContraindicated).toBe(true);
    });

    test('should allow category B drug in pregnancy', async () => {
      const medication = { name: 'metformin', dosage: '500mg' };
      const patient = {
        isPregnant: true
      };

      const result = await drugSafetyService.checkPregnancySafety(medication, patient);

      expect(result.isContraindicated).toBe(false);
      expect(result.category).toMatch(/B|safe/i);
    });

    test('should flag medication unsafe during lactation', async () => {
      const medication = { name: 'lithium', dosage: '300mg' };
      const patient = {
        isBreastfeeding: true
      };

      const result = await drugSafetyService.checkLactationSafety(medication, patient);

      expect(result.isSafe).toBe(false);
    });

    test('should allow safe medication during lactation', async () => {
      const medication = { name: 'paracetamol', dosage: '500mg' };
      const patient = {
        isBreastfeeding: true
      };

      const result = await drugSafetyService.checkLactationSafety(medication, patient);

      expect(result.isSafe).toBe(true);
    });
  });

  describe('Comprehensive Safety Check', () => {
    test('should run all safety checks and return combined result', async () => {
      const prescription = {
        medication: { name: 'warfarin', dosage: '5mg', frequency: 'QD' },
        patient: {
          age: 75,
          allergies: ['aspirin'],
          conditions: ['atrial fibrillation'],
          currentMedications: [
            { name: 'aspirin', dosage: '100mg' }
          ]
        }
      };

      const result = await drugSafetyService.comprehensiveSafetyCheck(prescription);

      expect(result.overallSafe).toBe(false);
      expect(result.interactions.length).toBeGreaterThan(0);
      expect(result.allergies.hasAllergy).toBe(true); // Aspirin-warfarin cross-reactivity
      expect(result.summary).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should return safe result for appropriate prescription', async () => {
      const prescription = {
        medication: { name: 'paracetamol', dosage: '500mg', frequency: 'QID' },
        patient: {
          age: 35,
          weight: 70,
          allergies: [],
          conditions: [],
          currentMedications: []
        }
      };

      const result = await drugSafetyService.comprehensiveSafetyCheck(prescription);

      expect(result.overallSafe).toBe(true);
      expect(result.interactions.length).toBe(0);
      expect(result.allergies.hasAllergy).toBe(false);
    });

    test('should include severity classification in results', async () => {
      const prescription = {
        medication: { name: 'sildenafil', dosage: '50mg', frequency: 'PRN' },
        patient: {
          allergies: [],
          conditions: ['coronary artery disease'],
          currentMedications: [
            { name: 'nitroglycerin', dosage: '0.4mg' }
          ]
        }
      };

      const result = await drugSafetyService.comprehensiveSafetyCheck(prescription);

      expect(result.overallSafe).toBe(false);
      expect(result.maxSeverity).toBe('contraindicated');
    });
  });
});
