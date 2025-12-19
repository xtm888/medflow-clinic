/**
 * DeviceDataBanner - Inline display of available device measurements
 *
 * Shows a dismissible banner above form sections with:
 * - Available device data with timestamps
 * - One-click "Apply" to fill form fields
 * - Visual diff when device data differs from manual entry
 *
 * Designed to integrate with the StudioVision consultation workflow.
 */

import { useState, useMemo } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Clock,
  Zap,
  Eye,
  Activity,
  Target,
  Scan,
  Grid3x3,
  Layers,
  Map,
  Glasses,
  HardDrive,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';

// Icon mapping for device types
const DEVICE_ICONS = {
  autorefractor: Eye,
  tonometer: Activity,
  keratometer: Target,
  oct: Scan,
  perimeter: Grid3x3,
  pachymeter: Layers,
  topographer: Map,
  lensmeter: Glasses,
  default: HardDrive
};

// Styles
const styles = {
  banner: `
    bg-gradient-to-r from-blue-50 to-indigo-50
    border border-blue-200 rounded-lg
    shadow-sm overflow-hidden
    transition-all duration-300
  `,
  bannerCollapsed: 'p-2',
  bannerExpanded: 'p-3',
  header: 'flex items-center justify-between gap-2',
  headerLeft: 'flex items-center gap-2',
  badge: `
    flex items-center gap-1
    bg-blue-600 text-white
    px-2 py-0.5 rounded-full
    text-xs font-medium
  `,
  badgeNew: `
    flex items-center gap-1
    bg-green-500 text-white
    px-2 py-0.5 rounded-full
    text-xs font-medium animate-pulse
  `,
  title: 'text-sm font-medium text-gray-700',
  headerRight: 'flex items-center gap-1',
  iconButton: `
    p-1 rounded hover:bg-white/50
    text-gray-500 hover:text-gray-700
    transition-colors
  `,
  content: 'mt-3 space-y-2',
  measurementCard: `
    bg-white border border-gray-200 rounded-lg
    p-3 flex items-center justify-between gap-4
    hover:border-blue-300 transition-colors
  `,
  measurementCardNew: `
    bg-white border-2 border-green-400 rounded-lg
    p-3 flex items-center justify-between gap-4
    shadow-sm
  `,
  measurementCardDiff: `
    bg-amber-50 border-2 border-amber-400 rounded-lg
    p-3 flex items-center justify-between gap-4
  `,
  measurementInfo: 'flex items-center gap-3 flex-1 min-w-0',
  deviceIcon: 'flex-shrink-0 p-2 bg-gray-100 rounded-lg',
  measurementDetails: 'flex-1 min-w-0',
  measurementType: 'text-sm font-medium text-gray-900 truncate',
  measurementDevice: 'text-xs text-gray-500 truncate',
  measurementValue: 'text-sm text-gray-700 font-mono mt-0.5 truncate',
  measurementTime: 'flex items-center gap-1 text-xs text-gray-400',
  diffIndicator: 'flex items-center gap-1 text-xs text-amber-600 font-medium',
  applyButton: `
    flex items-center gap-1
    px-3 py-1.5
    bg-blue-600 hover:bg-blue-700
    text-white text-sm font-medium
    rounded transition-colors
    flex-shrink-0
  `,
  applyAllButton: `
    flex items-center gap-1.5
    px-4 py-2
    bg-green-600 hover:bg-green-700
    text-white text-sm font-medium
    rounded-lg transition-colors
    mt-3
  `,
  emptyState: 'text-sm text-gray-500 text-center py-4',
  collapsedSummary: 'flex items-center gap-2 text-sm text-gray-600'
};

// Format relative time
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Check if measurement differs from current value
const checkDiff = (measurementData, currentData, deviceType) => {
  if (!currentData || !measurementData) return false;

  switch (deviceType) {
    case 'autorefractor':
    case 'lensmeter':
      // Compare sphere, cylinder, axis for each eye
      for (const eye of ['OD', 'OS']) {
        if (measurementData[eye] && currentData[eye]) {
          if (Math.abs((measurementData[eye].sphere || 0) - (currentData[eye].sphere || 0)) > 0.25) return true;
          if (Math.abs((measurementData[eye].cylinder || 0) - (currentData[eye].cylinder || 0)) > 0.25) return true;
          if (Math.abs((measurementData[eye].axis || 0) - (currentData[eye].axis || 0)) > 5) return true;
        }
      }
      return false;

    case 'tonometer':
      for (const eye of ['OD', 'OS']) {
        if (measurementData[eye]?.iop && currentData[eye]?.iop) {
          if (Math.abs(measurementData[eye].iop - currentData[eye].iop) > 2) return true;
        }
      }
      return false;

    default:
      return false;
  }
};

