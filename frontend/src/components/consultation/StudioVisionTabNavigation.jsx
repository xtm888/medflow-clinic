/**
 * StudioVisionTabNavigation - Tab-based navigation like StudioVision XP
 *
 * Matches the original StudioVision tabs:
 * Résumé | Réfraction | Lentilles | Pathologies | Orthoptie | Examen | Traitement | Règlement
 *
 * Features:
 * - Keyboard navigation (arrow keys, number keys 1-8)
 * - Badge indicators for unsaved changes
 * - Color-coded active states
 */

import { useCallback, useEffect } from 'react';
import {
  FileText,
  Glasses,
  Eye,
  Stethoscope,
  Activity,
  Search,
  Pill,
  CreditCard,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Tab configuration matching StudioVision XP
export const CONSULTATION_TABS = [
  {
    id: 'resume',
    label: 'Résumé',
    shortLabel: 'Rés',
    icon: FileText,
    color: 'gray',
    description: 'Vue d\'ensemble de la consultation'
  },
  {
    id: 'refraction',
    label: 'Réfraction',
    shortLabel: 'Réf',
    icon: Glasses,
    color: 'pink',
    description: 'Mesures réfractives et kératométrie'
  },
  {
    id: 'lentilles',
    label: 'Lentilles',
    shortLabel: 'Lent',
    icon: Eye,
    color: 'cyan',
    description: 'Adaptation lentilles de contact'
  },
  {
    id: 'pathologies',
    label: 'Pathologies',
    shortLabel: 'Path',
    icon: Stethoscope,
    color: 'yellow',
    description: 'Diagnostic et pathologies'
  },
  {
    id: 'orthoptie',
    label: 'Orthoptie',
    shortLabel: 'Orth',
    icon: Activity,
    color: 'purple',
    description: 'Bilan orthoptique'
  },
  {
    id: 'examen',
    label: 'Examen',
    shortLabel: 'Exam',
    icon: Search,
    color: 'green',
    description: 'Examen clinique (LAF, FO, PIO)'
  },
  {
    id: 'traitement',
    label: 'Traitement',
    shortLabel: 'Trait',
    icon: Pill,
    color: 'blue',
    description: 'Ordonnance et prescriptions'
  },
  {
    id: 'reglement',
    label: 'Règlement',
    shortLabel: 'Règl',
    icon: CreditCard,
    color: 'emerald',
    description: 'Facturation et paiements'
  }
];

// Color mapping for tabs (StudioVision style)
const TAB_COLORS = {
  gray: {
    bg: 'bg-gray-100',
    bgActive: 'bg-gray-700',
    text: 'text-gray-600',
    textActive: 'text-white',
    border: 'border-gray-300',
    borderActive: 'border-gray-700'
  },
  pink: {
    bg: 'bg-pink-50',
    bgActive: 'bg-pink-600',
    text: 'text-pink-700',
    textActive: 'text-white',
    border: 'border-pink-200',
    borderActive: 'border-pink-600'
  },
  cyan: {
    bg: 'bg-cyan-50',
    bgActive: 'bg-cyan-600',
    text: 'text-cyan-700',
    textActive: 'text-white',
    border: 'border-cyan-200',
    borderActive: 'border-cyan-600'
  },
  yellow: {
    bg: 'bg-yellow-50',
    bgActive: 'bg-yellow-500',
    text: 'text-yellow-700',
    textActive: 'text-white',
    border: 'border-yellow-200',
    borderActive: 'border-yellow-500'
  },
  purple: {
    bg: 'bg-purple-50',
    bgActive: 'bg-purple-600',
    text: 'text-purple-700',
    textActive: 'text-white',
    border: 'border-purple-200',
    borderActive: 'border-purple-600'
  },
  green: {
    bg: 'bg-green-50',
    bgActive: 'bg-green-600',
    text: 'text-green-700',
    textActive: 'text-white',
    border: 'border-green-200',
    borderActive: 'border-green-600'
  },
  blue: {
    bg: 'bg-blue-50',
    bgActive: 'bg-blue-600',
    text: 'text-blue-700',
    textActive: 'text-white',
    border: 'border-blue-200',
    borderActive: 'border-blue-600'
  },
  emerald: {
    bg: 'bg-emerald-50',
    bgActive: 'bg-emerald-600',
    text: 'text-emerald-700',
    textActive: 'text-white',
    border: 'border-emerald-200',
    borderActive: 'border-emerald-600'
  }
};

export default function StudioVisionTabNavigation({
  activeTab = 'resume',
  onTabChange,
  hasChanges = {},  // { refraction: true, traitement: false, ... }
  disabled = false,
  compact = false,
  showLabels = true,
  className = ''
}) {
  // Check if user is typing in an editable field
  const isEditableElement = useCallback((element) => {
    if (!element) return false;
    const tagName = element.tagName?.toLowerCase();
    // Check for standard form elements
    if (['input', 'textarea', 'select'].includes(tagName)) {
      return true;
    }
    // Check for contentEditable elements
    if (element.isContentEditable) {
      return true;
    }
    // Check for role="textbox" or role="spinbutton" (custom inputs)
    const role = element.getAttribute?.('role');
    if (['textbox', 'spinbutton', 'searchbox', 'combobox'].includes(role)) {
      return true;
    }
    return false;
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    // IMPORTANT: Don't capture keyboard events when user is typing in an input field
    // This prevents number keys from switching tabs while entering numeric data
    if (isEditableElement(document.activeElement)) {
      return;
    }

    const currentIndex = CONSULTATION_TABS.findIndex(t => t.id === activeTab);

    // Arrow navigation (only when not in editable - already checked above)
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      e.preventDefault();
      onTabChange?.(CONSULTATION_TABS[currentIndex - 1].id);
    } else if (e.key === 'ArrowRight' && currentIndex < CONSULTATION_TABS.length - 1) {
      e.preventDefault();
      onTabChange?.(CONSULTATION_TABS[currentIndex + 1].id);
    }

    // Number key navigation (1-8) - only when NOT typing in a field
    const numKey = parseInt(e.key);
    if (numKey >= 1 && numKey <= CONSULTATION_TABS.length) {
      e.preventDefault();
      onTabChange?.(CONSULTATION_TABS[numKey - 1].id);
    }
  }, [activeTab, onTabChange, disabled, isEditableElement]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={`bg-white border-b border-gray-200 ${className}`}>
      <nav className="flex overflow-x-auto snap-x snap-mandatory" role="tablist" aria-label="Consultation sections">
        {CONSULTATION_TABS.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const hasUnsavedChanges = hasChanges[tab.id];
          const colors = TAB_COLORS[tab.color];
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              onClick={() => onTabChange?.(tab.id)}
              title={`${tab.description} (${index + 1})`}
              className={`
                relative flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium
                border-b-2 transition-all duration-150 whitespace-nowrap snap-start
                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${isActive
                  ? `${colors.bgActive} ${colors.textActive} ${colors.borderActive}`
                  : `bg-white ${colors.text} border-transparent hover:${colors.bg} hover:${colors.border}`
                }
                ${compact ? 'px-2 py-2' : ''}
              `}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />

              {showLabels && (
                <span className={compact ? 'hidden sm:inline' : ''}>
                  {compact ? tab.shortLabel : tab.label}
                </span>
              )}

              {/* Unsaved changes indicator */}
              {hasUnsavedChanges && !isActive && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500" />
              )}

              {/* Keyboard shortcut hint */}
              {!compact && (
                <span className={`
                  hidden lg:inline-flex ml-1 px-1.5 py-0.5 text-[10px] rounded
                  ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}
                `}>
                  {index + 1}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile scroll indicators */}
      <div className="sm:hidden flex justify-between px-2 py-1 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <ChevronLeft className="h-3 w-3" /> Glisser
        </span>
        <span className="flex items-center gap-1">
          Glisser <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

// Mini version for embedding in headers
export function StudioVisionTabNavigationMini({
  activeTab,
  onTabChange,
  tabs = ['resume', 'refraction', 'pathologies', 'traitement'],
  className = ''
}) {
  const filteredTabs = CONSULTATION_TABS.filter(t => tabs.includes(t.id));

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {filteredTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const colors = TAB_COLORS[tab.color];
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            title={tab.label}
            className={`
              p-1.5 rounded-md transition-colors
              ${isActive
                ? `${colors.bgActive} text-white`
                : `text-gray-500 hover:${colors.bg} hover:${colors.text}`
              }
            `}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
