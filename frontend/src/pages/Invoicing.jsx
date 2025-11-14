import { useState } from 'react';
import { FileText, DollarSign, AlertCircle, CheckCircle, Clock, Download, Send, Plus, Search, Filter } from 'lucide-react';
import { invoices, patients, services, companies } from '../data/mockData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Invoicing() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Calculate stats
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);
  const overdueCount = invoices.filter(inv => inv.status === 'OVERDUE').length;

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const patient = patients.find(p => p.id === inv.patientId);
    const company = inv.companyId ? companies.find(c => c.id === inv.companyId) : null;

    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (patient && `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (company && company.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const badges = {
      'PAID': 'badge badge-success',
      'PARTIAL': 'badge badge-warning',
      'PENDING': 'badge bg-blue-100 text-blue-800',
      'OVERDUE': 'badge badge-danger',
      'CANCELLED': 'badge bg-gray-100 text-gray-800'
    };
    return badges[status] || 'badge';
  };

  const getStatusText = (status) => {
    const texts = {
      'PAID': 'Payé',
      'PARTIAL': 'Paiement partiel',
      'PENDING': 'En attente',
      'OVERDUE': 'En retard',
      'CANCELLED': 'Annulé'
    };
    return texts[status] || status;
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'PAID':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'OVERDUE':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'PARTIAL':
        return <Clock className="h-5 w-5 text-orange-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleDownloadPDF = (invoice) => {
    console.log('Downloading PDF for invoice:', invoice.invoiceNumber);
    // This would trigger PDF generation
  };

  const handleSendInvoice = (invoice) => {
    console.log('Sending invoice via email:', invoice.invoiceNumber);
    // This would send via email/SMS
  };

  const handleCreateNewInvoice = () => {
    setSelectedInvoice(null);
    setShowInvoiceModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Facturation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des factures et suivi des paiements
          </p>
        </div>
        <button
          onClick={handleCreateNewInvoice}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle facture</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Total facturé</p>
              <p className="text-3xl font-bold">${totalInvoiced.toFixed(2)}</p>
            </div>
            <FileText className="h-10 w-10 text-blue-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">Paiements reçus</p>
              <p className="text-3xl font-bold">${totalPaid.toFixed(2)}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100">En attente</p>
              <p className="text-3xl font-bold">${totalOutstanding.toFixed(2)}</p>
            </div>
            <Clock className="h-10 w-10 text-orange-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-100">En retard</p>
              <p className="text-3xl font-bold">{overdueCount}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-200" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro de facture, patient, entreprise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input w-full md:w-64"
          >
            <option value="all">Tous les statuts</option>
            <option value="PAID">Payé</option>
            <option value="PARTIAL">Paiement partiel</option>
            <option value="PENDING">En attente</option>
            <option value="OVERDUE">En retard</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredInvoices.map((invoice) => {
          const patient = patients.find(p => p.id === invoice.patientId);
          const company = invoice.companyId ? companies.find(c => c.id === invoice.companyId) : null;

          return (
            <div
              key={invoice.id}
              className={`card hover:shadow-lg transition ${
                invoice.status === 'OVERDUE' ? 'border-red-300 bg-red-50' :
                invoice.status === 'PAID' ? 'border-green-300 bg-green-50' :
                ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    {getStatusIcon(invoice.status)}
                    <h3 className="text-lg font-bold text-gray-900">
                      {invoice.invoiceNumber}
                    </h3>
                    <span className={getStatusBadge(invoice.status)}>
                      {getStatusText(invoice.status)}
                    </span>
                    {company && (
                      <span className="badge bg-purple-100 text-purple-800">
                        B2B: {company.name}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Patient</p>
                      <p className="font-semibold text-gray-900">
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Date d'émission</p>
                      <p className="font-medium text-gray-700">
                        {format(new Date(invoice.date), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Date d'échéance</p>
                      <p className={`font-medium ${
                        invoice.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-700'
                      }`}>
                        {format(new Date(invoice.dueDate), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Montant total</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${invoice.total.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Solde restant</p>
                      <p className={`text-xl font-bold ${
                        invoice.balance === 0 ? 'text-green-600' :
                        invoice.balance > 0 ? 'text-red-600' :
                        'text-gray-900'
                      }`}>
                        ${invoice.balance.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Invoice Items */}
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Articles:</p>
                    <div className="space-y-1">
                      {invoice.items?.length > 0 && invoice.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm bg-white rounded p-2">
                          <span className="text-gray-700">
                            {item.serviceName} <span className="text-gray-500">x {item.quantity}</span>
                          </span>
                          <span className="font-semibold text-gray-900">
                            ${item.total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment History */}
                  {invoice.payments && invoice.payments.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Paiements:</p>
                      <div className="space-y-1">
                        {invoice.payments.map((payment, idx) => (
                          <div key={idx} className="flex justify-between text-sm bg-white rounded p-2">
                            <div>
                              <span className="text-gray-700">
                                {format(new Date(payment.date), 'dd MMM yyyy', { locale: fr })}
                              </span>
                              <span className="text-gray-500 ml-2">({payment.method})</span>
                            </div>
                            <span className="font-semibold text-green-600">
                              +${payment.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {invoice.notes && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Notes: </span>
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-2 ml-4">
                  <button
                    onClick={() => handleViewInvoice(invoice)}
                    className="btn btn-primary text-sm px-4 py-2 flex items-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Voir</span>
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(invoice)}
                    className="btn btn-secondary text-sm px-4 py-2 flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>PDF</span>
                  </button>
                  {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleSendInvoice(invoice)}
                      className="btn btn-success text-sm px-4 py-2 flex items-center space-x-2"
                    >
                      <Send className="h-4 w-4" />
                      <span>Envoyer</span>
                    </button>
                  )}
                  {invoice.status === 'PENDING' && (
                    <button className="btn btn-danger text-sm px-4 py-2">
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredInvoices.length === 0 && (
        <div className="card text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Aucune facture trouvée</p>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showInvoiceModal && (selectedInvoice ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  Facture {selectedInvoice.invoiceNumber}
                </h2>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Invoice header */}
              <div className="flex justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg mb-2">MedFlow Clinic</h3>
                  <p className="text-sm text-gray-600">Avenue du Commerce, n°45, Gombe</p>
                  <p className="text-sm text-gray-600">Kinshasa, République Démocratique du Congo</p>
                  <p className="text-sm text-gray-600">Tél: +243 81 234 5678</p>
                </div>
                <div className="text-right">
                  <span className={`${getStatusBadge(selectedInvoice.status)} text-lg`}>
                    {getStatusText(selectedInvoice.status)}
                  </span>
                  <p className="text-sm text-gray-600 mt-2">
                    Date: {format(new Date(selectedInvoice.date), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-sm text-gray-600">
                    Échéance: {format(new Date(selectedInvoice.dueDate), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>

              {/* Bill to */}
              <div className="mb-6 p-4 bg-gray-50 rounded">
                <p className="text-sm font-medium text-gray-500 mb-2">Facturer à:</p>
                {patients.find(p => p.id === selectedInvoice.patientId) && (
                  <>
                    <p className="font-semibold">
                      {patients.find(p => p.id === selectedInvoice.patientId).firstName}{' '}
                      {patients.find(p => p.id === selectedInvoice.patientId).lastName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {patients.find(p => p.id === selectedInvoice.patientId).phone}
                    </p>
                  </>
                )}
              </div>

              {/* Items table */}
              <table className="w-full mb-6">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Service</th>
                    <th className="text-center p-3 text-sm font-medium text-gray-700">Qté</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Prix unitaire</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3 text-gray-900">{item.serviceName}</td>
                      <td className="p-3 text-center text-gray-700">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-700">${item.unitPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-gray-900">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan="3" className="p-3 text-right font-bold text-gray-700">Total:</td>
                    <td className="p-3 text-right font-bold text-xl text-gray-900">
                      ${selectedInvoice.total.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="3" className="p-3 text-right text-gray-600">Montant payé:</td>
                    <td className="p-3 text-right text-green-600 font-semibold">
                      -${selectedInvoice.amountPaid.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td colSpan="3" className="p-3 text-right font-bold text-gray-700">Solde restant:</td>
                    <td className="p-3 text-right font-bold text-xl text-red-600">
                      ${selectedInvoice.balance.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {selectedInvoice.notes && (
                <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-sm font-medium text-gray-700">Notes:</p>
                  <p className="text-sm text-gray-600">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => handleDownloadPDF(selectedInvoice)}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Télécharger PDF</span>
              </button>
              <button
                onClick={() => handleSendInvoice(selectedInvoice)}
                className="btn btn-primary flex items-center space-x-2"
              >
                <Send className="h-5 w-5" />
                <span>Envoyer par email</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        // New Invoice Creation Modal
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Créer une nouvelle facture</h2>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient *
                  </label>
                  <select className="input" required>
                    <option value="">Sélectionner un patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entreprise (B2B - optionnel)
                  </label>
                  <select className="input">
                    <option value="">Aucune</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'émission *
                  </label>
                  <input
                    type="date"
                    className="input"
                    defaultValue={format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'échéance *
                  </label>
                  <input
                    type="date"
                    className="input"
                    defaultValue={format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services / Articles *
                </label>
                <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{service.name}</p>
                        <p className="text-xs text-gray-500">{service.category}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-gray-700">${service.price.toFixed(2)}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Qté"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  className="input"
                  rows="3"
                  placeholder="Notes supplémentaires..."
                />
              </div>

              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total estimé:</span>
                  <span className="text-2xl font-bold text-gray-900">$0.00</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button className="btn btn-primary">
                Créer la facture
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
