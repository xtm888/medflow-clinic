import React, { useState, useEffect } from 'react';
import {
  FileText, Search, X, Eye, Download, Save, Filter,
  ChevronRight, Printer, Copy, CheckCircle, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getTemplates,
  getCategories,
  previewTemplate,
  generateDocument
} from '../../services/documentGenerationService';

const DocumentGenerator = ({
  patientId,
  visitId,
  onClose,
  onDocumentGenerated
}) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [preview, setPreview] = useState(null);
  const [customData, setCustomData] = useState({});
  const [saveToVisit, setSaveToVisit] = useState(true);
  const [view, setView] = useState('select'); // 'select', 'preview', 'edit'

  // Load templates and categories on mount
  useEffect(() => {
    loadTemplatesAndCategories();
  }, []);

  const loadTemplatesAndCategories = async () => {
    try {
      setLoading(true);
      const [templatesRes, categoriesRes] = await Promise.all([
        getTemplates(),
        getCategories()
      ]);
      setTemplates(templatesRes.data || []);
      setCategories(categoriesRes.data || {});
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Erreur lors du chargement des modèles');
    } finally {
      setLoading(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSubCategory = selectedSubCategory === 'all' || template.subCategory === selectedSubCategory;
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSubCategory && matchesSearch;
  });

  // Handle template selection and preview
  const handleSelectTemplate = async (template) => {
    try {
      setLoading(true);
      setSelectedTemplate(template);

      // Get preview with auto-filled data
      const previewRes = await previewTemplate(template._id, {
        patientId,
        visitId,
        customData
      });

      setPreview(previewRes.data);
      setView('preview');
    } catch (error) {
      console.error('Error previewing template:', error);
      toast.error('Erreur lors de la prévisualisation');
    } finally {
      setLoading(false);
    }
  };

  // Handle generate document
  const handleGenerate = async () => {
    try {
      setLoading(true);

      const result = await generateDocument({
        templateId: selectedTemplate._id,
        patientId,
        visitId,
        customData,
        saveToVisit: saveToVisit && visitId
      });

      toast.success('Document généré avec succès!');

      // Call callback if provided
      if (onDocumentGenerated) {
        onDocumentGenerated(result.data);
      }

      // Close modal
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error generating document:', error);
      toast.error('Erreur lors de la génération du document');
    } finally {
      setLoading(false);
    }
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = () => {
    if (preview?.content) {
      navigator.clipboard.writeText(preview.content);
      toast.success('Document copié dans le presse-papiers');
    }
  };

  // Handle print
  const handlePrint = () => {
    if (preview?.content) {
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write('<html><head><title>Imprimer Document</title>');
      printWindow.document.write('<style>body { font-family: Arial, sans-serif; padding: 20px; white-space: pre-wrap; }</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(preview.content);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Render category buttons
  const renderCategoryFilters = () => {
    const categoryNames = {
      certificate: 'Certificats',
      correspondence: 'Correspondance',
      examination_report: 'Rapports d\'examen',
      operative_report: 'Comptes rendus opératoires',
      payment: 'Paiements',
      prescription_instructions: 'Instructions',
      reminder: 'Rappels',
      surgical_consent: 'Consentements'
    };

    return (
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => {
            setSelectedCategory('all');
            setSelectedSubCategory('all');
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Tous
        </button>
        {Object.keys(categories).map(category => (
          <button
            key={category}
            onClick={() => {
              setSelectedCategory(category);
              setSelectedSubCategory('all');
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {categoryNames[category] || category}
            <span className="ml-1 text-xs opacity-75">
              ({categories[category]?.reduce((acc, sub) => acc + sub.count, 0)})
            </span>
          </button>
        ))}
      </div>
    );
  };

  // Render template list
  const renderTemplateList = () => {
    return (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun modèle trouvé</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <button
              key={template._id}
              onClick={() => handleSelectTemplate(template)}
              className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    {template.nameEn && (
                      <span className="text-xs text-gray-500">({template.nameEn})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="px-2 py-0.5 bg-gray-100 rounded">
                      {template.category}
                    </span>
                    {template.subCategory && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded">
                        {template.subCategory}
                      </span>
                    )}
                    {template.usageCount > 0 && (
                      <span className="text-gray-500">
                        Utilisé {template.usageCount} fois
                      </span>
                    )}
                  </div>
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {template.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
              </div>
            </button>
          ))
        )}
      </div>
    );
  };

  // Render preview
  const renderPreview = () => {
    if (!preview) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{preview.templateName}</h3>
          <button
            onClick={() => setView('select')}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document preview */}
        <div className="border border-gray-300 rounded-lg p-6 bg-white min-h-[400px] max-h-[600px] overflow-y-auto">
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900">
            {preview.content}
          </pre>
        </div>

        {/* Custom data editor (if needed) */}
        {preview.remainingVariables && preview.remainingVariables.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900 mb-2">
                  Variables non remplies ({preview.remainingVariables.length})
                </h4>
                <div className="space-y-2">
                  {preview.remainingVariables.map(variable => (
                    <div key={variable.name}>
                      <label className="block text-sm font-medium text-yellow-900 mb-1">
                        {variable.label}
                      </label>
                      <input
                        type={variable.type === 'number' ? 'number' : variable.type === 'date' ? 'date' : 'text'}
                        value={customData[variable.name] || ''}
                        onChange={(e) => {
                          setCustomData({
                            ...customData,
                            [variable.name]: e.target.value
                          });
                        }}
                        className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder={variable.defaultValue || ''}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => handleSelectTemplate(selectedTemplate)}
                    className="mt-2 text-sm text-yellow-700 hover:text-yellow-900 underline"
                  >
                    Actualiser l'aperçu
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Copy className="w-4 h-4" />
              Copier
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
          </div>

          <div className="flex items-center gap-3">
            {visitId && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={saveToVisit}
                  onChange={(e) => setSaveToVisit(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Sauvegarder dans la visite
              </label>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Génération...' : 'Générer'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Générateur de Documents</h2>
                <p className="text-blue-100 text-sm">
                  {view === 'select' ? 'Sélectionnez un modèle' : 'Prévisualisation'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-700 p-2 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'select' ? (
            <>
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un modèle..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Category filters */}
              {renderCategoryFilters()}

              {/* Template list */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Chargement des modèles...</p>
                </div>
              ) : (
                renderTemplateList()
              )}
            </>
          ) : (
            renderPreview()
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentGenerator;
