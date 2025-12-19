/**
 * Money Utility - Safe Financial Calculations
 *
 * Provides integer-based arithmetic for financial calculations to avoid
 * floating-point precision issues (e.g., 0.1 + 0.2 !== 0.3 in JavaScript).
 *
 * Key principles:
 * - All internal calculations use integers (smallest currency unit)
 * - CDF (Congolese Franc): No decimals, 1 unit = 1 franc
 * - USD/EUR: 2 decimals, 1 unit = 1 cent, 100 cents = $1
 *
 * Usage:
 *   const Money = require('./utils/money');
 *   const total = Money.add(1000, 2500, 500); // 4000
 *   const tax = Money.percentage(4000, 16); // 640 (16% of 4000)
 */

// Currency configuration
const CURRENCY_CONFIG = {
  CDF: { decimals: 0, symbol: 'FC', name: 'Congolese Franc' },
  USD: { decimals: 2, symbol: '$', name: 'US Dollar' },
  EUR: { decimals: 2, symbol: '€', name: 'Euro' }
};

const Money = {
  /**
   * Get currency configuration
   * @param {string} currency - Currency code (CDF, USD, EUR)
   * @returns {object} Currency config
   */
  getConfig(currency = 'CDF') {
    return CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.CDF;
  },

  /**
   * Convert display amount to storage integer
   * @param {number} amount - Display amount (e.g., 19.99 for USD)
   * @param {string} currency - Currency code
   * @returns {number} Integer amount for storage
   */
  toStorage(amount, currency = 'CDF') {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 0;
    }
    const config = this.getConfig(currency);
    const multiplier = Math.pow(10, config.decimals);
    return Math.round(Number(amount) * multiplier);
  },

  /**
   * Convert storage integer to display amount
   * @param {number} amount - Integer storage amount
   * @param {string} currency - Currency code
   * @returns {number} Display amount
   */
  toDisplay(amount, currency = 'CDF') {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 0;
    }
    const config = this.getConfig(currency);
    const divisor = Math.pow(10, config.decimals);
    return Number(amount) / divisor;
  },

  /**
   * Safe addition of multiple amounts
   * @param {...number} amounts - Amounts to add
   * @returns {number} Sum as integer
   */
  add(...amounts) {
    return amounts.reduce((sum, amount) => {
      const value = Number(amount) || 0;
      return sum + Math.round(value);
    }, 0);
  },

  /**
   * Safe subtraction
   * @param {number} a - Minuend
   * @param {number} b - Subtrahend
   * @returns {number} Difference as integer
   */
  subtract(a, b) {
    return Math.round(Number(a) || 0) - Math.round(Number(b) || 0);
  },

  /**
   * Safe multiplication
   * @param {number} amount - Base amount
   * @param {number} multiplier - Multiplier
   * @returns {number} Product as integer
   */
  multiply(amount, multiplier) {
    return Math.round((Number(amount) || 0) * (Number(multiplier) || 0));
  },

  /**
   * Safe division (rounds to nearest integer)
   * @param {number} amount - Dividend
   * @param {number} divisor - Divisor
   * @returns {number} Quotient as integer
   */
  divide(amount, divisor) {
    if (!divisor || divisor === 0) return 0;
    return Math.round((Number(amount) || 0) / Number(divisor));
  },

  /**
   * Calculate percentage of amount
   * @param {number} amount - Base amount
   * @param {number} percent - Percentage (0-100)
   * @returns {number} Percentage amount as integer
   */
  percentage(amount, percent) {
    if (!amount || !percent) return 0;
    return Math.round((Number(amount) * Number(percent)) / 100);
  },

  /**
   * Calculate what percentage one amount is of another
   * @param {number} part - Part amount
   * @param {number} total - Total amount
   * @returns {number} Percentage (0-100)
   */
  percentageOf(part, total) {
    if (!total || total === 0) return 0;
    return Math.round((Number(part) * 100) / Number(total));
  },

  /**
   * Apply discount (percentage)
   * @param {number} amount - Original amount
   * @param {number} discountPercent - Discount percentage (0-100)
   * @returns {number} Discounted amount as integer
   */
  applyDiscount(amount, discountPercent) {
    const discount = this.percentage(amount, discountPercent);
    return this.subtract(amount, discount);
  },

  /**
   * Add tax/VAT to amount
   * @param {number} amount - Net amount
   * @param {number} taxPercent - Tax percentage
   * @returns {object} { net, tax, gross }
   */
  addTax(amount, taxPercent) {
    const net = Math.round(Number(amount) || 0);
    const tax = this.percentage(net, taxPercent);
    const gross = this.add(net, tax);
    return { net, tax, gross };
  },

  /**
   * Extract tax from gross amount (reverse calculation)
   * @param {number} gross - Gross amount (tax-inclusive)
   * @param {number} taxPercent - Tax percentage
   * @returns {object} { net, tax, gross }
   */
  extractTax(gross, taxPercent) {
    const grossAmount = Math.round(Number(gross) || 0);
    const taxRate = Number(taxPercent) || 0;
    // net = gross / (1 + taxRate/100)
    const net = Math.round(grossAmount / (1 + taxRate / 100));
    const tax = this.subtract(grossAmount, net);
    return { net, tax, gross: grossAmount };
  },

  /**
   * Split amount evenly (handles remainder)
   * @param {number} amount - Amount to split
   * @param {number} parts - Number of parts
   * @returns {number[]} Array of parts (first part gets remainder)
   */
  split(amount, parts) {
    if (!parts || parts <= 0) return [];
    const total = Math.round(Number(amount) || 0);
    const base = Math.floor(total / parts);
    const remainder = total - (base * parts);

    return Array.from({ length: parts }, (_, i) =>
      i === 0 ? base + remainder : base
    );
  },

  /**
   * Sum multiple amounts safely
   * @param {number[]} amounts - Array of amounts
   * @returns {number} Total as integer
   */
  sum(amounts) {
    if (!Array.isArray(amounts)) return 0;
    return amounts.reduce((total, amount) => {
      return total + Math.round(Number(amount) || 0);
    }, 0);
  },

  /**
   * Round to currency precision
   * @param {number} amount - Amount to round
   * @param {string} currency - Currency code
   * @returns {number} Rounded display amount
   */
  round(amount, currency = 'CDF') {
    const config = this.getConfig(currency);
    const factor = Math.pow(10, config.decimals);
    return Math.round(Number(amount) * factor) / factor;
  },

  /**
   * Format amount for display
   * @param {number} amount - Amount (in storage format)
   * @param {string} currency - Currency code
   * @param {object} options - Formatting options
   * @returns {string} Formatted string
   */
  format(amount, currency = 'CDF', options = {}) {
    const config = this.getConfig(currency);
    const displayAmount = this.toDisplay(amount, currency);

    const formatter = new Intl.NumberFormat(options.locale || 'fr-CD', {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    });

    const formatted = formatter.format(displayAmount);

    if (options.includeSymbol !== false) {
      return currency === 'CDF'
        ? `${formatted} ${config.symbol}`
        : `${config.symbol}${formatted}`;
    }

    return formatted;
  },

  /**
   * Compare two amounts
   * @param {number} a - First amount
   * @param {number} b - Second amount
   * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
   */
  compare(a, b) {
    const aInt = Math.round(Number(a) || 0);
    const bInt = Math.round(Number(b) || 0);
    if (aInt < bInt) return -1;
    if (aInt > bInt) return 1;
    return 0;
  },

  /**
   * Check if amount is zero
   * @param {number} amount - Amount to check
   * @returns {boolean}
   */
  isZero(amount) {
    return Math.round(Number(amount) || 0) === 0;
  },

  /**
   * Check if amount is positive
   * @param {number} amount - Amount to check
   * @returns {boolean}
   */
  isPositive(amount) {
    return Math.round(Number(amount) || 0) > 0;
  },

  /**
   * Check if amount is negative
   * @param {number} amount - Amount to check
   * @returns {boolean}
   */
  isNegative(amount) {
    return Math.round(Number(amount) || 0) < 0;
  },

  /**
   * Get absolute value
   * @param {number} amount - Amount
   * @returns {number} Absolute value as integer
   */
  abs(amount) {
    return Math.abs(Math.round(Number(amount) || 0));
  },

  /**
   * Get minimum of amounts
   * @param {...number} amounts - Amounts to compare
   * @returns {number} Minimum value
   */
  min(...amounts) {
    return Math.min(...amounts.map(a => Math.round(Number(a) || 0)));
  },

  /**
   * Get maximum of amounts
   * @param {...number} amounts - Amounts to compare
   * @returns {number} Maximum value
   */
  max(...amounts) {
    return Math.max(...amounts.map(a => Math.round(Number(a) || 0)));
  },

  /**
   * Calculate coverage split for insurance
   * @param {number} total - Total amount
   * @param {number} coveragePercent - Coverage percentage (0-100)
   * @returns {object} { patientShare, companyShare, total }
   */
  calculateCoverage(total, coveragePercent) {
    const totalAmount = Math.round(Number(total) || 0);
    const coverage = Number(coveragePercent) || 0;

    const companyShare = this.percentage(totalAmount, coverage);
    const patientShare = this.subtract(totalAmount, companyShare);

    return {
      patientShare,
      companyShare,
      total: totalAmount,
      coveragePercent: coverage
    };
  }
};

module.exports = Money;
