import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search, Plus, Edit, Eye, Phone, Mail, AlertCircle, Star, Loader2,
  Filter, Download, X, ChevronDown, RefreshCw, Users, GitMerge, Keyboard,
  CheckSquare, Square, Trash2, Calendar, FileText, MoreHorizontal
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import PatientRegistrationWizard from '../components/PatientRegistration';
import EmptyState from '../components/EmptyState';
import { PatientPhotoAvatar } from '../components/biometric';
import PatientPreviewCard from '../components/PatientPreviewCard';
import patientService from '../services/patientService';
import { toast } from 'react-toastify';
import PermissionGate from '../components/PermissionGate';
import { useClinic } from '../contexts/ClinicContext';

export default function Patients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedClinic } = useClinic();

  // Initialize state from URL params (persistent filters)
  const getInitialFilters = useCallback(() => ({
    ageMin: searchParams.get('ageMin') || '',
    ageMax: searchParams.get('ageMax') || '',
    gender: searchParams.get('gender') || '',
    bloodType: searchParams.get('bloodType') || '',
    insurance: searchParams.get('insurance') || '',
    lastVisitFrom: searchParams.get('lastVisitFrom') || '',
    lastVisitTo: searchParams.get('lastVisitTo') || '',
    hasAllergies: searchParams.get('hasAllergies') || ''
  }), []);

  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'name');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // Advanced filters state - initialized from URL
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(getInitialFilters);

  // Duplicate merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [selectedForMerge, setSelectedForMerge] = useState({ primary: null, secondary: null });

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const searchInputRef = useRef(null);

  // Batch operations state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [showBatchActionsMenu, setShowBatchActionsMenu] = useState(false);

  // Search type state for legacy ID search
  const [searchType, setSearchType] = useState(searchParams.get('searchType') || 'all');

  // Pagination - page from URL
  const [pagination, setPagination] = useState({
    page: parseInt(searchParams.get('page')) || 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Sync filters to URL params
  const updateUrlParams = useCallback((updates = {}) => {
    const newParams = new URLSearchParams(searchParams);

    // Update with any specific overrides
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '' && value !== '1') {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    // Set search term
    const currentSearch = updates.q !== undefined ? updates.q : searchTerm;
    if (currentSearch) {
      newParams.set('q', currentSearch);
    } else {
      newParams.delete('q');
    }

    // Set priority filter
    const currentPriority = updates.priority !== undefined ? updates.priority : priorityFilter;
    if (currentPriority && currentPriority !== 'all') {
      newParams.set('priority', currentPriority);
    } else {
      newParams.delete('priority');
    }

    // Set sort
    const currentSort = updates.sort !== undefined ? updates.sort : sortBy;
    if (currentSort && currentSort !== 'name') {
      newParams.set('sort', currentSort);
    } else {
      newParams.delete('sort');
    }

    // Set page
    const currentPage = updates.page !== undefined ? updates.page : pagination.page;
    if (currentPage > 1) {
      newParams.set('page', currentPage.toString());
    } else {
      newParams.delete('page');
    }

    // Set advanced filters
    const currentAdvFilters = updates.advancedFilters !== undefined ? updates.advancedFilters : advancedFilters;
    Object.entries(currentAdvFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams, searchTerm, priorityFilter, sortBy, pagination.page, advancedFilters]);

  // Fetch patients from API
  const fetchPatients = async (useAdvanced = false) => {
    try {
      setLoading(true);
      setError(null);

      let response;

      // Note: Clinic filtering is handled automatically by the API interceptor
      // which sets the X-Clinic-ID header from localStorage

      // Handle legacy ID search
      if (searchType === 'legacyId' && searchTerm) {
        response = await patientService.searchByLegacyId(searchTerm);
      } else if (useAdvanced && hasActiveFilters()) {
        // Use advanced search endpoint
        const params = {
          search: searchTerm,
          ...Object.fromEntries(
            Object.entries(advancedFilters).filter(([_, v]) => v !== '')
          ),
          page: pagination.page,
          limit: pagination.limit
        };
        response = await patientService.advancedSearch(params);
      } else {
        response = await patientService.getPatients({
          limit: pagination.limit,
          page: pagination.page,
          search: searchTerm,
          searchType: searchType !== 'all' ? searchType : undefined
        });
      }

      // Ensure we always get an array - handle various response formats
      // Response can be: array, { data: array }, { data: { data: array } }, or { patients: array }
      let patientsData = [];
      let responseTotal = 0;
      let responsePages = 1;

      if (Array.isArray(response)) {
        patientsData = response;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        // Nested format: axios wraps API response { data: { success, data: [...], total, pages } }
        patientsData = response.data.data;
        responseTotal = response.data.total || 0;
        responsePages = response.data.pages || 1;
      } else if (response?.data && Array.isArray(response.data)) {
        patientsData = response.data;
        responseTotal = response.total || 0;
        responsePages = response.pages || 1;
      } else if (response?.patients && Array.isArray(response.patients)) {
        patientsData = response.patients;
        responseTotal = response.total || 0;
        responsePages = response.pages || 1;
      } else {
        console.warn('Unexpected response format:', response);
        patientsData = [];
      }
      setPatients(patientsData);
      setPagination(prev => ({
        ...prev,
        total: responseTotal || patientsData.length,
        pages: responsePages
      }));
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Erreur lors du chargement des patients');
      toast.error('Erreur lors du chargement des patients');
    } finally {
      setLoading(false);
    }
  };

  const hasActiveFilters = () => {
    return Object.values(advancedFilters).some(v => v !== '');
  };

  // Check if URL has advanced filters on mount
  const hasUrlAdvancedFilters = useMemo(() => {
    const advFilterKeys = ['ageMin', 'ageMax', 'gender', 'bloodType', 'insurance', 'lastVisitFrom', 'lastVisitTo', 'hasAllergies'];
    return advFilterKeys.some(key => searchParams.get(key));
  }, []);

  // Load patients on mount - use advanced search if URL has filters
  useEffect(() => {
    if (hasUrlAdvancedFilters) {
      setShowAdvancedFilters(true);
      fetchPatients(true);
    } else {
      fetchPatients();
    }
  }, [pagination.page]);

  // Refetch patients when clinic changes
  useEffect(() => {
    // Small delay to ensure localStorage is updated by ClinicContext
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchPatients(hasActiveFilters());
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedClinic]);

  // Debounced search with URL sync
  useEffect(() => {
    if (searchTerm !== '') {
      setSearching(true);
    }
    const timeout = setTimeout(async () => {
      if (searchTerm !== '') {
        await fetchPatients(hasActiveFilters());
      }
      // Sync search term to URL
      updateUrlParams({ q: searchTerm });
      setSearching(false);
    }, 300);
    return () => {
      clearTimeout(timeout);
      setSearching(false);
    };
  }, [searchTerm]);

  // Sync priority filter to URL
  useEffect(() => {
    updateUrlParams({ priority: priorityFilter });
  }, [priorityFilter]);

  // Sync sort to URL
  useEffect(() => {
    updateUrlParams({ sort: sortBy });
  }, [sortBy]);

  // Sync page to URL
  useEffect(() => {
    updateUrlParams({ page: pagination.page });
  }, [pagination.page]);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get gender display
  const getGenderDisplay = (gender) => {
    if (!gender) return 'N/A';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'Homme';
    if (g === 'female' || g === 'f') return 'Femme';
    return gender;
  };

  // Handle advanced filter change
  const handleAdvancedFilterChange = (field, value) => {
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  };

  // Apply advanced filters
  const applyAdvancedFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchPatients(true);
    setShowAdvancedFilters(false);
    // Sync advanced filters to URL
    updateUrlParams({ advancedFilters, page: 1 });
  };

  // Reset filters
  const resetFilters = () => {
    const emptyFilters = {
      ageMin: '',
      ageMax: '',
      gender: '',
      bloodType: '',
      insurance: '',
      lastVisitFrom: '',
      lastVisitTo: '',
      hasAllergies: ''
    };
    setAdvancedFilters(emptyFilters);
    setSearchTerm('');
    setPriorityFilter('all');
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchPatients(false);
    // Clear all URL params
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // Batch selection helpers
  const togglePatientSelection = (patientId) => {
    setSelectedPatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  const selectAllPatients = () => {
    setSelectedPatients(new Set(filteredPatients.map(p => p._id || p.id)));
  };

  const clearSelection = () => {
    setSelectedPatients(new Set());
    setSelectionMode(false);
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      clearSelection();
    }
    setSelectionMode(!selectionMode);
  };

  // Batch operations
  const handleBatchExport = async () => {
    if (selectedPatients.size === 0) return;

    setBatchActionLoading(true);
    try {
      const selectedIds = Array.from(selectedPatients);
      toast.info(`Export de ${selectedIds.length} patient(s)...`);

      // Export selected patients
      const selectedData = filteredPatients.filter(p =>
        selectedPatients.has(p._id || p.id)
      );

      // Create CSV
      const headers = ['ID', 'Prénom', 'Nom', 'Téléphone', 'Email', 'Date de naissance'];
      const rows = selectedData.map(p => [
        p.patientId || p._id,
        p.firstName,
        p.lastName,
        p.phone || '',
        p.email || '',
        p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('fr-FR') : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_selection_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${selectedIds.length} patient(s) exporté(s)`);
      clearSelection();
    } catch (err) {
      console.error('Batch export error:', err);
      toast.error('Erreur lors de l\'export');
    } finally {
      setBatchActionLoading(false);
      setShowBatchActionsMenu(false);
    }
  };

  const handleBatchBookAppointments = () => {
    if (selectedPatients.size === 0) return;

    const selectedIds = Array.from(selectedPatients);
    // Store selected patient IDs and navigate to appointments with batch mode
    sessionStorage.setItem('batchPatientIds', JSON.stringify(selectedIds));
    toast.info(`${selectedIds.length} patient(s) sélectionné(s) pour prise de RDV`);
    navigate('/appointments?batch=true');
  };

  const handleBatchSendMessage = async () => {
    if (selectedPatients.size === 0) return;

    const selectedData = filteredPatients.filter(p =>
      selectedPatients.has(p._id || p.id)
    );

    const withEmail = selectedData.filter(p => p.email);
    const withPhone = selectedData.filter(p => p.phone);

    toast.info(
      `${withEmail.length} patient(s) avec email, ${withPhone.length} avec téléphone`
    );

    // This would integrate with a messaging service
    setShowBatchActionsMenu(false);
  };

  // Export patients
  const handleExport = async (format = 'csv') => {
    try {
      setShowExportMenu(false);
      toast.info(`Export ${format.toUpperCase()} en cours...`);
      const response = await fetch(`/api/patients/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export terminé!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erreur lors de l\'export');
    }
  };

  // Check for duplicates
  const handleCheckDuplicates = async () => {
    try {
      toast.info('Recherche de doublons...');
      const response = await patientService.checkDuplicates({});
      if (response.hasDuplicates) {
        setDuplicates(response.data);
        setShowMergeModal(true);
      } else {
        toast.info('Aucun doublon detecte');
      }
    } catch (err) {
      toast.error('Erreur lors de la recherche de doublons');
    }
  };

  // Merge patients
  const handleMergePatients = async () => {
    if (!selectedForMerge.primary || !selectedForMerge.secondary) {
      toast.error('Selectionnez les deux patients a fusionner');
      return;
    }

    try {
      await patientService.mergePatients(selectedForMerge.primary, selectedForMerge.secondary);
      toast.success('Patients fusionnes avec succes');
      setShowMergeModal(false);
      setSelectedForMerge({ primary: null, secondary: null });
      fetchPatients();
    } catch (err) {
      toast.error('Erreur lors de la fusion');
    }
  };

  // Filter and sort patients based on search, priority, and sort order
  const filteredPatients = patients
    .filter(patient => {
      // Search filter (if not using backend search)
      if (!hasActiveFilters()) {
        const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
        const phone = patient.phoneNumber || patient.phone || '';
        const patientId = patient.patientId || '';
        const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
          phone.includes(searchTerm) ||
          patientId.toLowerCase().includes(searchTerm.toLowerCase());

        // Priority filter (VIP is a separate boolean, so handle it specially)
        let matchesPriority = true;
        if (priorityFilter !== 'all') {
          // Determine effective priority: VIP takes precedence over priority field
          const effectiveFilter = patient.vip ? 'VIP' : (patient.priority || patient.patientType || 'normal').toUpperCase();
          matchesPriority = effectiveFilter === priorityFilter;
        }

        return matchesSearch && matchesPriority;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const nameA = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
          const nameB = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
          return nameA.localeCompare(nameB);
        case 'lastVisit':
          const dateA = a.lastVisit ? new Date(a.lastVisit) : new Date(0);
          const dateB = b.lastVisit ? new Date(b.lastVisit) : new Date(0);
          return dateB - dateA;
        case 'nextAppointment':
          const apptA = a.nextAppointment ? new Date(a.nextAppointment) : new Date('9999-12-31');
          const apptB = b.nextAppointment ? new Date(b.nextAppointment) : new Date('9999-12-31');
          return apptA - apptB;
        default:
          return 0;
      }
    });

  // Handle wizard submission
  const handleWizardSubmit = async (patientData) => {
    try {
      setLoading(true);
      const response = await patientService.createPatient(patientData);

      // Extract patient ID from response (handle various formats)
      const newPatient = response?.data?.data || response?.data || response;
      const patientId = newPatient?._id || newPatient?.id;

      toast.success('Patient créé avec succès!');
      setShowWizard(false);
      await fetchPatients();

      // Navigate to the new patient's profile
      if (patientId) {
        navigate(`/patients/${patientId}`);
      }
    } catch (error) {
      console.error('Error creating patient:', error);

      // Show specific validation error if available
      const errorMessage = error.response?.data?.error
        || error.message
        || 'Erreur lors de la création du patient';

      toast.error(errorMessage);

      // Don't close the wizard on error so user can fix the data
      // setShowWizard(false);
    } finally {
      setLoading(false);
    }
  };

  // Check if any modal is open
  const isModalOpen = showWizard || showMergeModal || showShortcutsHelp;

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => ({
    'n': () => {
      if (!isModalOpen) {
        setShowWizard(true);
      }
    },
    '/': () => {
      if (!isModalOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    },
    'f': () => {
      if (!isModalOpen) {
        setShowAdvancedFilters(!showAdvancedFilters);
      }
    },
    'r': () => {
      if (!isModalOpen) {
        fetchPatients();
        toast.info('Liste actualisée');
      }
    },
    'd': () => {
      if (!isModalOpen) {
        handleCheckDuplicates();
      }
    },
    '1': () => {
      if (!isModalOpen && patients[0]) {
        navigate(`/patients/${patients[0]._id}`);
      }
    },
    '2': () => {
      if (!isModalOpen && patients[1]) {
        navigate(`/patients/${patients[1]._id}`);
      }
    },
    '3': () => {
      if (!isModalOpen && patients[2]) {
        navigate(`/patients/${patients[2]._id}`);
      }
    },
    'esc': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showWizard) setShowWizard(false);
      else if (showMergeModal) setShowMergeModal(false);
      else if (showAdvancedFilters) setShowAdvancedFilters(false);
      else if (showExportMenu) setShowExportMenu(false);
    },
    '?': () => {
      setShowShortcutsHelp(true);
    }
  }), [isModalOpen, showAdvancedFilters, showExportMenu, patients, navigate]);

  // Enable keyboard shortcuts
  useKeyboardShortcuts(keyboardShortcuts, true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Patients</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.total} patients enregistres
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
              title="Raccourcis clavier (appuyez sur ?)"
            >
              <Keyboard className="h-3 w-3 mr-1" />
              <span className="text-xs">Raccourcis</span>
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Batch Selection Mode Toggle */}
          <button
            onClick={toggleSelectionMode}
            className={`btn ${selectionMode ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
            title="Mode sélection multiple"
          >
            {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            <span className="hidden sm:inline">{selectionMode ? 'Annuler' : 'Sélection'}</span>
          </button>
          <PermissionGate permission="view_reports" roles={['accountant']}>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exporter</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Exporter en CSV
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Exporter en PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </PermissionGate>
          <PermissionGate permission="register_patients" roles={['admin', 'receptionist', 'nurse']}>
            <button
              onClick={() => setShowWizard(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              <span>Nouveau patient</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1 max-w-xl flex gap-2">
              {/* Search Type Dropdown */}
              <select
                value={searchType}
                onChange={(e) => {
                  setSearchType(e.target.value);
                  if (searchTerm) {
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }
                }}
                className="input w-40 text-sm"
              >
                <option value="all">Tous les champs</option>
                <option value="name">Nom</option>
                <option value="phone">Téléphone</option>
                <option value="patientId">ID Patient</option>
                <option value="legacyId">ID Legacy / Dossier</option>
              </select>
              <div className="relative flex-1">
                {searching ? (
                  <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500 animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchType === 'legacyId' ? "Rechercher par ID legacy ou dossier..." : "Rechercher... (appuyez /)"}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 pr-24 w-full"
                />
                {/* Search result count */}
                {searchTerm && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
                    {searching ? (
                      <span className="text-xs text-gray-400">Recherche...</span>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        filteredPatients.length > 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {filteredPatients.length} résultat{filteredPatients.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                className="input"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">Tous les patients</option>
                <option value="VIP">VIP</option>
                <option value="PREGNANT">Femmes enceintes</option>
                <option value="ELDERLY">Personnes agees</option>
              </select>
              <select
                className="input"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Trier par nom</option>
                <option value="lastVisit">Derniere visite</option>
                <option value="nextAppointment">Prochain RDV</option>
              </select>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`btn ${showAdvancedFilters || hasActiveFilters() ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
              >
                <Filter className="h-4 w-4" />
                Filtres
                {hasActiveFilters() && (
                  <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs">
                    {Object.values(advancedFilters).filter(v => v !== '').length}
                  </span>
                )}
              </button>
              {hasActiveFilters() && (
                <button
                  onClick={resetFilters}
                  className="btn btn-secondary flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Filtres avances</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Age min</label>
                  <input
                    type="number"
                    value={advancedFilters.ageMin}
                    onChange={(e) => handleAdvancedFilterChange('ageMin', e.target.value)}
                    className="input"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Age max</label>
                  <input
                    type="number"
                    value={advancedFilters.ageMax}
                    onChange={(e) => handleAdvancedFilterChange('ageMax', e.target.value)}
                    className="input"
                    placeholder="120"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sexe</label>
                  <select
                    value={advancedFilters.gender}
                    onChange={(e) => handleAdvancedFilterChange('gender', e.target.value)}
                    className="input"
                  >
                    <option value="">Tous</option>
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Groupe sanguin</label>
                  <select
                    value={advancedFilters.bloodType}
                    onChange={(e) => handleAdvancedFilterChange('bloodType', e.target.value)}
                    className="input"
                  >
                    <option value="">Tous</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assurance</label>
                  <input
                    type="text"
                    value={advancedFilters.insurance}
                    onChange={(e) => handleAdvancedFilterChange('insurance', e.target.value)}
                    className="input"
                    placeholder="Nom de l'assurance"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Derniere visite depuis</label>
                  <input
                    type="date"
                    value={advancedFilters.lastVisitFrom}
                    onChange={(e) => handleAdvancedFilterChange('lastVisitFrom', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Derniere visite jusqu'a</label>
                  <input
                    type="date"
                    value={advancedFilters.lastVisitTo}
                    onChange={(e) => handleAdvancedFilterChange('lastVisitTo', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Allergies</label>
                  <select
                    value={advancedFilters.hasAllergies}
                    onChange={(e) => handleAdvancedFilterChange('hasAllergies', e.target.value)}
                    className="input"
                  >
                    <option value="">Tous</option>
                    <option value="true">Avec allergies</option>
                    <option value="false">Sans allergies</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={applyAdvancedFilters} className="btn btn-primary">
                  Appliquer les filtres
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="ml-2 text-gray-600">Chargement des patients...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
          <button
            onClick={() => fetchPatients()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Reessayer
          </button>
        </div>
      )}

      {/* Patients List */}
      {!loading && !error && (
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Selection checkbox column */}
                  {selectionMode && (
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      <button
                        onClick={() => {
                          if (selectedPatients.size === filteredPatients.length) {
                            clearSelection();
                          } else {
                            selectAllPatients();
                          }
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={selectedPatients.size === filteredPatients.length ? 'Désélectionner tout' : 'Sélectionner tout'}
                      >
                        {selectedPatients.size === filteredPatients.length && filteredPatients.length > 0 ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : selectedPatients.size > 0 ? (
                          <div className="h-5 w-5 border-2 border-blue-600 rounded bg-blue-100 flex items-center justify-center">
                            <div className="h-2 w-2 bg-blue-600 rounded-sm"></div>
                          </div>
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priorite
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Derniere visite
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prochain RDV
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={selectionMode ? "7" : "6"} className="px-0">
                      {searchTerm || priorityFilter !== 'all' || hasActiveFilters() ? (
                        <EmptyState type="filtered" compact={true} />
                      ) : (
                        <EmptyState
                          type="patients"
                          customAction={{
                            label: 'Ajouter un patient',
                            path: '#',
                            onClick: () => setShowWizard(true)
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const age = calculateAge(patient.dateOfBirth);
                    const phone = patient.phoneNumber || patient.phone || 'N/A';
                    const email = patient.email || 'N/A';
                    const bloodType = patient.bloodGroup || patient.bloodType || 'N/A';
                    // Determine effective priority: VIP takes precedence, then priority field, then normal
                    const effectivePriority = patient.vip ? 'vip' : (patient.priority || patient.patientType || 'normal');
                    const isVip = patient.vip;
                    const lastVisit = patient.lastVisit || patient.lastVisitDate;
                    const nextAppointment = patient.nextAppointment || patient.nextAppointmentDate;
                    const allergies = patient.medicalHistory?.allergies || patient.allergies || [];
                    const insurance = patient.insurance?.provider || patient.insurance || 'N/A';
                    const address = typeof patient.address === 'object'
                      ? `${patient.address.street || ''} ${patient.address.city || ''}`
                      : patient.address || 'N/A';

                    return (
                      <tr
                      key={patient._id || patient.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectionMode && selectedPatients.has(patient._id || patient.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                        {/* Selection checkbox */}
                        {selectionMode && (
                          <td className="px-3 py-4 whitespace-nowrap">
                            <button
                              onClick={() => togglePatientSelection(patient._id || patient.id)}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                              {selectedPatients.has(patient._id || patient.id) ? (
                                <CheckSquare className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <PatientPreviewCard patient={patient} position="right">
                            <div className="flex items-center cursor-pointer">
                              <PatientPhotoAvatar
                                patient={patient}
                                size="sm"
                                showBiometricBadge={true}
                              />
                              <div className="ml-4">
                                <div className="flex items-center space-x-2">
                                  <div className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                                    {patient.firstName} {patient.lastName}
                                  </div>
                                  {isVip && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                                  {/* Legacy/Incomplete data badge */}
                                  {(patient.dataStatus === 'incomplete' || patient.legacyId) && (
                                    <span
                                      className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded border border-amber-300"
                                      title={patient.placeholderFields?.length > 0
                                        ? `Données incomplètes: ${patient.placeholderFields.join(', ')}`
                                        : 'Données importées du système legacy'
                                      }
                                    >
                                      LEGACY
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {patient.patientId && <span className="mr-2">{patient.patientId}</span>}
                                  {age !== 'N/A' && `${age} ans`} · {getGenderDisplay(patient.gender)} · {bloodType}
                                </div>
                              </div>
                            </div>
                          </PatientPreviewCard>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center text-sm text-gray-900">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {phone}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              {email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            effectivePriority === 'vip' ? 'bg-purple-100 text-purple-800' :
                            effectivePriority === 'pregnant' ? 'bg-pink-100 text-pink-800' :
                            effectivePriority === 'elderly' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {effectivePriority === 'vip' ? 'VIP' :
                             effectivePriority === 'pregnant' ? 'Enceinte' :
                             effectivePriority === 'elderly' ? 'Age' :
                             'Normal'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {lastVisit ? new Date(lastVisit).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {nextAppointment ? new Date(nextAppointment).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => navigate(`/patients/${patient._id || patient.id}`)}
                              className="text-primary-600 hover:text-primary-900"
                              title="Voir le dossier"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => navigate(`/patients/${patient._id || patient.id}/edit`)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Modifier"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredPatients.length > 0 && pagination.pages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Page {pagination.page} sur {pagination.pages} ({pagination.total} patients)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="btn btn-secondary btn-sm"
                >
                  Precedent
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="btn btn-secondary btn-sm"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}

          {/* Results count */}
          {filteredPatients.length > 0 && pagination.pages <= 1 && (
            <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500">
              {filteredPatients.length} patient{filteredPatients.length > 1 ? 's' : ''} trouve{filteredPatients.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Patient Details Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </h2>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPatient.patientId && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID Patient</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedPatient.patientId}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Age</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.age} ans</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Sexe</label>
                    <p className="mt-1 text-sm text-gray-900">{getGenderDisplay(selectedPatient.gender)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Groupe sanguin</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.bloodType}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Duplicates Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <GitMerge className="h-5 w-5" />
                Fusionner les doublons ({duplicates.length} detectes)
              </h2>
              <button
                onClick={() => setShowMergeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Selectionnez le patient principal (dont les donnees seront conservees) et le patient secondaire (qui sera fusionne puis desactive).
              </p>

              <div className="space-y-3">
                {duplicates.map((dup, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        dup.confidence >= 90 ? 'bg-red-100 text-red-700' :
                        dup.confidence >= 70 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {dup.confidence}% de confiance - {dup.message}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium">{dup.patient.firstName} {dup.patient.lastName}</p>
                        <p className="text-sm text-gray-500">{dup.patient.patientId}</p>
                        <p className="text-sm text-gray-500">{dup.patient.phoneNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedForMerge(prev => ({ ...prev, primary: dup.patient._id }))}
                          className={`btn btn-sm ${selectedForMerge.primary === dup.patient._id ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Principal
                        </button>
                        <button
                          onClick={() => setSelectedForMerge(prev => ({ ...prev, secondary: dup.patient._id }))}
                          className={`btn btn-sm ${selectedForMerge.secondary === dup.patient._id ? 'btn-danger' : 'btn-secondary'}`}
                        >
                          Secondaire
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowMergeModal(false)} className="btn btn-secondary">
                  Annuler
                </button>
                <button
                  onClick={handleMergePatients}
                  disabled={!selectedForMerge.primary || !selectedForMerge.secondary}
                  className="btn btn-primary"
                >
                  Fusionner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Registration Wizard */}
      {showWizard && (
        <PatientRegistrationWizard
          onClose={() => setShowWizard(false)}
          onSubmit={handleWizardSubmit}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Raccourcis Clavier</h2>
              </div>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {/* Patient Actions */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Actions Patients
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Nouveau patient</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">N</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Rechercher</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">/</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Filtres avancés</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">F</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Rafraîchir</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">R</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Détecter doublons</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">D</kbd>
                    </div>
                  </div>
                </div>

                {/* Quick Access */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Accès Rapide
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Ouvrir patient #1</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">1</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Ouvrir patient #2</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">2</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Ouvrir patient #3</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">3</kbd>
                    </div>
                  </div>
                </div>

                {/* Interface */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Interface
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Fermer modal</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">Esc</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Afficher cette aide</span>
                      <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">?</kbd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-gray-500 text-center">
                  Les raccourcis sont désactivés quand vous tapez dans un champ
                </p>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="btn btn-primary"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Batch Actions Toolbar */}
      {selectionMode && selectedPatients.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 px-4 py-3 flex items-center gap-4">
            {/* Selection count */}
            <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-900">
                {selectedPatients.size} sélectionné{selectedPatients.size > 1 ? 's' : ''}
              </span>
            </div>

            {/* Batch actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchExport}
                disabled={batchActionLoading}
                className="btn btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                title="Exporter la sélection"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exporter</span>
              </button>

              <button
                onClick={handleBatchBookAppointments}
                disabled={batchActionLoading}
                className="btn btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                title="Prendre RDV pour la sélection"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">RDV groupé</span>
              </button>

              <button
                onClick={handleBatchSendMessage}
                disabled={batchActionLoading}
                className="btn btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                title="Envoyer message groupé"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Message</span>
              </button>

              <div className="w-px h-6 bg-gray-200"></div>

              <button
                onClick={clearSelection}
                className="btn btn-ghost text-sm px-3 py-2 flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Annuler</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
