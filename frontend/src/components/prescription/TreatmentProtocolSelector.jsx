/**
 * TreatmentProtocolSelector - Protocol-based prescription
 *
 * StudioVision Parity: "2-Click" prescription workflow
 *
 * Features:
 * - Category-organized protocol selection
 * - One-click to apply all medications from a protocol
 * - Smart suggestions based on diagnosis
 * - Search across all protocols
 * - Create/duplicate custom protocols
 *
 * Usage:
 * <TreatmentProtocolSelector
 *   diagnoses={currentDiagnoses}
 *   onProtocolApply={(medications) => addAllToPrescription(medications)}
 * />
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Play,
  Copy,
  Settings,
  CheckCircle,
  AlertTriangle,
  Clock,
  Droplet,
  X,
  Loader2
} from 'lucide-react';
import useTreatmentProtocols, { useProtocolSuggestions } from '../../hooks/useTreatmentProtocols';

// Category icons and colors
const CATEGORY_CONFIG = {
  post_operatoire: { icon: '🔪', color: 'green', label: 'Post-opératoire' },
  post_surgical: { icon: '🔪', color: 'green', label: 'Post-Surgical' },
  glaucome: { icon: '👁', color: 'purple', label: 'Glaucome' },
  glaucoma: { icon: '👁', color: 'purple', label: 'Glaucoma' },
  infection: { icon: '🦠', color: 'red', label: 'Infection' },
  inflammation: { icon: '🔥', color: 'orange', label: 'Inflammation' },
  uveite: { icon: '🔥', color: 'orange', label: 'Uvéite' },
  allergie: { icon: '🌸', color: 'pink', label: 'Allergie' },
  allergy: { icon: '🌸', color: 'pink', label: 'Allergy' },
  secheresse_oculaire: { icon: '💧', color: 'blue', label: 'Sécheresse Oculaire' },
  dry_eye: { icon: '💧', color: 'blue', label: 'Dry Eye' },
  cataracte: { icon: '🔍', color: 'indigo', label: 'Cataracte' },
  injection: { icon: '💉', color: 'red', label: 'Injections' },
  prophylaxie: { icon: '🛡', color: 'teal', label: 'Prophylaxie' },
  pediatric: { icon: '👶', color: 'cyan', label: 'Pédiatrique' },
  emergency: { icon: '🚨', color: 'red', label: 'Urgence' },
  default: { icon: '💊', color: 'gray', label: 'Autre' }
};

// Color mappings for Tailwind
const COLOR_CLASSES = {
  green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', solid: 'bg-green-600 text-white' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', solid: 'bg-purple-600 text-white' },
  red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', solid: 'bg-red-600 text-white' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', solid: 'bg-orange-600 text-white' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', solid: 'bg-pink-600 text-white' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', solid: 'bg-blue-600 text-white' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', solid: 'bg-indigo-600 text-white' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', solid: 'bg-teal-600 text-white' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', solid: 'bg-cyan-600 text-white' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', solid: 'bg-gray-600 text-white' }
};

export default function TreatmentProtocolSelector({
  diagnoses = [],
  onProtocolApply,
  collapsed = false,
  showSuggestions = true
}) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [notification, setNotification] = useState(null);

  const {
    categories,
    protocols,
    loading,
    error,
    getByCategory,
    applyProtocol,
    searchProtocols,
    selectedCategory,
    setSelectedCategory
  } = useTreatmentProtocols();

  const { suggestions, loading: suggestionsLoading } = useProtocolSuggestions(diagnoses, {
    autoFetch: showSuggestions && diagnoses.length > 0
  });

  // Search results
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Show notification helper
  const showNotification = (title, message, type = 'success') => {
    setNotification({ title, message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle search
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);

    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchProtocols(query);
      setSearchResults(results);
    } catch (err) {
      console.error('Protocol search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [searchProtocols]);

  // Handle category selection
  const handleCategoryClick = useCallback(async (category) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
      return;
    }
    await getByCategory(category);
  }, [selectedCategory, setSelectedCategory, getByCategory]);

  // Handle protocol application
  const handleApplyProtocol = useCallback(async (protocol) => {
    setApplying(true);
    try {
      const result = await applyProtocol(protocol._id);

      if (result?.data?.medications && onProtocolApply) {
        onProtocolApply(result.data.medications, protocol);
      }

      showNotification(
        'Protocole appliqué',
        `${result.data.medications?.length || 0} médicaments ajoutés`,
        'success'
      );

      setModalOpen(false);
    } catch (err) {
      showNotification('Erreur', err.message, 'error');
    } finally {
      setApplying(false);
    }
  }, [applyProtocol, onProtocolApply]);

  // Preview protocol
  const handlePreviewProtocol = useCallback((protocol) => {
    setSelectedProtocol(protocol);
    setModalOpen(true);
  }, []);

  // Get category config
  const getCategoryConfig = (category) => {
    return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.default;
  };

  const getColorClasses = (color) => {
    return COLOR_CLASSES[color] || COLOR_CLASSES.gray;
  };

  // Display protocols (search results or category protocols)
  const displayProtocols = useMemo(() => {
    if (searchQuery.length >= 2) {
      return searchResults;
    }
    return protocols;
  }, [searchQuery, searchResults, protocols]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white`}>
          <p className="font-medium">{notification.title}</p>
          <p className="text-sm opacity-90">{notification.message}</p>
        </div>
      )}

      {/* Header */}
      <div
        className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-semibold">PROTOCOLES DE TRAITEMENT</span>
          {categories.length > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
              {categories.reduce((sum, c) => sum + c.count, 0)} protocoles
            </span>
          )}
        </div>
        <button className="p-1 hover:bg-gray-200 rounded">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3">
          {/* Search */}
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {searching ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Search className="w-4 h-4 text-gray-400" />}
            </div>
            <input
              type="text"
              placeholder="Rechercher un protocole..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Suggestions based on diagnosis */}
          {showSuggestions && suggestions.length > 0 && !searchQuery && (
            <div className="mb-3">
              <div className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-2">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>SUGGESTIONS BASÉES SUR LE DIAGNOSTIC</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 5).map((protocol) => (
                  <button
                    key={protocol._id}
                    onClick={() => handlePreviewProtocol(protocol)}
                    className="px-2 py-1 text-xs font-medium border border-green-300 text-green-700 rounded hover:bg-green-50 flex items-center gap-1"
                    title={protocol.matchReason}
                  >
                    <span>{getCategoryConfig(protocol.category).icon}</span>
                    {protocol.name}
                  </button>
                ))}
              </div>
              <hr className="my-3" />
            </div>
          )}

          {/* Categories */}
          {!searchQuery && (
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((cat) => {
                const config = getCategoryConfig(cat.category);
                const colors = getColorClasses(config.color);
                const isSelected = selectedCategory === cat.category;
                return (
                  <button
                    key={cat.category}
                    onClick={() => handleCategoryClick(cat.category)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition ${isSelected ? colors.solid : `${colors.bg} ${colors.text} hover:opacity-80`}`}
                  >
                    <span className="text-sm">{config.icon}</span>
                    <span>{config.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${isSelected ? 'bg-white/20' : colors.solid}`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {/* Protocols list */}
          {!loading && displayProtocols.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {displayProtocols.map((protocol) => {
                const config = getCategoryConfig(protocol.category);
                const colors = getColorClasses(config.color);
                return (
                  <div
                    key={protocol._id}
                    className="p-2 bg-gray-50 rounded-md hover:bg-blue-50 flex items-center gap-2"
                  >
                    <span className="text-lg">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {protocol.nameFr || protocol.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {protocol.medications?.length || 0} méd.
                        </span>
                        {protocol.usageCount > 0 && (
                          <span className="text-xs text-gray-500">
                            Utilisé {protocol.usageCount}x
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePreviewProtocol(protocol)}
                        className="p-1.5 hover:bg-gray-200 rounded"
                        title="Aperçu"
                      >
                        <Settings className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleApplyProtocol(protocol)}
                        disabled={applying}
                        className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        title="Appliquer le protocole"
                      >
                        {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No results */}
          {!loading && displayProtocols.length === 0 && selectedCategory && (
            <p className="text-gray-500 text-center py-4">
              Aucun protocole dans cette catégorie
            </p>
          )}

          {/* Help text */}
          {!loading && !selectedCategory && !searchQuery && (
            <p className="text-xs text-gray-400 text-center">
              Sélectionnez une catégorie ou recherchez un protocole
            </p>
          )}
        </div>
      )}

      {/* Protocol Preview Modal */}
      {modalOpen && selectedProtocol && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getCategoryConfig(selectedProtocol?.category).icon}</span>
                <h3 className="font-bold text-lg">{selectedProtocol?.nameFr || selectedProtocol?.name}</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Description */}
              {selectedProtocol.description && (
                <p className="text-sm text-gray-600">
                  {selectedProtocol.descriptionFr || selectedProtocol.description}
                </p>
              )}

              {/* Duration */}
              {selectedProtocol.expectedDuration && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Durée: {selectedProtocol.expectedDuration.value} {selectedProtocol.expectedDuration.unit}</span>
                </div>
              )}

              {/* Medications */}
              <div>
                <h4 className="font-semibold mb-2">
                  Médicaments ({selectedProtocol.medications?.length || 0})
                </h4>
                <div className="space-y-2">
                  {(selectedProtocol.medications || []).map((med, idx) => (
                    <div key={idx} className="p-2 bg-gray-50 rounded-md flex items-start gap-2">
                      <Droplet className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">
                          {med.drugName || 'Médicament'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {med.dosage?.eye || 'OU'} - {med.dosage?.frequency || med.posologie?.text || 'Selon prescription'}
                          {med.dosage?.duration && ` - ${med.dosage.duration.value} ${med.dosage.duration.unit}`}
                        </p>
                        {med.instructions && (
                          <p className="text-xs text-gray-500 italic">
                            {med.instructions}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contraindications */}
              {selectedProtocol.contraindications?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <h4 className="font-semibold">Contre-indications</h4>
                  </div>
                  <div className="space-y-1">
                    {selectedProtocol.contraindications.map((ci, idx) => (
                      <p key={idx} className="text-sm text-orange-700">
                        {ci.descriptionFr || ci.description}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  showNotification('Bientôt disponible', 'La personnalisation des protocoles arrive bientôt', 'info');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Personnaliser
              </button>
              <button
                onClick={() => handleApplyProtocol(selectedProtocol)}
                disabled={applying}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Appliquer le protocole
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact protocol quick-select for sidebar
 */
export function ProtocolQuickSelect({ diagnoses = [], onProtocolApply }) {
  const { suggestions, loading } = useProtocolSuggestions(diagnoses);
  const { applyProtocol } = useTreatmentProtocols();
  const [notification, setNotification] = useState(null);

  const handleQuickApply = async (protocol) => {
    try {
      const result = await applyProtocol(protocol._id);
      if (result?.data?.medications && onProtocolApply) {
        onProtocolApply(result.data.medications, protocol);
      }
      setNotification({ title: `${protocol.name} appliqué`, type: 'success' });
      setTimeout(() => setNotification(null), 2000);
    } catch (err) {
      setNotification({ title: 'Erreur', message: err.message, type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="space-y-1">
      {notification && (
        <div className={`p-2 rounded text-xs ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {notification.title}
        </div>
      )}
      <p className="text-xs font-medium text-gray-500">
        Protocoles suggérés
      </p>
      {suggestions.slice(0, 3).map((protocol) => (
        <button
          key={protocol._id}
          onClick={() => handleQuickApply(protocol)}
          className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded"
        >
          {protocol.name}
        </button>
      ))}
    </div>
  );
}
