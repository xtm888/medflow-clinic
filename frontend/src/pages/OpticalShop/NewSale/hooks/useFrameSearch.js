/**
 * useFrameSearch Hook
 *
 * Handles frame search with debouncing and dropdown management.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import frameInventoryService from '../../../../services/frameInventoryService';

export default function useFrameSearch() {
  const [frameSearch, setFrameSearch] = useState('');
  const [frames, setFrames] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchInputRef = useRef(null);
  const containerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Debounced search as user types
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!frameSearch.trim() || frameSearch.trim().length < 2) {
      setFrames([]);
      setShowResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        setShowResults(true);
        const response = await frameInventoryService.searchFrames(frameSearch.trim(), {
          inStockOnly: false,
          limit: 20
        });
        if (response.success) {
          // Sort: in-stock first, then out-of-stock - handle various API response formats
          const rawData = response?.data?.data ?? response?.data ?? [];
          const frameData = Array.isArray(rawData) ? rawData : [];
          const sorted = frameData.sort((a, b) => {
            const aStock = a.inventory?.currentStock || 0;
            const bStock = b.inventory?.currentStock || 0;
            return bStock - aStock;
          });
          setFrames(sorted);
        }
      } catch (error) {
        console.error('Error searching frames:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [frameSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearSearch = useCallback(() => {
    setFrameSearch('');
    setFrames([]);
    setShowResults(false);
  }, []);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => {
    if (frameSearch.length >= 2) {
      setShowResults(true);
    }
  }, [frameSearch]);

  return {
    frameSearch,
    setFrameSearch,
    frames,
    searching,
    showResults,
    setShowResults,
    searchInputRef,
    containerRef,
    clearSearch,
    focusSearch,
    handleFocus
  };
}
