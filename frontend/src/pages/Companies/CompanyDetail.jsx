import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Users,
  FileText,
  DollarSign,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  Edit2,
  Percent,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import companyService from '../../services/companyService';
import { useAuth } from '../../contexts/AuthContext';
import CollapsibleSection, { CollapsibleSectionGroup } from '../../components/CollapsibleSection';
import CompanyFormModal from './CompanyFormModal';
import PaymentModal from './PaymentModal';

const formatCurrency = (amount, currency = 'CDF') => {
  if (amount == null) return '-';
  return new Intl.NumberFormat('fr-CD', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'dd MMM yyyy', { locale: fr });
};

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Permissions
  const canEdit = ['admin', 'manager', 'accountant'].includes(user?.role);
  const canRecordPayment = ['admin', 'accountant', 'manager'].includes(user?.role);

  // Fetch company data - using Promise.allSettled for graceful partial failures
  const fetchCompanyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First, fetch the company data (this is required)
      const companyRes = await companyService.getCompany(id);
      if (!companyRes?.data) {
        setError('Société non trouvée');
        setLoading(false);
        return;
      }
      setCompany(companyRes.data);

      // Then fetch related data with graceful failure handling
      const [employeesRes, invoicesRes, approvalsRes, statsRes] = await Promise.allSettled([
        companyService.getCompanyEmployees(id, { limit: 10 }),
        companyService.getCompanyInvoices(id, { limit: 10 }),
        companyService.getCompanyApprovals(id, { limit: 10 }),
        companyService.getCompanyStats(id)
      ]);

      // Extract data from settled promises, defaulting to empty arrays/null on failure
      setEmployees(employeesRes.status === 'fulfilled' ? (employeesRes.value?.data || []) : []);
      // Invoices endpoint returns {data: {invoices: [], summary: {}}} structure
      setInvoices(invoicesRes.status === 'fulfilled' ? (invoicesRes.value?.data?.invoices || []) : []);
      setApprovals(approvalsRes.status === 'fulfilled' ? (approvalsRes.value?.data || []) : []);
      setStats(statsRes.status === 'fulfilled' ? statsRes.value?.data : null);
    } catch (err) {
      console.error('Error fetching company data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  const handleCompanyUpdated = () => {
    setShowEditModal(false);
    fetchCompanyData();
  };

  const handlePaymentRecorded = () => {
    setShowPaymentModal(false);
    fetchCompanyData();
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      expired: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      active: 'Actif',
      suspended: 'Suspendu',
      expired: 'Expiré',
      inactive: 'Inactif'
    };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.inactive}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const labels = {
      insurance: 'Assurance',
      employer: 'Employeur',
      ngo: 'ONG',
      government: 'Gouvernement',
      other: 'Autre'
    };
    return labels[type] || type;
  };

  const getApprovalStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      used: 'bg-blue-100 text-blue-800',
      expired: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      pending: 'En attente',
      approved: 'Approuvé',
      rejected: 'Rejeté',
      used: 'Utilisé',
      expired: 'Expiré',
      cancelled: 'Annulé'
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-700">{error || 'Entreprise non trouvée'}</p>
          <button
            onClick={() => navigate('/companies')}
            className="mt-4 btn btn-primary"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  const currency = company.defaultCoverage?.currency || 'CDF';

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/companies')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500">{company.companyId}</span>
                  <span className="text-sm text-gray-400">|</span>
                  <span className="text-sm text-gray-600">{getTypeBadge(company.type)}</span>
                  {getStatusBadge(company.contract?.status || 'active')}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canRecordPayment && (company.balance?.outstanding || 0) > 0 && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn btn-success flex items-center gap-2"
            >
              <CreditCard className="h-5 w-5" />
              Enregistrer paiement
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowEditModal(true)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Edit2 className="h-5 w-5" />
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Employés</p>
              <p className="text-2xl font-semibold">{stats?.employeeCount || company.employeeCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Factures</p>
              <p className="text-2xl font-semibold">{stats?.invoiceCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total facturé</p>
              <p className="text-2xl font-semibold">
                {formatCurrency(company.balance?.totalBilled || 0, currency)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Solde dû</p>
              <p className={`text-2xl font-semibold ${(company.balance?.outstanding || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(company.balance?.outstanding || 0, currency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Company Info */}
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact</h3>
            <div className="space-y-3">
              {company.contact?.phone && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <span>{company.contact.phone}</span>
                </div>
              )}
              {company.contact?.email && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <a href={`mailto:${company.contact.email}`} className="text-blue-600 hover:underline">
                    {company.contact.email}
                  </a>
                </div>
              )}
              {company.contact?.contactPerson && (
                <div className="flex items-center gap-3 text-gray-600">
                  <User className="h-5 w-5 text-gray-400" />
                  <span>{company.contact.contactPerson}</span>
                </div>
              )}
              {company.contact?.address && (company.contact.address.city || company.contact.address.country) && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{[company.contact.address.city, company.contact.address.country].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Coverage Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Couverture</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pourcentage</span>
                <span className="font-semibold text-lg">
                  {company.defaultCoverage?.percentage || 0}%
                </span>
              </div>
              {company.defaultCoverage?.maxPerVisit > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Max par visite</span>
                  <span className="font-medium">
                    {formatCurrency(company.defaultCoverage.maxPerVisit, currency)}
                  </span>
                </div>
              )}
              {company.defaultCoverage?.maxAnnual > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Max annuel</span>
                  <span className="font-medium">
                    {formatCurrency(company.defaultCoverage.maxAnnual, currency)}
                  </span>
                </div>
              )}
              {company.defaultCoverage?.copayAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Ticket modérateur</span>
                  <span className="font-medium">
                    {formatCurrency(company.defaultCoverage.copayAmount, currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Covered Categories */}
            {company.coveredCategories?.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Catégories couvertes</p>
                <div className="flex flex-wrap gap-1">
                  {company.coveredCategories.map((cat, idx) => (
                    <span key={cat._id || cat.category || idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {typeof cat === 'string' ? cat : cat.category || 'N/A'}
                      {cat.coveragePercentage != null && ` (${cat.coveragePercentage}%)`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Acts Requiring Approval */}
            {company.actsRequiringApproval?.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Actes nécessitant approbation</p>
                <div className="flex flex-wrap gap-1">
                  {company.actsRequiringApproval.map((code, idx) => (
                    <span key={typeof code === 'string' ? code : (code._id || idx)} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                      {typeof code === 'string' ? code : (code.code || code.name || 'N/A')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contract Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contrat</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Début</span>
                <span className="font-medium">{formatDate(company.contract?.startDate || company.contractStart)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Fin</span>
                <span className="font-medium">{formatDate(company.contract?.endDate || company.contractEnd)}</span>
              </div>
              {company.taxId && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">N° Fiscal</span>
                  <span className="font-medium">{company.taxId}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Employees */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Employés récents
              </h3>
              <button
                onClick={() => navigate(`/patients?company=${company._id}`)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Voir tout <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y">
              {employees.length === 0 ? (
                <p className="p-6 text-center text-gray-500">Aucun employé enregistré</p>
              ) : (
                employees.map(emp => (
                  <div
                    key={emp._id}
                    className="px-6 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                    onClick={() => navigate(`/patients/${emp._id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{emp.patientId}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Factures récentes
              </h3>
              <button
                onClick={() => navigate(`/invoicing?company=${company._id}`)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Voir tout <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              {invoices.length === 0 ? (
                <p className="p-6 text-center text-gray-500">Aucune facture</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Facture
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Part entreprise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map(inv => (
                      <tr
                        key={inv._id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/invoicing/${inv._id}`)}
                      >
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{inv.invoiceId}</div>
                          <div className="text-xs text-gray-500">{formatDate(inv.invoiceDate)}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                          {inv.patient?.firstName} {inv.patient?.lastName}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                          {formatCurrency(inv.companyShare || 0, inv.currency)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            inv.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                            inv.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {inv.paymentStatus === 'paid' ? 'Payé' :
                             inv.paymentStatus === 'partial' ? 'Partiel' : 'Impayé'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent Approvals */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-yellow-600" />
                Approbations récentes
              </h3>
              <button
                onClick={() => navigate(`/approvals?company=${company._id}`)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Voir tout <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              {approvals.length === 0 ? (
                <p className="p-6 text-center text-gray-500">Aucune demande d'approbation</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Acte
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {approvals.map(app => (
                      <tr key={app._id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{app.approvalId}</div>
                          <div className="text-xs text-gray-500">{formatDate(app.requestedAt)}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                          {app.patient?.firstName} {app.patient?.lastName}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{app.actCode}</div>
                          <div className="text-xs text-gray-500">{app.actName}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          {getApprovalStatusBadge(app.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEditModal && (
        <CompanyFormModal
          company={company}
          onClose={() => setShowEditModal(false)}
          onSave={handleCompanyUpdated}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          company={company}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
    </div>
  );
}
