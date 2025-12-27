/**
 * Currency Service
 * Provides live exchange rates and multi-currency support for Congo
 * Supports: CDF (Congolese Franc), USD (US Dollar), EUR (Euro)
 */

const axios = require('axios');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Currency');

class CurrencyService {
  constructor() {
    // Supported currencies
    // CRITICAL FIX: CDF has 0 decimal places (no centimes in Congo)
    // USD and EUR have 2 decimal places
    this.currencies = {
      CDF: { code: 'CDF', name: 'Franc Congolais', symbol: 'FC', decimals: 0 },
      USD: { code: 'USD', name: 'Dollar Américain', symbol: '$', decimals: 2 },
      EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 }
    };

    // Default/base currency for the clinic
    this.baseCurrency = process.env.BASE_CURRENCY || 'CDF';

    // Cache for exchange rates (refresh every 15 minutes)
    this.rateCache = {
      rates: {},
      lastUpdated: null,
      cacheTimeout: 15 * 60 * 1000 // 15 minutes
    };

    // Fallback rates (approximate, updated manually if API fails)
    this.fallbackRates = {
      CDF: 1,
      USD: 0.00036,  // 1 CDF ≈ 0.00036 USD (1 USD ≈ 2800 CDF)
      EUR: 0.00033   // 1 CDF ≈ 0.00033 EUR (1 EUR ≈ 3000 CDF)
    };

