import { useState, useEffect } from 'react';
import { UserPlus, DollarSign, Check, Clock, AlertCircle, Eye, ChevronDown, ChevronUp, Search } from 'lucide-react';
import CollapsibleSection from '../../../components/CollapsibleSection';
import referrerService from '../../../services/referrerService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * CommissionSection - Referrer commissions tracking and payment
 */
export default function CommissionSection() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState([]);
  const [grandTotals, setGrandTotals] = useState({
    totalInvoiced: 0,
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0
  });
  const [expandedReferrer, setExpandedReferrer] = useState(null);
  const [referrerDetails, setReferrerDetails] = useState({});
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    referrerType: ''
  });
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [paymentRef, setPaymentRef] = useState('');

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status) params.status = filters.status;
      if (filters.referrerType) params.referrerType = filters.referrerType;

      const result = await referrerService.getCommissionsReport(params);
      // Handle various API response formats defensively
      const reportData = Array.isArray(result?.data?.data)
        ? result.data.data
        : Array.isArray(result?.data)
        ? result.data
        : [];
      setReport(reportData);
      setGrandTotals(result?.grandTotals || result?.data?.grandTotals || {
        totalInvoiced: 0,
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0
      });
    } catch (error) {
      console.error('Error loading commissions report:', error);
      toast.error('Erreur lors du chargement du rapport');
      setReport([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const loadReferrerDetails = async (referrerId) => {
    if (referrerDetails[referrerId]) return;

    try {
      const result = await referrerService.getReferrerCommissions(referrerId, filters);
      // Handle various API response formats defensively
      const details = Array.isArray(result?.data?.data)
        ? result.data.data
        : Array.isArray(result?.data)
        ? result.data
        : [];
      setReferrerDetails(prev => ({
        ...prev,
        [referrerId]: details
      }));
    } catch (error) {
      console.error('Error loading referrer details:', error);
      setReferrerDetails(prev => ({
        ...prev,
        [referrerId]: []
      }));
    }
  };

  const toggleReferrer = (referrerId) => {
    if (expandedReferrer === referrerId) {
      setExpandedReferrer(null);
    } else {
      setExpandedReferrer(referrerId);
      loadReferrerDetails(referrerId);
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await referrerService.markCommissionPaid(invoiceId, {
        paymentReference: paymentRef,
        notes: `Payé le ${format(new Date(), 'dd/MM/yyyy')}`
      });
      toast.success('Commission marquée comme payée');
      setPayingInvoice(null);
      setPaymentRef('');
      loadReport();
      // Refresh the referrer details
      if (expandedReferrer) {
        setReferrerDetails(prev => {
          const updated = { ...prev };
          delete updated[expandedReferrer];
          return updated;
        });
        loadReferrerDetails(expandedReferrer);
      }
    } catch (error) {
      console.error('Error marking commission as paid:', error);
      toast.error('Erreur lors du paiement');
    }
  };

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('fr-FR') + ' CDF';
  };

  const formatDate = (date) => {
    if (!date) return '';
    return format(new Date(date), 'dd MMM yyyy', { locale: fr });
  };

  return (
    <CollapsibleSection
      title="Commissions Référents"
      icon={UserPlus}
      iconColor="text-purple-600"
      gradient="from-purple-50 to-pink-50"
      defaultExpanded={false}
      onExpand={loadReport}
      loading={loading}
      badge={
        grandTotals.pendingCommission > 0 && (
          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatCurrency(grandTotals.pendingCommission)} en attente
          </span>
        )
      }
    >
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Du</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Au</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Tous</option>
            <option value="pending">En attente</option>
            <option value="paid">Payé</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={filters.referrerType}
            onChange={(e) => setFilters({ ...filters, referrerType: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Tous</option>
            <option value="external">Externe</option>
            <option value="internal">Interne</option>
          </select>
        </div>
        <button
          onClick={loadReport}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <Search className="h-4 w-4" />
          Filtrer
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total facturé</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(grandTotals.totalInvoiced)}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-xs text-purple-600 mb-1">Total commissions</p>
          <p className="text-lg font-bold text-purple-900">{formatCurrency(grandTotals.totalCommission)}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-xs text-yellow-600 mb-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> En attente
          </p>
          <p className="text-lg font-bold text-yellow-700">{formatCurrency(grandTotals.pendingCommission)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-xs text-green-600 mb-1 flex items-center gap-1">
            <Check className="h-3 w-3" /> Payé
          </p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(grandTotals.paidCommission)}</p>
        </div>
      </div>

      {/* Referrers List */}
      {report.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <UserPlus className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p>Aucune commission pour cette période</p>
        </div>
      ) : (
        <div className="space-y-3">
          {report.map((item) => (
            <div key={item._id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Referrer Header */}
              <button
                onClick={() => toggleReferrer(item._id)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    item.referrerType === 'internal' ? 'bg-purple-100' : 'bg-blue-100'
                  }`}>
                    <UserPlus className={`h-5 w-5 ${
                      item.referrerType === 'internal' ? 'text-purple-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">
                      {item.referrerName || item.referrer?.name || 'Référent inconnu'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.referrerType === 'internal' ? 'Interne' : 'Externe'} • {item.invoiceCount} factures
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-purple-600">{formatCurrency(item.totalCommission)}</p>
                    <div className="flex gap-2 text-xs">
                      {item.pendingCommission > 0 && (
                        <span className="text-yellow-600">En attente: {formatCurrency(item.pendingCommission)}</span>
                      )}
                      {item.paidCommission > 0 && (
                        <span className="text-green-600">Payé: {formatCurrency(item.paidCommission)}</span>
                      )}
                    </div>
                  </div>
                  {expandedReferrer === item._id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Referrer Details (Expanded) */}
              {expandedReferrer === item._id && (
                <div className="p-4 border-t border-gray-200 bg-white">
                  {!referrerDetails[item._id] ? (
                    <p className="text-center text-gray-500 py-4">Chargement...</p>
                  ) : referrerDetails[item._id].length === 0 ? (
                    <p className="text-center text-gray-500 py-4">Aucune facture</p>
                  ) : (
                    <div className="space-y-2">
                      {referrerDetails[item._id].map((invoice) => (
                        <div
                          key={invoice._id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {invoice.invoiceId}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDate(invoice.dateIssued)} • {invoice.patient?.firstName} {invoice.patient?.lastName}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-500">
                                Base: {formatCurrency(invoice.summary?.total)}
                              </p>
                              <p className="font-semibold text-purple-600">
                                Commission: {formatCurrency(invoice.referrerCommission?.commissionAmount)}
                              </p>
                            </div>
                            {invoice.referrerCommission?.status === 'paid' ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                                <Check className="h-3 w-3" /> Payé
                              </span>
                            ) : payingInvoice === invoice._id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={paymentRef}
                                  onChange={(e) => setPaymentRef(e.target.value)}
                                  placeholder="Réf. paiement"
                                  className="px-2 py-1 border border-gray-300 rounded text-sm w-24"
                                />
                                <button
                                  onClick={() => handleMarkPaid(invoice._id)}
                                  className="px-2 py-1 bg-green-600 text-white rounded text-sm"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setPayingInvoice(null)}
                                  className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-sm"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPayingInvoice(invoice._id)}
                                className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full hover:bg-yellow-200 flex items-center gap-1"
                              >
                                <DollarSign className="h-3 w-3" /> Payer
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
