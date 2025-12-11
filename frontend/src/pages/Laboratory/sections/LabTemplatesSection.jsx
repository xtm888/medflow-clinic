import { useState } from 'react';
import { FlaskConical, Search, Check } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';

/**
 * LabTemplatesSection - Test templates catalog with search/filter
 */
export default function LabTemplatesSection({
  templates,
  categories,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onSelectTest,
  selectedTests = [],
  selectionMode = false
}) {
  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      template.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.code?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const isTestSelected = (template) => {
    return selectedTests.some(t => (t._id || t.id) === (template._id || template.id));
  };

  return (
    <CollapsibleSection
      title="Catalogue des Examens"
      icon={FlaskConical}
      iconColor="text-purple-600"
      gradient="from-purple-50 to-fuchsia-50"
      defaultExpanded={true}
      badge={
        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
          {templates.length} tests
        </span>
      }
      headerExtra={
        categories.length > 0 && (
          <span>{categories.length} catégories</span>
        )
      }
    >
      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Rechercher un examen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="all">Toutes catégories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <SectionEmptyState
          icon={FlaskConical}
          message="Aucun examen trouvé"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {filteredTemplates.map(template => (
            <div
              key={template._id || template.id}
              onClick={() => selectionMode && onSelectTest?.(template)}
              className={`p-3 border rounded-lg transition-colors ${
                selectionMode ? 'cursor-pointer' : ''
              } ${
                isTestSelected(template)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 text-sm truncate">
                    {template.name}
                  </h4>
                  {template.nameEn && (
                    <p className="text-xs text-gray-500 truncate">{template.nameEn}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {template.code && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {template.code}
                      </span>
                    )}
                    {template.category && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                        {template.category}
                      </span>
                    )}
                  </div>
                  {template.components && template.components.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {template.components.length} composant(s)
                    </p>
                  )}
                </div>
                {selectionMode && isTestSelected(template) && (
                  <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredTemplates.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          {filteredTemplates.length} examen(s) affiché(s)
        </p>
      )}
    </CollapsibleSection>
  );
}
