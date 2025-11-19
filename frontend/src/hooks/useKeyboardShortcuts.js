import { useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for keyboard shortcuts
 *
 * @param {Object} shortcuts - Object mapping key combinations to handlers
 * @param {boolean} enabled - Whether shortcuts are enabled
 * @param {Array} deps - Dependencies for the callback
 *
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+s': () => handleSave(),
 *   'ctrl+n': () => handleNew(),
 *   'esc': () => handleClose(),
 * }, true);
 */
export function useKeyboardShortcuts(shortcuts, enabled = true, deps = []) {
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields (unless it's Escape)
    const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
    if (isInputField && event.key !== 'Escape') return;

    // Build the key combination string
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('meta');

    // Normalize key name
    let key = event.key.toLowerCase();

    // Handle special keys
    const specialKeys = {
      'escape': 'esc',
      'arrowup': 'up',
      'arrowdown': 'down',
      'arrowleft': 'left',
      'arrowright': 'right',
      ' ': 'space'
    };
    key = specialKeys[key] || key;

    // Don't add modifier keys to the combination if they're already included
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }

    const combination = parts.join('+');

    // Check if this combination has a handler
    const handler = shortcutsRef.current[combination];
    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler(event);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown, ...deps]);
}

/**
 * Predefined keyboard shortcuts with descriptions
 */
export const SHORTCUTS = {
  // Navigation
  'ctrl+h': { description: 'Aller au tableau de bord', category: 'Navigation' },
  'ctrl+p': { description: 'Aller aux patients', category: 'Navigation' },
  'ctrl+q': { description: 'Aller à la file d\'attente', category: 'Navigation' },
  'ctrl+a': { description: 'Aller aux rendez-vous', category: 'Navigation' },

  // Actions
  'ctrl+n': { description: 'Nouveau patient', category: 'Actions' },
  'ctrl+f': { description: 'Recherche globale', category: 'Actions' },
  'ctrl+k': { description: 'Palette de commandes', category: 'Actions' },
  'ctrl+shift+p': { description: 'Imprimer/Générer document', category: 'Actions' },
  'ctrl+s': { description: 'Sauvegarder', category: 'Actions' },

  // UI
  'esc': { description: 'Fermer/Annuler', category: 'Interface' },
  'f1': { description: 'Aide et raccourcis', category: 'Interface' },
  '?': { description: 'Aide et raccourcis', category: 'Interface' },

  // Quick Actions
  'alt+1': { description: 'Action rapide 1', category: 'Actions rapides' },
  'alt+2': { description: 'Action rapide 2', category: 'Actions rapides' },
  'alt+3': { description: 'Action rapide 3', category: 'Actions rapides' },
  'alt+4': { description: 'Action rapide 4', category: 'Actions rapides' },
};

/**
 * Format key combination for display
 */
export function formatShortcut(combination) {
  const parts = combination.split('+');
  const formatted = parts.map(part => {
    const keyMap = {
      'ctrl': '⌃',
      'alt': '⌥',
      'shift': '⇧',
      'meta': '⌘',
      'esc': 'Esc',
      'up': '↑',
      'down': '↓',
      'left': '←',
      'right': '→',
      'space': 'Space',
      'enter': '↵',
      'tab': '⇥',
      'backspace': '⌫',
      'delete': '⌦'
    };
    return keyMap[part.toLowerCase()] || part.toUpperCase();
  });
  return formatted.join('');
}

/**
 * Check if a key combination is valid
 */
export function isValidShortcut(combination) {
  const parts = combination.toLowerCase().split('+');
  const modifiers = ['ctrl', 'alt', 'shift', 'meta'];
  const hasModifier = parts.some(part => modifiers.includes(part));
  const hasKey = parts.some(part => !modifiers.includes(part));

  return hasModifier && hasKey;
}

/**
 * Get shortcuts by category
 */
export function getShortcutsByCategory() {
  const categories = {};

  Object.entries(SHORTCUTS).forEach(([key, value]) => {
    const category = value.category || 'Autres';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({ key, ...value });
  });

  return categories;
}

export default useKeyboardShortcuts;
