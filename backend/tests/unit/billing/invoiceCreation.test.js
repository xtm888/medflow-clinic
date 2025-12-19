/**
 * Invoice Creation Tests
 *
 * Tests for invoice creation including:
 * - Multi-item invoice generation
 * - Item totals calculation
 * - Invoice summary calculation
 * - Status transitions
 * - Validation
 */

const request = require('supertest');
const app = require('../../../server');
const Invoice = require('../../../models/Invoice');
const Patient = require('../../../models/Patient');
const User = require('../../../models/User');
const { createTestPatient, createTestUser, createTestInvoice } = require('../../fixtures/generators');
const Money = require('../../../utils/money');

describe('Invoice Creation', () => {
  let testUser;
  let testPatient;
  let authCookies;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create(
      createTestUser({
        email: 'admin@medflow.com',
        username: 'adminuser',
        password: 'MgrSecure123!@#',
        role: 'admin'
      })
    );

    // Create test patient
    testPatient = await Patient.create(createTestPatient());

    // Login to get cookies
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@medflow.com',
        password: 'MgrSecure123!@#'
      });

    authCookies = loginResponse.headers['set-cookie'];
  });

  describe('POST /api/invoices', () => {
    test('should create invoice with single item', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'General Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.summary.total).toBe(5000);
      expect(response.body.data.summary.amountDue).toBe(5000);
    });

    test('should create invoice with multiple items', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'General Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          },
          {
            description: 'Eye Exam',
            category: 'examination',
            quantity: 1,
            unitPrice: 3000
          },
          {
            description: 'Paracetamol 500mg x20',
            category: 'medication',
            quantity: 2,
            unitPrice: 1500
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBe(3);

      // Total = 5000 + 3000 + (2 * 1500) = 11000
      expect(response.body.data.summary.total).toBe(11000);
      expect(response.body.data.summary.amountDue).toBe(11000);
      expect(response.body.data.summary.amountPaid).toBe(0);
    });

    test('should calculate item subtotals correctly', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service A',
            category: 'consultation',
            quantity: 3,
            unitPrice: 1000
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      const item = response.body.data.items[0];
      expect(item.subtotal).toBe(3000); // 3 * 1000
      expect(item.total).toBe(3000);
    });

    test('should apply item discounts correctly', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service with Discount',
            category: 'consultation',
            quantity: 1,
            unitPrice: 10000,
            discount: 2000 // 2000 CDF discount
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      const item = response.body.data.items[0];
      expect(item.subtotal).toBe(10000);
      expect(item.total).toBe(8000); // 10000 - 2000
      expect(response.body.data.summary.total).toBe(8000);
    });

    test('should apply item tax correctly', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Taxable Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 10000,
            tax: 1600 // 16% VAT
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      const item = response.body.data.items[0];
      expect(item.total).toBe(11600); // 10000 + 1600
      expect(response.body.data.summary.taxTotal).toBe(1600);
    });

    test('should set initial status to issued', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(response.body.data.status).toBe('issued');
    });

    test('should generate unique invoice ID', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ]
      };

      const response1 = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      const response2 = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(response1.body.data.invoiceId).not.toBe(response2.body.data.invoiceId);
    });

    test('should return 404 for non-existent patient', async () => {
      const invoiceData = {
        patient: '507f1f77bcf86cd799439011', // Non-existent ID
        items: [
          {
            description: 'Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should return 401 without authentication', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ]
      };

      await request(app).post('/api/invoices').send(invoiceData).expect(401);
    });

    test('should set createdBy to current user', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(response.body.data.createdBy).toBe(testUser._id.toString());
    });

    test('should add invoice to patient records', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      const patient = await Patient.findById(testPatient._id);
      expect(patient.invoices).toContainEqual(
        expect.objectContaining({
          toString: expect.any(Function)
        })
      );
    });

    test('should set due date if provided', async () => {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Service',
            category: 'consultation',
            quantity: 1,
            unitPrice: 5000
          }
        ],
        dueDate
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(new Date(response.body.data.dueDate).toDateString()).toBe(dueDate.toDateString());
    });
  });

  describe('Invoice Summary Calculations', () => {
    test('should calculate subtotal as sum of item subtotals', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          { description: 'Item 1', category: 'consultation', quantity: 2, unitPrice: 1000 },
          { description: 'Item 2', category: 'medication', quantity: 3, unitPrice: 500 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      // subtotal = (2*1000) + (3*500) = 2000 + 1500 = 3500
      expect(response.body.data.summary.subtotal).toBe(3500);
    });

    test('should calculate discountTotal as sum of item discounts', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          { description: 'Item 1', category: 'consultation', quantity: 1, unitPrice: 1000, discount: 100 },
          { description: 'Item 2', category: 'medication', quantity: 1, unitPrice: 500, discount: 50 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(response.body.data.summary.discountTotal).toBe(150);
    });

    test('should calculate taxTotal as sum of item taxes', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          { description: 'Item 1', category: 'consultation', quantity: 1, unitPrice: 1000, tax: 160 },
          { description: 'Item 2', category: 'medication', quantity: 1, unitPrice: 500, tax: 80 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      expect(response.body.data.summary.taxTotal).toBe(240);
    });

    test('should calculate total correctly with discount and tax', async () => {
      const invoiceData = {
        patient: testPatient._id,
        items: [
          {
            description: 'Complex Item',
            category: 'consultation',
            quantity: 2,
            unitPrice: 5000,
            discount: 1000,
            tax: 800
          }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send(invoiceData)
        .expect(201);

      // subtotal = 2 * 5000 = 10000
      // after discount = 10000 - 1000 = 9000
      // with tax = 9000 + 800 = 9800
      expect(response.body.data.summary.total).toBe(9800);
      expect(response.body.data.summary.amountDue).toBe(9800);
    });
  });

  describe('Money Utility Integration', () => {
    test('should use integer math for calculations (no floating point errors)', () => {
      // Classic floating point problem: 0.1 + 0.2 !== 0.3
      // With integer math, we avoid this

      const item1 = 3333;
      const item2 = 3333;
      const item3 = 3334;

      const total = Money.add(item1, item2, item3);
      expect(total).toBe(10000);

      // Test percentage doesn't lose precision
      const percentage = Money.percentage(10000, 16);
      expect(percentage).toBe(1600); // Exactly 16%

      const afterTax = Money.add(10000, percentage);
      expect(afterTax).toBe(11600);
    });

    test('should calculate coverage splits correctly', () => {
      const total = 10000;
      const coveragePercent = 80; // 80% company, 20% patient

      const coverage = Money.calculateCoverage(total, coveragePercent);

      expect(coverage.companyShare).toBe(8000);
      expect(coverage.patientShare).toBe(2000);
      expect(coverage.total).toBe(10000);
      expect(Money.add(coverage.companyShare, coverage.patientShare)).toBe(total);
    });

    test('should handle odd percentage splits without rounding errors', () => {
      // 33% of 10000 should be exactly 3300
      const amount = 10000;
      const percentage = 33;

      const result = Money.percentage(amount, percentage);
      expect(result).toBe(3300);

      // Verify the remainder is also correct
      const remainder = Money.subtract(amount, result);
      expect(remainder).toBe(6700);

      // Sum should equal original
      expect(Money.add(result, remainder)).toBe(amount);
    });
  });
});
