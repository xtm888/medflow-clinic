/**
 * AdditionalOptionsSection Component
 *
 * Priority, delivery, and notes for the order.
 */

import { PRIORITY_OPTIONS, DELIVERY_METHODS } from '../constants';

export default function AdditionalOptionsSection({
  priority,
  onPriorityChange,
  deliveryMethod,
  onDeliveryMethodChange,
  notes,
  onNotesChange
}) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Options supplémentaires</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priorité
          </label>
          <select
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="input"
          >
            {PRIORITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Delivery */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Livraison
          </label>
          <select
            value={deliveryMethod}
            onChange={(e) => onDeliveryMethodChange(e.target.value)}
            className="input"
          >
            {DELIVERY_METHODS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clinical Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes cliniques
          </label>
          <textarea
            value={notes.clinical}
            onChange={(e) => onNotesChange('clinical', e.target.value)}
            className="input"
            rows="3"
            placeholder="Notes pour le dossier patient..."
          />
        </div>

        {/* Production Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes de production
          </label>
          <textarea
            value={notes.production}
            onChange={(e) => onNotesChange('production', e.target.value)}
            className="input"
            rows="3"
            placeholder="Instructions pour le laboratoire..."
          />
        </div>
      </div>
    </div>
  );
}
