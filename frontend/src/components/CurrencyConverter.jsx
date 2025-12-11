import { useState, useEffect } from 'react';
import { RefreshCw, ArrowRightLeft, DollarSign, Euro, Banknote } from 'lucide-react';
import billingService from '../services/billingService';

// Currency configuration
const CURRENCIES = [
  { code: 'CDF', name: 'Franc Congolais', symbol: 'FC', icon: Banknote },
  { code: 'USD', name: 'Dollar US', symbol: '$', icon: DollarSign },
  { code: 'EUR', name: 'Euro', symbol: '€', icon: Euro }
];

/**
 * Currency Converter Widget
 * Quick currency conversion tool
 */
export default function CurrencyConverter({ compact = false }) {
  const [amount, setAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('CDF');
  const [result, setResult] = useState(null);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(true);

  // Load rates on mount
  useEffect(() => {
    loadRates();
  }, []);

  // Auto-convert when amount or currencies change
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      convertCurrency();
    } else {
      setResult(null);
    }
  }, [amount, fromCurrency, toCurrency]);

  const loadRates = async () => {
    setRatesLoading(true);
    try {
      const response = await billingService.getExchangeRates();
      setRates(response.data);
    } catch (err) {
      console.error('Failed to load rates:', err);
    } finally {
      setRatesLoading(false);
    }
  };

  const convertCurrency = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    try {
      const response = await billingService.convertCurrency(
        parseFloat(amount),
        fromCurrency,
        toCurrency
      );
      setResult(response.data);
    } catch (err) {
      console.error('Conversion failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const formatNumber = (num) => {
    return num.toLocaleString('fr-CD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getCurrencySymbol = (code) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || code;
  };

  if (compact) {
    // Compact inline version
    return (
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
        />
        <select
          value={fromCurrency}
          onChange={(e) => setFromCurrency(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.symbol}</option>
          ))}
        </select>
        <button
          onClick={swapCurrencies}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4 text-gray-500" />
        </button>
        <select
          value={toCurrency}
          onChange={(e) => setToCurrency(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.symbol}</option>
          ))}
        </select>
        {result && (
          <span className="font-mono text-sm font-semibold text-blue-600">
            = {formatNumber(result.convertedAmount)} {getCurrencySymbol(toCurrency)}
          </span>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Convertisseur de Devises
          </h3>
          <button
            onClick={loadRates}
            className="text-white/80 hover:text-white p-1"
            title="Actualiser les taux"
          >
            <RefreshCw className={`w-5 h-5 ${ratesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* From Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Montant à convertir
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Entrez un montant"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-mono"
            />
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="w-32 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white font-medium"
            >
              {CURRENCIES.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <button
            onClick={swapCurrencies}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            title="Inverser les devises"
          >
            <ArrowRightLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* To Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Devise de destination
          </label>
          <div className="flex gap-3">
            <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-lg font-mono">
              {loading ? (
                <span className="text-gray-400">Calcul...</span>
              ) : result ? (
                <span className="text-green-700 font-semibold">
                  {formatNumber(result.convertedAmount)}
                </span>
              ) : (
                <span className="text-gray-400">--</span>
              )}
            </div>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="w-32 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white font-medium"
            >
              {CURRENCIES.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Exchange Rate Info */}
        {result && (
          <div className="text-center text-sm text-gray-500 bg-gray-50 rounded-lg py-2">
            Taux: {result.rateDisplay}
          </div>
        )}
      </div>

      {/* Quick Conversion Table */}
      {rates && !ratesLoading && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Taux de change actuels</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <span className="text-gray-600">1 USD</span>
              <span className="font-mono font-semibold text-blue-700 ml-2">
                ≈ {Math.round(1 / (rates.rates?.USD?.toOthers?.CDF?.rate || 0.00036)).toLocaleString()} FC
              </span>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2 text-center">
              <span className="text-gray-600">1 EUR</span>
              <span className="font-mono font-semibold text-yellow-700 ml-2">
                ≈ {Math.round(1 / (rates.rates?.EUR?.toOthers?.CDF?.rate || 0.00033)).toLocaleString()} FC
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
