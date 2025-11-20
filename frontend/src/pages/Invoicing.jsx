import { useState, useEffect } from 'react';
import { FileText, DollarSign, AlertCircle, CheckCircle, Clock, Download, Send, Plus, Search, Filter, Loader2, Eye, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../services/apiConfig';
import { toast } from 'react-toastify';

export default function Invoicing() {
  

  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null);

  // New invoice form state
  const [serviceQuantities, setServiceQuantities] = useState({});
  const [selectedPatient, setSelectedPatient] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate invoice total from selected services
  const calculateTotal = () => {
    return services.reduce((total, service) => {
      const qty = serviceQuantities[service.id] || 0;
      return total + (service.price * qty);
    }, 0);
  };

  // Reset form when modal closes
  const resetInvoiceForm = () => {
    setServiceQuantities({});
    setSelectedPatient('');
    setInvoiceNotes('');
    setIssueDate(format(new Date(), 'yyyy-MM-dd'));
    setDueDate(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoicesRes, patientsRes, servicesRes] = await Promise.all([
        api.get('/invoices', { params: { limit: 100 } }).catch(() => ({ data: { data: [] } })),
        api.get('/patients', { params: { limit: 200 } }).catch(() => ({ data: { data: [] } })),
        api.get('/billing/fee-schedule').catch(() => ({ data: { data: [] } }))
      ]);

      // Transform invoices
      const invoiceData = invoicesRes.data?.data || invoicesRes.data || [];
      const transformedInvoices = invoiceData.map(inv => ({
        id: inv._id || inv.id,
        invoiceNumber: inv.invoiceNumber || `INV-${inv._id?.slice(-6) || '000000'}`,
        patientId: inv.patient?._id || inv.patient || inv.patientId,
        patientName: inv.patient ? `${inv.patient.firstName || ''} ${inv.patient.lastName || ''}`.trim() : null,
        date: inv.date || inv.createdAt,
        dueDate: inv.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        total: inv.total || inv.amount || 0,
        amountPaid: inv.amountPaid || inv.paidAmount || 0,
        balance: inv.balance ?? ((inv.total || inv.amount || 0) - (inv.amountPaid || inv.paidAmount || 0)),
        status: (inv.status || 'PENDING').toUpperCase(),
        items: inv.items || inv.lineItems || [],
        payments: inv.payments || [],
        notes: inv.notes || ''
      }));

      // Transform patients
      const patientData = patientsRes.data?.data || patientsRes.data || [];
      const transformedPatients = patientData.map(p => ({
        id: p._id || p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        phone: p.phone || p.contact?.phone || ''
      }));

      // Transform services from fee schedule
      const serviceData = servicesRes.data?.data || servicesRes.data || [];
      const transformedServices = serviceData.map(s => ({
        id: s.code || s._id || s.id,
        name: s.name || s.description || 'Service',
        category: s.category || 'Général',
        price: s.price || s.fee || 0
      }));

      setInvoices(transformedInvoices);
      setPatients(transformedPatients);
      setServices(transformedServices);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);
  const overdueCount = invoices.filter(inv => inv.status === 'OVERDUE').length;

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const patient = patients.find(p => p.id === inv.patientId);
    const patientName = inv.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : '');

    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patientName.toLowerCase().includes(searchTerm.toLowerCase());

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

  const handleDownloadPDF = async (invoice) => {
    try {
      setActionLoading(prev => ({ ...prev, [invoice.id + '_pdf']: true }));

      // Try to get PDF from backend
      const response = await api.get(`/invoices/${invoice.id}/pdf`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      // Fallback: Generate simple print view
      const printWindow = window.open('', '_blank');
      const patient = patients.find(p => p.id === invoice.patientId);
      const patientName = invoice.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : 'N/A');

      printWindow.document.write(`
        <html>
          <head>
            <title>Facture ${invoice.invoiceNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .info { margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
              .total { font-weight: bold; font-size: 18px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>FACTURE</h1>
              <h2>${invoice.invoiceNumber}</h2>
            </div>
            <div class="info">
              <p><strong>Patient:</strong> ${patientName}</p>
              <p><strong>Date:</strong> ${format(new Date(invoice.date), 'dd/MM/yyyy')}</p>
              <p><strong>Échéance:</strong> ${format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Qté</th>
                  <th>Prix</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items?.map(item => `
                  <tr>
                    <td>${item.serviceName || item.description || 'Service'}</td>
                    <td>${item.quantity || 1}</td>
                    <td>$${(item.unitPrice || item.price || 0).toFixed(2)}</td>
                    <td>$${(item.total || item.amount || 0).toFixed(2)}</td>
                  </tr>
                `).join('') || ''}
              </tbody>
            </table>
            <p class="total">Total: $${invoice.total.toFixed(2)}</p>
            <p>Montant payé: $${invoice.amountPaid.toFixed(2)}</p>
            <p class="total">Solde: $${invoice.balance.toFixed(2)}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } finally {
      setActionLoading(prev => ({ ...prev, [invoice.id + '_pdf']: false }));
    }
  };

  const handleSendInvoice = async (invoice) => {
    try {
      setActionLoading(prev => ({ ...prev, [invoice.id + '_send']: true }));

      await api.post(`/invoices/${invoice.id}/send`, {
        method: 'email' // or 'sms'
      });

      alert(`Facture ${invoice.invoiceNumber} envoyée avec succès!`);
    } catch (err) {
      console.error('Error sending invoice:', err);
      alert('Erreur lors de l\'envoi de la facture. Vérifiez que le patient a une adresse email valide.');
    } finally {
      setActionLoading(prev => ({ ...prev, [invoice.id + '_send']: false }));
    }
  };

  const handleCancelInvoice = async (invoice) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir annuler la facture ${invoice.invoiceNumber}?`)) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [invoice.id + '_cancel']: true }));

      await api.patch(`/invoices/${invoice.id}`, {
        status: 'CANCELLED'
      });

      // Update local state
      setInvoices(prev => prev.map(inv =>
        inv.id === invoice.id ? { ...inv, status: 'CANCELLED' } : inv
      ));

      alert(`Facture ${invoice.invoiceNumber} annulée avec succès!`);
    } catch (err) {
      console.error('Error cancelling invoice:', err);
      alert('Erreur lors de l\'annulation de la facture');
    } finally {
      setActionLoading(prev => ({ ...prev, [invoice.id + '_cancel']: false }));
    }
  };

  const handleCreateInvoice = async () => {
    // Validate form
    if (!selectedPatient) {
      alert('Veuillez sélectionner un patient');
      return;
    }

    const selectedServices = services.filter(s => serviceQuantities[s.id] > 0);
    if (selectedServices.length === 0) {
      alert('Veuillez sélectionner au moins un service');
      return;
    }

    try {
      setCreating(true);

      // Build invoice items
      const items = selectedServices.map(service => ({
        serviceId: service.id,
        serviceName: service.name,
        quantity: serviceQuantities[service.id],
        unitPrice: service.price,
        total: service.price * serviceQuantities[service.id]
      }));

      const total = calculateTotal();

      const invoiceData = {
        patient: selectedPatient,
        date: new Date(issueDate),
        dueDate: new Date(dueDate),
        items,
        total,
        notes: invoiceNotes,
        status: 'PENDING'
      };

      const response = await api.post('/invoices', invoiceData);

      // Add to local state
      const newInvoice = {
        id: response.data._id || response.data.id,
        invoiceNumber: response.data.invoiceNumber || `INV-${(response.data._id || '').slice(-6)}`,
        patientId: selectedPatient,
        date: issueDate,
        dueDate: dueDate,
        total,
        amountPaid: 0,
        balance: total,
        status: 'PENDING',
        items,
        payments: [],
        notes: invoiceNotes
      };

      setInvoices(prev => [newInvoice, ...prev]);
      setShowInvoiceModal(false);
      resetInvoiceForm();

      // Show success modal with options
      setCreatedInvoice(newInvoice);
      setShowSuccessModal(true);
      toast.success('Facture créée avec succès!');
    } catch (err) {
      console.error('Error creating invoice:', err);
      toast.error('Erreur lors de la création de la facture');
    } finally {
      setCreating(false);
    }
  };

  // Handle viewing the created invoice
  const handleViewCreatedInvoice = () => {
    if (createdInvoice) {
      setSelectedInvoice(createdInvoice);
      setShowSuccessModal(false);
      setCreatedInvoice(null);
    }
  };

  // Handle printing the created invoice
  const handlePrintCreatedInvoice = () => {
    if (createdInvoice) {
      printInvoice(createdInvoice);
      setShowSuccessModal(false);
      setCreatedInvoice(null);
    }
  };

  // Print invoice function - creates a formatted print window
  const printInvoice = (invoice) => {
    // Find patient details
    const patient = patients.find(p => p._id === invoice.patient || p._id === invoice.patient?._id);
    const patientName = patient
      ? `${patient.firstName} ${patient.lastName}`
      : (invoice.patient?.firstName ? `${invoice.patient.firstName} ${invoice.patient.lastName}` : 'Patient inconnu');
    const patientId = patient?.patientId || invoice.patient?.patientId || 'N/A';

    // Format dates
    const invoiceDate = invoice.dateIssued ? format(new Date(invoice.dateIssued), 'dd/MM/yyyy', { locale: fr }) : 'N/A';
    const dueDateFormatted = invoice.dueDate ? format(new Date(invoice.dueDate), 'dd/MM/yyyy', { locale: fr }) : 'N/A';

    // Build items table
    const itemsHtml = invoice.items?.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description || item.name || 'Article'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(item.unitPrice || item.price || 0).toLocaleString('fr-FR')} FC</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${((item.unitPrice || item.price || 0) * (item.quantity || 1)).toLocaleString('fr-FR')} FC</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="padding: 8px; text-align: center;">Aucun article</td></tr>';

    // Calculate totals
    const subtotal = invoice.summary?.subtotal || invoice.items?.reduce((sum, item) => sum + ((item.unitPrice || item.price || 0) * (item.quantity || 1)), 0) || 0;
    const tax = invoice.summary?.tax || 0;
    const discount = invoice.summary?.discount || 0;
    const total = invoice.summary?.total || subtotal + tax - discount;
    const amountPaid = invoice.summary?.amountPaid || 0;
    const amountDue = invoice.summary?.amountDue || (total - amountPaid);

    // Create print window content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Facture ${invoice.invoiceNumber || 'N/A'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
          }
          .clinic-info {
            text-align: left;
          }
          .clinic-name {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
          }
          .invoice-title {
            text-align: right;
          }
          .invoice-number {
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .info-box {
            width: 48%;
          }
          .info-box h3 {
            margin: 0 0 10px 0;
            color: #6b7280;
            font-size: 12px;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background: #f3f4f6;
            padding: 10px 8px;
            text-align: left;
            font-size: 12px;
            text-transform: uppercase;
            color: #6b7280;
          }
          th:nth-child(2), th:nth-child(3), th:nth-child(4) {
            text-align: center;
          }
          th:nth-child(3), th:nth-child(4) {
            text-align: right;
          }
          .totals {
            float: right;
            width: 300px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .totals-row.total {
            font-weight: bold;
            font-size: 16px;
            border-bottom: 2px solid #2563eb;
          }
          .totals-row.due {
            font-weight: bold;
            font-size: 18px;
            color: ${amountDue > 0 ? '#dc2626' : '#16a34a'};
          }
          .footer {
            clear: both;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }
          .status-paid { background: #dcfce7; color: #16a34a; }
          .status-partial { background: #fef3c7; color: #d97706; }
          .status-pending { background: #fee2e2; color: #dc2626; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic-info">
            <div class="clinic-name">CareVision</div>
            <div>Centre Ophtalmologique</div>
            <div>Kinshasa, RD Congo</div>
            <div>+243 XX XXX XXXX</div>
          </div>
          <div class="invoice-title">
            <div class="invoice-number">FACTURE</div>
            <div style="font-size: 16px; margin-top: 5px;">${invoice.invoiceNumber || 'N/A'}</div>
            <div style="margin-top: 10px;">
              <span class="status-badge ${invoice.status === 'paid' ? 'status-paid' : invoice.status === 'partial' ? 'status-partial' : 'status-pending'}">
                ${invoice.status === 'paid' ? 'Payée' : invoice.status === 'partial' ? 'Partielle' : 'En attente'}
              </span>
            </div>
          </div>
        </div>

        <div class="info-section">
          <div class="info-box">
            <h3>Facturé à</h3>
            <div style="font-weight: bold;">${patientName}</div>
            <div>ID: ${patientId}</div>
          </div>
          <div class="info-box" style="text-align: right;">
            <h3>Détails</h3>
            <div><strong>Date:</strong> ${invoiceDate}</div>
            <div><strong>Échéance:</strong> ${dueDateFormatted}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qté</th>
              <th>Prix unitaire</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Sous-total:</span>
            <span>${subtotal.toLocaleString('fr-FR')} FC</span>
          </div>
          ${tax > 0 ? `
          <div class="totals-row">
            <span>TVA:</span>
            <span>${tax.toLocaleString('fr-FR')} FC</span>
          </div>
          ` : ''}
          ${discount > 0 ? `
          <div class="totals-row">
            <span>Remise:</span>
            <span>-${discount.toLocaleString('fr-FR')} FC</span>
          </div>
          ` : ''}
          <div class="totals-row total">
            <span>Total:</span>
            <span>${total.toLocaleString('fr-FR')} FC</span>
          </div>
          ${amountPaid > 0 ? `
          <div class="totals-row">
            <span>Montant payé:</span>
            <span>${amountPaid.toLocaleString('fr-FR')} FC</span>
          </div>
          ` : ''}
          <div class="totals-row due">
            <span>Montant dû:</span>
            <span>${amountDue.toLocaleString('fr-FR')} FC</span>
          </div>
        </div>

        ${invoice.notes ? `
        <div style="clear: both; margin-top: 30px;">
          <h3 style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 10px;">Notes</h3>
          <p style="margin: 0;">${invoice.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Merci pour votre confiance.</p>
          <p>CareVision - Centre Ophtalmologique</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        // Close window after print dialog closes
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      };
    }
  };

  // Close success modal
  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setCreatedInvoice(null);
  };

  const handleCreateNewInvoice = () => {
    setSelectedInvoice(null);
    resetInvoiceForm();
    setShowInvoiceModal(true);
  };

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

      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
          <button
            onClick={fetchData}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Réessayer
          </button>
        </div>
      )}

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
              placeholder="Rechercher par numéro de facture ou patient..."
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
          const patientName = invoice.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : 'N/A');

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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Patient</p>
                      <p className="font-semibold text-gray-900">{patientName}</p>
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
                  {invoice.items?.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Articles:</p>
                      <div className="space-y-1">
                        {invoice.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm bg-white rounded p-2">
                            <span className="text-gray-700">
                              {item.serviceName || item.description || 'Service'} <span className="text-gray-500">x {item.quantity || 1}</span>
                            </span>
                            <span className="font-semibold text-gray-900">
                              ${(item.total || item.amount || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment History */}
                  {invoice.payments && invoice.payments.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Paiements:</p>
                      <div className="space-y-1">
                        {invoice.payments.map((payment, idx) => (
                          <div key={idx} className="flex justify-between text-sm bg-white rounded p-2">
                            <div>
                              <span className="text-gray-700">
                                {format(new Date(payment.date || payment.createdAt), 'dd MMM yyyy', { locale: fr })}
                              </span>
                              <span className="text-gray-500 ml-2">({payment.method || 'N/A'})</span>
                            </div>
                            <span className="font-semibold text-green-600">
                              +${(payment.amount || 0).toFixed(2)}
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
                    <button
                      onClick={() => handleCancelInvoice(invoice)}
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
                {(() => {
                  const patient = patients.find(p => p.id === selectedInvoice.patientId);
                  const patientName = selectedInvoice.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : 'N/A');
                  const patientPhone = patient?.phone || '';
                  return (
                    <>
                      <p className="font-semibold">{patientName}</p>
                      {patientPhone && <p className="text-sm text-gray-600">{patientPhone}</p>}
                    </>
                  );
                })()}
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
                  {selectedInvoice.items?.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3 text-gray-900">{item.serviceName || item.description || 'Service'}</td>
                      <td className="p-3 text-center text-gray-700">{item.quantity || 1}</td>
                      <td className="p-3 text-right text-gray-700">${(item.unitPrice || item.price || 0).toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-gray-900">${(item.total || item.amount || 0).toFixed(2)}</td>
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
                  <select
                    className="input"
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                    required
                  >
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
                    Date d'émission *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
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
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services / Articles *
                </label>
                <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
                  {services.length > 0 ? services.map((service) => (
                    <div key={service.id} className={`flex items-center justify-between p-3 rounded ${serviceQuantities[service.id] > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{service.name}</p>
                        <p className="text-xs text-gray-500">{service.category}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-gray-700">${service.price.toFixed(2)}</span>
                        <input
                          type="number"
                          min="0"
                          value={serviceQuantities[service.id] || ''}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 0;
                            setServiceQuantities(prev => ({
                              ...prev,
                              [service.id]: qty
                            }));
                          }}
                          placeholder="Qté"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  )) : (
                    <p className="text-center text-gray-500 py-4">Aucun service disponible</p>
                  )}
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
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                />
              </div>

              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total estimé:</span>
                  <span className="text-2xl font-bold text-gray-900">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  resetInvoiceForm();
                }}
                className="btn btn-secondary"
                disabled={creating}
              >
                Annuler
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={creating || !selectedPatient || calculateTotal() === 0}
                className="btn btn-primary"
              >
                {creating ? 'Création...' : 'Créer la facture'}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Success Modal - After Invoice Creation */}
      {showSuccessModal && createdInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Facture créée avec succès!
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Facture <span className="font-semibold">{createdInvoice.invoiceNumber}</span> d'un montant de <span className="font-semibold">${createdInvoice.total.toFixed(2)}</span>
              </p>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleViewCreatedInvoice}
                  className="btn btn-primary w-full flex items-center justify-center space-x-2"
                >
                  <Eye className="h-5 w-5" />
                  <span>Voir la facture</span>
                </button>
                <button
                  onClick={() => handleDownloadPDF(createdInvoice)}
                  className="btn btn-secondary w-full flex items-center justify-center space-x-2"
                >
                  <Printer className="h-5 w-5" />
                  <span>Télécharger / Imprimer</span>
                </button>
                <button
                  onClick={handleCloseSuccessModal}
                  className="btn btn-ghost w-full text-gray-600"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
