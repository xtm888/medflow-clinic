/**
 * RefractionQuickActions - StudioVision Quick Actions Sidebar
 *
 * StudioVision Parity: Matches oph2.jpg left sidebar layout
 * - Date history list with selection
 * - Quick action buttons for common operations
 * - Memory/device send buttons
 * - Print and export options
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  Plus,
  FileText,
  Printer,
  Eye,
  RefreshCw,
  Send,
  Download,
  ExternalLink,
  Settings,
  History,
  ChevronDown,
  ChevronUp,
  Check,
  FileOutput,
  User,
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Quick action button styles
const BUTTON_STYLES = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300',
  success: 'bg-green-600 text-white hover:bg-green-700 border-green-700',
  warning: 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600',
  info: 'bg-cyan-500 text-white hover:bg-cyan-600 border-cyan-600',
  outline: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
};

/**
 * History Date Item
 */
function HistoryDateItem({ entry, selected, onSelect }) {
  const dateStr = format(new Date(entry.date), 'dd/MM/yyyy', { locale: fr });
  const dayStr = format(new Date(entry.date), 'EEE', { locale: fr });

  // Determine if has data flags
  const hasRefraction = entry.hasRefraction || entry.OD || entry.OS;
  const hasCL = entry.hasContactLens;
  const hasPathology = entry.hasPathology;

  return (
    <div
      className={`px-2 py-1.5 rounded cursor-pointer transition flex items-center gap-1 ${
        selected
          ? 'bg-blue-100 border border-blue-300'
          : 'hover:bg-gray-100 border border-transparent'
      }`}
      onClick={() => onSelect?.(entry)}
    >
      <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-700">{dateStr}</span>
          <span className="text-xs text-gray-400">{dayStr}</span>
        </div>
      </div>
      {/* Data indicator badges */}
      <div className="flex items-center gap-0.5">
        {hasRefraction && (
          <span className="w-4 h-4 rounded bg-pink-100 text-pink-600 text-[10px] flex items-center justify-center font-bold">
            R
          </span>
        )}
        {hasCL && (
          <span className="w-4 h-4 rounded bg-purple-100 text-purple-600 text-[10px] flex items-center justify-center font-bold">
            L
          </span>
        )}
        {hasPathology && (
          <span className="w-4 h-4 rounded bg-yellow-100 text-yellow-600 text-[10px] flex items-center justify-center font-bold">
            P
          </span>
        )}
      </div>
      {selected && <Check className="w-3 h-3 text-blue-600 flex-shrink-0" />}
    </div>
  );
}

/**
 * Quick Action Button
 */
