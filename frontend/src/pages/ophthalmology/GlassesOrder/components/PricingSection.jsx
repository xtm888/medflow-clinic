/**
 * PricingSection Component
 *
 * Displays pricing items, totals, and convention coverage.
 */

import { Plus, Trash2, Building2, AlertTriangle } from 'lucide-react';
import { COATING_OPTIONS, formatCurrency, calculateCoatingsTotal } from '../constants';

export default function PricingSection({
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  coatings,
  selectedFrame,
  selectedLensOd,
  selectedLensOs,
  contactLensQuantity,
  orderTotal,
  conventionCoverage
}) {
  const coatingsTotal = calculateCoatingsTotal(coatings);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Articles et Tarification</h2>
        <button
          type="button"
          onClick={onAddItem}
          className="btn btn-secondary text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Ajouter article
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              placeholder="Description"
              value={item.description}
              onChange={(e) => onUpdateItem(index, 'description', e.target.value)}
              className="input flex-1"
            />
            <input
              type="number"
              placeholder="Qté"
              value={item.quantity}
              onChange={(e) => onUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
              className="input w-20"
              min="1"
            />
            <input
              type="number"
              placeholder="Prix"
              value={item.unitPrice}
              onChange={(e) => onUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
              className="input w-28"
            />
            <span className="font-semibold w-32 text-right">
              {formatCurrency(item.total || 0)}
            </span>
            <button
              type="button"
              onClick={() => onRemoveItem(index)}
              className="p-2 text-red-600 hover:bg-red-50 rounded"
              disabled={items.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t space-y-2">
        {/* Coatings */}
        {coatings.length > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Traitements ({coatings.length}):</span>
            <span>+{formatCurrency(coatingsTotal)}</span>
          </div>
        )}

        {/* Frame from inventory */}
        {selectedFrame && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Monture ({selectedFrame.brand} {selectedFrame.model}):</span>
            <span>+{formatCurrency(selectedFrame.price)}</span>
          </div>
        )}

        {/* Contact lenses from inventory */}
        {selectedLensOd && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Lentilles OD ({contactLensQuantity.od} boîte(s)):</span>
            <span>+{formatCurrency(selectedLensOd.price * contactLensQuantity.od)}</span>
          </div>
        )}
        {selectedLensOs && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Lentilles OS ({contactLensQuantity.os} boîte(s)):</span>
            <span>+{formatCurrency(selectedLensOs.price * contactLensQuantity.os)}</span>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-lg font-semibold">Total:</span>
          <span className="text-2xl font-bold text-primary-600">
            {formatCurrency(orderTotal)}
          </span>
        </div>

        {/* Convention Coverage Display */}
        {conventionCoverage && (
          <ConventionCoverageDisplay coverage={conventionCoverage} />
        )}
      </div>
    </div>
  );
}

// Sub-component for convention coverage
function ConventionCoverageDisplay({ coverage }) {
  return (
    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center mb-2">
        <Building2 className="h-4 w-4 text-blue-600 mr-2" />
        <span className="font-medium text-blue-800">
          Convention: {coverage.companyName}
        </span>
      </div>

      {coverage.opticalNotCovered ? (
        <div className="text-amber-700 text-sm flex items-center">
          <AlertTriangle className="h-4 w-4 mr-1" />
          Optique non couvert par cette convention
        </div>
      ) : (
        <>
          <div className="text-sm text-blue-600 mb-2">
            Couverture optique: {coverage.coveragePercentage}%
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-blue-100 rounded p-2">
              <span className="text-blue-600">Part entreprise:</span>
              <p className="font-bold text-blue-800">
                {new Intl.NumberFormat('fr-CD').format(coverage.companyPays)} CDF
              </p>
            </div>
            <div className="bg-orange-100 rounded p-2">
              <span className="text-orange-600">Vous payez:</span>
              <p className="font-bold text-orange-800">
                {new Intl.NumberFormat('fr-CD').format(coverage.patientPays)} CDF
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
