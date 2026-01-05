/**
 * useMedicationSearch Hook
 *
 * Handles medication search with debouncing.
 */

import { useState, useEffect, useCallback } from 'react';
import medicationService from '../../../services/medicationService';

export default function useMedicationSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await medicationService.searchMedications(searchTerm, { limit: 10 });
        // Handle various API response formats defensively
        const medications = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
          ? result.data
          : [];
        setResults(medications);
      } catch (err) {
        console.error('Medication search error:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setResults([]);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    results,
    searching,
    clearSearch
  };
}
