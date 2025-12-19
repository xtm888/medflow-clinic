/**
 * StudioVisionRefractionGrid - OD/OG Side-by-Side Refraction Grid
 *
 * StudioVision Parity: Matches oph2.jpg layout exactly
 * - OD/OG columns displayed side-by-side
 * - All refraction values visible at a glance
 * - Date history selector for past refractions
 * - Compact, high-density display
 * - French notation (Sph, Cyl, Axe, Add)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Eye,
  Calendar,
  Copy,
  RefreshCw,
  Download,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Settings,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Refraction step constants
const STEPS = {
  sphere: 0.25,
  cylinder: 0.25,
  axis: 5,
  add: 0.25,
  fineSphere: 0.12,
  fineCylinder: 0.12,
  fineAxis: 1
};

// Format value with sign
const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return '-';
  const formatted = num.toFixed(decimals);
  return num >= 0 ? `+${formatted}` : formatted;
};

// Calculate spherical equivalent
const calcSphericalEquiv = (sph, cyl) => {
  if (sph === null || sph === undefined) return null;
  const sphere = parseFloat(sph) || 0;
  const cylinder = parseFloat(cyl) || 0;
  return sphere + (cylinder / 2);
};

// Transpose cylinder (plus to minus or vice versa)
const transposeCylinder = (sph, cyl, axis) => {
  if (!cyl) return { sphere: sph, cylinder: cyl, axis };
  const sphere = parseFloat(sph) || 0;
  const cylinder = parseFloat(cyl) || 0;
  const newSphere = sphere + cylinder;
  const newCylinder = -cylinder;
  let newAxis = (parseFloat(axis) || 90) + 90;
  if (newAxis > 180) newAxis -= 180;
  return {
    sphere: Math.round(newSphere * 100) / 100,
    cylinder: Math.round(newCylinder * 100) / 100,
    axis: newAxis
  };
};

/**
 * Numeric input with increment/decrement buttons
 */
function RefractionInput({
  value,
  onChange,
  step = 0.25,
  min = -30,
  max = 30,
  label,
  unit = '',
  colorClass = 'text-gray-800',
  disabled = false
}) {
  const handleIncrement = () => {
    const current = parseFloat(value) || 0;
    const newVal = Math.min(current + step, max);
    onChange?.(Math.round(newVal * 100) / 100);
  };

  const handleDecrement = () => {
    const current = parseFloat(value) || 0;
    const newVal = Math.max(current - step, min);
    onChange?.(Math.round(newVal * 100) / 100);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    if (val === '' || val === '-') {
      onChange?.(val);
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        onChange?.(num);
      }
    }
  };

  return (
    <div className="flex flex-col">
      {label && <span className="text-xs text-gray-500 mb-0.5">{label}</span>}
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled}
          className="w-5 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-l border border-r-0 border-gray-300 disabled:opacity-50"
        >
          <Minus className="w-3 h-3 text-gray-600" />
        </button>
        <input
          type="text"
          value={value ?? ''}
          onChange={handleChange}
          disabled={disabled}
          className={`w-14 h-6 text-center text-sm font-mono font-medium border-y border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 ${colorClass} disabled:bg-gray-50`}
        />
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled}
          className="w-5 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-r border border-l-0 border-gray-300 disabled:opacity-50"
        >
          <Plus className="w-3 h-3 text-gray-600" />
        </button>
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

/**
 * Single eye column
 */
