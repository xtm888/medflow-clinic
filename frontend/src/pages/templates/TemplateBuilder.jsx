import React, { useState, useEffect } from 'react';
import {
  X, Save, FileText, Tag, Plus, Trash2, GripVertical,
  Code, Eye, Bold, Italic, List, Link2, Image
} from 'lucide-react';
import DOMPurify from 'dompurify';
import api from '../../services/apiConfig';

export default function TemplateBuilder({ template, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'medication',
    description: '',
    content: '',
    tags: [],
    variables: [],
    isActive: true
  });
  const [newTag, setNewTag] = useState('');
  const [newVariable, setNewVariable] = useState({ name: '', defaultValue: '', type: 'text' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const categories = [
    { value: 'medication', label: 'Médicament' },
    { value: 'pathology', label: 'Pathologie' },
    { value: 'prescription', label: 'Ordonnance' },
    { value: 'letter', label: 'Lettre' },
    { value: 'instruction', label: 'Instructions' },
    { value: 'diagnosis', label: 'Diagnostic' },
    { value: 'plan', label: 'Plan de traitement' },
    { value: 'examination', label: 'Examen' }
  ];

  const variableTypes = [
    { value: 'text', label: 'Texte' },
    { value: 'number', label: 'Nombre' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Sélection' },
    { value: 'boolean', label: 'Oui/Non' }
  ];

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        category: template.category || 'medication',
        description: template.description || '',
        content: template.content || '',
        tags: template.tags || [],
        variables: template.variables || [],
        isActive: template.isActive !== false
      });
    }
  }, [template]);

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleAddVariable = () => {
    if (newVariable.name.trim()) {
      setFormData(prev => ({
        ...prev,
        variables: [...prev.variables, { ...newVariable, id: Date.now() }]
      }));
      setNewVariable({ name: '', defaultValue: '', type: 'text' });
    }
  };

  const handleRemoveVariable = (variableId) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v.id !== variableId)
    }));
  };

  const insertVariable = (variableName) => {
    const textArea = document.getElementById('template-content');
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const text = formData.content;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newContent = `${before}{{${variableName}}}${after}`;
    setFormData(prev => ({ ...prev, content: newContent }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Le nom du modèle est requis');
      return;
    }

    if (!formData.content.trim()) {
      setError('Le contenu du modèle est requis');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (template?._id) {
        await api.put(`/consultation-templates/${template._id}`, formData);
      } else {
        await api.post('/consultation-templates', formData);
      }

      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'enregistrement du modèle');
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    let preview = formData.content;
    formData.variables.forEach(variable => {
      const regex = new RegExp(`{{${variable.name}}}`, 'g');
      preview = preview.replace(regex, `<span class="bg-yellow-200 px-1">${variable.defaultValue || variable.name}</span>`);
    });
    return preview;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold">
              {template ? 'Modifier le modèle' : 'Créer un nouveau modèle'}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`p-2 rounded-lg transition ${previewMode ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              title={previewMode ? 'Éditer' : 'Aperçu'}
            >
              {previewMode ? <Code className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Form */}
            <div className="lg:col-span-2 space-y-4">
              {/* Name & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du modèle *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Entrez le nom du modèle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brève description de ce modèle"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenu du modèle *
                </label>
                {previewMode ? (
                  <div
                    className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderPreview()) }}
                  />
                ) : (
                  <textarea
                    id="template-content"
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Entrez le contenu du modèle. Utilisez {{nomVariable}} pour les valeurs dynamiques."
                  />
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Étiquettes
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-blue-500 hover:text-blue-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ajouter une étiquette"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Variables */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Variables du modèle</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Définissez les variables qui seront remplacées lors de l'utilisation du modèle.
                </p>

                {/* Existing Variables */}
                <div className="space-y-2 mb-4">
                  {formData.variables.map((variable) => (
                    <div
                      key={variable.id}
                      className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                    >
                      <div className="flex-1">
                        <button
                          onClick={() => insertVariable(variable.name)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          {`{{${variable.name}}}`}
                        </button>
                        <p className="text-xs text-gray-500">{variable.type}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveVariable(variable.id)}
                        className="p-1 text-red-500 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add New Variable */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newVariable.name}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom de la variable"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newVariable.type}
                      onChange={(e) => setNewVariable(prev => ({ ...prev, type: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {variableTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newVariable.defaultValue}
                      onChange={(e) => setNewVariable(prev => ({ ...prev, defaultValue: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Valeur par défaut"
                    />
                  </div>
                  <button
                    onClick={handleAddVariable}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Ajouter une variable
                  </button>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Actif</span>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    formData.isActive ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      formData.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 inline mr-2" />
                {template ? 'Mettre à jour' : 'Créer le modèle'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
