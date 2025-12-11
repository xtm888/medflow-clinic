import { memo } from 'react';
import PropTypes from 'prop-types';
import { FileText, DollarSign, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Invoice Detail Component
 * Modal view for viewing invoice details
 */
const InvoiceDetail = memo(({
  invoice,
  clinicName,
  clinicAddress,
  clinicPhone,
  invoiceCategories,
  groupItemsByCategory,
  onClose,
  onPrint,
  onOpenPaymentModal
}) => {
  if (!invoice) return null;

  const getStatusBadge = (status) => {
    const badges = {
      'PAID': 'badge badge-success',
      'PARTIAL': 'badge badge-warning',
      'PENDING': 'badge bg-blue-100 text-blue-800',
      'OVERDUE': 'badge badge-danger',
      'CANCELLED': 'badge bg-gray-100 text-gray-800',
      'DRAFT': 'badge bg-yellow-100 text-yellow-800'
    };
    return badges[status] || 'badge';
  };

  const getStatusText = (status) => {
    const texts = {
      'PAID': 'Payé',
      'PARTIAL': 'Partiel',
      'PENDING': 'En attente',
      'OVERDUE': 'En retard',
      'CANCELLED': 'Annulé',
      'DRAFT': 'Brouillon'
    };
    return texts[status] || status;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Facture {invoice.invoiceNumber}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        </div>
        <div className="p-6">
          <div className="flex justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg mb-2">{clinicName}</h3>
              <p className="text-sm text-gray-600">{clinicAddress}</p>
              <p className="text-sm text-gray-600">Tél: {clinicPhone}</p>
            </div>
            <div className="text-right">
              <span className={`${getStatusBadge(invoice.status)} text-lg`}>{getStatusText(invoice.status)}</span>
              <p className="text-sm text-gray-600 mt-2">Date: {format(new Date(invoice.date), 'dd MMMM yyyy', { locale: fr })}</p>
              <p className="text-sm text-gray-600">Échéance: {format(new Date(invoice.dueDate), 'dd MMMM yyyy', { locale: fr })}</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded">
            <p className="text-sm font-medium text-gray-500 mb-2">Facturer à:</p>
            <p className="font-semibold">{invoice.patientName || 'Patient'}</p>
          </div>

          {/* Grouped Items by Category */}
          {Object.entries(groupItemsByCategory(invoice.items)).map(([catKey, items]) => {
            const config = invoiceCategories[catKey] || { labelFr: 'Autre', lightBg: 'bg-gray-50', textColor: 'text-gray-700' };
            const Icon = config.icon || FileText;

            return (
              <div key={catKey} className={`mb-4 ${config.lightBg} rounded-lg p-4`}>
                <div className="flex items-center space-x-2 mb-3">
                  <Icon className={`h-5 w-5 ${config.textColor}`} />
                  <h4 className={`font-semibold ${config.textColor}`}>{config.labelFr}</h4>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-600">
                      <th className="pb-2">Description</th>
                      <th className="pb-2 text-center">Qté</th>
                      <th className="pb-2 text-right">Prix</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-200">
                        <td className="py-2">{item.description || item.serviceName}</td>
                        <td className="py-2 text-center">{item.quantity || 1}</td>
                        <td className="py-2 text-right">{(item.unitPrice || 0).toLocaleString('fr-FR')} FC</td>
                        <td className="py-2 text-right font-semibold">{(item.total || 0).toLocaleString('fr-FR')} FC</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="border-t-2 pt-4 mt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between"><span>Total:</span><span className="font-bold">{invoice.total.toLocaleString('fr-FR')} FC</span></div>
                {invoice.conventionBilling && (
                  <>
                    <div className="flex justify-between text-blue-600"><span>Part entreprise:</span><span>-{(invoice.companyShare || 0).toLocaleString('fr-FR')} FC</span></div>
                    <div className="flex justify-between text-orange-600 font-bold"><span>Part patient:</span><span>{(invoice.patientShare || 0).toLocaleString('fr-FR')} FC</span></div>
                  </>
                )}
                <div className="flex justify-between text-green-600"><span>Payé:</span><span>-{invoice.amountPaid.toLocaleString('fr-FR')} FC</span></div>
                <div className="flex justify-between text-red-600 font-bold text-lg border-t pt-2"><span>Solde:</span><span>{invoice.balance.toLocaleString('fr-FR')} FC</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={() => onPrint(invoice)} className="btn btn-secondary flex items-center space-x-2">
            <Printer className="h-5 w-5" /><span>Imprimer</span>
          </button>
          {invoice.balance > 0 && invoice.status !== 'CANCELLED' && (
            <button onClick={() => { onClose(); onOpenPaymentModal(invoice); }} className="btn btn-primary flex items-center space-x-2">
              <DollarSign className="h-5 w-5" /><span>Enregistrer paiement</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

InvoiceDetail.displayName = 'InvoiceDetail';

InvoiceDetail.propTypes = {
  invoice: PropTypes.shape({
    id: PropTypes.string,
    invoiceNumber: PropTypes.string,
    patientName: PropTypes.string,
    date: PropTypes.string,
    dueDate: PropTypes.string,
    total: PropTypes.number,
    amountPaid: PropTypes.number,
    balance: PropTypes.number,
    status: PropTypes.string,
    items: PropTypes.array,
    conventionBilling: PropTypes.object,
    companyShare: PropTypes.number,
    patientShare: PropTypes.number,
  }),
  clinicName: PropTypes.string.isRequired,
  clinicAddress: PropTypes.string.isRequired,
  clinicPhone: PropTypes.string.isRequired,
  invoiceCategories: PropTypes.object.isRequired,
  groupItemsByCategory: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onPrint: PropTypes.func.isRequired,
  onOpenPaymentModal: PropTypes.func.isRequired,
};

export default InvoiceDetail;
