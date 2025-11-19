import { X, Keyboard } from 'lucide-react';
import { formatShortcut, getShortcutsByCategory } from '../hooks/useKeyboardShortcuts';

function KeyboardShortcutsHelp({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcutsByCategory = getShortcutsByCategory();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
            <div className="flex items-center gap-3">
              <Keyboard className="w-6 h-6 text-white" />
              <h3 className="text-xl font-semibold text-white">
                Raccourcis Clavier
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-blue-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
            <p className="text-sm text-gray-600 mb-6">
              Utilisez ces raccourcis clavier pour naviguer plus rapidement dans l'application.
            </p>

            <div className="space-y-6">
              {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.key}
                        className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <span className="text-sm text-gray-700">
                          {shortcut.description}
                        </span>
                        <kbd className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-lg shadow-sm">
                          {formatShortcut(shortcut.key)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-900 mb-2">💡 Astuces</h5>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Appuyez sur <kbd className="px-2 py-0.5 text-xs bg-white border border-blue-300 rounded">F1</kbd> ou <kbd className="px-2 py-0.5 text-xs bg-white border border-blue-300 rounded">?</kbd> pour afficher cette aide</li>
                <li>• Appuyez sur <kbd className="px-2 py-0.5 text-xs bg-white border border-blue-300 rounded">Esc</kbd> pour fermer les boîtes de dialogue</li>
                <li>• Les raccourcis ne fonctionnent pas lorsque vous tapez dans un champ de saisie</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsHelp;
