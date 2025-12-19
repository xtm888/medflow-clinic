/**
 * useTreatmentProtocols - Hook for treatment protocol management
 *
 * StudioVision Parity: Enables "2-click" prescription workflow through:
 * - Quick protocol selection by category
 * - One-click protocol application
 * - Smart protocol suggestions based on diagnosis
 * - Favorite protocol management
 *
 * Usage:
 * const {
 *   protocols, categories, loading, error,
 *   applyProtocol, getByCategory, getSuggested
 * } = useTreatmentProtocols();
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import treatmentProtocolService from '../services/treatmentProtocolService';

/**
 * Main hook for treatment protocol operations
 */
export default function useTreatmentProtocols(options = {}) {
  const {
    autoLoadCategories = true,
    autoLoadPopular = true,
    patientContext = null
  } = options;

  // State
  const [protocols, setProtocols] = useState([]);
  const [categories, setCategories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [popular, setPopular] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const mountedRef = useRef(true);

  // Load categories on mount
  useEffect(() => {
    if (autoLoadCategories) {
      loadCategories();
    }
    if (autoLoadPopular) {
      loadPopular();
    }

    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const result = await treatmentProtocolService.getCategories();
      if (mountedRef.current && result?.data) {
        setCategories(result.data);
      }
    } catch (err) {
      console.error('Failed to load protocol categories:', err);
    }
  }, []);

  // Load popular protocols
  const loadPopular = useCallback(async (limit = 10) => {
    try {
      const result = await treatmentProtocolService.getPopularProtocols(limit);
      if (mountedRef.current && result?.data) {
        setPopular(result.data);
      }
    } catch (err) {
      console.error('Failed to load popular protocols:', err);
    }
  }, []);

  // Load favorites
  const loadFavorites = useCallback(async () => {
    try {
      const result = await treatmentProtocolService.getFavoriteProtocols();
      if (mountedRef.current && result?.data) {
        setFavorites(result.data);
      }
    } catch (err) {
      console.error('Failed to load favorite protocols:', err);
    }
  }, []);

  // Get protocols by category
  const getByCategory = useCallback(async (category, includePersonal = true) => {
    if (!category) return [];

    setLoading(true);
    setError(null);
    setSelectedCategory(category);

    try {
      const result = await treatmentProtocolService.getProtocolsByCategory(category, includePersonal);
      if (mountedRef.current) {
        setProtocols(result?.data || []);
        setLoading(false);
        return result?.data || [];
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
      throw err;
    }
  }, []);

  // Get suggested protocols based on context
  const getSuggested = useCallback(async (context = {}) => {
    setLoading(true);
    try {
      const result = await treatmentProtocolService.getSuggestedProtocols(context);
      if (mountedRef.current) {
        setSuggested(result?.data || []);
        setLoading(false);
        return result?.data || [];
      }
    } catch (err) {
      if (mountedRef.current) {
        setLoading(false);
      }
      throw err;
    }
  }, []);

  // Apply protocol - returns prescription-ready medications
  const applyProtocol = useCallback(async (protocolId, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await treatmentProtocolService.applyProtocol(protocolId, options);
      if (mountedRef.current) {
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
      throw err;
    }
  }, []);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (protocolId) => {
    try {
      await treatmentProtocolService.toggleFavorite(protocolId);
      // Refresh favorites list
      await loadFavorites();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      throw err;
    }
  }, [loadFavorites]);

  // Duplicate protocol for personalization
  const duplicateProtocol = useCallback(async (protocolId, customName = null) => {
    setLoading(true);
    try {
      const result = await treatmentProtocolService.duplicateProtocol(protocolId, customName);
      if (mountedRef.current) {
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
      throw err;
    }
  }, []);

  // Search protocols
  const searchProtocols = useCallback(async (query) => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const result = await treatmentProtocolService.getTreatmentProtocols({ search: query });
      return result?.data || [];
    } catch (err) {
      console.error('Protocol search failed:', err);
      return [];
    }
  }, []);

  // Grouped protocols by category (for UI)
  const protocolsByCategory = useMemo(() => {
    return protocols.reduce((acc, protocol) => {
      const category = protocol.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(protocol);
      return acc;
    }, {});
  }, [protocols]);

  return {
    // Data
    protocols,
    categories,
    favorites,
    popular,
    suggested,
    selectedCategory,
    protocolsByCategory,

    // State
    loading,
    error,

    // Actions
    loadCategories,
    loadPopular,
    loadFavorites,
    getByCategory,
    getSuggested,
    applyProtocol,
    toggleFavorite,
    duplicateProtocol,
    searchProtocols,
    setSelectedCategory,

    // Helpers
    clearError: () => setError(null)
  };
}

/**
 * useProtocolApplication - Simplified hook just for applying protocols
 * Use when you only need the "apply" functionality in a component
 */
export function useProtocolApplication() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appliedProtocol, setAppliedProtocol] = useState(null);

  const apply = useCallback(async (protocolId, options = {}) => {
    setLoading(true);
    setError(null);
    setAppliedProtocol(null);

    try {
      const result = await treatmentProtocolService.applyProtocol(protocolId, options);
      setAppliedProtocol(result);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setAppliedProtocol(null);
  }, []);

  return {
    apply,
    loading,
    error,
    appliedProtocol,
    medications: appliedProtocol?.data?.medications || [],
    reset
  };
}

/**
 * useProtocolSuggestions - Hook for getting protocol suggestions
 * Automatically fetches suggestions when diagnoses change
 */
export function useProtocolSuggestions(diagnoses = [], options = {}) {
  const { autoFetch = true } = options;

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (autoFetch && diagnoses.length > 0) {
      fetchSuggestions();
    }
  }, [diagnoses]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await treatmentProtocolService.getSuggestedProtocols({ diagnoses });
      setSuggestions(result?.data || []);
    } catch (err) {
      console.error('Failed to fetch protocol suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [diagnoses]);

  return {
    suggestions,
    loading,
    refresh: fetchSuggestions
  };
}
