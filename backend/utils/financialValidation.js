/**
 * Financial Validation Utility
 * Provides validation and safe arithmetic for financial operations
 */

// Supported currencies and their decimal places
const CURRENCY_CONFIG = {
  CDF: { decimals: 0, symbol: 'FC', name: 'Franc Congolais' },
  USD: { decimals: 2, symbol: '$', name: 'Dollar Américain' },
  EUR: { decimals: 2, symbol: '€', name: 'Euro' }
};

// Maximum reasonable amounts (fraud prevention)
const MAX_AMOUNTS = {
  CDF: 1000000000000, // 1 trillion CDF (~$400M USD)
  USD: 500000000,     // 500 million USD
  EUR: 500000000      // 500 million EUR
};

// Exchange rate bounds (reasonable limits)
const EXCHANGE_RATE_BOUNDS = {
  'USD_CDF': { min: 1000, max: 5000 },    // Historical range ~2000-2800
  'EUR_CDF': { min: 1000, max: 6000 },    // Historical range ~2200-3100
  'USD_EUR': { min: 0.5, max: 2 }         // Historical range ~0.8-1.2
};

/**
 * Validate that a value is a valid financial amount
 * @param {*} amount - The amount to validate
 * @param {Object} options - Validation options
 * @returns {Object} - { valid: boolean, error?: string, sanitized?: number }
 */
function validateAmount(amount, options = {}) {
  const {
    allowNegative = false,
    allowZero = true,
    currency = 'CDF',
    maxAmount = null,
    minAmount = null,
    fieldName = 'Amount'
  } = options;

  // Check for null/undefined
  if (amount === null || amount === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Convert string to number if needed
  let numAmount = amount;
  if (typeof amount === 'string') {
    numAmount = parseFloat(amount.replace(/[,\s]/g, ''));
  }

  // Check for valid number
  if (typeof numAmount !== 'number') {
    return { valid: false, error: `${fieldName} must be a number` };
  }

  // Check for NaN
  if (isNaN(numAmount)) {
    return { valid: false, error: `${fieldName} is not a valid number` };
  }

  // Check for Infinity
  if (!isFinite(numAmount)) {
    return { valid: false, error: `${fieldName} must be a finite number` };
  }

  // Check for negative
  if (!allowNegative && numAmount < 0) {
    return { valid: false, error: `${fieldName} cannot be negative` };
  }

  // Check for zero
  if (!allowZero && numAmount === 0) {
    return { valid: false, error: `${fieldName} cannot be zero` };
  }

  // Check maximum amount
  const currencyMax = maxAmount || MAX_AMOUNTS[currency] || MAX_AMOUNTS.CDF;
  if (Math.abs(numAmount) > currencyMax) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum allowed (${currencyMax} ${currency})`
    };
  }

  // Check minimum amount
  if (minAmount !== null && numAmount < minAmount) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minAmount} ${currency}`
    };
  }

  // Round to appropriate decimal places
  const decimals = CURRENCY_CONFIG[currency]?.decimals ?? 2;
  const sanitized = roundToDecimals(numAmount, decimals);

  return { valid: true, sanitized };
}

/**
 * Validate exchange rate
 * @param {*} rate - The exchange rate to validate
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {Object} - { valid: boolean, error?: string, warning?: string }
 */
function validateExchangeRate(rate, fromCurrency = 'USD', toCurrency = 'CDF') {
  // Check for valid number
  if (rate === null || rate === undefined) {
    return { valid: false, error: 'Exchange rate is required' };
  }

  const numRate = parseFloat(rate);

  if (isNaN(numRate)) {
    return { valid: false, error: 'Exchange rate must be a valid number' };
  }

  if (!isFinite(numRate)) {
    return { valid: false, error: 'Exchange rate must be finite' };
  }

  if (numRate <= 0) {
    return { valid: false, error: 'Exchange rate must be positive' };
  }

  // Same currency should have rate of 1
  if (fromCurrency === toCurrency && Math.abs(numRate - 1) > 0.001) {
    return { valid: false, error: 'Exchange rate must be 1 for same currency' };
  }

  // Check reasonable bounds
  const pairKey = `${fromCurrency}_${toCurrency}`;
  const reversePairKey = `${toCurrency}_${fromCurrency}`;

  let bounds = EXCHANGE_RATE_BOUNDS[pairKey];
  let isReverse = false;

  if (!bounds && EXCHANGE_RATE_BOUNDS[reversePairKey]) {
    bounds = EXCHANGE_RATE_BOUNDS[reversePairKey];
    isReverse = true;
  }

  if (bounds) {
    const effectiveRate = isReverse ? (1 / numRate) : numRate;

    if (effectiveRate < bounds.min * 0.5) {
      return {
        valid: false,
        error: `Exchange rate ${numRate} is unreasonably low for ${fromCurrency}/${toCurrency}`
      };
    }

    if (effectiveRate > bounds.max * 2) {
      return {
        valid: false,
        error: `Exchange rate ${numRate} is unreasonably high for ${fromCurrency}/${toCurrency}`
      };
    }

    // Warn if outside normal range but not completely unreasonable
    if (effectiveRate < bounds.min || effectiveRate > bounds.max) {
      return {
        valid: true,
        warning: `Exchange rate ${numRate} is outside normal range for ${fromCurrency}/${toCurrency}`
      };
    }
  }

  return { valid: true };
}

