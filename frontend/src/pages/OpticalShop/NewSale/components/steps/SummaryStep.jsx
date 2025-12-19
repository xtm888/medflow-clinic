/**
 * SummaryStep Component
 *
 * Step 5: Order summary with pricing and availability check.
 */

import { User, Check, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../constants';

export default function SummaryStep({
  patient,
  orderData,
  conventionInfo,
  availability,
  checkingAvailability,
  onCheckAvailability
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Resume de la Commande</h2>

      {/* Patient Info */}
      <PatientInfoCard patient={patient} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prescription Summary */}
        <PrescriptionSummary orderData={orderData} />

        {/* Frame Summary */}
        <FrameSummary frame={orderData.frame} />
      </div>

      {/* Lenses & Options */}
      <LensOptionsSummary orderData={orderData} />

      {/* Pricing Summary */}
      <PricingSummary
        orderData={orderData}
        conventionInfo={conventionInfo}
      />

      {/* Availability Check */}
      <AvailabilitySection
        availability={availability}
        checking={checkingAvailability}
        onCheck={onCheckAvailability}
      />
    </div>
  );
}

function PatientInfoCard({ patient }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gray-200 rounded-full">
          <User className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">
            {patient?.firstName} {patient?.lastName}
          </p>
          <p className="text-sm text-gray-500">
            Dossier: {patient?.fileNumber} | Tel: {patient?.phone}
          </p>
        </div>
      </div>
    </div>
  );
}

function PrescriptionSummary({ orderData }) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium text-gray-900 mb-3">Prescription</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">OD:</span>
          <span>
            Sph {orderData.rightLens.sphere || '-'} Cyl {orderData.rightLens.cylinder || '-'} Axe {orderData.rightLens.axis || '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">OS:</span>
          <span>
            Sph {orderData.leftLens.sphere || '-'} Cyl {orderData.leftLens.cylinder || '-'} Axe {orderData.leftLens.axis || '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">PD:</span>
          <span>{orderData.measurements.pd} mm</span>
        </div>
      </div>
    </div>
  );
}

function FrameSummary({ frame }) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium text-gray-900 mb-3">Monture</h3>
      {frame ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{frame.brand} {frame.model}</p>
          <p className="text-gray-500">{frame.color} - {frame.size}</p>
          <p className="text-purple-600 font-medium">{formatCurrency(frame.price)}</p>
        </div>
      ) : (
        <p className="text-red-500">Aucune monture selectionnee</p>
      )}
    </div>
  );
}

function LensOptionsSummary({ orderData }) {
  const designLabel = {
    'progressive': 'Progressif',
    'bifocal': 'Bifocal',
    'single_vision': 'Unifocal'
  };

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium text-gray-900 mb-3">Verres & Options</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Type: {designLabel[orderData.lensType.design] || orderData.lensType.design}</span>
          <span>{orderData.lensType.material}</span>
        </div>
        {orderData.lensOptions.antiReflective?.selected && (
          <div className="flex justify-between text-gray-600">
            <span>+ Anti-Reflet</span>
            <span>{formatCurrency(15000)}</span>
          </div>
        )}
        {orderData.lensOptions.photochromic?.selected && (
          <div className="flex justify-between text-gray-600">
            <span>+ Photochromique</span>
            <span>{formatCurrency(25000)}</span>
          </div>
        )}
        {orderData.lensOptions.blueLight?.selected && (
          <div className="flex justify-between text-gray-600">
            <span>+ Filtre Lumiere Bleue</span>
            <span>{formatCurrency(10000)}</span>
          </div>
        )}
        {orderData.lensOptions.tint?.selected && (
          <div className="flex justify-between text-gray-600">
            <span>+ Teinte</span>
            <span>{formatCurrency(8000)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PricingSummary({ orderData, conventionInfo }) {
  const hasCoverage = conventionInfo?.hasConvention && conventionInfo?.opticalCovered;
  const hasConventionNoCoverage = conventionInfo?.hasConvention && !conventionInfo?.opticalCovered;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <h3 className="font-medium text-gray-900 mb-3">Total</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Sous-total</span>
          <span>{formatCurrency(orderData.pricing.subtotal)}</span>
        </div>
        {orderData.pricing.discount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Remise</span>
            <span>- {formatCurrency(orderData.pricing.discountAmount || orderData.pricing.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-medium border-t pt-2">
          <span>Total</span>
          <span>{formatCurrency(orderData.pricing.finalTotal)}</span>
        </div>

        {/* Convention Split */}
        {hasCoverage && (
          <>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-sm text-green-600">
                <span>Part Convention ({conventionInfo.coveragePercentage}%)</span>
                <span>{formatCurrency(orderData.pricing.companyPortion ||
                  Math.round((orderData.pricing.finalTotal || 0) * conventionInfo.coveragePercentage / 100))}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-purple-600 mt-1">
                <span>Part Patient ({100 - conventionInfo.coveragePercentage}%)</span>
                <span>{formatCurrency(orderData.pricing.patientPortion ||
                  Math.round((orderData.pricing.finalTotal || 0) * (100 - conventionInfo.coveragePercentage) / 100))}</span>
              </div>
            </div>
            <div className="mt-2 p-2 bg-green-100 rounded text-sm text-green-700">
              Facturation: {conventionInfo.company?.name}
              {conventionInfo.employeeId && ` | Matricule: ${conventionInfo.employeeId}`}
            </div>
            {conventionInfo.requiresApproval && (
              <div className="p-2 bg-orange-100 rounded text-sm text-orange-700">
                Cette commande necessite une approbation prealable de la convention
              </div>
            )}
          </>
        )}

        {/* Cash payment */}
        {(!conventionInfo?.hasConvention || hasConventionNoCoverage) && (
          <div className="flex justify-between text-lg font-bold text-purple-600 border-t pt-2">
            <span>A payer (Cash)</span>
            <span>{formatCurrency(orderData.pricing.finalTotal)}</span>
          </div>
        )}

        {hasConventionNoCoverage && (
          <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
            Services optiques non couverts par {conventionInfo.company?.name}. Paiement cash requis.
          </div>
        )}
      </div>
    </div>
  );
}

function AvailabilitySection({ availability, checking, onCheck }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Disponibilite</h3>
        <button
          onClick={onCheck}
          disabled={checking}
          className="text-sm text-purple-600 hover:text-purple-700"
        >
          {checking ? 'Verification...' : 'Verifier'}
        </button>
      </div>

      {availability && (
        <div className="space-y-2">
          {availability.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span>{item.description}</span>
              {item.available ? (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="w-4 h-4" /> En stock
                </span>
              ) : (
                <span className="flex items-center gap-1 text-orange-600">
                  <AlertCircle className="w-4 h-4" /> Commande externe
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {availability && !availability.allAvailable && (
        <div className="mt-3 p-3 bg-orange-50 rounded-lg">
          <p className="text-sm text-orange-700">
            Certains articles devront etre commandes chez un fournisseur externe.
            Le delai de livraison sera plus long.
          </p>
        </div>
      )}
    </div>
  );
}
