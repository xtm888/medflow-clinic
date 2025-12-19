/**
 * Tax Calculation Tests
 *
 * Tests for tax handling including:
 * - Tax rate application
 * - Tax extraction from gross
 * - Convention coverage splits
 * - Multi-currency handling
 */

const Money = require('../../../utils/money');

describe('Tax Calculations', () => {
  describe('Money.addTax', () => {
    test('should calculate 16% VAT correctly', () => {
      const net = 10000;
      const taxPercent = 16;

      const result = Money.addTax(net, taxPercent);

      expect(result.net).toBe(10000);
      expect(result.tax).toBe(1600);
      expect(result.gross).toBe(11600);
    });

    test('should calculate 0% tax correctly', () => {
      const net = 10000;
      const taxPercent = 0;

      const result = Money.addTax(net, taxPercent);

      expect(result.net).toBe(10000);
      expect(result.tax).toBe(0);
      expect(result.gross).toBe(10000);
    });

    test('should calculate 5.5% tax correctly (odd percentage)', () => {
      const net = 10000;
      const taxPercent = 5.5;

      const result = Money.addTax(net, taxPercent);

      expect(result.net).toBe(10000);
      expect(result.tax).toBe(550);
      expect(result.gross).toBe(10550);
    });

    test('should handle null net amount', () => {
      const result = Money.addTax(null, 16);

      expect(result.net).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.gross).toBe(0);
    });

    test('should handle null tax rate', () => {
      const result = Money.addTax(10000, null);

      expect(result.net).toBe(10000);
      expect(result.tax).toBe(0);
      expect(result.gross).toBe(10000);
    });
  });

  describe('Money.extractTax', () => {
    test('should extract 16% VAT from gross amount', () => {
      const gross = 11600;
      const taxPercent = 16;

      const result = Money.extractTax(gross, taxPercent);

      expect(result.gross).toBe(11600);
      expect(result.net).toBe(10000);
      expect(result.tax).toBe(1600);
    });

    test('should handle 0% tax extraction', () => {
      const gross = 10000;
      const taxPercent = 0;

      const result = Money.extractTax(gross, taxPercent);

      expect(result.net).toBe(10000);
      expect(result.tax).toBe(0);
    });

    test('should handle 20% tax extraction', () => {
      const gross = 12000;
      const taxPercent = 20;

      const result = Money.extractTax(gross, taxPercent);

      // net = 12000 / 1.20 = 10000
      expect(result.net).toBe(10000);
      expect(result.tax).toBe(2000);
    });

    test('should round to nearest integer', () => {
      const gross = 11599;
      const taxPercent = 16;

      const result = Money.extractTax(gross, taxPercent);

      // net = 11599 / 1.16 ≈ 9999.14
      expect(result.net).toBe(9999);
      expect(result.tax).toBe(1600); // 11599 - 9999
    });
  });

  describe('Money.calculateCoverage', () => {
    test('should split 80/20 coverage correctly', () => {
      const total = 10000;
      const coveragePercent = 80;

      const result = Money.calculateCoverage(total, coveragePercent);

      expect(result.companyShare).toBe(8000);
      expect(result.patientShare).toBe(2000);
      expect(result.total).toBe(10000);
      expect(result.coveragePercent).toBe(80);
    });

    test('should split 100% coverage correctly', () => {
      const total = 10000;
      const coveragePercent = 100;

      const result = Money.calculateCoverage(total, coveragePercent);

      expect(result.companyShare).toBe(10000);
      expect(result.patientShare).toBe(0);
    });

    test('should split 0% coverage correctly', () => {
      const total = 10000;
      const coveragePercent = 0;

      const result = Money.calculateCoverage(total, coveragePercent);

      expect(result.companyShare).toBe(0);
      expect(result.patientShare).toBe(10000);
    });

    test('should handle 33% coverage (odd percentage)', () => {
      const total = 10000;
      const coveragePercent = 33;

      const result = Money.calculateCoverage(total, coveragePercent);

      expect(result.companyShare).toBe(3300);
      expect(result.patientShare).toBe(6700);
      // Verify no rounding errors
      expect(Money.add(result.companyShare, result.patientShare)).toBe(total);
    });

    test('should handle 67% coverage', () => {
      const total = 10000;
      const coveragePercent = 67;

      const result = Money.calculateCoverage(total, coveragePercent);

      expect(result.companyShare).toBe(6700);
      expect(result.patientShare).toBe(3300);
    });
  });

  describe('Money.percentage', () => {
    test('should calculate 16% correctly', () => {
      expect(Money.percentage(10000, 16)).toBe(1600);
    });

    test('should calculate 7.5% correctly', () => {
      expect(Money.percentage(10000, 7.5)).toBe(750);
    });

    test('should return 0 for 0 percentage', () => {
      expect(Money.percentage(10000, 0)).toBe(0);
    });

    test('should return 0 for 0 amount', () => {
      expect(Money.percentage(0, 16)).toBe(0);
    });

    test('should handle large amounts', () => {
      const amount = 1000000000; // 1 billion CDF
      const percent = 16;

      expect(Money.percentage(amount, percent)).toBe(160000000);
    });
  });

  describe('Money.applyDiscount', () => {
    test('should apply 10% discount', () => {
      const amount = 10000;
      const discountPercent = 10;

      const result = Money.applyDiscount(amount, discountPercent);

      expect(result).toBe(9000);
    });

    test('should apply 25% discount', () => {
      const amount = 10000;
      const discountPercent = 25;

      const result = Money.applyDiscount(amount, discountPercent);

      expect(result).toBe(7500);
    });

    test('should apply 100% discount', () => {
      const amount = 10000;
      const discountPercent = 100;

      const result = Money.applyDiscount(amount, discountPercent);

      expect(result).toBe(0);
    });

    test('should apply 0% discount', () => {
      const amount = 10000;
      const discountPercent = 0;

      const result = Money.applyDiscount(amount, discountPercent);

      expect(result).toBe(10000);
    });
  });

  describe('Money.split', () => {
    test('should split evenly into 3 parts', () => {
      const amount = 9000;
      const parts = 3;

      const result = Money.split(amount, parts);

      expect(result.length).toBe(3);
      expect(result[0]).toBe(3000);
      expect(result[1]).toBe(3000);
      expect(result[2]).toBe(3000);
      expect(Money.sum(result)).toBe(amount);
    });

    test('should handle remainder in first part', () => {
      const amount = 10000;
      const parts = 3;

      const result = Money.split(amount, parts);

      expect(result.length).toBe(3);
      // 10000 / 3 = 3333.33, so base is 3333, remainder is 1
      expect(result[0]).toBe(3334); // First gets remainder
      expect(result[1]).toBe(3333);
      expect(result[2]).toBe(3333);
      expect(Money.sum(result)).toBe(amount);
    });

    test('should split into 12 monthly payments', () => {
      const amount = 100000;
      const parts = 12;

      const result = Money.split(amount, parts);

      expect(result.length).toBe(12);
      expect(Money.sum(result)).toBe(amount);
    });

    test('should return empty array for 0 parts', () => {
      const result = Money.split(10000, 0);

      expect(result).toEqual([]);
    });
  });

  describe('Multi-Currency Tax Handling', () => {
    test('should convert USD to CDF for tax calculation', () => {
      // Price in USD: $100
      // Exchange rate: 2778 CDF per USD
      // 16% VAT

      const usdAmount = 100;
      const exchangeRate = 2778;
      const cdfAmount = Money.multiply(usdAmount, exchangeRate); // 277800 CDF

      const result = Money.addTax(cdfAmount, 16);

      expect(result.net).toBe(277800);
      expect(result.tax).toBe(44448); // 16% of 277800
      expect(result.gross).toBe(322248);
    });

    test('should round CDF amounts (no decimals)', () => {
      // CDF has no decimals
      const config = Money.getConfig('CDF');

      expect(config.decimals).toBe(0);

      // Test toStorage and toDisplay for CDF
      expect(Money.toStorage(1234.56, 'CDF')).toBe(1235);
      expect(Money.toDisplay(1235, 'CDF')).toBe(1235);
    });

    test('should handle USD with 2 decimals', () => {
      const config = Money.getConfig('USD');

      expect(config.decimals).toBe(2);

      // $19.99 stored as 1999 cents
      expect(Money.toStorage(19.99, 'USD')).toBe(1999);
      expect(Money.toDisplay(1999, 'USD')).toBe(19.99);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very small amounts', () => {
      expect(Money.percentage(100, 1)).toBe(1);
      expect(Money.percentage(10, 1)).toBe(0); // Rounds to 0
    });

    test('should handle very large amounts', () => {
      const billion = 1000000000;
      const result = Money.addTax(billion, 16);

      expect(result.gross).toBe(1160000000);
    });

    test('should handle floating point edge cases', () => {
      // Classic JS issue: 0.1 + 0.2 !== 0.3
      // Our integer math should avoid this

      const a = Money.toStorage(0.1, 'USD'); // 10 cents
      const b = Money.toStorage(0.2, 'USD'); // 20 cents
      const sum = Money.add(a, b); // 30 cents

      expect(sum).toBe(30);
      expect(Money.toDisplay(sum, 'USD')).toBe(0.30);
    });

    test('should compare amounts correctly', () => {
      expect(Money.compare(1000, 999)).toBe(1);
      expect(Money.compare(999, 1000)).toBe(-1);
      expect(Money.compare(1000, 1000)).toBe(0);
    });

    test('should check zero correctly', () => {
      expect(Money.isZero(0)).toBe(true);
      expect(Money.isZero(1)).toBe(false);
      expect(Money.isZero(-0)).toBe(true);
    });

    test('should check positive/negative correctly', () => {
      expect(Money.isPositive(100)).toBe(true);
      expect(Money.isPositive(0)).toBe(false);
      expect(Money.isPositive(-100)).toBe(false);

      expect(Money.isNegative(-100)).toBe(true);
      expect(Money.isNegative(0)).toBe(false);
      expect(Money.isNegative(100)).toBe(false);
    });

    test('should get absolute value', () => {
      expect(Money.abs(-1000)).toBe(1000);
      expect(Money.abs(1000)).toBe(1000);
      expect(Money.abs(0)).toBe(0);
    });

    test('should get min/max correctly', () => {
      expect(Money.min(100, 200, 150)).toBe(100);
      expect(Money.max(100, 200, 150)).toBe(200);
    });
  });
});
