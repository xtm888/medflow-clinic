/**
 * KRangeIndicator - Visual K value range indicator for keratometry
 *
 * Shows a horizontal bar with color-coded zones:
 * - Green: Normal range (7.40-8.10 mm / 41.67-45.61 D)
 * - Yellow: Outside normal but acceptable
 * - Red: Extreme values (keratoconus suspect, post-refractive)
 *
 * Used for:
 * - Contact lens fitting guidance
 * - Keratoconus screening
 * - Post-refractive surgery evaluation
 */

import { useMemo } from 'react';
import { AlertTriangle, Check, Circle } from 'lucide-react';

// K value ranges in diopters (D)
// Normal corneal curvature: 42-46 D (average 44 D)
const K_RANGES = {
  extremeLow: { min: 0, max: 39, color: 'red', label: 'Très plat' },
  low: { min: 39, max: 42, color: 'yellow', label: 'Plat' },
  normal: { min: 42, max: 46, color: 'green', label: 'Normal' },
  high: { min: 46, max: 49, color: 'yellow', label: 'Cambré' },
  extremeHigh: { min: 49, max: 60, color: 'red', label: 'Très cambré' }
};

// K value ranges in mm (for contact lens fitting)
const K_RANGES_MM = {
  extremeHigh: { min: 8.65, max: 10, color: 'red', label: 'Très plat' },
  high: { min: 8.10, max: 8.65, color: 'yellow', label: 'Plat' },
  normal: { min: 7.40, max: 8.10, color: 'green', label: 'Normal' },
  low: { min: 6.90, max: 7.40, color: 'yellow', label: 'Cambré' },
  extremeLow: { min: 5.5, max: 6.90, color: 'red', label: 'Très cambré' }
};

// Convert diopters to mm
const diopterToMm = (d) => {
  if (!d || d === 0) return null;
  return 337.5 / d;
};

// Get zone for K value
const getKZone = (k, displayMode = 'diopters') => {
  if (k === null || k === undefined) return null;

  const ranges = displayMode === 'mm' ? K_RANGES_MM : K_RANGES;

  for (const [zone, range] of Object.entries(ranges)) {
    if (k >= range.min && k < range.max) {
      return { zone, ...range };
    }
  }

  // Fallback for extreme values
  return displayMode === 'mm'
    ? { zone: 'extremeHigh', ...K_RANGES_MM.extremeHigh }
    : { zone: 'extremeHigh', ...K_RANGES.extremeHigh };
};

// Calculate position percentage on the bar
const getPositionPercent = (k, displayMode = 'diopters') => {
  if (k === null || k === undefined) return 50;

  if (displayMode === 'mm') {
    // MM scale: 6.5 to 9.0 mm
    const min = 6.5, max = 9.0;
    return Math.max(0, Math.min(100, ((k - min) / (max - min)) * 100));
  } else {
    // Diopter scale: 38 to 52 D
    const min = 38, max = 52;
    return Math.max(0, Math.min(100, ((k - min) / (max - min)) * 100));
  }
};

/**
 * Compact K Range Indicator - horizontal bar with marker
 */
