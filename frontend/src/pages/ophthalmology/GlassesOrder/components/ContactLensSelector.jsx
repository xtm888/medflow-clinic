/**
 * ContactLensSelector Component
 *
 * Searchable contact lens inventory selector with debounced search.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import glassesOrderService from '../../../../services/glassesOrderService';
import { formatCurrency } from '../constants';

export default function ContactLensSelector({ eye, selectedLens, onSelect, onClear, prescription }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchLenses = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await glassesOrderService.searchContactLenses({
        query,
        power: prescription?.sphere
      });
      setSearchResults(response.data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Error searching lenses:', err);
    } finally {
      setSearching(false);
    }
  }, [prescription]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchLenses(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchLenses]);

  const handleSelect = (lens) => {
    onSelect(lens);
    setSearchQuery('');
    setShowDropdown(false);
  };

  if (selectedLens) {
    return (
      <div className="border border-blue-300 bg-blue-50 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-800">
              {selectedLens.brand} {selectedLens.productLine}
            </p>
            <p className="text-xs text-blue-600">
              BC: {selectedLens.parameters?.baseCurve} • DIA: {selectedLens.parameters?.diameter}
            </p>
            <p className="text-xs text-gray-600">
              {selectedLens.available} boîtes en stock
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-blue-800">
              {formatCurrency(selectedLens.price)}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Changer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Rechercher lentille ${eye}...`}
          className="input pl-10 text-sm"
          onFocus={() => searchQuery && setShowDropdown(true)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
          {searchResults.map((lens) => (
            <button
              key={lens.id}
              type="button"
              onClick={() => handleSelect(lens)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 text-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{lens.brand} {lens.productLine}</p>
                  <p className="text-xs text-gray-500">
                    {lens.wearSchedule} • BC {lens.parameters?.baseCurve}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(lens.price)}</p>
                  <p className={`text-xs ${lens.available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {lens.available > 0 ? `${lens.available} boîtes` : 'Rupture'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
