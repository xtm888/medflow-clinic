import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Stethoscope, Pill, Glasses, FlaskConical, ScanLine, Scissors, Loader2, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import api from '../../services/apiConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';
import { useBillingUpdates } from '../../hooks/useWebSocket';
import ConfirmationModal from '../../components/ConfirmationModal';
import InvoiceHeader from './InvoiceHeader';
import InvoiceFilters from './InvoiceFilters';
import InvoiceList from './InvoiceList';
import InvoiceDetail from './InvoiceDetail';
import PaymentModal from './PaymentModal';

// ==================== CATEGORY CONFIGURATION ====================
const INVOICE_CATEGORIES = {
  services: {
    key: 'services',
    label: 'Services',
    labelFr: 'Services',
    icon: Stethoscope,
    color: 'blue',
    bgColor: 'bg-blue-500',
    lightBg: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    categories: ['consultation', 'procedure', 'examination', 'therapy']
  },
  surgery: {
    key: 'surgery',
    label: 'Surgery',
    labelFr: 'Chirurgie',
    icon: Scissors,
    color: 'red',
    bgColor: 'bg-red-500',
    lightBg: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    categories: ['surgery']
  },
  medication: {
    key: 'medication',
    label: 'Médicaments',
    labelFr: 'Médicaments',
    icon: Pill,
    color: 'green',
    bgColor: 'bg-green-500',
    lightBg: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    categories: ['medication']
  },
  optical: {
    key: 'optical',
    label: 'Optique',
    labelFr: 'Optique',
    icon: Glasses,
    color: 'purple',
    bgColor: 'bg-purple-500',
    lightBg: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    categories: ['optical', 'device']
  },
  laboratory: {
    key: 'laboratory',
    label: 'Laboratoire',
    labelFr: 'Laboratoire',
    icon: FlaskConical,
    color: 'orange',
    bgColor: 'bg-orange-500',
    lightBg: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    categories: ['laboratory']
  },
  imaging: {
    key: 'imaging',
    label: 'Imagerie',
    labelFr: 'Imagerie',
    icon: ScanLine,
    color: 'cyan',
    bgColor: 'bg-cyan-500',
    lightBg: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    textColor: 'text-cyan-700',
    categories: ['imaging']
  }
};

// Role to allowed categories mapping
const ROLE_ALLOWED_CATEGORIES = {
  admin: ['all', 'services', 'surgery', 'medication', 'optical', 'laboratory', 'imaging'],
  accountant: ['all', 'services', 'surgery', 'medication', 'optical', 'laboratory', 'imaging'],
  receptionist: ['all', 'services', 'surgery', 'medication', 'optical', 'laboratory', 'imaging'],
  pharmacist: ['medication'],
  optician: ['optical'],
  lab_tech: ['laboratory'],
  doctor: ['all', 'services', 'surgery', 'medication', 'optical', 'laboratory', 'imaging'],
  nurse: ['services', 'medication'],
  surgeon: ['surgery', 'services']
};

// Role to default category mapping
const ROLE_DEFAULT_CATEGORY = {
  admin: 'all',
  accountant: 'all',
  receptionist: 'all',
  pharmacist: 'medication',
  optician: 'optical',
  lab_tech: 'laboratory',
  doctor: 'services',
  nurse: 'services'
};

// Helper to detect category from item name (fallback for existing invoices)
const detectCategoryFromName = (itemName, itemDescription) => {
  const text = ((itemName || '') + ' ' + (itemDescription || '')).toLowerCase();

  const surgeryPatterns = [
    'chirurgie', 'surgery', 'opération', 'operation', 'cataracte', 'cataract',
    'phaco', 'phacoémulsification', 'vitrectomie', 'vitrectomy'
  ];
  const labPatterns = ['cholestérol', 'glycémie', 'bilan', 'hba1c', 'nfs'];
  const medPatterns = ['tablet', 'comprimé', 'capsule', 'collyre', 'mg', 'ml'];
  const imagingPatterns = ['oct', 'tomographie', 'retinographie', 'angiographie'];
  const opticalPatterns = ['lunettes', 'monture', 'verres correcteurs', 'lentilles'];

  for (const pattern of surgeryPatterns) {
    if (text.includes(pattern)) return 'surgery';
  }
  for (const pattern of labPatterns) {
    if (text.includes(pattern)) return 'laboratory';
  }
  for (const pattern of medPatterns) {
    if (text.includes(pattern)) return 'medication';
  }
  for (const pattern of imagingPatterns) {
    if (text.includes(pattern)) return 'imaging';
  }
  for (const pattern of opticalPatterns) {
    if (text.includes(pattern)) return 'optical';
  }

  return null;
};

