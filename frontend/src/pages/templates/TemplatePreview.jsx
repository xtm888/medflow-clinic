import React, { useState } from 'react';
import {
  X, Edit2, Copy, Download, Printer, FileText, Tag,
  Clock, User, CheckCircle, AlertCircle
} from 'lucide-react';
import DOMPurify from 'dompurify';

export default function TemplatePreview({ template, onClose, onEdit }) {
  const [variableValues, setVariableValues] = useState(
    template.variables?.reduce((acc, v) => {
      acc[v.name] = v.defaultValue || '';
      return acc;
    }, {}) || {}
  );
  const [copied, setCopied] = useState(false);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      medication: 'bg-blue-100 text-blue-700',
      pathology: 'bg-red-100 text-red-700',
      prescription: 'bg-green-100 text-green-700',
      letter: 'bg-purple-100 text-purple-700',
      instruction: 'bg-yellow-100 text-yellow-700',
      diagnosis: 'bg-orange-100 text-orange-700',
      plan: 'bg-teal-100 text-teal-700',
      examination: 'bg-indigo-100 text-indigo-700'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const renderContent = () => {
    let content = template.content || '';

    // Replace variables with their values
    Object.entries(variableValues).forEach(([name, value]) => {
      const regex = new RegExp(`{{${name}}}`, 'g');
      content = content.replace(regex, value || `[${name}]`);
    });

    // Highlight remaining unset variables
    content = content.replace(/{{(\w+)}}/g, '<span class="bg-yellow-200 px-1 rounded">[$1]</span>');

    return content;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(renderContent().replace(/<[^>]*>/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${template.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            .header { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${template.name}</h1>
            <p>${template.description || ''}</p>
          </div>
          <div class="content">${renderContent().replace(/<[^>]*>/g, '')}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">{template.name}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(template.category)}`}>
                  {template.category}
                </span>
                {template.isActive ? (
                  <span className="flex items-center text-green-600 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center text-gray-500 text-xs">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Description & Meta */}
          {template.description && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
          )}

          {/* Meta Info */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              Created: {formatDate(template.createdAt)}
            </span>
            {template.updatedAt && template.updatedAt !== template.createdAt && (
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                Updated: {formatDate(template.updatedAt)}
              </span>
            )}
            {template.createdBy && (
              <span className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                By: {template.createdBy.firstName} {template.createdBy.lastName}
              </span>
            )}
            {template.usageCount > 0 && (
              <span className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                Used {template.usageCount} times
              </span>
            )}
          </div>

          {/* Tags */}
          {template.tags?.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Variables Input */}
          {template.variables?.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Fill in Variables</h3>
              <div className="grid grid-cols-2 gap-3">
                {template.variables.map((variable) => (
                  <div key={variable.id || variable.name}>
                    <label className="block text-xs text-gray-600 mb-1">
                      {variable.name}
                    </label>
                    {variable.type === 'boolean' ? (
                      <select
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => setVariableValues(prev => ({
                          ...prev,
                          [variable.name]: e.target.value
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select...</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    ) : variable.type === 'date' ? (
                      <input
                        type="date"
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => setVariableValues(prev => ({
                          ...prev,
                          [variable.name]: e.target.value
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        type={variable.type === 'number' ? 'number' : 'text'}
                        value={variableValues[variable.name] || ''}
                        onChange={(e) => setVariableValues(prev => ({
                          ...prev,
                          [variable.name]: e.target.value
                        }))}
                        placeholder={variable.defaultValue || variable.name}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Content */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
            <div
              className="p-4 bg-gray-50 rounded-lg border border-gray-200 whitespace-pre-wrap font-mono text-sm min-h-[200px]"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderContent()) }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              className="px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 inline mr-1 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 inline mr-1" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              <Printer className="w-4 h-4 inline mr-1" />
              Print
            </button>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Edit2 className="w-4 h-4 inline mr-2" />
              Edit Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
