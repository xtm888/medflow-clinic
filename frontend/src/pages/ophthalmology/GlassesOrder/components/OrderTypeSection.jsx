/**
 * OrderTypeSection Component
 *
 * Radio buttons for selecting order type.
 */

import { ORDER_TYPES } from '../constants';

export default function OrderTypeSection({ orderType, onOrderTypeChange }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Type de commande</h2>
      <div className="flex space-x-4">
        {ORDER_TYPES.map(type => (
          <label key={type.value} className="flex items-center">
            <input
              type="radio"
              name="orderType"
              value={type.value}
              checked={orderType === type.value}
              onChange={(e) => onOrderTypeChange(e.target.value)}
              className="mr-2"
            />
            {type.label}
          </label>
        ))}
      </div>
    </div>
  );
}
