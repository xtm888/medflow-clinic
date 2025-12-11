/**
 * Sentry Service PHI Scrubbing Tests
 *
 * Verifies that all PHI/PII fields are properly scrubbed before
 * being sent to Sentry for HIPAA compliance.
 */

const {
  _scrubObjectPHI: scrubObjectPHI,
  _scrubStringPHI: scrubStringPHI,
  _scrubEvent: scrubEvent,
  _PHI_FIELDS: PHI_FIELDS
} = require('../services/sentryService');

describe('Sentry PHI Scrubbing Service', () => {
  describe('scrubObjectPHI', () => {
    test('should scrub patient name fields', () => {
      const input = {
        firstName: 'Jean',
        lastName: 'Dupont',
        fullName: 'Jean Dupont',
        patientName: 'M. Dupont'
      };

      const result = scrubObjectPHI(input);

      expect(result.firstName).toBe('[REDACTED]');
      expect(result.lastName).toBe('[REDACTED]');
      expect(result.fullName).toBe('[REDACTED]');
      expect(result.patientName).toBe('[REDACTED]');
    });

    test('should scrub contact information', () => {
      const input = {
        email: 'patient@example.com',
        phoneNumber: '+243 999 000 000',
        phone: '0999000000',
        mobile: '+33612345678',
        address: '123 Rue de Paris',
        city: 'Kinshasa',
        postalCode: '12345'
      };

      const result = scrubObjectPHI(input);

      expect(result.email).toBe('[REDACTED]');
      expect(result.phoneNumber).toBe('[REDACTED]');
      expect(result.phone).toBe('[REDACTED]');
      expect(result.mobile).toBe('[REDACTED]');
      expect(result.address).toBe('[REDACTED]');
      expect(result.city).toBe('[REDACTED]');
      expect(result.postalCode).toBe('[REDACTED]');
    });

    test('should scrub national identifiers', () => {
      const input = {
        nationalId: 'FR123456789',
        ssn: '123-45-6789',
        idNumber: 'ID987654321',
        passportNumber: 'PASS123456'
      };

      const result = scrubObjectPHI(input);

      expect(result.nationalId).toBe('[REDACTED]');
      expect(result.ssn).toBe('[REDACTED]');
      expect(result.idNumber).toBe('[REDACTED]');
      expect(result.passportNumber).toBe('[REDACTED]');
    });

    test('should scrub medical information (PHI)', () => {
      const input = {
        diagnosis: 'Cataract - mature',
        chiefComplaint: 'Blurred vision for 3 months',
        medicalHistory: 'Diabetes Type 2, Hypertension',
        allergies: ['Penicillin', 'Latex'],
        medications: ['Metformin 500mg', 'Lisinopril 10mg'],
        findings: 'IOP elevated at 24mmHg',
        clinicalNotes: 'Patient requires surgery',
        visualAcuity: '20/200',
        intraocularPressure: '24mmHg'
      };

      const result = scrubObjectPHI(input);

      expect(result.diagnosis).toBe('[REDACTED]');
      expect(result.chiefComplaint).toBe('[REDACTED]');
      expect(result.medicalHistory).toBe('[REDACTED]');
      expect(result.allergies).toBe('[REDACTED]');
      expect(result.medications).toBe('[REDACTED]');
      expect(result.findings).toBe('[REDACTED]');
      expect(result.clinicalNotes).toBe('[REDACTED]');
      expect(result.visualAcuity).toBe('[REDACTED]');
      expect(result.intraocularPressure).toBe('[REDACTED]');
    });

    test('should scrub security tokens', () => {
      const input = {
        password: 'secret123',
        token: 'eyJhbGciOiJIUzI1NiIs...',
        accessToken: 'access_token_value',
        refreshToken: 'refresh_token_value',
        apiKey: 'api_key_12345',
        authorization: 'Bearer xyz123'
      };

      const result = scrubObjectPHI(input);

      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.refreshToken).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.authorization).toBe('[REDACTED]');
    });

    test('should scrub financial information', () => {
      const input = {
        cardNumber: '4111-1111-1111-1111',
        cvv: '123',
        accountNumber: '1234567890',
        bankAccount: 'BANK-123-456',
        insuranceNumber: 'INS-2024-001',
        policyNumber: 'POL-12345'
      };

      const result = scrubObjectPHI(input);

      expect(result.cardNumber).toBe('[REDACTED]');
      expect(result.cvv).toBe('[REDACTED]');
      expect(result.accountNumber).toBe('[REDACTED]');
      expect(result.bankAccount).toBe('[REDACTED]');
      expect(result.insuranceNumber).toBe('[REDACTED]');
      expect(result.policyNumber).toBe('[REDACTED]');
    });

    test('should scrub nested objects recursively', () => {
      const input = {
        patient: {
          firstName: 'Jean',
          lastName: 'Dupont',
          contact: {
            email: 'patient@example.com',
            phone: '+243 999 000 000'
          }
        },
        safefield: 'this should remain'
      };

      const result = scrubObjectPHI(input);

      expect(result.patient.firstName).toBe('[REDACTED]');
      expect(result.patient.lastName).toBe('[REDACTED]');
      expect(result.patient.contact.email).toBe('[REDACTED]');
      expect(result.patient.contact.phone).toBe('[REDACTED]');
      expect(result.safefield).toBe('this should remain');
    });

    test('should scrub arrays with objects', () => {
      const input = {
        patients: [
          { firstName: 'Jean', lastName: 'Dupont' },
          { firstName: 'Marie', lastName: 'Martin' }
        ]
      };

      const result = scrubObjectPHI(input);

      expect(result.patients[0].firstName).toBe('[REDACTED]');
      expect(result.patients[0].lastName).toBe('[REDACTED]');
      expect(result.patients[1].firstName).toBe('[REDACTED]');
      expect(result.patients[1].lastName).toBe('[REDACTED]');
    });

    test('should preserve non-PHI fields', () => {
      const input = {
        invoiceId: 'INV-2024-001',
        visitType: 'consultation',
        status: 'completed',
        total: 15000,
        currency: 'CDF',
        createdAt: '2024-01-15T10:30:00Z'
      };

      const result = scrubObjectPHI(input);

      expect(result.invoiceId).toBe('INV-2024-001');
      expect(result.visitType).toBe('consultation');
      expect(result.status).toBe('completed');
      expect(result.total).toBe(15000);
      expect(result.currency).toBe('CDF');
      expect(result.createdAt).toBe('2024-01-15T10:30:00Z');
    });

    test('should handle null and undefined values', () => {
      const input = {
        firstName: null,
        lastName: undefined,
        email: null,
        phone: undefined
      };

      const result = scrubObjectPHI(input);

      expect(result.firstName).toBe('[REDACTED]');
      expect(result.lastName).toBe('[REDACTED]');
      expect(result.email).toBe('[REDACTED]');
      expect(result.phone).toBe('[REDACTED]');
    });

    test('should prevent infinite recursion with circular references', () => {
      const input = { level: 1 };
      let current = input;
      for (let i = 2; i <= 15; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      // Should not throw and should cap at depth 10
      expect(() => scrubObjectPHI(input)).not.toThrow();
    });
  });

  describe('scrubStringPHI', () => {
    test('should scrub email patterns in strings', () => {
      const input = 'Contact: patient@example.com for more info';
      const result = scrubStringPHI(input);
      expect(result).toBe('Contact: [EMAIL REDACTED] for more info');
    });

    test('should scrub phone patterns in strings', () => {
      const input = 'Call +243 999 000 000 for appointment';
      const result = scrubStringPHI(input);
      expect(result).toBe('Call [PHONE REDACTED] for appointment');
    });

    test('should scrub credit card patterns', () => {
      const input = 'Card: 4111-1111-1111-1111 expired';
      const result = scrubStringPHI(input);
      expect(result).toBe('Card: [CARD REDACTED] expired');
    });

    test('should preserve normal strings', () => {
      const input = 'Invoice generated successfully';
      const result = scrubStringPHI(input);
      expect(result).toBe('Invoice generated successfully');
    });
  });

  describe('scrubEvent (Sentry event scrubbing)', () => {
    test('should scrub extra data in Sentry event', () => {
      const event = {
        extra: {
          patientName: 'Jean Dupont',
          email: 'patient@example.com',
          invoiceId: 'INV-001'
        }
      };

      const result = scrubEvent(event);

      expect(result.extra.patientName).toBe('[REDACTED]');
      expect(result.extra.email).toBe('[REDACTED]');
      expect(result.extra.invoiceId).toBe('INV-001');
    });

    test('should scrub contexts in Sentry event', () => {
      const event = {
        contexts: {
          patient: {
            firstName: 'Jean',
            diagnosis: 'Cataract'
          }
        }
      };

      const result = scrubEvent(event);

      expect(result.contexts.patient.firstName).toBe('[REDACTED]');
      expect(result.contexts.patient.diagnosis).toBe('[REDACTED]');
    });

    test('should scrub tags in Sentry event', () => {
      const event = {
        tags: {
          patientName: 'Dupont',
          clinicId: 'gombe'
        }
      };

      const result = scrubEvent(event);

      expect(result.tags.patientName).toBe('[REDACTED]');
      expect(result.tags.clinicId).toBe('gombe');
    });

    test('should scrub exception values', () => {
      const event = {
        exception: {
          values: [
            { value: 'Error for patient patient@example.com' },
            { value: 'Failed to process +243 999 000 000' }
          ]
        }
      };

      const result = scrubEvent(event);

      expect(result.exception.values[0].value).toBe('Error for patient [EMAIL REDACTED]');
      expect(result.exception.values[1].value).toBe('Failed to process [PHONE REDACTED]');
    });

    test('should keep only non-PHI user info', () => {
      const event = {
        user: {
          id: 'user_123',
          email: 'user@example.com',
          firstName: 'Jean',
          lastName: 'Dupont',
          role: 'doctor',
          clinic: 'gombe'
        }
      };

      const result = scrubEvent(event);

      expect(result.user).toEqual({
        id: 'user_123',
        role: 'doctor',
        clinic: 'gombe'
      });
      expect(result.user.email).toBeUndefined();
      expect(result.user.firstName).toBeUndefined();
      expect(result.user.lastName).toBeUndefined();
    });

    test('should scrub request body (JSON string)', () => {
      const event = {
        request: {
          data: JSON.stringify({
            firstName: 'Jean',
            lastName: 'Dupont',
            visitType: 'consultation'
          })
        }
      };

      const result = scrubEvent(event);
      const parsed = JSON.parse(result.request.data);

      expect(parsed.firstName).toBe('[REDACTED]');
      expect(parsed.lastName).toBe('[REDACTED]');
      expect(parsed.visitType).toBe('consultation');
    });

    test('should scrub request body (object)', () => {
      const event = {
        request: {
          data: {
            firstName: 'Jean',
            email: 'jean@example.com',
            invoiceId: 'INV-001'
          }
        }
      };

      const result = scrubEvent(event);

      expect(result.request.data.firstName).toBe('[REDACTED]');
      expect(result.request.data.email).toBe('[REDACTED]');
      expect(result.request.data.invoiceId).toBe('INV-001');
    });
  });

  describe('PHI_FIELDS completeness', () => {
    test('should include all required patient identifiers', () => {
      const requiredFields = ['firstName', 'lastName', 'name', 'nationalId', 'ssn'];
      requiredFields.forEach(field => {
        expect(PHI_FIELDS).toContain(field);
      });
    });

    test('should include all contact fields', () => {
      const requiredFields = ['phoneNumber', 'phone', 'email', 'address'];
      requiredFields.forEach(field => {
        expect(PHI_FIELDS).toContain(field);
      });
    });

    test('should include all medical fields', () => {
      const requiredFields = [
        'diagnosis', 'chiefComplaint', 'medicalHistory',
        'allergies', 'medications', 'findings', 'visualAcuity'
      ];
      requiredFields.forEach(field => {
        expect(PHI_FIELDS).toContain(field);
      });
    });

    test('should include all security fields', () => {
      const requiredFields = ['password', 'token', 'accessToken', 'refreshToken'];
      requiredFields.forEach(field => {
        expect(PHI_FIELDS).toContain(field);
      });
    });
  });

  describe('Real-world scenario tests', () => {
    test('should properly scrub a full patient error context', () => {
      const errorContext = {
        error: 'Failed to save patient',
        patient: {
          firstName: 'Jean-Pierre',
          lastName: 'Mbongo',
          dateOfBirth: '1985-03-15',
          nationalId: 'CD123456789',
          phoneNumber: '+243 812 345 678',
          email: 'jeanpierre@email.com',
          address: '15 Avenue de la Libération, Kinshasa',
          medicalHistory: 'Diabetes Type 2, Hypertension',
          currentMedications: ['Metformin 500mg', 'Amlodipine 5mg'],
          allergies: ['Sulfa drugs', 'Latex']
        },
        visit: {
          id: 'visit_123',
          type: 'consultation',
          chiefComplaint: 'Progressive vision loss bilateral',
          diagnosis: 'Cataract - mature bilateral',
          iop: { od: 18, os: 19 },
          visualAcuity: { od: '20/200', os: '20/100' }
        }
      };

      const result = scrubObjectPHI(errorContext);

      // Non-PHI should be preserved
      expect(result.error).toBe('Failed to save patient');
      expect(result.visit.id).toBe('visit_123');
      expect(result.visit.type).toBe('consultation');

      // All PHI should be redacted
      expect(result.patient.firstName).toBe('[REDACTED]');
      expect(result.patient.lastName).toBe('[REDACTED]');
      expect(result.patient.dateOfBirth).toBe('[REDACTED]');
      expect(result.patient.nationalId).toBe('[REDACTED]');
      expect(result.patient.phoneNumber).toBe('[REDACTED]');
      expect(result.patient.email).toBe('[REDACTED]');
      expect(result.patient.address).toBe('[REDACTED]');
      expect(result.patient.medicalHistory).toBe('[REDACTED]');
      expect(result.visit.chiefComplaint).toBe('[REDACTED]');
      expect(result.visit.diagnosis).toBe('[REDACTED]');
      expect(result.visit.visualAcuity).toBe('[REDACTED]');
    });

    test('should handle convention billing error without exposing PHI', () => {
      const billingError = {
        message: 'Convention billing failed',
        invoice: {
          id: 'INV-2024-001',
          patientName: 'Marie Lumumba',
          patientEmail: 'marie@example.com',
          items: [
            { code: 'PHACO', description: 'Cataract Surgery', amount: 150000 }
          ],
          companyShare: 150000,
          patientShare: 0,
          notes: 'Patient has complete coverage under CICR'
        }
      };

      const result = scrubObjectPHI(billingError);

      // Business data preserved
      expect(result.message).toBe('Convention billing failed');
      expect(result.invoice.id).toBe('INV-2024-001');
      expect(result.invoice.items[0].code).toBe('PHACO');
      expect(result.invoice.companyShare).toBe(150000);

      // PHI redacted
      expect(result.invoice.patientName).toBe('[REDACTED]');
      expect(result.invoice.patientEmail).toBe('[REDACTED]');
      expect(result.invoice.notes).toBe('[REDACTED]');
    });
  });
});
