import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import { XCircle, Loader2, DollarSign } from 'lucide-react';

/**
 * Payment Modal Component
 * Modal for recording payments on invoices
 */
const PaymentModal = memo(({
  invoice,
  isProcessing,
  onClose,
  onProcessPayment
}) => {
  const [paymentData, setPaymentData] = useState({
    amount: invoice?.balance?.toString() || '',
    currency: 'CDF',
    exchangeRate: 1,
    method: 'cash',
    reference: '',
    notes: ''
  });

  const handleDataChange = (field, value) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!paymentData.amount) return;
    onProcessPayment(paymentData);
  };

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Enregistrer un paiement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Facture</p>
                <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Patient</p>
                <p className="font-semibold text-gray-900">{invoice.patientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="font-semibold text-gray-900">{invoice.total?.toLocaleString('fr-FR')} FC</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Solde dû</p>
                <p className="font-semibold text-red-600">{invoice.balance?.toLocaleString('fr-FR')} FC</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Devise *</label>
            <select
              value={paymentData.currency}
              onChange={(e) => handleDataChange('currency', e.target.value)}
              className="input"
            >
              <option value="CDF">🇨🇩 CDF (Franc Congolais)</option>
              <option value="USD">🇺🇸 USD (Dollar)</option>
              <option value="EUR">🇪🇺 EUR (Euro)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Montant ({paymentData.currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentData.amount}
                onChange={(e) => handleDataChange('amount', e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            {paymentData.currency !== 'CDF' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taux de change
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentData.exchangeRate}
                  onChange={(e) => handleDataChange('exchangeRate', e.target.value)}
                  className="input"
                  placeholder="2800"
                />
              </div>
            )}
          </div>

          {paymentData.currency !== 'CDF' && paymentData.amount && paymentData.exchangeRate && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Équivalent en CDF</p>
              <p className="text-2xl font-bold text-green-700">
                {(parseFloat(paymentData.amount) * parseFloat(paymentData.exchangeRate)).toLocaleString('fr-FR')} FC
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Méthode *</label>
            <select
              value={paymentData.method}
              onChange={(e) => handleDataChange('method', e.target.value)}
              className="input"
            >
              <option value="cash">Espèces</option>
              <option value="card">Carte bancaire</option>
              <option value="mobile">Mobile Money</option>
              <option value="transfer">Virement</option>
              <option value="check">Chèque</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Référence (optionnel)
            </label>
            <input
              type="text"
              value={paymentData.reference}
              onChange={(e) => handleDataChange('reference', e.target.value)}
              className="input"
              placeholder="Numéro de transaction..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isProcessing}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !paymentData.amount}
            className="btn btn-primary flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Traitement...</span>
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4" />
                <span>Enregistrer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

PaymentModal.displayName = 'PaymentModal';

PaymentModal.propTypes = {
  invoice: PropTypes.shape({
    invoiceNumber: PropTypes.string,
    patientName: PropTypes.string,
    total: PropTypes.number,
    balance: PropTypes.number,
  }),
  isProcessing: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onProcessPayment: PropTypes.func.isRequired,
};

export default PaymentModal;
