import { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  Check,
  ExternalLink,
  CreditCard,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Banknote,
  Loader2
} from 'lucide-react';
import api from '../../services/apiConfig';

const PharmacyInvoiceView = ({
  isOpen,
  onClose,
  visitId,
  onItemUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoiceData, setInvoiceData] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);

  useEffect(() => {
    if (isOpen && visitId) {
      fetchPharmacyInvoice();
    }
  }, [isOpen, visitId]);

  const fetchPharmacyInvoice = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/invoices/pharmacy/${visitId}`);
      setInvoiceData(response.data.data);
    } catch (err) {
      console.error('Error fetching pharmacy invoice:', err);
      setError(err.response?.data?.error || 'Erreur lors du chargement de la facture');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkExternal = async (item) => {
    try {
      setActionLoading(`external-${item._id}`);
      await api.patch(`/invoices/${invoiceData.invoice._id}/items/${item._id}/external`, {
        isExternal: true,
        reason: 'Patient obtient ce médicament ailleurs'
      });
      await fetchPharmacyInvoice();
      onItemUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCollectPayment = async (item, amount, method = 'cash') => {
    try {
      setActionLoading(`payment-${item._id}`);
      await api.post(`/invoices/${invoiceData.invoice._id}/items/${item._id}/payment`, {
        amount,
        method
      });
      setPaymentModal(null);
      await fetchPharmacyInvoice();
      onItemUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'enregistrement du paiement');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (item) => {
    if (item.isExternal) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          <ExternalLink className="w-3 h-3 mr-1" />
          Externe
        </span>
      );
    }
    if (item.isPaid) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Payé
        </span>
      );
    }
    if (item.status === 'completed') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Check className="w-3 h-3 mr-1" />
          Délivré
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Clock className="w-3 h-3 mr-1" />
        En attente
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(amount || 0) + ' FC';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-primary-50">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-100 p-2 rounded-lg">
              <Receipt className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Facture Pharmacie</h2>
              {invoiceData?.invoice && (
                <p className="text-sm text-gray-500">
                  {invoiceData.invoice.invoiceId} - {invoiceData.invoice.patient?.firstName} {invoiceData.invoice.patient?.lastName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-800 font-medium">Erreur</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : !invoiceData?.invoice?.items?.length ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun médicament à facturer pour cette visite</p>
            </div>
          ) : (
            <>
              {/* Permissions Info */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                <strong>Actions disponibles:</strong>
                {invoiceData.canDispense && ' Délivrer'}
                {invoiceData.canMarkExternal && ' • Marquer externe'}
                {invoiceData.canCollectPayment && ' • Encaisser'}
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {invoiceData.invoice.items.map((item) => (
                  <div
                    key={item._id}
                    className={`border rounded-lg p-4 ${
                      item.isExternal ? 'bg-gray-50 border-gray-200' :
                      item.isPaid ? 'bg-green-50 border-green-200' :
                      item.status === 'completed' ? 'bg-blue-50 border-blue-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{item.description}</h4>
                          {getStatusBadge(item)}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </div>
                        {item.completedBy && (
                          <p className="text-xs text-gray-400 mt-1">
                            Délivré par: {item.completedBy.firstName} {item.completedBy.lastName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(item.total)}</p>
                        {item.paidAmount > 0 && item.paidAmount < item.total && (
                          <p className="text-xs text-green-600">
                            Payé: {formatCurrency(item.paidAmount)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {!item.isExternal && !item.isPaid && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {invoiceData.canMarkExternal && item.status !== 'completed' && (
                          <button
                            onClick={() => handleMarkExternal(item)}
                            disabled={actionLoading === `external-${item._id}`}
                            className="btn btn-sm btn-secondary text-xs"
                          >
                            {actionLoading === `external-${item._id}` ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <ExternalLink className="w-3 h-3 mr-1" />
                            )}
                            Externe
                          </button>
                        )}

                        {invoiceData.canCollectPayment && item.status === 'completed' && (
                          <button
                            onClick={() => setPaymentModal(item)}
                            className="btn btn-sm btn-primary text-xs"
                          >
                            <CreditCard className="w-3 h-3 mr-1" />
                            Encaisser
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-6 border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total médicaments</span>
                    <span className="font-medium">{formatCurrency(invoiceData.invoice.filteredSummary?.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Déjà payé</span>
                    <span className="font-medium text-green-600">{formatCurrency(invoiceData.invoice.filteredSummary?.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Externe (non facturé)</span>
                    <span className="font-medium text-gray-400">
                      {invoiceData.invoice.filteredSummary?.externalCount || 0} article(s)
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                    <span>Reste à payer</span>
                    <span className="text-primary-600">{formatCurrency(invoiceData.invoice.filteredSummary?.pendingAmount)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full btn btn-secondary"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <PaymentModal
          item={paymentModal}
          onClose={() => setPaymentModal(null)}
          onConfirm={handleCollectPayment}
          loading={actionLoading === `payment-${paymentModal._id}`}
        />
      )}
    </div>
  );
};

// Sub-component for payment
const PaymentModal = ({ item, onClose, onConfirm, loading }) => {
  const [amount, setAmount] = useState(item.total - (item.paidAmount || 0));
  const [method, setMethod] = useState('cash');

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-CD', { style: 'decimal' }).format(val || 0) + ' FC';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-bold flex items-center">
            <Banknote className="w-5 h-5 mr-2 text-green-600" />
            Encaissement
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-900">{item.description}</p>
            <p className="text-sm text-gray-500 mt-1">
              Montant dû: {formatCurrency(item.total - (item.paidAmount || 0))}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant reçu (FC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input"
              min="1"
              max={item.total - (item.paidAmount || 0)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mode de paiement
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="input"
            >
              <option value="cash">Espèces</option>
              <option value="card">Carte bancaire</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Virement</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(item, amount, method)}
            className="btn btn-primary"
            disabled={loading || amount <= 0}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PharmacyInvoiceView;
