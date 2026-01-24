import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  FileText, CheckCircle, AlertCircle, Clock, Eye, DollarSign, Printer,
  RotateCcw, ChevronDown, ChevronRight, Building2
} from 'lucide-react';
import { safeFormatDate } from '../../utils/dateHelpers';

/**
 * Invoice List Component
 * Displays the list of invoices with expand/collapse functionality
 */
const InvoiceList = memo(({
  invoices,
  patients,
  invoiceCategories,
  filterCategory,
  canProcessRefund,
  canCancelInvoice,
  groupItemsByCategory,
  getCategoryTotals,
  onViewInvoice,
  onPrintInvoice,
  onOpenPaymentModal,
  onOpenRefundModal,
  onCancelInvoice,
  actionLoading
}) => {
  const [expandedInvoices, setExpandedInvoices] = useState({});

  const toggleInvoiceExpanded = (invoiceId) => {
    setExpandedInvoices(prev => ({
      ...prev,
      [invoiceId]: !prev[invoiceId]
    }));
  };

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

  const getStatusIcon = (status) => {
    switch(status) {
      case 'PAID': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'OVERDUE': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'PARTIAL': return <Clock className="h-5 w-5 text-orange-600" />;
      default: return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  if (invoices.length === 0) {
    return (
      <div className="card text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">Aucune facture trouvée</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => {
        const patient = patients.find(p => p.id === invoice.patientId);
        const patientName = invoice.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : 'N/A');
        const isExpanded = expandedInvoices[invoice.id];
        const groupedItems = groupItemsByCategory(invoice.items);
        const categoryTotals = getCategoryTotals(invoice.items);

        // Calculate the displayed amount based on filter
        const isFiltered = filterCategory && filterCategory !== 'all';
        const filteredCategoryTotal = isFiltered ? (categoryTotals[filterCategory] || 0) : invoice.total;
        const filteredCategoryConfig = isFiltered ? invoiceCategories[filterCategory] : null;

        return (
          <div
            key={invoice.id}
            className={`card ${
              invoice.status === 'OVERDUE' ? 'border-red-300 bg-red-50' :
              invoice.status === 'PAID' ? 'border-green-300 bg-green-50' : ''
            }`}
          >
            {/* Invoice Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  {getStatusIcon(invoice.status)}
                  <h3 className="text-lg font-bold text-gray-900">{invoice.invoiceNumber}</h3>
                  <span className={getStatusBadge(invoice.status)}>{getStatusText(invoice.status)}</span>
                  {invoice.conventionBilling && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center">
                      <Building2 className="h-3 w-3 mr-1" />
                      {invoice.conventionBilling.companyName}
                    </span>
                  )}
                </div>

                {/* Invoice Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Patient</p>
                    <p className="font-semibold text-gray-900">{patientName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium text-gray-700">{safeFormatDate(invoice.date, 'dd MMM yyyy', { fallback: 'N/A' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Échéance</p>
                    <p className={`font-medium ${invoice.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-700'}`}>
                      {safeFormatDate(invoice.dueDate, 'dd MMM yyyy', { fallback: 'N/A' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      {isFiltered ? `Total ${filteredCategoryConfig?.labelFr || ''}` : 'Total'}
                    </p>
                    <p className={`text-xl font-bold ${isFiltered ? filteredCategoryConfig?.textColor || 'text-gray-900' : 'text-gray-900'}`}>
                      {filteredCategoryTotal.toLocaleString('fr-FR')} FC
                    </p>
                    {isFiltered && (
                      <p className="text-xs text-gray-400">
                        Facture: {invoice.total.toLocaleString('fr-FR')} FC
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Solde</p>
                    <p className={`text-xl font-bold ${invoice.balance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {invoice.balance.toLocaleString('fr-FR')} FC
                    </p>
                  </div>
                </div>

                {/* Category Summary Pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(categoryTotals).map(([catKey, total]) => {
                    const config = invoiceCategories[catKey];
                    if (!config) return null;
                    const Icon = config.icon;
                    const itemCount = groupedItems[catKey]?.length || 0;

                    return (
                      <div key={catKey} className={`flex items-center space-x-1 px-3 py-1 rounded-full ${config.lightBg} ${config.textColor} text-sm`}>
                        <Icon className="h-4 w-4" />
                        <span>{config.labelFr}</span>
                        <span className="font-semibold">({itemCount})</span>
                        <span className="font-bold">{total.toLocaleString('fr-FR')}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => toggleInvoiceExpanded(invoice.id)}
                  className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span>{isExpanded ? 'Masquer les détails' : 'Voir les détails'}</span>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 space-y-4">
                    {Object.entries(groupedItems).map(([catKey, items]) => {
                      const config = invoiceCategories[catKey] || { labelFr: 'Autre', lightBg: 'bg-gray-50', borderColor: 'border-gray-200', textColor: 'text-gray-700' };
                      const Icon = config.icon || FileText;
                      const catTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);

                      return (
                        <div key={catKey} className={`${config.lightBg} ${config.borderColor} border rounded-lg p-4`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Icon className={`h-5 w-5 ${config.textColor}`} />
                              <h4 className={`font-semibold ${config.textColor}`}>{config.labelFr}</h4>
                              <span className="text-sm text-gray-500">({items.length} articles)</span>
                            </div>
                            <span className={`font-bold ${config.textColor}`}>{catTotal.toLocaleString('fr-FR')} FC</span>
                          </div>
                          <div className="space-y-2">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-white rounded p-2">
                                <div className="flex-1">
                                  <span className="text-gray-800">{item.description || item.serviceName || 'Article'}</span>
                                  <span className="text-gray-500 ml-2">x{item.quantity || 1}</span>
                                  {item.notCovered && (
                                    <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Non couvert</span>
                                  )}
                                  {item.requiresApproval && !item.hasApproval && (
                                    <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">⚠️ Délibération manquante</span>
                                  )}
                                  {item.requiresApproval && item.hasApproval && (
                                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Approuvé</span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="font-semibold text-gray-900">{(item.total || 0).toLocaleString('fr-FR')} FC</span>
                                  {invoice.conventionBilling && (item.companyShare !== undefined || item.patientShare !== undefined) && (
                                    <div className="text-xs">
                                      {item.companyShare > 0 && <span className="text-blue-600">Ent: {item.companyShare.toLocaleString('fr-FR')}</span>}
                                      {item.patientShare > 0 && <span className="ml-1 text-orange-600">Pat: {item.patientShare.toLocaleString('fr-FR')}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Convention Billing Summary */}
                    {invoice.conventionBilling && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-800 flex items-center">
                            <Building2 className="h-4 w-4 mr-2" />
                            Convention: {invoice.conventionBilling.companyName}
                          </span>
                          <span className="text-sm text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            {invoice.conventionBilling.coveragePercentage || 0}% couvert
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Part entreprise</p>
                            <p className="font-semibold text-blue-700">{(invoice.companyShare || 0).toLocaleString('fr-FR')} FC</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Part patient</p>
                            <p className="font-semibold text-orange-600">{(invoice.patientShare || 0).toLocaleString('fr-FR')} FC</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment History */}
                    {invoice.payments && invoice.payments.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Paiements:</p>
                        <div className="space-y-1">
                          {invoice.payments.map((payment, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm bg-white rounded p-2">
                              <div className="flex-1">
                                <span className="text-gray-700">{safeFormatDate(payment.date || payment.createdAt, 'dd MMM yyyy', { fallback: 'N/A' })}</span>
                                <span className="text-gray-500 ml-2">({payment.method || 'N/A'})</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-green-600">+{(payment.amount || 0).toLocaleString('fr-FR')} FC</span>
                                {invoice.status !== 'CANCELLED' && canProcessRefund && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onOpenRefundModal(invoice, idx); }}
                                    className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded flex items-center"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Rembourser
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-2 ml-2 sm:ml-4 flex-shrink-0">
                <button onClick={() => onViewInvoice(invoice)} className="btn btn-primary text-sm px-4 py-2 flex items-center space-x-2">
                  <Eye className="h-4 w-4" />
                  <span>Voir</span>
                </button>
                {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.balance > 0 && (
                  <button onClick={() => onOpenPaymentModal(invoice)} className="btn btn-success text-sm px-4 py-2 flex items-center space-x-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Payer</span>
                  </button>
                )}
                <button onClick={() => onPrintInvoice(invoice)} className="btn btn-secondary text-sm px-4 py-2 flex items-center space-x-2">
                  <Printer className="h-4 w-4" />
                  <span>Imprimer</span>
                </button>
                {invoice.status === 'PENDING' && canCancelInvoice && (
                  <button
                    onClick={() => onCancelInvoice(invoice)}
                    disabled={actionLoading[invoice.id + '_cancel']}
                    className="btn btn-danger text-sm px-4 py-2"
                  >
                    {actionLoading[invoice.id + '_cancel'] ? 'Annulation...' : 'Annuler'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

InvoiceList.displayName = 'InvoiceList';

InvoiceList.propTypes = {
  invoices: PropTypes.arrayOf(PropTypes.object).isRequired,
  patients: PropTypes.arrayOf(PropTypes.object).isRequired,
  invoiceCategories: PropTypes.object.isRequired,
  filterCategory: PropTypes.string.isRequired,
  canProcessRefund: PropTypes.bool.isRequired,
  canCancelInvoice: PropTypes.bool.isRequired,
  groupItemsByCategory: PropTypes.func.isRequired,
  getCategoryTotals: PropTypes.func.isRequired,
  onViewInvoice: PropTypes.func.isRequired,
  onPrintInvoice: PropTypes.func.isRequired,
  onOpenPaymentModal: PropTypes.func.isRequired,
  onOpenRefundModal: PropTypes.func.isRequired,
  onCancelInvoice: PropTypes.func.isRequired,
  actionLoading: PropTypes.object.isRequired,
};

export default InvoiceList;
