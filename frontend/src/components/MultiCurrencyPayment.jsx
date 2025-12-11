import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Euro,
  Plus,
  Trash2,
  RefreshCw,
  Calculator,
  CreditCard,
  Banknote,
  Smartphone,
  Check,
  AlertCircle
} from 'lucide-react';
import billingService from '../services/billingService';

// Currency symbols and flags
const CURRENCY_INFO = {
  CDF: { symbol: 'FC', name: 'Franc Congolais', icon: Banknote, color: 'text-green-600' },
  USD: { symbol: '$', name: 'Dollar US', icon: DollarSign, color: 'text-blue-600' },
  EUR: { symbol: '€', name: 'Euro', icon: Euro, color: 'text-yellow-600' }
};

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Espèces', icon: Banknote },
  { id: 'card', name: 'Carte', icon: CreditCard },
  { id: 'orange-money', name: 'Orange Money', icon: Smartphone },
  { id: 'mtn-money', name: 'MTN Money', icon: Smartphone },
  { id: 'wave', name: 'Wave', icon: Smartphone }
];

/**
 * Multi-Currency Payment Component
 * Allows split payments in different currencies (CDF, USD, EUR)
 */
export default function MultiCurrencyPayment({
  invoiceId,
  amountDue,
  baseCurrency = 'CDF',
  onPaymentComplete,
  onCancel
}) {
  // State
  const [payments, setPayments] = useState([
    { id: 1, amount: '', currency: 'CDF', method: 'cash' }
  ]);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [amountEquivalents, setAmountEquivalents] = useState(null);
  const [calculatedTotal, setCalculatedTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Load exchange rates on mount
  useEffect(() => {
    loadExchangeRates();
    if (invoiceId) {
      loadAmountEquivalents();
    }
  }, [invoiceId]);

  // Recalculate total when payments change
  useEffect(() => {
    if (payments.some(p => p.amount > 0)) {
      calculateTotal();
    } else {
      setCalculatedTotal(null);
    }
  }, [payments, exchangeRates]);

  const loadExchangeRates = async () => {
    try {
      setRatesLoading(true);
      const response = await billingService.getExchangeRates();
      setExchangeRates(response.data);
    } catch (err) {
      console.error('Failed to load exchange rates:', err);
      setError('Impossible de charger les taux de change');
    } finally {
      setRatesLoading(false);
    }
  };

  const loadAmountEquivalents = async () => {
    try {
      const response = await billingService.getAmountDueInCurrencies(invoiceId);
      setAmountEquivalents(response.data.equivalents);
    } catch (err) {
      console.error('Failed to load amount equivalents:', err);
    }
  };

  const calculateTotal = useCallback(async () => {
    const validPayments = payments.filter(p => p.amount > 0);
    if (validPayments.length === 0) {
      setCalculatedTotal(null);
      return;
    }

    try {
      const response = await billingService.calculateMultiCurrencyTotal(
        validPayments.map(p => ({
          amount: parseFloat(p.amount),
          currency: p.currency
        }))
      );
      setCalculatedTotal(response.data);
    } catch (err) {
      console.error('Failed to calculate total:', err);
    }
  }, [payments]);

  const addPaymentLine = () => {
    setPayments([
      ...payments,
      { id: Date.now(), amount: '', currency: 'USD', method: 'cash' }
    ]);
  };

  const removePaymentLine = (id) => {
    if (payments.length > 1) {
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  const updatePayment = (id, field, value) => {
    setPayments(payments.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSubmit = async () => {
    const validPayments = payments.filter(p => p.amount > 0);

    if (validPayments.length === 0) {
      setError('Veuillez entrer au moins un montant');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await billingService.processMultiCurrencyPayment(
        invoiceId,
        validPayments.map(p => ({
          amount: parseFloat(p.amount),
          currency: p.currency,
          method: p.method
        }))
      );

      setSuccess(true);

      if (onPaymentComplete) {
        onPaymentComplete(response.data);
      }
    } catch (err) {
      console.error('Payment failed:', err);
      setError(err.response?.data?.error || 'Échec du paiement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency) => {
    const info = CURRENCY_INFO[currency];
    return `${amount.toLocaleString('fr-CD')} ${info?.symbol || currency}`;
  };

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Paiement Réussi!</h3>
        <p className="text-gray-600 mb-4">Le paiement a été enregistré avec succès.</p>
        {calculatedTotal && (
          <p className="text-lg font-semibold text-green-600">
            Total payé: {formatCurrency(calculatedTotal.totalInBaseCurrency, 'CDF')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calculator className="w-6 h-6" />
          Paiement Multi-Devises
        </h2>
        <p className="text-blue-100 text-sm mt-1">
          Acceptez des paiements en plusieurs devises simultanément
        </p>
      </div>

      {/* Amount Due Display */}
      {amountDue > 0 && (
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Montant à payer:</span>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(amountDue, baseCurrency)}
              </div>
              {amountEquivalents && (
                <div className="flex gap-3 mt-1 text-sm text-gray-500">
                  {Object.entries(amountEquivalents).map(([currency, data]) => (
                    currency !== baseCurrency && (
                      <span key={currency}>
                        ≈ {data.formatted}
                      </span>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exchange Rates */}
      {exchangeRates && !ratesLoading && (
        <div className="px-6 py-3 bg-blue-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">Taux du jour:</span>
            <span className="font-mono">1 USD = {(1 / exchangeRates.rates?.USD?.toOthers?.CDF?.rate || 2800).toFixed(0)} FC</span>
            <span className="font-mono">1 EUR = {(1 / exchangeRates.rates?.EUR?.toOthers?.CDF?.rate || 3000).toFixed(0)} FC</span>
          </div>
          <button
            onClick={loadExchangeRates}
            className="text-blue-600 hover:text-blue-800 p-1"
            title="Actualiser les taux"
          >
            <RefreshCw className={`w-4 h-4 ${ratesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Payment Lines */}
      <div className="p-6 space-y-4">
        {payments.map((payment, index) => (
          <div key={payment.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            {/* Amount Input */}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Montant</label>
              <input
                type="number"
                value={payment.amount}
                onChange={(e) => updatePayment(payment.id, 'amount', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
              />
            </div>

            {/* Currency Select */}
            <div className="w-32">
              <label className="block text-xs text-gray-500 mb-1">Devise</label>
              <select
                value={payment.currency}
                onChange={(e) => updatePayment(payment.id, 'currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {Object.entries(CURRENCY_INFO).map(([code, info]) => (
                  <option key={code} value={code}>
                    {info.symbol} ({code})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Select */}
            <div className="w-40">
              <label className="block text-xs text-gray-500 mb-1">Méthode</label>
              <select
                value={payment.method}
                onChange={(e) => updatePayment(payment.id, 'method', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Remove Button */}
            {payments.length > 1 && (
              <button
                onClick={() => removePaymentLine(payment.id)}
                className="mt-5 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}

        {/* Add Payment Line Button */}
        <button
          onClick={addPaymentLine}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Ajouter une autre devise
        </button>
      </div>

      {/* Calculated Total */}
      {calculatedTotal && (
        <div className="px-6 py-4 bg-green-50 border-t border-green-100">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">Total en Francs Congolais:</span>
            <span className="text-2xl font-bold text-green-700">
              {formatCurrency(calculatedTotal.totalInBaseCurrency, 'CDF')}
            </span>
          </div>
          {calculatedTotal.payments && calculatedTotal.payments.length > 1 && (
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex flex-wrap gap-2">
                {calculatedTotal.payments.map((p, i) => (
                  <span key={i} className="bg-white px-2 py-1 rounded">
                    {formatCurrency(p.amount, p.currency)} = {formatCurrency(p.amountInCDF, 'CDF')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !payments.some(p => p.amount > 0)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Traitement...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Confirmer le paiement
            </>
          )}
        </button>
      </div>
    </div>
  );
}
