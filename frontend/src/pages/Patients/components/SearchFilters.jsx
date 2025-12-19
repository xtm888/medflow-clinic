/**
 * SearchFilters Component
 *
 * Search bar, filter dropdowns, and advanced filters panel.
 */

import { Search, Filter, X, Loader2 } from 'lucide-react';
import { PRIORITY_OPTIONS, SORT_OPTIONS, SEARCH_TYPE_OPTIONS, BLOOD_TYPES } from '../constants';

export default function SearchFilters({
  // Search
  searchTerm,
  setSearchTerm,
  searchType,
  setSearchType,
  searching,
  searchInputRef,
  resultCount,
  // Filters
  priorityFilter,
  setPriorityFilter,
  sortBy,
  setSortBy,
  // Advanced filters
  showAdvancedFilters,
  setShowAdvancedFilters,
  advancedFilters,
  handleAdvancedFilterChange,
  hasActiveFilters,
  applyAdvancedFilters,
  resetFilters,
  // Pagination reset
  resetPage
}) {
  const activeFilterCount = Object.values(advancedFilters).filter(v => v !== '').length;

  return (
    <div className="card">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl flex gap-2">
            {/* Search Type Dropdown */}
            <select
              value={searchType}
              onChange={(e) => {
                setSearchType(e.target.value);
                if (searchTerm) {
                  resetPage();
                }
              }}
              className="input w-40 text-sm"
            >
              {SEARCH_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
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
                      resultCount > 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {resultCount} résultat{resultCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="input"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              {PRIORITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`btn ${showAdvancedFilters || hasActiveFilters() ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs">
                  {activeFilterCount}
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
          <AdvancedFiltersPanel
            advancedFilters={advancedFilters}
            handleAdvancedFilterChange={handleAdvancedFilterChange}
            applyAdvancedFilters={applyAdvancedFilters}
          />
        )}
      </div>
    </div>
  );
}

function AdvancedFiltersPanel({ advancedFilters, handleAdvancedFilterChange, applyAdvancedFilters }) {
  return (
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
            {BLOOD_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
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
  );
}
