/**
 * LensesStep Component
 *
 * Step 3: Lens type and material selection.
 */

import { LENS_DESIGNS, LENS_MATERIALS, formatCurrency } from '../../constants';

export default function LensesStep({
  orderData,
  setOrderData,
  onCalculatePricing
}) {
  const updateLensType = (field, value) => {
    const newLensType = { ...orderData.lensType, [field]: value };
    setOrderData(prev => ({
      ...prev,
      lensType: newLensType
    }));
    onCalculatePricing({ ...orderData, lensType: newLensType });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Type de Verres</h2>

      {/* Lens Design */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Design</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {LENS_DESIGNS.map((design) => (
            <div
              key={design.value}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                orderData.lensType.design === design.value
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => updateLensType('design', design.value)}
            >
              <p className="font-medium text-gray-900">{design.label}</p>
              <p className="text-sm text-gray-500">{design.description}</p>
              {design.priceAdd > 0 && (
                <p className="text-sm text-purple-600 mt-1">+{formatCurrency(design.priceAdd)}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lens Material */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Materiau</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {LENS_MATERIALS.map((material) => (
            <div
              key={material.value}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                orderData.lensType.material === material.value
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => updateLensType('material', material.value)}
            >
              <p className="font-medium text-gray-900">{material.label}</p>
              <p className="text-sm text-purple-600">{formatCurrency(material.price)} / verre</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