// Helper to get category group from item category
const getCategoryGroup = (itemCategory, itemName, itemDescription) => {
  if (itemCategory && itemCategory !== 'procedure') {
    for (const [groupKey, group] of Object.entries(INVOICE_CATEGORIES)) {
      if (group.categories.includes(itemCategory)) {
        return groupKey;
      }
    }
  }

  const detectedCategory = detectCategoryFromName(itemName, itemDescription);
  if (detectedCategory) {
    return detectedCategory;
  }

  if (itemCategory === 'procedure') {
    return 'services';
  }

  for (const [groupKey, group] of Object.entries(INVOICE_CATEGORIES)) {
    if (group.categories.includes(itemCategory)) {
      return groupKey;
    }
  }

  return 'services';
};

export default function Invoicing() {
  const { user } = useAuth();
  const { selectedClinic } = useClinic();
  const [searchParams, setSearchParams] = useSearchParams();

  // Clinic info
  const clinicName = selectedClinic?.name || 'MedFlow Clinic';
  const formatAddress = (addr) => {
    if (!addr) return 'Kinshasa, RD Congo';
    if (typeof addr === 'string') return addr;
    const parts = [addr.street, addr.city, addr.state, addr.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Kinshasa, RD Congo';
  };
  const clinicAddress = formatAddress(selectedClinic?.address);
  const clinicPhone = selectedClinic?.phone || '+243 XX XXX XXXX';

  // Role-based permissions
  const canCreateInvoice = ['admin', 'receptionist', 'accountant'].includes(user?.role);
  const canCancelInvoice = user?.role === 'admin';
  const canProcessRefund = ['admin', 'accountant'].includes(user?.role);

  // Get allowed categories for current user
  const allowedCategories = ROLE_ALLOWED_CATEGORIES[user?.role] || ['all'];

  // State
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [actionLoading, setActionLoading] = useState({});

  // Modal state
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  // Update filter category when user role changes
  useEffect(() => {
    if (user?.role) {
      const roleDefault = ROLE_DEFAULT_CATEGORY[user.role] || 'all';
      setFilterCategory(roleDefault);
    }
  }, [user?.role]);

  // Handle URL params
  useEffect(() => {
    if (!loading && patients.length > 0) {
      const action = searchParams.get('action');
      const patientId = searchParams.get('patientId');

      if (action === 'new' && canCreateInvoice) {
        // Note: Creating new invoice functionality would be implemented here
        setSearchParams({});
      }
    }
  }, [loading, patients, searchParams, setSearchParams, canCreateInvoice]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoicesRes, patientsRes] = await Promise.all([
        api.get('/invoices', { params: { limit: 100 } }).catch(() => ({ data: { data: [] } })),
        api.get('/patients', { params: { limit: 100 } }).catch(() => ({ data: { data: [] } }))
      ]);

      // Transform invoices
      const invoiceData = invoicesRes.data?.data || invoicesRes.data || [];
      const transformedInvoices = invoiceData.map(inv => ({
        id: inv._id || inv.id,
        invoiceNumber: inv.invoiceNumber || inv.invoiceId || `INV-${inv._id?.slice(-6) || '000000'}`,
        patientId: inv.patient?._id || inv.patient || inv.patientId,
        patientName: inv.patient ? `${inv.patient.firstName || ''} ${inv.patient.lastName || ''}`.trim() : (inv.billing?.billTo?.name || null),
        date: inv.dateIssued || inv.date || inv.createdAt,
        dueDate: inv.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        total: inv.summary?.total ?? inv.total ?? inv.amount ?? 0,
        amountPaid: inv.summary?.amountPaid ?? inv.amountPaid ?? inv.paidAmount ?? 0,
        balance: inv.summary?.amountDue ?? inv.balance ?? ((inv.summary?.total ?? inv.total ?? inv.amount ?? 0) - (inv.summary?.amountPaid ?? inv.amountPaid ?? inv.paidAmount ?? 0)),
        status: (inv.status || 'PENDING').toUpperCase(),
        items: inv.items || inv.lineItems || [],
        payments: inv.payments || [],
        currency: inv.billing?.currency || 'CDF',
        notes: typeof inv.notes === 'string' ? inv.notes : (inv.notes?.patient || inv.notes?.internal || ''),
        conventionBilling: (inv.isConventionInvoice && inv.companyBilling?.company) ? inv.companyBilling : null,
        isConventionInvoice: inv.isConventionInvoice || false,
        companyShare: inv.companyBilling?.companyShare ?? inv.summary?.companyShare ?? 0,
        patientShare: inv.companyBilling?.patientShare ?? inv.summary?.patientShare ?? 0
      }));

      // Transform patients
      const patientData = patientsRes.data?.data || patientsRes.data || [];
      const transformedPatients = patientData.map(p => ({
        id: p._id || p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        phone: p.phone || p.contact?.phone || ''
      }));

      setInvoices(transformedInvoices);
      setPatients(transformedPatients);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket: Listen for real-time billing updates
  const billingUpdate = useBillingUpdates(null); // null = listen for all billing updates

  // Refresh data when billing update received
  useEffect(() => {
    if (billingUpdate) {
      console.log('[Invoicing] Billing update received:', billingUpdate.type);
      if (billingUpdate.type === 'created') {
        toast.info(`Nouvelle facture créée: ${billingUpdate.invoiceId || 'N/A'}`);
      } else if (billingUpdate.type === 'updated') {
        toast.info(`Facture mise à jour: ${billingUpdate.invoiceId || 'N/A'}`);
      } else if (billingUpdate.type === 'approved') {
        toast.success(`Facture approuvée: ${billingUpdate.invoiceId || 'N/A'}`);
      } else if (billingUpdate.type === 'rejected') {
        toast.warning(`Facture rejetée: ${billingUpdate.invoiceId || 'N/A'}`);
      }
      fetchData();
    }
  }, [billingUpdate, fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==================== CATEGORY STATISTICS ====================
  const categoryStats = useMemo(() => {
    const stats = {};

    Object.keys(INVOICE_CATEGORIES).forEach(key => {
      stats[key] = { count: 0, total: 0, paid: 0, pending: 0, paidCount: 0 };
    });
    stats.all = { count: 0, total: 0, paid: 0, pending: 0, paidCount: 0 };

    invoices.forEach(invoice => {
      const categoryTotals = {};
      invoice.items?.forEach(item => {
        const categoryGroup = getCategoryGroup(item.category, item.name, item.description);
        if (!categoryTotals[categoryGroup]) {
          categoryTotals[categoryGroup] = 0;
        }
        categoryTotals[categoryGroup] += item.total || item.subtotal || 0;
      });

      Object.entries(categoryTotals).forEach(([cat, categorySubtotal]) => {
        if (stats[cat]) {
          stats[cat].count++;
          stats[cat].total += categorySubtotal;
          const categoryShare = invoice.total > 0 ? categorySubtotal / invoice.total : 0;
          stats[cat].paid += invoice.amountPaid * categoryShare;
          stats[cat].pending += invoice.balance * categoryShare;
          if (invoice.status === 'PAID') stats[cat].paidCount++;
        }
      });

      stats.all.count++;
      stats.all.total += invoice.total;
      stats.all.paid += invoice.amountPaid;
      stats.all.pending += invoice.balance;
      if (invoice.status === 'PAID') stats.all.paidCount++;
    });

    return stats;
  }, [invoices]);

  // ==================== FILTERED INVOICES ====================
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const patient = patients.find(p => p.id === inv.patientId);
      const patientName = inv.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : '');

      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           patientName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;

      let matchesCategory = filterCategory === 'all';
      if (!matchesCategory && filterCategory) {
        matchesCategory = inv.items?.some(item => {
          const detectedCategory = getCategoryGroup(item.category, item.name, item.description);
          return detectedCategory === filterCategory;
        });
      }

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [invoices, patients, searchTerm, filterStatus, filterCategory]);

  // Group invoice items by category
  const groupItemsByCategory = (items) => {
    const grouped = {};

    Object.keys(INVOICE_CATEGORIES).forEach(key => {
      grouped[key] = [];
    });
    grouped.other = [];

    items?.forEach(item => {
      const categoryGroup = getCategoryGroup(item.category, item.name, item.description);
      if (grouped[categoryGroup]) {
        grouped[categoryGroup].push(item);
      } else {
        grouped.other.push(item);
      }
    });

    Object.keys(grouped).forEach(key => {
      if (grouped[key].length === 0) delete grouped[key];
    });

    return grouped;
  };

  // Calculate category totals for an invoice
  const getCategoryTotals = (items) => {
    const totals = {};
    items?.forEach(item => {
      const categoryGroup = getCategoryGroup(item.category, item.name, item.description);
      if (!totals[categoryGroup]) totals[categoryGroup] = 0;
      totals[categoryGroup] += item.total || item.subtotal || 0;
    });
    return totals;
  };

  // ==================== HANDLERS ====================
  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handlePrintInvoice = (invoice) => {
    // Print functionality - would use the same logic from original file
    // For brevity, just showing toast
    toast.info('Fonction d\'impression - à implémenter');
  };

  const handleCancelInvoice = (invoice) => {
    setConfirmModal({
      isOpen: true,
      title: 'Annuler cette facture?',
      message: `Êtes-vous sûr de vouloir annuler la facture ${invoice.invoiceNumber}?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(prev => ({ ...prev, [invoice.id + '_cancel']: true }));
          await api.put(`/invoices/${invoice.id}/cancel`);
          setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, status: 'CANCELLED' } : inv));
          toast.success(`Facture ${invoice.invoiceNumber} annulée!`);
        } catch (err) {
          toast.error('Erreur lors de l\'annulation');
        } finally {
          setActionLoading(prev => ({ ...prev, [invoice.id + '_cancel']: false }));
        }
      }
    });
  };

  const handleOpenPaymentModal = (invoice) => {
    setPaymentInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentInvoice(null);
  };

  const handleProcessPayment = async (paymentData) => {
    if (!paymentInvoice || !paymentData.amount) return;

    try {
      setProcessingPayment(true);
      let amountInCDF = parseFloat(paymentData.amount);
      if (paymentData.currency !== 'CDF') {
        amountInCDF = amountInCDF * parseFloat(paymentData.exchangeRate || 1);
      }

      const response = await api.post(`/invoices/${paymentInvoice.id}/payments`, {
        amount: amountInCDF,
        currency: paymentData.currency,
        exchangeRate: parseFloat(paymentData.exchangeRate || 1),
        method: paymentData.method,
        reference: paymentData.reference,
        notes: paymentData.notes
      });

      toast.success('Paiement enregistré avec succès!');

      // Check if surgery cases were auto-created
      const surgeryCases = response.data?.data?.surgeryCases || [];
      if (surgeryCases.length > 0) {
        toast.info(
          `${surgeryCases.length} cas chirurgical${surgeryCases.length > 1 ? 'x' : ''} créé${surgeryCases.length > 1 ? 's' : ''}`,
          { autoClose: 8000 }
        );
      }

      handleClosePaymentModal();
      fetchData();
    } catch (err) {
      console.error('Error processing payment:', err);
      toast.error(err.response?.data?.message || 'Erreur lors du paiement');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOpenRefundModal = (invoice, paymentIndex) => {
    toast.info('Fonction de remboursement - à implémenter');
  };

  const handleCreateNewInvoice = () => {
    toast.info('Fonction de création de facture - à implémenter');
  };

  // ==================== RENDER ====================
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
      <InvoiceHeader
        filterCategory={filterCategory}
        categoryConfig={INVOICE_CATEGORIES[filterCategory]}
        canCreateInvoice={canCreateInvoice}
        onRefresh={fetchData}
        onCreateNew={handleCreateNewInvoice}
      />

      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
          <button onClick={fetchData} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
            Réessayer
          </button>
        </div>
      )}

      <InvoiceFilters
        categoryStats={categoryStats}
        invoiceCategories={INVOICE_CATEGORIES}
        allowedCategories={allowedCategories}
        filterCategory={filterCategory}
        filterStatus={filterStatus}
        searchTerm={searchTerm}
        onCategoryChange={setFilterCategory}
        onStatusChange={setFilterStatus}
        onSearchChange={setSearchTerm}
      />

      <InvoiceList
        invoices={filteredInvoices}
        patients={patients}
        invoiceCategories={INVOICE_CATEGORIES}
        filterCategory={filterCategory}
        canProcessRefund={canProcessRefund}
        canCancelInvoice={canCancelInvoice}
        groupItemsByCategory={groupItemsByCategory}
        getCategoryTotals={getCategoryTotals}
        onViewInvoice={handleViewInvoice}
        onPrintInvoice={handlePrintInvoice}
        onOpenPaymentModal={handleOpenPaymentModal}
        onOpenRefundModal={handleOpenRefundModal}
        onCancelInvoice={handleCancelInvoice}
        actionLoading={actionLoading}
      />

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          clinicName={clinicName}
          clinicAddress={clinicAddress}
          clinicPhone={clinicPhone}
          invoiceCategories={INVOICE_CATEGORIES}
          groupItemsByCategory={groupItemsByCategory}
          onClose={() => setShowInvoiceModal(false)}
          onPrint={handlePrintInvoice}
          onOpenPaymentModal={handleOpenPaymentModal}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          isProcessing={processingPayment}
          onClose={handleClosePaymentModal}
          onProcessPayment={handleProcessPayment}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => { confirmModal.onConfirm?.(); setConfirmModal(prev => ({ ...prev, isOpen: false })); }}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
}
