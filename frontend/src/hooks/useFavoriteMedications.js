/**
 * useFavoriteMedications - Hook for managing favorite medications
 *
 * StudioVision Parity: Enables "1-click" medication prescription through:
 * - Quick access to frequently used medications
 * - Pre-configured default dosages
 * - Drag-and-drop reordering
 * - Usage tracking for smart sorting
 *
 * Usage:
 * const {
 *   favorites, loading, error,
 *   addFavorite, removeFavorite, reorder, applyFavorite
 * } = useFavoriteMedications();
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import userService from '../services/userService';

/**
 * Main hook for favorite medications management
 */
export default function useFavoriteMedications(options = {}) {
  const {
    autoLoad = true,
    maxFavorites = 15,
    onFavoriteApplied = null
  } = options;

  // State
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isReordering, setIsReordering] = useState(false);

  const mountedRef = useRef(true);

  // Load favorites on mount
  useEffect(() => {
    if (autoLoad) {
      loadFavorites();
    }

    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load favorites from server
  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await userService.getFavoriteMedications();
      if (mountedRef.current) {
        setFavorites(result?.data || result?.favorites || []);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        // Try loading from localStorage as fallback
        loadFromLocalStorage();
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Load from localStorage (offline fallback)
  const loadFromLocalStorage = useCallback(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.preferences?.favoriteMedications) {
          setFavorites(user.preferences.favoriteMedications);
        }
      }
    } catch (e) {
      console.warn('Failed to load favorites from localStorage:', e);
    }
  }, []);

  // Add medication to favorites
  const addFavorite = useCallback(async (medication) => {
    if (favorites.length >= maxFavorites) {
      throw new Error(`Maximum de ${maxFavorites} favoris autorisés`);
    }

    // Check if already exists
    const exists = favorites.some(
      f => f.drugId === medication.drugId || f.drugName === medication.drugName
    );
    if (exists) {
      throw new Error('Ce médicament est déjà dans vos favoris');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await userService.addFavoriteMedication({
        drugId: medication.drugId || medication._id,
        drugName: medication.drugName || medication.name,
        genericName: medication.genericName,
        icon: medication.icon || getDefaultIcon(medication),
        defaultDosage: medication.defaultDosage || {
          eye: 'OU',
          frequencyCode: 'BID'
        },
        color: medication.color
      });

      if (mountedRef.current) {
        const newFavorites = result?.data || result?.favorites || [...favorites, medication];
        setFavorites(newFavorites);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [favorites, maxFavorites]);

  // Remove medication from favorites
  const removeFavorite = useCallback(async (medicationId) => {
    setLoading(true);
    setError(null);

    try {
      await userService.removeFavoriteMedication(medicationId);

      if (mountedRef.current) {
        setFavorites(prev => prev.filter(
          f => f._id !== medicationId && f.drugId !== medicationId
        ));
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Reorder favorites (drag-and-drop)
  const reorder = useCallback(async (orderedIds) => {
    // Optimistic update
    const reorderedFavorites = orderedIds.map(
      id => favorites.find(f => f._id === id || f.drugId === id)
    ).filter(Boolean);

    setFavorites(reorderedFavorites);
    setIsReordering(true);

    try {
      await userService.reorderFavoriteMedications(orderedIds);
    } catch (err) {
      // Revert on error
      await loadFavorites();
      throw err;
    } finally {
      setIsReordering(false);
    }
  }, [favorites, loadFavorites]);

  // Update default dosage for a favorite
  const updateDosage = useCallback(async (medicationId, newDosage) => {
    setLoading(true);

    try {
      await userService.updateFavoriteMedicationDosage(medicationId, newDosage);

      if (mountedRef.current) {
        setFavorites(prev => prev.map(f => {
          if (f._id === medicationId || f.drugId === medicationId) {
            return { ...f, defaultDosage: { ...f.defaultDosage, ...newDosage } };
          }
          return f;
        }));
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Apply favorite to prescription
  const applyFavorite = useCallback((favorite) => {
    // Record usage for analytics
    const medicationId = favorite._id || favorite.drugId;
    if (medicationId) {
      userService.recordFavoriteUsage(medicationId);
    }

    // Create prescription-ready medication object
    const prescriptionMedication = {
      drugId: favorite.drugId,
      name: favorite.drugName,
      genericName: favorite.genericName,
      eye: favorite.defaultDosage?.eye || 'OU',
      frequency: favorite.defaultDosage?.frequency,
      frequencyCode: favorite.defaultDosage?.frequencyCode || 'BID',
      duration: favorite.defaultDosage?.duration
        ? `${favorite.defaultDosage.duration.value} ${favorite.defaultDosage.duration.unit}`
        : '1 month',
      instructions: favorite.defaultDosage?.instructions || '',
      isFromFavorite: true,
      favoriteId: favorite._id
    };

    // Callback if provided
    if (onFavoriteApplied) {
      onFavoriteApplied(prescriptionMedication);
    }

    return prescriptionMedication;
  }, [onFavoriteApplied]);

  // Check if a medication is in favorites
  const isFavorite = useCallback((medicationIdOrName) => {
    return favorites.some(
      f => f._id === medicationIdOrName ||
           f.drugId === medicationIdOrName ||
           f.drugName === medicationIdOrName
    );
  }, [favorites]);

  // Get favorite by ID
  const getFavorite = useCallback((medicationIdOrName) => {
    return favorites.find(
      f => f._id === medicationIdOrName ||
           f.drugId === medicationIdOrName ||
           f.drugName === medicationIdOrName
    );
  }, [favorites]);

  return {
    // Data
    favorites,
    maxFavorites,
    canAddMore: favorites.length < maxFavorites,

    // State
    loading,
    error,
    isReordering,

    // Actions
    loadFavorites,
    addFavorite,
    removeFavorite,
    reorder,
    updateDosage,
    applyFavorite,

    // Helpers
    isFavorite,
    getFavorite,
    clearError: () => setError(null)
  };
}

/**
 * Get default icon based on medication type/class
 */
function getDefaultIcon(medication) {
  const name = (medication.drugName || medication.name || '').toLowerCase();
  const drugClass = (medication.drugClass || '').toLowerCase();

  // Eye drops
  if (name.includes('collyre') || name.includes('drop') || drugClass.includes('ophthalmic')) {
    return '\uD83D\uDCA7'; // Water droplet
  }

  // Injections
  if (name.includes('inject') || drugClass.includes('injection')) {
    return '\uD83D\uDC89'; // Syringe
  }

  // Ointments/gels
  if (name.includes('pommade') || name.includes('gel') || name.includes('ointment')) {
    return '\uD83E\uDDF4'; // Lotion bottle
  }

  // Default pill
  return '\uD83D\uDC8A'; // Pill
}

/**
 * useQuickPrescribe - Simplified hook for quick prescription workflow
 * Combines favorites + protocol application
 */
export function useQuickPrescribe(options = {}) {
  const { onMedicationAdded } = options;

  const {
    favorites,
    applyFavorite,
    loading: favoritesLoading
  } = useFavoriteMedications({
    onFavoriteApplied: onMedicationAdded
  });

  const [recentlyUsed, setRecentlyUsed] = useState([]);

  // Track recently used for quick access
  const addToRecentlyUsed = useCallback((medication) => {
    setRecentlyUsed(prev => {
      // Remove if already exists
      const filtered = prev.filter(m => m.drugId !== medication.drugId);
      // Add to front, keep last 5
      return [medication, ...filtered].slice(0, 5);
    });
  }, []);

  // Quick prescribe from favorite
  const quickPrescribe = useCallback((favorite) => {
    const medication = applyFavorite(favorite);
    addToRecentlyUsed(medication);
    return medication;
  }, [applyFavorite, addToRecentlyUsed]);

  return {
    favorites,
    recentlyUsed,
    loading: favoritesLoading,
    quickPrescribe,
    addToRecentlyUsed
  };
}