/**
 * Round a number to specific decimal places (for currency)
 * Uses banker's rounding to minimize cumulative errors
 * @param {number} value - The value to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} - Rounded value
 */
function roundToDecimals(value, decimals = 2) {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return 0;
  }

  const multiplier = Math.pow(10, decimals);
  // Use Math.round for standard rounding
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Safe addition of financial amounts
 * @param {...number} amounts - Amounts to add
 * @returns {number} - Sum rounded to 2 decimal places
 */
function safeAdd(...amounts) {
  const sum = amounts.reduce((acc, amt) => {
    const num = parseFloat(amt) || 0;
    return acc + num;
  }, 0);
  return roundToDecimals(sum, 2);
}

/**
 * Safe subtraction of financial amounts
 * @param {number} a - First amount
 * @param {number} b - Amount to subtract
 * @returns {number} - Difference rounded to 2 decimal places
 */
function safeSubtract(a, b) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return roundToDecimals(numA - numB, 2);
}

/**
 * Safe multiplication (for quantity * price)
 * @param {number} a - First value
 * @param {number} b - Second value
 * @param {number} decimals - Decimal places for result
 * @returns {number} - Product rounded appropriately
 */
function safeMultiply(a, b, decimals = 2) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return roundToDecimals(numA * numB, decimals);
}

/**
 * Safe division (for exchange rate conversion)
 * @param {number} a - Dividend
 * @param {number} b - Divisor
 * @param {number} decimals - Decimal places for result
 * @returns {number} - Quotient rounded appropriately, or 0 if divisor is 0
 */
function safeDivide(a, b, decimals = 2) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;

  if (numB === 0) {
    console.warn('Division by zero attempted in financial calculation');
    return 0;
  }

  return roundToDecimals(numA / numB, decimals);
}

/**
 * Convert amount between currencies
 * @param {number} amount - Amount to convert
 * @param {number} exchangeRate - Exchange rate
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {Object} - { success: boolean, amount?: number, error?: string }
 */
function convertCurrency(amount, exchangeRate, fromCurrency, toCurrency) {
  // Validate amount
  const amountValidation = validateAmount(amount, {
    currency: fromCurrency,
    fieldName: 'Conversion amount'
  });

  if (!amountValidation.valid) {
    return { success: false, error: amountValidation.error };
  }

  // Same currency - no conversion needed
  if (fromCurrency === toCurrency) {
    return { success: true, amount: amountValidation.sanitized, rate: 1 };
  }

  // Validate exchange rate
  const rateValidation = validateExchangeRate(exchangeRate, fromCurrency, toCurrency);

  if (!rateValidation.valid) {
    return { success: false, error: rateValidation.error };
  }

  // Perform conversion
  const decimals = CURRENCY_CONFIG[toCurrency]?.decimals ?? 2;
  const convertedAmount = roundToDecimals(amountValidation.sanitized * exchangeRate, decimals);

  return {
    success: true,
    amount: convertedAmount,
    rate: exchangeRate,
    warning: rateValidation.warning
  };
}

/**
 * Compare two financial amounts with tolerance for floating-point errors
 * @param {number} a - First amount
 * @param {number} b - Second amount
 * @param {number} tolerance - Tolerance for comparison (default: 0.01)
 * @returns {number} - -1 if a < b, 0 if equal, 1 if a > b
 */
function compareAmounts(a, b, tolerance = 0.01) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  const diff = numA - numB;

  if (Math.abs(diff) <= tolerance) {
    return 0; // Equal within tolerance
  }

  return diff < 0 ? -1 : 1;
}

