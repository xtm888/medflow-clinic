/**
 * Unit Tests for Visit Granular Update Service
 *
 * Tests the granular update pattern inspired by CareVision's DonConsultation.cs.
 * Each section of a visit is updated independently to prevent cascading failures.
 *
 * @see backend/docs/GRANULAR_UPDATE_PATTERN.md
 */

const mongoose = require('mongoose');

// Import the service - must be after mongoose setup
const visitGranularService = require('../../services/visitGranularService');

// Import models for testing
const Visit = require('../../models/Visit');
const Patient = require('../../models/Patient');
const Clinic = require('../../models/Clinic');
const User = require('../../models/User');

// Test helper to generate valid ObjectIds
const generateObjectId = () => new mongoose.Types.ObjectId();

// ============================================
// VALIDATION HELPERS TESTS
// ============================================

describe('visitGranularService', () => {
  describe('Validation Helpers', () => {
    describe('validateObjectId()', () => {
      const { validateObjectId } = visitGranularService;

      test('should accept valid ObjectId string', () => {
        const validId = generateObjectId().toString();
        expect(() => validateObjectId(validId, 'Test ID')).not.toThrow();
      });

      test('should accept valid ObjectId object', () => {
        const validId = generateObjectId();
        expect(() => validateObjectId(validId, 'Test ID')).not.toThrow();
      });

      test('should throw for null ID', () => {
        expect(() => validateObjectId(null, 'Test ID')).toThrow('Test ID invalide');
      });

      test('should throw for undefined ID', () => {
        expect(() => validateObjectId(undefined, 'Test ID')).toThrow('Test ID invalide');
      });

      test('should throw for invalid string', () => {
        expect(() => validateObjectId('invalid-id', 'Test ID')).toThrow('Test ID invalide');
      });

      test('should throw for empty string', () => {
        expect(() => validateObjectId('', 'Test ID')).toThrow('Test ID invalide');
      });

      test('should have statusCode 400 on error', () => {
        try {
          validateObjectId('invalid', 'Visit ID');
        } catch (error) {
          expect(error.statusCode).toBe(400);
        }
      });
    });

    describe('validateIOPValue()', () => {
      const { validateIOPValue } = visitGranularService;

      test('should accept valid IOP value at minimum (0)', () => {
        expect(() => validateIOPValue(0, 'OD')).not.toThrow();
      });

      test('should accept valid IOP value at maximum (60)', () => {
        expect(() => validateIOPValue(60, 'OS')).not.toThrow();
      });

      test('should accept typical IOP value (15)', () => {
        expect(() => validateIOPValue(15, 'OD')).not.toThrow();
      });

      test('should accept null value (optional)', () => {
        expect(() => validateIOPValue(null, 'OD')).not.toThrow();
      });

      test('should accept undefined value (optional)', () => {
        expect(() => validateIOPValue(undefined, 'OS')).not.toThrow();
      });

      test('should throw for negative IOP value', () => {
        expect(() => validateIOPValue(-1, 'OD')).toThrow();
      });

      test('should throw for IOP value above 60', () => {
        expect(() => validateIOPValue(61, 'OS')).toThrow();
      });

      test('should throw for non-numeric value', () => {
        expect(() => validateIOPValue('high', 'OD')).toThrow();
      });

      test('should have statusCode 400 on error', () => {
        try {
          validateIOPValue(100, 'OD');
        } catch (error) {
          expect(error.statusCode).toBe(400);
        }
      });

      test('should include eye identifier in error message', () => {
        try {
          validateIOPValue(100, 'OD');
        } catch (error) {
          expect(error.message).toContain('OD');
        }
      });
    });

    describe('validateVisualAcuityValue()', () => {
      const { validateVisualAcuityValue } = visitGranularService;

      test('should accept valid Monoyer scale values', () => {
        const validMonoyer = ['10/10', '9/10', '8/10', '5/10', '1/10', '1/20', '1/50'];
        validMonoyer.forEach(value => {
          expect(validateVisualAcuityValue(value)).toBe(true);
        });
      });

      test('should accept special notations', () => {
        const specialNotations = ['CLD', 'VBLM', 'PL+', 'PL-'];
        specialNotations.forEach(value => {
          expect(validateVisualAcuityValue(value)).toBe(true);
        });
      });

      test('should accept case-insensitive special notations', () => {
        expect(validateVisualAcuityValue('cld')).toBe(true);
        expect(validateVisualAcuityValue('vblm')).toBe(true);
        expect(validateVisualAcuityValue('pl+')).toBe(true);
      });

      test('should accept valid Parinaud scale values', () => {
        const validParinaud = ['P1.5', 'P2', 'P3', 'P6', 'P10', 'P14', 'P20'];
        validParinaud.forEach(value => {
          expect(validateVisualAcuityValue(value)).toBe(true);
        });
      });

      test('should accept fraction format', () => {
        expect(validateVisualAcuityValue('3/10')).toBe(true);
        expect(validateVisualAcuityValue('6/6')).toBe(true);
      });

      test('should accept null/undefined (optional)', () => {
        expect(validateVisualAcuityValue(null)).toBe(true);
        expect(validateVisualAcuityValue(undefined)).toBe(true);
        expect(validateVisualAcuityValue('')).toBe(true);
      });
    });

    describe('validateSphereValue()', () => {
      const { validateSphereValue } = visitGranularService;

      test('should accept valid sphere values', () => {
        expect(validateSphereValue(-5.00)).toBe(true);
        expect(validateSphereValue(0)).toBe(true);
        expect(validateSphereValue(3.25)).toBe(true);
        expect(validateSphereValue(-20)).toBe(true);
        expect(validateSphereValue(20)).toBe(true);
      });

      test('should accept boundary values (-25 to +25)', () => {
        expect(validateSphereValue(-25)).toBe(true);
        expect(validateSphereValue(25)).toBe(true);
      });

      test('should reject values outside range', () => {
        expect(validateSphereValue(-26)).toBe(false);
        expect(validateSphereValue(26)).toBe(false);
      });

      test('should reject non-numeric values', () => {
        expect(validateSphereValue('high')).toBe(false);
      });

      test('should accept null/undefined (optional)', () => {
        expect(validateSphereValue(null)).toBe(true);
        expect(validateSphereValue(undefined)).toBe(true);
      });
    });

    describe('validateCylinderValue()', () => {
      const { validateCylinderValue } = visitGranularService;

      test('should accept valid cylinder values', () => {
        expect(validateCylinderValue(-2.50)).toBe(true);
        expect(validateCylinderValue(0)).toBe(true);
        expect(validateCylinderValue(1.75)).toBe(true);
      });

      test('should accept boundary values (-10 to +10)', () => {
        expect(validateCylinderValue(-10)).toBe(true);
        expect(validateCylinderValue(10)).toBe(true);
      });

      test('should reject values outside range', () => {
        expect(validateCylinderValue(-11)).toBe(false);
        expect(validateCylinderValue(11)).toBe(false);
      });

      test('should accept null/undefined (optional)', () => {
        expect(validateCylinderValue(null)).toBe(true);
        expect(validateCylinderValue(undefined)).toBe(true);
      });
    });

    describe('validateAxisValue()', () => {
      const { validateAxisValue } = visitGranularService;

      test('should accept valid axis values (0-180)', () => {
        expect(validateAxisValue(0)).toBe(true);
        expect(validateAxisValue(90)).toBe(true);
        expect(validateAxisValue(180)).toBe(true);
      });

      test('should reject negative values', () => {
        expect(validateAxisValue(-1)).toBe(false);
      });

      test('should reject values above 180', () => {
        expect(validateAxisValue(181)).toBe(false);
      });

      test('should accept null/undefined (optional)', () => {
        expect(validateAxisValue(null)).toBe(true);
        expect(validateAxisValue(undefined)).toBe(true);
      });
    });

    describe('validateAdditionValue()', () => {
      const { validateAdditionValue } = visitGranularService;

      test('should accept valid addition values (0.25-4.00)', () => {
        expect(validateAdditionValue(0.25)).toBe(true);
        expect(validateAdditionValue(1.50)).toBe(true);
        expect(validateAdditionValue(2.50)).toBe(true);
        expect(validateAdditionValue(4.00)).toBe(true);
      });

      test('should reject values below 0.25', () => {
        expect(validateAdditionValue(0)).toBe(false);
        expect(validateAdditionValue(0.10)).toBe(false);
      });

      test('should reject values above 4', () => {
        expect(validateAdditionValue(4.25)).toBe(false);
        expect(validateAdditionValue(5)).toBe(false);
      });

      test('should accept null/undefined (optional)', () => {
        expect(validateAdditionValue(null)).toBe(true);
        expect(validateAdditionValue(undefined)).toBe(true);
      });
    });

    describe('validateRefractionEye()', () => {
      const { validateRefractionEye } = visitGranularService;

      test('should accept valid complete eye refraction', () => {
        const validEye = {
          sphere: -2.50,
          cylinder: -0.75,
          axis: 90,
          add: 1.50
        };
        const result = validateRefractionEye(validEye, 'OD');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should accept empty data (optional)', () => {
        const result = validateRefractionEye(null, 'OD');
        expect(result.valid).toBe(true);
      });

      test('should accept partial data', () => {
        const partialEye = { sphere: -1.00 };
        const result = validateRefractionEye(partialEye, 'OD');
        expect(result.valid).toBe(true);
      });

      test('should return errors for invalid sphere', () => {
        const invalidEye = { sphere: -30 };
        const result = validateRefractionEye(invalidEye, 'OD');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('OD: La sphère doit être entre -25.00 et +25.00 dioptries');
      });

      test('should return errors for invalid cylinder', () => {
        const invalidEye = { cylinder: -15 };
        const result = validateRefractionEye(invalidEye, 'OS');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('OS: Le cylindre doit être entre -10.00 et +10.00 dioptries');
      });

      test('should return errors for invalid axis', () => {
        const invalidEye = { axis: 200 };
        const result = validateRefractionEye(invalidEye, 'OD');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('OD: L\'axe doit être entre 0 et 180 degrés');
      });

      test('should return errors for invalid addition', () => {
        const invalidEye = { add: 5.00 };
        const result = validateRefractionEye(invalidEye, 'OD');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('OD: L\'addition doit être entre +0.25 et +4.00 dioptries');
      });

      test('should accept "addition" as alias for "add"', () => {
        const eyeWithAddition = { addition: 2.00 };
        const result = validateRefractionEye(eyeWithAddition, 'OD');
        expect(result.valid).toBe(true);
      });

      test('should return multiple errors', () => {
        const invalidEye = { sphere: -30, cylinder: -15, axis: 200 };
        const result = validateRefractionEye(invalidEye, 'OD');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });
  });

  // ============================================
  // CORE GRANULAR UPDATE METHODS TESTS
  // ============================================

  describe('Core Granular Update Methods', () => {
    let testClinic;
    let testPatient;
    let testUser;
    let testVisit;

    beforeEach(async () => {
      // Create test clinic
      testClinic = await Clinic.create({
        name: 'Test Clinic',
        code: 'TEST01',
        address: {
          street: '123 Test St',
          city: 'Kinshasa',
          country: 'CD'
        }
      });

      // Create test user
      testUser = await User.create({
        email: 'doctor@test.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'Doctor',
        role: 'doctor',
        clinic: testClinic._id
      });

      // Create test patient
      testPatient = await Patient.create({
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        clinic: testClinic._id
      });

      // Create test visit
      testVisit = await Visit.create({
        patient: testPatient._id,
        clinic: testClinic._id,
        visitType: 'consultation',
        visitDate: new Date(),
        provider: testUser._id,
        status: 'in-progress'
      });
    });

    describe('updateVisitRefraction()', () => {
      test('should update refraction data successfully', async () => {
        const refractionData = {
          ophthalmologyExamId: generateObjectId()
        };

        const result = await visitGranularService.updateVisitRefraction(
          testVisit._id.toString(),
          refractionData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.visit).toBeDefined();
        expect(result.visit.ophthalmologyExam).toBeDefined();
      });

      test('should throw error for invalid visit ID', async () => {
        await expect(
          visitGranularService.updateVisitRefraction('invalid-id', {}, testUser._id.toString())
        ).rejects.toThrow('Visit ID invalide');
      });

      test('should throw error for invalid user ID', async () => {
        await expect(
          visitGranularService.updateVisitRefraction(testVisit._id.toString(), {}, 'invalid-id')
        ).rejects.toThrow('User ID invalide');
      });

      test('should throw error when refraction data is missing', async () => {
        await expect(
          visitGranularService.updateVisitRefraction(testVisit._id.toString(), null, testUser._id.toString())
        ).rejects.toThrow('Les données de réfraction sont requises');
      });

      test('should throw 404 when visit not found', async () => {
        const fakeVisitId = generateObjectId();
        try {
          await visitGranularService.updateVisitRefraction(
            fakeVisitId.toString(),
            { ophthalmologyExamId: generateObjectId() },
            testUser._id.toString()
          );
        } catch (error) {
          expect(error.message).toBe('Visite non trouvée');
          expect(error.statusCode).toBe(404);
        }
      });

      test('should set updatedBy and updatedAt fields', async () => {
        const refractionData = { ophthalmologyExamId: generateObjectId() };
        const result = await visitGranularService.updateVisitRefraction(
          testVisit._id.toString(),
          refractionData,
          testUser._id.toString()
        );

        expect(result.visit.updatedBy.toString()).toBe(testUser._id.toString());
        expect(result.visit.updatedAt).toBeDefined();
      });
    });

    describe('updateVisitDiagnosis()', () => {
      test('should update diagnosis data successfully', async () => {
        const diagnosisData = [
          { code: 'H40.0', description: 'Glaucome suspect' },
          { code: 'H52.1', description: 'Myopie' }
        ];

        const result = await visitGranularService.updateVisitDiagnosis(
          testVisit._id.toString(),
          diagnosisData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.diagnoses).toHaveLength(2);
        expect(result.diagnoses[0].code).toBe('H40.0');
      });

      test('should throw error when diagnoses is not an array', async () => {
        await expect(
          visitGranularService.updateVisitDiagnosis(
            testVisit._id.toString(),
            { code: 'H40.0' }, // Object instead of array
            testUser._id.toString()
          )
        ).rejects.toThrow('Les diagnostics doivent être un tableau');
      });

      test('should throw error when diagnosis lacks code', async () => {
        await expect(
          visitGranularService.updateVisitDiagnosis(
            testVisit._id.toString(),
            [{ description: 'Missing code' }],
            testUser._id.toString()
          )
        ).rejects.toThrow('Chaque diagnostic doit avoir un code et une description');
      });

      test('should throw error when diagnosis lacks description', async () => {
        await expect(
          visitGranularService.updateVisitDiagnosis(
            testVisit._id.toString(),
            [{ code: 'H40.0' }],
            testUser._id.toString()
          )
        ).rejects.toThrow('Chaque diagnostic doit avoir un code et une description');
      });

      test('should accept empty array (clear diagnoses)', async () => {
        const result = await visitGranularService.updateVisitDiagnosis(
          testVisit._id.toString(),
          [],
          testUser._id.toString()
        );

        expect(result.diagnoses).toHaveLength(0);
      });

      test('should accept null (clear diagnoses)', async () => {
        const result = await visitGranularService.updateVisitDiagnosis(
          testVisit._id.toString(),
          null,
          testUser._id.toString()
        );

        expect(result.diagnoses).toHaveLength(0);
      });
    });

    describe('updateVisitTreatment()', () => {
      test('should update treatment data successfully', async () => {
        const treatmentData = {
          medications: [
            { name: 'Timolol 0.5%', dosage: '1 goutte 2x/jour', eye: 'OU' }
          ],
          recommendations: ['Controle dans 3 mois'],
          followUpInstructions: 'Revenir si vision floue'
        };

        const result = await visitGranularService.updateVisitTreatment(
          testVisit._id.toString(),
          treatmentData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.plan.medications).toHaveLength(1);
        expect(result.plan.medications[0].name).toBe('Timolol 0.5%');
      });

      test('should throw error when treatment data is missing', async () => {
        await expect(
          visitGranularService.updateVisitTreatment(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données de traitement sont requises');
      });

      test('should update only provided fields', async () => {
        // First add medications
        await visitGranularService.updateVisitTreatment(
          testVisit._id.toString(),
          { medications: [{ name: 'Drug A', dosage: '1x/jour' }] },
          testUser._id.toString()
        );

        // Then add referrals only
        const result = await visitGranularService.updateVisitTreatment(
          testVisit._id.toString(),
          { referrals: [{ specialist: 'Neurologue', reason: 'Bilan' }] },
          testUser._id.toString()
        );

        expect(result.plan.referrals).toHaveLength(1);
      });

      test('should update full plan when provided', async () => {
        const treatmentData = {
          plan: {
            medications: [],
            lifestyle: [],
            followUp: { required: false }
          }
        };

        const result = await visitGranularService.updateVisitTreatment(
          testVisit._id.toString(),
          treatmentData,
          testUser._id.toString()
        );

        expect(result.plan.followUp.required).toBe(false);
      });
    });

    describe('updateVisitIOP()', () => {
      test('should update IOP data successfully', async () => {
        const iopData = {
          OD: { value: 15, method: 'applanation', device: 'Goldmann' },
          OS: { value: 16, method: 'applanation', device: 'Goldmann' },
          method: 'applanation'
        };

        const result = await visitGranularService.updateVisitIOP(
          testVisit._id.toString(),
          iopData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.examinations.iop.OD.value).toBe(15);
        expect(result.examinations.iop.OS.value).toBe(16);
      });

      test('should accept simple numeric values', async () => {
        const iopData = {
          OD: 14,
          OS: 15
        };

        const result = await visitGranularService.updateVisitIOP(
          testVisit._id.toString(),
          iopData,
          testUser._id.toString()
        );

        expect(result.examinations.iop.OD).toBe(14);
        expect(result.examinations.iop.OS).toBe(15);
      });

      test('should throw error when IOP data is missing', async () => {
        await expect(
          visitGranularService.updateVisitIOP(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données de tension oculaire sont requises');
      });

      test('should throw error for IOP above 60 mmHg', async () => {
        const iopData = { OD: 65, OS: 15 };

        await expect(
          visitGranularService.updateVisitIOP(
            testVisit._id.toString(),
            iopData,
            testUser._id.toString()
          )
        ).rejects.toThrow(/OD.*entre 0 et 60 mmHg/);
      });

      test('should throw error for negative IOP', async () => {
        const iopData = { OD: 15, OS: -5 };

        await expect(
          visitGranularService.updateVisitIOP(
            testVisit._id.toString(),
            iopData,
            testUser._id.toString()
          )
        ).rejects.toThrow(/OS.*entre 0 et 60 mmHg/);
      });
    });

    describe('updateVisitVisualAcuity()', () => {
      test('should update visual acuity data successfully', async () => {
        const vaData = {
          OD: {
            uncorrected: '5/10',
            corrected: '10/10',
            pinhole: '10/10'
          },
          OS: {
            uncorrected: '4/10',
            corrected: '9/10'
          }
        };

        const result = await visitGranularService.updateVisitVisualAcuity(
          testVisit._id.toString(),
          vaData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.examinations.visualAcuity.OD.corrected).toBe('10/10');
      });

      test('should throw error when data is missing', async () => {
        await expect(
          visitGranularService.updateVisitVisualAcuity(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données d\'acuité visuelle sont requises');
      });
    });

    describe('updateVisitAnteriorSegment()', () => {
      test('should update anterior segment data successfully', async () => {
        const anteriorData = {
          OD: {
            conjunctiva: 'Normal',
            cornea: 'Claire',
            anteriorChamber: 'Calme, profonde',
            iris: 'Normal',
            pupil: 'Rond, reactif',
            lens: 'Claire'
          },
          OS: {
            conjunctiva: 'Normal',
            cornea: 'Claire'
          }
        };

        const result = await visitGranularService.updateVisitAnteriorSegment(
          testVisit._id.toString(),
          anteriorData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.examinations.anteriorSegment.OD.cornea).toBe('Claire');
      });

      test('should throw error when data is missing', async () => {
        await expect(
          visitGranularService.updateVisitAnteriorSegment(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données du segment antérieur sont requises');
      });
    });

    describe('updateVisitPosteriorSegment()', () => {
      test('should update posterior segment data successfully', async () => {
        const posteriorData = {
          OD: {
            vitreous: 'Claire',
            opticDisc: 'Rose, bords nets, C/D 0.3',
            macula: 'Normale, reflet foveolaire present',
            vessels: 'Calibre normal',
            periphery: 'Normale'
          }
        };

        const result = await visitGranularService.updateVisitPosteriorSegment(
          testVisit._id.toString(),
          posteriorData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.examinations.posteriorSegment.OD.vitreous).toBe('Claire');
      });

      test('should throw error when data is missing', async () => {
        await expect(
          visitGranularService.updateVisitPosteriorSegment(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données du segment postérieur sont requises');
      });
    });

    describe('updateVisitKeratometry()', () => {
      test('should update keratometry data successfully', async () => {
        const keratometryData = {
          OD: {
            K1: { power: 43.25, axis: 180 },
            K2: { power: 44.00, axis: 90 }
          },
          OS: {
            K1: { power: 43.50, axis: 175 },
            K2: { power: 44.25, axis: 85 }
          }
        };

        const result = await visitGranularService.updateVisitKeratometry(
          testVisit._id.toString(),
          keratometryData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.examinations.keratometry.OD.K1.power).toBe(43.25);
      });

      test('should throw error when data is missing', async () => {
        await expect(
          visitGranularService.updateVisitKeratometry(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données de kératométrie sont requises');
      });
    });

    describe('updateVisitPathologyFindings()', () => {
      test('should update pathology findings successfully', async () => {
        const pathologyData = [
          {
            template: 'cataract',
            eye: 'OD',
            severity: 'moderate',
            findings: { nuclearOpacity: 2, corticalOpacity: 1 }
          }
        ];

        const result = await visitGranularService.updateVisitPathologyFindings(
          testVisit._id.toString(),
          pathologyData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.pathologyFindings).toHaveLength(1);
        expect(result.pathologyFindings[0].template).toBe('cataract');
      });

      test('should throw error when data is not an array', async () => {
        await expect(
          visitGranularService.updateVisitPathologyFindings(
            testVisit._id.toString(),
            { template: 'cataract' }, // Object instead of array
            testUser._id.toString()
          )
        ).rejects.toThrow('Les constats pathologiques doivent être un tableau');
      });

      test('should accept empty array', async () => {
        const result = await visitGranularService.updateVisitPathologyFindings(
          testVisit._id.toString(),
          [],
          testUser._id.toString()
        );

        expect(result.pathologyFindings).toHaveLength(0);
      });
    });

    describe('updateVisitNotes()', () => {
      test('should update clinical notes successfully', async () => {
        const notesData = {
          clinical: 'Patient se plaint de vision floue depuis 2 semaines',
          internal: 'A surveiller pour glaucome',
          nursing: 'Tension prise avant dilatation'
        };

        const result = await visitGranularService.updateVisitNotes(
          testVisit._id.toString(),
          notesData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.notes.clinical).toBe(notesData.clinical);
        expect(result.notes.internal).toBe(notesData.internal);
        expect(result.notes.nursing).toBe(notesData.nursing);
      });

      test('should throw error when data is missing', async () => {
        await expect(
          visitGranularService.updateVisitNotes(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données de notes sont requises');
      });

      test('should update only provided note types', async () => {
        const result = await visitGranularService.updateVisitNotes(
          testVisit._id.toString(),
          { clinical: 'Only clinical note' },
          testUser._id.toString()
        );

        expect(result.notes.clinical).toBe('Only clinical note');
      });
    });

    describe('updateVisitChiefComplaint()', () => {
      test('should update chief complaint successfully', async () => {
        const complaintData = {
          chiefComplaint: 'Vision floue OD',
          historyOfPresentIllness: 'Debut progressif depuis 2 mois, aggravation recente'
        };

        const result = await visitGranularService.updateVisitChiefComplaint(
          testVisit._id.toString(),
          complaintData,
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.chiefComplaint).toBe(complaintData.chiefComplaint);
        expect(result.historyOfPresentIllness).toBe(complaintData.historyOfPresentIllness);
      });

      test('should throw error when data is missing', async () => {
        await expect(
          visitGranularService.updateVisitChiefComplaint(
            testVisit._id.toString(),
            null,
            testUser._id.toString()
          )
        ).rejects.toThrow('Les données du motif de consultation sont requises');
      });
    });

    describe('linkPrescriptionToVisit()', () => {
      test('should link prescription to visit successfully', async () => {
        const prescriptionId = generateObjectId();

        const result = await visitGranularService.linkPrescriptionToVisit(
          testVisit._id.toString(),
          prescriptionId.toString(),
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.prescriptions).toContainEqual(prescriptionId);
      });

      test('should throw error for invalid prescription ID', async () => {
        await expect(
          visitGranularService.linkPrescriptionToVisit(
            testVisit._id.toString(),
            'invalid-id',
            testUser._id.toString()
          )
        ).rejects.toThrow('Prescription ID invalide');
      });

      test('should not duplicate prescription ID', async () => {
        const prescriptionId = generateObjectId();

        // Link twice
        await visitGranularService.linkPrescriptionToVisit(
          testVisit._id.toString(),
          prescriptionId.toString(),
          testUser._id.toString()
        );

        const result = await visitGranularService.linkPrescriptionToVisit(
          testVisit._id.toString(),
          prescriptionId.toString(),
          testUser._id.toString()
        );

        // Should only appear once due to $addToSet
        const matchingIds = result.prescriptions.filter(
          id => id.toString() === prescriptionId.toString()
        );
        expect(matchingIds).toHaveLength(1);
      });
    });

    describe('linkIVTToVisit()', () => {
      test('should link IVT to visit successfully', async () => {
        const ivtId = generateObjectId();

        const result = await visitGranularService.linkIVTToVisit(
          testVisit._id.toString(),
          ivtId.toString(),
          testUser._id.toString()
        );

        expect(result).toBeDefined();
        expect(result.ivtTreatments).toContainEqual(ivtId);
      });

      test('should throw error for invalid IVT ID', async () => {
        await expect(
          visitGranularService.linkIVTToVisit(
            testVisit._id.toString(),
            'invalid-id',
            testUser._id.toString()
          )
        ).rejects.toThrow('IVT ID invalide');
      });
    });
  });

  // ============================================
  // INDEPENDENCE TESTS (Critical for Granular Pattern)
  // ============================================

  describe('Section Independence (CareVision Pattern)', () => {
    let testClinic;
    let testPatient;
    let testUser;
    let testVisit;

    beforeEach(async () => {
      testClinic = await Clinic.create({
        name: 'Independence Test Clinic',
        code: 'IND01',
        address: { street: 'Test', city: 'Kinshasa', country: 'CD' }
      });

      testUser = await User.create({
        email: 'independence@test.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'Doctor',
        role: 'doctor',
        clinic: testClinic._id
      });

      testPatient = await Patient.create({
        firstName: 'Independence',
        lastName: 'Test',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'female',
        clinic: testClinic._id
      });

      testVisit = await Visit.create({
        patient: testPatient._id,
        clinic: testClinic._id,
        visitType: 'consultation',
        visitDate: new Date(),
        provider: testUser._id,
        status: 'in-progress'
      });
    });

    test('should update IOP without affecting diagnosis', async () => {
      // First add diagnosis
      await visitGranularService.updateVisitDiagnosis(
        testVisit._id.toString(),
        [{ code: 'H40.0', description: 'Glaucome suspect' }],
        testUser._id.toString()
      );

      // Then update IOP
      await visitGranularService.updateVisitIOP(
        testVisit._id.toString(),
        { OD: 18, OS: 19 },
        testUser._id.toString()
      );

      // Verify diagnosis is still intact
      const updatedVisit = await Visit.findById(testVisit._id);
      expect(updatedVisit.diagnoses).toHaveLength(1);
      expect(updatedVisit.diagnoses[0].code).toBe('H40.0');
      expect(updatedVisit.examinations.iop.OD).toBe(18);
    });

    test('should update visual acuity without affecting treatment', async () => {
      // First add treatment
      await visitGranularService.updateVisitTreatment(
        testVisit._id.toString(),
        { medications: [{ name: 'Timolol', dosage: '2x/jour' }] },
        testUser._id.toString()
      );

      // Then update visual acuity
      await visitGranularService.updateVisitVisualAcuity(
        testVisit._id.toString(),
        { OD: { corrected: '10/10' }, OS: { corrected: '9/10' } },
        testUser._id.toString()
      );

      // Verify treatment is still intact
      const updatedVisit = await Visit.findById(testVisit._id);
      expect(updatedVisit.plan.medications).toHaveLength(1);
      expect(updatedVisit.plan.medications[0].name).toBe('Timolol');
      expect(updatedVisit.examinations.visualAcuity.OD.corrected).toBe('10/10');
    });

    test('should handle multiple concurrent updates independently', async () => {
      // Simulate concurrent updates to different sections
      const updates = await Promise.all([
        visitGranularService.updateVisitIOP(
          testVisit._id.toString(),
          { OD: 14, OS: 15 },
          testUser._id.toString()
        ),
        visitGranularService.updateVisitDiagnosis(
          testVisit._id.toString(),
          [{ code: 'H52.1', description: 'Myopie' }],
          testUser._id.toString()
        ),
        visitGranularService.updateVisitNotes(
          testVisit._id.toString(),
          { clinical: 'Test concurrent note' },
          testUser._id.toString()
        )
      ]);

      // All updates should succeed
      expect(updates).toHaveLength(3);

      // Final state should have all updates
      const finalVisit = await Visit.findById(testVisit._id);
      expect(finalVisit.examinations.iop.OD).toBeDefined();
      expect(finalVisit.diagnoses).toHaveLength(1);
      expect(finalVisit.notes.clinical).toBe('Test concurrent note');
    });

    test('IOP update failure should not affect other sections', async () => {
      // First add diagnosis
      await visitGranularService.updateVisitDiagnosis(
        testVisit._id.toString(),
        [{ code: 'H25.0', description: 'Cataracte senile' }],
        testUser._id.toString()
      );

      // Try invalid IOP update (should fail)
      await expect(
        visitGranularService.updateVisitIOP(
          testVisit._id.toString(),
          { OD: 100, OS: 15 }, // Invalid IOP > 60
          testUser._id.toString()
        )
      ).rejects.toThrow();

      // Verify diagnosis is still intact
      const visitAfterFailure = await Visit.findById(testVisit._id);
      expect(visitAfterFailure.diagnoses).toHaveLength(1);
      expect(visitAfterFailure.diagnoses[0].code).toBe('H25.0');
    });
  });

  // ============================================
  // AUDIT TRAIL TESTS
  // ============================================

  describe('Audit Trail', () => {
    let testClinic;
    let testPatient;
    let testUser;
    let testVisit;

    beforeEach(async () => {
      testClinic = await Clinic.create({
        name: 'Audit Test Clinic',
        code: 'AUD01',
        address: { street: 'Audit St', city: 'Kinshasa', country: 'CD' }
      });

      testUser = await User.create({
        email: 'audit@test.com',
        password: 'Test123!@#',
        firstName: 'Audit',
        lastName: 'User',
        role: 'doctor',
        clinic: testClinic._id
      });

      testPatient = await Patient.create({
        firstName: 'Audit',
        lastName: 'Patient',
        dateOfBirth: new Date('1980-03-20'),
        gender: 'male',
        clinic: testClinic._id
      });

      testVisit = await Visit.create({
        patient: testPatient._id,
        clinic: testClinic._id,
        visitType: 'consultation',
        visitDate: new Date(),
        provider: testUser._id,
        status: 'in-progress'
      });
    });

    test('all update methods should set updatedBy', async () => {
      const methods = [
        () => visitGranularService.updateVisitIOP(
          testVisit._id.toString(), { OD: 15, OS: 16 }, testUser._id.toString()
        ),
        () => visitGranularService.updateVisitDiagnosis(
          testVisit._id.toString(), [{ code: 'H40.0', description: 'Test' }], testUser._id.toString()
        ),
        () => visitGranularService.updateVisitVisualAcuity(
          testVisit._id.toString(), { OD: { corrected: '10/10' } }, testUser._id.toString()
        ),
        () => visitGranularService.updateVisitNotes(
          testVisit._id.toString(), { clinical: 'Test' }, testUser._id.toString()
        )
      ];

      for (const method of methods) {
        const result = await method();
        expect(result.updatedBy?.toString() || result.visit?.updatedBy?.toString())
          .toBe(testUser._id.toString());
      }
    });

    test('all update methods should set updatedAt', async () => {
      const beforeUpdate = new Date();

      const result = await visitGranularService.updateVisitIOP(
        testVisit._id.toString(),
        { OD: 15, OS: 16 },
        testUser._id.toString()
      );

      const afterUpdate = new Date();

      expect(result.updatedAt).toBeDefined();
      expect(result.updatedAt >= beforeUpdate).toBe(true);
      expect(result.updatedAt <= afterUpdate).toBe(true);
    });
  });
});
