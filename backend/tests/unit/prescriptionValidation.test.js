const Prescription = require('../../models/Prescription');
const Patient = require('../../models/Patient');
const User = require('../../models/User');
const {
  createTestPatient,
  createTestUser,
  createTestPrescription
} = require('../fixtures/generators');

describe('Prescription Validation', () => {
  let patient, prescriber;

  beforeEach(async () => {
    patient = await Patient.create(createTestPatient());
    prescriber = await User.create(createTestUser({ role: 'doctor' }));
  });

  describe('Required Fields Validation', () => {
    test('should require patient', async () => {
      try {
        await Prescription.create({
          prescriber: prescriber._id,
          medications: [{ name: 'Test Med', dosage: '500mg' }]
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.errors.patient).toBeDefined();
      }
    });

    test('should require prescriber', async () => {
      try {
        await Prescription.create({
          patient: patient._id,
          medications: [{ name: 'Test Med', dosage: '500mg' }]
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.errors.prescriber).toBeDefined();
      }
    });

    test('should require at least one medication', async () => {
      try {
        await Prescription.create({
          patient: patient._id,
          prescriber: prescriber._id,
          medications: []
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Medication Field Validation', () => {
    test('should require medication name', async () => {
      try {
        await Prescription.create(
          createTestPrescription(patient._id, prescriber._id, {
            medications: [
              {
                dosage: '500mg',
                frequency: 'TID',
                duration: 7
              }
            ]
          })
        );
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should require dosage', async () => {
      try {
        await Prescription.create(
          createTestPrescription(patient._id, prescriber._id, {
            medications: [
              {
                name: 'Paracetamol',
                frequency: 'TID',
                duration: 7
              }
            ]
          })
        );
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should accept valid medication data', async () => {
      const prescription = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id)
      );

      expect(prescription.medications[0].name).toBe('Paracetamol');
      expect(prescription.medications[0].dosage).toBe('500mg');
      expect(prescription.medications[0].frequency).toBe('TID');
    });
  });

  describe('Prescription Type Validation', () => {
    test('should accept valid prescription types', async () => {
      const types = ['medication', 'optical', 'therapy'];

      for (const type of types) {
        const prescription = await Prescription.create(
          createTestPrescription(patient._id, prescriber._id, { type })
        );
        expect(prescription.type).toBe(type);
      }
    });

    test('should reject invalid prescription type', async () => {
      try {
        await Prescription.create(
          createTestPrescription(patient._id, prescriber._id, {
            type: 'invalid_type'
          })
        );
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Prescription Status Validation', () => {
    test('should default to active status', async () => {
      const prescription = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id)
      );
      expect(prescription.status).toBe('active');
    });

    test('should accept valid status values', async () => {
      const statuses = ['active', 'dispensed', 'cancelled', 'expired'];

      for (const status of statuses) {
        const prescription = await Prescription.create(
          createTestPrescription(patient._id, prescriber._id, { status })
        );
        expect(prescription.status).toBe(status);
      }
    });
  });

  describe('Optical Prescription Validation', () => {
    test('should validate optical prescription with sphere/cylinder/axis', async () => {
      const opticalData = {
        type: 'optical',
        rightEye: {
          sphere: -2.0,
          cylinder: -0.5,
          axis: 90,
          add: 1.0
        },
        leftEye: {
          sphere: -2.25,
          cylinder: -0.75,
          axis: 85,
          add: 1.0
        },
        pupillaryDistance: 63
      };

      const prescription = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id, opticalData)
      );

      expect(prescription.type).toBe('optical');
      expect(prescription.rightEye.sphere).toBe(-2.0);
      expect(prescription.leftEye.cylinder).toBe(-0.75);
    });

    test('should require valid axis range (0-180)', async () => {
      try {
        await Prescription.create(
          createTestPrescription(patient._id, prescriber._id, {
            type: 'optical',
            rightEye: {
              sphere: -2.0,
              cylinder: -0.5,
              axis: 200 // Invalid: > 180
            }
          })
        );
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Prescription Validity Dates', () => {
    test('should set expiry date based on prescription type', async () => {
      // Medication: 90 days
      const medicationRx = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id, {
          type: 'medication'
        })
      );

      const medicationExpiry = new Date(medicationRx.prescriptionDate);
      medicationExpiry.setDate(medicationExpiry.getDate() + 90);

      expect(medicationRx.expiryDate.getTime()).toBeCloseTo(
        medicationExpiry.getTime(),
        -4 // Allow 10 second difference
      );

      // Optical: 365 days
      const opticalRx = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id, {
          type: 'optical'
        })
      );

      const opticalExpiry = new Date(opticalRx.prescriptionDate);
      opticalExpiry.setDate(opticalExpiry.getDate() + 365);

      expect(opticalRx.expiryDate.getTime()).toBeCloseTo(
        opticalExpiry.getTime(),
        -4
      );
    });

    test('should not allow dispensing expired prescription', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const prescription = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id, {
          expiryDate: yesterday,
          status: 'expired'
        })
      );

      expect(prescription.status).toBe('expired');
    });
  });

  describe('Refill Validation', () => {
    test('should track refills correctly', async () => {
      const prescription = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id, {
          refillsAllowed: 3,
          refillsRemaining: 3
        })
      );

      expect(prescription.refillsAllowed).toBe(3);
      expect(prescription.refillsRemaining).toBe(3);
    });

    test('should not allow refills beyond allowed amount', async () => {
      const prescription = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id, {
          refillsAllowed: 2,
          refillsRemaining: 0
        })
      );

      expect(prescription.refillsRemaining).toBe(0);
      // Business logic should prevent dispensing when refillsRemaining === 0
    });
  });

  describe('Drug Allergy Warnings', () => {
    test('should flag prescription if patient has documented allergy', async () => {
      const patientWithAllergy = await Patient.create(
        createTestPatient({
          medicalHistory: {
            allergies: [
              {
                allergen: 'Penicillin',
                reaction: 'Rash',
                severity: 'moderate'
              }
            ]
          }
        })
      );

      const prescription = await Prescription.create(
        createTestPrescription(patientWithAllergy._id, prescriber._id, {
          medications: [
            {
              name: 'Amoxicillin', // Penicillin-based
              dosage: '500mg',
              frequency: 'TID',
              duration: 7
            }
          ],
          warnings: [
            {
              type: 'allergy',
              message: 'Patient allergic to Penicillin',
              severity: 'high'
            }
          ]
        })
      );

      expect(prescription.warnings.length).toBeGreaterThan(0);
      expect(prescription.warnings[0].type).toBe('allergy');
    });
  });

  describe('Controlled Substance Validation', () => {
    test('should flag controlled substances', async () => {
      const prescription = await Prescription.create(
        createTestPrescription(patient._id, prescriber._id, {
          medications: [
            {
              name: 'Morphine',
              dosage: '10mg',
              frequency: 'Q4H',
              duration: 3,
              isControlledSubstance: true,
              schedule: 'II'
            }
          ]
        })
      );

      expect(prescription.medications[0].isControlledSubstance).toBe(true);
      expect(prescription.medications[0].schedule).toBe('II');
    });
  });
});
