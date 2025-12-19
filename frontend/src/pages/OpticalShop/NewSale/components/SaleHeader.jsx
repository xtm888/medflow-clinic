/**
 * SaleHeader Component
 *
 * Header with patient info and convention banner for the sale wizard.
 */

import { Glasses, X, Check, AlertCircle, DollarSign } from 'lucide-react';

export default function SaleHeader({ patient, conventionInfo, onClose }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Glasses className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nouvelle Vente</h1>
            <p className="text-gray-500">
              {patient?.firstName} {patient?.lastName} - {patient?.fileNumber}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Convention Info Banner */}
      {conventionInfo && (
        <ConventionBanner conventionInfo={conventionInfo} />
      )}
    </div>
  );
}

function ConventionBanner({ conventionInfo }) {
  const hasCoverage = conventionInfo.hasConvention && conventionInfo.opticalCovered;
  const hasConventionNoCoverage = conventionInfo.hasConvention && !conventionInfo.opticalCovered;

  return (
    <div className={`mt-4 p-4 rounded-lg ${
      hasCoverage
        ? 'bg-green-50 border border-green-200'
        : hasConventionNoCoverage
        ? 'bg-red-50 border border-red-200'
        : 'bg-gray-50 border border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {hasCoverage ? (
            <>
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">
                  Convention: {conventionInfo.company?.name}
                  {conventionInfo.company?.conventionCode && ` (${conventionInfo.company.conventionCode})`}
                </p>
                <p className="text-sm text-green-600">
                  {conventionInfo.message}
                  {conventionInfo.employeeId && ` | Matricule: ${conventionInfo.employeeId}`}
                </p>
              </div>
            </>
          ) : hasConventionNoCoverage ? (
            <>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-800">
                  Convention: {conventionInfo.company?.name} - OPTIQUE NON COUVERT
                </p>
                <p className="text-sm text-red-600">{conventionInfo.message}</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-gray-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Patient sans convention</p>
                <p className="text-sm text-gray-600">Paiement cash - 100% a charge du patient</p>
              </div>
            </>
          )}
        </div>

        {hasCoverage && (
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600">{conventionInfo.coveragePercentage}%</p>
            <p className="text-xs text-green-600">Couverture convention</p>
            {conventionInfo.requiresApproval && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                Approbation requise
              </span>
            )}
          </div>
        )}
      </div>

      {conventionInfo.notes && (
        <p className="mt-2 text-sm text-gray-600 italic border-t pt-2">
          Note: {conventionInfo.notes}
        </p>
      )}
    </div>
  );
}
