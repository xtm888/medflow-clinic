import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  AlertTriangle,
  Activity,
  Users,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  FileText,
  Lock,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  BarChart3,
  MessageSquare,
  CheckSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import auditService from '../services/auditService';
import { normalizeToArray } from '../utils/apiHelpers';

// Action type icons and colors
const getActionConfig = (action) => {
  const configs = {
    // Authentication
    LOGIN_SUCCESS: { icon: LogIn, color: 'text-green-600', bg: 'bg-green-100', label: 'Connexion réussie' },
    LOGIN_FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Connexion échouée' },
    LOGOUT: { icon: LogOut, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Déconnexion' },

    // Data operations
    DATA_ACCESS: { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Accès données' },
    DATA_CREATE: { icon: FileText, color: 'text-green-600', bg: 'bg-green-100', label: 'Création' },
    DATA_UPDATE: { icon: Edit, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Modification' },
    DATA_DELETE: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100', label: 'Suppression' },
    DATA_EXPORT: { icon: Download, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Export' },

    // Patient
    PATIENT_CREATE: { icon: User, color: 'text-green-600', bg: 'bg-green-100', label: 'Patient créé' },
    PATIENT_UPDATE: { icon: User, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Patient modifié' },
    PATIENT_DELETE: { icon: User, color: 'text-red-600', bg: 'bg-red-100', label: 'Patient supprimé' },
    PATIENT_VIEW: { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Patient consulté' },
    PATIENT_DATA_ACCESS: { icon: User, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Accès dossier patient' },

    // Prescriptions
    PRESCRIPTION_CREATE: { icon: FileText, color: 'text-green-600', bg: 'bg-green-100', label: 'Ordonnance créée' },
    PRESCRIPTION_UPDATE: { icon: FileText, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Ordonnance modifiée' },
    PRESCRIPTION_DELETE: { icon: FileText, color: 'text-red-600', bg: 'bg-red-100', label: 'Ordonnance supprimée' },
    PRESCRIPTION_VIEW: { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Ordonnance consultée' },
    PRESCRIPTION_DISPENSE: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Médicament délivré' },

    // Appointments
    APPOINTMENT_CREATE: { icon: Calendar, color: 'text-green-600', bg: 'bg-green-100', label: 'RDV créé' },
    APPOINTMENT_UPDATE: { icon: Calendar, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'RDV modifié' },
    APPOINTMENT_DELETE: { icon: Calendar, color: 'text-red-600', bg: 'bg-red-100', label: 'RDV supprimé' },
    APPOINTMENT_CANCEL: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'RDV annulé' },

    // Billing
    INVOICE_CREATE: { icon: FileText, color: 'text-green-600', bg: 'bg-green-100', label: 'Facture créée' },
    INVOICE_UPDATE: { icon: FileText, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Facture modifiée' },
    PAYMENT_PROCESS: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Paiement' },
    PAYMENT_REFUND: { icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Remboursement' },
    MULTI_CURRENCY_PAYMENT: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Paiement multi-devises' },

    // Security
    SECURITY_ALERT: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Alerte sécurité' },
    SUSPICIOUS_ACTIVITY: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Activité suspecte' },

    default: { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Action' }
  };

  // Check for CRITICAL prefix
  if (action?.startsWith('CRITICAL_')) {
    return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Opération critique' };
  }

  return configs[action] || configs.default;
};

const formatActionName = (action) => {
  if (!action) return 'Inconnu';
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export default function AuditTrail() {
  const { user } = useAuth();

  // Admin-only access
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actionTypes, setActionTypes] = useState([]);

  // Employee activity tracking
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDaily, setEmployeeDaily] = useState(null);
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  // Patient access tracking
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientAccessLogs, setPatientAccessLogs] = useState([]);
  const [patientAccessLoading, setPatientAccessLoading] = useState(false);

  // Compliance reporting
  const [complianceType, setComplianceType] = useState('hipaa'); // 'hipaa' or 'gdpr'
  const [complianceReport, setComplianceReport] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  // Filters
  const [filters, setFilters] = useState({
    action: '',
    search: '',
    userId: '', // Filter by specific user
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    suspicious: false
  });
  const [statsPeriod, setStatsPeriod] = useState('24h');

  // Active tab
  const [activeTab, setActiveTab] = useState('employees'); // 'all', 'employees', 'suspicious', 'security', 'patients', 'compliance', 'modifications', 'critical'

  // Note modal
  const [noteModal, setNoteModal] = useState({ open: false, logId: null, note: '' });

  useEffect(() => {
    loadData();
    loadActionTypes();
  }, []);

  useEffect(() => {
    loadStats();
  }, [statsPeriod]);

  useEffect(() => {
    if (activeTab === 'employees') {
      loadEmployees();
    } else {
      loadLogs();
    }
  }, [currentPage, filters, activeTab]);

  const loadData = async () => {
    await Promise.all([loadLogs(), loadStats(), loadEmployees()]);
  };

  const loadEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await auditService.getEmployeeActivity({
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      setEmployees(response?.data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      // Don't show toast for 404 - means no audit data yet
      if (error.response?.status !== 404) {
        toast.error('Erreur lors du chargement des activités');
      }
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadEmployeeDaily = async (userId) => {
    try {
      const response = await auditService.getEmployeeDailyActivity(userId, {
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      setEmployeeDaily(response?.data);
      setExpandedEmployee(userId);
    } catch (error) {
      console.error('Error loading employee daily:', error);
    }
  };

  const loadPatientAccessLogs = async (patientId) => {
    try {
      setPatientAccessLoading(true);
      const response = await auditService.getPatientAuditTrail(patientId, {
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      setPatientAccessLogs(normalizeToArray(response));
    } catch (error) {
      console.error('Error loading patient access logs:', error);
      toast.error('Erreur lors du chargement des accès patient');
    } finally {
      setPatientAccessLoading(false);
    }
  };

  const generateComplianceReport = async () => {
    try {
      setComplianceLoading(true);
      const response = await auditService.getComplianceReport(
        filters.startDate,
        filters.endDate,
        complianceType
      );
      setComplianceReport(response?.data);
      toast.success(`Rapport ${complianceType.toUpperCase()} généré avec succès`);
    } catch (error) {
      console.error('Error generating compliance report:', error);
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setComplianceLoading(false);
    }
  };

  const exportComplianceReport = async () => {
    try {
      const blob = await auditService.exportToCSV({
        startDate: filters.startDate,
        endDate: filters.endDate,
        type: complianceType
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-${complianceType}-${filters.startDate}-${filters.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Rapport exporté avec succès');
    } catch (error) {
      console.error('Error exporting compliance report:', error);
      toast.error('Erreur lors de l\'export du rapport');
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      let params = {
        page: currentPage,
        limit
      };

      // Apply filters
      if (filters.action) params.action = filters.action;
      if (filters.search) params.search = filters.search;
      if (filters.userId) params.userId = filters.userId; // Filter by specific user
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      // Tab-specific filters
      if (activeTab === 'suspicious' || filters.suspicious) {
        params.suspicious = 'true';
      } else if (activeTab === 'security') {
        // All security-related actions - include authentication, authorization, and security events
        params.securityEvents = 'true'; // Includes login, logout, permission changes, security alerts
      } else if (activeTab === 'modifications') {
        // Data modifications - creates, updates, deletes
        params.modifications = 'true'; // Backend filters for CREATE, UPDATE, DELETE actions
      } else if (activeTab === 'critical') {
        // Critical operations - dangerous actions
        params.critical = 'true'; // Backend filters for CRITICAL_ prefixed actions
      }

      const response = await auditService.getLogs(params);
      setLogs(normalizeToArray(response));
      setTotalPages(response?.pages || 1);
      setTotalCount(response?.total || 0);
    } catch (error) {
      toast.error('Échec du chargement des logs d\'audit');
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await auditService.getStats(statsPeriod);
      setStats(response?.data || null);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadActionTypes = async () => {
    try {
      const response = await auditService.getActionTypes();
      setActionTypes(response?.data || []);
    } catch (error) {
      console.error('Error loading action types:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      toast.info('Génération du fichier CSV...');

      // Use backend export endpoint
      const blob = await auditService.exportToCSV({
        startDate: filters.startDate,
        endDate: filters.endDate,
        action: filters.action || undefined
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `journal_audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export terminé');
    } catch (error) {
      // Fallback to client-side CSV generation
      try {
        const csvContent = generateCSV(logs);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `journal_audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Export terminé');
      } catch (err) {
        toast.error("Échec de l'export");
      }
    }
  };

  const generateCSV = (data) => {
    const headers = ['Date', 'Action', 'Utilisateur', 'Ressource', 'Adresse IP', 'Status', 'Temps réponse'];
    const rows = data.map(log => [
      format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      log.action,
      log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système',
      log.resource,
      log.ipAddress || 'N/A',
      log.responseStatus || 'N/A',
      log.responseTime ? `${log.responseTime}ms` : 'N/A'
    ]);

    return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  };

  const handleAddNote = async () => {
    if (!noteModal.logId || !noteModal.note.trim()) return;

    try {
      await auditService.addNote(noteModal.logId, noteModal.note);
      toast.success('Note ajoutée');
      setNoteModal({ open: false, logId: null, note: '' });
      loadLogs();
    } catch (error) {
      toast.error("Échec de l'ajout de la note");
    }
  };

  const handleMarkReviewed = async (logId) => {
    try {
      await auditService.markReviewed(logId);
      toast.success('Marqué comme examiné');
      loadLogs();
    } catch (error) {
      toast.error('Échec du marquage');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Journal d'Audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Suivi des activités et événements système
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="btn btn-secondary flex items-center space-x-2"
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          <button
            onClick={handleExport}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Download className="h-5 w-5" />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Événements totaux</p>
              <p className="text-3xl font-bold">
                {statsLoading ? '...' : (stats?.totalEvents || 0).toLocaleString()}
              </p>
            </div>
            <Activity className="h-10 w-10 text-blue-200" />
          </div>
          <div className="mt-2">
            <select
              value={statsPeriod}
              onChange={(e) => setStatsPeriod(e.target.value)}
              className="text-xs bg-blue-600 border-blue-400 text-white rounded px-2 py-1"
            >
              <option value="1h">Dernière heure</option>
              <option value="24h">24 heures</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
            </select>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">Connexions réussies</p>
              <p className="text-3xl font-bold">
                {statsLoading ? '...' : (stats?.securityStats?.successfulLogins || 0)}
              </p>
            </div>
            <LogIn className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-100">Connexions échouées</p>
              <p className="text-3xl font-bold">
                {statsLoading ? '...' : (stats?.securityStats?.failedLogins || 0)}
              </p>
            </div>
            <XCircle className="h-10 w-10 text-red-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-100">Activités suspectes</p>
              <p className="text-3xl font-bold">
                {statsLoading ? '...' : (stats?.securityStats?.suspicious || 0)}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => { setActiveTab('employees'); setCurrentPage(1); setExpandedEmployee(null); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'employees'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Activité Employés
          </button>
          <button
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Activity className="h-4 w-4 inline mr-2" />
            Tous les événements
          </button>
          <button
            onClick={() => { setActiveTab('suspicious'); setCurrentPage(1); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'suspicious'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Activités suspectes
            {stats?.securityStats?.suspicious > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                {stats.securityStats.suspicious}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('security'); setCurrentPage(1); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'security'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="h-4 w-4 inline mr-2" />
            Sécurité
          </button>
          <button
            onClick={() => { setActiveTab('patients'); setCurrentPage(1); setSelectedPatient(null); setPatientAccessLogs([]); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'patients'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="h-4 w-4 inline mr-2" />
            Accès Patients
          </button>
          <button
            onClick={() => { setActiveTab('compliance'); setCurrentPage(1); setComplianceReport(null); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'compliance'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckSquare className="h-4 w-4 inline mr-2" />
            Rapports Conformité
          </button>
          <button
            onClick={() => { setActiveTab('modifications'); setCurrentPage(1); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'modifications'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Edit className="h-4 w-4 inline mr-2" />
            Modifications
          </button>
          <button
            onClick={() => { setActiveTab('critical'); setCurrentPage(1); }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'critical'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Opérations Critiques
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              className="input w-48"
            >
              <option value="">Tous les utilisateurs</option>
              {employees.map(emp => {
                const userId = emp._id || emp.userId;
                const firstName = emp.user?.firstName || emp.firstName || 'Inconnu';
                const lastName = emp.user?.lastName || emp.lastName || '';
                return (
                  <option key={userId} value={userId}>
                    {firstName} {lastName}
                  </option>
                );
              })}
            </select>

            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="input w-48"
            >
              <option value="">Toutes les actions</option>
              {actionTypes.map(action => (
                <option key={action} value={action}>{formatActionName(action)}</option>
              ))}
            </select>

            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="input"
              placeholder="Date début"
            />

            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="input"
              placeholder="Date fin"
            />

            <button
              onClick={() => {
                setFilters({ action: '', search: '', startDate: '', endDate: '', suspicious: false });
                setCurrentPage(1);
              }}
              className="btn btn-secondary"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Employee Activity Tab Content */}
      {activeTab === 'employees' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Suivi des Activités par Employé
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Vue d'ensemble des actions effectuées par chaque employé dans la période sélectionnée
            </p>
          </div>

          {employeesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Chargement des activités...</p>
              </div>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Aucune activité enregistrée</h3>
              <p className="text-gray-500 mt-2">Aucun employé n'a effectué d'action dans cette période</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {employees.map((employee) => {
                // Handle both response structures
                const userId = employee._id || employee.userId;
                const firstName = employee.user?.firstName || employee.firstName;
                const lastName = employee.user?.lastName || employee.lastName;
                const role = employee.user?.role || employee.role || 'Employé';
                const breakdown = employee.breakdown || {};

                return (
                <div key={userId} className="hover:bg-gray-50">
                  {/* Employee Row */}
                  <div
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => {
                      if (expandedEmployee === userId) {
                        setExpandedEmployee(null);
                        setEmployeeDaily(null);
                      } else {
                        loadEmployeeDaily(userId);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                          {firstName?.[0]}{lastName?.[0]}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {firstName} {lastName}
                          </h4>
                          <p className="text-sm text-gray-500">{role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        {/* Total Actions */}
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">{employee.totalActions}</p>
                          <p className="text-xs text-gray-500">Actions totales</p>
                        </div>

                        {/* Action Breakdown Pills */}
                        <div className="flex gap-2">
                          {breakdown.creates > 0 && (
                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600" title="Créations">
                              +{breakdown.creates}
                            </div>
                          )}
                          {breakdown.updates > 0 && (
                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600" title="Modifications">
                              ✎{breakdown.updates}
                            </div>
                          )}
                          {breakdown.deletes > 0 && (
                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600" title="Suppressions">
                              ✕{breakdown.deletes}
                            </div>
                          )}
                          {breakdown.views > 0 && (
                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600" title="Consultations">
                              👁{breakdown.views}
                            </div>
                          )}
                          {breakdown.criticalActions > 0 && (
                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-700" title="Actions critiques">
                              ⚠{breakdown.criticalActions}
                            </div>
                          )}
                        </div>

                        {/* Last Activity */}
                        <div className="text-right min-w-[120px]">
                          <p className="text-sm text-gray-500">Dernière activité</p>
                          <p className="text-sm font-medium text-gray-900">
                            {employee.lastActivity
                              ? format(new Date(employee.lastActivity), 'dd/MM HH:mm', { locale: fr })
                              : 'N/A'}
                          </p>
                        </div>

                        {/* Expand Arrow */}
                        <div className="text-gray-400">
                          {expandedEmployee === userId ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Daily Breakdown */}
                  {expandedEmployee === userId && employeeDaily && (
                    <div className="px-6 pb-6 bg-gray-50">
                      <div className="ml-16 space-y-4">
                        <h5 className="font-medium text-gray-700 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Détail journalier
                        </h5>

                        {/* Action Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded bg-green-100">
                                <FileText className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{breakdown.creates || 0}</p>
                                <p className="text-xs text-gray-500">Créations</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded bg-yellow-100">
                                <Edit className="w-4 h-4 text-yellow-600" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{breakdown.updates || 0}</p>
                                <p className="text-xs text-gray-500">Modifications</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded bg-red-100">
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{breakdown.deletes || 0}</p>
                                <p className="text-xs text-gray-500">Suppressions</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded bg-blue-100">
                                <Eye className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{breakdown.views || 0}</p>
                                <p className="text-xs text-gray-500">Consultations</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Daily Breakdown from API */}
                        {employeeDaily.data && employeeDaily.data.length > 0 && (
                          <div className="mt-4">
                            <h6 className="text-sm font-medium text-gray-600 mb-2">Activité par jour</h6>
                            <div className="flex gap-2 flex-wrap">
                              {employeeDaily.data.map((day, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white rounded-lg px-3 py-2 shadow-sm text-center min-w-[80px]"
                                >
                                  <p className="text-xs text-gray-500">
                                    {day._id?.date || 'N/A'}
                                  </p>
                                  <p className="font-bold text-blue-600">{day.count}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Login Stats */}
                        {(breakdown.logins > 0 || breakdown.failedLogins > 0) && (
                          <div className="mt-4 flex gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <LogIn className="w-4 h-4 text-green-500" />
                              <span className="text-gray-600">{breakdown.logins || 0} connexions réussies</span>
                            </div>
                            {breakdown.failedLogins > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <XCircle className="w-4 h-4 text-red-500" />
                                <span className="text-red-600">{breakdown.failedLogins} connexions échouées</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* View All Logs Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilters(prev => ({ ...prev, search: `${firstName} ${lastName}` }));
                            setActiveTab('all');
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Voir tous les logs de cet employé
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}

      {/* Patient Access Tab Content */}
      {activeTab === 'patients' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Audit d'Accès aux Dossiers Patients (HIPAA)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Recherchez un patient pour voir qui a accédé à son dossier médical
            </p>
          </div>

          <div className="p-6">
            {/* Patient Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher un patient
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nom, prénom, ou ID du patient..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                💡 Entrez l'ID du patient pour voir l'historique complet d'accès à son dossier
              </p>
            </div>

            {/* Load Button */}
            {patientSearch && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    setSelectedPatient(patientSearch);
                    loadPatientAccessLogs(patientSearch);
                  }}
                  className="btn-primary flex items-center gap-2"
                  disabled={patientAccessLoading}
                >
                  {patientAccessLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Rechercher les accès
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Patient Access Logs */}
            {selectedPatient && !patientAccessLoading && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">
                    Accès au dossier du patient: {selectedPatient}
                  </h4>
                  <span className="text-sm text-gray-600">
                    {patientAccessLogs.length} accès trouvé(s)
                  </span>
                </div>

                {patientAccessLogs.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Aucun accès enregistré pour ce patient</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Les accès aux dossiers patients sont suivis pour la conformité HIPAA
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {patientAccessLogs.map((log, index) => {
                      const config = getActionConfig(log.action);
                      const IconComponent = config.icon;

                      return (
                        <div
                          key={log._id || index}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${config.bg}`}>
                                <IconComponent className={`w-5 h-5 ${config.color}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900">
                                    {log.user?.firstName} {log.user?.lastName}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {log.user?.role || 'Unknown'}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  {config.label} - {formatActionName(log.action)}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                                  </div>
                                  {log.ipAddress && (
                                    <div className="flex items-center gap-1">
                                      <Shield className="w-3 h-3" />
                                      {log.ipAddress}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {log.security?.suspicious && (
                              <div className="ml-4">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  Suspect
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {patientAccessLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-600">Chargement des accès patient...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Reports Tab Content */}
      {activeTab === 'compliance' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-green-600" />
              Rapports de Conformité HIPAA / GDPR
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Générez des rapports d'audit pour démontrer la conformité réglementaire
            </p>
          </div>

          <div className="p-6">
            {/* Report Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Report Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de rapport
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setComplianceType('hipaa')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      complianceType === 'hipaa'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">HIPAA</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Health Insurance Portability and Accountability Act
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      🇺🇸 Conformité USA - Données de santé protégées
                    </div>
                  </button>
                  <button
                    onClick={() => setComplianceType('gdpr')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      complianceType === 'gdpr'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">GDPR</div>
                    <div className="text-xs text-gray-600 mt-1">
                      General Data Protection Regulation
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      🇪🇺 Conformité UE - Protection des données personnelles
                    </div>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Période du rapport
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Date de début</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Date de fin</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={generateComplianceReport}
                disabled={complianceLoading}
                className="btn-primary flex items-center gap-2"
              >
                {complianceLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    Générer le rapport
                  </>
                )}
              </button>
              {complianceReport && (
                <button
                  onClick={exportComplianceReport}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exporter CSV
                </button>
              )}
            </div>

            {/* Report Results */}
            {complianceReport && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">
                  Résumé du rapport {complianceType.toUpperCase()}
                </h4>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {complianceReport.totalEvents || 0}
                    </div>
                    <div className="text-sm text-gray-600">Événements totaux</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {Object.keys(complianceReport.summary || {}).length}
                    </div>
                    <div className="text-sm text-gray-600">Types d'actions</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {format(new Date(complianceReport.period?.start || filters.startDate), 'dd/MM/yy')}
                    </div>
                    <div className="text-sm text-gray-600">Date de début</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {format(new Date(complianceReport.period?.end || filters.endDate), 'dd/MM/yy')}
                    </div>
                    <div className="text-sm text-gray-600">Date de fin</div>
                  </div>
                </div>

                {/* Action Breakdown */}
                {complianceReport.summary && Object.keys(complianceReport.summary).length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Détail par type d'action</h5>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-2">
                        {Object.entries(complianceReport.summary)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 10)
                          .map(([action, count]) => (
                            <div key={action} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                              <span className="text-sm text-gray-700">{formatActionName(action)}</span>
                              <span className="font-semibold text-gray-900">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Compliance Notes */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">Note de conformité</p>
                      {complianceType === 'hipaa' ? (
                        <p>
                          Ce rapport documente tous les accès aux informations de santé protégées (PHI) pour
                          la période spécifiée, conformément aux exigences de la règle de confidentialité HIPAA.
                        </p>
                      ) : (
                        <p>
                          Ce rapport documente tous les traitements de données personnelles pour
                          la période spécifiée, conformément aux exigences du RGPD (Articles 5, 32, 33).
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!complianceReport && !complianceLoading && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Aucun rapport généré</p>
                <p className="text-sm text-gray-500 mt-1">
                  Sélectionnez un type de rapport et une période, puis cliquez sur "Générer le rapport"
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logs Table - Only show when not on employees, patients, or compliance tabs */}
      {activeTab !== 'employees' && activeTab !== 'patients' && activeTab !== 'compliance' && (
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement des logs...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Aucun événement trouvé</h3>
            <p className="text-gray-500 mt-2">Modifiez vos filtres ou attendez de nouvelles activités</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Heure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ressource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adresse IP
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log, index) => {
                  const config = getActionConfig(log.action);
                  const IconComponent = config.icon;

                  return (
                    <tr key={log._id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-gray-400" />
                          {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${config.bg} mr-3`}>
                            <IconComponent className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatActionName(log.action)}
                            </p>
                            {log.security?.suspicious && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Suspect
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.user ? (
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                              <User className="h-4 w-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {log.user.firstName} {log.user.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{log.user.role}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Système</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900 max-w-xs truncate" title={log.resource}>
                          {log.resource}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ipAddress || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.responseStatus ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.responseStatus >= 200 && log.responseStatus < 300
                              ? 'bg-green-100 text-green-800'
                              : log.responseStatus >= 400
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {log.responseStatus}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {log.responseTime && (
                          <span className="ml-2 text-xs text-gray-400">
                            {log.responseTime}ms
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{(currentPage - 1) * limit + 1}</span> à{' '}
                  <span className="font-medium">{Math.min(currentPage * limit, totalCount)}</span> sur{' '}
                  <span className="font-medium">{totalCount}</span> résultats
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNum
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Top Actions Summary */}
      {stats?.actionStats && stats.actionStats.length > 0 && activeTab !== 'employees' && activeTab !== 'patients' && activeTab !== 'compliance' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions les plus fréquentes</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.actionStats.slice(0, 5).map((stat, index) => {
              const config = getActionConfig(stat._id);
              const IconComponent = config.icon;

              return (
                <div key={stat._id || index} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className={`inline-flex p-3 rounded-full ${config.bg} mb-2`}>
                    <IconComponent className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
                  <p className="text-xs text-gray-500 truncate">{formatActionName(stat._id)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin Note Modal */}
      {noteModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Ajouter une note d'administration
            </h3>
            <textarea
              value={noteModal.note}
              onChange={(e) => setNoteModal(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Entrez votre note ici..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setNoteModal({ open: false, logId: null, note: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteModal.note.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
