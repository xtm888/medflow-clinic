import { useState, useEffect } from 'react';
import { Search, X, Check, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import templateCatalogService from '../services/templateCatalogService';

/**
 * PathologyQuickPick - Component for quickly selecting pathology diagnoses
 * Uses 128 pathology templates from the database
 *
 * Usage:
 * <PathologyQuickPick
 *   onSelect={(pathologies) => handlePathologiesSelected(pathologies)}
 *   selectedPathologies={existingPathologies}
 *   multiple={true}
 * />
 */
export default function PathologyQuickPick({ onSelect, selectedPathologies = [], multiple = true, onClose }) {
  const [loading, setLoading] = useState(true);
  const [pathologies, setPathologies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(selectedPathologies);

  useEffect(() => {
    loadPathologies();
  }, []);

  const loadPathologies = async () => {
    try {
      setLoading(true);
      const [pathologiesRes, categoriesRes] = await Promise.all([
        templateCatalogService.getPathologyTemplates(),
        templateCatalogService.getPathologyCategories()
      ]);

      // Safely extract arrays from various API response formats
      const rawPathologies = pathologiesRes?.data?.data ?? pathologiesRes?.data ?? pathologiesRes ?? [];
      const pathologyData = Array.isArray(rawPathologies) ? rawPathologies : [];
      const rawCategories = categoriesRes?.data?.data ?? categoriesRes?.data ?? categoriesRes ?? [];
      const categoryData = Array.isArray(rawCategories) ? rawCategories : [];

      // Filter out MOTIF DE CONSULTATION - these are now shown in Plainte Principale tab
      const filteredPathologies = pathologyData.filter(p =>
        p.category?.toUpperCase() !== 'MOTIF DE CONSULTATION'
      );
      const filteredCategories = categoryData.filter(cat =>
        cat?.toUpperCase() !== 'MOTIF DE CONSULTATION'
      );

      setPathologies(filteredPathologies);
      setCategories(filteredCategories);

      // Group pathologies by category and subcategory
      const grouped = {};
      filteredPathologies.forEach(p => {
        const cat = p.category || 'other';
        const subcat = p.subCategory || 'general';

        if (!grouped[cat]) {
          grouped[cat] = {};
        }
        if (!grouped[cat][subcat]) {
          grouped[cat][subcat] = [];
        }
        grouped[cat][subcat].push(p);
      });
      setSubcategories(grouped);

      // Auto-expand first category
      if (categoryData.length > 0) {
        setExpandedCategories({ [categoryData[0]]: true });
      }
    } catch (err) {
      console.error('Error loading pathologies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter pathologies by search
  const filteredPathologies = pathologies.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(query) ||
      p.nameEn?.toLowerCase().includes(query) ||
      p.icdCode?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  });

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Handle selection
  const handleToggle = (pathology) => {
    const pathologyId = pathology._id || pathology.id;
    const isSelected = selected.some(s => (s._id || s.id) === pathologyId);

    if (multiple) {
      if (isSelected) {
        setSelected(selected.filter(s => (s._id || s.id) !== pathologyId));
      } else {
        setSelected([...selected, pathology]);
      }
    } else {
      setSelected([pathology]);
      if (onSelect) {
        onSelect([pathology]);
      }
    }
  };

  // Check if pathology is selected
  const isPathologySelected = (pathology) => {
    const pathologyId = pathology._id || pathology.id;
    return selected.some(s => (s._id || s.id) === pathologyId);
  };

  // Confirm selection
  const handleConfirm = () => {
    if (onSelect) {
      onSelect(selected);
    }
    if (onClose) {
      onClose();
    }
  };

  // Category display names
  const categoryNames = {
    cornee_conjonctive: 'Cornee et Conjonctive',
    cristallin_cataracte: 'Cristallin et Cataracte',
    glaucome: 'Glaucome',
    retine_vitree: 'Retine et Vitre',
    nerf_optique: 'Nerf Optique',
    oculomotricite: 'Oculomotricite',
    orbite_paupieres: 'Orbite et Paupieres',
    refraction: 'Refraction',
    traumatisme: 'Traumatisme',
    infectieux: 'Pathologies Infectieuses',
    inflammatoire: 'Pathologies Inflammatoires',
    pediatrique: 'Ophtalmologie Pediatrique',
    autre: 'Autres'
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Chargement des pathologies...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Pathologies <span className="text-sm font-normal text-gray-500">({pathologies.length})</span>
          </h3>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Rechercher par nom, code CIM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Selected Items */}
      {selected.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs font-medium text-blue-800 mb-1">
            Selectionne ({selected.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {selected.map(s => (
              <span
                key={s._id || s.id}
                className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
              >
                {s.name}
                <button
                  onClick={() => handleToggle(s)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {searchQuery ? (
          // Show flat list when searching
          <div className="p-2">
            {filteredPathologies.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Aucune pathologie trouvee</p>
            ) : (
              <div className="space-y-1">
                {filteredPathologies.map(pathology => (
                  <button
                    key={pathology._id || pathology.id}
                    onClick={() => handleToggle(pathology)}
                    className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between ${
                      isPathologySelected(pathology)
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pathology.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {pathology.icdCode && (
                          <span className="text-xs text-gray-500">{pathology.icdCode}</span>
                        )}
                        {pathology.category && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {pathology.category}
                          </span>
                        )}
                      </div>
                    </div>
                    {isPathologySelected(pathology) && (
                      <Check className="h-5 w-5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Show categorized list
          <div className="divide-y divide-gray-100">
            {Object.keys(subcategories).map(category => (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    {expandedCategories[category] ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">
                      {categoryNames[category] || category}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {Object.values(subcategories[category]).flat().length}
                  </span>
                </button>

                {expandedCategories[category] && (
                  <div className="bg-gray-50 px-4 py-2">
                    {Object.keys(subcategories[category]).map(subcategory => (
                      <div key={subcategory} className="mb-2">
                        {subcategory !== 'general' && (
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1 px-2">
                            {subcategory}
                          </p>
                        )}
                        <div className="space-y-1">
                          {subcategories[category][subcategory].map(pathology => (
                            <button
                              key={pathology._id || pathology.id}
                              onClick={() => handleToggle(pathology)}
                              className={`w-full text-left p-2 rounded transition-colors flex items-center justify-between ${
                                isPathologySelected(pathology)
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'hover:bg-white'
                              }`}
                            >
                              <div>
                                <p className="text-sm">{pathology.name}</p>
                                {pathology.icdCode && (
                                  <span className="text-xs text-gray-500">{pathology.icdCode}</span>
                                )}
                              </div>
                              {isPathologySelected(pathology) && (
                                <Check className="h-4 w-4 text-blue-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {multiple && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary text-sm">
              Annuler
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="btn btn-primary text-sm"
            disabled={selected.length === 0}
          >
            Confirmer ({selected.length})
          </button>
        </div>
      )}
    </div>
  );
}
