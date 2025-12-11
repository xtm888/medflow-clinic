import { useState, useEffect } from 'react';
import {
  FileText,
  Glasses,
  Eye,
  CheckCircle,
  Search,
  AlertCircle,
  BookOpen,
  ChevronDown,
  Check,
  Loader2,
  Sparkles
} from 'lucide-react';
import consultationTemplateService from '../../services/consultationTemplateService';

/**
 * Icon mapping for template icons
 */
const IconMap = {
  'glasses': Glasses,
  'eye': Eye,
  'check-circle': CheckCircle,
  'search': Search,
  'alert-circle': AlertCircle,
  'book-open': BookOpen,
  'file-text': FileText
};

/**
 * Color mapping for template colors
 */
const colorClasses = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300', hover: 'hover:bg-blue-50' },
  green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300', hover: 'hover:bg-green-50' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300', hover: 'hover:bg-purple-50' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300', hover: 'hover:bg-orange-50' },
  red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300', hover: 'hover:bg-red-50' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-300', hover: 'hover:bg-indigo-50' }
};

/**
 * TemplateSelector - Dropdown to select and apply consultation templates
 *
 * @param {Function} onApply - Called with template data when user applies a template
 * @param {string} selectedTemplateId - Currently applied template ID (if any)
 * @param {boolean} disabled - Disable the selector
 * @param {string} className - Additional CSS classes
 */
export default function TemplateSelector({
  onApply,
  selectedTemplateId = null,
  disabled = false,
  className = ''
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const response = await consultationTemplateService.getTemplates();
        if (response.success) {
          setTemplates(response.data || []);
        } else {
          setError('Impossible de charger les modèles');
        }
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Handle template selection
  const handleSelect = async (template) => {
    if (disabled || applying) return;

    try {
      setApplying(true);

      // Apply template data
      const appliedData = consultationTemplateService.applyTemplate(template);

      // Record usage
      try {
        await consultationTemplateService.recordUsage(template._id);
      } catch (err) {
        // Non-critical, just log
        console.warn('Failed to record template usage:', err);
      }

      // Call parent handler
      onApply?.(appliedData, template);

      setIsOpen(false);
    } catch (err) {
      console.error('Error applying template:', err);
    } finally {
      setApplying(false);
    }
  };

  // Get selected template
  const selectedTemplate = templates.find(t => t._id === selectedTemplateId);

  // Render template item
  const renderTemplateItem = (template) => {
    const IconComponent = IconMap[template.icon] || FileText;
    const colors = colorClasses[template.color] || colorClasses.blue;
    const isSelected = template._id === selectedTemplateId;

    return (
      <button
        key={template._id}
        onClick={() => handleSelect(template)}
        disabled={applying}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition ${
          isSelected
            ? `${colors.bg} ${colors.border} border`
            : `hover:bg-gray-50 border border-transparent`
        }`}
      >
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <IconComponent className={`h-4 w-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{template.name}</div>
          <div className="text-xs text-gray-500 truncate">{template.description}</div>
        </div>
        {isSelected && (
          <Check className={`h-5 w-5 ${colors.text}`} />
        )}
      </button>
    );
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  const categoryLabels = {
    refraction: 'Réfraction',
    surgical: 'Chirurgie',
    medical: 'Médical',
    screening: 'Dépistage',
    pediatric: 'Pédiatrie',
    other: 'Autres'
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg text-red-600 ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-gray-500 ${className}`}>
        <FileText className="h-4 w-4" />
        <span className="text-sm">Aucun modèle disponible</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : selectedTemplate
              ? `${colorClasses[selectedTemplate.color]?.bg || 'bg-blue-100'} ${colorClasses[selectedTemplate.color]?.border || 'border-blue-300'} ${colorClasses[selectedTemplate.color]?.text || 'text-blue-600'}`
              : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
        }`}
      >
        {applying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : selectedTemplate ? (
          <>
            {(() => {
              const Icon = IconMap[selectedTemplate.icon] || FileText;
              return <Icon className="h-4 w-4" />;
            })()}
          </>
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {selectedTemplate ? selectedTemplate.name : 'Modèle rapide'}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Modèles de consultation
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pré-remplit le formulaire avec les données du modèle
              </p>
            </div>

            {/* Templates List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-3">
              {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                <div key={category}>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                    {categoryLabels[category] || category}
                  </div>
                  <div className="space-y-1">
                    {categoryTemplates.map(renderTemplateItem)}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {selectedTemplate && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={() => {
                    onApply?.(null, null);
                    setIsOpen(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Réinitialiser (aucun modèle)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
