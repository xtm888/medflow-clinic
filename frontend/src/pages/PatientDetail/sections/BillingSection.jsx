import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Plus, Eye, Printer, DollarSign, AlertCircle, Check, Clock, Building2, BadgeCheck, Users } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import patientService from '../../../services/patientService';
import billingService from '../../../services/billingService';
import { toast } from 'react-toastify';

/**
 * BillingSection - Balance summary, insurance info, invoice list
 */
export default function BillingSection({
  patientId,
  patient,
  canViewBilling,
  canCreateInvoice,
  canProcessPayment,
  onViewInvoice,
  onPrintInvoice,
  onOpenPayment
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState([]);

  const loadData = async (force = false) => {
    if (!force && billing.length > 0) return;

    console.log('[BillingSection] Loading billing for patient:', patientId);
    setLoading(true);
    try {
      const res = await patientService.getPatientBilling(patientId);
      console.log('[BillingSection] Raw response:', res);

      // Handle deeply nested response structure:
      // res.data = { success: true, data: { invoices: [...] } }
      // OR res = { invoices: [...] } (transformed)
      let invoices = [];

      if (Array.isArray(res)) {
        invoices = res;
      } else if (res?.data?.data?.invoices) {
        // Axios response with nested API response
        invoices = res.data.data.invoices;
      } else if (res?.data?.invoices) {
        // Single wrapped response
        invoices = res.data.invoices;
      } else if (res?.invoices) {
        // Direct response
        invoices = res.invoices;
      } else if (Array.isArray(res?.data)) {
        invoices = res.data;
      }

      console.log('[BillingSection] Extracted invoices:', invoices?.length || 0);
      setBilling(Array.isArray(invoices) ? invoices : []);
    } catch (err) {
      console.error('[BillingSection] Error loading billing:', err);
      setBilling([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load billing data when patientId changes
  useEffect(() => {
    if (patientId && canViewBilling) {
      loadData(true);
    }
  }, [patientId]);

  if (!canViewBilling) return null;

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate totals - ensure billing is always an array
  // IMPORTANT: Prioritize summary fields (canonical source) over top-level fields (may be stale)
  const billingArray = Array.isArray(billing) ? billing : [];
  const totalBilled = billingArray.reduce((sum, b) => sum + (b.summary?.total || b.total || 0), 0);
  const totalPaid = billingArray.reduce((sum, b) => sum + (b.summary?.amountPaid || b.amountPaid || b.paid || 0), 0);
  const balance = totalBilled - totalPaid;

  return (
    <CollapsibleSection
      title="Facturation"
      icon={CreditCard}
      iconColor="text-green-600"
      gradient="from-green-50 to-emerald-50"
      defaultExpanded={true}
      onExpand={() => loadData(true)}
      loading={loading}
      badge={
        balance > 0 && (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {balance.toLocaleString()} CDF dû
          </span>
        )
      }
      headerExtra={
        billingArray.length > 0 && (
          <span>Total: {totalBilled.toLocaleString()} CDF</span>
        )
      }
      actions={
        canCreateInvoice && (
          <SectionActionButton
            icon={Plus}
            onClick={() => navigate(`/invoicing?patientId=${patientId}&action=new`)}
            variant="primary"
          >
            Facture
          </SectionActionButton>
        )
      }
    >
      {billingArray.length === 0 ? (
        <SectionEmptyState
          icon={CreditCard}
          message="Aucune facture pour ce patient"
          action={
            canCreateInvoice && (
              <SectionActionButton
                icon={Plus}
                onClick={() => navigate(`/invoicing?patientId=${patientId}&action=new`)}
              >
                Créer une facture
              </SectionActionButton>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Total facturé"
              value={`${totalBilled.toLocaleString()} CDF`}
              color="gray"
            />
            <SummaryCard
              label="Payé"
              value={`${totalPaid.toLocaleString()} CDF`}
              color="green"
              icon={Check}
            />
            <SummaryCard
              label="Reste à payer"
              value={`${balance.toLocaleString()} CDF`}
              color={balance > 0 ? 'red' : 'gray'}
              icon={balance > 0 ? AlertCircle : Check}
            />
            <SummaryCard
              label="Convention"
              value={patient?.convention?.company?.name || patient?.convention?.companyName || patient?.insurance?.provider || 'Sans convention'}
              color={patient?.convention?.company ? 'green' : 'gray'}
              small
            />
          </div>

          {/* Convention Details - Primary for Billing */}
          {patient?.convention?.company && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-green-600" />
                  <h4 className="text-sm font-bold text-green-900">Convention</h4>
                </div>
                {patient.convention.status && (
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    patient.convention.status === 'active'
                      ? 'bg-green-200 text-green-800'
                      : 'bg-yellow-200 text-yellow-800'
                  }`}>
                    {patient.convention.status === 'active' ? 'Active' : patient.convention.status}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-green-600">Entreprise</p>
                  <p className="font-bold text-green-900">
                    {patient.convention.company?.name || patient.convention.companyName || 'N/A'}
                  </p>
                </div>
                {patient.convention.employeeId && (
                  <div>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      Matricule
                    </p>
                    <p className="font-medium text-green-900">{patient.convention.employeeId}</p>
                  </div>
                )}
                {patient.convention.beneficiaryType && (
                  <div>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Bénéficiaire
                    </p>
                    <p className="font-medium text-green-900">
                      {patient.convention.beneficiaryType === 'employee' ? 'Employé(e)' :
                       patient.convention.beneficiaryType === 'spouse' ? 'Conjoint(e)' :
                       patient.convention.beneficiaryType === 'child' ? 'Enfant' : 'Personne à charge'}
                    </p>
                  </div>
                )}
                {patient.convention.company?.defaultCoverage?.percentage && (
                  <div>
                    <p className="text-xs text-green-600">Couverture</p>
                    <p className="font-bold text-green-900 text-lg">
                      {patient.convention.company.defaultCoverage.percentage}%
                    </p>
                  </div>
                )}
              </div>
              {(patient.convention.jobTitle || patient.convention.department) && (
                <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-700">
                  {patient.convention.jobTitle && <span>{patient.convention.jobTitle}</span>}
                  {patient.convention.jobTitle && patient.convention.department && <span> - </span>}
                  {patient.convention.department && <span>{patient.convention.department}</span>}
                </div>
              )}
            </div>
          )}

          {/* Insurance Details - Secondary */}
          {patient?.insurance && patient.insurance.provider && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Assurance privée</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-blue-600">Assureur</p>
                  <p className="font-medium text-blue-900">{patient.insurance.provider}</p>
                </div>
                {patient.insurance.policyNumber && (
                  <div>
                    <p className="text-xs text-blue-600">N° Police</p>
                    <p className="font-medium text-blue-900">{patient.insurance.policyNumber}</p>
                  </div>
                )}
                {patient.insurance.coverageType && (
                  <div>
                    <p className="text-xs text-blue-600">Couverture</p>
                    <p className="font-medium text-blue-900">{patient.insurance.coverageType}</p>
                  </div>
                )}
                {patient.insurance.validUntil && (
                  <div>
                    <p className="text-xs text-blue-600">Validité</p>
                    <p className="font-medium text-blue-900">{formatDate(patient.insurance.validUntil)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Invoices */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Factures récentes</h4>
            <div className="space-y-2">
              {billingArray.slice(0, 5).map((invoice) => (
                <InvoiceRow
                  key={invoice._id || invoice.id}
                  invoice={invoice}
                  formatDate={formatDate}
                  onView={() => onViewInvoice?.(invoice)}
                  onPrint={() => onPrintInvoice?.(invoice)}
                  onPay={() => onOpenPayment?.(invoice)}
                  canProcessPayment={canProcessPayment}
                />
              ))}
            </div>
          </div>

          {billingArray.length > 5 && (
            <button
              onClick={() => navigate(`/invoicing?patientId=${patientId}`)}
              className="w-full text-center text-sm text-green-600 hover:text-green-700 py-2"
            >
              Voir les {billingArray.length} factures →
            </button>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// Summary card component
function SummaryCard({ label, value, color, icon: Icon, small }) {
  const colors = {
    gray: 'bg-gray-50 text-gray-900',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600'
  };

  return (
    <div className={`rounded-lg p-3 ${colors[color] || colors.gray}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-1">
        {Icon && <Icon className="h-4 w-4" />}
        <p className={`font-bold ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
      </div>
    </div>
  );
}

// Invoice row component
function InvoiceRow({ invoice, formatDate, onView, onPrint, onPay, canProcessPayment }) {
  const statusColors = {
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-600',
    overdue: 'bg-red-100 text-red-700'
  };

  // IMPORTANT: Prioritize summary fields (canonical source) over top-level fields (may be stale)
  const total = invoice.summary?.total || invoice.total || 0;
  const amountPaid = invoice.summary?.amountPaid || invoice.amountPaid || invoice.paid || 0;
  const remaining = total - amountPaid;

  // Convention split info
  const hasConvention = !!(invoice.companyBilling || invoice.isConventionInvoice);
  const companyShare = invoice.companyBilling?.companyShare || invoice.summary?.companyShare || 0;
  const patientShare = invoice.companyBilling?.patientShare || invoice.summary?.patientShare || total;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded ${
          invoice.status === 'paid' ? 'bg-green-100' : 'bg-gray-200'
        }`}>
          <CreditCard className={`h-4 w-4 ${
            invoice.status === 'paid' ? 'text-green-600' : 'text-gray-500'
          }`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {invoice.invoiceNumber || invoice.invoiceId || `#${(invoice._id || invoice.id)?.slice(-6).toUpperCase()}`}
          </p>
          <p className="text-xs text-gray-500">
            {formatDate(invoice.dateIssued || invoice.date || invoice.createdAt)}
            {invoice.description && ` • ${invoice.description}`}
          </p>
          {/* Convention split display */}
          {hasConvention && companyShare > 0 && (
            <p className="text-xs mt-0.5">
              <span className="text-blue-600">Ent: {companyShare.toLocaleString()}</span>
              <span className="mx-1 text-gray-400">|</span>
              <span className="text-orange-600">Vous: {patientShare.toLocaleString()}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">{total.toLocaleString()} CDF</p>
          {remaining > 0 && (
            <p className="text-xs text-red-600">Reste: {remaining.toLocaleString()}</p>
          )}
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[invoice.status] || 'bg-gray-100 text-gray-600'}`}>
          {invoice.status === 'paid' ? 'Payée' :
           invoice.status === 'partial' ? 'Partiel' :
           invoice.status === 'pending' ? 'En attente' :
           invoice.status === 'draft' ? 'Brouillon' :
           invoice.status === 'overdue' ? 'En retard' : invoice.status}
        </span>
        <div className="flex gap-1">
          <button onClick={onView} className="p-1 text-gray-400 hover:text-blue-600" title="Voir">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={onPrint} className="p-1 text-gray-400 hover:text-gray-600" title="Imprimer">
            <Printer className="h-4 w-4" />
          </button>
          {invoice.status !== 'paid' && canProcessPayment && (
            <button onClick={onPay} className="p-1 text-gray-400 hover:text-green-600" title="Payer">
              <DollarSign className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
