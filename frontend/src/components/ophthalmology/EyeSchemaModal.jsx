/**
 * EyeSchemaModal - Modal wrapper for the Eye Schema drawing tool
 *
 * Used in:
 * - StudioVision consultation (Quick Actions)
 * - Pathology picker
 * - Exam documentation
 */

import { useState, useEffect } from 'react';
import { X, Eye, Maximize2, Minimize2 } from 'lucide-react';
import EyeSchemaCanvas from './EyeSchemaCanvas';

export default function EyeSchemaModal({
  isOpen,
  onClose,
  onSave,
  initialTemplate = 'anterior',
  initialEye = 'OD',
  initialDrawings = [],
  patientName = '',
  examId = null
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [savedSchemas, setSavedSchemas] = useState([]);

  // Handle save from canvas
  const handleSave = (schemaData) => {
    const schema = {
      ...schemaData,
      patientName,
      examId,
      savedAt: new Date().toISOString()
    };

    // Add to saved schemas
    setSavedSchemas([...savedSchemas, schema]);

    // Call parent save handler
    if (onSave) {
      onSave(schema);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-xl shadow-2xl transition-all duration-200 ${
          isFullscreen ? 'w-full h-full m-0 rounded-none' : 'max-w-2xl w-full mx-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Schéma Oculaire</h2>
            {patientName && (
              <span className="text-sm opacity-80">- {patientName}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded hover:bg-white/20 transition"
              title={isFullscreen ? 'Réduire' : 'Plein écran'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/20 transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`p-4 ${isFullscreen ? 'h-[calc(100%-60px)] overflow-auto' : ''}`}>
          <EyeSchemaCanvas
            initialTemplate={initialTemplate}
            initialEye={initialEye}
            initialDrawings={initialDrawings}
            onSave={handleSave}
            width={isFullscreen ? window.innerWidth - 40 : 500}
            height={isFullscreen ? window.innerHeight - 100 : 520}
          />

          {/* Saved Schemas Preview (if any) */}
          {savedSchemas.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                Schémas enregistrés ({savedSchemas.length})
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {savedSchemas.map((schema, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 w-24 border rounded p-1 bg-gray-50"
                  >
                    <img
                      src={schema.imageData}
                      alt={`Schema ${idx + 1}`}
                      className="w-full h-20 object-contain"
                    />
                    <div className="text-xs text-center text-gray-500 mt-1">
                      {schema.eye} - {schema.template}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 rounded-b-xl">
          <div className="text-xs text-gray-500">
            Utilisez les outils ci-dessus pour annoter le schéma
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
