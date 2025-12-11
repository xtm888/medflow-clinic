import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Filter,
  Users,
  DollarSign,
  AlertTriangle,
  FileText,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  MoreVertical,
  Edit2,
  Trash2,
  CreditCard,
  Calendar,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Briefcase,
  LayoutList,
  Network
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import companyService from '../../services/companyService';
import { useAuth } from '../../contexts/AuthContext';
import CompanyFormModal from './CompanyFormModal';
import PaymentModal from './PaymentModal';

const COMPANY_TYPES = [
  { value: '', label: 'Tous les types' },
  { value: 'insurance', label: 'Assurance' },
  { value: 'employer', label: 'Employeur' },
  { value: 'ngo', label: 'ONG' },
  { value: 'government', label: 'Gouvernement' },
  { value: 'other', label: 'Autre' }
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'expired', label: 'Expiré' },
  { value: 'inactive', label: 'Inactif' }
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

export default function Companies() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [companies, setCompanies] = useState([]);
  const [hierarchyData, setHierarchyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('hierarchy'); // 'hierarchy' or 'list'
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    hasOutstanding: false
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });

  // Modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  // Permissions
  const canCreate = ['admin', 'manager', 'accountant'].includes(user?.role);
  const canEdit = ['admin', 'manager', 'accountant'].includes(user?.role);
  const canDelete = ['admin'].includes(user?.role);
  const canRecordPayment = ['admin', 'accountant', 'manager'].includes(user?.role);

  // Toggle parent expansion
  const toggleParentExpansion = (parentId) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (viewMode === 'hierarchy' && !searchQuery && !filters.type && !filters.hasOutstanding) {
        // Use hierarchy view
        const result = await companyService.getCompaniesHierarchy({ includeStats: 'true' });
        setHierarchyData(result.data || []);
        setCompanies([]);

        // Auto-expand parents with sub-companies
        const parentsWithChildren = (result.data || [])
          .filter(c => c.isParent && c.subCompanyCount > 0)
          .map(c => c._id);
        setExpandedParents(new Set(parentsWithChildren));
      } else {
        // Use flat list view
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          search: searchQuery || undefined,
          type: filters.type || undefined,
          status: filters.status || undefined
        };

        let result;
        if (filters.hasOutstanding) {
          result = await companyService.getCompaniesWithOutstanding(0);
        } else {
          result = await companyService.getCompanies(params);
        }

        setCompanies(result.data || []);
        setHierarchyData([]);
        if (result.pagination) {
          setPagination(prev => ({ ...prev, ...result.pagination }));
        }
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Erreur lors du chargement des entreprises');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, filters, viewMode]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        fetchCompanies();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handlers
  const handleCreateCompany = () => {
    setSelectedCompany(null);
    setShowCompanyModal(true);
  };

  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setShowCompanyModal(true);
    setActionMenuOpen(null);
  };

  const handleDeleteCompany = async (company) => {
    if (!window.confirm(`Supprimer ${company.name}? Cette action est irréversible.`)) return;

    try {
      await companyService.deleteCompany(company._id);
      fetchCompanies();
    } catch (err) {
      console.error('Error deleting company:', err);
      alert('Erreur lors de la suppression');
    }
    setActionMenuOpen(null);
  };

  const handleRecordPayment = (company) => {
    setSelectedCompany(company);
    setShowPaymentModal(true);
    setActionMenuOpen(null);
  };

  const handleCompanySaved = () => {
    setShowCompanyModal(false);
    setSelectedCompany(null);
    fetchCompanies();
  };

  const handlePaymentRecorded = () => {
    setShowPaymentModal(false);
    setSelectedCompany(null);
    fetchCompanies();
  };

  const handleViewDetails = (company) => {
    navigate(`/companies/${company._id}`);
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
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const styles = {
      insurance: 'bg-blue-100 text-blue-800',
      employer: 'bg-purple-100 text-purple-800',
      ngo: 'bg-teal-100 text-teal-800',
      government: 'bg-indigo-100 text-indigo-800',
      other: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      insurance: 'Assurance',
      employer: 'Employeur',
      ngo: 'ONG',
      government: 'Gouvernement',
      other: 'Autre'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || styles.other}`}>
        {labels[type] || type}
      </span>
    );
  };

  // Summary stats - works with both hierarchy and flat view
  const getAllCompanies = () => {
    if (hierarchyData.length > 0) {
      const all = [];
      hierarchyData.forEach(item => {
        all.push(item);
        if (item.subCompanies) {
          all.push(...item.subCompanies);
        }
      });
      return all;
    }
    return companies;
  };

  const allCompanies = getAllCompanies();
  const stats = {
    total: allCompanies.length,
    active: allCompanies.filter(c => c.contract?.status === 'active' || c.status === 'active').length,
    withOutstanding: allCompanies.filter(c => (c.balance?.outstanding || 0) > 0).length,
    totalOutstanding: allCompanies.reduce((sum, c) => sum + (c.balance?.outstanding || 0), 0)
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            Entreprises & Conventions
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des assurances, employeurs et conventions de prise en charge
          </p>
        </div>
        {canCreate && (
          <button
            onClick={handleCreateCompany}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nouvelle entreprise
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total entreprises</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Conventions actives</p>
              <p className="text-2xl font-semibold">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avec solde dû</p>
              <p className="text-2xl font-semibold">{stats.withOutstanding}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total à recouvrer</p>
              <p className="text-2xl font-semibold text-red-600">
                {formatCurrency(stats.totalOutstanding)}
              </p>
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
              placeholder="Rechercher par nom, ID ou contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                viewMode === 'hierarchy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Vue hiérarchique"
            >
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Hiérarchie</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Vue liste"
            >
              <LayoutList className="h-4 w-4" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-5 w-5" />
            Filtres
          </button>

          {/* Refresh */}
          <button
            onClick={fetchCompanies}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {COMPANY_TYPES.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasOutstanding}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasOutstanding: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Avec solde impayé uniquement</span>
              </label>
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

      {/* Companies List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-500">Chargement...</p>
          </div>
        ) : allCompanies.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune entreprise trouvée</p>
            {canCreate && (
              <button
                onClick={handleCreateCompany}
                className="mt-4 btn btn-primary"
              >
                Créer une entreprise
              </button>
            )}
          </div>
        ) : hierarchyData.length > 0 ? (
          /* Hierarchical View */
          <div className="divide-y divide-gray-200">
            {hierarchyData.map((item) => (
              <div key={item._id}>
                {/* Parent Convention / Insurance Company */}
                {item.isParent ? (
                  <div>
                    {/* Parent Header - Collapsible */}
                    <div
                      className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                      onClick={() => toggleParentExpansion(item._id)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="p-1 hover:bg-white/50 rounded">
                          {expandedParents.has(item._id) ? (
                            <ChevronDown className="h-5 w-5 text-blue-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-blue-600" />
                          )}
                        </button>
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{item.name}</span>
                            {item.conventionCode && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                {item.conventionCode}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                              Assurance
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-4">
                            <span>{item.companyId}</span>
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5" />
                              {item.subCompanyCount} employeur{item.subCompanyCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {item.defaultCoverage?.percentage || 0}% couverture
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Users className="h-3.5 w-3.5" />
                            {item.employeeCount || 0} patients
                          </div>
                        </div>
                        {getStatusBadge(item.contract?.status || 'active')}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(item);
                          }}
                          className="p-2 hover:bg-white/50 rounded-lg text-gray-500 hover:text-blue-600"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Sub-companies (Employers) */}
                    {expandedParents.has(item._id) && item.subCompanies?.length > 0 && (
                      <div className="bg-gray-50">
                        {item.subCompanies.map((sub) => (
                          <div
                            key={sub._id}
                            className="px-4 py-3 pl-16 border-t border-gray-200 flex items-center justify-between hover:bg-gray-100 cursor-pointer transition-colors"
                            onClick={() => handleViewDetails(sub)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Briefcase className="h-4 w-4 text-purple-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{sub.name}</span>
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                    Employeur
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500">{sub.companyId}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="text-sm text-gray-900">
                                  {sub.defaultCoverage?.percentage || item.defaultCoverage?.percentage || 0}%
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Users className="h-3.5 w-3.5" />
                                {sub.employeeCount || 0}
                              </div>
                              <div className={`text-sm font-medium ${
                                (sub.balance?.outstanding || 0) > 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {formatCurrency(sub.balance?.outstanding || 0)}
                              </div>
                              {getStatusBadge(sub.contract?.status || 'active')}
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standalone Company (no parent) */
                  <div
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleViewDetails(item)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                        item.type === 'insurance' ? 'bg-blue-100' :
                        item.type === 'employer' ? 'bg-purple-100' :
                        item.type === 'ngo' ? 'bg-teal-100' :
                        item.type === 'government' ? 'bg-indigo-100' : 'bg-gray-100'
                      }`}>
                        {item.type === 'insurance' ? (
                          <Shield className={`h-5 w-5 text-blue-600`} />
                        ) : item.type === 'employer' ? (
                          <Briefcase className={`h-5 w-5 text-purple-600`} />
                        ) : (
                          <Building2 className={`h-5 w-5 text-gray-600`} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.name}</span>
                          {getTypeBadge(item.type)}
                        </div>
                        <div className="text-sm text-gray-500">{item.companyId}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-gray-900">
                          {item.defaultCoverage?.percentage || 0}%
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Users className="h-3.5 w-3.5" />
                        {item.employeeCount || 0}
                      </div>
                      <div className={`text-sm font-medium ${
                        (item.balance?.outstanding || 0) > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatCurrency(item.balance?.outstanding || 0)}
                      </div>
                      {getStatusBadge(item.contract?.status || 'active')}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Flat List View (when filtering/searching) */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entreprise
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Couverture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employés
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solde dû
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
                {companies.map((company) => (
                  <tr
                    key={company._id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewDetails(company)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {company.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {company.companyId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge(company.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {company.defaultCoverage?.percentage || 0}%
                      </div>
                      {company.defaultCoverage?.maxPerVisit > 0 && (
                        <div className="text-xs text-gray-500">
                          Max: {formatCurrency(company.defaultCoverage.maxPerVisit, company.defaultCoverage.currency)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <Users className="h-4 w-4 text-gray-400" />
                        {company.employeeCount || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        (company.balance?.outstanding || 0) > 0 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {formatCurrency(company.balance?.outstanding || 0, company.defaultCoverage?.currency)}
                      </div>
                      {company.balance?.totalBilled > 0 && (
                        <div className="text-xs text-gray-500">
                          Facturé: {formatCurrency(company.balance.totalBilled, company.defaultCoverage?.currency)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(company.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(actionMenuOpen === company._id ? null : company._id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-500" />
                        </button>

                        {actionMenuOpen === company._id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-10">
                            <button
                              onClick={() => handleViewDetails(company)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              Voir détails
                            </button>
                            {canRecordPayment && (company.balance?.outstanding || 0) > 0 && (
                              <button
                                onClick={() => handleRecordPayment(company)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <CreditCard className="h-4 w-4" />
                                Enregistrer paiement
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleEditCompany(company)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit2 className="h-4 w-4" />
                                Modifier
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteCompany(company)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                              </button>
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

        {/* Pagination (only for flat list view) */}
        {companies.length > 0 && pagination.pages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {pagination.page} sur {pagination.pages} ({pagination.total} entreprises)
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
      {showCompanyModal && (
        <CompanyFormModal
          company={selectedCompany}
          onClose={() => {
            setShowCompanyModal(false);
            setSelectedCompany(null);
          }}
          onSave={handleCompanySaved}
        />
      )}

      {showPaymentModal && selectedCompany && (
        <PaymentModal
          company={selectedCompany}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedCompany(null);
          }}
          onPaymentRecorded={handlePaymentRecorded}
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
