/**
 * StudioVisionModeToggle
 *
 * Toggle switch for switching between Standard and StudioVision view modes.
 * Can be used globally or per-module.
 */

import { LayoutGrid, List, ToggleLeft, ToggleRight, ChevronDown, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useStudioVisionMode, useModuleViewMode } from '../contexts/StudioVisionModeContext';

/**
 * Global mode toggle for consultation header
 */
export function GlobalModeToggle({ className = '' }) {
  const { globalMode, toggleGlobalMode, animations, compactMode, toggleAnimations, toggleCompactMode } = useStudioVisionMode();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Main Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => globalMode !== 'standard' && toggleGlobalMode()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              globalMode === 'standard'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Vue Standard"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Standard</span>
          </button>
          <button
            onClick={() => globalMode !== 'studiovision' && toggleGlobalMode()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              globalMode === 'studiovision'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Vue StudioVision (Multi-colonnes)"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">StudioVision</span>
          </button>
        </div>

        {/* Settings Dropdown */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          title="Paramètres d'affichage"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Dropdown Menu */}
      {showSettings && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2">
            <div className="px-3 py-2 border-b border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase">Options d'affichage</h4>
            </div>

            {/* Animations Toggle */}
            <button
              onClick={toggleAnimations}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <span className="text-sm text-gray-700">Animations</span>
              {animations ? (
                <ToggleRight className="w-5 h-5 text-purple-600" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {/* Compact Mode Toggle */}
            <button
              onClick={toggleCompactMode}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <span className="text-sm text-gray-700">Mode compact</span>
              {compactMode ? (
                <ToggleRight className="w-5 h-5 text-purple-600" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-gray-400" />
              )}
            </button>

            <div className="border-t border-gray-100 mt-2 pt-2 px-3 pb-1">
              <p className="text-xs text-gray-400">
                StudioVision: Affichage multi-colonnes optimisé pour les grands écrans
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Module-specific mode toggle (for panels)
 */
export function ModuleModeToggle({ module, showLabel = true, size = 'md', className = '' }) {
  const { mode, setMode, hasOverride, useGlobal } = useModuleViewMode(module);
  const { globalMode } = useStudioVisionMode();

  const sizes = {
    sm: { button: 'px-2 py-1 text-xs', icon: 'w-3 h-3' },
    md: { button: 'px-3 py-1.5 text-sm', icon: 'w-4 h-4' },
    lg: { button: 'px-4 py-2 text-base', icon: 'w-5 h-5' }
  };

  const { button: buttonSize, icon: iconSize } = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => setMode('standard')}
          className={`flex items-center gap-1 ${buttonSize} rounded transition-all ${
            mode === 'standard'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="Vue Standard"
        >
          <List className={iconSize} />
          {showLabel && <span>Standard</span>}
        </button>
        <button
          onClick={() => setMode('studiovision')}
          className={`flex items-center gap-1 ${buttonSize} rounded transition-all ${
            mode === 'studiovision'
              ? 'bg-white text-purple-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="Vue StudioVision"
        >
          <LayoutGrid className={iconSize} />
          {showLabel && <span>StudioVision</span>}
        </button>
      </div>

      {/* Show indicator if using override vs global */}
      {hasOverride && (
        <button
          onClick={useGlobal}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
          title={`Revenir au mode global (${globalMode})`}
        >
          Utiliser global
        </button>
      )}
    </div>
  );
}

/**
 * Simple toggle button (icon only)
 */
export function ModeToggleButton({ onClick, isStudioVision, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all ${
        isStudioVision
          ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } ${className}`}
      title={isStudioVision ? 'Mode StudioVision actif' : 'Mode Standard actif'}
    >
      {isStudioVision ? (
        <LayoutGrid className="w-5 h-5" />
      ) : (
        <List className="w-5 h-5" />
      )}
    </button>
  );
}

export default GlobalModeToggle;