function QuickActionButton({
  icon: Icon,
  label,
  sublabel,
  onClick,
  variant = 'outline',
  disabled = false,
  badge = null,
  fullWidth = true
}) {
  const styles = BUTTON_STYLES[variant] || BUTTON_STYLES.outline;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-2 rounded border text-left transition
        ${fullWidth ? 'w-full' : ''}
        ${styles}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{label}</div>
        {sublabel && <div className="text-[10px] opacity-70 truncate">{sublabel}</div>}
      </div>
      {badge !== null && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Memory Send Button (StudioVision "Envoyer au" feature)
 */
function MemorySendButton({ label, device, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1 px-2 py-1 rounded text-xs border
        ${disabled
          ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
        }
      `}
    >
      <Send className="w-3 h-3" />
      <span>→ {label}</span>
    </button>
  );
}

/**
 * Section Header
 */
function SectionHeader({ title, icon: Icon, collapsed, onToggle, count }) {
  return (
    <div
      className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        <span className="text-xs font-semibold text-gray-700 uppercase">{title}</span>
        {count !== undefined && (
          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px] font-medium">
            {count}
          </span>
        )}
      </div>
      {onToggle && (
        collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />
      )}
    </div>
  );
}

/**
 * Main RefractionQuickActions Component
 */
export default function RefractionQuickActions({
  // History
  history = [],
  selectedHistoryEntry = null,
  onSelectHistory,

  // Current refraction data
  currentRefraction = null,

  // Actions
  onNewRefraction,
  onNewEmptyRefraction,
  onPrintGlasses,
  onViewPrescription,
  onExternalExport,
  onRenewal,
  onImportPrevious,
  onPersonalize,

  // Device memory send
  memoryDevices = [],
  onSendToDevice,

  // Patient context
  patientName = '',
  patientId = null,

  // State
  readOnly = false,
  showHistory = true,
  compact = false
}) {
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [actionsCollapsed, setActionsCollapsed] = useState(false);
  const [deviceCollapsed, setDeviceCollapsed] = useState(true);

  // Default memory devices if none provided
  const devices = useMemo(() => {
    if (memoryDevices.length > 0) return memoryDevices;
    return [
      { id: 'lm', label: 'mem.LM', name: 'Lunettier Mémoire' },
      { id: 'rm', label: 'mem.RM', name: 'Réfractomètre Mémoire' },
      { id: 'ar', label: 'Auto-Réf', name: 'Auto-Réfractomètre' }
    ];
  }, [memoryDevices]);

  // Formatted history for display
  const formattedHistory = useMemo(() => {
    return history.slice(0, 10).map(entry => ({
      ...entry,
      date: entry.date || entry.examDate || new Date(),
      hasRefraction: !!(entry.OD || entry.OS || entry.refraction),
      hasContactLens: !!(entry.contactLens || entry.cl),
      hasPathology: !!(entry.pathology || entry.diagnoses)
    }));
  }, [history]);

  // Has refraction to export
  const hasRefractionData = !!(currentRefraction?.OD || currentRefraction?.OS);

  // Has previous prescriptions for renewal
  const hasPreviousPrescriptions = history.length > 0;

  return (
    <div className={`bg-gray-50 rounded-lg border border-gray-200 overflow-hidden ${compact ? 'text-xs' : ''}`}>
      {/* Header */}
      <div className="px-3 py-2 bg-pink-100 border-b border-pink-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-pink-600" />
          <span className="font-bold text-pink-800 text-sm">ACTIONS RAPIDES</span>
        </div>
        {patientName && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <User className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{patientName}</span>
          </div>
        )}
      </div>

      <div className="p-2 space-y-3">
        {/* History Section */}
        {showHistory && (
          <div>
            <SectionHeader
              title="Historique"
              icon={History}
              collapsed={historyCollapsed}
              onToggle={() => setHistoryCollapsed(!historyCollapsed)}
              count={formattedHistory.length}
            />
            {!historyCollapsed && (
              <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
                {formattedHistory.length > 0 ? (
                  formattedHistory.map((entry, idx) => (
                    <HistoryDateItem
                      key={entry.id || idx}
                      entry={entry}
                      selected={selectedHistoryEntry?.id === entry.id || selectedHistoryEntry === entry}
                      onSelect={onSelectHistory}
                    />
                  ))
                ) : (
                  <div className="px-2 py-3 text-xs text-gray-400 text-center italic">
                    Aucun historique disponible
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions Section */}
        <div>
          <SectionHeader
            title="Réfraction"
            icon={Eye}
            collapsed={actionsCollapsed}
            onToggle={() => setActionsCollapsed(!actionsCollapsed)}
          />
          {!actionsCollapsed && (
            <div className="mt-2 space-y-1.5">
              {/* New Refraction (Pre-filled) */}
              <QuickActionButton
                icon={Plus}
                label="Nouvelle réfraction"
                sublabel="Pré-remplie depuis dernière"
                onClick={onNewRefraction}
                variant="primary"
                disabled={readOnly || !hasPreviousPrescriptions}
              />

              {/* New Empty Refraction */}
              <QuickActionButton
                icon={FileText}
                label="Réfraction vide"
                sublabel="Commencer à zéro"
                onClick={onNewEmptyRefraction}
                variant="outline"
                disabled={readOnly}
              />

              {/* Import from Previous */}
              {hasPreviousPrescriptions && (
                <QuickActionButton
                  icon={Download}
                  label="Importer précédente"
                  sublabel="Copier valeurs existantes"
                  onClick={onImportPrevious}
                  variant="outline"
                  disabled={readOnly}
                />
              )}

              {/* Divider */}
              <div className="border-t border-gray-200 my-2" />

              {/* Print Glasses */}
              <QuickActionButton
                icon={Printer}
                label="Imprimer lunettes"
                sublabel="Ordonnance optique"
                onClick={onPrintGlasses}
                variant="success"
                disabled={!hasRefractionData}
              />

              {/* View Prescription */}
              <QuickActionButton
                icon={FileOutput}
                label="Voir ordonnance"
                sublabel="Aperçu prescription"
                onClick={onViewPrescription}
                variant="outline"
                disabled={!hasRefractionData}
              />

              {/* Divider */}
              <div className="border-t border-gray-200 my-2" />

              {/* External Export */}
              <QuickActionButton
                icon={ExternalLink}
                label="Externe..."
                sublabel="Exporter vers système"
                onClick={onExternalExport}
                variant="outline"
                disabled={!hasRefractionData}
              />

              {/* Renewal */}
              <QuickActionButton
                icon={RefreshCw}
                label="Renouvellement"
                sublabel="Renouveler prescription"
                onClick={onRenewal}
                variant="warning"
                badge={history.length || null}
                disabled={readOnly || !hasPreviousPrescriptions}
              />

              {/* Personalize */}
              <QuickActionButton
                icon={Settings}
                label="Personnaliser..."
                sublabel="Options avancées"
                onClick={onPersonalize}
                variant="outline"
              />
            </div>
          )}
        </div>

        {/* Device Memory Send Section */}
        {devices.length > 0 && (
          <div>
            <SectionHeader
              title="Envoyer au"
              icon={Send}
              collapsed={deviceCollapsed}
              onToggle={() => setDeviceCollapsed(!deviceCollapsed)}
            />
            {!deviceCollapsed && (
              <div className="mt-2 space-y-1">
                <div className="text-[10px] text-gray-500 px-1 mb-1">
                  Transférer vers un appareil:
                </div>
                <div className="flex flex-wrap gap-1">
                  {devices.map(device => (
                    <MemorySendButton
                      key={device.id}
                      label={device.label}
                      device={device}
                      onClick={() => onSendToDevice?.(device)}
                      disabled={!hasRefractionData}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with Current Refraction Summary */}
      {hasRefractionData && (
        <div className="px-3 py-2 bg-pink-50 border-t border-pink-200">
          <div className="text-[10px] text-gray-500 uppercase mb-1">Réfraction actuelle</div>
          <div className="flex gap-2 text-xs font-mono">
            {currentRefraction.OD && (
              <div className="flex items-center gap-1">
                <span className="px-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">OD</span>
                <span>
                  {formatRefractionValue(currentRefraction.OD.sphere)}
                  {currentRefraction.OD.cylinder ? ` ${formatRefractionValue(currentRefraction.OD.cylinder)} x${currentRefraction.OD.axis}°` : ''}
                </span>
              </div>
            )}
            {currentRefraction.OS && (
              <div className="flex items-center gap-1">
                <span className="px-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">OG</span>
                <span>
                  {formatRefractionValue(currentRefraction.OS.sphere)}
                  {currentRefraction.OS.cylinder ? ` ${formatRefractionValue(currentRefraction.OS.cylinder)} x${currentRefraction.OS.axis}°` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to format refraction values with sign
function formatRefractionValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return '-';
  const formatted = num.toFixed(2);
  return num >= 0 ? `+${formatted}` : formatted;
}

/**
 * Compact version for integration into other panels
 */
export function RefractionQuickActionsCompact({
  onNewRefraction,
  onPrintGlasses,
  onRenewal,
  hasData = false,
  hasPrevious = false,
  disabled = false
}) {
  return (
    <div className="flex gap-1">
      <button
        onClick={onNewRefraction}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        title="Nouvelle réfraction"
      >
        <Plus className="w-3 h-3" />
        Nouvelle
      </button>

      <button
        onClick={onPrintGlasses}
        disabled={disabled || !hasData}
        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
        title="Imprimer ordonnance"
      >
        <Printer className="w-3 h-3" />
        Imprimer
      </button>

      {hasPrevious && (
        <button
          onClick={onRenewal}
          disabled={disabled}
          className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 disabled:opacity-50"
          title="Renouvellement"
        >
          <RefreshCw className="w-3 h-3" />
          Renouv.
        </button>
      )}
    </div>
  );
}

// Export button styles for external use
export { BUTTON_STYLES };
