import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MoreVertical,
  Eye,
  Check,
  X,
  Building2,
  User,
  Calendar,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import approvalService from '../../services/approvalService';
import companyService from '../../services/companyService';
import { useAuth } from '../../contexts/AuthContext';
import ApprovalDetailModal from './ApprovalDetailModal';
import ApprovalRequestModal from './ApprovalRequestModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvé' },
  { value: 'rejected', label: 'Rejeté' },
  { value: 'used', label: 'Utilisé' },
  { value: 'expired', label: 'Expiré' },
  { value: 'cancelled', label: 'Annulé' }
];

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

export default function Approvals() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [approvals, setApprovals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    company: searchParams.get('company') || ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });

  // Modal states
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  // Permissions
  const canCreate = ['admin', 'manager', 'doctor', 'nurse', 'receptionist'].includes(user?.role);
  const canApprove = ['admin', 'manager', 'accountant'].includes(user?.role);

  // Fetch companies for filter
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const result = await companyService.getCompanies({ status: 'active', limit: 100 });
        // Handle various API response formats defensively
        const data = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
          ? result.data
          : [];
        setCompanies(data);
      } catch (err) {
        console.error('Error fetching companies:', err);
        setCompanies([]);
      }
    };
    fetchCompanies();
  }, []);

  // Fetch approvals
  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status || undefined,
        company: filters.company || undefined
      };

      const result = await approvalService.getApprovals(params);
      const approvalsData = Array.isArray(result?.data) ? result.data : [];
      setApprovals(approvalsData);
      if (result.pagination) {
        setPagination(prev => ({ ...prev, ...result.pagination }));
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
      setError('Erreur lors du chargement des approbations');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Handlers
  const handleViewDetail = (approval) => {
    setSelectedApproval(approval);
    setShowDetailModal(true);
    setActionMenuOpen(null);
  };

  const handleApprove = async (approval) => {
    if (!window.confirm('Approuver cette demande?')) return;
    try {
      await approvalService.approveRequest(approval._id, {});
      fetchApprovals();
    } catch (err) {
      console.error('Error approving:', err);
      alert('Erreur lors de l\'approbation');
    }
    setActionMenuOpen(null);
  };

  const handleReject = async (approval) => {
    const reason = window.prompt('Motif du refus:');
    if (!reason) return;
    try {
      await approvalService.rejectRequest(approval._id, { reason });
      fetchApprovals();
    } catch (err) {
      console.error('Error rejecting:', err);
      alert('Erreur lors du refus');
    }
    setActionMenuOpen(null);
  };

  const handleRequestCreated = () => {
    setShowRequestModal(false);
    fetchApprovals();
  };

  const handleApprovalUpdated = () => {
    setShowDetailModal(false);
    setSelectedApproval(null);
    fetchApprovals();
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'En attente' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Approuvé' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: 'Rejeté' },
      used: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Check, label: 'Utilisé' },
      expired: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock, label: 'Expiré' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: X, label: 'Annulé' }
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        <Icon className="h-3 w-3" />
        {c.label}
      </span>
    );
  };

  // Stats (with defensive array check)
  const safeApprovals = Array.isArray(approvals) ? approvals : [];
  const stats = {
    total: safeApprovals.length,
    pending: safeApprovals.filter(a => a.status === 'pending').length,
    approved: safeApprovals.filter(a => a.status === 'approved').length,
    rejected: safeApprovals.filter(a => a.status === 'rejected').length
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-yellow-600" />
            Approbations & Délibérations
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des demandes d'approbation préalable pour les actes médicaux
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nouvelle demande
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total demandes</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Approuvées</p>
              <p className="text-2xl font-semibold text-green-600">{stats.approved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rejetées</p>
              <p className="text-2xl font-semibold text-red-600">{stats.rejected}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par patient, code acte..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-5 w-5" />
            Filtres
          </button>

          {/* Refresh */}
          <button
            onClick={fetchApprovals}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
              <select
                value={filters.company}
                onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">Toutes les entreprises</option>
                {companies.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Approvals List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-yellow-600 mx-auto mb-2" />
            <p className="text-gray-500">Chargement...</p>
          </div>
        ) : safeApprovals.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune demande d'approbation</p>
            {canCreate && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="mt-4 btn btn-primary"
              >
                Créer une demande
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Demande
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entreprise
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acte
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {safeApprovals.map((approval) => (
                  <tr
                    key={approval._id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewDetail(approval)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {approval.approvalId}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(approval.requestedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {approval.patient?.firstName} {approval.patient?.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {approval.patient?.patientId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {approval.company?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {approval.actCode}
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-[150px]">
                        {approval.actName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(approval.estimatedCost || approval.approvedAmount, approval.currency)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Qté: {approval.quantityRequested}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(approval.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(actionMenuOpen === approval._id ? null : approval._id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-500" />
                        </button>

                        {actionMenuOpen === approval._id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-10">
                            <button
                              onClick={() => handleViewDetail(approval)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Voir détails
                            </button>
                            {canApprove && approval.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(approval)}
                                  className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                                >
                                  <Check className="h-4 w-4" />
                                  Approuver
                                </button>
                                <button
                                  onClick={() => handleReject(approval)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  Rejeter
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.page} sur {pagination.pages} ({pagination.total} demandes)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showDetailModal && selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedApproval(null);
          }}
          onUpdated={handleApprovalUpdated}
          canApprove={canApprove}
        />
      )}

      {showRequestModal && (
        <ApprovalRequestModal
          onClose={() => setShowRequestModal(false)}
          onCreated={handleRequestCreated}
        />
      )}

      {/* Click outside to close action menu */}
      {actionMenuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActionMenuOpen(null)}
        />
      )}
    </div>
  );
}
