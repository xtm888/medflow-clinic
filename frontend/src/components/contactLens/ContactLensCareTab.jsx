/**
 * ContactLensCareTab - Care Instructions & Annual Supply Calculator
 *
 * StudioVision Parity: Tab 3 of Contact Lens Fitting workflow
 *
 * Features:
 * - Solution type selection
 * - Annual supply calculator based on modality
 * - Rebate tracking
 * - Special instructions
 * - Supply cost estimation
 */

import { useCallback, useMemo } from 'react';
import {
  Droplet,
  Package,
  DollarSign,
  Info,
  Check,
  Gift
} from 'lucide-react';

// Solution types
const SOLUTION_TYPES = [
  {
    value: 'multipurpose',
    label: 'Multi-usage',
    labelEn: 'Multipurpose',
    desc: 'Nettoyage, rinçage, désinfection, conservation',
    brands: ['Biotrue', 'Opti-Free', 'ReNu', 'Complete']
  },
  {
    value: 'hydrogen_peroxide',
    label: 'Peroxyde d\'hydrogène',
    labelEn: 'Hydrogen Peroxide',
    desc: 'Désinfection profonde - neutralisation requise',
    brands: ['Clear Care', 'AO Sept', 'Oxysept']
  },
  {
    value: 'saline',
    label: 'Saline',
    labelEn: 'Saline',
    desc: 'Rinçage uniquement - pas de désinfection',
    brands: ['Unisol', 'Lens Plus']
  },
  {
    value: 'rgp_solution',
    label: 'Solution RGP',
    labelEn: 'RGP Solution',
    desc: 'Pour lentilles rigides',
    brands: ['Boston', 'Unique pH']
  },
  {
    value: 'not_applicable',
    label: 'Non applicable',
    labelEn: 'N/A',
    desc: 'Lentilles journalières jetables',
    brands: []
  }
];

// Boxes per year by modality
const BOXES_PER_YEAR = {
  daily: { lenses: 365, boxSize: 30, boxesNeeded: Math.ceil(365 / 30) }, // ~12-13 boxes
  biweekly: { lenses: 26, boxSize: 6, boxesNeeded: Math.ceil(26 / 6) }, // ~5 boxes
  monthly: { lenses: 12, boxSize: 6, boxesNeeded: 2 }, // 2 boxes
  quarterly: { lenses: 4, boxSize: 4, boxesNeeded: 1 }, // 1 box
  annual: { lenses: 1, boxSize: 1, boxesNeeded: 1 }, // 1 lens/pair
  extended: { lenses: 12, boxSize: 6, boxesNeeded: 2 } // 2 boxes
};

