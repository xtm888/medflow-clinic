/**
 * PrescriptionPreviewModal Component
 *
 * Modal for previewing and printing optical prescriptions.
 */

import { X, Printer } from 'lucide-react';
import { LENS_TYPES } from './prescriptionConstants';

export default function PrescriptionPreviewModal({
  isOpen,
  onClose,
  data,
  patient,
  selectedLensTypes,
  readingAdd,
  onPrint
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Aperçu de l'Ordonnance Lunettes</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Prescription Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-blue-900 mb-2">ORDONNANCE OPTIQUE</h2>
            <div className="text-sm text-gray-600">
              <p>Dr. {data.examiner}</p>
              <p>Date: {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          {/* Patient Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Informations Patient</h3>
            <p><strong>Nom:</strong> {patient?.firstName} {patient?.lastName}</p>
            <p><strong>Âge:</strong> {patient?.age} ans</p>
            <p><strong>Date de naissance:</strong> {patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('fr-FR') : 'N/A'}</p>
          </div>

          {/* Prescription Details */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 text-lg border-b pb-2">Correction Prescrite</h3>
            <table className="w-full border-collapse mb-4">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-gray-300 px-4 py-2">Œil</th>
                  <th className="border border-gray-300 px-4 py-2">Sphère</th>
                  <th className="border border-gray-300 px-4 py-2">Cylindre</th>
                  <th className="border border-gray-300 px-4 py-2">Axe</th>
                  <th className="border border-gray-300 px-4 py-2">AV</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 font-medium">OD (Droit)</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                    {data.subjective?.OD?.sphere >= 0 ? '+' : ''}{data.subjective?.OD?.sphere}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                    {data.subjective?.OD?.cylinder >= 0 ? '+' : ''}{data.subjective?.OD?.cylinder}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                    {data.subjective?.OD?.axis}°
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {data.subjective?.OD?.va || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 font-medium">OG (Gauche)</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                    {data.subjective?.OS?.sphere >= 0 ? '+' : ''}{data.subjective?.OS?.sphere}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                    {data.subjective?.OS?.cylinder >= 0 ? '+' : ''}{data.subjective?.OS?.cylinder}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                    {data.subjective?.OS?.axis}°
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {data.subjective?.OS?.va || 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>

            {readingAdd && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p><strong>Addition pour la vision de près:</strong> +{readingAdd.recommended}D</p>
              </div>
            )}

            <div className="mt-3">
              <p><strong>Écart pupillaire:</strong> {data.pupilDistance?.binocular}mm
                (OD: {data.pupilDistance?.OD}mm, OG: {data.pupilDistance?.OS}mm)</p>
            </div>
          </div>

          {/* Lens Types */}
          {selectedLensTypes.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold mb-2">Type de Verres Prescrits</h3>
              <div className="flex flex-wrap gap-2">
                {selectedLensTypes.map(type => {
                  const lensType = LENS_TYPES.find(t => t.value === type);
                  return (
                    <span key={type} className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
                      {lensType?.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {data.finalPrescription?.recommendations && data.finalPrescription.recommendations.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Recommandations</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {data.finalPrescription.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validity */}
          <div className="text-center text-sm text-gray-600 border-t pt-4">
            <p className="font-semibold">Cette ordonnance est valide pour 12 mois</p>
            <p className="mt-2">Valid until: {new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}</p>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-gray-600 mb-4">Signature et cachet du prescripteur</p>
            <div className="h-16 border-t-2 border-gray-800 w-48 mx-auto mt-2"></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Fermer
          </button>
          <button
            onClick={() => {
              onClose();
              onPrint();
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}
