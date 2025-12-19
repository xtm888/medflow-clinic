/**
 * FavoriteMedicationsBar - Quick-access medication favorites
 *
 * StudioVision Parity: "1-Click" prescription workflow
 *
 * Features:
 * - Single click to add medication with default dosage
 * - Right-click context menu (remove, edit defaults)
 * - Reorder via buttons
 * - Add new favorite button with search modal
 *
 * Usage:
 * <FavoriteMedicationsBar
 *   onMedicationAdd={(medication) => addToPrescription(medication)}
 * />
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, ChevronLeft, ChevronRight, Star, Loader2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import useFavoriteMedications from '../../hooks/useFavoriteMedications';
import medicationService from '../../services/medicationService';

// Default icons for medication types
const MEDICATION_ICONS = {
  default: '💧',
  drops: '💧',
  pill: '💊',
  injection: '💉',
  ointment: '🧴'
};

// Default colors for favorites
const FAVORITE_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#06B6D4'
];

// Simple Tooltip component
function Tooltip({ children, label, placement = 'top' }) {
  const [visible, setVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && label && (
        <div
          className={`absolute z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-pre-line ${positionClasses[placement]}`}
        >
          {label}
          <div
            className={`absolute w-2 h-2 bg-gray-800 transform rotate-45 ${
              placement === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
              placement === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' :
              placement === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
              'right-full top-1/2 -translate-y-1/2 -mr-1'
            }`}
          />
        </div>
      )}
    </div>
  );
}

// Dropdown Menu component
function DropdownMenu({ isOpen, onClose, children, triggerRef }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          triggerRef?.current && !triggerRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 min-w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
    >
      {children}
    </div>
  );
}

function DropdownMenuItem({ icon: Icon, children, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

// Modal component
function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Content */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function FavoriteMedicationsBar({
  onMedicationAdd,
  compact = false,
  showLabel = true
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuTriggerRef = useRef(null);

  const {
    favorites,
    loading,
    canAddMore,
    addFavorite,
    removeFavorite,
    reorder,
    applyFavorite,
    isReordering
  } = useFavoriteMedications();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Handle medication click - apply to prescription
  const handleMedicationClick = useCallback((favorite) => {
    const medication = applyFavorite(favorite);
    if (onMedicationAdd) {
      onMedicationAdd(medication);
    }
    toast.success(`${favorite.drugName} ajouté à l'ordonnance`, {
      autoClose: 2000
    });
  }, [applyFavorite, onMedicationAdd]);

  // Handle search
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await medicationService.search(query, { limit: 10 });
        setSearchResults(results?.data || results || []);
      } catch (error) {
        console.error('Medication search failed:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // Handle add to favorites
  const handleAddToFavorites = useCallback(async (medication) => {
    try {
      await addFavorite({
        drugId: medication._id || medication.drugId,
        drugName: medication.name || medication.drugName,
        genericName: medication.genericName,
        icon: MEDICATION_ICONS.default,
        color: FAVORITE_COLORS[favorites.length % FAVORITE_COLORS.length],
        defaultDosage: {
          eye: 'OU',
          frequencyCode: 'BID',
          duration: { value: 1, unit: 'months' }
        }
      });

      toast.success(`${medication.name || medication.drugName} ajouté aux favoris`, {
        autoClose: 2000
      });

      setIsModalOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      toast.error(error.message);
    }
  }, [addFavorite, favorites.length]);

  // Handle remove from favorites
  const handleRemove = useCallback(async (medicationId) => {
    try {
      await removeFavorite(medicationId);
      toast.info('Favori supprimé', { autoClose: 2000 });
    } catch (error) {
      toast.error(error.message);
    }
    setActiveMenuId(null);
  }, [removeFavorite]);

  // Handle move left
  const handleMoveLeft = useCallback((index) => {
    if (index === 0) return;
    const items = Array.from(favorites);
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    const orderedIds = items.map(item => item._id || item.drugId);
    reorder(orderedIds);
    setActiveMenuId(null);
  }, [favorites, reorder]);

  // Handle move right
  const handleMoveRight = useCallback((index) => {
    if (index === favorites.length - 1) return;
    const items = Array.from(favorites);
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    const orderedIds = items.map(item => item._id || item.drugId);
    reorder(orderedIds);
    setActiveMenuId(null);
  }, [favorites, reorder]);

  if (loading && favorites.length === 0) {
    return (
      <div className="p-2 bg-gray-50 rounded-md">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Chargement des favoris...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${compact ? 'p-2' : 'p-3'}`}>
      {showLabel && (
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold text-gray-700">
            MÉDICAMENTS FAVORIS
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            {favorites.length}/15
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {favorites.map((favorite, index) => (
          <div key={favorite._id || favorite.drugId || index} className="relative">
            <Tooltip
              label={`${favorite.drugName}\nCliquez pour ajouter`}
              placement="top"
            >
              <button
                onClick={() => handleMedicationClick(favorite)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveMenuId(favorite._id || favorite.drugId);
                }}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md border
                  transition-colors cursor-pointer
                  ${compact ? 'text-xs' : 'text-sm'}
                  ${isReordering ? 'opacity-70' : 'opacity-100'}
                  bg-white hover:bg-blue-50
                `}
                style={{ borderColor: favorite.color || '#93C5FD' }}
              >
                <span>{favorite.icon || MEDICATION_ICONS.default}</span>
                <span className={`max-w-[120px] truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                  {favorite.drugName}
                </span>
              </button>
            </Tooltip>

            <DropdownMenu
              isOpen={activeMenuId === (favorite._id || favorite.drugId)}
              onClose={() => setActiveMenuId(null)}
              triggerRef={menuTriggerRef}
            >
              <DropdownMenuItem
                icon={Edit2}
                onClick={() => {
                  // TODO: Open edit dosage modal
                  setActiveMenuId(null);
                }}
              >
                Modifier la posologie par défaut
              </DropdownMenuItem>
              {index > 0 && (
                <DropdownMenuItem
                  icon={ChevronLeft}
                  onClick={() => handleMoveLeft(index)}
                >
                  Déplacer à gauche
                </DropdownMenuItem>
              )}
              {index < favorites.length - 1 && (
                <DropdownMenuItem
                  icon={ChevronRight}
                  onClick={() => handleMoveRight(index)}
                >
                  Déplacer à droite
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                icon={Trash2}
                danger
                onClick={() => handleRemove(favorite._id || favorite.drugId)}
              >
                Supprimer des favoris
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        ))}

        {/* Add Favorite Button */}
        {canAddMore && (
          <Tooltip label="Ajouter un favori">
            <button
              onClick={() => setIsModalOpen(true)}
              className={`
                flex items-center justify-center border border-dashed border-green-300
                text-green-600 rounded-md hover:bg-green-50 transition-colors
                ${compact ? 'w-6 h-6' : 'w-8 h-8'}
              `}
              aria-label="Ajouter un favori"
            >
              <Plus className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Add Favorite Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
        title="Ajouter un Médicament Favori"
      >
        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <Search className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <input
            type="text"
            placeholder="Rechercher un médicament..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
            <p className="text-gray-500 text-center py-4">
              Aucun résultat trouvé
            </p>
          )}

          {searchResults.map((med) => (
            <div
              key={med._id || med.drugId}
              onClick={() => handleAddToFavorites(med)}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-blue-50 transition-colors"
            >
              <span className="text-lg">{MEDICATION_ICONS.default}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {med.name || med.drugName}
                </p>
                {med.genericName && (
                  <p className="text-sm text-gray-500 truncate">
                    {med.genericName}
                  </p>
                )}
              </div>
              <button
                className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                aria-label="Ajouter"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/**
 * Compact version for sidebar or smaller spaces
 */
export function FavoriteMedicationsCompact({ onMedicationAdd }) {
  return (
    <FavoriteMedicationsBar
      onMedicationAdd={onMedicationAdd}
      compact={true}
      showLabel={false}
    />
  );
}
