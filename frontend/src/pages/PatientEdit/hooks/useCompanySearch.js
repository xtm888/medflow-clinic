/**
 * useCompanySearch Hook
 *
 * Handles company search with debouncing for convention selection.
 */

import { useState, useEffect, useCallback } from 'react';
import { searchCompanies } from '../../../services/companyService';

export default function useCompanySearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchCompanies(searchTerm);
        setResults(result.data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Company search error:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const selectCompany = useCallback((company) => {
    setSelectedCompany(company);
    setSearchTerm(company.name);
    setShowDropdown(false);
  }, []);

  const clearCompany = useCallback(() => {
    setSelectedCompany(null);
    setSearchTerm('');
    setResults([]);
    setShowDropdown(false);
  }, []);

  const initializeWithCompany = useCallback((company) => {
    if (company) {
      setSelectedCompany(company);
      setSearchTerm(company.name || '');
    }
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    results,
    searching,
    showDropdown,
    setShowDropdown,
    selectedCompany,
    selectCompany,
    clearCompany,
    initializeWithCompany
  };
}
