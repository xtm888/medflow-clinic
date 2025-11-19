import { useState, useEffect } from 'react';
import { DollarSign, Download, CreditCard, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import authService from '../../services/authService';

export default function PatientBills() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);

      // Get current user
      const userResult = await authService.getCurrentUser();
      if (userResult.success && userResult.user) {
        const patientId = userResult.user.patientId || userResult.user._id;

        const response = await api.get('/invoices', {
          params: { patient: patientId, limit: 50 }
        });

        const invoiceData = response.data?.data || response.data || [];

        // Transform invoices
        const transformedInvoices = invoiceData.map(inv => ({
          id: inv._id || inv.id,
          invoiceNumber: inv.invoiceNumber || `INV-${inv._id?.slice(-6) || '000000'}`,
          date: inv.date || inv.createdAt,
          total: inv.total || inv.amount || 0,
          amountPaid: inv.amountPaid || inv.paidAmount || 0,
          balance: inv.balance ?? ((inv.total || inv.amount || 0) - (inv.amountPaid || inv.paidAmount || 0)),
          status: (inv.status || 'PENDING').toUpperCase(),
          items: inv.items || inv.lineItems || []
        }));

        setInvoices(transformedInvoices);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalOwed = invoices.reduce((sum, inv) => sum + inv.balance, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des factures...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mes Factures</h1>
        <p className="mt-1 text-sm text-gray-500">
          Consultez et payez vos factures médicales
        </p>
      </div>

      {/* Balance Card */}
      <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <h2 className="text-lg font-medium mb-2">Solde total</h2>
        <p className="text-4xl font-bold mb-4">${totalOwed.toFixed(2)}</p>
        {totalOwed > 0 && (
          <button className="btn bg-white text-blue-600 hover:bg-gray-100 flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payer maintenant</span>
          </button>
        )}
      </div>

      {/* Invoices List */}
      <div className="grid grid-cols-1 gap-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className={`card ${
              invoice.status === 'OVERDUE' ? 'border-red-300 bg-red-50' :
              invoice.status === 'PAID' ? 'border-green-300 bg-green-50' :
              ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="font-bold text-gray-900">{invoice.invoiceNumber}</h3>
                  <span className={`badge ${
                    invoice.status === 'PAID' ? 'badge-success' :
                    invoice.status === 'OVERDUE' ? 'badge-danger' :
                    invoice.status === 'PARTIAL' ? 'badge-warning' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {invoice.status === 'PAID' ? 'Payée' :
                     invoice.status === 'OVERDUE' ? 'En retard' :
                     invoice.status === 'PARTIAL' ? 'Partiel' :
                     'En attente'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-medium">{format(new Date(invoice.date), 'dd MMM yyyy', { locale: fr })}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-bold text-gray-900">${invoice.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Payé</p>
                    <p className="font-medium text-green-600">${invoice.amountPaid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Solde</p>
                    <p className={`font-bold ${invoice.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${invoice.balance.toFixed(2)}
                    </p>
                  </div>
                </div>

                {invoice.items && invoice.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium text-gray-700">Services:</p>
                    <ul className="mt-1 space-y-1">
                      {invoice.items.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          • {item.serviceName || item.description || 'Service'} - ${(item.total || item.amount || 0).toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-2 ml-4">
                <button className="btn btn-secondary text-sm px-3 py-2 flex items-center space-x-1">
                  <Download className="h-4 w-4" />
                  <span>PDF</span>
                </button>
                {invoice.balance > 0 && (
                  <button className="btn btn-primary text-sm px-3 py-2 flex items-center space-x-1">
                    <CreditCard className="h-4 w-4" />
                    <span>Payer</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {invoices.length === 0 && (
          <div className="card text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune facture</p>
          </div>
        )}
      </div>
    </div>
  );
}
