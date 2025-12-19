/**
 * ShortcutsModal - Modal showing keyboard shortcuts for Queue page
 */
import { memo } from 'react';
import PropTypes from 'prop-types';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  {
    category: 'Actions File',
    items: [
      { key: 'N', description: 'Appeler le prochain patient' },
      { key: 'C', description: 'Ouvrir l\'enregistrement' },
      { key: 'W', description: 'Ajouter un patient sans RDV' },
      { key: 'R', description: 'Rafraîchir la file' }
    ]
  },
  {
    category: 'Appel Rapide',
    items: [
      { key: '1', description: 'Appeler le 1er patient' },
      { key: '2', description: 'Appeler le 2e patient' },
      { key: '3', description: 'Appeler le 3e patient' }
    ]
  },
  {
    category: 'Interface',
    items: [
      { key: 'Esc', description: 'Fermer la fenêtre active' },
      { key: '?', description: 'Afficher les raccourcis' }
    ]
  }
];

function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Keyboard className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Raccourcis Clavier</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {SHORTCUTS.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-gray-700">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-sm font-mono text-gray-800 shadow-sm">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tip */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Astuce:</strong> Les raccourcis sont désactivés lorsqu'une fenêtre est ouverte.
              Utilisez <kbd className="px-1 py-0.5 bg-white border rounded text-xs">Esc</kbd> pour fermer.
            </p>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

ShortcutsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default memo(ShortcutsModal);