function EyeColumn({
  eye = 'OD',
  data = {},
  onChange,
  fineSteps = false,
  disabled = false
}) {
  const isOD = eye === 'OD';
  const bgColor = isOD ? 'bg-blue-50' : 'bg-green-50';
  const headerBg = isOD ? 'bg-blue-100' : 'bg-green-100';
  const headerText = isOD ? 'text-blue-800' : 'text-green-800';
  const borderColor = isOD ? 'border-blue-200' : 'border-green-200';

  const sphereStep = fineSteps ? STEPS.fineSphere : STEPS.sphere;
  const cylinderStep = fineSteps ? STEPS.fineCylinder : STEPS.cylinder;
  const axisStep = fineSteps ? STEPS.fineAxis : STEPS.axis;

  const handleChange = (field, value) => {
    onChange?.({ ...data, [field]: value });
  };

  const sphericalEquiv = calcSphericalEquiv(data.sphere, data.cylinder);

  return (
    <div className={`border rounded-lg overflow-hidden ${borderColor}`}>
      {/* Eye Header */}
      <div className={`${headerBg} px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Eye className={`w-4 h-4 ${headerText}`} />
          <span className={`font-bold ${headerText}`}>
            {isOD ? 'OD - Œil Droit' : 'OG - Œil Gauche'}
          </span>
        </div>
        {sphericalEquiv !== null && (
          <span className={`text-xs px-2 py-0.5 rounded ${isOD ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'}`}>
            ES: {formatValue(sphericalEquiv)}
          </span>
        )}
      </div>

      {/* Input Grid */}
      <div className={`${bgColor} p-3`}>
        <div className="grid grid-cols-2 gap-3">
          {/* Sphère */}
          <RefractionInput
            label="Sphère (D)"
            value={data.sphere}
            onChange={(v) => handleChange('sphere', v)}
            step={sphereStep}
            min={-30}
            max={30}
            colorClass={data.sphere > 0 ? 'text-green-600' : data.sphere < 0 ? 'text-red-600' : 'text-gray-800'}
            disabled={disabled}
          />

          {/* Cylindre */}
          <RefractionInput
            label="Cylindre (D)"
            value={data.cylinder}
            onChange={(v) => handleChange('cylinder', v)}
            step={cylinderStep}
            min={-10}
            max={10}
            colorClass={data.cylinder ? 'text-orange-600' : 'text-gray-800'}
            disabled={disabled}
          />

          {/* Axe */}
          <RefractionInput
            label="Axe (°)"
            value={data.axis}
            onChange={(v) => handleChange('axis', v)}
            step={axisStep}
            min={0}
            max={180}
            unit="°"
            disabled={disabled || !data.cylinder}
          />

          {/* Addition */}
          <RefractionInput
            label="Addition (D)"
            value={data.add}
            onChange={(v) => handleChange('add', v)}
            step={STEPS.add}
            min={0}
            max={4}
            colorClass={data.add > 0 ? 'text-blue-600' : 'text-gray-800'}
            disabled={disabled}
          />
        </div>

        {/* Visual Acuity */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-gray-500">AV sc (sans corr.)</span>
              <input
                type="text"
                value={data.avUncorrected || ''}
                onChange={(e) => handleChange('avUncorrected', e.target.value)}
                placeholder="10/10"
                disabled={disabled}
                className="w-full mt-0.5 h-6 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <span className="text-xs text-gray-500">AV ac (avec corr.)</span>
              <input
                type="text"
                value={data.avCorrected || ''}
                onChange={(e) => handleChange('avCorrected', e.target.value)}
                placeholder="10/10"
                disabled={disabled}
                className="w-full mt-0.5 h-6 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className={`mt-3 p-2 rounded text-center ${isOD ? 'bg-blue-100' : 'bg-green-100'}`}>
          <span className="font-mono font-bold text-sm">
            {data.sphere !== null && data.sphere !== undefined && data.sphere !== ''
              ? formatValue(data.sphere)
              : 'pl'}
            {data.cylinder ? ` ${formatValue(data.cylinder)}` : ''}
            {data.cylinder && data.axis !== null && data.axis !== undefined ? ` x${data.axis}°` : ''}
            {data.add > 0 ? ` Add ${formatValue(data.add)}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * History entry row
 */
function HistoryRow({ entry, onSelect, selected = false }) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition ${
        selected ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
      }`}
      onClick={() => onSelect?.(entry)}
    >
      <Calendar className="w-3 h-3 text-gray-400" />
      <span className="text-xs font-medium text-gray-700">
        {format(new Date(entry.date), 'dd/MM/yyyy', { locale: fr })}
      </span>
      <div className="flex-1 flex gap-2 text-xs font-mono">
        <span className="text-blue-600">
          OD: {formatValue(entry.OD?.sphere)} {entry.OD?.cylinder ? formatValue(entry.OD.cylinder) : ''}
        </span>
        <span className="text-green-600">
          OG: {formatValue(entry.OS?.sphere)} {entry.OS?.cylinder ? formatValue(entry.OS.cylinder) : ''}
        </span>
      </div>
      {selected && <Check className="w-3 h-3 text-blue-600" />}
    </div>
  );
}

/**
 * Main StudioVisionRefractionGrid Component
 */
export default function StudioVisionRefractionGrid({
  data = {},
  onChange,
  history = [],
  onHistorySelect,
  autoRefractorData = null,
  onImportAutoRefractor,
  readOnly = false,
  showHistory = true,
  showToolbar = true,
  variant = 'refraction' // Use StudioVision color variant
}) {
  const [fineSteps, setFineSteps] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Handle OD changes
  const handleODChange = useCallback((odData) => {
    onChange?.({ ...data, OD: odData });
  }, [data, onChange]);

  // Handle OS changes
  const handleOSChange = useCallback((osData) => {
    onChange?.({ ...data, OS: osData });
  }, [data, onChange]);

  // Copy OD to OS (mirror axis)
  const handleCopyODtoOS = useCallback(() => {
    const od = data.OD || {};
    const mirroredAxis = od.axis ? (od.axis <= 90 ? od.axis + 90 : od.axis - 90) : od.axis;
    onChange?.({
      ...data,
      OS: {
        ...od,
        axis: mirroredAxis
      }
    });
  }, [data, onChange]);

  // Transpose OD
  const handleTransposeOD = useCallback(() => {
    const od = data.OD || {};
    const transposed = transposeCylinder(od.sphere, od.cylinder, od.axis);
    onChange?.({
      ...data,
      OD: {
        ...od,
        sphere: transposed.sphere,
        cylinder: transposed.cylinder,
        axis: transposed.axis
      }
    });
  }, [data, onChange]);

  // Transpose OS
  const handleTransposeOS = useCallback(() => {
    const os = data.OS || {};
    const transposed = transposeCylinder(os.sphere, os.cylinder, os.axis);
    onChange?.({
      ...data,
      OS: {
        ...os,
        sphere: transposed.sphere,
        cylinder: transposed.cylinder,
        axis: transposed.axis
      }
    });
  }, [data, onChange]);

  // Import auto-refractor data
  const handleImportAR = useCallback(() => {
    if (!autoRefractorData) return;
    onChange?.({
      OD: {
        sphere: autoRefractorData.OD?.sphere,
        cylinder: autoRefractorData.OD?.cylinder,
        axis: autoRefractorData.OD?.axis
      },
      OS: {
        sphere: autoRefractorData.OS?.sphere,
        cylinder: autoRefractorData.OS?.cylinder,
        axis: autoRefractorData.OS?.axis
      }
    });
    onImportAutoRefractor?.();
  }, [autoRefractorData, onChange, onImportAutoRefractor]);

  // Variant colors (StudioVision pink for refraction)
  const variantColors = {
    refraction: {
      header: 'bg-pink-100 border-pink-200',
      headerText: 'text-pink-800',
      border: 'border-pink-300'
    },
    default: {
      header: 'bg-gray-100 border-gray-200',
      headerText: 'text-gray-800',
      border: 'border-gray-300'
    }
  };

  const colors = variantColors[variant] || variantColors.default;

  return (
    <div className={`border rounded-lg overflow-hidden bg-white ${colors.border}`}>
      {/* Header with Toolbar */}
      <div className={`px-4 py-2 ${colors.header} border-b flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Eye className={`w-5 h-5 ${colors.headerText}`} />
          <span className={`font-bold ${colors.headerText}`}>RÉFRACTION</span>
          <span className="text-xs text-gray-500">Refraction</span>
        </div>

        {showToolbar && !readOnly && (
          <div className="flex items-center gap-2">
            {/* Fine steps toggle */}
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={fineSteps}
                onChange={(e) => setFineSteps(e.target.checked)}
                className="w-3 h-3 rounded"
              />
              <span className="text-gray-600">Précis</span>
            </label>

            {/* Transpose buttons */}
            <button
              onClick={handleTransposeOD}
              disabled={!data.OD?.cylinder}
              className="p-1 hover:bg-white/50 rounded disabled:opacity-30"
              title="Transposer OD (±)"
            >
              <RefreshCw className="w-4 h-4 text-blue-600" />
            </button>

            {/* Copy OD to OS */}
            <button
              onClick={handleCopyODtoOS}
              className="p-1 hover:bg-white/50 rounded"
              title="Copier OD → OG"
            >
              <Copy className="w-4 h-4 text-gray-600" />
            </button>

            {/* Import auto-refractor */}
            {autoRefractorData && (
              <button
                onClick={handleImportAR}
                className="flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs text-blue-700"
                title="Importer auto-réfractomètre"
              >
                <Download className="w-3 h-3" />
                AR
              </button>
            )}

            {/* History toggle */}
            {showHistory && history.length > 0 && (
              <button
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  showHistoryPanel ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Calendar className="w-3 h-3" />
                Historique
                {showHistoryPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Auto-Refractor Data Alert */}
      {autoRefractorData && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-blue-700">
              Données auto-réfractomètre:
              <span className="font-mono ml-2">
                OD: {formatValue(autoRefractorData.OD?.sphere)} {autoRefractorData.OD?.cylinder ? formatValue(autoRefractorData.OD.cylinder) : ''} |
                OG: {formatValue(autoRefractorData.OS?.sphere)} {autoRefractorData.OS?.cylinder ? formatValue(autoRefractorData.OS.cylinder) : ''}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* History Panel (collapsed by default) */}
      {showHistoryPanel && history.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b max-h-32 overflow-y-auto">
          <div className="text-xs font-medium text-gray-500 mb-1">Historique des réfractions:</div>
          {history.map((entry, idx) => (
            <HistoryRow
              key={idx}
              entry={entry}
              onSelect={onHistorySelect}
              selected={false}
            />
          ))}
        </div>
      )}

      {/* Main OD/OG Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <EyeColumn
            eye="OD"
            data={data.OD || {}}
            onChange={handleODChange}
            fineSteps={fineSteps}
            disabled={readOnly}
          />
          <EyeColumn
            eye="OS"
            data={data.OS || {}}
            onChange={handleOSChange}
            fineSteps={fineSteps}
            disabled={readOnly}
          />
        </div>

        {/* Pupillary Distance */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Écart Pupillaire:</span>
              <input
                type="number"
                value={data.pdBinocular || ''}
                onChange={(e) => onChange?.({ ...data, pdBinocular: parseFloat(e.target.value) || null })}
                placeholder="63"
                disabled={readOnly}
                className="w-16 h-6 px-2 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">mm</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>(</span>
              <input
                type="number"
                value={data.pdOD || ''}
                onChange={(e) => onChange?.({ ...data, pdOD: parseFloat(e.target.value) || null })}
                placeholder="31"
                disabled={readOnly}
                className="w-12 h-5 px-1 text-center border border-gray-200 rounded text-xs"
              />
              <span>/</span>
              <input
                type="number"
                value={data.pdOS || ''}
                onChange={(e) => onChange?.({ ...data, pdOS: parseFloat(e.target.value) || null })}
                placeholder="32"
                disabled={readOnly}
                className="w-12 h-5 px-1 text-center border border-gray-200 rounded text-xs"
              />
              <span>)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export compact summary component
export function RefractionSummaryCompact({ data }) {
  if (!data) return null;

  const od = data.OD || {};
  const os = data.OS || {};

  return (
    <div className="flex gap-4 text-sm font-mono">
      <div className="flex items-center gap-1">
        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">OD</span>
        <span>
          {od.sphere !== null && od.sphere !== undefined ? formatValue(od.sphere) : 'pl'}
          {od.cylinder ? ` ${formatValue(od.cylinder)} x${od.axis}°` : ''}
          {od.add > 0 ? ` Add ${formatValue(od.add)}` : ''}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">OG</span>
        <span>
          {os.sphere !== null && os.sphere !== undefined ? formatValue(os.sphere) : 'pl'}
          {os.cylinder ? ` ${formatValue(os.cylinder)} x${os.axis}°` : ''}
          {os.add > 0 ? ` Add ${formatValue(os.add)}` : ''}
        </span>
      </div>
    </div>
  );
}

// Export utilities
export { formatValue, calcSphericalEquiv, transposeCylinder, STEPS };
