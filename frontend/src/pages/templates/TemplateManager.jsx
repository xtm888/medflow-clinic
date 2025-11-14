import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, Filter, Edit2, Copy, Trash2, Share2,
  Tag, Clock, Users, CheckCircle, AlertCircle, Star, StarOff,
  Grid, List, Download, Upload, Settings
} from 'lucide-react';
import api from '../../services/api';
import TemplateBuilder from './TemplateBuilder';
import TemplatePreview from './TemplatePreview';

export default function TemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showShareModal, setShowShareModal] = useState(false);

  const categories = [
    { value: 'all', label: 'All Templates', icon: Grid },
    { value: 'medication', label: 'Medications', icon: FileText },
    { value: 'pathology', label: 'Pathology', icon: AlertCircle },
    { value: 'prescription', label: 'Prescriptions', icon: FileText },
    { value: 'letter', label: 'Letters', icon: FileText },
    { value: 'instruction', label: 'Instructions', icon: FileText },
    { value: 'diagnosis', label: 'Diagnoses', icon: CheckCircle },
    { value: 'plan', label: 'Treatment Plans', icon: FileText },
    { value: 'examination', label: 'Examinations', icon: FileText }
  ];

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const response = await api.get(`/api/templates${params}`);
      setTemplates(response.data.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await api.delete(`/api/templates/${templateId}`);
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };

  const handleCloneTemplate = async (templateId) => {
    try {
      const response = await api.post(`/api/templates/${templateId}/clone`);
      fetchTemplates();
      setSelectedTemplate(response.data.data);
      setShowBuilder(true);
    } catch (error) {
      console.error('Error cloning template:', error);
    }
  };

  const handlePinTemplate = async (templateId) => {
    try {
      await api.put(`/api/templates/${templateId}/pin`);
      fetchTemplates();
    } catch (error) {
      console.error('Error pinning template:', error);
    }
  };

  const handleApplyTemplate = async (templateId) => {
    try {
      const response = await api.post(`/api/templates/${templateId}/apply`, {
        context: {
          patientName: 'John Doe', // This would come from actual patient context
          date: new Date().toLocaleDateString()
        }
      });
      console.log('Template applied:', response.data.data);
      // Handle the applied template data (e.g., populate form fields)
    } catch (error) {
      console.error('Error applying template:', error);
    }
  };

  const getCategoryIcon = (category) => {
    const categoryData = categories.find(c => c.value === category);
    return categoryData ? categoryData.icon : FileText;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Template Manager</h1>
            <p className="text-gray-600 mt-1">Create and manage clinical templates</p>
          </div>
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
              <Upload className="w-5 h-5 inline mr-2" />
              Import
            </button>
            <button
              onClick={() => {
                setSelectedTemplate(null);
                setShowBuilder(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5 inline mr-2" />
              New Template
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>

            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Grid/List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No templates found</p>
          <button
            onClick={() => setShowBuilder(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create Your First Template
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => {
            const Icon = getCategoryIcon(template.category);
            return (
              <div
                key={template._id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer"
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${
                      template.category === 'medication' ? 'bg-blue-100' :
                      template.category === 'pathology' ? 'bg-red-100' :
                      template.category === 'prescription' ? 'bg-green-100' :
                      template.category === 'letter' ? 'bg-purple-100' :
                      'bg-gray-100'
                    }`}>
                      <Icon className="w-5 h-5 text-gray-700" />
                    </div>
                    {template.quickAccess?.isPinned && (
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    )}
                  </div>

                  <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {template.description || 'No description'}
                  </p>

                  {/* Tags */}
                  {template.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {template.usageCount || 0} uses
                    </span>
                    <span>{formatDate(template.createdAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-200 p-3 flex justify-between">
                  <div className="flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyTemplate(template._id);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                      title="Apply Template"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplate(template);
                        setShowPreview(true);
                      }}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition"
                      title="Preview"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloneTemplate(template._id);
                      }}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition"
                      title="Clone"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePinTemplate(template._id);
                      }}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition"
                      title="Pin/Unpin"
                    >
                      {template.quickAccess?.isPinned ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplate(template);
                        setShowBuilder(true);
                      }}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template._id);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // List View
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTemplates.map((template) => (
                <tr key={template._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {template.quickAccess?.isPinned && (
                        <Star className="w-4 h-4 text-yellow-500 fill-current mr-2" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{template.name}</p>
                        {template.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {template.tags.slice(0, 2).map((tag, index) => (
                              <span key={index} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {template.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {template.usageCount || 0} times
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(template.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-1">
                      <button
                        onClick={() => handleApplyTemplate(template._id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Apply"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowBuilder(true);
                        }}
                        className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template._id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Template Builder Modal */}
      {showBuilder && (
        <TemplateBuilder
          template={selectedTemplate}
          onClose={() => {
            setShowBuilder(false);
            setSelectedTemplate(null);
            fetchTemplates();
          }}
        />
      )}

      {/* Template Preview Modal */}
      {showPreview && selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
          }}
          onEdit={() => {
            setShowPreview(false);
            setShowBuilder(true);
          }}
        />
      )}
    </div>
  );
}