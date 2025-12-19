/**
 * usePatientsData Hook
 *
 * Handles patient data fetching, filtering, and pagination.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import patientService from '../../../services/patientService';
import { DEFAULT_ADVANCED_FILTERS, ADVANCED_FILTER_KEYS, DEFAULT_PAGINATION } from '../constants';

export default function usePatientsData(selectedClinic) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Core state
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // Search and filter state - initialized from URL
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [searchType, setSearchType] = useState(searchParams.get('searchType') || 'all');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'name');

  // Advanced filters - initialized from URL
  const [advancedFilters, setAdvancedFilters] = useState(() => ({
    ...DEFAULT_ADVANCED_FILTERS,
    ...Object.fromEntries(
      ADVANCED_FILTER_KEYS.filter(key => searchParams.get(key))
        .map(key => [key, searchParams.get(key)])
    )
  }));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination - page from URL
  const [pagination, setPagination] = useState({
    ...DEFAULT_PAGINATION,
    page: parseInt(searchParams.get('page')) || 1
  });

  // Check if URL has advanced filters on mount
  const hasUrlAdvancedFilters = useMemo(() => {
    return ADVANCED_FILTER_KEYS.some(key => searchParams.get(key));
  }, []);

  const hasActiveFilters = useCallback(() => {
    return Object.values(advancedFilters).some(v => v !== '');
  }, [advancedFilters]);

  // Update URL params
  const updateUrlParams = useCallback((updates = {}) => {
    const newParams = new URLSearchParams(searchParams);

    // Search term
    const currentSearch = updates.q !== undefined ? updates.q : searchTerm;
    if (currentSearch) {
      newParams.set('q', currentSearch);
    } else {
      newParams.delete('q');
    }

    // Priority filter
    const currentPriority = updates.priority !== undefined ? updates.priority : priorityFilter;
    if (currentPriority && currentPriority !== 'all') {
      newParams.set('priority', currentPriority);
    } else {
      newParams.delete('priority');
    }

    // Sort
    const currentSort = updates.sort !== undefined ? updates.sort : sortBy;
    if (currentSort && currentSort !== 'name') {
      newParams.set('sort', currentSort);
    } else {
      newParams.delete('sort');
    }

    // Page
    const currentPage = updates.page !== undefined ? updates.page : pagination.page;
    if (currentPage > 1) {
      newParams.set('page', currentPage.toString());
    } else {
      newParams.delete('page');
    }

    // Advanced filters
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
  const fetchPatients = useCallback(async (useAdvanced = false) => {
    try {
      setLoading(true);
      setError(null);

      let response;

      if (searchType === 'legacyId' && searchTerm) {
        response = await patientService.searchByLegacyId(searchTerm);
      } else if (useAdvanced && hasActiveFilters()) {
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

      // Handle various response formats
      let patientsData = [];
      let responseTotal = 0;
      let responsePages = 1;

      if (Array.isArray(response)) {
        patientsData = response;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
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
  }, [searchTerm, searchType, advancedFilters, pagination.page, pagination.limit, hasActiveFilters]);

  // Filter and sort patients
  const filteredPatients = useMemo(() => {
    return patients
      .filter(patient => {
        if (!hasActiveFilters()) {
          const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
          const phone = patient.phoneNumber || patient.phone || '';
          const patientId = patient.patientId || '';
          const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
            phone.includes(searchTerm) ||
            patientId.toLowerCase().includes(searchTerm.toLowerCase());

          let matchesPriority = true;
          if (priorityFilter !== 'all') {
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
  }, [patients, searchTerm, priorityFilter, sortBy, hasActiveFilters]);

  // Load patients on mount
  useEffect(() => {
    if (hasUrlAdvancedFilters) {
      setShowAdvancedFilters(true);
      fetchPatients(true);
    } else {
      fetchPatients();
    }
  }, [pagination.page]);

  // Refetch when clinic changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchPatients(hasActiveFilters());
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedClinic]);

  // Debounced search
  useEffect(() => {
    if (searchTerm !== '') {
      setSearching(true);
    }
    const timeout = setTimeout(async () => {
      if (searchTerm !== '') {
        await fetchPatients(hasActiveFilters());
      }
      updateUrlParams({ q: searchTerm });
      setSearching(false);
    }, 300);
    return () => {
      clearTimeout(timeout);
      setSearching(false);
    };
  }, [searchTerm]);

  // Actions
  const applyAdvancedFilters = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchPatients(true);
    setShowAdvancedFilters(false);
    updateUrlParams({ advancedFilters, page: 1 });
  }, [advancedFilters, fetchPatients, updateUrlParams]);

  const resetFilters = useCallback(() => {
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setSearchTerm('');
    setPriorityFilter('all');
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchPatients(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [fetchPatients, setSearchParams]);

  const handleAdvancedFilterChange = useCallback((field, value) => {
    setAdvancedFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const goToPage = useCallback((page) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  return {
    // Data
    patients,
    filteredPatients,
    pagination,

    // Loading states
    loading,
    searching,
    error,

    // Search/filter state
    searchTerm,
    setSearchTerm,
    searchType,
    setSearchType,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,

    // Advanced filters
    advancedFilters,
    showAdvancedFilters,
    setShowAdvancedFilters,
    handleAdvancedFilterChange,
    hasActiveFilters,

    // Actions
    fetchPatients,
    applyAdvancedFilters,
    resetFilters,
    goToPage,
    updateUrlParams
  };
}
