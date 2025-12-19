/**
 * Payment Processing Tests
 *
 * Tests for payment handling including:
 * - Full payment
 * - Partial payments
 * - Overpayment prevention
 * - Payment status updates
 * - Multi-currency payments
 * - Refunds
 */

const request = require('supertest');
const app = require('../../../server');
const Invoice = require('../../../models/Invoice');
const Patient = require('../../../models/Patient');
const User = require('../../../models/User');
const { createTestPatient, createTestUser } = require('../../fixtures/generators');
const Money = require('../../../utils/money');

describe('Payment Processing', () => {
  let testUser;
  let testPatient;
  let authCookies;
  let testInvoice;

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

    // Create test invoice
    const invoiceResponse = await request(app)
      .post('/api/invoices')
      .set('Cookie', authCookies)
      .send({
        patient: testPatient._id,
        items: [
          {
            description: 'Consultation',
            category: 'consultation',
            quantity: 1,
            unitPrice: 10000
          }
        ]
      });

    testInvoice = invoiceResponse.body.data;
  });

  describe('POST /api/invoices/:id/payments', () => {
    test('should process full payment', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 10000,
          method: 'cash'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice.status).toBe('paid');
      expect(response.body.data.invoice.summary.amountPaid).toBe(10000);
      expect(response.body.data.invoice.summary.amountDue).toBe(0);
    });

    test('should process partial payment', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'cash'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice.status).toBe('partial');
      expect(response.body.data.invoice.summary.amountPaid).toBe(5000);
      expect(response.body.data.invoice.summary.amountDue).toBe(5000);
    });

    test('should accumulate multiple partial payments', async () => {
      // First payment
      await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 3000,
          method: 'cash'
        })
        .expect(200);

      // Second payment
      await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 4000,
          method: 'card'
        })
        .expect(200);

      // Third payment (final)
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 3000,
          method: 'mobile'
        })
        .expect(200);

      expect(response.body.data.invoice.status).toBe('paid');
      expect(response.body.data.invoice.summary.amountPaid).toBe(10000);
      expect(response.body.data.invoice.summary.amountDue).toBe(0);
      expect(response.body.data.invoice.payments.length).toBe(3);
    });

    test('should reject payment exceeding amount due', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 15000, // More than 10000 due
          method: 'cash'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/exceeds/i);
    });

    test('should reject zero amount payment', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 0,
          method: 'cash'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject negative amount payment', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: -5000,
          method: 'cash'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should record payment method', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'mobile_money'
        })
        .expect(200);

      expect(response.body.data.payment.method).toBe('mobile_money');
    });

    test('should record payment reference', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'card',
          reference: 'CARD-123456'
        })
        .expect(200);

      expect(response.body.data.payment.reference).toBe('CARD-123456');
    });

    test('should record payment notes', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'cash',
          notes: 'Patient paid with 10000 bill, returned 5000 change'
        })
        .expect(200);

      expect(response.body.data.payment.notes).toMatch(/returned 5000 change/);
    });

    test('should track who received payment', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'cash'
        })
        .expect(200);

      expect(response.body.data.payment.receivedBy).toBe(testUser._id.toString());
    });

    test('should return 404 for non-existent invoice', async () => {
      const response = await request(app)
        .post('/api/invoices/507f1f77bcf86cd799439011/payments')
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'cash'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .send({
          amount: 5000,
          method: 'cash'
        })
        .expect(401);
    });
  });

  describe('Multi-Currency Payments', () => {
    test('should process USD payment with exchange rate', async () => {
      // Create invoice with 100000 CDF total
      const invoiceResponse = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          items: [
            {
              description: 'Surgery',
              category: 'surgery',
              quantity: 1,
              unitPrice: 100000
            }
          ]
        });

      const invoice = invoiceResponse.body.data;

      // Pay $36 USD at rate 2778 CDF per USD (roughly 100000 CDF)
      const response = await request(app)
        .post(`/api/invoices/${invoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 36,
          method: 'cash',
          currency: 'USD',
          exchangeRate: 2778
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // 36 * 2778 = 100008, rounded to 100000 due to amountDue limit
      expect(response.body.data.invoice.status).toBe('paid');
    });

    test('should reject USD payment exceeding CDF equivalent due', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 100, // 100 USD
          method: 'cash',
          currency: 'USD',
          exchangeRate: 2778 // Would be 277800 CDF
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/exceeds/i);
    });
  });

  describe('Invoice Status Transitions', () => {
    test('should transition from issued to partial on partial payment', async () => {
      expect(testInvoice.status).toBe('issued');

      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'cash'
        })
        .expect(200);

      expect(response.body.data.invoice.status).toBe('partial');
    });

    test('should transition from partial to paid on final payment', async () => {
      // First partial payment
      await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'cash'
        });

      // Final payment
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          method: 'cash'
        })
        .expect(200);

      expect(response.body.data.invoice.status).toBe('paid');
    });

    test('should transition from issued to paid on full payment', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 10000,
          method: 'cash'
        })
        .expect(200);

      expect(response.body.data.invoice.status).toBe('paid');
    });
  });

  describe('POST /api/invoices/:id/refund', () => {
    beforeEach(async () => {
      // Pay the invoice first
      await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 10000,
          method: 'cash'
        });
    });

    test('should process full refund', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/refund`)
        .set('Cookie', authCookies)
        .send({
          amount: 10000,
          reason: 'Service not rendered'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('refunded');
    });

    test('should process partial refund', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/refund`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          reason: 'Partial service'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject refund without reason', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/refund`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000
        })
        .expect(400);

      expect(response.body.error).toMatch(/reason/i);
    });

    test('should reject refund exceeding paid amount', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/refund`)
        .set('Cookie', authCookies)
        .send({
          amount: 15000, // More than was paid
          reason: 'Test'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject zero amount refund', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/refund`)
        .set('Cookie', authCookies)
        .send({
          amount: 0,
          reason: 'Test'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should record refund method', async () => {
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/refund`)
        .set('Cookie', authCookies)
        .send({
          amount: 5000,
          reason: 'Partial service',
          method: 'bank_transfer'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/invoices/:id/cancel', () => {
    test('should cancel unpaid invoice', async () => {
      const response = await request(app)
        .put(`/api/invoices/${testInvoice._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Patient cancelled appointment'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    test('should reject cancellation without reason', async () => {
      const response = await request(app)
        .put(`/api/invoices/${testInvoice._id}/cancel`)
        .set('Cookie', authCookies)
        .send({})
        .expect(400);

      expect(response.body.error).toMatch(/reason/i);
    });

    test('should reject cancellation of paid invoice', async () => {
      // Pay the invoice first
      await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({
          amount: 10000,
          method: 'cash'
        });

      const response = await request(app)
        .put(`/api/invoices/${testInvoice._id}/cancel`)
        .set('Cookie', authCookies)
        .send({
          reason: 'Test'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Payment Calculations with Money Utility', () => {
    test('should calculate correct amountDue after partial payments', async () => {
      const total = 10000;
      const payment1 = 3333;
      const payment2 = 3333;

      // First payment
      await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({ amount: payment1, method: 'cash' });

      // Second payment
      const response = await request(app)
        .post(`/api/invoices/${testInvoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({ amount: payment2, method: 'cash' })
        .expect(200);

      const expectedDue = Money.subtract(total, Money.add(payment1, payment2));
      expect(response.body.data.invoice.summary.amountDue).toBe(expectedDue);
      expect(response.body.data.invoice.summary.amountDue).toBe(3334);
    });

    test('should handle exact penny amounts correctly', async () => {
      // Create invoice for an odd amount
      const invoiceResponse = await request(app)
        .post('/api/invoices')
        .set('Cookie', authCookies)
        .send({
          patient: testPatient._id,
          items: [
            {
              description: 'Service',
              category: 'consultation',
              quantity: 3,
              unitPrice: 3333 // 9999 total
            }
          ]
        });

      const invoice = invoiceResponse.body.data;

      // Pay in thirds
      await request(app)
        .post(`/api/invoices/${invoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({ amount: 3333, method: 'cash' });

      await request(app)
        .post(`/api/invoices/${invoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({ amount: 3333, method: 'cash' });

      const response = await request(app)
        .post(`/api/invoices/${invoice._id}/payments`)
        .set('Cookie', authCookies)
        .send({ amount: 3333, method: 'cash' })
        .expect(200);

      expect(response.body.data.invoice.status).toBe('paid');
      expect(response.body.data.invoice.summary.amountDue).toBe(0);
    });
  });
});
