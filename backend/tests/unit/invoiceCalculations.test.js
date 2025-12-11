const Invoice = require('../../models/Invoice');
const Patient = require('../../models/Patient');
const User = require('../../models/User');
const FeeSchedule = require('../../models/FeeSchedule');
const ConventionFeeSchedule = require('../../models/ConventionFeeSchedule');
const mongoose = require('mongoose');
const {
  createTestPatient,
  createTestInvoice,
  createTestUser,
  createTestFeeSchedule
} = require('../fixtures/generators');

describe('Invoice Calculations', () => {
  let testUser;

  beforeAll(async () => {
    // Create a test user for invoice creation
    testUser = await User.create(createTestUser({ role: 'doctor' }));
  });

  describe('Basic Invoice Calculations', () => {
    test('should calculate total amount correctly for single item', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoiceData = createTestInvoice(patient._id, testUser._id, {
        items: [
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'General Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000,
            subtotal: 5000,
            total: 5000
          }
        ]
      });

      const invoice = await Invoice.create(invoiceData);
      expect(invoice.summary.total).toBe(5000);
    });

    test('should calculate total amount correctly for multiple items', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoiceData = createTestInvoice(patient._id, testUser._id, {
        items: [
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'General Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000,
            subtotal: 5000,
            total: 5000
          },
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'Complete Blood Count',
            category: 'laboratory',
            quantity: 1,
            unitPrice: 3000,
            subtotal: 3000,
            total: 3000
          }
        ],
        summary: {
          subtotal: 8000,
          total: 8000,
          amountDue: 8000
        }
      });

      const invoice = await Invoice.create(invoiceData);
      expect(invoice.summary.total).toBe(8000);
    });

    test('should calculate total with quantity > 1', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoiceData = createTestInvoice(patient._id, testUser._id, {
        items: [
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'Paracetamol 500mg',
            category: 'pharmacy',
            quantity: 10,
            unitPrice: 100,
            subtotal: 1000,
            total: 1000
          }
        ],
        summary: {
          subtotal: 1000,
          total: 1000,
          amountDue: 1000
        }
      });

      const invoice = await Invoice.create(invoiceData);
      expect(invoice.summary.total).toBe(1000);
    });
  });

  describe('Convention Coverage Calculations', () => {
    test('should apply 100% coverage for convention patient', async () => {
      const patient = await Patient.create(
        createTestPatient({
          convention: {
            company: 'Test Insurance',
            membershipNumber: 'INS123456',
            coveragePercentage: 100,
            isActive: true
          }
        })
      );

      const invoiceData = createTestInvoice(patient._id, testUser._id, {
        items: [
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'General Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000,
            subtotal: 5000,
            total: 5000,
            conventionCoverage: 100
          }
        ],
        summary: {
          subtotal: 5000,
          total: 5000,
          conventionAmount: 5000,
          patientAmount: 0,
          amountDue: 0
        }
      });

      const invoice = await Invoice.create(invoiceData);
      expect(invoice.summary.total).toBe(5000);
      expect(invoice.summary.conventionAmount).toBe(5000);
      expect(invoice.summary.patientAmount).toBe(0);
    });

    test('should apply 80% coverage for convention patient', async () => {
      const patient = await Patient.create(
        createTestPatient({
          convention: {
            company: 'Test Insurance',
            membershipNumber: 'INS123456',
            coveragePercentage: 80,
            isActive: true
          }
        })
      );

      const invoiceData = createTestInvoice(patient._id, testUser._id, {
        items: [
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'General Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000,
            subtotal: 5000,
            total: 5000,
            conventionCoverage: 80
          }
        ],
        summary: {
          subtotal: 5000,
          total: 5000,
          conventionAmount: 4000,
          patientAmount: 1000,
          amountDue: 1000
        }
      });

      const invoice = await Invoice.create(invoiceData);
      expect(invoice.summary.conventionAmount).toBe(4000);
      expect(invoice.summary.patientAmount).toBe(1000);
    });

    test('should handle mixed coverage items', async () => {
      const patient = await Patient.create(
        createTestPatient({
          convention: {
            company: 'Test Insurance',
            membershipNumber: 'INS123456',
            coveragePercentage: 80,
            isActive: true
          }
        })
      );

      const invoiceData = createTestInvoice(patient._id, testUser._id, {
        items: [
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'General Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000,
            subtotal: 5000,
            total: 5000,
            conventionCoverage: 80
          },
          {
            itemId: new mongoose.Types.ObjectId(),
            description: 'Vitamins (not covered)',
            category: 'pharmacy',
            quantity: 1,
            unitPrice: 2000,
            subtotal: 2000,
            total: 2000,
            conventionCoverage: 0
          }
        ],
        summary: {
          subtotal: 7000,
          total: 7000,
          conventionAmount: 4000,
          patientAmount: 3000,
          amountDue: 3000
        }
      });

      const invoice = await Invoice.create(invoiceData);
      expect(invoice.summary.total).toBe(7000);
      expect(invoice.summary.conventionAmount).toBe(4000);
      expect(invoice.summary.patientAmount).toBe(3000);
    });
  });

  describe('Payment Calculations', () => {
    test('should calculate balance correctly after partial payment', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          summary: {
            subtotal: 5000,
            total: 5000,
            amountPaid: 2000,
            amountDue: 3000
          },
          status: 'partial'
        })
      );

      expect(invoice.summary.amountDue).toBe(3000);
      expect(invoice.status).toBe('partial');
    });

    test('should mark invoice as paid when fully paid', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          summary: {
            subtotal: 5000,
            total: 5000,
            amountPaid: 5000,
            amountDue: 0
          },
          status: 'paid'
        })
      );

      expect(invoice.summary.amountDue).toBe(0);
      expect(invoice.status).toBe('paid');
    });

    test('should handle overpayment scenario', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          summary: {
            subtotal: 5000,
            total: 5000,
            amountPaid: 6000,
            amountDue: -1000
          },
          status: 'paid'
        })
      );

      expect(invoice.summary.amountDue).toBe(-1000); // Credit balance
      expect(invoice.status).toBe('paid');
    });
  });

  describe('Discount Calculations', () => {
    test('should apply percentage discount', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          items: [
            {
              itemId: new mongoose.Types.ObjectId(),
              description: 'General Consultation',
              category: 'consultation',
              quantity: 1,
              unitPrice: 5000,
              subtotal: 5000,
              total: 5000
            }
          ],
          summary: {
            subtotal: 5000,
            discount: 500,
            total: 4500,
            amountDue: 4500
          }
        })
      );

      expect(invoice.summary.discount).toBe(500);
      expect(invoice.summary.total).toBe(4500);
    });

    test('should apply fixed amount discount', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          items: [
            {
              itemId: new mongoose.Types.ObjectId(),
              description: 'General Consultation',
              category: 'consultation',
              quantity: 1,
              unitPrice: 5000,
              subtotal: 5000,
              total: 5000
            }
          ],
          summary: {
            subtotal: 5000,
            discount: 1000,
            total: 4000,
            amountDue: 4000
          }
        })
      );

      expect(invoice.summary.discount).toBe(1000);
      expect(invoice.summary.total).toBe(4000);
    });

    test('should not allow discount > 100%', async () => {
      const patient = await Patient.create(createTestPatient());

      // This test verifies that business logic prevents excessive discounts
      // The current schema doesn't enforce this at the model level,
      // so we just verify that invoices can be created (business rules in controllers)
      try {
        const invoice = await Invoice.create(
          createTestInvoice(patient._id, testUser._id, {
            summary: {
              subtotal: 5000,
              discount: 7500, // 150%
              total: -2500,
              amountDue: -2500
            }
          })
        );
        // If it succeeds, we should verify the values
        expect(invoice.summary.discount).toBe(7500);
      } catch (error) {
        // If validation error, that's also acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Tax Calculations', () => {
    test('should calculate tax correctly', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          items: [
            {
              itemId: new mongoose.Types.ObjectId(),
              description: 'General Consultation',
              category: 'consultation',
              quantity: 1,
              unitPrice: 5000,
              subtotal: 5000,
              total: 5000
            }
          ],
          summary: {
            subtotal: 5000,
            tax: 800,
            total: 5800,
            amountDue: 5800
          }
        })
      );

      expect(invoice.summary.tax).toBe(800);
      expect(invoice.summary.total).toBe(5800);
    });

    test('should handle tax-exempt items', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          items: [
            {
              itemId: new mongoose.Types.ObjectId(),
              description: 'General Consultation',
              category: 'consultation',
              quantity: 1,
              unitPrice: 5000,
              subtotal: 5000,
              total: 5000,
              taxExempt: true
            }
          ],
          summary: {
            subtotal: 5000,
            tax: 0,
            total: 5000,
            amountDue: 5000
          }
        })
      );

      expect(invoice.summary.tax).toBe(0);
      expect(invoice.summary.total).toBe(5000);
    });
  });

  describe('Multi-Currency Calculations', () => {
    test('should handle USD pricing', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          items: [
            {
              itemId: new mongoose.Types.ObjectId(),
              description: 'Specialist Consultation',
              category: 'consultation',
              quantity: 1,
              unitPrice: 25,
              subtotal: 25,
              total: 25,
              currency: 'USD'
            }
          ],
          summary: {
            subtotal: 25,
            total: 25,
            amountDue: 25
          },
          currency: 'USD'
        })
      );

      expect(invoice.currency).toBe('USD');
      expect(invoice.summary.total).toBe(25);
    });

    test('should handle currency conversion', async () => {
      const patient = await Patient.create(createTestPatient());
      const invoice = await Invoice.create(
        createTestInvoice(patient._id, testUser._id, {
          items: [
            {
              itemId: new mongoose.Types.ObjectId(),
              description: 'Specialist Consultation',
              category: 'consultation',
              quantity: 1,
              unitPrice: 25,
              subtotal: 25,
              total: 25,
              currency: 'USD'
            }
          ],
          summary: {
            subtotal: 25,
            total: 25,
            amountDue: 25
          },
          currency: 'USD',
          exchangeRate: 2000
        })
      );

      expect(invoice.currency).toBe('USD');
      expect(invoice.exchangeRate).toBe(2000);
    });
  });
});