    // API configuration (multiple sources for reliability)
    this.apiSources = [
      {
        name: 'exchangerate-api',
        url: 'https://api.exchangerate-api.com/v4/latest',
        enabled: true,
        free: true
      },
      {
        name: 'frankfurter',
        url: 'https://api.frankfurter.app/latest',
        enabled: true,
        free: true
      },
      {
        name: 'fixer',
        url: 'http://data.fixer.io/api/latest',
        apiKey: process.env.FIXER_API_KEY,
        enabled: !!process.env.FIXER_API_KEY,
        free: false
      }
    ];
  }

  /**
   * Get live exchange rates from external APIs
   */
  async fetchLiveRates(baseCurrency = 'USD') {
    // Check cache first
    if (this.isCacheValid()) {
      return this.rateCache.rates;
    }

    // Try each API source until one succeeds
    for (const source of this.apiSources) {
      if (!source.enabled) continue;

      try {
        const rates = await this.fetchFromSource(source, baseCurrency);
        if (rates) {
          this.updateCache(rates, baseCurrency);
          return this.rateCache.rates;
        }
      } catch (error) {
        log.warn(`Exchange rate API ${source.name} failed:`, error.message);
      }
    }

    // All APIs failed, use fallback rates
    log.warn('All exchange rate APIs failed, using fallback rates');
    return this.getFallbackRates();
  }

  async fetchFromSource(source, baseCurrency) {
    let url;
    const headers = {};

    switch (source.name) {
      case 'exchangerate-api':
        url = `${source.url}/${baseCurrency}`;
        break;
      case 'frankfurter':
        url = `${source.url}?from=${baseCurrency}&to=CDF,USD,EUR`;
        break;
      case 'fixer':
        url = `${source.url}?access_key=${source.apiKey}&base=${baseCurrency}&symbols=CDF,USD,EUR`;
        break;
      default:
        return null;
    }

    const response = await axios.get(url, { headers, timeout: 10000 });

    if (response.data && response.data.rates) {
      return response.data.rates;
    }

    return null;
  }

  isCacheValid() {
    if (!this.rateCache.lastUpdated) return false;
    return (Date.now() - this.rateCache.lastUpdated) < this.rateCache.cacheTimeout;
  }

  updateCache(rates, baseCurrency) {
    // Normalize rates to have CDF as base
    const normalizedRates = this.normalizeRates(rates, baseCurrency);
    this.rateCache.rates = normalizedRates;
    this.rateCache.lastUpdated = Date.now();
    this.rateCache.baseCurrency = 'CDF';
  }

  normalizeRates(rates, baseCurrency) {
    // If rates are already in CDF base, return as is
    if (baseCurrency === 'CDF') {
      return { CDF: 1, ...rates };
    }

    // Convert rates to CDF base
    const cdfRate = rates.CDF || (1 / this.fallbackRates.USD * (baseCurrency === 'USD' ? 1 : rates.USD || 1));

    return {
      CDF: 1,
      USD: rates.USD ? (rates.USD / cdfRate) : this.fallbackRates.USD,
      EUR: rates.EUR ? (rates.EUR / cdfRate) : this.fallbackRates.EUR
    };
  }

  getFallbackRates() {
    return { ...this.fallbackRates };
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return { amount, currency: toCurrency, rate: 1 };
    }

    const rates = await this.fetchLiveRates();

    // Validate rates exist and are non-zero to prevent division by zero
    const fromRate = rates[fromCurrency] || this.fallbackRates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || this.fallbackRates[toCurrency] || 1;

    if (fromRate === 0) {
      throw new Error(`Invalid exchange rate for ${fromCurrency}: rate is zero`);
    }

    // Convert to CDF first, then to target currency
    const amountInCDF = fromCurrency === 'CDF'
      ? amount
      : amount / fromRate;

    const convertedAmount = toCurrency === 'CDF'
      ? amountInCDF
      : amountInCDF * toRate;

    const effectiveRate = fromCurrency === 'CDF'
      ? toRate
      : toRate / fromRate;

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: this.roundCurrency(convertedAmount, toCurrency),
      currency: toCurrency,
      rate: effectiveRate,
      rateDisplay: `1 ${fromCurrency} = ${effectiveRate.toFixed(4)} ${toCurrency}`,
      timestamp: new Date()
    };
  }

  /**
   * Round amount based on currency decimals
   */
  roundCurrency(amount, currency) {
    const currencyInfo = this.currencies[currency] || { decimals: 2 };
    const multiplier = Math.pow(10, currencyInfo.decimals);
    return Math.round(amount * multiplier) / multiplier;
  }

  /**
   * Format amount for display
   */
  formatAmount(amount, currency) {
    const currencyInfo = this.currencies[currency] || { symbol: currency, decimals: 2 };
    const formattedNumber = amount.toLocaleString('fr-CD', {
      minimumFractionDigits: currencyInfo.decimals,
      maximumFractionDigits: currencyInfo.decimals
    });
    return `${formattedNumber} ${currencyInfo.symbol}`;
  }

  /**
   * Calculate total from multiple currency payments
   * Returns total in base currency (CDF)
   */
  async calculateMultiCurrencyTotal(payments) {
    const rates = await this.fetchLiveRates();
    let totalInCDF = 0;
    const breakdown = [];

    for (const payment of payments) {
      const { amount, currency } = payment;

      // Get rate with fallback to prevent division by zero
      const rate = rates[currency] || this.fallbackRates[currency] || 1;
      if (rate === 0) {
        log.warn(`Invalid rate for ${currency}, using fallback`);
        continue;
      }

      const amountInCDF = currency === 'CDF'
        ? amount
        : amount / rate;

      totalInCDF += amountInCDF;

      // Safe division for display rate
      const displayRate = rate !== 0 ? (1 / rate).toFixed(2) : 'N/A';

      breakdown.push({
        amount,
        currency,
        amountInCDF: this.roundCurrency(amountInCDF, 'CDF'),
        rate: rate,
        rateDisplay: `1 ${currency} = ${displayRate} CDF`
      });
    }

    return {
      totalInBaseCurrency: this.roundCurrency(totalInCDF, 'CDF'),
      baseCurrency: 'CDF',
      payments: breakdown,
      ratesUsed: rates,
      ratesTimestamp: this.rateCache.lastUpdated
    };
  }

  /**
   * Split a total amount across multiple currencies
   * Useful for calculating remaining balance in different currencies
   */
  async splitAmountAcrossCurrencies(totalCDF, currenciesToShow = ['CDF', 'USD', 'EUR']) {
    const rates = await this.fetchLiveRates();
    const equivalents = {};

    for (const currency of currenciesToShow) {
      if (currency === 'CDF') {
        equivalents[currency] = {
          amount: this.roundCurrency(totalCDF, 'CDF'),
          formatted: this.formatAmount(totalCDF, 'CDF')
        };
      } else {
        const converted = totalCDF * rates[currency];
        equivalents[currency] = {
          amount: this.roundCurrency(converted, currency),
          formatted: this.formatAmount(converted, currency),
          rate: rates[currency]
        };
      }
    }

    return equivalents;
  }

  /**
   * Get all current exchange rates
   */
  async getAllRates() {
    const rates = await this.fetchLiveRates();
    const displayRates = {};

    // Show rates relative to 1 of each currency
    for (const currency of Object.keys(this.currencies)) {
      displayRates[currency] = {
        ...this.currencies[currency],
        toOthers: {}
      };

      for (const targetCurrency of Object.keys(this.currencies)) {
        if (currency !== targetCurrency) {
          const rate = currency === 'CDF'
            ? rates[targetCurrency]
            : targetCurrency === 'CDF'
              ? 1 / rates[currency]
              : rates[targetCurrency] / rates[currency];

          displayRates[currency].toOthers[targetCurrency] = {
            rate: rate,
            display: `1 ${currency} = ${rate.toFixed(4)} ${targetCurrency}`
          };
        }
      }
    }

    return {
      baseCurrency: 'CDF',
      rates: displayRates,
      lastUpdated: this.rateCache.lastUpdated,
      source: this.isCacheValid() ? 'live' : 'fallback'
    };
  }

  /**
   * Get supported currencies list
   */
  getSupportedCurrencies() {
    return Object.values(this.currencies);
  }

  /**
   * Validate currency code
   */
  isValidCurrency(code) {
    return !!this.currencies[code?.toUpperCase()];
  }

  /**
   * Get currency info
   */
  getCurrencyInfo(code) {
    return this.currencies[code?.toUpperCase()] || null;
  }

  /**
   * Calculate change/balance due in preferred currency
   */
  async calculateChange(totalDueCDF, paymentsReceived, preferredCurrency = 'CDF') {
    const { totalInBaseCurrency } = await this.calculateMultiCurrencyTotal(paymentsReceived);
    const balanceCDF = totalDueCDF - totalInBaseCurrency;

    if (balanceCDF === 0) {
      return {
        status: 'paid',
        balance: 0,
        currency: preferredCurrency
      };
    }

    const conversion = await this.convert(Math.abs(balanceCDF), 'CDF', preferredCurrency);

    return {
      status: balanceCDF > 0 ? 'balance_due' : 'change_due',
      balanceInCDF: this.roundCurrency(Math.abs(balanceCDF), 'CDF'),
      balance: conversion.convertedAmount,
      currency: preferredCurrency,
      formatted: this.formatAmount(conversion.convertedAmount, preferredCurrency),
      allEquivalents: await this.splitAmountAcrossCurrencies(Math.abs(balanceCDF))
    };
  }

  /**
   * Parse a payment string like "5000 CDF + 10 USD"
   */
  parsePaymentString(paymentString) {
    const payments = [];
    const parts = paymentString.split(/[+,&]/).map(s => s.trim());

    for (const part of parts) {
      // Match patterns like "5000 CDF", "10 USD", "$50", "€30"
      const amountMatch = part.match(/^([\d.,]+)\s*([A-Z]{3})?$/i);
      const symbolMatch = part.match(/^([$€])([\d.,]+)$/);

      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(',', '.'));
        const currency = (amountMatch[2] || 'CDF').toUpperCase();
        if (!isNaN(amount) && this.isValidCurrency(currency)) {
          payments.push({ amount, currency });
        }
      } else if (symbolMatch) {
        const amount = parseFloat(symbolMatch[2].replace(',', '.'));
        const currency = symbolMatch[1] === '$' ? 'USD' : 'EUR';
        if (!isNaN(amount)) {
          payments.push({ amount, currency });
        }
      }
    }

    return payments;
  }
}

module.exports = new CurrencyService();