export default function ContactLensCareTab({
  data = {},
  finalPrescription = {},
  onUpdate,
  readOnly = false
}) {
  // Update handler
  const handleUpdate = useCallback((field, value) => {
    if (readOnly) return;
    onUpdate(prev => ({
      ...prev,
      [field]: value
    }));
  }, [onUpdate, readOnly]);

  // Handle nested update
  const handleNestedUpdate = useCallback((parent, field, value) => {
    if (readOnly) return;
    onUpdate(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] || {}),
        [field]: value
      }
    }));
  }, [onUpdate, readOnly]);

  // Calculate annual supply
  const annualSupply = useMemo(() => {
    const modalityOD = finalPrescription.OD?.modality || 'monthly';
    const modalityOS = finalPrescription.OS?.modality || 'monthly';
    const wearingDays = data.annualSupply?.wearingDaysPerWeek || 7;

    // Adjust for wearing days
    const adjustmentFactor = wearingDays / 7;

    const odConfig = BOXES_PER_YEAR[modalityOD] || BOXES_PER_YEAR.monthly;
    const osConfig = BOXES_PER_YEAR[modalityOS] || BOXES_PER_YEAR.monthly;

    // Calculate boxes needed (same modality means same count)
    const odBoxes = Math.ceil(odConfig.boxesNeeded * adjustmentFactor);
    const osBoxes = Math.ceil(osConfig.boxesNeeded * adjustmentFactor);

    return {
      OD: {
        modality: modalityOD,
        lensesPerYear: Math.ceil(odConfig.lenses * adjustmentFactor),
        boxSize: odConfig.boxSize,
        boxesNeeded: odBoxes
      },
      OS: {
        modality: modalityOS,
        lensesPerYear: Math.ceil(osConfig.lenses * adjustmentFactor),
        boxSize: osConfig.boxSize,
        boxesNeeded: osBoxes
      },
      totalBoxes: odBoxes + osBoxes
    };
  }, [finalPrescription, data.annualSupply?.wearingDaysPerWeek]);

  // Get selected solution info
  const selectedSolution = SOLUTION_TYPES.find(s => s.value === data.solutionType);

  // Calculate total cost estimate
  const costEstimate = useMemo(() => {
    const boxPrice = 35; // Average price per box
    const solutionPrice = data.solutionQuantity ? data.solutionQuantity * 15 : 60; // ~15/bottle
    const rebate = data.rebateInfo?.amount || 0;

    const lensTotal = annualSupply.totalBoxes * boxPrice;
    const total = lensTotal + solutionPrice - rebate;

    return {
      lenses: lensTotal,
      solution: solutionPrice,
      rebate,
      total: Math.max(0, total)
    };
  }, [annualSupply, data.solutionQuantity, data.rebateInfo?.amount]);

  return (
    <div className="space-y-6">
      {/* Solution Selection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Droplet className="w-5 h-5 text-teal-500" />
          <span className="font-bold">Solution d'entretien</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type de solution</label>
            <select
              value={data.solutionType || ''}
              onChange={(e) => handleUpdate('solutionType', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Sélectionner...</option>
              {SOLUTION_TYPES.map(sol => (
                <option key={sol.value} value={sol.value}>
                  {sol.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Marque recommandée</label>
            {selectedSolution?.brands?.length > 0 ? (
              <select
                value={data.solutionBrand || ''}
                onChange={(e) => handleUpdate('solutionBrand', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Sélectionner...</option>
                {selectedSolution.brands.map(brand => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={data.solutionBrand || ''}
                onChange={(e) => handleUpdate('solutionBrand', e.target.value)}
                placeholder="Marque de solution"
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            )}
          </div>
        </div>

        {selectedSolution && (
          <div className="flex items-start gap-3 mt-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">{selectedSolution.label}</p>
              <p className="text-sm text-blue-600">{selectedSolution.desc}</p>
            </div>
          </div>
        )}

        {data.solutionType !== 'not_applicable' && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Quantité annuelle (bouteilles)</label>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50"
                onClick={() => handleUpdate('solutionQuantity', Math.max(1, (data.solutionQuantity || 4) - 1))}
                disabled={readOnly}
              >
                -
              </button>
              <input
                type="number"
                value={data.solutionQuantity || 4}
                onChange={(e) => handleUpdate('solutionQuantity', parseInt(e.target.value) || 1)}
                min="1"
                max="24"
                disabled={readOnly}
                className="w-20 px-3 py-1 text-center border-t border-b border-gray-300 focus:outline-none disabled:bg-gray-100"
              />
              <button
                className="px-3 py-1 border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50"
                onClick={() => handleUpdate('solutionQuantity', Math.min(24, (data.solutionQuantity || 4) + 1))}
                disabled={readOnly}
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recommandation: 4-6 bouteilles/an pour un usage quotidien
            </p>
          </div>
        )}
      </div>

      <hr className="border-gray-200" />

      {/* Annual Supply Calculator */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-purple-500" />
          <span className="font-bold">Calcul approvisionnement annuel</span>
        </div>

        {/* Wearing Days Adjustment */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Jours de port par semaine</label>
          <div className="flex gap-2">
            {[5, 6, 7].map(days => (
              <button
                key={days}
                className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                  data.annualSupply?.wearingDaysPerWeek === days
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => handleNestedUpdate('annualSupply', 'wearingDaysPerWeek', days)}
                disabled={readOnly}
              >
                {days} jours
              </button>
            ))}
          </div>
        </div>

        {/* Supply Table */}
        <div className="overflow-x-auto bg-gray-50 p-4 rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="pb-2">Œil</th>
                <th className="pb-2">Modalité</th>
                <th className="pb-2 text-right">Lentilles/an</th>
                <th className="pb-2 text-right">Par boîte</th>
                <th className="pb-2 text-right">Boîtes nécessaires</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">OD</span>
                </td>
                <td>{annualSupply.OD.modality}</td>
                <td className="text-right">{annualSupply.OD.lensesPerYear}</td>
                <td className="text-right">{annualSupply.OD.boxSize}</td>
                <td className="text-right font-bold">{annualSupply.OD.boxesNeeded}</td>
              </tr>
              <tr>
                <td className="py-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">OS</span>
                </td>
                <td>{annualSupply.OS.modality}</td>
                <td className="text-right">{annualSupply.OS.lensesPerYear}</td>
                <td className="text-right">{annualSupply.OS.boxSize}</td>
                <td className="text-right font-bold">{annualSupply.OS.boxesNeeded}</td>
              </tr>
              <tr className="bg-purple-50">
                <td colSpan={4} className="py-2 font-bold">Total boîtes</td>
                <td className="text-right font-bold text-lg text-purple-600">
                  {annualSupply.totalBoxes}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add to Prescription Option */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.annualSupply?.addToPrescription || false}
            onChange={(e) => handleNestedUpdate('annualSupply', 'addToPrescription', e.target.checked)}
            disabled={readOnly}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="flex items-center gap-1 text-sm">
            <Check className="w-4 h-4" />
            Inclure l'approvisionnement annuel sur l'ordonnance
          </span>
        </label>
      </div>

      <hr className="border-gray-200" />

      {/* Rebate Information */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5 text-orange-500" />
          <span className="font-bold">Programme de remise fabricant</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={data.rebateInfo?.available || false}
                onChange={(e) => handleNestedUpdate('rebateInfo', 'available', e.target.checked)}
                disabled={readOnly}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Remise disponible
            </label>
          </div>

          {data.rebateInfo?.available && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Montant de la remise</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={data.rebateInfo?.amount || ''}
                    onChange={(e) => handleNestedUpdate('rebateInfo', 'amount', parseFloat(e.target.value))}
                    disabled={readOnly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <span>€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Programme</label>
                <input
                  value={data.rebateInfo?.manufacturerProgram || ''}
                  onChange={(e) => handleNestedUpdate('rebateInfo', 'manufacturerProgram', e.target.value)}
                  placeholder="Ex: J&J Advantage"
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date d'expiration</label>
                <input
                  type="date"
                  value={data.rebateInfo?.expirationDate ? data.rebateInfo.expirationDate.split('T')[0] : ''}
                  onChange={(e) => handleNestedUpdate('rebateInfo', 'expirationDate', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Cost Estimate Summary */}
      <div className="p-4 bg-green-50 rounded-md border border-green-200">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-green-600" />
          <span className="font-bold text-green-700">Estimation coût annuel</span>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Lentilles</p>
            <p className="text-xl font-bold">{costEstimate.lenses} €</p>
            <p className="text-xs text-gray-500">{annualSupply.totalBoxes} boîtes</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Solution</p>
            <p className="text-xl font-bold">{costEstimate.solution} €</p>
            <p className="text-xs text-gray-500">{data.solutionQuantity || 4} bouteilles</p>
          </div>

          {costEstimate.rebate > 0 && (
            <div>
              <p className="text-sm text-orange-600">Remise</p>
              <p className="text-xl font-bold text-orange-600">-{costEstimate.rebate} €</p>
              <p className="text-xs text-gray-500">Fabricant</p>
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-gray-600">Total</p>
            <p className="text-2xl font-bold text-green-600">
              {costEstimate.total} €
            </p>
            <p className="text-xs text-gray-500">par an</p>
          </div>
        </div>
      </div>

      {/* Special Instructions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-blue-500" />
          <span className="font-bold">Instructions spéciales</span>
        </div>

        <textarea
          value={data.specialInstructions || ''}
          onChange={(e) => handleUpdate('specialInstructions', e.target.value)}
          placeholder="Instructions particulières pour ce patient (ex: sensibilité, allergies aux solutions, usage d'humidifiants...)&#10;&#10;Specific instructions for this patient..."
          rows={4}
          disabled={readOnly}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      {/* Quick Care Tips */}
      <div className="p-4 bg-blue-50 rounded-md">
        <h4 className="font-bold mb-2 text-blue-700 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Rappels d'entretien à transmettre
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            'Se laver les mains avant manipulation',
            'Ne jamais utiliser d\'eau du robinet',
            'Remplacer l\'étui tous les 3 mois',
            'Ne pas dormir avec les lentilles (sauf indication)',
            'Respecter la date de remplacement',
            'Consulter en cas de douleur/rougeur'
          ].map((tip, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Annual supply summary badge
 */
export function AnnualSupplySummary({ supply, prescription }) {
  if (!supply || !prescription) return null;

  const modalityOD = prescription.OD?.modality || 'monthly';
  const config = BOXES_PER_YEAR[modalityOD] || BOXES_PER_YEAR.monthly;
  const totalBoxes = config.boxesNeeded * 2;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
      <Package className="w-3 h-3" />
      <span>{totalBoxes} boîtes/an</span>
    </span>
  );
}