/**
 * Single measurement item component
 */
function MeasurementItem({
  measurement,
  currentData,
  onApply,
  showDiff = true
}) {
  const Icon = DEVICE_ICONS[measurement.device?.type] || DEVICE_ICONS.default;
  const hasDiff = showDiff && checkDiff(measurement.data, currentData, measurement.device?.type);

  const cardStyle = measurement.isNew
    ? styles.measurementCardNew
    : hasDiff
    ? styles.measurementCardDiff
    : styles.measurementCard;

  return (
    <div className={cardStyle}>
      <div className={styles.measurementInfo}>
        <div className={styles.deviceIcon}>
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <div className={styles.measurementDetails}>
          <div className="flex items-center gap-2">
            <span className={styles.measurementType}>
              {measurement.typeInfo?.label || measurement.device?.type}
            </span>
            {measurement.isNew && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                Nouveau
              </span>
            )}
          </div>
          <div className={styles.measurementDevice}>
            {measurement.device?.name || 'Appareil inconnu'}
          </div>
          <div className={styles.measurementValue}>
            {measurement.formattedValue || 'Données disponibles'}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className={styles.measurementTime}>
          <Clock className="h-3 w-3" />
          {formatRelativeTime(measurement.timestamp)}
        </div>
        {hasDiff && (
          <div className={styles.diffIndicator}>
            <AlertCircle className="h-3 w-3" />
            Diffère des valeurs actuelles
          </div>
        )}
        <button
          onClick={() => onApply(measurement)}
          className={styles.applyButton}
        >
          <Check className="h-4 w-4" />
          Appliquer
        </button>
      </div>
    </div>
  );
}

/**
 * DeviceDataBanner component
 */
export default function DeviceDataBanner({
  measurements = [],
  currentData = {},
  onApply,
  onApplyAll,
  onDismiss,
  onRefresh,
  loading = false,
  hasNewMeasurements = false,
  targetTab = null, // Filter by target tab if specified
  showDiff = true,
  className = ''
}) {
  const [expanded, setExpanded] = useState(hasNewMeasurements);

  // Filter measurements by target tab if specified
  const filteredMeasurements = useMemo(() => {
    if (!targetTab) return measurements;
    return measurements.filter(m => m.typeInfo?.targetTab === targetTab);
  }, [measurements, targetTab]);

  // Don't render if no measurements
  if (filteredMeasurements.length === 0) {
    return null;
  }

  // Count new measurements
  const newCount = filteredMeasurements.filter(m => m.isNew).length;

  return (
    <div className={`${styles.banner} ${expanded ? styles.bannerExpanded : styles.bannerCollapsed} ${className}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Zap className="h-4 w-4 text-blue-600" />
          <span className={styles.title}>
            Mesures disponibles
          </span>
          {newCount > 0 ? (
            <span className={styles.badgeNew}>
              {newCount} nouveau{newCount > 1 ? 'x' : ''}
            </span>
          ) : (
            <span className={styles.badge}>
              {filteredMeasurements.length}
            </span>
          )}
        </div>

        <div className={styles.headerRight}>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={styles.iconButton}
              title="Actualiser"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className={styles.iconButton}
            title={expanded ? 'Réduire' : 'Développer'}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={styles.iconButton}
              title="Masquer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsed summary */}
      {!expanded && (
        <div className={styles.collapsedSummary}>
          {filteredMeasurements.slice(0, 3).map((m, i) => {
            const Icon = DEVICE_ICONS[m.device?.type] || DEVICE_ICONS.default;
            return (
              <span key={m._id || i} className="flex items-center gap-1 text-xs text-gray-500">
                <Icon className="h-3 w-3" />
                {m.typeInfo?.label || m.device?.type}
              </span>
            );
          })}
          {filteredMeasurements.length > 3 && (
            <span className="text-xs text-gray-400">
              +{filteredMeasurements.length - 3} autres
            </span>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className={styles.content}>
          {filteredMeasurements.map((measurement, index) => (
            <MeasurementItem
              key={measurement._id || index}
              measurement={measurement}
              currentData={currentData[measurement.device?.type]}
              onApply={onApply}
              showDiff={showDiff}
            />
          ))}

          {/* Apply all button */}
          {onApplyAll && filteredMeasurements.length > 1 && (
            <button
              onClick={onApplyAll}
              className={styles.applyAllButton}
            >
              <Zap className="h-4 w-4" />
              Appliquer toutes les mesures ({filteredMeasurements.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Export sub-components for flexibility
export { MeasurementItem, checkDiff, formatRelativeTime, DEVICE_ICONS };