export function KRangeBar({
  value,
  displayMode = 'diopters',
  size = 'md',
  showValue = true,
  eye = null
}) {
  const zone = useMemo(() => getKZone(value, displayMode), [value, displayMode]);
  const position = useMemo(() => getPositionPercent(value, displayMode), [value, displayMode]);

  const heights = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const colorClasses = {
    red: 'text-red-600',
    yellow: 'text-amber-600',
    green: 'text-green-600',
    gray: 'text-gray-400'
  };

  const bgColorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-amber-500',
    green: 'bg-green-500',
    gray: 'bg-gray-300'
  };

  // Bar segments based on displayMode
  const segments = displayMode === 'mm' ? [
    { width: '15%', color: 'red' },     // Very steep (< 6.90)
    { width: '12%', color: 'yellow' },  // Steep (6.90 - 7.40)
    { width: '46%', color: 'green' },   // Normal (7.40 - 8.10)
    { width: '15%', color: 'yellow' },  // Flat (8.10 - 8.65)
    { width: '12%', color: 'red' },     // Very flat (> 8.65)
  ] : [
    { width: '10%', color: 'red' },     // Very flat (< 39 D)
    { width: '17%', color: 'yellow' },  // Flat (39 - 42 D)
    { width: '46%', color: 'green' },   // Normal (42 - 46 D)
    { width: '17%', color: 'yellow' },  // Steep (46 - 49 D)
    { width: '10%', color: 'red' },     // Very steep (> 49 D)
  ];

  const unit = displayMode === 'mm' ? 'mm' : 'D';
  const displayValue = value?.toFixed(2) || '—';

  return (
    <div className="w-full">
      {/* Label row */}
      {(eye || showValue) && (
        <div className="flex justify-between items-center mb-1 text-xs">
          {eye && (
            <span className={`font-medium ${eye === 'OD' ? 'text-blue-600' : 'text-green-600'}`}>
              {eye}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            {zone && (
              <>
                {zone.color === 'green' ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : zone.color === 'red' ? (
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                ) : (
                  <Circle className="w-3 h-3 text-amber-500" />
                )}
                <span className={colorClasses[zone.color] || 'text-gray-500'}>
                  {displayValue} {unit}
                </span>
              </>
            )}
            {!zone && showValue && (
              <span className="text-gray-400">{displayValue} {unit}</span>
            )}
          </div>
        </div>
      )}

      {/* Range bar */}
      <div className={`relative ${heights[size]} rounded-full overflow-hidden flex`}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`${bgColorClasses[seg.color]} opacity-40`}
            style={{ width: seg.width }}
          />
        ))}

        {/* Value marker */}
        {value !== null && value !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-gray-900 rounded"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rounded-full" />
          </div>
        )}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>{displayMode === 'mm' ? '6.5' : '38'}</span>
        <span className="text-green-600 font-medium">
          {displayMode === 'mm' ? '7.4-8.1' : '42-46'}
        </span>
        <span>{displayMode === 'mm' ? '9.0' : '52'}</span>
      </div>
    </div>
  );
}

/**
 * Contact Lens Fitting Guide
 */
export function ContactLensFittingGuide({
  kAverage,
  displayMode = 'mm'
}) {
  // Base curve recommendations based on average K
  const recommendation = useMemo(() => {
    if (!kAverage) return null;

    const kMm = displayMode === 'mm' ? kAverage : diopterToMm(kAverage);

    if (kMm >= 7.80 && kMm <= 7.90) {
      return { curve: '8.6', fit: 'Standard', color: 'green' };
    } else if (kMm >= 7.90 && kMm <= 8.10) {
      return { curve: '8.7', fit: 'Légèrement plat', color: 'green' };
    } else if (kMm >= 7.60 && kMm < 7.80) {
      return { curve: '8.4', fit: 'Cambré', color: 'yellow' };
    } else if (kMm < 7.60) {
      return { curve: '8.3', fit: 'Très cambré', color: 'red' };
    } else if (kMm > 8.10) {
      return { curve: '8.8+', fit: 'Plat', color: 'yellow' };
    }
    return null;
  }, [kAverage, displayMode]);

  if (!recommendation) return null;

  const colorStyles = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800'
  };

  return (
    <div className={`px-3 py-2 rounded border text-sm ${colorStyles[recommendation.color]}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Rayon de base suggéré:</span>
        <span className="font-bold">{recommendation.curve} mm</span>
      </div>
      <div className="text-xs mt-1 opacity-75">
        Cornée {recommendation.fit}
      </div>
    </div>
  );
}

/**
 * Full K Range Indicator Panel
 */
export default function KRangeIndicator({
  odK1,
  odK2,
  osK1,
  osK2,
  displayMode = 'diopters',
  showFittingGuide = false,
  compact = false
}) {
  const odAvg = odK1 && odK2 ? (odK1 + odK2) / 2 : null;
  const osAvg = osK1 && osK2 ? (osK1 + osK2) / 2 : null;

  if (compact) {
    return (
      <div className="flex gap-4">
        <div className="flex-1">
          <KRangeBar value={odAvg} displayMode={displayMode} size="sm" eye="OD" />
        </div>
        <div className="flex-1">
          <KRangeBar value={osAvg} displayMode={displayMode} size="sm" eye="OS" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <div className="text-sm font-medium text-gray-700 mb-2">
        Plage de kératométrie
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <KRangeBar value={odAvg} displayMode={displayMode} size="md" eye="OD" />
        </div>
        <div>
          <KRangeBar value={osAvg} displayMode={displayMode} size="md" eye="OS" />
        </div>
      </div>

      {showFittingGuide && odAvg && osAvg && (
        <div className="grid grid-cols-2 gap-4 mt-3">
          <ContactLensFittingGuide kAverage={odAvg} displayMode={displayMode} />
          <ContactLensFittingGuide kAverage={osAvg} displayMode={displayMode} />
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          Normal
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          Limite
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Extrême
        </div>
      </div>
    </div>
  );
}

// Export utilities
export { getKZone, getPositionPercent, K_RANGES, K_RANGES_MM };
