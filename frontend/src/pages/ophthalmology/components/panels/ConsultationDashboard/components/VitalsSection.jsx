/**
 * VitalsSection Component
 *
 * Collapsible vitals input section.
 */

import { Activity, ChevronUp, ChevronDown } from 'lucide-react';

export default function VitalsSection({ data, updateSection, expanded, onToggle }) {
  const vitals = data.vitals || {};

  const updateVitals = (field, value) => {
    updateSection('vitals', { ...vitals, [field]: value });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-red-50 to-pink-50 border-b border-gray-200"
      >
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-600" />
          Signes Vitaux
          {vitals.bloodPressure && (
            <span className="text-xs font-normal text-gray-500 ml-2">
              TA: {vitals.bloodPressure}
            </span>
          )}
        </h2>
        {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {expanded && (
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500">Tension artérielle</label>
              <input
                type="text"
                value={vitals.bloodPressure || ''}
                onChange={(e) => updateVitals('bloodPressure', e.target.value)}
                placeholder="120/80"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Fréquence cardiaque</label>
              <input
                type="number"
                value={vitals.heartRate || ''}
                onChange={(e) => updateVitals('heartRate', e.target.value)}
                placeholder="72"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Température (°C)</label>
              <input
                type="number"
                step="0.1"
                value={vitals.temperature || ''}
                onChange={(e) => updateVitals('temperature', e.target.value)}
                placeholder="37.0"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">SpO2 (%)</label>
              <input
                type="number"
                value={vitals.oxygenSaturation || ''}
                onChange={(e) => updateVitals('oxygenSaturation', e.target.value)}
                placeholder="98"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
