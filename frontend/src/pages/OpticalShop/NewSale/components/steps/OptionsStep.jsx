/**
 * OptionsStep Component
 *
 * Step 4: Lens options/coatings and discount.
 */

import { Check } from 'lucide-react';
import { LENS_OPTIONS, formatCurrency } from '../../constants';

export default function OptionsStep({
  orderData,
  setOrderData,
  onCalculatePricing
}) {
  const toggleOption = (optionKey) => {
    const option = LENS_OPTIONS[optionKey];
    setOrderData(prev => ({
      ...prev,
      lensOptions: {
        ...prev.lensOptions,
        [optionKey]: {
          ...prev.lensOptions[optionKey],
          selected: !prev.lensOptions[optionKey].selected,
          price: option.price
        }
      }
    }));
    onCalculatePricing();
  };

  const updateDiscount = (field, value) => {
    setOrderData(prev => ({
      ...prev,
      pricing: { ...prev.pricing, [field]: field === 'discount' ? parseFloat(value) || 0 : value }
    }));
    onCalculatePricing();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Options & Traitements</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(LENS_OPTIONS).map(([key, option]) => (
          <OptionCard
            key={key}
            option={option}
            selected={orderData.lensOptions[key]?.selected}
            onToggle={() => toggleOption(key)}
          />
        ))}
      </div>

      {/* Discount */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">Remise</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="number"
              value={orderData.pricing.discount}
              onChange={(e) => updateDiscount('discount', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="0"
            />
          </div>
          <select
            value={orderData.pricing.discountType}
            onChange={(e) => updateDiscount('discountType', e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="fixed">CDF</option>
            <option value="percent">%</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function OptionCard({ option, selected, onToggle }) {
  return (
    <div
      className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
        selected
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-200 hover:border-purple-300'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{option.label}</p>
          <p className="text-sm text-gray-500">{option.description}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-purple-600">{formatCurrency(option.price)}</p>
          {selected && (
            <Check className="w-5 h-5 text-green-600 ml-auto" />
          )}
        </div>
      </div>
    </div>
  );
}
