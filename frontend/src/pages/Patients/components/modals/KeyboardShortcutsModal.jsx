/**
 * KeyboardShortcutsModal Component
 *
 * Modal displaying available keyboard shortcuts.
 */

import { Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '../../constants';

export default function KeyboardShortcutsModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Raccourcis Clavier</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {KEYBOARD_SHORTCUTS.map((category, idx) => (
              <ShortcutCategory key={idx} category={category} />
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Les raccourcis sont désactivés quand vous tapez dans un champ
            </p>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-primary"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutCategory({ category }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {category.category}
      </h3>
      <div className="space-y-2">
        {category.shortcuts.map((shortcut, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-gray-700">{shortcut.action}</span>
            <kbd className="px-2 py-1 bg-gray-100 border rounded text-sm font-mono">
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