/**
 * Check if two amounts are equal within tolerance
 * @param {number} a - First amount
 * @param {number} b - Second amount
 * @param {number} tolerance - Tolerance (default: 0.01)
 * @returns {boolean}
 */
function amountsEqual(a, b, tolerance = 0.01) {
  return compareAmounts(a, b, tolerance) === 0;
}

/**
 * Calculate percentage with rounding
 * @param {number} amount - Base amount
 * @param {number} percentage - Percentage to calculate
 * @returns {number} - Calculated amount
 */
function calculatePercentage(amount, percentage) {
  const numAmount = parseFloat(amount) || 0;
  const numPercentage = parseFloat(percentage) || 0;
  return roundToDecimals((numAmount * numPercentage) / 100, 2);
}

/**
 * Validate a payment object
 * @param {Object} payment - Payment object to validate
 * @returns {Object} - { valid: boolean, errors: string[], sanitized?: Object }
 */
function validatePayment(payment) {
  const errors = [];
  const sanitized = { ...payment };

  // Validate amount
  const amountResult = validateAmount(payment.amount, {
    allowNegative: false,
    allowZero: false,
    currency: payment.currency || 'CDF',
    fieldName: 'Payment amount'
  });

  if (!amountResult.valid) {
    errors.push(amountResult.error);
  } else {
    sanitized.amount = amountResult.sanitized;
  }

  // Validate currency
  if (payment.currency && !CURRENCY_CONFIG[payment.currency]) {
    errors.push(`Unsupported currency: ${payment.currency}`);
  }

  // Validate exchange rate if provided
  if (payment.exchangeRate !== undefined && payment.exchangeRate !== 1) {
    const rateResult = validateExchangeRate(
      payment.exchangeRate,
      payment.currency || 'CDF',
      'CDF'
    );

    if (!rateResult.valid) {
      errors.push(rateResult.error);
    }
  }

  // Validate payment method
  const validMethods = [
    'cash', 'card', 'check', 'bank-transfer', 'mobile-money',
    'orange-money', 'mtn-money', 'wave', 'insurance', 'credit',
    'payment_plan', 'other', 'refund'
  ];

  if (payment.method && !validMethods.includes(payment.method)) {
    errors.push(`Invalid payment method: ${payment.method}`);
  }

  // Validate date if provided
  if (payment.date) {
    const paymentDate = new Date(payment.date);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneDayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (isNaN(paymentDate.getTime())) {
      errors.push('Invalid payment date');
    } else if (paymentDate < oneYearAgo) {
      errors.push('Payment date cannot be more than 1 year in the past');
    } else if (paymentDate > oneDayAhead) {
      errors.push('Payment date cannot be in the future');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

/**
 * Validate a refund request
 * @param {Object} refund - Refund details
 * @param {Object} invoice - Invoice being refunded
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateRefund(refund, invoice) {
  const errors = [];

  // Validate amount
  const amountResult = validateAmount(refund.amount, {
    allowNegative: false,
    allowZero: false,
    currency: invoice.billing?.currency || 'CDF',
    fieldName: 'Refund amount'
  });

  if (!amountResult.valid) {
    errors.push(amountResult.error);
  }

  // Check refund doesn't exceed amount paid
  const amountPaid = invoice.summary?.amountPaid || 0;
  if (amountResult.sanitized > amountPaid) {
    errors.push(`Refund amount (${amountResult.sanitized}) exceeds amount paid (${amountPaid})`);
  }

  // Check invoice status allows refunds
  const nonRefundableStatuses = ['draft', 'cancelled', 'voided'];
  if (nonRefundableStatuses.includes(invoice.status)) {
    errors.push(`Cannot refund invoice with status: ${invoice.status}`);
  }

  // Check reason is provided
  if (!refund.reason || refund.reason.trim().length < 3) {
    errors.push('Refund reason is required (minimum 3 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedAmount: amountResult.sanitized
  };
}

/**
 * Generate a unique payment ID
 * @param {string} prefix - Prefix for the ID
 * @returns {string} - Unique payment ID
 */
function generatePaymentId(prefix = 'PAY') {
  const crypto = require('crypto');
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

module.exports = {
  // Validation
  validateAmount,
  validateExchangeRate,
  validatePayment,
  validateRefund,

  // Safe arithmetic
  roundToDecimals,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,

  // Comparison
  compareAmounts,
  amountsEqual,

  // Currency
  convertCurrency,
  calculatePercentage,

  // Utilities
  generatePaymentId,

  // Constants
  CURRENCY_CONFIG,
  MAX_AMOUNTS,
  EXCHANGE_RATE_BOUNDS
};
