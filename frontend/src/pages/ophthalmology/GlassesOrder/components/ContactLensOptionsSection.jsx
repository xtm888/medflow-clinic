/**
 * ContactLensOptionsSection Component
 *
 * Contact lens selection for OD and OS with quantity inputs.
 */

import ContactLensSelector from './ContactLensSelector';

export default function ContactLensOptionsSection({
  exam,
  selectedLensOd,
  onSelectLensOd,
  onClearLensOd,
  selectedLensOs,
  onSelectLensOs,
  onClearLensOs,
  contactLensQuantity,
  onUpdateQuantity
}) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Options Lentilles de Contact</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OD */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">OD (Droit)</h3>
          <div className="space-y-3">
            <ContactLensSelector
              eye="OD"
              selectedLens={selectedLensOd}
              onSelect={onSelectLensOd}
              onClear={onClearLensOd}
              prescription={exam?.finalPrescription?.od}
            />
            {selectedLensOd && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Quantité (boîtes):</label>
                <input
                  type="number"
                  min="1"
                  value={contactLensQuantity.od}
                  onChange={(e) => onUpdateQuantity('od', e.target.value)}
                  className="input w-20"
                />
              </div>
            )}
          </div>
        </div>

        {/* OS */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">OS (Gauche)</h3>
          <div className="space-y-3">
            <ContactLensSelector
              eye="OS"
              selectedLens={selectedLensOs}
              onSelect={onSelectLensOs}
              onClear={onClearLensOs}
              prescription={exam?.finalPrescription?.os}
            />
            {selectedLensOs && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Quantité (boîtes):</label>
                <input
                  type="number"
                  min="1"
                  value={contactLensQuantity.os}
                  onChange={(e) => onUpdateQuantity('os', e.target.value)}
                  className="input w-20"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
