/**
 * GlassesOptionsSection Component
 *
 * Lens type, material, coatings, and frame selection for glasses orders.
 */

import { Package } from 'lucide-react';
import FrameSelector from './FrameSelector';
import { LENS_TYPES, LENS_MATERIALS, COATING_OPTIONS } from '../constants';

export default function GlassesOptionsSection({
  lensType,
  onLensTypeChange,
  lensMaterial,
  onLensMaterialChange,
  coatings,
  onCoatingChange,
  selectedFrame,
  onSelectFrame,
  onClearFrame
}) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Options Lunettes</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lens Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de verres
          </label>
          <select
            value={lensType}
            onChange={(e) => onLensTypeChange(e.target.value)}
            className="input"
          >
            {LENS_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Lens Material */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Matériau des verres
          </label>
          <select
            value={lensMaterial}
            onChange={(e) => onLensMaterialChange(e.target.value)}
            className="input"
          >
            {LENS_MATERIALS.map(material => (
              <option key={material.value} value={material.value}>
                {material.label} (n={material.index})
              </option>
            ))}
          </select>
        </div>

        {/* Coatings */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Traitements
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {COATING_OPTIONS.map(coating => (
              <label
                key={coating.value}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                  coatings.includes(coating.value)
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={coatings.includes(coating.value)}
                  onChange={() => onCoatingChange(coating.value)}
                  className="mr-2"
                />
                <div>
                  <span className="text-sm">{coating.label}</span>
                  <span className="text-xs text-gray-500 block">
                    {new Intl.NumberFormat('fr-CD').format(coating.price)} CDF
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Frame Selection from Inventory */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Package className="h-4 w-4 inline mr-1" />
            Monture (sélection du stock)
          </label>
          <FrameSelector
            selectedFrame={selectedFrame}
            onSelect={onSelectFrame}
            onClear={onClearFrame}
          />
        </div>
      </div>
    </div>
  );
}
