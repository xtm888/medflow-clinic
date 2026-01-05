/**
 * FrameSelector Component
 *
 * Searchable frame inventory selector with debounced search.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import glassesOrderService from '../../../../services/glassesOrderService';
import { formatCurrency } from '../constants';

export default function FrameSelector({ selectedFrame, onSelect, onClear }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchFrames = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await glassesOrderService.searchFrames(query);
      // Safely extract array from various API response formats
      const rawData = response?.data?.data ?? response?.data ?? response ?? [];
      setSearchResults(Array.isArray(rawData) ? rawData : []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Error searching frames:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchFrames(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchFrames]);

  const handleSelect = (frame) => {
    onSelect(frame);
    setSearchQuery('');
    setShowDropdown(false);
  };

  if (selectedFrame) {
    return (
      <div className="border border-green-300 bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-green-800">
              {selectedFrame.brand} {selectedFrame.model}
            </p>
            <p className="text-sm text-green-600">
              {selectedFrame.color} • {selectedFrame.size || 'Taille standard'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              SKU: {selectedFrame.sku} •
              <span className={selectedFrame.available > 0 ? 'text-green-600' : 'text-red-600'}>
                {selectedFrame.available} en stock
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-800">
              {formatCurrency(selectedFrame.price)}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-red-600 hover:text-red-800 mt-1"
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
          placeholder="Rechercher une monture (marque, modèle, SKU)..."
          className="input pl-10"
          onFocus={() => searchQuery && setShowDropdown(true)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {searchResults.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => handleSelect(frame)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{frame.brand} {frame.model}</p>
                  <p className="text-sm text-gray-500">{frame.color} • {frame.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(frame.price)}</p>
                  <p className={`text-xs ${frame.available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {frame.available > 0 ? `${frame.available} en stock` : 'Rupture'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Aucune monture trouvée
        </div>
      )}
    </div>
  );
}
